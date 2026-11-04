#!/usr/bin/env node
// Puts each drive's theme icon (existing site icons only) on /drives/ cards that have no photo,
// and adds a legend. A card with class="dcard-photo" (scripts/drive-photos.mjs) keeps the picture.
// Runs after vite build and writes only to dist/ (never the tracked public/ source). Idempotent.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const SAFE_IMG = /^\/icons\/[\w-]+\.png$/

export function applyThemeIcons(html, cfg) {
  let h = html
  h = h.replace(/<span class="ticon"(?: title="[^"]*")?>.*?<span class="vh">[^<]*<\/span><\/span>/g, '').replace(/<!-- theme-legend -->[\s\S]*?<!-- \/theme-legend -->\n?/g, '').replace(/<style id="theme-icons">[\s\S]*?<\/style>\n?/, '')
  const icon = (t, alt = '') => {
    const th = cfg.themes[t]
    if (th.img && !SAFE_IMG.test(th.img)) throw new Error(`unsafe icon path for ${t}`)
    return th.img ? `<img src="${esc(th.img)}" alt="${esc(alt)}" width="22" height="22">` : `<span aria-hidden="true">${esc(th.emoji)}</span>`
  }
  let n = 0
  h = h.replace(/<li class="dcard"><a href="\/drives\/([a-z0-9-]+)\/">/g, (m, slug, offset, whole) => {
    const t = Object.hasOwn(cfg.drives, slug) ? cfg.drives[slug] : null
    if (!t || !Object.hasOwn(cfg.themes, t)) throw new Error(`no theme for ${slug}`)
    const end = whole.indexOf('</a>', offset)
    const inner = end < 0 ? '' : whole.slice(offset, end)
    if (inner.includes('class="dcard-photo"')) return m
    n++
    return `${m}<span class="ticon">${icon(t)}<span class="vh">${esc(cfg.themes[t].label)}</span></span>`
  })
  if (!n) return h
  const used = [...new Set(Object.values(cfg.drives))]
  const legend = `<!-- theme-legend -->\n  <ul class="tlegend" aria-label="Drive theme icons">${used.map((t) => `<li><span class="ticon">${icon(t)}</span>${esc(cfg.themes[t].label)}</li>`).join('')}</ul>\n  <!-- /theme-legend -->\n`
  h = h.replace(/(  <h2>Themed drives<\/h2>)/, `${legend}$1`)
  const css = `<style id="theme-icons">
.ticon{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--green-soft);border:1px solid var(--line);vertical-align:middle;margin-right:8px;font-size:17px;line-height:1}
.ticon img{width:22px;height:22px;object-fit:contain}
.dcard a:has(.tag.amber) .ticon{background:#f3e1c3;border-color:#d9a85b}
/* Dark mode: a light disc behind every icon so black and dark-green art stays legible */
[data-hp-theme=dark] .ticon{background:#f3ead8;border-color:#f3ead8}
[data-hp-theme=dark] .dcard a:has(.tag.amber) .ticon{background:#f3e1c3;border-color:#e8c58a}
.tlegend{list-style:none;display:flex;flex-wrap:wrap;gap:6px 16px;padding:10px 12px;margin:0 0 16px;border:1px solid var(--line);border-radius:12px;background:var(--panel);font-size:13px;color:var(--muted)}
.tlegend li{display:flex;align-items:center}
.tlegend .ticon{width:24px;height:24px;margin-right:6px;font-size:14px}.tlegend .ticon img{width:18px;height:18px}
@media (max-width:480px){.dcard .ticon{width:36px;height:36px;font-size:20px}.dcard .ticon img{width:28px;height:28px}.tlegend .ticon{width:32px;height:32px;font-size:18px}.tlegend .ticon img{width:24px;height:24px}}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
</style>
`
  h = h.replace('</head>', `${css}</head>`)
  return h
}

function main() {
  const cfg = JSON.parse(fs.readFileSync('scripts/drive-theme-icons.json', 'utf8'))
  const F = 'dist/drives/index.html'
  if (!fs.existsSync(F)) throw new Error(`${F} missing: run after vite build`)
  const before = fs.readFileSync(F, 'utf8')
  const h = applyThemeIcons(before, cfg)
  fs.writeFileSync(F, h)
  const n = (h.match(/<li class="dcard">[\s\S]*?<span class="ticon">/g) || []).length
  const legend = h.includes('theme-legend') ? [...new Set(Object.values(cfg.drives))].length : 0
  console.log(`apply-drive-theme-icons: ${n} cards, ${legend} legend entries`)
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) main()
