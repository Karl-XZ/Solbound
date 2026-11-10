/* =====================================================================
   游戏：规则、事件、界面
   核心取舍：每天的电只有这么多 —— 给了制氧，就不能给温室。
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
    { k: 'o2', name: '制氧', color: '#8cc7c3', focus: 'o2',
      tip: '把火星大气里的二氧化碳拆开，得到氧气。毅力号上的 MOXIE 实验已经在火星上真的这样做过。每格电 +2.5 氧气；乘组每天要用掉 7。' },
    { k: 'food', name: '温室', color: '#7fae5b', focus: 'food',
      tip: '温室需要灯光和加热。每格电让作物多长 1.8 份食物，但要 3 天后才能收获——今天的决定，三天后才见效。' },
    { k: 'shield', name: '屏蔽施工', color: '#d9692f', focus: 'shield',
      tip: '用挖土机把火星土堆到舱段上。每攒够 5 格电，屏蔽升 1 级。土越厚，挡住的辐射越多——这是永久的。' },
    { k: 'sci', name: '科研', color: '#e6a83f', focus: 'sci',
      tip: '分析岩石、观测天气、把数据发回地球。每格电 +1.5 科学。科学是你们来火星的原因。' }
  ];
  const TIPS = {
    water: '乘组每天消耗 2.5 点饮水。点击生活舱里的净水机，花 2 格电池净化 12 点水；每天可净化一次。水耗尽时任务必须中止。',
    meds: '急救箱里的药品。每次使用 1 份，健康 +1、士气 +8；每天最多使用一次。',
    morale: '士气影响宇航员的表情。每天自然下降 2 点，缺少食物或水时下降更快。加餐、饮水、聊天和事件选择都能改善心情。',
    o2: `乘组每天要消耗 ${O2_USE} 点氧气（现实中每人每天约 ${F.o2PerPerson} 千克）。氧气降到 0，任务必须中止。`,
    food: `乘组每天吃掉 ${FOOD_USE} 点食物。温室种下的作物 3 天后才能收获。`,
    dose: `辐射剂量的单位是“毫希”（mSv）。在地球上，一个人一年大约受到 ${F.earthBackground} 毫希的天然辐射；火星地表每个火星日约 ${F.radSurface} 毫希（好奇号实测）。这次任务的上限是 ${BUDGET} 毫希。`,
    sci: `科学成果，目标 ${GOAL} 分。活下来是底线，带回科学发现才算任务成功。`,
    batt: `白天没用完的电会存进电池，最多 ${BATT_MAX} 格。沙尘暴的时候，它就是你的救命稻草。`,
    shield: '屏蔽等级越高，挡住的辐射越多。注意：它对太阳风暴的效果，远远好过对银河宇宙射线的效果。',
    sol: `火星日（sol）：火星自转一圈的时间，${F.solLength}，比地球的一天长一点点。`,
    tau: 'τ 表示空气里有多少灰尘。数字越大，阳光越难穿过来。平时约 0.5；2018 年那场全球沙尘暴超过了 10。',
    heat: `火星夜里约 ${F.nightTemp}°C。加热器每晚必须先用掉一部分电，否则设备和人都受不了。`,
    eva: '穿上宇航服到外面去考察。能拿到更多科学成果，但舱外没有屏蔽，辐射更多，宇航服也要用氧气。'
  };

  /* ======================= 状态 ======================= */
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
    const name = bookType === 'today' ? '今日手册' : '事件档案';
    $('#bookName').textContent = name; $('#notebook').setAttribute('aria-label', name);
    $('#chapterName').textContent = pages[index].dataset.label;
    $('#pageNumber').textContent = `${String(index + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`;
    $('#previousPage').disabled = index === 0; $('#nextPage').disabled = index === pages.length - 1;
    const start = Math.max(0, Math.min(index - 2, pages.length - 5));
    $('#pageTrack').innerHTML = pages.slice(start, start + 5).map((p, i) => `<button data-index="${start + i}" class="${start + i === index ? 'current' : ''}" aria-label="第 ${start + i + 1} 页：${p.dataset.label}" ${start + i === index ? 'aria-current="page"' : ''}></button>`).join('');
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
  function lockPlanning(locked, message = '') {
    for (const el of [$('#power'), $('#planActions')]) { el.classList.toggle('off', locked); el.inert = locked; }
    const notice = $('#planningNotice'); notice.hidden = !message; notice.textContent = message;
  }
  const mapSketch = `<div class="jezero-map" aria-label="杰泽罗基地示意图">
    <svg viewBox="0 0 400 130" fill="none" aria-hidden="true">
      <g stroke="#97aa8a" stroke-width=".7"><path d="M-30 110C60 170 87 44 150 45S206 145 300 102 395 60 440 95"/><path d="M-30 93C50 145 93 28 155 30S216 125 297 88 395 45 440 77"/><path d="M-30 77C50 129 90 12 160 15S225 108 294 74 395 30 440 60"/><path d="M-30 58C50 110 95-4 166-1S230 90 295 59 395 15 440 44"/><path d="M-30 40C50 92 92-20 170-18S240 72 298 44 395 0 440 28"/><path d="M-30 128C60 188 87 60 145 61S195 161 303 119 395 77 440 112"/></g>
      <path d="M130 103L163 86 194 89 218 57 265 43" stroke="#5b7d5c" stroke-dasharray="3 4"/>
      <circle cx="218" cy="57" r="17" stroke="#7d9c75" stroke-dasharray="2 4"/><circle cx="218" cy="57" r="4" fill="#4e7957"/><path d="M218 30V38M218 76V84M191 57H199M237 57H245" stroke="#4e7957"/>
      <path d="M25 18V32M18 25H32M368 99V113M361 106H375" stroke="#8ca180"/><text x="243" y="61" font-size="8" font-family="monospace" fill="#5c7b58">OUTPOST 01</text>
    </svg><span class="map-coordinate">LOCAL MAP / 1:25 000</span><span class="map-caption">JEZERO · 18.4° N / 77.5° E</span></div>`;
  function dailyEntry() {
    $('#solCard').hidden = false;
    const warning = G.o2 < 25 ? '氧气储备偏低，今天请优先保障制氧。' : G.food < 25 ? '食物储备偏低。温室的投入要三天后才能收获，请提前安排。' : G.storm > 0 ? '沙尘暴还没有过去。用好电池，优先保证生命保障系统。' : G.events[G.sol + 1] === 'stormStart' ? '沙尘暴明天到达。今天尽可能补足储备，并为电池充电。' : '';
    $('#journalEvent').innerHTML = `<div class="entry-label">${G.sol === 1 ? 'FIRST ENTRY' : 'DAILY BRIEFING'}</div>
      <h2>${G.sol === 1 ? '我们在火星的第一天。' : warning ? '今天，多留一份余量。' : '新的一天，基地一切如常。'}</h2>
      <p class="entry-body">${G.sol === 1 ? '舱门已经密封，四个人的生活从这里开始。窗外是陌生的红色荒原，手边是我们拥有的一切。<br><br>清点物资，再安排今天的电力。每一个决定，都将写进这本手册。' : warning || '太阳能板正在发电，温室等待照料。先清点物资，再安排今天的工作。'}</p>
      <div class="mission-target"><span>我们的任务</span><b>生存 30 日 · 科学 ≥ 100</b><small>氧气与食物 &gt; 0 · 辐射 &lt; 25 毫希</small></div>`;
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
      const records = chunks.map((chunk, i) => `<section class="book-page archive-page" data-book="archive" data-sheet="archive-${d.sol}-${i}" data-label="SOL ${String(d.sol).padStart(2, '0')} · 事件记录" hidden><div class="page-eyebrow">MISSION ARCHIVE / ${d.pending ? '今日已记录' : '日终归档'}</div><h2>第 ${d.sol} 日${i ? ' · 续页' : '，留下的记录。'}</h2>${!i && !notes.length ? d.decisions.map(c => `<div class="archived-decision"><span>${c.title}</span><b>✓ ${c.choice}</b></div>`).join('') : ''}${chunk.length ? `<ul class="summary-notes">${chunk.map(n => `<li>${n}</li>`).join('')}</ul>` : `<p class="entry-body">${d.pending ? '决定已经写入。今天结束后，物资与电力安排也将归档。' : '今天没有特殊事件。基地按计划运转。'}</p>`}</section>`).join('');
      if (d.pending) return records;
      return records + `<section class="book-page archive-page" data-book="archive" data-sheet="archive-${d.sol}-resources" data-label="SOL ${String(d.sol).padStart(2, '0')} · 资源与分配" hidden><div class="page-eyebrow">RESOURCE SNAPSHOT</div><h2>第 ${d.sol} 日 · 物资账本</h2><div class="archive-resources"><span>氧气<b>${Math.round(d.o2)}<small>%</small></b></span><span>食物<b>${Math.round(d.food)}<small>%</small></b></span><span>科学成果<b>${f1(d.sci)}</b></span><span>累计辐射<b>${f1(d.dose)}<small> mSv</small></b></span></div><div class="allocation-record"><span>当天的电力安排</span>${Object.entries(d.alloc).map(([k, v]) => `<p>${SLOTS.find(s => s.k === k).name}<b>${v} 格</b></p>`).join('')}</div><p class="page-note">饮水 ${f1(d.water ?? 0)} · 药品 ${d.meds ?? 0} · 士气 ${Math.round(d.morale ?? 0)}</p></section>`;
    }).join('') : `<section class="book-page archive-page" data-book="archive" data-sheet="archive-empty" data-label="事件档案" hidden><div class="page-eyebrow">MISSION ARCHIVE / 000</div><h2>故事，才刚开始。</h2><p class="entry-body">这里会按天保存发生过的事、你的决定，以及当天的资源和电力安排。<br><br>完成今天的工作后，再来翻翻吧。</p><div class="empty-archive-mark" aria-hidden="true">✦</div></section>`;
    archiveIndex = Math.min(archiveIndex, Math.max(0, $('#journalHistory').children.length - 1));
  }
  let rng = Math.random;
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hab = lv => .72 - .06 * lv;     // 舱内受到的银河宇宙射线比例
  const sepFac = lv => .8 - .13 * lv;   // 舱内受到的太阳风暴粒子比例

  function newGame() {
    bookType = 'today'; todaySheet = 'brief'; archiveIndex = 0;
    G = { water: 70, meds: 4, morale: 75, care: {}, cabinDeck: [], sol: 1, o2: 60, food: 50, dose: 0, sci: 0, batt: 4, shieldLv: 1, shieldProg: 0, panelEff: 1, queue: [3, 3, 3],
      alloc: { o2: 3, food: 2, shield: 1, sci: 2 }, want: { o2: 3, food: 2, shield: 1, sci: 2 }, eva: false,
      o2Rate: 2.5, o2Mul: 1, o2MulDays: 0, storm: 0, stormMul: .3, stormSave: false, battBonus: 0,
      evaLock: 0, conj: 0, conjRisk: 0, exercise: 0, health: 3, drain: 0, drainDays: 0, dirtyShown: false,
      hist: [], decisions: [], doseParts: { gcr: 0, sep: 0, eva: 0 }, powerUse: { o2: 0, food: 0, shield: 0, sci: 0 },
      flareSols: [], over: false,
      build: { rows: 2, domes: 1, labs: 0 }, evaCount: 0, sample: false, pods: 0, damaged: 0, blight: 0, blightFix: false, cull: 0, o2Fault: 0, o2FaultDays: 0 };
    schedule();
  }
  function schedule() {
    const ev = {};
    const free = s => s >= 2 && s <= 29 && !ev[s] && !ev[s - 1] && !ev[s + 1];
    // 沙尘暴（必有一场）
    const s0 = ri(11, 18); G.stormLen = ri(4, 5);
    ev[s0 - 1] = 'stormWarn'; ev[s0] = 'stormStart';
    const dd = s0 + G.stormLen + ri(1, 3); if (dd <= 29) ev[dd] = 'dustDevil';
    // 太阳风暴（2–3 次，取自 DONKI）
    const pool = shuffle(DATA.flares.slice());
    const lf = DATA.liveFlareEvent(); if (lf) pool.unshift(lf);
    G.flareQueue = pool;
    const nF = rng() < .4 ? 3 : 2;
    let tries = 0;
    while (G.flareSols.length < nF && tries++ < 200) { const s = ri(4, 28); if (free(s) && G.flareSols.every(x => Math.abs(x - s) >= 6)) { ev[s] = 'flare'; G.flareSols.push(s); } }
    // 两次建造机会（基地的样子由你决定）
    for (const [a, b] of [[6, 9], [19, 24]]) { tries = 0; while (tries++ < 200) { const s = ri(a, b); if (free(s)) { ev[s] = 'build'; break; } } }
    // 其他事件
    const others = shuffle(['o2fault', 'delta', 'conjunction', 'cold', 'blight', 'resupply', 'bones', 'letter', 'quake']).slice(0, 6);
    for (const id of others) { tries = 0; while (tries++ < 200) { const s = ri(2, 29); if (free(s)) { ev[s] = id; break; } } }
    G.events = ev;
  }

  /* ======================= 每日计算 ======================= */
  function computePool() {
    const T = G.today;
    G.gen = Math.max(0, Math.round((12 + 3 * (G.build.rows - 2) - 2 * G.damaged) * G.sunVar * G.panelEff * (G.storm > 0 ? G.stormMul : 1)));
    G.heat = 3 + T.heatAdj - (G.storm > 0 && G.stormSave ? 1 : 0);
    G.pool = G.gen - G.heat + G.batt - T.poolPenalty - (G.drainDays > 0 ? G.drain : 0);
  }
  const foodPer = () => FOOD_PER * (1 + .25 * (G.build.domes - 1));
  const sciPer = () => SCI_PER + .5 * G.build.labs;
  const used = () => G.alloc.o2 + G.alloc.food + G.alloc.shield + G.alloc.sci;
  const sciLocked = () => (G.today && G.today.sciLock) || (G.storm > 0 && G.stormSave);
  const evaBlocked = () => G.evaLock > 0 ? '日凌期间暂停出舱' : G.storm > 0 ? '沙尘暴中不能出舱' : (G.today && G.today.sciLock) ? '今天大家都在避难所里' : '';
  function clampAlloc() {
    // 玩家想要的分配（want）会被记住；电不够时临时削减，电回来了就自动恢复
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
    const o2 = o2Prod - O2_USE - (G.eva ? 3 : 0) - G.exercise - short * 3;
    const harvest = G.queue[0];
    const food = harvest - FOOD_USE;
    const gcr = F.radSurface * hab(G.shieldLv);
    const evaDose = G.eva ? .25 + T.flareOut : 0;
    const dose = gcr + evaDose + T.flareDose;
    const sci = (sciLocked() ? 0 : a.sci * sciPer()) + (G.eva ? 6 : 0);
    const left = Math.max(0, G.pool) - used();
    const batt = Math.min(BATT_MAX + G.battBonus, left);
    let lv = G.shieldLv, prog = G.shieldProg + a.shield; while (prog >= 5 && lv < 5) { lv++; prog -= 5; }
    return { o2, o2Prod, food, harvest, dose, gcr, evaDose, sci, batt, left, short, lv, prog, wasted: Math.max(0, left - batt) };
  }

  /* ======================= 界面：仪表 ======================= */
  function meterRow(k, label, tip) {
    return `<div class="m-row" data-k="${k}"><span class="m-l"><i class="dot ${k}"></i>${label}<button class="q" data-tip="${tip}">?</button></span>
      <div class="bar"><s></s><u></u></div><em class="v"></em><b class="d"></b></div>`;
  }
  function buildHUD() {
    $('#meters').innerHTML = `<div class="c-h">前哨站状态</div>
      ${meterRow('o2', '氧气', 'o2')}${meterRow('food', '食物', 'food')}${meterRow('batt', '电池', 'batt')}`;
    $('#careMeters').innerHTML = `${meterRow('water', '饮用水', 'water')}${meterRow('meds', '药品', 'meds')}${meterRow('morale', '乘组士气', 'morale')}`;
    $('#missionMeters').innerHTML = `${meterRow('sci', '科学成果', 'sci')}${meterRow('dose', '辐射剂量', 'dose')}
      <div class="m-shield"><span><i class="dot shield"></i>屏蔽等级<button class="q" data-tip="shield">?</button></span><span class="lv"></span><span class="prog"></span></div>`;
    $('#power').innerHTML = `
      <div class="p-h"><span class="p-title">今天的电，怎么用 <small>POWER ALLOCATION</small></span><span class="p-eq"></span></div>
      <div class="p-tokens"></div>
      <div class="p-slots">${SLOTS.map(s => `<div class="slot" data-k="${s.k}">
          <div class="s-top"><i class="dot ${s.k}"></i><span class="s-name">${s.name}</span><button class="q" data-tipx="${s.k}">?</button></div>
          <div class="s-ctl"><button class="mn" aria-label="减少">−</button><b class="s-n">0</b><button class="pl" aria-label="增加">+</button></div>
          <div class="s-eff"></div></div>`).join('')}</div>`;
    $('#planActions').innerHTML = `
      <div class="p-foot">
        <label class="eva"><input type="checkbox" id="evaChk"><span class="sw"></span><span><b>出舱考察</b><button class="q" data-tip="eva">?</button><small class="eva-sub">科学 +6 · 氧气 −3 · 辐射 +0.25</small></span></label>
        <span class="p-left"></span>
        <button class="btn go" id="bGo">确认安排，结束今天 <small>NEXT SOL</small><span>→</span></button>
      </div>`;
    SLOTS.forEach(s => {
      const el = $(`.slot[data-k="${s.k}"]`);
      el.querySelector('.pl').onclick = () => { if (busy) return; if (s.k === 'sci' && sciLocked()) return nudge(el, '今天科研暂停'); if (G.alloc[s.k] >= SLOT_MAX) return nudge(el, '这个系统一天最多用 8 格'); if (used() >= Math.max(0, G.pool)) return nudge(el, '今天的电已经分完了'); G.alloc[s.k]++; G.want[s.k] = G.alloc[s.k]; Sound.plus(); renderAll(); };
      el.querySelector('.mn').onclick = () => { if (busy || G.alloc[s.k] <= 0) return; G.alloc[s.k]--; G.want[s.k] = G.alloc[s.k]; Sound.minus(); renderAll(); };
      el.onmouseenter = () => !busy && World.focus(s.focus);
      el.querySelector('[data-tipx]').onclick = e => { e.stopPropagation(); showTip(e.target, `<b>${s.name}</b><br>${s.tip}`); };
    });
    $('#power').onmouseleave = () => !busy && World.focus('overview');
    $('#evaChk').onchange = e => { if (busy) { e.target.checked = G.eva; return; } const b = evaBlocked(); if (b) { e.target.checked = false; return nudge($('.eva'), b); } G.eva = e.target.checked; World.focus(G.eva ? 'eva' : 'overview'); Sound.click(); renderAll(); };
    $('#bGo').onclick = () => endSol();
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
    // 仪表
    setBar('water', G.water / 100, (G.water - WATER_USE) / 100, `${f1(G.water)}<small>/100</small>`, fmt(-WATER_USE), 'bad');
    setBar('meds', G.meds / 9, G.meds / 9, `${G.meds}<small>份</small>`, '备用', 'meh');
    const moraleLoss = 2 + (G.food < 20 || G.water < 20 ? 4 : 0);
    setBar('morale', G.morale / 100, (G.morale - moraleLoss) / 100, `${Math.round(G.morale)}<small>/100</small>`, fmt(-moraleLoss), 'meh');
    setBar('o2', G.o2 / 100, (G.o2 + p.o2) / 100, `${Math.round(G.o2)}<small>%</small>`, fmt(p.o2), p.o2 >= 0 ? 'good' : 'bad');
    setBar('food', G.food / 100, (G.food + p.food) / 100, `${Math.round(G.food)}<small>%</small>`, fmt(p.food), p.food >= 0 ? 'good' : 'bad');
    setBar('dose', G.dose / BUDGET, (G.dose + p.dose) / BUDGET, `${f1(G.dose)}<small>/${BUDGET}</small>`, fmt(p.dose), p.dose > 1 ? 'bad' : 'meh');
    setBar('sci', G.sci / GOAL, (G.sci + p.sci) / GOAL, `${Math.round(G.sci)}<small>/${GOAL}</small>`, fmt(p.sci), p.sci > 0 ? 'good' : 'meh');
    const cap = BATT_MAX + G.battBonus;
    setBar('batt', G.batt / cap, p.batt / cap, `${G.batt}<small>/${cap}</small>`, (p.batt - G.batt >= 0 ? '+' : '') + (p.batt - G.batt), p.batt >= G.batt ? 'good' : 'bad');
    $('.m-shield .lv').innerHTML = [1, 2, 3, 4, 5].map(i => `<i class="${i <= G.shieldLv ? 'on' : ''}${i === p.lv && p.lv > G.shieldLv ? ' next' : ''}"></i>`).join('');
    $('.m-shield .prog').textContent = G.shieldLv >= 5 ? '已满级' : `施工 ${G.shieldProg}/5`;
    // 电力
    const poolPos = Math.max(0, G.pool);
    $('.p-eq').innerHTML = `发电 <b>${G.gen}</b> − 夜间供暖 <b>${G.heat}</b><button class="q" data-tip="heat">?</button>${G.batt ? ` + 电池 <b>${G.batt}</b>` : ''}${G.today.poolPenalty ? ` − 抢修 <b>${G.today.poolPenalty}</b>` : ''}${G.drainDays > 0 ? ` − 通风 <b>${G.drain}</b>` : ''} = <b class="pool ${G.pool < 0 ? 'neg' : ''}">${G.pool}</b> 格`;
    let toks = '';
    const order = [];
    SLOTS.forEach(s => { for (let i = 0; i < G.alloc[s.k]; i++) order.push(s.k); });
    for (let i = 0; i < Math.max(poolPos, 1); i++) toks += i < order.length ? `<i class="tk ${order[i]}"></i>` : (poolPos ? `<i class="tk free"></i>` : '');
    if (G.pool < 0) toks = `<span class="short">电不够供暖！缺 ${-G.pool} 格 —— 生命保障会降级（氧气 −${-G.pool * 3}）</span>`;
    $('.p-tokens').innerHTML = toks;
    SLOTS.forEach(s => {
      const el = $(`.slot[data-k="${s.k}"]`), n = G.alloc[s.k];
      el.querySelector('.s-n').textContent = n;
      el.classList.toggle('locked', s.k === 'sci' && sciLocked());
      const eff = s.k === 'o2' ? `+${f1(p.o2Prod)} 氧气<small>需要 ${O2_USE + (G.eva ? 3 : 0) + G.exercise}</small>`
        : s.k === 'food' ? `+${f1(n * foodPer())} 食物<small>3 天后收获${G.build.domes > 1 ? ` · ${G.build.domes} 座温室` : ''}</small>`
        : s.k === 'shield' ? (G.shieldLv >= 5 ? '已满级<small>不再需要</small>' : `施工 ${G.shieldProg}+${n}/5<small>${p.lv > G.shieldLv ? '明天升级！' : '攒够 5 格升一级'}</small>`)
        : sciLocked() ? '暂停<small>今天无法科研</small>' : `+${f1(n * sciPer())} 科学<small>每格 ${f1(sciPer())}${G.build.labs ? ' · 实验舱加成' : ''}</small>`;
      el.querySelector('.s-eff').innerHTML = eff;
      el.classList.toggle('warn', s.k === 'o2' && p.o2Prod < O2_USE);
    });
    const left = p.left;
    $('.p-left').innerHTML = G.pool < 0 ? '' : left > 0 ? `剩 <b>${left}</b> 格 → ${p.wasted ? `电池满了，<b class="bad">浪费 ${p.wasted} 格</b>` : '存进电池'}` : '电全部分配完';
    const eb = evaBlocked(); $('#evaChk').checked = G.eva; $('.eva').classList.toggle('locked', !!eb);
    $('.eva-sub').textContent = eb || `科学 +6 · 氧气 −3 · 辐射 +${f1(.25 + G.today.flareOut)}`;
    // 环境
    const sun = Math.round(G.sunVar * (G.storm > 0 ? G.stormMul : 1) * 100);
    const tau = G.storm > 0 ? (G.stormSave ? 6.2 : 6.8) : (.4 + (1 - G.sunVar) * 3).toFixed(1);
    const nextFlare = G.flareSols.includes(G.sol + 1), nextStorm = G.events[G.sol + 1] === 'stormStart';
    $('#fore').innerHTML = `<div class="c-h">今日环境</div>
      <div class="f-row"><span>阳光</span><b>${sun}%</b></div>
      <div class="f-row"><span>大气尘埃 τ<button class="q" data-tip="tau">?</button></span><b class="${G.storm > 0 ? 'bad' : ''}">${tau}</b></div>
      <div class="f-row"><span>太阳能板清洁度</span><b class="${G.panelEff < .82 ? 'bad' : ''}">${Math.round(G.panelEff * 100)}%</b></div>
      <div class="f-row"><span>明天的太空天气</span><b class="${nextFlare ? 'bad' : 'good'}">${nextFlare ? '太阳很活跃' : '平静'}</b></div>
      <div class="f-row"><span>信号到地球</span><b>${G.conj > 0 ? '日凌·中断' : f1(LT.minutes) + ' 分钟'}</b></div>
      ${G.storm > 0 ? `<div class="f-alert">沙尘暴还剩 ${G.storm} 天</div>` : nextStorm ? `<div class="f-alert">沙尘暴明天到达</div>` : ''}`;
    $('#solN').textContent = String(G.sol).padStart(2, '0'); $('#solBar').style.width = (G.sol - 1) / SOLS * 100 + '%';
    $('#journalDay').textContent = String(G.sol).padStart(2, '0'); $('#dockSol').textContent = `SOL ${String(G.sol).padStart(2, '0')}`;
    syncWorld(); Habitat.render(G);
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

  /* ======================= 一天的流程 ======================= */
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
  }
  function endSol() {
    if ($('#notebook').hidden || bookType !== 'today' || todaySheet !== 'plan') return;
    if (busy || encounterOpen || G.over || utilityOpen()) return;
    busy = true; lockPlanning(true); showJournal(false); Habitat.closeCard();
    let id = G.events[G.sol];
    if (!id && !G.dirtyShown && G.panelEff < .82 && G.storm === 0) { id = 'dirty'; G.dirtyShown = true; }
    renderAll();
    if (id) openEvent(id, settleSol);
    else presentEncounter(nextCabinEvent(), settleSol, true);
  }
  function settleSol() {
    busy = true; lockPlanning(true); showJournal(false); Sound.click();
    const p = preview(), a = G.alloc, T = G.today;
    const notes = G.today.notes.slice();
    const moraleLoss = 2 + (G.food < 20 || G.water < 20 ? 4 : 0);
    G.water = clamp(G.water - WATER_USE, 0, 100); G.morale = clamp(G.morale - moraleLoss, 0, 100);
    notes.push(`饮水消耗 ${WATER_USE}，剩余 ${f1(G.water)}。士气 ${fmt(-moraleLoss)}，当前 ${Math.round(G.morale)}。`);
    // 资源结算
    G.o2 = clamp(G.o2 + p.o2, 0, 100);
    G.food = clamp(G.food + p.food, 0, 100);
    G.queue = [G.queue[1], G.queue[2], a.food * foodPer()];
    const lvBefore = G.shieldLv; G.shieldLv = p.lv; G.shieldProg = G.shieldLv >= 5 ? 0 : p.prog;
    G.dose += p.dose; G.doseParts.gcr += p.gcr; G.doseParts.eva += p.evaDose - (G.eva ? T.flareOut : 0); G.doseParts.sep += T.flareDose + (G.eva ? T.flareOut : 0);
    const sciBefore = G.sci, tanksBefore = tanks();
    G.sci += p.sci;
    G.batt = Math.max(0, p.batt);
    if (G.eva) { G.evaCount++; notes.push(`出舱考察完成，三角洲上又插了一面考察旗（第 ${G.evaCount} 面）。`); }
    for (const k in a) G.powerUse[k] += a[k];
    const SCI_PARTS = [[15, '地震仪'], [35, '岩芯钻机'], [55, '天文望远镜'], [80, '样本存放架'], [100, '科学目标达成旗']];
    for (const [th, name] of SCI_PARTS) if (sciBefore < th && G.sci >= th) notes.push(`科学成果达到 ${th}：科学站新添了一台<b>${name}</b>！`);
    if (tanks() > tanksBefore) notes.push('持续给制氧分电，制氧站旁边又立起了一个<b>储氧罐</b>。');    // 日凌期间出舱的风险
    if (G.eva && G.conjRisk > 0 && rng() < .34) { G.o2 = Math.max(0, G.o2 - 6); notes.push('出舱时宇航服的阀门出了点小问题，地球又联系不上——你们自己修好了它，但漏掉了一些氧气（−6）。'); }
    // 因果说明
    if (p.short) notes.push(`电不够供暖，生命保障降级运行：氧气额外 −${p.short * 3}。`);
    if (p.o2 < 0) notes.push(`氧气 ${fmt(p.o2)}：制氧只产出 ${f1(p.o2Prod)}，而乘组用掉了 ${O2_USE + (G.eva ? 3 : 0) + G.exercise}。`);
    else notes.push(`氧气 ${fmt(p.o2)}：制氧产出 ${f1(p.o2Prod)}，够用。`);
    notes.push(p.harvest > .05 ? `温室收获 ${f1(p.harvest)} 份食物，吃掉 ${FOOD_USE}。` : `温室这天没有收获（3 天前没给温室分电），食物 −${FOOD_USE}。`);
    if (G.shieldLv > lvBefore) notes.push(`屏蔽升到 ${G.shieldLv} 级！从今以后，每天的辐射都会少一点。`);
    if (T.flareDose + (G.eva ? T.flareOut : 0) > 0) notes.push(`太阳风暴让你们多受了 ${f1(T.flareDose + (G.eva ? T.flareOut : 0))} 毫希辐射。`);
    if (p.wasted) notes.push(`电池满了，${p.wasted} 格电被浪费掉。`);
    // 持续效果
    G.panelEff = Math.max(.5, G.panelEff - .012 - (G.storm > 0 ? .02 : 0));
    if (G.o2MulDays > 0 && --G.o2MulDays === 0) G.o2Mul = 1;
    if (G.evaLock > 0) G.evaLock--; if (G.conjRisk > 0) G.conjRisk--; if (G.conj > 0) G.conj--;
    if (G.drainDays > 0) G.drainDays--;
    if (G.o2Fault === 2) G.o2Fault = 0;
    if (G.o2FaultDays > 0 && --G.o2FaultDays === 0) G.o2Fault = 0;
    if (G.blight > 0) G.blight = Math.max(0, G.blight - (G.blightFix ? .45 : .2));
    let stormEnded = false;
    if (G.storm > 0 && --G.storm === 0) { stormEnded = true; G.stormSave = false; G.battBonus = 0; G.batt = Math.min(G.batt, BATT_MAX); }
    if (stormEnded) notes.unshift('沙尘暴过去了，阳光回来了！');
    G.hist.push({ water: G.water, meds: G.meds, morale: G.morale, sol: G.sol, o2: G.o2, food: G.food, dose: G.dose, sci: G.sci, batt: G.batt, gen: G.gen, ev: T.eventId, alloc: { ...a }, eva: G.eva, notes: notes.slice() });
    // 浮动数字
    floater('o2', fmt(p.o2) + ' 氧气', p.o2 >= 0 ? 'good' : 'bad');
    floater('food', fmt(p.food) + ' 食物', p.food >= 0 ? 'good' : 'bad', 250);
    if (p.sci > 0) floater(G.eva ? 'astro' : 'sci', fmt(p.sci) + ' 科学', 'sci', 500);
    floater('shield', '+' + f1(p.dose) + ' 辐射', 'dose', 750);
    if (p.sci > 0) World.signal(2.5);
    // 夜晚
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
    Habitat.toast(`第 ${completed} 天已归档 · 新的火星日开始了。`);
  }

  /* ======================= 生活舱交互 ======================= */
  function setSceneView(mode) {
    if (encounterOpen || (!G.over && $('#frame').classList.contains('nightfall'))) return;
    sceneView = mode; showJournal(false); Habitat.view(mode);
    if (mode === 'exterior') World.focus('overview');
    const scroll = $('#habitatScene .room-scroll');
    if (mode === 'interior' && innerWidth < 700 && !scroll.dataset.positioned) {
      scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) * .48; scroll.dataset.positioned = 'true';
    }
  }
  function renderTodayRecords() {
    const notes = G.today.notes;
    $('#journalChoices').innerHTML = `<div class="page-eyebrow">LIFE IN THE HABITAT</div><h2>今天的小小决定。</h2><p class="page-subtitle">已记录 ${notes.length} 件事。完整记录会随当天一起归档。</p><ul class="summary-notes">${notes.slice(-3).map(n => `<li>${n}</li>`).join('')}</ul>`;
  }
  function careForCrew(key, allowed, change, note, item, target) {
    if (busy || encounterOpen || G.over || utilityOpen() || G.care[key] || !allowed()) return;
    change(); G.care[key] = true; G.today.notes.push(note);
    computePool(); renderAll(); renderTodayRecords(); renderArchive();
    Habitat.toast(note); inspectCabinItem(item, target);
  }
  function inspectCabinItem(item, target) {
    if (!G.today || G.over || busy || encounterOpen || utilityOpen()) return;
    showJournal(false); Sound.click();
    const card = data => Habitat.card({ ...data, anchor: target });
    const action = (key, label, hint, allowed, change, note) => ({ label: G.care[key] ? '今天已经完成' : label, hint, disabled: !!G.care[key] || !allowed(), run: () => careForCrew(key, allowed, change, note, item, target) });
    const bookAction = (page, label) => ({ label, hint: '翻开今日手册', run: () => showJournal(true, page) });
    if (item === 'food') return card({ icon: '🍞', title: '食物补给箱', value: `${f1(G.food)}<small>点</small>`, description: `乘组每天消耗 ${FOOD_USE} 点食物，温室收成会自动补进箱子。也可以用一份小小的加餐，换一点好心情。`, actions: [
      action('snack', '给大家加一餐', '食物 −3 · 士气 +6 · 每日一次', () => G.food >= 3 && G.morale < 100, () => { G.food -= 3; G.morale = clamp(G.morale + 6, 0, 100); }, '大家分享了一份加餐。食物 −3，士气 +6。'), bookAction('supplies', '清点生存物资')
    ] });
    if (item === 'water') return card({ icon: '💧', title: '饮用水桶', value: `${f1(G.water)}<small>点</small>`, description: `乘组每天要用 ${WATER_USE} 点水。水不够时，可以点击旁边的循环净水机，用电池换取更多饮用水。`, actions: [
      action('drink', '倒杯水，歇一会儿', '饮水 −2 · 士气 +4 · 每日一次', () => G.water >= 2 && G.morale < 100, () => { G.water -= 2; G.morale = clamp(G.morale + 4, 0, 100); }, '喝过水，大家精神了一点。饮水 −2，士气 +4。'), bookAction('care', '查看饮水和照护物资')
    ] });
    if (item === 'purifier') return card({ icon: '🚰', title: '循环净水机', value: `${G.batt}<small>格电池</small>`, description: '它把回收水重新净化，变成可用的饮用水。每次消耗 2 格电池，最多补充 12 点水。电池减少也会影响今天能分配的电。', actions: [
      action('filter', '启动一轮净水', '电池 −2 · 饮水最多 +12 · 每日一次', () => G.batt >= 2 && G.water < 100, () => { G.batt -= 2; G.water = clamp(G.water + 12, 0, 100); }, '循环净水机完成工作。电池 −2，饮水最多 +12。'), bookAction('plan', '查看今天的电力')
    ] });
    if (item === 'medicine') return card({ icon: '💊', title: '急救药品', value: `${G.meds}<small>份</small>`, description: `乘组健康 ${G.health} / 4。适当使用药品可以恢复健康与士气。药品有限，每天最多使用一份。`, actions: [
      action('medicine', '使用一份药品', '药品 −1 · 健康 +1 · 士气 +8', () => G.meds > 0 && (G.health < 4 || G.morale < 100), () => { G.meds--; G.health = clamp(G.health + 1, 0, 4); G.morale = clamp(G.morale + 8, 0, 100); }, '给乘组做了一次照护。药品 −1，健康 +1，士气 +8。'), bookAction('care', '查看乘组照护记录')
    ] });
    if (item === 'crew') return card({ icon: G.morale >= 60 ? '😊' : G.morale >= 30 ? '😟' : '😴', title: '宇航员 · 阿星', value: `${Math.round(G.morale)}<small>士气</small>`, description: G.morale < 30 || G.water < 10 || G.food < 10 ? '阿星看起来很虚弱。看看食物和水够不够，也给大家一点休息和照顾吧。' : G.morale < 60 ? '今天有一点想家。说说话，分享一餐，生活就会好一点。' : '阿星心情不错，正期待着今天的新发现。在遥远的火星，也别忘了和彼此聊聊天。', actions: [
      action('chat', '陪大家聊一会儿', '士气 +4 · 每日一次', () => G.morale < 100, () => { G.morale = clamp(G.morale + 4, 0, 100); }, '大家聊起了地球上的小事。士气 +4。'), bookAction('care', '查看乘组状态')
    ] });
    if (item === 'calendar') return card({ icon: '📅', title: '墙上的任务日历', value: `${G.sol}<small>/30 日</small>`, description: `已经平安度过 ${G.hist.length} 个火星日。今天的目标是照顾好乘组，再为科研留一点电。每天的决定都会写入事件档案。`, actions: [bookAction('brief', '翻开今天的手册'), { label: '回看走过的日子', hint: '打开事件档案', run: () => { Habitat.closeCard(); bookType = 'archive'; showJournal(true); } }] });
    if (item === 'radio') return card({ icon: '📡', title: '地球通讯器', value: G.conj > 0 ? '<small>信号中断</small>' : '<small>信号在线</small>', description: G.conj > 0 ? '日凌挡住了地球的信号。现在可以整理日志，等通信恢复后再收听消息。' : '或许是来自地球的晚安，或许是轨道站的一条新消息。每天可以额外收听一次，作出属于今天的小决定。', actions: [
      { label: G.care.signal ? '今天的消息已经听过' : '收听一条新消息', hint: '触发一个双选事件 · 每日一次', disabled: !!G.care.signal || G.conj > 0, run: () => {
        if (busy || encounterOpen || G.care.signal || G.conj > 0) return;
        G.care.signal = true; busy = true; lockPlanning(true); presentEncounter(nextCabinEvent(), () => { busy = false; lockPlanning(false); renderAll(); renderTodayRecords(); renderArchive(); updateShelf(); Habitat.toast('消息和你的决定，已经写入今天的记录。'); $('#todayBook').focus({ preventScroll: true }); }, false);
      } }, { label: '查看事件档案', hint: '回看消息与过去的决定', run: () => { Habitat.closeCard(); bookType = 'archive'; showJournal(true); } }
    ] });
  }
  function nextCabinEvent() {
    const events = [
      { id: 'cabin-garden', kicker: '生活舱的新发现', icon: '🌱', title: '窗边，冒出了一片新叶。', body: '阿星发现，种在回收盒里的小番茄发芽了。它需要一点额外的水，也值得被认真记录。', choices: [
        { t: '给小番茄浇一点水', d: [chip('pwr', '饮水 −3'), chip('sci', '士气 +9')], disabled: G.water < 3 ? '饮水不足' : '', fn: () => { G.water -= 3; G.morale = clamp(G.morale + 9, 0, 100); return '新叶子在窗边舒展开来。大家围着它看了很久。饮水 −3，士气 +9。'; } },
        { t: '先拍照，记录生长数据', d: [chip('sci', '科学 +4')], fn: () => { G.sci += 4; return '这片小小的绿，也成了珍贵的火星生长数据。科学 +4。'; } }
      ] },
      { id: 'cabin-goodnight', kicker: '来自地球的讯息', icon: '💌', title: '一声晚安，飞了很远。', body: '通讯器里传来了家人的留言：“今天的月亮很亮，你们还好吗？”要不要一起听完这段熟悉的声音？', choices: [
        { t: '坐下来，一起听完', d: [chip('sci', '士气 +8')], fn: () => { G.morale = clamp(G.morale + 8, 0, 100); return '大家安静地听着，生活舱好像离家近了一点。士气 +8。'; } },
        { t: '录一段基地观测回信', d: [chip('sci', '科学 +3'), chip('pwr', '士气 +2')], fn: () => { G.sci += 3; G.morale = clamp(G.morale + 2, 0, 100); return '你把今天的观察和一声晚安，一起寄给了地球。科学 +3，士气 +2。'; } }
      ] },
      { id: 'cabin-pipe', kicker: '设备的小脾气', icon: '🔧', title: '水管里，咕噜了一声。', body: '循环水管里积了一小团气泡。现在处理能顺便回收一批水，也可以先用备用管路维持运行。', choices: [
        { t: '通电检修，回收积水', d: [chip('pwr', '电池 −2'), chip('sci', '饮水最多 +12')], disabled: G.batt < 2 ? '电池不足' : '', fn: () => { G.batt -= 2; G.water = clamp(G.water + 12, 0, 100); return '管路畅通了，又收回了一批干净的水。电池 −2，饮水最多 +12。'; } },
        { t: '切到备用管路', d: [chip('pwr', '饮水 −4')], fn: () => { G.water = Math.max(0, G.water - 4); return '管路继续运转，切换时损失了一点水。饮水 −4。'; } }
      ] },
      { id: 'cabin-package', kicker: '整理储物柜', icon: '📦', title: '储物柜后面，还有一包。', body: '整理货架时，你发现一份备用物资的兑换标签。轨道站允许你从两种补给中选一种，随下一批货一起送到基地。', choices: [
        { t: '选择急救药品', d: [chip('sci', '药品最多 +1')], fn: () => { G.meds = Math.min(9, G.meds + 1); return '备用药品收进了急救箱。药品最多 +1。'; } },
        { t: '选择备用食物', d: [chip('food', '食物最多 +8')], fn: () => { G.food = clamp(G.food + 8, 0, 100); return '食物箱又充实了一些。食物最多 +8。'; } }
      ] },
      { id: 'cabin-cold', kicker: '乘组照护', icon: '🩹', title: '阿星今天有一点没精神。', body: '忙碌了一天，阿星有点疲惫。给乘组做一次照护，或是暂时停下科研，让大家早点休息。', choices: [
        { t: '用一份药品照护', d: [chip('pwr', '药品 −1'), chip('sci', '健康 +1 · 士气 +6')], disabled: G.meds < 1 ? '没有备用药品' : '', fn: () => { G.meds--; G.health = Math.min(4, G.health + 1); G.morale = clamp(G.morale + 6, 0, 100); return '做过照护，阿星的精神恢复了一点。药品 −1，健康 +1，士气 +6。'; } },
        { t: '收起工作，早点休息', d: [chip('sci', '科学 −3 · 士气 +4')], fn: () => { G.sci = Math.max(0, G.sci - 3); G.morale = clamp(G.morale + 4, 0, 100); return '今天少做一点工作，换一个安稳的晚上。科学 −3，士气 +4。'; } }
      ] },
      { id: 'cabin-soup', kicker: '生活里的小仪式', icon: '🍲', title: '好想喝一碗热汤。', body: '不知道是谁先提起了番茄汤，大家都笑了。今天要不要拿出一点储备，为这顿晚饭加一点家的味道？', choices: [
        { t: '一起做一锅热汤', d: [chip('food', '食物 −3 · 饮水 −2'), chip('sci', '士气 +12')], disabled: G.food < 3 || G.water < 2 ? '食物或饮水不足' : '', fn: () => { G.food -= 3; G.water -= 2; G.morale = clamp(G.morale + 12, 0, 100); return '没有人嫌弃这碗汤里的脱水蔬菜。食物 −3，饮水 −2，士气 +12。'; } },
        { t: '留住储备，整理科研数据', d: [chip('sci', '科学 +4')], fn: () => { G.sci += 4; return '热汤留到下次。今晚先把积下的数据整理好。科学 +4。'; } }
      ] },
      { id: 'cabin-photo', kicker: '窗外的惊喜', icon: '📷', title: '今天的火星，像一颗桃子。', body: '夕阳把窗外的荒原染成了粉橘色。阿星举着相机，想把这一刻留下来。', choices: [
        { t: '为乘组合拍一张照片', d: [chip('sci', '士气 +8')], fn: () => { G.morale = clamp(G.morale + 8, 0, 100); return '四个人挤进镜头，身后是整片火星的晚霞。士气 +8。'; } },
        { t: '拍摄大气与地貌', d: [chip('sci', '科学 +4')], fn: () => { G.sci += 4; return '这张照片也许会帮助理解火星傍晚的大气。科学 +4。'; } }
      ] }
    ];
    if (!G.cabinDeck.length) G.cabinDeck = shuffle(events.map((_,i) => i));
    return events[G.cabinDeck.shift()];
  }
  function presentEncounter(e, resolved, daily) {
    encounterOpen = true; journalPhase = 'event'; Habitat.closeCard(); showJournal(false);
    if (daily) G.today.eventId = e.id || 'cabin';
    let options = ['build','resupply'].includes(e.id) ? shuffle(e.choices.slice()).slice(0,2) : e.choices.slice(0,2);
    const defer = { t: '保留资源，先照顾基地', d: [chip('none', '不消耗额外物资')], fn: () => '你保留了手边的资源，按原计划继续今天的生活。' };
    while (options.length < 2) options.push(defer);
    if (options.every(c => c.disabled)) options[1] = e.choices.find(c => !c.disabled) || defer;
    const icons = { flare: '☀️', stormWarn: '🌪️', stormStart: '🌪️', dustDevil: '🌬️', o2fault: '🔧', delta: '🪨', conjunction: '📡', cold: '❄️', blight: '🌱', resupply: '📦', bones: '🩹', letter: '💌', build: '🏗️', quake: '🔧', dirty: '🧹' };
    const panel = $('#dailyEventModal .daily-event-card');
    panel.innerHTML = `<div class="daily-event-kicker"><span>${daily ? 'END OF DAY' : 'INCOMING MESSAGE'}</span><span>SOL ${String(G.sol).padStart(2,'0')}</span></div><div class="event-illustration" aria-hidden="true">${e.icon || icons[e.id] || '📡'}</div><h2 id="dailyEventTitle">${e.title}</h2><div id="dailyEventBody" class="event-description">${e.body}</div><div class="event-option-list">${options.map((c,i) => `<button class="event-option" data-option="${i}" ${c.disabled ? 'disabled' : ''}><b>${c.t}</b><span>${c.d.join('')}${c.disabled ? `<span class="chip none">${c.disabled}</span>` : ''}</span></button>`).join('')}</div>${e.real ? `<details class="event-science"><summary>${e.real.label}${e.real.date ? ' · '+e.real.date : ''} ↗</summary><p>${e.real.text}</p><small>${e.real.src}${e.real.est ? ' · 剂量为游戏估算' : ''}</small></details>` : ''}<p class="daily-event-foot">${daily ? '选择会影响今天的结算。电力不足时，会自动调整分配。' : '这条消息只收听一次，你的决定会写入今天的记录。'}</p>`;
    $('#dailyEventModal').hidden = false; $('#hud').inert = true; $('#habitatScene').inert = true;
    computePool(); renderAll(); Sound.alert();
    panel.querySelector('.event-option:not(:disabled)').focus({ preventScroll: true });
    let answered = false;
    panel.querySelectorAll('[data-option]').forEach(button => button.onclick = () => {
      if (answered) return; answered = true;
      const c = options[Number(button.dataset.option)], result = c.fn();
      G.decisions.push({ sol: G.sol, title: e.title, choice: c.t });
      G.today.notes.push(`${e.title}：${c.t}。${result}`);
      G.water = clamp(G.water, 0, 100); G.morale = clamp(G.morale, 0, 100);
      $('#dailyEventModal').hidden = true; $('#hud').inert = false; $('#habitatScene').inert = false; encounterOpen = false; journalPhase = 'planning';
      computePool(); renderAll(); renderTodayRecords(); renderArchive(); Sound.click(); resolved();
    });
  }

  /* ======================= 事件 ======================= */
  const chip = (k, t) => `<span class="chip ${k}">${t}</span>`;
  const EVENTS = {
    flare() {
      const f = G.flareQueue.shift() || DATA.flares[0];
      const fac = sepFac(G.shieldLv), sep = f.dose, lt = Math.round(LT.minutes);
      World.flare(); World.focus('sky'); Sound.alert();
      const T = G.today;
      return { kicker: '太空天气警报', title: `太阳爆发：${f.cls}`, art: 'flare',
        body: `太阳刚刚发生了一次<b>${f.kind}</b>。高能粒子正以极快的速度飞向火星，<b>几十分钟</b>后就会到达。<br>你的屏蔽是 <b>${G.shieldLv} 级</b>，舱壁能挡住这类粒子的 <b>${Math.round((1 - fac) * 100)}%</b>。`,
        real: { label: f.live ? '实时数据 · NASA DONKI' : '真实事件 · NASA DONKI 存档', date: f.date, text: f.note, src: f.src, est: f.doseKind !== 'measured' },
        choices: [
          { t: '全员躲进风暴避难所', d: [chip('dose', `辐射 +${f1(sep * fac * .2)}`), chip('sci', '今天科研暂停'), chip('food', '温室没人照看 −3')],
            fn: () => { T.flareDose = sep * fac * .2; T.sciLock = true; T.shelter = true; G.food = Math.max(0, G.food - 3);
              return '避难所的四面墙里装满了水——水是非常好的辐射屏蔽材料。大家挤在一起待了几个小时。今天的科研停了，但大部分粒子都被挡在了外面。'; } },
          { t: '照常工作', d: [chip('dose', `辐射 +${f1(sep * fac)}`), chip('sci', '科研照常'), chip('dose', `今天出舱再 +${f1(sep * .5)}`)],
            fn: () => { T.flareDose = sep * fac; T.flareOut = sep * .5;
              return `你决定不打断工作。舱壁挡住了一部分粒子，可还是有 ${f1(sep * fac)} 毫希穿了进来。<b>提醒：今天如果出舱，宇航服几乎挡不住这些粒子。</b>`; } },
          { t: '呼叫地球，等待指示', d: [chip('time', `往返约 ${lt * 2} 分钟`), chip('dose', `辐射 +${f1(sep * fac * .7)}`), chip('sci', '今天科研暂停')], disabled: G.conj > 0 ? '日凌中，联系不上地球' : '',
            fn: () => { T.flareDose = sep * fac * .7; T.sciLock = true;
              return `地球看到这次爆发时，它的光也几乎在同一时刻照到了火星——地球转发过来的警报，不可能比光直接飞到火星更快。等地球的回复在 ${lt * 2} 分钟后到达，粒子早就来了。<b>在火星上，最快的预警只能来自你自己的探测器和判断。</b>`; } }
        ] };
    },
    stormWarn() {
      World.focus('solar'); Sound.alert();
      return { kicker: '气象预报', title: '一场沙尘暴正在靠近', art: 'storm',
        body: `绕着火星飞行的气象卫星（火星勘测轨道器 MRO）拍到一场巨大的沙尘暴，<b>明天</b>就会到达。沙尘会把阳光挡住，太阳能板只能发出平时三成左右的电，可能持续 ${G.stormLen} 天。`,
        real: { label: '真实记录', date: '2018-06', text: `2018 年的全球沙尘暴让天空暗得像黄昏，尘埃厚度 τ 超过 10。靠太阳能的机遇号在 6 月 10 日失去联系。它原计划工作 ${F.opportunityPlanned} 个火星日，最后工作了 ${F.opportunityActual} 个。`, src: 'NASA/JPL 机遇号任务' },
        choices: [
          { t: '把漫游车的电池接进基地', d: [chip('pwr', `风暴期间电池上限 +4`), chip('sci', '漫游车停驶：科学 −4')],
            fn: () => { G.battBonus = 4; G.sci = Math.max(0, G.sci - 4); return '漫游车开回车库，它的大电池现在也能为基地储电了。风暴期间，你最多能存 12 格电。'; } },
          { t: '出舱把太阳能板擦干净', d: [chip('pwr', '清洁度 → 100%'), chip('dose', '辐射 +0.2'), chip('o2', '氧气 −3')],
            fn: () => { G.panelEff = 1; G.dose += .2; G.doseParts.eva += .2; G.o2 = Math.max(0, G.o2 - 3); World.fx('clean'); return '干净的板子在微弱的阳光里也能多发一点电。'; } },
          { t: '不做准备', d: [chip('none', '现在什么也不花')], fn: () => '希望电池里的电够用……' }
        ] };
    },
    stormStart() {
      G.storm = G.stormLen; G.panelEff = Math.max(.5, G.panelEff - .08); World.setStorm(1); Sound.storm(1); World.focus('solar');
      return { kicker: '沙尘暴', title: '天黑了，在白天', art: 'storm',
        body: `沙尘暴到了。接下来 ${G.stormLen} 天，阳光只剩平时的三成左右，发电量会大大减少。可是乘组每天要用的氧气一点也不会少。`,
        real: { label: '真实知识', date: '', text: '火星沙尘暴可以大到覆盖整颗星球，持续好几周。也正因为这个原因，NASA 后来的好奇号和毅力号都改用核电池，不再依赖阳光。', src: 'NASA 火星探索计划' },
        choices: [
          { t: '进入节能模式', d: [chip('pwr', '每晚供暖少 1 格'), chip('sci', '风暴期间科研暂停')],
            fn: () => { G.stormSave = true; return '你关掉了两个不用的舱段，大家搬到一起住。每晚少用 1 格电，但科研设备也全都停了。'; } },
          { t: '趁机研究这场沙尘暴', d: [chip('sci', '科学 +8'), chip('pwr', '一切照常耗电')],
            fn: () => { G.sci += 8; return '从地面上近距离观测一场沙尘暴，这是轨道卫星做不到的！不过，你的电得撑过这几天。'; } }
        ] };
    },
    dustDevil() {
      World.focus('solar'); Sound.good(); G.today.devil = true;
      return { kicker: '好消息', title: '一股尘卷风扫过了太阳能板', art: 'devil',
        body: `一股旋转的小旋风从基地旁边经过，把太阳能板上的灰尘吹走了不少。清洁度从 <b>${Math.round(G.panelEff * 100)}%</b> 回升了！`,
        real: { label: '真实记录', date: '2005 起', text: '勇气号和机遇号都多次遇到这样的“清洁事件”，发电量明显回升。这是它们远远超期服役的重要原因之一。', src: 'NASA/JPL 火星探测漫游车任务' },
        choices: [
          { t: '出舱再仔细擦一遍', d: [chip('pwr', '清洁度 → 105%'), chip('dose', '辐射 +0.2'), chip('o2', '氧气 −3')].concat(G.damaged ? [chip('pwr', '顺便修好损坏的板子')] : []),
            fn: () => { G.panelEff = 1.05; G.damaged = 0; G.dose += .2; G.doseParts.eva += .2; G.o2 = Math.max(0, G.o2 - 3); World.fx('clean'); return '板子比新装的时候还亮！'; } },
          { t: '让风做完它的工作', d: [chip('pwr', '清洁度 → 95%')],
            fn: () => { G.panelEff = Math.max(G.panelEff, .95); return '谢谢你，火星的风。'; } }
        ] };
    },
    o2fault() {
      World.focus('o2'); Sound.alert();
      const hours = (F.moxieTotal / (F.o2PerPerson * 1000) * 24).toFixed(1);
      return { kicker: '设备故障', title: '制氧机过热了', art: 'o2',
        body: '制氧机要把二氧化碳加热到大约 800°C，才能把里面的氧“拆”出来。今天，它的温度传感器报警了。',
        real: { label: '真实测量', date: '2021–2023', text: `毅力号的 MOXIE 是第一台在另一颗星球上制造氧气的机器。它运行了 16 次，一共造出 ${F.moxieTotal} 克氧气。一个人一天大约需要 ${F.o2PerPerson} 千克氧气——MOXIE 三年的全部产量，只够一个人呼吸约 ${hours} 小时。`, src: 'NASA 毅力号 MOXIE 实验' },
        choices: [
          { t: '立刻抢修', d: [chip('pwr', '今天可用电 −3')], fn: () => { G.today.poolPenalty += 3; G.o2Fault = 2; World.fx('repair'); return '火花四溅——修好了！不过今天少了 3 格电可以分配。'; } },
          { t: '降温运行 3 天', d: [chip('o2', '制氧效率只有 60%（3 天）')], fn: () => { G.o2Mul = .6; G.o2MulDays = 3; G.o2Fault = 1; G.o2FaultDays = 3; return '制氧机冒着黑烟慢慢转着。接下来 3 天，每格电只能造出平时 60% 的氧气。'; } },
          { t: '请地球远程诊断', d: [chip('sci', '用掉科研时间：科学 −6'), chip('time', `往返 ${Math.round(LT.minutes * 2)} 分钟`)], disabled: G.sci < 6 || G.conj > 0 ? (G.conj > 0 ? '日凌中，联系不上地球' : '科学成果不够 6 分') : '',
            fn: () => { G.sci -= 6; World.fx('repair'); World.signal(4); return `地球的工程师花了几个小时，来回发了好几轮消息（每一轮都要等 ${Math.round(LT.minutes * 2)} 分钟），终于找到了问题。`; } }
        ] };
    },
    delta() {
      World.focus('sci'); Sound.beep();
      const storm = G.storm > 0;
      return { kicker: '科学发现', title: '三角洲边上，一块奇怪的岩石', art: 'rock',
        body: '漫游车在一片古老的河流三角洲边缘，拍到一块带着“豹纹斑点”的岩石。在地球上，这样的斑点有时和微生物有关。',
        real: { label: '真实发现', date: '2024-07', text: '毅力号在杰泽罗陨石坑发现了“夏耶瓦瀑布”岩石。2025 年 9 月，NASA 宣布它的样本含有“潜在生物特征”——可能是远古生命留下的痕迹，仍需要把样本带回地球才能确认。', src: 'NASA 毅力号任务' },
        choices: [
          { t: '亲自出舱采样', d: [chip('sci', '科学 +18'), chip('dose', '辐射 +0.6'), chip('o2', '氧气 −5')], disabled: storm ? '沙尘暴中不能出舱' : G.evaLock > 0 ? '日凌期间暂停出舱' : '',
            fn: () => { G.sci += 18; G.dose += .6; G.doseParts.eva += .6; G.o2 = Math.max(0, G.o2 - 5); G.sample = true; G.today.evaShow = true; return '你亲手把样本装进了密封管。这可能是人类历史上最重要的一块石头。'; } },
          { t: '派漫游车去拍高清照片', d: [chip('sci', '科学 +7'), chip('pwr', '今天可用电 −2')],
            fn: () => { G.sci += 7; G.today.poolPenalty += 2; World.fx('sample'); return '漫游车拍回了清晰的照片。科学家们很兴奋，但他们更想要真正的样本。'; } },
          { t: '记下位置，以后再说', d: [chip('none', '不花任何东西')], fn: () => '你在地图上做了标记。不过，这个任务里恐怕没有“以后”了。' }
        ] };
    },
    conjunction() {
      World.focus('antenna'); Sound.alert(); G.conj = 4;
      return { kicker: '通信中断', title: '日凌：太阳挡在了地球和火星中间', art: 'conj',
        body: '接下来 4 个火星日，太阳会挡住地球和火星之间的无线电信号。没有人能从地球帮助你们。',
        real: { label: '真实知识', date: '', text: '大约每 26 个月，地球和火星会分别转到太阳的两侧。这段时间里，NASA 会暂停给所有火星探测器发送新指令，大约持续两周。', src: 'NASA 火星探索计划' },
        choices: [
          { t: '暂停出舱，等日凌过去', d: [chip('sci', '4 天不能出舱')], fn: () => { G.evaLock = 4; return '安全第一。大家在舱里整理数据、保养设备。'; } },
          { t: '照常出舱', d: [chip('o2', '每次出舱有 1/3 机会出意外：氧气 −6')], fn: () => { G.conjRisk = 4; return '如果出了状况，就只能靠你们自己了。'; } }
        ] };
    },
    cold() {
      World.focus('hub'); Sound.alert();
      return { kicker: '气象预报', title: '今晚是这个季节最冷的一夜', art: 'cold',
        body: '气象站预报今晚会降到 −95°C 左右。加热器需要比平时多用 2 格电。',
        real: { label: '真实测量', date: '', text: `毅力号的气象站 MEDA 在杰泽罗陨石坑测到，夜晚气温常常降到 ${F.nightTemp}°C 左右。火星大气不到地球的 1%，几乎留不住白天的热量。`, src: 'NASA 毅力号 MEDA 气象站' },
        choices: [
          { t: '加热器全开', d: [chip('pwr', '今天可用电 −2')], fn: () => { G.today.heatAdj += 2; return '基地暖暖和和地度过了这一夜。'; } },
          { t: '关掉温室的灯一晚', d: [chip('food', '正在生长的作物减半')], fn: () => { G.queue = G.queue.map(x => x * .5); World.setFrost(1); World.focus('food'); return '温室里的作物结了一层霜，冻伤了一半。'; } },
          { t: '大家挤到一个舱里睡', d: [chip('pwr', '今天可用电 −1'), chip('sci', '睡不好：科学 −3')], fn: () => { G.today.heatAdj += 1; G.today.shelter = true; G.sci = Math.max(0, G.sci - 3); return '有人打呼噜，第二天大家都没精神。'; } }
        ] };
    },
    blight() {
      World.focus('food'); Sound.alert(); G.blight = 1; G.blightFix = false;
      return { kicker: '温室警报', title: '生菜的叶子发黄了', art: 'plant',
        body: '温室里的湿度太高，一种霉菌正在蔓延。',
        real: { label: '真实记录', date: '2015–2016', text: '2015 年 8 月，宇航员第一次吃到在国际空间站上种出来的红叶生菜。几个月后，空间站上的百日菊因为湿度太高长了霉，宇航员 Scott Kelly 不得不像园丁一样把它们救回来。', src: 'NASA Veggie 太空菜园实验' },
        choices: [
          { t: '拔掉生病的植株', d: [chip('food', '正在生长的作物 −40%')], fn: () => { G.queue = G.queue.map(x => x * .6); G.cull = Math.min(.6, G.cull + .4); G.blight = .35; World.fx('pull'); return '一片片发黄的植株被拔了出来。温室空了不少，但霉菌被挡住了。'; } },
          { t: '加强通风和光照 2 天', d: [chip('pwr', '接下来 2 天，每天可用电 −2')], fn: () => { G.drain = 2; G.drainDays = 2; G.blightFix = true; computePool(); return '风扇和灯日夜开着，作物慢慢恢复了。'; } }
        ] };
    },
    resupply() {
      World.focus('pods'); Sound.beep();
      const land = () => { G.pods++; syncWorld(); };
      return { kicker: '来自地球', title: '补给舱要发射了', art: 'ship',
        body: '地球问你们：这一次的补给舱只能装一种东西，最需要什么？',
        real: { label: '真实知识', date: '', text: '从地球发射东西到火星，要等两颗行星转到合适的位置，大约每 26 个月才有一次机会。真正的火星前哨站必须尽量自己生产，而不是等补给。', src: 'NASA 火星探索计划' },
        choices: [
          { t: '食物', d: [chip('food', '食物 +20')], fn: () => { G.food = Math.min(100, G.food + 20); land(); return '看，降落伞！补给舱稳稳落地，里面是一箱箱脱水食品。今晚吃意大利面！'; } },
          { t: '制氧机升级件', d: [chip('o2', '以后每格电 +3 氧气（原来 +2.5）')], fn: () => { G.o2Rate = 3; land(); return '补给舱落地了。新的电解堆让制氧更省电，制氧站旁还多了两个储氧罐。'; } },
          { t: '屏蔽材料', d: [chip('shield', '屏蔽直接 +1 级')], fn: () => { G.shieldLv = Math.min(5, G.shieldLv + 1); land(); return '高密度聚乙烯板——富含氢的材料特别擅长挡住宇宙射线里的粒子。'; } }
        ] };
    },
    bones() {
      World.focus('astro');
      return { kicker: '健康检查', title: '医生的提醒：骨头在变轻', art: 'health',
        body: `火星重力只有地球的 ${Math.round(F.gravity * 100)}%。在低重力下，骨骼和肌肉会慢慢流失。每天锻炼可以减缓它——可是运动时，人会呼吸得更多。`,
        real: { label: '真实研究 · NASA OSDR', date: '2019', text: `在失重环境里，宇航员的骨密度${F.boneLoss}地流失。NASA 的双胞胎研究对比了在太空住了近一年的 Scott Kelly 和他留在地球的双胞胎兄弟：回到地球半年后，仍有约 7% 的基因表达变化没有恢复。`, src: 'NASA 双胞胎研究（Garrett-Bakelman 等，2019，Science）；OSDR/GeneLab' },
        choices: [
          { t: '每天加练 1 小时', d: [chip('o2', '以后每天氧气 −1')], fn: () => { G.exercise = 1; return '跑步机嗡嗡地响起来。在空间站上，宇航员每天要锻炼大约 2 小时。'; } },
          { t: '先不练，任务要紧', d: [chip('health', '任务结束时健康评分 −1')], fn: () => { G.health -= 1; return '省下了氧气，但回去以后要做很久的康复训练。'; } }
        ] };
    },
    letter() {
      World.focus('antenna'); Sound.beep();
      const lt = LT.minutes;
      return { kicker: '来自地球', title: '一封来自小学生的信', art: 'letter',
        body: '一所小学的同学们发来了一段视频：“火星上冷吗？你们晚上能看到地球吗？”',
        real: { label: '实时计算', date: new Date().toISOString().slice(0, 10), text: `按今天的真实日期计算，地球离火星约 ${(LT.km / 1e8).toFixed(2)} 亿公里，无线电信号单程要走 ${f1(lt)} 分钟。这段视频在路上“飞”了 ${f1(lt)} 分钟才到。`, src: 'JPL 行星轨道根数' },
        choices: [
          { t: '录一段视频回信', d: [chip('pwr', '电池 −1'), chip('health', '健康 +1 · 士气 +6')],
            fn: () => { if (G.batt > 0) G.batt--; else G.today.poolPenalty += 1; G.health = Math.min(4, G.health + 1); G.morale = clamp(G.morale + 6, 0, 100); sendSignalDemo(); return `回信出发了，乘组的心情也好了一些。健康 +1，士气 +6。游戏里 1 秒代表 1 分钟。`; } },
          { t: '先忙工作，以后再回', d: [chip('none', '不花任何东西')], fn: () => '视频被存进了“待回复”文件夹。' }
        ] };
    },
    build() {
      World.focus('overview'); Sound.beep();
      const B2 = G.build, opts = [];
      if (B2.rows < 5) opts.push({ t: '扩建太阳能阵列', d: [chip('pwr', '以后每天发电 +3'), chip('pwr', '今天施工 −2 格')], focus: 'solar',
        fn: () => { B2.rows++; G.today.poolPenalty += 2; return '新的一排太阳能板立起来了。电多了，很多难题都会变简单——但它们一样怕灰尘。'; } });
      if (B2.domes < 3) opts.push({ t: '再建一座温室', d: [chip('food', '每格电种出的食物 +25%'), chip('pwr', '今天施工 −2 格')], focus: 'food',
        fn: () => { B2.domes++; G.today.poolPenalty += 2; return '新的温室穹顶充好了气，第一批土豆已经种下。'; } });
      if (B2.labs < 2) opts.push({ t: '加装一个实验舱', d: [chip('sci', '每格电的科学 +0.5'), chip('pwr', '今天施工 −2 格')], focus: 'hub',
        fn: () => { B2.labs++; G.today.poolPenalty += 2; return '实验舱对接完成！显微镜、光谱仪、岩石切割机都搬了进去。'; } });
      return { kicker: '建设机会', title: '3D 打印机攒够了一批材料', art: 'ship',
        body: '用火星土烧结出来的建材已经备好，足够建一样新东西。你想让基地朝哪个方向发展？<b>这会改变基地的样子，也会改变之后的每一天。</b>',
        real: { label: '真实研究', date: '', text: 'NASA 正在研究“就地资源利用”：用火星和月球上的土壤 3D 打印建筑，而不是从地球运材料。NASA 的“3D 打印栖息地挑战赛”就征集过这样的火星房屋设计。', src: 'NASA 3D-Printed Habitat Challenge' },
        choices: opts.map(o => ({ t: o.t, d: o.d, fn: () => { const r = o.fn(); World.focus(o.focus); syncWorld(); return r; } })) };
    },
    quake() {
      World.focus('solar'); Sound.bad(); G.damaged = 1; World.fx('flashSmall');
      return { kicker: '火星地震', title: '地面晃了一下', art: 'storm',
        body: '一次火星地震让太阳能阵列里的一块板子歪倒了。它冒着火花，每天少发 2 格电。',
        real: { label: '真实测量', date: '2022-05-04', text: 'NASA 的 InSight 着陆器在火星上一共记录到 1,300 多次火星地震。最大的一次发生在 2022 年 5 月 4 日，震级约 4.7 级。原来火星并不是一颗“死掉”的星球。', src: 'NASA InSight 任务' },
        choices: [
          { t: '马上出舱修好它', d: [chip('pwr', '恢复发电'), chip('dose', '辐射 +0.3'), chip('o2', '氧气 −4')], disabled: G.storm > 0 ? '沙尘暴中不能出舱' : '',
            fn: () => { G.damaged = 0; G.dose += .3; G.doseParts.eva += .3; G.o2 = Math.max(0, G.o2 - 4); World.fx('repair'); syncWorld(); return '两个人扛着扳手出去，把板子重新立了起来。'; } },
          { t: '先不管它', d: [chip('pwr', '每天发电 −2，直到修好')], fn: () => '它就那样歪着。也许等下次出舱清洁时，可以顺手修好。' }
        ] };
    },
    dirty() {
      World.focus('solar'); Sound.alert();
      return { kicker: '设备提醒', title: '太阳能板越来越脏了', art: 'devil',
        body: `火星的灰尘一直在往板子上落。现在的清洁度只剩 <b>${Math.round(G.panelEff * 100)}%</b>，每天发的电越来越少。`,
        real: { label: '真实记录', date: '2022-12', text: 'NASA 的 InSight 着陆器在火星上工作了四年，最后因为太阳能板上的灰尘越积越厚、电力耗尽，在 2022 年 12 月结束了任务。', src: 'NASA InSight 任务' },
        choices: [
          { t: '出舱清扫', d: [chip('pwr', '清洁度 → 100%'), chip('dose', '辐射 +0.2'), chip('o2', '氧气 −3')].concat(G.damaged ? [chip('pwr', '顺便修好损坏的板子')] : []),
            fn: () => { G.panelEff = 1; G.damaged = 0; G.dose += .2; G.doseParts.eva += .2; G.o2 = Math.max(0, G.o2 - 3); World.fx('clean'); return '擦干净了！明天开始发电会多不少。'; } },
          { t: '等风来吹', d: [chip('none', '清洁度会继续下降')], fn: () => '也许哪天会有一股尘卷风经过呢？' }
        ] };
    }
  };

  function openEvent(id, resolved) {
    const e = EVENTS[id](); e.id = id;
    presentEncounter(e, resolved, true);
  }
  function sendSignalDemo() {
    const lt = LT.minutes, el = document.createElement('div'); el.className = 'sigdemo';
    el.innerHTML = `<div class="sd-h">回信正在飞往地球</div><div class="sd-bar"><s></s></div><div class="sd-n"></div>`; $('#frame').appendChild(el);
    World.signal(lt + 1);
    const t0 = performance.now();
    (function tick() { const k = Math.min(1, (performance.now() - t0) / 1000 / lt);
      el.querySelector('s').style.width = k * 100 + '%'; el.querySelector('.sd-n').textContent = `${f1(k * lt)} / ${f1(lt)} 分钟（游戏里 1 秒 = 1 分钟）`;
      if (k < 1) requestAnimationFrame(tick); else { el.querySelector('.sd-h').textContent = '地球收到了！'; Sound.good(); setTimeout(() => el.remove(), 2200); } })();
  }

  /* ======================= 开场 ======================= */
  function showCap(html, hold) {
    const c = $('#cap'); c.classList.remove('on'); void c.offsetWidth;
    c.innerHTML = html; c.classList.add('on');
    clearTimeout(showCap.t); if (hold) showCap.t = setTimeout(() => c.classList.remove('on'), hold);
  }
  function startIntro() {
    Sound.init(); Sound.whoosh();
    $('#title').classList.remove('on'); $('#skip').classList.add('on');
    const dist = (LT.km / 1e8).toFixed(2);
    const cues = [
      { t: .6, id: 'c1' }, { t: 3.6, id: 'c2' }, { t: 9, id: 'c3' }, { t: 13.5, id: 'c4' }, { t: 18.5, id: 'c5' }, { t: 23.2, id: 'c6' }
    ];
    const text = {
      c1: '<span class="big">这是地球。</span>',
      c2: '在这里，空气、水和食物都是现成的；<br>厚厚的大气和磁场，替我们挡住了大部分宇宙辐射。',
      c3: '<span class="big">离开它，这一切都要自己造。</span>',
      c4: `今天，火星离我们 <b>${dist} 亿公里</b>。<br>无线电信号要走 <b>${f1(LT.minutes)} 分钟</b>。`,
      c5: '你将指挥人类在火星上的第一座前哨站，<br>度过 <b>30 个火星日</b>。',
      c6: '<span class="big">每一度电都有去处。</span><br>没有哪一个选择是免费的。'
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
      setTimeout(() => showCap('<span class="big">杰泽罗陨石坑</span><br>北纬 18.4° · 一片干涸了约 35 亿年的古老湖底', 5000), 1600);
    }, 1100);
    setTimeout(() => en.classList.remove('on'), 2600);
  }
  function startGame() {
    $('#hud').classList.add('on'); setSceneView('interior');
    beginSol();
  }

  /* ======================= 结局 ======================= */
  /* 结局由你的选择决定：发现者 / 开拓者 / 守护者 / 任务成功 / 平安归来 / 紧急撤离 */
  const ENDINGS = {
    discovery: { title: '发现者', badge: '发现者', color: '#e6a83f',
      sub: '样本舱点火升空。它会在轨道上和返航飞船会合，把你们采集的岩石带回地球——也许里面藏着人类第一次发现的、另一个世界的生命痕迹。',
      caps: [[0, '<span class="big">样本管已经封好。</span>'], [4200, '<span class="big">点火！</span><br>火星样本，出发。']] },
    builder: { title: '开拓者', badge: '开拓者', color: '#d9692f',
      sub: '你建起的不只是一座前哨站，而是一个可以住下去的地方。第二批乘组的降落伞，正在你的基地上空打开。',
      caps: [[0, '<span class="big">看，降落伞！</span>'], [5200, '第二批乘组到了。<br>他们会住进你建起的家园。']] },
    guardian: { title: '守护者', badge: '守护者', color: '#3f8f93',
      sub: '30 天里，每个人都健健康康，辐射剂量远低于上限。最后一个夜晚，四个人走出舱门，站在一起，看着那颗蓝色的星星。',
      caps: [[0, '<span class="big">最后一个夜晚。</span>'], [5200, '大家都出来了。<br>头顶亮起了绿色的极光。']] },
    success: { title: '任务成功', badge: '任务成功', color: '#7fae5b',
      sub: '你们活了下来，还完成了科学目标。上升器带着乘组和数据离开火星，前往等在轨道上的返航飞船。',
      caps: [[0, '<span class="big">全员登舱。</span>'], [6000, '再见，杰泽罗。']] },
    home: { title: '平安归来', badge: '平安归来', color: '#8cc7c3',
      sub: `乘组平安回家了，但科学成果没有达到 ${GOAL} 分的目标。下一次，试着在安全和探索之间找到更好的平衡。`,
      caps: [[0, '<span class="big">全员登舱。</span>'], [6000, '至少，每个人都平安。']] },
    evac: { title: '任务提前结束', badge: '紧急撤离', color: '#b8452a',
      sub: '失败也是训练的一部分。真实的任务规划师，正是从无数次模拟失败里学会了怎样做决定。',
      caps: [[0, '<span class="big">警报！</span><br>所有人到上升器集合！']] }
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
    G.over = true; busy = true; hideTip(); Habitat.closeCard(); setSceneView('exterior'); $('#frame').classList.remove('notebook-open');
    $('#hud').classList.remove('on'); $('#modal').classList.remove('on');
    World.setStorm(0); World.setFrost(0); G.eva = false; G.today.shelter = false; syncWorld({ eva: false, shelter: false });
    const ek = endingKind(kind); G.ending = ek;
    const why = kind === 'win' ? '' : kind === 'o2' ? '氧气快要耗尽了。' : kind === 'food' ? '食物见底了。' : kind === 'water' ? '饮用水耗尽了。' : '辐射剂量超过了任务上限。';
    kind === 'win' ? Sound.good() : Sound.bad();
    showCap(kind === 'win' ? '<span class="big">第 30 个火星日。</span><br>任务完成。' : `<span class="big">${why}</span><br>乘组启动应急方案，撤离火星。`, 3600);
    const E = ENDINGS[ek];
    setTimeout(() => {
      E.caps.forEach(([t, c]) => setTimeout(() => showCap(c, 3800), t));
      World.ending(ek, () => {
        World.lookEarth();
        const caps = ['抬头看。那颗蓝色的小点，就是地球。', '这些天里，你为之精打细算的一切——<br>氧气、食物、电、挡住辐射的屏障——', '在那里，大气、海洋和磁场，<br>每一天都在免费地替我们做好。', '<span class="big">我们只有这一个。</span>'];
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
    return `<svg viewBox="0 0 ${W} ${Hh}" class="chart" role="img" aria-label="任务资源变化曲线">
      ${storm}<line x1="${pad}" x2="${W - pad}" y1="${Hh - 20}" y2="${Hh - 20}" stroke="#2b1a24" stroke-width="2"/>
      ${evs}${line('o2', 100, '#3f8f93')}${line('food', 100, '#7fae5b')}${line('dose', BUDGET, '#d9692f')}${line('sci', GOAL, '#e6a83f')}
      <text x="${pad}" y="${Hh - 4}" class="ax">第 1 日</text><text x="${W - pad}" y="${Hh - 4}" text-anchor="end" class="ax">第 30 日</text></svg>`;
  }
  function insights(kind) {
    const out = [];
    const tot = Object.values(G.powerUse).reduce((a, b) => a + b, 0) || 1, pc = k => Math.round(G.powerUse[k] / tot * 100);
    out.push(`你一共分配了 <b>${tot}</b> 格电：制氧 ${pc('o2')}%、温室 ${pc('food')}%、屏蔽 ${pc('shield')}%、科研 ${pc('sci')}%。`);
    const dp = G.doseParts;
    out.push(`你受到的 <b>${f1(G.dose)} 毫希</b>辐射里：${f1(dp.gcr)} 来自每天都躲不开的银河宇宙射线，${f1(dp.sep)} 来自太阳风暴，${f1(dp.eva)} 来自出舱。${dp.gcr > dp.sep ? '<b>宇宙射线很难挡住——这正是人类去火星最难解决的问题之一。</b>' : '<b>太阳风暴虽然少见，但一次就能抵得上好多天。</b>'}`);
    let mi = 0; G.hist.forEach((d, i) => { if (d.o2 < G.hist[mi].o2) mi = i; });
    if (G.hist.length) { const m = G.hist[mi]; out.push(`氧气最低的时候是第 ${m.sol} 天，只剩 <b>${Math.round(m.o2)}%</b>${m.gen <= 5 ? '——正赶上沙尘暴，太阳能板几乎发不出电' : ''}。`); }
    if (kind === 'o2') {
      let run = 0, i = G.hist.length - 1; while (i >= 0 && G.hist[i].alloc.o2 * G.o2Rate < O2_USE) { run++; i--; }
      out.push(`<b>发生了什么：</b>最后 ${run} 天里，制氧每天分到的电都不够抵消乘组的消耗（每天 ${O2_USE}）。每天少一点，${run} 天加起来就是致命的。`);
    }
    if (kind === 'food') out.push('<b>发生了什么：</b>温室要 3 天才能收获。等食物开始下降时再补救，已经来不及了——这就是“延迟”的可怕之处。');
    if (kind === 'water') out.push('<b>发生了什么：</b>乘组每天要消耗饮水。水桶告急前，可以用净水机将电池换成饮水，也可以在事件里优先选择水资源。');
    if (kind === 'dose') out.push('<b>发生了什么：</b>辐射是一点一点累积的，而且不会减少。早一点投资屏蔽、风暴时躲进避难所，都能省下大量剂量。');
    if (G.decisions.length) out.push('你做过的关键决定：' + G.decisions.slice(0, 5).map(d => `第 ${d.sol} 天「${d.choice}」`).join('、') + '。');
    return out;
  }
  function showReport(kind) {
    const win = kind === 'win';
    const sciOk = G.sci >= GOAL;
    const E = ENDINGS[G.ending || 'home'];
    const title = E.title, sub = E.sub;
    const all = ['discovery', 'builder', 'guardian'], got = badges(kind);
    const hint = { discovery: `科学成果 ≥ 130，或采到三角洲样本且 ≥ 110`, builder: '建造 3 次扩建（或 2 次 + 屏蔽 4 级）', guardian: '辐射 ≤ 13 毫希，且乘组健康不少于 3 颗' };
    const badgeHtml = `<div class="rp-badges">${all.map(k => `<div class="bdg ${got.includes(k) ? 'got' : ''}" style="--c:${ENDINGS[k].color}"><b>${ENDINGS[k].badge}</b><span>${got.includes(k) ? '已达成' : hint[k]}</span></div>`).join('')}</div>`;
    const build = `太阳能板 ${G.build.rows} 排 · 温室 ${G.build.domes} 座 · 实验舱 ${G.build.labs} 个 · 储氧罐 ${tanks()} 个 · 考察旗 ${G.evaCount + (G.sample ? 1 : 0)} 面`;
    const crewO2 = (F.o2PerPerson * 4).toFixed(2);
    const earthYears = (G.dose / F.earthBackground).toFixed(1);
    $('#report').innerHTML = `<div class="rp">
      <div class="rp-k">任务报告 · 杰泽罗前哨站</div>
      <h1><span style="background:linear-gradient(transparent 58%,${E.color} 58%);padding:0 .1em">${title}</span></h1><p class="rp-sub">${sub}</p>
      ${badgeHtml}
      <div class="rp-build">你建起的基地：${build}</div>
      <p class="rp-care">返航时的储备：饮水 ${f1(G.water)} · 药品 ${G.meds} · 乘组士气 ${Math.round(G.morale)} / 100</p>
      <div class="rp-stats">
        <div><b>${G.hist.length}</b><span>火星日</span></div>
        <div><b>${Math.round(G.sci)}</b><span>科学成果 / ${GOAL}</span></div>
        <div><b>${f1(G.dose)}</b><span>辐射剂量（毫希）</span></div>
        <div><b>${G.shieldLv}</b><span>屏蔽等级</span></div>
        <div><b>${'●'.repeat(clamp(G.health, 0, 4))}${'○'.repeat(4 - clamp(G.health, 0, 4))}</b><span>乘组健康</span></div>
      </div>
      <div class="rp-chart"><div class="lg"><i style="background:#3f8f93"></i>氧气 <i style="background:#7fae5b"></i>食物 <i style="background:#d9692f"></i>辐射 <i style="background:#e6a83f"></i>科学 <i class="ev"></i>事件</div>${chartSVG()}</div>
      <div class="rp-cols">
        <div><h3>你的任务，是怎样一步步走到这里的</h3><ul>${insights(kind).map(x => `<li>${x}</li>`).join('')}</ul></div>
        <div><h3>和真实世界对比</h3><ul>
          <li>你的 4 人乘组每天需要约 <b>${crewO2} 千克</b>氧气。毅力号的 MOXIE 三年一共造了 <b>${F.moxieTotal} 克</b>。</li>
          <li>你在火星 ${G.hist.length} 天受到的辐射，相当于在地球上生活 <b>${earthYears} 年</b>。NASA 规定宇航员一生最多 <b>${F.careerLimit} 毫希</b>。</li>
          <li>机遇号原计划工作 ${F.opportunityPlanned} 个火星日，最后工作了 <b>${F.opportunityActual}</b> 个——直到一场沙尘暴遮住了太阳。</li>
        </ul></div>
      </div>
      <div class="rp-end">在火星上，每一口空气都要计算。在地球上，它们是免费的。</div>
      <div class="rp-btns"><button class="btn big" id="bAgain">再来一次</button><button class="btn" id="bSrc2">数据来源</button></div>
    </div>`;
    $('#report').classList.add('on');
    $('#bAgain').onclick = () => { Sound.click(); $('#report').classList.remove('on'); World.reset(); newGame(); $('#hud').classList.add('on'); setSceneView('interior'); beginSol(); };
    $('#bSrc2').onclick = openSources;
  }

  /* ======================= 数据来源 / 通信 ======================= */
  function openSources() {
    const L = DATA.live;
    const liveHtml = L.status === 'ok' ? (L.flares.length ? `<b class="ok">● 已连接</b> 最近 30 天，太阳一共爆发了 <b>${L.flares.length}</b> 次耀斑。最强的几次：${L.flares.slice(0, 5).map(f => `<span class="chip pwr">${f.cls} · ${f.peak.slice(0, 10)}</span>`).join(' ')}` : '<b class="ok">● 已连接</b> 最近 30 天没有记录到耀斑——太阳很平静。')
      : L.status === 'loading' ? '正在连接 NASA DONKI……' : '<b class="bad">● 未连接</b> 现在连不上 NASA 的接口（可能是网络问题或访问次数到了上限）。游戏使用的是内置的真实存档数据，不会把存档冒充成实时数据。';
    $('#srcCard').innerHTML = `<button class="x" id="srcX" aria-label="关闭">×</button>
      <div class="rp-k">数据来源与说明</div><h2>这个游戏里的数字，都从哪里来？</h2>
      <div class="live">${liveHtml}</div>
      <div class="live">今天（${new Date().toISOString().slice(0, 10)}）地球到火星：<b>${(LT.km / 1e8).toFixed(2)} 亿公里</b>，信号单程 <b>${f1(LT.minutes)} 分钟</b>。按 JPL 行星轨道根数实时计算。</div>
      <div class="src-list">${DATA.sources.map(s => `<div class="src"><span class="r-tag">${s.tag}</span><h4>${s.title}</h4><p>${s.body}</p><a href="${s.link}" target="_blank" rel="noopener">${s.link.replace('https://', '')}</a></div>`).join('')}</div>
      <h3>游戏做了哪些简化</h3><ul class="simp">${DATA.simplifications.map(s => `<li>${s}</li>`).join('')}</ul>
      <h3>给老师和家长</h3>
      <p class="teach">这个游戏想让孩子亲身体会四个真实的工程道理：<b>① 资源是有限的</b>：电给了这里，就不能给那里；<b>② 决定有延迟</b>：温室今天种、三天后才收获，氧气每天少一点，累积起来就是危险；<b>③ 风险要提前投资</b>：屏蔽是慢慢建起来的，等太阳风暴来了再建就晚了；<b>④ 通信延迟让人必须独立判断</b>：地球的帮助永远晚几分钟。可以让孩子玩两次，比较两种不同策略的报告曲线，再讨论“为什么”。</p>`;
    $('#sources').classList.add('on');
    $('#srcX').onclick = () => $('#sources').classList.remove('on');
  }
  function openComm() {
    if (!G) return;
    const blocked = G.conj > 0;
    $('#mcard').innerHTML = `<div class="ev-art art-letter"><div class="ev-k">与地球通信</div></div>
      <h2>${blocked ? '日凌中，信号被太阳挡住了' : `信号单程 ${f1(LT.minutes)} 分钟`}</h2>
      <p class="ev-b">按今天的真实日期计算，地球离火星约 <b>${(LT.km / 1e8).toFixed(2)} 亿公里</b>。无线电以光速传播，也要走 <b>${f1(LT.minutes)} 分钟</b>；问一个问题再等到回答，至少要 <b>${f1(LT.minutes * 2)} 分钟</b>。地球和火星最近时，单程约 3 分钟；最远时约 22 分钟。</p>
      <div class="choices"><button class="btn go" id="cmSend" ${blocked ? 'disabled' : ''}>发一句「你好，地球」</button><button class="btn" id="cmX">关闭</button></div>`;
    $('#modal').classList.add('on'); World.focus('antenna');
    $('#cmX').onclick = () => { $('#modal').classList.remove('on'); World.focus('overview'); };
    const s = $('#cmSend'); if (s) s.onclick = () => { $('#modal').classList.remove('on'); sendSignalDemo(); };
  }

  /* ======================= 启动 ======================= */
  function boot() {
    World.init($('#stage'));
    Habitat.init({ inspect: inspectCabinItem, view: setSceneView });
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
    $('#previousPage').onclick = () => flipBook(-1); $('#nextPage').onclick = () => flipBook(1);
    $('#planningNotice').onclick = () => journalPage(journalPhase === 'event' ? 'decision' : 'brief');
    $('#journalMap').innerHTML = mapSketch;
    $('#bSnd').onclick = () => { Sound.init(); const on = Sound.toggle(); $('#bSnd').textContent = on ? '声音：开' : '声音：关'; };
    $('#bSnd').textContent = Sound.on ? '声音：开' : '声音：关';
    $('#bComm').textContent = `地球 · ${f1(LT.minutes)} 分钟`;
    $('#sources').onclick = e => { if (e.target.id === 'sources') $('#sources').classList.remove('on'); };
    addEventListener('keydown', e => {
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
    tl.innerHTML = `今天地球到火星 <b>${(LT.km / 1e8).toFixed(2)} 亿公里</b> · 信号要走 <b>${f1(LT.minutes)} 分钟</b><br><span id="tDonki">正在读取 NASA 太空天气……</span>`;
    DATA.fetchDonki().then(L => {
      const d = $('#tDonki');
      if (L.status === 'ok') d.innerHTML = L.flares.length ? `NASA DONKI 实时：最近 30 天太阳爆发了 <b>${L.flares.length}</b> 次耀斑，最强 <b>${L.flares[0].cls}</b>` : 'NASA DONKI 实时：最近 30 天太阳很平静';
      else d.textContent = '离线模式：使用 NASA DONKI 存档中的真实事件';
      if (!G.over && G.sol === 1 && !$('#hud').classList.contains('on')) newGame(); // 拿到实时数据后重新排一次事件
    });
  }
  boot();
  if (/debug/.test(location.search)) window.__dbg = { G: () => G, endGame, syncWorld, renderAll, beginSol };
})();
