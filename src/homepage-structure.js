/**
 * Homepage structure that the daily pack does not decide.
 *
 * The morning pack still chooses Today's stories and the hero carousel.
 * This class only decides how the rest of the homepage avoids repeating
 * those stories, how long a hero summary may run, and which related
 * links are on the homepage versus the full #resources list.
 * Story text in the JSON files is left as published.
 */
export class HomepageStructure {
  static ERA_ORDER = ['prehistoric', 'native', 'frontier', 'early-commonwealth', 'other']
  /** About 25 words. A sentence a few words longer stays whole. */
  static HERO_WORD_CAP = 25
  static HERO_WORD_SLACK = 5
  /** First page of Explore, at the widest page size, so every breakpoint skips the hero set. */
  static EXPLORE_DEFER_PAGE = 6
  /**
   * Homepage picks. Matched by href so the link records themselves stay
   * exactly as KY Website Editor published them.
   */
  static PICK_HREFS = [
    'https://history.ky.gov/markers',
    'https://explorekyhistory.ky.gov/items/show/596',
    'https://filsonhistorical.org/',
    'https://www.nps.gov/abli/',
    'https://archaeology.ky.gov/Find-a-Site/Pages/default.aspx',
    'https://history.ky.gov/stories-and-blogs',
  ]

  static async loadCatalog() {
    const [index, photos, locations] = await Promise.all([
      HomepageStructure.#json('/content/stories.json'),
      HomepageStructure.#json('/content/story-photos.json'),
      HomepageStructure.#json('/content/stories-locations.json'),
    ])
    const bySlug = photos?.bySlug || {}
    const locs = locations?.locations || {}
    const stories = []
    for (const row of index?.stories || []) {
      if (!row?.slug) continue
      const photo = bySlug[row.slug]?.photo
      if (!photo?.image_url || !(photo.attribution || photo.source_label)) continue
      const loc = locs[row.slug] || {}
      const story = {
        slug: row.slug,
        title: row.title || '',
        summary: row.summary || '',
        era: row.era || 'other',
        yearStart: row.yearStart ?? null,
        publishedDate: row.publishedDate || row.briefDate || '',
        briefDate: row.briefDate || '',
        href: `/#timeline/${encodeURIComponent(row.slug)}`,
        photo,
        lat: row.lat ?? loc.lat ?? null,
        lon: row.lon ?? loc.lon ?? null,
        historyId: bySlug[row.slug]?.historyId || loc.historyId || null,
      }
      story.mapHref = HomepageStructure.mapHref(story)
      stories.push(story)
    }
    const indexed = Array.isArray(index?.stories) ? index.stories.length : stories.length
    return { count: indexed, stories }
  }

  static mapHref(story) {
    if (!story) return null
    if (story.historyId) return `/#map/history/${encodeURIComponent(story.historyId)}`
    if (story.lat != null && story.lon != null && story.slug) {
      return `/#map/stories/${encodeURIComponent(story.slug)}`
    }
    return null
  }

  /** Real story-index count. Never a number copied from a critique. */
  static archiveLabels(count) {
    const n = Number(count)
    const known = Number.isInteger(n) && n > 0
    const figure = known ? String(n) : ''
    return {
      kicker: 'Story archive',
      title: known ? `Browse all ${figure} stories` : 'Browse all stories',
      features: known ? `Picked from our ${figure} stories.` : 'Picked from our stories.',
    }
  }

  /**
   * Hero overlay copy: one sentence, about 25 words, broken on a sentence
   * or a word. Does not rewrite the stored story.
   */
  static capWords(text, limit = HomepageStructure.HERO_WORD_CAP) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim()
    if (!clean) return ''
    const sentences = clean.match(/[^.!?]+[.!?]+(?:["'”’)\]]+)?|[^.!?]+$/g) || [clean]
    const first = sentences[0].trim()
    const words = first.split(/\s+/).filter(Boolean)
    if (words.length <= limit + HomepageStructure.HERO_WORD_SLACK) return first
    const broken = words
      .slice(0, limit)
      .join(' ')
      .replace(/[,:;]+$/g, '')
      .trim()
    if (!broken) return first
    return /[.!?]["'”’)\]]*$/.test(broken) ? broken : `${broken}…`
  }

  /**
   * Drop a trailing ellipsis that the brief pipeline stored on summaries.
   * The card clamp draws the only ellipsis.
   */
  static deckText(summary) {
    return String(summary || '')
      .replace(/\s*(?:\u2026|\.\.\.)\s*$/u, '')
      .trim()
  }

  static pickHighlights(stories, excludeSlugs, limit = 4) {
    const exclude = new Set(excludeSlugs || [])
    const pool = (stories || []).filter((s) => s?.slug && !exclude.has(s.slug) && s.photo?.image_url)
    const byEra = new Map(HomepageStructure.ERA_ORDER.map((era) => [era, []]))
    for (const story of pool) {
      const era = byEra.has(story.era) ? story.era : 'other'
      byEra.get(era).push(story)
    }
    for (const list of byEra.values()) list.sort(HomepageStructure.#newest)
    const picked = []
    const used = new Set()
    for (const era of HomepageStructure.ERA_ORDER) {
      const next = byEra.get(era).find((s) => !used.has(s.slug))
      if (!next) continue
      picked.push(next)
      used.add(next.slug)
      if (picked.length === limit) return picked
    }
    for (const story of pool.filter((s) => !used.has(s.slug)).sort(HomepageStructure.#newest)) {
      picked.push(story)
      if (picked.length === limit) break
    }
    return picked
  }

  /** A story that is not already in the hero or the highlights. */
  static pickQuote(stories, excludeSlugs) {
    const exclude = new Set(excludeSlugs || [])
    const pool = (stories || []).filter((s) => s?.slug && !exclude.has(s.slug))
    pool.sort(HomepageStructure.#newest)
    return pool[0] || null
  }

  /**
   * Keep every daily story, but do not open Explore on the hero set.
   * The skipped stories return after the first page of other stories.
   */
  static deferFromFirstPage(items, skipSlugs, pageSize = HomepageStructure.EXPLORE_DEFER_PAGE) {
    const skip = skipSlugs instanceof Set ? skipSlugs : new Set(skipSlugs || [])
    if (!skip.size) return items.slice()
    const kept = []
    const held = []
    for (const item of items || []) {
      const slug = HomepageStructure.itemSlug(item)
      if (slug && skip.has(slug)) held.push(item)
      else kept.push(item)
    }
    const size = Math.max(1, pageSize | 0)
    return [...kept.slice(0, size), ...held, ...kept.slice(size)]
  }

  static itemSlug(item) {
    const key = String(item?.key || '')
    if (key.startsWith('story:')) return key.slice('story:'.length)
    return item?.slug || ''
  }

  static relatedBundle(groups) {
    const all = []
    for (const group of groups || []) {
      for (const site of group.sites || []) all.push(site)
    }
    const byHref = new Map(all.map((site) => [site.href, site]))
    const picks = []
    for (const href of HomepageStructure.PICK_HREFS) {
      const site = byHref.get(href)
      if (site && !picks.includes(site)) picks.push(site)
    }
    for (const site of all) {
      if (picks.length >= 6) break
      if (!picks.includes(site)) picks.push(site)
    }
    return { picks: picks.slice(0, 6), total: all.length, groups: groups || [] }
  }

  static #newest(a, b) {
    const da = String(a.publishedDate || a.briefDate || '')
    const db = String(b.publishedDate || b.briefDate || '')
    if (da !== db) return da < db ? 1 : -1
    return String(a.title || '').localeCompare(String(b.title || ''))
  }

  static async #json(url) {
    try {
      const res = await fetch(url)
      if (res.ok) return await res.json()
    } catch {
      /* catalog is optional; the hero pack still renders */
    }
    return null
  }
}
