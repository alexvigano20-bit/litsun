// LitSun · notifiche anche con l'app chiusa (Web Push).
// Il telefono calcola gli orari nel proprio fuso e li invia al servizio, che li
// consegna al momento giusto. Ogni sincronizzazione sostituisce l'elenco precedente:
// modifiche ed eliminazioni aggiornano o annullano i promemoria senza doppioni.
const PUSH_STORE = 'litsun-push';
let pushTimer = null, pushSyncing = false, pushAgain = false, pushBusy = false;

function pushApi() { return typeof LITSUN_PUSH === 'object' && typeof LITSUN_PUSH.endpoint === 'string' ? LITSUN_PUSH.endpoint : ''; }
function pushWindowDays() { const n = typeof LITSUN_PUSH === 'object' ? Number(LITSUN_PUSH.windowDays) : 35; return Number.isInteger(n) && n >= 7 && n <= 55 ? n : 35; }
function pushInfo() { try { const v = JSON.parse(localStorage.getItem(PUSH_STORE) || 'null'); return v && typeof v.deviceId === 'string' && typeof v.token === 'string' ? v : null; } catch { return null; } }
function savePushInfo(v) { try { if (v) localStorage.setItem(PUSH_STORE, JSON.stringify(v)); else localStorage.removeItem(PUSH_STORE); } catch { /* spazio non disponibile */ } }
function isIos() { return /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function isStandalone() { try { return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } }

function pushSupport() {
  if (!pushApi()) return 'unconfigured';
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return 'unsupported';
  if (isIos() && !isStandalone()) return 'ios-install';
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}
function pushActive() { return !!pushInfo() && 'Notification' in window && Notification.permission === 'granted'; }

function b64uBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), c => c.charCodeAt(0));
}
function sameServerKey(sub, publicKey) {
  try {
    const a = new Uint8Array(sub.options.applicationServerKey), b = b64uBytes(publicKey);
    return a.length === b.length && a.every((x, i) => x === b[i]);
  } catch { return true; }
}

async function pushCall(action, body, method = 'POST') {
  const init = { method, cache: 'no-store' };
  if (body) { init.headers = { 'Content-Type': 'application/json' }; init.body = JSON.stringify(body); }
  const response = await fetch(pushApi() + '?action=' + action, init);
  let data = {};
  try { data = await response.json(); } catch { /* risposta vuota */ }
  if (!response.ok) { const e = new Error(data.error || 'Errore ' + response.status); e.status = response.status; throw e; }
  return data;
}

// Il service worker legge queste credenziali solo per aggiornare un abbonamento rinnovato dal browser.
async function storeSwPushInfo(info) {
  try {
    const scope = new URL('./', location.href).href, cache = await caches.open('litsun-push-' + encodeURIComponent(scope));
    const key = new URL('./__litsun-push', scope).href;
    if (info) await cache.put(key, new Response(JSON.stringify({ api: pushApi(), deviceId: info.deviceId, token: info.token, publicKey: info.publicKey }), { headers: { 'Content-Type': 'application/json' } }));
    else await cache.delete(key);
  } catch { /* Cache API non disponibile */ }
}

function pushDateLabel(date) { return new Date(date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }); }

// Calcola i promemoria dei prossimi giorni. Solo orari futuri: nessun reinvio di avvisi già consegnati.
function buildPushReminders(now = new Date()) {
  const nowMs = now.getTime(), days = pushWindowDays(), limit = nowMs + days * 864e5;
  const hidden = state.prefs.pushPrivate === true, list = [];
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  for (let i = 0; i <= days + 8; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const date = day(d);
    for (const e of state.events || []) {
      if (!occurs(e, d)) continue;
      const eventMs = eventDate(e, date).getTime(), at = eventMs - e.reminder * 60000;
      if (!Number.isFinite(at) || at < nowMs || at > limit) continue;
      list.push({
        key: `e:${e.id}:${date}:${e.time.replace(':', '')}:${e.reminder}`,
        at, expires: eventMs + 3600000,
        title: hidden ? 'Promemoria LitSun' : e.title.slice(0, 120),
        body: hidden ? 'Hai un impegno in agenda.' : `${pushDateLabel(date)} alle ${e.time} · tra ${reminderLabel(e.reminder)}${e.important ? ' · Importante' : ''}`,
        url: './#agenda'
      });
    }
    if (state.prefs.pushRoutines !== false && i < 14) {
      for (const t of state.tasks) {
        if (!t.time || !taskDue(t, d)) continue;
        const at = new Date(`${date}T${t.time}:00`).getTime();
        if (!Number.isFinite(at) || at < nowMs || at > limit) continue;
        if (date === day(now) && state.checks[date]?.[t.id]) continue;
        list.push({ key: `t:${t.id}:${date}`, at, expires: at + 7200000, title: hidden ? 'Promemoria LitSun' : t.title.slice(0, 120), body: hidden ? 'Una routine in programma.' : 'Una piccola cosa da fare oggi · ' + t.slot, url: './#routine' });
      }
    }
  }
  list.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
  const result = list.slice(0, 399);
  // Se l'app non viene aperta per settimane, un ultimo avviso ricorda di riaprirla per rinnovare l'elenco.
  const renew = new Date(start); renew.setDate(start.getDate() + days - 2); renew.setHours(18, 0, 0, 0);
  if (renew.getTime() > nowMs) result.push({ key: 'renew:' + day(renew), at: renew.getTime(), expires: renew.getTime() + 2 * 864e5, title: 'LitSun', body: 'Apri LitSun per continuare a ricevere i promemoria dei prossimi giorni.', url: './#agenda' });
  return result;
}

function pushHash(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + text.length; }

function schedulePushSync(delay = 1500) {
  if (!pushInfo()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => syncPush(false), delay);
}

async function currentSubscription(info) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && info.publicKey && !sameServerKey(sub, info.publicKey)) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(info.publicKey) });
  return sub;
}

async function syncPush(force) {
  let info = pushInfo();
  if (!info || !pushApi()) return;
  if (pushSyncing) { pushAgain = true; return; }
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    if (info.error !== 'permission') { info.error = 'permission'; savePushInfo(info); }
    return;
  }
  const reminders = buildPushReminders(), hash = pushHash(JSON.stringify(reminders));
  if (!force && info.lastHash === hash && !info.error && Date.now() - (info.lastSync || 0) < 6 * 3600e3) return;
  pushSyncing = true;
  try {
    const sub = await currentSubscription(info);
    let result;
    try {
      result = await pushCall('sync', { deviceId: info.deviceId, token: info.token, subscription: sub.toJSON(), reminders });
    } catch (e) {
      if (e.status !== 401) throw e;
      // Il servizio non riconosce più il dispositivo (per esempio dopo una lunga inattività): nuova registrazione.
      const fresh = await pushCall('register', { subscription: sub.toJSON() });
      info = { ...info, deviceId: fresh.deviceId, token: fresh.token };
      result = await pushCall('sync', { deviceId: info.deviceId, token: info.token, reminders });
    }
    info = { ...info, endpoint: sub.endpoint, lastHash: hash, lastSync: Date.now(), scheduled: result.scheduled ?? reminders.length, until: reminders.filter(r => !r.key.startsWith('renew:')).at(-1)?.at || null, error: '' };
    savePushInfo(info);
    storeSwPushInfo(info);
  } catch (e) {
    info.error = navigator.onLine === false ? 'offline' : (e.status === 429 ? 'busy' : 'sync');
    savePushInfo(info);
  } finally {
    pushSyncing = false;
    if (pushAgain) { pushAgain = false; schedulePushSync(500); }
    if (typeof page !== 'undefined' && page === 'impostazioni' && !$('#dialog')?.open && !active) render();
  }
}

async function enablePush() {
  const support = pushSupport();
  if (support !== 'ok') { render(); return toast(pushSupportText(support)); }
  // La richiesta di permesso deve partire subito dal tocco (necessario su iPhone).
  let permission = 'default';
  try { permission = await Notification.requestPermission(); } catch { /* browser datati */ }
  if (permission !== 'granted') { render(); return toast('Notifiche non autorizzate. Puoi cambiare scelta nelle impostazioni del telefono.'); }
  pushBusy = true; render();
  try {
    const { publicKey } = await pushCall('config', null, 'GET');
    const sub = await currentSubscription({ publicKey });
    const { deviceId, token } = await pushCall('register', { subscription: sub.toJSON() });
    savePushInfo({ deviceId, token, publicKey, endpoint: sub.endpoint, lastHash: '', lastSync: 0, error: '' });
    pushBusy = false;
    await syncPush(true);
    toast(pushInfo()?.error ? 'Notifiche autorizzate, ma la programmazione non è riuscita. Riprovo appena possibile.' : 'Notifiche attivate su questo dispositivo. Fai una prova qui sotto.');
  } catch (e) {
    toast(navigator.onLine === false ? 'Serve la connessione per attivare le notifiche.'
      : e.name === 'NotAllowedError' ? 'Attivazione non riuscita: il browser non consente le notifiche qui (per esempio in navigazione privata o con il permesso bloccato).'
      : e.status ? 'Attivazione non riuscita: ' + e.message + '.'
      : 'Attivazione non riuscita: il servizio notifiche del browser non risponde. Riprova più tardi.');
  } finally { pushBusy = false; render(); }
}

async function disablePush() {
  const info = pushInfo();
  savePushInfo(null);
  storeSwPushInfo(null);
  try { if (info) await pushCall('unregister', { deviceId: info.deviceId, token: info.token }); } catch { /* il servizio eliminerà l'abbonamento al primo invio fallito */ }
  try { const reg = await navigator.serviceWorker.ready; await (await reg.pushManager.getSubscription())?.unsubscribe(); } catch { /* già rimosso */ }
  render();
  toast('Notifiche a app chiusa disattivate su questo dispositivo.');
}

async function testPush(delaySeconds = 0) {
  const info = pushInfo();
  if (!info) return;
  try {
    const r = await pushCall('test', { deviceId: info.deviceId, token: info.token, delaySeconds });
    if (delaySeconds) toast('Prova programmata: chiudi LitSun e attendi circa ' + Math.round(delaySeconds / 60) + ' minuto.');
    else toast(r.ok ? 'Prova inviata: la notifica dovrebbe arrivare tra pochi secondi.' : 'Il servizio push del telefono ha rifiutato la prova (codice ' + r.status + '). Disattiva e riattiva le notifiche.');
  } catch (e) { toast(e.status === 429 ? 'Attendi qualche secondo prima di un’altra prova.' : 'Prova non riuscita: ' + (e.message || 'connessione assente')); }
}

function setPushPref(key, value) { state.prefs[key] = value; save(); schedulePushSync(300); }

function pushSupportText(support) {
  return {
    unconfigured: 'Questa copia di LitSun non ha un servizio notifiche configurato. Usa l’esportazione nel calendario.',
    unsupported: 'Questo browser non supporta le notifiche web. Usa l’esportazione nel calendario oppure apri LitSun con Chrome (Android) o dalla schermata Home (iPhone).',
    'ios-install': 'Su iPhone le notifiche funzionano solo dall’app installata: in Safari tocca Condividi → Aggiungi alla schermata Home, apri LitSun dall’icona e torna qui. Serve iOS 16.4 o successivo.',
    denied: 'Le notifiche per LitSun sono bloccate. Riattivale dalle impostazioni del telefono (Notifiche → LitSun) o del browser, poi torna qui.'
  }[support] || '';
}

function pushPanel() {
  const support = pushSupport(), info = pushInfo(), on = pushActive();
  const fmtDate = ms => new Date(ms).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const errorText = { offline: 'Ultimo aggiornamento non riuscito: connessione assente. Riprovo da solo.', sync: 'Ultimo aggiornamento non riuscito. Riprovo all’apertura successiva.', busy: 'Servizio occupato. Riprovo tra poco.', permission: 'Il permesso alle notifiche è stato tolto: riattivalo dalle impostazioni del telefono.' };
  let status;
  if (pushBusy) status = 'Attivazione in corso…';
  else if (on) status = `<b>Attive su questo dispositivo.</b> ${info.scheduled ?? 0} promemoria programmati${info.until ? ' fino al ' + esc(fmtDate(info.until)) : ''}.${info.lastSync ? ' Ultimo aggiornamento: ' + esc(fmtDate(info.lastSync)) + '.' : ''}${info.error ? '<br>' + esc(errorText[info.error] || errorText.sync) : ''}`;
  else if (info && support === 'denied') status = esc(pushSupportText('denied'));
  else if (support !== 'ok') status = esc(pushSupportText(support));
  else status = 'Ricevi l’avviso degli impegni e delle routine con orario anche quando LitSun è chiusa.';
  const buttons = on
    ? `<button class="btn" onclick="testPush(0)">Invia una prova</button><button class="btn secondary" onclick="testPush(60)">Prova tra 1 minuto</button><button class="text" onclick="disablePush()">Disattiva</button>`
    : (support === 'ok' && !pushBusy ? `<button class="btn" onclick="enablePush()">Attiva le notifiche</button>` : (info ? `<button class="text" onclick="disablePush()">Rimuovi questo dispositivo</button>` : ''));
  return `<section class="card" id="pushCard" style="margin-top:20px"><h2>Notifiche anche con LitSun chiusa</h2><p class="notice" role="status">${status}</p><div class="toolbar">${buttons}</div>
  <label style="display:block;margin-top:16px"><input type="checkbox" ${state.prefs.pushRoutines !== false ? 'checked' : ''} onchange="setPushPref('pushRoutines',this.checked)"> Avvisami anche per le routine con orario</label>
  <label style="display:block;margin-top:10px"><input type="checkbox" ${state.prefs.pushPrivate === true ? 'checked' : ''} onchange="setPushPref('pushPrivate',this.checked)"> Nascondi i titoli nelle notifiche (utile se il telefono le mostra a schermo bloccato)</label>
  <details style="margin-top:16px"><summary>Come funziona e limiti</summary><p class="muted" style="font-size:13px;margin-top:12px">Il telefono calcola gli orari nel suo fuso orario e li invia al servizio LitSun (Supabase, server in Irlanda), che li consegna tramite il servizio push del telefono (Google o Apple). Vengono inviati solo titolo, data e orario dei promemoria dei prossimi ${pushWindowDays()} giorni; ogni promemoria viene cancellato dal servizio appena inviato. Diario, spesa e note restano solo su questo dispositivo.</p><p class="muted" style="font-size:13px">Modifiche ed eliminazioni aggiornano gli avvisi quando sei online. L’orario può ritardare di circa un minuto; con risparmio energetico, telefono spento o senza rete la consegna può arrivare dopo o non arrivare. Se non apri LitSun per circa ${pushWindowDays()} giorni, ricevi un avviso per riaprirla e rinnovare l’elenco. Ogni telefono va attivato separatamente.</p><p class="muted" style="font-size:13px">Android: Chrome o app installata. iPhone: iOS 16.4 o successivo e LitSun aperta dalla schermata Home. Per gli impegni importanti puoi aggiungere anche la copia nel calendario.</p></details></section>`;
}

// Avvio: aggiorna l'elenco a ogni apertura, al ritorno nell'app e al ritorno della rete.
function pushStartup() {
  if (!pushInfo()) return;
  syncPush(false);
}
window.addEventListener('load', () => setTimeout(pushStartup, 2500));
document.addEventListener('visibilitychange', () => { if (!document.hidden) schedulePushSync(2000); });
window.addEventListener('online', () => schedulePushSync(1000));
navigator.serviceWorker?.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'litsun-open' || typeof data.hash !== 'string') return;
  const target = data.hash.replace('#', '');
  if (['agenda', 'routine', 'impostazioni', 'oggi'].includes(target) && typeof go === 'function') go(target);
});
