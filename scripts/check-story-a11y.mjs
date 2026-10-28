/**
 * axe-core on two prerendered story pages.
 *
 * Source checks always run. The browser check runs when Chrome is installed
 * (Amplify's build image has no Chrome, so that part is skipped there).
 * A page must report 0 violations.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pages = ['/stories/great-saltpetre-cave/', '/stories/mammoth-cave-saltpeter/']
const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error('check-story-a11y:', msg)
}

function assertSource() {
  const tools = readFileSync(resolve(root, 'src/story-tools.js'), 'utf8')
  const styles = readFileSync(resolve(root, 'src/styles.css'), 'utf8')
  const main = readFileSync(resolve(root, 'src/main.js'), 'utf8')
  if (!tools.includes('class="related-card"') || !tools.includes('learnMoreLinkText')) {
    fail('story tools are missing the related card or Learn more label')
  }
  if (!styles.includes('grid-template-columns: 56px minmax(0, 1fr) 20px')) {
    fail('related card grid is missing')
  }
  if (!styles.includes('grid-template-columns: repeat(2, minmax(0, 1fr))')) {
    fail('related list is missing the two-column layout')
  }
  if (!/\.related-card-title \{[^}]*line-clamp:\s*2/.test(styles) || !styles.includes('overflow-wrap: break-word')) {
    fail('related card titles must clamp to 2 lines and break on word boundaries')
  }
  if (!styles.includes('align-items: stretch') || !/\.related-card-meta \{[^}]*line-clamp:\s*2/.test(styles)) {
    fail('related cards must stretch to one row height and clamp the meta line to 2 lines')
  }
  if (/@media \(max-width: 719px\) \{[^}]*\.related-card-meta \{[^}]*nowrap/.test(styles)) {
    fail('related card meta must wrap instead of cutting the year with an ellipsis')
  }
  if (!styles.includes('prefers-reduced-motion') || !styles.includes('translateX(2px)')) {
    fail('related card hover motion is missing')
  }
  if (!main.includes('relatedAndNearbyForStory') || !main.includes('learnMoreBlockHtml')) {
    fail('the hash reader does not use the shared related list and Learn more labels')
  }
}

/** Built pages: a related-card portrait (/people/portraits/) never renders with alt="" (SEO finding on #331). */
function assertBuiltRelatedCardAlts() {
  const dist = resolve(root, 'dist')
  if (!existsSync(dist)) return
  let n = 0
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (ent.name.endsWith('.html')) {
        const html = readFileSync(p, 'utf8')
        for (const m of html.matchAll(/<img class="related-card-img" src="(\/people\/portraits\/[^"]+)"[^>]*>/g)) {
          n += 1
          const alt = /\salt="([^"]*)"/.exec(m[0])
          if (!alt || !alt[1].trim()) fail(`${p.slice(dist.length)}: related-card portrait ${m[1]} has an empty alt`)
        }
      }
    }
  }
  walk(dist)
  if (!failures.length) console.log(`check-story-a11y: ${n} related-card portraits, each with alt text`)
}

function hasChrome() {
  try {
    execFileSync('google-chrome', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function visual(base) {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--disable-dev-shm-usage'],
  })
  try {
    const context = await browser.newContext()
    for (const urlPath of pages) {
      const page = await context.newPage()
      const response = await page.goto(`${base}${urlPath}`, { waitUntil: 'networkidle' })
      if (!response || !response.ok()) {
        fail(`${urlPath} returned ${response ? response.status() : 'no response'}`)
        await page.close()
        continue
      }
      const results = await new AxeBuilder({ page }).analyze()
      if (results.violations.length) {
        const summary = results.violations
          .map((item) => `${item.id} (${item.impact}, ${item.nodes.length})`)
          .join('; ')
        fail(`${urlPath} has ${results.violations.length} axe violations: ${summary}`)
      } else {
        console.log('check-story-a11y:', urlPath, '0 violations')
      }
      await page.close()
    }
  } finally {
    await browser.close()
  }
}

assertSource()
assertBuiltRelatedCardAlts()
if (failures.length) process.exit(1)

if (!hasChrome()) {
  console.log('check-story-a11y: source checks passed; Chrome is not installed, axe check skipped')
  process.exit(0)
}

let server
try {
  const base = process.env.A11Y_CHECK_URL
  if (base) {
    await visual(base.replace(/\/$/, ''))
  } else {
    server = await preview({
      root,
      preview: { host: '127.0.0.1', port: 4181, strictPort: false },
    })
    const addr = server.httpServer.address()
    const port = typeof addr === 'object' && addr ? addr.port : 4181
    await visual(`http://127.0.0.1:${port}`)
  }
} catch (err) {
  fail(err?.stack || err?.message || String(err))
} finally {
  if (server) await server.close()
}

if (failures.length) process.exit(1)
console.log('check-story-a11y: passed')
