/**
 * Pin teaser cards (#339, v2 Phase 4). A pin tied to a story shows its name, an optional
 * KY History teaser (35 words max), and "Read the story" — the story page holds the text.
 */
import { storyUrl, canonicalStorySlug } from './story-url.js'

export const PIN_TEASER_MAX_WORDS = 35
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function teaserWordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length
}

export function pinCardHtml({ name, layerLabel = '', meta = '', slug, teaser = '', escapeHtml }) {
  const s = canonicalStorySlug(slug)
  if (!SLUG.test(s)) throw new Error(`pinCardHtml: bad story slug ${JSON.stringify(slug)}`)
  const head = layerLabel ? `<div class="layer-label">${escapeHtml(layerLabel)}</div>` : ''
  const sub = meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ''
  const body = teaser ? `<p class="pin-card-teaser">${escapeHtml(teaser)}</p>` : ''
  return `<div class="pin-card">${head}<h3>${escapeHtml(name)}</h3>${sub}${body}` +
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
