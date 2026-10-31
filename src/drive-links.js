/**
 * Maps handoff links for drives. Pure functions, no DOM.
 * SECURITY: every coordinate in these URLs comes from a STOP. The visitor's start (typed place or
 * geolocation) is never a parameter here, so it cannot end up in a link. Leg 1 has no origin (the maps
 * app uses the device's own location); leg k>1 starts at leg k-1's last stop.
 * Caps: 4 stops per leg everywhere (Google allows 3 waypoints + destination in phone browsers;
 *   Apple repeats waypoint= on /directions, documented for iOS 18.4+), so both apps open the same stops.
 */
// One cap for every app and screen: 4 stops per leg (3 waypoints + destination). That fits Google's
// phone-browser limit and Apple's documented multistop, and matches the legs shown to visitors.
export const LEG_STOPS = 4
export const legSize = () => LEG_STOPS
const ll = (s) => `${s.lat.toFixed(4)},${s.lon.toFixed(4)}`
export function googleUrl(from, stops) {
  // from: previous leg's last stop (a stop, never the visitor), or null for leg 1 (the app uses the device).
  const dest = stops[stops.length - 1]
  const way = stops.slice(0, -1).map(ll).join('|')
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving' + (from ? `&origin=${encodeURIComponent(ll(from))}` : '') +
    `&destination=${encodeURIComponent(ll(dest))}` + (way ? `&waypoints=${encodeURIComponent(way)}` : '')
}
export function appleUrl(from, stops) {
  const dest = stops[stops.length - 1]
  const u = new URL('https://maps.apple.com/directions')
  if (from) u.searchParams.set('source', ll(from))
  u.searchParams.set('destination', ll(dest))
  for (const s of stops.slice(0, -1)) u.searchParams.append('waypoint', ll(s))
  u.searchParams.set('mode', 'driving')
  return u.toString()
}
/** Split the ordered stops into legs of at most n stops; leg k>1 starts at leg k-1's last stop. */
export function buildLegs(order, n, app) {
  const legs = []
  for (let i = 0, k = 1; i < order.length; i += n, k++) {
    const from = i ? order[i - 1] : null
    const stops = order.slice(i, i + n)
    legs.push({ k, firstNo: i ? i : 1, lastNo: i + stops.length, url: (app === 'apple' ? appleUrl : googleUrl)(from, stops) })
  }
  return legs
}
