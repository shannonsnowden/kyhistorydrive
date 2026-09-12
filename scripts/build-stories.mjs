#!/usr/bin/env node
/** Rebuild public/content/stories.json index from public/content/stories/*.json */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIR = path.join(ROOT, 'public/content/stories')
const OUT = path.join(ROOT, 'public/content/stories.json')

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')
const stories = []
for (const f of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  stories.push({
    slug: raw.slug,
    title: raw.title,
    publishedDate: raw.publishedDate,
    summary: raw.summary,
    yearStart: raw.yearStart,
    yearEnd: raw.yearEnd,
    era: raw.era,
    tags: raw.tags || [],
    source: raw.source,
    briefDate: raw.briefDate,
  })
}

stories.sort((a, b) => {
  const ya = a.yearStart ?? 9999
  const yb = b.yearStart ?? 9999
  if (ya !== yb) return ya - yb
  return String(a.title).localeCompare(String(b.title))
})

const eras = [...new Set(stories.map((s) => s.era))].sort()
const dates = stories.map((s) => s.briefDate).filter(Boolean).sort()

const index = {
  generatedAt: new Date().toISOString(),
  count: stories.length,
  briefDateRange: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
  eras,
  stories,
}

fs.writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n')
console.log(`Wrote ${OUT} (${stories.length} stories)`)
