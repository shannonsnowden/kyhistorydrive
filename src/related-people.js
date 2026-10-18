import { portraitAlt, creditWithCaption, aiCreditText, creditHtml } from './portrait-captions.js'
import { MAX_LINKS_PER_BLOCK } from './story-people.js'

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

function realFirst(list) {
  const real = list.find((p) => !p.ai)
  return real || list[0] || null
}

/**
 * Story slug -> person (any people.json person, with or without a portrait). Rules, in order:
 * related-people.json portraitFor (explicit; null = not a person's story), then name links, id-prefix story slugs and
 * people.json storySubjects. When several people match, a real photo wins over an AI portrait.
 * Faces only ever come from people.json, so each person keeps one canonical face.
 */
export function personByStorySlug(relatedData, people, storySubjects = null, { imageOnly = false } = {}) {
  const pool = (people || []).filter((p) => p?.id && (!imageOnly || localPortrait(p)))
  const byId = new Map(pool.map((p) => [p.id, p]))
  const byName = new Map()
  for (const p of pool) if (!byName.has(normName(p.name))) byName.set(normName(p.name), p)
  const candidates = new Map()
  const add = (slug, person) => {
    if (!slug || !person) return
    const list = candidates.get(slug) || []
    if (!list.includes(person)) list.push(person)
    candidates.set(slug, list)
  }
  for (const [name, slug] of Object.entries(relatedData?.people || {})) {
    add(slug, byName.get(normName(name)) || byName.get(rankless(name)))
  }
  for (const person of pool) {
    for (const slug of person.stories || []) {
      if (slug === person.id || String(slug).startsWith(`${person.id}-`)) add(slug, person)
    }
  }
  for (const [slug, id] of Object.entries(storySubjects || {})) add(slug, byId.get(id))
  const map = new Map()
  for (const [slug, list] of candidates) map.set(slug, realFirst(list))
  for (const [slug, id] of Object.entries(relatedData?.portraitFor || {})) {
    // null: the story is not a person's own story (a name link points there, e.g. a nation story).
    if (id === null) map.delete(slug)
    else if (byId.has(id)) map.set(slug, byId.get(id))
    else map.delete(slug) // unknown ids are reported by scripts/check-related-portraits.mjs
  }
  return map
}

/** Story slug -> person with a local portrait (the face shown in Related boxes). */
export function portraitsByStorySlug(relatedData, people, storySubjects = null) {
  return personByStorySlug(relatedData, people, storySubjects, { imageOnly: true })
}

/** Credit text for a portrait (AI credit keeps its '; no known likeness exists' ending). */
export function portraitCreditText(person) {
  return person?.ai ? aiCreditText(person) : creditWithCaption(person, person?.credit || '')
}

/** Initials from a display name (same rules as scripts/people-public.mjs). */
export function initials(name) {
  const parts = String(name || '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/[\s,]+/)
    .map((part) => part.replace(/^\.+|\.+$/g, ''))
    .filter((part) => part && !/^(of|the|and|de|du|jr|sr|ii|iii|iv)$/i.test(part))
  if (!parts.length) return '?'
  const letters = parts.filter((part) => part.length > 1)
  const usable = letters.length ? letters : parts
  if (usable.length === 1) return usable[0].slice(0, 2).toUpperCase()
  return `${usable[0][0]}${usable[usable.length - 1][0]}`.toUpperCase()
}

/** Round headshot, or '' when there is no local image. width/height stay in the 32–40px range. Alt only (no title tooltip); credit lives on the person's story portrait. */
// 96px thumbnails sit beside every 512px portrait (2x+ for a 36px disc, ~4KB instead of ~40KB).
function thumb96(src) {
  return String(src).replace(/-512\.(webp|jpg)$/, '-96.$1')
}

export function headshotHtml(person, size = 36) {
  const ready = localPortrait(person)
  if (!ready) return ''
  const n = Number(size) === 32 || Number(size) === 40 ? Number(size) : 36
  return `<picture class="related-headshot-frame"><source srcset="${esc(thumb96(ready.image.webp))}" type="image/webp"><img class="related-headshot" src="${esc(thumb96(ready.image.jpg))}" width="${n}" height="${n}" alt="${esc(portraitAlt(ready))}" loading="lazy" decoding="async"></picture>`
}

/** 36px deep-green disc with amber initials for a person waiting on a portrait. */
export function initialsDiscHtml(person) {
  const label = initials(person?.name)
  return `<span class="related-initials" aria-hidden="true">${esc(label)}</span>`
}

/** Empty 36px slot so non-person rows line up with face/initials rows. */
export function faceSlotHtml() {
  return `<span class="related-face-slot" aria-hidden="true"></span>`
}

// "Related people & stories" block (empty string when a story has no entries).
/** Story slugs the "Related people & stories" box shows, in order (shared with the Related and nearby dedupe). */
export function relatedBlockItems(data, slug, titleFor, options = {}) {
  const seen = new Set()
  const seenPeople = new Set()
  const personFor = options.personFor instanceof Map ? options.personFor : null
  return (data?.related?.[slug] || []).filter((x) => {
    if (!x?.slug || x.slug === slug || seen.has(x.slug) || !titleFor(x.slug)) return false
    seen.add(x.slug)
    // One person once per box (two stories about the same person keep the first link).
    const pid = personFor?.get(x.slug)?.id
    if (pid) {
      if (seenPeople.has(pid)) return false
      seenPeople.add(pid)
    }
    return true
  })
}

export function relatedBlockSlugs(data, slug, titleFor, options = {}) {
  return relatedBlockItems(data, slug, titleFor, options).map((x) => x.slug)
}

/** Canonical 96px portrait for a person card, or '' when the person has no local portrait. */
export function portraitThumbSrc(person) {
  const ready = localPortrait(person)
  return ready ? thumb96(ready.image.jpg) : ''
}

// "Related people & stories" block (empty string when a story has no entries).
export function relatedBlockHtml(data, slug, titleFor, headingId = 'storyRelatedH', options = {}) {
  const personFor = options.personFor instanceof Map ? options.personFor : null
  const items = relatedBlockItems(data, slug, titleFor, options)
  if (!items.length) return ''
  const hid = String(headingId || 'storyRelatedH').replace(/[^\w-]/g, '') || 'storyRelatedH'
  const portraits = options.portraits instanceof Map ? options.portraits : new Map()
  const linkFor = options.linkFor || ((s) => `#timeline/${encodeURIComponent(s)}`)
  const lis = items
    .map((x) => {
      const href = esc(linkFor(x.slug))
      const title = esc(titleFor(x.slug))
      const note = x.label ? ` <span class="related-note">— ${esc(x.label)}</span>` : ''
      const person = personFor?.get(x.slug) || null
      const shot = headshotHtml(portraits.get(x.slug))
      // Face, pending-person initials disc, or empty 36px slot — every row shares the same left edge.
      const face = shot || (person ? initialsDiscHtml(person) : faceSlotHtml())
      return `<li class="related-row"><a class="related-row-link" href="${href}">${face}<span class="related-person-text"><span class="related-title">${title}</span>${note}</span></a></li>`
    })
    .join('')
  return `<aside class="story-related" aria-labelledby="${hid}"><h3 id="${hid}">Related people &amp; stories</h3><ul>${lis}</ul></aside>`
}

// Link the first mention of each known person (when they have their own story) inside the story body.
export function linkPeopleInBody(root, data, slug, titleFor) {
  const people = Object.entries(data?.people || {}).sort((a, b) => b[0].length - a[0].length)
  if (!root || !people.length) return
  const done = new Set() // target slugs already linked in this story
  for (const a of root.querySelectorAll('a.person-link[href^="#timeline/"]')) {
    try {
      done.add(decodeURIComponent(a.getAttribute('href').slice(10))) // build-time links (story-people.json)
    } catch {
      /* ignore */
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    // Never inside links, code or headings (SEO: no links in h1–h6); at most MAX_LINKS_PER_BLOCK
    // person links per paragraph or list item (critique #280).
    acceptNode: (n) => (n.parentElement.closest('a, code, pre, button, h1, h2, h3, h4, h5, h6') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const block = node.parentElement?.closest('p, li, blockquote, td, th, dd, dt')
    if (block && block.querySelectorAll('a.person-link').length >= MAX_LINKS_PER_BLOCK) continue
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

// ---- Story subject portrait (static /stories/ pages and the map app reader share this) ----

const SAFE_PORTRAIT = { webp: /^\/people\/portraits\/[\w.-]+\.webp$/, jpg: /^\/people\/portraits\/[\w.-]+\.jpg$/ }

/** True when both files are self-hosted portraits (same rule for webp and jpg). */
export function hasSafePortrait(person) {
  return SAFE_PORTRAIT.webp.test(String(person?.image?.webp || '')) && SAFE_PORTRAIT.jpg.test(String(person?.image?.jpg || ''))
}

/**
 * Main subject of a story: related-people.json maps the person's name to this story, or a
 * people.json story slug equals (or starts with) the person id. More than one match → skip.
 * If neither finds anyone, the build-time title map (people.json storySubjects: full name or alias (Capt. Robert
 * Johnson and Big Crossing Station → robert-johnson) is used; a name followed by a place word (Red Bird
 * River, Boone County) does not count. The portrait shows even when the Photos box has the same
 * image (Shannon, Oct 13).
 * Returns { person, reason }.
 */
/**
 * Slug-prefix matches that are not the story's subject. The Red Bird River petroglyphs story is
 * about a carved rock; the "legendary Cherokee chief Red Bird" is only the marker's attribution.
 */
const NOT_SUBJECT = { 'red-bird-river-petroglyphs-clay-county': ['red-bird'] }
export const PLACE_WORD = /^\s*(?:'s\s+|’s\s+)?(?:river|creek|county|forest|national|state|park|lake|road|trace|trail|bridge|school|college|university|hall|church|springs?|fork|branch|bend|mountain|gap|ferry|street|avenue|memorial|monument|dam|cave|island|mill|house|home|farm|estate|station)\b/i
const escRe = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Build time only (scripts/build-people.mjs): people named in a story title by full name or
 * alias. Multi-word names match case-insensitively; one-word names (Blackfish, Hokoleskwa) only
 * with exact case. A name followed by a place word (Red Bird River, Boone County) does not count.
 */
export function titlePeople(people, title, slug = '') {
  const t = String(title || '')
  const out = []
  for (const p of people || []) {
    if ((NOT_SUBJECT[slug] || []).includes(p.id)) continue
    for (const n of [p.name, ...(p.aliases || [])].filter(Boolean)) {
      const one = String(n).trim().split(/\s+/).length < 2
      const m = new RegExp(`(?:^|[^\\w])${escRe(n)}(?![\\w])`, one ? '' : 'i').exec(t)
      if (!m || PLACE_WORD.test(t.slice(m.index + m[0].length))) continue
      out.push({ person: p, via: n === p.name ? 'name' : `alias:${n}` })
      break
    }
  }
  return out
}

/** slug → person id for stories whose title names exactly one person (ids only; aliases stay private). */
export function buildStorySubjects(people, stories) {
  const map = {}
  for (const st of stories || []) {
    const hits = titlePeople(people, st.title, st.slug)
    if (hits.length === 1) map[st.slug] = hits[0].person.id
  }
  return map
}

export function storySubject(relatedData, people, story, storySubjects = null) {
  const slug = story?.slug
  if (!slug || !Array.isArray(people)) return { person: null, reason: '' }
  const withImage = people.filter(hasSafePortrait)
  const hits = new Map()
  for (const [name, target] of Object.entries(relatedData?.people || {})) {
    if (target !== slug) continue
    const p = withImage.find((x) => normName(x.name) === normName(name)) || withImage.find((x) => normName(x.name) === rankless(name))
    if (p) hits.set(p.id, p)
  }
  for (const p of withImage) {
    if ((p.stories || []).some((s) => s === slug && (s === p.id || s.startsWith(`${p.id}-`)))) hits.set(p.id, p)
  }
  for (const id of NOT_SUBJECT[slug] || []) hits.delete(id)
  if (!hits.size && storySubjects?.[slug]) {
    const p = withImage.find((x) => x.id === storySubjects[slug])
    if (p) hits.set(p.id, p)
  }
  if (!hits.size) return { person: null, reason: '' }
  if (hits.size > 1) return { person: null, reason: `ambiguous: ${[...hits.keys()].join('/')}` }
  const person = [...hits.values()][0]
  return { person, reason: '' }
}

/** Newspaper-style portrait floated right of the first paragraph; name-first caption with credit. */
export function storyPortraitHtml(person) {
  if (!person || !hasSafePortrait(person)) return ''
  const credit = portraitCreditText(person)
  const inner = creditHtml(credit, esc)
  const linked = /^https:\/\//i.test(person.creditUrl || '')
    ? `<a href="${esc(person.creditUrl)}" target="_blank" rel="noopener noreferrer">${inner}<span class="visually-hidden"> (opens in a new tab)</span></a>`
    : inner
  return `<figure class="story-portrait"><picture><source srcset="${esc(person.image.webp)}" type="image/webp"><img src="${esc(person.image.jpg)}" width="200" height="200" alt="${esc(portraitAlt(person))}" loading="lazy" decoding="async"></picture><figcaption><span class="story-portrait-name">${esc(person.name)}</span> <span class="story-portrait-credit">${linked}</span></figcaption></figure>`
}

