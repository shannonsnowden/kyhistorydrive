import { portraitAlt } from './portrait-captions.js'

export { portraitAlt }

// Web-only cross-links between stories. Data: /data/web/related-people.json (no story text is edited).
// Portraits: /data/people.json, built from the research file. Images are self-hosted.
let cache = null
let peopleCache = null
export async function loadRelatedPeople() {
  if (cache) return cache
  try {
    const r = await fetch('/data/web/related-people.json')
    cache = r.ok ? await r.json() : { people: {}, skip: {}, related: {} }
  } catch {
    cache = { people: {}, skip: {}, related: {} }
  }
  return cache
}

export async function loadPublicPeople() {
  if (peopleCache) return peopleCache
  try {
    const r = await fetch('/data/people.json')
    peopleCache = r.ok ? await r.json() : { people: [] }
  } catch {
    peopleCache = { people: [] }
  }
  return peopleCache
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function normName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function rankless(value) {
  return normName(value).replace(/^(col|colonel|gen|general|maj|major|capt|captain|dr|sir|rev)\.?\s+/, '')
}

function localPortrait(person) {
  const image = person?.image
  if (!image?.webp || !image?.jpg) return null
  if (!String(image.webp).startsWith('/people/portraits/') || !String(image.jpg).startsWith('/people/portraits/')) return null
  return person
}

/** Story slug -> person, when that story is the person's own story and a local portrait exists. */
export function portraitsByStorySlug(relatedData, people) {
  const withImage = (people || []).map(localPortrait).filter(Boolean)
  const byName = new Map(withImage.map((person) => [normName(person.name), person]))
  const map = new Map()
  const assign = (slug, person) => {
    if (!slug || !person || map.has(slug)) return
    map.set(slug, person)
  }
  for (const [name, slug] of Object.entries(relatedData?.people || {})) {
    assign(slug, byName.get(normName(name)) || byName.get(rankless(name)))
  }
  for (const person of withImage) {
    for (const slug of person.stories || []) {
      if (slug === person.id || String(slug).startsWith(`${person.id}-`)) assign(slug, person)
    }
  }
  return map
}

/** Round headshot, or '' when there is no local image. width/height stay in the 32–40px range. */
export function headshotHtml(person, size = 36) {
  const ready = localPortrait(person)
  if (!ready) return ''
  const n = Number(size) === 32 || Number(size) === 40 ? Number(size) : 36
  const pic = `<picture class="related-headshot-frame"><source srcset="${esc(ready.image.webp)}" type="image/webp"><img class="related-headshot" src="${esc(ready.image.jpg)}" width="${n}" height="${n}" alt="${esc(portraitAlt(ready))}" loading="lazy" decoding="async"></picture>`
  if (ready.ai !== true) return pic
  // AI illustrations (people.json "ai": true) carry a visible corner pill. The img alt already
  // says "AI illustration of …", so the pill text is hidden from screen readers to avoid repeating it.
  return `<span class="related-headshot-ai" title="AI illustration">${pic}<span class="ai-pill" aria-hidden="true">AI</span></span>`
}

// "Related people & stories" block (empty string when a story has no entries).
export function relatedBlockHtml(data, slug, titleFor, headingId = 'storyRelatedH', options = {}) {
  const seen = new Set()
  const items = (data?.related?.[slug] || []).filter((x) => {
    if (!x?.slug || x.slug === slug || seen.has(x.slug) || !titleFor(x.slug)) return false
    seen.add(x.slug)
    return true
  })
  if (!items.length) return ''
  const hid = String(headingId || 'storyRelatedH').replace(/[^\w-]/g, '') || 'storyRelatedH'
  const portraits = options.portraits instanceof Map ? options.portraits : new Map()
  const linkFor = options.linkFor || ((s) => `#timeline/${encodeURIComponent(s)}`)
  const lis = items
    .map((x) => {
      const href = esc(linkFor(x.slug))
      const title = esc(titleFor(x.slug))
      const note = x.label ? ` <span class="related-note">— ${esc(x.label)}</span>` : ''
      const shot = headshotHtml(portraits.get(x.slug))
      if (!shot) return `<li><a href="${href}">${title}</a>${note}</li>`
      return `<li class="has-headshot">${shot}<span class="related-person-text"><a href="${href}">${title}</a>${note}</span></li>`
    })
    .join('')
  return `<aside class="story-related" aria-labelledby="${hid}"><h3 id="${hid}">Related people &amp; stories</h3><ul>${lis}</ul></aside>`
}

// Link the first mention of each known person (when they have their own story) inside the story body.
export function linkPeopleInBody(root, data, slug, titleFor) {
  const people = Object.entries(data?.people || {}).sort((a, b) => b[0].length - a[0].length)
  if (!root || !people.length) return
  const done = new Set() // target slugs already linked in this story
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('a, code, pre, button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    for (const [name, target] of people) {
      if (target === slug || done.has(target) || (data.skip?.[name] || []).includes(slug) || !titleFor(target)) continue
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}]|['’]s (?:Station|Fort))`, 'u')
      const text = node.nodeValue
      const m = re.exec(text)
      if (!m) continue
      const start = m.index + m[1].length
      const a = document.createElement('a')
      a.href = `#timeline/${encodeURIComponent(target)}`
      a.className = 'person-link'
      a.textContent = name
      a.title = `Read the story: ${titleFor(target)}`
      const after = node.splitText(start)
      after.nodeValue = after.nodeValue.slice(name.length)
      node.parentNode.insertBefore(a, after)
      done.add(target)
      nodes.push(node, after) // re-scan both halves for other people
      break
    }
  }
}
