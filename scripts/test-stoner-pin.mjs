#!/usr/bin/env node
/**
 * test-stoner-pin: the Michael Stoner History pin stays at Fort Boonesborough, Madison County (#337 override).
 * The old tracked ky-history.json had a photon geocode in Nelson/Spencer County (37.83, -85.47); the
 * override in story-overrides.json moves it east to Boonesborough on purpose. The pin's history text
 * names "Clark & Wayne Counties", so the county must come from the override, never a text guess.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const rj = (f) => JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'))
const ov = rj('scripts/story-overrides.json')
const find = (o) => (o && typeof o === 'object' ? (o['michael-stoner-german-long-hunter'] || Object.values(o).map(find).find(Boolean)) : null)
const o = find(ov)
assert.ok(o, 'Stoner override present')
assert.equal(o.historyId, 'michael-stoner-holsteiner')
assert.equal(o.county, 'Madison')
assert.ok(Math.abs(o.lat - 37.8909) < 0.01 && Math.abs(o.lon - -84.2666) < 0.01, 'override at Fort Boonesborough')
const story = rj('public/content/stories/michael-stoner-german-long-hunter.json')
assert.equal(story.county, 'Madison')
assert.equal(story.era, 'frontier')
const pin = rj('public/data/app/ky-history.json').find((p) => p.id === 'michael-stoner-holsteiner')
if (pin) {
  assert.ok(Math.abs(pin.latitude - o.lat) < 1e-6 && Math.abs(pin.longitude - o.lon) < 1e-6, `ky-history.json pin ${pin.latitude},${pin.longitude} must match override`)
}
console.log('test-stoner-pin: OK (Fort Boonesborough, Madison County)')
