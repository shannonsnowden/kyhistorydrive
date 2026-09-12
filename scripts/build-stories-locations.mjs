#!/usr/bin/env node
/**
 * Join stories to lat/lon via History places (exact/fuzzy) or county centroid fallback.
 * Writes public/content/stories-locations.json and merges lat/lon/mapConfidence into stories.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const storiesIdxPath = path.join(ROOT, 'public/content/stories.json')
const historyPath = path.join(ROOT, 'public/data/layers/history.geojson')
const centroidsPath = path.join(ROOT, 'public/data/county-centroids.json')
const storiesDir = path.join(ROOT, 'public/content/stories')
const outPath = path.join(ROOT, 'public/content/stories-locations.json')

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const idx = JSON.parse(fs.readFileSync(storiesIdxPath, 'utf8'))
const history = fs.existsSync(historyPath)
  ? JSON.parse(fs.readFileSync(historyPath, 'utf8')).features
  : []
const centroids = fs.existsSync(centroidsPath)
  ? JSON.parse(fs.readFileSync(centroidsPath, 'utf8'))
  : {}

const byName = new Map()
const byId = new Map()
const bySlug = new Map()
for (const f of history) {
  const p = f.properties || {}
  const n = norm(p.name || p.title)
  if (n) byName.set(n, f)
  if (p.id) byId.set(p.id, f)
  bySlug.set(slugify(p.name || p.title), f)
  bySlug.set(p.id, f)
}

const countyNames = Object.keys(centroids).sort((a, b) => b.length - a.length)
const countyRe = countyNames.length
  ? new RegExp(`\\b(${countyNames.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s+County\\b`, 'i')
  : null

function findHistory(story, bodyText) {
  const titleN = norm(story.title)
  const slug = story.slug
  let hit = byName.get(titleN) || byId.get(slug) || bySlug.get(slug)
  if (hit) return { feature: hit, confidence: 'exact', match: hit.properties.name }

  // fuzzy: history name contained in title or title contained in name (min length)
  for (const [n, f] of byName) {
    if (n.length >= 6 && (titleN.includes(n) || n.includes(titleN))) {
      return { feature: f, confidence: 'fuzzy', match: f.properties.name }
    }
  }
  // all significant tokens of history name appear in title
  for (const [n, f] of byName) {
    const toks = n.split(' ').filter((t) => t.length > 2)
    if (toks.length >= 2 && toks.every((t) => titleN.includes(t))) {
      return { feature: f, confidence: 'fuzzy', match: f.properties.name }
    }
  }

  // search body/summary for history place names
  const blob = norm([story.title, story.summary, bodyText].filter(Boolean).join(' '))
  let best = null
  for (const [n, f] of byName) {
    if (n.length >= 8 && blob.includes(n)) {
      if (!best || n.length > best.n.length) best = { n, f }
    }
  }
  if (best) return { feature: best.f, confidence: 'fuzzy', match: best.f.properties.name }

  return null
}

function countyFallback(text) {
  if (!countyRe) return null
  const m = text.match(countyRe)
  if (!m) return null
  const county = m[1]
  const c = centroids[county] || centroids[Object.keys(centroids).find((k) => k.toLowerCase() === county.toLowerCase())]
  if (!c) return null
  return { lon: c[0], lat: c[1], county, confidence: 'county' }
}

const locations = {}
const stats = { exact: 0, fuzzy: 0, county: 0, none: 0 }

for (const story of idx.stories) {
  let body = ''
  const fp = path.join(storiesDir, `${story.slug}.json`)
  if (fs.existsSync(fp)) {
    try {
      body = JSON.parse(fs.readFileSync(fp, 'utf8')).bodyMarkdown || ''
    } catch {
      body = ''
    }
  }
  const found = findHistory(story, body)
  let loc = null
  if (found) {
    const [lon, lat] = found.feature.geometry.coordinates
    loc = {
      slug: story.slug,
      lat,
      lon,
      mapConfidence: found.confidence,
      matchedPlace: found.match,
      historyId: found.feature.properties.id || null,
    }
    stats[found.confidence]++
  } else {
    const text = [story.title, story.summary, body, ...(story.tags || [])].join(' ')
    const fb = countyFallback(text)
    if (fb) {
      loc = {
        slug: story.slug,
        lat: fb.lat,
        lon: fb.lon,
        mapConfidence: 'county',
        matchedPlace: `${fb.county} County (centroid)`,
        historyId: null,
      }
      stats.county++
    } else {
      loc = {
        slug: story.slug,
        lat: null,
        lon: null,
        mapConfidence: null,
        matchedPlace: null,
        historyId: null,
      }
      stats.none++
    }
  }
  locations[story.slug] = loc
  // merge onto index entry
  story.lat = loc.lat
  story.lon = loc.lon
  story.mapConfidence = loc.mapConfidence
  story.matchedPlace = loc.matchedPlace
}

fs.writeFileSync(
  outPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), stats, locations }, null, 2) + '\n'
)
fs.writeFileSync(storiesIdxPath, JSON.stringify(idx, null, 2) + '\n')
console.log('stories-locations', stats)
console.log('Wrote', outPath)
