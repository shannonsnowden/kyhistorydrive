/**
 * Homepage route-card art.
 * The picture is the Warriors' Path phone art. Light is the WebP; dark is the PNG.
 */
export const ROUTE_MAPS_CARD_ART =
  '/maps/routes/athiamiowee-the-warriors-path-through-kentucky/warriors-path-map-phone'

export const ROUTE_MAPS_CARD_WIDTH = 780
export const ROUTE_MAPS_CARD_HEIGHT = 439

const ROUTE_MAPS_CARD = {
  light: `${ROUTE_MAPS_CARD_ART}.webp`,
  dark: `${ROUTE_MAPS_CARD_ART}-dark.png`,
  type: 'image/png',
  width: ROUTE_MAPS_CARD_WIDTH,
  height: ROUTE_MAPS_CARD_HEIGHT,
}

function paintPicture(picture, art) {
  const source = picture?.querySelector('source')
  const img = picture?.querySelector('img')
  if (!source || !img) return
  const theme = document.documentElement.getAttribute('data-hp-theme') === 'light' ? 'light' : 'dark'
  const osDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  source.type = art.type
  source.srcset = art.dark
  if ((theme === 'dark') === !!osDark) source.media = '(prefers-color-scheme: dark)'
  else if (theme === 'dark') source.media = '(min-width: 0px)'
  else source.media = 'not all'
  img.src = art.light
  img.width = art.width
  img.height = art.height
  img.loading = 'lazy'
  img.decoding = 'async'
  img.remove()
  picture.appendChild(img)
}

/** Keep the route card on the same theme as the page. The map card swaps in theme.js. */
export function paintHomeMapCards(root = document) {
  paintPicture(root.querySelector?.('a.hp-map-routes picture'), ROUTE_MAPS_CARD)
}

export function paintRouteMapsCard(root = document) {
  paintHomeMapCards(root)
}
