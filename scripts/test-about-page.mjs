#!/usr/bin/env node
/** Item 91: /about/ carries the approved copy, and every footer links to /about/. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrerenderPages } from './prerender-pages.mjs'
import { siteFooterHtml } from './site-chrome.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fails = []
const ok = (cond, msg) => { if (!cond) fails.push(msg) }

const html = PrerenderPages.aboutPage(['/assets/x.css'])
for (const h of ["What you'll find here", 'What we’re building', 'Sources and accuracy', 'About our images', 'Protecting archaeological sites']) {
  ok(html.includes(`>${h.replace("'", '’')}</h2>`), `/about/: missing section "${h}"`)
}
ok(html.includes('History is all around us.'), '/about/: missing tagline')
ok(!html.includes('AI illustration · Kentucky History Drive'), '/about/: full AI credit moved to /editorial/')
ok(html.includes('labeled AI illustrations'), '/about/: shortened images section')
ok(html.includes('href="/editorial/"'), '/about/: link to editorial standards')
ok(html.includes('href="/contact/"') && !html.includes('data-contact-reveal') && !html.includes('>Show email address<'), '/about/: contact reveal moved to /contact/')
ok(!/<h2[^>]*>\s*Author\s*<\/h2>/i.test(html), '/about/: Author section omitted')
ok(!html.includes('AUTHOR_BIO_PLACEHOLDER'), '/about/: no author placeholder')
ok(!html.includes('Shannon Snowden is the author of the Kentucky history stories on this site.'), '/about/: no interim author bio')
ok(html.includes('"@id":"https://kyhistorydrive.com/about/#shannon-snowden"'), '/about/: Person @id kept')
ok(html.includes('with new stories added regularly') && !/new story every day/.test(html), '/about/: story cadence wording (KY History fact pass)')
ok(html.includes('Each person in our stories is meant to get a portrait') && !html.includes('stories gets a portrait'), '/about/: portrait wording (KY History fact pass)')
ok(!html.includes('helps you explore Kentucky’s historical highway markers'), '/about/: Author section repeats the intro')
const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8')
ok(/\.contact-reveal \.btn \{[^}]*min-height: 44px/.test(css), 'Show email address button needs a 44px touch target')
ok(/@media \(max-width: 479px\) \{\s*\/\*[^*]*\*\/\s*\.about-seals-list \{ flex-wrap: nowrap/.test(css), 'seals should be one row of three at 390px')
ok(!/Coming in the next version/i.test(html), '/about/: shipped features still listed as coming')
for (const f of ['Drive plans.', 'Research outlines.', 'Printable, PDF and Markdown copies']) ok(html.includes(f), `/about/: main list missing "${f}"`)
ok(!/Terms/i.test(html) && !/Reviewer note/i.test(html), '/about/: reviewer note or Terms recommendation left in')
ok(html.includes('<link rel="canonical" href="https://kyhistorydrive.com/about/"'), '/about/: canonical')
ok(html.includes('property="og:image" content="https://kyhistorydrive.com/brand/og-about.jpg"'), '/about/: og:image')
ok(html.includes('property="og:image:width" content="1200"') && html.includes('property="og:image:height" content="630"'), '/about/: share size')
ok(html.includes('property="og:image:type" content="image/jpeg"'), '/about/: jpeg')
ok(html.includes('name="twitter:card" content="summary_large_image"'), '/about/: twitter card')
ok(html.includes('property="og:image:alt" content="Mississippi River from Columbus-Belmont, Kentucky — Kentucky History Drive"'), '/about/: og alt')
ok(html.includes('https://kyhistorydrive.com/brand/khd-logo-512.png'), '/about/: Organization logo stays the seal')
const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ''
ok(desc && desc.length <= 155, `/about/: meta description ${desc.length} chars`)
ok(html.includes('"@type":"AboutPage"'), '/about/: AboutPage JSON-LD')
ok(/<a [^>]*href="\/"[^>]*>Home<\/a>/.test(html), '/about/: no way back home')
ok(html.includes('class="foot"') && html.includes('href="/about/"'), '/about/: footer')

const about = /<a href="\/about\/"[^>]*>About<\/a>/
ok(about.test(siteFooterHtml()), 'shared footer has no About link')
for (const f of ['index.html', 'privacy/index.html']) {
  const foot = (fs.readFileSync(path.join(root, f), 'utf8').match(/<footer class="foot">[\s\S]*?<\/footer>/) || [''])[0]
  ok(about.test(foot), `${f}: footer has no About link`)
}
const dist = path.join(root, 'dist/about/index.html')
if (fs.existsSync(dist)) ok(fs.readFileSync(dist, 'utf8').includes('Protecting archaeological sites'), 'dist/about/ is stale')

if (fails.length) { console.error(fails.map((f) => `test-about-page: ${f}`).join('\n')); process.exit(1) }
console.log('test-about-page: /about/ copy, meta, JSON-LD, way back and footer links ok')
