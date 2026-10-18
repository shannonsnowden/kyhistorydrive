#!/usr/bin/env node
/**
 * Take a Drive: every built story page whose story is a stop on a drive carries one Take a Drive button
 * for its first drive plus an 'Also on:' link for each other drive, all linking to /drives/<id>/#stop-<slug>,
 * and every such href must resolve to an id anchor on that built drive page; no other story page has one.
 * Source of truth: the drive pages' STOPS (scripts/story-drives-lib.mjs), so new stories and drives are
 * covered without a list here. Also checks the Timeline data file (dist/data/web/story-drives.json)
 * matches, and that the Drives index still handles ?drive=.
 * Rendered pass: the drive pages redraw their stop list in the browser, so the static HTML alone can't prove
 * the anchors survive. When Chrome is available (CHROME_PATH or /usr/bin/google-chrome), every drive page is
 * loaded from dist in headless Chrome and each linked #stop-<slug> must exist inside .stops after scripts run
 * and get .is-target and be on screen when navigated to. Set TAKE_A_DRIVE_RENDER=required to fail when Chrome is missing.
 * Usage: node scripts/check-take-a-drive.mjs [--dist <dir>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storyDrives, DRIVE_ID_RE } from './story-drives-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ai = process.argv.indexOf('--dist')
const dist = ai > 0 ? path.resolve(process.argv[ai + 1]) : path.join(root, 'dist')
const errors = []
const expected = storyDrives(root)

const sdir = path.join(dist, 'stories')
const slugs = fs.readdirSync(sdir).filter((d) => fs.existsSync(path.join(sdir, d, 'index.html')))
let withButton = 0
let buttons = 0
let links = 0
const anchorCache = {}
const linked = {} // drive id -> Set of story slugs that Take a Drive links point at
const anchorsOf = (id) => {
  if (!anchorCache[id]) {
    const f = path.join(dist, 'drives', id, 'index.html')
    anchorCache[id] = fs.existsSync(f) ? new Set([...fs.readFileSync(f, 'utf8').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])) : null
  }
  return anchorCache[id]
}
for (const slug of slugs) {
  const html = fs.readFileSync(path.join(sdir, slug, 'index.html'), 'utf8')
  const tags = [...html.matchAll(/<a\b[^>]*class="take-a-drive-(?:btn|alt)"[^>]*>/g)].map((m) => m[0])
  const nBtn = tags.filter((t) => t.includes('class="take-a-drive-btn"')).length
  const want = expected.stories[slug] || []
  if (!want.length) {
    if (tags.length || html.includes('data-take-a-drive')) errors.push(`${slug}: has a Take a Drive button but is on no drive`)
    continue
  }
  if (nBtn !== 1) { errors.push(`${slug}: on ${want.join(', ')} but has ${nBtn} Take a Drive buttons (want 1)`); continue }
  if (want.length > 1 && !html.includes('class="take-a-drive-also"')) errors.push(`${slug}: on ${want.length} drives but has no 'Also on:' row`)
  withButton++
  buttons += nBtn
  links += tags.length
  const ids = []
  for (const t of tags) {
    const href = ((t.match(/href="([^"]*)"/) || [])[1] || '')
    const m = href.match(/^\/drives\/([^/#?"]+)\/#stop-([^&#?"]+)$/)
    const id = m ? decodeURIComponent(m[1]) : ''
    ids.push(id)
    if (!m || !DRIVE_ID_RE.test(id)) { errors.push(`${slug}: bad Take a Drive link "${href}"`); continue }
    if (decodeURIComponent(m[2]) !== slug) errors.push(`${slug}: Take a Drive link "${href}" points at another story's stop`)
    ;(linked[id] ||= new Set()).add(slug)
    const anchors = anchorsOf(id)
    if (!anchors) errors.push(`${slug}: Take a Drive links missing drive "${id}"`)
    else if (!anchors.has(`stop-${slug}`)) errors.push(`${slug}: "${href}" has no matching id="stop-${slug}" on /drives/${id}/`)
    if (!want.includes(id)) errors.push(`${slug}: Take a Drive links ${id}, which has no stop for this story`)
  }
  if (ids[0] !== want[0]) errors.push(`${slug}: the button should be for ${want[0]}`)
  for (const id of want) if (!ids.includes(id)) errors.push(`${slug}: missing Take a Drive link for ${id}`)
  if (new Set(ids).size !== ids.length) errors.push(`${slug}: duplicate Take a Drive links`)
  if (!/class="take-a-drive-icon"/.test(html)) errors.push(`${slug}: Take a Drive button lacks the route-and-car icon`)
}
for (const slug of Object.keys(expected.stories)) {
  if (!slugs.includes(slug)) errors.push(`drive stop links story "${slug}", which has no built page`)
}

// Timeline panel data (src/main.js reads this).
const dataFile = path.join(dist, 'data/web/story-drives.json')
if (!fs.existsSync(dataFile)) errors.push('dist/data/web/story-drives.json is missing (Timeline panels need it)')
else if (JSON.stringify(JSON.parse(fs.readFileSync(dataFile, 'utf8'))) !== JSON.stringify(expected)) {
  errors.push('dist/data/web/story-drives.json is out of date with the drive pages (run build-story-drives)')
}
// Drives index deep link.
const idx = fs.readFileSync(path.join(dist, 'drives/index.html'), 'utf8')
if (!idx.includes('id="drivePick"') || !idx.includes("get('drive')")) errors.push('drives/index.html no longer handles ?drive=')

// Rendered pass (after the page's own scripts redraw the stop list).
let rendered = 'skipped (no Chrome)'
const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium'].find((c) => c && fs.existsSync(c))
if (chrome) {
  const http = await import('node:http')
  const { chromium } = await import('playwright-core')
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.geojson': 'application/json' }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let f = path.join(dist, p)
    if (!f.startsWith(dist)) { res.writeHead(403).end(); return }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html')
    if (!fs.existsSync(f)) { res.writeHead(404).end(); return }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' })
    fs.createReadStream(f).pipe(res)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ executablePath: chrome })
  let pages = 0
  let checked = 0
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    // Block third-party requests (tiles, analytics) so the check is offline and deterministic.
    await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()))
    for (const id of Object.keys(linked).sort()) {
      await page.goto(`${base}/drives/${id}/`, { waitUntil: 'load' })
      await page.waitForTimeout(150)
      const ids = await page.evaluate(() => [...document.querySelectorAll('.stops [id^="stop-"]')].map((e) => e.id))
      pages++
      for (const slug of linked[id]) {
        checked++
        if (!ids.includes(`stop-${slug}`)) { errors.push(`/drives/${id}/: #stop-${slug} is gone after the page's scripts run (rendered stop list)`); continue }
        await page.goto(`${base}/drives/${id}/#stop-${encodeURIComponent(slug)}`, { waitUntil: 'load' })
        await page.waitForTimeout(100)
        const st = await page.evaluate((s) => {
          const li = document.getElementById(`stop-${s}`)?.closest('.stops li')
          if (!li || !li.classList.contains('is-target')) return 'unmarked'
          const r = li.getBoundingClientRect()
          return r.top >= 0 && r.top < innerHeight - 40 ? 'ok' : `off-screen (top ${Math.round(r.top)})`
        }, slug)
        if (st !== 'ok') errors.push(`/drives/${id}/#stop-${slug}: rendered page lands wrong: ${st === 'unmarked' ? 'stop not marked as the target' : 'stop is ' + st}`)
      }
    }
  } finally {
    await browser.close()
    server.close()
  }
  rendered = `rendered ${pages} drive pages in headless Chrome, ${checked} stop anchors present, targeted and in view at 390`
} else if (process.env.TAKE_A_DRIVE_RENDER === 'required') {
  errors.push('Chrome not found and TAKE_A_DRIVE_RENDER=required')
} else {
  console.warn('check-take-a-drive: WARNING rendered pass skipped (no Chrome; set CHROME_PATH)')
}

if (errors.length) {
  console.error(`check-take-a-drive: ${errors.length} problem(s)`)
  for (const e of errors.slice(0, 40)) console.error('  - ' + e)
  process.exit(1)
}
console.log(`check-take-a-drive: ${withButton} stories with a Take a Drive button (${buttons} buttons + ${links - buttons} 'Also on' links = ${links} drive links, all to existing #stop- anchors; ${Object.keys(expected.drives).length} drives); ${slugs.length - withButton} stories without, as expected; ${rendered}`)
