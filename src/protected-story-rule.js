/**
 * The one protected-coordinate rule (#337, Phase 1 note a). Used by the browser
 * (src/story-tools.js storyOrigin) and the build (scripts/lib/unified-story-data.mjs).
 * Protected stories show 0.1° (~10 km) coordinates; everything else 4 decimals.
 *
 * Order matters: explicit flags and the protected id list always win; pin-rounding skipSlugs /
 * skipHistoryIds then opt a story out of the archaeology/prehistoric heuristics.
 */
const SITE_NUMBER = /\b15[a-z]{2}\d{1,4}\b/i

export function isProtectedStoryRule(story, { protectedIds, skipIds } = {}) {
  if (!story) return false
  if (story.coordinatesProtected || story.locationApproximate) return true
  const has = (set, v) => Boolean(set && v != null && v !== '' && set.has(String(v)))
  if (has(protectedIds, story.slug) || has(protectedIds, story.id) || has(protectedIds, story.historyId)) return true
  if (has(skipIds, story.slug) || has(skipIds, story.historyId)) return false
  return Boolean(
    story.archaeological ||
      story.era === 'prehistoric' ||
      (Array.isArray(story.tags) && (story.tags.includes('archaeology') || story.tags.includes('prehistoric'))) ||
      SITE_NUMBER.test(String(story.slug || '')),
  )
}
