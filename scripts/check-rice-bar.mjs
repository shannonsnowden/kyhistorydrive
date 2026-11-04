#!/usr/bin/env node
/**
 * Approvals 112 A1. Scan every story in public/content/stories.json against the
 * Father David Rice template bar and write reports/rice-bar.md plus reports/rice-bar.json.
 *
 * Soft by default (exit 0) so the current corpus does not block a merge.
 * Fail the build on hard gaps with: RICE_BAR=strict node scripts/check-rice-bar.mjs
 * or: node scripts/check-rice-bar.mjs --strict
 * scripts/rice-bar-allowlist.json exempts listed slugs in strict mode only.
 * Informational gaps (350–450 depth, people links, story links, place photo) never fail.
 * The template story fails this command in either mode if it loses Kentucky today,
 * named sources, or the 150-word floor.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { riceBarStrict, runRiceBarCheck } from './lib/rice-bar.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let code = 1
try {
  code = runRiceBarCheck({ root, strict: riceBarStrict(process.env, process.argv.slice(2)) })
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  code = 1
}
process.exit(code)
