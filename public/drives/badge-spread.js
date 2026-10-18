/**
 * Spread numbered stop badges so they sit clear of each other and of the
 * map's place labels.
 * points: [[x, y], ...] in map units (y down); min: badge spacing (one badge
 * diameter plus a little air) in the same units.
 * labels: optional [[left, top, right, bottom], ...] boxes in map units that
 * badges must not cover; they are fixed obstacles and never move.
 * Returns new positions; a badge that moves keeps a leader to its stop.
 * Deterministic so scripts/check-route-order.mjs can run the same layout.
 */
export function labelBox(x, y, text, k) {
  // Matches the drive pages' label text: x+4k, baseline y-3k, 5k Georgia.
  // Padded by 1.5k so a badge never touches the lettering.
  const pad = 1.5 * k
  return [x + 4 * k - pad, y - 3 * k - 4.2 * k - pad, x + 4 * k + 2.75 * k * text.length + pad, y - 3 * k + 1.4 * k + pad]
}

function pushOutOfBox(p, r, box) {
  const cx = Math.max(box[0], Math.min(p[0], box[2]))
  const cy = Math.max(box[1], Math.min(p[1], box[3]))
  let dx = p[0] - cx
  let dy = p[1] - cy
  const d = Math.hypot(dx, dy)
  if (d >= r) return false
  if (d < 1e-9) {
    // Center inside the box: leave by the nearest side.
    const opts = [[p[0] - box[0], -1, 0], [box[2] - p[0], 1, 0], [p[1] - box[1], 0, -1], [box[3] - p[1], 0, 1]]
    opts.sort((a, b) => a[0] - b[0])
    p[0] += opts[0][1] * (opts[0][0] + r * 1.01)
    p[1] += opts[0][2] * (opts[0][0] + r * 1.01)
    return true
  }
  const push = r * 1.01 - d
  p[0] += (dx / d) * push
  p[1] += (dy / d) * push
  return true
}

export function spreadBadges(points, min, labels = [], minLead = 0) {
  const out = points.map((p) => [p[0], p[1]])
  for (let round = 0; round < 20; round++) {
    relax(out, min, labels)
    if (!minLead) break
    // A badge that had to move steps far enough out that its leader shows
    // beyond the badge (fanned out from its stop, not half on top of it).
    let short = false
    out.forEach((p, i) => {
      const dx = p[0] - points[i][0]
      const dy = p[1] - points[i][1]
      const d = Math.hypot(dx, dy)
      if (d > min * 0.03 && d < minLead * 0.98) {
        p[0] = points[i][0] + (dx / d) * minLead
        p[1] = points[i][1] + (dy / d) * minLead
        short = true
      }
    })
    if (!short) break
  }
  return out
}

function relax(out, min, labels) {
  for (let pass = 0; pass < 200; pass++) {
    let moved = false
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        let dx = out[j][0] - out[i][0]
        let dy = out[j][1] - out[i][1]
        let d = Math.hypot(dx, dy)
        if (d >= min) continue
        if (d < 1e-9) {
          // Same spot: fan out by stop number so the layout is stable.
          const a = (j * 2.4) % (2 * Math.PI)
          dx = Math.cos(a)
          dy = Math.sin(a)
          d = 1
        }
        const push = (min - Math.hypot(out[j][0] - out[i][0], out[j][1] - out[i][1])) / 2 + min * 0.01
        out[i][0] -= (dx / d) * push
        out[i][1] -= (dy / d) * push
        out[j][0] += (dx / d) * push
        out[j][1] += (dy / d) * push
        moved = true
      }
    }
    for (const p of out) for (const box of labels) if (pushOutOfBox(p, min / 2, box)) moved = true
    if (!moved) break
  }
}
