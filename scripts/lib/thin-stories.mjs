/**
 * Item 88: temporary noindex for thin stories. A story page whose narrative is under
 * THIN_STORY_MIN_WORDS words gets `noindex, follow` and stays out of sitemap.xml. Computed
 * from bodyMarkdown at build time, so it lifts by itself once the story text grows.
 */
// Shannon's call (Oct 24, 2026): 100 for now. Goes back to 150 once KY History's expansions catch up.
export const THIN_STORY_MIN_WORDS = 100

const SKIP_SECTIONS = /^(sources?|references|people involved|further reading|see also|photos?|captions?)$/i

/**
 * Linear-time inline markup strip (Security Watch: no regex backtracking on long runs of `[`, `![`, `<`).
 * Images -> space, [text](url) -> text, <tag> -> space. Next-delimiter positions are cached, so the
 * whole scan is O(n) even when delimiters never close.
 */
export function stripInline(s) {
  s = String(s || '')
  const next = new Map()
  const find = (ch, from) => {
    const c = next.get(ch)
    if (c !== undefined && (c === -1 || c >= from)) return c
    const r = s.indexOf(ch, from)
    next.set(ch, r)
    return r
  }
  const out = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '<') {
      const j = find('>', i + 1)
      if (j > i + 1) {
        out.push(' ')
        i = j + 1
        continue
      }
    } else if (c === '[' || (c === '!' && s[i + 1] === '[')) {
      const img = c === '!'
      const open = img ? i + 1 : i
      const j = find(']', open + 1)
      if (j !== -1 && s[j + 1] === '(') {
        const k = find(')', j + 2)
        if (k !== -1) {
          out.push(img ? ' ' : ` ${s.slice(open + 1, j)} `)
          i = k + 1
          continue
        }
      }
    }
    out.push(c)
    i++
  }
  return out.join('')
}

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
    if (line.startsWith('![') && !stripInline(line).trim()) continue // image line
    if (/^(\*|_)?(photo|image|caption|credit)\s*:/i.test(line)) continue
    kept.push(line)
  }
  const text = stripInline(kept.join(' ')).replace(/[#*_>`|]/g, ' ')
  const words = text.match(/[\p{L}\p{N}]+(?:['’.\-–][\p{L}\p{N}]+)*/gu)
  return words ? words.length : 0
}

export function isThinStory(story) {
  return storyWordCount(story?.bodyMarkdown) < THIN_STORY_MIN_WORDS
}
