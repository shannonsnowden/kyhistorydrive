#!/usr/bin/env node
/**
 * Remove authoring notes from dist/ after Vite copies public/ across.
 *
 * Deletes every .md file in dist/ (NOTES.md, raw briefs, READMEs, and any
 * other markdown Vite copied from public/). Also deletes source-only master
 * PNGs over 5MB: a PNG whose name contains "master" as its own word, larger
 * than 5,000,000 bytes, and not referenced by the published site. Build
 * scripts may read those masters as inputs; a public/ filesystem path does
 * not count as a published reference.
 *
 * Source files under public/ are never deleted or modified.
 *
 * Usage: node scripts/strip-authoring-notes.mjs [dist]
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

/** Over ~5MB. Masters at or under this size stay. */
export const MASTER_PNG_MIN_BYTES = 5_000_000

const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.html', '.css', '.json', '.geojson',
  '.xml', '.txt', '.svg', '.webmanifest', '.yml', '.yaml', '.vtt',
])

const rootOfScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function relPosix(parent, file) {
  return path.relative(parent, file).split(path.sep).join('/')
}

function byPath(a, b) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function assertInside(parent, file) {
  const rel = path.relative(path.resolve(parent), path.resolve(file))
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`strip-authoring-notes: refusing to touch ${file} outside ${parent}`)
  }
}

export function isMarkdown(file) {
  return path.basename(file).toLowerCase().endsWith('.md')
}

/** "master" as its own word, so postmaster.png is not a master. */
export function isMasterPng(file) {
  const base = path.basename(file)
  if (!base.toLowerCase().endsWith('.png')) return false
  const stem = base.slice(0, -4)
  return /(?:^|[^a-z0-9])master(?:[^a-z0-9]|$)/i.test(stem)
}

function walkFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    for (const ent of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, ent.name)
      if (ent.isSymbolicLink()) continue
      if (ent.isDirectory()) stack.push(file)
      else if (ent.isFile()) out.push(file)
    }
  }
  return out
}

function fingerprint(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function sourceFingerprints(publicDir) {
  const out = new Map()
  if (!publicDir || !fs.existsSync(publicDir)) return out
  for (const file of walkFiles(publicDir)) {
    if (!isMarkdown(file) && !isMasterPng(file)) continue
    out.set(relPosix(publicDir, file), fingerprint(file))
  }
  return out
}

function assertSourcesIntact(publicDir, before) {
  const after = sourceFingerprints(publicDir)
  for (const [rel, hash] of before) {
    if (!after.has(rel)) throw new Error(`strip-authoring-notes: source deleted: ${rel}`)
    if (after.get(rel) !== hash) throw new Error(`strip-authoring-notes: source modified: ${rel}`)
  }
  for (const rel of after.keys()) {
    if (!before.has(rel)) throw new Error(`strip-authoring-notes: source appeared during strip: ${rel}`)
  }
}

function mentionsPublished(lowerText, name) {
  let from = 0
  while (from < lowerText.length) {
    const idx = lowerText.indexOf(name, from)
    if (idx === -1) return false
    const prev = idx > 0 ? lowerText[idx - 1] : ''
    if (/[a-z0-9-]/.test(prev)) {
      from = idx + name.length
      continue
    }
    const before = lowerText.slice(Math.max(0, idx - 160), idx)
    // public/maps/.../file.png in a build script is an input path, not a URL.
    if (!(/(?:^|[^a-z0-9])public[/\\][\w./\\-]*$/.test(before))) return true
    from = idx + name.length
  }
  return false
}

function scanRoots(root) {
  const entries = [
    path.join(root, 'src'),
    path.join(root, 'scripts'),
    path.join(root, 'public'),
    path.join(root, 'privacy'),
    path.join(root, 'index.html'),
  ]
  return entries.filter((entry) => fs.existsSync(entry))
}

/** Lowercased basenames that the published site actually references. */
export function publishedMasterNames(root, basenames) {
  const pending = new Set(basenames.map((name) => name.toLowerCase()))
  const found = new Set()
  if (!root || !pending.size) return found
  const files = []
  for (const entry of scanRoots(root)) {
    const stat = fs.statSync(entry)
    if (stat.isDirectory()) files.push(...walkFiles(entry))
    else files.push(entry)
  }
  for (const file of files) {
    if (!pending.size) break
    if (isMarkdown(file)) continue
    if (!TEXT_EXT.has(path.extname(file).toLowerCase())) continue
    let text
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const lower = text.toLowerCase()
    for (const name of [...pending]) {
      if (!mentionsPublished(lower, name)) continue
      found.add(name)
      pending.delete(name)
    }
  }
  return found
}

function masterCandidates(dirs, minBytes) {
  const names = new Set()
  for (const dir of dirs) {
    if (!dir || !fs.existsSync(dir)) continue
    for (const file of walkFiles(dir)) {
      if (!isMasterPng(file)) continue
      if (fs.statSync(file).size > minBytes) names.add(path.basename(file))
    }
  }
  return [...names]
}

export function isSourceOnlyMaster(file, publishedLower, minBytes) {
  if (!isMasterPng(file)) return false
  if (fs.statSync(file).size <= minBytes) return false
  return !publishedLower.has(path.basename(file).toLowerCase())
}

function assertDistIsSafe(distDir, publicDir, root) {
  if (!fs.existsSync(distDir)) throw new Error(`strip-authoring-notes: missing ${distDir}`)
  const distReal = fs.realpathSync(distDir)
  if (root && fs.existsSync(root) && fs.realpathSync(root) === distReal) {
    throw new Error('strip-authoring-notes: refusing to strip the project root')
  }
  if (publicDir && fs.existsSync(publicDir)) {
    const pubReal = fs.realpathSync(publicDir)
    if (distReal === pubReal) {
      throw new Error('strip-authoring-notes: refusing to strip the public source directory')
    }
    const rel = path.relative(pubReal, distReal)
    if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      throw new Error('strip-authoring-notes: refusing to strip dist because it resolves inside public/')
    }
  }
}

function removeDistFile(distDir, file) {
  assertInside(distDir, file)
  const listed = fs.lstatSync(file)
  if (listed.isSymbolicLink()) {
    fs.unlinkSync(file)
  } else if (listed.isFile()) {
    const distReal = fs.realpathSync(distDir)
    const fileReal = fs.realpathSync(file)
    assertInside(distReal, fileReal)
    fs.unlinkSync(file)
  } else {
    throw new Error(`strip-authoring-notes: refusing to delete non-file ${file}`)
  }
  let dir = path.dirname(file)
  while (path.resolve(dir) !== path.resolve(distDir)) {
    assertInside(distDir, dir)
    if (fs.readdirSync(dir).length) break
    fs.rmdirSync(dir)
    dir = path.dirname(dir)
  }
}

/**
 * Delete authoring files from distDir. Returns posix paths relative to dist.
 * Does not modify publicDir.
 */
export function stripAuthoringFromDist(distDir, options = {}) {
  const minBytes = options.minBytes ?? MASTER_PNG_MIN_BYTES
  const root = options.root ?? null
  const publicDir = options.publicDir ?? (root ? path.join(root, 'public') : null)
  assertDistIsSafe(distDir, publicDir, root)
  const before = sourceFingerprints(publicDir)
  const published = publishedMasterNames(root, masterCandidates([publicDir, distDir], minBytes))
  const removed = []
  for (const file of walkFiles(distDir)) {
    const drop = isMarkdown(file) || isSourceOnlyMaster(file, published, minBytes)
    if (!drop) continue
    removed.push(relPosix(distDir, file))
    removeDistFile(distDir, file)
  }
  assertSourcesIntact(publicDir, before)
  removed.sort(byPath)
  return removed
}

/** Problems that should fail the build. Empty means dist is clean. */
export function authoringProblems(distDir, options = {}) {
  const minBytes = options.minBytes ?? MASTER_PNG_MIN_BYTES
  const root = options.root ?? null
  const publicDir = options.publicDir ?? (root ? path.join(root, 'public') : null)
  const problems = []
  if (!fs.existsSync(distDir)) {
    problems.push(`missing ${distDir}`)
    return problems
  }
  const published = publishedMasterNames(root, masterCandidates([publicDir, distDir], minBytes))
  for (const file of walkFiles(distDir)) {
    if (isMarkdown(file) || isSourceOnlyMaster(file, published, minBytes)) {
      problems.push(relPosix(distDir, file))
    }
  }
  if (publicDir && fs.existsSync(publicDir)) {
    const publicMd = walkFiles(publicDir).filter(isMarkdown)
    if (!publicMd.length) problems.push('public markdown sources are missing')
    for (const file of publicMd) {
      const rel = relPosix(publicDir, file)
      if (fs.existsSync(path.join(distDir, rel))) problems.push(`deployed ${rel}`)
    }
    for (const file of walkFiles(publicDir)) {
      if (!isSourceOnlyMaster(file, published, minBytes)) continue
      const rel = relPosix(publicDir, file)
      if (fs.existsSync(path.join(distDir, rel))) problems.push(`deployed ${rel}`)
    }
  }
  return [...new Set(problems)].sort(byPath)
}

/** Public markdown and source-only masters that are not in dist. */
export function excludedPublicAuthoring(distDir, options = {}) {
  const minBytes = options.minBytes ?? MASTER_PNG_MIN_BYTES
  const root = options.root ?? null
  const publicDir = options.publicDir ?? (root ? path.join(root, 'public') : null)
  if (!publicDir || !fs.existsSync(publicDir)) return []
  const published = publishedMasterNames(root, masterCandidates([publicDir, distDir], minBytes))
  const excluded = []
  for (const file of walkFiles(publicDir)) {
    if (!isMarkdown(file) && !isSourceOnlyMaster(file, published, minBytes)) continue
    const rel = relPosix(publicDir, file)
    if (!fs.existsSync(path.join(distDir, rel))) excluded.push(rel)
  }
  excluded.sort(byPath)
  return excluded
}

export function logExcluded(removed) {
  const md = removed.filter((file) => file.toLowerCase().endsWith('.md'))
  const png = removed.filter((file) => file.toLowerCase().endsWith('.png'))
  console.log(`strip-authoring-notes: excluded ${md.length} markdown file(s):`)
  for (const file of md) console.log(`strip-authoring-notes: excluded ${file}`)
  if (png.length) {
    console.log(`strip-authoring-notes: excluded ${png.length} source-only master PNG(s) over 5MB:`)
    for (const file of png) console.log(`strip-authoring-notes: excluded ${file}`)
  } else {
    console.log('strip-authoring-notes: no source-only master PNGs over 5MB to exclude')
  }
}

function writeBytes(file, size) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, Buffer.alloc(size, 1))
}

export function assertAuthoringFixtures() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'authoring-notes-'))
  try {
    const root = path.join(tmp, 'proj')
    const pub = path.join(root, 'public')
    const dist = path.join(root, 'dist')
    const minBytes = 50
    writeBytes(path.join(pub, 'maps/ex/NOTES.md'), 12)
    writeBytes(path.join(pub, 'content/raw-briefs/day.md'), 8)
    writeBytes(path.join(pub, 'data/web/territories/README.md'), 9)
    writeBytes(path.join(pub, 'maps/ex/source-master-3840.png'), 100)
    writeBytes(path.join(pub, 'maps/ex/used-master-3840.png'), 100)
    writeBytes(path.join(pub, 'maps/ex/page-master-3840.png'), 100)
    writeBytes(path.join(pub, 'maps/ex/small-master.png'), 10)
    writeBytes(path.join(pub, 'maps/ex/big-photo.png'), 100)
    writeBytes(path.join(pub, 'maps/ex/map.png'), 20)
    writeBytes(path.join(pub, 'content/stories/keep.json'), 4)
    fs.mkdirSync(path.join(root, 'src'), { recursive: true })
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
    fs.writeFileSync(path.join(root, 'index.html'), '<img src="/maps/ex/map.png">\n')
    fs.writeFileSync(
      path.join(root, 'src/route-maps.js'),
      "export const used = '/maps/ex/used-master-3840.png'\n",
    )
    fs.writeFileSync(
      path.join(root, 'scripts/gen.mjs'),
      "export const input = path.join(root, 'public/maps/ex/source-master-3840.png')\n",
    )
    fs.writeFileSync(
      path.join(root, 'scripts/page.mjs'),
      "export const url = '/maps/ex/page-master-3840.png'\n",
    )
    fs.cpSync(pub, dist, { recursive: true })
    writeBytes(path.join(dist, 'ONLY-IN-DIST.MD'), 4)
    writeBytes(path.join(dist, 'keep.txt'), 3)

    const notesHash = fingerprint(path.join(pub, 'maps/ex/NOTES.md'))
    const removed = stripAuthoringFromDist(dist, { root, publicDir: pub, minBytes })
    assert.deepEqual(removed, [
      'ONLY-IN-DIST.MD',
      'content/raw-briefs/day.md',
      'data/web/territories/README.md',
      'maps/ex/NOTES.md',
      'maps/ex/source-master-3840.png',
    ])
    assert.equal(fs.existsSync(path.join(dist, 'content/raw-briefs')), false)
    assert.equal(fs.existsSync(path.join(dist, 'content/stories/keep.json')), true)
    assert.equal(fs.existsSync(path.join(dist, 'maps/ex/used-master-3840.png')), true)
    assert.equal(fs.existsSync(path.join(dist, 'maps/ex/page-master-3840.png')), true)
    assert.equal(fs.existsSync(path.join(dist, 'maps/ex/small-master.png')), true)
    assert.equal(fs.existsSync(path.join(dist, 'maps/ex/big-photo.png')), true)
    assert.equal(fs.existsSync(path.join(dist, 'maps/ex/map.png')), true)
    assert.equal(fs.existsSync(path.join(dist, 'keep.txt')), true)
    assert.equal(fs.existsSync(path.join(pub, 'maps/ex/NOTES.md')), true)
    assert.equal(fs.existsSync(path.join(pub, 'maps/ex/source-master-3840.png')), true)
    assert.equal(fingerprint(path.join(pub, 'maps/ex/NOTES.md')), notesHash)
    assert.deepEqual(authoringProblems(dist, { root, publicDir: pub, minBytes }), [])

    writeBytes(path.join(dist, 'maps/ex/NOTES.md'), 4)
    const problems = authoringProblems(dist, { root, publicDir: pub, minBytes })
    assert.ok(problems.includes('maps/ex/NOTES.md'))
    assert.ok(problems.includes('deployed maps/ex/NOTES.md'))

    assert.throws(
      () => stripAuthoringFromDist(pub, { root, publicDir: pub, minBytes }),
      /refusing to strip the public source directory/,
    )

    const before = sourceFingerprints(pub)
    fs.unlinkSync(path.join(pub, 'content/raw-briefs/day.md'))
    assert.throws(() => assertSourcesIntact(pub, before), /source deleted: content\/raw-briefs\/day.md/)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  assertAuthoringFixtures()
  const dist = path.resolve(process.argv[2] || path.join(rootOfScript, 'dist'))
  const removed = stripAuthoringFromDist(dist, { root: rootOfScript })
  logExcluded(removed)
}
