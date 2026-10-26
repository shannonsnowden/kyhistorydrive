/**
 * Real published and last-revised dates for each story file.
 * Published is the first git commit. Last revised is the latest commit that
 * changes the story's title or body. Summary-only edits (meta and card copy),
 * bulk data commits, and whitespace-only formatting do not count. Nothing here uses today's date
 * or a story brief date.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveArticleDates } from '../src/story-tools.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * #355 renamed these six slugs. `git log` without --follow treats the rename commit
 * (2026-10-24) as the first publish, so a full-clone rebuild restamps both fields.
 * Following the old path still finds same-day prose edits, and origin/v2 pins published
 * (and, until a real prose revision, modified) to the publication day below.
 * SEO rejected 2026-10-24 as false freshness. Keyed rebuilds must keep these pins.
 * Item 88 next-7 revised Indian Knoll, Rowlandton, and Singer-Hieronymus, so those
 * modified dates are 2026-10-26. Dates are checked against this pin table.
 */
export const STORY_DATE_PINS = {
  'public/content/stories/howard-site-late-fort-ancient.json': { published: '2026-09-09', modified: '2026-09-09' },
  'public/content/stories/indian-knoll-ohio-county.json': { published: '2026-08-29', modified: '2026-10-26' },
  'public/content/stories/rowlandton-mound-site-15mcn3.json': { published: '2026-10-05', modified: '2026-10-26' },
  'public/content/stories/singer-hieronymus-fort-ancient-villages.json': { published: '2026-09-29', modified: '2026-10-26' },
  'public/content/stories/the-c-and-o-mounds-johnson-county.json': { published: '2026-10-19', modified: '2026-10-19' },
  'public/content/stories/tolu-site-mississippian-mounds.json': { published: '2026-09-23', modified: '2026-09-23' },
}

function applyStoryDatePins(cwd, created, modified) {
  for (const [file, pin] of Object.entries(STORY_DATE_PINS)) {
    if (!fs.existsSync(path.join(cwd, file))) continue
    if (created) created.set(file, pin.published)
    if (modified) modified.set(file, pin.modified)
  }
}

/**
 * Item 88 / SEO: a shallow clone (Amplify's default) gives every file the head commit's date, which
 * would stamp every story's lastmod with the deploy day. Detect it so callers fall back to the
 * story JSON's stored date instead (never today).
 */
export function isShallowRepo(cwd = root) {
  try {
    return execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd, encoding: 'utf8' }).trim() === 'true'
  } catch {
    return false
  }
}

const warned = new Set()
function warnShallow(cwd) {
  if (warned.has(cwd)) return
  warned.add(cwd)
  console.warn('story-dates: WARNING shallow git clone; git dates ignored, using story JSON dates (run `git fetch --unshallow`)')
}

/** The story's own stored date (publishedDate, else briefDate), YYYY-MM-DD or ''. Never today. */
export function storyStoredDate(story) {
  for (const v of [story?.publishedDate, story?.briefDate]) {
    const d = String(v || '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  }
  return ''
}

export function gitFileDates(cwd = root) {
  if (isShallowRepo(cwd)) {
    warnShallow(cwd)
    const lastmod = new Map()
    const created = new Map()
    applyStoryDatePins(cwd, created, lastmod)
    return { lastmod, created, shallow: true }
  }
  const lastmod = new Map()
  const created = new Map()
  const out = execFileSync('git', ['log', '--name-only', '--pretty=format:%cs'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  let date = ''
  for (const line of out.split('\n')) {
    if (!line) continue
    if (/^\d{4}-\d{2}-\d{2}$/.test(line)) {
      date = line
      continue
    }
    if (!date) continue
    if (!lastmod.has(line)) lastmod.set(line, date)
    created.set(line, date)
  }
  applyStoryDatePins(cwd, created, lastmod)
  return { lastmod, created }
}

/**
 * Reader-facing story text, with whitespace collapsed so a paragraph split is not a revision.
 * The summary is left out: it is meta and card copy, so a summary-only edit does not change Last revised.
 */
export function storyProse(raw) {
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return ''
  }
  return [data.title, data.bodyMarkdown, data.figure?.note]
    .map((part) => String(part ?? '').replace(/\s+/g, ' ').trim())
    .join('\n')
}

/**
 * Newest-first history of { date, prose }.
 * modified is the newest commit whose prose differs from the one before it.
 * When the words never change, modified is the oldest commit.
 */
export function modifiedFromProseHistory(entries) {
  let published = ''
  let modified = ''
  let newerProse = null
  let newerDate = ''
  for (const entry of entries) {
    published = entry.date
    if (newerProse === null) {
      newerProse = entry.prose
      newerDate = entry.date
      continue
    }
    if (!modified && entry.prose !== newerProse) modified = newerDate
    newerProse = entry.prose
    newerDate = entry.date
  }
  return { published, modified: modified || published }
}

export function textRevisionForFile(cwd, file) {
  const out = execFileSync('git', ['log', '--pretty=format:%H %cs', '--', file], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
  const commits = []
  for (const line of out.split('\n')) {
    const match = /^([0-9a-f]{7,40}) (\d{4}-\d{2}-\d{2})$/.exec(line)
    if (match) commits.push({ hash: match[1], date: match[2] })
  }
  const published = commits.length ? commits[commits.length - 1].date : ''
  let currentProse = null
  let modified = ''
  for (let i = 0; i < commits.length; i++) {
    let raw = ''
    try {
      raw = execFileSync('git', ['show', `${commits[i].hash}:${file}`], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      })
    } catch {
      continue
    }
    const prose = storyProse(raw)
    if (currentProse === null) {
      currentProse = prose
      continue
    }
    if (prose !== currentProse) {
      modified = commits[i - 1].date
      break
    }
    currentProse = prose
  }
  return { published, modified: modified || published }
}

export function gitStoryTextDates(cwd = root) {
  const modified = new Map()
  const created = new Map()
  if (isShallowRepo(cwd)) {
    warnShallow(cwd)
    applyStoryDatePins(cwd, created, modified)
    return { created, modified, shallow: true }
  }
  const dir = path.join(cwd, 'public/content/stories')
  for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.json'))) {
    const file = `public/content/stories/${name}`
    const dates = textRevisionForFile(cwd, file)
    if (dates.published) created.set(file, dates.published)
    if (dates.modified) modified.set(file, dates.modified)
  }
  applyStoryDatePins(cwd, created, modified)
  return { created, modified }
}

export function datesForStory(story, git, file) {
  const pin = STORY_DATE_PINS[file]
  return resolveArticleDates(story, {
    published: pin?.published || git.created.get(file) || storyStoredDate(story),
    modified: pin?.modified || (git.textModified && git.textModified.get(file)) || git.created.get(file) || storyStoredDate(story),
  })
}

export function collectStoryDates(cwd = root) {
  const git = gitFileDates(cwd)
  git.textModified = gitStoryTextDates(cwd).modified
  const dir = path.join(cwd, 'public/content/stories')
  const dates = {}
  const missing = []
  for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.json'))) {
    const story = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))
    const slug = story.slug || name.replace(/\.json$/, '')
    const file = `public/content/stories/${name}`
    const row = datesForStory(story, git, file)
    if (!row.published || !row.modified) missing.push(slug)
    dates[slug] = row
  }
  if (missing.length) {
    throw new Error(`story dates: no real published/modified date for ${missing.slice(0, 8).join(', ')}`)
  }
  return dates
}

function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
}

if (isMain()) {
  const dates = collectStoryDates(root)
  const out = path.join(root, 'public/content/story-dates.json')
  const slugs = Object.keys(dates).sort()
  const ordered = {}
  for (const slug of slugs) ordered[slug] = dates[slug]
  fs.writeFileSync(out, `${JSON.stringify(ordered, null, 2)}\n`)
  console.log(`story dates: ${slugs.length} stories -> ${path.relative(root, out)}`)
}
