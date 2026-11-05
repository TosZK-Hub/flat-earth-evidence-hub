# Experiments & interactive features

## Live

- Dark/light theme (`localStorage.theme`)
- Proof progress (`localStorage.feh-progress`) — mark read, reflections, checklist
- `posts.json` progressive enhancement for `[data-posts]`
- Practice “Test the claim” checklist with FE-specific traps
- Horizon / distance estimator (`js/tools.js`) — globe geometric drop vs FE “no drop”
- Client-side proof search over `posts.json`
- Ranked strongest-arguments list with type filters
- Sticky header + section jump links on long proofs
- Side-by-side compare cards (FE | Globe | Falsifiers)

## Queued editorial experiments

- Dedicated “globe proofs challenged” deep dive (Eratosthenes / airline windows)
- Logged height/distance printable worksheet for zoom-back tests
- Optional full Behind the Curve discussion guide (trailer + experiment clip only for now)
- Refraction slider on horizon calculator (point users to Bislin/Metabunk meanwhile)
- More verified FE laser field videos once IDs pass fetch checks

## Non-goals

- No user accounts, analytics beacons, or comment backends in this static build
- No health/financial/legal advice modules
- No fabricated video IDs or plagiarized competitor copy

## 2026-11-05 — Layout v3 “evidence desk”
- Hypothesis: a premium, consistent shell (IA + interaction) raises proof-page depth and return visits more than adding content.
- Changes: CSS rewrite; ui.js (nav, TOC, compare tabs, library chips, live calc, toasts); home Start-here strip; calc featured first on tools.
- Measure: (local only) proofs marked read per visit; qualitative mobile review. Backup: /workspace/matrix-guide-backups/2026-11-05-1836-layout/
