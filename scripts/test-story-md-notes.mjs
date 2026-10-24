#!/usr/bin/env node
// #337 note (b): story.md must read research notes from public/content/research/<slug>.json and
// story coordinates from stories-locations.json `locations`, with protected stories still at 0.1°.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAllStoryMarkdownFiles, RESEARCH_NOTES_DIR } from './build-story-md.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
assert.equal(RESEARCH_NOTES_DIR, 'public/content/research')
assert.ok(fs.existsSync(path.join(ROOT, RESEARCH_NOTES_DIR)), 'research notes dir exists')

// Work in a scratch root so dist/ in the clone is untouched.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'story-md-'))
const copy = (rel) => fs.cpSync(path.join(ROOT, rel), path.join(tmp, rel), { recursive: true })
for (const rel of ['public/content/stories.json', 'public/content/stories', 'public/content/stories-locations.json', 'public/content/research']) copy(rel)
const n = buildAllStoryMarkdownFiles(tmp)
assert.ok(n > 200, `built ${n}`)
const read = (slug) => fs.readFileSync(path.join(tmp, 'dist/stories', slug, 'story.md'), 'utf8')

const blue = read('battle-of-blue-licks')
const note = JSON.parse(fs.readFileSync(path.join(ROOT, RESEARCH_NOTES_DIR, 'battle-of-blue-licks.json'), 'utf8'))
const firstTimeline = (note.timeline || [])[0]
assert.ok(firstTimeline, 'fixture has a timeline')
assert.match(blue, /### Timeline/, 'research timeline rendered')

// Protected story with no coordinates in its own JSON: gets them from locations, rounded to 0.1°.
const mounds = read('the-c-and-o-mounds-johnson-county')
const coords = mounds.match(/\d+\.\d+°\s*[NS]/g) || []
assert.ok(coords.length, 'protected story still shows a (rounded) coordinate')
for (const c of coords) assert.match(c, /^\d+\.\d°/, `protected coordinate not rounded: ${c}`)
assert.doesNotMatch(mounds, /\b\d{2}\.\d{2,}°/, 'no fine-grained coordinate on a protected story')
// Image-evidence notes are not story research.
assert.doesNotMatch(read('ashlands-adena-mounds'), /\[Speculative\]/)
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`test-story-md-notes: OK (${n} story.md files)`)
