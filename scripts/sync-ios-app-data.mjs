#!/usr/bin/env node
/**
 * OTA pack helper for https://kyhistorydrive.com/data/app/<file>
 *
 * Shannon rule (2026-09-24): content-only days update this site’s committed
 * `public/data/app/` only. The iOS repo (ky-markers-drive) is NOT the daily
 * source of truth — bundled JSON there is an offline fallback refreshed only
 * when cutting an App Store / TestFlight build (see bundle-ios-from-ota.mjs).
 *
 * Default (Amplify preBuild + daily packs):
 *   Leave committed `public/data/app/` in place. Do NOT pull from markers.
 *
 * Opt-in pull FROM ky-markers-drive (legacy / rare rebuild):
 *   SYNC_IOS_BUNDLE=1   (or SYNC_FROM_MARKERS=1)
 *   plus KY_MARKERS_DRIVE_DIR or KY_MARKERS_DRIVE_GITHUB_TOKEN / GH_TOKEN / GITHUB_TOKEN
 *
 * Usage:
 *   npm run sync-app-data
 *   SYNC_IOS_BUNDLE=1 KY_MARKERS_DRIVE_DIR=../ky-markers-drive npm run sync-app-data
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

/** Truthy opt-in to overwrite OTA packs from the iOS repo (not for daily content). */
function syncFromMarkersOptIn() {
  const v = (process.env.SYNC_IOS_BUNDLE || process.env.SYNC_FROM_MARKERS || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

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

function useSeeded(reason) {
  const missing = FILES.filter((f) => !fs.existsSync(path.join(OUT_DIR, f)))
  if (missing.length) {
    throw new Error(
      'public/data/app/ is missing:\n  ' +
        missing.join('\n  ') +
        '\nCommit OTA packs under public/data/app/ (daily content path), or set SYNC_IOS_BUNDLE=1 with KY_MARKERS_DRIVE_DIR / token for a rare pull from markers.',
    )
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'ky-history-manifest.json'), 'utf8'))
  console.log(
    `Using committed public/data/app/ (OTA SoT, data_version ${manifest.data_version}). ${reason}`,
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

  const optIn = syncFromMarkersOptIn()
  const localDir = localDataDir()
  const token = githubToken()

  if (!optIn) {
    useSeeded(
      'Set SYNC_IOS_BUNDLE=1 to overwrite from ky-markers-drive (release/legacy only — not daily content).',
    )
    return
  }

  const mode = localDir ? `local:${localDir}` : token ? `github:${OWNER}/${REPO}@${REF}` : 'opt-in-but-no-source'
  console.log(`sync-ios-app-data: SYNC_IOS_BUNDLE opt-in → ${mode}`)

  if (!localDir && !token) {
    useSeeded('SYNC_IOS_BUNDLE=1 set but no KY_MARKERS_DRIVE_DIR or GitHub token — keeping committed OTA files.')
    return
  }

  try {
    await fetchAll(localDir, token)
  } catch (err) {
    console.warn(`Fetch from markers failed (${err.message || err}). Falling back to committed public/data/app/.`)
    useSeeded('Markers fetch failed.')
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
