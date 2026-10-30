/**
 * Start-here: six amber pins, one Bluegrass Forts CTA, green clusters.
 * The pin list is ids into existing layers. No second coordinate list.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CLUSTER_COLOR,
  CLUSTER_COUNT_COLOR,
  CLUSTER_EXPAND_MIN,
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS,
  START_HERE_CHIP_KEY,
  START_HERE_COLOR,
  STARTER_DRIVE_CTA,
  buildFeaturedCollection,
  driveHref,
  featuredDupeFilter,
  omitFeaturedFeatures,
  unclusteredPointFilter,
  visibleFeaturedCount,
} from '../src/start-here.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0
const fail = (msg) => {
  failed++
  console.error('test-start-here:', msg)
}
const ok = (cond, msg) => {
  if (!cond) fail(msg)
}

const spec = JSON.parse(readFileSync(resolve(root, 'public/data/web/start-here.json'), 'utf8'))
const drives = JSON.parse(readFileSync(resolve(root, 'public/data/web/story-drives.json'), 'utf8'))
const main = readFileSync(resolve(root, 'src/main.js'), 'utf8')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')
const css = readFileSync(resolve(root, 'src/styles.css'), 'utf8')

const EXPECTED = [
  ['parks', 'big-bone-lick-state-historic-site', 'Big Bone Lick'],
  ['parks', 'old-fort-harrod-state-park', 'Fort Harrod'],
  ['national', 'cumberland-gap-nhp', 'Cumberland Gap'],
  ['national', 'mammoth-cave-np', 'Mammoth Cave'],
  ['parks', 'columbus-belmont-state-park', 'Columbus-Belmont'],
  ['history', 'pound-gap-pine-mountain-letcher-1750-1864', 'Pound Gap'],
]

function walkKeys(value, bad) {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (/^(lat|lon|lng|latitude|longitude|coordinates|address|geocode)$/i.test(key)) bad.push(key)
    walkKeys(child, bad)
  }
}

const badKeys = []
walkKeys(spec, badKeys)
ok(badKeys.length === 0, `start-here.json has locator fields: ${badKeys.join(', ')}`)
ok(!/-?\d+\.\d+/.test(JSON.stringify(spec)), 'start-here.json contains a decimal coordinate')

const pins = spec.pins || []
ok(pins.length === 6, `featured layer is 6 amber pins, got ${pins.length}`)
for (const [layer, id, label] of EXPECTED) {
  ok(
    pins.some((p) => p.layer === layer && String(p.id) === id && p.label === label),
    `missing featured pin ${label} (${layer}:${id})`,
  )
}

ok(spec.drive?.cta === STARTER_DRIVE_CTA, 'starter CTA string drifted')
ok(drives.drives?.[spec.drive?.id], `unknown starter drive ${spec.drive?.id}`)
ok(driveHref(spec.drive) === '/drives/bluegrass-forts/', 'starter drive href')
ok(html.includes(`>${STARTER_DRIVE_CTA}</a>`), 'homepage is missing the Bluegrass Forts CTA')
ok(html.includes('href="/drives/bluegrass-forts/"'), 'CTA does not open the Bluegrass Forts drive')
const ctaCount = html.split(STARTER_DRIVE_CTA).length - 1
ok(ctaCount === 1, `CTA should appear once, found ${ctaCount}`)

const collections = {}
for (const layer of [...new Set(pins.map((p) => p.layer))]) {
  const file = layer === 'markers' ? 'public/data/markers.geojson' : `public/data/layers/${layer}.geojson`
  collections[layer] = JSON.parse(readFileSync(resolve(root, file), 'utf8'))
}
const featured = buildFeaturedCollection(spec, collections)
ok(featured.features.length === 6, `resolved ${featured.features.length} of 6 pins`)
for (const feature of featured.features) {
  const src = collections[feature.properties.homeLayer].features.find((f) => f.properties.id === feature.properties.id)
  ok(src && src.geometry === feature.geometry, `featured geometry was copied for ${feature.properties.id}`)
}
for (const [layer, collection] of Object.entries(collections)) {
  const omitted = omitFeaturedFeatures(collection, layer, pins)
  ok(
    omitted.features.every((f) => !pins.some((p) => p.layer === layer && String(p.id) === String(f.properties.id))),
    `${layer} clustered source still contains a featured pin`,
  )
}

ok(visibleFeaturedCount(featured, [], true) === 6, 'all six featured pins count while Start here is on')
ok(visibleFeaturedCount(featured, ['parks'], false) === 0, 'count is 0 when Start here is off')
ok(featuredDupeFilter([]) === null, 'dupe filter should be open when no home layer is on')
ok(
  JSON.stringify(unclusteredPointFilter(['==', ['get', 'id'], 'x'])) ===
    JSON.stringify(['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], 'x']]),
  'cluster point filter did not keep the layer filter',
)

ok(CLUSTER_MAX_ZOOM >= 9 && CLUSTER_MAX_ZOOM <= 13, 'cluster max zoom is outside the zoomed-out range')
ok(CLUSTER_RADIUS >= 32 && CLUSTER_RADIUS <= 80, 'cluster radius is outside a useful range')
ok(CLUSTER_EXPAND_MIN >= 9, 'cluster expand zoom is below 9')
ok(START_HERE_COLOR === '#c9893a', 'featured pins are not amber')
ok(CLUSTER_COUNT_COLOR === '#f3ead8', 'cluster counts are not cream')
ok(CLUSTER_COLOR === '#5f7d62', 'cluster circles are not the muted green')
ok(/cluster:\s*true/.test(main), 'home map does not enable MapLibre clustering')
ok(main.includes('CLUSTER_EXPAND_MIN'), 'cluster click does not enforce the minimum zoom')
ok(main.includes('omitFeaturedFeatures'), 'featured pins are not removed from clustered sources')
ok(main.includes('cooperativeGestures'), 'map still takes scroll-zoom and one-finger pan')
ok(main.includes('START_HERE_CHIP_KEY'), 'Start here chip is not stored in localStorage')
ok(html.includes(START_HERE_CHIP_KEY), 'chip dismiss does not use the shared localStorage key')
ok(/id="startHereChip"/.test(html), 'map is missing the Start here chip')
ok(/id:\s*'markers'[\s\S]{0,240}defaultOn:\s*true/.test(main), 'Markers layer is not available behind the featured pins')
ok(/min-height:\s*55svh/.test(css), 'mobile map is not about 55svh')
ok(/maplibregl-ctrl-group button[\s\S]{0,120}height:\s*44px/.test(css), 'map controls are not 44px')

if (failed) {
  console.error(`test-start-here: ${failed} failed`)
  process.exit(1)
}
console.log(`test-start-here: ok (6 amber pins, ${STARTER_DRIVE_CTA})`)
