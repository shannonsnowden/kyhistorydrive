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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDisplayDate(iso) {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function eraLabel(era) {
  const map = {
    prehistoric: 'Prehistoric',
    native: 'Native',
    frontier: 'Frontier',
    'early-commonwealth': 'Early commonwealth',
    other: 'Kentucky',
  }
  return map[era] || 'Kentucky'
}

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

function firstSentence(text) {
  const t = String(text || '')
    .replace(/^[ \t]*source:[ \t]*.+$/gim, '')
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return ''
  const parts = t.split(/(?<=[.!?])\s+/)
  let out = ''
  for (const p of parts) {
    out = out ? `${out} ${p}` : p
    if (
      out.length >= 40 &&
      /[.!?]$/.test(out) &&
      !/\b(Jr|Sr|Dr|Capt|Col|Gen|Mr|Mrs|Ms|St|Ave)\.$/.test(out)
    ) {
      break
    }
  }
  return out
}

function quoteFromStory(story) {
  if (!story) return null
  const text = String(story.quote || story.summary || '').trim()
  if (!text) return null
  const href = story.href || (story.slug ? `/#timeline/${encodeURIComponent(story.slug)}` : '')
  return {
    text,
    source: story.title || '',
    href,
  }
}

/** Home-map deep link for a pin-backed story. Does not invent coordinates. */
function storyMapHref(item) {
  if (!item) return null
  if (item.mapHref) return item.mapHref
  if (item.historyId) return `/#map/history/${encodeURIComponent(item.historyId)}`
  if (item.lat != null && item.lon != null && item.slug) {
    return `/#map/stories/${encodeURIComponent(item.slug)}`
  }
  return null
}

function isPhotoUrl(url) {
  const u = String(url || '').toLowerCase()
  if (!u) return false
  if (/\.svg(\?|$)/i.test(u)) return false
  if (
    /silhouette|locator[_\s-]?map|coat_of_arms|flag_of|sanborn|enumeration_district|landsat|schematic|diagram|_map_hroe|sites_on_.*map|lower_ohio_map|highlighted_\d+/i.test(
      u,
    )
  ) {
    return false
  }
  if (/\/[^/?#]*\bmap\b[^/?#]*\.(jpe?g|png|gif|webp)/i.test(u)) return false
  return true
}

function usablePhoto(photo) {
  return photo?.image_url && isPhotoUrl(photo.image_url) ? photo : null
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
    const stored = usablePhoto(full.photo) || usablePhoto(meta.photo)
    const photo = stored || (await fetchWikipediaPhoto(wiki || full.title))
    const slug = full.slug || meta.slug
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
      briefDate,
      href: `/#timeline/${encodeURIComponent(slug)}`,
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

function photoCredit(photo) {
  if (!photo) return ''
  const label = photo.attribution || photo.source_label || ''
  const year = photo.year ? ` · ${photo.year}` : ''
  return label ? `${label}${year}` : ''
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
  if (withPhotos.length) return withPhotos
  return all[0] ? [all[0]] : []
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
}

function renderHeroSlide(story, index) {
  const titleId = index === 0 ? 'hp-hero-title' : `hp-hero-title-${index}`
  const img = usablePhoto(story.photo)
    ? `<img class="hp-mag-hero-img" src="${escapeHtml(story.photo.image_url)}" alt="${escapeHtml(story.photo.title || story.title)}" ${index === 0 ? '' : 'loading="lazy"'} referrerpolicy="no-referrer" decoding="async" />`
    : ''
  const credit = photoCredit(story.photo)
  const href = story.href || `/#timeline/${encodeURIComponent(story.slug || '')}`
  return `<article
      class="hp-hero-slide${index === 0 ? ' is-active' : ''}"
      data-hero-index="${index}"
      aria-hidden="${index === 0 ? 'false' : 'true'}"
      ${index === 0 ? '' : 'inert'}
    >
      <div class="hp-mag-hero-media">${img}<div class="hp-mag-hero-shade"></div></div>
      <div class="hp-mag-hero-copy">
        <p class="hp-kicker">Featured story</p>
        <p class="hp-hero-eyebrow">${escapeHtml(eraLabel(story.era))}${story.yearStart ? ` · ${escapeHtml(String(story.yearStart))}` : ''}</p>
        <h2 id="${titleId}">${escapeHtml(story.title)}</h2>
        <p class="hp-hero-deck">${escapeHtml(story.summary)}</p>
        <div class="hp-cta-row">
          <a class="btn hp-cta" href="${escapeHtml(href)}">Read the story</a>
          ${
            storyMapHref(story)
              ? `<a class="btn hp-cta" href="${escapeHtml(storyMapHref(story))}">Open on the map</a>`
              : `<a class="btn hp-cta" href="/#timeline">All stories</a>`
          }
        </div>
        ${credit ? `<p class="hp-photo-credit">Photo: ${escapeHtml(credit)}</p>` : ''}
      </div>
    </article>`
}

function renderHeroControls(slides) {
  if (slides.length < 2) return ''
  const dots = slides
    .map((story, i) => {
      const label = `Show story ${i + 1} of ${slides.length}: ${story.title}`
      return `<button type="button" class="hp-hero-dot${i === 0 ? ' is-active' : ''}" data-hero-to="${i}" aria-label="${escapeHtml(label)}" aria-current="${i === 0 ? 'true' : 'false'}"></button>`
    })
    .join('')
  return `<div class="hp-hero-controls">
      <button type="button" class="hp-hero-nav" data-hero-dir="-1" aria-label="Previous story">‹</button>
      <div class="hp-hero-dots" role="group" aria-label="Featured stories">${dots}</div>
      <button type="button" class="hp-hero-nav" data-hero-dir="1" aria-label="Next story">›</button>
    </div>
    <p class="visually-hidden" id="hpHeroStatus" aria-live="polite"></p>`
}

function initHeroRotator(root, slides) {
  if (!root || slides.length < 2) return
  const slideEls = [...root.querySelectorAll('.hp-hero-slide')]
  const dots = [...root.querySelectorAll('.hp-hero-dot')]
  const status = document.getElementById('hpHeroStatus')
  const intervalMs = 7000
  let index = 0
  let timer = null
  let paused = false

  function announce(i) {
    if (!status) return
    const story = slides[i]
    status.textContent = `Story ${i + 1} of ${slides.length}: ${story.title}`
  }

  function show(next, { announceChange = true } = {}) {
    index = (next + slideEls.length) % slideEls.length
    slideEls.forEach((el, i) => {
      const on = i === index
      el.classList.toggle('is-active', on)
      el.setAttribute('aria-hidden', on ? 'false' : 'true')
      if (on) el.removeAttribute('inert')
      else el.setAttribute('inert', '')
    })
    dots.forEach((dot, i) => {
      const on = i === index
      dot.classList.toggle('is-active', on)
      dot.setAttribute('aria-current', on ? 'true' : 'false')
    })
    const title = slideEls[index]?.querySelector('h2')
    if (title) root.setAttribute('aria-labelledby', title.id)
    renderQuote(slides[index])
    if (announceChange) announce(index)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function play() {
    stop()
    if (prefersReducedMotion() || paused) return
    timer = setInterval(() => show(index + 1), intervalMs)
  }

  function pause() {
    paused = true
    stop()
  }

  function resume() {
    paused = false
    play()
  }

  root.querySelectorAll('[data-hero-dir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      show(index + Number(btn.dataset.heroDir || 0))
      play()
    })
  })
  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      show(Number(dot.dataset.heroTo || 0))
      play()
    })
  })
  root.addEventListener('mouseenter', pause)
  root.addEventListener('mouseleave', resume)
  root.addEventListener('focusin', pause)
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget)) resume()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop()
    else if (!paused) play()
  })
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.addEventListener?.('change', () => {
    if (prefersReducedMotion()) stop()
    else play()
  })

  root.setAttribute('aria-roledescription', 'carousel')
  announce(0)
  play()
}

function renderHero(pack) {
  const root = document.getElementById('hpHero')
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
    renderQuote(null)
    return
  }
  root.innerHTML = `
    <div class="hp-hero-viewport">
      ${slides.map((story, i) => renderHeroSlide(story, i)).join('')}
    </div>
    ${renderHeroControls(slides)}`
  renderQuote(slides[0])
  initHeroRotator(root, slides)
}

function renderFeatures(pack) {
  const root = document.getElementById('hpFeatureCards')
  if (!root) return
  const items = pack.features || []
  if (!items.length) {
    root.innerHTML = `<p class="muted">This set is a single highlight — see the story above, or open the timeline.</p>`
    return
  }
  root.innerHTML = items
    .map((item) => {
      const img = usablePhoto(item.photo)
        ? `<img src="${escapeHtml(item.photo.image_url)}" alt="${escapeHtml(item.photo.title || item.title)}" loading="lazy" referrerpolicy="no-referrer" decoding="async" />`
        : `<div class="hp-feature-fallback" aria-hidden="true"></div>`
      const credit = photoCredit(item.photo)
      const mapHref = storyMapHref(item)
      const cta = mapHref
        ? `<a class="hp-layer-cta" href="${escapeHtml(mapHref)}">Open on the map</a>`
        : `<a class="hp-layer-cta" href="${escapeHtml(item.href)}">Read the story</a>`
      return `<article class="hp-feature">
        <a class="hp-feature-media" href="${escapeHtml(item.href)}">${img}</a>
        <div class="hp-feature-copy">
          <p class="hp-card-layer">${escapeHtml(eraLabel(item.era))}${item.yearStart ? ` · ${escapeHtml(String(item.yearStart))}` : ''}</p>
          <h3 class="hp-feature-title"><a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a></h3>
          <p class="hp-feature-deck">${escapeHtml(item.summary)}</p>
          ${cta}
          ${credit ? `<p class="hp-photo-credit">Photo: ${escapeHtml(credit)}</p>` : ''}
        </div>
      </article>`
    })
    .join('')
}

function renderQuote(story) {
  const root = document.getElementById('hpQuote')
  if (!root) return
  const q = quoteFromStory(story)
  if (!q?.text) {
    root.hidden = true
    root.innerHTML = ''
    root.removeAttribute('aria-busy')
    return
  }
  const next = `<blockquote>
      <p>${escapeHtml(q.text)}</p>
      <footer>— <a href="${escapeHtml(q.href || '#')}">${escapeHtml(q.source || '')}</a></footer>
    </blockquote>`
  root.hidden = false
  root.setAttribute('aria-live', 'polite')
  if (root.innerHTML === next) return
  const apply = () => {
    root.innerHTML = next
    root.classList.remove('is-changing')
  }
  if (prefersReducedMotion() || !root.querySelector('blockquote')) {
    apply()
    return
  }
  root.classList.add('is-changing')
  window.setTimeout(apply, 180)
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

function renderLayerCards(layers) {
  const root = document.getElementById('hpLayerCards')
  if (!root) return
  const items = layers?.length ? layers : LAYER_HIGHLIGHTS
  root.innerHTML = items
    .map((item) => {
      const curated = curatedLayer(item)
      const photo =
        curated?.photo?.image_url && curated.placeId === item.placeId
          ? curated.photo
          : item.photo?.image_url
            ? item.photo
            : curated?.photo
      const blurb = item.blurb || curated?.blurb || ''
      const href = layerHref(item)
      const img = usablePhoto(photo)
        ? `<img src="${escapeHtml(photo.image_url)}" alt="${escapeHtml(photo.title || item.name)}" width="640" height="480" loading="eager" referrerpolicy="no-referrer" decoding="async" />`
        : `<div class="hp-feature-fallback" aria-hidden="true"></div>`
      const credit = photoCredit(photo)
      return `<article class="hp-layer-card">
        <a class="hp-layer-media" href="${escapeHtml(href)}">${img}</a>
        <div class="hp-layer-copy">
          <p class="hp-card-layer">${escapeHtml(item.layerLabel)}</p>
          <h3 class="hp-layer-title"><a href="${escapeHtml(href)}">${escapeHtml(item.name)}</a></h3>
          <p class="hp-layer-place">${escapeHtml(item.place || '')}</p>
          ${blurb ? `<p class="hp-card-blurb">${escapeHtml(blurb)}</p>` : ''}
          <a class="hp-layer-cta" href="${escapeHtml(href)}">Open on the map</a>
          ${credit ? `<p class="hp-photo-credit">Photo: ${escapeHtml(credit)}</p>` : ''}
        </div>
      </article>`
    })
    .join('')
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
  if (item?.slug) return `/#timeline/${encodeURIComponent(item.slug)}`
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
    if (e.key === 'Escape') {
      closeTodayNav()
      btn.focus()
    }
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
    list.innerHTML = ''
    return
  }
  wrap.hidden = false
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

function renderRelatedCards() {
  const root = document.getElementById('hpRelatedCards')
  if (!root) return
  root.innerHTML = RELATED_GROUPS.map((group) => {
    return `<div class="hp-related-group">
      <h3 class="hp-related-group-title">${escapeHtml(group.title)}</h3>
      <div class="hp-related-grid">
        ${group.sites.map(relatedCardHtml).join('')}
      </div>
    </div>`
  }).join('')
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
  renderRelatedCards()
  loadPack()
    .then((pack) => {
      renderTodayNav(pack)
      renderHero(pack)
      renderFeatures(pack)
      renderLayerCards(pack.layers)
    })
    .catch((err) => {
      console.error(err)
      renderTodayNav({ stories: [] })
      renderLayerCards([])
    })
}
