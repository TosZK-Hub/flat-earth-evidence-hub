# Holowise launch checklist (phone-first, Australia)

Written 14 Nov 2026 (AEST). The app is built and the paywall is wired up but switched off. Checkout, the price server and affiliate links switch on through `config.js` plus one Worker deploy. Nothing in this checklist has been bought or signed up for yet.

> **Status 14 Nov 2026:** the price server is deployed at `https://holowise-proxy.holowise.workers.dev` (Cloudflare account jessemhobbs@gmail.com) and `PROXY.url` is set. **Still to do:** add the `JUSTTCG_API_KEY` secret yourself (Cloudflare dashboard → Workers & Pages → holowise-proxy → Settings → Variables and Secrets → Add → type *Secret*). The app picks it up automatically through `/health`, with no redeploy needed. The key is on JustTCG's free, non-commercial tier, which is fine while payments are off. Upgrade to Starter before charging.

## Part A: accounts to create, in this order

| # | What | Cost | Why it's in this order | What to send back |
|---|---|---|---|---|
| 1 | **IP Australia trade mark check** for "Holowise" (search classes 9, 35 and 42 at <https://search.ipaustralia.gov.au/trademarks/search/quick>) | Free to search. Filing costs extra (see IP Australia's fees page) | Before money goes into branding. If someone holds a conflicting mark, rename now while it's cheap | "Clear" or the conflicting mark numbers |
| 2 | **ABN** (<https://www.abr.gov.au>) and a short **accountant chat about GST**: registration is compulsory from A$75k turnover, and Lemon Squeezy acts as merchant of record | ABN free; advice varies | Lemon Squeezy payouts and the terms need a business identity | ABN, plus the business name for the terms |
| 3 | **Lemon Squeezy store** (<https://app.lemonsqueezy.com>): set the store currency to **AUD** (Settings → General), use tax-inclusive pricing, and complete identity and payout verification | 5% + 50c per sale (their pricing page) | Payments, GST handling, receipts and licence keys | See Part B |
| 3a | Product **Holowise Pro**: subscription variants **Monthly A$6.99** and **Yearly A$49**. Turn on "Generate license keys" with an **activation limit of 3** (devices) | | Licence keys stay active while the subscription is active and expire with it (Lemon Squeezy docs) | |
| 3b | Product **Holowise Dealer**: **Monthly A$19.99** and **Yearly A$179**, licence keys on, activation limit 3 | | | |
| 3c | In each product's confirmation settings, set the button link to `https://toszk-hub.github.io/flat-earth-evidence-hub/card-scanner/#licence` | | Opens the app with the licence box ready | |
| 4 | **Cloudflare** free account (<https://dash.cloudflare.com/sign-up>) | Free (100k requests a day) | Hosts the price server that keeps keys off phones | Nothing to send. Run `proxy/README.md` yourself, or give me a scoped API token (Workers edit) |
| 5 | **JustTCG Starter** (<https://justtcg.com>) | US$19 a month (as listed when researched; check the current price) | The free tier is personal, non-commercial use only. A paid plan is needed before charging customers | Put the key in Cloudflare with `wrangler secret put JUSTTCG_API_KEY`. **Never paste it in chat, config.js or GitHub** |
| 6 | **eBay Partner Network** (<https://partnernetwork.ebay.com>): apply as a publisher with the app URL, then create a campaign called "Holowise app" | Free | Commission on eBay AU purchases made after a click from the app | The **campaign ID** (10 digits) |
| 7 | **Launch sign-up form**: a free Tally or Google Form with email, "Pokémon / One Piece / both" and "collector / dealer" | Free | Collects launch interest without a backend | The form's share link (https://…) |
| 8 | **Contact email** for the privacy policy and terms (e.g. a new Gmail or a domain address) | Free | The legal pages and app store-style support need one | The address |
| 9 | **TCG Prices AU**: email them for **commercial terms in writing** before using Basic (A$9.99/mo) for AU eBay solds | A$9.99/mo and up | Their API terms limit use. Get a "yes" for a paid consumer app first | Their written OK. Then put the key in Cloudflare with `wrangler secret put TCGPRICES_API_KEY` |
| 10 | **OPTCG API permission**: email the maintainer asking to use the API in a paid app, with attribution | Free | One Piece prices come from it, and it's a hobby project | Their reply |
| 11 | **Legal review** of `privacy.html` and `terms.html`. Both are marked as templates | Varies | Required before taking payments | Any wording changes |

Optional later: Ximilar card recognition (from about €59 a month) only if OCR accuracy proves to be the bottleneck, and Google Play (US$25) when glasses or a native wrapper is worth it.

## Part B: the ~10-minute switch-on (what to send me)

Send these in chat. All of them are public values, not secrets:

1. Four Lemon Squeezy **checkout links**, one per variant (Products → variant → Share): Pro monthly, Pro yearly, Dealer monthly, Dealer yearly.
2. **Store ID**, the two **product IDs** and the four **variant IDs** (numbers). Say which variants are Dealer.
3. The **Worker URL** after `npx wrangler@latest deploy` (`https://holowise-proxy.<you>.workers.dev`), or a scoped Cloudflare API token if you want me to deploy it.
4. **EPN campaign ID**.
5. **Sign-up form link**, **contact email**, **ABN** and **business name**.

Then I:
1. Fill in `config.js`: `PAY.checkout`, `PAY.store`, `PAY.variants`, `PROXY.url`, `AFFILIATE.epnCampaignId`, and the `LAUNCH` fields. That's the only app file that changes.
2. Put `LS_STORE_ID`, `LS_PRODUCT_IDS` and `LS_DEALER_VARIANTS` into `proxy/wrangler.toml` and redeploy the Worker (or you run `npx wrangler@latest deploy`).
3. Run `test/e2e7.py` and `test/e2e6.py`, deploy the `card-scanner/` folder, check that the live files are byte-identical, and check `/health` on the Worker.
4. Make one real test purchase of Pro Monthly in Lemon Squeezy **test mode**, then activate the key in the app on a phone.

Until each value is filled in, its feature stays off: buy buttons stay disabled, eBay links stay plain and price history uses the free sources.

## Part C: first 30 days of go-to-market (Australia)

There are no targets here because there's no baseline yet. Track the numbers in the last table and set targets after week 2.

**Week 1: get ready**
- Record 3 short screen-capture demos on a phone: (1) scanning a binder page in batch mode with a running AUD total and buy offer, (2) "Should I grade it?" on a real card with Australian grading costs, (3) where-to-sell net proceeds comparing eBay AU and a card show. Use real cards and real app output only.
- Post them on TikTok, Instagram Reels and YouTube Shorts from a new Holowise account. Captions say "estimates, not financial advice".
- Add the sign-up form and contact email (Part A, items 7 and 8) so interest isn't lost.

**Weeks 1–2: communities (read each group's rules first; ask mods or admins before posting a tool)**
- Reddit: r/PokemonFansAustralia (the research quote about 5-minute vendor price checks came from there), plus Australian threads in r/PokemonTCG and r/OnePieceTCG. Lead with a question or a free tool ("I built a free AUD price and grading calculator, looking for feedback"), not an ad.
- Facebook: search for Australian Pokémon TCG and One Piece TCG buy/sell/trade groups and state-based groups. Many ban promotion, so message admins and offer free Dealer access to group admins who give feedback.
- Discords of local game stores (LGS): offer the store owner free Dealer access in exchange for feedback on the buy-offer sheet.

**Weeks 2–3: Trading Card SUMMIT Melbourne, 28–29 Nov 2026**
- Before the show, confirm the dates and exhibitor rules on the organiser's site.
- Walk the floor as an attendee. With the vendor's permission, time a phone-in-a-chest-mount hands-free scan against their usual lookup, and record real timings (no invented results).
- Hand out a small card with a QR code to the app and the sign-up form. Offer interested dealers a free month of Dealer once checkout is live.
- Ask every dealer the same 3 questions: How do you price walk-up buys today? What does it cost you in time? Would you pay A$19.99/month to cut that?

**Weeks 3–4: convert and learn**
- Turn on checkout (Part B) once Lemon Squeezy test mode passes. Email the sign-up list once.
- Write up what dealers said and adjust the pricing or the Dealer feature list before spending on ads.

**Measure (no targets until there's a baseline)**

| Signal | Where it comes from |
|---|---|
| Sign-ups | Form responses |
| Trials started vs paid conversions | Lemon Squeezy dashboard (sales); trials are local to each phone, so count them by asking users |
| Activations and cancellations | Lemon Squeezy → Licenses / Subscriptions |
| eBay clicks and earnings | EPN dashboard (custom ID `holowise`) |
| Price server load | Cloudflare Workers analytics, JustTCG usage page |

The app has no analytics by design, and the privacy policy says so. If you want usage analytics later, add a privacy-friendly tool and update `privacy.html` first.

## Known blockers and risks
- **Data licences.** Paid plans shouldn't launch on the JustTCG free tier (non-commercial). TCG Prices AU and the OPTCG API need written OKs. Until then the app uses free sources with "converted" labels.
- **OPTCG two-week history** returned HTTP 500 on 14 Nov 2026, so One Piece's two-week chart shows a "no history" note until it recovers. JustTCG (through the Worker) covers One Piece history.
- **Currency.** Lemon Squeezy shows AUD but charges in USD at the mid-market rate. The FAQ and terms disclose this.
- **Brand.** The trade mark check (A1) hasn't been done. Renaming later means changing the domain, icons and listings.
- **Legal templates.** `privacy.html` and `terms.html` need review before checkout goes live.
- **Hosting URL.** The app lives under the `flat-earth-evidence-hub` GitHub Pages site. A custom domain (e.g. `holowise.com.au`, which needs an ABN for .com.au) would look more trustworthy. Add it to `ALLOWED_ORIGIN` in the Worker when you do.

Estimates only, not financial advice.
