/**
 * Stories that must not receive an automatic Historypin, Wikipedia, or
 * Commons photo. The runtime lookup was showing the wrong subject.
 * A hand-picked file under /content/photos/ still shows.
 * Do not put this list in story text.
 *
 * Col. Robert Patterson keeps the shared modern "Outskirts of Lexington"
 * photo: that story is about founding the town. Col. John Todd does not.
 * His story is the militia career, Blue Licks, and Todd County.
 */
export const NO_AUTO_STORY_PHOTOS = [
  'versailles-takes-shape',
  'henderson-at-red-banks',
  'kickapoo-on-the-kentucky-frontier',
  'indian-knoll-ohio-county',
  'glasgow-the-barrens',
  'evan-williams-on-the-louisville-wharf',
  'leestown',
  'paris-from-hopewell',
  'ojibwe-on-birds-war-road',
  'col-john-todd-of-lexington',
  // Commons 'Fox Farm Site' is the Smyth County, Virginia site, not Mason County (Editor 10/18).
  'fox-farm-mason-county',
  // Protected site: no stand-in landscape photo that could name a place (SEO #345).
  'the-c-and-o-mounds-johnson-county',
  // Protected site: the 1848 plan shows a river label, distance, arrow and scale (Security #345, 10/24).
  'peter-village-enclosure-15fa166',
  // Item 105 (v2): protected sites. No stand-in photo, and no automatic photo that could place them.
  'muir-site-early-fort-ancient',
  'read-shell-midden-15bt10-butler-county',
  // Twin Mounds: Wickliffe stand-in photo removed (KY History 10/24).
  'twin-mounds-site',
  // Protected site: no nearest-town stand-in photo (SEO 10/24).
  'buckner-site-fort-ancient-villages',
  // No Scioto-confluence stand-in photo that could place Lower Shawneetown (SEO 10/24).
  'nonhelema',
  'chambers-site-15ml109-marshall-county',
  // Tolu: Wickliffe stand-in photo removed; a reference site (KY History 10/24).
  'tolu-site-mississippian-mounds',
  // Nov 13 2026 pack. Hand-placed photos and figures stay; do not fetch a stand-in.
  'gen-green-clay-the-surveyor-who-built-clermont',
  'barbourville-the-knox-county-seat-on-the-cumberland',
  'aristides-winner-of-the-first-kentucky-derby',
  'cold-oak-shelter-lee-county',
  'the-catawba-and-the-northern-war-parties',
  // Nov 17 2026 pack. Hand-placed public-domain/CC0 photos; do not fetch a stand-in.
  'peter-cartwright-the-backwoods-preacher-from-logan-county',
  'madisonville-a-courthouse-town-on-mcgary-and-silkwood-land',
  'i-w-bernheim-from-peddler-to-i-w-harper',
  'the-treaty-of-lancaster-1744-how-virginia-claimed-kentucky',
  'fort-jefferson-clarks-fort-on-chickasaw-ground',
  // Nov 20 2026 pack. Hand-placed public-domain/CC photos; do not fetch a stand-in. The Woman from Short Cave and Denmark are
  // not listed: their photos are AI likenesses under /people/portraits/ (like Blue Jacket), which this list would hide.
  // Never a photo of the remains.
  'john-breckinridge-of-cabells-dale',
  'greenville-a-hilltop-seat-on-william-campbells-land',
  'black-hoof-the-shawnee-warrior-who-chose-peace',
  // Nov 27 2026 pack. Hand-placed public-domain photos; do not fetch a stand-in. Crigler Mounds is not listed: its photo is
  // the shared Adena AI figure (like Robbins and Dover). Never a photo of the remains.
  'isaac-hite-of-cave-spring',
  'smithland-zachariah-coxs-town-on-the-cumberland',
  'grey-eagle-and-wagner-at-the-oakland-course',
  'the-new-madrid-earthquakes-in-kentucky-1811-12',
]

const blocked = new Set(NO_AUTO_STORY_PHOTOS)

export function storyBlocksAutoPhoto(slug) {
  return blocked.has(String(slug || ''))
}
