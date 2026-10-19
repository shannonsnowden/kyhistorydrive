/** Markdown links [text](url) where url may contain one level of balanced parentheses. */
export const MD_LINK_RE = /\[([^\]]*)\]\((?:[^()\s]|\([^()\s]*\))+\)/g

export function stripMarkdownLinks(text) {
  return String(text || '').replace(MD_LINK_RE, '$1')
}
