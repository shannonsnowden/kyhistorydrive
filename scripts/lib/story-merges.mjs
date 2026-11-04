/** Story merges (v2 Phase 2, #337): retired slug -> kept slug. Shared by build checks and protection. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SLUG = /^[a-z0-9-]+$/

let cached = null
export function loadMerges(root = ROOT) {
  if (cached && root === ROOT) return cached
  let merges = []
  try {
    merges = JSON.parse(fs.readFileSync(path.join(root, 'data/story-merges.json'), 'utf8')).merges || []
  } catch (_) {}
  if (root === ROOT) cached = merges
  return merges
}

export function storyFileExists(slug, root = ROOT) {
  return SLUG.test(slug) && fs.existsSync(path.join(root, 'public/content/stories', `${slug}.json`))
}

/** Errors (empty = valid): bad slugs, duplicate sources, self, chains, loops, dead targets, retired page still present. */
export function validateMerges(merges, { storyExists = (s) => storyFileExists(s) } = {}) {
  const errs = []
  const retired = new Map()
  for (const m of merges || []) {
    const r = m?.retired
    const k = m?.kept
    if (!SLUG.test(String(r || '')) || !SLUG.test(String(k || ''))) { errs.push(`bad slug: ${JSON.stringify(m)}`); continue }
    if (r === k) errs.push(`self redirect: ${r}`)
    if (retired.has(r)) errs.push(`duplicate source: ${r}`)
    retired.set(r, k)
  }
  for (const [r, k] of retired) {
    if (retired.has(k)) {
      const seen = new Set([r])
      let cur = k
      while (retired.has(cur) && !seen.has(cur)) { seen.add(cur); cur = retired.get(cur) }
      errs.push(seen.has(cur) ? `redirect loop: ${r}` : `redirect chain: ${r} -> ${k} -> ${retired.get(k)}`)
    }
    if (!storyExists(k)) errs.push(`dead target: ${r} -> ${k}`)
    if (storyExists(r)) errs.push(`retired story still exists: ${r}`)
  }
  return errs
}

/** Amplify console block (f): slashless and slash sources, final targets, 301. */
export function buildRedirectBlock(merges) {
  const out = []
  for (const { retired, kept } of merges) {
    const target = `/stories/${kept}/`
    out.push({ source: `/stories/${retired}`, target, status: '301', condition: null })
    out.push({ source: `/stories/${retired}/`, target, status: '301', condition: null })
  }
  return out
}

export function keptFor(slug, merges = loadMerges()) {
  const hit = (merges || []).find((m) => m.retired === slug)
  return hit ? hit.kept : slug
}

/** A kept page is protected if it, or any story merged into it, was protected. */
export function protectedAfterMerge(slug, merges, isProtectedSlug) {
  if (isProtectedSlug(slug)) return true
  return (merges || []).some((m) => m.kept === slug && isProtectedSlug(m.retired))
}

/**
 * Compare amplify.yml customRules with the block (f) rules. Returns a list of problems:
 * a block rule missing from amplify.yml, a wrong target/status, or a rule placed below a /<*> catch-all.
 */
export function diffAmplifyBlock(amplifyText, block) {
  const rules = []
  const re = /-\s*source:\s*'([^']*)'\s*\n\s*target:\s*'([^']*)'\s*\n\s*status:\s*'([^']*)'/g
  let m
  while ((m = re.exec(amplifyText))) rules.push({ source: m[1], target: m[2], status: m[3] })
  const errs = []
  const firstCatchAll = rules.findIndex((r) => r.source === '/<*>')
  for (const b of block) {
    const i = rules.findIndex((r) => r.source === b.source)
    if (i < 0) { errs.push(`amplify.yml is missing ${b.source} -> ${b.target}`); continue }
    const r = rules[i]
    if (r.target !== b.target || String(r.status) !== String(b.status)) {
      errs.push(`amplify.yml ${b.source} -> ${r.target} (${r.status}) but block f says ${b.target} (${b.status})`)
    }
    if (firstCatchAll >= 0 && i > firstCatchAll) errs.push(`amplify.yml ${b.source} sits below the /<*> catch-all`)
  }
  const blockSources = new Set(block.map((b) => b.source))
  for (const r of rules) {
    if (/^\/stories\//.test(r.source) && !blockSources.has(r.source) && blockSources.has(r.source.replace(/\/?$/, '/'))) {
      errs.push(`amplify.yml has ${r.source}, which block f does not list`)
    }
  }
  return errs
}
