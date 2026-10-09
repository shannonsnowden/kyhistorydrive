import { defineConfig } from 'vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

/** `/privacy` rewrites to the page. `/about` redirects to `/about/`, which serves the page. */
function privacyPath() {
  const rewrite = (req, res, next) => {
    const q = req.url?.indexOf('?') ?? -1
    const path = q === -1 ? req.url : req.url.slice(0, q)
    const search = q === -1 ? '' : req.url.slice(q)
    if (path === '/privacy' || path === '/privacy/') req.url = `/privacy/index.html${search}`
    if (path === '/about') {
      res.statusCode = 301
      res.setHeader('Location', `/about/${search}`)
      res.end()
      return
    }
    if (path === '/about/') req.url = `/about/index.html${search}`
    next()
  }
  return {
    name: 'privacy-path',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [privacyPath()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        homePreview: resolve(root, 'home-preview/index.html'),
        privacy: resolve(root, 'privacy/index.html'),
      },
    },
  },
})
