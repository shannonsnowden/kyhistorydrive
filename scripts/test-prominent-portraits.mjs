#!/usr/bin/env node
/**
 * Fail-closed portraits for people a story names.
 * Passing fixture: a wired face, including the standard AI likeness credit, is a portrait.
 * Failing fixture: no image, or a document / map / place image, is not.
 * The allowlist is shrink-only: adding an entry without removing one fails.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AI_LIKENESS_CREDIT,
  assessProminentPortraits,
  shrinkOnlyError,
} from './check-story-portraits.mjs'

const face = (id) => ({
  webp: `/people/portraits/${id}-512.webp`,
  jpg: `/people/portraits/${id}-512.jpg`,
})

const people = [
  { id: 'ada-lane', name: 'Ada Lane', image: face('ada-lane'), credit: 'Public domain', ai: false },
  { id: 'bea-lane', name: 'Bea Lane', image: face('bea-lane'), credit: AI_LIKENESS_CREDIT, ai: true },
  { id: 'cy-lane', name: 'Cy Lane', image: null, credit: null, ai: false },
  { id: 'dee-lane', name: 'Dee Lane', image: face('dee-lane'), credit: 'A plat', kind: 'map' },
  { id: 'ed-lane', name: 'Ed Lane', portrait: face('ed-lane'), credit: 'A deed', type: 'document' },
  { id: 'fay-lane', name: 'Fay Lane', photo: face('fay-lane'), credit: 'A town view', imageKind: 'place' },
  {
    id: 'gus-lane',
    name: 'Gus Lane',
    image: {
      webp: '/people/portraits/gus-lane-map-512.webp',
      jpg: '/people/portraits/gus-lane-map-512.jpg',
    },
    credit: 'His map',
  },
]

const storyPeople = {
  stories: {
    'faces-pass': { links: [{ id: 'ada-lane' }, { id: 'bea-lane' }], portraits: ['ada-lane'] },
    'no-face': { links: [{ id: 'cy-lane' }], portraits: [] },
    'map-kind': { links: [{ id: 'dee-lane' }], portraits: [] },
    'document-kind': { links: [{ id: 'ed-lane' }], portraits: [] },
    'place-kind': { links: [], portraits: ['fay-lane'] },
    'denylist-file': { links: [{ id: 'gus-lane' }], portraits: [] },
    'subject-only': { links: [], portraits: [] },
  },
}

const storySubjects = { 'subject-only': 'cy-lane' }
const denylist = { 'gus-lane-map-512': 'map' }

const passing = assessProminentPortraits({
  people,
  storyPeople: { stories: { 'faces-pass': storyPeople.stories['faces-pass'] } },
  storySubjects: {},
  allowlist: [],
  denylist,
})
assert.deepEqual(passing.failures, [], 'a wired face and the standard AI likeness credit are portraits')

const failing = assessProminentPortraits({
  people,
  storyPeople,
  storySubjects,
  allowlist: [],
  denylist,
})
assert.deepEqual(
  failing.failures,
  [
    { slug: 'denylist-file', id: 'gus-lane', reason: 'image is a map' },
    { slug: 'document-kind', id: 'ed-lane', reason: 'image is a document' },
    { slug: 'map-kind', id: 'dee-lane', reason: 'image is a map' },
    { slug: 'no-face', id: 'cy-lane', reason: 'no portrait' },
    { slug: 'place-kind', id: 'fay-lane', reason: 'image is a place' },
    { slug: 'subject-only', id: 'cy-lane', reason: 'no portrait' },
  ],
)

const allowed = assessProminentPortraits({
  people,
  storyPeople,
  storySubjects,
  allowlist: [
    { slug: 'no-face', id: 'cy-lane', reason: 'no portrait' },
    { slug: 'subject-only', id: 'cy-lane', reason: 'no portrait' },
    { slug: 'map-kind', id: 'dee-lane', reason: 'image is a map' },
    { slug: 'document-kind', id: 'ed-lane', reason: 'image is a document' },
    { slug: 'place-kind', id: 'fay-lane', reason: 'image is a place' },
    { slug: 'denylist-file', id: 'gus-lane', reason: 'image is a map' },
  ],
  denylist,
})
assert.deepEqual(allowed.failures, [], 'an allowlisted gap does not fail')

const wrongReason = assessProminentPortraits({
  people,
  storyPeople: { stories: { 'no-face': storyPeople.stories['no-face'] } },
  allowlist: [{ slug: 'no-face', id: 'cy-lane', reason: 'image is a map' }],
  denylist,
})
assert.deepEqual(wrongReason.failures, [
  { slug: 'no-face', id: 'cy-lane', reason: 'allowlist entry is no longer a gap; remove it' },
  { slug: 'no-face', id: 'cy-lane', reason: 'no portrait' },
], 'an allowlist row covers a gap only when the reason still matches')

const placeWithAiCredit = assessProminentPortraits({
  people: [{ id: 'hoa-lane', name: 'Hoa Lane', image: face('hoa-lane'), credit: AI_LIKENESS_CREDIT, ai: true, kind: 'place' }],
  storyPeople: { stories: { 'place-ai': { links: [{ id: 'hoa-lane' }], portraits: [] } } },
  allowlist: [],
  denylist,
})
assert.deepEqual(placeWithAiCredit.failures, [
  { slug: 'place-ai', id: 'hoa-lane', reason: 'image is a place' },
], 'a place image does not become a portrait because the credit is an AI likeness')

const aiOverDenylist = assessProminentPortraits({
  people: [{ id: 'jean-baptiste-franquelin', name: 'Franquelin', image: face('jean-baptiste-franquelin'), credit: AI_LIKENESS_CREDIT, ai: true }],
  storyPeople: { stories: { mapmaker: { links: [{ id: 'jean-baptiste-franquelin' }], portraits: [] } } },
  allowlist: [],
  denylist: { 'jean-baptiste-franquelin': 'map' },
})
assert.deepEqual(aiOverDenylist.failures, [], 'a wired AI likeness counts even when the old image id was a map')

const stripRoutes = assessProminentPortraits({
  people: [
    { id: 'ida-lane', name: 'Ida Lane', image: face('ida-lane'), credit: 'Public domain', ai: false, stories: ['no-subject-with-face'] },
    { id: 'cy-lane', name: 'Cy Lane', image: null, credit: null, ai: false, stories: ['no-subject-no-face'] },
    { id: 'jo-lane', name: 'Jo Lane', image: null, credit: null, ai: false },
    { id: 'kai-lane', name: 'Kai Lane', image: null, credit: null, ai: false },
  ],
  stories: [
    { slug: 'no-subject-with-face', bodyMarkdown: 'A town story with no title subject.' },
    { slug: 'no-subject-no-face', bodyMarkdown: 'Another town story. Nobody is the title subject.' },
    { slug: 'body-link-only', bodyMarkdown: 'The surveyor was [Jo Lane](/people/#jo-lane).' },
    { slug: 'notes-only', bodyMarkdown: 'The notes name someone the body does not link.' },
    { slug: 'empty-story', bodyMarkdown: 'No person is wired to this story.' },
  ],
  storyPeople: { stories: {} },
  storySubjects: {},
  notesByStory: { 'notes-only': { people: [{ name: 'Kai Lane', peopleId: 'kai-lane' }] } },
  allowlist: [],
  denylist,
})
assert.deepEqual(stripRoutes.failures, [
  { slug: 'body-link-only', id: 'jo-lane', reason: 'no portrait' },
  { slug: 'no-subject-no-face', id: 'cy-lane', reason: 'no portrait' },
  { slug: 'notes-only', id: 'kai-lane', reason: 'no portrait' },
], 'stories with no subject still fail when a strip person has no portrait')

const stale = assessProminentPortraits({
  people,
  storyPeople: { stories: { 'faces-pass': storyPeople.stories['faces-pass'] } },
  storySubjects: {},
  allowlist: [{ slug: 'faces-pass', id: 'ada-lane' }],
  denylist,
})
assert.deepEqual(stale.failures, [
  { slug: 'faces-pass', id: 'ada-lane', reason: 'allowlist entry is no longer a gap; remove it' },
])

assert.equal(shrinkOnlyError([{ slug: 'a', id: 'b' }], 1), '')
assert.match(shrinkOnlyError([{ slug: 'a', id: 'b' }, { slug: 'c', id: 'd' }], 1), /without removing one/)
assert.match(shrinkOnlyError([], 1), /shrank/)

// Cap may only fall. Adding a row without removing one fails; after a removal, lower this number.
const PROMINENT_PORTRAIT_GAP_MAX = 159
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const allowFile = JSON.parse(fs.readFileSync(path.join(root, 'scripts/prominent-portrait-gaps.json'), 'utf8'))
const liveEntries = allowFile.gaps
assert.equal(shrinkOnlyError(liveEntries, PROMINENT_PORTRAIT_GAP_MAX), '', shrinkOnlyError(liveEntries, PROMINENT_PORTRAIT_GAP_MAX))

console.log(`test-prominent-portraits: fixtures ok; allowlist ${liveEntries.length}`)
