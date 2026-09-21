#!/usr/bin/env node
/**
 * Build public/content/home-preview.json from the latest KY History morning brief.
 *
 * Pipeline (KY History / CoS):
 *   1. Ingest the daily email as public/content/raw-briefs/YYYY-MM-DD.md
 *   2. npm run parse-briefs  →  public/content/stories/<slug>.json + stories.json
 *   3. This script (npm run build-home-preview, also part of npm run build)
 *      picks stories for the newest briefDate, in morning-email order,
 *      attaches attributed photos (Wikipedia / Wikimedia Commons / historic-photos.json),
 *      and writes the magazine homepage pack.
 *
 * The magazine homepage at `/` reads this pack, then re-checks stories.json
 * in the browser so a newer brief still surfaces if this step was skipped.
 * Presentation is evergreen (no this-morning / calendar-date kickers).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const UA = 'kyhistorydrive-home-preview/1.0 (https://github.com/shannonsnowden/kyhistorydrive)'
const EMOJI_HEADER =
  /^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}])\s+(.+)$/u

function slugify(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
}

function cleanUrl(url) {
  try {
    const u = new URL(url)
    u.search = ''
    return u.toString()
  } catch {
    return url
  }
}

function isPhotoUrl(url) {
  const u = String(url || '').toLowerCase()
  if (!u) return false
  if (/\.svg(\?|$)/i.test(u)) return false
  // Wikipedia often leads with schematic maps / locator diagrams — not card photos.
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

function isLocalPhoto(photo) {
  return String(photo?.image_url || '').startsWith('/content/photos/')
}

function extractWikipediaUrl(markdown) {
  const m = String(markdown || '').match(/https?:\/\/en\.wikipedia\.org\/wiki\/[^\s)\]">]+/i)
  return m ? m[0].replace(/[.,;:]+$/g, '') : null
}

function wikiTitleFromUrl(url) {
  try {
    const u = new URL(url)
    const title = decodeURIComponent(u.pathname.replace(/^\/wiki\//, '')).replace(/_/g, ' ')
    return title || null
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

function commonsQueries(title, extra) {
  const cleaned = String(title || '')
    .replace(/\b(capt\.|col\.|gen\.|dr\.|maj\.|lt\.)\s*/gi, '')
    .replace(/[()0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return [...new Set([extra, cleaned, `${cleaned} Kentucky`, title].filter(Boolean))]
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

function briefOrder(briefDate) {
  const file = path.join(ROOT, 'public/content/raw-briefs', `${briefDate}.md`)
  if (!fs.existsSync(file)) return []
  const slugs = []
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(EMOJI_HEADER)
    if (m) slugs.push(slugify(m[1]))
  }
  return slugs
}

async function wikiJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  })
  if (!res.ok) return null
  return res.json()
}

async function fetchWikipediaPhoto(titleOrUrl) {
  if (!titleOrUrl) return null
  let title = titleOrUrl
  if (/^https?:\/\//i.test(titleOrUrl)) title = wikiTitleFromUrl(titleOrUrl) || titleOrUrl
  title = String(title).trim()
  if (!title) return null
  const candidates = [title]
  if (!/,?\s*kentucky$/i.test(title) && !/state park|national/i.test(title)) {
    candidates.push(`${title}, Kentucky`)
  }
  for (const cand of candidates) {
    const api = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cand.replace(/ /g, '_'))}`
    const data = await wikiJson(api)
    if (!data) continue
    const src = data.originalimage?.source || data.thumbnail?.source
    if (!src || !isPhotoUrl(src)) continue
    return {
      image_url: cleanUrl(src),
      title: data.title || cand,
      source_url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(cand.replace(/ /g, '_'))}`,
      source_label: 'Wikipedia',
      attribution: 'Wikipedia',
    }
  }
  return null
}

async function fetchCommonsPhoto(query) {
  if (!query) return null
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: query,
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|mime|size',
    iiurlwidth: '1600',
    format: 'json',
    origin: '*',
  })
  const data = await wikiJson(`https://commons.wikimedia.org/w/api.php?${params}`)
  const pages = Object.values(data?.query?.pages || {})
  const toks = String(query)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(kentucky|historic|history|photo)$/.test(w))
  let best = null
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    if (!info) continue
    if (!/^image\/(jpeg|jpg|png|webp)/i.test(info.mime || '')) continue
    const img = info.thumburl || info.url
    if (!img || !isPhotoUrl(img)) continue
    const hay = String(page.title || '').toLowerCase()
    const hits = toks.filter((t) => hay.includes(t)).length
    const score = hits * 10 + (info.width || 0) / 1000
    if (!best || score > best.score) {
      best = {
        score,
        image_url: cleanUrl(img),
        title: String(page.title || '').replace(/^File:/, ''),
        source_url: info.descriptionurl,
        source_label: 'Wikimedia Commons',
        attribution: 'Wikimedia Commons',
      }
    }
  }
  return best && best.score >= 10 ? best : null
}

function publicPhoto(photo) {
  if (!photo) return null
  const { score, hits, ...rest } = photo
  return rest
}

function loadCuratedPhotos(rel = 'scripts/story-photo-curated.json') {
  const file = path.join(ROOT, rel)
  if (!fs.existsSync(file)) return {}
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  const out = {}
  for (const [slug, row] of Object.entries(raw)) {
    if (slug.startsWith('_') || !row || typeof row !== 'object') continue
    out[slug] = row
  }
  return out
}

function curatedPublicPhoto(id, row, publicDir = '/content/photos/stories') {
  const ext = row.ext || 'jpg'
  return {
    image_url: `${publicDir}/${id}.${ext}`,
    title: row.title,
    source_url: row.source_url,
    source_label: row.source_label || 'Wikimedia Commons',
    attribution: row.attribution,
    year: row.year || null,
  }
}

function vendorCandidateUrls(row) {
  const urls = []
  if (row.thumb_url) urls.push(row.thumb_url)
  if (row.commonsFile) {
    urls.push(
      `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(row.commonsFile)}?width=1280`,
    )
  }
  return [...new Set(urls)]
}

async function downloadVendorBytes(urls) {
  let lastErr = null
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'image/*', 'User-Agent': UA },
        redirect: 'follow',
      })
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`)
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 1000) {
        lastErr = new Error(`tiny download (${buf.length}b) for ${url}`)
        continue
      }
      return buf
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('no vendor URLs')
}

async function vendorCuratedPhoto(
  id,
  row,
  { destDir = 'public/content/photos/stories', publicDir = '/content/photos/stories' } = {},
) {
  const ext = row.ext || 'jpg'
  const rel = path.join(destDir, `${id}.${ext}`)
  const abs = path.join(ROOT, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  const photo = curatedPublicPhoto(id, row, publicDir)
  const exists = fs.existsSync(abs) && fs.statSync(abs).size > 1000
  if (exists) return photo
  const urls = vendorCandidateUrls(row)
  if (!urls.length) return photo
  try {
    const buf = await downloadVendorBytes(urls)
    fs.writeFileSync(abs, buf)
  } catch (err) {
    console.warn(`vendor ${id}: ${err.message} — using remote thumb`)
    return { ...photo, image_url: cleanUrl(row.thumb_url || photo.image_url) }
  }
  return photo
}

function matchHistoricPhoto(story, historicPhotos) {
  const tokens = String(story.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !/^(kentucky|county|captain|colonel)$/.test(w))
  if (!tokens.length) return null
  let best = null
  for (const ph of historicPhotos) {
    if (!ph.image_url) continue
    const hay = [ph.title, ...(ph.related_place_names || [])].join(' ').toLowerCase()
    const hits = tokens.filter((t) => hay.includes(t)).length
    if (hits < tokens.length) continue
    if (!best || hits > best.hits) {
      best = {
        hits,
        image_url: ph.image_url,
        title: ph.title,
        source_url: ph.source_url,
        source_label: ph.collection || ph.source || 'Historic photo',
        attribution: [ph.source || ph.collection, ph.year].filter(Boolean).join(' · '),
        year: ph.year || null,
      }
    }
  }
  return best
}

async function resolvePhoto({
  slug,
  title,
  bodyMarkdown,
  wiki,
  commons,
  historicPhotos,
  existing,
  curated,
}) {
  if (curated?.thumb_url || curated?.ext) {
    return vendorCuratedPhoto(slug, curated)
  }
  if (isLocalPhoto(existing) || (existing?.image_url && isPhotoUrl(existing.image_url))) {
    return existing
  }
  const wikiUrl = extractWikipediaUrl(bodyMarkdown)
  const tries = [
    () => fetchWikipediaPhoto(wikiUrl),
    () => fetchWikipediaPhoto(wiki),
    ...commonsQueries(title, commons).map((q) => () => fetchCommonsPhoto(q)),
    () => Promise.resolve(matchHistoricPhoto({ title }, historicPhotos || [])),
  ]
  for (const fn of tries) {
    try {
      const photo = await fn()
      if (photo?.image_url && isPhotoUrl(photo.image_url)) return photo
    } catch {
      /* try next */
    }
  }
  return null
}

function loadStory(slug) {
  const file = path.join(ROOT, 'public/content/stories', `${slug}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeStoryPhoto(slug, photo) {
  const next = publicPhoto(photo)
  if (!next?.image_url) return false
  const file = path.join(ROOT, 'public/content/stories', `${slug}.json`)
  if (!fs.existsSync(file)) return false
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (JSON.stringify(raw.photo || null) === JSON.stringify(next)) return false
  raw.photo = next
  fs.writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`)
  return true
}

function writeStoryPhotoIndex(locations) {
  const dir = path.join(ROOT, 'public/content/stories')
  const bySlug = {}
  const byHistoryId = {}
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    const raw = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))
    if (!raw.photo?.image_url || !raw.slug) continue
    const loc = locations?.locations?.[raw.slug] || {}
    const row = {
      slug: raw.slug,
      historyId: loc.historyId || null,
      photo: raw.photo,
    }
    bySlug[raw.slug] = row
    if (loc.historyId) byHistoryId[loc.historyId] = row
  }
  const out = path.join(ROOT, 'public/content/story-photos.json')
  fs.writeFileSync(
    out,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), bySlug, byHistoryId }, null, 2)}\n`,
  )
  return { slugCount: Object.keys(bySlug).length, historyCount: Object.keys(byHistoryId).length }
}

function patchStoriesIndexPhotos() {
  const indexPath = path.join(ROOT, 'public/content/stories.json')
  if (!fs.existsSync(indexPath)) return 0
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  let n = 0
  for (const row of index.stories || []) {
    const full = loadStory(row.slug)
    if (!full?.photo?.image_url) continue
    if (JSON.stringify(row.photo || null) === JSON.stringify(full.photo)) continue
    row.photo = full.photo
    n += 1
  }
  if (n) fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`)
  return n
}

async function main() {
  const { LAYER_HIGHLIGHTS } = await import(
    pathToFileURL(path.join(ROOT, 'src/home-preview-data.js')).href
  )
  const index = readJson('public/content/stories.json')
  const locations = readJson('public/content/stories-locations.json')
  const historicPhotos = readJson('public/data/historic-photos.json')
  const curatedPhotos = loadCuratedPhotos()
  const curatedLayerPhotos = loadCuratedPhotos('scripts/layer-photo-curated.json')

  const briefDate = index.briefDateRange?.end
  if (!briefDate) throw new Error('stories.json has no briefDateRange.end')

  const bySlug = new Map(index.stories.map((s) => [s.slug, s]))
  const order = briefOrder(briefDate)
  let slugs = order.filter((slug) => bySlug.has(slug))
  if (!slugs.length) {
    slugs = index.stories.filter((s) => s.briefDate === briefDate).map((s) => s.slug)
  }
  if (!slugs.length) {
    slugs = index.stories.slice(-5).map((s) => s.slug)
  }

  const cards = []
  for (const slug of slugs) {
    const meta = bySlug.get(slug) || {}
    const full = loadStory(slug) || meta
    const loc = locations.locations?.[slug] || {}
    const extraCommons = {
      'shawnee-chillicothe-divisions': 'Old Chillicothe Shawnee Ohio',
      'hansen-site-15gp14': 'Portsmouth Earthworks Ohio',
      'capt-jack-jouett': 'Jack Jouett House',
      'ann-mcginty-and-kentuckys-first-spinning-wheel': 'Old Fort Harrod State Park',
      'lawrenceburg-from-kaufmans-station-to-anderson-county-seat':
        'Anderson County courthouse Lawrenceburg Kentucky',
      'wea-towns-at-ouiatenon-and-scotts-1791-kentucky-raid': 'Fort Ouiatenon blockhouse',
      'adams-site-mississippian-town-near-hickman': 'Hickman Carnegie Library Kentucky',
      'henry-mckennas-fairfield-sour-mash': 'Fairfield Kentucky Route 48',
    }
    const photo = await resolvePhoto({
      slug,
      title: full.title || meta.title,
      bodyMarkdown: full.bodyMarkdown || full.summary,
      commons: extraCommons[slug],
      historicPhotos,
      existing: full.photo,
      curated: curatedPhotos[slug],
    })
    const lat = loc.lat ?? meta.lat ?? null
    const lon = loc.lon ?? meta.lon ?? null
    const historyId = loc.historyId || meta.historyId || null
    const mapHref = historyId
      ? `/#map/history/${encodeURIComponent(historyId)}`
      : lat != null && lon != null
        ? `/#map/stories/${encodeURIComponent(slug)}`
        : null
    cards.push({
      slug,
      title: full.title || meta.title,
      summary: full.summary || meta.summary || '',
      era: full.era || meta.era || '',
      yearStart: full.yearStart ?? meta.yearStart ?? null,
      briefDate: full.briefDate || meta.briefDate || briefDate,
      href: `/#timeline/${encodeURIComponent(slug)}`,
      place: loc.matchedPlace || null,
      lat,
      lon,
      historyId,
      mapHref,
      quote: firstSentence(full.bodyMarkdown || full.summary || ''),
      photo: publicPhoto(photo),
    })
  }

  const withPhotos = cards.filter((c) => c.photo?.image_url)
  const hero = withPhotos[0] || cards[0] || null
  const features = cards.filter((c) => c !== hero)

  let persisted = 0
  for (const card of cards) {
    if (writeStoryPhoto(card.slug, card.photo)) persisted += 1
  }
  const photoIndex = writeStoryPhotoIndex(locations)
  const indexPatched = patchStoriesIndexPhotos()

  const layers = []
  for (const item of LAYER_HIGHLIGHTS) {
    const curated = curatedLayerPhotos[item.placeId]
    const photo = curated
      ? await vendorCuratedPhoto(item.placeId, curated, {
          destDir: 'public/content/photos/layers',
          publicDir: '/content/photos/layers',
        })
      : item.photo?.image_url
        ? item.photo
        : await resolvePhoto({
            title: item.name,
            wiki: item.wiki,
            commons: item.commons,
            historicPhotos,
          })
    layers.push({
      ...item,
      href: `/#map/${encodeURIComponent(item.layerId)}/${encodeURIComponent(item.placeId)}`,
      photo: publicPhoto(photo),
    })
  }
  const remoteLayers = layers.filter((l) => !isLocalPhoto(l.photo))
  if (remoteLayers.length) {
    throw new Error(
      `Layer photos must be vendored under /content/photos/layers/; still remote: ${remoteLayers
        .map((l) => l.placeId)
        .join(', ')}`,
    )
  }

  const pack = {
    generatedAt: new Date().toISOString(),
    briefDate,
    displayDate: formatDisplayDate(briefDate),
    howToRefresh:
      'Ingest the KY History morning email to public/content/raw-briefs/YYYY-MM-DD.md, run npm run parse-briefs, then npm run build (includes build-home-preview). The homepage also re-reads stories.json in the browser.',
    stories: cards,
    hero,
    features,
    layers,
    quote: hero?.quote
      ? { text: hero.quote, source: hero.title, href: hero.href }
      : null,
  }

  const out = path.join(ROOT, 'public/content/home-preview.json')
  fs.writeFileSync(out, `${JSON.stringify(pack, null, 2)}\n`)
  const photoCount = [hero, ...features, ...layers].filter((x) => x?.photo?.image_url).length
  console.log(
    `Wrote ${out} (${briefDate}, ${cards.length} stories, ${photoCount} photos; persisted ${persisted} story photos, index ${photoIndex?.slugCount || 0}, stories.json +${indexPatched})`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
