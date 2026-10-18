#!/usr/bin/env node
/**
 * Item 70: every story whose text involves transportation (roads, traces, rivers, ferries, turnpikes,
 * railroads, parkways; TRANSPORT_KEYWORDS in src/transport-links.js) links once to /roads-and-rails/
 * inline. Fails the build when, in dist/stories/<slug>/index.html:
 *  - a transport-keyword story has no inline /roads-and-rails/ link and is not in the allowlist
 *    (scripts/transport-links.json `allowlist`, for false positives such as a place name);
 *  - a story has more than one such link, or one inside a heading;
 *  - an allowlisted story is also linked, or no longer has a transport keyword (stale entry).
 * Read-only: it never writes files.
 */
import fs from 'node:fs'
import path from 'node:path'
import { TRANSPORT_KEYWORDS } from '../src/transport-links.js'

const config = JSON.parse(fs.readFileSync('scripts/transport-links.json', 'utf8'))
const allow = config.allowlist || {}
const dir = 'public/content/stories'
const LINK = 'class="transport-link" href="/roads-and-rails/"'
const strip = (md) => String(md || '').replace(/^[ \t]*source:[ \t]*.+$/gim, '')
const errors = []
let keyword = 0
let linked = 0
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.json') || f === 'index.json') continue
  const slug = f.slice(0, -5)
  const page = path.join('dist/stories', slug, 'index.html')
  if (!fs.existsSync(page)) continue // drafts and hidden stories have no static page
  const story = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const hasKeyword = TRANSPORT_KEYWORDS.test(strip(story.bodyMarkdown))
  const html = fs.readFileSync(page, 'utf8')
  const n = html.split(LINK).length - 1
  if (hasKeyword) keyword += 1
  if (n) linked += 1
  if (n > 1) errors.push(`${slug}: ${n} inline /roads-and-rails/ links (max 1)`)
  for (let h = html.indexOf('<h'); h >= 0; h = html.indexOf('<h', h + 2)) {
    if (!/[1-6]/.test(html[h + 2] || '')) continue
    const end = html.indexOf('</h', h)
    if (end > h && html.slice(h, end).includes(LINK)) errors.push(`${slug}: /roads-and-rails/ link inside a heading`)
  }
  if (allow[slug]) {
    if (n) errors.push(`${slug}: allowlisted but also linked`)
    if (!hasKeyword) errors.push(`${slug}: allowlisted but has no transport keyword (remove the entry)`)
  } else if (hasKeyword && !n) {
    errors.push(`${slug}: mentions transportation but has no inline /roads-and-rails/ link (add a phrase in scripts/transport-links.json or allowlist it)`)
  }
}
for (const slug of Object.keys(config.stories || {})) {
  const page = path.join('dist/stories', slug, 'index.html')
  if (fs.existsSync(page) && !fs.readFileSync(page, 'utf8').includes(LINK)) errors.push(`${slug}: configured phrase did not render a link`)
}
if (errors.length) {
  console.error(`check-transport-links: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-transport-links: ${keyword} transport-keyword stories; ${linked} link once to /roads-and-rails/; ${Object.keys(allow).length} allowlisted`)
