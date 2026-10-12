/**
 * Shared helpers for the protected-coordinate check (pair extraction + hashing).
 * The salted hashes are NOT secret: the salt is here in public and the coordinate space is small, so they
 * can be reversed. They only avoid republishing plain values; the repo is going private (Shannon, Oct 11, 2026).
 */
import crypto from 'node:crypto'

export const HASH_SALT = 'khd-protected-coords-v1:'
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

export function hashPair(pair) {
  return crypto.createHash('sha256').update(HASH_SALT + pair).digest('hex').slice(0, 20)
}
