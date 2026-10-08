/**
 * Compact header for viewports 600px and below.
 * One bar holds the logo, title, a search icon, and a menu button.
 * The menu discloses Home, Map, Timeline, About, App, Today's stories, and the theme toggle.
 */
export class MobileNav {
  static QUERY = '(max-width: 600px)'

  static #header = null
  static #menuBtn = null
  static #searchBtn = null
  static #tools = null
  static #wired = false
  /** Desktop child order of #mainNav, restored above 600px. */
  static #desktopOrder = null

  static init() {
    const header = document.querySelector('header.site-header')
    const menuBtn = document.getElementById('navMenuToggle')
    const searchBtn = document.getElementById('navSearchToggle')
    const tools = document.getElementById('navMobileTools')
    if (!header || !menuBtn || !searchBtn || !tools) return
    this.#header = header
    this.#menuBtn = menuBtn
    this.#searchBtn = searchBtn
    this.#tools = tools
    if (this.#wired) return
    this.#wired = true

    menuBtn.addEventListener('click', () => this.toggleMenu())
    searchBtn.addEventListener('click', () => this.toggleSearch())
    header.querySelector('.brand-home')?.addEventListener('click', () => {
      this.closeMenu({ restoreFocus: false })
      this.closeSearch({ restoreFocus: false })
    })
    document.getElementById('mainNav')?.addEventListener('click', (e) => {
      if (!e.target.closest('a')) return
      if (!this.isNarrow()) return
      this.closeMenu({ restoreFocus: false })
    })
    document.getElementById('mainNav')?.addEventListener('keydown', (e) => this.#trapMenuTab(e))
    document.addEventListener('keydown', (e) => this.#onKeydown(e))
    document.addEventListener('click', (e) => this.#onDocumentClick(e))
    window.matchMedia(this.QUERY).addEventListener('change', (e) => {
      this.layout()
      if (e.matches) return
      this.closeMenu({ restoreFocus: false })
      this.closeSearch({ restoreFocus: false })
    })
    this.layout()
    window.addEventListener('hashchange', () => {
      this.closeMenu({ restoreFocus: false })
      this.closeSearch({ restoreFocus: false })
    })
  }

  static isNarrow() {
    return window.matchMedia(this.QUERY).matches
  }

  /**
   * On a phone, put the links in the same order they are shown and tabbed:
   * Home, Map, Timeline, About, App, Today's stories, theme. Wider screens
   * keep the original header order.
   */
  static layout() {
    const nav = document.getElementById('mainNav')
    if (!nav) return
    if (!this.#desktopOrder) this.#desktopOrder = [...nav.children]
    const narrow = [
      nav.querySelector('a[data-route="home"]'),
      nav.querySelector('a[data-route="map"]'),
      nav.querySelector('a[data-route="timeline"]'),
      nav.querySelector('a[data-route="about"]'),
      nav.querySelector('a[data-route="app"]'),
      document.getElementById('navToday'),
      document.getElementById('hpThemeToggle'),
      document.getElementById('navSearch'),
    ].filter(Boolean)
    const nodes = this.isNarrow() ? narrow : this.#desktopOrder
    nodes.forEach((el) => nav.appendChild(el))
  }

  static isMenuOpen() {
    return Boolean(this.#header?.classList.contains('is-menu-open'))
  }

  static isSearchOpen() {
    return Boolean(this.#header?.classList.contains('is-search-open'))
  }

  static toggleMenu() {
    if (!this.isNarrow()) return
    if (this.isMenuOpen()) this.closeMenu({ restoreFocus: true })
    else this.openMenu()
  }

  static openMenu() {
    if (!this.isNarrow() || !this.#header || !this.#menuBtn) return
    this.closeSearch({ restoreFocus: false })
    this.#header.classList.add('is-menu-open')
    this.#menuBtn.setAttribute('aria-expanded', 'true')
    this.#menuBtn.setAttribute('aria-label', 'Close menu')
    const panel = document.getElementById('mainNav')
    const first = panel ? this.focusables(panel)[0] : null
    first?.focus()
  }

  static closeMenu({ restoreFocus = false } = {}) {
    const wasOpen = this.isMenuOpen()
    this.#header?.classList.remove('is-menu-open')
    this.#menuBtn?.setAttribute('aria-expanded', 'false')
    this.#menuBtn?.setAttribute('aria-label', 'Open menu')
    if (wasOpen && restoreFocus) this.#menuBtn?.focus()
  }

  static toggleSearch() {
    if (!this.isNarrow()) return
    if (this.isSearchOpen()) this.closeSearch({ restoreFocus: true })
    else this.openSearch()
  }

  static openSearch() {
    if (!this.isNarrow() || !this.#header || !this.#searchBtn) return
    this.closeMenu({ restoreFocus: false })
    this.#header.classList.add('is-search-open')
    this.#searchBtn.setAttribute('aria-expanded', 'true')
    this.#searchBtn.setAttribute('aria-label', 'Close search')
    document.getElementById('siteSearchInput')?.focus()
  }

  static closeSearch({ restoreFocus = false } = {}) {
    const wasOpen = this.isSearchOpen()
    this.#header?.classList.remove('is-search-open')
    this.#searchBtn?.setAttribute('aria-expanded', 'false')
    this.#searchBtn?.setAttribute('aria-label', 'Search places and stories')
    const box = document.getElementById('siteSearchResults')
    const input = document.getElementById('siteSearchInput')
    if (box) box.hidden = true
    input?.setAttribute('aria-expanded', 'false')
    if (wasOpen && restoreFocus) this.#searchBtn?.focus()
  }

  /** Focusable controls that are actually visible. */
  static focusables(root) {
    if (!root) return []
    const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    return [...root.querySelectorAll(sel)].filter((el) => {
      if (el.closest('[hidden]')) return false
      if (el.getAttribute('aria-hidden') === 'true') return false
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') return false
      return el.getClientRects().length > 0
    })
  }

  static #onKeydown(e) {
    if (e.key !== 'Escape' || !this.isNarrow()) return
    if (this.isSearchOpen()) {
      e.preventDefault()
      this.closeSearch({ restoreFocus: true })
      return
    }
    if (this.isMenuOpen()) {
      e.preventDefault()
      this.closeMenu({ restoreFocus: true })
    }
  }

  static #onDocumentClick(e) {
    if (!this.#header || this.#header.contains(e.target)) return
    if (this.isMenuOpen()) this.closeMenu({ restoreFocus: true })
    if (this.isSearchOpen()) this.closeSearch({ restoreFocus: false })
  }

  static #trapMenuTab(e) {
    if (e.key !== 'Tab' || !this.isMenuOpen() || !this.isNarrow()) return
    const panel = document.getElementById('mainNav')
    const items = [...this.focusables(this.#tools), ...this.focusables(panel)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !items.includes(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }
}
