/** Helpers for scripts/check-grokipedia-links.mjs (kept pure so they are unit-tested). */

/** Visible text of an HTML page: drop script/style blocks (any case), tags, and any leftover angle brackets. */
export function stripHtml(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script[^>]*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The URL as written, then Grokipedia's lower-case slug form (david_rice_presbyterian_minister) if different. */
export function slugCandidates(url) {
  const m = String(url).match(/^(https:\/\/grokipedia\.com\/page\/)(.+)$/)
  if (!m) return [url]
  let slug = m[2]
  try { slug = decodeURIComponent(slug) } catch { /* keep as written */ }
  const lower = slug.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const alt = m[1] + lower
  return alt === url ? [url] : [url, alt]
}
