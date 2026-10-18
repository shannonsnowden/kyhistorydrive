/**
 * Timeline reading width (#timeline only).
 * Desktop: story pane grows to the full page and the map slides aside.
 * Phones (stacked layout): the same button hides or shows the map.
 * Choice is sessionStorage. Reading position is anchored to the top visible
 * paragraph or story card and restored after the layout change.
 * Does not add or change MapLibre controls.
 */

const STORAGE_KEY = 'khd-timeline-reading'
const PHONE_QUERY = '(max-width: 900px)'
const MOTION_MS = 340
const ANCHOR_SELECTOR = [
  '.timeline-item',
  '#timelineStoryReader .story-body p',
  '#timelineStoryReader .story-body li',
  '#timelineStoryReader .story-body h2',
  '#timelineStoryReader .story-body h3',
  '#timelineStoryReader .story-body h4',
  '#timelineStoryReader .story-summary',
  '#timelineStoryReader .story-head h2',
].join(', ')

function readWide() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'wide'
  } catch {
    return false
  }
}

function writeWide(wide) {
  try {
    sessionStorage.setItem(STORAGE_KEY, wide ? 'wide' : 'split')
  } catch {
    /* private mode / blocked storage */
  }
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isPhone() {
  return window.matchMedia(PHONE_QUERY).matches
}

/**
 * Element that owns the reading line (just under the sticky header and bar):
 * the deepest paragraph or story card that contains that line, else the next one.
 */
export function pickReadingAnchor(root, lineY) {
  if (!root) return null
  const nodes = root.querySelectorAll(ANCHOR_SELECTOR)
  let containing = null
  let next = null
  for (const el of nodes) {
    const r = el.getBoundingClientRect()
    if (r.height < 1 || r.width < 1) continue
    if (r.bottom <= lineY + 0.5) continue
    if (r.top <= lineY + 1) {
      containing = el
      continue
    }
    if (!containing) next = el
    break
  }
  return containing || next
}

export function initTimelineReading({ getMap, focusPin } = {}) {
  const layout = document.querySelector('#timeline .timeline-layout')
  const story = document.getElementById('timelineStoryPane')
  const mapPane = document.getElementById('timelineMapPane')
  const button = document.getElementById('timelineReadingToggle')
  const bar = layout?.querySelector('.timeline-read-bar')
  if (!layout || !story || !mapPane || !button || !bar) return

  let animToken = 0
  let openMapPx = 0

  function syncStickyOffsets() {
    const header = document.querySelector('header.top')
    const h = header ? Math.ceil(header.getBoundingClientRect().height) : 0
    layout.style.setProperty('--tl-sticky-top', `${h}px`)
    layout.style.setProperty('--tl-readbar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`)
  }

  function rememberMapHeight() {
    const wide = layout.classList.contains('is-reading-wide')
    const h = Math.ceil(wide ? mapPane.scrollHeight : mapPane.getBoundingClientRect().height)
    if (h > 32) {
      openMapPx = h
      layout.style.setProperty('--tl-map-open-h', `${h}px`)
    } else if (openMapPx > 32) {
      layout.style.setProperty('--tl-map-open-h', `${openMapPx}px`)
    }
  }

  function syncButton() {
    // aria-expanded names the map pane (aria-controls), not the story.
    // Map shown → expanded + "Hide map". Map hidden → collapsed + "Show map".
    const mapShown = !layout.classList.contains('is-reading-wide')
    button.setAttribute('aria-expanded', mapShown ? 'true' : 'false')
  }

  function syncMapA11y() {
    const hidden = layout.classList.contains('is-reading-wide')
    if (hidden && mapPane.contains(document.activeElement)) button.focus()
    mapPane.inert = hidden
    if (hidden) mapPane.setAttribute('aria-hidden', 'true')
    else mapPane.removeAttribute('aria-hidden')
  }

  function readingLineY() {
    const header = document.querySelector('header.top')
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0
    const barBottom = bar.getBoundingClientRect().bottom
    return Math.max(headerBottom, barBottom) + 4
  }

  function captureAnchor() {
    const el = pickReadingAnchor(story, readingLineY())
    if (!el) return null
    return { el, top: el.getBoundingClientRect().top }
  }

  function restoreAnchor(anchor, allow) {
    if (!allow() || !anchor?.el?.isConnected) return
    const dy = anchor.el.getBoundingClientRect().top - anchor.top
    if (Math.abs(dy) < 0.5) return
    window.scrollBy(0, dy)
  }

  function resizeMap() {
    const canvas = document.getElementById('timelineMapCanvas')
    const map = typeof getMap === 'function' ? getMap() : null
    if (!map || !canvas) return false
    if (layout.classList.contains('is-reading-wide')) return false
    if (canvas.clientWidth < 2 || canvas.clientHeight < 2) return false
    try {
      map.resize()
      return true
    } catch {
      return false
    }
  }

  function finishLayout(anchor, allow) {
    layout.classList.remove('is-reading-instant', 'is-reading-anim')
    restoreAnchor(anchor, allow)
    // MapLibre repositions symbols and lngLat popups on resize. Skip while the
    // pane is collapsed so a 0×0 canvas does not stick as the map's size.
    if (!resizeMap()) return
    requestAnimationFrame(() => {
      resizeMap()
    })
  }

  function setWide(wide, { animate = true, persist = true } = {}) {
    const currently = layout.classList.contains('is-reading-wide')
    if (wide === currently) {
      syncButton()
      syncMapA11y()
      return
    }
    const token = ++animToken
    const anchor = captureAnchor()
    let userMoved = false
    const allow = () => token === animToken && !userMoved
    const markMoved = () => {
      userMoved = true
    }
    rememberMapHeight()
    const instant = !animate || prefersReducedMotion()
    if (instant) layout.classList.add('is-reading-instant')
    layout.classList.add('is-reading-anim')
    // Overflow clip has to apply before the width transition starts.
    void layout.offsetWidth
    layout.classList.toggle('is-reading-wide', wide)
    syncButton()
    syncMapA11y()
    syncStickyOffsets()
    if (persist) writeWide(wide)

    if (instant) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (token !== animToken) return
          finishLayout(anchor, allow)
        })
      })
      return
    }

    window.addEventListener('wheel', markMoved, { passive: true })
    window.addEventListener('touchmove', markMoved, { passive: true })
    const step = () => {
      if (!allow()) return
      restoreAnchor(anchor, allow)
      if (token === animToken && layout.classList.contains('is-reading-anim')) {
        requestAnimationFrame(step)
      }
    }
    requestAnimationFrame(step)

    const endName = isPhone() ? 'max-height' : 'grid-template-columns'
    let ended = false
    const cleanup = () => {
      window.removeEventListener('wheel', markMoved)
      window.removeEventListener('touchmove', markMoved)
      layout.removeEventListener('transitionend', onEnd)
      mapPane.removeEventListener('transitionend', onEnd)
    }
    const done = () => {
      if (ended || token !== animToken) return
      ended = true
      cleanup()
      finishLayout(anchor, allow)
    }
    const onEnd = (event) => {
      if (event.propertyName !== endName) return
      if (event.target !== layout && event.target !== mapPane) return
      done()
    }
    layout.addEventListener('transitionend', onEnd)
    mapPane.addEventListener('transitionend', onEnd)
    window.setTimeout(done, MOTION_MS + 420)
  }

  if (readWide()) {
    layout.classList.add('is-reading-wide', 'is-reading-instant')
    requestAnimationFrame(() => layout.classList.remove('is-reading-instant'))
  }
  syncButton()
  syncMapA11y()
  syncStickyOffsets()
  requestAnimationFrame(() => {
    rememberMapHeight()
    syncStickyOffsets()
  })

  // Real button: Enter and Space fire click. No extra key handler (that would toggle twice).
  // Phones (<=560px): the docked map scrolls away with the page. While it is off-screen the bar
  // reads "Show map" and jumps back to the map (and the story's pin) instead of collapsing it.
  const dockMq = window.matchMedia('(max-width: 560px)')
  let mapOffscreen = false
  function syncOffscreen() {
    const on = mapOffscreen && dockMq.matches && layout.classList.contains('is-home-story') &&
      !layout.classList.contains('is-reading-wide')
    layout.classList.toggle('is-map-offscreen', on)
    if (on) button.setAttribute('aria-expanded', 'false')
    else syncButton()
    return on
  }
  // Seed the on-screen state synchronously so first paint never reads "Show map"
  // while the map is visible; the observer refines it once it fires.
  function mapInViewport() {
    const r = mapPane.getBoundingClientRect()
    return r.bottom > 0 && r.top < window.innerHeight && r.height > 0
  }
  mapOffscreen = !mapInViewport()
  syncOffscreen()
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      for (const e of entries) mapOffscreen = !e.isIntersecting
      syncOffscreen()
    }).observe(mapPane)
    dockMq.addEventListener?.('change', syncOffscreen)
  }

  button.addEventListener('click', () => {
    if (syncOffscreen()) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      // Land the map below the sticky header and read bar so its top (and the + zoom) stay visible.
      const header = document.querySelector('header.top')
      const headerH = header ? header.getBoundingClientRect().height : 0
      const barSticky = getComputedStyle(bar).position === 'sticky' || getComputedStyle(bar).position === 'fixed'
      const offset = Math.ceil(headerH + (barSticky ? bar.getBoundingClientRect().height : 0)) + 8
      const y = mapPane.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' })
      if (typeof focusPin === 'function') focusPin()
      return
    }
    setWide(!layout.classList.contains('is-reading-wide'))
    syncOffscreen()
  })

  const phoneMq = window.matchMedia(PHONE_QUERY)
  const onViewport = () => {
    syncStickyOffsets()
    rememberMapHeight()
    if (!layout.classList.contains('is-reading-wide') && !layout.classList.contains('is-reading-anim')) {
      requestAnimationFrame(() => resizeMap())
    }
  }
  phoneMq.addEventListener?.('change', onViewport)
  window.addEventListener('resize', onViewport)
  const header = document.querySelector('header.top')
  if (header && 'ResizeObserver' in window) {
    new ResizeObserver(() => syncStickyOffsets()).observe(header)
  }
}
