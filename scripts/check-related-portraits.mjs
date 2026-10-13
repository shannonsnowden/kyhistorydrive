#!/usr/bin/env node
/**
 * "Related people & stories" boxes show familiar faces (Shannon, Oct 13).
 * Reads every built static story page (dist/stories/<slug>/index.html) and, for each item in its
 * aside.story-related box, resolves the target story's person with the same rules the site uses
 * (src/related-people.js personByStorySlug: portraitFor, name links, id-prefix, storySubjects).
 * Fails when:
 *  (a) an item links to a person's story but has no related-headshot;
 *  (b) the same person appears twice in one box;
 *  (c) a headshot's image differs from that person's people.json image (one canonical face).
 * related-people.json pendingPortraits lists people who have no approved portrait yet; they are
 * allowed to have no face. Listing someone who already has a portrait, or an unknown id, fails.
 * portraitFor entries must name a known person id (or null for a story that is not a person's own).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { personByStorySlug } from '../src/related-people.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const people = read('public/data/people.json')
const related = read('public/data/web/related-people.json')
const dist = path.join(root, process.env.CHECK_RELATED_DIST || 'dist')
const byId = new Map(people.people.map((p) => [p.id, p]))
const hasImage = (p) => Boolean(p?.image?.webp && p?.image?.jpg)
const personFor = personByStorySlug(related, people.people, people.storySubjects)
const pending = new Set(related.pendingPortraits || [])
const errors = []

for (const id of pending) {
  if (!byId.has(id)) errors.push(`pendingPortraits: unknown person id ${id}`)
  else if (hasImage(byId.get(id))) errors.push(`pendingPortraits: ${id} now has a portrait; remove it from the list`)
}
for (const [slug, id] of Object.entries(related.portraitFor || {})) {
  if (id !== null && !byId.has(id)) errors.push(`portraitFor: ${slug} -> unknown person id ${id}`)
}

const ENT = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' }
const unattr = (s) => s.replace(/&(?:amp|quot|#39|lt|gt);/g, (m) => ENT[m])
let boxes = 0
let faces = 0
let pendingItems = 0
const usedPending = new Set()
for (const page of Object.keys(related.related || {})) {
  const file = path.join(dist, 'stories', page, 'index.html')
  if (!fs.existsSync(file)) continue
  const box = fs.readFileSync(file, 'utf8').match(/<aside class="story-related"[\s\S]*?<\/aside>/)
  if (!box) continue
  boxes++
  const seen = new Map()
  for (const li of box[0].match(/<li[\s>][\s\S]*?<\/li>/g) || []) {
    const href = li.match(/<a href="\/stories\/([^"/]+)\/"/)
    if (!href) continue
    const target = decodeURIComponent(href[1])
    const person = personFor.get(target)
    if (!person) continue
    if (seen.has(person.id)) errors.push(`${page}: ${person.id} appears twice (${seen.get(person.id)} and ${target})`)
    seen.set(person.id, target)
    const img = li.match(/<img class="related-headshot" src="([^"]+)"/)
    const src = li.match(/<source srcset="([^"]+)"/)
    if (!img) {
      if (pending.has(person.id) && !hasImage(person)) {
        pendingItems++
        usedPending.add(person.id)
        continue
      }
      errors.push(`${page}: link to ${target} (${person.id}) has no face`)
      continue
    }
    faces++
    if (!hasImage(person) || unattr(img[1]) !== person.image.jpg || !src || unattr(src[1]) !== person.image.webp) {
      errors.push(`${page}: face for ${person.id} (${unattr(img[1])}) is not the people.json image ${person.image?.jpg || 'none'}`)
    }
  }
}
for (const id of pending) if (!usedPending.has(id) && byId.has(id) && !hasImage(byId.get(id))) console.warn(`check-related-portraits: warning: pendingPortraits ${id} is not linked from any box`)

if (!boxes) errors.push('no built Related people & stories boxes found; run the build first')
if (errors.length) {
  console.error(`check-related-portraits: ${errors.length} problem(s)`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log(`check-related-portraits: ${boxes} boxes, ${faces} faces, ${pendingItems} items waiting on ${pending.size} pending portraits; OK`)
