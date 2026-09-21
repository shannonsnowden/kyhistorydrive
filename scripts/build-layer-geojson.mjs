#!/usr/bin/env node
/**
 * Build public/data/layers/*.geojson from ky-markers-drive JSON lists.
 * Source JSON expected in _ingest/layer-json/ (or pass KY_LAYER_JSON_DIR).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const srcDir = process.env.KY_LAYER_JSON_DIR || path.join(root, '_ingest/layer-json')
const outDir = path.join(root, 'public/data/layers')

const LAYERS = [
  {
    id: 'history',
    file: 'ky-history.json',
    pick: (p) => ({
      id: p.id,
      name: p.name,
      title: p.name,
      subtitle: p.subtitle || null,
      county: countyFromSubtitle(p.subtitle),
      history: p.history || null,
      description: p.history || null,
      website: p.website || null,
      category: p.category || null,
      marker_number: p.marker_number ?? null,
      marker_title: p.marker_title || null,
      source_date: p.source_date || null,
      year_start: p.year_start ?? null,
      year_end: p.year_end ?? null,
      photo: vendorHistoryPhoto(p.photo),
      ...inferHistoryYearsAndEra(p),
    }),
  },
  {
    id: 'museums',
    file: 'museums.json',
    pick: (p) => ({
      id: p.id,
      name: p.name,
      title: p.name,
      city: p.city || null,
      county: p.county || null,
      address: p.address || null,
      history: p.history || null,
      description: p.history || null,
      website: p.website || null,
      museum_type: p.museum_type || null,
      founded_year: p.founded_year ?? null,
      yearStart: p.founded_year ?? null,
      yearEnd: p.founded_year ?? null,
    }),
  },
  {
    id: 'national',
    file: 'national-sites.json',
    pick: (p) => ({
      id: p.id,
      name: p.name,
      title: p.name,
      city: p.city || null,
      county: p.county || null,
      address: p.address || null,
      history: p.history || null,
      description: p.history || null,
      website: p.website || null,
      designation: p.designation || null,
    }),
  },
  {
    id: 'war',
    file: 'war-sites.json',
    pick: (p) => ({
      id: p.id,
      name: p.name,
      title: p.name,
      city: p.city || null,
      county: p.county || null,
      address: p.address || null,
      history: p.history || null,
      description: p.history || null,
      website: p.website || null,
      war: p.war || null,
      site_type: p.site_type || null,
    }),
  },
  {
    id: 'locals',
    file: 'locals.json',
    pick: (p) => ({
      id: p.id,
      name: p.name,
      title: p.name,
      city: p.city || null,
      county: p.county || null,
      address: p.address || null,
      history: p.history || null,
      description: p.history || null,
      website: p.website || null,
      category: p.category || null,
      cuisine_or_type: p.cuisine_or_type || null,
    }),
  },
  {
    id: 'bridges',
    file: 'covered-bridges.json',
    pick: (p) => ({
      id: p.id,
      name: p.name,
      title: p.name,
      city: p.city || null,
      county: p.county || null,
      history: p.history || null,
      description: p.history || null,
      website: p.website || null,
      built_year: p.built_year ?? null,
      yearStart: p.built_year ?? null,
      yearEnd: p.built_year ?? null,
      crosses: p.crosses || null,
      truss: p.truss || null,
      status: p.status || null,
      length_ft: p.length_ft ?? null,
    }),
  },
  {
    id: 'industry',
    file: 'industrial-sites.json',
    pick: (p) => ({
      id: p.id,
      name: p.name,
      title: p.name,
      city: p.city || null,
      county: p.county || null,
      address: p.address || null,
      history: p.history || null,
      description: p.history || null,
      website: p.website || null,
      industry_type: p.industry_type || null,
      built_year: p.built_year ?? null,
      yearStart: p.built_year ?? null,
      yearEnd: p.built_year ?? null,
      marker_number: p.marker_number ?? null,
      nrhp: p.nrhp ?? null,
    }),
  },
  {
    id: 'newspapers',
    file: 'newspapers.json',
    pick: (p) => ({
      id: p.id,
      name: p.name,
      title: p.name,
      city: p.city || null,
      county: p.county || null,
      history: p.history || null,
      description: p.history || null,
      website: p.loc_url || p.chronicling_america_url || null,
      first_year: p.first_year ?? null,
      last_year: p.last_year ?? null,
      yearStart: p.first_year ?? null,
      yearEnd: p.last_year ?? p.first_year ?? null,
      lccn: p.lccn || null,
      frequency: p.frequency || null,
    }),
  },
  {
    id: 'parks',
    file: 'state-parks.json',
    pick: (p) => ({
      id: p.id,
      name: p.name,
      title: p.name,
      city: p.city || null,
      county: p.county || null,
      history: p.history || null,
      description: p.history || null,
      website: p.website || null,
      park_type: p.park_type || null,
      has_restaurant: p.has_restaurant ?? null,
    }),
  },
  {
    id: 'cemeteries',
    file: 'historic-cemeteries.json',
    pick: (p) => ({
      id: p.id,
      name: p.name,
      title: p.name,
      city: p.city || null,
      county: p.county || null,
      history: p.history || null,
      description: p.history || null,
      website: p.website || p.why_historic_url || null,
      established_year: p.established_year ?? null,
      yearStart: p.established_year ?? null,
      yearEnd: p.established_year ?? null,
      cemetery_type: p.cemetery_type || null,
      nrhp: p.nrhp ?? null,
    }),
  },
  {
    id: 'distilleries',
    file: 'distilleries.json',
    pick: (p) => ({
      id: p.id,
      name: p.name,
      title: p.name,
      city: p.city || null,
      county: p.county || null,
      address: p.address || null,
      history: p.history || null,
      description: p.history || null,
      website: p.website || null,
      founded_year: p.founded_year ?? null,
      yearStart: p.founded_year ?? null,
      yearEnd: p.founded_year ?? null,
      trail_status: p.trail_status || null,
    }),
  },
]

const CATEGORY_ERA = {
  archaeology: 'prehistoric',
  frontier: 'frontier',
  battle: 'frontier',
  town: 'early-commonwealth',
  person: 'other',
  bourbon: 'other',
  industry: 'other',
}

function vendorHistoryPhoto(photo) {
  if (!photo) return null
  const local = photo.local_image_path
  if (typeof local === 'string' && local.startsWith('/') && !local.startsWith('//')) {
    return { ...photo, image_url: local }
  }
  return photo
}

function countyFromSubtitle(sub) {
  if (!sub) return null
  const m = String(sub).match(/^([^/]+?)\s*(?:County)?\s*\//i)
  if (m) return m[1].replace(/\s*County\s*$/i, '').trim()
  return null
}

function inferHistoryYearsAndEra(p) {
  // Prefer explicit occupation/event years from source JSON (never dig/NRHP dates).
  if (p.year_start != null || p.year_end != null) {
    const yearStart = p.year_start != null ? Number(p.year_start) : Number(p.year_end)
    const yearEnd = p.year_end != null ? Number(p.year_end) : yearStart
    let era = null
    if (yearStart < 1000) era = 'prehistoric'
    else if (yearStart < 1600) era = 'native'
    else if (yearStart < 1792) era = 'frontier'
    else if (yearStart <= 1860) era = 'early-commonwealth'
    else era = 'other'
    return { yearStart, yearEnd, era }
  }

  const text = [p.history, p.subtitle, p.name].filter(Boolean).join(' ')
  const cultural =
    p.category === 'archaeology' ||
    /pleistocene|mastodon|mammoth|paleo|archaic|woodland|adena|hopewell|mississippian|fort\s*ancient|shell\s*midden/i.test(
      text,
    )

  let yearStart = null
  let yearEnd = null

  const bce = [...text.matchAll(/(\d{1,5})\s*(?:B\.?\s*C\.?\s*E?\.?|BC)\b/gi)]
  if (bce.length) {
    const years = bce.map((m) => -Number(m[1].replace(/,/g, '')))
    yearStart = Math.min(...years)
    yearEnd = Math.max(...years)
  }

  // CE years: for cultural/archaeology sites ignore 1800+ study/excavation dates
  const ce = [...text.matchAll(/\b((?:1[0-9]|20)\d{2})\b/g)].map((m) => Number(m[1]))
  const ceUse = cultural ? ce.filter((y) => y < 1800) : ce
  if (ceUse.length) {
    const min = Math.min(...ceUse)
    const max = Math.max(...ceUse)
    if (yearStart == null) yearStart = min
    else yearStart = Math.min(yearStart, min)
    if (yearEnd == null) yearEnd = max
    else yearEnd = Math.max(yearEnd, max)
  }

  if (yearStart == null && cultural) {
    if (/late\s*archaic|shell\s*midden|indian\s*knoll|carlston|annis|ward\s*site/i.test(text)) {
      yearStart = -3000
      yearEnd = -1000
    } else if (/adena/i.test(text)) {
      yearStart = -800
      yearEnd = 700
    } else if (/fort\s*ancient/i.test(text)) {
      yearStart = 1000
      yearEnd = 1750
    } else if (/mississippian|wickliffe/i.test(text)) {
      yearStart = 1000
      yearEnd = 1500
    } else if (/hopewell|middle\s*woodland/i.test(text)) {
      yearStart = -100
      yearEnd = 500
    } else if (/pleistocene|mastodon|mammoth|paleo/i.test(text)) {
      yearStart = -10000
      yearEnd = -8000
    } else {
      yearStart = -10000
      yearEnd = -1000
    }
  }

  let era = null
  if (yearStart != null) {
    if (yearStart < 1000) era = 'prehistoric'
    else if (yearStart < 1600) era = 'native'
    else if (yearStart < 1792) era = 'frontier'
    else if (yearStart <= 1860) era = 'early-commonwealth'
    else era = 'other'
  } else {
    era = p.era || CATEGORY_ERA[p.category] || 'other'
  }

  return { yearStart, yearEnd, era }
}

function toFeature(layerId, item, props) {
  const lat = item.latitude
  const lon = item.longitude
  if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    return null
  }
  const properties = { ...props, layer: layerId }
  for (const k of Object.keys(properties)) {
    if (properties[k] === null || properties[k] === undefined) delete properties[k]
  }
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [Number(lon), Number(lat)] },
    properties,
  }
}

function buildLayer(spec) {
  const fp = path.join(srcDir, spec.file)
  if (!fs.existsSync(fp)) {
    console.warn(`Missing ${fp}`)
    return { id: spec.id, count: 0, skipped: 0 }
  }
  const list = JSON.parse(fs.readFileSync(fp, 'utf8'))
  const features = []
  let skipped = 0
  for (const item of list) {
    const f = toFeature(spec.id, item, spec.pick(item))
    if (f) features.push(f)
    else skipped++
  }
  const geo = { type: 'FeatureCollection', features }
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, `${spec.id}.geojson`), JSON.stringify(geo))
  return { id: spec.id, count: features.length, skipped }
}

function buildStoriesGeojson() {
  const storiesPath = path.join(root, 'public/content/stories.json')
  const locsPath = path.join(root, 'public/content/stories-locations.json')
  const empty = { type: 'FeatureCollection', features: [] }
  if (!fs.existsSync(storiesPath)) {
    fs.writeFileSync(path.join(outDir, 'stories.geojson'), JSON.stringify(empty))
    return { id: 'stories', count: 0, note: 'no stories' }
  }
  const idx = JSON.parse(fs.readFileSync(storiesPath, 'utf8'))
  const locs = fs.existsSync(locsPath)
    ? JSON.parse(fs.readFileSync(locsPath, 'utf8')).locations || {}
    : {}
  const features = []
  for (const s of idx.stories || []) {
    const loc = locs[s.slug] || {}
    const lat = s.lat ?? loc.lat
    const lon = s.lon ?? loc.lon
    if (lat == null || lon == null) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(lon), Number(lat)] },
      properties: {
        id: s.slug,
        name: s.title,
        title: s.title,
        layer: 'stories',
        era: s.era || null,
        yearStart: s.yearStart ?? null,
        yearEnd: s.yearEnd ?? null,
        summary: s.summary || null,
        description: s.summary || null,
        slug: s.slug,
        mapConfidence: s.mapConfidence || loc.mapConfidence || null,
        matchedPlace: s.matchedPlace || loc.matchedPlace || null,
        website: null,
      },
    })
  }
  fs.writeFileSync(path.join(outDir, 'stories.geojson'), JSON.stringify({ type: 'FeatureCollection', features }))
  return { id: 'stories', count: features.length, note: 'from stories-locations' }
}

const results = LAYERS.map(buildLayer)
results.push(buildStoriesGeojson())
console.log(JSON.stringify(results, null, 2))
