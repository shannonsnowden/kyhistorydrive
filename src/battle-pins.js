/**
 * War-site battle pins.
 *
 * The `war` field on a war-site record maps to that war's icon, the same
 * one-icon-per-war set the drive pages use (public/icons/war-*.png, drawn from
 * scripts/icon-src/war-*.svg). If an icon file fails to load, a battle keeps
 * the default icon (the war-layer musket and sword).
 * Forts, camps, and other war sites are not battle pins.
 * Every id here must exist as /icons/<id>.png (scripts/check-map-icons.mjs).
 *
 * The war icons are dark green with amber details, drawn for light cards. On
 * the map they are composited at load time onto a cream disc with a dark ring
 * (BATTLE_PIN_DISC), so the pin edge clears 3:1 against both light and dark
 * map backgrounds (scripts/test-battle-pin-contrast.mjs). Nothing is
 * pre-rendered; the PNGs in public/icons stay as they are.
 */

export const DEFAULT_BATTLE_PIN_ICON = 'musket-sword'

/** Per-war icon ids. Keys are the war-site `war` field. */
export const WAR_BATTLE_PIN_ICONS = {
  revolutionary: 'war-revolution',
  civil: 'war-civil',
}

/**
 * Map pin disc. Sizes are CSS pixels; the image is drawn at `pixelRatio`.
 * Cream and the dark ring are the site's own --text/--bg pair.
 */
export const BATTLE_PIN_DISC = {
  diameter: 28,
  ring: 2,
  pixelRatio: 2,
  fill: '#f3ead8',
  ringColor: '#101812',
  /** Share of the inner disc the war icon fills. */
  art: 0.78,
}

/** WCAG relative luminance of a #rrggbb color. */
export function relativeLuminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) throw new Error(`not a #rrggbb color: ${hex}`)
  const n = parseInt(m[1], 16)
  const lin = (c) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

/** WCAG contrast ratio between two #rrggbb colors (1 to 21). */
export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Contrast of the pin's outer edge against a map background: the better of
 * the ring and the disc, since either one draws the edge the eye follows.
 */
export function battlePinEdgeContrast(background, disc = BATTLE_PIN_DISC) {
  return Math.max(contrastRatio(disc.ringColor, background), contrastRatio(disc.fill, background))
}

/**
 * Draw a war icon on the pin disc into a 2D canvas context sized
 * diameter * pixelRatio square. `art` is any CanvasImageSource.
 */
export function drawBattlePin(ctx, art, disc = BATTLE_PIN_DISC) {
  const size = disc.diameter * disc.pixelRatio
  const ring = disc.ring * disc.pixelRatio
  const r = size / 2
  ctx.clearRect(0, 0, size, size)
  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.fillStyle = disc.ringColor
  ctx.fill()
  ctx.beginPath()
  ctx.arc(r, r, r - ring, 0, Math.PI * 2)
  ctx.fillStyle = disc.fill
  ctx.fill()
  const side = (size - ring * 2) * disc.art
  const off = (size - side) / 2
  ctx.drawImage(art, off, off, side, side)
  return size
}

const BATTLE_SITE_TYPES = new Set(['battlefield', 'battle'])

export function battlePinIconIds() {
  return Object.values(WAR_BATTLE_PIN_ICONS)
}

/**
 * Icon id for a battle. `ready` is the set of icon ids whose image files
 * have been loaded. Anything else falls back to the current default icon.
 */
export function battlePinIconId(war, ready) {
  const key = String(war || '').trim().toLowerCase()
  const mapped = WAR_BATTLE_PIN_ICONS[key]
  if (mapped && ready?.has?.(mapped)) return mapped
  return DEFAULT_BATTLE_PIN_ICON
}

/** Empty string when this place is not a battle pin. */
export function battlePinIconForPlace(place, ready) {
  const type = String(place?.site_type || place?.siteType || '').trim().toLowerCase()
  if (!BATTLE_SITE_TYPES.has(type)) return ''
  return battlePinIconId(place?.war, ready)
}

/**
 * Set `pinIcon` only when a war-specific image is actually loaded.
 * The default icon stays the existing circle pin.
 */
export function stampBattlePins(collection, ready) {
  let custom = 0
  for (const feature of collection?.features || []) {
    const props = feature?.properties
    if (!props) continue
    const icon = battlePinIconForPlace(props, ready)
    if (!icon || icon === DEFAULT_BATTLE_PIN_ICON) {
      if (props.pinIcon) delete props.pinIcon
      continue
    }
    props.pinIcon = icon
    custom += 1
  }
  return custom
}
