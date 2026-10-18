#!/usr/bin/env node
/**
 * Every portrait in public/people/portraits/ that has a -512 image must also ship the -96
 * thumbnail in the same format (src/related-people.js thumb96 swaps -512 for -96 in related boxes).
 * A missing -96 shows as a broken headshot, so fail the build. Also fails when a -96 has no -512.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'public/people/portraits')
const files = new Set(fs.readdirSync(dir))
const errors = []
let n = 0
for (const f of files) {
  const m = f.match(/^(.+)-512\.(webp|jpg)$/)
  if (m) {
    n++
    if (!files.has(`${m[1]}-96.${m[2]}`)) errors.push(`missing ${m[1]}-96.${m[2]} (thumbnail of ${f})`)
  }
  const t = f.match(/^(.+)-96\.(webp|jpg)$/)
  if (t && !files.has(`${t[1]}-512.${t[2]}`)) errors.push(`orphan ${f} (no ${t[1]}-512.${t[2]})`)
}
if (errors.length) {
  console.error(`check-portrait-thumbs: ${errors.length} problem(s):\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-portrait-thumbs: ok (${n} -512 portraits, each with a -96 thumbnail)`)
