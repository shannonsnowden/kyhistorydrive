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

/**
 * Group events into ticks. Same-year events always share a tick; a tick closer than minGapPx to the
 * previous tick joins it. Each tick: { year, lastYear, pct, events, label }.
 */
export function groupTicks(events, { min, max = TIMELINE_MAX_YEAR, widthPx = 300, minGapPx = TICK_MIN_GAP_PX } = {}) {
  const sorted = [...(events || [])].sort((a, b) => a.year - b.year || a.name.localeCompare(b.name))
  const ticks = []
  for (const e of sorted) {
    const pct = pctFor(Math.min(e.year, max), min, max)
    const last = ticks[ticks.length - 1]
    if (last && (last.lastYear === e.year || ((pct - last.pct) / 100) * widthPx < minGapPx)) {
      last.events.push(e)
      last.lastYear = e.year
      continue
    }
    ticks.push({ year: e.year, lastYear: e.year, pct, events: [e] })
  }
  for (const t of ticks) {
    t.label = t.events.length > 1 ? `${t.events[0].name} +${t.events.length - 1}` : t.events[0].name
  }
  return ticks
}
