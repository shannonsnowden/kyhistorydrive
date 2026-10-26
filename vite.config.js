import { defineConfig } from 'vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { injectGtagHead, privacyChoicesBootHtml } from './scripts/gtag-snippet.mjs'
import { siteChromeScriptHtml, siteHeaderHtml } from './scripts/site-chrome.mjs'
import { contactLineHtml } from './scripts/contact-reveal.mjs'
import { applyRoadsRailsBlocks, isRoadsRailsPath, roadsRailsEnabled } from './scripts/roads-rails-flag.mjs'

const root = dirname(fileURLToPath(import.meta.url))
// Roads & Rails is off the live site (Oct 19). KHD_ROADS_RAILS=1 builds the page, nav item and #transport forward again.
const roadsRails = roadsRailsEnabled()

/** Chrome only treats a track as captions when the file is served as WebVTT. */
function vttMime() {
  const set = (req, res, next) => {
    const path = (req.url || '').split('?')[0]
    if (path.endsWith('.vtt')) {
      const write = res.setHeader
      res.setHeader = function (name, value) {
        if (String(name).toLowerCase() === 'content-type') {
          return write.call(this, name, 'text/vtt; charset=utf-8')
        }
        return write.call(this, name, value)
      }
    }
    next()
  }
  return {
    name: 'vtt-mime',
    configureServer(server) {
      server.middlewares.use(set)
    },
    configurePreviewServer(server) {
      server.middlewares.use(set)
    },
  }
}

/** `/privacy` rewrites to the page. `/about` redirects to `/about/`, which serves the page. */
function privacyPath() {
  const rewrite = (req, res, next) => {
    const q = req.url?.indexOf('?') ?? -1
    const path = q === -1 ? req.url : req.url.slice(0, q)
    const search = q === -1 ? '' : req.url.slice(q)
    if (path === '/privacy' || path === '/privacy/') req.url = `/privacy/index.html${search}`
    if (path === '/about') {
      res.statusCode = 301
      res.setHeader('Location', `/about/${search}`)
      res.end()
      return
    }
    if (path === '/about/') req.url = `/about/index.html${search}`
    if (path === '/videos') {
      res.statusCode = 301
      res.setHeader('Location', `/videos/${search}`)
      res.end()
      return
    }
    if (path === '/videos/') req.url = `/videos/index.html${search}`
    if (path === '/editorial') {
      res.statusCode = 301
      res.setHeader('Location', `/editorial/${search}`)
      res.end()
      return
    }
    if (path === '/editorial/') req.url = `/editorial/index.html${search}`
    if (path === '/contact') {
      res.statusCode = 301
      res.setHeader('Location', `/contact/${search}`)
      res.end()
      return
    }
    if (path === '/contact/') req.url = `/contact/index.html${search}`
    // Same 301 as amplify.yml while Roads & Rails is off, so dev and preview match the live redirect.
    if (!roadsRails && isRoadsRailsPath(path)) {
      res.statusCode = 301
      res.setHeader('Location', '/')
      res.end()
      return
    }
    next()
  }
  return {
    name: 'privacy-path',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

export default defineConfig({
  base: '/',
  // src/main.js reads this to pick the #transport forward (map, or /roads-and-rails/ with the flag).
  define: { 'import.meta.env.KHD_ROADS_RAILS': JSON.stringify(roadsRails ? '1' : '') },
  plugins: [
    vttMime(),
    privacyPath(),
    {
      name: 'khd-gtag',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          // <!-- khd-roads-rails:on|off --> blocks: keep the one for the KHD_ROADS_RAILS mode.
          html = applyRoadsRailsBlocks(html, roadsRails)
          // <!-- khd-site-header --> or <!-- khd-site-header roads --> (marks that nav item as the current page).
          html = html.replace(/<!-- khd-site-header(?:\s+([a-z]+))? -->/, (_, route) => siteHeaderHtml(route || ''))
          if (html.includes('<!-- khd-site-chrome -->')) {
            html = html.replace('<!-- khd-site-chrome -->', siteChromeScriptHtml())
          }
          if (html.includes('<!-- khd-privacy-choices -->')) {
            html = html.replace('<!-- khd-privacy-choices -->', privacyChoicesBootHtml())
          }
          html = html.replace(/<!-- khd-contact-line\s+([\s\S]*?)\s*-->/g, (_, lead) => contactLineHtml(lead.trim()))
          // Drive planner (/drives/build/) is analytics-free by design: it can use the visitor's location.
          if (html.includes('<!-- khd-no-analytics -->')) return html
          return injectGtagHead(html)
        },
      },
    },
  ],
  build: {
    outDir: 'dist',
    // Published bundles stay unmapped. scripts/check-sourcemaps.mjs fails the build if dist contains a .map file.
    sourcemap: false,
    // public/ is copied into dist, including NOTES.md and other authoring notes.
    // scripts/strip-authoring-notes.mjs removes those after this step.
    // scripts/check-authoring-notes.mjs fails the build if a .md file remains.
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        privacy: resolve(root, 'privacy/index.html'),
        buildDrive: resolve(root, 'drives/build/index.html'),
        ...(roadsRails ? { roadsAndRails: resolve(root, 'roads-and-rails/index.html') } : {}),
      },
    },
  },
})
