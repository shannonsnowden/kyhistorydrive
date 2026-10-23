;(function () {
  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text)
      })
    }
    return Promise.resolve(fallbackCopy(text))
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch (_) {
      return false
    }
  }

  // 0. Collapse At a glance disclosure on mobile viewports by default
  if (window.matchMedia && window.matchMedia("(max-width: 1000px)").matches) {
    document.querySelectorAll("details[data-glance-details]").forEach(function (d) {
      d.removeAttribute("open")
    })
  }

  // 1. Print button
  var printBtns = document.querySelectorAll('[data-story-print]')
  printBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.print()
    })
  })

  // 2. Copy link button
  var copyBtns = document.querySelectorAll('[data-story-copy-link]')
  copyBtns.forEach(function (btn) {
    var labelEl = btn.querySelector('[data-copy-label]')
    var defaultText = labelEl ? labelEl.textContent : 'Copy link'
    btn.addEventListener('click', function () {
      var canonical = document.querySelector('link[rel="canonical"]')
      var url = (canonical && canonical.href) || window.location.origin + window.location.pathname
      copyText(url).then(function () {
        btn.setAttribute('data-copied', 'true')
        if (labelEl) labelEl.textContent = 'Copied!'
        setTimeout(function () {
          btn.removeAttribute('data-copied')
          if (labelEl) labelEl.textContent = defaultText
        }, 2000)
      })
    })
  })

  // 3. Cite this story tabs & copy
  var citeDetails = document.querySelectorAll('[data-cite-details]')
  citeDetails.forEach(function (details) {
    var tabs = details.querySelectorAll('[data-cite-tab]')
    var panels = details.querySelectorAll('[data-cite-panel]')
    var copyBtn = details.querySelector('[data-cite-copy]')
    var closeBtn = details.querySelector('[data-cite-close]')

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-cite-tab')
        tabs.forEach(function (t) {
          var active = t.getAttribute('data-cite-tab') === target
          t.setAttribute('aria-selected', active ? 'true' : 'false')
          t.classList.toggle('is-active', active)
        })
        panels.forEach(function (p) {
          var match = p.getAttribute('data-cite-panel') === target
          if (match) {
            p.removeAttribute('hidden')
          } else {
            p.setAttribute('hidden', '')
          }
        })
      })
    })

    if (copyBtn) {
      var defaultCopyLabel = copyBtn.textContent
      copyBtn.addEventListener('click', function () {
        var activePanel = details.querySelector('[data-cite-panel]:not([hidden])')
        if (!activePanel) return
        var text = (activePanel.textContent || '').trim()
        copyText(text).then(function () {
          copyBtn.textContent = 'Copied!'
          setTimeout(function () {
            copyBtn.textContent = defaultCopyLabel
          }, 2000)
        })
      })
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        details.removeAttribute('open')
        var summary = details.querySelector('summary')
        if (summary) summary.focus()
      })
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && details.hasAttribute('open')) {
        details.removeAttribute('open')
        var summary = details.querySelector('summary')
        if (summary) summary.focus()
      }
    })

    document.addEventListener('click', function (e) {
      if (details.hasAttribute('open') && !details.contains(e.target)) {
        details.removeAttribute('open')
      }
    })
  })

  // 4. TOC Scrollspy
  var tocNav = document.querySelector('[data-story-toc]')
  if (tocNav && 'IntersectionObserver' in window) {
    var links = Array.prototype.slice.call(tocNav.querySelectorAll('a[href^="#"]'))
    var targets = links
      .map(function (link) {
        var id = link.getAttribute('href').slice(1)
        var el = document.getElementById(id)
        return el ? { link: link, el: el, id: id } : null
      })
      .filter(Boolean)

    var setActive = function (id) {
      targets.forEach(function (item) {
        var active = item.id === id
        item.link.classList.toggle('is-active', active)
        if (active) {
          item.link.setAttribute('aria-current', 'location')
        } else {
          item.link.removeAttribute('aria-current')
        }
      })
    }

    if (targets.length > 0) {
      setActive(targets[0].id)
      var observer = new IntersectionObserver(
        function (entries) {
          var visible = entries
            .filter(function (en) {
              return en.isIntersecting
            })
            .sort(function (a, b) {
              return a.boundingClientRect.top - b.boundingClientRect.top
            })
          if (visible.length > 0) {
            setActive(visible[0].target.id)
          }
        },
        { rootMargin: '-15% 0px -70% 0px', threshold: [0, 0.25, 1] },
      )
      targets.forEach(function (item) {
        observer.observe(item.el)
      })
    }
  }
})()
