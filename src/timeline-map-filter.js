/**
 * Timeline list ↔ map pin filter.
 *
 * All years (no year bounds, every era on) is the initial state. The story
 * list includes every story in that state. Story-place pins use the same
 * predicate: a null MapLibre filter shows every feature in stories.geojson.
 * Catalog layers (markers and the rest) stay match-nothing until a year or
 * era narrows them, which is the path that already draws those pins.
 */

const NONE = ['==', ['get', 'id'], '__none__']

export function timelineFilterActive(state, eraCount) {
  const hasYear = state.yearMin != null || state.yearMax != null
  const erasNarrowed = state.eras.size > 0 && state.eras.size !== eraCount
  return hasYear || erasNarrowed
}

export function normalizeTimelineEra(era) {
  if (era === 'revolution') return 'frontier'
  if (era === 'modern') return 'other'
  return era || 'other'
}

/** Same membership the Timeline story list uses. */
export function storyMatchesTimelineFilters(story, state) {
  if (!state.eras.has(normalizeTimelineEra(story?.era))) return false
  const { yearMin, yearMax } = state
  if (yearMin != null || yearMax != null) {
    if (story?.yearStart == null) return false
    const start = Number(story.yearStart)
    const end = Number(story.yearEnd != null ? story.yearEnd : story.yearStart)
    if (yearMax != null && start > yearMax) return false
    if (yearMin != null && end < yearMin) return false
  }
  return true
}

function storyEraExpr() {
  return [
    'case',
    ['==', ['get', 'era'], 'revolution'],
    'frontier',
    ['==', ['get', 'era'], 'modern'],
    'other',
    ['get', 'era'],
  ]
}

function buildYearEraFilter(state, eraIds, layerDef) {
  if (!layerDef.yearFilter) return null
  const parts = []
  const eras = [...state.eras]
  const allEras = eras.length === eraIds.length
  if (layerDef.filterByEra) {
    if (!allEras && eras.length) {
      const eraExpr = layerDef.storyPlaces ? storyEraExpr() : ['get', 'era']
      parts.push(['in', eraExpr, ['literal', eras]])
    } else if (!allEras && eras.length === 0) {
      return NONE
    }
  }
  const { yearMin, yearMax } = state
  if (yearMin != null || yearMax != null) {
    parts.push(['has', 'yearStart'])
    if (yearMax != null) parts.push(['<=', ['to-number', ['get', 'yearStart']], yearMax])
    if (yearMin != null) {
      parts.push([
        '>=',
        ['to-number', ['coalesce', ['get', 'yearEnd'], ['get', 'yearStart']]],
        yearMin,
      ])
    }
  }
  if (!parts.length) return null
  return parts.length === 1 ? parts[0] : ['all', ...parts]
}

/**
 * MapLibre filter for one timeline layer.
 * null = show every feature. NONE = show nothing.
 */
export function timelineLayerFilter(state, eraIds, layerDef) {
  const eraCount = eraIds.length
  const allYears = state.yearMin == null && state.yearMax == null
  const allErasOn = state.eras.size === eraCount
  if (!timelineFilterActive(state, eraCount)) {
    // Initial load and the All preset: story places, not an empty layer.
    if (allYears && allErasOn && layerDef.storyPlaces) return null
    return NONE
  }
  const filter = buildYearEraFilter(state, eraIds, { ...layerDef, yearFilter: true })
  if (filter) return filter
  const { yearMin, yearMax } = state
  if (yearMin != null || yearMax != null) {
    const parts = [['has', 'yearStart']]
    if (yearMax != null) parts.push(['<=', ['to-number', ['get', 'yearStart']], yearMax])
    if (yearMin != null) {
      parts.push([
        '>=',
        ['to-number', ['coalesce', ['get', 'yearEnd'], ['get', 'yearStart']]],
        yearMin,
      ])
    }
    return parts.length === 1 ? parts[0] : ['all', ...parts]
  }
  // Era-only and this layer isn't era-aware: don't dump the whole layer.
  return NONE
}

/** Whether one GeoJSON feature is a pin under the current Timeline filter. */
export function placeMatchesTimelineFilter(props, state, eraCount, layerDef) {
  if (!props) return false
  if (layerDef?.storyPlaces) return storyMatchesTimelineFilters(props, state)
  if (!timelineFilterActive(state, eraCount)) return false
  if (layerDef.filterByEra) {
    if (state.eras.size !== eraCount) {
      if (!state.eras.size) return false
      if (!state.eras.has(props.era)) return false
    }
  }
  const { yearMin, yearMax } = state
  if (yearMin == null && yearMax == null) {
    return Boolean(layerDef.filterByEra && props.era)
  }
  if (props.yearStart == null) return false
  const start = Number(props.yearStart)
  const end = Number(props.yearEnd != null ? props.yearEnd : props.yearStart)
  if (Number.isNaN(start)) return false
  if (yearMax != null && start > yearMax) return false
  if (yearMin != null && end < yearMin) return false
  return true
}
