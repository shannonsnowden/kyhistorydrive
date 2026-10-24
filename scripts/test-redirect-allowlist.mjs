#!/usr/bin/env node
// amplify.yml 301s are an explicit allowlist (Editor ruling #345): the 4 slashless rules + the 14 old-slug rules.
// Fixtures are fictional (Sampletown). A planted extra 301 must fail; dropping a required one must fail.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { redirectProblems, REDIRECT_ALLOWLIST } from './check-security-headers.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const amplify = fs.readFileSync(path.join(root, 'amplify.yml'), 'utf8')
assert.equal(REDIRECT_ALLOWLIST.length, 18, 'allowlist is 4 slashless + 14 old-slug rules')
assert.deepEqual(redirectProblems(amplify), [], `real amplify.yml: ${redirectProblems(amplify).join('; ')}`)

const extra = amplify.replace('customRules:\n', "customRules:\n  - source: '/stories/sampletown-old/'\n    target: '/stories/sampletown/'\n    status: '301'\n")
assert.ok(redirectProblems(extra).length, 'planted extra 301 /stories/sampletown-old/ must fail')

const rule = "  - source: '/stories/capt-jack-jouett/'\n    target: '/stories/jack-jouett-kentuckys-midnight-rider/'\n    status: '301'\n"
assert.ok(amplify.includes(rule), 'fixture rule present')
assert.ok(redirectProblems(amplify.replace(rule, '')).length, 'removing a required 301 must fail')
console.log(`test-redirect-allowlist: OK (${REDIRECT_ALLOWLIST.length} allowed 301s; extra and missing plants fail)`)
