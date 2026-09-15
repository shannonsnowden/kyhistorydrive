import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const partsDir = path.join(rootDir, 'src/main-parts')

function assembleMain() {
  const files = fs.readdirSync(partsDir).filter((f) => f.endsWith('.js')).sort()
  if (!files.length) {
    throw new Error('src/main-parts is empty; cannot assemble main.js')
  }
  return files.map((f) => fs.readFileSync(path.join(partsDir, f), 'utf8')).join('')
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
