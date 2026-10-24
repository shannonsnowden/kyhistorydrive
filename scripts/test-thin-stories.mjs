import assert from 'node:assert/strict'
import { storyWordCount, isThinStory, THIN_STORY_MIN_WORDS } from './lib/thin-stories.mjs'

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
const chrome = '\n\n## Kentucky today\n\nSource: [X (Grokipedia)](https://grokipedia.com/page/X)\n\n## Sources\n\n- one two three four\n\n![a caption here](/p.jpg)\n'

assert.equal(THIN_STORY_MIN_WORDS, 150)
assert.equal(storyWordCount(words(149) + chrome), 149, 'headings, sources, images excluded')
assert.equal(isThinStory({ bodyMarkdown: words(149) }), true, '149 words is thin')
assert.equal(isThinStory({ bodyMarkdown: words(150) }), false, '150 words is not thin')
assert.equal(isThinStory({ bodyMarkdown: words(151) + chrome }), false, '151 words is not thin')
assert.equal(storyWordCount('A [linked place name](/stories/x/) here.'), 5, 'link text counts, url does not')
assert.equal(storyWordCount("Kentucky's 1792 statehood – mid-century"), 4, 'spaced dash is not a word')
assert.equal(isThinStory({}), true)
console.log('test-thin-stories: 8/8 pass')
