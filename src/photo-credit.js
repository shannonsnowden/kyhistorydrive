/**
 * Visible photo credit. CC BY and CC BY-SA names become a link to the
 * license, with a link to the source file beside the credit. Public-domain
 * and other lines stay plain text.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Last CC BY or CC BY-SA name in the text. Skips NC, ND, and NC-SA. */
export function matchCcByName(text) {
  const re = /CC BY-SA(?:\s+\d+(?:\.\d+)?)?|CC BY(?:\s+\d+(?:\.\d+)?)?/gi
  let last = ''
  let m
  const src = String(text || '')
  while ((m = re.exec(src))) {
    const end = m.index + m[0].length
    if (src[end] === '-') continue
    last = m[0].replace(/\s+/g, ' ')
  }
  if (!last) return ''
  return last.replace(/^cc by-sa/i, 'CC BY-SA').replace(/^cc by/i, 'CC BY')
}

export function canonicalLicenseUrl(name, given) {
  const provided = String(given || '')
    .trim()
    .replace(/^http:\/\//i, 'https://')
  if (/^https:\/\/creativecommons\.org\/licenses\/by(?:-sa)?\/\d/i.test(provided)) {
    return provided.endsWith('/') ? provided : `${provided}/`
  }
  const m = String(name || '').match(/^CC BY(-SA)?(?:\s+(\d+(?:\.\d+)?))?$/i)
  if (!m) return ''
  const kind = m[1] ? 'by-sa' : 'by'
  const ver = m[2] || '4.0'
  return `https://creativecommons.org/licenses/${kind}/${ver}/`
}

/** { name, url } when the photo is CC BY or CC BY-SA. Otherwise null. */
export function ccByLicense(photo) {
  if (!photo) return null
  const fromAttribution = matchCcByName(photo.attribution)
  const fromLicense = matchCcByName(photo.license)
  const name = fromAttribution || fromLicense
  if (!name) return null
  const url = canonicalLicenseUrl(name, photo.license_url)
  if (!url) return null
  return { name, url, inAttribution: Boolean(fromAttribution) }
}

/**
 * Credit HTML. Already escaped. includeYear matches the homepage line
 * (`attribution · year`). Story pages print the year on the caption instead.
 */
export function photoCreditHtml(photo, { includeYear = false } = {}) {
  if (!photo) return ''
  const raw = String(photo.attribution || photo.source_label || photo.credit || '').trim()
  const cc = ccByLicense(photo)
  if (!raw && !cc) return ''
  let html = escapeHtml(raw)
  if (cc) {
    const link = `<a href="${escapeHtml(cc.url)}" rel="license noopener noreferrer" target="_blank">${escapeHtml(cc.name)}</a>`
    const escapedName = escapeHtml(cc.name)
    const at = html.lastIndexOf(escapedName)
    if (at >= 0) html = html.slice(0, at) + link + html.slice(at + escapedName.length)
    else html = html ? `${html} · ${link}` : link
    const source = String(photo.source_url || '').trim()
    if (/^https?:\/\//i.test(source)) {
      html += ` · <a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">source file</a>`
    }
  }
  const lead = artworkLead(photo)
  if (lead) html = `${escapeHtml(lead)}${html}`
  if (includeYear && photo.year) html += `${html ? ' · ' : ''}${escapeHtml(String(photo.year))}`
  return html
}

/**
 * Human-made art never says 'Photo:' or 'AI illustration' (Editor 10/18, #199).
 * 'reconstruction' is only for modern art that reconstructs the past (Herb Roe);
 * period art is labeled by medium, then artist and year.
 */
export const ARTWORK_LEADS = {
  reconstruction: "Artist's reconstruction · ",
  painting: 'Painting: ',
  engraving: 'Engraving: ',
  print: 'Print: ',
  drawing: 'Drawing: ',
  map: 'Map: ',
  // Medium not confirmed by the source (e.g. a halftone plate in a book of portraits).
  portrait: 'Portrait: ',
  lithograph: 'Lithograph: ',
  signature: 'Signature: ',
  document: 'Document: ',
}

export function artworkLead(photo) {
  const kind = String(photo?.artwork || '').trim()
  return kind ? ARTWORK_LEADS[kind] || '' : ''
}


/** Words in a source file name or caption that mark a non-photograph (Editor 10/18, #199). */
export const NON_PHOTO_PATTERN = /\b(maps?|painting|paintings|oil on canvas|engraving|engraved|lithograph|lithographs|prints?|drawing|drawn|illustration|plate|postcard|signature|signed|portrait|silhouette)\b/i

export const CAPTION_NON_PHOTO = /\b(map of|painting|oil on canvas|engraving|lithograph|postcard|signature of)\b/i

/** True when a story photo looks like art or a document but has no artwork medium. */
export function looksLikeUnlabeledArtwork(photo) {
  if (!photo?.image_url || artworkLead(photo)) return false
  let file = ''
  try {
    file = decodeURIComponent(String(photo.source_url || '').split('/').pop() || '')
  } catch {
    file = String(photo.source_url || '')
  }
  // Captions often say 'no portrait is known' or 'an illustration of', so only strong words count there.
  return NON_PHOTO_PATTERN.test(file.replace(/[_]+/g, ' ')) || CAPTION_NON_PHOTO.test(String(photo.title || ''))
}

/** Reviewed non-photographs (Editor 10/18, #199): each must keep a photo.artwork medium. */
export const REVIEWED_ARTWORK_SLUGS = new Set([
  'annis-mound-village',
  'benjamin-logan',
  'blackfish-cot-ta-wa-ma-go-chillicothe-war-chief',
  'bland-w-ballard-of-tick-creek',
  'blue-jacket-weyapiersenwah',
  'capt-abraham-lincoln-on-long-run',
  'chickamauga-cherokee-hold-the-southern-flank',
  'delaware-winter-camps-on-kentucky-ground',
  'egushawa-and-the-odawa-in-kentuckys-war-years',
  'erie-the-cat-nation',
  'gen-james-wilkinson-kentuckys-agent-13',
  'iroquois-beaver-wars',
  'jeptha-knob-shelby-countys-buried-crater',
  'john-bradford-and-the-kentucke-gazette',
  'john-filson-kentucke-1784',
  'john-finley-the-trader-who-put-kentucky-on-boones-map',
  'john-floyd',
  'kentucky-association-1826-lexington-race-course',
  'levi-todd-lexington-co-founder',
  'little-turtle-and-hardins-defeat-1790',
  'moluntha-and-logans-raid-1786',
  'mount-horeb-earthworks',
  'peter-village-early-woodland-enclosure-near-lexington',
  'richard-henderson',
  'squire-boones-painted-stone',
  'treaty-of-fort-stanwix-1768',
  'treaty-of-greenville-1795-the-line-to-the-kentucky-river',
  'tutelo-the-totteroy',
  'wea-waayaahtanwa-on-the-wabash',
])
