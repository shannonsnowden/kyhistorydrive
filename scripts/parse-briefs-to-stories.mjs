#!/usr/bin/env node
/**
 * Split public/content/raw-briefs/*.md into public/content/stories/<slug>.json
 * then rebuild stories.json via build-stories.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RAW = path.join(ROOT, 'public/content/raw-briefs')
const STORIES = path.join(ROOT, 'public/content/stories')

fs.mkdirSync(STORIES, { recursive: true })

const EMOJI_HEADER =
  /^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}])\s+(.+)$/u

const SKIP_LINE = /^(this morning'?s kentucky history brief|kentucky history morning (brief|update)|kentucky morning brief)[:\s]/i
const DATE_LINE = /^(?:\*?kentucky history morning update[^*]*\*?\s*[—–-]?\s*)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)?[,\s]*(january|february|march|april|may|june|july|august|september|october|november|december)?\s*\d{1,2},?\s*2026\*?\s*$/i

function slugify(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function cleanUrls(text) {
  return text.replace(/https:\/\/www\.google\.com\/url\?([^)\s]+)/g, (_, qs) => {
    try {
      const params = new URLSearchParams(qs)
      const q = params.get('q')
      return q ? decodeURIComponent(q) : `https://www.google.com/url?${qs}`
    } catch {
      return `https://www.google.com/url?${qs}`
    }
  })
}

function extractYears(text) {
  const years = []
  const re = /\b((?:1[0-9]{3}|20[0-2][0-9]|[1-9]\d{2}|[3-9]\d{3})\s*(?:B\.?C\.?|BCE)?|(?:A\.?D\.?\s*)?\d{3,4})\b/gi
  // simpler: collect 3-4 digit years and BC
  const bc = [...text.matchAll(/\b(\d{1,4})\s*(?:B\.?C\.?|BCE)\b/gi)]
  for (const m of bc) years.push(-parseInt(m[1], 10))
  const adRange = [...text.matchAll(/\b(?:A\.?D\.?\s*)?(\d{3,4})\b/gi)]
  for (const m of adRange) {
    const y = parseInt(m[1], 10)
    if (y >= 100 && y <= 2026) years.push(y)
  }
  // also "800 B.C.–A.D. 700" style already handled partly
  if (!years.length) return { yearStart: null, yearEnd: null }
  years.sort((a, b) => a - b)
  return { yearStart: years[0], yearEnd: years[years.length - 1] }
}

function inferEra(title, body, yearStart, yearEnd) {
  const t = `${title} ${body}`.toLowerCase()
  if (
    /adena|archaic|mississippian|fort ancient|mound|shell midden|hopewell|woodland|devonian|paleontol|fossils?|3000|1000 bc|b\.c/.test(
      t
    ) ||
    (yearStart != null && yearStart < 1000 && yearEnd != null && yearEnd < 1600)
  ) {
    if (
      /shawnee|cherokee|chickasaw|lenape|delaware|miami|kickapoo|mascouten|yuchi|iroquois|native|odawa|erie|mosopelea|piankashaw|treaty of|hunting ground/.test(
        t
      ) &&
      yearStart != null &&
      yearStart >= 1600
    ) {
      return 'native'
    }
    if (yearStart != null && yearStart < 1600) return 'prehistoric'
    if (/mound|archaic|adena|mississippian|fort ancient|hopewell/.test(t)) return 'prehistoric'
  }
  if (
    /shawnee|cherokee|chickasaw|lenape|delaware|miami|kickapoo|mascouten|yuchi|iroquois|odawa|erie|mosopelea|piankashaw|native|hunting ground|treaty of fort|treaty of hard|treaty of camp|beaver wars/.test(
      t
    )
  ) {
    if (yearStart == null || yearStart < 1792) return 'native'
  }
  if (yearStart != null) {
    if (yearStart < 1000) return 'prehistoric'
    if (yearStart < 1600) return yearEnd != null && yearEnd > 1600 ? 'native' : 'prehistoric'
    if (yearStart < 1750) return 'native'
    if (yearStart < 1792) return 'frontier'
    if (yearStart < 1820) return 'early-commonwealth'
    return 'other'
  }
  if (/long hunter|station|boonesborough|frontier|wilderness/.test(t)) return 'frontier'
  if (/bourbon|distill|railroad|whiskey|crow|beam/.test(t)) return 'other'
  return 'other'
}

function inferTags(title, body, era) {
  const tags = new Set([era, 'kentucky'])
  const t = `${title} ${body}`.toLowerCase()
  const rules = [
    [/bourbon|whiskey|distill|sour-mash|beam|crow|hayden/, 'bourbon'],
    [/mound|adena|archaic|mississippian|fort ancient/, 'archaeology'],
    [/shawnee|cherokee|chickasaw|lenape|delaware|miami|native/, 'native-history'],
    [/treaty/, 'treaty'],
    [/station|fort |siege|militia|raid/, 'frontier-war'],
    [/county seat|charter|founding|laid off|surveyed/, 'town-founding'],
    [/cave|karst|limestone|saltpetre|saltpeter/, 'geology'],
    [/salt|lick/, 'salt'],
    [/railroad|rail/, 'transport'],
  ]
  for (const [re, tag] of rules) if (re.test(t)) tags.add(tag)
  return [...tags]
}

function isHeaderLine(line) {
  const t = line.trim()
  if (!t) return false
  if (t.startsWith('### ')) return true
  if (EMOJI_HEADER.test(t)) return true
  if (SKIP_LINE.test(t) || DATE_LINE.test(t)) return false
  if (/^https?:\/\//i.test(t) || /^source:\s*https?/i.test(t)) return false
  if (/^_stub/i.test(t) || /^_Stub/.test(t)) return false
  // Title-like: short, no period at end (or ends with year), not starting lowercase
  // Allow rank abbreviations (Capt. Col. Gen. Lt. Rev. Dr.) inside titles
  const titleCandidate = t.replace(/\b(Capt|Col|Gen|Lt|Rev|Dr|Mr|Mrs|Ms)\.\s+/g, '$1 ')
  if (t.length <= 90 && !/^[a-z]/.test(t) && !titleCandidate.includes('. ') && !/[.!?]$/.test(t) && !/^[*_]+$/.test(t)) {
    // avoid body sentences that happen to start with capital
    if (/^(In |On |After |Before |Virginia |North |South |Maryland |Pennsylvania |Born |From |At |About |When |Long |Five |West |East |That |The same|Workers|Pack |English |Between |University |People |Salt |Scotsman |Explorers |Justices |Baptist |Algonquian |Pushed |French |Welsh |Irish |Daniel|Maryland-born|North Carolina)/.test(t)) {
      // many titles also start with names - allow if short and no comma clause length
      if (t.length > 70) return false
    }
    // must look like a title: few words or contains /
    const words = t.split(/\s+/).length
    if (words <= 12 && !/[.!?]$/.test(t)) return true
  }
  return false
}

function stripEmojiTitle(line) {
  let t = line.trim()
  if (t.startsWith('### ')) t = t.slice(4).trim()
  // Strip leading emoji / pictographs / variation selectors
  t = t.replace(/^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\uFE0F\u200D])+\s*/gu, '')
  const m = t.match(EMOJI_HEADER)
  if (m) t = m[1].trim()
  return t.replace(/^\*+|\*+$/g, '').trim()
}

function splitSections(md, briefDate) {
  const text = cleanUrls(md)
  const lines = text.split(/\r?\n/)
  // drop leading # title
  let start = 0
  if (lines[0]?.startsWith('# ')) start = 1

  const sections = []
  let cur = null

  const flush = () => {
    if (!cur) return
    const body = cur.lines.join('\n').trim()
    if (!cur.title || body.length < 20) {
      cur = null
      return
    }
    sections.push({ title: cur.title, body })
    cur = null
  }

  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) {
      if (cur) cur.lines.push('')
      continue
    }
    if (SKIP_LINE.test(trimmed) || DATE_LINE.test(trimmed)) continue
    if (/^\*[^*]+\*$/.test(trimmed) && /morning update/i.test(trimmed)) continue
    if (/^_Stub|^_stub/i.test(trimmed)) continue
    if (/^Topics from/i.test(trimmed)) continue

    // standalone Source: URL lines stay in body
    if (isHeaderLine(trimmed)) {
      const hasBody = cur && cur.lines.filter((l) => l.trim()).length >= 1
      const isMarked = trimmed.startsWith('### ') || EMOJI_HEADER.test(trimmed) || /^(?:\p{Extended_Pictographic})/u.test(trimmed)
      if (hasBody) flush()
      else if (cur && !hasBody && isMarked) {
        // Replace preamble/subject title with the real emoji/### section header
        cur.title = stripEmojiTitle(trimmed)
        continue
      } else if (cur && !hasBody && !isMarked) {
        // Likely a stub body that also looks like a title — keep as body
        cur.lines.push(trimmed)
        continue
      }
      cur = { title: stripEmojiTitle(trimmed), lines: [] }
      continue
    }

    if (!cur) {
      // orphan body before first header — skip preamble
      continue
    }
    // normalize Source: lines
    if (/^source:\s*/i.test(trimmed)) {
      cur.lines.push(trimmed.replace(/^source:\s*/i, 'Source: '))
    } else if (/^https?:\/\//i.test(trimmed)) {
      cur.lines.push(`Source: ${trimmed}`)
    } else {
      cur.lines.push(trimmed)
    }
  }
  flush()
  return sections
}

function makeSummary(body) {
  const plain = body
    .replace(/^Source:.*$/gim, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= 180) return plain
  const cut = plain.slice(0, 177)
  const last = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '))
  return (last > 80 ? cut.slice(0, last + 1) : cut).trim() + '…'
}

function toStory(section, briefDate, usedSlugs) {
  let slug = slugify(section.title)
  if (!slug) slug = `story-${briefDate}`
  let base = slug
  let n = 2
  while (usedSlugs.has(slug)) {
    slug = `${base}-${n++}`
  }
  usedSlugs.add(slug)

  let bodyMarkdown = section.body.trim()
  // Ensure sources are markdown links when bare
  bodyMarkdown = bodyMarkdown.replace(
    /^Source:\s*(https?:\/\/\S+)\s*$/gim,
    (_, url) => `Source: [${url}](${url})`
  )

  const { yearStart, yearEnd } = extractYears(`${section.title}\n${section.body}`)
  const era = inferEra(section.title, section.body, yearStart, yearEnd)
  const tags = inferTags(section.title, section.body, era)

  return {
    slug,
    title: section.title,
    publishedDate: briefDate,
    summary: makeSummary(section.body),
    bodyMarkdown,
    yearStart,
    yearEnd,
    era,
    tags,
    source: 'ky-history',
    briefDate,
  }
}

// Clear existing generated stories
for (const f of fs.readdirSync(STORIES)) {
  if (f.endsWith('.json')) fs.unlinkSync(path.join(STORIES, f))
}

const usedSlugs = new Set()
const files = fs.readdirSync(RAW).filter((f) => f.endsWith('.md')).sort()
let total = 0
const byDate = {}

for (const file of files) {
  const briefDate = file.replace(/\.md$/, '')
  const md = fs.readFileSync(path.join(RAW, file), 'utf8')
  const sections = splitSections(md, briefDate)
  byDate[briefDate] = sections.length
  for (const sec of sections) {
    const story = toStory(sec, briefDate, usedSlugs)
    fs.writeFileSync(path.join(STORIES, `${story.slug}.json`), JSON.stringify(story, null, 2) + '\n')
    total++
  }
}

console.log('Parsed stories:', total)
console.log(JSON.stringify(byDate, null, 2))
execSync('node scripts/build-stories.mjs', { cwd: ROOT, stdio: 'inherit' })
