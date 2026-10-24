/**
 * Locator phrases that place a protected (looting-sensitive) site below county level (#345 Security).
 * Protected stories may name the county and a site number; they must not give a direction or distance
 * from a town, "near <Town>", a named creek/river/lake/fork, or the named earthworks complex they sit in.
 */
const DIR = '(?:[Nn]orth|[Ss]outh|[Ee]ast|[Ww]est)(?:east|west)?(?:ern)?'
export const LOCATOR_PATTERNS = [
  { id: 'direction-of-place', re: new RegExp(`\\b${DIR}\\s+of\\s+[A-Z][\\w’'.-]+`, 'g') },
  { id: 'distance', re: new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*(?:miles?|mi\\.?|km|kilomet(?:er|re)s?)\\s+(?:${DIR}\\s+)?(?:of|from)\\b`, 'gi') },
  { id: 'near-town', re: /\bnear(?:by)?\s+(?:the\s+)?(?:town\s+of\s+|city\s+of\s+)?[A-Z][a-z]+/g },
  { id: 'named-water', re: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Creek|River|Lake|Fork|Branch|Run)\b/g },
  { id: 'named-earthworks', re: /\b(?:[A-Z][a-z]+\s+)+Earthworks(?:\s+Complex)?\b|\bEarthworks\s+Complex\b/g },
]

/** Every locator hit in a block of text, as { id, match }. */
export function findLocators(text) {
  const hits = []
  const s = String(text || '')
  for (const { id, re } of LOCATOR_PATTERNS) {
    re.lastIndex = 0
    for (const m of s.matchAll(re)) hits.push({ id, match: m[0] })
  }
  return hits
}
