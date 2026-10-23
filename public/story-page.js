;(function () {
  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text)
      })
    }
    return Promise.resolve(fallbackCopy(text))
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea")
      ta.value = text
      ta.setAttribute("readonly", "")
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      return true
    } catch (_) {
      return false
    }
  }

  // 1. Back to Timeline (A+B+C return logic)
  document.querySelectorAll("[data-back-to-timeline]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      try {
        var d = JSON.parse(sessionStorage.getItem("khd-story-return") || "null")
        var sameOriginRef = false
        if (document.referrer) {
          try {
            sameOriginRef = new URL(document.referrer).origin === location.origin
          } catch (_) {}
        }
        var fromTimelineRef = sameOriginRef && /#timeline/.test(document.referrer)
        var fromSession = d && d.origin && /^#?timeline/.test(d.origin.hash || "") && sameOriginRef
        if ((fromTimelineRef || fromSession) && history.length > 1) {
          e.preventDefault()
          history.back()
        }
      } catch (_) {}
    })
  })

  // 2. Print / Save as PDF buttons ([data-print] and [data-story-print])
  document.querySelectorAll("[data-print], [data-story-print]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      window.print()
    })
  })

  // 3. Open collapsed details (At a glance + Cite this story) on beforeprint, restore on afterprint
  var closedBeforePrint = []
  window.addEventListener("beforeprint", function () {
    closedBeforePrint = []
    document.querySelectorAll("details.usp-details, details[data-glance-details], details[data-cite-details]").forEach(function (d) {
      if (!d.open) {
        closedBeforePrint.push(d)
        d.open = true
      }
    })
  })
  window.addEventListener("afterprint", function () {
    closedBeforePrint.forEach(function (d) {
      d.open = false
    })
    closedBeforePrint = []
  })

  // 4. Share / Copy link button ([data-share], [data-share-story], [data-story-copy-link])
  var toast = document.querySelector("[data-share-toast]")
  function showToast(msg) {
    if (!toast) return
    toast.textContent = msg
    toast.hidden = false
    setTimeout(function () {
      toast.hidden = true
    }, 2200)
  }

  document.querySelectorAll("[data-share], [data-share-story], [data-story-copy-link]").forEach(function (btn) {
    var labelEl = btn.querySelector("[data-copy-label]") || btn.querySelector("span")
    var defaultText = labelEl ? labelEl.textContent : "Share"
    btn.addEventListener("click", function () {
      var canonical = document.querySelector('link[rel="canonical"]')
      var url = btn.getAttribute("data-share-url") || (canonical && canonical.href) || window.location.origin + window.location.pathname
      var title = btn.getAttribute("data-share-title") || document.title
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        navigator.share({ title: title, url: url }).catch(function () {})
        return
      }
      copyText(url).then(function () {
        btn.setAttribute("data-copied", "true")
        if (labelEl) labelEl.textContent = "Link copied"
        showToast("Link copied to clipboard")
        setTimeout(function () {
          btn.removeAttribute("data-copied")
          if (labelEl) labelEl.textContent = defaultText
        }, 2000)
      })
    })
  })

  // 5. More related stories button ([data-more-btn])
  document.querySelectorAll("[data-more-btn]").forEach(function (mb) {
    mb.addEventListener("click", function () {
      var section = mb.closest(".usp-related") || document
      section.querySelectorAll("[data-more], [data-more-grid]").forEach(function (el) {
        el.hidden = false
        el.removeAttribute("hidden")
      })
      mb.setAttribute("aria-expanded", "true")
      mb.hidden = true
    })
  })

  // 6. Cite this story tabs & copy
  document.querySelectorAll("[data-cite-details]").forEach(function (details) {
    var tabs = details.querySelectorAll("[data-cite-tab]")
    var panels = details.querySelectorAll("[data-cite-panel]")
    var copyBtn = details.querySelector("[data-cite-copy]")
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var target = tab.getAttribute("data-cite-tab")
        tabs.forEach(function (t) {
          var active = t.getAttribute("data-cite-tab") === target
          t.setAttribute("aria-selected", active ? "true" : "false")
          t.classList.toggle("is-active", active)
        })
        panels.forEach(function (p) {
          var match = p.getAttribute("data-cite-panel") === target
          if (match) p.removeAttribute("hidden")
          else p.setAttribute("hidden", "")
        })
      })
    })
    if (copyBtn) {
      var defaultCopyLabel = copyBtn.textContent
      copyBtn.addEventListener("click", function () {
        var activePanel = details.querySelector("[data-cite-panel]:not([hidden])")
        if (!activePanel) return
        var text = (activePanel.textContent || "").trim()
        copyText(text).then(function () {
          copyBtn.textContent = "Copied!"
          setTimeout(function () {
            copyBtn.textContent = defaultCopyLabel
          }, 2000)
        })
      })
    }
  })

  // 7. On this page TOC scroll-spy (.usp-toc a / [data-toc] / [data-story-toc])
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.usp-toc a[href^="#"], [data-toc] a[href^="#"]'))
  if (tocLinks.length > 0) {
    function spy() {
      var y = window.scrollY + 140
      var cur = tocLinks[0]
      tocLinks.forEach(function (a) {
        var id = a.getAttribute("href").slice(1)
        var t = document.getElementById(id)
        if (t && t.getBoundingClientRect().top + window.scrollY <= y) {
          cur = a
        }
      })
      tocLinks.forEach(function (a) {
        if (a === cur) {
          a.setAttribute("aria-current", "true")
          a.classList.add("is-active")
        } else {
          a.removeAttribute("aria-current")
          a.classList.remove("is-active")
        }
      })
    }
    window.addEventListener("scroll", spy, { passive: true })
    spy()
  }
})()
