import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadMapFrame } from '../build-history-map-card.mjs'
import {
  escapeHtml,
  isExternalStoryUrl,
  markdownWithoutGlanceSection,
  renderStoryHtml,
  safeStoryUrl,
} from '../../src/story-markdown.js'
import { isProtectedStoryRule } from '../../src/protected-story-rule.js'
import { loadMerges } from './story-merges.mjs'
import {
  compactYearRange,
  countyLong,
  learnMoreItemsFromMarkdown,
  learnMoreLinkText,
  markerMapHref,
  sourceNameForUrl,
} from '../../src/story-tools.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const ERA_LABELS = {
  prehistoric: 'Prehistoric',
  native: 'Native nations',
  frontier: 'Frontier',
  revolution: 'Frontier',
  'early-commonwealth': 'Early commonwealth',
  other: 'More Kentucky history',
  modern: 'More Kentucky history',
}

export function storyEraLabel(era) {
  return ERA_LABELS[String(era || '').trim()] || 'More Kentucky history'
}

let cachedProtectedSlugs = null
let cachedSkipProtectedSlugs = null
function getProtectedSlugSet() {
  if (cachedProtectedSlugs) return cachedProtectedSlugs
  cachedProtectedSlugs = new Set()
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/web/protected-pins.json"), "utf8"))
    for (const s of raw.ids || raw.stories || []) cachedProtectedSlugs.add(String(s))
    for (const h of raw.historyIds || []) cachedProtectedSlugs.add(String(h))
  } catch (_) {}
  try {
    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/pin-rounding.json"), "utf8"))
    for (const s of rules.forceSlugs || []) cachedProtectedSlugs.add(String(s))
  } catch (_) {}
  try {
    const ov = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/story-overrides.json"), "utf8"))
    for (const [slug, entry] of Object.entries(ov.overrides || {})) {
      if (/looting-sensitive|coarsened to 0\.1|generalized to 0\.1/i.test(String(entry?.reason || ""))) {
        cachedProtectedSlugs.add(String(slug))
        if (entry?.historyId) cachedProtectedSlugs.add(String(entry.historyId))
      }
    }
  } catch (_) {}
  return cachedProtectedSlugs
}

function getSkipProtectedSlugSet() {
  if (cachedSkipProtectedSlugs) return cachedSkipProtectedSlugs
  cachedSkipProtectedSlugs = new Set()
  try {
    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/pin-rounding.json"), "utf8"))
    for (const s of rules.skipSlugs || []) cachedSkipProtectedSlugs.add(String(s))
    for (const h of rules.skipHistoryIds || []) cachedSkipProtectedSlugs.add(String(h))
  } catch (_) {}
  return cachedSkipProtectedSlugs
}

/** Protected and skip id sets for the shared rule; a merge carries protection across both slugs. */
export function protectedIdSets() {
  const protectedIds = new Set(getProtectedSlugSet())
  for (const { retired, kept } of loadMerges(ROOT)) {
    if (protectedIds.has(retired) || protectedIds.has(kept)) {
      protectedIds.add(retired)
      protectedIds.add(kept)
    }
  }
  return { protectedIds, skipIds: getSkipProtectedSlugSet() }
}

let cachedIdSets = null
export function isProtectedStory(story) {
  cachedIdSets ||= protectedIdSets()
  return isProtectedStoryRule(story, cachedIdSets)
}

export function roundStoryCoord(value, protectedStory = false) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const decimals = protectedStory ? 1 : 4
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

export function roundedStoryGeo(story) {
  const protectedStory = isProtectedStory(story)
  const lat = roundStoryCoord(story?.lat, protectedStory)
  const lon = roundStoryCoord(story?.lon, protectedStory)
  if (lat == null || lon == null) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  if (lat === 0 && lon === 0) return null
  return {
    lat,
    lon,
    decimals: protectedStory ? 1 : 4,
    protectedStory,
  }
}

export function formatCoordCardinal(lat, lon, decimals = 4) {
  const la = Number(lat)
  const lo = Number(lon)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return ''
  const ns = la >= 0 ? 'N' : 'S'
  const ew = lo <= 0 ? 'W' : 'E'
  return `${Math.abs(la).toFixed(decimals)}° ${ns}, ${Math.abs(lo).toFixed(decimals)}° ${ew}`
}

export function storyDocTitle(story) {
  const base = String(story?.seoTitle || story?.title || "").trim()
  if (!base) return "Kentucky History Drive"
  const suffixed = `${base} · Kentucky History Drive`
  return suffixed.length <= 60 ? suffixed : base
}

export function matchStoryMarkers(story, markers = [], notes = null, route = null) {
  if (!Array.isArray(markers) || !markers.length) return []
  const byId = new Map()
  const byUrl = new Map()
  for (const m of markers) {
    if (!m?.id) continue
    byId.set(String(m.id), m)
    if (m.source_url) {
      byUrl.set(String(m.source_url).toLowerCase().replace(/\/$/, ''), m)
    }
  }
  const found = []
  const addId = (rawId) => {
    const k = String(rawId || '').trim()
    if (byId.has(k) && !found.some((item) => item.id === k)) {
      found.push(byId.get(k))
    }
  }
  if (Array.isArray(route?.markers)) {
    for (const rm of route.markers) addId(rm?.number ?? rm?.id ?? rm)
  }
  const primaryBlobs = [
    String(story?.bodyMarkdown || ""),
    String(story?.summary || ""),
    JSON.stringify(story?.glance || {}),
    JSON.stringify(notes || {}),
    String(route?.sources || ""),
  ].join("\n")
  for (const match of primaryBlobs.matchAll(/(?:marker(?:s|\s+number)?\s*#?|khs-|\/#map\/markers\/)(\d{1,4})\b/gi)) {
    addId(match[1])
  }
  const notesAndRouteUrls = [JSON.stringify(notes || {}), String(route?.sources || "")].join("\n")
  for (const match of notesAndRouteUrls.matchAll(/https?:\/\/history\.ky\.gov\/markers\/[a-z0-9-]+/gi)) {
    const u = match[0].toLowerCase().replace(/\/$/, "")
    if (byUrl.has(u)) addId(byUrl.get(u).id)
  }
  if (!found.length) {
    for (const match of String(story?.bodyMarkdown || "").matchAll(/https?:\/\/history\.ky\.gov\/markers\/[a-z0-9-]+/gi)) {
      const u = match[0].toLowerCase().replace(/\/$/, "")
      if (byUrl.has(u)) addId(byUrl.get(u).id)
    }
  }
  return found
}

export function storyCountiesList(story, matchedMarkers = []) {
  const seen = new Set()
  const out = []
  const add = (raw) => {
    const c = String(raw || '')
      .trim()
      .replace(/\s+County$/i, '')
    if (!c) return
    const display = c === 'Larue' ? 'LaRue' : c
    const key = display.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(display)
  }
  if (story?.county) add(story.county)
  if (Array.isArray(story?.counties)) {
    for (const c of story.counties) add(c)
  }
  for (const m of matchedMarkers || []) {
    if (m?.county) add(m.county)
  }
  return out
}

export function countySlugFromName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+County$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function formatCountiesBadge(counties = []) {
  const list = (counties || []).filter(Boolean)
  if (!list.length) return ''
  if (list.length === 1) return countyLong(list[0])
  if (list.length === 2) return `${list[0]} & ${list[1]} Counties`
  return `${list[0]}, ${list[1]} +${list.length - 2} counties`
}

export function splitStoryMarkdown(bodyMarkdown, hasGlance = false) {
  let text = markdownWithoutGlanceSection(String(bodyMarkdown || ''), hasGlance)
  // Remove standalone Source: lines (already collected into Unified Sources)
  text = text.replace(/^[ \t]*source:[ \t]*.+$/gim, '')
  // Remove standalone link to /research/<slug>/ (folded into #sources on the unified page)
  text = text.replace(/^[ \t]*\[Research notes and sources for [^\]]+\]\(\/research\/[^)]+\)[ \t]*$/gim, '')

  let kentuckyTodayMarkdown = ''
  const ktRegex = /(?:^|\n)##[ \t]+Kentucky today[ \t]*\n([\s\S]*?)(?=\n##[ \t]+|$)/i
  const ktMatch = text.match(ktRegex)
  if (ktMatch) {
    kentuckyTodayMarkdown = ktMatch[1].trim()
    text = text.replace(ktRegex, '\n')
  }

  // Also strip markdown ## Sources section if battle-of-blue-licks has one so sources aren't duplicated
  let inlineSourcesMarkdown = ''
  const srcRegex = /(?:^|\n)##[ \t]+Sources[ \t]*\n([\s\S]*?)(?=\n##[ \t]+|$)/i
  const srcMatch = text.match(srcRegex)
  if (srcMatch) {
    inlineSourcesMarkdown = srcMatch[1].trim()
    text = text.replace(srcRegex, '\n')
  }

  return {
    mainMarkdown: text.replace(/\n{3,}/g, '\n\n').trim(),
    kentuckyTodayMarkdown,
    inlineSourcesMarkdown,
  }
}

let cachedFallbackPeople = null
function getFallbackPeopleData() {
  if (cachedFallbackPeople) return cachedFallbackPeople
  const byId = new Map()
  const sourceById = new Map()
  const byStory = new Map()
  let storySubjects = {}
  let storyPeopleMap = {}
  try {
    const pub = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/people.json"), "utf8"))
    storySubjects = pub.storySubjects || {}
    for (const p of pub.people || []) {
      if (!p?.id) continue
      byId.set(p.id, p)
      for (const s of p.stories || []) {
        if (!byStory.has(s)) byStory.set(s, [])
        byStory.get(s).push(p)
      }
    }
  } catch (_) {}
  try {
    const src = JSON.parse(fs.readFileSync(path.join(ROOT, "data/people.json"), "utf8"))
    for (const p of src.people || []) {
      if (p?.id) sourceById.set(p.id, p)
    }
  } catch (_) {}
  try {
    const sp = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/web/story-people.json"), "utf8"))
    storyPeopleMap = sp.stories || {}
  } catch (_) {}
  cachedFallbackPeople = { byId, sourceById, byStory, storySubjects, storyPeopleMap }
  return cachedFallbackPeople
}

export function resolvePeopleInStory(story, peopleData, notes = null, subject = null) {
  const fb = getFallbackPeopleData()
  const byId =
    peopleData?.byId instanceof Map
      ? peopleData.byId
      : peopleData?.peopleById instanceof Map
        ? peopleData.peopleById
        : fb.byId
  const peopleArray = Array.isArray(peopleData)
    ? peopleData
    : Array.isArray(peopleData?.people)
      ? peopleData.people
      : Array.isArray(peopleData?.people?.people)
        ? peopleData.people.people
        : [...fb.byId.values()]
  const sourcePeopleArray = Array.isArray(peopleData?.sourcePeople?.people)
    ? peopleData.sourcePeople.people
    : []
  const sourceById = new Map(fb.sourceById)
  for (const sp of sourcePeopleArray) {
    if (sp?.id) sourceById.set(sp.id, sp)
  }
  const storySubjects =
    peopleData?.storySubjects || peopleData?.people?.storySubjects || fb.storySubjects || {}
  const storyPeopleMap =
    peopleData?.storyPeople?.stories || fb.storyPeopleMap || {}
  const subjId = subject?.id || storySubjects?.[story?.slug] || storyPeopleMap?.[story?.slug]?.portraits?.[0] || ""
  const seen = new Set()
  const list = []

  const pushPerson = (p, roleOverride = "") => {
    if (!p?.id || seen.has(p.id)) return
    seen.add(p.id)
    const pubP = byId.get(p.id) || fb.byId.get(p.id) || {}
    const srcP = sourceById.get(p.id) || {}
    const datesVal = p.dates || p.years || pubP.dates || srcP.lifeDates || ""
    const roleVal = roleOverride || p.role || srcP.role || p.title || p.shortBio || ""
    const imageVal = p.image || pubP.image || srcP.image || null
    const wikidata = p.wikidata || pubP.wikidata || srcP.wikidata || ""
    const wikipedia = p.wikipedia || pubP.wikipedia || srcP.wikipedia || ""
    const grokipedia = p.grokipedia || pubP.grokipedia || srcP.grokipedia || ""
    const sameAs = Array.isArray(p.sameAs)
      ? p.sameAs
      : Array.isArray(pubP.sameAs)
        ? pubP.sameAs
        : Array.isArray(srcP.sameAs)
          ? srcP.sameAs
          : undefined
    list.push({
      id: p.id,
      name: p.name || pubP.name || srcP.name || p.id,
      dates: datesVal,
      years: datesVal,
      role: roleVal,
      image: imageVal,
      thumb: imageVal ? `/content/portraits/thumbs/${p.id}.webp` : "",
      credit: p.credit || pubP.credit || srcP.credit || "",
      ai: Boolean(p.ai ?? pubP.ai ?? srcP.ai),
      href: `/people/#${p.id}`,
      isSubject: Boolean((subject && p.id === subject.id) || (subjId && p.id === subjId)),
      ...(wikidata ? { wikidata } : {}),
      ...(wikipedia ? { wikipedia } : {}),
      ...(grokipedia ? { grokipedia } : {}),
      ...(sameAs ? { sameAs } : {}),
    })
  }

  if (subject?.id) {
    pushPerson(subject)
  }
    if (subjId && (byId.has(subjId) || fb.byId.has(subjId))) {
    pushPerson(byId.get(subjId) || fb.byId.get(subjId))
  }
  for (const p of peopleArray) {
    if (Array.isArray(p?.stories) && p.stories.includes(story?.slug)) {
      pushPerson(p)
    }
  }
  for (const p of fb.byStory.get(story?.slug) || []) {
    pushPerson(p)
  }
  const spEntry = storyPeopleMap?.[story?.slug]
  if (spEntry) {
    for (const pid of spEntry.portraits || []) {
      const p = byId.get(pid) || fb.byId.get(pid)
      if (p) pushPerson(p)
    }
    for (const lk of spEntry.links || []) {
      const pid = lk?.id
      const p = pid && (byId.get(pid) || fb.byId.get(pid))
      if (p) pushPerson(p)
    }
  }
  if (Array.isArray(notes?.people)) {
    for (const np of notes.people) {
      const pid = np?.peopleId || np?.id
      const p = pid && (byId.get(pid) || fb.byId.get(pid))
      if (p) {
        pushPerson(p, np.role || "")
      }
    }
  }
  const md = String(story?.bodyMarkdown || "")
  for (const match of md.matchAll(/\]\(\/people\/#([a-z0-9-]+)\)/g)) {
    const pid = match[1]
    const p = byId.get(pid) || fb.byId.get(pid)
    if (p) pushPerson(p)
  }

  return list
}

export function buildUnifiedSources(story, notes = null, matchedMarkers = []) {
  const items = []
  const byUrl = new Map()
  const byId = new Map()

  const addSource = ({ id = '', label = '', url = '', type = '', accessed = '' }) => {
    const safeUrl = url ? safeStoryUrl(url) : ''
    const normUrl = safeUrl ? safeUrl.toLowerCase().replace(/\/$/, '') : ''
    if (normUrl && byUrl.has(normUrl)) {
      const existing = byUrl.get(normUrl)
      if (id && !byId.has(id)) byId.set(id, existing)
      if (label && (!existing.label || existing.label.length < label.length)) {
        existing.label = label
        existing.title = label
      }
      return existing
    }
    const num = items.length + 1
    const cleanLabel = String(label || '').trim() || safeUrl || `Source ${num}`
    const cleanType = String(type || '').trim()
    const entry = {
      num,
      id: id || `src-${num}`,
      label: cleanLabel,
      title: cleanLabel,
      url: safeUrl,
      type: cleanType,
      typeLabel: cleanType,
      accessed: String(accessed || '').trim(),
    }
    items.push(entry)
    if (normUrl) byUrl.set(normUrl, entry)
    if (id) byId.set(id, entry)
    return entry
  }

  if (Array.isArray(notes?.sources)) {
    for (const s of notes.sources) {
      addSource({
        id: s.id || '',
        label: s.citation || s.title || '',
        url: s.url || '',
        type: s.type || '',
        accessed: s.accessed || '',
      })
    }
  }

  const mdLinks = learnMoreItemsFromMarkdown(story?.bodyMarkdown || '')
  for (const item of mdLinks) {
    const label = learnMoreLinkText(item.url, item.linkText || item.label || '', story?.title || '')
    addSource({
      label,
      url: item.url,
      type: 'web',
    })
  }

  for (const m of matchedMarkers || []) {
    if (m?.source_url) {
      addSource({
        id: `khs-${m.id}`,
        label: `Kentucky Historical Society Marker #${m.id}: "${m.title}"${m.county ? ` (${countyLong(m.county)})` : ''}`,
        url: m.source_url,
        type: 'marker',
      })
    }
  }

  return { items, byId, byUrl }
}

export function storyMapPins(story, matchedMarkers = []) {
  const geo = roundedStoryGeo(story)
  if (!geo) return []
  if (geo.protectedStory) {
    return [
      {
        num: 1,
        lat: geo.lat,
        lon: geo.lon,
        decimals: 1,
        protectedStory: true,
        label: story?.county ? `${countyLong(story.county)} (approximate area)` : 'Approximate area',
      },
    ]
  }
  const pins = []
  for (const m of matchedMarkers || []) {
    const lat = roundStoryCoord(m?.lat, false)
    const lon = roundStoryCoord(m?.lon, false)
    if (lat == null || lon == null) continue
    let town = ''
    if (m.location_text) {
      const mTown = String(m.location_text).match(/\b(?:at|in|near)\s+([A-Z][a-zA-Z .'-]+?)(?:,|\bKY\b|\bUS\b|$)/)
      if (mTown) town = mTown[1].trim()
    }
    const shortPlace = town || (m.county ? `${m.county} Co.` : m.title)
    pins.push({
      num: pins.length + 1,
      markerId: m.id,
      lat,
      lon,
      decimals: 4,
      protectedStory: false,
      label: `#${m.id} ${shortPlace}`,
      title: m.title,
      county: m.county || '',
    })
  }
  if (!pins.length) {
    pins.push({
      num: 1,
      lat: geo.lat,
      lon: geo.lon,
      decimals: 4,
      protectedStory: false,
      label: story?.matchedPlace || (story?.county ? countyLong(story.county) : story?.title || 'Story site'),
      title: story?.title || 'Story site',
      county: story?.county || '',
    })
  }
  return pins
}

let cachedMapAssets = null
function getMapAssets() {
  if (cachedMapAssets) return cachedMapAssets
  const { d: statePathD, frame, project } = loadMapFrame()
  const svgRaw = fs.readFileSync(path.join(ROOT, 'public/brand/ky-map-strip-counties.svg'), 'utf8')
  const countiesMatch = svgRaw.match(/class="hp-ky-counties" d="([^"]+)"/)
  const countiesPathD = countiesMatch ? countiesMatch[1] : ''
  const centroidsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/county-centroids.json'), 'utf8'))
  const countyLabels = []
  for (const [name, coords] of Object.entries(centroidsRaw)) {
    if (!Array.isArray(coords) || coords.length < 2) continue
    const [lon, lat] = coords
    const [mx, my] = project(lon, lat)
    const x = frame.xFit.scale * mx + frame.xFit.offset
    const y = frame.yFit.scale * my + frame.yFit.offset
    countyLabels.push({ name: name === 'Larue' ? 'LaRue' : name, x, y })
  }
  cachedMapAssets = { statePathD, countiesPathD, frame, project, countyLabels }
  return cachedMapAssets
}

function haversineMilesRounded(aGeo, bGeo) {
  if (!aGeo || !bGeo) return Infinity
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 3958.7613
  const dLat = toRad(bGeo.lat - aGeo.lat)
  const dLon = toRad(bGeo.lon - aGeo.lon)
  const lat1 = toRad(aGeo.lat)
  const lat2 = toRad(bGeo.lat)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function nearbyStories(story, all = [], { limit = 5, excludeSlugs = [] } = {}) {
  const origin = roundedStoryGeo(story)
  if (!origin) return []
  const excluded = new Set(excludeSlugs)
  return (all || [])
    .filter((other) => other && other.slug && other.slug !== story.slug && !excluded.has(other.slug))
    .map((other) => {
      const otherGeo = roundedStoryGeo(other)
      return otherGeo ? { story: other, miles: haversineMilesRounded(origin, otherGeo) } : null
    })
    .filter((row) => row && Number.isFinite(row.miles))
    .sort((a, b) => a.miles - b.miles || String(a.story.title || "").localeCompare(String(b.story.title || "")))
    .slice(0, limit)
    .map(({ story: item, miles }) => ({
      kind: "story",
      slug: item.slug,
      title: item.title,
      county: item.county || "",
      miles,
    }))
}

export function nearbyMarkers(story, markers = [], { limit = 5, excludeMarkerIds = [] } = {}) {
  const origin = roundedStoryGeo(story)
  if (!origin) return []
  const excluded = new Set((excludeMarkerIds || []).map((id) => String(id)))
  return (markers || [])
    .filter((m) => m && m.id && !excluded.has(String(m.id)))
    .map((m) => {
      const lat = roundStoryCoord(m.lat, false)
      const lon = roundStoryCoord(m.lon, false)
      if (lat == null || lon == null) return null
      return { marker: m, miles: haversineMilesRounded(origin, { lat, lon }) }
    })
    .filter((row) => row && Number.isFinite(row.miles))
    .sort((a, b) => a.miles - b.miles || Number(a.marker.id) - Number(b.marker.id))
    .slice(0, limit)
    .map(({ marker, miles }) => ({
      kind: "marker",
      id: String(marker.id),
      title: marker.title,
      county: marker.county || "",
      miles,
    }))
}

export function computeRelatedNote(baseStory, candidate) {
  if (
    baseStory?.matchedPlace &&
    candidate?.matchedPlace &&
    String(baseStory.matchedPlace).trim().toLowerCase() === String(candidate.matchedPlace).trim().toLowerCase()
  ) {
    return "Same place"
  }
  const ignored = new Set(["kentucky", "other"])
  const baseTags = new Set(
    (baseStory?.tags || [])
      .map((t) => String(t).toLowerCase())
      .filter((t) => !ignored.has(t)),
  )
  const sharedTags = (candidate?.tags || []).filter((t) => baseTags.has(String(t).toLowerCase()))
  if (sharedTags.length) {
    return `Shared: ${sharedTags.slice(0, 2).map((t) => String(t).replace(/-/g, " ")).join(", ")}`
  }
  if (
    candidate?.county &&
    baseStory?.county &&
    String(candidate.county).toLowerCase() === String(baseStory.county).toLowerCase()
  ) {
    return `Same county (${countyLong(candidate.county)})`
  }
  // #346 (Critiquito): no distance on any card involving a protected site.
  const protectedPair = isProtectedStory(baseStory) || isProtectedStory(candidate)
  const aGeo = roundedStoryGeo(baseStory)
  const bGeo = roundedStoryGeo(candidate)
  const miles = protectedPair ? NaN : haversineMilesRounded(aGeo, bGeo)
  if (Number.isFinite(miles) && miles < 50) {
    return `Nearby: ${miles < 10 ? miles.toFixed(1).replace(/\.0$/, "") : Math.round(miles)} miles`
  }
  if (candidate?.era && baseStory?.era && candidate.era === baseStory.era) {
    return `Same era: ${storyEraLabel(candidate.era)}`
  }
  return "Related Kentucky story"
}

export function renderWhereItHappenedCard(story, matchedMarkers = [], variant = 'rail') {
  const geo = roundedStoryGeo(story)
  if (!geo) return ''
  const pins = storyMapPins(story, matchedMarkers)
  if (!pins.length) return ''

  const { statePathD, countiesPathD, frame, project } = getMapAssets()
  const projectedPins = pins.map((p) => {
    const [mx, my] = project(p.lon, p.lat)
    const x = frame.xFit.scale * mx + frame.xFit.offset
    const y = frame.yFit.scale * my + frame.yFit.offset
    return { ...p, x, y }
  })

  const xs = projectedPins.map((p) => p.x)
  const ys = projectedPins.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  const aspect = variant === 'mobile' ? 358 / 180 : 300 / 230
  const spanX = Math.max(150, (maxX - minX) * 2.3)
  const spanY = Math.max(85, (maxY - minY) * 2.5)
  let vw = Math.max(spanX, spanY * aspect)
  let vh = vw / aspect
  if (vw > 940) {
    vw = 940
    vh = vw / aspect
  }
  const vx = Math.max(30, Math.min(970 - vw, cx - vw / 2))
  const vy = Math.max(10, Math.min(425 - vh, cy - vh / 2))
  const scale = vw / 300
  const strokePin = (2 * scale).toFixed(1)

  // Subtle stylized road network across the viewport so dark/light map shows road context with basemap labels off
  const roadPaths = [
    `M${(vx + vw * 0.08).toFixed(1)} ${(vy + vh * 0.72).toFixed(1)} Q${(cx).toFixed(1)} ${(cy).toFixed(1)} ${(vx + vw * 0.92).toFixed(1)} ${(vy + vh * 0.24).toFixed(1)}`,
    `M${(vx + vw * 0.18).toFixed(1)} ${(vy + vh * 0.18).toFixed(1)} Q${(cx + vw * 0.05).toFixed(1)} ${(cy).toFixed(1)} ${(vx + vw * 0.84).toFixed(1)} ${(vy + vh * 0.85).toFixed(1)}`,
  ]
  const roadsSvg = roadPaths
    .map((d) => `<path class="usp-map-road" d="${d}" stroke-width="${(1.5 * scale).toFixed(1)}" fill="none" />`)
    .join('')

  let connectorSvg = ''
  if (!geo.protectedStory && projectedPins.length > 1) {
    const dConn = projectedPins.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    connectorSvg = `<path class="usp-map-connector" d="${dConn}" stroke-width="${(1.8 * scale).toFixed(1)}" stroke-dasharray="${(4 * scale).toFixed(1)} ${(3 * scale).toFixed(1)}" fill="none" />`
  }

  let approxSvg = ''
  if (geo.protectedStory) {
    const p = projectedPins[0]
    const rApprox = (26 * scale).toFixed(1)
    approxSvg = `<circle class="usp-map-approx-ring" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rApprox}" stroke-width="${strokePin}" stroke-dasharray="${(4 * scale).toFixed(1)} ${(3 * scale).toFixed(1)}" />`
  }

  // Offset HTML pin labels inside the canvas so labels never collide with pins
  const pinHtmlOverlays = projectedPins
    .map((p, idx) => {
      const leftPct = Math.max(12, Math.min(88, ((p.x - vx) / vw) * 100)).toFixed(1)
      const topPct = Math.max(14, Math.min(86, ((p.y - vy) / vh) * 100)).toFixed(1)
      const posClass = idx % 2 === 1 ? ' usp-pin-secondary' : ''
      return `<div class="usp-pin${posClass}" style="left:${leftPct}%;top:${topPct}%"><span class="usp-pin-dot" aria-hidden="true"></span><span class="usp-pin-tag">${escapeHtml(p.label)}</span></div>`
    })
    .join('')

  const mapHref = `/#map/stories/${encodeURIComponent(story.slug)}`
  const counties = storyCountiesList(story, matchedMarkers)
  const placeSummary = formatCountiesBadge(counties) || story.matchedPlace || 'Kentucky'
  const mapAlt = geo.protectedStory
    ? `Approximate location map for ${story.title} in ${placeSummary}`
    : `Map showing ${projectedPins.length > 1 ? `${projectedPins.length} locations` : 'location'} for ${story.title} in ${placeSummary}`

  const latStr = geo.lat.toFixed(geo.decimals)
  const lonStr = geo.lon.toFixed(geo.decimals)
  // Editor 10/24 (#345): no Find photos ↗ (Historypin) link for protected sites.
  const historypinHref = `https://www.historypin.org/en/explore/geo/${latStr},${lonStr},13/`
  const approxAttr = geo.protectedStory ? ' data-approximate="true"' : ''

  const svgMarkup = `<svg class="usp-map-svg" viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" role="img" aria-label="${escapeHtml(mapAlt)}">
        <rect class="usp-map-paper" x="${(vx - 80).toFixed(1)}" y="${(vy - 80).toFixed(1)}" width="${(vw + 160).toFixed(1)}" height="${(vh + 160).toFixed(1)}" />
        <path class="usp-map-land" d="${statePathD}" />
        <path class="usp-map-counties" d="${countiesPathD}" />
        ${roadsSvg}
        <path class="usp-map-edge" d="${statePathD}" />
        ${connectorSvg}
        ${approxSvg}
      </svg>`

  if (variant === 'mobile') {
    return `<section class="usp-section usp-map-inline usp-map-card usp-map-card-mobile" id="map-inline" aria-labelledby="h-map" data-lat="${latStr}" data-lon="${lonStr}"${approxAttr}>
      <h2 id="h-map">Map</h2>
      <div class="usp-map-inline-frame">
        ${svgMarkup}
        ${pinHtmlOverlays}
      </div>
      <div class="usp-map-inline-actions">
        <a class="usp-btn" data-story-map href="${escapeHtml(mapHref)}">Open on map →</a>
        ${geo.protectedStory ? '' : `<a class="usp-btn usp-btn-ghost" href="${escapeHtml(historypinHref)}" target="_blank" rel="noopener noreferrer">Find photos ↗</a>`}
      </div>
    </section>`
  }

  const dirsHtml = geo.protectedStory
    ? `<span class="usp-railmap-dirs usp-approx-pill" title="Coordinates rounded to 0.1° (~11 km) to protect a sensitive archaeological or cultural site">Approximate area (~11 km) · Protected site</span>`
    : `<span class="usp-railmap-dirs">Directions: <a href="https://maps.apple.com/?daddr=${latStr},${lonStr}" target="_blank" rel="noopener noreferrer">Apple Maps</a> · <a href="https://www.google.com/maps/dir/?api=1&amp;destination=${latStr},${lonStr}" target="_blank" rel="noopener noreferrer">Google Maps</a></span>`

  return `<section class="usp-railmap usp-map-card usp-map-card-rail" aria-label="Story location on Kentucky map" data-lat="${latStr}" data-lon="${lonStr}"${approxAttr}>
    <div class="usp-railmap-canvas">
      ${svgMarkup}
      ${pinHtmlOverlays}
    </div>
    <div class="usp-railmap-foot">
      <a class="usp-railmap-open" data-story-map href="${escapeHtml(mapHref)}">Open on map →</a>
      ${dirsHtml}
      ${geo.protectedStory ? '' : `<a class="usp-railmap-photos" href="${escapeHtml(historypinHref)}" target="_blank" rel="noopener noreferrer">Find photos ↗</a>`}
    </div>
  </section>`
}

export function extractResearchClaims(notes) {
  if (!notes) return []
  const out = []
  if (Array.isArray(notes.claims)) {
    for (const c of notes.claims) {
      if (c && c.claim) out.push(c)
    }
  }
  if (Array.isArray(notes.sections)) {
    for (const sec of notes.sections) {
      const heading = String(sec?.heading || "").trim()
      for (const item of sec?.items || []) {
        const text = String(item?.text || item?.claim || "").trim()
        if (!text) continue
        out.push({
          heading,
          claim: heading ? `${heading}: ${text}` : text,
          confidence: item?.confidence || "",
          sources: Array.isArray(item?.sources) ? item.sources : [],
        })
      }
    }
  }
  return out
}
