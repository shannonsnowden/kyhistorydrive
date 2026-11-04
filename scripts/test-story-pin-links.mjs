#!/usr/bin/env node
// #337: story-overrides historyId / alsoHistoryIds must reach stories-locations.json.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { applyPinLinks } from './lib/story-pin-links.mjs'

const ids = new Set(['a', 'b', 'c'])
{ const loc = { slug: 's', historyId: null }; applyPinLinks(loc, { historyId: 'a' }, ids); assert.equal(loc.historyId, 'a') }
{ const loc = { slug: 's', historyId: 'x' }; applyPinLinks(loc, { historyId: 'a' }, ids); assert.equal(loc.historyId, 'a', 'override beats fuzzy match') }
{ const loc = { slug: 's', historyId: 'a' }; applyPinLinks(loc, { alsoHistoryIds: ['b', 'a', 'b'] }, ids); assert.deepEqual(loc.alsoHistoryIds, ['b']) }
assert.throws(() => applyPinLinks({ slug: 's' }, { historyId: 'zzz' }, ids), /unknown history pin/)
assert.throws(() => applyPinLinks({ slug: 's' }, { alsoHistoryIds: ['zzz'] }, ids), /unknown history pin/)
{ const loc = { slug: 's', historyId: 'a' }; applyPinLinks(loc, null, ids); assert.deepEqual(loc, { slug: 's', historyId: 'a' }) }

// The real overrides: every pin #337 links, and each history pin claimed by only one story.
const o = JSON.parse(fs.readFileSync(new URL('./story-overrides.json', import.meta.url))).overrides
const want = {
  'michael-stoner-german-long-hunter': 'michael-stoner-holsteiner',
  'newport-at-the-licking-mouth': 'newport-founding-hubbard-and-james-taylor',
  'ann-mcginty-and-kentuckys-first-spinning-wheel': 'ann-mcginty-first-spinning-wheel-harrodstown',
  'henry-mckennas-fairfield-sour-mash': 'henry-mckenna-fairfield-old-line',
  'carter-caves-cascade-falls': 'carter-caves-cascade-cave-and-falls',
  'lawrenceburg-from-kaufmans-station-to-anderson-county-seat': 'lawrenceburg-founding-kaufman-s-coffman-s-station',
}
for (const [slug, hid] of Object.entries(want)) assert.equal(o[slug]?.historyId, hid, `${slug} -> ${hid}`)
assert.ok(o['father-david-rice-and-kentuckys-first-presbyterian-churches']?.alsoHistoryIds?.includes('concord-church-danville-boyle-1784-1789'))
assert.equal(o['michael-stoner-german-long-hunter'].county, 'Madison')
console.log('test-story-pin-links: OK')
