/**
 * Editor #291: the 'Railroad sections' <details> on /roads-and-rails/ must open and close on click,
 * show the custom ▸/▾ marker, and stay open when the year slider rebuilds the legend.
 * Serves dist/ on 127.0.0.1 only and blocks outside requests. Skips when no Chrome is installed (Amplify).
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p))
if (!CHROME) { console.log('check-transport-sections: no Chrome found, skipping'); process.exit(0) }
let chromium
try { ({ chromium } = await import('playwright-core')) } catch { console.log('check-transport-sections: playwright-core not installed, skipping'); process.exit(0) }

const dist = path.resolve('dist')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.pbf': 'application/x-protobuf' }
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
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
const fails = []
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.route('**/*', (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()))
    await page.goto(`${origin}/roads-and-rails/`, { waitUntil: 'load' })
    const d = page.locator('details.transport-rail-details')
    await d.locator('summary').waitFor({ timeout: 30000 })
    const state = async () => d.evaluate((e) => [e.open, getComputedStyle(e.querySelector('summary'), '::before').content])
    const want = (label, got, open, mark) => { if (got[0] !== open || !got[1].includes(mark)) fails.push(`${width} ${label}: open=${got[0]} marker=${got[1]}`) }
    want('initial', await state(), false, '▸')
    await d.locator('summary').click(); await page.waitForTimeout(300)
    want('after click', await state(), true, '▾')
    await page.evaluate(() => { const s = document.getElementById('transportYear'); if (s) { s.value = String(Number(s.min) + 30); s.dispatchEvent(new Event('input', { bubbles: true })) } })
    await page.waitForTimeout(300)
    want('after slider', await state(), true, '▾')
    await d.locator('summary').click(); await page.waitForTimeout(300)
    want('after second click', await state(), false, '▸')
    await page.close()
  }
} finally { await browser.close(); server.close() }
if (fails.length) { console.error('check-transport-sections FAILED:\n  ' + fails.join('\n  ')); process.exit(1) }
console.log('check-transport-sections: Railroad sections opens/closes with ▸/▾ at 1280 and 390, and stays open across a year change')
