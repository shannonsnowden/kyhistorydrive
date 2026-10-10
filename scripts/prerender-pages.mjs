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
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { marked } from 'marked'
import {
  GA_MEASUREMENT_ID,
  deferredAdsenseLoaderHtml,
  gtagHeadHtml,
  missingGaSnippet,
  privacyChoicesBootHtml,
  privacyChoicesLinkHtml,
} from './gtag-snippet.mjs'
import { sealRotationScriptHtml, siteChromeScriptHtml, siteHeaderHtml } from './site-chrome.mjs'
import { FILMS, filmDescriptionFromPlain, filmForStory, filmPlayerHtml, videoObjectNode } from '../src/films.js'

class PrerenderPages {
  static SITE = 'https://kyhistorydrive.com'
  static ORG_ID = 'https://kyhistorydrive.com/#organization'
  static CONTACT_EMAIL = 'contact@kyhistorydrive.com'
  static LOGO = 'https://kyhistorydrive.com/brand/khd-logo-512.png'
  static ADSENSE =
    '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8587137224654033" crossorigin="anonymous"></script>'
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
    const dates = PrerenderPages.gitFileDates(root)
    for (const story of stories) {
      const file = `public/content/stories/${story.slug}.json`
      story.created = dates.created.get(file) || ''
      story.lastmod = PrerenderPages.storyLastmod(story, dates.lastmod)
    }
    const homeLast = stories.reduce(
      (max, story) => PrerenderPages.laterDate(max, story.lastmod),
      dates.lastmod.get('index.html') || '',
    )
    const entries = [{ loc: `${PrerenderPages.SITE}/`, lastmod: homeLast }]
    const aboutHtml = PrerenderPages.aboutPage(cssHrefs)
    PrerenderPages.assertPage(aboutHtml, { archaeological: false, lat: null, lon: null }, '/about/')
    if (!aboutHtml.includes('Shannon Snowden') || !aboutHtml.includes('"@type":"Organization"')) {
      throw new Error('prerender: about page is missing the publisher, author, or Organization JSON-LD')
    }
    if (
      !aboutHtml.includes('mailto:contact@kyhistorydrive.com') ||
      !aboutHtml.includes('"contactType":"customer support"') ||
      !aboutHtml.includes('"email":"contact@kyhistorydrive.com"')
    ) {
      throw new Error('prerender: about page is missing the contact email')
    }
    PrerenderPages.writePage(dist, '/about/', aboutHtml)
    entries.push({
      loc: `${PrerenderPages.SITE}/about/`,
      lastmod: PrerenderPages.laterDate(
        dates.lastmod.get('scripts/prerender-pages.mjs') || '',
        dates.lastmod.get('index.html') || '',
      ),
    })
    for (const story of stories) {
      const urlPath = `/stories/${story.slug}/`
      const description = PrerenderPages.metaDescription(
        PrerenderPages.plainText(story.bodyMarkdown) || PrerenderPages.finishedSummary(story.summary),
      )
      const html = PrerenderPages.storyPage(story, stories, cssHrefs, layers)
      PrerenderPages.assertPage(html, story, urlPath)
      PrerenderPages.assertStory(html, story, description)
      PrerenderPages.writePage(dist, urlPath, html)
      entries.push({ loc: `${PrerenderPages.SITE}${urlPath}`, lastmod: story.lastmod })
    }
    for (const layer of layers) {
      const urlPath = `/layers/${layer.id}/`
      const html = PrerenderPages.layerPage(layer, cssHrefs)
      PrerenderPages.assertPage(html, { archaeological: false, lat: null, lon: null }, urlPath)
      PrerenderPages.writePage(dist, urlPath, html)
      const layerFile = `public/${String(layer.geojson || '').replace(/^\//, '')}`
      entries.push({ loc: `${PrerenderPages.SITE}${urlPath}`, lastmod: dates.lastmod.get(layerFile) || homeLast })
    }
    const videosHtml = PrerenderPages.videosPage(FILMS, stories, cssHrefs)
    PrerenderPages.assertPage(videosHtml, { lat: null, lon: null }, '/videos/')
    PrerenderPages.assertVideos(videosHtml, FILMS, stories)
    PrerenderPages.writePage(dist, '/videos/', videosHtml)
    const videosLast = FILMS.reduce(
      (max, film) => PrerenderPages.laterDate(max, PrerenderPages.isoDate(film.uploadDate)),
      dates.lastmod.get('src/films.js') || '',
    )
    if (!PrerenderPages.isoDate(videosLast)) {
      throw new Error('prerender: /videos/ is missing lastmod')
    }
    entries.push({ loc: `${PrerenderPages.SITE}/videos/`, lastmod: videosLast })
    PrerenderPages.writeVideoSitemap(path.join(dist, 'sitemap-videos.xml'), FILMS, stories)
    entries.push({
      loc: `${PrerenderPages.SITE}/privacy/`,
      lastmod: dates.lastmod.get('privacy/index.html') || '',
    })
    const sitemapCount = PrerenderPages.updateSitemap(path.join(dist, 'sitemap.xml'), entries)
    PrerenderPages.injectHome(path.join(dist, 'index.html'), stories, layers)
    console.log(
      `prerender: ${stories.length + layers.length} story/layer pages (${stories.length} stories, ${layers.length} layers) plus home, about, videos, privacy; sitemap ${sitemapCount} urls`,
    )
    return {
      pages: stories.length + layers.length + 1,
      stories: stories.length,
      layers: layers.length,
      sitemap: sitemapCount,
      urls: entries.map((entry) => entry.loc),
    }
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

  static plainText(text) {
    return String(text || '')
      .replace(/^[ \t]*source:[ \t]*.+$/gim, '')
      .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/[#*_>`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /** Split on sentence ends, keeping "Col." / "St." / "John C." with the next fragment. */
  static splitSentences(plain) {
    const parts = String(plain || '').split(/(?<=[.!?])\s+(?=[A-Z"'\u201C\u2018])/)
    const out = []
    let buf = ''
    const abbrev = (s) =>
      /\b(?:Jr|Sr|Dr|Capt|Col|Gen|Maj|Lt|Rev|Gov|Mr|Mrs|Ms|St|Ave|Mt|Ft|No|Co|Sts|Pres|Hon|vs|etc)\.$/.test(
        s.trimEnd(),
      ) || /(?:^|[\s(])[A-Z]\.$/.test(s.trimEnd())
    for (const part of parts) {
      const piece = String(part || '').trim()
      if (!piece) continue
      buf = buf ? `${buf} ${piece}` : piece
      if (abbrev(buf)) continue
      out.push(buf)
      buf = ''
    }
    if (buf) out.push(buf)
    return out
  }

  static firstSentence(text) {
    const sentences = PrerenderPages.splitSentences(PrerenderPages.plainText(text))
    return sentences[0] || ''
  }

  /**
   * A stored summary often ends in an ellipsis mid-sentence.
   * Keep the complete sentences and drop the cut tail. The JSON file is unchanged.
   */
  static finishedSummary(text) {
    const plain = PrerenderPages.plainText(text)
    if (!plain) return ''
    if (!/(?:\u2026|\.\.\.)\s*$/u.test(plain)) return plain
    const stripped = plain.replace(/\s*(?:\u2026|\.\.\.)\s*$/u, '').trim()
    const sentences = PrerenderPages.splitSentences(stripped).filter((sentence) =>
      /[.!?]["'”’)\]]*$/.test(sentence),
    )
    if (sentences.length) return sentences.join(' ')
    return stripped.replace(/[,:;]+$/g, '').trim()
  }

  static isoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : ''
  }

  /** publishedDate when the file has one; otherwise the story file's first git commit date. */
  static articleDates(story) {
    const published = PrerenderPages.isoDate(story.publishedDate) || PrerenderPages.isoDate(story.created)
    const modified = PrerenderPages.isoDate(story.lastmod) || published
    if (!published || !modified) {
      throw new Error(`prerender: ${story.slug} is missing datePublished or dateModified`)
    }
    return { published, modified }
  }

  /** History pin, or a tag that is itself a layer id. Otherwise the story has no layer page. */
  static storyLayer(story, layers) {
    const byId = new Map((layers || []).map((layer) => [layer.id, layer]))
    const tagged = (story.tags || []).find((tag) => byId.has(tag))
    if (tagged) return byId.get(tagged)
    if (story.historyId && byId.has('history')) return byId.get('history')
    return null
  }

  /** Drop a lead sentence already shown above the body. Later paragraphs stay intact. */
  static bodyWithoutLead(markdown, lead) {
    const trimmed = String(markdown || '').trim()
    if (!lead || !trimmed) return trimmed
    const paras = trimmed.split(/\n{2,}/)
    const firstFlat = paras[0].replace(/\s+/g, ' ').trim()
    if (firstFlat === lead) return paras.slice(1).join('\n\n').trim()
    if (firstFlat.startsWith(lead)) {
      const rest = firstFlat.slice(lead.length).replace(/^[\s,;:–—-]+/, '').trim()
      if (rest) paras[0] = rest
      else paras.shift()
      return paras.join('\n\n').trim()
    }
    return trimmed
  }

  /**
   * Meta description aimed at 150–160 characters when the source is longer.
   * Ends on a sentence, or on a word if the next sentence would pass 160.
   */
  static metaDescription(text) {
    const plain = PrerenderPages.plainText(text)
    if (!plain) return ''
    if (plain.length <= 160) return plain
    const sentences = PrerenderPages.splitSentences(plain)
    let acc = ''
    for (const sentence of sentences) {
      const next = acc ? `${acc} ${sentence}` : sentence
      if (next.length <= 160) {
        acc = next
        continue
      }
      break
    }
    if (acc.length >= 150 && acc.length <= 160) return acc
    const rest = plain.slice(acc.length).replace(/^\s+/, '')
    const words = rest.split(/\s+/).filter(Boolean)
    const room = 160 - (acc ? acc.length + 1 : 0)
    let extra = ''
    for (const word of words) {
      const trial = extra ? `${extra} ${word}` : word
      if (trial.length > room) break
      extra = trial
    }
    let combined = [acc, extra].filter(Boolean).join(' ').replace(/[,:;]+$/g, '').trim()
    if (combined.length >= 150 && combined.length <= 160) return combined
    if (combined.length > 160) {
      const cut = combined.slice(0, 160)
      const space = cut.lastIndexOf(' ')
      combined = (space > 0 ? cut.slice(0, space) : cut).replace(/[,:;]+$/g, '').trim()
    }
    if (plain.length > 160 && combined.length < 150) {
      const window = plain.slice(0, 160)
      let space = -1
      for (let i = window.length - 1; i >= 0; i--) {
        if (window[i] !== ' ') continue
        if (i >= 150 || space < 0) space = i
        if (i >= 150) break
      }
      if (space > 40) return window.slice(0, space).replace(/[,:;]+$/g, '').trim()
    }
    return combined || acc || plain.slice(0, 160).trim()
  }

  static photoAlt(photo, storyTitle) {
    const title = String(photo?.title || '').trim()
    if (title && !/\.(jpe?g|png|webp|gif)$/i.test(title) && !/^https?:/i.test(title)) return title
    const subject = String(storyTitle || '').trim()
    return subject ? `${subject} — historic photograph` : 'Historic Kentucky photograph'
  }

  /** Public map pin. Null pins stay off the page. Archaeological coordinates are already rounded. */
  static publicGeo(story) {
    if (story?.lat == null || story?.lon == null || story.lat === '' || story.lon === '') return null
    const lat = Number(story.lat)
    const lon = Number(story.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
    if (lat === 0 && lon === 0) return null
    return { lat, lon }
  }

  static jsonLdScript(nodes) {
    const data = { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) }
    const json = JSON.stringify(data).replace(/</g, '\\u003c')
    return `<script type="application/ld+json">${json}</script>`
  }

  static organizationNode() {
    return {
      '@type': 'Organization',
      '@id': PrerenderPages.ORG_ID,
      name: 'Kentucky History Drive',
      url: `${PrerenderPages.SITE}/`,
      email: PrerenderPages.CONTACT_EMAIL,
      logo: {
        '@type': 'ImageObject',
        url: PrerenderPages.LOGO,
      },
      contactPoint: {
        '@type': 'ContactPoint',
        email: PrerenderPages.CONTACT_EMAIL,
        contactType: 'customer support',
      },
      founder: {
        '@type': 'Person',
        name: 'Shannon Snowden',
        url: `${PrerenderPages.SITE}/about/`,
      },
    }
  }

  static publisherNode() {
    return { '@id': PrerenderPages.ORG_ID, email: PrerenderPages.CONTACT_EMAIL }
  }

  /** Newest commit date per file, and the first commit date (oldest) for datePublished. */
  static gitFileDates(root) {
    const lastmod = new Map()
    const created = new Map()
    try {
      const out = execFileSync('git', ['log', '--name-only', '--pretty=format:%cs'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
      let date = ''
      for (const line of out.split('\n')) {
        if (!line) continue
        if (/^\d{4}-\d{2}-\d{2}$/.test(line)) {
          date = line
          continue
        }
        if (!date) continue
        if (!lastmod.has(line)) lastmod.set(line, date)
        created.set(line, date)
      }
    } catch (err) {
      console.warn(`prerender: git dates unavailable (${err.message})`)
    }
    return { lastmod, created }
  }

  static laterDate(a, b) {
    if (a && b) return a > b ? a : b
    return a || b || ''
  }

  static storyLastmod(story, dates) {
    const git = dates.get(`public/content/stories/${story.slug}.json`) || ''
    const published = /^\d{4}-\d{2}-\d{2}$/.test(story.publishedDate || '') ? story.publishedDate : ''
    return PrerenderPages.laterDate(git, published)
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
      publishedDate: body.publishedDate || body.briefDate || indexRow?.publishedDate || '',
      territoryNation: body.territory?.nation || '',
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

  static storyCreditHtml(photo, title, { priority = false } = {}) {
    if (!photo?.image_url) return ''
    const caption = PrerenderPages.escapeHtml(PrerenderPages.photoAlt(photo, title))
    const sourceLabel = PrerenderPages.escapeHtml(photo.source_label || photo.credit || '')
    const attribution = PrerenderPages.escapeHtml(photo.attribution || photo.source_label || photo.credit || '')
    const year = photo.year ? ` <span class="muted">(${PrerenderPages.escapeHtml(String(photo.year))})</span>` : ''
    const href = PrerenderPages.escapeHtml(photo.source_url || photo.image_url)
    const img = PrerenderPages.escapeHtml(photo.image_url)
    const linkLabel = PrerenderPages.escapeHtml(
      `Open ${photo.source_label || photo.credit || 'photo source'}: ${photo.title || title || 'story photo'} (opens in a new tab)`,
    )
    const imgAttrs = priority
      ? 'fetchpriority="high" loading="eager" data-lcp="story-photo"'
      : 'loading="lazy"'
    return `<aside class="story-sidebar-photo" aria-label="Story photo">
      <p class="story-sidebar-photo-heading">Photos</p>
      <a class="story-sidebar-photo-frame" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${linkLabel}">
        <img src="${img}" alt="${caption}" ${imgAttrs} />
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

  static imageType(url) {
    const path = String(url || '').split('?')[0].toLowerCase()
    if (path.endsWith('.png')) return 'image/png'
    if (path.endsWith('.webp')) return 'image/webp'
    if (path.endsWith('.gif')) return 'image/gif'
    return 'image/jpeg'
  }

  /** Menu and theme toggle for the shared header on pages that are not the SPA. */
  static siteChromeScript() {
    return siteChromeScriptHtml()
  }

  /** Same header as the homepage. Search and Today’s stories link back; the menu is a few lines of script. */
  static siteHeader(activeRoute = '') {
    return siteHeaderHtml(activeRoute)
  }

  static shell({ title, description, canonical, cssHrefs, image, imageAlt, main, jsonLd = '', ogType = 'article', activeRoute = '' }) {
    const t = PrerenderPages.escapeHtml(title)
    const d = PrerenderPages.escapeHtml(description)
    const c = PrerenderPages.escapeHtml(canonical)
    const imgUrl = image || PrerenderPages.LOGO
    const large = Boolean(image) && image !== PrerenderPages.LOGO
    const altText = imageAlt || 'Kentucky History Drive official seal'
    const img = `<meta property="og:image" content="${PrerenderPages.escapeHtml(imgUrl)}" />
    <meta property="og:image:secure_url" content="${PrerenderPages.escapeHtml(imgUrl)}" />
    <meta property="og:image:type" content="${PrerenderPages.imageType(imgUrl)}" />
    <meta property="og:image:alt" content="${PrerenderPages.escapeHtml(altText)}" />
    <meta name="twitter:image" content="${PrerenderPages.escapeHtml(imgUrl)}" />
    <meta name="twitter:image:alt" content="${PrerenderPages.escapeHtml(altText)}" />
    <meta name="twitter:card" content="${large ? 'summary_large_image' : 'summary'}" />`
    return `<!DOCTYPE html>
<html lang="en" data-hp-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- Header seal rotation: pick before first paint (see #brandLogo). -->
    ${sealRotationScriptHtml()}
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${c}" />
    <meta property="og:type" content="${PrerenderPages.escapeHtml(ogType)}" />
    <meta property="og:site_name" content="Kentucky History Drive" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:url" content="${c}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    ${img}
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    ${gtagHeadHtml()}
    ${jsonLd}
    ${cssHrefs.map((href) => `<link rel="stylesheet" href="${PrerenderPages.escapeHtml(href)}" />`).join('\n    ')}
    <style>
      .static-read { max-width: 52rem; margin: 0 auto; padding: 1.25rem 1.25rem 3rem; }
      .static-kicker { margin: 0 0 0.35rem; color: var(--accent); font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
      .story-head h1 { color: var(--heading); font-size: clamp(1.7rem, 4vw, 2.45rem); line-height: 1.15; margin: 0.35rem 0 0.75rem; }
      .story-lead { font-size: 1.125rem; line-height: 1.5; margin: 0 0 1rem; }
      .story-crumbs { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin: 0 0 0.85rem; font-size: 0.85rem; color: var(--muted); }
      .story-crumbs a { color: var(--accent); text-decoration: none; }
      .story-crumbs [aria-current="page"] { color: var(--text); }
      .static-related { margin-top: 1.75rem; }
      .static-related h2 { font-size: 1.2rem; margin: 0 0 0.55rem; color: var(--heading); }
      .static-related ul { list-style: none; margin: 0; padding: 0; }
      .static-related li { margin: 0 0 0.45rem; }
      .static-cta { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1.25rem 0; }
      .place-list { columns: 2; gap: 1.5rem; padding: 0; margin: 0.5rem 0 0; list-style: none; }
      .place-list li { break-inside: avoid; margin: 0 0 0.45rem; }
      .foot a { color: var(--accent); }
      @media (max-width: 700px) { .place-list { columns: 1; } }
    </style>
    <script>
      (function () {
        try {
          var stored = localStorage.getItem('khd-theme') || localStorage.getItem('khd-home-preview-theme')
          if (stored === 'light' || stored === 'dark') {
            document.documentElement.setAttribute('data-hp-theme', stored)
            return
          }
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.documentElement.setAttribute('data-hp-theme', 'light')
          }
        } catch (e) {}
      })()
    </script>
  </head>
  <body>
    ${PrerenderPages.siteHeader(activeRoute)}
    <main id="content" class="static-read" tabindex="-1">
      ${main}
    </main>
    <footer class="foot">
      <span>kyhistorydrive.com</span>
      <a href="/about/">About</a>
      <a href="/videos/">Videos</a>
      <a href="/privacy/">Privacy</a>
      ${privacyChoicesLinkHtml()}
      <span>Data © Kentucky Historical Society (public markers) · Map © OpenStreetMap contributors</span>
    </footer>
    ${deferredAdsenseLoaderHtml()}
    ${privacyChoicesBootHtml()}
    ${PrerenderPages.siteChromeScript()}
  </body>
</html>
`
  }

  /** Same era, county, or subject layer (shared tag or territory). Three to five stories. */
  static relatedStories(story, all) {
    const generic = new Set(['kentucky', 'other', 'prehistoric', 'native', 'frontier', 'early-commonwealth', story.era])
    const tags = new Set((story.tags || []).filter((tag) => tag && !generic.has(tag)))
    const ranked = []
    for (const other of all) {
      if (!other || other.slug === story.slug) continue
      let score = 0
      if (story.era && other.era === story.era) score += 3
      if (story.county && other.county && other.county === story.county) score += 4
      if (story.territoryNation && other.territoryNation && other.territoryNation === story.territoryNation) score += 3
      const shared = (other.tags || []).filter((tag) => tags.has(tag)).length
      if (shared) score += Math.min(4, shared * 2)
      if (score > 0) ranked.push({ other, score })
    }
    ranked.sort((a, b) => b.score - a.score || a.other.title.localeCompare(b.other.title))
    const picked = []
    const seen = new Set()
    const take = (item) => {
      if (!item || seen.has(item.slug) || picked.length >= 5) return
      seen.add(item.slug)
      picked.push(item)
    }
    for (const row of ranked) take(row.other)
    if (picked.length < 3) {
      for (const other of all) {
        if (other.era === story.era) take(other)
        if (picked.length >= 3) break
      }
    }
    if (picked.length < 3) {
      for (const other of all) {
        take(other)
        if (picked.length >= 3) break
      }
    }
    return picked.slice(0, 5)
  }

  static relatedHtml(story, all) {
    const related = PrerenderPages.relatedStories(story, all)
    const items = related
      .map((other) => {
        const bits = [
          other.county ? PrerenderPages.countyLabel(other.county, true) : '',
          PrerenderPages.formatYearRange(other.yearStart, other.yearEnd),
        ].filter(Boolean)
        const extra = bits.length ? ` <span class="muted">${PrerenderPages.escapeHtml(bits.join(' · '))}</span>` : ''
        return `<li><a href="/stories/${other.slug}/">${PrerenderPages.escapeHtml(other.title)}</a>${extra}</li>`
      })
      .join('')
    return `<nav class="static-related" aria-label="Related stories"><h2>Related stories</h2><ul>${items}</ul></nav>`
  }

  static storyJsonLd(story, description, image, imageAlt, layer) {
    const canonical = `${PrerenderPages.SITE}/stories/${story.slug}/`
    const geo = PrerenderPages.publicGeo(story)
    const placeName = story.matchedPlace || story.title
    const placeId = `${canonical}#place`
    const place = {
      '@type': 'Place',
      '@id': placeId,
      name: placeName,
    }
    if (story.county) {
      place.containedInPlace = {
        '@type': 'AdministrativeArea',
        name: `${PrerenderPages.countyLabel(story.county, true)}, Kentucky`,
      }
    }
    if (geo) {
      place.geo = { '@type': 'GeoCoordinates', latitude: geo.lat, longitude: geo.lon }
    }
    const dates = PrerenderPages.articleDates(story)
    const article = {
      '@type': 'Article',
      headline: story.title,
      description,
      mainEntityOfPage: canonical,
      url: canonical,
      image: [image || PrerenderPages.LOGO],
      datePublished: dates.published,
      dateModified: dates.modified,
      author: { '@type': 'Person', name: 'Shannon Snowden', url: `${PrerenderPages.SITE}/about/` },
      publisher: PrerenderPages.publisherNode(),
      contentLocation: { '@id': placeId },
    }
    const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` }]
    if (layer?.id && layer.label) {
      crumbs.push({
        '@type': 'ListItem',
        position: 2,
        name: layer.label,
        item: `${PrerenderPages.SITE}/layers/${layer.id}/`,
      })
    }
    crumbs.push({
      '@type': 'ListItem',
      position: crumbs.length + 1,
      name: story.title,
      item: canonical,
    })
    const film = filmForStory(story.slug)
    const filmDescription = film ? filmDescriptionFromPlain(PrerenderPages.plainText(story.bodyMarkdown)) : ''
    const video = film
      ? videoObjectNode({
          film,
          description: filmDescription,
          pageUrl: canonical,
          orgId: PrerenderPages.ORG_ID,
        })
      : null
    return PrerenderPages.jsonLdScript([
      PrerenderPages.organizationNode(),
      article,
      place,
      { '@type': 'BreadcrumbList', itemListElement: crumbs },
      video,
    ])
  }

  static crumbHtml(story, layer) {
    const bits = [`<a href="/">Home</a>`]
    if (layer?.id && layer.label) {
      bits.push(`<a href="/layers/${layer.id}/">${PrerenderPages.escapeHtml(layer.label)}</a>`)
    }
    bits.push(`<span aria-current="page">${PrerenderPages.escapeHtml(story.title)}</span>`)
    return `<nav class="story-crumbs" aria-label="Breadcrumb">${bits
      .map((bit, i) => (i === 0 ? bit : `<span aria-hidden="true">/</span>${bit}`))
      .join('')}</nav>`
  }

  static storyPage(story, all, cssHrefs, layers) {
    const title = `${story.title} · Kentucky History Drive`
    const bodyPlain = PrerenderPages.plainText(story.bodyMarkdown)
    const summary = PrerenderPages.finishedSummary(story.summary)
    const description = PrerenderPages.metaDescription(bodyPlain || summary)
    const canonical = `${PrerenderPages.SITE}/stories/${story.slug}/`
    const years = PrerenderPages.formatYearRange(story.yearStart, story.yearEnd)
    const county = story.county ? PrerenderPages.countyLabel(story.county, true) : ''
    const metaBits = [county, PrerenderPages.eraLabel(story.era), years].filter(Boolean)
    const layer = PrerenderPages.storyLayer(story, layers)
    const lead =
      PrerenderPages.firstSentence(story.bodyMarkdown) ||
      PrerenderPages.firstSentence(summary) ||
      story.title
    const bodyMarkdown = PrerenderPages.bodyWithoutLead(
      PrerenderPages.stripSourceAttribution(story.bodyMarkdown || ''),
      lead,
    )
    const mapHref = PrerenderPages.storyMapHref(story)
    const appHref = `/#timeline/${encodeURIComponent(story.slug)}`
    const photo = story.photo?.image_url ? story.photo : null
    const image = photo ? PrerenderPages.photoAbsolute(photo.image_url) : PrerenderPages.LOGO
    const imageAlt = photo ? PrerenderPages.photoAlt(photo, story.title) : 'Kentucky History Drive official seal'
    const film = filmForStory(story.slug)
    const filmDescription = film ? filmDescriptionFromPlain(bodyPlain) : ''
    const filmHtml = film
      ? filmPlayerHtml(film, {
          summary: filmDescription,
          headingLevel: 2,
          moreHtml: '<a href="/videos/">All videos</a>',
        })
      : ''
    const main = `<article class="story-reader-layout static-story${film ? ' has-film' : ''}">
        <div class="story-intro">
          ${PrerenderPages.crumbHtml(story, layer)}
          <header class="story-head">
            <p class="static-kicker">Timeline story</p>
            <p class="story-card-meta">${metaBits.map((bit) => `<span>${PrerenderPages.escapeHtml(bit)}</span>`).join(' · ')}</p>
            <h1>${PrerenderPages.escapeHtml(story.title)}</h1>
            ${lead ? `<p class="story-lead">${PrerenderPages.escapeHtml(lead)}</p>` : ''}
          </header>
        </div>
        ${PrerenderPages.storyCreditHtml(photo, story.title, { priority: Boolean(film) })}
        <div class="story-reader-main">
          <div class="story-body">${marked.parse(bodyMarkdown)}</div>
          ${PrerenderPages.learnMoreHtml(story.bodyMarkdown)}
          ${filmHtml}
          ${PrerenderPages.relatedHtml(story, all)}
          <div class="static-cta">
            <a class="btn" href="${PrerenderPages.escapeHtml(appHref)}">Open this story on the timeline</a>
            ${mapHref ? `<a class="btn ghost" href="${PrerenderPages.escapeHtml(mapHref)}">Open on the map</a>` : ''}
          </div>
        </div>
      </article>`
    return PrerenderPages.shell({
      title,
      description,
      canonical,
      cssHrefs,
      image,
      imageAlt,
      jsonLd: PrerenderPages.storyJsonLd(story, description, image, imageAlt, layer),
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
    if (/\/src\/main\.js|maplibre-gl|maplibregl-/i.test(html)) {
      throw new Error(`prerender: ${urlPath} pulled in the app bundle`)
    }
    if (!html.includes('adsbygoogle.js?client=ca-pub-8587137224654033')) {
      throw new Error(`prerender: ${urlPath} is missing the AdSense head tag`)
    }
    const gaProblems = missingGaSnippet(html)
    if (gaProblems.length) {
      throw new Error(`prerender: ${urlPath} ${gaProblems.join('; ')} (${GA_MEASUREMENT_ID})`)
    }
    if (!html.includes('class="top site-header"') || !html.includes('iPhone app (coming soon)') || !html.includes('id="navMenuToggle"')) {
      throw new Error(`prerender: ${urlPath} is missing the shared homepage header`)
    }
    if (!html.includes('src="/brand/khd-logo.png"') || !html.includes("var B='/brand/'")) {
      throw new Error(`prerender: ${urlPath} seal path is not root-absolute`)
    }
    if (/src="brand\/khd-logo/.test(html)) {
      throw new Error(`prerender: ${urlPath} seal path is relative and would 404 on a subpage`)
    }
    if (html.includes('KY Markers Drive iPhone app')) {
      throw new Error(`prerender: ${urlPath} uses an unconfirmed app name`)
    }
    // Place JSON-LD may repeat the public pin. Anything tighter than that pin is rejected.
    let scrubbed = html
    for (const value of [story.lat, story.lon]) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue
      scrubbed = scrubbed.split(String(value)).join('').split(JSON.stringify(value)).join('')
    }
    if (/-?\d{1,3}\.\d{5,}/.test(scrubbed)) {
      throw new Error(`prerender: ${urlPath} includes a precise coordinate`)
    }
  }

  static assertStory(html, story, description) {
    const urlPath = `/stories/${story.slug}/`
    if (description.length > 160) {
      throw new Error(`prerender: ${urlPath} description is ${description.length} characters`)
    }
    if (!html.includes('class="story-lead"')) throw new Error(`prerender: ${urlPath} is missing a lead sentence`)
    const related = html.match(/<nav class="static-related"[\s\S]*?<\/nav>/)
    const relatedCount = related ? (related[0].match(/href="\/stories\//g) || []).length : 0
    if (relatedCount < 3 || relatedCount > 5) {
      throw new Error(`prerender: ${urlPath} has ${relatedCount} related story links`)
    }
    let data
    const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    if (!block) throw new Error(`prerender: ${urlPath} is missing JSON-LD`)
    try {
      data = JSON.parse(block[1])
    } catch (err) {
      throw new Error(`prerender: ${urlPath} has invalid JSON-LD (${err.message})`)
    }
    const nodes = data['@graph'] || [data]
    for (const type of ['Article', 'Place', 'BreadcrumbList', 'Organization']) {
      if (!nodes.some((node) => node['@type'] === type)) {
        throw new Error(`prerender: ${urlPath} JSON-LD is missing ${type}`)
      }
    }
    const place = nodes.find((node) => node['@type'] === 'Place')
    const article = nodes.find((node) => node['@type'] === 'Article')
    const crumbs = nodes.find((node) => node['@type'] === 'BreadcrumbList')
    const placeId = `${PrerenderPages.SITE}${urlPath}#place`
    if (nodes.filter((node) => node['@type'] === 'Place').length !== 1) {
      throw new Error(`prerender: ${urlPath} Place is repeated`)
    }
    if (place?.['@id'] !== placeId) throw new Error(`prerender: ${urlPath} Place is missing @id`)
    if (article?.contentLocation?.['@id'] !== placeId || article.contentLocation.name) {
      throw new Error(`prerender: ${urlPath} contentLocation is not a Place @id`)
    }
    if (!PrerenderPages.isoDate(article?.datePublished) || !PrerenderPages.isoDate(article?.dateModified)) {
      throw new Error(`prerender: ${urlPath} Article is missing datePublished or dateModified`)
    }
    const items = crumbs?.itemListElement || []
    if (items.some((item) => String(item.item || '').includes('/#timeline'))) {
      throw new Error(`prerender: ${urlPath} breadcrumb points at the homepage hash`)
    }
    if (items.length < 2 || items.length > 3 || items[0]?.item !== `${PrerenderPages.SITE}/`) {
      throw new Error(`prerender: ${urlPath} breadcrumb has ${items.length} levels`)
    }
    if (items.length === 3 && !String(items[1]?.item || '').includes('/layers/')) {
      throw new Error(`prerender: ${urlPath} breadcrumb level 2 is not a layer page`)
    }
    if (items.at(-1)?.item !== `${PrerenderPages.SITE}${urlPath}`) {
      throw new Error(`prerender: ${urlPath} breadcrumb does not end on the story`)
    }
    if (html.includes('href="/#timeline">Stories')) {
      throw new Error(`prerender: ${urlPath} visible breadcrumb still uses the timeline hash`)
    }
    const geo = PrerenderPages.publicGeo(story)
    if (geo) {
      if (place?.geo?.['@type'] !== 'GeoCoordinates') {
        throw new Error(`prerender: ${urlPath} Place is missing geo coordinates`)
      }
      if (place.geo.latitude !== geo.lat || place.geo.longitude !== geo.lon) {
        throw new Error(`prerender: ${urlPath} geo does not match the public pin`)
      }
    } else if (place?.geo) {
      throw new Error(`prerender: ${urlPath} has geo without a public pin`)
    }
    const photo = story.photo?.image_url ? PrerenderPages.photoAbsolute(story.photo.image_url) : ''
    const expectedImage = photo || PrerenderPages.LOGO
    if (!html.includes(`property="og:image" content="${PrerenderPages.escapeHtml(expectedImage)}"`)) {
      throw new Error(`prerender: ${urlPath} og:image is not the story photo or logo fallback`)
    }
    if (!html.includes(`name="twitter:image" content="${PrerenderPages.escapeHtml(expectedImage)}"`)) {
      throw new Error(`prerender: ${urlPath} twitter:image is missing`)
    }
    if (photo) {
      const alt = PrerenderPages.photoAlt(story.photo, story.title)
      if (!alt || alt === 'Kentucky History Drive logo') {
        throw new Error(`prerender: ${urlPath} photo alt is empty`)
      }
      if (!html.includes(`alt="${PrerenderPages.escapeHtml(alt)}"`)) {
        throw new Error(`prerender: ${urlPath} in-page photo alt does not match`)
      }
      if (html.includes('property="og:image" content="' + PrerenderPages.LOGO + '"')) {
        throw new Error(`prerender: ${urlPath} used the logo instead of the story photo`)
      }
    }
    const film = filmForStory(story.slug)
    if (!film) return
    const filmDescription = filmDescriptionFromPlain(PrerenderPages.plainText(story.bodyMarkdown))
    PrerenderPages.assertFilmEmbed(html, film, filmDescription, urlPath)
    if (story.photo?.image_url) {
      if (!html.includes('data-lcp="story-photo"') || !html.includes('fetchpriority="high"') || !html.includes('loading="eager"')) {
        throw new Error(`prerender: ${urlPath} story photo is not the priority image`)
      }
      if (/data-lcp="story-photo"[^>]*loading="lazy"|loading="lazy"[^>]*data-lcp="story-photo"/.test(html)) {
        throw new Error(`prerender: ${urlPath} story photo is lazy-loaded`)
      }
    }
    const posterPreload = new RegExp(`rel="preload"[^>]*${film.poster.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    if (posterPreload.test(html)) {
      throw new Error(`prerender: ${urlPath} preloads the video poster`)
    }
  }

  static filmPlain(story) {
    return filmDescriptionFromPlain(PrerenderPages.plainText(story.bodyMarkdown))
  }

  static videosPage(films, stories, cssHrefs) {
    const pageUrl = `${PrerenderPages.SITE}/videos/`
    const cards = []
    const videoNodes = []
    for (const film of films) {
      const story = stories.find((item) => item.slug === film.storySlug)
      if (!story) {
        throw new Error(`prerender: no story for film "${film.title}" (${film.storySlug})`)
      }
      const description = PrerenderPages.filmPlain(story)
      if (!description) throw new Error(`prerender: film ${film.id} has no story description`)
      videoNodes.push(
        videoObjectNode({
          film,
          description,
          pageUrl,
          orgId: PrerenderPages.ORG_ID,
        }),
      )
      const more = `<a href="/stories/${story.slug}/">Read the story: ${PrerenderPages.escapeHtml(story.title)}</a>`
      cards.push(filmPlayerHtml(film, { summary: description, headingLevel: 2, moreHtml: more }))
    }
    const lead = 'Films published by Kentucky History Drive.'
    const description = PrerenderPages.metaDescription(
      films.length ? PrerenderPages.filmPlain(stories.find((item) => item.slug === films[0].storySlug)) : lead,
    )
    const image = films[0]?.poster || PrerenderPages.LOGO
    const main = `<article>
        <nav class="story-crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Videos</span>
        </nav>
        <header class="story-head">
          <p class="static-kicker">Videos</p>
          <h1>Videos</h1>
          <p class="story-lead">${PrerenderPages.escapeHtml(lead)}</p>
        </header>
        <div class="film-list">
          ${cards.join('\n') || '<p>No films yet.</p>'}
        </div>
      </article>`
    const list = films.length
      ? {
          '@type': 'ItemList',
          itemListElement: films.map((film, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: film.title,
            url: `${pageUrl}#${film.id}`,
          })),
        }
      : null
    const jsonLd = PrerenderPages.jsonLdScript([
      PrerenderPages.organizationNode(),
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Videos',
        description,
        isPartOf: { '@type': 'WebSite', name: 'Kentucky History Drive', url: `${PrerenderPages.SITE}/` },
        publisher: { '@id': PrerenderPages.ORG_ID },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Videos', item: pageUrl },
        ],
      },
      list,
      ...videoNodes,
    ])
    return PrerenderPages.shell({
      title: 'Videos · Kentucky History Drive',
      description,
      canonical: pageUrl,
      cssHrefs,
      image,
      imageAlt: films[0]?.title || 'Kentucky History Drive official seal',
      ogType: 'website',
      jsonLd,
      main,
    })
  }

  static assertFilmEmbed(html, film, description, urlPath) {
    if (!description) throw new Error(`prerender: ${urlPath} film is missing a story summary`)
    if (!html.includes(PrerenderPages.escapeHtml(description))) {
      throw new Error(`prerender: ${urlPath} is missing the visible film summary`)
    }
    if (!html.includes(PrerenderPages.escapeHtml(film.credit))) {
      throw new Error(`prerender: ${urlPath} is missing the film credit`)
    }
    if (!html.includes(PrerenderPages.escapeHtml(film.title))) {
      throw new Error(`prerender: ${urlPath} is missing the film title`)
    }
    const videoTags = [...html.matchAll(/<video\b[^>]*>/gi)].map((match) => match[0])
    const tag = videoTags.find((item) => item.includes(`poster="${film.poster}"`))
    if (!tag) throw new Error(`prerender: ${urlPath} is missing a video element`)
    if (!/controls/.test(tag) || !/playsinline/.test(tag) || !/crossorigin="anonymous"/.test(tag)) {
      throw new Error(`prerender: ${urlPath} video is missing controls, playsinline, or crossorigin`)
    }
    if (!/preload="metadata"/.test(tag)) throw new Error(`prerender: ${urlPath} video preload is not metadata`)
    if (/autoplay/i.test(tag)) throw new Error(`prerender: ${urlPath} video autoplays`)
    if (!tag.includes(`poster="${film.poster}"`)) throw new Error(`prerender: ${urlPath} video poster does not match`)
    if (!html.includes(`<source src="${film.src}" type="video/mp4">`)) {
      throw new Error(`prerender: ${urlPath} is missing the mp4 source`)
    }
    const track = html.match(/<track\b[^>]*>/i)
    if (!track || !/kind="subtitles"/.test(track[0]) || !/srclang="en"/.test(track[0]) || !/label="English"/.test(track[0]) || !/\bdefault\b/.test(track[0])) {
      throw new Error(`prerender: ${urlPath} is missing the default English captions track`)
    }
    if (!html.includes(`src="${film.captions}"`)) throw new Error(`prerender: ${urlPath} captions src does not match`)
    if (!film.useVertical && film.verticalSrc && html.includes(film.verticalSrc)) {
      throw new Error(`prerender: ${urlPath} includes the vertical cut that was skipped`)
    }
    if (!html.includes('class="film-frame"')) throw new Error(`prerender: ${urlPath} is missing the aspect-ratio frame`)
    let data
    const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    if (!block) throw new Error(`prerender: ${urlPath} is missing JSON-LD`)
    try {
      data = JSON.parse(block[1])
    } catch (err) {
      throw new Error(`prerender: ${urlPath} has invalid JSON-LD (${err.message})`)
    }
    const nodes = data['@graph'] || [data]
    const videoNode = nodes.find((node) => node['@type'] === 'VideoObject' && node.name === film.title)
    if (!videoNode) throw new Error(`prerender: ${urlPath} JSON-LD is missing VideoObject`)
    if (videoNode.description !== description) throw new Error(`prerender: ${urlPath} VideoObject description does not match the story text`)
    if (videoNode.thumbnailUrl !== film.poster) throw new Error(`prerender: ${urlPath} VideoObject thumbnailUrl is not the poster`)
    if (videoNode.contentUrl !== film.src) throw new Error(`prerender: ${urlPath} VideoObject contentUrl is not the mp4`)
    if (videoNode.uploadDate !== film.uploadDate) throw new Error(`prerender: ${urlPath} VideoObject uploadDate is wrong`)
    if (videoNode.duration !== film.duration) throw new Error(`prerender: ${urlPath} VideoObject duration is wrong`)
    if (videoNode.creator?.['@type'] !== 'Person' || videoNode.creator?.name !== film.creator) {
      throw new Error(`prerender: ${urlPath} VideoObject creator is wrong`)
    }
    if (videoNode.director?.['@type'] !== 'Person' || videoNode.director?.name !== film.director) {
      throw new Error(`prerender: ${urlPath} VideoObject director is wrong`)
    }
    if (videoNode.publisher?.['@id'] !== PrerenderPages.ORG_ID) {
      throw new Error(`prerender: ${urlPath} VideoObject publisher is not the site Organization`)
    }
    const captionUrl = typeof videoNode.caption === 'string' ? videoNode.caption : videoNode.caption?.contentUrl
    if (captionUrl !== film.captions) throw new Error(`prerender: ${urlPath} VideoObject caption does not point at the VTT`)
    if (!nodes.some((node) => node['@type'] === 'Organization' && node['@id'] === PrerenderPages.ORG_ID)) {
      throw new Error(`prerender: ${urlPath} is missing the Organization node`)
    }
  }

  static assertVideos(html, films, stories) {
    if (!html.includes('<h1>Videos</h1>')) throw new Error('prerender: /videos/ is missing its heading')
    if (!html.includes('href="/videos/"')) throw new Error('prerender: /videos/ footer link is missing')
    for (const film of films) {
      const story = stories.find((item) => item.slug === film.storySlug)
      PrerenderPages.assertFilmEmbed(html, film, PrerenderPages.filmPlain(story), '/videos/')
      if (!html.includes(`href="/stories/${story.slug}/"`)) {
        throw new Error(`prerender: /videos/ does not link to ${story.slug}`)
      }
    }
  }

  /** Google video sitemap for each page that embeds a film. */
  static writeVideoSitemap(file, films, stories) {
    const rows = []
    for (const film of films) {
      const story = stories.find((item) => item.slug === film.storySlug)
      const description = PrerenderPages.escapeXml(PrerenderPages.filmPlain(story))
      const pages = [`${PrerenderPages.SITE}/videos/`, `${PrerenderPages.SITE}/stories/${story.slug}/`]
      for (const loc of pages) {
        rows.push(`  <url>
    <loc>${PrerenderPages.escapeXml(loc)}</loc>
    <video:video>
      <video:thumbnail_loc>${PrerenderPages.escapeXml(film.poster)}</video:thumbnail_loc>
      <video:title>${PrerenderPages.escapeXml(film.title)}</video:title>
      <video:description>${description}</video:description>
      <video:content_loc>${PrerenderPages.escapeXml(film.src)}</video:content_loc>
      <video:duration>${Number(film.durationSeconds)}</video:duration>
      <video:publication_date>${PrerenderPages.escapeXml(film.uploadDate)}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
    </video:video>
  </url>`)
      }
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${rows.join('\n')}
</urlset>
`
    fs.writeFileSync(file, xml)
  }

  static aboutPage(cssHrefs) {
    const description =
      'Kentucky History Drive is published by Shannon Snowden. It maps Kentucky Historical Society markers and publishes a timeline of Kentucky history stories.'
    const main = `<article>
        <nav class="story-crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">About</span>
        </nav>
        <header class="story-head">
          <p class="static-kicker">About</p>
          <h1>Kentucky History Drive</h1>
          <p class="story-lead">Shannon Snowden writes the stories, and Kentucky History Drive publishes them with a map of Kentucky Historical Society markers.</p>
        </header>
        <div class="about-logo-block">
          <img class="about-logo" src="/brand/khd-logo-512.png" width="360" height="360" alt="Kentucky History Drive seal — muskets, historical marker, and road to kyhistorydrive.com" />
          <p class="about-logo-caption muted">Official Kentucky History Drive seal</p>
        </div>
        <h2>Publisher</h2>
        <p>Kentucky History Drive (kyhistorydrive.com) is the publisher of this site: the marker map, the timeline, and the story pages. An iPhone app is coming soon.</p>
        <h2>Author</h2>
        <p>Shannon Snowden is the author of the Kentucky history stories on this site. Each story is written for Kentucky History Drive and tied to a place, a year, or a map layer when the sources support it.</p>
        <p>Kentucky History Drive helps you explore Kentucky’s historical highway markers on a map, and browse Kentucky history stories on a timeline by era and year.</p>
        <h2>Credits</h2>
        <ul class="about-credits">
          <li>Marker text and locations: Kentucky Historical Society / <a href="https://history.ky.gov/markers" target="_blank" rel="noopener">history.ky.gov</a></li>
          <li>Map rendering: <a href="https://maplibre.org/" target="_blank" rel="noopener">MapLibre GL JS</a></li>
          <li>Basemap tiles: <a href="https://carto.com/basemaps/" target="_blank" rel="noopener">CARTO</a> Voyager (OpenStreetMap data)</li>
          <li>Map data: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors</li>
          <li>State outline: Natural Earth</li>
          <li>Stories: Shannon Snowden for Kentucky History Drive</li>
          <li>Layer places (history, museums, parks, and more): Kentucky History Drive project data</li>
        </ul>
        <h2>Contact</h2>
        <p>Questions, corrections or photo suggestions: <a href="mailto:${PrerenderPages.CONTACT_EMAIL}">${PrerenderPages.CONTACT_EMAIL}</a></p>
        <div class="static-cta">
          <a class="btn" href="/">Home</a>
          <a class="btn ghost" href="/#map">Open the map</a>
          <a class="btn ghost" href="/#timeline">Open the timeline</a>
        </div>
      </article>`
    const jsonLd = PrerenderPages.jsonLdScript([
      PrerenderPages.organizationNode(),
      {
        '@type': 'AboutPage',
        '@id': `${PrerenderPages.SITE}/about/#webpage`,
        url: `${PrerenderPages.SITE}/about/`,
        name: 'About Kentucky History Drive',
        description,
        isPartOf: { '@type': 'WebSite', name: 'Kentucky History Drive', url: `${PrerenderPages.SITE}/` },
        about: { '@id': PrerenderPages.ORG_ID },
        publisher: PrerenderPages.publisherNode(),
        author: { '@type': 'Person', name: 'Shannon Snowden', url: `${PrerenderPages.SITE}/about/` },
      },
    ])
    return PrerenderPages.shell({
      title: 'About · Kentucky History Drive',
      description,
      canonical: `${PrerenderPages.SITE}/about/`,
      cssHrefs,
      image: PrerenderPages.LOGO,
      imageAlt: 'Kentucky History Drive official seal',
      ogType: 'website',
      jsonLd,
      main,
      activeRoute: 'about',
    })
  }

  /** Crawlable story and layer links in the built homepage, without replacing the hash app. */
  static injectHome(file, stories, layers) {
    let html = fs.readFileSync(file, 'utf8')
    const storyLinks = stories
      .map((story) => `<li><a href="/stories/${story.slug}/">${PrerenderPages.escapeHtml(story.title)}</a></li>`)
      .join('')
    const layerLinks = layers
      .map((layer) => `<li><a href="/layers/${layer.id}/">${PrerenderPages.escapeHtml(layer.label)}</a></li>`)
      .join('')
    const nav = `<nav id="crawlDirectory" class="crawl-directory" aria-label="Stories and map layers">
        <details>
          <summary>All stories and map layers</summary>
          <div class="crawl-directory-groups">
            <section>
              <h2>Stories</h2>
              <ul class="crawl-list">${storyLinks}</ul>
            </section>
            <section>
              <h2>Map layers</h2>
              <ul class="crawl-list">${layerLinks}</ul>
            </section>
            <p><a href="/videos/">Videos</a> · <a href="/about/">About Kentucky History Drive</a></p>
          </div>
        </details>
      </nav>`
    if (!html.includes('id="crawlDirectory"')) {
      throw new Error('prerender: dist/index.html is missing #crawlDirectory')
    }
    html = html.replace(/<nav id="crawlDirectory"[\s\S]*?<\/nav>/, nav)
    if (!html.includes('adsbygoogle.js?client=ca-pub-8587137224654033')) {
      throw new Error('prerender: homepage is missing the AdSense head tag')
    }
    const gaProblems = missingGaSnippet(html)
    if (gaProblems.length) {
      throw new Error(`prerender: homepage ${gaProblems.join('; ')} (${GA_MEASUREMENT_ID})`)
    }
    if (!/<script type="module"/.test(html)) throw new Error('prerender: homepage lost the app bundle')
    if (!html.includes('"@type": "Organization"') && !html.includes('"@type":"Organization"')) {
      throw new Error('prerender: homepage is missing Organization JSON-LD')
    }
    const storyHrefs = (html.match(/href="\/stories\/[a-z0-9-]+\/"/g) || []).length
    const layerHrefs = (html.match(/href="\/layers\/[a-z0-9-]+\/"/g) || []).length
    if (storyHrefs < stories.length) throw new Error(`prerender: homepage has ${storyHrefs} story links, expected ${stories.length}`)
    if (layerHrefs < layers.length) throw new Error(`prerender: homepage has ${layerHrefs} layer links, expected ${layers.length}`)
    fs.writeFileSync(file, html)
  }

  static writePage(dist, urlPath, html) {
    const dir = path.join(dist, urlPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), html)
  }

  /** Home, about, stories, layers, then /privacy/ last. Each URL gets its own lastmod. */
  static updateSitemap(file, entries) {
    if (!entries.length || !String(entries[entries.length - 1].loc).endsWith('/privacy/')) {
      throw new Error('prerender: sitemap must end with /privacy/')
    }
    const seen = new Set()
    const rows = []
    for (const entry of entries) {
      if (!entry?.loc || seen.has(entry.loc)) continue
      seen.add(entry.loc)
      const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod || '')
        ? `\n    <lastmod>${PrerenderPages.escapeXml(entry.lastmod)}</lastmod>`
        : ''
      if (!lastmod) throw new Error(`prerender: ${entry.loc} is missing lastmod`)
      rows.push(`  <url>\n    <loc>${PrerenderPages.escapeXml(entry.loc)}</loc>${lastmod}\n  </url>`)
    }
    if (!String(entries[entries.length - 1].loc).endsWith('/privacy/') || rows.at(-1).includes('/privacy</loc>')) {
      throw new Error('prerender: sitemap privacy URL must be /privacy/ and must be last')
    }
    fs.writeFileSync(
      file,
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`,
    )
    return rows.length
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
