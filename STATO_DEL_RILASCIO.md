# Stato del rilascio LitSun — 14 novembre 2026

## Scelte definitive dell’utente

- Apertura: **opzione 2 — Ritornello**, Walking On Sunshine, segmento interno da 8,75 secondi. Incluso e configurato.
- Durata allenamenti: **10–15 minuti di attività e recuperi**; spiegazioni e preparazione non sono conteggiate e si aggiungono alla durata complessiva.
- Premi: congratulazioni persistenti con note facoltative; festoni a tutto schermo soltanto al 100% della routine giornaliera, fuori dall’area del testo.
- Notifiche: **dirette anche con LitSun chiusa**. Servizio realizzato e attivo (vedi sotto).
- Servizio notifiche ospitato nel progetto Supabase già esistente dell’utente (piano gratuito), in uno schema separato `litsun`. Nessun costo aggiuntivo.

## Incluso e verificato in questa sessione

| Parte | Stato |
|---|---|
| Frontend PWA (routine, agenda, spesa, allenamento, focus, diario, premi, backup) | Verificato con test automatici e prove in Chrome desktop con finestra da telefono |
| Servizio notifiche `litsun-push` (Supabase Edge Function + pg_cron ogni minuto) | Pubblicato. Verificati dal server: chiave pubblica, registrazione, rifiuto di richieste non autorizzate e di indirizzi non ammessi, programmazione, invio programmato, rimozione automatica di un abbonamento scaduto |
| Crittografia Web Push (RFC 8291) e firma VAPID (RFC 8292) | Verificate in locale cifrando e decifrando come farebbe il telefono |
| Interfaccia notifiche in Preferenze, prova immediata e prova programmata | Verificata nel browser (permesso, errori, stati) |

## Non ancora verificato: va fatto sui telefoni

- **iPhone: collaudato il 14 novembre 2026.** Prova programmata inviata dal servizio alle 21:07 (Apple ha accettato l’invio) e notifica ricevuta con l’app chiusa.
- **Android: consegna reale ancora da provare** (Preferenze → “Prova tra 1 minuto” con l’app chiusa).
- Installazione dalla schermata Home, voce, musica e blocco schermo su dispositivi reali.

## Limiti reali delle notifiche

- iPhone: serve iOS 16.4 o successivo e LitSun aperta dalla **schermata Home** (in Safari normale non sono disponibili).
- Il telefono invia gli orari dei prossimi 35 giorni. Ogni apertura dell’app rinnova l’elenco; se LitSun non viene aperta per circa un mese arriva un avviso per riaprirla.
- Ritardo tipico fino a circa un minuto. Risparmio energetico, telefono spento o senza rete possono ritardare o impedire la consegna: nessuna consegna è garantita al 100%.
- Ogni dispositivo va attivato separatamente; i dati non sono sincronizzati fra telefoni.
- Piano gratuito Supabase: il progetto può essere sospeso dopo una settimana di scarsa attività. Il servizio interroga il database ogni minuto, cosa che normalmente lo mantiene attivo, ma Supabase non lo garantisce: se arriva un’email di avviso, aprire il progetto dalla dashboard.
