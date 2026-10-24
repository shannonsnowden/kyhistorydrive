#!/usr/bin/env node
/**
 * Roads & Rails removal (Shannon, Oct 19): source-level checks for the KHD_ROADS_RAILS flag.
 * Off (default): no Roads & Rails nav item in the shared header or index.html, #transport forwards to
 * the map, the vite page input is gone, and amplify.yml 301s every old URL to the map (/). On: the page,
 * nav item and #transport forward come back. URLs are parsed, never matched as substrings.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ROADS_RAILS_FLAG,
  ROADS_RAILS_OLD_PATHS,
  ROADS_RAILS_REDIRECT_TARGET,
  roadsRailsEnabled,
  roadsRailsRedirectHtml,
  applyRoadsRailsBlocks,
  isRoadsRailsPath,
  ROADS_RAILS_ASSETS,
} from './roads-rails-flag.mjs'
import { siteHeaderHtml } from './site-chrome.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://kyhistorydrive.com'

/** Every href in the HTML, resolved against the page URL. */
function links(html, page = `${SITE}/`) {
  const out = []
  for (const m of String(html).matchAll(/<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const raw = (m[1] ?? m[2] ?? '').replace(/&amp;/g, '&')
    try {
      out.push(new URL(raw, page))
    } catch {
      /* not a URL */
    }
  }
  return out
}
const roadsLinks = (html) => links(html).filter((u) => u.host === new URL(SITE).host && isRoadsRailsPath(u.pathname))

// Flag parsing.
assert.equal(ROADS_RAILS_FLAG, 'KHD_ROADS_RAILS')
assert.equal(roadsRailsEnabled({}), false, 'off by default')
assert.equal(roadsRailsEnabled({ KHD_ROADS_RAILS: '0' }), false)
assert.equal(roadsRailsEnabled({ KHD_ROADS_RAILS: '1' }), true)
assert.equal(isRoadsRailsPath('/roads-and-rails/'), true)
assert.equal(isRoadsRailsPath('/roads-rails'), true)
assert.equal(isRoadsRailsPath('/roads-and-rails/index.html'), true)
assert.equal(isRoadsRailsPath('/roads-and-railsx/'), false)
assert.equal(isRoadsRailsPath('/stories/roads-and-rails/'), false)

// Shared header (about, people, stories, layers, drives pages).
assert.equal(roadsLinks(siteHeaderHtml('', { roadsRails: false })).length, 0, 'header (off) has no Roads & Rails link')
assert.ok(!/data-route="roads"/.test(siteHeaderHtml('', { roadsRails: false })), 'header (off) has no roads nav item')
assert.equal(roadsLinks(siteHeaderHtml('roads', { roadsRails: true })).length, 1, 'header (on) has the Roads & Rails link')

// index.html (homepage header, mobile menu, footer, CTAs) after the vite transform.
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const indexOff = applyRoadsRailsBlocks(indexSrc, false)
const indexOn = applyRoadsRailsBlocks(indexSrc, true)
assert.equal(roadsLinks(indexOff).length, 0, 'index.html (off) has no Roads & Rails link')
assert.ok(!/data-route="roads"/.test(indexOff), 'index.html (off) has no roads nav item')
assert.ok(!/khd-roads-rails/.test(indexOff) && !/khd-roads-rails/.test(indexOn), 'flag markers are removed in both modes')
assert.equal(roadsLinks(indexOn).length, 1, 'index.html (on) keeps the Roads & Rails nav link')
// #transport hash forward: off -> the map, on -> /roads-and-rails/.
const forward = (html) => {
  const m = /<script>\(function\(\)\{var t=\/\^#transport[\s\S]*?location\.replace\(([^)]*)\)/.exec(html)
  return m ? m[1] : ''
}
assert.equal(forward(indexOff), "'#map'", 'index.html (off) forwards #transport to #map')
assert.ok(/^'\/roads-and-rails\/'/.test(forward(indexOn)), 'index.html (on) forwards #transport to /roads-and-rails/')
const mainSrc = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8')
assert.ok(/import\.meta\.env\.KHD_ROADS_RAILS === '1'/.test(mainSrc), 'main.js gates the #transport forward on the flag')
assert.ok(/location\.replace\('#map'\)/.test(mainSrc), 'main.js forwards #transport to #map when off')

// Vite inputs, read from the real config in a child process for each flag value.
const inputs = (on) => {
  const env = { ...process.env }
  delete env.KHD_ROADS_RAILS
  if (on) env.KHD_ROADS_RAILS = '1'
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', "const m = await import('./vite.config.js'); const c = typeof m.default === 'function' ? m.default({ command: 'build', mode: 'production' }) : m.default; console.log(JSON.stringify(Object.keys(c.build.rollupOptions.input)))"], { cwd: root, env, encoding: 'utf8' })
  return JSON.parse(out.trim().split('\n').pop())
}
assert.ok(!inputs(false).includes('roadsAndRails'), 'vite (off) does not build roads-and-rails/index.html')
assert.ok(inputs(true).includes('roadsAndRails'), 'vite (on) builds roads-and-rails/index.html')

// amplify.yml: a 301 to the map (/) for every old URL variant.
const amplify = fs.readFileSync(path.join(root, 'amplify.yml'), 'utf8')
const rules = [...amplify.matchAll(/-\s*source:\s*'([^']*)'\s*\n\s*target:\s*'([^']*)'\s*\n\s*status:\s*'(\d+)'/g)].map((m) => ({ source: m[1], target: m[2], status: m[3] }))
assert.equal(ROADS_RAILS_REDIRECT_TARGET, '/')
for (const p of ROADS_RAILS_OLD_PATHS) {
  const hit = rules.filter((r) => r.source === p)
  assert.equal(hit.length, 1, `amplify.yml has exactly one rule for ${p}`)
  assert.equal(hit[0].status, '301', `${p} is a 301`)
  assert.equal(hit[0].target, ROADS_RAILS_REDIRECT_TARGET, `${p} redirects to the map (/)`)
}
for (const want of ['/roads-and-rails', '/roads-and-rails/', '/roads-and-rails/index.html', '/roads-rails', '/roads-rails/', '/roads-rails/index.html']) {
  assert.ok(ROADS_RAILS_OLD_PATHS.includes(want), `redirect list covers ${want}`)
}

// Static fallback stub (amplify.yml rules have been ignored live before).
const stub = roadsRailsRedirectHtml()
assert.ok(/<meta name="robots" content="noindex, follow">/.test(stub), 'stub is noindex')
const canon = /<link rel="canonical" href="([^"]+)">/.exec(stub)
assert.ok(canon && new URL(canon[1]).href === `${SITE}/`, 'stub canonical is the homepage')
const refresh = /<meta http-equiv="refresh" content="0; url=([^"]+)">/.exec(stub)
assert.ok(refresh && new URL(refresh[1], `${SITE}/roads-and-rails/`).href === `${SITE}/#map`, 'stub meta refresh goes to the map')
assert.equal(roadsLinks(stub).length, 0, 'stub links nowhere under /roads-and-rails')

// Page-only assets (Security, #330): pruned right after vite build, and the reader skips the links file.
for (const want of ['maps/transport/', 'brand/og-roads-and-rails.png', 'data/web/transport-links.json']) {
  assert.ok(ROADS_RAILS_ASSETS.includes(want), `asset list covers ${want}`)
}
const build = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts.build.split(' && ')
assert.equal(build[build.indexOf('vite build') + 1], 'node scripts/prune-roads-rails-assets.mjs', 'assets are pruned right after vite build')
assert.ok(build.indexOf('node scripts/check-roads-rails-removed.mjs') < build.indexOf('node scripts/check-protected-coords.mjs'), 'removal check runs before check-protected-coords')
assert.equal(build[build.length - 1], 'node scripts/check-protected-coords.mjs', 'check-protected-coords runs last')
// #338 retired the Timeline reader, the only main.js caller; any future call must stay behind the flag.
assert.ok(!/loadTransportLinks\(\)/.test(mainSrc) || /KHD_ROADS_RAILS === '1' \? await loadTransportLinks\(\)/.test(mainSrc), 'main.js only fetches transport links with the flag')

console.log(`test-roads-rails-flag: ok (${ROADS_RAILS_OLD_PATHS.length} redirect variants; flag ${ROADS_RAILS_FLAG})`)
