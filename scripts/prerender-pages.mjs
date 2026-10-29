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
import { tagLabel } from './lib/tag-label.mjs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { MD_LINK_RE } from '../src/markdown-links.js'
import { countyMatcher } from '../src/county-guess.js'
import { ccByLicense } from '../src/photo-credit.js'
import {
  GA_MEASUREMENT_ID,
  deferredAdsenseLoaderHtml,
  gtagHeadHtml,
  missingGaSnippet,
  privacyChoicesBootHtml,
  privacyChoicesLinkHtml,
} from './gtag-snippet.mjs'
import { faviconLinksHtml, sealRotationScriptHtml, siteChromeScriptHtml, siteFooterHtml, siteHeaderHtml } from './site-chrome.mjs'
import { contactLineHtml } from './contact-reveal.mjs'
import { storyDrives } from './story-drives-lib.mjs'
import { takeADriveHtml } from '../src/take-a-drive.js'
import { gitFileDates, gitStoryTextDates, storyStoredDate } from './story-dates.mjs'
import {
  citeBootScript,
  citeBoxHtml,
  correctionHtml,
  learnMoreBlockHtml,
  learnMoreItemsFromMarkdown,
  markerRecords,
  nearbyPlaces,
  photoCreditHtml,
  photoCaptionYear,
  pickRelatedStories,
  relatedAndNearbyForStory,
  resolveArticleDates,
  storyCanonicalUrl,
  storyThumbSrc,
  artworkLead,
  ARTWORK_LEADS,
  looksLikeUnlabeledArtwork,
  REVIEWED_ARTWORK_SLUGS,
} from '../src/story-tools.js'
import { FILMS, filmCardHtml, filmDescriptionFromPlain, filmForStory, filmPlayerHtml, videoObjectNode } from '../src/films.js'
import {
  ROUTE_MAPS,
  absoluteUrl,
  routeBySlug,
  routeMapJsonLd,
  routeMapSectionHtml,
  routeMapThemeScript,
  routesIndexArticleHtml,
} from '../src/route-maps.js'
import { storyPinLinkHtml } from '../src/story-pin.js'
import { staticPageBootHtml } from '../src/story-return.js'
import { foldedResearchHtml, foldedResearchJumpHtml, researchNotesHtml } from '../src/research-notes.js'
import {
  glanceTableHtml,
  markdownWithoutGlanceSection,
  renderStoryHtml,
  researchPageHref,
  isFoldedResearch,
  indexResearchByStory,
} from '../src/story-markdown.js'
import { applyStoryPeople } from '../src/story-people.js'
import { applyTransportLink } from '../src/transport-links.js'
import { roadsRailsEnabled } from './roads-rails-flag.mjs'
import { storyFigureHtml } from '../src/story-figure.js'
import { portraitsByStorySlug, personByStorySlug, relatedBlockHtml, relatedBlockSlugs, portraitThumbSrc, portraitAlt, storySubject, storyPortraitHtml, heroPhotoIsPortrait } from '../src/related-people.js'
import { initials } from './people-public.mjs'
import { isThinStory } from './lib/thin-stories.mjs'
import { knownLifeSpan, personIdentifier, personPlace } from './people-line.mjs'
import {
  buildUnifiedSources,
  computeRelatedNote,
  extractResearchClaims,
  formatCoordCardinal,
  formatCountiesBadge,
  isProtectedStory,
  standfirstHasLocator,
  matchStoryMarkers,
  renderWhereItHappenedCard,
  resolvePeopleInStory,
  roundStoryCoord,
  roundedStoryGeo,
  splitStoryMarkdown,
  storyCountiesList,
  storyDocTitle,
  timelineNeighbor,
  storyEraLabel,
} from './lib/unified-story-data.mjs'

/** True when a preload link in `html` points at `poster`. The URL is matched as text, not as a regular expression. */
export function preloadsPoster(html, poster) {
  const re = /rel="preload"[^>]*/g
  let match
  while ((match = re.exec(html))) {
    if (match[0].includes(poster)) return true
  }
  return false
}

class PrerenderPages {
  static SITE = 'https://kyhistorydrive.com'
  static ORG_ID = 'https://kyhistorydrive.com/#organization'
  static WEBSITE_ID = 'https://kyhistorydrive.com/#website'
  static websiteNode() {
    return {
      '@type': 'WebSite',
      '@id': PrerenderPages.WEBSITE_ID,
      name: 'Kentucky History Drive',
      url: `${PrerenderPages.SITE}/`,
      publisher: PrerenderPages.publisherNode(),
    }
  }
  static LOGO = 'https://kyhistorydrive.com/brand/khd-logo-512.png'
  static ADSENSE =
    '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8587137224654033" crossorigin="anonymous"></script>'
  static photoSizes = {}
  static COUNTY_DISPLAY = { Larue: 'LaRue' }
  static ERA_LABEL = {
    prehistoric: 'Prehistoric',
    native: 'Native nations',
    frontier: 'Frontier',
    revolution: 'Frontier',
    'early-commonwealth': 'Early commonwealth',
    other: 'More Kentucky history',
    modern: 'More Kentucky history',
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
    bridges:
      'Kentucky’s remaining covered bridges — timber spans that still stand on public roads or park approaches, mapped so you can find them on a drive. Pins use the bridge name, county, and a short note on the truss or rebuilding history when sources support it. Featured stops highlight a well-documented survivor; the place list below covers the layer. These are historic structures still in the landscape, not vanished crossings.',
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
    const lightboxJs = fs.readFileSync(path.join(dist, 'route-map-lightbox.js'), 'utf8')
    if (/\beval\s*\(|\bnew Function\b|onclick\s*=|javascript:/.test(lightboxJs)) {
      throw new Error('prerender: route map lightbox is not CSP-friendly')
    }
    if (!/data-zoom-' \+ mode \+ '-' \+ ext/.test(lightboxJs) || !lightboxJs.includes("'avif'") || !lightboxJs.includes("'webp'")) {
      throw new Error('prerender: route map lightbox does not load theme-matched zoom art')
    }
    if (/3840|HIRES_WIDTH|-route-map-'/.test(lightboxJs)) {
      throw new Error('prerender: route map lightbox still requests the old hi-res WebP')
    }
    const manifestPath = path.join(root, 'public/content/photos/responsive.json')
    PrerenderPages.photoVariants = fs.existsSync(manifestPath)
      ? PrerenderPages.readJson(manifestPath).images || {}
      : {}
    const cssHrefs = PrerenderPages.stylesheetHrefs(dist, fs.readFileSync(path.join(dist, 'index.html'), 'utf8'))
    const stories = PrerenderPages.liveStories(PrerenderPages.loadStories(root))
    const researchNotes = PrerenderPages.loadResearch(root)
    const researchByStory = indexResearchByStory(researchNotes)
    const markers = PrerenderPages.loadHistoricalMarkers(root)
    await PrerenderPages.collectPhotoSizes(root, stories)
    PrerenderPages.assertOverridesApplied(root, stories)
    const layers = await PrerenderPages.loadLayers(root, stories)
    const dates = PrerenderPages.gitFileDates(root)
    const textDates = gitStoryTextDates(root)
    for (const story of stories) {
      const file = `public/content/stories/${story.slug}.json`
      story.created = dates.created.get(file) || ''
      story.gitModified = textDates.modified.get(file) || story.created
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
    if (aboutHtml.includes('data-contact-reveal') || aboutHtml.includes('>Show email address<') || aboutHtml.includes('contact [at] kyhistorydrive [dot] com')) {
      throw new Error('prerender: about page must link to /contact/ and must not include the contact reveal')
    }
    if (!aboutHtml.includes('href="/contact/"') || !aboutHtml.includes('href="/editorial/"')) {
      throw new Error('prerender: about page must link to /contact/ and /editorial/')
    }
    const contactPoint = `"contactPoint":{"@type":"ContactPoint","contactType":"customer support","url":"${PrerenderPages.SITE}/about/"}`
    if (!aboutHtml.includes(contactPoint)) {
      throw new Error('prerender: about page contactPoint should point at /about/')
    }
    if (aboutHtml.includes('contact@kyhistorydrive.com') || /contact(?:&#0*64;|&#[xX]0*40;|&commat;|%40)kyhistorydrive\.com/i.test(aboutHtml)) {
      throw new Error('prerender: about page includes the plain contact address')
    }
    const aboutH1 = [...aboutHtml.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((match) => {
      // Repeat until stable so a nested tag cannot collapse into <script>.
      let text = match[1]
      let previous
      do {
        previous = text
        text = text.replace(/<[^>]+>/g, '')
      } while (text !== previous)
      return text.replace(/\s+/g, ' ').trim()
    })
    if (aboutH1.length !== 1 || aboutH1[0] !== 'About Kentucky History Drive') {
      throw new Error(`prerender: /about/ should have one h1, the page title; found ${aboutH1.join(' | ') || 'none'}`)
    }
    if (!aboutHtml.includes('<h1 class="about-page-title">About Kentucky History Drive</h1>')) {
      throw new Error('prerender: /about/ page title should be the h1 (the header title is a <p>)')
    }
    if (!aboutHtml.includes('src="/route-map-lightbox.js"')) {
      throw new Error('prerender: /about/ is missing the seal lightbox')
    }
    for (const label of [
      'Enlarge original black edition seal',
      'Enlarge navy edition seal',
      'Enlarge gold-rim edition seal',
    ]) {
      if (!aboutHtml.includes(`aria-label="${label}"`) || !aboutHtml.includes(`<button type="button" class="about-seal-btn"`)) {
        throw new Error(`prerender: /about/ is missing the ${label} button`)
      }
    }
    if ((aboutHtml.match(/class="about-seal-btn"/g) || []).length !== 3) {
      throw new Error('prerender: /about/ should have three seal buttons')
    }
    PrerenderPages.writePage(dist, '/about/', aboutHtml)
    const trustLastmod = PrerenderPages.laterDate(
      dates.lastmod.get('scripts/prerender-pages.mjs') || '',
      dates.lastmod.get('index.html') || '',
    )
    entries.push({ loc: `${PrerenderPages.SITE}/about/`, lastmod: trustLastmod })
    const editorialHtml = PrerenderPages.editorialPage(cssHrefs)
    PrerenderPages.assertPage(editorialHtml, { archaeological: false, lat: null, lon: null }, '/editorial/')
    if (!editorialHtml.includes('<h1>Editorial standards</h1>') || !editorialHtml.includes('AI illustration · Kentucky History Drive')) {
      throw new Error('prerender: /editorial/ is missing its heading or the AI credit')
    }
    if (/<meta name="robots" content="[^"]*noindex/i.test(editorialHtml)) {
      throw new Error('prerender: /editorial/ must be indexable')
    }
    PrerenderPages.writePage(dist, '/editorial/', editorialHtml)
    entries.push({ loc: `${PrerenderPages.SITE}/editorial/`, lastmod: trustLastmod })
    const contactHtml = PrerenderPages.contactPage(cssHrefs)
    PrerenderPages.assertPage(contactHtml, { archaeological: false, lat: null, lon: null }, '/contact/')
    if (!contactHtml.includes('<h1>Contact</h1>') || !contactHtml.includes('>Show email address<') || !contactHtml.includes('contact [at] kyhistorydrive [dot] com') || !contactHtml.includes('data-contact-reveal')) {
      throw new Error('prerender: /contact/ is missing the heading or the contact reveal')
    }
    if (contactHtml.includes('contact@kyhistorydrive.com') || /contact(?:&#0*64;|&#[xX]0*40;|&commat;|%40)kyhistorydrive\.com/i.test(contactHtml)) {
      throw new Error('prerender: /contact/ includes the plain contact address')
    }
    if (/<meta name="robots" content="[^"]*noindex/i.test(contactHtml)) {
      throw new Error('prerender: /contact/ must be indexable')
    }
    PrerenderPages.writePage(dist, '/contact/', contactHtml)
    entries.push({ loc: `${PrerenderPages.SITE}/contact/`, lastmod: trustLastmod })
    const relatedBundle = PrerenderPages.loadRelatedBundle(root)
    PrerenderPages.portraitForSlug = (slug) => portraitThumbSrc(relatedBundle.portraits.get(slug) || relatedBundle.personFor.get(slug))
    const sourcePeople = PrerenderPages.readJson(path.join(root, 'data/people.json')).people || []
    const peopleHtml = PrerenderPages.peoplePage(relatedBundle.people, stories, cssHrefs, sourcePeople)
    PrerenderPages.assertPage(peopleHtml, { lat: null, lon: null }, '/people/')
    PrerenderPages.assertPeople(peopleHtml, relatedBundle.people, sourcePeople, stories)
    PrerenderPages.writePage(dist, '/people/', peopleHtml)
    entries.push({
      loc: `${PrerenderPages.SITE}/people/`,
      lastmod: PrerenderPages.laterDate(
        dates.lastmod.get('data/people.json') || '',
        dates.lastmod.get('scripts/prerender-pages.mjs') || '',
      ),
    })
    const storiesIndexHtml = PrerenderPages.storiesIndexPage(stories, cssHrefs)
    PrerenderPages.assertPage(storiesIndexHtml, { lat: null, lon: null }, '/stories/')
    PrerenderPages.writePage(dist, '/stories/', storiesIndexHtml)
    entries.push({
      loc: `${PrerenderPages.SITE}/stories/`,
      lastmod: stories.reduce(
        (max, story) => PrerenderPages.laterDate(max, story.lastmod || ''),
        dates.lastmod.get('scripts/prerender-pages.mjs') || '',
      ),
    })
    relatedBundle.sourcePeople = sourcePeople
    const portraitLog = { shown: [], skipped: [] }
    let thinRouteImages = 0
    for (const story of stories) {
      const urlPath = `/stories/${story.slug}/`
      const description = PrerenderPages.storyDescription(story)
      const notes = researchByStory.get(story.slug) || null
      const html = PrerenderPages.storyPage(story, stories, cssHrefs, layers, markers, relatedBundle, notes)
      PrerenderPages.assertPage(html, story, urlPath)
      PrerenderPages.assertStory(html, story, description, stories, markers, notes)
      // Item 88: thin stories (< THIN_STORY_MIN_WORDS narrative words) carry noindex, follow and stay out of the sitemap.
      const thin = isThinStory(story)
      if (thin !== html.includes(`<meta name="robots" content="${PrerenderPages.THIN_ROBOTS}" />`)) {
        throw new Error(`prerender: ${urlPath} thin-story robots meta mismatch (thin=${thin})`)
      }
      PrerenderPages.writePage(dist, urlPath, html)
      const pick = PrerenderPages.storyPortrait(story, relatedBundle)
      if (pick.person) portraitLog.shown.push(story.slug)
      // Shannon's rule: the Photos sidebar never repeats the inline portrait (see dedupe-portrait-photos.mjs).
      if (pick.person?.sourceFile && story.photo?.source_url) {
        let f = String(story.photo.source_url).split(/[?#]/)[0].split('/').pop() || ''
        try {
          f = decodeURIComponent(f)
        } catch {
          /* keep raw */
        }
        if (f.replace(/^File:/, '').replace(/_/g, ' ').toLowerCase() === pick.person.sourceFile.replace(/_/g, ' ').toLowerCase()) {
          throw new Error(`prerender: ${story.slug} sidebar photo is the same image as the ${pick.person.id} inline portrait`)
        }
      }
      else if (pick.reason) portraitLog.skipped.push(`${story.slug} (${pick.reason})`)
      const route = routeBySlug(story.slug)
      const images = route
        ? [
            {
              loc: absoluteUrl(route.files.fullPng),
              title: `${story.title} route map`,
              caption: route.alt,
            },
          ]
        : []
      if (thin) thinRouteImages += images.length
      else entries.push({ loc: `${PrerenderPages.SITE}${urlPath}`, lastmod: story.lastmod, images })
    }
    for (const layer of layers) {
      const urlPath = `/layers/${layer.id}/`
      const html = PrerenderPages.layerPage(layer, cssHrefs, stories, layers)
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
    // /videos/ is noindex for now (Shannon item 93), so it stays out of the sitemap; its lastmod is still checked.
    const videoSitemap = path.join(dist, 'sitemap-videos.xml')
    // Item 88: films whose story page is thin (noindex) stay out of the video sitemap.
    const indexedFilms = FILMS.filter((film) => !isThinStory(stories.find((item) => item.slug === film.storySlug)))
    PrerenderPages.writeVideoSitemap(videoSitemap, indexedFilms, stories)
    const videoXml = fs.readFileSync(videoSitemap, 'utf8')
    const maryIndexed = indexedFilms.some((film) => film.storySlug === 'mary-draper-ingles-escapes-through-kentucky-1755')
    if (videoXml.includes('/videos/</loc>') || maryIndexed !== videoXml.includes('/stories/mary-draper-ingles-escapes-through-kentucky-1755/</loc>')) {
      throw new Error('prerender: video sitemap must point at the story page')
    }
    if (maryIndexed && !videoXml.includes('2026-10-10T09:00:00-04:00')) {
      throw new Error('prerender: video sitemap publication date is not the upload time')
    }
    const routesHtml = PrerenderPages.routesPage(stories, cssHrefs)
    PrerenderPages.assertPage(routesHtml, { lat: null, lon: null }, '/routes/')
    PrerenderPages.assertRoutes(routesHtml, stories)
    PrerenderPages.writePage(dist, '/routes/', routesHtml)
    const routesLast = ROUTE_MAPS.reduce(
      (max, route) =>
        PrerenderPages.laterDate(max, dates.lastmod.get(`public/maps/routes/${route.slug}/NOTES.md`) || ''),
      dates.lastmod.get('src/route-maps.js') || '',
    )
    // Shallow clone has no git dates; /routes/ is noindex and out of the sitemap, so only check on full history.
    if (!dates.shallow && !PrerenderPages.isoDate(routesLast)) throw new Error('prerender: /routes/ is missing lastmod')
    // /routes/ is noindex for now (Shannon item 93), so it stays out of the sitemap.
    // v2 Phase 5 (#340): the research outlines fold into their story pages (amplify.yml 301s each old
    // URL). Only the 7 culture image-evidence pages are still built, noindex,follow and out of the sitemap.
    for (const notes of researchNotes) {
      const story = stories.find((item) => item.slug === notes.storySlug)
      if (!story) throw new Error(`prerender: research ${notes.slug} is not tied to a live story`)
      if (isFoldedResearch(notes)) continue
      const urlPath = `/research/${notes.slug}/`
      const html = PrerenderPages.researchPage(notes, cssHrefs, story)
      PrerenderPages.assertPage(html, { archaeological: false, lat: null, lon: null }, urlPath)
      PrerenderPages.assertResearch(html, notes)
      if (!html.includes(`<meta name="robots" content="${PrerenderPages.THIN_ROBOTS}" />`)) {
        throw new Error(`prerender: ${urlPath} culture evidence page must be noindex`)
      }
      PrerenderPages.writePage(dist, urlPath, html)
    }
    // Drives: the index, the planner and each /drives/<slug>/ page (static files from public/drives/).
    for (const loc of PrerenderPages.drivePaths(root)) {
      const src = `public${loc}index.html`
      entries.push({ loc: `${PrerenderPages.SITE}${loc}`, lastmod: dates.lastmod.get(src) || homeLast })
    }
    // Roads & Rails left the live site on Oct 19: unless KHD_ROADS_RAILS=1, it is not built, not in the
    // sitemap; the Amplify console 301s /roads-and-rails/ and /roads-rails/ to / (item 90).
    if (roadsRailsEnabled()) {
      // Item 70: /roads-and-rails/ is a vite page (roads-and-rails/index.html); list it with a self-canonical.
      const rrFile = path.join(dist, 'roads-and-rails', 'index.html')
      if (fs.existsSync(rrFile)) fs.writeFileSync(rrFile, PrerenderPages.roadsRailsFill(fs.readFileSync(rrFile, 'utf8'), stories, root))
      const rrHtml = fs.existsSync(rrFile) ? fs.readFileSync(rrFile, 'utf8') : ''
      if (!rrHtml.includes('<link rel="canonical" href="https://kyhistorydrive.com/roads-and-rails/"') || !rrHtml.includes('<h1>Roads &amp; Rails</h1>') || !rrHtml.includes('id="transportMap"')) {
        throw new Error('prerender: /roads-and-rails/ is missing its canonical, h1 or map')
      }
      if ((rrHtml.match(/<li><a class="transport-story-link" href="\/stories\//g) || []).length < 1 || !rrHtml.includes('href="/drives/"') || !rrHtml.includes('"@type":"CollectionPage"')) {
        throw new Error('prerender: /roads-and-rails/ is missing its story list, drives link or JSON-LD')
      }
      if (!/<a href="\/roads-and-rails\/" data-route="roads" class="active" aria-current="page">/.test(rrHtml)) {
        throw new Error('prerender: /roads-and-rails/ nav item is not marked current')
      }
      entries.push({
        loc: `${PrerenderPages.SITE}/roads-and-rails/`,
        lastmod: [
          'roads-and-rails/index.html',
          'src/transport-map.js',
          'public/maps/transport/sections.geojson',
        ].reduce((max, f) => PrerenderPages.laterDate(max, dates.lastmod.get(f) || ''), '') || new Date().toISOString().slice(0, 10),
      })
    }
    entries.push({
      loc: `${PrerenderPages.SITE}/privacy/`,
      lastmod: dates.lastmod.get('privacy/index.html') || '',
    })
    // /timeline/ forwards to the /#timeline hash route. Amplify rules cannot target a #fragment,
    // so this stub redirects in the browser. Deliberately not in the sitemap.
    PrerenderPages.writePage(dist, '/timeline/', PrerenderPages.timelineRedirectHtml())
    // Phase 0: a real "not found" page, written twice with the same root-absolute markup.
    // Amplify 301s /x.html to /x/ even when the file exists, so /404/ (dist/404/index.html) is the
    // address that actually serves; /404.html stays for hosts that read it. The Amplify console
    // rule /<*> -> /404/index.html (404) serves it for unknown paths (item 90).
    const notFoundHtml = PrerenderPages.notFoundPage(cssHrefs)
    PrerenderPages.assertNotFound(notFoundHtml)
    fs.writeFileSync(path.join(dist, '404.html'), notFoundHtml)
    fs.mkdirSync(path.join(dist, '404'), { recursive: true })
    fs.writeFileSync(path.join(dist, '404', 'index.html'), notFoundHtml)
    console.log(`prerender: inline portraits on ${portraitLog.shown.length} stories; skipped ${portraitLog.skipped.length}: ${portraitLog.skipped.join(', ')}`)
    const sitemapCount = PrerenderPages.updateSitemap(path.join(dist, 'sitemap.xml'), entries, ROUTE_MAPS.length - thinRouteImages, { allowMissingLastmod: dates.shallow })
    PrerenderPages.injectHome(path.join(dist, 'index.html'), stories, layers)
    console.log(
      `prerender: ${stories.length + layers.length} story/layer pages (${stories.length} stories, ${layers.length} layers, ${researchNotes.length} research) plus home, about, editorial, contact, people, stories index, videos, privacy; sitemap ${sitemapCount} urls`,
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

  static formatYearRange(start, end, approx = false) {
    if (start == null && end == null) return ''
    // approxStart (shared with timeline nodes) marks a traditional or estimated start year: "c. 1795".
    if (approx && start != null && start >= 0) {
      const rest = PrerenderPages.formatYearRange(start, end)
      return `c. ${rest}`
    }
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
      .replace(MD_LINK_RE, '$1')
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
      /\b(?:Jr|Sr|Dr|Capt|Col|Gen|Maj|Lt|Rev|Gov|Mr|Mrs|Ms|St|Ste|Ave|Mt|Ft|No|Co|Sts|Pres|Hon|vs|etc|c)\.$/.test(
        s.trimEnd(),
      ) ||
      /(?:^|[\s(])[A-Z]\.$/.test(s.trimEnd()) ||
      /\b(?:[A-Z]\.){2,}$/.test(s.trimEnd())
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
    const match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(String(value || ''))
    return match ? match[1] : ''
  }

  /** Calendar day in Kentucky. A story dated after this is not live yet. */
  static siteToday(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
  }

  /**
   * Stories prerender writes a public page for. Drafts, hidden stories, and
   * future publishedDate values stay off the site. The RSS feed uses this too.
   */
  static isLiveStory(story, today = PrerenderPages.siteToday()) {
    if (!story || typeof story.slug !== 'string' || !story.slug) return false
    if (story.draft === true || story.hidden === true) return false
    const status = String(story.status || story.visibility || '').trim().toLowerCase()
    if (status === 'draft' || status === 'hidden' || status === 'unpublished' || status === 'private' || status === 'scheduled') {
      return false
    }
    const published = PrerenderPages.isoDate(story.publishedDate)
    const day = PrerenderPages.isoDate(today)
    if (!published || !day || published > day) return false
    return true
  }

  static liveStories(stories, today = PrerenderPages.siteToday()) {
    return (stories || []).filter((story) => PrerenderPages.isLiveStory(story, today))
  }

  /**
   * Published is the story file's first git commit.
   * Last revised is the last commit that changed that story's text.
   * No git date (shallow clone): publishedDate, then briefDate. Never today.
   */
  static articleDates(story) {
    const dates = resolveArticleDates(story, { published: story.created, modified: story.gitModified })
    if (story.created && dates.published !== story.created) {
      throw new Error(`prerender: ${story.slug} published date is not the git first commit`)
    }
    if (story.gitModified && dates.modified !== story.gitModified) {
      throw new Error(`prerender: ${story.slug} revised date is not the last story-text commit`)
    }
    if (!dates.published && !dates.modified) {
      // Shallow clone (no git history): the story's stored date, never today.
      const stored = storyStoredDate(story)
      if (stored) return { ...dates, published: stored, modified: stored }
      throw new Error(`prerender: ${story.slug} has no git date`)
    }
    return dates
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
   * Meta description source text (kept for callers that need the raw source). The
   * description itself comes from storyDescription, which fits each candidate first.
   */
  static storyDescriptionSource(story) {
    return PrerenderPages.storyDescriptionChoice(story).source
  }

  static SUMMARY_META_MAX = 155
  static META_MAX = 155
  static META_CLAUSE_MIN = 70

  /**
   * Named entities and numbers that make a meta specific: capitalised words not at
   * a sentence start, and any number. Used to compare summary and first-sentence metas.
   */
  static metaKeyTerms(text) {
    const terms = new Set()
    const words = String(text || '').split(/\s+/)
    words.forEach((raw, i) => {
      const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/[’']s$/u, '')
      if (!w) return
      if (/\d/.test(w)) { terms.add(w.toLowerCase()); return }
      const sentenceStart = i === 0 || /[.!?]["'”’)\]]*$/.test(words[i - 1])
      if (!sentenceStart && /^\p{Lu}/u.test(w)) terms.add(w.toLowerCase())
    })
    return terms
  }

  /**
   * Story meta rule (Editor + SEO & AEO Desk, Oct 18; see storyDescriptionChoice): the summary is
   * the meta when it is 120-155 characters, one finished sentence, and names the story's subject
   * and a place; otherwise the body's opening sentence(s) are cut cleanly (never mid-phrase, no
   * ellipsis, at most 155). A story can pin either side with metaSource: "body" | "summary".
   * META_STOP lists title/place words too generic to count as a subject or place term.
   */
  static META_STOP = new Set(['the', 'and', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with', 'by', 'a', 'an', 'its', 'his', 'her', 'their', 'first', 'site', 'county', 'kentucky', 'kentuckys', 'story', 'takes', 'shape', 'becomes', 'into', 'over', 'near', 'river', 'creek', 'town', 'village'])

  /** Lower-case letter/digit words of a string (word loop, no regex replace). */
  static metaWords(text) {
    const out = []
    for (const m of String(text || '').toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) out.push(m[0])
    return out
  }

  /** A text names a term when one of its words starts with the term's stem (handles "Shawnee"/"Shawnees", possessives). */
  static metaNames(textWords, term) {
    const stem = term.length > 5 ? term.slice(0, term.length - 2) : term
    return textWords.some((w) => w.startsWith(stem))
  }

  /** Subject terms: significant title words (4+ letters, not a stop word, not a site number). */
  static metaSubjectTerms(story) {
    return [...new Set(PrerenderPages.metaWords(story.title))].filter(
      (w) => w.length >= 4 && !PrerenderPages.META_STOP.has(w) && !/\d/.test(w),
    )
  }

  /** Place terms: county, file county, matched place and territory words; Kentucky when a story has none. */
  static metaPlaceTerms(story) {
    const fields = [story.county, story.fileCounty, story.matchedPlace, story.territoryNation]
    const terms = new Set()
    for (const f of fields) {
      for (const w of PrerenderPages.metaWords(f)) {
        if (w.length >= 4 && !PrerenderPages.META_STOP.has(w) && !/\d/.test(w)) terms.add(w)
      }
    }
    return [...terms]
  }

  /** Title proper nouns (capitalised, 3+ letters, not a stop word), e.g. "Wea", kept case-sensitive. */
  static metaTitleProperNouns(story) {
    const out = []
    for (const m of String(story.title || '').matchAll(/\p{Lu}[\p{L}’']{2,}/gu)) {
      if (!PrerenderPages.META_STOP.has(m[0].toLowerCase())) out.push(m[0])
    }
    return out
  }

  /**
   * Named places in the text itself (SEO & AEO Desk, #317 follow-up): "Capitalised + River, Creek,
   * Gap, Fork, Lick, Valley, Falls, Station, County or Lake" (Barren River, Cumberland Gap,
   * McFadden's Station, Lancaster County), "Lake Erie", "Fort X", and the Ohio, Wabash, Scioto,
   * Tennessee and Mississippi rivers.
   */
  static META_PLACE_PATTERNS = [
    /\p{Lu}[\p{L}’'.-]*\s+(?:River|Creek|Gap|Fork|Lick|Valley|Falls|Station|County|Lake)\b/u,
    /\bLake\s+\p{Lu}\p{L}+/u,
    /\bFort\s+\p{Lu}\p{L}+/u,
    /\b(?:Ohio|Wabash|Scioto|Tennessee|Mississippi)\b/u,
  ]

  static metaNamesPlace(text) {
    return PrerenderPages.META_PLACE_PATTERNS.some((re) => re.test(String(text || '')))
  }

  /** SEO & AEO Desk / Editor rule: a meta names the story's subject and a place. */
  static metaSubjectPlace(story, text) {
    const words = PrerenderPages.metaWords(text)
    const subjects = PrerenderPages.metaSubjectTerms(story)
    const places = PrerenderPages.metaPlaceTerms(story)
    const proper = PrerenderPages.metaTitleProperNouns(story)
    const textWords = new Set(String(text || '').match(/[\p{L}’']+/gu) || [])
    const subject =
      !subjects.length ||
      subjects.some((t) => PrerenderPages.metaNames(words, t)) ||
      proper.some((t) => textWords.has(t))
    const place =
      (places.length
        ? places.some((t) => PrerenderPages.metaNames(words, t)) || words.includes('kentucky')
        : words.includes('kentucky') || words.includes('ohio')) || PrerenderPages.metaNamesPlace(text)
    return { subject, place }
  }

  /** Summary qualifies as the meta: 120-155 chars, one finished sentence, names subject and place. */
  static summaryQualifies(story) {
    const plain = PrerenderPages.plainText(story.summary)
    if (!plain || plain.length < 120 || plain.length > PrerenderPages.META_MAX) return false
    if (!PrerenderPages.isFinishedMeta(plain)) return false
    if (PrerenderPages.splitSentences(plain).length !== 1) return false
    const { subject, place } = PrerenderPages.metaSubjectPlace(story, plain)
    return subject && place
  }

  /**
   * Editor + SEO rule (Oct 18): use the summary when it is 120-155 characters, one finished
   * sentence, and names the subject and a place (checked against title and place fields).
   * Otherwise use the body's opening sentence(s) with the clean-cut rules. A story can pin
   * either side with metaSource: "body" | "summary" in its story JSON.
   */
  static storyDescriptionChoice(story) {
    const summaryPlain = PrerenderPages.plainText(story.summary)
    const bodySource = PrerenderPages.plainText(story.bodyMarkdown)
    const useSummary =
      story.metaSource === 'summary' ? Boolean(summaryPlain) : story.metaSource === 'body' ? false : PrerenderPages.summaryQualifies(story)
    if (useSummary) {
      const description = PrerenderPages.storyMetaDescription(summaryPlain)
      if (description) return { source: summaryPlain, description, kind: 'summary' }
    }
    const fromBody = PrerenderPages.storyMetaDescription(bodySource)
    if (fromBody) return { source: bodySource, description: fromBody, kind: 'body' }
    if (story.metaSource !== 'body') {
      // No body text that cuts cleanly: whole sentences of the summary written before any "…" cut.
      const truncated = /(?:\u2026|\.\.\.)\s*$/u.test(summaryPlain)
      let summarySource = PrerenderPages.finishedSummary(story.summary)
      if (truncated) {
        const whole = PrerenderPages.splitSentences(summarySource).filter((x) => PrerenderPages.endsWithSentence(x))
        summarySource = whole.slice(0, -1).join(' ')
      }
      const opts = { clause: !truncated }
      const fromSummary = PrerenderPages.storyMetaDescription(summarySource, PrerenderPages.META_MAX, opts)
      if (fromSummary) return { source: summarySource, description: fromSummary, opts, kind: 'summary' }
    }
    const opts = { nextSentence: true }
    return { source: bodySource, description: PrerenderPages.storyMetaDescription(bodySource, PrerenderPages.META_MAX, opts), opts, kind: 'body' }
  }


  static storyDescription(story) {
    return PrerenderPages.storyDescriptionChoice(story).description
  }

  /** Finished meta: not empty, at most 155 characters, sentence punctuation, no ellipsis. */
  static isFinishedMeta(text, max = PrerenderPages.META_MAX) {
    const d = String(text || '')
    return Boolean(d) && d.length <= max && !/(?:\u2026|\.\.\.)\s*$/u.test(d) && PrerenderPages.endsWithSentence(d)
  }

  /** Brackets and quotes are balanced, so a clause cut never lands inside them. */
  static balancedClause(text) {
    const t = String(text || '')
    const count = (re) => (t.match(re) || []).length
    return (
      count(/\(/g) === count(/\)/g) &&
      count(/\[/g) === count(/\]/g) &&
      count(/“/g) === count(/”/g) &&
      count(/"/g) % 2 === 0
    )
  }

  /**
   * Story meta description, up to 155 characters, never cut mid-phrase and never with an ellipsis:
   * 1. the longest run of complete leading sentences that fits;
   * 2. otherwise the first sentence ended at its last comma or semicolon clause boundary
   *    at least 70 characters in, closed with a period;
   * 3. otherwise empty (the caller falls back to the other candidate).
   */
  static storyMetaDescription(text, max = PrerenderPages.META_MAX, { clause = true, nextSentence = false, verbless = false } = {}) {
    const plain = PrerenderPages.plainText(text)
    if (!plain) return ''
    const sentences = PrerenderPages.splitSentences(plain)
    if (!sentences.length) return ''
    let acc = ''
    for (const sentence of sentences) {
      if (!PrerenderPages.endsWithSentence(sentence)) break
      const next = acc ? `${acc} ${sentence}` : sentence
      if (next.length > max) break
      acc = next
    }
    if (acc) {
      if (acc.length < 120 && sentences.length > 1) {
        const usedCount = sentences.filter((sent, idx) => idx === 0 || acc.includes(sent)).length
        const nextSent = sentences[usedCount] || sentences[1] || ''
        const room = max - acc.length - 1
        if (nextSent && room >= 30) {
          const punct2 = /[,;]\s(?!\d)|(?<!\d)\s*—\s*|\s—\s|\s–\s|\s+-\s+|\s+(?=(?:while|when|where|which|who|whose|after|before|until|because)\s)/gu
          const cut2 = PrerenderPages.clauseCut(nextSent, room, punct2, 25, true, false)
          if (cut2 && acc.length + 1 + cut2.length >= 100 && acc.length + 1 + cut2.length <= max) {
            return `${acc} ${cut2}`
          }
        }
      }
      return acc
    }
    if (!clause) return ''
    const cut = PrerenderPages.clauseMeta(sentences[0], max) || (verbless ? PrerenderPages.clauseCut(sentences[0], max, PrerenderPages.META_PUNCT_BOUNDARY, PrerenderPages.META_CLAUSE_MIN, false, true) : '')
    if (cut || !nextSentence) return cut
    // Last resort: the next whole sentence of the opening paragraph that fits (never a fragment).
    const next = sentences.slice(1, 4).find((x) => x.length <= max && x.length >= 50 && PrerenderPages.endsWithSentence(x))
    if (next) return next
    // Nothing finished fits. Cut on a word (no ellipsis) so the page still has a meta; the
    // unfinished-meta check lists it until the story gets a finished 120-155 character summary.
    const window = sentences[0].slice(0, max)
    const space = window.lastIndexOf(' ')
    return (space > 0 ? window.slice(0, space) : window)
      .replace(/[\s,;:–—-]+$/u, '')
      .replace(/\s+(?:and|or|but|of|the|a|an|to|in|on|at|by|for|with|from|into)$/i, '')
      .replace(/[\s,;:–—-]+$/u, '')
      .trim()
  }

  /**
   * /videos/ meta: whole leading sentences when they fit; otherwise the first sentence with one
   * short comma-set aside dropped (", then about twenty-three and pregnant,"), so the sentence
   * keeps its ending ("west with her two young sons") instead of being cut at a comma.
   */
  static videosMetaDescription(text, max = PrerenderPages.META_MAX) {
    const whole = PrerenderPages.storyMetaDescription(text, max, { clause: false })
    if (whole) return whole
    const first = PrerenderPages.splitSentences(PrerenderPages.plainText(text))[0] || ''
    for (const m of first.matchAll(/, ([^,;—–()]{3,60}),\s/gu)) {
      const shorter = `${first.slice(0, m.index)} ${first.slice(m.index + m[0].length)}`
      if (shorter.length <= max && PrerenderPages.isFinishedMeta(shorter, max)) return shorter
    }
    return PrerenderPages.storyMetaDescription(text, max, { nextSentence: true })
  }

  /** A clause head reads as a clause: it has a verb, not just a place phrase. */
  static META_VERB =
    /\b(?:is|was|are|were|has|had|have|became|becomes|sits|sat|stands|stood|lay|lies|cuts|runs|ran|led|left|built|took|held|made|came|went|rode|won|grew|began|fought|fell|gave|met|sold|bought|chose|drew|wrote|saw|kept|set|brought|knew|became|\p{L}{3,}ed)\b/iu

  /**
   * End a long first sentence at a clean boundary at least 70 characters in: a comma or
   * semicolon, a dash, an opening parenthesis, or a conjunction or relative word. The head
   * must have a verb, balanced brackets and quotes, must not end on a function word or a
   * one- or two-word list item, and is closed with a period. Never cuts inside a word or number.
   */
  static clauseMeta(first, max = PrerenderPages.META_MAX) {
    const punct = /[,;]\s(?!\d)|(?<!\d)\s*—\s*|\s—\s|\s–\s|\s+-\s+|\s+(?=(?:while|when|where|which|who|whose|after|before|until|because)\s)/gu
    // Second choice: drop a trailing prepositional phrase, keeping at least 100 characters.
    const prep = /\s+(?=(?:in|near|on|at|for|with|from|during|by|of|that|built|including|into|across|along|between|around|toward|against|over|under|through|beside|below|above)\s)/gu
    return (
      PrerenderPages.clauseCut(first, max, punct, PrerenderPages.META_CLAUSE_MIN) ||
      PrerenderPages.clauseCut(first, max, prep, 100, true) ||
      PrerenderPages.clauseCut(first, max, punct, 50) ||
      PrerenderPages.clauseCut(first, max, prep, 60, true)
    )
  }

  /** Comma, semicolon or dash clause boundaries (shared by story and research metas). */
  static META_PUNCT_BOUNDARY = /[,;]\s(?!\d)|(?<!\d)\s*—\s*|\s—\s|\s–\s|\s+-\s+/gu

  static PARTICIPLE_ADVERBS = new Set(['often', 'later', 'also', 'once', 'widely', 'commonly', 'usually', 'sometimes', 'long', 'first'])
  static PARTICIPLE_PREPS = new Set(['as', 'by', 'in', 'from', 'for', 'with', 'to', 'of', 'at', 'on'])

  /**
   * True when the text has an -ed word (3+ letters before "ed") that reads as a finite verb:
   * not right after an adverb such as "often" ("often treated"), and not followed by a
   * preposition such as "as" or "by" ("treated as"). Word-by-word, no regex replace.
   */
  static hasFiniteEdVerb(text) {
    const words = []
    for (const m of String(text || '').matchAll(/[A-Za-z0-9_]+/g)) {
      words.push({ word: m[0], start: m.index, end: m.index + m[0].length })
    }
    const isEd = (w, minStem) => w.length >= minStem + 2 && /^[\p{L}]+$/u.test(w) && w.slice(-2).toLowerCase() === 'ed'
    const gapIsSpace = (a, b) => b.start > a.end && /^\s+$/.test(text.slice(a.end, b.start))
    for (let i = 0; i < words.length; i++) {
      const cur = words[i]
      if (!isEd(cur.word, 3)) continue
      const prev = words[i - 1]
      if (prev && PrerenderPages.PARTICIPLE_ADVERBS.has(prev.word.toLowerCase()) && gapIsSpace(prev, cur)) continue
      const next = words[i + 1]
      if (next && PrerenderPages.PARTICIPLE_PREPS.has(next.word.toLowerCase()) && gapIsSpace(cur, next)) continue
      return true
    }
    return false
  }

  static clauseCut(first, max, re, min, lastNeedsVerb = false, verbless = false) {
    // Note: story tiers reuse one /g regex, so a later tier resumes where an earlier one stopped.
    // Story metas depend on that (kept byte-identical); only the shared research regex is reset.
    if (verbless) re.lastIndex = 0
    let best = ''
    let m
    while ((m = re.exec(first))) {
      const head = first.slice(0, m.index).replace(/[\s,;:–—-]+$/u, '').trim()
      if (head.length + 1 > max) break
      if (head.length < min) continue
      if (!PrerenderPages.balancedClause(head)) continue
      // The verb must sit in the main clause, not only in an appositive ("a ... officer with ... in what became").
      const segs = head.split(/[,;]\s|\s*[—–]\s*/)
      const mainSegs = segs.filter((seg, i) => !/^(?:and\s+)?\p{L}+ed\b/iu.test(seg.trim()) && (i === 0 || i === segs.length - 1 || !/^(?:a|an|the)\s/i.test(seg.trim())))
      const verbIn = (seg, i) => {
        const t = seg.replace(/\bin what became\b.*$/i, '').replace(/^\s*(?:a|an|the)\s.*?\b(?:whose|that|which|who|where)\b.*$/i, '')
        // In a segment that opens like a noun phrase, an -ed word is usually a participle, not the verb.
        if (i > 0 && /^\s*(?:a|an|the)\s/i.test(seg)) {
          if (/\b(?:is|was|are|were|has|had|have|became|becomes|stands|stood|sits|sat|lies|lay|remains|cuts|runs|holds|rises|flows|forms)\b/i.test(t)) return true
          return PrerenderPages.hasFiniteEdVerb(t)
        }
        return PrerenderPages.META_VERB.test(t)
      }
      if (!verbless && !segs.some((seg, i) => mainSegs.includes(seg) && verbIn(seg, i))) continue
      // Dropping a trailing phrase: the clause it leaves must have its own verb.
      if (lastNeedsVerb && !verbIn(segs[segs.length - 1], segs.length - 1)) continue
      if (/\b(?:and|or|but|of|the|a|an|to|in|on|at|by|for|with|from|about|c|ca|than|its|their|his|her|even|also|only|just|still|then|very|more|most|except|rather|such|owned|occupied|located|known|called|named|used|west|east|north|south|part|parts|most|one|some|many|all|each|both|million|thousand|hundred|top|end|side|edge|kind|series|number|group|chain|line|mouth|head|forks?|bank|banks|first|last|half|out|up|down|back|across|upstream|downstream|just|near|beside|sits|stands|lies|few|weeks|days|years|months|miles|feet|acres|hectares)$/i.test(head)) continue
      if (/\b(?:a|an|the)\s+\S+$/i.test(head) && /^\s*[,;]/.test(first.slice(m.index))) continue
      const lastSeg = head.split(/[,;]\s|\s*[—–]\s*/).pop()
      if (/^(?:while|when|where|after|before|although|though|because|if|as|since|until|whose|which|who)\b/i.test(lastSeg.trim())) continue
      const subTail = lastSeg.trim().match(/\b(?:while|when|where|although|though|because|since|until|whose|which|who)\s+(.+)$/i)
      if (!verbless && subTail && !PrerenderPages.META_VERB.test(subTail[1])) continue
      if (/[,;]\s/.test(head) && lastSeg.trim().split(/\s+/).length <= 2) continue
      best = `${head}.`
    }
    return best
  }

  /** Sentence punctuation, allowing a closing quote or parenthesis after it. */
  static endsWithSentence(text) {
    return /[.!?]["'”’)\]]*$/.test(String(text || ''))
  }

  static assertStoryMeta(description, source, urlPath, max = PrerenderPages.META_MAX, opts = {}) {
    if (!description) throw new Error(`prerender: ${urlPath} meta description is empty`)
    if (description.length > max) {
      throw new Error(`prerender: ${urlPath} description is ${description.length} characters`)
    }
    if (/(?:\u2026|\.\.\.)\s*$/u.test(description)) {
      throw new Error(`prerender: ${urlPath} meta description ends with an ellipsis`)
    }
    const expected = PrerenderPages.storyMetaDescription(source, max, opts)
    if (description !== expected) {
      throw new Error(`prerender: ${urlPath} meta description does not follow the sentence rule`)
    }
  }

  /**
   * Meta description aimed at 150–160 characters when the source is longer.
   * Used for layer and collection pages. Story pages use storyMetaDescription.
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
    const g = roundedStoryGeo(story)
    if (!g) return null
    return { lat: g.lat, lon: g.lon }
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
      logo: {
        '@type': 'ImageObject',
        url: PrerenderPages.LOGO,
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        url: `${PrerenderPages.SITE}/about/`,
      },
      founder: {
        '@type': 'Person',
        name: 'Shannon Snowden',
        url: `${PrerenderPages.SITE}/about/`,
      },
    }
  }

  static publisherNode() {
    return { '@id': PrerenderPages.ORG_ID }
  }

  /** Newest commit date per file, and the first commit date (oldest) for datePublished. */
  static gitFileDates(root) {
    return gitFileDates(root)
  }

  static laterDate(a, b) {
    if (a && b) return a > b ? a : b
    return a || b || ''
  }

  static storyLastmod(story, dates) {
    const git = story.gitModified || dates.get(`public/content/stories/${story.slug}.json`) || ''
    // Shallow clone or no git date: the story JSON's stored date, never today.
    return PrerenderPages.laterDate(git, storyStoredDate(story))
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
      seoTitle: typeof body.seoTitle === 'string' ? body.seoTitle.trim() : '',
      summary: body.summary || '',
      bodyMarkdown: body.bodyMarkdown || '',
      era: body.era || indexRow?.era || '',
      tags: body.tags || indexRow?.tags || [],
      yearStart: body.yearStart ?? null,
      yearEnd: body.yearEnd ?? null,
      approxStart: body.approxStart === true,
      publishedDate: body.publishedDate || body.briefDate || indexRow?.publishedDate || '',
      draft: body.draft === true || indexRow?.draft === true,
      hidden: body.hidden === true || indexRow?.hidden === true,
      status: body.status || indexRow?.status || '',
      visibility: body.visibility || indexRow?.visibility || '',
      territoryNation: body.territory?.nation || '',
      county: indexRow?.county != null ? indexRow.county : '',
      fileCounty: typeof body.county === 'string' ? body.county.trim() : '',
      matchedPlace: indexRow?.matchedPlace || loc?.matchedPlace || '',
      mapConfidence: indexRow?.mapConfidence || loc?.mapConfidence || '',
      historyId: loc?.historyId || indexRow?.historyId || null,
      lat: loc?.lat ?? indexRow?.lat ?? null,
      lon: loc?.lon ?? indexRow?.lon ?? null,
      photo,
      figure: body.figure && typeof body.figure === 'object' ? body.figure : null,
      year: body.yearStart ?? indexRow?.year ?? null,
      place: body.place || indexRow?.matchedPlace || loc?.matchedPlace || '',
      archaeological: PrerenderPages.isArchaeological(body),
      coordinatesProtected: Boolean(
        body.coordinatesProtected || indexRow?.coordinatesProtected || loc?.coordinatesProtected,
      ),
      locationApproximate: Boolean(
        body.locationApproximate || indexRow?.locationApproximate || loc?.locationApproximate,
      ),
      glance: body.glance && typeof body.glance === 'object' ? body.glance : null,
      metaSource: body.metaSource === 'body' || body.metaSource === 'summary' ? body.metaSource : '',
    }
  }

  static storyPhoto(body, indexRow, photos, slug) {
    const candidates = [body?.photo, photos?.bySlug?.[slug]?.photo, indexRow?.photo]
    for (const photo of candidates) {
      if (photo?.image_url && !String(photo.image_url).includes('..')) return photo
    }
    return null
  }

  /** County fill copied from enrichStoriesCounties in src/main.js. Output is a county name only. Text guesses need "<Name> County" (src/county-guess.js). */
  static enrichCounties(stories, { centroids, historyFeatures, locations }) {
    const countyFromText = countyMatcher(Object.keys(centroids))
    const historyById = new Map()
    const historyByName = new Map()
    for (const f of historyFeatures) {
      const p = f.properties || {}
      if (p.id) historyById.set(p.id, p)
      if (p.name) historyByName.set(String(p.name).toLowerCase(), p)
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
        // A county-centroid pin's matchedPlace is the county name itself.
        county = countyFromText(`${s.matchedPlace || loc.matchedPlace || ''} County`)
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

  /** Pin -> story slug, mirroring slugForPlaceProps in src/main.js (#339). */
  static pinStorySlugs(root, stories) {
    const known = new Set(stories.map((st) => st.slug))
    const file = path.join(root, 'public/content/stories-locations.json')
    const locations = fs.existsSync(file) ? PrerenderPages.readJson(file) : {}
    const byHistoryId = new Map()
    for (const row of Object.values(locations || {})) {
      if (row?.historyId && row.slug && !byHistoryId.has(row.historyId)) byHistoryId.set(row.historyId, row.slug)
    }
    for (const row of Object.values(locations || {})) {
      for (const extra of Array.isArray(row?.alsoHistoryIds) ? row.alsoHistoryIds : []) {
        if (extra && row.slug && !byHistoryId.has(extra)) byHistoryId.set(extra, row.slug)
      }
    }
    return (p) => {
      const direct = p?.slug != null ? String(p.slug) : ''
      if (direct && known.has(direct)) return direct
      const id = p?.id != null ? String(p.id) : ''
      if (id && known.has(id)) return id
      const hid = p?.historyId != null ? String(p.historyId) : id
      const slug = hid ? byHistoryId.get(hid) : null
      return slug && known.has(slug) ? slug : null
    }
  }

  static async loadLayers(root, stories = []) {
    const slugFor = PrerenderPages.pinStorySlugs(root, stories)
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
            storySlug: slugFor(p),
          }
        })
        .filter((p) => p.name)
        .sort((a, b) => a.name.localeCompare(b.name) || a.county.localeCompare(b.county))
      const featuredStorySlug = featured ? slugFor(featured) : null
      return { ...def, intro, highlight, featured, featuredStorySlug, places }
    })
  }

  static storyPictureHtml(src, alt, { priority = false, webp = '' } = {}) {
    const size = PrerenderPages.photoSizes?.[src]
    const dim =
      size?.width && size?.height ? ` width="${Number(size.width)}" height="${Number(size.height)}"` : ''
    const loading = priority
      ? ' loading="eager" fetchpriority="high" data-lcp="story-photo"'
      : ' loading="lazy"'
    const img = `<img src="${PrerenderPages.escapeHtml(src)}" alt="${alt}"${dim}${loading} decoding="async" />`
    const meta = PrerenderPages.photoVariants?.[src]
    if (!meta?.avif?.length && !meta?.webp?.length) {
      const sibling = String(webp || '').trim()
      if (sibling && sibling !== src && sibling.startsWith('/people/portraits/') && sibling.endsWith('.webp')) {
        return `<picture><source srcset="${PrerenderPages.escapeHtml(sibling)}" type="image/webp" />${img}</picture>`
      }
      return img
    }
    const sizes = '(max-width: 600px) 100vw, 220px'
    const source = (type, list) => {
      if (!list?.length) return ''
      const srcset = list.map((v) => `${PrerenderPages.escapeHtml(v.src)} ${Number(v.w)}w`).join(', ')
      return `<source type="${type}" srcset="${srcset}" sizes="${sizes}" />`
    }
    return `<picture>${source('image/avif', meta.avif)}${source('image/webp', meta.webp)}${img}</picture>`
  }

  static photoAbsolute(url) {
    if (!url) return ''
    if (/^https?:\/\//i.test(url)) return url
    return `${PrerenderPages.SITE}${url.startsWith('/') ? url : `/${url}`}`
  }

  /** AI face and culture-figure art stays on the story page. It is not an og, twitter, or schema image. */
  static isAiArtUrl(url) {
    const v = String(url || '')
    return v.includes('/figures/') || v.includes('__ai')
  }

  /** "Photo: Name / Wikimedia Commons, " (license follows), or "Illustration: Kentucky History Drive, " for AI art. */
  static peopleCreditName(person) {
    const raw = String(person.credit || '')
    // AI credits already open with 'AI illustration · '; the card label says 'Illustration:', so drop the prefix.
    // Non-AI credits skip that replace. A never-matching pattern would replace the empty string with itself.
    const withoutAiLabel = person.ai ? raw.replace(/^AI illustration\s*·\s*/i, '') : raw
    const name = withoutAiLabel
      .replace(/\s*·\s*via Wikimedia Commons\s*$/i, '')
      .replace(new RegExp(`\\s*·\\s*${String(person.license || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`), '')
      .replace(/^[^\n:]*\.(?:jpe?g|png|tiff?):\s*/i, '')
      .replace(/\s*\n\s*/g, '; ')
      .replace(/\s*\(talk\)/g, '')
      .replace(/^probably H\.B\. Hall \(.*$/i, 'Probably H. B. Hall')
      .replace(/^\.;\s*The original uploader was (\S+) at English Wikipedia$/i, 'Unknown (uploaded by $1, English Wikipedia)')
      .replace(/Up-loaded by [^.]*?no name associated with art/i, 'Unknown artist')
      .replace(/John Frost, L\.L\. D\. is the author of the book; illustrator is not identified/i, 'Unknown illustrator (book by John Frost)')
      .replace(/\.\s*$/, '')
      .trim()
    return name || 'Unknown'
  }

  static peopleCreditLead(person) {
    const viaCommons = /via Wikimedia Commons/i.test(String(person.credit || ''))
    // AI art: the pill already says 'AI illustration', so the credit is just the maker (and any
    // 'no known likeness' note), e.g. 'Kentucky History Drive · no known likeness exists'.
    if (person.ai) return PrerenderPages.peopleCreditName(person).replace(/\s*;\s*/g, ' · ')
    return `Photo: ${PrerenderPages.peopleCreditName(person)}${viaCommons ? ' / Wikimedia Commons' : ''}, `
  }

  static storyCreditHtml(photo, title, { priority = false } = {}) {
    if (!photo?.image_url) return ''
    const caption = PrerenderPages.escapeHtml(PrerenderPages.photoAlt(photo, title))
    const capYear = photoCaptionYear(photo)
    const year = capYear ? ` <span class="muted">(${PrerenderPages.escapeHtml(capYear)})</span>` : ''
    const href = PrerenderPages.escapeHtml(photo.source_url || photo.image_url)
    const img = PrerenderPages.storyPictureHtml(photo.image_url, caption, { priority, webp: photo.webp })
    const linkLabel = PrerenderPages.escapeHtml(
      `Open ${photo.source_label || photo.credit || 'photo source'}: ${photo.title || title || 'story photo'} (opens in a new tab)`,
    )
    return `<figure class="usp-today-photo story-sidebar-photo">
      <a class="story-sidebar-photo-frame${photo.fit === 'contain' ? ' is-contain' : ''}" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${linkLabel}">
        ${img}
      </a>
      <figcaption>
        <p class="story-sidebar-photo-cap">${caption}${year}</p>
        ${photoCreditHtml(photo)}
      </figcaption>
    </figure>`
  }

  static layerCreditHtml(photo) {
    if (!photo?.image_url) return ''
    const capYear = photoCaptionYear(photo)
    const year = capYear ? ` <span class="muted">(${PrerenderPages.escapeHtml(capYear)})</span>` : ''
    const caption = PrerenderPages.escapeHtml(photo.title || 'Layer photo')
    const img = PrerenderPages.escapeHtml(photo.image_url)
    const href = PrerenderPages.escapeHtml(photo.source_url || photo.image_url)
    const linkLabel = PrerenderPages.escapeHtml(
      `Open ${photo.source_label || photo.credit || 'photo source'}: ${photo.title || 'layer photo'} (opens in a new tab)`,
    )
    return `<figure class="story-sidebar-photo">
      <a class="story-sidebar-photo-frame" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${linkLabel}">
        <img src="${img}" alt="${caption}" loading="lazy" />
      </a>
      <figcaption>
        <p class="story-sidebar-photo-cap">${caption}${year}</p>
        ${photoCreditHtml(photo)}
      </figcaption>
    </figure>`
  }

  static learnMoreHtml(markdown, storyTitle = '') {
    return learnMoreBlockHtml(learnMoreItemsFromMarkdown(markdown), { storyTitle })
  }

  /** 112px opt thumbnail when the build has written it. Otherwise the card uses the pin tile. */
  static existingThumb(story) {
    const src = storyThumbSrc(story)
    if (!src) return ''
    const abs = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', src.replace(/^\//, ''))
    return fs.existsSync(abs) ? src : ''
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

  /** Autodiscovery for the stories feed. Homepage source carries the same tag. */
  static rssAlternateLink() {
    return `<link rel="alternate" type="application/rss+xml" title="Kentucky History Drive stories" href="${PrerenderPages.SITE}/feed.xml" />`
  }

  static shell({ title, ogTitle = '', description, canonical, cssHrefs, image, imageAlt, imageWidth = 0, imageHeight = 0, main, jsonLd = '', ogType = 'article', activeRoute = '', routeLightbox = false, storyPageScript = false, rss = false, robots = '', ads = true, articleMeta = null, markdownHref = '', wayfinderHtml = '', bodyClass = '' }) {
    const t = PrerenderPages.escapeHtml(title)
    const ogt = PrerenderPages.escapeHtml(ogTitle || title)
    const d = PrerenderPages.escapeHtml(description)
    const c = PrerenderPages.escapeHtml(canonical)
    const mdLink = markdownHref ? `<link rel="alternate" type="text/markdown" href="${PrerenderPages.escapeHtml(markdownHref)}" />` : ''
    const artTags = articleMeta
      ? [
          articleMeta.published ? `<meta property="article:published_time" content="${PrerenderPages.escapeHtml(articleMeta.published)}" />` : '',
          articleMeta.modified ? `<meta property="article:modified_time" content="${PrerenderPages.escapeHtml(articleMeta.modified)}" />` : '',
          articleMeta.author ? `<meta property="article:author" content="${PrerenderPages.escapeHtml(articleMeta.author)}" />` : '',
          articleMeta.section ? `<meta property="article:section" content="${PrerenderPages.escapeHtml(articleMeta.section)}" />` : '',
        ].filter(Boolean).join('\n    ')
      : ''
    const imgUrl = image || PrerenderPages.LOGO
    const large = Boolean(image) && image !== PrerenderPages.LOGO
    const altText = imageAlt || 'Kentucky History Drive official seal'
    const dims =
      imageWidth && imageHeight
        ? `<meta property="og:image:width" content="${Number(imageWidth)}" />
    <meta property="og:image:height" content="${Number(imageHeight)}" />`
        : ''
    const img = `<meta property="og:image" content="${PrerenderPages.escapeHtml(imgUrl)}" />
    <meta property="og:image:secure_url" content="${PrerenderPages.escapeHtml(imgUrl)}" />
    <meta property="og:image:type" content="${PrerenderPages.imageType(imgUrl)}" />
    <meta property="og:image:alt" content="${PrerenderPages.escapeHtml(altText)}" />
    ${dims}
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
    ${robots ? `<meta name="robots" content="${PrerenderPages.escapeHtml(robots)}" />` : ''}
    ${c ? `<link rel="canonical" href="${c}" />` : ''}
    ${rss ? PrerenderPages.rssAlternateLink() : ''}
    ${mdLink}
    <meta property="og:type" content="${PrerenderPages.escapeHtml(ogType)}" />
    <meta property="og:site_name" content="Kentucky History Drive" />
    <meta property="og:locale" content="en_US" />
    ${c ? `<meta property="og:url" content="${c}" />` : ''}
    <meta property="og:title" content="${ogt}" />
    <meta property="og:description" content="${d}" />
    ${artTags}
    ${img}
    <meta name="twitter:title" content="${ogt}" />
    <meta name="twitter:description" content="${d}" />
    ${faviconLinksHtml('    ')}
    ${gtagHeadHtml()}
    ${jsonLd}
    ${cssHrefs.map((href) => `<link rel="stylesheet" href="${PrerenderPages.escapeHtml(href)}" />`).join('\n    ')}
    <style>
      .static-read { max-width: 52rem; margin: 0 auto; padding: 1.25rem 1.25rem 3rem; }
      .static-kicker { margin: 0 0 0.35rem; color: var(--accent); font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
      .story-head h1, .about-page-title { color: var(--heading); font-size: clamp(1.7rem, 4vw, 2.45rem); line-height: 1.15; margin: 0.35rem 0 0.75rem; }
      .story-lead { font-size: 1.125rem; line-height: 1.5; margin: 0 0 1rem; }
      .story-crumbs { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin: 0 0 0.85rem; font-size: 0.85rem; color: var(--muted); }
      .story-crumbs a { color: var(--accent); text-decoration: none; }
      .story-crumbs [aria-current="page"] { color: var(--text); }
      .static-cta { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1.25rem 0; align-items: center; }
      .place-list { columns: 2; gap: 1.5rem; padding: 0; margin: 0.5rem 0 0; list-style: none; }
      .place-list li { break-inside: avoid; margin: 0 0 0.45rem; }
      .foot a { color: var(--accent); }
      .route-map { margin: 1.75rem 0 0.5rem; scroll-margin-top: 9rem; }
      @media (max-width: 1400px) and (min-width: 601px) { .route-map { scroll-margin-top: 6.75rem; } }
      @media (max-width: 600px) { .route-map { scroll-margin-top: 4.25rem; } }
      .route-map h2, .route-map h3 { color: var(--heading); }
      .route-map-picture { display: block; }
      .route-map-picture img { display: block; width: 100%; height: auto; object-fit: contain; background: var(--panel); border-radius: 12px; }
      .route-map-zoom { position: relative; display: block; }
      .route-map-open { display: block; width: 100%; margin: 0; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: zoom-in; }
      .route-map-art { position: relative; display: block; overflow: hidden; border-radius: 12px; }
      .route-map-overlay { position: absolute; inset: 0; pointer-events: none; }
      .route-map-expand { position: absolute; top: 0.55rem; right: 0.55rem; z-index: 2; margin: 0; }
      .route-map-caption { margin: 0.35rem 0 0.85rem; color: var(--muted); font-size: 0.95rem; line-height: 1.45; }
      .route-map-caption-phone { display: none; }
      .route-map-phone-note { display: none; margin: 0.15rem 0 0.75rem; color: var(--muted); font-size: 0.85rem; line-height: 1.4; }
      .route-map-phone-note a { color: var(--accent); }
      @media (max-width: 699px) {
        .route-map-phone-note { display: block; }
        .has-phone-caption .route-map-caption-desk { display: none; }
        .route-map-caption-phone { display: block; }
      }
      .route-waypoints { margin: 0.35rem 0 0.85rem; padding-left: 1.25rem; }
      .route-waypoints li { margin: 0 0 0.35rem; }
      .route-links ul, .route-index-list { list-style: none; margin: 0; padding: 0; }
      .route-links li { margin: 0 0 0.4rem; }
      .route-card { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 0.85rem; align-items: center; margin: 0 0 0.85rem; padding: 0.65rem; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); color: inherit; text-decoration: none; }
      .route-card-link { color: inherit; text-decoration: none; }
      .route-card-copy { min-width: 0; }
      .route-card h2 { margin: 0 0 0.25rem; font-size: 1.15rem; color: var(--heading); }
      .route-card p { margin: 0; }
      .route-card-map { display: inline-flex; align-items: center; margin-top: 0.55rem; min-height: 44px; }
      @media (max-width: 700px) { .place-list { columns: 1; } .route-card { grid-template-columns: 1fr; } }
      .static-read:has(.people-page) { max-width: 76rem; }
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
  <body${bodyClass ? ` class="${PrerenderPages.escapeHtml(bodyClass)}"` : ''}>
    ${PrerenderPages.siteHeader(activeRoute)}
    ${wayfinderHtml}
    <main id="content" class="static-read" tabindex="-1">
      ${main}
    </main>
    ${siteFooterHtml(ads ? privacyChoicesLinkHtml() : '')}
    ${ads ? deferredAdsenseLoaderHtml() : ''}
    ${ads ? privacyChoicesBootHtml() : ''}
    ${staticPageBootHtml()}
    ${PrerenderPages.siteChromeScript()}
    ${routeMapThemeScript()}
    ${routeLightbox ? '<script src="/route-map-lightbox.js" defer></script>' : ''}
    ${storyPageScript ? '<script src="/story-page.js" defer></script>' : ''}
  </body>
</html>
`
  }

  /** Two or more specific tags, then county, then distance. Title is only a tiebreak. */
  static relatedStories(story, all, excludeSlugs = []) {
    return pickRelatedStories(story, all, excludeSlugs, { isProtected: (s) => isProtectedStory(s) })
  }

  static relatedCardMeta(story) {
    const bits = ['Story']
    if (story.county) bits.push(PrerenderPages.countyLabel(story.county, true))
    const years = PrerenderPages.formatYearRange(story.yearStart, story.yearEnd, story.approxStart)
    if (years) bits.push(years)
    return bits.join(' · ')
  }

  static relatedAndNearbySection(story, all, markers, relatedBundle = null, extraExcludeMarkerIds = []) {
    const route = routeBySlug(story.slug)
    // Never repeat a story already in the Related people & stories box.
    const peopleSlugs = relatedBundle
      ? relatedBlockSlugs(relatedBundle.data, story.slug, (slug) => all.find((item) => item.slug === slug)?.title || '', { personFor: relatedBundle.personFor })
      : []
    const routeSlugs = [...(route?.relatedStories || []), ...peopleSlugs]
    const routeMarkerIds = [
      ...(route?.markers || []).map((marker) => String(marker.number)),
      ...(extraExcludeMarkerIds || []).map(String),
    ]
    return relatedAndNearbyForStory(story, all, markers, {
      excludeSlugs: routeSlugs,
      excludeMarkerIds: [...new Set(routeMarkerIds)],
      limit: 3,
      thumbFor: (item) => PrerenderPages.existingThumb(item),
      portraitFor: (slug) => (relatedBundle ? portraitThumbSrc(relatedBundle.portraits.get(slug) || relatedBundle.personFor.get(slug)) : ''),
      personFor: (slug) => (relatedBundle ? relatedBundle.portraits.get(slug) || relatedBundle.personFor.get(slug) || null : null),
      whyFor: (s, other) => computeRelatedNote(s, other),
      collapsible: true,
      isProtected: (s) => isProtectedStory(s),
    })
  }

  /** Photo pages use an ImageObject so width and height match og:image. A route map stays in the list. */
  static articleImageField(image, imageWidth, imageHeight, routeLd) {
    const photoSized = image && image !== PrerenderPages.LOGO && Number(imageWidth) > 0 && Number(imageHeight) > 0
    const photoNode = photoSized
      ? {
          '@type': 'ImageObject',
          url: image,
          width: Number(imageWidth),
          height: Number(imageHeight),
        }
      : null
    if (photoNode && routeLd) return [photoNode, routeLd.contentUrl]
    if (photoNode) return photoNode
    if (routeLd) return [routeLd.contentUrl]
    if (image && image !== PrerenderPages.LOGO) return [image]
    return undefined
  }

  static personEntityNode(person) {
    if (!person?.name) return null
    const id = person.id ? `${PrerenderPages.SITE}/people/#${encodeURIComponent(person.id)}` : undefined
    const node = {
      '@type': 'Person',
      ...(id ? { '@id': id, url: id } : {}),
      name: String(person.name),
    }
    const sameAs = []
    if (person.wikidata && /^Q\d+$/.test(String(person.wikidata))) {
      sameAs.push(`https://www.wikidata.org/wiki/${person.wikidata}`)
    }
    if (person.wikipedia && /^https?:\/\//i.test(String(person.wikipedia))) {
      sameAs.push(String(person.wikipedia))
    }
    if (person.grokipedia && /^https?:\/\//i.test(String(person.grokipedia))) {
      sameAs.push(String(person.grokipedia))
    }
    if (Array.isArray(person.sameAs)) {
      for (const u of person.sameAs) {
        if (u && !sameAs.includes(u)) sameAs.push(String(u))
      }
    }
    if (sameAs.length) node.sameAs = sameAs
    return node
  }

  static storyJsonLd(story, description, image, imageAlt, layer, imageWidth, imageHeight, counties = [], peopleInStory = [], subjectPerson = null) {
    const canonical = `${PrerenderPages.SITE}/stories/${story.slug}/`
    const geo = PrerenderPages.publicGeo(story)
    const placeName = story.matchedPlace || story.title
    const placeId = `${canonical}#place`
    const place = {
      '@type': 'Place',
      '@id': placeId,
      name: placeName,
    }
    const primaryCounty = counties[0] || story.county || ''
    const countyLocality = primaryCounty ? PrerenderPages.countyLabel(primaryCounty, true) : ''
    if (countyLocality) {
      place.containedInPlace = {
        '@type': 'AdministrativeArea',
        name: `${countyLocality}, Kentucky`,
      }
    }
    if (geo) {
      place.geo = { '@type': 'GeoCoordinates', latitude: geo.lat, longitude: geo.lon }
    }
    const route = routeBySlug(story.slug)
    const routeLd = route ? routeMapJsonLd(route, { canonical, title: story.title }) : null
    if (routeLd) place.hasMap = { '@id': routeLd.imageObject['@id'] }
    const dates = PrerenderPages.articleDates(story)
    const imageField = PrerenderPages.articleImageField(image, imageWidth, imageHeight, routeLd)
    const subjectNode = subjectPerson ? PrerenderPages.personEntityNode(subjectPerson) : null
    const aboutList = subjectNode ? [subjectNode, { '@id': placeId }] : [{ '@id': placeId }]
    const mentionsList = (peopleInStory || [])
      .filter((p) => p?.name && (!subjectPerson || p.id !== subjectPerson.id))
      .map((p) => PrerenderPages.personEntityNode(p))
      .filter(Boolean)
    const article = {
      '@type': 'Article',
      '@id': `${canonical}#article`,
      headline: story.title,
      description,
      mainEntityOfPage: canonical,
      url: canonical,
      isPartOf: { '@id': PrerenderPages.WEBSITE_ID },
      inLanguage: 'en-US',
      ...(imageField !== undefined ? { image: imageField } : {}),
      ...(dates.published ? { datePublished: dates.published } : {}),
      ...(dates.modified ? { dateModified: dates.modified } : {}),
      author: { '@type': 'Person', '@id': `${PrerenderPages.SITE}/about/#shannon-snowden`, name: 'Shannon Snowden', url: `${PrerenderPages.SITE}/about/` },
      publisher: PrerenderPages.publisherNode(),
      contentLocation: { '@id': placeId },
      about: aboutList.length === 1 ? aboutList[0] : aboutList,
      ...(mentionsList.length ? { mentions: mentionsList } : {}),
    }
    const level2Name = layer ? layer.label : 'Stories'
    const level2Url = layer ? `${PrerenderPages.SITE}/layers/${layer.id}/` : `${PrerenderPages.SITE}/stories/`
    const crumbs = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` },
      { '@type': 'ListItem', position: 2, name: level2Name, item: level2Url },
      { '@type': 'ListItem', position: 3, name: story.title, item: canonical },
    ]
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
      PrerenderPages.websiteNode(),
      article,
      place,
      { '@type': 'BreadcrumbList', itemListElement: crumbs },
      video,
      routeLd?.imageObject,
      routeLd?.itemList,
    ])
  }

  static crumbHtml(story, layer) {
    const esc = PrerenderPages.escapeHtml
    const level2Href = layer ? `/layers/${esc(layer.id)}/` : '/stories/'
    const level2Label = layer ? esc(layer.label) : 'Stories'
    return `<nav class="story-crumbs usp-crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="story-crumbs-sep" aria-hidden="true">/</span><a href="${level2Href}">${level2Label}</a><span class="story-crumbs-sep" aria-hidden="true">/</span><span aria-current="page">${esc(story.title)}</span></nav>`
  }

  static loadHistoricalMarkers(root) {
    const file = path.join(root, 'public/data/markers.geojson')
    const collection = PrerenderPages.readJson(file)
    const markers = markerRecords(collection.features)
    const ids = new Set(markers.map((marker) => marker.id))
    if (markers.length < 3 || ids.size !== markers.length) {
      throw new Error(`prerender: expected unique historical markers, found ${markers.length}`)
    }
    return markers
  }

  static _storyDrives = null
  /** Story -> drive ids, read from the drive pages (scripts/story-drives-lib.mjs). */
  static storyDriveData() {
    if (!PrerenderPages._storyDrives) {
      PrerenderPages._storyDrives = storyDrives(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
    }
    return PrerenderPages._storyDrives
  }

  static loadResearch(root) {
    const dir = path.join(root, 'public/content/research')
    if (!fs.existsSync(dir)) return []
    const notes = []
    for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.json')).sort()) {
      const data = PrerenderPages.readJson(path.join(dir, name))
      const slug = PrerenderPages.safeSegment(data.slug, 'research slug')
      if (`${slug}.json` !== name) throw new Error(`prerender: research file ${name} slug is ${data.slug}`)
      PrerenderPages.safeSegment(data.storySlug, 'research storySlug')
      if (!String(data.title || '').trim()) throw new Error(`prerender: research ${slug} is missing a title`)
      notes.push(data)
    }
    return notes
  }

  static researchPage(notes, cssHrefs, story = null) {
    const article = researchNotesHtml(notes)
    const urlPath = `/research/${notes.slug}/`
    const pageUrl = `${PrerenderPages.SITE}${urlPath}`
    if (!article) throw new Error(`prerender: ${urlPath} did not render`)
    // SEO 10/18: research metas stay at 155 or less; titles at 60 or less (suffix only when it fits).
    // Same clean-cut rules as stories. Research summaries are often verbless noun phrases, so a
    // comma/semicolon/dash clause cut is allowed without a verb before falling back to a word cut.
    const metaOpts = { nextSentence: true, verbless: true }
    const description = PrerenderPages.storyMetaDescription(notes.summary, 155, metaOpts)
    PrerenderPages.assertStoryMeta(description, notes.summary, urlPath, 155, metaOpts)
    const rawTitle = String(notes.seoTitle || notes.title).trim()
    const hasResearchWord = /research|notes|sources|evidence/i.test(rawTitle)
    const baseTitle = hasResearchWord
      ? rawTitle
      : `${rawTitle} — Research notes`.length <= 60
        ? `${rawTitle} — Research notes`
        : `Research: ${rawTitle}`.length <= 60
          ? `Research: ${rawTitle}`
          : `${rawTitle.slice(0, 47).replace(/\s+\S*$/, '')} (Research)`
    const suffixed = `${baseTitle} · Kentucky History Drive`
    const title = suffixed.length <= 60 ? suffixed : baseTitle
    if (title.length > 60) throw new Error(`prerender: ${urlPath} title is ${title.length} characters`)
    return PrerenderPages.shell({
      title,
      description,
      canonical: `${PrerenderPages.SITE}${urlPath}`,
      cssHrefs,
      image: PrerenderPages.LOGO,
      imageAlt: 'Kentucky History Drive official seal',
      ogType: 'article',
      main: article,
      // v2 Phase 5 (#340): culture image-evidence pages are noindex until they move to /editorial/.
      robots: PrerenderPages.THIN_ROBOTS,
      jsonLd: PrerenderPages.researchJsonLd(notes, pageUrl, description, story),
    })
  }

  /** Research page: an Article about / based on the story's Article, plus breadcrumbs back to it. */
  static researchLinkTopic(title) {
    return String(title || '').replace(/^the\s+/i, '').replace(/\s*\(.*\)\s*$/, '')
  }

  static researchJsonLd(notes, pageUrl, description, story) {
    const storyUrl = `${PrerenderPages.SITE}/stories/${notes.storySlug}/`
    const storyRef = { '@type': 'Article', '@id': `${storyUrl}#article`, url: storyUrl, headline: story?.title || notes.title }
    const node = {
      '@type': 'Article',
      '@id': `${pageUrl}#research`,
      headline: notes.title,
      description,
      url: pageUrl,
      mainEntityOfPage: pageUrl,
      about: storyRef,
      isBasedOn: storyRef,
      ...(notes.updated ? { dateModified: notes.updated } : {}),
      author: { '@type': 'Person', name: 'Shannon Snowden', url: `${PrerenderPages.SITE}/about/` },
      publisher: PrerenderPages.publisherNode(),
    }
    const crumbs = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` },
      { '@type': 'ListItem', position: 2, name: story?.title || notes.storySlug, item: storyUrl },
      { '@type': 'ListItem', position: 3, name: 'Research notes', item: pageUrl },
    ]
    return PrerenderPages.jsonLdScript([PrerenderPages.organizationNode(), node, { '@type': 'BreadcrumbList', itemListElement: crumbs }])
  }

  static storyPage(story, all, cssHrefs, layers, markers = [], relatedBundle = null, notes = null) {
    const esc = PrerenderPages.escapeHtml
    const title = storyDocTitle(story)
    const bodyPlain = PrerenderPages.plainText(story.bodyMarkdown)
    const summary = PrerenderPages.finishedSummary(story.summary)
    const description = PrerenderPages.storyDescription(story)
    const canonical = `${PrerenderPages.SITE}/stories/${story.slug}/`
    const years = PrerenderPages.formatYearRange(story.yearStart, story.yearEnd, story.approxStart)
    const route = routeBySlug(story.slug)
    const matchedMarkers = matchStoryMarkers(story, markers, notes, route)
    const counties = storyCountiesList(story, matchedMarkers)
    const countyBadge = formatCountiesBadge(counties)
    const eraText = storyEraLabel(story.era)
    const county = story.county ? PrerenderPages.countyLabel(story.county, true) : ''
    const layer = PrerenderPages.storyLayer(story, layers)
    let lead =
      PrerenderPages.firstSentence(story.bodyMarkdown) ||
      PrerenderPages.firstSentence(summary) ||
      story.title
    const sourceBody = PrerenderPages.stripSourceAttribution(story.bodyMarkdown || '')
    let strippedBody = PrerenderPages.bodyWithoutLead(sourceBody, lead)
    // When the body's opening can't be lifted out (e.g. it holds a link), the standfirst would repeat it;
    // show the KY History summary instead (Critiquito #348).
    // Protected stories (SEO #348): never fall back to the summary or title when it carries a locator; show no standfirst instead.
    const prot = isProtectedStory(story)
    if (summary && strippedBody === sourceBody.trim() && !(prot && standfirstHasLocator(summary))) lead = summary
    if (prot && standfirstHasLocator(lead)) { lead = ''; strippedBody = sourceBody.trim() }
    const split = splitStoryMarkdown(
      markdownWithoutGlanceSection(strippedBody, Boolean(story.glance)),
      Boolean(story.glance),
    )
    const bodyHtml = renderStoryHtml(split.mainMarkdown)
    const glanceHtml = glanceTableHtml(story.glance, notes)
    const isFolded = Boolean(notes && isFoldedResearch(notes))
    const researchHref = notes && !isFoldedResearch(notes) ? researchPageHref(notes.slug) : ''
    const researchLink = researchHref
      ? `<p class="story-research-link"><a href="${esc(researchHref)}">Research notes and sources for the ${esc(PrerenderPages.researchLinkTopic(story.title))}</a></p>`
      : ''
    // #337: /#timeline/<slug> now forwards to this page, so Back goes to the Timeline list.
    const appHref = '/#timeline'
    const photo = story.photo?.image_url ? story.photo : null
    // Visible hero can be AI art. Social and schema images cannot.
    const socialPhoto = photo && !PrerenderPages.isAiArtUrl(photo.image_url) ? photo : null
    const image = socialPhoto ? PrerenderPages.photoAbsolute(socialPhoto.image_url) : PrerenderPages.LOGO
    const imageAlt = socialPhoto ? PrerenderPages.photoAlt(socialPhoto, story.title) : 'Kentucky History Drive official seal'
    const describeStory = (slug) => {
      const item = all.find((entry) => entry.slug === slug)
      if (!item) return null
      return { title: item.title, meta: PrerenderPages.relatedCardMeta(item) }
    }
    const ogImage = socialPhoto ? image : route ? absoluteUrl(route.files.fullPng) : image
    const ogAlt = socialPhoto ? imageAlt : route ? route.alt : imageAlt
    const film = filmForStory(story.slug)
    const filmDescription = film ? filmDescriptionFromPlain(bodyPlain) : ''
    const filmHtml = film
      ? filmPlayerHtml(film, {
          summary: filmDescription,
          headingLevel: 2,
          moreHtml: '<a href="/videos/">All videos</a>',
          transcript: PrerenderPages.transcriptForFilm(film),
        })
      : ''
    const portraitPick = PrerenderPages.storyPortrait(story, relatedBundle)
    // Hero photo is already this face (portraits-strip drop). Do not also float the lead portrait.
    const heroIsFace = heroPhotoIsPortrait(photo, portraitPick.person)
    const peopleParts = PrerenderPages.storyPeopleParts(story, lead, bodyHtml, relatedBundle, { showLeadPortrait: !heroIsFace })

    const yr = (v) => (Number.isFinite(Number(v)) ? Number(v) : 9999)
    const timelineOrdered = [...all].sort(
      (a, b) =>
        yr(a.yearStart) - yr(b.yearStart) ||
        yr(a.yearEnd) - yr(b.yearEnd) ||
        String(a.title).localeCompare(String(b.title)) ||
        String(a.slug).localeCompare(String(b.slug)),
    )
    const timelineIdx = Math.max(0, timelineOrdered.findIndex((s) => s.slug === story.slug))
    const timelinePos = timelineIdx + 1
    const timelineTotal = timelineOrdered.length
    const prevStory = timelineNeighbor(timelineOrdered, timelineIdx, -1, story.slug)
    const nextStory = timelineNeighbor(timelineOrdered, timelineIdx, 1, story.slug)

    const wfYear = story.yearStart != null ? ` · ${story.approxStart && story.yearStart >= 0 ? 'c. ' : ''}${story.yearStart < 0 ? `${Math.abs(story.yearStart)} BCE` : story.yearStart}` : (years ? ` · ${years}` : '')
    const prevBtn = prevStory
      ? `<a class="usp-wf-btn" href="/stories/${esc(prevStory.slug)}/" rel="prev" title="Previous in timeline: ${esc(prevStory.title)} (${esc(PrerenderPages.formatYearRange(prevStory.yearStart, prevStory.yearEnd))})"><span aria-hidden="true">←</span> <span class="usp-wf-btn-label">Prev</span></a>`
      : `<span class="usp-wf-btn is-disabled" aria-disabled="true"><span aria-hidden="true">←</span> <span class="usp-wf-btn-label">Prev</span></span>`
    const nextBtn = nextStory
      ? `<a class="usp-wf-btn" href="/stories/${esc(nextStory.slug)}/" rel="next" title="Next in timeline: ${esc(nextStory.title)} (${esc(PrerenderPages.formatYearRange(nextStory.yearStart, nextStory.yearEnd))})"><span class="usp-wf-btn-label">Next</span> <span aria-hidden="true">→</span></a>`
      : `<span class="usp-wf-btn is-disabled" aria-disabled="true"><span class="usp-wf-btn-label">Next</span> <span aria-hidden="true">→</span></span>`

    const wayfinderHtml = `<nav class="usp-wayfinder" aria-label="Story navigation">
      <div class="usp-wayfinder-inner">
        <a class="usp-wf-back" href="${esc(appHref)}" data-back-to-timeline>
          <span aria-hidden="true">←</span>
          <span class="usp-wf-back-full">Back to Timeline${esc(wfYear)}</span>
          <span class="usp-wf-back-short">Timeline</span>
        </a>
        <span class="usp-wf-pos" aria-label="Story ${timelinePos} of ${timelineTotal} in timeline order">
          <span class="usp-wf-pos-full">Story <strong>${timelinePos}</strong> of ${timelineTotal} in timeline order</span>
          <span class="usp-wf-pos-short"><strong>${timelinePos}</strong>/${timelineTotal}</span>
        </span>
        <div class="usp-wf-adj">
          ${prevBtn}
          ${nextBtn}
        </div>
      </div>
    </nav>`

    const tagsList = (story.tags || []).filter(
      // The era pill already names the era; drop tags that repeat it (e.g. frontier-war under Frontier).
      (t) =>
        t &&
        t !== 'kentucky' &&
        t !== story.era &&
        !(story.era && String(t).startsWith(`${story.era}-`)) &&
        !(eraText && String(t).toLowerCase().split('-')[0] === String(eraText).toLowerCase().split(/\s+/)[0]),
    )
    const tagsHtml = tagsList.length
      ? `<ul class="usp-tags" aria-label="Story topics">
          ${tagsList.map((t) => `<li><a class="usp-tag" href="/stories/?tag=${encodeURIComponent(t)}">${esc(tagLabel(t))}</a></li>`).join('')}
        </ul>`
      : ''

    const kickerPlace = countyBadge || county || 'Kentucky'
    const whenParts = []
    if (years) whenParts.push(`<time datetime="${esc(String(story.yearStart ?? ''))}">${esc(years)}</time>`)
    if (eraText) whenParts.push(`<span class="usp-era-pill">${esc(eraText)}</span>`)
    if (countyBadge || county) whenParts.push(`<span>${esc(countyBadge || county)}</span>`)

    const dates = PrerenderPages.articleDates(story)
    const wordCount = bodyPlain.split(/\s+/).filter(Boolean).length
    const pubDateLabel = dates.published || story.publishedDate || ''

    // #348: a 'Research notes' jump in the top sources/tools line on every folded story.
    const researchJumpHtml = foldedResearchJumpHtml(notes)
    const toolsRowHtml = `<div class="usp-tools" role="toolbar" aria-label="Save and share">
      <button type="button" class="usp-tool" data-print data-story-print aria-label="Save as PDF">
        <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M5 3h10v4H5V3Zm-1 5h12a2 2 0 0 1 2 2v4h-3v3H5v-3H2v-4a2 2 0 0 1 2-2Zm3 8h6v-4H7v4Z" fill="currentColor"/></svg>
        <span class="usp-tool-label">Save as PDF</span>
      </button>
      <a class="usp-tool" href="/stories/${esc(story.slug)}/story.md" download="${esc(story.slug)}.md" aria-label="Download .md">
        <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 2a1 1 0 0 1 1 1v8.59l2.3-2.3 1.4 1.42-4.7 4.7-4.7-4.7 1.4-1.42 2.3 2.3V3a1 1 0 0 1 1-1ZM4 16h12v2H4v-2Z" fill="currentColor"/></svg>
        <span class="usp-tool-label">Download .md</span>
      </a>
      <button type="button" class="usp-tool" aria-label="Share" data-share data-share-story data-story-title="${esc(story.title)}" data-story-url="${esc(canonical)}">
        <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M13 3l5 5-5 5V9.5C8 9.5 5 11 3 15c1-5 4-8 10-8.5V3Z" fill="currentColor"/></svg>
        <span class="usp-tool-label">Share</span>
      </button>
      <span class="usp-share-toast" data-share-feedback role="status" aria-live="polite" hidden></span>
      <span class="usp-tools-meta">${wordCount.toLocaleString('en-US')} words${pubDateLabel ? ` · Published <time datetime="${esc(pubDateLabel)}">${esc(pubDateLabel)}</time>` : ''}${researchJumpHtml ? ` · ${researchJumpHtml}` : ''}</span>
    </div>`

    const glanceDetailsHtml = glanceHtml
      ? `<details class="usp-details" data-glance-details>
            <summary>At a glance and where sources differ</summary>
            <div class="usp-details-body">
              ${glanceHtml}
            </div>
          </details>`
      : ''

    const todayPhotoHtml = PrerenderPages.storyCreditHtml(photo, story.title, { priority: true })
    const kentuckyTodayHtml =
      split.kentuckyTodayMarkdown || todayPhotoHtml
        ? `<section class="usp-section usp-today" id="today" data-story-section aria-labelledby="h-today">
            <h2 id="h-today">Kentucky today</h2>
            ${split.kentuckyTodayMarkdown ? `<div class="usp-prose">${renderStoryHtml(split.kentuckyTodayMarkdown)}</div>` : ''}
            ${todayPhotoHtml}
          </section>`
        : ''

    const protectedPin = isProtectedStory(story)
    const routeMarkerIdSet = new Set((route?.markers || []).map((m) => String(m.number ?? m.id ?? '')).filter(Boolean))
    const markersSectionHtml = matchedMarkers.length
      ? `<section class="usp-section usp-markers" id="markers" data-story-section aria-labelledby="h-markers">
            <h2 id="h-markers">Historical markers (${matchedMarkers.length})</h2>
            <ul class="usp-marker-list usp-markers-grid">
              ${matchedMarkers
                .map((m, idx) => {
                  const mid = String(m.id || '')
                  const mTitle = String(m.title || `Marker #${mid}`)
                  const mCounty = m.county ? PrerenderPages.countyLabel(m.county, true) : ''
                  const mLoc = String(m.location_text || '').trim()
                  const mInsc = String(m.inscription || '').trim()
                  const mSource = /^https?:\/\//i.test(String(m.source_url || '')) ? String(m.source_url) : ''
                  const mapLinkHref = routeMarkerIdSet.has(mid)
                    ? '#route-map'
                    : `/#map/markers/${encodeURIComponent(mid)}`
                  const mapLinkAttr = routeMarkerIdSet.has(mid) ? '' : ' data-story-map'
                  const pinRole = idx === 0 ? 'Story pin' : 'Second pin'
                  const mLat = Number(m.lat)
                  const mLon = Number(m.lon)
                  const hasMGeo = !protectedPin && Number.isFinite(mLat) && Number.isFinite(mLon)
                  const rLat = hasMGeo ? mLat.toFixed(4) : ''
                  const rLon = hasMGeo ? mLon.toFixed(4) : ''
                  const dirLinks = hasMGeo
                    ? `<span class="usp-marker-dirs">Directions: <a href="https://maps.apple.com/?daddr=${rLat},${rLon}" target="_blank" rel="noopener noreferrer">Apple Maps ↗</a> · <a href="https://www.google.com/maps/dir/?api=1&amp;destination=${rLat},${rLon}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a></span>`
                    : ''
                  return `<li class="usp-marker-card" id="marker-${esc(mid)}">
                    <span class="usp-marker-num" aria-label="KHS Marker #${esc(mid)}"><span class="sr-only">KHS Marker </span>#${esc(mid)}</span>
                    <div class="usp-marker-body">
                      <div class="usp-marker-title-row">
                        ${mSource ? `<a class="usp-marker-title" href="${esc(mSource)}" target="_blank" rel="noopener noreferrer">${esc(mTitle)} <span class="usp-ext" aria-hidden="true">↗</span></a>` : `<span class="usp-marker-title">${esc(mTitle)}</span>`}
                        <span class="usp-marker-role">${esc(pinRole)}</span>
                      </div>
                      ${mCounty || mLoc ? `<p class="usp-marker-loc">${esc([mLoc, mCounty].filter(Boolean).join(' · '))}</p>` : ''}
                      ${mInsc ? `<blockquote class="usp-marker-inscription">${esc(mInsc)}</blockquote>` : ''}
                      <p class="usp-marker-links">
                        <a href="${esc(mapLinkHref)}"${mapLinkAttr}>Show on map →</a>
                        ${dirLinks}
                      </p>
                    </div>
                  </li>`
                })
                .join('\n              ')}
            </ul>
          </section>`
      : ''

    const inlineMapMobileHtml = renderWhereItHappenedCard(story, matchedMarkers, 'mobile')

    const peopleInStory = resolvePeopleInStory(
      story,
      relatedBundle,
      notes,
      portraitPick.person || null,
    )
    const relatedPeopleHtml = PrerenderPages.relatedPeopleSection(story, all, relatedBundle)
    const peopleCardsHtml = peopleInStory.length
      ? `<ul class="usp-people-grid">
            ${peopleInStory
              .map((p) => {
                const imgJpg = p.image?.jpg ? String(p.image.jpg).replace(/-512\.jpg$/, '-96.jpg') : ''
                const imgWebp = p.image?.webp ? String(p.image.webp).replace(/-512\.webp$/, '-96.webp') : ''
                const avatar =
                  imgJpg && imgWebp
                    ? `<picture><source srcset="${esc(imgWebp)}" type="image/webp"><img class="usp-person-img" src="${esc(imgJpg)}" alt="" width="48" height="48" loading="lazy" decoding="async"></picture>`
                    : `<span class="usp-person-avatar" aria-hidden="true">${esc(initials(p.name || ''))}</span>`
                const href = p.id ? `/people/#${encodeURIComponent(p.id)}` : `/people/?q=${encodeURIComponent(p.name || '')}`
                return `<li>
                  <a class="usp-person-card" href="${esc(href)}">
                    ${avatar}
                    <span class="usp-person-body">
                      <span class="usp-person-name">${esc(p.name)}</span>
                      ${p.years ? `<span class="usp-person-years">${esc(p.years)}</span>` : ''}
                      ${p.role ? `<span class="usp-person-role">${esc(p.role)}</span>` : ''}
                    </span>
                  </a>
                </li>`
              })
              .join('\n            ')}
          </ul>`
      : ''
    const peopleSectionHtml =
      peopleCardsHtml || relatedPeopleHtml
        ? `<section class="usp-section usp-people" id="people" data-story-section aria-labelledby="h-people">
              <h2 id="h-people">People in this story</h2>
              ${peopleCardsHtml}
              ${relatedPeopleHtml}
            </section>`
        : ''

    const relatedHtml = PrerenderPages.relatedAndNearbySection(
      story,
      all,
      markers,
      relatedBundle,
      matchedMarkers.map((m) => String(m.id)),
    )
    const relatedSectionHtml = relatedHtml
      ? `<section class="usp-section usp-related" id="related" data-story-section aria-labelledby="related-nearby-heading">${relatedHtml}</section>`
      : ''

    // Culture image-evidence worksheets stay on /research/. A protected story page does not repeat them.
    const unifiedSources = buildUnifiedSources(story, prot && !isFolded ? null : notes, matchedMarkers)
    const sourcesListHtml = unifiedSources.items.length
      ? `<ol class="usp-src-list">
            ${unifiedSources.items
              .map((src) => {
                const link = src.url
                  ? `<a class="usp-src-title" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.title)} <span class="usp-ext" aria-hidden="true">↗</span></a>`
                  : `<span class="usp-src-title">${esc(src.title)}</span>`
                const metaParts = [src.typeLabel, src.publisher].filter(Boolean)
                const meta = metaParts.length ? `<span class="usp-src-meta"> — ${esc(metaParts.join(' · '))}</span>` : ''
                const note = src.note ? `<span class="usp-src-note"> — ${esc(src.note)}</span>` : ''
                return `<li id="${esc(src.id)}">${link}${meta}${note}</li>`
              })
              .join('\n            ')}
          </ol>`
      : ''

    const claims = extractResearchClaims(prot ? null : notes)
    const claimsDetailsHtml = claims.length
      ? `<details class="usp-details">
            <summary>Key facts &amp; claims (${claims.length})</summary>
            <div class="usp-details-body">
              <ul class="usp-claims-list">
                ${claims
                  .map((c) => {
                    const conf = String(c.confidence || '').trim()
                    const pill = conf
                      ? `<span class="usp-claim-pill" data-confidence="${esc(conf.toLowerCase())}">${esc(conf)}</span> `
                      : ''
                    return `<li>${pill}${esc(c.claim)}</li>`
                  })
                  .join('\n                ')}
              </ul>
            </div>
          </details>`
      : ''

    const timelineItems = prot ? [] : (Array.isArray(notes?.timeline) ? notes.timeline.filter((t) => t && (t.date || t.year || t.event)) : [])
    const timelineDetailsHtml = timelineItems.length
      ? `<details class="usp-details">
            <summary>Chronology (${timelineItems.length})</summary>
            <div class="usp-details-body">
              <ul class="usp-claims-list">
                ${timelineItems
                  .map((t) => { const td = t.date || t.year || ''; return `<li><strong>${esc(td)}</strong>${td && t.event ? ': ' : ''}${esc(t.event || '')}</li>`; })
                  .join('\n                ')}
              </ul>
            </div>
          </details>`
      : ''

    const openQuestions = prot ? [] : (Array.isArray(notes?.openQuestions) ? notes.openQuestions.filter(Boolean) : [])
    const openQuestionsHtml = openQuestions.length
      ? `<details class="usp-details">
            <summary>Open questions (${openQuestions.length})</summary>
            <div class="usp-details-body">
              <ul class="usp-claims-list">
                ${openQuestions.map((q) => `<li>${esc(String(q))}</li>`).join('\n                ')}
              </ul>
            </div>
          </details>`
      : ''

    const inlineSourcesHtml = split.inlineSourcesMarkdown
      ? `<div class="usp-prose">${renderStoryHtml(split.inlineSourcesMarkdown)}</div>`
      : ''

    // #348 Critiquito: on folded stories the story's own Sources/Notes list moves inside the collapsed
    // Research notes block, and the separate Chronology / Open questions boxes (duplicates of the fold) go.
    const researchFold = isFolded
      ? foldedResearchHtml(notes, { extraSubs: inlineSourcesHtml ? [{ heading: 'Story sources and notes', html: inlineSourcesHtml }] : [] })
      : ''
    const learnMoreBlock = PrerenderPages.learnMoreHtml(story.bodyMarkdown, story.title)
    const sourcesSectionHtml = `<section class="usp-section usp-sources" id="sources" data-story-section aria-labelledby="h-sources">
          <div class="usp-sources-head">
            <h2 id="h-sources">Sources and research${unifiedSources.items.length ? ` (${unifiedSources.items.length})` : ''}</h2>
            ${researchLink}
          </div>
          ${sourcesListHtml}
          ${glanceDetailsHtml}
          ${claimsDetailsHtml}
          ${isFolded ? '' : inlineSourcesHtml}
          ${isFolded ? '' : timelineDetailsHtml}
          ${isFolded ? '' : openQuestionsHtml}
          ${learnMoreBlock}
          ${researchFold}
        </section>`

    const matchedDriveHtml = takeADriveHtml(PrerenderPages.storyDriveData(), story.slug, { isProtected: isProtectedStory(story) })
    const startTown = String(story.matchedPlace || (counties[0] ? `${counties[0]} County` : 'Danville')).split(',')[0].trim() || 'Danville'
    // Protected sites never get a route-builder entry (Critiquito #345, 10/24).
    const driveSectionHtml = isProtectedStory(story) ? '' : matchedDriveHtml
      ? `<aside class="usp-section usp-drive" id="drive" aria-label="Plan a drive">${matchedDriveHtml}</aside>`
      : `<aside class="usp-section usp-drive" id="drive" aria-labelledby="h-drive">
          <div class="usp-drive-copy">
            <p class="usp-drive-kicker">Plan a drive</p>
            <h2 id="h-drive">Build a route from ${esc(startTown)}</h2>
            <p>Combine this stop with nearby historical markers and stories in the route builder.</p>
          </div>
          <a class="usp-btn" href="/drives/build/#start=${encodeURIComponent(startTown)}">Open route builder →</a>
        </aside>`

    const citeSectionHtml = `<details class="usp-section usp-details usp-cite" id="cite" data-cite-details>
          <summary>Cite this story</summary>
          <div class="usp-cite-body">
            ${citeBoxHtml({
              title: story.title,
              url: storyCanonicalUrl(story.slug),
              published: dates.published,
              modified: dates.modified,
            })}
          </div>
        </details>
        <p class="usp-report">${correctionHtml({ title: story.title, url: storyCanonicalUrl(story.slug) })}</p>
        ${citeBootScript()}`

    const prevCardHtml = prevStory
      ? `<a class="usp-pn-card" href="/stories/${esc(prevStory.slug)}/" rel="prev">
          <span class="usp-pn-dir">← Previous in timeline · ${esc(PrerenderPages.formatYearRange(prevStory.yearStart, prevStory.yearEnd))}</span>
          <span class="usp-pn-title">${esc(prevStory.title)}</span>
        </a>`
      : `<span class="usp-pn-card is-disabled" aria-disabled="true">
          <span class="usp-pn-dir">← Start of timeline</span>
          <span class="usp-pn-title">Oldest story in timeline</span>
        </span>`
    const nextCardHtml = nextStory
      ? `<a class="usp-pn-card usp-pn-next" href="/stories/${esc(nextStory.slug)}/" rel="next">
          <span class="usp-pn-dir">Next in timeline · ${esc(PrerenderPages.formatYearRange(nextStory.yearStart, nextStory.yearEnd))} →</span>
          <span class="usp-pn-title">${esc(nextStory.title)}</span>
        </a>`
      : `<span class="usp-pn-card usp-pn-next is-disabled" aria-disabled="true">
          <span class="usp-pn-dir">End of timeline →</span>
          <span class="usp-pn-title">Most recent story in timeline</span>
        </span>`

    const prevNextSectionHtml = `<nav class="usp-prevnext" aria-label="Adjacent stories in timeline">
          ${prevCardHtml}
          ${nextCardHtml}
        </nav>
        <p class="usp-endback">
          <a href="${esc(appHref)}" data-back-to-timeline>← Back to the Timeline</a>
        </p>`

    const tocEntries = [
      { id: 'story', label: 'Story' },
      ...(kentuckyTodayHtml ? [{ id: 'today', label: 'Kentucky today' }] : []),
      ...(route ? [{ id: 'route-map', label: 'Route map' }] : []),
      ...(matchedMarkers.length ? [{ id: 'markers', label: `Historical markers (${matchedMarkers.length})` }] : []),
      ...(peopleSectionHtml ? [{ id: 'people', label: 'People in this story' }] : []),
      ...(relatedSectionHtml ? [{ id: 'related', label: 'Related stories' }] : []),
      { id: 'sources', label: `Sources and research${unifiedSources.items.length ? ` (${unifiedSources.items.length})` : ''}` },
      ...(researchJumpHtml ? [{ id: 'research-notes', label: 'Research notes' }] : []),
    ]
    const tocListHtml = `<ol class="usp-toc-list">
      ${tocEntries
        .map(
          (item, idx) =>
            `<li><a href="#${esc(item.id)}" data-toc="${esc(item.id)}" data-toc-link="${esc(item.id)}"${idx === 0 ? ' aria-current="true"' : ''}>${esc(item.label)}</a></li>`,
        )
        .join('\n      ')}
    </ol>`

    const desktopTocHtml = `<nav class="usp-toc" aria-label="On this page">
      <p class="usp-rail-head">On this page</p>
      ${tocListHtml}
    </nav>`

    const whereCardRailHtml = renderWhereItHappenedCard(story, matchedMarkers, 'rail')

    const main = `<div class="usp-grid">
        <article class="usp-article usp-page static-story${film ? ' has-film' : ''}" aria-labelledby="usp-title">
          ${PrerenderPages.crumbHtml(story, layer)}
          <header class="usp-head story-head" id="top">
            <p class="usp-kicker static-kicker">${esc(layer ? layer.label : 'Kentucky History')}</p>
            <h1 id="usp-title">${esc(story.title)}</h1>
            ${tagsHtml}
            <p class="usp-when story-card-meta">${whenParts.join(' <span aria-hidden="true">·</span> ')}</p>
            ${peopleParts.lead}
          </header>
          ${toolsRowHtml}
          <section class="usp-story" id="story" data-story-section aria-label="Story">
            <div class="story-body">${heroIsFace ? '' : PrerenderPages.storyPortraitHtml(portraitPick.person)}${PrerenderPages.storyFigureHtml(story.figure, { priority: !photo && !film })}${peopleParts.body}</div>
            ${routeMapSectionHtml(story.slug, {
              headingLevel: 2,
              linkMode: 'story',
              titleFor: (slug) => all.find((item) => item.slug === slug)?.title || '',
              describe: describeStory,
            })}
            ${filmHtml}
          </section>
          ${kentuckyTodayHtml}
          ${markersSectionHtml}
          ${inlineMapMobileHtml}
          ${peopleSectionHtml}
          ${relatedSectionHtml}
          ${sourcesSectionHtml}
          ${driveSectionHtml}
          ${citeSectionHtml}
          ${prevNextSectionHtml}
        </article>
        <aside class="usp-rail" aria-label="Map and contents">
          <div class="usp-rail-sticky">
            ${whereCardRailHtml}
            ${desktopTocHtml}
          </div>
        </aside>
      </div>`
    const imageSize = socialPhoto ? PrerenderPages.photoSizes?.[socialPhoto.image_url] : null
    const imageWidth = imageSize?.width || (!socialPhoto && route ? 1600 : 0)
    const imageHeight = imageSize?.height || (!socialPhoto && route ? 900 : 0)
    return PrerenderPages.shell({
      title,
      ogTitle: story.title,
      description,
      canonical,
      robots: isThinStory(story) ? PrerenderPages.THIN_ROBOTS : '',
      cssHrefs,
      image: ogImage,
      imageAlt: ogAlt,
      imageWidth,
      imageHeight,
      jsonLd: PrerenderPages.storyJsonLd(
        story,
        description,
        image,
        imageAlt,
        layer,
        imageWidth,
        imageHeight,
        counties,
        peopleInStory,
        portraitPick.person || null,
      ),
      articleMeta: {
        published: dates.published,
        modified: dates.modified,
        author: `${PrerenderPages.SITE}/about/`,
        section: eraText,
      },
      markdownHref: `/stories/${story.slug}/story.md`,
      wayfinderHtml,
      bodyClass: 'usp-body',
      routeLightbox: Boolean(route),
      storyPageScript: true,
      main,
      rss: true,
      activeRoute: 'stories',
    })
  }
  static STORIES_ERA_ORDER = ['prehistoric', 'native', 'frontier', 'early-commonwealth', 'other']
  /** One-story eras fold into a neighbour so no chip holds a single story. */
  static STORIES_ERA_FOLD = { revolution: 'frontier', modern: 'other' }
  static STORIES_ERA_LABEL = {
    prehistoric: 'Prehistoric',
    native: 'Native nations',
    frontier: 'Frontier',
    'early-commonwealth': 'Early commonwealth',
    other: 'More Kentucky history',
  }

  /** Group live stories by era, oldest first inside each group. Unknown eras fall into "other". */
  static storiesByEra(stories) {
    const order = PrerenderPages.STORIES_ERA_ORDER
    const groups = new Map(order.map((era) => [era, []]))
    for (const story of stories) {
      const folded = PrerenderPages.STORIES_ERA_FOLD[story.era] || story.era
      const era = order.includes(folded) ? folded : 'other'
      groups.get(era).push(story)
    }
    const year = (s) => (Number.isFinite(Number(s.yearStart)) ? Number(s.yearStart) : 99999)
    for (const list of groups.values()) list.sort((a, b) => year(a) - year(b) || String(a.title).localeCompare(String(b.title)))
    return [...groups.entries()].filter(([, list]) => list.length)
  }

  static STORIES_PIN_SVG = '<svg class="related-card-pin-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.25A6.75 6.75 0 0 0 5.25 9c0 5.06 5.7 10.9 6.4 11.55a.5.5 0 0 0 .7 0c.7-.65 6.4-6.49 6.4-11.55A6.75 6.75 0 0 0 12 2.25zm0 9.25a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>'

  /** County for the listing: the story's own county, else the one Kentucky county its title or summary names. Never guessed. */
  static storiesListCounty(story) {
    if (story.county) return PrerenderPages.countyLabel(story.county, true)
    if (!PrerenderPages._kyCounties) {
      try {
        const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'county-centroids.json')
        PrerenderPages._kyCounties = Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')))
      } catch {
        PrerenderPages._kyCounties = []
      }
    }
    const text = `${story.title || ''} ${story.summary || ''}`
    const found = new Set()
    for (const name of PrerenderPages._kyCounties) {
      if (text.includes(`${name} County`)) found.add(name)
    }
    return found.size === 1 ? PrerenderPages.countyLabel([...found][0], true) : ''
  }

  /** /stories/: every live story, grouped by era, as thumbnail cards with a text + era filter. Links work without JS. */
  static storiesIndexPage(stories, cssHrefs) {
    const esc = PrerenderPages.escapeHtml
    const pageUrl = `${PrerenderPages.SITE}/stories/`
    const groups = PrerenderPages.storiesByEra(stories)
    const ordered = groups.flatMap(([, list]) => list)
    const total = ordered.length
    const description = PrerenderPages.metaDescription(
      `All ${total} Kentucky History Drive stories, grouped by era from prehistoric mounds to the early commonwealth, with a quick filter.`,
    )
    const label = (era) => PrerenderPages.STORIES_ERA_LABEL[era] || era
    const chips = [`<button type="button" class="stories-chip" data-era="" aria-pressed="true">All <span class="stories-chip-n">${total}</span></button>`]
      .concat(groups.map(([era, list]) => `<button type="button" class="stories-chip" data-era="${esc(era)}" aria-pressed="false">${esc(label(era))} <span class="stories-chip-n">${list.length}</span></button>`))
      .join('')
    const item = (story) => {
      const meta = []
      const county = PrerenderPages.storiesListCounty(story)
      if (county) meta.push(county)
      const years = PrerenderPages.formatYearRange(story.yearStart, story.yearEnd, story.approxStart)
      if (years) meta.push(years)
      const thumb = PrerenderPages.existingThumb(story)
      const media = thumb
        ? `<span class="related-card-media stories-thumb"><img class="related-card-img" src="${esc(thumb)}" alt="" width="72" height="72" loading="lazy" decoding="async"></span>`
        : `<span class="related-card-media related-card-pin stories-thumb" aria-hidden="true">${PrerenderPages.STORIES_PIN_SVG}</span>`
      return `<li class="stories-item" data-s="${esc(story.summary || '')}"><a class="related-card stories-card" href="/stories/${esc(story.slug)}/">${media}<span class="related-card-copy"><span class="related-card-title">${esc(story.title)}</span>${meta.length ? `<span class="related-card-meta stories-meta">${esc(meta.join(' · '))}</span>` : ''}<span class="stories-why" hidden></span></span></a></li>`
    }
    const sections = groups
      .map(([era, list]) => `<section class="stories-group" data-era="${esc(era)}" aria-labelledby="stories-era-${esc(era)}">
          <h2 id="stories-era-${esc(era)}">${esc(label(era))} <span class="stories-count">(${list.length})</span></h2>
          <ul class="stories-list">${list.map(item).join('')}</ul>
        </section>`)
      .join('\n        ')
    const main = `<style>
        .static-read:has(.stories-page) { max-width: 72rem; }
        .stories-filter { display: flex; flex-direction: column; gap: 0.6rem; margin: 0 0 1rem; }
        .stories-search { position: relative; max-width: 28rem; }
        .stories-filter input { width: 100%; box-sizing: border-box; min-height: 44px; padding: 0.55rem 2.75rem 0.55rem 0.75rem; font: inherit; color: var(--text); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
        .stories-filter input::-webkit-search-cancel-button { display: none; }
        .stories-clear { position: absolute; right: 0; top: 0; width: 44px; height: 44px; border: 0; background: none; color: var(--muted); font-size: 1.4rem; line-height: 1; cursor: pointer; border-radius: 10px; }
        .stories-clear:hover, .stories-clear:focus-visible { color: var(--accent); }
        .stories-chips { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 0.5rem; }
        .stories-chip { min-height: 44px; padding: 0.4rem 0.95rem; font: inherit; font-size: 0.95rem; color: var(--text); background: var(--panel); border: 1px solid var(--muted); border-radius: 999px; cursor: pointer; }
        .stories-chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--bg, #fff); font-weight: 700; }
        .stories-chip:disabled { opacity: 0.45; cursor: default; }
        .stories-chip-n { opacity: 0.8; font-size: 0.85em; }
        .stories-status { margin: 0; color: var(--text); font-size: 0.95rem; min-height: 1.4em; }
        .stories-group h2 { position: sticky; top: var(--stories-sticky-top, 0px); scroll-margin-top: var(--stories-sticky-top, 0px); z-index: 2; background: var(--bg); color: var(--heading); margin: 1.5rem 0 0.75rem; padding: 0.5rem 0; font-size: 1.3rem; border-bottom: 1px solid var(--line); }
        .stories-count { color: var(--muted); font-weight: 400; font-size: 0.85em; }
        .stories-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
        .stories-item { display: flex; min-width: 0; margin: 0; }
        .stories-item[hidden] { display: none; }
        a.related-card.stories-card { grid-template-columns: 72px minmax(0, 1fr); min-height: 96px; }
        .stories-card .stories-thumb, .stories-card .related-card-img { width: 72px; height: 72px; }
        .stories-card .related-card-meta { -webkit-line-clamp: 1; line-clamp: 1; }
        .stories-why { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; margin-top: 0.2rem; color: var(--text); font-size: 0.85rem; line-height: 1.3; }
        .stories-why[hidden] { display: none; }
        .stories-page mark { background: color-mix(in srgb, var(--accent) 28%, transparent); color: inherit; border-radius: 3px; padding: 0 1px; }
        .stories-empty { padding: 1.25rem; border: 1px dashed var(--line); border-radius: 14px; color: var(--text); }
        .stories-empty button { margin-left: 0.5rem; min-height: 44px; padding: 0.4rem 1rem; font: inherit; color: var(--bg, #fff); background: var(--accent); border: 0; border-radius: 999px; cursor: pointer; }
        .stories-top { display: inline-block; margin-top: 1.5rem; color: var(--accent); }
        @media (min-width: 1440px) { .stories-list { grid-template-columns: repeat(3, minmax(0, 1fr)); } .static-read:has(.stories-page) { max-width: 84rem; } }
        @media (max-width: 700px) { .stories-list { grid-template-columns: minmax(0, 1fr); } a.related-card.stories-card { grid-template-columns: 64px minmax(0, 1fr); min-height: 84px; } .stories-card .stories-thumb, .stories-card .related-card-img { width: 64px; height: 64px; } }
      </style>
      <article class="stories-page" id="stories-top">
        <nav class="story-crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Stories</span>
        </nav>
        <header class="story-head">
          <p class="static-kicker">Stories</p>
          <h1>All Kentucky history stories</h1>
          <p class="story-lead">${total} stories, grouped by era and oldest first within each era. Open the <a href="/#map">map</a> or the <a href="/#timeline">timeline</a> to explore them by place and year.</p>
        </header>
        <div class="stories-filter" id="storiesFilter" hidden>
          <div class="stories-search">
            <label class="visually-hidden" for="storiesQuery">Filter stories</label>
            <input id="storiesQuery" type="search" placeholder="Filter by title, county or topic…" autocomplete="off" />
            <button type="button" class="stories-clear" id="storiesClear" aria-label="Clear filter" hidden>×</button>
          </div>
          <div class="stories-chips" role="group" aria-label="Era">${chips}</div>
          <p class="stories-status" id="storiesStatus" aria-live="polite"></p>
        </div>
        <div class="stories-empty" id="storiesEmpty" hidden><span id="storiesEmptyText">No stories match that filter.</span><button type="button" id="storiesReset">Clear filter</button></div>
        ${sections}
        <a class="stories-top" href="#stories-top">Back to top ↑</a>
      </article>
      <script>
        (function () {
          var box = document.getElementById('storiesFilter')
          if (!box) return
          box.hidden = false
          var head = document.querySelector('header.site-header')
          function stickTop() {
            var pos = head ? getComputedStyle(head).position : ''
            var h = head && (pos === 'sticky' || pos === 'fixed') ? head.getBoundingClientRect().height : 0
            document.documentElement.style.setProperty('--stories-sticky-top', Math.round(h) + 'px')
          }
          stickTop()
          window.addEventListener('resize', stickTop)
          var TOTAL = ${total}
          var input = document.getElementById('storiesQuery')
          var clear = document.getElementById('storiesClear')
          var chips = box.querySelectorAll('.stories-chip')
          var groups = document.querySelectorAll('.stories-group')
          var empty = document.getElementById('storiesEmpty')
          var emptyText = document.getElementById('storiesEmptyText')
          var status = document.getElementById('storiesStatus')
          var era = ''
          var items = []
          groups.forEach(function (g) {
            g.querySelectorAll('.stories-item').forEach(function (li) {
              var t = li.querySelector('.related-card-title')
              var m = li.querySelector('.stories-meta')
              items.push({ li: li, era: g.getAttribute('data-era'), t: t, title: t.textContent, m: m, meta: m ? m.textContent : '', why: li.querySelector('.stories-why'), sum: li.getAttribute('data-s') || '' })
            })
          })
          function paint(el, text, q) {
            while (el.firstChild) el.removeChild(el.firstChild)
            var i = q ? text.toLowerCase().indexOf(q) : -1
            if (i === -1) { el.appendChild(document.createTextNode(text)); return }
            el.appendChild(document.createTextNode(text.slice(0, i)))
            var mk = document.createElement('mark')
            mk.textContent = text.slice(i, i + q.length)
            el.appendChild(mk)
            el.appendChild(document.createTextNode(text.slice(i + q.length)))
          }
          function snippet(text, q) {
            var i = text.toLowerCase().indexOf(q)
            var start = Math.max(0, i - 50)
            var end = Math.min(text.length, i + q.length + 70)
            return { text: (start ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '') }
          }
          function apply() {
            var raw = input.value.trim()
            var q = raw.toLowerCase()
            clear.hidden = !raw
            var perEra = {}
            var allN = 0
            items.forEach(function (it) {
              var inTitle = !q || it.title.toLowerCase().indexOf(q) !== -1
              var inMeta = q && it.meta.toLowerCase().indexOf(q) !== -1
              var inSum = q && it.sum.toLowerCase().indexOf(q) !== -1
              it.hit = inTitle || inMeta || inSum
              if (it.hit) { perEra[it.era] = (perEra[it.era] || 0) + 1; allN++ }
              paint(it.t, it.title, q)
              if (it.m) paint(it.m, it.meta, q)
              if (q && !inTitle && !inMeta && inSum) {
                paint(it.why, snippet(it.sum, q).text, q)
                it.why.hidden = false
              } else {
                it.why.hidden = true
              }
            })
            chips.forEach(function (c) {
              var e = c.getAttribute('data-era')
              var n = e ? (perEra[e] || 0) : allN
              c.querySelector('.stories-chip-n').textContent = n
              c.disabled = !!e && n === 0 && era !== e
            })
            var shown = 0
            groups.forEach(function (g) {
              var on = !era || g.getAttribute('data-era') === era
              var n = 0
              items.forEach(function (it) {
                if (it.era !== g.getAttribute('data-era')) return
                var show = on && it.hit
                it.li.hidden = !show
                if (show) n++
              })
              g.hidden = n === 0
              var c = g.querySelector('.stories-count')
              if (c) c.textContent = '(' + n + ')'
              shown += n
            })
            empty.hidden = shown !== 0
            if (!shown) emptyText.textContent = raw ? 'No stories match “' + raw + '”.' : 'No stories in this era.'
            if (!raw && !era) status.textContent = 'Showing all ' + TOTAL + ' stories'
            else status.textContent = shown + ' of ' + TOTAL + (shown === 1 ? ' story matches' : ' stories match') + (raw ? ' “' + raw + '”' : '')
          }
          function reset() {
            input.value = ''
            era = ''
            chips.forEach(function (o) { o.setAttribute('aria-pressed', o.getAttribute('data-era') === '' ? 'true' : 'false') })
            apply()
            input.focus()
          }
          chips.forEach(function (c) {
            c.addEventListener('click', function () {
              era = c.getAttribute('data-era')
              chips.forEach(function (o) { o.setAttribute('aria-pressed', o === c ? 'true' : 'false') })
              apply()
            })
          })
          input.addEventListener('input', apply)
          clear.addEventListener('click', reset)
          document.getElementById('storiesReset').addEventListener('click', reset)
          // ?q= from the 404 page's search form fills the filter (shown as text only).
          try {
            var q0 = new URLSearchParams(location.search).get('q')
            if (q0) input.value = String(q0).slice(0, 100)
          } catch (e) {}
          apply()
        })()
      </script>`
    const jsonLd = PrerenderPages.jsonLdScript([
      PrerenderPages.organizationNode(),
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'All Kentucky history stories',
        description,
        isPartOf: { '@type': 'WebSite', name: 'Kentucky History Drive', url: `${PrerenderPages.SITE}/` },
        publisher: { '@id': PrerenderPages.ORG_ID },
        mainEntity: { '@id': `${pageUrl}#list` },
        breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
      },
      {
        '@type': 'ItemList',
        '@id': `${pageUrl}#list`,
        name: 'Kentucky history stories',
        numberOfItems: total,
        itemListElement: ordered.map((story, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: story.title,
          url: `${PrerenderPages.SITE}/stories/${story.slug}/`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Stories', item: pageUrl },
        ],
      },
    ])
    return PrerenderPages.shell({
      title: 'All stories · Kentucky History Drive',
      description,
      canonical: pageUrl,
      cssHrefs,
      image: PrerenderPages.LOGO,
      imageAlt: 'Kentucky History Drive official seal',
      ogType: 'website',
      jsonLd,
      main,
    })
  }

  static routesPage(stories, cssHrefs) {
    const titleFor = (slug) => stories.find((story) => story.slug === slug)?.title || ''
    for (const route of ROUTE_MAPS) {
      if (!titleFor(route.slug)) throw new Error(`prerender: no story for route map ${route.slug}`)
    }
    const description = PrerenderPages.metaDescription(
      'Approximate route maps for six Kentucky history stories, with the stops and the story for each path.',
    )
    const canonical = `${PrerenderPages.SITE}/routes/`
    const main = routesIndexArticleHtml(titleFor, (slug) => {
      const story = stories.find((item) => item.slug === slug)
      return story ? PrerenderPages.storyMapHref(story) : ''
    })
    const list = {
      '@type': 'ItemList',
      '@id': `${canonical}#routes`,
      name: 'Route maps',
      numberOfItems: ROUTE_MAPS.length,
      itemListElement: ROUTE_MAPS.map((route, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: titleFor(route.slug),
        url: `${PrerenderPages.SITE}/stories/${route.slug}/#route-map`,
      })),
    }
    const jsonLd = PrerenderPages.jsonLdScript([
      PrerenderPages.organizationNode(),
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: 'Route maps',
        description,
        isPartOf: { '@type': 'WebSite', name: 'Kentucky History Drive', url: `${PrerenderPages.SITE}/` },
        publisher: PrerenderPages.publisherNode(),
        mainEntity: { '@id': `${canonical}#routes` },
      },
      list,
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Route maps', item: canonical },
        ],
      },
    ])
    return PrerenderPages.shell({
      title: 'Route maps · Kentucky History Drive',
      description,
      canonical,
      // Shannon item 93: noindex until the page is filled out; follow so its story links still count.
      robots: PrerenderPages.THIN_ROBOTS,
      cssHrefs,
      image: PrerenderPages.LOGO,
      imageAlt: 'Kentucky History Drive official seal',
      ogType: 'website',
      jsonLd,
      routeLightbox: true,
      main,
    })
  }

  static storyMatchesLayer(st, layer, layers = []) {
    if (!st?.slug || !layer?.id) return false
    const primary = PrerenderPages.storyLayer(st, layers)
    if (primary?.id === layer.id) return true
    if (layer.id === 'history') return false
    const tags = new Set((st.tags || []).map((t) => String(t).toLowerCase()))
    const hay = `${st.title || ''} ${st.matchedPlace || ''} ${st.summary || ''}`.toLowerCase()
    switch (layer.id) {
      case 'war':
        return (
          tags.has('civil-war') ||
          tags.has('revolutionary-war') ||
          tags.has('war-of-1812') ||
          tags.has('frontier-war') ||
          tags.has('frontier-defense') ||
          tags.has('military') ||
          tags.has('siege')
        )
      case 'distilleries':
        return tags.has('bourbon') || tags.has('whiskey') || /\b(distiller|bourbon|whiskey)\b/.test(hay)
      case 'caves':
        return (
          tags.has('caves') ||
          tags.has('karst') ||
          tags.has('rockhouses') ||
          tags.has('saltpeter') ||
          /\b(cave|cavern|rockhouse|rockshelter|sinkhole|grotto)\b/.test(hay)
        )
      case 'industry':
        return (
          tags.has('coal') ||
          tags.has('iron') ||
          tags.has('salt') ||
          tags.has('timber') ||
          tags.has('hemp') ||
          tags.has('Print') ||
          tags.has('print') ||
          tags.has('commerce') ||
          tags.has('steamboats') ||
          tags.has('railroads')
        )
      case 'newspapers':
        return tags.has('newspapers') || tags.has('print') || /\b(gazette|newspaper|press|printer|printing)\b/.test(hay)
      case 'parks':
        return tags.has('parks') || /\b(state park|state historic site|state resort park|breaks interstate|cumberland falls)\b/.test(hay)
      case 'national':
        return (
          tags.has('national-parks') ||
          /\b(mammoth cave|cumberland gap|camp nelson|abraham lincoln birthplace|big south fork|mill springs)\b/.test(hay)
        )
      case 'museums':
        return tags.has('museums') || tags.has('education') || tags.has('architecture') || /\b(museum|shaker village|transylvania|histor(ic|ical) home|mansion)\b/.test(hay)
      case 'cemeteries':
        return tags.has('cemeteries') || tags.has('mounds') || /\b(cemeter|burial|grave|mound)\b/.test(hay)
      case 'bridges':
        return tags.has('bridges') || tags.has('river-crossings') || tags.has('roads') || /\b(bridge|ferry|ford|trace|turnpike|gap)\b/.test(hay)
      case 'markers':
        return Array.isArray(st.markerIds) && st.markerIds.length > 0
      case 'locals':
        return tags.has('folklore') || tags.has('foodways') || tags.has('music') || tags.has('culture') || /\b(tales|legend|tavern|inn|burgoo)\b/.test(hay)
      default:
        return false
    }
  }

  static layerPage(layer, cssHrefs, stories = [], layers = [layer]) {
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
        const name = place.storySlug
          ? `<a href="/stories/${PrerenderPages.escapeHtml(place.storySlug)}/">${PrerenderPages.escapeHtml(place.name)}</a>`
          : PrerenderPages.escapeHtml(place.name)
        return `<li>${name}${extra}</li>`
      })
      .join('')
    const layerStories = PrerenderPages.liveStories(stories).filter((st) =>
      PrerenderPages.storyMatchesLayer(st, layer, layers),
    )
    const layerStoriesHtml = layerStories.length
      ? `<section aria-label="Stories on this layer">
          <h2>Stories connected to ${PrerenderPages.escapeHtml(layer.label)} (${layerStories.length})</h2>
          <ul class="place-list">${layerStories.map((st) => `<li><a href="/stories/${PrerenderPages.escapeHtml(st.slug)}/">${PrerenderPages.escapeHtml(st.title)}</a></li>`).join('')}</ul>
        </section>`
      : ''
    const main = `<article>
        <nav class="story-crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">${PrerenderPages.escapeHtml(layer.label)}</span>
        </nav>
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
              ${layer.featuredStorySlug ? `<a class="btn" href="/stories/${PrerenderPages.escapeHtml(layer.featuredStorySlug)}/">Read the story</a>` : ''}
              <a class="btn${layer.featuredStorySlug ? ' ghost' : ''}" href="${PrerenderPages.escapeHtml(pinHref)}">Open this layer on the map</a>
              <a class="btn ghost" href="/#map">Full map</a>
            </div>
          </div>
          ${PrerenderPages.layerCreditHtml(highlight.photo)}
        </section>
        ${layerStoriesHtml}
        <section aria-label="Places on this layer">
          <h2>${layer.places.length.toLocaleString('en-US')} places</h2>
          <ul class="place-list">${places}</ul>
        </section>
      </article>`
    const jsonLd = PrerenderPages.jsonLdScript([
      PrerenderPages.organizationNode(),
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: layer.label,
        description,
        isPartOf: { '@type': 'WebSite', name: 'Kentucky History Drive', url: `${PrerenderPages.SITE}/` },
        publisher: PrerenderPages.publisherNode(),
        mainEntity: { '@id': `${canonical}#places` },
      },
      {
        '@type': 'ItemList',
        '@id': `${canonical}#places`,
        name: layerStories.length ? `${layer.label} stories` : `${layer.label} places`,
        numberOfItems: layerStories.length ? layerStories.length : layer.places.length,
        itemListElement: layerStories.length
          ? layerStories.map((st, index) => {
              const stUrl = `${PrerenderPages.SITE}/stories/${encodeURIComponent(st.slug)}/`
              return {
                '@type': 'ListItem',
                position: index + 1,
                name: st.title,
                url: stUrl,
                item: stUrl,
              }
            })
          : layer.places.slice(0, 50).map((place, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: place.name,
            })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` },
          { '@type': 'ListItem', position: 2, name: layer.label, item: canonical },
        ],
      },
    ])
    return PrerenderPages.shell({
      title,
      description,
      canonical,
      cssHrefs,
      image: PrerenderPages.photoAbsolute(highlight.photo?.image_url) || `${PrerenderPages.SITE}/brand/khd-logo-512.png`,
      imageAlt: highlight.photo?.title || featuredName,
      jsonLd,
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
    if (!html.includes('class="top site-header"') || html.includes('iPhone app (coming soon)') || !html.includes('id="navMenuToggle"')) {
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
    if (PrerenderPages.hasPreciseCoordinate(scrubbed)) {
      throw new Error(`prerender: ${urlPath} includes a precise coordinate`)
    }
  }

  /**
   * Security Watch (#346), narrow: a precise-coordinate-shaped match is exempt ONLY inside the path of an
   * href that parses to host archive.org / www.archive.org with pathname /details/<id> and no query,
   * fragment or userinfo (e.g. /details/in.ernet.dli.2015.58770). Page text, other attributes, query
   * strings and other hosts still fail. check-protected-coords has no archive.org exemption.
   */
  static isArchiveDetailsHref(raw) {
    let u
    try { u = new URL(String(raw).replace(/&amp;/g, '&')) } catch { return false }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    if (u.hostname !== 'archive.org' && u.hostname !== 'www.archive.org') return false
    if (u.username || u.password || u.port || u.search || u.hash || /[?#]/.test(raw)) return false
    return /^\/details\/[A-Za-z0-9._-]+\/?$/.test(u.pathname)
  }

  static hasPreciseCoordinate(html) {
    const scrubbed = String(html).replace(/(\shref=)(["'])([^"']*)\2/g, (m, pre, q, url) =>
      PrerenderPages.isArchiveDetailsHref(url) ? `${pre}${q}${q}` : m)
    return /-?\d{1,3}\.\d{5,}/.test(scrubbed)
  }

  static assertRouteMap(html, story, route, data) {
    const urlPath = `/stories/${story.slug}/`
    const section = html.match(/<section class="route-map"[\s\S]*?<\/section>/)
    if (!section) throw new Error(`prerender: ${urlPath} is missing the route map section`)
    const block = section[0]
    if (!block.includes('>View the map<')) throw new Error(`prerender: ${urlPath} is missing View the map`)
    if (!block.includes('loading="lazy"') || !block.includes('width="1600"') || !block.includes('height="900"')) {
      throw new Error(`prerender: ${urlPath} route map is missing lazy loading or dimensions`)
    }
    if (!block.includes('fetchpriority="low"') || /fetchpriority="high"|data-lcp/.test(block)) {
      throw new Error(`prerender: ${urlPath} route map must not be the LCP image`)
    }
    if (!block.includes('(max-width: 699px)') || !block.includes('(min-width: 700px)') || !block.includes('prefers-color-scheme: dark')) {
      throw new Error(`prerender: ${urlPath} route map picture is missing the phone or dark sources`)
    }
    if (!block.includes(route.files.phoneDarkWebp)) {
      throw new Error(`prerender: ${urlPath} route map is missing the dark phone WebP`)
    }
    const cropNote = 'Kentucky leg shown'
    if (route.phoneCrop) {
      if (!block.includes(cropNote) || !block.includes(route.files.fullPng)) {
        throw new Error(`prerender: ${urlPath} phone crop is missing the full-route link`)
      }
    } else if (block.includes(cropNote)) {
      throw new Error(`prerender: ${urlPath} phone art is the full route and must not say Kentucky leg`)
    }
    if (!block.includes('960w') || !block.includes('1600w')) {
      throw new Error(`prerender: ${urlPath} route map is missing the 960 and 1600 sources`)
    }
    if (!block.includes(`alt="${PrerenderPages.escapeHtml(route.alt)}"`)) {
      throw new Error(`prerender: ${urlPath} route map alt does not match NOTES.md`)
    }
    if (!block.includes(PrerenderPages.escapeHtml(route.caption))) {
      throw new Error(`prerender: ${urlPath} route map caption is missing`)
    }
    if (!/approximate/i.test(block)) throw new Error(`prerender: ${urlPath} route map is not labeled approximate`)
    if (block.includes('3840') || block.includes('-master-')) {
      throw new Error(`prerender: ${urlPath} includes a 3840 master`)
    }
    if (!block.includes('class="route-map-zoom"') || !block.includes('class="route-map-expand"') || !block.includes('>Expand<')) {
      throw new Error(`prerender: ${urlPath} route map is missing the expand control`)
    }
    if (!block.includes('class="route-map-open"') || !block.includes('aria-controls="route-map-lightbox"')) {
      throw new Error(`prerender: ${urlPath} route map image is not a lightbox button`)
    }
    for (const frame of ['desk-light', 'desk-dark', 'zoom-dark', 'phone-light', 'phone-dark']) {
      if (!block.includes(`data-frame="${frame}"`)) {
        throw new Error(`prerender: ${urlPath} route map is missing the ${frame} overlay`)
      }
    }
    if (block.includes('class="route-ky-line"') || block.includes('class="route-ky"')) {
      throw new Error(`prerender: ${urlPath} still draws a Kentucky outline that does not fit the painting`)
    }
    if (/class="route-map-open"[^>]*aria-label=/.test(block)) {
      throw new Error(`prerender: ${urlPath} route map button aria-label replaces the image alt`)
    }
    if (!block.includes(`aria-describedby="route-map-hint-${route.slug}"`) || !block.includes('Opens a larger view of this map.')) {
      throw new Error(`prerender: ${urlPath} route map image is missing its description`)
    }
    // Desk and zoom show every stop, numbered without gaps, on the painted line.
    const geoStops = route.stops.map((_, index) => index + 1)
    for (const frame of ['desk-light', 'desk-dark', 'zoom-dark']) {
      const slot = block.match(new RegExp(`data-frame="${frame}"[^>]*>([\\s\\S]*?)<\\/div>`))
      const nums = slot ? [...slot[1].matchAll(/data-n="(\d+)"/g)].map((match) => Number(match[1])) : []
      if (nums.join(',') !== geoStops.join(',')) {
        throw new Error(`prerender: ${urlPath} ${frame} markers are ${nums.join(',')}, expected ${geoStops.join(',')}`)
      }
    }
    if (/<span class="route-stop[^"]*"[^>]*>\s*\d/.test(block)) {
      throw new Error(`prerender: ${urlPath} repeats stop numbers as overlay text`)
    }
    if (route.stops.some((stop) => stop.conjectural) && !block.includes('Hexagon: conjectural stop')) {
      throw new Error(`prerender: ${urlPath} legend is missing the conjectural hexagon`)
    }
    const phone = block.match(/data-frame="phone-light"[^>]*>([\s\S]*?)<\/div>/)
    const phoneBadges = phone ? (phone[1].match(/data-n="/g) || []).length : 0
    if (phoneBadges > geoStops.length) {
      throw new Error(`prerender: ${urlPath} phone overlay has more badges than stops`)
    }
    const links = block.match(/<nav class="route-links"[\s\S]*?<\/nav>/)
    if (!links || !links[0].includes('class="related-card"') || !links[0].includes('>Related stories<')) {
      throw new Error(`prerender: ${urlPath} route stories are not one card section`)
    }
    if (links[0].includes('Related stories and markers') || html.includes('Related stories and markers')) {
      throw new Error(`prerender: ${urlPath} still has a separate markers section`)
    }
    for (const slug of route.relatedStories || []) {
      if (!links[0].includes(`/stories/${slug}/`)) {
        throw new Error(`prerender: ${urlPath} related stories omit ${slug}`)
      }
    }
    for (const marker of route.markers || []) {
      if (!links[0].includes(`/#map/markers/${marker.number}`)) {
        throw new Error(`prerender: ${urlPath} related stories omit marker ${marker.number}`)
      }
    }
    if (!block.includes(`data-route-slug="${route.slug}"`) || !block.includes(`data-fallback="${route.files.fullWebp}"`)) {
      throw new Error(`prerender: ${urlPath} route map lightbox is missing its sources`)
    }
    for (const file of [route.files.zoomLightAvif, route.files.zoomLightWebp, route.files.zoomDarkAvif, route.files.zoomDarkWebp]) {
      if (!block.includes(file)) throw new Error(`prerender: ${urlPath} route map is missing zoom art ${file}`)
    }
    if (route.phoneCaption) {
      const phone = block.match(/class="route-map-caption route-map-caption-phone">([\s\S]*?)<\/p>/)
      if (!phone || phone[1] !== PrerenderPages.escapeHtml(route.phoneCaption)) {
        throw new Error(`prerender: ${urlPath} phone caption does not match the crop`)
      }
      if (route.slug === 'christopher-gist-1750-51' && /north of the Ohio|Pickawillany/.test(phone[1])) {
        throw new Error(`prerender: ${urlPath} phone caption still describes the route north of the Ohio`)
      }
    } else if (block.includes('route-map-caption-phone')) {
      throw new Error(`prerender: ${urlPath} has a phone caption the full route does not need`)
    }
    if (/onclick=|onerror=|onload=|javascript:/.test(block)) {
      throw new Error(`prerender: ${urlPath} route map uses an inline event handler`)
    }
    if (!html.includes('src="/route-map-lightbox.js"')) {
      throw new Error(`prerender: ${urlPath} is missing the route map lightbox script`)
    }
    if (route.slug === 'mantle-rock-and-the-trail-of-tears') {
      if (!block.includes('Northern Route') || /Benge-Drane|\bDrane\b/.test(block)) {
        throw new Error(`prerender: ${urlPath} must use the NPS name Northern Route`)
      }
    }
    const listHtml = block.match(/<ol class="route-waypoints">[\s\S]*?<\/ol>/)
    const listed = listHtml ? (listHtml[0].match(/<li>/g) || []).length : 0
    if (listed !== route.stops.length) {
      throw new Error(`prerender: ${urlPath} lists ${listed} stops, expected ${route.stops.length}`)
    }
    const nodes = data['@graph'] || [data]
    const canonical = `${PrerenderPages.SITE}${urlPath}`
    const image = nodes.find((node) => node['@type'] === 'ImageObject' && node['@id'] === `${canonical}#route-map`)
    if (!image) throw new Error(`prerender: ${urlPath} JSON-LD is missing the route map ImageObject`)
    if (image.contentUrl !== absoluteUrl(route.files.fullPng) || image.width !== 1600 || image.height !== 900) {
      throw new Error(`prerender: ${urlPath} route map ImageObject is not the 1600 PNG`)
    }
    if (image.creditText !== 'Kentucky History Drive' || image.creator?.['@id'] !== PrerenderPages.ORG_ID) {
      throw new Error(`prerender: ${urlPath} route map ImageObject is missing the Kentucky History Drive credit`)
    }
    const place = nodes.find((node) => node['@id'] === `${canonical}#place`)
    if (place?.hasMap?.['@id'] !== image['@id']) {
      throw new Error(`prerender: ${urlPath} Place is missing hasMap`)
    }
    const list = nodes.find((node) => node['@type'] === 'ItemList' && String(node['@id'] || '').endsWith('#waypoints'))
    if (!list || list.numberOfItems !== route.stops.length || (list.itemListElement || []).length !== route.stops.length) {
      throw new Error(`prerender: ${urlPath} waypoint ItemList does not match NOTES.md`)
    }
    list.itemListElement.forEach((item, index) => {
      if (item.position !== index + 1) {
        throw new Error(`prerender: ${urlPath} waypoint ${index + 1} JSON-LD position is ${item.position}`)
      }
      const placeNode = item?.item
      if (placeNode?.['@type'] !== 'Place') throw new Error(`prerender: ${urlPath} waypoint ${index + 1} is not a Place`)
      const geo = route.stops[index].geo
      if (geo) {
        if (placeNode.geo?.latitude !== geo[0] || placeNode.geo?.longitude !== geo[1]) {
          throw new Error(`prerender: ${urlPath} waypoint ${index + 1} geo does not match NOTES.md`)
        }
      } else if (placeNode.geo) {
        throw new Error(`prerender: ${urlPath} waypoint ${index + 1} has coordinates NOTES.md does not give`)
      }
    })
    const article = nodes.find((node) => node['@type'] === 'Article')
    const images = Array.isArray(article?.image) ? article.image : [article?.image]
    if (!images.includes(absoluteUrl(route.files.fullPng))) {
      throw new Error(`prerender: ${urlPath} Article image is missing the route map`)
    }
    if (!html.includes('href="/routes/"')) throw new Error(`prerender: ${urlPath} does not link to /routes/`)
    if (!block.includes('>Kentucky history route maps<')) {
      throw new Error(`prerender: ${urlPath} is missing the Kentucky history route maps anchor`)
    }
    const gpx = `/maps/routes/${route.slug}/${route.slug}.gpx`
    const kml = `/maps/routes/${route.slug}/${route.slug}.kml`
    if (!block.includes(`href="${gpx}"`) || !block.includes(`href="${kml}"`)) {
      throw new Error(`prerender: ${urlPath} is missing the GPX or KML download`)
    }
    if (!block.includes('Download GPX (approximate)') || !block.includes('Download KML (approximate)')) {
      throw new Error(`prerender: ${urlPath} route download is not marked approximate`)
    }
    if (!block.includes('for GPS and map apps')) {
      throw new Error(`prerender: ${urlPath} route download is missing the GPS hint`)
    }
  }

  static assertRoutes(html, stories) {
    if (!html.includes('<h1>Route maps</h1>')) throw new Error('prerender: /routes/ is missing its heading')
    if (!html.includes('href="/routes/"')) throw new Error('prerender: /routes/ footer link is missing')
    if (!html.includes('>Kentucky history route maps<')) {
      throw new Error('prerender: /routes/ is missing the Kentucky history route maps anchor')
    }
    if (!html.includes('Northern Route') || /Benge-Drane|\bDrane\b/.test(html)) {
      throw new Error('prerender: /routes/ must use the NPS name Northern Route')
    }
    if (html.includes('3840') || html.includes('-master-')) throw new Error('prerender: /routes/ includes a 3840 master')
    if (!html.includes('src="/route-map-lightbox.js"')) throw new Error('prerender: /routes/ is missing the lightbox script')
    if ((html.match(/class="route-map-expand"/g) || []).length !== ROUTE_MAPS.length) {
      throw new Error('prerender: /routes/ is missing an expand control on each map')
    }
    if ((html.match(/class="route-map-open"/g) || []).length !== ROUTE_MAPS.length) {
      throw new Error('prerender: /routes/ map images are not lightbox buttons')
    }
    if (/onclick=|javascript:/.test(html)) throw new Error('prerender: /routes/ uses an inline event handler')
    const cards = html.match(/class="route-card"/g) || []
    if (cards.length !== ROUTE_MAPS.length) {
      throw new Error(`prerender: /routes/ has ${cards.length} cards, expected ${ROUTE_MAPS.length}`)
    }
    for (const route of ROUTE_MAPS) {
      const title = stories.find((story) => story.slug === route.slug)?.title || ''
      if (!html.includes(`href="/stories/${route.slug}/#route-map"`)) {
        throw new Error(`prerender: /routes/ does not link to ${route.slug}`)
      }
      if (!html.includes(PrerenderPages.escapeHtml(title)) || !html.includes(PrerenderPages.escapeHtml(route.era))) {
        throw new Error(`prerender: /routes/ is missing the title or era for ${route.slug}`)
      }
      if (!html.includes(route.files.webWebp) || !html.includes('loading="lazy"') || !html.includes('width="1600"')) {
        throw new Error(`prerender: /routes/ thumbnail for ${route.slug} is missing`)
      }
      if (!html.includes(route.files.phoneWebp) || !html.includes(route.files.phoneDarkWebp) || !html.includes('(max-width: 699px)')) {
        throw new Error(`prerender: /routes/ thumbnail for ${route.slug} does not serve phone art under 700px`)
      }
    }
  }

  static storyBodyHtml(html) {
    const match = html.match(
      /<div class="story-body">([\s\S]*?)<\/div>/,
    )
    return match ? match[1] : null
  }

  static assertStoryLinks(html, story) {
    const urlPath = `/stories/${story.slug}/`
    const body = PrerenderPages.storyBodyHtml(html)
    if (body == null) throw new Error(`prerender: ${urlPath} is missing the story body`)
    if (!body) return
    if (/<script|onerror\s*=|onload\s*=|javascript:/i.test(body)) {
      throw new Error(`prerender: ${urlPath} story body has raw HTML`)
    }
    const anchors = [...body.matchAll(/<a\b([^>]*)>/g)]
    for (const anchor of anchors) {
      const attrs = anchor[1]
      const href = (attrs.match(/\bhref="([^"]*)"/) || [])[1] || ''
      const external = /^https?:\/\//i.test(href)
      const site = href.startsWith('/') || href.startsWith('#')
      if (!href || (!external && !site)) {
        throw new Error(`prerender: ${urlPath} link is not http(s) or site-relative`)
      }
      if (external) {
        const rel = (attrs.match(/\brel="([^"]*)"/) || [])[1] || ''
        if (!attrs.includes('target="_blank"') || !rel.split(/\s+/).includes('noopener')) {
          throw new Error(`prerender: ${urlPath} external link is missing rel=noopener or target=_blank`)
        }
      } else if (/\btarget=/.test(attrs)) {
        throw new Error(`prerender: ${urlPath} site link ${href} opens a new tab`)
      }
    }
  }

  static assertResearch(html, notes) {
    const urlPath = `/research/${notes.slug}/`
    const article = html.match(/<article class="research-notes">[\s\S]*<\/article>/)
    if (!article) throw new Error(`prerender: ${urlPath} is missing the research article`)
    const block = article[0]
    if (!block.includes('>Back to story<') || !block.includes(`href="/stories/${notes.storySlug}/"`)) {
      throw new Error(`prerender: ${urlPath} is missing the Back to story link`)
    }
    if (!block.includes(PrerenderPages.escapeHtml(notes.title))) {
      throw new Error(`prerender: ${urlPath} is missing its title`)
    }
    if (/<script|onerror\s*=|onload\s*=|javascript:|data:text/i.test(block)) {
      throw new Error(`prerender: ${urlPath} has raw HTML`)
    }
    if (block.includes('<img') || block.includes('<iframe') || block.includes('<object')) {
      throw new Error(`prerender: ${urlPath} includes embedded content`)
    }
    const external = [...block.matchAll(/<a\b([^>]*href="https?:\/\/[^"]*"[^>]*)>/g)]
    if (!external.length || external.some((anchor) => !anchor[1].includes('rel="noopener noreferrer"') || !anchor[1].includes('target="_blank"'))) {
      throw new Error(`prerender: ${urlPath} external source is missing rel=noopener or target=_blank`)
    }
    const internal = [...block.matchAll(/<a\b([^>]*href="\/[^"]*"[^>]*)>/g)]
    if (internal.some((anchor) => /\btarget=/.test(anchor[1]))) {
      throw new Error(`prerender: ${urlPath} site link opens a new tab`)
    }
  }

  static assertStory(html, story, description, all = [], markers = [], notes = null) {
    const urlPath = `/stories/${story.slug}/`
    PrerenderPages.assertStoryLinks(html, story)
    if (story.glance) {
      if (!html.includes('<table class="story-glance">') || !html.includes('<caption>At a glance</caption>')) {
        throw new Error(`prerender: ${urlPath} is missing the at-a-glance table`)
      }
      if (!html.includes('<th scope="row">')) {
        throw new Error(`prerender: ${urlPath} glance table is missing row headers`)
      }
      const glanceDate = String(story.glance.date || '')
      if (glanceDate && !html.includes(PrerenderPages.escapeHtml(glanceDate))) {
        throw new Error(`prerender: ${urlPath} glance table is missing the date`)
      }
      if (html.includes('## At a glance') || html.includes('<h2>At a glance</h2>')) {
        throw new Error(`prerender: ${urlPath} still renders the markdown glance table`)
      }
      const glance = html.match(/<table class="story-glance">[\s\S]*?<\/table>/)
      if (!glance || /\btarget=/.test(glance[0])) {
        throw new Error(`prerender: ${urlPath} glance table has an unsafe link`)
      }
      const glanceHrefs = [...glance[0].matchAll(/\bhref="([^"]*)"/g)].map((match) => match[1])
      if (glanceHrefs.some((href) => !href.startsWith('/') && !href.startsWith('#'))) {
        throw new Error(`prerender: ${urlPath} glance table link is not site-relative`)
      }
    }
    if (notes && isFoldedResearch(notes)) {
      const sourcesTail = html.slice(html.indexOf('id="h-sources"'), html.indexOf('</section>', html.indexOf('id="h-sources"')))
      if (/<summary>Chronology \(|<summary>Open questions \(/.test(sourcesTail) || !/<\/details>\s*$/.test(sourcesTail)) {
        throw new Error(`prerender: ${urlPath} research notes must be the last block of Sources and research, with no duplicate Chronology/Open questions`)
      }
      if (!html.includes('<details class="usp-details research-fold" id="research-notes" data-research-notes>') || !html.includes('<a class="research-jump" href="#research-notes">Research notes</a>') || html.includes(`href="/research/${notes.slug}/`)) {
        throw new Error(`prerender: ${urlPath} must fold its research notes in, not link /research/${notes.slug}/`)
      }
    } else if (notes) {
      const href = researchPageHref(notes.slug)
      if (!href || !html.includes(`href="${href}"`) || !html.includes('>Research notes and sources for the ')) {
        throw new Error(`prerender: ${urlPath} does not link to its research notes`)
      }
    }
    const choice = PrerenderPages.storyDescriptionChoice(story)
    PrerenderPages.assertStoryMeta(description, choice.source, urlPath, PrerenderPages.META_MAX, choice.opts)
    if (!html.includes(`name="description" content="${PrerenderPages.escapeHtml(description)}"`)) {
      throw new Error(`prerender: ${urlPath} meta description does not match the story rule`)
    }
    // A map, painting, print, drawing, signature etc. must carry its medium, never fall back to 'Photo:'.
    if (looksLikeUnlabeledArtwork(story.photo) || (REVIEWED_ARTWORK_SLUGS.has(story.slug) && story.photo?.image_url && !artworkLead(story.photo))) {
      throw new Error(`prerender: ${urlPath} photo looks like art or a document (source or caption) but has no photo.artwork medium`)
    }
    // Editor 10/18 (#199): human-made art is labeled by medium (or as a modern reconstruction), never 'Photo:' or 'AI illustration'.
    if (story.photo?.artwork) {
      const lead = artworkLead(story.photo)
      if (!lead) throw new Error(`prerender: ${urlPath} photo.artwork '${story.photo.artwork}' must be one of ${Object.keys(ARTWORK_LEADS).join(', ')}`)
      const credit = (html.match(/<p class="story-sidebar-photo-attr[\s\S]*?<\/p>/) || [''])[0]
      if (!credit.includes(PrerenderPages.escapeHtml(lead)) || /AI illustration|Photo: /.test(credit)) {
        throw new Error(`prerender: ${urlPath} artwork credit must start '${lead}<artist>' and never say Photo: or AI illustration`)
      }
    }
    if (!html.includes('class="story-lead"') && !isProtectedStory(story)) throw new Error(`prerender: ${urlPath} is missing a lead sentence`)
    if (!html.includes(PrerenderPages.rssAlternateLink())) {
      throw new Error(`prerender: ${urlPath} is missing the RSS alternate link`)
    }
    const peopleAside = html.match(/<aside class="story-related"[\s\S]*?<\/aside>/)
    if (peopleAside) {
      if (!peopleAside[0].includes('Related people &amp; stories')) {
        throw new Error(`prerender: ${urlPath} related people heading is missing`)
      }
      const shots = [...peopleAside[0].matchAll(/<img\b[^>]*>/g)].map((match) => match[0])
      for (const img of shots) {
        if (!img.includes('loading="lazy"') || !img.includes('width="36"') || !img.includes('height="36"')) {
          throw new Error(`prerender: ${urlPath} headshot is missing lazy loading or 36px dimensions`)
        }
        if (!/alt="(?:Attributed portrait of |Imagined posthumous portrait of |Detail from a group scene of |Portrait of |AI illustration of )[^"]+"/.test(img)) {
          throw new Error(`prerender: ${urlPath} headshot alt text is missing the person`)
        }
        if (!/src="\/people\/portraits\/[^"]+\.jpg"/.test(img) || /https?:/i.test(img)) {
          throw new Error(`prerender: ${urlPath} headshot is not a self-hosted portrait`)
        }
      }
    }
    if (story.slug === 'treaty-of-camp-charlotte-1774' && !html.includes('alt="AI illustration of Nonhelema, Shawnee Chalakatha chief and diplomat, about 1786"')) {
      throw new Error('prerender: Camp Charlotte story is missing the Nonhelema AI headshot')
    }
    // #345: protected sites list same-county stories only, so they may have fewer than 3 (or none).
    const protectedRelated = isProtectedStory(story)
    const related = html.match(/<nav class="static-related[^"]*"[\s\S]*?<\/nav>/) || (protectedRelated ? [''] : null)
    const relatedCount = related ? (related[0].match(/<li class="related-story">/g) || []).length : 0
    if (!related || (!protectedRelated && (!related[0].includes('Related stories') || relatedCount < 3)) || relatedCount > 5) {
      throw new Error(`prerender: ${urlPath} has ${relatedCount} related story links`)
    }
    if (related[0] && (!related[0].includes('class="related-card"') || !/<h2[^>]*>Related stories<\/h2>/.test(related[0]))) {
      throw new Error(`prerender: ${urlPath} related list is not a card list under an h2`)
    }
    const learnMore = html.match(/<div class="popup-research learn-more">[\s\S]*?<\/ul>/)
    if (learnMore) {
      const labels = [...learnMore[0].matchAll(/<a [^>]*>([^<]+)/g)].map((match) => match[1].trim())
      if (!labels.length || labels.some((label) => /^https?:/i.test(label))) {
        throw new Error(`prerender: ${urlPath} Learn more link is not a readable label`)
      }
      if (!learnMore[0].includes('class="external-icon"') || !learnMore[0].includes('opens in a new tab')) {
        throw new Error(`prerender: ${urlPath} Learn more link is missing its external icon or new-tab hint`)
      }
    }
    if ((related[0].match(/<li class="related-story">[\s\S]*?<\/li>/g) || []).some((item) => !item.includes('>Story'))) {
      throw new Error(`prerender: ${urlPath} related story is missing its Story label`)
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
    const expectedDates = PrerenderPages.articleDates(story)
    if ((article?.datePublished || '') !== expectedDates.published || (article?.dateModified || '') !== expectedDates.modified) {
      throw new Error(`prerender: ${urlPath} Article dates are not the git first commit and last story-text commit`)
    }
    if (story.created && story.publishedDate && story.publishedDate !== story.created && article?.datePublished === story.publishedDate) {
      throw new Error(`prerender: ${urlPath} published date is a story field, not the git first commit`)
    }
    const cite = html.match(/<section class="cite-story"[\s\S]*?<\/section>/)
    if (!cite || !cite[0].includes('data-cite-copy="chicago"') || !cite[0].includes('data-cite-copy="mla"')) {
      throw new Error(`prerender: ${urlPath} is missing the citation box`)
    }
    if (!cite[0].includes(PrerenderPages.escapeHtml(storyCanonicalUrl(story.slug))) || !cite[0].includes('Kentucky History Drive')) {
      throw new Error(`prerender: ${urlPath} citation is missing the site or URL`)
    }
    if (!cite[0].includes(PrerenderPages.escapeHtml(story.title))) {
      throw new Error(`prerender: ${urlPath} citation is missing the story title`)
    }
    if (/Accessed/.test(cite[0])) {
      throw new Error(`prerender: ${urlPath} baked in an access date`)
    }
    if (expectedDates.published) {
      if (!cite[0].includes(`datetime="${expectedDates.published}"`) || !cite[0].includes('Published')) {
        throw new Error(`prerender: ${urlPath} citation is missing the git published date`)
      }
    } else if (/\bPublished\b/.test(cite[0]) || article?.datePublished) {
      throw new Error(`prerender: ${urlPath} invented a published date`)
    }
    if (!expectedDates.modified || !cite[0].includes(`datetime="${expectedDates.modified}"`) || !cite[0].includes('Last revised') || !cite[0].includes('last revised')) {
      throw new Error(`prerender: ${urlPath} citation is missing the last revised date`)
    }
    const correction = html.match(/<a class="story-correction-link"[^>]*>/)
    const rel = correction ? correction[0].match(/\brel="([^"]*)"/) : null
    const relValue = rel ? rel[1] : ''
    if (!correction || !correction[0].includes('target="_blank"') || !/\bnoopener\b/.test(relValue) || !/\bnoreferrer\b/.test(relValue) || !/\bnofollow\b/.test(relValue)) {
      throw new Error(`prerender: ${urlPath} correction link must open in a new tab`)
    }
    if (!correction[0].includes('https://github.com/shannonsnowden/kyhistorydrive/issues/new?') || !correction[0].includes('labels=correction')) {
      throw new Error(`prerender: ${urlPath} correction link is not a labeled GitHub issue`)
    }
    if (/mailto:/i.test(html)) throw new Error(`prerender: ${urlPath} includes a mailto link`)
    const routeForNearby = routeBySlug(story.slug)
    // Editor 10/18 (#247): no story appears in both the Related people & stories box and Related and nearby.
    const peopleBoxSlugs = peopleAside ? [...peopleAside[0].matchAll(/href="\/stories\/([^"/]+)\//g)].map((match) => match[1]) : []
    const nearbyBoxSlugs = [...related[0].matchAll(/href="\/stories\/([^"/]+)\//g)].map((match) => match[1])
    const repeated = nearbyBoxSlugs.filter((slug) => peopleBoxSlugs.includes(slug))
    if (repeated.length) throw new Error(`prerender: ${urlPath} repeats ${repeated.join(', ')} in Related people & stories and Related and nearby`)
    if (new Set(nearbyBoxSlugs).size !== nearbyBoxSlugs.length) throw new Error(`prerender: ${urlPath} repeats a story inside Related and nearby`)
    // Person cards always show the canonical portrait, never a pin or story photo.
    for (const card of related[0].match(/<li class="(?:related-story|nearby-place)">[\s\S]*?<\/li>/g) || []) {
      const slug = (card.match(/href="\/stories\/([^"/]+)\//) || [])[1]
      const want = slug && PrerenderPages.portraitForSlug ? PrerenderPages.portraitForSlug(slug) : ''
      if (want && !card.includes(`src="${want}"`)) throw new Error(`prerender: ${urlPath} person card ${slug} is not using the canonical portrait`)
    }
    const relatedSlugs = [...related[0].matchAll(/<li class="related-story">[\s\S]*?href="\/stories\/([^"/]+)\//g)].map((match) => match[1])
    const expectedRelated = PrerenderPages.relatedStories(story, all, [...(routeForNearby?.relatedStories || []), ...peopleBoxSlugs]).map((item) => item.slug)
    if (relatedSlugs.join('|') !== expectedRelated.join('|')) {
      throw new Error(`prerender: ${urlPath} related stories are not ranked by two or more subject tags, then county, then distance`)
    }
    const matchedMarkersForStory = matchStoryMarkers(story, markers, notes, routeForNearby)
    const nearbyExpected = nearbyPlaces(story, all, markers, {
      limit: 3,
      isProtected: (s) => isProtectedStory(s),
      excludeSlugs: [...(routeForNearby?.relatedStories || []), ...peopleBoxSlugs, ...relatedSlugs],
      excludeMarkerIds: [
        ...new Set([
          ...(routeForNearby?.markers || []).map((marker) => String(marker.number)),
          ...matchedMarkersForStory.map((m) => String(m.id)),
        ]),
      ],
    })
    const nearbyItems = related[0].match(/<li class="nearby-place">[\s\S]*?<\/li>/g) || []
    // #346 (Critiquito): no card naming a protected site carries a distance.
    for (const card of related[0].match(/<li class="(?:related-story|nearby-place)">[\s\S]*?<\/li>/g) || []) {
      const slug = (card.match(/href="\/stories\/([^"/]+)\//) || [])[1]
      const target = slug && all.find((s) => s.slug === slug)
      if (target && isProtectedStory(target) && /nearby-miles|\bmiles?\b/.test(card)) throw new Error(`prerender: ${urlPath} shows a distance on protected site card ${slug}: ${card.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 400)}`)
    }
    if (isProtectedStory(story) && nearbyItems.length) throw new Error(`prerender: ${urlPath} protected story shows nearby cards`)
    if (!PrerenderPages.publicGeo(story) && nearbyItems.length) {
      throw new Error(`prerender: ${urlPath} shows nearby places without a public pin`)
    }
    if (PrerenderPages.publicGeo(story) && !isProtectedStory(story)) {
      const nearbyStoriesHtml = nearbyItems.filter((item) => item.includes('href="/stories/'))
      const nearbyMarkersHtml = nearbyItems.filter((item) => item.includes('href="/#map/markers/'))
      if (nearbyExpected.filter((row) => row.kind === 'story').length >= 3 && (nearbyStoriesHtml.length < 3 || nearbyStoriesHtml.length > 5)) {
        throw new Error(`prerender: ${urlPath} has ${nearbyStoriesHtml.length} nearby story links`)
      }
      if (nearbyExpected.filter((row) => row.kind === 'marker').length >= 3 && (nearbyMarkersHtml.length < 3 || nearbyMarkersHtml.length > 5)) {
        throw new Error(`prerender: ${urlPath} has ${nearbyMarkersHtml.length} nearby marker links`)
      }
      if (nearbyMarkersHtml.length && nearbyMarkersHtml.some((item) => !item.includes('>Historical marker<'))) {
        throw new Error(`prerender: ${urlPath} nearby marker is missing its label`)
      }
      if (nearbyStoriesHtml.length && nearbyStoriesHtml.some((item) => !item.includes('>Story<'))) {
        throw new Error(`prerender: ${urlPath} nearby story is missing its Story label`)
      }
      if (nearbyItems.length && nearbyItems.some((item) => !item.includes('class="nearby-miles"'))) {
        throw new Error(`prerender: ${urlPath} nearby distance is not on its own line`)
      }
      if (/href="\/#(?:map\/stories|timeline)\//.test(related[0])) {
        throw new Error(`prerender: ${urlPath} nearby stories are not crawlable pages`)
      }
      const expectedStoryHrefs = nearbyExpected.filter((row) => row.kind === 'story').map((row) => `/stories/${row.slug}/`)
      const actualStoryHrefs = nearbyStoriesHtml.map((item) => (item.match(/href="([^"]+)"/) || [])[1])
      if (expectedStoryHrefs.join('|') !== actualStoryHrefs.join('|')) {
        throw new Error(`prerender: ${urlPath} nearby stories are not the nearest unused stories`)
      }
    }
    const markerHrefs = [...html.matchAll(/href="(\/#map\/markers\/[^"]+)"/g)].map((match) => match[1])
    if (new Set(markerHrefs).size !== markerHrefs.length) {
      throw new Error(`prerender: ${urlPath} repeats a historical marker link`)
    }
    if (story.photo?.image_url) {
      if (!html.includes('class="story-sidebar-photo-attr story-photo-credit"')) {
        throw new Error(`prerender: ${urlPath} story photo is missing its credit line`)
      }
      const sourceUrl = story.photo.source_url || ''
      if (sourceUrl && !html.includes(PrerenderPages.escapeHtml(sourceUrl))) {
        throw new Error(`prerender: ${urlPath} photo credit is missing its source link`)
      }
    }
    const items = crumbs?.itemListElement || []
    if (items.some((item) => String(item.item || '').includes('/#timeline'))) {
      throw new Error(`prerender: ${urlPath} breadcrumb points at the homepage hash`)
    }
    if (items.length !== 3 || items[0]?.item !== `${PrerenderPages.SITE}/`) {
      throw new Error(`prerender: ${urlPath} breadcrumb must have 3 levels, found ${items.length}`)
    }
    if (items.length >= 3 && !String(items[1]?.item || '').includes('/stories/') && !String(items[1]?.item || '').includes('/layers/')) {
      throw new Error(`prerender: ${urlPath} breadcrumb level 2 is not /stories/ or a layer page`)
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
    const rawUrl = story.photo?.image_url || ''
    const photo = rawUrl ? PrerenderPages.photoAbsolute(rawUrl) : ''
    const socialPhoto = photo && !PrerenderPages.isAiArtUrl(rawUrl) ? photo : ''
    const route = routeBySlug(story.slug)
    const expectedImage = socialPhoto || (route ? absoluteUrl(route.files.fullPng) : PrerenderPages.LOGO)
    const expectedKind = socialPhoto ? 'story photo' : route ? '1600 route map' : 'story photo or logo fallback'
    if (!html.includes(`property="og:image" content="${PrerenderPages.escapeHtml(expectedImage)}"`)) {
      throw new Error(`prerender: ${urlPath} og:image is not the ${expectedKind}`)
    }
    const articleImage = article?.image
    const articleImageUrl =
      typeof articleImage === 'string'
        ? articleImage
        : articleImage?.url || (Array.isArray(articleImage) ? articleImage[0]?.url || articleImage[0] : '')
    if (expectedImage === PrerenderPages.LOGO) {
      if (articleImage !== undefined) {
        throw new Error(`prerender: ${urlPath} Article image must be omitted when using logo fallback`)
      }
    } else if (articleImageUrl !== expectedImage) {
      throw new Error(`prerender: ${urlPath} Article image is not the og:image`)
    }
    if (!html.includes(`name="twitter:image" content="${PrerenderPages.escapeHtml(expectedImage)}"`)) {
      throw new Error(`prerender: ${urlPath} twitter:image is missing`)
    }
    if (route) PrerenderPages.assertRouteMap(html, story, route, data)
    if (photo) {
      const alt = PrerenderPages.photoAlt(story.photo, story.title)
      if (!alt || alt === 'Kentucky History Drive logo') {
        throw new Error(`prerender: ${urlPath} photo alt is empty`)
      }
      if (!html.includes(`alt="${PrerenderPages.escapeHtml(alt)}"`)) {
        throw new Error(`prerender: ${urlPath} in-page photo alt does not match`)
      }
      const size = PrerenderPages.photoSizes?.[story.photo.image_url]
      if (!size?.width || !size?.height) {
        throw new Error(`prerender: ${urlPath} story photo is missing width and height`)
      }
      if (socialPhoto) {
        if (html.includes('property="og:image" content="' + PrerenderPages.LOGO + '"')) {
          throw new Error(`prerender: ${urlPath} used the logo instead of the story photo`)
        }
        if (!html.includes(`property="og:image:width" content="${size.width}"`)) {
          throw new Error(`prerender: ${urlPath} og:image:width is missing`)
        }
        if (!html.includes(`property="og:image:height" content="${size.height}"`)) {
          throw new Error(`prerender: ${urlPath} og:image:height is missing`)
        }
        const imageNode = Array.isArray(article?.image)
          ? article.image.find((item) => item && typeof item === 'object' && item.url === photo)
          : article?.image
        if (imageNode?.width !== size.width || imageNode?.height !== size.height) {
          throw new Error(`prerender: ${urlPath} Article image size does not match og:image`)
        }
      }
      if (!html.includes(`width="${size.width}"`) || !html.includes(`height="${size.height}"`)) {
        throw new Error(`prerender: ${urlPath} in-page photo is missing width and height`)
      }
      if (!html.includes('loading="eager"') || !html.includes('fetchpriority="high"')) {
        throw new Error(`prerender: ${urlPath} main photo is not eager`)
      }
      const cc = ccByLicense(story.photo)
      if (cc) {
        const licenseHref = `href="${PrerenderPages.escapeHtml(cc.url)}"`
        if (!html.includes(licenseHref) || !html.includes('rel="license noopener noreferrer"')) {
          throw new Error(`prerender: ${urlPath} CC license is not linked`)
        }
        if (!html.includes('>source file</a>')) {
          throw new Error(`prerender: ${urlPath} is missing the source file link`)
        }
      }
    }
    const film = filmForStory(story.slug)
    if (!film) return
    const filmDescription = filmDescriptionFromPlain(PrerenderPages.plainText(story.bodyMarkdown))
    PrerenderPages.assertFilmEmbed(html, film, filmDescription, urlPath)
    const transcript = PrerenderPages.transcriptForFilm(film)
    if (!html.includes('<details class="film-transcript"><summary>Transcript</summary><pre>')) {
      throw new Error(`prerender: ${urlPath} is missing the collapsible transcript`)
    }
    const firstLine = transcript.split('\n')[0]
    if (!firstLine || !html.includes(PrerenderPages.escapeHtml(firstLine))) {
      throw new Error(`prerender: ${urlPath} transcript does not include the first caption line`)
    }
    if ((transcript.match(/\n/g) || []).length < 10) {
      throw new Error(`prerender: ${urlPath} transcript is too short`)
    }
    if (story.photo?.image_url) {
      if (!html.includes('data-lcp="story-photo"') || !html.includes('fetchpriority="high"') || !html.includes('loading="eager"')) {
        throw new Error(`prerender: ${urlPath} story photo is not the priority image`)
      }
      if (/data-lcp="story-photo"[^>]*loading="lazy"|loading="lazy"[^>]*data-lcp="story-photo"/.test(html)) {
        throw new Error(`prerender: ${urlPath} story photo is lazy-loaded`)
      }
    }
    if (preloadsPoster(html, film.poster)) {
      throw new Error(`prerender: ${urlPath} preloads the video poster`)
    }
  }

  static filmPlain(story) {
    return filmDescriptionFromPlain(PrerenderPages.plainText(story.bodyMarkdown))
  }

  /** Start time from a VTT timestamp, as m:ss or h:mm:ss, without milliseconds. */
  static vttClock(stamp) {
    const parts = String(stamp || '').split(':')
    const seconds = Math.floor(Number(parts.at(-1)) || 0)
    const minutes = Number(parts.at(-2)) || 0
    const hours = parts.length > 2 ? Number(parts[0]) || 0 : 0
    const ss = String(seconds).padStart(2, '0')
    if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`
    return `${minutes}:${ss}`
  }

  /**
   * Plain-text transcript from a WebVTT file. Each kept cue is one line:
   * timestamp, then the cue text. Wrapped lines are joined, tags are removed,
   * and a cue whose text repeats an earlier cue is dropped.
   */
  static transcriptFromVtt(vtt) {
    const blocks = String(vtt || '')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/)
    const seen = new Set()
    const lines = []
    for (const block of blocks) {
      const rows = block.split('\n').map((row) => row.trim()).filter(Boolean)
      if (!rows.length || /^(WEBVTT|NOTE|STYLE|REGION)\b/i.test(rows[0])) continue
      const timeIdx = rows.findIndex((row) => row.includes('-->'))
      if (timeIdx < 0) continue
      const stamp = rows[timeIdx].match(/^((?:\d{2}:)?\d{2}:\d{2}\.\d+)/)
      if (!stamp) continue
      let cue = rows.slice(timeIdx + 1).join(' ')
      let prev
      do {
        prev = cue
        cue = cue.replace(/<[^>]+>/g, '')
      } while (cue !== prev)
      cue = cue
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
      if (!cue || seen.has(cue)) continue
      seen.add(cue)
      lines.push(`${PrerenderPages.vttClock(stamp[1])} ${cue}`)
    }
    return lines.join('\n')
  }

  static transcriptForFilm(film) {
    const rel = String(film?.captions || '').replace(/^\//, '')
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', rel)
    if (!rel || !fs.existsSync(file)) {
      throw new Error(`prerender: ${film?.id || 'film'} captions file is missing`)
    }
    const transcript = PrerenderPages.transcriptFromVtt(fs.readFileSync(file, 'utf8'))
    if (!transcript) throw new Error(`prerender: ${film.id} transcript is empty`)
    return transcript
  }

  static loadRelatedBundle(root) {
    const relatedFile = path.join(root, 'public/data/web/related-people.json')
    const peopleFile = path.join(root, 'public/data/people.json')
    if (!fs.existsSync(peopleFile)) throw new Error('prerender: public/data/people.json is missing; run build-people')
    const data = PrerenderPages.readJson(relatedFile)
    const people = PrerenderPages.readJson(peopleFile)
    if (!Array.isArray(people.people) || !people.people.length) throw new Error('prerender: public people file is empty')
    const spFile = path.join(root, 'public/data/web/story-people.json')
    const storyPeople = fs.existsSync(spFile) ? PrerenderPages.readJson(spFile) : { stories: {} }
    const tlFile = path.join(root, 'public/data/web/transport-links.json')
    const transportLinks = fs.existsSync(tlFile) ? PrerenderPages.readJson(tlFile) : { stories: {} }
    return { data, people, storyPeople, transportLinks, peopleById: new Map(people.people.map((p) => [p.id, p])), portraits: portraitsByStorySlug(data, people.people, people.storySubjects), personFor: personByStorySlug(data, people.people, people.storySubjects) }
  }

  /** Main subject (shared rule in src/related-people.js storySubject). */
  static storyPortrait(story, bundle) {
    if (!bundle?.people?.people) return { person: null, reason: '' }
    return storySubject(bundle.data, bundle.people.people, story, bundle.people.storySubjects)
  }

  /** PR B: people links (lead + body) and inline portraits (body only), from story-people.json. */
  static storyPeopleParts(story, lead, bodyHtml, bundle, { showLeadPortrait = true } = {}) {
    const leadHtml = lead ? `<p class="story-lead">${PrerenderPages.escapeHtml(lead)}</p>` : ''
    const entry = bundle?.storyPeople?.stories?.[story.slug]
    // Item 70: one /roads-and-rails/ link on the first mention in the lead or body, after the people links.
    const transport = bundle?.transportLinks?.stories?.[story.slug]
    const split = '<!--kh-story-people-->'
    if (!entry) {
      const [l, ...b] = applyTransportLink(`${leadHtml}${split}${bodyHtml}`, transport).split(split)
      return { lead: l, body: b.join(split) }
    }
    const subjectPerson = PrerenderPages.storyPortrait(story, bundle).person
    // Lead portrait only when it is not already the Kentucky-today hero. Either way, drop that
    // person from the portraits strip so the face is not shown twice large.
    const subject = Boolean(subjectPerson) && showLeadPortrait
    const bodyStart = lead ? 1 : 0
    const pageEntry = subjectPerson
      ? { ...entry, portraits: (entry.portraits || []).filter((id) => id !== subjectPerson.id) }
      : entry
    const done = applyStoryPeople(`${leadHtml}${split}${bodyHtml}`, pageEntry, bundle.peopleById, (h) => (h.startsWith('#timeline/') ? `/stories/${h.slice(10)}/` : h), {
      minPara: bodyStart + (subject ? 1 : 0),
      startLeft: subject,
    })
    const [l, ...b] = applyTransportLink(done, transport).split(split)
    return { lead: l, body: b.join(split) }
  }

  /** Item 71: optional non-portrait inline figure (e.g. a culture AI illustration) with alt, credit and a visible note. */
  /** priority: no lead photo or film above it, so the figure is the first image under the h1 (likely LCP): load it eagerly. */
  /** Shared with the SPA reader via src/story-figure.js (Critiquito #5 on #288); strict throws on non-/content/ srcs. */
  static storyFigureHtml(fig, { priority = false } = {}) {
    return storyFigureHtml(fig, { priority, strict: true })
  }

  static storyPortraitHtml(person) {
    return storyPortraitHtml(person)
  }

  static relatedPeopleSection(story, all, relatedBundle) {
    if (!relatedBundle) return ''
    const titleFor = (slug) => all.find((item) => item.slug === slug)?.title || ''
    return relatedBlockHtml(relatedBundle.data, story.slug, titleFor, 'storyPeopleH', {
      portraits: relatedBundle.portraits,
      personFor: relatedBundle.personFor,
      linkFor: (slug) => `/stories/${encodeURIComponent(slug)}/`,
    })
  }

  static peopleSilhouette() {
    return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="22" r="10" fill="currentColor"/><path d="M12 56c2.2-12 9-18 20-18s17.8 6 20 18" fill="currentColor"/></svg>`
  }

  static peopleCard(person, titleFor, identifier, yearsFor = () => '') {
    const name = PrerenderPages.escapeHtml(person.name)
    const line = identifier
      ? `<p class="people-id">${PrerenderPages.escapeHtml(identifier)}</p>`
      : ''
    // Two stories about the same person ("Hugh McGary, the …") read alike; add each one's years.
    const lead = (t) => String(t || '').split(',')[0].trim().toLowerCase()
    const leads = (person.stories || []).map((slug) => lead(titleFor(slug))).filter(Boolean)
    const stories = (person.stories || [])
      .map((slug) => {
        let title = titleFor(slug)
        if (!title) return ''
        const years = yearsFor(slug)
        if (years && leads.filter((l) => l === lead(title)).length > 1) title = `${title} (${years})`
        return `<li><a href="/stories/${encodeURIComponent(slug)}/">${PrerenderPages.escapeHtml(title)}</a></li>`
      })
      .filter(Boolean)
      .join('')
    const storyList = stories ? `<ul class="people-stories">${stories}</ul>` : ''
    let media
    if (person.image) {
      const alt = portraitAlt(person)
      media = `<picture class="people-photo"><source srcset="${PrerenderPages.escapeHtml(person.image.webp)}" type="image/webp"><img src="${PrerenderPages.escapeHtml(person.image.jpg)}" width="512" height="512" alt="${PrerenderPages.escapeHtml(alt)}" loading="lazy" decoding="async"></picture>`
    } else {
      media = `<div class="people-fallback" aria-hidden="true">${PrerenderPages.peopleSilhouette()}<span class="people-initials">${PrerenderPages.escapeHtml(initials(person.name))}</span></div>`
    }
    const badge = person.ai ? `<p class="people-badge">AI illustration</p>` : ''
    const license = person.licenseUrl
      ? `<a href="${PrerenderPages.escapeHtml(person.licenseUrl)}" rel="license">${PrerenderPages.escapeHtml(person.license)}</a>`
      : PrerenderPages.escapeHtml(person.license)
    const credit = person.image
      ? `<p class="people-credit">${PrerenderPages.escapeHtml(PrerenderPages.peopleCreditLead(person))}${person.ai ? '' : license}</p>`
      : ''
    return `<li class="people-card" id="${PrerenderPages.escapeHtml(person.id)}">${media}<h3>${name}</h3>${line}${badge}${credit}${storyList}</li>`
  }

  static personNode(person, source, storiesBySlug) {
    const node = {
      '@type': 'Person',
      '@id': `${PrerenderPages.SITE}/people/#${person.id}`,
      name: person.name,
    }
    const span = knownLifeSpan(source?.lifeDates)
    if (span) {
      node.birthDate = span.birthDate
      node.deathDate = span.deathDate
    }
    const subjectOf = (person.stories || [])
      .filter((slug) => storiesBySlug.has(slug))
      .map((slug) => `${PrerenderPages.SITE}/stories/${encodeURIComponent(slug)}/`)
    if (subjectOf.length) node.subjectOf = subjectOf
    if (person.image && !person.ai) node.image = `${PrerenderPages.SITE}${person.image.jpg}`
    return node
  }

  static peoplePage(peopleFile, stories, cssHrefs, sourcePeople = []) {
    const titleFor = (slug) => stories.find((story) => story.slug === slug)?.title || ''
    const storiesBySlug = new Map(stories.map((story) => [story.slug, story]))
    const sourceById = new Map(sourcePeople.map((person) => [person.id, person]))
    const lineFor = (person) => personIdentifier(sourceById.get(person.id), storiesBySlug)
    const yearsFor = (slug) => {
      const st = storiesBySlug.get(slug)
      if (!st?.yearStart) return ''
      return st.yearEnd && st.yearEnd !== st.yearStart ? `${st.yearStart}–${st.yearEnd}` : String(st.yearStart)
    }
    const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
    const illustrated = peopleFile.people.filter((person) => person.image).sort(byName)
    const plain = peopleFile.people.filter((person) => !person.image).sort(byName)
    const ordered = [...illustrated, ...plain]
    const aiCount = illustrated.filter((person) => person.ai).length
    const realCount = illustrated.length - aiCount
    const total = peopleFile.people.length
    const withLine = ordered.filter((person) => lineFor(person)).length
    const withDates = sourcePeople.filter((person) => String(person.lifeDates || '').trim()).length
    const withPlace = sourcePeople.filter((person) => personPlace(person.stories, storiesBySlug)).length
    console.log(`people page: ${withLine} of ${total} identifier lines (${withDates} with dates, ${withPlace} with a place)`)
    const pageUrl = `${PrerenderPages.SITE}/people/`
    const description =
      'People from the Kentucky history stories, with labeled AI illustrations and credited public-domain and Creative Commons portraits.'
    const lead = `${total} people: ${realCount} real portraits and ${aiCount} AI illustrations. ${plain.length} more are listed with initials until a portrait is ready.`
    const main = `<article class="people-page">
        <nav class="story-crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">People</span>
        </nav>
        <header class="story-head">
          <p class="static-kicker">People</p>
          <h1>People</h1>
          <p class="story-lead">${PrerenderPages.escapeHtml(lead)}</p>
        </header>
        <section class="people-group" aria-labelledby="people-portraits-heading">
          <h2 id="people-portraits-heading">Portraits</h2>
          <ul class="people-grid">${illustrated.map((person) => PrerenderPages.peopleCard(person, titleFor, lineFor(person), yearsFor)).join('')}</ul>
        </section>
        <section class="people-group" aria-labelledby="people-names-heading">
          <h2 id="people-names-heading">Names without a portrait yet</h2>
          <ul class="people-grid">${plain.map((person) => PrerenderPages.peopleCard(person, titleFor, lineFor(person), yearsFor)).join('')}</ul>
        </section>
      </article>`
    const jsonLd = PrerenderPages.jsonLdScript([
      PrerenderPages.organizationNode(),
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'People',
        description,
        isPartOf: { '@type': 'WebSite', name: 'Kentucky History Drive', url: `${PrerenderPages.SITE}/` },
        publisher: { '@id': PrerenderPages.ORG_ID },
      },
      {
        '@type': 'ItemList',
        '@id': `${pageUrl}#list`,
        numberOfItems: ordered.length,
        itemListElement: ordered.map((person, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: PrerenderPages.personNode(person, sourceById.get(person.id), storiesBySlug),
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'People', item: pageUrl },
        ],
      },
    ])
    return PrerenderPages.shell({
      title: 'People · Kentucky History Drive',
      description,
      canonical: pageUrl,
      cssHrefs,
      image: PrerenderPages.LOGO,
      imageAlt: 'Kentucky History Drive official seal',
      ogType: 'website',
      jsonLd,
      activeRoute: 'people',
      main,
    })
  }

  static assertPeople(html, peopleFile, sourcePeople = [], stories = []) {
    if (!html.includes('<h1>People</h1>')) throw new Error('prerender: /people/ is missing its heading')
    if (!html.includes('href="/people/"') || !html.includes('data-route="people"') || !html.includes('aria-current="page"')) {
      throw new Error('prerender: /people/ is missing its nav link')
    }
    if (/upload\.wikimedia\.org/i.test(html)) {
      throw new Error('prerender: /people/ hotlinks a Wikimedia file')
    }
    const remoteImg = [...html.matchAll(/<(?:img|source)\b[^>]*>/gi)].some((tag) => /(?:src|srcset)="https?:/i.test(tag[0]))
    if (remoteImg) throw new Error('prerender: /people/ hotlinks an image')
    const illustrated = peopleFile.people.filter((person) => person.image)
    const ai = illustrated.filter((person) => person.ai)
    const real = illustrated.length - ai.length
    const plain = peopleFile.people.length - illustrated.length
    const lead = `${peopleFile.people.length} people: ${real} real portraits and ${ai.length} AI illustrations. ${plain} more are listed with initials until a portrait is ready.`
    if (!html.includes(lead)) {
      throw new Error('prerender: /people/ lead does not match the portrait counts')
    }
    const badges = html.match(/class="people-badge"/g) || []
    if (badges.length !== ai.length) {
      throw new Error(`prerender: /people/ has ${badges.length} AI badges, expected ${ai.length}`)
    }
    if (!html.includes('class="people-fallback"')) throw new Error('prerender: /people/ is missing a placeholder')
    const storiesBySlug = new Map(stories.map((story) => [story.slug, story]))
    const sourceById = new Map(sourcePeople.map((person) => [person.id, person]))
    let expectedLines = 0
    for (const person of peopleFile.people) {
      const line = personIdentifier(sourceById.get(person.id), storiesBySlug)
      if (!line) continue
      expectedLines += 1
      if (!html.includes(`<p class="people-id">${PrerenderPages.escapeHtml(line)}</p>`)) {
        throw new Error(`prerender: /people/ is missing the identifier for ${person.id}`)
      }
    }
    const lines = html.match(/class="people-id"/g) || []
    if (lines.length !== expectedLines) {
      throw new Error(`prerender: /people/ has ${lines.length} identifier lines, expected ${expectedLines}`)
    }
    if (!html.includes('Lexington co-founder, militia officer · 1756–1807')) {
      throw new Error('prerender: /people/ is missing Levi Todd’s recorded role and dates')
    }
    const licensed = peopleFile.people.filter((person) => person.licenseUrl)
    for (const person of licensed) {
      const link = `<a href="${PrerenderPages.escapeHtml(person.licenseUrl)}" rel="license">${PrerenderPages.escapeHtml(person.license)}</a>`
      if (!html.includes(link)) {
        throw new Error(`prerender: /people/ is missing the license link for ${person.id}`)
      }
    }
    const licenseLinks = html.match(/rel="license"/g) || []
    if (licenseLinks.length !== licensed.length) {
      throw new Error(`prerender: /people/ has ${licenseLinks.length} license links, expected ${licensed.length}`)
    }
    const ballard = html.match(/<li class="people-card" id="bland-ballard">[\s\S]*?<\/li>/)
    if (!ballard || !ballard[0].includes('class="people-fallback"') || /<img\b/.test(ballard[0])) {
      throw new Error('prerender: Bland Ballard must stay a placeholder, with no image')
    }
    for (const person of illustrated) {
      const alt = portraitAlt(person)
      if (!html.includes(`alt="${PrerenderPages.escapeHtml(alt)}"`)) {
        throw new Error(`prerender: /people/ is missing alt text for ${person.id}`)
      }
      if (!html.includes(PrerenderPages.escapeHtml(PrerenderPages.peopleCreditLead(person))) || (!person.ai && !html.includes(PrerenderPages.escapeHtml(person.license)))) {
        throw new Error(`prerender: /people/ is missing the credit or license for ${person.id}`)
      }
      if (!html.includes(`src="${person.image.jpg}"`) || !html.includes(`srcset="${person.image.webp}"`)) {
        throw new Error(`prerender: /people/ is missing the local image for ${person.id}`)
      }
      if (person.ai && !html.includes('>AI illustration<')) {
        throw new Error(`prerender: /people/ AI badge text is missing`)
      }
    }
    const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    if (!block) throw new Error('prerender: /people/ is missing JSON-LD')
    let data
    try {
      data = JSON.parse(block[1])
    } catch (err) {
      throw new Error(`prerender: /people/ has invalid JSON-LD (${err.message})`)
    }
    const nodes = data['@graph'] || []
    const list = nodes.find((node) => node['@type'] === 'ItemList')
    if (!list || list.numberOfItems !== peopleFile.people.length || list.itemListElement?.length !== peopleFile.people.length) {
      throw new Error('prerender: /people/ ItemList does not cover every person')
    }
    const byId = new Map()
    for (const entry of list.itemListElement) {
      const item = entry.item
      if (item?.['@type'] !== 'Person' || typeof item['@id'] !== 'string') {
        throw new Error('prerender: /people/ ItemList entry is not a Person')
      }
      const prefix = `${PrerenderPages.SITE}/people/#`
      if (!item['@id'].startsWith(prefix)) throw new Error(`prerender: /people/ Person @id is not ${prefix}`)
      byId.set(item['@id'].slice(prefix.length), item)
    }
    for (const person of peopleFile.people) {
      const item = byId.get(person.id)
      if (!item || item.name !== person.name) {
        throw new Error(`prerender: /people/ JSON-LD is missing ${person.id}`)
      }
      const span = knownLifeSpan(sourceById.get(person.id)?.lifeDates)
      if (span) {
        if (item.birthDate !== span.birthDate || item.deathDate !== span.deathDate) {
          throw new Error(`prerender: /people/ dates for ${person.id} do not match the recorded span`)
        }
      } else if (item.birthDate || item.deathDate) {
        throw new Error(`prerender: /people/ invented dates for ${person.id}`)
      }
      if (person.image && !person.ai) {
        if (item.image !== `${PrerenderPages.SITE}${person.image.jpg}`) {
          throw new Error(`prerender: /people/ JSON-LD image for ${person.id} is not the local portrait`)
        }
      } else if (item.image) {
        throw new Error(`prerender: /people/ JSON-LD image is set for ${person.id}`)
      }
      const subjectOf = (person.stories || [])
        .filter((slug) => storiesBySlug.has(slug))
        .map((slug) => `${PrerenderPages.SITE}/stories/${encodeURIComponent(slug)}/`)
      const got = item.subjectOf || []
      if (subjectOf.length !== got.length || subjectOf.some((url, index) => got[index] !== url)) {
        throw new Error(`prerender: /people/ subjectOf for ${person.id} does not match the live stories`)
      }
    }
    if (byId.get('blackfish')?.birthDate) {
      throw new Error('prerender: Blackfish’s circa dates must not become a birthDate')
    }
  }

  static videosPage(films, stories, cssHrefs) {
    const pageUrl = `${PrerenderPages.SITE}/videos/`
    const cards = []
    for (const film of films) {
      const story = stories.find((item) => item.slug === film.storySlug)
      if (!story) {
        throw new Error(`prerender: no story for film "${film.title}" (${film.storySlug})`)
      }
      const description = PrerenderPages.filmPlain(story)
      if (!description) throw new Error(`prerender: film ${film.id} has no story description`)
      cards.push(
        filmCardHtml(film, {
          summary: description,
          href: `/stories/${story.slug}/#${film.id}`,
        }),
      )
    }
    const lead = 'Short films from Kentucky History Drive stories — people, places, and routes you can open on the map. Each film sits on its story page with sources and a path to related stops. This index lists every published film; more are in production. Prefer the story page if you want the full narrative and research notes.'
    const description = films.length
      ? PrerenderPages.videosMetaDescription(PrerenderPages.filmPlain(stories.find((item) => item.slug === films[0].storySlug))) || lead
      : lead
    const image = films[0]?.poster || PrerenderPages.LOGO
    const main = `<article class="videos-page">
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
            url: `${PrerenderPages.SITE}/stories/${film.storySlug}/#${film.id}`,
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
    ])
    return PrerenderPages.shell({
      title: 'Videos · Kentucky History Drive',
      description,
      canonical: pageUrl,
      // Shannon item 93: noindex until the page is filled out; follow so its story links still count.
      robots: PrerenderPages.THIN_ROBOTS,
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
    if (!/controls/.test(tag) || !/playsinline/.test(tag)) {
      throw new Error(`prerender: ${urlPath} video is missing controls or playsinline`)
    }
    if (/crossorigin=/i.test(tag)) {
      throw new Error(`prerender: ${urlPath} video sets crossorigin, which blocks the caption track off the production origin`)
    }
    if (!/class="film-cc[\s"]/.test(html) || !html.includes('aria-label="Captions"')) {
      throw new Error(`prerender: ${urlPath} is missing the CC control`)
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
    const expectedCaption = new URL(film.captions, `${PrerenderPages.SITE}/`).href
    if (captionUrl !== expectedCaption) throw new Error(`prerender: ${urlPath} VideoObject caption does not point at the VTT`)
    if (!nodes.some((node) => node['@type'] === 'Organization' && node['@id'] === PrerenderPages.ORG_ID)) {
      throw new Error(`prerender: ${urlPath} is missing the Organization node`)
    }
  }

  static assertVideos(html, films, stories) {
    if (!html.includes('<h1>Videos</h1>')) throw new Error('prerender: /videos/ is missing its heading')
    if (!html.includes('href="/videos/"')) throw new Error('prerender: /videos/ footer link is missing')
    if (html.includes('"@type":"VideoObject"') || /<video\b/i.test(html)) {
      throw new Error('prerender: /videos/ embeds a film; the story page is the watch page')
    }
    if (html.includes('<summary>Transcript</summary>')) {
      throw new Error('prerender: /videos/ includes a transcript; that belongs on the story page')
    }
    for (const film of films) {
      const story = stories.find((item) => item.slug === film.storySlug)
      const href = `/stories/${story.slug}/#${film.id}`
      if (!html.includes(`href="${href}"`)) {
        throw new Error(`prerender: /videos/ does not link ${film.id} to its story page`)
      }
      if (!html.includes(PrerenderPages.escapeHtml(film.title))) {
        throw new Error(`prerender: /videos/ is missing the title for ${film.id}`)
      }
      if (!html.includes(PrerenderPages.escapeHtml(PrerenderPages.filmPlain(story)))) {
        throw new Error(`prerender: /videos/ is missing the summary for ${film.id}`)
      }
    }
  }

  /** Static /timeline/ stub: meta refresh + location.replace to /#timeline, with a visible link. */
  /**
   * /roads-and-rails/ (SEO #291): a static "Stories on these routes" list and JSON-LD
   * (CollectionPage + ItemList + BreadcrumbList), both built from the transport-link stories
   * (public/data/web/transport-links.json, from scripts/transport-links.json), so new linked stories appear automatically.
   */
  static roadsRailsFill(html, stories, root) {
    const tlFile = path.join(root, 'public/data/web/transport-links.json')
    const linked = fs.existsSync(tlFile) ? Object.keys(PrerenderPages.readJson(tlFile).stories || {}) : []
    const bySlug = new Map(stories.map((s) => [s.slug, s]))
    const list = linked
      .map((slug) => bySlug.get(slug))
      .filter(Boolean)
      .sort((a, b) => (Number(a.yearStart) || 9999) - (Number(b.yearStart) || 9999) || String(a.title).localeCompare(String(b.title)))
    if (list.length !== linked.length) throw new Error(`prerender: /roads-and-rails/ ${linked.length - list.length} linked stories are not live`)
    if (!list.length) throw new Error('prerender: /roads-and-rails/ has no linked stories')
    const esc = PrerenderPages.escapeHtml
    const rows = list
      .map((s) => {
        const slug = encodeURIComponent(s.slug)
        const onMap = s.lat != null && s.lon != null ? `<a class="transport-story-map" href="/#map/stories/${slug}">On the map</a>` : ''
        return `        <li><a class="transport-story-link" href="/stories/${slug}/"><span>${esc(s.title)}${s.yearStart ? ` <span class="muted">(${esc(s.yearStart)})</span>` : ''}</span></a>${onMap}</li>`
      })
      .join('\n')
    const section = `<section class="transport-stories" aria-labelledby="transportStoriesH">
        <h2 id="transportStoriesH">Stories on these routes</h2>
        <ul class="transport-story-list">
${rows}
        </ul>
        <p class="transport-plan"><a class="transport-plan-link" href="/drives/">Plan a drive</a> along Kentucky's historic routes.</p>
      </section>`
    const pageUrl = `${PrerenderPages.SITE}/roads-and-rails/`
    const ld = PrerenderPages.jsonLdScript([
      PrerenderPages.organizationNode(),
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#page`,
        url: pageUrl,
        name: 'Roads & Rails: Kentucky Trails, Railroads & Parkways Map',
        description: "Watch Kentucky's trails, roads, railroads and parkways appear year by year on an interactive map, from the 1775 Wilderness Road to the 1970s parkways.",
        inLanguage: 'en-US',
        isPartOf: { '@type': 'WebSite', url: `${PrerenderPages.SITE}/`, name: 'Kentucky History Drive' },
        publisher: PrerenderPages.publisherNode(),
        breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        mainEntity: { '@id': `${pageUrl}#stories` },
      },
      {
        '@type': 'ItemList',
        '@id': `${pageUrl}#stories`,
        name: 'Stories on these routes',
        numberOfItems: list.length,
        itemListElement: list.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.title, url: `${PrerenderPages.SITE}/stories/${s.slug}/` })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Roads & Rails', item: pageUrl },
        ],
      },
    ])
    if (!html.includes('<!-- khd-roads-stories -->') || !html.includes('<!-- khd-roads-jsonld -->')) {
      throw new Error('prerender: /roads-and-rails/ is missing its stories or JSON-LD placeholder')
    }
    return html.replace('<!-- khd-roads-stories -->', () => section).replace('<!-- khd-roads-jsonld -->', () => ld)
  }

  /** Pages marked noindex,follow until they are filled out (Shannon item 93). Kept out of the sitemap. */
  static THIN_ROBOTS = 'noindex, follow'
  static NOINDEX_PATHS = ['/videos/', '/routes/']

  /**
   * /404.html: "We couldn't find that page", a story search (GET /stories/?q=, which the list filter reads),
   * Browse all stories and Home. noindex, no canonical, no ads (error pages carry no ads). All links are
   * root-absolute because Amplify serves this file at any depth.
   */
  static notFoundPage(cssHrefs) {
    const main = `<style>
        body:has(.not-found) { display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; }
        body:has(.not-found) > main { flex: 1 0 auto; min-height: 0; }
        .not-found { max-width: 40rem; margin: 2.5rem auto 3rem; }
        .not-found h1 { margin: 0 0 0.75rem; color: var(--heading); }
        .not-found-lede { margin: 0 0 1.25rem; }
        .not-found-search { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-end; margin: 0 0 1.5rem; }
        .not-found-search label { flex: 1 0 100%; font-weight: 600; }
        .not-found-search input { flex: 1 1 16rem; height: 44px; min-height: 44px; box-sizing: border-box; padding: 0 0.75rem; font: inherit; line-height: 1.25; color: var(--text); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
        .not-found-search button { height: 44px; min-height: 44px; box-sizing: border-box; padding: 0 1.1rem; font: inherit; font-weight: 600; border-radius: 10px; border: 0; background: var(--accent); color: var(--bg, #fff); cursor: pointer; }
        .not-found-links { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; margin: 0; padding: 0; list-style: none; }
        .not-found-links a { display: inline-flex; align-items: center; min-height: 44px; font-weight: 600; }
      </style>
      <article class="not-found">
        <h1>We couldn’t find that page</h1>
        <p class="not-found-lede">The address may be mistyped, or the page may have moved. Search the stories, browse the full list, or start again from the home page.</p>
        <form class="not-found-search" action="/stories/" method="get" role="search">
          <label for="notFoundQuery">Search stories</label>
          <input id="notFoundQuery" name="q" type="search" maxlength="100" placeholder="A person, place, county or topic" autocomplete="off" required />
          <button type="submit">Search</button>
        </form>
        <ul class="not-found-links">
          <li><a href="/stories/">Browse all stories</a></li>
          <li><a href="/">Home</a></li>
        </ul>
      </article>`
    return PrerenderPages.shell({
      title: 'Page not found · Kentucky History Drive',
      description: 'This page could not be found on Kentucky History Drive. Search the stories, browse all stories, or go to the home page.',
      canonical: '',
      cssHrefs,
      image: PrerenderPages.LOGO,
      imageAlt: 'Kentucky History Drive official seal',
      ogType: 'website',
      robots: 'noindex, follow',
      ads: false,
      main,
    })
  }

  static assertNotFound(html) {
    if (!html.includes('<h1>We couldn’t find that page</h1>')) throw new Error('prerender: 404.html is missing its heading')
    if (html.includes('rel="canonical"') || !html.includes('<meta name="robots" content="noindex, follow" />')) {
      throw new Error('prerender: 404.html must be noindex with no canonical')
    }
    if (html.includes('adsbygoogle')) throw new Error('prerender: 404.html must not load ads')
    if (!html.includes('class="top site-header"') || !html.includes('class="foot"')) throw new Error('prerender: 404.html is missing the site header or footer')
    const gaProblems = missingGaSnippet(html)
    if (gaProblems.length) throw new Error(`prerender: 404.html ${gaProblems.join('; ')}`)
  }

  static timelineRedirectHtml() {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${gtagHeadHtml()}
<title>Timeline · Kentucky History Drive</title>
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${PrerenderPages.SITE}/">
${faviconLinksHtml()}
<meta http-equiv="refresh" content="0; url=/#timeline">
<script>location.replace('/#timeline')</script>
</head>
<body>
<p>The timeline is at <a href="/#timeline">kyhistorydrive.com/#timeline</a>.</p>
</body>
</html>
`
  }

  /** Google video sitemap for each page that embeds a film. */
  static writeVideoSitemap(file, films, stories) {
    const rows = []
    for (const film of films) {
      const story = stories.find((item) => item.slug === film.storySlug)
      const description = PrerenderPages.escapeXml(PrerenderPages.filmPlain(story))
      const loc = `${PrerenderPages.SITE}/stories/${story.slug}/`
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
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${rows.join('\n')}
</urlset>
`
    fs.writeFileSync(file, xml)
  }

  static async collectPhotoSizes(root, stories) {
    const sizes = {}
    for (const [url, meta] of Object.entries(PrerenderPages.photoVariants || {})) {
      if (meta?.width > 0 && meta?.height > 0) sizes[url] = { width: meta.width, height: meta.height }
    }
    for (const story of stories) {
      const url = story.photo?.image_url
      if (!url || sizes[url]) continue
      if (!String(url).startsWith('/content/photos/') && !String(url).startsWith('/people/portraits/')) continue
      const abs = path.join(root, 'public', url.replace(/^\//, ''))
      if (!fs.existsSync(abs)) continue
      const meta = await sharp(abs).metadata()
      if (meta.width > 0 && meta.height > 0) sizes[url] = { width: meta.width, height: meta.height }
    }
    PrerenderPages.photoSizes = sizes
  }

  static editorialPage(cssHrefs) {
    const pageUrl = `${PrerenderPages.SITE}/editorial/`
    const description = 'How Kentucky History Drive researches stories, labels AI illustrations, protects archaeological sites, and handles corrections.'
    const main = `<article>
        <nav class="story-crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Editorial standards</span>
        </nav>
        <header class="story-head">
          <p class="static-kicker">Editorial</p>
          <h1>Editorial standards</h1>
          <p class="story-lead">How we research, credit images, protect fragile sites, and fix mistakes.</p>
        </header>
        <h2>How we research</h2>
        <p>Every claim a reader might question — a date, name, number, or quote — links to a source. We prefer primary documents and official records, then peer-reviewed or institutional work, then encyclopedias. When sources disagree, the story says so and names the range. Family tradition and oral history are labeled as such. Each story keeps a Research notes page with the outline behind it.</p>
        <h2>AI illustrations</h2>
        <p>We use real archival photographs whenever they exist. Where none do, or where an illustration serves the story better, we use AI images. Every AI image is visibly labeled <strong>AI illustration · Kentucky History Drive</strong> and is never presented as a photograph. AI portraits of historical people follow the same credit; when no known likeness exists, the credit adds that note. Reference art for the site always carries the Kentucky History Drive credit — never a separate studio name.</p>
        <h2>Protected archaeological sites</h2>
        <p>Kentucky’s archaeological sites are fragile and protected by law. For sites that are not open to the public, we show location only at the county level and never give directions or coordinates. Please visit only sites that are open to the public, and leave everything where you find it.</p>
        <h2>Corrections</h2>
        <p>If you spot an error, a missing credit, or a fairer reading of a source, tell us on the <a href="/contact/">Contact</a> page. We welcome corrections and fix them promptly. Substantive changes are noted in the story when the record warrants it.</p>
        <h2>Culture images and evidence pages</h2>
        <p>Some culture and territory pages stay limited or noindex until their image evidence and copy meet this standard. That gate is intentional: thin or contested material does not get a permanent public URL ahead of the research.</p>
        <div class="static-cta">
          <a class="btn" href="/contact/">Contact us</a>
          <a class="btn ghost" href="/about/">About</a>
          <a class="btn ghost" href="/">Home</a>
        </div>
      </article>`
    const jsonLd = PrerenderPages.jsonLdScript([
      PrerenderPages.organizationNode(),
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Editorial standards',
        description,
        isPartOf: { '@type': 'WebSite', name: 'Kentucky History Drive', url: `${PrerenderPages.SITE}/` },
        publisher: PrerenderPages.publisherNode(),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Editorial standards', item: pageUrl },
        ],
      },
    ])
    return PrerenderPages.shell({
      title: 'Editorial · Kentucky History Drive',
      description,
      canonical: pageUrl,
      cssHrefs,
      image: PrerenderPages.LOGO,
      imageAlt: 'Kentucky History Drive official seal',
      ogType: 'website',
      jsonLd,
      main,
    })
  }

  static contactPage(cssHrefs) {
    const pageUrl = `${PrerenderPages.SITE}/contact/`
    const description = 'Reach Kentucky History Drive for corrections, photo suggestions, and questions about the marker map and stories.'
    const main = `<article>
        <nav class="story-crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Contact</span>
        </nav>
        <header class="story-head">
          <p class="static-kicker">Contact</p>
          <h1>Contact</h1>
          <p class="story-lead">Questions, corrections, photo suggestions, and partnership notes.</p>
        </header>
        <h2>Write to us</h2>
        <p>Use the reveal below for the site email. Tell us the story or page URL when you can — it speeds up a fix.</p>
        ${contactLineHtml('Email:')}
        <h2>What to send</h2>
        <ul>
          <li><strong>Corrections</strong> — what the page says, what the source says, and a link if you have one.</li>
          <li><strong>Photos</strong> — rights-cleared archival suggestions for a story or layer pin.</li>
          <li><strong>General questions</strong> — the map, drives, videos, or the iPhone app waitlist.</li>
        </ul>
        <p>For how we research and credit images, see <a href="/editorial/">Editorial standards</a>. For who publishes the site, see <a href="/about/">About</a>.</p>
        <div class="static-cta">
          <a class="btn" href="/editorial/">Editorial standards</a>
          <a class="btn ghost" href="/about/">About</a>
          <a class="btn ghost" href="/">Home</a>
        </div>
      </article>`
    const jsonLd = PrerenderPages.jsonLdScript([
      PrerenderPages.organizationNode(),
      {
        '@type': 'ContactPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Contact',
        description,
        isPartOf: { '@type': 'WebSite', name: 'Kentucky History Drive', url: `${PrerenderPages.SITE}/` },
        publisher: PrerenderPages.publisherNode(),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Contact', item: pageUrl },
        ],
      },
    ])
    return PrerenderPages.shell({
      title: 'Contact · Kentucky History Drive',
      description,
      canonical: pageUrl,
      cssHrefs,
      image: PrerenderPages.LOGO,
      imageAlt: 'Kentucky History Drive official seal',
      ogType: 'website',
      jsonLd,
      main,
    })
  }

  static aboutPage(cssHrefs) {
    const description =
      'Kentucky History Drive: sourced Kentucky history stories, a marker map, a timeline and drive plans, with care for protected archaeological sites.'
    const main = `<article>
        <nav class="story-crumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">About</span>
        </nav>
        <header class="story-head">
          <p class="static-kicker">About</p>
          <h1 class="about-page-title">About Kentucky History Drive</h1>
          <p class="story-lead">Shannon Snowden writes the stories, and Kentucky History Drive publishes them with a map of Kentucky Historical Society markers.</p>
        </header>
        <figure class="about-seals" aria-labelledby="aboutSealsTitle">
          <h2 class="about-seals-title" id="aboutSealsTitle">Our seals</h2>
          <ul class="about-seals-list">
            <li><button type="button" class="about-seal-btn" aria-haspopup="dialog" aria-controls="route-map-lightbox" aria-label="Enlarge original black edition seal" data-full-src="/brand/khd-logo-512.webp"><img class="about-seal about-seal-0" src="/brand/khd-logo-512.png" loading="lazy" width="160" height="160" alt="Kentucky History Drive seal, original black edition: gold lettering, Kentucky outline, a road, a historical marker and crossed muskets on black" decoding="async" /></button></li>
            <li><button type="button" class="about-seal-btn" aria-haspopup="dialog" aria-controls="route-map-lightbox" aria-label="Enlarge navy edition seal" data-full-src="/brand/khd-logo-c-512.webp"><img class="about-seal about-seal-1" src="/brand/khd-logo-c-512.png" loading="lazy" width="160" height="160" alt="Kentucky History Drive seal, navy edition: cream center with a gold road, historical marker and crossed muskets inside a navy band with gold lettering" decoding="async" /></button></li>
            <li><button type="button" class="about-seal-btn" aria-haspopup="dialog" aria-controls="route-map-lightbox" aria-label="Enlarge gold-rim edition seal" data-full-src="/brand/khd-logo-c2-512.webp"><img class="about-seal about-seal-2" src="/brand/khd-logo-c2-512.png" loading="lazy" width="160" height="160" alt="Kentucky History Drive seal, gold-rim edition: cream center and navy band with gold lettering, framed by a bright gold outer rim" decoding="async" /></button></li>
          </ul>
          <figcaption class="about-seals-caption">One of these three seals rotates into the header on each visit. Tap a seal to enlarge it.</figcaption>
        </figure>
        <p class="story-lead"><strong>History is all around us.</strong></p>
        <p>Kentucky History Drive helps you find the history around you, see where it happened, and go see it for yourself. Every part of the site serves one path: from a story, to a place on the map, to a drive you can take.</p>
        <h2>What you’ll find here</h2>
        <ul>
          <li><strong>Stories.</strong> Short, sourced narratives about Kentucky’s people, places and events, with new stories added regularly. Each one links to its spot on the map, its place on the Timeline, and a nearby drive.</li>
          <li><strong>An interactive map.</strong> Kentucky Historical Society markers, history pins, museums, war sites, covered bridges, mills, distilleries, parks, cemeteries and more, plus the approximate areas of Native nations and archaeological cultures.</li>
          <li><strong>A Timeline.</strong> Browse Kentucky history by era and year range.</li>
          <li><strong>Faces to names.</strong> Each person in our stories is meant to get a portrait: a real photograph when one exists, or a labeled AI illustration when it doesn’t.</li>
          <li><strong>Drive plans.</strong> <a href="/drives/">Ready-made drives</a>, including loops that start at a distillery, plus a planner for trips from 1 hour to a full day. Each opens in Google Maps or Apple Maps.</li>
          <li><strong>Research outlines.</strong> Research notes and sources that go with stories.</li>
          <li><strong>Take stories on the road.</strong> Printable, PDF and Markdown copies of stories.</li>
        </ul>
        <h2>What we’re building</h2>
        <p>A free, phone-friendly companion for Kentuckians, road-trippers and history readers. Read a story at a marker, see what else happened nearby, and turn an afternoon into a trip. Our goal is history that’s accurate, fair to every people it covers, and easy to visit.</p>
        <h2>Sources and accuracy</h2>
        <p>We link claims readers might question to sources, prefer primary and official records, and say when sources disagree. Full research and correction practice is on <a href="/editorial/">Editorial standards</a>.</p>
        <h2>About our images</h2>
        <p>Archival photos when they exist; labeled AI illustrations when they don’t. Details and credit wording are on <a href="/editorial/">Editorial standards</a>.</p>
        <h2>Protecting archaeological sites</h2>
        <p>County-level only for sites that are not public; no directions. See <a href="/editorial/">Editorial standards</a>.</p>
        <h2>Publisher</h2>
        <p>Kentucky History Drive (kyhistorydrive.com) is the publisher of this site: the marker map, the timeline, and the story pages. An iPhone app is coming soon.</p>
        <h2 id="license">Credits</h2>
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
        <p>Questions, corrections, or photo suggestions: see the <a href="/contact/">Contact</a> page. Research methods and image policy: <a href="/editorial/">Editorial standards</a>.</p>
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
        author: { '@type': 'Person', '@id': `${PrerenderPages.SITE}/about/#shannon-snowden`, name: 'Shannon Snowden', url: `${PrerenderPages.SITE}/about/` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${PrerenderPages.SITE}/about/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${PrerenderPages.SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'About', item: `${PrerenderPages.SITE}/about/` },
        ],
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
      routeLightbox: true,
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
            <p><a href="/routes/">Kentucky history route maps</a> · <a href="/videos/">Videos</a> · <a href="/about/">About Kentucky History Drive</a> · <a href="/editorial/">Editorial standards</a> · <a href="/contact/">Contact</a></p>
          </div>
        </details>
      </nav>`
    if (!html.includes('id="crawlDirectory"')) {
      throw new Error('prerender: dist/index.html is missing #crawlDirectory')
    }
    html = html.replace(/<nav id="crawlDirectory"[\s\S]*?<\/nav>/, nav)
    // One story count for the homepage archive and /stories/: the live stories list.
    if (!/<h2 id="hp-layers-title"[^>]*>/.test(html)) throw new Error('prerender: dist/index.html is missing #hp-layers-title')
    html = html.replace(/<h2 id="hp-layers-title"[^>]*>[^<]*<\/h2>/, `<h2 id="hp-layers-title" data-story-count="${stories.length}">Browse all ${stories.length} stories</h2>`)
    if (!html.includes('adsbygoogle.js?client=ca-pub-8587137224654033')) {
      throw new Error('prerender: homepage is missing the AdSense head tag')
    }
    if (!html.includes(PrerenderPages.rssAlternateLink())) {
      throw new Error('prerender: homepage is missing the RSS alternate link')
    }
    const gaProblems = missingGaSnippet(html)
    if (gaProblems.length) {
      throw new Error(`prerender: homepage ${gaProblems.join('; ')} (${GA_MEASUREMENT_ID})`)
    }
    if (!/<script type="module"/.test(html)) throw new Error('prerender: homepage lost the app bundle')
    if (!html.includes('src="/route-map-lightbox.js"')) {
      throw new Error('prerender: homepage is missing the route map lightbox for the hash reader')
    }
    // #338: the #about / #app hash views are gone; About lives at /about/ only.
    if (/<section id="(?:about|app)"/.test(html)) {
      throw new Error('prerender: homepage still carries the retired #about / #app views')
    }
    if (!html.includes('"@type": "Organization"') && !html.includes('"@type":"Organization"')) {
      throw new Error('prerender: homepage is missing Organization JSON-LD')
    }
    const storyHrefs = (html.match(/href="\/stories\/[a-z0-9-]+\/"/g) || []).length
    const layerHrefs = (html.match(/href="\/layers\/[a-z0-9-]+\/"/g) || []).length
    if (storyHrefs < stories.length) throw new Error(`prerender: homepage has ${storyHrefs} story links, expected ${stories.length}`)
    if (layerHrefs < layers.length) throw new Error(`prerender: homepage has ${layerHrefs} layer links, expected ${layers.length}`)
    const routeLinks = (html.match(/href="\/routes\/"/g) || []).length
    if (!html.includes('class="hp-map-routes"') || routeLinks < 3) {
      throw new Error('prerender: homepage is missing the route maps link in the page, footer, or directory')
    }
    if (!html.includes('>Kentucky history route maps<')) {
      throw new Error('prerender: homepage is missing the Kentucky history route maps anchor')
    }
    fs.writeFileSync(file, html)
  }

  /** /drives/, then every public/drives/<slug>/index.html in order. */
  static drivePaths(root) {
    const dir = path.join(root, 'public/drives')
    if (!fs.existsSync(path.join(dir, 'index.html'))) return []
    const slugs = fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'index.html')))
      .map((d) => d.name)
      .sort()
    // /drives/build/ (the planner) is noindex,follow and stays out of the sitemap.
    return ['/drives/', ...slugs.map((s) => `/drives/${s}/`)]
  }

  static writePage(dist, urlPath, html) {
    const dir = path.join(dist, urlPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), html)
  }

  /** Home, about, stories, layers, then /privacy/ last. Each URL gets its own lastmod. */
  static updateSitemap(file, entries, expectedImages = ROUTE_MAPS.length, { allowMissingLastmod = false } = {}) {
    if (!entries.length || !String(entries[entries.length - 1].loc).endsWith('/privacy/')) {
      throw new Error('prerender: sitemap must end with /privacy/')
    }
    const seen = new Set()
    const rows = []
    let imageCount = 0
    for (const entry of entries) {
      if (!entry?.loc || seen.has(entry.loc)) continue
      seen.add(entry.loc)
      const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod || '')
        ? `\n    <lastmod>${PrerenderPages.escapeXml(entry.lastmod)}</lastmod>`
        : ''
      // Shallow clone: no git date → omit <lastmod> (never today). Full history must date every URL.
      if (!lastmod && !allowMissingLastmod) throw new Error(`prerender: ${entry.loc} is missing lastmod`)
      const images = (entry.images || [])
        .map((img) => {
          imageCount += 1
          return `    <image:image>
      <image:loc>${PrerenderPages.escapeXml(img.loc)}</image:loc>
      <image:title>${PrerenderPages.escapeXml(img.title)}</image:title>
      <image:caption>${PrerenderPages.escapeXml(img.caption)}</image:caption>
    </image:image>`
        })
        .join('\n')
      rows.push(`  <url>\n    <loc>${PrerenderPages.escapeXml(entry.loc)}</loc>${lastmod}${images ? `\n${images}` : ''}\n  </url>`)
    }
    if (!String(entries[entries.length - 1].loc).endsWith('/privacy/') || rows.at(-1).includes('/privacy</loc>')) {
      throw new Error('prerender: sitemap privacy URL must be /privacy/ and must be last')
    }
    // A noindex page must not be listed (Shannon item 93: /videos/ and /routes/ for now).
    for (const entry of entries) {
      let pathname = ''
      try {
        pathname = new URL(entry.loc).pathname
      } catch {
        throw new Error(`prerender: sitemap URL ${entry.loc} does not parse`)
      }
      if (PrerenderPages.NOINDEX_PATHS.includes(pathname)) throw new Error(`prerender: sitemap lists noindex page ${pathname}`)
    }
    if (imageCount !== expectedImages) {
      throw new Error(`prerender: sitemap has ${imageCount} route map images, expected ${expectedImages}`)
    }
    const xmlns = imageCount
      ? 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
      : 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
    fs.writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${xmlns}>\n${rows.join('\n')}\n</urlset>\n`)
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
