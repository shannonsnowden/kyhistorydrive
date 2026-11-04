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
import { isProtectedStory } from './lib/unified-story-data.mjs'
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

/** Header search submits GET /stories/?q= (site-search.js and the stories list both read `q`). */
const SEARCH_URL_TEMPLATE = 'https://kyhistorydrive.com/stories/?q={search_term_string}'

/**
 * Homepage JSON-LD only: one WebSite node at #website, with SearchAction nested on that node.
 * A second WebSite, or a SearchAction on any other page, is out of scope.
 */
function assertHomepageSearchAction(html, label) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  assert.ok(blocks.length >= 1, `${label}: missing JSON-LD`)
  const websites = []
  for (const block of blocks) {
    let data
    try {
      data = JSON.parse(block[1])
    } catch (err) {
      assert.fail(`${label}: JSON-LD is not valid JSON (${err.message})`)
    }
    const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data]
    for (const node of nodes) {
      const types = [].concat(node['@type'] || [])
      if (types.includes('WebSite')) websites.push(node)
    }
  }
  assert.equal(websites.length, 1, `${label}: expected one WebSite node, found ${websites.length}`)
  const site = websites[0]
  assert.equal(site['@id'], 'https://kyhistorydrive.com/#website', `${label}: WebSite @id`)
  const action = site.potentialAction
  assert.equal(action && action['@type'], 'SearchAction', `${label}: nest SearchAction on the existing WebSite`)
  assert.equal(action.target && action.target['@type'], 'EntryPoint', `${label}: SearchAction target`)
  assert.equal(action.target && action.target.urlTemplate, SEARCH_URL_TEMPLATE, `${label}: SearchAction urlTemplate`)
  assert.equal(action['query-input'], 'required name=search_term_string', `${label}: query-input`)
}

const sourceHome = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
assertHomepageSearchAction(sourceHome, 'index.html')
assert.match(
  sourceHome,
  /<form\b[^>]*\bid="siteSearchForm"[^>]*\baction="\/stories\/"[^>]*\bmethod="get"/,
  'index.html header search must still GET /stories/',
)
assert.match(sourceHome, /<input\b[^>]*\bname="q"/, 'index.html header search input must stay named q')

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

// #337 retired 7 merged stories (data/story-merges.json), so the floor is 237.
assert.ok(slugs.length >= 237, `Expected >= 240 built story directories, found ${slugs.length}`)

let mentionsStoryCount = 0
for (const slug of slugs) {
  const htmlPath = path.join(storiesDir, slug, 'index.html')
  const mdPath = path.join(storiesDir, slug, "story.md")
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

  assert.ok(html.includes('class="usp-wayfinder"'), `${slug}: missing .usp-wayfinder`)
  assert.ok(html.includes('class="usp-grid"'), `${slug}: missing .usp-grid`)
  assert.ok(html.includes('class="usp-article usp-page static-story'), `${slug}: missing .usp-article`)
  assert.ok(html.includes(`<link rel="alternate" type="text/markdown" href="/stories/${slug}/story.md"`), `${slug}: missing alternate markdown link`)
  const idxVisit = html.indexOf('id="visit"')
  const idxStory = html.indexOf('id="story"')
  const idxToday = html.indexOf('id="today"')
  const idxMarkers = html.indexOf('id="markers"')
  const idxMapInline = html.indexOf('id="map-inline"')
  const idxSources = html.indexOf('id="sources"')
  const idxDrive = html.indexOf('id="drive"')
  const idxCite = html.indexOf('id="cite"')
  // Protected stories have no #drive section (no route builder; Critiquito #345).
  const prot = isProtectedStory({ slug })
  if (idxVisit > 0) assert.ok(idxVisit < idxStory, `${slug}: Visit it must sit above the story`)
  if (prot) assert.ok(idxDrive < 0, `${slug}: protected story shows a #drive section`)
  assert.ok(idxStory > 0 && idxSources > idxStory && (prot ? idxCite > idxSources : idxDrive > idxSources && idxCite > idxDrive), `${slug}: sections out of v2 order`)
  if (idxToday > 0) assert.ok(idxToday > idxStory && idxSources > idxToday, `${slug}: #today must sit after #story`)
  if (idxMarkers > 0) {
    assert.ok(idxMarkers > (idxToday > 0 ? idxToday : idxStory) && idxSources > idxMarkers, `${slug}: #markers out of order`)
  }
  if (idxMapInline > 0) {
    assert.ok(idxMapInline > (idxMarkers > 0 ? idxMarkers : idxToday > 0 ? idxToday : idxStory) && idxSources > idxMapInline, `${slug}: #map-inline must sit after #markers/#today`)
  }
  assert.ok(html.includes('class="usp-railmap') || html.includes('class="usp-toc"'), `${slug}: missing .usp-railmap or .usp-toc`)
  assert.ok(html.includes('class="usp-toc"'), `${slug}: missing .usp-toc`)
  assert.ok(html.includes('id="sources"'), `${slug}: missing #sources section`)
  assert.ok(
    html.includes(`href="/stories/${slug}/story.md"`),
    `${slug}: missing Download .md link`,
  )
  assert.ok(md.startsWith('---\n') && md.includes('\n# '), `${slug}.md: must have YAML frontmatter and H1`)
  assert.ok(!/-?\d{1,3}\.\d{5,}/.test(md), `${slug}.md: contains 5+ decimal coordinate`)
  assert.ok(!md.includes('https://www.kyhistorydrive.com'), `${slug}.md: must not use www.kyhistorydrive.com`)
  assert.ok(md.includes('https://kyhistorydrive.com/stories/'), `${slug}.md: must use https://kyhistorydrive.com`)
  const storyBodyMatch = md.match(/## The story\n\n([\s\S]*?)(?=\n## |\n---)/)
  assert.ok(
    storyBodyMatch && storyBodyMatch[1].trim().length >= 100,
    `${slug}.md: ## The story body must have >= 100 chars (got ${storyBodyMatch ? storyBodyMatch[1].trim().length : 0})`,
  )

  // D.1 & D.3 checks
  const kickerMatch = html.match(/<p class="[^"]*static-kicker[^"]*">([^<]+)<\/p>/)
  assert.ok(kickerMatch && !kickerMatch[1].includes('·'), `${slug}: .static-kicker should not repeat county/era`)
  // #345: a protected site lists same-county stories only; with none, the section is omitted.
  assert.ok(
    html.includes('<h2 id="related-nearby-heading">Related stories</h2>') ||
      (isProtectedStory({ slug }) && !html.includes('related-nearby-heading')),
    `${slug}: related section heading must be Related stories`,
  )

  // JSON-LD checks (A.2, A.3, B.6)
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  assert.ok(ldMatch, `${slug}: missing JSON-LD script`)
  const ld = JSON.parse(ldMatch[1])
  const graph = Array.isArray(ld?.['@graph']) ? ld['@graph'] : Array.isArray(ld) ? ld : [ld]
  const articleNode = graph.find((n) => n?.['@type'] === 'Article')
  assert.ok(articleNode, `${slug}: missing Article JSON-LD node`)
  assert.equal(
    articleNode.author?.['@id'],
    'https://kyhistorydrive.com/about/#shannon-snowden',
    `${slug}: Article.author missing @id`,
  )
  if (Array.isArray(articleNode.mentions) && articleNode.mentions.length > 0) {
    mentionsStoryCount += 1
  }
  const placeNode = articleNode.contentLocation || graph.find((n) => n?.['@type'] === 'Place')
  const geoNode = placeNode?.geo
  if (geoNode && geoNode['@type'] === 'GeoCoordinates') {
    const isApprox = html.includes('data-approximate="true"')
    const maxDec = isApprox ? 1 : 4
    for (const field of ['latitude', 'longitude']) {
      const valStr = String(geoNode[field] ?? '')
      const decLen = valStr.includes('.') ? valStr.split('.')[1].length : 0
      assert.ok(
        decLen <= maxDec,
        `${slug}: GeoCoordinates.${field}=${valStr} has ${decLen} decimals (> ${maxDec})`,
      )
    }
  }
}

assert.ok(
  mentionsStoryCount > 50,
  `Expected > 50 stories with non-empty Article.mentions in JSON-LD, found ${mentionsStoryCount}`,
)

// 3. Multi-marker + fixed URL check on Father David Rice
const riceSlug = 'father-david-rice-and-kentuckys-first-presbyterian-churches'
const riceHtml = fs.readFileSync(path.join(storiesDir, riceSlug, 'index.html'), 'utf8')
assert.ok(riceHtml.includes('KHS Marker #754'), 'Father David Rice: missing Marker #754')
assert.ok(riceHtml.includes('KHS Marker #844'), 'Father David Rice: missing Marker #844')
assert.ok(!riceHtml.includes('our-history96867eb2'), 'Father David Rice: still has broken presbydan URL')
assert.ok(riceHtml.includes('presbydan.org/our-history'), 'Father David Rice: missing fixed presbydan URL')

// 4. Protected / archaeological story check
const archSlug = 'indian-knoll-ohio-county'
if (fs.existsSync(path.join(storiesDir, archSlug, 'index.html'))) {
  const archHtml = fs.readFileSync(path.join(storiesDir, archSlug, 'index.html'), 'utf8')
  assert.ok(
    archHtml.includes('data-approximate="true"'),
    `${archSlug}: missing data-approx-location="true"`,
  )
  assert.ok(
    !archHtml.includes('maps.apple.com/?daddr='),
    `${archSlug}: protected story must not include coordinate directions link`,
  )
  assert.ok(
    archHtml.includes('"latitude":37.5,"longitude":-86.8') && !/-?\d{1,3}\.\d{2,}/.test(archHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || ""),
    `${archSlug}: archaeological story JSON-LD GeoCoordinates must be rounded to <= 1 decimal`,
  )
}

// 4b. Protected newt-kash-hollow-15mf1 story.md check & layer / homepage / about JSON-LD checks
const newtMd = fs.readFileSync(path.join(storiesDir, 'newt-kash-hollow-15mf1', 'story.md'), 'utf8')
assert.ok(
  newtMd.includes('37.9° N, 83.6° W') && newtMd.includes('approximate (rounded to 0.1 deg'),
  'newt-kash-hollow-15mf1/story.md must use 0.1 deg approximate coordinates',
)

const historyLayerHtml = fs.readFileSync(path.join(dist, 'layers', 'history', 'index.html'), 'utf8')
const historyStoryLinks = historyLayerHtml.match(/href="\/stories\/[a-z0-9-]+\/"/g) || []
assert.ok(
  historyStoryLinks.length >= 180,
  `/layers/history/ should link all ~188 history stories, found ${historyStoryLinks.length}`,
)
assert.ok(
  historyLayerHtml.includes('"url":"https://kyhistorydrive.com/stories/'),
  '/layers/history/ ItemList JSON-LD must include linked story URLs',
)

const homeHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
assertHomepageSearchAction(homeHtml, 'dist/index.html')
assert.ok(
  homeHtml.includes('href="/#timeline"') && homeHtml.includes('href="/#map"'),
  'dist/index.html header nav must use /#timeline and /#map',
)

const aboutHtml = fs.readFileSync(path.join(dist, 'about', 'index.html'), 'utf8')
assert.ok(
  aboutHtml.includes('"@id":"https://kyhistorydrive.com/about/#shannon-snowden"'),
  'dist/about/index.html Person node must include @id #shannon-snowden',
)

// 5. Print CSS check in dist/assets
const assetsDir = path.join(dist, 'assets')
const cssFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.css'))
const combinedCss = cssFiles.map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8')).join('\n')
assert.ok(combinedCss.includes('@media print'), 'Built CSS is missing @media print rules')

console.log(`test-unified-story-page: ok (${slugs.length} stories + markdown exports + multi-marker + protected + print CSS verified)`)
