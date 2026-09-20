/**
 * Shared light/dark theme for `/` (map, timeline, about, app, stories)
 * and `/home-preview/`. Preference is stored in `khd-theme` and mirrored
 * to the legacy `khd-home-preview-theme` key so existing preview visits stay in sync.
 */
export const THEME_KEY = 'khd-theme'
export const THEME_KEY_LEGACY = 'khd-home-preview-theme'
export const THEME_ATTR = 'data-hp-theme'

export function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY) || localStorage.getItem(THEME_KEY_LEGACY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return null
}

export function preferredTheme() {
  const stored = readStoredTheme()
  if (stored) return stored
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

function syncToggle(btn, theme) {
  const isLight = theme === 'light'
  btn.setAttribute('aria-pressed', isLight ? 'true' : 'false')
  btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme')
  const label = btn.querySelector('.hp-theme-toggle-label')
  const icon = btn.querySelector('.hp-theme-toggle-icon')
  if (label) label.textContent = isLight ? 'Dark' : 'Light'
  if (icon) icon.textContent = isLight ? '☾' : '☀'
}

export function applyTheme(theme, { persist = true } = {}) {
  const next = theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute(THEME_ATTR, next)
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, next)
      localStorage.setItem(THEME_KEY_LEGACY, next)
    } catch {
      /* ignore */
    }
  }
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => syncToggle(btn, next))
}

export function initThemeToggle() {
  applyTheme(preferredTheme())
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    if (btn.dataset.themeWired) return
    btn.dataset.themeWired = '1'
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute(THEME_ATTR)
      applyTheme(current === 'light' ? 'dark' : 'light')
    })
  })
  window.addEventListener('storage', (e) => {
    if (e.key !== THEME_KEY && e.key !== THEME_KEY_LEGACY) return
    if (e.newValue === 'light' || e.newValue === 'dark') {
      applyTheme(e.newValue, { persist: false })
    }
  })
}
