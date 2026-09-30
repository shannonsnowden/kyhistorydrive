/**
 * Tribal territory test (web only). Renders an approximate, sourced territory region
 * for ONE story (chickasaw-hunting-grounds) as inline SVG: a compact card (story reader)
 * and a full-size version (Map view, #map/territory/<slug>).
 * Data: /data/web/territories/*.json  (NOT under /data/app/, never fetched by the iOS app).
 * Everything is gated by TRIBAL_TERRITORY_ENABLED in territory-flag.js.
 */
import { TRIBAL_TERRITORY_ENABLED } from './territory-flag.js'

const BASE_URL = '/data/web/territories/_poster-base-ky.json'
const SERIF = '"Bookman Old Style","URW Bookman","C059","Palatino Linotype","P052",Georgia,"DejaVu Serif",serif'
const PAL = { parch: '#efe3c4', ink: '#2a1d10', river: '#8fbdd6', cream: '#f5ecd6', nb: '#21472f', nbLine: 'rgba(245,236,214,.38)', cty: '#a8976a' }
const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const INDEX_URL = '/data/web/territories/index.json'

export const territoryEnabled = () => TRIBAL_TERRITORY_ENABLED === true

/* ---------- color helpers (per-nation colors come from the territories index) ---------- */
const hex3 = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h || ''))
  const n = parseInt(m ? m[1] : 'b3261e', 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgba = (h, a) => {
  const [r, g, b] = hex3(h)
  return `rgba(${r},${g},${b},${a})`
}
const mix = (h, to, t) => {
  const [r, g, b] = hex3(h)
  const c = (x, y) => Math.round(x + (y - x) * t)
  const [tr, tg, tb] = to
  return `rgb(${c(r, tr)},${c(g, tg)},${c(b, tb)})`
}
export const darkOf = (h) => mix(h, [0, 0, 0], 0.5)
/** Muted (other-nation) color: desaturated toward gray. */
export const mutedOf = (h) => mix(h, [128, 128, 128], 0.6)

/** Territories index (nations list). Validates entries; no empty strings. */
export async function loadTerritoryIndex() {
  const idx = await getJson(INDEX_URL)
  const ok = (v) => typeof v === 'string' && v.trim() !== ''
  const nations = (idx.nations || []).filter(
    (n) => ok(n.id) && ok(n.name) && ok(n.color) && ok(n.ref) && Array.isArray(n.slugs) && n.slugs.some(ok),
  )
  return nations
}
export const nationForSlug = (nations, slug) => nations.find((n) => n.slugs.includes(slug)) || null
export async function loadNationData(ref) {
  return getJson(ref)
}
/** Extent polygon drawn on the main map / as a muted layer. */
export function nationExtentGeometry(T, n) {
  const f = (T.geojson?.features || []).find((x) => x.properties?.id === (n.extentFeature || 'r1'))
  return f ? f.geometry : null
}
export const storyHasTerritory = (s) => territoryEnabled() && !!(s && s.territory && s.territory.ref)
export const territoryMapHash = (slug) => `#map/territory/${encodeURIComponent(slug)}`

/** "Chickasaw claim in this area: 1780–1818" (years come only from the cited sources). */
export function territoryRangeText(t) {
  const end = t.yearEnd ? `–${t.yearEnd}` : '–'
  return `${t.presenceLabel || `${t.nation} presence`}: ${t.yearStart}${end}`
}
export function territoryListLineHtml(s) {
  if (!storyHasTerritory(s)) return ''
  const t = s.territory
  return `<p class="terr-listline" data-territory-line>${esc(territoryRangeText(t))} <small>(approximate, sourced)</small></p>`
}

const cache = Object.create(null)
async function getJson(url) {
  if (!cache[url]) {
    cache[url] = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url} ${r.status}`)
      return r.json()
    })
  }
  return cache[url]
}
export async function loadTerritory(ref) {
  const [T, base] = await Promise.all([getJson(ref), getJson(BASE_URL)])
  return { T, base }
}

/* ---------- geometry helpers ---------- */
function projector(proj) {
  return (lon, lat) => [(lon - proj.LON0) * proj.K * proj.SC, (proj.LAT1 - lat) * proj.SC]
}
function ringD(ring, P) {
  return ring.map((c, i) => {
    const [x, y] = P(c[0], c[1])
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join('') + 'Z'
}
function geomD(g, P) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return polys.map((p) => p.map((r) => ringD(r, P)).join('')).join('')
}

const stylesFor = (c, pfx, full) => ({
  solid: { fill: rgba(c, 0.52), stroke: darkOf(c), w: full ? 2.6 : 1.8, dash: '' },
  soft: { fill: rgba(c, 0.3), stroke: darkOf(c), w: 1.6, dash: '7 5' },
  hatch: { fill: `url(#${pfx}-hatch)`, stroke: darkOf(c), w: 1.6, dash: '' },
})

function svgText(x, y, txt, o = {}) {
  const s = o.s || 15
  return `<text x="${x}" y="${y}" text-anchor="${o.anchor || 'middle'}" font-family='${SERIF}' font-weight="${o.w || 600}" font-size="${s}" letter-spacing="${o.ls ?? 3}" fill="${o.c || 'rgba(245,236,214,.78)'}" ${o.stroke ? `stroke="${o.stroke}" stroke-width="${o.sw || 3}" paint-order="stroke"` : ''} ${o.it ? 'font-style="italic"' : ''}>${esc(txt)}</text>`
}

function buildSvg({ T, base, mode, pfx, color }) {
  const P = projector(base.proj)
  const full = mode === 'full'
  const STY = stylesFor(color, pfx, full)
  const halo = darkOf(color)
  const narrow = full && typeof window !== 'undefined' && window.innerWidth < 700
  // label scale so text stays legible when the SVG is squeezed into a phone width
  const k = mode === 'card' ? 1.55 : narrow ? 1.9 : 1
  const vb = mode === 'card' ? '60 20 880 400' : narrow ? '40 150 720 500' : '0 0 1000 672'
  const inV = (x, y) => {
    const [a, b, w, h] = vb.split(' ').map(Number)
    return x > a + 6 && x < a + w - 6 && y > b + 6 && y < b + h - 6
  }
  const rv = base.rivers
  const riv = (d, w) => (d ? `<path d="${d}" fill="none" stroke="${PAL.river}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>` : '')
  const nb = Object.values(base.nb).map((d) => `<path d="${d}" fill="${PAL.nb}" stroke="${PAL.nbLine}" stroke-width="1" fill-rule="evenodd"/>`).join('')
  const defs = `<defs>
<pattern id="${pfx}-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${rgba(color, 0.14)}"/><line x1="0" y1="0" x2="0" y2="7" stroke="${darkOf(color)}" stroke-width="2.4"/></pattern>
<linearGradient id="${pfx}-fg" gradientUnits="userSpaceOnUse" x1="0" y1="400" x2="0" y2="590"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
<mask id="${pfx}-fade"><rect x="-50" y="-50" width="1100" height="700" fill="url(#${pfx}-fg)"/></mask>
<filter id="${pfx}-paper"><feTurbulence type="fractalNoise" baseFrequency=".03 .05" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 .4  0 0 0 0 .28  0 0 0 0 .1  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>`
  const feat = Object.fromEntries(T.geojson.features.map((f) => [f.properties.id, f.geometry]))
  const eraGroups = T.eras.map((e) => {
    const paths = e.layers.map((l) => {
      const st = STY[l.style]
      const fill = st.fill
      return `<path d="${geomD(feat[l.feature], P)}" fill="${fill}" stroke="${st.stroke}" stroke-width="${st.w}" ${st.dash ? `stroke-dasharray="${st.dash}"` : ''} stroke-linejoin="round" fill-rule="evenodd"/>`
    }).join('')
    return { id: e.id, paths }
  })
  const L = base.labels
  const sl = (n, p, s) => (inV(p[0], p[1]) ? svgText(p[0], p[1], n, { s: s * k, c: 'rgba(245,236,214,.72)' }) : '')
  const states = [['ILLINOIS', L.ILLINOIS], ['INDIANA', L.INDIANA], ['OHIO', L.OHIO], ['MISSOURI', L.MISSOURI], ['TENNESSEE', L.TENNESSEE], ['VIRGINIA', L.VIRGINIA], ['W. VA.', L['W. VA.']], ['ARKANSAS', L.ARKANSAS], ['MISSISSIPPI', L.MISSISSIPPI], ['ALABAMA', L.ALABAMA]]
    .map(([n, p]) => sl(mode === 'card' && n.length > 8 ? n.slice(0, 4) + '.' : n, p, 14)).join('')
  const rl = (lon, lat, txt, rot) => {
    const [x, y] = P(lon, lat)
    if (!inV(x, y)) return ''
    return `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" text-anchor="middle" font-family='${SERIF}' font-style="italic" font-size="${12 * k}" fill="#3f7a99" stroke="rgba(239,227,196,.85)" stroke-width="2.5" paint-order="stroke">${txt}</text>`
  }
  const rivLabels = rl(-87.0, 37.83, 'Ohio R.', -8) + rl(-89.45, 35.85, 'Mississippi R.', -82) + rl(-88.12, 36.25, 'Tennessee R.', -84) + rl(-86.6, 36.62, 'Cumberland R.', -12)
  const pin = (name, txt, dx, dy, anchor, r) => {
    const [x, y] = base.places[name]
    return `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="${PAL.cream}" stroke-width="1.6"/>${svgText(x + dx, y + dy, txt, { s: 11 * k, anchor, w: 700, ls: 1, c: PAL.ink, stroke: 'rgba(239,227,196,.9)' })}</g>`
  }
  const [lx, ly] = P(T.mapLabelPos[0], T.mapLabelPos[1])
  const eraLabels = T.eras.map((e) => {
    const main = svgText(lx, ly, e.mapLabel, { s: (e.mapSubLabel ? 18 : 22) * k, c: '#fff', ls: 4, w: 800, stroke: halo })
    const sub = e.mapSubLabel ? svgText(lx, ly + 20 * k, e.mapSubLabel, { s: 11 * k, c: '#fff', ls: 3, w: 700, stroke: halo }) : ''
    return `<g data-label="${e.id}">${main}${sub}</g>`
  }).join('')
  const kyLabel = svgText(L.KENTUCKY[0], L.KENTUCKY[1] - 2, 'KENTUCKY', { s: 24 * k, c: 'rgba(42,29,16,.62)', ls: 9, w: 700 })
  const south = inV(215, 650) || mode === 'card' ? '' : svgText(215, 652, 'CONTINUES SOUTH →', { s: 11 * k, c: '#ffd9a0', ls: 2 })
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Kentucky with the approximate ${esc(T.nation)} territory shaded in the far west; the shaded area changes with the selected year">${defs}
<rect x="-50" y="-50" width="1100" height="800" fill="#173a26"/>${nb}
<path d="${base.ky_d}" fill="${PAL.parch}"/><path d="${base.ky_d}" fill="#000" filter="url(#${pfx}-paper)" opacity=".9"/>
<path d="${base.counties}" fill="none" stroke="${PAL.cty}" stroke-width=".7" opacity=".9"/>
${riv(rv.mississippi, 3)}${riv(rv.ohio, 2.6)}${riv(rv.tennessee, 2)}${riv(rv.cumberland, 1.6)}${riv(rv.kentucky, 1.3)}${riv(rv.green, 1.2)}${riv(rv.wabash, 1.2)}
<path d="${base.ky_d}" fill="none" stroke="${PAL.ink}" stroke-width="1.6" stroke-linejoin="round"/>
<g data-others></g>
<g mask="url(#${pfx}-fade)">${eraGroups.map((g) => `<g data-era="${g.id}" style="opacity:0">${g.paths}</g>`).join('')}</g>
${states}${kyLabel}${rivLabels}${south}${eraLabels}
${pin('Paducah', 'PADUCAH', 10, 4, 'start', 5)}${pin('Fort Jefferson (1780)', mode === 'card' ? '' : 'FORT JEFFERSON 1780', -9, 16, 'end', 4)}
</svg>`
}

function sourcesHtml(T, ids) {
  const byId = Object.fromEntries(T.sources.map((s) => [s.id, s]))
  return ids.map((id) => byId[id]).filter(Boolean)
    .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a>`).join(' · ')
}
const CONF = { medium: 'Medium', 'low-medium': 'Low–medium', low: 'Low', high: 'High' }

/**
 * Mount the territory component into `el`.
 * mode 'card' (story reader) or 'full' (Map view). Returns { destroy }.
 */
export function mountTerritory(el, { T, base, mode, slug, color = '#b3261e', nation = null }) {
  const pfx = `tt${mode}${Math.random().toString(36).slice(2, 7)}`
  const { min, max } = T.timeline
  const eras = T.eras
  const span = max - min
  const pct = (y) => (((y - min) / span) * 100).toFixed(2)
  const eraOf = (y) => [...eras].reverse().find((e) => y >= e.yearStart) || eras[0]
  const rangeTxt = territoryRangeText(T)
  const segs = eras.map((e, i) => {
    const b = i + 1 < eras.length ? eras[i + 1].yearStart : max
    const cl = e.id === 'claim'
    return `<span class="seg" style="left:${pct(e.yearStart)}%;width:${(pct(b) - pct(e.yearStart)).toFixed(2)}%;background:${cl ? rgba(color, 0.4) : color};${cl ? 'border-style:dashed' : ''}"></span>`
  }).join('')
  const ticks = eras.map((e) => `<span class="tk" style="left:${pct(e.yearStart)}%">${e.yearStart}</span>`).join('')
  const chips = eras.map((e) => `<button type="button" data-era="${e.id}" aria-pressed="false">${esc(e.short)}</button>`).join('')
  const tags = (e) => `<span class="terr-tag conf">Confidence: ${esc(CONF[e.confidence] || e.confidence)}</span><span class="terr-tag appr">Approximate boundary</span><span class="terr-tag ovl">Territories overlapped &amp; shifted</span>`
  const footer = 'Approximate territory · simplified from public-domain treaty descriptions · not a legal boundary'
  const head = mode === 'card'
    ? `<div class="terr-head"><span class="terr-kicker">Territory · ${esc(T.nation)}</span><span class="terr-presence">${esc(rangeTxt)}</span></div>`
    : `<h2 class="terr-title">${esc(T.nation)} territory over time</h2><div class="terr-sub">${esc(rangeTxt)} · only this nation is shown</div>`
  const controls = `<div class="terr-ctl"><input type="range" min="${min}" max="${max}" step="1" value="${T.eras[1].yearStart}" aria-label="Year shown on the ${esc(T.nation)} territory map"><output class="terr-out" aria-live="off"></output></div>
<div class="terr-bar" role="img" aria-label="${esc(rangeTxt)} on a timeline from ${min} to ${max}"><span class="trk"></span>${segs}<span class="cur"></span>${ticks}</div>
<div class="terr-chips" role="group" aria-label="Jump to a period">${chips}</div>`
  const eraBox = `<div class="terr-era" aria-live="polite"><h4></h4><p></p></div><div class="terr-tags"></div>
<p class="terr-note"><b>Territories overlapped and shifted.</b> ${esc(T.overlapNote)}</p>
<p class="terr-span">${esc(T.presenceNote)}</p>
<p class="terr-src"><b>Source:</b> <span class="terr-srclist"></span></p>`
  const openLink = mode === 'card'
    ? `<a class="terr-open" href="/${territoryMapHash(slug)}">Open full-screen territory map →</a>`
    : `<div class="terr-legend" data-legend></div>`
  const body = mode === 'card'
    ? `${head}<div class="terr-map"></div>${controls}${eraBox}${openLink}<p class="terr-foot">${footer}</p>`
    : `${head}<div class="terr-grid"><div><div class="terr-map"></div>${controls}${openLink}</div><div>${eraBox}</div></div><p class="terr-foot">${footer}</p>`
  el.innerHTML = `<section class="terr-${mode === 'card' ? 'card' : 'full'}" data-territory="${esc(slug)}" aria-label="${esc(T.nation)} territory, approximate">${body}</section>`
  const root = el.firstElementChild
  root.querySelector('.terr-map').innerHTML = buildSvg({ T, base, mode, pfx, color })
  const range = root.querySelector('input[type=range]')
  const out = root.querySelector('.terr-out')
  const cur = root.querySelector('.cur')
  const sm = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)))
  let lastEra = null
  function render(y) {
    const f = (t) => sm(y, t - 1.5, t + 1.5)
    eras.forEach((e, i) => {
      const a = i === 0 ? 1 : f(e.yearStart)
      const b = i + 1 < eras.length ? 1 - f(eras[i + 1].yearStart) : 1
      const op = (a * b).toFixed(2)
      const g = root.querySelector(`g[data-era="${e.id}"]`)
      const lb = root.querySelector(`g[data-label="${e.id}"]`)
      if (g) g.style.opacity = op
      if (lb) lb.style.opacity = op
    })
    const e = eraOf(y)
    out.textContent = y
    cur.style.left = `${pct(y)}%`
    range.setAttribute('aria-valuetext', `${y}: ${e.label}`)
    if (e.id !== lastEra) {
      lastEra = e.id
      root.querySelector('.terr-era h4').textContent = e.label
      root.querySelector('.terr-era p').textContent = e.text
      root.querySelector('.terr-tags').innerHTML = tags(e)
      root.querySelector('.terr-srclist').innerHTML = sourcesHtml(T, e.sources)
      root.querySelectorAll('.terr-chips button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.era === e.id ? 'true' : 'false'))
    }
  }
  range.addEventListener('input', () => render(+range.value))
  root.querySelectorAll('.terr-chips button').forEach((b) =>
    b.addEventListener('click', () => {
      const e = eras.find((x) => x.id === b.dataset.era)
      const y = e.yearStart + 2 // past the ±1.5y cross-fade so the era shows fully
      range.value = y
      render(y)
    }),
  )
  render(+range.value)

  // ---- full view: legend + other (muted) nations ----
  const P = projector(base.proj)
  const legendEl = root.querySelector('[data-legend]')
  const sw = (bg, bd, dashed) => `<i style="background:${bg};border:1px ${dashed ? 'dashed' : 'solid'} ${bd}"></i>`
  const hatchBg = `repeating-linear-gradient(45deg,${darkOf(color)} 0 2px,${rgba(color, 0.14)} 2px 5px)`
  function paintLegend(others) {
    if (!legendEl) return
    const nm = esc(nation?.name || T.nation)
    const focal = `<span class="lg-focal">${sw(rgba(color, 0.52), darkOf(color))}<b>${nm}</b> (this story, highlighted)</span>
<span>${sw(rgba(color, 0.3), darkOf(color), true)}Claimed / used</span><span>${sw(hatchBg, darkOf(color))}Ceded by treaty</span>`
    const oth = others.map((o) => `<span class="lg-other" data-lg-other="${esc(o.id)}">${sw(rgba(mutedOf(o.color), 0.28), mutedOf(o.color), true)}${esc(o.name)} <em>(other nation, muted)</em></span>`).join('')
    legendEl.innerHTML = focal + oth
  }
  function setOthers(others) {
    const g = root.querySelector('g[data-others]')
    if (g) {
      g.innerHTML = others.map((o) => {
        const c = mutedOf(o.color)
        return `<path data-other="${esc(o.id)}" d="${geomD(o.geometry, P)}" fill="${rgba(c, 0.26)}" stroke="${c}" stroke-width="1" stroke-dasharray="5 4" stroke-linejoin="round" fill-rule="evenodd"/>`
      }).join('')
    }
    paintLegend(others)
  }
  if (mode === 'full') paintLegend([])
  return { setYear: (y) => { range.value = y; render(y) }, setOthers }
}
