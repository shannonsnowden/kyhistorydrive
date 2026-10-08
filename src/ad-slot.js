/**
 * Reserved ad slots. Nothing is inserted unless VITE_ADS_ENABLED is true/1
 * or the page is opened with ?adpreview=1.
 *
 * index.html already loads adsbygoogle.js. This class reuses that tag and
 * does not add a second copy. A missing tag is filled in only for a live
 * unit, after first paint and after a visible map has gone idle.
 */

const DEFAULT_CLIENT = 'ca-pub-8587137224654033'
const CLIENT_RE = /^ca-pub-\d{10,16}$/
const SLOT_RE = /^\d{6,12}$/
const LOADER_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
const LOADER_SEL = 'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'

const HEIGHT = {
  home: 100,
  explore: 100,
  sidebar: 250,
}

export class AdSlot {
  static #io = null
  static #loader = null
  static #readyPromise = null

  /** Preview query wins over the build flag. `?adpreview=0` forces slots off. */
  static enabled() {
    try {
      const q = new URLSearchParams(location.search).get('adpreview')
      if (q === '0' || q === 'false') return false
      if (q === '1' || q === 'true') return true
    } catch {
      /* no location */
    }
    const flag = import.meta.env.VITE_ADS_ENABLED
    return flag === '1' || flag === 'true'
  }

  static client() {
    const raw = String(import.meta.env.VITE_ADSENSE_CLIENT || '').trim()
    return CLIENT_RE.test(raw) ? raw : DEFAULT_CLIENT
  }

  static slotId(placement) {
    const raw =
      placement === 'home'
        ? import.meta.env.VITE_ADSENSE_SLOT_HOME
        : placement === 'sidebar'
          ? import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR
          : placement === 'explore'
            ? import.meta.env.VITE_ADSENSE_SLOT_EXPLORE
            : ''
    const id = String(raw || '').trim()
    return SLOT_RE.test(id) ? id : ''
  }

  /**
   * Append a slot after `parent`'s current children.
   * Sidebar: the parent is the photo aside. The slot is placed after it,
   * outside the sticky photo, and after the story text in DOM order.
   */
  static mount(parent, placement) {
    if (!AdSlot.enabled() || !parent || !HEIGHT[placement]) return null
    if (placement === 'sidebar') return AdSlot.#mountSidebar(parent)
    const existing = parent.querySelector(':scope > .ad-slot')
    if (existing) return existing
    const el = AdSlot.#create(placement)
    parent.appendChild(el)
    AdSlot.#observe(el)
    return el
  }

  static unmount(parent) {
    parent?.querySelector(':scope > .ad-slot')?.remove()
  }

  static #mountSidebar(aside) {
    let col = aside.parentElement
    if (!col?.classList.contains('story-sidebar-col')) {
      col = document.createElement('div')
      col.className = 'story-sidebar-col'
      aside.replaceWith(col)
      col.appendChild(aside)
    }
    const existing = col.querySelector(':scope > .ad-slot')
    if (existing) return existing
    const el = AdSlot.#create('sidebar')
    col.appendChild(el)
    AdSlot.#observe(el)
    return el
  }

  static #create(placement) {
    const el = document.createElement('aside')
    el.className = `ad-slot ad-slot--${placement}`
    el.dataset.adPlacement = placement
    const labelId = `ad-slot-label-${placement}`
    el.setAttribute('aria-labelledby', labelId)
    const live = Boolean(AdSlot.slotId(placement))
    el.dataset.adMode = live ? 'live' : 'placeholder'
    el.innerHTML = `<p class="ad-slot-label" id="${labelId}">Advertisement</p><div class="ad-slot-frame" data-ad-frame></div>`
    return el
  }

  static #observe(el) {
    const frame = el.querySelector('[data-ad-frame]')
    if (!frame || frame.dataset.adWatch === '1') return
    frame.dataset.adWatch = '1'
    AdSlot.#observer().observe(frame)
  }

  static #observer() {
    if (!AdSlot.#io) {
      AdSlot.#io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            AdSlot.#io.unobserve(entry.target)
            AdSlot.#fill(entry.target)
          }
        },
        { rootMargin: '300px 0px', threshold: 0 },
      )
    }
    return AdSlot.#io
  }

  static #fill(frame) {
    const slot = frame.closest('.ad-slot')
    if (!slot || slot.dataset.adMode !== 'live' || slot.dataset.adFilled === '1') return
    const placement = slot.dataset.adPlacement
    const slotId = AdSlot.slotId(placement)
    const client = AdSlot.client()
    if (!slotId || !client) return
    slot.dataset.adFilled = '1'
    AdSlot.#ready()
      .then(() => AdSlot.#activate(frame, client, slotId, placement))
      .catch(() => {
        slot.dataset.adFilled = ''
      })
  }

  /** First paint, then let a visible map finish tiles before any ad request. */
  static #ready() {
    if (!AdSlot.#readyPromise) {
      AdSlot.#readyPromise = AdSlot.#afterPaint().then(() => AdSlot.#afterMapIdle()).then(() => AdSlot.#idle())
    }
    return AdSlot.#readyPromise
  }

  static #afterPaint() {
    return new Promise((resolve) => {
      const painted = () => requestAnimationFrame(() => requestAnimationFrame(resolve))
      if (document.readyState === 'complete') painted()
      else window.addEventListener('load', painted, { once: true })
    })
  }

  static #afterMapIdle() {
    if (!document.querySelector('.maplibregl-map') || window.__khdMapIdle) return Promise.resolve()
    return new Promise((resolve) => {
      const timer = window.setTimeout(resolve, 8000)
      window.addEventListener(
        'khd-map-idle',
        () => {
          window.clearTimeout(timer)
          resolve()
        },
        { once: true },
      )
    })
  }

  static #idle() {
    return new Promise((resolve) => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => resolve(), { timeout: 2000 })
      } else {
        window.setTimeout(resolve, 200)
      }
    })
  }

  static #activate(frame, client, slotId, placement) {
    return AdSlot.#ensureLoader(client).then(() => {
      if (!frame.isConnected) return
      const ins = document.createElement('ins')
      ins.className = 'adsbygoogle'
      ins.style.display = 'block'
      ins.style.width = '100%'
      ins.style.height = '100%'
      ins.setAttribute('data-ad-client', client)
      ins.setAttribute('data-ad-slot', slotId)
      ins.setAttribute('data-ad-format', 'auto')
      ins.setAttribute('data-full-width-responsive', placement === 'sidebar' ? 'false' : 'true')
      frame.replaceChildren(ins)
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch {
        /* script blocked or queue rejected */
      }
    })
  }

  /** Reuse the head loader. Insert one async copy only when it is absent. */
  static #ensureLoader(client) {
    if (document.querySelector(LOADER_SEL)) return Promise.resolve()
    if (AdSlot.#loader) return AdSlot.#loader
    AdSlot.#loader = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.async = true
      script.crossOrigin = 'anonymous'
      script.src = `${LOADER_SRC}?client=${encodeURIComponent(client)}`
      script.onload = () => resolve()
      script.onerror = () => {
        AdSlot.#loader = null
        reject(new Error('adsbygoogle failed to load'))
      }
      document.head.appendChild(script)
    })
    return AdSlot.#loader
  }
}
