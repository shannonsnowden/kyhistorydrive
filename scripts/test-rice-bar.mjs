#!/usr/bin/env node
/**
 * Approvals 112 A1: Rice-bar checker.
 * Hard gaps are under 150 words, missing ## Kentucky today, and missing named sources.
 * Depth outside 350–450, people links, story links, and place photos are informational.
 * The build stays soft unless RICE_BAR=strict (allowlist exempts known hard gaps).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  RICE_DEPTH_MAX,
  RICE_DEPTH_MIN,
  RICE_FLOOR_WORDS,
  RICE_TEMPLATE_SLUG,
  allowlistFromJson,
  assessRiceBar,
  loadAllowlist,
  loadRiceBarStories,
  pickStoryPhoto,
  riceBarExitCode,
  riceBarStrict,
  runRiceBarCheck,
} from './lib/rice-bar.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

assert.equal(RICE_FLOOR_WORDS, 150)
assert.equal(RICE_DEPTH_MIN, 350)
assert.equal(RICE_DEPTH_MAX, 450)
assert.equal(RICE_TEMPLATE_SLUG, 'father-david-rice-and-kentuckys-first-presbyterian-churches')

const bare = (n, extra = '') => assessRiceBar({ slug: 'sample-story', title: 'Sample', bodyMarkdown: words(n) + extra })

assert.equal(bare(149).words, 149)
assert.equal(bare(149).depth, 'under-floor')
assert.ok(bare(149).hard.includes('under-floor'))
assert.ok(!bare(149).info.includes('short-of-depth'), 'under the floor is not also listed as short of depth')
assert.equal(bare(150).words, 150)
assert.equal(bare(150).depth, 'short')
assert.ok(!bare(150).hard.includes('under-floor'))
assert.ok(bare(150).info.includes('short-of-depth'))
assert.equal(bare(349).depth, 'short')
assert.equal(bare(350).depth, 'band')
assert.ok(!bare(350).info.includes('short-of-depth'))
assert.equal(bare(450).depth, 'band')
assert.ok(!bare(450).info.includes('above-depth-band'))
assert.equal(bare(451).depth, 'above')
assert.ok(bare(451).info.includes('above-depth-band'))

const sourceChrome = `\n\n## Sources\n\n- [Grokipedia: Example](https://grokipedia.com/page/Example) ${words(40)}`
assert.equal(bare(149, sourceChrome).words, 149, 'a Sources section does not count toward the floor')
assert.equal(bare(149, sourceChrome).sources, true)
assert.equal(bare(149, '\nSource: [KHS marker](https://history.ky.gov/markers/x)\n').words, 149, 'Source: lines do not count')
assert.equal(bare(149, '\nSource: [KHS marker](https://history.ky.gov/markers/x)\n').sources, true)
assert.equal(bare(160, '\nSource: https://grokipedia.com/page/Example\n').sources, false, 'a bare URL is not a named source')
assert.equal(
  bare(160, '\nSource: Rock Art of Kentucky (University Press of Kentucky, 1997)\n').sources,
  true,
  'a named book citation counts without a URL',
)

const todayOnly = bare(160, '\n\n## Kentucky today\n\nVisitors can see the marker.\n')
assert.equal(todayOnly.kentuckyToday, true)
assert.equal(todayOnly.words, 165)
assert.equal(bare(160, '\n\n## KENTUCKY TODAY\n\nVisitors can see the square.\n').kentuckyToday, true)
assert.equal(
  bare(160, '\n\n## Kentucky today\n\nSource: [KHS marker](https://history.ky.gov/markers/x)\n').kentuckyToday,
  false,
  'a today heading whose only lines are sources is not visitor prose',
)

const linked = assessRiceBar({
  slug: 'sample-story',
  title: 'Sample',
  bodyMarkdown: [
    words(400),
    '',
    '[David Rice](/people/#david-rice) preached near [Danville](/stories/danville-and-constitution-square/).',
    'Again [David Rice](/people/#david-rice) and [this page](/stories/sample-story/).',
    '![a church](/stories/not-a-link/)',
    '',
    '## Kentucky today',
    '',
    'Visitors can see the marker on Main Street.',
    'Source: [KHS marker #844](https://history.ky.gov/markers/home-of-early-minister)',
  ].join('\n'),
  photo: { image_url: '/content/photos/stories/sample-story.jpg' },
})
assert.ok(linked.words >= 350 && linked.words <= 450, `pass fixture should sit in the depth band, got ${linked.words}`)
assert.deepEqual(linked.hard, [])
assert.deepEqual(linked.info, [])
assert.deepEqual(linked.peopleLinks, ['david-rice'])
assert.deepEqual(linked.storyLinks, ['danville-and-constitution-square'])
assert.equal(linked.placePhoto, true)
assert.equal(linked.kentuckyToday, true)
assert.equal(linked.sources, true)

assert.equal(assessRiceBar({ slug: 's', title: 'T', bodyMarkdown: words(400), photo: { image_url: '/people/portraits/david-rice__ai-portrait-v1.jpg' } }).placePhoto, false)
assert.equal(assessRiceBar({ slug: 's', title: 'T', bodyMarkdown: words(400), photo: { image_url: '/figures/culture.jpg' } }).placePhoto, false)
assert.equal(assessRiceBar({ slug: 's', title: 'T', bodyMarkdown: words(400), photo: { image_url: '/../secret.jpg' } }).placePhoto, false)
assert.equal(assessRiceBar({ slug: 's', title: 'T', bodyMarkdown: words(400) }).placePhoto, false)
assert.ok(assessRiceBar({ slug: 's', title: 'T', bodyMarkdown: words(400) }).info.includes('no-people-links'))
assert.ok(assessRiceBar({ slug: 's', title: 'T', bodyMarkdown: words(400) }).info.includes('no-story-links'))
assert.ok(assessRiceBar({ slug: 's', title: 'T', bodyMarkdown: words(400) }).info.includes('no-place-photo'))

assert.equal(
  pickStoryPhoto(
    { slug: 'a', photo: { image_url: '/content/photos/stories/a.jpg' } },
    { photo: { image_url: '/index.jpg' } },
    { bySlug: { a: { photo: { image_url: '/side.jpg' } } } },
  ).image_url,
  '/content/photos/stories/a.jpg',
)
assert.equal(
  pickStoryPhoto(
    { slug: 'a', photo: { image_url: '/../secret.jpg' } },
    { photo: { image_url: '/index.jpg' } },
    { bySlug: { a: { photo: { image_url: '/content/photos/stories/a.jpg' } } } },
  ).image_url,
  '/content/photos/stories/a.jpg',
)
assert.equal(pickStoryPhoto({ slug: 'a' }, {}, {}), null)

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rice-bar-'))
fs.mkdirSync(path.join(tmp, 'public/content/stories'), { recursive: true })
fs.writeFileSync(path.join(tmp, 'public/content/stories.json'), JSON.stringify({ stories: [{ slug: 'missing-file', title: 'Missing' }] }))
assert.throws(() => loadRiceBarStories(tmp), /missing-file/)
fs.writeFileSync(
  path.join(tmp, 'public/content/stories.json'),
  JSON.stringify({ stories: [{ slug: 'kept-story', title: 'Index title', photo: { image_url: '/index.jpg' } }] }),
)
fs.writeFileSync(
  path.join(tmp, 'public/content/stories/kept-story.json'),
  JSON.stringify({ slug: 'other', title: 'Body', bodyMarkdown: 'Hello' }),
)
assert.throws(() => loadRiceBarStories(tmp), /kept-story/)

const template = assessRiceBar(loadRiceBarStories(root).find((story) => story.slug === RICE_TEMPLATE_SLUG))
assert.equal(template.words, 414)
assert.equal(template.depth, 'band')
assert.deepEqual(template.hard, [])
assert.equal(template.kentuckyToday, true)
assert.equal(template.sources, true)
assert.ok(template.peopleLinks.includes('david-rice'))
assert.ok(template.storyLinks.includes('danville-and-constitution-square'))
assert.equal(template.placePhoto, true)

const gap = { slug: 'gap-story', hard: ['under-floor'], info: [] }
const templateOk = { slug: RICE_TEMPLATE_SLUG, hard: [], info: [] }
const infoOnly = { slug: 'info-story', hard: [], info: ['no-place-photo'] }
assert.equal(riceBarExitCode([templateOk, gap], { strict: false, allow: new Set() }).code, 0)
assert.equal(riceBarExitCode([templateOk, gap], { strict: true, allow: new Set(['gap-story']) }).code, 0)
assert.equal(riceBarExitCode([templateOk, gap], { strict: true, allow: new Set() }).code, 1)
assert.equal(riceBarExitCode([templateOk, infoOnly], { strict: true, allow: new Set() }).code, 0)
assert.equal(riceBarExitCode([{ slug: RICE_TEMPLATE_SLUG, hard: ['missing-sources'] }], { strict: false, allow: new Set([RICE_TEMPLATE_SLUG]) }).code, 1)
assert.equal(riceBarExitCode([gap], { strict: false, allow: new Set() }).code, 1)

assert.equal(riceBarStrict({}, []), false)
assert.equal(riceBarStrict({ RICE_BAR: 'warn' }, []), false)
assert.equal(riceBarStrict({ RICE_BAR: 'strict' }, []), true)
assert.equal(riceBarStrict({ RICE_BAR: 'warn' }, ['--strict']), true)
assert.equal(riceBarStrict({}, ['--warn']), false)
assert.throws(() => riceBarStrict({ RICE_BAR: 'yes' }, []), /RICE_BAR/)
assert.throws(() => riceBarStrict({}, ['--strict', '--warn']), /only one/)

assert.equal(allowlistFromJson({ slugs: [] }).size, 0)
assert.equal(allowlistFromJson({ slugs: ['gap-story', 'gap-story'] }).size, 1)
assert.throws(() => allowlistFromJson({}), /slugs/)
assert.throws(() => allowlistFromJson({ slugs: ['Bad Slug'] }), /bad slug/)
assert.equal(loadAllowlist(root).size, 0)
assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^\/reports\/$/m)

const build = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts.build.split(' && ')
const testAt = build.indexOf('node scripts/test-rice-bar.mjs')
const checkAt = build.indexOf('node scripts/check-rice-bar.mjs')
assert.ok(testAt >= 0 && checkAt === testAt + 1, 'test-rice-bar runs immediately before check-rice-bar')
assert.ok(testAt > build.indexOf('node scripts/test-thin-stories.mjs'))
assert.equal(build.at(-1), 'node scripts/check-protected-coords.mjs')

const quiet = runRiceBarCheck({
  root,
  strict: false,
  write: true,
  log: () => {},
  err: () => {},
})
assert.equal(quiet, 0)
const report = JSON.parse(fs.readFileSync(path.join(root, 'reports/rice-bar.json'), 'utf8'))
const md = fs.readFileSync(path.join(root, 'reports/rice-bar.md'), 'utf8')
assert.equal(report.mode, 'soft')
assert.equal(report.stories.find((story) => story.slug === RICE_TEMPLATE_SLUG).words, 414)
assert.ok(report.counts.underFloor + report.counts.missingKentuckyToday + report.counts.missingSources > 0)
assert.match(md, /RICE_BAR=strict/)
assert.match(md, /Kentucky today/)
if (report.hard.missingSources[0]) assert.match(md, new RegExp(report.hard.missingSources[0].slug))

const live = spawnSync(process.execPath, ['scripts/check-rice-bar.mjs'], { cwd: root, encoding: 'utf8' })
assert.equal(live.status, 0, live.stderr)
assert.match(live.stdout, /check-rice-bar:/)
assert.match(live.stdout, /soft/)
assert.match(live.stdout, /missing-sources/)
if (report.hard.underFloor[0]) assert.match(live.stdout, new RegExp(report.hard.underFloor[0].slug))

console.log(
  `test-rice-bar: ok (${report.counts.stories} stories; ${report.counts.underFloor} under ${RICE_FLOOR_WORDS}; ${report.counts.missingKentuckyToday} missing Kentucky today; ${report.counts.missingSources} missing named sources)`,
)
