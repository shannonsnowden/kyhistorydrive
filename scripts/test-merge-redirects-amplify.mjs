#!/usr/bin/env node
// Fixture tests for diffAmplifyBlock: amplify.yml must carry every block (f) merge 301 above any /<*> catch-all.
import fs from 'node:fs'
import { diffAmplifyBlock } from './lib/story-merges.mjs'

const block = [
  { source: '/stories/old', target: '/stories/kept/', status: '301' },
  { source: '/stories/old/', target: '/stories/kept/', status: '301' },
]
const rule = (s, t, st = '301') => `  - source: '${s}'\n    target: '${t}'\n    status: '${st}'\n`
const good = 'customRules:\n' + rule('/stories/old', '/stories/kept/') + rule('/stories/old/', '/stories/kept/') + rule('/<*>', '/404.html', '404-200')
const cases = [
  ['in sync', good, 0],
  ['missing rule', 'customRules:\n' + rule('/stories/old', '/stories/kept/'), 1],
  ['wrong target', 'customRules:\n' + rule('/stories/old', '/stories/other/') + rule('/stories/old/', '/stories/kept/'), 1],
  ['wrong status', 'customRules:\n' + rule('/stories/old', '/stories/kept/', '302') + rule('/stories/old/', '/stories/kept/'), 1],
  ['below catch-all', 'customRules:\n' + rule('/<*>', '/404.html', '404-200') + rule('/stories/old', '/stories/kept/') + rule('/stories/old/', '/stories/kept/'), 2],
]
let fail = 0
for (const [name, yml, want] of cases) {
  const got = diffAmplifyBlock(yml, block).length
  const ok = want === 0 ? got === 0 : got >= 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${got} problem(s)`)
  if (!ok) fail++
}
// The real files must agree.
const real = diffAmplifyBlock(fs.readFileSync(new URL('../amplify.yml', import.meta.url), 'utf8'),
  JSON.parse(fs.readFileSync(new URL('../docs/redirects/block-f-merges.json', import.meta.url), 'utf8')))
console.log(`${real.length ? 'FAIL' : 'ok  '} repo amplify.yml vs block-f-merges.json: ${real.length} problem(s)`)
if (real.length) { console.log('  ' + real.join('\n  ')); fail++ }
if (fail) process.exit(1)
console.log('test-merge-redirects-amplify: all passed')
