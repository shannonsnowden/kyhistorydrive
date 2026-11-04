// Item 88 / SEO: a shallow clone must not stamp every story with the head commit (deploy) date.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gitFileDates, gitStoryTextDates, isShallowRepo, storyStoredDate, datesForStory } from './story-dates.mjs'
import { PrerenderPages } from './prerender-pages.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'khd-shallow-'))
const git = (cwd, args, env = {}) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } })
try {
  const src = path.join(tmp, 'src')
  fs.mkdirSync(path.join(src, 'public/content/stories'), { recursive: true })
  git(src, ['init', '-q'])
  const file = 'public/content/stories/x.json'
  const commit = (body, date) => {
    fs.writeFileSync(path.join(src, file), JSON.stringify({ slug: 'x', title: 'X', publishedDate: '2026-09-01', bodyMarkdown: body }))
    git(src, ['add', '.'])
    git(src, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', body], { GIT_COMMITTER_DATE: `${date}T12:00:00`, GIT_AUTHOR_DATE: `${date}T12:00:00` })
  }
  commit('first', '2026-09-02')
  fs.writeFileSync(path.join(src, 'other.txt'), 'deploy')
  git(src, ['add', '.'])
  git(src, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'deploy'], { GIT_COMMITTER_DATE: '2026-10-24T12:00:00', GIT_AUTHOR_DATE: '2026-10-24T12:00:00' })

  // Full clone: real git date for the story file.
  assert.equal(isShallowRepo(src), false)
  assert.equal(gitFileDates(src).lastmod.get(file), '2026-09-02')

  // Shallow clone (like Amplify): git would say 2026-10-24 for everything; we must ignore it.
  const shallow = path.join(tmp, 'shallow')
  git(tmp, ['clone', '-q', '--depth', '1', `file://${src}`, shallow])
  assert.equal(isShallowRepo(shallow), true)
  const d = gitFileDates(shallow)
  assert.equal(d.shallow, true)
  assert.equal(d.lastmod.size, 0)
  assert.equal(gitStoryTextDates(shallow).modified.size, 0)
  const story = { slug: 'x', publishedDate: '2026-09-01' }
  assert.equal(PrerenderPages.storyLastmod(story, d.lastmod), '2026-09-01', 'shallow → stored date, not deploy date')
  assert.deepEqual(datesForStory(story, { created: d.created }, file), { published: '2026-09-01', modified: '2026-09-01' })

  // No git date and no publishedDate: briefDate; nothing at all → '' (never today).
  assert.equal(storyStoredDate({ briefDate: '2026-08-30' }), '2026-08-30')
  assert.equal(PrerenderPages.storyLastmod({ slug: 'y' }, new Map()), '')
  // SEO #344: prerender articleDates must fall back to stored dates on a shallow clone, never today.
  assert.deepEqual(PrerenderPages.articleDates({ slug: 'z', publishedDate: '2026-09-01', created: '', gitModified: '' }), { published: '2026-09-01', modified: '2026-09-01' })
  assert.throws(() => PrerenderPages.articleDates({ slug: 'z', created: '', gitModified: '' }), /no git date/)
  // Shallow sitemap: undated URL drops <lastmod>; full history still requires it.
  const sm = path.join(tmp, 'sitemap.xml')
  fs.writeFileSync(sm, '<urlset></urlset>')
  const ents = [{ loc: 'https://kyhistorydrive.com/privacy/', lastmod: '' }]
  assert.throws(() => PrerenderPages.updateSitemap(sm, ents, 0), /missing lastmod/)
  try { PrerenderPages.updateSitemap(sm, ents, 0, { allowMissingLastmod: true }) } catch (e) { assert.doesNotMatch(String(e), /missing lastmod/) }
  console.log('test-shallow-dates: 14/14 pass (full clone uses git, shallow clone falls back to story JSON dates)')
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
