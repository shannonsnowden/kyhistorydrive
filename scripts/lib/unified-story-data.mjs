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
import {
  compactYearRange,
  countyLong,
  learnMoreItemsFromMarkdown,
  learnMoreLinkText,
  markerMapHref,
  sourceNameForUrl,
} from '../../src/story-tools.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const SHORT_TITLE_OVERRIDES = {
  'father-david-rice-and-kentuckys-first-presbyterian-churches': 'Father David Rice & KY’s First Churches',
  'catherine-spears-carpenter-1818-casey-county-sweet-mash-and-sour-mash-recipes':
    'Catherine Spears Carpenter’s 1818 Mash Recipes',
  'kentucky-association-1826-lexington-race-course': 'Kentucky Association & Lexington Race Course',
  'wea-towns-at-ouiatenon-and-scotts-1791-kentucky-raid': 'Wea Towns at Ouiatenon & Scott’s 1791 Raid',
  'little-turtle-and-hardins-defeat-1790': 'Little Turtle & Hardin’s 1790 Defeat',
  'cane-ridge-meeting-house-and-the-1801-camp-meeting': 'Cane Ridge Meeting House & 1801 Revival',
  'capt-william-hubbells-ohio-flatboat-stand-1791': 'Capt. William Hubbell’s 1791 Flatboat Stand',
  'louisville-nashville-railroad-opens-the-interior': 'Louisville & Nashville Railroad in KY',
  'e-h-taylor-jr-and-the-bottled-in-bond-act-1897': 'E.H. Taylor Jr. & the Bottled-in-Bond Act',
  'potawatomi-fire-keepers-and-the-ohio-valley-wars': 'Potawatomi Fire-Keepers & Ohio Valley Wars',
  'mary-draper-ingles-escapes-through-kentucky-1755': 'Mary Draper Ingles’s 1755 Escape in KY',
  'wickliffe-mounds-mississippian-village-ballard-county': 'Wickliffe Mounds Mississippian Village',
  'wyandot-name-kah-ten-tah-teh-fair-land-of-tomorrow': 'Wyandot Name: Kah-ten-tah-teh',
}

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
function getProtectedSlugSet() {
  if (cachedProtectedSlugs) return cachedProtectedSlugs
  cachedProtectedSlugs = new Set()
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/web/protected-pins.json"), "utf8"))
    for (const s of raw.ids || raw.stories || []) cachedProtectedSlugs.add(String(s))
    for (const h of raw.historyIds || []) cachedProtectedSlugs.add(String(h))
  } catch (_) {}
  return cachedProtectedSlugs
}

export function isProtectedStory(story) {
  if (
    story?.coordinatesProtected ||
    story?.locationApproximate ||
    story?.archaeological ||
    story?.era === "prehistoric" ||
    (Array.isArray(story?.tags) && story.tags.includes("archaeology"))
  ) {
    return true
  }
  const set = getProtectedSlugSet()
  if (story?.slug && set.has(String(story.slug))) return true
  if (story?.id && set.has(String(story.id))) return true
  if (story?.historyId && set.has(String(story.historyId))) return true
  return false
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
  const raw = String(story?.title || '').trim()
  if (!raw) return 'Kentucky History Drive'
  const full = `${raw} | KY History Drive`
  if (full.length <= 60) return full
  const med = `${raw} | KY History`
  if (med.length <= 60) return med
  if (SHORT_TITLE_OVERRIDES[story?.slug]) {
    return `${SHORT_TITLE_OVERRIDES[story.slug]} | KY History`
  }
  const maxCore = 60 - ' | KY History'.length
  const compact = raw
    .replace(/\band\b/g, '&')
    .replace(/\bKentucky['’]s\b/g, 'KY’s')
    .replace(/\bKentucky\b/g, 'KY')
  if (compact.length <= maxCore) return `${compact} | KY History`
  for (const sep of [' — ', ' – ', ': ', ', ']) {
    if (raw.includes(sep)) {
      const [head] = raw.split(sep)
      const h = head.trim()
      if (h.length >= 6 && h.length <= maxCore) {
        return `${h} | KY History`
      }
    }
  }
  return `${compact.slice(0, maxCore).trim()} | KY History`
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

export function resolvePeopleInStory(story, peopleData, notes = null, subject = null) {
  const byId =
    peopleData?.byId instanceof Map
      ? peopleData.byId
      : peopleData?.peopleById instanceof Map
        ? peopleData.peopleById
        : new Map()
  const peopleArray = Array.isArray(peopleData?.people)
    ? peopleData.people
    : Array.isArray(peopleData?.people?.people)
      ? peopleData.people.people
      : []
  const storySubjects =
    peopleData?.storySubjects || peopleData?.people?.storySubjects || {}
  const seen = new Set()
  const list = []

  const pushPerson = (p, roleOverride = '') => {
    if (!p?.id || seen.has(p.id)) return
    seen.add(p.id)
    list.push({
      id: p.id,
      name: p.name,
      dates: p.dates || '',
      role: roleOverride || p.role || '',
      image: p.image || null,
      credit: p.credit || '',
      ai: Boolean(p.ai),
    })
  }

  if (subject?.id) {
    pushPerson(subject, story?.summary || '')
  }
  const subjId = storySubjects?.[story?.slug]
  if (subjId && byId.has(subjId)) {
    pushPerson(byId.get(subjId), story?.summary || '')
  }
  for (const p of peopleArray) {
    if (Array.isArray(p?.stories) && p.stories.includes(story?.slug)) {
      pushPerson(p, story?.summary || '')
    }
  }
  if (Array.isArray(notes?.people)) {
    for (const np of notes.people) {
      const pid = np?.peopleId || np?.id
      if (pid && byId.has(pid)) {
        pushPerson(byId.get(pid), np.role || '')
      }
    }
  }
  const md = String(story?.bodyMarkdown || '')
  for (const match of md.matchAll(/\]\(\/people\/#([a-z0-9-]+)\)/g)) {
    const pid = match[1]
    if (byId.has(pid)) pushPerson(byId.get(pid), '')
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

export function renderWhereItHappenedCard(story, matchedMarkers = [], variant = 'rail') {
  const geo = roundedStoryGeo(story)
  if (!geo) return ''
  const pins = storyMapPins(story, matchedMarkers)
  if (!pins.length) return ''

  const { statePathD, countiesPathD, frame, project, countyLabels } = getMapAssets()
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

  const aspect = variant === 'mobile' ? 358 / 132 : 300 / 162
  const spanX = Math.max(150, (maxX - minX) * 2.3)
  const spanY = Math.max(85, (maxY - minY) * 2.5)
  let vw = Math.max(spanX, spanY * aspect)
  let vh = vw / aspect
  if (vw > 940) {
    vw = 940
    vh = vw / aspect
  }
  let vx = Math.max(30, Math.min(970 - vw, cx - vw / 2))
  let vy = Math.max(10, Math.min(425 - vh, cy - vh / 2))

  const visibleCounties = countyLabels.filter(
    (c) => c.x >= vx + 16 && c.x <= vx + vw - 16 && c.y >= vy + 12 && c.y <= vy + vh - 12,
  )

  const scale = vw / 300
  const rPin = (10.5 * scale).toFixed(1)
  const strokePin = (2 * scale).toFixed(1)
  const fontPin = (10 * scale).toFixed(1)
  const fontCounty = (7.5 * scale).toFixed(1)

  const countyTextSvg = visibleCounties
    .slice(0, 14)
    .map(
      (c) =>
        `<text class="usp-map-county-name" x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" font-size="${fontCounty}" text-anchor="middle">${escapeHtml(c.name.toUpperCase())}</text>`,
    )
    .join('')

  let connectorSvg = ''
  if (!geo.protectedStory && projectedPins.length > 1) {
    const dConn = projectedPins.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    connectorSvg = `<path class="usp-map-connector" d="${dConn}" stroke-width="${(1.8 * scale).toFixed(1)}" stroke-dasharray="${(4 * scale).toFixed(1)} ${(3 * scale).toFixed(1)}" fill="none" />`
  }

  let pinsSvg = ''
  if (geo.protectedStory) {
    const p = projectedPins[0]
    const rApprox = (26 * scale).toFixed(1)
    pinsSvg = `<circle class="usp-map-approx-ring" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rApprox}" stroke-width="${strokePin}" stroke-dasharray="${(4 * scale).toFixed(1)} ${(3 * scale).toFixed(1)}" />` +
      `<circle class="usp-map-pin-circle" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(5.5 * scale).toFixed(1)}" stroke-width="${strokePin}" />`
  } else {
    pinsSvg = projectedPins
      .map((p, idx) => {
        const dyLabel = idx % 2 === 0 ? -15 * scale : 20 * scale
        return (
          `<g class="usp-map-pin-group">` +
          `<circle class="usp-map-pin-circle" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rPin}" stroke-width="${strokePin}" />` +
          `<text class="usp-map-pin-num" x="${p.x.toFixed(1)}" y="${(p.y + 3.5 * scale).toFixed(1)}" font-size="${fontPin}" text-anchor="middle">${p.num}</text>` +
          `<text class="usp-map-pin-caption" x="${p.x.toFixed(1)}" y="${(p.y + dyLabel).toFixed(1)}" font-size="${(8.2 * scale).toFixed(1)}" text-anchor="middle">${escapeHtml(p.label)}</text>` +
          `</g>`
        )
      })
      .join('')
  }

  const coordText = formatCoordCardinal(geo.lat, geo.lon, geo.decimals)
  const mapHref = `/#map/stories/${encodeURIComponent(story.slug)}`
  const counties = storyCountiesList(story, matchedMarkers)
  const placeSummary = formatCountiesBadge(counties) || story.matchedPlace || 'Kentucky'
  const mapAlt = geo.protectedStory
    ? `Approximate location map for ${story.title} in ${placeSummary}`
    : `Map showing ${projectedPins.length > 1 ? `${projectedPins.length} locations` : 'location'} for ${story.title} in ${placeSummary}`

  const approxPill = geo.protectedStory
    ? `<span class="usp-approx-pill" title="Coordinates rounded to 0.1° (~11 km) to protect a sensitive archaeological or cultural site">Approximate area (~11 km)</span>`
    : ''

  const wrapperClass =
    variant === 'mobile' ? 'usp-map-card usp-map-card-mobile' : 'usp-map-card usp-map-card-rail'

  return `<div class="${wrapperClass}" data-lat="${geo.lat.toFixed(geo.decimals)}" data-lon="${geo.lon.toFixed(geo.decimals)}"${geo.protectedStory ? ' data-approximate="true"' : ''}>
    <div class="usp-map-card-head">
      <span class="usp-map-card-kicker">Where it happened</span>
      ${approxPill}
    </div>
    <a class="usp-map-preview" data-story-map href="${escapeHtml(mapHref)}" aria-label="${escapeHtml(`Explore ${story.title} on interactive map`)}">
      <svg class="usp-map-svg" viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" role="img" aria-label="${escapeHtml(mapAlt)}">
        <rect class="usp-map-paper" x="${(vx - 80).toFixed(1)}" y="${(vy - 80).toFixed(1)}" width="${(vw + 160).toFixed(1)}" height="${(vh + 160).toFixed(1)}" />
        <path class="usp-map-land" d="${statePathD}" />
        <path class="usp-map-counties" d="${countiesPathD}" />
        <path class="usp-map-edge" d="${statePathD}" />
        ${countyTextSvg}
        ${connectorSvg}
        ${pinsSvg}
      </svg>
    </a>
    <div class="usp-map-meta">
      <div class="usp-map-coord-row">
        <span class="usp-map-coord" aria-label="Coordinates">${escapeHtml(coordText)}</span>
        <span class="usp-map-place">${escapeHtml(placeSummary)}</span>
      </div>
      <a class="usp-map-cta" data-story-map href="${escapeHtml(mapHref)}">Explore on interactive map <span aria-hidden="true">→</span></a>
    </div>
  </div>`
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
