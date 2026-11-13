# Holowise price server (Cloudflare Worker)

One small Worker that keeps paid API keys off phones and out of this public repo. Not deployed yet. The app works without it: when `PROXY.url` in `../config.js` is blank, the app uses the free price sources only, and anyone with their own JustTCG key can still paste it in Settings.

| Route | What it does | Needs |
|---|---|---|
| `GET /health` | Shows which features are on: `{ok, jt, au, license}`. Never returns secrets. | nothing |
| `GET` / `POST /jt/cards` | JustTCG price history and 7-day changes, using **Holowise's** JustTCG key. Parameters and batch bodies are whitelisted, responses are cached at the edge for 12 h, and JustTCG's usage `_metadata` is stripped. | secret `JUSTTCG_API_KEY` |
| `GET /au-price`, `GET /au-history` | eBay Australia sold prices and history from TCG Prices AU (Pokémon only), cached 6 h (their terms allow 24 h at most). | secret `TCGPRICES_API_KEY` |
| `POST /license`, `POST /license/activate` | Lemon Squeezy licence validate and activate. Enforces your store and product IDs, maps variants to Pro or Dealer, and never echoes the key. | vars `LS_*` (optional) |

If a secret is missing, that route answers `{"disabled": true}` and the app quietly skips the feature, so you can deploy before every subscription is in place.

**Security built in**
- CORS is locked to `ALLOWED_ORIGIN` (default `https://toszk-hub.github.io`). Requests from other origins, or with no `Origin`, get 403 on every data and licence route.
- Per-IP rate limits per Cloudflare location use Cloudflare's Rate Limiting binding: `RL_DATA` allows 40 units a minute (a batch costs 3) and `RL_LICENSE` allows 10 a minute. Both are free and set in `wrangler.toml`.
- Keys live only in Cloudflare secrets. Nothing here logs request bodies, licence keys or API keys.

## Deploy (about 10 minutes, free Cloudflare plan)
You need Node.js 18 or later on any computer. Run everything from this `proxy/` folder.

```bash
# 1. Log in (opens a browser; create a free Cloudflare account first if needed)
npx wrangler@latest login

# 2. Add secrets. Each command prompts for the value; paste it and press Enter. Nothing is saved in files.
npx wrangler@latest secret put JUSTTCG_API_KEY        # JustTCG Starter (commercial) key
npx wrangler@latest secret put TCGPRICES_API_KEY      # optional: only once TCG Prices AU confirms commercial terms in writing
#    (the first `secret put` creates the Worker if it doesn't exist yet; answer "y")

# 3. Put your Lemon Squeezy IDs into wrangler.toml [vars] (numbers; comma-separate several):
#      LS_STORE_ID = "12345"
#      LS_PRODUCT_IDS = "111,222"          # Pro product, Dealer product
#      LS_DEALER_VARIANTS = "555,666"      # Dealer monthly, Dealer yearly variant IDs

# 4. Deploy
npx wrangler@latest deploy
#    → prints https://holowise-proxy.<your-subdomain>.workers.dev

# 5. Check it (should print {"ok":true,"jt":true,...})
curl https://holowise-proxy.<your-subdomain>.workers.dev/health
```

6. Switch the app on: in `../config.js`, set `PROXY.url = 'https://holowise-proxy.<your-subdomain>.workers.dev'`, then redeploy the `card-scanner/` folder. Price history then works for every user with no key. Licence checks go through the Worker automatically, because `PAY.licenseApi` falls back to `PROXY.url + '/license'`.

**Custom domain later?** Add its origin to `ALLOWED_ORIGIN`, comma-separated (for example `https://toszk-hub.github.io,https://holowise.com.au`), and run `npx wrangler@latest deploy` again.

## Costs and limits to watch
- Cloudflare Workers Free covers 100,000 requests a day. Edge caching means repeat lookups of the same card don't reach JustTCG.
- JustTCG: the free tier is personal, non-commercial use only, so use a paid plan (Starter or higher) for the server key. Set a usage alert in your JustTCG dashboard. The rate limits above are per IP and per location, so they slow abuse but don't cap your monthly bill.
- TCG Prices AU: credit "Prices from TCG Prices AU" next to the data (the app does this), cache for no more than 24 h (the Worker uses 6 h), and don't store the data long-term (the app never saves AU prices). Get commercial terms in writing first.

## Test locally
```bash
node ../test/worker7.test.mjs                               # mocked upstreams; no keys needed
npx wrangler@latest deploy --dry-run --outdir /tmp/out      # validates wrangler.toml and the bundle
```
To try it live without deploying, put `JUSTTCG_API_KEY=…` in a `.dev.vars` file (git-ignored; never commit it), run `npx wrangler@latest dev`, then delete the file.
