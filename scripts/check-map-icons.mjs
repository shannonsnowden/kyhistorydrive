#!/usr/bin/env node
/**
 * check-map-icons: every map icon the site can request exists in dist/icons/.
 * Sources of icon references:
 *  - literal "/icons/<name>.png" strings in the built JS/HTML (dist/assets, dist/index.html) and in src/;
 *  - icon ids the map loads by name: the war-site battle pins (src/battle-pins.js) and the default pin;
 *  - icon/pinIcon/icon_url fields in the layer data (public/data/layers, public/data/app).
 * A missing file is a live 404 on the map (Editor, Oct 19: /icons/battle-revolutionary.png, /icons/battle-civil.png).
 *   node scripts/check-map-icons.mjs [--dist <dir>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_BATTLE_PIN_ICON, battlePinIconIds } from '../src/battle-pins.js'

const argv = process.argv.slice(2)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.resolve(argv.includes('--dist') ? argv[argv.indexOf('--dist') + 1] : path.join(root, 'dist'))
const iconsDir = path.join(dist, 'icons')
const refs = new Map() // icon file name -> where it was referenced
const add = (name, where) => {
  if (!refs.has(name)) refs.set(name, new Set())
  refs.get(name).add(where)
}
const ICON_RE = /\/?icons\/([a-z0-9][a-z0-9-]*\.(?:png|svg|webp))/gi

function scanText(file, label) {
  const text = fs.readFileSync(file, 'utf8')
  for (const m of text.matchAll(ICON_RE)) add(m[1], label)
}
function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name)
    if (e.isDirectory()) walk(f, ext, out)
    else if (ext.some((x) => e.name.endsWith(x))) out.push(f)
  }
  return out
}

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error(`check-map-icons: no build in ${dist}`)
  process.exit(1)
}
for (const f of [...walk(path.join(dist, 'assets'), ['.js']), path.join(dist, 'index.html')]) scanText(f, path.relative(dist, f))
for (const f of walk(path.join(root, 'src'), ['.js'])) scanText(f, path.relative(root, f))

// Icons loaded by id at runtime: `/icons/${id}.png`.
for (const id of [DEFAULT_BATTLE_PIN_ICON, ...battlePinIconIds()]) add(`${id}.png`, 'src/battle-pins.js')

// Layer data fields.
const ICON_KEYS = new Set(['icon', 'pinIcon', 'icon_url', 'iconUrl'])
function scanData(node, label) {
  if (Array.isArray(node)) return node.forEach((v) => scanData(v, label))
  if (!node || typeof node !== 'object') return
  for (const [k, v] of Object.entries(node)) {
    if (ICON_KEYS.has(k) && typeof v === 'string' && v) {
      const m = v.match(/^\/?icons\/([a-z0-9][a-z0-9-]*\.(?:png|svg|webp))$/i)
      if (m) add(m[1], label)
      else if (/^[a-z0-9-]+$/.test(v)) add(`${v}.png`, label)
    } else scanData(v, label)
  }
}
for (const f of [...walk(path.join(root, 'public/data/layers'), ['.geojson', '.json']), ...walk(path.join(root, 'public/data/app'), ['.json'])]) {
  try {
    scanData(JSON.parse(fs.readFileSync(f, 'utf8')), path.relative(root, f))
  } catch {
    /* not JSON */
  }
}

const missing = [...refs.entries()].filter(([name]) => !fs.existsSync(path.join(iconsDir, name)))
if (missing.length) {
  for (const [name, where] of missing) console.error(`check-map-icons: /icons/${name} is referenced (${[...where].join(', ')}) but not in dist/icons/`)
  process.exit(1)
}
console.log(`check-map-icons: ${refs.size} referenced map icons all exist in dist/icons/`)
