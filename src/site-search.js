/**
 * Header search shared by the magazine homepage (`/`) and hash views (`/#map`, `/#timeline`).
 * Indexes places + stories via /data/search-index.json (MiniSearch).
 */
import MiniSearch from 'minisearch'

const SEARCH_LIMIT = 12
const SEARCH_MIN_CHARS = 2

let searchMini = null
let searchDocsById = new Map()
let searchLoadPromise = null
let searchActiveIndex = -1
let navigateHash = defaultNavigateHash

function defaultNavigateHash(hash) {
  location.hash = hash
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function debounce(fn, ms) {
  let t = null
  return (...args) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

function placeShareHash(layerId, shareId) {
  if (!layerId || !shareId) return '#map'
  return `#map/${encodeURIComponent(layerId)}/${encodeURIComponent(shareId)}`
}

function storyShareHash(slug) {
  if (!slug) return '#timeline'
  return `#timeline/${encodeURIComponent(slug)}`
}

export function searchHitHash(doc) {
  if (!doc) return '#map'
  if (doc.type === 'story' && doc.slug) return storyShareHash(doc.slug)
  if (doc.type === 'place' && doc.layerId && doc.shareId) {
    return placeShareHash(doc.layerId, doc.shareId)
  }
  return '#map'
}

async function ensureSearchIndex() {
  if (searchMini) return searchMini
  if (searchLoadPromise) return searchLoadPromise
  searchLoadPromise = (async () => {
    const res = await fetch('/data/search-index.json')
    if (!res.ok) throw new Error(`search-index HTTP ${res.status}`)
    const payload = await res.json()
    const docs = payload.documents || []
    searchDocsById = new Map(docs.map((d) => [d.id, d]))
    const mini = new MiniSearch({
      fields: ['title', 'text'],
      storeFields: ['type', 'layerId', 'layerLabel', 'title', 'snippet', 'lat', 'lon', 'slug', 'shareId'],
      searchOptions: {
        boost: { title: 4 },
        fuzzy: 0.15,
        prefix: true,
        combineWith: 'AND',
      },
    })
    mini.addAll(docs)
    searchMini = mini
    return mini
  })().catch((err) => {
    searchLoadPromise = null
    throw err
  })
  return searchLoadPromise
}

function closeSearchResults() {
  const box = document.getElementById('siteSearchResults')
  const input = document.getElementById('siteSearchInput')
  if (box) {
    box.hidden = true
    box.innerHTML = ''
  }
  if (input) input.setAttribute('aria-expanded', 'false')
  searchActiveIndex = -1
}

function renderSearchResults(query, hits) {
  const box = document.getElementById('siteSearchResults')
  const input = document.getElementById('siteSearchInput')
  if (!box || !input) return
  searchActiveIndex = -1
  if (!query || query.trim().length < SEARCH_MIN_CHARS) {
    closeSearchResults()
    return
  }
  if (!hits.length) {
    box.innerHTML = `<div class="nav-search-empty">No matches for “${escapeHtml(query.trim())}”</div>`
    box.hidden = false
    input.setAttribute('aria-expanded', 'true')
    return
  }
  box.innerHTML = hits
    .map((doc, i) => {
      const kind = doc.type === 'story' ? 'Story · Timeline' : `Place · ${doc.layerLabel || doc.layerId || 'Map'}`
      const snip = doc.snippet ? `<span class="nav-search-hit-snippet">${escapeHtml(doc.snippet)}</span>` : ''
      return `<button type="button" class="nav-search-hit" role="option" data-search-id="${escapeHtml(doc.id)}" data-idx="${i}" id="siteSearchOpt${i}">
        <span class="nav-search-hit-title">${escapeHtml(doc.title)}</span>
        <span class="nav-search-hit-meta">${escapeHtml(kind)}</span>
        ${snip}
      </button>`
    })
    .join('')
  box.hidden = false
  input.setAttribute('aria-expanded', 'true')
}

function runSiteSearch(rawQuery) {
  const query = String(rawQuery || '').trim()
  const box = document.getElementById('siteSearchResults')
  const input = document.getElementById('siteSearchInput')
  if (!box || !input) return
  if (query.length < SEARCH_MIN_CHARS) {
    closeSearchResults()
    return
  }
  ensureSearchIndex()
    .then((mini) => {
      const results = mini.search(query, {
        boost: { title: 4 },
        fuzzy: 0.15,
        prefix: true,
        combineWith: 'AND',
      })
      const hits = []
      const seen = new Set()
      for (const r of results) {
        const doc = searchDocsById.get(r.id) || r
        // Collapse same place across layers (War + Museums White Hall, etc.)
        const dedupeKey =
          doc.type === 'place' && doc.shareId
            ? `place:${doc.shareId}`
            : doc.type === 'story' && doc.slug
              ? `story:${doc.slug}`
              : r.id
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        hits.push(doc)
        if (hits.length >= SEARCH_LIMIT) break
      }
      // Prefer exact title phrase matches near the top
      const qLower = query.toLowerCase()
      hits.sort((a, b) => {
        const aExact = String(a.title || '').toLowerCase().includes(qLower) ? 0 : 1
        const bExact = String(b.title || '').toLowerCase().includes(qLower) ? 0 : 1
        if (aExact !== bExact) return aExact - bExact
        return 0
      })
      renderSearchResults(query, hits)
    })
    .catch((err) => {
      console.warn('search failed', err)
      box.innerHTML = `<div class="nav-search-status">Search unavailable</div>`
      box.hidden = false
      input.setAttribute('aria-expanded', 'true')
    })
}

function selectSearchHit(doc) {
  if (!doc) return
  closeSearchResults()
  const input = document.getElementById('siteSearchInput')
  if (input) input.blur()
  navigateHash(searchHitHash(doc))
}

function setSearchActive(delta) {
  const box = document.getElementById('siteSearchResults')
  if (!box || box.hidden) return
  const opts = [...box.querySelectorAll('.nav-search-hit')]
  if (!opts.length) return
  searchActiveIndex = (searchActiveIndex + delta + opts.length) % opts.length
  opts.forEach((el, i) => el.classList.toggle('is-active', i === searchActiveIndex))
  opts[searchActiveIndex]?.scrollIntoView({ block: 'nearest' })
}

/**
 * Wire the header search control.
 * @param {{ navigate?: (hash: string) => void }} [options]
 *   `navigate` receives a hash like `#timeline/slug` or `#map/layer/id`.
 *   Default sets `location.hash` on the same document (`#map`, `#timeline/<slug>`).
 */
export function initSiteSearch(options = {}) {
  const form = document.getElementById('siteSearchForm')
  const input = document.getElementById('siteSearchInput')
  const box = document.getElementById('siteSearchResults')
  const wrap = document.getElementById('navSearch')
  if (!form || !input || !box || !wrap) return

  if (typeof options.navigate === 'function') {
    navigateHash = options.navigate
  }

  // Warm the index in the background
  ensureSearchIndex().catch((err) => console.warn('search index preload failed', err))

  const debounced = debounce(() => runSiteSearch(input.value), 180)
  input.addEventListener('input', debounced)
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= SEARCH_MIN_CHARS) runSiteSearch(input.value)
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const active = box.querySelector('.nav-search-hit.is-active')
    const first = box.querySelector('.nav-search-hit')
    const btn = active || first
    if (btn) {
      const doc = searchDocsById.get(btn.dataset.searchId)
      selectSearchHit(doc)
    } else {
      runSiteSearch(input.value)
    }
  })
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-search-hit')
    if (!btn) return
    selectSearchHit(searchDocsById.get(btn.dataset.searchId))
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSearchActive(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSearchActive(-1)
    } else if (e.key === 'Escape') {
      closeSearchResults()
      input.blur()
    }
  })
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) closeSearchResults()
  })
}
