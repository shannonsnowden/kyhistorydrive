#!/usr/bin/env node
/**
 * Story-return origins are same-site paths or slugs. A bad value must not
 * become a URL or HTML.
 */
import assert from 'node:assert/strict'
import {
  HASH_RE,
  PATH_RE,
  mapDestFromHref,
  parseStoryReturn,
  returnUrl,
  staticPageBootScript,
} from '../src/story-return.js'

const slug = 'capt-robert-johnson-and-big-crossing-station'

function origin(path, hash, scroll = 480) {
  return { v: 1, path, hash, scroll }
}

const timeline = parseStoryReturn(origin('/', `timeline/${slug}`))
assert.deepEqual(timeline, { v: 1, path: '/', hash: `timeline/${slug}`, scroll: 480 })
assert.equal(returnUrl(timeline), `/#timeline/${slug}`)

const storyPage = parseStoryReturn(origin(`/stories/${slug}/`, 'route-map', 1200))
assert.equal(returnUrl(storyPage), `/stories/${slug}/#route-map`)

const routes = parseStoryReturn(origin('/routes/', '', 0))
assert.equal(returnUrl(routes), '/routes/')

const home = parseStoryReturn(origin('/', 'explore/early-commonwealth/2', 10.4))
assert.equal(home.scroll, 10)
assert.equal(returnUrl(home), '/#explore/early-commonwealth/2')

const film = parseStoryReturn(origin(`/stories/${slug}/`, 'follow-the-river-home', 20))
assert.equal(returnUrl(film), `/stories/${slug}/#follow-the-river-home`)

for (const bad of [
  null,
  'timeline/slug',
  { v: 2, path: '/', hash: '', scroll: 0 },
  { v: 1, path: 'https://evil.example/', hash: '', scroll: 0 },
  { v: 1, path: '//evil.example', hash: '', scroll: 0 },
  { v: 1, path: '/\\evil', hash: '', scroll: 0 },
  { v: 1, path: '/stories/../admin/', hash: '', scroll: 0 },
  { v: 1, path: '/stories/Foo/', hash: '', scroll: 0 },
  { v: 1, path: '/stories/slug', hash: '', scroll: 0 },
  { v: 1, path: '/about/', hash: '', scroll: 0 },
  { v: 1, path: `/${slug}`, hash: '', scroll: 0 },
  { v: 1, path: '/', hash: 'javascript:alert(1)', scroll: 0 },
  { v: 1, path: '/', hash: 'map/history/x', scroll: 0 },
  { v: 1, path: '/', hash: '../etc', scroll: 0 },
  { v: 1, path: '/', hash: 'timeline/<script>', scroll: 0 },
  { v: 1, path: '/<script>', hash: '', scroll: 0 },
  { v: 1, path: '/', hash: '', scroll: -1 },
  { v: 1, path: '/', hash: '', scroll: Number.NaN },
  { v: 1, path: '/', hash: '', scroll: 9e7 },
  { v: 1, path: '/', hash: '', scroll: '480' },
  { v: 1, path: '/?next=https://evil.example', hash: '', scroll: 0 },
]) {
  assert.equal(parseStoryReturn(bad), null, `accepted ${JSON.stringify(bad)}`)
  assert.equal(returnUrl(bad), '')
}

assert.equal(mapDestFromHref('#map/history/great-crossing-scott-1783-1815'), '#map/history/great-crossing-scott-1783-1815')
assert.equal(mapDestFromHref('/#map/stories/cumberland-falls'), '#map/stories/cumberland-falls')
assert.equal(mapDestFromHref('/#map/markers/1520'), '#map/markers/1520')
assert.equal(mapDestFromHref(`/#map/territory/${slug}`), `#map/territory/${slug}`)
assert.equal(mapDestFromHref('#map'), '')
assert.equal(mapDestFromHref('/#map'), '')
assert.equal(mapDestFromHref('https://evil.example/#map/history/x'), '')
assert.equal(mapDestFromHref('//evil.example/#map/history/x'), '')
assert.equal(mapDestFromHref('javascript:alert(1)'), '')
assert.equal(mapDestFromHref('/stories/x/#map/history/x'), '')
assert.equal(mapDestFromHref('#map/history/../admin'), '')
assert.equal(mapDestFromHref('#map/history/%2e%2e'), '')
assert.equal(mapDestFromHref('#map/history/<script>'), '')

assert.equal(PATH_RE.test('/'), true)
assert.equal(PATH_RE.test('/routes/'), true)
assert.equal(PATH_RE.test(`/stories/${slug}/`), true)
assert.equal(HASH_RE.test(''), true)
assert.equal(HASH_RE.test(`timeline/${slug}`), true)
assert.equal(HASH_RE.test('route-map'), true)
assert.equal(HASH_RE.test('map'), false)
assert.equal(HASH_RE.test('about'), false)
assert.equal(parseStoryReturn(origin('/', 'map', 10)), null)

const boot = staticPageBootScript()
assert.doesNotMatch(boot, /maplibre|\/src\/main\.js|https?:/i)
assert.doesNotMatch(boot, /<\/script>/i)
assert.match(boot, /data-story-map/)
assert.match(boot, /scrollRestoration/)
assert.match(boot, /khd-story-return/)
new Function(boot)

const sample = returnUrl(timeline)
assert.equal(sample.startsWith('/'), true)
assert.equal(sample.includes('://'), false)
assert.equal(/[<>]/.test(sample), false)

console.log('test-story-return: ok')
