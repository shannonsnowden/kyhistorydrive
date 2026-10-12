/**
 * War-site battle pins.
 *
 * The `war` field on a war-site record maps to an icon id. Story Studio will
 * add the art at /icons/<id>.png. Until that file is on the site, a battle
 * keeps the current default icon (the war-layer musket and sword).
 * Forts, camps, and other war sites are not battle pins.
 */

export const DEFAULT_BATTLE_PIN_ICON = 'musket-sword'

/** Icon ids Story Studio owns. Keys are the war-site `war` field. */
export const WAR_BATTLE_PIN_ICONS = {
  revolutionary: 'battle-revolutionary',
  civil: 'battle-civil',
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
