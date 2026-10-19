#!/usr/bin/env node
/**
 * Item 70: build public/data/web/transport-links.json from scripts/transport-links.json.
 * Each listed story gets one link to /roads-and-rails/ on its configured phrase (exact text,
 * first mention outside links and headings, after the people links are applied). The static
 * story pages (prerender-pages.mjs) and the app reader (main.js) render it with
 * src/transport-links.js. Links only: fails if the phrase is missing or the text would change.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { applyStoryPeople } from '../src/story-people.js'
import { applyTransportLink, ROADS_RAILS_HREF } from '../src/transport-links.js'
import { ROADS_RAILS_FLAG, roadsRailsEnabled } from './roads-rails-flag.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const config = read('scripts/transport-links.json')
const people = read('public/data/people.json')
const spFile = path.join(root, 'public/data/web/story-people.json')
const storyPeople = fs.existsSync(spFile) ? JSON.parse(fs.readFileSync(spFile, 'utf8')) : { stories: {} }
const byId = new Map((people.people || []).map((p) => [p.id, p]))
const dir = path.join(root, 'public/content/stories')
const strip = (md) => String(md || '').replace(/^[ \t]*source:[ \t]*.+$/gim, '').replace(/\n{3,}/g, '\n\n').trim()
/** Text outside tags, by an indexOf scan (as in build-story-people). Only compares before/after text; never sanitizes. */
function text(html) {
  let out = ''
  let i = 0
  for (;;) {
    const lt = html.indexOf('<', i)
    if (lt < 0) return out + html.slice(i)
    out += html.slice(i, lt)
    const gt = html.indexOf('>', lt + 1)
    if (gt < 0) return out
    i = gt + 1
  }
}

const out = { _note: 'Built by scripts/build-transport-links.mjs from scripts/transport-links.json. Do not edit.', stories: {} }
// Roads & Rails left the live site on Oct 19: no story links to it unless KHD_ROADS_RAILS=1.
// scripts/transport-links.json keeps the phrases so the links come back with the flag.
if (!roadsRailsEnabled()) {
  fs.mkdirSync(path.join(root, 'public/data/web'), { recursive: true })
  fs.writeFileSync(path.join(root, 'public/data/web/transport-links.json'), `${JSON.stringify(out, null, 2)}\n`)
  console.log(`build-transport-links: ${ROADS_RAILS_FLAG} is off; 0 story links (${Object.keys(config.stories || {}).length} kept in scripts/transport-links.json)`)
  process.exit(0)
}
const errors = []
for (const [slug, phrase] of Object.entries(config.stories || {})) {
  const file = path.join(dir, `${slug}.json`)
  if (!fs.existsSync(file)) {
    errors.push(`${slug}: story missing`)
    continue
  }
  if (config.allowlist?.[slug]) errors.push(`${slug}: both linked and allowlisted`)
  const story = JSON.parse(fs.readFileSync(file, 'utf8'))
  const html = applyStoryPeople(marked.parse(strip(story.bodyMarkdown)), storyPeople.stories?.[slug], byId)
  const done = applyTransportLink(html, { phrase })
  const n = done.split(`href="${ROADS_RAILS_HREF}"`).length - 1
  if (n !== 1) {
    errors.push(`${slug}: phrase "${phrase}" not found outside links and headings`)
    continue
  }
  if (text(done) !== text(html)) errors.push(`${slug}: text changed`)
  out.stories[slug] = { phrase }
}
if (errors.length) {
  console.error(`build-transport-links:\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
fs.mkdirSync(path.join(root, 'public/data/web'), { recursive: true })
fs.writeFileSync(path.join(root, 'public/data/web/transport-links.json'), `${JSON.stringify(out, null, 2)}\n`)
console.log(`build-transport-links: ${Object.keys(out.stories).length} stories link to ${ROADS_RAILS_HREF}; ${Object.keys(config.allowlist || {}).length} allowlisted`)
