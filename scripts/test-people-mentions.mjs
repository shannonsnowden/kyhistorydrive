#!/usr/bin/env node
// #337: full-name mention matching, and the 4 people missing from people.json.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fullNames, mentions, findUnlinked } from './fix-people-mentions.mjs'

const boone = { id: 'daniel-boone', name: 'Daniel Boone', aliases: ['Boone'], stories: ['a'] }
assert.deepEqual(fullNames(boone), ['Daniel Boone'])
assert.ok(mentions('When Daniel Boone arrived', boone))
assert.ok(mentions('[Daniel\nBoone](/people/#daniel-boone)', boone))
assert.ok(!mentions('Boone arrived', boone), 'surname alone is not a full-name mention')
assert.ok(!mentions('Daniel Booneville', boone))
const stories = [{ slug: 'a', title: '', bodyMarkdown: 'Daniel Boone' }, { slug: 'b', title: '', bodyMarkdown: 'Daniel Boone' }, { slug: 'c', title: '', bodyMarkdown: 'Daniel Boone' }]
assert.deepEqual(findUnlinked([boone], stories, { 'daniel-boone': { c: 'other person' } }), [{ id: 'daniel-boone', slug: 'b' }])

const people = JSON.parse(fs.readFileSync(new URL('../data/people.json', import.meta.url))).people
const byId = new Map(people.map((p) => [p.id, p]))
for (const [id, slug] of [['lord-dunmore', 'treaty-of-camp-charlotte-1774'], ['barton-stone', 'cane-ridge-meeting-house-and-the-1801-camp-meeting'], ['thomas-kennedy', 'covington-at-the-point'], ['elizabeth-patton-preston', 'prestonsburg-first-seat-on-the-big-sandy'], ['ann-logan', null], ['hannah-boone', null]]) {
  assert.ok(byId.has(id), `${id} in people.json`)
  if (slug) assert.ok(byId.get(id).stories.includes(slug), `${id} -> ${slug}`)
  if (slug) assert.equal(byId.get(id).image, null, `${id}: no new portrait (portrait freeze)`)
}
assert.equal(new Set(people.map((p) => p.id)).size, people.length, 'unique ids')
console.log('test-people-mentions: OK')
