#!/usr/bin/env node
/** Fails the build if any built HTML page has more than one <h1> (the header title is a <p> off the homepage). */
import fs from 'node:fs'
import path from 'node:path'

const files = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name)
    if (e.isDirectory()) walk(f)
    else if (e.name.endsWith('.html')) files.push(f)
  }
})('dist')
/** Count <h1 openings outside <script>…</script> and <!-- … --> blocks, scanning with indexOf (no tag regex). */
function countH1(html) {
  const lower = html.toLowerCase()
  let n = 0
  let i = 0
  while (i < lower.length) {
    const lt = lower.indexOf('<', i)
    if (lt < 0) break
    if (lower.startsWith('<!--', lt)) {
      const end = lower.indexOf('-->', lt + 4)
      i = end < 0 ? lower.length : end + 3
    } else if (lower.startsWith('<script', lt) && !/[a-z0-9-]/.test(lower[lt + 7] || '')) {
      const end = lower.indexOf('</script', lt + 7)
      i = end < 0 ? lower.length : end + 8
    } else {
      if (lower.startsWith('<h1', lt) && /[\s>\/]/.test(lower[lt + 3] || '')) n++
      i = lt + 1
    }
  }
  return n
}

const bad = []
for (const f of files) {
  // Ignore h1 text inside scripts and comments (templates for client rendering).
  const n = countH1(fs.readFileSync(f, 'utf8'))
  if (n > 1) bad.push(`${path.relative('dist', f)} has ${n} h1 elements`)
}
if (bad.length) {
  for (const b of bad) console.error('check-single-h1: ' + b)
  process.exit(1)
}
console.log(`check-single-h1: ${files.length} HTML pages have at most one h1`)
