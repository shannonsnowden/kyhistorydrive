/**
 * Real published and last-revised dates for each story file.
 * Published is the first git commit. Last revised is the latest commit that
 * changes the story's title, summary, or body. Bulk data commits and
 * whitespace-only formatting do not count. Nothing here uses today's date
 * or a story brief date.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveArticleDates } from '../src/story-tools.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function gitFileDates(cwd = root) {
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
  return { lastmod, created }
}

/** Reader-facing story text, with whitespace collapsed so a paragraph split is not a revision. */
export function storyProse(raw) {
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return ''
  }
  return [data.title, data.summary, data.bodyMarkdown]
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
  const dir = path.join(cwd, 'public/content/stories')
  for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.json'))) {
    const file = `public/content/stories/${name}`
    const dates = textRevisionForFile(cwd, file)
    if (dates.published) created.set(file, dates.published)
    if (dates.modified) modified.set(file, dates.modified)
  }
  return { created, modified }
}

export function datesForStory(story, git, file) {
  return resolveArticleDates(story, {
    published: git.created.get(file) || '',
    modified: (git.textModified && git.textModified.get(file)) || git.created.get(file) || '',
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
