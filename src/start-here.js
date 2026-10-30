/**
 * First-visit map: a short featured-pin list plus one starter drive.
 * The list is public/data/web/start-here.json (layer + id only).
 * Coordinates always come from the existing layer GeoJSON, so a protected
 * site keeps the rounded pin it already has and this file never adds a locator.
 */

export const START_HERE_URL = '/data/web/start-here.json'
export const START_HERE_SOURCE = 'start-here'
export const START_HERE_CIRCLE = 'start-here-circle'
export const START_HERE_HIT = 'start-here-hit'
export const START_HERE_COLOR = '#c9893a'
/** Non-featured pins and cluster bubbles. Cream count text sits on this green. */
export const CLUSTER_COLOR = '#5f7d62'
export const CLUSTER_COUNT_COLOR = '#f3ead8'
/** A cluster click never stops below this zoom. */
export const CLUSTER_EXPAND_MIN = 9
export const START_HERE_CHIP_KEY = 'khd-start-here-dismissed'
/** Exact homepage label. Do not paraphrase. */
export const STARTER_DRIVE_CTA = 'Start with a drive: Bluegrass Forts (½ day) →'

/** Home-map pin clustering. Featured pins stay on their own unclustered source. */
export const CLUSTER_MAX_ZOOM = 11
export const CLUSTER_RADIUS = 48

export const START_HERE_LAYER_IDS = [START_HERE_CIRCLE, START_HERE_HIT]

const DRIVE_ID = /^[a-z0-9-]{1,80}$/

export function clusterLayerIds(layerId) {
  return [`${layerId}-clusters`, `${layerId}-cluster-count`]
}

/** Point layers on a clustered source should not also draw the cluster bubbles. */
export function unclusteredPointFilter(filter) {
  const point = ['!', ['has', 'point_count']]
  if (!filter) return point
  return ['all', point, filter]
}

export function driveId(drive) {
  const id = String(drive?.id || '')
  return DRIVE_ID.test(id) ? id : ''
}

export function driveHref(drive) {
  const id = driveId(drive)
  return id ? `/drives/${id}/` : ''
}

export function featureMatchesPin(feature, pin) {
  const p = feature?.properties || {}
  const want = String(pin?.id ?? '')
  if (!want || !pin?.layer) return false
  if (pin.layer === 'markers') return String(p.marker_number ?? '') === want
  return String(p.id ?? '') === want || String(p.historyId ?? '') === want || String(p.slug ?? '') === want
}

/** Copy matching points from the layer collections. Unknown ids are skipped, never invented. */
export function buildFeaturedCollection(spec, collectionsByLayer) {
  const features = []
  const seen = new Set()
  for (const pin of spec?.pins || []) {
    if (!pin?.layer || pin.id == null || pin.id === '') continue
    const key = `${pin.layer}:${pin.id}`
    if (seen.has(key)) continue
    const found = (collectionsByLayer?.[pin.layer]?.features || []).find(
      (f) => featureMatchesPin(f, pin) && f.geometry?.type === 'Point',
    )
    if (!found) continue
    seen.add(key)
    features.push({
      type: 'Feature',
      geometry: found.geometry,
      properties: { ...found.properties, homeLayer: pin.layer },
    })
  }
  return { type: 'FeatureCollection', features }
}

/** Drop featured points from a clustered source so those pins never join a bubble. */
export function omitFeaturedFeatures(collection, layerId, pins) {
  const list = (pins || []).filter((pin) => pin?.layer === layerId)
  if (!list.length || !collection?.features) return collection
  const features = collection.features.filter((feature) => !list.some((pin) => featureMatchesPin(feature, pin)))
  if (features.length === collection.features.length) return collection
  return { ...collection, features }
}

/** Hide a featured copy while its home layer is already drawing that pin. */
export function featuredDupeFilter(visibleLayerIds) {
  const ids = [...(visibleLayerIds || [])].filter(Boolean)
  if (!ids.length) return null
  return ['!', ['in', ['get', 'homeLayer'], ['literal', ids]]]
}

export function visibleFeaturedCount(collection, visibleLayerIds, enabled) {
  if (!enabled) return 0
  const hidden = new Set(visibleLayerIds || [])
  return (collection?.features || []).filter((f) => !hidden.has(f.properties?.homeLayer)).length
}
