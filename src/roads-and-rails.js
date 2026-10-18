// /roads-and-rails/ (item 70): the transport timeline map from #258 on its own page.
// Year in the hash (#1880). Old /#transport/<year> links are forwarded here by index.html.
import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { showTransport } from './transport-map.js'

// The worker has to be set before the first Map (MapLibre GL JS 6, bundler installs).
maplibregl.setWorkerUrl(maplibreWorkerUrl)

function yearFromHash() {
  const m = /^#(\d{4})$/.exec(location.hash || '')
  return m ? Number(m[1]) : null
}

showTransport(yearFromHash())
window.addEventListener('hashchange', () => {
  const year = yearFromHash()
  if (year != null) showTransport(year)
})
