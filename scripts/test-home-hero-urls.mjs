#!/usr/bin/env node
/** Homepage hero renderers keep only same-origin paths for links, map links and images. */
import assert from 'node:assert/strict'
import { safeLocalUrl, storyMapHref, storyPageHref, renderLeadStory, renderRailCard, leadPreloadTag } from '../src/home-hero-render.js'

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
const ok = { slug: 'x', title: 'T', mapHref: '/#map/stories/x', photo: { image_url: '/content/photos/stories/x.jpg', title: 'p' } }
assert.ok(renderLeadStory(ok).includes('src="/content/photos/stories/x.jpg"'))
assert.ok(renderLeadStory(ok).includes('href="/#map/stories/x"'))
console.log('test-home-hero-urls: ok')
