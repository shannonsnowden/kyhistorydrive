/**
 * "Back to story" on the map.
 *
 * A story map link pushes a history entry that carries the source page and
 * scroll position. The map shows one control. The control and the browser
 * Back button both return to that page and restore the scroll position.
 * A fresh load or a typed map URL has no source, so the control stays hidden.
 *
 * Origins are same-site paths or slugs only. Nothing here builds an
 * off-site URL or inserts stored text as HTML.
 */

const STORAGE_KEY = 'khd-story-return'
const MAX_AGE_MS = 20000
const MAX_SCROLL = 2000000

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
export const PATH_RE = new RegExp(`^/(?:stories/${SLUG}/|routes/)?$`)
export const HASH_RE = new RegExp(
  `^(?:|timeline/${SLUG}|explore/${SLUG}/[1-9][0-9]{0,3}|route-map|(?!map$|timeline$|about$|app$|home$|content$|explore$|stories$|story$|resources$)${SLUG})$`,
)
const SLUG_RE = new RegExp(`^${SLUG}$`)
const SEG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/

const hooks = {
  onNavigate: () => {},
  isMapView: () => false,
  isTerritory: () => false,
}

let pendingScroll = null
let placed = false

function escAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function finiteScroll(value) {
  const n = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(n) || n < 0 || n > MAX_SCROLL) return null
  return Math.round(n)
}

export function currentPath(pathname = location.pathname) {
  if (pathname === '/index.html') return '/'
  return pathname || '/'
}

export function currentHash(hash = location.hash) {
  return String(hash || '').replace(/^#/, '')
}

/** Same-site story origin. Returns null for anything that is not a path or slug we own. */
export function parseStoryReturn(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  if (input.v !== 1) return null
  const path = typeof input.path === 'string' ? input.path : ''
  const hash = typeof input.hash === 'string' ? input.hash : ''
  const scroll = finiteScroll(input.scroll)
  if (path.length > 180 || hash.length > 180) return null
  if (!PATH_RE.test(path) || !HASH_RE.test(hash) || scroll == null) return null
  return { v: 1, path, hash, scroll }
}

/** Relative return URL. Never a protocol, host, or query. */
export function returnUrl(input) {
  const origin = parseStoryReturn(input)
  if (!origin) return ''
  return origin.hash ? `${origin.path}#${origin.hash}` : origin.path
}

export function originFromLocation(loc = location, scrollY = window.scrollY || 0) {
  return parseStoryReturn({
    v: 1,
    path: currentPath(loc.pathname),
    hash: currentHash(loc.hash),
    scroll: scrollY,
  })
}

/**
 * Map deep link from a story control. Accepts `#map/...` and `/#map/...` only.
 * Bare `#map` is the direct map and is not a story open.
 */
export function mapDestFromHref(href) {
  if (typeof href !== 'string') return ''
  const raw = href.trim()
  if (!raw || raw.length > 400) return ''
  if (/[\s<>"'\\]/.test(raw) || raw.includes('//') || raw.includes(':')) return ''
  let hash = ''
  if (raw.startsWith('#')) hash = raw
  else if (raw.startsWith('/#') || raw.startsWith('/?')) {
    const cut = raw.indexOf('#')
    if (cut < 0) return ''
    const before = raw.slice(0, cut)
    if (before !== '/' && !before.startsWith('/?')) return ''
    hash = raw.slice(cut)
  } else return ''
  if (!hash.startsWith('#map/')) return ''
  const parts = hash.slice(1).split('/')
  if (parts.length < 2 || parts.length > 4 || parts[0] !== 'map') return ''
  const segs = []
  for (let i = 1; i < parts.length; i += 1) {
    let seg = parts[i]
    if (!seg) return ''
    try {
      seg = decodeURIComponent(seg)
    } catch {
      return ''
    }
    if (!SEG_RE.test(seg) || seg.includes('..') || seg.includes('%') || seg.includes('/')) return ''
    segs.push(encodeURIComponent(seg))
  }
  return `#map/${segs.join('/')}`
}

function readStore() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw || raw.length > 2000) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    return data
  } catch {
    return null
  }
}

function writeStore(data) {
  try {
    if (!data) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* private mode */
  }
}

export function currentReturn() {
  const state = history.state
  if (!state || typeof state !== 'object') return null
  return parseStoryReturn(state.khdStoryReturn)
}

export function historyStateWithReturn() {
  const state = history.state
  if (!state || typeof state !== 'object' || !state.khdStoryReturn) return null
  const origin = parseStoryReturn(state.khdStoryReturn)
  if (!origin) return null
  return { ...state, khdStoryReturn: origin }
}

function navigationType() {
  const nav = performance.getEntriesByType?.('navigation')?.[0]
  return nav?.type || ''
}

function scrollFromState(state) {
  if (!state || typeof state !== 'object') return null
  return finiteScroll(state.khdScroll)
}

/** A reloaded map is a fresh load: drop a return that the session kept. */
export function stripReturnAfterReload() {
  if (navigationType() !== 'reload') return
  const state = history.state
  if (state && typeof state === 'object' && state.khdStoryReturn) {
    const next = { ...state }
    delete next.khdStoryReturn
    history.replaceState(Object.keys(next).length ? next : null, '', location.href)
  }
  const data = readStore()
  if (data?.pending) writeStore({ ...data, pending: false })
}

/** Back/forward into this document: restore the scroll stamped on the way out. */
export function prepareScrollRestore() {
  if (navigationType() !== 'back_forward') return
  const fromState = scrollFromState(history.state)
  if (fromState != null) {
    pendingScroll = fromState
    return
  }
  const data = readStore()
  const origin = parseStoryReturn(data?.origin)
  if (!origin) return
  if (origin.path !== currentPath() || origin.hash !== currentHash()) return
  pendingScroll = origin.scroll
}

export function consumeScrollRestore() {
  const y = pendingScroll
  pendingScroll = null
  return y
}

export function noteScrollRestoreFromState(state) {
  const y = scrollFromState(state)
  if (y != null) pendingScroll = y
}

/**
 * Cross-page opens (a /stories/ or /routes/ page) cannot put state on the
 * next document. sessionStorage carries the origin for that one navigation.
 */
export function adoptCrossPageReturn() {
  if (navigationType() !== 'navigate') return null
  const data = readStore()
  if (!data || data.pending !== true || typeof data.t !== 'number') return null
  if (Date.now() - data.t > MAX_AGE_MS) {
    writeStore({ ...data, pending: false })
    return null
  }
  const origin = parseStoryReturn(data.origin)
  const dest = mapDestFromHref(typeof data.dest === 'string' ? data.dest : '')
  const here = mapDestFromHref(location.hash)
  if (!origin || !dest || dest !== here) {
    writeStore({ ...data, pending: false })
    return null
  }
  const prev = history.state && typeof history.state === 'object' ? history.state : {}
  history.replaceState({ ...prev, khdStoryReturn: origin }, '', location.href)
  writeStore({
    v: 1,
    origin,
    dest,
    pending: false,
    restore: false,
    t: data.t,
    historyLength: history.length,
  })
  return origin
}

function stampLeaving(origin, dest) {
  const prev = history.state && typeof history.state === 'object' ? history.state : {}
  try {
    history.replaceState({ ...prev, khdScroll: origin.scroll }, '', location.href)
  } catch {
    /* ignore */
  }
  writeStore({ v: 1, origin, dest, pending: true, restore: false, t: Date.now() })
}

export function openMapFromStory(dest, origin) {
  const parsed = parseStoryReturn(origin)
  const mapHash = mapDestFromHref(dest)
  if (!parsed || !mapHash) return false
  const prev = history.state && typeof history.state === 'object' ? { ...history.state } : {}
  delete prev.khdStoryReturn
  history.replaceState({ ...prev, khdScroll: parsed.scroll }, '', location.href)
  history.pushState({ khdStoryReturn: parsed }, '', `${currentPath()}${mapHash}`)
  writeStore({
    v: 1,
    origin: parsed,
    dest: mapHash,
    pending: false,
    restore: false,
    t: Date.now(),
    historyLength: history.length,
  })
  return true
}

/**
 * history.back() is only safe when the previous entry is still the stored
 * origin. A longer history means something else was pushed after the map
 * opened, so the control must follow returnUrl() instead.
 */
export function shouldUseHistoryBack({ historyLength, storedLength, dest, here, origin, storedOrigin } = {}) {
  if (!Number.isInteger(storedLength) || storedLength < 2 || historyLength !== storedLength) return false
  const back = parseStoryReturn(storedOrigin)
  const now = parseStoryReturn(origin)
  if (!back || !now || back.path !== now.path || back.hash !== now.hash) return false
  const want = mapDestFromHref(typeof dest === 'string' ? dest : '')
  const at = mapDestFromHref(typeof here === 'string' ? here : '')
  if (!want || want !== at) return false
  return true
}

function canHistoryBackToOrigin() {
  const data = readStore()
  return shouldUseHistoryBack({
    historyLength: history.length,
    storedLength: data?.historyLength,
    dest: data?.dest,
    here: location.hash,
    origin: currentReturn(),
    storedOrigin: data?.origin,
  })
}

function sameDocument(href) {
  try {
    const url = new URL(href, location.href)
    return url.origin === location.origin && url.pathname === currentPath()
  } catch {
    return false
  }
}

function onStoryMapClick(event) {
  const link = event.target?.closest?.('a[data-story-map]')
  if (!link) return
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  if (link.target && link.target !== '_self') return
  const href = link.getAttribute('href') || ''
  const dest = mapDestFromHref(href)
  const origin = originFromLocation()
  if (!dest || !origin) return
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  if (!sameDocument(href)) {
    stampLeaving(origin, dest)
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (openMapFromStory(dest, origin)) hooks.onNavigate()
}

function rememberRestore() {
  const data = readStore()
  const origin = parseStoryReturn(data?.origin)
  if (!origin) return
  writeStore({ ...data, origin, pending: false, restore: true })
}

function onReturnClick(event) {
  const link = event.target?.closest?.('a.story-return[data-story-return]')
  if (!link) return
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  rememberRestore()
  if (canHistoryBackToOrigin()) {
    history.back()
    return
  }
  const origin = currentReturn() || parseStoryReturn(readStore()?.origin)
  const href = returnUrl(origin)
  if (!href) return
  // assign() does not fire popstate, so stamp the stored scroll for this document.
  noteScrollRestoreFromState({ khdScroll: origin.scroll })
  location.assign(href)
}

function ensureButton() {
  let btn = document.getElementById('storyReturn')
  if (btn) return btn
  const wrap = document.querySelector('#map .map-canvas-wrap')
  if (!wrap) return null
  btn = document.createElement('a')
  btn.id = 'storyReturn'
  btn.className = 'story-return'
  btn.href = '/'
  btn.hidden = true
  btn.dataset.storyReturn = '1'
  btn.innerHTML = '<span aria-hidden="true">← </span>Back to story'
  wrap.insertBefore(btn, wrap.firstChild)
  return btn
}

function ensureLive() {
  let live = document.getElementById('storyReturnLive')
  if (live) return live
  live = document.createElement('p')
  live.id = 'storyReturnLive'
  live.className = 'visually-hidden'
  live.setAttribute('aria-live', 'polite')
  document.body.appendChild(live)
  return live
}

function headerBottom() {
  const header = document.querySelector('header.top')
  if (!header) return 0
  const rect = header.getBoundingClientRect()
  if (rect.bottom <= 0 || rect.height < 2) return 0
  return rect.bottom
}

function placeStoryReturn(btn) {
  const wrap = btn.closest('.map-canvas-wrap')
  if (!wrap) return
  const root = document.getElementById('map') || wrap
  const obstacles = []
  const groups = [
    ['.maplibregl-popup', 12],
    ['.maplibregl-ctrl-top-right, .maplibregl-ctrl-top-left', 8],
    ['.maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-attrib', 8],
    ['.full-state-fab', 8],
  ]
  for (const [sel, weight] of groups) {
    root.querySelectorAll(sel).forEach((el) => {
      if (el === btn || el.closest('[hidden]')) return
      const rect = el.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) return
      obstacles.push({ rect, weight })
    })
  }
  const wrapRect = wrap.getBoundingClientRect()
  const width = btn.offsetWidth || 168
  const height = btn.offsetHeight || 44
  const inset = 10
  const viewTop = Math.max(wrapRect.top, headerBottom())
  const viewBottom = Math.min(wrapRect.bottom, window.innerHeight)
  const viewLeft = Math.max(wrapRect.left, 0)
  const viewRight = Math.min(wrapRect.right, window.innerWidth)
  const roomY = viewBottom - viewTop
  const roomX = viewRight - viewLeft
  const candidates = []
  const push = (top, left) => {
    const relTop = Math.round(top - wrapRect.top)
    const relLeft = Math.round(left - wrapRect.left)
    if (relTop < 0 || relLeft < 0) return
    if (relTop + height > wrapRect.height + 1 || relLeft + width > wrapRect.width + 1) return
    candidates.push({ top: relTop, left: relLeft })
  }
  if (roomY >= height && roomX >= 44) {
    const yMax = viewBottom - height - inset
    const ySteps = [
      viewTop + inset,
      viewTop + inset + 52,
      viewTop + Math.max(inset, (roomY - height) / 2),
      yMax,
    ]
    const xSteps = [viewLeft + inset, viewLeft + Math.max(inset, Math.min(roomX * 0.34, roomX - width - inset))]
    for (const top of ySteps) {
      if (top < viewTop || top > yMax + 1) continue
      for (const left of xSteps) push(top, left)
    }
    const gap = 8
    for (const item of obstacles) {
      const above = Math.max(viewTop, item.rect.top - gap - height)
      if (above + height <= item.rect.top - 2 && above + height <= viewBottom - 2) {
        push(above, viewLeft + inset)
      }
      const below = Math.max(viewTop, item.rect.bottom + gap)
      if (below >= item.rect.bottom && below + height <= viewBottom - 2) push(below, viewLeft + inset)
    }
  }
  if (!candidates.length) {
    push(wrapRect.top + inset, wrapRect.left + inset)
    push(wrapRect.top + inset + 52, wrapRect.left + inset)
  }
  let best = candidates[0] || { top: inset, left: inset }
  let bestScore = Infinity
  for (const cand of candidates) {
    const box = {
      left: wrapRect.left + cand.left,
      top: wrapRect.top + cand.top,
      right: wrapRect.left + cand.left + width,
      bottom: wrapRect.top + cand.top + height,
    }
    let score = cand.top * 0.02 + cand.left * 0.01
    if (box.right > wrapRect.right - 4) score += 8000
    if (box.bottom > wrapRect.bottom - 4) score += 8000
    if (box.top < wrapRect.top) score += 8000
    if (box.top < headerBottom() - 1) score += 50000
    if (box.bottom > window.innerHeight - 4) score += 50000
    if (box.left < 0 || box.right > window.innerWidth) score += 50000
    for (const item of obstacles) {
      const pad = 6
      const w = Math.max(0, Math.min(box.right, item.rect.right + pad) - Math.max(box.left, item.rect.left - pad))
      const h = Math.max(0, Math.min(box.bottom, item.rect.bottom + pad) - Math.max(box.top, item.rect.top - pad))
      score += w * h * item.weight
    }
    if (score < bestScore) {
      bestScore = score
      best = cand
    }
  }
  const nextTop = `${best.top}px`
  const nextLeft = `${best.left}px`
  if (btn.style.top !== nextTop) btn.style.top = nextTop
  if (btn.style.left !== nextLeft) btn.style.left = nextLeft
}

let revealUntil = 0

function buttonInView(btn) {
  const rect = btn.getBoundingClientRect()
  return rect.height >= 40 && rect.top >= headerBottom() - 1 && rect.bottom <= window.innerHeight + 1 && rect.left >= -1 && rect.right <= window.innerWidth + 1
}

function armMapReveal() {
  revealUntil = performance.now() + 2600
}

/** Keep the map on screen while the page below the header is still settling. */
function revealMapForReturn(btn) {
  if (performance.now() > revealUntil) return
  const wrap = btn.closest('.map-canvas-wrap')
  if (!wrap || wrap.getBoundingClientRect().height < 40) return
  const rect = wrap.getBoundingClientRect()
  const topLimit = headerBottom()
  const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, topLimit)
  if (buttonInView(btn) && visible >= 120) return
  const top = Math.max(0, window.scrollY + rect.top - topLimit - 8)
  if (Math.abs(window.scrollY - top) < 2) return
  window.scrollTo({ top, left: 0, behavior: 'auto' })
}

function watchMapChrome() {
  const mapEl = document.getElementById('map')
  if (!mapEl || mapEl.dataset.storyReturnWatch === '1') return
  mapEl.dataset.storyReturnWatch = '1'
  let frame = 0
  const schedule = () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      const btn = document.getElementById('storyReturn')
      if (btn && !btn.hidden) {
        revealMapForReturn(btn)
        placeStoryReturn(btn)
      }
    })
  }
  const observer = new MutationObserver(schedule)
  observer.observe(mapEl, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden'],
  })
  window.addEventListener('resize', schedule)
  window.addEventListener('scroll', schedule, { passive: true })
}

export function syncStoryReturn() {
  const btn = ensureButton()
  const live = ensureLive()
  const show = Boolean(hooks.isMapView() && !hooks.isTerritory() && currentReturn())
  if (!btn) return
  if (!show) {
    btn.hidden = true
    revealUntil = 0
    if (live) {
      live.textContent = ''
      delete live.dataset.shown
    }
    return
  }
  const href = returnUrl(currentReturn())
  if (href) btn.href = href
  const wasHidden = btn.hidden
  btn.hidden = false
  btn.dataset.storyReturn = '1'
  if (wasHidden) armMapReveal()
  const place = () => {
    if (btn.hidden) return
    revealMapForReturn(btn)
    placeStoryReturn(btn)
  }
  place()
  requestAnimationFrame(() => requestAnimationFrame(place))
  for (const delay of [120, 400, 900, 1600, 2400]) {
    window.setTimeout(place, delay)
  }
  if (live && live.dataset.shown !== '1') {
    live.textContent = 'Back to story is available'
    live.dataset.shown = '1'
  }
}

/** Territory view uses the same control. A stored origin wins; otherwise the story slug. */
export function territoryBackHtml(slug) {
  const origin = currentReturn()
  const fromHistory = returnUrl(origin)
  let href = fromHistory
  if (!href && SLUG_RE.test(String(slug || ''))) href = `/stories/${slug}/`
  if (!href) return ''
  const flag = fromHistory ? ' data-story-return="1"' : ''
  return `<a class="story-return" href="${escAttr(href)}"${flag}><span aria-hidden="true">← </span>Back to story</a>`
}

export function installStoryReturn(options = {}) {
  hooks.onNavigate = typeof options.onNavigate === 'function' ? options.onNavigate : hooks.onNavigate
  hooks.isMapView = typeof options.isMapView === 'function' ? options.isMapView : hooks.isMapView
  hooks.isTerritory = typeof options.isTerritory === 'function' ? options.isTerritory : hooks.isTerritory
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  stripReturnAfterReload()
  adoptCrossPageReturn()
  prepareScrollRestore()
  if (!placed) {
    placed = true
    document.addEventListener('click', onStoryMapClick, true)
    document.addEventListener('click', onReturnClick, true)
    window.addEventListener('popstate', () => {
      noteScrollRestoreFromState(history.state)
    })
    watchMapChrome()
  }
  ensureButton()
  ensureLive()
}

/**
 * Boot for prerendered pages, which do not load the app bundle.
 * Kept as source text so the allowlists stay the ones above.
 */
export function staticPageBootScript() {
  return `(function () {
    var KEY = ${JSON.stringify(STORAGE_KEY)};
    var PATH = ${PATH_RE.toString()};
    var HASH = ${HASH_RE.toString()};
    var MAX = ${MAX_SCROLL};
    function scrollOf(n) {
      if (typeof n !== 'number' || !isFinite(n) || n < 0 || n > MAX) return null;
      return Math.round(n);
    }
    function pathNow() {
      var p = location.pathname || '/';
      return p === '/index.html' ? '/' : p;
    }
    function hashNow() {
      return (location.hash || '').replace(/^#/, '');
    }
    function read() {
      try {
        var raw = sessionStorage.getItem(KEY);
        if (!raw || raw.length > 2000) return null;
        var data = JSON.parse(raw);
        return data && typeof data === 'object' ? data : null;
      } catch (e) { return null; }
    }
    function write(data) {
      try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    }
    function mapHash(href) {
      if (!href || href.length > 400 || /[\\s<>"'\\\\:]/.test(href) || href.indexOf('//') !== -1) return '';
      var i = href.indexOf('#');
      if (i < 0) return '';
      var before = href.slice(0, i);
      if (before !== '' && before !== '/' && before.indexOf('/?') !== 0) return '';
      var hash = href.slice(i);
      if (hash.indexOf('#map/') !== 0) return '';
      var parts = hash.slice(1).split('/');
      if (parts.length < 2 || parts.length > 4 || parts[0] !== 'map') return '';
      for (var n = 1; n < parts.length; n++) {
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/.test(parts[n]) || parts[n].indexOf('..') !== -1) return '';
      }
      return hash;
    }
    function restore() {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      var back = !!(nav && nav.type === 'back_forward');
      var data = read();
      var y = null;
      var st = history.state;
      if (st && typeof st === 'object') y = scrollOf(st.khdScroll);
      if (y == null && data && data.origin && (back || data.restore === true)) {
        var o = data.origin;
        if (o && PATH.test(o.path) && HASH.test(o.hash || '') && o.path === pathNow() && (o.hash || '') === hashNow()) {
          y = scrollOf(o.scroll);
        }
      }
      if (y == null) return;
      var apply = function () { window.scrollTo(0, y); };
      apply();
      requestAnimationFrame(apply);
      setTimeout(apply, 60);
      setTimeout(apply, 240);
      if (data && data.restore) {
        data.restore = false;
        write(data);
      }
    }
    window.addEventListener('pageshow', restore);
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[data-story-map]') : null;
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self') return;
      var dest = mapHash(a.getAttribute('href') || '');
      if (!dest) return;
      var path = pathNow();
      var hash = hashNow();
      var scroll = scrollOf(window.scrollY || 0);
      if (!PATH.test(path) || !HASH.test(hash) || scroll == null) return;
      var origin = { v: 1, path: path, hash: hash, scroll: scroll };
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      try { history.replaceState({ khdScroll: scroll }, '', location.href); } catch (err) {}
      write({ v: 1, origin: origin, dest: dest, pending: true, restore: false, t: Date.now() });
    }, true);
  })();`
}

export function staticPageBootHtml() {
  return `<script>${staticPageBootScript()}</script>`
}
