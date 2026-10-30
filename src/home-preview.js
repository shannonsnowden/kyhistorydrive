/**
 * Magazine homepage for `/` (empty hash / #home).
 *
 * Daily refresh:
 *   1. Load /content/home-preview.json (built from the newest briefDate).
 *   2. Also load /content/stories.json. If its latest briefDate is newer,
 *      fetch those story files and Wikipedia thumbnails so the page updates
 *      on the same deploy as the morning ingest.
 *   3. If the latest feed is empty, keep the baked pack (curated fallback).
 *
 * Presentation is evergreen: no “this morning” / calendar-date kickers.
 * Map, Timeline, About, and App stay on the existing hash routes.
 */
import { LAYER_HIGHLIGHTS, RELATED_GROUPS } from './home-preview-data.js'
import { initExploreLayer } from './explore-layer.js'
import { AdSlot } from './ad-slot.js'
import { loadPhotoVariants } from './responsive-img.js'
import { HomepageStructure } from './homepage-structure.js'
import { storyBlocksAutoPhoto } from './no-auto-story-photos.js'
import {
  escapeHtml,
  formatDisplayDate,
  storyYearLabel,
  eraLabel,
  firstSentence,
  heroDeckText,
  storyMapHref,
  isPhotoUrl,
  usablePhoto,
  photoCredit,
  placeCaption,
  cardAlt,
  renderLeadStory,
  renderRailCard,
  renderSwipeCard,
  leadPreloadTag,
  withDefaultHero,
} from './home-hero-render.js'
import { storyUrl } from './story-url.js'

function extractWikipediaUrl(markdown) {
  const m = String(markdown || '').match(/https?:\/\/en\.wikipedia\.org\/wiki\/[^\s)\]">]+/i)
  return m ? m[0].replace(/[.,;:]+$/g, '') : null
}

function wikiTitleFromUrl(url) {
  try {
    const u = new URL(url)
    return decodeURIComponent(u.pathname.replace(/^\/wiki\//, '')).replace(/_/g, ' ')
  } catch {
    return null
  }
}

async function fetchWikipediaPhoto(titleOrUrl) {
  if (!titleOrUrl) return null
  let title = /^https?:\/\//i.test(titleOrUrl) ? wikiTitleFromUrl(titleOrUrl) : titleOrUrl
  title = String(title || '').trim()
  if (!title) return null
  try {
    const api = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
    const res = await fetch(api, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    const src = data.originalimage?.source || data.thumbnail?.source
    if (!src || !isPhotoUrl(src)) return null
    return {
      image_url: src,
      title: data.title || title,
      source_url: data.content_urls?.desktop?.page,
      source_label: 'Wikipedia',
      attribution: 'Wikipedia',
    }
  } catch {
    return null
  }
}

async function liveStoriesForDate(briefDate, index, locations = {}) {
  const metas = index.stories.filter((s) => s.briefDate === briefDate)
  const cards = []
  for (const meta of metas) {
    let full = meta
    try {
      const res = await fetch(`/content/stories/${encodeURIComponent(meta.slug)}.json`)
      if (res.ok) full = await res.json()
    } catch {
      /* use index row */
    }
    const wiki = extractWikipediaUrl(full.bodyMarkdown)
    const slug = full.slug || meta.slug
    const stored = usablePhoto(full.photo) || usablePhoto(meta.photo)
    // Only try Wikipedia when the story cites a wiki URL — title fallback 404s (e.g. theme-only briefs).
    // Blocked slugs stay empty unless a hand-picked file is already stored.
    const photo = stored || (wiki && !storyBlocksAutoPhoto(slug) ? await fetchWikipediaPhoto(wiki) : null)
    const loc = locations[slug] || {}
    const lat = loc.lat ?? meta.lat ?? null
    const lon = loc.lon ?? meta.lon ?? null
    const historyId = loc.historyId || meta.historyId || null
    const card = {
      slug,
      title: full.title || meta.title,
      summary: full.summary || meta.summary || '',
      era: full.era || meta.era || '',
      yearStart: full.yearStart ?? meta.yearStart ?? null,
      county: full.county || meta.county || null,
      briefDate,
      href: storyUrl(slug),
      place: loc.matchedPlace || null,
      lat,
      lon,
      historyId,
      quote: firstSentence(full.bodyMarkdown || full.summary || ''),
      photo,
    }
    card.mapHref = storyMapHref(card)
    cards.push(card)
  }
  const withPhotos = cards.filter((c) => usablePhoto(c.photo))
  const hero = withPhotos[0] || cards[0] || null
  return {
    briefDate,
    displayDate: formatDisplayDate(briefDate),
    stories: cards,
    hero,
    features: cards.filter((c) => c !== hero),
    quote: hero?.quote ? { text: hero.quote, source: hero.title, href: hero.href } : null,
  }
}

function briefStories(pack) {
  if (Array.isArray(pack?.stories) && pack.stories.length) return pack.stories
  const list = []
  if (pack?.hero) list.push(pack.hero)
  for (const item of pack?.features || []) {
    if (item && item.slug !== pack.hero?.slug) list.push(item)
  }
  return list
}

function heroSlides(pack) {
  const all = briefStories(pack)
  const withPhotos = all.filter((s) => usablePhoto(s?.photo))
  const slides = withPhotos.length ? withPhotos : all[0] ? [all[0]] : []
  return withDefaultHero(slides)
}

function preloadLeadImage(story) {
  if (!usablePhoto(story?.photo)) return
  // The build writes the same tag into <head> (scripts/prerender-home-hero.mjs); dev only adds it here.
  if (document.getElementById('hpLeadPreload')?.getAttribute('href') === story.photo.image_url) return
  const src = story.photo.image_url
  const existing = document.getElementById('hpLeadPreload')
  if (existing) existing.remove()
  const link = document.createElement('link')
  link.id = 'hpLeadPreload'
  link.rel = 'preload'
  link.as = 'image'
  link.href = src
  link.fetchPriority = 'high'
  // If responsive variants exist on the rendered picture, mirror imagesrcset from the first webp source.
  const pic = document.querySelector('#hpHero picture source[type="image/webp"]')
  if (pic?.getAttribute('srcset')) {
    link.setAttribute('imagesrcset', pic.getAttribute('srcset'))
    const sizes = pic.getAttribute('sizes') || '(max-width: 900px) 100vw, 66vw'
    link.setAttribute('imagesizes', sizes)
  }
  document.head.appendChild(link)
}

function renderHero(pack) {
  const root = document.getElementById('hpHero')
  const rail = document.getElementById('hpStoryRail')
  const swipe = document.getElementById('hpStorySwipe')
  if (!root) return
  const slides = heroSlides(pack)
  if (!slides.length) {
    root.innerHTML = `<div class="hp-mag-hero-copy">
      <p class="hp-kicker">Kentucky History Drive</p>
      <h2 id="hp-hero-title">Kentucky history is all around us.</h2>
      <p>Stories will appear here as they’re published. Open the map or timeline to explore.</p>
      <div class="hp-cta-row">
        <a class="btn hp-cta" href="/#map">Open the map</a>
        <a class="btn hp-cta" href="/#timeline">Timeline</a>
      </div>
    </div>`
    if (rail) rail.innerHTML = ''
    if (swipe) swipe.innerHTML = ''
    root.removeAttribute('aria-busy')
    return
  }
  const lead = slides[0]
  const more = slides.slice(1, 5)
  // The build wrote the lead + cards into index.html (scripts/prerender-home-hero.mjs).
  // Keep that markup: no lead image swap on load, even if newer data picks a different lead.
  if (root.querySelector('.hp-lead-story')) {
    root.removeAttribute('aria-busy')
    markPortraitHeroImages(root)
    fitHomeText()
    return
  }
  root.innerHTML = renderLeadStory(lead)
  root.removeAttribute('aria-busy')
  if (rail) rail.innerHTML = more.map(renderRailCard).join('')
  if (swipe) swipe.innerHTML = more.map(renderSwipeCard).join('')
  markPortraitHeroImages(root)
  fitHomeText()
  // Preload after picture sources exist in the DOM.
  requestAnimationFrame(() => preloadLeadImage(lead))
  // No auto-rotation: the former carousel controls are gone.
}

/**
 * Tall (portrait) photos in the wide hero: object-fit: cover crops them to a band through the
 * middle, which cuts faces off at the eyes (e.g. the 2026-10-06 Charles Scott portrait at 1280).
 * Bias portrait crops toward the top so heads stay in frame; landscape photos are unchanged.
 */
function markPortraitHeroImages(root) {
  root.querySelectorAll('img.hp-mag-hero-img').forEach((img) => {
    const mark = () => {
      if (img.naturalWidth && img.naturalHeight > img.naturalWidth * 1.05) {
        img.classList.add('is-portrait')
        // Tall portraits: show the whole picture beside/above the headline on a blurred
        // copy of itself instead of cropping the face behind the text (see styles.css).
        const media = img.closest('.hp-mag-hero-media')
        if (media) {
          media.classList.add('has-portrait')
          media.style.setProperty('--hp-hero-bg', `url("${img.currentSrc || img.src}")`)
        }
      }
    }
    if (img.complete) mark()
    else img.addEventListener('load', mark, { once: true })
  })
}

/**
 * Fixed-size text boxes (hero title/deck): the box height is set in CSS per
 * breakpoint, so rotating slides never moves anything. If a string is too long for its
 * box at the default size, shrink the font (down to ~0.8x / 14px); if it still does not
 * fit, leave it at the minimum size and let the box scroll (with a fade hint) — never
 * truncate.
 */
const FIT_MIN_SCALE = 0.8
const FIT_MIN_PX = 14
// Headlines (the hero <h2>) must never hide words behind a scroll fade, so they
// may shrink further before falling back to scrolling (2026-10-07: long titles
// like "McLean Drift Bank: Kentucky's first commercial coal mine (1820)" lost
// their last line at 0.8x).
const FIT_TITLE_MIN_SCALE = 0.5
const FIT_TITLE_MIN_PX = 18

function fitEl(el) {
  el.style.setProperty('--fit', '1')
  el.classList.remove('is-scrollable', 'at-end')
  el.removeAttribute('tabindex')
  el.removeAttribute('aria-label')
  if (!el.clientHeight) return // not rendered (hidden); re-run when it becomes visible
  const over = () => el.scrollHeight > el.clientHeight + 1
  if (!over()) return
  const target = el
  const basePx = parseFloat(getComputedStyle(target).fontSize) || 16
  const isTitle = el.tagName === 'H2'
  const min = isTitle
    ? Math.min(1, Math.max(FIT_TITLE_MIN_SCALE, FIT_TITLE_MIN_PX / basePx))
    : Math.min(1, Math.max(FIT_MIN_SCALE, FIT_MIN_PX / basePx))
  el.style.setProperty('--fit', String(min))
  if (over()) {
    el.classList.add('is-scrollable')
    el.setAttribute('tabindex', '0')
    el.setAttribute('aria-label', 'Scrollable text')
    updateScrollHint(el)
    return
  }
  let lo = min
  let hi = 1
  for (let i = 0; i < 8; i += 1) {
    const mid = (lo + hi) / 2
    el.style.setProperty('--fit', String(mid))
    if (over()) hi = mid
    else lo = mid
  }
  el.style.setProperty('--fit', String(lo))
}

function updateScrollHint(el) {
  el.classList.toggle('at-end', el.scrollTop + el.clientHeight >= el.scrollHeight - 2)
}

let fitWatching = false
let fitRaf = 0
function fitHomeText() {
  document.querySelectorAll('#hpHero .hp-fit').forEach(fitEl)
  if (fitWatching) return
  fitWatching = true
  const rerun = () => {
    cancelAnimationFrame(fitRaf)
    fitRaf = requestAnimationFrame(() => {
      document.querySelectorAll('#hpHero .hp-fit').forEach(fitEl)
    })
  }
  // Width changes (resize, rotation, split view), webfont/system-font swap, late reveal.
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(rerun)
    ;['hpHero'].forEach((id) => {
      const n = document.getElementById(id)
      if (n) ro.observe(n)
    })
  }
  window.addEventListener('resize', rerun)
  window.addEventListener('orientationchange', rerun)
  document.fonts?.ready?.then(rerun)
  document.fonts?.addEventListener?.('loadingdone', rerun)
  document.addEventListener(
    'scroll',
    (e) => {
      const t = e.target
      if (t instanceof Element && t.classList.contains('is-scrollable')) updateScrollHint(t)
    },
    true,
  )
}

function curatedLayer(item) {
  return (
    LAYER_HIGHLIGHTS.find((h) => h.placeId === item.placeId) ||
    LAYER_HIGHLIGHTS.find((h) => h.layerId === item.layerId) ||
    null
  )
}

function layerHref(item) {
  if (item.href) return item.href
  return `/#map/${encodeURIComponent(item.layerId)}/${encodeURIComponent(item.placeId)}`
}

/** Story archive: paged magazine of every curated story with a photo (see explore-layer.js). */
function renderLayerCards(layers, skipSlugs = []) {
  const root = document.getElementById('hpLayerCards')
  if (!root) return
  return initExploreLayer({
    root,
    layers,
    skipSlugs,
    helpers: {
      escapeHtml,
      usablePhoto,
      photoCredit,
      eraLabel,
      storyYearLabel,
      storyMapHref,
      curatedLayer,
      layerHref,
      LAYER_HIGHLIGHTS,
    },
  }).catch((err) => console.error(err))
}

function applyArchiveLabels(count) {
  const kicker = document.getElementById('hpExploreKicker')
  const title = document.getElementById('hp-layers-title')
  // The build stamps the live story count (the same list /stories/ shows); the catalog count is only a fallback.
  const stamped = Number(title?.dataset?.storyCount)
  const labels = HomepageStructure.archiveLabels(Number.isInteger(stamped) && stamped > 0 ? stamped : count)
  if (kicker) kicker.textContent = labels.kicker
  if (title) title.textContent = labels.title
}

function relatedCardHtml(item) {
  return `<article class="hp-related-card">
      <p class="hp-related-kind">${escapeHtml(item.kind || '')}</p>
      <h3 class="hp-related-title">
        <a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>
      </h3>
      <p class="hp-card-blurb">${escapeHtml(item.blurb)}</p>
    </article>`
}

function storyNavHref(item) {
  if (item?.href) return item.href
  if (item?.slug) return storyUrl(item.slug)
  return '/#timeline'
}

function closeTodayNav() {
  const btn = document.getElementById('navTodayBtn')
  const menu = document.getElementById('navTodayMenu')
  if (!btn || !menu) return
  btn.setAttribute('aria-expanded', 'false')
  menu.hidden = true
}

function toggleTodayNav(force) {
  const btn = document.getElementById('navTodayBtn')
  const menu = document.getElementById('navTodayMenu')
  if (!btn || !menu) return
  const open = force ?? btn.getAttribute('aria-expanded') !== 'true'
  btn.setAttribute('aria-expanded', open ? 'true' : 'false')
  menu.hidden = !open
}

let todayNavBound = false

function bindTodayNav() {
  if (todayNavBound) return
  const wrap = document.getElementById('navToday')
  const btn = document.getElementById('navTodayBtn')
  if (!wrap || !btn) return
  todayNavBound = true
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleTodayNav()
  })
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || btn.getAttribute('aria-expanded') !== 'true') return
    e.stopPropagation()
    closeTodayNav()
    btn.focus()
  })
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) closeTodayNav()
  })
}

function renderTodayNav(pack) {
  const list = document.getElementById('navTodayList')
  const wrap = document.getElementById('navToday')
  if (!list || !wrap) return
  bindTodayNav()
  const stories = briefStories(pack)
  if (!stories.length) {
    wrap.hidden = true
    wrap.classList.remove('is-reserved')
    list.innerHTML = ''
    return
  }
  wrap.hidden = false
  wrap.classList.remove('is-reserved')
  document.getElementById('navTodayBtn')?.removeAttribute('tabindex')
  list.innerHTML = stories
    .map((item, i) => {
      const href = storyNavHref(item)
      const kicker = i === 0 ? 'Featured' : `Story ${i + 1}`
      return `<li>
        <a class="nav-today-link" role="menuitem" href="${escapeHtml(href)}">
          <span class="nav-today-kicker">${escapeHtml(kicker)}</span>
          <span class="nav-today-title">${escapeHtml(item.title)}</span>
        </a>
      </li>`
    })
    .join('')
  list.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => closeTodayNav())
  })
}

function relatedGroupsHtml(groups) {
  return groups
    .map((group) => {
      return `<div class="hp-related-group">
      <h3 class="hp-related-group-title">${escapeHtml(group.title)}</h3>
      <div class="hp-related-grid">
        ${group.sites.map(relatedCardHtml).join('')}
      </div>
    </div>`
    })
    .join('')
}

function renderRelatedCards() {
  const root = document.getElementById('hpRelatedCards')
  const full = document.getElementById('resourcesList')
  const bundle = HomepageStructure.relatedBundle(RELATED_GROUPS)
  if (full) full.innerHTML = relatedGroupsHtml(bundle.groups)
  if (!root) return
  const more =
    bundle.total > bundle.picks.length
      ? `<p class="hp-related-more"><a href="#resources">See all ${bundle.total} resources</a></p>`
      : ''
  root.innerHTML = `<div class="hp-related-grid">${bundle.picks.map(relatedCardHtml).join('')}</div>${more}`
}

async function loadPack() {
  let pack = null
  let index = null
  let locations = {}
  try {
    const res = await fetch('/content/home-preview.json')
    if (res.ok) pack = await res.json()
  } catch {
    /* use live rebuild */
  }
  try {
    const res = await fetch('/content/stories.json')
    if (res.ok) index = await res.json()
  } catch {
    /* pack only */
  }
  try {
    const res = await fetch('/content/stories-locations.json')
    if (res.ok) {
      const loc = await res.json()
      locations = loc.locations || {}
    }
  } catch {
    /* optional */
  }
  const latest = index?.briefDateRange?.end
  if (latest && pack?.briefDate && latest > pack.briefDate) {
    const live = await liveStoriesForDate(latest, index, locations)
    if (live.hero) {
      return {
        ...pack,
        ...live,
        layers: pack.layers,
      }
    }
  }
  if (pack?.hero) {
    const decorate = (item) => {
      if (!item) return item
      const loc = locations[item.slug] || {}
      const next = {
        ...item,
        historyId: item.historyId || loc.historyId || null,
        lat: item.lat ?? loc.lat ?? null,
        lon: item.lon ?? loc.lon ?? null,
      }
      next.mapHref = storyMapHref(next)
      return next
    }
    return {
      ...pack,
      hero: decorate(pack.hero),
      features: (pack.features || []).map(decorate),
      stories: (pack.stories || []).map(decorate),
    }
  }
  if (latest && index) {
    const live = await liveStoriesForDate(latest, index, locations)
    return { ...live, layers: pack?.layers || [] }
  }
  return pack || { hero: null, features: [], layers: [] }
}

let homePageStarted = false

export function initHomePage() {
  if (homePageStarted) return
  if (!document.getElementById('hpHero')) return
  homePageStarted = true
  AdSlot.mount(document.getElementById('home'), 'home')
  renderRelatedCards()
  Promise.all([loadPack(), loadPhotoVariants(), HomepageStructure.loadCatalog()])
    .then(async ([pack, , catalog]) => {
      const slides = heroSlides(pack)
      const heroSlugs = slides.map((story) => story.slug).filter(Boolean)
      renderTodayNav(pack)
      renderHero(pack)
      applyArchiveLabels(catalog.count)
      renderLayerCards(
        pack.layers,
        HomepageStructure.firstViewSkip(heroSlugs, [], null),
      )
    })
    .catch((err) => {
      console.error(err)
      renderTodayNav({ stories: [] })
      renderLayerCards([])
    })
}
