// DESIGN MOCKUP (branch mockup/roads-rails-left-pane): reworked Roads & Rails left pane.
// Collapsible sections, one row per line (swatch, name, year, description, toggle), All/None per group,
// along-line name labels, and a data-driven timeline start with opening ticks.
// Every name, year and description is read from the page's existing facts list and sections.geojson.
import * as maplibregl from 'maplibre-gl'
import { eraColorFor, getTransportMap, getTransportSections, setHiddenSections } from './transport-map.js'

const PAD = 5 // years before the earliest opening
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const firstSentence = (t) => { const m = /^(.+?[.!?])(\s|$)/.exec(t.trim()); return m ? m[1] : t.trim() }
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
      rows.push({
        name, kind, opened, desc: firstSentence(desc),
        label: first.openedLabel || String(opened),
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
    const rows = g.rows.map((r) => `<li class="rr-row" data-ids="${esc(r.ids.join(' '))}" data-opened="${r.opened}">
        <i class="rr-swatch is-${r.kind}" style="background:${esc(eraColorFor(r.opened))}" aria-hidden="true"></i>
        <div class="rr-row-text"><div class="rr-row-top"><span class="rr-row-name">${esc(r.name)}</span><span class="rr-row-year">${esc(r.label)}${r.provisional ? '<abbr title="Provisional year">*</abbr>' : ''}</span></div>
        <p class="rr-row-desc">${esc(r.desc)}</p></div>
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
  body('timeline').append(yearBox, legend)
  for (const g of groups) body(g.kind).innerHTML = groupHtml(g)
  body('about').append(intro, prov)
  const srcH = document.createElement('h3'); srcH.textContent = 'Sources and licenses'; srcH.id = 'transportFactsH2'
  body('about').append(srcH, sources, srcNote)
  facts.hidden = true
  aside.querySelector('#transportSections').hidden = true
  aside.querySelector('.transport-credit').hidden = true

  // Toggles
  const sync = () => {
    for (const ul of pane.querySelectorAll('.rr-rows')) {
      const rows = [...ul.children]
      const on = rows.filter((li) => li.querySelector('input').checked).length
      ul.previousElementSibling.querySelector('.rr-count').textContent = `${on} of ${rows.length} shown`
    }
    hidden.clear()
    for (const li of pane.querySelectorAll('.rr-row')) {
      li.classList.toggle('is-off', !li.querySelector('input').checked)
      if (!li.querySelector('input').checked) li.dataset.ids.split(' ').forEach((id) => hidden.add(id))
    }
    setHiddenSections([...hidden])
  }
  pane.addEventListener('change', sync)
  pane.addEventListener('click', (e) => {
    const b = e.target.closest('[data-all]')
    if (!b) return
    b.parentElement.nextElementSibling.querySelectorAll('input').forEach((i) => { i.checked = b.dataset.all === '1' })
    sync()
  })

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
    const m = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
    return { r, line: best, el, m, added: false }
  })
  const placeLabels = () => {
    const year = Number(document.getElementById('transport')?.dataset.year || 1880)
    const placed = []
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
