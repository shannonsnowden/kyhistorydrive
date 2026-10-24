#!/usr/bin/env node
/** Tests for story merges (#337): validation, redirect block (f), protection survives a merge. */
import assert from 'node:assert/strict'
import { validateMerges, buildRedirectBlock, keptFor, protectedAfterMerge } from './lib/story-merges.mjs'

let n = 0
const t = (name, fn) => { fn(); n++; console.log(`ok - ${name}`) }
const exists = (s) => ['kept-a', 'kept-b'].includes(s)

t('valid list builds both slash forms with final targets', () => {
  const m = [{ retired: 'old-a', kept: 'kept-a' }, { retired: 'old-b', kept: 'kept-b' }]
  assert.deepEqual(validateMerges(m, { storyExists: exists }), [])
  const block = buildRedirectBlock(m)
  assert.equal(block.length, 4)
  assert.deepEqual(block[0], { source: '/stories/old-a', target: '/stories/kept-a/', status: '301', condition: null })
  assert.deepEqual(block[1], { source: '/stories/old-a/', target: '/stories/kept-a/', status: '301', condition: null })
})
t('chain fails', () => {
  const errs = validateMerges([{ retired: 'x', kept: 'old-a' }, { retired: 'old-a', kept: 'kept-a' }], { storyExists: (s) => s === 'kept-a' || s === 'old-a' })
  assert.ok(errs.some((e) => /chain/.test(e)), errs.join('; '))
})
t('loop fails', () => {
  const errs = validateMerges([{ retired: 'p', kept: 'q' }, { retired: 'q', kept: 'p' }], { storyExists: () => true })
  assert.ok(errs.some((e) => /loop|chain/.test(e)), errs.join('; '))
})
t('self-redirect fails', () => {
  assert.ok(validateMerges([{ retired: 'kept-a', kept: 'kept-a' }], { storyExists: exists }).length > 0)
})
t('dead target fails', () => {
  const errs = validateMerges([{ retired: 'old-a', kept: 'gone' }], { storyExists: exists })
  assert.ok(errs.some((e) => /dead target/.test(e)), errs.join('; '))
})
t('retired page still built fails', () => {
  const errs = validateMerges([{ retired: 'kept-b', kept: 'kept-a' }], { storyExists: exists })
  assert.ok(errs.some((e) => /still exists/.test(e)), errs.join('; '))
})
t('duplicate source fails; bad slug fails', () => {
  assert.ok(validateMerges([{ retired: 'o', kept: 'kept-a' }, { retired: 'o', kept: 'kept-b' }], { storyExists: exists }).length > 0)
  assert.ok(validateMerges([{ retired: '../x', kept: 'kept-a' }], { storyExists: exists }).length > 0)
})
t('keptFor maps retired to kept and leaves others', () => {
  const m = [{ retired: 'old-a', kept: 'kept-a' }]
  assert.equal(keptFor('old-a', m), 'kept-a')
  assert.equal(keptFor('kept-a', m), 'kept-a')
  assert.equal(keptFor('other', m), 'other')
})
t('protection survives a merge (either source protected)', () => {
  const m = [{ retired: 'old-site-15fa1', kept: 'kept-a' }, { retired: 'old-b', kept: 'kept-b' }]
  const prot = new Set(['old-site-15fa1'])
  assert.equal(protectedAfterMerge('kept-a', m, (s) => prot.has(s)), true)
  assert.equal(protectedAfterMerge('kept-b', m, (s) => prot.has(s)), false)
  prot.add('kept-b')
  assert.equal(protectedAfterMerge('kept-b', m, (s) => prot.has(s)), true)
})
console.log(`test-story-merges: ${n} passed`)
