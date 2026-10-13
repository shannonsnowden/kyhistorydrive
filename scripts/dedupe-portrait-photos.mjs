#!/usr/bin/env node
/**
 * Shannon's rule (Oct 13): a story's Photos sidebar never shows the same picture as its inline
 * subject portrait. For every story with an inline portrait (same storySubject rule as the pages):
 *   - a row in scripts/story-photo-topic.json → the sidebar gets that topic photo (vendored file);
 *   - otherwise, if the sidebar photo is the portrait's Commons file → the sidebar photo is dropped
 *     until a topic photo exists.
 * Runs before build-stories, so the story index, story-photos.json and the app all follow.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storySubject } from '../src/related-people.js'
import { imageDims } from './image-dims.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const people = read('public/data/people.json')
const related = read('public/data/web/related-people.json')
const topic = read('scripts/story-photo-topic.json')
const dir = path.join(root, 'public/content/stories')

export const commonsName = (u) => {
  let f = String(u || '').split(/[?#]/)[0].split('/').pop() || ''
  try {
    f = decodeURIComponent(f)
  } catch {
    /* keep raw */
  }
  return f.replace(/^File:/, '').replace(/_/g, ' ').toLowerCase()
}

let swapped = 0
let dropped = 0
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const abs = path.join(dir, file)
  const story = JSON.parse(fs.readFileSync(abs, 'utf8'))
  const { person } = storySubject(related, people.people, story, people.storySubjects)
  if (!person) continue
  const row = topic[story.slug]
  let next = story.photo
  if (row) {
    const image = `/content/photos/stories/${story.slug}--topic.jpg`
    if (!fs.existsSync(path.join(root, 'public', image))) throw new Error(`dedupe-portrait-photos: missing ${image}`)
    next = {
      image_url: image,
      title: row.title,
      source_url: `https://commons.wikimedia.org/wiki/File:${row.commonsFile}`,
      source_label: 'Wikimedia Commons',
      attribution: row.attribution,
      year: row.year ?? null,
    }
  } else if (person.sourceFile && story.photo && commonsName(story.photo.source_url) === person.sourceFile.replace(/_/g, ' ').toLowerCase()) {
    next = undefined
  }
  if (JSON.stringify(next) === JSON.stringify(story.photo)) continue
  if (next) {
    story.photo = next
    swapped += 1
  } else {
    delete story.photo
    dropped += 1
    console.log(`  dedupe-portrait-photos: ${story.slug} sidebar photo dropped (same as ${person.id} portrait; no topic photo yet)`)
  }
  fs.writeFileSync(abs, `${JSON.stringify(story, null, 2)}\n`)
}
console.log(`dedupe-portrait-photos: ${swapped} topic photos applied, ${dropped} dropped`)

// Tall (portrait-orientation) sidebar photos: the 4:3 / 16:10 cover crop cuts them to a sliver
// (e.g. the Point Pleasant obelisk lost its top and base). Mark them fit "contain" so the whole
// image shows on a palette background. Never upscales: contain only scales down.
const TALL = 1.15
let tall = 0
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const abs = path.join(dir, file)
  const story = JSON.parse(fs.readFileSync(abs, 'utf8'))
  const url = story.photo?.image_url
  if (!url || !url.startsWith('/content/')) continue
  const d = imageDims(path.join(root, 'public', url.split(/[?#]/)[0]))
  const want = d && d.width > 0 && d.height / d.width >= TALL ? 'contain' : undefined
  if (story.photo.fit === want) continue
  if (want) story.photo.fit = want
  else delete story.photo.fit
  if (want) tall += 1
  fs.writeFileSync(abs, `${JSON.stringify(story, null, 2)}\n`)
}
console.log(`dedupe-portrait-photos: ${tall} tall sidebar photos set to fit contain`)
