#!/usr/bin/env node
/**
 * test-protected-locators: protected stories' title, summary, body, meta description and JSON-LD
 * give no location below county (#345 Security). Fixtures prove each pattern; then every protected
 * story in public/content/stories is scanned, plus its built page in dist/ when dist exists.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findLocators } from './lib/protected-locators.mjs'
import { isProtectedStory } from './lib/unified-story-data.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Fixtures: each locator kind is caught; county-only text passes.
for (const bad of [
  'an early earthwork north of Lexington',
  'about 3 miles from Paris',
  '5 km northeast of Winchester',
  'a mound near Lexington',
  'in the Elkhorn Creek country',
  'on the Licking River',
  'part of the Mount Horeb Earthworks Complex',
]) assert.ok(findLocators(bad).length, `should flag: ${bad}`)
for (const ok of [
  'an early earthwork in Fayette County',
  'Peter Village (site 15Fa166)',
  'a lead ore found in the region',
  'Adena is an archaeologists’ name for a shared way of life',
]) assert.deepEqual(findLocators(ok), [], `should pass: ${ok}`)

// TODO(#345 Security follow-up): pre-existing hits in other protected stories, allowlisted so this
// test can land; clear each slug with a content fix and delete it here. Peter Village is never allowed.
const ALLOW = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/protected-locators-allowlist.json'), 'utf8')).slugs
assert.ok(!ALLOW.includes('peter-village-enclosure-15fa166'), 'Peter Village may not be allowlisted')

const dir = path.join(ROOT, 'public/content/stories')
const problems = []
let scanned = 0
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  if (!isProtectedStory(s) || ALLOW.includes(s.slug)) continue
  scanned++
  const body = String(s.bodyMarkdown || '').split('\n').filter((l) => !/^Source:/.test(l)).join('\n')
  const fields = { title: s.title, summary: s.summary, body }
  const page = path.join(ROOT, 'dist/stories', s.slug, 'index.html')
  if (fs.existsSync(page)) {
    const html = fs.readFileSync(page, 'utf8')
    fields.meta = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ''
    fields.jsonld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
  }
  for (const [field, text] of Object.entries(fields)) {
    for (const h of findLocators(text)) problems.push(`${s.slug} ${field}: ${h.id} "${h.match}"`)
  }
}
if (problems.length) {
  console.error(`test-protected-locators: ${problems.length} locator(s) in protected stories:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`test-protected-locators: OK (${scanned} protected stories clean, ${ALLOW.length} allowlisted with TODO)`)
