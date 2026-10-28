/**
 * Story-page tools shared by prerendered /stories/ pages and the hash reader.
 * Dates passed in here are already resolved. This module never invents one.
 */
import { ccByLicense, artworkLead, ARTWORK_LEADS, looksLikeUnlabeledArtwork, REVIEWED_ARTWORK_SLUGS } from './photo-credit.js'
import { isProtectedStoryRule } from './protected-story-rule.js'
export { artworkLead, ARTWORK_LEADS, looksLikeUnlabeledArtwork, REVIEWED_ARTWORK_SLUGS }

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

// Same rule as the build (scripts/lib/unified-story-data.mjs). protected-pins.js feeds the id lists
// from public/data/web/protected-pins.json; until then only the flags and heuristics apply.
let protectedStoryIds = { protectedIds: new Set(), skipIds: new Set() }
export function setProtectedStoryIds(ids, skipIds) {
  protectedStoryIds = { protectedIds: new Set(ids || []), skipIds: new Set(skipIds || []) }
}

export function isProtectedStoryCoords(story) {
  return isProtectedStoryRule(story, protectedStoryIds)
}

function storyOrigin(story) {
  const rawLat = finiteCoord(story?.lat)
  const rawLon = finiteCoord(story?.lon)
  if (rawLat == null || rawLon == null || Math.abs(rawLat) > 90 || Math.abs(rawLon) > 180) return null
  if (rawLat === 0 && rawLon === 0) return null
  const factor = isProtectedStoryCoords(story) ? 10 : 10000
  const lat = Math.round(rawLat * factor) / factor
  const lon = Math.round(rawLon * factor) / factor
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
  for (const other of collapseSamePlace(story, all, skip)) {
    const otherOrigin = storyOrigin(other)
    if (!otherOrigin) continue
    rows.push({
      kind: 'story',
      slug: other.slug,
      title: other.title,
      miles: haversineMiles(origin.lat, origin.lon, otherOrigin.lat, otherOrigin.lon),
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
    rows.push({
      id: String(id),
      title: String(title),
      lat,
      lon,
      county: props.county ? String(props.county) : '',
      location_text: props.location_text ? String(props.location_text) : '',
      inscription: props.inscription ? String(props.inscription) : '',
      source_url: props.source_url ? String(props.source_url) : '',
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
export function nearbyPlaces(story, all, markers, { limit = 5, excludeSlugs = [], excludeMarkerIds = [], isProtected = isProtectedStoryCoords } = {}) {
  // #346 (Critiquito): a protected site is never a nearby card; "3.2 miles" from a public story places it.
  const pool = (all || []).filter((other) => other === story || !(other?.coordinatesProtected || (typeof isProtected === 'function' && isProtected(other))))
  const storiesNear = nearbyStories(story, pool, { limit, excludeSlugs })
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
  // A curated stand-in (a street or courthouse standing in for the site) stays
  // on the story page. The card uses the pin tile instead.
  if (story?.photo?.cardThumb === false) return ''
  const url = String(story?.photo?.image_url || '')
  if (!url.startsWith('/content/photos/')) return ''
  const base = url.split('/').pop().replace(/\.[^.]+$/, '')
  if (!base || base.includes('..') || base.includes('/')) return ''
  return `/content/photos/opt/stories/${base}-112.webp`
}

const PIN_ICON = `<svg class="related-card-pin-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.25A6.75 6.75 0 0 0 5.25 9c0 5.06 5.7 10.9 6.4 11.55a.5.5 0 0 0 .7 0c.7-.65 6.4-6.49 6.4-11.55A6.75 6.75 0 0 0 12 2.25zm0 9.25a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`

const CHEVRON_ICON = `<svg class="related-card-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M6 3.25 10.75 8 6 12.75" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`

/** Alt for a person's portrait on a related card: 'AI illustration of <name>' for AI portraits, else the name. */
export function relatedCardPortraitAlt(person) {
  const name = String(person?.name || '').trim()
  if (!name) return ''
  return person.ai ? `AI illustration of ${name}` : name
}

function cardMediaHtml(row) {
  if (row.kind !== 'marker' && row.thumb) {
    const src = esc(row.thumb)
    // Decorative: the card title sits in the same link, so a title-based alt only repeats it
    // (and on protected pages it repeated nearby place names). An explicit row.alt still wins.
    // Person portraits set thumbAlt ("AI illustration of <name>", or the name) — #334.
    const alt = esc(row.alt || row.thumbAlt || '')
    return `<span class="related-card-media"><img class="related-card-img" src="${src}" srcset="${src} 2x" alt="${alt}" width="56" height="56" loading="lazy" decoding="async"></span>`
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
  const mapAttr = row.kind === 'marker' ? ' data-story-map' : ''
  const whyHtml = row.why ? `<span class="usp-rel-why">${esc(row.why)}</span>` : ''
  return `<li class="${liClass}"><a class="related-card"${mapAttr} href="${esc(href)}">${cardMediaHtml(row)}<span class="related-card-copy"><span class="related-card-title">${esc(row.title)}</span><span class="related-card-meta">${cardMetaHtml(row)}</span>${whyHtml}</span>${CHEVRON_ICON}</a></li>`
}

function relatedListHtml(rows, { heading, headingId, headingLevel = 2, navClass = 'story-nearby', collapsible = false } = {}) {
  if (!rows?.length) return ''
  const level = headingLevel === 3 ? 3 : 2
  if (collapsible && rows.length > 3) {
    const primary = rows.slice(0, 3).map((row) => nearbyRowHtml(row)).join('')
    const extraRows = rows.slice(3)
    const extra = extraRows.map((row) => nearbyRowHtml(row)).join('')
    return `<nav class="${navClass}" aria-labelledby="${headingId}"><h${level} id="${headingId}">${heading}</h${level}><ul class="related-list usp-related-grid">${primary}</ul><button type="button" class="usp-more-btn" data-more-btn aria-expanded="false">More related stories (${extraRows.length})</button><ul class="related-list usp-related-grid usp-related-more" data-more-grid hidden>${extra}</ul></nav>`
  }
  const items = rows.map((row) => nearbyRowHtml(row)).join('')
  return `<nav class="${navClass}" aria-labelledby="${headingId}"><h${level} id="${headingId}">${heading}</h${level}><ul class="related-list">${items}</ul></nav>`
}

export function nearbyHtml(story, all, { headingLevel = 2, markers = [], excludeSlugs = [], excludeMarkerIds = [], limit = 5 } = {}) {
  const near = nearbyPlaces(story, all, markers, { excludeSlugs, excludeMarkerIds, limit })
  return relatedListHtml(near, { heading: 'Nearby', headingId: 'nearby-stories-heading', headingLevel })
}

/**
 * Era and place labels, plus the corpus-wide native-history label.
 * These never rank a story. A single specific tag does not either:
 * civil-war, salt, or frontier-war is too broad to beat the same county
 * or a nearby story. Two shared specific tags still come first, so a
 * later Camp Nelson / USCT story that shares usct and civil-war can
 * outrank a town sketch next door.
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

function trinomialMatches(value) {
  return [...String(value || '').matchAll(/\b15[a-z]{2}\d{1,4}\b/gi)].map((match) => match[0].toLowerCase())
}
const TITLE_RANKS = new Set(['capt', 'col', 'gen', 'maj', 'dr', 'rev', 'sgt', 'lt', 'cpt'])
const COORD_MATCH_DEGREES = 0.01

function proseLength(story) {
  const body = story?.bodyMarkdown
  if (typeof body === 'string' && body.length) return body.length
  const recorded = Number(story?.proseChars)
  if (Number.isFinite(recorded) && recorded > 0) return recorded
  return String(story?.summary || '').length
}

/** Longer article text is the richer entry. Summary length breaks a tie. */
function storyRichness(story) {
  return proseLength(story) * 1000 + String(story?.summary || '').length
}

const _trinomialCache = new Map()
function trinomialsOf(story) {
  const blob = [story?.slug, story?.title, story?.matchedPlace].filter(Boolean).join(' ')
  if (_trinomialCache.has(blob)) return _trinomialCache.get(blob)
  const set = new Set(trinomialMatches(blob))
  _trinomialCache.set(blob, set)
  return set
}

function sharedTrinomial(a, b) {
  const left = trinomialsOf(a)
  if (!left.size) return false
  for (const id of trinomialsOf(b)) if (left.has(id)) return true
  return false
}

const _titleLabelsCache = new Map()
function titleLabels(title) {
  const key = String(title || '')
  if (_titleLabelsCache.has(key)) return _titleLabelsCache.get(key)
  let text = key
    .toLowerCase()
    .replace(/[’']/g, '')
  text = text.replace(/\b15[a-z]{2}\d{1,4}\b/gi, ' ')
  text = text.replace(/\([^)]*\)/g, ' ')
  const out = text
    .split(/\s*(?::|\/|—|–)\s*/)
    .map((part) => {
      const words = part
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
      if (words.length && TITLE_RANKS.has(words[0])) words.shift()
      return words.join(' ')
    })
    .filter(Boolean)
  _titleLabelsCache.set(key, out)
  return out
}

const _leadingStemsCache = new Map()
function leadingStems(title) {
  const key = String(title || '')
  if (_leadingStemsCache.has(key)) return _leadingStemsCache.get(key)
  const stems = []
  for (const label of titleLabels(title)) {
    const words = label.split(' ').filter(Boolean)
    if (!words.length) continue
    stems.push(words[0])
    if (words.length >= 2) stems.push(`${words[0]} ${words[1]}`)
  }
  _leadingStemsCache.set(key, stems)
  return stems
}

/** Leading place name: two words, or one word of at least six letters. */
function sharedTitleStem(aTitle, bTitle) {
  const pairs = [
    [leadingStems(aTitle), titleLabels(bTitle)],
    [leadingStems(bTitle), titleLabels(aTitle)],
  ]
  for (const [stems, labels] of pairs) {
    for (const stem of stems) {
      for (const label of labels) {
        if (label !== stem && !label.startsWith(`${stem} `)) continue
        if (stem.split(' ').length >= 2 || stem.length >= 6) return true
      }
    }
  }
  return false
}

function sameHistoryId(a, b) {
  const id = String(a?.historyId || '').trim()
  return Boolean(id) && id === String(b?.historyId || '').trim()
}

function coordsClose(a, b) {
  const aLat = finiteCoord(a?.lat)
  const aLon = finiteCoord(a?.lon)
  const bLat = finiteCoord(b?.lat)
  const bLon = finiteCoord(b?.lon)
  if (!validPin(aLat, aLon) || !validPin(bLat, bLon)) return false
  return Math.abs(aLat - bLat) <= COORD_MATCH_DEGREES + 1e-6 && Math.abs(aLon - bLon) <= COORD_MATCH_DEGREES + 1e-6
}

/**
 * Same place: a shared site trinomial, the same map site when the titles
 * also share a stem, or coordinates within about 0.01° plus that stem.
 * A shared pin alone is not enough. Lincoln and Painted Stone share a pin
 * and stay separate.
 */
function samePlace(a, b) {
  if (!a?.slug || !b?.slug || a.slug === b.slug) return false
  if (sharedTrinomial(a, b)) return true
  if (!sameHistoryId(a, b) && !coordsClose(a, b)) return false
  return sharedTitleStem(a?.title, b?.title)
}

/**
 * Same person: both titles lead with the same personal name before a comma
 * ("Hugh McGary, the hothead major" / "Hugh McGary, the Blue Licks Hothead").
 */
const _titlePersonCache = new Map()
function titlePerson(title) {
  const key = String(title || '')
  if (_titlePersonCache.has(key)) return _titlePersonCache.get(key)
  const m = /^([^,:]+),\s/.exec(key)
  if (!m) { _titlePersonCache.set(key, ''); return '' }
  const name = m[1].trim()
  const words = name.split(/\s+/)
  if (words.length < 2 || words.length > 4 || !words.every((w) => /^[A-Z][\p{L}'’.-]*$/u.test(w))) {
    _titlePersonCache.set(key, '')
    return ''
  }
  const out = name.toLowerCase()
  _titlePersonCache.set(key, out)
  return out
}

function samePerson(a, b) {
  if (!a?.slug || !b?.slug || a.slug === b.slug) return false
  const pa = titlePerson(a.title)
  return Boolean(pa) && pa === titlePerson(b.title)
}

function sameSubject(a, b) {
  return samePlace(a, b) || samePerson(a, b)
}

/** One story per place. The richer article wins. A thinner twin of the current page is dropped. */
function collapseSamePlace(origin, stories, skip) {
  const groups = []
  for (const other of stories || []) {
    if (!other?.slug || !other.title) continue
    if (origin?.slug && other.slug === origin.slug) continue
    const idx = groups.findIndex((group) => group.some((item) => sameSubject(item, other)))
    if (idx === -1) groups.push([other])
    else groups[idx].push(other)
  }
  const kept = []
  for (const group of groups) {
    const rivals = origin && group.some((item) => sameSubject(origin, item)) ? [...group, origin] : group
    rivals.sort(
      (a, b) => storyRichness(b) - storyRichness(a) || String(a.slug).localeCompare(String(b.slug)),
    )
    const best = rivals[0]
    if (!best?.slug || (origin?.slug && best.slug === origin.slug) || skip?.has(best.slug)) continue
    kept.push(best)
  }
  return kept
}

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
  const otherOrigin = storyOrigin(other)
  if (!origin || !otherOrigin) return Number.POSITIVE_INFINITY
  return haversineMiles(origin.lat, origin.lon, otherOrigin.lat, otherOrigin.lon)
}

/**
 * Up to five other stories, one per place.
 * Two or more shared specific tags come first.
 * One specific tag does not outrank the same county or a nearer story.
 * Then the same county, then nearer, then title.
 */
// #346: a public archaeological site in the same county is a reference site for a protected one; never card it.
function isPublicArchaeologySite(other, isProtected) {
  if (isProtected(other)) return false
  return (other?.tags || []).map((t) => String(t).toLowerCase()).includes('archaeology')
}

export function pickRelatedStories(story, all, excludeSlugs = [], { isProtected = isProtectedStoryCoords } = {}) {
  const skip = new Set(excludeSlugs || [])
  const originTags = relatedTagSets(story)
  let pool = collapseSamePlace(story, all, skip)
  // #345: a protected site's related cards are same-county only; distance picks name nearby towns and rivers.
  if (typeof isProtected === 'function' && isProtected(story)) pool = pool.filter((other) => sameCounty(story, other) && !isPublicArchaeologySite(other, isProtected))
  const strongCount = (other) => {
    const shared = sharedCount(originTags.specific, relatedTagSets(other).specific)
    return shared >= 2 ? shared : 0
  }
  // #346: a public story cards a protected site only by county or strong shared tags, never because it is close by.
  if (typeof isProtected === 'function' && !isProtected(story)) pool = pool.filter((other) => !isProtected(other) || sameCounty(story, other) || strongCount(other) > 0)
  pool.sort((a, b) => {
    const specificDelta = strongCount(b) - strongCount(a)
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
export function relatedAndNearbyHtml(related, nearby, { headingLevel = 2, collapsible = false, heading = 'Related and nearby' } = {}) {
  const rows = [...(related || []), ...(nearby || [])]
  return relatedListHtml(rows, {
    heading,
    headingId: 'related-nearby-heading',
    headingLevel,
    navClass: 'static-related story-nearby',
    collapsible,
  })
}

/** The story-page list: related stories, then nearby stories and markers. */
export function relatedAndNearbyForStory(
  story,
  all,
  markers,
  { headingLevel = 2, heading = 'Related stories', excludeSlugs = [], excludeMarkerIds = [], limit = 3, thumbFor = storyThumbSrc, portraitFor = () => '', personFor = () => null, whyFor = null, collapsible = false, isProtected = isProtectedStoryCoords } = {},
) {
  const related = pickRelatedStories(story, all, excludeSlugs, { isProtected })
  // #345: protected sites show no nearby cards. Their titles and distances name nearby towns and rivers.
  const protectedSite = typeof isProtected === 'function' && isProtected(story)
  // Person cards always use the canonical portrait, with the standard portrait alt (#334).
  const media = (other) => {
    const portrait = portraitFor(other.slug) || ''
    if (portrait) return { thumb: portrait, thumbAlt: relatedCardPortraitAlt(personFor(other.slug)) }
    return { thumb: thumbFor(other) || '', thumbAlt: '' }
  }
  const bySlug = new Map((all || []).filter((item) => item?.slug).map((item) => [item.slug, item]))
  const relatedRows = related.map((other) => ({
    kind: 'story',
    related: true,
    slug: other.slug,
    title: other.title,
    detail: storyDetail(other),
    why: typeof whyFor === 'function' ? whyFor(story, other) : '',
    ...media(other),
  }))
  const nearby = (protectedSite ? [] : nearbyPlaces(story, all, markers, {
    limit,
    excludeSlugs: [...excludeSlugs, ...related.map((item) => item.slug)],
    excludeMarkerIds,
    isProtected,
  })).map((row) => {
    if (row.kind !== 'story') return { ...row, thumb: '' }
    const other = bySlug.get(row.slug)
    return {
      ...row,
      title: other?.title || row.title,
      detail: other ? storyDetail(other) : '',
      why: other && typeof whyFor === 'function' ? whyFor(story, other) : '',
      ...(other ? media(other) : { thumb: '', thumbAlt: '' }),
    }
  })
  return relatedAndNearbyHtml(relatedRows, nearby, { headingLevel, collapsible, heading })
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

/**
 * Year to show after a photo caption, or '' when the caption already names that year
 * (e.g. "(photographed 2008)"), so the year never shows twice.
 */
export function photoCaptionYear(photo) {
  // Period art carries its year in the credit line instead.
  if (artworkLead(photo) && photo.artwork !== 'reconstruction') return ''
  const year = String(photo?.year ?? '').trim()
  if (!year) return ''
  if (!/^[0-9A-Za-z]+$/.test(year)) return year
  const caption = String(photo?.title || '')
  return new RegExp(`(^|[^0-9A-Za-z])${year}([^0-9A-Za-z]|$)`).test(caption) ? '' : year
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
  const cc = ccByLicense(photo)
  if (!chunks.length && !model.license && !cc && !photo?.rights) return ''
  // Each piece is a nowrap .seg; CSS (.seg + .seg::before) draws the ' · ' at the start of the
  // following piece, so a separator never hangs at a line end and no stray ' .' follows a link.
  const segs = chunks.map((c) => `<span class="seg">${c}</span>`)
  // Human-made art (e.g. Herb Roe's paintings) leads with its own label, never 'Photo:' or 'AI illustration'.
  const artwork = artworkLead(photo)
  const lead = artwork ? esc(artwork) : 'Photo: '
  const first = artwork && model.photographer && photo?.artwork !== 'reconstruction' && photo?.year ? `${chunks[0]}, ${esc(String(photo.year))}` : chunks[0]
  if (segs.length) segs[0] = `<span class="seg">${lead}${first}</span>`
  // A rights statement that is not a license (e.g. LoC 'No known restrictions') shows as written.
  const rights = String(photo?.rights || '').trim()
  if (rights && !model.license && !cc) {
    segs.push(`<span class="seg photo-license">${segs.length ? '' : lead}${esc(rights)}</span>`)
  } else if (model.license || cc) {
    const href = cc?.url || model.licenseUrl
    const label = cc?.name || model.license
    const rel = cc ? 'license noopener noreferrer' : 'noopener noreferrer'
    const license = href
      ? `<a href="${esc(href)}" target="_blank" rel="${rel}">${esc(label)}<span class="visually-hidden"> (opens in a new tab)</span></a>`
      : esc(label)
    const prefix = segs.length ? '' : lead
    segs.push(`<span class="seg photo-license">${prefix}License: ${license}</span>`)
  }
  if (cc && /^https?:\/\//i.test(model.sourceUrl || '')) {
    segs.push(
      `<span class="seg"><a href="${esc(model.sourceUrl)}" target="_blank" rel="noopener noreferrer">source file</a></span>`,
    )
  }
  const inner = segs.join(' ')
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
