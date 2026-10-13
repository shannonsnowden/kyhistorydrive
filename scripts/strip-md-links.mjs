/**
 * Pin popups and the search index are plain text: reduce Markdown links
 * `[visible](url)` (and `![alt](img)`) to their visible text. Story files keep links.
 */
export function stripMdLinks(s) {
  if (typeof s !== 'string' || !s.includes('](')) return s
  let out = s
  // repeat to unwrap nested/adjacent links; handles one level of parens inside URLs
  for (let i = 0; i < 3 && out.includes(']('); i++) {
    out = out.replace(/!?\[([^\]]*)\]\((?:[^()\s]|\([^()]*\))*(?:\s+"[^"]*")?\)/g, '$1')
  }
  return out
}
