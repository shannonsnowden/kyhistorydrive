/**
 * Approvals 112 A1. Score every story against the Father David Rice template bar.
 *
 * Hard gaps (strict mode only, unless the slug is in scripts/rice-bar-allowlist.json):
 *   - body under 150 words (storyWordCount, the same counter as the thin-story floor)
 *   - no ## Kentucky today prose (the heading splitStoryMarkdown already publishes)
 *   - no named sources (a Source: line with a link label or a book citation, or a labeled link under ## Sources)
 *
 * Informational, never a failure: outside the 350–450 word band, no /people/# link,
 * no other /stories/ link, no place photo (AI portraits and /figures/ art do not count).
 *
 * The build runs this soft. RICE_BAR=strict or --strict fails unallowlisted hard gaps.
 * The template story itself fails the run in either mode if it slips under the hard bar.
 */
import fs from 'node:fs'
import path from 'node:path'
import { splitStoryMarkdown } from './unified-story-data.mjs'
import { storyWordCount } from './thin-stories.mjs'
import { learnMoreItemsFromMarkdown } from '../../src/story-tools.js'

export const RICE_FLOOR_WORDS = 150
export const RICE_DEPTH_MIN = 350
export const RICE_DEPTH_MAX = 450
export const RICE_TEMPLATE_SLUG = 'father-david-rice-and-kentuckys-first-presbyterian-churches'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PEOPLE_URL = /^\/people\/#([A-Za-z0-9-]+)\/?$/
const STORY_URL = /^\/stories\/([A-Za-z0-9-]+)\/?(?:[?#].*)?$/

function markdownLinks(markdown) {
  const s = String(markdown || '')
  const startRe = /(^|[^!])\[([^\]]*)\]\(/g
  const links = []
  let match
  while ((match = startRe.exec(s))) {
    const start = match.index + match[0].length
    let i = start
    let depth = 1
    while (i < s.length && depth > 0) {
      if (s[i] === '(') depth += 1
      else if (s[i] === ')') depth -= 1
      if (depth > 0) i += 1
    }
    const raw = s.slice(start, i).trim()
    links.push({ label: match[2] || '', url: raw.split(/\s+/)[0] || '' })
    startRe.lastIndex = Math.min(s.length, i + 1)
  }
  return links
}

function labeledHttpLinks(markdown) {
  return markdownLinks(markdown).filter((link) => {
    const label = String(link.label || '').trim()
    return label && label !== link.url && /^https?:\/\//i.test(link.url)
  })
}

/** A Source: line that still names a work after bare URLs are removed (a book citation has no link). */
function sourceLineNamesAWork(markdown) {
  const lines = String(markdown || '').match(/^[ \t]*source:[ \t]*.+$/gim) || []
  return lines.some((line) => {
    const text = line.replace(/^[ \t]*source:[ \t]*/i, '').replace(/https?:\/\/\S+/gi, ' ')
    return /[\p{L}\p{N}]/u.test(text)
  })
}

export function depthBand(words) {
  if (words < RICE_FLOOR_WORDS) return 'under-floor'
  if (words < RICE_DEPTH_MIN) return 'short'
  if (words > RICE_DEPTH_MAX) return 'above'
  return 'band'
}

/** Same candidate order as PrerenderPages.storyPhoto: body, then story-photos.json, then the index row. */
export function pickStoryPhoto(body, indexRow, photos) {
  const candidates = [body?.photo, photos?.bySlug?.[body?.slug]?.photo, indexRow?.photo]
  for (const photo of candidates) {
    if (photo?.image_url && !String(photo.image_url).includes('..')) return photo
  }
  return null
}

export function isPlacePhoto(photo) {
  const url = String(photo?.image_url || '')
  if (!url || url.includes('..')) return false
  // PrerenderPages.isAiArtUrl: /figures/ and __ai. Portrait files are not place photos either.
  if (url.includes('/figures/') || url.includes('__ai') || url.includes('/people/portraits/')) return false
  return true
}

function uniqueSorted(values) {
  return [...new Set(values)].sort()
}

export function assessRiceBar(story) {
  const markdown = String(story?.bodyMarkdown || '')
  const words = storyWordCount(markdown)
  const parts = splitStoryMarkdown(markdown)
  const kentuckyToday = storyWordCount(parts.kentuckyTodayMarkdown) > 0
  const namedLine = learnMoreItemsFromMarkdown(markdown).some((item) => String(item.linkText || item.label || '').trim())
  const sources = namedLine || sourceLineNamesAWork(markdown) || labeledHttpLinks(parts.inlineSourcesMarkdown).length > 0
  const peopleLinks = uniqueSorted(
    markdownLinks(markdown)
      .map((link) => PEOPLE_URL.exec(link.url)?.[1] || '')
      .filter(Boolean)
      .map((id) => id.toLowerCase()),
  )
  const storyLinks = uniqueSorted(
    markdownLinks(markdown)
      .map((link) => STORY_URL.exec(link.url)?.[1] || '')
      .filter((slug) => slug && slug !== story?.slug)
      .map((slug) => slug.toLowerCase()),
  )
  const placePhoto = isPlacePhoto(story?.photo)
  const depth = depthBand(words)
  const hard = []
  if (depth === 'under-floor') hard.push('under-floor')
  if (!kentuckyToday) hard.push('missing-kentucky-today')
  if (!sources) hard.push('missing-sources')
  const info = []
  if (depth === 'short') info.push('short-of-depth')
  if (depth === 'above') info.push('above-depth-band')
  if (!peopleLinks.length) info.push('no-people-links')
  if (!storyLinks.length) info.push('no-story-links')
  if (!placePhoto) info.push('no-place-photo')
  return {
    slug: String(story?.slug || ''),
    title: String(story?.title || story?.slug || ''),
    words,
    depth,
    kentuckyToday,
    sources,
    peopleLinks,
    storyLinks,
    placePhoto,
    hard,
    info,
  }
}

export function loadRiceBarStories(root) {
  const indexPath = path.join(root, 'public/content/stories.json')
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  const photoPath = path.join(root, 'public/content/story-photos.json')
  const photos = fs.existsSync(photoPath) ? JSON.parse(fs.readFileSync(photoPath, 'utf8')) : { bySlug: {} }
  const stories = []
  for (const row of index.stories || []) {
    const slug = String(row?.slug || '')
    const file = path.join(root, 'public/content/stories', `${slug}.json`)
    if (!fs.existsSync(file)) throw new Error(`check-rice-bar: missing story file for ${slug}`)
    const body = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (body.slug !== slug) throw new Error(`check-rice-bar: ${slug} file slug is ${body.slug}`)
    stories.push({
      slug,
      title: body.title || row.title || slug,
      bodyMarkdown: body.bodyMarkdown || '',
      photo: pickStoryPhoto(body, row, photos),
    })
  }
  if (!stories.length) throw new Error('check-rice-bar: no stories')
  return stories
}

export function allowlistFromJson(data) {
  if (!data || !Array.isArray(data.slugs)) throw new Error('rice-bar allowlist: slugs must be an array')
  const slugs = new Set()
  for (const slug of data.slugs) {
    if (typeof slug !== 'string' || !SLUG.test(slug)) {
      throw new Error(`rice-bar allowlist: bad slug ${JSON.stringify(slug)}`)
    }
    slugs.add(slug)
  }
  return slugs
}

export function loadAllowlist(root) {
  const file = path.join(root, 'scripts/rice-bar-allowlist.json')
  return allowlistFromJson(JSON.parse(fs.readFileSync(file, 'utf8')))
}

export function riceBarStrict(env, argv) {
  const flag = argv.includes('--strict')
  const warn = argv.includes('--warn')
  if (flag && warn) throw new Error('check-rice-bar: pass only one of --strict or --warn')
  const raw = env.RICE_BAR
  if (raw && raw !== 'strict' && raw !== 'warn') {
    throw new Error(`check-rice-bar: RICE_BAR must be strict or warn, got ${raw}`)
  }
  if (flag) return true
  if (warn) return false
  return raw === 'strict'
}

export function riceBarExitCode(rows, { strict = false, allow = new Set() } = {}) {
  const template = rows.find((row) => row.slug === RICE_TEMPLATE_SLUG)
  if (!template) return { code: 1, reason: 'missing-template' }
  if (template.hard.length) return { code: 1, reason: 'template-under-bar' }
  if (!strict) return { code: 0, reason: 'soft' }
  const blocking = rows.filter((row) => row.hard.length && !allow.has(row.slug))
  if (blocking.length) return { code: 1, reason: 'strict', blocking }
  return { code: 0, reason: 'strict-clear' }
}

function gapRow(row) {
  return { slug: row.slug, title: row.title, words: row.words }
}

export function buildRiceBarReport(rows, { strict = false, allow = new Set() } = {}) {
  const stories = [...rows].sort((a, b) => a.slug.localeCompare(b.slug))
  const byWords = (a, b) => a.words - b.words || a.slug.localeCompare(b.slug)
  const underFloor = stories.filter((row) => row.hard.includes('under-floor')).sort(byWords)
  const missingKentuckyToday = stories.filter((row) => row.hard.includes('missing-kentucky-today')).sort(byWords)
  const missingSources = stories.filter((row) => row.hard.includes('missing-sources')).sort(byWords)
  const allowlistedHard = stories.filter((row) => row.hard.length && allow.has(row.slug))
  return {
    mode: strict ? 'strict' : 'soft',
    floorWords: RICE_FLOOR_WORDS,
    depthMin: RICE_DEPTH_MIN,
    depthMax: RICE_DEPTH_MAX,
    templateSlug: RICE_TEMPLATE_SLUG,
    counts: {
      stories: stories.length,
      underFloor: underFloor.length,
      missingKentuckyToday: missingKentuckyToday.length,
      missingSources: missingSources.length,
      shortOfDepth: stories.filter((row) => row.info.includes('short-of-depth')).length,
      aboveDepthBand: stories.filter((row) => row.info.includes('above-depth-band')).length,
      noPeopleLinks: stories.filter((row) => row.info.includes('no-people-links')).length,
      noStoryLinks: stories.filter((row) => row.info.includes('no-story-links')).length,
      noPlacePhoto: stories.filter((row) => row.info.includes('no-place-photo')).length,
      allowlistedHard: allowlistedHard.length,
      blocking: stories.filter((row) => row.hard.length && !allow.has(row.slug)).length,
    },
    hard: {
      underFloor: underFloor.map(gapRow),
      missingKentuckyToday: missingKentuckyToday.map(gapRow),
      missingSources: missingSources.map(gapRow),
    },
    info: {
      shortOfDepth: stories.filter((row) => row.info.includes('short-of-depth')).sort(byWords).map(gapRow),
      aboveDepthBand: stories.filter((row) => row.info.includes('above-depth-band')).sort(byWords).map(gapRow),
      noPeopleLinks: stories.filter((row) => row.info.includes('no-people-links')).map(gapRow),
      noStoryLinks: stories.filter((row) => row.info.includes('no-story-links')).map(gapRow),
      noPlacePhoto: stories.filter((row) => row.info.includes('no-place-photo')).map(gapRow),
    },
    stories,
  }
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function slugList(title, rows) {
  const lines = [`## ${title}`, '']
  if (!rows.length) lines.push('None.', '')
  else for (const row of rows) lines.push(`- ${row.slug} (${row.words} words)`)
  if (rows.length) lines.push('')
  return lines
}

export function formatRiceBarMarkdown(report) {
  const c = report.counts
  const hardRows = report.stories
    .filter((row) => row.hard.length)
    .sort((a, b) => a.words - b.words || a.slug.localeCompare(b.slug))
  const lines = [
    '# Rice bar',
    '',
    `Soft by default. \`RICE_BAR=strict\` or \`--strict\` fails the build when a story is under ${report.floorWords} words, missing ## Kentucky today, or missing named sources, unless its slug is in \`scripts/rice-bar-allowlist.json\`. The ${report.depthMin}–${report.depthMax} word band, people links, related story links, and place photos are informational and never fail. This file is written to \`reports/\`, which is gitignored.`,
    '',
    `Mode: ${report.mode}. Template: \`${report.templateSlug}\`.`,
    '',
    '| Check | Count |',
    '| --- | --- |',
    `| Stories | ${c.stories} |`,
    `| Under ${report.floorWords} words | ${c.underFloor} |`,
    `| Missing Kentucky today | ${c.missingKentuckyToday} |`,
    `| Missing named sources | ${c.missingSources} |`,
    `| Short of ${report.depthMin} words | ${c.shortOfDepth} |`,
    `| Above ${report.depthMax} words | ${c.aboveDepthBand} |`,
    `| No people links | ${c.noPeopleLinks} |`,
    `| No related story links | ${c.noStoryLinks} |`,
    `| No place photo | ${c.noPlacePhoto} |`,
    `| Allowlisted hard gaps | ${c.allowlistedHard} |`,
    '',
    '## Under bar',
    '',
    '| Slug | Title | Words | Kentucky today | Sources | Gaps |',
    '| --- | --- | --- | --- | --- | --- |',
    ...hardRows.map(
      (row) =>
        `| ${mdCell(row.slug)} | ${mdCell(row.title)} | ${row.words} | ${row.kentuckyToday ? 'yes' : 'no'} | ${row.sources ? 'yes' : 'no'} | ${row.hard.join(', ')} |`,
    ),
    '',
    ...slugList('Short of Rice depth', report.info.shortOfDepth),
    ...slugList('Above the depth band', report.info.aboveDepthBand),
    ...slugList('No people links', report.info.noPeopleLinks),
    ...slugList('No related story links', report.info.noStoryLinks),
    ...slugList('No place photo', report.info.noPlacePhoto),
  ]
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export function formatRiceBarText(report) {
  const c = report.counts
  const lines = [
    `check-rice-bar: ${c.stories} stories; ${report.mode} (hard floor ≥${report.floorWords} words, ## Kentucky today, named sources; depth ${report.depthMin}–${report.depthMax} is informational). RICE_BAR=strict fails hard gaps not listed in scripts/rice-bar-allowlist.json.`,
    `  hard: ${c.underFloor} under ${report.floorWords} words; ${c.missingKentuckyToday} missing Kentucky today; ${c.missingSources} missing named sources; ${c.allowlistedHard} allowlisted`,
    `  info: ${c.shortOfDepth} short of ${report.depthMin} words; ${c.aboveDepthBand} above ${report.depthMax}; ${c.noPeopleLinks} no people links; ${c.noStoryLinks} no story links; ${c.noPlacePhoto} no place photo`,
    '  report: reports/rice-bar.md and reports/rice-bar.json (gitignored)',
  ]
  const section = (title, rows, withWords) => {
    lines.push(`  ${title} (${rows.length}):`)
    for (const row of rows) lines.push(withWords ? `    ${String(row.words).padStart(4)}  ${row.slug}` : `    ${row.slug}`)
  }
  section('under-floor', report.hard.underFloor, true)
  section('missing-kentucky-today', report.hard.missingKentuckyToday, false)
  section('missing-sources', report.hard.missingSources, false)
  return lines.join('\n')
}

export function writeRiceBarReport(root, report) {
  const dir = path.join(root, 'reports')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'rice-bar.json'), `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(path.join(dir, 'rice-bar.md'), formatRiceBarMarkdown(report))
}

export function runRiceBarCheck({ root, strict = false, write = true, log = console.log, err = console.error } = {}) {
  const stories = loadRiceBarStories(root).map(assessRiceBar)
  const allow = loadAllowlist(root)
  const report = buildRiceBarReport(stories, { strict, allow })
  if (write) writeRiceBarReport(root, report)
  const known = new Set(stories.map((story) => story.slug))
  for (const slug of [...allow].filter((item) => !known.has(item)).sort()) {
    err(`check-rice-bar: allowlist slug not in the corpus: ${slug}`)
  }
  log(formatRiceBarText(report))
  const status = riceBarExitCode(stories, { strict, allow })
  if (status.code !== 0) err(`check-rice-bar: ${status.reason}`)
  return status.code
}
