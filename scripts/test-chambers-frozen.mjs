#!/usr/bin/env node
/** #348 (Security): the real Chambers pattern list and site config are frozen, so a test cannot swap their contents. */
import { LOCATING_TERMS, SITE, locatingProblems, syntheticSite } from './check-chambers-locating.mjs'
let fail = 0
const throws = (fn, m) => { try { fn(); console.error(`FAIL: ${m} did not throw`); fail++ } catch (e) { if (!(e instanceof TypeError)) { console.error(`FAIL: ${m}: ${e}`); fail++ } } }
const n = LOCATING_TERMS.length
throws(() => { LOCATING_TERMS[0] = /sample[\s_-]+river/i }, 'replacing a pattern')
throws(() => LOCATING_TERMS.push(/sampletown/i), 'push')
throws(() => LOCATING_TERMS.splice(0, 1), 'splice')
throws(() => { SITE.terms = [] }, 'reassigning SITE.terms')
// Deep freeze: the list holds pattern text (source + flags), not live RegExp objects, and each entry is frozen.
for (const t of LOCATING_TERMS) {
  if (t instanceof RegExp || typeof t.source !== 'string' || typeof t.flags !== 'string' || !Object.isFrozen(t)) { console.error('FAIL: term is not frozen pattern text'); fail++; break }
}
throws(() => { LOCATING_TERMS[0].source = 'sample' }, 'rewriting a pattern source')
for (const k of ['value', 'key', 'mention', 'storySlug']) {
  const v = SITE[k]
  if (v instanceof RegExp || !Object.isFrozen(v) || typeof v.source !== 'string') { console.error(`FAIL: SITE.${k} is not frozen pattern text`); fail++ }
}
throws(() => { SITE.mention.flags = '' }, 'rewriting SITE.mention flags')
// Fresh RegExps per scan: a stateful /g scan never leaks lastIndex into the next one.
const X = syntheticSite()
const a = locatingProblems('on a ridgetop', X).length, b = locatingProblems('on a ridgetop', X).length
if (a !== 1 || b !== 1) { console.error(`FAIL: repeated scans disagree (${a}, ${b})`); fail++ }
if (LOCATING_TERMS.length !== n || SITE.terms !== LOCATING_TERMS) { console.error('FAIL: list changed'); fail++ }
if (fail) process.exit(1)
console.log('test-chambers-frozen: ok')
