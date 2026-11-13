// Holowise public pages: fills prices, checkout buttons, launch sign-up and affiliate wording from config.js (one source of truth).
import { PAY, LAUNCH, AFFILIATE } from './config.js?v=7';
const $ = s => document.querySelector(s);
const url = k => { const u = String(PAY.checkout?.[k] || '').trim(); return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : ''; };
const live = Object.keys(PAY.checkout || {}).some(url);
const pr = PAY.prices, money = n => 'A$' + (Number.isInteger(n) ? n : n.toFixed(2));
const set = (s, h) => { const e = $(s); if (e) e.innerHTML = h; };
set('#pPro', `${money(pr.proMonthly)} <small>/ month</small>`); set('#pProY', `or ${money(pr.proYearly)} a year`);
set('#pDealer', `${money(pr.dealerMonthly)} <small>/ month</small>`); set('#pDealerY', `or ${money(pr.dealerYearly)} a year`);
const btn = (k, label) => url(k) ? `<a class="btn small primary" href="${url(k)}" target="_blank" rel="noopener">${label}</a>` : `<button class="btn small off" disabled>${label}</button>`;
set('#bPro', btn('proMonthly', 'Monthly') + ' ' + btn('proYearly', 'Yearly'));
set('#bDealer', btn('dealerMonthly', 'Monthly') + ' ' + btn('dealerYearly', 'Yearly'));
if (live) set('#payNote', `Prices in AUD including GST, billed by Lemon Squeezy (seller of record). Your licence key arrives by email: open the app, tap your plan and paste it. Cancel any time. Try every Pro feature free for ${PAY.trialDays} days in the app first, no card needed. <a href="terms.html">Terms</a>.`);
// Launch sign-up: a form link (preferred) or an email; otherwise say plainly that sign-ups aren't open.
const iu = String(LAUNCH.interestUrl || '').trim(), em = String(LAUNCH.contactEmail || '').trim();
const href = /^https:\/\//.test(iu) ? iu : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) ? `mailto:${em}?subject=${encodeURIComponent('Holowise launch updates')}&body=${encodeURIComponent('Please add me to the Holowise launch list.')}` : '';
for (const s of ['#interest', '#interest2']) { const a = $(s); if (!a) continue;
  if (href) { a.href = href; if (href.startsWith('https')) { a.target = '_blank'; a.rel = 'noopener'; } }
  else if (s === '#interest2') { a.removeAttribute('href'); a.classList.add('off'); a.setAttribute('aria-disabled', 'true'); a.textContent = 'Sign-ups open soon'; } }
if (href) set('#updatesText', 'Leave your details to hear when paid plans and new features launch.');
document.querySelectorAll('[data-contact]').forEach(e => { e.innerHTML = em ? `<a href="mailto:${em}">${em}</a>` : '<span class="tplv">[contact email to be added before launch]</span>'; });
document.querySelectorAll('[data-business]').forEach(e => { e.textContent = (LAUNCH.businessName || 'Holowise') + (LAUNCH.abn ? ` (ABN ${LAUNCH.abn})` : ''); });
document.querySelectorAll('[data-aff-state]').forEach(e => { e.textContent = /^\d{6,12}$/.test(String(AFFILIATE.epnCampaignId || '')) ? 'Affiliate tracking is currently switched on for eBay links.' : 'Affiliate tracking is currently switched off: eBay links are plain links.'; });
