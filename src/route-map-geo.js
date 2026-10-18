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

import { ROUTE_MAP_LABELS } from './route-map-labels.js'

const IDENTITY = { x0: 0, y0: 0, x1: 1, y1: 1 }
/** Badge diameter and the slot sizes (px) the layout is solved for. */
export const BADGE = 26
export const DESK_VIEW = [820, 460]
export const PHONE_VIEW = [350, 197]

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
    1: [0.445, 0.222],
    // 3 and 4 anchor to their painted rings. The painting puts the Red River
    // ring a little north of Eskippakithiki (a repaint is its own ticket).
    2: [0.39, 0.314],
    3: [0.384, 0.277],
    4: [0.393, 0.352],
    5: [0.393, 0.388],
    6: [0.429, 0.487],
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

/**
 * Hand-picked badge spots (by stop number) where the painting is too
 * crowded for the automatic step-out: the badge sits clear of every label
 * and keeps a leader to its point. Light-image (or phone-image) fractions.
 */
const BADGE_AT = {
  'athiamiowee-the-warriors-path-through-kentucky': {
    2: [0.44, 0.241],
    3: [0.45, 0.324],
    4: [0.405, 0.241],
    5: [0.389, 0.352],
    6: [0.41, 0.42],
    7: [0.48, 0.488],
    8: [0.395, 0.485],
    9: [0.4, 0.5625],
    10: [0.41, 0.64],
    11: [0.365, 0.86],
  },
}
const PHONE_BADGE_AT = {}

/**
 * Phone crops that show only the Kentucky leg: stops off the crop pin to the
 * map edge (image fractions, by stop number) instead of sitting by an
 * unrelated painted label. Gist 1–5 come from the northeast (Maryland,
 * Pennsylvania, the Muskingum) and 7 is Pickawillany, north of the Ohio.
 */
const PHONE_PIN = {
  'christopher-gist-1750-51': {
    // 1–5 on the east edge, below the Expand button; 7 on the north edge,
    // between the title and the button.
    1: [1, 0.34], 2: [1, 0.34], 3: [1, 0.34], 4: [1, 0.34], 5: [1, 0.34],
    7: [0.6, 0],
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

/** Badge as a capsule in view pixels: center, half straight length, radius. */
function badgeShape(item, viewW, viewH) {
  const text = item.label || String(item.number)
  const w = item.cluster ? Math.max(BADGE, 14 + 7.2 * text.length) : BADGE
  return { x: item.point[0] * viewW, y: item.point[1] * viewH, h: (w - BADGE) / 2, r: BADGE / 2 }
}

function segRectDist(x0, x1, y, rect) {
  // Distance from the horizontal segment (x0..x1, y) to an axis-aligned box.
  const dy = y < rect[1] ? rect[1] - y : y > rect[3] ? y - rect[3] : 0
  const dx = x1 < rect[0] ? rect[0] - x1 : x0 > rect[2] ? x0 - rect[2] : 0
  return Math.hypot(dx, dy)
}

function segSegDist(a, b) {
  // Two horizontal segments.
  const dx = Math.max(0, Math.max(a.x - a.h, b.x - b.h) - Math.min(a.x + a.h, b.x + b.h))
  return Math.hypot(dx, a.y - b.y)
}

/** Does the segment a-b pass through the box (beyond its first few px)? */
function segHitsRect(a, b, rect) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  for (let t = Math.min(1, 5 / (len || 1)); t <= 1; t += 2 / (len || 1)) {
    const x = a[0] + t * (b[0] - a[0])
    const y = a[1] + t * (b[1] - a[1])
    if (x > rect[0] && x < rect[2] && y > rect[1] && y < rect[3]) return true
  }
  return false
}

/** Clearance (px) between a badge and a label box; below 0 means they overlap. */
export function badgeLabelGap(shape, rect) {
  return segRectDist(shape.x - shape.h, shape.x + shape.h, shape.y, rect) - shape.r
}

/** Clearance (px) between two badges; below 0 means they overlap. */
export function badgeBadgeGap(a, b) {
  return segSegDist(a, b) - a.r - b.r
}

/**
 * Keep every badge clear of the painted labels (fixed obstacles) and of the
 * badges before it. A badge stays on its point when it can; otherwise it
 * steps out on the nearest free spot, travelling in stop order, and keeps a
 * leader back to the point. Labels are light-image (or phone-image)
 * fractions; positions are returned as fractions of the same image.
 */
function placeBadges(items, labels, viewW, viewH, prefer = {}) {
  const rects = (labels || []).map((l) => [l[0] * viewW, l[1] * viewH, l[2] * viewW, l[3] * viewH])
  const placed = []
  // Keep 4px of air: OCR boxes can clip a first letter.
  const gap = viewW < 400 ? 4 : 0.5
  const cost = (shape, from) => {
    let bad = 0
    // A leader may not run across a label either.
    if (from) for (const rect of rects) if (segHitsRect(from, [shape.x, shape.y], rect)) bad += 0.25
    for (const rect of rects) bad += Math.max(0, gap - badgeLabelGap(shape, rect))
    for (const other of placed) bad += Math.max(0, gap - badgeBadgeGap(shape, other.shape))
    const edge = Math.min(shape.x - shape.h - shape.r, viewW - shape.x - shape.h - shape.r, shape.y - shape.r, viewH - shape.y - shape.r)
    if (edge < 0) bad -= edge
    return bad
  }
  return items.map((item) => {
    const at = badgeShape(item, viewW, viewH)
    const want = prefer[item.number]
    // A hand-picked spot (BADGE_AT) is where the search starts.
    const base = want ? { ...at, x: want[0] * viewW, y: want[1] * viewH } : at
    let best = { shape: base, bad: cost(base, want ? [at.x, at.y] : null), r: want ? Math.hypot(base.x - at.x, base.y - at.y) : 0 }
    if (globalThis.__badgeDebug && want) globalThis.__badgeDebug(item.number, best.bad, rects.map((r, i) => [i, +badgeLabelGap(base, r).toFixed(2)]).filter((x) => x[1] < 1), placed.map((o) => +badgeBadgeGap(base, o.shape).toFixed(1)).filter((g) => g < 1))
    if (best.bad > 0) {
      for (let r = 3; r <= 96 && best.bad > 0; r += 3) {
        for (let k = 0; k < 24; k++) {
          const a = (k * Math.PI) / 12
          const shape = { ...base, x: base.x + r * Math.cos(a), y: base.y + r * Math.sin(a) }
          const bad = cost(shape, [at.x, at.y])
          if (bad < best.bad - 1e-9) best = { shape, bad, r: Math.hypot(shape.x - at.x, shape.y - at.y) }
        }
      }
    }
    const out = {
      ...item,
      anchor: item.point,
      point: [best.shape.x / viewW, best.shape.y / viewH],
      leader: best.r >= 6,
    }
    placed.push({ shape: best.shape })
    return out
  })
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
    if (prev && Boolean(prev[0].pinned) === Boolean(item.pinned)) {
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

function pct(v) {
  return (v * 100).toFixed(1)
}

function markerSpan(item) {
  const classes = ['route-stop']
  if (item.cluster) classes.push('route-stop-cluster')
  else if (item.conjectural) classes.push('route-stop-conjectural')
  const label = item.label || String(item.number)
  return `<span class="${classes.join(' ')}" style="left:${pct(item.point[0])}%;top:${pct(item.point[1])}%" data-n="${label}" data-at="${pct(item.anchor[0])},${pct(item.anchor[1])}"></span>`
}

/** Short leaders from a stepped-out badge back to its point on the painted line. */
function leaderSvg(items) {
  const lines = items.filter((item) => item.leader)
  if (!lines.length) return ''
  return `<svg class="route-stop-leaders" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">${lines
    .map((item) => `<line vector-effect="non-scaling-stroke" x1="${pct(item.anchor[0])}" y1="${pct(item.anchor[1])}" x2="${pct(item.point[0])}" y2="${pct(item.point[1])}"/>`)
    .join('')}</svg>`
}

/**
 * Badge layout for one image (desk light or phone light), in fractions of
 * that image. Dark and zoom slots reuse it through their inset boxes.
 */
export function routeMapLayout(route, kind = 'desk') {
  const frame = ROUTE_FRAMES[route.slug]
  if (!frame) return []
  const spec = { slug: route.slug, frame }
  const phone = kind === 'phone'
  const slot = phone ? 'phone-light' : 'desk-light'
  const viewW = phone ? PHONE_VIEW[0] : DESK_VIEW[0]
  const viewH = phone ? PHONE_VIEW[1] : DESK_VIEW[1]
  const table = phone ? PHONE_MARK[spec.slug] : LIGHT_MARK[spec.slug]
  const pins = phone ? PHONE_PIN[spec.slug] || {} : {}
  let items = []
  route.stops.forEach((stop, index) => {
    const number = index + 1
    const base = { number, conjectural: Boolean(stop.conjectural), cluster: false }
    if (pins[number]) {
      // Off this crop: the badge pins to the map edge and its leader runs to
      // the edge, pointing the way the route goes.
      items.push({ ...base, point: pins[number], pinned: true })
      return
    }
    // A stop with no coordinate and no painted-line slot is filled in below.
    if (!stop.geo && !(table && table[index])) {
      items.push({ ...base, point: null })
      return
    }
    items.push({ ...base, point: placedPoint(spec, slot, index, stop) })
  })
  // Every number appears: a stop with no point of its own sits on the line
  // between its neighbours (or joins their range badge on a phone).
  items.forEach((item, i) => {
    if (item.point) return
    const before = items.slice(0, i).reverse().find((o) => o.point && !o.pinned)
    const after = items.slice(i + 1).find((o) => o.point && !o.pinned)
    const a = before || after
    const b = after || before
    item.point = a ? [(a.point[0] + b.point[0]) / 2, (a.point[1] + b.point[1]) / 2] : [0.5, 0.5]
  })
  if (phone) items = clusterPhone(items)
  const labels = ROUTE_MAP_LABELS[route.slug]?.[phone ? 'phone' : 'light']
  return placeBadges(items, labels, viewW, viewH, (phone ? PHONE_BADGE_AT : BADGE_AT)[route.slug])
}

function slotHtml(name, route, layouts) {
  const frame = ROUTE_FRAMES[route.slug]
  const phone = name.startsWith('phone')
  const box = name === 'desk-dark' ? frame.dark
    : name === 'zoom-dark' ? frame.zoomDark
    : name === 'phone-dark' ? frame.phoneDark
    : IDENTITY
  const map = (p) => [box.x0 + p[0] * (box.x1 - box.x0), box.y0 + p[1] * (box.y1 - box.y0)]
  const items = layouts[phone ? 'phone' : 'desk'].map((item) => ({ ...item, point: map(item.point), anchor: map(item.anchor) }))
  const dots = items.filter((item) => item.leader).map((item) => `<i class="route-stop-dot" style="left:${pct(item.anchor[0])}%;top:${pct(item.anchor[1])}%"></i>`).join('')
  return `<div class="route-map-overlay" data-frame="${name}" aria-hidden="true">${leaderSvg(items)}${dots}${items.map(markerSpan).join('')}</div>`
}

/** Five aligned overlays: desk light, desk dark, zoom dark, phone light, phone dark. */
export function routeMapOverlayHtml(route) {
  const frame = ROUTE_FRAMES[route.slug]
  if (!frame) return ''
  const layouts = { desk: routeMapLayout(route, 'desk'), phone: routeMapLayout(route, 'phone') }
  return ['desk-light', 'desk-dark', 'zoom-dark', 'phone-light', 'phone-dark'].map((name) => slotHtml(name, route, layouts)).join('')
}
