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
