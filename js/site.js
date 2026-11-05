// Progressive enhancement: renders posts from posts.json into [data-posts] containers.
// Static fallback HTML stays if fetch fails (e.g. file:// in some browsers).
(function () {
  function slugFromPath(path) {
    var m = (path || '').match(/([^/]+)\.html$/);
    return m ? m[1] : '';
  }
  function cardHtml(p, base) {
    var slug = p.slug || slugFromPath(p.path);
    var tags = (p.tags || [])
      .map(function (t) {
        return '<span class="tag">' + t + '</span>';
      })
      .join('');
    var media = '';
    if (p.media && p.media.length) {
      media =
        '<p class="meta">Watch: ' +
        p.media
          .slice(0, 2)
          .map(function (m) {
            return m.title;
          })
          .join(' · ') +
        '</p>';
    }
    return (
      '<div class="card" data-post-card="' +
      slug +
      '"><p class="meta">' +
      p.date +
      ' · <span class="badge">' +
      p.stage +
      '</span></p><h3><a href="' +
      base +
      p.path +
      '">' +
      p.title +
      '</a></h3><p>' +
      p.summary +
      '</p>' +
      media +
      tags +
      '</div>'
    );
  }
  var els = document.querySelectorAll('[data-posts]');
  if (!els.length) return;
  var base = document.body.dataset.base || '';
  fetch(base + 'posts.json')
    .then(function (r) {
      return r.json();
    })
    .then(function (posts) {
      posts.sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
      els.forEach(function (el) {
        var st = el.dataset.stage,
          lim = +el.dataset.limit || 99;
        var list = posts
          .filter(function (p) {
            return !st || p.stage === st;
          })
          .slice(0, lim);
        if (!list.length) {
          el.innerHTML =
            '<p class="empty">No post yet. Nothing is published here until the sources below have been read and checked.</p>';
          return;
        }
        el.innerHTML = list
          .map(function (p) {
            return cardHtml(p, base);
          })
          .join('');
      });
      if (window.FEHProgress) FEHProgress.renderAll();
    })
    .catch(function () {});
})();

/* Per-post reflection local save */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-reflection]').forEach(function (box) {
    var id = box.getAttribute('data-reflection');
    var ta = box.querySelector('textarea');
    var status = box.querySelector('[data-reflect-status]');
    var saveBtn = box.querySelector('[data-reflect-save]');
    if (!ta || !window.FEHProgress) return;
    var prior = FEHProgress.getReflection(id);
    if (prior && prior.text) ta.value = prior.text;
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        FEHProgress.saveReflection(id, ta.value);
        if (status) {
          status.textContent = 'Saved on this device · ' + new Date().toLocaleString();
        }
      });
    }
  });
});
