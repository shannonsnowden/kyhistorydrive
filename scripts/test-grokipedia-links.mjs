#!/usr/bin/env node
/** Helpers for check-grokipedia-links: HTML stripping (CodeQL-safe) and lower-case slug candidates. */
import assert from 'node:assert/strict'
import { stripHtml, slugCandidates } from './lib/grokipedia-links.mjs'

const html = '<p>Keep</p><SCRIPT type="x">bad()</SCRIPT ><Style>.a{}</style><script>x</script>text <b>bold</b> a<<b>>b'
const out = stripHtml(html)
assert.ok(!/[<>]/.test(out), `no angle brackets left: ${out}`)
assert.ok(!/bad\(\)|\.a\{\}/.test(out), `script/style bodies removed in any case: ${out}`)
assert.match(out, /Keep text bold/)

assert.deepEqual(slugCandidates('https://grokipedia.com/page/David_Rice_(Presbyterian_minister)'), [
  'https://grokipedia.com/page/David_Rice_(Presbyterian_minister)',
  'https://grokipedia.com/page/david_rice_presbyterian_minister',
])
assert.deepEqual(slugCandidates('https://grokipedia.com/page/Big_Sandy_River_%28Ohio_River_tributary%29'), [
  'https://grokipedia.com/page/Big_Sandy_River_%28Ohio_River_tributary%29',
  'https://grokipedia.com/page/big_sandy_river_ohio_river_tributary',
])
assert.deepEqual(slugCandidates('https://grokipedia.com/page/levisa_fork'), ['https://grokipedia.com/page/levisa_fork'])
assert.deepEqual(slugCandidates('https://grokipedia.com/page/La_Grange,_Kentucky')[1], 'https://grokipedia.com/page/la_grange_kentucky')
console.log('test-grokipedia-links: ok')
