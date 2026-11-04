#!/usr/bin/env node
/**
 * #345: the homepage hero set (home-preview.json stories/hero/features) holds only stories with a
 * photo. Runs build-home-preview twice in a row and requires the same hero set both times.
 *   node scripts/test-home-preview-photos.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'public/content/home-preview.json')

function heroSet() {
  const d = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  const cards = [...(d.stories || []), d.hero, ...(d.features || [])].filter(Boolean)
  for (const c of cards) assert.ok(c.photo?.image_url, `home-preview: ${c.slug} has no photo`)
  return JSON.stringify({ stories: d.stories.map((c) => c.slug), hero: d.hero?.slug, features: (d.features || []).map((c) => c.slug) })
}

const runs = []
for (let i = 0; i < 2; i += 1) {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/build-home-preview.mjs')], { cwd: ROOT, stdio: 'ignore' })
  runs.push(heroSet())
}
assert.equal(runs[1], runs[0], 'hero set changed between two consecutive builds')
console.log(`test-home-preview-photos: OK (${JSON.parse(runs[0]).stories.length} stories, all with photos, stable across 2 builds)`)
