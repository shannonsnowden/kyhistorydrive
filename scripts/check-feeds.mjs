#!/usr/bin/env node
/**
 * Fails the build when dist RSS is missing, not well-formed, or short a
 * required channel or item field. Also checks the homepage, story pages,
 * and robots.txt against the feeds this build actually published.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateDist } from './rss-feed.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.resolve(process.argv[2] || path.join(root, 'dist'))

try {
  const plan = validateDist(root, dist)
  const skipped = plan.layers.filter((layer) => layer.skip).map((layer) => layer.outPath)
  console.log(
    `check-feeds: /feed.xml ok (${plan.stories.items.length} items)` +
      (skipped.length ? `; skipped ${skipped.join(', ')}` : ''),
  )
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
}
