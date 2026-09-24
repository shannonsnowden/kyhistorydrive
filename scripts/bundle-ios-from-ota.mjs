#!/usr/bin/env node
/**
 * Release-cut helper: copy this site’s OTA packs (`public/data/app/`) into a
 * local ky-markers-drive checkout’s `data/` so the Xcode offline bundle matches
 * live OTA before an App Store / TestFlight build.
 *
 * Shannon rule (2026-09-24): run ONLY when intentionally shipping an iOS build.
 * Daily History content must NOT commit into ky-markers-drive.
 *
 * Requires:
 *   SYNC_IOS_BUNDLE=1
 *   KY_MARKERS_DRIVE_DIR=/path/to/ky-markers-drive
 *
 * Usage:
 *   SYNC_IOS_BUNDLE=1 KY_MARKERS_DRIVE_DIR=../ky-markers-drive npm run bundle-ios-from-ota
 *
 * This script does not git commit or push — you review and commit in the iOS repo.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'public/data/app')

const FILES = [
  'ky-history-manifest.json',
  'ky-history.json',
  'museums.json',
  'national-sites.json',
  'war-sites.json',
  'locals.json',
  'covered-bridges.json',
  'industrial-sites.json',
  'newspapers.json',
  'state-parks.json',
  'historic-cemeteries.json',
  'distilleries.json',
  'historic-photos.json',
  'site-historic-photos.json',
  'markers.phase1.json',
  'search-index.json',
]

function optIn() {
  const v = (process.env.SYNC_IOS_BUNDLE || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function main() {
  if (!optIn()) {
    console.error(
      'Refusing: set SYNC_IOS_BUNDLE=1 to copy OTA packs into the iOS repo (release cut only).',
    )
    process.exit(1)
  }
  const root = process.env.KY_MARKERS_DRIVE_DIR
  if (!root) {
    console.error('Set KY_MARKERS_DRIVE_DIR to a local ky-markers-drive checkout.')
    process.exit(1)
  }
  const destDir = path.join(path.resolve(root), 'data')
  if (!fs.existsSync(destDir)) {
    console.error(`Missing iOS data dir: ${destDir}`)
    process.exit(1)
  }

  let version = '?'
  for (const file of FILES) {
    const src = path.join(SRC_DIR, file)
    if (!fs.existsSync(src)) {
      console.error(`Missing OTA file: ${src}`)
      process.exit(1)
    }
    const buf = fs.readFileSync(src)
    if (file.endsWith('.json')) {
      JSON.parse(buf.toString('utf8'))
    }
    if (file === 'ky-history-manifest.json') {
      version = JSON.parse(buf.toString('utf8')).data_version
    }
    fs.writeFileSync(path.join(destDir, file), buf)
    console.log(`  → data/${file}`)
  }
  console.log(
    `Copied ${FILES.length} OTA files into ${destDir} (data_version ${version}). Review and commit in ky-markers-drive only for this release cut.`,
  )
}

main()
