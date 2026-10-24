/**
 * Looting-sensitive archaeological pins (web only).
 *
 * The public coordinates of these sites are rounded to 0.1° (about 10 km) by
 * scripts/apply-story-overrides.mjs (rules: scripts/pin-rounding.json), which also writes the id list
 * to public/data/web/protected-pins.json. The map popup adds a short note for those ids, the
 * home map draws a ring and a faint ~10 km circle around them, and focus/deep links cap the zoom at 11.
 *
 * KILL SWITCH: set PROTECTED_PIN_NOTE_ENABLED to false to hide the popup note (the rounding itself
 * lives in the data; to undo it, revert the PR and rebuild).
 */
import { setProtectedStoryIds } from './story-tools.js'

export const PROTECTED_PIN_NOTE_ENABLED = true

let ids = new Set()
let loading = null
// Fail closed: true only after protected-pins.json loaded and parsed.
let loaded = false

export function protectedPinsLoaded() {
  return loaded
}

export function loadProtectedPins() {
  if (!PROTECTED_PIN_NOTE_ENABLED) return Promise.resolve(ids)
  if (!loading) {
    loading = fetch('/data/web/protected-pins.json')
      .then((r) => {
        if (!r.ok) throw new Error(`protected-pins.json ${r.status}`)
        return r.json()
      })
      .then((d) => {
        if (!d || !Array.isArray(d.ids)) throw new Error('protected-pins.json has no ids')
        ids = new Set(Array.isArray(d?.ids) ? d.ids : [])
        // #337: storyOrigin (nearby-story distances) uses the same rule and lists as the build.
        setProtectedStoryIds(ids, Array.isArray(d?.skipIds) ? d.skipIds : [])
        loaded = true
        return ids
      })
      .catch(() => {
        loaded = false
        loading = null // allow a retry later; callers fail closed meanwhile
        return ids
      })
  }
  return loading
}

export function isProtectedPin(id) {
  return PROTECTED_PIN_NOTE_ENABLED && !!id && ids.has(id)
}

export function protectedPinNoteHtml(id) {
  if (!isProtectedPin(id)) return ''
  return '<p class="popup-protected" data-protected-pin>Approximate location (within ~6 mi) to protect the site.</p>'
}

/** Deep links and story focus never zoom past this on a protected pin, so it can't look exact. */
export const PROTECTED_MAX_FOCUS_ZOOM = 11

export function capProtectedZoom(zoom, ...candidateIds) {
  return candidateIds.some((id) => isProtectedPin(id)) ? Math.min(zoom, PROTECTED_MAX_FOCUS_ZOOM) : zoom
}

// Rings and the faint ~10 km circle draw from the same sources as the pins (home map only).
const RING_SOURCES = [
  { source: 'history', circle: 'history-circle' },
  { source: 'stories', circle: 'stories-circle' },
]
const RADIUS_M = 10000
const KY_COS_LAT = Math.cos((37.6 * Math.PI) / 180)
// Pixels for RADIUS_M at zoom z (512px tiles): RADIUS_M * 512 * 2^z / (40075016.7 * cos lat).
const pxAt = (z) => (RADIUS_M * 512 * 2 ** z) / (40075016.7 * KY_COS_LAT)

function idFilter() {
  return [
    'in',
    ['coalesce', ['get', 'historyId'], ['get', 'id'], ['get', 'slug'], ''],
    ['literal', [...ids]],
  ]
}

function addFor(map, { source, circle }) {
  const ringId = `${source}-protected-ring`
  const areaId = `${source}-protected-area`
  if (map.getLayer(ringId) || !map.getSource(source) || !map.getLayer(circle)) return
  const vis = map.getLayoutProperty(circle, 'visibility') || 'visible'
  map.addLayer(
    {
      id: areaId,
      type: 'circle',
      source,
      minzoom: 8.5,
      filter: idFilter(),
      layout: { visibility: vis },
      paint: {
        'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 8, pxAt(8), 16, pxAt(16)],
        'circle-color': '#b7791f',
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 8.5, 0, 9.5, 0.07],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#b7791f',
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 8.5, 0, 9.5, 0.35],
        'circle-pitch-alignment': 'map',
      },
    },
    circle,
  )
  map.addLayer(
    {
      id: ringId,
      type: 'circle',
      source,
      filter: idFilter(),
      layout: { visibility: vis },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 8, 9, 10, 12, 12.5, 16, 15.5],
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#b7791f',
      },
    },
    circle,
  )
}

/** Ringed marker + faint ~10 km circle for protected pins; follows each pin layer's visibility. */
export function addProtectedPinLayers(map) {
  if (!PROTECTED_PIN_NOTE_ENABLED || !map) return
  loadProtectedPins().then(() => {
    if (!ids.size) return
    const tryAll = () => RING_SOURCES.forEach((r) => addFor(map, r))
    tryAll()
    map.on('sourcedata', (e) => {
      if (RING_SOURCES.some((r) => r.source === e.sourceId)) tryAll()
    })
    map.on('styledata', () => {
      for (const { source, circle } of RING_SOURCES) {
        if (!map.getLayer(circle)) continue
        const vis = map.getLayoutProperty(circle, 'visibility') || 'visible'
        for (const lid of [`${source}-protected-ring`, `${source}-protected-area`]) {
          if (map.getLayer(lid) && map.getLayoutProperty(lid, 'visibility') !== vis) map.setLayoutProperty(lid, 'visibility', vis)
        }
      }
    })
  })
}
