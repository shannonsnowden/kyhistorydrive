#!/usr/bin/env node
/** Homepage hero renderers keep only same-origin paths for links, map links and images. */
import assert from 'node:assert/strict'
import { safeLocalUrl, storyMapHref, storyPageHref, renderLeadStory, renderRailCard, renderSwipeCard, leadPreloadTag, heroSlidesFromPack } from '../src/home-hero-render.js'

assert.equal(safeLocalUrl('/stories/a/'), '/stories/a/')
assert.equal(safeLocalUrl('/#map/history/x'), '/#map/history/x')
for (const bad of ['//evil.example/x', '/\\evil.example', '\\\\evil', 'https://evil.example/', 'javascript:alert(1)', 'data:text/html,x', ' /a', '/a\nb', '', null, undefined, 42]) {
  assert.equal(safeLocalUrl(bad), '', `should reject ${JSON.stringify(bad)}`)
}
assert.equal(storyMapHref({ mapHref: '//evil.example' }), null)
assert.equal(storyMapHref({ mapHref: '/#map/stories/a' }), '/#map/stories/a')
assert.equal(storyPageHref({ href: 'javascript:alert(1)' }), '/#timeline')
assert.equal(storyPageHref({ slug: 'a b' }), '/stories/a%20b/')

const evil = { slug: 'x', title: 'T', mapHref: '//evil.example/m', photo: { image_url: '//evil.example/p.jpg', title: 'p' } }
for (const html of [renderLeadStory(evil), renderRailCard(evil), leadPreloadTag(evil)]) {
  assert.ok(!html.includes('evil.example'), html)
}
const ok = { slug: 'x', title: 'T', mapHref: '/#map/stories/x', photo: { image_url: '/content/photos/stories/x.jpg', title: 'p', credit: 'Ada Lovelace' } }
assert.ok(renderLeadStory(ok).includes('src="/content/photos/stories/x.jpg"'))
assert.ok(renderLeadStory(ok).includes('href="/#map/stories/x"'))
assert.match(renderRailCard(ok), /class="hp-photo-credit hp-rail-card-credit">Photo: Ada Lovelace</)
assert.match(renderSwipeCard(ok), /class="hp-photo-credit hp-swipe-card-credit">Photo: Ada Lovelace</)
assert.doesNotMatch(renderRailCard({ slug: 'blank', title: 'No photo' }), /hp-rail-card-credit/)
assert.doesNotMatch(renderSwipeCard({ slug: 'blank', title: 'No photo' }), /hp-swipe-card-credit/)

const skipped = heroSlidesFromPack({
  stories: [
    { slug: 'no-photo', title: 'Blank lead' },
    { slug: 'shown', title: 'Shown', photo: { image_url: '/content/photos/stories/shown.jpg', credit: 'Shown credit' } },
  ],
})
assert.deepEqual(skipped.map((s) => s.slug), ['shown'])
const empty = heroSlidesFromPack({ stories: [{ slug: 'no-photo', title: 'Blank lead' }] })
assert.equal(empty[0].slug, 'big-bone-lick-older-cycle')
assert.ok(empty[0].photo?.image_url)
console.log('test-home-hero-urls: ok')
