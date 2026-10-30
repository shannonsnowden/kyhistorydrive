/**
 * Optional photo for each /drives/ card and drive page.
 * Data: scripts/drive-photos.json — image, credit, alt.
 * An empty image uses the green panel fallback (public/brand/drive-card-fallback.svg).
 * The drive name is drawn in cream over that panel. The theme icon stays only
 * when a card has neither a photo nor the fallback.
 * image must be a file under public/content/photos/. This module never invents a photo.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://kyhistorydrive.com'
const PHOTO_PATH = /^\/content\/photos\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/
const FIELDS = ['image', 'credit', 'alt']

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c]))

function stripMarked(html, name) {
  return html.replace(new RegExp(`<!-- ${name} -->[\\s\\S]*?<!-- /${name} -->\\n?`, 'g'), '')
}

export function imageType(url) {
  const p = String(url || '').split('?')[0].toLowerCase()
  if (p.endsWith('.png')) return 'image/png'
  if (p.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

/** null when the slot has no image (green panel fallback). Throws on a bad filled slot. */
export function normalizeDrivePhoto(slug, row, { root = ROOT, checkFile = true } = {}) {
  if (row == null) return null
  if (typeof row !== 'object' || Array.isArray(row)) throw new Error(`drive-photos: ${slug} must be an object`)
  const extra = Object.keys(row).filter((k) => !FIELDS.includes(k))
  if (extra.length) throw new Error(`drive-photos: ${slug} has ${extra.join(', ')}; use image, credit, and alt`)
  const image = String(row.image ?? '').trim()
  const credit = String(row.credit ?? '').trim()
  const alt = String(row.alt ?? '').trim()
  if (!image) return null
  if (!PHOTO_PATH.test(image) || image.includes('..') || image.includes('//')) {
    throw new Error(`drive-photos: ${slug} image must be a file under /content/photos/: ${image}`)
  }
  if (!alt) throw new Error(`drive-photos: ${slug} image needs alt`)
  if (/[<>]/.test(alt) || /[<>]/.test(credit)) throw new Error(`drive-photos: ${slug} alt and credit are plain text`)
  if (checkFile && !fs.existsSync(path.join(root, 'public', image.replace(/^\//, '')))) {
    throw new Error(`drive-photos: ${slug} image is not in public/: ${image}`)
  }
  return { image, credit, alt }
}

/** Map of drive slug -> photo or null. Keys match scripts/drive-theme-icons.json drives. */
export function loadDrivePhotos({ root = ROOT, checkFile = true } = {}) {
  const file = path.join(root, 'scripts/drive-photos.json')
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  const themes = JSON.parse(fs.readFileSync(path.join(root, 'scripts/drive-theme-icons.json'), 'utf8'))
  const rows = doc.drives
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) throw new Error('drive-photos: drives object missing')
  const expected = Object.keys(themes.drives).sort()
  const got = Object.keys(rows).sort()
  if (got.join('\n') !== expected.join('\n')) {
    throw new Error(`drive-photos: drives must match drive-theme-icons.json (${got.length} vs ${expected.length})`)
  }
  const out = new Map()
  for (const slug of expected) out.set(slug, normalizeDrivePhoto(slug, rows[slug], { root, checkFile }))
  return out
}

export function touristTripImage(photo, site = SITE) {
  if (!photo?.image) return {}
  return { image: `${site}${photo.image}` }
}

const CARD_CSS = `.dcard-photo{margin:-14px -16px 10px;border-radius:13px 13px 0 0;overflow:hidden;background:var(--parch)}
.dcard-photo img{display:block;width:100%;height:168px;object-fit:cover}
.dcard-photo figcaption{margin:0;padding:6px 16px 0;font-size:12px;line-height:1.35;color:var(--muted)}`
const FALLBACK_CSS = `.dcard-fallback{background:#1a241c}
.dcard-fallback picture{display:block}
.dcard-fallback-art{position:relative;display:block;background:#1a241c}
.dcard-fallback img{background:#1a241c;object-position:center 38%}
.dcard-fallback-name{position:absolute;left:0;right:0;bottom:0;margin:0;padding:10px 14px 12px;background:#1a241c;color:#fffdf6;text-align:center;font-family:Georgia,"Times New Roman",serif;font-size:18px;line-height:1.25}
.dcard-fallback figcaption{color:#e8d5a8;background:#1a241c}`
const PAGE_CSS = `.drive-photo{margin:14px 0 8px}
.drive-photo img{display:block;width:100%;height:auto;border-radius:14px;border:1px solid var(--line);background:var(--parch)}
.drive-photo figcaption{margin:6px 0 0;font-size:13px;line-height:1.4;color:var(--muted)}`

function cardFigure(photo) {
  const cap = photo.credit ? `<figcaption>${esc(photo.credit)}</figcaption>` : ''
  return `<!-- khd-drive-photo --><figure class="dcard-photo"><img src="${esc(photo.image)}" alt="${esc(photo.alt)}" decoding="async" loading="lazy">${cap}</figure><!-- /khd-drive-photo -->`
}

/** Green panel for a card with no photo. `nameHtml` is the card's existing h3 inner HTML. */
function fallbackFigure(nameHtml) {
  return `<!-- khd-drive-photo --><figure class="dcard-photo dcard-fallback"><span class="dcard-fallback-art"><picture><source type="image/svg+xml" srcset="/brand/drive-card-fallback.svg" /><img src="/brand/drive-card-fallback-640x360.png" srcset="/brand/drive-card-fallback-640x360.png 640w, /brand/drive-card-fallback-1280x720.png 1280w" sizes="(min-width: 900px) 340px, 92vw" alt="" width="640" height="360" decoding="async" loading="lazy"></picture><span class="dcard-fallback-name">${nameHtml}</span></span><figcaption>AI illustration · Kentucky History Drive</figcaption></figure><!-- /khd-drive-photo -->`
}

function pageFigure(photo) {
  const cap = photo.credit ? `<figcaption>${esc(photo.credit)}</figcaption>` : ''
  return `<!-- khd-drive-photo -->\n  <figure class="drive-photo"><img src="${esc(photo.image)}" alt="${esc(photo.alt)}" decoding="async">${cap}</figure>\n<!-- /khd-drive-photo -->\n`
}

function ogBlock(photo, site = SITE) {
  const url = `${site}${photo.image}`
  const alt = esc(photo.alt)
  const u = esc(url)
  return `<!-- khd-drive-og -->
<meta property="og:image" content="${u}" />
<meta property="og:image:secure_url" content="${u}" />
<meta property="og:image:type" content="${imageType(photo.image)}" />
<meta property="og:image:alt" content="${alt}" />
<meta name="twitter:image" content="${u}" />
<meta name="twitter:image:alt" content="${alt}" />
<!-- /khd-drive-og -->\n`
}

function styleBlock(css) {
  return `<!-- khd-drive-photo-style -->\n<style id="khd-drive-photo">${css}</style>\n<!-- /khd-drive-photo-style -->\n`
}

function stripPhoto(html) {
  return stripMarked(stripMarked(stripMarked(html, 'khd-drive-photo-style'), 'khd-drive-og'), 'khd-drive-photo')
}

/** Listing cards. A missing image gets the green panel and the drive name in cream. */
export function applyDriveIndexPhotos(html, photos) {
  let out = stripPhoto(html)
  let any = false
  let usedFallback = false
  for (const [slug, photo] of photos) {
    const needle = `<a href="/drives/${slug}/">`
    const parts = out.split(needle)
    if (parts.length !== 2) {
      if (!photo) continue
      throw new Error(`drive-photos: expected one /drives/ card for ${slug}, found ${parts.length - 1}`)
    }
    const figure = photo
      ? cardFigure(photo)
      : fallbackFigure((parts[1].match(/<h3>([^<]*)<\/h3>/) || [])[1] || esc(slug))
    if (!photo) usedFallback = true
    out = parts[0] + needle + figure + parts[1]
    any = true
  }
  if (any) {
    if (!out.includes('</head>')) throw new Error('drive-photos: /drives/ index has no </head>')
    const css = usedFallback ? `${CARD_CSS}\n${FALLBACK_CSS}` : CARD_CSS
    out = out.replace('</head>', `${styleBlock(css)}</head>`)
  }
  return out
}

/** Drive page figure under the intro, plus og:image when a photo is set. */
export function applyDrivePagePhoto(html, photo, site = SITE) {
  let out = stripPhoto(html)
  if (!photo) return out
  const intro = /(<\/h1>\s*<p class="muted"[^>]*>[\s\S]*?<\/p>\n)/
  if (!intro.test(out)) throw new Error('drive-photos: drive page has no intro under the h1')
  out = out.replace(intro, `$1${pageFigure(photo)}`)
  if (!out.includes('</head>')) throw new Error('drive-photos: drive page has no </head>')
  out = out.replace('</head>', `${styleBlock(PAGE_CSS)}${ogBlock(photo, site)}</head>`)
  return out
}
