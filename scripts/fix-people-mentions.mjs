#!/usr/bin/env node
/**
 * #337: a person named in full in a story belongs in that person's people.json `stories` list
 * (people pages and related boxes otherwise undercount). Full name = `name` or an alias with 2+ words,
 * matched on word boundaries in the story title and body. Never removes links.
 *   node scripts/fix-people-mentions.mjs           report unlinked mentions, exit 1 if any
 *   node scripts/fix-people-mentions.mjs --write   add them to data/people.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function fullNames(person) {
  const names = [person.name, ...(person.aliases || [])].map((n) => String(n || '').trim())
  return [...new Set(names.filter((n) => n.split(/\s+/).length >= 2))]
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export function mentions(text, person) {
  return fullNames(person).some((n) => new RegExp(`(^|[^\\p{L}])${esc(n).replace(/\\?\s+/g, '\\s+')}(?![\\p{L}])`, 'u').test(text))
}

export function findUnlinked(people, stories, exceptions = {}) {
  const out = []
  for (const p of people) {
    const have = new Set([...(p.stories || []), ...Object.keys(exceptions[p.id] || {})])
    for (const s of stories) if (!have.has(s.slug) && mentions(`${s.title}\n${s.bodyMarkdown || ''}`, p)) out.push({ id: p.id, slug: s.slug })
  }
  return out
}

function main() {
  const file = path.join(ROOT, 'data/people.json')
  const raw = fs.readFileSync(file, 'utf8')
  const data = JSON.parse(raw)
  const dir = path.join(ROOT, 'public/content/stories')
  const stories = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ slug: f.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }))
  const exceptions = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/people-mention-exceptions.json'), 'utf8')).exceptions || {}
  const found = findUnlinked(data.people, stories, exceptions)
  if (process.argv.includes('--write')) {
    const byId = new Map(data.people.map((p) => [p.id, p]))
    for (const { id, slug } of found) (byId.get(id).stories ||= []).push(slug)
    fs.writeFileSync(file, JSON.stringify(data, null, /^\{\n( +)/.exec(raw)?.[1].length || 2) + '\n')
    console.log(`fix-people-mentions: linked ${found.length} mention(s) across ${new Set(found.map((f) => f.id)).size} people`)
    return
  }
  if (found.length) {
    console.error(`fix-people-mentions: ${found.length} unlinked full-name mention(s):\n  ${found.map((f) => `${f.id} <- ${f.slug}`).join('\n  ')}\nRun node scripts/fix-people-mentions.mjs --write`)
    process.exit(1)
  }
  console.log('fix-people-mentions: OK (every full-name mention is linked)')
}
if (import.meta.url === `file://${process.argv[1]}`) main()
