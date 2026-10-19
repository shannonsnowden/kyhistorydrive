#!/usr/bin/env node
/**
 * Homepage order follows the morning brief. parseBriefOrder must read Markdown
 * "### <emoji> Title" headings (the Chief of Staff brief format, 2026-10-19 fix)
 * and keep the older bare "<emoji> Title" lines working. Non-emoji headings are ignored.
 */
import assert from 'node:assert/strict'
import { parseBriefOrder } from './lib/brief-order.mjs'

const markdown = [
  '# Father Rice, La Grange, and the Maysville Road Veto',
  '',
  '*Kentucky History Morning Update — Monday, October 19, 2026*',
  '',
  '### 🤠 Rev. David Rice, "Father Rice" of the early churches',
  'Body text.',
  '### 🏙️ La Grange: a crossroads that won the Oldham County seat',
  '## 🪶 River Raisin, 1813',
  '### 🏺 The C&O Mounds at Paintsville',
  '#### 🛣️ The Maysville Road and Jackson’s veto, 1830',
  '### Plain heading without emoji',
].join('\n')
assert.deepEqual(parseBriefOrder(markdown), [
  'rev-david-rice-father-rice-of-the-early-churches',
  'la-grange-a-crossroads-that-won-the-oldham-county-seat',
  'river-raisin-1813',
  'the-c-o-mounds-at-paintsville',
  'the-maysville-road-and-jacksons-veto-1830',
])

// Old format: bare emoji lines, CRLF endings.
assert.deepEqual(parseBriefOrder('🏙️ Hartford: Fort Hartford\r\n🗺️ Treaty of Fort McIntosh\r\nnot a header'), [
  'hartford-fort-hartford',
  'treaty-of-fort-mcintosh',
])
assert.deepEqual(parseBriefOrder(''), [])
console.log('test-brief-order: ok')
