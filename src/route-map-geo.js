/**
 * Stop markers for the six route-map paintings.
 *
 * Each light desktop image and its light zoom image share one Web Mercator
 * frame. Phone art is a separate redraw. Dark art, inline and zoomed, is
 * that same frame placed in an inset rectangle of the image. Web Mercator y
 * is ln(tan(pi/4 + latitude/2)), normalized so north is 0 and south is 1.
 *
 * The Kentucky shoreline is not drawn. The paintings put the state line
 * under the title cartouche and the legend, and on the Gist sheet the
 * eastern border does not stay on the painted Kentucky–West Virginia line
 * within a few pixels of any single frame. A stroke that misses by more
 * than that is left off rather than cut through the title, the legend, or
 * West Virginia.
 *
 * Where a painted label could be tied to the red route, the marker is
 * stored as a fraction of that image (light, or phone) so it sits beside
 * that label. Other stops use the frame. Phone slots collapse a run of
 * markers that would stack at 390px into one range badge; the zoom slots
 * keep every number. Output is one-decimal image percentages only.
 *
 * Protected archaeological stops keep the coordinates already published on
 * the route. This module does not introduce a finer point for any
 * protected site.
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
    full: bounds(-87.568, -78.4, 34.796, 39.125),
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

/**
 * Marker centers as fractions of the light image, on the painted red line in
 * travel order (traced in scripts/route-map-lines.json; the build check
 * scripts/check-route-order.mjs projects each one onto that trace). Where
 * painted points sit closer than one badge, the badge steps to the side of
 * the line rather than onto a neighbour. Stops without a coordinate get a
 * slot too, so the numbers run without gaps. Missing stops fall back to the
 * frame.
 */
const LIGHT_MARK = {
  'athiamiowee-the-warriors-path-through-kentucky': {
    0: [0.487, 0.063],
    1: [0.438, 0.209],
    2: [0.389, 0.314],
    3: [0.359, 0.278],
    4: [0.417, 0.353],
    5: [0.389, 0.4],
    6: [0.421, 0.465],
    7: [0.411, 0.529],
    8: [0.445, 0.553],
    9: [0.417, 0.6],
    10: [0.372, 0.858],
  },
  // Every stop sits on the painted red line in travel order (1 Old Town to
  // 17 the Yadkin), including stops with no coordinate of their own.
  'christopher-gist-1750-51': {
    0: [0.757, 0.256],
    1: [0.725, 0.156],
    2: [0.628, 0.082],
    3: [0.503, 0.139],
    4: [0.419, 0.261],
    5: [0.418, 0.407],
    6: [0.32, 0.153],
    7: [0.381, 0.426],
    8: [0.338, 0.413],
    9: [0.286, 0.439],
    10: [0.344, 0.558],
    11: [0.456, 0.683],
    12: [0.554, 0.651],
    13: [0.579, 0.606],
    14: [0.608, 0.647],
    15: [0.623, 0.711],
    16: [0.604, 0.856],
  },
  'thomas-walker-and-cumberland-gap': {
    0: [0.863, 0.32],
    1: [0.838, 0.367],
    2: [0.728, 0.498],
    3: [0.601, 0.57],
    4: [0.468, 0.656],
    5: [0.349, 0.691],
    6: [0.23, 0.728],
    7: [0.247, 0.667],
    8: [0.199, 0.653],
    9: [0.211, 0.499],
    10: [0.262, 0.396],
    11: [0.356, 0.426],
    12: [0.461, 0.478],
    13: [0.559, 0.431],
    14: [0.622, 0.385],
    15: [0.686, 0.342],
    16: [0.766, 0.302],
    17: [0.806, 0.324],
  },
  'william-calks-1775-journal': {
    0: [0.898, 0.172],
    1: [0.831, 0.278],
    2: [0.771, 0.351],
    3: [0.702, 0.395],
    4: [0.646, 0.478],
    5: [0.6, 0.523],
    6: [0.555, 0.57],
    7: [0.503, 0.63],
    8: [0.451, 0.651],
    9: [0.4, 0.641],
    10: [0.347, 0.633],
    11: [0.313, 0.688],
    12: [0.268, 0.701],
    13: [0.222, 0.698],
    14: [0.188, 0.733],
    15: [0.168, 0.68],
    16: [0.174, 0.616],
    17: [0.131, 0.63],
    18: [0.161, 0.552],
    19: [0.126, 0.537],
    20: [0.146, 0.476],
    21: [0.107, 0.444],
    22: [0.122, 0.378],
  },
  'george-rogers-clark': {
    0: [0.896, 0.368],
    1: [0.361, 0.827],
    2: [0.266, 0.637],
    3: [0.144, 0.51],
    4: [0.082, 0.24],
    5: [0.611, 0.173],
    6: [0.182, 0.471],
    7: [0.441, 0.226],
    8: [0.509, 0.225],
    9: [0.575, 0.198],
  },
  'mantle-rock-and-the-trail-of-tears': {
    0: [0.781, 0.75],
    1: [0.691, 0.614],
    2: [0.581, 0.454],
    3: [0.479, 0.359],
    4: [0.441, 0.317],
    5: [0.406, 0.284],
    6: [0.134, 0.266],
  },
}

/**
 * Phone redraws are a different crop, so they get their own fractions.
 * Each value is the route pixel beside that stop's painted label.
 */
const PHONE_MARK = {
  'athiamiowee-the-warriors-path-through-kentucky': {
    0: [0.590, 0.185],
    1: [0.513, 0.273],
    2: [0.441, 0.378],
    3: [0.459, 0.437],
    4: [0.459, 0.488],
    5: [0.455, 0.588],
    6: [0.496, 0.665],
    7: [0.518, 0.740],
    8: [0.504, 0.818],
    9: [0.519, 0.873],
    10: [0.513, 0.950],
  },
  'thomas-walker-and-cumberland-gap': {
    0: [0.735, 0.328],
    3: [0.486, 0.590],
    4: [0.410, 0.736],
    6: [0.237, 0.852],
    7: [0.378, 0.720],
    8: [0.104, 0.743],
    11: [0.456, 0.289],
    13: [0.577, 0.269],
    15: [0.642, 0.253],
    16: [0.688, 0.303],
  },
  'christopher-gist-1750-51': {
    0: [0.791, 0.232],
    3: [0.590, 0.339],
    5: [0.582, 0.244],
    6: [0.190, 0.267],
    7: [0.582, 0.280],
    9: [0.114, 0.405],
    10: [0.279, 0.433],
    12: [0.483, 0.631],
    13: [0.521, 0.690],
    14: [0.562, 0.756],
    15: [0.588, 0.809],
    16: [0.636, 0.870],
  },
  'william-calks-1775-journal': {
    0: [0.951, 0.699],
    1: [0.927, 0.697],
    2: [0.909, 0.695],
    3: [0.881, 0.692],
    4: [0.864, 0.692],
    5: [0.810, 0.722],
    6: [0.797, 0.745],
    7: [0.787, 0.761],
    8: [0.773, 0.781],
    9: [0.759, 0.795],
    10: [0.741, 0.886],
    11: [0.696, 0.879],
    13: [0.674, 0.895],
    14: [0.515, 0.872],
    15: [0.342, 0.882],
    16: [0.444, 0.686],
    17: [0.442, 0.636],
    18: [0.472, 0.522],
    19: [0.474, 0.501],
    21: [0.504, 0.230],
    22: [0.469, 0.205],
  },
  'george-rogers-clark': {
    0: [0.733, 0.312],
    1: [0.222, 0.820],
    3: [0.227, 0.490],
    4: [0.109, 0.228],
    5: [0.577, 0.205],
    6: [0.227, 0.490],
    7: [0.337, 0.269],
    8: [0.488, 0.223],
    9: [0.577, 0.205],
  },
  'mantle-rock-and-the-trail-of-tears': {
    0: [0.769, 0.813],
    1: [0.478, 0.683],
    2: [0.524, 0.453],
    3: [0.485, 0.230],
    4: [0.406, 0.237],
    5: [0.367, 0.237],
    6: [0.205, 0.232],
  },
}

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

function placedPoint(spec, slot, index, stop) {
  const phone = slot.startsWith('phone')
  const table = phone ? PHONE_MARK[spec.slug] : LIGHT_MARK[spec.slug]
  const mark = table && table[index]
  const box = slot === 'desk-dark' ? spec.frame.dark
    : slot === 'zoom-dark' ? spec.frame.zoomDark
    : slot === 'phone-dark' ? spec.frame.phoneDark
    : IDENTITY
  if (mark) {
    return [box.x0 + mark[0] * (box.x1 - box.x0), box.y0 + mark[1] * (box.y1 - box.y0)]
  }
  const frame = phone ? spec.frame.phone : spec.frame.full
  return project(frame, box, stop.geo[1], stop.geo[0])
}

function screenDistance(a, b, viewW, viewH) {
  const dx = (a[0] - b[0]) * viewW
  const dy = (a[1] - b[1]) * viewH
  return Math.hypot(dx, dy)
}

/** Pull a repeated town off the marker already sitting there. */
function separateOverlaps(items, viewW, viewH) {
  const placed = []
  for (const item of items) {
    let x = item.point[0]
    let y = item.point[1]
    let n = 0
    while (n < 6 && placed.some((other) => screenDistance([x, y], other.point, viewW, viewH) < 28)) {
      n += 1
      const stepX = (32 * n) / viewW
      const stepY = (32 * n) / viewH
      x = item.point[0] + (n % 2 === 0 ? -stepX : stepX)
      y = item.point[1] + stepY
    }
    placed.push({ ...item, point: [x, y] })
  }
  return placed
}

/**
 * At a 390px phone slot the Kentucky leg stacks stops on top of each
 * other. Consecutive stops join a range badge only while the whole group
 * stays inside a small stack (about one marker wide and two tall). A route
 * that merely steps along the map stays as separate numbers. Zoom uses the
 * desk slots, so those stay individual.
 */
function clusterPhone(items) {
  const viewW = 350
  const viewH = 197
  const maxW = 40
  const maxH = 56
  const span = (group) => {
    const xs = group.map((item) => item.point[0] * viewW)
    const ys = group.map((item) => item.point[1] * viewH)
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
  }
  const groups = []
  for (const item of items) {
    const prev = groups[groups.length - 1]
    if (prev) {
      const [w, h] = span(prev.concat(item))
      if (w <= maxW && h <= maxH) {
        prev.push(item)
        continue
      }
    }
    groups.push([item])
  }
  return groups.map((group) => {
    if (group.length === 1) return group[0]
    const x = group.reduce((sum, item) => sum + item.point[0], 0) / group.length
    const y = group.reduce((sum, item) => sum + item.point[1], 0) / group.length
    const first = group[0].number
    const last = group[group.length - 1].number
    return {
      point: [x, y],
      number: first,
      label: `${first}\u2013${last}`,
      conjectural: group.every((item) => item.conjectural),
      cluster: true,
    }
  })
}

function markerSpan(item) {
  const left = (item.point[0] * 100).toFixed(1)
  const top = (item.point[1] * 100).toFixed(1)
  const classes = ['route-stop']
  if (item.cluster) classes.push('route-stop-cluster')
  else if (item.conjectural) classes.push('route-stop-conjectural')
  const label = item.label || String(item.number)
  return `<span class="${classes.join(' ')}" style="left:${left}%;top:${top}%" data-n="${label}"></span>`
}

function slotHtml(name, spec, route) {
  const phone = name.startsWith('phone')
  const viewW = phone ? 350 : 820
  const viewH = phone ? 197 : 460
  let items = []
  const table = phone ? PHONE_MARK[spec.slug] : LIGHT_MARK[spec.slug]
  route.stops.forEach((stop, index) => {
    // A stop with no coordinate is shown only where it has a painted-line slot.
    if (!stop.geo && !(table && table[index])) return
    items.push({
      point: placedPoint(spec, name, index, stop),
      number: index + 1,
      conjectural: Boolean(stop.conjectural),
      cluster: false,
    })
  })
  if (phone) items = clusterPhone(items)
  items = separateOverlaps(items, viewW, viewH)
  return `<div class="route-map-overlay" data-frame="${name}" aria-hidden="true">${items.map(markerSpan).join('')}</div>`
}

/** Five aligned overlays: desk light, desk dark, zoom dark, phone light, phone dark. */
export function routeMapOverlayHtml(route) {
  const frame = ROUTE_FRAMES[route.slug]
  if (!frame) return ''
  const spec = { slug: route.slug, frame }
  return [
    slotHtml('desk-light', spec, route),
    slotHtml('desk-dark', spec, route),
    slotHtml('zoom-dark', spec, route),
    slotHtml('phone-light', spec, route),
    slotHtml('phone-dark', spec, route),
  ].join('')
}
