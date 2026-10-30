import { roadsRailsEnabled } from './roads-rails-flag.mjs'

/** Root-absolute seal files. A path without the leading slash resolves under /about/ or /stories/ and 404s. */
export function sealRotationScriptHtml() {
  return `<script>(function(){var B='/brand/',L=[B+'khd-logo.png',B+'khd-logo-c.png',B+'khd-logo-c2.png'],H=[B+'khd-logo-512.webp',B+'khd-logo-c-512.webp',B+'khd-logo-c2-512.webp'],i;try{var n=parseInt(localStorage.getItem('khd-logo-n'),10);i=isNaN(n)?Math.floor(Math.random()*L.length):(n+1)%L.length;localStorage.setItem('khd-logo-n',String(i))}catch(e){i=Math.floor(Math.random()*L.length)}document.documentElement.setAttribute('data-logo',String(i));window.__khdLogo=L[i];window.__khdLogoHi=H[i];if(i>0){var k=document.createElement('link');k.rel='preload';k.as='image';k.href=L[i];document.head.appendChild(k)}})()</script>`
}

/** Apply the rotated seal. Force a /brand/ path so a subpage cannot resolve it relatively. */
/** Full seal srcset applies at ≥1100px (homepage seal is 132px). The ≤48px mark is a <picture> source. */
export function sealSrcScriptHtml() {
  return `<script>(function(){var im=document.getElementById('brandLogo'),s=window.__khdLogo,h=window.__khdLogoHi;if(!im||!s)return;if(s.indexOf('/brand/')!==0)s='/brand/'+String(s).split('/').pop();if(h&&h.indexOf('/brand/')!==0)h='/brand/'+String(h).split('/').pop();if(im.getAttribute('src')!==s)im.setAttribute('src',s);if(h){im.setAttribute('srcset',s+' 176w, '+h+' 512w');im.setAttribute('sizes','(min-width: 1100px) 132px, 88px')}})()</script>`
}

/** Header mark at viewports where the chrome logo renders ≤48px. Full seal stays on the img for ≥96px. */
export function brandLogoHtml() {
  return `<picture>
            <source media="(max-width: 1099px)" type="image/svg+xml" srcset="/brand/khd-mark-48.svg" />
            <source media="(max-width: 1099px)" type="image/png" srcset="/brand/khd-mark-48.png 1x, /brand/khd-mark-96.png 2x" />
            <img class="brand-logo" id="brandLogo" src="/brand/khd-logo.png" width="88" height="88" alt="" decoding="async" />
          </picture>
          ${sealSrcScriptHtml()}`
}

/** Menu, search and theme toggle for the shared header on pages that are not the SPA. */
export function siteChromeScriptHtml() {
  return `<script>
      (function () {
        var header = document.querySelector('header.site-header')
        var menuBtn = document.getElementById('navMenuToggle')
        var searchBtn = document.getElementById('navSearchToggle')
        var searchBox = document.getElementById('navSearch')
        var searchInput = document.getElementById('siteSearchInput')
        var mainNav = document.getElementById('mainNav')
        var mq = window.matchMedia('(max-width: 1099px)')
        function closeMenu() {
          if (!header || !menuBtn) return
          header.classList.remove('is-menu-open')
          menuBtn.setAttribute('aria-expanded', 'false')
          menuBtn.setAttribute('aria-label', 'Open menu')
        }
        function closeSearch() {
          if (!header || !searchBtn) return
          header.classList.remove('is-search-open')
          searchBtn.setAttribute('aria-expanded', 'false')
          searchBtn.setAttribute('aria-label', 'Search places and stories')
        }
        if (header && menuBtn) {
          menuBtn.addEventListener('click', function () {
            if (!mq.matches) return
            var open = header.classList.toggle('is-menu-open')
            if (open) closeSearch()
            menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
            menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
          })
          if (mainNav) {
            mainNav.addEventListener('click', function (e) {
              if (e.target.closest('a') && mq.matches) closeMenu()
            })
          }
          document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { closeMenu(); closeSearch() }
          })
          mq.addEventListener('change', function (e) {
            if (!e.matches) { closeMenu(); closeSearch() }
          })
        }
        if (header && searchBtn) {
          searchBtn.addEventListener('click', function () {
            var open = header.classList.toggle('is-search-open')
            if (open) closeMenu()
            searchBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
            searchBtn.setAttribute('aria-label', open ? 'Close search' : 'Search places and stories')
            if (open && searchInput) searchInput.focus()
          })
        }
        function syncTheme(theme) {
          document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
            var light = theme === 'light'
            btn.setAttribute('aria-pressed', light ? 'true' : 'false')
            btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode')
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

/** Same header as the homepage. Search submits to /stories/?q=; the menu is a few lines of script. */
export function siteHeaderHtml(activeRoute = '', { roadsRails = roadsRailsEnabled() } = {}) {
  const item = (route, href, label) => {
    const current = route === activeRoute ? ' class="active" aria-current="page"' : ''
    return `<a href="${href}" data-route="${route}"${current}>${label}</a>`
  }
  return `<a class="skip-link" href="#content">Skip to content</a>
    <header class="top site-header">
      <div class="brand">
        <a href="/" class="brand-home" title="Home">
          ${brandLogoHtml()}
          <div class="brand-lockup">
            <p class="brand-title">Kentucky History Drive</p>
            <p class="tagline">History is all around us.</p>
            <p class="brand-subhead">Pioneers, Native nations, long hunters, soldiers and distillers. Explore the stories that made Kentucky, on a living map you can travel through time.</p>
          </div>
        </a>
      </div>
      <div class="nav-mobile-tools" id="navMobileTools">
        <button type="button" class="nav-icon-btn" id="navSearchToggle" aria-expanded="false" aria-controls="navSearch" aria-label="Search places and stories">
          <svg class="icon-open" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="6.25" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M16 16.5 20.5 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <svg class="icon-close" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
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
          <form id="siteSearchForm" role="search" action="/stories/" method="get" autocomplete="off">
            <label class="visually-hidden" for="siteSearchInput">Search places and stories</label>
            <input
              type="search"
              id="siteSearchInput"
              name="q"
              placeholder="Search stories"
              enterkeyhint="search"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
            />
          </form>
        </div>
        ${item('home', '/', 'Home')}
        ${item('stories', '/stories/', 'Stories')}
        ${item('timeline', '/#timeline', 'Timeline')}
        ${item('map', '/#map', 'Map')}
        ${item('people', '/people/', 'People')}
        ${item('drives', '/drives/', 'Drives')}
        ${roadsRails ? `${item('roads', '/roads-and-rails/', 'Roads &amp; Rails')}\n        ` : ''}${item('about', '/about/', 'About')}
        <button type="button" id="hpThemeToggle" class="hp-theme-toggle" data-theme-toggle aria-label="Switch to light mode" aria-pressed="false">
          <span class="hp-theme-toggle-icon" aria-hidden="true">☀</span>
          <span class="hp-theme-toggle-label">Light</span>
        </button>
      </nav>
    </header>`
}

/** Favicon + touch icon links shared by every built page head (prerendered pages, /drives/, /timeline/). */
export function faviconLinksHtml(indent = '') {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="any" />',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />',
    '<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />',
    '<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png" />',
    '<link rel="icon" type="image/png" sizes="512x512" href="/favicon-512.png" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  ].join('\n' + indent)
}

/**
 * Shared site footer (prerendered pages, /drives/, 404). `extra` is inserted after Privacy, e.g. the
 * AdSense "Privacy choices" link on pages that load ads. Root-absolute links so it works at any depth.
 */
export function siteFooterHtml(extra = '') {
  return `<footer class="foot">
      <div class="foot-copy">kyhistorydrive.com · Data © Kentucky Historical Society (public markers) · Map © OpenStreetMap contributors</div>
      <nav class="foot-links" aria-label="Footer">
        <a href="/stories/" data-route="stories">Stories</a><span class="foot-sep" aria-hidden="true">·</span>
        <a href="/#map" data-route="map">Map</a><span class="foot-sep" aria-hidden="true">·</span>
        <a href="/#timeline" data-route="timeline">Timeline</a><span class="foot-sep" aria-hidden="true">·</span>
        <a href="/people/" data-route="people">People</a><span class="foot-sep" aria-hidden="true">·</span>
        <a href="/drives/" data-route="drives">Drives</a><span class="foot-sep" aria-hidden="true">·</span>
        <a href="/routes/">Kentucky history route maps</a><span class="foot-sep" aria-hidden="true">·</span>
        <a href="/videos/" data-route="videos">Videos</a><span class="foot-sep" aria-hidden="true">·</span>
        <a href="/#resources" data-route="resources">Resources</a><span class="foot-sep" aria-hidden="true">·</span>
        <a href="/about/" data-route="about">About</a><span class="foot-sep" aria-hidden="true">·</span>
        <a href="/editorial/" data-route="editorial">Editorial</a><span class="foot-sep" aria-hidden="true">·</span>
        <a href="/contact/" data-route="contact">Contact</a><span class="foot-sep" aria-hidden="true">·</span>
        <a href="/privacy/">Privacy</a>${extra ? `\n        ${extra}` : ''}
      </nav>
    </footer>`
}
