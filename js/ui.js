/* UI layer v3: nav, active state, reveal, compare tabs, proof-page TOC, library filters, live calc. No network, no tracking. */
(function () {
  var d = document, body = d.body, base = body.dataset.base || '';
  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function toast(msg) {
    var t = $('.toast');
    if (!t) { t = d.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* Header: compact nav + active state */
  var header = $('header.site'), nav = header && $('nav', header);
  if (nav) {
    nav.id = nav.id || 'site-nav';
    nav.setAttribute('aria-label', 'Main');
    var btn = d.createElement('button');
    btn.className = 'nav-toggle'; btn.type = 'button';
    btn.setAttribute('aria-controls', nav.id); btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Open menu'); btn.textContent = '☰';
    header.insertBefore(btn, nav);
    btn.addEventListener('click', function () {
      var o = header.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(o)); btn.textContent = o ? '✕' : '☰';
      btn.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
    });
    var file = (location.pathname.split('/').pop() || 'index.html');
    var inPosts = /\/posts\//.test(location.pathname);
    $$('a', nav).forEach(function (a) {
      var h = a.getAttribute('href').split('/').pop();
      var on = inPosts ? h === 'proofs.html' : h === file;
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  /* Compare: tabs on mobile */
  $$('.compare-grid').forEach(function (g, gi) {
    var cards = $$('.compare-card', g); if (cards.length < 2) return;
    var tabs = d.createElement('div'); tabs.className = 'compare-tabs'; tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Compare views');
    cards.forEach(function (c, i) {
      var id = 'cmp' + gi + '-' + i; c.id = c.id || id; c.setAttribute('role', 'tabpanel');
      var b = d.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', c.id);
      b.textContent = c.classList.contains('fe') ? 'FE' : c.classList.contains('globe') ? 'Globe' : 'Settle';
      b.addEventListener('click', function () { sel(i); });
      tabs.appendChild(b);
    });
    function sel(i) {
      cards.forEach(function (c, j) { c.classList.toggle('active', i === j); });
      $$('button', tabs).forEach(function (b, j) { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
    }
    tabs.addEventListener('keydown', function (e) {
      var bs = $$('button', tabs), i = bs.indexOf(d.activeElement);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var n = (i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length; sel(n); bs[n].focus(); }
    });
    g.parentNode.insertBefore(tabs, g); g.parentNode.classList.add('has-tabs'); sel(0);
  });

  /* Proof pages: layout, mini-TOC, reading time, progress bar */
  var main = $('main');
  if (/\/posts\//.test(location.pathname) && main) {
    var actions = $('.post-actions', main);
    var h2s = $$('h2', main);
    var words = main.textContent.split(/\s+/).length, mins = Math.max(1, Math.round(words / 230));
    var meta = $('p.meta', main);
    if (meta) meta.insertAdjacentHTML('beforeend', ' · <span class="read-time">⏱ ' + mins + ' min read</span>');
    var layout = d.createElement('div'); layout.className = 'proof-layout';
    var pb = d.createElement('div'); pb.className = 'proof-body';
    var start = actions ? actions.nextSibling : null;
    if (start) {
      var nodes = []; for (var n = start; n; n = n.nextSibling) nodes.push(n);
      nodes.forEach(function (x) { pb.appendChild(x); });
      main.appendChild(layout); layout.appendChild(pb);
      var toc = d.createElement('aside'); toc.className = 'mini-toc'; toc.setAttribute('aria-label', 'On this page');
      var items = h2s.map(function (h, i) {
        if (!h.id) {
          var sec = h.closest('section[id]');
          var t = h.textContent.toLowerCase();
          h.id = sec && $('h2', sec) === h ? sec.id + '-h' : (/^watch/.test(t) ? 'watch' : /^sources/.test(t) ? 'sources' : 's-' + t.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40));
        }
        var label = h.textContent.replace(/^Side-by-side claim card$/, 'Compare');
        return '<li><a href="#' + h.id + '">' + label + '</a></li>';
      });
      var refl = $('.reflect', main); if (refl && !refl.id) refl.id = 'reflect';
      if (refl) items.push('<li><a href="#reflect">Reflect</a></li>');
      toc.innerHTML = '<span class="mod-label">On this page</span><ol>' + items.join('') + '</ol>';
      var mr = $('[data-mark-read]', actions);
      if (mr) {
        var clone = d.createElement('a'); clone.className = 'btn ghost small'; clone.href = '#main'; clone.textContent = '↑ Back to top';
        toc.appendChild(clone);
      }
      layout.appendChild(toc);
      /* sparing drop cap: first paragraph after first prose h2 */
      var firstProse = $$('.proof-body > h2', main)[0];
      if (firstProse && firstProse.nextElementSibling && firstProse.nextElementSibling.tagName === 'P') firstProse.nextElementSibling.classList.add('drop-cap');
      var links = $$('a', toc);
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
          });
        }, { rootMargin: '-20% 0px -70% 0px' });
        h2s.concat(refl ? [refl] : []).forEach(function (h) { io.observe(h); });
      }
    }
    var bar = d.createElement('div'); bar.className = 'read-progress'; bar.setAttribute('aria-hidden', 'true'); body.appendChild(bar);
    window.addEventListener('scroll', function () {
      var h = d.documentElement, p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      bar.style.width = (p * 100).toFixed(1) + '%';
    }, { passive: true });
  }

  /* Mark-as-read feedback */
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-mark-read]');
    if (!b) return;
    setTimeout(function () {
      var read = window.FEHProgress && FEHProgress.isRead && FEHProgress.isRead(b.getAttribute('data-mark-read'));
      b.setAttribute('aria-pressed', String(!!read));
      toast(read ? '✓ Marked as read — saved on this device' : 'Marked unread');
    }, 30);
  });

  /* Proofs library chips */
  var stages = $$('section.stage');
  if (stages.length && $('.stagebar')) {
    var TYPE = { horizon: 'observation', bedford: 'experiment', antarctica: 'testimony', 'nasa-imagery': 'media', 'maps-models': 'observation', 'hull-down': '' };
    var wrap = d.createElement('div'); wrap.className = 'library-tools'; wrap.setAttribute('aria-label', 'Filter proof themes');
    var themeChips = '<button type="button" class="chip" data-theme="all" aria-pressed="true">All themes</button>' +
      stages.map(function (s) { return '<button type="button" class="chip" data-theme="' + s.id + '" aria-pressed="false">' + $('h2', s).textContent.replace(/ \/.*| &.*/, '').split(' ').slice(0, 3).join(' ') + '</button>'; }).join('');
    var types = ['all', 'experiment', 'observation', 'testimony', 'media'];
    var typeChips = types.map(function (t) { return '<button type="button" class="chip" data-ptype="' + t + '" aria-pressed="' + (t === 'all') + '">' + (t === 'all' ? 'All types' : t) + '</button>'; }).join('');
    wrap.innerHTML = '<div class="chip-group" role="group" aria-label="Theme"><span class="mod-label">Theme</span>' + themeChips + '</div>' +
      '<div class="chip-group" role="group" aria-label="Evidence type"><span class="mod-label">Type</span>' + typeChips + '</div>' +
      '<p class="lib-count" aria-live="polite"></p>';
    $('.stagebar').parentNode.insertBefore(wrap, $('.stagebar'));
    var st = { theme: 'all', type: 'all' };
    function apply() {
      var n = 0;
      stages.forEach(function (s) {
        var ok = (st.theme === 'all' || s.id === st.theme) && (st.type === 'all' || TYPE[s.id] === st.type);
        s.hidden = !ok; if (ok) n++;
      });
      $('.lib-count', wrap).textContent = n + ' of ' + stages.length + ' themes shown';
    }
    wrap.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      var key = c.dataset.theme ? 'theme' : 'ptype';
      st[key === 'theme' ? 'theme' : 'type'] = c.dataset.theme || c.dataset.ptype;
      $$('[data-' + key + ']', wrap).forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
      apply();
    });
    apply();
  }

  /* Horizon calc: live instrument panel */
  function wireCalc() {
    var run = $('#hc-run'); if (!run || run._live) return; run._live = true;
    var panel = $('#horizon-calc');
    var h = panel && $('h2', panel);
    if (h) h.insertAdjacentHTML('afterend', '<p class="live-pill">Live · updates as you type</p>');
    $$('#hc-height,#hc-dist,#hc-hunit,#hc-dunit').forEach(function (el) {
      el.addEventListener('input', function () { run.click(); });
      el.addEventListener('change', function () { run.click(); });
    });
    run.click();
  }
  wireCalc(); d.addEventListener('DOMContentLoaded', wireCalc); window.addEventListener('load', wireCalc);

  /* First-run empty state (practice / tools) */
  var ov = $('[data-progress-overview]');
  try {
    if (ov && !localStorage.getItem('feh-progress')) {
      ov.insertAdjacentHTML('beforebegin', '<div class="first-run"><span aria-hidden="true">🧭</span><p style="margin:0"><b>First visit?</b> Nothing is tracked yet. Open any <a href="' + base + 'proofs.html">proof</a> and press “Mark as read” — progress stays on this device only.</p></div>');
    }
  } catch (e) {}

  /* Reveal on scroll */
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var els = $$('main > section, .media-card, .stage');
    var ro = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('reveal'); ro.observe(el); } });
  }
})();
