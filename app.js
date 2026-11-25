'use strict';
/* Dieta Mamy — jadłospis, przepisy, zakupy, waga. Dane tylko na telefonie (localStorage). */
const F = window.FOODS || {};
const R = (window.RECIPES || []).filter(r => r && r.id && Array.isArray(r.ing));
const RB = Object.fromEntries(R.map(r => [r.id, r]));
const KEY = 'dietaMamy.v1';

/* ---------- stan ---------- */
const nowy = () => ({ v: 1, profil: null, dieta: 'standard', posilki: 4, wyklucz: [], plan: {}, zjedz: {}, extra: {}, skany: {},
  zakupy: { zakres: 1, ok: {} }, waga: [], celWagi: null, ulub: [], duze: false, motyw: 'auto', paleta: 'a', pokazano: {}, wizyty: 0,
  kopia: {}, woda: {}, przyp: null, start: null });
function wczytaj() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { const n = Object.assign(nowy(), s); n.pokazano = n.pokazano || {}; return n; } } catch (e) {}
  return nowy();
}
let S = wczytaj();
function zapisz() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
/* U = stan ekranu (nie zapisywany). stos = otwarte arkusze, pomin = ile zdarzeń „wstecz” wywołała sama aplikacja */
const U = { tab: 'plan', dzien: null, q: '', fm: '', ff: '', krok: 0, szkic: {}, bledy: {}, stos: [], kasuj: false, wq: '', wz: '3m', gk: 0,
  anim: {}, pomin: 0, wjazd: null, koszyk: true, pp: 0, intro: false };

/* ---------- daty ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const zIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const plus = (s, n) => { const d = zIso(s); d.setDate(d.getDate() + n); return iso(d); };
const dzis = () => iso(new Date());
const poniedzialek = s => { const d = zIso(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); };
const DNI = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const DNI_P = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const MIES = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const opisDnia = s => { const d = zIso(s); return `${DNI_P[d.getDay()]}, ${d.getDate()} ${MIES[d.getMonth()]}`; };
const dataSlownie = s => { const d = zIso(s); return `${d.getDate()} ${MIES[d.getMonth()]}`; };
const krotko = s => { const d = zIso(s); return `${d.getDate()}.${pad(d.getMonth() + 1)}`; };
const dniMiedzy = (a, b) => Math.round((zIso(b) - zIso(a)) / 864e5);
const startApki = () => S.start || (S.waga[0] && S.waga[0].d) || dzis();

/* ---------- liczby ---------- */
const fN = (n, p = 1) => (Math.round(n * 10 ** p) / 10 ** p).toString().replace('.', ',');
const fK = n => Math.round(n).toLocaleString('pl-PL');
const odm = (n, a, b, c) => n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? b : c;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bezTagow = s => s.replace(/<[^>]+>/g, '');
function wartosci(ing) {
  let k = 0, b = 0, t = 0, w = 0;
  for (const [key, g] of ing) { const f = F[key]; if (!f) continue; k += f.k * g / 100; b += f.b * g / 100; t += f.t * g / 100; w += f.w * g / 100; }
  return { k, b, t, w };
}
const bazowe = r => (r._w || (r._w = wartosci(r.ing)));
const zaokr = g => g < 10 ? Math.max(1, Math.round(g)) : g < 50 ? Math.round(g) : Math.round(g / 5) * 5;
const skaluj = (r, f) => r.ing.map(([k, g]) => [k, zaokr(g * f)]);
function ilosc(key, g, sklep) {
  const f = F[key];
  const s = g >= 1000 ? fN(g / 1000, 2) + ' kg' : g + ' g';
  if (f && f.szt) { const n = sklep ? Math.max(1, Math.ceil(g / f.szt - .15)) : Math.round(g / f.szt * 2) / 2; if (n >= 0.5) return `${fN(n)} ${f.sztN || 'szt.'} <small>(${s})</small>`; }
  return s;
}

/* ---------- dieta ---------- */
const AKT = [
  { v: 1.2, n: 'Mało ruchu', o: 'praca siedząca, mało spacerów' },
  { v: 1.375, n: 'Trochę ruchu', o: 'spacery, prace w domu i ogrodzie' },
  { v: 1.55, n: 'Sporo ruchu', o: 'ćwiczenia 3–4 razy w tygodniu' },
  { v: 1.725, n: 'Dużo ruchu', o: 'praca fizyczna albo sport codziennie' }];
const DIETY = {
  standard: { n: 'Zwykła, zbilansowana', o: 'Wszystkie przepisy, wszystkiego po trochu', tag: null, m: [20, 30, 50] },
  srodz: { n: 'Śródziemnomorska', o: 'Oliwa, ryby, warzywa, strączki', tag: 'srodz', m: [18, 35, 47] },
  wege: { n: 'Wegetariańska', o: 'Bez mięsa i ryb, z jajkami i nabiałem', tag: 'wege', m: [18, 32, 50] },
  lowcarb: { n: 'Mniej węglowodanów', o: 'Mniej pieczywa i kasz, więcej warzyw', tag: 'lowcarb', m: [25, 45, 30] },
  fit: { n: 'Więcej białka', o: 'Syci na dłużej i chroni mięśnie', tag: 'fit', m: [30, 30, 40] },
  tania: { n: 'Oszczędna', o: 'Proste i niedrogie składniki', tag: 'tania', m: [18, 30, 52] } };
const DIK = { standard: 'talerz', srodz: 'ryba', wege: 'lisc', lowcarb: 'chleb', fit: 'hantel', tania: 'moneta' };
const SLOTY = {
  3: [['sniadanie', 'Śniadanie', '8:00', .30], ['obiad', 'Obiad', '13:30', .45], ['kolacja', 'Kolacja', '19:00', .25]],
  4: [['sniadanie', 'Śniadanie', '8:00', .27], ['drugie', 'II śniadanie', '11:00', .13], ['obiad', 'Obiad', '14:00', .35], ['kolacja', 'Kolacja', '18:30', .25]],
  5: [['sniadanie', 'Śniadanie', '7:30', .25], ['drugie', 'II śniadanie', '10:30', .10], ['obiad', 'Obiad', '13:30', .33], ['podw', 'Podwieczorek', '16:30', .10], ['kolacja', 'Kolacja', '19:00', .22]] };
const KROT = { sniadanie: 'Śniadanie', drugie: 'Przekąska', obiad: 'Obiad', kolacja: 'Kolacja' };
const typ = s => s === 'podw' ? 'drugie' : s;
const sloty = () => SLOTY[S.posilki] || SLOTY[4];
const slotInfo = s => sloty().find(x => x[0] === s) || SLOTY[5].find(x => x[0] === s);

function wagaTeraz() { const w = S.waga[S.waga.length - 1]; return w ? w.kg : (S.profil ? S.profil.waga : 70); }
function zapotrzebowanie() {
  const p = S.profil; if (!p) return 1800;
  const bmr = 10 * wagaTeraz() + 6.25 * p.wzrost - 5 * p.wiek + (p.plec === 'm' ? 5 : -161);
  let t = bmr * AKT[p.akt].v;
  if (p.cel === 'schudnac') t -= p.tempo * 7700 / 7;
  if (p.cel === 'przytyc') t += 300;
  return Math.max(p.plec === 'm' ? 1500 : 1200, Math.round(t / 50) * 50);
}
const kcalCel = () => (S.profil && S.profil.kcalWlasne) || zapotrzebowanie();
const celSlotu = s => kcalCel() * (slotInfo(s) ? slotInfo(s)[3] : .25);
const mnoznik = (r, s) => Math.min(1.8, Math.max(.6, celSlotu(s) / Math.max(1, bazowe(r).k)));

function pula(s) {
  const t = typ(s), wyk = new Set(S.wyklucz);
  return R.filter(r => r.m.includes(t) && !r.ing.some(([k]) => wyk.has(k)));
}
function ocena(r, d, s) {
  let sc = Math.abs(Math.log(celSlotu(s) / Math.max(1, bazowe(r).k)));
  const tag = DIETY[S.dieta].tag; if (tag && !(r.d || []).includes(tag)) sc += 3;
  for (let i = 1; i <= 5; i++) for (const dd of [plus(d, -i), plus(d, i)]) {
    const p = S.plan[dd]; if (p && Object.values(p).some(x => x && x.id === r.id)) sc += (6 - i) * .5;
  }
  if (S.ulub.includes(r.id)) sc -= .4;
  return sc;
}
function wybierz(d, s, p, bez) {
  const zajete = new Set(Object.values(p).map(x => x && x.id));
  let c = pula(s).filter(r => !zajete.has(r.id) && r.id !== bez);
  if (!c.length) c = pula(s).filter(r => r.id !== bez);
  if (!c.length) return null;
  c.sort((a, b) => ocena(a, d, s) - ocena(b, d, s));
  const top = c.slice(0, Math.min(4, c.length));
  return top[Math.floor(Math.random() * top.length)].id;
}
function planDnia(d) {
  const p = S.plan[d] || (S.plan[d] = {}); let zm = false;
  for (const [s] of sloty()) if (!p[s] || !RB[p[s].id]) { const id = wybierz(d, s, p); if (id) { p[s] = { id }; zm = true; } }
  if (zm) zapisz();
  return p;
}
function posilekDnia(d, s) {
  const x = planDnia(d)[s]; const r = x && RB[x.id]; if (!r) return null;
  const f = mnoznik(r, s), ing = skaluj(r, f);
  return { r, f, ing, w: wartosci(ing) };
}
function zjedzoneDnia(d) {
  const z = S.zjedz[d] || {}; let k = 0, b = 0, t = 0, w = 0, plan = 0;
  for (const [s] of sloty()) { const m = posilekDnia(d, s); if (!m) continue; plan += m.w.k; if (z[s]) { k += m.w.k; b += m.w.b; t += m.w.t; w += m.w.w; } }
  for (const e of S.extra[d] || []) k += e.k;
  return { k, b, t, w, plan };
}
function przyszlePlanyOdNowa() { const t = dzis(); for (const d of Object.keys(S.plan)) if (d >= t) delete S.plan[d]; }

/* ---------- ikony i ilustracje ---------- */
const I = {
  plan: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  przepisy: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7.5h6"/>',
  zakupy: '<path d="M3.5 9h17l-1.8 10.2a1.5 1.5 0 0 1-1.5 1.3H6.8a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M8 9l4-5.5L16 9M9.5 13v4M14.5 13v4"/>',
  waga: '<path d="M4 20h16"/><path d="M5 15.5l4.5-5 3.5 3 6-7"/><path d="M15.5 6.5H19V10"/>',
  zebatka: '<path d="M10.3 4.3c.4-1.8 3-1.8 3.4 0a1.7 1.7 0 0 0 2.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 0 0 1 2.5c1.8.4 1.8 3 0 3.4a1.7 1.7 0 0 0-1 2.6c.9 1.5-.9 3.3-2.4 2.4a1.7 1.7 0 0 0-2.6 1c-.4 1.8-3 1.8-3.4 0a1.7 1.7 0 0 0-2.6-1c-1.5.9-3.3-.9-2.4-2.4a1.7 1.7 0 0 0-1-2.6c-1.8-.4-1.8-3 0-3.4a1.7 1.7 0 0 0 1-2.5c-.9-1.6.9-3.3 2.4-2.4 1 .6 2.3.1 2.6-1.1z"/><circle cx="12" cy="12" r="3"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7"/>', swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  lewo: '<path d="M15 5l-7 7 7 7"/>',
  prawo: '<path d="M9 5l7 7-7 7"/>', szukaj: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  serce: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  sniadanie: '<path d="M4 10h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H15.5M8 3.5c0 1.5 1 1.5 1 3M12 3.5c0 1.5 1 1.5 1 3"/>',
  drugie: '<path d="M12 7.5c-2-1.8-7-1.2-7 4.2 0 4.3 3 8.3 5.2 8.3.8 0 1.2-.4 1.8-.4s1 .4 1.8.4c2.2 0 5.2-4 5.2-8.3 0-5.4-5-6-7-4.2z"/><path d="M12 7.5c0-2 1-3.5 3-4"/>',
  obiad: '<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z"/><path d="M9 7c0-1.2 1-1.2 1-2.5M14 7c0-1.2 1-1.2 1-2.5"/>',
  podw: '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10" r=".8"/><circle cx="14.5" cy="9" r=".8"/><circle cx="13" cy="14.5" r=".8"/><circle cx="8.5" cy="14" r=".8"/>',
  kolacja: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', zegar: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  kosz: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  udost: '<path d="M12 3.5v11M7.5 8L12 3.5 16.5 8"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  garnek: '<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 10h2M20 10h2M9 6.5c0-1 1-1 1-2.5M14 6.5c0-1 1-1 1-2.5"/>',
  kod: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13.5 8v8M17 8v8"/>',
  zarowka: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  telefon: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  osoba: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  zakaz: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  oko: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  kropla: '<path d="M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z"/>',
  pobierz: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  talerz: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
  ryba: '<path d="M3 12c3-4.2 6.8-6 10.5-6 3 0 5.5 2.4 7.5 6-2 3.6-4.5 6-7.5 6C9.8 18 6 16.2 3 12z"/><path d="M3 12L1.5 8.5M3 12l-1.5 3.5"/><circle cx="16" cy="11" r=".9"/>',
  lisc: '<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z"/><path d="M5 19l7-7"/>',
  chleb: '<path d="M5 11a3.5 3.5 0 0 1 1.5-6.5h11A3.5 3.5 0 0 1 19 11v8.5H5z"/><path d="M12 9v6M9.5 12.5L12 15l2.5-2.5"/>',
  hantel: '<path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11"/>',
  moneta: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.5c-.4-.9-1.3-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.2 0-2.1-.6-2.5-1.5M12 6.5V8M12 16v1.5"/>' };
const ik = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
const KOL = { warzywa: ['#7fb069', '#a7c957', '#e07a5f', '#5e8c4a'], owoce: ['#e85d75', '#f2a541', '#c44569'], nabial: ['#f1e4c3', '#e9d8a6'],
  mieso: ['#b5651d', '#9c4f2e', '#c97c4a'], ryby: ['#f08a5d', '#f4a07a'], zboza: ['#e1b866', '#d9a441', '#caa165'], straczki: ['#c9a227', '#8d6b2f', '#b5835a'],
  tluszcze: ['#c8b26b', '#a68a4b'], spizarnia: ['#c0392b', '#d35400'], przyprawy: ['#6a994e'] };
/* zdjęcie dania nad ilustracją-zastępstwem: gdy pliku brak, zostaje narysowany talerz */
function talerz(r, duzy) {
  const t = talerzRys(r, duzy);
  if (!r) return t;
  return t.replace('</div></div>', `</div><img class="foto" src="img/dania/${duzy ? 'd' : 'm'}/${r.id}.webp" alt="" loading="lazy" decoding="async" onload="this.classList.add('ok')" onerror="this.remove()"></div>`);
}
function ikonaSkl(k) {
  const f = F[k]; const kol = (KOL[f && f.cat] || ['#9cb2a3'])[0];
  const lit = ((f && f.n) || k).charAt(0).toUpperCase();
  return `<span class="iks" style="background:${kol}33"><b style="color:${kol}">${lit}</b><img src="img/produkty/${k}.webp" alt="" loading="lazy" onload="this.previousSibling.remove();this.classList.add('ok')" onerror="this.remove()"></span>`;
}
function talerzRys(r, duzy) {
  if (!r) return `<div class="plate${duzy ? ' lg' : ''}"><div class="dish"></div></div>`;
  const h = [...r.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const ing = r.ing.filter(([k]) => F[k] && F[k].cat !== 'przyprawy').sort((a, b) => b[1] - a[1]).slice(0, 4);
  const poz = [[46, 52, 40], [64, 38, 28], [62, 64, 26], [36, 34, 20]];
  const kropki = ing.map(([k], i) => {
    const pal = KOL[F[k].cat] || ['#bbb']; const c = pal[(h + i) % pal.length];
    let [x, y, s] = poz[i]; x += ((h >> (i * 3)) % 7) - 3; y += ((h >> (i * 2 + 1)) % 7) - 3;
    return `<i style="left:${x - s / 2}%;top:${y - s / 2}%;width:${s}%;height:${s}%;background:radial-gradient(circle at 35% 30%,${c}cc,${c} 70%)"></i>`;
  }).join('');
  return `<div class="plate${duzy ? ' lg' : ''}"><div class="dish">${kropki}</div></div>`;
}
/* płynne przejście liczb: element startuje od poprzedniej wartości, po narysowaniu dostaje nową */
const anim = (key, css, js, val, od) => `data-a="${key}" data-to="${js}|${val}" style="${css}:${U.anim[key] ?? od}"`;
function animuj(root) {
  const el = root.querySelectorAll('[data-a]'); if (!el.length) return;
  void root.offsetWidth;
  el.forEach(e => { const [p, v] = e.dataset.to.split('|'); e.style[p] = v; U.anim[e.dataset.a] = v; });
}
const samodzielna = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let instPrompt = null;

/* ---------- widoki ---------- */
function widok() {
  document.documentElement.classList.toggle('duze', !!S.duze);
  if (S.motyw === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', S.motyw);
  if (S.paleta && S.paleta !== 'a') document.documentElement.setAttribute('data-paleta', S.paleta); else document.documentElement.removeAttribute('data-paleta');
  const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f4f6f1';
  const app = document.getElementById('app');
  const chipsX = [...app.querySelectorAll('.chips')].map(c => c.scrollLeft);
  if (!R.length) { app.innerHTML = `<div class="wrap empty"><h2>Brak przepisów</h2><p>Nie udało się wczytać bazy przepisów. Odśwież stronę.</p></div>`; return; }
  if (!S.profil) { app.innerHTML = powitanie(); return; }
  const t = { plan: ekranPlan, przepisy: ekranPrzepisy, zakupy: ekranZakupy, waga: ekranWaga }[U.tab] || ekranPlan;
  app.innerHTML = t() + nawigacja();
  app.querySelectorAll('.chips').forEach((c, i) => { if (chipsX[i]) c.scrollLeft = chipsX[i]; });
  U.wjazd = null;
  animuj(app); gotoweFoto(app);
  if (!S.pokazano.intro && !U.intro && !U.stos.length) { U.intro = true; setTimeout(() => { if (U.stos.length || !S.profil) return; S.pokazano.intro = S.pokazano.wsk = true; zapisz(); U.pp = 0; otworz(arkuszIntro()); widok(); }, 350); }
}
function gotoweFoto(root) { root.querySelectorAll('img.foto:not(.ok),.iks img:not(.ok)').forEach(i => { if (i.complete && i.naturalWidth) i.classList.add('ok'); }); }
const brzek = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
function wejscie() { const a = document.getElementById('app'); a.classList.remove('wej'); void a.offsetWidth; a.classList.add('wej'); }
function nawigacja() {
  const z = [['plan', 'Plan'], ['przepisy', 'Przepisy'], ['zakupy', 'Zakupy'], ['waga', 'Waga']];
  const ile = doKupienia();
  return `<nav class="nav" aria-label="Główne ekrany"><div class="in">${z.map(([k, n]) => `<button data-act="tab" data-v="${k}" class="${U.tab === k ? 'on' : ''}"${U.tab === k ? ' aria-current="page"' : ''}><span class="pill">${ik(k)}${k === 'zakupy' && ile ? `<em class="badge" aria-label="${ile} do kupienia">${ile}</em>` : ''}</span>${n}</button>`).join('')}</div></nav>`;
}
function naglowek(maly, duzy, extra = '') {
  return `<header class="wrap hd"><div class="hd-l"><div class="hi">${maly}</div><h1>${duzy}</h1></div><div class="hd-r">${extra}<button class="ico-btn lab" data-act="ustawienia" aria-label="Ustawienia">${ik('zebatka')}<span>Ustawienia</span></button></div></header>`;
}
const pusty = (ikona, tytul, tekst, przycisk = '') => `<div class="empty">${ik(ikona)}<b>${tytul}</b><p>${tekst}</p>${przycisk}</div>`;

function instal() {
  if (S.pokazano.inst || (S.wizyty || 0) < 2 || samodzielna()) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const jak = instPrompt ? 'Jednym dotknięciem. Będzie działać jak zwykła aplikacja, także bez internetu.'
    : ios ? 'W Safari dotknij <b>Udostępnij</b> (kwadrat ze strzałką w górę), potem <b>Do ekranu początkowego</b>.'
      : 'W przeglądarce dotknij <b>⋮</b> w prawym górnym rogu, potem <b>Dodaj do ekranu głównego</b>.';
  return `<div class="card hint"><span class="hint-ik">${ik('telefon')}</span><div><b>Dodaj na ekran telefonu</b><p>${jak}</p><div class="row">${instPrompt ? `<button class="btn" data-act="instaluj">Zainstaluj</button>` : ''}<button class="btn sec" data-act="pokazano" data-v="inst">${instPrompt ? 'Później' : 'Rozumiem'}</button></div></div></div>`;
}

/* ---------- pakiet A: kopia danych co miesiąc, wysyłana jednym dotykiem (25.11) ---------- */
function kopiaCzeka() {
  const t = dzis(), k = S.kopia || {};
  if (k.odl && t < k.odl) return false;
  return k.d ? dniMiedzy(k.d, t) >= 30 : dniMiedzy(startApki(), t) >= 7;
}
const kopiaOpis = () => { const k = S.kopia || {}; if (!k.d) return 'Kopii jeszcze nie było'; const y = zIso(k.d).getFullYear(); return `Ostatnia kopia: ${dataSlownie(k.d)}${y !== new Date().getFullYear() ? ' ' + y : ''}`; };
function kartaKopii() {
  if (!kopiaCzeka()) return '';
  return `<div class="card hint"><span class="hint-ik">${ik('udost')}</span><div><b>Czas na kopię danych</b><p>Twoje wpisy są tylko w tym telefonie. Wyślij sobie kopię e-mailem albo komuś bliskiemu, wtedy nic nie zginie. ${kopiaOpis()}.</p><div class="row"><button class="btn" data-act="kopia-wyslij">Wyślij kopię</button><button class="btn sec" data-act="kopia-pozniej">Za tydzień</button></div></div></div>`;
}
/* plik .txt z danymi w JSON: Chrome na Androidzie nie udostępnia plików .json, a .txt tak */
const plikKopii = () => new File([JSON.stringify(S, null, 1)], `dieta-mamy-kopia-${dzis()}.txt`, { type: 'text/plain' });
function kopiaZrobiona(msg) { S.kopia = { d: dzis(), odl: null }; zapisz(); widok(); odswiezArkusz(); toast(msg); }
async function wyslijKopie() {
  const f = plikKopii();
  try {
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      await navigator.share({ files: [f], title: 'Kopia: Dieta Mamy', text: 'Kopia danych z aplikacji Dieta Mamy. Zachowaj ten plik. Wczytasz go w Ustawieniach, w części Kopia zapasowa.' });
      return kopiaZrobiona('Kopia wysłana');
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  pobierzKopie();
}
function pobierzKopie() {
  const f = plikKopii(), a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  kopiaZrobiona('Kopia zapisana w Pobranych');
}
/* ---------- pakiet A: łagodne komunikaty ---------- */
const RADY = ['zacznij od śniadania z planu, bo syci aż do obiadu.', 'wypij szklankę wody przed każdym posiłkiem.', 'coś słodkiego zjedz po obiedzie, a nie między posiłkami.',
  'po obiedzie wyjdź na 15 minut spaceru.', 'nałóż obiad na mniejszy talerz, porcja wygląda tak samo smacznie.', 'jedz powoli i odkładaj widelec między kęsami.'];
const rada = d => { const r = RADY[[...d].reduce((a, c) => a + c.charCodeAt(0), 0) % RADY.length]; return r.charAt(0).toUpperCase() + r.slice(1); };
/* kolor zmiany wagi: spokojny, nigdy czerwony; „dobrze” zależy od celu mamy */
const zmTxt = r => Math.abs(r) < .05 ? 'bez zmian' : `${r > 0 ? '+' : '−'}${fN(Math.abs(r))} kg`;
const kolorZm = r => { const c = S.profil && S.profil.cel; return Math.abs(r) < .05 ? 'var(--muted)' : (c === 'przytyc' ? r > 0 : c === 'schudnac' ? r < 0 : false) ? 'var(--ok)' : 'var(--muted)'; };
/* ---------- pakiet A: podejrzany produkt ze skanera ---------- */
function podejrzany(p) {
  if (!p || p.popr) return [];
  const b = +p.b || 0, t = +p.t || 0, w = +p.w || 0, s = b + t + w, est = 4 * b + 9 * t + 4 * w, r = [];
  if (p.k > 900) r.push('Ponad 900 kcal na 100 g to więcej niż czysty olej.');
  if (s > 105) r.push('Białka, tłuszczu i węglowodanów jest razem ponad 100 g na 100 g produktu.');
  if (p.k === 0 && s > 3) r.push('Baza podaje 0 kcal, a produkt ma białko, tłuszcz albo węglowodany.');
  else if (p.k > 0 && p.k <= 900 && est > 25 && Math.abs(p.k - est) / Math.max(p.k, est) > .3) r.push(`Kalorie (${p.k}) nie pasują do składu: z białka, tłuszczu i węglowodanów wychodzi około ${Math.round(est)} kcal.`);
  return r;
}

/* ---------- pakiet B: linia trendu wagi (średnia wykładnicza, 10% na dzień, jak MacroFactor i Hacker's Diet) ---------- */
function trendWagi() {
  let t = null, prev = null;
  return S.waga.map(x => { if (t === null) t = x.kg; else t += (1 - Math.pow(.9, Math.max(1, dniMiedzy(prev, x.d)))) * (x.kg - t); prev = x.d; return { d: x.d, kg: x.kg, tr: t }; });
}
const trendNa = (tr, d) => { let v = null; for (const x of tr) if (x.d <= d) v = x.tr; return v; };
/* ---------- pakiet B: niedzielne podsumowanie tygodnia ---------- */
function tydzien(pn) {
  const cel = kcalCel(), t = dzis(); let wg = 0, uzyte = 0, wodaS = 0, wodaN = 0; const dni = [];
  for (let i = 0; i < 7; i++) {
    const d = plus(pn, i), zj = S.zjedz[d] || {}, odh = Object.keys(zj).length > 0, wo = (S.woda || {})[d] || 0;
    let st = '';
    if (d <= t && odh) { uzyte++; if (zjedzoneDnia(d).k <= cel * 1.1) { wg++; st = 'ok'; } else st = 'byl'; }
    if (d <= t && wo) { wodaS += wo; wodaN++; }
    dni.push([d, st]);
  }
  const tr = trendWagi(), nd = plus(pn, 6), a = trendNa(tr, plus(pn, -1)), b = trendNa(tr, nd);
  const wazenie = S.waga.some(x => x.d >= pn && x.d <= nd);
  return { pn, nd, dni, wg, uzyte, woda: wodaN ? wodaS / wodaN : 0, zmiana: a !== null && b !== null && wazenie ? b - a : null };
}
function pochwala(x) {
  const c = S.profil && S.profil.cel, waga = x.zmiana !== null && ((c === 'schudnac' && x.zmiana < -.05) || (c === 'przytyc' && x.zmiana > .05));
  if (x.wg >= 6) return waga ? 'Wspaniały tydzień, a waga idzie w dobrą stronę. Tak trzymaj!' : 'Wspaniały tydzień. Prawie każdy dzień według planu, gratulacje!';
  if (x.wg >= 4) return waga ? 'Bardzo dobry tydzień i waga idzie w dobrą stronę.' : 'Bardzo dobry tydzień. Większość dni według planu.';
  if (x.wg >= 2) return 'Dobry tydzień. Każdy dzień według planu się liczy.';
  if (x.wg === 1) return 'Dobry początek. W kolejnym tygodniu spróbuj o jeden dzień więcej.';
  return 'Nowy tydzień to nowy start. Zacznij od jednego posiłku z planu.';
}
/* widać w niedzielę (ten tydzień) i w poniedziałek–wtorek (poprzedni, gdyby mama nie zajrzała w niedzielę) */
function kartaTygodnia() {
  const t = dzis(), dz = zIso(t).getDay();
  if (![0, 1, 2].includes(dz)) return '';
  const pn = dz === 0 ? poniedzialek(t) : plus(poniedzialek(t), -7);
  if (S.pokazano['tydz-' + pn] || startApki() > plus(pn, 6)) return '';
  const x = tydzien(pn);
  if (!x.uzyte && x.zmiana === null) return '';
  const a = zIso(x.pn), b = zIso(x.nd);
  const zakres = `${a.getDate()}${a.getMonth() !== b.getMonth() ? ' ' + MIES[a.getMonth()] : ''}–${b.getDate()} ${MIES[b.getMonth()]}`;
  const kropki = x.dni.map(([d, st]) => `<span class="td ${st}" title="${opisDnia(d)}">${st === 'ok' ? ik('ok') : ''}<small>${DNI[zIso(d).getDay()]}</small></span>`).join('');
  const zm = x.zmiana === null ? '' : `<li>${ik('waga')}<span>Waga według linii trendu: <b style="color:${kolorZm(x.zmiana)}">${zmTxt(x.zmiana)}</b></span></li>`;
  const wo = x.woda ? `<li>${ik('kropla')}<span>Woda: średnio <b>${fN(x.woda, 0)} ${odm(Math.round(x.woda), 'szklanka', 'szklanki', 'szklanek')}</b> dziennie</span></li>` : '';
  return `<div class="card tydz"><div class="tydz-hd"><small>${dz === 0 ? 'Podsumowanie tygodnia' : 'Poprzedni tydzień'} · ${zakres}</small><b>${pochwala(x)}</b></div>
    <div class="tdni">${kropki}</div>
    <ul class="tydz-l"><li>${ik('ok')}<span><b>${x.wg} z 7</b> ${odm(x.wg, 'dzień', 'dni', 'dni')} według planu</span></li>${zm}${wo}</ul>
    <button class="btn sec" data-act="pokazano" data-v="tydz-${pn}">Dziękuję</button></div>`;
}

/* ---------- pakiet C: woda, 8 szklanek ---------- */
const SZKL = '<path class="woda-w" d="M7.3 10.5h9.4l-.9 9.2a1.2 1.2 0 0 1-1.2 1.1H9.4a1.2 1.2 0 0 1-1.2-1.1z"/><path d="M5.5 3.5h13l-1.6 16.3a1.6 1.6 0 0 1-1.6 1.5H8.7a1.6 1.6 0 0 1-1.6-1.5z"/>';
function kartaWody(d) {
  const wo = (S.woda || {})[d] || 0;
  return `<div class="card woda"><div class="woda-hd"><b>${ik('kropla')}Woda</b><span>${wo >= 8 ? 'Brawo, 8 z 8 szklanek!' : `${wo} z 8 szklanek`}</span></div>
    <div class="szkl">${[...Array(8)].map((_, i) => `<button class="sz${i < wo ? ' on' : ''}" data-act="woda" data-v="${i + 1}" data-d="${d}" aria-label="${i + 1} ${odm(i + 1, 'szklanka', 'szklanki', 'szklanek')} wody" aria-pressed="${i < wo}"><svg viewBox="0 0 24 24" aria-hidden="true">${SZKL}</svg></button>`).join('')}</div></div>`;
}
/* ---------- pakiet C: przypomnienia przez plik kalendarza .ics ---------- */
const przyp = () => {
  if (!S.przyp) S.przyp = { godz: {}, wyl: [], waga: { on: true, dzien: 1, godz: '07:30' } };
  for (const [s, , h] of sloty().concat(SLOTY[5])) if (!S.przyp.godz[s]) S.przyp.godz[s] = h.padStart(5, '0');
  return S.przyp;
};
function plikIcs() {
  const p = przyp(), st = dzis().replace(/-/g, ''), url = location.origin + location.pathname;
  const teraz = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ev = (uid, h, tyt, rr, opis) => ['BEGIN:VEVENT', `UID:${uid}@dieta-mamy`, `DTSTAMP:${teraz}`, `DTSTART:${st}T${h.replace(':', '')}00`, 'DURATION:PT15M', `RRULE:${rr}`,
    `SUMMARY:${tyt}`, `DESCRIPTION:${opis}`, `URL:${url}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${tyt}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'];
  const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dieta Mamy//PL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Dieta Mamy'];
  for (const [s, n] of sloty()) if (!p.wyl.includes(s)) l.push(...ev(`posilek-${s}`, p.godz[s], `${n} (Dieta Mamy)`, 'FREQ=DAILY', `Pora na posiłek z planu. Otwórz Dieta Mamy i odhacz go.`));
  if (p.waga.on) l.push(...ev('wazenie', p.waga.godz, 'Ważenie (Dieta Mamy)', `FREQ=WEEKLY;BYDAY=${['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][p.waga.dzien]}`, 'Zważ się rano, na czczo, i wpisz wagę w Dieta Mamy.'));
  l.push('END:VCALENDAR');
  return l.join('\r\n') + '\r\n';
}
function dodajDoKalendarza() {
  const p = przyp(); if (sloty().every(([s]) => p.wyl.includes(s)) && !p.waga.on) return toast('Włącz przynajmniej jedno przypomnienie');
  const blob = new Blob([plikIcs()], { type: 'text/calendar;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  // iPhone: Safari otwiera plik kalendarza i pyta „Dodaj wszystko”; Android: plik ląduje w Pobranych i otwiera się w Kalendarzu
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) a.target = '_blank'; else a.download = 'dieta-mamy-przypomnienia.ics';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
  p.dodane = dzis(); zapisz(); odswiezArkusz(); toast('Otwórz plik i dotknij „Dodaj”');
}

/* ---------- pakiet D: szacunkowy koszt zakupów (ręczna tabela cen, zł za kg albo litr) ---------- */
const CENY_DATA = 'listopad 2026';
const CENY = { platki_owsiane: 6, musli_bez_cukru: 22, chleb_razowy: 12, bulka_grahamka: 15, tortilla_pelnoziarnista: 25, makaron_pelnoziarnisty: 12, makaron_penne: 9, ryz_bialy: 8, ryz_brazowy: 14,
  kasza_gryczana: 12, kasza_jaglana: 12, kasza_jeczmienna: 7, maka_pszenna: 3.5, chrupkie_pieczywo: 40,
  jajko: 18, mleko_2: 4, jogurt_naturalny: 10, jogurt_grecki: 14, kefir: 7, twarog_polotlusty: 22, twarog_chudy: 22, serek_wiejski: 18, ser_feta: 40, mozzarella: 32, ser_parmezan: 110,
  ser_zolty: 40, maslanka: 4.5, maslo: 40, smietana_18: 12,
  por: 8, kapusta_pekinska: 6, seler_naciowy: 12, pomidor: 12, ogorek: 9, ogorek_kiszony: 12, papryka_czerwona: 14, cebula: 4, czosnek: 30, marchew: 4, pietruszka_korzen: 12, seler_korzen: 6,
  ziemniaki: 3.5, batat: 12, cukinia: 8, baklazan: 12, brokul: 12, kalafior: 8, kapusta_biala: 3.5, kapusta_kiszona: 8, szpinak: 30, salata: 20, rukola: 50, burak: 4, dynia: 6,
  zielona_fasolka: 20, groszek_zielony: 14, kukurydza_konserwowa: 16, rzodkiewka: 15, szczypiorek: 100, natka_pietruszki: 80, pieczarki: 14, mieszanka_warzyw: 12, cytryna: 10,
  rodzynki: 25, daktyle: 30, jablko: 4.5, banan: 6.5, gruszka: 9, kiwi: 15, truskawki: 25, maliny: 50, borowki: 50, sliwki_suszone: 40, awokado: 25,
  sledz_filet: 30, pstrag: 50, losos: 90, dorsz: 70, mintaj: 35, makrela_wedzona: 35, tunczyk_w_wodzie: 50,
  piers_kurczaka: 28, udko_kurczaka: 15, piers_indyka: 38, indyk_mielony: 32, schab: 25, wieprzowina_mielona: 22, wolowina_gulaszowa: 55, szynka_drobiowa: 45,
  ciecierzyca: 15, fasola_czerwona: 15, fasola_biala: 15, soczewica_czerwona: 14, hummus: 40, tofu: 35,
  oliwa: 45, olej_rzepakowy: 9, migdaly: 60, orzechy_wloskie: 50, siemie_lniane: 12, pestki_slonecznika: 20, pestki_dyni: 50, chia: 35, maslo_orzechowe: 35, sezam: 30,
  miod: 50, koncentrat_pomidorowy: 20, pomidory_w_puszce: 10, passata: 9, bulion_warzywny: 5, oliwki: 40, sos_sojowy: 40, mleko_kokosowe: 22, musztarda: 15, ocet_balsamiczny: 30 };
/* ile gramów trafi do koszyka (całe opakowania, sztuki), z tego cena */
function gramyKupione(k, g) {
  const o = OPAK[k], f = F[k];
  if (o) return Math.max(1, Math.ceil(g / o[0] - .1)) * o[0];
  if (f && f.szt) return Math.max(1, Math.ceil(g / f.szt - .15)) * f.szt;
  return g < 50 ? Math.ceil(g / 10) * 10 : g < 500 ? Math.ceil(g / 50) * 50 : Math.ceil(g / 100) * 100;
}
const kosztPoz = (k, g) => (F[k] && F[k].cat === 'przyprawy') || !CENY[k] ? 0 : CENY[k] * gramyKupione(k, g) / 1000;
const zl = v => v < 1 ? 'mniej niż 1 zł' : `ok. ${fK(v)} zł`;

/* ---------- pakiet D: 4 obrazkowe podpowiedzi przy pierwszym uruchomieniu ---------- */
const PODP = [
  ['Twój plan na dziś', 'Dotknij posiłku, a zobaczysz przepis. Kółko po prawej odhacza, że już zjedzone.', () => {
    const r = RB.owsianka_jablko || R[0];
    return `<div class="mini-card">${talerz(r)}<span class="info"><span class="mt">${ik('sniadanie')}Śniadanie · 8:00</span><span class="mn">${esc(r.n)}</span></span><span class="ck on pulsuj"><span>${ik('ok')}</span></span></div>`; }],
  ['Nie smakuje? Wymień', 'Dotknij „Wymień”, a pokażę inne dania o podobnej liczbie kalorii. Porcje przeliczę sama.', () => {
    const r = RB.losos_ziemniaki_brokul || R[1];
    return `<div class="mini-card">${talerz(r)}<span class="info"><span class="mt">${ik('obiad')}Obiad · 14:00</span><span class="mn">${esc(r.n)}</span><span class="swap pulsuj">${ik('swap')}Wymień</span></span></div>`; }],
  ['Lista zakupów robi się sama', 'Powstaje z planu, z cenami. W sklepie odhaczaj, co już jest w koszyku.', () =>
    `<ul class="card ing shop mini-shop">${[['jablko', 'Jabłko', '3 sztuki'], ['platki_owsiane', 'Płatki owsiane', '1 opakowanie'], ['mleko_2', 'Mleko 2%', '2 kartony']].map(([k, n, il], i) => `<li class="${i === 1 ? 'on' : ''}">${ikonaSkl(k)}<span class="nm"><b>${n}</b><small>${il}</small></span><span class="bx${i === 1 ? ' pulsuj' : ''}">${ik('ok')}</span></li>`).join('')}</ul>`],
  ['Woda i waga', 'Dotknij szklanki, gdy wypijesz wodę. Wagę wpisuj raz w tygodniu, a linia trendu pokaże, jak idzie.', () =>
    `<div class="szkl mini">${[...Array(8)].map((_, i) => `<span class="sz${i < 5 ? ' on' : ''}${i === 4 ? ' pulsuj' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${SZKL}</svg></span>`).join('')}</div>
    <svg class="mini-trend" viewBox="0 0 300 70" aria-hidden="true"><polyline points="10,22 60,30 110,26 160,38 210,40 260,48 290,50" stroke="var(--green)" stroke-width="4" fill="none"/>${[[10, 14], [60, 36], [110, 20], [160, 44], [210, 34], [260, 54], [290, 46]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="var(--card)" stroke="var(--muted)" stroke-width="2"/>`).join('')}</svg>`]];
function arkuszIntro() {
  return () => {
    const i = Math.max(0, Math.min(U.pp, PODP.length - 1)), [tyt, txt, rys] = PODP[i];
    return `<div class="intro"><div class="mt">Podpowiedź ${i + 1} z ${PODP.length}</div><div class="intro-rys" aria-hidden="true">${rys()}</div>
      <h2>${tyt}</h2><p class="lead">${txt}</p>
      <div class="dots">${PODP.map((_, j) => `<i class="${j === i ? 'on' : j < i ? 'by' : ''}"></i>`).join('')}</div>
      <div class="row">${i ? `<button class="btn sec" data-act="pp" data-v="-1">${ik('lewo')}Wstecz</button>` : ''}${i < PODP.length - 1 ? `<button class="btn" data-act="pp" data-v="1">Dalej${ik('prawo')}</button>` : `<button class="btn" data-act="zamknij">${ik('ok')}Zaczynamy</button>`}</div></div>`;
  };
}

function ekranPlan() {
  const d = U.dzien || (U.dzien = dzis()), t = dzis();
  const pn = poniedzialek(d), nd = plus(pn, 6);
  const godz = new Date().getHours(), imie = S.profil.imie ? `, ${esc(S.profil.imie)}` : '';
  const maly = d === t ? `${godz < 12 ? 'Dzień dobry' : godz < 18 ? 'Miłego dnia' : 'Dobry wieczór'}${imie} · ${dataSlownie(d)}` : opisDnia(d);
  const tyt = d === t ? 'Dziś' : d === plus(t, 1) ? 'Jutro' : d === plus(t, -1) ? 'Wczoraj' : DNI_P[zIso(d).getDay()];
  const a = zIso(pn), b = zIso(nd);
  const tydz = `${a.getDate()}${a.getMonth() !== b.getMonth() ? ' ' + MIES[a.getMonth()] : ''} – ${b.getDate()} ${MIES[b.getMonth()]}`;
  const dni = [...Array(7)].map((_, i) => { const x = plus(pn, i), dd = zIso(x);
    return `<button class="day${x === d ? ' on' : ''}${x === t ? ' dzis' : ''}" data-act="dzien" data-v="${x}" aria-label="${opisDnia(x)}"${x === d ? ' aria-current="date"' : ''}>${DNI[dd.getDay()]}<b>${dd.getDate()}</b></button>`; }).join('');
  const cel = kcalCel(), z = zjedzoneDnia(d), m = DIETY[S.dieta].m;
  const cB = cel * m[0] / 400, cT = cel * m[1] / 900, cW = cel * m[2] / 400;
  const zost = cel - z.k, za = z.k > cel * 1.05, C = 301.6, off = (C * (1 - Math.min(1, z.k / cel))).toFixed(1);
  const pasek = (n, val, c, cls) => `<div><div class="lab">${n}<span>${Math.round(val)} / ${Math.round(c)} g</span></div><div class="bar"><i class="${cls}" ${anim('p' + cls, 'width', 'width', Math.min(100, val / c * 100).toFixed(1) + '%', '0%')}></i></div></div>`;
  const zj = S.zjedz[d] || {};
  let wszystkie = true;
  const karty = sloty().map(([s, nazwa, h]) => {
    const p = posilekDnia(d, s);
    if (!p) { wszystkie = false; return `<div class="card meal-row"><div class="meal">${talerz(null)}<div class="info"><div class="mt">${ik(s)}${nazwa}</div><div class="mn">Brak pasującego przepisu</div><button class="swap" data-act="ustawienia" data-v="wyk">${ik('zakaz')}Zmień „Czego nie jem”</button></div></div></div>`; }
    const on = !!zj[s]; if (!on) wszystkie = false;
    return `<div class="card meal-row${on ? ' zjedz' : ''}"><div class="meal" role="button" tabindex="0" data-act="przepis" data-v="${p.r.id}" data-s="${s}" data-d="${d}">${talerz(p.r)}<div class="info"><div class="mt">${ik(s)}${nazwa} · ${h}</div><div class="mn">${esc(p.r.n)}</div><div class="mk">${on ? `<span class="zj">${ik('ok')}Zjedzone</span> · ` : ''}${Math.round(p.w.k)} kcal · ${p.r.t} min</div>${on ? '' : `<button class="swap" data-act="wymien" data-d="${d}" data-s="${s}">${ik('swap')}Wymień</button>`}</div></div><button class="ck${on ? ' on' : ''}" data-act="zjedz" data-d="${d}" data-s="${s}" aria-label="${on ? 'Odznacz' : 'Zjedzone'}: ${esc(p.r.n)}" aria-pressed="${on}"><span>${ik('ok')}</span></button></div>`;
  }).join('');
  const ex = (S.extra[d] || []).map((e, i) => `<div class="card extra"><span class="ex-ik">${ik('plus')}</span><span class="ex-n">${esc(e.n)}<small>${e.k} kcal · spoza planu</small></span><button class="ico44" data-act="extra-usun" data-i="${i}" aria-label="Usuń: ${esc(e.n)}">${ik('kosz')}</button></div>`).join('');
  const koniec = wszystkie ? `<div class="card done"><span>${ik('ok')}</span><div><b>Dzień zaliczony</b>${fK(z.k)} z ${fK(cel)} kcal</div></div>` : '';
  const wsk = S.pokazano.wsk ? '' : `<div class="card hint"><span class="hint-ik">${ik('zarowka')}</span><div><b>Jak to działa</b><p>Dotknij posiłku, a zobaczysz przepis i składniki. Kółko po prawej odhacza, że już zjedzone.</p><button class="btn sec" data-act="pokazano" data-v="wsk">Rozumiem</button></div></div>`;
  /* łagodnie po przekroczeniu (pakiet A): bez czerwieni i bez wyrzutów, jedna podpowiedź na jutro */
  const lagodnie = za && d === t ? `<div class="card lagodnie"><span class="hint-ik">${ik('serce')}</span><div><b>Dziś wyszło trochę więcej. Nic się nie stało</b><p>Liczy się cały tydzień, nie jeden dzień. Jutro nie trzeba jeść mniej, wystarczy wrócić do planu.</p><p class="rada">${ik('zarowka')}<span><b>Na jutro:</b> ${rada(d)}</span></p></div></div>` : '';
  return naglowek(maly, tyt, (d !== t ? `<button class="chip-dzis" data-act="dzien" data-v="${t}">Dziś</button>` : '') + `<button class="ico-btn lab" data-act="skan" aria-label="Skanuj kod kreskowy">${ik('kod')}<span>Skanuj</span></button>`) + `<div class="wrap">${instal()}${d === t ? kartaTygodnia() + kartaKopii() : ''}
  <div class="week"><button class="arr" data-act="tydzien" data-v="-7" aria-label="Poprzedni tydzień">${ik('lewo')}</button><span class="wk">${tydz}</span><button class="arr" data-act="tydzien" data-v="7" aria-label="Następny tydzień">${ik('prawo')}</button></div>
  <div class="days">${dni}</div>
  <div class="card sum">
    <div class="ring${za ? ' za' : ''}${z.k <= 0 ? ' zero' : ''}"><svg viewBox="0 0 112 112" aria-hidden="true"><circle class="tr" cx="56" cy="56" r="48"/><circle class="pr" cx="56" cy="56" r="48" stroke-dasharray="${C}" ${anim('ring', 'stroke-dashoffset', 'strokeDashoffset', off, C)}/></svg>
      <div class="in">${za ? `<small>więcej o</small><b>${fK(-zost)}</b>` : `<small>zostało</small><b>${fK(Math.max(0, zost))}</b>`}<small>kcal</small></div></div>
    <div class="bars"><div class="lab0">Zjedzone <b>${fK(z.k)}</b> z ${fK(cel)} kcal</div>${pasek('Białko', z.b, cB, 'bB')}${pasek('Tłuszcze', z.t, cT, 'bT')}${pasek('Węglowodany', z.w, cW, 'bW')}</div>
  </div>
  ${lagodnie}${kartaWody(d)}${wsk}
  <div class="meals${U.wjazd ? ' ' + U.wjazd : ''}" id="posilki">${karty}${ex}${koniec}</div>
  <button class="btn sec" style="margin-top:12px" data-act="extra-dodaj">${ik('plus')}Zjadłam coś spoza planu</button>
  <p class="note center">Przesuń palcem po posiłkach w bok, żeby zmienić dzień.</p></div>`;
}

function ekranPrzepisy() {
  const q = U.q.trim().toLowerCase(), fm = U.fm, ff = U.ff;
  const wyk = new Set(S.wyklucz);
  const lista = R.filter(r => {
    if (fm && !r.m.includes(fm)) return false;
    if (ff === 'ulub' && !S.ulub.includes(r.id)) return false;
    if (ff === 'szybkie' && r.t > 20) return false;
    if (ff === 'bezsm' && r.smaz) return false;
    if (ff && !['ulub', 'szybkie', 'bezsm'].includes(ff) && !(r.d || []).includes(ff)) return false;
    if (q && !(r.n.toLowerCase().includes(q) || r.ing.some(([k]) => F[k] && F[k].n.toLowerCase().includes(q)))) return false;
    return !r.ing.some(([k]) => wyk.has(k));
  });
  const chM = [['', 'Wszystkie'], ['sniadanie', 'Śniadania'], ['drugie', 'II śniadania'], ['obiad', 'Obiady'], ['kolacja', 'Kolacje']];
  const chF = [['ulub', 'Ulubione'], ['szybkie', 'Do 20 minut'], ['bezsm', 'Bez smażenia'], ['wege', 'Bez mięsa'], ['lowcarb', 'Mniej węgli'], ['fit', 'Więcej białka'], ['srodz', 'Śródziemnomorskie'], ['tania', 'Tanie']];
  const karty = lista.map(r => { const w = bazowe(r), ul = S.ulub.includes(r.id);
    return `<div class="card rrow"><div class="rcard" role="button" tabindex="0" data-act="przepis" data-v="${r.id}">${talerz(r)}<div class="info"><div class="mt">${r.m.map(x => KROT[x] || '').join(' · ')}</div><div class="mn">${esc(r.n)}</div><div class="mk">${Math.round(w.k)} kcal · ${r.t} min${r.smaz ? '' : ' · bez smażenia'}</div></div></div><button class="heart${ul ? ' on' : ''}" data-act="ulub" data-v="${r.id}" aria-label="${ul ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}" aria-pressed="${ul}">${ik('serce')}</button></div>`; }).join('');
  const aktywny = !!(fm || ff || q);
  const brak = pusty('szukaj', 'Nie ma takiego przepisu', 'Spróbuj innego słowa albo wyczyść filtry.',
    `<button class="btn sec" data-act="filtry-czysc">Wyczyść filtry</button><div class="chips podp">${['ryba', 'zupa', 'jajka', 'kasza'].map(s => `<button class="chip" data-act="szukaj-podp" data-v="${s}">${s}</button>`).join('')}</div>`);
  return naglowek(`${R.length} przepisów`, 'Przepisy') + `<div class="wrap">
  <div class="search">${ik('szukaj')}<input class="inp" id="szukaj" type="search" placeholder="Szukaj: łosoś, kasza, jajka…" value="${esc(U.q)}" autocomplete="off" enterkeyhint="search">${U.q ? `<button class="sx" data-act="szukaj-czysc" aria-label="Wyczyść szukanie">${ik('x')}</button>` : ''}</div>
  <div class="chips">${chM.map(([k, n]) => `<button class="chip${fm === k ? ' on' : ''}" data-act="fm" data-v="${k}" aria-pressed="${fm === k}">${n}</button>`).join('')}</div>
  <div class="grp">Dla Ciebie</div>
  <div class="chips">${chF.map(([k, n]) => `<button class="chip${ff === k ? ' on' : ''}" data-act="ff" data-v="${k}" aria-pressed="${ff === k}">${n}${ff === k ? ik('x') : ''}</button>`).join('')}</div>
  <div class="cnt"><span>${lista.length} ${odm(lista.length, 'przepis', 'przepisy', 'przepisów')}</span>${aktywny ? `<button class="lnk" data-act="filtry-czysc">Wyczyść filtry</button>` : ''}</div>
  <div class="rlist" id="rlist">${karty || brak}</div>
  <p class="note" style="margin-top:12px">Kalorie podane na jedną porcję podstawową. W planie porcje same dopasowują się do Twojego zapotrzebowania.</p></div>`;
}

const KAT = [['warzywa', 'Warzywa'], ['owoce', 'Owoce'], ['mieso', 'Mięso'], ['ryby', 'Ryby'], ['nabial', 'Nabiał i jajka'], ['zboza', 'Pieczywo, kasze, makarony'], ['straczki', 'Strączki'], ['tluszcze', 'Tłuszcze, orzechy, nasiona'], ['spizarnia', 'Spiżarnia'], ['przyprawy', 'Przyprawy — sprawdź, czy masz w domu']];
function listaZakupow() {
  const t = dzis(), n = S.zakupy.zakres || 1, od = n === -1 ? plus(t, 1) : t, ile = n === -1 ? 1 : n;
  const suma = {};
  for (let i = 0; i < ile; i++) { const d = plus(od, i); for (const [s] of sloty()) { const p = posilekDnia(d, s); if (!p) continue; for (const [k, g] of p.ing) suma[k] = (suma[k] || 0) + g; } }
  return { suma, od, ile };
}
const gZak = (suma, k) => Math.round(suma[k] / (suma[k] >= 50 ? 5 : 1)) * (suma[k] >= 50 ? 5 : 1);
function doKupienia() { const { suma } = listaZakupow(); return Object.keys(suma).filter(k => F[k] && F[k].cat !== 'przyprawy' && !S.zakupy.ok[k]).length + wlasne().filter(w => !w.ok).length; }
/* ---------- zakupy: ile kupić w sklepie (opakowania, Mateusz 24.11) ---------- */
const OPAK = { platki_owsiane: [500, 'o'], musli_bez_cukru: [400, 'o'], chleb_razowy: [500, 'bo'], tortilla_pelnoziarnista: [360, 'o'], makaron_pelnoziarnisty: [500, 'o'], makaron_penne: [500, 'o'],
  ryz_bialy: [400, 'o'], ryz_brazowy: [400, 'o'], kasza_gryczana: [400, 'o'], kasza_jaglana: [400, 'o'], kasza_jeczmienna: [400, 'o'], maka_pszenna: [1000, 'o'], chrupkie_pieczywo: [200, 'o'],
  mleko_2: [1000, 'ka'], jogurt_naturalny: [400, 'ku'], jogurt_grecki: [400, 'ku'], kefir: [400, 'bu'], twarog_polotlusty: [250, 'ks'], twarog_chudy: [250, 'ks'], serek_wiejski: [200, 'ku'],
  ser_feta: [200, 'ks'], mozzarella: [125, 'kl'], ser_parmezan: [100, 'kw'], ser_zolty: [150, 'o'], maslanka: [1000, 'bu'], maslo: [200, 'ks'], smietana_18: [200, 'ku'],
  szynka_drobiowa: [100, 'o'], tunczyk_w_wodzie: [120, 'pu'], sledz_filet: [200, 'o'], kapusta_kiszona: [500, 'o'], szpinak: [150, 'o'], rukola: [100, 'o'], groszek_zielony: [450, 'o'],
  kukurydza_konserwowa: [285, 'pu'], mieszanka_warzyw: [450, 'o'], pieczarki: [250, 'o'], czosnek: [50, 'gl'], natka_pietruszki: [30, 'pe'], szczypiorek: [20, 'pe'], rzodkiewka: [150, 'pe'],
  seler_naciowy: [400, 'pe'], truskawki: [250, 'o'], maliny: [125, 'o'], borowki: [125, 'o'], sliwki_suszone: [200, 'o'], rodzynki: [100, 'o'], daktyle: [200, 'o'],
  ciecierzyca: [240, 'pu'], fasola_czerwona: [240, 'pu'], fasola_biala: [240, 'pu'], soczewica_czerwona: [400, 'o'], hummus: [200, 'o'], tofu: [180, 'ks'],
  oliwa: [500, 'bu'], olej_rzepakowy: [1000, 'bu'], migdaly: [100, 'o'], orzechy_wloskie: [150, 'o'], siemie_lniane: [200, 'o'], pestki_slonecznika: [100, 'o'], pestki_dyni: [100, 'o'],
  chia: [200, 'o'], maslo_orzechowe: [350, 'sl'], sezam: [100, 'o'], miod: [400, 'sl'], koncentrat_pomidorowy: [200, 'sl'], pomidory_w_puszce: [400, 'pu'], passata: [500, 'bu'],
  bulion_warzywny: [1000, 'ka'], oliwki: [160, 'sl'], sos_sojowy: [150, 'bu'], mleko_kokosowe: [400, 'pu'], musztarda: [180, 'sl'], ocet_balsamiczny: [250, 'bu'],
  brokul: [400, 'sz'], kalafior: [800, 'gl'], kapusta_biala: [1500, 'gl'], kapusta_pekinska: [800, 'gl'], salata: [150, 'gl'], por: [200, 'sz'], seler_korzen: [500, 'sz'], baklazan: [300, 'sz'], dynia: [1000, 'sz'] };
const FORMY = { o: ['opakowanie', 'opakowania', 'opakowań'], bo: ['bochenek', 'bochenki', 'bochenków'], ka: ['karton', 'kartony', 'kartonów'], ku: ['kubek', 'kubki', 'kubków'],
  bu: ['butelka', 'butelki', 'butelek'], ks: ['kostka', 'kostki', 'kostek'], kl: ['kulka', 'kulki', 'kulek'], kw: ['kawałek', 'kawałki', 'kawałków'], pu: ['puszka', 'puszki', 'puszek'],
  gl: ['główka', 'główki', 'główek'], pe: ['pęczek', 'pęczki', 'pęczków'], sl: ['słoik', 'słoiki', 'słoików'], sz: ['sztuka', 'sztuki', 'sztuk'] };
const gramy = g => g >= 1000 ? fN(g / 1000, 2) + ' kg' : g + ' g';
function ileKupic(k, g) {
  const f = F[k]; if (f && f.cat === 'przyprawy') return ['sprawdź, czy masz', ''];
  const o = OPAK[k]; if (o) { const n = Math.max(1, Math.ceil(g / o[0] - .1)); const fo = o[1], dop = ['sz', 'gl', 'pe', 'bo'].includes(fo) ? '' : ['bu', 'ka'].includes(fo) ? `po ${o[0] >= 1000 ? fN(o[0] / 1000, 2) + ' l' : o[0] + ' ml'}` : `po ${gramy(o[0])}`; return [`${n} ${odm(n, ...FORMY[fo])}`, dop]; }
  if (f && f.szt) { const n = Math.max(1, Math.ceil(g / f.szt - .15)); return [`${n} ${odm(n, ...FORMY.sz)}`, '']; }
  return [gramy(g < 50 ? Math.ceil(g / 10) * 10 : g < 500 ? Math.ceil(g / 50) * 50 : Math.ceil(g / 100) * 100), ''];
}
const wlasne = () => S.zakupy.wlasne || (S.zakupy.wlasne = []);
function ekranZakupy() {
  const { suma, od, ile } = listaZakupow();
  const ok = S.zakupy.ok, z = S.zakupy.zakres || 1, wl = wlasne();
  const klucze = Object.keys(suma).filter(k => F[k]);
  const alfa = (a, b) => F[a].n.localeCompare(F[b].n, 'pl');
  const rz = (act, v, on, foto, nazwa, il, dop, x = '') => `<li class="${on ? 'on' : ''}" data-act="${act}" data-v="${v}" role="checkbox" aria-checked="${on}" tabindex="0">${foto}<span class="nm"><b>${esc(nazwa)}</b><small>${il}${dop ? ` <i>· ${dop}</i>` : ''}</small></span>${x}<span class="bx">${ik('ok')}</span></li>`;
  const wiersz = k => { const [il, dop] = ileKupic(k, gZak(suma, k)), c = kosztPoz(k, gZak(suma, k)); return rz('kup', k, !!ok[k], ikonaSkl(k), F[k].n, il, [dop, c ? zl(c) : ''].filter(Boolean).join(' · ')); };
  const wWl = w => rz('wl-kup', w.id, !!w.ok, `<span class="iks wl">${ik('plus')}</span>`, w.n, 'dopisane przez Ciebie', '', `<button class="wl-x" data-act="wl-usun" data-v="${w.id}" aria-label="Usuń: ${esc(w.n)}">${ik('x')}</button>`);
  const sekcja = (nazwa, el, kup, wsz) => el.length ? `<div class="kat"><h3>${nazwa}</h3><em>${kup}/${wsz}</em></div><ul class="card ing shop">${el.join('')}</ul>` : '';
  const wlDo = wl.filter(w => !w.ok);
  const grupy = sekcja('Dopisane', wlDo.map(wWl), wl.length - wlDo.length, wl.length) + KAT.map(([c, nazwa]) => {
    const all = klucze.filter(k => F[k].cat === c), el = all.filter(k => !ok[k]).sort(alfa);
    return sekcja(nazwa, el.map(wiersz), all.length - el.length, all.length);
  }).join('');
  const kupione = klucze.filter(k => ok[k]).sort(alfa).map(wiersz).concat(wl.filter(w => w.ok).map(wWl));
  const koszyk = kupione.length ? `<details class="koszyk"${U.koszyk ? ' open' : ''}><summary>${ik('ok')}W koszyku (${kupione.length})</summary><ul class="card ing shop">${kupione.join('')}</ul><button class="btn sec" style="margin-top:10px" data-act="kup-czysc">Odznacz wszystko</button></details>` : '';
  const doKup = klucze.filter(k => F[k].cat !== 'przyprawy'), wsz = doKup.length + wl.length, kup = doKup.filter(k => ok[k]).length + wl.filter(w => w.ok).length;
  const proc = wsz ? (kup / wsz * 100).toFixed(1) + '%' : '0%';
  const koszt = klucze.reduce((a, k) => a + kosztPoz(k, gZak(suma, k)), 0), kosztZost = klucze.filter(k => !ok[k]).reduce((a, k) => a + kosztPoz(k, gZak(suma, k)), 0);
  const cenaK = koszt ? `<div class="card koszt"><span class="hint-ik">${ik('moneta')}</span><div><b>Szacunkowo ${zl(koszt)}</b><small>${kosztZost && kosztZost < koszt - .5 ? `Zostało do kupienia: ${zl(kosztZost)}. ` : ''}Ceny orientacyjne: ${CENY_DATA}, duże sklepy. W Twoim sklepie mogą być inne.${wl.length ? ' Bez dopisanych produktów.' : ''}</small></div></div>` : '';
  const zakresTxt = ile === 1 ? opisDnia(od) : `${krotko(od)} – ${krotko(plus(od, ile - 1))}`;
  const dopisz = `<form class="dopisz" data-form="wl"><input class="inp" id="wl-n" placeholder="Dopisz swój produkt, np. kawa" autocomplete="off" maxlength="40" enterkeyhint="done" aria-label="Dopisz swój produkt"><button type="submit" class="btn" aria-label="Dopisz">${ik('plus')}</button></form>`;
  const tresc = !klucze.length && !wl.length ? dopisz + pusty('zakupy', 'Lista jest pusta', 'Najpierw zajrzyj do planu posiłków albo dopisz coś powyżej.', `<button class="btn" data-act="tab" data-v="plan">Przejdź do planu</button>`)
    : `${dopisz}<div class="postep" role="status"><div>${wsz - kup ? `<b>${kup}</b> z ${wsz} w koszyku` : `<b>Wszystko kupione</b>`}</div><div class="bar"><i ${anim('zak', 'width', 'width', proc, '0%')}></i></div></div>
      ${cenaK}${grupy}${koszyk}`;
  return naglowek(zakresTxt, 'Lista zakupów', klucze.length || wl.length ? `<button class="ico-btn lab" data-act="wyslij" aria-label="Wyślij listę">${ik('udost')}<span>Wyślij</span></button>` : '') + `<div class="wrap">
  <div class="seg">${[[1, 'Dziś'], [-1, 'Jutro'], [3, '3 dni'], [7, 'Tydzień']].map(([v, n]) => `<button class="${z === v ? 'on' : ''}" data-act="zakres" data-v="${v}" aria-pressed="${z === v}">${n}</button>`).join('')}</div>
  ${tresc}</div>`;
}

function ekranWaga() {
  const w = S.waga, p = S.profil;
  const teraz = wagaTeraz(), start = w.length ? w[0].kg : p.waga, zm = teraz - start;
  const cel = S.celWagi, bmi = teraz / ((p.wzrost / 100) ** 2);
  const ost = w[w.length - 1], dzisW = ost && ost.d === dzis();
  const odD = plus(dzis(), -({ m: 31, '3m': 92, all: 1e5 }[U.wz] || 92));
  const TR = trendWagi(), ww = TR.filter(x => x.d >= odD);
  let wykres = pusty('waga', 'Tu będzie wykres', 'Wpisuj wagę raz w tygodniu, rano na czczo. Po dwóch wpisach zobaczysz linię.', `<button class="btn" data-act="waga-dodaj">${ik('plus')}Dodaj wagę</button>`);
  if (ww.length >= 2) {
    const W = 340, H = 180, L = 36, Rr = 12, T = 14, B = 28;
    const t0 = zIso(ww[0].d).getTime(), t1 = Math.max(t0 + 864e5, zIso(ww[ww.length - 1].d).getTime());
    const vals = ww.map(x => x.kg).concat(ww.map(x => x.tr), cel ? [cel] : []);
    const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
    const X = t => L + (t - t0) / (t1 - t0) * (W - L - Rr), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const pts = ww.map(x => [X(zIso(x.d).getTime()), Y(x.tr)]), kr = ww.map(x => [X(zIso(x.d).getTime()), Y(x.kg)]);
    const krok = Math.max(1, Math.ceil((hi - lo) / 4));
    let siatka = ''; for (let v = lo; v <= hi; v += krok) siatka += `<line x1="${L}" x2="${W - Rr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
    const linia = pts.map(q => q.join(',')).join(' ');
    const pole = `M${pts[0][0]},${H - B} L${linia.replace(/ /g, ' L')} L${pts[pts.length - 1][0]},${H - B} Z`;
    wykres = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Wykres wagi">${siatka}
      ${cel ? `<line x1="${L}" x2="${W - Rr}" y1="${Y(cel)}" y2="${Y(cel)}" stroke="var(--gold)" stroke-width="2" stroke-dasharray="5 5"/><text x="${W - Rr}" y="${Y(cel) - 6}" text-anchor="end">cel ${fN(cel)}</text>` : ''}
      <path d="${pole}" fill="var(--green)" fill-opacity=".12" stroke="none"/>
      ${kr.map((q, i) => `<line x1="${q[0]}" x2="${q[0]}" y1="${q[1]}" y2="${pts[i][1]}" stroke="var(--muted)" stroke-opacity=".35" stroke-width="1.5"/>`).join('')}
      <polyline points="${linia}" stroke="var(--green)" stroke-width="4" fill="none"/>
      <circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="5.5" fill="var(--green)"/>
      ${kr.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="3.5" fill="var(--card)" stroke="var(--muted)" stroke-width="2"/><circle class="hit" cx="${q[0]}" cy="${q[1]}" r="16" data-act="punkt" data-v="${opisDnia(ww[i].d)} · ważenie ${fN(ww[i].kg)} kg · trend ${fN(ww[i].tr)} kg"/>`).join('')}
      <text x="${L}" y="${H - 6}">${krotko(ww[0].d)}</text><text x="${W - Rr}" y="${H - 6}" text-anchor="end">${krotko(ww[ww.length - 1].d)}</text></svg>
      <div class="leg"><span><i class="l-tr"></i>linia trendu</span><span><i class="l-kr"></i>ważenie</span></div>
      <p class="note center" style="margin:2px 0 0">Dotknij kropki, żeby zobaczyć wpis.</p>`;
  }
  /* linia trendu słowami: ile od miesiąca (albo od pierwszego wpisu) */
  let trendTxt = '';
  if (TR.length >= 2) {
    const tN = TR[TR.length - 1].tr, d0 = TR.find(x => x.d >= plus(dzis(), -28)) || TR[0], od = d0 === TR[TR.length - 1] ? TR[TR.length - 2] : d0, r = tN - od.tr;
    trendTxt = `<div class="card trend-i"><span class="hint-ik">${ik('waga')}</span><div><b>Linia trendu: ${fN(tN)} kg</b><p>Od ${dataSlownie(od.d)}: <b style="color:${kolorZm(r)}">${zmTxt(r)}</b>. ${Math.abs(r) < .3 ? 'Waga stoi w miejscu, to też dobrze, gdy trzymasz plan.' : 'To średnia, która wygładza codzienne skoki wagi.'}</p></div></div>`;
  }
  const doCelu = cel ? teraz - cel : null;
  const lista = [...w].reverse().slice(0, 12).map((x, i, a) => { const prev = a[i + 1]; const r = prev ? x.kg - prev.kg : 0;
    return `<li><span>${opisDnia(x.d)}</span><span class="wr">${fN(x.kg)} kg ${prev ? `<small style="color:${kolorZm(r)}">${r > 0 ? '+' : r < 0 ? '−' : ''}${fN(Math.abs(r))}</small>` : ''}<button class="ico44" data-act="waga-usun" data-v="${x.d}" aria-label="Usuń wpis z ${opisDnia(x.d)}">${ik('kosz')}</button></span></li>`; }).join('');
  return naglowek(`BMI ${fN(bmi)}`, 'Waga i postępy') + `<div class="wrap">
  <div class="stat3"><div><b>${fN(teraz)}</b>kg teraz</div><div><b style="color:${kolorZm(zm)}">${zm > 0 ? '+' : zm < 0 ? '−' : ''}${fN(Math.abs(zm))}</b>kg od startu</div><div><b>${doCelu === null ? '–' : fN(Math.max(0, doCelu))}</b>${doCelu === null ? 'brak celu' : 'kg do celu'}</div></div>
  <button class="btn" data-act="waga-dodaj">${ik('plus')}${dzisW ? 'Popraw dzisiejszą wagę' : 'Dodaj dzisiejszą wagę'}</button>
  ${w.length >= 2 ? `<div class="seg" style="margin-top:16px">${[['m', 'Miesiąc'], ['3m', '3 miesiące'], ['all', 'Wszystko']].map(([v, n]) => `<button class="${U.wz === v ? 'on' : ''}" data-act="wz" data-v="${v}" aria-pressed="${U.wz === v}">${n}</button>`).join('')}</div>` : ''}
  <div class="card chart" style="margin-top:10px">${wykres}</div>
  ${trendTxt}
  <h3>Waga docelowa</h3>
  <div class="row"><input class="inp" id="cel-wagi" type="text" inputmode="decimal" placeholder="np. ${fN(Math.round(teraz - 5))}" value="${cel ? fN(cel) : ''}" aria-label="Waga docelowa w kilogramach"><button class="btn sec auto" data-act="cel-zapisz">Ustaw</button></div>
  ${lista ? `<h3>Ostatnie wpisy</h3><ul class="card ing wlist">${lista}</ul>` : ''}
  <p class="note" style="margin-top:12px">Zdrowe tempo to 0,5–1 kg na tydzień. Waga skacze z dnia na dzień o 1–2 kg przez wodę. Linia trendu to średnia, która te skoki wygładza, więc patrz na nią, a nie na pojedyncze kropki.</p></div>`;
}

/* ---------- pierwsze uruchomienie: 4 kroki, jedno pytanie na ekran ---------- */
const wybory = (lista, wyb, attrs, ikony) => lista.map(([v, n, o]) => `<button class="card alt wyb${wyb === v ? ' on' : ''}" ${attrs(v)} aria-pressed="${wyb === v}">${ikony ? `<span class="di">${ik(ikony[v])}</span>` : ''}<span class="info"><span class="mn">${n}</span><span class="mk">${o}</span></span><span class="okk">${ik('ok')}</span></button>`).join('');
const dietyLista = () => Object.entries(DIETY).map(([v, d]) => [v, d.n, d.o]);
function powitanie() {
  const k = U.krok, s = U.szkic, N = 4, bl = U.bledy || {};
  const gora = `<div class="onb-top"><span>Krok ${k + 1} z ${N}</span><div class="bar"><i style="width:${(k + 1) / N * 100}%"></i></div></div>`;
  const dol = (dalej, akcja = 'onb-dalej', nad = '') => `<div class="dol">${nad}<div class="row">${k ? `<button class="btn sec" data-act="onb-wstecz">${ik('lewo')}Wstecz</button>` : ''}<button class="btn" data-act="${akcja}">${dalej}</button></div></div>`;
  const pole = (id, klucz, label, attrs, ph) => `<div class="field"><label for="${id}">${label}</label><input class="inp${bl[klucz] ? ' bad' : ''}" id="${id}" ${attrs} value="${esc(s[klucz] || '')}" placeholder="${ph}"${bl[klucz] ? ` aria-invalid="true" aria-describedby="${id}-b"` : ''}>${bl[klucz] ? `<div class="err" id="${id}-b">${bl[klucz]}</div>` : ''}</div>`;
  if (k === 0) return `<div class="wrap onb">${gora}<div class="onb-foto">${talerz(RB.owsianka_jablko || R[0], true)}</div><div class="big">Twój plan jedzenia, ułożony pod Ciebie</div>
    <p class="lead">Codziennie gotowe posiłki z przepisami, lista zakupów do sklepu i wykres wagi. Wszystko zostaje w tym telefonie.</p>
    ${pole('o-imie', 'imie', 'Jak masz na imię?', 'autocomplete="given-name"', 'np. Anna')}
    <div class="field"><label>Jak duże mają być litery?</label><div class="seg">${[[false, 'Normalne'], [true, 'Duże']].map(([v, n]) => `<button class="${!!S.duze === v ? 'on' : ''}" data-act="duze" data-v="${v}" aria-pressed="${!!S.duze === v}"><span class="aa${v ? ' duze' : ''}">Aa</span>${n}</button>`).join('')}</div></div>
    ${dol(`Dalej${ik('prawo')}`)}</div>`;
  if (k === 1) return `<div class="wrap onb">${gora}<div class="big">Kilka liczb o Tobie</div>
    <p class="lead">Z nich policzę, ile kalorii dziennie potrzebujesz.</p>
    <div class="field"><label>Płeć</label><div class="seg">${[['k', 'Kobieta'], ['m', 'Mężczyzna']].map(([v, n]) => `<button class="${(s.plec || 'k') === v ? 'on' : ''}" data-act="szkic" data-k="plec" data-v="${v}">${n}</button>`).join('')}</div></div>
    <div class="grid2">${pole('o-wiek', 'wiek', 'Wiek (lata)', 'type="text" inputmode="numeric"', 'np. 58')}${pole('o-wzrost', 'wzrost', 'Wzrost (cm)', 'type="text" inputmode="numeric"', 'np. 164')}</div>
    ${pole('o-waga', 'waga', 'Waga teraz (kg)', 'type="text" inputmode="decimal"', 'np. 72,5')}
    <div class="field"><label>Ile ruchu na co dzień?</label>${wybory(AKT.map((a, i) => [i, a.n, a.o]), s.akt ?? 1, v => `data-act="szkic" data-k="akt" data-v="${v}"`)}</div>
    ${dol(`Dalej${ik('prawo')}`)}</div>`;
  const prof = profilZeSzkicu();
  const stare = S.profil; S.profil = prof; const kc = zapotrzebowanie(); S.profil = stare;
  if (k === 2) return `<div class="wrap onb">${gora}<div class="big">Twój cel</div>
    <p class="lead">Możesz go potem zmienić w ustawieniach.</p>
    <div class="field">${wybory([['schudnac', 'Schudnąć', 'Plan z lekkim niedoborem kalorii'], ['utrzymac', 'Utrzymać wagę', 'Tyle, ile spalasz'], ['przytyc', 'Przytyć', 'Trochę więcej niż spalasz']], prof.cel, v => `data-act="szkic" data-k="cel" data-v="${v}"`)}</div>
    ${prof.cel === 'schudnac' ? `<div class="field"><label>Jak szybko?</label><div class="seg">${[[.25, 'Łagodnie'], [.5, 'Zwykle'], [.75, 'Szybciej']].map(([v, n]) => `<button class="${prof.tempo === v ? 'on' : ''}" data-act="szkic" data-k="tempo" data-v="${v}">${n}<small>${fN(v, 2)} kg/tydz.</small></button>`).join('')}</div></div>` : ''}
    ${dol(`Dalej${ik('prawo')}`)}</div>`;
  return `<div class="wrap onb">${gora}<div class="big">Jak lubisz jeść?</div>
    <p class="lead">Wybierz rodzaj diety. Przepisy dobiorę pod nią.</p>
    <div class="field">${wybory(dietyLista(), s.dieta || 'standard', v => `data-act="szkic" data-k="dieta" data-v="${v}"`, DIK)}</div>
    ${dol('Zaczynamy', 'onb-koniec', `<div class="kcal-mini">Twój plan: <b>${fK(kc)} kcal</b> dziennie</div>`)}</div>`;
}
function profilZeSzkicu() {
  const s = U.szkic;
  return { imie: (s.imie || '').trim(), plec: s.plec || 'k', wiek: +s.wiek || 50, wzrost: +s.wzrost || 165, waga: +String(s.waga || '').replace(',', '.') || 70,
    akt: s.akt ?? 1, cel: s.cel || 'schudnac', tempo: s.tempo ?? .5, kcalWlasne: null };
}
function czytajPola() {
  const g = id => { const e = document.getElementById(id); return e ? e.value : undefined; };
  for (const [id, k] of [['o-imie', 'imie'], ['o-wiek', 'wiek'], ['o-wzrost', 'wzrost'], ['o-waga', 'waga']]) { const v = g(id); if (v !== undefined) U.szkic[k] = v; }
}

/* ---------- arkusze: stos z obsługą przycisku „wstecz” telefonu ---------- */
let zegarZamk = null, blokada = null;
function otworz(fn) {
  U.stos.push(fn); history.pushState({ ark: U.stos.length }, '');
  const sh = document.getElementById('sheet'); clearTimeout(zegarZamk);
  sh.classList.remove('out'); sh.hidden = false; document.body.style.overflow = 'hidden';
  odswiezArkusz(true);
}
function odswiezArkusz(odGory) {
  const fn = U.stos[U.stos.length - 1]; if (!fn) return;
  const box = document.querySelector('.sheet-box');
  document.getElementById('sheet-in').innerHTML = `<button class="sheet-x" data-act="zamknij" aria-label="Zamknij">${ik('x')}</button>` + fn();
  gotoweFoto(box);
  if (odGory) box.scrollTop = 0;
  ekranNieGasnie(!!fn.gotuj);
  skaner(!!fn.skan);
}
function schowajArkusz() {
  const sh = document.getElementById('sheet'); U.kasuj = false; sh.classList.add('out'); document.body.style.overflow = '';
  clearTimeout(zegarZamk); zegarZamk = setTimeout(() => { sh.hidden = true; sh.classList.remove('out'); document.querySelector('.sheet-box').style.transform = ''; }, 200);
  ekranNieGasnie(false); skanStop();
}
function cofnij(n) { if (n > 0) { U.pomin++; history.go(-n); } }
function zamknij() { const n = U.stos.length; if (!n) return; U.stos = []; schowajArkusz(); cofnij(n); }
/* zamyka wszystko i wraca na Plan jednym krokiem historii */
function naPlan() { const n = U.stos.length + (U.tab !== 'plan' ? 1 : 0); if (U.stos.length) { U.stos = []; schowajArkusz(); } U.tab = 'plan'; cofnij(n); }
const PRZEW = {};
function pokazTab() { widok(); scrollTo(0, PRZEW[U.tab] || 0); wejscie(); const b = document.querySelector('.nav button.on'); if (b) b.classList.add('nowa'); }
function ustawTab(v) {
  if (v === U.tab) { scrollTo({ top: 0, behavior: 'smooth' }); return; }
  PRZEW[U.tab] = scrollY;
  if (v === 'plan') naPlan(); else { if (U.tab === 'plan') history.pushState({ tab: v }, ''); else history.replaceState({ tab: v }, ''); U.tab = v; }
  pokazTab();
}
window.addEventListener('popstate', () => {
  if (U.pomin > 0) { U.pomin--; return; }
  if (U.stos.length) { U.stos.pop(); U.kasuj = false; if (U.stos.length) odswiezArkusz(true); else schowajArkusz(); return; }
  if (U.tab !== 'plan') { PRZEW[U.tab] = scrollY; U.tab = 'plan'; pokazTab(); }
});
async function ekranNieGasnie(on) {
  try {
    if (on && !blokada && navigator.wakeLock) { blokada = await navigator.wakeLock.request('screen'); blokada.addEventListener('release', () => { blokada = null; }); }
    else if (!on && blokada) { const b = blokada; blokada = null; await b.release(); }
  } catch (e) {}
}
const wroc = t => `<button class="wroc" data-act="wstecz">${ik('lewo')}${t}</button>`;

function arkuszPrzepis(id, d, s) {
  return () => {
    const r = RB[id]; if (!r) return '';
    const wPlanie = !!(d && s); const f = wPlanie ? mnoznik(r, s) : 1;
    const ing = skaluj(r, f), w = wartosci(ing), ul = S.ulub.includes(id), zj = wPlanie && (S.zjedz[d] || {})[s];
    const tagi = { wege: 'Bez mięsa', lowcarb: 'Mniej węgli', srodz: 'Śródziemnomorskie', tania: 'Tanie', fit: 'Dużo białka' };
    const akcje = wPlanie
      ? `<button class="btn sec" data-act="wymien" data-d="${d}" data-s="${s}">${ik('swap')}Wymień</button><button class="btn${zj ? ' sec' : ''}" data-act="zjedz" data-d="${d}" data-s="${s}">${ik('ok')}${zj ? 'Odznacz' : 'Zjedzone'}</button>`
      : `<button class="btn" data-act="wstaw-wybor" data-v="${id}">${ik('plus')}Dodaj do planu</button>`;
    return `<div class="hero">${talerz(r, true)}<button class="heart na-foto${ul ? ' on' : ''}" data-act="ulub" data-v="${id}" aria-label="${ul ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}" aria-pressed="${ul}">${ik('serce')}</button></div>
    ${wPlanie ? `<div class="mt" style="margin-top:14px">${ik(s)}${slotInfo(s)[1]} · ${opisDnia(d)}</div>` : ''}
    <h2 style="margin-top:${wPlanie ? 4 : 14}px">${esc(r.n)}</h2>
    <div class="meta"><span class="tag">${ik('zegar')}${r.t} min</span>${r.smaz ? '' : '<span class="tag">Bez smażenia</span>'}${(r.d || []).map(t => tagi[t] ? `<span class="tag">${tagi[t]}</span>` : '').join('')}</div>
    <div class="macros"><div><b>${Math.round(w.k)}</b>kcal</div><div><b>${Math.round(w.b)}</b>białko g</div><div><b>${Math.round(w.t)}</b>tłuszcz g</div><div><b>${Math.round(w.w)}</b>węgle g</div></div>
    ${wPlanie && Math.abs(f - 1) > .05 ? `<p class="note">Porcja przeliczona pod Twój plan (×${fN(f, 2)} przepisu podstawowego).</p>` : ''}
    <h3>Składniki</h3><ul class="card ing">${ing.map(([k, g]) => `<li><span class="nm2">${ikonaSkl(k)}<span>${esc(F[k] ? F[k].n : k)}</span></span><span>${ilosc(k, g)}</span></li>`).join('')}</ul>
    <div class="h3row"><h3>Przygotowanie</h3>${(r.kroki || []).length > 1 ? `<button class="lnk" data-act="gotuj" data-v="${id}">${ik('garnek')}Gotuję krok po kroku</button>` : ''}</div>
    <ol class="steps">${(r.kroki || []).map(k => `<li><span>${esc(k)}</span></li>`).join('')}</ol>
    <div class="akcje">${akcje}</div>`;
  };
}
function arkuszWstaw(id) {
  return () => {
    const r = RB[id], pory = sloty().filter(([x]) => r.m.includes(typ(x)));
    return `${wroc('Wróć do przepisu')}<h2>Kiedy to zjesz?</h2><p class="note">${esc(r.n)} zastąpi posiłek z planu.</p>
    ${pory.length ? [dzis(), plus(dzis(), 1)].map((dd, i) => `<h3>${i ? 'Jutro' : 'Dziś'}</h3><div class="grid2">${pory.map(([x, n]) => `<button class="btn sec" data-act="wstaw" data-v="${id}" data-d="${dd}" data-s="${x}">${ik(x)}${n}</button>`).join('')}</div>`).join('')
      : `<p>W Twoim planie nie ma pory na takie danie. Możesz zmienić liczbę posiłków w ustawieniach.</p>`}`;
  };
}
function arkuszWymien(d, s) {
  return () => {
    const obecny = (planDnia(d)[s] || {}).id, ro = RB[obecny];
    const kO = ro ? wartosci(skaluj(ro, mnoznik(ro, s))).k : 0;
    const alt = pula(s).filter(r => r.id !== obecny).sort((a, b) => ocena(a, d, s) - ocena(b, d, s)).slice(0, 10);
    return `${U.stos.length > 1 ? wroc('Wróć do przepisu') : ''}<h2>Na co wymienić?</h2><p class="note" style="margin:4px 0 14px">${slotInfo(s)[1]} · ${opisDnia(d)}${ro ? `. Teraz: ${esc(ro.n)}, ${Math.round(kO)} kcal` : ''}. Porcje już przeliczone pod Twój plan.</p>
    ${alt.map(r => { const k = wartosci(skaluj(r, mnoznik(r, s))).k, roz = Math.round(k - kO);
      return `<button class="card alt" data-act="wybierz" data-v="${r.id}" data-d="${d}" data-s="${s}">${talerz(r)}<span class="info"><span class="mn">${esc(r.n)}</span><span class="mk">${Math.round(k)} kcal · ${r.t} min${ro && Math.abs(roz) >= 10 ? ` · <span class="roz">${roz > 0 ? '+' : '−'}${Math.abs(roz)} kcal</span>` : ''}</span></span></button>`; }).join('')}
    <button class="btn sec" data-act="${U.stos.length > 1 ? 'wstecz' : 'zamknij'}" style="margin-top:6px">Zostaw jak jest</button>`;
  };
}
function arkuszGotuj(id) {
  const fn = () => {
    const r = RB[id], k = r.kroki || [], i = Math.max(0, Math.min(U.gk, k.length - 1));
    return `${wroc('Wróć do przepisu')}<div class="gotuj"><div class="mt">${esc(r.n)} · krok ${i + 1} z ${k.length}</div><div class="dots">${k.map((_, j) => `<i class="${j === i ? 'on' : j < i ? 'by' : ''}"></i>`).join('')}</div>
      <p class="krok">${esc(k[i])}</p>
      <div class="row"><button class="btn sec" data-act="gk" data-v="-1"${i === 0 ? ' disabled' : ''}>${ik('lewo')}Wstecz</button>${i < k.length - 1 ? `<button class="btn" data-act="gk" data-v="1">Dalej${ik('prawo')}</button>` : `<button class="btn" data-act="wstecz">${ik('ok')}Gotowe</button>`}</div>
      ${navigator.wakeLock ? '<p class="note center" style="margin-top:14px">Ekran nie zgaśnie, dopóki gotujesz.</p>' : ''}</div>`;
  };
  fn.gotuj = true; return fn;
}
function arkuszExtra() {
  return () => { const ost = Object.entries(skany()).sort((a, b) => b[1].d - a[1].d).slice(0, 6); return `<h2>Co zjadłaś poza planem?</h2><p class="note" style="margin:4px 0 14px">Zeskanuj kod z opakowania, wybierz z listy albo wpisz nazwę i kalorie.</p>
    <button class="btn skan-btn" data-act="skan">${ik('kod')}Zeskanuj kod kreskowy</button>
    ${ost.length ? `<h3 style="margin-top:16px">Ostatnio skanowane</h3><div class="chips wrapc">${ost.map(([k, p]) => `<button class="chip" data-act="skan-pokaz" data-v="${k}">${esc(p.n)} · ${p.k} kcal/100 g</button>`).join('')}</div><h3 style="margin-top:16px">Szybkie dodanie</h3>` : ''}
    <div class="chips wrapc">${[['Kawa z mlekiem', 40], ['Jabłko', 80], ['Ciastko', 150], ['Kawałek ciasta', 300], ['Garść orzechów', 180], ['Kromka chleba z masłem', 130], ['Lody (gałka)', 120], ['Lampka wina', 120]].map(([n, k]) => `<button class="chip" data-act="extra-szybko" data-n="${n}" data-k="${k}">${n} · ${k}</button>`).join('')}</div>
    <div class="field" style="margin-top:14px"><label for="ex-n">Nazwa</label><input class="inp" id="ex-n" placeholder="np. pączek"></div>
    <div class="field"><label for="ex-k">Kalorie</label><input class="inp" id="ex-k" type="text" inputmode="numeric" placeholder="kcal"></div>
    <button class="btn" data-act="extra-zapisz">Dodaj</button>`; };
}
function arkuszWaga() {
  return () => `<h2>Dzisiejsza waga</h2><p class="note" style="margin:4px 0 14px">Najlepiej rano, na czczo, zawsze o tej samej porze.</p>
    <div class="waga-in"><input class="inp" id="nowa-waga" type="text" inputmode="decimal" placeholder="${fN(wagaTeraz())}" aria-label="Waga w kilogramach"><span>kg</span></div>
    <button class="btn" data-act="waga-zapisz">Zapisz</button>`;
}
const SEK = [['dane', 'Dane o mnie', 'osoba'], ['dieta', 'Dieta i posiłki', 'obiad'], ['przyp', 'Przypomnienia', 'zegar'], ['wyk', 'Czego nie jem', 'zakaz'], ['wyglad', 'Wygląd', 'oko'], ['kopia', 'Kopia zapasowa', 'pobierz'], ['dane-plan', 'Plan i usuwanie danych', 'kosz']];
function arkuszUstawienia(sek) {
  return () => {
    const p = S.profil;
    if (!sek) {
      const opis = { dane: `${p.imie ? esc(p.imie) + ' · ' : ''}${p.wiek} lat · ${fK(kcalCel())} kcal dziennie`, dieta: `${DIETY[S.dieta].n} · ${S.posilki} ${odm(S.posilki, 'posiłek', 'posiłki', 'posiłków')}`,
        wyk: S.wyklucz.length ? esc(S.wyklucz.map(k => F[k] ? F[k].n : k).slice(0, 3).join(', ')) + (S.wyklucz.length > 3 ? '…' : '') : 'Jem wszystko',
        wyglad: `${(PALETY.find(p => p[0] === (S.paleta || 'a')) || PALETY[0])[1]} · litery ${S.duze ? 'duże' : 'normalne'} · ${{ auto: 'kolory jak w telefonie', light: 'jasne', dark: 'ciemne' }[S.motyw]}`, kopia: kopiaOpis(), 'dane-plan': 'Ułóż plan od nowa, usuń dane',
        przyp: S.przyp && S.przyp.dodane ? `W kalendarzu od ${dataSlownie(S.przyp.dodane)}` : 'O posiłkach i ważeniu, w kalendarzu telefonu' };
      return `<h2>Ustawienia</h2><div class="card lista" style="margin-top:14px">${SEK.map(([k, n, i]) => `<button class="wiersz" data-act="ustawienia" data-v="${k}"><span class="wi">${ik(i)}</span><span class="wt"><b>${n}</b><small>${opis[k]}</small></span>${ik('prawo')}</button>`).join('')}</div>
        <button class="lnk" style="margin-top:8px" data-act="intro">${ik('zarowka')}Pokaż podpowiedzi jeszcze raz</button>`;
    }
    const g = (U.stos.length > 1 ? wroc('Ustawienia') : '') + `<h2>${SEK.find(x => x[0] === sek)[1]}</h2>`;
    if (sek === 'dane') { const kc = zapotrzebowanie(); return g + `<div style="margin-top:14px"></div>
      <div class="field"><label for="u-imie">Imię</label><input class="inp" id="u-imie" value="${esc(p.imie)}"></div>
      <div class="field"><label>Płeć</label><div class="seg">${[['k', 'Kobieta'], ['m', 'Mężczyzna']].map(([v, n]) => `<button class="${p.plec === v ? 'on' : ''}" data-act="prof" data-k="plec" data-v="${v}">${n}</button>`).join('')}</div></div>
      <div class="grid2"><div class="field"><label for="u-wiek">Wiek</label><input class="inp" id="u-wiek" type="text" inputmode="numeric" value="${p.wiek}"></div><div class="field"><label for="u-wzrost">Wzrost (cm)</label><input class="inp" id="u-wzrost" type="text" inputmode="numeric" value="${p.wzrost}"></div></div>
      <div class="field"><label for="u-akt">Ruch na co dzień</label><select class="inp" id="u-akt">${AKT.map((a, i) => `<option value="${i}" ${p.akt === i ? 'selected' : ''}>${a.n} — ${a.o}</option>`).join('')}</select></div>
      <div class="field"><label>Cel</label><div class="seg">${[['schudnac', 'Schudnąć'], ['utrzymac', 'Utrzymać'], ['przytyc', 'Przytyć']].map(([v, n]) => `<button class="${p.cel === v ? 'on' : ''}" data-act="prof" data-k="cel" data-v="${v}">${n}</button>`).join('')}</div></div>
      ${p.cel === 'schudnac' ? `<div class="field"><label>Tempo</label><div class="seg">${[[.25, 'Łagodnie'], [.5, 'Zwykle'], [.75, 'Szybciej']].map(([v, n]) => `<button class="${p.tempo === v ? 'on' : ''}" data-act="prof" data-k="tempo" data-v="${v}">${n}</button>`).join('')}</div></div>` : ''}
      <div class="field"><label for="u-kcal">Kalorie dziennie (wyliczone: ${fK(kc)})</label><input class="inp" id="u-kcal" type="text" inputmode="numeric" placeholder="zostaw puste, żeby liczyć samo" value="${p.kcalWlasne || ''}"></div>
      <button class="btn" data-act="prof-zapisz">Zapisz dane</button>`; }
    if (sek === 'dieta') return g + `<h3>Rodzaj diety</h3>${wybory(dietyLista(), S.dieta, v => `data-act="dieta" data-v="${v}"`, DIK)}
      <h3>Posiłki dziennie</h3><div class="seg">${[3, 4, 5].map(n => `<button class="${S.posilki === n ? 'on' : ''}" data-act="posilki" data-v="${n}" aria-pressed="${S.posilki === n}">${n}</button>`).join('')}</div>
      <p class="note" style="margin-top:10px">Po zmianie plan od dziś układa się od nowa. Przez chwilę możesz to cofnąć.</p>`;
    if (sek === 'wyk') { const q = U.wq.trim().toLowerCase();
      const wyniki = q.length >= 2 ? Object.entries(F).filter(([k, f]) => f.cat !== 'przyprawy' && !S.wyklucz.includes(k) && f.n.toLowerCase().includes(q)).slice(0, 8) : [];
      return g + `<p class="note" style="margin:4px 0 14px">Przepisów z tymi produktami nie będzie w planie ani na liście przepisów.</p>
      <div class="chips wrapc" style="margin-bottom:10px">${S.wyklucz.map(k => `<button class="chip on" data-act="wyk-usun" data-v="${k}" aria-label="Przywróć: ${esc(F[k] ? F[k].n : k)}">${esc(F[k] ? F[k].n : k)}${ik('x')}</button>`).join('') || '<span class="note">Nic nie wykluczono.</span>'}</div>
      <div class="search">${ik('szukaj')}<input class="inp" id="wyk-q" placeholder="Wpisz produkt, np. ryba, mleko…" value="${esc(U.wq)}" autocomplete="off"></div>
      <div id="wyk-wyniki">${wynikiWyk(wyniki)}</div>`; }
    if (sek === 'wyglad') return g + `<div class="field" style="margin-top:14px"><label>Wielkość liter</label><div class="seg">${[[false, 'Normalne'], [true, 'Duże']].map(([v, n]) => `<button class="${!!S.duze === v ? 'on' : ''}" data-act="duze" data-v="${v}" aria-pressed="${!!S.duze === v}"><span class="aa${v ? ' duze' : ''}">Aa</span>${n}</button>`).join('')}</div></div>
      <div class="field"><label>Kolory</label><div class="palety" role="radiogroup" aria-label="Zestaw kolorów">${PALETY.map(([v, n, bg, sec, acc]) => { const on = (S.paleta || 'a') === v; return `<button class="pal${on ? ' on' : ''}" data-act="paleta" data-v="${v}" role="radio" aria-checked="${on}"><span class="pr" style="background:${bg}"><i style="background:${sec}"></i><b style="background:${acc}"></b></span><span class="pn">${n}</span>${on ? ik('ok') : ''}</button>`; }).join('')}</div></div>
      <div class="field"><label>Jasność</label><div class="seg">${[['auto', 'Jak w telefonie'], ['light', 'Jasne'], ['dark', 'Ciemne']].map(([v, n]) => `<button class="${S.motyw === v ? 'on' : ''}" data-act="motyw" data-v="${v}" aria-pressed="${S.motyw === v}">${n}</button>`).join('')}</div></div>`;
    if (sek === 'kopia') return g + `<p class="note" style="margin:4px 0 14px">Dane są tylko w tym telefonie. Raz w miesiącu przypomnę Ci o kopii. Wyślij ją sobie e-mailem albo komuś bliskiemu, a po zmianie telefonu wczytasz ją tutaj.</p>
      <div class="card kopia-st"><span class="hint-ik">${ik(S.kopia && S.kopia.d ? 'ok' : 'zegar')}</span><b>${kopiaOpis()}</b></div>
      <button class="btn" data-act="kopia-wyslij">${ik('udost')}Wyślij kopię</button>
      <div class="row" style="margin-top:10px"><button class="btn sec" data-act="kopia">${ik('pobierz')}Zapisz w telefonie</button><label class="btn sec" for="wczytaj" style="cursor:pointer">Wczytaj kopię</label></div>
      <input type="file" id="wczytaj" accept="application/json,.json,text/plain,.txt" hidden>`;
    if (sek === 'przyp') { const pz = przyp(), sw = (on, act, v, n) => `<button class="sw${on ? ' on' : ''}" role="switch" aria-checked="${on}" data-act="${act}" data-v="${v}" aria-label="${n}"><i></i></button>`;
      return g + `<p class="note" style="margin:4px 0 14px">Przypomnienia trafią do kalendarza w telefonie, więc zadzwonią nawet przy zamkniętej aplikacji. Ustaw godziny i dotknij przycisku na dole.</p>
      <div class="card lista przyp">${sloty().map(([s, n]) => { const on = !pz.wyl.includes(s); return `<div class="pz${on ? '' : ' off'}"><span class="wi">${ik(s)}</span><b>${n}</b><input class="inp czas" type="time" id="pg-${s}" value="${pz.godz[s]}" aria-label="Godzina: ${n}"${on ? '' : ' disabled'}>${sw(on, 'pz-sw', s, n)}</div>`; }).join('')}
        <div class="pz${pz.waga.on ? '' : ' off'}"><span class="wi">${ik('waga')}</span><b>Ważenie</b><select class="inp dz" id="pg-wdz" aria-label="Dzień ważenia"${pz.waga.on ? '' : ' disabled'}>${[1, 2, 3, 4, 5, 6, 0].map(i => `<option value="${i}"${pz.waga.dzien === i ? ' selected' : ''}>${DNI_P[i]}</option>`).join('')}</select><input class="inp czas" type="time" id="pg-waga" value="${pz.waga.godz}" aria-label="Godzina ważenia"${pz.waga.on ? '' : ' disabled'}>${sw(pz.waga.on, 'pz-sw', 'waga', 'Ważenie')}</div></div>
      <button class="btn" style="margin-top:14px" data-act="kalendarz">${ik('plan')}Dodaj do kalendarza</button>
      <p class="note" style="margin-top:10px">${pz.dodane ? `Dodane ${dataSlownie(pz.dodane)}. Gdy zmienisz godziny, najpierw usuń stare przypomnienia w kalendarzu (otwórz jedno i wybierz „usuń wszystkie”), potem dodaj nowe.` : 'Telefon otworzy plik kalendarza. Dotknij „Dodaj wszystko” albo „Importuj”.'}</p>`; }
    return g + `<h3>Plan</h3><button class="btn sec" data-act="od-nowa">Ułóż plan od dziś od nowa</button>
      <h3>Dane</h3><button class="btn danger" data-act="kasuj">${U.kasuj ? 'Na pewno? Dotknij jeszcze raz, żeby usunąć wszystko' : 'Usuń wszystkie dane'}</button>
      <p class="note" style="margin-top:10px">Usunięcia nie da się cofnąć. Zrób wcześniej kopię zapasową.</p>`;
  };
}
const wynikiWyk = w => w.map(([k, f]) => `<button class="card alt" data-act="wyk-dodaj" data-v="${k}">${ikonaSkl(k)}<span class="mn" style="margin:0">${esc(f.n)}</span><span class="plusik">${ik('plus')}</span></button>`).join('');

/* ---------- akcje ---------- */
function toast(t, cofnijFn) {
  const e = document.getElementById('toast'); toast.cb = cofnijFn || null;
  e.innerHTML = `<span>${esc(t)}</span>${cofnijFn ? '<button data-act="toast-cofnij">Cofnij</button>' : ''}`;
  e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; toast.cb = null; }, cofnijFn ? 6000 : 3500);
}
const liczba = (id, min, max) => { const e = document.getElementById(id); if (!e) return null; const v = parseFloat(String(e.value).replace(',', '.')); return isFinite(v) && v >= min && v <= max ? v : null; };
const migawka = () => JSON.stringify({ dieta: S.dieta, posilki: S.posilki, wyklucz: S.wyklucz, plan: S.plan });
function przeplanuj(msg, snap) {
  przyszlePlanyOdNowa(); zapisz(); widok(); odswiezArkusz();
  if (msg) toast(msg, snap ? () => { Object.assign(S, JSON.parse(snap)); zapisz(); widok(); odswiezArkusz(); toast('Cofnięte'); } : null);
}
const krokWjazd = k => { const o = document.querySelector('.onb'); if (o) o.classList.add(k); };
const PALETY = [["a", "Szałwia i koral", "#f4f6f1", "#2e5a44", "#c9431c"], ["b", "Morze i mandarynka", "#f2f6f7", "#12474f", "#bb4f0c"], ["c", "Śliwka i malina", "#faf6f8", "#43294f", "#c2255c"], ["d", "Granat i słońce", "#f7f6f1", "#1f3a5f", "#9a6200"], ["e", "Oliwka i terakota", "#f6f4ee", "#4a5a2a", "#b04a24"], ["f", "Lawenda i brzoskwinia", "#f7f5fb", "#4b3f78", "#b84f18"], ["g", "Las i miód", "#f3f5f0", "#1f3d2b", "#9a5f06"], ["h", "Kawa i mięta", "#f6f3ef", "#4a3428", "#177a62"], ["i", "Niebo i róż", "#f3f6fa", "#24466e", "#c92d64"], ["j", "Grafit i limonka", "#f4f5f4", "#2b3035", "#4d7a12"]];
function odhacz(el, fn) { fn(); zapisz(); const on = el && el.classList.toggle('on'); if (on) brzek(8); clearTimeout(odhacz.t); odhacz.t = setTimeout(() => { if (U.tab === 'zakupy') widok(); }, el ? 320 : 0); }
function dodajWl() { const e = document.getElementById('wl-n'), n = (e && e.value || '').trim(); if (!n) { if (e) e.focus(); return; } wlasne().push({ id: Date.now().toString(36), n: n.slice(0, 40), ok: false }); zapisz(); widok(); toast(`Dopisane: ${n}`); const e2 = document.getElementById('wl-n'); if (e2) e2.focus(); }
document.addEventListener('submit', e => { if (e.target.dataset.form === 'wl') { e.preventDefault(); dodajWl(); } });
const kierunek = v => v > (U.dzien || dzis()) ? 'zprawa' : 'zlewa';

const AKCJE = {
  tab: v => ustawTab(v),
  dzien: v => { if (v === U.dzien) return; U.wjazd = kierunek(v); U.dzien = v; widok(); },
  tydzien: v => { const n = plus(U.dzien || dzis(), +v); U.wjazd = kierunek(n); U.dzien = n; widok(); },
  zjedz: (v, ds) => { const d = ds.d || U.dzien, s = ds.s; const z = S.zjedz[d] || (S.zjedz[d] = {}); z[s] = !z[s]; if (!z[s]) delete z[s]; else { S.pokazano.wsk = true; try { navigator.vibrate && navigator.vibrate(10); } catch (e) {} } zapisz(); widok(); odswiezArkusz(); },
  przepis: (v, ds) => otworz(arkuszPrzepis(v, ds.d, ds.s)),
  wymien: (v, ds) => otworz(arkuszWymien(ds.d, ds.s)),
  wybierz: (v, ds) => {
    planDnia(ds.d)[ds.s] = { id: v }; zapisz(); widok(); brzek();
    if (U.stos.length >= 2) { U.stos.pop(); cofnij(1); }
    U.stos[U.stos.length - 1] = arkuszPrzepis(v, ds.d, ds.s); odswiezArkusz(true); toast('Wymienione');
  },
  'wstaw-wybor': v => otworz(arkuszWstaw(v)),
  wstaw: (v, ds) => { planDnia(ds.d)[ds.s] = { id: v }; zapisz(); naPlan(); U.dzien = ds.d; widok(); scrollTo(0, 0); toast('Dodane do planu'); },
  gotuj: v => { U.gk = 0; otworz(arkuszGotuj(v)); },
  gk: v => { U.gk += +v; odswiezArkusz(true); },
  ulub: v => { const i = S.ulub.indexOf(v); i < 0 ? S.ulub.push(v) : S.ulub.splice(i, 1); zapisz(); widok(); odswiezArkusz(); },
  fm: v => { U.fm = v; widok(); }, ff: v => { U.ff = U.ff === v ? '' : v; widok(); },
  'filtry-czysc': () => { U.q = ''; U.fm = ''; U.ff = ''; widok(); },
  'szukaj-czysc': () => { U.q = ''; widok(); const n = document.getElementById('szukaj'); if (n) n.focus(); },
  'szukaj-podp': v => { U.q = v; U.fm = ''; U.ff = ''; widok(); },
  zakres: v => { S.zakupy.zakres = +v; zapisz(); widok(); },
  kup: (v, ds, el) => odhacz(el, () => { S.zakupy.ok[v] = !S.zakupy.ok[v]; if (!S.zakupy.ok[v]) delete S.zakupy.ok[v]; }),
  'wl-kup': (v, ds, el) => odhacz(el, () => { const w = wlasne().find(x => x.id === v); if (w) w.ok = !w.ok; }),
  'wl-usun': v => { const l = wlasne(), i = l.findIndex(x => x.id === v); if (i < 0) return; const [w] = l.splice(i, 1); zapisz(); widok(); toast(`Usunięte: ${w.n}`, () => { l.splice(i, 0, w); zapisz(); widok(); }); },
  'kup-czysc': () => { const st = S.zakupy.ok, wst = wlasne().map(w => w.ok); S.zakupy.ok = {}; wlasne().forEach(w => { w.ok = false; }); zapisz(); widok(); toast('Wszystko odznaczone', () => { S.zakupy.ok = st; wlasne().forEach((w, i) => { w.ok = !!wst[i]; }); zapisz(); widok(); }); },
  wyslij: async () => {
    const { suma, od, ile } = listaZakupow(), ok = S.zakupy.ok;
    const kl = Object.keys(suma).filter(k => F[k] && !ok[k]);
    if (!kl.length && !wlasne().some(w => !w.ok)) return toast('Nie ma nic do kupienia');
    let txt = `Lista zakupów — ${ile === 1 ? opisDnia(od) : `${krotko(od)}–${krotko(plus(od, ile - 1))}`}\n`;
    for (const [c, n] of KAT) { const el = kl.filter(k => F[k].cat === c); if (el.length) txt += `\n${n}:\n` + el.map(k => `• ${F[k].n} — ${ileKupic(k, gZak(suma, k))[0]}`).join('\n') + '\n'; }
    const wd = wlasne().filter(w => !w.ok); if (wd.length) txt += `\nDopisane:\n` + wd.map(w => `• ${w.n}`).join('\n') + '\n';
    const ko = kl.reduce((a, k) => a + kosztPoz(k, gZak(suma, k)), 0); if (ko) txt += `
Szacunkowo ${zl(ko)} (ceny orientacyjne: ${CENY_DATA}).
`;
    try { if (navigator.share) { await navigator.share({ title: 'Lista zakupów', text: txt }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(txt); toast('Lista skopiowana. Wklej ją w SMS-ie albo w komunikatorze.'); } catch (e) { toast('Nie udało się skopiować listy'); }
  },
  'extra-dodaj': () => otworz(arkuszExtra()),
  'extra-szybko': (v, ds) => dodajExtra(ds.n, +ds.k),
  'extra-zapisz': () => { const n = (document.getElementById('ex-n').value || '').trim(), k = liczba('ex-k', 1, 5000); if (!n || !k) return toast('Wpisz nazwę i kalorie'); dodajExtra(n, Math.round(k)); },
  skan: () => otworz(arkuszSkan()),
  'skan-znowu': () => podmien(arkuszSkan()),
  'skan-szukaj': () => { const e = document.getElementById('skan-kod'); znajdz(e && e.value); },
  'skan-pokaz': v => pokazProdukt(v),
  'skan-lat': (v, ds, el) => { const tr = SK.str && SK.str.getVideoTracks()[0]; if (!tr) return; SK.lat = !SK.lat; tr.applyConstraints({ advanced: [{ torch: SK.lat }] }).catch(() => {}); if (el) el.classList.toggle('on', SK.lat); },
  'pr-g': v => { const e = document.getElementById('pr-g'); if (!e) return; e.value = v; const b = document.querySelector('[data-act=pr-dodaj]'); if (b) sumaPr(b.dataset.v); brzek(8); },
  'pr-dodaj': v => { const p = skany()[v], g = gramyPr(); if (!p) return; if (!g) { toast('Wpisz, ile gramów zjadłaś'); return document.getElementById('pr-g').focus(); } p.g = g; dodajExtra(`${p.n} (${g} g)`, Math.round(p.k * g / 100)); },
  'nm-zapisz': v => {
    const n = (document.getElementById('nm-n').value || '').trim(), k = parseFloat((document.getElementById('nm-k').value || '').replace(',', '.')), g = parseFloat((document.getElementById('nm-g').value || '').replace(',', '.'));
    if (!n) { toast('Wpisz nazwę produktu'); return document.getElementById('nm-n').focus(); }
    if (!(k >= 0 && k <= 900)) { toast('Wpisz kalorie na 100 g'); return document.getElementById('nm-k').focus(); }
    if (!(g > 0 && g <= 5000)) { toast('Wpisz, ile gramów zjadłaś'); return document.getElementById('nm-g').focus(); }
    skany()[v] = { n: n.slice(0, 60), m: '', k: Math.round(k), b: 0, t: 0, w: 0, op: 0, por: 0, img: '', d: Date.now(), g: Math.round(g), wlasny: true };
    dodajExtra(`${n} (${Math.round(g)} g)`, Math.round(k * g / 100));
  },
  'extra-usun': (v, ds) => { const d = U.dzien, a = S.extra[d] || [], i = +ds.i; const [x] = a.splice(i, 1); zapisz(); widok(); toast(`Usunięto: ${x.n}`, () => { a.splice(i, 0, x); S.extra[d] = a; zapisz(); widok(); }); },
  'waga-dodaj': () => { otworz(arkuszWaga()); setTimeout(() => { const e = document.getElementById('nowa-waga'); if (e) e.focus(); }, 260); },
  'waga-zapisz': () => { const kg = liczba('nowa-waga', 30, 300); if (!kg) return toast('Wpisz wagę, np. 72,5'); const t = dzis(); S.waga = S.waga.filter(x => x.d !== t); S.waga.push({ d: t, kg }); S.waga.sort((a, b) => a.d < b.d ? -1 : 1); zapisz(); zamknij(); widok(); toast('Zapisane'); },
  'waga-usun': v => { const st = S.waga.slice(); S.waga = S.waga.filter(x => x.d !== v); zapisz(); widok(); toast('Wpis usunięty', () => { S.waga = st; zapisz(); widok(); }); },
  wz: v => { U.wz = v; widok(); },
  punkt: v => toast(v),
  'cel-zapisz': () => { const e = document.getElementById('cel-wagi'); if (e && !e.value.trim()) { S.celWagi = null; zapisz(); widok(); return toast('Cel usunięty'); } const kg = liczba('cel-wagi', 30, 300); if (!kg) return toast('Wpisz wagę docelową, np. 65'); S.celWagi = kg; zapisz(); widok(); toast('Cel ustawiony'); },
  ustawienia: v => { U.wq = ''; otworz(arkuszUstawienia(v || null)); },
  zamknij: () => zamknij(),
  wstecz: () => history.back(),
  'toast-cofnij': () => { const f = toast.cb; document.getElementById('toast').hidden = true; toast.cb = null; if (f) f(); },
  pokazano: v => { S.pokazano[v] = true; zapisz(); widok(); },
  instaluj: async () => { if (!instPrompt) return; instPrompt.prompt(); try { await instPrompt.userChoice; } catch (e) {} instPrompt = null; S.pokazano.inst = true; zapisz(); widok(); },
  prof: (v, ds) => { S.profil[ds.k] = ds.k === 'tempo' ? +v : v; zapisz(); widok(); odswiezArkusz(); },
  'prof-zapisz': () => {
    const p = S.profil; p.imie = (document.getElementById('u-imie').value || '').trim();
    const wiek = liczba('u-wiek', 14, 100), wz = liczba('u-wzrost', 120, 220); if (!wiek || !wz) return toast('Sprawdź wiek i wzrost');
    const kv = document.getElementById('u-kcal').value.trim(), kw = kv ? liczba('u-kcal', 1000, 4500) : null;
    if (kv && !kw) return toast('Kalorie: wpisz od 1000 do 4500');
    p.wiek = wiek; p.wzrost = wz; p.akt = +document.getElementById('u-akt').value; p.kcalWlasne = kw;
    zapisz(); widok(); toast('Zapisane'); history.back();
  },
  dieta: v => { if (v === S.dieta) return; const m = migawka(); S.dieta = v; przeplanuj(`Dieta: ${DIETY[v].n}. Plan ułożony od nowa`, m); },
  posilki: v => { if (+v === S.posilki) return; const m = migawka(); S.posilki = +v; przeplanuj(`${v} ${odm(+v, 'posiłek', 'posiłki', 'posiłków')} dziennie. Plan ułożony od nowa`, m); },
  'wyk-dodaj': v => { const m = migawka(); if (!S.wyklucz.includes(v)) S.wyklucz.push(v); U.wq = ''; przeplanuj(`Wykluczone: ${F[v].n}`, m); },
  'wyk-usun': v => { S.wyklucz = S.wyklucz.filter(x => x !== v); przeplanuj(); },
  duze: v => { czytajPola(); S.duze = v === 'true'; zapisz(); widok(); odswiezArkusz(); },
  motyw: v => { S.motyw = v; zapisz(); widok(); odswiezArkusz(); },
  paleta: v => { if (!PALETY.some(p => p[0] === v)) return; S.paleta = v; zapisz(); widok(); odswiezArkusz(); brzek(8); },
  'od-nowa': () => { const m = migawka(); naPlan(); przeplanuj('Nowy plan gotowy', m); },
  kasuj: () => { if (!U.kasuj) { U.kasuj = true; return odswiezArkusz(); } try { localStorage.removeItem(KEY); } catch (e) {} S = nowy(); U.krok = 0; U.szkic = {}; U.bledy = {}; naPlan(); widok(); scrollTo(0, 0); },
  kopia: () => pobierzKopie(),
  'kopia-wyslij': () => wyslijKopie(),
  'kopia-pozniej': () => { S.kopia = Object.assign({}, S.kopia, { odl: plus(dzis(), 7) }); zapisz(); widok(); toast('Przypomnę za tydzień'); },
  'pr-popraw': v => { const p = skany()[v], k = liczba('pr-k', 0, 900); if (!p) return; if (k === null) { toast('Wpisz kalorie z opakowania, od 0 do 900'); return document.getElementById('pr-k').focus(); } p.k = Math.round(k); p.popr = true; zapisz(); odswiezArkusz(); toast(`Poprawione: ${p.k} kcal na 100 g`); },
  'pr-dobrze': v => { const p = skany()[v]; if (!p) return; p.popr = true; zapisz(); odswiezArkusz(); },
  woda: (v, ds) => { const d = ds.d || U.dzien || dzis(), w = S.woda || (S.woda = {}), cur = w[d] || 0; let n = +v; if (n === cur) n--; if (n > 0) w[d] = n; else delete w[d]; zapisz(); widok(); brzek(n > cur ? 10 : 6); if (n === 8 && cur < 8) toast('Brawo! 8 szklanek wody'); },
  pp: v => { U.pp = Math.max(0, Math.min(PODP.length - 1, U.pp + +v)); odswiezArkusz(true); },
  intro: () => { U.pp = 0; if (U.stos.length) { U.stos[U.stos.length - 1] = arkuszIntro(); odswiezArkusz(true); } else otworz(arkuszIntro()); },
  'pz-sw': v => { const pz = przyp(); if (v === 'waga') pz.waga.on = !pz.waga.on; else { const i = pz.wyl.indexOf(v); i < 0 ? pz.wyl.push(v) : pz.wyl.splice(i, 1); } zapisz(); odswiezArkusz(); brzek(8); },
  kalendarz: () => dodajDoKalendarza(),
  szkic: (v, ds) => { czytajPola(); U.szkic[ds.k] = ['akt', 'tempo'].includes(ds.k) ? +v : v; widok(); },
  'onb-wstecz': () => { czytajPola(); U.bledy = {}; U.krok = Math.max(0, U.krok - 1); widok(); scrollTo(0, 0); krokWjazd('zlewa'); },
  'onb-dalej': () => {
    czytajPola();
    if (U.krok === 1) {
      const s = U.szkic, bl = {}, wg = +String(s.waga || '').replace(',', '.');
      if (!(+s.wiek >= 14 && +s.wiek <= 100)) bl.wiek = 'Wpisz wiek w latach, np. 58';
      if (!(+s.wzrost >= 120 && +s.wzrost <= 220)) bl.wzrost = 'Wpisz wzrost w cm, np. 164';
      if (!(wg >= 35 && wg <= 250)) bl.waga = 'Wpisz wagę w kg, np. 72,5';
      U.bledy = bl;
      if (Object.keys(bl).length) { widok(); const e = document.getElementById('o-' + Object.keys(bl)[0]); if (e) e.focus(); return; }
      s.waga = String(wg);
    }
    U.krok++; widok(); scrollTo(0, 0); krokWjazd('zprawa');
  },
  'onb-koniec': () => { S.profil = profilZeSzkicu(); S.dieta = U.szkic.dieta || 'standard'; S.waga = [{ d: dzis(), kg: S.profil.waga }]; S.plan = {}; S.start = dzis(); zapisz(); U.tab = 'plan'; U.dzien = dzis(); widok(); scrollTo(0, 0); },
};
/* ---------- skaner kodów kreskowych, jak w Fitatu (24.11) ---------- */
const skany = () => S.skany || (S.skany = {});
const SK = { str: null, t: null, det: null, zx: null, lat: false };
const SKC = document.createElement('canvas');
const r1 = x => Math.round((+x || 0) * 10) / 10;
const naGorze = () => U.stos[U.stos.length - 1];
function zaladujZx() {
  return window.ZXing ? Promise.resolve() : new Promise((ok, zle) => { const s = document.createElement('script'); s.src = 'vendor/zxing-0.21.3.min.js'; s.onload = ok; s.onerror = zle; document.head.appendChild(s); });
}
function skanSt(txt) { const e = document.getElementById('skan-st'); if (e) e.textContent = txt; }
function skanStop() { clearTimeout(SK.t); SK.lat = false; if (SK.str) { SK.str.getTracks().forEach(x => x.stop()); SK.str = null; } }
async function skaner(on) {
  if (!on) return skanStop();
  try {
    if (!SK.str) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return skanSt('Ta przeglądarka nie daje dostępu do aparatu. Wpisz cyfry spod kodu poniżej.');
      const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      if (!(naGorze() && naGorze().skan) || document.hidden) { s.getTracks().forEach(x => x.stop()); return; }
      SK.str = s;
    }
    const v = document.getElementById('skan-v'); if (!v) return;
    v.srcObject = SK.str; await v.play().catch(() => {});
    const tr = SK.str.getVideoTracks()[0], cap = tr && tr.getCapabilities ? tr.getCapabilities() : {};
    const lb = document.getElementById('skan-lat'); if (lb && cap.torch) lb.hidden = false;
    if (!SK.det && !SK.zx && 'BarcodeDetector' in window) {
      try { const f = await BarcodeDetector.getSupportedFormats(); if (f.includes('ean_13')) SK.det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter(x => f.includes(x)) }); } catch (e) {}
    }
    if (!SK.det && !SK.zx) {
      skanSt('Przygotowuję skaner…'); await zaladujZx();
      const h = new Map(), B = ZXing.BarcodeFormat;
      h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [B.EAN_13, B.EAN_8, B.UPC_A, B.UPC_E]); h.set(ZXing.DecodeHintType.TRY_HARDER, true);
      SK.zx = new ZXing.MultiFormatReader(); SK.zx.setHints(h);
    }
    skanSt('Nakieruj aparat na kod kreskowy na opakowaniu');
    clearTimeout(SK.t); skanPetla();
  } catch (e) {
    skanStop();
    skanSt(e && e.name === 'NotAllowedError' ? 'Nie ma zgody na aparat. Zezwól na niego w ustawieniach przeglądarki albo wpisz cyfry spod kodu poniżej.' : 'Nie udało się włączyć aparatu. Wpisz cyfry spod kodu poniżej.');
  }
}
function czytajKod(zrodlo, w, h) {
  const cw = Math.round(w * .86), ch = Math.round(h * .6);
  SKC.width = cw; SKC.height = ch;
  SKC.getContext('2d', { willReadFrequently: true }).drawImage(zrodlo, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
  try { return SK.zx.decodeWithState(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(SKC)))).getText(); } catch (e) { return null; }
}
async function skanPetla() {
  const v = document.getElementById('skan-v'); if (!SK.str || !v) return;
  let kod = null;
  if (v.readyState >= 2 && v.videoWidth) {
    if (SK.det) { try { const r = await SK.det.detect(v); kod = r[0] && r[0].rawValue; } catch (e) {} }
    else if (SK.zx) kod = czytajKod(v, v.videoWidth, v.videoHeight);
  }
  if (!SK.str) return;
  if (kod && /^\d{8,14}$/.test(kod)) { brzek(40); skanStop(); return znajdz(kod); }
  SK.t = setTimeout(skanPetla, SK.det ? 120 : 150);
}
/* podmienia arkusz skanera na następny krok; gdy mama zamknęła okno w międzyczasie, nic nie otwiera */
function podmien(fn) { if (!(naGorze() && naGorze().sk)) return false; U.stos[U.stos.length - 1] = fn; odswiezArkusz(true); return true; }
function arkuszSkan() {
  const fn = () => `<h2>Zeskanuj kod kreskowy</h2>
    <div class="skan"><video id="skan-v" playsinline muted autoplay></video><i class="skan-ramka" aria-hidden="true"></i>
    <button class="skan-lat" id="skan-lat" data-act="skan-lat" hidden aria-label="Latarka">${ik('zarowka')}</button></div>
    <p class="note center skan-st" id="skan-st" role="status">Włączam aparat…</p>
    <div class="dopisz"><input class="inp" id="skan-kod" inputmode="numeric" placeholder="albo wpisz cyfry spod kodu" maxlength="14" autocomplete="off" enterkeyhint="search" aria-label="Cyfry spod kodu kreskowego"><button class="btn" data-act="skan-szukaj" aria-label="Szukaj produktu">${ik('prawo')}</button></div>`;
  fn.skan = fn.sk = true; return fn;
}
function arkuszSzukam(kod) { const fn = () => `<h2>Szukam produktu…</h2><p class="note">Kod ${esc(kod)}</p><div class="skan-szuka" aria-hidden="true"><i></i><i></i><i></i></div>`; fn.sk = true; return fn; }
async function znajdz(kod) {
  kod = String(kod || '').replace(/\D/g, '');
  if (kod.length < 8) { toast('Kod ma od 8 do 14 cyfr'); const e = document.getElementById('skan-kod'); if (e) e.focus(); return; }
  if (skany()[kod]) return pokazProdukt(kod);
  if (!podmien(arkuszSzukam(kod))) return;
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${kod}.json?lc=pl&fields=nutriments,product_quantity,product_quantity_unit,quantity,serving_quantity,product_name,product_name_pl,brands,image_front_small_url`);
    const d = await r.json(), p = d && d.status === 1 ? d.product : null, n = (p && p.nutriments) || {};
    let k = n['energy-kcal_100g']; if (k == null && n['energy-kj_100g'] != null) k = n['energy-kj_100g'] / 4.184;
    const nazwa = p && (p.product_name_pl || p.product_name || '').trim();
    if (!p || k == null || !nazwa) return podmien(arkuszNieMa(kod, nazwa || '', false));
    let jed = (p.product_quantity_unit || 'g').toLowerCase(), op = +p.product_quantity;
    if (!op) { const m = String(p.quantity || '').match(/([\d.,]+)\s*(kg|g|ml|l)(?![a-z])/i); if (m) { const x = parseFloat(m[1].replace(',', '.')), j = m[2].toLowerCase(); op = j === 'kg' || j === 'l' ? x * 1000 : x; jed = j === 'kg' ? 'g' : j === 'l' ? 'ml' : j; } }
    skany()[kod] = { n: nazwa, m: (p.brands || '').split(',')[0].trim(), k: Math.round(k), b: r1(n.proteins_100g), t: r1(n.fat_100g), w: r1(n.carbohydrates_100g),
      op: (jed === 'g' || jed === 'ml') && op >= 5 && op <= 5000 ? Math.round(op) : 0, por: Math.round(+p.serving_quantity || 0), img: p.image_front_small_url || '', d: Date.now() };
    zapisz(); pokazProdukt(kod);
  } catch (e) { podmien(arkuszNieMa(kod, '', true)); }
}
function pokazProdukt(kod) { const p = skany()[kod]; if (!p) return; p.d = Date.now(); zapisz(); const fn = arkuszProdukt(kod); if (!podmien(fn)) otworz(fn); }
const porcjeProd = p => { const w = [], b = new Set(); for (const [g, n] of [[p.op, 'Całe opakowanie'], [p.por, 'Porcja'], [100, '100 g']]) if (g > 0 && !b.has(g)) { b.add(g); w.push([g, n]); } return w; };
function arkuszProdukt(kod) {
  const fn = () => {
    const p = skany()[kod]; if (!p) return '<h2>Nie ma już tego produktu</h2>';
    const g0 = p.g || p.por || 100;
    return `<div class="prod"><span class="prod-f">${ik('talerz')}${p.img ? `<img src="${esc(p.img)}" alt="" referrerpolicy="no-referrer" onload="this.classList.add('ok')" onerror="this.remove()">` : ''}</span>
      <div><h2>${esc(p.n)}</h2><p class="note">${p.m ? esc(p.m) + ' · ' : ''}kod ${esc(kod)}</p></div></div>
      <div class="macros"><div><b>${p.k}</b>kcal</div><div><b>${fN(p.b)}</b>białko g</div><div><b>${fN(p.t)}</b>tłuszcz g</div><div><b>${fN(p.w)}</b>węgle g</div></div>
      <p class="note center" style="margin:6px 0 16px">wartości na 100 g${p.popr ? ' · poprawione przez Ciebie' : ''}</p>
      ${(() => { const r = podejrzany(p); return r.length ? `<div class="card uwaga" role="alert"><span class="hint-ik">${ik('zarowka')}</span><div><b>Sprawdź z opakowaniem</b><p>${r.join(' ')} Baza produktów czasem się myli. Porównaj kalorie na 100 g z tabelką na opakowaniu.</p>
        <div class="dopisz"><input class="inp" id="pr-k" type="text" inputmode="decimal" placeholder="kcal na 100 g z opakowania" aria-label="Kalorie na 100 g z opakowania"><button class="btn" data-act="pr-popraw" data-v="${esc(kod)}">Popraw</button></div>
        <button class="lnk" data-act="pr-dobrze" data-v="${esc(kod)}">${ik('ok')}Na opakowaniu jest tak samo</button></div></div>` : ''; })()}
      <h3>Ile zjadłaś?</h3><div class="chips wrapc" id="pr-chips">${porcjeProd(p).map(([g, n]) => `<button class="chip${g === g0 ? ' on' : ''}" data-act="pr-g" data-v="${g}" aria-pressed="${g === g0}">${n === '100 g' ? n : `${n} · ${g} g`}</button>`).join('')}</div>
      <div class="waga-in" style="margin-top:12px"><input class="inp" id="pr-g" type="text" inputmode="decimal" value="${g0}" aria-label="Ile gramów zjadłaś"><span>g</span></div>
      <button class="btn" data-act="pr-dodaj" data-v="${esc(kod)}">${ik('plus')}<span id="pr-suma">Dodaj · ${Math.round(p.k * g0 / 100)} kcal</span></button>
      <button class="btn sec" style="margin-top:10px" data-act="skan-znowu">${ik('kod')}Skanuj inny produkt</button>`;
  };
  fn.sk = true; return fn;
}
function arkuszNieMa(kod, nazwa, offline) {
  const fn = () => `<h2>${offline ? 'Brak internetu' : 'Nie znam tego produktu'}</h2>
    <p class="note" style="margin:4px 0 14px">${offline ? 'Nie mogę teraz sprawdzić kodu.' : `Kodu ${esc(kod)} nie ma w bazie produktów.`} Przepisz z opakowania nazwę i kalorie na 100 g. Zapamiętam produkt, więc następnym razem skaner go rozpozna.</p>
    <div class="field"><label for="nm-n">Nazwa</label><input class="inp" id="nm-n" value="${esc(nazwa)}" placeholder="np. jogurt waniliowy"></div>
    <div class="field"><label for="nm-k">Kalorie na 100 g</label><input class="inp" id="nm-k" type="text" inputmode="decimal" placeholder="kcal z tabelki na opakowaniu"></div>
    <div class="field"><label for="nm-g">Ile gramów zjadłaś</label><input class="inp" id="nm-g" type="text" inputmode="decimal" value="100"></div>
    <button class="btn" data-act="nm-zapisz" data-v="${esc(kod)}">${ik('plus')}Dodaj</button>
    <button class="btn sec" style="margin-top:10px" data-act="skan-znowu">${ik('kod')}Skanuj jeszcze raz</button>`;
  fn.sk = true; return fn;
}
function gramyPr() { const e = document.getElementById('pr-g'); const g = parseFloat(String(e && e.value || '').replace(',', '.')); return g > 0 && g <= 5000 ? Math.round(g) : 0; }
function sumaPr(kod) {
  const p = skany()[kod], g = gramyPr(), s = document.getElementById('pr-suma'); if (!p || !s) return;
  s.textContent = g ? `Dodaj · ${Math.round(p.k * g / 100)} kcal` : 'Wpisz gramy';
  document.querySelectorAll('#pr-chips .chip').forEach(c => { const on = +c.dataset.v === g; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
}
document.addEventListener('input', e => { if (e.target.id === 'pr-g') { const b = document.querySelector('[data-act=pr-dodaj]'); if (b) sumaPr(b.dataset.v); } });
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'skan-kod') { e.preventDefault(); znajdz(e.target.value); }
  else if (e.target.id === 'pr-g') { e.preventDefault(); const b = document.querySelector('[data-act=pr-dodaj]'); if (b) b.click(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) skanStop(); else if (naGorze() && naGorze().skan) skaner(true); });
function dodajExtra(n, k) { const d = U.dzien || dzis(); (S.extra[d] || (S.extra[d] = [])).push({ n, k }); zapisz(); zamknij(); widok(); toast(`Dodane: ${n}`); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const f = AKCJE[el.dataset.act]; if (!f) return;
  e.preventDefault(); f(el.dataset.v, el.dataset, el);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && U.stos.length) zamknij();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('li[data-act],[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Enter' && e.target.id === 'nowa-waga') AKCJE['waga-zapisz']();
});
document.addEventListener('input', e => {
  if (e.target.id === 'szukaj') { U.q = e.target.value; const pos = e.target.selectionStart; widok(); const n = document.getElementById('szukaj'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} }
  if (e.target.id === 'wyk-q') { U.wq = e.target.value; const q = U.wq.trim().toLowerCase();
    const w = q.length >= 2 ? Object.entries(F).filter(([k, f]) => f.cat !== 'przyprawy' && !S.wyklucz.includes(k) && f.n.toLowerCase().includes(q)).slice(0, 8) : [];
    document.getElementById('wyk-wyniki').innerHTML = wynikiWyk(w); }
});
document.addEventListener('change', e => {
  const id = e.target.id || '';
  if (id.startsWith('pg-')) { const pz = przyp(), v = e.target.value; if (id === 'pg-wdz') pz.waga.dzien = +v; else if (/^\d{1,2}:\d{2}$/.test(v)) { if (id === 'pg-waga') pz.waga.godz = v; else pz.godz[id.slice(3)] = v; } zapisz(); return; }
  if (id !== 'wczytaj' || !e.target.files[0]) return;
  const fr = new FileReader();
  fr.onload = () => { try { const s = JSON.parse(fr.result); if (!s || s.v !== 1 || !s.profil) throw 0; S = Object.assign(nowy(), s); S.pokazano = S.pokazano || {}; zapisz(); naPlan(); widok(); toast('Kopia wczytana'); } catch (x) { toast('To nie jest kopia z tej aplikacji'); } };
  fr.readAsText(e.target.files[0]);
});
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('koszyk')) U.koszyk = e.target.open; }, true);

/* przesunięcie palcem po posiłkach zmienia dzień */
let dotyk = null;
document.addEventListener('touchstart', e => { const t = e.touches[0]; dotyk = !U.stos.length && e.target.closest('#posilki') ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
document.addEventListener('touchend', e => {
  if (!dotyk) return; const t = e.changedTouches[0], dx = t.clientX - dotyk.x, dy = t.clientY - dotyk.y; dotyk = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { const n = plus(U.dzien || dzis(), dx < 0 ? 1 : -1); U.wjazd = dx < 0 ? 'zprawa' : 'zlewa'; U.dzien = n; widok(); }
}, { passive: true });
/* arkusz zamyka się przeciągnięciem w dół */
(() => {
  const box = document.querySelector('.sheet-box'); let y0 = null, dy = 0, t0 = 0;
  box.addEventListener('touchstart', e => { if (box.scrollTop > 0 && !e.target.closest('.sheet-grip')) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); box.style.transition = 'none'; }, { passive: true });
  box.addEventListener('touchmove', e => { if (y0 === null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { box.style.transform = `translateY(${dy}px)`; if (e.cancelable) e.preventDefault(); } else box.style.transform = ''; }, { passive: false });
  box.addEventListener('touchend', () => { if (y0 === null) return; y0 = null; box.style.transition = '';
    const v = dy / Math.max(1, Date.now() - t0);
    if (dy > 90 || (dy > 30 && v > .6)) zamknij(); else box.style.transform = ''; });
})();
// nowy dzień, gdy aplikacja leży otwarta przez noc; po powrocie ekran znów nie gaśnie przy gotowaniu
let ostatniDzien = dzis();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (dzis() !== ostatniDzien) { ostatniDzien = dzis(); U.dzien = dzis(); widok(); }
  const top = U.stos[U.stos.length - 1]; if (top && top.gotuj) ekranNieGasnie(true);
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instPrompt = e; if (!U.stos.length) widok(); });

if (S.profil && !samodzielna()) { S.wizyty = (S.wizyty || 0) + 1; zapisz(); }
history.replaceState(null, '');
widok();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
