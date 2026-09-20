/**
 * Shared curated content for the magazine homepage (layers + related sites).
 * Daily story highlights are NOT here — they come from the morning-brief pipeline.
 *
 * Layer cards always carry a curated, attributed photo (Commons / Wikipedia /
 * HABS-LOC). Do not hotlink restaurant blogs. Moonlite Bar-B-Q has no
 * licensed building photo on Commons/Openverse, so Good Eats uses Old Talbott
 * Tavern (already on the locals layer) instead of a generic Owensboro street.
 */

function commonsPhoto({
  image_url,
  title,
  file,
  attribution,
  source_label = 'Wikimedia Commons',
  year = null,
}) {
  return {
    image_url,
    title,
    source_url: `https://commons.wikimedia.org/wiki/File:${file}`,
    source_label,
    attribution,
    year,
  }
}

export const LAYER_HIGHLIGHTS = [
  {
    layerId: 'markers',
    layerLabel: 'Markers',
    icon: { type: 'img', src: '/icons/highway-marker-orange.png' },
    placeId: '1520',
    name: 'Fort Boonesborough',
    place: 'Madison County',
    wiki: 'Fort Boonesborough State Park',
    blurb: 'Daniel Boone’s 1775 settlement on the Kentucky River — Capital of the Colony of Transylvania.',
    photo: commonsPhoto({
      image_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Fort_Boonesborough_reproduction%2C_KY%2C_US_%2803%29.jpg/1280px-Fort_Boonesborough_reproduction%2C_KY%2C_US_%2803%29.jpg',
      title: 'Fort Boonesborough reconstruction',
      file: 'Fort_Boonesborough_reproduction,_KY,_US_(03).jpg',
      attribution: 'Bubba73 · Wikimedia Commons · CC BY-SA 3.0',
      year: 2017,
    }),
  },
  {
    layerId: 'history',
    layerLabel: 'History',
    icon: { type: 'emoji', glyph: '📖' },
    placeId: 'big-bone-lick',
    name: 'Big Bone Lick',
    place: 'Boone County',
    wiki: 'Big Bone Lick State Park',
    blurb: 'A Pleistocene salt lick where mastodons left bones in the mud — Kentucky’s window on deep time.',
    photo: commonsPhoto({
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Bigbonelick.jpg',
      title: 'Big Bone Lick State Park',
      file: 'Bigbonelick.jpg',
      attribution: 'Mattguyver · Wikimedia Commons · CC BY 3.0',
    }),
  },
  {
    layerId: 'museums',
    layerLabel: 'Museums',
    icon: { type: 'emoji', glyph: '🏛' },
    placeId: 'thomas-d-clark-center',
    name: 'Thomas D. Clark Center for Kentucky History',
    place: 'Frankfort',
    wiki: 'Kentucky Historical Society',
    blurb: 'Flagship Kentucky Historical Society museum, covering more than 12,000 years of the Commonwealth.',
    photo: commonsPhoto({
      image_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/The_fa%C3%A7ade_of_the_Thomas_D._Clark_Center_for_Kentucky_History_in_Frankfort%2C_Kentucky.jpg/1280px-The_fa%C3%A7ade_of_the_Thomas_D._Clark_Center_for_Kentucky_History_in_Frankfort%2C_Kentucky.jpg',
      title: 'Thomas D. Clark Center for Kentucky History',
      file: 'The_façade_of_the_Thomas_D._Clark_Center_for_Kentucky_History_in_Frankfort,_Kentucky.jpg',
      attribution: 'Lee Wright · Wikimedia Commons · CC BY-SA 2.0',
    }),
  },
  {
    layerId: 'national',
    layerLabel: 'National',
    icon: { type: 'emoji', glyph: '⭐' },
    placeId: 'abraham-lincoln-birthplace-nhp',
    name: 'Abraham Lincoln Birthplace',
    place: 'Hodgenville',
    wiki: 'Abraham Lincoln Birthplace National Historical Park',
    blurb: 'The Sinking Spring farm where Lincoln was born in 1809, plus the Knob Creek boyhood unit.',
    photo: commonsPhoto({
      image_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Abraham_Lincoln_Birthplace_National_Historical_Park_side.jpg/1280px-Abraham_Lincoln_Birthplace_National_Historical_Park_side.jpg',
      title: 'Abraham Lincoln Birthplace memorial',
      file: 'Abraham_Lincoln_Birthplace_National_Historical_Park_side.jpg',
      attribution: 'Jon698 · Wikimedia Commons · CC BY 4.0',
    }),
  },
  {
    layerId: 'war',
    layerLabel: 'War Sites',
    icon: { type: 'img', src: '/icons/musket-sword.png' },
    placeId: 'blue-licks-battlefield',
    name: 'Blue Licks Battlefield',
    place: 'Robertson County',
    wiki: 'Blue Licks Battlefield State Resort Park',
    commons: 'Blue Licks Battlefield monument',
    blurb: 'August 19, 1782: the last major Revolutionary War battle in Kentucky.',
    photo: commonsPhoto({
      image_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Blue_Licks_Battlefield_monument.jpg/1280px-Blue_Licks_Battlefield_monument.jpg',
      title: 'Blue Licks Battlefield monument',
      file: 'Blue_Licks_Battlefield_monument.jpg',
      attribution: 'Nyttend · Wikimedia Commons · Public domain',
      year: 2014,
    }),
  },
  {
    layerId: 'locals',
    layerLabel: 'Good Eats',
    icon: { type: 'img', src: '/icons/locals.png' },
    placeId: 'old-talbott-tavern',
    name: 'Old Talbott Tavern',
    place: 'Bardstown',
    wiki: 'Old Talbott Tavern',
    blurb: 'Court Square tavern since the late 1700s — among America’s oldest inns, still a working bourbon bar.',
    photo: commonsPhoto({
      image_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Old_Talbott_Tavern_%E2%80%94_Bardstown%2C_Kentucky.jpg/1280px-Old_Talbott_Tavern_%E2%80%94_Bardstown%2C_Kentucky.jpg',
      title: 'Old Talbott Tavern, Bardstown',
      file: 'Old_Talbott_Tavern_—_Bardstown,_Kentucky.jpg',
      attribution: 'Christopher L. Riley · Wikimedia Commons · CC BY-SA 4.0',
      year: 2020,
    }),
  },
  {
    layerId: 'bridges',
    layerLabel: 'Covered Bridges',
    icon: { type: 'img', src: '/icons/covered-bridge.png' },
    placeId: 'goddard',
    name: 'Goddard Covered Bridge',
    place: 'Fleming County',
    wiki: 'Goddard Bridge',
    blurb: 'White Bridge: a Town-lattice span over Sand Lick Creek, among Kentucky’s surviving covered bridges.',
    photo: commonsPhoto({
      image_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/GoddardBridge.jpg/1280px-GoddardBridge.jpg',
      title: 'Goddard Covered Bridge',
      file: 'GoddardBridge.jpg',
      attribution: 'Greg Hume · Wikimedia Commons · CC BY-SA 3.0',
      year: 2007,
    }),
  },
  {
    layerId: 'industry',
    layerLabel: 'Industry',
    icon: { type: 'img', src: '/icons/industry.png' },
    placeId: 'bourbon-iron-works',
    name: 'Bourbon Iron Works',
    place: 'Owingsville',
    wiki: 'Bourbon Iron Works',
    commons: 'Bourbon Iron Works front',
    blurb: 'Jacob Myers blew in a charcoal blast furnace here in 1791 — munitions for the early Commonwealth.',
    photo: commonsPhoto({
      image_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Bourbon_Iron_Works_front.jpg/1280px-Bourbon_Iron_Works_front.jpg',
      title: 'Bourbon Iron Works (Slate Furnace)',
      file: 'Bourbon_Iron_Works_front.jpg',
      attribution: 'Jeff Bates · HABS / Library of Congress · Public domain',
      source_label: 'HABS / Library of Congress',
      year: 1987,
    }),
  },
  {
    layerId: 'newspapers',
    layerLabel: 'Newspapers',
    icon: { type: 'img', src: '/icons/newspaper.png' },
    placeId: 'lccn-sn82014784',
    name: 'The Kentucke Gazette',
    place: 'Lexington',
    wiki: 'Kentucky Gazette',
    commons: 'Kentucke Gazette Printing House',
    blurb: 'Kentucky’s first newspaper, begun August 11, 1787 by John and Fielding Bradford.',
    photo: commonsPhoto({
      image_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Kentucke_Gazette_Printing_House.png/960px-Kentucke_Gazette_Printing_House.png',
      title: 'Kentucke Gazette printing house',
      file: 'Kentucke_Gazette_Printing_House.png',
      attribution: 'William Henry Perrin / Filson Club · Wikimedia Commons · Public domain',
      year: 1887,
    }),
  },
  {
    layerId: 'parks',
    layerLabel: 'Parks',
    icon: { type: 'img', src: '/icons/statepark.png' },
    placeId: 'cumberland-falls-state-resort-park',
    name: 'Cumberland Falls',
    place: 'Whitley County',
    wiki: 'Cumberland Falls',
    blurb: 'The “Niagara of the South,” and one of the few Western Hemisphere places a moonbow can appear.',
    photo: commonsPhoto({
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Cumberland_falls_2015_1.jpg',
      title: 'Cumberland Falls',
      file: 'Cumberland_falls_2015_1.jpg',
      attribution: 'Aaron Vowels · Wikimedia Commons · CC BY 2.0',
      year: 2015,
    }),
  },
  {
    layerId: 'cemeteries',
    layerLabel: 'Cemeteries',
    icon: { type: 'img', src: '/icons/cemetery.png' },
    placeId: 'frankfort-cemetery',
    name: 'Frankfort Cemetery',
    place: 'Frankfort',
    wiki: 'Frankfort Cemetery',
    blurb: 'Hilltop rural cemetery (1844) overlooking the capital — Daniel and Rebecca Boone were reinterred here.',
    photo: commonsPhoto({
      image_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Frankfort_Cemetery%3B_Frankfort%2C_Kentucky.JPG/1280px-Frankfort_Cemetery%3B_Frankfort%2C_Kentucky.JPG',
      title: 'Frankfort Cemetery',
      file: 'Frankfort_Cemetery;_Frankfort,_Kentucky.JPG',
      attribution: 'Sydney Poore & Russell Poore · Wikimedia Commons · CC BY-SA 4.0',
    }),
  },
  {
    layerId: 'distilleries',
    layerLabel: 'Distilleries',
    icon: { type: 'img', src: '/icons/bourbon-glass.png' },
    placeId: 'buffalo-trace',
    name: 'Buffalo Trace Distillery',
    place: 'Frankfort',
    wiki: 'Buffalo Trace Distillery',
    blurb: 'A Kentucky River distilling campus with late-1700s roots, continuous through Prohibition.',
    photo: commonsPhoto({
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Buffalo_Trace_Tower.jpg',
      title: 'Buffalo Trace Distillery',
      file: 'Buffalo_Trace_Tower.jpg',
      attribution: 'Kittugwiki · Wikimedia Commons · CC BY-SA 3.0',
    }),
  },
]

export const RELATED_GROUPS = [
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
        blurb: 'State Historic Preservation Office overview of Kentucky’s National Register listings.',
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
        blurb: 'Official KyOPA site: statewide professional archaeologists, ethics, grants, and public education.',
        href: 'https://kyopa.org/',
      },
      {
        name: 'KyOPA — Archaeology Resources',
        kind: 'Resources',
        blurb: 'KyOPA’s live resource list for Kentucky archaeology publications, surveys, and regional journals (their path is spelled “resoures”).',
        href: 'https://kyopa.org/kentucky-archaeology-resoures/',
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
        blurb: 'Kentucky Archaeology Month blog — one public archaeology post a day from KHC, KyOPA, and colleagues.',
        href: 'https://30daysofkentuckyarchaeology.wordpress.com/',
      },
      {
        name: 'Kentucky Heritage Council — Archaeology overview',
        kind: 'Official',
        blurb: 'State Historic Preservation Office archaeology desk: site protection, education, and more than 12,000 years of Kentucky’s archaeological record.',
        href: 'https://heritage.ky.gov/archaeology/Pages/overview.aspx',
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
