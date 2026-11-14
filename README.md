# LitSun — Little Sunshine

Routine di casa, agenda, lista della spesa, movimento guidato e studio. PWA in italiano per Android e iPhone, con logo e icone approvati, apertura musicale (opzione 2) e notifiche anche con l’app chiusa.

Stato verificato e limiti: `STATO_DEL_RILASCIO.md`. Dettaglio della revisione: `RAPPORTO_REVISIONE.md`.

## Struttura

- `docs/` — l’app (HTML/CSS/JavaScript, nessuna compilazione). È la cartella pubblicata da GitHub Pages.
- `server/supabase/` — servizio notifiche: funzione `litsun-push` e script SQL. Già pubblicato sul progetto Supabase; serve solo per reinstallarlo.
- `tests/` — test automatici senza librerie esterne.

## Pubblicare con GitHub Pages

1. Repository `litsun` **pubblico** (con GitHub Free Pages richiede un repository pubblico).
2. Carica i file estratti (non lo ZIP), mantenendo `docs/` e `docs/.nojekyll`.
3. Settings → Pages → **Deploy from a branch** → `main` → `/docs` → Save.
4. Indirizzo dell’app: `https://alexvigano20-bit.github.io/litsun/`.

Il servizio notifiche accetta richieste dal browser solo da `https://alexvigano20-bit.github.io` e da `http://localhost:8080`. Con un indirizzo diverso aggiorna il valore `allowed_origins` nella tabella `litsun.config`.

## Installare sul telefono

- **Android (Chrome):** apri l’indirizzo → menu ⋮ → *Installa app* o *Aggiungi a schermata Home*.
- **iPhone (Safari):** apri l’indirizzo → Condividi → *Aggiungi alla schermata Home* → apri LitSun **dall’icona**.
- Poi, in entrambi: Preferenze → *Notifiche anche con LitSun chiusa* → **Attiva le notifiche** → consenti → **Prova tra 1 minuto** e chiudi l’app.

## Aggiornare senza perdere i dati

I dati restano nel browser del telefono e un aggiornamento dei file non li cancella. Per pubblicare una nuova versione: modifica i file in `docs/`, aumenta la versione `CACHE` in `docs/sw.js` (aggiungi in `ASSETS` eventuali nuovi file) e carica le modifiche. Alla riapertura online l’app si aggiorna. Non cancellare i dati del sito per forzare l’aggiornamento.

**Cambio di indirizzo o di telefono:** nella vecchia copia Preferenze → *Esporta i dati*; nella nuova Preferenze → *Importa una copia*. I dati non si trasferiscono da soli fra indirizzi diversi. La musica scelta per gli allenamenti e l’attivazione delle notifiche non fanno parte del backup: vanno ripetute sul nuovo dispositivo.

## Provare da computer

```bash
python3 -m http.server 8080 --directory docs
TZ=Europe/Rome node tests/audit.cjs
node tests/sw-audit.cjs
node tests/push-audit.mjs
TZ=Europe/Rome node tests/push-client-audit.cjs
```

## Servizio notifiche (riferimento tecnico)

- Supabase, progetto esistente, schema `litsun` non esposto alle API pubbliche; funzione Edge `litsun-push` (`verify_jwt` disattivato: l’autorizzazione è fatta dalla funzione con un token per dispositivo, salvato solo come hash).
- Chiavi VAPID generate dal servizio e conservate solo nel database; il frontend contiene solo l’indirizzo pubblico (`docs/assets/push-config.js`).
- `pg_cron` richiama la funzione ogni minuto con un segreto generato nel database; un secondo job ogni notte elimina dispositivi inattivi da 120 giorni.
- Per reinstallare: eseguire `server/supabase/migrations/20261114_litsun_push.sql` e pubblicare i tre file di `server/supabase/functions/litsun-push/` senza verifica JWT.
- Per disattivare del tutto: `select cron.unschedule('litsun-push-dispatch');` e, se si vuole, `drop schema litsun cascade;`.

## Documentazione ufficiale

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Web Push su iPhone: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Supabase Edge Functions e Cron: https://supabase.com/docs/guides/functions · https://supabase.com/docs/guides/cron

Il segmento della canzone è incluso solo come apertura dell’app; nessun diritto sulla canzone è attribuito da questo pacchetto.
