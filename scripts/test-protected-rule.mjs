#!/usr/bin/env node
// #337 note (a): one protected-coordinate rule for the browser (src/story-tools.js) and the build
// (scripts/lib/unified-story-data.mjs), and protection survives a story merge.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isProtectedStoryRule } from '../src/protected-story-rule.js'
import { isProtectedStoryCoords, setProtectedStoryIds } from '../src/story-tools.js'
import { isProtectedStory, protectedIdSets } from './lib/unified-story-data.mjs'
import { loadMerges } from './lib/story-merges.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const none = { protectedIds: new Set(), skipIds: new Set() }
assert.equal(isProtectedStoryRule({ slug: 'x', era: 'prehistoric' }, none), true)
assert.equal(isProtectedStoryRule({ slug: 'site-15fa166' }, none), true)
assert.equal(isProtectedStoryRule({ slug: 'x', tags: ['archaeology'] }, none), true)
assert.equal(isProtectedStoryRule({ slug: 'x', coordinatesProtected: true }, none), true)
assert.equal(isProtectedStoryRule({ slug: 'x' }, none), false)
assert.equal(isProtectedStoryRule({ slug: 'x' }, { protectedIds: new Set(['x']), skipIds: new Set() }), true)
assert.equal(isProtectedStoryRule({ slug: 'x', historyId: 'h' }, { protectedIds: new Set(['h']), skipIds: new Set() }), true)
assert.equal(isProtectedStoryRule({ slug: 'x', era: 'prehistoric' }, { protectedIds: new Set(), skipIds: new Set(['x']) }), false, 'skipSlugs opt out of the heuristics')
assert.equal(isProtectedStoryRule({ slug: 'x', coordinatesProtected: true }, { protectedIds: new Set(), skipIds: new Set(['x']) }), true, 'explicit flags beat skip')

// Browser and build agree on every story once the browser has the same id sets.
const sets = protectedIdSets()
setProtectedStoryIds(sets.protectedIds, sets.skipIds)
const dir = path.join(ROOT, 'public/content/stories')
let n = 0
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  s.slug ||= f.slice(0, -5)
  assert.equal(isProtectedStoryCoords(s), isProtectedStory(s), `browser/build disagree on ${s.slug}`)
  n++
}
// Merge: a kept story inherits its retired twin's protection (and vice versa for old links).
for (const { retired, kept } of loadMerges()) {
  assert.equal(sets.protectedIds.has(retired), sets.protectedIds.has(kept), `merge ${retired} -> ${kept} drops protection`)
}
assert.ok(isProtectedStory({ slug: 'peter-village-enclosure-15fa166' }))
assert.ok(isProtectedStory({ slug: 'peter-village-early-woodland-enclosure-near-lexington' }))

// #350: Peter Village text is county-level only (no town, creek, park or neighboring-site locators).
const PV_LOCATORS = /Lexington|Elkhorn|Mount Horeb|Grimes|Adena Park|north of|nearby|near\b/i
const pv = JSON.parse(fs.readFileSync(path.join(dir, 'peter-village-enclosure-15fa166.json'), 'utf8'))
for (const k of ['title', 'summary', 'bodyMarkdown', 'seoTitle', 'metaDescription']) {
  if (pv[k]) assert.doesNotMatch(pv[k], PV_LOCATORS, `peter-village ${k} names a locator`)
}
const cando = JSON.parse(fs.readFileSync(path.join(dir, 'the-c-and-o-mounds-at-paintsville.json'), 'utf8'))
assert.doesNotMatch(cando.bodyMarkdown, /Peter Village[^.]*\b(near|north of)\b/i, 'C&O must not locate Peter Village')
console.log(`test-protected-rule: OK (${n} stories agree)`)
