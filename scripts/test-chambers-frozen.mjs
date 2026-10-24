#!/usr/bin/env node
/** #348 (Security): the real Chambers pattern list and site config are frozen, so a test cannot swap their contents. */
import { LOCATING_TERMS, SITE } from './check-chambers-locating.mjs'
let fail = 0
const throws = (fn, m) => { try { fn(); console.error(`FAIL: ${m} did not throw`); fail++ } catch (e) { if (!(e instanceof TypeError)) { console.error(`FAIL: ${m}: ${e}`); fail++ } } }
const n = LOCATING_TERMS.length
throws(() => { LOCATING_TERMS[0] = /sample[\s_-]+river/i }, 'replacing a pattern')
throws(() => LOCATING_TERMS.push(/sampletown/i), 'push')
throws(() => LOCATING_TERMS.splice(0, 1), 'splice')
throws(() => { SITE.terms = [] }, 'reassigning SITE.terms')
if (LOCATING_TERMS.length !== n || SITE.terms !== LOCATING_TERMS) { console.error('FAIL: list changed'); fail++ }
if (fail) process.exit(1)
console.log('test-chambers-frozen: ok')
