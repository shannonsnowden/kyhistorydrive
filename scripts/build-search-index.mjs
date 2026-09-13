#!/usr/bin/env node
/**
 * Build public/data/search-index.json from GeoJSON layers, markers,
 * stories (title/summary/body), and optional story locations.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA = path.join(ROOT, 'public/data')
const CONTENT = path.join(ROOT, 'public/content')
const OUT = path.join(DATA, 'search-index.json')

const PLACE_LAYERS = [
  { id: 'markers', file: path.join(DATA, 'markers.geojson'), label: 'Markers' },
  { id: 'history', file: path.join(DATA, 'layers/history.geojson'), label: 'History' },
  { id: 'museums', file: path.join(DATA, 'layers/museums.geojson'), label: 'Museums' },
  { id: 'national', file: path.join(DATA, 'layers/national.geojson'), label: 'National' },
  { id: 'war', file: path.join(DATA, 'layers/war.geojson'), label: 'War Sites' },
  { id: 'locals', file: path.join(DATA, 'layers/locals.geojson'), label: 'Good Eats' },
  { id: 'bridges', file: path.join(DATA, 'layers/bridges.geojson'), label: 'Covered Bridges' },
  { id: 'industry', file: path.join(DATA, 'layers/industry.geojson'), label: 'Industry' },
  { id: 'newspapers', file: path.join(DATA, 'layers/newspapers.geojson'), label: 'Newspapers' },
  { id: 'parks', file: path.join(DATA, 'layers/parks.geojson'), label: 'Parks' },
  { id: 'cemeteries', file: path.join(DATA, 'layers/cemeteries.geojson'), label: 'Cemeteries' },
  { id: 'distilleries', file: path.join(DATA, 'layers/distilleries.geojson'), label: 'Distilleries' },
]

const SNIPPET_LEN = 140

function clean(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function snippetFrom(...parts) {
  const text = clean(parts.filter(Boolean).join(' '))
  if (!text) return ''
  if (text.length <= SNIPPET_LEN) return text
  return `${text.slice(0, SNIPPET_LEN - 1).trim()}…`
}

/** Cap searchable blob so the static index stays downloadable. */
const TEXT_MAX = 700
function searchable(...parts) {
  const text = clean(parts.filter(Boolean).join(' '))
  if (text.length <= TEXT_MAX) return text
  return text.slice(0, TEXT_MAX)
}

function shareIdForPlace(props, layerId) {
  const p = props || {}
  if (layerId === 'markers' && p.marker_number != null && p.marker_number !== '') {
    return String(p.marker_number)
  }
  if (p.id != null && p.id !== '') return String(p.id)
  if (p.slug) return String(p.slug)
  const name = p.name || p.title || ''
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'))
}

function placeDocs() {
  const docs = []
  const counts = {}
  for (const layer of PLACE_LAYERS) {
    counts[layer.id] = 0
    if (!fs.existsSync(layer.file)) {
      console.warn(`search-index: missing ${layer.file}`)
      continue
    }
    const geo = readJson(layer.file)
    for (const feature of geo.features || []) {
      const p = feature.properties || {}
      const coords = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null
      if (!coords || coords.length < 2) continue
      const [lon, lat] = coords
      const title = clean(p.name || p.title || p.marker_title || 'Untitled')
      if (!title || title === 'Untitled') continue
      const shareId = shareIdForPlace(p, layer.id)
      if (!shareId) continue
      const desc = clean(
        p.inscription || p.history || p.description || p.location_text || p.subtitle || '',
      )
      const meta = [p.city, p.county, p.address, p.location_text, p.designation, p.site_type]
        .map(clean)
        .filter(Boolean)
        .join(' ')
      const text = searchable(title, desc, meta, layer.label)
      docs.push({
        id: `place:${layer.id}:${shareId}`,
        type: 'place',
        layerId: layer.id,
        layerLabel: layer.label,
        title,
        text,
        snippet: snippetFrom(desc || meta),
        lat,
        lon,
        shareId,
      })
      counts[layer.id]++
    }
  }
  return { docs, counts }
}

function storyDocs() {
  const docs = []
  const storiesDir = path.join(CONTENT, 'stories')
  const indexPath = path.join(CONTENT, 'stories.json')
  const locsPath = path.join(CONTENT, 'stories-locations.json')

  let locations = {}
  if (fs.existsSync(locsPath)) {
    try {
      locations = readJson(locsPath).locations || {}
    } catch {
      locations = {}
    }
  }

  const files = fs.existsSync(storiesDir)
    ? fs.readdirSync(storiesDir).filter((f) => f.endsWith('.json') && f !== 'index.json')
    : []

  if (files.length) {
    for (const f of files) {
      const raw = readJson(path.join(storiesDir, f))
      const slug = raw.slug || f.replace(/\.json$/, '')
      const title = clean(raw.title || slug)
      const summary = clean(raw.summary || '')
      const body = clean(raw.bodyMarkdown || raw.body || '')
      const tags = Array.isArray(raw.tags) ? raw.tags.map(clean).filter(Boolean).join(' ') : ''
      const loc = locations[slug] || {}
      const text = searchable(title, summary, body, tags, raw.era || '')
      const doc = {
        id: `story:${slug}`,
        type: 'story',
        title,
        text,
        snippet: snippetFrom(summary || body),
        slug,
      }
      if (typeof loc.lat === 'number' && typeof loc.lon === 'number') {
        doc.lat = loc.lat
        doc.lon = loc.lon
      }
      docs.push(doc)
    }
    return docs
  }

  // Fallback: stories.json index only (no full body)
  if (fs.existsSync(indexPath)) {
    const index = readJson(indexPath)
    for (const s of index.stories || []) {
      const slug = s.slug
      if (!slug) continue
      const title = clean(s.title || slug)
      const summary = clean(s.summary || '')
      const tags = Array.isArray(s.tags) ? s.tags.map(clean).filter(Boolean).join(' ') : ''
      const loc = locations[slug] || {}
      const doc = {
        id: `story:${slug}`,
        type: 'story',
        title,
        text: searchable(title, summary, tags, s.era || ''),
        snippet: snippetFrom(summary),
        slug,
      }
      if (typeof loc.lat === 'number' && typeof loc.lon === 'number') {
        doc.lat = loc.lat
        doc.lon = loc.lon
      }
      docs.push(doc)
    }
  }
  return docs
}

const LAYER_RANK = {
  national: 10,
  war: 9,
  parks: 8,
  museums: 7,
  history: 6,
  cemeteries: 5,
  industry: 4,
  bridges: 3,
  newspapers: 2,
  locals: 1,
  distilleries: 1,
  markers: 0,
}

const LAYER_LABEL = Object.fromEntries(PLACE_LAYERS.map((l) => [l.id, l.label]))

/** One search hit per place id across layers (White Hall on War+Museums, etc.). */
function dedupePlaceDocs(docs) {
  const byKey = new Map()
  for (const doc of docs) {
    // Markers keep per-number identity; other layers merge on shareId
    const key = doc.layerId === 'markers' ? doc.id : `place:${doc.shareId}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, {
        ...doc,
        id: key,
        layerIds: [doc.layerId],
      })
      continue
    }
    if (!prev.layerIds.includes(doc.layerId)) prev.layerIds.push(doc.layerId)
    const prevRank = LAYER_RANK[prev.layerId] ?? 0
    const nextRank = LAYER_RANK[doc.layerId] ?? 0
    if (nextRank > prevRank) {
      prev.layerId = doc.layerId
      prev.lat = doc.lat
      prev.lon = doc.lon
    }
    if ((doc.snippet || '').length > (prev.snippet || '').length) prev.snippet = doc.snippet
    if ((doc.title || '').length > (prev.title || '').length) prev.title = doc.title
    // Prefer longer searchable text
    if ((doc.text || '').length > (prev.text || '').length) prev.text = doc.text
    prev.layerLabel = prev.layerIds
      .slice()
      .sort((a, b) => (LAYER_RANK[b] ?? 0) - (LAYER_RANK[a] ?? 0))
      .map((id) => LAYER_LABEL[id] || id)
      .join(' · ')
  }
  return [...byKey.values()]
}

const { docs: rawPlaces, counts } = placeDocs()
const places = dedupePlaceDocs(rawPlaces)
const stories = storyDocs()
const documents = [...places, ...stories]

const payload = {
  generatedAt: new Date().toISOString(),
  version: 2,
  counts: {
    places: places.length,
    stories: stories.length,
    total: documents.length,
    byLayer: counts,
  },
  documents,
}

fs.mkdirSync(DATA, { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(payload))
console.log(
  `Wrote ${OUT} (${documents.length} docs: ${places.length} places, ${stories.length} stories)`,
)
