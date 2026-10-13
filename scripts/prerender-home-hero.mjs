/**
 * Write the homepage lead story, the 4 "More Kentucky stories" cards and the phone swipe row
 * into dist/index.html at build time, plus a <link rel=preload> for the lead image in <head>.
 * Without JS the homepage still has real <a href> links and images; the app re-renders the
 * same markup from src/home-hero-render.js when it loads.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setPhotoVariants } from '../src/responsive-img.js'
import {
  usablePhoto,
  renderLeadStory,
  renderRailCard,
  renderSwipeCard,
  leadPreloadTag,
  storyPageHref,
} from '../src/home-hero-render.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const file = path.join(dist, 'index.html')
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

const pack = readJson(path.join(root, 'public/content/home-preview.json'))
const variantsFile = path.join(root, 'public/content/photos/responsive.json')
setPhotoVariants(fs.existsSync(variantsFile) ? readJson(variantsFile) : {})

const all = Array.isArray(pack.stories) && pack.stories.length ? pack.stories : [pack.hero, ...(pack.features || [])].filter(Boolean)
const withPhotos = all.filter((s) => usablePhoto(s?.photo))
const slides = withPhotos.length ? withPhotos : all.slice(0, 1)
if (!slides.length) throw new Error('prerender-home-hero: home-preview.json has no stories')
const lead = slides[0]
const more = slides.slice(1, 5)

let html = fs.readFileSync(file, 'utf8')
const swap = (re, label, fn) => {
  if (!re.test(html)) throw new Error(`prerender-home-hero: ${label} not found in dist/index.html`)
  html = html.replace(re, fn)
}
swap(/<section id="hpHero"([^>]*)>[\s\S]*?<\/section>(\s*<aside class="hp-story-rail")/, '#hpHero', (_, attrs, tail) =>
  `<section id="hpHero"${attrs.replace(/\s*aria-busy="true"/, '')}>${renderLeadStory(lead)}</section>${tail}`)
swap(/<div id="hpStoryRail"([^>]*)><\/div>/, '#hpStoryRail', (_, a) => `<div id="hpStoryRail"${a}>${more.map(renderRailCard).join('')}</div>`)
swap(/<ul id="hpStorySwipe"([^>]*)><\/ul>/, '#hpStorySwipe', (_, a) => `<ul id="hpStorySwipe"${a}>${more.map(renderSwipeCard).join('')}</ul>`)
html = html.replace(/\s*<link id="hpLeadPreload"[^>]*>/, '')
const tag = leadPreloadTag(lead)
if (tag) html = html.replace('</title>', `</title>\n    ${tag}`)
fs.writeFileSync(file, html)

// Guard: the static file must carry the lead and 4 cards as real links.
const out = fs.readFileSync(file, 'utf8')
const leadHref = storyPageHref(lead)
const problems = []
if (!out.includes(`class="hp-lead-media-link" href="${leadHref}"`)) problems.push('lead link')
if ((out.match(/class="hp-rail-card" href="/g) || []).length !== more.length) problems.push('rail cards')
if ((out.match(/class="hp-swipe-card-link" href="/g) || []).length !== more.length) problems.push('swipe cards')
if (tag && !/<head>[\s\S]*id="hpLeadPreload"[\s\S]*<\/head>/.test(out)) problems.push('head preload')
if (/<section id="hpHero"[\s\S]*?<\/ul>/.exec(out)?.[0].includes('href="/#timeline/')) problems.push('hash #timeline story links')
// Plain left clicks on these cards open the Timeline reader via data-timeline (src/home-preview.js).
if (!out.includes(`data-timeline="/#timeline/${encodeURIComponent(lead.slug)}"`)) problems.push('lead data-timeline')
for (const s of [lead, ...more]) if (!fs.existsSync(path.join(dist, 'stories', s.slug, 'index.html'))) problems.push(`no /stories/${s.slug}/ page`)
if (problems.length) throw new Error(`prerender-home-hero: missing ${problems.join(', ')}`)
console.log(`prerender-home-hero: lead "${lead.title}" + ${more.length} cards in dist/index.html${tag ? ', preload in <head>' : ''}`)
