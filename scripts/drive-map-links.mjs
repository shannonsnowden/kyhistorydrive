/**
 * Curated drive pages: the maps handoff is buildLegs() from src/drive-links.js,
 * the same legs Build-a-Drive opens. This rewrites the inline google()/apple()
 * block so a rebuild cannot put the old single-destination Apple button back.
 * PUBLIC stays "not private" (the distance line uses the first of those).
 * EXACT drops approximate stops, the same geo gate as GPX and TouristTrip.
 */
import fs from 'node:fs'
import path from 'node:path'

export const DRIVE_LINKS_IMPORT = "import { LEG_STOPS, buildLegs, appleUrl, googleUrl } from '/drives/drive-links.js'"

export const DRIVE_MAP_LINKS_JS = `// Directions: public exact stops only, same legs for Apple Maps and Google Maps. Leg 1 has no origin.
function google(list){
  if (list.length===1 && list[0].approx) return \`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(list[0].name+', Kentucky')}\`
  return googleUrl(null, list.filter(s => !s.approx))
}
function apple(list){
  if (list.length===1 && list[0].approx) return \`https://maps.apple.com/?q=\${encodeURIComponent(list[0].name+', Kentucky')}\`
  return appleUrl(null, list.filter(s => !s.approx))
}
const PUBLIC = STOPS.filter(s => !s.private)
const EXACT = PUBLIC.filter(s => !s.approx)
const legs = {
  google: buildLegs(EXACT, LEG_STOPS, 'google'),
  apple: buildLegs(EXACT, LEG_STOPS, 'apple'),
}
const multi = legs.google.length > 1
const apps = [['google', 'Google Maps', 'btn'], ['apple', 'Apple Maps', 'btn btn-quiet']]
\$('go').innerHTML = legs.google.map((_, i) => apps.map(([app, name, cls]) => {
  const leg = legs[app][i]
  const label = multi ? \`Leg \${leg.k} (stops \${leg.firstNo}–\${leg.lastNo}) · \${name}\` : \`Open in \${name}\`
  return \`<a class="\${cls}" href="\${leg.url}" rel="noopener noreferrer" target="_blank">\${label}</a>\`
}).join('\\n  ')).join('\\n  ')
\$('go').insertAdjacentHTML('afterend', '<p class="note">Long drives open in legs of up to 4 stops.</p>')
`

const BADGE_IMPORT = "import { spreadBadges, labelBox } from '/drives/badge-spread.js'"
const BLOCK = /\/\/ Directions:[\s\S]*?\$\('go'\)\.insertAdjacentHTML\('afterend', '<p class="note">[^']*<\/p>'\)\n+/

/** Copy src/drive-links.js to public/drives/drive-links.js so the static pages can import it. */
export function syncDriveLinksModule(root) {
  const src = fs.readFileSync(path.join(root, 'src/drive-links.js'), 'utf8')
  const out = path.join(root, 'public/drives/drive-links.js')
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== src) fs.writeFileSync(out, src)
}

export function applyCuratedMapLinks(html, slug) {
  if (!html.includes(DRIVE_LINKS_IMPORT)) {
    if (!html.includes(BADGE_IMPORT)) throw new Error(`drive-map-links: ${slug} has no badge-spread import`)
    html = html.replace(BADGE_IMPORT, `${BADGE_IMPORT}\n${DRIVE_LINKS_IMPORT}`)
  }
  if (!BLOCK.test(html)) throw new Error(`drive-map-links: ${slug} has no directions block`)
  return html.replace(BLOCK, `${DRIVE_MAP_LINKS_JS.trimEnd()}\n\n`)
}
