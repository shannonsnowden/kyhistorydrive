/**
 * Drive card photos (image / credit / alt) and the Big Bone Lick homepage lead.
 * Empty image keeps the theme icon. Filled image renders on the card and the drive page.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { applyThemeIcons } from './apply-drive-theme-icons.mjs'
import { HERO_DEFAULT } from './hero-default.mjs'
import { withDefaultHero } from '../src/home-hero-render.js'
import {
  applyDriveIndexPhotos,
  applyDrivePagePhoto,
  loadDrivePhotos,
  normalizeDrivePhoto,
  touristTripImage,
} from './drive-photos.mjs'

const themes = JSON.parse(fs.readFileSync('scripts/drive-theme-icons.json', 'utf8'))
const photos = loadDrivePhotos()
assert.equal(photos.size, 24)
for (const slug of Object.keys(themes.drives)) {
  const photo = photos.get(slug)
  assert.ok(photo, `${slug} has no photo`)
  assert.equal(photo.image, `/content/photos/drives/drive-${slug}.jpg`)
  assert.match(photo.credit, / · Wikimedia Commons · /)
  assert.match(photo.alt, / — /)
  assert.ok(fs.existsSync(path.join('public', photo.image.slice(1))), photo.image)
  const page = fs.readFileSync(`public/drives/${slug}/index.html`, 'utf8')
  assert.equal(applyDrivePagePhoto(page, photo), page, `${slug} page drifted from drive-photos`)
  assert.equal((page.match(/<img\b/g) || []).length, 1, `${slug} should have one photo`)
  assert.ok(page.includes(`alt="${photo.alt.replace(/&/g, '&amp;').replace(/'/g, '&#x27;')}"`) || page.includes(`alt="${photo.alt.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')}"`))
  assert.ok(page.includes(`https://kyhistorydrive.com${photo.image}`), `${slug} og:image`)
  assert.ok(page.includes(`"image":"https://kyhistorydrive.com${photo.image}"`), `${slug} TouristTrip image`)
}

const idx = fs.readFileSync('public/drives/index.html', 'utf8')
assert.equal(applyDriveIndexPhotos(idx, photos), idx, '/drives/ index drifted from drive-photos')
assert.equal((idx.match(/class="dcard-photo"/g) || []).length, 24)
assert.equal((idx.match(/<img\b/g) || []).length, 24)
assert.equal((idx.match(/property="og:image"/g) || []).length, 0, 'listing keeps its existing og')

const cleared = new Map([...photos].map(([slug]) => [slug, null]))
const bare = `<!doctype html><html><head></head><body>
  <h2>Themed drives</h2>
  <ul class="grid"><li class="dcard"><a href="/drives/licking-valley/"><span class="tag">Themed drive</span>
<h3>Licking Valley</h3><p class="muted">Intro.</p>
<p class="facts"><span><b>7</b> stops</span></p></a></li></ul>
</body></html>`
assert.equal(applyDriveIndexPhotos(bare, cleared), bare)
const one = new Map([['licking-valley', photos.get('licking-valley')]])
const filled = applyDriveIndexPhotos(bare, one)
assert.equal(applyDriveIndexPhotos(filled, one), filled)
assert.match(filled, /class="dcard-photo"/)
assert.match(filled, /Greg Hume/)
assert.match(filled, /Jerrye &amp; Roy|Greg Hume/)
assert.doesNotMatch(applyDriveIndexPhotos(filled, cleared), /dcard-photo/)

const pageBare = `<!doctype html><html><head></head><body><main>
  <h1>Licking Valley</h1>
  <p class="muted" style="margin:0">Intro.</p>
  <div class="facts" id="facts"></div>
</main></body></html>`
assert.equal(applyDrivePagePhoto(pageBare, null), pageBare)
const pageFilled = applyDrivePagePhoto(pageBare, photos.get('licking-valley'))
assert.equal(applyDrivePagePhoto(pageFilled, photos.get('licking-valley')), pageFilled)
assert.equal(applyDrivePagePhoto(pageFilled, null), pageBare)
assert.match(pageFilled, /property="og:image" content="https:\/\/kyhistorydrive.com\/content\/photos\/drives\/drive-licking-valley.jpg"/)
assert.doesNotMatch(pageFilled, /og:image:width/)
assert.deepEqual(touristTripImage(null), {})
assert.deepEqual(touristTripImage(photos.get('cave-country')), {
  image: 'https://kyhistorydrive.com/content/photos/drives/drive-cave-country.jpg',
})

assert.throws(() => normalizeDrivePhoto('x', { image: 'https://example.com/a.jpg', alt: 'A', credit: '' }, { checkFile: false }))
assert.throws(() => normalizeDrivePhoto('x', { image: '/content/photos/../secret.jpg', alt: 'A', credit: '' }, { checkFile: false }))
assert.throws(() => normalizeDrivePhoto('x', { image: '/content/photos/drives/a.jpg', alt: '', credit: '' }, { checkFile: false }))
assert.equal(normalizeDrivePhoto('x', { image: '', credit: 'nope', alt: '' }), null)

const iconHtml = applyThemeIcons(idx, themes)
const card = (html, slug) => html.match(new RegExp(`<li class="dcard"><a href="/drives/${slug}/">([\\s\\S]*?)</a>`))[1]
assert.equal((iconHtml.match(/class="dcard-photo"/g) || []).length, 24)
assert.doesNotMatch(card(iconHtml, 'pennyrile'), /class="ticon"/)
assert.doesNotMatch(iconHtml, /theme-legend/)
const iconOnly = applyThemeIcons(bare, themes)
assert.match(card(iconOnly, 'licking-valley'), /class="ticon"/)
assert.match(iconOnly, /aria-label="Drive theme icons"/)
assert.match(iconOnly, /\/icons\/covered-bridge-disc.png/)
const mixed = applyThemeIcons(filled, themes)
assert.doesNotMatch(card(mixed, 'licking-valley'), /class="ticon"/)

assert.equal(HERO_DEFAULT.image, '/content/photos/heroes/hero-big-bone-lick.jpg')
assert.equal(HERO_DEFAULT.credit, 'Mattguyver · Wikimedia Commons · CC BY 3.0')
assert.equal(HERO_DEFAULT.lat, undefined)
assert.equal(HERO_DEFAULT.lon, undefined)
assert.equal('historyId' in HERO_DEFAULT, true)
assert.doesNotMatch(fs.readFileSync('scripts/hero-default.mjs', 'utf8'), /-?\d{2}\.\d{2,}/)
assert.doesNotMatch(fs.readFileSync('src/home-hero-render.js', 'utf8'), /pin\.lat|pin\.lon/)
assert.ok(fs.existsSync('public/content/photos/heroes/hero-big-bone-lick.jpg'))
assert.ok(fs.existsSync('public/content/photos/heroes/hero-columbus-belmont-mississippi.jpg'))
const slides = withDefaultHero([
  { slug: 'father-david-rice-and-kentuckys-first-presbyterian-churches', title: 'Rice', photo: { image_url: '/content/photos/stories/rice.jpg' } },
  { slug: 'la-grange-the-oldham-county-seat-with-trains-on-main-street', title: 'La Grange' },
])
assert.equal(slides[0].slug, 'big-bone-lick-older-cycle')
assert.equal(slides[0].photo.image_url, HERO_DEFAULT.image)
assert.equal(slides[0].photo.attribution, HERO_DEFAULT.credit)
assert.equal(slides[1].slug, 'father-david-rice-and-kentuckys-first-presbyterian-churches')
assert.equal(slides.length, 3)

const css = fs.readFileSync('src/styles.css', 'utf8')
assert.match(css, /rgba\(8, 12, 9, 0\.55\) 0%,\s*rgba\(8, 12, 9, 0\.32\) 22%,\s*rgba\(8, 12, 9, 0\.10\) 38%,\s*rgba\(8, 12, 9, 0\) 45%/)
assert.match(css, /rgba\(20, 14, 8, 0\.62\) 0%,\s*rgba\(20, 14, 8, 0\.40\) 26%,\s*rgba\(20, 14, 8, 0\.14\) 40%,\s*rgba\(20, 14, 8, 0\) 48%/)
assert.match(css, /\.hp-mag-hero \.hp-mag-hero-copy \{[^}]*background: rgba\(8, 12, 9, 0\.42\)/)
assert.doesNotMatch(css, /rgba\(20, 14, 8, 0\.94\)/)
assert.doesNotMatch(css, /rgba\(8, 12, 9, 0\.78\) 0%/)

console.log('test-drive-photos: 24 drive photos, icon fallback, Big Bone Lick hero, shade')
