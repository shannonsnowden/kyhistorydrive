#!/usr/bin/env node
/**
 * Copy iOS app JSON from shannonsnowden/ky-markers-drive `data/` into
 * `public/data/app/` so Amplify serves them at:
 *   https://kyhistorydrive.com/data/app/<file>
 *
 * These filenames match the iOS bundle (see ky-markers-drive ios/KYMarkersDrive/project.yml)
 * plus ky-history-manifest.json, which the app uses to check `data_version`.
 *
 * Source (first match wins):
 *   1. KY_MARKERS_DRIVE_DIR — local clone of ky-markers-drive
 *   2. GitHub API `main` using KY_MARKERS_DRIVE_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN
 *
 * If remote fetch is unavailable, already-seeded files in public/data/app/ are
 * left in place (so Amplify still publishes them). Missing required files fail.
 *
 * Usage:
 *   npm run sync-app-data
 *   KY_MARKERS_DRIVE_DIR=../ky-markers-drive npm run sync-app-data
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

function useSeeded() {
  const missing = FILES.filter((f) => !fs.existsSync(path.join(OUT_DIR, f)))
  if (missing.length) {
    throw new Error(
      'public/data/app/ is missing:\n  ' +
        missing.join('\n  ') +
        '\nSet KY_MARKERS_DRIVE_DIR or KY_MARKERS_DRIVE_GITHUB_TOKEN (read access to ky-markers-drive).',
    )
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'ky-history-manifest.json'), 'utf8'))
  console.log(
    `Using committed public/data/app/ files (data_version ${manifest.data_version}). ` +
      'To refresh from ky-markers-drive, set KY_MARKERS_DRIVE_DIR or KY_MARKERS_DRIVE_GITHUB_TOKEN.',
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

  const localDir = localDataDir()
  const token = githubToken()
  const mode = localDir ? `local:${localDir}` : token ? `github:${OWNER}/${REPO}@${REF}` : 'seeded-files-only'

  console.log(`sync-ios-app-data: ${mode}`)

  if (!localDir && !token) {
    useSeeded()
    return
  }

  try {
    await fetchAll(localDir, token)
  } catch (err) {
    // Amplify may have a GITHUB_TOKEN that cannot read the private iOS repo.
    // Fall back to the committed seed so the site still deploys.
    console.warn(`Fetch failed (${err.message || err}). Falling back to committed public/data/app/.`)
    useSeeded()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
