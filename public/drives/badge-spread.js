/**
 * Spread numbered stop badges that would sit on top of each other.
 * points: [[x, y], ...] in map units; min: badge spacing in the same units.
 * Returns new positions; a badge that moves keeps a leader to its stop.
 * Deterministic so scripts/check-route-order.mjs can run the same layout.
 */
export function spreadBadges(points, min) {
  const out = points.map((p) => [p[0], p[1]])
  for (let pass = 0; pass < 80; pass++) {
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
    if (!moved) break
  }
  return out
}
