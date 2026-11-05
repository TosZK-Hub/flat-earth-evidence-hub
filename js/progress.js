/* Proof reading progress — localStorage only; never sent anywhere. */
(function () {
  var KEY = 'feh-progress';
  var POSTS = [
    { id: 'bedford-level-water-surface', stage: 'bedford', title: 'Bedford Level & Water-Surface Experiments', path: 'posts/bedford-level-water-surface.html' },
    { id: 'horizon-perspective-ships', stage: 'horizon', title: 'Horizon, Perspective & Ships Hull-Down', path: 'posts/horizon-perspective-ships.html' },
    { id: 'antarctica-ice-wall-claims', stage: 'antarctica', title: 'Antarctica, Ice-Wall & Travel Claims', path: 'posts/antarctica-ice-wall-claims.html' },
    { id: 'blue-marble-space-imagery', stage: 'nasa-imagery', title: 'Blue Marble & Space Imagery Processing Debates', path: 'posts/blue-marble-space-imagery.html' },
    { id: 'gleason-ae-maps', stage: 'maps-models', title: 'Azimuthal Equidistant & Gleason-Style Maps', path: 'posts/gleason-ae-maps.html' }
  ];
  var STAGES = [
    { id: 'horizon', label: 'Horizon & perspective', postIds: ['horizon-perspective-ships'] },
    { id: 'bedford', label: 'Bedford / water surface', postIds: ['bedford-level-water-surface'] },
    { id: 'antarctica', label: 'Antarctica & ice wall', postIds: ['antarctica-ice-wall-claims'] },
    { id: 'hull-down', label: 'Globe proofs challenged', postIds: [] },
    { id: 'nasa-imagery', label: 'Space imagery debates', postIds: ['blue-marble-space-imagery'] },
    { id: 'maps-models', label: 'Alternative maps/models', postIds: ['gleason-ae-maps'] }
  ];

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { posts: {}, checklist: null, reflections: {} };
      var d = JSON.parse(raw);
      return {
        posts: d.posts || {},
        checklist: d.checklist || null,
        reflections: d.reflections || {}
      };
    } catch (e) {
      return { posts: {}, checklist: null, reflections: {} };
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function isRead(id) {
    var p = load().posts[id];
    return !!(p && p.read);
  }

  function markRead(id) {
    var data = load();
    data.posts[id] = { read: true, at: new Date().toISOString() };
    save(data);
    renderAll();
    return data;
  }

  function unmarkRead(id) {
    var data = load();
    delete data.posts[id];
    save(data);
    renderAll();
    return data;
  }

  function toggleRead(id) {
    if (isRead(id)) unmarkRead(id);
    else markRead(id);
  }

  function publishedCount() {
    return POSTS.length;
  }

  function readCount() {
    var data = load();
    return POSTS.filter(function (p) {
      return data.posts[p.id] && data.posts[p.id].read;
    }).length;
  }

  function pct() {
    var n = publishedCount();
    return n ? Math.round((readCount() / n) * 100) : 0;
  }

  function stageDone(stageId) {
    var stage = STAGES.filter(function (s) {
      return s.id === stageId;
    })[0];
    if (!stage || !stage.postIds.length) return false;
    return stage.postIds.every(isRead);
  }

  function saveReflection(postId, text) {
    var data = load();
    data.reflections[postId] = { text: text, at: new Date().toISOString() };
    save(data);
  }

  function getReflection(postId) {
    return (load().reflections || {})[postId] || null;
  }

  function saveChecklist(result) {
    var data = load();
    data.checklist = result;
    save(data);
    renderAll();
  }

  function getChecklist() {
    return load().checklist;
  }

  function resetAll() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
    renderAll();
  }

  function basePath() {
    return document.body.dataset.base || '';
  }

  function renderWidget(el) {
    if (!el) return;
    var n = publishedCount();
    var r = readCount();
    var p = pct();
    var stagesHtml = STAGES.map(function (s) {
      var hasPosts = s.postIds.length > 0;
      var done = hasPosts && stageDone(s.id);
      var partial = hasPosts && !done && s.postIds.some(isRead);
      var cls = done ? 'done' : partial ? 'partial' : hasPosts ? 'open' : 'queued';
      return (
        '<li class="' +
        cls +
        '" title="' +
        s.label +
        '"><span class="dot" aria-hidden="true"></span><span class="sr-only">' +
        s.label +
        (done ? ' complete' : hasPosts ? ' in progress' : ' queued') +
        '</span></li>'
      );
    }).join('');
    el.innerHTML =
      '<div class="progress-widget" role="region" aria-label="Proof reading progress">' +
      '<div class="progress-head"><strong>Your progress</strong> <span class="meta">' +
      r +
      ' of ' +
      n +
      ' published proofs read · stored only on this device</span></div>' +
      '<div class="progress-bar" aria-hidden="true"><span style="width:' +
      p +
      '%"></span></div>' +
      '<ul class="progress-stages">' +
      stagesHtml +
      '</ul>' +
      '<p class="progress-actions"><a class="btn ghost" href="' +
      basePath() +
      'practice.html">Test a claim →</a> <a class="btn ghost" href="' +
      basePath() +
      'proofs.html">Proof library</a></p>' +
      '</div>';
  }

  function renderMarkButtons() {
    document.querySelectorAll('[data-mark-read]').forEach(function (btn) {
      var id = btn.getAttribute('data-mark-read');
      var on = isRead(id);
      btn.textContent = on ? '✓ Marked as read' : 'Mark as read';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-read', on);
    });
  }

  function renderPostCards() {
    document.querySelectorAll('[data-post-card]').forEach(function (card) {
      var id = card.getAttribute('data-post-card');
      card.classList.toggle('is-read', isRead(id));
      var badge = card.querySelector('.read-badge');
      if (isRead(id)) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'read-badge';
          badge.textContent = 'Read';
          var meta = card.querySelector('.meta');
          if (meta) meta.appendChild(document.createTextNode(' · '));
          (meta || card).appendChild(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function renderStageStatus() {
    document.querySelectorAll('[data-stage-progress]').forEach(function (el) {
      var id = el.getAttribute('data-stage-progress');
      var stage = STAGES.filter(function (s) {
        return s.id === id;
      })[0];
      if (!stage) return;
      if (!stage.postIds.length) {
        el.textContent = 'Theme open · no deep dive yet';
        el.className = 'status queued';
        return;
      }
      if (stageDone(id)) {
        el.textContent = 'Read ✓';
        el.className = 'status live done';
      } else if (stage.postIds.some(isRead)) {
        el.textContent = 'In progress';
        el.className = 'status live';
      } else {
        el.textContent = stage.postIds.length + ' proof' + (stage.postIds.length > 1 ? 's' : '');
        el.className = 'status live';
      }
    });
  }

  function renderOverview(el) {
    if (!el) return;
    var data = load();
    var rows = POSTS.map(function (p) {
      var on = isRead(p.id);
      return (
        '<li class="' +
        (on ? 'is-read' : '') +
        '"><a href="' +
        basePath() +
        p.path +
        '">' +
        p.title +
        '</a> <button type="button" class="btn ghost small" data-mark-read="' +
        p.id +
        '">' +
        (on ? '✓ Read' : 'Mark read') +
        '</button></li>'
      );
    }).join('');
    var check = data.checklist
      ? '<p class="meta">Claim checklist last run ' +
        new Date(data.checklist.at).toLocaleString() +
        ' · score framing below.</p>'
      : '<p class="meta">Claim checklist not yet run on this device.</p>';
    el.innerHTML =
      '<div class="progress-overview">' +
      '<p><strong>' +
      readCount() +
      ' / ' +
      publishedCount() +
      '</strong> published proofs marked read (' +
      pct() +
      '%).</p>' +
      check +
      '<ul class="progress-list">' +
      rows +
      '</ul>' +
      '<p><button type="button" class="btn ghost small" id="progress-reset">Clear all progress on this device</button></p>' +
      '</div>';
    var reset = el.querySelector('#progress-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        if (confirm('Clear reading marks, notes and checklist results stored in this browser?')) {
          resetAll();
        }
      });
    }
  }

  function renderAll() {
    document.querySelectorAll('[data-progress-widget]').forEach(renderWidget);
    document.querySelectorAll('[data-progress-overview]').forEach(renderOverview);
    renderMarkButtons();
    renderPostCards();
    renderStageStatus();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mark-read]');
    if (!btn) return;
    e.preventDefault();
    toggleRead(btn.getAttribute('data-mark-read'));
  });

  document.addEventListener('DOMContentLoaded', renderAll);
  window.FEHProgress = {
    load: load,
    isRead: isRead,
    markRead: markRead,
    toggleRead: toggleRead,
    saveReflection: saveReflection,
    getReflection: getReflection,
    saveChecklist: saveChecklist,
    getChecklist: getChecklist,
    resetAll: resetAll,
    renderAll: renderAll,
    POSTS: POSTS,
    STAGES: STAGES
  };
})();
