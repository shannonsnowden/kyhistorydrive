/**
 * GPX 1.1 for a curated drive. Waypoints only (plus a route of those same points).
 * Geo gate matches TouristTrip in build-drive-pages.mjs: omit private and approx.
 * Protected, archaeology, and private-land stops are published that way; build-byod-stops
 * fails the build if a sensitive stop is not marked private or approx.
 * The road line stays out of the file so a driving trace cannot add fine coordinates
 * the stop list itself does not publish.
 */

const FLAG = {
  private: 'Private land',
  marker: 'Marker only',
  paid: 'Paid admission',
  limited: 'Limited hours',
  reservation: 'Reservation needed',
}

/** True when TouristTrip JSON-LD omits Place.geo for this stop. */
export function stopOmitsDriveGeo(stop) {
  return !!(stop && (stop.private || stop.approx))
}

/** Access text plus flag labels. No new copy, no coordinates. */
export function visitingPlain(stop) {
  const labels = []
  for (const flag of stop.flags || []) {
    if (flag === 'private') continue
    labels.push(FLAG[flag] || String(flag))
  }
  const parts = []
  if (stop.access) parts.push(String(stop.access).replace(/\s+/g, ' ').trim())
  if (labels.length) parts.push(labels.join(', '))
  return parts.filter(Boolean).map((part, i) => (i < parts.length - 1 && !/[.!?]$/.test(part) ? `${part}.` : part)).join(' ')
}

function xmlText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]))
}

function coordAttr(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error('drive-gpx: coordinate must be a finite number')
  const s = String(n)
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`drive-gpx: refused coordinate ${s}`)
  return s
}

function pointXml(tag, point, indent) {
  const pad = ' '.repeat(indent)
  const visit = visitingPlain(point.stop)
  const desc = visit ? `Visiting: ${visit}` : 'Public stop'
  return `${pad}<${tag} lat="${point.lat}" lon="${point.lon}">\n${pad}  <name>${xmlText(`${point.n}. ${point.stop.name}`)}</name>\n${pad}  <desc>${xmlText(desc)}</desc>\n${pad}</${tag}>`
}

/**
 * @param {{ name: string, desc?: string, url: string, stops: object[] }} drive
 * @returns {string} GPX 1.1 document
 */
export function renderDriveGpx({ name, desc, url, stops }) {
  if (!name || !url) throw new Error('drive-gpx: name and url are required')
  const kept = []
  const omitted = []
  stops.forEach((stop, i) => {
    if (stopOmitsDriveGeo(stop)) {
      omitted.push(stop)
      return
    }
    kept.push({ stop, n: i + 1, lat: coordAttr(stop.lat), lon: coordAttr(stop.lon) })
  })
  const summary = `${desc ? `${String(desc).replace(/\s+/g, ' ').trim()} ` : ''}Public, exact waypoints only. Private land and approximate stops are omitted. ${url}`
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Kentucky History Drive" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    `    <name>${xmlText(name)}</name>`,
    `    <desc>${xmlText(summary)}</desc>`,
    `    <link href="${xmlText(url)}"><text>${xmlText(name)}</text></link>`,
    '  </metadata>',
    ...kept.map((point) => pointXml('wpt', point, 2)),
    '  <rte>',
    `    <name>${xmlText(name)}</name>`,
    `    <desc>${xmlText(summary)}</desc>`,
    ...kept.map((point) => pointXml('rtept', point, 4)),
    '  </rte>',
    '</gpx>',
    '',
  ]
  const gpx = lines.join('\n')
  for (const stop of omitted) {
    if (typeof stop.lat !== 'number' || typeof stop.lon !== 'number') continue
    const pair = `lat="${coordAttr(stop.lat)}" lon="${coordAttr(stop.lon)}"`
    if (gpx.includes(pair)) throw new Error(`drive-gpx: omitted stop ${stop.id || stop.name} leaked into GPX`)
  }
  return gpx
}
