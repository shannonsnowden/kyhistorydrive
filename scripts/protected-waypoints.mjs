/**
 * Route waypoints at looting-sensitive sites use the same identification as
 * archaeological pins (era "prehistoric" or tag "archaeology", minus the
 * pin-rounding.json skip lists). Published track coordinates for those sites
 * are 0.1° (one decimal). Coordinates already at that precision are left as written.
 */
import fs from 'node:fs'
import path from 'node:path'

/** Named sites the pin rule misses because their stories are not tagged archaeology. */
const EXTRA_PLACES = ['Eskippakithiki', 'Indian Old Fields']

export function decimalPlaces(text) {
  const match = String(text ?? '').match(/\.(\d+)/)
  return match ? match[1].length : 0
}

export function includesPhrase(hay, phrase) {
  const h = String(hay || '').toLowerCase()
  const p = String(phrase || '').toLowerCase().trim()
  if (p.length < 8) return false
  let from = 0
  while (from < h.length) {
    const at = h.indexOf(p, from)
    if (at < 0) return false
    const before = at === 0 || !/[a-z0-9]/i.test(h[at - 1])
    const after = at + p.length >= h.length || !/[a-z0-9]/i.test(h[at + p.length])
    if (before && after) return true
    from = at + 1
  }
  return false
}

function titlePlace(title) {
  const cut = String(title || '').split(/\s+(?:at|on|near|in)\s+|[—,]/)[0].trim()
  if (cut.length < 8 || cut.length > 80) return ''
  return cut
}

export function protectedPlaceNames(root) {
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'scripts/pin-rounding.json'), 'utf8'))
  const skipSlugs = new Set(rules.skipSlugs || [])
  const skipHistory = new Set(rules.skipHistoryIds || [])
  const locations = JSON.parse(fs.readFileSync(path.join(root, 'public/content/stories-locations.json'), 'utf8')).locations || {}
  const names = new Set(EXTRA_PLACES)
  const dir = path.join(root, 'public/content/stories')
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    const story = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    const archaeological = story.era === 'prehistoric' || (story.tags || []).includes('archaeology')
    if (!archaeological || skipSlugs.has(story.slug)) continue
    const historyId = locations[story.slug]?.historyId
    if (historyId && skipHistory.has(historyId)) continue
    const matched = locations[story.slug]?.matchedPlace || story.matchedPlace || ''
    if (matched) names.add(matched)
    const place = titlePlace(story.title)
    if (place) names.add(place)
  }
  return [...names]
}

export function isProtectedWaypoint(point, names) {
  const hay = `${point?.name || ''} ${point?.place || ''}`
  return names.some((name) => includesPhrase(hay, name))
}

/** One decimal for a protected site that is still tighter than 0.1°. */
export function roundProtectedWaypoint(point, names) {
  if (!isProtectedWaypoint(point, names)) return point
  const latText = decimalPlaces(point.latText) > 1 ? Number(point.lat).toFixed(1) : String(point.latText)
  const lonText = decimalPlaces(point.lonText) > 1 ? Number(point.lon).toFixed(1) : String(point.lonText)
  return { ...point, lat: Number(latText), lon: Number(lonText), latText, lonText }
}
