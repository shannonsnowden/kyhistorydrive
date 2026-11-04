#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { routeBySlug } from '../src/route-maps.js'
const SITE_ORIGIN = 'https://kyhistorydrive.com'
import { PrerenderPages } from './prerender-pages.mjs'
import { compactYearRange, countyLong, markerRecords } from '../src/story-tools.js'
import {
  buildUnifiedSources,
  extractResearchClaims,
  formatCoordCardinal,
  formatCountiesBadge,
  isProtectedStory,
  matchStoryMarkers,
  resolvePeopleInStory,
  roundedStoryGeo,
  splitStoryMarkdown,
  storyCountiesList,
  storyEraLabel,
} from './lib/unified-story-data.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function yamlQuote(val) {
  return JSON.stringify(String(val ?? ''))
}

function absolutizeLinks(md) {
  return String(md || '').replace(/\]\((\/[^)]+)\)/g, `](${SITE_ORIGIN}$1)`)
}

export function renderStoryMarkdownFile({ story, notes = null, matchedMarkers = [], peopleInStory = [] }) {
  if (!story?.slug || !/^[a-z0-9-]+$/.test(String(story.slug))) {
    throw new Error(`Invalid story slug: ${story?.slug}`)
  }
  const geo = roundedStoryGeo(story)
  const counties = storyCountiesList(story, matchedMarkers)
  const years = compactYearRange(story.year ?? story.yearStart, story.yearEnd)
  const canonicalUrl = `${SITE_ORIGIN}/stories/${encodeURIComponent(story.slug)}/`
  const coordStr = geo ? formatCoordCardinal(geo.lat, geo.lon, geo.decimals) : ''
  const protectedStory = isProtectedStory(story)

  const fm = [
    '---',
    `title: ${yamlQuote(story.title)}`,
    `slug: ${yamlQuote(story.slug)}`,
    `url: ${yamlQuote(canonicalUrl)}`,
    `era: ${yamlQuote(storyEraLabel(story.era))}`,
    ...(years ? [`years: ${yamlQuote(years)}`] : []),
    ...(story.county ? [`county: ${yamlQuote(countyLong(story.county))}`] : []),
    ...(counties.length ? [`counties: [${counties.map((c) => yamlQuote(countyLong(c))).join(', ')}]`] : []),
    ...(coordStr ? [`coordinates: ${yamlQuote(coordStr)}`] : []),
    ...(geo
      ? [
          `coordinates_precision: ${yamlQuote(
            protectedStory
              ? 'approximate (rounded to 0.1 deg / ~11 km to protect a sensitive archaeological or cultural site)'
              : 'standard (0.0001 deg)',
          )}`,
        ]
      : []),
    `license: ${yamlQuote('CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/)')}`,
    '---',
  ].join('\n')

  const lines = [fm, '', `# ${story.title}`, '']
  if (story.summary) {
    lines.push(`> ${story.summary.trim()}`, '')
  }

  const g = story.glance || {}
  const glanceRows = []
  if (g.who) glanceRows.push(`- **Who:** ${g.who}`)
  if (g.what) glanceRows.push(`- **What:** ${g.what}`)
  if (g.when || years) glanceRows.push(`- **When:** ${g.when || years}`)
  if (g.where || counties.length) glanceRows.push(`- **Where:** ${g.where || formatCountiesBadge(counties)}`)
  if (g.whyItMattered) glanceRows.push(`- **Why it mattered:** ${g.whyItMattered}`)
  if (peopleInStory.length) {
    const pNames = peopleInStory
      .map((p) => `${p.name}${p.dates ? ` (${p.dates})` : ''}`)
      .join('; ')
    glanceRows.push(`- **People:** ${pNames}`)
  }
  if (coordStr) {
    glanceRows.push(
      `- **Coordinates:** ${coordStr}${protectedStory ? ' *(Approximate area — rounded to 0.1° to protect a sensitive site)*' : ''}`,
    )
  }

  if (glanceRows.length) {
    lines.push('## At a glance', '', ...glanceRows, '')
  }

  const { mainMarkdown, kentuckyTodayMarkdown } = splitStoryMarkdown(
    story.bodyMarkdown || '',
    Boolean(g.who && g.what && g.when && g.where && g.whyItMattered),
  )

  lines.push('## The story', '', absolutizeLinks(mainMarkdown), '')

  if (kentuckyTodayMarkdown) {
    lines.push('## Kentucky today', '', absolutizeLinks(kentuckyTodayMarkdown), '')
  }

  if (matchedMarkers.length) {
    lines.push('## Historical markers on the ground', '')
    for (const m of matchedMarkers) {
      const mCounty = m.county ? ` — ${countyLong(m.county)}` : ''
      lines.push(`### Marker #${m.id}: ${m.title}${mCounty}`, '')
      if (m.location_text) lines.push(`- **Location:** ${m.location_text}`)
      if (!protectedStory && m.lat != null && m.lon != null) {
        const mLat = Math.round(Number(m.lat) * 10000) / 10000
        const mLon = Math.round(Number(m.lon) * 10000) / 10000
        lines.push(`- **Coordinates:** ${formatCoordCardinal(mLat, mLon, 4)}`)
      }
      if (m.source_url) lines.push(`- **KHS Marker DB:** ${m.source_url}`)
      lines.push(`- **Map link:** ${SITE_ORIGIN}/#map/markers/${encodeURIComponent(m.id)}`)
      if (m.inscription) {
        lines.push('', `> ${m.inscription.trim().replace(/\n+/g, '\n> ')}`)
      }
      lines.push('')
    }
  }

  if (peopleInStory.length) {
    lines.push('## People in this story', '')
    for (const p of peopleInStory) {
      const dates = p.dates ? ` (${p.dates})` : ''
      const role = p.role ? ` — ${p.role}` : ''
      lines.push(`- **[${p.name}${dates}](${SITE_ORIGIN}/people/#${encodeURIComponent(p.id)})**${role}`)
    }
    lines.push('')
  }

  const { items: sources, byId: sourcesById } = buildUnifiedSources(story, notes, matchedMarkers)
  lines.push('## Sources & research notes', '')
  if (sources.length) {
    lines.push('### Sources', '')
    for (const s of sources) {
      const linkPart = s.url ? ` — ${s.url}` : ''
      const typePart = s.type ? ` [${s.type}]` : ''
      lines.push(`${s.num}. ${s.label || s.url}${typePart}${linkPart}`)
    }
    lines.push('')
  }

  const claimsList = extractResearchClaims(notes)
  if (claimsList.length) {
    lines.push('### Key facts & claims', '')
    for (const c of claimsList) {
      const refs = (c.sourceIds || c.sources || [])
        .map((id) => sourcesById.get(id)?.num)
        .filter(Boolean)
        .map((n) => `[${n}]`)
        .join('')
      lines.push(`- ${c.claim}${refs ? ` ${refs}` : ''}`)
    }
    lines.push('')
  }

  if (Array.isArray(notes?.timeline) && notes.timeline.length) {
    lines.push('### Timeline', '')
    for (const t of notes.timeline) {
      const td = t.date || t.year || ''
      const refs = (t.sourceIds || t.sources || [])
        .map((id) => sourcesById.get(id)?.num)
        .filter(Boolean)
        .map((n) => `[${n}]`)
        .join('')
      lines.push(`- ${td ? `**${td}** — ` : ''}${t.event || ''}${refs ? ` ${refs}` : ''}`)
    }
    lines.push('')
  }

  if (Array.isArray(notes?.notes) && notes.notes.length) {
    lines.push('### Editorial notes', '')
    for (const n of notes.notes) {
      lines.push(`- ${n}`)
    }
    lines.push('')
  }

  lines.push(
    '---',
    '',
    `Cite as: "${story.title}." Kentucky History Drive. ${canonicalUrl} Text licensed under CC BY-NC 4.0.`,
    '',
  )

  return lines.join('\n')
}

/** Per-story research notes (<slug>.json). culture-*-image-evidence files are image briefs, not story notes. */
export const RESEARCH_NOTES_DIR = 'public/content/research'

export function buildAllStoryMarkdownFiles(root = ROOT) {
  const storiesIndexFile = path.join(root, "public/content/stories.json")
  const storiesDir = path.join(root, "public/content/stories")
  const locationsFile = path.join(root, "public/content/stories-locations.json")
  const markersFile = path.join(root, "public/data/web/historical-markers.geojson")
  const notesDir = path.join(root, RESEARCH_NOTES_DIR)
  if (!fs.existsSync(storiesIndexFile)) return 0

  const indexData = JSON.parse(fs.readFileSync(storiesIndexFile, "utf8"))
  const indexStories = Array.isArray(indexData.stories) ? indexData.stories : []
  let locBySlug = new Map()
  if (fs.existsSync(locationsFile)) {
    try {
      const locs = JSON.parse(fs.readFileSync(locationsFile, "utf8"))
      // stories-locations.json: { locations: { <slug>: { slug, lat, lon, ... } } }
      for (const [slug, row] of Object.entries(locs.locations || {})) {
        if (row) locBySlug.set(row.slug || slug, row)
      }
    } catch (_) {}
  }

  let markers = []
  if (fs.existsSync(markersFile)) {
    try {
      const geo = JSON.parse(fs.readFileSync(markersFile, "utf8"))
      markers = (geo.features || []).map((f) => {
        const props = f?.properties || {}
        const coords = f?.geometry?.coordinates || []
        return {
          id: String(props.marker_number ?? props.id ?? ""),
          title: String(props.title || props.name || ""),
          county: String(props.county || ""),
          location_text: String(props.location_text || ""),
          inscription: String(props.inscription || ""),
          source_url: String(props.source_url || ""),
          lat: Array.isArray(coords) ? coords[1] : props.lat,
          lon: Array.isArray(coords) ? coords[0] : props.lon,
        }
      }).filter((m) => m.id && m.title)
    } catch (_) {}
  }

  const outDir = path.join(root, "dist")
  let count = 0
  for (const stub of indexStories) {
    if (!stub?.slug || stub.redirectTo || stub.mergedInto) continue
    if (!/^[a-z0-9-]+$/.test(String(stub.slug))) {
      throw new Error(`Invalid story slug: ${stub.slug}`)
    }
    let full = stub
    const perStoryPath = path.join(storiesDir, `${stub.slug}.json`)
    if (fs.existsSync(perStoryPath)) {
      try {
        full = { ...stub, ...JSON.parse(fs.readFileSync(perStoryPath, "utf8")) }
      } catch (_) {}
    }
    const loc = locBySlug.get(stub.slug)
    if (loc) {
      if (full.lat == null && loc.lat != null) full.lat = loc.lat
      if (full.lon == null && loc.lon != null) full.lon = loc.lon
      if (loc.coordinatesProtected) full.coordinatesProtected = true
    }
    if (!String(full.bodyMarkdown || "").trim()) continue

    let notes = null
    const notePath = path.join(notesDir, `${stub.slug}.json`)
    if (fs.existsSync(notePath)) {
      try {
        notes = JSON.parse(fs.readFileSync(notePath, "utf8"))
      } catch (_) {}
    }

    const route = routeBySlug(full.slug)
    const matchedMarkers = matchStoryMarkers(full, markers, notes, route)
    const peopleInStory = resolvePeopleInStory(full, null, notes, null)
    const md = renderStoryMarkdownFile({ story: full, notes, matchedMarkers, peopleInStory })
    const storyDir = path.join(outDir, "stories", full.slug)
    fs.mkdirSync(storyDir, { recursive: true })
    fs.writeFileSync(path.join(storyDir, "story.md"), md)
    count += 1
  }
  return count
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = buildAllStoryMarkdownFiles(ROOT)
  console.log(`Built ${count} story .md files in dist/stories/<slug>/story.md.`)
}
