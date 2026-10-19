#!/usr/bin/env node
/**
 * Security (#330): with KHD_ROADS_RAILS off, the Roads & Rails page-only assets must not ship.
 * Runs right after `vite build` (which copies public/ into dist/) and removes ROADS_RAILS_ASSETS
 * from dist/. With KHD_ROADS_RAILS=1 it leaves them in place. The sources stay in public/.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROADS_RAILS_ASSETS, ROADS_RAILS_FLAG, roadsRailsEnabled } from './roads-rails-flag.mjs'

const dist = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'dist')
if (roadsRailsEnabled()) {
  console.log(`prune-roads-rails-assets: ${ROADS_RAILS_FLAG}=1; kept ${ROADS_RAILS_ASSETS.join(', ')}`)
  process.exit(0)
}
const removed = []
for (const rel of ROADS_RAILS_ASSETS) {
  const target = path.resolve(dist, rel)
  if (!target.startsWith(dist + path.sep)) throw new Error(`prune-roads-rails-assets: ${rel} is outside dist`)
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true })
    removed.push(rel)
  }
}
console.log(`prune-roads-rails-assets: ${ROADS_RAILS_FLAG} is off; removed ${removed.length ? removed.join(', ') : 'nothing'} from dist`)
