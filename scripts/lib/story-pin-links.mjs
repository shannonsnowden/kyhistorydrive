/**
 * Link-only pin fields from scripts/story-overrides.json (#337).
 * historyId wins over the fuzzy/name match; alsoHistoryIds lets one story own extra History pins
 * (e.g. David Rice keeps Greensburg and also owns Concord Church, Danville).
 */
export function applyPinLinks(loc, override, historyIds) {
  if (!loc || !override) return loc
  const check = (id) => {
    if (!historyIds.has(id)) throw new Error(`story-overrides "${loc.slug}": unknown history pin "${id}"`)
    return id
  }
  if (override.historyId) loc.historyId = check(override.historyId)
  if (Array.isArray(override.alsoHistoryIds)) {
    const also = [...new Set(override.alsoHistoryIds.map(check))].filter((id) => id !== loc.historyId)
    if (also.length) loc.alsoHistoryIds = also
  }
  return loc
}
