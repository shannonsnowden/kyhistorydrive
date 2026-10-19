#!/usr/bin/env node
/**
 * check-site-hygiene: Phase 0 site fixes (Shannon items 87/93), checked on the built dist/.
 *  - /404.html: "We couldn't find that page", a story search form, Browse all stories (/stories/), Home; noindex.
 *  - index.html sends a visitor on an unknown path (Amplify serves index.html there) to /404.html.
 *  - Every /drives/ page has the shared site footer with a Privacy link.
 *  - No same-site link on a /drives/ page points at a file that is not built (the Loop 1 bug).
 *  - /home-preview/ and /drive-preview/ are not built (their redirects can fire).
 *  - /privacy/ has one h1 and a "Last updated" date.
 *  - /videos/ and /routes/ are noindex,follow and out of sitemap.xml; no sitemap URL is noindex.
 * Links are parsed with URL, never matched as substrings.
 *   node scripts/check-site-hygiene.mjs [--dist <dir>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.resolve(argv.includes('--dist') ? argv[argv.indexOf('--dist') + 1] : path.join(root, 'dist'))
const SITE = 'https://kyhistorydrive.com'
const problems = []
const fail = (m) => problems.push(m)
const read = (rel) => {
  const f = path.join(dist, rel)
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null
}
const hrefs = (html) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)].map((m) => m[1].replace(/&amp;/g, '&'))
const robots = (html) => (html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i) || [])[1] || ''
/**
 * Drop every <tag ...>...</tag ...> block. Scans with indexOf, not a regex, and
 * repeats until none are left; an unclosed block drops the rest of the page.
 */
const dropBlocks = (html, tag) => {
  const open = `<${tag}`
  const close = `</${tag}`
  let out = html
  for (;;) {
    const lower = out.toLowerCase()
    const start = lower.indexOf(open)
    if (start < 0) return out
    const end = lower.indexOf(close, start + open.length)
    if (end < 0) return out.slice(0, start)
    const gt = lower.indexOf('>', end + close.length)
    out = `${out.slice(0, start)} ${gt < 0 ? '' : out.slice(gt + 1)}`
  }
}
const text = (html) => dropBlocks(dropBlocks(html, 'script'), 'style').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;|&rsquo;|’/g, "'").replace(/\s+/g, ' ')
/** Path of a link on page `pageUrl` when it stays on this site, else null. */
const sitePath = (href, pageUrl) => {
  let u
  try {
    u = new URL(href, pageUrl)
  } catch {
    return null
  }
  return u.origin === SITE ? u.pathname : null
}
/** A same-site path is fine when dist has the file, or a directory index for it. */
const built = (p) => {
  const rel = decodeURIComponent(p).replace(/^\/+/, '')
  const f = path.join(dist, rel)
  if (!f.startsWith(dist)) return false
  if (p.endsWith('/')) return fs.existsSync(path.join(f, 'index.html'))
  return fs.existsSync(f) && fs.statSync(f).isFile()
}

// 404 page
const nf = read('404.html')
if (!nf) fail('dist/404.html is missing')
else {
  const t = text(nf)
  if (!/<h1[^>]*>\s*We couldn(?:'|&#x27;|’)t find that page\s*<\/h1>/i.test(nf)) fail("404.html: h1 must be \"We couldn't find that page\"")
  if (!/\bnoindex\b/.test(robots(nf))) fail('404.html: needs meta robots noindex')
  if (/rel="canonical"/.test(nf)) fail('404.html: must not have a canonical')
  const links = new Set(hrefs(nf).map((h) => sitePath(h, `${SITE}/404.html`)))
  if (!links.has('/stories/') || !/Browse all stories/.test(t)) fail('404.html: needs a "Browse all stories" link to /stories/')
  if (!links.has('/')) fail('404.html: needs a Home link to /')
  const form = nf.match(/<form\b[^>]*>[\s\S]*?<\/form>/i)?.[0] || ''
  const action = (form.match(/\baction="([^"]*)"/) || [])[1]
  if (!form || sitePath(action || '', `${SITE}/404.html`) !== '/stories/' || !/method="get"/i.test(form) || !/<input\b[^>]*\bname="q"/.test(form)) {
    fail('404.html: needs a GET search form to /stories/ with an input named q')
  }
  if (!/class="foot"/.test(nf)) fail('404.html: needs the site footer')
  // Root-absolute assets only: 404.html is served at any depth.
  for (const m of nf.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    const v = m[1]
    if (/^(?:[a-z]+:|\/|#|data:)/i.test(v)) continue
    fail(`404.html: relative URL "${v}" breaks at nested paths`)
  }
}
const stories = read('stories/index.html') || ''
if (!/URLSearchParams\(location\.search\)\.get\('q'\)/.test(stories)) fail('/stories/: filter must read ?q= from the 404 search form')

// Unknown-path guard on the homepage document.
const home = read('index.html') || ''
if (!/<script>[^<]*khd-404-guard[^<]*location\.replace\('\/404\.html'\)/.test(home)) fail('index.html: missing the unknown-path guard to /404.html')

// Drive pages
const driveDir = path.join(dist, 'drives')
const drivePages = []
;(function walk(d) {
  if (!fs.existsSync(d)) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name)
    if (e.isDirectory()) walk(f)
    else if (e.name === 'index.html') drivePages.push(f)
  }
})(driveDir)
if (drivePages.length < 25) fail(`expected at least 25 /drives/ pages, found ${drivePages.length}`)
for (const f of drivePages) {
  const rel = path.relative(dist, f).split(path.sep).join('/')
  const pageUrl = `${SITE}/${rel.replace(/index\.html$/, '')}`
  const html = fs.readFileSync(f, 'utf8')
  const foot = html.match(/<footer class="foot"[\s\S]*?<\/footer>/)?.[0]
  if (!foot) fail(`${rel}: missing the site footer`)
  else if (!hrefs(foot).some((h) => sitePath(h, pageUrl) === '/privacy/')) fail(`${rel}: footer has no Privacy link`)
  // Links in the page markup (template strings inside <script> are not links).
  for (const h of hrefs(dropBlocks(html, 'script'))) {
    const p = sitePath(h, pageUrl)
    if (p == null || p === '/') continue
    if (!built(p)) fail(`${rel}: link "${h}" resolves to ${p}, which is not built`)
  }
}

// Stubs at redirected paths
for (const d of ['home-preview', 'drive-preview']) if (fs.existsSync(path.join(dist, d))) fail(`dist/${d}/ is built; its redirect cannot fire`)

// Privacy
const pv = read('privacy/index.html') || ''
const h1s = pv.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g) || []
if (h1s.length !== 1 || !/>\s*Privacy\s*</.test(h1s[0] || '')) fail('/privacy/: needs exactly one h1 "Privacy"')
if (!/Last updated:?\s*<time datetime="\d{4}-\d{2}-\d{2}">[^<]+<\/time>/.test(pv)) fail('/privacy/: needs "Last updated" with a <time datetime>')

// noindex pages and the sitemap
const sm = read('sitemap.xml') || ''
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
  try {
    return new URL(m[1]).pathname
  } catch {
    return m[1]
  }
})
if (!locs.length) fail('sitemap.xml has no URLs')
for (const p of ['/videos/', '/routes/']) {
  const html = read(`${p.slice(1)}index.html`) || ''
  if (!html) fail(`${p} is not built`)
  if (robots(html).replace(/\s/g, '') !== 'noindex,follow') fail(`${p}: needs meta robots "noindex, follow"`)
  if (locs.includes(p)) fail(`sitemap.xml still lists ${p}`)
}
for (const p of locs) {
  const html = read(p.endsWith('/') ? `${p.slice(1)}index.html` : p.slice(1))
  if (html && /\bnoindex\b/.test(robots(html))) fail(`sitemap.xml lists noindex page ${p}`)
}

if (problems.length) {
  console.error(`check-site-hygiene: ${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-site-hygiene: 404 page, ${drivePages.length} drive footers and links, no preview stubs, privacy h1 + date, ${locs.length} sitemap URLs with /videos/ and /routes/ noindexed and out`)
