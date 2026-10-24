// Item 88: no noindex page may be listed in any dist/sitemap*.xml or feed (RSS/Atom).
// Collects noindex pages from dist HTML (<meta name="robots" content="noindex...">), then scans
// every sitemap and feed <loc>/<link>/<guid>/href URL by parsed pathname (never substring).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const SITE_HOST = 'kyhistorydrive.com'

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

export function noindexPaths(files) {
  const set = new Set()
  for (const f of files.filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(f, 'utf8')
    const m = html.match(/<meta name="robots" content="([^"]{0,200})"/)
    if (!m || !/\bnoindex\b/i.test(m[1])) continue
    const rel = path.relative(dist, f).split(path.sep).join('/')
    set.add(rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`)
    if (!rel.endsWith('index.html')) set.add(`/${rel}`)
  }
  return set
}

export function listedUrls(xml) {
  const urls = []
  for (const m of xml.matchAll(/<(loc|link|guid)\b[^>]{0,200}>([^<]{1,2000})<\/\1>/g)) urls.push(m[2].trim())
  for (const m of xml.matchAll(/<(?:atom:)?link\b[^>]{0,500}?href="([^"]{1,2000})"/g)) urls.push(m[1])
  return urls
}

export function offenders(xml, noindex) {
  const bad = []
  for (const raw of listedUrls(xml)) {
    let u
    try {
      u = new URL(raw.replace(/&amp;/g, '&'))
    } catch {
      continue
    }
    if (u.hostname !== SITE_HOST && u.hostname !== `www.${SITE_HOST}`) continue
    if (noindex.has(u.pathname)) bad.push(u.pathname)
  }
  return bad
}

function selfTest() {
  const set = new Set(['/stories/thin/'])
  const ok = '<urlset><url><loc>https://kyhistorydrive.com/stories/fat/</loc></url></urlset>'
  const bad = '<rss><item><link>https://kyhistorydrive.com/stories/thin/</link></item></rss>'
  const atom = '<feed><entry><link href="https://kyhistorydrive.com/stories/thin/"/></entry></feed>'
  if (offenders(ok, set).length || offenders(bad, set).length !== 1 || offenders(atom, set).length !== 1) {
    throw new Error('check-noindex-feeds: self-test failed')
  }
}

function main() {
  selfTest()
  const files = walk(dist)
  const noindex = noindexPaths(files)
  const targets = files.filter((f) => /^sitemap.*\.xml$/.test(path.basename(f)) || /(^|\/)(feed|rss|atom)[^/]*\.xml$/.test(path.relative(dist, f)) || /\/feeds?\//.test(f) && f.endsWith('.xml'))
  if (!targets.some((f) => path.basename(f) === 'sitemap.xml')) throw new Error('check-noindex-feeds: dist/sitemap.xml missing')
  const problems = []
  for (const f of targets) {
    for (const p of offenders(fs.readFileSync(f, 'utf8'), noindex)) problems.push(`${path.relative(dist, f)}: ${p}`)
  }
  if (problems.length) {
    console.error(`check-noindex-feeds: ${problems.length} noindex URL(s) listed:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
  console.log(`check-noindex-feeds: ${noindex.size} noindex pages; none listed in ${targets.length} sitemap/feed files`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
