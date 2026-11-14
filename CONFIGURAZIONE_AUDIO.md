# Audio iniziale approvato

L’utente ha scelto **opzione 2 — Ritornello** di *Walking On Sunshine* di Katrina & The Waves.

Il file interno `docs/assets/audio/apertura.mp3` è già incluso. Contiene soltanto il segmento scelto, non l’intera canzone: 8,75 secondi estratti da 00:51,55 a 01:00,30 del file originale fornito. Il taglio è già livellato e sfumato negli ultimi 0,9 secondi.

La configurazione inclusa in `docs/assets/intro-config.js` è:

```js
const LITSUN_INTRO_AUDIO = {
  src: './assets/audio/apertura.mp3',
  startSeconds: 0,
  durationSeconds: 8.75,
  fadeSeconds: 0,
  volume: 0.8
};
```

Non applicare una seconda sfumatura al segmento. Il brano parte dopo il tocco su **Entra in LitSun**, mentre resta visibile il logo selezionato. Alla fine entra nell’app; **Salta apertura** prosegue immediatamente e interrompe la musica. Se il browser non permette l’audio o il file non è disponibile, l’app deve restare accessibile.

L’audio scelto è riservato all’apertura, non viene impostato automaticamente come sottofondo degli allenamenti. Gli allenamenti conservano l’opzione distinta di scegliere un file locale.

Il file audio è nel precache per l’uso offline dopo il primo caricamento completo; offline il service worker lo serve anche a richieste parziali (206), come richiede Safari. Su iPhone il valore `volume` non ha effetto: Safari usa il volume del telefono. Provare la riproduzione su Android e iPhone reali prima di dichiarare il collaudo su quei dispositivi.
