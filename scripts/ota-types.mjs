/**
 * iOS OTA pack types for public/data/app/*.json.
 *
 * Expectations match the synthesized Codable models shipped in KY Markers Drive
 * builds 4 and 5 (ky-markers-drive Models.swift before the 2026-10-06 lenient
 * decoder). One bad value rejects the whole layer file on those phones.
 *
 * HistoryPlace.markerNumber is Int?: emit a JSON integer or omit the key.
 * null and numeric strings both fail this check (null decodes on device, but
 * it is how the string drift kept coming back, so the pack must not emit it).
 *
 * HistoricalMarker.markerNumber is a required String. IndustrialSite and
 * HistoricCemetery accept a String or an Int via a custom decoder. Those files
 * are checked against their own models — forcing them to integers would make
 * the markers layer fail to decode.
 *
 * NotableBurial.bioUrl is a non-optional String: null and a missing key both
 * fail. bio_url must be a non-empty string.
 *
 * Null URL values are rejected everywhere. Optional URL keys must be omitted
 * rather than set to null. A required URL that is null or missing fails.
 */
import fs from 'node:fs'
import path from 'node:path'

const S = (req) => ({ t: 'string', req })
const I = (req) => ({ t: 'int', req })
const D = (req) => ({ t: 'double', req })
const B = (req) => ({ t: 'bool', req })
const A = (req) => ({ t: 'string[]', req })

/** Synthesized Codable models (builds 4 and 5). Extra JSON keys are ignored. */
const SCHEMAS = {
  'ky-history.json': {
    id: S(true), name: S(true), subtitle: S(true), history: S(true),
    latitude: D(false), longitude: D(false),
    source_date: S(false), marker_title: S(false), geocode_source: S(false),
    category: S(false), website: S(false),
    year_start: I(false), year_end: I(false),
  },
  'distilleries.json': {
    id: S(true), name: S(true), city: S(true), county: S(true), address: S(true),
    history: S(true), website: S(true), trail_status: S(true), sources: A(true),
    latitude: D(false), longitude: D(false), founded_year: I(false),
  },
  'museums.json': {
    id: S(true), name: S(true), city: S(true), county: S(true), address: S(true), history: S(true),
    latitude: D(false), longitude: D(false), founded_year: I(false),
    website: S(false), museum_type: S(false), geocode_source: S(false), sources: A(false),
  },
  'national-sites.json': {
    id: S(true), name: S(true), city: S(true), county: S(true), address: S(true),
    designation: S(true), history: S(true),
    latitude: D(false), longitude: D(false), website: S(false),
    geocode_source: S(false), overlap: S(false), sources: A(false),
  },
  'war-sites.json': {
    id: S(true), name: S(true), city: S(true), county: S(true), address: S(true),
    war: S(true), site_type: S(true), history: S(true),
    latitude: D(false), longitude: D(false), website: S(false),
    geocode_source: S(false), sources: A(false),
  },
  'locals.json': {
    id: S(true), name: S(true), city: S(true), county: S(true), address: S(true), history: S(true),
    latitude: D(false), longitude: D(false), category: S(false), cuisine_or_type: S(false),
    website: S(false), yelp_rating: D(false), google_rating: D(false), combined_rating: D(false),
    rating_note: S(false), review_count_approx: I(false), geocode_source: S(false), sources: A(false),
  },
  'covered-bridges.json': {
    id: S(true), name: S(true), city: S(true), county: S(true), history: S(true),
    latitude: D(false), longitude: D(false), built_year: I(false), length_ft: I(false),
    crosses: S(false), truss: S(false), status: S(false), website: S(false), sources: A(false),
  },
  'newspapers.json': {
    id: S(true), name: S(true), title_full: S(true), city: S(true), county: S(true),
    lccn: S(true), history: S(true),
    latitude: D(false), longitude: D(false), first_year: I(false), last_year: I(false),
    issue_count: I(false), frequency: S(false), loc_url: S(false), chronicling_america_url: S(false),
    sources: A(false),
  },
  'state-parks.json': {
    id: S(true), name: S(true), city: S(true), county: S(true), park_type: S(true),
    has_restaurant: B(true), history: S(true),
    latitude: D(false), longitude: D(false), restaurant_name: S(false), restaurant_location: S(false),
    yelp_rating: D(false), google_rating: D(false), combined_rating: D(false), rating_note: S(false),
    website: S(false), sources: A(false), geocode_source: S(false),
  },
  'historic-photos.json': {
    id: S(true), title: S(true), description: S(true), source: S(true), source_url: S(true),
    year: S(false), date_text: S(false), latitude: D(false), longitude: D(false),
    city: S(false), county: S(false), image_url: S(false), collection: S(false),
    related_place_names: A(false), historypin_id: I(false), tags: A(false),
  },
  'markers.phase1.json': {
    marker_number: S(true), title: S(true), county: S(true), location_text: S(true),
    inscription: S(true), source_url: S(true), subjects: A(true),
    latitude: D(false), longitude: D(false), phase: I(false),
  },
}

const URL_KEY = /(^website$|_url$|^url$)/i

export function isUrlKey(key) {
  return URL_KEY.test(key)
}

function isInt(n) {
  return typeof n === 'number' && Number.isInteger(n)
}

function isNum(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

/** Integer from a JSON integer or an integer string. null if there is no number. */
export function coerceMarkerInt(value) {
  if (value == null || value === '') return null
  if (isInt(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

/**
 * HistoryPlace emission rule: marker_number is an integer or the key is absent.
 * Null URL keys are removed. Returns true when `place` changed.
 */
export function canonicalizeHistoryPlace(place) {
  if (!place || typeof place !== 'object') return false
  let changed = false
  if ('marker_number' in place) {
    const next = coerceMarkerInt(place.marker_number)
    if (next == null) {
      delete place.marker_number
      changed = true
    } else if (place.marker_number !== next) {
      place.marker_number = next
      changed = true
    }
  }
  if (omitNullUrls(place)) changed = true
  return changed
}

/** Delete URL keys whose value is null. Recurses into objects and arrays. */
export function omitNullUrls(node) {
  if (Array.isArray(node)) {
    let changed = false
    for (const el of node) {
      if (el && typeof el === 'object' && omitNullUrls(el)) changed = true
    }
    return changed
  }
  if (!node || typeof node !== 'object') return false
  let changed = false
  for (const key of Object.keys(node)) {
    if (isUrlKey(key) && node[key] === null) {
      delete node[key]
      changed = true
    } else if (node[key] && typeof node[key] === 'object') {
      if (omitNullUrls(node[key])) changed = true
    }
  }
  return changed
}

function labelOf(obj, index) {
  const id = obj && (obj.id || obj.name || obj.marker_number || obj.site_id || obj.title)
  return id ? `[${index}] ${id}` : `[${index}]`
}

function checkValue(spec, value, where, issues, file) {
  if (value === undefined) return
  if (value === null) {
    if (spec.req) issues.push(`${file} ${where}: null but required ${spec.t}`)
    return
  }
  if (spec.t === 'string') {
    if (typeof value !== 'string') issues.push(`${file} ${where}: ${typeof value} but String expected`)
  } else if (spec.t === 'int') {
    if (!isInt(value)) issues.push(`${file} ${where}: ${JSON.stringify(value)} (${typeof value}) but Int expected`)
  } else if (spec.t === 'double') {
    if (!isNum(value)) issues.push(`${file} ${where}: ${typeof value} but Double expected`)
  } else if (spec.t === 'bool') {
    if (typeof value !== 'boolean') issues.push(`${file} ${where}: ${typeof value} but Bool expected`)
  } else if (spec.t === 'string[]') {
    if (!Array.isArray(value)) issues.push(`${file} ${where}: ${typeof value} but [String] expected`)
    else value.forEach((el, i) => {
      if (typeof el !== 'string') issues.push(`${file} ${where}[${i}]: ${typeof el} in [String]`)
    })
  }
}

function checkSchema(file, data, schema, issues) {
  if (!Array.isArray(data)) {
    issues.push(`${file}: expected a JSON array`)
    return
  }
  data.forEach((obj, i) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      issues.push(`${file}[${i}]: expected an object`)
      return
    }
    const where = labelOf(obj, i)
    for (const [key, spec] of Object.entries(schema)) {
      if (!(key in obj)) {
        if (spec.req) issues.push(`${file} ${where}: missing required ${key}`)
        continue
      }
      checkValue(spec, obj[key], `${where}.${key}`, issues, file)
    }
  })
}

function checkStringOrInt(file, obj, key, where, issues, { required = false } = {}) {
  if (!(key in obj) || obj[key] == null) {
    if (required) issues.push(`${file} ${where}: missing/null ${key}`)
    return
  }
  const v = obj[key]
  if (typeof v !== 'string' && !isInt(v)) issues.push(`${file} ${where}.${key}: ${typeof v} but String or Int expected`)
}

function checkIndustrial(file, data, issues) {
  if (!Array.isArray(data)) {
    issues.push(`${file}: expected a JSON array`)
    return
  }
  const required = ['id', 'name', 'city', 'county', 'industry_type', 'history']
  data.forEach((o, i) => {
    const where = labelOf(o, i)
    for (const key of required) {
      if (!(key in o) || o[key] == null) issues.push(`${file} ${where}: missing/null ${key}`)
      else if (typeof o[key] !== 'string') issues.push(`${file} ${where}.${key}: ${typeof o[key]} but String expected`)
    }
    for (const key of ['address', 'website', 'geocode_source']) {
      if (key in o && o[key] != null && typeof o[key] !== 'string') issues.push(`${file} ${where}.${key}: ${typeof o[key]} but String expected`)
    }
    for (const key of ['latitude', 'longitude']) {
      if (key in o && o[key] != null && !isNum(o[key])) issues.push(`${file} ${where}.${key}: ${typeof o[key]} but Double expected`)
    }
    if ('built_year' in o && o.built_year != null && !isInt(o.built_year)) issues.push(`${file} ${where}.built_year: ${JSON.stringify(o.built_year)} but Int expected`)
    if ('sources' in o && o.sources != null) checkValue(A(false), o.sources, `${where}.sources`, issues, file)
    if ('nrhp' in o && o.nrhp != null && typeof o.nrhp !== 'string' && typeof o.nrhp !== 'boolean') {
      issues.push(`${file} ${where}.nrhp: ${typeof o.nrhp} but String or Bool expected`)
    }
    checkStringOrInt(file, o, 'marker_number', where, issues)
  })
}

function checkBurial(file, burial, where, issues) {
  if (!burial || typeof burial !== 'object') {
    issues.push(`${file} ${where}: expected an object`)
    return
  }
  if (typeof burial.name !== 'string' || !burial.name) issues.push(`${file} ${where}.name: required String`)
  if (typeof burial.significance !== 'string') issues.push(`${file} ${where}.significance: required String`)
  if (!('bio_url' in burial) || burial.bio_url == null) {
    issues.push(`${file} ${where}.bio_url: required non-empty String (null or missing fails NotableBurial)`)
  } else if (typeof burial.bio_url !== 'string' || !burial.bio_url.trim()) {
    issues.push(`${file} ${where}.bio_url: required non-empty String`)
  }
  if ('lifespan' in burial && burial.lifespan != null && typeof burial.lifespan !== 'string') {
    issues.push(`${file} ${where}.lifespan: ${typeof burial.lifespan} but String expected`)
  }
}

function checkCemeteries(file, data, issues) {
  if (!Array.isArray(data)) {
    issues.push(`${file}: expected a JSON array`)
    return
  }
  const required = ['id', 'name', 'city', 'county', 'cemetery_type', 'history', 'why_historic_url']
  data.forEach((o, i) => {
    const where = labelOf(o, i)
    for (const key of required) {
      if (!(key in o) || o[key] == null) issues.push(`${file} ${where}: missing/null ${key}`)
      else if (typeof o[key] !== 'string') issues.push(`${file} ${where}.${key}: ${typeof o[key]} but String expected`)
      else if (key === 'why_historic_url' && !o[key].trim()) issues.push(`${file} ${where}.why_historic_url: empty String`)
    }
    for (const key of ['website', 'geocode_source']) {
      if (key in o && o[key] != null && typeof o[key] !== 'string') issues.push(`${file} ${where}.${key}: ${typeof o[key]} but String expected`)
    }
    for (const key of ['latitude', 'longitude']) {
      if (key in o && o[key] != null && !isNum(o[key])) issues.push(`${file} ${where}.${key}: ${typeof o[key]} but Double expected`)
    }
    if ('established_year' in o && o.established_year != null && !isInt(o.established_year)) {
      issues.push(`${file} ${where}.established_year: ${JSON.stringify(o.established_year)} but Int expected`)
    }
    if ('sources' in o && o.sources != null) checkValue(A(false), o.sources, `${where}.sources`, issues, file)
    if ('nrhp' in o && o.nrhp != null && typeof o.nrhp !== 'string' && typeof o.nrhp !== 'boolean') {
      issues.push(`${file} ${where}.nrhp: ${typeof o.nrhp} but String or Bool expected`)
    }
    checkStringOrInt(file, o, 'marker_number', where, issues)
    if ('notable_burials' in o && o.notable_burials != null) {
      if (!Array.isArray(o.notable_burials)) issues.push(`${file} ${where}.notable_burials: expected an array`)
      else o.notable_burials.forEach((b, j) => checkBurial(file, b, `${where}.notable_burials[${j}]`, issues))
    }
  })
}

function checkSitePhotos(file, data, issues) {
  if (!Array.isArray(data)) {
    issues.push(`${file}: expected a JSON array`)
    return
  }
  data.forEach((o, i) => {
    const where = labelOf(o, i)
    for (const key of ['layer', 'site_id']) {
      if (typeof o[key] !== 'string') issues.push(`${file} ${where}.${key}: required String`)
    }
    if ('site_name' in o && o.site_name != null && typeof o.site_name !== 'string') issues.push(`${file} ${where}.site_name: ${typeof o.site_name} but String expected`)
    if (!Array.isArray(o.photos)) {
      issues.push(`${file} ${where}.photos: required array`)
      return
    }
    o.photos.forEach((ph, j) => {
      const photoWhere = `${where}.photos[${j}]`
      for (const key of ['photo_id', 'title', 'source_url']) {
        if (!(key in ph) || ph[key] == null) issues.push(`${file} ${photoWhere}: missing/null ${key}`)
        else if (typeof ph[key] !== 'string') issues.push(`${file} ${photoWhere}.${key}: ${typeof ph[key]} but String expected`)
      }
      if ('distance_m' in ph && ph.distance_m != null && !isInt(ph.distance_m)) {
        issues.push(`${file} ${photoWhere}.distance_m: ${JSON.stringify(ph.distance_m)} but Int expected`)
      }
      for (const key of ['year', 'image_url', 'collection', 'description']) {
        if (key in ph && ph[key] != null && typeof ph[key] !== 'string') issues.push(`${file} ${photoWhere}.${key}: ${typeof ph[key]} but String expected`)
      }
    })
  })
}

/**
 * History marker_number policy, stricter than Swift's Int? (which accepts null):
 * every entry has an integer or no key at all.
 */
function checkHistoryMarkerPolicy(data, issues) {
  if (!Array.isArray(data)) return
  data.forEach((obj, i) => {
    if (!obj || typeof obj !== 'object' || !('marker_number' in obj)) return
    const v = obj.marker_number
    if (!isInt(v)) {
      issues.push(`ky-history.json ${labelOf(obj, i)}.marker_number: ${JSON.stringify(v)} (${v === null ? 'null' : typeof v}) but integer-or-absent required`)
    }
  })
}

function walkNullUrls(node, file, where, issues) {
  if (Array.isArray(node)) {
    node.forEach((el, i) => walkNullUrls(el, file, `${where}[${i}]`, issues))
    return
  }
  if (!node || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    const next = `${where}.${key}`
    if (isUrlKey(key) && value === null) issues.push(`${file} ${next}: null URL (omit the key, or supply a non-empty string when the model requires one)`)
    else if (value && typeof value === 'object') walkNullUrls(value, file, next, issues)
  }
}

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'))
}

/**
 * Validate an OTA directory. Returns a list of human-readable failures (empty = ok).
 * @param {string} dir directory containing the public/data/app JSON files
 * @param {{ requireAll?: boolean }} [options] requireAll (default true) fails when a modeled layer file is absent
 */
export function checkOtaPack(dir, { requireAll = true } = {}) {
  const issues = []
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  const parsed = new Map()
  for (const file of files) {
    try {
      parsed.set(file, readJson(path.join(dir, file)))
    } catch (err) {
      issues.push(`${file}: invalid JSON (${err.message})`)
    }
  }

  for (const [file, schema] of Object.entries(SCHEMAS)) {
    if (!parsed.has(file)) {
      if (requireAll) issues.push(`${file}: missing`)
      continue
    }
    checkSchema(file, parsed.get(file), schema, issues)
  }
  if (parsed.has('industrial-sites.json')) checkIndustrial('industrial-sites.json', parsed.get('industrial-sites.json'), issues)
  if (parsed.has('historic-cemeteries.json')) checkCemeteries('historic-cemeteries.json', parsed.get('historic-cemeteries.json'), issues)
  if (parsed.has('site-historic-photos.json')) checkSitePhotos('site-historic-photos.json', parsed.get('site-historic-photos.json'), issues)
  if (parsed.has('ky-history.json')) checkHistoryMarkerPolicy(parsed.get('ky-history.json'), issues)

  for (const [file, data] of parsed) walkNullUrls(data, file, '$', issues)

  const history = parsed.get('ky-history.json')
  const manifest = parsed.get('ky-history-manifest.json')
  if (manifest && (typeof manifest !== 'object' || Array.isArray(manifest))) {
    issues.push('ky-history-manifest.json: expected an object')
  } else if (manifest) {
    if (!isInt(manifest.data_version)) issues.push('ky-history-manifest.json: data_version must be an integer')
    if (!isInt(manifest.entry_count)) issues.push('ky-history-manifest.json: entry_count must be an integer')
    else if (Array.isArray(history) && manifest.entry_count !== history.length) {
      issues.push(`ky-history-manifest.json: entry_count ${manifest.entry_count} != ky-history.json length ${history.length}`)
    }
  }

  return issues
}
