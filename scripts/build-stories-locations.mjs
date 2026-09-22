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


/** Manual pin overrides when fuzzy body matching picks the wrong place (photos/map). */
const MANUAL_OVERRIDES = {
  // Long hunter biography — brief Falls visit shouldn't pin the whole story to Louisville
  'michael-stoner-german-long-hunter': {
    matchName: 'Boonesborough',
    lat: 37.8909,
    lon: -84.2666,
    confidence: 'override',
  },
  // Lexington founding — not John Filson / Louisville
  'col-robert-patterson-builds-lexington': {
    matchName: 'Lexington',
    lat: 38.0406,
    lon: -84.5037,
    confidence: 'override',
  },
  // Title doesn't fuzzy-match long history name
  'diamond-caverns-decorated-limestone': {
    matchName: 'Diamond Caverns Park City / Ste. Genevieve limestone',
    lat: 37.1161,
    lon: -86.0626,
    confidence: 'override',
  },
  // "Callaway" was matching Calloway County centroid
  'col-richard-callaway-of-boonesborough': {
    matchName: 'Boonesborough',
    lat: 37.8909,
    lon: -84.2666,
    confidence: 'override',
  },
  // Was wrongly fuzzy-matched to Isaac Shelby
  'chickasaw-hunting-grounds': {
    matchName: 'Chickasaw / Jackson Purchase',
    lat: 37.10445,
    lon: -88.63255,
    confidence: 'override',
  },
  'frankfort-franks-ford-becomes-the-capital': {
    matchName: 'Frankfort Founding',
    lat: 38.1980678,
    lon: -84.8655544,
    confidence: 'override',
  },
  'ashlands-adena-mounds': {
    matchName: 'Ashland Central Park Adena Mounds',
    lat: 38.4730716,
    lon: -82.63752,
    confidence: 'override',
  },
  'paris-from-hopewell': {
    matchName: 'Paris Founding',
    lat: 38.21273333333333,
    lon: -84.24981666666666,
    confidence: 'override',
  },
  'elizabethtown-from-severns-valley': {
    matchName: 'Elizabethtown founding / Severns Valley',
    lat: 37.6828019,
    lon: -85.9118928,
    confidence: 'override',
  },
  'nicholasville-takes-shape': {
    matchName: 'Nicholasville founding / Rev. John Metcalf 1798',
    lat: 37.88055,
    lon: -84.57311666666666,
    confidence: 'override',
  },
  'versailles-takes-shape': {
    matchName: 'Versailles founding / Hezekiah Briscoe',
    lat: 38.052276,
    lon: -84.7139251,
    confidence: 'override',
  },
  'winchester-clark-county-seat': {
    matchName: 'Winchester Founding',
    lat: 37.9929112,
    lon: -84.1776735,
    confidence: 'override',
  },
  'richmond-from-millers-barn': {
    matchName: 'Richmond Founding',
    lat: 37.747975,
    lon: -84.2943662,
    confidence: 'override',
  },
  'lancaster-at-wallace-s-crossroads': {
    matchName: "Lancaster founding / Wallace's Crossroads",
    lat: 37.3238322,
    lon: -84.9223154,
    confidence: 'override',
  },
  'cynthiana-cynthia-anna-on-the-licking': {
    matchName: 'Cynthiana founding / Robert Harrison',
    // History layer point was misplaced (~Murray); use Cynthiana city center
    lat: 38.3903,
    lon: -84.2941,
    confidence: 'override',
  },
  'taylorsville-on-brashears-creek': {
    matchName: 'Taylorsville',
    lat: 38.0317,
    lon: -85.3441,
    confidence: 'override',
  },
  'springfield-first-county-seat-after-statehood': {
    matchName: 'Springfield',
    lat: 37.6853,
    lon: -85.2222,
    confidence: 'override',
  },
  'bland-w-ballard-of-tick-creek': {
    matchName: 'Bland W. Ballard / Tyler Station',
    lat: 38.2143528,
    lon: -85.2361795,
    confidence: 'override',
  },
  'james-crow-on-glenns-creek': {
    matchName: 'James C. Crow / Oscar Pepper',
    lat: 38.13698933835563,
    lon: -84.78761913468118,
    confidence: 'override',
  },
  'capt-abraham-lincoln-on-long-run': {
    matchName: 'Squire Boone / Painted Stone / Long Run',
    lat: 38.2363772,
    lon: -85.4313603,
    confidence: 'override',
  },
  // Louisville wharf — Falls of the Ohio / Louisville area
  'evan-williams-on-the-louisville-wharf': {
    matchName: 'Falls of the Ohio',
    lat: 38.2753405,
    lon: -85.7628814,
    confidence: 'override',
  },
  // Sep 15 — avoid Col. John Bowman fuzzy; use iOS pin coords
  'col-john-todd-of-lexington': {
    matchName: 'Col. John Todd of Lexington',
    lat: 38.0406,
    lon: -84.5037,
    confidence: 'override',
  },
  'stanford-from-st-asaph': {
    matchName: "Stanford / St. Asaph (Logan's Fort)",
    lat: 37.529666666666664,
    lon: -84.66123333333333,
    confidence: 'override',
  },
  'newt-kash-hollow-15mf1': {
    matchName: 'Newt Kash Hollow (15Mf1)',
    lat: 37.9510333,
    lon: -83.6258167,
    confidence: 'override',
  },
  'muir-site-15js86': {
    matchName: 'Muir Site (15Js86)',
    lat: 37.8967,
    lon: -84.6228,
    confidence: 'override',
  },
  // Sep 16 — use iOS pin coords; leave Illinois Confederation unpinned (Cahokia)
  'maj-joseph-bowman': {
    matchName: 'Maj. Joseph Bowman',
    lat: 37.7623,
    lon: -84.8433,
    confidence: 'override',
  },
  'newport-at-the-licking-mouth': {
    matchName: 'Newport Barracks',
    lat: 39.09213333333334,
    lon: -84.50191666666667,
    confidence: 'override',
  },
  'adams-site-15fu4': {
    matchName: 'Adams Site (15Fu4)',
    lat: 36.5520,
    lon: -89.1860,
    confidence: 'override',
  },
  'drennon-springs-salt-works': {
    matchName: 'Drennon Springs',
    lat: 38.4400769,
    lon: -85.1692443,
    confidence: 'override',
  },
  // Sep 17 — align with iOS pins; leave Tutelo unpinned (theme / Totteroy corridor)
  'col-william-russell-iii': {
    matchName: 'Col. William Russell III / Fayette',
    lat: 38.0406,
    lon: -84.5037,
    confidence: 'override',
  },
  'owensboro-yellow-banks': {
    matchName: 'Owensboro / Yellow Banks',
    lat: 37.7549958,
    lon: -87.0614257,
    confidence: 'override',
  },
  'annis-mound-village': {
    matchName: 'Annis Mound & Village (15Bt2)',
    lat: 37.2898389,
    lon: -86.752889,
    confidence: 'override',
  },
  'cumberland-falls': {
    matchName: 'Cumberland Falls',
    lat: 36.84008333333333,
    lon: -84.33956666666667,
    confidence: 'override',
  },
  // Sep 18 — align with iOS pins; leave Chickamauga unpinned (TN towns / raid theme)
  'maj-silas-harlan': {
    matchName: "Maj. Silas Harlan / Harlan's Station",
    lat: 37.66,
    lon: -84.83,
    confidence: 'override',
  },
  'glasgow-the-barrens': {
    matchName: 'Glasgow / Barren County seat',
    lat: 36.9818833,
    lon: -85.9145954,
    confidence: 'override',
  },
  'chiggerville-15oh1': {
    matchName: 'Chiggerville (15Oh1)',
    lat: 37.4,
    lon: -86.9,
    confidence: 'override',
  },
  'salts-cave-15ht4': {
    matchName: 'Salts Cave (15Ht4)',
    lat: 37.187,
    lon: -86.101,
    confidence: 'override',
  },
  // Sep 19 — align with iOS pins; leave Ojibwe unpinned (theme / Bird's War Road)
  'capt-nathaniel-hart': {
    matchName: 'Capt. Nathaniel Hart / White Oak Springs',
    lat: 37.895633333333336,
    lon: -84.26686666666667,
    confidence: 'override',
  },
  'henderson-at-red-banks': {
    matchName: 'Henderson / Red Banks',
    lat: 37.8479021,
    lon: -87.5898562,
    confidence: 'override',
  },
  'turk-site-carlisle-county': {
    matchName: 'Turk Site (15Ce6)',
    lat: 36.89476944,
    lon: -89.08521944,
    confidence: 'override',
  },
  'lost-river-cave': {
    matchName: 'Lost River Cave',
    lat: 36.95283333,
    lon: -86.47166389,
    confidence: 'override',
  },
  // Sep 20 — align with iOS pins; leave Shawnee Chillicothe unpinned (Old Chillicothe OH)
  'capt-jack-jouett': {
    matchName: 'Capt. Jack Jouett / Craig’s Creek',
    lat: 37.9827487,
    lon: -84.7708839,
    confidence: 'override',
  },
  'shepherdsville-on-salt-river': {
    matchName: 'Shepherdsville / Salt River falls',
    lat: 37.98791666666666,
    lon: -85.71646666666666,
    confidence: 'override',
  },
  'hansen-site-15gp14': {
    matchName: 'Hansen Site (15GP14)',
    lat: 38.72371944,
    lon: -83.01908889,
    confidence: 'override',
  },
  'natural-bridge-sandstone-arch': {
    matchName: 'Natural Bridge',
    lat: 37.776836,
    lon: -83.6833147,
    confidence: 'override',
  },
  // Sep 21 — McGinty + McKenna; Lawrenceburg/Adams already pinned.
  // Wea towns / Scott 1791 raid: pin to real Ouiatenon (Tippecanoe County, IN),
  // not Limestone/Maysville and not the old Photon drop in Nelson County, KY.
  // Wikipedia Ouiatenon 40°24′3″N 86°57′36″W (story source). Map has no maxBounds.
  'wea-towns-at-ouiatenon-and-scotts-1791-kentucky-raid': {
    matchName: 'Wea (Waayaahtanwa) / Ouiatenon',
    lat: 40.40083,
    lon: -86.96,
    confidence: 'override',
  },
  'ann-mcginty-and-kentuckys-first-spinning-wheel': {
    matchName: 'Ann McGinty / Fort Harrod',
    lat: 37.7619646,
    lon: -84.8485383,
    confidence: 'override',
  },
  'henry-mckennas-fairfield-sour-mash': {
    matchName: 'Henry McKenna / Fairfield',
    lat: 37.932222,
    lon: -85.3838837,
    confidence: 'override',
  },
  'lawrenceburg-from-kaufmans-station-to-anderson-county-seat': {
    matchName: "Lawrenceburg / Kaufman's Station",
    lat: 38.1741739,
    lon: -84.8769101,
    confidence: 'override',
  },
  // History pin was geocoded to Lexington (UK); site is NRHP address-restricted near Mount Sterling
  'wright-mounds-montgomery-county': {
    matchName: 'Wright Mounds (Montgomery County Adena)',
    lat: 38.05699,
    lon: -83.94437,
    confidence: 'override',
  },
  // 2026-09-22 morning brief
  'john-finley-the-trader-who-put-kentucky-on-boone-s-map': {
    matchName: 'John Finley',
    lat: 37.93955,
    lon: -83.9975333,
    confidence: 'override',
  },
  'springfield-founding-and-washington-county-seat': {
    matchName: 'Springfield / Washington County seat',
    lat: 37.6853413,
    lon: -85.2221819,
    confidence: 'override',
  },
  'peter-village-early-woodland-enclosure-near-lexington': {
    matchName: 'Peter Village enclosure (15Fa166)',
    lat: 38.0459102,
    lon: -84.4960297,
    confidence: 'override',
  },
  'isaac-ruddell-and-the-guns-at-ruddell-s-station': {
    matchName: "Ruddell's Station",
    lat: 38.3351,
    lon: -84.2749,
    confidence: 'override',
  },
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
  // Story slug is a prefix of a history id (ashlands-adena-mounds ↔ ashland-adena-mounds)
  for (const [id, f] of byId) {
    if (!id || typeof id !== 'string') continue
    if (id.startsWith(slug) || slug.startsWith(id) || id.includes(slug) || slug.includes(id.replace(/-/g, ' '))) {
      // require meaningful overlap length
      const a = slug.split('-').filter(Boolean)
      const b = id.split('-').filter(Boolean)
      const shared = a.filter((t) => b.includes(t) && t.length > 3)
      if (shared.length >= 2) {
        return { feature: f, confidence: 'fuzzy', match: f.properties.name }
      }
    }
  }

  // fuzzy: history name contained in title or title contained in name (min length)
  for (const [n, f] of byName) {
    if (n.length >= 6 && (titleN.includes(n) || n.includes(titleN))) {
      return { feature: f, confidence: 'fuzzy', match: f.properties.name }
    }
  }
  // Shared leading place name (e.g. "diamond caverns …" vs long history title)
  const titleToks = titleN.split(' ').filter((t) => t.length > 2)
  if (titleToks.length >= 2) {
    const lead = titleToks.slice(0, 2).join(' ')
    let best = null
    for (const [n, f] of byName) {
      if (n.startsWith(lead) || n.includes(lead)) {
        if (!best || n.length < best.n.length) best = { n, f }
      }
    }
    if (best) return { feature: best.f, confidence: 'fuzzy', match: best.f.properties.name }
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
const stats = { exact: 0, fuzzy: 0, county: 0, override: 0, none: 0 }

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
  const override = MANUAL_OVERRIDES[story.slug]
  let found = override ? null : findHistory(story, body)
  if (override) {
    let feature = null
    // Explicit lat/lon always wins (history layer can be misplaced)
    if (override.lat != null && override.lon != null) {
      let historyId = null
      if (override.matchName) {
        feature = byName.get(norm(override.matchName)) || bySlug.get(slugify(override.matchName))
        historyId = feature?.properties?.id || null
      }
      found = {
        feature: {
          geometry: { coordinates: [override.lon, override.lat] },
          properties: {
            name: override.matchName || feature?.properties?.name || story.title,
            id: historyId,
          },
        },
        confidence: override.confidence || 'override',
        match: override.matchName || feature?.properties?.name || 'manual override',
      }
    } else if (override.matchName) {
      feature = byName.get(norm(override.matchName)) || bySlug.get(slugify(override.matchName))
      if (feature) {
        found = { feature, confidence: override.confidence || 'override', match: feature.properties.name }
      }
    }
  }
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
    stats[found.confidence] = (stats[found.confidence] || 0) + 1
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
