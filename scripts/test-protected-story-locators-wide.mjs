#!/usr/bin/env node
// #346 Security: check-protected-story-locators must scan every dist json/geojson/html/md/xml,
// visible text (<p> etc.), and text in unprotected outputs next to a protected-site mention.
// Each planted case must exit non-zero; the clean fixture must exit 0.
// All sites, towns and landforms here are fictional (no real protected name or nearby place).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const script = path.resolve('scripts/check-protected-story-locators.mjs')
const w = (root, rel, data) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data)) }
function fixture(extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psl-'))
  w(root, 'dist/data/web/protected-pins.json', { ids: ['xeno-site-15zz1'] })
  w(root, 'public/content/stories/xeno-site-15zz1.json', { title: 'Xeno Site (15Zz1)', summary: 'In Foo County, a village.', bodyMarkdown: 'In Foo County, a village.' })
  w(root, 'public/content/stories/other-story.json', { title: 'Other', summary: 'Other.', bodyMarkdown: 'Other.' })
  for (const rel of ['content/stories.json', 'data/app/ky-history.json', 'content/story-photos.json', 'data/search-index.json', 'data/layers/history.geojson', 'data/layers/stories.geojson']) w(root, 'dist/' + rel, {})
  w(root, 'dist/stories/other-story/index.html', '<p>The <a href="/stories/xeno-site-15zz1/">Xeno Site</a> is in Foo County.</p>\n<p>Elsewhere, the Zephyr River floods every spring.</p>')
  w(root, 'dist/stories/xeno-site-15zz1/index.html', '<p>In Foo County, a village.</p>')
  w(root, 'scripts/protected-locators-pending.json', { entries: [] })
  for (const [rel, d] of Object.entries(extra)) w(root, rel, d)
  return root
}
const run = (root) => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' })

const clean = run(fixture())
if (clean.status !== 0) { console.error(clean.stdout + clean.stderr); throw new Error('wide test: clean fixture should pass') }
const plants = {
  'protected page <p>': { 'dist/stories/xeno-site-15zz1/index.html': '<p>In Foo County, a village on a high bluff.</p>' },
  'dist content/stories/<slug>.json': { 'dist/content/stories/xeno-site-15zz1.json': { bodyMarkdown: 'A village near Quillmore.' } },
  'dist data/app/search-index.json': { 'dist/data/app/search-index.json': [{ id: 'xeno-site-15zz1', text: 'It lies 5 miles north of town.' }] },
  'territories mention': { 'dist/data/web/territories/t.json': { text: 'The Xeno Site lay beside the Zephyr River.' } },
  'research mention': { 'dist/research/fort/index.html': '<p>See the Xeno Site, on Plimp Creek.</p>' },
  'caves.geojson': { 'dist/data/layers/caves.geojson': { features: [{ properties: { name: 'Xeno Site (15Zz1)', note: 'by Wobble River' } }] } },
  'related-people': { 'dist/data/web/related-people.json': { 'xeno-site-15zz1': ['dug on a ridge'] } },
  'stories-locations': { 'dist/content/stories-locations.json': { locations: { 'xeno-site-15zz1': { matchedPlace: 'Glimmer Lick' } } } },
  'unprotected story text near mention': { 'dist/stories/other-story/index.html': '<p>The <a href="/stories/xeno-site-15zz1/">Xeno Site</a> sat 3 miles east of the fort.</p>' },
  'unprotected story json near mention': { 'dist/content/stories/other-story.json': { bodyMarkdown: 'The [Xeno Site](/stories/xeno-site-15zz1/) is on the Zephyr River.' } },
  'layer html': { 'dist/layers/history/index.html': '<li>Xeno Site (15Zz1) above Snark Fork</li>' },
  'feed.xml': { 'dist/feed.xml': '<item><title>Xeno Site</title><description>Xeno Site, 3 miles east of town</description></item>' },
  'md': { 'dist/stories/other-story/story.md': 'The Xeno Site, near Quillmore.' },
}
let n = 0
for (const [name, extra] of Object.entries(plants)) {
  const r = run(fixture(extra))
  if (r.status === 0 || !/new locator/.test(r.stderr)) throw new Error(`wide test: planted "${name}" should fail on a locator\n${r.stdout}${r.stderr}`)
  n++
}
console.log(`test-protected-story-locators-wide: clean passes, ${n} planted cases fail`)
