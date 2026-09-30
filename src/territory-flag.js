/**
 * ONE-STORY LIVE TEST: tribal territory map (Chickasaw / chickasaw-hunting-grounds only).
 *
 * KILL SWITCH: set this to `false` (and redeploy) to hide ALL territory UI:
 *   - the territory card in the Timeline story reader
 *   - the "Chickasaw claim in this area: 1780–1818" line in the Timeline list/reader
 *   - the "Native territory" control and shaded region on the Map view
 *   - the #map/territory/<slug> deep link (falls back to the plain map)
 * With the flag false no territory data file is fetched either.
 *
 * Web-only: territory data lives in public/data/web/territories/ (never public/data/app/),
 * so the iOS app / OTA manifest never see it. No data_version bump is needed to flip this.
 */
export const TRIBAL_TERRITORY_ENABLED = true
