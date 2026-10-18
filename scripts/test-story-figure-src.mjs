// #315: isSafeFigureSrc rejects encoded traversal and backslashes (shared by prerender and client).
import assert from 'node:assert/strict'
import { isSafeFigureSrc } from '../src/story-figure.js'
const reject = [
  '/content/%2e%2e/secret.jpg',
  '/content/%2E%2E/secret.jpg',
  '/content/%252e%252e/secret.jpg',
  '/content/photos/%2fetc.jpg',
  '/content\\..\\secret.jpg',
  '/content/photos\\x.jpg',
  '\\\\evil.example/x.jpg',
  '/content/../secret.jpg',
  '//evil.example/content/x.jpg',
  'https://evil.example/x.jpg',
]
for (const s of reject) assert.equal(isSafeFigureSrc(s), false, `should reject ${s}`)
assert.equal(isSafeFigureSrc('/content/photos/stories/figures/culture-adena__ai-v2-1280.webp'), true)
console.log(`test-story-figure-src: ${reject.length} rejected, 1 accepted`)

// Evidence link beside the reconstruction note (Shannon's rule), shared by static pages and the reader.
const { storyFigureHtml } = await import('../src/story-figure.js')
const base = { webp: '/content/photos/stories/figures/x-1280.webp', jpg: '/content/photos/stories/figures/x-1280.jpg', alt: 'AI illustration: x', credit: 'AI illustration · Kentucky History Drive', note: 'Reconstruction note.' }
const good = storyFigureHtml({ ...base, evidence: 'culture-adena-image-evidence' })
assert.ok(good.includes('<a class="story-figure-evidence" href="/research/culture-adena-image-evidence/">See the evidence for this picture</a>'), 'good slug renders the link')
assert.ok(/story-figure-note">Reconstruction note\. <a class="story-figure-evidence"/.test(good), 'link sits beside the note')
const bad = ['../secret', 'a/b', 'culture%2e%2e', 'x"onmouseover="alert(1)', "x'y", '..', 'Culture-Adena', 'a b', '', null, 42]
for (const ev of bad) {
  const html = storyFigureHtml({ ...base, evidence: ev })
  assert.ok(!html.includes('story-figure-evidence') && !html.includes('/research/'), `bad slug ${ev} renders no link`)
  assert.ok(html.includes('Reconstruction note.'), 'note still renders')
}
console.log(`test-story-figure-src: evidence link renders for a good slug; ${bad.length} bad slugs render no link`)
