/**
 * "Explore a layer" magazine pages (homepage).
 *
 * Every curated item that has a real same-origin featured photo + credit is
 * shown exactly once, split into fixed-size pages:
 *   - "On the map": one curated stop per map layer (the original 12 cards)
 *   - one tab per story era (Prehistoric / Native / Frontier / Early commonwealth / Other):
 *     every story in stories.json that has a curated photo in story-photos.json
 * Stories without a photo are not listed (no empty image panels, no invented photos).
 *
 * URL: #explore/<tab>/<page> (page is 1-based). Page turns push history entries so
 * Back/Forward and shared links land on the same page.
 * Code-only: reads existing /content/*.json packs and photos; no data changes.
 */

import { AdSlot } from './ad-slot.js'
import { responsivePicture } from './responsive-img.js'
import { HomepageStructure } from './homepage-structure.js'

const TABS_ERA = [
  { id: 'prehistoric', label: 'Prehistoric' },
  { id: 'native', label: 'Native' },
  { id: 'frontier', label: 'Frontier' },
  { id: 'early-commonwealth', label: 'Early commonwealth' },
  { id: 'other', label: 'Other' },
]
const MAP_TAB = { id: 'map', label: 'On the map' }
// First daily pack published under the magazine homepage (#72 went live 2026-09-20 after that
// morning's ingest). Every story with publishedDate >= this date (and a real photo) is listed in
// the "Daily stories" tab, newest first, so each new daily pack is picked up automatically.
const MAGAZINE_START = '2026-09-21'
const DAILY_TAB = { id: 'daily', label: 'Daily stories' }

const MQ_DESKTOP = '(min-width: 1000px)'
const MQ_TABLET = '(min-width: 620px)'

function pageSize() {
  if (window.matchMedia(MQ_DESKTOP).matches) return 6
  if (window.matchMedia(MQ_TABLET).matches) return 4
  return 6
}

function isNarrow() {
  return window.matchMedia('(max-width: 619px)').matches
}

export function parseExploreHash(hash = location.hash) {
  const raw = String(hash || '').replace(/^#/, '')
  if (raw !== 'explore' && !raw.startsWith('explore/')) return null
  const [, tab, page] = raw.split('/')
  const n = parseInt(page, 10)
  return { tab: tab ? decodeURIComponent(tab) : null, page: Number.isFinite(n) && n > 0 ? n : 1 }
}

async function fetchJson(url) {
  try {
    const res = await fetch(url)
    if (res.ok) return await res.json()
  } catch {
    /* optional */
  }
  return null
}

function sortStories(a, b) {
  const ya = Number.isFinite(Number(a.yearStart)) ? Number(a.yearStart) : 99999
  const yb = Number.isFinite(Number(b.yearStart)) ? Number(b.yearStart) : 99999
  if (ya !== yb) return ya - yb
  return String(a.title).localeCompare(String(b.title))
}

/** helpers come from home-preview.js (shared escaping / photo rules). */
export async function initExploreLayer({ root, layers, helpers, skipSlugs = [] }) {
  if (!root) return
  const {
    escapeHtml: esc,
    usablePhoto,
    photoCredit,
    eraLabel,
    storyYearLabel,
    storyMapHref,
    curatedLayer,
    layerHref,
    LAYER_HIGHLIGHTS,
  } = helpers

  // ---- Build item lists --------------------------------------------------
  const layerItems = (layers?.length ? layers : LAYER_HIGHLIGHTS).map((item) => {
    const curated = curatedLayer(item)
    const photo =
      curated?.photo?.image_url && curated.placeId === item.placeId
        ? curated.photo
        : item.photo?.image_url
          ? item.photo
          : curated?.photo
    const href = layerHref(item)
    return {
      key: `layer:${item.layerId}:${item.placeId}`,
      kicker: [item.layerLabel, item.place].filter(Boolean).join(' · '),
      title: item.name,
      deck: item.blurb || curated?.blurb || '',
      href,
      cta: 'Open on the map',
      photo: usablePhoto(photo),
    }
  })

  const [storiesIdx, photosIdx, locIdx] = await Promise.all([
    fetchJson('/content/stories.json'),
    fetchJson('/content/story-photos.json'),
    fetchJson('/content/stories-locations.json'),
  ])
  const bySlug = photosIdx?.bySlug || {}
  const locations = locIdx?.locations || {}
  const storyItems = {}
  for (const t of TABS_ERA) storyItems[t.id] = []
  const daily = []
  const dailySeen = new Set()
  const seen = new Set()
  for (const s of (storiesIdx?.stories || []).slice().sort(sortStories)) {
    if (!s?.slug || seen.has(s.slug)) continue
    const photo = usablePhoto(bySlug[s.slug]?.photo)
    if (!photo || !photoCredit(photo)) continue
    seen.add(s.slug)
    const era = storyItems[s.era] ? s.era : 'other'
    const loc = locations[s.slug] || {}
    const mapHref = storyMapHref({
      slug: s.slug,
      historyId: bySlug[s.slug]?.historyId || loc.historyId || null,
      lat: s.lat ?? loc.lat ?? null,
      lon: s.lon ?? loc.lon ?? null,
    })
    const year = storyYearLabel(s.yearStart)
    const item = {
      key: `story:${s.slug}`,
      kicker: `${eraLabel(era)}${year ? ` · ${year}` : ''}`,
      title: s.title,
      deck: s.summary || '',
      href: `/#timeline/${encodeURIComponent(s.slug)}`,
      cta: 'Read the story',
      mapHref,
      photo,
    }
    storyItems[era].push(item)
    const pub = String(s.publishedDate || s.briefDate || '')
    if (pub >= MAGAZINE_START && !dailySeen.has(s.slug)) {
      dailySeen.add(s.slug)
      daily.push({ ...item, pub, order: daily.length })
    }
  }
  // Newest pack first; within a pack keep the story's timeline order.
  daily.sort((a, b) => (a.pub === b.pub ? a.order - b.order : a.pub < b.pub ? 1 : -1))
  // Default first page skips the hero carousel. Those stories stay later in the list.
  const dailyItems = HomepageStructure.deferFromFirstPage(daily, skipSlugs, HomepageStructure.EXPLORE_DEFER_PAGE)
  daily.length = 0
  daily.push(...dailyItems)

  const tabs = []
  if (daily.length) tabs.push({ ...DAILY_TAB, items: daily })
  tabs.push({ ...MAP_TAB, items: layerItems.filter((i) => i.photo) })
  for (const t of TABS_ERA) if (storyItems[t.id].length) tabs.push({ ...t, items: storyItems[t.id] })
  for (let i = tabs.length - 1; i >= 0; i--) if (!tabs[i].items.length) tabs.splice(i, 1)
  if (!tabs.length) {
    root.innerHTML = `<p class="muted">Stories with photos will appear here soon. Try the <a href="/#timeline">Timeline</a>.</p>`
    return
  }

  // ---- State -------------------------------------------------------------
  let size = pageSize()
  let tabIdx = 0
  let page = 1

  const pagesFor = (t) => Math.max(1, Math.ceil(t.items.length / size))
  const tabById = (id) => tabs.findIndex((t) => t.id === id)
  const hashFor = (tab, p) => `#explore/${encodeURIComponent(tab.id)}/${p}`

  // ---- Shell (rendered once) ---------------------------------------------
  root.innerHTML = `
    <div class="exp-shell">
      <div class="exp-topbar">
        <nav class="exp-tabs" aria-label="Story archive sections"><ul></ul></nav>
      </div>
      <div class="exp-pagebar exp-pagebar-top"><nav class="exp-pager" aria-label="Pages (top)"></nav><p class="exp-count muted" aria-hidden="true"></p></div>
      <div class="exp-viewport" role="region" tabindex="0" aria-roledescription="magazine pages">
        <div class="exp-pages"></div>
      </div>
      <div class="exp-pagebar exp-pagebar-bottom">
        <nav class="exp-pager" aria-label="Pages (bottom)"></nav>
        <button type="button" class="scroll-fab nav-jump exp-home" title="Back to the home page" aria-label="Home: back to the top of the home page"><span class="nav-jump-ico" aria-hidden="true">⌂</span><span class="nav-jump-label">Home</span></button>
      </div>
      <button type="button" class="btn exp-more" hidden>Load more</button>
      <p class="exp-hint muted">Turn pages with the buttons, the ← → keys, or a swipe. Every story is also in the <a href="/#timeline">Timeline</a>.</p>
      <p class="exp-status sr-only" role="status" aria-live="polite"></p>
    </div>`
  const el = {
    tabsUl: root.querySelector('.exp-tabs ul'),
    pagers: [...root.querySelectorAll('.exp-pager')],
    counts: [...root.querySelectorAll('.exp-count')],
    viewport: root.querySelector('.exp-viewport'),
    pages: root.querySelector('.exp-pages'),
    status: root.querySelector('.exp-status'),
    homes: [...root.querySelectorAll('.exp-home')],
  }
  const section = root.closest('section') || root

  function cardHtml(item, idx) {
    const credit = photoCredit(item.photo)
    const alt = item.photo.title || item.title
    const deckText = HomepageStructure.deckText(item.deck)
    const deck = deckText ? `<p class="exp-deck">${esc(deckText)}</p>` : '<p class="exp-deck"></p>'
    const map = item.mapHref
      ? `<a class="exp-sec" href="${esc(item.mapHref)}" aria-label="${esc(item.title)} on the map">On the map</a>`
      : ''
    return `<article class="exp-card" data-key="${esc(item.key)}">
      <a class="exp-media" href="${esc(item.href)}" aria-label="Read: ${esc(item.title)}" tabindex="-1" aria-hidden="true">${responsivePicture({
        src: item.photo.image_url,
        alt,
        loading: 'lazy',
        sizes: '(max-width: 619px) 100vw, (max-width: 999px) 50vw, 33vw',
      })}</a>
      <div class="exp-copy">
        <p class="hp-card-layer exp-kicker">${esc(item.kicker)}</p>
        <h3 class="exp-title"><a href="${esc(item.href)}">${esc(item.title)}</a></h3>
        ${deck}
        <div class="exp-actions">
          <a class="hp-layer-cta" href="${esc(item.href)}" aria-label="${esc(item.cta)}: ${esc(item.title)}">${esc(item.cta)}</a>
          ${map}
        </div>
        <p class="hp-photo-credit exp-credit">Photo: ${esc(credit)}</p>
      </div>
    </article>`
  }

  function renderTabs() {
    el.tabsUl.innerHTML = tabs
      .map(
        (t, i) =>
          `<li><a class="exp-tab" href="${hashFor(t, 1)}" data-tab="${esc(t.id)}"${i === tabIdx ? ' aria-current="true"' : ''}>${esc(t.label)} <span class="exp-tab-n">${t.items.length}</span></a></li>`,
      )
      .join('')
  }

  function pagerHtml(total) {
    const tab = tabs[tabIdx]
    const prev =
      page > 1
        ? `<a class="exp-step" data-step="prev" href="${hashFor(tab, page - 1)}" aria-label="Previous page"><span aria-hidden="true">‹</span> Prev</a>`
        : `<span class="exp-step is-disabled" aria-disabled="true"><span aria-hidden="true">‹</span> Prev</span>`
    const next =
      page < total
        ? `<a class="exp-step" data-step="next" href="${hashFor(tab, page + 1)}" aria-label="Next page">Next <span aria-hidden="true">›</span></a>`
        : `<span class="exp-step is-disabled" aria-disabled="true">Next <span aria-hidden="true">›</span></span>`
    let nums = ''
    // Long tabs: 1 … (page-1) page (page+1) … last, so the bar fits at 390px.
    const show = (p) => total <= 7 || p === 1 || p === total || Math.abs(p - page) <= 1
    for (let p = 1; p <= total; p++) {
      if (!show(p)) {
        if (show(p - 1)) nums += `<span class="exp-gap" aria-hidden="true">…</span>`
        continue
      }
      nums += `<a class="exp-num" data-page="${p}" href="${hashFor(tab, p)}" aria-label="Page ${p} of ${total}"${p === page ? ' aria-current="page"' : ''}>${p}</a>`
    }
    return `${prev}<span class="exp-nums">${nums}</span>${next}`
  }

  function render({ focus = null } = {}) {
    const tab = tabs[tabIdx]
    const total = pagesFor(tab)
    page = Math.min(Math.max(1, page), total)
    // Phones show 6, then Load more keeps the earlier cards and brings in the next 6.
    // Wider screens still replace the page, 6 on desktop and 4 on tablet.
    const narrow = isNarrow()
    const from = narrow ? 0 : (page - 1) * size
    const take = narrow ? Math.min(tab.items.length, page * size) : size
    const slice = tab.items.slice(from, from + take)
    const atEnd = from + slice.length >= tab.items.length
    // Pad short last pages so the page height never changes: the first spare slot becomes an
    // "end of section" card (continue to the next section / back to the start), the rest are invisible.
    const spare = narrow ? (atEnd ? 1 : 0) : size - slice.length
    let endCard = ''
    if (spare > 0) {
      const nextTab = tabs[(tabIdx + 1) % tabs.length]
      const isLast = tabIdx === tabs.length - 1
      endCard = `<div class="exp-card exp-end"><div class="exp-media" aria-hidden="true"></div><div class="exp-copy"></div>
        <div class="exp-end-body"><p class="hp-card-layer">${esc(tab.label)} · end</p>
          <p class="exp-end-title">${isLast ? 'You have reached the last section.' : 'That is every story in this section.'}</p>
          <a class="btn exp-end-cta" data-tab="${esc(nextTab.id)}" href="${hashFor(nextTab, 1)}">${isLast ? 'Back to' : 'Continue to'} ${esc(nextTab.label)} <span aria-hidden="true">›</span></a></div></div>`
    }
    const ghosts = Array.from({ length: Math.max(0, spare - 1) }, () => '<div class="exp-card exp-ghost" aria-hidden="true"><div class="exp-media"></div><div class="exp-copy"></div></div>').join('')
    el.pages.innerHTML = slice.map(cardHtml).join('') + endCard + ghosts
    el.pages.dataset.tab = tab.id
    el.pages.dataset.page = String(page)
    el.viewport.setAttribute('aria-label', `${tab.label}, page ${page} of ${total}`)
    renderTabs()
    el.pagers.forEach((p) => (p.innerHTML = pagerHtml(total)))
    const label = `${tab.label}: stories ${from + 1}–${from + slice.length} of ${tab.items.length} · page ${page} of ${total}`
    el.counts.forEach((c) => (c.textContent = label))
    el.status.textContent = label
    const more = root.querySelector('.exp-more')
    if (more) more.hidden = !(narrow && page < total)
    const shell = root.querySelector('.exp-shell')
    if (page >= 2) AdSlot.mount(shell, 'explore')
    else AdSlot.unmount(shell)
    if (focus) {
      const bar = `.exp-pagebar-${focus.bar}`
      const target =
        root.querySelector(`${bar} [data-${focus.attr}="${focus.val}"]`) ||
        root.querySelector(`${bar} .exp-num[aria-current="page"]`)
      target?.focus({ preventScroll: true })
    }
  }

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function scrollToSection() {
    const header = document.querySelector('header.top')
    const hh = header ? header.getBoundingClientRect().height : 0
    const rect = section.getBoundingClientRect()
    const y = window.scrollY + rect.top - hh - 8
    window.scrollTo({ top: Math.max(0, y), left: 0, behavior: 'auto' })
  }

  /** Move to a tab/page. push=true adds a history entry (Back / Forward / share). */
  function go(tabId, p, { push = true, scroll = false, focus = null, dir = 0 } = {}) {
    const ti = tabById(tabId)
    if (ti < 0) return
    const total = pagesFor(tabs[ti])
    const target = Math.min(Math.max(1, p), total)
    const changed = ti !== tabIdx || target !== page
    tabIdx = ti
    page = target
    if (push && changed) {
      const h = currentHash()
      if (location.hash !== h) history.pushState(null, '', h)
    }
    if (changed && dir && !reduced()) {
      el.pages.classList.remove('is-turn-next', 'is-turn-prev')
      void el.pages.offsetWidth
      el.pages.classList.add(dir > 0 ? 'is-turn-next' : 'is-turn-prev')
    }
    render({ focus })
    if (scroll) scrollToSection()
  }

  const currentHash = () => hashFor(tabs[tabIdx], page)

  function step(delta, opts = {}) {
    const tab = tabs[tabIdx]
    const target = Math.min(Math.max(1, page + delta), pagesFor(tab))
    if (target === page) return
    go(tab.id, target, { dir: delta, ...opts })
  }

  // ---- Events ------------------------------------------------------------
  root.querySelector('.exp-more')?.addEventListener('click', () => {
    const tab = tabs[tabIdx]
    if (page >= pagesFor(tab)) return
    go(tab.id, page + 1, { dir: 1, scroll: false })
  })

  root.addEventListener('click', (e) => {
    const a = e.target.closest('a')
    if (!a || !root.contains(a)) return
    const tab = a.closest('.exp-tab, .exp-end-cta')
    if (tab) {
      e.preventDefault()
      go(tab.dataset.tab, 1, { dir: 0 })
      root.querySelector(`.exp-tab[data-tab="${tab.dataset.tab}"]`)?.focus({ preventScroll: true })
      if (tab.classList.contains('exp-end-cta')) scrollToSection()
      return
    }
    const stepEl = a.closest('.exp-step, .exp-num')
    if (stepEl) {
      e.preventDefault()
      const bar = a.closest('.exp-pagebar-bottom') ? 'bottom' : 'top'
      const p = stepEl.dataset.step
        ? page + (stepEl.dataset.step === 'next' ? 1 : -1)
        : parseInt(stepEl.dataset.page, 10)
      const focus = stepEl.dataset.step
        ? { bar, attr: 'step', val: stepEl.dataset.step }
        : { bar, attr: 'page', val: stepEl.dataset.page }
      // From the bottom bar, bring the new page's first card into view (no jump from the top bar).
      go(tabs[tabIdx].id, p, { dir: p > page ? 1 : -1, focus, scroll: bar === 'bottom' })
      return
    }
    // Opening a story / map link from a page: stamp this page into the current history entry
    // so Back (or Home on the story) returns to the same page.
    if (a.closest('.exp-card')) history.replaceState(null, '', currentHash())
  })

  // Home: same behavior as the story-nav Home button (clean home URL, top of the home page).
  // Also turns this section back to its first page; the page container height is fixed, so nothing jumps.
  el.homes.forEach((b) =>
    b.addEventListener('click', () => {
      tabIdx = 0
      page = 1
      render()
      if (location.hash) history.pushState(null, '', location.pathname)
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }),
  )

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (document.getElementById('home')?.hidden) return
    const t = e.target
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], .maplibregl-map')) return
    const inside = root.contains(document.activeElement)
    if (!inside) {
      // Only when focus is on the page itself and the section is the main thing on screen.
      if (document.activeElement && document.activeElement !== document.body) return
      const r = root.getBoundingClientRect()
      const mid = window.innerHeight / 2
      if (!(r.top < mid && r.bottom > mid)) return
    }
    e.preventDefault()
    const pager = document.activeElement?.closest?.('.exp-pager')
    const bar = pager?.closest('.exp-pagebar-bottom') ? 'bottom' : 'top'
    step(e.key === 'ArrowRight' ? 1 : -1, pager ? { focus: { bar, attr: 'page', val: '__current' } } : {})
  })

  // Swipe (touch)
  let sx = 0
  let sy = 0
  let st = 0
  el.viewport.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
      st = Date.now()
    },
    { passive: true },
  )
  el.viewport.addEventListener(
    'touchend',
    (e) => {
      if (!sx && !sy) return
      const t = e.changedTouches[0]
      const dx = t.clientX - sx
      const dy = t.clientY - sy
      const dt = Date.now() - st
      sx = sy = 0
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || dt > 900) return
      step(dx < 0 ? 1 : -1)
    },
    { passive: true },
  )

  // Back / Forward / pasted hash while on the page
  function applyHash({ scroll }) {
    const h = parseExploreHash()
    if (!h) {
      tabIdx = 0
      page = 1
      render()
      return
    }
    const ti = tabById(h.tab)
    tabIdx = ti >= 0 ? ti : 0
    page = h.page
    render()
    if (location.hash !== currentHash()) history.replaceState(null, '', currentHash())
    if (scroll) {
      requestAnimationFrame(() => scrollToSection(false))
      window.setTimeout(() => scrollToSection(false), 120)
    }
  }
  window.addEventListener('hashchange', () => {
    if (document.getElementById('home')?.hidden) return
    const h = parseExploreHash()
    if (h) applyHash({ scroll: true })
    else if (tabIdx !== 0 || page !== 1) applyHash({ scroll: false })
  })
  window.addEventListener('popstate', () => {
    // pushState entries do not fire hashchange; keep the page in sync
    if (document.getElementById('home')?.hidden) return
    const h = parseExploreHash()
    if (h) applyHash({ scroll: true })
    else if (tabIdx !== 0 || page !== 1) applyHash({ scroll: false })
  })

  // Viewport size class changed: keep the first visible story on screen.
  // Crossing 619px also switches Load more on, even when the page size stays 6.
  let narrowMode = isNarrow()
  const onSize = () => {
    const next = pageSize()
    const nowNarrow = isNarrow()
    if (next === size && nowNarrow === narrowMode) return
    if (next !== size) {
      const first = narrowMode ? 0 : (page - 1) * size
      size = next
      page = Math.floor(first / size) + 1
    }
    narrowMode = nowNarrow
    render()
    const h = parseExploreHash()
    if (h) history.replaceState(null, '', currentHash())
  }
  window.matchMedia(MQ_DESKTOP).addEventListener('change', onSize)
  window.matchMedia(MQ_TABLET).addEventListener('change', onSize)
  window.matchMedia('(max-width: 619px)').addEventListener('change', onSize)

  // ---- First paint ------------------------------------------------------
  const initial = parseExploreHash()
  if (initial) {
    const ti = tabById(initial.tab)
    tabIdx = ti >= 0 ? ti : 0
    page = initial.page
  }
  render()
  // Out-of-range / unknown hashes (…/99, unknown tab) settle on the page actually shown.
  if (initial && location.hash !== currentHash()) history.replaceState(null, '', currentHash())
  if (initial) {
    // Deep link / reload: land on the section (hero + images above may still settle).
    requestAnimationFrame(() => scrollToSection(false))
    window.setTimeout(() => scrollToSection(false), 250)
    window.setTimeout(() => scrollToSection(false), 900)
  }
  root.dataset.ready = '1'
}
