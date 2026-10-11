/**
 * Homepage "Route maps" card art.
 * Story Studio: swap this base path when the final card art is ready.
 * The files are `${ROUTE_MAPS_CARD_ART}-light.webp` and `${ROUTE_MAPS_CARD_ART}-dark.webp`.
 */
export const ROUTE_MAPS_CARD_ART =
  '/maps/routes/athiamiowee-the-warriors-path-through-kentucky/warriors-path-home-card'

export const ROUTE_MAPS_CARD_WIDTH = 640
export const ROUTE_MAPS_CARD_HEIGHT = 400

/** Point the homepage card <picture> at ROUTE_MAPS_CARD_ART. */
export function paintRouteMapsCard(root = document) {
  const link = root.querySelector?.('a.hp-map-routes')
  const picture = link?.querySelector('picture')
  const source = picture?.querySelector('source')
  const img = picture?.querySelector('img')
  if (!source || !img) return
  const light = `${ROUTE_MAPS_CARD_ART}-light.webp`
  const dark = `${ROUTE_MAPS_CARD_ART}-dark.webp`
  const theme = document.documentElement.getAttribute('data-hp-theme') === 'light' ? 'light' : 'dark'
  const osDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  source.type = 'image/webp'
  source.srcset = dark
  if ((theme === 'dark') === !!osDark) source.media = '(prefers-color-scheme: dark)'
  else if (theme === 'dark') source.media = '(min-width: 0px)'
  else source.media = 'not all'
  img.src = light
  img.width = ROUTE_MAPS_CARD_WIDTH
  img.height = ROUTE_MAPS_CARD_HEIGHT
  img.alt = ''
  img.loading = 'lazy'
  img.decoding = 'async'
  img.remove()
  picture.appendChild(img)
}
