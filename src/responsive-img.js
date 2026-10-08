/**
 * Homepage photos: prefer the AVIF/WebP variants from
 * public/content/photos/responsive.json (see scripts/optimize-home-images.mjs).
 * The original JPEG stays the <img> fallback so the same photo is shown.
 */

let manifestPromise = null
let images = {}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function loadPhotoVariants() {
  if (!manifestPromise) {
    manifestPromise = fetch('/content/photos/responsive.json')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        images = data?.images || {}
        return images
      })
      .catch(() => {
        images = {}
        return images
      })
  }
  return manifestPromise
}

function sourceTag(type, list, sizes) {
  if (!list?.length) return ''
  const srcset = list.map((v) => `${esc(v.src)} ${Number(v.w)}w`).join(', ')
  return `<source type="${type}" srcset="${srcset}" sizes="${esc(sizes)}" />`
}

/**
 * @param {{ src: string, alt?: string, className?: string, loading?: string, sizes?: string, fetchPriority?: string, width?: number, height?: number }} opts
 */
export function responsivePicture(opts) {
  const src = String(opts.src || '')
  const sizes = opts.sizes || '100vw'
  const meta = images[src]
  const width = opts.width || meta?.width
  const height = opts.height || meta?.height
  const attrs = [
    opts.className ? `class="${esc(opts.className)}"` : '',
    `src="${esc(src)}"`,
    `alt="${esc(opts.alt || '')}"`,
    width ? `width="${Number(width)}"` : '',
    height ? `height="${Number(height)}"` : '',
    opts.loading ? `loading="${esc(opts.loading)}"` : '',
    opts.fetchPriority ? `fetchpriority="${esc(opts.fetchPriority)}"` : '',
    'decoding="async"',
    'referrerpolicy="no-referrer"',
  ]
    .filter(Boolean)
    .join(' ')
  const img = `<img ${attrs} />`
  if (!meta?.avif?.length && !meta?.webp?.length) return img
  return `<picture>${sourceTag('image/avif', meta.avif, sizes)}${sourceTag('image/webp', meta.webp, sizes)}${img}</picture>`
}
