/**
 * Story-page tools shared by prerendered /stories/ pages and the hash reader.
 * Dates passed in here are already resolved. This module never invents one.
 */

export const SITE_NAME = 'Kentucky History Drive'
export const SITE_AUTHOR = 'Shannon Snowden'
export const CITE_AUTHOR_FALLBACK = 'KY History Drive'
export const SITE_ORIGIN = 'https://kyhistorydrive.com'
export const CORRECTION_REPO = 'shannonsnowden/kyhistorydrive'

const CHICAGO_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const MLA_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export function isoDate(value) {
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(String(value || '').trim())
  return match ? match[1] : ''
}

/** A date written on the story record. Git dates are not consulted here. */
export function explicitPublished(story) {
  return isoDate(story?.publishedDate) || isoDate(story?.datePublished) || isoDate(story?.briefDate) || ''
}

export function explicitModified(story) {
  return (
    isoDate(story?.modifiedDate) ||
    isoDate(story?.dateModified) ||
    isoDate(story?.updatedDate) ||
    isoDate(story?.revisedDate) ||
    isoDate(story?.lastModified) ||
    ''
  )
}

/**
 * Published is the story file's first git commit. Last revised is its last git commit.
 * Story fields are not used: a brief or backfilled date is not a publication date.
 * Empty string when that git date is missing. Never today's date.
 */
export function resolveArticleDates(_story, fallback = {}) {
  return {
    published: isoDate(fallback.published) || isoDate(fallback.created) || '',
    modified: isoDate(fallback.modified) || '',
  }
}

export function storyCanonicalUrl(slug) {
  return `${SITE_ORIGIN}/stories/${encodeURIComponent(slug)}/`
}

function parseIsoParts(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year: Number(match[1]), month, day }
}

export function formatChicagoDate(iso) {
  const parts = parseIsoParts(iso)
  if (!parts) return ''
  return `${CHICAGO_MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`
}

export function formatMlaDate(iso) {
  const parts = parseIsoParts(iso)
  if (!parts) return ''
  return `${parts.day} ${MLA_MONTHS[parts.month - 1]} ${parts.year}`
}

function chicagoAuthor(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length < 2) return parts[0] || ''
  const last = parts.pop()
  return `${last}, ${parts.join(' ')}`
}

/** A person is inverted for Chicago and MLA. A missing name stays the organization. */
function authorCredit(name) {
  if (name == null) name = SITE_AUTHOR
  const text = String(name).trim()
  if (!text || text === CITE_AUTHOR_FALLBACK || text === SITE_NAME) return CITE_AUTHOR_FALLBACK
  return chicagoAuthor(text) || CITE_AUTHOR_FALLBACK
}

function quotedTitle(title) {
  const text = String(title || '').trim()
  if (!text) return '""'
  if (/[.!?]$/.test(text)) return `"${text}"`
  return `"${text}."`
}

function dateSentences(published, modified) {
  const pub = formatChicagoDate(published)
  const mod = formatChicagoDate(modified)
  const bits = []
  if (pub) bits.push(`Published ${pub}.`)
  if (mod) bits.push(`Last revised ${mod}.`)
  return bits.join(' ')
}

function mlaDateClause(published, modified) {
  const pub = formatMlaDate(published)
  const mod = formatMlaDate(modified)
  const bits = []
  if (pub) bits.push(`published ${pub}`)
  if (mod) bits.push(`last revised ${mod}`)
  if (!bits.length) return ''
  return `${bits.join(', ')},`
}

/** Citation text without the access date. The access date is filled in the browser. */
export function buildCitation(style, { title, published, modified, url, author: authorName } = {}) {
  const author = `${authorCredit(authorName)}.`
  const quoted = quotedTitle(title)
  const link = String(url || '').trim()
  if (style === 'mla') {
    const dates = mlaDateClause(published, modified)
    const tail = dates ? `${SITE_NAME}, ${dates} ${link}.` : `${SITE_NAME}, ${link}.`
    const plain = `${author} ${quoted} ${tail}`.replace(/\s+/g, ' ').trim()
    const html = `${esc(author)} ${esc(quoted)} <em>${esc(SITE_NAME)}</em>${esc(tail.slice(SITE_NAME.length))}`
      .replace(/\s+/g, ' ')
      .trim()
    return { plain, html }
  }
  const dates = dateSentences(published, modified)
  const plain = [author, quoted, `${SITE_NAME}.`, dates, link].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  const ended = /[.!?]$/.test(plain) ? plain : `${plain}.`
  return { plain: ended, html: esc(ended) }
}

export function accessedPhrase(style, date = new Date()) {
  const day = date.getDate()
  const year = date.getFullYear()
  if (style === 'mla') return `Accessed ${day} ${MLA_MONTHS[date.getMonth()]} ${year}.`
  return `Accessed ${CHICAGO_MONTHS[date.getMonth()]} ${day}, ${year}.`
}

function dateMetaHtml(published, modified) {
  const bits = []
  if (published && formatChicagoDate(published)) {
    bits.push(`Published <time datetime="${esc(published)}">${esc(formatChicagoDate(published))}</time>`)
  }
  if (modified && formatChicagoDate(modified)) {
    bits.push(`Last revised <time datetime="${esc(modified)}">${esc(formatChicagoDate(modified))}</time>`)
  }
  if (!bits.length) return ''
  return `<p class="cite-dates">${bits.join('. ')}.</p>`
}

export function citeBoxHtml({ title, url, published = '', modified = '', headingLevel = 2 } = {}) {
  const level = headingLevel === 3 ? 3 : 2
  const fields = { title, published, modified, url }
  const chicago = buildCitation('chicago', fields)
  const mla = buildCitation('mla', fields)
  const entry = (style, label, citation) => `<div class="cite-entry">
      <p class="cite-label" id="cite-${style}-label">${label}</p>
      <p class="cite-text" id="cite-${style}-text">${citation.html}</p>
      <p class="cite-accessed" data-cite-accessed="${style}"></p>
      <button type="button" class="btn ghost small cite-copy" data-cite-copy="${style}" aria-label="Copy ${label} citation">Copy</button>
    </div>`
  return `<section class="cite-story" data-cite aria-labelledby="cite-story-heading">
      <h${level} id="cite-story-heading">Cite this story</h${level}>
      ${dateMetaHtml(published, modified)}
      ${entry('chicago', 'Chicago', chicago)}
      ${entry('mla', 'MLA', mla)}
    </section>`
}

export function correctionUrl({ title, url }) {
  const params = new URLSearchParams({
    labels: 'correction',
    title: `Correction: ${title || 'Story'}`,
    body: `Story: ${title || ''}\nURL: ${url || ''}\n\nWhat should be corrected?\n\n`,
  })
  return `https://github.com/${CORRECTION_REPO}/issues/new?${params.toString()}`
}

export function correctionHtml({ title, url }) {
  const href = correctionUrl({ title, url })
  return `<p class="story-correction"><a class="story-correction-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow">Report a correction<span class="visually-hidden"> for ${esc(title || 'this story')} (opens in a new tab)</span></a></p>`
}

const EARTH_MILES = 3958.7613

export function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function formatMiles(miles) {
  if (!Number.isFinite(miles) || miles < 0) return ''
  if (miles < 0.1) return 'less than 0.1 miles'
  return `${(Math.round(miles * 10) / 10).toFixed(1)} miles`
}

function finiteCoord(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function storyOrigin(story) {
  const lat = finiteCoord(story?.lat)
  const lon = finiteCoord(story?.lon)
  if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  if (lat === 0 && lon === 0) return null
  return { lat, lon }
}

function validPin(lat, lon) {
  return lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)
}

function nearestCap(limit) {
  return Math.min(5, Math.max(3, limit))
}

/** 3 to 5 nearest other stories that have coordinates. Empty when this story has no pin. */
export function nearbyStories(story, all, { limit = 5, excludeSlugs = [] } = {}) {
  const origin = storyOrigin(story)
  if (!origin) return []
  const skip = new Set(excludeSlugs || [])
  const rows = []
  for (const other of all || []) {
    if (!other?.slug || other.slug === story.slug || !other.title || skip.has(other.slug)) continue
    const olat = finiteCoord(other.lat)
    const olon = finiteCoord(other.lon)
    if (!validPin(olat, olon)) continue
    rows.push({
      kind: 'story',
      slug: other.slug,
      title: other.title,
      miles: haversineMiles(origin.lat, origin.lon, olat, olon),
    })
  }
  rows.sort((a, b) => a.miles - b.miles || a.title.localeCompare(b.title))
  return rows.slice(0, nearestCap(limit))
}

/** Compact {id, title, lat, lon} rows from marker GeoJSON features. */
export function markerRecords(features) {
  const rows = []
  for (const feature of features || []) {
    const props = feature?.properties || feature || {}
    const coords = feature?.geometry?.coordinates
    const lat = Array.isArray(coords) ? coords[1] : props.lat ?? props.latitude
    const lon = Array.isArray(coords) ? coords[0] : props.lon ?? props.longitude
    const id = props.marker_number ?? props.id
    const title = props.title || props.name
    if (id == null || String(id).trim() === '' || !title) continue
    const yearStart = props.yearStart ?? props.year_start ?? null
    const yearEnd = props.yearEnd ?? props.year_end ?? null
    rows.push({
      id: String(id),
      title: String(title),
      lat,
      lon,
      yearStart,
      yearEnd,
      county: props.county || '',
    })
  }
  return rows
}

export function markerMapHref(id) {
  return `/#map/markers/${encodeURIComponent(String(id))}`
}

/** 3 to 5 nearest historical markers. Empty when this story has no pin. */
export function nearbyMarkers(story, markers, { limit = 5, excludeMarkerIds = [] } = {}) {
  const origin = storyOrigin(story)
  if (!origin) return []
  const skip = new Set((excludeMarkerIds || []).map((id) => String(id)))
  const rows = []
  for (const marker of markers || []) {
    const id = marker?.id ?? marker?.marker_number
    const title = marker?.title || marker?.name
    if (id == null || String(id).trim() === '' || !title || skip.has(String(id))) continue
    const lat = finiteCoord(marker.lat ?? marker.latitude)
    const lon = finiteCoord(marker.lon ?? marker.longitude)
    if (!validPin(lat, lon)) continue
    rows.push({
      kind: 'marker',
      id: String(id),
      title: String(title),
      miles: haversineMiles(origin.lat, origin.lon, lat, lon),
    })
  }
  rows.sort((a, b) => a.miles - b.miles || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
  return rows.slice(0, nearestCap(limit))
}

/**
 * Up to five nearest stories and up to five nearest historical markers,
 * one list, nearest first. Stories stay on /stories/<slug>/.
 */
export function nearbyPlaces(story, all, markers, { limit = 5, excludeSlugs = [], excludeMarkerIds = [] } = {}) {
  const storiesNear = nearbyStories(story, all, { limit, excludeSlugs })
  const markersNear = nearbyMarkers(story, markers, { limit, excludeMarkerIds })
  const rows = [
    ...(storiesNear.length >= 3 ? storiesNear : []),
    ...(markersNear.length >= 3 ? markersNear : []),
  ]
  rows.sort((a, b) => a.miles - b.miles || a.title.localeCompare(b.title) || a.kind.localeCompare(b.kind))
  return rows
}

const COUNTY_DISPLAY = { Larue: 'LaRue' }

export function countyLong(county) {
  const raw = String(county || '').trim()
  if (!raw) return ''
  const name = COUNTY_DISPLAY[raw] || raw
  if (name.includes(',')) return name
  return `${name} County`
}

/** Year span for a card meta line: en dash, no spaces. */
export function compactYearRange(start, end) {
  const fmt = (year) => {
    if (year == null || year === '' || Number.isNaN(Number(year))) return ''
    const n = Number(year)
    if (n < 0) return `${Math.abs(n)} BCE`
    return String(n)
  }
  const hasStart = start != null && start !== ''
  const hasEnd = end != null && end !== ''
  if (!hasStart && !hasEnd) return ''
  if (hasStart && hasEnd && Number(start) !== Number(end)) {
    const cross = Number(start) < 0 && Number(end) > 0 ? ' CE' : ''
    return `${fmt(start)}\u2013${fmt(end)}${cross}`
  }
  return fmt(hasStart ? start : end)
}

export function storyDetail(story) {
  return [countyLong(story?.county), compactYearRange(story?.yearStart, story?.yearEnd)].filter(Boolean).join(' · ')
}

/** 112px opt/ crop used as the 2× source for a 56px card thumbnail. */
export function storyThumbSrc(story) {
  const url = String(story?.photo?.image_url || '')
  if (!url.startsWith('/content/photos/')) return ''
  const base = url.split('/').pop().replace(/\.[^.]+$/, '')
  if (!base || base.includes('..') || base.includes('/')) return ''
  return `/content/photos/opt/stories/${base}-112.webp`
}

const PIN_ICON = `<svg class="related-card-pin-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.25A6.75 6.75 0 0 0 5.25 9c0 5.06 5.7 10.9 6.4 11.55a.5.5 0 0 0 .7 0c.7-.65 6.4-6.49 6.4-11.55A6.75 6.75 0 0 0 12 2.25zm0 9.25a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`

const CHEVRON_ICON = `<svg class="related-card-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M6 3.25 10.75 8 6 12.75" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`

function cardMediaHtml(row) {
  if (row.kind !== 'marker' && row.thumb) {
    const src = esc(row.thumb)
    return `<span class="related-card-media"><img class="related-card-img" src="${src}" srcset="${src} 2x" alt="" width="56" height="56" loading="lazy" decoding="async"></span>`
  }
  return `<span class="related-card-media related-card-pin" aria-hidden="true">${PIN_ICON}</span>`
}

function cardMetaHtml(row) {
  const kind = row.kind === 'marker' ? 'Historical marker' : 'Story'
  const bits = [`<span class="nearby-kind">${esc(kind)}</span>`]
  if (row.detail) bits.push(esc(row.detail))
  const miles = row.related ? '' : formatMiles(row.miles)
  if (miles) bits.push(`<span class="nearby-miles">${esc(miles)}</span>`)
  return bits.join(' · ')
}

function nearbyRowHtml(row) {
  const href = row.kind === 'marker' ? markerMapHref(row.id) : `/stories/${encodeURIComponent(row.slug)}/`
  const liClass = row.related ? 'related-story' : 'nearby-place'
  return `<li class="${liClass}"><a class="related-card" href="${esc(href)}">${cardMediaHtml(row)}<span class="related-card-copy"><span class="related-card-title">${esc(row.title)}</span><span class="related-card-meta">${cardMetaHtml(row)}</span></span>${CHEVRON_ICON}</a></li>`
}

function relatedListHtml(rows, { heading, headingId, headingLevel = 2, navClass = 'story-nearby' } = {}) {
  if (!rows?.length) return ''
  const level = headingLevel === 3 ? 3 : 2
  const items = rows.map((row) => nearbyRowHtml(row)).join('')
  return `<nav class="${navClass}" aria-labelledby="${headingId}"><h${level} id="${headingId}">${heading}</h${level}><ul class="related-list">${items}</ul></nav>`
}

export function nearbyHtml(story, all, { headingLevel = 2, markers = [], excludeSlugs = [], excludeMarkerIds = [], limit = 5 } = {}) {
  const near = nearbyPlaces(story, all, markers, { excludeSlugs, excludeMarkerIds, limit })
  return relatedListHtml(near, { heading: 'Nearby', headingId: 'nearby-stories-heading', headingLevel })
}

/**
 * Era and place labels, plus the corpus-wide native-history label.
 * One shared subject tag outranks any number of these, and they do not
 * outrank county or distance.
 */
const BROAD_RELATED_TAGS = new Set([
  'kentucky',
  'other',
  'prehistoric',
  'native',
  'native-history',
  'frontier',
  'early-commonwealth',
])

function relatedTagSets(story) {
  const specific = new Set()
  const broad = new Set()
  const era = story?.era
  for (const tag of story?.tags || []) {
    if (!tag) continue
    if (tag === era || BROAD_RELATED_TAGS.has(tag)) broad.add(tag)
    else specific.add(tag)
  }
  return { specific, broad }
}

function sharedCount(left, right) {
  let count = 0
  for (const tag of left) if (right.has(tag)) count += 1
  return count
}

function countyKey(story) {
  return String(story?.county || '')
    .trim()
    .toLowerCase()
    .replace(/\s+county$/, '')
}

function sameCounty(story, other) {
  const a = countyKey(story)
  const b = countyKey(other)
  return Boolean(a && b && a === b)
}

function relatedMiles(story, other) {
  const origin = storyOrigin(story)
  const lat = finiteCoord(other?.lat)
  const lon = finiteCoord(other?.lon)
  if (!origin || !validPin(lat, lon)) return Number.POSITIVE_INFINITY
  return haversineMiles(origin.lat, origin.lon, lat, lon)
}

/**
 * Up to five other stories.
 * Shared subject tags (a person, nation, event, or theme) come first.
 * Broad era and place tags do not rank a story.
 * Then the same county, then nearer, then title.
 */
export function pickRelatedStories(story, all, excludeSlugs = []) {
  const skip = new Set(excludeSlugs || [])
  const originTags = relatedTagSets(story)
  const pool = (all || []).filter(
    (other) => other?.slug && other.slug !== story?.slug && other.title && !skip.has(other.slug),
  )
  pool.sort((a, b) => {
    const specificDelta =
      sharedCount(originTags.specific, relatedTagSets(b).specific) -
      sharedCount(originTags.specific, relatedTagSets(a).specific)
    if (specificDelta) return specificDelta
    const countyDelta = Number(sameCounty(story, b)) - Number(sameCounty(story, a))
    if (countyDelta) return countyDelta
    const milesDelta = relatedMiles(story, a) - relatedMiles(story, b)
    if (milesDelta) return milesDelta
    return String(a.title).localeCompare(String(b.title)) || String(a.slug).localeCompare(String(b.slug))
  })
  return pool.slice(0, Math.min(5, pool.length))
}

/** Related stories first, then nearby places that are not already listed. */
export function relatedAndNearbyHtml(related, nearby, { headingLevel = 2 } = {}) {
  const rows = [...(related || []), ...(nearby || [])]
  return relatedListHtml(rows, {
    heading: 'Related and nearby',
    headingId: 'related-nearby-heading',
    headingLevel,
    navClass: 'static-related story-nearby',
  })
}

/** The story-page list: related stories, then nearby stories and markers. */
export function relatedAndNearbyForStory(
  story,
  all,
  markers,
  { headingLevel = 2, excludeSlugs = [], excludeMarkerIds = [], limit = 3, thumbFor = storyThumbSrc } = {},
) {
  const related = pickRelatedStories(story, all, excludeSlugs)
  const bySlug = new Map((all || []).filter((item) => item?.slug).map((item) => [item.slug, item]))
  const relatedRows = related.map((other) => ({
    kind: 'story',
    related: true,
    slug: other.slug,
    title: other.title,
    detail: storyDetail(other),
    thumb: thumbFor(other) || '',
  }))
  const nearby = nearbyPlaces(story, all, markers, {
    limit,
    excludeSlugs: [...excludeSlugs, ...related.map((item) => item.slug)],
    excludeMarkerIds,
  }).map((row) => {
    if (row.kind !== 'story') return { ...row, thumb: '' }
    const other = bySlug.get(row.slug)
    return {
      ...row,
      title: other?.title || row.title,
      detail: other ? storyDetail(other) : '',
      thumb: other ? thumbFor(other) || '' : '',
    }
  })
  return relatedAndNearbyHtml(relatedRows, nearby, { headingLevel })
}

/** Home-map hash for a story that already has a pin. The hash never includes coordinates. */
export function storyPlaceHash({ historyId, slug, lat, lon } = {}) {
  if (historyId) return `#map/history/${encodeURIComponent(historyId)}`
  if (lat != null && lon != null && lat !== '' && lon !== '' && slug) {
    return `#map/stories/${encodeURIComponent(slug)}`
  }
  return null
}

/** Year label for the timeline. BCE/CE, with an en dash when the span is a range. */
export function formatYearRange(start, end) {
  const fmt = (year) => {
    if (year == null || year === '' || Number.isNaN(Number(year))) return ''
    const n = Number(year)
    if (n < 0) return `${Math.abs(n)} BCE`
    return String(n)
  }
  const hasStart = start != null && start !== '' && !Number.isNaN(Number(start))
  const hasEnd = end != null && end !== '' && !Number.isNaN(Number(end))
  if (!hasStart && !hasEnd) return ''
  if (hasStart && hasEnd && Number(start) !== Number(end)) {
    const cross = Number(start) < 0 && Number(end) > 0 ? ' CE' : ''
    return `${fmt(start)} – ${fmt(end)}${cross}`
  }
  return fmt(hasStart ? start : end)
}

function anchorYear(record) {
  const year = record?.yearStart ?? record?.yearEnd
  if (year == null || year === '' || Number.isNaN(Number(year))) return null
  return Number(year)
}

function endYear(record, fallback) {
  const year = record?.yearEnd ?? record?.yearStart ?? fallback
  if (year == null || year === '' || Number.isNaN(Number(year))) return fallback
  return Number(year)
}

function titleWords(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function normPlace(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function placeStem(value) {
  const norm = normPlace(value)
  if (!norm) return ''
  return norm.split(/\s*\/\s*/)[0].trim()
}

function timelineScore(story, other) {
  const specific = sharedCount(relatedTagSets(story).specific, relatedTagSets(other).specific)
  let score = specific * 3
  if (sameCounty(story, other)) score += 2
  if (story?.era && story.era === other?.era) score += 1
  if (relatedMiles(story, other) <= 40) score += 1
  return score
}

function isNearDuplicate(candidate, picked) {
  const place = normPlace(candidate.matchedPlace)
  const stem = placeStem(candidate.matchedPlace)
  const words = titleWords(candidate.title)
  const two = words.length >= 2 ? words.slice(0, 2).join(' ') : ''
  for (const item of picked) {
    const otherPlace = normPlace(item.matchedPlace)
    if (place && otherPlace && place === otherPlace) return true
    const otherStem = placeStem(item.matchedPlace)
    if (stem && otherStem && stem.length >= 4 && stem === otherStem && candidate.cy === item.cy) return true
    const otherWords = titleWords(item.title)
    const otherTwo = otherWords.length >= 2 ? otherWords.slice(0, 2).join(' ') : ''
    if (two && otherTwo && two === otherTwo && candidate.cy === item.cy) return true
  }
  return false
}

function takeRanked(ranked, already, limit) {
  const chosen = []
  const picked = [...already]
  if (limit <= 0) return chosen
  for (const item of ranked) {
    if (chosen.length >= limit) break
    if (item.slug && picked.some((row) => row.slug === item.slug)) continue
    if (item.id && picked.some((row) => row.kind === 'marker' && row.id === item.id)) continue
    if (isNearDuplicate(item, picked)) continue
    chosen.push(item)
    picked.push(item)
  }
  return chosen
}

function chrono(a, b) {
  if (a.cy !== b.cy) return a.cy - b.cy
  const endA = endYear(a, a.cy)
  const endB = endYear(b, b.cy)
  if (endA !== endB) return endA - endB
  return String(a.title).localeCompare(String(b.title)) || String(a.slug || a.id || '').localeCompare(String(b.slug || b.id || ''))
}

/**
 * Up to four stories before and four after this story's year.
 * Same place and near-duplicate titles are dropped. Markers fill a side
 * only when that side still has fewer than three stories.
 */
export function pickTimelineEvents(story, allStories, markers, { perSide = 4, max = 9, excludeMarkerIds = [] } = {}) {
  const empty = { before: [], current: null, after: [] }
  const y = anchorYear(story)
  if (y == null || !story?.slug || !story?.title) return empty
  const sideLimit = Math.max(0, Number(perSide) || 0)
  const neighborCap = Math.max(sideLimit, Math.max(0, (Number(max) || 9) - 1))
  const current = {
    kind: 'story',
    slug: story.slug,
    title: story.title,
    yearStart: story.yearStart ?? null,
    yearEnd: story.yearEnd ?? null,
    cy: y,
    matchedPlace: story.matchedPlace || '',
  }
  const beforeRanked = []
  const afterRanked = []
  for (const other of allStories || []) {
    if (!other?.slug || other.slug === story.slug || !other.title) continue
    const cy = anchorYear(other)
    if (cy == null) continue
    const score = timelineScore(story, other)
    if (score <= 0) continue
    const row = {
      kind: 'story',
      slug: other.slug,
      title: other.title,
      yearStart: other.yearStart ?? null,
      yearEnd: other.yearEnd ?? null,
      cy,
      matchedPlace: other.matchedPlace || '',
      score,
    }
    let side = cy < y ? 'before' : cy > y ? 'after' : ''
    if (!side) {
      const cEnd = endYear(other, cy)
      const sEnd = endYear(story, y)
      if (cEnd !== sEnd) side = cEnd < sEnd ? 'before' : 'after'
      else side = String(other.title).localeCompare(String(story.title)) < 0 ? 'before' : 'after'
    }
    if (side === 'before') beforeRanked.push(row)
    else afterRanked.push(row)
  }
  const byRank = (a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const delta = Math.abs(a.cy - y) - Math.abs(b.cy - y)
    if (delta) return delta
    return String(a.title).localeCompare(String(b.title)) || String(a.slug).localeCompare(String(b.slug))
  }
  beforeRanked.sort(byRank)
  afterRanked.sort(byRank)
  let before = takeRanked(beforeRanked, [current], Math.min(sideLimit, neighborCap))
  let after = takeRanked(afterRanked, [current, ...before], Math.min(sideLimit, neighborCap))
  if (before.length < 3 && before.length + after.length < neighborCap) {
    after = after.concat(takeRanked(afterRanked, [current, ...before, ...after], neighborCap - before.length - after.length))
  } else if (after.length < 3 && before.length + after.length < neighborCap) {
    before = before.concat(takeRanked(beforeRanked, [current, ...before, ...after], neighborCap - before.length - after.length))
  }
  const skipMarkers = new Set((excludeMarkerIds || []).map((id) => String(id)))
  const markerPool = { before: [], after: [], same: [] }
  const storyCounty = countyKey(story)
  if (storyCounty) {
    for (const marker of markers || []) {
      const id = marker?.id ?? marker?.marker_number
      const title = marker?.title || marker?.name
      if (id == null || String(id).trim() === '' || !title || skipMarkers.has(String(id))) continue
      if (countyKey(marker) !== storyCounty) continue
      const cy = anchorYear(marker)
      if (cy == null || Math.abs(cy - y) > 25) continue
      const row = {
        kind: 'marker',
        id: String(id),
        title: String(title),
        yearStart: marker.yearStart ?? cy,
        yearEnd: marker.yearEnd ?? null,
        cy,
        matchedPlace: '',
      }
      const bucket = cy < y ? 'before' : cy > y ? 'after' : 'same'
      markerPool[bucket].push(row)
    }
    const byTime = (a, b) => Math.abs(a.cy - y) - Math.abs(b.cy - y) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
    markerPool.before.sort(byTime)
    markerPool.after.sort(byTime)
    markerPool.same.sort(byTime)
    if (before.length < 3) before = before.concat(takeRanked(markerPool.before, [current, ...before, ...after], 3 - before.length))
    if (after.length < 3) after = after.concat(takeRanked(markerPool.after, [current, ...before, ...after], 3 - after.length))
    const same = markerPool.same
    if (same.length && (before.length < 3 || after.length < 3)) {
      const preferBefore = before.length <= after.length
      if (preferBefore && before.length < 3) before = before.concat(takeRanked(same, [current, ...before, ...after], 3 - before.length))
      if (after.length < 3) after = after.concat(takeRanked(same, [current, ...before, ...after], 3 - after.length))
      if (before.length < 3) before = before.concat(takeRanked(same, [current, ...before, ...after], 3 - before.length))
    }
  }
  before.sort(chrono)
  after.sort(chrono)
  return { before, current, after }
}

const TIMELINE_PIN = `<svg class="st-pin-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.2A6.8 6.8 0 0 0 5.2 9c0 5.1 5.7 11 6.4 11.6a.6.6 0 0 0 .8 0c.7-.6 6.4-6.5 6.4-11.6A6.8 6.8 0 0 0 12 2.2zm0 9.2a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8z"/></svg>`

function safeDomId(value, fallback) {
  const id = String(value || '').replace(/[^\w-]/g, '')
  return id || fallback
}

function datetimeYear(start, end) {
  const year = start != null && start !== '' ? start : end
  if (year == null || year === '' || Number.isNaN(Number(year))) return ''
  return String(Number(year))
}

function timelineStoryBySlug(allStories) {
  const bySlug = new Map()
  for (const item of allStories || []) {
    if (item?.slug) bySlug.set(item.slug, item)
  }
  return bySlug
}

function timelineRowHtml(event, bySlug) {
  const years = formatYearRange(event.yearStart, event.yearEnd)
  const datetime = datetimeYear(event.yearStart, event.yearEnd)
  const time = `<span class="st-date"><time datetime="${esc(datetime)}">${esc(years)}</time></span>`
  if (event.kind === 'current') {
    return `<li class="st-item st-current" aria-current="page"><div class="st-row"><div class="st-current-body">${time}<span class="st-title">${esc(event.title)}</span><span class="st-here">This story</span></div></div></li>`
  }
  if (event.kind === 'marker') {
    return `<li class="st-item"><div class="st-row"><a class="st-link" href="${esc(markerMapHref(event.id))}">${time}<span class="st-kicker">Marker</span><span class="st-title">${esc(event.title)}</span></a></div></li>`
  }
  const source = bySlug.get(event.slug)
  const hash = storyPlaceHash({
    historyId: source?.historyId,
    slug: event.slug,
    lat: source?.lat,
    lon: source?.lon,
  })
  const pin = hash
    ? `<a class="st-pin" rel="nofollow" href="/${esc(hash)}" aria-label="${esc(`Show ${event.title} on the map`)}">${TIMELINE_PIN}</a>`
    : ''
  return `<li class="st-item"><div class="st-row"><a class="st-link" href="/stories/${encodeURIComponent(event.slug)}/">${time}<span class="st-title">${esc(event.title)}</span></a>${pin}</div></li>`
}

/** The panel markup. Empty when this story has no year or no neighbours. */
export function storyTimelineHtml(story, allStories, markers, options = {}) {
  return storyTimelineForStory(story, allStories, markers, options).html
}

/** Panel HTML plus the slugs and marker ids already shown, so related lists can skip them. */
export function storyTimelineForStory(story, allStories, markers, options = {}) {
  const picked = pickTimelineEvents(story, allStories, markers, options)
  const events = [...picked.before, ...picked.after]
  const slugs = events.filter((event) => event.slug).map((event) => event.slug)
  const markerIds = events.filter((event) => event.kind === 'marker' && event.id).map((event) => String(event.id))
  if (!picked.current || !events.length) return { html: '', slugs, markerIds, picked }
  const level = options.headingLevel === 3 ? 3 : 2
  const headingId = safeDomId(options.headingId, 'storyTimelineH')
  const listId = safeDomId(options.listId, 'storyTimelineList')
  const count = events.length + 1
  const countLabel = `${count} event${count === 1 ? '' : 's'}`
  const bySlug = timelineStoryBySlug(allStories)
  const rows = [
    ...picked.before.map((event) => timelineRowHtml(event, bySlug)),
    timelineRowHtml({ ...picked.current, kind: 'current' }, bySlug),
    ...picked.after.map((event) => timelineRowHtml(event, bySlug)),
  ].join('')
  const html = `<nav class="story-timeline" aria-labelledby="${headingId}"><h${level} id="${headingId}" class="story-timeline-heading"><button type="button" class="story-timeline-toggle" aria-expanded="true" aria-controls="${listId}"><span class="st-label">Timeline: what happened before and after</span><span class="st-count">${esc(countLabel)}</span><span class="st-chevron" aria-hidden="true">▾</span></button></h${level}><ol class="st-list" id="${listId}">${rows}</ol></nav>`
  return { html, slugs, markerIds, picked }
}

function setTimelineOpen(nav, open) {
  const button = nav.querySelector('.story-timeline-toggle')
  const list = nav.querySelector('.st-list')
  if (!button || !list) return
  button.setAttribute('aria-expanded', open ? 'true' : 'false')
  if (open) list.removeAttribute('hidden')
  else list.setAttribute('hidden', '')
}

function placeStoryTimeline(nav) {
  const layout = nav.closest?.('.story-reader-layout')
  if (!layout) return
  const wide = window.matchMedia('(min-width: 901px)').matches
  const slot = layout.querySelector(`[data-timeline-slot="${wide ? 'side' : 'inline'}"]`)
  if (slot && nav.parentElement !== slot) slot.appendChild(nav)
}

let timelineResizeBound = false

/** The list ships open. This collapses it at ≤600px and, in the hash reader, parks it in the sidebar at ≥901px. */
export function wireStoryTimelines(root = typeof document !== 'undefined' ? document : null) {
  if (!root?.querySelectorAll || typeof window === 'undefined') return
  root.querySelectorAll('.story-timeline').forEach((nav) => {
    placeStoryTimeline(nav)
    if (nav.dataset.timelineReady === '1') return
    nav.dataset.timelineReady = '1'
    setTimelineOpen(nav, window.matchMedia('(min-width: 601px)').matches)
    const button = nav.querySelector('.story-timeline-toggle')
    button?.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true'
      setTimelineOpen(nav, !open)
    })
  })
  if (timelineResizeBound) return
  timelineResizeBound = true
  let layoutWide = window.matchMedia('(min-width: 901px)').matches
  let openWide = window.matchMedia('(min-width: 601px)').matches
  window.addEventListener('resize', () => {
    const nextLayout = window.matchMedia('(min-width: 901px)').matches
    const nextOpen = window.matchMedia('(min-width: 601px)').matches
    document.querySelectorAll('.story-timeline').forEach((nav) => {
      if (nextLayout !== layoutWide) placeStoryTimeline(nav)
      if (nextOpen !== openWide) setTimelineOpen(nav, nextOpen)
    })
    layoutWide = nextLayout
    openWide = nextOpen
  })
}

/** Static pages have no app bundle. The list ships open; this collapses it at ≤600px and toggles it. */
export function timelineBootScript() {
  return `<script>
    (function () {
      var OPEN_AT = 601;
      function setOpen(nav, open) {
        var button = nav.querySelector('.story-timeline-toggle');
        var list = nav.querySelector('.st-list');
        if (!button || !list) return;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) list.removeAttribute('hidden');
        else list.setAttribute('hidden', '');
      }
      function wire(nav) {
        if (nav.getAttribute('data-timeline-ready') === '1') return;
        nav.setAttribute('data-timeline-ready', '1');
        setOpen(nav, window.matchMedia('(min-width: ' + OPEN_AT + 'px)').matches);
        var button = nav.querySelector('.story-timeline-toggle');
        if (!button) return;
        button.addEventListener('click', function () {
          setOpen(nav, button.getAttribute('aria-expanded') !== 'true');
        });
      }
      document.querySelectorAll('.story-timeline').forEach(wire);
      var openWide = window.matchMedia('(min-width: ' + OPEN_AT + 'px)').matches;
      window.addEventListener('resize', function () {
        var next = window.matchMedia('(min-width: ' + OPEN_AT + 'px)').matches;
        if (next === openWide) return;
        openWide = next;
        document.querySelectorAll('.story-timeline').forEach(function (nav) { setOpen(nav, next); });
      });
    })();
  </script>`
}

const SOURCE_BY_DOMAIN = [
  ['wikipedia.org', 'Wikipedia'],
  ['explorekyhistory.ky.gov', 'ExploreKYHistory'],
  ['history.ky.gov', 'Kentucky Historical Society'],
  ['archaeology.ky.gov', 'Kentucky Archaeology'],
  ['parks.ky.gov', 'Kentucky State Parks'],
  ['nps.gov', 'NPS.gov'],
  ['grokipedia.com', 'Grokipedia'],
]

const GENERIC_LINK_LABELS = new Set([
  'wikipedia',
  'source',
  'website',
  'national park service',
  'nps.gov',
  'kentucky historical society',
  'explorekyhistory',
  'kentucky archaeology',
  'kentucky state parks',
  'grokipedia',
])

export function sourceNameForUrl(url) {
  let host = ''
  try {
    host = new URL(String(url || '')).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
  for (const [domain, name] of SOURCE_BY_DOMAIN) {
    if (host === domain || host.endsWith(`.${domain}`)) return name
  }
  return host
}

/** Wikipedia article title from the /wiki/ slug. Underscores become spaces. */
export function wikipediaTitleFromUrl(url) {
  let parsed
  try {
    parsed = new URL(String(url || ''))
  } catch {
    return ''
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (host !== 'wikipedia.org' && !host.endsWith('.wikipedia.org')) return ''
  const parts = parsed.pathname.split('/').filter(Boolean)
  const wiki = parts.indexOf('wiki')
  const slug = wiki >= 0 ? parts[wiki + 1] : ''
  if (!slug || slug === 'Special:Search') return ''
  let title = slug
  try {
    title = decodeURIComponent(slug)
  } catch {
    /* keep the raw slug */
  }
  return title.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

function humanPathTitle(url) {
  let parsed
  try {
    parsed = new URL(String(url || ''))
  } catch {
    return ''
  }
  const parts = parsed.pathname.split('/').filter(Boolean)
  if (!parts.length) return ''
  let seg = parts[parts.length - 1]
  if (/^(index|default|assetdetail)$/i.test(seg) && parts.length > 1) seg = parts[parts.length - 2]
  try {
    seg = decodeURIComponent(seg)
  } catch {
    /* keep */
  }
  seg = seg.replace(/\.(html?|aspx|php|pdf)$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!seg || /^\d+$/.test(seg)) return ''
  return seg
}

/** '{page title} on {Source}', e.g. Great Saltpetre Cave on Wikipedia. */
export function learnMoreLinkText(url, linkText = '', storyTitle = '') {
  const source = sourceNameForUrl(url) || 'Source'
  const wiki = wikipediaTitleFromUrl(url)
  const raw = String(linkText || '').trim()
  const usableLabel = raw && !/^https?:\/\//i.test(raw) && !GENERIC_LINK_LABELS.has(raw.toLowerCase())
  const page = wiki || (usableLabel ? raw : '') || humanPathTitle(url) || String(storyTitle || '').trim()
  if (!page || page.toLowerCase() === source.toLowerCase()) return page || source
  return `${page} on ${source}`
}

function markdownLinks(text) {
  const links = []
  const s = String(text || '')
  const startRe = /\[([^\]]*)\]\(/g
  let match
  while ((match = startRe.exec(s))) {
    const start = match.index + match[0].length
    let i = start
    let depth = 1
    while (i < s.length && depth > 0) {
      if (s[i] === '(') depth += 1
      else if (s[i] === ')') depth -= 1
      if (depth > 0) i += 1
    }
    const url = s.slice(start, i).trim()
    if (/^https?:\/\//i.test(url)) links.push({ label: match[1] || '', url })
  }
  return links
}

function bareHttpUrls(text) {
  return [...String(text || '').matchAll(/https?:\/\/[^\s<>\]]+/gi)].map((match) =>
    match[0].replace(/[.,;:]+$/g, ''),
  )
}

export function learnMoreItemsFromMarkdown(markdown) {
  const lines = String(markdown || '').match(/^[ \t]*source:[ \t]*.+$/gim) || []
  const items = []
  const seen = new Set()
  for (const line of lines) {
    const text = line.replace(/^[ \t]*source:[ \t]*/i, '').trim()
    const linked = markdownLinks(text)
    const found = linked.length ? linked : bareHttpUrls(text).map((url) => ({ label: '', url }))
    for (const link of found) {
      const url = String(link.url || '').trim()
      if (!/^https?:\/\//i.test(url) || seen.has(url)) continue
      seen.add(url)
      items.push({ url, linkText: link.label || '', label: link.label || '' })
    }
  }
  return items
}

const EXTERNAL_ICON = `<svg class="external-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6.2 3.5H3.5v9h9V9.8M8.2 3.5h4.3v4.3M12.3 3.7 7.2 8.8"/></svg>`

export function learnMoreAnchorHtml(url, linkText = '', storyTitle = '') {
  const text = learnMoreLinkText(url, linkText, storyTitle)
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}${EXTERNAL_ICON}<span class="visually-hidden"> (opens in a new tab)</span></a>`
}

export function learnMoreBlockHtml(items, { storyTitle = '' } = {}) {
  const rows = items || []
  if (!rows.length) return ''
  const lis = rows
    .map((item) => `<li>${learnMoreAnchorHtml(item.url, item.linkText || item.label || '', storyTitle)}</li>`)
    .join('')
  return `<div class="popup-research learn-more"><div class="historic-photos-label">Learn more</div><ul class="research-list learn-more-list">${lis}</ul></div>`
}

const LICENSE_RE = /public domain|\bcc0\b|\bcc[-\s]?by\b|\bgfdl\b|copyright|all rights reserved/i

function isLicenseText(value) {
  return LICENSE_RE.test(String(value || ''))
}

/** Photographer or source, license, and link, taken only from fields already on the photo. */
export function photoCreditModel(photo) {
  if (!photo?.image_url && !photo?.source_url && !photo?.attribution && !photo?.credit) return null
  const sourceUrl = String(photo.source_url || '').trim()
  const licenseUrl = /^https?:\/\//i.test(photo.license_url || '') ? String(photo.license_url).trim() : ''
  const sourceLabel = String(photo.source_label || photo.source || '').trim()
  const parts = String(photo.attribution || '')
    .split(/\s+·\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const isSource = (part) => {
    if (!part || !sourceLabel) return false
    const text = part.toLowerCase()
    const label = sourceLabel.toLowerCase()
    return text === label || text.includes(label)
  }
  let photographer = String(photo.photographer || photo.credit || '').trim()
  if (photographer && sourceLabel && photographer.toLowerCase() === sourceLabel.toLowerCase()) photographer = ''
  let license = String(photo.license || '').trim()
  if (!license) license = parts.find((part) => isLicenseText(part)) || ''
  if (!photographer) {
    photographer = parts.find((part) => part !== license && !isLicenseText(part) && !isSource(part)) || ''
  }
  const extras = parts.filter(
    (part) => part !== photographer && part !== license && !isSource(part) && !isLicenseText(part),
  )
  const collection = String(photo.collection || '').trim()
  if (collection && collection !== photographer && !isSource(collection) && !extras.includes(collection)) {
    extras.unshift(collection)
  }
  const source = sourceLabel || parts.find((part) => isSource(part)) || ''
  if (!photographer && !source && !license && !extras.length) return null
  return { photographer, extras, source, sourceUrl, license, licenseUrl }
}

function externalLink(href, label) {
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span class="visually-hidden"> (opens in a new tab)</span></a>`
}

export function photoCreditHtml(photo, { block = true } = {}) {
  const model = photoCreditModel(photo)
  if (!model) return ''
  const chunks = []
  if (model.photographer) chunks.push(esc(model.photographer))
  for (const extra of model.extras) chunks.push(esc(extra))
  if (model.source) {
    chunks.push(model.sourceUrl ? externalLink(model.sourceUrl, model.source) : esc(model.source))
  } else if (model.sourceUrl) {
    chunks.push(externalLink(model.sourceUrl, 'Source'))
  }
  if (!chunks.length && !model.license) return ''
  let inner = chunks.length ? `Photo: ${chunks.join('. ')}` : 'Photo'
  if (model.license) {
    const license = model.licenseUrl ? externalLink(model.licenseUrl, model.license) : esc(model.license)
    inner += `. License: ${license}`
  }
  inner += '.'
  if (block) return `<p class="story-sidebar-photo-attr story-photo-credit">${inner}</p>`
  return `<span class="historic-photo-attr story-photo-credit">${inner}</span>`
}

export function wireCiteBoxes(root = typeof document !== 'undefined' ? document : null) {
  if (!root?.querySelectorAll) return
  const now = new Date()
  root.querySelectorAll('[data-cite]').forEach((box) => {
    box.querySelectorAll('[data-cite-accessed]').forEach((el) => {
      const style = el.getAttribute('data-cite-accessed') === 'mla' ? 'mla' : 'chicago'
      el.textContent = accessedPhrase(style, now)
    })
    box.querySelectorAll('[data-cite-copy]').forEach((button) => {
      if (button.dataset.citeWired === '1') return
      button.dataset.citeWired = '1'
      button.addEventListener('click', () => {
        const entry = button.closest('.cite-entry')
        const text = entry?.querySelector('.cite-text')?.textContent?.trim() || ''
        const accessed = entry?.querySelector('.cite-accessed')?.textContent?.trim() || ''
        const full = [text, accessed].filter(Boolean).join(' ')
        const done = () => {
          button.textContent = 'Copied'
          window.setTimeout(() => {
            button.textContent = 'Copy'
          }, 2000)
        }
        const fallback = () => {
          const area = document.createElement('textarea')
          area.value = full
          area.setAttribute('readonly', '')
          area.style.position = 'fixed'
          area.style.top = '0'
          area.style.left = '-9999px'
          document.body.appendChild(area)
          area.select()
          try {
            document.execCommand('copy')
          } catch {
            /* the citation is still selectable on the page */
          }
          area.remove()
        }
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(full).then(done).catch(() => {
            fallback()
            done()
          })
        } else {
          fallback()
          done()
        }
      })
    })
  })
}

/** Runs as soon as the story markup above it has been parsed. Fills only the access date. */
export function citeBootScript() {
  const chicago = JSON.stringify(CHICAGO_MONTHS)
  const mla = JSON.stringify(MLA_MONTHS)
  return `<script>
    (function () {
      var CHICAGO = ${chicago};
      var MLA = ${mla};
      function phrase(style, date) {
        if (style === 'mla') return 'Accessed ' + date.getDate() + ' ' + MLA[date.getMonth()] + ' ' + date.getFullYear() + '.';
        return 'Accessed ' + CHICAGO[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() + '.';
      }
      function fallback(full) {
        var area = document.createElement('textarea');
        area.value = full;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '0';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        try { document.execCommand('copy'); } catch (e) {}
        area.remove();
      }
      function fill(root) {
        var now = new Date();
        root.querySelectorAll('[data-cite]').forEach(function (box) {
          box.querySelectorAll('[data-cite-accessed]').forEach(function (el) {
            var style = el.getAttribute('data-cite-accessed') === 'mla' ? 'mla' : 'chicago';
            el.textContent = phrase(style, now);
          });
          box.querySelectorAll('[data-cite-copy]').forEach(function (button) {
            if (button.getAttribute('data-cite-wired') === '1') return;
            button.setAttribute('data-cite-wired', '1');
            button.addEventListener('click', function () {
              var entry = button.closest('.cite-entry');
              var text = entry && entry.querySelector('.cite-text') ? entry.querySelector('.cite-text').textContent.trim() : '';
              var accessed = entry && entry.querySelector('.cite-accessed') ? entry.querySelector('.cite-accessed').textContent.trim() : '';
              var full = [text, accessed].filter(Boolean).join(' ');
              var done = function () {
                button.textContent = 'Copied';
                window.setTimeout(function () { button.textContent = 'Copy'; }, 2000);
              };
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(full).then(done).catch(function () { fallback(full); done(); });
              } else {
                fallback(full);
                done();
              }
            });
          });
        });
      }
      fill(document);
    })();
  </script>`
}
