#!/usr/bin/env node
/**
 * Re-apply editor QA fixes (pins, county, years, exact text replacements) from
 * scripts/story-overrides.json after packs are ingested or derived files rebuilt.
 *
 *   node scripts/apply-story-overrides.mjs            apply (idempotent)
 *   node scripts/apply-story-overrides.mjs --check    dry run; exit 2 if any override would change files or is stale
 *   --root <dir>   repo root holding public/ (default: this repo; used by tests)
 *   --file <path>  overrides file (default: scripts/story-overrides.json)
 *
 * Exit codes: 0 ok (stale overrides are only reported), 1 malformed overrides file or data file, 2 --check failed.
 * See scripts/README.md for the file format.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const argVal = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)
const ROOT = path.resolve(argVal('--root') || path.join(HERE, '..'))
const FILE = path.resolve(argVal('--file') || path.join(HERE, 'story-overrides.json'))
const CHECK = argv.includes('--check')

const ALLOWED = new Set(['reason', 'date', 'historyId', 'lat', 'lon', 'county', 'yearStart', 'yearEnd', 'replace'])
const fail = (msg) => {
  console.error(`story-overrides: ${msg}`)
  process.exit(1)
}

// ---- load + validate overrides ------------------------------------------------------------
let spec
try {
  spec = JSON.parse(fs.readFileSync(FILE, 'utf8'))
} catch (e) {
  fail(`cannot read/parse ${path.relative(process.cwd(), FILE)}: ${e.message}`)
}
if (!spec || typeof spec !== 'object' || Array.isArray(spec) || !spec.overrides || typeof spec.overrides !== 'object' || Array.isArray(spec.overrides)) {
  fail('top level must be an object with an "overrides" object keyed by story slug')
}
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
for (const [slug, o] of Object.entries(spec.overrides)) {
  const w = `override "${slug}"`
  if (!o || typeof o !== 'object' || Array.isArray(o)) fail(`${w}: must be an object`)
  for (const k of Object.keys(o)) if (!ALLOWED.has(k)) fail(`${w}: unknown field "${k}" (allowed: ${[...ALLOWED].join(', ')})`)
  if (typeof o.reason !== 'string' || !o.reason.trim()) fail(`${w}: "reason" (non-empty string) is required`)
  if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) fail(`${w}: "date" (YYYY-MM-DD) is required`)
  if ('lat' in o !== 'lon' in o) fail(`${w}: "lat" and "lon" must be given together`)
  if ('lat' in o && (!isNum(o.lat) || !isNum(o.lon) || Math.abs(o.lat) > 90 || Math.abs(o.lon) > 180)) fail(`${w}: lat/lon must be numbers in range`)
  if ('county' in o && typeof o.county !== 'string') fail(`${w}: "county" must be a string ("" hides the label)`)
  for (const y of ['yearStart', 'yearEnd']) if (y in o && !Number.isInteger(o[y])) fail(`${w}: "${y}" must be an integer`)
  if ('historyId' in o && (typeof o.historyId !== 'string' || !o.historyId)) fail(`${w}: "historyId" must be a non-empty string`)
  if ('replace' in o) {
    if (!Array.isArray(o.replace) || !o.replace.length) fail(`${w}: "replace" must be a non-empty array of {old,new}`)
    o.replace.forEach((r, i) => {
      if (!r || typeof r.old !== 'string' || typeof r.new !== 'string' || !r.old) fail(`${w}: replace[${i}] needs string "old" (non-empty) and "new"`)
      if (r.old === r.new) fail(`${w}: replace[${i}] old and new are identical`)
    })
  }
  if (!['lat', 'county', 'yearStart', 'yearEnd', 'replace'].some((k) => k in o)) fail(`${w}: nothing to apply (add lat/lon, county, yearStart/yearEnd or replace)`)
}

// ---- data files (format-preserving JSON) --------------------------------------------------
const files = new Map()
function load(rel) {
  if (files.has(rel)) return files.get(rel)
  const fp = path.join(ROOT, rel)
  let entry = null
  if (fs.existsSync(fp)) {
    const raw = fs.readFileSync(fp, 'utf8')
    let data
    try {
      data = JSON.parse(raw)
    } catch (e) {
      fail(`${rel} is not valid JSON: ${e.message}`)
    }
    entry = { rel, fp, data, indent: /^[[{]\r?\n {2}/.test(raw) ? 2 : 0, nl: raw.endsWith('\n'), dirty: false }
  }
  files.set(rel, entry)
  return entry
}
const D = 'public/data'
const C = 'public/content'
const F = {
  index: `${C}/stories.json`,
  locs: `${C}/stories-locations.json`,
  sgeo: `${D}/layers/stories.geojson`,
  hgeo: `${D}/layers/history.geojson`,
  kyh: `${D}/app/ky-history.json`,
  search: `${D}/search-index.json`,
}

/** Records (objects) a slug/historyId lives in, each with accessors for the fields we touch. */
function targets(slug, historyId) {
  const out = []
  const add = (obj, a) => obj && out.push({ obj, ...a })
  const story = load(`${C}/stories/${slug}.json`)
  if (story) add(story.data, { file: story, county: 'add', years: 'add' })
  const idx = load(F.index)
  idx?.data.stories?.forEach((s) => s.slug === slug && add(s, { file: idx, lat: 'lat', lon: 'lon', county: 'add', years: 'add' }))
  const locs = load(F.locs)
  add(locs?.data.locations?.[slug], { file: locs, lat: 'lat', lon: 'lon' })
  const sg = load(F.sgeo)
  sg?.data.features?.forEach((f) => (f.properties?.slug === slug || f.properties?.id === slug) && add(f, { file: sg, geo: true, years: 'camel' }))
  const hg = load(F.hgeo)
  if (historyId) hg?.data.features?.forEach((f) => f.properties?.id === historyId && add(f, { file: hg, geo: true, county: 'add', years: 'both' }))
  const kyh = load(F.kyh)
  if (historyId && Array.isArray(kyh?.data)) kyh.data.forEach((p) => p.id === historyId && add(p, { file: kyh, lat: 'latitude', lon: 'longitude', years: 'snake' }))
  const si = load(F.search)
  si?.data.documents?.forEach((d) => (d.id === `story:${slug}` || (historyId && d.id === `place:${historyId}`)) && add(d, { file: si, lat: 'lat', lon: 'lon' }))
  return out
}

function resolveHistoryId(slug, o) {
  if (o.historyId) return o.historyId
  return load(F.locs)?.data.locations?.[slug]?.historyId || null
}

function setVal(t, obj, key, val, mode) {
  if (mode === 'exists' && !(key in obj)) return 0
  if (obj[key] === val) return 0
  obj[key] = val
  t.file.dirty = true
  return 1
}
function walk(node, fn) {
  if (Array.isArray(node)) node.forEach((v, i) => { const r = fn(v); if (r !== undefined) node[i] = r; else walk(v, fn) })
  else if (node && typeof node === 'object') for (const k of Object.keys(node)) { const r = fn(node[k]); if (r !== undefined) node[k] = r; else walk(node[k], fn) }
}

// ---- apply ---------------------------------------------------------------------------------
const report = { applied: [], ok: [], stale: [] }
for (const [slug, o] of Object.entries(spec.overrides)) {
  const historyId = resolveHistoryId(slug, o)
  const ts = targets(slug, historyId)
  const notes = []
  let changed = 0
  let stale = false
  if (!ts.length) {
    report.stale.push(`${slug}: no records found (story removed or renamed?)`)
    continue
  }
  if ('lat' in o) {
    let n = 0
    for (const t of ts) {
      if (t.geo) {
        const c = t.obj.geometry?.coordinates
        if (Array.isArray(c) && (c[0] !== o.lon || c[1] !== o.lat)) { t.obj.geometry.coordinates = [o.lon, o.lat]; t.file.dirty = true; n++ }
      } else if (t.lat) n += setVal(t, t.obj, t.lat, o.lat, 'exists') + setVal(t, t.obj, t.lon, o.lon, 'exists')
    }
    if (n) notes.push(`pin ${o.lat},${o.lon} (${n} values)`)
    changed += n
  }
  if ('county' in o) {
    let n = 0
    for (const t of ts) if (t.county) n += setVal(t, t.obj.properties && t.geo ? t.obj.properties : t.obj, 'county', o.county, t.county)
    if (n) notes.push(`county "${o.county}" (${n})`)
    changed += n
  }
  for (const [key, snake] of [['yearStart', 'year_start'], ['yearEnd', 'year_end']]) {
    if (!(key in o)) continue
    let n = 0
    for (const t of ts) {
      if (!t.years) continue
      const holder = t.geo ? t.obj.properties : t.obj
      if (t.years === 'add' || t.years === 'camel' || t.years === 'both') n += setVal(t, holder, key, o[key], t.years === 'add' ? 'add' : 'exists')
      if (t.years === 'snake' || t.years === 'both') n += setVal(t, holder, snake, o[key], 'exists')
    }
    if (n) notes.push(`${key} ${o[key]} (${n})`)
    changed += n
  }
  for (const [i, r] of (o.replace || []).entries()) {
    let n = 0
    let newSeen = false
    for (const t of ts) {
      walk(t.obj, (v) => {
        if (typeof v !== 'string') return undefined
        if (v.includes(r.old)) { n++; t.file.dirty = true; const nv = v.split(r.old).join(r.new); if (nv.includes(r.new)) newSeen = true; return nv }
        if (v.includes(r.new)) newSeen = true
        return undefined
      })
    }
    if (n) { notes.push(`replace[${i}] x${n}`); changed += n } else if (!newSeen) { report.stale.push(`${slug}: replace[${i}] old text not found and new text not present ("${r.old.slice(0, 50)}")`); stale = true }
  }
  if (changed) report.applied.push(`${slug}: ${notes.join('; ')}`)
  else if (!stale) report.ok.push(slug)
}

if (!CHECK) {
  for (const f of files.values()) {
    if (f?.dirty) fs.writeFileSync(f.fp, JSON.stringify(f.data, null, f.indent || undefined) + (f.nl ? '\n' : ''))
  }
}
const n = Object.keys(spec.overrides).length
console.log(`story-overrides: ${n} override(s): ${report.applied.length} ${CHECK ? 'would apply' : 'applied'}, ${report.ok.length} already in place, ${report.stale.length} stale`)
report.applied.forEach((l) => console.log(`  ${CHECK ? 'DRIFT' : 'applied'}: ${l}`))
report.stale.forEach((l) => console.log(`  stale:   ${l}`))
if (CHECK && (report.applied.length || report.stale.length)) process.exit(2)
