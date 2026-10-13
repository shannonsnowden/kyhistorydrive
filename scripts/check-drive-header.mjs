#!/usr/bin/env node
/** Fails the build if any built /drives/ page lacks the shared site header, nav or chrome script. */
import fs from 'node:fs'
import path from 'node:path'

const dir = path.join('dist', 'drives')
const files = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name)
    if (e.isDirectory()) walk(f)
    else if (e.name.endsWith('.html')) files.push(f)
  }
})(dir)
const errors = []
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8')
  const rel = '/' + path.relative('dist', f).replace(/index\.html$/, '')
  const need = [
    [/<header class="top site-header">/, 'site header'],
    [/<nav id="mainNav"/, 'primary nav'],
    [/id="siteSearchInput"/, 'search'],
    [/data-theme-toggle/, 'theme toggle'],
    [/href="\/drives\/" data-route="drives" class="active" aria-current="page"/, 'Drives marked active'],
    [/getElementById\('navMenuToggle'\)/, 'menu/theme script'],
    [/@import url\("\/[^"]+\.css"\) layer\(site\)/, 'site stylesheet'],
  ]
  if (rel === '/drives/build/') need.push([/<p class="drive-back"><a href="\/drives\/">← Back to all drives<\/a>/, 'Back to all drives link'])
  else if (rel !== '/drives/') {
    need.push([/<p class="drive-back drive-back-phone"><a href="\/drives\/">← Back to all drives<\/a>/, 'phone Back to all drives link'])
    need.push([/<a href="\/drives\/">All drives<\/a>/i, 'All drives breadcrumb'])
  }
  if ((html.match(/<h1[\s>]/g) || []).length > 1) errors.push(`${rel} has more than one h1`)
  for (const [re, what] of need) if (!re.test(html)) errors.push(`${rel} is missing the ${what}`)
}
if (files.length < 26) errors.push(`expected at least 26 /drives/ pages, found ${files.length}`)
if (errors.length) {
  for (const e of errors) console.error('check-drive-header: ' + e)
  process.exit(1)
}
console.log(`check-drive-header: ${files.length} /drives/ pages carry the site header, nav and back link`)
