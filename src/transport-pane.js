/**
 * Roads & Rails left pane (mockup v2, approved Oct 18). The rows are prerendered in the HTML
 * (scripts/build-transport-rows.mjs); this wires them up:
 *  - whole-row click and the switch toggle a line; All / None per group with "n of N shown";
 *  - More / Less reveals a row's full description;
 *  - phones (<=900px): the Railroads and Highways sections move into a bottom sheet over the map
 *    (drag the handle to resize, Esc closes, focus moves in on open and back to the handle on close);
 *  - the Map key starts collapsed at <=600px; a fade at the pane's foot says more is below.
 */
import { buildLineRows, countShown, hiddenIdsFor } from './transport-lines.js'
import { getHiddenSections, setHiddenSections } from './transport-map.js'

const PHONE = '(max-width: 900px)'
const SMALL = '(max-width: 600px)'

export function mountTransportPane() {
  const aside = document.querySelector('.transport-controls')
  const pane = aside?.querySelector('.rr-pane')
  if (!aside || !pane || aside.dataset.paneReady != null) return
  // Rows are defined in transport-lines.js; group membership is read from the prerendered markup.
  const groups = buildLineRows(
    [...document.querySelectorAll('.rr-row')].flatMap((li) => li.dataset.ids.split(' ').map((id) => ({ properties: { id } }))),
  )
  const rowEls = () => [...document.querySelectorAll('.rr-row')]

  /* ---- Toggles ---- */
  const sync = () => {
    const state = {}
    for (const li of rowEls()) {
      const on = li.querySelector('input').checked
      state[li.dataset.key] = on
      li.classList.toggle('is-off', !on)
    }
    for (const g of groups) {
      const el = document.querySelector(`.rr-group[data-group="${g.key}"] .rr-count`)
      if (el) el.textContent = countShown(g, state)
    }
    setHiddenSections(hiddenIdsFor(groups, state))
  }
  const onClick = (event) => {
    const allBtn = event.target.closest('[data-all]')
    if (allBtn) {
      const on = allBtn.dataset.all === '1'
      allBtn.closest('.rr-group').querySelectorAll('.rr-row input').forEach((i) => { i.checked = on })
      sync()
      return
    }
    const more = event.target.closest('.rr-more')
    if (more) {
      const li = more.closest('.rr-row')
      const open = !li.classList.contains('is-expanded')
      li.classList.toggle('is-expanded', open)
      more.setAttribute('aria-expanded', String(open))
      more.firstChild.textContent = open ? 'Less' : 'More'
      return
    }
    const li = event.target.closest('.rr-row')
    // The switch handles its own clicks; anywhere else on the row toggles it too.
    if (!li || event.target.closest('.rr-switch, a, button')) return
    const input = li.querySelector('input')
    input.checked = !input.checked
    sync()
  }
  document.addEventListener('click', (event) => {
    if (event.target.closest('.rr-pane, .rr-sheet')) onClick(event)
  })
  document.addEventListener('change', (event) => {
    if (event.target.matches('.rr-row input')) sync()
  })

  /* ---- More / Less only where the one-line description is cut off ---- */
  const syncMore = () => {
    for (const li of rowEls()) {
      const btn = li.querySelector('.rr-more')
      const desc = li.querySelector('.rr-row-desc')
      if (!btn || !desc || li.classList.contains('is-expanded')) continue
      btn.hidden = !(desc.scrollWidth > desc.clientWidth + 1)
    }
  }
  pane.addEventListener('toggle', () => requestAnimationFrame(syncMore), true)

  /* ---- Map key: collapsed by default on small phones ---- */
  const legend = document.getElementById('rrLegend')
  if (legend && window.matchMedia(SMALL).matches) legend.open = false

  /* ---- Phone bottom sheet ---- */
  const wrap = document.querySelector('.transport-section .map-canvas-wrap')
  const lines = ['rrSec-rail', 'rrSec-highways'].map((id) => document.getElementById(id)).filter(Boolean)
  const nLines = rowEls().length
  const sheet = document.createElement('section')
  sheet.className = 'rr-sheet'
  sheet.setAttribute('aria-label', 'Railroads and highways on this map')
  sheet.innerHTML = `<button type="button" class="rr-sheet-handle" aria-expanded="false" aria-controls="rrSheetBody">
      <span class="rr-grab" aria-hidden="true"></span><span class="rr-sheet-title">Railroads and highways</span>
      <span class="rr-sec-meta">${nLines} lines</span><span class="rr-chev" aria-hidden="true"></span></button>
    <div class="rr-sheet-body" id="rrSheetBody" tabindex="-1" hidden></div>`
  const handle = sheet.querySelector('.rr-sheet-handle')
  const body = sheet.querySelector('.rr-sheet-body')
  wrap?.append(sheet)
  const setOpen = (open, { focus = true, height } = {}) => {
    sheet.classList.toggle('is-open', open)
    handle.setAttribute('aria-expanded', String(open))
    body.hidden = !open
    sheet.style.height = open && height ? `${height}px` : ''
    if (open && focus) body.focus({ preventScroll: true })
    if (!open && focus && sheet.contains(document.activeElement)) handle.focus({ preventScroll: true })
    if (open) requestAnimationFrame(syncMore)
  }
  let dragged = false
  handle.addEventListener('click', () => {
    if (dragged) { dragged = false; return }
    setOpen(!sheet.classList.contains('is-open'))
  })
  // Drag the handle to resize: release near the bottom to close.
  handle.addEventListener('pointerdown', (event) => {
    if (!wrap) return
    const startY = event.clientY
    const startH = sheet.getBoundingClientRect().height
    const maxH = wrap.getBoundingClientRect().height * 0.88
    let moved = false
    handle.setPointerCapture(event.pointerId)
    const move = (e) => {
      const h = Math.min(maxH, Math.max(44, startH + (startY - e.clientY)))
      if (Math.abs(e.clientY - startY) > 6) moved = true
      if (!moved) return
      sheet.classList.add('is-dragging', 'is-open')
      body.hidden = false
      sheet.style.height = `${h}px`
    }
    const up = (e) => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      sheet.classList.remove('is-dragging')
      if (!moved) return
      dragged = true
      const h = sheet.getBoundingClientRect().height
      setOpen(h > 96, { focus: false, height: h > 96 ? h : undefined })
      if (e.type === 'pointercancel') dragged = false
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  })
  handle.addEventListener('keydown', (event) => {
    // Arrow keys resize too, for keyboard users.
    if (!wrap || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    const h = sheet.classList.contains('is-open') ? sheet.getBoundingClientRect().height : 44
    const next = Math.min(wrap.getBoundingClientRect().height * 0.88, Math.max(44, h + (event.key === 'ArrowUp' ? 60 : -60)))
    setOpen(next > 96, { focus: false, height: next > 96 ? next : undefined })
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sheet.classList.contains('is-open') && !document.querySelector('.transport-tick.is-tip-open')) {
      setOpen(false)
      handle.focus({ preventScroll: true })
    }
  })
  const about = document.getElementById('rrSec-about')
  const mq = window.matchMedia(PHONE)
  const place = () => {
    if (mq.matches) {
      for (const el of lines) body.append(el)
    } else {
      setOpen(false, { focus: false })
      for (const el of lines) about?.before(el)
    }
    requestAnimationFrame(syncMore)
  }
  mq.addEventListener?.('change', place)
  place()

  /* ---- Fade cue at the foot of the pane while more is below (desktop) ---- */
  const fade = () => {
    const more = aside.scrollHeight - aside.scrollTop - aside.clientHeight > 4
    aside.classList.toggle('has-more-below', more && !mq.matches)
  }
  aside.addEventListener('scroll', fade, { passive: true })
  pane.addEventListener('toggle', () => requestAnimationFrame(fade), true)
  window.addEventListener('resize', () => { fade(); syncMore() })

  /* ---- Editor: at 1280x800 the Highways and parkways header must be reachable above the fold ----
   * Until the reader opens or closes something, collapse the Map key and then Railroads (its header keeps
   * a "4 lines" summary) while the Highways header would sit below the pane's visible bottom. */
  let userTouched = false
  pane.addEventListener('click', (e) => { if (e.isTrusted && e.target.closest('summary')) userTouched = true }, true)
  const fit = () => {
    if (userTouched || mq.matches) return
    const hw = document.querySelector('#rrSec-highways > summary')
    if (!hw) return
    const bottom = Math.min(aside.getBoundingClientRect().bottom, window.innerHeight)
    const below = () => hw.getBoundingClientRect().bottom > bottom - 8
    for (const d of [legend, document.getElementById('rrSec-rail')]) {
      if (!below()) break
      if (d?.open) d.open = false
    }
    fade()
  }
  window.addEventListener('transport:year', () => requestAnimationFrame(fit))
  window.addEventListener('resize', fit)
  requestAnimationFrame(fit)

  window.__khdTransportHidden = getHiddenSections
  sync()
  requestAnimationFrame(() => { syncMore(); fade() })
  aside.dataset.paneReady = ''
}
