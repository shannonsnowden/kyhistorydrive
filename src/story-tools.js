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
    rows.push({ id: String(id), title: String(title), lat, lon })
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

function nearbyRowHtml(row) {
  const kind = row.kind === 'marker' ? 'Historical marker' : 'Story'
  const href = row.kind === 'marker' ? markerMapHref(row.id) : `/stories/${encodeURIComponent(row.slug)}/`
  const kindText = row.detail ? `${kind} · ${row.detail}` : kind
  const miles = row.related ? '' : formatMiles(row.miles)
  const milesHtml = miles ? `<span class="nearby-miles">${esc(miles)}</span>` : ''
  const liClass = row.related ? 'related-story' : 'nearby-place'
  return `<li class="${liClass}"><a href="${esc(href)}">${esc(row.title)}</a><span class="nearby-kind">${esc(kindText)}</span>${milesHtml}</li>`
}

export function nearbyHtml(story, all, { headingLevel = 2, markers = [], excludeSlugs = [], excludeMarkerIds = [], limit = 5 } = {}) {
  const near = nearbyPlaces(story, all, markers, { excludeSlugs, excludeMarkerIds, limit })
  if (!near.length) return ''
  const level = headingLevel === 3 ? 3 : 2
  const items = near.map((row) => nearbyRowHtml(row)).join('')
  return `<nav class="story-nearby" aria-labelledby="nearby-stories-heading"><h${level} id="nearby-stories-heading">Nearby</h${level}><ul>${items}</ul></nav>`
}

/** Related stories first, then nearby places that are not already listed. */
export function relatedAndNearbyHtml(related, nearby, { headingLevel = 2 } = {}) {
  const rows = [...(related || []), ...(nearby || [])]
  if (!rows.length) return ''
  const level = headingLevel === 3 ? 3 : 2
  const items = rows.map((row) => nearbyRowHtml(row)).join('')
  return `<nav class="static-related story-nearby" aria-labelledby="related-nearby-heading"><h${level} id="related-nearby-heading">Related and nearby</h${level}><ul>${items}</ul></nav>`
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
