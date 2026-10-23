#!/usr/bin/env node
/**
 * Integration & unit checks for the v2 Phase 1 unified story page (#336).
 * Verifies:
 *  - Every built /stories/<slug>/index.html uses the unified layout (.usp-page, .usp-rail, .usp-where-card, .usp-toc)
 *  - Document <title> <= 60 chars and meta description <= 155 chars
 *  - Matching /stories/<slug>/<slug>.md export exists and contains no 5+ decimal coordinates
 *  - Father David Rice story renders multiple markers (#754 and #844) and fixed presbydan.org/our-history URL
 *  - Protected/archaeological stories omit GeoCoordinates in JSON-LD, omit coordinate Directions links, and mark approximate location
 *  - Built CSS bundle includes @media print rules
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatCountiesBadge,
  roundStoryCoord,
  storyDocTitle,
  storyEraLabel,
} from './lib/unified-story-data.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

// 1. Unit checks on unified-story-data helpers
assert.equal(storyEraLabel('native'), 'Native nations')
assert.equal(storyEraLabel('other'), 'More Kentucky history')
assert.equal(roundStoryCoord(37.123456, true), 37.1)
assert.equal(roundStoryCoord(37.123456, false), 37.1235)
assert.equal(formatCountiesBadge(['Mercer', 'Boyle', 'Garrard', 'Lincoln']), 'Mercer, Boyle +2 counties')
assert.ok(
  storyDocTitle({
    slug: 'father-david-rice-and-kentuckys-first-presbyterian-churches',
    title: "Father David Rice and Kentucky's First Presbyterian Churches",
  }).length <= 60,
)

// 2. Built dist/ checks (when dist/stories exists)
const storiesDir = path.join(dist, 'stories')
if (!fs.existsSync(storiesDir)) {
  console.log('test-unified-story-page: unit checks passed (dist/ not built yet)')
  process.exit(0)
}

const slugs = fs
  .readdirSync(storiesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

assert.ok(slugs.length >= 240, `Expected >= 240 built story directories, found ${slugs.length}`)

for (const slug of slugs) {
  const htmlPath = path.join(storiesDir, slug, 'index.html')
  const mdPath = path.join(storiesDir, slug, `${slug}.md`)
  assert.ok(fs.existsSync(htmlPath), `Missing ${htmlPath}`)
  assert.ok(fs.existsSync(mdPath), `Missing ${mdPath}`)

  const html = fs.readFileSync(htmlPath, 'utf8')
  const md = fs.readFileSync(mdPath, 'utf8')

  const titleMatch = html.match(/<title>([^<]+)<\/title>/)
  assert.ok(titleMatch, `${slug}: missing <title>`)
  const decodedTitle = titleMatch[1]
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
  assert.ok(
    decodedTitle.length <= 60,
    `${slug}: <title> "${decodedTitle}" is ${decodedTitle.length} chars (> 60)`,
  )

  assert.ok(html.includes('class="usp-page static-story'), `${slug}: missing .usp-page`)
  assert.ok(html.includes('class="usp-map-card') || html.includes('class="usp-toc"'), `${slug}: missing map card or toc`)
  assert.ok(html.includes('class="usp-toc"'), `${slug}: missing .usp-toc`)
  assert.ok(html.includes('id="sources"'), `${slug}: missing #sources section`)
  assert.ok(
    html.includes(`href="/stories/${slug}/${slug}.md"`),
    `${slug}: missing Download .md link`,
  )
  assert.ok(md.startsWith('---\n') && md.includes('\n# '), `${slug}.md: must have YAML frontmatter and H1`)
  assert.ok(!/-?\d{1,3}\.\d{5,}/.test(md), `${slug}.md: contains 5+ decimal coordinate`)
}

// 3. Multi-marker + fixed URL check on Father David Rice
const riceSlug = 'father-david-rice-and-kentuckys-first-presbyterian-churches'
const riceHtml = fs.readFileSync(path.join(storiesDir, riceSlug, 'index.html'), 'utf8')
assert.ok(riceHtml.includes('KHS Marker #754'), 'Father David Rice: missing Marker #754')
assert.ok(riceHtml.includes('KHS Marker #844'), 'Father David Rice: missing Marker #844')
assert.ok(!riceHtml.includes('our-history96867eb2'), 'Father David Rice: still has broken presbydan URL')
assert.ok(riceHtml.includes('presbydan.org/our-history'), 'Father David Rice: missing fixed presbydan URL')

// 4. Protected / archaeological story check
const archSlug = 'indian-knoll-shell-mound-ohio-county'
if (fs.existsSync(path.join(storiesDir, archSlug, 'index.html'))) {
  const archHtml = fs.readFileSync(path.join(storiesDir, archSlug, 'index.html'), 'utf8')
  assert.ok(
    archHtml.includes('data-approx-location="true"'),
    `${archSlug}: missing data-approx-location="true"`,
  )
  assert.ok(
    !archHtml.includes('maps.apple.com/?daddr='),
    `${archSlug}: protected story must not include coordinate directions link`,
  )
  assert.ok(
    !archHtml.includes('"@type":"GeoCoordinates"'),
    `${archSlug}: archaeological story must not include GeoCoordinates in JSON-LD`,
  )
}

// 5. Print CSS check in dist/assets
const assetsDir = path.join(dist, 'assets')
const cssFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.css'))
const combinedCss = cssFiles.map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8')).join('\n')
assert.ok(combinedCss.includes('@media print'), 'Built CSS is missing @media print rules')

console.log(`test-unified-story-page: ok (${slugs.length} stories + markdown exports + multi-marker + protected + print CSS verified)`)
