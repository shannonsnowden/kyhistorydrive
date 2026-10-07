#!/usr/bin/env node
/**
 * Join stories to lat/lon via History places (exact/fuzzy) or county centroid fallback.
 * Writes public/content/stories-locations.json and merges lat/lon/mapConfidence into stories.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const storiesIdxPath = path.join(ROOT, 'public/content/stories.json')
const historyPath = path.join(ROOT, 'public/data/layers/history.geojson')
const centroidsPath = path.join(ROOT, 'public/data/county-centroids.json')
const storiesDir = path.join(ROOT, 'public/content/stories')
const outPath = path.join(ROOT, 'public/content/stories-locations.json')

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const idx = JSON.parse(fs.readFileSync(storiesIdxPath, 'utf8'))
const history = fs.existsSync(historyPath)
  ? JSON.parse(fs.readFileSync(historyPath, 'utf8')).features
  : []
const centroids = fs.existsSync(centroidsPath)
  ? JSON.parse(fs.readFileSync(centroidsPath, 'utf8'))
  : {}

const byName = new Map()
const byId = new Map()
const bySlug = new Map()
for (const f of history) {
  const p = f.properties || {}
  const n = norm(p.name || p.title)
  if (n) byName.set(n, f)
  if (p.id) byId.set(p.id, f)
  bySlug.set(slugify(p.name || p.title), f)
  bySlug.set(p.id, f)
}


/** Manual pin overrides when fuzzy body matching picks the wrong place (photos/map). */
const MANUAL_OVERRIDES = {
  // Long hunter biography — brief Falls visit shouldn't pin the whole story to Louisville
  'michael-stoner-german-long-hunter': {
    matchName: 'Boonesborough',
    lat: 37.8909,
    lon: -84.2666,
    confidence: 'override',
  },
  // Lexington founding — not John Filson / Louisville
  'col-robert-patterson-builds-lexington': {
    matchName: 'Lexington',
    lat: 38.0406,
    lon: -84.5037,
    confidence: 'override',
  },
  // Title doesn't fuzzy-match long history name
  'diamond-caverns-decorated-limestone': {
    matchName: 'Diamond Caverns Park City / Ste. Genevieve limestone',
    lat: 37.1161,
    lon: -86.0626,
    confidence: 'override',
  },
  // "Callaway" was matching Calloway County centroid
  'col-richard-callaway-of-boonesborough': {
    matchName: 'Boonesborough',
    lat: 37.8909,
    lon: -84.2666,
    confidence: 'override',
  },
  // Was wrongly fuzzy-matched to Isaac Shelby
  'chickasaw-hunting-grounds': {
    matchName: 'Chickasaw / Jackson Purchase',
    lat: 37.10445,
    lon: -88.63255,
    confidence: 'override',
  },
  'frankfort-franks-ford-becomes-the-capital': {
    matchName: 'Frankfort Founding',
    lat: 38.1980678,
    lon: -84.8655544,
    confidence: 'override',
  },
  'ashlands-adena-mounds': {
    matchName: 'Ashland Central Park Adena Mounds',
    lat: 38.4730716,
    lon: -82.63752,
    confidence: 'override',
  },
  'paris-from-hopewell': {
    matchName: 'Paris Founding',
    lat: 38.21273333333333,
    lon: -84.24981666666666,
    confidence: 'override',
  },
  'elizabethtown-from-severns-valley': {
    matchName: 'Elizabethtown founding / Severns Valley',
    lat: 37.6828019,
    lon: -85.9118928,
    confidence: 'override',
  },
  'nicholasville-takes-shape': {
    matchName: 'Nicholasville founding / Rev. John Metcalf 1798',
    lat: 37.88055,
    lon: -84.57311666666666,
    confidence: 'override',
  },
  'versailles-takes-shape': {
    matchName: 'Versailles founding / Hezekiah Briscoe',
    lat: 38.052276,
    lon: -84.7139251,
    confidence: 'override',
  },
  'winchester-clark-county-seat': {
    matchName: 'Winchester Founding',
    lat: 37.9929112,
    lon: -84.1776735,
    confidence: 'override',
  },
  'richmond-from-millers-barn': {
    matchName: 'Richmond Founding',
    lat: 37.747975,
    lon: -84.2943662,
    confidence: 'override',
  },
  // Story slug is lancaster-at-wallaces-crossroads (key previously mismatched → county centroid,
  // no pin link). Coords: Nominatim / OSM relation 130781 Lancaster, Garrard County (2026-09-27 fix).
  'lancaster-at-wallaces-crossroads': {
    matchName: 'Lancaster founding / Wallace’s Crossroads',
    lat: 37.6195246,
    lon: -84.5779957,
    confidence: 'override',
  },
  'cynthiana-cynthia-anna-on-the-licking': {
    matchName: 'Cynthiana founding / Robert Harrison',
    // History layer point was misplaced (~Murray); use Cynthiana city center
    lat: 38.3903,
    lon: -84.2941,
    confidence: 'override',
  },
  'taylorsville-on-brashears-creek': {
    matchName: 'Taylorsville',
    lat: 38.0317,
    lon: -85.3441,
    confidence: 'override',
  },
  'springfield-first-county-seat-after-statehood': {
    matchName: 'Springfield',
    lat: 37.6853,
    lon: -85.2222,
    confidence: 'override',
  },
  'bland-w-ballard-of-tick-creek': {
    matchName: 'Bland W. Ballard / Tyler Station',
    lat: 38.2143528,
    lon: -85.2361795,
    confidence: 'override',
  },
  'james-crow-on-glenns-creek': {
    matchName: 'James C. Crow / Oscar Pepper',
    lat: 38.13698933835563,
    lon: -84.78761913468118,
    confidence: 'override',
  },
  'capt-abraham-lincoln-on-long-run': {
    matchName: 'Squire Boone / Painted Stone / Long Run',
    lat: 38.2363772,
    lon: -85.4313603,
    confidence: 'override',
  },
  // Louisville wharf — Falls of the Ohio / Louisville area
  'evan-williams-on-the-louisville-wharf': {
    matchName: 'Falls of the Ohio',
    lat: 38.2753405,
    lon: -85.7628814,
    confidence: 'override',
  },
  // Bowman's 1779 raid hit Old Chillicothe (Oldtown, Xenia Twp, Greene Co., Ohio; Wikipedia
  // 39°43′49″N 83°56′16″W), not Col. John Todd's Lexington pin it was fuzzy-matched to.
  // matchName links to the corrected History pin (same coordinates).
  'col-john-bowman-at-old-chillicothe': {
    matchName: 'Col. John Bowman / Battle of Chillicothe',
    lat: 39.73028,
    lon: -83.93778,
    confidence: 'override',
  },
  // Piankashaw 1804 cession: the body mentions the Falls of the Ohio only as the EAST end of the
  // ceded tract (outside it), so the fuzzy Falls/Clarksville pin was misleading. No History pin
  // exists for the Piankashaw; leave the story unpinned (empty override = no place match).
  'piankashaw-claims-on-the-ohio-wabash': {},
  // Sep 15 — avoid Col. John Bowman fuzzy; use iOS pin coords
  'col-john-todd-of-lexington': {
    matchName: 'Col. John Todd of Lexington',
    lat: 38.0406,
    lon: -84.5037,
    confidence: 'override',
  },
  'stanford-from-st-asaph': {
    matchName: "Stanford / St. Asaph (Logan's Fort)",
    lat: 37.529666666666664,
    lon: -84.66123333333333,
    confidence: 'override',
  },
  'newt-kash-hollow-15mf1': {
    matchName: 'Newt Kash Hollow (15Mf1)',
    lat: 37.94,
    lon: -83.59,
    confidence: 'override',
  },
  'muir-site-15js86': {
    matchName: 'Muir Site (15Js86)',
    lat: 37.87,
    lon: -84.58,
    confidence: 'override',
  },
  // Sep 16 — use iOS pin coords; leave Illinois Confederation unpinned (Cahokia)
  'maj-joseph-bowman': {
    matchName: 'Maj. Joseph Bowman',
    lat: 37.7623,
    lon: -84.8433,
    confidence: 'override',
  },
  'newport-at-the-licking-mouth': {
    matchName: 'Newport Barracks',
    lat: 39.09213333333334,
    lon: -84.50191666666667,
    confidence: 'override',
  },
  'adams-site-15fu4': {
    matchName: 'Adams Site (15Fu4)',
    lat: 36.55,
    lon: -89.19,
    confidence: 'override',
  },
  'drennon-springs-salt-works': {
    matchName: 'Drennon Springs',
    lat: 38.4400769,
    lon: -85.1692443,
    confidence: 'override',
  },
  // Sep 17 — align with iOS pins; leave Tutelo unpinned (theme / Totteroy corridor)
  'col-william-russell-iii': {
    matchName: 'Col. William Russell III / Fayette',
    lat: 38.0406,
    lon: -84.5037,
    confidence: 'override',
  },
  'owensboro-yellow-banks': {
    matchName: 'Owensboro / Yellow Banks',
    lat: 37.7549958,
    lon: -87.0614257,
    confidence: 'override',
  },
  'annis-mound-village': {
    matchName: 'Annis Mound & Village (15Bt2)',
    lat: 37.21,
    lon: -86.68,
    confidence: 'override',
  },
  'cumberland-falls': {
    matchName: 'Cumberland Falls',
    lat: 36.84008333333333,
    lon: -84.33956666666667,
    confidence: 'override',
  },
  // Sep 18 — align with iOS pins; leave Chickamauga unpinned (TN towns / raid theme)
  'maj-silas-harlan': {
    matchName: "Maj. Silas Harlan / Harlan's Station",
    lat: 37.66,
    lon: -84.83,
    confidence: 'override',
  },
  'glasgow-the-barrens': {
    matchName: 'Glasgow / Barren County seat',
    lat: 36.9818833,
    lon: -85.9145954,
    confidence: 'override',
  },
  'chiggerville-15oh1': {
    matchName: 'Chiggerville (15Oh1)',
    lat: 37.48,
    lon: -86.84,
    confidence: 'override',
  },
  'salts-cave-15ht4': {
    matchName: 'Salts Cave (15Ht4)',
    lat: 37.31,
    lon: -85.88,
    confidence: 'override',
  },
  // Sep 19 — align with iOS pins; leave Ojibwe unpinned (theme / Bird's War Road)
  'capt-nathaniel-hart': {
    matchName: 'Capt. Nathaniel Hart / White Oak Springs',
    lat: 37.895633333333336,
    lon: -84.26686666666667,
    confidence: 'override',
  },
  'henderson-at-red-banks': {
    matchName: 'Henderson / Red Banks',
    lat: 37.8479021,
    lon: -87.5898562,
    confidence: 'override',
  },
  'turk-site-carlisle-county': {
    matchName: 'Turk Site (15Ce6)',
    lat: 36.89,
    lon: -89.09,
    confidence: 'override',
  },
  'lost-river-cave': {
    matchName: 'Lost River Cave',
    lat: 36.95283333,
    lon: -86.47166389,
    confidence: 'override',
  },
  // Sep 20 — align with iOS pins; leave Shawnee Chillicothe unpinned (Old Chillicothe OH)
  'capt-jack-jouett': {
    matchName: 'Capt. Jack Jouett / Craig’s Creek',
    lat: 37.9827487,
    lon: -84.7708839,
    confidence: 'override',
  },
  'shepherdsville-on-salt-river': {
    matchName: 'Shepherdsville / Salt River falls',
    lat: 37.98791666666666,
    lon: -85.71646666666666,
    confidence: 'override',
  },
  'hansen-site-15gp14': {
    matchName: 'Hansen Site (15GP14)',
    lat: 38.56,
    lon: -82.93,
    confidence: 'override',
  },
  'natural-bridge-sandstone-arch': {
    matchName: 'Natural Bridge',
    lat: 37.776836,
    lon: -83.6833147,
    confidence: 'override',
  },
  // Sep 21 — McGinty + McKenna; Lawrenceburg/Adams already pinned.
  // Wea towns / Scott 1791 raid: pin to real Ouiatenon (Tippecanoe County, IN),
  // not Limestone/Maysville and not the old Photon drop in Nelson County, KY.
  // Wikipedia Ouiatenon 40°24′3″N 86°57′36″W (story source). Map has no maxBounds.
  'wea-towns-at-ouiatenon-and-scotts-1791-kentucky-raid': {
    matchName: 'Wea (Waayaahtanwa) / Ouiatenon',
    lat: 40.40083,
    lon: -86.96,
    confidence: 'override',
  },
  'ann-mcginty-and-kentuckys-first-spinning-wheel': {
    matchName: 'Ann McGinty / Fort Harrod',
    lat: 37.7619646,
    lon: -84.8485383,
    confidence: 'override',
  },
  'henry-mckennas-fairfield-sour-mash': {
    matchName: 'Henry McKenna / Fairfield',
    lat: 37.932222,
    lon: -85.3838837,
    confidence: 'override',
  },
  'lawrenceburg-from-kaufmans-station-to-anderson-county-seat': {
    matchName: "Lawrenceburg / Kaufman's Station",
    lat: 38.1741739,
    lon: -84.8769101,
    confidence: 'override',
  },
  // History pin was geocoded to Lexington (UK); site is NRHP address-restricted near Mount Sterling
  'wright-mounds-montgomery-county': {
    matchName: 'Wright Mounds (Montgomery County Adena)',
    lat: 38.06,
    lon: -83.94,
    confidence: 'override',
  },
  // 2026-09-22 morning brief
  'john-finley-the-trader-who-put-kentucky-on-boone-s-map': {
    matchName: 'John Finley',
    lat: 37.93955,
    lon: -83.9975333,
    confidence: 'override',
  },
  'springfield-founding-and-washington-county-seat': {
    matchName: 'Springfield / Washington County seat',
    lat: 37.6853413,
    lon: -85.2221819,
    confidence: 'override',
  },
  'peter-village-early-woodland-enclosure-near-lexington': {
    matchName: 'Peter Village enclosure (15Fa166)',
    lat: 38.05,
    lon: -84.5,
    confidence: 'override',
  },
  'isaac-ruddell-and-the-guns-at-ruddell-s-station': {
    matchName: "Ruddell's Station",
    lat: 38.3351,
    lon: -84.2749,
    confidence: 'override',
  },
  // 2026-09-24 morning brief
  'jenny-wileys-captivity-and-escape': {
    matchName: 'Jenny Wiley / Big Sandy',
    lat: 37.7033685,
    lon: -82.7466926,
    confidence: 'override',
  },
  'yellow-banks-becomes-owensboro': {
    matchName: 'Owensboro / Yellow Banks',
    lat: 37.7759614,
    lon: -87.1152649,
    confidence: 'override',
  },
  // Erie / Cat Nation — theme-only, no KY place pin
  'buckner-site-fort-ancient-villages-on-strodes-creek': {
    matchName: 'Buckner Site (15Bb12)',
    lat: 38.2,
    lon: -84.21,
    confidence: 'override',
  },
  'jacob-beam-sells-old-jakes-first-barrel': {
    matchName: "Jacob Beam / Hardin's Creek",
    lat: 37.76176666666667,
    lon: -85.3364,
    confidence: 'override',
  },
  // 2026-09-25 morning brief
  'hugh-mcgary-the-blue-licks-hothead': {
    matchName: "McGary's Station / Shawnee Springs",
    lat: 37.805,
    lon: -84.831,
    confidence: 'override',
  },
  'bagdad-how-a-shelby-county-rail-stop-took-over-consolation': {
    matchName: 'Bagdad / Consolation rail stop',
    lat: 38.2622928,
    lon: -85.0577313,
    confidence: 'override',
  },
  'muir-site-early-fort-ancient-on-a-jessamine-ridge': {
    matchName: 'Muir Site (15Js86)',
    lat: 37.87,
    lon: -84.58,
    confidence: 'override',
  },
  'cleek-mccabe-a-circular-fort-ancient-village-in-boone-county': {
    matchName: 'Cleek-McCabe Fort Ancient Village',
    lat: 38.96,
    lon: -84.74,
    confidence: 'override',
  },
  // Wyandot Kah-ten-tah-teh — theme-only, no KY place pin
  // 2026-09-26 morning brief
  'col-john-holder-at-lower-howards-creek': {
    matchName: "Holder's Station / Lower Howard's Creek",
    lat: 37.918134,
    lon: -84.272709,
    confidence: 'override',
  },
  'lebanon-cedars-meeting-house-county-seat': {
    matchName: "Lebanon / Hardin's Creek Meeting House",
    lat: 37.5697869,
    lon: -85.2527381,
    confidence: 'override',
  },
  // Osage Memory of the Ohio Valley — theme-only, no KY place pin
  'sweet-lick-knob-fort-ancient-gathering-place': {
    matchName: 'Sweet Lick Knob Fort Ancient public building',
    lat: 37.69,
    lon: -83.96,
    confidence: 'override',
  },
  'falmouth-at-the-licking-forks': {
    matchName: 'Falmouth at the Licking Forks',
    lat: 38.6767366,
    lon: -84.3304592,
    confidence: 'override',
  },
  // 2026-09-27 morning brief
  'edward-worthington-at-worthingtons-fort': {
    matchName: "Worthington's Fort (Edward Worthington)",
    lat: 37.6048,
    lon: -84.7208,
    confidence: 'override',
  },
  'paducah-at-the-tennessee-mouth': {
    matchName: 'Paducah — 1827 William Clark plat',
    lat: 37.0864667,
    lon: -88.5988667,
    confidence: 'override',
  },
  // Potawatomi fire-keepers — theme-only, no KY place pin
  'slack-farm-15un28-union-county': {
    matchName: 'Slack Farm (15Un28) Caborn-Welborn village',
    lat: 37.66,
    lon: -87.95,
    confidence: 'override',
  },
  'the-travelling-church-1781': {
    matchName: "Craig's Station / Travelling Church (Gilbert's Creek)",
    lat: 37.577915,
    lon: -84.558316,
    confidence: 'override',
  },
  // 2026-09-28 morning brief
  'capt-william-hubbells-ohio-flatboat-stand-1791': {
    matchName: "Hubbell's Flatboat Fight — Limestone Landing",
    lat: 38.6488,
    lon: -83.7622,
    confidence: 'override',
  },
  'augusta-on-the-ohio-1797': {
    matchName: 'Augusta founding / Capt. Philip Buckner',
    lat: 38.7717376,
    lon: -84.0057628,
    confidence: 'override',
  },
  'egushawa-and-the-odawa-in-kentuckys-war-years': {
    matchName: "Egushawa's Odawa at Martin's Station",
    lat: 38.262614,
    lon: -84.293761,
    confidence: 'override',
  },
  'cloudsplitter-rockshelter-menifee-county': {
    matchName: 'Cloudsplitter Rockshelter (15Mf36)',
    lat: 37.94,
    lon: -83.59,
    confidence: 'override',
  },
  'ephraim-mcdowell-jane-todd-crawford-1809': {
    matchName: 'Ephraim McDowell House — first ovariotomy (1809)',
    lat: 37.6451148,
    lon: -84.7710855,
    confidence: 'override',
  },
  // 2026-09-29 morning brief (Quapaw is theme-only, no pin)
  'mary-draper-ingles-escapes-through-kentucky-1755': {
    matchName: 'Mary Ingles at Big Bone Lick (1755 escape)',
    lat: 38.8878833,
    lon: -84.7507333,
    confidence: 'override',
  },
  'bowling-green-takes-shape-on-the-barren-1798': {
    matchName: 'Bowling Green founding / Bolin Green (1798)',
    lat: 36.9931724,
    lon: -86.4413471,
    confidence: 'override',
  },
  'e-h-taylor-jr-and-the-bottled-in-bond-act-1897': {
    matchName: 'E.H. Taylor Jr. / Old Taylor Distillery — Bottled-in-Bond Act (1897)',
    lat: 38.1466899,
    lon: -84.832567,
    confidence: 'override',
  },
  'singer-hieronymus-fort-ancient-villages-on-north-elkhorn': {
    matchName: 'Singer-Hieronymus Site Complex (15Sc3 / 15Sc225)',
    lat: 38.29,
    lon: -84.58,
    confidence: 'override',
  },
  // 2026-09-30 morning brief (Susquehannock is theme-only, no pin)
  'levi-todd-lexington-co-founder': {
    matchName: 'Levi Todd / Ellerslie (Lexington co-founder)',
    lat: 38.0137667,
    lon: -84.4600167,
    confidence: 'override',
  },
  'new-castle-henry-county-seat': {
    matchName: 'New Castle — Henry County seat (1798)',
    lat: 38.4333333,
    lon: -85.1688889,
    confidence: 'override',
  },
  'dover-mound-mason-county': {
    matchName: 'Dover Mound (Adena burial mound, Mason County)',
    lat: 38.76,
    lon: -83.88,
    confidence: 'override',
  },
  'bryan-station-siege-august-1782': {
    matchName: 'Bryan Station siege (Aug 15–16, 1782)',
    lat: 38.07586667,
    lon: -84.41529167,
    confidence: 'override',
  },
  // 2026-10-01 morning brief (Moneton theme-only; Croley-Evans address-restricted / no public coords)
  'james-knox': {
    matchName: 'James Knox / Camp Knox (Skinhouse Branch)',
    lat: 37.170333,
    lon: -85.38215,
    confidence: 'override',
  },
  'somerset': {
    matchName: 'Somerset — Pulaski County seat (1801)',
    lat: 37.0897167,
    lon: -84.60555,
    confidence: 'override',
  },
  'moneton': {},
  'croley-evans-site': {},
  'mammoth-cave-saltpeter': {
    matchName: 'Mammoth Cave saltpeter (War of 1812)',
    lat: 37.131649017334,
    lon: -86.1454315185547,
    confidence: 'override',
  },
  // 2026-10-02 morning brief (Nonhelema theme-only / Ohio village — leave unpinned)
  'harry-innes': {
    matchName: 'Harry Innes (Frankfort / federal judge)',
    lat: 38.1939,
    lon: -84.8658,
    confidence: 'override',
  },
  'hopkinsville': {
    matchName: 'Hopkinsville founding (Elizabeth → Hopkinsville)',
    lat: 36.85472,
    lon: -87.48889,
    confidence: 'override',
  },
  'phosphatic-limestone-and-horse-country': {
    matchName: 'Inner Bluegrass phosphatic limestone & horse country',
    lat: 38.0406,
    lon: -84.5037,
    confidence: 'override',
  },
  'twin-mounds-site': {
    matchName: 'Twin Mounds Site (15Ba2 / Nolan)',
    lat: 37.07,
    lon: -89.14,
    confidence: 'override',
  },
  'nonhelema': {},
  // 2026-10-03 morning brief (all five pinned)
  'mcafee-station-on-the-salt-river': {
    matchName: 'McAfee Station on the Salt River',
    lat: 37.850631,
    lon: -84.851895,
    confidence: 'override',
  },
  'washington-mason-county': {
    matchName: 'Washington, Mason County (Old Washington)',
    lat: 38.615908,
    lon: -83.808533,
    confidence: 'override',
  },
  'blue-jacket-weyapiersenwah': {
    matchName: 'Blue Jacket at Limestone (Maysville)',
    lat: 38.64867,
    lon: -83.76211,
    confidence: 'override',
  },
  'slone-site-15pi11-pike-county': {
    matchName: 'Slone Site (15Pi11), Pike County',
    lat: 37.41,
    lon: -82.33,
    confidence: 'override',
  },
  'louisville-nashville-railroad-opens-the-interior': {
    matchName: 'Louisville & Nashville Railroad (main line opens)',
    lat: 38.24611,
    lon: -85.76889,
    confidence: 'override',
  },
  // 2026-10-04 brief (Covington and Tutelo repeats swapped for Pleasant Hill and Camp Nelson)
  'william-hoy-and-hoys-station': {
    matchName: "William Hoy’s Station (Madison County)",
    lat: 37.822972,
    lon: -84.329608,
    confidence: 'override',
  },
  'shaker-village-of-pleasant-hill': {
    matchName: "Shaker Village of Pleasant Hill",
    lat: 37.818017,
    lon: -84.740317,
    confidence: 'override',
  },
  'camp-nelson-jessamine-county': {
    matchName: "Camp Nelson (Civil War depot and USCT recruiting center)",
    lat: 37.78778,
    lon: -84.59806,
    confidence: 'override',
  },
  'andalex-village-15hk22-hopkins-county': {
    matchName: "Andalex Village (15Hk22), Hopkins County",
    lat: 37.32,
    lon: -87.52,
    confidence: 'override',
  },
  'louisville-and-portland-canal': {
    matchName: "Louisville and Portland Canal (locks)",
    lat: 38.27181,
    lon: -85.77933,
    confidence: 'override',
  },
  // 2026-10-05 brief (Tellico cession intentionally unpinned: theme-only, three-county strip)
  'col-john-hardin-of-pleasant-run': {
    matchName: "Col. John Hardin’s Pleasant Run homestead (approximate)",
    lat: 37.69,
    lon: -85.17,
    confidence: 'override',
  },
  'carrollton-from-port-william': {
    matchName: "Carrollton (Port William) at the Kentucky–Ohio confluence",
    lat: 38.68195,
    lon: -85.18682,
    confidence: 'override',
  },
  'tellico-cession-1805-south-of-the-cumberland': {},
  'rowlandton-mound-site-15mcn3-paducah': {
    matchName: "Rowlandton Mound Site (15McN3), Paducah",
    lat: 37.1,
    lon: -88.64,
    confidence: 'override',
  },
  'hidden-river-cave-under-horse-cave': {
    matchName: "Hidden River Cave (Horse Cave)",
    lat: 37.17928,
    lon: -85.90619,
    confidence: 'override',
  },
  // 2026-10-06 brief (Treaty of Greenville intentionally unpinned: Ohio treaty; its Kentucky-side point is the Carrollton pin)
  'gen-charles-scott-and-petersburg': {
    matchName: "Canewood, Gen. Charles Scott’s last home (KHS marker #116)",
    lat: 38.0877684,
    lon: -84.1756194,
    confidence: 'override',
  },
  'flemingsburg-stocktons-town': {
    matchName: "Flemingsburg (Fleming County courthouse)",
    lat: 38.4229167,
    lon: -83.7330833,
    confidence: 'override',
  },
  'frederick-stitzels-barrel-racks-1879': {
    matchName: "Stitzel Brothers Distillery remains, 25th & Maple, Louisville",
    lat: 38.24837,
    lon: -85.79375,
    confidence: 'override',
  },
  'treaty-of-greenville-1795-the-line-to-the-kentucky-river': {},
  'jeptha-knob-shelby-countys-buried-crater': {
    matchName: "Jeptha’s Knob marker, Clay Village (KHS #161)",
    lat: 38.18519,
    lon: -85.10823,
    confidence: 'override',
  },
  // 2026-10-07 brief (Shawnee divisions swapped for Pilot Knob: repeat of shawnee-chillicothe-divisions)
  'daniel-trabue-of-columbia': {
    matchName: "Daniel Trabue House, Columbia (KHS marker #1782)",
    lat: 37.10017,
    lon: -85.30327,
    confidence: 'override',
  },
  'russellville-from-big-boiling-spring-to-county-seat': {
    matchName: "Russellville (Logan Court House), Logan County courthouse square",
    lat: 36.8425,
    lon: -86.89278,
    confidence: 'override',
  },
  'pilot-knob-boones-overlook-1769': {
    matchName: "Pilot Knob State Nature Preserve (Boone’s Overlook)",
    lat: 37.911,
    lon: -83.936,
    confidence: 'override',
  },
  'red-bird-river-petroglyphs-clay-county': {
    matchName: "Red Bird River Petroglyphs, original site near Eriline (15CY51)",
    lat: 37.16,
    lon: -83.76,
    confidence: 'override',
  },
  'mclean-drift-bank-kentuckys-first-commercial-coal-mine': {
    matchName: "McLean Drift Bank, old Paradise on the Green River (generalized)",
    lat: 37.27,
    lon: -86.98,
    confidence: 'override',
  },
}


const countyNames = Object.keys(centroids).sort((a, b) => b.length - a.length)
const countyRe = countyNames.length
  ? new RegExp(`\\b(${countyNames.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s+County\\b`, 'i')
  : null

function findHistory(story, bodyText) {
  const titleN = norm(story.title)
  const slug = story.slug
  let hit = byName.get(titleN) || byId.get(slug) || bySlug.get(slug)
  if (hit) return { feature: hit, confidence: 'exact', match: hit.properties.name }
  // Story slug is a prefix of a history id (ashlands-adena-mounds ↔ ashland-adena-mounds)
  for (const [id, f] of byId) {
    if (!id || typeof id !== 'string') continue
    if (id.startsWith(slug) || slug.startsWith(id) || id.includes(slug) || slug.includes(id.replace(/-/g, ' '))) {
      // require meaningful overlap length
      const a = slug.split('-').filter(Boolean)
      const b = id.split('-').filter(Boolean)
      const shared = a.filter((t) => b.includes(t) && t.length > 3)
      if (shared.length >= 2) {
        return { feature: f, confidence: 'fuzzy', match: f.properties.name }
      }
    }
  }

  // fuzzy: history name contained in title or title contained in name (min length)
  for (const [n, f] of byName) {
    if (n.length >= 6 && (titleN.includes(n) || n.includes(titleN))) {
      return { feature: f, confidence: 'fuzzy', match: f.properties.name }
    }
  }
  // Shared leading place name (e.g. "diamond caverns …" vs long history title)
  const titleToks = titleN.split(' ').filter((t) => t.length > 2)
  if (titleToks.length >= 2) {
    const lead = titleToks.slice(0, 2).join(' ')
    let best = null
    for (const [n, f] of byName) {
      if (n.startsWith(lead) || n.includes(lead)) {
        if (!best || n.length < best.n.length) best = { n, f }
      }
    }
    if (best) return { feature: best.f, confidence: 'fuzzy', match: best.f.properties.name }
  }
  // all significant tokens of history name appear in title
  for (const [n, f] of byName) {
    const toks = n.split(' ').filter((t) => t.length > 2)
    if (toks.length >= 2 && toks.every((t) => titleN.includes(t))) {
      return { feature: f, confidence: 'fuzzy', match: f.properties.name }
    }
  }

  // search body/summary for history place names
  const blob = norm([story.title, story.summary, bodyText].filter(Boolean).join(' '))
  let best = null
  for (const [n, f] of byName) {
    if (n.length >= 8 && blob.includes(n)) {
      if (!best || n.length > best.n.length) best = { n, f }
    }
  }
  if (best) return { feature: best.f, confidence: 'fuzzy', match: best.f.properties.name }

  return null
}

function countyFallback(text) {
  if (!countyRe) return null
  const m = text.match(countyRe)
  if (!m) return null
  const county = m[1]
  const c = centroids[county] || centroids[Object.keys(centroids).find((k) => k.toLowerCase() === county.toLowerCase())]
  if (!c) return null
  return { lon: c[0], lat: c[1], county, confidence: 'county' }
}

const locations = {}
const stats = { exact: 0, fuzzy: 0, county: 0, override: 0, none: 0 }

for (const story of idx.stories) {
  let body = ''
  const fp = path.join(storiesDir, `${story.slug}.json`)
  if (fs.existsSync(fp)) {
    try {
      body = JSON.parse(fs.readFileSync(fp, 'utf8')).bodyMarkdown || ''
    } catch {
      body = ''
    }
  }
  const override = MANUAL_OVERRIDES[story.slug]
  let found = override ? null : findHistory(story, body)
  if (override) {
    let feature = null
    // Explicit lat/lon always wins (history layer can be misplaced)
    if (override.lat != null && override.lon != null) {
      let historyId = null
      if (override.matchName) {
        feature = byName.get(norm(override.matchName)) || bySlug.get(slugify(override.matchName))
        historyId = feature?.properties?.id || null
      }
      found = {
        feature: {
          geometry: { coordinates: [override.lon, override.lat] },
          properties: {
            name: override.matchName || feature?.properties?.name || story.title,
            id: historyId,
          },
        },
        confidence: override.confidence || 'override',
        match: override.matchName || feature?.properties?.name || 'manual override',
      }
    } else if (override.matchName) {
      feature = byName.get(norm(override.matchName)) || bySlug.get(slugify(override.matchName))
      if (feature) {
        found = { feature, confidence: override.confidence || 'override', match: feature.properties.name }
      }
    }
  }
  let loc = null
  if (found) {
    const [lon, lat] = found.feature.geometry.coordinates
    loc = {
      slug: story.slug,
      lat,
      lon,
      mapConfidence: found.confidence,
      matchedPlace: found.match,
      historyId: found.feature.properties.id || null,
    }
    stats[found.confidence] = (stats[found.confidence] || 0) + 1
  } else if (override) {
    // Explicit empty MANUAL_OVERRIDES entry = intentional theme-only unpin (skip county centroid).
    loc = {
      slug: story.slug,
      lat: null,
      lon: null,
      mapConfidence: null,
      matchedPlace: null,
      historyId: null,
    }
    stats.none++
  } else {
    const text = [story.title, story.summary, body, ...(story.tags || [])].join(' ')
    const fb = countyFallback(text)
    if (fb) {
      loc = {
        slug: story.slug,
        lat: fb.lat,
        lon: fb.lon,
        mapConfidence: 'county',
        matchedPlace: `${fb.county} County (centroid)`,
        historyId: null,
      }
      stats.county++
    } else {
      loc = {
        slug: story.slug,
        lat: null,
        lon: null,
        mapConfidence: null,
        matchedPlace: null,
        historyId: null,
      }
      stats.none++
    }
  }
  locations[story.slug] = loc
  // merge onto index entry
  story.lat = loc.lat
  story.lon = loc.lon
  story.mapConfidence = loc.mapConfidence
  story.matchedPlace = loc.matchedPlace
}

fs.writeFileSync(
  outPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), stats, locations }, null, 2) + '\n'
)
fs.writeFileSync(storiesIdxPath, JSON.stringify(idx, null, 2) + '\n')
console.log('stories-locations', stats)
console.log('Wrote', outPath)
