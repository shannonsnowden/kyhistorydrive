/** Commons file name, lower-case with spaces (shared by dedupe-portrait-photos and build-story-people). */
export const commonsName = (u) => {
  let f = String(u || '').split(/[?#]/)[0].split('/').pop() || ''
  try {
    f = decodeURIComponent(f)
  } catch {
    /* keep raw */
  }
  return f.replace(/^File:/, '').replace(/_/g, ' ').toLowerCase()
}
