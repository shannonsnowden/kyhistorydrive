#!/usr/bin/env node
/**
 * Approvals 112 A3, Editor design softs: Visit it is a compact strip under the dek.
 * 390: place + Directions (amber) + See on map (outline).
 * 1280: one Get directions control (Google, Apple on iOS or an Apple·Google toggle)
 * and See on the history map. The full map card stays in the rail / mobile slot.
 * No coords hides the strip. County-only is an outline and "See county on map".
 * Protected stories are copy only: no dot, no directions, no locator leaks.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { visitItHtml } from './lib/unified-story-data.mjs'
import { findLocators } from './lib/protected-locators.mjs'

const publicStory = {
  slug: 'sample-visit-story',
  title: 'Sample Visit Story',
  county: 'Mercer',
  matchedPlace: 'Harrodsburg',
  era: 'frontier',
  lat: 37.6456,
  lon: -84.7789,
  mapConfidence: 'exact',
  tags: ['frontier'],
}

const protectedStory = {
  slug: 'sample-protected-visit',
  title: 'Sample Protected Visit',
  county: 'Mercer',
  matchedPlace: 'Sample Creek near Harrodsburg',
  era: 'frontier',
  coordinatesProtected: true,
  lat: 37.6456,
  lon: -84.7789,
  mapConfidence: 'override',
  tags: [],
}

const countyStory = {
  slug: 'sample-county-story',
  title: 'Sample County Story',
  county: 'Logan',
  matchedPlace: 'Logan County (centroid)',
  era: 'frontier',
  lat: 36.82461,
  lon: -86.84895,
  mapConfidence: 'county',
  tags: ['frontier'],
}

function visibleText(html) {
  return html
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

const pub = visitItHtml({ story: publicStory })
assert.match(pub, /id="visit"/)
assert.match(pub, /<h2 id="h-visit">Visit it<\/h2>/)
assert.match(pub, /Harrodsburg/)
assert.match(pub, /usp-visit-go-short">Directions</)
assert.match(pub, /usp-visit-go-full">Get directions</)
assert.match(pub, /usp-visit-map-short">See on map</)
assert.match(pub, /usp-visit-map-full">See on the history map</)
assert.match(pub, /data-visit-go/)
assert.match(pub, /data-visit-app="google"/)
assert.match(pub, /data-visit-app="apple"/)
assert.match(pub, /href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=37\.6456,-84\.7789"/)
assert.match(pub, /data-apple="https:\/\/maps\.apple\.com\/\?daddr=37\.6456,-84\.7789"/)
assert.equal((pub.match(/<a /g) || []).length, 2, 'one directions control and one map link, not dual underlined direction links')
assert.doesNotMatch(pub, /usp-map-approx-ring|data-approximate|nearby-miles|drives\/build|mailto:|contact@/i)
assert.doesNotMatch(pub, /class="usp-railmap-dirs"/)

const county = visitItHtml({ story: countyStory })
assert.match(county, /id="visit"/)
assert.match(county, /See county on map/)
assert.match(county, /Logan County/)
assert.match(county, /usp-visit-county-svg/)
assert.match(county, /usp-visit-county-fill/)
assert.doesNotMatch(county, /usp-pin-dot|usp-map-approx-ring|maps\.apple\.com|google\.com\/maps|Get directions|data-lat=/)

const prot = visitItHtml({
  story: protectedStory,
  interpretive: { slug: 'public-museum', href: '/stories/public-museum/', title: 'Public Museum' },
})
assert.match(prot, /id="visit"/)
assert.match(prot, /Mercer County/)
assert.match(prot, /href="\/stories\/public-museum\/"/)
assert.match(prot, />Public Museum</)
assert.doesNotMatch(prot, /Sample Creek|Harrodsburg|maps\.apple\.com|google\.com\/maps|historypin|drives\/build|data-lat=|data-lon=|usp-pin|usp-map-approx-ring|Get directions|See on map|See county on map/)
const protText = visibleText(prot)
assert.doesNotMatch(protText, /-?\d{1,3}\.\d{2,}/)
assert.deepEqual(findLocators(protText, protectedStory.slug), [])

const banned = visitItHtml({
  story: { ...protectedStory, slug: 'peter-village-enclosure-15fa166' },
  interpretive: { slug: 'mount-horeb-earthworks', href: '/stories/mount-horeb-earthworks/', title: 'Mount Horeb Earthworks' },
})
assert.doesNotMatch(banned, /mount-horeb|Mount Horeb/)

assert.equal(visitItHtml({ story: { slug: 'no-pin', title: 'No Pin', era: 'frontier', county: 'Boyle', tags: [] } }), '')
assert.equal(
  visitItHtml({ story: { slug: 'no-pin-prot', title: 'No Pin Protected', era: 'frontier', coordinatesProtected: true, tags: [] } }),
  '',
)

const css = fs.readFileSync(new URL('../src/story-page/unified-story.css', import.meta.url), 'utf8')
assert.match(css, /\.usp-visit-go \{[^}]*min-height:\s*44px/)
assert.match(css, /\.usp-visit-go \{[^}]*#e3a650/)
assert.match(css, /\.usp-visit-maplink \{[^}]*min-height:\s*44px/)
assert.match(css, /\.usp-visit a:focus-visible/)
assert.match(css, /min-width:\s*1000px\)[\s\S]*\.usp-visit-go-short/)

const printCss = fs.readFileSync(new URL('../src/story-print.css', import.meta.url), 'utf8')
const sectionShow = printCss.indexOf('.usp-section {')
const visitHide = printCss.indexOf('.usp-visit { display: none !important; }')
assert.ok(sectionShow > 0 && visitHide > sectionShow)

const prerender = fs.readFileSync(new URL('./prerender-pages.mjs', import.meta.url), 'utf8')
assert.match(prerender, /visitItHtml\(/)
const visitAt = prerender.indexOf('${visitHtml}')
const headerAt = prerender.indexOf('</header>')
const storyAt = prerender.indexOf('id="story"')
assert.ok(headerAt > 0 && visitAt > headerAt && storyAt > visitAt, 'Visit it sits under the dek and above the story')
assert.match(prerender, /renderWhereItHappenedCard\(story, matchedMarkers, 'rail'\)/)
assert.match(prerender, /renderWhereItHappenedCard\(story, matchedMarkers, 'mobile'\)/)
assert.match(prerender, /\$\{driveSectionHtml\}/)

const pageJs = fs.readFileSync(new URL('../public/story-page.js', import.meta.url), 'utf8')
assert.match(pageJs, /data-visit-app/)
assert.match(pageJs, /iPhone|iPad|iPod/)

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert.doesNotMatch(main, /\bshowStoryInReader\b/)

console.log('test-visit-it: ok')
