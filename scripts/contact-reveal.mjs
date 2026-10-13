/**
 * Contact address is assembled in the browser from split parts.
 * The built page must not contain the joined address or a mailto of it.
 */
export function contactLineHtml(lead) {
  const text = escapeHtml(lead)
  return `<p>${text} <span class="contact-reveal" data-contact-reveal><button type="button" class="btn ghost small">Show email address</button><span class="visually-hidden" aria-live="polite"></span></span></p>
    <noscript>contact [at] kyhistorydrive [dot] com</noscript>
    ${contactRevealScriptHtml()}`
}

export function contactRevealScriptHtml() {
  return `<script>
    (function () {
      document.querySelectorAll('[data-contact-reveal]').forEach(function (root) {
        var button = root.querySelector('button');
        if (!button || button.getAttribute('data-bound')) return;
        button.setAttribute('data-bound', '1');
        button.addEventListener('click', function () {
          var local = ['cont', 'act'].join('');
          var domain = ['kyhistory', 'drive'].join('') + '.' + 'com';
          var addr = local + String.fromCharCode(64) + domain;
          var link = document.createElement('a');
          link.href = 'mailto:' + addr;
          link.textContent = addr;
          var live = root.querySelector('[aria-live]');
          button.replaceWith(link);
          if (live) live.textContent = addr;
          link.focus();
        });
      });
    })();
  </script>`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
