// 'Take a Drive' button: links a story to its stop on a drive page, /drives/<id>/#stop-<slug>.
// One button for the first drive; any other drives go in a compact 'Also on:' row.
// Pure HTML builders, shared by the static story pages (prerender) and the Timeline panel (main.js).
// Data: /data/web/story-drives.json, built from the drive pages by scripts/build-story-drives.mjs.

// Same route-and-car mark as the homepage Plan Your Drive badge (seal option A). Green and amber only.
export const TAKE_A_DRIVE_ICON = `<svg class="take-a-drive-icon" viewBox="0 0 120 120" width="40" height="40" aria-hidden="true" focusable="false">
<circle cx="60" cy="60" r="57" fill="var(--pb-green)" stroke="var(--pb-amber)" stroke-width="3"/>
<path d="M28 84 C 40 84, 40 62, 56 62 S 74 40, 92 38" fill="none" stroke="var(--pb-cream)" stroke-opacity=".9" stroke-width="7" stroke-linecap="round"/>
<path d="M28 84 C 40 84, 40 62, 56 62 S 74 40, 92 38" fill="none" stroke="var(--pb-amber)" stroke-width="2.4" stroke-dasharray="5 5" stroke-linecap="round"/>
<circle cx="28" cy="84" r="5" fill="var(--pb-amber)" stroke="var(--pb-cream)" stroke-width="2"/>
<path d="M92 22 c-7 0 -12 5 -12 11.5 c0 8.5 12 19 12 19 s12 -10.5 12 -19 C104 27 99 22 92 22z" fill="var(--pb-amber)" stroke="var(--pb-cream)" stroke-width="2"/>
<circle cx="92" cy="33.5" r="4.2" fill="var(--pb-green)"/>
<g transform="translate(44 70)">
<path d="M2 14 L5 6 Q6.5 3 10 3 H22 Q25.5 3 27 6 L30 14 Q32 14.5 32 17 V22 H0 V17 Q0 14.5 2 14z" fill="var(--pb-amber)" stroke="var(--pb-cream)" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M6.5 13 L8.5 7.5 Q9.3 6 11 6 H21 Q22.7 6 23.5 7.5 L25.5 13z" fill="var(--pb-green)"/>
<circle cx="7" cy="22" r="3.6" fill="var(--pb-cream)" stroke="var(--pb-green)" stroke-width="2.2"/>
<circle cx="25" cy="22" r="3.6" fill="var(--pb-cream)" stroke="var(--pb-green)" stroke-width="2.2"/>
</g></svg>`

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const takeADriveHref = (id, slug) => `/drives/${encodeURIComponent(id)}/#stop-${encodeURIComponent(slug)}`

/** A button for the story's first drive plus an 'Also on:' row for the rest; '' when it is on none. data: story-drives.json. */
export function takeADriveHtml(data, slug) {
  if (!ID_RE.test(String(slug || ''))) return ''
  const ids = (data?.stories?.[slug] || []).filter((id) => ID_RE.test(id) && data.drives?.[id])
  if (!ids.length) return ''
  const [first, ...rest] = ids
  const name = data.drives[first].name
  const btn = `<a class="take-a-drive-btn" href="${esc(takeADriveHref(first, slug))}" data-drive="${esc(first)}" aria-label="Take a Drive: ${esc(name)}">${TAKE_A_DRIVE_ICON}<span class="take-a-drive-text"><span class="take-a-drive-title">Take a Drive</span><span class="take-a-drive-name">${esc(name)}</span></span></a>`
  const also = rest.length
    ? `<p class="take-a-drive-also"><span class="take-a-drive-also-label">Also on:</span> ${rest
        .map((id) => `<a class="take-a-drive-alt" href="${esc(takeADriveHref(id, slug))}" data-drive="${esc(id)}">${esc(data.drives[id].name)}</a>`)
        .join('<span class="take-a-drive-sep" aria-hidden="true"> · </span>')}</p>`
    : ''
  return `<nav class="take-a-drive" data-take-a-drive aria-label="Drives with this story">${btn}${also}</nav>`
}

let cache = null
export async function loadStoryDrives() {
  if (cache) return cache
  try {
    const r = await fetch('/data/web/story-drives.json')
    cache = r.ok ? await r.json() : { drives: {}, stories: {} }
  } catch {
    cache = { drives: {}, stories: {} }
  }
  return cache
}
