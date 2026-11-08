#!/usr/bin/env node
// #337: full-name mention matching, and the 4 people missing from people.json.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fullNames, mentions, findUnlinked } from './fix-people-mentions.mjs'

const boone = { id: 'daniel-boone', name: 'Daniel Boone', aliases: ['Boone'], stories: ['a'] }
assert.deepEqual(fullNames(boone), ['Daniel Boone'])
assert.ok(mentions('When Daniel Boone arrived', boone))
assert.ok(mentions('[Daniel\nBoone](/people/#daniel-boone)', boone))
assert.ok(!mentions('Boone arrived', boone), 'surname alone is not a full-name mention')
assert.ok(!mentions('Daniel Booneville', boone))
const stories = [{ slug: 'a', title: '', bodyMarkdown: 'Daniel Boone' }, { slug: 'b', title: '', bodyMarkdown: 'Daniel Boone' }, { slug: 'c', title: '', bodyMarkdown: 'Daniel Boone' }]
assert.deepEqual(findUnlinked([boone], stories, { 'daniel-boone': { c: 'other person' } }), [{ id: 'daniel-boone', slug: 'b' }])

const people = JSON.parse(fs.readFileSync(new URL('../data/people.json', import.meta.url))).people
const byId = new Map(people.map((p) => [p.id, p]))
for (const [id, slug] of [['lord-dunmore', 'treaty-of-camp-charlotte-1774'], ['barton-stone', 'cane-ridge-meeting-house-and-the-1801-camp-meeting'], ['thomas-kennedy', 'covington-at-the-point'], ['elizabeth-patton-preston', 'prestonsburg-first-seat-on-the-big-sandy'], ['ann-logan', null], ['hannah-boone', null]]) {
  assert.ok(byId.has(id), `${id} in people.json`)
  if (slug) assert.ok(byId.get(id).stories.includes(slug), `${id} -> ${slug}`)
  if (slug) assert.equal(byId.get(id).image, null, `${id}: no new portrait (portrait freeze)`)
}
assert.equal(new Set(people.map((p) => p.id)).size, people.length, 'unique ids')

// Mount Washington people correction. Portrait order is the final three-face
// sequence. A face joins the curated list only when its canonical files exist,
// so Bragg ships now and Drake/Leitch join when their approved art is added.
const SLUG = 'mount-washington-grows-from-the-crossroads'
const GLASGOW = 'glasgow-the-barrens'
const IDS = ['david-leitch', 'catherine-drake', 'joseph-hough', 'braxton-bragg', 'john-austin-wharton', 'don-carlos-buell']
const PORTRAIT_ORDER = ['david-leitch', 'catherine-drake', 'braxton-bragg']
const REAL_IDS = ['braxton-bragg', 'john-austin-wharton', 'don-carlos-buell']
const FORMERLY = 'formerly Joseph Hough\u2019s widow'
const WASHINGTON = '[George Washington](/people/#george-washington)'
const root = new URL('..', import.meta.url)
const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, root), 'utf8'))
const portraitDir = new URL('public/people/portraits/', root)
const hasPair = (id, tag) => ['webp', 'jpg'].every((ext) => fs.existsSync(new URL(`${id}${tag}.${ext}`, portraitDir)))
const aiReady = (id) => hasPair(id, '__ai-portrait-v1-512') && hasPair(id, '__ai-portrait-v1-96')
const realReady = (id) => hasPair(id, '-512') && hasPair(id, '-96')

for (const id of IDS) assert.ok(byId.has(id), `${id} in people.json`)
const allowedOnStory = new Set([...IDS, 'george-washington'])
for (const person of people) {
  if ((person.stories || []).includes(SLUG)) assert.ok(allowedOnStory.has(person.id), `${person.id} unexpectedly associated with Mount Washington`)
}
for (const id of IDS) {
  const stories = byId.get(id).stories
  assert.deepEqual(stories, id === 'braxton-bragg' ? [SLUG, GLASGOW] : [SLUG], `${id} stories`)
}
for (const id of ['david-leitch', 'catherine-drake', 'joseph-hough']) {
  const person = byId.get(id)
  assert.equal(person.likeness, 'none-known', id)
  assert.equal(person.lifeDates, null, id)
}
const catherine = byId.get('catherine-drake')
assert.equal(catherine.role, 'Mount Washington town-lot seller, 1818')
assert.match(catherine.notes, /remarried David Drake before/)
assert.match(catherine.notes, new RegExp(FORMERLY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
assert.doesNotMatch(catherine.notes, /widow at the (1818 )?sale/i)
assert.match(byId.get('david-leitch').notes, /explorekyhistory\.ky\.gov\/items\/show\/531/)
assert.match(byId.get('joseph-hough').notes, /not an inline story figure/)
for (const id of REAL_IDS) {
  const person = byId.get(id)
  assert.equal(person.likeness, 'photo', id)
  assert.equal(person.license, 'Public domain', id)
  assert.equal(person.verified, true, id)
  assert.equal(person.freeToUse, true, id)
  assert.notEqual(person.ai, true, id)
  assert.ok(realReady(id), `${id} audited 512/96 files`)
  assert.equal(aiReady(id), false, `${id} is a photograph, not an AI portrait`)
}
for (const id of ['david-leitch', 'catherine-drake']) {
  const person = byId.get(id)
  if (aiReady(id)) {
    assert.equal(person.ai, true, id)
    assert.equal(person.credit, 'AI illustration · Kentucky History Drive; no known likeness exists', id)
  } else {
    assert.equal(person.image, null, `${id} has no approved art yet`)
    assert.notEqual(person.ai, true, id)
    assert.equal(aiReady(id), false, id)
  }
}
const hough = byId.get('joseph-hough')
assert.equal(hough.image, null, 'research image stays null; files are discovered')
assert.equal(hough.likeness, 'none-known')
assert.equal(hough.ai, true)
assert.equal(hough.credit, 'AI illustration · Kentucky History Drive; no known likeness exists')
assert.equal(aiReady('joseph-hough'), true, 'Joseph Hough profile files')

const story = read(`public/content/stories/${SLUG}.json`)
assert.match(story.bodyMarkdown, new RegExp(FORMERLY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
assert.match(story.bodyMarkdown, new RegExp(WASHINGTON.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
assert.doesNotMatch(story.bodyMarkdown, /widow of/)
assert.equal(story.photo.image_url, '/content/photos/stories/mount-washington-grows-from-the-crossroads.jpg')
assert.equal(story.photo.source_url, 'https://commons.wikimedia.org/wiki/File:Zack_Stansbury_House.jpg')
assert.equal(story.yearStart, 1833)
assert.equal(story.yearEnd, 1862)
const glasgow = read(`public/content/stories/${GLASGOW}.json`)
assert.doesNotMatch(glasgow.bodyMarkdown, /\/people\/#braxton-bragg/)
assert.match(glasgow.bodyMarkdown, /Gen\. Braxton Bragg's invasion of Kentucky/)

const override = read('scripts/story-overrides.json').overrides[SLUG]
assert.equal(override.lat, 38.05)
assert.equal(override.lon, -85.7458)
assert.equal(override.yearStart, 1833)
assert.equal(override.yearEnd, 1862)
assert.equal(override.county, 'Bullitt')
assert.equal(override.historyId, 'mount-washington-crossroads-bullitt-1833')
const replace = new Map((override.replace || []).map((row) => [row.old, row.new]))
assert.equal(replace.get('Catherine Drake, widow of local landowner Joseph Hough,'), `Catherine Drake, ${FORMERLY},`)
assert.equal(replace.get('George Washington\u2019s estate'), `${WASHINGTON}\u2019s estate`)

const sweep = read('scripts/portrait-sweep.json').stories
assert.deepEqual(sweep[GLASGOW], { links: ['john-gorin'], portraits: [] })
assert.deepEqual(sweep[SLUG].links, IDS)
assert.equal(sweep[SLUG].aliases['john-austin-wharton'], 'John Wharton')
const shipped = PORTRAIT_ORDER.filter((id) => (id === 'braxton-bragg' ? realReady(id) : aiReady(id)))
assert.ok(shipped.includes('braxton-bragg'), 'Bragg photograph is part of this correction')
assert.deepEqual(sweep[SLUG].portraits, shipped, 'curated portraits follow shipped faces in first-mention order')
assert.ok(!sweep[SLUG].portraits.includes('joseph-hough'))
assert.ok(!sweep[SLUG].portraits.includes('john-austin-wharton'))
assert.ok(!sweep[SLUG].portraits.includes('don-carlos-buell'))

const pub = read('public/data/people.json')
assert.equal(pub.storySubjects[SLUG], undefined, 'town story has no title subject')
assert.equal(pub.people.length, people.length)
for (const id of IDS) {
  const person = pub.people.find((row) => row.id === id)
  assert.ok(person, `public ${id}`)
  assert.deepEqual(person.stories, byId.get(id).stories, id)
}
const pubHough = pub.people.find((row) => row.id === 'joseph-hough')
assert.equal(pubHough.ai, true)
assert.equal(pubHough.credit, 'AI illustration · Kentucky History Drive; no known likeness exists')
assert.equal(pubHough.image.jpg, '/people/portraits/joseph-hough__ai-portrait-v1-512.jpg')
assert.equal(pubHough.image.webp, '/people/portraits/joseph-hough__ai-portrait-v1-512.webp')
const entry = read('public/data/web/story-people.json').stories[SLUG]
assert.deepEqual(entry.links.map((link) => link.id), IDS)
assert.equal(entry.links.find((link) => link.id === 'john-austin-wharton').name, 'John Wharton')
assert.deepEqual(entry.portraits, shipped)
assert.deepEqual(read('public/data/web/story-people.json').stories[GLASGOW].links.map((link) => link.id), ['john-gorin'])
assert.deepEqual(read('public/data/web/story-people.json').stories[GLASGOW].portraits, [])

console.log('test-people-mentions: OK')
