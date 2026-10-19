#!/usr/bin/env node
/**
 * Roads & Rails removal (Shannon, Oct 19): checks dist/ for the current KHD_ROADS_RAILS mode.
 * Off (default): the homepage header, mobile menu, footer and CTAs, and every built page, have no internal
 * link to /roads-and-rails or /roads-rails; sitemap.xml lists no such URL; story pages carry no transport
 * link; /roads-and-rails/ and /roads-rails/ are noindex redirect stubs to the map.
 * On: /roads-and-rails/ is the map page again, it is in the nav and in sitemap.xml.
 * URLs are parsed with new URL() and compared by host and pathname.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { roadsRailsEnabled, isRoadsRailsPath, ROADS_RAILS_FLAG } from './roads-rails-flag.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = process.env.CHECK_RR_DIST || path.join(root, 'dist')
const SITE = 'https://kyhistorydrive.com'
const HOST = new URL(SITE).host
const on = roadsRailsEnabled()
const errors = []

function htmlFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name)
    if (e.isDirectory()) htmlFiles(f, out)
    else if (e.name.endsWith('.html')) out.push(f)
  }
  return out
}
const pageUrl = (file) => `${SITE}/${path.relative(dist, file).split(path.sep).join('/').replace(/(^|\/)index\.html$/, '$1')}`
function hrefs(html, base) {
  const out = []
  for (const m of html.matchAll(/<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    try {
      out.push(new URL((m[1] ?? m[2] ?? '').replace(/&amp;/g, '&'), base))
    } catch {
      /* not a URL */
    }
  }
  return out
}
const isRR = (u) => u.host === HOST && isRoadsRailsPath(u.pathname)
const block = (html, re) => (re.exec(html) || [''])[0]

const home = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const nav = block(home, /<nav id="mainNav"[\s\S]*?<\/nav>/)
const header = block(home, /<header class="top site-header">[\s\S]*?<\/header>/)
const footer = block(home, /<footer[\s\S]*?<\/footer>/)
if (!nav || !header || !footer) errors.push('dist/index.html: header, nav or footer not found')

const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8')
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1].replace(/&amp;/g, '&')))
const sitemapRR = locs.filter(isRR)
const rrFile = path.join(dist, 'roads-and-rails', 'index.html')
const rrHtml = fs.existsSync(rrFile) ? fs.readFileSync(rrFile, 'utf8') : ''

let pages = 0
if (!on) {
  for (const [name, part] of [['header', header], ['nav (mobile menu)', nav], ['footer', footer], ['homepage', home]]) {
    if (hrefs(part, `${SITE}/`).some(isRR)) errors.push(`homepage ${name} links to Roads & Rails`)
  }
  if (/data-route="roads"/.test(home)) errors.push('homepage still has the roads nav item')
  for (const f of htmlFiles(dist)) {
    pages += 1
    const html = fs.readFileSync(f, 'utf8')
    const base = pageUrl(f)
    if (hrefs(html, base).some(isRR)) errors.push(`${path.relative(dist, f)}: internal link to Roads & Rails`)
    if (/data-route="roads"/.test(html)) errors.push(`${path.relative(dist, f)}: roads nav item`)
    if (/class="transport-link"/.test(html)) errors.push(`${path.relative(dist, f)}: injected transport story link`)
  }
  if (sitemapRR.length) errors.push(`sitemap.xml lists ${sitemapRR.map((u) => u.pathname).join(', ')}`)
  const tl = path.join(dist, 'data/web/transport-links.json')
  if (fs.existsSync(tl) && Object.keys(JSON.parse(fs.readFileSync(tl, 'utf8')).stories || {}).length) errors.push('data/web/transport-links.json still lists stories')
  for (const p of ['roads-and-rails', 'roads-rails']) {
    const f = path.join(dist, p, 'index.html')
    const html = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''
    const refresh = /<meta http-equiv="refresh" content="0; url=([^"]+)">/.exec(html)
    const canon = /<link rel="canonical" href="([^"]+)">/.exec(html)
    if (!refresh || new URL(refresh[1], `${SITE}/${p}/`).href !== `${SITE}/#map`) errors.push(`/${p}/ is not a redirect stub to the map`)
    if (!canon || new URL(canon[1]).href !== `${SITE}/`) errors.push(`/${p}/ stub canonical is not the homepage`)
    if (!/<meta name="robots" content="noindex, follow">/.test(html)) errors.push(`/${p}/ stub is not noindex`)
    if (/id="transportMap"/.test(html)) errors.push(`/${p}/ still serves the map page`)
  }
} else {
  if (!/id="transportMap"/.test(rrHtml)) errors.push('flag on: /roads-and-rails/ is not the map page')
  if (!hrefs(nav, `${SITE}/`).some(isRR)) errors.push('flag on: homepage nav has no Roads & Rails link')
  if (sitemapRR.length !== 1) errors.push(`flag on: sitemap.xml should list /roads-and-rails/ once (found ${sitemapRR.length})`)
}

if (errors.length) {
  console.error(`check-roads-rails-removed (${ROADS_RAILS_FLAG}=${on ? '1' : 'off'}): ${errors.length} problem(s)\n  ${errors.slice(0, 40).join('\n  ')}`)
  process.exit(1)
}
console.log(on
  ? `check-roads-rails-removed: ${ROADS_RAILS_FLAG}=1, /roads-and-rails/ is built, in the nav and in sitemap.xml`
  : `check-roads-rails-removed: ${pages} built pages and ${locs.length} sitemap URLs have no Roads & Rails link; /roads-and-rails/ and /roads-rails/ are stubs to the map`)
