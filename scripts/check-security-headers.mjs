#!/usr/bin/env node
/**
 * Fails the build when a customHttp.yml pattern drops one of the six security
 * headers or changes its value. Specific Amplify patterns do not inherit '**',
 * so each block is checked on its own. Fixtures prove a weakened HSTS max-age
 * in one block, and a /feed.xml block missing X-Frame-Options, both fail.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://fundingchoicesmessages.google.com https://googleads.g.doubleclick.net https://*.gstatic.com https://adservice.google.com https://*.adtrafficquality.google; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com https://*.googlesyndication.com https://*.g.doubleclick.net https://*.gstatic.com https://fundingchoicesmessages.google.com https://www.google.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://upload.wikimedia.org https://media.historypin.org https://kyhistorydrive-videos.s3.us-east-1.amazonaws.com https://*.adtrafficquality.google; connect-src 'self' https://*.google-analytics.com https://region1.google-analytics.com https://*.analytics.google.com https://analytics.google.com https://*.googletagmanager.com https://*.googlesyndication.com https://*.g.doubleclick.net https://fundingchoicesmessages.google.com https://adservice.google.com https://*.gstatic.com https://*.adtrafficquality.google https://www.google.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://en.wikipedia.org https://commons.wikimedia.org; media-src 'self' blob: https://kyhistorydrive-videos.s3.us-east-1.amazonaws.com; frame-src 'self' https://*.g.doubleclick.net https://*.googlesyndication.com https://fundingchoicesmessages.google.com https://www.google.com https://*.adtrafficquality.google; worker-src 'self' blob:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"

export const SECURITY_HEADERS = [
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'],
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['Content-Security-Policy-Report-Only', CSP],
]

export const DRIVES_PATTERN = "'/drives/**'"
export const DRIVES_PATTERNS = [DRIVES_PATTERN, "'/drives/'"]
export const DRIVES_PERMISSIONS = 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()'

export function patternBlocks(text) {
  const start = text.indexOf('customHeaders:\n')
  if (start === -1) return []
  let body = text.slice(start)
  const magazine = body.indexOf('\n# Magazine homepage')
  if (magazine !== -1) body = body.slice(0, magazine)
  return body.split('\n  - pattern:').slice(1).map((part) => {
    const nl = part.indexOf('\n')
    const pattern = (nl === -1 ? part : part.slice(0, nl)).trim()
    return { pattern, text: part }
  })
}

// Editor ruling (#345): amplify.yml keeps only these 301s. The four slashless rules the console lacks,
// plus 7 retired block-f slugs x slash/no slash. Every other 301 lives in the Amplify console.
const SLASHLESS_KEPT = ['/about', '/videos', '/timeline', '/drives']
const OLD_SLUG_301S = [
  ['capt-jack-jouett', 'jack-jouett-kentuckys-midnight-rider'],
  ['yellow-banks-becomes-owensboro', 'owensboro-yellow-banks'],
  ['camp-nelson-jessamine-county', 'camp-nelson-kentucky-us-colored-troops'],
  ['peter-village-early-woodland-enclosure-near-lexington', 'peter-village-enclosure-15fa166'],
  ['chickamauga-cherokee-hold-the-southern-flank', 'chickamauga-cherokee'],
  ['jacob-beam-sells-old-jakes-first-barrel', 'jacob-beam-on-hardin-creek'],
  ['wea-towns-at-ouiatenon-and-scotts-1791-kentucky-raid', 'wea-waayaahtanwa-on-the-wabash'],
]
export const REDIRECT_ALLOWLIST = [
  ...SLASHLESS_KEPT.map((p) => `${p}->${p}/:301`),
  ...OLD_SLUG_301S.flatMap(([from, to]) => [`/stories/${from}->/stories/${to}/:301`, `/stories/${from}/->/stories/${to}/:301`]),
].sort()

export function redirectProblems(amplify) {
  const problems = []
  const got = [...amplify.matchAll(/-\s*source:\s*'([^']*)'\s*\n\s*target:\s*'([^']*)'\s*\n\s*status:\s*'(30[1278])'/g)]
    .map((m) => `${m[1]}->${m[2]}:${m[3]}`)
  const allowed = new Set(REDIRECT_ALLOWLIST)
  for (const r of got) if (!allowed.has(r)) problems.push(`amplify.yml redirect ${r} is not in the allowlist (move it to the Amplify console)`)
  for (const r of REDIRECT_ALLOWLIST) if (!got.includes(r)) problems.push(`amplify.yml is missing required redirect ${r}`)
  if (new Set(got).size !== got.length) problems.push('amplify.yml has duplicate redirect rules')
  const statusCount = (amplify.match(/status:\s*'30[1278]'/g) || []).length
  if (statusCount !== REDIRECT_ALLOWLIST.length) problems.push(`amplify.yml has ${statusCount} redirect statuses; expected ${REDIRECT_ALLOWLIST.length}`)
  return problems
}

function headerValues(block, key) {
  const re = new RegExp(`- key: '${key}'\\n\\s*value: (?:'([^']*)'|"([^"]*)")`, 'g')
  const values = []
  for (const match of block.matchAll(re)) values.push(match[1] ?? match[2])
  return values
}

/** Problems for the six exact security headers. Empty means every block is complete. */
export function checkPatternBlocks(text) {
  const blocks = patternBlocks(text)
  if (!blocks.length) return ['customHttp has no pattern blocks']
  const problems = []
  for (const { pattern, text: block } of blocks) {
    const where = pattern || '(unnamed pattern)'
    for (const [key, expected] of SECURITY_HEADERS) {
      const values = headerValues(block, key)
      // The one exception: /drives/** may allow geolocation for its own origin (opt-in "Use my location").
      if (key === 'Permissions-Policy' && DRIVES_PATTERNS.includes(pattern)) {
        if (values.length !== 1 || values[0] !== DRIVES_PERMISSIONS) problems.push(`${where} Permissions-Policy is ${JSON.stringify(values[0])}, expected ${JSON.stringify(DRIVES_PERMISSIONS)}`)
        continue
      }
      if (values.length === 0) problems.push(`${where} is missing ${key}`)
      else if (values.length !== 1 || values[0] !== expected) {
        problems.push(`${where} ${key} is ${JSON.stringify(values[0])}, expected ${JSON.stringify(expected)}`)
      }
    }
    const policy = headerValues(block, 'Content-Security-Policy-Report-Only')[0]
    if (policy && policy.length > 1783) {
      problems.push(`${where} CSP value is ${policy.length} characters; CloudFront custom headers stop at 1783`)
    }
  }
  return problems
}

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8')
}

function runFixtures() {
  const hsts = checkPatternBlocks(read('scripts/fixtures/security-headers/hsts-max-age-300.yml'))
  const hstsHit = hsts.filter((problem) => problem.includes("'/data/layers/**'") && problem.includes('Strict-Transport-Security') && problem.includes('max-age=300'))
  if (hstsHit.length !== 1 || hsts.length !== 1) {
    throw new Error(`fixture hsts-max-age-300: expected one HSTS failure, got ${JSON.stringify(hsts)}`)
  }
  const feed = checkPatternBlocks(read('scripts/fixtures/security-headers/feed-missing-x-frame-options.yml'))
  const feedHit = feed.filter((problem) => problem.includes("'/feed.xml'") && problem.includes('missing X-Frame-Options'))
  if (feedHit.length !== 1 || feed.length !== 1) {
    throw new Error(`fixture feed-missing-x-frame-options: expected one missing X-Frame-Options, got ${JSON.stringify(feed)}`)
  }
  const valid = checkPatternBlocks(read('scripts/fixtures/security-headers/valid.yml'))
  if (valid.length) throw new Error(`fixture valid.yml should pass: ${valid.join('; ')}`)
}

function main() {
  const failures = []
  const fail = (msg) => {
    failures.push(msg)
    console.error(`check-security-headers: ${msg}`)
  }
  try {
    runFixtures()
  } catch (err) {
    fail(err.message)
  }

  const amplify = read('amplify.yml')
  const customHttp = read('customHttp.yml')
  if (amplify.includes('customHeaders:')) fail('amplify.yml must not contain customHeaders; headers live only in customHttp.yml')
  for (const problem of checkPatternBlocks(customHttp)) fail(problem)

  if (/preload/.test(customHttp)) fail('HSTS must not include preload')
  for (const { pattern, text } of patternBlocks(customHttp)) {
    if (!DRIVES_PATTERNS.includes(pattern) && /geolocation=\(self\)/.test(text)) fail(`${pattern} sets geolocation=(self); only ${DRIVES_PATTERNS.join(' and ')} may`)
  }
  for (const want of DRIVES_PATTERNS) if (!patternBlocks(customHttp).some((b) => b.pattern === want)) fail(`customHttp.yml is missing ${want}`)
  if (/key:\s*'Content-Security-Policy'\s*$/m.test(customHttp)) {
    fail('enforcing Content-Security-Policy is present; this baseline is report-only')
  }
  if (!customHttp.includes("value: 'public, max-age=0, s-maxage=60, must-revalidate'")) {
    fail('missing value: \'public, max-age=0, s-maxage=60, must-revalidate\'')
  }

  // Item 90 + Editor ruling #345: amplify.yml 301s are an explicit allowlist; anything else fails.
  for (const p of redirectProblems(amplify)) fail(p)

  const blocks = patternBlocks(customHttp)
  const feed = blocks.find((block) => block.pattern === "'/feed.xml'")
  if (!feed) fail('customHttp.yml is missing /feed.xml')
  else if (!feed.text.includes("value: 'application/rss+xml; charset=utf-8'")) {
    fail('/feed.xml is not application/rss+xml; charset=utf-8')
  }

  if (failures.length) {
    console.error(`check-security-headers: ${failures.length} problem(s)`)
    process.exit(1)
  }
  console.log(`check-security-headers: ${blocks.length} patterns each have the six security headers; fixtures caught a weak HSTS block and a /feed.xml block missing X-Frame-Options`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
