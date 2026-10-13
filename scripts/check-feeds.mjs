#!/usr/bin/env node
/**
 * Fails the build when dist RSS is missing, not well-formed, or short a
 * required channel or item field. Also checks the homepage, story pages,
 * and robots.txt against the feeds this build actually published.
 *
 * The escape fixture is a story title (and its URL) containing XML specials.
 * The live-story checks use the same filter prerender uses for public pages.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrerenderPages } from './prerender-pages.mjs'
import { assertEscapedXml, renderFeed, validateDist } from './rss-feed.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.resolve(process.argv[2] || path.join(root, 'dist'))

function fail(message) {
  throw new Error(message)
}

function checkEscapeFixture() {
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/rss-escape-title.json'), 'utf8'))
  if (!fixture.title.includes('&') || !fixture.title.includes('<')) {
    fail('check-feeds: escape fixture title must contain & and <')
  }
  const xml = renderFeed({
    title: 'Kentucky History Drive',
    link: 'https://kyhistorydrive.com/',
    self: 'https://kyhistorydrive.com/feed.xml',
    description: 'New Kentucky history stories on Kentucky History Drive, newest first.',
    items: [
      {
        title: fixture.title,
        link: fixture.link,
        description: fixture.description,
        pubDate: fixture.pubDate,
        image: { url: fixture.imageUrl, type: 'image/jpeg', length: 12 },
      },
    ],
  })
  const expected = {
    title: 'Smith &amp; Jones &lt;hidden&gt; &quot;draft&quot; &apos;note&apos;',
    link: 'https://kyhistorydrive.com/stories/smith-and-jones/?q=1&amp;draft=true',
    description: 'Smith &amp; Jones kept the &lt;hidden&gt; &quot;draft&quot; &apos;note&apos; off the site.',
    image: 'https://kyhistorydrive.com/content/photos/smith&amp;jones.jpg',
  }
  if (!xml.includes(`<title>${expected.title}</title>`)) fail('check-feeds: title was not XML-escaped')
  if (!xml.includes(`<link>${expected.link}</link>`)) fail('check-feeds: story URL was not XML-escaped')
  if (!xml.includes(`<guid isPermaLink="true">${expected.link}</guid>`)) fail('check-feeds: guid URL was not XML-escaped')
  if (!xml.includes(`<description>${expected.description}</description>`)) fail('check-feeds: description was not XML-escaped')
  if (!xml.includes(`url="${expected.image}"`)) fail('check-feeds: image URL was not XML-escaped')
  if (xml.includes(fixture.title) || xml.includes('<hidden>') || xml.includes('q=1&draft')) {
    fail('check-feeds: raw title or URL leaked into the feed')
  }
  assertEscapedXml(xml)
  let leaked = false
  try {
    assertEscapedXml('<rss><channel><title>Smith & Jones</title></channel></rss>')
  } catch {
    leaked = true
  }
  if (!leaked) fail('check-feeds: unescaped & was accepted')
  let tagged = false
  try {
    assertEscapedXml('<rss><channel><title>Smith <hidden> note</title></channel></rss>')
  } catch {
    tagged = true
  }
  if (!tagged) fail('check-feeds: unescaped < was accepted')
}

function checkLiveStories() {
  const today = '2026-10-11'
  const live = { slug: 'live-story', title: 'Live', publishedDate: today }
  if (!PrerenderPages.isLiveStory(live, today)) fail('check-feeds: a story published today was withheld')
  const withheld = [
    { ...live, publishedDate: '2026-10-12' },
    { ...live, draft: true },
    { ...live, hidden: true },
    { ...live, status: 'draft' },
    { ...live, status: 'hidden' },
    { slug: 'undated-story', title: 'Undated' },
  ]
  for (const story of withheld) {
    if (PrerenderPages.isLiveStory(story, today)) {
      fail(`check-feeds: unpublished story was treated as live (${story.slug} ${story.publishedDate || 'no date'})`)
    }
  }
  const kept = PrerenderPages.liveStories([live, ...withheld], today)
  if (kept.length !== 1 || kept[0].slug !== 'live-story') {
    fail('check-feeds: liveStories did not use the prerender filter')
  }
}

try {
  checkEscapeFixture()
  checkLiveStories()
  const plan = validateDist(root, dist)
  const skipped = plan.layers.filter((layer) => layer.skip).map((layer) => layer.outPath)
  const held = plan.stories.unpublished?.length || 0
  console.log(
    `check-feeds: /feed.xml ok (${plan.stories.items.length} items` +
      `${held ? `, withheld ${held} unpublished` : ', no drafts, hidden, or future-dated stories'}` +
      ')' +
      (skipped.length ? `; skipped ${skipped.join(', ')}` : ''),
  )
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
}
