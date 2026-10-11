#!/usr/bin/env node
/**
 * Build-time RSS 2.0.
 *
 * /feed.xml is the newest stories (the date the story file was added to the
 * site, git first-commit, else publishedDate), about 50 items. The six route
 * stories are always included, even when they fall outside that window. Each
 * item links to the prerendered /stories/<slug>/ page and uses one whole
 * sentence. A route story uses its route-map sentence and the route-map PNG
 * (the same image the story page uses for Open Graph). Other stories carry
 * an enclosure plus media:content when they have a local photo.
 *
 * /layers/history/feed.xml and /layers/good-eats/feed.xml are written only
 * when every item in that layer has a stable on-site URL (a real /stories/
 * path, not a /#map/... fragment and not an off-site website). History pins
 * and Good Eats (the locals layer) do not, so those feeds are skipped.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROUTE_MAPS, routeBySlug } from '../src/route-maps.js'
import { PrerenderPages } from './prerender-pages.mjs'

const SITE = 'https://kyhistorydrive.com'
const STORY_FEED_PATH = '/feed.xml'
const STORY_FEED_URL = `${SITE}${STORY_FEED_PATH}`
const STORY_FEED_TITLE = 'Kentucky History Drive stories'
const FEED_ITEM_LIMIT = 50
const NAME = /^[A-Za-z_:][\w:.-]*/
const URL_KEYS = ['permalink', 'href', 'path', 'url', 'storyUrl', 'story_url', 'website']

const LAYER_SPECS = [
  {
    id: 'history',
    outPath: '/layers/history/feed.xml',
    dataFile: 'public/data/layers/history.geojson',
    title: 'Kentucky History Drive — History',
    channelLink: `${SITE}/layers/history/`,
    self: `${SITE}/layers/history/feed.xml`,
    description: 'History places on the Kentucky History Drive map.',
    join: 'history',
  },
  {
    id: 'good-eats',
    outPath: '/layers/good-eats/feed.xml',
    dataFile: 'public/data/layers/locals.geojson',
    title: 'Kentucky History Drive — Good Eats',
    channelLink: `${SITE}/layers/locals/`,
    self: `${SITE}/layers/good-eats/feed.xml`,
    description: 'Good Eats places on the Kentucky History Drive map. The map layer id is locals.',
    join: 'none',
  },
]

function clean(s) {
  return String(s ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function esc(s) {
  return clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function mime(url) {
  const file = String(url || '').split('?')[0].toLowerCase()
  if (file.endsWith('.png')) return 'image/png'
  if (file.endsWith('.webp')) return 'image/webp'
  if (file.endsWith('.gif')) return 'image/gif'
  if (file.endsWith('.avif')) return 'image/avif'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  return 'image/jpeg'
}

function rfc822(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!m) return ''
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toUTCString()
}

function isWholeSentence(s) {
  if (!s || !/\p{L}/u.test(s)) return false
  if (/(?:\u2026|\.\.\.)\s*$/u.test(s)) return false
  return /[.!?]["'”’)\]]*$/u.test(s)
}

function wholeSentence(text) {
  const sentence = PrerenderPages.firstSentence(text)
  return isWholeSentence(sentence) ? sentence : ''
}

function storySentence(story) {
  return (
    wholeSentence(story.bodyMarkdown || '') ||
    wholeSentence(story.summary || '') ||
    wholeSentence(PrerenderPages.finishedSummary(story.summary || ''))
  )
}

function localImage(root, url) {
  if (!url || String(url).includes('..')) return null
  if (/^https?:\/\//i.test(url)) {
    return { url, type: mime(url), length: null }
  }
  const rel = String(url).replace(/^\//, '')
  const file = path.join(root, 'public', rel)
  if (!fs.existsSync(file)) return null
  const length = fs.statSync(file).size
  if (!length) return null
  const abs = `${SITE}${url.startsWith('/') ? url : `/${url}`}`
  return { url: abs, type: mime(url), length }
}

function storyImage(root, photo) {
  return localImage(root, photo?.image_url)
}

function routeImage(root, route) {
  const image = localImage(root, route?.files?.fullPng)
  if (!image || image.type !== 'image/png' || !Number.isInteger(image.length)) return null
  return image
}

function byNewest(a, b) {
  return b.added.localeCompare(a.added) || a.slug.localeCompare(b.slug)
}

function assertRouteItems(items) {
  const bySlug = new Map(items.map((item) => [item.slug, item]))
  for (const route of ROUTE_MAPS) {
    const item = bySlug.get(route.slug)
    const sentence = clean(route.sentence)
    const imageUrl = `${SITE}${route.files.fullPng}`
    if (!item) throw new Error(`rss: route story ${route.slug} is missing from the feed`)
    if (!isWholeSentence(sentence) || item.description !== sentence) {
      throw new Error(`rss: route story ${route.slug} description is not the route-map sentence`)
    }
    if (item.link !== `${SITE}/stories/${route.slug}/`) {
      throw new Error(`rss: route story ${route.slug} link is not the story page`)
    }
    if (item.image?.url !== imageUrl || item.image?.type !== 'image/png' || !Number.isInteger(item.image?.length)) {
      throw new Error(`rss: route story ${route.slug} image is not the route-map PNG`)
    }
  }
}

/** On-site story permalink only. Fragments and third-party sites are not stable item URLs. */
export function directStableUrl(props, slugs) {
  if (!props || typeof props !== 'object') return null
  if (props.slug && slugs.has(props.slug)) return `${SITE}/stories/${props.slug}/`
  if (props.storySlug && slugs.has(props.storySlug)) return `${SITE}/stories/${props.storySlug}/`
  for (const key of URL_KEYS) {
    const value = props[key]
    if (typeof value !== 'string' || !value || value.includes('#')) continue
    const match = value.match(/^(?:https:\/\/kyhistorydrive\.com)?(\/stories\/([a-z0-9-]+)\/)$/)
    if (match && slugs.has(match[2])) return `${SITE}${match[1]}`
  }
  return null
}

function itemXml(item) {
  const lines = [
    '    <item>',
    `      <title>${esc(item.title)}</title>`,
    `      <link>${esc(item.link)}</link>`,
    `      <guid isPermaLink="true">${esc(item.link)}</guid>`,
    `      <pubDate>${esc(item.pubDate)}</pubDate>`,
    `      <description>${esc(item.description)}</description>`,
  ]
  if (item.image?.url) {
    const url = escAttr(item.image.url)
    const type = escAttr(item.image.type)
    if (Number.isInteger(item.image.length) && item.image.length > 0) {
      lines.push(`      <enclosure url="${url}" length="${item.image.length}" type="${type}"/>`)
    }
    lines.push(`      <media:content url="${url}" medium="image" type="${type}"/>`)
  }
  lines.push('    </item>')
  return lines.join('\n')
}

function renderFeed({ title, link, self, description, items }) {
  const last = items[0]?.pubDate || new Date().toUTCString()
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${esc(title)}</title>
    <link>${esc(link)}</link>
    <description>${esc(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${esc(last)}</lastBuildDate>
    <atom:link href="${escAttr(self)}" rel="self" type="application/rss+xml"/>
${items.map(itemXml).join('\n')}
  </channel>
</rss>
`
}

export function planStoryItems(root) {
  const stories = PrerenderPages.loadStories(root)
  const dates = PrerenderPages.gitFileDates(root)
  const ranked = []
  const dropped = []
  for (const story of stories) {
    const file = `public/content/stories/${story.slug}.json`
    const route = routeBySlug(story.slug)
    const added = dates.created.get(file) || PrerenderPages.isoDate(story.publishedDate) || ''
    const routeSentence = route ? clean(route.sentence) : ''
    const description = isWholeSentence(routeSentence) ? routeSentence : storySentence(story)
    if (!added || !description || !clean(story.title)) {
      dropped.push(story.slug)
      continue
    }
    ranked.push({
      slug: story.slug,
      title: clean(story.title),
      link: `${SITE}/stories/${story.slug}/`,
      description,
      added,
      pubDate: rfc822(added),
      image: route ? routeImage(root, route) : storyImage(root, story.photo),
      route: Boolean(route),
    })
  }
  ranked.sort(byNewest)
  const newest = ranked.slice(0, FEED_ITEM_LIMIT)
  const included = new Set(newest.map((item) => item.slug))
  const pinned = ranked.filter((item) => item.route && !included.has(item.slug))
  const items = newest.concat(pinned).sort(byNewest)
  assertRouteItems(items)
  return {
    items,
    eligible: ranked.length,
    dropped,
    slugs: new Set(stories.map((story) => story.slug)),
  }
}

function historyJoin(root) {
  const locations = PrerenderPages.readJson(path.join(root, 'public/content/stories-locations.json')).locations || {}
  const byHistory = new Map()
  for (const [slug, loc] of Object.entries(locations)) {
    const hid = loc?.historyId
    if (!hid) continue
    if (!byHistory.has(hid)) byHistory.set(hid, [])
    byHistory.get(hid).push(slug)
  }
  return byHistory
}

function layerAdded(root, spec, props) {
  const stamped = PrerenderPages.isoDate(props.source_date)
  if (stamped) return stamped
  const dates = PrerenderPages.gitFileDates(root)
  return dates.created.get(spec.dataFile) || dates.lastmod.get(spec.dataFile) || ''
}

export function planLayer(root, spec, slugs, byHistory) {
  const file = path.join(root, spec.dataFile)
  if (!fs.existsSync(file)) {
    return { ...spec, skip: `no data file ${spec.dataFile}`, items: [] }
  }
  const features = PrerenderPages.readJson(file).features || []
  if (!features.length) return { ...spec, skip: 'layer has no items', items: [] }
  const stats = { direct: 0, oneStory: 0, ambiguous: 0, none: 0 }
  const rows = []
  for (const feature of features) {
    const props = feature.properties || {}
    const direct = directStableUrl(props, slugs)
    if (direct) {
      stats.direct += 1
      rows.push({ props, url: direct })
      continue
    }
    if (spec.join === 'history' && props.id) {
      const matches = (byHistory.get(props.id) || []).filter((slug) => slugs.has(slug))
      if (matches.length === 1) {
        stats.oneStory += 1
        rows.push({ props, url: `${SITE}/stories/${matches[0]}/` })
        continue
      }
      if (matches.length > 1) {
        stats.ambiguous += 1
        continue
      }
    }
    stats.none += 1
  }
  const stable = stats.direct + stats.oneStory
  if (stable !== features.length) {
    return {
      ...spec,
      skip:
        `${features.length} items, ${stable} with a stable on-site URL ` +
        `(${stats.direct} direct, ${stats.oneStory} matched one story, ` +
        `${stats.ambiguous} matched more than one story, ${stats.none} had none). ` +
        'A /#map/... fragment or an off-site website is not a stable per-item URL.',
      items: [],
      stats,
    }
  }
  const items = []
  for (const row of rows) {
    const description = wholeSentence(row.props.description || row.props.history || '')
    const title = clean(row.props.title || row.props.name || '')
    const added = layerAdded(root, spec, row.props)
    if (!title || !description || !added) continue
    items.push({
      title,
      link: row.url,
      description,
      added,
      pubDate: rfc822(added),
      image: storyImage(root, row.props.photo),
    })
  }
  items.sort((a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title) || a.link.localeCompare(b.link))
  const capped = items.slice(0, FEED_ITEM_LIMIT)
  if (!capped.length) return { ...spec, skip: 'no items with a title, sentence, and date', items: [] }
  return { ...spec, skip: '', items: capped, stats }
}

export function planFeeds(root) {
  const stories = planStoryItems(root)
  if (!stories.items.length) throw new Error('rss: no stories to publish')
  const byHistory = historyJoin(root)
  const layers = LAYER_SPECS.map((spec) => planLayer(root, spec, stories.slugs, byHistory))
  const description = 'New Kentucky history stories on Kentucky History Drive, newest first.'
  return {
    stories: {
      ...stories,
      xml: renderFeed({
        title: 'Kentucky History Drive',
        link: `${SITE}/`,
        self: STORY_FEED_URL,
        description,
        items: stories.items,
      }),
    },
    layers: layers.map((layer) => ({
      ...layer,
      xml: layer.skip
        ? ''
        : renderFeed({
            title: layer.title,
            link: layer.channelLink,
            self: layer.self,
            description: layer.description,
            items: layer.items,
          }),
    })),
  }
}

function feedFile(dist, urlPath) {
  return path.join(dist, urlPath.replace(/^\//, ''))
}

function syncRobots(dist, plan) {
  const file = path.join(dist, 'robots.txt')
  if (!fs.existsSync(file)) throw new Error('rss: dist/robots.txt is missing (vite build copies public/robots.txt)')
  let text = fs.readFileSync(file, 'utf8')
  if (!text.includes('Allow: /feed.xml')) {
    text = text.replaceAll('Allow: /\n', 'Allow: /\nAllow: /feed.xml\n')
  }
  for (const layer of plan.layers) {
    const line = `Allow: ${layer.outPath}`
    if (layer.skip) text = text.replaceAll(`${line}\n`, '')
    else if (!text.includes(line)) text = text.replaceAll('Allow: /feed.xml\n', `Allow: /feed.xml\n${line}\n`)
  }
  if (!text.endsWith('\n')) text += '\n'
  fs.writeFileSync(file, text)
}

export function buildFeeds(root, dist) {
  const plan = planFeeds(root)
  fs.mkdirSync(dist, { recursive: true })
  fs.writeFileSync(path.join(dist, 'feed.xml'), plan.stories.xml)
  for (const layer of plan.layers) {
    const file = feedFile(dist, layer.outPath)
    if (layer.skip) {
      if (fs.existsSync(file)) fs.unlinkSync(file)
      continue
    }
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, layer.xml)
  }
  syncRobots(dist, plan)
  return plan
}

export function parseXml(input) {
  const xml = String(input).replace(/^\uFEFF/, '')
  let i = 0
  const len = xml.length
  const eof = () => i >= len
  const starts = (s) => xml.startsWith(s, i)
  const skipWs = () => {
    while (i < len && /\s/.test(xml[i])) i += 1
  }
  const fail = (msg) => {
    throw new Error(`xml: ${msg} at ${i}`)
  }
  function parseName() {
    const m = NAME.exec(xml.slice(i))
    if (!m) fail('expected name')
    i += m[0].length
    return m[0]
  }
  function parseEntity() {
    if (xml[i] !== '&') fail('expected entity')
    const semi = xml.indexOf(';', i)
    if (semi < 0 || semi - i > 16) fail('bad entity')
    const body = xml.slice(i + 1, semi)
    i = semi + 1
    if (body === 'amp') return '&'
    if (body === 'lt') return '<'
    if (body === 'gt') return '>'
    if (body === 'quot') return '"'
    if (body === 'apos') return "'"
    if (/^#x[0-9a-f]+$/i.test(body)) return String.fromCodePoint(parseInt(body.slice(2), 16))
    if (/^#\d+$/.test(body)) return String.fromCodePoint(parseInt(body.slice(1), 10))
    fail(`unknown entity &${body};`)
    return ''
  }
  function parseAttrValue() {
    const q = xml[i]
    if (q !== '"' && q !== "'") fail('unquoted attribute')
    i += 1
    let out = ''
    while (i < len && xml[i] !== q) {
      if (xml[i] === '<') fail('< in attribute')
      if (xml[i] === '&') out += parseEntity()
      else out += xml[i++]
    }
    if (xml[i] !== q) fail('unclosed attribute')
    i += 1
    return out
  }
  function skipMisc() {
    skipWs()
    while (!eof()) {
      if (starts('<?')) {
        const end = xml.indexOf('?>', i)
        if (end < 0) fail('unclosed processing instruction')
        i = end + 2
      } else if (starts('<!--')) {
        const end = xml.indexOf('-->', i + 4)
        if (end < 0) fail('unclosed comment')
        if (xml.slice(i + 4, end).includes('--')) fail('double hyphen in comment')
        i = end + 3
      } else if (starts('<!')) fail('dtd is not accepted')
      else break
      skipWs()
    }
  }
  function parseElement() {
    if (xml[i] !== '<') fail('expected <')
    i += 1
    if (xml[i] === '/' || xml[i] === '!' || xml[i] === '?') fail('bad element')
    const name = parseName()
    const attrs = Object.create(null)
    while (true) {
      skipWs()
      if (starts('/>')) {
        i += 2
        return { name, attrs, children: [] }
      }
      if (xml[i] === '>') {
        i += 1
        break
      }
      const an = parseName()
      skipWs()
      if (xml[i] !== '=') fail(`expected = after ${an}`)
      i += 1
      skipWs()
      if (an in attrs) fail(`duplicate attribute ${an}`)
      attrs[an] = parseAttrValue()
    }
    const children = []
    let text = ''
    const flush = () => {
      if (text) children.push(text)
      text = ''
    }
    while (!eof()) {
      if (starts('</')) {
        flush()
        i += 2
        const close = parseName()
        skipWs()
        if (xml[i] !== '>') fail('unclosed end tag')
        i += 1
        if (close !== name) fail(`${name} closed by ${close}`)
        return { name, attrs, children }
      }
      if (starts('<![CDATA[')) {
        const end = xml.indexOf(']]>', i + 9)
        if (end < 0) fail('unclosed cdata')
        text += xml.slice(i + 9, end)
        i = end + 3
        continue
      }
      if (starts('<!--')) {
        const end = xml.indexOf('-->', i + 4)
        if (end < 0) fail('unclosed comment')
        i = end + 3
        continue
      }
      if (xml[i] === '<') {
        flush()
        children.push(parseElement())
        continue
      }
      if (xml[i] === '&') text += parseEntity()
      else text += xml[i++]
    }
    fail(`unclosed ${name}`)
    return { name, attrs, children }
  }
  skipMisc()
  if (eof() || xml[i] !== '<') fail('missing root')
  const root = parseElement()
  skipMisc()
  if (!eof()) fail('trailing content')
  return root
}

function elements(el, name) {
  return el.children.filter((child) => child && typeof child === 'object' && child.name === name)
}

function textOf(el) {
  return el.children
    .filter((child) => typeof child === 'string')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function oneText(el, name, where) {
  const kids = elements(el, name)
  if (kids.length !== 1) throw new Error(`rss: ${where} must have one <${name}>`)
  const text = textOf(kids[0])
  if (!text) throw new Error(`rss: ${where} <${name}> is empty`)
  return text
}

function assertFeed(xml, expected, { title, link, self }) {
  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    throw new Error('rss: missing XML declaration')
  }
  const root = parseXml(xml)
  if (root.name !== 'rss' || root.attrs.version !== '2.0') throw new Error('rss: root must be <rss version="2.0">')
  if (expected.some((item) => item.image) && root.attrs['xmlns:media'] !== 'http://search.yahoo.com/mrss/') {
    throw new Error('rss: media namespace is missing')
  }
  const channels = elements(root, 'channel')
  if (channels.length !== 1) throw new Error('rss: expected one channel')
  const channel = channels[0]
  if (oneText(channel, 'title', 'channel') !== title) throw new Error('rss: channel title mismatch')
  if (oneText(channel, 'link', 'channel') !== link) throw new Error('rss: channel link mismatch')
  const channelDescription = oneText(channel, 'description', 'channel')
  if (!isWholeSentence(channelDescription) && channelDescription.length < 8) {
    throw new Error('rss: channel description is empty')
  }
  const selfLink = elements(channel, 'atom:link')
  if (selfLink.length !== 1 || selfLink[0].attrs.href !== self) throw new Error('rss: atom:link self mismatch')
  const items = elements(channel, 'item')
  if (items.length !== expected.length) {
    throw new Error(`rss: expected ${expected.length} items, found ${items.length}`)
  }
  let prevTime = Infinity
  items.forEach((item, index) => {
    const want = expected[index]
    const where = `item ${index + 1}`
    const gotTitle = oneText(item, 'title', where)
    const gotLink = oneText(item, 'link', where)
    const gotDescription = oneText(item, 'description', where)
    const gotDate = oneText(item, 'pubDate', where)
    const guid = elements(item, 'guid')
    if (guid.length !== 1 || textOf(guid[0]) !== gotLink || guid[0].attrs.isPermaLink !== 'true') {
      throw new Error(`rss: ${where} guid must be the permalink`)
    }
    if (gotTitle !== want.title) throw new Error(`rss: ${where} title mismatch`)
    if (gotLink !== want.link) throw new Error(`rss: ${where} link mismatch`)
    if (!isWholeSentence(gotDescription)) throw new Error(`rss: ${where} description is not a whole sentence`)
    if (gotDescription !== want.description) throw new Error(`rss: ${where} description mismatch`)
    if (gotDate !== want.pubDate) throw new Error(`rss: ${where} pubDate mismatch`)
    const time = Date.parse(gotDate)
    if (!Number.isFinite(time)) throw new Error(`rss: ${where} pubDate is not a date`)
    if (time > prevTime) throw new Error(`rss: ${where} is newer than the previous item`)
    prevTime = time
    const enclosure = elements(item, 'enclosure')
    const media = elements(item, 'media:content')
    if (!want.image) {
      if (enclosure.length || media.length) throw new Error(`rss: ${where} has an image the story does not`)
      return
    }
    if (!enclosure.length && !media.length) throw new Error(`rss: ${where} is missing enclosure or media:content`)
    if (media.length) {
      if (media[0].attrs.url !== want.image.url) throw new Error(`rss: ${where} media:content url mismatch`)
      if (media[0].attrs.medium !== 'image') throw new Error(`rss: ${where} media:content medium mismatch`)
      if (!media[0].attrs.type) throw new Error(`rss: ${where} media:content type is missing`)
    }
    if (Number.isInteger(want.image.length)) {
      if (enclosure.length !== 1) throw new Error(`rss: ${where} enclosure is missing`)
      if (enclosure[0].attrs.url !== want.image.url) throw new Error(`rss: ${where} enclosure url mismatch`)
      if (enclosure[0].attrs.type !== want.image.type) throw new Error(`rss: ${where} enclosure type mismatch`)
      if (Number(enclosure[0].attrs.length) !== want.image.length) throw new Error(`rss: ${where} enclosure length mismatch`)
    }
  })
}

export function validateStoryXml(xml, items) {
  assertFeed(xml, items, {
    title: 'Kentucky History Drive',
    link: `${SITE}/`,
    self: STORY_FEED_URL,
  })
}

const RSS_LINK = `<link rel="alternate" type="application/rss+xml" title="${STORY_FEED_TITLE}" href="${STORY_FEED_URL}" />`

function validateHtml(dist) {
  const home = path.join(dist, 'index.html')
  if (!fs.existsSync(home)) throw new Error('rss: dist/index.html is missing')
  if (!fs.readFileSync(home, 'utf8').includes(RSS_LINK)) {
    throw new Error('rss: homepage is missing the RSS alternate link')
  }
  const storiesDir = path.join(dist, 'stories')
  if (!fs.existsSync(storiesDir)) throw new Error('rss: dist/stories is missing')
  let pages = 0
  for (const slug of fs.readdirSync(storiesDir)) {
    const file = path.join(storiesDir, slug, 'index.html')
    if (!fs.existsSync(file)) continue
    pages += 1
    if (!fs.readFileSync(file, 'utf8').includes(RSS_LINK)) {
      throw new Error(`rss: /stories/${slug}/ is missing the RSS alternate link`)
    }
  }
  if (!pages) throw new Error('rss: no story pages to check')
}

function validateRobots(dist, plan) {
  const text = fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8')
  if (!text.includes('Allow: /feed.xml')) throw new Error('rss: robots.txt is missing Allow: /feed.xml')
  for (const layer of plan.layers) {
    const line = `Allow: ${layer.outPath}`
    const listed = text.includes(line)
    if (layer.skip && listed) throw new Error(`rss: robots.txt lists skipped ${layer.outPath}`)
    if (!layer.skip && !listed) throw new Error(`rss: robots.txt is missing ${line}`)
  }
}

export function validateDist(root, dist) {
  selfTest()
  const plan = planFeeds(root)
  const storyFile = path.join(dist, 'feed.xml')
  if (!fs.existsSync(storyFile)) throw new Error('rss: dist/feed.xml is missing')
  validateStoryXml(fs.readFileSync(storyFile, 'utf8'), plan.stories.items)
  for (const layer of plan.layers) {
    const file = feedFile(dist, layer.outPath)
    if (layer.skip) {
      if (fs.existsSync(file)) throw new Error(`rss: ${layer.outPath} was written but the layer has no stable per-item URL`)
      continue
    }
    if (!fs.existsSync(file)) throw new Error(`rss: missing ${layer.outPath}`)
    assertFeed(fs.readFileSync(file, 'utf8'), layer.items, {
      title: layer.title,
      link: layer.channelLink,
      self: layer.self,
    })
  }
  validateHtml(dist)
  validateRobots(dist, plan)
  return plan
}

function assertThrows(fn) {
  let threw = false
  try {
    fn()
  } catch (err) {
    if (String(err.message || err) === 'should have thrown') throw err
    threw = true
  }
  if (!threw) throw new Error('rss: self-test expected a throw')
}

export function selfTest() {
  assertThrows(() => parseXml('<rss><channel></channel>'))
  assertThrows(() => parseXml('<rss><channel></rss>'))
  assertThrows(() => parseXml('<rss>A & B</rss>'))
  assertThrows(() => parseXml('<rss><channel></channel></rss><extra/>'))
  const decoded = parseXml(
    '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>A &amp; B</title></channel></rss>',
  )
  const decodedChannel = elements(decoded, 'channel')[0]
  if (textOf(elements(decodedChannel, 'title')[0]) !== 'A & B') {
    throw new Error('rss: self-test failed to decode &amp;')
  }
  const slugs = new Set(['bardstown'])
  if (directStableUrl({ website: 'https://example.com/place' }, slugs) !== null) {
    throw new Error('rss: self-test treated an off-site website as stable')
  }
  if (directStableUrl({ url: 'https://kyhistorydrive.com/#map/history/bardstown' }, slugs) !== null) {
    throw new Error('rss: self-test treated a hash URL as stable')
  }
  if (directStableUrl({ slug: 'bardstown' }, slugs) !== `${SITE}/stories/bardstown/`) {
    throw new Error('rss: self-test missed a story slug')
  }
  const sample = {
    title: 'A & B',
    link: `${SITE}/stories/a-b/`,
    description: 'This is a whole sentence.',
    added: '2026-10-11',
    pubDate: rfc822('2026-10-11'),
    image: { url: `${SITE}/content/photos/a-b.jpg`, type: 'image/jpeg', length: 12 },
  }
  const xml = renderFeed({
    title: 'Kentucky History Drive',
    link: `${SITE}/`,
    self: STORY_FEED_URL,
    description: 'New Kentucky history stories on Kentucky History Drive, newest first.',
    items: [sample],
  })
  validateStoryXml(xml, [sample])
  assertThrows(() => validateStoryXml(xml.replace('<description>This is a whole sentence.</description>', ''), [sample]))
}

function report(plan) {
  const newest = plan.stories.items[0]?.added || 'n/a'
  console.log(
    `rss: ${STORY_FEED_PATH} ${plan.stories.items.length} items (eligible ${plan.stories.eligible}, newest ${newest})`,
  )
  for (const layer of plan.layers) {
    if (layer.skip) console.log(`rss: skip ${layer.outPath} — ${layer.skip}`)
    else console.log(`rss: ${layer.outPath} ${layer.items.length} items`)
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const dist = path.resolve(process.argv[2] || path.join(root, 'dist'))
  try {
    selfTest()
    report(buildFeeds(root, dist))
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
