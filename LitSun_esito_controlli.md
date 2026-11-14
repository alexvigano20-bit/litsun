# LitSun — Controlli e correzioni prima del nuovo pacchetto per Claude

Data: 14 novembre 2026. Questo documento descrive le verifiche eseguite e i loro limiti. Non è una certificazione su tutti i telefoni. Il pacchetto per Claude è stato rigenerato con le scelte confermate e il segmento musicale incluso. Il servizio di notifiche con app chiusa resta da implementare e configurare.

## Esito

- **48 scenari automatici dell’app superati**, comprendenti anche tutte le 12 combinazioni di durata/modalità/intensità allenamento.
- **6 scenari del service worker superati**, con rete e cache simulate.
- Sintassi dei sorgenti JavaScript controllata.
- Verificati riferimenti HTML, asset del precache e dimensioni reali delle icone 180/192/512 px.
- Prove nell’interfaccia desktop di apertura, routine, completamento totale, premi, spesa, agenda, focus, allenamento, diario e persistenza dopo ricarica.

I test riproducibili sono conservati nel progetto: `tests/audit.cjs` e `tests/sw-audit.cjs`. Comandi: `TZ=Europe/Rome node tests/audit.cjs` e `node tests/sw-audit.cjs`. Non richiedono librerie di test esterne.

## Problemi trovati e risolti

| Area | Problema | Correzione e verifica |
|---|---|---|
| Dati all’avvio | JSON corrotto o una struttura salvata errata potevano rendere inutilizzabile l’app. | Validazione prima del caricamento; copia originale separata scaricabile dalle Preferenze; messaggio esplicito. Provati JSON interrotto, array, numeri e oggetti incompleti. |
| Importazione backup | Controlli troppo deboli su date, orari, identificativi e alcuni valori usati nel markup. | Validazione centralizzata di routine, agenda, spesa, diario, preferenze e spunte. Un file rifiutato non sostituisce i dati esistenti. Testati import malformato, struttura invalida e ripristino valido. |
| Identificativi | Due inserimenti molto rapidi potevano ricevere lo stesso ID basato soltanto sull’orologio. | Generazione di ID univoci rispetto alle liste già presenti. Test di inserimenti ravvicinati. |
| Spesa | Una modifica con soli spazi poteva lasciare un prodotto senza nome; quantità numeriche negative erano ammesse. | Campi ripuliti e verificati prima di modificare il prodotto. Provato il rifiuto del nome vuoto anche nel browser. |
| Annullamento spesa | L’annullamento ripetuto poteva inserire duplicati; timer vecchi potevano nascondere il nuovo messaggio. | Ripristino che evita duplicati e gestione unica del timer del messaggio. Provati rimozione, annullamento e secondo annullamento. |
| Focus | Cambiare durata o pausa poteva cancellare l’obiettivo digitato. | Obiettivo conservato nelle preferenze e riproposto nel modulo. Verificato nel browser cambiando la pausa dopo aver scritto l’obiettivo. |
| Timer | Avvii ripetuti potevano creare più intervalli; l’ultimo aggiornamento poteva conteggiare una frazione di tempo oltre il termine. | Guardia contro il doppio avvio; accredito limitato al tempo residuo effettivo. Test su pausa, ultimo tick e completamento. |
| Sessione interrotta da ricarica | L’allenamento in corso poteva perdere il tempo già svolto. | Salvataggi di controllo circa ogni 5 secondi durante l’attività. Alla riapertura il tempo salvato entra nel diario come interrotto, senza riprendere automaticamente l’esercizio. La coda dopo l’ultimo salvataggio può andare persa in un arresto improvviso. Verificato anche dopo una ricarica reale dell’anteprima. |
| Storico routine | Cambiare o eliminare una routine poteva cambiare anche il programma mostrato nei giorni passati. | Da questo aggiornamento si conserva il programma dei giorni visitati. Il passato mai registrato non viene inventato: per i giorni precedenti restano le spunte disponibili. Testata modifica/eliminazione nel giorno successivo. |
| Cambio giorno | Una schermata lasciata aperta poteva continuare a mostrare l’elenco del giorno prima. | Aggiornamento al cambio data e controllo prima di spuntare una routine non più prevista oggi. |
| Agenda | Il controllo della data accettava formalmente anche giorni inesistenti. | Verifica del giorno reale, dell’anno bisestile e dell’intervallo orario. Test su 30 febbraio, 29 febbraio e orari fuori intervallo. |
| Calendario esportato | I ritorni a capo isolati nei testi importati non erano gestiti in modo completo. | Escape anche del carattere CR isolato. Verificati allarme, 24 occorrenze mensili e piegatura delle righe UTF-8. |
| Musica allenamento | La prova audio poteva continuare uscendo dalla sezione; un caricamento ritardato poteva sostituire un brano appena scelto. | Stop passando altrove o mettendo l’app in secondo piano; la lettura del brano precedente non sostituisce una selezione già attiva. Rifiutati anche file vuoti. |
| Audio di apertura | Volume zero interpretato come volume predefinito; percorso di avvio con due chiamate a play e gestione incompleta del caricamento bloccato. | Zero conservato, una sola chiamata a play, controlli sul segmento e scadenza di sicurezza. Inserita l’opzione 2; verificati avvio dopo il tocco, fine apertura e pulsante Salta. La riproduzione sui telefoni reali resta da verificare. |
| Offline e aggiornamenti | Cache con nomi condivisi potevano interferire fra più copie di LitSun sullo stesso dominio. | Cache legata al percorso di installazione; pulizia limitata alla propria copia; salvataggio delle risorse atteso prima della risposta. Verifiche automatiche con rete simulata. |

## Allenamento: verifiche specifiche

I test controllano che spiegazione e conto alla rovescia non consumino tempo dell’esercizio; la rilettura/rispiegazione ferma il tempo; una risposta vocale vecchia non avvia il passaggio sbagliato; la pausa non accredita attività; un allenamento completato registra i minuti di attività/recupero previsti; lo studio non conta le pause come minuti di concentrazione.

Nell’interfaccia è stato verificato il passaggio “Il timer aspetta te” → conferma → conto alla rovescia. La sintesi vocale effettiva di Android e iOS non è stata ascoltata/testata su dispositivi reali in questa sessione.

## Finale della routine completa

Ora il finale speciale si attiva soltanto quando tutte le routine previste per oggi sono spuntate, una volta al giorno. Nessun festone per le singole attività, per un elenco vuoto o per la sola spesa completata.

È un’animazione a tutto schermo di coriandoli/festoni che partono dai lati. L’area delle congratulazioni resta libera. Il messaggio **“Routine completata!”** e il 100% restano visibili fino al pulsante **“Prossimo step”**. L’animazione termina senza chiudere il messaggio. Le preferenze che disattivano i premi e quelle di sistema per ridurre il movimento sono rispettate.

La separazione fra particelle e testo è stata verificata visivamente nel browser. Lo scenario automatico controlla che il finale non parta prima del 100% e non venga duplicato continuando a spuntare la stessa giornata.

## Tre proposte musicali

Dal file caricato sono stati preparati tre MP3 e tre MP4 verticali con il logo approvato, con l’opzione 2 ora scelta e integrata nell’app:

| Opzione | Intervallo nel file originale | Durata | Impostazione visiva |
|---|---|---|---|
| 1 — Riff iniziale | 00:09,22–00:17,97 | 8,75 s | Logo che compare gradualmente. |
| 2 — Ritornello | 00:51,55–01:00,30 | 8,75 s | Comparsa più rapida e decisa. |
| 3 — Slancio finale | 01:04,48–01:11,03 | 6,55 s | Apertura più breve. |

Gli estratti sono livellati e sfumati. I tempi si riferiscono al file allegato, non a eventuali altre edizioni della canzone. L’utente ha scelto il ritornello, opzione 2. Le altre anteprime non sono incluse nel pacchetto di rilascio.

## Cosa non è verificato o non esiste ancora

- Installazione e uso su un Android e un iPhone reali, gestione dell’audio e del blocco schermo su quei dispositivi.
- Navigazione con una vera disconnessione della rete: la logica offline è stata testata con rete simulata, non con un telefono in modalità aereo.
- Consegna dei promemoria attraverso Apple Calendar/Google Calendar sui dispositivi reali.
- Non ci sono notifiche push programmate con app chiusa: ci sono avvisi a app aperta ed esportazione nel calendario.
- Il focus non impedisce di aprire altre app. La PWA non offre un blocco completo del telefono.
- I dati restano locali al browser, senza sincronizzazione o condivisione fra dispositivi.
- Il tempo nominale 10/12/15 minuti esclude spiegazioni e countdown, come richiesto dall’utente.

## Scelte confermate dopo il controllo

- Opzione 2 — Ritornello scelta e inserita nell’apertura: 8,75 secondi, file interno già tagliato e sfumato.
- I 10–15 minuti sono allenamento effettivo, senza spiegazioni/preparazione. Nessuna ricalibrazione per includerle.
- Richieste notifiche dirette anche con LitSun chiusa. Non sono ancora implementate: le istruzioni a Claude ora richiedono di completare e configurare il servizio di invio prima di dichiarare il rilascio completo.
- Ai 52 scenari precedenti si aggiungono 2 prove sull’apertura scelta: avvio singolo dopo il tocco e interruzione con accesso all’app. Totale attuale: 54 scenari automatici superati.

