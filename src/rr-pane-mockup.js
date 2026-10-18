// DESIGN MOCKUP (branch mockup/roads-rails-left-pane): reworked Roads & Rails left pane.
// Collapsible sections, one row per line (swatch, name, year, description, toggle), All/None per group,
// along-line name labels, and a data-driven timeline start with opening ticks.
// Every name, year and description is read from the page's existing facts list and sections.geojson.
import * as maplibregl from 'maplibre-gl'
import { eraColorFor, getTransportMap, getTransportSections, setHiddenSections } from './transport-map.js'

const PAD = 5 // years before the earliest opening
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const firstSentence = (t) => { const m = /^(.+?[.!?])(\s|$)/.exec(t.trim()); return m ? m[1] : t.trim() }
// WCAG contrast helpers: light-mode labels use a darker variant of the line's own era colour.
const LABEL_BG = '#f3ead8' // darkest cream behind the map (page --bg); halo is #f6eedb
const lum = (hex) => { const v = hex.match(/\w\w/g).map((h) => { const c = parseInt(h, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
export function darkerFor(hex, target = 4.6, bg = LABEL_BG) {
  let [r, g, b] = hex.match(/\w\w/g).map((h) => parseInt(h, 16)); let out = hex
  while (contrast(out, bg) < target) { r *= 0.94; g *= 0.94; b *= 0.94; out = '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('') }
  return out
}
const LEX = [-84.4884, 38.0644] // Lexington: Lexington & Ohio, L&N and Cincinnati Southern meet here
const LEX_REVEAL_ZOOM = 8 // below this, labels avoid the junction (they reveal as you zoom in)
const norm = (n) => n.replace(/\s*\(.*?\)/g, '').replace(/ main line| Railway| Railroad/g, '').trim().toLowerCase()

/** Rows come from the existing "Railroads and parkways on this map" list; sections match by name. */
function buildRows(facts, secs) {
  const feats = secs.features.map((f) => f.properties)
  const groups = []
  for (const h3 of facts.querySelectorAll('h3')) {
    const dl = h3.nextElementSibling
    if (!dl || dl.tagName !== 'DL') continue
    const kind = /rail/i.test(h3.textContent) ? 'rail' : 'parkway'
    const rows = []
    for (const dt of dl.querySelectorAll('dt')) {
      const name = dt.textContent.trim()
      const desc = dt.nextElementSibling?.textContent.trim() || ''
      const key = norm(name)
      let ids
      if (key === 'louisville & frankfort') ids = feats.filter((p) => p.route === 'lexington-ohio' && p.to === 'Louisville')
      else if (key === 'lexington & ohio') ids = feats.filter((p) => p.route === 'lexington-ohio' && p.to !== 'Louisville')
      else ids = feats.filter((p) => p.kind === kind && norm(p.routeName) === key)
      if (!ids.length) continue
      const opened = Math.min(...ids.map((p) => p.opened))
      const first = ids.find((p) => p.opened === opened)
      // The page's own facts text flags a disputed year ("Sources disagree ... 1971 or 1974").
      const dis = /disagree[^.]*?(\d{4}) or (\d{4})/i.exec(desc)
      rows.push({
        name, kind, opened, desc, short: firstSentence(desc),
        disputed: !!dis || ids.some((p) => p.dateStatus === 'disputed'),
        label: dis ? `${dis[1]}/${dis[2].slice(2)}` : first.openedLabel || String(opened),
        provisional: ids.some((p) => p.provisional),
        ids: ids.map((p) => p.id),
      })
    }
    groups.push({ kind, title: kind === 'rail' ? 'Railroads' : 'Highways and parkways', rows })
  }
  return groups
}

export function mountPaneMockup() {
  const aside = document.querySelector('.transport-controls')
  const secs = getTransportSections()
  const facts = aside?.querySelector('.transport-facts')
  if (!aside || !secs || !facts || aside.dataset.mock) return
  aside.dataset.mock = '1'
  document.body.classList.add('rr-mock')
  const groups = buildRows(facts, secs)
  const hidden = new Set()

  const head = aside.querySelector('.transport-head')
  const intro = head.querySelector('.transport-intro')
  const prov = head.querySelector('#transportProv')
  const yearBox = head.querySelector('.transport-year')
  const legend = aside.querySelector('#transportLegend')
  const sources = facts.querySelector('.transport-sources')
  const srcNote = facts.querySelector('.transport-sources + p')

  const sec = (id, title, open, extra = '') =>
    `<details class="rr-sec" id="rrSec-${id}" ${open ? 'open' : ''}><summary><span class="rr-sec-title">${title}</span>${extra}<span class="rr-chev" aria-hidden="true"></span></summary><div class="rr-sec-body"></div></details>`
  const groupHtml = (g) => {
    const rows = g.rows.map((r, i) => `<li class="rr-row" data-ids="${esc(r.ids.join(' '))}" data-opened="${r.opened}">
        <i class="rr-swatch is-${r.kind}" style="background:${esc(eraColorFor(r.opened))}" aria-hidden="true"></i>
        <div class="rr-row-text"><div class="rr-row-top"><span class="rr-row-name">${esc(r.name)}</span><span class="rr-row-year">${esc(r.label)}${r.provisional ? '<abbr title="Provisional year">*</abbr>' : ''}</span></div>
        ${r.disputed ? '<span class="transport-badge rr-badge">Disputed</span>' : ''}
        <div class="rr-desc-line"><p class="rr-row-desc" id="rrDesc-${g.kind}-${i}">${esc(r.desc)}</p>
        ${r.desc.length > 40 ? `<button type="button" class="rr-more" aria-expanded="false" aria-controls="rrDesc-${g.kind}-${i}">More<span class="visually-hidden"> about ${esc(r.name)}</span></button>` : ''}</div></div>
        <label class="rr-switch"><input type="checkbox" checked aria-label="Show ${esc(r.name)}"><span aria-hidden="true"></span></label>
      </li>`).join('')
    return `<div class="rr-allnone" role="group" aria-label="${g.title}: show all or none"><button type="button" data-all="1">All</button><button type="button" data-all="0">None</button><span class="rr-count"></span></div><ul class="rr-rows">${rows}</ul>`
  }

  const pane = document.createElement('div')
  pane.className = 'rr-pane'
  pane.innerHTML =
    sec('timeline', 'Timeline', true) +
    groups.map((g) => sec(g.kind, g.title, true, `<span class="rr-sec-meta">${g.rows.length} lines</span>`)).join('') +
    sec('about', 'About this map', false)
  head.after(pane)
  const body = (id) => pane.querySelector(`#rrSec-${id} .rr-sec-body`)
  const legWrap = document.createElement('details')
  legWrap.className = 'rr-legend'
  legWrap.open = !window.matchMedia('(max-width: 600px)').matches // collapsed by default on phones
  legWrap.innerHTML = '<summary>Map key</summary>'
  legWrap.append(legend)
  const sym = document.createElement('ul')
  sym.className = 'rr-symbols'
  sym.innerHTML = '<li><i class="rr-sym-bridge" aria-hidden="true"></i>High Bridge (Cincinnati Southern, 1877)</li><li><i class="rr-sym-town" aria-hidden="true"></i>Town where a line starts or ends</li>'
  legWrap.append(sym)
  body('timeline').append(yearBox, legWrap)
  for (const g of groups) body(g.kind).innerHTML = groupHtml(g)
  body('about').append(intro, prov)
  const srcH = document.createElement('h3'); srcH.textContent = 'Sources and licenses'; srcH.id = 'transportFactsH2'
  body('about').append(srcH, sources, srcNote)
  // Phones: the line groups live in a bottom sheet over the map, so toggling a line keeps the map in view.
  const wrap = document.querySelector('.transport-section .map-canvas-wrap')
  const sheet = document.createElement('section')
  sheet.className = 'rr-sheet'
  sheet.setAttribute('aria-label', 'Lines on this map')
  const nLines = groups.reduce((n, g) => n + g.rows.length, 0)
  sheet.innerHTML = `<button type="button" class="rr-sheet-handle" aria-expanded="false" aria-controls="rrSheetBody"><span class="rr-grab" aria-hidden="true"></span><span>Railroads and highways</span><span class="rr-sec-meta">${nLines} lines</span><span class="rr-chev" aria-hidden="true"></span></button><div class="rr-sheet-body" id="rrSheetBody"></div>`
  wrap.append(sheet)
  const handle = sheet.querySelector('.rr-sheet-handle')
  handle.addEventListener('click', () => {
    const open = !sheet.classList.contains('is-open')
    sheet.classList.toggle('is-open', open); handle.setAttribute('aria-expanded', String(open))
  })
  const mq = window.matchMedia('(max-width: 900px)')
  const placeGroups = () => {
    const target = mq.matches ? sheet.querySelector('.rr-sheet-body') : null
    for (const g of groups) {
      const el = pane.querySelector(`#rrSec-${g.kind}`) || sheet.querySelector(`#rrSec-${g.kind}`)
      if (target) target.append(el); else pane.querySelector('#rrSec-about').before(el)
    }
  }
  facts.hidden = true
  aside.querySelector('#transportSections').hidden = true
  aside.querySelector('.transport-credit').hidden = true

  // Toggles
  const sync = () => {
    for (const ul of document.querySelectorAll('.rr-rows')) {
      const rows = [...ul.children]
      const on = rows.filter((li) => li.querySelector('input').checked).length
      ul.previousElementSibling.querySelector('.rr-count').textContent = `${on} of ${rows.length} shown`
    }
    hidden.clear()
    for (const li of document.querySelectorAll('.rr-row')) {
      li.classList.toggle('is-off', !li.querySelector('input').checked)
      if (!li.querySelector('input').checked) li.dataset.ids.split(' ').forEach((id) => hidden.add(id))
    }
    setHiddenSections([...hidden])
  }
  pane.addEventListener('change', sync)
  sheet.addEventListener('change', sync)
  const rowClick = (e) => {
    const more = e.target.closest('.rr-more')
    if (more) {
      const li = more.closest('.rr-row'); const open = !li.classList.contains('is-expanded')
      li.classList.toggle('is-expanded', open); more.setAttribute('aria-expanded', String(open))
      more.firstChild.textContent = open ? 'Less' : 'More'
      return
    }
    const li = e.target.closest('.rr-row')
    if (li && !e.target.closest('.rr-switch') && !e.target.closest('a, abbr')) {
      const i = li.querySelector('input'); i.checked = !i.checked; sync()
    }
  }
  pane.addEventListener('click', rowClick)
  sheet.addEventListener('click', rowClick)
  const allNone = (e) => {
    const b = e.target.closest('[data-all]')
    if (!b) return
    b.parentElement.nextElementSibling.querySelectorAll('input').forEach((i) => { i.checked = b.dataset.all === '1' })
    sync()
  }
  pane.addEventListener('click', allNone)
  sheet.addEventListener('click', allNone)
  placeGroups(); mq.addEventListener('change', placeGroups)

  // Timeline: data-driven start and opening ticks
  const slider = document.getElementById('transportYear')
  const opens = groups.flatMap((g) => g.rows)
  const minY = Math.min(...opens.map((r) => r.opened)) - PAD
  const maxY = Number(slider.max)
  slider.min = String(minY); slider.setAttribute('aria-valuemin', String(minY))
  yearBox.querySelector('.transport-scale').innerHTML = `<span>${minY}</span><span>${maxY}</span>`
  const ticks = document.createElement('div')
  ticks.className = 'rr-ticks'
  ticks.setAttribute('role', 'group'); ticks.setAttribute('aria-label', 'Openings on the timeline')
  slider.after(ticks)
  const drawTicks = () => {
    const w = ticks.clientWidth || 300
    const pct = (y) => ((y - minY) / (maxY - minY)) * 100
    const sorted = [...opens].sort((a, b) => a.opened - b.opened)
    const minGap = w < 360 ? 14 : 9 // px between tick centres before they merge
    const clusters = []
    for (const r of sorted) {
      const last = clusters[clusters.length - 1]
      if (last && ((r.opened - last.at) / (maxY - minY)) * w < minGap) last.items.push(r)
      else clusters.push({ at: r.opened, items: [r] })
    }
    ticks.innerHTML = clusters.map((c) => {
      const yrs = [...new Set(c.items.map((r) => r.opened))]
      const span = yrs.length > 1 ? `${yrs[0]}–${yrs[yrs.length - 1]}` : String(yrs[0])
      const tip = c.items.map((r) => `${r.name}, ${r.opened}`).join('; ')
      return `<button type="button" class="rr-tick${c.items.length > 1 ? ' is-merged' : ''}${c.items.some((r) => r.kind === 'rail') ? ' is-rail' : ' is-road'}" style="left:${pct(c.at)}%" data-year="${c.at}" aria-label="${esc(tip)}">${c.items.length > 1 ? `<b>${c.items.length}</b>` : ''}<span class="rr-tip" role="tooltip">${esc(span)}: ${esc(c.items.map((r) => r.name).join(', '))}</span></button>`
    }).join('')
  }
  drawTicks()
  window.addEventListener('resize', drawTicks)
  ticks.addEventListener('click', (e) => {
    const b = e.target.closest('.rr-tick'); if (!b) return
    slider.value = b.dataset.year
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    ticks.querySelectorAll('.rr-tick').forEach((t) => t.classList.toggle('is-shown', t === b))
  })

  // Line labels along each visible line (HTML approximation; build-out uses a symbol layer with
  // symbol-placement: line once the style has glyphs). Collisions hide the lower-priority label.
  const map = getTransportMap()
  const byId = new Map(secs.features.map((f) => [f.properties.id, f]))
  const labels = opens.map((r) => {
    // longest section line for this row
    let best = null, bestLen = 0
    for (const id of r.ids) {
      const g = byId.get(id).geometry
      const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates
      for (const l of lines) {
        let len = 0
        for (let i = 1; i < l.length; i++) len += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1])
        if (len > bestLen) { bestLen = len; best = l }
      }
    }
    const el = document.createElement('span')
    el.className = `rr-line-label is-${r.kind}`
    el.textContent = r.name.replace(/\s*\(.*?\)/, '').replace('Louisville & Nashville main line', 'L&N main line').replace(/ Railroad| Railway/, '').replace(/ Parkway$/, ' Pkwy')
    el.setAttribute('aria-hidden', 'true')
    el.style.setProperty('--rr-label', darkerFor(eraColorFor(r.opened, 'light')))
    const m = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
    return { r, line: best, el, m, added: false }
  })
  const placeLabels = () => {
    const year = Number(document.getElementById('transport')?.dataset.year || 1880)
    const placed = []
    const lexPt = map.project(LEX); const nearLex = map.getZoom() < LEX_REVEAL_ZOOM
    labels.sort((a, b) => (a.lexBusy ? 1 : 0) - (b.lexBusy ? 1 : 0))
    // rail first, then by opening year
    for (const L of labels) {
      const show = L.r.opened <= year && !L.r.ids.every((id) => hidden.has(id))
      if (!show) { if (L.added) { L.m.remove(); L.added = false } continue }
      const pts = L.line.map((c) => map.project(c))
      let tot = 0; const seg = []
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(d); tot += d }
      let ok = false
      for (const frac of [0.5, 0.35, 0.65, 0.22, 0.78]) {
        let acc = 0, i = 0
        while (i < seg.length - 1 && acc + seg[i] < tot * frac) acc += seg[i++]
        // direction over a window around the anchor, so wiggles don't spin the label
        const a = pts[Math.max(0, i - 3)], b = pts[Math.min(pts.length - 1, i + 4)]
        let ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
        if (ang > 90) ang -= 180; if (ang < -90) ang += 180
        const t = seg[i] ? (tot * frac - acc) / seg[i] : 0
        const mid = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t }
        // Near the Lexington junction three lines meet: labels there wait for zoom.
        if (nearLex && Math.hypot(mid.x - lexPt.x, mid.y - lexPt.y) < 70) { L.lexBusy = true; continue }
        L.m.setLngLat(map.unproject([mid.x, mid.y])).setRotation(ang).setOffset([0, -8])
        if (!L.added) { L.m.addTo(map); L.added = true }
        L.el.style.visibility = ''
        const rect = L.el.getBoundingClientRect()
        const box = map.getContainer().getBoundingClientRect()
        const inside = rect.left > box.left + 2 && rect.right < box.right - 40 && rect.top > box.top + 2 && rect.bottom < box.bottom - 30
        const hit = placed.some((p) => rect.left < p.right + 2 && rect.right > p.left - 2 && rect.top < p.bottom + 1 && rect.bottom > p.top - 1)
        if (inside && !hit) { placed.push(rect); ok = true; break }
      }
      if (!ok) L.el.style.visibility = 'hidden'
    }
    // Line names outrank town names: hide any endpoint name a placed line label would overlap.
    for (const b of document.querySelectorAll('.transport-endpoint b')) {
      if (b.style.visibility === 'hidden') continue
      const r = b.getBoundingClientRect()
      if (placed.some((p) => r.left < p.right + 2 && r.right > p.left - 2 && r.top < p.bottom + 1 && r.bottom > p.top - 1)) b.style.visibility = 'hidden'
    }
  }
  map.on('moveend', placeLabels)
  window.addEventListener('transport:year', () => requestAnimationFrame(placeLabels))
  sync()
  requestAnimationFrame(placeLabels)
}
