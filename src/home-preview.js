/**
 * Draft marketing homepage content for /home-preview/.
 * Featured picks are curated constants (not random) so Shannon can iterate.
 * Deep links use the existing /#map/{layer}/{id} share pattern on the live map.
 */

const THEME_KEY = 'khd-home-preview-theme'

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

/**
 * Outbound resource hub. Keep existing KHS / ExploreKYHistory / HMDB / Filson / NPS
 * links, then add Abandoned Online (root + Snowden house), KyOPA, and more KY blogs.
 * Topic pages preferred over bare homepages. No kinship claims.
 */
const RELATED_GROUPS = [
  {
    title: 'Markers, essays & official history',
    sites: [
      {
        name: 'Kentucky Historical Society — Historical Marker Program',
        kind: 'Official',
        blurb: 'Official marker text and the statewide highway-marker index this map is built from.',
        href: 'https://history.ky.gov/markers',
      },
      {
        name: 'KHS — Stories and Blogs',
        kind: 'Blog',
        blurb: 'Staff historian essays from the Kentucky Historical Society, grounded in primary sources.',
        href: 'https://history.ky.gov/stories-and-blogs',
      },
      {
        name: 'KHS — Kentucky’s long hunters',
        kind: 'Blog',
        blurb: 'Stories-and-blogs piece on pelts, profits, and the contested hunting ground before the stations.',
        href: 'https://history.ky.gov/stories-and-blogs/kentuckys-long-hunters-pelts-profits-and-the-push-for-westward-expansion',
      },
      {
        name: 'ExploreKYHistory — Eskippakithiki',
        kind: 'Essay',
        blurb: 'KHS place essay on Kentucky’s last major 1700s Native town (Indian Old Fields, Clark County).',
        href: 'https://explorekyhistory.ky.gov/items/show/596',
      },
      {
        name: 'ExploreKYHistory — Jacob Spears & early bourbon',
        kind: 'Essay',
        blurb: 'KHS essay on the Bourbon County distiller often credited with marketing whiskey under the name that stuck.',
        href: 'https://explorekyhistory.ky.gov/items/show/418',
      },
      {
        name: 'ExploreKYHistory — Warrior’s Path',
        kind: 'Essay',
        blurb: 'KHS essay on the buffalo and warrior trail through Cumberland Ford, shown on Filson’s 1784 map.',
        href: 'https://explorekyhistory.ky.gov/items/show/602',
      },
      {
        name: 'Civil War Governors of Kentucky',
        kind: 'Archive',
        blurb: 'KHS digital-documentary project: papers that crossed five wartime governors’ desks, 1860–1865.',
        href: 'https://history.ky.gov/khs-for-me/for-researchers/civil-war-governors-of-kentucky',
      },
      {
        name: 'Historical Marker Database — Taylorsville',
        kind: 'Marker',
        blurb: 'HMDB entry already cited in the timeline stories (Brashears Creek / Salt River county seat).',
        href: 'https://www.hmdb.org/m.asp?m=136837',
      },
      {
        name: 'Library of Congress — Kentucke Gazette',
        kind: 'Newspaper',
        blurb: 'Chronicling America / LOC catalog record for Kentucky’s first newspaper (the Newspapers layer source).',
        href: 'https://www.loc.gov/item/sn82014784/',
      },
      {
        name: 'The Filson Historical Society',
        kind: 'Museum',
        blurb: 'Kentucky’s oldest privately supported historical society — already a Museums-layer stop in Louisville.',
        href: 'https://filsonhistorical.org/',
      },
      {
        name: 'Filson Club History Quarterly',
        kind: 'Journal',
        blurb: 'Digitized 1926–2002 journal of Kentucky and Ohio Valley history, predecessor to Ohio Valley History.',
        href: 'https://filsonhistorical.org/publications/filson-club-history-quarterly/',
      },
      {
        name: 'Kentucky Humanities Magazine',
        kind: 'Magazine',
        blurb: 'Long-running public-history magazine of Kentucky essays, reviews, and features (archives remain online).',
        href: 'https://kyhumanities.org/programs/magazine/',
      },
      {
        name: 'Kentucky Heritage Council — National Register',
        kind: 'Official',
        blurb: 'State Historic Preservation Office overview of Kentucky’s National Register listings — one of the largest state counts.',
        href: 'https://heritage.ky.gov/historic-places/national-register/Pages/overview.aspx',
      },
      {
        name: 'Blue Grass Trust — Our Impact',
        kind: 'Preservation',
        blurb: 'Central Kentucky preservation nonprofit, founded in 1955 to save Hopemont in Lexington’s Gratz Park.',
        href: 'https://www.bluegrasstrust.org/our-impact',
      },
      {
        name: 'NPS — Abraham Lincoln Birthplace',
        kind: 'Park',
        blurb: 'National Historical Park page for the Sinking Spring farm, matching the National-layer highlight.',
        href: 'https://www.nps.gov/abli/',
      },
      {
        name: 'NPS — Mammoth Cave history & culture',
        kind: 'Park',
        blurb: 'National Park Service topic pages on the world’s longest known cave system and its human history.',
        href: 'https://www.nps.gov/maca/learn/historyculture/index.htm',
      },
    ],
  },
  {
    title: 'Kentucky archaeology',
    sites: [
      {
        name: 'Kentucky Organization of Professional Archaeologists',
        kind: 'Org',
        blurb: 'Official KyOPA site (often shortened to KOA): statewide professional archaeologists, ethics, grants, and public education.',
        href: 'https://kyopa.org/about-kyopa/',
      },
      {
        name: 'KyOPA — Kentucky Archaeology Month',
        kind: 'Campaign',
        blurb: 'Annual public-education campaign from KyOPA, with posters and events highlighting Kentucky archaeology.',
        href: 'https://kyopa.org/kentucky-archaeology-month/',
      },
      {
        name: '30 Days of Kentucky Archaeology',
        kind: 'Blog',
        blurb: 'September blog series from the Kentucky Heritage Council, KyOPA, and colleagues — one public archaeology post a day.',
        href: 'https://30daysofkentuckyarchaeology.wordpress.com/',
      },
      {
        name: 'Kentucky Office of State Archaeology — Find a Site',
        kind: 'Official',
        blurb: 'State site pages used throughout the prehistoric and Native story briefs (Indian Knoll, mounds, caves).',
        href: 'https://archaeology.ky.gov/Find-a-Site/Pages/default.aspx',
      },
      {
        name: 'OSA — Wright Mounds',
        kind: 'Site',
        blurb: 'State archaeology topic page on the Montgomery County Adena mounds excavated by University of Kentucky crews in 1937.',
        href: 'https://archaeology.ky.gov/Find-a-Site/Pages/Wright-Mounds.aspx',
      },
      {
        name: 'Kentucky Archaeological Survey — History and Mission',
        kind: 'Survey',
        blurb: 'Public archaeology program that documents sites, works with landowners, and publishes Kentucky archaeology for general readers.',
        href: 'https://kentuckyarchaeologicalsurvey.org/history-and-mission/',
      },
      {
        name: 'Kentucky Archaeological Survey — For the Public',
        kind: 'Education',
        blurb: 'Booklets, spotlights, and how to report or protect sites — KAS’s public-facing archaeology desk.',
        href: 'https://kentuckyarchaeologicalsurvey.org/for-the-public/',
      },
      {
        name: 'Kentucky Heritage Council — Booklets & Blogs',
        kind: 'Official',
        blurb: 'SHPO archaeology booklets plus the 30 Days of Kentucky Archaeology partnership blog.',
        href: 'https://heritage.ky.gov/archaeology/publications/Pages/publications.aspx',
      },
    ],
  },
  {
    title: 'Photography & documented places',
    sites: [
      {
        name: 'Abandoned Online',
        kind: 'Photography',
        blurb: 'Sherman Cahal’s archive of abandoned architecture, with a deep Kentucky bench of houses, bridges, railroads, and industry.',
        href: 'https://abandonedonline.net/',
      },
      {
        name: 'Abandoned Online — David Snowden House',
        kind: 'Place',
        blurb: 'Location page for a circa-1825 folk house in eastern Kentucky, with photographs and sourced building history.',
        href: 'https://abandonedonline.net/location/david-snowden-house/',
      },
      {
        name: 'Abandoned Online — Houses in Kentucky',
        kind: 'Gallery',
        blurb: 'Kentucky house gallery: lock-and-dam dwellings, mountain cabins, and Bluegrass seats documented in photographs.',
        href: 'https://abandonedonline.net/location/abandoned-houses-in-kentucky/',
      },
      {
        name: 'Grokipedia — Cumberland Falls',
        kind: 'Place',
        blurb: 'Topic page already cited in the Cumberland Falls timeline story (moonbow, gorge, state park).',
        href: 'https://grokipedia.com/page/Cumberland_Falls',
      },
    ],
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

function relatedCardHtml(item) {
  const kind = item.kind
    ? `<p class="hp-related-kind">${escapeHtml(item.kind)}</p>`
    : ''
  return `<article class="hp-related-card">
      ${kind}
      <h3 class="hp-related-title">
        <a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>
      </h3>
      <p class="hp-card-blurb">${escapeHtml(item.blurb)}</p>
    </article>`
}

function renderRelatedCards() {
  const root = document.getElementById('hpRelatedCards')
  if (!root) return
  root.innerHTML = RELATED_GROUPS.map((group) => {
    return `<div class="hp-related-group">
      <h3 class="hp-related-group-title">${escapeHtml(group.title)}</h3>
      <div class="hp-related-grid">
        ${group.sites.map(relatedCardHtml).join('')}
      </div>
    </div>`
  }).join('')
}

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore quota / private mode */
  }
  return null
}

function preferredTheme() {
  const stored = readStoredTheme()
  if (stored) return stored
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-hp-theme', next)
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    /* ignore quota / private mode */
  }
  const btn = document.getElementById('hpThemeToggle')
  if (!btn) return
  const isLight = next === 'light'
  btn.setAttribute('aria-pressed', isLight ? 'true' : 'false')
  btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme')
  const label = btn.querySelector('.hp-theme-toggle-label')
  const icon = btn.querySelector('.hp-theme-toggle-icon')
  if (label) label.textContent = isLight ? 'Dark' : 'Light'
  if (icon) icon.textContent = isLight ? '☾' : '☀'
}

function initThemeToggle() {
  applyTheme(preferredTheme())
  const btn = document.getElementById('hpThemeToggle')
  if (!btn) return
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-hp-theme')
    applyTheme(current === 'light' ? 'dark' : 'light')
  })
}

renderLayerCards()
renderRelatedCards()
initThemeToggle()
