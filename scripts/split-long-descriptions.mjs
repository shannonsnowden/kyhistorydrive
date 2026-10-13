#!/usr/bin/env node
/**
 * Split long story / history descriptions into short paragraphs (blank line, "\n\n").
 * FORMATTING ONLY: words are never changed. Every edit is asserted to be identical to the
 * original with whitespace normalized; any mismatch aborts the build.
 *
 * Rules (deterministic, idempotent):
 * - A paragraph longer than MAX_WORDS words or MAX_SENTENCES sentences is split at sentence
 *   ends into paragraphs of about 2-4 sentences, preferring breaks before time/topic shifts
 *   ("In 1788 ...", "By 1830 ...", "Today ...", "After ...", "When ..."). No 1-sentence tail
 *   paragraphs under 15 words (they are merged back).
 * - Story bodyMarkdown: only the prose before the trailing "Source:" lines is touched.
 * - KHS marker inscriptions (verbatim): conservative; only a break before "(Reverse)".
 * - Hand-tuned splits: scripts/paragraph-overrides.json { "<file>#<id>": "text with \n\n" },
 *   used only if it is word-identical to the current text.
 * - Never breaks inside the "new" text of a story-overrides.json replace (keeps overrides
 *   matchable on the next build).
 *
 *   node scripts/split-long-descriptions.mjs          apply
 *   node scripts/split-long-descriptions.mjs --check  dry run; exit 2 if anything would change
 */
import fs from 'node:fs'
import path from 'node:path'
import { stripMdLinks } from './strip-md-links.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const CHECK = process.argv.includes('--check')
export const MAX_WORDS = 90
export const MAX_SENTENCES = 4

const ABBR = new Set(
  'mr mrs ms dr st mt ft gen col lt capt maj sgt gov rev jr sr co inc ltd corp bros no nos vol p pp ca c vs etc jan feb mar apr aug sept sep oct nov dec u.s ky va pa tenn ind ark ala miss mo ohio n.c s.c d.c a.m p.m e.g i.e hon pres sen rep adm cmdr cpl pvt messrs prof assn dept est approx fig rd hwy pk jct ave blvd sq twp ch bapt meth presb brig cf lieut adj supt atty ens esq gens cols bldg dist univ wm thos jas geo chas benj'
    .split(' '),
)
const CUE = /^(?:[“"‘(]?)(?:In|By|On|At|After|Before|During|When|While|Later|Today|Now|Since|From|Through|Until|Between|Within|Over|Around|About|Early|Late|Soon|Then|Years|Decades|Afterward|Afterwards|Eventually|Meanwhile|However|But|The\s+(?:map|house|site|town|story|lick|works|fort|battle|war|park|area|gorge|church|cemetery|marker|pin))\b/

const words = (s) => s.split(/\s+/).filter(Boolean).length
const norm = (s) => String(s).replace(/\s+/g, ' ').trim()

/** Sentence-end offsets (index just after the whitespace run that follows a sentence end). */
export function sentences(text) {
  const out = []
  const re = /([.!?])([”"’)\]]*)(\s+)(?=[“"‘(\[]?[A-Z0-9])/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    const end = m.index + 1 + m[2].length
    const before = text.slice(last, m.index)
    const tok = (before.match(/([A-Za-z.]+)$/) || [''])[0].toLowerCase()
    if (m[1] === '.') {
      if (/^[a-z]$/.test(tok)) continue // initials: "John A. Smith"
      if (ABBR.has(tok) || ABBR.has(tok.replace(/\.$/, ''))) continue
      if (/\.[a-z]$/.test(tok)) continue // "U.S", "D.C"
    }
    const next = text.slice(re.lastIndex)
    if (/^(?:\d+\.\s|[-*+#>]\s)/.test(next)) continue // would start a Markdown list/heading
    out.push(text.slice(last, end))
    last = re.lastIndex
  }
  out.push(text.slice(last))
  return out.map((s) => s.trim()).filter(Boolean)
}

function chunk(sents, forbidden) {
  const paras = []
  let cur = []
  const curWords = () => words(cur.join(' '))
  for (let i = 0; i < sents.length; i++) {
    cur.push(sents[i])
    const next = sents[i + 1]
    if (next == null) break
    if (forbidden(i)) continue
    const n = cur.length
    const w = curWords()
    const cue = CUE.test(next)
    if (n >= 4 || w >= 80 || (n >= 3 && (cue || w >= 55)) || (n >= 2 && cue && w >= 40)) {
      paras.push(cur)
      cur = []
    }
  }
  if (cur.length) {
    if (paras.length && cur.length === 1 && words(cur[0]) < 15) paras[paras.length - 1].push(...cur)
    else paras.push(cur)
  }
  return paras.map((p) => p.join(' '))
}

/** Split one paragraph; returns it unchanged if short. */
function splitParagraph(p, protectedSpans) {
  const flat = p.trim()
  if (words(flat) <= MAX_WORDS && sentences(flat).length <= MAX_SENTENCES) return p
  if (/\n/.test(flat)) return p // keeps single-line breaks (lists, verse) as authored
  const sents = sentences(flat)
  if (sents.length < 3) return p
  // boundary i is after sents[i]; forbidden if inside a protected span
  const offs = []
  let pos = 0
  for (const s of sents) {
    pos = flat.indexOf(s, pos) + s.length
    offs.push(pos)
  }
  const spans = protectedSpans.flatMap((t) => {
    const r = []
    let k = flat.indexOf(t)
    while (k >= 0) { r.push([k, k + t.length]); k = flat.indexOf(t, k + 1) }
    return r
  })
  const forbidden = (i) => spans.some(([a, b]) => offs[i] > a && offs[i] < b)
  return chunk(sents, forbidden).join('\n\n')
}

export function splitText(text, { protectedSpans = [] } = {}) {
  const s = String(text || '')
  if (!s.trim()) return s
  return s
    .split(/\n{2,}/)
    .map((p) => splitParagraph(p, protectedSpans))
    .join('\n\n')
}

/** Story body: split prose, keep trailing Source: lines exactly. */
export function splitStoryBody(md, opts) {
  const s = String(md || '')
  const k = s.search(/\n\s*Source:\s/)
  const prose = k >= 0 ? s.slice(0, k) : s
  const tail = k >= 0 ? s.slice(k) : ''
  return splitText(prose, opts) + tail
}

/** Marker inscriptions are verbatim KHS text: only break before the reverse side. */
export function splitInscription(s) {
  const t = String(s || '')
  if (words(t) <= MAX_WORDS) return t
  return t.replace(/([.!?”"’)])[ \t]+(?=\(Reverse\))/g, '$1\n\n')
}

// ---------------------------------------------------------------------------------------------
function main() {
  const overridesPath = path.join(ROOT, 'scripts/story-overrides.json')
  const ov = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')).overrides || {} : {}
  const protectFor = (slug) => (ov[slug]?.replace || []).map((r) => r.new).filter((t) => /[.!?]\s/.test(t))
  const hpPath = path.join(ROOT, 'scripts/paragraph-overrides.json')
  const hand = fs.existsSync(hpPath) ? JSON.parse(fs.readFileSync(hpPath, 'utf8')).overrides || {} : {}

  const counts = {}
  const bad = []
  const fix = (key, type, before, fn) => {
    if (typeof before !== 'string' || !before) return before
    let after = hand[key] != null && norm(hand[key]) === norm(before) ? hand[key] : fn(before)
    if (norm(after) !== norm(before)) { bad.push(key); return before }
    if (after !== before) counts[type] = (counts[type] || 0) + 1
    return after
  }
  const writeJson = (fp, data, raw) => {
    const indent = /^[[{]\r?\n {2}/.test(raw) ? 2 : 0
    const out = JSON.stringify(data, null, indent) + (raw.endsWith('\n') ? '\n' : '')
    if (out !== raw) pending.push([fp, out])
    return out !== raw
  }
  let dirty = 0
  const pending = []

  // stories (timeline) — source of truth
  const sdir = path.join(ROOT, 'public/content/stories')
  for (const f of fs.readdirSync(sdir).filter((x) => x.endsWith('.json')).sort()) {
    const fp = path.join(sdir, f)
    const raw = fs.readFileSync(fp, 'utf8')
    const d = JSON.parse(raw)
    d.bodyMarkdown = fix(`stories/${f}`, 'story', d.bodyMarkdown, (t) => splitStoryBody(t, { protectedSpans: protectFor(d.slug) }))
    dirty += writeJson(fp, d, raw)
  }
  // app (OTA) + derived layer files: history / description prose; inscriptions verbatim rule
  const app = (n) => `public/data/app/${n}`
  const lists = [
    [app('ky-history.json'), 'history', ['history', 'description']],
    [app('industrial-sites.json'), 'industry', ['history', 'description']],
    [app('newspapers.json'), 'newspaper', ['history', 'description']],
    [app('markers.phase1.json'), 'marker', ['inscription']],
  ]
  for (const [rel, type, fields] of lists) {
    const fp = path.join(ROOT, rel)
    if (!fs.existsSync(fp)) continue
    const raw = fs.readFileSync(fp, 'utf8')
    const d = JSON.parse(raw)
    const arr = Array.isArray(d) ? d : null
    if (!arr) continue
    arr.forEach((e, i) => {
      for (const k of fields) {
        const id = e.id || e.marker_number || i
        if (k !== 'inscription' && typeof e[k] === 'string') {
          const s = stripMdLinks(e[k])
          if (s !== e[k]) { counts['link-strip'] = (counts['link-strip'] || 0) + 1; e[k] = s }
        }
        e[k] = fix(`${rel}#${id}.${k}`, type, e[k], k === 'inscription' ? splitInscription : (t) => splitText(t))
      }
    })
    dirty += writeJson(fp, d, raw)
  }
  const ldir = path.join(ROOT, 'public/data/layers')
  const geos = fs.readdirSync(ldir).filter((x) => x.endsWith('.geojson')).map((x) => `public/data/layers/${x}`)
  geos.push('public/data/markers.geojson')
  for (const rel of geos) {
    const fp = path.join(ROOT, rel)
    if (!fs.existsSync(fp)) continue
    const raw = fs.readFileSync(fp, 'utf8')
    const d = JSON.parse(raw)
    for (const ft of d.features || []) {
      const p = ft.properties || {}
      const id = p.id || p.slug || p.marker_number
      for (const k of ['history', 'description', 'inscription', 'bodyMarkdown']) {
        if (typeof p[k] !== 'string') continue
        if (k === 'history' || k === 'description') {
          const s = stripMdLinks(p[k])
          if (s !== p[k]) { counts['link-strip'] = (counts['link-strip'] || 0) + 1; p[k] = s }
        }
        const fn = k === 'inscription' ? splitInscription : k === 'bodyMarkdown' ? (t) => splitStoryBody(t) : (t) => splitText(t)
        p[k] = fix(`${rel}#${id}.${k}`, `layer:${path.basename(rel, '.geojson')}`, p[k], fn)
      }
    }
    dirty += writeJson(fp, d, raw)
  }

  if (bad.length) {
    console.error(`split-long-descriptions: word-identity check FAILED for ${bad.length} entr(ies): ${bad.slice(0, 10).join(', ')}`)
    process.exit(1)
  }
  if (!CHECK) for (const [fp, out] of pending) fs.writeFileSync(fp, out)
  const summary = Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'
  console.log(`split-long-descriptions: ${CHECK ? 'would split' : 'split'}: ${summary}; word-identity check passed`)
  if (CHECK && dirty) process.exit(2)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
