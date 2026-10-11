/**
 * Route maps for six stories. Visible text is taken from
 * public/maps/routes/<slug>/NOTES.md. Coordinates are included only when
 * that file gives one latitude/longitude pair.
 */
export const SITE = 'https://kyhistorydrive.com'
export const ORG_ID = `${SITE}/#organization`

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function filesFor(slug, base) {
  const dir = `/maps/routes/${slug}`
  const f = (suffix) => `${dir}/${base}${suffix}`
  return {
    phoneWebp: f('-phone.webp'),
    phonePng: f('-phone.png'),
    phoneDarkWebp: f('-phone-dark.webp'),
    phoneDarkPng: f('-phone-dark.png'),
    webWebp: f('-web.webp'),
    fullWebp: f('.webp'),
    fullPng: f('.png'),
    darkWebp: f('-dark.webp'),
    darkPng: f('-dark.png'),
  }
}

const wp = (where, stop, geo = null, conjectural = false) => ({ where, stop, geo, conjectural })

export const ROUTE_MAPS = [
  {
    slug: 'athiamiowee-the-warriors-path-through-kentucky',
    base: 'warriors-path-map',
    phoneCrop: true,
    era: 'before 1674 to the 1770s',
    alt: "Map of the Warriors' Path from the Ohio River at the Scioto south past Eskippakithiki to Cumberland Gap and Cherokee towns.",
    caption:
      "Solid: Warriors' Path (approximate) · Dotted: conjectural segment · Light dashes: branch prongs to the Ohio. Map: Kentucky History Drive.",
    sentence:
      "The Warriors' Path ran from the Ohio River opposite the mouth of the Scioto (Lower Shawneetown, near present South Portsmouth) south past Eskippakithiki in Clark County, across the Red and Kentucky rivers near Irvine, along War Fork and Goose Creek to Flat Lick, over the Cumberland River at Pineville, and through Cumberland Gap toward the Cherokee Overhill towns on the Little Tennessee River.",
    distance:
      'About 220 miles from the Ohio to Cumberland Gap, plus roughly 80–90 more (conjectural) to the Overhill towns, measured on the map line.',
    stopsLabel: 'Approximate stops, north to south',
    note: 'A dashed branch runs from Eskippakithiki northeast across the Licking near Upper Blue Licks (Fleming and Nicholas counties) to the Ohio at Cabin Creek (Mason and Lewis counties), with a Maysville prong.',
    sources: 'Sources: Filson 1784; KHS marker #697; KYGeoNet Ky Frontier Trails; NPS.',
    stops: [
      wp('South Portsmouth / Fullerton, Greenup County, Kentucky, and Scioto County, Ohio', 'Lower Shawneetown', [38.677, -83.107]),
      wp('near Olive Hill and the Mount Sterling area, Carter, Bath, and Montgomery counties, Kentucky', 'Scioto prong', [38.137, -83.566], true),
      wp('Indian Fields, Clark County, Kentucky', 'Eskippakithiki', [37.946, -84]),
      wp('near Clay City, Clark, Powell, and Estill counties, Kentucky', 'Red River crossing', [37.84, -84.02]),
      wp('Irvine, Estill County, Kentucky', 'Kentucky River ford', [37.69, -83.97]),
      wp('Gray Hawk, Jackson County, Kentucky', 'War Fork / Sand Gap', [37.4, -83.94]),
      wp('Manchester, Clay County, Kentucky', 'Goose Creek', [37.15, -83.76]),
      wp('Flat Lick, Knox County, Kentucky', 'Flat Lick', [36.838, -83.771]),
      wp('Pineville, Bell County, Kentucky', 'Cumberland Ford', [36.749, -83.693]),
      wp('Middlesboro, Kentucky, and Cumberland Gap, Tennessee (Bell County, Kentucky; Claiborne County, Tennessee; Lee County, Virginia)', 'Cumberland Gap', [36.604, -83.674]),
      wp('near Vonore, Monroe County, Tennessee', 'Overhill Cherokee towns (Chota)', [35.53, -84.13], true),
    ],
    relatedStories: [
      'lower-shawneetown-at-the-scioto-mouth',
      'odawa-raid-at-eskippakithiki-1753',
      'john-finley-the-trader-who-put-kentucky-on-boones-map',
      'christopher-gist-1750-51',
      'thomas-walker-and-cumberland-gap',
      'william-calks-1775-journal',
    ],
    markers: [
      { number: '697', title: "Warrior's Path" },
      { number: '1274', title: 'Indian Old Fields' },
    ],
  },
  {
    slug: 'thomas-walker-and-cumberland-gap',
    base: 'thomas-walker-and-cumberland-gap-route-map',
    phoneCrop: true,
    era: '1750',
    alt: "Map of Thomas Walker's 1750 route from Castle Hill, Virginia, through Cumberland Gap to his cabin near Barbourville and back.",
    caption:
      'Solid: outbound route (approximate) · Dotted: return loop (conjectural). Map: Kentucky History Drive.',
    sentence:
      'Dr. Thomas Walker left Castle Hill in Albemarle County on March 6, 1750, crossed the Blue Ridge and the New, Holston and Clinch rivers, went through Cave Gap (Cumberland Gap) on April 13, named the Cumberland River, and raised a cabin near present Barbourville. He then looped north on the Warriors\' Path toward the Red River, east past Paintsville to the Levisa Fork ("Louisa"), over to the Tug Fork and the New and Greenbrier rivers, and home by Hot Springs and Staunton on July 13.',
    distance: 'About 350 miles out to the cabin and 400 back, roughly 750 miles in four months, measured on the map line.',
    stopsLabel: 'Approximate stops, in order of travel',
    sources: "Sources: Walker's journal (Rives 1888; Johnston 1898).",
    stops: [
      wp('near Cismont / Keswick, Albemarle County, Virginia', 'Castle Hill', [38.08, -78.24]),
      wp('Rockfish valley, Albemarle and Nelson counties, Virginia', "Col. Fry's, Thomas Joplin's, and John Harvie's"),
      wp('Lynchburg to Roanoke corridor, Bedford and Roanoke counties, Virginia', 'Fluvanna crossing and the Blue Ridge'),
      wp('near Radford / Ingles Ferry, Montgomery and Pulaski counties, Virginia', 'New (Wood\'s) River', [37.13, -80.55]),
      wp('Chilhowie area, Wythe and Smyth counties, Virginia', "Reed Creek and the Holston at Stalnaker's", [36.8, -81.68]),
      wp('Clinchport and Powell Valley, Scott and Lee counties, Virginia', 'Clinch River and Powell Valley'),
      wp('Cumberland Gap, Bell County, Kentucky, Lee County, Virginia, and Claiborne County, Tennessee', 'Cave Gap', [36.604, -83.674]),
      wp('Pineville, Bell County, Kentucky', 'Cumberland River (Cumberland Ford)', [36.76, -83.7]),
      wp('near Barbourville, Knox County, Kentucky', "cabin at Swan's Pond", [36.817, -83.948]),
      wp('Flat Lick toward the Irvine area, Knox County to Estill and Powell counties, Kentucky', "north on the Warriors' Path", null, true),
      wp('Hazel Green, Salyersville, and Paintsville, Wolfe, Magoffin, and Johnson counties, Kentucky', 'old trail to Paint Lick', null, true),
      wp('Levisa Fork below Paintsville, Johnson and Floyd counties, Kentucky', 'Louisa (Levisa Fork)', [37.68, -82.62], true),
      wp('Williamson area toward Mercer and Summers counties, Pike County, Kentucky, and Mingo and Mercer counties, West Virginia', 'Tug Fork', null, true),
      wp('Hinton, Summers County, West Virginia', 'New River near the mouth of the Greenbrier', [37.67, -80.89], true),
      wp('Ronceverte toward Allegheny Mountain, Greenbrier County, West Virginia, and Alleghany County, Virginia', 'up the Greenbrier', null, true),
      wp('Hot Springs, Bath County, Virginia', 'Hot Springs', [38, -79.83], true),
      wp('Staunton, Augusta County, Virginia', 'Augusta Court House', [38.15, -79.07], true),
      wp('Afton to Keswick, Nelson and Albemarle counties, Virginia', 'over Rockfish Gap to Castle Hill', null, true),
    ],
    relatedStories: ['athiamiowee-the-warriors-path-through-kentucky', 'william-calks-1775-journal'],
    markers: [
      { number: '903', title: 'The Walker Expedition' },
      { number: '72', title: 'First Cabin in Kentucky' },
      { number: '697', title: "Warrior's Path" },
    ],
  },
  {
    slug: 'christopher-gist-1750-51',
    base: 'christopher-gist-1750-51-route-map',
    phoneCrop: true,
    era: '1750–1751',
    alt: "Map of Christopher Gist's 1750–51 route from Old Town, Maryland, through Ohio and Kentucky to his home on the Yadkin.",
    caption:
      'Solid: route north of the Ohio (approximate) · Dotted: Kentucky and return (conjectural) · Light dashes: side trip to Pickawillany. Map: Kentucky History Drive.',
    sentence:
      "Christopher Gist set out from Cresap's Old Town on the Potomac on October 31, 1750, went by Shannopin's Town and Logstown to the Wyandot town on the Muskingum, and on to Lower Shawneetown at the mouth of the Scioto, with a side trip to Pickawillany on the Great Miami. On March 12, 1751 he crossed into Kentucky and went down the south side of the Ohio to a salt lick said to be 15 miles above the Falls, then turned south across the Kentucky River and struggled east through the mountains to the Bluestone and the New River, reaching his home on the Yadkin on May 18.",
    distance:
      'About 350 miles from Old Town to Lower Shawneetown, 250 for the Pickawillany round trip, and about 480 from Lower Shawneetown through Kentucky to the Yadkin, measured on the map line.',
    stopsLabel: 'Approximate stops, in order of travel',
    sources: "Sources: Gist's journal (Darlington 1893; Summers 1929).",
    stops: [
      wp('Oldtown, Allegany County, Maryland', "Col. Thomas Cresap's at Old Town", [39.6, -78.55]),
      wp('Bedford to Ligonier area, Bedford and Westmoreland counties, Pennsylvania', 'Juniata, Allegheny Mountain, and Loyalhanna'),
      wp('Pittsburgh and Ambridge/Baden, Allegheny and Beaver counties, Pennsylvania', "Shannopin's Town and Logstown"),
      wp('Coshocton, Coshocton County, Ohio', 'Wyandot town on the Muskingum', [40.27, -81.86]),
      wp('Lancaster and the Circleville area, Fairfield and Pickaway counties, Ohio', 'Hockhocking and Maguck'),
      wp('Portsmouth, Ohio / South Portsmouth, Kentucky, Scioto County, Ohio, and Greenup County, Kentucky', 'Lower Shawneetown', [38.73, -82.99]),
      wp('Piqua, Miami County, Ohio', 'Pickawillany', [40.18, -84.24]),
      wp('South Portsmouth, Greenup County, Kentucky', 'ferried over the Ohio', [38.71, -83]),
      wp('Lewis, Mason, and Bracken counties, Kentucky', 'down the southeast side of the Ohio', null, true),
      wp('near Grant and Owen counties, Kentucky', 'lower Salt Lick Creek, disputed', [38.55, -84.7], true),
      wp('Kentucky River below Frankfort, Owen, Henry, and Franklin counties, Kentucky', 'little Cuttaway', [38.33, -84.78], true),
      wp('Bluegrass edge to the eastern Kentucky coalfield, Clark and Powell counties to Letcher County, Kentucky, and Wise County, Virginia', 'southeast through the mountains', null, true),
      wp('Bluefield–Princeton area, Mercer County, West Virginia, and Tazewell County, Virginia', 'Bluestone River', [37.33, -81.2], true),
      wp('near Hinton, Summers County, West Virginia', 'New River', [37.56, -80.85], true),
      wp('Mountain Lake, Giles County, Virginia', 'mountain pond and Sinking Creek', [37.36, -80.53], true),
      wp('near Blacksburg, Montgomery County, Virginia', "Richard Hall's", [37.18, -80.35], true),
      wp('upper Yadkin, Surry, Yadkin, and Davie counties, North Carolina', 'home on the Yadkin', [36.12, -80.55], true),
    ],
    relatedStories: [
      'lower-shawneetown-at-the-scioto-mouth',
      'athiamiowee-the-warriors-path-through-kentucky',
    ],
    markers: [{ number: '697', title: "Warrior's Path" }],
  },
  {
    slug: 'william-calks-1775-journal',
    base: 'william-calks-1775-journal-route-map',
    phoneCrop: true,
    era: '1775',
    alt: "Map of William Calk's 1775 trek from Prince William County, Virginia, through Cumberland Gap to Boonesborough, Kentucky.",
    caption: "Solid: Calk's route (approximate) · Dotted: conjectural segment. Map: Kentucky History Drive.",
    sentence:
      "William Calk walked from Prince William County, Virginia, by Rapidan and over the Blue Ridge, down the Valley to Crow's Ferry, Pepper's Ferry on the New River and Fort Chiswell, across the Clinch country to Martin's Station in Powell Valley, through Cumberland Gap on April 8, and along Boone's Trace by the Cumberland, Laurel and Rockcastle rivers to Boonesborough on April 20, 1775.",
    distance: 'About 490 miles, a 39-day trip including a five-day snowbound stop on the Clinch, measured on the map line.',
    stopsLabel: 'Approximate stops, in order of travel',
    sources: 'Sources: Calk journal (KHS); Boone Trace research; NPS Cumberland Gap.',
    stops: [
      wp('Manassas area, Prince William County, Virginia', 'sets out from Prince William', [38.72, -77.48]),
      wp('Rapidan, Culpeper and Orange counties, Virginia', "Mr. Prize's", [38.31, -78.06]),
      wp('Charlottesville area, Albemarle County, Virginia', "Mr. Car's on the North Fork of the James", [38.08, -78.45]),
      wp('Crozet / Staunton area, Albemarle and Augusta counties, Virginia', "Mr. Black's and James Loyl's", [37.95, -78.9]),
      wp('Buchanan area, Botetourt County, Virginia', "William Anderson's at Crow's Ferry", [37.53, -79.68]),
      wp('Catawba valley, Roanoke and Botetourt counties, Virginia', "Wm. Adams's", [37.37, -80.1]),
      wp('near Radford, Montgomery and Pulaski counties, Virginia', "Pepper's Ferry", [37.17, -80.48]),
      wp('Fort Chiswell, Wythe County, Virginia', 'Fort Chiswell', [36.94, -80.94]),
      wp('Royal Oak / Marion, Smyth County, Virginia', "Major Campbell's on the Holston", [36.83, -81.52]),
      wp('north of Saltville, Smyth and Washington counties, Virginia', 'Laurel Fork of the Holston', [36.92, -81.8], true),
      wp("Castlewood, Russell County, Virginia", "Daniel Smith's on the Clinch", [36.93, -82.28], true),
      wp('Dungannon area, Scott County, Virginia', "Briley's mill", [36.83, -82.45], true),
      wp('Duffield and Powell Valley, Scott and Lee counties, Virginia', 'Clinch River, Cove Creek, and Powell Mountain', null, true),
      wp('Martin\'s Station, Wilderness Road State Park, Ewing, Lee County, Virginia', "Capt. Martin's", [36.64, -83.4]),
      wp('near Ewing, Lee County, Virginia', 'Indian Creek camp', [36.62, -83.55]),
      wp('Cumberland Gap, Bell County, Kentucky, Lee County, Virginia, and Claiborne County, Tennessee', 'Cumberland Gap', [36.604, -83.674]),
      wp('Pineville, Bell County, Kentucky', 'Cumberland River (Cumberland Ford)', [36.76, -83.7]),
      wp('Barbourville area, Knox County, Kentucky', 'Richland Creek', [36.86, -83.88]),
      wp('near Corbin / London, Laurel County, Kentucky', 'Laurel River', [37.01, -84.05]),
      wp('near Livingston / Hazel Patch, Rockcastle and Laurel counties, Kentucky', 'Rockcastle River', [37.3, -84.2]),
      wp('Berea area, Rockcastle and Madison counties, Kentucky', 'Roundstone Creek and the Blue Lick'),
      wp('south of Richmond, Madison County, Kentucky', "Twetty's Fort site and Otter Creek", [37.68, -84.33]),
      wp('Fort Boonesborough State Park, Madison County, Kentucky', 'Boonesborough', [37.898, -84.265]),
    ],
    relatedStories: [
      'thomas-walker-and-cumberland-gap',
      'col-richard-callaway-of-boonesborough',
      'athiamiowee-the-warriors-path-through-kentucky',
    ],
    markers: [{ number: '1520', title: 'Fort Boonesborough' }],
  },
  {
    slug: 'george-rogers-clark',
    base: 'george-rogers-clark-route-map',
    phoneCrop: false,
    era: '1778–1779',
    alt: "Map of George Rogers Clark's 1778–79 Illinois Campaign from the Falls of the Ohio to Kaskaskia, Cahokia and Vincennes.",
    caption:
      "Solid: Clark's route, 1778 (approximate on land) · Dotted: winter march, 1779 (approximate) · Light dashes: Bowman to Cahokia, July 1778. Map: Kentucky History Drive.",
    sentence:
      "George Rogers Clark's men left Corn Island at the Falls of the Ohio on June 24, 1778, rowed down the Ohio to the old French Fort Massac, marched about 120 miles overland to take Kaskaskia on the night of July 4, and sent Bowman to take Cahokia, while Father Gibault and Leonard Helm won over Vincennes. In February 1779 Clark marched about 180 miles from Kaskaskia through flooded country to retake Vincennes, where Hamilton surrendered Fort Sackville on February 25.",
    distance:
      "About 300 miles by river to Fort Massac, about 90 miles in a straight-ish line overland (Clark's figure is about 120 miles), and about 145 straight-line miles for the winter march (usually given as about 180 miles walked), measured on the map line.",
    stopsLabel: 'Approximate stops, in order of travel',
    sources: "Sources: Clark's memoir and Bowman's journal (James 1912); NPS.",
    stops: [
      wp('Louisville waterfront, Jefferson County, Kentucky', 'Corn Island camp', [38.27, -85.77]),
      wp('Fort Massac State Park, Metropolis, Massac County, Illinois', 'Fort Massac', [37.148, -88.707]),
      wp('Johnson, Williamson, Jackson, and Randolph counties, Illinois', 'overland march'),
      wp('old Kaskaskia and Fort Kaskaskia near Ellis Grove, Randolph County, Illinois', 'Kaskaskia', [37.92, -89.91]),
      wp('Cahokia Heights, St. Clair County, Illinois', 'Cahokia', [38.571, -90.19]),
      wp('Vincennes, Knox County, Indiana', 'Vincennes', [38.679, -87.535]),
      wp('Kaskaskia, Randolph County, Illinois', 'winter march leaves Kaskaskia', [37.92, -89.91]),
      wp('near Clay City / Flora, Clay County, Illinois', 'Little Wabash crossings', [38.62, -88.27]),
      wp('near Lawrenceville / St. Francisville, Lawrence County, Illinois', 'Embarras River', [38.6, -87.66]),
      wp('George Rogers Clark National Historical Park, Vincennes, Knox County, Indiana', 'Fort Sackville', [38.679, -87.535]),
    ],
    relatedStories: [],
    markers: [{ number: '1753', title: 'George Rogers Clark' }],
  },
  {
    slug: 'mantle-rock-and-the-trail-of-tears',
    base: 'mantle-rock-and-the-trail-of-tears-route-map',
    phoneCrop: true,
    era: '1838–1839 · Northern Route',
    alt: 'Map of the Trail of Tears Northern Route across Kentucky via Hopkinsville, Princeton and Mantle Rock to the Ohio at Golconda.',
    caption:
      'Solid: Northern Route (NPS designated, approximate) · Light dashes: Benge Route (another detachment). Map: Kentucky History Drive.',
    sentence:
      "On the Northern Route of the Trail of Tears, Cherokee detachments entered Kentucky on the Port Royal Road in Todd County, camped at Hopkinsville and Princeton, followed the Salem–Golconda Road through Salem past Mantle Rock, and crossed the Ohio at Berry's Ferry to Golconda, Illinois, before heading west to the Mississippi.",
    distance:
      "About 120 miles across Kentucky from the Tennessee line to Berry's Ferry, plus about 130 more across southern Illinois to the Mississippi crossing, measured on the map line.",
    stopsLabel: 'Approximate stops, in order of travel',
    sources: 'Sources: NPS Trail of Tears National Historic Trail GIS; KHS marker #1675.',
    stops: [
      wp('near Guthrie, Todd County, Kentucky', 'enters Kentucky on the Port Royal Road', [36.64, -87.17]),
      wp('Hopkinsville, Christian County, Kentucky', 'Hopkinsville camp', [36.857, -87.493]),
      wp('Princeton, Caldwell County, Kentucky', 'Big Spring camp', [37.109, -87.882]),
      wp('Salem, Livingston County, Kentucky', 'Salem', [37.264, -88.243]),
      wp('near Joy, Livingston County, Kentucky', 'Mantle Rock', [37.36, -88.432]),
      wp('opposite Golconda, Livingston County, Kentucky, and Pope County, Illinois', "Berry's Ferry", [37.372, -88.476]),
      wp('near Cape Girardeau, Missouri, Union and Alexander counties, Illinois, and Cape Girardeau County, Missouri', 'Mississippi crossing', [37.4, -89.47]),
    ],
    relatedStories: [],
    markers: [
      { number: '1675', title: 'Mantle Rock - 1/2 mile' },
      { number: '1042', title: 'The Trail of Tears' },
      { number: '142', title: 'Trail of Tears' },
    ],
  },
]

for (const route of ROUTE_MAPS) {
  route.files = filesFor(route.slug, route.base)
  if (route.alt.length > 125) {
    throw new Error(`route map alt for ${route.slug} is ${route.alt.length} characters`)
  }
  if (route.slug === 'mantle-rock-and-the-trail-of-tears' && !route.sentence.includes('Northern Route')) {
    throw new Error('Mantle Rock route must use the NPS name Northern Route')
  }
  for (const stop of route.stops) {
    if (!stop.geo) continue
    for (const n of stop.geo) {
      const text = JSON.stringify(n)
      if (/-?\d{1,3}\.\d{5,}/.test(text)) {
        throw new Error(`route map coordinate for ${route.slug} is too precise: ${text}`)
      }
    }
  }
}

const bySlug = new Map(ROUTE_MAPS.map((route) => [route.slug, route]))

export function routeBySlug(slug) {
  return bySlug.get(slug) || null
}

export function absoluteUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE}${path.startsWith('/') ? path : `/${path}`}`
}

function source(theme, slot, srcset, type, media) {
  return `<source data-theme="${theme}" data-slot="${slot}" media="${media}" srcset="${esc(srcset)}" type="${type}">`
}

/** Phone art under 700px; 960/1600 from 700px up; dark files via prefers-color-scheme. */
export function routeMapPictureHtml(route, { thumb = false } = {}) {
  const f = route.files
  const alt = esc(route.alt)
  const sizes = '(min-width: 700px) min(100vw, 52rem)'
  const sources = thumb
    ? [
        source('dark', 'thumb', f.darkWebp, 'image/webp', '(prefers-color-scheme: dark)'),
        source('dark', 'thumb', f.darkPng, 'image/png', '(prefers-color-scheme: dark)'),
        source('light', 'thumb', f.webWebp, 'image/webp', '(min-width: 0px)'),
      ]
    : [
        source('dark', 'phone', f.phoneDarkWebp, 'image/webp', '(max-width: 699px) and (prefers-color-scheme: dark)'),
        source('dark', 'phone', f.phoneDarkPng, 'image/png', '(max-width: 699px) and (prefers-color-scheme: dark)'),
        source('light', 'phone', f.phoneWebp, 'image/webp', '(max-width: 699px)'),
        source('light', 'phone', f.phonePng, 'image/png', '(max-width: 699px)'),
        source('dark', 'desk', f.darkWebp, 'image/webp', '(min-width: 700px) and (prefers-color-scheme: dark)'),
        source('dark', 'desk', f.darkPng, 'image/png', '(min-width: 700px) and (prefers-color-scheme: dark)'),
        `<source data-theme="light" data-slot="desk" media="(min-width: 700px)" srcset="${esc(f.webWebp)} 960w, ${esc(f.fullWebp)} 1600w" sizes="${sizes}" type="image/webp">`,
      ]
  return `<picture class="route-map-picture">
      ${sources.join('\n      ')}
      <img src="${esc(f.fullPng)}" data-src-light="${esc(f.fullPng)}" data-src-dark="${esc(f.darkPng)}" width="1600" height="900" alt="${alt}" loading="lazy" decoding="async" fetchpriority="low">
    </picture>`
}

/** Thumbnail or story figure. The hi-res file is not in the markup; the viewer loads it on open. */
export function routeMapZoomHtml(route, { thumb = false } = {}) {
  const label = `Expand: ${route.alt}`
  return `<div class="route-map-zoom" data-route-slug="${esc(route.slug)}" data-fallback="${esc(route.files.fullWebp)}">
      ${routeMapPictureHtml(route, { thumb })}
      <button type="button" class="route-map-expand" aria-haspopup="dialog" aria-controls="route-map-lightbox" aria-label="${esc(label)}">
        <svg class="route-map-expand-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        <span>Expand</span>
      </button>
    </div>`
}

function storyHref(slug, linkMode) {
  if (linkMode === 'hash') return `#timeline/${encodeURIComponent(slug)}`
  return `/stories/${encodeURIComponent(slug)}/`
}

function linksHtml(route, linkMode, titleFor) {
  const stories = (route.relatedStories || [])
    .filter((slug) => slug !== route.slug)
    .map((slug) => {
      const title = titleFor ? titleFor(slug) : ''
      if (!title) return ''
      return `<li><a href="${esc(storyHref(slug, linkMode))}">${esc(title)}</a></li>`
    })
    .filter(Boolean)
  const markers = (route.markers || []).map(
    (marker) =>
      `<li><a href="/#map/markers/${esc(marker.number)}">KHS marker #${esc(marker.number)}, ${esc(marker.title)}</a></li>`,
  )
  const items = [...stories, ...markers]
  if (!items.length) return ''
  return `<nav class="route-links" aria-label="Related stories and markers"><h3>Related stories and markers</h3><ul>${items.join('')}</ul></nav>`
}

function phoneCropNote(route) {
  if (!route.phoneCrop) return ''
  const light = route.files.fullPng
  const dark = route.files.darkPng
  return `<p class="route-map-phone-note">Kentucky leg shown — <a class="route-map-full-link" href="${esc(light)}" data-href-light="${esc(light)}" data-href-dark="${esc(dark)}">view full route</a></p>`
}

function stopsHtml(route) {
  const items = route.stops
    .map((stop) => {
      const tail = stop.conjectural ? ', conjectural' : ''
      return `<li>${esc(stop.where)} <span class="muted">(${esc(stop.stop)}${tail})</span></li>`
    })
    .join('')
  return `<h3>${esc(route.stopsLabel)}</h3><ol class="route-waypoints">${items}</ol>`
}

export function routeMapSectionHtml(slug, { headingLevel = 2, linkMode = 'story', titleFor = null } = {}) {
  const route = routeBySlug(slug)
  if (!route) return ''
  const level = headingLevel === 3 ? 3 : 2
  const note = route.note ? `<p>${esc(route.note)}</p>` : ''
  return `<section class="route-map" id="route-map" aria-labelledby="route-map-heading">
      <h${level} id="route-map-heading">View the map</h${level}>
      <p class="route-summary">${esc(route.sentence)}</p>
      ${route.distance ? `<p>${esc(route.distance)}</p>` : ''}
      <figure class="route-map-figure">
        ${routeMapZoomHtml(route)}
        <figcaption>
          <p class="route-map-caption">${esc(route.caption)}</p>
          ${phoneCropNote(route)}
        </figcaption>
      </figure>
      ${stopsHtml(route)}
      ${note}
      <p class="route-sources muted">${esc(route.sources)}</p>
      ${linksHtml(route, linkMode, titleFor)}
      <p class="route-index-link"><a href="/routes/">All route maps</a></p>
    </section>`
}

export function routesIndexArticleHtml(titleFor) {
  const cards = ROUTE_MAPS.map((route) => {
    const title = (titleFor && titleFor(route.slug)) || route.slug
    return `<li class="route-card">
        ${routeMapZoomHtml(route, { thumb: true })}
        <a class="route-card-link" href="/stories/${esc(route.slug)}/#route-map">
          <h2>${esc(title)}</h2>
          <p class="muted">${esc(route.era)}</p>
        </a>
      </li>`
  }).join('')
  return `<article>
      <nav class="story-crumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Route maps</span>
      </nav>
      <header class="story-head">
        <p class="static-kicker">Route maps</p>
        <h1>Route maps</h1>
        <p class="story-lead">Six approximate routes, each drawn for its story. Mantle Rock follows the National Park Service name Northern Route.</p>
      </header>
      <ul class="route-index-list">${cards}</ul>
    </article>`
}

export function routeMapJsonLd(route, { canonical, title }) {
  const id = `${canonical}#route-map`
  const contentUrl = absoluteUrl(route.files.fullPng)
  const imageObject = {
    '@type': 'ImageObject',
    '@id': id,
    contentUrl,
    url: contentUrl,
    name: `${title} route map`,
    caption: route.caption,
    description: route.alt,
    width: 1600,
    height: 900,
    encodingFormat: 'image/png',
    creator: { '@id': ORG_ID },
    copyrightHolder: { '@id': ORG_ID },
    creditText: 'Kentucky History Drive',
    license: `${SITE}/about/#license`,
    acquireLicensePage: `${SITE}/about/`,
  }
  const itemList = {
    '@type': 'ItemList',
    '@id': `${canonical}#waypoints`,
    name: route.stopsLabel,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: route.stops.length,
    itemListElement: route.stops.map((stop, index) => {
      const place = {
        '@type': 'Place',
        name: stop.where,
        description: stop.conjectural ? `${stop.stop} (conjectural)` : stop.stop,
      }
      if (stop.geo) {
        place.geo = { '@type': 'GeoCoordinates', latitude: stop.geo[0], longitude: stop.geo[1] }
      }
      return { '@type': 'ListItem', position: index + 1, item: place }
    }),
  }
  return { imageObject, itemList, contentUrl }
}

const PHONE_MQ = '(max-width: 699px)'
const DESK_MQ = '(min-width: 700px)'

/** Follow the site theme. The picture markup still carries prefers-color-scheme for no-JS. */
export function applyRouteMapTheme(theme) {
  if (typeof document === 'undefined') return
  const mode = theme === 'light' ? 'light' : 'dark'
  document.querySelectorAll('picture.route-map-picture').forEach((pic) => {
    pic.querySelectorAll('source[data-theme]').forEach((src) => {
      const role = src.getAttribute('data-theme')
      const slot = src.getAttribute('data-slot') || 'desk'
      if (role !== mode) {
        src.media = 'not all'
        return
      }
      src.media = slot === 'phone' ? PHONE_MQ : slot === 'desk' ? DESK_MQ : '(min-width: 0px)'
    })
    const img = pic.querySelector('img')
    if (!img) return
    const next = img.getAttribute(mode === 'dark' ? 'data-src-dark' : 'data-src-light')
    if (next) img.setAttribute('src', next)
    img.remove()
    pic.appendChild(img)
  })
  document.querySelectorAll('a.route-map-full-link').forEach((link) => {
    const next = link.getAttribute(mode === 'dark' ? 'data-href-dark' : 'data-href-light')
    if (next) link.setAttribute('href', next)
  })
}

export function routeMapThemeScript() {
  return `<script>
      (function () {
        var phone = '(max-width: 699px)'
        var desk = '(min-width: 700px)'
        function apply(theme) {
          var mode = theme === 'light' ? 'light' : 'dark'
          document.querySelectorAll('picture.route-map-picture').forEach(function (pic) {
            pic.querySelectorAll('source[data-theme]').forEach(function (src) {
              var role = src.getAttribute('data-theme')
              var slot = src.getAttribute('data-slot') || 'desk'
              if (role !== mode) { src.media = 'not all'; return }
              src.media = slot === 'phone' ? phone : slot === 'desk' ? desk : '(min-width: 0px)'
            })
            var img = pic.querySelector('img')
            if (!img) return
            var next = img.getAttribute(mode === 'dark' ? 'data-src-dark' : 'data-src-light')
            if (next) img.setAttribute('src', next)
            img.remove()
            pic.appendChild(img)
          })
          document.querySelectorAll('a.route-map-full-link').forEach(function (link) {
            var next = link.getAttribute(mode === 'dark' ? 'data-href-dark' : 'data-href-light')
            if (next) link.setAttribute('href', next)
          })
        }
        function run() { apply(document.documentElement.getAttribute('data-hp-theme') || 'dark') }
        run()
        new MutationObserver(run).observe(document.documentElement, { attributes: true, attributeFilter: ['data-hp-theme'] })
      })()
    </script>`
}
