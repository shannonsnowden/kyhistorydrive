#!/usr/bin/env node
/** Phase 6 (#341): /editorial/ and /contact/, contact reveal move, videos/routes leads, bridges intro. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrerenderPages } from './prerender-pages.mjs'
import { siteFooterHtml } from './site-chrome.mjs'
import { ROUTE_MAPS, routesIndexArticleHtml } from '../src/route-maps.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fails = []
const ok = (cond, msg) => { if (!cond) fails.push(msg) }

const EDITORIAL_TITLE = 'Editorial · Kentucky History Drive'
const EDITORIAL_H1 = 'Editorial standards'
const EDITORIAL_DESC = 'How Kentucky History Drive researches stories, labels AI illustrations, protects archaeological sites, and handles corrections.'
const EDITORIAL_LEAD = 'How we research, credit images, protect fragile sites, and fix mistakes.'
const CONTACT_TITLE = 'Contact · Kentucky History Drive'
const CONTACT_H1 = 'Contact'
const CONTACT_DESC = 'Reach Kentucky History Drive for corrections, photo suggestions, and questions about the marker map and stories.'
const CONTACT_LEAD = 'Questions, corrections, photo suggestions, and partnership notes.'
const VIDEOS_LEAD = 'Short films from Kentucky History Drive stories — people, places, and routes you can open on the map. Each film sits on its story page with sources and a path to related stops. This index lists every published film; more are in production. Prefer the story page if you want the full narrative and research notes.'
const ROUTES_LEAD = 'Approximate route maps for Kentucky history stories — paths drawn from the narrative and the sources behind it, not turn-by-turn GPS. Open a card for the map art, era, and link to the full story; use Open on the map for the live pin. Mantle Rock follows the National Park Service name Northern Route. Stops are listed in text on each story’s route section so the path is readable without the artwork.'
const BRIDGES_INTRO = 'Kentucky’s remaining covered bridges — timber spans that still stand on public roads or park approaches, mapped so you can find them on a drive. Pins use the bridge name, county, and a short note on the truss or rebuilding history when sources support it. Featured stops highlight a well-documented survivor; the place list below covers the layer. These are historic structures still in the landscape, not vanished crossings.'
const AI_CREDIT = 'AI illustration · Kentucky History Drive'
const PLAIN = 'contact@kyhistorydrive.com'
const ENTITY = /contact(?:&#0*64;|&#[xX]0*40;|&commat;|%40)kyhistorydrive\.com/i
const NOSCRIPT = 'contact [at] kyhistorydrive [dot] com'

function meta(html) {
  return (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ''
}
function noAddress(html, label) {
  ok(!html.toLowerCase().includes(PLAIN), `${label}: plain contact address`)
  ENTITY.lastIndex = 0
  ok(!ENTITY.test(html), `${label}: encoded contact address`)
}
function indexable(html, label) {
  ok(!/<meta name="robots" content="[^"]*noindex/i.test(html), `${label}: must stay indexable`)
}

const editorial = typeof PrerenderPages.editorialPage === 'function' ? PrerenderPages.editorialPage([]) : ''
const contact = typeof PrerenderPages.contactPage === 'function' ? PrerenderPages.contactPage([]) : ''
const about = PrerenderPages.aboutPage([])

ok(editorial.includes(`<title>${EDITORIAL_TITLE}</title>`), '/editorial/: title')
ok(editorial.includes(`<h1>${EDITORIAL_H1}</h1>`), '/editorial/: h1')
ok((editorial.match(/<h1\b/g) || []).length === 1, '/editorial/: one h1')
ok(meta(editorial) === EDITORIAL_DESC, '/editorial/: meta description')
ok(meta(editorial).length <= 160, '/editorial/: meta description length')
ok(editorial.includes(EDITORIAL_LEAD), '/editorial/: lead')
for (const h of ['How we research', 'AI illustrations', 'Protected archaeological sites', 'Corrections', 'Culture images and evidence pages']) {
  ok(editorial.includes(`<h2>${h}</h2>`), `/editorial/: missing section "${h}"`)
}
ok(editorial.includes(AI_CREDIT), '/editorial/: exact AI credit')
ok(!/story\s+studio/i.test(editorial), '/editorial/: must not name the art desk')
ok(editorial.includes('href="/contact/"') && editorial.includes('>Contact us</a>'), '/editorial/: contact CTA')
ok(editorial.includes('href="/about/"') && editorial.includes('>About</a>'), '/editorial/: about link')
ok(editorial.includes('<link rel="canonical" href="https://kyhistorydrive.com/editorial/"'), '/editorial/: canonical')
ok(editorial.includes('"@type":"WebPage"') || editorial.includes('"@type": "WebPage"'), '/editorial/: WebPage JSON-LD')
indexable(editorial, '/editorial/')
noAddress(editorial, '/editorial/')
ok(!/href="\/terms\/"/i.test(editorial) && !/<h2>Terms<\/h2>/i.test(editorial), '/editorial/: Terms is out of scope')
ok(!/roads-and-rails/.test(editorial), '/editorial/: no roads-and-rails link')

ok(contact.includes(`<title>${CONTACT_TITLE}</title>`), '/contact/: title')
ok(contact.includes(`<h1>${CONTACT_H1}</h1>`), '/contact/: h1')
ok((contact.match(/<h1\b/g) || []).length === 1, '/contact/: one h1')
ok(meta(contact) === CONTACT_DESC, '/contact/: meta description')
ok(meta(contact).length <= 160, '/contact/: meta description length')
ok(contact.includes(CONTACT_LEAD), '/contact/: lead')
ok(contact.includes('<h2>Write to us</h2>') && contact.includes('<h2>What to send</h2>'), '/contact/: sections')
ok(contact.includes('data-contact-reveal') && contact.includes('>Show email address<'), '/contact/: reveal button')
ok(contact.includes(NOSCRIPT), '/contact/: noscript fallback')
ok(contact.includes('<strong>Corrections</strong>') && contact.includes('<strong>Photos</strong>') && contact.includes('<strong>General questions</strong>'), '/contact/: what to send')
ok(contact.includes('href="/editorial/"') && contact.includes('>Editorial standards</a>'), '/contact/: editorial link')
ok(contact.includes('href="/about/"') && contact.includes('>About</a>'), '/contact/: about link')
ok(contact.includes('<link rel="canonical" href="https://kyhistorydrive.com/contact/"'), '/contact/: canonical')
ok(contact.includes('"@type":"ContactPage"'), '/contact/: ContactPage JSON-LD')
indexable(contact, '/contact/')
noAddress(contact, '/contact/')
ok(!/href="\/terms\/"/i.test(contact), '/contact/: Terms is out of scope')

ok(!about.includes('data-contact-reveal') && !about.includes('>Show email address<') && !about.includes(NOSCRIPT), '/about/: contact reveal moved off the page')
ok(about.includes('href="/contact/"') && about.includes('Questions, corrections, or photo suggestions:'), '/about/: contact blurb links to /contact/')
ok(about.includes('href="/editorial/">Editorial standards</a>'), '/about/: sources and images deep-link to editorial')
ok(about.includes('We link claims readers might question to sources, prefer primary and official records, and say when sources disagree.'), '/about/: shortened sources')
ok(about.includes('Archival photos when they exist; labeled AI illustrations when they don’t.'), '/about/: shortened images')
ok(about.includes('County-level only for sites that are not public; no directions.'), '/about/: shortened protecting')
ok(!about.includes('Every claim a reader might question, such as a date, name, number or quote, links to a source'), '/about/: long sources paragraph removed')
ok(!about.includes('every one is visibly labeled'), '/about/: long images paragraph removed')
ok(!/<h2[^>]*>\s*Author\s*<\/h2>/i.test(about), '/about/: Author section omitted')
ok(!about.includes('AUTHOR_BIO_PLACEHOLDER'), '/about/: no author placeholder')
ok(!about.includes('Shannon Snowden is the author of the Kentucky history stories on this site.'), '/about/: no interim author bio')
ok(about.includes('"@id":"https://kyhistorydrive.com/about/#shannon-snowden"'), '/about/: Person @id kept')
ok(!/"description"\s*:\s*"[^"]*Shannon Snowden is the author/.test(about), '/about/: Person JSON-LD has no bio prose')
ok(about.includes('id="license"') && about.includes('>Credits</h2>') && about.includes('>Publisher</h2>'), '/about/: credits and publisher kept')
ok(about.includes('class="about-seal-btn"'), '/about/: seals kept')
noAddress(about, '/about/')
ok(!/href="\/terms\/"/i.test(about) && !/<h2>Terms<\/h2>/i.test(about), '/about/: Terms not added')

const videos = PrerenderPages.videosPage([], [], [])
ok(videos.includes(VIDEOS_LEAD), '/videos/: new lead')
ok(!videos.includes('Films published by Kentucky History Drive.'), '/videos/: old lead removed')
ok(videos.includes(`content="${PrerenderPages.THIN_ROBOTS}"`), '/videos/: THIN_ROBOTS')

const routeStories = ROUTE_MAPS.map((route) => ({ slug: route.slug, title: route.slug }))
const routes = PrerenderPages.routesPage(routeStories, [])
const routeArticle = routesIndexArticleHtml((slug) => slug)
ok(routeArticle.includes(ROUTES_LEAD), 'routesIndexArticleHtml: new lead')
ok(routes.includes(ROUTES_LEAD), '/routes/: new lead')
ok(!routes.includes('Six approximate routes, each drawn for its story.'), '/routes/: old lead removed')
ok(routes.includes(`content="${PrerenderPages.THIN_ROBOTS}"`), '/routes/: THIN_ROBOTS')
ok(PrerenderPages.NOINDEX_PATHS.includes('/videos/') && PrerenderPages.NOINDEX_PATHS.includes('/routes/'), 'videos and routes stay out of the sitemap')
ok(!PrerenderPages.NOINDEX_PATHS.includes('/editorial/') && !PrerenderPages.NOINDEX_PATHS.includes('/contact/'), 'editorial and contact are not noindex paths')

ok(PrerenderPages.LAYER_INTRO.bridges === BRIDGES_INTRO, 'LAYER_INTRO.bridges is the thicker intro')
ok(!/roads-and-rails/.test(PrerenderPages.LAYER_INTRO.bridges), 'bridges intro does not link /roads-and-rails/')
ok(!PrerenderPages.LAYER_INTRO.bridges.includes('Covered bridges still standing in Kentucky.'), 'old bridges intro removed')
const bridgesMeta = PrerenderPages.metaDescription(`${PrerenderPages.LAYER_INTRO.bridges} Featured stop.`)
ok(bridgesMeta.startsWith('Kentucky’s remaining covered bridges'), 'bridges meta derives from the thicker intro')
ok(!/roads-and-rails/.test(bridgesMeta), 'bridges meta does not link /roads-and-rails/')
ok(bridgesMeta.length <= 160, 'bridges meta stays within 160 characters')

const articleText = (html) => {
  const article = html.match(/<article[\s\S]*?<\/article>/)
  return (article ? article[0] : '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
}
const fresh = [articleText(editorial), articleText(contact), VIDEOS_LEAD, ROUTES_LEAD, PrerenderPages.LAYER_INTRO.bridges].join('\n')
ok(!/\b(?:river|creek|lake)\b/i.test(fresh), 'new public copy has no river, creek, or lake')
ok(!/-?\d{1,3}\.\d{2,}/.test(fresh), 'new public copy has no coordinates')

const foot = siteFooterHtml()
ok(foot.includes('href="/editorial/"') && foot.includes('>Editorial</a>'), 'shared footer links Editorial')
ok(foot.includes('href="/contact/"') && foot.includes('>Contact</a>'), 'shared footer links Contact')
for (const file of ['index.html', 'privacy/index.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8')
  const footer = (html.match(/<footer class="foot">[\s\S]*?<\/footer>/) || [''])[0]
  ok(footer.includes('href="/editorial/"') && footer.includes('href="/contact/"'), `${file}: footer links Editorial and Contact`)
}

const sitemapFile = path.join(os.tmpdir(), `khd-trust-sitemap-${process.pid}.xml`)
const sitemapCount = PrerenderPages.updateSitemap(sitemapFile, [
  { loc: 'https://kyhistorydrive.com/', lastmod: '2026-10-26' },
  { loc: 'https://kyhistorydrive.com/editorial/', lastmod: '2026-10-26' },
  { loc: 'https://kyhistorydrive.com/contact/', lastmod: '2026-10-26' },
  { loc: 'https://kyhistorydrive.com/privacy/', lastmod: '2026-10-26' },
], 0)
const sitemap = fs.readFileSync(sitemapFile, 'utf8')
ok(sitemapCount === 4, 'sitemap accepts editorial and contact')
ok(sitemap.includes('https://kyhistorydrive.com/editorial/') && sitemap.includes('https://kyhistorydrive.com/contact/'), 'sitemap lists both trust pages')
let rejected = false
try {
  PrerenderPages.updateSitemap(sitemapFile, [
    { loc: 'https://kyhistorydrive.com/', lastmod: '2026-10-26' },
    { loc: 'https://kyhistorydrive.com/videos/', lastmod: '2026-10-26' },
    { loc: 'https://kyhistorydrive.com/privacy/', lastmod: '2026-10-26' },
  ], 0)
} catch (err) {
  rejected = /noindex page \/videos\//.test(err.message)
}
ok(rejected, 'sitemap rejects noindex /videos/')
fs.rmSync(sitemapFile, { force: true })

if (fails.length) {
  console.error(fails.map((f) => `test-trust-pages: ${f}`).join('\n'))
  process.exit(1)
}
console.log('test-trust-pages: editorial, contact, about reveal move, videos/routes leads, bridges intro, sitemap ok')
