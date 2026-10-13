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
  moluntha: 'AI illustration of Moluntha, elderly Mekoche Shawnee civil chief, about 1786',
  'robert-johnson': "AI illustration of Robert Johnson, founder of Johnson's Station, about 1783",
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
