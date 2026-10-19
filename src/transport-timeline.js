/**
 * Roads & Rails timeline helpers (#291 follow-up). Pure functions, shared by the page and its test.
 * The slider starts TIMELINE_PAD_YEARS before the earliest opening in the layer, so adding an
 * earlier sourced road or railroad moves the start on its own.
 */
// 0 since the pre-1834 roads landed: the earliest dated event is Boone's Trace (1775), and the Editor wants
// the slider to start at 1775, where the undated 'Before 1775' trails are shown. Raise it if a later
// earliest event needs breathing room; the start stays earliest dated year - pad.
export const TIMELINE_PAD_YEARS = 0
export const TIMELINE_MAX_YEAR = 2000
/** Ticks closer than this on the track merge (24px keeps touch targets apart). */
export const TICK_MIN_GAP_PX = 24

/**
 * Dated events, sorted by year then name: { id, year, name, kind }.
 * Each unique section id gives its opening (unless tick === false), plus one event per milestone
 * ({ year, label }). Undated sections ('Before 1775' trails) give no events and no ticks.
 */
export function openingEvents(features) {
  const seen = new Set()
  const out = []
  for (const f of features || []) {
    const p = f?.properties || f || {}
    if (!p.id || seen.has(p.id) || p.undated === true) continue
    seen.add(p.id)
    const year = Number(p.opened)
    const name = p.routeName && p.from && p.to ? `${p.routeName}: ${p.from} to ${p.to}` : String(p.name || p.id)
    if (p.tick !== false && Number.isFinite(year)) out.push({ id: String(p.id), year, name, kind: String(p.kind || '') })
    for (const m of Array.isArray(p.milestones) ? p.milestones : []) {
      const my = Number(m?.year)
      if (!Number.isFinite(my)) continue
      out.push({ id: `${p.id}@${my}`, year: my, name: `${p.routeName || p.name}: ${m.label}`, kind: String(p.kind || '') })
    }
  }
  return out.sort((a, b) => a.year - b.year || a.name.localeCompare(b.name))
}

export function sliderMinYear(events) {
  const years = (events || []).map((e) => e.year).filter(Number.isFinite)
  if (!years.length) return TIMELINE_MAX_YEAR - 200
  return Math.min(...years) - TIMELINE_PAD_YEARS
}

function pctFor(year, min, max) {
  if (max <= min) return 0
  return Math.min(100, Math.max(0, ((year - min) / (max - min)) * 100))
}

/** Visible tick label: the year, plus a count when several openings share it ('1963 · 3'). */
export function tickLabel(t) {
  return t.events.length > 1 ? `${t.year} · ${t.events.length}` : String(t.year)
}

/**
 * Group events into ticks: one tick per distinct year (Critiquito #326: no proximity merging).
 * Each tick: { year, lastYear, pct, events, label }. Extra options are accepted and ignored.
 */
export function groupTicks(events, { min, max = TIMELINE_MAX_YEAR } = {}) {
  const sorted = [...(events || [])].sort((a, b) => a.year - b.year || a.name.localeCompare(b.name))
  const ticks = []
  for (const e of sorted) {
    const last = ticks[ticks.length - 1]
    if (last && last.year === e.year) {
      last.events.push(e)
      continue
    }
    ticks.push({ year: e.year, lastYear: e.year, pct: pctFor(Math.min(e.year, max), min, max), events: [e] })
  }
  for (const t of ticks) t.label = tickLabel(t)
  return ticks
}

/**
 * Place tick labels in rows under the track so none overlap and all stay inside [0, widthPx].
 * Labels sit as close to their mark as they can; a leader line joins label and mark. Ticks closer
 * than minGapPx always use at least two rows (staggered), and more rows are added only when needed.
 * Returns { rows, items: [{ year, label, markX, x, w, row }] } (x is the label's left edge).
 */
export function layoutTickLabels(ticks, { widthPx, labelWidth, gapPx = 3, minGapPx = TICK_MIN_GAP_PX, maxRows = 8 } = {}) {
  const base = (ticks || []).map((t) => {
    const w = Math.min(widthPx, labelWidth(t))
    return { year: t.year, label: t.label, markX: (t.pct / 100) * widthPx, w }
  })
  if (!base.length) return { rows: 0, items: [] }
  const crowded = base.some((b, i) => i && b.markX - base[i - 1].markX < minGapPx)
  let best = null
  for (let rows = crowded ? 2 : 1; rows <= maxRows; rows++) {
    const ends = new Array(rows).fill(-Infinity)
    const items = base.map((b) => {
      const want = Math.max(0, Math.min(widthPx - b.w, b.markX - b.w / 2))
      let row = 0
      let x = Infinity
      for (let r = 0; r < rows; r++) {
        const cand = Math.max(want, ends[r] + gapPx)
        if (Math.abs(cand - want) < Math.abs(x - want) - 0.01) { x = cand; row = r }
      }
      ends[row] = x + b.w
      return { ...b, x, row }
    })
    // Pull any row that runs past the right edge back left, keeping its order.
    let ok = true
    for (let r = 0; r < rows; r++) {
      const row = items.filter((it) => it.row === r)
      let limit = widthPx
      for (let i = row.length - 1; i >= 0; i--) {
        row[i].x = Math.min(row[i].x, limit - row[i].w)
        limit = row[i].x - gapPx
      }
      if (row.length && row[0].x < -0.01) ok = false
    }
    best = { rows, items }
    if (ok) break
  }
  for (const it of best.items) it.x = Math.max(0, Math.round(it.x * 10) / 10)
  return best
}

/* Critiquito #326/#327: tap targets for the staggered labels. Each label owns its row band (rowH tall,
 * >= 44px on touch) and, within the row, reaches up to 22px past its text but never past the midpoint to
 * a neighbour, so no two targets overlap and an off-centre tap cannot pick the next year. */
export const TICK_HIT_MIN_H = 44
export function tickHitAreas(items, { top0 = 0, rowH = TICK_HIT_MIN_H, widthPx = Infinity, reach = 22 } = {}) {
  const out = items.map(() => null)
  const rows = new Map()
  items.forEach((it, i) => { if (!rows.has(it.row)) rows.set(it.row, []); rows.get(it.row).push(i) })
  for (const [row, idx] of rows) {
    idx.sort((a, b) => items[a].x - items[b].x)
    idx.forEach((i, k) => {
      const it = items[i]
      const prev = k ? items[idx[k - 1]] : null
      const next = k < idx.length - 1 ? items[idx[k + 1]] : null
      const left = Math.max(0, it.x - reach, prev ? (prev.x + prev.w + it.x) / 2 : -Infinity)
      const right = Math.min(widthPx, it.x + it.w + reach, next ? (it.x + it.w + next.x) / 2 : Infinity)
      const l = Math.ceil(left * 10) / 10
      const r = Math.floor(right * 10) / 10
      out[i] = { x: l, y: top0 + row * rowH, w: Math.round((r - l) * 10) / 10, h: rowH }
    })
  }
  return out
}
