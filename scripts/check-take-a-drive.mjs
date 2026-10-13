#!/usr/bin/env node
/**
 * Take a Drive: every built story page whose story is a stop on a drive carries one Take a Drive button
 * per drive, each linking to /drives/?drive=<id> for a real drive; no other story page has one.
 * Source of truth: the drive pages' STOPS (scripts/story-drives-lib.mjs), so new stories and drives are
 * covered without a list here. Also checks the Timeline data file (dist/data/web/story-drives.json)
 * matches, and that the Drives index still handles ?drive=.
 * Usage: node scripts/check-take-a-drive.mjs [--dist <dir>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storyDrives, DRIVE_ID_RE } from './story-drives-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ai = process.argv.indexOf('--dist')
const dist = ai > 0 ? path.resolve(process.argv[ai + 1]) : path.join(root, 'dist')
const errors = []
const expected = storyDrives(root)

const sdir = path.join(dist, 'stories')
const slugs = fs.readdirSync(sdir).filter((d) => fs.existsSync(path.join(sdir, d, 'index.html')))
let withButton = 0
let buttons = 0
for (const slug of slugs) {
  const html = fs.readFileSync(path.join(sdir, slug, 'index.html'), 'utf8')
  const tags = [...html.matchAll(/<a\b[^>]*class="take-a-drive-btn"[^>]*>/g)].map((m) => m[0])
  const want = expected.stories[slug] || []
  if (!want.length) {
    if (tags.length || html.includes('data-take-a-drive')) errors.push(`${slug}: has a Take a Drive button but is on no drive`)
    continue
  }
  if (!tags.length) { errors.push(`${slug}: on ${want.join(', ')} but has no Take a Drive button`); continue }
  withButton++
  buttons += tags.length
  const got = tags.map((t) => (t.match(/href="([^"]*)"/) || [])[1] || '')
  for (const href of got) {
    const m = href.match(/^\/drives\/\?drive=([^&#"]+)$/)
    const id = m ? decodeURIComponent(m[1]) : ''
    if (!m || !DRIVE_ID_RE.test(id)) errors.push(`${slug}: bad Take a Drive link "${href}"`)
    else if (!fs.existsSync(path.join(dist, 'drives', id, 'index.html'))) errors.push(`${slug}: Take a Drive links missing drive "${id}"`)
    else if (!want.includes(id)) errors.push(`${slug}: Take a Drive links ${id}, which has no stop for this story`)
  }
  const ids = got.map((h) => decodeURIComponent(h.replace(/^\/drives\/\?drive=/, '')))
  for (const id of want) if (!ids.includes(id)) errors.push(`${slug}: missing Take a Drive button for ${id}`)
  if (new Set(ids).size !== ids.length) errors.push(`${slug}: duplicate Take a Drive buttons`)
  if (!/class="take-a-drive-icon"/.test(html)) errors.push(`${slug}: Take a Drive button lacks the route-and-car icon`)
}
for (const slug of Object.keys(expected.stories)) {
  if (!slugs.includes(slug)) errors.push(`drive stop links story "${slug}", which has no built page`)
}

// Timeline panel data (src/main.js reads this).
const dataFile = path.join(dist, 'data/web/story-drives.json')
if (!fs.existsSync(dataFile)) errors.push('dist/data/web/story-drives.json is missing (Timeline panels need it)')
else if (JSON.stringify(JSON.parse(fs.readFileSync(dataFile, 'utf8'))) !== JSON.stringify(expected)) {
  errors.push('dist/data/web/story-drives.json is out of date with the drive pages (run build-story-drives)')
}
// Drives index deep link.
const idx = fs.readFileSync(path.join(dist, 'drives/index.html'), 'utf8')
if (!idx.includes('id="drivePick"') || !idx.includes("get('drive')")) errors.push('drives/index.html no longer handles ?drive=')

if (errors.length) {
  console.error(`check-take-a-drive: ${errors.length} problem(s)`)
  for (const e of errors.slice(0, 40)) console.error('  - ' + e)
  process.exit(1)
}
console.log(`check-take-a-drive: ${withButton} stories with a Take a Drive button (${buttons} buttons, ${Object.keys(expected.drives).length} drives); ${slugs.length - withButton} stories without, as expected`)
