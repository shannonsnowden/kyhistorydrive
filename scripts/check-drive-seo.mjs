#!/usr/bin/env node
/**
 * check-drive-seo: fails the build when a /drives/ page in dist breaks the SEO basics.
 *  - <title> <= 60 and meta description <= 160 characters (decoded text), both unique.
 *  - Each drive page: TouristTrip + BreadcrumbList JSON-LD, and a prerendered stop list with at
 *    least one <li> (so the stops exist without JS). /drives/: CollectionPage + ItemList.
 *  - /drives/build/ (the planner) is noindex and not in sitemap.xml; every other drive page is.
 * Usage: node scripts/check-drive-seo.mjs [--dist dist]
 */
import fs from 'node:fs'
import path from 'node:path'

const i = process.argv.indexOf('--dist')
const dist = path.resolve(i > 0 ? process.argv[i + 1] : 'dist')
const root = path.join(dist, 'drives')
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" }
// One-pass entity decode, used only to measure lengths.
const decode = (s) => s.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (m) => ENT[m]).trim()
const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8')
const errors = []
const seenT = new Map(), seenD = new Map()
const pages = ['', ...fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(root, d.name, 'index.html'))).map((d) => d.name)]
for (const slug of pages) {
  const loc = `/drives/${slug ? slug + '/' : ''}`
  const html = fs.readFileSync(path.join(root, slug, 'index.html'), 'utf8')
  const title = decode(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '')
  const desc = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] || '')
  if (!title || title.length > 60) errors.push(`${loc} title is ${title.length} chars (max 60): ${title}`)
  if (!desc || desc.length > 160) errors.push(`${loc} description is ${desc.length} chars (max 160)`)
  if (seenT.has(title)) errors.push(`${loc} title duplicates ${seenT.get(title)}`); else seenT.set(title, loc)
  if (seenD.has(desc)) errors.push(`${loc} description duplicates ${seenD.get(desc)}`); else seenD.set(desc, loc)
  const types = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])['@type'])
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html)
  const inMap = sitemap.includes(`<loc>https://kyhistorydrive.com${loc}</loc>`)
  if (slug === 'build') {
    if (!noindex) errors.push('/drives/build/ must be noindex')
    if (inMap) errors.push('/drives/build/ must not be in sitemap.xml')
    continue
  }
  if (noindex) errors.push(`${loc} is noindex`)
  if (!inMap) errors.push(`${loc} is missing from sitemap.xml`)
  if (!html.includes(`<link rel="canonical" href="https://kyhistorydrive.com${loc}" />`)) errors.push(`${loc} has no self canonical`)
  if (!types.includes('BreadcrumbList')) errors.push(`${loc} has no BreadcrumbList JSON-LD`)
  if (!slug) { if (!types.includes('CollectionPage')) errors.push('/drives/ has no CollectionPage JSON-LD'); continue }
  if (!types.includes('TouristTrip')) errors.push(`${loc} has no TouristTrip JSON-LD`)
  const ol = html.match(/<ol class="stops" id="stops">([\s\S]*?)<\/ol>/)?.[1] || ''
  if (!/<li[\s>]/.test(ol)) errors.push(`${loc} stop list is not prerendered`)
}
if (errors.length) {
  for (const e of errors) console.error('check-drive-seo: ' + e)
  process.exit(1)
}
console.log(`check-drive-seo: ${pages.length} /drives/ pages: titles <= 60, descriptions <= 160, JSON-LD and prerendered stops present; planner noindex and out of the sitemap`)
