#!/usr/bin/env node
/**
 * #348 (SEO): generated data files must differ from the origin/v2 merge base only in the
 * records allowlisted for this PR (scripts/generated-diff-allowlist.json). Rebuild noise
 * (seoTitles, key order, proseChars, bumped dates in other stories) fails.
 * Checks the committed HEAD by default; --worktree checks the working tree; --fix rewrites
 * the working tree to base + allowlisted records. When origin/v2 (or GENERATED_DIFF_BASE) is missing it
 * skips on a local box but fails closed in CI (see missingBaseAction).
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { diffJson, mergeAllowed, formatLike, makeAllow, missingBaseAction } from './lib/generated-diff.mjs'

export const GENERATED = [
  'public/content/stories.json', 'public/content/story-dates.json', 'public/content/story-photos.json',
  'public/content/photos/responsive.json', 'public/content/stories-locations.json', 'public/data/app/ky-history.json',
  'public/data/layers/history.geojson', 'public/data/layers/stories.geojson', 'public/data/search-index.json',
]
const STORY_DIR = 'public/content/stories/'
const BASE_REF = process.env.GENERATED_DIFF_BASE || 'origin/v2'

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] })
const tryGit = (...a) => { try { return git(...a) } catch { return null } }

const args = process.argv.slice(2)
const worktree = args.includes('--worktree') || args.includes('--fix')
const fix = args.includes('--fix')

const base = tryGit('merge-base', BASE_REF, 'HEAD')?.trim()
if (!base) {
  if (missingBaseAction(process.env, BASE_REF) === 'fail') {
    console.error(`check-generated-diff: FAIL — ${BASE_REF} is not available in this CI clone; fetch it or set GENERATED_DIFF_BASE (fails closed in CI)`)
    process.exit(1)
  }
  console.log(`check-generated-diff: skipped (${BASE_REF} not available in this clone; local run)`)
  process.exit(0)
}
const { patterns, storyFiles = [] } = JSON.parse(fs.readFileSync(new URL('./generated-diff-allowlist.json', import.meta.url), 'utf8'))
const allow = makeAllow(patterns)
const read = (f) => worktree ? (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null) : tryGit('show', `HEAD:${f}`)

const changedStories = (tryGit('diff', '--name-only', base, ...(worktree ? [] : ['HEAD']), '--', STORY_DIR) || '').split('\n').filter((f) => f.endsWith('.json'))
const problems = []
for (const f of [...GENERATED, ...changedStories]) {
  const bt = tryGit('show', `${base}:${f}`)
  const ht = read(f)
  if (bt == null && ht == null) continue
  const name = f.startsWith(STORY_DIR) ? f.slice(STORY_DIR.length) : null
  if (name && (allow(name) || storyFiles.includes(name))) continue
  if (bt == null || ht == null) { problems.push(`${f}: ${bt == null ? 'added' : 'deleted'}`); continue }
  if (bt === ht) continue
  const b = JSON.parse(bt), h = JSON.parse(ht)
  const p = name ? (bt === ht ? [] : ['whole file changed']) : diffJson(b, h, allow)
  if (!p.length) continue
  if (fix) {
    const merged = name ? bt : formatLike(bt, mergeAllowed(b, h, allow))
    fs.writeFileSync(f, merged)
    console.log(`check-generated-diff: restored non-allowlisted hunks in ${f}`)
  } else problems.push(...p.slice(0, 20).map((x) => `${f} ${x}`), ...(p.length > 20 ? [`${f}: …${p.length - 20} more`] : []))
}
if (problems.length) {
  console.error(`check-generated-diff: generated files differ from ${BASE_REF} (merge base ${base.slice(0, 8)}) outside the allowlist [${patterns.join(', ')}]:\n  ${problems.join('\n  ')}\nRun: node scripts/check-generated-diff.mjs --fix`)
  process.exit(1)
}
console.log(`check-generated-diff: ${fix ? 'fixed' : 'ok'}; generated files differ from ${BASE_REF} only in [${patterns.join(', ')}]`)
