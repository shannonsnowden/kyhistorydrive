#!/usr/bin/env node
// #436 W2/D3 (Nov 20 2026): an undated History pin gets no inferred year range on any surface.
// "Mammoth Cave" must not read as the mammoth (Pleistocene) era; real mammoth sites keep theirs.
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (rel) => JSON.parse(fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'))
const features = read('public/data/layers/history.geojson').features
const byId = new Map(features.map((f) => [f.properties.id, f.properties]))

const shortCave = byId.get('the-woman-from-short-cave-edmonson')
assert.ok(shortCave, 'Short Cave History pin is in history.geojson')
assert.equal(shortCave.yearStart, undefined, 'Short Cave pin has no yearStart (no radiocarbon date)')
assert.equal(shortCave.yearEnd, undefined, 'Short Cave pin has no yearEnd')
assert.equal(shortCave.era, 'prehistoric', 'Short Cave pin keeps its era')

const bigBone = byId.get('big-bone-lick')
assert.equal(bigBone.yearStart, -10000, 'Big Bone Lick (mammoth/mastodon) keeps its range')
assert.equal(bigBone.yearEnd, -8000)
for (const [id, start] of [['salts-cave-15ht4-mammoth-cave', -1000], ['lost-john-mammoth-cave-edmonson-woodland', -500], ['mammoth-cave-saltpeter-war-of-1812', 1812]]) {
  assert.equal(byId.get(id)?.yearStart, start, `${id} keeps its explicit start year`)
}
console.log('test-undated-history-pins: OK')
