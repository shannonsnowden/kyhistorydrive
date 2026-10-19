/**
 * Guess a Kentucky county from story text. The name must be followed by the word "County", so a
 * person, river or place that shares a county's name is never a match: "Thomas Jefferson",
 * "Ohio River", "Cumberland Gap", "George Rogers Clark" (Phase 0, Shannon item 87).
 * Shared by the page build (scripts/prerender-pages.mjs) and the app (src/main.js).
 *
 * A shared plural counts for the first name: "In Powell and Wolfe counties" is Powell.
 *
 * countyMatcher(names) returns (text) => canonical county name from `names`, or ''.
 */
export function countyMatcher(names) {
  const list = [...(names || [])].filter(Boolean).sort((a, b) => b.length - a.length)
  if (!list.length) return () => ''
  const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const alt = list.map(escapeRe).join('|')
  const re = new RegExp(`\\b(${alt})(?:\\s+County\\b|(?:,\\s*(?:${alt}))*,?\\s+(?:and|or)\\s+(?:${alt})\\s+Counties\\b)`, 'i')
  const canonical = new Map(list.map((n) => [String(n).toLowerCase(), n]))
  return (text) => {
    if (!text) return ''
    const m = String(text).match(re)
    return m ? canonical.get(m[1].toLowerCase()) || '' : ''
  }
}
