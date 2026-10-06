#!/usr/bin/env node
/**
 * Fail the build when public/data/app/*.json cannot decode on iOS builds 4 and 5.
 *
 *   node scripts/check-ota-types.mjs
 *   node scripts/check-ota-types.mjs --dir public/data/app
 *
 * Wired into `npm run build` and `npm run sync-app-data`.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkOtaPack } from './ota-types.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const dirFlag = argv.indexOf('--dir')
const dir = path.resolve(dirFlag >= 0 ? argv[dirFlag + 1] : path.join(HERE, '../public/data/app'))

const issues = checkOtaPack(dir)
if (issues.length) {
  console.error(`ota-types: ${issues.length} problem(s) in ${dir}`)
  for (const issue of issues) console.error(`  ${issue}`)
  process.exit(1)
}
console.log(`ota-types: ok (${dir})`)
