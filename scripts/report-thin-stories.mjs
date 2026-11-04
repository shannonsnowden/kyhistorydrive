// Item 88: list stories under the thin-story word floor (they carry noindex, follow).
// Writes reports/thin-stories.{md,json} (gitignored, never deployed) and prints a summary.
import fs from 'node:fs'
import path from 'node:path'
import { storyWordCount, THIN_STORY_MIN_WORDS } from './lib/thin-stories.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const dir = path.join(root, 'public/content/stories')
if (!fs.existsSync(dir)) {
  console.error('report:thin-stories: run the build (build-stories) first; public/content/stories is missing')
  process.exit(1)
}
const rows = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
  .map((s) => ({ slug: s.slug, title: s.title, words: storyWordCount(s.bodyMarkdown) }))
const thin = rows.filter((r) => r.words < THIN_STORY_MIN_WORDS).sort((a, b) => a.words - b.words || a.slug.localeCompare(b.slug))
const out = path.join(root, 'reports')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'thin-stories.json'), JSON.stringify({ minWords: THIN_STORY_MIN_WORDS, total: rows.length, thin }, null, 2) + '\n')
const md = [`# Thin stories (< ${THIN_STORY_MIN_WORDS} words): ${thin.length} of ${rows.length}`, '', '| Slug | Title | Words |', '| --- | --- | --- |', ...thin.map((r) => `| ${r.slug} | ${String(r.title).replace(/\|/g, '\\|')} | ${r.words} |`)].join('\n')
fs.writeFileSync(path.join(out, 'thin-stories.md'), md + '\n')
console.log(`report:thin-stories: ${thin.length} of ${rows.length} stories under ${THIN_STORY_MIN_WORDS} words (noindex, follow) -> reports/thin-stories.md`)
for (const r of thin) console.log(`  ${String(r.words).padStart(4)}  ${r.slug}`)
