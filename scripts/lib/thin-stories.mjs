/**
 * Item 88: temporary noindex for thin stories. A story page whose narrative is under
 * THIN_STORY_MIN_WORDS words gets `noindex, follow` and stays out of sitemap.xml. Computed
 * from bodyMarkdown at build time, so it lifts by itself once the story text grows.
 */
export const THIN_STORY_MIN_WORDS = 150

const SKIP_SECTIONS = /^(sources?|references|people involved|further reading|see also|photos?|captions?)$/i

export function storyWordCount(markdown) {
  let skipping = false
  const kept = []
  for (const raw of String(markdown || '').split(/\r?\n/)) {
    const line = raw.trim()
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      skipping = SKIP_SECTIONS.test(heading[1].replace(/[*_`]/g, '').trim())
      continue
    }
    if (skipping || !line) continue
    if (/^source:/i.test(line)) continue
    if (/^!\[[^\]]*\]\([^)]*\)\s*$/.test(line)) continue // image line
    if (/^(\*|_)?(photo|image|caption|credit)\s*:/i.test(line)) continue
    kept.push(line)
  }
  const text = kept
    .join(' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_>`|]/g, ' ')
  const words = text.match(/[\p{L}\p{N}]+(?:['’.\-–][\p{L}\p{N}]+)*/gu)
  return words ? words.length : 0
}

export function isThinStory(story) {
  return storyWordCount(story?.bodyMarkdown) < THIN_STORY_MIN_WORDS
}
