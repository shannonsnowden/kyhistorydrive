#!/usr/bin/env node
/**
 * check-site-hygiene: Phase 0 site fixes (Shannon items 87/93), checked on the built dist/.
 *  - /404.html and /404/index.html (the same page; Amplify 301s /404.html to /404/): "We couldn't find
 *    that page", a story search form, Browse all stories (/stories/), Home; noindex; root-absolute URLs.
 *  - Item 90: the Amplify console serves /404/ for unknown paths, so index.html has no khd-404-guard
 *    script and the 404 page has no ?from= pre-fill.
 *  - Every /drives/ page has the shared site footer with a Privacy link.
 *  - No same-site link on a /drives/ page points at a file that is not built (the Loop 1 bug).
 *  - /home-preview/ and /drive-preview/ are not built (their redirects can fire).
 *  - /privacy/ has one h1 and a "Last updated" date.
 *  - /videos/ and /routes/ are noindex,follow and out of sitemap.xml; no sitemap URL is noindex.
 *  - /editorial/ and /contact/ are built, indexable, and listed in sitemap.xml.
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

// 404 page, at both addresses
/** Body of the first inline <script> carrying `marker`, found with indexOf (no tag regex). */
const inlineScript = (html, marker) => {
  const at = html.indexOf(marker)
  if (at < 0) return ''
  const open = html.lastIndexOf('<script>', at)
  const close = html.indexOf('</script>', at)
  return open < 0 || close < 0 ? '' : html.slice(open + '<script>'.length, close)
}
const nfFiles = ['404.html', '404/index.html']
const nfPages = nfFiles.map((rel) => [rel, read(rel)])
for (const [rel, nf] of nfPages) {
  if (!nf) {
    fail(`dist/${rel} is missing`)
    continue
  }
  const pageUrl = `${SITE}/${rel.replace(/index\.html$/, '')}`
  const t = text(nf)
  if (!/<h1[^>]*>\s*We couldn(?:'|&#x27;|’)t find that page\s*<\/h1>/i.test(nf)) fail(`${rel}: h1 must be "We couldn't find that page"`)
  if (!/\bnoindex\b/.test(robots(nf))) fail(`${rel}: needs meta robots noindex`)
  if (/rel="canonical"/.test(nf)) fail(`${rel}: must not have a canonical`)
  const links = new Set(hrefs(nf).map((h) => sitePath(h, pageUrl)))
  if (!links.has('/stories/') || !/Browse all stories/.test(t)) fail(`${rel}: needs a "Browse all stories" link to /stories/`)
  if (!links.has('/')) fail(`${rel}: needs a Home link to /`)
  const form = nf.match(/<form\b[^>]*>[\s\S]*?<\/form>/i)?.[0] || ''
  const action = (form.match(/\baction="([^"]*)"/) || [])[1]
  if (!form || sitePath(action || '', pageUrl) !== '/stories/' || !/method="get"/i.test(form) || !/<input\b[^>]*\bname="q"/.test(form)) {
    fail(`${rel}: needs a GET search form to /stories/ with an input named q`)
  }
  if (!/class="foot"/.test(nf)) fail(`${rel}: needs the site footer`)
  // Root-absolute assets only: the page is served at /404/ and at any missing depth.
  for (const m of nf.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    const v = m[1]
    if (/^(?:[a-z]+:|\/|#|data:)/i.test(v)) continue
    fail(`${rel}: relative URL "${v}" breaks at nested paths`)
  }
}
if (nfPages[0][1] && nfPages[1][1] && nfPages[0][1] !== nfPages[1][1]) fail('404.html and 404/index.html must be the same page')

// Item 90: the Amplify console serves /404/ for unknown paths, so the ?from= pre-fill is gone.
if (/khd-404-from|[?&]from=/.test(nfPages[1][1] || '')) fail('404/index.html: the ?from= pre-fill must be removed (item 90)')
const stories = read('stories/index.html') || ''
if (!/URLSearchParams\(location\.search\)\.get\('q'\)/.test(stories)) fail('/stories/: filter must read ?q= from the 404 search form')

// Item 90: the client-side unknown-path guard is replaced by the Amplify console 404 rule.
const home = read('index.html') || ''
if (/khd-404-guard|\/404\/\?from=/.test(home)) fail('index.html: the khd-404-guard script must be removed (item 90)')

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
for (const p of ['/editorial/', '/contact/']) {
  const html = read(`${p.slice(1)}index.html`) || ''
  if (!html) fail(`${p} is not built`)
  if (/\bnoindex\b/.test(robots(html))) fail(`${p} must be indexable`)
  if (!locs.includes(p)) fail(`sitemap.xml is missing ${p}`)
}
for (const p of locs) {
  const html = read(p.endsWith('/') ? `${p.slice(1)}index.html` : p.slice(1))
  if (html && /\bnoindex\b/.test(robots(html))) fail(`sitemap.xml lists noindex page ${p}`)
}

if (problems.length) {
  console.error(`check-site-hygiene: ${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-site-hygiene: 404 page at /404.html and /404/ (no client guard or ?from= pre-fill), ${drivePages.length} drive footers and links, no preview stubs, privacy h1 + date, ${locs.length} sitemap URLs with /videos/ and /routes/ noindexed and out, /editorial/ and /contact/ indexed`)
