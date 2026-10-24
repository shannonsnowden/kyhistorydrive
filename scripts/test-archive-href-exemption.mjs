#!/usr/bin/env node
/**
 * Security Watch (#346): prerender's precise-coordinate guard exempts a match ONLY inside the path of an
 * href whose URL host is archive.org / www.archive.org and whose pathname is /details/<id>. Page text,
 * query strings, fragments and lookalike hosts still fail. check-protected-coords has no such exemption
 * (see test-protected-coords.mjs: archive-link-near-keyed-point-fails).
 */
import assert from 'node:assert/strict'
import { PrerenderPages } from './prerender-pages.mjs'

const hit = (html) => PrerenderPages.hasPreciseCoordinate(html)
const cases = [
  ['archive-details-href-passes', '<p><a href="https://archive.org/details/in.ernet.dli.2015.58770">book</a></p>', false],
  ['www-archive-details-href-passes', '<a href="https://www.archive.org/details/in.ernet.dli.2015.58770/">book</a>', false],
  ['same-number-in-text-fails', '<p>See in.ernet.dli.2015.58770 for the book.</p>', true],
  ['archive-href-plus-text-fails', '<a href="https://archive.org/details/in.ernet.dli.2015.58770">in.ernet.dli.2015.58770</a>', true],
  ['archive-query-string-fails', '<a href="https://archive.org/details/x?lat=37.43215&amp;lon=-85.67891">x</a>', true],
  ['archive-search-path-fails', '<a href="https://archive.org/search?query=37.43215">x</a>', true],
  ['archive-fragment-fails', '<a href="https://archive.org/details/x#37.43215">x</a>', true],
  ['lookalike-host-fails', '<a href="https://archive.org.evil.com/details/in.ernet.dli.2015.58770">x</a>', true],
  ['other-host-fails', '<a href="https://example.com/details/in.ernet.dli.2015.58770">x</a>', true],
  ['userinfo-trick-fails', '<a href="https://archive.org@evil.com/details/in.ernet.dli.2015.58770">x</a>', true],
  ['data-attr-not-href-fails', '<div data-src="https://archive.org/details/in.ernet.dli.2015.58770"></div>', true],
  ['plain-page-passes', '<p>Founded in 1797 at 38.7 N.</p>', false],
]
let failed = 0
for (const [name, html, want] of cases) {
  let got
  try { got = hit(html) } catch (e) { got = `threw ${e.message}` }
  const ok = got === want
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
if (failed) { console.error(`test-archive-href-exemption: ${failed} case(s) failed`); process.exit(1) }
assert.ok(true)
