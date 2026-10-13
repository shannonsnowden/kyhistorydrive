#!/usr/bin/env node
/** Fails the build unless dist/stories/index.html exists and links every prerendered /stories/<slug>/ page. */
import fs from 'node:fs'
import path from 'node:path'

const dir = path.join('dist', 'stories')
const file = path.join(dir, 'index.html')
const errors = []
if (!fs.existsSync(file)) {
  console.error('check-stories-index: dist/stories/index.html is missing')
  process.exit(1)
}
const html = fs.readFileSync(file, 'utf8')
const slugs = fs.readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'index.html')))
  .map((d) => d.name)
if (slugs.length < 100) errors.push(`expected at least 100 story pages, found ${slugs.length}`)
const linked = new Set([...html.matchAll(/<a (?:class="[^"]*" )?href="\/stories\/([a-z0-9-]+)\/">/g)].map((m) => m[1]))
for (const slug of slugs) if (!linked.has(slug)) errors.push(`/stories/ does not link ${slug}`)
for (const slug of linked) if (!slugs.includes(slug)) errors.push(`/stories/ links ${slug}, which has no page`)
if ((html.match(/<h1[\s>]/g) || []).length !== 1) errors.push('/stories/ must have exactly one h1')
const need = [
  [/<header class="top site-header">/, 'site header'],
  [/<link rel="canonical" href="https:\/\/[^"]+\/stories\/" \/>/, 'canonical'],
  [/"@type":\s*"CollectionPage"/, 'CollectionPage JSON-LD'],
  [/"@type":\s*"ItemList"/, 'ItemList JSON-LD'],
  [/"@type":\s*"BreadcrumbList"/, 'BreadcrumbList JSON-LD'],
]
for (const [re, what] of need) if (!re.test(html)) errors.push(`/stories/ is missing the ${what}`)
const sitemap = fs.readFileSync(path.join('dist', 'sitemap.xml'), 'utf8')
if (!/<loc>https:\/\/[^<]+\/stories\/<\/loc>/.test(sitemap)) errors.push('sitemap is missing /stories/')
if (errors.length) {
  for (const e of errors) console.error('check-stories-index: ' + e)
  process.exit(1)
}
console.log(`check-stories-index: /stories/ lists all ${slugs.length} stories`)
