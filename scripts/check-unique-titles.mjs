#!/usr/bin/env node
/**
 * v2 Phase 5 (#340) gate: every indexable built page has a unique <title> and a unique <h1>.
 * Pages with a robots noindex meta are skipped (they are not competing in search).
 * Linear indexOf scans only, no backtracking regex on page bodies.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
function tagText(html, tag) {
  const lower = html.toLowerCase()
  let i = 0
  while (i < lower.length) {
    const at = lower.indexOf(`<${tag}`, i)
    if (at < 0) return ''
    const next = lower[at + tag.length + 1] || ''
    if (next === '>' || /\s/.test(next)) {
      const open = lower.indexOf('>', at)
      const close = lower.indexOf(`</${tag}>`, open)
      if (open < 0 || close < 0) return ''
      return decode(html.slice(open + 1, close).replace(/<[^>]{0,500}>/g, '')).replace(/\s+/g, ' ').trim()
    }
    i = at + 1
  }
  return ''
}
function isNoindex(html) {
  const lower = html.toLowerCase()
  const at = lower.indexOf('<meta name="robots"')
  if (at < 0) return false
  const end = lower.indexOf('>', at)
  return lower.slice(at, end).includes('noindex')
}

/** pages: [{ file, html }] -> list of problem strings. */
export function uniqueTitleProblems(pages) {
  const seen = { title: new Map(), h1: new Map() }
  for (const { file, html } of pages) {
    if (isNoindex(html)) continue
    for (const tag of ['title', 'h1']) {
      const text = tagText(html, tag)
      if (!text) continue
      if (!seen[tag].has(text)) seen[tag].set(text, [])
      seen[tag].get(text).push(file)
    }
  }
  const problems = []
  for (const tag of ['title', 'h1']) {
    for (const [text, files] of seen[tag]) {
      if (files.length > 1) problems.push(`duplicate ${tag} "${text}": ${files.join(', ')}`)
    }
  }
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pages = []
  ;(function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) walk(f)
      else if (e.name === 'index.html') pages.push({ file: path.relative('dist', f), html: fs.readFileSync(f, 'utf8') })
    }
  })('dist')
  const problems = uniqueTitleProblems(pages)
  if (problems.length) {
    console.error(`check-unique-titles: ${problems.length} problem(s)\n${problems.join('\n')}`)
    process.exit(1)
  }
  console.log(`check-unique-titles: ${pages.length} pages, indexable titles and h1s are unique`)
}
