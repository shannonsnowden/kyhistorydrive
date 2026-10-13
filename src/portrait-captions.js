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
  'hugh-forbes': 'AI illustration of Hugh Forbes, Scottish-born founder of Mount Sterling, about 1790',
  'daniel-boone': "AI illustration of Daniel Boone in old age, after Chester Harding's 1820 portrait",
  'benjamin-logan': 'AI illustration of Benjamin Logan, Kentucky pioneer and militia general',
  'george-rogers-clark': 'AI illustration of George Rogers Clark, after his c. 1810 portrait by C. D. Cook',
  'john-bradford': 'AI illustration of John Bradford, printer of the Kentucke Gazette',
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
  const at = s.indexOf(site)
  if (at < 0) return esc(s)
  return `${esc(s.slice(0, at))}<span class="credit-site">${esc(site)}</span>${esc(s.slice(at + site.length))}`
}
