/* "Test the claim" checklist — FE-specific traps + local-only results. */
(function () {
  var QUESTIONS = [
    {
      id: 'actor',
      text: 'Does the claim name a specific person, organisation, experiment or document you can check — or does it rely on a vague “they”?',
      options: [
        { v: 2, label: 'Named actor + checkable source' },
        { v: 1, label: 'Partly named; source is thin' },
        { v: 0, label: 'Anonymous “they” / no source' }
      ],
      tip: 'Site rule: no anonymous “they”. Motive alone is not evidence.',
      trap: null
    },
    {
      id: 'anecdote',
      text: 'Is this an anecdote (“I once saw…”, “a pilot said…”) or a logged experiment with stated heights, distances and conditions?',
      options: [
        { v: 2, label: 'Logged experiment / primary measurement' },
        { v: 1, label: 'Mix — story plus some numbers' },
        { v: 0, label: 'Pure anecdote or viral claim' }
      ],
      tip: 'Anecdotes can start inquiry; they do not finish it.',
      trap: 'FE trap: anecdote vs experiment — treat cockpit stories and unlogged “I saw Chicago from Michigan” posts as leads until heights/refraction are stated.'
    },
    {
      id: 'observation',
      text: 'Is there a primary observation (measurement, photo with metadata, official record, raw data) you can open yourself?',
      options: [
        { v: 2, label: 'Yes — primary page, DOI, archive or raw data' },
        { v: 1, label: 'Secondary summary / edited clip only' },
        { v: 0, label: 'No evidence offered' }
      ],
      tip: 'Empirical claims need sources. A viral clip alone is not a citation.',
      trap: null
    },
    {
      id: 'laser',
      text: 'If lasers / theodolites / long-zoom over water are involved: were height, aim, weather and replication logged — or is it a one-off unreplicated shoot?',
      options: [
        { v: 2, label: 'Logged + independently repeated (or clearly Wallace-style markers)' },
        { v: 1, label: 'One team’s video with partial notes' },
        { v: 0, label: 'Unreplicated laser day / no heights' }
      ],
      tip: 'Ad-hoc laser days need weather, height and aiming logs. Heat haze and miss-aim are common.',
      trap: 'FE trap: unreplicated laser tests — a single night’s green-dot video is hypothesis until another team repeats with the same logs.'
    },
    {
      id: 'photo',
      text: 'If a photo or space image is central: is authenticity / processing documented (pipeline, composite layers, lens), or is “looks fake” doing the work?',
      options: [
        { v: 2, label: 'Pipeline / metadata / primary agency docs checked' },
        { v: 1, label: 'Some processing noted; gaps remain' },
        { v: 0, label: '“Looks CGI” / vibe-based authenticity' }
      ],
      tip: 'Documented compositing (e.g. Blue Marble) is established technique; leaping to “no Earth” is speculation.',
      trap: 'FE trap: photo authenticity — composites and fish-eye distortion are real; “therefore space is fake” needs more than aesthetics.'
    },
    {
      id: 'map',
      text: 'If a map is offered as a planet model: is it labelled as a projection of a sphere (e.g. azimuthal equidistant) or treated as a physical survey of a disc?',
      options: [
        { v: 2, label: 'Projection vs physical model clearly separated' },
        { v: 1, label: 'Mostly clear; some slide between map and model' },
        { v: 0, label: 'Map projection confused with physical planet' }
      ],
      tip: 'AE / Gleason / UN emblem are real projections. Using them as disc Earth requires extra claims (hypothesis).',
      trap: 'FE trap: map projection confusion — a north-polar AE chart can be printed from a globe; that fact alone does not prove a flat planet.'
    },
    {
      id: 'alternatives',
      text: 'Does the presenter fairly state the best alternative explanation (e.g. refraction, perspective, image processing, logistics)?',
      options: [
        { v: 2, label: 'Yes — steelmans the other side' },
        { v: 1, label: 'Mentions alternatives briefly' },
        { v: 0, label: 'Ignores or ridicules alternatives' }
      ],
      tip: 'Devil’s-advocate work means carrying the strongest opposing account in the same page.',
      trap: null
    },
    {
      id: 'label',
      text: 'How should the claim be labelled under this site’s evidence bar?',
      options: [
        { v: 2, label: 'Established — multi-method consensus / primary docs' },
        { v: 1, label: 'Well-argued hypothesis — contested reading' },
        { v: 0, label: 'Speculation / metaphor (or unknown)' }
      ],
      tip: 'Passing speculation as proven science is how evidence hubs go wrong — on either side.',
      trap: null
    },
    {
      id: 'prediction',
      text: 'Does the model make a risky prediction you could check next (flight time, star motion, eclipse geometry, survey bump)?',
      options: [
        { v: 2, label: 'Yes — clear, falsifiable prediction' },
        { v: 1, label: 'Vague prediction / post-hoc fit' },
        { v: 0, label: 'No prediction; only storytelling' }
      ],
      tip: 'Models that only explain after the fact stay hypotheses.',
      trap: null
    },
    {
      id: 'tone',
      text: 'If you followed this claim for a month, would it push curiosity and careful checking — or contempt and harassment?',
      options: [
        { v: 2, label: 'Toward careful checking and curiosity' },
        { v: 1, label: 'Mixed — sharper, also harsher' },
        { v: 0, label: 'Toward contempt or targeting people' }
      ],
      tip: 'This site is not a call to harass scientists, crews or tourists. Contempt is a warning light.',
      trap: null
    }
  ];

  function scoreBand(total, max) {
    var ratio = total / max;
    if (ratio >= 0.75)
      return {
        key: 'strong',
        title: 'Holds up under testing — provisionally',
        body: 'On these questions the claim looks relatively careful. Still verify the primary sources yourself; this checklist is a local aid, not a verdict on Earth’s shape.'
      };
    if (ratio >= 0.45)
      return {
        key: 'mixed',
        title: 'Mixed — treat as a lead, not a finding',
        body: 'Some marks of care, some red flags. Hold it as a hypothesis. Ask what evidence would change your mind.'
      };
    return {
      key: 'weak',
      title: 'Weak under this site’s bar',
      body: 'Vague actors, thin evidence, ignored alternatives, projection confusion or contempt-driven framing fail this hub’s standard. Do not promote it until those gaps close.'
    };
  }

  function render(root) {
    if (!root) return;
    var prior = window.FEHProgress && FEHProgress.getChecklist();
    var form =
      '<form class="discern-form" novalidate>' +
      '<p class="lede short">Paste no secrets. Answer about <em>one claim</em> — flat-Earth or globe-model. Answers stay in this browser only.</p>' +
      '<div class="trap-note"><strong>FE-specific traps baked in</strong><p style="margin:.35rem 0 0">This round adds checks for anecdote vs experiment, unreplicated lasers, photo authenticity leaps, and map-projection confusion — common failure modes on both activist videos and lazy debunks.</p></div>' +
      '<label class="field"><span>Claim in one sentence (optional, local only)</span>' +
      '<input type="text" name="claim" maxlength="280" placeholder="e.g. “Rowbotham’s 1838 canal sight proves zero curvature”"></label>' +
      QUESTIONS.map(function (q, i) {
        return (
          '<fieldset class="q" data-qid="' +
          q.id +
          '"><legend><span class="qnum">' +
          (i + 1) +
          '</span> ' +
          q.text +
          '</legend>' +
          q.options
            .map(function (o) {
              return (
                '<label class="opt"><input type="radio" name="' +
                q.id +
                '" value="' +
                o.v +
                '" required> <span>' +
                o.label +
                '</span></label>'
              );
            })
            .join('') +
          '<p class="tip">' +
          q.tip +
          '</p>' +
          (q.trap ? '<div class="trap-note"><strong>Watch for</strong><p style="margin:.3rem 0 0">' + q.trap + '</p></div>' : '') +
          '</fieldset>'
        );
      }).join('') +
      '<p class="actions"><button type="submit" class="btn">See local result</button> ' +
      '<button type="reset" class="btn ghost">Reset answers</button></p>' +
      '</form>' +
      '<div class="discern-result" hidden tabindex="-1"></div>';
    root.innerHTML = form;

    var formEl = root.querySelector('form');
    var out = root.querySelector('.discern-result');

    if (prior && prior.answers) {
      Object.keys(prior.answers).forEach(function (k) {
        var input = formEl.querySelector('input[name="' + k + '"][value="' + prior.answers[k] + '"]');
        if (input) input.checked = true;
      });
      if (prior.claim) formEl.claim.value = prior.claim;
    }

    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      var answers = {};
      var total = 0;
      var max = QUESTIONS.length * 2;
      var missing = false;
      QUESTIONS.forEach(function (q) {
        var picked = formEl.querySelector('input[name="' + q.id + '"]:checked');
        if (!picked) missing = true;
        else {
          answers[q.id] = +picked.value;
          total += +picked.value;
        }
      });
      if (missing) {
        out.hidden = false;
        out.innerHTML = '<p class="label l-hyp"><strong>Incomplete</strong><span> Answer every question — careful evaluation is patient work.</span></p>';
        out.focus();
        return;
      }
      var band = scoreBand(total, max);
      var claim = (formEl.claim.value || '').trim();
      var result = {
        at: new Date().toISOString(),
        total: total,
        max: max,
        band: band.key,
        claim: claim,
        answers: answers
      };
      if (window.FEHProgress) FEHProgress.saveChecklist(result);

      out.hidden = false;
      out.innerHTML =
        '<div class="result-card band-' +
        band.key +
        '">' +
        '<p class="kicker">Local result · not uploaded</p>' +
        '<h3>' +
        band.title +
        '</h3>' +
        '<p class="score meta">Score ' +
        total +
        ' / ' +
        max +
        (claim ? ' · “' + claim.replace(/[<>&]/g, '') + '”' : '') +
        '</p>' +
        '<p>' +
        band.body +
        '</p>' +
        '<p class="meta">Labels reminder: <span class="badge">established evidence</span> <span class="badge">well-argued hypothesis</span> <span class="badge">speculation/metaphor</span> — see <a href="' +
        (document.body.dataset.base || '') +
        'about.html">Method</a>.</p>' +
        '<p><button type="button" class="btn ghost small" data-print-result>Copy summary</button></p>' +
        '</div>';
      out.focus();
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    root.addEventListener('click', function (e) {
      if (!e.target.matches('[data-print-result]')) return;
      var card = root.querySelector('.result-card');
      if (!card) return;
      var text = card.innerText;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          e.target.textContent = 'Copied';
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-discernment]').forEach(render);
  });
  window.FEHDiscernment = { render: render, QUESTIONS: QUESTIONS };
})();
