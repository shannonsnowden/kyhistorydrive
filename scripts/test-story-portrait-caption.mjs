#!/usr/bin/env node
// Static story portraits keep a 120px float. Caption text must stay inside that
// float so it cannot paint over the paragraph beside or below it.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.env.CAPTION_BASE || 'http://127.0.0.1:8765'
const chrome = process.env.CHROME_PATH || '/usr/local/bin/google-chrome'
const pages = [
  { slug: 'mount-washington-grows-from-the-crossroads', expect: ['david-leitch', 'catherine-drake', 'braxton-bragg'] },
  { slug: 'blackfish-cot-ta-wa-ma-go-chillicothe-war-chief', max: 3 },
]
const widths = [1280, 390]

function outside(box, rect) {
  return rect.x < box.x - 1 || rect.y < box.y - 1 || rect.x + rect.w > box.x + box.w + 1 || rect.y + rect.h > box.y + box.h + 1
}

const browser = await chromium.launch({ executablePath: chrome, headless: true })
const problems = []
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 })
    for (const spec of pages) {
      await page.goto(`${base}/stories/${spec.slug}/`, { waitUntil: 'networkidle' })
      const report = await page.locator('figure.story-portrait').evaluateAll((figs) => {
        const boxOf = (r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })
        return figs.map((el) => {
          const fig = boxOf(el.getBoundingClientRect())
          const bits = [...el.querySelectorAll('.story-portrait-credit, .story-portrait-note, .credit-site')]
          const rects = bits.flatMap((node) => [...node.getClientRects()].map((r) => ({ ...boxOf(r), text: node.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) })))
          const next = el.nextElementSibling
          const para = next && next.tagName === 'P' ? next.innerText.replace(/\s+/g, ' ').trim().slice(0, 48) : ''
          return {
            id: el.getAttribute('data-person'),
            para,
            fig,
            rects,
            credit: (el.querySelector('.story-portrait-credit')?.innerText || '').replace(/\s+/g, ' ').trim(),
          }
        })
      })
      if (spec.expect) assert.deepEqual(report.map((r) => r.id), spec.expect, `${spec.slug} @${width}`)
      assert.ok(report.length <= (spec.max || 3), `${spec.slug} @${width} has ${report.length} portraits`)
      assert.equal(new Set(report.map((r) => r.para)).size, report.length, `${spec.slug} @${width} stacks portraits on one paragraph`)
      for (const fig of report) {
        const spilled = fig.rects.filter((r) => r.w > 0 && r.h > 0 && outside(fig.fig, r))
        if (spilled.length) problems.push({ width, slug: spec.slug, id: fig.id, fig: fig.fig, spilled })
      }
    }
    await page.close()
  }
} finally {
  await browser.close()
}
if (problems.length) {
  console.error(`portrait captions spill outside the float (${problems.length}):`)
  for (const p of problems) console.error(`  ${p.width}px ${p.slug} ${p.id} figW=${Math.round(p.fig.w)} ${p.spilled.map((s) => JSON.stringify(s.text)).join(' | ')}`)
  process.exit(1)
}
console.log('test-story-portrait-caption: captions stay inside the float')
