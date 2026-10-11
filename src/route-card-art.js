/**
 * Homepage Route maps card.
 * Story Studio final art lives in public/maps/homepage-card/. See NOTES.md there.
 * Light and dark, each as WebP with a JPEG fallback, at 1x and 2x.
 */
export const ROUTE_MAPS_CARD_ART = '/maps/homepage-card/route-maps-card'

export const ROUTE_MAPS_CARD_ALT =
  "Antique parchment map of the Warriors' Path in red, running south through eastern Kentucky past the Kentucky River ford and Flat Lick to Cumberland Gap."

export const ROUTE_MAPS_CARD_WIDTH = 600
export const ROUTE_MAPS_CARD_HEIGHT = 340

function pair(theme, ext) {
  return `${ROUTE_MAPS_CARD_ART}-${theme}.${ext} 1x, ${ROUTE_MAPS_CARD_ART}-${theme}@2x.${ext} 2x`
}

function paintPicture(picture) {
  const sources = [...(picture?.querySelectorAll('source') || [])]
  const img = picture?.querySelector('img')
  if (!sources.length || !img) return
  const theme = document.documentElement.getAttribute('data-hp-theme') === 'light' ? 'light' : 'dark'
  const osDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  let darkMedia = '(prefers-color-scheme: dark)'
  if ((theme === 'dark') !== !!osDark) darkMedia = theme === 'dark' ? '(min-width: 0px)' : 'not all'
  for (const source of sources) {
    const slot = source.getAttribute('data-theme')
    if (slot === 'dark') {
      source.media = darkMedia
      source.type = source.getAttribute('type') || 'image/webp'
      source.srcset = pair('dark', source.type === 'image/jpeg' ? 'jpg' : 'webp')
    } else if (slot === 'light') {
      source.removeAttribute('media')
      source.type = 'image/webp'
      source.srcset = pair('light', 'webp')
    }
  }
  img.src = `${ROUTE_MAPS_CARD_ART}-light.jpg`
  img.srcset = pair('light', 'jpg')
  img.width = ROUTE_MAPS_CARD_WIDTH
  img.height = ROUTE_MAPS_CARD_HEIGHT
  img.alt = ROUTE_MAPS_CARD_ALT
  img.loading = 'lazy'
  img.decoding = 'async'
  img.remove()
  picture.appendChild(img)
}

/** Keep the route card on the same theme as the page. The map card swaps in theme.js. */
export function paintHomeMapCards(root = document) {
  paintPicture(root.querySelector?.('a.hp-map-routes picture'))
}

export function paintRouteMapsCard(root = document) {
  paintHomeMapCards(root)
}
