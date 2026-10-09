#!/usr/bin/env node
/**
 * Crawlable HTML for /stories/<slug>/ and /layers/<id>/, written into dist/
 * after `vite build`. The hash app at / is unchanged.
 *
 * Story text is the merged result the timeline already shows:
 *   1. build-stories rebuilds the index from each story file
 *   2. build-stories-locations joins pins
 *   3. apply-story-overrides re-applies scripts/story-overrides.json
 *      (pins, county, years, exact text replacements) and then pin-rounding
 *   4. The timeline reader fetches that story file (loadStoryBody) and the
 *      county on the enriched index row (enrichStoriesCounties)
 * This step runs after those scripts, so it reads the same files.
 *
 * Years written here are yearStart/yearEnd (occupation or event). Archaeological
 * pins are never printed. MapLibre is not included.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { marked } from 'marked'

class PrerenderPages {
  static SITE = 'https://kyhistorydrive.com'
  static COUNTY_DISPLAY = { Larue: 'LaRue' }
  static ERA_LABEL = {
    prehistoric: 'Prehistoric',
    native: 'Native',
    frontier: 'Frontier',
    'early-commonwealth': 'Early commonwealth',
    other: 'Kentucky',
  }
  /** Product copy for each map layer. Featured-stop blurbs come from LAYER_HIGHLIGHTS. */
  static LAYER_INTRO = {
    markers:
      'Kentucky Historical Society highway markers. Each pin uses the public marker inscription from the Historical Society marker program.',
    history:
      'History places tied to the Timeline: towns, stations, earthworks, and other sites. Years on this layer are occupation or event years.',
    museums:
      'Museums and history centers across Kentucky, including the Kentucky Historical Society museum in Frankfort.',
    national:
      'National parks, historic sites, and other national designations in Kentucky.',
    war:
      'Battlefields and other war sites in Kentucky, from the Revolutionary War through later conflicts.',
    locals:
      'Good Eats: long-running taverns, inns, and local restaurants on the map.',
    bridges: 'Covered bridges still standing in Kentucky.',
    industry: 'Furnaces, mills, and other industrial sites in Kentucky.',
    newspapers: 'Historic Kentucky newspapers, including the Kentucke Gazette.',
    parks: 'Kentucky state parks and resort parks.',
    cemeteries: 'Historic cemeteries in Kentucky.',
    distilleries: 'Distilleries on the Kentucky map, including sites with late-1700s roots.',
    caves:
      'Public show caves and historic caves, plus a county-centre marker where caves are documented in that county. Wild cave locations are not on this map.',
  }

  static async main(argv = process.argv.slice(2)) {
    const root = PrerenderPages.arg(argv, '--root') || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const dist = path.resolve(PrerenderPages.arg(argv, '--dist') || path.join(root, 'dist'))
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      throw new Error(`prerender: ${dist}/index.html is missing; run vite build first`)
    }
    PrerenderPages.configureMarked()
    const cssHrefs = PrerenderPages.stylesheetHrefs(dist, fs.readFileSync(path.join(dist, 'index.html'), 'utf8'))
    const stories = PrerenderPages.loadStories(root)
    PrerenderPages.assertOverridesApplied(root, stories)
    const layers = await PrerenderPages.loadLayers(root)
    const urls = []
    for (const story of stories) {
      const urlPath = `/stories/${story.slug}/`
      const html = PrerenderPages.storyPage(story, cssHrefs)
      PrerenderPages.assertPage(html, story, urlPath)
      PrerenderPages.writePage(dist, urlPath, html)
      urls.push(`${PrerenderPages.SITE}${urlPath}`)
    }
    for (const layer of layers) {
      const urlPath = `/layers/${layer.id}/`
      const html = PrerenderPages.layerPage(layer, cssHrefs)
      PrerenderPages.assertPage(html, { archaeological: false, lat: null, lon: null }, urlPath)
      PrerenderPages.writePage(dist, urlPath, html)
      urls.push(`${PrerenderPages.SITE}${urlPath}`)
    }
    const sitemapCount = PrerenderPages.updateSitemap(path.join(dist, 'sitemap.xml'), urls)
    console.log(
      `prerender: ${urls.length} pages (${stories.length} stories, ${layers.length} layers); sitemap ${sitemapCount} urls`,
    )
    return { pages: urls.length, stories: stories.length, layers: layers.length, sitemap: sitemapCount, urls }
  }

  static arg(argv, name) {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : null
  }

  static readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  }

  static configureMarked() {
    marked.setOptions({ breaks: true })
    marked.use({
      renderer: {
        link({ href, title, tokens }) {
          const text = this.parser.parseInline(tokens)
          const t = title ? ` title="${title}"` : ''
          const safeHref = String(href || '').replace(/"/g, '&quot;')
          return `<a href="${safeHref}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`
        },
      },
    })
  }

  static escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  static escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  /** Same Source: stripping the timeline uses before rendering the body. */
  static stripSourceAttribution(markdown) {
    return String(markdown || '')
      .replace(/^[ \t]*source:[ \t]*.+$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  static summaryDuplicatesBody(summary, bodyMarkdown) {
    const sum = String(summary || '')
      .replace(/\s+/g, ' ')
      .replace(/[…\.]+$/u, '')
      .trim()
      .toLowerCase()
    const body = String(bodyMarkdown || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
    if (!sum || !body) return false
    const prefix = sum.slice(0, Math.min(sum.length, 100))
    return prefix.length >= 24 && body.startsWith(prefix)
  }

  static formatYear(y) {
    if (y == null || Number.isNaN(Number(y))) return '—'
    const n = Number(y)
    if (n < 0) return `${Math.abs(n)} BCE`
    return String(n)
  }

  static formatYearRange(start, end) {
    if (start == null && end == null) return ''
    if (start != null && end != null && start !== end) {
      return `${PrerenderPages.formatYear(start)} – ${PrerenderPages.formatYear(end)}${start < 0 && end > 0 ? ' CE' : ''}`
    }
    return PrerenderPages.formatYear(start ?? end)
  }

  static countyLabel(county, long = false) {
    const raw = String(county || '').trim()
    if (!raw) return ''
    const c = PrerenderPages.COUNTY_DISPLAY[raw] || raw
    if (c.includes(',')) return c
    return long ? `${c} County` : `${c} Co.`
  }

  static eraLabel(era) {
    return PrerenderPages.ERA_LABEL[era] || 'Kentucky'
  }

  static linkify(escapedText) {
    return String(escapedText || '').replace(
      /(https?:\/\/[^\s<]+[^.,;:!?)\]\s])/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
    )
  }

  static plainParagraphs(text) {
    const cleaned = PrerenderPages.stripSourceAttribution(text)
    if (!cleaned) return ''
    return cleaned
      .split(/\n{2,}/)
      .map((p) => `<p>${PrerenderPages.linkify(PrerenderPages.escapeHtml(p)).replace(/\n/g, '<br>')}</p>`)
      .join('\n')
  }

  static metaDescription(text) {
    const plain = String(text || '')
      .replace(/^[ \t]*source:[ \t]*.+$/gim, '')
      .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/[#*_>`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (plain.length <= 160) return plain
    return `${plain.slice(0, 157).replace(/\s+\S*$/, '')}…`
  }

  /** Site CSS only. Skip the MapLibre bundle Vite emits next to the app script. */
  static stylesheetHrefs(dist, indexHtml) {
    const hrefs = [...String(indexHtml).matchAll(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"/g)].map((m) =>
      m[1].startsWith('/') ? m[1] : `/${m[1]}`,
    )
    const site = hrefs.filter((href) => {
      const css = fs.readFileSync(path.join(dist, href.replace(/^\//, '')), 'utf8')
      return !css.includes('.maplibregl-map')
    })
    if (!site.length) throw new Error('prerender: site stylesheet not found in dist/index.html')
    return site
  }

  static safeSegment(value, label) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
      throw new Error(`prerender: unsafe ${label} "${value}"`)
    }
    return value
  }

  static isArchaeological(story) {
    return story?.era === 'prehistoric' || (story?.tags || []).includes('archaeology')
  }

  /**
   * Body file wins for the words the reader renders. County comes from the
   * index row after the same enrichment the app runs. Pins stay off the page.
   */
  static mergeStory(body, indexRow, loc, photos) {
    const slug = PrerenderPages.safeSegment(body.slug, 'slug')
    const photo = PrerenderPages.storyPhoto(body, indexRow, photos, slug)
    return {
      slug,
      title: body.title || indexRow?.title || slug,
      summary: body.summary || '',
      bodyMarkdown: body.bodyMarkdown || '',
      era: body.era || indexRow?.era || '',
      tags: body.tags || indexRow?.tags || [],
      yearStart: body.yearStart ?? null,
      yearEnd: body.yearEnd ?? null,
      county: indexRow?.county != null ? indexRow.county : '',
      matchedPlace: indexRow?.matchedPlace || loc?.matchedPlace || '',
      mapConfidence: indexRow?.mapConfidence || loc?.mapConfidence || '',
      historyId: loc?.historyId || indexRow?.historyId || null,
      lat: loc?.lat ?? indexRow?.lat ?? null,
      lon: loc?.lon ?? indexRow?.lon ?? null,
      photo,
      archaeological: PrerenderPages.isArchaeological(body),
    }
  }

  static storyPhoto(body, indexRow, photos, slug) {
    const candidates = [body?.photo, photos?.bySlug?.[slug]?.photo, indexRow?.photo]
    for (const photo of candidates) {
      if (photo?.image_url && !String(photo.image_url).includes('..')) return photo
    }
    return null
  }

  /** County fill copied from enrichStoriesCounties in src/main.js. Output is a county name only. */
  static enrichCounties(stories, { centroids, historyFeatures, locations }) {
    const countyNames = Object.keys(centroids).sort((a, b) => b.length - a.length)
    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const countyRe = countyNames.length
      ? new RegExp(`\\b(${countyNames.map(escapeRe).join('|')})(?:\\s+County)?\\b`, 'i')
      : null
    const historyById = new Map()
    const historyByName = new Map()
    for (const f of historyFeatures) {
      const p = f.properties || {}
      if (p.id) historyById.set(p.id, p)
      if (p.name) historyByName.set(String(p.name).toLowerCase(), p)
    }
    const countyFromText = (blob) => {
      if (!countyRe || !blob) return ''
      const m = String(blob).match(countyRe)
      return m ? m[1].replace(/\b\w/g, (ch) => ch.toUpperCase()) : ''
    }
    const nearestHistoryCounty = (lat, lon) => {
      if (lat == null || lon == null || !historyFeatures.length) return ''
      let best = ''
      let bestD = Infinity
      for (const f of historyFeatures) {
        const p = f.properties || {}
        if (!p.county || !f.geometry || f.geometry.type !== 'Point') continue
        const [x, y] = f.geometry.coordinates
        const d = (x - lon) ** 2 + (y - lat) ** 2
        if (d < bestD) {
          bestD = d
          best = p.county
        }
      }
      return best || ''
    }
    for (const s of stories) {
      if (s.county != null) continue
      const loc = locations[s.slug] || {}
      let county = ''
      const histId = loc.historyId || s.historyId
      if (histId && historyById.get(histId)?.county) county = historyById.get(histId).county
      if (!county && s.matchedPlace && historyByName.get(String(s.matchedPlace).toLowerCase())?.county) {
        county = historyByName.get(String(s.matchedPlace).toLowerCase()).county
      }
      if (!county) {
        county = countyFromText(
          [s.matchedPlace, s.title, s.summary, s.slug?.replace(/-/g, ' '), loc.matchedPlace].filter(Boolean).join(' '),
        )
      }
      if (!county && (s.mapConfidence === 'county' || loc.mapConfidence === 'county')) {
        const guess = countyFromText(`${s.matchedPlace || loc.matchedPlace || ''} County`)
        county = guess || countyFromText(s.matchedPlace || loc.matchedPlace || '')
      }
      if (!county) county = nearestHistoryCounty(s.lat, s.lon)
      s.county = county || ''
    }
  }

  static loadStories(root) {
    const index = PrerenderPages.readJson(path.join(root, 'public/content/stories.json'))
    const locations = PrerenderPages.readJson(path.join(root, 'public/content/stories-locations.json')).locations || {}
    let photos = { bySlug: {} }
    const photoFile = path.join(root, 'public/content/story-photos.json')
    if (fs.existsSync(photoFile)) photos = PrerenderPages.readJson(photoFile)
    let historyFeatures = []
    const historyFile = path.join(root, 'public/data/layers/history.geojson')
    if (fs.existsSync(historyFile)) historyFeatures = PrerenderPages.readJson(historyFile).features || []
    const centroids = PrerenderPages.readJson(path.join(root, 'public/data/county-centroids.json'))
    const rows = (index.stories || []).map((row) => ({ ...row }))
    PrerenderPages.enrichCounties(rows, { centroids, historyFeatures, locations })
    const dir = path.join(root, 'public/content/stories')
    const stories = []
    for (const indexRow of rows) {
      const file = path.join(dir, `${indexRow.slug}.json`)
      if (!fs.existsSync(file)) throw new Error(`prerender: missing story file for ${indexRow.slug}`)
      const body = PrerenderPages.readJson(file)
      if (body.slug !== indexRow.slug) throw new Error(`prerender: ${file} slug is ${body.slug}`)
      stories.push(PrerenderPages.mergeStory(body, indexRow, locations[body.slug] || {}, photos))
    }
    stories.sort((a, b) => a.slug.localeCompare(b.slug))
    if (!stories.length) throw new Error('prerender: no stories')
    return stories
  }

  static assertOverridesApplied(root, stories) {
    const spec = PrerenderPages.readJson(path.join(root, 'scripts/story-overrides.json'))
    const bySlug = new Map(stories.map((s) => [s.slug, s]))
    for (const [slug, o] of Object.entries(spec.overrides || {})) {
      const story = bySlug.get(slug)
      if (!story) continue
      const blob = [story.title, story.summary, story.bodyMarkdown].join('\n')
      for (const [i, r] of (o.replace || []).entries()) {
        if (blob.includes(r.old)) {
          throw new Error(`prerender: ${slug} still has pre-override text (replace[${i}])`)
        }
      }
      if ('yearStart' in o && story.yearStart !== o.yearStart) {
        throw new Error(`prerender: ${slug} yearStart ${story.yearStart} != override ${o.yearStart}`)
      }
      if ('yearEnd' in o && story.yearEnd !== o.yearEnd) {
        throw new Error(`prerender: ${slug} yearEnd ${story.yearEnd} != override ${o.yearEnd}`)
      }
      if ('county' in o && story.county !== o.county) {
        throw new Error(`prerender: ${slug} county "${story.county}" != override "${o.county}"`)
      }
    }
  }

  static layerDefs(mainSrc) {
    const start = mainSrc.indexOf('const DATA_LAYERS = [')
    const end = mainSrc.indexOf('\n]', start)
    if (start < 0 || end < 0) throw new Error('prerender: DATA_LAYERS not found in src/main.js')
    const defs = []
    for (const block of mainSrc.slice(start, end).split(/\n  \{/).slice(1)) {
      const id = block.match(/id:\s*'([^']+)'/)
      const label = block.match(/label:\s*'([^']+)'/)
      const geojson = block.match(/geojson:\s*'([^']+)'/)
      if (!id || !label || !geojson) throw new Error('prerender: DATA_LAYERS block is missing id, label, or geojson')
      defs.push({ id: id[1], label: label[1], geojson: geojson[1] })
    }
    if (defs.length !== 13) throw new Error(`prerender: expected 13 map layers, found ${defs.length}`)
    return defs
  }

  static featureText(props) {
    if (!props) return ''
    if (props.kind === 'county') return props.description || ''
    return props.inscription || props.history || props.description || props.location_text || ''
  }

  static findFeature(collection, layerId, placeId) {
    const want = String(placeId)
    for (const feature of collection?.features || []) {
      const p = feature.properties || {}
      if (layerId === 'markers') {
        if (String(p.marker_number) === want) return p
      } else if (String(p.id) === want) return p
    }
    return null
  }

  static placeName(props) {
    return props.name || props.title || ''
  }

  static caveHighlight(collection) {
    const feature = (collection.features || []).find((f) => f.properties?.kind !== 'county' && f.properties?.id)
    const props = feature?.properties
    if (!props) throw new Error('prerender: caves layer has no public cave')
    const blurb = String(props.description || '').split(/(?<=[.!?])\s+/)[0] || props.name
    return {
      layerId: 'caves',
      layerLabel: 'Caves',
      placeId: props.id,
      name: props.name,
      place: props.county ? `${props.county} County` : '',
      blurb,
      photo: props.photo || null,
    }
  }

  static async loadLayers(root) {
    const { LAYER_HIGHLIGHTS } = await import(pathToFileURL(path.join(root, 'src/home-preview-data.js')).href)
    const defs = PrerenderPages.layerDefs(fs.readFileSync(path.join(root, 'src/main.js'), 'utf8'))
    const byId = new Map(LAYER_HIGHLIGHTS.map((item) => [item.layerId, item]))
    return defs.map((def) => {
      PrerenderPages.safeSegment(def.id, 'layer id')
      const intro = PrerenderPages.LAYER_INTRO[def.id]
      if (!intro) throw new Error(`prerender: no layer intro for ${def.id}`)
      const file = path.join(root, 'public', def.geojson.replace(/^\//, ''))
      const collection = PrerenderPages.readJson(file)
      const highlight = byId.get(def.id) || (def.id === 'caves' ? PrerenderPages.caveHighlight(collection) : null)
      if (!highlight) throw new Error(`prerender: no LAYER_HIGHLIGHTS entry for ${def.id}`)
      const featured = PrerenderPages.findFeature(collection, def.id, highlight.placeId)
      const places = (collection.features || [])
        .map((feature) => {
          const p = feature.properties || {}
          const years = PrerenderPages.formatYearRange(
            p.yearStart != null ? p.yearStart : null,
            p.yearEnd != null ? p.yearEnd : null,
          )
          return {
            name: PrerenderPages.placeName(p),
            county: p.county ? PrerenderPages.countyLabel(p.county, true) : '',
            years,
          }
        })
        .filter((p) => p.name)
        .sort((a, b) => a.name.localeCompare(b.name) || a.county.localeCompare(b.county))
      return { ...def, intro, highlight, featured, places }
    })
  }

  static photoAbsolute(url) {
    if (!url) return ''
    if (/^https?:\/\//i.test(url)) return url
    return `${PrerenderPages.SITE}${url.startsWith('/') ? url : `/${url}`}`
  }

  static storyCreditHtml(photo, title) {
    if (!photo?.image_url) return ''
    const caption = PrerenderPages.escapeHtml(photo.title || title || 'Story photo')
    const sourceLabel = PrerenderPages.escapeHtml(photo.source_label || photo.credit || '')
    const attribution = PrerenderPages.escapeHtml(photo.attribution || photo.source_label || photo.credit || '')
    const year = photo.year ? ` <span class="muted">(${PrerenderPages.escapeHtml(String(photo.year))})</span>` : ''
    const href = PrerenderPages.escapeHtml(photo.source_url || photo.image_url)
    const img = PrerenderPages.escapeHtml(photo.image_url)
    const linkLabel = PrerenderPages.escapeHtml(
      `Open ${photo.source_label || photo.credit || 'photo source'}: ${photo.title || title || 'story photo'} (opens in a new tab)`,
    )
    return `<aside class="story-sidebar-photo" aria-label="Story photo">
      <p class="story-sidebar-photo-heading">Photos</p>
      <a class="story-sidebar-photo-frame" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${linkLabel}">
        <img src="${img}" alt="${caption}" loading="lazy" />
      </a>
      <p class="story-sidebar-photo-cap">${caption}${year}</p>
      <p class="story-sidebar-photo-attr"><span class="story-photo-source-label">Source:</span> ${attribution || sourceLabel || 'Unknown'}</p>
    </aside>`
  }

  static layerCreditHtml(photo) {
    if (!photo?.image_url) return ''
    const label = photo.attribution || photo.source_label || ''
    const year = photo.year ? ` · ${photo.year}` : ''
    const credit = label ? `${label}${year}` : ''
    const caption = PrerenderPages.escapeHtml(photo.title || 'Layer photo')
    const img = PrerenderPages.escapeHtml(photo.image_url)
    const href = PrerenderPages.escapeHtml(photo.source_url || photo.image_url)
    return `<figure class="story-sidebar-photo">
      <a class="story-sidebar-photo-frame" href="${href}" target="_blank" rel="noopener noreferrer">
        <img src="${img}" alt="${caption}" loading="lazy" />
      </a>
      <figcaption>
        <p class="story-sidebar-photo-cap">${caption}</p>
        ${credit ? `<p class="hp-photo-credit">Photo: ${PrerenderPages.escapeHtml(credit)}</p>` : ''}
      </figcaption>
    </figure>`
  }

  static learnMoreHtml(markdown) {
    const lines = String(markdown || '').match(/^[ \t]*source:[ \t]*.+$/gim) || []
    const items = lines
      .map((line) => String(line).replace(/^[ \t]*source:[ \t]*/i, '').trim())
      .filter(Boolean)
      .map((text) => `<li>${marked.parseInline(text)}</li>`)
    if (!items.length) return ''
    return `<div class="popup-research"><div class="historic-photos-label">Learn more</div><ul class="research-list">${items.join('')}</ul></div>`
  }

  static storyMapHref(story) {
    if (story.historyId) return `/#map/history/${encodeURIComponent(story.historyId)}`
    if (story.lat != null && story.lon != null) return `/#map/stories/${encodeURIComponent(story.slug)}`
    return ''
  }

  static shell({ title, description, canonical, cssHrefs, image, imageAlt, main }) {
    const t = PrerenderPages.escapeHtml(title)
    const d = PrerenderPages.escapeHtml(description)
    const c = PrerenderPages.escapeHtml(canonical)
    const img = image
      ? `<meta property="og:image" content="${PrerenderPages.escapeHtml(image)}" />
    <meta name="twitter:image" content="${PrerenderPages.escapeHtml(image)}" />
    <meta name="twitter:card" content="summary_large_image" />`
      : `<meta name="twitter:card" content="summary" />`
    const alt = imageAlt ? `<meta property="og:image:alt" content="${PrerenderPages.escapeHtml(imageAlt)}" />` : ''
    return `<!DOCTYPE html>
<html lang="en" data-hp-theme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- Header seal rotation: pick before first paint (see #brandLogo). -->
    <script>(function(){var L=['/brand/khd-logo.png','/brand/khd-logo-c.png','/brand/khd-logo-c2.png'],i;try{var n=parseInt(localStorage.getItem('khd-logo-n'),10);i=isNaN(n)?Math.floor(Math.random()*L.length):(n+1)%L.length;localStorage.setItem('khd-logo-n',String(i))}catch(e){i=Math.floor(Math.random()*L.length)}document.documentElement.setAttribute('data-logo',String(i));window.__khdLogo=L[i];if(i>0){var k=document.createElement('link');k.rel='preload';k.as='image';k.href=L[i];document.head.appendChild(k)}})()</script>
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${c}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Kentucky History Drive" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:url" content="${c}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    ${img}
    ${alt}
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    ${cssHrefs.map((href) => `<link rel="stylesheet" href="${PrerenderPages.escapeHtml(href)}" />`).join('\n    ')}
    <style>
      .static-read { max-width: 52rem; margin: 0 auto; padding: 1.25rem 1.25rem 3rem; }
      .brand .brand-title { margin: 0; font-size: clamp(1.05rem, 2.5vw, 1.35rem); letter-spacing: 0.02em; color: var(--heading); line-height: 1.15; font-weight: 700; }
      .static-kicker { margin: 0 0 0.35rem; color: var(--accent); font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
      .story-head h1 { color: var(--heading); font-size: clamp(1.7rem, 4vw, 2.45rem); line-height: 1.15; margin: 0.35rem 0 0.75rem; }
      .static-cta { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1.25rem 0; }
      .place-list { columns: 2; gap: 1.5rem; padding: 0; margin: 0.5rem 0 0; list-style: none; }
      .place-list li { break-inside: avoid; margin: 0 0 0.45rem; }
      .foot a { color: var(--accent); }
      @media (max-width: 700px) { .place-list { columns: 1; } }
    </style>
  </head>
  <body>
    <header class="top">
      <div class="brand">
        <a href="/" class="brand-home" title="Home">
          <img class="brand-logo" id="brandLogo" src="/brand/khd-logo.png" width="88" height="88" alt="Kentucky History Drive" />
          <script>(function(){var im=document.getElementById('brandLogo'),s=window.__khdLogo;if(im&&s&&im.getAttribute('src')!==s)im.setAttribute('src',s)})()</script>
          <p class="brand-title">Kentucky History Drive</p>
        </a>
        <p class="tagline">History is all around us.</p>
      </div>
      <nav id="mainNav" aria-label="Site">
        <a href="/">Home</a>
        <a href="/#map">Map</a>
        <a href="/#timeline">Timeline</a>
        <a href="/#about">About</a>
        <a href="/#app">App</a>
      </nav>
    </header>
    <main class="static-read">
      ${main}
    </main>
    <footer class="foot">
      <span>kyhistorydrive.com</span>
      <a href="/privacy">Privacy</a>
      <span>Data © Kentucky Historical Society (public markers) · Map © OpenStreetMap contributors</span>
    </footer>
  </body>
</html>
`
  }

  static storyPage(story, cssHrefs) {
    const title = `${story.title} · Kentucky History Drive`
    const description = PrerenderPages.metaDescription(story.summary || story.bodyMarkdown)
    const canonical = `${PrerenderPages.SITE}/stories/${story.slug}/`
    const years = PrerenderPages.formatYearRange(story.yearStart, story.yearEnd)
    const county = story.county ? PrerenderPages.countyLabel(story.county, true) : ''
    const metaBits = [county, PrerenderPages.eraLabel(story.era), years].filter(Boolean)
    const summary =
      story.summary && !PrerenderPages.summaryDuplicatesBody(story.summary, story.bodyMarkdown)
        ? `<p class="story-summary">${PrerenderPages.escapeHtml(story.summary)}</p>`
        : ''
    const mapHref = PrerenderPages.storyMapHref(story)
    const appHref = `/#timeline/${encodeURIComponent(story.slug)}`
    const main = `<article class="story-reader-layout">
        <div class="story-reader-main">
          <header class="story-head">
            <p class="static-kicker">Timeline story</p>
            <p class="story-card-meta">${metaBits.map((bit) => `<span>${PrerenderPages.escapeHtml(bit)}</span>`).join(' · ')}</p>
            <h1>${PrerenderPages.escapeHtml(story.title)}</h1>
            ${summary}
          </header>
          <div class="story-body">${marked.parse(PrerenderPages.stripSourceAttribution(story.bodyMarkdown || ''))}</div>
          ${PrerenderPages.learnMoreHtml(story.bodyMarkdown)}
          <div class="static-cta">
            <a class="btn" href="${PrerenderPages.escapeHtml(appHref)}">Open this story on the timeline</a>
            ${mapHref ? `<a class="btn ghost" href="${PrerenderPages.escapeHtml(mapHref)}">Open on the map</a>` : ''}
          </div>
        </div>
        ${PrerenderPages.storyCreditHtml(story.photo, story.title)}
      </article>`
    return PrerenderPages.shell({
      title,
      description,
      canonical,
      cssHrefs,
      image: PrerenderPages.photoAbsolute(story.photo?.image_url) || `${PrerenderPages.SITE}/brand/khd-logo-512.png`,
      imageAlt: story.photo?.title || story.title,
      main,
    })
  }

  static layerPage(layer, cssHrefs) {
    const title = `${layer.label} · Kentucky History Drive`
    const highlight = layer.highlight
    const description = PrerenderPages.metaDescription(`${layer.intro} ${highlight.blurb || ''}`)
    const canonical = `${PrerenderPages.SITE}/layers/${layer.id}/`
    const featured = layer.featured
    const featuredName = featured ? PrerenderPages.placeName(featured) : highlight.name
    const featuredYears = featured
      ? PrerenderPages.formatYearRange(featured.yearStart ?? null, featured.yearEnd ?? null)
      : ''
    const featuredCounty = featured?.county ? PrerenderPages.countyLabel(featured.county, true) : highlight.place || ''
    const featuredBits = [featuredCounty, featuredYears].filter(Boolean)
    const pinHref = `/#map/${encodeURIComponent(layer.id)}/${encodeURIComponent(highlight.placeId)}`
    const places = layer.places
      .map((place) => {
        const bits = [place.county, place.years].filter(Boolean)
        const extra = bits.length ? ` <span class="muted">${PrerenderPages.escapeHtml(bits.join(' · '))}</span>` : ''
        return `<li>${PrerenderPages.escapeHtml(place.name)}${extra}</li>`
      })
      .join('')
    const main = `<article>
        <header class="story-head">
          <p class="static-kicker">Map layer</p>
          <h1>${PrerenderPages.escapeHtml(layer.label)}</h1>
          <p>${PrerenderPages.escapeHtml(layer.intro)}</p>
        </header>
        <section class="story-reader-layout" aria-label="Featured place">
          <div class="story-reader-main">
            <h2>${PrerenderPages.escapeHtml(featuredName)}</h2>
            ${featuredBits.length ? `<p class="story-card-meta">${featuredBits.map((bit) => PrerenderPages.escapeHtml(bit)).join(' · ')}</p>` : ''}
            <p>${PrerenderPages.escapeHtml(highlight.blurb || '')}</p>
            <div class="story-body">${PrerenderPages.plainParagraphs(PrerenderPages.featureText(featured))}</div>
            <div class="static-cta">
              <a class="btn" href="${PrerenderPages.escapeHtml(pinHref)}">Open this layer on the map</a>
              <a class="btn ghost" href="/#map">Full map</a>
            </div>
          </div>
          ${PrerenderPages.layerCreditHtml(highlight.photo)}
        </section>
        <section aria-label="Places on this layer">
          <h2>${layer.places.length.toLocaleString('en-US')} places</h2>
          <ul class="place-list">${places}</ul>
        </section>
      </article>`
    return PrerenderPages.shell({
      title,
      description,
      canonical,
      cssHrefs,
      image: PrerenderPages.photoAbsolute(highlight.photo?.image_url) || `${PrerenderPages.SITE}/brand/khd-logo-512.png`,
      imageAlt: highlight.photo?.title || featuredName,
      main,
    })
  }

  static assertPage(html, story, urlPath) {
    if (!html.includes('<title>') || !html.includes('rel="canonical"') || !html.includes(urlPath)) {
      throw new Error(`prerender: ${urlPath} is missing title or canonical`)
    }
    if (/maplibre|\/src\/main\.js/i.test(html)) {
      throw new Error(`prerender: ${urlPath} pulled in the app bundle`)
    }
    if (/-?\d{1,3}\.\d{5,}/.test(html)) {
      throw new Error(`prerender: ${urlPath} includes a precise coordinate`)
    }
    const leak = [story.lat, story.lon]
      .filter((v) => typeof v === 'number')
      .map(String)
      .find((p) => {
        const decimals = (p.split('.')[1] || '').length
        if (!(story.archaeological || decimals > 2)) return false
        return html.includes(p)
      })
    if (leak) throw new Error(`prerender: ${urlPath} includes coordinate ${leak}`)
  }

  static writePage(dist, urlPath, html) {
    const dir = path.join(dist, urlPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), html)
  }

  /**
   * Keep sitemap entries that are not generated story/layer URLs (home, privacy,
   * and anything later added beside this step), then append this build's pages.
   */
  static updateSitemap(file, pageUrls) {
    const kept = []
    if (fs.existsSync(file)) {
      const xml = fs.readFileSync(file, 'utf8')
      for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
        const loc = match[1].trim()
        let pathname = ''
        try {
          pathname = new URL(loc).pathname
        } catch {
          continue
        }
        if (pathname.startsWith('/stories/') || pathname.startsWith('/layers/')) continue
        if (!kept.includes(loc)) kept.push(loc)
      }
    }
    if (!kept.length) kept.push(`${PrerenderPages.SITE}/`)
    const locs = [...kept]
    for (const loc of pageUrls) if (!locs.includes(loc)) locs.push(loc)
    const body = locs
      .map((loc) => `  <url>\n    <loc>${PrerenderPages.escapeXml(loc)}</loc>\n  </url>`)
      .join('\n')
    fs.writeFileSync(
      file,
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    )
    return locs.length
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  PrerenderPages.main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

export { PrerenderPages }
