/**
 * Looting-sensitive archaeological pins (web only).
 *
 * The public coordinates of these sites are rounded to 0.1° (about 10 km) by
 * scripts/apply-story-overrides.mjs (rules: scripts/pin-rounding.json), which also writes the id list
 * to public/data/web/protected-pins.json. The map popup adds a short note for those ids.
 *
 * KILL SWITCH: set PROTECTED_PIN_NOTE_ENABLED to false to hide the popup note (the rounding itself
 * lives in the data; to undo it, revert the PR and rebuild).
 */
export const PROTECTED_PIN_NOTE_ENABLED = true

let ids = new Set()
let loading = null

export function loadProtectedPins() {
  if (!PROTECTED_PIN_NOTE_ENABLED) return Promise.resolve(ids)
  if (!loading) {
    loading = fetch('/data/web/protected-pins.json')
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((d) => {
        ids = new Set(Array.isArray(d?.ids) ? d.ids : [])
        return ids
      })
      .catch(() => ids)
  }
  return loading
}

export function isProtectedPin(id) {
  return PROTECTED_PIN_NOTE_ENABLED && !!id && ids.has(id)
}

export function protectedPinNoteHtml(id) {
  if (!isProtectedPin(id)) return ''
  return '<p class="popup-protected" data-protected-pin><strong>Approximate location.</strong> This pin is rounded to within about 10 km (6 miles) of the site to protect it from looting.</p>'
}
