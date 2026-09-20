/**
 * Draft marketing homepage content for /home-preview/.
 * Featured picks are curated v1 constants (not random) so Shannon can iterate.
 * Deep links use the existing /#map/{layer}/{id} share pattern on the live map.
 */

const LAYER_HIGHLIGHTS = [
  {
    layerId: 'markers',
    layerLabel: 'Markers',
    icon: { type: 'img', src: '/icons/highway-marker-orange.png' },
    placeId: '1520',
    name: 'Fort Boonesborough',
    place: 'Madison County',
    blurb:
      'KHS marker 1520 at the “Capital of the Colony of Transylvania”: Daniel Boone’s 1775 fortified settlement on the Kentucky River, and the elm-tree assembly of Harrodsburg, St. Asaph, and Boonesborough settlers.',
  },
  {
    layerId: 'history',
    layerLabel: 'History',
    icon: { type: 'emoji', glyph: '📖' },
    placeId: 'big-bone-lick',
    name: 'Big Bone Lick',
    place: 'Boone County',
    blurb:
      'A salt lick where Pleistocene mastodons left bones in the mud. Native peoples and explorers collected fossils here; Thomas Jefferson later studied specimens from the site — Kentucky’s window on deep time.',
  },
  {
    layerId: 'museums',
    layerLabel: 'Museums',
    icon: { type: 'emoji', glyph: '🏛' },
    placeId: 'thomas-d-clark-center',
    name: 'Thomas D. Clark Center for Kentucky History',
    place: 'Frankfort',
    blurb:
      'Flagship museum of the Kentucky Historical Society, covering more than 12,000 years of Commonwealth history, with a research library a short walk from the Old Capitol.',
  },
  {
    layerId: 'national',
    layerLabel: 'National',
    icon: { type: 'emoji', glyph: '⭐' },
    placeId: 'abraham-lincoln-birthplace-nhp',
    name: 'Abraham Lincoln Birthplace National Historical Park',
    place: 'Hodgenville',
    blurb:
      'The Sinking Spring farm where Lincoln was born in 1809, plus the Knob Creek boyhood unit. Memorial building and visitor-center exhibits anchor Kentucky’s Lincoln Trail.',
  },
  {
    layerId: 'war',
    layerLabel: 'War Sites',
    icon: { type: 'img', src: '/icons/musket-sword.png' },
    placeId: 'blue-licks-battlefield',
    name: 'Blue Licks Battlefield',
    place: 'Robertson County',
    blurb:
      'August 19, 1782: the last major Revolutionary War battle in Kentucky. Militia pursuing raiders from Bryan’s Station were ambushed at the Licking; Israel Boone was among the dead.',
  },
  {
    layerId: 'locals',
    layerLabel: 'Good Eats',
    icon: { type: 'img', src: '/icons/locals.png' },
    placeId: 'moonlite-bar-b-q',
    name: 'Moonlite Bar-B-Q Inn',
    place: 'Owensboro',
    blurb:
      'Western Kentucky mutton barbecue on Parrish Avenue — the regional style unique to this Ohio River city. A family institution since 1963 and a classic drive-day stop.',
  },
  {
    layerId: 'bridges',
    layerLabel: 'Covered Bridges',
    icon: { type: 'img', src: '/icons/covered-bridge.png' },
    placeId: 'goddard',
    name: 'Goddard Covered Bridge',
    place: 'Fleming County',
    blurb:
      'Also called White Bridge: a compact Town-lattice span over Sand Lick Creek, among Kentucky’s surviving covered bridges and a photogenic stop on the northeastern loop.',
  },
  {
    layerId: 'industry',
    layerLabel: 'Industry',
    icon: { type: 'img', src: '/icons/industry.png' },
    placeId: 'bourbon-iron-works',
    name: 'Bourbon Iron Works (Slate Furnace)',
    place: 'Owingsville',
    blurb:
      'Jacob Myers blew in a charcoal blast furnace here in 1791. The works later supplied settlers and munitions — including shot tied to the War of 1812 and New Orleans campaigns.',
  },
  {
    layerId: 'newspapers',
    layerLabel: 'Newspapers',
    icon: { type: 'img', src: '/icons/newspaper.png' },
    placeId: 'lccn-sn82014784',
    name: 'The Kentucke Gazette',
    place: 'Lexington',
    blurb:
      'Kentucky’s first newspaper, begun August 11, 1787 by John and Fielding Bradford. The Gazette series is the backbone of early Commonwealth print culture on this layer.',
  },
  {
    layerId: 'parks',
    layerLabel: 'Parks',
    icon: { type: 'img', src: '/icons/statepark.png' },
    placeId: 'cumberland-falls-state-resort-park',
    name: 'Cumberland Falls State Resort Park',
    place: 'Whitley County',
    blurb:
      'Home of the “Niagara of the South,” and one of the few places in the Western Hemisphere where a moonbow can appear under a full moon. DuPont Lodge overlooks the gorge.',
  },
  {
    layerId: 'cemeteries',
    layerLabel: 'Cemeteries',
    icon: { type: 'img', src: '/icons/cemetery.png' },
    placeId: 'frankfort-cemetery',
    name: 'Frankfort Cemetery',
    place: 'Frankfort',
    blurb:
      'Hilltop rural cemetery overlooking the capital (1844). Daniel and Rebecca Boone were reinterred here in 1845; governors, Vice President Richard Mentor Johnson, and other state figures rest on the same ridge.',
  },
  {
    layerId: 'distilleries',
    layerLabel: 'Distilleries',
    icon: { type: 'img', src: '/icons/bourbon-glass.png' },
    placeId: 'buffalo-trace',
    name: 'Buffalo Trace Distillery',
    place: 'Frankfort',
    blurb:
      'A Kentucky River distilling site with roots in the late 1700s, continuous through Prohibition. Home of Buffalo Trace, Eagle Rare, Blanton’s, and a National Historic Landmark campus.',
  },
]

/** Outbound links already used in About, stories, or layer data — topic pages when possible. */
const RELATED_SITES = [
  {
    name: 'Kentucky Historical Society — Historical Marker Program',
    blurb: 'Official marker text and the statewide highway-marker index this map is built from.',
    href: 'https://history.ky.gov/markers',
  },
  {
    name: 'ExploreKYHistory — Eskippakithiki',
    blurb: 'KHS place essay on Kentucky’s last major 1700s Native town (Indian Old Fields, Clark County).',
    href: 'https://explorekyhistory.ky.gov/items/show/596',
  },
  {
    name: 'ExploreKYHistory — Jacob Spears & early bourbon',
    blurb: 'KHS essay on the Bourbon County distiller often credited with marketing whiskey under the name that stuck.',
    href: 'https://explorekyhistory.ky.gov/items/show/418',
  },
  {
    name: 'KHS — Kentucky’s long hunters',
    blurb: 'Stories-and-blogs piece on pelts, profits, and the contested hunting ground before the stations.',
    href: 'https://history.ky.gov/stories-and-blogs/kentuckys-long-hunters-pelts-profits-and-the-push-for-westward-expansion',
  },
  {
    name: 'Historical Marker Database — Taylorsville',
    blurb: 'HMDB entry already cited in the timeline stories (Brashears Creek / Salt River county seat).',
    href: 'https://www.hmdb.org/m.asp?m=136837',
  },
  {
    name: 'Kentucky Office of State Archaeology — Find a Site',
    blurb: 'State site pages used throughout the prehistoric and Native story briefs (Indian Knoll, mounds, caves).',
    href: 'https://archaeology.ky.gov/Find-a-Site/Pages/default.aspx',
  },
  {
    name: 'Library of Congress — Kentucke Gazette',
    blurb: 'Chronicling America / LOC catalog record for Kentucky’s first newspaper (the Newspapers layer source).',
    href: 'https://www.loc.gov/item/sn82014784/',
  },
  {
    name: 'Grokipedia — Cumberland Falls',
    blurb: 'Topic page already cited in the Cumberland Falls timeline story (moonbow, gorge, state park).',
    href: 'https://grokipedia.com/page/Cumberland_Falls',
  },
  {
    name: 'The Filson Historical Society',
    blurb: 'Kentucky’s oldest privately supported historical society — already a Museums-layer stop in Louisville.',
    href: 'https://filsonhistorical.org/',
  },
  {
    name: 'NPS — Abraham Lincoln Birthplace',
    blurb: 'National Historical Park page for the Sinking Spring farm, matching the National-layer highlight.',
    href: 'https://www.nps.gov/abli/',
  },
]

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mapPlaceHref(layerId, placeId) {
  const layer = encodeURIComponent(layerId)
  const id = encodeURIComponent(placeId)
  return `/#map/${layer}/${id}`
}

function layerIconHtml(icon) {
  if (icon?.type === 'img' && icon.src) {
    return `<img class="layer-icon hp-card-icon-img" src="${escapeHtml(icon.src)}" alt="" />`
  }
  return `<span class="layer-icon emoji hp-card-icon-emoji" aria-hidden="true">${escapeHtml(icon?.glyph || '')}</span>`
}

function renderLayerCards() {
  const root = document.getElementById('hpLayerCards')
  if (!root) return
  root.innerHTML = LAYER_HIGHLIGHTS.map((item) => {
    const href = mapPlaceHref(item.layerId, item.placeId)
    return `<article class="hp-card">
      <div class="hp-card-top">
        <span class="hp-card-icon" aria-hidden="true">${layerIconHtml(item.icon)}</span>
        <p class="hp-card-layer">${escapeHtml(item.layerLabel)}</p>
      </div>
      <h3 class="hp-card-title">${escapeHtml(item.name)}</h3>
      <p class="hp-card-place">${escapeHtml(item.place)}</p>
      <p class="hp-card-blurb">${escapeHtml(item.blurb)}</p>
      <a class="hp-card-link" href="${escapeHtml(href)}">Open on the map</a>
    </article>`
  }).join('')
}

function renderRelatedCards() {
  const root = document.getElementById('hpRelatedCards')
  if (!root) return
  root.innerHTML = RELATED_SITES.map((item) => {
    return `<article class="hp-related-card">
      <h3 class="hp-related-title">
        <a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>
      </h3>
      <p class="hp-card-blurb">${escapeHtml(item.blurb)}</p>
    </article>`
  }).join('')
}

renderLayerCards()
renderRelatedCards()
