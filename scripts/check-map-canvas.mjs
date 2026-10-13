/**
 * Guard for the #map canvas.
 *
 * The light-theme page background used to show through the tiles after a pin
 * click (a scrollport on the transformed popup cleared a WebGL rectangle) and
 * again between the canvas and the footer (an empty second grid row).
 *
 * Source checks always run. The browser check runs when Chrome is installed
 * (Amplify's build image has no Chrome, so that part is skipped there).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error('check-map-canvas:', msg)
}

function assertSource() {
  const territory = readFileSync(resolve(root, 'src/territory.css'), 'utf8')
  const styles = readFileSync(resolve(root, 'src/styles.css'), 'utf8')
  const main = readFileSync(resolve(root, 'src/main.js'), 'utf8')

  if (/\.map-section>\.controls\{grid-row:\s*1\s*\/\s*span\s*2\}/.test(territory)) {
    fail('controls still span two grid rows while the note panel is closed')
  }
  if (!territory.includes('.map-section:has(>.terr-notepanel:not([hidden]))>.controls{grid-row:1/span 2}')) {
    fail('the note panel no longer spans the controls only while it is open')
  }

  const contentRules = [...styles.matchAll(/\.ky-popup \.maplibregl-popup-content\s*\{[^}]*\}/g)].map((m) => m[0])
  if (!contentRules.length) fail('missing .ky-popup .maplibregl-popup-content rule')
  for (const rule of contentRules) {
    if (/overflow-y:\s*auto/.test(rule) || /overflow:\s*auto/.test(rule)) {
      fail('popup shell is a scrollport again (overflow auto on .maplibregl-popup-content)')
    }
  }
  if (!/\.ky-popup \.map-popup\s*\{[^}]*overflow-y:\s*auto/.test(styles)) {
    fail('pin card no longer scrolls on .map-popup')
  }
  if (/content\.style\.overflowY\s*=\s*['"]auto['"]/.test(main)) {
    fail('showDetailPopup sets overflowY auto on the popup shell')
  }
}

function hasChrome() {
  try {
    execFileSync('google-chrome', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function parseRgb(color) {
  const m = String(color).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

async function inspect(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#mapCanvas canvas.maplibregl-canvas')
    const section = document.getElementById('map')
    const footer = document.querySelector('footer.foot')
    if (!canvas || !section || !footer) return { error: 'map, canvas, or footer missing' }
    const cr = canvas.getBoundingClientRect()
    const sr = section.getBoundingClientRect()
    const fr = footer.getBoundingClientRect()
    const allowed = (el) =>
      el === canvas ||
      el.contains(canvas) ||
      canvas.contains(el) ||
      el.closest('#mapCanvas') ||
      el.id === 'zoomFullStateMap' ||
      el.closest('.terr-maplegend, .terr-overlay, .maplibregl-popup, .maplibregl-ctrl')
    const offenders = []
    for (const el of document.querySelectorAll('body *')) {
      if (allowed(el) || el.closest('[hidden]')) continue
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8) continue
      const w = Math.max(0, Math.min(r.right, cr.right) - Math.max(r.left, cr.left))
      const h = Math.max(0, Math.min(r.bottom, cr.bottom) - Math.max(r.top, cr.top))
      if (w * h < 2000) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
      const paints =
        (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') ||
        parseFloat(cs.borderTopWidth) > 0
      if (!paints && !(el.innerText || '').trim()) continue
      offenders.push({
        id: el.id,
        className: String(el.className).slice(0, 120),
        w: Math.round(w),
        h: Math.round(h),
      })
    }
    const popup = document.querySelector('.map-popup')
    return {
      gapToFooter: Math.round(fr.top - cr.bottom),
      sectionGap: Math.round(sr.bottom - cr.bottom),
      canvas: { x: cr.x, y: cr.y, w: cr.width, h: cr.height, bottom: cr.bottom, right: cr.right },
      bg: getComputedStyle(document.body).backgroundColor,
      offenders,
      title: popup?.querySelector('h3')?.textContent || '',
      scrollable: popup ? popup.scrollHeight > popup.clientHeight + 40 : false,
      shellOverflow: document.querySelector('.maplibregl-popup-content')
        ? getComputedStyle(document.querySelector('.maplibregl-popup-content')).overflowY
        : '',
    }
  })
}

/** A solid page-background rectangle inside the canvas is the tile hole. */
async function pageBgBlock(page, canvas, rgb) {
  const clip = {
    x: Math.max(0, Math.floor(canvas.x)),
    y: Math.max(0, Math.floor(canvas.y)),
    width: Math.max(1, Math.floor(Math.min(canvas.right, page.viewportSize().width) - Math.max(0, canvas.x))),
    height: Math.max(1, Math.floor(Math.min(canvas.bottom, page.viewportSize().height) - Math.max(0, canvas.y))),
  }
  const buf = await page.screenshot({ type: 'png', clip })
  const { default: sharp } = await import('sharp')
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  let runRows = 0
  let bestW = 0
  let bestH = 0
  let streak = 0
  for (let y = 0; y < height; y++) {
    let run = 0
    let best = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const on = data[i] === rgb[0] && data[i + 1] === rgb[1] && data[i + 2] === rgb[2]
      run = on ? run + 1 : 0
      if (run > best) best = run
    }
    if (best >= 160) {
      streak++
      if (best > bestW) bestW = best
      if (streak > bestH) bestH = streak
    } else streak = 0
    if (best >= 160) runRows++
  }
  return { w: bestW, h: bestH, rows: runRows }
}

async function openMap(page, base, hash, viewport) {
  await page.setViewportSize(viewport)
  await page.addInitScript(() => {
    try { localStorage.setItem('khd-theme', 'light') } catch { /* private mode */ }
  })
  await page.goto(`${base}?adpreview=1${hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('#mapCanvas canvas', { timeout: 20000 })
  if (hash.includes('/history/')) {
    await page.waitForSelector('.map-popup h3', { timeout: 20000 })
  }
  await page.waitForTimeout(1200)
  if (viewport.width < 900) {
    await page.evaluate(() => document.getElementById('mapCanvas')?.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(200)
  }
}

async function checkViewport(page, base, viewport, hash, { popup }) {
  const label = `${viewport.width}x${viewport.height} ${popup ? 'popup' : 'no popup'}`
  const before = failures.length
  await openMap(page, base, hash, viewport)
  const info = await inspect(page)
  if (info.error) {
    fail(`${label}: ${info.error}`)
    return
  }
  if (info.gapToFooter > 8) fail(`${label}: canvas ends ${info.gapToFooter}px above the footer`)
  if (info.sectionGap > 8) fail(`${label}: canvas is ${info.sectionGap}px shorter than the map section`)
  if (info.offenders.length) {
    fail(`${label}: non-map element overlaps the canvas ${JSON.stringify(info.offenders.slice(0, 4))}`)
  }
  const rgb = parseRgb(info.bg)
  if (!rgb) {
    fail(`${label}: could not read page background`)
  } else {
    const block = await pageBgBlock(page, info.canvas, rgb)
    if (block.h >= 70 && block.w >= 160) {
      fail(`${label}: page background covers ${block.w}x${block.h}px of the map canvas`)
    }
  }
  if (popup) {
    if (!/Whitley/i.test(info.title)) fail(`${label}: pin popup did not show William Whitley`)
    if (!info.scrollable) fail(`${label}: pin card cannot scroll`)
    if (info.shellOverflow === 'auto' || info.shellOverflow === 'scroll') {
      fail(`${label}: popup shell overflow is ${info.shellOverflow}`)
    }
  }
  if (failures.length === before) {
    console.log('check-map-canvas:', label, 'ok', {
      gapToFooter: info.gapToFooter,
      canvas: `${Math.round(info.canvas.w)}x${Math.round(info.canvas.h)}`,
    })
  }
}

async function visual(base) {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  try {
    await checkViewport(page, base, { width: 1280, height: 800 }, '#map', { popup: false })
    await checkViewport(
      page,
      base,
      { width: 1280, height: 800 },
      '#map/history/william-whitley-sportsmans-hill',
      { popup: true },
    )
    await checkViewport(page, base, { width: 1440, height: 900 }, '#map', { popup: false })
    await checkViewport(
      page,
      base,
      { width: 1440, height: 900 },
      '#map/history/william-whitley-sportsmans-hill',
      { popup: true },
    )
    await checkViewport(
      page,
      base,
      { width: 390, height: 844 },
      '#map/history/william-whitley-sportsmans-hill',
      { popup: true },
    )
  } finally {
    await browser.close()
  }
}

assertSource()
if (failures.length) {
  process.exit(1)
}

if (!hasChrome()) {
  console.log('check-map-canvas: source checks passed; Chrome is not installed, visual check skipped')
  process.exit(0)
}

let server
try {
  const base = process.env.MAP_CHECK_URL
  if (base) {
    await visual(base.replace(/\/$/, ''))
  } else {
    server = await preview({
      root,
      preview: { host: '127.0.0.1', port: 4179, strictPort: false },
    })
    const addr = server.httpServer.address()
    const port = typeof addr === 'object' && addr ? addr.port : 4179
    await visual(`http://127.0.0.1:${port}`)
  }
} catch (err) {
  fail(err?.stack || err?.message || String(err))
} finally {
  if (server) await server.close()
}

if (failures.length) process.exit(1)
console.log('check-map-canvas: passed')
