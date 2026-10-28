// Story body people links + inline portraits (PR B). Data: /data/web/story-people.json, written at
// build time by scripts/build-story-people.mjs. Links only: the story text is never changed.
import { portraitAlt, creditWithCaption, aiCreditText, creditHtml } from './portrait-captions.js'

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const escRe = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SAFE = { webp: /^\/people\/portraits\/[\w.-]+\.webp$/, jpg: /^\/people\/portraits\/[\w.-]+\.jpg$/ }
const SAFE_HREF = /^(?:\/people\/#[\w-]+|#timeline\/[\w%-]+|\/stories\/[\w-]+\/)$/

export const AI_CREDIT = 'AI illustration · Kentucky History Drive'

let cache = null
export async function loadStoryPeople() {
  if (cache) return cache
  try {
    const r = await fetch('/data/web/story-people.json')
    cache = r.ok ? await r.json() : { stories: {} }
  } catch {
    cache = { stories: {} }
  }
  return cache
}

/** Name regex shared by the build step and the renderer (whole words, exact case). */
export function nameRegex(name) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escRe(name)})(?![\\p{L}\\p{N}])`, 'u')
}

export function inlinePortraitHtml(person, side) {
  if (!person || !SAFE.webp.test(person.image?.webp || '') || !SAFE.jpg.test(person.image?.jpg || '')) return ''
  const credit = person.ai ? aiCreditText(person) : creditWithCaption(person, person.credit || '')
  const cls = side === 'left' ? 'story-portrait story-portrait-inline story-portrait-left' : 'story-portrait story-portrait-inline'
  return `<figure class="${cls}" data-person="${esc(person.id)}"><picture><source srcset="${esc(person.image.webp)}" type="image/webp"><img src="${esc(person.image.jpg)}" width="200" height="200" alt="${esc(portraitAlt(person))}" loading="lazy" decoding="async"></picture><figcaption><span class="story-portrait-name">${esc(person.name)}</span> <span class="story-portrait-credit">${creditHtml(credit, esc)}</span></figcaption></figure>`
}

/**
 * Apply one story's entry to the body HTML (marked output). Wraps the first text occurrence of
 * each linked name (outside existing links) in <a class="person-link">, and puts each portrait
 * just before its paragraph. An existing anchor whose href is already that person's link and
 * whose text is exactly the name still counts, so the portrait sits on that paragraph without
 * a nested link. hrefFor maps a link target to the right URL for the page type.
 */
export const MAX_INLINE = 3
/** Critique #280: at most this many person links in one paragraph (or list item). A name over the
 * cap stays pending and is linked at its next mention in a later block. */
export const MAX_LINKS_PER_BLOCK = 3

export function applyStoryPeople(html, entry, peopleById, hrefFor = (h) => h, opts = {}) {
  if (!entry || !html) return html
  const links = (entry.links || []).filter((l) => l?.name && SAFE_HREF.test(l.href || ''))
  const pending = new Map(links.map((l) => [l.id, l]))
  const linkedPara = new Map()
  const parts = String(html).split(/(<[^>]+>)/)
  let inA = 0
  let inHeading = 0
  let para = -1
  let blockLinks = 0
  const paraStart = []
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i]
    if (!t) continue
    if (t[0] === '<') {
      if (/^<a[\s>]/i.test(t)) {
        inA += 1
        // Markdown already links this mention to the person's card. Keep that link and
        // still place the inline portrait on this paragraph.
        if (!inHeading && para >= 0 && pending.size) {
          const href = /\bhref="([^"]*)"/i.exec(t)?.[1]
          const next = parts[i + 1] || ''
          if (href && next && next[0] !== '<') {
            const visible = next.trim()
            for (const l of pending.values()) {
              if (hrefFor(l.href) !== href || visible !== l.name) continue
              linkedPara.set(l.id, para)
              pending.delete(l.id)
              break
            }
          }
        }
      } else if (/^<\/a>/i.test(t)) inA = Math.max(0, inA - 1)
      else if (/^<h[1-6][\s>]/i.test(t)) inHeading += 1
      else if (/^<\/h[1-6]>/i.test(t)) inHeading = Math.max(0, inHeading - 1)
      if (/^<p[\s>]/i.test(t)) paraStart[++para] = i
      if (/^<(?:p|li|blockquote|td|th|dd|dt)[\s>]/i.test(t)) blockLinks = 0
      continue
    }
    // SEO: never link inside headings (h1–h6); never nest inside an existing link.
    if (inA || inHeading || !pending.size) continue
    let text = t
    let out = ''
    for (;;) {
      if (blockLinks >= MAX_LINKS_PER_BLOCK) break
      let best = null
      for (const l of pending.values()) {
        const m = nameRegex(l.name).exec(text)
        if (m && (!best || m.index < best.m.index)) best = { l, m }
      }
      if (!best) break
      const start = best.m.index + best.m[1].length
      const end = start + best.m[2].length
      out += `${text.slice(0, start)}<a class="person-link" href="${esc(hrefFor(best.l.href))}">${text.slice(start, end)}</a>`
      text = text.slice(end)
      linkedPara.set(best.l.id, Math.max(0, para))
      pending.delete(best.l.id)
      blockLinks += 1
    }
    parts[i] = out + text
  }
  // Portraits: one per paragraph at most (never stacked), at the paragraph of the person's first
  // linked mention (or the first allowed paragraph), alternating right/left, up to MAX_INLINE.
  const minPara = Math.max(0, Number(opts.minPara) || 0)
  let side = opts.startLeft ? 'left' : 'right'
  const taken = new Set()
  let placed = 0
  for (const id of entry.portraits || []) {
    if (placed >= MAX_INLINE) break
    if (!linkedPara.has(id)) continue
    const para = Math.max(minPara, linkedPara.get(id))
    const at = paraStart[para]
    if (at == null || taken.has(para)) continue
    const fig = inlinePortraitHtml(peopleById.get(id), side)
    if (!fig) continue
    parts[at] = fig + parts[at]
    taken.add(para)
    placed += 1
    side = side === 'right' ? 'left' : 'right'
  }
  return parts.join('')
}
