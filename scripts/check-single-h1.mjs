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
const bad = []
for (const f of files) {
  // Ignore h1 text inside scripts and comments (templates for client rendering).
  const html = fs.readFileSync(f, 'utf8').replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
  const n = (html.match(/<h1[\s>]/gi) || []).length
  if (n > 1) bad.push(`${path.relative('dist', f)} has ${n} h1 elements`)
}
if (bad.length) {
  for (const b of bad) console.error('check-single-h1: ' + b)
  process.exit(1)
}
console.log(`check-single-h1: ${files.length} HTML pages have at most one h1`)
