#!/usr/bin/env node
/**
 * Protected stories stay county-level. Every locator hit in every protected field fails
 * unless it is listed exactly (slug, field, matched text, enclosing sentence, count) in
 * scripts/protected-locators-pending.json. Kinds:
 *   - a distance plus a compass direction ("several miles to the southeast", "3_miles-north")
 *   - "near <Town>"
 *   - a landform or water feature word (ridge, bluff, creek, river, fork, lake, knob, hollow,
 *     branch, gorge, cliff, bend, shoal, island, mountain, bottom; Springs, Falls, Run, Lick, Hill)
 *   - a route number (KY 66, US-60, I-64, Route 8, Highway 1247)
 * Words are matched across space, "_" and "-" (so slugs and URLs count) and link targets are
 * NOT skipped. Fields scanned for each protected id (dist/data/web/protected-pins.json):
 *   source title, summary, body; dist/stories/<slug>/story.md; the prerendered page's meta,
 *   JSON-LD, <title>, image alt text and captions; and every string under the slug's entries in
 *   dist content/stories.json, data/app/ky-history.json, content/story-photos.json and
 *   data/search-index.json. Run after prerender.
 * The pending list may only hold text that is byte-identical on origin/v2 (inherited text awaiting
 * the protected-titles/locators cleanup PR). Because entries carry the enclosing sentence and a
 * count, new locating text added to an allowlisted field still fails. Stale entries are reported.
 * --write-pending regenerates the list (only after verifying every entry against origin/v2).
 */
import fs from 'node:fs'
import path from 'node:path'

const SEP = String.raw`[\s_-]+`
const L = String.raw`(?<![A-Za-z])`
const R = String.raw`(?![A-Za-z])`
const UNIT = String.raw`(?:miles?|mi\.|kilometers?|kilometres?|km|meters?|metres?|feet|foot|ft|yards?)`
const DIR = String.raw`(?:north|south|east|west)(?:east|west)?(?:ward|erly)?|upriver|downriver|upstream|downstream`
const LANDFORM_I = String.raw`ridges?|bluffs?|creeks?|rivers?|forks?|lakes?|knobs?|hollows?|branch(?:es)?|gorges?|cliffs?|bends?|shoals?|islands?|mountains?|bottoms?`
const LANDFORM_C = String.raw`Springs?|Falls|Run|Licks?|Hills?`
export const LOCATOR_RES = [
  ['distance+direction', new RegExp(String.raw`${L}${UNIT}(?:${SEP}(?:to|of|the|away|or${SEP}so)){0,3}${SEP}(?:${DIR})${R}`, 'gi')],
  ['near <Town>', new RegExp(String.raw`${L}[Nn]ear${SEP}(?:the${SEP})?(?:town${SEP}of${SEP}|city${SEP}of${SEP})?[A-Z][a-z]+`, 'g')],
  ['landform', new RegExp(String.raw`${L}(?:${LANDFORM_I})${R}`, 'gi')],
  ['landform', new RegExp(String.raw`${L}(?:${LANDFORM_C})${R}`, 'g')],
  ['route number', new RegExp(String.raw`${L}(?:KY|US|SR|Hwy|Highway|Route|Rte\.?)${SEP}?\d{1,4}${R}(?!\d)`, 'gi')],
  ['route number', new RegExp(String.raw`${L}I${SEP}?\d{2,3}(?!\d)`, 'g')],
]

/** Sentence (or line) enclosing [i, j) in s. */
export const CONTEXT_CAP = 400
export function contextOf(s, i, j) {
  // Capped window (#346 Security): never walk further than CONTEXT_CAP chars each way, so many
  // hits in one long unpunctuated string stay linear instead of quadratic.
  const lo = Math.max(0, i - CONTEXT_CAP)
  const hi = Math.min(s.length, j + CONTEXT_CAP)
  let a = i
  while (a > lo && s[a - 1] !== '\n' && !(/[.!?]/.test(s[a - 2] || '') && /\s/.test(s[a - 1]))) a--
  let b = j
  while (b < hi && s[b] !== '\n' && !(/[.!?]/.test(s[b]) && (b + 1 >= s.length || /\s/.test(s[b + 1])))) b++
  if (b < hi && s[b] !== '\n') b++
  return s.slice(a, b).trim()
}
/** Context key with markdown link targets dropped, so an approved link swap (e.g. Wikipedia to
 * Grokipedia) does not orphan an entry; the hit itself, including hits inside a target, still counts. */
export const linkText = (s) => s.replace(/\]\([^)\s]*(?:\([^)\s]*\)[^)\s]*)*\)/g, ']')
/** Every hit in a text, each with its kind, match and enclosing sentence. */
// Official site names that contain a landform word, approved verbatim by KY History (not a locator
// by themselves). Matches inside these names are skipped; everything else in the field still counts.
export const APPROVED_NAMES = [
  new RegExp(String.raw`Red${SEP}Bird${SEP}River${SEP}Petroglyphs`, 'gi'),
  // KY History verbatim (2026-10-24): names the separate site without locating it; exact phrase only
  /Red Bird River Shelter \(15CY52\)/g,
]
export function findLocators(text) {
  const s = String(text || '')
  const out = []
  const skip = APPROVED_NAMES.flatMap((re) => [...s.matchAll(re)].map((m) => [m.index, m.index + m[0].length]))
  for (const [kind, re] of LOCATOR_RES) {
    for (const m of s.matchAll(re)) if (!skip.some(([a, b]) => m.index >= a && m.index < b)) out.push({ kind, match: m[0], context: linkText(contextOf(s, m.index, m.index + m[0].length)) })
  }
  return out
}
/** JSON-LD as one line per text value, with volatile fields (dateModified, datePublished, other
 * dates, version) dropped, so pending entries are keyed on the text itself, not on build metadata. */
export const VOLATILE_KEY = /^(?:date[A-Z]\w*|\w*Date|version|sdDatePublished)$/
export function jsonldText(src) {
  const out = []
  const walk = (v, k) => {
    if (k && VOLATILE_KEY.test(k)) return
    if (typeof v === 'string') out.push(v.replace(/\s*\n\s*/g, ' '))
    else if (Array.isArray(v)) v.forEach((x) => walk(x, null))
    else if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) walk(x, kk)
  }
  walk(JSON.parse(src), null)
  return out.join('\n')
}
export const keyOf = (e) => JSON.stringify([e.slug, e.field, e.match, e.context])
/** Hits per key vs allowed counts; returns { fresh, stale }. */
export function compare(hits, entries) {
  const allowed = new Map(entries.map((e) => [keyOf(e), e.count || 1]))
  const seen = new Map()
  for (const h of hits) seen.set(keyOf(h), (seen.get(keyOf(h)) || 0) + 1)
  const fresh = []
  for (const [k, c] of seen) if (c > (allowed.get(k) || 0)) fresh.push({ k, extra: c - (allowed.get(k) || 0) })
  const stale = [...allowed.keys()].filter((k) => !seen.has(k))
  return { fresh, stale }
}
const hitsFor = (slug, field, text) => findLocators(text).map((h) => ({ slug, field, ...h }))

// self-test
{ // JSON-LD keys must not depend on volatile fields
  const a = jsonldText('{"@graph":[{"description":"Near Walton in Boone County.","dateModified":"2026-10-19"}]}')
  const b = jsonldText('{"@graph":[{"description":"Near Walton in Boone County.","dateModified":"2026-10-24","datePublished":"2026-10-01"}]}')
  if (a !== b || keyOf(hitsFor('x', 'jsonld', a)[0]) !== keyOf(hitsFor('x', 'jsonld', b)[0])) throw new Error('self-test: JSON-LD key changed with dateModified')
}
const bad = ['several miles to the southeast', 'a few hundred meters south', 'on a ridge near Dover', 'on Strodes Creek', 'above Harts Fork', 'beside the Green River', 'ahead of Kentucky Lake', '12 miles northwest', 'https://x.org/wiki/Red_River', '/stories/jonathan-creek-center/', '3_miles-north', 'on a high bluff', 'in a hollow', 'at Big Bone Lick', 'Mill Run', 'KY 66', 'ky-66', 'US 60', 'I-64', 'Route 8', 'Highway 1247', 'the Red Bird River Petroglyphs above the Red Bird River']
const good = ['in Ballard County', 'the Jonathan site', 'in western Kentucky', 'the Ohio Valley', 'Mississippian culture', 'about 2 miles of track. In June', 'Riverside', 'in the spring of 1780', 'the water runs out', 'in 1966', 'Kentucky 1994', 'The Red Bird River Petroglyphs in Clay County', 'red_bird_river_petroglyphs']
for (const s of bad) if (!findLocators(s).length) throw new Error(`self-test: should flag "${s}"`)
for (const s of good) if (findLocators(s).length) throw new Error(`self-test: should not flag "${s}"`)
if (findLocators('Up the Green River and Pond Creek, 5 miles north.').length !== 3) throw new Error('self-test: must report every hit in a field')
{ // injection: an allowlisted field must still fail when new locating text is added to it
  const base = 'The village sat beside the Green River. It was dug in 1939.'
  const allow = hitsFor('x', 'body', base).map((h) => ({ ...h, count: 1 }))
  if (compare(hitsFor('x', 'body', base), allow).fresh.length) throw new Error('self-test: allowlisted text should pass')
  for (const inj of [base + ' A second camp lay on Pond Creek.', base.replace('Green River.', 'Green River near Smithland.'), base + ' Again, the Green River.', base.replace('1939.', '1939, 2 miles east.'), base.replace('Green River', 'Green River and Mud River')]) {
    if (!compare(hitsFor('x', 'body', inj), allow).fresh.length) throw new Error(`self-test: injection not caught: "${inj}"`)
  }
}

const root = process.cwd()
const dist = path.join(root, 'dist')
const ids = new Set(JSON.parse(fs.readFileSync(path.join(dist, 'data/web/protected-pins.json'), 'utf8')).ids || [])
if (!ids.size) throw new Error('check-protected-story-locators: protected-pins.json has no ids')
const html = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const hits = []
const dir = path.join(root, 'public/content/stories')
const slugs = []
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.json') || !ids.has(f.slice(0, -5))) continue
  const slug = f.slice(0, -5)
  slugs.push(slug)
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const fields = { title: d.title, summary: d.summary, body: d.bodyMarkdown }
  const md = path.join(dist, 'stories', slug, 'story.md')
  if (fs.existsSync(md)) fields['story.md'] = fs.readFileSync(md, 'utf8')
  const page = path.join(dist, 'stories', slug, 'index.html')
  if (fs.existsSync(page)) {
    const h = fs.readFileSync(page, 'utf8')
    fields.meta = [...h.matchAll(/<meta[^>]+content="([^"]*)"[^>]*>/g)].map((m) => html(m[1])).join('\n')
    fields['html-title'] = [...h.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => html(m[1])).join('\n')
    fields.jsonld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => jsonldText(m[1])).join('\n')
    fields.alt = [...h.matchAll(/\balt="([^"]*)"/g)].map((m) => html(m[1])).join('\n')
    fields.caption = [...h.matchAll(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/g)].map((m) => html(m[1].replace(/<[^>]+>/g, ''))).join('\n')
  }
  for (const [k, v] of Object.entries(fields)) hits.push(...hitsFor(slug, k, v))
}
// public JSON: every string under an object whose slug/id is protected, or under a protected key
const PUBLIC_JSON = ['content/stories.json', 'data/app/ky-history.json', 'content/story-photos.json', 'data/search-index.json', 'data/layers/history.geojson', 'data/layers/stories.geojson']
for (const rel of PUBLIC_JSON) {
  const p = path.join(dist, rel)
  if (!fs.existsSync(p)) throw new Error(`check-protected-story-locators: missing dist/${rel}`)
  const walk = (v, owner, pth) => {
    if (typeof v === 'string') { if (owner) hits.push(...hitsFor(owner, `${rel}:${pth}`, v)); return }
    if (!v || typeof v !== 'object') return
    let o = owner
    if (!o && !Array.isArray(v)) for (const k of ['slug', 'id', 'storySlug', 'storyId']) if (typeof v[k] === 'string' && ids.has(v[k])) o = v[k]
    if (Array.isArray(v)) v.forEach((x) => walk(x, o, pth + '[]'))
    else for (const [k, x] of Object.entries(v)) walk(x, o || (ids.has(k) ? k : null), pth + '.' + (ids.has(k) ? '<slug>' : k))
  }
  walk(JSON.parse(fs.readFileSync(p, 'utf8')), null, '')
}

// ---- Wide scan (#346 Security, same reach as #348's check-chambers-locating) ----
// Every dist .json/.geojson/.html/.md/.xml: (a) visible text of a protected story's own outputs and
// every string in a record owned by a protected id; (b) in any other output, the sentence around each
// protected-site mention (slug, title or site number). Wide hits pass only when the same
// [slug, match, context] is already pending (inherited text); nothing new is allowlisted.
export function visibleText(h) {
  const attrs = [...h.matchAll(/\b(?:alt|title|aria-label|content)="([^"]*)"/g)].map((m) => m[1])
  const body = h.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(?:p|li|h\d|div|figcaption|td|tr|item|title|description|summary|article|section)>|<br\s*\/?>/gi, '\n')
    .replace(/<!\[CDATA\[|\]\]>/g, ' ').replace(/<[^>]+>/g, ' ')
  return html([body, ...attrs].join('\n')).replace(/[ \t]+/g, ' ')
}
const mentionTerms = []
for (const id of ids) {
  mentionTerms.push(id)
  const fp = path.join(root, 'public/content/stories', id + '.json')
  if (!fs.existsSync(fp)) continue
  const t = String(JSON.parse(fs.readFileSync(fp, 'utf8')).title || '')
  const site = t.match(/\b15[A-Za-z]{1,2}\d+\b/)
  if (site) mentionTerms.push(site[0])
  const core = t.split(/\s*(?:[:(]|\s\/\s)\s*/)[0].replace(/[“”"]/g, '').trim()
  if (core.length >= 8) mentionTerms.push(core)
}
const termOwner = new Map()
for (const id of ids) {
  termOwner.set(id.toLowerCase(), id)
  const fp = path.join(root, 'public/content/stories', id + '.json')
  if (!fs.existsSync(fp)) continue
  const t = String(JSON.parse(fs.readFileSync(fp, 'utf8')).title || '')
  const site = t.match(/\b15[A-Za-z]{1,2}\d+\b/)
  if (site) termOwner.set(site[0].toLowerCase(), id)
  const core = t.split(/\s*(?:[:(]|\s\/\s)\s*/)[0].replace(/[“”"]/g, '').trim()
  if (core.length >= 8) termOwner.set(core.toLowerCase(), id)
}
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const MENTION_RE = termOwner.size ? new RegExp(`(?<![A-Za-z0-9])(?:${[...termOwner.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![A-Za-z0-9])`, 'gi') : null
/** Locator hits in the sentence around each protected mention in text from an unprotected output. */
export function mentionHits(text, field) {
  const out = []
  if (!MENTION_RE) return out
  const s = String(text)
  for (const m of s.matchAll(MENTION_RE)) {
    const owner = termOwner.get(m[0].toLowerCase())
    const sent = contextOf(s, m.index, m.index + m[0].length)
    // blank every protected-site name/number in the sentence: a site's own name is not a locator
    for (const h of findLocators(sent.replace(MENTION_RE, (x) => ' '.repeat(x.length)))) out.push({ slug: owner, field, wide: true, ...h, context: linkText(sent) })
  }
  return out
}
const wideHits = []
const walkDist = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walkDist(p, out); else if (/\.(?:geo)?json$|\.html?$|\.md$|\.xml$/i.test(e.name)) out.push(p) } return out }
for (const f of walkDist(dist)) {
  const rel = path.relative(dist, f).split(path.sep).join('/')
  const ownFile = [...ids].find((id) => rel.startsWith(`stories/${id}/`) || rel === `content/stories/${id}.json`)
  const raw = fs.readFileSync(f, 'utf8')
  if (/\.(?:geo)?json$/i.test(f)) {
    let data
    try { data = JSON.parse(raw) } catch { continue }
    const walk = (v, owner) => {
      if (typeof v === 'string') {
        v = v.replace(/\]\([^)\s]*\)/g, ']') // markdown link targets are not visible text
        if (owner) wideHits.push(...findLocators(v).map((h) => ({ slug: owner, field: `wide:${rel}`, wide: true, ...h })))
        else wideHits.push(...mentionHits(v, `wide:${rel}`))
        return
      }
      if (!v || typeof v !== 'object') return
      let o = owner
      if (!o && !Array.isArray(v)) {
        for (const k of ['slug', 'id', 'storySlug', 'storyId', 'historyId']) if (typeof v[k] === 'string' && ids.has(v[k])) o = v[k]
        // a record whose name/title is a protected site's name or number is owned by that site
        if (!o) for (const k of ['name', 'title']) if (typeof v[k] === 'string') { MENTION_RE && (MENTION_RE.lastIndex = 0); const m = MENTION_RE && v[k].match(MENTION_RE); if (m) o = termOwner.get(m[0].toLowerCase()) }
      }
      if (Array.isArray(v)) v.forEach((x) => walk(x, o))
      else for (const [k, x] of Object.entries(v)) walk(x, o || (ids.has(k) ? k : null))
    }
    walk(data, ownFile || null)
  } else {
    const text = /\.html?$|\.xml$/i.test(f) ? visibleText(raw) : raw.replace(/\]\([^)\s]*\)/g, ']') // md link targets are not visible text
    if (ownFile) wideHits.push(...findLocators(text).map((h) => ({ slug: ownFile, field: `wide:${rel}`, wide: true, ...h })))
    else {
      // records (li/item/article) whose own text names a protected site are owned by it
      wideHits.push(...mentionHits(text, `wide:${rel}`))
    }
  }
}

// A protected story's own title quoted whole elsewhere (related cards, thumbnails' alt text, nearby
// lists) is a name, not a locator; title locators are still caught in the story's own title field.
const protectedTitles = []
for (const id of ids) {
  const p = path.join(root, 'public/content/stories', `${id}.json`)
  try { const t = JSON.parse(fs.readFileSync(p, 'utf8')).title; if (t) protectedTitles.push([id, t.toLowerCase()]) } catch {}
}
// only ANOTHER protected story's title (cards, thumbnails, nearby lists): its own title stays tracked
// through its own title/meta/html-title entries until the protected-titles cleanup
const inQuotedTitle = (h) => (h.wide || h.field === 'alt') && protectedTitles.some(([id, t]) => id !== h.slug && t.includes(String(h.match).toLowerCase()) && String(h.context).toLowerCase().includes(t))
for (const arr of [hits, wideHits]) { const keep = arr.filter((h) => !inQuotedTitle(h)); arr.length = 0; arr.push(...keep) }
if (process.argv.some((a) => a.startsWith('--emit-wide-keys='))) {
  // run with cwd = a built origin/v2 checkout to list the wide hits v2 already ships
  const out = process.argv.find((a) => a.startsWith('--emit-wide-keys=')).slice(17)
  fs.writeFileSync(out, JSON.stringify([...new Set(wideHits.map((h) => JSON.stringify([h.slug, h.field.replace(/^wide:/, ''), h.match, h.context])))]))
  console.log(`check-protected-story-locators: wrote ${wideHits.length} wide hits to ${out}`)
  process.exit(0)
}
const wideBaselineFile = path.join(root, 'scripts/protected-locators-wide-baseline.json')
const wideKey = (h) => JSON.stringify([h.slug, h.field.replace(/^wide:/, ''), h.match, h.context])
if (process.argv.includes('--write-wide-baseline')) {
  // Baseline = wide hits whose text already exists on origin/v2 (inherited, awaiting the protected
  // cleanup PR). Pass --v2-tree=<dir> holding `git archive origin/v2`. Hits not found there are new
  // and are NOT written: they must be fixed.
  const tree = (process.argv.find((a) => a.startsWith('--v2-tree=')) || '').slice(10)
  if (!tree) throw new Error('--write-wide-baseline needs --v2-tree=<dir>')
  const parts = []
  const walkAll = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walkAll(p); else if (/\.(?:geo)?json$|\.html?$|\.md$|\.xml$|\.mjs$/i.test(e.name)) { const raw = fs.readFileSync(p, 'utf8'); if (/\.(?:geo)?json$/i.test(e.name)) { try { const w = (v) => { if (typeof v === 'string') parts.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(w) }; w(JSON.parse(raw)) } catch { parts.push(raw) } } else parts.push(/\.html?$|\.xml$/i.test(e.name) ? visibleText(raw) : raw) } } }
  walkAll(tree)
  const norm = (x) => linkText(String(x)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const corpus = norm(parts.join('\n'))
  // titles and slugs of stories already on v2: generated wrappers (front matter, cite lines, card
  // titles, URLs) that repeat an inherited title or slug are inherited too
  const v2Names = []
  const v2Stories = path.join(tree, 'public/content/stories')
  if (fs.existsSync(v2Stories)) for (const f of fs.readdirSync(v2Stories)) if (f.endsWith('.json')) { v2Names.push(f.slice(0, -5)); try { const t = JSON.parse(fs.readFileSync(path.join(v2Stories, f), 'utf8')).title; if (t && t.length >= 8) v2Names.push(t) } catch {} }
  const pendingPath = path.join(root, 'scripts/protected-locators-pending.json')
  const pendingMC = new Set((fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath, 'utf8')).entries || [] : []).map((e) => JSON.stringify([e.match, e.context])))
  const v2KeysArg = process.argv.find((a) => a.startsWith('--v2-keys='))
  const v2Keys = new Set(v2KeysArg ? JSON.parse(fs.readFileSync(v2KeysArg.slice(10), 'utf8')) : [])
  const keep = new Map()
  const fresh = []
  for (const h of wideHits) {
    // probe: the hit plus up to 25 chars each side, clipped at card separators, so composite card
    // text ("Title Story · County · …") is checked piece by piece against v2's source strings
    const c = norm(h.context).replace(/…$/, '').replace(/^>\s*/, '')
    const i = c.indexOf(h.match)
    let probe = i < 0 ? c.slice(0, 160) : c.slice(Math.max(0, i - 25), i + h.match.length + 25)
    if (i >= 0) { const pre = c.slice(Math.max(0, i - 25), i); const post = c.slice(i, i + h.match.length + 25); probe = pre.split(' · ').pop().split('Thumbnail for ').pop() + post.split(' · ')[0] }
    const inName = v2Names.some((n) => n.toLowerCase().includes(h.match.toLowerCase()) && c.toLowerCase().includes(n.toLowerCase()))
    if (v2Keys.has(wideKey(h)) || pendingMC.has(JSON.stringify([h.match, h.context])) || inName || corpus.includes(probe.trim())) keep.set(wideKey(h), { slug: h.slug, field: h.field.replace(/^wide:/, ''), kind: h.kind, match: h.match, context: h.context })
    else fresh.push(wideKey(h))
  }
  fs.writeFileSync(wideBaselineFile, JSON.stringify({ note: 'Wide-scan locator text inherited byte-identical from origin/v2 (protected-titles/locators cleanup PR, TODO). Generated with --write-wide-baseline; nothing new may be added by hand.', entries: [...keep.values()].sort((x, y) => wideKey(x).localeCompare(wideKey(y))) }, null, 2) + '\n')
  console.log(`check-protected-story-locators: wide baseline ${keep.size} inherited entries; ${new Set(fresh).size} not on origin/v2 (fix these):\n` + [...new Set(fresh)].join('\n'))
  process.exit(0)
}
const pendingFile = path.join(root, 'scripts/protected-locators-pending.json')
if (process.argv.includes('--write-pending')) {
  const m = new Map()
  for (const h of hits) { const k = keyOf(h); if (m.has(k)) m.get(k).count++; else m.set(k, { slug: h.slug, field: h.field, kind: h.kind, match: h.match, context: h.context, count: 1 }) }
  const entries = [...m.values()].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
  fs.writeFileSync(pendingFile, JSON.stringify({ note: 'Inherited locator text in protected stories, byte-identical on origin/v2, awaiting the protected-titles/locators cleanup PR (TODO). Nothing new may be added here.', entries }, null, 2) + '\n')
  console.log(`check-protected-story-locators: wrote ${entries.length} entries over ${new Set(entries.map((e) => e.slug)).size} slugs`)
  process.exit(0)
}
const entries = fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile, 'utf8')).entries || [] : []
const { fresh, stale } = compare(hits, entries)
// wide hits: pass only if the same [slug, match, context] is already pending (inherited text)
const inherited = new Set(entries.map((e) => JSON.stringify([e.slug, e.match, e.context])))
const wideBaseline = new Set((fs.existsSync(wideBaselineFile) ? JSON.parse(fs.readFileSync(wideBaselineFile, 'utf8')).entries || [] : []).map(wideKey))
const wideFresh = new Map()
for (const h of wideHits) {
  const k = JSON.stringify([h.slug, h.match, h.context])
  if (!inherited.has(k) && !wideBaseline.has(wideKey(h))) wideFresh.set(JSON.stringify([h.slug, h.field, h.match, h.context]), h)
}
for (const k of wideFresh.keys()) fresh.push({ k, extra: 1 })
if (stale.length) console.log(`check-protected-story-locators: ${stale.length} pending entr${stale.length === 1 ? 'y' : 'ies'} no longer occur (remove from pending):\n` + stale.join('\n'))
if (fresh.length) {
  console.error(`check-protected-story-locators: ${fresh.length} new locator(s) in protected stories\n` + fresh.map((f) => `${f.k}${f.extra > 1 ? ` x${f.extra}` : ''}`).join('\n'))
  process.exit(1)
}
console.log(`check-protected-story-locators: ${slugs.length} protected stories, ${hits.length} hits scanned, all exact-listed (${entries.length} pending entries over ${new Set(entries.map((e) => e.slug)).size} slugs)`)
