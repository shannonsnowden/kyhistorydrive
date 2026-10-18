// Item 70: one inline link per transport story to /roads-and-rails/. Config: scripts/transport-links.json
// (one exact phrase per story). Built into /data/web/transport-links.json by
// scripts/build-transport-links.mjs; the static story pages and the app reader both render it here.
// Links only: the story text is never changed, and never inside a heading or an existing link.

export const ROADS_RAILS_HREF = '/roads-and-rails/'

/** Transport words that mark a story as involving roads, traces, rivers, ferries, turnpikes, railroads or parkways. */
export const TRANSPORT_KEYWORDS =
  /\b(Wilderness Road|Boone[’']s Trace|Natchez Trace|Warriors[’']? Path|turnpikes?|Maysville [Rr]oad|railroads?|railways?|L&(?:amp;)?N|Louisville (?:&(?:amp;)?|and) Nashville|parkways?|ferry|ferries|steamboats?|flatboats?|keelboats?|canal|stagecoach|[A-Z][a-z]+ Trace)\b/i

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Spellings the phrase can take in marked output (& is escaped; ' may be an entity). */
function variants(phrase) {
  const base = escHtml(phrase)
  return [...new Set([phrase, base, base.replace(/'/g, '&#39;'), base.replace(/'/g, '&#x27;')])]
}

let cache = null
export async function loadTransportLinks() {
  if (cache) return cache
  try {
    const r = await fetch('/data/web/transport-links.json')
    cache = r.ok ? await r.json() : { stories: {} }
  } catch {
    cache = { stories: {} }
  }
  return cache
}

/** Wrap the first occurrence of entry.phrase (outside links and headings) in a /roads-and-rails/ link. */
export function applyTransportLink(html, entry) {
  const phrase = entry && typeof entry.phrase === 'string' ? entry.phrase : ''
  if (!phrase || !html) return html
  const forms = variants(phrase)
  const parts = String(html).split(/(<[^>]+>)/)
  let inA = 0
  let inHeading = 0
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i]
    if (!t) continue
    if (t[0] === '<') {
      if (/^<a[\s>]/i.test(t)) inA += 1
      else if (/^<\/a>/i.test(t)) inA = Math.max(0, inA - 1)
      else if (/^<h[1-6][\s>]/i.test(t)) inHeading += 1
      else if (/^<\/h[1-6]>/i.test(t)) inHeading = Math.max(0, inHeading - 1)
      continue
    }
    if (inA || inHeading) continue
    let best = -1
    let form = ''
    for (const f of forms) {
      let at = t.indexOf(f)
      while (at >= 0) {
        const before = t[at - 1] || ''
        const after = t[at + f.length] || ''
        if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) break
        at = t.indexOf(f, at + 1)
      }
      if (at >= 0 && (best < 0 || at < best)) {
        best = at
        form = f
      }
    }
    if (best < 0) continue
    parts[i] = `${t.slice(0, best)}<a class="transport-link" href="${ROADS_RAILS_HREF}">${form}</a>${t.slice(best + form.length)}`
    return parts.join('')
  }
  return html
}
