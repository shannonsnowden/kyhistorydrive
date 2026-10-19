/**
 * Editor #326: at 390 (light and dark) every timeline tick must own its tap target. For each tick, sample a
 * grid over its tap area (the button's box, plus a 36x44px box centred on its visible label) with
 * elementFromPoint and require >= 95% of the samples to land on that tick; each tap area is >= 36x44px.
 * Serves dist/ on 127.0.0.1 only and blocks outside requests. Skips when no Chrome is installed (Amplify).
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p))
if (!CHROME) { console.log('check-transport-tick-hits: no Chrome found, skipping'); process.exit(0) }
let chromium
try { ({ chromium } = await import('playwright-core')) } catch { console.log('check-transport-tick-hits: playwright-core not installed, skipping'); process.exit(0) }

const MIN_SHARE = 0.95
const dist = path.resolve('dist')
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
const fails = []
const summary = []
try {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    await page.addInitScript((s) => { try { localStorage.setItem('khd-theme', s) } catch {} }, scheme)
    await page.route('**/*', (r) => (new URL(r.request().url()).origin === origin ? r.continue() : r.abort()))
    await page.goto(`${origin}/roads-and-rails/`, { waitUntil: 'load' })
    await page.locator('.transport-tick').first().waitFor({ timeout: 30000 })
    await page.locator('#transportTicks').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    const res = await page.evaluate(() => {
      const ticks = [...document.querySelectorAll('.transport-tick')]
      return ticks.map((t) => {
        const label = t.querySelector('.transport-tick-label') || t
        const b = t.getBoundingClientRect()
        const l = label.getBoundingClientRect()
        const cx = l.left + l.width / 2, cy = l.top + l.height / 2
        const boxes = [
          { x: b.left, y: b.top, w: b.width, h: b.height },
          { x: cx - 18, y: cy - 22, w: 36, h: 44 },
        ]
        let n = 0, hit = 0
        for (const r of boxes)
          for (let i = 0; i < 9; i++)
            for (let j = 0; j < 11; j++) {
              const x = r.x + (r.w * (i + 0.5)) / 9, y = r.y + (r.h * (j + 0.5)) / 11
              n++
              if (document.elementFromPoint(x, y)?.closest('.transport-tick') === t) hit++
            }
        return { year: t.dataset.year, share: hit / n, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }
      })
    })
    const min = res.reduce((m, r) => (r.share < m.share ? r : m), res[0])
    summary.push(`${scheme}: ${res.length} ticks, worst ${min.year} ${(min.share * 100).toFixed(1)}%, smallest button ${Math.min(...res.map((r) => r.w))}x${Math.min(...res.map((r) => r.h))}`)
    for (const r of res) if (r.w < 36 || r.h < 44) fails.push(`${scheme} ${r.year}: tap area ${r.w}x${r.h}px, under 36x44`)
    for (const r of res) if (r.share < MIN_SHARE) fails.push(`${scheme} ${r.year}: ${(r.share * 100).toFixed(1)}% of its tap area hits it`)
    await ctx.close()
  }
} finally { await browser.close(); server.close() }
if (fails.length) { console.error('check-transport-tick-hits FAILED:\n  ' + fails.join('\n  ') + '\n  ' + summary.join('\n  ')); process.exit(1) }
console.log(`check-transport-tick-hits: every tick owns >= ${MIN_SHARE * 100}% of its tap area at 390 (${summary.join('; ')})`)
