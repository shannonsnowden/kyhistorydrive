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
  if (includeYear && photo.year) html += `${html ? ' · ' : ''}${escapeHtml(String(photo.year))}`
  return html
}
