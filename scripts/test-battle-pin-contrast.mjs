// Battle pins must clear WCAG non-text contrast (3:1) on light and dark maps.
// Backgrounds sampled around the pins in the built map at 1280 and 390 (Oct 19).
// The CARTO Voyager basemap is the same in both site themes; dark mode adds the
// near-black page, controls and Full state chip around and over the map.
import assert from 'node:assert/strict'
import { BATTLE_PIN_DISC, battlePinEdgeContrast, contrastRatio, relativeLuminance } from '../src/battle-pins.js'

export const MAP_BACKGROUNDS = {
  // Outside Kentucky, the Kentucky fill, water, a neighbouring war-site dot.
  light: ['#fbf8f3', '#e2e5dd', '#cbe1e4', '#a2635f'],
  // Site --bg, map control and chip panels.
  dark: ['#101812', '#1a241c', '#243628'],
}

assert.ok(Math.abs(relativeLuminance('#ffffff') - 1) < 1e-9)
assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9)
assert.throws(() => relativeLuminance('green'))

const rows = []
for (const [theme, colors] of Object.entries(MAP_BACKGROUNDS)) {
  for (const bg of colors) {
    const edge = battlePinEdgeContrast(bg)
    rows.push(`${theme} ${bg} ${edge.toFixed(2)}:1`)
    assert.ok(edge >= 3, `battle pin edge is ${edge.toFixed(2)}:1 on ${theme} map ${bg}, under 3:1`)
  }
}
// The bare icons (before the disc) were dark green on these: the bug.
assert.ok(contrastRatio('#1f4a2e', '#101812') < 3, 'bare green icon on near-black is under 3:1')
// The war art's green shapes must read on the cream disc.
const GREEN = '#1f4a2e'
const art = contrastRatio(GREEN, BATTLE_PIN_DISC.fill)
assert.ok(art >= 3, `green art on the disc is ${art.toFixed(2)}:1`)
assert.ok(BATTLE_PIN_DISC.ring >= 2, 'ring is at least 2px')
console.log(`test-battle-pin-contrast: pin edge ${rows.join(', ')}; green art on disc ${art.toFixed(2)}:1`)
