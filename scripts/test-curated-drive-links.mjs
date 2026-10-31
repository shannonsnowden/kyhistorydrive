/**
 * Curated drive pages hand Apple Maps and Google Maps the same public exact stops,
 * in order, in legs of LEG_STOPS. Private and approximate coordinates never appear
 * in a route URL. Leg 1 has no origin. Drive buttons do not use single-stop daddr=.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { LEG_STOPS, buildLegs } from '../src/drive-links.js'
import { parseJsLiteral } from './js-literal.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const dp = path.join(root, 'public/drives')
const ll = (s) => `${s.lat.toFixed(4)},${s.lon.toFixed(4)}`

function stopsOf(url, app) {
  const u = new URL(url)
  const p = u.searchParams
  if (app === 'apple') {
    const origin = p.get('source')
    return [...(origin ? [origin] : []), ...p.getAll('waypoint'), p.get('destination')]
  }
  const way = p.get('waypoints')
  const origin = p.get('origin')
  return [...(origin ? [origin] : []), ...(way ? way.split('|') : []), p.get('destination')]
}

const srcLinks = fs.readFileSync(path.join(root, 'src/drive-links.js'), 'utf8')
const pubLinks = path.join(dp, 'drive-links.js')
assert.equal(fs.existsSync(pubLinks) ? fs.readFileSync(pubLinks, 'utf8') : '', srcLinks, 'public/drives/drive-links.js must be a copy of src/drive-links.js')

const pages = fs.readdirSync(dp).filter((slug) => fs.existsSync(path.join(dp, slug, 'index.html'))).sort()
assert.ok(pages.length >= 24, `expected the curated drives, found ${pages.length}`)

const summary = []
for (const slug of pages) {
  const html = fs.readFileSync(path.join(dp, slug, 'index.html'), 'utf8')
  const m = html.match(/const STOPS = (\[[\s\S]*?\n\])/)
  assert.ok(m, `${slug}: no STOPS`)
  const stops = parseJsLiteral(m[1])
  const exact = stops.filter((s) => !s.private && !s.approx)
  const hidden = stops.filter((s) => s.private || s.approx)
  assert.ok(exact.length, `${slug}: no public exact stops`)

  assert.match(html, /import \{ LEG_STOPS, buildLegs, appleUrl, googleUrl \} from '\/drives\/drive-links\.js'/, `${slug}: must import buildLegs from /drives/drive-links.js`)
  assert.match(html, /const PUBLIC = STOPS\.filter\(s => !s\.private\)/, `${slug}: PUBLIC must stay non-private stops`)
  assert.match(html, /const EXACT = PUBLIC\.filter\(s => !s\.approx\)/, `${slug}: route stops are public exact stops`)
  assert.match(html, /google: buildLegs\(EXACT, LEG_STOPS, 'google'\)/, `${slug}: Google drive buttons must use buildLegs`)
  assert.match(html, /apple: buildLegs\(EXACT, LEG_STOPS, 'apple'\)/, `${slug}: Apple drive buttons must use buildLegs`)
  assert.match(html, /href="\$\{leg\.url\}"/, `${slug}: drive buttons must use the leg url`)
  assert.match(html, /const multi = legs\.google\.length > 1/, `${slug}: one pair of buttons unless the route needs another leg`)
  assert.match(html, /Open in \$\{name\}/, `${slug}: a short drive keeps Open in Apple / Open in Google`)
  assert.match(html, /Leg \$\{leg\.k\} \(stops \$\{leg\.firstNo\}–\$\{leg\.lastNo\}\) · \$\{name\}/, `${slug}: a long drive labels Leg N (stops a–b) for each app`)
  assert.match(html, /Long drives open in legs of up to 4 stops\./, `${slug}: missing legs note`)
  assert.doesNotMatch(html, /Apple Maps links can carry one destination|opens the first public stop/, `${slug}: old Apple one-destination note is still on the page`)
  assert.doesNotMatch(html, /daddr=/, `${slug}: single-stop daddr= drive button remains`)
  assert.doesNotMatch(html, /apple\(PUBLIC\)|google\(PUBLIC\)/, `${slug}: drive buttons still call the old whole-list helper`)

  const google = buildLegs(exact, LEG_STOPS, 'google')
  const apple = buildLegs(exact, LEG_STOPS, 'apple')
  const expectLegs = Math.ceil(exact.length / LEG_STOPS)
  assert.equal(apple.length, expectLegs, `${slug}: Apple leg count`)
  assert.equal(google.length, expectLegs, `${slug}: Google leg count`)
  assert.equal(apple.length, google.length, `${slug}: Apple and Google leg counts differ`)
  if (exact.length <= LEG_STOPS) assert.equal(apple.length, 1, `${slug}: ${exact.length} public stops should be one leg`)
  else assert.ok(apple.length > 1, `${slug}: ${exact.length} public stops should split into legs`)

  const covered = []
  for (let i = 0; i < apple.length; i++) {
    const a = stopsOf(apple[i].url, 'apple')
    const g = stopsOf(google[i].url, 'google')
    assert.deepEqual(a, g, `${slug}: leg ${i + 1} Apple stops differ from Google`)
    assert.equal(a.length, g.length, `${slug}: leg ${i + 1} stop count`)
    const au = new URL(apple[i].url)
    const gu = new URL(google[i].url)
    assert.equal(au.searchParams.get('mode'), 'driving')
    assert.equal(gu.searchParams.get('travelmode'), 'driving')
    if (i === 0) {
      assert.equal(au.searchParams.get('source'), null, `${slug}: Apple leg 1 has an origin`)
      assert.equal(gu.searchParams.get('origin'), null, `${slug}: Google leg 1 has an origin`)
      assert.equal(au.searchParams.get('saddr'), null, `${slug}: Apple leg 1 has saddr`)
      covered.push(...a)
    } else {
      assert.equal(a[0], ll(exact[i * LEG_STOPS - 1]), `${slug}: leg ${i + 1} does not start at the previous leg's last stop`)
      covered.push(...a.slice(1))
    }
    const fresh = a.length - (i > 0 ? 1 : 0)
    assert.ok(fresh >= 1 && fresh <= LEG_STOPS, `${slug}: leg ${i + 1} has ${fresh} new stops`)
    assert.doesNotMatch(apple[i].url, /daddr=/, `${slug}: Apple leg uses daddr`)
    assert.equal(au.hostname, 'maps.apple.com')
    assert.equal(au.pathname, '/directions')
  }
  assert.deepEqual(covered, exact.map(ll), `${slug}: Apple links do not cover every public exact stop in order`)
  const urls = [...apple, ...google].map((l) => decodeURIComponent(l.url)).join('\n')
  for (const s of hidden) {
    assert.ok(!urls.includes(ll(s)), `${slug}: ${s.private ? 'private' : 'approximate'} stop ${s.id} is in a maps URL`)
  }
  summary.push(`${slug}: ${exact.length} public exact, ${apple.length} leg${apple.length === 1 ? '' : 's'}`)
}

const licking = summary.find((s) => s.startsWith('licking-valley:'))
assert.match(licking, /5 public exact, 2 legs/, `Licking Valley should be 2 legs, got ${licking}`)
{
  const html = fs.readFileSync(path.join(dp, 'licking-valley/index.html'), 'utf8')
  const stops = parseJsLiteral(html.match(/const STOPS = (\[[\s\S]*?\n\])/)[1]).filter((s) => !s.private && !s.approx)
  const legs = buildLegs(stops, LEG_STOPS, 'apple')
  assert.deepEqual(legs.map((l) => [l.k, l.firstNo, l.lastNo]), [[1, 1, 4], [2, 4, 5]], 'Licking Valley Apple legs')
}
console.log(`test-curated-drive-links: ${pages.length} drives\n  ${summary.join('\n  ')}`)
