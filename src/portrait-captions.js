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
  // Portrait sweep batch 1 (canonical faces).
  'thomas-marshall-col': 'AI illustration of Col. Thomas Marshall, Virginia surveyor and Buck Pond founder, about 1795',
  'hugh-mcgary': 'AI illustration of Hugh McGary, Harrodsburg frontiersman, about 1782',
  'hugh-forbes': 'AI illustration of Hugh Forbes, Scottish-born founder of Mount Sterling, about 1790',
  'daniel-boone': "AI illustration of Daniel Boone in old age, after Chester Harding's 1820 portrait",
  'benjamin-logan': 'AI illustration of Benjamin Logan, Kentucky pioneer and militia general',
  'george-rogers-clark': 'AI illustration of George Rogers Clark, after his c. 1810 portrait by C. D. Cook',
  'john-bradford': 'AI illustration of John Bradford, printer of the Kentucke Gazette',
  moluntha: 'AI illustration of Moluntha, elderly Mekoche Shawnee civil chief, about 1786',
  'robert-johnson': "AI illustration of Robert Johnson, founder of Johnson's Station, about 1783",
  // Item 69: related-box people and Jack Jouett.
  'john-todd': "AI illustration of John Todd, Kentucky militia colonel, about 1782",
  'levi-todd': "AI illustration of Levi Todd, Kentucky frontier officer, about 1782",
  'john-finley': "AI illustration of John Finley, trader and long hunter who guided Daniel Boone, about 1769",
  'john-hardin': "AI illustration of Col. John Hardin, Kentucky militia officer, about 1790",
  'stephen-trigg': "AI illustration of Stephen Trigg, Kentucky settler and officer, about 1782",
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
  'george-garvin-brown': 'Portrait photograph of George Garvin Brown, founder of Brown-Forman, about 1905',
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
