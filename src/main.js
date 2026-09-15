import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { marked } from 'marked'
import MiniSearch from 'minisearch'

/** CARTO Voyager raster (OSM data). Requires VITE_CARTO_API_KEY at build time. */
const CARTO_KEY = (import.meta.env.VITE_CARTO_API_KEY || '').trim()
const cartoTile = (host) => {
  const base = `https://${host}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png`
  return CARTO_KEY ? `${base}?key=${encodeURIComponent(CARTO_KEY)}` : base
}
