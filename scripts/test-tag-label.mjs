import assert from 'node:assert/strict'
import { tagLabel } from './lib/tag-label.mjs'
const cases = [
  ['usct', 'USCT'], ['khs', 'KHS'], ['nrhp', 'NRHP'], ['csa', 'CSA'], ['usa', 'USA'],
  ['civil-war', 'Civil War'], ['african-american', 'African American'],
  ['nrhp-listed', 'NRHP Listed'], ['frontier-war', 'Frontier War'], ['bourbon', 'Bourbon'],
  ['usher', 'Usher'], ['causa', 'Causa'],
]
for (const [input, want] of cases) assert.equal(tagLabel(input), want, input)
console.log(`test-tag-label: ${cases.length} passed`)
