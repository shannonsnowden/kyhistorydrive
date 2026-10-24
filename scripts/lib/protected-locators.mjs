/**
 * Locator phrases that place a protected (looting-sensitive) site below county level (#345 Security/SEO,
 * generalised from #351's check-protected-locators). Protected stories may name the county and a site
 * number; they must not give a direction or distance from a place, "near <Town>", a named creek, river,
 * lake or fork, or a named earthworks complex. Word gaps match whitespace, "_" or "-" (Clarks_River,
 * near-lexington), so file names and URLs are caught too.
 */
const G = '[\\s_-]+'
const L = '(?<![A-Za-z0-9])'
const R = '(?![A-Za-z0-9])'
const DIR = '(?:[Nn]orth|[Ss]outh|[Ee]ast|[Ww]est)(?:east|west)?(?:ern)?'
const NAME = "[A-Z][A-Za-z’'.]*"
const rx = (src, flags = 'g') => new RegExp(src, flags)
export const LOCATOR_PATTERNS = [
  { id: 'direction-of-place', re: rx(`${L}${DIR}${G}of${G}(?:the${G})?${NAME}`) },
  { id: 'direction-of-place', re: rx(`${L}(?:north|south|east|west)(?:east|west)?[_-]of[_-][a-z]+`) },
  { id: 'distance', re: rx(`${L}\\d+(?:\\.\\d+)?[\\s_-]*(?:miles?|mi\\.?|km|kilomet(?:er|re)s?)${G}(?:${DIR}${G})?(?:of|from)${R}`, 'gi') },
  { id: 'near-town', re: rx(`${L}[Nn]ear(?:by)?${G}(?:the${G}(?:better-known${G})?|town${G}of${G}|city${G}of${G})?${NAME}`) },
  { id: 'near-town', re: rx(`${L}near[_-][a-z]{3,}`) },
  { id: 'named-water', re: rx(`${L}${NAME}(?:${G}${NAME})*${G}(?:Creek|River|Lake|Fork|Branch|Run)${R}`) },
  { id: 'named-water', re: rx(`${L}[a-z]+[_-](?:creek|river|lake|fork)${R}`) },
  { id: 'named-earthworks', re: rx(`${L}(?:${NAME}${G})+Earthworks(?:${G}Complex)?${R}|${L}Earthworks${G}Complex${R}`) },
  { id: 'named-earthworks', re: rx(`${L}[a-z]+[_-]earthworks[_-]complex${R}`) },
]

/** Extra terms for one story (from #351 Item 105), matched case-insensitively with the same word gaps. */
export const STORY_TERMS = {
  'peter-village-enclosure-15fa166': ['Lexington', 'Mount Horeb', 'Horeb', 'Earthworks Complex', 'Adena Park', 'Elkhorn', 'Grimes Village', 'creek', 'north of', 'near the'],
}

export function termRegex(term) {
  return new RegExp(`(?<![A-Za-z])${term.replace(/ /g, G)}(?![A-Za-z])`, 'gi')
}

/** Every locator hit in a block of text, as { id, match }. `owner` adds that story's own terms. */
export function findLocators(text, owner = '') {
  const hits = []
  const s = String(text || '')
  for (const { id, re } of LOCATOR_PATTERNS) {
    re.lastIndex = 0
    for (const m of s.matchAll(re)) hits.push({ id, match: m[0] })
  }
  for (const t of STORY_TERMS[owner] || []) for (const m of s.matchAll(termRegex(t))) hits.push({ id: `term:${t}`, match: m[0] })
  return hits
}
