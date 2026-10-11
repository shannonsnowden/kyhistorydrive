#!/usr/bin/env node
/**
 * Fails the build when amplify.yml and customHttp.yml drift apart or drop
 * a security header. The /about 301 stays in amplify.yml customRules.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error(`check-security-headers: ${msg}`)
}

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8')
}

function headerBlock(text, name) {
  const start = text.indexOf('customHeaders:\n')
  if (start === -1) {
    fail(`${name} has no customHeaders block`)
    return ''
  }
  let block = text.slice(start)
  const magazine = block.indexOf('\n# Magazine homepage')
  if (magazine !== -1) block = block.slice(0, magazine)
  return block.trim()
}

const amplify = read('amplify.yml')
const customHttp = read('customHttp.yml')
const amplifyHeaders = headerBlock(amplify, 'amplify.yml')
const customHeaders = headerBlock(customHttp, 'customHttp.yml')
if (amplifyHeaders && customHeaders && amplifyHeaders !== customHeaders) {
  fail('amplify.yml and customHttp.yml customHeaders lists differ')
}

const block = amplifyHeaders || ''
const required = [
  "key: 'Strict-Transport-Security'",
  "value: 'max-age=31536000; includeSubDomains'",
  "key: 'X-Content-Type-Options'",
  "value: 'nosniff'",
  "key: 'Referrer-Policy'",
  "value: 'strict-origin-when-cross-origin'",
  "key: 'Permissions-Policy'",
  "value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'",
  "key: 'X-Frame-Options'",
  "value: 'SAMEORIGIN'",
  "key: 'Content-Security-Policy-Report-Only'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  'https://*.googletagmanager.com',
  'https://*.google-analytics.com',
  'https://region1.google-analytics.com',
  'https://pagead2.googlesyndication.com',
  'https://fundingchoicesmessages.google.com',
  'https://*.googlesyndication.com',
  'https://*.g.doubleclick.net',
  'https://*.adtrafficquality.google',
  'https://basemaps.cartocdn.com',
  'https://*.basemaps.cartocdn.com',
  'https://kyhistorydrive-videos.s3.us-east-1.amazonaws.com',
  'https://upload.wikimedia.org',
  'https://media.historypin.org',
  'https://en.wikipedia.org',
  'https://commons.wikimedia.org',
  "value: 'public, max-age=0, s-maxage=60, must-revalidate'",
]
for (const needle of required) {
  if (!block.includes(needle)) fail(`missing ${needle}`)
}

const csp = block.match(/Content-Security-Policy-Report-Only'\n\s*value: "([^"]+)"/)
if (!csp) fail('could not read the report-only policy')
else {
  const policy = csp[1]
  if (policy.length > 1783) fail(`CSP value is ${policy.length} characters; CloudFront custom headers stop at 1783`)
  for (const directive of ['script-src', 'img-src', 'frame-src', 'connect-src']) {
    const part = policy.split('; ').find((item) => item.startsWith(`${directive} `))
    if (!part || !part.includes('https://*.adtrafficquality.google')) {
      fail(`${directive} is missing https://*.adtrafficquality.google`)
    }
  }
}

if (/preload/.test(block)) fail('HSTS must not include preload')
if (/geolocation=\(self\)/.test(block)) fail('geolocation=(self) is set, but the site does not use geolocation')
if (/key:\s*'Content-Security-Policy'\s*$/m.test(block)) {
  fail('enforcing Content-Security-Policy is present; this baseline is report-only')
}

const about = /source:\s*'\/about'\s*\n\s*target:\s*'\/about\/'\s*\n\s*status:\s*'301'/
if (!about.test(amplify)) fail('amplify.yml is missing the /about 301')

if (failures.length) {
  console.error(`check-security-headers: ${failures.length} problem(s)`)
  process.exit(1)
}
console.log('check-security-headers: amplify.yml and customHttp.yml match')
