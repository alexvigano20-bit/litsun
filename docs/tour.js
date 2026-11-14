// LitSun · tour guidato delle prime impostazioni.
// Parte una sola volta dopo l'apertura; si può saltare e rivedere da Preferenze.
// Ogni passo salva subito le scelte: interrompere il tour non perde nulla.
let tourStep = 0;
const TOUR_STEPS = ['welcome', 'praise', 'routines', 'movement', 'focus', 'access', 'done'];
const TOUR_IDEAS = [['Prepara il necessario per domani', 'Sera', '21:30'], ['Fai due minuti lontano dagli schermi', 'Pomeriggio', '16:00'], ['Annaffia le piante', 'Mattina', '09:00'], ['Porta fuori la spazzatura', 'Sera', '21:00']];

function maybeStartTour() {
  if (state.prefs.tourDone || active || $('#dialog').open || document.querySelector('#rewardCard')) return;
  startTour();
}

function startTour() {
  tourStep = 0;
  const d = $('#dialog');
  d.classList.add('tour');
  d.onclose = () => { d.classList.remove('tour'); d.onclose = null; if (!state.prefs.tourDone) { state.prefs.tourDone = true; save(); } };
  drawTour();
  if (!d.open) d.showModal();
}

function tourProgress() {
  const n = TOUR_STEPS.length - 2;
  return tourStep > 0 && tourStep <= n ? `<p class="tour-count" aria-label="Passo ${tourStep} di ${n}">${Array.from({ length: n }, (_, i) => `<i class="${i < tourStep ? 'on' : ''}"></i>`).join('')}<span>${tourStep} di ${n}</span></p>` : '';
}

function tourNav(next = 'Avanti', back = true) {
  return `<div class="toolbar">${back ? '<button class="btn secondary" type="button" onclick="tourGo(-1)">Indietro</button>' : ''}<button class="btn" type="submit">${next} →</button></div><button class="text tour-skip" type="button" onclick="finishTour(true)">Salta il tour</button>`;
}

function tourRadio(name, value, current, label, hint = '') {
  return `<label class="tour-option"><input type="radio" name="${name}" value="${value}" ${String(value) === String(current) ? 'checked' : ''}><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span></label>`;
}

function drawTour() {
  const p = state.prefs, step = TOUR_STEPS[tourStep];
  let html = '';
  if (step === 'welcome') html = `<span class="eyebrow">BENVENUTO IN LITSUN</span><h2>Sistemiamo LitSun su misura per te.</h2><p class="muted">Due minuti, sei piccoli passi: incoraggiamenti, routine, movimento, studio e promemoria. Potrai cambiare tutto quando vuoi.</p>${tourNav('Iniziamo', false)}`;
  if (step === 'praise') html = `${tourProgress()}<h2>Come vuoi essere incoraggiato?</h2><p class="muted">Quando completi qualcosa, LitSun ti dedica un piccolo complimento.</p>${tourRadio('praiseForm', 'neutral', p.praiseForm || 'neutral', 'Frasi senza genere', '“Ben fatto!”, “Ce l’hai fatta!”')}${tourRadio('praiseForm', 'feminine', p.praiseForm, 'Al femminile', '“Brava!”, “Bravissima!”')}${tourRadio('praiseForm', 'masculine', p.praiseForm, 'Al maschile', '“Bravo!”, “Bravissimo!”')}<label class="tour-check"><input type="checkbox" name="rewards" ${p.rewards !== false ? 'checked' : ''}> Mostra complimenti e festeggiamenti</label>${tourNav()}`;
  if (step === 'routines') {
    const rows = state.tasks.map(t => `<div class="tour-task"><label><input type="checkbox" name="keep" value="${t.id}" checked> <span>${esc(t.title)}<small>${t.repeat === 'monthly' ? 'Ogni mese, giorno ' + t.monthDay : t.days.length === 7 ? 'Ogni giorno' : t.days.map(x => ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][x]).join(', ')}</small></span></label><input type="time" name="time-${t.id}" value="${esc(t.time || '')}" aria-label="Orario per ${esc(t.title)}"></div>`).join('');
    const ideas = TOUR_IDEAS.filter(([title]) => !state.tasks.some(t => t.title === title)).map(([title], i) => `<label class="tour-check"><input type="checkbox" name="idea" value="${i}"> ${esc(title)}</label>`).join('');
    html = `${tourProgress()}<h2>Le tue routine</h2><p class="muted">Togli la spunta a ciò che non ti serve. Con un orario, LitSun può avvisarti; lascia vuoto se non vuoi avvisi.</p><div class="tour-list">${rows || '<p class="empty">Nessuna routine: aggiungine una qui sotto.</p>'}</div>${ideas ? `<p class="muted" style="margin-top:18px">Vuoi aggiungerne qualcuna?</p>${ideas}` : ''}<label class="field" style="margin-top:14px">Una tua routine (facoltativa)<input name="custom" maxlength="100" placeholder="Es. stendere il bucato"></label><p class="muted" style="font-size:12px">Giorni e frequenza si cambiano poi in Routine, con ⋯.</p>${tourNav()}`;
  }
  if (step === 'movement') html = `${tourProgress()}<h2>Un po’ di movimento</h2><p class="muted">Sessioni a casa, senza salti. I minuti sono di attività e recupero: le spiegazioni si aggiungono e non vengono conteggiate.</p><label class="field">Tempo a disposizione<select name="duration">${options([[10, '10 minuti'], [12, '12 minuti'], [15, '15 minuti']], p.duration)}</select></label><label class="field" style="margin-top:12px">Di solito preferisci<select name="mode">${options([['strength', 'Forza leggera'], ['stretch', 'Mobilità e stretching']], p.mode)}</select></label><label class="field" style="margin-top:12px">Intensità<select name="level">${options([['gentle', 'Dolce · 30 s + 30 s recupero'], ['regular', 'Regolare · 40 s + 20 s recupero']], p.level)}</select></label><label class="tour-check"><input type="checkbox" name="voice" ${p.voice ? 'checked' : ''}> Guida vocale durante gli esercizi</label><p class="muted" style="font-size:12px">Se hai limitazioni o infortuni, concorda gli esercizi con un professionista.</p>${tourNav()}`;
  if (step === 'focus') html = `${tourProgress()}<h2>Tempo per studiare o concentrarti</h2><p class="muted">Blocchi di concentrazione con pause vere. Sono punti di partenza: puoi cambiarli in Focus.</p>${tourRadio('preset', '25-5', p.focus + '-' + p.break, '25 minuti + 5 di pausa', 'Per iniziare')}${tourRadio('preset', '45-10', p.focus + '-' + p.break, '45 minuti + 10 di pausa', 'Per sessioni più lunghe')}${!['25-5', '45-10'].includes(p.focus + '-' + p.break) ? tourRadio('preset', 'keep', 'keep', `Lascia come ora (${p.focus} + ${p.break})`) : ''}${tourNav()}`;
  if (step === 'access') html = `${tourProgress()}<h2>Gli ultimi accessi</h2><p class="muted">Per funzionare al meglio LitSun ha bisogno di poche cose. Tocca il pulsante: il telefono ti chiederà conferma. Nessun accesso a posizione, microfono, foto o contatti.</p><div class="tour-access" id="tourAccess">${tourAccessRows()}</div><button class="btn" type="button" id="tourGrant" onclick="tourGrantAll()">Concedi gli accessi</button>${isStandaloneTour() ? '' : `<details class="tour-install" ${typeof pushSupport === 'function' && pushSupport() === 'ios-install' ? 'open' : ''}><summary>Come installare LitSun sul telefono</summary><p class="muted" style="font-size:13px"><b>iPhone:</b> in Safari tocca Condividi → Aggiungi alla schermata Home, poi apri LitSun dall’icona e rivedi questo tour da Preferenze per attivare le notifiche.<br><b>Android:</b> in Chrome tocca il menu ⋮ → Installa app.</p></details>`}<p class="muted" style="font-size:12px;margin-top:14px">Puoi cambiare queste scelte quando vuoi dalle impostazioni del telefono o da Preferenze.</p>${tourNav()}`;
  if (step === 'done') html = `<span class="eyebrow">TUTTO PRONTO</span><h2>Ora LitSun è tua.</h2><p class="muted">Spunta le routine dalla pagina Oggi: al 100% ti aspetta una piccola festa.</p><p class="notice"><b>I tuoi dati restano su questo telefono.</b> Ogni tanto fai una copia da Preferenze → Esporta i dati, soprattutto prima di cambiare telefono.</p><p class="muted" style="font-size:12px">Puoi rivedere questo tour da Preferenze.</p><div class="toolbar"><button class="btn" type="submit">Inizia la giornata →</button></div>`;
  $('#dialog').innerHTML = `<form id="tourForm" class="tour-body">${html}</form>`;
  $('#tourForm').onsubmit = e => { e.preventDefault(); tourSave(new FormData(e.target)); if (step === 'done') finishTour(false); else tourGo(1); };
  $('#dialog').querySelector('h2')?.setAttribute('tabindex', '-1');
  $('#dialog').querySelector('h2')?.focus();
}

function isStandaloneTour() { return typeof isStandalone === 'function' ? isStandalone() : false; }

function tourSave(f) {
  const step = TOUR_STEPS[tourStep], p = state.prefs;
  if (step === 'praise') { const form = f.get('praiseForm'); if (['neutral', 'feminine', 'masculine'].includes(form)) p.praiseForm = form; p.rewards = f.has('rewards'); }
  if (step === 'routines') {
    const keep = new Set(f.getAll('keep').map(Number));
    state.tasks = state.tasks.filter(t => keep.has(t.id)).map(t => {
      const time = f.get('time-' + t.id);
      const next = { ...t };
      if (realTime(time)) next.time = time; else delete next.time;
      return next;
    });
    for (const i of f.getAll('idea').map(Number)) {
      const idea = TOUR_IDEAS[i];
      if (idea && !state.tasks.some(t => t.title === idea[0])) state.tasks.push({ id: nextId(), title: idea[0], slot: idea[1], time: idea[2], days: [0, 1, 2, 3, 4, 5, 6], repeat: 'weekly' });
    }
    const custom = String(f.get('custom') || '').trim().slice(0, 100);
    if (custom && !state.tasks.some(t => t.title === custom)) state.tasks.push({ id: nextId(), title: custom, slot: 'Mattina', days: [0, 1, 2, 3, 4, 5, 6], repeat: 'weekly' });
  }
  if (step === 'movement') {
    const duration = Number(f.get('duration')), mode = f.get('mode'), level = f.get('level');
    if ([10, 12, 15].includes(duration)) p.duration = duration;
    if (['strength', 'stretch'].includes(mode)) p.mode = mode;
    if (['gentle', 'regular'].includes(level)) p.level = level;
    p.voice = f.has('voice');
    plan = [];
  }
  if (step === 'focus') { const preset = f.get('preset'); if (preset === '25-5') { p.focus = 25; p.break = 5; } if (preset === '45-10') { p.focus = 45; p.break = 10; } }
  save();
}

function tourGo(dir) {
  if (dir < 0) { const form = $('#tourForm'); if (form) tourSave(new FormData(form)); }
  tourStep = Math.max(0, Math.min(TOUR_STEPS.length - 1, tourStep + dir));
  drawTour();
}

let tourAccess = { storage: null, voice: null };
function tourAccessRows() {
  const support = typeof pushSupport === 'function' ? pushSupport() : 'unconfigured', pushOn = typeof pushActive === 'function' && pushActive();
  const row = (state, title, text) => `<div class="tour-access-row ${state}"><span aria-hidden="true">${state === 'on' ? '✓' : state === 'off' ? '–' : '○'}</span><div><b>${title}</b><small>${text}</small></div></div>`;
  const notify = pushOn ? row('on', 'Notifiche', 'Attive: ti avviso anche con LitSun chiusa.')
    : support === 'ok' ? row('todo', 'Notifiche', 'Per impegni e routine con orario, anche con LitSun chiusa.')
    : row('off', 'Notifiche', esc(typeof pushSupportText === 'function' ? pushSupportText(support) : 'Non disponibili qui.'));
  const storage = tourAccess.storage === true ? row('on', 'Memoria protetta', 'Il telefono non cancellerà i tuoi dati per fare spazio.')
    : tourAccess.storage === false ? row('off', 'Memoria protetta', 'Il browser decide da solo: fai ogni tanto una copia da Preferenze → Esporta i dati.')
    : row('todo', 'Memoria protetta', 'Chiede al telefono di non cancellare i tuoi dati quando manca spazio.');
  const voice = tourAccess.voice === true ? row('on', 'Voce guida', 'Funziona: l’hai appena sentita.')
    : tourAccess.voice === false ? row('off', 'Voce guida', 'Non disponibile: negli allenamenti leggerai le istruzioni.')
    : row('todo', 'Voce guida', 'Prova la voce che ti accompagna negli allenamenti. Alza il volume.');
  const screen = row('wakeLock' in navigator ? 'on' : 'off', 'Schermo acceso', 'wakeLock' in navigator ? 'Durante allenamento e focus lo schermo resta acceso da solo.' : 'Questo telefono non lo consente: tocca lo schermo ogni tanto durante le sessioni.');
  return notify + storage + voice + screen;
}

// Un solo tocco: voce (sblocca l'audio), notifiche (richiede il gesto), memoria persistente.
async function tourGrantAll() {
  const button = $('#tourGrant');
  if (button) { button.disabled = true; button.textContent = 'Un momento…'; }
  if ('speechSynthesis' in window) {
    tourAccess.voice = null;
    speak('Ciao! Sono la guida di LitSun. Ti accompagnerò negli allenamenti.', true, { onStart: () => { tourAccess.voice = true; tourRefreshAccess(); }, onUnavailable: () => { tourAccess.voice = false; tourRefreshAccess(); } });
    setTimeout(() => { if (tourAccess.voice === null) { tourAccess.voice = false; tourRefreshAccess(); } }, 6000);
  } else tourAccess.voice = false;
  if (typeof pushSupport === 'function' && pushSupport() === 'ok' && !pushActive()) await enablePush();
  try { tourAccess.storage = navigator.storage?.persist ? (await navigator.storage.persisted()) || await navigator.storage.persist() : false; } catch { tourAccess.storage = false; }
  tourRefreshAccess();
  if (button) { button.disabled = false; button.textContent = 'Riprova'; }
}
function tourRefreshAccess() { const el = $('#tourAccess'); if (el && $('#dialog').open) el.innerHTML = tourAccessRows(); }

function finishTour(skipped) {
  state.prefs.tourDone = true;
  save();
  $('#dialog').close();
  go('oggi');
  if (skipped) toast('Tour saltato. Lo ritrovi in Preferenze quando vuoi.');
}
