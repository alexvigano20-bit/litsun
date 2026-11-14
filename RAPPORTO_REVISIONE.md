# LitSun — Rapporto di revisione (14 novembre 2026)

Pacchetto di partenza: `LitSun_pronta_per_GitHub.zip`. Tutti i sorgenti letti; i 54 test esistenti superati prima delle modifiche. Il contenuto corrispondeva alla descrizione delle istruzioni (unica differenza: il rapporto `LitSun_esito_controlli.md` è incluso nello ZIP, come previsto).

## Bloccanti

| Problema | Effetto | Correzione | Prova |
|---|---|---|---|
| Nessun servizio per notifiche a app chiusa (requisito del rilascio completo) | Gli avvisi arrivavano solo ad app aperta o tramite file calendario | Servizio `litsun-push` su Supabase (schema separato, pg_cron ogni minuto), modulo `docs/push.js`, gestione push nel service worker, pannello in Preferenze | 10 test crittografia/regole, 13 test telefono simulato + service worker, prove sul servizio pubblicato (vedi sotto) |

Nel frontend non sono stati trovati errori bloccanti né perdite di dati.

## Da correggere prima della pubblicazione (corretti)

| File | Causa → effetto | Correzione | Prova |
|---|---|---|---|
| `life.js`, `app.js` | Testi che indicavano il calendario come unico modo per gli avvisi a app chiusa | Testi aggiornati, pulsante “Imposta le notifiche” | Prova in browser |
| `life.js` | Con notifiche attive l’avviso ad app aperta avrebbe duplicato la notifica push | Ad app aperta solo il messaggio interno se le push sono attive | Revisione codice |
| `sw.js` | Offline, all’audio d’apertura chiesto “a pezzi” veniva restituito il file intero → Safari può rifiutarlo | Risposte 206/416 dalla cache | Test SW + prova offline in Chrome (206, 100 byte) |
| `manifest.webmanifest` | Icona dichiarata “any maskable” in un’unica voce (sconsigliato) | Voci separate; aggiunti lingua e descrizione. Area sicura dell’icona verificata | Controllo visivo del cerchio dell’80% |
| `life.js` | File calendario e UID con un vecchio nome (“lumi”) | `litsun-impegno.ics`, `litsun-routine.ics`, UID `litsun-…` | Download .ics in browser |
| `music.js` | Messaggio che citava un pulsante “Attiva musica” inesistente | Rimanda al pulsante reale “Musica ▶ / Ⅱ” | Revisione |
| `style.css` | Caselle di spunta nelle impostazioni di 13 px, difficili da toccare | 20 px | Misura in browser |
| `data.js` | Nuove preferenze notifiche da validare nei backup | Validazione booleana | Test |

## Migliorie successive (non indispensabili)

- Ospitare il font DM Sans insieme all’app invece che da Google Fonts (privacy e coerenza offline). Senza rete l’app resta leggibile con il font di sistema: verificato.
- Su iPhone Safari ignora il volume impostato dalle pagine: l’abbassamento della musica durante la voce non avviene. Si potrebbe passare a Web Audio.
- Sincronizzazione fra dispositivi: non richiesta, non aggiunta.

## Servizio notifiche: verifiche sul servizio pubblicato

Eseguite dal database del progetto verso la funzione pubblica: chiave pubblica restituita (200); registrazione di un abbonamento di prova (200); rifiuto di un indirizzo non ammesso (400), di un dispositivo sconosciuto (401) e di un richiamo periodico senza segreto (403); programmazione di 3 promemoria con scarto di quello già scaduto; invio programmato con risposta del servizio Google “abbonamento inesistente” e conseguente rimozione automatica del dispositivo di prova. Dati di prova rimossi. Il richiamo periodico è attivo: risposta 200 ogni minuto.

## Verifiche nel browser (Chrome desktop, finestra 320/375/390/430 px — non telefoni reali)

Apertura con audio e “Salta apertura”; navigazione nelle 8 sezioni senza barra orizzontale; completamento routine al 100% con festoni e messaggio persistente; spesa (quantità ripetuta, testo con markup mostrato come testo); impegno in agenda ed esportazione .ics; allenamento senza voce (timer fermo durante la lettura e il 3-2-1, “Rispiega” ferma il timer, interruzione nel diario); esportazione e reimportazione del backup identica; ricarica con dati conservati; service worker nella sottocartella `/litsun/`; apertura offline dalla cache; font esterno bloccato con app leggibile; pannello notifiche ed errore chiaro quando il servizio push del browser non è raggiungibile.

## Non verificato

Consegna reale delle notifiche su Android e iPhone, installazione dalla schermata Home, voce e audio sui telefoni, blocco schermo, modalità aereo reale. Un test non disponibile non è un test superato.

## Aggiunta successiva: tour guidato

Provato in Chrome a 320 e 390 px: parte dopo l’apertura solo la prima volta, salva le scelte di ogni passo, testo personale mostrato come testo, nessuna barra orizzontale, Salta/Esc chiudono senza riproporlo, riapribile da Preferenze.

## Test automatici

`TZ=Europe/Rome node tests/audit.cjs` (48) · `node tests/sw-audit.cjs` (6) · `node tests/push-audit.mjs` (10) · `TZ=Europe/Rome node tests/push-client-audit.cjs` (13).
