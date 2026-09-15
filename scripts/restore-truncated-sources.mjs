#!/usr/bin/env node
/**
 * If src/main.js or the history layer were truncated by a partial GitHub write,
 * restore complete copies from known-good commits, then apply the Wikipedia
 * research-link patch when it is present.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const MAIN_COMMIT = 'cffd0b25ad252efbb1bb0f4117bee5f69e273f43'
const HISTORY_COMMIT = '63fb231fbd50fe2549c11fd41b071201006fa775'
const FALLBACK_COMMIT = '4e23eecd08cbd58dc6132ac144266b7865c90f41'
const TODD_FROM = 'https://grokipedia.com/page/Todd_County,_Kentucky'
const TODD_TO = 'https://en.wikipedia.org/wiki/John_Todd_(Virginia)'

const rawUrl = (commit, relPath) =>
  `https://raw.githubusercontent.com/shannonsnowden/kyhistorydrive/${commit}/${relPath}`

function historyLooksComplete(text) {
  try {
    const data = JSON.parse(text)
    return Array.isArray(data.features) && data.features.length >= 50
  } catch {
    return false
  }
}

function mainLooksComplete(text) {
  return text.includes('function applyRoute') && text.includes('const OSM_STYLE')
}

async function fetchRaw(commit, relPath) {
  const res = await fetch(rawUrl(commit, relPath))
  if (!res.ok) throw new Error(`fetch ${commit} ${relPath}: HTTP ${res.status}`)
  return res.text()
}

async function restoreIfTruncated({ relPath, minBytes, check, commits, transform }) {
  const dest = path.join(root, relPath)
  let current = ''
  try {
    current = fs.readFileSync(dest, 'utf8')
  } catch {
    current = ''
  }
  if (current.length >= minBytes && check(current)) {
    console.log(`keep ${relPath} (${current.length} bytes)`)
    return current
  }
  let lastError = null
  for (const commit of commits) {
    try {
      console.log(`restore ${relPath} from ${commit} (was ${current.length} bytes)`)
      let text = await fetchRaw(commit, relPath)
      if (transform) text = transform(text)
      if (text.length < minBytes || !check(text)) {
        throw new Error(`incomplete after ${commit} (${text.length} bytes)`)
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, text)
      console.log(`wrote ${relPath} (${text.length} bytes)`)
      return text
    } catch (err) {
      lastError = err
      console.warn(String(err?.message || err))
    }
  }
  throw lastError || new Error(`could not restore ${relPath}`)
}

function applyMainDiff() {
  const mainPath = path.join(root, 'src/main.js')
  const diffPath = path.join(root, '_restore/main.js.diff')
  const main = fs.readFileSync(mainPath, 'utf8')
  if (main.includes('extractResearchLinks')) {
    console.log('keep Wikipedia research-link helpers')
    return
  }
  if (!fs.existsSync(diffPath)) {
    console.log('no _restore/main.js.diff; leaving restored main.js as-is')
    return
  }
  const result = spawnSync('patch', ['-p1', '--forward', '--batch', '-i', diffPath], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  const next = fs.readFileSync(mainPath, 'utf8')
  if (next.includes('extractResearchLinks')) {
    console.log('applied _restore/main.js.diff')
    return
  }
  console.warn('patch did not add extractResearchLinks; keeping restored main.js so the map can still render')
}

await restoreIfTruncated({
  relPath: 'src/main.js',
  minBytes: 50000,
  check: mainLooksComplete,
  commits: [MAIN_COMMIT, FALLBACK_COMMIT],
})
await restoreIfTruncated({
  relPath: 'public/data/layers/history.geojson',
  minBytes: 40000,
  check: historyLooksComplete,
  commits: [HISTORY_COMMIT, FALLBACK_COMMIT],
  transform: (text) => text.replaceAll(TODD_FROM, TODD_TO),
})
applyMainDiff()
