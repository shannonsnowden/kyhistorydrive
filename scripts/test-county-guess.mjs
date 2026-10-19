#!/usr/bin/env node
/**
 * test-county-guess: a county guessed from story text must be named as "<Name> County" (Phase 0, Shannon item 87).
 * A bare name is a person, river or place: "Thomas Jefferson", "Ohio River", "Cumberland Gap", "George Rogers Clark".
 * Covers the shared matcher (src/county-guess.js), the page build (PrerenderPages.enrichCounties) on the real data,
 * the app copy in src/main.js, and the Jouett story (KY History: Woodford County, KHS marker #78).
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { countyMatcher } from '../src/county-guess.js'
import { PrerenderPages } from './prerender-pages.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rj = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'))
const centroids = rj('public/data/county-centroids.json')
const guess = countyMatcher(Object.keys(centroids))

// Bare names never count.
for (const text of [
  'rode about forty miles to warn Thomas Jefferson at Monticello',
  'flatboats on the Ohio River below Louisville',
  'through the Cumberland Gap',
  'with George Rogers Clark at Worthington’s Fort',
  'Jefferson',
  'Ohio',
]) {
  assert.equal(guess(text), '', `bare name must not be a county: "${text}"`)
}
// Real "X County" mentions still match, case-insensitively, as the canonical county name.
assert.equal(guess('a farm in Woodford County near Versailles'), 'Woodford')
assert.equal(guess('the Ohio County seat at Hartford'), 'Ohio')
assert.equal(guess('south of the Ohio River in Jefferson County'), 'Jefferson')
assert.equal(guess('mccracken county, at Paducah'), 'McCracken')
assert.equal(guess('Larue  County'), 'Larue')
assert.equal(guess('Clark County court day'), 'Clark')
assert.equal(guess('In Powell and Wolfe counties, Natural Bridge'), 'Powell', 'shared plural: first county')
assert.equal(guess('Bath, Fleming and Rowan counties'), 'Bath')
assert.equal(guess('the Ohio and Mississippi rivers'), '')
assert.equal(guess('Ohio River counties'), '')
assert.equal(guess('Clarke County'), '', 'whole word only')
assert.equal(guess(''), '')
assert.equal(guess(null), '')
assert.equal(countyMatcher([])('Woodford County'), '')

// Page build on the real data: no guessed county is a bare name, and the known false labels are gone.
const rows = (rj('public/content/stories.json').stories || []).map((r) => ({ ...r }))
const explicit = new Set(rows.filter((r) => r.county != null).map((r) => r.slug))
const locations = rj('public/content/stories-locations.json').locations || {}
PrerenderPages.enrichCounties(rows, { centroids, historyFeatures: rj('public/data/layers/history.geojson').features || [], locations })
const bySlug = new Map(rows.map((r) => [r.slug, r]))
assert.equal(bySlug.get('jack-jouett-kentuckys-midnight-rider')?.county, 'Woodford', 'Jouett story resolves to Woodford')
for (const r of rows) {
  if (explicit.has(r.slug)) continue
  const text = [r.matchedPlace, r.title, r.summary, r.slug?.replace(/-/g, ' '), locations[r.slug]?.matchedPlace].filter(Boolean).join(' ')
  if (r.county === 'Ohio') assert.match(text, /\bOhio\s+County\b/i, `${r.slug}: Ohio County label without "Ohio County" in its text`)
  if (r.county === 'Jefferson' && /\bThomas Jefferson\b/.test(text)) assert.match(text, /\bJefferson\s+County\b/i, `${r.slug}: Jefferson from Thomas Jefferson`)
}

// The Jouett story itself (KY History, Oct 19): county, end year, and its pin subtitle. The pin point is not part of this.
const jouett = rj('public/content/stories/jack-jouett-kentuckys-midnight-rider.json')
assert.equal(jouett.county, 'Woodford')
assert.equal(jouett.yearEnd, 1822, 'Jouett died 1 March 1822')
const jouettPin = (rj('public/data/layers/history.geojson').features || []).find((f) => f.properties?.id === 'capt-jack-jouett-midnight-ride-1781')
assert.ok(jouettPin, 'Jouett History pin exists')
assert.equal(jouettPin.properties.subtitle, 'Woodford County / Craig’s Creek · KHS marker #78 · house c.1797')
const appPin = rj('public/data/app/ky-history.json').find((p) => p.id === 'capt-jack-jouett-midnight-ride-1781')
assert.equal(appPin?.subtitle, 'Woodford County / Craig’s Creek · KHS marker #78 · house c.1797', 'iOS app pin subtitle')
assert.equal(appPin?.year_end, 1822, 'iOS app pin end year')

// The app (src/main.js) uses the same matcher, not its own optional-"County" regex.
const mainJs = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8')
assert.ok(/from '\.\/county-guess\.js'/.test(mainJs), 'src/main.js imports src/county-guess.js')
assert.ok(!mainJs.includes('(?:\\\\s+County)?'), 'src/main.js still has an optional-County regex')
const pre = fs.readFileSync(path.join(root, 'scripts/prerender-pages.mjs'), 'utf8')
assert.ok(!pre.includes('(?:\\\\s+County)?'), 'prerender-pages.mjs still has an optional-County regex')

console.log('test-county-guess: ok (bare names rejected; X County matched; page build + app share the matcher; Jouett → Woodford)')
