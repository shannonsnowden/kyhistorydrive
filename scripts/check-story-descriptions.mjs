#!/usr/bin/env node
/**
 * Every story meta description is at most 155 characters, follows the prerender rule,
 * and matches the built page. Unfinished metas (no ending punctuation, an ellipsis, or
 * over 155 characters) are listed, and so are metas that don't name the story's subject and a
 * place (title and place fields). Counts show how many use the summary vs the body. Warn-only for now: KY History is rewriting the cut-off
 * summaries. Set META_CHECK=strict (or pass --strict) to fail the build on any unfinished meta.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrerenderPages } from './prerender-pages.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const stories = PrerenderPages.loadStories(root)
const problems = []
const unfinished = []
const missing = []
const kinds = { summary: 0, body: 0 }
const strict = process.env.META_CHECK === 'strict' || process.argv.includes('--strict')

const abbrevSample =
  'He met Col. Boone and Gen. Scott c. AD 1750, with Capt. Bird, Lt. Col. Todd, near St. Asaph and Mt. Sterling, where Dr. Walker and Rev. Metcalf joined Baker Jr. and Baker Sr. at camp. Then he left.'
const abbrevSentences = PrerenderPages.splitSentences(abbrevSample)
if (abbrevSentences.length !== 2 || /\b(?:Col|Gen|Capt|Lt|St|Mt|Dr|Jr|Sr|Rev|c)\.$/.test(abbrevSentences[0])) {
  problems.push('check-story-descriptions: sentence splitter still stops on Col., Gen., c., Capt., Lt., St., Mt., Dr., Jr., Sr., or Rev.')
}

for (const story of stories) {
  const urlPath = `/stories/${story.slug}/`
  const choice = PrerenderPages.storyDescriptionChoice(story)
  const description = PrerenderPages.storyDescription(story)
  try {
    PrerenderPages.assertStoryMeta(description, choice.source, urlPath, PrerenderPages.META_MAX, choice.opts)
  } catch (err) {
    problems.push(err.message)
  }
  if (!PrerenderPages.isFinishedMeta(description)) unfinished.push(`${urlPath} (${description.length}): ${description}`)
  kinds[choice.kind] = (kinds[choice.kind] || 0) + 1
  const sp = PrerenderPages.metaSubjectPlace(story, description)
  if (!sp.subject || !sp.place) {
    missing.push(`${urlPath} [missing ${[!sp.subject && 'subject', !sp.place && 'place'].filter(Boolean).join('+')}]: ${description}`)
  }
  if (choice.kind === 'summary' && !story.metaSource && PrerenderPages.summaryQualifies(story) && (!sp.subject || !sp.place)) {
    problems.push(`check-story-descriptions: ${urlPath} summary meta does not name subject and place`)
  }
  const file = path.join(dist, urlPath, 'index.html')
  if (!fs.existsSync(file)) {
    problems.push(`check-story-descriptions: missing ${urlPath}`)
    continue
  }
  const html = fs.readFileSync(file, 'utf8')
  const marker = `name="description" content="${PrerenderPages.escapeHtml(description)}"`
  if (!html.includes(marker)) {
    problems.push(`check-story-descriptions: ${urlPath} prerendered meta description does not match`)
  }
}

// Self-test: the cut rule never ends mid-number or adds an ellipsis.
const adams = PrerenderPages.storyMetaDescription(
  'Near Hickman in Fulton County, on Bayou de Chien, a creek that drains into the nearby Mississippi, the Adams Site (15Fu4) is a Mississippian town of about 7.25 hectares built over an earlier Late Woodland village.',
)
if (/7\.25$|\d$/.test(adams) || adams.length > 155 || /\u2026|\.\.\.$/.test(adams)) {
  problems.push(`check-story-descriptions: clause cut self-test failed: ${adams}`)
}

if (unfinished.length) {
  const say = strict ? console.error : console.warn
  say(`check-story-descriptions: ${unfinished.length} unfinished meta description(s)${strict ? '' : ' (warn-only; META_CHECK=strict fails the build)'}:`)
  for (const line of unfinished) say(`  ${line}`)
  if (strict) problems.push(`check-story-descriptions: ${unfinished.length} unfinished meta description(s)`)
}
if (missing.length) {
  const say = strict ? console.error : console.warn
  say(`check-story-descriptions: ${missing.length} meta description(s) missing subject or place${strict ? '' : ' (warn-only)'}:`)
  for (const line of missing) say(`  ${line}`)
  if (strict) problems.push(`check-story-descriptions: ${missing.length} meta description(s) missing subject or place`)
}

if (problems.length) {
  console.error(problems.slice(0, 30).join('\n'))
  console.error(`check-story-descriptions: ${problems.length} problem(s)`)
  process.exit(1)
}

console.log(
  `check-story-descriptions: ${stories.length} story meta descriptions at most 155 characters; ${kinds.summary} from summary, ${kinds.body} from body; ${stories.length - unfinished.length} finished, ${unfinished.length} unfinished, ${missing.length} missing subject/place (${strict ? 'strict' : 'warn-only'})`,
)
