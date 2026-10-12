#!/usr/bin/env node
/**
 * Build public/data/people.json and mirror verified free portraits into
 * public/people/portraits/<id>-512.webp and .jpg. AI illustrations already
 * in that folder are referenced, never replaced. Nothing is hotlinked.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  AI_IDS,
  PORTRAIT_DIR,
  PUBLIC_PEOPLE,
  assertLicenseRules,
  assertPublicPeople,
  diskPath,
  findAiPortrait,
  isClearFreeLicense,
  isVerifiedFree,
  portraitFilesReady,
  publicRecord,
  realPortraitPaths,
} from './people-public.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const portraitDir = path.join(root, PORTRAIT_DIR)
const UA = 'KentuckyHistoryDrive/1.0 (https://kyhistorydrive.com; self-hosted people portraits)'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Same Commons file, scaled. Used only when the original URL fails. */
async function commonsThumbUrl(sourcePage) {
  const raw = String(sourcePage || '')
  const wiki = raw.match(/\/wiki\/File:(.+)$/i)
  const file = wiki ? wiki[1] : raw.split('?')[0].split('/').pop()
  if (!file) return null
  const title = `File:${decodeURIComponent(file)}`
  const api = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=1280&format=json`
  const response = await fetch(api, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!response.ok) return null
  const data = await response.json()
  const pages = data?.query?.pages || {}
  for (const page of Object.values(pages)) {
    const thumb = page?.imageinfo?.[0]?.thumburl
    if (thumb) return String(thumb).split('?')[0]
  }
  return null
}

async function fetchImage(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
    },
    redirect: 'follow',
  })
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    await sleep(800 * attempt * attempt)
    return fetchImage(url, attempt + 1)
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  const buf = Buffer.from(await response.arrayBuffer())
  if (buf.length < 80) throw new Error(`short body (${buf.length} bytes) for ${url}`)
  const head = buf.slice(0, 64).toString('utf8').toLowerCase()
  if (head.includes('<!doctype') || head.includes('<html')) throw new Error(`HTML response for ${url}`)
  return buf
}

function sharpInput(buf) {
  return sharp(buf, { failOn: 'none', density: 300, pages: 1, unlimited: true, animated: false })
}

/** Top-weighted center square when attention cannot read the file. */
async function centerFaceSquare(buf) {
  const oriented = await sharpInput(buf).rotate().toBuffer()
  const sized = await sharp(oriented).metadata()
  const width = sized.width || 0
  const height = sized.height || 0
  if (!width || !height) throw new Error('portrait has no dimensions')
  const side = Math.min(width, height)
  let left = Math.round((width - side) / 2)
  const topBias = height > width * 1.2
  let top = topBias ? Math.round((height - side) * 0.08) : Math.round((height - side) / 2)
  left = Math.max(0, Math.min(left, width - side))
  top = Math.max(0, Math.min(top, height - side))
  return sharp(oriented).extract({ left, top, width: side, height: side }).resize(512, 512, { fit: 'fill' }).toBuffer()
}

/**
 * Square 512 crop. Attention looks for skin tones and detail so a face stays
 * in frame. SVG silhouettes use a center crop. Other failures use a
 * top-weighted center crop.
 */
export async function writeHeadshot(buf, webpFile, jpgFile) {
  const meta = await sharpInput(buf).metadata()
  const position = meta.format === 'svg' ? 'centre' : 'attention'
  let base
  try {
    base = await sharpInput(buf).rotate().resize(512, 512, { fit: 'cover', position }).toBuffer()
  } catch {
    base = await centerFaceSquare(buf)
  }
  const sized = await sharp(base).metadata()
  if (sized.width !== 512 || sized.height !== 512) {
    base = await centerFaceSquare(buf)
  }
  await sharp(base).webp({ quality: 78, effort: 4 }).toFile(webpFile)
  await sharp(base).jpeg({ quality: 82, mozjpeg: true }).toFile(jpgFile)
  const check = await sharp(webpFile).metadata()
  if (check.width !== 512 || check.height !== 512) {
    throw new Error(`expected 512 square, got ${check.width}x${check.height}`)
  }
}

async function ensureRealPortrait(person) {
  const image = realPortraitPaths(person.id)
  const webpFile = diskPath(root, image.webp)
  const jpgFile = diskPath(root, image.jpg)
  if (portraitFilesReady(root, image)) {
    const meta = await sharp(webpFile).metadata()
    if (meta.width === 512 && meta.height === 512) return { image, fetched: false }
  }
  let buf
  let via = 'source'
  try {
    buf = await fetchImage(person.image)
  } catch (err) {
    const thumb = await commonsThumbUrl(person.sourcePage || person.image)
    if (!thumb) throw err
    buf = await fetchImage(thumb)
    via = 'thumb'
  }
  const tmpWebp = `${webpFile}.part`
  const tmpJpg = `${jpgFile}.part`
  await writeHeadshot(buf, tmpWebp, tmpJpg)
  fs.renameSync(tmpWebp, webpFile)
  fs.renameSync(tmpJpg, jpgFile)
  return { image, fetched: true, via }
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  async function run() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
  return results
}

function sourcePeople() {
  const file = path.join(root, 'data/people.json')
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!Array.isArray(data.people)) throw new Error('data/people.json is missing people[]')
  return data.people
}

async function main() {
  assertLicenseRules()
  sharp.cache(false)
  fs.mkdirSync(portraitDir, { recursive: true })
  fs.mkdirSync(path.dirname(path.join(root, PUBLIC_PEOPLE)), { recursive: true })
  const people = sourcePeople()
  const skipped = []
  const aiIds = new Set(AI_IDS)
  const realCandidates = []

  for (const person of people) {
    if (findAiPortrait(person.id, portraitDir)) continue
    const hasSource = Boolean(person.image)
    if (person.freeToUse && person.verified && hasSource && !isClearFreeLicense(person.license)) {
      skipped.push({
        id: person.id,
        name: person.name,
        license: person.license || '',
        reason: 'license is not clearly public domain, CC0, CC BY, or CC BY-SA',
      })
      continue
    }
    if (person.freeToUse && hasSource && !person.verified) {
      skipped.push({
        id: person.id,
        name: person.name,
        license: person.license || '',
        reason: 'marked free to use, but the license was not verified',
      })
      continue
    }
    if (!isVerifiedFree(person)) continue
    if (aiIds.has(person.id)) continue
    realCandidates.push(person)
  }

  const fetched = await mapPool(realCandidates, 3, async (person) => {
    try {
      const result = await ensureRealPortrait(person)
      if (result.fetched) await sleep(150)
      return { person, ...result, error: null }
    } catch (err) {
      return { person, image: null, fetched: false, error: err.message || String(err) }
    }
  })

  const realById = new Map()
  let downloaded = 0
  for (const row of fetched) {
    if (row.error) {
      skipped.push({
        id: row.person.id,
        name: row.person.name,
        license: row.person.license || '',
        reason: `download failed: ${row.error}`,
      })
      continue
    }
    realById.set(row.person.id, row.image)
    if (row.fetched) downloaded += 1
  }

  const records = people.map((person) => {
    const aiImage = findAiPortrait(person.id, portraitDir)
    if (aiImage) {
      const credited = {
        ...person,
        credit: person.credit || 'Kentucky History Drive',
        license: person.license || 'Original AI illustration',
      }
      return publicRecord(credited, aiImage, true)
    }
    const real = realById.get(person.id)
    if (real) return publicRecord(person, real, false)
    return publicRecord(person, null, false)
  })

  const payload = {
    source: 'data/people.json',
    people: records,
  }
  assertPublicPeople(payload)
  const outFile = path.join(root, PUBLIC_PEOPLE)
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`)

  const aiCount = records.filter((person) => person.ai && person.image).length
  const realCount = records.filter((person) => person.image && !person.ai).length
  const missingAi = AI_IDS.filter((id) => !records.some((person) => person.id === id && person.ai && person.image))
  if (missingAi.length) throw new Error(`people: missing AI portraits for ${missingAi.join(', ')}`)
  if (records.length !== people.length) throw new Error('people: public file dropped a person')

  console.log(
    `build-people: ${records.length} people, ${aiCount} AI, ${realCount} real (${downloaded} downloaded this run), ${skipped.length} skipped`,
  )
  for (const row of skipped) {
    console.log(`  skip ${row.id}: ${row.reason} [${row.license}]`)
  }
  return { aiCount, realCount, downloaded, skipped, total: records.length }
}

const calledDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (calledDirectly) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
