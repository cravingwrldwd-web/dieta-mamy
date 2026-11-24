'use strict';
/* Dieta Mamy — jadłospis, przepisy, zakupy, waga. Dane tylko na telefonie (localStorage). */
const F = window.FOODS || {};
const R = (window.RECIPES || []).filter(r => r && r.id && Array.isArray(r.ing));
const RB = Object.fromEntries(R.map(r => [r.id, r]));
const KEY = 'dietaMamy.v1';

/* ---------- stan ---------- */
const nowy = () => ({ v: 1, profil: null, dieta: 'standard', posilki: 4, wyklucz: [], plan: {}, zjedz: {}, extra: {},
  zakupy: { zakres: 1, ok: {} }, waga: [], celWagi: null, ulub: [], duze: false, motyw: 'auto' });
function wczytaj() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(nowy(), s); } catch (e) {}
  return nowy();
}
let S = wczytaj();
function zapisz() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const U = { tab: 'plan', dzien: null, q: '', fm: '', ff: '', krok: 0, szkic: {}, sheet: null, kasuj: false, wq: '' };

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
const krotko = s => { const d = zIso(s); return `${d.getDate()}.${pad(d.getMonth() + 1)}`; };

/* ---------- liczby ---------- */
const fN = (n, p = 1) => (Math.round(n * 10 ** p) / 10 ** p).toString().replace('.', ',');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
const SLOTY = {
  3: [['sniadanie', 'Śniadanie', '8:00', .30], ['obiad', 'Obiad', '13:30', .45], ['kolacja', 'Kolacja', '19:00', .25]],
  4: [['sniadanie', 'Śniadanie', '8:00', .27], ['drugie', 'II śniadanie', '11:00', .13], ['obiad', 'Obiad', '14:00', .35], ['kolacja', 'Kolacja', '18:30', .25]],
  5: [['sniadanie', 'Śniadanie', '7:30', .25], ['drugie', 'II śniadanie', '10:30', .10], ['obiad', 'Obiad', '13:30', .33], ['podw', 'Podwieczorek', '16:30', .10], ['kolacja', 'Kolacja', '19:00', .22]] };
const TYPY = { sniadanie: 'Śniadania', drugie: 'II śniadania i przekąski', obiad: 'Obiady', kolacja: 'Kolacje' };
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
  ust: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7"/>', swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  lewo: '<path d="M15 5l-7 7 7 7"/>', prawo: '<path d="M9 5l7 7-7 7"/>', szukaj: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  serce: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', zegar: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>' };
const ik = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
const KOL = { warzywa: ['#7fb069', '#a7c957', '#e07a5f', '#5e8c4a'], owoce: ['#e85d75', '#f2a541', '#c44569'], nabial: ['#f1e4c3', '#e9d8a6'],
  mieso: ['#b5651d', '#9c4f2e', '#c97c4a'], ryby: ['#f08a5d', '#f4a07a'], zboza: ['#e1b866', '#d9a441', '#caa165'], straczki: ['#c9a227', '#8d6b2f', '#b5835a'],
  tluszcze: ['#c8b26b', '#a68a4b'], spizarnia: ['#c0392b', '#d35400'], przyprawy: ['#6a994e'] };
function talerz(r, duzy) {
  if (!r) return `<div class="plate${duzy ? ' lg' : ''}"></div>`;
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

/* ---------- widoki ---------- */
function widok() {
  document.documentElement.classList.toggle('duze', !!S.duze);
  if (S.motyw === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', S.motyw);
  const app = document.getElementById('app');
  if (!R.length) { app.innerHTML = `<div class="wrap empty"><h2>Brak przepisów</h2><p>Nie udało się wczytać bazy przepisów. Odśwież stronę.</p></div>`; return; }
  if (!S.profil) { app.innerHTML = powitanie(); return; }
  const t = { plan: ekranPlan, przepisy: ekranPrzepisy, zakupy: ekranZakupy, waga: ekranWaga }[U.tab] || ekranPlan;
  app.innerHTML = t() + nawigacja();
}
function nawigacja() {
  const z = [['plan', 'Plan'], ['przepisy', 'Przepisy'], ['zakupy', 'Zakupy'], ['waga', 'Waga']];
  return `<nav class="nav"><div class="in">${z.map(([k, n]) => `<button data-act="tab" data-v="${k}" class="${U.tab === k ? 'on' : ''}" aria-current="${U.tab === k}"><span class="pill">${ik(k)}</span>${n}</button>`).join('')}</div></nav>`;
}
function naglowek(maly, duzy, gear = true) {
  return `<div class="wrap hd"><div><div class="hi">${maly}</div><h1>${duzy}</h1></div>${gear ? `<button class="ico-btn" data-act="ustawienia" aria-label="Ustawienia">${ik('ust')}</button>` : ''}</div>`;
}

function ekranPlan() {
  const d = U.dzien || (U.dzien = dzis()), t = dzis();
  const pn = poniedzialek(d);
  const godz = new Date().getHours();
  const imie = S.profil.imie ? `, ${esc(S.profil.imie)}` : '';
  const powit = d === t ? (godz < 12 ? `Dzień dobry${imie}` : godz < 18 ? `Miłego popołudnia${imie}` : `Dobry wieczór${imie}`) : opisDnia(d);
  const tyt = d === t ? 'Twój plan na dziś' : d === plus(t, 1) ? 'Plan na jutro' : d === plus(t, -1) ? 'Wczoraj' : 'Plan dnia';
  const dni = [...Array(7)].map((_, i) => { const x = plus(pn, i), dd = zIso(x);
    return `<button class="day${x === d ? ' on' : ''}${x === t ? ' dzis' : ''}" data-act="dzien" data-v="${x}" aria-label="${opisDnia(x)}">${DNI[dd.getDay()]}<b>${dd.getDate()}</b></button>`; }).join('');
  const cel = kcalCel(), z = zjedzoneDnia(d), m = DIETY[S.dieta].m;
  const cB = cel * m[0] / 400, cT = cel * m[1] / 900, cW = cel * m[2] / 400;
  const proc = Math.min(100, z.k / cel * 100), za = z.k > cel * 1.05;
  const pasek = (n, a, c, kol) => `<div><div class="lab">${n}<span>${Math.round(a)} / ${Math.round(c)} g</span></div><div class="bar"><i style="width:${Math.min(100, a / c * 100)}%;background:${kol}"></i></div></div>`;
  const zj = S.zjedz[d] || {};
  const karty = sloty().map(([s, nazwa, h]) => {
    const p = posilekDnia(d, s);
    if (!p) return `<div class="card meal"><div class="plate"></div><div class="info"><div class="mt">${nazwa}</div><div class="mn">Brak pasującego przepisu</div><div class="mk">Zmień wykluczenia w ustawieniach</div></div></div>`;
    const on = !!zj[s];
    return `<div class="card meal-row"><button class="meal${on ? ' zjedz' : ''}" data-act="przepis" data-v="${p.r.id}" data-s="${s}" data-d="${d}">${talerz(p.r)}<div class="info"><div class="mt">${nazwa} · ${h}</div><div class="mn">${esc(p.r.n)}</div><div class="mk">${Math.round(p.w.k)} kcal · ${p.r.t} min</div></div></button><button class="ck${on ? ' on' : ''}" style="margin-right:12px" data-act="zjedz" data-s="${s}" aria-label="${on ? 'Odznacz' : 'Zjedzone'}: ${esc(p.r.n)}" aria-pressed="${on}">${ik('ok')}</button></div>`;
  }).join('');
  const ex = (S.extra[d] || []).map((e, i) => `<div class="card extra"><span>${esc(e.n)} · ${e.k} kcal</span><button data-act="extra-usun" data-i="${i}">Usuń</button></div>`).join('');
  return naglowek(powit, tyt) + `<div class="wrap">
  <div class="week"><button class="arr" data-act="tydzien" data-v="-7" aria-label="Poprzedni tydzień">${ik('lewo')}</button><div class="days">${dni}</div><button class="arr" data-act="tydzien" data-v="7" aria-label="Następny tydzień">${ik('prawo')}</button></div>
  <div class="card sum">
    <div class="ring" style="background:conic-gradient(${za ? 'var(--red)' : 'var(--green)'} 0 ${proc}%,var(--soft) 0)"><div class="in"><div><b>${Math.round(z.k)}</b><small>z ${cel} kcal</small></div></div></div>
    <div class="bars">${pasek('Białko', z.b, cB, 'var(--green2)')}${pasek('Tłuszcze', z.t, cT, 'var(--gold)')}${pasek('Węglowodany', z.w, cW, 'var(--sky)')}</div>
  </div>
  <div class="meals">${karty}${ex}</div>
  <div class="row" style="margin-top:12px"><button class="btn ghost" data-act="extra-dodaj">${ik('plus')}Zjadłam coś spoza planu</button></div>
  <p class="note" style="margin-top:14px">Dotknij posiłku, żeby zobaczyć przepis i składniki. Kółko po prawej odhacza zjedzone.</p>
  </div>`;
}

function ekranPrzepisy() {
  const q = U.q.trim().toLowerCase();
  const fm = U.fm, ff = U.ff;
  let lista = R.filter(r => {
    if (fm && !r.m.includes(fm)) return false;
    if (ff === 'ulub' && !S.ulub.includes(r.id)) return false;
    if (ff === 'szybkie' && r.t > 15) return false;
    if (ff && !['ulub', 'szybkie'].includes(ff) && !(r.d || []).includes(ff)) return false;
    if (q && !(r.n.toLowerCase().includes(q) || r.ing.some(([k]) => F[k] && F[k].n.toLowerCase().includes(q)))) return false;
    return true;
  });
  const wyk = new Set(S.wyklucz); lista = lista.filter(r => !r.ing.some(([k]) => wyk.has(k)));
  const chM = [['', 'Wszystkie'], ['sniadanie', 'Śniadania'], ['drugie', 'II śniadania'], ['obiad', 'Obiady'], ['kolacja', 'Kolacje']];
  const chF = [['ulub', 'Ulubione'], ['szybkie', 'Do 15 minut'], ['wege', 'Bez mięsa'], ['lowcarb', 'Mniej węgli'], ['fit', 'Więcej białka'], ['srodz', 'Śródziemnomorskie'], ['tania', 'Tanie']];
  const karty = lista.map(r => { const w = bazowe(r), ul = S.ulub.includes(r.id);
    return `<div class="card" style="display:flex;align-items:center"><button class="rcard" data-act="przepis" data-v="${r.id}">${talerz(r)}<div class="info" style="flex:1;min-width:0"><div class="mt">${r.m.map(m => KROT[m] || '').join(' · ')}</div><div class="mn">${esc(r.n)}</div><div class="mk">${Math.round(w.k)} kcal · ${r.t} min</div></div></button><button class="heart${ul ? ' on' : ''}" data-act="ulub" data-v="${r.id}" aria-label="${ul ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}" aria-pressed="${ul}">${ik('serce')}</button></div>`; }).join('');
  return naglowek(`${R.length} przepisów`, 'Przepisy') + `<div class="wrap">
  <div class="search">${ik('szukaj')}<input class="inp" id="szukaj" type="search" placeholder="Szukaj: łosoś, kasza, jajka…" value="${esc(U.q)}" autocomplete="off"></div>
  <div class="chips">${chM.map(([k, n]) => `<button class="chip${fm === k ? ' on' : ''}" data-act="fm" data-v="${k}">${n}</button>`).join('')}</div>
  <div class="chips" style="margin-top:6px">${chF.map(([k, n]) => `<button class="chip${ff === k ? ' on' : ''}" data-act="ff" data-v="${k}">${n}</button>`).join('')}</div>
  <div class="rlist" id="rlist">${karty || '<div class="empty">Nic nie pasuje. Zmień filtr albo wpisz inne słowo.</div>'}</div>
  <p class="note" style="margin-top:12px">Kalorie podane na jedną porcję podstawową. W planie porcje same dopasowują się do Twojego zapotrzebowania.</p></div>`;
}

const KAT = [['warzywa', 'Warzywa'], ['owoce', 'Owoce'], ['mieso', 'Mięso'], ['ryby', 'Ryby'], ['nabial', 'Nabiał i jajka'], ['zboza', 'Pieczywo, kasze, makarony'], ['straczki', 'Strączki'], ['tluszcze', 'Tłuszcze, orzechy, nasiona'], ['spizarnia', 'Spiżarnia'], ['przyprawy', 'Przyprawy — sprawdź, czy masz w domu']];
function listaZakupow() {
  const t = dzis(), n = S.zakupy.zakres || 1, od = n === -1 ? plus(t, 1) : t, ile = n === -1 ? 1 : n;
  const suma = {};
  for (let i = 0; i < ile; i++) { const d = plus(od, i); for (const [s] of sloty()) { const p = posilekDnia(d, s); if (!p) continue; for (const [k, g] of p.ing) suma[k] = (suma[k] || 0) + g; } }
  return { suma, od, ile };
}
function ekranZakupy() {
  const { suma, od, ile } = listaZakupow();
  const ok = S.zakupy.ok, z = S.zakupy.zakres || 1;
  const klucze = Object.keys(suma).filter(k => F[k]);
  const zost = klucze.filter(k => !ok[k] && F[k].cat !== 'przyprawy').length;
  const grupy = KAT.map(([c, nazwa]) => {
    const el = klucze.filter(k => F[k].cat === c).sort((a, b) => F[a].n.localeCompare(F[b].n, 'pl'));
    if (!el.length) return '';
    return `<h3>${nazwa}</h3><ul class="card ing shop">${el.map(k => `<li class="${ok[k] ? 'on' : ''}" data-act="kup" data-v="${k}" role="checkbox" aria-checked="${!!ok[k]}" tabindex="0"><span class="bx">${ik('ok')}</span><span class="nm">${esc(F[k].n)}</span><span class="ilosc">${ilosc(k, Math.round(suma[k] / (suma[k] >= 50 ? 5 : 1)) * (suma[k] >= 50 ? 5 : 1), true)}</span></li>`).join('')}</ul>`;
  }).join('');
  const zakresTxt = ile === 1 ? opisDnia(od) : `${krotko(od)} – ${krotko(plus(od, ile - 1))}`;
  return naglowek(zakresTxt, 'Lista zakupów') + `<div class="wrap">
  <div class="seg" role="tablist">${[[1, 'Dziś'], [-1, 'Jutro'], [3, '3 dni'], [7, 'Tydzień']].map(([v, n]) => `<button class="${z === v ? 'on' : ''}" data-act="zakres" data-v="${v}">${n}</button>`).join('')}</div>
  <p class="note" style="margin:12px 2px 0">${zost ? `Zostało do kupienia: <b>${zost}</b>. Dotknij produktu w sklepie, żeby go skreślić.` : 'Wszystko kupione.'}</p>
  ${grupy || '<div class="empty">Plan jest pusty.</div>'}
  <div style="margin-top:16px"><button class="btn sec" data-act="kup-czysc">Wyczyść skreślenia</button></div></div>`;
}

function ekranWaga() {
  const w = S.waga, p = S.profil;
  const teraz = wagaTeraz(), start = w.length ? w[0].kg : p.waga, zm = teraz - start;
  const cel = S.celWagi, bmi = teraz / ((p.wzrost / 100) ** 2);
  const ost = w[w.length - 1], dzisW = ost && ost.d === dzis();
  let wykres = '<div class="empty">Wpisuj wagę raz w tygodniu, rano na czczo. Po dwóch wpisach zobaczysz tu wykres.</div>';
  if (w.length >= 2) {
    const W = 340, H = 170, L = 34, Rr = 10, T = 12, B = 26;
    const t0 = zIso(w[0].d).getTime(), t1 = Math.max(t0 + 864e5, zIso(w[w.length - 1].d).getTime());
    const vals = w.map(x => x.kg).concat(cel ? [cel] : []);
    let lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
    const X = t => L + (t - t0) / (t1 - t0) * (W - L - Rr), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const pts = w.map(x => [X(zIso(x.d).getTime()), Y(x.kg)]);
    const krok = Math.max(1, Math.ceil((hi - lo) / 4));
    let siatka = ''; for (let v = lo; v <= hi; v += krok) siatka += `<line x1="${L}" x2="${W - Rr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
    const linia = pts.map(p => p.join(',')).join(' ');
    const pole = `M${pts[0][0]},${H - B} L${linia.replace(/ /g, ' L')} L${pts[pts.length - 1][0]},${H - B} Z`;
    wykres = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Wykres wagi">${siatka}
      ${cel ? `<line x1="${L}" x2="${W - Rr}" y1="${Y(cel)}" y2="${Y(cel)}" stroke="var(--gold)" stroke-width="2" stroke-dasharray="5 5"/><text x="${W - Rr}" y="${Y(cel) - 6}" text-anchor="end">cel ${fN(cel)}</text>` : ''}
      <path d="${pole}" fill="var(--green)" fill-opacity=".12" stroke="none"/>
      <polyline points="${linia}" stroke="var(--green)" stroke-width="3" fill="none"/>
      ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 5.5 : 3.5}" fill="${i === pts.length - 1 ? 'var(--green)' : 'var(--card)'}" stroke="var(--green)" stroke-width="2"/>`).join('')}
      <text x="${L}" y="${H - 6}">${krotko(w[0].d)}</text><text x="${W - Rr}" y="${H - 6}" text-anchor="end">${krotko(w[w.length - 1].d)}</text></svg>`;
  }
  const doCelu = cel ? teraz - cel : null;
  const lista = [...w].reverse().slice(0, 12).map((x, i, a) => { const prev = a[i + 1]; const r = prev ? x.kg - prev.kg : 0;
    return `<li><span>${opisDnia(x.d)}</span><span>${fN(x.kg)} kg ${prev ? `<small style="color:${r <= 0 ? 'var(--green)' : 'var(--red)'}">${r > 0 ? '+' : ''}${fN(r)}</small>` : ''}</span></li>`; }).join('');
  return naglowek(`BMI ${fN(bmi)}`, 'Waga i postępy') + `<div class="wrap">
  <div class="stat3"><div><b>${fN(teraz)}</b>kg teraz</div><div><b style="color:${zm <= 0 ? 'var(--green)' : 'var(--red)'}">${zm > 0 ? '+' : ''}${fN(zm)}</b>kg od startu</div><div><b>${doCelu === null ? '–' : fN(Math.max(0, doCelu))}</b>${doCelu === null ? 'brak celu' : 'kg do celu'}</div></div>
  <div class="card chart">${wykres}</div>
  <h3>${dzisW ? 'Popraw dzisiejszy wpis' : 'Dzisiejsza waga'}</h3>
  <div class="row"><input class="inp" id="nowa-waga" type="number" inputmode="decimal" step="0.1" min="30" max="300" placeholder="np. ${fN(teraz)}" aria-label="Waga w kilogramach"><button class="btn" style="flex:0 0 auto;width:auto;padding-inline:22px" data-act="waga-zapisz">Zapisz</button></div>
  <h3>Waga docelowa</h3>
  <div class="row"><input class="inp" id="cel-wagi" type="number" inputmode="decimal" step="0.5" min="30" max="300" placeholder="np. ${fN(Math.round(teraz - 5))}" value="${cel || ''}" aria-label="Waga docelowa"><button class="btn sec" style="flex:0 0 auto;width:auto;padding-inline:22px" data-act="cel-zapisz">Ustaw</button></div>
  ${lista ? `<h3>Ostatnie wpisy</h3><ul class="card ing wlist">${lista}</ul>` : ''}
  <p class="note" style="margin-top:12px">Zdrowe tempo to 0,5–1 kg na tydzień. Waga skacze z dnia na dzień o 1–2 kg przez wodę, więc patrz na linię z kilku tygodni.</p></div>`;
}

/* ---------- powitanie ---------- */
function powitanie() {
  const k = U.krok, s = U.szkic;
  const kropki = `<div class="dots">${[0, 1, 2].map(i => `<i class="${i === k ? 'on' : ''}"></i>`).join('')}</div>`;
  if (k === 0) return `<div class="wrap onb">${kropki}<div class="big">Twój plan jedzenia, ułożony pod Ciebie</div>
    <p class="lead">Codziennie gotowe posiłki z przepisami, lista zakupów do sklepu i wykres wagi. Wszystko zostaje w tym telefonie.</p>
    <div class="field"><label for="o-imie">Jak masz na imię?</label><input class="inp" id="o-imie" value="${esc(s.imie || '')}" placeholder="np. Ewa" autocomplete="given-name"></div>
    <button class="btn" data-act="onb-dalej">Dalej</button></div>`;
  if (k === 1) return `<div class="wrap onb">${kropki}<div class="big">Kilka liczb o Tobie</div>
    <p class="lead">Z nich policzę, ile kalorii dziennie potrzebujesz.</p>
    <div class="field"><label>Płeć</label><div class="seg">${[['k', 'Kobieta'], ['m', 'Mężczyzna']].map(([v, n]) => `<button class="${(s.plec || 'k') === v ? 'on' : ''}" data-act="szkic" data-k="plec" data-v="${v}">${n}</button>`).join('')}</div></div>
    <div class="grid2"><div class="field"><label for="o-wiek">Wiek</label><input class="inp" id="o-wiek" type="number" inputmode="numeric" value="${s.wiek || ''}" placeholder="lat"></div>
    <div class="field"><label for="o-wzrost">Wzrost</label><input class="inp" id="o-wzrost" type="number" inputmode="numeric" value="${s.wzrost || ''}" placeholder="cm"></div></div>
    <div class="field"><label for="o-waga">Waga teraz</label><input class="inp" id="o-waga" type="number" inputmode="decimal" step="0.1" value="${s.waga || ''}" placeholder="kg"></div>
    <div class="field"><label>Ile ruchu na co dzień?</label>${AKT.map((a, i) => `<button class="card alt" style="${(s.akt ?? 1) === i ? 'outline:3px solid var(--green)' : ''}" data-act="szkic" data-k="akt" data-v="${i}"><div><div class="mn" style="margin:0">${a.n}</div><div class="mk">${a.o}</div></div></button>`).join('')}</div>
    <p class="note" id="onb-blad" style="color:var(--red)"></p>
    <div class="row"><button class="btn sec" data-act="onb-wstecz">Wstecz</button><button class="btn" data-act="onb-dalej">Dalej</button></div></div>`;
  const prof = profilZeSzkicu();
  const stare = S.profil; S.profil = prof; const kc = zapotrzebowanie(); S.profil = stare;
  return `<div class="wrap onb">${kropki}<div class="big">Twój cel</div>
    <div class="field"><div class="seg">${[['schudnac', 'Schudnąć'], ['utrzymac', 'Utrzymać'], ['przytyc', 'Przytyć']].map(([v, n]) => `<button class="${prof.cel === v ? 'on' : ''}" data-act="szkic" data-k="cel" data-v="${v}">${n}</button>`).join('')}</div></div>
    ${prof.cel === 'schudnac' ? `<div class="field"><label>Jak szybko?</label><div class="seg">${[[.25, 'Łagodnie'], [.5, 'Zwykle'], [.75, 'Szybciej']].map(([v, n]) => `<button class="${prof.tempo === v ? 'on' : ''}" data-act="szkic" data-k="tempo" data-v="${v}">${n}<br><small>${fN(v, 2)} kg/tydz.</small></button>`).join('')}</div></div>` : ''}
    <div class="field"><label>Rodzaj diety</label>${Object.entries(DIETY).map(([v, d]) => `<button class="card alt" style="${(s.dieta || 'standard') === v ? 'outline:3px solid var(--green)' : ''}" data-act="szkic" data-k="dieta" data-v="${v}"><div><div class="mn" style="margin:0">${d.n}</div><div class="mk">${d.o}</div></div></button>`).join('')}</div>
    <div class="kcalbox"><b>${kc}</b>kcal dziennie</div>
    <div class="row"><button class="btn sec" data-act="onb-wstecz">Wstecz</button><button class="btn" data-act="onb-koniec">Zaczynamy</button></div></div>`;
}
function profilZeSzkicu() {
  const s = U.szkic;
  return { imie: (s.imie || '').trim(), plec: s.plec || 'k', wiek: +s.wiek || 50, wzrost: +s.wzrost || 165, waga: +s.waga || 70,
    akt: s.akt ?? 1, cel: s.cel || 'schudnac', tempo: s.tempo ?? .5, kcalWlasne: null };
}
function czytajPola() {
  const g = id => { const e = document.getElementById(id); return e ? e.value : undefined; };
  for (const [id, k] of [['o-imie', 'imie'], ['o-wiek', 'wiek'], ['o-wzrost', 'wzrost'], ['o-waga', 'waga']]) { const v = g(id); if (v !== undefined) U.szkic[k] = v; }
}

/* ---------- arkusze ---------- */
function otworz(fn) { U.sheet = fn; odswiezArkusz(); const sh = document.getElementById('sheet'); sh.hidden = false; document.body.style.overflow = 'hidden'; }
function odswiezArkusz() { if (U.sheet) document.getElementById('sheet-in').innerHTML = `<button class="sheet-x" data-act="zamknij" aria-label="Zamknij">${ik('x')}</button>` + U.sheet(); }
function zamknij() { U.sheet = null; U.kasuj = false; document.getElementById('sheet').hidden = true; document.body.style.overflow = ''; }

function arkuszPrzepis(id, d, s) {
  return () => {
    const r = RB[id]; if (!r) return '';
    const wPlanie = d && s; const f = wPlanie ? mnoznik(r, s) : 1;
    const ing = skaluj(r, f), w = wartosci(ing), ul = S.ulub.includes(id), zj = wPlanie && (S.zjedz[d] || {})[s];
    const tagi = { wege: 'Bez mięsa', lowcarb: 'Mniej węgli', srodz: 'Śródziemnomorskie', tania: 'Tanie', fit: 'Dużo białka' };
    const wstaw = !wPlanie ? `<h3>Dodaj do planu</h3><div class="grid2">${[dzis(), plus(dzis(), 1)].map((dd, i) => sloty().filter(([x]) => r.m.includes(typ(x))).map(([x, n]) =>
      `<button class="btn sec" data-act="wstaw" data-v="${id}" data-d="${dd}" data-s="${x}">${i ? 'Jutro' : 'Dziś'} · ${n}</button>`).join('')).join('')}</div>` : '';
    return `${talerz(r, true)}
    <div style="display:flex;gap:10px;align-items:flex-start;margin-top:14px"><div style="flex:1;min-width:0">${wPlanie ? `<div class="mt">${slotInfo(s)[1]} · ${opisDnia(d)}</div>` : ''}<h2>${esc(r.n)}</h2>
    <div class="meta"><span class="tag">${r.t} min</span>${(r.d || []).map(t => tagi[t] ? `<span class="tag">${tagi[t]}</span>` : '').join('')}</div></div>
    <button class="heart${ul ? ' on' : ''}" data-act="ulub" data-v="${id}" aria-label="Ulubione" aria-pressed="${ul}">${ik('serce')}</button></div>
    <div class="macros"><div><b>${Math.round(w.k)}</b>kcal</div><div><b>${Math.round(w.b)}</b>białko g</div><div><b>${Math.round(w.t)}</b>tłuszcz g</div><div><b>${Math.round(w.w)}</b>węgle g</div></div>
    ${wPlanie && Math.abs(f - 1) > .05 ? `<p class="note">Porcja przeliczona pod Twój plan (×${fN(f, 2)} przepisu podstawowego).</p>` : ''}
    <h3>Składniki</h3><ul class="card ing">${ing.map(([k, g]) => `<li><span>${esc(F[k] ? F[k].n : k)}</span><span>${ilosc(k, g)}</span></li>`).join('')}</ul>
    <h3>Przygotowanie</h3><ol class="steps">${(r.kroki || []).map(k => `<li><span>${esc(k)}</span></li>`).join('')}</ol>
    ${wPlanie ? `<div class="row" style="margin-top:20px"><button class="btn sec" data-act="wymien" data-d="${d}" data-s="${s}">${ik('swap')}Wymień</button><button class="btn" data-act="zjedz" data-d="${d}" data-s="${s}">${ik('ok')}${zj ? 'Odznacz' : 'Zjedzone'}</button></div>` : wstaw}`;
  };
}
function arkuszWymien(d, s) {
  return () => {
    const obecny = (planDnia(d)[s] || {}).id;
    const alt = pula(s).filter(r => r.id !== obecny).sort((a, b) => ocena(a, d, s) - ocena(b, d, s)).slice(0, 10);
    return `<h2>Na co wymienić?</h2><p class="note" style="margin:4px 0 14px">${slotInfo(s)[1]} · ${opisDnia(d)}. Porcje już przeliczone pod Twój plan.</p>
    ${alt.map(r => { const w = wartosci(skaluj(r, mnoznik(r, s)));
      return `<button class="card alt" data-act="wybierz" data-v="${r.id}" data-d="${d}" data-s="${s}">${talerz(r)}<div class="info" style="flex:1;min-width:0"><div class="mn">${esc(r.n)}</div><div class="mk">${Math.round(w.k)} kcal · ${r.t} min</div></div></button>`; }).join('')}
    <button class="btn sec" data-act="zamknij" style="margin-top:6px">Zostaw jak jest</button>`;
  };
}
function arkuszExtra() {
  return () => `<h2>Co zjadłaś poza planem?</h2><p class="note" style="margin:4px 0 14px">Wpisz nazwę i przybliżone kalorie albo wybierz z listy.</p>
    <div class="chips" style="flex-wrap:wrap">${[['Kawa z mlekiem', 40], ['Jabłko', 80], ['Ciastko', 150], ['Kawałek ciasta', 300], ['Garść orzechów', 180], ['Kromka chleba z masłem', 130], ['Lody (gałka)', 120], ['Lampka wina', 120]].map(([n, k]) => `<button class="chip" data-act="extra-szybko" data-n="${n}" data-k="${k}">${n} · ${k}</button>`).join('')}</div>
    <div class="field" style="margin-top:14px"><label for="ex-n">Nazwa</label><input class="inp" id="ex-n" placeholder="np. pączek"></div>
    <div class="field"><label for="ex-k">Kalorie</label><input class="inp" id="ex-k" type="number" inputmode="numeric" placeholder="kcal"></div>
    <button class="btn" data-act="extra-zapisz">Dodaj</button>`;
}
function arkuszUstawienia() {
  return () => {
    const p = S.profil, kc = zapotrzebowanie();
    const q = U.wq.trim().toLowerCase();
    const wyniki = q.length >= 2 ? Object.entries(F).filter(([k, f]) => f.cat !== 'przyprawy' && !S.wyklucz.includes(k) && f.n.toLowerCase().includes(q)).slice(0, 8) : [];
    return `<h2>Ustawienia</h2>
    <h3>O Tobie</h3>
    <div class="field"><label for="u-imie">Imię</label><input class="inp" id="u-imie" value="${esc(p.imie)}"></div>
    <div class="field"><div class="seg">${[['k', 'Kobieta'], ['m', 'Mężczyzna']].map(([v, n]) => `<button class="${p.plec === v ? 'on' : ''}" data-act="prof" data-k="plec" data-v="${v}">${n}</button>`).join('')}</div></div>
    <div class="grid2"><div class="field"><label for="u-wiek">Wiek</label><input class="inp" id="u-wiek" type="number" inputmode="numeric" value="${p.wiek}"></div><div class="field"><label for="u-wzrost">Wzrost (cm)</label><input class="inp" id="u-wzrost" type="number" inputmode="numeric" value="${p.wzrost}"></div></div>
    <div class="field"><label for="u-akt">Ruch na co dzień</label><select class="inp" id="u-akt">${AKT.map((a, i) => `<option value="${i}" ${p.akt === i ? 'selected' : ''}>${a.n} — ${a.o}</option>`).join('')}</select></div>
    <div class="field"><label>Cel</label><div class="seg">${[['schudnac', 'Schudnąć'], ['utrzymac', 'Utrzymać'], ['przytyc', 'Przytyć']].map(([v, n]) => `<button class="${p.cel === v ? 'on' : ''}" data-act="prof" data-k="cel" data-v="${v}">${n}</button>`).join('')}</div></div>
    ${p.cel === 'schudnac' ? `<div class="field"><div class="seg">${[[.25, 'Łagodnie'], [.5, 'Zwykle'], [.75, 'Szybciej']].map(([v, n]) => `<button class="${p.tempo === v ? 'on' : ''}" data-act="prof" data-k="tempo" data-v="${v}">${n}</button>`).join('')}</div></div>` : ''}
    <div class="field"><label for="u-kcal">Kalorie dziennie (wyliczone: ${kc})</label><input class="inp" id="u-kcal" type="number" inputmode="numeric" placeholder="zostaw puste, żeby liczyć samo" value="${p.kcalWlasne || ''}"></div>
    <button class="btn" data-act="prof-zapisz">Zapisz dane</button>
    <h3>Dieta</h3>${Object.entries(DIETY).map(([v, d]) => `<button class="card alt" style="${S.dieta === v ? 'outline:3px solid var(--green)' : ''}" data-act="dieta" data-v="${v}"><div><div class="mn" style="margin:0">${d.n}</div><div class="mk">${d.o}</div></div></button>`).join('')}
    <h3>Posiłki dziennie</h3><div class="seg">${[3, 4, 5].map(n => `<button class="${S.posilki === n ? 'on' : ''}" data-act="posilki" data-v="${n}">${n}</button>`).join('')}</div>
    <h3>Czego nie jesz</h3>
    <div class="chips" style="flex-wrap:wrap;margin-bottom:8px">${S.wyklucz.map(k => `<button class="chip on x" data-act="wyk-usun" data-v="${k}">${esc(F[k] ? F[k].n : k)} ${ik('x').replace('<svg', '<svg style="width:14px;height:14px"')}</button>`).join('') || '<span class="note">Nic nie wykluczono.</span>'}</div>
    <div class="search">${ik('szukaj')}<input class="inp" id="wyk-q" placeholder="Wpisz produkt, np. ryba, mleko…" value="${esc(U.wq)}" autocomplete="off"></div>
    <div id="wyk-wyniki">${wynikiWyk(wyniki)}</div>
    <h3>Wygląd</h3>
    <div class="field"><label>Wielkość liter</label><div class="seg">${[[false, 'Normalne'], [true, 'Duże']].map(([v, n]) => `<button class="${!!S.duze === v ? 'on' : ''}" data-act="duze" data-v="${v}">${n}</button>`).join('')}</div></div>
    <div class="field"><label>Kolory</label><div class="seg">${[['auto', 'Jak w telefonie'], ['light', 'Jasne'], ['dark', 'Ciemne']].map(([v, n]) => `<button class="${S.motyw === v ? 'on' : ''}" data-act="motyw" data-v="${v}">${n}</button>`).join('')}</div></div>
    <h3>Kopia zapasowa</h3>
    <p class="note" style="margin:0 0 10px">Dane są tylko w tym telefonie. Zrób kopię przed zmianą telefonu albo czyszczeniem przeglądarki.</p>
    <div class="row"><button class="btn sec" data-act="kopia">Zapisz kopię</button><label class="btn sec" for="wczytaj" style="cursor:pointer">Wczytaj kopię</label></div>
    <input type="file" id="wczytaj" accept="application/json,.json" hidden>
    <h3>Plan</h3>
    <button class="btn sec" data-act="od-nowa">Ułóż plan od dziś od nowa</button>
    <div style="margin-top:10px"><button class="btn danger" data-act="kasuj">${U.kasuj ? 'Na pewno? Dotknij jeszcze raz, żeby usunąć wszystko' : 'Usuń wszystkie dane'}</button></div>`;
  };
}
const wynikiWyk = w => w.map(([k, f]) => `<button class="card alt" data-act="wyk-dodaj" data-v="${k}"><div class="mn" style="margin:0;font-size:.95em">${esc(f.n)}</div><span style="margin-left:auto;color:var(--green)">${ik('plus').replace('<svg', '<svg style="width:20px;height:20px"')}</span></button>`).join('');

/* ---------- akcje ---------- */
function toast(t) { const e = document.getElementById('toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 2200); }
const liczba = (id, min, max) => { const e = document.getElementById(id); if (!e) return null; const v = parseFloat(String(e.value).replace(',', '.')); return isFinite(v) && v >= min && v <= max ? v : null; };
function przeplanuj(msg) { przyszlePlanyOdNowa(); zapisz(); widok(); odswiezArkusz(); if (msg) toast(msg); }

const AKCJE = {
  tab: v => { U.tab = v; zamknij(); widok(); scrollTo(0, 0); },
  dzien: v => { U.dzien = v; widok(); },
  tydzien: v => { U.dzien = plus(U.dzien || dzis(), +v); widok(); },
  zjedz: (v, ds) => { const d = ds.d || U.dzien, s = ds.s; const z = S.zjedz[d] || (S.zjedz[d] = {}); z[s] = !z[s]; if (!z[s]) delete z[s]; zapisz(); widok(); odswiezArkusz(); },
  przepis: (v, ds) => otworz(arkuszPrzepis(v, ds.d, ds.s)),
  wymien: (v, ds) => otworz(arkuszWymien(ds.d, ds.s)),
  wybierz: (v, ds) => { planDnia(ds.d)[ds.s] = { id: v }; zapisz(); widok(); otworz(arkuszPrzepis(v, ds.d, ds.s)); toast('Wymienione'); },
  wstaw: (v, ds) => { planDnia(ds.d)[ds.s] = { id: v }; zapisz(); zamknij(); U.tab = 'plan'; U.dzien = ds.d; widok(); toast('Dodane do planu'); },
  ulub: v => { const i = S.ulub.indexOf(v); i < 0 ? S.ulub.push(v) : S.ulub.splice(i, 1); zapisz(); widok(); odswiezArkusz(); },
  fm: v => { U.fm = v; widok(); }, ff: v => { U.ff = U.ff === v ? '' : v; widok(); },
  zakres: v => { S.zakupy.zakres = +v; zapisz(); widok(); },
  kup: v => { S.zakupy.ok[v] = !S.zakupy.ok[v]; if (!S.zakupy.ok[v]) delete S.zakupy.ok[v]; zapisz(); widok(); },
  'kup-czysc': () => { S.zakupy.ok = {}; zapisz(); widok(); },
  'extra-dodaj': () => otworz(arkuszExtra()),
  'extra-szybko': (v, ds) => { dodajExtra(ds.n, +ds.k); },
  'extra-zapisz': () => { const n = (document.getElementById('ex-n').value || '').trim(), k = liczba('ex-k', 1, 5000); if (!n || !k) return toast('Wpisz nazwę i kalorie'); dodajExtra(n, Math.round(k)); },
  'extra-usun': (v, ds) => { const a = S.extra[U.dzien] || []; a.splice(+ds.i, 1); zapisz(); widok(); },
  'waga-zapisz': () => { const kg = liczba('nowa-waga', 30, 300); if (!kg) return toast('Wpisz wagę, np. 72,5'); const t = dzis(); S.waga = S.waga.filter(x => x.d !== t); S.waga.push({ d: t, kg }); S.waga.sort((a, b) => a.d < b.d ? -1 : 1); zapisz(); widok(); toast('Zapisane'); },
  'cel-zapisz': () => { const e = document.getElementById('cel-wagi'); if (e && !e.value) { S.celWagi = null; zapisz(); widok(); return; } const kg = liczba('cel-wagi', 30, 300); if (!kg) return toast('Wpisz wagę docelową'); S.celWagi = kg; zapisz(); widok(); toast('Cel ustawiony'); },
  ustawienia: () => { U.wq = ''; otworz(arkuszUstawienia()); },
  zamknij: () => zamknij(),
  prof: (v, ds) => { S.profil[ds.k] = ds.k === 'tempo' ? +v : v; zapisz(); widok(); odswiezArkusz(); },
  'prof-zapisz': () => {
    const p = S.profil; p.imie = (document.getElementById('u-imie').value || '').trim();
    const wiek = liczba('u-wiek', 14, 100), wz = liczba('u-wzrost', 120, 220); if (!wiek || !wz) return toast('Sprawdź wiek i wzrost');
    p.wiek = wiek; p.wzrost = wz; p.akt = +document.getElementById('u-akt').value;
    const kv = document.getElementById('u-kcal').value; p.kcalWlasne = kv ? (liczba('u-kcal', 1000, 4500) || null) : null;
    if (kv && !p.kcalWlasne) return toast('Kalorie: wpisz od 1000 do 4500');
    zapisz(); widok(); odswiezArkusz(); toast('Zapisane');
  },
  dieta: v => { S.dieta = v; przeplanuj('Plan od dziś ułożony od nowa'); },
  posilki: v => { S.posilki = +v; przeplanuj('Plan od dziś ułożony od nowa'); },
  'wyk-dodaj': v => { if (!S.wyklucz.includes(v)) S.wyklucz.push(v); U.wq = ''; przeplanuj(`Wykluczone: ${F[v].n}`); },
  'wyk-usun': v => { S.wyklucz = S.wyklucz.filter(x => x !== v); przeplanuj(); },
  duze: v => { S.duze = v === 'true'; zapisz(); widok(); odswiezArkusz(); },
  motyw: v => { S.motyw = v; zapisz(); widok(); odswiezArkusz(); },
  'od-nowa': () => { przeplanuj('Nowy plan gotowy'); zamknij(); },
  kasuj: () => { if (!U.kasuj) { U.kasuj = true; return odswiezArkusz(); } try { localStorage.removeItem(KEY); } catch (e) {} S = nowy(); U.krok = 0; U.szkic = {}; zamknij(); widok(); },
  kopia: () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dieta-mamy-kopia-${dzis()}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('Kopia zapisana w Pobranych');
  },
  szkic: (v, ds) => { czytajPola(); U.szkic[ds.k] = ['akt', 'tempo'].includes(ds.k) ? +v : v; widok(); },
  'onb-wstecz': () => { czytajPola(); U.krok = Math.max(0, U.krok - 1); widok(); },
  'onb-dalej': () => {
    czytajPola();
    if (U.krok === 1) { const s = U.szkic; const ok = +s.wiek >= 14 && +s.wiek <= 100 && +s.wzrost >= 120 && +s.wzrost <= 220 && +String(s.waga).replace(',', '.') >= 35 && +String(s.waga).replace(',', '.') <= 250;
      if (!ok) { const e = document.getElementById('onb-blad'); if (e) e.textContent = 'Wpisz wiek (lata), wzrost (cm) i wagę (kg).'; return; }
      U.szkic.waga = String(s.waga).replace(',', '.'); }
    U.krok++; widok(); scrollTo(0, 0);
  },
  'onb-koniec': () => { S.profil = profilZeSzkicu(); S.dieta = U.szkic.dieta || 'standard'; S.waga = [{ d: dzis(), kg: S.profil.waga }]; S.plan = {}; zapisz(); U.tab = 'plan'; U.dzien = dzis(); widok(); scrollTo(0, 0); },
};
function dodajExtra(n, k) { const d = U.dzien || dzis(); (S.extra[d] || (S.extra[d] = [])).push({ n, k }); zapisz(); zamknij(); widok(); toast('Dodane'); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const f = AKCJE[el.dataset.act]; if (!f) return;
  e.preventDefault(); f(el.dataset.v, el.dataset);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && U.sheet) zamknij();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('li[data-act]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'szukaj') { U.q = e.target.value; const pos = e.target.selectionStart; widok(); const n = document.getElementById('szukaj'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} }
  if (e.target.id === 'wyk-q') { U.wq = e.target.value; const q = U.wq.trim().toLowerCase();
    const w = q.length >= 2 ? Object.entries(F).filter(([k, f]) => f.cat !== 'przyprawy' && !S.wyklucz.includes(k) && f.n.toLowerCase().includes(q)).slice(0, 8) : [];
    document.getElementById('wyk-wyniki').innerHTML = wynikiWyk(w); }
});
document.addEventListener('change', e => {
  if (e.target.id !== 'wczytaj' || !e.target.files[0]) return;
  const fr = new FileReader();
  fr.onload = () => { try { const s = JSON.parse(fr.result); if (!s || s.v !== 1 || !s.profil) throw 0; S = Object.assign(nowy(), s); zapisz(); zamknij(); widok(); toast('Kopia wczytana'); } catch (x) { toast('To nie jest kopia z tej aplikacji'); } };
  fr.readAsText(e.target.files[0]);
});
// nowy dzień, gdy aplikacja leży otwarta przez noc
let ostatniDzien = dzis();
document.addEventListener('visibilitychange', () => { if (!document.hidden && dzis() !== ostatniDzien) { ostatniDzien = dzis(); U.dzien = dzis(); widok(); } });

widok();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
