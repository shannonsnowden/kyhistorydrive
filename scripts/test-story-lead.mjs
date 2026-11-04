#!/usr/bin/env node
/** Critiquito #348: a story page's standfirst must not repeat the opening of the body's first paragraph. */
import fs from 'node:fs'
import path from 'node:path'
import { isProtectedStory, standfirstHasLocator } from './lib/unified-story-data.mjs'

const text = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim()
const dir = 'dist/stories'
const bad = []
let n = 0
for (const slug of fs.readdirSync(dir)) {
  const f = path.join(dir, slug, 'index.html')
  if (!fs.existsSync(f)) continue
  const html = fs.readFileSync(f, 'utf8')
  const lead = html.match(/<p class="story-lead">([\s\S]*?)<\/p>/)
  if (!lead) continue
  const after = html.slice(lead.index + lead[0].length)
  const first = after.match(/<div class="story-body[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/)
  if (!first) continue
  n++
  const l = text(lead[1])
  if (l.length > 20 && text(first[1]).startsWith(l)) bad.push(slug)
}
const ch = fs.readFileSync(path.join(dir, 'chambers-site-15ml109-marshall-county/index.html'), 'utf8').match(/<p class="story-lead">([\s\S]*?)<\/p>/)
if (!ch || !/^In Marshall County, the Chambers Site \(15Ml109\) preserves a Mississippian village/.test(text(ch[1]))) bad.push('chambers: standfirst is not the KY History summary')
const chHtml = fs.readFileSync(path.join(dir, 'chambers-site-15ml109-marshall-county/index.html'), 'utf8')
// #345: phones show the tools icon-only; each tool keeps its name in aria-label and a hideable label span.
for (const name of ['Save as PDF', 'Download .md', 'Share']) {
  if (!chHtml.includes(`aria-label="${name}"`) || !chHtml.includes(`<span class="usp-tool-label">${name}</span>`)) bad.push(`tools row: ${name} is not icon-only ready`)
}
const css = fs.readFileSync('src/story-page/unified-story.css', 'utf8')
if (!/@media \(max-width: 480px\)[\s\S]*\.usp-tool-label/.test(css)) bad.push('css: no phone rule hiding .usp-tool-label')
// SEO #348: no protected story page's standfirst may carry a place locator (synthetic plants must fail, control must pass).
for (const t of ['Near Sampletown in Sample County, a test site.', 'On the Sample Fork at Sampletown, two mounds.', 'A village on the Sample River.', 'Just north of Sampletown, an earthwork.', 'On a bluff above the floodplain.', '5 mi. from the county seat.']) {
  if (!standfirstHasLocator(t)) bad.push(`locator plant not caught: ${t}`)
}
if (standfirstHasLocator('In Sample County, the Example Site (15XX999) preserves a village where farmers lived.')) bad.push('locator control flagged')
{
  const all = JSON.parse(fs.readFileSync('public/content/stories.json', 'utf8'))
  let p = 0
  for (const st of (Array.isArray(all) ? all : all.stories)) {
    if (!isProtectedStory(st)) continue
    const f = path.join(dir, st.slug, 'index.html')
    if (!fs.existsSync(f)) continue
    p++
    const m = fs.readFileSync(f, 'utf8').match(/<p class="story-lead">([\s\S]*?)<\/p>/)
    if (m && standfirstHasLocator(text(m[1]))) bad.push(`protected standfirst has a locator: ${st.slug}`)
  }
  if (!p) bad.push('no protected story pages checked')
}
if (bad.length) { console.error(`test-story-lead: standfirst repeats the body in:\n  ${bad.join('\n  ')}`); process.exit(1) }
console.log(`test-story-lead: ok (${n} story pages, no standfirst repeats the body)`)
