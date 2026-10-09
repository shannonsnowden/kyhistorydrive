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
import { loadPhotoVariants, responsivePicture } from './responsive-img.js'
import { HeroCarousel } from './hero-carousel.js'
import { HomepageStructure } from './homepage-structure.js'

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

/** Card/hero year label: negative years read as BCE (Dover Mound shows 800 BCE, not -800). */
function storyYearLabel(y) {
  const n = Number(y)
  if (!Number.isFinite(n) || n === 0) return ''
  return n < 0 ? `${Math.abs(n)} BCE` : String(n)
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
  // Only split where a new sentence starts (capital/quote); keeps "A.D. 1200" and "O.F.C. (Old…)" intact.
  const parts = t.split(/(?<=[.!?])\s+(?=[A-Z"'\u201C\u2018])/)
  let out = ''
  for (const p of parts) {
    out = out ? `${out} ${p}` : p
    if (
      out.length >= 40 &&
      /[.!?]$/.test(out) &&
      !/\b(Jr|Sr|Dr|Capt|Col|Gen|Maj|Lt|Rev|Gov|Mr|Mrs|Ms|St|Ave|Mt|Ft|No|Co)\.$/.test(out) &&
      // Don't stop on a middle/first initial ("Return J. Meigs", "John C. Breckinridge").
      !/(?:^|[\s(])[A-Z]\.$/.test(out)
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

/** Hero overlay: about 25 words, on a sentence or word break. Display only. */
function heroDeckText(story) {
  // Build-time copy (scripts/build-home-preview.mjs) when present; same rules at runtime otherwise.
  if (story?.heroDeck) return story.heroDeck
  const quote = String(story?.quote || '').trim()
  if (quote) return HomepageStructure.capWords(quote)
  const summary = String(story?.summary || '').trim()
  if (!summary) return ''
  const stripped = HomepageStructure.deckText(summary)
  const sentence = firstSentence(stripped)
  if (sentence && /[.!?]$/.test(sentence)) return HomepageStructure.capWords(sentence)
  return HomepageStructure.capWords(stripped)
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
  // Same-origin curated story heroes — skip Wikipedia schematic-map heuristics.
  if (u.startsWith('/content/photos/stories/')) return true
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
    // Only try Wikipedia when the story cites a wiki URL — title fallback 404s (e.g. theme-only briefs).
    const photo = stored || (wiki ? await fetchWikipediaPhoto(wiki) : null)
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
    ? responsivePicture({
        src: story.photo.image_url,
        alt: story.photo.title || story.title,
        className: 'hp-mag-hero-img',
        loading: index === 0 ? 'eager' : 'lazy',
        fetchPriority: index === 0 ? 'high' : '',
        sizes: '100vw',
      })
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
        <p class="hp-hero-eyebrow">${escapeHtml(eraLabel(story.era))}${story.yearStart ? ` · ${escapeHtml(storyYearLabel(story.yearStart))}` : ''}</p>
        <h2 id="${titleId}" class="hp-fit">${escapeHtml(story.title)}</h2>
        <p class="hp-hero-deck hp-fit">${escapeHtml(heroDeckText(story))}</p>
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
      <button type="button" class="hp-hero-playback" data-hero-playback aria-pressed="false">Play</button>
      <button type="button" class="hp-hero-nav" data-hero-dir="1" aria-label="Next story">›</button>
    </div>
    <p class="visually-hidden" id="hpHeroStatus" aria-live="polite"></p>`
}

function initHeroRotator(root, slides) {
  HeroCarousel.mount(root, slides)
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
    root.removeAttribute('aria-busy')
    return
  }
  root.innerHTML = `
    <div class="hp-hero-viewport">
      ${slides.map((story, i) => renderHeroSlide(story, i)).join('')}
    </div>
    ${renderHeroControls(slides)}`
  root.removeAttribute('aria-busy')
  markPortraitHeroImages(root)
  fitHomeText()
  initHeroRotator(root, slides)
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
      const hasPhoto = Boolean(usablePhoto(item.photo))
      const media = hasPhoto
        ? `<a class="hp-feature-media" href="${escapeHtml(item.href)}" aria-label="Read: ${escapeHtml(item.title)}" tabindex="-1" aria-hidden="true">${responsivePicture({
            src: item.photo.image_url,
            alt: item.photo.title || item.title,
            loading: 'lazy',
            sizes: '(max-width: 700px) 100vw, 420px',
          })}</a>`
        : ''
      const credit = photoCredit(item.photo)
      const mapHref = storyMapHref(item)
      const cta = mapHref
        ? `<a class="hp-layer-cta" href="${escapeHtml(mapHref)}">Open on the map</a>`
        : `<a class="hp-layer-cta" href="${escapeHtml(item.href)}">Read the story</a>`
      return `<article class="hp-feature${hasPhoto ? '' : ' hp-feature--no-photo'}">
        ${media}
        <div class="hp-feature-copy">
          <p class="hp-card-layer">${escapeHtml(eraLabel(item.era))}${item.yearStart ? ` · ${escapeHtml(storyYearLabel(item.yearStart))}` : ''}</p>
          <h3 class="hp-feature-title"><a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a></h3>
          <p class="hp-feature-deck">${escapeHtml(item.summary)}</p>
          ${cta}
          ${credit ? `<p class="hp-photo-credit">Photo: ${escapeHtml(credit)}</p>` : ''}
        </div>
      </article>`
    })
    .join('')
}

/**
 * Fixed-size text boxes (hero title/deck + quote): the box height is set in CSS per
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
  const target = el.firstElementChild && el.classList.contains('hp-quote-body') ? el.firstElementChild : el
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
  document.querySelectorAll('#hpHero .hp-fit, #hpQuote .hp-fit').forEach(fitEl)
  if (fitWatching) return
  fitWatching = true
  const rerun = () => {
    cancelAnimationFrame(fitRaf)
    fitRaf = requestAnimationFrame(() => {
      document.querySelectorAll('#hpHero .hp-fit, #hpQuote .hp-fit').forEach(fitEl)
    })
  }
  // Width changes (resize, rotation, split view), webfont/system-font swap, late reveal.
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(rerun)
    ;['hpHero', 'hpQuote'].forEach((id) => {
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
      <div class="hp-quote-body hp-fit"><p>${escapeHtml(q.text)}</p></div>
      <footer>— <a href="${escapeHtml(q.href || '#')}">${escapeHtml(q.source || '')}</a></footer>
    </blockquote>`
  root.hidden = false
  root.setAttribute('aria-live', 'polite')
  if (root.innerHTML === next) return
  const apply = () => {
    root.innerHTML = next
    root.classList.remove('is-changing')
    fitHomeText()
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
  const labels = HomepageStructure.archiveLabels(count)
  const kicker = document.getElementById('hpExploreKicker')
  const title = document.getElementById('hp-layers-title')
  const meta = document.getElementById('hpFeaturesMeta')
  if (kicker) kicker.textContent = labels.kicker
  if (title) title.textContent = labels.title
  if (meta) meta.textContent = labels.features
}

/** Quote copy from a story file. Falls back to the index summary. Does not edit the file. */
async function loadQuoteStory(story) {
  if (!story?.slug) return null
  let text = ''
  try {
    const res = await fetch(`/content/stories/${encodeURIComponent(story.slug)}.json`)
    if (res.ok) {
      const full = await res.json()
      text = firstSentence(full.bodyMarkdown || '')
    }
  } catch {
    /* use the index summary */
  }
  if (!text) text = firstSentence(HomepageStructure.deckText(story.summary || ''))
  if (!text) return null
  return { ...story, quote: text }
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
      const highlights = HomepageStructure.pickHighlights(catalog.stories, heroSlugs, 4)
      const quotePick = HomepageStructure.pickQuote(
        catalog.stories,
        [...heroSlugs, ...highlights.map((story) => story.slug)],
        {
          heroSlugs,
          pin: HomepageStructure.quotePinFromPack(pack, heroSlugs),
        },
      )
      const quoteStory = await loadQuoteStory(quotePick)
      renderTodayNav(pack)
      renderHero(pack)
      renderFeatures({ features: highlights })
      renderQuote(quoteStory)
      applyArchiveLabels(catalog.count)
      renderLayerCards(
        pack.layers,
        HomepageStructure.firstViewSkip(heroSlugs, highlights, quotePick?.slug),
      )
    })
    .catch((err) => {
      console.error(err)
      renderTodayNav({ stories: [] })
      renderQuote(null)
      renderLayerCards([])
    })
}
