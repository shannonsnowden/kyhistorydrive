import { portraitAlt, creditWithCaption } from './portrait-captions.js'

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
  return `<picture class="related-headshot-frame"><source srcset="${esc(ready.image.webp)}" type="image/webp"><img class="related-headshot" src="${esc(ready.image.jpg)}" width="${n}" height="${n}" alt="${esc(portraitAlt(ready))}" loading="lazy" decoding="async"></picture>`
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
const PLACE_WORD = /^\s*(?:'s\s+|’s\s+)?(?:river|creek|county|forest|national|state|park|lake|road|trace|trail|bridge|school|college|university|hall|church|springs?|fork|branch|bend|mountain|gap|ferry|street|avenue|memorial|monument|dam|cave|island|mill|house|home|farm|estate|station)\b/i
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
  const credit = person.ai ? `AI illustration · ${person.credit || 'Kentucky History Drive'}` : creditWithCaption(person, person.credit || '')
  return `<figure class="story-portrait"><picture><source srcset="${esc(person.image.webp)}" type="image/webp"><img src="${esc(person.image.jpg)}" width="200" height="200" alt="${esc(portraitAlt(person))}" decoding="async"></picture><figcaption><span class="story-portrait-name">${esc(person.name)}</span> <span class="story-portrait-credit">${esc(credit)}</span></figcaption></figure>`
}

