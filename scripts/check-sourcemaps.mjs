#!/usr/bin/env node
/**
 * Fails the build when Vite is configured to emit source maps or when any
 * .map file landed in dist. Published bundles stay unmapped.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.resolve(process.argv[2] || path.join(root, 'dist'))
const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error(`check-sourcemaps: ${msg}`)
}

const vite = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8')
if (!/sourcemap:\s*false/.test(vite)) fail('vite build.sourcemap is not false')

function maps(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, ent.name)
    if (ent.isDirectory()) maps(file, out)
    else if (ent.name.endsWith('.map')) out.push(path.relative(dist, file))
  }
  return out
}

if (!fs.existsSync(dist)) fail(`missing ${dist}`)
else {
  const found = maps(dist)
  for (const file of found) fail(file)
  if (found.length) fail(`${found.length} .map file(s) in dist`)
}

if (failures.length) process.exit(1)
console.log('check-sourcemaps: no .map files in dist')
