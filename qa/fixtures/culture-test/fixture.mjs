// INTERNAL TEST FIXTURE for Batch 6-0 (culture textures, legend group, BCE labels).
// NOT shipped: it lives outside public/ and is never referenced by the real index.json.
// The test script injects it with Playwright route interception, so no reader ever sees it.
// Everything here is deliberately fake and labelled so.
export const TEXTURES = ['dots', 'crosshatch', 'horizontal', 'diamonds', 'vertical']
const COLORS = { dots: '#BEDCA0', crosshatch: '#6E6EDC', horizontal: '#8C4682', diamonds: '#5A965A', vertical: '#D2AAD2' }
export const slugOf = (t) => `qa-fixture-culture-${t}`
export const idOf = (t) => `qa-fixture-${t}`
export const refOf = (t) => `/data/web/territories/_qa-fixture-${t}.json`

const box = (i) => {
  // five blocks across Kentucky, clearly not any real culture's area
  const w0 = -88.6 + i * 1.25
  return [[[w0, 36.7], [w0 + 1.0, 36.7], [w0 + 1.0, 38.2], [w0, 38.2], [w0, 36.7]]]
}

export function indexEntries() {
  return TEXTURES.map((t, i) => ({
    id: idOf(t),
    name: `QA fixture culture (${t})`,
    kind: 'culture',
    texture: t,
    color: COLORS[t],
    slugs: [slugOf(t)],
    ref: refOf(t),
    extentFeature: 'r1',
    yearStart: [-4000, -800, -500, 250, 1000][i],
    yearEnd: [-1000, -500, 250, 1000, 1750][i],
    approxStart: i === 1,
    confidence: 'low',
    note: 'INTERNAL TEST FIXTURE: not a real culture, not shown to readers.',
    mapNote: 'INTERNAL TEST FIXTURE shape: not a real culture area.',
    mainMap: true,
  }))
}

export function cultureData(t) {
  const i = TEXTURES.indexOf(t)
  const yrs = [-4000, -800, -500, 250, 1000]
  const eras = yrs.map((y, k) => ({
    id: `e${k}`,
    label: `${y < 0 ? `${-y} BCE` : `${y} CE`} · INTERNAL TEST FIXTURE period ${k + 1}`,
    short: y < 0 ? `${-y} BCE` : `${y} CE`,
    yearStart: y,
    yearEnd: yrs[k + 1] ?? 1750,
    confidence: 'low',
    sources: ['fx'],
    text: 'INTERNAL TEST FIXTURE text: this is not a real culture and is never shown to readers.',
    layers: [{ feature: 'r1', style: 'soft' }],
    mapLabel: k === 0 ? 'TEST FIXTURE' : undefined,
  }))
  return {
    schema: 1,
    slug: slugOf(t),
    nation: `QA fixture culture (${t})`,
    yearStart: -4000,
    yearEnd: 1750,
    presenceLabel: 'INTERNAL TEST FIXTURE',
    presenceNote: 'INTERNAL TEST FIXTURE: not a real culture.',
    confidence: 'low',
    approximate: true,
    overlapNote: 'INTERNAL TEST FIXTURE.',
    basis: 'INTERNAL TEST FIXTURE',
    timeline: { min: -4000, max: 1750 },
    fadeYears: 0,
    fadeSouth: false,
    startEra: { [slugOf(t)]: 'e1' },
    mapLabelPos: [-86.5, 37.5],
    eras,
    sources: [{ id: 'fx', label: 'INTERNAL TEST FIXTURE', url: 'https://example.invalid/qa-fixture' }],
    mainMap: { general: 'r1' },
    geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'r1' }, geometry: { type: 'Polygon', coordinates: box(i) } }] },
  }
}

export function storyMeta(t) {
  return {
    slug: slugOf(t),
    title: `QA fixture culture (${t})`,
    publishedDate: '2026-10-02',
    summary: 'INTERNAL TEST FIXTURE story: not shown to readers.',
    yearStart: -4000,
    yearEnd: 1750,
    era: 'prehistoric',
    tags: ['prehistoric'],
    source: 'ky-history',
    briefDate: '2026-10-02',
    territory: { ref: refOf(t), nation: `QA fixture culture (${t})`, presenceLabel: 'INTERNAL TEST FIXTURE' },
  }
}
export const storyFull = (t) => ({ ...storyMeta(t), bodyMarkdown: 'INTERNAL TEST FIXTURE story body. Not a real culture.' })
