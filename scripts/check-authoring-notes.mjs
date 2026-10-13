#!/usr/bin/env node
/**
 * Fails the build when a markdown file, or a source-only master PNG over 5MB,
 * is present in dist/. Source notes under public/ must still be on disk.
 *
 * Usage: node scripts/check-authoring-notes.mjs [dist]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertAuthoringFixtures,
  authoringProblems,
  excludedPublicAuthoring,
  isMasterPng,
  isMarkdown,
} from './strip-authoring-notes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.resolve(process.argv[2] || path.join(root, 'dist'))

assertAuthoringFixtures()

const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error(`check-authoring-notes: ${msg}`)
}

for (const problem of authoringProblems(dist, { root })) fail(problem)

const publicDir = path.join(root, 'public')
if (!fs.existsSync(publicDir)) fail('public/ is missing')

if (failures.length) process.exit(1)

const excluded = excludedPublicAuthoring(dist, { root })
const md = excluded.filter((file) => isMarkdown(file))
const png = excluded.filter((file) => isMasterPng(file))
console.log('check-authoring-notes: no .md files in dist')
console.log('check-authoring-notes: no source-only master PNGs over 5MB in dist')
console.log(`check-authoring-notes: excluded ${md.length} markdown file(s) from dist:`)
for (const file of md) console.log(`check-authoring-notes: excluded ${file}`)
if (png.length) {
  console.log(`check-authoring-notes: excluded ${png.length} source-only master PNG(s) over 5MB from dist:`)
  for (const file of png) console.log(`check-authoring-notes: excluded ${file}`)
} else {
  console.log('check-authoring-notes: no source-only master PNGs over 5MB were in public/')
}
