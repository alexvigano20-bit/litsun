// Regole di validazione condivise fra funzione e test. Nessuna dipendenza.
import { allowedEndpoint } from './webpush.js';

export const LIMITS = {
  maxReminders: 400,
  maxAheadMs: 62 * 24 * 3600 * 1000,
  maxBodyBytes: 200000,
  maxDevices: 2000,
  maxNewDevicesPerHour: 60,
  testCooldownSeconds: 20,
  staleGraceMs: 6 * 3600 * 1000,
};

const text = (v, max, empty = false) => typeof v === 'string' && v.length <= max && (empty || v.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);

export function validSubscription(s) {
  return !!s && typeof s === 'object' && allowedEndpoint(s.endpoint) && !!s.keys && typeof s.keys === 'object' &&
    typeof s.keys.p256dh === 'string' && /^[A-Za-z0-9_-]{80,100}$/.test(s.keys.p256dh) &&
    typeof s.keys.auth === 'string' && /^[A-Za-z0-9_-]{16,30}$/.test(s.keys.auth);
}

export function validDeviceId(id) { return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id); }
export function validToken(t) { return typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t); }

// Restituisce l'elenco normalizzato oppure lancia un errore leggibile.
export function normalizeReminders(list, now = Date.now()) {
  if (!Array.isArray(list) || list.length > LIMITS.maxReminders) throw new Error('Elenco promemoria non valido');
  const seen = new Set(), out = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') throw new Error('Promemoria non valido');
    if (!text(r.key, 120) || !/^[A-Za-z0-9:._-]+$/.test(r.key) || seen.has(r.key)) throw new Error('Chiave non valida');
    if (!Number.isSafeInteger(r.at) || !Number.isSafeInteger(r.expires)) throw new Error('Orario non valido');
    if (r.at > now + LIMITS.maxAheadMs || r.expires < r.at || r.expires > r.at + 8 * 24 * 3600 * 1000) throw new Error('Orario fuori intervallo');
    if (!text(r.title, 120) || !text(r.body, 200, true)) throw new Error('Testo non valido');
    seen.add(r.key);
    if (r.expires <= now) continue; // già scaduto: non serve conservarlo
    out.push({ key: r.key, at: r.at, expires: r.expires, title: r.title, body: r.body, url: r.url === './#routine' ? './#routine' : './#agenda' });
  }
  return out;
}

// Decide cosa fare dopo l'invio a un servizio push.
export function deliveryOutcome(status) {
  if (status >= 200 && status < 300) return 'sent';
  if (status === 404 || status === 410) return 'expired';
  if (status === 429 || status >= 500 || status === 0) return 'retry';
  if (status === 401 || status === 403) return 'retry'; // credenziali VAPID: problema del server, non del dispositivo
  return 'drop';
}

export function payloadFor(r) {
  return JSON.stringify({ title: r.title, body: r.body, tag: r.key, url: r.url || './#agenda' });
}
