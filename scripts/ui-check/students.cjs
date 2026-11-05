// Rauchtest + Screenshots der Studenten-Web-App in einer Sprache (Beispieldaten: Stundenplan, HÜs, Test).
//
//   Voraussetzung: Server mit Plugin läuft (frische Datenbank, STELLA_REGISTRATION=open, STELLA_EDITION_STUDENTS=server-plugin) und die
//   Web-App wird ausgeliefert (npm run build -w @stella/students-web && npx vite preview --port 5174 im Ordner web/).
//   BASE=http://127.0.0.1:5174 LOC=de OUT=/tmp/shots DB=<data>/stella.db node scripts/ui-check/students.cjs
//   Env: BASE, LOC (de|en|…), OUT, TABS (Standard: today,planner,learn,chat,settings), W, H, DB (stella.db zum Befüllen des Stundenplans)
const { chromium } = require('playwright');
const Database = require('better-sqlite3');
const BASE = process.env.BASE, OUT = process.env.OUT, LOC = process.env.LOC || 'de', PREFIX = process.env.PREFIX || 'students';
const EDITION = process.env.EDITION || 'students';
const TABS = (process.env.TABS || 'today,planner,learn,chat,settings').split(',');
const H = { 'content-type': 'application/json', 'x-stella-edition': EDITION };
const day = (n) => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };
(async () => {
  const email = `smoke${Date.now()}@example.com`;
  const reg = await (await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Mia', email, password: 'supergeheim', timeZone: 'Europe/Vienna', locale: LOC }) })).json();
  if (!reg.token) { console.log('register failed', JSON.stringify(reg)); process.exit(1); }
  const A = { ...H, authorization: `Bearer ${reg.token}` };
  if (!process.env.NOPROFILE) await fetch(`${BASE}/api/profile`, { method: 'PUT', headers: A, body: JSON.stringify({ situation: process.env.SITUATION || 'school', features: ['planner', 'homework', 'mails', 'goals', 'health'] }) });
  await fetch(`${BASE}/api/settings`, { method: 'PATCH', headers: A, body: JSON.stringify({ locale: LOC }) });
  if (!process.env.NOPROFILE) for (const text of (process.env.SEED || 'Latein HÜ S. 45 Nr. 3 Freitag|Mathe SA in 9 tagen|Französisch HÜ S. 12 morgen|Bio Referat in 5 tagen').split('|')) {
    await fetch(`${BASE}/api/chat`, { method: 'POST', headers: A, body: JSON.stringify({ text }) });
  }
  const me = await (await fetch(`${BASE}/api/me`, { headers: A })).json();
  if (process.env.DB) {
    const db = new Database(process.env.DB);
    const ins = db.prepare('INSERT INTO lessons (user_id, date, start, end, subject, subject_code, status, info) VALUES (?,?,?,?,?,?,?,?)');
    for (const [n, rows] of [[0, [['08:00', '08:50', 'Mathe', 'M', 'normal'], ['09:00', '09:50', 'Französisch', 'F', 'cancelled'], ['10:10', '11:00', 'Latein', 'L', 'normal'], ['11:10', '12:00', 'Biologie', 'BU', 'normal']]], [1, [['08:00', '08:50', 'Deutsch', 'D', 'normal'], ['09:00', '09:50', 'Mathe', 'M', 'normal']]]]) for (const r of rows) ins.run(me.id, day(n), r[0], r[1], r[2], r[3], r[4], null);
    db.close();
  }
  const browser = await chromium.launch({ headless: true, executablePath: process.env.STELLA_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: Number(process.env.W || 1280), height: Number(process.env.H || 800) }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(BASE);
  await page.evaluate(({ tk, me, PREFIX, LOC }) => {
    localStorage.setItem('evolsiorIntroShown', '1'); localStorage.setItem(`${PREFIX}.locale`, LOC); localStorage.setItem('students.plannerMode', 'calendar');
    localStorage.setItem(`${PREFIX}-state-v1`, JSON.stringify({ token: tk, me, items: {}, messages: [], outbox: [], lastSync: null, online: true, thinking: false, busyItems: [], actions: {}, conversationId: null, pinned: false, current: null, conversations: [] }));
  }, { tk: reg.token, me, PREFIX, LOC });
  for (const tab of TABS) {
    await page.goto(`${BASE}/#${tab}`); await page.reload(); await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${tab}-${LOC}.png` });
    console.log(tab.padEnd(9), (await page.innerText('body')).slice(0, 90).replace(/\n/g, ' | '));
  }
  console.log('edition:', me.edition, '| Konsolenfehler:', errors.length ? errors.slice(0, 5) : 'keine');
  await browser.close();
})();
