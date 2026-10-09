#!/usr/bin/env node
/**
 * Fails the build when any HTML file in dist is missing the public GA4
 * measurement ID or the Consent Mode default. Runs after vite build and
 * prerender so homepage, privacy, about, stories, and layers are all checked.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GA_MEASUREMENT_ID, missingGaSnippet } from './gtag-snippet.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.resolve(process.argv[2] || path.join(root, 'dist'))

function htmlFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, ent.name)
    if (ent.isDirectory()) htmlFiles(file, out)
    else if (ent.name.endsWith('.html')) out.push(file)
  }
  return out
}

const files = htmlFiles(dist)
if (!files.length) {
  console.error(`check-ga: no HTML files in ${dist}`)
  process.exit(1)
}

const bad = []
for (const file of files) {
  const problems = missingGaSnippet(fs.readFileSync(file, 'utf8'))
  if (problems.length) bad.push({ file: path.relative(dist, file), problems })
}

if (bad.length) {
  for (const row of bad) console.error(`check-ga: ${row.file}: ${row.problems.join('; ')}`)
  console.error(`check-ga: ${bad.length} of ${files.length} HTML files failed`)
  process.exit(1)
}

console.log(`check-ga: ${files.length} HTML files include ${GA_MEASUREMENT_ID} and the consent default`)
