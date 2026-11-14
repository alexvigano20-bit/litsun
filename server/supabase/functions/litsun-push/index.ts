// LitSun · servizio notifiche a app chiusa (Supabase Edge Function).
// Dati nello schema "litsun", mai esposto alle API pubbliche. Le chiavi private
// VAPID vengono generate qui al primo avvio e restano solo nel database.
import postgres from 'npm:postgres@3.4.5';
import { generateVapidKeys, sendPush, sha256Hex, safeEqual, b64u } from './webpush.js';
import { LIMITS, validSubscription, validDeviceId, validToken, normalizeReminders, deliveryOutcome, payloadFor } from './logic.js';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL'), { prepare: false, max: 3, idle_timeout: 20 });
const VAPID_SUBJECT = 'https://alexvigano20-bit.github.io/litsun/';
let vapidCache = null, configCache = null, configAt = 0;

async function config() {
  if (configCache && Date.now() - configAt < 60000) return configCache;
  const rows = await sql`select k, v from litsun.config`;
  configCache = Object.fromEntries(rows.map(r => [r.k, r.v]));
  configAt = Date.now();
  return configCache;
}

async function vapid() {
  if (vapidCache) return vapidCache;
  let c = await config();
  if (!c.vapid_public || !c.vapid_private_jwk) {
    const keys = await generateVapidKeys();
    await sql`insert into litsun.config (k, v) values ('vapid_public', ${keys.publicKey}), ('vapid_private_jwk', ${JSON.stringify(keys.privateJwk)}) on conflict (k) do nothing`;
    configCache = null;
    c = await config();
  }
  vapidCache = { subject: VAPID_SUBJECT, publicKey: c.vapid_public, privateJwk: JSON.parse(c.vapid_private_jwk) };
  return vapidCache;
}

function cors(req, c) {
  const origin = req.headers.get('origin') || '';
  const allowed = (c.allowed_origins || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : (allowed[0] || 'null'),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

async function readBody(req) {
  const raw = await req.text();
  if (raw.length > LIMITS.maxBodyBytes) throw new Error('Richiesta troppo grande');
  return raw ? JSON.parse(raw) : {};
}

async function authDevice(body) {
  if (!validDeviceId(body.deviceId) || !validToken(body.token)) return null;
  const [d] = await sql`select * from litsun.devices where id = ${body.deviceId}`;
  if (!d) return null;
  return safeEqual(d.token_hash, await sha256Hex(body.token)) ? d : null;
}

function newToken() { return b64u.enc(crypto.getRandomValues(new Uint8Array(32))); }

async function register(body) {
  if (!validSubscription(body.subscription)) return [400, { error: 'Abbonamento push non valido o servizio non supportato' }];
  const s = body.subscription;
  const [{ total, recent }] = await sql`select count(*)::int as total, count(*) filter (where created_at > now() - interval '1 hour')::int as recent from litsun.devices`;
  const [existing] = await sql`select id from litsun.devices where endpoint = ${s.endpoint}`;
  if (!existing && (total >= LIMITS.maxDevices || recent >= LIMITS.maxNewDevicesPerHour)) return [429, { error: 'Troppe registrazioni, riprova più tardi' }];
  const token = newToken(), hash = await sha256Hex(token);
  const [row] = await sql`
    insert into litsun.devices (endpoint, p256dh, auth, token_hash)
    values (${s.endpoint}, ${s.keys.p256dh}, ${s.keys.auth}, ${hash})
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, token_hash = excluded.token_hash, failures = 0, last_sync = now()
    returning id`;
  await sql`delete from litsun.reminders where device_id = ${row.id}`;
  return [200, { deviceId: row.id, token }];
}

async function updateSubscription(device, s) {
  if (!s) return true;
  if (!validSubscription(s)) return false;
  if (s.endpoint === device.endpoint && s.keys.p256dh === device.p256dh && s.keys.auth === device.auth) return true;
  await sql`delete from litsun.devices where endpoint = ${s.endpoint} and id <> ${device.id}`;
  await sql`update litsun.devices set endpoint = ${s.endpoint}, p256dh = ${s.keys.p256dh}, auth = ${s.keys.auth}, failures = 0 where id = ${device.id}`;
  return true;
}

async function sync(body) {
  const device = await authDevice(body);
  if (!device) return [401, { error: 'Dispositivo non riconosciuto' }];
  if (!(await updateSubscription(device, body.subscription))) return [400, { error: 'Abbonamento push non valido' }];
  if (body.subscriptionOnly === true) return [200, { ok: true }];
  const list = normalizeReminders(body.reminders);
  await sql.begin(async tx => {
    await tx`delete from litsun.reminders where device_id = ${device.id}`;
    if (list.length) {
      const rows = list.map(r => ({ device_id: device.id, key: r.key, fire_at: new Date(r.at), expires_at: new Date(r.expires), title: r.title, body: r.body, url: r.url }));
      await tx`insert into litsun.reminders ${tx(rows, 'device_id', 'key', 'fire_at', 'expires_at', 'title', 'body', 'url')}`;
    }
    await tx`update litsun.devices set last_sync = now() where id = ${device.id}`;
  });
  return [200, { ok: true, scheduled: list.length }];
}

async function test(body) {
  const device = await authDevice(body);
  if (!device) return [401, { error: 'Dispositivo non riconosciuto' }];
  if (device.last_test && Date.now() - new Date(device.last_test).getTime() < LIMITS.testCooldownSeconds * 1000) return [429, { error: 'Attendi qualche secondo prima di un’altra prova' }];
  await sql`update litsun.devices set last_test = now() where id = ${device.id}`;
  const delay = Number.isInteger(body.delaySeconds) ? Math.max(0, Math.min(300, body.delaySeconds)) : 0;
  const payload = { key: 'test-' + Date.now(), title: 'LitSun', body: delay ? 'Prova riuscita: questa notifica era programmata.' : 'Prova riuscita: le notifiche funzionano.', url: './#impostazioni' };
  if (delay) {
    await sql`insert into litsun.reminders (device_id, key, fire_at, expires_at, title, body, url)
      values (${device.id}, ${payload.key}, now() + make_interval(secs => ${delay}), now() + make_interval(secs => ${delay + 3600}), ${payload.title}, ${payload.body}, './#impostazioni')`;
    return [200, { ok: true, scheduled: true }];
  }
  const result = await sendPush({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, payloadFor(payload), await vapid(), { ttl: 600, urgency: 'high' });
  if (deliveryOutcome(result.status) === 'expired') await sql`delete from litsun.devices where id = ${device.id}`;
  return [200, { ok: result.ok, status: result.status }];
}

async function unregister(body) {
  const device = await authDevice(body);
  if (!device) return [200, { ok: true }];
  await sql`delete from litsun.devices where id = ${device.id}`;
  return [200, { ok: true }];
}

async function dispatch() {
  // Rivendica i promemoria scaduti in modo atomico: due esecuzioni concorrenti non li inviano due volte.
  const due = await sql`
    with claimed as (
      select device_id, key from litsun.reminders where fire_at <= now() order by fire_at limit 300 for update skip locked
    )
    delete from litsun.reminders r using claimed c, litsun.devices d
    where r.device_id = c.device_id and r.key = c.key and d.id = r.device_id
    returning r.*, d.endpoint, d.p256dh, d.auth`;
  if (!due.length) return [200, { sent: 0 }];
  const keys = await vapid(), now = Date.now(), counts = { sent: 0, expired: 0, retry: 0, drop: 0, stale: 0 };
  const expiredDevices = new Set();
  let i = 0;
  async function worker() {
    while (i < due.length) {
      const r = due[i++];
      if (expiredDevices.has(r.device_id)) continue;
      const expires = new Date(r.expires_at).getTime();
      if (expires <= now || now - new Date(r.fire_at).getTime() > LIMITS.staleGraceMs) { counts.stale++; continue; }
      let status = 0;
      try {
        status = (await sendPush({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payloadFor(r), keys, { ttl: Math.max(60, (expires - now) / 1000), urgency: 'high' })).status;
      } catch (e) { console.error('push error', String(e).slice(0, 200)); }
      const outcome = deliveryOutcome(status);
      counts[outcome]++;
      if (outcome === 'expired') expiredDevices.add(r.device_id);
      if (outcome === 'retry' && r.attempts < 3) {
        await sql`insert into litsun.reminders (device_id, key, fire_at, expires_at, title, body, url, attempts)
          values (${r.device_id}, ${r.key}, now() + interval '2 minutes', ${r.expires_at}, ${r.title}, ${r.body}, ${r.url}, ${r.attempts + 1})
          on conflict do nothing`;
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  if (expiredDevices.size) await sql`delete from litsun.devices where id in ${sql([...expiredDevices])}`;
  return [200, counts];
}

Deno.serve(async req => {
  let c;
  try { c = await config(); } catch (e) { console.error('config', e); return new Response('Servizio non disponibile', { status: 503 }); }
  const headers = cors(req, c);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const action = new URL(req.url).searchParams.get('action') || '';
  try {
    if (req.method === 'GET' && action === 'config') {
      const v = await vapid();
      return json({ publicKey: v.publicKey, service: 'litsun-push', version: 1 }, 200, headers);
    }
    if (req.method !== 'POST') return json({ error: 'Metodo non ammesso' }, 405, headers);
    if (action === 'dispatch') {
      if (!c.cron_secret || !safeEqual(req.headers.get('x-litsun-cron') || '', c.cron_secret)) return json({ error: 'forbidden' }, 403, headers);
      const [status, data] = await dispatch();
      return json(data, status, headers);
    }
    const body = await readBody(req);
    const handler = { register, sync, test, unregister }[action];
    if (!handler) return json({ error: 'Azione sconosciuta' }, 404, headers);
    const [status, data] = await handler(body);
    return json(data, status, headers);
  } catch (e) {
    const message = e instanceof SyntaxError ? 'JSON non valido' : (e && e.message && /non valid|fuori intervallo|troppo grande/i.test(e.message) ? e.message : 'Errore del servizio');
    if (message === 'Errore del servizio') console.error(action, e);
    return json({ error: message }, message === 'Errore del servizio' ? 500 : 400, headers);
  }
});
