#!/usr/bin/env node
/** #348: check-generated-diff flags rebuild noise outside the allowlisted records and --fix-style merge keeps only them. Fictional data only. */
import { diffJson, mergeAllowed, formatLike, makeAllow, missingBaseAction } from './lib/generated-diff.mjs'

const allow = makeAllow(['example-site-15xx999'])
const story = (id, extra = {}) => ({ id, title: id, county: 'Sample', ...extra })
const base = { generatedAt: 'a', stories: [story('sampletown-mill'), story('example-site-15xx999-sample-county'), { id: 'demoville-fort', matchedPlace: 'Demoville', county: 'Exampleton' }] }
const head = { generatedAt: 'b', stories: [
  story('sampletown-mill', { seoTitle: 'Sampletown Mill in Sample County (KY 0)' }),
  story('example-site-15xx999-sample-county', { title: 'Example Site: village in Sample County' }),
  { id: 'demoville-fort', county: 'Exampleton', matchedPlace: 'Demoville' },
] }
let fail = 0
const ok = (c, m) => { if (!c) { console.error(`FAIL: ${m}`); fail++ } }

const p = diffJson(base, head, allow)
ok(p.some((x) => x.includes('[sampletown-mill].seoTitle: added')), 'added seoTitle on a non-allowlisted story')
ok(p.some((x) => x.includes('[demoville-fort]: key order changed')), 'moved county key')
ok(!p.some((x) => x.includes('example-site')), 'allowlisted story change must pass')
ok(!p.some((x) => x.includes('generatedAt')), 'generatedAt ignored')
ok(diffJson({ 'sampletown-mill': { modified: '1' } }, { 'sampletown-mill': { modified: '2' } }, allow).length === 1, 'bumped date in keyed object')
ok(diffJson({ 'example-site-15xx999-x': { modified: '1' } }, { 'example-site-15xx999-x': { modified: '2' } }, allow).length === 0, 'allowlisted date bump passes')

const m = mergeAllowed(base, head, allow)
ok(diffJson(base, m, allow).length === 0, 'merge leaves no noise')
ok(m.stories[1].title === 'Example Site: village in Sample County', 'merge keeps the allowlisted change')
ok(m.generatedAt === 'a', 'merge keeps base generatedAt')
const bt = JSON.stringify(base, null, 2) + '\n'
ok(formatLike(bt, base) === bt, 'pretty round-trip')
ok(formatLike(JSON.stringify(base), base) === JSON.stringify(base), 'compact round-trip')

// Missing base ref: skip only on a local dev box; fail closed in CI (SEO #345 note), except an
// Amplify build of the base branch itself or main, where HEAD is the base and there is nothing to diff.
ok(missingBaseAction({}, 'origin/v2') === 'skip', 'local, no CI: skip')
ok(missingBaseAction({ CI: 'true' }, 'origin/v2') === 'fail', 'CI=true: fail closed')
ok(missingBaseAction({ GITHUB_ACTIONS: 'true' }, 'origin/v2') === 'fail', 'GitHub Actions: fail closed')
ok(missingBaseAction({ CODEBUILD_BUILD_ID: 'x' }, 'origin/v2') === 'fail', 'CodeBuild: fail closed')
ok(missingBaseAction({ AWS_APP_ID: 'x', AWS_BRANCH: 'sample-feature' }, 'origin/v2') === 'fail', 'Amplify feature branch: fail closed')
ok(missingBaseAction({ AWS_APP_ID: 'x', AWS_BRANCH: 'v2' }, 'origin/v2') === 'skip', 'Amplify build of the base branch: skip')
ok(missingBaseAction({ AWS_APP_ID: 'x', AWS_BRANCH: 'main' }, 'origin/v2') === 'skip', 'Amplify build of main: skip')
ok(missingBaseAction({ CI: 'true', GENERATED_DIFF_BASE: 'origin/sample' }, 'origin/sample') === 'fail', 'explicit base missing in CI: fail')
ok(missingBaseAction({ CI: 'false' }, 'origin/v2') === 'skip', 'CI=false is local')

// End to end: the real script exits 1 in CI when the base ref is missing, 0 locally.
{
  const { spawnSync } = await import('node:child_process')
  const run = (env) => spawnSync(process.execPath, [new URL('./check-generated-diff.mjs', import.meta.url).pathname], { env: { PATH: process.env.PATH, GENERATED_DIFF_BASE: 'origin/sample-missing-base', ...env }, encoding: 'utf8' }).status
  ok(run({ CI: 'true' }) === 1, 'check-generated-diff fails closed in CI with a missing base')
  ok(run({}) === 0, 'check-generated-diff skips locally with a missing base')
}
if (fail) process.exit(1)
console.log('test-generated-diff: ok')
