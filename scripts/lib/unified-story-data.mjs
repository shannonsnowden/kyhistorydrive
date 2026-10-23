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
  const base = String(story?.seoTitle || story?.title || '').trim()
  if (!base) return 'Kentucky History Drive'
  const suffixed = `${base} · Kentucky History Drive`
  if (suffixed.length <= 60) return suffixed
  if (base.length <= 60) return base
  if (SHORT_TITLE_OVERRIDES[story?.slug]) {
    return SHORT_TITLE_OVERRIDES[story.slug]
  }
  return base.slice(0, 60).trim()
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

export function computeRelatedNote(baseStory, candidate) {
  const baseTags = new Set((baseStory?.tags || []).map((t) => String(t).toLowerCase()))
  const sharedTags = (candidate?.tags || []).filter((t) => baseTags.has(String(t).toLowerCase()))
  const bits = []
  if (sharedTags.length) {
    bits.push(`Shared: ${sharedTags.slice(0, 2).map((t) => String(t).replace(/-/g, ' ')).join(', ')}`)
  }
  if (candidate?.county && baseStory?.county && String(candidate.county).toLowerCase() === String(baseStory.county).toLowerCase()) {
    bits.push(`Same county (${countyLong(candidate.county)})`)
  } else if (candidate?.county) {
    bits.push(countyLong(candidate.county))
  }
  const yrs = compactYearRange(candidate?.yearStart, candidate?.yearEnd)
  if (yrs) bits.push(yrs)
  else if (candidate?.era) bits.push(storyEraLabel(candidate.era))
  return bits.join(' · ') || 'Related Kentucky story'
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
        <a class="usp-btn usp-btn-ghost" href="${escapeHtml(historypinHref)}" target="_blank" rel="noopener noreferrer">Find photos ↗</a>
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
      <a class="usp-railmap-photos" href="${escapeHtml(historypinHref)}" target="_blank" rel="noopener noreferrer">Find photos ↗</a>
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
