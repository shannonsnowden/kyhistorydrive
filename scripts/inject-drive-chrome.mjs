#!/usr/bin/env node
/**
 * inject-drive-chrome: gives every built /drives/ page (index, each drive, the /drives/build/ planner)
 * the same site header and nav as the static /stories/ pages, from site-chrome.mjs (siteHeaderHtml,
 * sealRotationScriptHtml, siteChromeScriptHtml). Runs after vite build on dist/drives/ because the
 * site stylesheet name is only known then. Idempotent (marker comment).
 *
 * The site stylesheet is imported into a cascade layer, so each drive page's own unlayered CSS still
 * wins for its content; the header then reverts to the site (layer) styles with all: revert-layer,
 * so drive rules such as h1{} or button{} cannot restyle it. Adds the shared favicon links. No analytics is added here.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrerenderPages } from './prerender-pages.mjs'
import { faviconLinksHtml, sealRotationScriptHtml, siteChromeScriptHtml, siteHeaderHtml } from './site-chrome.mjs'

const MARK = '<!-- khd-drive-chrome -->'

// Saved site theme, unless ?theme= asks for one (screenshots, shared links). Same keys as the site toggle.
const THEME_JS = `<script>(function(){try{var q=new URLSearchParams(location.search).get('theme'),s=localStorage.getItem('khd-theme')||localStorage.getItem('khd-home-preview-theme'),t=q==='dark'||q==='light'?q:s==='dark'||s==='light'?s:null;if(t)document.documentElement.setAttribute('data-hp-theme',t)}catch(e){}})()</script>`

const GUARD_CSS = `<style>
.skip-link,header.site-header,header.site-header *{all:revert-layer}
.drive-back{margin:0 0 8px;font-size:14px}
.drive-back a{display:inline-flex;align-items:center;min-height:44px;font-weight:600;text-decoration:none}
.drive-back a:hover{text-decoration:underline}
@media (min-width:701px){.drive-back-phone{display:none}}
</style>`

export function injectDriveChrome(html, { cssHrefs, isIndex, isPlanner }) {
  if (html.includes(MARK)) return html
  if (!/<main>/.test(html)) throw new Error('inject-drive-chrome: page has no <main>')
  const preload = cssHrefs.map((h) => `<link rel="preload" as="style" href="${h}" />`).join('\n')
  const layered = `<style>${cssHrefs.map((h) => `@import url("${h}") layer(site);`).join('')}</style>`
  // Head: seal rotation + saved theme + layered site CSS before the page's own styles; guard after them.
  const firstStyle = html.search(/<style>|<link rel="stylesheet"/)
  if (firstStyle < 0) throw new Error('inject-drive-chrome: page has no stylesheet')
  html = html.slice(0, firstStyle) + `${MARK}\n${faviconLinksHtml()}\n${sealRotationScriptHtml()}\n${THEME_JS}\n${preload}\n${layered}\n` + html.slice(firstStyle)
  html = html.replace('</head>', `${GUARD_CSS}\n</head>`)
  // Drive pages have an "All drives" breadcrumb, so the back link is for phones only; the planner keeps it always.
  const back = isIndex ? '' : `\n  <p class="drive-back${isPlanner ? '' : ' drive-back-phone'}"><a href="/drives/">← Back to all drives</a></p>`
  html = html.replace('<body>', `<body>\n${siteHeaderHtml('drives')}`)
  html = html.replace('<main>', `<main id="content" tabindex="-1">${back}`)
  // End of body: re-apply the saved theme after the page's own theme line, then the shared menu/toggle script.
  const i = html.lastIndexOf('</body>')
  return html.slice(0, i) + `${THEME_JS}\n${siteChromeScriptHtml()}\n` + html.slice(i)
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const dist = path.join(root, 'dist')
  const cssHrefs = PrerenderPages.stylesheetHrefs(dist, fs.readFileSync(path.join(dist, 'index.html'), 'utf8'))
  const dir = path.join(dist, 'drives')
  const files = []
  ;(function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) walk(f)
      else if (e.name === 'index.html') files.push(f)
    }
  })(dir)
  for (const f of files) {
    const rel = path.relative(dir, f)
    const isIndex = rel === 'index.html'
    const isPlanner = rel === path.join('build', 'index.html')
    fs.writeFileSync(f, injectDriveChrome(fs.readFileSync(f, 'utf8'), { cssHrefs, isIndex, isPlanner }))
  }
  console.log(`inject-drive-chrome: site header on ${files.length} /drives/ pages`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
