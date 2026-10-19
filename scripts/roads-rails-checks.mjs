#!/usr/bin/env node
/**
 * Roads & Rails build checks, run only with KHD_ROADS_RAILS=1 (the page left the live site on Oct 19).
 *   node scripts/roads-rails-checks.mjs pre   -> source tests (before vite build)
 *   node scripts/roads-rails-checks.mjs post  -> dist checks (after prerender)
 * With the flag off it prints what it skipped, so the default build stays green without the page.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROADS_RAILS_FLAG, roadsRailsEnabled } from './roads-rails-flag.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const PHASES = {
  pre: ['test-transport-timeline.mjs', 'test-transport-rows.mjs'],
  post: ['check-transport-links.mjs', 'check-transport-sections.mjs', 'check-transport-tick-hits.mjs'],
}
const phase = process.argv[2]
if (!PHASES[phase]) {
  console.error(`roads-rails-checks: phase must be one of ${Object.keys(PHASES).join(', ')}`)
  process.exit(2)
}
if (!roadsRailsEnabled()) {
  console.log(`roads-rails-checks ${phase}: ${ROADS_RAILS_FLAG} is off; skipped ${PHASES[phase].join(', ')}`)
  process.exit(0)
}
for (const script of PHASES[phase]) {
  const r = spawnSync(process.execPath, [path.join(here, script)], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
