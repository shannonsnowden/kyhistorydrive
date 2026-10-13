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
]

const blocked = new Set(NO_AUTO_STORY_PHOTOS)

export function storyBlocksAutoPhoto(slug) {
  return blocked.has(String(slug || ''))
}
