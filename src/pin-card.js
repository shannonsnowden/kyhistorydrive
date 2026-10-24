/**
 * Pin teaser cards (#339, v2 Phase 4). A pin tied to a story shows its name, an optional
 * KY History teaser (35 words max), and "Read the story" — the story page holds the text.
 * protectedNote is trusted HTML from protectedPinNoteHtml (protected sites keep the approximate-location note).
 */
import { storyUrl, canonicalStorySlug } from './story-url.js'

export const PIN_TEASER_MAX_WORDS = 35
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function teaserWordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length
}

export function pinCardHtml({ name, layerLabel = '', meta = '', slug, teaser = '', protectedNote = '', escapeHtml }) {
  const s = canonicalStorySlug(slug)
  if (!SLUG.test(s)) throw new Error(`pinCardHtml: bad story slug ${JSON.stringify(slug)}`)
  const head = layerLabel ? `<div class="layer-label">${escapeHtml(layerLabel)}</div>` : ''
  const sub = meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ''
  const body = teaser ? `<p class="pin-card-teaser">${escapeHtml(teaser)}</p>` : ''
  return `<div class="pin-card" tabindex="-1">${head}<h3>${escapeHtml(name)}</h3>${sub}${body}${protectedNote}` +
    `<p class="pin-card-actions"><a class="btn pin-card-read" href="${escapeHtml(storyUrl(s))}">Read the story</a></p></div>`
}

/** Phones (viewport 600px or less) get a map-first bottom sheet instead of a floating card. */
export function usePhoneSheet(viewportWidth) {
  return Number(viewportWidth) > 0 && Number(viewportWidth) <= 600
}

/** Where to park the pin on a phone so it stays visible above the sheet. */
export function phoneSheetPinY(mapHeight) {
  return Math.round(Math.max(56, mapHeight * 0.3))
}

/** True only when href resolves to the same origin as base AND a /stories/ path (#350 security). */
export function isSameOriginStoryHref(href, base) {
  try {
    const u = new URL(href, base)
    return u.origin === new URL(base).origin && u.pathname.startsWith('/stories/')
  } catch {
    return false
  }
}

/**
 * Phone sheet layout (#350): the sheet is fixed to the viewport bottom, so make sure the map is on
 * screen and the pin sits in the band between the sticky header and the sheet's top.
 * All values are viewport px; returns how far to scroll the page and the pin's y inside the map.
 */
export function phoneSheetLayout({ mapTop, mapBottom, viewportHeight, headerBottom = 0, sheetFraction = 0.45 }) {
  const sheetTop = viewportHeight * (1 - sheetFraction)
  const band = (top) => Math.min(top + (mapBottom - mapTop), sheetTop) - Math.max(top, headerBottom)
  const scrollBy = band(mapTop) >= 160 ? 0 : Math.round(mapTop - headerBottom)
  const top = mapTop - scrollBy
  const lo = Math.max(top, headerBottom)
  const hi = Math.max(lo + 1, Math.min(top + (mapBottom - mapTop), sheetTop))
  return { scrollBy, pinY: Math.round((lo + hi) / 2 - top) }
}
