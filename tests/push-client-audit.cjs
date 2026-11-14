// Notifiche: calcolo dei promemoria sul telefono e gestione nel service worker.
// Comando: TZ=Europe/Rome node tests/push-client-audit.cjs
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const site = path.join(__dirname, '../docs');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };

function app(wallIso) {
  const wall = Date.parse(wallIso), NativeDate = Date;
  class ClockDate extends NativeDate { constructor(...a) { super(...(a.length ? a : [wall])); } static now() { return wall; } }
  const nodes = new Map(), store = new Map();
  const node = s => { if (!nodes.has(s)) nodes.set(s, { value: '', hidden: false, innerHTML: '', textContent: '', style: {}, open: false, setAttribute() {}, addEventListener() {}, showModal() {}, close() {}, focus() {}, querySelector() { return node('x'); } }); return nodes.get(s); };
  const c = { console, Date: ClockDate, Intl, performance: { now: () => 0 }, TextEncoder, structuredClone, URL, atob, btoa,
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }), isSecureContext: true }, navigator: { userAgent: 'Android Chrome', onLine: true },
    document: { hidden: false, querySelector: node, body: { style: {} }, addEventListener() {}, activeElement: node('b') },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) },
    location: { href: 'https://example.org/litsun/', hash: '' }, setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
    LITSUN_PUSH: { endpoint: 'https://x.supabase.co/functions/v1/litsun-push', windowDays: 35 } };
  vm.createContext(c);
  for (const f of ['data.js', 'music.js', 'rewards.js', 'life.js', 'push.js', 'app.js']) {
    let s = fs.readFileSync(path.join(site, f), 'utf8');
    if (f === 'app.js') s = s.slice(0, s.indexOf('recoverSessionDraft();upgradeState();'));
    if (f === 'push.js') s = s.replace(/^const LITSUN_PUSH.*$/m, '');
    vm.runInContext(s, c, { filename: f });
  }
  const run = s => vm.runInContext(s, c);
  run("state.events=[];state.shopping=[];state.alerted={};state.tasks=[]");
  return { run, store };
}

(async () => {
  await test('impegno con anticipo: un solo promemoria all’orario giusto, chiave stabile', () => {
    const a = app('2026-11-14T10:00:00');
    a.run("state.events=[{id:7,title:'Colloquio',date:'2026-11-20',time:'09:30',repeat:'none',reminder:1440,category:'Lavoro',notes:'',important:true}]");
    const list = JSON.parse(a.run('JSON.stringify(buildPushReminders())')).filter(r => r.key.startsWith('e:'));
    assert.equal(list.length, 1);
    assert.equal(list[0].key, 'e:7:2026-11-20:0930:1440');
    assert.equal(new Date(list[0].at).toISOString(), '2026-11-19T08:30:00.000Z');
    assert.match(list[0].body, /09:30 · tra 1 giorno · Importante/);
    assert.equal(a.run('JSON.stringify(buildPushReminders())'), a.run('JSON.stringify(buildPushReminders())'));
  });
  await test('ora legale: stesso orario locale prima e dopo il cambio', () => {
    const a = app('2027-03-20T08:00:00');
    a.run("state.events=[{id:8,title:'Affitto',date:'2027-03-21',time:'09:00',repeat:'weekly',reminder:60,category:'Scadenza',notes:''}]");
    const list = JSON.parse(a.run('JSON.stringify(buildPushReminders())')).filter(r => r.key.startsWith('e:'));
    const before = list.find(r => r.key.includes('2027-03-21')), after = list.find(r => r.key.includes('2027-03-28'));
    assert.equal(new Date(before.at).toISOString(), '2027-03-21T07:00:00.000Z'); // CET +1
    assert.equal(new Date(after.at).toISOString(), '2027-03-28T06:00:00.000Z');  // CEST +2
  });
  await test('ricorrenza mensile il 31: ultimo giorno nei mesi corti', () => {
    const a = app('2027-01-30T10:00:00');
    a.run("state.events=[{id:9,title:'Affitto',date:'2026-12-31',time:'10:00',repeat:'monthly',reminder:10,category:'Scadenza',notes:''}]");
    const keys = JSON.parse(a.run('JSON.stringify(buildPushReminders())')).map(r => r.key);
    assert.ok(keys.includes('e:9:2027-01-31:1000:10')); assert.ok(keys.includes('e:9:2027-02-28:1000:10'));
  });
  await test('orari passati esclusi: nessun reinvio dopo una nuova sincronizzazione', () => {
    const a = app('2026-11-14T10:00:00');
    a.run("state.events=[{id:1,title:'Esame',date:'2026-11-14',time:'10:20',repeat:'none',reminder:30,category:'Studio',notes:''}]");
    assert.equal(a.run("buildPushReminders().filter(r=>r.key.startsWith('e:')).length"), 0);
  });
  await test('routine con orario: esclusa se già spuntata oggi, preferenza rispettata', () => {
    const a = app('2026-11-14T07:00:00');
    a.run("state.tasks=[{id:3,title:'Rifare il letto',slot:'Mattina',time:'08:00',days:[0,1,2,3,4,5,6],repeat:'weekly'},{id:4,title:'Senza orario',slot:'Sera',days:[0,1,2,3,4,5,6]}]");
    assert.ok(a.run("buildPushReminders().some(r=>r.key==='t:3:2026-11-14')"));
    assert.ok(!a.run("buildPushReminders().some(r=>r.key.startsWith('t:4'))"));
    a.run("state.checks['2026-11-14']={3:true}");
    assert.ok(!a.run("buildPushReminders().some(r=>r.key==='t:3:2026-11-14')"));
    assert.ok(a.run("buildPushReminders().some(r=>r.key==='t:3:2026-11-15')"));
    a.run('state.prefs.pushRoutines=false');
    assert.equal(a.run("buildPushReminders().filter(r=>r.key.startsWith('t:')).length"), 0);
  });
  await test('modalità riservata: nessun titolo nelle notifiche', () => {
    const a = app('2026-11-14T10:00:00');
    a.run("state.prefs.pushPrivate=true;state.events=[{id:5,title:'Visita privata',date:'2026-11-16',time:'09:00',repeat:'none',reminder:60,category:'Personale',notes:'x'}]");
    const s = a.run('JSON.stringify(buildPushReminders())');
    assert.ok(!s.includes('Visita privata')); assert.ok(s.includes('Promemoria LitSun'));
  });
  await test('limite e avviso di rinnovo sempre presenti, formato accettato dal servizio', async () => {
    const a = app('2026-11-14T10:00:00');
    a.run("state.tasks=Array.from({length:40},(_,i)=>({id:i+1,title:'Routine '+i,slot:'Sera',time:'20:00',days:[0,1,2,3,4,5,6],repeat:'weekly'}))");
    const list = JSON.parse(a.run('JSON.stringify(buildPushReminders())'));
    assert.equal(list.length, 400); assert.ok(list.at(-1).key.startsWith('renew:'));
    const { normalizeReminders } = await import('../server/supabase/functions/litsun-push/logic.js');
    assert.equal(normalizeReminders(list, Date.parse('2026-11-14T10:00:00')).length, 400);
  });
  await test('backup con preferenze notifiche valido; valori errati rifiutati', () => {
    const a = app('2026-11-14T10:00:00');
    a.run('state.prefs.pushRoutines=false;state.prefs.pushPrivate=true;validateState(JSON.parse(JSON.stringify(state)))');
    assert.throws(() => a.run("validateState({...JSON.parse(JSON.stringify(state)),prefs:{...state.prefs,pushPrivate:'si'}})"));
  });
  await test('credenziali notifiche fuori dal backup JSON', () => {
    const a = app('2026-11-14T10:00:00');
    a.run("savePushInfo({deviceId:'d',token:'t'})");
    assert.ok(a.store.has('litsun-push')); assert.ok(!a.run('JSON.stringify(state)').includes('token'));
  });

  // Service worker: notifiche e audio offline
  const handlers = {}, shown = [], scope = 'https://example.org/litsun/', posted = [], opened = [];
  const entries = new Map();
  const cache = { async addAll() {}, async put(r, v) { entries.set(typeof r === 'string' ? r : r.url, v); }, async match(r) { return entries.get(typeof r === 'string' ? r : r.url); }, async delete() {} };
  const sw = { self: { registration: { scope, showNotification: async (t, o) => shown.push([t, o]), pushManager: {} }, location: { origin: 'https://example.org' }, addEventListener: (n, f) => handlers[n] = f, skipWaiting: async () => {}, clients: { claim: async () => {}, matchAll: async () => clientsList, openWindow: async u => opened.push(u) } }, URL, Response, atob, caches: { open: async () => cache, keys: async () => [], delete: async () => {} }, fetch: async () => { throw Error('offline'); } };
  let clientsList = [];
  vm.createContext(sw); vm.runInContext(fs.readFileSync(path.join(site, 'sw.js'), 'utf8'), sw);
  const fire = async (name, extra) => { let p; handlers[name]({ waitUntil: x => p = x, ...extra }); await p; };
  await test('SW mostra la notifica ricevuta con titolo, testo e destinazione', async () => {
    await fire('push', { data: { json: () => ({ title: 'Colloquio', body: 'Domani alle 09:30', tag: 'e:7', url: './#agenda' }) } });
    assert.equal(shown[0][0], 'Colloquio'); assert.equal(shown[0][1].tag, 'e:7'); assert.equal(shown[0][1].data.url, scope + '#agenda');
  });
  await test('SW: contenuto anomalo non apre indirizzi esterni e mostra comunque una notifica', async () => {
    await fire('push', { data: { json: () => ({ title: '', url: 'https://evil.example/' }) } });
    assert.equal(shown[1][0], 'LitSun'); assert.equal(shown[1][1].data.url, scope);
    await fire('push', { data: { json: () => { throw Error('x'); }, text: () => 'testo' } });
    assert.equal(shown[2][1].body, 'testo');
  });
  await test('SW: tocco sulla notifica porta all’app già aperta oppure la apre', async () => {
    let closed = false, focused = false;
    const note = { close: () => closed = true, data: { url: scope + '#agenda' } };
    await fire('notificationclick', { notification: note });
    assert.ok(closed); assert.equal(opened.join(), scope + '#agenda');
    clientsList = [{ url: scope + '#oggi', postMessage: m => posted.push(m), focus: async () => { focused = true; } }];
    await fire('notificationclick', { notification: note });
    assert.ok(focused); assert.equal(JSON.stringify(posted[0]), JSON.stringify({ type: 'litsun-open', hash: '#agenda' }));
  });
  await test('SW: audio offline servito a pezzi (206) come richiesto da Safari', async () => {
    const bytes = new Uint8Array(1000).map((_, i) => i % 256);
    entries.set(scope + 'assets/audio/apertura.mp3', new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } }));
    let res; handlers.fetch({ request: { url: scope + 'assets/audio/apertura.mp3', method: 'GET', mode: 'no-cors', headers: new Headers({ range: 'bytes=10-19' }) }, respondWith: p => res = p });
    res = await res;
    assert.equal(res.status, 206); assert.equal(res.headers.get('Content-Range'), 'bytes 10-19/1000');
    assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    entries.set(scope + 'assets/audio/apertura.mp3', new Response(bytes));
    handlers.fetch({ request: { url: scope + 'assets/audio/apertura.mp3', method: 'GET', mode: 'no-cors', headers: new Headers({ range: 'bytes=5000-' }) }, respondWith: p => res = p });
    assert.equal((await res).status, 416);
  });
  console.log(`\n${passed} scenari notifiche (telefono simulato e service worker) superati. La consegna reale va provata su Android e iPhone.`);
})().catch(e => { console.error(e); process.exit(1); });
