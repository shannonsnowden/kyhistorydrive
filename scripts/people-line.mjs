/**
 * One identifier line for /people/. Every part is copied from people.json
 * or from a linked story already in the repo. Missing parts are left out.
 * County comes from the story file's own county field. A map place is used
 * only when that is the single recorded exact or override place and the
 * stories do not name more than one county.
 */

const EXACT_SPAN = /^(\d{4})\s*[–-]\s*(\d{4})$/

/** Exact year span from lifeDates. Circa ranges stay off birthDate and deathDate. */
export function knownLifeSpan(lifeDates) {
  const match = String(lifeDates || '').trim().match(EXACT_SPAN)
  if (!match) return null
  return { birthDate: match[1], deathDate: match[2] }
}

export function personPlace(storySlugs, storiesBySlug) {
  const counties = new Set()
  const places = new Set()
  for (const slug of storySlugs || []) {
    const story = storiesBySlug.get(slug)
    if (!story) continue
    const county = String(story.fileCounty || '').trim()
    if (county) counties.add(county)
    const matched = String(story.matchedPlace || '').trim()
    const confidence = story.mapConfidence || ''
    if (matched && (confidence === 'exact' || confidence === 'override')) places.add(matched)
  }
  if (counties.size === 1) {
    const county = [...counties][0]
    return /county$/i.test(county) ? county : `${county} County`
  }
  if (counties.size > 1) return ''
  if (places.size === 1) return [...places][0]
  return ''
}

/** Role, life dates, and place, joined when each one is already on record. */
export function personIdentifier(source, storiesBySlug) {
  const role = String(source?.role || '').trim()
  const dates = String(source?.lifeDates || '').trim()
  const place = personPlace(source?.stories, storiesBySlug)
  return [role, dates, place].filter(Boolean).join(' · ')
}
