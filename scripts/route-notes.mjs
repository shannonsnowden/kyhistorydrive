/**
 * Waypoints from a route NOTES.md table.
 * A row counts only when its coordinate cell is one latitude/longitude pair.
 * Ranges, arrows, and semicolon-separated pairs are left out.
 */

/** One lat/lon pair, or null when the cell is a range or more than one point. */
export function parseSingleCoordinate(cell) {
  const raw = String(cell || '').trim()
  if (!raw || raw === '—' || raw === '-') return null
  // Parenthetical notes ("rounded to 0.1°, protected site") are not a second point.
  const withoutNotes = raw.replace(/\([^)]*\)/g, ' ')
  if (withoutNotes.includes(';') || withoutNotes.includes('→') || /\bto\b/i.test(withoutNotes)) return null
  if (/\d\s*[–—]\s*\d/.test(withoutNotes)) return null
  if (/\d\s+-\s+\d/.test(withoutNotes)) return null
  const match = withoutNotes.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const rest = withoutNotes.replace(match[0], '')
  if (/\d/.test(rest)) return null
  const lat = Number(match[1])
  const lon = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return {
    lat,
    lon,
    latText: match[1],
    lonText: match[2],
    marked: /[≈~]/.test(raw),
  }
}

function splitRow(line) {
  const cells = String(line).trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  return cells.map((cell) => cell.trim())
}

function isSeparator(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell))
}

function findColumn(headers, test) {
  return headers.findIndex((header) => test(header))
}

/**
 * The waypoint table under the first "## Waypoints" heading.
 * `approximate` is true when that heading says the coordinates are approximate.
 */
export function parseRouteNotes(markdown) {
  const lines = String(markdown || '').split(/\r?\n/)
  let heading = ''
  let inSection = false
  let headers = null
  const tableRows = []
  for (const line of lines) {
    if (/^##\s+Waypoints\b/i.test(line)) {
      heading = line.replace(/^##\s+/, '').trim()
      inSection = true
      headers = null
      continue
    }
    if (inSection && /^##\s+/.test(line)) break
    if (!inSection || !line.trim().startsWith('|')) continue
    const cells = splitRow(line)
    if (isSeparator(cells)) continue
    if (!headers) {
      headers = cells.map((cell) => cell.toLowerCase())
      continue
    }
    tableRows.push(cells)
  }
  if (!headers) return { heading, approximate: /approximate/i.test(heading), points: [] }
  const coordIdx = findColumn(headers, (header) => header.includes('lat'))
  const stopIdx = findColumn(headers, (header) => header.includes('stop'))
  const placeIdx = findColumn(headers, (header) => header.includes('town') || header.includes('area'))
  const countyIdx = findColumn(headers, (header) => header.includes('county'))
  const confidenceIdx = findColumn(headers, (header) => header.includes('confidence'))
  const sectionApproximate = /approximate/i.test(heading)
  const points = []
  for (const cells of tableRows) {
    if (coordIdx < 0) continue
    const coord = parseSingleCoordinate(cells[coordIdx] || '')
    if (!coord) continue
    const confidence = confidenceIdx >= 0 ? cells[confidenceIdx] || '' : ''
    const conjectural = /conjectural/i.test(confidence)
    points.push({
      name: (stopIdx >= 0 ? cells[stopIdx] : '') || '',
      place: placeIdx >= 0 ? cells[placeIdx] || '' : '',
      county: countyIdx >= 0 ? cells[countyIdx] || '' : '',
      confidence,
      lat: coord.lat,
      lon: coord.lon,
      latText: coord.latText,
      lonText: coord.lonText,
      approximate: sectionApproximate || coord.marked || /approx|conjectural/i.test(confidence),
      conjectural,
    })
  }
  return { heading, approximate: sectionApproximate, points }
}
