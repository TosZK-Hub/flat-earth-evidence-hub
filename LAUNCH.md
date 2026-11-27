# Kleinspan: launch checklist

> **28 Nov 2026: printables paused.** The site is now lessons-first (Leer Afrikaans met Hettie). Sections 1–4 below about printable packs are kept for when they return; see README.

Status on 2026-11-22: the site is live with a free sample. Paid packs show "Coming soon" until checkout links are added to `js/config.js`. Paid PDFs live **only** on the build box in `/workspace/printables-products/`, never in this public repo.

## 1. Check the Afrikaans (Jesse, first)
- Open `/workspace/printables-products/vocab.csv` (111 rows: afrikaans, english, used_in_pack, notes, jesse_ok_or_fix, hat_status, hat_note). The HAT check is in the last two columns.
- Put `ok` or the fix in `jesse_ok_or_fix`. Already applied on your call: **H = hadida** (HAT spelling), **C = a letter-only card** ("C is skaars in Afrikaans", with a short note on the back; replaces cello/citrus), and the alphabet cover now says "stel met net prente".
- Still worth a look: the wording of the C card note, Q (quiche), X (xilofoon), Z (zoem), Tafelberg, velskoen, waterkan and ruit.
- Send the file back and the PDFs and previews will be regenerated in a few minutes.
- Also confirm the copy marked `PLACEHOLDER` in the HTML (home page note, About page, course blurb).

## 2. Prices (placeholders, please confirm)
| Pack | Pages | Placeholder price |
|---|---|---|
| Alfabetkaarte (alphabet A–Z) | 18 | A$7 |
| Getalle 1 tot 20 (numbers) | 11 | A$6 |
| Kleure en Vorms (colours and shapes) | 12 | A$5 |
| Klein Begin Bundel (all three) | 37 | A$15 (A$3 less than buying separately) |
| Gratis proefpakkie (free sample, on the site) | 6 | free |

Change them in `js/config.js` (`prices`) and in Stripe.

## 3. Stripe Managed Payments (Jesse sets up himself)
Stripe Managed Payments is Stripe's merchant-of-record service: Link (by Stripe) is the seller of record and handles GST/VAT, receipts, fraud and disputes. Fee: 3.5% per successful transaction on top of standard Stripe processing fees ([stripe.com/managed-payments](https://stripe.com/managed-payments)). Your account goes through an eligibility review ([eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)). Printable PDFs fit "digital media… digital images or artwork / e-books"; pick the eligible tax code Stripe offers that matches.
1. Create or sign in to your Stripe account and activate Managed Payments in the Dashboard.
2. In Tax settings, turn on **Include tax in prices**, so A$7 is the total the customer pays. Otherwise tax is added on top by default ([docs](https://docs.stripe.com/payments/managed-payments/use-payment-links)).
3. Create 4 products (alphabet, numbers, colours & shapes, bundle) in AUD with an eligible digital tax code.
4. Create a Payment Link for each with **Enable Managed Payments** ticked (on the web Dashboard, not the iOS app). Under "After payment", choose **redirect to your website** (URL from step 5).
5. Send the 4 `https://buy.stripe.com/...` links. They go into `js/config.js` and the buttons switch on automatically.
6. In Checkout settings, add the links to `privacy.html` and `terms.html` (after legal review).

Never paste Stripe secret keys into chat or GitHub. Any key goes straight into Cloudflare as a Worker secret (`wrangler secret put`) or into the dashboard, entered by you.

## 4. How paid files get delivered (recommendation)
Managed Payments takes the money but **doesn't deliver files**, and it doesn't allow custom checkout text. Options:

| Option | How | Verdict |
|---|---|---|
| A. Unlisted download page on this site | Redirect after payment to a hidden page | **Not suitable**: this repo is public, so the "hidden" PDFs would be downloadable by anyone. |
| B. Shared Drive/Dropbox links | Redirect to a page listing "anyone with the link" file links | Works on day one with no code. But it relies on secrecy, and links can be passed around. OK only as a short stopgap. |
| **C. Small Cloudflare Worker + private R2 bucket (recommended)** | Payment Link redirects to `https://<worker>/download?session_id={CHECKOUT_SESSION_ID}`. The Worker asks Stripe whether that session is paid and which product it was for, then streams the right PDF from a private bucket. Links expire after a few days. | Simplest option that's actually secure. Free tier is enough at this scale. Needs one **restricted** Stripe key (read-only Checkout Sessions) that you add as a Worker secret yourself. I can build and deploy the Worker once you say go. |

Stripe's guide recommends also listening for the `checkout.session.completed` webhook in case a buyer closes the tab before the redirect ([fulfilment docs](https://docs.stripe.com/checkout/fulfillment)). Phase 2: the Worker can also email the link.

## 5. Etsy (optional second channel, can go live first)
Etsy delivers digital files automatically, so packs could sell there before the Stripe setup is done. Fees: US$0.20 listing fee, 6.5% transaction fee ([Etsy fees policy](https://www.etsy.com/legal/fees/)), plus payment processing of 3% + A$0.25 domestic or 4% + A$0.25 international ([Etsy Payments policy](https://www.etsy.com/legal/etsy-payments/)). Upload the PDFs from `/workspace/printables-products/` and use the preview images from `img/` (or fresh PNG mock-ups).

## 6. Also needed before taking money
- Business name and ABN (for `terms.html`), and a contact email (`contactEmail` in `config.js`).
- Legal review of `privacy.html` and `terms.html` (both marked "Template: needs legal review").
- Optional: a sign-up form link (`signupUrl`), e.g. a hosted newsletter form. The button stays hidden until it's set.
- Optional: a custom domain (`kleinspan.com` and `kleinspan.com.au` returned no DNS records on 2026-11-22, so they may be free; check with a registrar). After adding it, update the canonical URLs, `sitemap.xml` and `robots.txt`.
- Optional: a trademark search for "Kleinspan" at IP Australia before you invest in branding.
