#!/usr/bin/env node
/**
 * Amplify redirect block (f) for the story merges (#337).
 *   --write  regenerate docs/redirects/block-f-merges.json from data/story-merges.json
 *   default  fail on chains, loops, dead targets, a retired page still built, or a stale block file
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadMerges, validateMerges, buildRedirectBlock, diffAmplifyBlock } from './lib/story-merges.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs/redirects/block-f-merges.json')
const merges = loadMerges()
const errs = validateMerges(merges)
if (errs.length) {
  console.error(`build-merge-redirects: ${errs.length} problem(s)\n  ${errs.join('\n  ')}`)
  process.exit(1)
}
const text = JSON.stringify(buildRedirectBlock(merges), null, 1) + '\n'
if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, text)
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${merges.length} merges, ${merges.length * 2} rules)`)
} else {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (cur !== text) {
    console.error('build-merge-redirects: docs/redirects/block-f-merges.json is stale; run node scripts/build-merge-redirects.mjs --write')
    process.exit(1)
  }
  const amp = diffAmplifyBlock(fs.readFileSync(path.join(ROOT, 'amplify.yml'), 'utf8'), JSON.parse(text))
  if (amp.length) {
    console.error(`build-merge-redirects: amplify.yml and block-f-merges.json disagree\n  ${amp.join('\n  ')}`)
    process.exit(1)
  }
  console.log(`build-merge-redirects: OK (amplify.yml in sync)`)
  console.log(`build-merge-redirects: OK (${merges.length} merges, ${merges.length * 2} rules, no chains/loops/dead targets)`)
}
