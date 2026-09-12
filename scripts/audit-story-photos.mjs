#!/usr/bin/env node
/**
 * Audit story sidebar photos for relevance.
 * Mirrors photosForPlace (2500m) + topicPhotoScore logic from src/main.js
 * and flags geocode mismatches for person biographies.
 *
 * Usage: node scripts/audit-story-photos.mjs [--commons]
 *   --commons  optionally hit Wikimedia Commons (rate-limited); off by default
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const WITH_COMMONS = process.argv.includes('--commons')

const storiesPath = join(ROOT, 'public/content/stories.json')
const photosPath = join(ROOT, 'public/data/historic-photos.json')
const locationsPath = join(ROOT, 'public/content/stories-locations.json')
const outDir = join(ROOT, 'tmp')
const outJson = join(outDir, 'story-photo-audit.json')
const outMd = join(outDir, 'story-photo-audit.md')

const STOP = new Set([
  'the', 'and', 'for', 'from', 'with', 'near', 'county', 'kentucky', 'ky',
  'his', 'her', 'its', 'who', 'was', 'were', 'that', 'this', 'into', 'onto',
  'after', 'before', 'above', 'below', 'about', 'over', 'under', 'than',
  'first', 'early', 'takes', 'shape', 'founding', 'site', 'town',
])

const CITY_PLACE_PHOTO_RE =
  /\b(street|avenue|boulevard|road|church|school|tavern|hotel|building|louisville|lexington|frankfort|covington|paducah|owensboro)\b/i

const PERSON_TITLE_RE =
  /^(col\.|capt\.|gen\.|dr\.|rev\.|sir\.?)\s|^[A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z'-]+)+(?:,|\s+[–—-]|\s+of\s|\s+builds\s|\s+on\s|\b)/

const PERSON_ROLE_RE =
  /\b(hunter|pioneer|settler|chief|captain|colonel|general|governor|senator|explorer|surveyor|trader|soldier|leader|long.?hunter|boone|clark|filson|shelby|logan|floyd|patterson|eston|lincoln|gist|walker|henderson|callaway|mcgary|ballard|christian|estill|strode|crow|beam|spears|hayden|carpenter|skaggs|stoner)\b/i

const LANDMARK_ONLY_RE =
  /\b(mound|mounds|village|enclosure|fort|lick|gap|creek|river|spring|station|square|battlefield|shell|mississippian|adena|archaic|paleo|claims|grounds|industry|whiskey|bourbon|trail|recipes|kentucke|constitution)\b/i

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

function tokensFrom(...parts) {
  return String(parts.filter(Boolean).join(' '))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
}

function unique(arr) {
  return [...new Set(arr)]
}

function topicOverlap(storyTokens, photo) {
  const hay = [
    photo.title,
    photo.credit,
    photo.collection,
    photo.source,
    photo.description,
    ...(photo.tags || []),
    ...(photo.related_place_names || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const hits = storyTokens.filter((t) => hay.includes(t))
  // Mirror topicPhotoScore: +12 per title-token hit (we score against full story tokens)
  const score = hits.length * 12
  return { hits, score, haySnippet: hay.slice(0, 160) }
}

function isPersonStory(story) {
  const title = story.title || ''
  const tags = (story.tags || []).join(' ')
  if (PERSON_ROLE_RE.test(title) || PERSON_ROLE_RE.test(tags)) return true
  // "First Last" biographies without landmark-heavy titles
  const looksNamed = /^[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z'-]+/.test(title)
  if (looksNamed && !LANDMARK_ONLY_RE.test(title)) return true
  if (PERSON_TITLE_RE.test(title) && !/\b(mound|village|enclosure|site)\b/i.test(title)) return true
  return false
}

function photosForPlace(photos, { lat, lon, name }) {
  if (lat == null || lon == null) return []
  const nearby = []
  const seen = new Set()
  for (const ph of photos) {
    if (ph.latitude == null || ph.longitude == null || !ph.image_url) continue
    const d = haversineM(lat, lon, ph.latitude, ph.longitude)
    let include = d <= 2500
    const related = (ph.related_place_names || []).join(' ').toLowerCase()
    if (name && related.includes(String(name).toLowerCase().slice(0, 12))) {
      include = true
    }
    if (!include) continue
    const id = ph.id || ph.image_url
    if (seen.has(id)) continue
    seen.add(id)
    nearby.push({ ...ph, distance_m: Math.round(d), photo_id: ph.id })
  }
  nearby.sort((a, b) => (a.distance_m || 0) - (b.distance_m || 0))
  return nearby.slice(0, 6)
}

/** Same base boost resolveStorySidebarPhoto gives local photos before topicPhotoScore. */
function localCandidateScore(overlapScore) {
  return 30 + overlapScore
}

function geocodeIssue(story, locMeta) {
  const issues = []
  const person = isPersonStory(story)
  const conf = story.mapConfidence || locMeta?.mapConfidence
  const matched = story.matchedPlace || locMeta?.matchedPlace || ''
  const title = story.title || ''
  const slug = story.slug || ''

  // Explicit known bug
  if (slug === 'michael-stoner-german-long-hunter') {
    issues.push({
      severity: 'high',
      kind: 'wrong_fuzzy_geocode',
      detail:
        'Person biography (German long hunter / Boone companion) fuzzy-matched to Falls of the Ohio (Louisville lat/lon). Nearby ULPA/Louisville street photos are unrelated to Stoner.',
    })
  }

  if (slug === 'col-robert-patterson-builds-lexington' && /filson/i.test(matched)) {
    issues.push({
      severity: 'high',
      kind: 'wrong_fuzzy_geocode',
      detail: `Patterson/Lexington story matched to "${matched}" near Louisville — wrong place; pulls Louisville historic photos.`,
    })
  }

  if (slug === 'col-richard-callaway-of-boonesborough' && /calloway/i.test(matched)) {
    issues.push({
      severity: 'high',
      kind: 'wrong_county_geocode',
      detail: `Callaway of Boonesborough matched to "${matched}" (name collision with Calloway County, far from Madison County / Boonesborough).`,
    })
  }

  if (slug === 'chickasaw-hunting-grounds' && /shelby/i.test(matched)) {
    issues.push({
      severity: 'medium',
      kind: 'wrong_fuzzy_geocode',
      detail: `Chickasaw hunting grounds matched to "${matched}" — likely Isaac Shelby name collision, not Chickasaw geography.`,
    })
  }

  if (person && (conf === 'fuzzy' || conf === 'county')) {
    // Matched place shares little with person name tokens
    const nameToks = tokensFrom(title).filter((t) => !PERSON_ROLE_RE.test(t))
    const placeToks = tokensFrom(matched)
    const overlap = nameToks.filter((t) => placeToks.some((p) => p.includes(t) || t.includes(p)))
    const placeLooksCityOnly =
      /\b(falls of the ohio|jefferson county|louisville|lexington|filson)\b/i.test(matched) &&
      !new RegExp(nameToks.slice(0, 2).join('|'), 'i').test(matched)

    if (overlap.length === 0 && placeLooksCityOnly) {
      issues.push({
        severity: 'high',
        kind: 'person_fuzzy_place_mismatch',
        detail: `Person story geocoded (${conf}) to "${matched}" with no name overlap — sidebar may inherit unrelated place photos.`,
      })
    } else if (conf === 'county' && person && !new RegExp(nameToks[0] || '___', 'i').test(matched)) {
      // Soft flag for county-centroid person bios
      issues.push({
        severity: 'low',
        kind: 'person_county_centroid',
        detail: `Person story on county centroid "${matched}" — OK if no nearby historic photos, but imprecise.`,
      })
    }
  }

  // Title place vs matched place mismatch for non-persons
  if (!person && conf === 'fuzzy') {
    const titlePlace = tokensFrom(title)
    const matchedToks = tokensFrom(matched)
    const hit = titlePlace.filter((t) => matchedToks.includes(t))
    if (hit.length === 0 && matched && title) {
      issues.push({
        severity: 'medium',
        kind: 'fuzzy_title_place_mismatch',
        detail: `Fuzzy match "${matched}" shares no tokens with title "${title}".`,
      })
    }
  }

  return issues
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function tryCommonsBrief(title, placeHint) {
  const q = `${title} Kentucky`
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: q,
    gsrlimit: '5',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '640',
    format: 'json',
    origin: '*',
  })
  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { 'User-Agent': 'kyhistorydrive-photo-audit/1.0 (local audit)' },
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    const pages = Object.values(data?.query?.pages || {})
    const topicTokens = tokensFrom(title)
    const scored = []
    for (const page of pages) {
      const info = page.imageinfo?.[0]
      if (!info) continue
      const mime = info.mime || ''
      if (!/^image\//.test(mime) || /svg\+xml|gif|tiff/i.test(mime)) continue
      const meta = info.extmetadata || {}
      const objectName =
        String(meta.ObjectName?.value || '')
          .replace(/<[^>]+>/g, '')
          .trim() || String(page.title || '').replace(/^File:/, '')
      const blob = `${objectName} ${page.title}`.toLowerCase()
      let score = 0
      const hits = []
      for (const tok of topicTokens) {
        if (blob.includes(tok)) {
          hits.push(tok)
          score += 14
        }
      }
      if (hits.length === 0 && topicTokens.length) score -= 25
      scored.push({ title: objectName, score, hits })
    }
    scored.sort((a, b) => b.score - a.score)
    return { ok: true, top: scored[0] || null, count: scored.length }
  } catch (e) {
    return { ok: false, error: String(e.message || e) }
  }
}

function verdictFor(story, nearby, overlaps, geoIssues) {
  const person = isPersonStory(story)
  const bestOverlap = overlaps[0] || null
  const weak = !bestOverlap || bestOverlap.hits.length === 0
  const cityPhoto =
    bestOverlap && CITY_PLACE_PHOTO_RE.test(bestOverlap.photoTitle || '')
  const highGeo = geoIssues.some((g) => g.severity === 'high')

  if (!nearby.length) {
    if (highGeo) {
      return {
        verdict: 'BAD_GEOCODE',
        reason: 'No nearby historic photos, but geocode looks wrong for this story.',
        wouldShowLocal: false,
      }
    }
    return {
      verdict: 'NO_LOCAL_PHOTO',
      reason: 'No historic-photos.json hits within 2500m (Wikipedia/Commons may still fill sidebar).',
      wouldShowLocal: false,
    }
  }

  // resolveStorySidebarPhoto prefers local[0] with base score 30; weak topic often still wins
  const localWinsLikely = localCandidateScore(bestOverlap?.score || 0) >= 30
  if (weak || (person && cityPhoto) || highGeo) {
    const bits = []
    if (person && cityPhoto) bits.push('person biography would get city/street historic photo')
    if (weak) bits.push('weak/no topic token overlap with photo title/credit/collection')
    if (highGeo) bits.push('suspicious geocode')
    return {
      verdict: 'BAD',
      reason: bits.join('; '),
      wouldShowLocal: localWinsLikely,
      suggestedFix: person
        ? 'Suppress lat/lon local photos for person bios (require topic overlap ≥1 meaningful token or historyId site link); fix geocode away from Louisville/Falls unless story is about that place.'
        : 'Require topic overlap before accepting nearby photos; or tighten geocode / raise distance+relevance gate.',
    }
  }

  // Place story with some overlap
  if (bestOverlap.hits.length >= 1) {
    return {
      verdict: 'OK',
      reason: `Nearby photo has topic hits: ${bestOverlap.hits.join(', ')}`,
      wouldShowLocal: true,
      suggestedFix: null,
    }
  }

  return {
    verdict: 'WEAK',
    reason: 'Nearby photos exist but relevance is marginal.',
    wouldShowLocal: true,
    suggestedFix: 'Prefer Wikipedia/Commons when local topic score is low.',
  }
}

function main() {
  const storiesDoc = JSON.parse(readFileSync(storiesPath, 'utf8'))
  const photos = JSON.parse(readFileSync(photosPath, 'utf8'))
  const locDoc = JSON.parse(readFileSync(locationsPath, 'utf8'))
  const stories = storiesDoc.stories || []
  const locations = locDoc.locations || {}

  const results = []
  for (const story of stories) {
    const loc = locations[story.slug] || {}
    const lat = story.lat ?? loc.lat
    const lon = story.lon ?? loc.lon
    const matchedPlace = story.matchedPlace || loc.matchedPlace || null
    const mapConfidence = story.mapConfidence || loc.mapConfidence || null
    const person = isPersonStory(story)
    const storyTokens = unique([...tokensFrom(story.title), ...tokensFrom(...(story.tags || []))])

    const nearby = photosForPlace(photos, {
      lat,
      lon,
      name: story.title,
    })

    const overlaps = nearby.map((ph) => {
      const ov = topicOverlap(storyTokens, ph)
      return {
        photoId: ph.photo_id || ph.id,
        photoTitle: ph.title,
        collection: ph.collection || null,
        credit: ph.source || null,
        city: ph.city || null,
        distance_m: ph.distance_m,
        hits: ov.hits,
        overlapScore: ov.score,
        localCandidateScore: localCandidateScore(ov.score),
      }
    })
    overlaps.sort((a, b) => b.overlapScore - a.overlapScore || a.distance_m - b.distance_m)

    const geoIssues = geocodeIssue(story, loc)
    const v = verdictFor(story, nearby, overlaps, geoIssues)

    results.push({
      slug: story.slug,
      title: story.title,
      era: story.era,
      tags: story.tags || [],
      isPersonBiography: person,
      matchedPlace,
      mapConfidence,
      lat,
      lon,
      historyId: loc.historyId || null,
      nearbyPhotoCount: nearby.length,
      nearbyPhotos: overlaps,
      geocodeIssues: geoIssues,
      verdict: v.verdict,
      reason: v.reason,
      wouldShowLocal: v.wouldShowLocal,
      suggestedFix: v.suggestedFix || null,
      commons: null,
    })
  }

  return { storiesDoc, photos, results }
}

async function maybeCommons(results) {
  if (!WITH_COMMONS) return
  // Only probe BAD / person stories with nearby photos — polite rate limit
  const targets = results.filter(
    (r) => r.verdict === 'BAD' || (r.isPersonBiography && r.nearbyPhotoCount > 0),
  )
  for (const r of targets) {
    r.commons = await tryCommonsBrief(r.title, r.matchedPlace)
    await sleep(350)
  }
}

function summarize(results, photos) {
  const counts = {
    total: results.length,
    BAD: 0,
    BAD_GEOCODE: 0,
    WEAK: 0,
    OK: 0,
    NO_LOCAL_PHOTO: 0,
  }
  for (const r of results) counts[r.verdict] = (counts[r.verdict] || 0) + 1

  const needsFix = results.filter((r) =>
    ['BAD', 'BAD_GEOCODE', 'WEAK'].includes(r.verdict),
  )
  // Rank offenders: BAD with wouldShowLocal first, then BAD_GEOCODE, then by nearby count
  const severity = (r) => {
    let s = 0
    if (r.verdict === 'BAD' && r.wouldShowLocal) s += 100
    else if (r.verdict === 'BAD') s += 80
    else if (r.verdict === 'BAD_GEOCODE') s += 60
    else if (r.verdict === 'WEAK') s += 40
    if (r.isPersonBiography) s += 15
    s += Math.min(r.nearbyPhotoCount, 6) * 5
    if (r.geocodeIssues.some((g) => g.severity === 'high')) s += 20
    if (r.slug === 'michael-stoner-german-long-hunter') s += 50
    return s
  }
  const worst = [...needsFix].sort((a, b) => severity(b) - severity(a))

  return { counts, needsFix, worst, severity }
}

function writeReports(payload) {
  const { results, photos, counts, worst, needsFix } = payload
  mkdirSync(outDir, { recursive: true })

  const report = {
    generatedAt: new Date().toISOString(),
    historicPhotoCount: photos.length,
    historicPhotoCities: unique(photos.map((p) => p.city).filter(Boolean)),
    radius_m: 2500,
    commonsQueried: WITH_COMMONS,
    counts: {
      total: counts.total,
      bad: (counts.BAD || 0) + (counts.BAD_GEOCODE || 0),
      bad_local_photo: counts.BAD || 0,
      bad_geocode_only: counts.BAD_GEOCODE || 0,
      weak: counts.WEAK || 0,
      ok: counts.OK || 0,
      no_photo: counts.NO_LOCAL_PHOTO || 0,
    },
    notes: [
      'All entries in historic-photos.json are currently Louisville / Lost Louisville (ULPA/Historypin).',
      'resolveStorySidebarPhoto boosts the nearest local photo with base score 30 before topicPhotoScore, so weak-overlap Louisville photos often win the sidebar.',
      'Michael Stoner is the canonical bug: German long hunter fuzzy-geocoded to Falls of the Ohio → Louisville street photo.',
    ],
    storiesNeedingFix: needsFix.map((r) => r.slug),
    topOffenders: worst.slice(0, 15).map((r) => ({
      slug: r.slug,
      title: r.title,
      verdict: r.verdict,
      matchedPlace: r.matchedPlace,
      nearby: r.nearbyPhotos.map((p) => p.photoTitle),
      reason: r.reason,
    })),
    stories: results,
  }
  writeFileSync(outJson, JSON.stringify(report, null, 2))

  const lines = []
  lines.push('# Story sidebar photo audit')
  lines.push('')
  lines.push(`Generated: ${report.generatedAt}`)
  lines.push('')
  lines.push('## Counts')
  lines.push('')
  lines.push(`- **Total stories:** ${report.counts.total}`)
  lines.push(`- **BAD (local photo mismatch):** ${report.counts.bad_local_photo}`)
  lines.push(`- **BAD geocode (no local photo but wrong place):** ${report.counts.bad_geocode_only}`)
  lines.push(`- **Weak:** ${report.counts.weak}`)
  lines.push(`- **OK (relevant local photo):** ${report.counts.ok}`)
  lines.push(`- **No local photo:** ${report.counts.no_photo}`)
  lines.push(`- **Historic photos in dataset:** ${photos.length} (cities: ${report.historicPhotoCities.join(', ') || 'n/a'})`)
  lines.push('')
  lines.push('## Bug spotlight: Michael Stoner')
  lines.push('')
  const stoner = results.find((r) => r.slug === 'michael-stoner-german-long-hunter')
  if (stoner) {
    lines.push(
      `- **${stoner.title}** (\`${stoner.slug}\`) geocoded **fuzzy** to **${stoner.matchedPlace}** (${stoner.lat}, ${stoner.lon}).`,
    )
    lines.push(
      `- Nearby within 2500m: ${stoner.nearbyPhotos.map((p) => `"${p.photoTitle}" (${p.distance_m}m)`).join('; ') || 'none'}`,
    )
    lines.push(`- Topic hits: ${stoner.nearbyPhotos.map((p) => (p.hits.length ? p.hits.join(',') : 'none')).join('; ')}`)
    lines.push(`- Verdict: **${stoner.verdict}** — ${stoner.reason}`)
    lines.push(`- Suggested fix: ${stoner.suggestedFix}`)
  }
  lines.push('')
  lines.push('## Stories needing photo suppression or geocode fixes')
  lines.push('')
  for (const r of worst) {
    lines.push(`### ${r.title}`)
    lines.push('')
    lines.push(`- **slug:** \`${r.slug}\``)
    lines.push(`- **matchedPlace:** ${r.matchedPlace || '—'} (${r.mapConfidence || '—'})`)
    lines.push(`- **lat/lon:** ${r.lat ?? 'null'}, ${r.lon ?? 'null'}`)
    lines.push(`- **person bio:** ${r.isPersonBiography ? 'yes' : 'no'}`)
    lines.push(
      `- **nearby photos:** ${
        r.nearbyPhotos.length
          ? r.nearbyPhotos
              .map(
                (p) =>
                  `"${p.photoTitle}" (${p.distance_m}m, hits=[${p.hits.join(', ') || '—'}], localScore=${p.localCandidateScore})`,
              )
              .join('; ')
          : 'none'
      }`,
    )
    lines.push(`- **verdict:** ${r.verdict}`)
    lines.push(`- **reason:** ${r.reason}`)
    if (r.geocodeIssues.length) {
      lines.push(
        `- **geocode issues:** ${r.geocodeIssues.map((g) => `[${g.severity}] ${g.kind}: ${g.detail}`).join(' | ')}`,
      )
    }
    if (r.suggestedFix) lines.push(`- **suggested fix:** ${r.suggestedFix}`)
    lines.push('')
  }

  lines.push('## Top 15 worst offenders')
  lines.push('')
  worst.slice(0, 15).forEach((r, i) => {
    lines.push(
      `${i + 1}. \`${r.slug}\` — ${r.verdict} — ${r.matchedPlace || 'no place'} — nearby: ${
        r.nearbyPhotos.map((p) => p.photoTitle).join('; ') || 'none'
      }`,
    )
  })
  lines.push('')
  lines.push('## All stories (compact)')
  lines.push('')
  lines.push('| slug | verdict | matchedPlace | nearby |')
  lines.push('|---|---|---|---|')
  for (const r of results) {
    const near =
      r.nearbyPhotos
        .slice(0, 2)
        .map((p) => p.photoTitle.replace(/\|/g, '/'))
        .join('; ') || '—'
    lines.push(
      `| \`${r.slug}\` | ${r.verdict} | ${(r.matchedPlace || '—').replace(/\|/g, '/')} | ${near} |`,
    )
  }
  lines.push('')

  writeFileSync(outMd, lines.join('\n'))
  return report
}

const { photos, results } = main()
await maybeCommons(results)
const { counts, worst, needsFix } = summarize(results, photos)
const report = writeReports({ results, photos, counts, worst, needsFix })

console.log(
  JSON.stringify(
    {
      outJson,
      outMd,
      counts: report.counts,
      top15: report.topOffenders,
    },
    null,
    2,
  ),
)
