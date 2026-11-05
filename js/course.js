/* Course progress — localStorage feh-course (+ mirrors marks into feh-progress for proof pages). */
(function () {
  var KEY = 'feh-course';
  var LEGACY = 'feh-progress';
  var COURSE = null;
  var FLAT = [];

  function basePath() {
    return document.body.dataset.base || '';
  }

  function loadRaw() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { lessons: {}, quizzes: {} };
      var d = JSON.parse(raw);
      return { lessons: d.lessons || {}, quizzes: d.quizzes || {} };
    } catch (e) {
      return { lessons: {}, quizzes: {} };
    }
  }

  function saveRaw(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function syncLegacy(id, done) {
    try {
      var raw = localStorage.getItem(LEGACY);
      var d = raw ? JSON.parse(raw) : { posts: {}, checklist: null, reflections: {} };
      d.posts = d.posts || {};
      if (done) d.posts[id] = { read: true, at: new Date().toISOString() };
      else delete d.posts[id];
      localStorage.setItem(LEGACY, JSON.stringify(d));
    } catch (e) {}
  }

  function importLegacy() {
    try {
      var raw = localStorage.getItem(LEGACY);
      if (!raw) return;
      var d = JSON.parse(raw);
      var data = loadRaw();
      var changed = false;
      Object.keys(d.posts || {}).forEach(function (id) {
        if (d.posts[id] && d.posts[id].read && !data.lessons[id]) {
          data.lessons[id] = { done: true, at: d.posts[id].at || new Date().toISOString() };
          changed = true;
        }
      });
      if (changed) saveRaw(data);
    } catch (e) {}
  }

  function isDone(id) {
    var L = loadRaw().lessons[id];
    return !!(L && L.done);
  }

  function markDone(id) {
    var data = loadRaw();
    data.lessons[id] = { done: true, at: new Date().toISOString() };
    saveRaw(data);
    syncLegacy(id, true);
    renderAll();
    return data;
  }

  function unmark(id) {
    var data = loadRaw();
    delete data.lessons[id];
    saveRaw(data);
    syncLegacy(id, false);
    renderAll();
    return data;
  }

  function toggle(id) {
    if (isDone(id)) unmark(id);
    else markDone(id);
  }

  function saveQuiz(id, result) {
    var data = loadRaw();
    data.quizzes[id] = result;
    saveRaw(data);
  }

  function getQuiz(id) {
    return loadRaw().quizzes[id] || null;
  }

  function flatten(course) {
    var out = [];
    (course.modules || []).forEach(function (m) {
      (m.lessons || []).forEach(function (L, i) {
        out.push({
          id: L.id,
          slug: L.slug,
          title: L.title,
          path: L.path,
          mins: L.mins,
          goals: L.goals || [],
          moduleId: m.id,
          moduleNum: m.number,
          moduleTitle: m.title,
          index: out.length
        });
      });
    });
    return out;
  }

  function lessonById(id) {
    for (var i = 0; i < FLAT.length; i++) if (FLAT[i].id === id) return FLAT[i];
    return null;
  }

  function nextOf(id) {
    var L = lessonById(id);
    if (!L || L.index >= FLAT.length - 1) return null;
    return FLAT[L.index + 1];
  }

  function prevOf(id) {
    var L = lessonById(id);
    if (!L || L.index <= 0) return null;
    return FLAT[L.index - 1];
  }

  function firstIncomplete() {
    for (var i = 0; i < FLAT.length; i++) if (!isDone(FLAT[i].id)) return FLAT[i];
    return FLAT[0] || null;
  }

  function doneCount() {
    return FLAT.filter(function (L) { return isDone(L.id); }).length;
  }

  function pct() {
    return FLAT.length ? Math.round((doneCount() / FLAT.length) * 100) : 0;
  }

  function moduleStatus(mod) {
    var ids = (mod.lessons || []).map(function (L) { return L.id; });
    if (!ids.length) return 'queued';
    var n = ids.filter(isDone).length;
    if (n === ids.length) return 'done';
    if (n > 0) return 'partial';
    /* unlock: previous modules complete OR first module */
    return 'open';
  }

  function isLocked(lesson) {
    /* Soft lock: prior lessons in sequence should be done; allow click-through but show status */
    if (!lesson || lesson.index === 0) return false;
    for (var i = 0; i < lesson.index; i++) {
      if (!isDone(FLAT[i].id)) return true;
    }
    return false;
  }

  function statusLabel(lesson) {
    if (isDone(lesson.id)) return 'done';
    if (isLocked(lesson)) return 'locked';
    return 'available';
  }

  function renderWidget(el) {
    if (!el) return;
    var n = FLAT.length;
    var r = doneCount();
    var p = pct();
    var next = firstIncomplete();
    var mods = (COURSE && COURSE.modules) || [];
    var dots = mods
      .map(function (m) {
        var st = moduleStatus(m);
        return (
          '<li class="' +
          st +
          '" title="Module ' +
          m.number +
          ': ' +
          m.title +
          '"><span class="dot"></span><span class="sr-only">Module ' +
          m.number +
          ' ' +
          st +
          '</span></li>'
        );
      })
      .join('');
    var cta = next
      ? '<a class="btn" href="' +
        basePath() +
        next.path +
        '">' +
        (r === 0 ? 'Start Lesson 1' : 'Continue: ' + next.title) +
        ' →</a>'
      : '<a class="btn" href="' + basePath() + 'course.html">Review syllabus →</a>';
    el.innerHTML =
      '<div class="progress-widget course-progress" role="region" aria-label="Course progress">' +
      '<div class="progress-head"><strong>Your course progress</strong> <span class="meta">' +
      r +
      ' of ' +
      n +
      ' lessons · ' +
      p +
      '% · this device only</span></div>' +
      '<div class="progress-bar" aria-hidden="true"><span style="width:' +
      p +
      '%"></span></div>' +
      '<ul class="progress-stages">' +
      dots +
      '</ul>' +
      '<p class="progress-actions">' +
      cta +
      ' <a class="btn ghost" href="' +
      basePath() +
      'course.html">Syllabus</a></p></div>';
  }

  function renderSyllabus() {
    var root = document.querySelector('[data-course-syllabus]');
    if (!root || !COURSE) return;
    var html = COURSE.modules
      .map(function (m) {
        var st = moduleStatus(m);
        var lessons = m.lessons
          .map(function (L, i) {
            var flat = lessonById(L.id);
            var s = statusLabel(flat || L);
            var badge =
              s === 'done'
                ? '<span class="status done">Done ✓</span>'
                : s === 'locked'
                ? '<span class="status queued">Locked</span>'
                : '<span class="status live">Available</span>';
            return (
              '<li class="syllabus-lesson ' +
              s +
              '"><a href="' +
              basePath() +
              L.path +
              '"><span class="syl-num">M' +
              m.number +
              '.' +
              (i + 1) +
              '</span><span class="syl-title">' +
              L.title +
              '</span><span class="syl-meta">⏱ ' +
              (L.mins || '?') +
              ' min</span>' +
              badge +
              '</a></li>'
            );
          })
          .join('');
        return (
          '<section class="module-block status-' +
          st +
          '" id="' +
          m.id +
          '">' +
          '<div class="stagehead"><span class="num">' +
          m.number +
          '</span><h2>Module ' +
          m.number +
          ': ' +
          m.title +
          '</h2><span class="status ' +
          (st === 'done' ? 'done' : 'live') +
          '">' +
          (st === 'done' ? 'Complete' : st === 'partial' ? 'In progress' : 'Open') +
          '</span></div>' +
          '<p class="teacher-voice">' +
          m.teacherIntro +
          '</p>' +
          '<ol class="syllabus-lessons">' +
          lessons +
          '</ol></section>'
        );
      })
      .join('');
    root.innerHTML = html;
  }

  function renderLessonChrome() {
    var id = document.body.dataset.lesson;
    if (!id) return;
    var L = lessonById(id);
    if (!L) return;
    var crumb = document.querySelector('[data-lesson-crumb]');
    if (crumb) {
      crumb.innerHTML =
        '<a href="' +
        basePath() +
        'course.html">Course</a> · Module ' +
        L.moduleNum +
        ': ' +
        L.moduleTitle +
        ' · Lesson ' +
        (L.index + 1) +
        ' of ' +
        FLAT.length;
    }
    var goals = document.querySelector('[data-lesson-goals]');
    if (goals && L.goals && L.goals.length) {
      goals.innerHTML =
        '<h2>Learning goals</h2><ul>' +
        L.goals.map(function (g) { return '<li>' + g + '</li>'; }).join('') +
        '</ul>';
    }
    var nav = document.querySelector('[data-lesson-nav]');
    if (nav) {
      var prev = prevOf(id);
      var next = nextOf(id);
      nav.innerHTML =
        (prev
          ? '<a class="btn ghost" href="' + basePath() + prev.path + '">← ' + prev.title + '</a>'
          : '<span></span>') +
        '<button type="button" class="btn" data-mark-lesson="' +
        id +
        '">' +
        (isDone(id) ? '✓ Lesson complete' : 'Mark lesson complete') +
        '</button>' +
        (next
          ? '<a class="btn" href="' + basePath() + next.path + '">Next: ' + next.title + ' →</a>'
          : '<a class="btn" href="' + basePath() + 'course.html">Back to syllabus →</a>');
    }
    document.querySelectorAll('[data-mark-lesson]').forEach(function (btn) {
      var on = isDone(btn.getAttribute('data-mark-lesson'));
      btn.textContent = on ? '✓ Lesson complete' : 'Mark lesson complete';
      btn.classList.toggle('is-read', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderHomeStats() {
    var el = document.querySelector('[data-course-stats]');
    if (!el) return;
    el.innerHTML =
      '<div class="stat"><span class="n">' +
      ((COURSE && COURSE.modules && COURSE.modules.length) || 0) +
      '</span><span class="l">Modules</span></div>' +
      '<div class="stat"><span class="n">' +
      FLAT.length +
      '</span><span class="l">Lessons</span></div>' +
      '<div class="stat"><span class="n">' +
      pct() +
      '%</span><span class="l">Your progress</span></div>';
  }

  function wireQuizzes() {
    document.querySelectorAll('[data-lesson-quiz]').forEach(function (form) {
      var id = form.getAttribute('data-lesson-quiz');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var correct = 0;
        var total = 0;
        form.querySelectorAll('fieldset[data-answer]').forEach(function (fs) {
          total++;
          var ans = fs.getAttribute('data-answer');
          var picked = form.querySelector('input[name="' + fs.dataset.q + '"]:checked');
          var ok = picked && picked.value === ans;
          if (ok) correct++;
          fs.classList.toggle('quiz-ok', !!ok);
          fs.classList.toggle('quiz-bad', !ok);
        });
        var out = form.querySelector('[data-quiz-result]');
        if (out) {
          out.hidden = false;
          out.innerHTML =
            '<p><strong>' +
            correct +
            ' / ' +
            total +
            '</strong> correct. Labels matter more than a score — re-read any miss.</p>';
        }
        saveQuiz(id, { correct: correct, total: total, at: new Date().toISOString() });
        if (correct === total) markDone(id);
      });
    });
  }

  function renderAll() {
    document.querySelectorAll('[data-progress-widget],[data-course-progress]').forEach(renderWidget);
    renderSyllabus();
    renderLessonChrome();
    renderHomeStats();
    if (window.FEHProgress && FEHProgress.renderAll) {
      /* keep legacy widgets in sync if present */
      try {
        FEHProgress.renderAll();
      } catch (e) {}
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mark-lesson]');
    if (!btn) return;
    e.preventDefault();
    toggle(btn.getAttribute('data-mark-lesson'));
  });

  function boot(course) {
    COURSE = course;
    FLAT = flatten(course);
    importLegacy();
    renderAll();
    wireQuizzes();
    window.FEHCourse = {
      COURSE: COURSE,
      FLAT: FLAT,
      isDone: isDone,
      markDone: markDone,
      toggle: toggle,
      pct: pct,
      doneCount: doneCount,
      firstIncomplete: firstIncomplete,
      nextOf: nextOf,
      prevOf: prevOf,
      statusLabel: statusLabel,
      renderAll: renderAll
    };
  }

  var base = basePath();
  fetch(base + 'course.json')
    .then(function (r) {
      return r.json();
    })
    .then(boot)
    .catch(function () {
      /* offline / file:// fallback: minimal flat from body dataset if needed */
      boot({ modules: [] });
    });
})();
