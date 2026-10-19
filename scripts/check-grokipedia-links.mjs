#!/usr/bin/env node
/**
 * Content-based check for Grokipedia links (daily packs; network, not part of npm run build).
 * Status codes are not enough: a missing article can still render a page, and a real article can be
 * the wrong subject (Grokipedia "Roundhead" is the English Civil War faction, "James_Winchester" a
 * football player). For each grokipedia.com/page/... link in the given story/research JSON files this
 * fetches the page, fails on a 404 or an "Article Not Found" page, and prints the article title and
 * first sentence so the author confirms the subject matches the linked phrase.
 * Usage: node scripts/check-grokipedia-links.mjs public/content/stories/<slug>.json [...more files]
 */
import fs from 'node:fs'

const files = process.argv.slice(2)
if (!files.length) {
  console.error('usage: check-grokipedia-links.mjs <story-or-research.json> [...]')
  process.exit(2)
}
const LINK = /https:\/\/grokipedia\.com\/page\/(?:[^\s()"\]]|\([^\s)"]*\))+/g
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const links = new Map()
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  for (const m of text.matchAll(LINK)) {
    const before = text.slice(Math.max(0, m.index - 120), m.index)
    const phrase = (before.match(/\[([^\]]+)\]\($/) || [])[1] || ''
    if (!links.has(m[0])) links.set(m[0], { files: new Set(), phrase })
    links.get(m[0]).files.add(f)
  }
}
let bad = 0
for (const [url, info] of links) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 kyhistorydrive-linkcheck' } })
  const html = await res.text()
  const title = ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '').replace(/\s*—\s*Grokipedia\s*$/, '').trim()
  const body = strip(html)
  const at = body.indexOf('Fact-checked by Grok')
  const lead = at >= 0 ? body.slice(at).replace(/^Fact-checked by Grok · [^·]*? ago\s*/, '').slice(0, 160) : ''
  const missing = res.status !== 200 || /Article Not Found/i.test(title + ' ' + body.slice(0, 2000)) || !lead
  if (missing) bad++
  console.log(`${missing ? 'MISSING' : 'ok     '} ${url}\n         link text: "${info.phrase}" | article: "${title}"\n         lead: ${lead || '(none)'}`)
}
console.log(`check-grokipedia-links: ${links.size} link(s), ${bad} missing. Confirm each article's subject matches its link text.`)
process.exit(bad ? 1 : 0)
