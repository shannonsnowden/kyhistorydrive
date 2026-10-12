/**
 * Shared helpers for the protected-coordinate check (pair extraction + keyed hashing).
 * Known exact pairs are stored as HMAC-SHA256 under a secret key (env PROTECTED_COORDS_KEY, set in
 * Amplify). Without the key the list cannot be brute-forced back to coordinates, even though the
 * Kentucky coordinate space is small.
 */
import crypto from 'node:crypto'

const DOMAIN = 'khd-protected-coords-v2:'
const KEY_CHECK = 'khd-protected-coords-key-check'
const NUM = /-?\d{1,3}\.\d+/g
const isLat = (v) => v > 36 && v < 39.5
const isLon = (v) => v < -81.5 && v > -89.8
const decimals = (s) => (String(Number(s)).split('.')[1] || '').length

/** Normalized "lat,lon" for every Kentucky-range number pair (either order) with ≥2 decimals on at least one side. */
export function extractPairs(text) {
  const nums = []
  for (const m of text.matchAll(NUM)) nums.push({ s: m[0], v: Number(m[0]), i: m.index, end: m.index + m[0].length })
  const out = new Set()
  for (let k = 0; k + 1 < nums.length; k++) {
    const a = nums[k], b = nums[k + 1]
    if (b.i - a.end > 80) continue
    let lat, lon
    if (isLat(a.v) && isLon(b.v)) [lat, lon] = [a, b]
    else if (isLon(a.v) && isLat(b.v)) [lat, lon] = [b, a]
    else continue
    if (decimals(lat.s) < 2 && decimals(lon.s) < 2) continue
    out.add(`${Number(lat.s)},${Number(lon.s)}`)
  }
  return out
}

/** HMAC-SHA256 (first 32 hex) of a normalized "lat,lon" pair under the secret key. */
export function hashPair(pair, key) {
  if (!key) throw new Error('hashPair needs the key')
  return crypto.createHmac('sha256', key).update(DOMAIN + pair).digest('hex').slice(0, 32)
}

/** Fingerprint stored with the list so a wrong key fails loudly instead of matching nothing. */
export const keyCheck = (key) => crypto.createHmac('sha256', key).update(KEY_CHECK).digest('hex').slice(0, 16)

export function buildHashFile(pairs, key, note = '') {
  const hashes = [...new Set(pairs)].map((p) => hashPair(p, key)).sort()
  return { schema: 2, algorithm: 'HMAC-SHA256/32hex', keyEnv: 'PROTECTED_COORDS_KEY', keyCheck: keyCheck(key), note, count: hashes.length, hashes }
}
