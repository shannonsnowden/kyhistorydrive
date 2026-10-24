#!/usr/bin/env node
// Curated Commons photos keep license fields so a CC BY-SA credit renders on the story.
import assert from 'node:assert/strict'
import { curatedPublicPhoto } from './build-home-preview.mjs'
import { photoCreditHtml } from '../src/photo-credit.js'

const photo = curatedPublicPhoto('muir-site-early-fort-ancient', {
  ext: 'jpg',
  title: 'A Fort Ancient ceramic storage jar from an Ohio site; not from the Muir site in Jessamine County',
  source_url: 'https://commons.wikimedia.org/wiki/File:Fort_Ancient_Storage_jar_HRoe_2011.jpg',
  source_label: 'Wikimedia Commons',
  attribution: 'Herb Roe · Wikimedia Commons · CC BY-SA 3.0',
  year: 2011,
  credit: 'Herb Roe',
  license: 'CC BY-SA 3.0',
  license_url: 'https://creativecommons.org/licenses/by-sa/3.0/',
})
assert.equal(photo.credit, 'Herb Roe')
assert.equal(photo.license, 'CC BY-SA 3.0')
assert.equal(photo.license_url, 'https://creativecommons.org/licenses/by-sa/3.0/')
assert.equal(photo.image_url, '/content/photos/stories/muir-site-early-fort-ancient.jpg')
const html = photoCreditHtml(photo)
assert.match(html, /Herb Roe/)
assert.match(html, /href="https:\/\/creativecommons\.org\/licenses\/by-sa\/3\.0\/"/)
assert.match(html, /CC BY-SA 3\.0/)
console.log('test-curated-photo-credit: OK')
