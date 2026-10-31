/**
 * Local start match for Plan a Drive. Callers pass the KY gazetteer in.
 * No network: a pasted address is searched here for a ZIP, town, or distillery
 * already in those lists. Nothing is geocoded and no coordinates are invented.
 */
export const PLACE_MISS = 'We can’t place street addresses yet. Try a town or a 5-digit ZIP.'

// A town or distillery name glued to one of these is a street, not a start.
const STREET_SUFFIX = new Set(
  'rd road st street ave avenue blvd boulevard dr drive ln lane ct court cir circle pkwy parkway hwy highway pike way ter terrace pl place trl trail loop xing crossing aly alley sq square run rte route'.split(' '),
)
const STILL_TAILS = [
  ' warehouse and bottling facility',
  ' american stillhouse',
  ' bourbon experience',
  ' winery and distillery',
  ' distilling co',
  ' distillery',
  ' distilling',
  ' distillers',
  ' spirits',
  ' and co',
  ' co',
]

const norm = (s) => String(s)
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/&/g, ' and ')
  .replace(/\./g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function spans(hay, needle) {
  if (!needle) return []
  const re = new RegExp(`(?<=^|\\s)${escRe(needle)}(?=\\s|$)`, 'g')
  const out = []
  let m
  while ((m = re.exec(hay))) out.push({ start: m.index, end: m.index + needle.length })
  return out
}

const nextWord = (hay, end) => (/^\s+([a-z0-9]+)/.exec(hay.slice(end)) || [])[1] || ''

/** Whole typed name: exact ZIP, then the existing town / distillery rules. */
function matchWhole(v, db, distilleries) {
  const n = v.toLowerCase().replace(/,?\s*(ky|kentucky)$/, '').trim()
  const d = distilleries.find((row) => row[0].toLowerCase() === n) || (n.length > 3 && distilleries.find((row) => row[0].toLowerCase().includes(n)))
  if (d && (d[0].toLowerCase() === n || /distill|trace|turkey|roses|beam|mark|forester|reserve|hill|key|barton/.test(n))) {
    return { label: d[0], lat: d[1], lon: d[2] }
  }
  const p = db.places.find((row) => row[0].toLowerCase() === n) || db.places.find((row) => row[0].toLowerCase().startsWith(n))
  if (p) return { label: p[0], lat: p[1], lon: p[2] }
  if (d) return { label: d[0], lat: d[1], lon: d[2] }
  return null
}

/** Last 5-digit ZIP (or ZIP+4) in the text, if that ZIP is in Kentucky. */
function zipInText(v, zips) {
  const re = /\b(\d{5})(?:-\d{4})?\b/g
  let m
  let five = null
  while ((m = re.exec(v))) five = m[1]
  if (!five) return null
  const z = zips.find((row) => row[0] === five)
  if (!z) return null
  const rest = norm(v)
    .replace(new RegExp(`\\b${five}\\b`, 'g'), ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\b(?:ky|kentucky|usa|united states)\b/g, ' ')
    .trim()
  const fromAddress = /[a-z]/.test(rest)
  return { label: fromAddress ? `ZIP ${five} (from address)` : `ZIP ${five}`, lat: z[1], lon: z[2] }
}

function stillNeedles(name) {
  const full = norm(name)
  const out = []
  if (full.length >= 5) out.push(full)
  let s = full
  for (let i = 0; i < 6; i++) {
    const tail = STILL_TAILS.find((t) => s.endsWith(t))
    if (!tail) break
    s = s.slice(0, -tail.length).trim()
    if (!s.includes(' ') || s.length < 5 || /(?:^|\s)county(?:\s|$)/.test(s)) break
    out.push(s)
  }
  return out
}

/**
 * Town or distillery named somewhere in the paste.
 * Longer names swallow shorter ones inside them ("West Louisville").
 * A name followed by a street suffix is the road, not the town ("Bardstown Rd").
 * Of what remains, the rightmost name wins (a US address puts the city last).
 */
function segmentInText(v, places, distilleries) {
  const hay = norm(v)
  if (!hay) return null
  const placeByNorm = new Map()
  for (const p of places) {
    const key = norm(p[0])
    if (key && !placeByNorm.has(key)) placeByNorm.set(key, p)
  }
  const found = []
  for (const [key, p] of placeByNorm) {
    for (const span of spans(hay, key)) found.push({ ...span, label: p[0], lat: p[1], lon: p[2] })
  }
  const claimed = new Set(placeByNorm.keys())
  for (const d of distilleries) {
    for (const needle of stillNeedles(d[0])) {
      if (claimed.has(needle) || placeByNorm.has(needle)) continue
      claimed.add(needle)
      for (const span of spans(hay, needle)) found.push({ ...span, label: d[0], lat: d[1], lon: d[2] })
    }
  }
  const street = found.filter((span) => STREET_SUFFIX.has(nextWord(hay, span.end)))
  const kept = found.filter((span) => {
    if (STREET_SUFFIX.has(nextWord(hay, span.end))) return false
    return !street.some((s) => s.start <= span.start && s.end >= span.end)
  })
  const visible = kept.filter((span) => !kept.some((other) => other !== span
    && other.start <= span.start && other.end >= span.end
    && (other.end - other.start) > (span.end - span.start)))
  visible.sort((a, b) => b.end - a.end || (b.end - b.start) - (a.end - a.start))
  const best = visible[0]
  return best ? { label: best.label, lat: best.lat, lon: best.lon } : null
}

export function resolveStart(v, db, distilleries) {
  v = String(v ?? '').trim()
  if (!v) return null
  if (/^\d{5}$/.test(v)) {
    const z = db.zips.find((row) => row[0] === v)
    return z ? { label: `ZIP ${v}`, lat: z[1], lon: z[2] } : null
  }
  return matchWhole(v, db, distilleries) || zipInText(v, db.zips) || segmentInText(v, db.places, distilleries)
}
