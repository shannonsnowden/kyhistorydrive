#!/usr/bin/env node
/**
 * Every story meta description uses whole sentences up to 160 characters.
 * A description may end without sentence punctuation only when the first
 * sentence itself is longer than 160 and was cut on a word.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrerenderPages } from './prerender-pages.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const stories = PrerenderPages.loadStories(root)
const problems = []

const abbrevSample =
  'He met Col. Boone and Gen. Scott c. AD 1750, with Capt. Bird, Lt. Col. Todd, near St. Asaph and Mt. Sterling, where Dr. Walker and Rev. Metcalf joined Baker Jr. and Baker Sr. at camp. Then he left.'
const abbrevSentences = PrerenderPages.splitSentences(abbrevSample)
if (abbrevSentences.length !== 2 || /\b(?:Col|Gen|Capt|Lt|St|Mt|Dr|Jr|Sr|Rev|c)\.$/.test(abbrevSentences[0])) {
  problems.push('check-story-descriptions: sentence splitter still stops on Col., Gen., c., Capt., Lt., St., Mt., Dr., Jr., Sr., or Rev.')
}

for (const story of stories) {
  const urlPath = `/stories/${story.slug}/`
  const source = PrerenderPages.storyDescriptionSource(story)
  const description = PrerenderPages.storyMetaDescription(source)
  try {
    PrerenderPages.assertStoryMeta(description, source, urlPath)
  } catch (err) {
    problems.push(err.message)
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

if (problems.length) {
  console.error(problems.slice(0, 30).join('\n'))
  console.error(`check-story-descriptions: ${problems.length} problem(s)`)
  process.exit(1)
}

console.log(
  `check-story-descriptions: ${stories.length} story meta descriptions end on a sentence, or on a word when the first sentence is over 160 characters`,
)
