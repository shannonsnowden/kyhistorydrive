#!/usr/bin/env node
// #337: every story link goes to /stories/<slug>/ (merged slugs to the kept story), and an old
// /#timeline/<slug> link is forwarded there on first load.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STORY_MERGES, canonicalStorySlug, storyUrl, timelineForwardUrl } from '../src/story-url.js'
import { loadMerges } from './lib/story-merges.mjs'
import { searchHitHash } from '../src/site-search.js'
import { HomepageStructure } from '../src/homepage-structure.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pathOf = (u) => new URL(u, 'https://kyhistorydrive.com/')

// Browser copy of the merge map matches data/story-merges.json.
// Protected retired slugs with a locator stay out of the bundle (Amplify 301 only).
const BUNDLE_EXCLUDED = new Set(['peter-village-early-woodland-enclosure-near-lexington'])
assert.deepEqual(STORY_MERGES, Object.fromEntries(loadMerges().filter((m) => !BUNDLE_EXCLUDED.has(m.retired)).map((m) => [m.retired, m.kept])))
assert.equal(canonicalStorySlug('capt-jack-jouett'), 'jack-jouett-kentuckys-midnight-rider')
assert.equal(canonicalStorySlug('battle-of-blue-licks'), 'battle-of-blue-licks')

assert.equal(storyUrl('battle-of-blue-licks'), '/stories/battle-of-blue-licks/')
assert.equal(storyUrl('capt-jack-jouett'), '/stories/jack-jouett-kentuckys-midnight-rider/')
assert.equal(storyUrl(''), '/stories/')
assert.equal(storyUrl('../evil'), '/stories/', 'bad slugs never build a path')

for (const [hash, pathname, want] of [
  ['#timeline/battle-of-blue-licks', '/', '/stories/battle-of-blue-licks/'],
  ['#timeline/capt-jack-jouett', '/index.html', '/stories/jack-jouett-kentuckys-midnight-rider/'],
  ['#stories/battle-of-blue-licks', '/', '/stories/battle-of-blue-licks/'],
  ['#timeline/battle-of-blue-licks/', '/', '/stories/battle-of-blue-licks/'],
  ['#timeline', '/', null],
  ['#map/history/x', '/', null],
  ['#timeline/battle-of-blue-licks', '/people/', null],
  ['#timeline/%2F%2Fevil.example', '/', null],
  ['#timeline/https:%2F%2Fevil.example', '/', null],
]) {
  const got = timelineForwardUrl(hash, pathname)
  assert.equal(got, want, `${pathname}${hash}`)
  if (got) {
    const u = pathOf(got)
    assert.equal(u.origin, 'https://kyhistorydrive.com', 'forward stays on site')
    assert.match(u.pathname, /^\/stories\/[a-z0-9-]+\/$/)
  }
}

// Producers: search hits, homepage cards and pack quotes.
assert.equal(searchHitHash({ type: 'story', slug: 'battle-of-blue-licks' }), '/stories/battle-of-blue-licks/')
assert.equal(HomepageStructure.slugFromHref('/stories/battle-of-blue-licks/'), 'battle-of-blue-licks')
assert.equal(HomepageStructure.slugFromHref('/#timeline/battle-of-blue-licks'), 'battle-of-blue-licks')

// No source file still builds a /#timeline/<slug> link (the Timeline reader's own replaceState is Phase 3).
const allow = new Map([
  ['src/main.js', /replaceState\(null, '', `#timeline\/\$\{encodeURIComponent\(s\.slug\)\}`\)/],
])
const offenders = []
for (const dir of ['src', 'scripts']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (!/\.(m?js)$/.test(f) || f.startsWith('test-')) continue
    const rel = `${dir}/${f}`
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (!/[`'"]\/?#timeline\/\$\{/.test(line)) return
      if (allow.get(rel)?.test(line)) return
      offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`)
    })
  }
}
assert.deepEqual(offenders, [], `story links still built as #timeline/<slug>:\n${offenders.join('\n')}`)
console.log('test-story-links: OK')
