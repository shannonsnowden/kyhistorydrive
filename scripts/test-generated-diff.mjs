#!/usr/bin/env node
/** #348: check-generated-diff flags rebuild noise outside the allowlisted records and --fix-style merge keeps only them. Fictional data only. */
import { diffJson, mergeAllowed, formatLike, makeAllow } from './lib/generated-diff.mjs'

const allow = makeAllow(['example-site-15xx999'])
const story = (id, extra = {}) => ({ id, title: id, county: 'Sample', ...extra })
const base = { generatedAt: 'a', stories: [story('sampletown-mill'), story('example-site-15xx999-sample-county'), { id: 'demoville-fort', matchedPlace: 'Demoville', county: 'Exampleton' }] }
const head = { generatedAt: 'b', stories: [
  story('sampletown-mill', { seoTitle: 'Sampletown Mill in Sample County (KY 0)' }),
  story('example-site-15xx999-sample-county', { title: 'Example Site: village in Sample County' }),
  { id: 'demoville-fort', county: 'Exampleton', matchedPlace: 'Demoville' },
] }
let fail = 0
const ok = (c, m) => { if (!c) { console.error(`FAIL: ${m}`); fail++ } }

const p = diffJson(base, head, allow)
ok(p.some((x) => x.includes('[sampletown-mill].seoTitle: added')), 'added seoTitle on a non-allowlisted story')
ok(p.some((x) => x.includes('[demoville-fort]: key order changed')), 'moved county key')
ok(!p.some((x) => x.includes('example-site')), 'allowlisted story change must pass')
ok(!p.some((x) => x.includes('generatedAt')), 'generatedAt ignored')
ok(diffJson({ 'sampletown-mill': { modified: '1' } }, { 'sampletown-mill': { modified: '2' } }, allow).length === 1, 'bumped date in keyed object')
ok(diffJson({ 'example-site-15xx999-x': { modified: '1' } }, { 'example-site-15xx999-x': { modified: '2' } }, allow).length === 0, 'allowlisted date bump passes')

const m = mergeAllowed(base, head, allow)
ok(diffJson(base, m, allow).length === 0, 'merge leaves no noise')
ok(m.stories[1].title === 'Example Site: village in Sample County', 'merge keeps the allowlisted change')
ok(m.generatedAt === 'a', 'merge keeps base generatedAt')
const bt = JSON.stringify(base, null, 2) + '\n'
ok(formatLike(bt, base) === bt, 'pretty round-trip')
ok(formatLike(JSON.stringify(base), base) === JSON.stringify(base), 'compact round-trip')
if (fail) process.exit(1)
console.log('test-generated-diff: ok')
