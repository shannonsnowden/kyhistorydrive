/** Brief header parsing for build-home-preview (homepage order = morning-brief order). */
export function slugify(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Optional Markdown heading marks ("### "), then an emoji, then the title. */
export const EMOJI_HEADER =
  /^(?:#{1,6}[ \t]+)?(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}])\uFE0F?\s+(.+)$/u

export function parseBriefOrder(markdown) {
  const slugs = []
  for (const line of String(markdown || '').split(/\r?\n/)) {
    const m = line.match(EMOJI_HEADER)
    if (m) slugs.push(slugify(m[1]))
  }
  return slugs
}
