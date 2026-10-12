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

export function portraitAlt(person) {
  const name = person?.name || ''
  if (person?.ai) return `AI illustration of ${name}`
  const caption = portraitCaption(person)
  if (caption) return `${caption} of ${name}`
  return `Portrait of ${name}`
}
