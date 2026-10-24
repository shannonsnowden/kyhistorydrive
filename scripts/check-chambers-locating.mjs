#!/usr/bin/env node
/** #348 Editor ruling: the built Chambers Site page stays county level (no river, ridge, refuge or pit terms). */
import fs from 'node:fs'

export const LOCATING_TERMS = [/clarks[\s-]+river/i, /middle fork/i, /ridge ?top/i, /refuge/i, /borrow pit/i, /south-?west(ern)? part/i, /\bsouthwest/i, /bridge[\s-]+replacement/i]

export function locatingProblems(html) {
  return LOCATING_TERMS.filter((re) => re.test(html)).map((re) => re.source)
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href
if (isMain) {
  if (process.argv.includes('--self-test')) {
    const bad = locatingProblems('<meta content="on a ridgetop above the Middle Fork of Clarks River"><img alt="Clarks River National Wildlife Refuge"> a borrow pit for a bridge replacement, cemetery in its southwestern part')
    if (bad.length !== 8) throw new Error(`check-chambers-locating self-test: expected 8, got ${bad.length}`)
    if (locatingProblems('<p>in Marshall County</p>').length) throw new Error('check-chambers-locating self-test: false positive')
    console.log('check-chambers-locating: self-test ok')
  } else {
    const files = ['dist/stories/chambers-site-15ml109-marshall-county/index.html', 'dist/stories/chambers-site-15ml109-marshall-county/story.md']
    const problems = []
    for (const f of files) {
      if (!fs.existsSync(f)) { problems.push(`${f} missing`); continue }
      for (const p of locatingProblems(fs.readFileSync(f, 'utf8'))) problems.push(`${f}: ${p}`)
    }
    if (problems.length) {
      console.error(`check-chambers-locating: Chambers must stay county level:\n  ${problems.join('\n  ')}`)
      process.exit(1)
    }
    console.log('check-chambers-locating: Chambers page is county level only')
  }
}
