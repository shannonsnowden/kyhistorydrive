/**
 * Real published and modified dates for each story file.
 * Story fields win. Otherwise the file's first and last git commit dates.
 * Nothing here uses today's date.
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

export function datesForStory(story, git, file) {
  return resolveArticleDates(story, {
    published: git.created.get(file) || '',
    modified: git.lastmod.get(file) || '',
  })
}

export function collectStoryDates(cwd = root) {
  const git = gitFileDates(cwd)
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
