/**
 * Item 71 / #288 follow-up (Critiquito #5): one renderer for the optional non-portrait story figure
 * (a culture AI illustration with alt, visible note and credit), shared by the prerendered story
 * page and the SPA map/Timeline reader so both show the same image, AI note and credit.
 */
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Figure files must be our own /content/ assets (no external, protocol-relative or traversal URLs). */
export function isSafeFigureSrc(src) {
  const v = String(src || '')
  return v.startsWith('/content/') && !v.startsWith('//') && !v.includes('..')
}

/**
 * @param {object} fig story.figure ({ webp, jpg, alt, credit, note })
 * @param {{ priority?: boolean, strict?: boolean }} opts priority: first image under the h1 (likely LCP), load eagerly.
 *   strict: throw on an unsafe src (build time); otherwise render nothing (browser).
 */
export function storyFigureHtml(fig, { priority = false, strict = false } = {}) {
  if (!fig || !fig.webp || !fig.jpg || !fig.alt || !fig.credit) return ''
  for (const src of [fig.webp, fig.jpg]) {
    if (!isSafeFigureSrc(src)) {
      if (strict) throw new Error(`prerender: story figure src must start with /content/ (got ${src})`)
      return ''
    }
  }
  const load = priority ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'
  const note = fig.note ? `<span class="story-figure-note">${esc(fig.note)}</span> ` : ''
  return `<figure class="story-figure"><picture><source srcset="${esc(fig.webp)}" type="image/webp"><img src="${esc(fig.jpg)}" alt="${esc(fig.alt)}" width="1280" height="720" ${load} decoding="async"></picture><figcaption>${note}<span class="story-figure-credit">${esc(fig.credit)}</span></figcaption></figure>`
}
