#!/usr/bin/env node
/** v2 Phase 5 (#340): research notes fold into story pages; culture evidence pages stay, noindexed. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { foldedResearchHtml, foldedResearchJumpHtml } from '../src/research-notes.js'
import { isFoldedResearch, glanceTableHtml } from '../src/story-markdown.js'
import { uniqueTitleProblems } from './check-unique-titles.mjs'

const dir = 'public/content/research'
const all = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')))
const folded = all.filter(isFoldedResearch)
const culture = all.filter((n) => !isFoldedResearch(n))
assert.equal(folded.length, 16, '16 research outlines fold')
assert.equal(culture.length, 7, '7 culture evidence pages stay')
assert.ok(culture.every((n) => /^culture-[a-z0-9-]+-image-evidence$/.test(n.slug)))
assert.equal(isFoldedResearch(null), false)

const blue = all.find((n) => n.slug === 'battle-of-blue-licks')
const html = foldedResearchHtml(blue)
// Critiquito blocker: collapsed native <details>, each subsection its own nested <details> with an h3 summary.
assert.match(html, /^<details class="usp-details research-fold" id="research-notes" data-research-notes>/)
assert.match(html, /^<details[^>]*>\s*<summary class="research-fold-summary"><span>Research notes \(sources, timeline, open questions\)<\/span><\/summary>/)
assert.equal(/<details[^>]*\bopen\b/.test(html), false, 'collapsed by default')
assert.equal(/<h1|<h2/.test(html), false, 'fold uses h3 only')
const subs = [...html.matchAll(/<details class="research-sub"><summary><h3>([^<]+)<\/h3><\/summary>/g)].map((m) => m[1])
for (const h of ['Timeline', 'Primary sources', 'Secondary sources']) assert.ok(subs.includes(h), `sub ${h}`)
assert.ok(subs.length >= 5, 'each subsection collapses')
assert.ok(html.trim().endsWith('</details>'))
assert.equal((html.match(/<details/g) || []).length, (html.match(/<\/details>/g) || []).length)
// story-page.js opens the block on #research-notes / #rn-source-* and for print; CSS gives a 44px summary with a chevron.
const js = fs.readFileSync('public/story-page.js', 'utf8')
assert.match(js, /beforeprint/)
assert.match(js, /research-notes/)
assert.match(js, /hashchange/)
const css = fs.readFileSync('src/styles.css', 'utf8')
assert.match(css, /\.research-fold-summary[^{]*\{[^}]*min-height: 44px/)
assert.match(css, /@media print[^{]*\{[^]*?\.research-fold/)
// Critiquito 390 should-fixes: inline citation links joined by ' · ' (not stacked pills); story sources move inside the fold.
assert.equal(/class="research-cite[ "]/.test(html), false, 'fold uses inline cite links, not pills')
assert.match(html, /<a class="rn-cite" href="#rn-source-[^"]+">[^<]+<\/a><span class="rn-sep" aria-hidden="true"> · <\/span><a class="rn-cite"/)
assert.match(css, /\.research-fold \.rn-cite \{[^}]*padding: 0\.6rem 0\.15rem/)
const withExtra = foldedResearchHtml(blue, { extraSubs: [{ heading: 'Story sources and notes', html: '<p>x</p>' }] })
assert.match(withExtra, /<details class="research-sub"><summary><h3>Story sources and notes<\/h3><\/summary><div class="research-sub-body"><p>x<\/p><\/div><\/details><\/div><\/details>$/)
assert.equal(html.includes('id="sources"'), false, 'no clash with the story #sources section')
assert.match(html, /id="rn-source-caldwell-1782"/)
assert.match(html, /href="#rn-source-caldwell-1782"/)
assert.equal(html.includes('/research/'), false, 'never links a research page')
assert.equal(foldedResearchJumpHtml(blue), '<a class="research-jump" href="#research-notes">Research notes</a>')
assert.equal(foldedResearchJumpHtml(culture[0]), '')
assert.ok([...html.matchAll(/<a\b[^>]*href="https?:[^"]*"[^>]*>/g)].every((a) => a[0].includes('rel="noopener noreferrer"') && a[0].includes('target="_blank"')))
assert.equal(foldedResearchHtml(culture[0]), '', 'culture pages never fold')

const poisoned = {
  ...blue,
  sections: [{ heading: '<b>Aims</b>', items: [{ text: 'x <iframe src="y"></iframe>', sources: ['nope'] }] }],
  people: [{ name: '<em>N</em>', role: '<b>r</b>', peopleId: 'john-todd' }],
  openQuestions: ['<script>q</script>'],
  sources: [{ id: 'nope', citation: '<script>no</script>', url: 'javascript:alert(1)', type: 'primary' }],
}
const bad = foldedResearchHtml(poisoned)
for (const s of ['<script', '<iframe', '<b>', '<em>', 'javascript:']) assert.equal(bad.includes(s), false, s)
assert.match(bad, /<li id="rn-source-nope">&lt;script&gt;no&lt;\/script&gt;<\/li>/)

const story = JSON.parse(fs.readFileSync('public/content/stories/battle-of-blue-licks.json', 'utf8'))
const glance = glanceTableHtml(story.glance, blue)
assert.match(glance, /<a href="\/stories\/battle-of-blue-licks\/#research-notes">Sources for this table \(\d+\) in the research notes/)
assert.equal(glance.includes('/research/'), false)
assert.equal(story.bodyMarkdown.includes('/research/'), false, 'Blue Licks body no longer links its research page')

// amplify.yml: two explicit 301s per folded note, no wildcard.
const amp = fs.readFileSync('amplify.yml', 'utf8')
assert.equal(/source: '\/research\/<\*>'/.test(amp) || /source: '\/research\/?'/.test(amp), false, 'no /research wildcard')
for (const n of folded) {
  for (const src of [`/research/${n.slug}`, `/research/${n.slug}/`]) {
    const re = new RegExp(`- source: '${src.replace(/[/.-]/g, '\\$&')}'\\n\\s+target: '/stories/${n.storySlug}/'\\n\\s+status: '301'`)
    assert.match(amp, re, `301 for ${src}`)
  }
}
for (const n of culture) assert.equal(amp.includes(`'/research/${n.slug}`), false, `culture ${n.slug} is not redirected`)

// unique titles / h1 helper
const pages = [
  { file: 'a', html: '<title>A</title><h1>One</h1>' },
  { file: 'b', html: '<title>A</title><h1 class="x">One</h1>' },
  { file: 'c', html: '<meta name="robots" content="noindex, follow" /><title>A</title><h1>One</h1>' },
  { file: 'd', html: '<title>D &amp; E</title><h1>Two</h1>' },
]
const probs = uniqueTitleProblems(pages)
assert.equal(probs.length, 2, probs.join('\n'))
assert.ok(probs.some((p) => p.includes('title') && p.includes('a') && p.includes('b')))
assert.ok(probs.some((p) => p.includes('h1')))
assert.equal(uniqueTitleProblems(pages.slice(2)).length, 0, 'noindex pages are skipped')
console.log('test-research-fold: fold, glance, redirects and unique-title helper ok')
