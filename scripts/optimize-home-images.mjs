/**
 * Homepage image weight (critique W9).
 *
 * Writes a 176px header logo (shown at 88px), a 384px map-strip seal (2× for
 * a seal at about half the strip height on a 1440px page), and AVIF/WebP
 * variants of the photos referenced by public/content/home-preview.json.
 * Original JPEGs stay where they are, with the same filenames and credits.
 * Each photo variant is kept under 200KB. Sources wider than 1600px are
 * capped; narrower photos are not upscaled.
 *
 * The high-resolution logo master lives in scripts/brand-src/ (not deployed).
 * On the first run it is copied from public/brand/khd-logo.png.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACK_PATH = path.join(ROOT, 'public/content/home-preview.json')
const MANIFEST_PATH = path.join(ROOT, 'public/content/photos/responsive.json')
const LOGO_SRC = path.join(ROOT, 'scripts/brand-src/khd-logo.jpg')
const LOGO_OUT = path.join(ROOT, 'public/brand/khd-logo.png')
const SEAL_SRC = path.join(ROOT, 'public/brand/khd-logo-512.png')
const SEAL_SIDE = 384
const SEAL_AVIF = path.join(ROOT, 'public/brand/khd-map-seal.avif')
const SEAL_WEBP = path.join(ROOT, 'public/brand/khd-map-seal.webp')
const MAX_BYTES = 200 * 1024
const LOGO_MAX_BYTES = 20 * 1024
const SEAL_MAX_BYTES = 40 * 1024

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function collectPhotoUrls(pack) {
  const urls = new Set()
  const add = (item) => {
    const url = item?.photo?.image_url || item?.image_url
    if (typeof url === 'string' && url.startsWith('/content/photos/')) urls.add(url)
  }
  for (const item of pack?.stories || []) add(item)
  for (const item of pack?.features || []) add(item)
  add(pack?.hero)
  return [...urls]
}

async function encodeUnder(file, width, format) {
  let w = width
  const startQ = format === 'avif' ? 50 : 68
  const minQ = format === 'avif' ? 28 : 32
  let best = null
  while (w >= 480) {
    let q = startQ
    while (q >= minQ) {
      const pipeline = sharp(file).rotate().resize({ width: w, withoutEnlargement: true })
      if (format === 'avif') pipeline.avif({ quality: q, effort: 5 })
      else pipeline.webp({ quality: q, effort: 5 })
      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
      best = { data, width: info.width, height: info.height, quality: q }
      if (data.length <= MAX_BYTES) return best
      q -= format === 'avif' ? 4 : 8
    }
    const next = Math.round(w * 0.85)
    if (next === w) break
    w = next
  }
  return best && best.data.length <= MAX_BYTES ? best : null
}

function targetWidths(nativeWidth) {
  const cap = Math.min(nativeWidth, 1600)
  const widths = []
  if (nativeWidth > 860) widths.push(800)
  widths.push(cap)
  return [...new Set(widths)]
}

async function optimizePhoto(url, previous) {
  const rel = url.replace(/^\//, '')
  const abs = path.join(ROOT, 'public', rel)
  if (!fs.existsSync(abs)) {
    console.warn(`missing photo, skipped: ${url}`)
    return null
  }
  const source = fs.readFileSync(abs)
  const hash = sha256(source)
  if (previous?.sha256 === hash && previous.avif?.length) {
    const ok = [...(previous.avif || []), ...(previous.webp || [])].every((v) => {
      const file = path.join(ROOT, 'public', v.src.replace(/^\//, ''))
      return fs.existsSync(file) && fs.statSync(file).size <= MAX_BYTES
    })
    if (ok) {
      console.log(`keep ${url}`)
      return previous
    }
  }
  const meta = await sharp(source).metadata()
  const nativeW = meta.width || 0
  const photoRel = rel.replace(/^content\/photos\//, '')
  const dirRel = path.dirname(photoRel)
  const base = path.basename(photoRel, path.extname(photoRel))
  const outDir = path.join(ROOT, 'public/content/photos/opt', dirRel === '.' ? '' : dirRel)
  fs.mkdirSync(outDir, { recursive: true })
  for (const name of fs.readdirSync(outDir)) {
    if (name.startsWith(`${base}-`) && /\.(avif|webp)$/i.test(name)) fs.unlinkSync(path.join(outDir, name))
  }
  const entry = {
    sha256: hash,
    width: meta.width,
    height: meta.height,
    avif: [],
    webp: [],
  }
  for (const format of ['avif', 'webp']) {
    const seen = new Set()
    for (const want of targetWidths(nativeW)) {
      const encoded = await encodeUnder(abs, want, format)
      if (!encoded || seen.has(encoded.width)) continue
      seen.add(encoded.width)
      const name = `${base}-${encoded.width}.${format}`
      fs.writeFileSync(path.join(outDir, name), encoded.data)
      const src = path.posix.join('/content/photos/opt', dirRel === '.' ? '' : dirRel, name)
      entry[format].push({ src, w: encoded.width })
      console.log(
        `${format} ${src} ${encoded.width}x${encoded.height} q${encoded.quality} ${(encoded.data.length / 1024).toFixed(0)}KB`,
      )
    }
    entry[format].sort((a, b) => a.w - b.w)
  }
  return entry
}

async function optimizeLogo() {
  fs.mkdirSync(path.dirname(LOGO_SRC), { recursive: true })
  if (!fs.existsSync(LOGO_SRC)) {
    if (!fs.existsSync(LOGO_OUT)) throw new Error('missing header logo')
    fs.copyFileSync(LOGO_OUT, LOGO_SRC)
    console.log(`saved logo master to ${path.relative(ROOT, LOGO_SRC)}`)
  }
  const side = 176
  let buf = null
  for (const colors of [160, 128, 96, 64, 48]) {
    buf = await sharp(LOGO_SRC)
      .rotate()
      .resize({ width: side, height: side, fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9, palette: true, colors, quality: 80, effort: 10 })
      .toBuffer()
    if (buf.length <= LOGO_MAX_BYTES) break
  }
  if (!buf || buf.length > LOGO_MAX_BYTES) {
    throw new Error(`logo is ${buf ? buf.length : 0} bytes, over ${LOGO_MAX_BYTES}`)
  }
  const info = await sharp(buf).metadata()
  fs.writeFileSync(LOGO_OUT, buf)
  console.log(`logo ${info.width}x${info.height} ${(buf.length / 1024).toFixed(1)}KB`)
}

async function optimizeMapSeal() {
  if (!fs.existsSync(SEAL_SRC)) throw new Error('missing 512px seal')
  const base = sharp(SEAL_SRC).resize(SEAL_SIDE, SEAL_SIDE, { fit: 'cover', position: 'centre' })
  const avif = await base.clone().avif({ quality: 58, effort: 6 }).toBuffer()
  const webp = await base.clone().webp({ quality: 80, effort: 6 }).toBuffer()
  for (const [file, buf] of [[SEAL_AVIF, avif], [SEAL_WEBP, webp]]) {
    if (buf.length > SEAL_MAX_BYTES) {
      throw new Error(`${path.basename(file)} is ${buf.length} bytes, over ${SEAL_MAX_BYTES}`)
    }
    fs.writeFileSync(file, buf)
    console.log(`seal ${path.basename(file)} ${SEAL_SIDE}x${SEAL_SIDE} ${(buf.length / 1024).toFixed(1)}KB`)
  }
}

async function main() {
  await optimizeLogo()
  await optimizeMapSeal()
  const pack = readJson(PACK_PATH)
  const previous = fs.existsSync(MANIFEST_PATH) ? readJson(MANIFEST_PATH).images || {} : {}
  const images = {}
  for (const url of collectPhotoUrls(pack)) {
    const entry = await optimizePhoto(url, previous[url])
    if (entry) images[url] = entry
  }
  const manifest = {
    generatedAt: new Date().toISOString(),
    maxBytes: MAX_BYTES,
    images,
  }
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`wrote ${path.relative(ROOT, MANIFEST_PATH)} (${Object.keys(images).length} photos)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
