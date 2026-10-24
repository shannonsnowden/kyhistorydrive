import assert from 'node:assert/strict'
import { storyWordCount, isThinStory, stripInline, THIN_STORY_MIN_WORDS } from './lib/thin-stories.mjs'
import { PrerenderPages } from './prerender-pages.mjs'

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
const chrome = '\n\n## Kentucky today\n\nSource: [X (Grokipedia)](https://grokipedia.com/page/X)\n\n## Sources\n\n- one two three four\n\n![a caption here](/p.jpg)\n'

const N = THIN_STORY_MIN_WORDS
assert.ok(Number.isInteger(N) && N > 0)
assert.equal(storyWordCount(words(N - 1) + chrome), N - 1, 'headings, sources, images excluded')
assert.equal(isThinStory({ bodyMarkdown: words(N - 1) }), true, 'N-1 words is thin')
assert.equal(isThinStory({ bodyMarkdown: words(N) }), false, 'N words is not thin')
assert.equal(isThinStory({ bodyMarkdown: words(N + 1) + chrome }), false, 'N+1 words is not thin')
assert.equal(storyWordCount('A [linked place name](/stories/x/) here.'), 5, 'link text counts, url does not')
assert.equal(storyWordCount("Kentucky's 1792 statehood – mid-century"), 4, 'spaced dash is not a word')
assert.equal(isThinStory({}), true)

// Security Watch: linear time on long unclosed runs (50k chars each must finish < 100 ms).
for (const unit of ['[', '![', '<']) {
  const input = unit.repeat(Math.ceil(50000 / unit.length))
  const t0 = performance.now()
  storyWordCount(input)
  storyWordCount(`${input}\n${words(10)}`)
  const ms = performance.now() - t0
  assert.ok(ms < 100, `50k run of ${unit} took ${ms.toFixed(1)} ms`)
}
assert.equal(stripInline('a ![alt](/i.jpg) [b c](/x/) <em>d</em> [e'), 'a    b c   d  [e')

// Sitemap lastmod follows the story file's last git change, so a story expanded past the threshold
// (its JSON edited) gets a new lastmod the day it re-enters the sitemap.
const story = { slug: 'x', publishedDate: '2026-09-01', bodyMarkdown: words(N - 1) }
const before = new Map([['public/content/stories/x.json', '2026-09-02']])
assert.equal(isThinStory(story), true)
assert.equal(PrerenderPages.storyLastmod(story, before), '2026-09-02')
const expanded = { ...story, bodyMarkdown: words(N + 10) }
const after = new Map([['public/content/stories/x.json', '2026-11-05']])
assert.equal(isThinStory(expanded), false)
assert.equal(PrerenderPages.storyLastmod(expanded, after), '2026-11-05', 'lastmod moves to the expansion commit')
console.log('test-thin-stories: 13/13 pass (incl. 50k-char linear-time cases, lastmod on re-index)')
