/**
 * A history place found only in a story's body is accepted as the story's pin unless the
 * story's own title/summary names a different county than that place's county.
 */
export function bodyMatchFitsStoryCounty(feature, story, countyNames, centroids = null, maxKm = 40) {
  const placeCounty = feature?.properties?.county
  if (!countyNames?.length) return true
  const re = new RegExp(`\\b(${countyNames.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s+County\\b`, 'i')
  const m = [story.title, story.summary].filter(Boolean).join(' ').match(re)
  if (!m) return true
  if (!placeCounty) {
    // place has no county: it must sit near the county the story names
    const c = centroids?.[Object.keys(centroids || {}).find((k) => k.toLowerCase() === m[1].toLowerCase())]
    const p = feature?.geometry?.coordinates
    if (!c || !p) return true
    const km = 111 * Math.hypot(p[1] - c[1], (p[0] - c[0]) * Math.cos((c[1] * Math.PI) / 180))
    return km <= maxKm
  }
  return m[1].toLowerCase() === String(placeCounty).replace(/\s+County$/i, '').toLowerCase()
}

/** Body text for place-name matching: markdown link targets (URLs, /stories/<slug>/ paths) are not prose. */
export function stripLinkTargets(md) {
  return String(md || '').replace(/\]\([^)]*\)/g, ']')
}
