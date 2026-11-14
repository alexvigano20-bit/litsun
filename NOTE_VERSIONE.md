# Versione 14 novembre 2026 — notifiche a app chiusa

## Inclusi

Logo LitSun/Little Sunshine, monogramma LS e otto icone approvate; apertura con l’opzione 2 (8,75 s); routine settimanali/mensili; agenda con promemoria; lista della spesa; allenamento con spiegazione prima del timer; focus; diario; premi persistenti con note facoltative; backup e ripristino JSON; funzionamento offline dopo il primo caricamento; **notifiche anche con l’app chiusa** per impegni e routine con orario.

## Novità di questa versione

- Tour guidato al primo avvio (6 passi: incoraggiamenti, routine con orari, movimento, focus, notifiche e installazione, backup). Si può saltare e rivedere da Preferenze; ogni passo salva subito le scelte.

- Servizio notifiche `litsun-push` (Supabase) e pannello in Preferenze: attivazione, prova immediata, prova programmata a 1 minuto, disattivazione, opzione per le routine e per nascondere i titoli.
- Gli avvisi si aggiornano da soli quando aggiungi, modifichi, elimini un impegno o spunti una routine (serve la rete in quel momento; altrimenti al primo ritorno online).
- Toccando una notifica si apre LitSun nella sezione giusta.
- Offline, l’audio d’apertura viene servito nel formato richiesto da Safari.
- Manifest con icona “maskable” separata, lingua e descrizione; caselle di spunta più grandi.
- File calendario rinominati `litsun-impegno.ics` / `litsun-routine.ics` (prima riportavano un vecchio nome).

## Limiti da conoscere

- Dati locali al browser: nessun account e nessuna sincronizzazione fra dispositivi.
- Notifiche: iPhone con iOS 16.4+ e app aperta dalla schermata Home; Android con Chrome. Consegna non garantita al 100% (risparmio energetico, rete, telefono spento). Collaudo sui telefoni reali ancora da fare.
- Il focus non blocca altre app. Voce e timer richiedono l’app visibile: in secondo piano il timer si sospende.
- I minuti dell’allenamento sono attività e recuperi: spiegazioni e conto alla rovescia si aggiungono.
- Su iPhone il volume dell’audio di apertura e l’abbassamento della musica durante la voce dipendono dal volume del telefono: Safari non permette alle pagine web di regolarlo.
- Il font DM Sans è caricato da Google Fonts; senza rete si usa il font di sistema (verificato: l’app resta leggibile).
- Il diario delle routine conserva il programma dei giorni visitati da questa versione in poi; per i giorni precedenti mostra solo le spunte registrate.
