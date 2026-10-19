/**
 * Roads & Rails switch (Shannon, Oct 19): the page was taken off the live site but kept in the repo.
 * Build with KHD_ROADS_RAILS=1 to bring back the /roads-and-rails/ page, its nav item, the #transport
 * forward, the inline story links, the sitemap entry and the transport build checks. The default build
 * leaves all of that out and serves a redirect stub to the map instead.
 * To relaunch, also drop the Roads & Rails 301 block from amplify.yml (it applies whatever the flag says).
 * The full pre-removal tree is on branch preserve/roads-and-rails and tag roads-and-rails-2026-10-19.
 */
export const ROADS_RAILS_FLAG = 'KHD_ROADS_RAILS'

/** Where the old URLs go: the map (/). Amplify rules cannot target #map, so the stub adds it. */
export const ROADS_RAILS_REDIRECT_TARGET = '/'

/** Every old URL that gets a 301 in amplify.yml. */
export const ROADS_RAILS_OLD_PATHS = Object.freeze([
  '/roads-and-rails',
  '/roads-and-rails/',
  '/roads-and-rails/index.html',
  '/roads-rails',
  '/roads-rails/',
  '/roads-rails/index.html',
])

/** Directories that get the static redirect stub when the flag is off. */
export const ROADS_RAILS_STUB_DIRS = Object.freeze(['/roads-and-rails/', '/roads-rails/'])

export function roadsRailsEnabled(env = process.env) {
  return String(env?.[ROADS_RAILS_FLAG] ?? '') === '1'
}

/** True for a parsed URL pathname under /roads-and-rails or /roads-rails (exact segment). */
export function isRoadsRailsPath(pathname) {
  const first = String(pathname || '').split('/')[1] || ''
  return first === 'roads-and-rails' || first === 'roads-rails'
}

/**
 * HTML sources mark flag-dependent parts with
 * <!-- khd-roads-rails:on -->...<!-- /khd-roads-rails:on --> and the :off pair.
 * Keeps the block for the current mode and drops the other; the markers never ship.
 */
export function applyRoadsRailsBlocks(html, on) {
  const keep = on ? 'on' : 'off'
  return String(html).replace(/[ \t]*<!-- khd-roads-rails:(on|off) -->([\s\S]*?)<!-- \/khd-roads-rails:\1 -->[ \t]*\r?\n?/g, (_, mode, body) =>
    mode === keep ? body.replace(/^\r?\n/, '') : '',
  )
}

/** Static fallback for the old URLs (amplify.yml rules have been ignored live before). */
export function roadsRailsRedirectHtml(headExtra = '') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${headExtra ? `${headExtra}\n` : ''}<title>Map · Kentucky History Drive</title>
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="https://kyhistorydrive.com/">
<meta http-equiv="refresh" content="0; url=/#map">
<script>location.replace('/#map')</script>
</head>
<body>
<p>This page has moved. Explore Kentucky's history on <a href="/#map">the map</a>.</p>
</body>
</html>
`
}

/**
 * Page-only assets (Security, #330): shipped only with KHD_ROADS_RAILS=1. With the flag off,
 * scripts/prune-roads-rails-assets.mjs removes them from dist right after vite copies public/.
 * Paths are relative to dist/; a trailing slash means the whole directory.
 */
export const ROADS_RAILS_ASSETS = Object.freeze(['maps/transport/', 'brand/og-roads-and-rails.png', 'data/web/transport-links.json'])
