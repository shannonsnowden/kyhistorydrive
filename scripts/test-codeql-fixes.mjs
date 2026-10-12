#!/usr/bin/env node
/**
 * Checks for the CodeQL fixes: asset URLs, tag stripping, entity order,
 * comment removal, and poster matching that does not treat a host as a regexp.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ROUTE_MAPS, routeMapThemeScript, safeAssetUrl } from '../src/route-maps.js'
import { PrerenderPages, preloadsPoster } from './prerender-pages.mjs'
import { assertEscapedXml } from './rss-feed.mjs'
import { FILMS } from '../src/films.js'

const routePath = '/maps/routes/example/example-route-map.png'
assert.equal(safeAssetUrl(routePath), routePath)
assert.equal(safeAssetUrl(`https://kyhistorydrive.com${routePath}`), `https://kyhistorydrive.com${routePath}`)
assert.equal(safeAssetUrl(`http://kyhistorydrive.com${routePath}`), `http://kyhistorydrive.com${routePath}`)
assert.equal(safeAssetUrl('javascript:alert(1)'), '')
assert.equal(safeAssetUrl('data:text/html,hi'), '')
assert.equal(safeAssetUrl('//evil.example/x'), '')
assert.equal(safeAssetUrl('https://evil.example/x'), '')
assert.equal(safeAssetUrl(' https://evil.example/x'), '')
assert.equal(safeAssetUrl(''), '')

globalThis.location = { origin: 'http://127.0.0.1:5173' }
assert.equal(safeAssetUrl('http://127.0.0.1:5173/maps/a.png'), 'http://127.0.0.1:5173/maps/a.png')
assert.equal(safeAssetUrl('/maps/a.png'), '/maps/a.png')
delete globalThis.location

for (const route of ROUTE_MAPS) {
  for (const file of Object.values(route.files)) {
    assert.equal(safeAssetUrl(file), file, file)
    assert.equal(/["&<>]/.test(file), false, file)
  }
}

const themeScript = routeMapThemeScript()
assert.ok(themeScript.includes(safeAssetUrl.toString()))
assert.equal(themeScript.split('</script>').length, 2)
assert.equal(themeScript.split("img.getAttribute(mode === 'dark' ? 'data-src-dark' : 'data-src-light')").length, 3)
assert.equal((themeScript.match(/if \(next\) img\.setAttribute\('src', next\)/g) || []).length, 0)

const lightbox = fs.readFileSync(new URL('../public/route-map-lightbox.js', import.meta.url), 'utf8')
assert.match(lightbox, /data-zoom-' \+ mode \+ '-' \+ ext/)
assert.equal(lightbox.includes('img.src = urls'), false)
assert.equal(safeAssetUrl('/maps/routes/example/zoom/example-zoom-light.avif'), '/maps/routes/example/zoom/example-zoom-light.avif')
assert.equal(safeAssetUrl('/brand/story-pins/example-light.svg'), '/brand/story-pins/example-light.svg')

const transcript = PrerenderPages.transcriptFromVtt(`WEBVTT

00:00:01.000 --> 00:00:02.000
<v Mary>Hello &amp; &lt;river&gt;</v>

00:00:03.000 --> 00:00:04.000
&amp;lt;kept&amp;gt;
`)
assert.equal(transcript, '0:01 Hello & <river>\n0:03 &lt;kept&gt;')

assertEscapedXml('<rss><!-- & < " \' --><channel><title>Ok</title></channel></rss>')
assert.throws(() => assertEscapedXml('<rss><channel><title>Smith & Jones</title></channel></rss>'))
assert.throws(() =>
  assertEscapedXml('<rss><!<!---->--><channel><title>Smith & Jones</title></channel></rss>'),
)

const poster = FILMS[0].poster
const tag = `<link rel="preload" as="image" href="${poster}">`
assert.equal(preloadsPoster(tag, poster), true)
assert.equal(preloadsPoster(`<img src="${poster}">`, poster), false)
assert.equal(preloadsPoster(tag.replace('amazonaws.com', 'amazonawsXcom'), poster), false)

console.log('test-codeql-fixes: asset urls, transcripts, comments, and poster matching ok')
