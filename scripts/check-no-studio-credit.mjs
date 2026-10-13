#!/usr/bin/env node
/**
 * Read-only check (Shannon, Oct 13): the site never credits the internal art desk by name.
 * Fails when the banned name appears in any built HTML credit, caption, alt or title (checked as
 * anywhere in the built HTML, which covers all four), or in any file under dist/data, public/data,
 * or the people JSON (data/people.json, public/data/people.json).
 *
 * Also (Editor, Oct 13): every AI portrait flagged as having no known likeness (its people.json
 * credit ends '; no known likeness exists') must show that ending wherever dist renders the
 * portrait with a visible credit (story figures, Related people, /people/ cards). Alt-only
 * headshots carry no credit and are skipped. AI people whose research record says
 * likeness 'none-known' but lack the ending fail the build.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BANNED = ['story', 'studio'].join(' ') // split so this file never matches itself
const hits = []

function walk(dir, filter) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, filter))
    else if (filter(entry.name)) out.push(full)
  }
  return out
}

function scan(file) {
  const text = fs.readFileSync(file, 'utf8').toLowerCase()
  let at = text.indexOf(BANNED)
  let count = 0
  while (at >= 0) {
    count += 1
    at = text.indexOf(BANNED, at + BANNED.length)
  }
  if (count) hits.push(`${path.relative(root, file)} (${count})`)
}

const textFile = (n) => /\.(html|json|geojson|xml|txt|js|csv)$/i.test(n)
const files = new Set([
  ...walk(path.join(root, 'dist'), (n) => n.endsWith('.html')),
  ...walk(path.join(root, 'dist/data'), textFile),
  ...walk(path.join(root, 'public/data'), textFile),
  path.join(root, 'data/people.json'),
  path.join(root, 'public/data/people.json'),
])
let scanned = 0
for (const file of files) {
  if (!fs.existsSync(file)) continue
  scanned += 1
  scan(file)
}

// No-likeness credit ending.
const NOTE = '; no known likeness exists'
const SHOWN = 'no known likeness exists'
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const research = new Map((readJson('data/people.json').people || []).map((p) => [p.id, p]))
const pub = readJson('public/data/people.json').people || []
const flagged = pub.filter((p) => p.ai && String(p.credit || '').trim().endsWith(NOTE))
const likenessHits = []
const unflagged = pub.filter((p) => p.ai && !flagged.includes(p) && research.get(p.id)?.likeness === 'none-known').map((p) => p.id)
const htmlFiles = walk(path.join(root, 'dist'), (n) => n.endsWith('.html')).map((f) => [f, fs.readFileSync(f, 'utf8')])
const ENDS = ['</figure>', '</li>', '</article>']
let rendered = 0
for (const p of flagged) {
  const needle = `/people/portraits/${p.id}__ai-portrait-`
  for (const [file, html] of htmlFiles) {
    for (let at = html.indexOf(needle); at >= 0; ) {
      let end = html.length
      for (const e of ENDS) {
        const i = html.indexOf(e, at)
        if (i >= 0 && i < end) end = i
      }
      const seg = html.slice(at, Math.min(end, at + 4000))
      if (/credit/i.test(seg) && !/<meta\b/i.test(html.slice(Math.max(0, at - 200), at))) {
        rendered += 1
        if (!seg.includes(SHOWN)) likenessHits.push(`${path.relative(root, file)}: ${p.id}`)
      }
      // Skip the rest of this element (srcset and img repeat the path).
      const next = html.indexOf(needle, Math.min(end, at + 4000))
      at = next
    }
  }
  if (!rendered) likenessHits.push(`${p.id}: no rendered credit found in dist`)
  rendered = 0
}
if (unflagged.length) likenessHits.push(...unflagged.map((id) => `data/people.json: ${id} is likeness 'none-known' but its credit lacks '${NOTE}'`))
if (likenessHits.length) {
  console.error(`check-no-studio-credit: ${likenessHits.length} no-likeness credit problems (each needs '${SHOWN}'):`)
  for (const h of [...new Set(likenessHits)]) console.error(`  ${h}`)
  process.exit(1)
}
console.log(`check-no-studio-credit: no-likeness ending present for ${flagged.map((p) => p.id).join(', ')}`)

if (hits.length) {
  console.error(`check-no-studio-credit: "${BANNED}" appears in ${hits.length} shipped files; credit AI art as "AI illustration · Kentucky History Drive":`)
  for (const h of hits) console.error(`  ${h}`)
  process.exit(1)
}
console.log(`check-no-studio-credit: ${scanned} files clean`)
