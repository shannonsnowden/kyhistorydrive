/**
 * Geographic overlay for the six route-map paintings.
 *
 * The paintings are not a live map. Each light desktop image and its light
 * zoom image share one Web Mercator frame (the zoom file is the same framing
 * at a higher resolution). Phone art is a separate redraw, so it has its own
 * frame. Dark art, inline and zoomed, is that same projection placed in an
 * inset rectangle of the image.
 *
 * Frames were fitted so published stop coordinates land on the red route and
 * the Natural Earth Kentucky shoreline lands on the painted state line. The
 * paintings were drawn from Natural Earth 10m admin-1. Web Mercator y is
 * ln(tan(pi/4 + latitude/2)), normalized so north is 0 and south is 1, then
 * x is (longitude - west) / (east - west). Dark, phone-dark, and zoom-dark
 * rectangles were searched as insets of the matching light frame by the same
 * red-route error. public/data/kentucky-outline.geojson is the public-domain
 * Natural Earth Kentucky multipolygon already vendored in this repo (main
 * ring plus the Kentucky Bend). Douglas-Peucker at 0.015 degrees leaves
 * about 130 points. Latitudes and longitudes are stored in separate arrays
 * so the overlay never writes a latitude/longitude pair. Marker and path
 * output is image percentages and integer SVG coordinates only.
 *
 * Protected archaeological stops keep the coordinates already published on
 * the route. Lower Shawneetown stays at its rounded tenth of a degree.
 * This module does not introduce a finer point for any protected site.
 */

const IDENTITY = { x0: 0, y0: 0, x1: 1, y1: 1 }

function bounds(west, east, south, north) {
  return { west, east, south, north }
}

function inset(x0, y0, x1, y1) {
  return { x0, y0, x1, y1 }
}

/** Light frame plus the dark/phone insets measured against that frame. */
export const ROUTE_FRAMES = {
  'athiamiowee-the-warriors-path-through-kentucky': {
    full: bounds(-90.765, -73.7, 34.55, 39.25),
    phone: bounds(-89, -78.1, 34.44, 40.5),
    dark: inset(0, 0.03, 1.013, 0.92),
    zoomDark: inset(0.01, 0.098, 1, 0.92),
    phoneDark: inset(0.015, -0.017, 0.99, 1.002),
  },
  'thomas-walker-and-cumberland-gap': {
    full: bounds(-85.7, -77.04, 35.55, 39.265),
    phone: bounds(-89.04, -72.065, 31.4, 39.5),
    dark: inset(0.03, 0.06, 0.99, 0.88),
    zoomDark: inset(0.03, 0.05, 0.98, 0.94),
    phoneDark: inset(0.04, 0.068, 0.94, 0.89),
  },
  'christopher-gist-1750-51': {
    full: bounds(-88.47, -75.35, 35.3, 41.01),
    phone: bounds(-86.9, -73.05, 33.35, 42.6),
    dark: inset(0.022, 0.047, 0.98, 0.9),
    zoomDark: inset(0.01, 0.043, 0.99, 0.96),
    phoneDark: inset(0.03, 0.07, 0.909, 0.87),
  },
  'william-calks-1775-journal': {
    full: bounds(-85.45, -75.94, 35.165, 40.01),
    phone: bounds(-92.5, -75.8, 35.67, 43.1),
    dark: inset(0.023, -0.023, 1.008, 0.93),
    zoomDark: inset(0.02, -0.02, 1.008, 0.985),
    phoneDark: inset(-0.02, 0.109, 1.02, 0.95),
  },
  'george-rogers-clark': {
    full: bounds(-91.4, -81.32, 34.16, 41.85),
    phone: bounds(-91.965, -84.7, 35.125, 41.85),
    dark: inset(0.04, 0.07, 0.95, 0.88),
    zoomDark: inset(0.03, 0.06, 0.962, 0.937),
    phoneDark: inset(-0.018, 0.037, 0.99, 0.96),
  },
  'mantle-rock-and-the-trail-of-tears': {
    full: bounds(-96.35, -80.95, 33.4, 39.6),
    phone: bounds(-97.45, -84.15, 35.55, 41.4),
    dark: inset(0.03, 0.06, 0.97, 0.888),
    zoomDark: inset(0.02, 0.07, 0.97, 0.91),
    phoneDark: inset(-0.04, -0.02, 1, 0.99),
  },
}

const KY_LATS = [
  [36.569, 36.608, 36.761, 36.839, 36.877, 36.962, 37.062, 37.185, 37.223, 37.22, 37.077, 37.072, 37.137, 37.303, 37.385, 37.416, 37.491, 37.52, 37.621, 37.664, 37.751, 37.807, 37.782, 37.83, 37.923, 37.929, 37.878, 37.907, 37.837, 37.825, 37.857, 37.956, 37.976, 37.913, 37.942, 37.847, 37.789, 37.919, 37.995, 37.924, 37.901, 37.864, 37.854, 37.919, 37.938, 38.04, 38.069, 38.137, 38.115, 38.147, 38.169, 38.195, 38.154, 38.084, 38.059, 38.015, 37.97, 38.029, 38.18, 38.277, 38.27, 38.31, 38.461, 38.469, 38.553, 38.726, 38.741, 38.694, 38.792, 38.795, 38.828, 38.893, 38.92, 38.974, 39.062, 39.146, 39.077, 39.102, 39.057, 39.017, 38.823, 38.778, 38.789, 38.762, 38.639, 38.636, 38.683, 38.707, 38.66, 38.601, 38.619, 38.716, 38.745, 38.586, 38.535, 38.419, 38.248, 38.162, 37.981, 37.937, 37.898, 37.827, 37.758, 37.688, 37.63, 37.563, 37.539, 37.278, 37.137, 37.113, 37.047, 36.98, 36.901, 36.852, 36.753, 36.669, 36.586, 36.629, 36.664, 36.643, 36.674, 36.69, 36.499, 36.499, 36.638, 36.569],
  [36.501, 36.5, 36.556, 36.554, 36.501]
]

const KY_LONS = [
  [-89.253, -89.205, -89.133, -89.153, -89.125, -89.119, -89.179, -89.078, -89.002, -88.907, -88.561, -88.484, -88.433, -88.512, -88.489, -88.448, -88.091, -88.083, -88.157, -88.157, -88.06, -88.045, -87.951, -87.9, -87.927, -87.888, -87.797, -87.687, -87.68, -87.657, -87.601, -87.618, -87.599, -87.549, -87.405, -87.165, -87.118, -87.02, -86.819, -86.773, -86.644, -86.663, -86.624, -86.59, -86.523, -86.519, -86.444, -86.462, -86.416, -86.333, -86.382, -86.383, -86.292, -86.284, -86.259, -86.111, -86.051, -85.931, -85.901, -85.829, -85.758, -85.665, -85.59, -85.527, -85.415, -85.455, -85.257, -85.186, -84.936, -84.806, -84.82, -84.784, -84.877, -84.823, -84.873, -84.73, -84.637, -84.444, -84.408, -84.307, -84.218, -84.084, -83.972, -83.866, -83.714, -83.651, -83.616, -83.534, -83.369, -83.305, -83.152, -83.031, -82.886, -82.827, -82.698, -82.589, -82.572, -82.637, -82.47, -82.482, -82.425, -82.402, -82.324, -82.296, -82.181, -82.116, -81.965, -82.351, -82.682, -82.708, -82.712, -82.849, -82.869, -83.062, -83.129, -83.509, -83.73, -85.867, -86.508, -87.839, -87.869, -88.067, -88.043, -89.424, -89.359, -89.253],
  [-89.494, -89.56, -89.57, -89.503, -89.494]
]

function mercY(lat) {
  const phi = (lat * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + phi / 2))
}

function project(frame, box, lon, lat) {
  const x = (lon - frame.west) / (frame.east - frame.west)
  const north = mercY(frame.north)
  const south = mercY(frame.south)
  const y = (north - mercY(lat)) / (north - south)
  return [box.x0 + x * (box.x1 - box.x0), box.y0 + y * (box.y1 - box.y0)]
}

function outlinePath(frame, box) {
  let d = ''
  for (let ring = 0; ring < KY_LATS.length; ring += 1) {
    const lats = KY_LATS[ring]
    const lons = KY_LONS[ring]
    for (let i = 0; i < lats.length; i += 1) {
      const point = project(frame, box, lons[i], lats[i])
      const px = Math.round(point[0] * 1000)
      const py = Math.round(point[1] * 1000)
      d += (i === 0 ? 'M' : 'L') + px + ' ' + py
    }
    d += 'Z'
  }
  return d
}

function markerHtml(frame, box, stop, number) {
  const point = project(frame, box, stop.geo[1], stop.geo[0])
  const left = (point[0] * 100).toFixed(1)
  const top = (point[1] * 100).toFixed(1)
  const kind = stop.conjectural ? ' route-stop-conjectural' : ''
  return `<span class="route-stop${kind}" style="left:${left}%;top:${top}%">${number}</span>`
}

function slotHtml(name, frame, box, route) {
  const markers = []
  route.stops.forEach((stop, index) => {
    if (!stop.geo) return
    markers.push(markerHtml(frame, box, stop, index + 1))
  })
  return `<div class="route-map-overlay" data-frame="${name}" aria-hidden="true"><svg class="route-ky" viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false"><path class="route-ky-line" d="${outlinePath(frame, box)}"></path></svg>${markers.join('')}</div>`
}

/** Five aligned overlays: desk light, desk dark, zoom dark, phone light, phone dark. */
export function routeMapOverlayHtml(route) {
  const spec = ROUTE_FRAMES[route.slug]
  if (!spec) return ''
  return [
    slotHtml('desk-light', spec.full, IDENTITY, route),
    slotHtml('desk-dark', spec.full, spec.dark, route),
    slotHtml('zoom-dark', spec.full, spec.zoomDark, route),
    slotHtml('phone-light', spec.phone, IDENTITY, route),
    slotHtml('phone-dark', spec.phone, spec.phoneDark, route),
  ].join('')
}
