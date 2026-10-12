/**
 * 112px square crops for story-card thumbnails.
 * The card shows them at 56px, so this file is the 2× source.
 * Original JPEGs stay put. Larger opt/ variants are left alone.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const indexPath = path.join(root, 'public/content/stories.json')
const outDir = path.join(root, 'public/content/photos/opt/stories')

function photoUrls() {
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  const urls = new Set()
  for (const story of index.stories || []) {
    const url = story?.photo?.image_url
    if (typeof url === 'string' && url.startsWith('/content/photos/')) urls.add(url)
  }
  return [...urls]
}

let written = 0
let kept = 0
let missing = 0
fs.mkdirSync(outDir, { recursive: true })

for (const url of photoUrls()) {
  const rel = url.replace(/^\//, '')
  const abs = path.join(root, 'public', rel)
  const base = path.basename(rel, path.extname(rel))
  const dest = path.join(outDir, `${base}-112.webp`)
  if (!fs.existsSync(abs)) {
    missing += 1
    console.warn(`related thumb missing source: ${url}`)
    continue
  }
  if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= fs.statSync(abs).mtimeMs) {
    kept += 1
    continue
  }
  await sharp(abs)
    .rotate()
    .resize(112, 112, { fit: 'cover', position: 'attention', withoutEnlargement: false })
    .webp({ quality: 72, effort: 4 })
    .toFile(dest)
  written += 1
}

console.log(`related thumbs: wrote ${written}, kept ${kept}, missing ${missing}`)
