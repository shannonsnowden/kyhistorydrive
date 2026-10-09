/** Menu and theme toggle for the shared header on pages that are not the SPA. */
export function siteChromeScriptHtml() {
  return `<script>
      (function () {
        var header = document.querySelector('header.site-header')
        var menuBtn = document.getElementById('navMenuToggle')
        var mq = window.matchMedia('(max-width: 600px)')
        function closeMenu() {
          if (!header || !menuBtn) return
          header.classList.remove('is-menu-open')
          menuBtn.setAttribute('aria-expanded', 'false')
          menuBtn.setAttribute('aria-label', 'Open menu')
        }
        if (header && menuBtn) {
          menuBtn.addEventListener('click', function () {
            if (!mq.matches) return
            var open = header.classList.toggle('is-menu-open')
            menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
            menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
          })
          document.getElementById('mainNav').addEventListener('click', function (e) {
            if (e.target.closest('a') && mq.matches) closeMenu()
          })
          document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMenu()
          })
          mq.addEventListener('change', function (e) { if (!e.matches) closeMenu() })
        }
        function syncTheme(theme) {
          document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
            var light = theme === 'light'
            btn.setAttribute('aria-pressed', light ? 'true' : 'false')
            btn.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme')
            var label = btn.querySelector('.hp-theme-toggle-label')
            var icon = btn.querySelector('.hp-theme-toggle-icon')
            if (label) label.textContent = light ? 'Dark' : 'Light'
            if (icon) icon.textContent = light ? '☾' : '☀'
          })
        }
        syncTheme(document.documentElement.getAttribute('data-hp-theme') || 'dark')
        document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var next = document.documentElement.getAttribute('data-hp-theme') === 'light' ? 'dark' : 'light'
            document.documentElement.setAttribute('data-hp-theme', next)
            try {
              localStorage.setItem('khd-theme', next)
              localStorage.setItem('khd-home-preview-theme', next)
            } catch (e) {}
            syncTheme(next)
          })
        })
      })()
    </script>`
  }

/** Same header as the homepage. Search and Today’s stories link back; the menu is a few lines of script. */
export function siteHeaderHtml(activeRoute = '') {
  const item = (route, href, label) => {
      const current = route === activeRoute ? ' class="active" aria-current="page"' : ''
      return `<a href="${href}" data-route="${route}"${current}>${label}</a>`
    }
    return `<a class="skip-link" href="#content">Skip to content</a>
    <header class="top site-header">
      <div class="brand">
        <a href="/" class="brand-home" title="Home">
          <img class="brand-logo" id="brandLogo" src="/brand/khd-logo.png" width="88" height="88" alt="" />
          <script>(function(){var im=document.getElementById('brandLogo'),s=window.__khdLogo;if(im&&s&&im.getAttribute('src')!==s)im.setAttribute('src',s)})()</script>
          <h1>Kentucky History Drive</h1>
        </a>
        <p class="tagline">History is all around us.</p>
      </div>
      <div class="nav-mobile-tools" id="navMobileTools">
        <a class="nav-icon-btn" id="navSearchToggle" href="/" aria-label="Search places and stories">
          <svg class="icon-open" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="6.25" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M16 16.5 20.5 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </a>
        <button type="button" class="nav-icon-btn" id="navMenuToggle" aria-expanded="false" aria-controls="mainNav" aria-label="Open menu">
          <svg class="icon-open" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <svg class="icon-close" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <nav id="mainNav" aria-label="Primary">
        <div class="nav-search" id="navSearch">
          <a id="siteSearchInput" href="/">Search places &amp; stories…</a>
        </div>
        <div class="nav-today" id="navToday">
          <a class="nav-today-btn" href="/#timeline">Today’s stories</a>
        </div>
        ${item('home', '/', 'Home')}
        ${item('map', '/#map', 'Map')}
        ${item('timeline', '/#timeline', 'Timeline')}
        ${item('about', '/about/', 'About')}
        ${item('app', '/#app', 'iPhone app (coming soon)')}
        <button type="button" id="hpThemeToggle" class="hp-theme-toggle" data-theme-toggle aria-label="Switch to light theme" aria-pressed="false">
          <span class="hp-theme-toggle-icon" aria-hidden="true">☀</span>
          <span class="hp-theme-toggle-label">Light</span>
        </button>
      </nav>
    </header>`
  }

