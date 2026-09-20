/**
 * Magazine homepage for /home-preview/.
 *
 * Daily refresh:
 *   1. Load /content/home-preview.json (built from the newest briefDate).
 *   2. Also load /content/stories.json. If its latest briefDate is newer,
 *      fetch those story files and Wikipedia thumbnails so the page updates
 *      on the same deploy as the morning ingest.
 *   3. If today’s feed is empty, keep the baked pack (curated fallback).
 *
 * Live `/` stays the map. This page is noindex and not in main nav.
 */
import { LAYER_HIGHLIGHTS, RELATED_GROUPS } from './home-preview-data.js'

const THEME_KEY = 'khd-home-preview-theme'

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
  const parts = t.split(/(?<=[.!?])\s+/)
  let out = ''
  for (const p of parts) {
    out = out ? `${out} ${p}` : p
    if (out.length >= 70 && !/\b(Jr|Sr|Dr|Capt|Col|Gen|Mr|Mrs|Ms|St|Ave)\.$/.test(out)) break
  }
  return out.length > 220 ? `${out.slice(0, 217).trim()}…` : out
}

function isPhotoUrl(url) {
  const u = String(url || '').toLowerCase()
  return !!u && !/\.svg/i.test(u) && !/silhouette|locator_map|coat_of_arms|flag_of/i.test(u)
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

async function liveStoriesForDate(briefDate, index) {
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
    const photo = await fetchWikipediaPhoto(wiki || full.title)
    cards.push({
      slug: full.slug || meta.slug,
      title: full.title || meta.title,
      summary: full.summary || meta.summary || '',
      era: full.era || meta.era || '',
      yearStart: full.yearStart ?? meta.yearStart ?? null,
      briefDate,
      href: `/#timeline/${encodeURIComponent(full.slug || meta.slug)}`,
      quote: firstSentence(full.bodyMarkdown || full.summary || ''),
      photo,
    })
  }
  const withPhotos = cards.filter((c) => c.photo?.image_url)
  const hero = withPhotos[0] || cards[0] || null
  return {
    briefDate,
    displayDate: formatDisplayDate(briefDate),
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

function renderHero(pack) {
  const root = document.getElementById('hpHero')
  if (!root) return
  const hero = pack.hero
  if (!hero) {
    root.innerHTML = `<div class="hp-mag-hero-copy">
      <p class="hp-kicker">Draft homepage</p>
      <h2 id="hp-hero-title">Kentucky history, this morning.</h2>
      <p>No daily brief is loaded yet. Open the map or timeline while the next ingest lands.</p>
      <div class="hp-cta-row">
        <a class="btn hp-cta" href="/#map">Open the map</a>
        <a class="btn ghost hp-cta" href="/#timeline">Timeline</a>
      </div>
    </div>`
    return
  }
  const img = hero.photo?.image_url
    ? `<img class="hp-mag-hero-img" src="${escapeHtml(hero.photo.image_url)}" alt="${escapeHtml(hero.photo.title || hero.title)}" />`
    : ''
  const credit = photoCredit(hero.photo)
  root.innerHTML = `
    <div class="hp-mag-hero-media">${img}<div class="hp-mag-hero-shade"></div></div>
    <div class="hp-mag-hero-copy">
      <p class="hp-kicker">This morning · ${escapeHtml(pack.displayDate || '')}</p>
      <p class="hp-hero-eyebrow">${escapeHtml(eraLabel(hero.era))}${hero.yearStart ? ` · ${escapeHtml(String(hero.yearStart))}` : ''}</p>
      <h2 id="hp-hero-title">${escapeHtml(hero.title)}</h2>
      <p class="hp-hero-deck">${escapeHtml(hero.summary)}</p>
      <div class="hp-cta-row">
        <a class="btn hp-cta" href="${escapeHtml(hero.href)}">Read the story</a>
        <a class="btn ghost hp-cta" href="/#timeline">All stories</a>
      </div>
      ${credit ? `<p class="hp-photo-credit">Photo: ${escapeHtml(credit)}</p>` : ''}
    </div>`
}

function renderFeatures(pack) {
  const root = document.getElementById('hpFeatureCards')
  const meta = document.getElementById('hpFeaturesMeta')
  if (meta) {
    meta.textContent = pack.briefDate
      ? `From the Kentucky History morning update · ${pack.displayDate}. Same stories as the daily email.`
      : ''
  }
  if (!root) return
  const items = pack.features || []
  if (!items.length) {
    root.innerHTML = `<p class="muted">Today’s brief is a single feature — see the hero above, or open the timeline.</p>`
    return
  }
  root.innerHTML = items
    .map((item) => {
      const img = item.photo?.image_url
        ? `<img src="${escapeHtml(item.photo.image_url)}" alt="${escapeHtml(item.photo.title || item.title)}" loading="lazy" />`
        : `<div class="hp-feature-fallback" aria-hidden="true"></div>`
      const credit = photoCredit(item.photo)
      return `<article class="hp-feature">
        <a class="hp-feature-media" href="${escapeHtml(item.href)}">${img}</a>
        <div class="hp-feature-copy">
          <p class="hp-card-layer">${escapeHtml(eraLabel(item.era))}${item.yearStart ? ` · ${escapeHtml(String(item.yearStart))}` : ''}</p>
          <h3 class="hp-feature-title"><a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a></h3>
          <p class="hp-feature-deck">${escapeHtml(item.summary)}</p>
          ${credit ? `<p class="hp-photo-credit">Photo: ${escapeHtml(credit)}</p>` : ''}
        </div>
      </article>`
    })
    .join('')
}

function renderQuote(pack) {
  const root = document.getElementById('hpQuote')
  if (!root) return
  const q = pack.quote
  if (!q?.text) {
    root.hidden = true
    root.innerHTML = ''
    return
  }
  root.hidden = false
  root.innerHTML = `<blockquote>
      <p>${escapeHtml(q.text)}</p>
      <footer>— <a href="${escapeHtml(q.href || '#')}">${escapeHtml(q.source || '')}</a></footer>
    </blockquote>`
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
      const img = photo?.image_url
        ? `<img src="${escapeHtml(photo.image_url)}" alt="${escapeHtml(photo.title || item.name)}" />`
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
  const latest = index?.briefDateRange?.end
  if (latest && pack?.briefDate && latest > pack.briefDate) {
    const live = await liveStoriesForDate(latest, index)
    if (live.hero) {
      return {
        ...pack,
        ...live,
        layers: pack.layers,
      }
    }
  }
  if (pack?.hero) return pack
  if (latest && index) {
    const live = await liveStoriesForDate(latest, index)
    return { ...live, layers: pack?.layers || [] }
  }
  return pack || { hero: null, features: [], layers: [] }
}

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return null
}

function preferredTheme() {
  const stored = readStoredTheme()
  if (stored) return stored
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-hp-theme', next)
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    /* ignore */
  }
  const btn = document.getElementById('hpThemeToggle')
  if (!btn) return
  const isLight = next === 'light'
  btn.setAttribute('aria-pressed', isLight ? 'true' : 'false')
  btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme')
  const label = btn.querySelector('.hp-theme-toggle-label')
  const icon = btn.querySelector('.hp-theme-toggle-icon')
  if (label) label.textContent = isLight ? 'Dark' : 'Light'
  if (icon) icon.textContent = isLight ? '☾' : '☀'
}

function initThemeToggle() {
  applyTheme(preferredTheme())
  const btn = document.getElementById('hpThemeToggle')
  if (!btn) return
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-hp-theme')
    applyTheme(current === 'light' ? 'dark' : 'light')
  })
}

initThemeToggle()
renderRelatedCards()

loadPack()
  .then((pack) => {
    renderHero(pack)
    renderFeatures(pack)
    renderQuote(pack)
    renderLayerCards(pack.layers)
  })
  .catch((err) => {
    console.error(err)
    renderLayerCards([])
  })
