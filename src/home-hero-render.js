/**
 * Pure homepage lead/rail/swipe renderers. Shared by the browser (src/home-preview.js)
 * and the build (scripts/prerender-home-hero.mjs) so the static HTML in dist/index.html
 * matches what the app renders: real <a href> links and images without JS.
 */
import { HomepageStructure } from './homepage-structure.js'
import { responsivePicture, responsiveSources } from './responsive-img.js'

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatDisplayDate(iso) {
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
export function storyYearLabel(y) {
  const n = Number(y)
  if (!Number.isFinite(n) || n === 0) return ''
  return n < 0 ? `${Math.abs(n)} BCE` : String(n)
}

export function eraLabel(era) {
  const map = {
    prehistoric: 'Prehistoric',
    native: 'Native',
    frontier: 'Frontier',
    'early-commonwealth': 'Early commonwealth',
    other: 'Kentucky',
  }
  return map[era] || 'Kentucky'
}

export function firstSentence(text) {
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

/** Hero overlay: the full first sentence. A finished sentence is not cut with an ellipsis. */
export function heroDeckText(story) {
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

/**
 * Same-origin path only: must start with exactly one "/" and contain no backslash or
 * control/space characters. Rejects "//host", "/\\host", "javascript:", "https://…". Returns '' otherwise.
 */
export function safeLocalUrl(url) {
  const u = typeof url === 'string' ? url : ''
  if (!u.startsWith('/') || u.startsWith('//')) return ''
  if (/[\\\s\u0000-\u001f\u007f]/.test(u)) return ''
  return u
}

/** The story photo only when its URL is a safe same-origin path. */
function localPhoto(story) {
  const p = usablePhoto(story?.photo)
  return p && safeLocalUrl(p.image_url) ? p : null
}

/** Home-map deep link for a pin-backed story. Does not invent coordinates. */
export function storyMapHref(item) {
  if (!item) return null
  if (item.mapHref) return safeLocalUrl(item.mapHref) || null
  if (item.historyId) return `/#map/history/${encodeURIComponent(item.historyId)}`
  if (item.lat != null && item.lon != null && item.slug) {
    return `/#map/stories/${encodeURIComponent(item.slug)}`
  }
  return null
}

export function isPhotoUrl(url) {
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

export function usablePhoto(photo) {
  return photo?.image_url && isPhotoUrl(photo.image_url) ? photo : null
}
export function photoCredit(photo) {
  if (!photo) return ''
  const label = photo.attribution || photo.source_label || ''
  const year = photo.year ? ` · ${photo.year}` : ''
  return label ? `${label}${year}` : ''
}
/** Crawlable story page (/stories/<slug>/), never the #timeline hash route. */
export function storyPageHref(story) {
  if (story?.slug) return `/stories/${encodeURIComponent(story.slug)}/`
  return safeLocalUrl(story?.href) || '/#timeline'
}

/** In-app reader (Timeline view) target for homepage story cards: /#timeline/<slug>. Cards keep href=storyPageHref (crawlable); a plain left click is sent here by home-preview.js. */
export function storyReaderHref(story) {
  if (story?.slug) return `/#timeline/${encodeURIComponent(story.slug)}`
  return '/#timeline'
}

export function placeCaption(story) {
  const dataCounty = String(story?.county || '').trim()
  if (dataCounty) {
    const c = /county$/i.test(dataCounty) ? dataCounty : `${dataCounty} County`
    const y = storyYearLabel(story?.yearStart)
    return y ? `${c} · ${y}` : c
  }
  const place = String(story?.place || '').trim()
  const year = storyYearLabel(story?.yearStart)
  let county = ''
  const m = place.match(/([A-Za-z .'-]+?\s+County)\b/)
  // Prefer an explicit "X County" from the place, then the summary/quote text, so the
  // kicker reads "Scott County · 1780" instead of repeating the title's place name.
  const fromText = String(`${story?.summary || ''} ${story?.quote || ''}`).match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s+County)\b/)
  if (m) county = m[1].replace(/\s+/g, ' ').trim()
  else if (fromText) county = fromText[1]
  else if (/County seat/i.test(place)) {
    const seat = place.match(/([A-Za-z .'-]+)\s*\(/)
    county = seat ? seat[1].trim() : place
  } else if (place) {
    // Prefer a short place label over the era kicker "Featured story".
    county = place.split(/[,(]/)[0].trim()
  }
  if (county && year) return `${county} · ${year}`
  if (county) return county
  if (year) return year
  return eraLabel(story?.era)
}

export function cardAlt(story) {
  const title = String(story?.photo?.title || story?.title || '').trim()
  return title || 'Kentucky history story'
}

export function renderLeadStory(story) {
  const href = storyPageHref(story)
  const tl = storyReaderHref(story)
  const alt = cardAlt(story)
  const img = localPhoto(story)
    ? responsivePicture({
        src: story.photo.image_url,
        alt,
        className: 'hp-mag-hero-img',
        loading: 'eager',
        fetchPriority: 'high',
        sizes: LEAD_SIZES,
      })
    : ''
  const credit = photoCredit(story.photo)
  return `<article class="hp-lead-story">
      <a class="hp-lead-media-link" href="${escapeHtml(href)}" data-timeline="${escapeHtml(tl)}">
        <div class="hp-mag-hero-media">${img}<div class="hp-mag-hero-shade" aria-hidden="true"></div></div>
        <h2 id="hp-hero-title" class="hp-lead-title">${escapeHtml(story.title)}</h2>
      </a>
      <div class="hp-mag-hero-copy">
        <p class="hp-hero-eyebrow">${escapeHtml(placeCaption(story))}</p>
        <p class="hp-hero-deck">${escapeHtml(heroDeckText(story))}</p>
        <div class="hp-cta-row">
          <a class="btn hp-cta" href="${escapeHtml(href)}" data-timeline="${escapeHtml(tl)}">Read the story</a>
          ${
            storyMapHref(story)
              ? `<a class="btn hp-cta" href="${escapeHtml(storyMapHref(story))}">Open on the map</a>`
              : ''
          }
        </div>
        ${credit ? `<p class="hp-photo-credit">Photo: ${escapeHtml(credit)}</p>` : ''}
      </div>
    </article>`
}

export function renderRailCard(story) {
  const href = storyPageHref(story)
  const tl = storyReaderHref(story)
  const alt = cardAlt(story)
  const img = localPhoto(story)
    ? responsivePicture({
        src: story.photo.image_url,
        alt,
        className: 'hp-rail-card-img',
        loading: 'lazy',
        sizes: '116px',
        width: 116,
        height: 96,
      })
    : `<span class="hp-rail-card-ph" aria-hidden="true"></span>`
  return `<a class="hp-rail-card" href="${escapeHtml(href)}" data-timeline="${escapeHtml(tl)}">
      ${img}
      <span class="hp-rail-card-copy">
        <h3 class="hp-rail-card-title">${escapeHtml(story.title)}</h3>
        <small class="hp-rail-card-meta">${escapeHtml(placeCaption(story))}</small>
      </span>
    </a>`
}

export function renderSwipeCard(story) {
  const href = storyPageHref(story)
  const tl = storyReaderHref(story)
  const alt = cardAlt(story)
  const img = localPhoto(story)
    ? responsivePicture({
        src: story.photo.image_url,
        alt,
        className: 'hp-swipe-card-img',
        loading: 'lazy',
        sizes: '150px',
        width: 150,
        height: 90,
      })
    : `<span class="hp-swipe-card-ph" aria-hidden="true"></span>`
  return `<li class="hp-swipe-card">
      <a class="hp-swipe-card-link" href="${escapeHtml(href)}" data-timeline="${escapeHtml(tl)}">
        ${img}
        <h3 class="hp-swipe-card-title">${escapeHtml(story.title)}</h3>
        <small class="hp-swipe-card-meta">${escapeHtml(placeCaption(story))}</small>
      </a>
    </li>`
}

/** Lead image sizes, shared by the <picture> and the build-time <link rel=preload>. */
export const LEAD_SIZES = '(max-width: 900px) 100vw, 66vw'

/** <link rel=preload> for the lead image, written into <head> at build time. */
export function leadPreloadTag(story) {
  if (!localPhoto(story)) return ''
  const src = story.photo.image_url
  const set = responsiveSources(src)
  // Match the first <source> the <picture> offers (AVIF, then WebP) so the browser
  // fetches the preloaded file once instead of a preload plus a different format.
  const best = set.avif || set.webp
  const extra = best
    ? ` imagesrcset="${escapeHtml(best)}" imagesizes="${escapeHtml(LEAD_SIZES)}" type="${set.avif ? 'image/avif' : 'image/webp'}"`
    : ''
  return `<link id="hpLeadPreload" rel="preload" as="image" href="${escapeHtml(src)}" fetchpriority="high"${extra} />`
}
