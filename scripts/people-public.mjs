/**
 * Slim public people records built from data/people.json.
 * The research file stays outside public/. This module does not download images.
 */
import fs from 'node:fs'
import path from 'node:path'
import { PORTRAIT_CAPTIONS, creditWithCaption } from '../src/portrait-captions.js'

export const AI_CREDIT = 'Kentucky History Drive'
export const AI_LICENSE = 'Original AI illustration'
export const PORTRAIT_DIR = 'public/people/portraits'
export const PUBLIC_PEOPLE = 'public/data/people.json'

/**
 * Never ship a headshot for these ids.
 * Lomax: the Commons file is Confederate general Lunsford L. Lomax, a different man.
 * Marshall: HMarshall.jpg is Confederate general Humphrey Marshall, the grandson.
 * Crow: the Commons file is a 2024 upload with no historical source.
 * Briscoe was an infant landowner. Harrison is unidentified. Stitzel’s photo rights are unknown.
 */
export const NO_PORTRAIT_IDS = [
  'lunsford-lomax',
  'humphrey-marshall',
  'james-c-crow',
  'hezekiah-briscoe',
  'benjamin-harrison-col',
  'frederick-stitzel',
]

/** Approved AI illustrations already in the repo. Dragging Canoe is v2. */
export const AI_IDS = [
  'blackfish',
  'dragging-canoe',
  'esther-whitley',
  'evan-williams',
  'henry-skaggs',
  'jane-todd-crawford',
  'lewis-craig',
  'nonhelema',
  // Subject portraits for stories with no known likeness (Story Studio library, Oct 2026).
  'blue-jacket',
  'egushawa',
  'richard-callaway',
]

const FORBIDDEN_PUBLIC_KEYS = [
  'aliases',
  'role',
  'native',
  'likeness',
  'timing',
  'freeToUse',
  'verified',
  'notes',
  'sourcePage',
  'lifeDates',
  'imageUrl',
]

/**
 * Public domain, CC0, CC BY, or CC BY-SA. NC, ND, and vague wording are not clear enough to ship.
 */
export function isClearFreeLicense(license) {
  const s = String(license ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (/^public domain$/i.test(s)) return true
  if (/^cc0(?: 1\.0)?$/i.test(s)) return true
  if (/^cc by(?:-sa)?(?: \d(?:\.\d)?)?$/i.test(s)) return true
  return false
}

export function assertLicenseRules() {
  const yes = [
    'Public domain',
    'public domain',
    'CC0',
    'CC0 1.0',
    'CC BY',
    'CC BY 4.0',
    'CC BY-SA',
    'CC BY-SA 3.0',
    'CC BY-SA 4.0',
  ]
  const no = [
    'CC BY-NC',
    'CC BY-NC 4.0',
    'CC BY-ND 4.0',
    'CC BY-NC-SA 4.0',
    'CC BY-NC-ND 4.0',
    'All rights reserved',
    '',
    null,
    'Public domain work',
    'copyright',
  ]
  for (const license of yes) {
    if (!isClearFreeLicense(license)) throw new Error(`license should pass: ${JSON.stringify(license)}`)
  }
  for (const license of no) {
    if (isClearFreeLicense(license)) throw new Error(`license should fail: ${JSON.stringify(license)}`)
  }
}

export function isVerifiedFree(person) {
  return Boolean(person?.freeToUse && person?.verified && person?.image && isClearFreeLicense(person.license))
}

/** Doubtful likenesses that still ship, with a caption caveat. The license must be clear. */
export function isCaptionedFree(person) {
  return Boolean(PORTRAIT_CAPTIONS[person?.id] && person?.image && isClearFreeLicense(person.license))
}

export function findAiPortrait(id, dir) {
  if (!fs.existsSync(dir)) return null
  const versions = new Map()
  const re = new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}__ai-portrait-v(\\d+)-512\\.(webp|jpg)$`)
  for (const name of fs.readdirSync(dir)) {
    const match = re.exec(name)
    if (!match) continue
    const version = Number(match[1])
    const ext = match[2]
    if (!versions.has(version)) versions.set(version, {})
    versions.get(version)[ext] = name
  }
  const ready = [...versions.keys()]
    .filter((version) => versions.get(version).webp && versions.get(version).jpg)
    .sort((a, b) => b - a)
  if (!ready.length) return null
  const files = versions.get(ready[0])
  return {
    webp: `/people/portraits/${files.webp}`,
    jpg: `/people/portraits/${files.jpg}`,
  }
}

/** Stored CC0 or CC BY-SA deed. Other licenses stay unlinked. */
export function shippedLicenseUrl(person) {
  const license = String(person?.license || '')
  const url = String(person?.licenseUrl || '').trim()
  if (!url || !/^https?:\/\//i.test(url)) return null
  if (/^cc0(?:\s|$)/i.test(license) || /^cc by-sa(?:\s|$)/i.test(license)) return url
  return null
}

export function realPortraitPaths(id) {
  return {
    webp: `/people/portraits/${id}-512.webp`,
    jpg: `/people/portraits/${id}-512.jpg`,
  }
}

export function diskPath(root, publicPath) {
  return path.join(root, 'public', String(publicPath || '').replace(/^\//, ''))
}

export function portraitFilesReady(root, image) {
  if (!image?.webp || !image?.jpg) return false
  return fs.existsSync(diskPath(root, image.webp)) && fs.existsSync(diskPath(root, image.jpg))
}

/**
 * @param {object} person source record
 * @param {{webp: string, jpg: string} | null} image
 * @param {boolean} ai
 */
export function publicRecord(person, image, ai) {
  const stories = Array.isArray(person.stories) ? [...person.stories] : []
  const has = Boolean(image?.webp && image?.jpg)
  if (!has) {
    return {
      id: person.id,
      name: person.name,
      dates: person.lifeDates || null,
      image: null,
      credit: null,
      ai: false,
      license: null,
      licenseUrl: null,
      stories,
    }
  }
  const credit = creditWithCaption(person, person.credit || (ai ? AI_CREDIT : ''))
  const license = person.license || (ai ? AI_LICENSE : '')
  if (!credit || !license) {
    throw new Error(`people: ${person.id} has an image without a credit and license`)
  }
  if (!String(image.webp).startsWith('/people/portraits/') || !String(image.jpg).startsWith('/people/portraits/')) {
    throw new Error(`people: ${person.id} image is not a self-hosted portrait`)
  }
  return {
    id: person.id,
    name: person.name,
    dates: person.lifeDates || null,
    image: { webp: image.webp, jpg: image.jpg },
    credit,
    ai: Boolean(ai),
    license,
    licenseUrl: ai ? null : shippedLicenseUrl(person),
    stories,
    // Commons file name only (not the page URL), so story pages can avoid showing the same
    // image twice (portrait + Photos sidebar). Null for AI illustrations.
    sourceFile: ai ? null : commonsFileName(person.sourcePage),
  }
}

function commonsFileName(url) {
  const m = /\/wiki\/File:([^?#]+)$/.exec(String(url || ''))
  return m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null
}

export function assertPublicPeople(data) {
  if (!data || !Array.isArray(data.people)) throw new Error('people: public file is missing people[]')
  const ids = new Set()
  for (const person of data.people) {
    const keys = Object.keys(person)
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      if (keys.includes(key)) throw new Error(`people: public record ${person.id} still has ${key}`)
    }
    for (const key of ['id', 'name', 'dates', 'image', 'credit', 'ai', 'license', 'licenseUrl', 'stories']) {
      if (!keys.includes(key)) throw new Error(`people: public record ${person.id || '?'} is missing ${key}`)
    }
    if (ids.has(person.id)) throw new Error(`people: duplicate id ${person.id}`)
    ids.add(person.id)
    if (!Array.isArray(person.stories)) throw new Error(`people: ${person.id} stories is not a list`)
    if (typeof person.ai !== 'boolean') throw new Error(`people: ${person.id} ai is not a boolean`)
    if (person.licenseUrl != null && !/^https?:\/\//i.test(person.licenseUrl)) {
      throw new Error(`people: ${person.id} license URL is not an http(s) URL`)
    }
    if (person.image == null) {
      if (person.credit != null || person.license != null || person.licenseUrl != null || person.ai) {
        throw new Error(`people: ${person.id} has credit or an AI flag without an image`)
      }
      continue
    }
    if (person.ai && person.licenseUrl) {
      throw new Error(`people: ${person.id} AI illustration must not carry a license URL`)
    }
    if (!person.credit || !person.license) throw new Error(`people: ${person.id} image is missing credit or license`)
    if (person.ai && !/AI illustration/i.test(`${person.license} ${person.credit}`)) {
      throw new Error(`people: ${person.id} AI portrait credit does not say it is an illustration`)
    }
    for (const file of [person.image.webp, person.image.jpg]) {
      if (typeof file !== 'string' || !file.startsWith('/people/portraits/') || /^https?:/i.test(file)) {
        throw new Error(`people: ${person.id} image path is not local (${file})`)
      }
    }
  }
}

export function initials(name) {
  const parts = String(name || '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/[\s,]+/)
    .map((part) => part.replace(/^\.+|\.+$/g, ''))
    .filter((part) => part && !/^(of|the|and|de|du|jr|sr|ii|iii|iv)$/i.test(part))
  if (!parts.length) return '?'
  const letters = parts.filter((part) => part.length > 1)
  const usable = letters.length ? letters : parts
  if (usable.length === 1) return usable[0].slice(0, 2).toUpperCase()
  return `${usable[0][0]}${usable[usable.length - 1][0]}`.toUpperCase()
}
