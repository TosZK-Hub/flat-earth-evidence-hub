# Hettie: AI teacher (prototype, branch `hettie-teacher`)

Client-only files for the Hettie chat panel: `learn/hettie.js`, `learn/hettie.css` and two include lines in `learn/index.html`.

It is safe to merge on its own. The panel stays hidden unless the API's `/health` reports `hettie: true`, which the live API does not do yet.
The server side (the Worker route, prompt and limits) is kept private and is deployed separately. No keys or secrets are in this repo.
