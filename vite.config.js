import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const partsDir = path.join(rootDir, 'src/main-parts')

function assembleMain() {
  const names = fs.readdirSync(partsDir)
  const jsParts = names.filter((f) => /^\d+\.js$/.test(f)).sort()
  if (jsParts.length) {
    return jsParts.map((f) => fs.readFileSync(path.join(partsDir, f), 'utf8')).join('')
  }
  const packed = names.filter((f) => /^\d+\.js\.gz\.b64$/.test(f)).sort()
  if (packed.length) {
    return packed
      .map((f) => {
        const b64 = fs.readFileSync(path.join(partsDir, f), 'utf8').trim()
        return gunzipSync(Buffer.from(b64, 'base64')).toString('utf8')
      })
      .join('')
  }
  throw new Error('src/main-parts is empty; cannot assemble main.js')
}

function assembleMainPlugin() {
  const mainId = path.join(rootDir, 'src/main.js')
  return {
    name: 'assemble-main',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id.includes('src/main.js') || id === mainId) return mainId
      if (importer && id === './main.js') return mainId
      return null
    },
    load(id) {
      if (path.resolve(id) === mainId) return assembleMain()
      return null
    },
    configureServer(server) {
      server.watcher.add(partsDir)
    },
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(partsDir)) return
      const mod = server.moduleGraph.getModuleById(mainId)
      if (!mod) return
      server.moduleGraph.invalidateModule(mod)
      return [mod]
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [assembleMainPlugin()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
