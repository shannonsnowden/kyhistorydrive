#!/usr/bin/env node
/**
 * Story pages must not put AI face or culture-figure art in social or structured data.
 * Fails when a dist/stories page has og:image, twitter:image, or a JSON-LD ImageObject
 * whose URL contains `__ai` or `/figures/`. The visible hero may still use that file.
 *
 *   node scripts/check-no-ai-og.mjs --self-test
 *   node scripts/check-no-ai-og.mjs            # scan dist/stories
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const AI_ART = /__ai|\/figures\//

export function aiArtUrl(url) {
  return AI_ART.test(String(url || ''))
}

function metaContent(html, re) {
  const urls = []
  for (const match of html.matchAll(re)) urls.push(match[1])
  return urls
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit)
    return
  }
  visit(node)
  for (const value of Object.values(node)) walk(value, visit)
}

/** URLs from og:image, twitter:image, and JSON-LD ImageObject on one story page. */
export function socialImageUrls(html) {
  const urls = [
    ...metaContent(html, /<meta\s+property="og:image(?::secure_url)?"\s+content="([^"]*)"/g),
    ...metaContent(html, /<meta\s+name="twitter:image"\s+content="([^"]*)"/g),
  ]
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data
    try {
      data = JSON.parse(match[1])
    } catch {
      continue
    }
    walk(data, (node) => {
      const type = node['@type']
      const types = Array.isArray(type) ? type : [type]
      if (!types.includes('ImageObject')) return
      if (node.url) urls.push(String(node.url))
      if (node.contentUrl) urls.push(String(node.contentUrl))
    })
  }
  return urls
}

export function aiSocialHits(html) {
  return socialImageUrls(html).filter(aiArtUrl)
}

function storyPages(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = path.join(dir, entry.name, 'index.html')
    if (fs.existsSync(file)) out.push(file)
  }
  return out
}

function selfTest() {
  const logo = 'https://kyhistorydrive.com/brand/khd-logo-512.png'
  const ai = 'https://kyhistorydrive.com/content/photos/stories/figures/culture-adena__ai-v1-1280.jpg'
  const page = (social, body = '') => `<!doctype html>
<meta property="og:image" content="${social}" />
<meta property="og:image:secure_url" content="${social}" />
<meta name="twitter:image" content="${social}" />
<script type="application/ld+json">{"@type":"ImageObject","url":"${social}"}</script>
<img src="${ai}" alt="AI illustration: Adena people near a conical burial mound">
${body}`
  const problems = []
  if (aiSocialHits(page(ai)).length === 0) problems.push('self-test: __ai og/ImageObject was allowed')
  if (aiSocialHits(page(logo)).length !== 0) problems.push('self-test: visible __ai hero was flagged')
  const figures = page(logo).replace(logo, 'https://kyhistorydrive.com/content/photos/stories/figures/scene.jpg')
  if (aiSocialHits(figures).length === 0) problems.push('self-test: /figures/ og was allowed')
  const twitterOnly = `<meta name="twitter:image" content="${ai}" />`
  if (aiSocialHits(twitterOnly).length === 0) problems.push('self-test: twitter:image __ai was allowed')
  const omitted = `<meta property="og:image" content="${logo}" /><meta name="twitter:image" content="${logo}" /><img src="${ai}">`
  if (aiSocialHits(omitted).length !== 0) problems.push('self-test: logo fallback with no ImageObject was flagged')
  if (problems.length) {
    for (const p of problems) console.error(p)
    process.exit(1)
  }
  console.log('check-no-ai-og: self-test ok')
}

function scanDist() {
  const dir = path.join(root, 'dist/stories')
  const files = storyPages(dir)
  if (!files.length) {
    console.error('check-no-ai-og: dist/stories has no story pages')
    process.exit(1)
  }
  const hits = []
  for (const file of files) {
    const bad = aiSocialHits(fs.readFileSync(file, 'utf8'))
    if (bad.length) hits.push(`${path.relative(root, file)}: ${[...new Set(bad)].join(', ')}`)
  }
  if (hits.length) {
    console.error(`check-no-ai-og: ${hits.length} story page(s) put AI art in og:image, twitter:image, or ImageObject:`)
    for (const hit of hits) console.error(`  ${hit}`)
    process.exit(1)
  }
  console.log(`check-no-ai-og: ${files.length} story pages`)
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  if (process.argv.includes('--self-test')) selfTest()
  scanDist()
}
