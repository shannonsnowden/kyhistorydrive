/**
 * Roads & Rails left pane (mockup v2, approved Oct 18). In a real browser against dist/:
 *  - the served HTML (before JS) carries one prerendered row per line;
 *  - the four sections (Timeline, Railroads, Highways and parkways, About this map) open and close;
 *  - None hides a group ("0 of N shown"), All restores it, a whole-row click toggles one line;
 *  - More/Less expands a row with aria-expanded;
 *  - at 1280x800 the Highways and parkways header is above the fold;
 *  - at 390 the line groups sit in a bottom sheet that opens, takes focus and closes on Esc.
 * Serves dist/ on 127.0.0.1 only and blocks outside requests. Skips when no Chrome is installed (Amplify).
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { buildLineRows } from '../src/transport-lines.js'

const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p))
if (!CHROME) { console.log('check-transport-sections: no Chrome found, skipping'); process.exit(0) }
let chromium
try { ({ chromium } = await import('playwright-core')) } catch { console.log('check-transport-sections: playwright-core not installed, skipping'); process.exit(0) }

const dist = path.resolve('dist')
const secs = JSON.parse(fs.readFileSync(path.join(dist, 'maps/transport/sections.geojson'), 'utf8'))
const groups = buildLineRows(secs.features)
const nRows = groups.reduce((n, g) => n + g.rows.length, 0)
const served = fs.readFileSync(path.join(dist, 'roads-and-rails/index.html'), 'utf8')
const fails = []
const prerendered = (served.match(/<li class="rr-row"/g) || []).length
if (prerendered !== nRows) fails.push(`prerendered rows ${prerendered} != ${nRows} lines`)

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.pbf': 'application/x-protobuf' }
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let f = path.join(dist, p)
  if (!f.startsWith(dist)) { res.writeHead(403); return res.end() }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html')
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ executablePath: CHROME, args: ['--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
try {
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } })
    await page.route('**/*', (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()))
    await page.goto(`${origin}/roads-and-rails/`, { waitUntil: 'load' })
    await page.waitForSelector('.transport-controls[data-pane-ready]', { timeout: 30000 })
    const tag = (m) => fails.push(`${width}: ${m}`)
    if ((await page.locator('.rr-row').count()) !== nRows) tag(`rows ${await page.locator('.rr-row').count()} != ${nRows}`)
    // Sections open and close.
    for (const id of ['timeline', 'rail', 'highways', 'about']) {
      const d = page.locator(`#rrSec-${id}`)
      if (!(await d.count())) { tag(`section ${id} missing`); continue }
      if (width < 900 && (id === 'rail' || id === 'highways')) continue // these live in the sheet on phones
      const before = await d.evaluate((e) => e.open)
      await d.locator(':scope > summary').click()
      const after = await d.evaluate((e) => e.open)
      if (after === before) tag(`section ${id} did not toggle`)
      await d.locator(':scope > summary').click()
    }
    if (width >= 900) {
      // Editor: Highways header above the fold at 1280x800.
      const box = await page.locator('#rrSec-highways > summary').boundingBox()
      if (!box || box.y + box.height > height) tag(`Highways header below the fold (bottom ${box && Math.round(box.y + box.height)} > ${height})`)
    } else {
      const handle = page.locator('.rr-sheet-handle')
      await handle.click()
      if ((await handle.getAttribute('aria-expanded')) !== 'true') tag('sheet did not open')
      const focusIn = await page.evaluate(() => !!document.activeElement?.closest('.rr-sheet-body'))
      if (!focusIn) tag('focus did not move into the sheet')
      if (!(await page.locator('.rr-sheet #rrSec-rail').count())) tag('Railroads not in the sheet')
    }
    // None / All / whole-row toggle on Railroads.
    const rail = page.locator('#rrSec-rail')
    await rail.evaluate((e) => { e.open = true })
    const count = rail.locator('.rr-count').first()
    await rail.locator('[data-all="0"]').first().click()
    if (!/^0 of 4 shown$/.test((await count.textContent()).trim())) tag(`None: ${await count.textContent()}`)
    const hidden = await page.evaluate(() => window.__khdTransportHidden?.() || [])
    if (hidden.length < 4) tag(`None hid ${hidden.length} sections`)
    await rail.locator('[data-all="1"]').first().click()
    if (!/^4 of 4 shown$/.test((await count.textContent()).trim())) tag(`All: ${await count.textContent()}`)
    const firstRow = rail.locator('.rr-row').first()
    await firstRow.locator('.rr-row-name').click()
    if (await firstRow.locator('input').isChecked()) tag('row click did not toggle')
    if (!/^3 of 4 shown$/.test((await count.textContent()).trim())) tag(`row click count: ${await count.textContent()}`)
    await firstRow.locator('.rr-row-name').click()
    const more = rail.locator('.rr-more').first()
    await more.click()
    if ((await more.getAttribute('aria-expanded')) !== 'true') tag('More did not expand')
    if (!(await firstRow.locator('input').isChecked())) tag('More toggled the line')
    if (width < 900) {
      await page.keyboard.press('Escape')
      if ((await page.locator('.rr-sheet-handle').getAttribute('aria-expanded')) !== 'false') tag('Esc did not close the sheet')
      const back = await page.evaluate(() => document.activeElement?.classList.contains('rr-sheet-handle'))
      if (!back) tag('focus did not return to the sheet handle')
    }
    await page.close()
  }
} finally { await browser.close(); server.close() }
if (fails.length) { console.error('check-transport-sections FAILED:\n  ' + fails.join('\n  ')); process.exit(1) }
console.log(`check-transport-sections: ${nRows} prerendered rows; sections, All/None, row toggle, More, 1280 fold and 390 sheet OK`)
