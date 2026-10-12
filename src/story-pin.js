/** Mini map inside the story pin pill. Width and height match .story-pin img. */
export const STORY_PIN_WIDTH = 72
export const STORY_PIN_HEIGHT = 64

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Thumbnail link for a story that has a public pin.
 * The accessible name starts with the visible text so it matches the label.
 * Returns '' when the slug cannot be a file name.
 */
export function storyPinLinkHtml({ href, title, slug }) {
  if (!SLUG.test(String(slug || ''))) return ''
  const light = `/brand/story-pins/${slug}-light.svg`
  const dark = `/brand/story-pins/${slug}-dark.svg`
  const name = `Open on the map: ${title}`
  return `<a class="story-pin" href="${esc(href)}" aria-label="${esc(name)}"><picture class="story-pin-picture"><source data-theme="dark" type="image/svg+xml" media="(prefers-color-scheme: dark)" srcset="${dark}" /><img src="${light}" data-src-light="${light}" data-src-dark="${dark}" width="${STORY_PIN_WIDTH}" height="${STORY_PIN_HEIGHT}" alt="" decoding="async" /></picture><span>Open on the map</span></a>`
}
