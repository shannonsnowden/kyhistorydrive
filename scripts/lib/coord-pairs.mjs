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
  for (const m of text.matchAll(NUM)) {
    let s = m[0], v = Number(s)
    const end = m.index + s.length
    if (v > 81.5 && v < 89.8 && /^\s*(?:°|&#176;|&deg;|deg(?:rees)?)?\s*[Ww]\b/.test(text.slice(end, end + 18))) {
      s = "-" + s
      v = -v
    }
    nums.push({ s, v, i: m.index, end })
  }
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

// ---- Schema 3: 200 m proximity on the 4-decimal grid (check-protected-coords hardening) ----
// The list stores keyed hashes of each protected point on the 4-decimal grid ("p:") plus the
// 0.01° cells its 200 m box touches ("c:"), so a scan pays one or a few HMACs per pair and only
// walks the ~1,500 neighbouring grid points when a coarse cell matches. Nothing is reversible without the key.
export const RADIUS_M = 200
export const DLAT = 19 // ±0.0019° lat ≈ 211 m
export const DLON = 24 // ±0.0024° lon ≈ 211 m at 38°N
const g4 = (v) => Math.round(Number(v) * 1e4)
const s4 = (n) => (n / 1e4).toFixed(4)
const ptLabel = (a, o) => `p:${s4(a)},${s4(o)}`
const cellLabel = (a, o) => `c:${Math.floor(a / 100)},${Math.floor(o / 100)}`
const h3 = (label, key) => crypto.createHmac('sha256', key).update(DOMAIN + label).digest('hex').slice(0, 32)
export function metres(a1, o1, a2, o2) {
  const t = Math.PI / 180
  return 6371000 * Math.hypot((o2 - o1) * t * Math.cos(((a1 + a2) / 2) * t), (a2 - a1) * t)
}
function cellsAround(a, o) {
  const out = new Set()
  for (const da of [-DLAT, DLAT]) for (const dn of [-DLON, DLON]) out.add(cellLabel(a + da, o + dn))
  return out
}
/** Build a schema-3 list from "lat,lon" strings (exact points). */
export function buildProximityFile(pairs, key, note = '') {
  const pts = new Set(), cells = new Set()
  for (const p of new Set(pairs)) {
    const [la, lo] = p.split(',').map(g4)
    pts.add(h3(ptLabel(la, lo), key))
    for (const c of cellsAround(la, lo)) cells.add(h3(c, key))
  }
  return { schema: 3, algorithm: 'HMAC-SHA256/32hex', keyEnv: 'PROTECTED_COORDS_KEY', keyCheck: keyCheck(key), grid: 4, radiusM: RADIUS_M, note, count: pts.size, points: [...pts].sort(), cells: [...cells].sort() }
}
/** Returns a matcher(lat, lon) -> distance in metres to the nearest listed point within RADIUS_M, or null. Cached by pair. */
export function proximityMatcher(list, key) {
  const pts = new Set(list.points), cells = new Set(list.cells), cache = new Map(), cellCache = new Map()
  const cellHit = (c) => { let v = cellCache.get(c); if (v === undefined) cellCache.set(c, (v = cells.has(h3(c, key)))); return v }
  const fn = (lat, lon) => {
    const a = g4(lat), o = g4(lon), k = a * 1e7 + o
    if (cache.has(k)) return cache.get(k)
    let best = null
    if ([...cellsAround(a, o)].some(cellHit)) {
      for (let da = -DLAT; da <= DLAT; da++) for (let dn = -DLON; dn <= DLON; dn++) {
        const d = metres(lat, lon, (a + da) / 1e4, (o + dn) / 1e4)
        if (d > RADIUS_M || (best != null && d >= best)) continue
        if (pts.has(h3(ptLabel(a + da, o + dn), key))) best = d
      }
    }
    cache.set(k, best)
    return best
  }
  fn.stats = () => ({ pairs: cache.size, cells: cellCache.size })
  return fn
}
