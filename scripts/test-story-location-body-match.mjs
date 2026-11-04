// A place only mentioned in a story body must not pin the story when the story's
// own county (title/summary) is a different county (#346: Lost City, Jonathan Creek → Wickliffe).
import assert from 'node:assert/strict'
import { bodyMatchFitsStoryCounty, stripLinkTargets } from './lib/story-location-match.mjs'

const counties = ['Logan', 'Marshall', 'Ballard', 'Boone']
const wickliffe = { properties: { county: 'Ballard' } }
assert.equal(bodyMatchFitsStoryCounty(wickliffe, { title: 'Page Site / “Lost City” (15LO1)', summary: 'In Logan County, the Page Site is a Mississippian complex.' }, counties), false)
assert.equal(bodyMatchFitsStoryCounty(wickliffe, { title: 'Jonathan Creek', summary: 'In Marshall County, Jonathan Creek was a planned town.' }, counties), false)
assert.equal(bodyMatchFitsStoryCounty(wickliffe, { title: 'A town', summary: 'In Ballard County, a town on a bluff.' }, counties), true)
assert.equal(bodyMatchFitsStoryCounty(wickliffe, { title: 'A town', summary: 'No county named here.' }, counties), true)
assert.equal(bodyMatchFitsStoryCounty({ properties: {} }, { title: 'x', summary: 'In Logan County.' }, counties), true)
// a linked story's slug is not a place mention (Trigg pinned to John Todd via /stories/col-john-todd-of-lexington/)
assert.equal(stripLinkTargets('he and [John Todd](/stories/col-john-todd-of-lexington/) secured').includes('lexington'), false)
// county-less place far from the county the story names does not pin it (Trigg, Lincoln County → Blue Licks);
// one inside/near that county still does (Odawa raid, Clark County → John Finley)
const cents = { Lincoln: [-84.67985, 37.52019], Clark: [-84.25209, 37.98859] }
const blueLicks = { properties: { county: null }, geometry: { coordinates: [-83.9915, 38.4344] } }
const finley = { properties: { county: null }, geometry: { coordinates: [-84, 37.9] } }
assert.equal(bodyMatchFitsStoryCounty(blueLicks, { title: 'Col. Stephen Trigg', summary: 'served as Lincoln County’s militia colonel' }, ['Lincoln', 'Clark'], cents), false)
assert.equal(bodyMatchFitsStoryCounty(finley, { title: 'Odawa raid', summary: 'In Clark County, Eskippakithiki was raided.' }, ['Lincoln', 'Clark'], cents), true)
console.log('test-story-location-body-match: 8 cases pass')
