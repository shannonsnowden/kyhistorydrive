/**
 * Story URLs (#337). Every story link is the static page /stories/<slug>/; a merged (retired) slug
 * points at the story it was folded into. STORY_MERGES mirrors data/story-merges.json
 * (scripts/test-story-links.mjs fails if they drift).
 */
export const STORY_MERGES = {
  'capt-jack-jouett': 'jack-jouett-kentuckys-midnight-rider',
  'yellow-banks-becomes-owensboro': 'owensboro-yellow-banks',
  'camp-nelson-jessamine-county': 'camp-nelson-kentucky-us-colored-troops',
  'peter-village-early-woodland-enclosure-near-lexington': 'peter-village-enclosure-15fa166',
  'chickamauga-cherokee-hold-the-southern-flank': 'chickamauga-cherokee',
  'jacob-beam-sells-old-jakes-first-barrel': 'jacob-beam-on-hardin-creek',
  'wea-towns-at-ouiatenon-and-scotts-1791-kentucky-raid': 'wea-waayaahtanwa-on-the-wabash',
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function canonicalStorySlug(slug) {
  const s = String(slug || '')
  return Object.prototype.hasOwnProperty.call(STORY_MERGES, s) ? STORY_MERGES[s] : s
}

export function storyUrl(slug) {
  const s = canonicalStorySlug(slug)
  return SLUG.test(s) ? `/stories/${s}/` : '/stories/'
}

/**
 * Old in-app links (/#timeline/<slug>, /#stories/<slug>) on the homepage document: the static
 * story page to forward to on first load, or null to leave the hash alone.
 */
export function timelineForwardUrl(hash, pathname, knownSlugs = null) {
  if (pathname !== '/' && pathname !== '/index.html') return null
  const m = /^#(?:timeline|stories|story)\/([^/?#]+)\/?$/.exec(String(hash || ''))
  if (!m) return null
  let slug
  try {
    slug = decodeURIComponent(m[1])
  } catch {
    return knownSlugs ? '/stories/' : null
  }
  slug = canonicalStorySlug(slug)
  if (knownSlugs) return SLUG.test(slug) && knownSlugs.has(slug) ? `/stories/${slug}/` : '/stories/'
  return SLUG.test(slug) ? `/stories/${slug}/` : null
}

const HIDDEN_STATUS = new Set(['draft', 'hidden', 'unpublished', 'private', 'scheduled', 'research'])

/** Slugs that have a static /stories/<slug>/ page (mirrors prerender isLiveStory). */
export function liveStorySlugs(stories, today) {
  const out = new Set()
  for (const st of stories || []) {
    if (!st || typeof st.slug !== 'string' || !st.slug || st.draft === true || st.hidden === true) continue
    if (HIDDEN_STATUS.has(String(st.status || st.visibility || '').trim().toLowerCase())) continue
    const pub = String(st.publishedDate || '').slice(0, 10)
    if (!pub || pub > today) continue
    out.add(st.slug)
  }
  return out
}
