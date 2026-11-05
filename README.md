# Flat Earth Evidence Hub

Static HTML/CSS/JS community info site: devil’s-advocate flat-Earth proofs, curated videos, labelled evidence, and interactive tools. Not a claim that flat Earth is proven science.

## Pages

- `index.html` — evidence cockpit (stats, dual paths, search, ranked list)
- `proofs.html` — Proof Library themes
- `videos.html` — Videos 2.0 (start-here playlist, tags, durations)
- `tools.html` — horizon/distance calculator, search, ranked strongest arguments
- `practice.html` — FE-trap claim tester (`localStorage`)
- `glossary.html` — neutral FE term definitions
- `about.html` — methodology + “how we’re trying to be the best”
- `posts/*.html` — proof deep dives (compare cards on each)
- `posts.json` — card feed for `[data-posts]` loaders
- `competition-notes.md` — rival survey + differentiation

## Local preview

```bash
cd /workspace/matrix-guide && python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/

## Progress key

`localStorage['feh-progress']` — reading marks, reflections, checklist. Device-only.

## Editorial

See `about.html`, `editorial-notes.md`, `experiments.md`, `published-log.md`, `competition-notes.md`.

## Backups

- Rival upgrade: `/workspace/matrix-guide-backups/2026-11-05-1826-rival/`
- FE pivot: `/workspace/matrix-guide-backups/2026-11-05-1819-fe-pivot/`
