#!/usr/bin/env node
/**
 * Publish the iOS OTA JSON pack from committed `public/data/app/`.
 *
 * Daily OTA source of truth is this repo’s committed `public/data/app/`
 * (served at https://kyhistorydrive.com/data/app/). Content-only History
 * bumps edit and bump `data_version` here. Do not pull ky-markers-drive on
 * daily Amplify deploys — that overwrites fresher site OTA with stale
 * iOS-bundle JSON.
 *
 * Default (Amplify and `npm run sync-app-data`):
 *   Validate required files + `data_version` in public/data/app/, log the
 *   version, and exit 0. Nothing is fetched or overwritten.
 *
 * Legacy / migration / rare — NOT for daily deploys:
 *   SYNC_FROM_MARKERS=1 fetches and overwrites public/data/app/ from
 *   ky-markers-drive. Source (first match):
 *     1. KY_MARKERS_DRIVE_DIR — local clone
 *     2. GitHub API `main` using KY_MARKERS_DRIVE_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN
 *   Amplify must NOT set SYNC_FROM_MARKERS.
 *
 * App Store / TestFlight cuts (Shannon/CoS): copy `public/data/app/*` into
 * ky-markers-drive `data/` as the offline fallback, then bump the iOS build.
 * There is no push script. Do that copy only on a store cut, not for a
 * data_version bump alone.
 *
 * Usage:
 *   npm run sync-app-data
 *   SYNC_FROM_MARKERS=1 KY_MARKERS_DRIVE_DIR=../ky-markers-drive npm run sync-app-data
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public/data/app')

const OWNER = 'shannonsnowden'
const REPO = 'ky-markers-drive'
const REF = process.env.KY_MARKERS_DRIVE_REF || 'main'

/** iOS-bundled layer JSON + manifest the app polls for data_version. */
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

function githubToken() {
  return (
    process.env.KY_MARKERS_DRIVE_GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    ''
  )
}

function localDataDir() {
  const root = process.env.KY_MARKERS_DRIVE_DIR
  if (!root) return null
  return path.join(path.resolve(root), 'data')
}

async function readLocal(dataDir, file) {
  const fp = path.join(dataDir, file)
  if (!fs.existsSync(fp)) throw new Error(`missing local file ${fp}`)
  return fs.readFileSync(fp)
}

async function readGithub(file, token) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/data/${encodeURIComponent(file)}?ref=${encodeURIComponent(REF)}`
  const headers = {
    Accept: 'application/vnd.github.raw+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'kyhistorydrive-sync-ios-app-data',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub ${res.status} for ${file}: ${body.slice(0, 200)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

function assertJson(file, buf) {
  let parsed
  try {
    parsed = JSON.parse(buf.toString('utf8'))
  } catch {
    throw new Error(`${file} is not valid JSON`)
  }
  if (file === 'ky-history-manifest.json' && (parsed.data_version == null || parsed.data_version === '')) {
    throw new Error('ky-history-manifest.json is missing data_version')
  }
  return parsed
}

function moveFile(src, dest) {
  try {
    fs.renameSync(src, dest)
  } catch (err) {
    if (err.code !== 'EXDEV') throw err
    fs.copyFileSync(src, dest)
    fs.unlinkSync(src)
  }
}

function useCommitted() {
  const missing = FILES.filter((f) => !fs.existsSync(path.join(OUT_DIR, f)))
  if (missing.length) {
    throw new Error(
      'public/data/app/ is missing:\n  ' +
        missing.join('\n  ') +
        '\nCommitted public/data/app/ is the OTA source of truth. Add the files in this repo.',
    )
  }
  let manifest
  for (const file of FILES) {
    const parsed = assertJson(file, fs.readFileSync(path.join(OUT_DIR, file)))
    if (file === 'ky-history-manifest.json') manifest = parsed
  }
  console.log(
    `Validated ${FILES.length} files in public/data/app/ (data_version ${manifest.data_version}).`,
  )
}

async function fetchAll(localDir, token) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'ky-app-data-'))
  try {
    const results = []
    for (const file of FILES) {
      const buf = localDir ? await readLocal(localDir, file) : await readGithub(file, token)
      const parsed = assertJson(file, buf)
      fs.writeFileSync(path.join(staging, file), buf)
      const extra = file === 'ky-history-manifest.json' ? ` data_version=${parsed.data_version}` : ''
      results.push({ file, bytes: buf.length, extra })
      console.log(`  ${file}  ${buf.length} bytes${extra}`)
    }
    fs.mkdirSync(OUT_DIR, { recursive: true })
    for (const file of FILES) {
      moveFile(path.join(staging, file), path.join(OUT_DIR, file))
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'ky-history-manifest.json'), 'utf8'))
    console.log(`Wrote ${results.length} files to public/data/app/ (data_version ${manifest.data_version})`)
  } finally {
    fs.rmSync(staging, { recursive: true, force: true })
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // Daily deploys always publish the committed pack. A GitHub token alone
  // must not pull ky-markers-drive (Amplify often has GITHUB_TOKEN).
  if (process.env.SYNC_FROM_MARKERS !== '1') {
    console.log('sync-ios-app-data: committed public/data/app/ (OTA source of truth)')
    useCommitted()
    return
  }

  const localDir = localDataDir()
  const token = githubToken()
  if (!localDir && !token) {
    throw new Error(
      'SYNC_FROM_MARKERS=1 but neither KY_MARKERS_DRIVE_DIR nor KY_MARKERS_DRIVE_GITHUB_TOKEN (or GH_TOKEN / GITHUB_TOKEN) is set. ' +
        'This path is legacy/migration only and must not be used for daily deploys.',
    )
  }

  const mode = localDir ? `local:${localDir}` : `github:${OWNER}/${REPO}@${REF}`
  console.log(`sync-ios-app-data: SYNC_FROM_MARKERS=1 ${mode}`)
  console.warn(
    'Pulling from ky-markers-drive is legacy/migration only. Daily OTA deploys must not set SYNC_FROM_MARKERS.',
  )

  try {
    await fetchAll(localDir, token)
  } catch (err) {
    console.warn(`Fetch failed (${err.message || err}). Falling back to committed public/data/app/.`)
    useCommitted()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
