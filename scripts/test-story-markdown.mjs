#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DEFAULT_BATTLE_PIN_ICON, battlePinIconForPlace, battlePinIconId, stampBattlePins } from '../src/battle-pins.js'
import { researchNotesHtml } from '../src/research-notes.js'
import {
  glanceTableHtml,
  markdownWithoutGlanceSection,
  renderStoryHtml,
  safeStoryUrl,
} from '../src/story-markdown.js'

assert.equal(safeStoryUrl('javascript:alert(1)'), '')
assert.equal(safeStoryUrl('data:text/html,hi'), '')
assert.equal(safeStoryUrl('//evil.example/x'), '')
assert.equal(safeStoryUrl('mailto:a@b.c'), '')
assert.equal(safeStoryUrl('https://user:pass@example.com/a'), '')
assert.equal(safeStoryUrl(' /people/#john-todd'), '/people/#john-todd')
assert.equal(safeStoryUrl('/people/#john-todd'), '/people/#john-todd')
assert.equal(safeStoryUrl('/#map/stories/battle-of-blue-licks'), '/#map/stories/battle-of-blue-licks')
assert.equal(safeStoryUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1')

const html = renderStoryHtml(
  'See [Home](/) and [Map](/#map/stories/battle-of-blue-licks) and [People](/people/#daniel-boone) and [ABT](https://example.com/abt).\n\n<script>alert(1)</script>\n\n[Bad](javascript:alert(1)) [Proto](//evil.example/x)',
)
assert.match(html, /<a href="\/">Home<\/a>/)
assert.match(html, /<a href="\/#map\/stories\/battle-of-blue-licks">Map<\/a>/)
assert.match(html, /<a href="\/people\/#daniel-boone">People<\/a>/)
assert.match(html, /<a href="https:\/\/example\.com\/abt" target="_blank" rel="noopener noreferrer">ABT<span class="visually-hidden">/)
assert.equal(html.includes('target="_blank" rel="noopener noreferrer">Home'), false)
assert.equal(html.includes('target="_blank" rel="noopener noreferrer">Map'), false)
assert.equal(html.includes('<script'), false)
assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
assert.match(html, /<p>Bad Proto<\/p>/)
assert.equal(html.includes('javascript:'), false)
assert.equal(html.includes('//evil.example'), false)
assert.equal(html.includes('<img'), false)

const story = JSON.parse(fs.readFileSync('public/content/stories/battle-of-blue-licks.json', 'utf8'))
const notes = JSON.parse(fs.readFileSync('public/content/research/battle-of-blue-licks.json', 'utf8'))
const body = renderStoryHtml(markdownWithoutGlanceSection(story.bodyMarkdown, true))
assert.equal(body.includes('<h2>At a glance</h2>'), false)
assert.match(body, /<a href="\/people\/#daniel-boone">Daniel Boone<\/a>/)
assert.match(body, /<a href="\/research\/battle-of-blue-licks\/">Research notes and sources for the Battle of Blue Licks<\/a>/)
assert.match(body, /href="https:\/\/www\.battlefields\.org\/learn\/revolutionary-war\/battles\/blue-licks" target="_blank" rel="noopener noreferrer"/)
assert.equal(body.includes('javascript:'), false)
assert.equal(body.includes('<img'), false)
assert.equal((body.match(/<a /g) || []).length > 20, true)

const glance = glanceTableHtml(story.glance, notes)
assert.match(glance, /<table class="story-glance"><caption>At a glance<\/caption>/)
assert.match(glance, /<th scope="row">Date<\/th><td>August 19, 1782 \(Caldwell's report: August 18\)<\/td>/)
assert.match(glance, /<th scope="row">War<\/th>/)
assert.match(glance, /<th scope="row">Sources<\/th>/)
assert.match(glance, /href="\/research\/battle-of-blue-licks\/#source-caldwell-1782"/)
assert.equal(glance.includes('target='), false)
assert.equal(glance.includes('<script'), false)

const poisoned = {
  ...notes,
  title: '<script>alert(1)</script>',
  summary: 'A note <img src=x onerror=alert(1)>.',
  sections: [{ heading: '<b>Aims</b>', items: [{ text: 'Text <iframe src="x"></iframe>', sources: ['nope'] }] }],
  people: [{ name: '<em>Name</em>', role: '<b>role</b>', peopleId: 'john-todd' }],
  sources: [{ id: 'nope', citation: '<script>no</script>', url: 'javascript:alert(1)', type: 'primary' }],
}
const page = researchNotesHtml(poisoned)
assert.match(page, />Back to story</)
assert.match(page, /href="\/stories\/battle-of-blue-licks\/"/)
assert.match(page, /href="\/people\/#john-todd"/)
assert.match(page, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
assert.match(page, /&lt;iframe src=/)
assert.equal(page.includes('<script'), false)
assert.equal(page.includes('<iframe'), false)
assert.equal(page.includes('<img'), false)
assert.equal(page.includes('javascript:'), false)
assert.match(page, /<li id="source-nope">&lt;script&gt;no&lt;\/script&gt;<\/li>/)

const real = researchNotesHtml(notes)
assert.match(real, /href="https:\/\/www\.royalprovincial\.com\/history\/battles\/brcald1\.shtml" target="_blank" rel="noopener noreferrer"/)
assert.match(real, /id="source-caldwell-1782"/)
assert.equal([...real.matchAll(/<a\b[^>]*href="https?:[^"]*"[^>]*>/g)].every((anchor) => anchor[0].includes('rel="noopener noreferrer"') && anchor[0].includes('target="_blank"')), true)
assert.equal([...real.matchAll(/<a\b[^>]*href="\/[^"]*"[^>]*>/g)].some((anchor) => anchor[0].includes('target=')), false)
const siteSource = researchNotesHtml({
  slug: 'battle-of-blue-licks',
  storySlug: 'battle-of-blue-licks',
  title: 'Notes',
  sources: [{ id: 'site', citation: 'On site', url: '/stories/battle-of-blue-licks/', type: 'secondary' }],
})
assert.match(siteSource, /href="\/stories\/battle-of-blue-licks\/">On site</)
assert.equal(siteSource.includes('target='), false)

assert.equal(battlePinIconId('revolutionary', new Set()), DEFAULT_BATTLE_PIN_ICON)
assert.equal(battlePinIconId('civil', new Set()), DEFAULT_BATTLE_PIN_ICON)
assert.equal(battlePinIconId('revolutionary', new Set(['battle-revolutionary'])), 'battle-revolutionary')
assert.equal(battlePinIconId('nope', new Set(['battle-revolutionary'])), DEFAULT_BATTLE_PIN_ICON)
assert.equal(battlePinIconForPlace({ war: 'civil', site_type: 'fort' }, new Set(['battle-civil'])), '')
assert.equal(battlePinIconForPlace({ war: 'civil', site_type: 'battlefield' }, new Set()), DEFAULT_BATTLE_PIN_ICON)
const features = {
  features: [
    { properties: { war: 'revolutionary', site_type: 'battlefield' } },
    { properties: { war: 'civil', site_type: 'battlefield' } },
    { properties: { war: 'civil', site_type: 'fort' } },
  ],
}
assert.equal(stampBattlePins(features, new Set()), 0)
assert.equal(features.features[0].properties.pinIcon, undefined)
assert.equal(stampBattlePins(features, new Set(['battle-civil'])), 1)
assert.equal(features.features[0].properties.pinIcon, undefined)
assert.equal(features.features[1].properties.pinIcon, 'battle-civil')
assert.equal(features.features[2].properties.pinIcon, undefined)

console.log('test-story-markdown: links, glance, research notes, and battle pin icons ok')
