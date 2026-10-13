#!/usr/bin/env node
/**
 * Fails the build when the public contact address, or an entity-encoded
 * copy of it, is present in any built HTML or JSON file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.resolve(process.argv[2] || path.join(root, 'dist'))
const PLAIN = 'contact@kyhistorydrive.com'
const ENTITY = /contact(?:&#0*64;|&#[xX]0*40;|&commat;|%40)kyhistorydrive\.com/gi

function files(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, ent.name)
    if (ent.isDirectory()) files(file, out)
    else if (ent.name.endsWith('.html') || ent.name.endsWith('.json')) out.push(file)
  }
  return out
}

function hits(text) {
  const found = []
  const plain = text.toLowerCase().indexOf(PLAIN)
  if (plain !== -1) found.push(PLAIN)
  ENTITY.lastIndex = 0
  const encoded = text.match(ENTITY)
  if (encoded) found.push(...encoded)
  return found
}

const list = files(dist)
if (!list.length) {
  console.error(`check-contact: no HTML or JSON files in ${dist}`)
  process.exit(1)
}

const bad = []
for (const file of list) {
  const found = hits(fs.readFileSync(file, 'utf8'))
  if (found.length) bad.push({ file: path.relative(dist, file), found: [...new Set(found)] })
}

if (bad.length) {
  for (const row of bad) console.error(`check-contact: ${row.file}: ${row.found.join(', ')}`)
  console.error(`check-contact: ${bad.length} of ${list.length} HTML/JSON files include the contact address`)
  process.exit(1)
}

console.log(`check-contact: ${list.length} HTML and JSON files omit ${PLAIN}`)
