#!/usr/bin/env node
/**
 * PR B (Shannon's standing rule): for each story, link every key person's first body mention to
 * their own story (or their /people/ card) and pick up to 3 inline portraits. Writes
 * public/data/web/story-people.json; the static pages and the app reader render it with
 * src/story-people.js. Links only (no text changes, no aliases published).
 *
 * Conservative matching:
 *  - candidates are only people whose people.json `stories` list includes this story;
 *  - only the full public name, exact case, whole words (no surnames, no aliases);
 *  - a name followed by a place word (Red Bird River, Boone County) does not count;
 *  - a name contained in another candidate's name that also matches there is skipped;
 *  - one-word names are skipped unless they are the story's title subject.
 * Portraits: real or AI (AI credit "AI illustration · Kentucky History Drive"); never the story's
 * title-subject portrait (already shown) and never the Photos sidebar image.
 * Scope: scripts/story-people-samples.json slugs until site-wide OK.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { storySubject, hasSafePortrait, PLACE_WORD } from '../src/related-people.js'
import { applyStoryPeople, nameRegex, MAX_INLINE } from '../src/story-people.js'
import { commonsName } from './dedupe-portrait-photos-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const people = read('public/data/people.json')
const related = read('public/data/web/related-people.json')
const scope = read('scripts/story-people-samples.json')
const dir = path.join(root, 'public/content/stories')
const stories = new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => f.slice(0, -5)))
const byId = new Map(people.people.map((p) => [p.id, p]))
const strip = (md) => String(md || '').replace(/^[ \t]*source:[ \t]*.+$/gim, '').replace(/\n{3,}/g, '\n\n').trim()

function ownStory(p, slug) {
  const r = related.people?.[p.name]
  if (r && r !== slug && stories.has(r)) return r
  return (p.stories || []).find((s) => s !== slug && (s === p.id || s.startsWith(`${p.id}-`)) && stories.has(s)) || null
}

const out = { _note: 'Built by scripts/build-story-people.mjs. Do not edit.', stories: {} }
const report = []
for (const slug of scope.slugs) {
  if (!stories.has(slug)) throw new Error(`build-story-people: sample ${slug} missing`)
  const story = JSON.parse(fs.readFileSync(path.join(dir, `${slug}.json`), 'utf8'))
  const body = strip(story.bodyMarkdown)
  const subject = storySubject(related, people.people, story, people.storySubjects).person
  const cands = people.people.filter((p) => (p.stories || []).includes(slug))
  const skipped = []
  const hits = []
  for (const p of cands) {
    const one = p.name.trim().split(/\s+/).length < 2
    if (one && subject?.id !== p.id) { skipped.push(`${p.name} (one-word name)`); continue }
    const m = nameRegex(p.name).exec(body)
    if (!m) { skipped.push(`${p.name} (full name not in body)`); continue }
    const after = body.slice(m.index + m[0].length)
    if (PLACE_WORD.test(after)) { skipped.push(`${p.name} (followed by a place word)`); continue }
    const inside = cands.find((q) => q !== p && q.name.includes(p.name) && nameRegex(q.name).test(body))
    if (inside) { skipped.push(`${p.name} (inside ${inside.name})`); continue }
    hits.push({ p, at: m.index + m[1].length })
  }
  hits.sort((a, b) => a.at - b.at)
  const links = hits.map(({ p }) => {
    const own = ownStory(p, slug)
    return { id: p.id, name: p.name, href: own ? `#timeline/${encodeURIComponent(own)}` : `/people/#${p.id}` }
  })
  const sidebar = story.photo?.source_url ? commonsName(story.photo.source_url) : ''
  const portraits = []
  for (const { p } of hits) {
    if (!hasSafePortrait(p)) continue
    if (subject && p.id === subject.id) continue
    if (sidebar && p.sourceFile && p.sourceFile.replace(/_/g, ' ').toLowerCase() === sidebar) { skipped.push(`${p.name} portrait (same as Photos sidebar)`); continue }
    if (story.photo?.image_url && [p.image.jpg, p.image.webp].includes(story.photo.image_url)) continue
    portraits.push(p.id)
  }
  out.stories[slug] = { links, portraits }
  // Guard: renders, only adds links/figures, never changes the text.
  const html = marked.parse(body)
  const done = applyStoryPeople(html, out.stories[slug], byId, (h) => h, { minPara: subject ? 1 : 0, startLeft: Boolean(subject) })
  const text = (h) => h.replace(/<figure[\s\S]*?<\/figure>/g, '').replace(/<[^>]+>/g, '')
  if (text(done) !== text(html)) throw new Error(`build-story-people: ${slug} text changed`)
  const figs = [...done.matchAll(/data-person="([\w-]+)"/g)].map((m) => m[1])
  if (figs.length > MAX_INLINE) throw new Error(`build-story-people: ${slug} has ${figs.length} portraits`)
  for (const id of figs) {
    const p = byId.get(id)
    if (p.ai && !done.includes('AI illustration · Kentucky History Drive')) throw new Error(`build-story-people: ${slug} AI credit missing`)
  }
  report.push(`  ${slug}: links ${links.map((l) => `${l.name}→${l.href}`).join(', ') || 'none'}; portraits ${figs.join(', ') || 'none'}${skipped.length ? `; skipped ${skipped.join(', ')}` : ''}`)
}
fs.writeFileSync(path.join(root, 'public/data/web/story-people.json'), `${JSON.stringify(out, null, 2)}\n`)
console.log(`build-story-people: ${scope.slugs.length} sample stories\n${report.join('\n')}`)
