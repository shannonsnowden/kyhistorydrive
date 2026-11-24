/**
 * Visible caveats for portraits whose identity or date is not settled.
 * Group scenes are the full Commons file; the site square-crops them.
 */
export const PORTRAIT_CAPTIONS = {
  'robert-patterson': 'Attributed portrait',
  'henry-hamilton': 'Attributed portrait',
  'thomas-lincoln': 'Attributed portrait',
  'john-lawson': 'Attributed portrait',
  'john-jolly': 'Attributed portrait',
  cornstalk: 'Imagined posthumous portrait',
  'simon-girty': 'Imagined posthumous portrait',
  'christopher-gist': 'Imagined posthumous portrait',
  'little-turtle': 'Imagined posthumous portrait',
  'la-salle': 'Imagined posthumous portrait',
  attakullakulla: 'Detail from a group scene',
  'alexander-mckee': 'Detail from a group scene',
  'matthew-elliott': 'Detail from a group scene',
}

export function portraitCaption(person) {
  if (!person?.id || person.ai) return ''
  return PORTRAIT_CAPTIONS[person.id] || ''
}

/** Credit line keeps the artist credit and leads with the caveat. */
export function creditWithCaption(person, credit) {
  const caption = portraitCaption(person)
  const text = String(credit || '').trim()
  if (!caption) return text
  if (text === caption || text.startsWith(`${caption}.`) || text.startsWith(`${caption} `)) return text
  return text ? `${caption}. ${text}` : caption
}

/** Hand-written alt text for portraits that need more than the name (illustration briefs). */
export const PORTRAIT_ALTS = {
  'david-rice': 'AI illustration of Father David Rice, Presbyterian minister and founder of Concord Church in Danville, about 1792',
  'walker-daniel': "AI illustration of Walker Daniel, Danville lawyer and Kentucky's first attorney general, about 1784",
  // Portrait sweep batch 1 (canonical faces).
  'thomas-marshall-col': 'AI illustration of Col. Thomas Marshall, Virginia surveyor and Buck Pond founder, about 1795',
  'hugh-mcgary': 'AI illustration of Hugh McGary, Harrodsburg frontiersman, about 1782',
  'hugh-forbes': 'AI illustration of Hugh Forbes, Scottish-born founder of Mount Sterling, about 1790',
  'daniel-boone': "AI illustration of Daniel Boone in old age, after Chester Harding's 1820 portrait",
  'benjamin-logan': 'AI illustration of Benjamin Logan, Kentucky pioneer and militia general',
  'george-rogers-clark': 'AI illustration of George Rogers Clark, after his c. 1810 portrait by C. D. Cook',
  'john-bradford': 'AI illustration of John Bradford, printer of the Kentucke Gazette',
  moluntha: 'AI illustration of Moluntha, elderly Mekoche Shawnee civil chief, about 1786',
  blackfish: 'AI illustration of Blackfish, Chillicothe Shawnee war chief, about 1778',
  'blue-jacket': 'AI illustration of Blue Jacket (Weyapiersenwah), Shawnee war chief, about 1787',
  egushawa: 'AI illustration of Egushawa, Odawa war leader, about 1780',
  'robert-johnson': "AI illustration of Robert Johnson, founder of Johnson's Station, about 1783",
  // Item 69: related-box people and Jack Jouett.
  'john-todd': "AI illustration of John Todd, Kentucky militia colonel, about 1782",
  'levi-todd': "AI illustration of Levi Todd, Lexington co-founder and militia officer: a young man with tied-back hair in a brown coat and ruffled shirt, about 1782",
  'john-finley': "AI illustration of John Finley, trader and long hunter who guided Daniel Boone, about 1769",
  'john-hardin': "AI illustration of Col. John Hardin, Kentucky militia officer, about 1790",
  'stephen-trigg': "AI illustration of Colonel Stephen Trigg, killed at Blue Licks: a heavyset, greying man in a brown coat and white cravat, about 1782",
  'john-bowman': "AI illustration of Col. John Bowman of Harrodsburg, about 1779",
  'john-strode': "AI illustration of John Strode, founder of Strode's Station, about 1780",
  'jacob-beam': "AI illustration of Jacob Beam, Kentucky miller and distiller, about 1795",
  'daniel-trabue': "AI illustration of Daniel Trabue of Columbia, Kentucky, about 1805",
  'silas-harlan': "AI illustration of Major Silas Harlan, about 1782",
  'squire-boone': "AI illustration of Squire Boone, long hunter and preacher, about 1780",
  'hancock-taylor': "AI illustration of Hancock Taylor, Virginia surveyor, about 1774",
  'john-holder': "AI illustration of Capt. John Holder, founder of Holder's Station, about 1782",
  'william-hoy': "AI illustration of William Hoy, founder of Hoy's Station, 1780s",
  'william-christian': "AI illustration of Col. William Christian of Virginia, about 1785",
  'isaac-ruddell': "AI illustration of Capt. Isaac Ruddell of Ruddle's Station, about 1780",
  'james-knox': "AI illustration of James Knox, long hunter, about 1770",
  'william-russell-iii': "AI illustration of Gen. William Russell of Kentucky, about 1795",
  'william-whitley': "AI illustration of William Whitley, Kentucky frontiersman, about 1790",
  'michael-stoner': "AI illustration of Michael Stoner, long hunter, about 1774",
  'jack-jouett': "AI illustration of Jack Jouett in profile, based on the silhouette by his son Matthew Harris Jouett",
  // Item 92: canonical faces, no known likeness (Oct 19, 2026).
  'israel-boone': "AI illustration of Israel Boone, son of Daniel Boone, killed at Blue Licks in 1782",
  'jemima-boone': "AI illustration of Jemima Boone, daughter of Daniel Boone, about 1776",
  'ann-logan': "AI illustration of Ann Logan Hardin, daughter of Benjamin Logan, about 1800",
  'burr-harrison': "AI illustration of Burr Harrison, settler at Logan's Fort, about 1777",
  'captain-dick': "AI illustration of Captain Dick, Cherokee leader who met Knox's long hunters, about 1770",
  'doublehead': "AI illustration of Doublehead, Cherokee chief, about 1805",
  'elinipsico': "AI illustration of Elinipsico, Shawnee son of Cornstalk, about 1777",
  'fanny-callaway': "AI illustration of Fanny Callaway, daughter of Richard Callaway, about 1776",
  'george-boone': "AI illustration of George Boone, Daniel Boone's brother and co-founder of Hoy's Station, about 1781",
  'hannah-boone': "AI illustration of Hannah Boone Stewart Pennington, Daniel Boone's sister and Kentucky pioneer",
  'james-boone': "AI illustration of James Boone, Daniel Boone's eldest son, about 1773",
  'jean-baptiste-ducoigne': "AI illustration of Jean-Baptiste Ducoigne, Kaskaskia leader of the Illinois Confederation, about 1780",
  'oconostota': "AI illustration of Oconostota, Overhill Cherokee war chief of Chota, about 1775",
  'path-killer': "AI illustration of Path Killer, Cherokee principal chief, about 1805",
  'pluggy': "AI illustration of Pluggy, Mingo leader, about 1776",
  'scarouady': "AI illustration of Scarouady, Oneida leader at Logstown, about 1752",
  'tanacharison': "AI illustration of Tanacharison, the Half King, Seneca leader at Logstown, about 1752",
  'the-glass': "AI illustration of The Glass, Cherokee chief, about 1805",
  // Cleared follow-up (not Item 92), Oct 2026. Will Emery is v2.
  'nonhelema': "AI illustration of Nonhelema, Shawnee Chalakatha chief and diplomat, about 1786",
  'will-emery': "AI illustration of Captain Will Emery, Shawnee-aligned leader who met Daniel Boone in 1769",
  // Likeness batch 2, waves 1–3 (Oct 2026). All v1, none-known.
  'abraham-owen': "AI illustration of Abraham Owen, Kentucky militia colonel, about 1811",
  'andrew-lewis': "AI illustration of Andrew Lewis, Virginia colonel at Point Pleasant, about 1774",
  'james-estill': "AI illustration of Capt. James Estill, Kentucky militia, about 1782",
  'joseph-bowman': "AI illustration of Maj. Joseph Bowman, Illinois campaign, about 1778",
  'john-stuart': "AI illustration of John Stuart, British southern Indian superintendent, about 1768",
  'george-nicholas': "AI illustration of George Nicholas, Kentucky constitution framer, about 1792",
  'jemima-suggett-johnson': "AI illustration of Jemima Suggett Johnson of Bryan's Station, about 1782",
  'jones-hoy': "AI illustration of Jones Hoy as a boy at Hoy's Station, about 1782",
  'matthew-arbuckle': "AI illustration of Matthew Arbuckle Sr., Fort Randolph commander, about 1777",
  'matthew-walton': "AI illustration of Matthew Walton, Kentucky congressman, about 1803",
  'nathaniel-gist': "AI illustration of Nathaniel Gist, Revolutionary colonel at Canewood, about 1793",
  'peter-hildebrand': "AI illustration of Peter Hildebrand, Cherokee removal detachment conductor, about 1838",
  'william-campbell': "AI illustration of William Campbell, Kings Mountain commander, about 1780",
  'william-fleming': "AI illustration of Col. William Fleming, physician-soldier, about 1780",
  'william-preston': "AI illustration of William Preston, Fincastle surveyor, about 1772; no known likeness exists",
  // River Raisin: modeled on the Earl oil, c. 1817. A real likeness exists.
  'james-winchester': 'AI illustration of Brig. Gen. James Winchester, about age 60 at River Raisin, 1813, modeled on the Ralph E.W. Earl portrait',
  // Susannah Hart Shelby v1 (Oct 2026). None-known.
  'susannah-shelby': 'AI illustration of Susannah Hart Shelby, Kentucky first First Lady, about 1792–95',
  'george-garvin-brown': 'Portrait photograph of George Garvin Brown, founder of Brown-Forman, about 1905',
  // Approvals 111: Rice Wave 1 (Oct 2026). All v1, none-known.
  'abraham-lincoln-capt': "AI illustration of Capt. Abraham Lincoln, the president's grandfather, about 1784",
  'henry-bird': 'AI illustration of Henry Bird, British officer on the 1780 Kentucky expedition; no known likeness exists',
  'robert-tyler': 'AI illustration of Robert Tyler, co-founder of Tyler Station, about 1781',
  'william-caldwell': "AI illustration of Capt. William Caldwell of Butler's Rangers, about 1782",
  'edward-worthington': "AI illustration of Edward Worthington, founder of Worthington's Fort, about 1780",
  // Nov 5 2026 batch. Dunmore and Ballard are modeled on known likenesses; the rest are none-known.
  'thomas-walker': 'AI illustration of Dr. Thomas Walker, physician and explorer of Cumberland Gap, about 1750',
  'lord-dunmore': 'AI illustration of John Murray, 4th Earl of Dunmore, royal governor of Virginia, modeled on the Sir Joshua Reynolds portrait of 1765',
  'thomas-bullitt': "AI illustration of Capt. Thomas Bullitt, surveyor of Bullitt's Lick, about 1773",
  'mary-draper-ingles': 'AI illustration of Mary Draper Ingles after her 1755 escape through Kentucky, about age 23',
  'jenny-wiley': 'AI illustration of Jenny Wiley after her 1789 escape from captivity, about age 29',
  'nathaniel-hart': 'AI illustration of Capt. Nathaniel Hart, Transylvania Company proprietor, about 1775',
  'william-calk': 'AI illustration of William Calk, diarist of the 1775 journey into Kentucky, about age 35',
  'bland-ballard': 'AI illustration of Bland W. Ballard in late life, modeled on the portrait in Kentucky Ante-Bellum Portraiture',
  'john-donelson': 'AI illustration of Col. John Donelson, surveyor, about 1771',
  'chief-paduke': 'AI illustration of Chief Paduke, legendary Chickasaw namesake of Paducah',
  // Nov 6 2026. None-known. Studio/History alts.
  'catherine-spears-carpenter': 'AI illustration: imagined portrait of Catherine Spears Carpenter, rural Kentucky farm woman associated with an 1818 Casey County mash-recipe sheet. No likeness survives.',
  'ebenezer-zane': 'AI illustration: imagined portrait of Col. Ebenezer Zane, who cut Zane’s Trace in 1796–97. No likeness survives.',
  'tomepomehala': 'AI illustration: imagined portrait of Tomepomehala, a Native guide on Zane’s Trace in 1796–97. No likeness survives.',
  // Frederick Stitzel v1 (Nov 6 2026). None-known; not E. H. Taylor Jr.
  'frederick-stitzel': 'AI illustration: imagined portrait of Frederick Stitzel, Louisville distiller who patented barrel warehouse racks in 1879. No likeness in the public domain is cleared for use.',
  // Nov 6 2026 v1 faces. None-known. Inline only; the Photos sidebar stays the topic image.
  'basil-hayden': 'AI illustration: imagined portrait of Basil Hayden Sr., Maryland Catholic settler and distiller, in the 1780s. No known likeness exists.',
  'jacob-spears': 'AI illustration: imagined portrait of Jacob Spears, early Bourbon County distiller, about 1794. No known likeness exists.',
  'ann-mcginty': 'AI illustration: imagined portrait of Ann McGinty, who brought a spinning wheel to Harrodstown in 1775. No known likeness exists.',
  'william-hubbell': 'AI illustration: imagined portrait of Capt. William Hubbell, Ohio River flatboat captain, 1791. No known likeness exists.',
  'henry-mckenna': 'AI illustration: imagined portrait of Henry McKenna, Fairfield distiller, about 1855. No known likeness exists.',
  // Nov 20 2026 (#436). AI portrait v1, History CLEAR. None-known; not the Kings Mountain william-campbell.
  'william-campbell-muhlenberg': "AI illustration: imagined portrait of Col. William Campbell of Muhlenberg County, founder of Greenville, as a frontier Kentucky landowner and militia colonel about 1795–1800, in a plain wool coat, waistcoat and linen neckcloth; no known likeness exists.",
  // Nov 20 2026 (#436). AI portrait render v3, History CLEAR. Imagined in life; never the remains.
  'woman-from-short-cave': "AI illustration: imagined portrait of the Woman from Short Cave, an older Native woman of the prehistoric Eastern Woodlands, in deerskin and woven cloth, with a feather in her hair and bead and pendant necklaces; no known likeness exists.",
  // Nov 20 2026 (#436 round 3). AI portraits, History CLEAR + Design PASS. None-known.
  'mary-ann-castleman': "Imagined oil-style portrait of Mary Ann Breckinridge Castleman as a young woman about 1811–16, in a grey Empire gown with a muslin chemisette; no known likeness exists",
  'david-castleman': "Imagined oil-style portrait of David Castleman about 1816, in a dark high-collared tailcoat and tall white neckcloth; no known likeness exists",
  'james-craig-greenville': "Imagined oil-style portrait of James Craig of Greenville about 1800, grey hair queued, in a worn brown coat and mustard waistcoat; no known likeness exists",
  'samuel-russell-greenville': "Imagined oil-style portrait of Samuel Russell, Greenville's first postmaster, in a plum tailcoat and white neckcloth; no known likeness exists",
  'tabitha-campbell-greenville': "Imagined oil-style portrait of Tabitha Campbell about 1800, in a muslin cap, white fichu and dark green gown; no known likeness exists",
  'philip-kennerly': "Imagined oil-style portrait of Methodist preacher Philip Kennerly about 1815, long straight hair, plain black coat and white stock; no known likeness exists",
  'william-v-cromwell': "Imagined oil-style portrait of horse breeder William V. Cromwell about 1851, with greying side-whiskers and a brown frock coat; no known likeness exists",
  'edward-p-gaines': "Imagined oil-style portrait of Scott County stockman Edward P. Gaines about 1855, in a black frock coat and bow tie; no known likeness exists",
  'isaac-byrd': "Imagined oil-style portrait of horseman Isaac Byrd about 1857, in a work jacket, vest and blue neckerchief; no known likeness exists",
  'edward-braddock': "Imagined oil-style portrait of Maj. Gen. Edward Braddock about 1755, in a scarlet British general's coat with blue facings and crimson sash; no known likeness exists",
  'peter-chartier': "Imagined oil-style portrait of Pekowi Shawnee leader and trader Peter Chartier about 1745, in a linen trade shirt with silver brooches and a blue stroud blanket; no known likeness exists",
  // Nov 20 2026 (#436). AI portrait render v1, History CLEAR. None-known.
  'john-dennis-greenville': "AI illustration of John Dennis, Muhlenberg County tavern keeper at whose house the county's first court met in 1799; no known likeness exists.",
  // Nov 20 2026 (#436). Horse series, AI portrait render v1, History CLEAR. No sourced period likeness.
  // Nov 20 2026 (#436). Horse series, AI portrait render v2, History CLEAR. Sire of gaines-denmark.
  'denmark-1839': "AI illustration of Denmark, the brown Thoroughbred stallion foaled in 1839 who became the foundation sire of the American Saddlebred, standing in a Kentucky pasture; no known likeness exists.",
  'gaines-denmark': "AI illustration: imagined portrait of Gaines' Denmark, a black saddle-type stallion with two white hind socks, standing in profile in the manner of 1850s American horse painting; no known likeness exists.",
}

export function portraitAlt(person) {
  if (person?.id && Object.hasOwn(PORTRAIT_ALTS, person.id)) return PORTRAIT_ALTS[person.id]
  const name = person?.name || ''
  if (person?.ai) return `AI illustration of ${name}`
  const caption = portraitCaption(person)
  if (caption) return `${caption} of ${name}`
  return `Portrait of ${name}`
}

/** AI portrait credit text: always 'AI illustration · Kentucky History Drive' (plus any note). */
export function aiCreditText(person) {
  const c = String(person?.credit || 'Kentucky History Drive')
  return /^AI illustration\b/i.test(c) ? c : `AI illustration · ${c}`
}

/** Escaped credit HTML with the site name in a nowrap span, so the credit wraps cleanly at 390. */
export function creditHtml(text, esc) {
  const site = 'Kentucky History Drive'
  const s = String(text || '')
  // Keep 'no known likeness exists' on its own unbroken line after 'Drive;'.
  const note = '; no known likeness exists'
  const body = s.endsWith(note) ? s.slice(0, -note.length) : s
  const tail = body === s ? '' : '; <span class="story-portrait-note">no known likeness exists</span>'
  const at = body.indexOf(site)
  if (at < 0) return esc(body) + tail
  return `${esc(body.slice(0, at))}<span class="credit-site">${esc(site)}</span>${esc(body.slice(at + site.length))}${tail}`
}
