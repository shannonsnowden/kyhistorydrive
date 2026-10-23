#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { routeBySlug } from '../src/route-maps.js'
const SITE_ORIGIN = 'https://www.kyhistorydrive.com'
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
  const geo = roundedStoryGeo(story)
  const counties = storyCountiesList(story, matchedMarkers)
  const years = compactYearRange(story.year, story.yearEnd)
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

export function buildAllStoryMarkdownFiles(root = ROOT) {
  const distDir = path.join(root, 'dist')
  const stories = JSON.parse(fs.readFileSync(path.join(root, 'public/content/stories.json'), 'utf8')).stories || []
  const researchNotes = PrerenderPages.loadResearch(root)
  const researchBySlug = new Map(researchNotes.map((n) => [n.storySlug, n]))
  const peopleData = PrerenderPages.loadRelatedBundle(root)
  const markers = PrerenderPages.loadHistoricalMarkers(root)

  let count = 0
  for (const story of stories) {
    const notes = researchBySlug.get(story.slug) || null
    const route = routeBySlug(story.slug) || null
    const matchedMarkers = matchStoryMarkers(story, markers, notes, route)
    const subject = PrerenderPages.storyPortrait(story, peopleData)?.person || null
    const peopleInStory = resolvePeopleInStory(story, peopleData, notes, subject)
    const md = renderStoryMarkdownFile({ story, notes, matchedMarkers, peopleInStory })
    const outFile = path.join(distDir, 'stories', story.slug, 'story.md')
    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    fs.writeFileSync(outFile, md, 'utf8')
    count++
  }
  return count
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = buildAllStoryMarkdownFiles(ROOT)
  console.log(`Built ${count} story .md files in dist/stories/<slug>/story.md.`)
}
