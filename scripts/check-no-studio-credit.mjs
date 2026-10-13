#!/usr/bin/env node
/**
 * Read-only check (Shannon, Oct 13): the site never credits the internal art desk by name.
 * Fails when the banned name appears in any built HTML credit, caption, alt or title (checked as
 * anywhere in the built HTML, which covers all four), or in any file under dist/data, public/data,
 * or the people JSON (data/people.json, public/data/people.json).
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

if (hits.length) {
  console.error(`check-no-studio-credit: "${BANNED}" appears in ${hits.length} shipped files; credit AI art as "AI illustration · Kentucky History Drive":`)
  for (const h of hits) console.error(`  ${h}`)
  process.exit(1)
}
console.log(`check-no-studio-credit: ${scanned} files clean`)
