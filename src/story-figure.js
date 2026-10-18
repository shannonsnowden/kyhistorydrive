/**
 * Item 71 / #288 follow-up (Critiquito #5): one renderer for the optional non-portrait story figure
 * (a culture AI illustration with alt, visible note and credit), shared by the prerendered story
 * page and the SPA map/Timeline reader so both show the same image, AI note and credit.
 */
import { researchPageHref } from './story-markdown.js'

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Shannon's rule: the research (evidence) link sits beside the reconstruction note. */
const EVIDENCE_LABEL = 'See the evidence for this picture'
const SAFE_SLUG = /^[a-z0-9-]+$/

/** Same-site research-page href for an evidence slug (same /research/<slug>/ pattern as the story header), or '' if the slug is unsafe. */
export function figureEvidenceHref(slug) {
  const id = typeof slug === 'string' ? slug : ''
  if (!SAFE_SLUG.test(id) || id.includes('--') || id.startsWith('-') || id.endsWith('-')) return ''
  return researchPageHref(id)
}

/** Figure files must be our own /content/ assets (no external, protocol-relative or traversal URLs). */
export function isSafeFigureSrc(src) {
  const v = String(src || '')
  // Reject any percent-encoding or backslash outright, before the prefix and '..' checks,
  // so encoded traversal (%2e%2e, %252e) or backslash paths can never slip through.
  if (/[%\\]/.test(v)) return false
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
  const evHref = figureEvidenceHref(fig.evidence)
  const evidence = evHref ? `<a class="story-figure-evidence" href="${esc(evHref)}">${esc(EVIDENCE_LABEL)}</a>` : ''
  const note = fig.note || evidence
    ? `<span class="story-figure-note">${esc(fig.note || '')}${fig.note && evidence ? ' ' : ''}${evidence}</span> `
    : ''
  return `<figure class="story-figure"><picture><source srcset="${esc(fig.webp)}" type="image/webp"><img src="${esc(fig.jpg)}" alt="${esc(fig.alt)}" width="1280" height="720" ${load} decoding="async"></picture><figcaption>${note}<span class="story-figure-credit">${esc(fig.credit)}</span></figcaption></figure>`
}
