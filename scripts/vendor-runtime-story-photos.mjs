#!/usr/bin/env node
/**
 * Copy runtime story photos into public/content/photos/stories/.
 *
 * Stories with no stored photo borrow one in the browser from a nearby
 * Historypin item, the cited Wikipedia page image, or a Wikimedia Commons
 * search (see resolveStorySidebarPhoto in src/main.js). This script picks
 * that same image, then keeps it only when the file license is public
 * domain, CC0, CC BY, or CC BY-SA. Historypin and anything else is listed
 * and left on the runtime fallback.
 *
 *   node scripts/vendor-runtime-story-photos.mjs           # report only
 *   node scripts/vendor-runtime-story-photos.mjs --apply   # write files
 */
import { createHash } from 'node:crypto'
import { storyBlocksAutoPhoto } from '../src/no-auto-story-photos.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { optimizePhoto } from './optimize-home-images.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')
const UA = 'kyhistorydrive-photo-vendor/1.0 (https://kyhistorydrive.com; local photo archive)'
const CACHE = '/tmp/khd-photo-cache'
const REPORT = '/tmp/khd-photo-report.json'
const MAX_WIDTH = 1600

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function collapseRepeat(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim()
  const half = Math.floor(t.length / 2)
  if (half > 8 && t.slice(0, half).trim() === t.slice(half).trim()) t = t.slice(0, half).trim()
  const parts = t.split(' ')
  if (parts.length >= 2 && parts.length % 2 === 0) {
    const mid = parts.length / 2
    if (parts.slice(0, mid).join(' ') === parts.slice(mid).join(' ')) t = parts.slice(0, mid).join(' ')
  }
  return t
}

function cleanAuthor(meta) {
  let artist = collapseRepeat(stripHtml(meta?.Artist?.value))
  let credit = collapseRepeat(stripHtml(meta?.Credit?.value))
  artist = artist.replace(/^(unknown author)\s*/i, '').trim()
  credit = credit.replace(/^(unknown author)\s*/i, '').trim()
  let raw = artist || credit
  raw = raw.replace(/^No machine-readable author provided\.\s*/i, '')
  raw = raw.replace(/\s*assumed \(based on copyright claims\)\.?/i, '').replace(/[.\s]+$/g, '')
  if (!raw || /unknown author|not provided/i.test(raw)) return ''
  if (/^https?:\/\//i.test(raw) && raw.length < 180) return raw
  return raw.length > 180 ? `${raw.slice(0, 177)}…` : raw
}

function topicTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !/^(the|and|for|from|with|near|county|kentucky|history|historic|photo|image|german|long|hunter|capt|col|builds|claims|ohio|run)$/.test(
          w,
        ),
    )
}

function strongTopicTokens(text) {
  return topicTokens(text).filter((w) => w.length >= 5 || /^[a-z]{4,}$/.test(w))
}

function photoHaystack(photo) {
  return [
    photo?.title,
    photo?.attribution,
    photo?.credit,
    photo?.source_label,
    photo?.source,
    photo?.collection,
    photo?.description,
    photo?.city,
    photo?.county,
    (photo?.related_place_names || []).join(' '),
    (photo?.tags || []).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function photoTopicHits(photo, topicText) {
  const tokens = topicTokens(topicText)
  if (!tokens.length) return 0
  const hay = photoHaystack(photo)
  let hits = 0
  for (const tok of tokens) if (hay.includes(tok)) hits += 1
  const strong = strongTopicTokens(topicText)
  if (strong.length) {
    const strongHits = strong.filter((tok) => hay.includes(tok)).length
    if (strongHits === 0) return 0
  }
  return hits
}

function topicPhotoScore(photo, title, placeHint) {
  if (!photo?.image_url) return -1
  const tokens = topicTokens(title)
  const hay = photoHaystack(photo)
  let score = typeof photo.score === 'number' ? photo.score : 0
  let hits = 0
  for (const tok of tokens) {
    if (hay.includes(tok)) {
      hits += 1
      score += 12
    }
  }
  if (placeHint && hay.includes(String(placeHint).toLowerCase().slice(0, 10))) score += 6
  if (/wikipedia/i.test(photo.source_label || '')) score += 4
  if (tokens.length && hits === 0) score -= 80
  return score
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function inferPhotoInstitution(text) {
  const t = String(text || '').toLowerCase()
  if (/library of congress|loc\.gov|\bloc\b/.test(t)) return 'Library of Congress'
  if (/national archives|archives\.gov|\bnara\b|u\.s\. national archive/.test(t)) return 'National Archives'
  if (/kentucky historical society|history\.ky\.gov|\bkyhs\b/.test(t)) return 'Kentucky Historical Society'
  if (/smithsonian/.test(t)) return 'Smithsonian'
  if (/historypin/.test(t)) return 'Historypin'
  if (/university of louisville|ulpa/.test(t)) return 'University of Louisville (ULPA)'
  if (/wikimedia commons/.test(t)) return 'Wikimedia Commons'
  if (/wikipedia/.test(t)) return 'Wikipedia'
  return null
}

function trimUnbalancedTrailingParens(url) {
  let u = String(url || '')
  while (u.endsWith(')') && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) u = u.slice(0, -1)
  return u
}

function extractWikipediaUrl(markdown) {
  const re = /https?:\/\/[^\s"<>\]]+/gi
  const s = String(markdown || '')
  let m
  while ((m = re.exec(s))) {
    let u = trimUnbalancedTrailingParens(m[0].replace(/[.,;:]+$/g, ''))
    if (!/en\.wikipedia\.org\/wiki\//i.test(u)) continue
    if (/Special:Search/i.test(u)) continue
    try {
      const parsed = new URL(u)
      parsed.hash = ''
      parsed.hostname = parsed.hostname.toLowerCase()
      return parsed.toString()
    } catch {
      return u
    }
  }
  return null
}

function wikipediaTitleFromUrl(url) {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    const i = parts.indexOf('wiki')
    if (i >= 0 && parts[i + 1]) return decodeURIComponent(parts[i + 1].replace(/_/g, ' '))
  } catch {
    /* ignore */
  }
  return null
}

function fileFromUploadUrl(url) {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts[0] === 'wikipedia' && parts[1] === 'en') return { localWiki: true, file: '' }
    const thumb = parts.indexOf('thumb')
    if (thumb >= 0 && parts[thumb + 3]) return { localWiki: false, file: decodeURIComponent(parts[thumb + 3]) }
    const last = parts[parts.length - 1]
    if (last && /\.[a-z0-9]+$/i.test(last)) return { localWiki: false, file: decodeURIComponent(last) }
  } catch {
    /* ignore */
  }
  return { localWiki: false, file: '' }
}

function licenseDecision(meta) {
  const shortName = stripHtml(meta?.LicenseShortName?.value)
  const longName = stripHtml(meta?.UsageTerms?.value)
  const code = stripHtml(meta?.License?.value)
  const licenseUrl = stripHtml(meta?.LicenseUrl?.value)
  const blob = `${shortName} ${longName} ${code} ${licenseUrl}`.toLowerCase()
  if (!shortName && !licenseUrl && !code) {
    return { ok: false, reason: 'no license metadata', license: '', license_url: '' }
  }
  if (/(?:^|[^a-z])(?:nc|nd)(?:[^a-z]|$)|non-?commercial|no-?deriv|all rights reserved|fair use/.test(blob)) {
    return { ok: false, reason: `not a free license (${shortName || code || 'unspecified'})`, license: shortName || code, license_url: licenseUrl }
  }
  const url = licenseUrl.toLowerCase()
  const name = shortName.toLowerCase()
  const isCC0 = /^cc0\b/.test(name) || /publicdomain\/zero/.test(url) || code === 'cc-zero' || code === 'cc0'
  const isPD = /public domain|^pd\b|\bpdm\b/.test(name) || code === 'pd' || /^pd-/.test(code)
  const isBYSA = /cc by-sa\b/.test(name) || /\/licenses\/by-sa\//.test(url) || /^cc-by-sa/.test(code)
  const isBY = /cc by\b/.test(name) || /\/licenses\/by\//.test(url) || /^cc-by-\d/.test(code)
  let license = shortName
  let ok = false
  if (isCC0) {
    ok = true
    license = shortName || 'CC0'
  } else if (isPD && !isBY && !isBYSA) {
    ok = true
    license = shortName || 'Public domain'
  } else if (isBYSA) {
    ok = true
    license = shortName || 'CC BY-SA'
  } else if (isBY) {
    ok = true
    license = shortName || 'CC BY'
  }
  let license_url = /^https?:\/\//i.test(licenseUrl) ? licenseUrl : ''
  if (!license_url && code && /^[a-z0-9-]+$/i.test(code)) {
    license_url = `https://commons.wikimedia.org/wiki/Template:${code}`
  }
  if (!license_url && isPD) license_url = 'https://commons.wikimedia.org/wiki/Template:PD'
  if (!license_url && isCC0) license_url = 'https://creativecommons.org/publicdomain/zero/1.0/'
  if (!ok) {
    return {
      ok: false,
      reason: `unclear or not an allowed license (${shortName || code || 'unspecified'})`,
      license: shortName || code,
      license_url,
    }
  }
  return { ok: true, reason: '', license, license_url }
}

function captionFrom(meta, fileName) {
  const objectName = stripHtml(meta?.ObjectName?.value).replace(/_/g, ' ')
  const desc = stripHtml(meta?.ImageDescription?.value)
  const pretty = String(fileName || '')
    .replace(/_/g, ' ')
    .replace(/\.[a-z0-9]+$/i, '')
  const bareFile = pretty.toLowerCase()
  if (objectName && objectName.toLowerCase() !== bareFile && objectName.length <= 140) return objectName
  if (desc) {
    const sentence = desc.split(/(?<=[.!?])\s+/)[0]
    if (sentence.length <= 160) return sentence
    return `${sentence.slice(0, 157)}…`
  }
  return objectName || pretty
}

function yearFrom(meta) {
  const raw = stripHtml(meta?.DateTimeOriginal?.value || '')
  const m = raw.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/)
  if (!m) return null
  const y = Number(m[1])
  return y >= 1000 && y <= 2026 ? y : null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function cachedJson(url) {
  fs.mkdirSync(CACHE, { recursive: true })
  const key = createHash('sha256').update(url).digest('hex')
  const file = path.join(CACHE, `${key}.json`)
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
  let lastErr = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await sleep(attempt ? 1500 * attempt : 250)
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA, 'Api-User-Agent': UA } })
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`${res.status} ${url}`)
      continue
    }
    if (!res.ok) return null
    const data = await res.json()
    fs.writeFileSync(file, JSON.stringify(data))
    return data
  }
  throw lastErr || new Error(`failed ${url}`)
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor
      cursor += 1
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return out
}

function photosForPlace({ lat, lon, name, historyId, historicPhotos, siteLinks }) {
  const out = []
  const seen = new Set()
  const push = (p) => {
    const id = p.photo_id || p.id || p.image_url
    if (!id || seen.has(id) || !p.image_url) return
    if (name && photoTopicHits(p, name) < 1) return
    seen.add(id)
    out.push(p)
  }
  for (const link of siteLinks || []) {
    if (historyId && link.site_id === historyId) {
      for (const ph of link.photos || []) push(ph)
    }
    if (link.layer === 'history' && link.site_id === historyId) {
      for (const ph of link.photos || []) push(ph)
    }
    const siteName = String(link.site_name || '').toLowerCase()
    if (name && siteName && siteName.includes(String(name).toLowerCase().slice(0, 18))) {
      for (const ph of link.photos || []) push(ph)
    }
  }
  if (lat != null && lon != null) {
    const nearby = []
    for (const ph of historicPhotos || []) {
      if (ph.latitude == null || ph.longitude == null || !ph.image_url) continue
      const d = haversineM(lat, lon, ph.latitude, ph.longitude)
      if (d <= 2500) {
        const related = (ph.related_place_names || []).join(' ').toLowerCase()
        const nameHit = name && related.includes(String(name).toLowerCase().slice(0, 12))
        if (photoTopicHits(ph, name) >= 1 || nameHit) nearby.push({ ...ph, distance_m: Math.round(d), photo_id: ph.id })
      } else if (name) {
        const related = (ph.related_place_names || []).join(' ').toLowerCase()
        if (related.includes(String(name).toLowerCase().slice(0, 12))) {
          nearby.push({ ...ph, distance_m: Math.round(d), photo_id: ph.id })
        }
      }
    }
    nearby.sort((a, b) => (a.distance_m || 0) - (b.distance_m || 0))
    for (const ph of nearby.slice(0, 6)) push(ph)
  }
  return out.slice(0, 6)
}

async function fetchWikipediaThumbnail(titleOrUrl) {
  if (!titleOrUrl) return null
  let title = titleOrUrl
  if (/^https?:\/\//i.test(titleOrUrl)) title = wikipediaTitleFromUrl(titleOrUrl) || titleOrUrl
  title = String(title).trim()
  if (!title) return null
  const candidates = [title]
  if (!/,?\s*kentucky$/i.test(title)) candidates.push(`${title}, Kentucky`)
  for (const cand of candidates) {
    const api = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cand.replace(/ /g, '_'))}`
    const data = await cachedJson(api)
    if (!data) continue
    const src = data?.thumbnail?.source || data?.originalimage?.source
    if (!src) continue
    const located = fileFromUploadUrl(data?.originalimage?.source || src)
    return {
      kind: 'wikipedia',
      score: 18,
      image_url: src,
      title: data.title || cand,
      source_url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(cand.replace(/ /g, '_'))}`,
      source_label: 'Wikipedia',
      attribution: 'Wikipedia',
      credit: 'Wikipedia',
      year: null,
      commonsFile: located.file,
      localWiki: located.localWiki,
      pageTitle: data.title || cand,
    }
  }
  return null
}

async function fetchCommonsImage(title, placeHint) {
  const queries = [
    `${title} Kentucky`,
    `${title} Kentucky "Library of Congress"`,
    `${title} Kentucky "National Archives"`,
    `${title} "Kentucky Historical Society"`,
    title,
  ]
  for (const q of queries) {
    try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: q,
      gsrlimit: '8',
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata|size',
      iiurlwidth: '1600',
      format: 'json',
      origin: '*',
    })
    const data = await cachedJson(`https://commons.wikimedia.org/w/api.php?${params}`)
    const pages = Object.values(data?.query?.pages || {})
    if (!pages.length) continue
    const toks = topicTokens(title)
    const strongToks = strongTopicTokens(title)
    const scored = []
    for (const page of pages) {
      const info = page.imageinfo?.[0]
      if (!info) continue
      const mime = info.mime || ''
      if (!/^image\//.test(mime) || /svg\+xml|gif|tiff|pdf/i.test(mime)) continue
      if (/\.djvu|\.pdf/i.test(page.title || '')) continue
      const meta = info.extmetadata || {}
      const artist = stripHtml(meta.Artist?.value)
      const credit = stripHtml(meta.Credit?.value)
      const license = stripHtml(meta.LicenseShortName?.value)
      const desc = stripHtml(meta.ImageDescription?.value)
      const objectName = stripHtml(meta.ObjectName?.value) || String(page.title || '').replace(/^File:/, '')
      const blob = [artist, credit, license, desc, objectName, page.title].join(' | ')
      if (/\b(logo|icon|coat of arms|seal of|flag icon|pictogram|spacer|placeholder)\b/i.test(blob)) continue
      const institution = inferPhotoInstitution(blob)
      let score = 0
      if (institution === 'Library of Congress') score += 40
      else if (institution === 'National Archives') score += 38
      else if (institution === 'Kentucky Historical Society') score += 36
      else if (institution) score += 12
      const hay = blob.toLowerCase()
      let hits = 0
      for (const tok of toks) {
        if (hay.includes(tok)) {
          hits += 1
          score += 14
        }
      }
      const strongHits = strongToks.filter((tok) => hay.includes(tok)).length
      if (strongToks.length && strongHits === 0) score -= 40
      if (hits === 0 && toks.length) score -= 25
      if (/kentucky/i.test(blob) || /kentucky/i.test(page.title || '')) score += 10
      if (placeHint && new RegExp(String(placeHint).slice(0, 12), 'i').test(blob)) score += 8
      if (/\b(photograph|photo|historic|monument|battlefield|mound|fort|station)\b/i.test(blob)) score += 6
      if (/\b(map of|locator|diagram|schematic)\b/i.test(blob)) score -= 12
      const img = info.thumburl || info.url
      if (!img) continue
      const file = String(page.title || '').replace(/^File:/, '')
      scored.push({
        kind: 'commons',
        score,
        image_url: img,
        title: objectName,
        source_url: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        source_label: institution || 'Wikimedia Commons',
        attribution: [institution || 'Wikimedia Commons', artist || credit, license]
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(' · '),
        credit: institution || artist || credit || 'Wikimedia Commons',
        year: null,
        commonsFile: file,
        meta,
        thumburl: info.thumburl || info.url,
        mime: info.mime,
      })
    }
    scored.sort((a, b) => b.score - a.score)
    const pick = scored.find((s) => s.score >= 20) || null
    if (pick) return pick
    } catch {
      /* same as the browser: a bad query is skipped */
    }
  }
  return null
}

async function imageInfo(fileName) {
  const params = new URLSearchParams({
    action: 'query',
    titles: `File:${fileName}`,
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata|size',
    iiurlwidth: '1600',
    format: 'json',
    origin: '*',
  })
  const data = await cachedJson(`https://commons.wikimedia.org/w/api.php?${params}`)
  const page = Object.values(data?.query?.pages || {})[0]
  if (!page || page.missing != null || !page.imageinfo?.[0]) return null
  return { ...page.imageinfo[0], fileTitle: page.title }
}

function storedPhoto({ caption, sourceUrl, author, license, licenseUrl, year }) {
  const credit = author || ''
  const bits = [credit, 'Wikimedia Commons', license].filter(Boolean)
  return {
    image_url: '',
    title: caption,
    source_url: sourceUrl,
    source_label: 'Wikimedia Commons',
    attribution: bits.join(' · '),
    year: year ?? null,
    credit,
    license,
    license_url: licenseUrl,
  }
}

async function resolveOne(story, loc, historicPhotos, siteLinks) {
  if (storyBlocksAutoPhoto(story.slug)) {
    return {
      slug: story.slug,
      title: story.title,
      status: 'skipped',
      reason: 'no auto photo (wrong subject)',
      license: 'blocked',
      source: '',
    }
  }
  const title = story.title
  const placeHint = loc.matchedPlace || story.county || ''
  const lat = loc.lat ?? null
  const lon = loc.lon ?? null
  const historyId = loc.historyId || null
  const candidates = []
  const local = photosForPlace({ lat, lon, name: title, historyId, historicPhotos, siteLinks })
  if (local[0]?.image_url) {
    const rawCredit = local[0].source || local[0].collection || 'Historic photo'
    const institution = inferPhotoInstitution(rawCredit) || rawCredit
    const hits = photoTopicHits(local[0], title)
    candidates.push({
      ...local[0],
      kind: /historypin/i.test(`${local[0].source || ''} ${local[0].source_url || ''} ${institution}`) ? 'historypin' : 'historic',
      score: 20 + hits * 10,
      source_label: institution,
      attribution: [institution, local[0].collection, local[0].year].filter(Boolean).join(' · '),
      credit: institution,
    })
  }
  const wikiFromBody = extractWikipediaUrl(story.bodyMarkdown)
  let wikiPhoto = null
  let commonsPhoto = null
  let lookupFailures = 0
  try {
    wikiPhoto = await fetchWikipediaThumbnail(wikiFromBody || title)
  } catch {
    lookupFailures += 1
  }
  try {
    commonsPhoto = await fetchCommonsImage(title, placeHint)
  } catch {
    lookupFailures += 1
  }
  if (!wikiPhoto && !commonsPhoto && lookupFailures === 2 && !candidates.length) {
    throw new Error('Wikipedia and Commons lookups were rate limited')
  }
  if (wikiPhoto) candidates.push(wikiPhoto)
  if (commonsPhoto) candidates.push(commonsPhoto)
  candidates.sort((a, b) => topicPhotoScore(b, title, placeHint) - topicPhotoScore(a, title, placeHint))
  const best = candidates[0]
  const bestScore = best ? topicPhotoScore(best, title, placeHint) : -1
  if (!best?.image_url || bestScore < 8) {
    return { slug: story.slug, title, status: 'none', reason: 'no runtime photo scored high enough' }
  }
  return {
    slug: story.slug,
    title,
    status: 'candidate',
    kind: best.kind,
    bestScore,
    photo: best,
    placeHint,
  }
}

async function judge(row) {
  const photo = row.photo
  if (row.kind === 'historypin' || row.kind === 'historic' || /historypin\.org/i.test(photo?.source_url || photo?.image_url || '')) {
    return {
      ...row,
      status: 'skipped',
      reason: 'Historypin (license not a public-domain or CC BY / CC BY-SA / CC0 grant)',
      source: photo?.source_url || photo?.image_url || '',
      license: 'unclear (Historypin)',
    }
  }
  if (photo.localWiki || /\/wikipedia\/en\//.test(photo.image_url || '')) {
    return {
      ...row,
      status: 'skipped',
      reason: 'Wikipedia local file (typically fair use, not a free license)',
      source: photo.source_url || photo.image_url,
      license: 'non-free (Wikipedia local file)',
    }
  }
  let meta = photo.meta || null
  let info = null
  if (photo.commonsFile && !meta) {
    info = await imageInfo(photo.commonsFile)
    meta = info?.extmetadata || null
  } else if (photo.commonsFile && photo.kind === 'wikipedia') {
    info = await imageInfo(photo.commonsFile)
    meta = info?.extmetadata || meta
  }
  if (!meta) {
    return {
      ...row,
      status: 'skipped',
      reason: 'could not read a Commons license for the runtime image',
      source: photo.source_url || photo.image_url,
      license: 'unclear',
    }
  }
  const decision = licenseDecision(meta)
  const fileName = photo.commonsFile || String(info?.fileTitle || '').replace(/^File:/, '')
  const source = info?.descriptionurl || photo.source_url || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`
  if (!decision.ok) {
    return {
      ...row,
      status: 'skipped',
      reason: decision.reason,
      source,
      license: decision.license || 'unclear',
      license_url: decision.license_url || '',
    }
  }
  const author = cleanAuthor(meta)
  const stored = storedPhoto({
    caption: captionFrom(meta, fileName),
    sourceUrl: source,
    author,
    license: decision.license,
    licenseUrl: decision.license_url,
    year: yearFrom(meta),
  })
  return {
    ...row,
    status: 'allowed',
    reason: '',
    source,
    license: decision.license,
    license_url: decision.license_url,
    author,
    stored,
    downloadUrl: info?.thumburl || photo.thumburl || photo.image_url,
    fileName,
  }
}

async function downloadJpeg(url, dest) {
  let lastErr = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt) await sleep(700 * attempt)
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`${res.status}`)
      continue
    }
    if (!res.ok) throw new Error(`download ${res.status} ${url}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const jpeg = await sharp(buf, { limitInputPixels: 80_000_000, pages: 1 })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    const meta = await sharp(jpeg).metadata()
    if ((meta.width || 0) > MAX_WIDTH) throw new Error(`still wider than ${MAX_WIDTH}`)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, jpeg)
    return { bytes: jpeg.length, width: meta.width || 0, height: meta.height || 0 }
  }
  throw lastErr || new Error('download failed')
}

function variantBytes(entry) {
  let n = 0
  for (const list of [entry?.avif || [], entry?.webp || []]) {
    for (const v of list) {
      const file = path.join(ROOT, 'public', String(v.src || '').replace(/^\//, ''))
      if (fs.existsSync(file)) n += fs.statSync(file).size
    }
  }
  return n
}

async function applyAllowed(rows) {
  const manifestPath = path.join(ROOT, 'public/content/photos/responsive.json')
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : { generatedAt: new Date().toISOString(), maxBytes: 204800, images: {} }
  let added = 0
  for (const row of rows) {
    if (row.status !== 'allowed') continue
    const rel = `/content/photos/stories/${row.slug}.jpg`
    const abs = path.join(ROOT, 'public', rel.replace(/^\//, ''))
    try {
      const saved = await downloadJpeg(row.downloadUrl, abs)
      const photo = { ...row.stored, image_url: rel }
      const storyPath = path.join(ROOT, 'public/content/stories', `${row.slug}.json`)
      const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'))
      const before = story.bodyMarkdown
      story.photo = photo
      if (story.bodyMarkdown !== before) throw new Error('body changed')
      fs.writeFileSync(storyPath, `${JSON.stringify(story, null, 2)}\n`)
      const entry = await optimizePhoto(rel, manifest.images?.[rel])
      if (entry) manifest.images[rel] = entry
      const bytes = saved.bytes + variantBytes(entry)
      row.bytes = bytes
      row.jpegBytes = saved.bytes
      row.width = saved.width
      row.height = saved.height
      row.image_url = rel
      row.attribution = photo.attribution
      added += bytes
      console.log(`saved ${row.slug} ${saved.width}x${saved.height} ${(bytes / 1024).toFixed(0)}KB ${row.license}`)
    } catch (err) {
      row.status = 'skipped'
      row.reason = `download failed: ${err.message}`
      console.warn(`skip ${row.slug}: ${err.message}`)
    }
  }
  manifest.generatedAt = new Date().toISOString()
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return added
}

async function main() {
  const index = readJson('public/content/stories.json')
  const locations = readJson('public/content/stories-locations.json').locations || {}
  const historicPhotos = readJson('public/data/historic-photos.json')
  const siteLinks = readJson('public/data/site-historic-photos.json')
  const pending = []
  for (const row of index.stories) {
    const story = readJson(`public/content/stories/${row.slug}.json`)
    const url = story.photo?.image_url || ''
    if (url.startsWith('/content/photos/')) continue
    pending.push(story)
  }
  console.log(`resolving ${pending.length} stories without a stored photo`)
  const resolved = await mapPool(pending, 2, async (story, i) => {
    if (i % 10 === 0) console.log(`  ${i + 1}/${pending.length} ${story.slug}`)
    try {
      return await resolveOne(story, locations[story.slug] || {}, historicPhotos, siteLinks)
    } catch (err) {
      return { slug: story.slug, title: story.title, status: 'skipped', reason: `lookup failed: ${err.message}`, license: 'unclear', source: '' }
    }
  })
  const judged = []
  for (const row of resolved) {
    if (row.status !== 'candidate') {
      judged.push(row)
      continue
    }
    try {
      judged.push(await judge(row))
    } catch (err) {
      judged.push({ ...row, status: 'skipped', reason: `license lookup failed: ${err.message}`, license: 'unclear', source: row.photo?.source_url || '' })
    }
  }
  let added = 0
  if (APPLY) added = await applyAllowed(judged)
  const allowed = judged.filter((r) => r.status === 'allowed')
  const skipped = judged.filter((r) => r.status === 'skipped')
  const none = judged.filter((r) => r.status === 'none')
  const summary = {
    pending: pending.length,
    allowed: allowed.length,
    skipped: skipped.length,
    none: none.length,
    addedBytes: added,
    rows: judged.map((r) => ({
      slug: r.slug,
      title: r.title,
      status: r.status,
      kind: r.kind || '',
      source: r.source || r.photo?.source_url || '',
      license: r.license || '',
      license_url: r.license_url || r.stored?.license_url || '',
      author: r.author || r.stored?.credit || '',
      attribution: r.attribution || r.stored?.attribution || '',
      reason: r.reason || '',
      bytes: r.bytes || 0,
      width: r.width || 0,
      height: r.height || 0,
      image_url: r.image_url || '',
    })),
  }
  fs.writeFileSync(REPORT, JSON.stringify(summary, null, 2))
  console.log(`allowed ${allowed.length}, skipped ${skipped.length}, no runtime photo ${none.length}, added ${(added / 1024 / 1024).toFixed(2)} MB`)
  console.log(`report ${REPORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
