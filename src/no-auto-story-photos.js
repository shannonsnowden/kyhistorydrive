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
  'indian-knoll-on-the-green-river',
  'glasgow-the-barrens',
  'evan-williams-on-the-louisville-wharf',
  'leestown',
  'paris-from-hopewell',
  'ojibwe-on-birds-war-road',
  'col-john-todd-of-lexington',
  // Commons 'Fox Farm Site' is the Smyth County, Virginia site, not Mason County (Editor 10/18).
  'fox-farm-mason-county',
  // Protected site: no stand-in landscape photo that could name a place (SEO #345).
  'the-c-and-o-mounds-at-paintsville',
  // Protected site: the 1848 plan shows a river label, distance, arrow and scale (Security #345, 10/24).
  'peter-village-enclosure-15fa166',
  // Item 105 (v2): protected sites. No stand-in photo, and no automatic photo that could place them.
  'muir-site-early-fort-ancient-on-a-jessamine-ridge',
  'read-shell-midden-15bt10-butler-county',
  // Twin Mounds: Wickliffe stand-in photo removed (KY History 10/24).
  'twin-mounds-site',
  // Protected site: no nearest-town stand-in photo (SEO 10/24).
  'buckner-site-fort-ancient-villages-on-strodes-creek',
  // No Scioto-confluence stand-in photo that could place Lower Shawneetown (SEO 10/24).
  'nonhelema',
  'chambers-site-15ml109-marshall-county',
]

const blocked = new Set(NO_AUTO_STORY_PHOTOS)

export function storyBlocksAutoPhoto(slug) {
  return blocked.has(String(slug || ''))
}
