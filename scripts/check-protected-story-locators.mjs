#!/usr/bin/env node
/**
 * Protected stories stay county-level. Fails when a protected story's title, summary,
 * body, prerendered meta description or JSON-LD gives a locator:
 *   - a distance plus a compass direction ("several miles to the southeast")
 *   - "near <Town>"
 *   - a named creek, river, lake or fork ("Strodes Creek", "the Green River")
 * Link targets are ignored (other stories' slugs may contain those words).
 * Ids come from dist/data/web/protected-pins.json; run after prerender.
 * scripts/protected-locators-pending.json lists known hits awaiting KY History's exact
 * wording (or judged intra-site, e.g. distance between a site's own mounds). Any hit not
 * listed there fails; listed entries that no longer occur are reported as stale.
 * Regenerate that list only with --write-pending after a ruling.
 */
import fs from 'node:fs'
import path from 'node:path'

const UNIT = String.raw`(?:miles?|mi\.|kilometers?|kilometres?|km|meters?|metres?|feet|ft|yards?)`
const DIR = String.raw`(?:north|south|east|west)(?:east|west)?(?:ward|erly)?|upriver|downriver|upstream|downstream`
export const LOCATOR_RES = [
  ['distance+direction', new RegExp(String.raw`\b${UNIT}(?:\s+(?:to|of|the|away|or\s+so)){0,3}\s+(?:${DIR})\b`, 'i')],
  ['near <Town>', /\bnear\s+(?:the\s+)?(?:town\s+of\s+|city\s+of\s+)?[A-Z][a-z]+/],
  ['named water feature', /\b(?:[A-Z][a-z]+\s+){1,3}(?:Creek|River|Lake|Fork|Forks)\b|\b(?:Lake|River)\s+[A-Z][a-z]+/],
]

export function stripLinkTargets(s) {
  return String(s || '').replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, '')
}
export function findLocator(text) {
  const t = stripLinkTargets(text)
  for (const [kind, re] of LOCATOR_RES) { const m = t.match(re); if (m) return `${kind}: "${m[0]}"` }
  return null
}

// self-test
const bad = ['several miles to the southeast', 'a few hundred meters south', 'on a ridge near Dover', 'on Strodes Creek', 'above Harts Fork', 'beside the Green River', 'ahead of Kentucky Lake', '12 miles northwest']
const good = ['in Ballard County', 'the [Jonathan site](/stories/jonathan-creek-mississippian-center/)', 'in western Kentucky', 'the Ohio Valley', 'Mississippian culture', 'about 2 miles of track. In June']
for (const s of bad) if (!findLocator(s)) throw new Error(`self-test: should flag "${s}"`)
for (const s of good) if (findLocator(s)) throw new Error(`self-test: should not flag "${s}"`)

// TODO(protected titles follow-up PR): these protected stories outside #346 still have locating
// display titles awaiting KY History's exact wording. Their titles (and the title copies in meta and
// JSON-LD) are skipped until that PR lands (list: item88 protected-titles-followup.md, Task B); summary, body and description are still checked.
export const TITLE_ALLOWLIST = new Set([
  'muir-site-early-fort-ancient-on-a-jessamine-ridge',
  'peter-village-early-woodland-enclosure-near-lexington',
  'peter-village-enclosure-15fa166',
  'singer-hieronymus-fort-ancient-villages-on-north-elkhorn',
  'old-fort-earthworks-15gp1-greenup-county',
  'tinsley-hill-15ly18-lyon-county',
  'rowlandton-mound-site-15mcn3-paducah',
  'the-c-and-o-mounds-at-paintsville',
  'lower-shawneetown-at-the-scioto-mouth',
  'indian-knoll-on-the-green-river',
])
const root = process.cwd()
const dist = path.join(root, 'dist')
const ids = new Set(JSON.parse(fs.readFileSync(path.join(dist, 'data/web/protected-pins.json'), 'utf8')).ids || [])
if (!ids.size) throw new Error('check-protected-story-locators: protected-pins.json has no ids')
const dir = path.join(root, 'public/content/stories')
const errors = []
let n = 0
const html = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json')) continue
  const slug = f.slice(0, -5)
  if (!ids.has(slug)) continue
  n++
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const fields = { title: d.title, summary: d.summary, body: d.bodyMarkdown }
  const page = path.join(dist, 'stories', slug, 'index.html')
  if (fs.existsSync(page)) {
    const h = fs.readFileSync(page, 'utf8')
    fields.meta = [...h.matchAll(/<meta[^>]+(?:name|property)="(?:description|og:description|twitter:description|og:title|twitter:title)"[^>]*content="([^"]*)"/g)].map((m) => html(m[1])).join(' | ')
    fields.jsonld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join(' ')
  }
  if (TITLE_ALLOWLIST.has(slug)) {
    delete fields.title
    for (const k of ['meta', 'jsonld']) if (fields[k]) fields[k] = fields[k].split(d.title).join(' ')
  }
  for (const [k, v] of Object.entries(fields)) {
    const hit = findLocator(v)
    if (hit) errors.push(`${slug}.${k}: ${hit}`)
  }
}
const pendingFile = path.join(root, 'scripts/protected-locators-pending.json')
if (process.argv.includes('--write-pending')) {
  fs.writeFileSync(pendingFile, JSON.stringify({ note: 'Known locator hits in protected stories awaiting KY History wording or judged intra-site. Do not add entries without a ruling.', pending: errors.sort() }, null, 2) + '\n')
  console.log(`check-protected-story-locators: wrote ${errors.length} pending entries`)
  process.exit(0)
}
const pending = new Set(fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile, 'utf8')).pending : [])
const fresh = errors.filter((e) => !pending.has(e))
const stale = [...pending].filter((e) => !errors.includes(e))
if (stale.length) console.log(`check-protected-story-locators: ${stale.length} pending entr${stale.length === 1 ? 'y' : 'ies'} no longer occur (remove from pending):\n` + stale.join('\n'))
errors.length = 0
errors.push(...fresh)
if (errors.length) { console.error(`check-protected-story-locators: ${errors.length} locator(s) in protected stories\n` + errors.join('\n')); process.exit(1) }
console.log(`check-protected-story-locators: ${n} protected stories, no new locators in title, summary, body, meta or JSON-LD (${pending.size} pending a ruling)`)
