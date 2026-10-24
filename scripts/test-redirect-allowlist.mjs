#!/usr/bin/env node
// amplify.yml 301s are an explicit allowlist (Editor ruling #345): the 4 slashless rules + the 16 old-slug rules.
// Fixtures are fictional (Sampletown). A planted extra 301 must fail; dropping a required one must fail.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { redirectProblems, REDIRECT_ALLOWLIST } from './check-security-headers.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const amplify = fs.readFileSync(path.join(root, 'amplify.yml'), 'utf8')
assert.equal(REDIRECT_ALLOWLIST.length, 26, 'allowlist is 4 slashless + 22 old-slug rules (11 slugs x slash/no slash)')
// Editor ruling (#346): the Red Bird petroglyphs story moved to a county-level slug; the old slug 301s here.
for (const from of ['/stories/red-bird-river-petroglyphs-clay-county', '/stories/red-bird-river-petroglyphs-clay-county/']) {
  assert.ok(REDIRECT_ALLOWLIST.includes(`${from}->/stories/red-bird-petroglyphs-clay-county/:301`), `allowlist has ${from}`)
}
// County sweep: locator slugs 301 to the county-level slug (slash and slashless).
for (const [from, to] of [
  ['muir-site-early-fort-ancient-on-a-jessamine-ridge', 'muir-site-early-fort-ancient'],
  ['buckner-site-fort-ancient-villages-on-strodes-creek', 'buckner-site-fort-ancient-villages'],
  ['lower-shawneetown-at-the-scioto-mouth', 'lower-shawneetown-greenup-county'],
]) {
  for (const suffix of ['', '/']) {
    assert.ok(
      REDIRECT_ALLOWLIST.includes(`/stories/${from}${suffix}->/stories/${to}/:301`),
      `allowlist has /stories/${from}${suffix}`,
    )
  }
}
const docsRedirects = JSON.parse(fs.readFileSync(path.join(root, 'docs/redirects/protected-county-slugs.json'), 'utf8'))
for (const rule of docsRedirects) {
  assert.equal(rule.status, '301')
  assert.ok(REDIRECT_ALLOWLIST.includes(`${rule.source}->${rule.target}:${rule.status}`), `docs redirect in amplify allowlist: ${rule.source}`)
}
assert.deepEqual(redirectProblems(amplify), [], `real amplify.yml: ${redirectProblems(amplify).join('; ')}`)

const extra = amplify.replace('customRules:\n', "customRules:\n  - source: '/stories/sampletown-old/'\n    target: '/stories/sampletown/'\n    status: '301'\n")
assert.ok(redirectProblems(extra).length, 'planted extra 301 /stories/sampletown-old/ must fail')

const rule = "  - source: '/stories/capt-jack-jouett/'\n    target: '/stories/jack-jouett-kentuckys-midnight-rider/'\n    status: '301'\n"
assert.ok(amplify.includes(rule), 'fixture rule present')
assert.ok(redirectProblems(amplify.replace(rule, '')).length, 'removing a required 301 must fail')
console.log(`test-redirect-allowlist: OK (${REDIRECT_ALLOWLIST.length} allowed 301s; extra and missing plants fail)`)
