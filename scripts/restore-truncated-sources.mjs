#!/usr/bin/env node
/**
 * If src/main.js or the history layer were truncated by a partial GitHub write,
 * restore the last complete copies from this repo before Vite builds.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const GOOD_COMMIT = '4e23eecd08cbd58dc6132ac144266b7865c90f41'
const rawUrl = (relPath) =>
  `https://raw.githubusercontent.com/shannonsnowden/kyhistorydrive/${GOOD_COMMIT}/${relPath}`

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

async function restoreIfTruncated({ relPath, minBytes, check }) {
  const dest = path.join(root, relPath)
  let current = ''
  try {
    current = fs.readFileSync(dest, 'utf8')
  } catch {
    current = ''
  }
  if (current.length >= minBytes && check(current)) {
    console.log(`keep ${relPath} (${current.length} bytes)`)
    return
  }
  console.log(`restore ${relPath} from ${GOOD_COMMIT} (was ${current.length} bytes)`)
  const res = await fetch(rawUrl(relPath))
  if (!res.ok) throw new Error(`fetch ${relPath}: HTTP ${res.status}`)
  const text = await res.text()
  if (text.length < minBytes || !check(text)) {
    throw new Error(`restored ${relPath} is still incomplete (${text.length} bytes)`)
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, text)
  console.log(`wrote ${relPath} (${text.length} bytes)`)
}

await restoreIfTruncated({
  relPath: 'src/main.js',
  minBytes: 50000,
  check: mainLooksComplete,
})
await restoreIfTruncated({
  relPath: 'public/data/layers/history.geojson',
  minBytes: 40000,
  check: historyLooksComplete,
})
