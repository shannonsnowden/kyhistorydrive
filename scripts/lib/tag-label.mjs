/** Display label for a story tag slug. Known acronyms stay uppercase. */
export const TAG_ACRONYMS = new Set(['usct', 'khs', 'nrhp', 'csa', 'usa', 'us', 'tva', 'wpa', 'ccc', 'naacp', 'ky'])

export function tagLabel(tag) {
  return String(tag)
    .split('-')
    .filter(Boolean)
    .map((w) => (TAG_ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}
