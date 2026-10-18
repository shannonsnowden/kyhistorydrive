#!/usr/bin/env node
/**
 * check-route-order: numbered stops must follow the route line.
 *
 * Each stop is projected onto its route polyline and must land at a later
 * distance along the line than the stop before it (within a tolerance).
 * Projection walks forward: stop i is placed on the nearest part of the line
 * at or after stop i-1. If some earlier part of the line is much nearer than
 * that forward placement, the number backtracks and the check fails. This
 * handles loops and out-and-back legs without special cases; the ALLOW list
 * below is only for a route whose order is justified despite a backtrack.
 *
 * Also checked: stop 1 sits at the start of the line and the last stop at
 * its end (a clear start and end), and no two numbered badges overlap.
 *
 * Sources:
 *  - Drive pages: public/drives/<slug>/index.html STOPS (number = index + 1)
 *    against the OSRM line in the JSON that page fetches.
 *  - Story route maps: src/route-maps.js stops placed by src/route-map-geo.js
 *    against the painted red line traced in scripts/route-map-lines.json
 *    (light-image fractions). Badge spacing, labels, painted route arrows and
 *    the frame are checked in all four theme slots (1280 and 390, light and
 *    dark), each on its own art size, and light and dark must place every
 *    badge at the same pixel offset. The desk slots are checked at DESK_VIEW
 *    (820px), narrower than any story map at 1280 (914 or 1152px), so a pass
 *    holds at every 1280 width (badges are fixed px; positions scale up).
 *
 * `node scripts/check-route-order.mjs --self-test` proves the check fails on
 * deliberately broken fixtures.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spreadBadges, labelBox } from '../public/drives/badge-spread.js'
import { ROUTE_MAP_LABELS } from '../src/route-map-labels.js'
import { BADGE, DESK_VIEW, PHONE_VIEW, PILL_PAD, PILL_CHAR, DARK_ASPECT, ROUTE_FRAMES, badgeLabelGap, badgeBadgeGap, leaderBadgeGap, frameInset, isAreaLabel } from '../src/route-map-geo.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Justified exceptions: { 'kind:slug': { stops: [numbers], reason } } */
export const ALLOW = {
  'route:athiamiowee-the-warriors-path-through-kentucky': {
    stops: [4],
    reason:
      "Badges 3 and 4 anchor to their painted rings, and the painting puts the Red River ring a little north of the Eskippakithiki ring (the coordinates say the reverse). The numbers keep travel order; a repaint is its own ticket.",
  },
  'route:george-rogers-clark': {
    stops: [6, 7],
    reason:
      'Stop 6 (Vincennes, July 1778) was won over by Father Gibault and Leonard Helm, so the painting draws no 1778 line to it; its badge sits beside the Vincennes dot. Stop 7 then restarts at Kaskaskia for the 1779 winter march, which is the only line into Vincennes.',
  },
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

function segProject(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const q = [a[0] + t * dx, a[1] + t * dy]
  return { t, d: dist(p, q) }
}

/** Measure along the polyline; returns cumulative lengths. */
function cumulative(line) {
  const cum = [0]
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + dist(line[i - 1], line[i]))
  return cum
}

function nearest(line, cum, p, fromPos = -Infinity, slack = 0) {
  const cands = []
  for (let i = 1; i < line.length; i++) {
    if (cum[i] < fromPos) continue
    const { t, d } = segProject(p, line[i - 1], line[i])
    let pos = cum[i - 1] + t * (cum[i] - cum[i - 1])
    let dd = d
    if (pos < fromPos) {
      pos = fromPos
      const a = line[i - 1]
      const b = line[i]
      const f = (fromPos - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
      dd = dist(p, [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])])
    }
    cands.push({ pos, d: dd })
  }
  if (!cands.length) return null
  const minD = Math.min(...cands.map((c) => c.d))
  // Earliest pass that is about as near as the nearest one: on a loop or an
  // out-and-back the line passes a stop twice, and travel takes the first.
  return cands.find((c) => c.d <= minD + slack)
}

/**
 * stops: [{ n, name, p:[x,y] }], line: [[x,y]...] in the same planar units.
 * opts.near: how far off the line a stop may sit and still count as on it.
 * opts.badge: minimum spacing between numbered badges (0 = skip).
 * opts.ends: require first/last stop at the line's ends, within this length fraction.
 */
export function checkOrder({ id, stops, line, near, badge = 0, badgeAt = null, ends = 0.12, allow = ALLOW[id] }) {
  const errs = []
  const cum = cumulative(line)
  const total = cum[cum.length - 1]
  const tol = Math.max(near * 0.5, total * 0.002)
  const ok = new Set(allow?.stops || [])
  let prev = 0
  const placed = []
  stops.forEach((s, idx) => {
    const fwd = nearest(line, cum, s.p, prev - tol, near * 0.5)
    const glob = nearest(line, cum, s.p)
    if (!fwd) {
      errs.push(`${id}: stop ${s.n} (${s.name}) has no line left after stop ${stops[idx - 1]?.n}`)
      return
    }
    const limit = s.coarse ? Math.max(near * 2, s.coarse) : near * 2
    if (glob.d > limit && !ok.has(s.n)) errs.push(`${id}: stop ${s.n} (${s.name}) is ${glob.d.toFixed(3)} off the route line (limit ${limit.toFixed(3)})`)
    // A much nearer point earlier on the line = this number jumps back.
    if (fwd.d > glob.d + near && glob.pos < prev - tol && ok.has(s.n)) {
      // Allowed restart (see ALLOW): carry on from where this stop really is.
      placed.push({ s, pos: glob.pos })
      prev = glob.pos
      return
    }
    if (fwd.d > glob.d + near && glob.pos < prev - tol) {
      errs.push(`${id}: stop ${s.n} (${s.name}) backtracks: it lies on the line before stop ${stops[idx - 1].n} (at ${(glob.pos / total * 100).toFixed(1)}% vs ${(prev / total * 100).toFixed(1)}%)`)
      placed.push({ s, pos: glob.pos })
      return
    }
    placed.push({ s, pos: fwd.pos })
    prev = Math.max(prev, fwd.pos)
  })
  const closed = dist(line[0], line[line.length - 1]) < near * 2
  if (ends && placed.length) {
    const first = placed[0]
    const last = placed[placed.length - 1]
    if (first.pos > total * ends) errs.push(`${id}: stop ${first.s.n} is not at the start of the line (${(first.pos / total * 100).toFixed(1)}% along)`)
    if (!closed && last.pos < total * (1 - ends)) errs.push(`${id}: last stop ${last.s.n} is not at the end of the line (${(last.pos / total * 100).toFixed(1)}% along)`)
  }
  if (badge) {
    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const a = badgeAt ? badgeAt[i] : stops[i].p
        const b = badgeAt ? badgeAt[j] : stops[j].p
        if (dist(a, b) < badge) errs.push(`${id}: badges ${stops[i].n} and ${stops[j].n} overlap`)
      }
    }
  }
  return { errs, positions: placed.map((x) => +(x.pos / (total || 1)).toFixed(3)) }
}

/* ---------- drive pages ---------- */

function driveStops(html) {
  const m = html.match(/const STOPS = \[([\s\S]*?)\n\]\n/)
  if (!m) return null
  const out = []
  const re = /\{\s*id:\s*['"]([^'"]+)['"]\s*,\s*name:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*,\s*lat:\s*(-?[\d.]+)\s*,\s*lon:\s*(-?[\d.]+)/g
  let r
  while ((r = re.exec(m[1]))) out.push({ id: r[1], name: r[2].slice(1, -1), lat: +r[3], lon: +r[4], coarse: !/\.\d{2}/.test(r[3]) || !/\.\d{2}/.test(r[4]) })
  return out
}

/** Equirectangular km around the route's mean latitude. */
function planar(lat0) {
  const k = Math.cos((lat0 * Math.PI) / 180)
  return (lon, lat) => [lon * 111.32 * k, lat * 110.57]
}

export function checkDrives({ only = null, mutate = null } = {}) {
  const dir = path.join(root, 'public/drives')
  const rows = []
  for (const slug of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, slug, 'index.html')
    if (!fs.existsSync(file) || slug === 'routes' || (only && slug !== only)) continue
    const html = fs.readFileSync(file, 'utf8')
    const stops = driveStops(html)
    if (!stops) continue
    const errs0 = []
    if (mutate) mutate(stops)
    const src = html.match(/fetch\('(\/drives\/(?!ky-base|ky-places)[^']+\.json)'\)/)
    if (!src) {
      rows.push({ kind: 'drive', slug, errs: [`drive:${slug}: no route line found`] })
      continue
    }
    const data = JSON.parse(fs.readFileSync(path.join(root, 'public', src[1]), 'utf8'))
    const raw = data.line
    const lat0 = raw.reduce((s, p) => s + p[1], 0) / raw.length
    const pj = planar(lat0)
    const line = raw.map(([lon, lat]) => pj(lon, lat))
    const xs = line.map((p) => p[0]).concat(stops.map((s) => pj(s.lon, s.lat)[0]))
    const ys = line.map((p) => p[1]).concat(stops.map((s) => pj(s.lon, s.lat)[1]))
    // Page map: 4:3 viewBox, badge radius 5.2 of a 260-wide view.
    const w = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 4 / 3)
    const wView = w * (1 + 12 / 260)
    // Badge/label layout exactly as the page draws it (ky-base.json projection,
    // 4:3 view, k = w / 260), on the desktop map (600px) and a 390px phone
    // (324px map, badges at least 20px across).
    const P = JSON.parse(fs.readFileSync(path.join(root, 'public/drives/ky-base.json'), 'utf8')).proj
    const proj = (lon, lat) => [(lon - P.LON0) * P.K * P.SC, (P.LAT1 - lat) * P.SC]
    const lp = raw.map(([lon, lat]) => proj(lon, lat))
    const sp = stops.map((s) => proj(s.lon, s.lat))
    const all = lp.concat(sp)
    const pxs = all.map((q) => q[0]), pys = all.map((q) => q[1])
    let vw = Math.max(...pxs) - Math.min(...pxs) + 12, vh = Math.max(...pys) - Math.min(...pys) + 12
    if (vw / vh < 4 / 3) vw = vh * 4 / 3
    const k = vw / 260
    const lblM = html.match(/\nconst lbl = (\[.*?\])\n/)
    const lbl = lblM ? JSON.parse(lblM[1].replace(/'/g, '"')) : []
    const boxes = lbl.map(([n, lon, lat]) => { const [x, y] = proj(lon, lat); return [...labelBox(x, y, n, k), n] })
    const spread = /import \{ spreadBadges, labelBox \} from '\/drives\/badge-spread\.js'/.test(html)
    const layouts = [600, 324].map((px) => {
      const u = vw / px
      const br = Math.max(5.2 * k, 10 * u)
      const at = spread ? spreadBadges(sp, 2 * br + 0.6 * k, boxes.map((b) => b.slice(0, 4)), 2.2 * br) : sp
      return { px, br, at }
    })
    for (const { px, br, at } of layouts) {
      at.forEach((q, i) => {
        for (const b of boxes) {
          const dx = q[0] - Math.max(b[0], Math.min(q[0], b[2]))
          const dy = q[1] - Math.max(b[1], Math.min(q[1], b[3]))
          if (Math.hypot(dx, dy) < br * 0.98) errs0.push(`drive:${slug} (${px}px map): badge ${i + 1} covers the label "${b[4]}"`)
        }
        const off = Math.hypot(q[0] - sp[i][0], q[1] - sp[i][1])
        if (off > 0.3 * k && off < 1.6 * br) errs0.push(`drive:${slug} (${px}px map): badge ${i + 1} moved off its stop but its leader is hidden under it`)
        for (let j = i + 1; j < at.length; j++) if (Math.hypot(q[0] - at[j][0], q[1] - at[j][1]) < 2 * br * 0.98) errs0.push(`drive:${slug} (${px}px map): badges ${i + 1} and ${j + 1} overlap`)
      })
    }
    // Back into the planar frame for the order check: a badge's offset from its stop.
    const pts = stops.map((s) => pj(s.lon, s.lat))
    const kmPerUnit = w / vw
    const shownP = layouts[0].at.map((q, i) => [pts[i][0] + (q[0] - sp[i][0]) * kmPerUnit, pts[i][1] - (q[1] - sp[i][1]) * kmPerUnit])
    const shown = shownP
    const res = checkOrder({
      id: `drive:${slug}`,
      badgeAt: shown,
      // Protected sites are published at 0.1 degree, up to ~8 km from the road.
      stops: stops.map((s, i) => ({ n: i + 1, name: s.name, p: pj(s.lon, s.lat), coarse: s.coarse ? 8 : 0 })),
      line,
      near: Math.max(1.5, w * 0.02),
      // Badges are 10.4 units across in a 260-unit view; flag centers closer than ~80% of that.
      badge: (wView * 8.5) / 260,
    })
    rows.push({ kind: 'drive', slug, stops: stops.length, ...res, errs: errs0.concat(res.errs || []) })
  }
  return rows
}

/* ---------- story route maps ---------- */

/**
 * Badges as drawn in one slot of the overlay markup, in 16x9 units of the
 * painting: p = the point on the painted line the stop belongs to (data-at),
 * b = where the badge is drawn (it can step out with a leader).
 */
const overlayCache = new Map()
export function storyMarks(route, { routeMapOverlayHtml }, frame = 'desk-light') {
  const key = routeMapOverlayHtml
  if (!overlayCache.has(key)) overlayCache.set(key, new Map())
  const per = overlayCache.get(key)
  if (!per.has(route)) per.set(route, routeMapOverlayHtml(route))
  const html = per.get(route)
  const slot = html.match(new RegExp(`data-frame="${frame}"[^>]*>(.*?)<\\/div>`))[1]
  return [...slot.matchAll(/class="([^"]+)" style="left:([\d.-]+)%;top:([\d.-]+)%" data-n="([^"]+)" data-at="([\d.-]+),([\d.-]+)"(?: data-pt="([\d.-]+),([\d.-]+)")?/g)].map((m) => ({
    n: parseInt(m[4], 10),
    label: m[4],
    cluster: m[1].includes('route-stop-cluster'),
    name: route.stops[parseInt(m[4], 10) - 1]?.stop,
    p: [(+m[5] / 100) * 16, (+m[6] / 100) * 9],
    b: [(+m[2] / 100) * 16, (+m[3] / 100) * 9],
    pt: m[7] ? [(+m[7] / 100) * 16, (+m[8] / 100) * 9] : null,
  }))
}

/**
 * Badge-label overlaps for one slot. view = slot size in px; labels are
 * [l, t, r, b, name] image fractions. Returns error strings.
 */
export function labelOverlaps(id, marks, labels, view, { badge = BADGE } = {}) {
  const errs = []
  const [vw, vh] = view
  const shapes = marks.map((m) => {
    const w = m.cluster ? Math.max(badge, PILL_PAD + PILL_CHAR * m.label.length) : badge
    return { m, x: (m.b[0] / 16) * vw, y: (m.b[1] / 9) * vh, h: (w - badge) / 2, r: badge / 2 }
  })
  const [mx, my] = frameInset(vw, vh)
  for (const s of shapes) {
    // Inside the painted frame: never clipped by the image edge.
    const out = Math.max(mx - (s.x - s.h - s.r), s.x + s.h + s.r - (vw - mx), my - (s.y - s.r), s.y + s.r - (vh - my))
    if (out > 0.5) errs.push(`${id}: badge ${s.m.label} runs ${out.toFixed(1)}px past the map frame`)
    const dot = [(s.m.p[0] / 16) * vw, (s.m.p[1] / 9) * vh]
    const moved = Math.hypot(dot[0] - s.x, dot[1] - s.y) >= 6
    // A stepped-out badge must show its leader and dot: the dot sits clear of the badge.
    if (moved) { const show = Math.hypot(Math.max(0, Math.abs(dot[0] - s.x) - s.h), dot[1] - s.y) - s.r; if (show < 6) errs.push(`${id}: badge ${s.m.label}'s leader is hidden under it (dot ${show.toFixed(1)}px from its edge)`) }
    for (const l of labels || []) {
      const rect = [l[0] * vw, l[1] * vh, l[2] * vw, l[3] * vh]
      if (moved && dot[0] > rect[0] && dot[0] < rect[2] && dot[1] > rect[1] && dot[1] < rect[3]) errs.push(`${id}: badge ${s.m.label}'s leader dot sits on the label "${l[4]}"`)
      if (moved && !isAreaLabel(l[4])) {
        // The leader, from its dot to the badge edge, may not cross a label.
        const len = Math.hypot(s.x - dot[0], s.y - dot[1])
        for (let t = 4 / len; t < 1 - (s.r + 1) / len; t += 1 / len) {
          const x = dot[0] + t * (s.x - dot[0])
          const y = dot[1] + t * (s.y - dot[1])
          if (x > rect[0] && x < rect[2] && y > rect[1] && y < rect[3]) { errs.push(`${id}: badge ${s.m.label}'s leader crosses the label "${l[4]}"`); break }
        }
      }
      const gap = badgeLabelGap(s, rect)
      if (gap < 0) errs.push(`${id}: badge ${s.m.label} covers the label "${l[4]}" (${(-gap).toFixed(1)}px)`)
    }
  }
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      // Touching counts: badges need 6px of air between them, the same floor the placer uses.
      if (badgeBadgeGap(shapes[i], shapes[j]) < 6) errs.push(`${id}: badges ${shapes[i].m.label} and ${shapes[j].m.label} touch or overlap`)
    }
  }
  // A leader never crosses or grazes a badge that isn't its own (4px of air at least).
  for (const s of shapes) {
    const dot = [(s.m.p[0] / 16) * vw, (s.m.p[1] / 9) * vh]
    if (Math.hypot(dot[0] - s.x, dot[1] - s.y) < 6) continue
    for (const o of shapes) {
      if (o === s) continue
      const g = leaderBadgeGap(dot, [s.x, s.y], o)
      if (g < 4) errs.push(`${id}: badge ${s.m.label}'s leader ${g < 0 ? 'crosses' : 'grazes'} badge ${o.m.label} (${g.toFixed(1)}px)`)
    }
  }
  return errs
}

/** Traced segments are in travel order; join them into one path. */
export function storyLine(traced) {
  return traced.segments.map((seg) => seg.map(([x, y]) => [x * 16, y * 9])).flat()
}

export async function checkStoryMaps({ lines } = {}) {
  const { ROUTE_MAPS } = await import(pathToFileURL(path.join(root, 'src/route-maps.js')).href)
  const { routeMapOverlayHtml } = await import(pathToFileURL(path.join(root, 'src/route-map-geo.js')).href)
  lines = lines || JSON.parse(fs.readFileSync(path.join(root, 'scripts/route-map-lines.json'), 'utf8'))
  const rows = []
  for (const route of ROUTE_MAPS) {
    const traced = lines[route.slug]
    if (!traced) {
      rows.push({ kind: 'route', slug: route.slug, errs: [`route:${route.slug}: no traced line in scripts/route-map-lines.json`] })
      continue
    }
    const marks = storyMarks(route, { routeMapOverlayHtml })
    const errs = []
    const labels = ROUTE_MAP_LABELS[route.slug] || {}
    if (!labels.light) errs.push(`route:${route.slug}: no label boxes in src/route-map-labels.js`)
    // Every theme slot is checked on its own art: the dark images are taller
    // (DARK_ASPECT) and register the light frame through an inset box, so their
    // labels (and painted route arrows, merged into the label lists) move with it.
    const fr = ROUTE_FRAMES[route.slug]
    const through = (box, list) => (list || []).map((l) => [box.x0 + l[0] * (box.x1 - box.x0), box.y0 + l[1] * (box.y1 - box.y0), box.x0 + l[2] * (box.x1 - box.x0), box.y0 + l[3] * (box.y1 - box.y0), l[4]])
    const slots = [
      ['desk-light', '1280 light', labels.light, DESK_VIEW],
      ['desk-dark', '1280 dark', fr && through(fr.dark, labels.light), [DESK_VIEW[0], DESK_VIEW[0] * DARK_ASPECT.desk]],
      ['phone-light', '390 light', labels.phone, PHONE_VIEW],
      ['phone-dark', '390 dark', fr && through(fr.phoneDark, labels.phone), [PHONE_VIEW[0], PHONE_VIEW[0] * DARK_ASPECT.phone]],
    ]
    for (const [slot, tag, list, view] of slots) {
      // Fail closed: a slot must exist in the markup.
      let sm
      try { sm = storyMarks(route, { routeMapOverlayHtml }, slot) } catch { errs.push(`route:${route.slug}: no ${slot} overlay`); continue }
      errs.push(...labelOverlaps(`route:${route.slug} (${tag})`, sm, list, view))
    }
    // Same placement in light and dark: each badge keeps the same pixel offset from its dot.
    for (const [a, b, view, darkView, tag] of [['desk-light', 'desk-dark', DESK_VIEW, [DESK_VIEW[0], DESK_VIEW[0] * DARK_ASPECT.desk], '1280'], ['phone-light', 'phone-dark', PHONE_VIEW, [PHONE_VIEW[0], PHONE_VIEW[0] * DARK_ASPECT.phone], '390']]) {
      const L = storyMarks(route, { routeMapOverlayHtml }, a)
      const D = storyMarks(route, { routeMapOverlayHtml }, b)
      L.forEach((m, i) => {
        const d = D[i]
        if (!d || d.label !== m.label) { errs.push(`route:${route.slug} (${tag}): light and dark show different badges`); return }
        // Offsets in px: badge minus the stop's own spot (data-pt).
        const off = (q, v) => { const o = q.pt || q.p; return [((q.b[0] - o[0]) / 16) * v[0], ((q.b[1] - o[1]) / 9) * v[1]] }
        const [lx, ly] = off(m, view)
        const [dx, dy] = off(d, darkView)
        if (Math.hypot(lx - dx, ly - dy) > 4) errs.push(`route:${route.slug} (${tag}): badge ${m.label} sits ${Math.hypot(lx - dx, ly - dy).toFixed(1)}px differently in dark than light`)
      })
    }
    if (!labels.phone) errs.push(`route:${route.slug}: no phone label boxes in src/route-map-labels.js`)
    // Every stop number shows at 390, alone or inside a range badge like 2–3.
    const phoneMarks = storyMarks(route, { routeMapOverlayHtml }, 'phone-light')
    const covered = new Set()
    for (const m of phoneMarks) {
      const [a, b = a] = m.label.split('\u2013').map((v) => parseInt(v, 10))
      for (let n = a; n <= b; n++) covered.add(n)
    }
    const missing = route.stops.map((_, i) => i + 1).filter((n) => !covered.has(n))
    if (missing.length) errs.push(`route:${route.slug} (390): stop number(s) ${missing.join(', ')} not shown`)
    const numbers = marks.map((m) => m.n)
    const want = route.stops.map((_, i) => i + 1)
    if (numbers.join() !== want.join()) errs.push(`route:${route.slug}: map shows ${numbers.join(',')} but the list has 1–${want.length}`)
    const line = storyLine(traced)
    const res = checkOrder({ id: `route:${route.slug}`, stops: marks, line, near: 0.25 })
    rows.push({ kind: 'route', slug: route.slug, stops: route.stops.length, errs: errs.concat(res.errs), positions: res.positions })
  }
  return rows
}

/* ---------- self test ---------- */

async function selfTest() {
  const line = [[0, 0], [10, 0], [10, 10], [0, 10]]
  const good = [[0, 0], [5, 0], [10, 5], [5, 10], [0, 10]].map((p, i) => ({ n: i + 1, name: `s${i + 1}`, p }))
  const cases = [
    ['in order', good, 0],
    ['two swapped', [good[0], good[2], good[1], good[3], good[4]].map((s, i) => ({ ...s, n: i + 1 })), 1],
    ['reversed', [...good].reverse().map((s, i) => ({ ...s, n: i + 1 })), 1],
    ['ends early', good.slice(0, 3), 1],
    ['stop off the line', [...good.slice(0, 2), { n: 3, name: 'far', p: [20, 20] }, ...good.slice(3)].map((s, i) => ({ ...s, n: i + 1 })), 1],
    ['overlapping badges', [good[0], { ...good[1], p: [5, 0] }, { ...good[1], n: 3, p: [5.05, 0] }, good[3], good[4]].map((s, i) => ({ ...s, n: i + 1 })), 1],
  ]
  // Out-and-back: line returns along itself; the forward walk keeps it in order.
  const ob = [[0, 0], [10, 0], [0, 0.01]]
  const obStops = [[0, 0], [5, 0], [10, 0], [5, 0.01], [0, 0.01]].map((p, i) => ({ n: i + 1, name: `o${i + 1}`, p }))
  let failed = 0
  for (const [name, stops, wantErr] of cases) {
    const { errs } = checkOrder({ id: `fixture:${name}`, stops, line, near: 0.5, badge: name === 'overlapping badges' ? 0.5 : 0, allow: null })
    const got = errs.length ? 1 : 0
    console.log(`${got === wantErr ? 'ok  ' : 'FAIL'} ${name}: ${errs.length ? errs.join(' | ') : 'passes'}`)
    if (got !== wantErr) failed++
  }
  // Real data, deliberately broken: the Gist map with two badges swapped,
  // and a drive with two stops swapped.
  const { ROUTE_MAPS } = await import(pathToFileURL(path.join(root, 'src/route-maps.js')).href)
  const gist = ROUTE_MAPS.find((r) => r.slug === 'christopher-gist-1750-51')
  const lines = JSON.parse(fs.readFileSync(path.join(root, 'scripts/route-map-lines.json'), 'utf8'))
  const swapped = { ...gist, stops: [...gist.stops] }
  ;[swapped.stops[3], swapped.stops[4]] = [swapped.stops[4], swapped.stops[3]]
  const geo = await import(pathToFileURL(path.join(root, 'src/route-map-geo.js')).href)
  const broken = [
    ['gist badges 4 and 13 swapped', () => {
      const marks = storyMarks(gist, geo)
      ;[marks[3].p, marks[12].p] = [marks[12].p, marks[3].p]
      return checkOrder({ id: 'fixture:gist', stops: marks, line: storyLine(lines[gist.slug]), near: 0.25, allow: null }).errs
    }],
    ['gist line reversed', () => {
      const line = storyLine(lines[gist.slug]).reverse()
      return checkOrder({ id: 'fixture:gist-rev', stops: storyMarks(gist, geo), line, near: 0.25, allow: null }).errs
    }],
    ['clark without its allowlist', () => {
      const clark = ROUTE_MAPS.find((r) => r.slug === 'george-rogers-clark')
      return checkOrder({ id: 'fixture:clark', stops: storyMarks(clark, geo), line: storyLine(lines[clark.slug]), near: 0.25, allow: null }).errs
    }],
    ['boones-trail stops 2 and 4 swapped', () => checkDrives({ only: 'boones-trail', mutate: (st) => { [st[1], st[3]] = [st[3], st[1]] } })[0].errs],
  ]
  for (const [name, run] of broken) {
    const errs = run()
    console.log(`${errs.length ? 'ok  ' : 'FAIL'} ${name}: ${errs[0] || 'passes (should fail)'}`)
    if (!errs.length) failed++
  }
  // A leader running through another badge must fail.
  {
    const marks = [
      { n: 1, label: '1', cluster: false, p: [2, 4.5], b: [6, 4.5] },
      { n: 2, label: '2', cluster: false, p: [4, 4.5], b: [4, 4.5] },
    ]
    const errs = labelOverlaps('fixture:leader-through-badge', marks, [], [800, 450])
    const hit = errs.some((e) => /leader (crosses|grazes) badge/.test(e))
    console.log(`${hit ? 'ok  ' : 'FAIL'} leader through another badge: ${errs.find((e) => /leader/.test(e)) || 'passes (should fail)'}`)
    if (!hit) failed++
  }
  const r = checkOrder({ id: 'fixture:out-and-back', stops: obStops, line: ob, near: 0.5, allow: null })
  console.log(`${r.errs.length ? 'FAIL' : 'ok  '} out-and-back: ${r.errs.join(' | ') || 'passes'}`)
  if (r.errs.length) failed++
  return failed
}

async function main() {
  if (process.argv.includes('--self-test')) {
    const failed = await selfTest()
    if (failed) { console.error(`check-route-order self-test: ${failed} case(s) wrong`); process.exit(1) }
    console.log('check-route-order self-test: broken fixtures fail, good ones pass')
    return
  }
  const rows = [...(await checkStoryMaps()), ...checkDrives()]
  const errs = rows.flatMap((r) => r.errs)
  for (const r of rows) console.log(`${r.errs.length ? 'FAIL' : 'ok  '} ${r.kind} ${r.slug} (${r.stops ?? '?'} stops)${process.argv.includes('-v') ? ' ' + JSON.stringify(r.positions) : ''}`)
  if (errs.length) {
    console.error(errs.join('\n'))
    console.error(`check-route-order: ${errs.length} problem(s)`)
    process.exit(1)
  }
  console.log(`check-route-order: ${rows.length} routes, stops follow the line`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
