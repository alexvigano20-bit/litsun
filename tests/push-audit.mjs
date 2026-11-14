// Test del servizio push senza rete: cifratura RFC 8291, firma VAPID RFC 8292,
// validazione delle richieste e regole di consegna. Comando: node tests/push-audit.mjs
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { encryptPayload, generateVapidKeys, vapidAuthorization, allowedEndpoint, sendPush, b64u, concat, sha256Hex, safeEqual } from '../server/supabase/functions/litsun-push/webpush.js';
import { normalizeReminders, deliveryOutcome, validSubscription, validToken, payloadFor } from '../server/supabase/functions/litsun-push/logic.js';

const subtle = webcrypto.subtle, te = new TextEncoder(), td = new TextDecoder();
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };

async function hkdf(salt, ikm, info, len) {
  const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
// Simula il browser: chiavi del dispositivo e decifratura secondo RFC 8291.
async function browserKeys() {
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const auth = webcrypto.getRandomValues(new Uint8Array(16));
  return { pair, keys: { p256dh: b64u.enc(pub), auth: b64u.enc(auth) }, pub, auth };
}
async function decrypt(body, ua) {
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), idlen = body[20];
  const asPub = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
  assert.equal(rs, 4096);
  const asKey = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.pair.privateKey, 256));
  const ikm = await hkdf(ua.auth, shared, concat(te.encode('WebPush: info\0'), ua.pub, asPub), 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
  let end = plain.length - 1; while (plain[end] === 0) end--;
  assert.equal(plain[end], 2, 'delimitatore ultimo record');
  return td.decode(plain.slice(0, end));
}

await test('payload cifrato e decifrabile dal dispositivo (RFC 8291)', async () => {
  const ua = await browserKeys();
  const msg = JSON.stringify({ title: 'Colloquio è domani', body: 'Alle 09:30 · città, “virgolette”', tag: 'e:1:2026-11-20:09:30:1440' });
  const body = await encryptPayload(msg, ua.keys);
  assert.equal(await decrypt(body, ua), msg);
});
await test('ogni invio usa sale e chiavi diverse', async () => {
  const ua = await browserKeys();
  const a = await encryptPayload('x', ua.keys), b = await encryptPayload('x', ua.keys);
  assert.notDeepEqual(a.slice(0, 16), b.slice(0, 16));
});
await test('chiavi dispositivo non valide rifiutate', async () => {
  await assert.rejects(encryptPayload('x', { p256dh: b64u.enc(new Uint8Array(10)), auth: b64u.enc(new Uint8Array(16)) }));
});
await test('intestazione VAPID firmata e verificabile (RFC 8292)', async () => {
  const keys = await generateVapidKeys(), vapid = { subject: 'https://alexvigano20-bit.github.io/litsun/', ...keys };
  const h = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', vapid, 1800000000);
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h);
  assert.ok(m); assert.equal(m[4], keys.publicKey);
  const claims = JSON.parse(td.decode(b64u.dec(m[2])));
  assert.equal(claims.aud, 'https://fcm.googleapis.com'); assert.equal(claims.exp, 1800000000 + 43200); assert.match(claims.sub, /^https:\/\//);
  const pub = await subtle.importKey('raw', b64u.dec(keys.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64u.dec(m[3]), te.encode(m[1] + '.' + m[2])));
  assert.equal(b64u.dec(keys.publicKey).length, 65);
});
await test('solo servizi push riconosciuti (niente indirizzi arbitrari)', async () => {
  for (const ok of ['https://fcm.googleapis.com/fcm/send/x', 'https://web.push.apple.com/QAbc', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://wns2-db5p.notify.windows.com/w/?token=1'])
    assert.ok(allowedEndpoint(ok), ok);
  for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.example/x', 'https://fcm.googleapis.com.evil.example/x', 'https://fcm.googleapis.com:8443/x', 'https://127.0.0.1/x', 'javascript:alert(1)', 'https://x.supabase.co/functions/v1/litsun-push'])
    assert.ok(!allowedEndpoint(bad), bad);
});
await test('richiesta inviata con intestazioni corrette e TTL limitato', async () => {
  const ua = await browserKeys(), keys = await generateVapidKeys();
  let seen;
  const r = await sendPush({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: ua.keys }, '{"a":1}', { subject: 'https://x.example/', ...keys }, { ttl: 99999999, fetchImpl: async (url, init) => { seen = { url, init }; return { ok: true, status: 201, text: async () => '' }; } });
  assert.equal(r.status, 201); assert.equal(seen.init.headers['Content-Encoding'], 'aes128gcm'); assert.equal(seen.init.headers.TTL, '2419200');
  assert.equal(await decrypt(seen.init.body, ua), '{"a":1}');
});
await test('validazione abbonamento e token', async () => {
  const ua = await browserKeys();
  assert.ok(validSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: ua.keys }));
  assert.ok(!validSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: '<script>', auth: 'x' } }));
  assert.ok(validToken(b64u.enc(new Uint8Array(32)))); assert.ok(!validToken('corto'));
  assert.ok(safeEqual(await sha256Hex('a'), await sha256Hex('a'))); assert.ok(!safeEqual(await sha256Hex('a'), await sha256Hex('b')));
});
const now = Date.parse('2026-11-14T10:00:00Z');
const r = (o = {}) => ({ key: 'e:1:2026-11-15:09:00:1440', at: now + 3600e3, expires: now + 7200e3, title: 'Esame', body: 'Domani alle 09:00', ...o });
await test('promemoria validi normalizzati, scaduti scartati', async () => {
  const out = normalizeReminders([r(), r({ key: 'old', at: now - 7200e3, expires: now - 3600e3 })], now);
  assert.equal(out.length, 1); assert.equal(out[0].url, './#agenda');
});
await test('promemoria non validi rifiutati', async () => {
  for (const bad of [r({ key: 'a b' }), r({ at: 1.5 }), r({ at: now + 70 * 864e5, expires: now + 70 * 864e5 }), r({ expires: now }), r({ title: '' }), r({ title: 'x'.repeat(121) }), r({ body: 'a\u0001' }), null])
    assert.throws(() => normalizeReminders([bad], now));
  assert.throws(() => normalizeReminders([r(), r()], now), /Chiave/);
  assert.throws(() => normalizeReminders(Array.from({ length: 401 }, (_, i) => r({ key: 'k' + i })), now));
  assert.throws(() => normalizeReminders('x', now));
});
await test('esito consegna: abbonamento scaduto, ritentativo, scarto', async () => {
  assert.equal(deliveryOutcome(201), 'sent'); assert.equal(deliveryOutcome(410), 'expired'); assert.equal(deliveryOutcome(404), 'expired');
  assert.equal(deliveryOutcome(429), 'retry'); assert.equal(deliveryOutcome(503), 'retry'); assert.equal(deliveryOutcome(0), 'retry'); assert.equal(deliveryOutcome(413), 'drop');
  assert.deepEqual(JSON.parse(payloadFor({ key: 'k', title: 't', body: 'b' })), { title: 't', body: 'b', tag: 'k', url: './#agenda' });
});
console.log(`\n${passed} scenari del servizio push superati (crittografia e regole verificate in locale; consegna reale da verificare sui telefoni).`);
