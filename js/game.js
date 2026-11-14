/* =====================================================================
   Game: rules, events, interface
   Core trade-off: there is only so much power each day — power for oxygen cannot also go to the greenhouse.
   ===================================================================== */
(function () {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const F = DATA.facts;
  const BUDGET = 25, GOAL = 100, BATT_MAX = 8, SLOT_MAX = 8, SOLS = 30;
  const WATER_USE = 2.5;
  const O2_USE = 7, FOOD_USE = 4.5, SCI_PER = 1.5, FOOD_PER = 1.8;
  const fmt = x => { const v = Math.round(x * 10) / 10; return (v > 0 ? '+' : '') + v; };
  const f1 = x => (Math.round(x * 10) / 10).toString();
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const LT = DATA.earthMars();

  const SLOTS = [
    { k: 'o2', name: 'Oxygen', color: '#8cc7c3', focus: 'o2',
      tip: 'The oxygen maker pulls oxygen out of carbon dioxide. NASA’s MOXIE experiment did this on Mars. In the game, each power block makes 2.5 oxygen. The astronauts use 7 each day.' },
    { k: 'food', name: 'Greenhouse', color: '#7fae5b', focus: 'food',
      tip: 'The greenhouse needs light and heat. Each power block adds 1.8 food. Crops are ready to harvest after 3 sols.' },
    { k: 'shield', name: 'Shield', color: '#d9692f', focus: 'shield',
      tip: 'A digger piles soil onto the modules. Every 5 blocks of power adds 1 shield level. Each level reduces radiation every sol after that.' },
    { k: 'sci', name: 'Science', color: '#e6a83f', focus: 'sci',
      tip: 'Study rocks, watch the weather and send data back to Earth. Each power block gives +1.5 science. Science is why you came to Mars.' }
  ];
  const TIPS = {
    water: 'The astronauts drink 2.5 water each day. Click the water recycler to clean water. It uses 2 blocks of battery. Water goes up by at most 12. You can use it once a day. If the water runs out, the mission must stop.',
    meds: 'Medicine from the first aid kit. Each use takes 1 dose. Health up to +1. Mood up to +8. You can use it once a day.',
    morale: 'Mood changes the astronaut’s face. It drops by 2 each day. Missing food or water makes it drop faster. Snacks, drinks, chatting and event choices all help.',
    o2: `The astronauts use ${O2_USE} oxygen each day (in real life, each person needs about ${F.o2PerPerson} kg per day). If oxygen reaches 0, the mission must end.`,
    food: `The astronauts eat ${FOOD_USE} food each day. Greenhouse crops are ready to harvest after 3 sols.`,
    dose: `Radiation dose is measured in millisieverts (mSv). On Earth, each person gets about ${F.earthBackground} mSv of natural radiation per year. Curiosity measured about ${F.radSurface} mSv per sol on the Mars surface. The limit for this mission is ${BUDGET} mSv.`,
    sci: `Science needs to reach ${GOAL} points. The astronauts must also survive all 30 sols.`,
    batt: `Leftover power goes into the battery. The battery holds up to ${BATT_MAX} blocks. You can use this power during dust storms.`,
    shield: 'A higher shield level cuts radiation. Shields block solar storm particles more easily. Cosmic rays from deep space are harder to block.',
    sol: `A sol is one Mars day: the time Mars takes to spin once. It lasts ${F.solLength} — a little longer than a day on Earth.`,
    tau: 'τ (tau) shows how much dust is in the air. A bigger number means more dust. Dust blocks sunlight. It is usually about 0.5. During the 2018 global dust storm it went above 10.',
    heat: `Mars nights get down to about ${F.nightTemp}°C. Some power is set aside for the heaters every night. Too little heat makes the crew use more oxygen.`,
    eva: 'Put on a spacesuit and explore outside. You can do repairs and collect samples. Going outside uses oxygen and adds radiation.'
  };

  /* ======================= State ======================= */
  let G;
  let sceneView = 'interior', encounterOpen = false;
  const utilityOpen = () => $('#sources').classList.contains('on') || $('#modal').classList.contains('on');
  let journalPhase = 'planning', bookType = 'today', todaySheet = 'brief', archiveIndex = 0;
  function bookPages() {
    if (bookType === 'archive') return [...$('#journalHistory').querySelectorAll('.book-page')];
    return [...document.querySelectorAll('.book-page[data-book="today"]')].filter(p => p.dataset.sheet !== 'decision' || G.today.notes.length || G.decisions.some(d => d.sol === G.sol));
  }
  function renderBook(direction = '') {
    const pages = bookPages();
    if (!pages.length) return;
    let index = bookType === 'archive' ? Math.min(archiveIndex, pages.length - 1) : pages.findIndex(p => p.dataset.sheet === todaySheet);
    if (index < 0) index = 0;
    if (bookType === 'archive') archiveIndex = index; else todaySheet = pages[index].dataset.sheet;
    $$('.book-page').forEach(p => { p.hidden = p !== pages[index]; });
    $('#notebook').dataset.book = bookType;
    const name = bookType === 'today' ? 'Today’s Log' : 'Event Archive';
    $('#bookName').textContent = name; $('#notebook').setAttribute('aria-label', name);
    $('#chapterName').textContent = pages[index].dataset.label;
    $('#pageNumber').textContent = `${String(index + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`;
    $('#previousPage').disabled = index === 0; $('#nextPage').disabled = index === pages.length - 1;
    const start = Math.max(0, Math.min(index - 2, pages.length - 5));
    $('#pageTrack').innerHTML = pages.slice(start, start + 5).map((p, i) => `<button data-index="${start + i}" class="${start + i === index ? 'current' : ''}" aria-label="Page ${start + i + 1}: ${p.dataset.label}" ${start + i === index ? 'aria-current="page"' : ''}></button>`).join('');
    $$('#pageTrack button').forEach(b => b.onclick = () => flipBook(Number(b.dataset.index) - index));
    updateShelf(); hideTip();
    if (direction) {
      const paper = $('.book-pages'); paper.classList.remove('turn-forward', 'turn-back'); void paper.offsetWidth; paper.classList.add(direction);
      pages[index].scrollTop = 0;
    }
  }
  function updateShelf() {
    for (const [type, id] of [['today', '#todayBook'], ['archive', '#archiveBook']]) {
      const active = !$('#notebook').hidden && bookType === type;
      $(id).classList.toggle('active', active); $(id).setAttribute('aria-expanded', String(active));
    }
    $('#todaySignal').classList.toggle('pending', journalPhase === 'event');
  }
  function flipBook(delta) {
    const pages = bookPages();
    const current = bookType === 'archive' ? archiveIndex : pages.findIndex(p => p.dataset.sheet === todaySheet);
    const index = Math.max(0, Math.min(pages.length - 1, current + delta));
    if (index === current) return;
    if (bookType === 'archive') archiveIndex = index; else todaySheet = pages[index].dataset.sheet;
    Sound.click(); renderBook(delta > 0 ? 'turn-forward' : 'turn-back');
  }
  function journalPage(page) {
    bookType = 'today'; todaySheet = page === 'log' ? 'brief' : page; renderBook('turn-forward');
  }
  function showJournal(open, page) {
    if (open && ['plan', 'supplies', 'care', 'mission'].includes(page)) return openConsole();
    Habitat.closeCard(); $('#notebook').hidden = !open; $('#frame').classList.toggle('notebook-open', open);
    if (page) { bookType = 'today'; todaySheet = page === 'log' ? 'brief' : page; }
    if (open) renderBook(); else updateShelf();
    hideTip();
  }
  function openNotebook(type) {
    if ($('#frame').classList.contains('nightfall')) return;
    if (bookType === type && !$('#notebook').hidden) return showJournal(false);
    bookType = type; showJournal(true); Sound.click();
  }
  function openConsole() {
    if (busy || encounterOpen || Expedition.busy || G.over || utilityOpen()) return;
    setSceneView('overview');
  }
  function completeAllocation() {
    if (busy || encounterOpen || G.over || utilityOpen() || Expedition.busy || Expedition.outside) return;
    if (Expedition.model.guide.active && Expedition.model.step === 'allocate') {
      if (G.alloc.o2 < 3) return Habitat.toast('The oxygen maker needs more power. Raise it to 3 blocks.');
      Expedition.notify('allocate'); setSceneView('interior'); return;
    }
    Expedition.sleep();
  }
  function lockPlanning(locked, message = '') {
    for (const el of [$('#power'), $('#planActions')]) { el.classList.toggle('off', locked); el.inert = locked; }
    const notice = $('#planningNotice'); notice.hidden = !message; notice.textContent = message;
  }
  const mapSketch = `<div class="jezero-map" aria-label="Jezero base map">
    <svg viewBox="0 0 400 130" fill="none" aria-hidden="true">
      <g stroke="#97aa8a" stroke-width=".7"><path d="M-30 110C60 170 87 44 150 45S206 145 300 102 395 60 440 95"/><path d="M-30 93C50 145 93 28 155 30S216 125 297 88 395 45 440 77"/><path d="M-30 77C50 129 90 12 160 15S225 108 294 74 395 30 440 60"/><path d="M-30 58C50 110 95-4 166-1S230 90 295 59 395 15 440 44"/><path d="M-30 40C50 92 92-20 170-18S240 72 298 44 395 0 440 28"/><path d="M-30 128C60 188 87 60 145 61S195 161 303 119 395 77 440 112"/></g>
      <path d="M130 103L163 86 194 89 218 57 265 43" stroke="#5b7d5c" stroke-dasharray="3 4"/>
      <circle cx="218" cy="57" r="17" stroke="#7d9c75" stroke-dasharray="2 4"/><circle cx="218" cy="57" r="4" fill="#4e7957"/><path d="M218 30V38M218 76V84M191 57H199M237 57H245" stroke="#4e7957"/>
      <path d="M25 18V32M18 25H32M368 99V113M361 106H375" stroke="#8ca180"/><text x="243" y="61" font-size="8" font-family="monospace" fill="#5c7b58">OUTPOST 01</text>
    </svg><span class="map-coordinate">LOCAL MAP / 1:25 000</span><span class="map-caption">JEZERO · 18.4° N / 77.5° E</span></div>`;
  function dailyEntry() {
    $('#solCard').hidden = false;
    const warning = G.o2 < 25 ? 'Oxygen is low. Give the oxygen maker more power.' : G.food < 25 ? 'Food is low. The greenhouse takes 3 sols to harvest. Plan power ahead.' : G.storm > 0 ? 'The dust storm is not over. Give power to oxygen and the greenhouse first.' : G.events[G.sol + 1] === 'stormStart' ? 'A dust storm arrives tomorrow. Stock up on supplies and charge the battery.' : '';
    $('#journalEvent').innerHTML = `<div class="entry-label">${G.sol === 1 ? 'First-Day Mission' : 'Today’s Tip'}</div>
      <h2>${G.sol === 1 ? 'Sol 1' : warning ? 'Today’s Resource Alert' : 'Today’s Work Plan'}</h2>
      <p class="entry-body">${G.sol === 1 ? 'The base has 4 astronauts. Today you need to fix the solar panels. Then learn how to clean water and share power.' : warning || 'Check your supplies and power. Then plan today’s work.'}</p>
      <div class="mission-target"><span>Our Mission</span><b>Survive 30 sols · Science ≥ 100</b><small>Oxygen and food &gt; 0 · Radiation &lt; 25 mSv</small></div>`;
    $('#journalChoices').innerHTML = '';
  }
  function renderArchive() {
    const entries = G.hist.slice().reverse().map(d => ({ ...d, decisions: G.decisions.filter(c => c.sol === d.sol) }));
    const pending = G.decisions.filter(d => d.sol === G.sol);
    if ((pending.length || G.today.notes.length) && !G.hist.some(d => d.sol === G.sol)) entries.unshift({ sol: G.sol, decisions: pending, pending: true, notes: G.today.notes.slice() });
    $('#archiveCount').textContent = entries.length;
    $('#journalHistory').innerHTML = entries.length ? entries.map(d => {
      const notes = d.notes || [];
      const chunks = Array.from({ length: Math.max(1, Math.ceil(notes.length / 2)) }, (_, i) => notes.slice(i * 2, i * 2 + 2));
      const records = chunks.map((chunk, i) => `<section class="book-page archive-page" data-book="archive" data-sheet="archive-${d.sol}-${i}" data-label="SOL ${String(d.sol).padStart(2, '0')} · Event Log" hidden><div class="page-eyebrow">Event Archive / ${d.pending ? 'Logged today' : 'Filed at day’s end'}</div><h2>Sol ${d.sol} ${i ? ' · continued' : ' Action Log'}</h2>${!i && !notes.length ? d.decisions.map(c => `<div class="archived-decision"><span>${c.title}</span><b> ${c.choice}</b></div>`).join('') : ''}${chunk.length ? `<ul class="summary-notes">${chunk.map(n => `<li>${n}</li>`).join('')}</ul>` : `<p class="entry-body">${d.pending ? 'Action logged. After the day ends you can see supplies and power records.' : 'No special event today. The base is running as planned.'}</p>`}</section>`).join('');
      if (d.pending) return records;
      return records + `<section class="book-page archive-page" data-book="archive" data-sheet="archive-${d.sol}-resources" data-label="SOL ${String(d.sol).padStart(2, '0')} · Resources and Power" hidden><div class="page-eyebrow">Resource Record</div><h2>Sol ${d.sol} · Supply Ledger</h2><div class="archive-resources"><span>Oxygen <b>${Math.round(d.o2)}<small>%</small></b></span><span>Food <b>${Math.round(d.food)}<small>%</small></b></span><span>Science <b>${f1(d.sci)}</b></span><span>Total radiation <b>${f1(d.dose)}<small> mSv</small></b></span></div><div class="allocation-record"><span>Today’s power plan</span>${Object.entries(d.alloc).map(([k, v]) => `<p>${SLOTS.find(s => s.k === k).name}<b>${v} blocks</b></p>`).join('')}</div><p class="page-note">Water ${f1(d.water ?? 0)} · Medicine ${d.meds ?? 0} · Mood ${Math.round(d.morale ?? 0)}</p></section>`;
    }).join('') : `<section class="book-page archive-page" data-book="archive" data-sheet="archive-empty" data-label="Event Archive" hidden><div class="page-eyebrow">Event Archive / 000</div><h2>No history yet</h2><p class="entry-body">Every day’s actions, resources and power plan are saved here.<br><br>Records appear after you finish Sol 1.</p><div class="empty-archive-mark" aria-hidden="true"></div></section>`;
    archiveIndex = Math.min(archiveIndex, Math.max(0, $('#journalHistory').children.length - 1));
  }
  let rng = Math.random;
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hab = lv => .72 - .06 * lv;     // share of cosmic rays that reach inside the habitat
  const sepFac = lv => .8 - .13 * lv;   // share of solar storm particles that reach inside the habitat

  function newGame() {
    if (document.querySelector('#expeditionUI')) Expedition.reset();
    busy = false; encounterOpen = false; journalPhase = 'planning';
    $('#dailyEventModal').hidden = true; $('#hud').inert = false; $('#habitatScene').inert = false;
    $('#modal').classList.remove('on','result'); $('#sources').classList.remove('on');
    $('#frame').classList.remove('nightfall','notebook-open');
    bookType = 'today'; todaySheet = 'brief'; archiveIndex = 0;
    G = { water: 55, meds: 4, morale: 75, care: {}, cabinDeck: [], sol: 1, o2: 60, food: 50, dose: 0, sci: 0, batt: 6, shieldLv: 1, shieldProg: 0, panelEff: .72, queue: [3, 3, 3],
      alloc: { o2: 3, food: 2, shield: 1, sci: 2 }, want: { o2: 3, food: 2, shield: 1, sci: 2 }, eva: false,
      o2Rate: 2.5, o2Mul: 1, o2MulDays: 0, storm: 0, stormMul: .3, stormSave: false, battBonus: 0,
      evaLock: 0, conj: 0, conjRisk: 0, exercise: 0, health: 3, drain: 0, drainDays: 0, dirtyShown: false,
      hist: [], decisions: [], doseParts: { gcr: 0, sep: 0, eva: 0 }, powerUse: { o2: 0, food: 0, shield: 0, sci: 0 },
      flareSols: [], over: false,
      build: { rows: 2, domes: 1, labs: 0 }, evaCount: 0, sample: false, pods: 0, damaged: 1, blight: 0, blightFix: false, cull: 0, o2Fault: 0, o2FaultDays: 0 };
    schedule();
  }
  function schedule() {
    const ev = {};
    const free = s => s >= 2 && s <= 29 && !ev[s] && !ev[s - 1] && !ev[s + 1];
    // dust storm (always one)
    const s0 = ri(11, 18); G.stormLen = ri(4, 5);
    ev[s0 - 1] = 'stormWarn'; ev[s0] = 'stormStart';
    const dd = s0 + G.stormLen + ri(1, 3); if (dd <= 29) ev[dd] = 'dustDevil';
    // solar storms (2–3 of them, taken from DONKI)
    const pool = shuffle(DATA.flares.slice());
    const lf = DATA.liveFlareEvent(); if (lf) pool.unshift(lf);
    G.flareQueue = pool;
    const nF = rng() < .4 ? 3 : 2;
    let tries = 0;
    while (G.flareSols.length < nF && tries++ < 200) { const s = ri(4, 28); if (free(s) && G.flareSols.every(x => Math.abs(x - s) >= 6)) { ev[s] = 'flare'; G.flareSols.push(s); } }
    // two building chances (you decide what the base looks like)
    for (const [a, b] of [[6, 9], [19, 24]]) { tries = 0; while (tries++ < 200) { const s = ri(a, b); if (free(s)) { ev[s] = 'build'; break; } } }
    // other events
    const others = shuffle(['o2fault', 'delta', 'conjunction', 'cold', 'blight', 'resupply', 'bones', 'letter', 'quake']).slice(0, 6);
    for (const id of others) { tries = 0; while (tries++ < 200) { const s = ri(2, 29); if (free(s)) { ev[s] = id; break; } } }
    G.events = ev;
  }

  /* ======================= Daily calculation ======================= */
  function computePool() {
    const T = G.today;
    G.gen = Math.max(0, Math.round((12 + 3 * (G.build.rows - 2) - 2 * G.damaged) * G.sunVar * G.panelEff * (G.storm > 0 ? G.stormMul : 1)));
    G.heat = 3 + T.heatAdj - (G.storm > 0 && G.stormSave ? 1 : 0);
    G.pool = G.gen - G.heat + G.batt - T.poolPenalty - (G.drainDays > 0 ? G.drain : 0);
  }
  function powerStatus() {
    const normal = Math.max(0, Math.round((12 + 3 * (G.build.rows - 2)) * G.sunVar * (G.storm > 0 ? G.stormMul : 1)));
    const causes = [];
    if (G.storm > 0) causes.push('Dust storm blocks sunlight');
    if (G.panelEff < .98) causes.push(`Dusty solar panels. Cleanliness ${Math.round(G.panelEff * 100)}%`);
    if (G.damaged > 0) causes.push(`${G.damaged} panels need their plugs or frames repaired`);
    return { normal, lost: Math.max(0, normal - G.gen), causes };
  }
  const foodPer = () => FOOD_PER * (1 + .25 * (G.build.domes - 1));
  const sciPer = () => SCI_PER + .5 * G.build.labs;
  const used = () => G.alloc.o2 + G.alloc.food + G.alloc.shield + G.alloc.sci;
  const sciLocked = () => (G.today && G.today.sciLock) || (G.storm > 0 && G.stormSave);
  const evaBlocked = () => G.evaLock > 0 ? 'No going outside during solar conjunction' : G.storm > 0 ? 'No going outside during a dust storm' : (G.today && G.today.sciLock) ? 'Everyone is in the shelter today' : '';
  function clampAlloc() {
    // the plan the player wants is remembered; it is cut back when power runs short and comes back when power returns
    G.alloc = { ...G.want };
    if (sciLocked()) G.alloc.sci = 0;
    if (evaBlocked()) G.eva = false;
    let over = used() - Math.max(0, G.pool);
    for (const k of ['sci', 'shield', 'food', 'o2']) { while (over > 0 && G.alloc[k] > 0) { G.alloc[k]--; over--; } }
  }
  function preview() {
    const a = G.alloc, T = G.today;
    const short = Math.max(0, -G.pool);
    const o2Prod = a.o2 * G.o2Rate * G.o2Mul;
    const o2 = o2Prod - O2_USE - G.exercise - short * 3;
    const harvest = G.queue[0];
    const food = harvest - FOOD_USE;
    const gcr = F.radSurface * hab(G.shieldLv);
    const evaDose = 0;
    const dose = gcr + evaDose + T.flareDose;
    const sci = sciLocked() ? 0 : a.sci * sciPer();
    const left = Math.max(0, G.pool) - used();
    const batt = Math.min(BATT_MAX + G.battBonus, left);
    let lv = G.shieldLv, prog = G.shieldProg + a.shield; while (prog >= 5 && lv < 5) { lv++; prog -= 5; }
    return { o2, o2Prod, food, harvest, dose, gcr, evaDose, sci, batt, left, short, lv, prog, wasted: Math.max(0, left - batt) };
  }

  /* ======================= Interface: gauges ======================= */
  function meterRow(k, label, tip) {
    return `<div class="m-row" data-k="${k}"><span class="m-l"><i class="dot ${k}"></i>${label}<button class="q" data-tip="${tip}">?</button></span>
      <div class="bar"><s></s><u></u></div><em class="v"></em><b class="d"></b></div>`;
  }
  function buildHUD() {
    $('#meters').innerHTML = `<div class="c-h">Outpost Status</div>
      ${meterRow('o2', 'Oxygen', 'o2')}${meterRow('food', 'Food', 'food')}${meterRow('dose', 'Radiation', 'dose')}${meterRow('sci', 'Science', 'sci')}${meterRow('batt', 'Battery', 'batt')}
      <div class="m-shield"><span><i class="dot shield"></i> Shield level<button class="q" data-tip="shield">?</button></span><span class="lv"></span><span class="prog"></span></div>`;
    $('#careMeters').innerHTML = `${meterRow('water', 'Drinking Water', 'water')}${meterRow('meds', 'Medicine', 'meds')}${meterRow('morale', 'Crew mood', 'morale')}`;
    $('#power').innerHTML = `
      <div class="p-h"><span class="p-title">Today’s Power</span><span class="p-eq"></span><details class="power-details"><summary>Why this much power?</summary><p id="powerExplanation"></p></details></div>
      <div class="p-tokens"></div>
      <div class="p-slots">${SLOTS.map(s => `<div class="slot" data-k="${s.k}">
          <div class="s-top"><i class="dot ${s.k}"></i><span class="s-name">${s.name}</span><button class="q" data-tipx="${s.k}">?</button></div>
          <div class="s-ctl"><button class="mn" aria-label="Less">−</button><b class="s-n">0</b><button class="pl" aria-label="More">+</button></div>
          <div class="s-eff"></div></div>`).join('')}</div><button id="planningNotice" hidden></button><div id="planActions"></div>`;
    $('#planActions').innerHTML = `
      <div class="p-foot">
        <button class="eva" id="evaDepart">Go Outside</button>
        <span class="p-left"></span>
        <button class="btn go" id="bGo">Finish Power Plan <span>→</span></button>
      </div>`;
    SLOTS.forEach(s => {
      const el = $(`.slot[data-k="${s.k}"]`);
      el.querySelector('.pl').onclick = () => { if (busy) return; if (s.k === 'sci' && sciLocked()) return nudge(el, 'Science paused today'); if (G.alloc[s.k] >= SLOT_MAX) return nudge(el, 'This system can use at most 8 blocks a day'); if (used() >= Math.max(0, G.pool)) return nudge(el, 'All of today’s power is shared out'); G.alloc[s.k]++; G.want[s.k] = G.alloc[s.k]; Sound.plus(); renderAll(); };
      el.querySelector('.mn').onclick = () => { if (busy || G.alloc[s.k] <= 0) return; G.alloc[s.k]--; G.want[s.k] = G.alloc[s.k]; Sound.minus(); renderAll(); };
      el.onmouseenter = () => !busy && World.focus(s.focus);
      el.querySelector('[data-tipx]').onclick = e => { e.stopPropagation(); showTip(e.target, `<b>${s.name}</b><br>${s.tip}`); };
    });
    $('#power').onmouseleave = () => !busy && World.focus('overview');
    $('#evaDepart').onclick = () => Expedition.requestDeparture();
    $('#bGo').onclick = completeAllocation;
    document.addEventListener('click', e => { const q = e.target.closest('.q[data-tip]'); if (q) { e.stopPropagation(); showTip(q, TIPS[q.dataset.tip]); } else hideTip(); });
  }
  function setBar(k, frac, pv, val, d, cls) {
    const r = $(`.m-row[data-k="${k}"]`);
    r.querySelector('s').style.width = clamp(frac, 0, 1) * 100 + '%';
    const u = r.querySelector('u'); u.style.left = clamp(Math.min(frac, pv), 0, 1) * 100 + '%'; u.style.width = Math.abs(clamp(pv, 0, 1) - clamp(frac, 0, 1)) * 100 + '%';
    u.className = pv >= frac ? 'up' : 'down';
    r.querySelector('.v').innerHTML = val;
    const de = r.querySelector('.d'); de.textContent = d; de.className = 'd ' + (cls || '');
    r.classList.toggle('warn', k === 'dose' ? frac > .75 : (k === 'o2' || k === 'food') ? frac < .25 : false);
  }
  function renderAll() {
    clampAlloc(); const p = preview();
    const power = powerStatus();
    $('#powerExplanation').textContent = `Power today ${G.gen} blocks. In the same weather it should make about ${power.normal} blocks. ${power.causes.length ? 'Power losses: ' + power.causes.join('. ') + '.' : 'All machines are working.'} The battery has ${G.batt} blocks. After saving power for heating, you can share ${G.pool} blocks.`;
    // gauges
    setBar('water', G.water / 100, (G.water - WATER_USE) / 100, `${f1(G.water)}<small>/100</small>`, fmt(-WATER_USE), 'bad');
    setBar('meds', G.meds / 9, G.meds / 9, `${G.meds}<small>doses</small>`, 'Spare', 'meh');
    const moraleLoss = 2 + (G.food < 20 || G.water < 20 ? 4 : 0);
    setBar('morale', G.morale / 100, (G.morale - moraleLoss) / 100, `${Math.round(G.morale)}<small>/100</small>`, fmt(-moraleLoss), 'meh');
    setBar('o2', G.o2 / 100, (G.o2 + p.o2) / 100, `${Math.round(G.o2)}<small>%</small>`, fmt(p.o2), p.o2 >= 0 ? 'good' : 'bad');
    setBar('food', G.food / 100, (G.food + p.food) / 100, `${Math.round(G.food)}<small>%</small>`, fmt(p.food), p.food >= 0 ? 'good' : 'bad');
    setBar('dose', G.dose / BUDGET, (G.dose + p.dose) / BUDGET, `${f1(G.dose)}<small>/${BUDGET}</small>`, fmt(p.dose), p.dose > 1 ? 'bad' : 'meh');
    setBar('sci', G.sci / GOAL, (G.sci + p.sci) / GOAL, `${Math.round(G.sci)}<small>/${GOAL}</small>`, fmt(p.sci), p.sci > 0 ? 'good' : 'meh');
    const cap = BATT_MAX + G.battBonus;
    setBar('batt', G.batt / cap, p.batt / cap, `${G.batt}<small>/${cap}</small>`, (p.batt - G.batt >= 0 ? '+' : '') + (p.batt - G.batt), p.batt >= G.batt ? 'good' : 'bad');
    $('.m-shield .lv').innerHTML = [1, 2, 3, 4, 5].map(i => `<i class="${i <= G.shieldLv ? 'on' : ''}${i === p.lv && p.lv > G.shieldLv ? ' next' : ''}"></i>`).join('');
    $('.m-shield .prog').textContent = G.shieldLv >= 5 ? 'Max level' : `Building ${G.shieldProg}/5`;
    // power
    const poolPos = Math.max(0, G.pool);
    $('.p-eq').innerHTML = `Power <b>${G.gen}</b> − night heating <b>${G.heat}</b><button class="q" data-tip="heat">?</button>${G.batt ? ` + battery <b>${G.batt}</b>` : ''}${G.today.poolPenalty ? ` − repairs <b>${G.today.poolPenalty}</b>` : ''}${G.drainDays > 0 ? ` − air flow <b>${G.drain}</b>` : ''} = <b class="pool ${G.pool < 0 ? 'neg' : ''}">${G.pool}</b> blocks`;
    let toks = '';
    const order = [];
    SLOTS.forEach(s => { for (let i = 0; i < G.alloc[s.k]; i++) order.push(s.k); });
    for (let i = 0; i < Math.max(poolPos, 1); i++) toks += i < order.length ? `<i class="tk ${order[i]}"></i>` : (poolPos ? `<i class="tk free"></i>` : '');
    if (G.pool < 0) toks = `<span class="short">Not enough power for heating. You are ${-G.pool} blocks short. Oxygen will drop by an extra ${-G.pool * 3}.</span>`;
    $('.p-tokens').innerHTML = toks;
    SLOTS.forEach(s => {
      const el = $(`.slot[data-k="${s.k}"]`), n = G.alloc[s.k];
      el.querySelector('.s-n').textContent = n;
      el.classList.toggle('locked', s.k === 'sci' && sciLocked());
      const eff = s.k === 'o2' ? `+${f1(p.o2Prod)} Oxygen <small>Needed tonight ${O2_USE + G.exercise}</small>`
        : s.k === 'food' ? `+${f1(n * foodPer())} Food <small>Harvest in 3 sols ${G.build.domes > 1 ? ` · ${G.build.domes} greenhouse(s)` : ''}</small>`
        : s.k === 'shield' ? (G.shieldLv >= 5 ? 'Max level <small>Not needed anymore</small>' : `Building ${G.shieldProg}+${n}/5<small>${p.lv > G.shieldLv ? 'Level up tomorrow!' : '5 blocks = 1 level'}</small>`)
        : sciLocked() ? 'Paused <small>No science today</small>' : `+${f1(n * sciPer())} Science <small>Each block ${f1(sciPer())}${G.build.labs ? ' · lab bonus' : ''}</small>`;
      el.querySelector('.s-eff').innerHTML = eff;
      el.classList.toggle('warn', s.k === 'o2' && p.o2Prod < O2_USE);
    });
    const left = p.left;
    $('.p-left').innerHTML = G.pool < 0 ? '' : left > 0 ? `Left <b>${left}</b> blocks → ${p.wasted ? `The battery is full.<b class="bad">wasted ${p.wasted} blocks</b>` : 'goes to battery'}` : 'All power is shared out';
    const eb = evaBlocked(); $('#evaDepart').innerHTML = `<span><strong>${eb || 'Go Outside'}</strong><small>Check gear and weather first</small></span>`; $('#evaDepart').disabled = !!eb;
    $('#evaDepart').setAttribute('aria-label',eb || 'Go Outside');
    // environment
    const sun = Math.round(G.sunVar * (G.storm > 0 ? G.stormMul : 1) * 100);
    const tau = G.storm > 0 ? (G.stormSave ? 6.2 : 6.8) : (.4 + (1 - G.sunVar) * 3).toFixed(1);
    const nextFlare = G.flareSols.includes(G.sol + 1), nextStorm = G.events[G.sol + 1] === 'stormStart';
    $('#fore').innerHTML = `<div class="c-h">Today’s Environment</div>
      <div class="f-row"><span>Sunlight</span><b>${sun}%</b></div>
      <div class="f-row"><span>Dust in the air τ<button class="q" data-tip="tau">?</button></span><b class="${G.storm > 0 ? 'bad' : ''}">${tau}</b></div>
      <div class="f-row"><span>Solar panel cleanliness</span><b class="${G.panelEff < .82 ? 'bad' : ''}">${Math.round(G.panelEff * 100)}%</b></div>
      <div class="f-row"><span>Tomorrow’s space weather</span><b class="${nextFlare ? 'bad' : 'good'}">${nextFlare ? 'Solar storm warning' : 'Calm'}</b></div>
      <div class="f-row"><span>Signal to Earth</span><b>${G.conj > 0 ? 'Conjunction · cut off' : f1(LT.minutes) + ' min'}</b></div>
      ${G.storm > 0 ? `<div class="f-alert">Dust storm: ${G.storm} sols</div>` : nextStorm ? `<div class="f-alert">Dust storm arrives tomorrow</div>` : ''}`;
    $('#solN').textContent = String(G.sol); $('#solBar').style.width = (G.sol - 1) / SOLS * 100 + '%';
    $('#journalDay').textContent = String(G.sol).padStart(2, '0'); $('#dockSol').textContent = `SOL ${String(G.sol).padStart(2, '0')}`;
    syncWorld(); Habitat.render(G); Expedition.render(G);
  }
  const tanks = () => Math.min(7, 2 + Math.floor(G.powerUse.o2 / 18) + (G.o2Rate > 2.5 ? 2 : 0));
  function syncWorld(extra) {
    const T = G.today || {};
    World.sync(Object.assign({ o2: G.o2, food: G.food, dosePct: G.dose / BUDGET, batt: G.batt, battCap: BATT_MAX + G.battBonus, battBonus: G.battBonus,
      shieldLv: G.shieldLv, shieldWork: G.alloc.shield, o2Work: G.alloc.o2, foodWork: G.alloc.food, sciWork: sciLocked() ? 0 : G.alloc.sci,
      eva: G.eva || !!T.evaShow, sci: G.sci, panelEff: G.panelEff, rows: G.build.rows, domes: G.build.domes, labs: G.build.labs, tanks: tanks(),
      blight: G.blight, cull: G.cull, o2Fault: G.o2Fault, conj: G.conj > 0, powerOut: G.pool < 0, shelter: !!T.shelter, evaCount: G.evaCount, sample: G.sample,
      pods: G.pods, exercise: G.exercise > 0, damaged: G.damaged, growth: (G.queue[0] + G.queue[1] + G.queue[2]) / (14 * (1 + .25 * (G.build.domes - 1))), devil: T.devil ? 1 : 0 }, extra || {}));
  }
  function nudge(el, msg) {
    Sound.bad(); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    toastMini(msg);
  }
  let tipEl;
  function showTip(anchor, html) {
    hideTip(); tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.innerHTML = html; document.body.appendChild(tipEl);
    const r = anchor.getBoundingClientRect(), w = Math.min(300, innerWidth - 32);
    tipEl.style.width = w + 'px';
    const top = r.top - tipEl.offsetHeight - 10 > 8 ? r.top - tipEl.offsetHeight - 10 : r.bottom + 10;
    tipEl.style.left = clamp(r.left + r.width / 2 - w / 2, 16, innerWidth - w - 16) + 'px'; tipEl.style.top = top + 'px';
  }
  function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
  function toastMini(msg) { const t = document.createElement('div'); t.className = 'mini'; t.textContent = msg; $('#frame').appendChild(t); setTimeout(() => t.remove(), 1900); }

  /* ======================= How a day works ======================= */
  let busy = false;
  function beginSol() {
    journalPhase = 'planning';
    G.care = {};
    G.today = { notes: [], poolPenalty: 0, sciLock: false, flareDose: 0, flareOut: 0, heatAdj: 0, eventId: null };
    G.sunVar = .92 + rng() * .12;
    computePool(); renderAll();
    busy = false; lockPlanning(false); dailyEntry(); renderArchive();
    showJournal(false, 'log'); renderTodayRecords(); renderAll();
    World.focus('overview');
    Expedition.newDay(G);
    let id = G.events[G.sol];
    if (!id && G.sol > 1 && !G.dirtyShown && G.panelEff < .82 && G.storm === 0) { id = 'dirty'; G.dirtyShown = true; }
    if (id) { busy = true; lockPlanning(true); openEvent(id, () => { busy = false; lockPlanning(false); renderAll(); }); }
  }
  function endSol() {
    if (busy || encounterOpen || G.over || utilityOpen() || Expedition.outside || Expedition.busy) return;
    busy = true; lockPlanning(true); showJournal(false); Habitat.closeCard();
    settleSol();
  }
  function settleSol() {
    busy = true; lockPlanning(true); showJournal(false); Sound.click();
    const p = preview(), a = G.alloc, T = G.today;
    const notes = G.today.notes.slice();
    const moraleLoss = 2 + (G.food < 20 || G.water < 20 ? 4 : 0);
    G.water = clamp(G.water - WATER_USE, 0, 100); G.morale = clamp(G.morale - moraleLoss, 0, 100);
    notes.push(`Water used: ${WATER_USE}. Water left: ${f1(G.water)}. Mood ${fmt(-moraleLoss)}. Mood now ${Math.round(G.morale)}.`);
    // settle resources
    G.o2 = clamp(G.o2 + p.o2, 0, 100);
    G.food = clamp(G.food + p.food, 0, 100);
    G.queue = [G.queue[1], G.queue[2], a.food * foodPer()];
    const lvBefore = G.shieldLv; G.shieldLv = p.lv; G.shieldProg = G.shieldLv >= 5 ? 0 : p.prog;
    G.dose += p.dose; G.doseParts.gcr += p.gcr; G.doseParts.sep += T.flareDose;
    const sciBefore = G.sci, tanksBefore = tanks();
    G.sci += p.sci;
    G.batt = Math.max(0, p.batt);
    for (const k in a) G.powerUse[k] += a[k];
    const SCI_PARTS = [[15, 'seismometer'], [35, 'rock core drill'], [55, 'telescope'], [80, 'sample rack'], [100, 'science goal flag']];
    for (const [th, name] of SCI_PARTS) if (sciBefore < th && G.sci >= th) notes.push(`Science reached ${th}: the science station added a <b>${name}</b>!`);
    if (tanks() > tanksBefore) notes.push('The oxygen maker added an <b>oxygen tank</b>.');    // risk of going outside during conjunction
    // cause and effect notes
    if (p.short) notes.push(`Not enough power for heating. Life support turned down. Oxygen extra −${p.short * 3}.`);
    if (p.o2 < 0) notes.push(`Oxygen ${fmt(p.o2)}: oxygen maker made ${f1(p.o2Prod)}. The astronauts used ${O2_USE + G.exercise}.`);
    else notes.push(`Oxygen ${fmt(p.o2)}: oxygen maker made ${f1(p.o2Prod)}. That covers what the astronauts need.`);
    notes.push(p.harvest > .05 ? `Greenhouse harvest: ${f1(p.harvest)} food. The astronauts ate ${FOOD_USE} food.` : `No greenhouse harvest. The greenhouse got no power 3 sols ago. Food −${FOOD_USE}.`);
    if (G.shieldLv > lvBefore) notes.push(`Shield is now level ${G.shieldLv}. Radiation will be lower every day from now on.`);
    if (T.flareDose > 0) notes.push(`The solar storm gave the astronauts inside an extra ${f1(T.flareDose)} mSv of radiation. Extra dose from going outside was counted when you left.`);
    if (p.wasted) notes.push(`The battery is full. ${p.wasted} blocks of power were wasted.`);
    // lasting effects
    G.panelEff = Math.max(.5, G.panelEff - .012 - (G.storm > 0 ? .02 : 0));
    if (G.o2MulDays > 0 && --G.o2MulDays === 0) G.o2Mul = 1;
    if (G.evaLock > 0) G.evaLock--; if (G.conjRisk > 0) G.conjRisk--; if (G.conj > 0) G.conj--;
    if (G.drainDays > 0) G.drainDays--;
    if (G.o2Fault === 2) G.o2Fault = 0;
    if (G.o2FaultDays > 0 && --G.o2FaultDays === 0) G.o2Fault = 0;
    if (G.blight > 0) G.blight = Math.max(0, G.blight - (G.blightFix ? .45 : .2));
    let stormEnded = false;
    if (G.storm > 0 && --G.storm === 0) { stormEnded = true; G.stormSave = false; G.battBonus = 0; G.batt = Math.min(G.batt, BATT_MAX); }
    if (stormEnded) notes.unshift('The dust storm is over. The solar panels make normal power again.');
    G.hist.push({ water: G.water, meds: G.meds, morale: G.morale, sol: G.sol, o2: G.o2, food: G.food, dose: G.dose, sci: G.sci, batt: G.batt, gen: G.gen, ev: T.eventId, alloc: { ...a }, eva: G.eva, notes: notes.slice() });
    // floating numbers
    floater('o2', fmt(p.o2) + ' Oxygen', p.o2 >= 0 ? 'good' : 'bad');
    floater('food', fmt(p.food) + ' Food', p.food >= 0 ? 'good' : 'bad', 250);
    if (p.sci > 0) floater(G.eva ? 'astro' : 'sci', fmt(p.sci) + ' Science', 'sci', 500);
    floater('shield', '+' + f1(p.dose) + ' Radiation', 'dose', 750);
    if (p.sci > 0) World.signal(2.5);
    // night
    World.focus('overview');
    $('#frame').classList.add('nightfall');
    syncWorld({ powerOut: p.short > 0 });
    setTimeout(() => { G.eva = false; G.today.evaShow = false; syncWorld({ powerOut: p.short > 0 }); }, 1400);
    World.passNight(sceneView === 'interior' ? 1300 : 4600, () => {
      $('#frame').classList.remove('nightfall');
      World.setAurora(0); World.setFrost(0); G.today.shelter = false; G.today.devil = false;
      if (stormEnded) { World.setStorm(0); Sound.storm(0); }
      const fail = G.o2 <= 0 ? 'o2' : G.food <= 0 ? 'food' : G.water <= 0 ? 'water' : G.dose >= BUDGET ? 'dose' : null;
      if (fail) return endGame(fail);
      if (G.sol >= SOLS) return endGame('win');
      dayReport(notes, () => { G.sol++; beginSol(); });
    });
    World.setAurora(T.eventId === 'flare' ? 1 : 0);
  }
  function floater(anchor, text, cls, delay = 0) {
    if (sceneView === 'interior') return;
    setTimeout(() => {
      const pos = World.project(anchor); if (!pos || !pos.vis) return;
      const el = document.createElement('div'); el.className = 'floater ' + cls; el.textContent = text;
      el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; $('#floaters').appendChild(el);
      setTimeout(() => el.remove(), 2600);
    }, delay);
  }
  function dayReport(notes, next) {
    const completed = G.sol;
    next();
    Habitat.toast(`Sol ${completed} filed · A new sol begins.`);
  }

  /* ======================= Habitat interactions ======================= */
  function setSceneView(mode) {
    if (encounterOpen || (!G.over && $('#frame').classList.contains('nightfall'))) return;
    if (!G.over && mode === 'exterior') return Expedition.outside ? Expedition.showMap() : Expedition.requestDeparture();
    if (!G.over && mode === 'interior' && Expedition.outside) return Expedition.returnHome();
    if (mode === 'overview') {
      if (Expedition.outside || Expedition.busy || utilityOpen()) return;
      World.setPlayerActive(false);
    }
    if (G.over) World.setPlayerActive(false);
    sceneView = mode; showJournal(false); Habitat.view(mode);
    if (mode === 'exterior' || mode === 'overview') World.focus('overview');
    const scroll = $('#habitatScene .room-scroll');
    if (mode === 'interior' && innerWidth < 700 && !scroll.dataset.positioned) {
      scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) * .48; scroll.dataset.positioned = 'true';
    }
    Expedition.render(G);
  }
  function renderTodayRecords() {
    const notes = G.today.notes;
    $('#journalChoices').innerHTML = `<div class="page-eyebrow">Today’s Actions</div><h2>Today’s action log</h2><p class="page-subtitle">Logged ${notes.length} actions. After the day ends you can see the full record.</p><ul class="summary-notes">${notes.slice(-3).map(n => `<li>${n}</li>`).join('')}</ul>`;
  }
  function careForCrew(key, allowed, change, note) {
    if (busy || encounterOpen || G.over || utilityOpen() || G.care[key] || !allowed()) return;
    change(); G.care[key] = true; G.today.notes.push(note);
    computePool(); renderAll(); renderTodayRecords(); renderArchive();
    Habitat.toast(note); Habitat.closeCard();
    Expedition.notify(key);
  }
  function inspectCabinItem(item, target) {
    if (!G.today || G.over || busy || encounterOpen || utilityOpen()) return;
    if (!Expedition.allowCabinAction(item)) return;
    showJournal(false); Sound.click();
    if (item === 'door') { Habitat.closeCard(); return Expedition.requestDeparture(); }
    if (item === 'console') {
      Habitat.closeCard();
      if (Expedition.model.guide.active && Expedition.model.step === 'console') return Expedition.inspectPower();
      return openConsole();
    }
    if (item === 'bed') { Habitat.closeCard(); return Expedition.sleep(); }
    if (item === 'bench') { Habitat.closeCard(); return Expedition.analyse(); }
    const card = data => Habitat.card({ ...data, anchor: target });
    const action = (key, label, hint, allowed, change, note) => ({ label: G.care[key] ? 'Already done today' : label, hint, disabled: !!G.care[key] || !allowed(), run: () => careForCrew(key, allowed, change, note) });
    const bookAction = (page, label) => ({ label, hint: page === 'brief' ? 'Open Today’s Log' : 'Open the Base Console', run: () => showJournal(true, page) });
    if (item === 'food') return card({ title: 'Food Locker', value: `${f1(G.food)}<small>pts</small>`, description: `The astronauts eat ${FOOD_USE} food each day. Greenhouse harvests add food. A snack cheers everyone up.`, actions: [
      action('snack', 'Have a snack together', 'Food −3 · Mood +6 · Once a day', () => G.food >= 3 && G.morale < 100, () => { G.food -= 3; G.morale = clamp(G.morale + 6, 0, 100); }, 'Snack time! Food −3. Mood up to +6.'), bookAction('supplies', 'Count the survival supplies')
    ] });
    if (item === 'water') return card({ title: 'Drinking water tank', value: `${f1(G.water)}<small>pts</small>`, description: `The astronauts drink ${WATER_USE} water each day. The water recycler can refill it. Cleaning water needs battery power.`, actions: [
      action('drink', 'Give the astronaut a drink', 'Water −2 · Mood +4 · Once a day', () => G.water >= 2 && G.morale < 100, () => { G.water -= 2; G.morale = clamp(G.morale + 4, 0, 100); }, 'The astronaut had a drink. Water −2. Mood up to +4.'), bookAction('care', 'Check water and care supplies')
    ] });
    if (item === 'purifier') return card({ title: 'Water Recycler', value: `${G.batt}<small>battery blocks</small>`, description: 'The water recycler cleans used water. Each run uses 2 blocks of battery. Water goes up by at most 12.', actions: [
      action('filter', 'Start Cleaning Water', 'Battery −2 · Water up to +12 · Once a day', () => G.batt >= 2 && G.water < 100, () => { G.batt -= 2; G.water = clamp(G.water + 12, 0, 100); }, 'Water cleaned. Battery −2. Water up to +12.'), bookAction('plan', 'Check today’s power')
    ] });
    if (item === 'medicine') return card({ title: 'First Aid', value: `${G.meds}<small>doses</small>`, description: `Astronaut health is ${G.health} / 4. Medicine restores health and mood. Use at most one dose a day.`, actions: [
      action('medicine', 'Use one dose of medicine', 'Medicine −1 · Health +1 · Mood +8', () => G.meds > 0 && (G.health < 4 || G.morale < 100), () => { G.meds--; G.health = clamp(G.health + 1, 0, 4); G.morale = clamp(G.morale + 8, 0, 100); }, 'The astronaut took medicine. Medicine −1. Health up to +1. Mood up to +8.'), bookAction('care', 'Check the astronaut’s care record')
    ] });
    if (item === 'crew') return card({ title: 'Astronaut · Ari', value: `${Math.round(G.morale)}<small>Mood</small>`, description: G.morale < 30 || G.water < 10 || G.food < 10 ? 'Ari is not doing well. Check food and water.' : G.morale < 60 ? 'Ari’s mood is low. Chatting and snacks help.' : 'Ari is doing well. You can chat with the astronaut.', actions: [
      action('chat', 'Chat with the crew for a while', 'Mood +4 · Once a day', () => G.morale < 100, () => { G.morale = clamp(G.morale + 4, 0, 100); }, 'You chatted with the astronaut. Mood up to +4.'), bookAction('care', 'Check the astronaut’s status')
    ] });
    if (item === 'calendar') return card({ title: 'Mission calendar on the wall', value: `${G.sol}<small>/30 sols</small>`, description: `You have finished ${G.hist.length} sols. Today, keep the astronauts healthy and share power for science.`, actions: [bookAction('brief', 'Open today’s log'), { label: 'See past records', hint: 'Open the Event Archive', run: () => { Habitat.closeCard(); bookType = 'archive'; showJournal(true); } }] });
    if (item === 'radio') return card({ title: 'Earth Radio', value: G.conj > 0 ? '<small>Signal lost</small>' : '<small>Signal online</small>', description: G.conj > 0 ? 'The Sun is blocking the radio. You can listen to messages again after the conjunction.' : 'You can listen to one message each day. Then you choose what to do.', actions: [
      { label: G.care.signal ? 'Already heard today’s message' : 'Listen to a new message', hint: 'Starts a two-choice event · Once a day', disabled: !!G.care.signal || G.conj > 0, run: () => {
        if (busy || encounterOpen || G.care.signal || G.conj > 0) return;
        G.care.signal = true; busy = true; lockPlanning(true); presentEncounter(nextCabinEvent(), () => { busy = false; lockPlanning(false); renderAll(); renderTodayRecords(); renderArchive(); updateShelf(); Habitat.toast('The message and your choice are saved in the archive.'); $('#todayBook').focus({ preventScroll: true }); }, false);
      } }, { label: 'View Event Archive', hint: 'Look back at messages and past decisions', run: () => { Habitat.closeCard(); bookType = 'archive'; showJournal(true); } }
    ] });
  }
  function nextCabinEvent() {
    const events = [
      { id: 'cabin-garden', kicker: 'New in the habitat', title: 'The tomato plant has new leaves', body: 'The tomato has sprouted. You can water it, or record how it grows.', choices: [
        { t: 'Give the little tomato some water', d: [chip('pwr', 'Water −3'), chip('sci', 'Mood +9')], disabled: G.water < 3 ? 'Not enough water' : '', fn: () => { G.water -= 3; G.morale = clamp(G.morale + 9, 0, 100); return 'Tomato watered. Water −3. Mood up to +9.'; } },
        { t: 'Take a photo to track growth', d: [chip('sci', 'Science +4')], fn: () => { G.sci += 4; return 'Growth data saved. Science +4.'; } }
      ] },
      { id: 'cabin-goodnight', kicker: 'Message from Earth', title: 'A voice message from family', body: 'Family sent a voice message. You can play it, or record a reply.', choices: [
        { t: 'Play the family message', d: [chip('sci', 'Mood +8')], fn: () => { G.morale = clamp(G.morale + 8, 0, 100); return 'The astronaut listened to the message. Mood up to +8.'; } },
        { t: 'Record a reply about base science', d: [chip('sci', 'Science +3'), chip('pwr', 'Mood +2')], fn: () => { G.sci += 3; G.morale = clamp(G.morale + 2, 0, 100); return 'Reply sent. Science +3. Mood up to +2.'; } }
      ] },
      { id: 'cabin-pipe', kicker: 'Pipe check', title: 'Bubbles in the water pipe', body: 'Bubbles are blocking the pipe. Fixing it saves the trapped water. You can also switch to the spare pipe.', choices: [
        { t: 'Fix the water pipe', d: [chip('pwr', 'Battery −2'), chip('sci', 'Water up to +12')], disabled: G.batt < 2 ? 'Not enough battery' : '', fn: () => { G.batt -= 2; G.water = clamp(G.water + 12, 0, 100); return 'Pipe cleared. Battery −2. Water up to +12.'; } },
        { t: 'Switch to the spare pipe', d: [chip('pwr', 'Water −4')], fn: () => { G.water = Math.max(0, G.water - 4); return 'Switched to the spare pipe. Water −4.'; } }
      ] },
      { id: 'cabin-package', kicker: 'Tidy the storage locker', title: 'A spare supply tag', body: 'You found a supply tag. You can choose medicine or food.', choices: [
        { t: 'Choose first aid medicine', d: [chip('sci', 'Medicine up to +1')], fn: () => { G.meds = Math.min(9, G.meds + 1); return 'Supplies received. Medicine up to +1.'; } },
        { t: 'Choose spare food', d: [chip('food', 'Food up to +8')], fn: () => { G.food = clamp(G.food + 8, 0, 100); return 'Supplies received. Food up to +8.'; } }
      ] },
      { id: 'cabin-cold', kicker: 'Crew care', title: 'Ari needs a rest', body: 'Ari feels tired. You can use medicine, or cut back science work.', choices: [
        { t: 'Use one dose of medicine', d: [chip('pwr', 'Medicine −1'), chip('sci', 'Health +1 · Mood +6')], disabled: G.meds < 1 ? 'No spare medicine' : '', fn: () => { G.meds--; G.health = Math.min(4, G.health + 1); G.morale = clamp(G.morale + 6, 0, 100); return 'The astronaut took medicine. Medicine −1. Health up to +1. Mood up to +6.'; } },
        { t: 'Cut back science work', d: [chip('sci', 'Science −3 · Mood +4')], fn: () => { G.sci = Math.max(0, G.sci - 3); G.morale = clamp(G.morale + 4, 0, 100); return 'The astronaut worked less. Science −3. Mood up to +4.'; } }
      ] },
      { id: 'cabin-soup', kicker: 'Making dinner', title: 'The astronauts want hot soup', body: 'The astronauts want tomato soup. Soup needs food and water.', choices: [
        { t: 'Make a pot of hot soup together', d: [chip('food', 'Food −3 · Water −2'), chip('sci', 'Mood +12')], disabled: G.food < 3 || G.water < 2 ? 'Not enough food or water' : '', fn: () => { G.food -= 3; G.water -= 2; G.morale = clamp(G.morale + 12, 0, 100); return 'Hot soup is ready. Food −3. Water −2. Mood up to +12.'; } },
        { t: 'Sort the science data', d: [chip('sci', 'Science +4')], fn: () => { G.sci += 4; return 'Science data sorted. Science +4.'; } }
      ] },
      { id: 'cabin-photo', kicker: 'Photo time', title: 'A Mars sunset', body: 'The sky is glowing at sunset. Ari wants to take a photo.', choices: [
        { t: 'Take a crew photo', d: [chip('sci', 'Mood +8')], fn: () => { G.morale = clamp(G.morale + 8, 0, 100); return 'Crew photo taken. Mood up to +8.'; } },
        { t: 'Photograph the sky and the land', d: [chip('sci', 'Science +4')], fn: () => { G.sci += 4; return 'Sky photos saved. Science +4.'; } }
      ] }
    ];
    if (!G.cabinDeck.length) G.cabinDeck = shuffle(events.map((_,i) => i));
    return events[G.cabinDeck.shift()];
  }
  function presentEncounter(e, resolved, daily) {
    encounterOpen = true; journalPhase = 'event'; Habitat.closeCard(); showJournal(false);
    if (daily) G.today.eventId = e.id || 'cabin';
    let options = e.choices.slice();
    const defer = { t: 'Save supplies', d: [chip('none', 'No extra supplies used')], fn: () => 'No supplies used this time.' };
    while (options.length < 2) options.push(defer);
    if (options.every(c => c.disabled)) options[1] = e.choices.find(c => !c.disabled) || defer;
    const panel = $('#dailyEventModal .daily-event-card');
    panel.innerHTML = `<div class="daily-event-kicker"><span>${daily ? 'Today’s Event' : 'New message'}</span><span>SOL ${String(G.sol).padStart(2,'0')}</span></div><h2 id="dailyEventTitle">${e.title}</h2><div id="dailyEventBody" class="event-description">${e.body}</div><div class="event-option-list">${options.map((c,i) => `<button class="event-option" data-option="${i}" ${c.disabled ? 'disabled' : ''}><b>${c.t}</b><span>${c.d.join('')}${c.disabled ? `<span class="chip none">${c.disabled}</span>` : ''}</span></button>`).join('')}</div>${e.real ? `<details class="event-science"><summary>${e.real.label}${e.real.date ? ' · '+e.real.date : ''} ↗</summary><p>${e.real.text}</p><small>${e.real.src}${e.real.est ? ' · dose is a game estimate' : ''}</small></details>` : ''}<p class="daily-event-foot">${daily ? 'Your choice changes today’s supplies. If power runs short, machines get less.' : 'You can only listen to one message a day. Your choice goes in the archive.'}</p>`;
    $('#dailyEventModal').hidden = false; $('#hud').inert = true; $('#habitatScene').inert = true;
    computePool(); renderAll(); Sound.alert();
    panel.querySelector('.event-option:not(:disabled)').focus({ preventScroll: true });
    let answered = false;
    panel.querySelectorAll('[data-option]').forEach(button => button.onclick = () => {
      if (answered) return; answered = true;
      const c = options[Number(button.dataset.option)];
      let result;
      if (c.work) {
        const queued = Expedition.queueWork({ ...c.work, id: `${e.id}-${G.sol}-${button.dataset.option}`, title: c.t, complete: () => {
          const text = c.fn(); G.today.notes.push(`${c.t}: ${text}`); return text;
        } });
        result = queued ? 'Field task added. Go outside to do the job.' : 'The machine is already fixed. No need to do it again. You were not charged.';
      } else result = c.fn();
      G.decisions.push({ sol: G.sol, title: e.title, choice: c.t });
      G.today.notes.push(`${e.title}: ${c.t}. ${result}`);
      G.water = clamp(G.water, 0, 100); G.morale = clamp(G.morale, 0, 100);
      $('#dailyEventModal').hidden = true; $('#hud').inert = false; $('#habitatScene').inert = false; encounterOpen = false; journalPhase = 'planning';
      computePool(); renderAll(); renderTodayRecords(); renderArchive(); Sound.click(); resolved();
    });
  }

  /* ======================= Events ======================= */
  const chip = (k, t) => `<span class="chip ${k}">${t}</span>`;
  const EVENTS = {
    flare() {
      const f = G.flareQueue.shift() || DATA.flares[0];
      const fac = sepFac(G.shieldLv), sep = f.dose, lt = Math.round(LT.minutes);
      World.flare(); World.focus('sky'); Sound.alert();
      const T = G.today;
      return { kicker: 'Space Weather Alert', title: `Solar outburst: ${f.cls}`, art: 'flare',
        body: `This game event replays a real solar event from <b>${f.date}</b>: <b>${f.kind}</b>. In the game, high-energy particles will reach Mars in <b>a few dozen minutes</b>.<br>Your shield is at <b>level ${G.shieldLv}</b>. It blocks <b>${Math.round((1 - fac) * 100)}%</b> of this kind of radiation.`,
        real: { label: f.live ? 'Live data · NASA DONKI' : f.snapshot ? 'Recorded data · NASA DONKI snapshot (not live)' : 'Real event · NASA DONKI archive', date: f.date, text: f.note, src: f.src, est: f.doseKind !== 'measured' },
        choices: [
          { t: 'Everyone into the storm shelter', d: [chip('dose', `Radiation +${f1(sep * fac * .2)}`), chip('sci', 'Science paused today'), chip('food', 'No one tends the greenhouse −3')],
            fn: () => { T.flareDose = sep * fac * .2; T.sciLock = true; T.shelter = true; G.food = Math.max(0, G.food - 3);
              return 'The crew is in the shelter. Water inside the walls cuts radiation. Science is paused today.'; } },
          { t: 'Keep working', d: [chip('dose', `Radiation +${f1(sep * fac)}`), chip('sci', 'Science as usual'), chip('dose', `Going outside today adds +${f1(sep * .5)}`)],
            fn: () => { T.flareDose = sep * fac; T.flareOut = sep * .5;
              return `The crew kept working. Radiation inside went up by ${f1(sep * fac)} mSv.<b>Going outside today adds extra radiation.</b>`; } },
          { t: 'Ask Earth for advice', d: [chip('time', `Round trip about ${lt * 2} min`), chip('dose', `Radiation +${f1(sep * fac * .7)}`), chip('sci', 'Science paused today')], disabled: G.conj > 0 ? 'You cannot reach Earth during conjunction' : '',
            fn: () => { T.flareDose = sep * fac * .7; T.sciLock = true;
              return `Earth’s reply takes ${lt * 2} minutes. You still get radiation while you wait.<b>Choose your protection early, using the base detectors.</b>`; } }
        ] };
    },
    stormWarn() {
      World.focus('solar'); Sound.alert();
      return { kicker: 'Weather forecast', title: 'Dust storm arrives tomorrow', art: 'storm',
        body: `A weather satellite spotted a dust storm. It will arrive <b>tomorrow</b>. Power will drop to about 30% of normal. It should last ${G.stormLen} sols.`,
        real: { label: 'Real record', date: '2018-06', text: `In 2018 a global dust storm covered Mars. The dust depth τ went above 10. The solar-powered Opportunity rover lost contact on June 10. Opportunity was planned to work ${F.opportunityPlanned} sols. It actually worked ${F.opportunityActual} sols.`, src: 'NASA/JPL Opportunity mission' },
        choices: [
          { t: 'Plug the rover’s battery into the base', d: [chip('pwr', `Battery limit +4 during the storm`), chip('sci', 'Rover parked: Science −4')],
            fn: () => { G.battBonus = 4; G.sci = Math.max(0, G.sci - 4); return 'The rover battery is plugged in. The base can store up to 12 blocks during the storm.'; } },
          { t: 'Go outside and clean the solar panels', d: [chip('pwr', 'Cleanliness → 100%'), chip('dose', 'Radiation +0.2'), chip('o2', 'Oxygen −3')],
            fn: () => { G.panelEff = 1; G.dose += .2; G.doseParts.eva += .2; G.o2 = Math.max(0, G.o2 - 3); World.fx('clean'); return 'Solar panels cleaned. Power went up.'; } },
          { t: 'Do nothing', d: [chip('none', 'Spend nothing now')], fn: () => 'You used no extra supplies. Check the battery level.' }
        ] };
    },
    stormStart() {
      G.storm = G.stormLen; G.panelEff = Math.max(.5, G.panelEff - .08); World.setStorm(1); Sound.storm(1); World.focus('solar');
      return { kicker: 'Dust Storm', title: 'The dust storm is here', art: 'storm',
        body: `The dust storm is here. For the next ${G.stormLen} sols, power will be lower. The astronauts still need the same oxygen.`,
        real: { label: 'Real Science', date: '', text: 'A Mars dust storm can cover the whole planet and last for weeks. Curiosity and Perseverance use nuclear power, so they do not depend on sunlight.', src: 'NASA Mars Exploration Program' },
        choices: [
          { t: 'Power-saving mode', d: [chip('pwr', '1 block less heating each night'), chip('sci', 'Science paused during the storm')],
            fn: () => { G.stormSave = true; return 'Two modules are closed. Heating uses 1 block less each night. Science is paused during the storm.'; } },
          { t: 'Study the dust storm while it is here', d: [chip('sci', 'Science +8'), chip('pwr', 'Machines use power as usual')],
            fn: () => { G.sci += 8; return 'Dust storm study done. Science +8. Machines use power as usual.'; } }
        ] };
    },
    dustDevil() {
      World.focus('solar'); Sound.good(); G.today.devil = true;
      return { kicker: 'Good News', title: 'A dust devil swept over the solar panels', art: 'devil',
        body: `The dust devil blew some dust away. Solar panel cleanliness will go up from <b>${Math.round(G.panelEff * 100)}%</b>.`,
        real: { label: 'Real record', date: 'Since 2005', text: 'Dust devils blew dust off Spirit’s and Opportunity’s solar panels. Their power went back up, and they kept working longer.', src: 'NASA/JPL Mars Exploration Rover mission' },
        choices: [
          { t: 'Go outside and wipe them again', d: [chip('pwr', 'Cleanliness → 105%'), chip('dose', 'Radiation +0.2'), chip('o2', 'Oxygen −3')].concat(G.damaged ? [chip('pwr', 'Fix the broken panel too')] : []),
            fn: () => { G.panelEff = 1.05; G.damaged = 0; G.dose += .2; G.doseParts.eva += .2; G.o2 = Math.max(0, G.o2 - 3); World.fx('clean'); return 'Cleaning done. Solar panel efficiency is up to 105%.'; } },
          { t: 'Wait for the dust devil to clean', d: [chip('pwr', 'Cleanliness → 95%')],
            fn: () => { G.panelEff = Math.max(G.panelEff, .95); return 'The dust devil blew some dust away. Cleanliness is back to at least 95%.'; } }
        ] };
    },
    o2fault() {
      World.focus('o2'); Sound.alert();
      const hours = (F.moxieTotal / (F.o2PerPerson * 1000) * 24).toFixed(1);
      return { kicker: 'Machine Fault', title: 'The oxygen maker is overheating', art: 'o2',
        body: 'The oxygen maker heats carbon dioxide to about 800°C to pull out oxygen. Now its temperature sensor is broken.',
        real: { label: 'Real measurement', date: '2021–2023', text: `Perseverance’s MOXIE was the first machine to make oxygen on another planet. MOXIE ran 16 times and made ${F.moxieTotal} grams of oxygen in total. One person needs about ${F.o2PerPerson} kg of oxygen a day. All of MOXIE’s oxygen would let one person breathe for only about ${hours} hours.`, src: 'NASA Perseverance MOXIE experiment' },
        choices: [
          { t: 'Fix it right now', d: [chip('pwr', 'Usable power today −3')], fn: () => { G.today.poolPenalty += 3; G.o2Fault = 2; World.fx('repair'); return 'The oxygen maker is fixed. Usable power today is 3 blocks less.'; } },
          { t: 'Run it cooler for 3 sols', d: [chip('o2', 'Oxygen maker at only 60% (3 sols)')], fn: () => { G.o2Mul = .6; G.o2MulDays = 3; G.o2Fault = 1; G.o2FaultDays = 3; return 'The oxygen maker is turned down. For the next 3 sols it works at 60% of normal.'; } },
          { t: 'Ask Earth to check it remotely', d: [chip('sci', 'Uses science time: Science −6'), chip('time', `Round trip ${Math.round(LT.minutes * 2)} min`)], disabled: G.sci < 6 || G.conj > 0 ? (G.conj > 0 ? 'You cannot reach Earth during conjunction' : 'Not enough science (need 6)') : '',
            fn: () => { G.sci -= 6; World.fx('repair'); World.signal(4); return `Engineers on Earth checked it remotely. Each message round trip takes about ${Math.round(LT.minutes * 2)} minutes.`; } }
        ] };
    },
    delta() {
      World.focus('sci'); Sound.beep();
      const storm = G.storm > 0;
      return { kicker: 'Science Discovery', title: 'A special rock at the delta', art: 'rock',
        body: 'The rover photographed a spotted rock at the edge of an ancient river delta. Spots like these are worth a closer look.',
        real: { label: 'Real discovery', date: '2024-07', text: 'Perseverance found the “Cheyava Falls” rock in Jezero Crater. NASA shared the results in September 2025. The rock may hold clues to ancient life. Scientists still need to confirm it.', src: 'NASA Perseverance mission' },
        choices: [
          { t: 'Go out and collect a sample yourself', d: [chip('sci', 'Science +18'), chip('dose', 'Radiation +0.6'), chip('o2', 'Oxygen −5')], disabled: storm ? 'No going outside during a dust storm' : G.evaLock > 0 ? 'No going outside during solar conjunction' : '',
            fn: () => { G.sci += 18; G.dose += .6; G.doseParts.eva += .6; G.o2 = Math.max(0, G.o2 - 5); G.sample = true; G.today.evaShow = true; return 'The sample is in a sealed tube. Take it inside to analyze.'; } },
          { t: 'Send the rover for close-up photos', d: [chip('sci', 'Science +7'), chip('pwr', 'Usable power today −2')],
            fn: () => { G.sci += 7; G.today.poolPenalty += 2; World.fx('sample'); return 'The rover sent back photos. Science +7. Usable power today −2.'; } },
          { t: 'Note where the rock is', d: [chip('none', 'Costs nothing')], fn: () => 'Rock location saved. No sample this time.' }
        ] };
    },
    conjunction() {
      World.focus('antenna'); Sound.alert(); G.conj = 4;
      return { kicker: 'Radio Blackout', title: 'Solar conjunction: the Sun is between Earth and Mars', art: 'conj',
        body: 'For the next 4 sols you cannot contact Earth. The Sun scrambles radio signals.',
        real: { label: 'Real Science', date: '', text: 'About every 26 months, Earth and Mars end up on opposite sides of the Sun. The Sun disrupts radio contact, so NASA usually stops sending new commands for about two weeks.', src: 'NASA Mars Exploration Program' },
        choices: [
          { t: 'No going outside for 4 sols', d: [chip('sci', '4 sols without going outside')], fn: () => { G.evaLock = 4; return 'Going outside is paused. The crew will work inside for 4 sols.'; } },
          { t: 'Go outside as usual', d: [chip('o2', 'Each trip has a 1 in 3 chance of trouble: Oxygen −6')], fn: () => { G.conjRisk = 4; return 'Going outside is allowed. Earth cannot help during the conjunction.'; } }
        ] };
    },
    cold() {
      World.focus('hub'); Sound.alert();
      return { kicker: 'Weather forecast', title: 'Tonight is the coldest night of the season', art: 'cold',
        body: 'The weather station says tonight will drop to about −95°C. The heaters need 2 more blocks of power than usual.',
        real: { label: 'Real measurement', date: '', text: `Perseverance’s weather station measured local nights as cold as about ${F.nightTemp}°C. Mars air is less than 1% as thick as Earth’s, so heat escapes fast at night.`, src: 'NASA Perseverance MEDA weather station' },
        choices: [
          { t: 'Heaters on full', d: [chip('pwr', 'Usable power today −2')], fn: () => { G.today.heatAdj += 2; return 'More heating. Tonight uses 2 more blocks of power.'; } },
          { t: 'Turn off the greenhouse lights for one night', d: [chip('food', 'Growing crops are cut in half')], fn: () => { G.queue = G.queue.map(x => x * .5); World.setFrost(1); World.focus('food'); return 'Greenhouse lights are off. Future harvests are cut in half.'; } },
          { t: 'Everyone sleeps in one module', d: [chip('pwr', 'Usable power today −1'), chip('sci', 'Poor sleep: Science −3')], fn: () => { G.today.heatAdj += 1; G.today.shelter = true; G.sci = Math.max(0, G.sci - 3); return 'The crew will share one module. Tonight uses 1 more block. Science −3.'; } }
        ] };
    },
    blight() {
      World.focus('food'); Sound.alert(); G.blight = 1; G.blightFix = false;
      return { kicker: 'Greenhouse Alert', title: 'The lettuce leaves are turning yellow', art: 'plant',
        body: 'The greenhouse is too humid. Mold is spreading.',
        real: { label: 'Real record', date: '2015–2016', text: 'Astronauts first ate red lettuce grown on the space station in August 2015. Later, zinnia flowers got moldy because it was too humid. Astronaut Scott Kelly took care of the sick plants.', src: 'NASA Veggie space garden experiment' },
        choices: [
          { t: 'Pull out the sick plants', d: [chip('food', 'Growing crops −40%')], fn: () => { G.queue = G.queue.map(x => x * .6); G.cull = Math.min(.6, G.cull + .4); G.blight = .35; World.fx('pull'); return 'Sick plants removed. Future harvests are 40% smaller.'; } },
          { t: 'More air and light for 2 sols', d: [chip('pwr', 'Usable power −2 each day for 2 sols')], fn: () => { G.drain = 2; G.drainDays = 2; G.blightFix = true; computePool(); return 'More air flow and light. For the next 2 sols, the greenhouse uses 2 more blocks of power each day.'; } }
        ] };
    },
    resupply() {
      World.focus('pods'); Sound.beep();
      const land = () => { G.pods++; syncWorld(); };
      return { kicker: 'From Earth', title: 'A supply pod is about to launch', art: 'ship',
        body: 'The supply pod can carry only one kind of supply. Choose what to send.',
        real: { label: 'Real Science', date: '', text: 'A good launch window from Earth to Mars comes about every 26 months. The base needs to make as much as it can by itself.', src: 'NASA Mars Exploration Program' },
        choices: [
          { t: 'Food', d: [chip('food', 'Food +20')], fn: () => { G.food = Math.min(100, G.food + 20); land(); return 'The supply pod landed. Food up to +20.'; } },
          { t: 'Oxygen maker upgrade kit', d: [chip('o2', 'From now on, each block makes +3 oxygen (was +2.5)')], fn: () => { G.o2Rate = 3; land(); return 'The oxygen maker is upgraded. Each power block makes 3 oxygen. The base added two oxygen tanks.'; } },
          { t: 'Shield materials', d: [chip('shield', 'Shield +1 level right away')], fn: () => { G.shieldLv = Math.min(5, G.shieldLv + 1); land(); return 'Shield materials installed. Shield level up to +1.'; } }
        ] };
    },
    bones() {
      World.focus('astro');
      return { kicker: 'Health Check', title: 'The doctor says: exercise every day', art: 'health',
        body: `Mars gravity is only ${Math.round(F.gravity * 100)}% of Earth’s. Low gravity makes bones and muscles weaker. Daily exercise slows this down. Exercise also uses more oxygen.`,
        real: { label: 'Real research · NASA Twins Study', date: '2019', text: `In weightlessness, bones lose density at about ${F.boneLoss}. NASA compared Scott Kelly with his twin brother. Scott lived on the space station for almost a year. Six months after he came home, about 7% of the gene-activity changes had still not gone back to normal.`, src: 'NASA Twins Study (Garrett-Bakelman et al., 2019, Science)' },
        choices: [
          { t: 'Exercise 1 more hour a day', d: [chip('o2', 'Oxygen −1 every day from now on')], fn: () => { G.exercise = 1; return 'The crew started extra exercise. Space station astronauts usually exercise about 2 hours a day.'; } },
          { t: 'Skip exercise for now', d: [chip('health', 'Health score −1 at the end of the mission')], fn: () => { G.health -= 1; return 'Extra exercise canceled. Health score −1.'; } }
        ] };
    },
    letter() {
      World.focus('antenna'); Sound.beep();
      const lt = LT.minutes;
      return { kicker: 'From Earth', title: 'A letter from a primary school', art: 'letter',
        body: 'Students at a primary school sent a video: “Is it cold on Mars? Can you see Earth at night?”',
        real: { label: 'Live calculation', date: new Date().toISOString().slice(0, 10), text: `Distance to Mars today: about ${Math.round(LT.km / 1e6)} million km. A one-way radio signal takes about ${f1(lt)} minutes.`, src: 'JPL planetary orbital elements' },
        choices: [
          { t: 'Record a video reply', d: [chip('pwr', 'Battery −1'), chip('health', 'Health +1 · Mood +6')],
            fn: () => { if (G.batt > 0) G.batt--; else G.today.poolPenalty += 1; G.health = Math.min(4, G.health + 1); G.morale = clamp(G.morale + 6, 0, 100); sendSignalDemo(); return `Reply sent. Health up to +1. Mood up to +6. In this demo, 1 second stands for 1 minute.`; } },
          { t: 'Don’t reply yet', d: [chip('none', 'Costs nothing')], fn: () => 'The video was saved in the “To reply” folder.' }
        ] };
    },
    build() {
      World.focus('overview'); Sound.beep();
      const B2 = G.build, opts = [];
      if (B2.rows < 5) opts.push({ t: 'Expand the solar array', d: [chip('pwr', '+3 power every day from now on'), chip('pwr', 'Building today −2 blocks')], focus: 'solar',
        fn: () => { B2.rows++; G.today.poolPenalty += 2; return 'Solar array expanded. +3 power every day. Building used 2 blocks of power.'; } });
      if (B2.domes < 3) opts.push({ t: 'Build another greenhouse', d: [chip('food', '+25% food from each power block'), chip('pwr', 'Building today −2 blocks')], focus: 'food',
        fn: () => { B2.domes++; G.today.poolPenalty += 2; return 'Greenhouse built. Each power block makes 25% more food. Building used 2 blocks of power.'; } });
      if (B2.labs < 2) opts.push({ t: 'Add a lab module', d: [chip('sci', '+0.5 science from each power block'), chip('pwr', 'Building today −2 blocks')], focus: 'hub',
        fn: () => { B2.labs++; G.today.poolPenalty += 2; return 'Lab module installed. Each power block gives 0.5 more science. Building used 2 blocks of power.'; } });
      return { kicker: 'Building Chance', title: 'Building materials are ready', art: 'ship',
        body: 'Building materials are ready. Choose one thing to build. <b>New buildings change how much you produce.</b>',
        real: { label: 'Real research', date: '', text: 'NASA is studying how to print buildings from local soil. That means less material has to be shipped from Earth. NASA has also run building design challenges about it.', src: 'NASA 3D-Printed Habitat Challenge' },
        choices: opts.map(o => ({ t: o.t, d: o.d, fn: () => { const r = o.fn(); World.focus(o.focus); syncWorld(); return r; } })) };
    },
    quake() {
      World.focus('solar'); Sound.bad(); G.damaged = 1; World.fx('flashSmall');
      return { kicker: 'Marsquake', title: 'The ground shook', art: 'storm',
        body: 'A marsquake knocked over one panel in the solar array. The damaged panel makes 2 fewer blocks each day.',
        real: { label: 'Real measurement', date: '2022-05-04', text: 'InSight recorded more than 1,300 marsquakes. The biggest happened on May 4, 2022. It was about magnitude 4.7.', src: 'NASA InSight mission' },
        choices: [
          { t: 'Go out and fix it now', d: [chip('pwr', 'Power restored'), chip('dose', 'Radiation +0.3'), chip('o2', 'Oxygen −4')], disabled: G.storm > 0 ? 'No going outside during a dust storm' : '',
            fn: () => { G.damaged = 0; G.dose += .3; G.doseParts.eva += .3; G.o2 = Math.max(0, G.o2 - 4); World.fx('repair'); syncWorld(); return 'The solar panel is fixed. Power is back to normal.'; } },
          { t: 'Don’t fix it yet', d: [chip('pwr', '−2 power each day until fixed')], fn: () => 'The solar panel is still broken. It makes 2 fewer blocks each day.' }
        ] };
    },
    dirty() {
      World.focus('solar'); Sound.alert();
      return { kicker: 'Machine Reminder', title: 'The solar panels are getting dirty', art: 'devil',
        body: `Dust is building up on the solar panels. Cleanliness is now <b>${Math.round(G.panelEff * 100)}%</b>. Dust lowers your power.`,
        real: { label: 'Real record', date: '2022-12', text: 'InSight worked on Mars for four years. Dust on its solar panels cut its power. InSight ran out of power and ended its mission in December 2022.', src: 'NASA InSight mission' },
        choices: [
          { t: 'Go Out and Clean', d: [chip('pwr', 'Cleanliness → 100%'), chip('dose', 'Radiation +0.2'), chip('o2', 'Oxygen −3')].concat(G.damaged ? [chip('pwr', 'Fix the broken panel too')] : []),
            fn: () => { G.panelEff = 1; G.damaged = 0; G.dose += .2; G.doseParts.eva += .2; G.o2 = Math.max(0, G.o2 - 3); World.fx('clean'); return 'Solar panels cleaned. Power went up.'; } },
          { t: 'Wait for the wind', d: [chip('none', 'Cleanliness keeps dropping')], fn: () => 'You chose to wait. Dust will keep building up on the panels.' }
        ] };
    }
  };

  function openEvent(id, resolved) {
    const e = EVENTS[id](); e.id = id;
    const physical = {
      stormWarn: [1, 'clean', 'solar', {o2:3,dose:.2}], dustDevil: [0, 'clean', 'solar', {o2:3,dose:.2}],
      dirty: [0, 'clean', 'solar', {o2:3,dose:.2}], quake: [0, 'repair', 'solar', {o2:4,dose:.3}],
      o2fault: [0, 'repair', 'o2', {power:3}], delta: [0, 'sample', 'rock', {o2:5,dose:.6}]
    }[id];
    if (physical) {
      const [i,kind,target,cost] = physical; e.choices[i].work = {kind,target,cost};
      if (kind === 'repair') e.choices[i].work.needed = target === 'o2' ? g => g.o2Fault > 0 : g => g.damaged > 0;
      if (kind === 'clean') e.choices[i].work.needed = g => g.panelEff < (id === 'dustDevil' ? 1.05 : 1) || (id !== 'stormWarn' && g.damaged > 0);
      if (evaBlocked()) e.choices[i].disabled = evaBlocked();
      if (!ExpeditionModel.canAfford(G,cost)) e.choices[i].disabled = 'Not enough supplies. Choose another option.';
    }
    if (id === 'o2fault') { G.o2Fault = 1; G.o2Mul = .6; G.o2MulDays = 3; G.o2FaultDays = 3;
      const repair = e.choices[0].fn; e.choices[0].fn = () => { const text=repair();G.o2Mul=1;G.o2MulDays=0;G.o2Fault=0;G.o2FaultDays=0;return text; };
      const remote = e.choices[2].fn; e.choices[2].fn = () => {const text=remote();G.o2Mul=1;G.o2MulDays=0;G.o2Fault=0;G.o2FaultDays=0;return text;};
    }
    presentEncounter(e, resolved, true);
  }
  function sendSignalDemo() {
    const lt = LT.minutes, el = document.createElement('div'); el.className = 'sigdemo';
    el.innerHTML = `<div class="sd-h">Your reply is flying to Earth</div><div class="sd-bar"><s></s></div><div class="sd-n"></div>`; $('#frame').appendChild(el);
    World.signal(lt + 1);
    const t0 = performance.now();
    (function tick() { const k = Math.min(1, (performance.now() - t0) / 1000 / lt);
      el.querySelector('s').style.width = k * 100 + '%'; el.querySelector('.sd-n').textContent = `${f1(k * lt)} / ${f1(lt)} minutes (in the game, 1 second = 1 minute)`;
      if (k < 1) requestAnimationFrame(tick); else { el.querySelector('.sd-h').textContent = 'Earth got it!'; Sound.good(); setTimeout(() => el.remove(), 2200); } })();
  }

  /* ======================= Intro ======================= */
  function showCap(html, hold) {
    const c = $('#cap'); c.classList.remove('on'); void c.offsetWidth;
    c.innerHTML = html; c.classList.add('on');
    clearTimeout(showCap.t); if (hold) showCap.t = setTimeout(() => c.classList.remove('on'), hold);
  }
  function startIntro() {
    Sound.init(); Sound.whoosh();
    $('#title').classList.remove('on'); $('#skip').classList.add('on');
    const dist = Math.round(LT.km / 1e6);
    const cues = [
      { t: .6, id: 'c1' }, { t: 3.6, id: 'c2' }, { t: 9, id: 'c3' }, { t: 13.5, id: 'c4' }, { t: 18.5, id: 'c5' }, { t: 23.2, id: 'c6' }
    ];
    const text = {
      c1: '<span class="big">This is Earth.</span>',
      c2: 'Earth has air that people can breathe.<br>Its air and magnetic field block space radiation.',
      c3: '<span class="big">On Mars, you must make your own oxygen and food.</span>',
      c4: `Distance from Earth today: <b>${dist} million km</b>.<br>A radio signal takes <b>${f1(LT.minutes)} min</b>.`,
      c5: 'You will run this Mars base.<br>The mission lasts <b>30 sols</b>.',
      c6: '<span class="big">Share power between the machines.</span><br>Check the cost of each action first.'
    };
    World.playIntro(cues, id => { if (id === 'end') return land(); showCap(text[id], id === 'c6' ? 4600 : 4800); });
  }
  let landed = false;
  function land() {
    if (landed) return; landed = true;
    World.stopIntro(); $('#skip').classList.remove('on'); $('#cap').classList.remove('on');
    const en = $('#entry'); en.classList.add('on'); Sound.whoosh();
    setTimeout(() => {
      World.descend(() => { startGame(); });
      setTimeout(() => showCap('<span class="big">Jezero Crater</span><br>18.4° North · an ancient lake bed that dried up about 3.5 billion years ago', 5000), 1600);
    }, 1100);
    setTimeout(() => en.classList.remove('on'), 2600);
  }
  function startGame() {
    $('#hud').classList.add('on'); setSceneView('interior');
    beginSol();
  }

  /* ======================= Endings ======================= */
  /* the ending depends on your choices: Discoverer / Pioneer / Guardian / Mission Success / Safe Return / Emergency Evacuation */
  const ENDINGS = {
    discovery: { title: 'Discoverer', badge: 'Discoverer', color: '#e6a83f',
      sub: 'The sample capsule has launched. A return ship will carry the rocks to Earth. Scientists will keep studying them.',
      caps: [[0, '<span class="big">The sample tubes are sealed.</span>'], [4200, '<span class="big">Liftoff!</span><br>The sample capsule has launched.']] },
    builder: { title: 'Pioneer', badge: 'Pioneer', color: '#d9692f',
      sub: 'You expanded the base. A second crew is landing. The new buildings will help them keep working.',
      caps: [[0, '<span class="big">A second crew is landing.</span>'], [5200, 'The second crew is here.<br>They will use the base you expanded.']] },
    guardian: { title: 'Guardian', badge: 'Guardian', color: '#3f8f93',
      sub: 'The crew finished the 30-sol mission. They are healthy. Their radiation dose stayed under the limit.',
      caps: [[0, '<span class="big">The last night.</span>'], [5200, 'Everyone came outside.<br>Green auroras lit up the sky.']] },
    success: { title: 'Mission Success', badge: 'Mission Success', color: '#7fae5b',
      sub: 'The crew reached the survival and science goals. The ascent vehicle is taking them and their data to the return ship.',
      caps: [[0, '<span class="big">All crew aboard.</span>'], [6000, 'The crew is leaving Mars.']] },
    home: { title: 'Safe Return', badge: 'Safe Return', color: '#8cc7c3',
      sub: `The crew got home safely. Science did not reach ${GOAL} points. Next time, try more science or sample trips.`,
      caps: [[0, '<span class="big">All crew aboard.</span>'], [6000, 'The crew got home safely.']] },
    evac: { title: 'Mission Ended Early', badge: 'Emergency Evacuation', color: '#b8452a',
      sub: 'This mission ended early. Look at your resource records. You can try again.',
      caps: [[0, '<span class="big">Alarm!</span><br>Everyone to the ascent vehicle!']] }
  };
  function badges(kind) {
    const b = [], builds = (G.build.rows - 2) + (G.build.domes - 1) + G.build.labs;
    if (kind !== 'win') return b;
    if (G.sci >= 130 || (G.sample && G.sci >= 110)) b.push('discovery');
    if (builds >= 3 || (builds >= 2 && G.shieldLv >= 4)) b.push('builder');
    if (G.dose <= 13 && G.health >= 3) b.push('guardian');
    return b;
  }
  function endingKind(kind) {
    if (kind !== 'win') return 'evac';
    const b = badges(kind); if (b.length) return b[0];
    return G.sci >= GOAL ? 'success' : 'home';
  }
  function endGame(kind) {
    Expedition.finish();
    G.over = true; busy = true; hideTip(); Habitat.closeCard(); setSceneView('exterior'); $('#frame').classList.remove('notebook-open');
    $('#hud').classList.remove('on'); $('#modal').classList.remove('on');
    World.setStorm(0); World.setFrost(0); G.eva = false; G.today.shelter = false; syncWorld({ eva: false, shelter: false });
    const ek = endingKind(kind); G.ending = ek;
    const why = kind === 'win' ? '' : kind === 'o2' ? 'Oxygen is almost gone.' : kind === 'food' ? 'Food has run out.' : kind === 'water' ? 'Drinking water has run out.' : 'Radiation dose went over the mission limit.';
    kind === 'win' ? Sound.good() : Sound.bad();
    showCap(kind === 'win' ? '<span class="big">Sol 30.</span><br>Mission complete.' : `<span class="big">${why}</span><br>The crew is evacuating Mars.`, 3600);
    const E = ENDINGS[ek];
    setTimeout(() => {
      E.caps.forEach(([t, c]) => setTimeout(() => showCap(c, 3800), t));
      World.ending(ek, () => {
        World.lookEarth();
        const caps = ['The blue planet you see is Earth.', 'A Mars base has to make its own oxygen and food.<br>It also needs power and radiation protection.', 'Earth’s air and magnetic field cut radiation.<br>Earth’s water and air support life.', '<span class="big">Let’s take care of Earth.</span>'];
        caps.forEach((c, i) => setTimeout(() => showCap(c, i === 3 ? 3800 : 3300), 600 + i * 3500));
        setTimeout(() => showReport(kind), 600 + caps.length * 3500 + 600);
      });
    }, 3800);
  }
  function chartSVG() {
    const h = G.hist, W = 560, Hh = 170, pad = 28, n = Math.max(h.length, 2);
    const X = i => pad + i / (SOLS - 1) * (W - pad * 2), Y = v => Hh - 20 - v * (Hh - 40);
    const line = (key, scale, color) => `<polyline fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" points="${h.map((d, i) => `${X(i)},${Y(clamp(d[key] / scale, 0, 1))}`).join(' ')}"/>`;
    const evs = h.map((d, i) => d.ev ? `<g><line x1="${X(i)}" x2="${X(i)}" y1="12" y2="${Hh - 20}" stroke="#2b1a24" stroke-dasharray="2 3" opacity=".35"/><circle cx="${X(i)}" cy="12" r="4" fill="${d.ev === 'flare' ? '#d9692f' : d.ev.startsWith('storm') ? '#8e2f22' : '#2b1a24'}"/></g>` : '').join('');
    const storm = h.map((d, i) => d.gen <= 5 ? `<rect x="${X(i) - 8}" y="12" width="16" height="${Hh - 32}" fill="#8e2f22" opacity=".12"/>` : '').join('');
    return `<svg viewBox="0 0 ${W} ${Hh}" class="chart" role="img" aria-label="Mission resource chart">
      ${storm}<line x1="${pad}" x2="${W - pad}" y1="${Hh - 20}" y2="${Hh - 20}" stroke="#2b1a24" stroke-width="2"/>
      ${evs}${line('o2', 100, '#3f8f93')}${line('food', 100, '#7fae5b')}${line('dose', BUDGET, '#d9692f')}${line('sci', GOAL, '#e6a83f')}
      <text x="${pad}" y="${Hh - 4}" class="ax">Sol 1</text><text x="${W - pad}" y="${Hh - 4}" text-anchor="end" class="ax">Sol 30</text></svg>`;
  }
  function insights(kind) {
    const out = [];
    const tot = Object.values(G.powerUse).reduce((a, b) => a + b, 0) || 1, pc = k => Math.round(G.powerUse[k] / tot * 100);
    out.push(`You shared out <b>${tot}</b> power blocks in total: oxygen ${pc('o2')}%, greenhouse ${pc('food')}%, shield ${pc('shield')}%, science ${pc('sci')}%.`);
    const dp = G.doseParts;
    out.push(`Total radiation was <b>${f1(G.dose)} mSv</b>. Cosmic rays added ${f1(dp.gcr)}. Solar storms added ${f1(dp.sep)}. Going outside added ${f1(dp.eva)}. ${dp.gcr > dp.sep ? '<b>Cosmic rays are hard to block. You need steady protection.</b>' : '<b>One solar storm can add a lot of radiation.</b>'}`);
    let mi = 0; G.hist.forEach((d, i) => { if (d.o2 < G.hist[mi].o2) mi = i; });
    if (G.hist.length) { const m = G.hist[mi]; out.push(`Sol ${m.sol} had the lowest oxygen. Left: <b>${Math.round(m.o2)}%</b>${m.gen <= 5 ? '. A dust storm hit that day, so power was very low' : ''}.`); }
    if (kind === 'o2') {
      let run = 0, i = G.hist.length - 1; while (i >= 0 && G.hist[i].alloc.o2 * G.o2Rate < O2_USE) { run++; i--; }
      out.push(`<b>What happened:</b> For the last ${run} sols the oxygen maker did not get enough power. The astronauts use at least ${O2_USE} oxygen each day, so the reserve kept dropping.`);
    }
    if (kind === 'food') out.push('<b>What happened:</b> The greenhouse takes 3 sols to harvest. Give it power before the food runs out.');
    if (kind === 'water') out.push('<b>What happened:</b> The astronauts drink water every day. Run the water recycler early to refill it.');
    if (kind === 'dose') out.push('<b>What happened:</b> Radiation keeps adding up. Upgrading the shield early lowers the dose. You can use the shelter during solar storms.');
    if (G.decisions.length) out.push('Your key decisions: ' + G.decisions.slice(0, 5).map(d => `Sol ${d.sol} : “${d.choice}”`).join(', ') + '.');
    return out;
  }
  function showReport(kind) {
    const win = kind === 'win';
    const sciOk = G.sci >= GOAL;
    const E = ENDINGS[G.ending || 'home'];
    const title = E.title, sub = E.sub;
    const all = ['discovery', 'builder', 'guardian'], got = badges(kind);
    const hint = { discovery: `Science ≥ 130, or analyze the delta rock and reach science ≥ 110`, builder: 'Build 3 expansions (or 2 + shield level 4)', guardian: 'Radiation ≤ 13 mSv and crew health ≥ 3' };
    const badgeHtml = `<div class="rp-badges">${all.map(k => `<div class="bdg ${got.includes(k) ? 'got' : ''}" style="--c:${ENDINGS[k].color}"><b>${ENDINGS[k].badge}</b><span>${got.includes(k) ? 'Achieved' : hint[k]}</span></div>`).join('')}</div>`;
    const build = `Solar panels ${G.build.rows} rows · greenhouses ${G.build.domes} · lab modules ${G.build.labs} · oxygen tanks ${tanks()} · field flags ${G.evaCount + (G.sample ? 1 : 0)} `;
    const crewO2 = (F.o2PerPerson * 4).toFixed(2);
    const earthYears = (G.dose / F.earthBackground).toFixed(1);
    $('#report').innerHTML = `<div class="rp">
      <div class="rp-k">Mission Report · Jezero Outpost</div>
      <h1><span style="background:linear-gradient(transparent 58%,${E.color} 58%);padding:0 .1em">${title}</span></h1><p class="rp-sub">${sub}</p>
      ${badgeHtml}
      <div class="rp-build">The base you built: ${build}</div>
      <p class="rp-care">Supplies when heading home: water ${f1(G.water)} · Medicine ${G.meds} · crew mood ${Math.round(G.morale)} / 100</p>
      <div class="rp-stats">
        <div><b>${G.hist.length}</b><span>Sols completed</span></div>
        <div><b>${Math.round(G.sci)}</b><span>Science / ${GOAL}</span></div>
        <div><b>${f1(G.dose)}</b><span>Radiation dose (mSv)</span></div>
        <div><b>${G.shieldLv}</b><span>Shield level</span></div>
        <div><b>${'●'.repeat(clamp(G.health, 0, 4))}${'○'.repeat(4 - clamp(G.health, 0, 4))}</b><span>Crew health</span></div>
      </div>
      <div class="rp-chart"><div class="lg"><i style="background:#3f8f93"></i> Oxygen <i style="background:#7fae5b"></i> Food <i style="background:#d9692f"></i> Radiation <i style="background:#e6a83f"></i> Science <i class="ev"></i> Events</div>${chartSVG()}</div>
      <div class="rp-cols">
        <div><h3>What your result means</h3><ul>${insights(kind).map(x => `<li>${x}</li>`).join('')}</ul></div>
        <div><h3>Compare with the real world</h3><ul>
          <li>Your crew of 4 needs about <b>${crewO2} kg</b> of oxygen each day. Perseverance’s MOXIE made a total of <b>${F.moxieTotal} g</b>.</li>
          <li>This ${G.hist.length}-sol mission’s radiation equals Earth’s average natural radiation for <b>${earthYears} years</b>. NASA’s career radiation limit is <b>${F.careerLimit} mSv</b>.</li>
          <li>Opportunity was planned to work ${F.opportunityPlanned} sols. It actually worked <b>${F.opportunityActual} sols</b>. Then it lost contact in a dust storm.</li>
        </ul></div>
      </div>
      <div class="rp-end">A Mars base must keep making oxygen. Use your resource records to change your plan next time.</div>
      <div class="rp-btns"><button class="btn big" id="bAgain">Play Again</button><button class="btn" id="bSrc2">Data Sources</button></div>
    </div>`;
    $('#report').classList.add('on');
    $('#bAgain').onclick = () => { Sound.click(); $('#report').classList.remove('on'); World.reset(); newGame(); $('#hud').classList.add('on'); setSceneView('interior'); beginSol(); };
    $('#bSrc2').onclick = openSources;
  }

  /* ======================= Data sources / communication ======================= */
  function openSources() {
    const L = DATA.live;
    const liveHtml = L.status === 'snapshot' ? `<b class="bad">● Not connected</b> Live data is unavailable, so the game uses a saved NASA DONKI snapshot (flares ${L.range.join(' to ')}, downloaded ${L.fetchedAt.toISOString().slice(0, 10)}). It is <b>not live</b>. It has <b>${L.flares.length}</b> flares. The strongest: ${L.flares.slice(0, 5).map(f => `<span class="chip pwr">${f.cls} · ${f.peak.slice(0, 10)}</span>`).join(' ')}`
      : L.status === 'ok' ? (L.flares.length ? `<b class="ok">● Connected</b> In the last 30 days DONKI recorded <b>${L.flares.length}</b> flares. The strongest: ${L.flares.slice(0, 5).map(f => `<span class="chip pwr">${f.cls} · ${f.peak.slice(0, 10)}</span>`).join(' ')}` : '<b class="ok">● Connected</b> No flares were recorded in the last 30 days.')
      : L.status === 'loading' ? 'Connecting to NASA DONKI…' : '<b class="bad">● Not connected</b> Cannot reach NASA right now. The game will use its archive of past events.';
    $('#srcCard').innerHTML = `<button class="x" id="srcX" aria-label="Close">×</button>
      <div class="rp-k">Data Sources & Notes</div><h2>Data Sources</h2>
      <div class="live">${liveHtml}</div>
      <div class="live">Today (${new Date().toISOString().slice(0, 10)}) Earth to Mars: <b>${Math.round(LT.km / 1e6)} million km</b>. One-way signal <b>${f1(LT.minutes)} min</b>. Calculated live from JPL planetary orbital elements.</div>
      <div class="src-list">${DATA.sources.map(s => `<div class="src"><span class="r-tag">${s.tag}</span><h4>${s.title}</h4><p>${s.body}</p><a href="${s.link}" target="_blank" rel="noopener">${s.link.replace('https://', '')}</a></div>`).join('')}</div>
      <h3>How the game is simplified</h3><ul class="simp">${DATA.simplifications.map(s => `<li>${s}</li>`).join('')}</ul>
      <h3>For Teachers and Parents</h3>
      <p class="teach">Game rules:<br>1. Each block of power can only go to one machine.<br>2. The greenhouse takes 3 sols to harvest.<br>3. Upgrade the shield before solar storms.<br>4. Earth’s replies take time. Check your local data first.</p>`;
    $('#sources').classList.add('on');
    $('#srcX').onclick = () => $('#sources').classList.remove('on');
  }
  function openComm() {
    if (!G) return;
    const blocked = G.conj > 0;
    $('#mcard').innerHTML = `<div class="ev-art art-letter"><div class="ev-k">Talk to Earth</div></div>
      <h2>${blocked ? 'Radio cut off during conjunction' : `One-way signal ${f1(LT.minutes)} min`}</h2>
      <p class="ev-b">Distance to Mars today: about <b>${Math.round(LT.km / 1e6)} million km</b>. A radio signal still needs <b>${f1(LT.minutes)} min</b>. One message there and back takes at least <b>${f1(LT.minutes * 2)} min</b>. When Earth and Mars are closest, a one-way signal takes about 3 minutes. When they are farthest, about 22 minutes.</p>
      <div class="choices"><button class="btn go" id="cmSend" ${blocked ? 'disabled' : ''}>Send “Hello, Earth”</button><button class="btn" id="cmX">Close</button></div>`;
    $('#modal').classList.add('on'); World.focus('antenna');
    $('#cmX').onclick = () => { $('#modal').classList.remove('on'); World.focus('overview'); };
    const s = $('#cmSend'); if (s) s.onclick = () => { $('#modal').classList.remove('on'); sendSignalDemo(); };
  }

  /* ======================= Start-up ======================= */
  function boot() {
    World.init($('#stage'));
    Habitat.init({ inspect: inspectCabinItem, view: setSceneView });
    Expedition.init({ state: () => G, canAct: () => !!G && !busy && !encounterOpen && !G.over && !utilityOpen() && !$('#frame').classList.contains('nightfall'),
      blockReason: evaBlocked, preview, powerStatus, refresh: () => { computePool(); renderAll(); renderTodayRecords(); renderArchive(); },
      effect: (fn, note) => { fn(); G.today.notes.push(note); computePool(); renderAll(); renderTodayRecords(); renderArchive(); },
      view: mode => { sceneView=mode;showJournal(false);Habitat.closeCard();Habitat.view(mode); },
      plan: openConsole, completeAllocation, endDay: endSol, inspect: inspectCabinItem
    });
    buildHUD(); newGame();
    $('#title').classList.add('on');
    $('#bStart').onclick = () => startIntro();
    $('#bQuick').onclick = () => { Sound.init(); $('#title').classList.remove('on'); land(); };
    $('#skip').onclick = () => land();
    $('#bSrc0').onclick = openSources; $('#bSrc').onclick = openSources;
    $('#bComm').onclick = openComm;
    $('#closeBook').onclick = () => { showJournal(false); $(bookType === 'today' ? '#todayBook' : '#archiveBook').focus({ preventScroll: true }); Sound.click(); };
    $('#todayBook').onclick = () => openNotebook('today');
    $('#archiveBook').onclick = () => openNotebook('archive');
    $('#consoleReturn').onclick = () => setSceneView('interior');
    $('#previousPage').onclick = () => flipBook(-1); $('#nextPage').onclick = () => flipBook(1);
    $('#planningNotice').onclick = () => journalPage(journalPhase === 'event' ? 'decision' : 'brief');
    $('#journalMap').innerHTML = mapSketch;
    $('#bSnd').onclick = () => { Sound.init(); const on = Sound.toggle(); $('#bSnd').textContent = on ? 'Sound: On' : 'Sound: Off'; };
    $('#bSnd').textContent = Sound.on ? 'Sound: On' : 'Sound: Off';
    $('#bComm').textContent = `Earth · ${f1(LT.minutes)} min`;
    $('#sources').onclick = e => { if (e.target.id === 'sources') $('#sources').classList.remove('on'); };
    addEventListener('keydown', e => {
      if (Expedition.busy) return;
      if (encounterOpen) {
        if (e.key === 'Escape') { e.preventDefault(); return; }
        if (e.key === 'Tab') {
          const buttons = [...document.querySelectorAll('#dailyEventModal button:not(:disabled), #dailyEventModal summary')];
          const first = buttons[0], last = buttons.at(-1);
          if (e.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement))) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement))) { e.preventDefault(); first?.focus(); }
        }
        return;
      }
      if (e.key === 'Escape' && !$('#itemPopover').hidden) { Habitat.closeCard(true); return; }
      if (e.key === 'Escape') {
        if ($('#sources').classList.contains('on')) $('#sources').classList.remove('on');
        else if ($('#modal').classList.contains('on')) $('#modal').classList.remove('on');
        else if ($('#hud').classList.contains('on') && !$('#frame').classList.contains('nightfall')) showJournal($('#notebook').hidden);
      }
      if (['ArrowLeft', 'ArrowRight'].includes(e.key) && $('#hud').classList.contains('on') && !$('#notebook').hidden && !$('#modal').classList.contains('on') && !$('#sources').classList.contains('on') && !e.target.closest('input, .s-ctl') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); flipBook(e.key === 'ArrowRight' ? 1 : -1); }
    });
    const tl = $('#tLive');
    tl.innerHTML = `Earth to Mars today: <b>${Math.round(LT.km / 1e6)} million km</b> · signal takes <b>${f1(LT.minutes)} min</b><br><span id="tDonki">Loading NASA space weather…</span>`;
    DATA.fetchDonki().then(L => {
      const d = $('#tDonki');
      if (L.status === 'ok') d.innerHTML = L.flares.length ? `NASA DONKI live: in the last 30 days the Sun made <b>${L.flares.length}</b> flares. The strongest was <b>${L.flares[0].cls}</b>` : 'NASA DONKI live: no flares recorded in the last 30 days';
      else if (L.status === 'snapshot') d.innerHTML = `Offline: NASA DONKI snapshot (${L.range.join(' to ')}, not live) · strongest flare <b>${L.flares[0] ? L.flares[0].cls : 'none'}</b>`;
      else d.textContent = 'Offline mode: using real events from the NASA DONKI archive';
      if (!G.over && G.sol === 1 && !$('#hud').classList.contains('on')) newGame(); // reorder events once live data arrives
    });
  }
  boot();
  if (/debug/.test(location.search)) window.__dbg = { G: () => G, endGame, syncWorld, renderAll, beginSol, startGame, newGame, openEvent, preview, endSol };
})();
