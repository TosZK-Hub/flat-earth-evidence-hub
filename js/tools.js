/* Horizon / distance estimator + client search + ranked filters — local only. */
(function () {
  /* Mean Earth radius used in common curvature approximations (statute miles). */
  var R_MI = 3959;
  var R_KM = 6371;
  /* drop ≈ d² / (2R); in inches for miles → ≈ 8 × d_mi² (see note in UI). */

  function dropFeet(dMi) {
    /* Geometric drop of surface below a tangent at surface level: R(1 - cos(d/R)) ≈ d²/(2R) */
    var d = dMi;
    var R = R_MI;
    var exact = R * (1 - Math.cos(d / R)) * 5280; /* miles → feet */
    return exact;
  }

  function dropFromApprox8(dMi) {
    return (8 * dMi * dMi) / 12; /* inches → feet */
  }

  /** Horizon distance (miles) for eye height hFeet, no refraction: sqrt(h(2R+h)) ≈ sqrt(2Rh) */
  function horizonMi(hFeet) {
    var Rft = R_MI * 5280;
    return Math.sqrt(hFeet * (2 * Rft + hFeet)) / 5280;
  }

  /**
   * Hidden height (feet) of a distant object beyond geometric horizon,
   * observer height hObsFeet, distance dMi — no refraction.
   * Classic survey approx after subtracting observer's horizon distance.
   */
  function hiddenFeet(hObsFeet, dMi) {
    var dH = horizonMi(hObsFeet);
    if (dMi <= dH) return 0;
    var beyond = dMi - dH;
    return dropFeet(beyond);
  }

  function fmt(n, digits) {
    if (!isFinite(n)) return '—';
    var d = digits == null ? 1 : digits;
    return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });
  }

  function renderCalc(root) {
    if (!root) return;
    root.innerHTML =
      '<div class="tool-panel" id="horizon-calc">' +
      '<h2>Horizon / distance estimator</h2>' +
      '<p class="lede short">Client-side only. Compares <strong>globe-model geometric drop</strong> (established sphere geometry, no refraction) with the common FE expectation of <strong>no geometric drop</strong> (hypothesis). Does not decide Earth’s shape.</p>' +
      '<div class="calc-grid">' +
      '<div class="calc-field"><label for="hc-height">Observer eye height</label>' +
      '<input type="number" id="hc-height" min="0.1" step="any" value="2"></div>' +
      '<div class="calc-field"><label for="hc-hunit">Height unit</label>' +
      '<select id="hc-hunit"><option value="m">metres</option><option value="ft">feet</option></select></div>' +
      '<div class="calc-field"><label for="hc-dist">Distance to target</label>' +
      '<input type="number" id="hc-dist" min="0.1" step="any" value="10"></div>' +
      '<div class="calc-field"><label for="hc-dunit">Distance unit</label>' +
      '<select id="hc-dunit"><option value="mi">miles (statute)</option><option value="km">kilometres</option></select></div>' +
      '</div>' +
      '<p><button type="button" class="btn" id="hc-run">Calculate</button></p>' +
      '<div class="calc-out" id="hc-out" aria-live="polite"></div>' +
      '<div class="calc-assumptions">' +
      '<p><strong>Assumptions (read these)</strong></p>' +
      '<ul>' +
      '<li>Mean Earth radius <code>R ≈ 3959 mi</code> (≈ 6371 km) — standard mean spherical radius.</li>' +
      '<li>Geometric surface drop below a surface-level tangent: <code>drop = R(1 − cos(d/R)) ≈ d²/(2R)</code>. The popular <code>≈ 8 in × miles²</code> is the same approximation in inches for small <code>d</code>.</li>' +
      '<li><strong>No atmospheric refraction</strong> in this tool. Real lines of sight bend; warm/cool layers can hide or reveal targets. For refraction-aware sims see Walter Bislin’s Curvature App or Metabunk’s Curve Calculator (external).</li>' +
      '<li>“Hidden” uses horizon distance <code>√(h(2R+h))</code> then drop on the remaining distance — a common survey teaching approximation, not a full ray-trace.</li>' +
      '<li>FE “no drop” column is the community <em>hypothesis</em> that still water / local plane means zero geometric bulge — labelled hypothesis, not established.</li>' +
      '</ul>' +
      '<p class="meta">Cite: sphere geometry textbooks / survey manuals for <code>d²/(2R)</code>; Wikipedia “Bedford Level experiment” and optics refs for refraction caveats.</p>' +
      '</div></div>';

    function run() {
      var hVal = parseFloat(document.getElementById('hc-height').value);
      var dVal = parseFloat(document.getElementById('hc-dist').value);
      var hUnit = document.getElementById('hc-hunit').value;
      var dUnit = document.getElementById('hc-dunit').value;
      var out = document.getElementById('hc-out');
      if (!(hVal > 0) || !(dVal > 0)) {
        out.innerHTML = '<p class="label l-hyp"><strong>Need positive numbers</strong><span> Enter height and distance greater than zero.</span></p>';
        return;
      }
      var hFt = hUnit === 'm' ? hVal * 3.280839895 : hVal;
      var dMi = dUnit === 'km' ? dVal / 1.609344 : dVal;
      var rawDropFt = dropFeet(dMi);
      var approx8Ft = dropFromApprox8(dMi);
      var dH = horizonMi(hFt);
      var hid = hiddenFeet(hFt, dMi);
      var dHDisp = dUnit === 'km' ? dH * 1.609344 : dH;
      var distLabel = dUnit === 'km' ? 'km' : 'mi';

      out.innerHTML =
        '<div class="calc-result globe-r">' +
        '<p class="meta"><span class="badge">Established geometry</span> Globe-model (no refraction)</p>' +
        '<p>Surface drop under tangent (ignore eye height): <span class="val">' +
        fmt(rawDropFt, 1) +
        ' ft</span> <span class="meta">(' +
        fmt(rawDropFt * 12, 0) +
        ' in · 8″×mi² approx ' +
        fmt(approx8Ft, 1) +
        ' ft)</span></p>' +
        '<p>Geometric horizon for this eye height: <strong>' +
        fmt(dHDisp, 2) +
        ' ' +
        distLabel +
        '</strong></p>' +
        '<p>Approx. hidden height of a zero-height target at this distance: <span class="val">' +
        fmt(hid, 1) +
        ' ft</span>' +
        (dMi <= dH ? ' <span class="meta">(target inside geometric horizon → 0)</span>' : '') +
        '</p>' +
        '</div>' +
        '<div class="calc-result fe-r">' +
        '<p class="meta"><span class="badge">Hypothesis</span> FE “no drop” expectation</p>' +
        '<p>Geometric bulge: <span class="val">0</span></p>' +
        '<p class="meta">Under a locally flat / plane model, distance alone does not hide a target behind a curved surface. Perspective, zoom limits, haze and refraction still apply — this column only states the geometric claim.</p>' +
        '<p class="meta">What would settle a specific sight: logged eye/target heights, distance survey, weather/refraction notes, and preferably a mid-path marker (Wallace-style).</p>' +
        '</div>';
    }

    document.getElementById('hc-run').addEventListener('click', run);
    root.querySelectorAll('input,select').forEach(function (el) {
      el.addEventListener('change', run);
      el.addEventListener('keyup', function (e) {
        if (e.key === 'Enter') run();
      });
    });
    run();
  }

  /* ——— Client search over posts.json ——— */
  function renderSearch(root) {
    if (!root) return;
    var base = document.body.dataset.base || '';
    root.innerHTML =
      '<div class="search-box" role="search">' +
      '<label for="feh-search">Search proofs (titles, tags, summaries)</label>' +
      '<input type="search" id="feh-search" placeholder="e.g. refraction, Gleason, Blue Marble, Antarctica…" autocomplete="off">' +
      '<div class="search-hits" id="feh-search-hits"></div></div>';
    var input = root.querySelector('#feh-search');
    var hits = root.querySelector('#feh-search-hits');
    var cache = null;

    function ensure(cb) {
      if (cache) return cb(cache);
      fetch(base + 'posts.json')
        .then(function (r) {
          return r.json();
        })
        .then(function (p) {
          cache = p;
          cb(p);
        })
        .catch(function () {
          hits.innerHTML = '<p class="search-empty">Could not load posts.json (try via http server).</p>';
        });
    }

    function q(posts, term) {
      term = (term || '').trim().toLowerCase();
      if (!term) {
        hits.innerHTML = '';
        return;
      }
      var parts = term.split(/\s+/);
      var list = posts.filter(function (p) {
        var blob = (p.title + ' ' + p.summary + ' ' + (p.tags || []).join(' ') + ' ' + (p.stage || '') + ' ' + (p.type || '')).toLowerCase();
        return parts.every(function (w) {
          return blob.indexOf(w) !== -1;
        });
      });
      if (!list.length) {
        hits.innerHTML = '<p class="search-empty">No proofs match “' + term.replace(/[<>&]/g, '') + '”.</p>';
        return;
      }
      hits.innerHTML = list
        .map(function (p) {
          return (
            '<div class="card" data-post-card="' +
            p.slug +
            '"><p class="meta"><span class="badge">' +
            p.stage +
            '</span>' +
            (p.type ? ' · <span class="proof-type pt-' + p.type + '">' + p.type + '</span>' : '') +
            '</p><h3><a href="' +
            base +
            p.path +
            '">' +
            p.title +
            '</a></h3><p>' +
            p.summary +
            '</p></div>'
          );
        })
        .join('');
      if (window.FEHProgress) FEHProgress.renderAll();
    }

    input.addEventListener('input', function () {
      ensure(function (p) {
        q(p, input.value);
      });
    });
  }

  /* ——— Ranked strongest-arguments list with type filters ——— */
  var RANKED = [
    {
      slug: 'bedford-level-water-surface',
      title: 'Bedford Level & water-surface experiments',
      type: 'experiment',
      why: 'Named historical tests + modern recreation; refraction is the live dispute.',
      strength: 'Highest signal among FE field classics when heights are logged.'
    },
    {
      slug: 'horizon-perspective-ships',
      title: 'Horizon, perspective & ships hull-down',
      type: 'observation',
      why: 'Everyday long-lens / zoom-back claims; perspective vs curvature is testable.',
      strength: 'Strongest “see it yourself” theme — also most often under-specified.'
    },
    {
      slug: 'gleason-ae-maps',
      title: 'AE / Gleason-style maps as models',
      type: 'observation',
      why: 'Real cartographic projection; southern distances are a clean falsifier.',
      strength: 'Map claims are crisp once flight times / great-circle distances are tabled.'
    },
    {
      slug: 'blue-marble-space-imagery',
      title: 'Blue Marble / space imagery processing',
      type: 'media',
      why: 'Documented composites vs “therefore fake Earth” leap.',
      strength: 'Best place to separate established image pipelines from speculation.'
    },
    {
      slug: 'antarctica-ice-wall-claims',
      title: 'Antarctica, ice-wall & travel claims',
      type: 'testimony',
      why: 'Treaty text vs perimeter narrative; logistics and tourism are checkable.',
      strength: 'Primary documents settle a lot; gunpoint anecdotes stay speculation.'
    }
  ];

  function renderRanked(root) {
    if (!root) return;
    var base = document.body.dataset.base || '';
    var state = { filter: 'all' };

    function paint() {
      var filters = ['all', 'experiment', 'observation', 'testimony', 'media'];
      var bar =
        '<div class="filter-bar" role="toolbar" aria-label="Filter by evidence type">' +
        filters
          .map(function (f) {
            var label = f === 'all' ? 'All types' : f;
            return (
              '<button type="button" data-filter="' +
              f +
              '" aria-pressed="' +
              (state.filter === f) +
              '">' +
              label +
              '</button>'
            );
          })
          .join('') +
        '</div>';
      var items = RANKED.filter(function (r) {
        return state.filter === 'all' || r.type === state.filter;
      });
      var list =
        '<ol class="rank-list">' +
        items
          .map(function (r, i) {
            return (
              '<li data-type="' +
              r.type +
              '"><span class="rank-num">' +
              (i + 1) +
              '</span><div><h3><a href="' +
              base +
              'posts/' +
              r.slug +
              '.html">' +
              r.title +
              '</a></h3>' +
              '<p class="rank-meta"><span class="proof-type pt-' +
              r.type +
              '">' +
              r.type +
              '</span> ' +
              r.strength +
              '</p><p>' +
              r.why +
              '</p></div></li>'
            );
          })
          .join('') +
        '</ol>';
      if (!items.length) list = '<p class="search-empty">No proofs in this filter yet.</p>';
      root.innerHTML =
        '<div class="section-head"><h2>Strongest arguments (ranked)</h2><span class="meta">Editorial ranking · not “proven”</span></div>' +
        '<p class="meta">Order reflects clarity of sources + how cleanly a falsifier can be stated — not a score for FE or globe victory.</p>' +
        bar +
        list;
      root.querySelectorAll('[data-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.filter = btn.getAttribute('data-filter');
          paint();
        });
      });
    }
    paint();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-horizon-calc]').forEach(renderCalc);
    document.querySelectorAll('[data-search]').forEach(renderSearch);
    document.querySelectorAll('[data-ranked]').forEach(renderRanked);
  });

  window.FEHTools = {
    dropFeet: dropFeet,
    horizonMi: horizonMi,
    hiddenFeet: hiddenFeet,
    renderCalc: renderCalc,
    renderSearch: renderSearch,
    renderRanked: renderRanked,
    RANKED: RANKED
  };
})();
