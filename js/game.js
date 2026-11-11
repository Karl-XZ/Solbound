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
      tip: '制氧机从二氧化碳中提取氧气。MOXIE 已在火星上完成过这项实验。游戏中每格电生产 2.5 点氧气。宇航员每天消耗 7 点。' },
    { k: 'food', name: '温室', color: '#7fae5b', focus: 'food',
      tip: '温室需要照明和供暖。每格电增加 1.8 点食物。3 天后才能收获。' },
    { k: 'shield', name: '屏蔽施工', color: '#d9692f', focus: 'shield',
      tip: '挖土机会把土堆到舱段上。每用满 5 格电就增加 1 级屏蔽。屏蔽升级后可持续减少辐射。' },
    { k: 'sci', name: '科研', color: '#e6a83f', focus: 'sci',
      tip: '分析岩石、观测天气、把数据发回地球。每格电 +1.5 科学。科学是你们来火星的原因。' }
  ];
  const TIPS = {
    water: '宇航员每天消耗 2.5 点饮水。点击净水机可净水。每次消耗 2 格电池。饮水最多增加 12 点。每天限用一次。水耗尽时任务必须中止。',
    meds: '急救箱里的药品。每次使用 1 份。健康最多 +1。心情最多 +8。每天限用一次。',
    morale: '心情影响宇航员的表情。每天自然下降 2 点。缺少食物或水会加快下降。加餐、饮水、聊天和事件选择都能改善心情。',
    o2: `宇航员每天要消耗 ${O2_USE} 点氧气（现实中每人每天约 ${F.o2PerPerson} 千克）。氧气降到 0 后必须结束任务。`,
    food: `宇航员每天吃掉 ${FOOD_USE} 点食物。温室种下的作物 3 天后才能收获。`,
    dose: `辐射剂量的单位是“毫希”（mSv）。地球上每人每年平均受到 ${F.earthBackground} 毫希天然辐射。好奇号测得火星地表每个火星日约 ${F.radSurface} 毫希。这次任务的上限是 ${BUDGET} 毫希。`,
    sci: `科学成果需要达到 ${GOAL} 分。宇航员还要完成 30 天生存任务。`,
    batt: `剩余电力会存入电池。电池最多存 ${BATT_MAX} 格。沙尘暴期间可使用这些电力。`,
    shield: '提高屏蔽等级可以减少辐射。屏蔽更容易阻挡太阳风暴粒子。银河宇宙射线更难阻挡。',
    sol: `火星日是火星自转一圈的时间。时长为 ${F.solLength}。比地球的一天稍长。`,
    tau: 'τ 表示空气里有多少灰尘。数字越大就表示灰尘越多。灰尘会遮挡阳光。平时约 0.5；2018 年那场全球沙尘暴超过了 10。',
    heat: `火星夜里约 ${F.nightTemp}°C。加热器每晚会预留电力。供暖不足会增加氧气消耗。`,
    eva: '穿上宇航服到外面去考察。出舱可完成维修和采样。出舱会消耗氧气并增加辐射。'
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
      if (G.alloc.o2 < 3) return Habitat.toast('制氧电量不足。请增加到 3 格。');
      Expedition.notify('allocate'); setSceneView('interior'); return;
    }
    Expedition.sleep();
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
    const warning = G.o2 < 25 ? '氧气储备偏低。请增加制氧电量。' : G.food < 25 ? '食物储备偏低。温室需要 3 天才能收获。请提前分电。' : G.storm > 0 ? '沙尘暴还没有过去。请优先给制氧和温室分电。' : G.events[G.sol + 1] === 'stormStart' ? '沙尘暴明天到达。请补充物资。还要给电池充电。' : '';
    $('#journalEvent').innerHTML = `<div class="entry-label">${G.sol === 1 ? '首日任务' : '今日提示'}</div>
      <h2>${G.sol === 1 ? '第 1 天' : warning ? '今日资源提醒' : '今日工作安排'}</h2>
      <p class="entry-body">${G.sol === 1 ? '基地有 4 名宇航员。今天要修复太阳能板。修复后再学习净水和分电。' : warning || '请检查物资和电力。再安排今天的工作。'}</p>
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
      const records = chunks.map((chunk, i) => `<section class="book-page archive-page" data-book="archive" data-sheet="archive-${d.sol}-${i}" data-label="SOL ${String(d.sol).padStart(2, '0')} · 事件记录" hidden><div class="page-eyebrow">事件档案 / ${d.pending ? '今日已记录' : '日终归档'}</div><h2>第 ${d.sol} 日${i ? ' · 续页' : ' 操作记录'}</h2>${!i && !notes.length ? d.decisions.map(c => `<div class="archived-decision"><span>${c.title}</span><b> ${c.choice}</b></div>`).join('') : ''}${chunk.length ? `<ul class="summary-notes">${chunk.map(n => `<li>${n}</li>`).join('')}</ul>` : `<p class="entry-body">${d.pending ? '操作已记录。结束当天后可查看物资和分电记录。' : '今天没有特殊事件。基地按计划运转。'}</p>`}</section>`).join('');
      if (d.pending) return records;
      return records + `<section class="book-page archive-page" data-book="archive" data-sheet="archive-${d.sol}-resources" data-label="SOL ${String(d.sol).padStart(2, '0')} · 资源与分配" hidden><div class="page-eyebrow">资源记录</div><h2>第 ${d.sol} 日 · 物资账本</h2><div class="archive-resources"><span>氧气<b>${Math.round(d.o2)}<small>%</small></b></span><span>食物<b>${Math.round(d.food)}<small>%</small></b></span><span>科学成果<b>${f1(d.sci)}</b></span><span>累计辐射<b>${f1(d.dose)}<small> mSv</small></b></span></div><div class="allocation-record"><span>当天的电力安排</span>${Object.entries(d.alloc).map(([k, v]) => `<p>${SLOTS.find(s => s.k === k).name}<b>${v} 格</b></p>`).join('')}</div><p class="page-note">饮水 ${f1(d.water ?? 0)} · 药品 ${d.meds ?? 0} · 心情 ${Math.round(d.morale ?? 0)}</p></section>`;
    }).join('') : `<section class="book-page archive-page" data-book="archive" data-sheet="archive-empty" data-label="事件档案" hidden><div class="page-eyebrow">事件档案 / 000</div><h2>暂无历史记录</h2><p class="entry-body">这里保存每天的操作、资源和分电方案。<br><br>结束第 1 天后可查看记录。</p><div class="empty-archive-mark" aria-hidden="true"></div></section>`;
    archiveIndex = Math.min(archiveIndex, Math.max(0, $('#journalHistory').children.length - 1));
  }
  let rng = Math.random;
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hab = lv => .72 - .06 * lv;     // 舱内受到的银河宇宙射线比例
  const sepFac = lv => .8 - .13 * lv;   // 舱内受到的太阳风暴粒子比例

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
  function powerStatus() {
    const normal = Math.max(0, Math.round((12 + 3 * (G.build.rows - 2)) * G.sunVar * (G.storm > 0 ? G.stormMul : 1)));
    const causes = [];
    if (G.storm > 0) causes.push('沙尘暴挡住阳光');
    if (G.panelEff < .98) causes.push(`太阳能板积灰。清洁度 ${Math.round(G.panelEff * 100)}%`);
    if (G.damaged > 0) causes.push(`${G.damaged} 块板的接头或支架需要维修`);
    return { normal, lost: Math.max(0, normal - G.gen), causes };
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

  /* ======================= 界面：仪表 ======================= */
  function meterRow(k, label, tip) {
    return `<div class="m-row" data-k="${k}"><span class="m-l"><i class="dot ${k}"></i>${label}<button class="q" data-tip="${tip}">?</button></span>
      <div class="bar"><s></s><u></u></div><em class="v"></em><b class="d"></b></div>`;
  }
  function buildHUD() {
    $('#meters').innerHTML = `<div class="c-h">前哨站状态</div>
      ${meterRow('o2', '氧气', 'o2')}${meterRow('food', '食物', 'food')}${meterRow('dose', '辐射剂量', 'dose')}${meterRow('sci', '科学成果', 'sci')}${meterRow('batt', '电池', 'batt')}
      <div class="m-shield"><span><i class="dot shield"></i>屏蔽等级<button class="q" data-tip="shield">?</button></span><span class="lv"></span><span class="prog"></span></div>`;
    $('#careMeters').innerHTML = `${meterRow('water', '饮用水', 'water')}${meterRow('meds', '药品', 'meds')}${meterRow('morale', '宇航员心情', 'morale')}`;
    $('#power').innerHTML = `
      <div class="p-h"><span class="p-title">今天的电</span><span class="p-eq"></span><details class="power-details"><summary>查看发电原因</summary><p id="powerExplanation"></p></details></div>
      <div class="p-tokens"></div>
      <div class="p-slots">${SLOTS.map(s => `<div class="slot" data-k="${s.k}">
          <div class="s-top"><i class="dot ${s.k}"></i><span class="s-name">${s.name}</span><button class="q" data-tipx="${s.k}">?</button></div>
          <div class="s-ctl"><button class="mn" aria-label="减少">−</button><b class="s-n">0</b><button class="pl" aria-label="增加">+</button></div>
          <div class="s-eff"></div></div>`).join('')}</div><button id="planningNotice" hidden></button><div id="planActions"></div>`;
    $('#planActions').innerHTML = `
      <div class="p-foot">
        <button class="eva" id="evaDepart">出舱探索</button>
        <span class="p-left"></span>
        <button class="btn go" id="bGo">完成分电<span>→</span></button>
      </div>`;
    SLOTS.forEach(s => {
      const el = $(`.slot[data-k="${s.k}"]`);
      el.querySelector('.pl').onclick = () => { if (busy) return; if (s.k === 'sci' && sciLocked()) return nudge(el, '今天科研暂停'); if (G.alloc[s.k] >= SLOT_MAX) return nudge(el, '这个系统一天最多用 8 格'); if (used() >= Math.max(0, G.pool)) return nudge(el, '今天的电已经分完了'); G.alloc[s.k]++; G.want[s.k] = G.alloc[s.k]; Sound.plus(); renderAll(); };
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
    $('#powerExplanation').textContent = `今天发电 ${G.gen} 格。相同天气下正常可发 ${power.normal} 格。${power.causes.length ? '故障：' + power.causes.join('。') + '。' : '设备运行正常。'}电池还有 ${G.batt} 格。扣除供暖等预留后可分配 ${G.pool} 格。`;
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
    if (G.pool < 0) toks = `<span class="short">供暖缺电 ${-G.pool} 格。氧气将额外减少 ${-G.pool * 3} 点。</span>`;
    $('.p-tokens').innerHTML = toks;
    SLOTS.forEach(s => {
      const el = $(`.slot[data-k="${s.k}"]`), n = G.alloc[s.k];
      el.querySelector('.s-n').textContent = n;
      el.classList.toggle('locked', s.k === 'sci' && sciLocked());
      const eff = s.k === 'o2' ? `+${f1(p.o2Prod)} 氧气<small>今晚需要 ${O2_USE + G.exercise}</small>`
        : s.k === 'food' ? `+${f1(n * foodPer())} 食物<small>3 天后收获${G.build.domes > 1 ? ` · ${G.build.domes} 座温室` : ''}</small>`
        : s.k === 'shield' ? (G.shieldLv >= 5 ? '已满级<small>不再需要</small>' : `施工 ${G.shieldProg}+${n}/5<small>${p.lv > G.shieldLv ? '明天升级！' : '攒够 5 格升一级'}</small>`)
        : sciLocked() ? '暂停<small>今天无法科研</small>' : `+${f1(n * sciPer())} 科学<small>每格 ${f1(sciPer())}${G.build.labs ? ' · 实验舱加成' : ''}</small>`;
      el.querySelector('.s-eff').innerHTML = eff;
      el.classList.toggle('warn', s.k === 'o2' && p.o2Prod < O2_USE);
    });
    const left = p.left;
    $('.p-left').innerHTML = G.pool < 0 ? '' : left > 0 ? `剩 <b>${left}</b> 格 → ${p.wasted ? `电池已满。<b class="bad">浪费 ${p.wasted} 格</b>` : '存进电池'}` : '电全部分配完';
    const eb = evaBlocked(); $('#evaDepart').innerHTML = `<span class="sw" aria-hidden="true"></span><span>${eb || '出舱探索'}<small>氧气 −3 · 辐射 +${Math.round((.25 + G.today.flareOut) * 100) / 100}</small></span>`; $('#evaDepart').disabled = !!eb;
    // 环境
    const sun = Math.round(G.sunVar * (G.storm > 0 ? G.stormMul : 1) * 100);
    const tau = G.storm > 0 ? (G.stormSave ? 6.2 : 6.8) : (.4 + (1 - G.sunVar) * 3).toFixed(1);
    const nextFlare = G.flareSols.includes(G.sol + 1), nextStorm = G.events[G.sol + 1] === 'stormStart';
    $('#fore').innerHTML = `<div class="c-h">今日环境</div>
      <div class="f-row"><span>阳光</span><b>${sun}%</b></div>
      <div class="f-row"><span>大气尘埃 τ<button class="q" data-tip="tau">?</button></span><b class="${G.storm > 0 ? 'bad' : ''}">${tau}</b></div>
      <div class="f-row"><span>太阳能板清洁度</span><b class="${G.panelEff < .82 ? 'bad' : ''}">${Math.round(G.panelEff * 100)}%</b></div>
      <div class="f-row"><span>明天的太空天气</span><b class="${nextFlare ? 'bad' : 'good'}">${nextFlare ? '太阳风暴预警' : '平静'}</b></div>
      <div class="f-row"><span>信号到地球</span><b>${G.conj > 0 ? '日凌·中断' : f1(LT.minutes) + ' 分钟'}</b></div>
      ${G.storm > 0 ? `<div class="f-alert">沙尘暴还剩 ${G.storm} 天</div>` : nextStorm ? `<div class="f-alert">沙尘暴明天到达</div>` : ''}`;
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
    notes.push(`饮水消耗 ${WATER_USE} 点。剩余 ${f1(G.water)} 点。心情 ${fmt(-moraleLoss)}。当前心情 ${Math.round(G.morale)}。`);
    // 资源结算
    G.o2 = clamp(G.o2 + p.o2, 0, 100);
    G.food = clamp(G.food + p.food, 0, 100);
    G.queue = [G.queue[1], G.queue[2], a.food * foodPer()];
    const lvBefore = G.shieldLv; G.shieldLv = p.lv; G.shieldProg = G.shieldLv >= 5 ? 0 : p.prog;
    G.dose += p.dose; G.doseParts.gcr += p.gcr; G.doseParts.sep += T.flareDose;
    const sciBefore = G.sci, tanksBefore = tanks();
    G.sci += p.sci;
    G.batt = Math.max(0, p.batt);
    for (const k in a) G.powerUse[k] += a[k];
    const SCI_PARTS = [[15, '地震仪'], [35, '岩芯钻机'], [55, '天文望远镜'], [80, '样本存放架'], [100, '科学目标达成旗']];
    for (const [th, name] of SCI_PARTS) if (sciBefore < th && G.sci >= th) notes.push(`科学成果达到 ${th}：科学站新添了一台<b>${name}</b>！`);
    if (tanks() > tanksBefore) notes.push('制氧机已增加一个<b>储氧罐</b>。');    // 日凌期间出舱的风险
    // 因果说明
    if (p.short) notes.push(`供暖电量不足。生命保障系统已降低功率。氧气额外 −${p.short * 3}。`);
    if (p.o2 < 0) notes.push(`氧气 ${fmt(p.o2)}：制氧产出 ${f1(p.o2Prod)} 点。宇航员消耗 ${O2_USE + G.exercise} 点。`);
    else notes.push(`氧气 ${fmt(p.o2)}：制氧产出 ${f1(p.o2Prod)} 点。已满足宇航员消耗。`);
    notes.push(p.harvest > .05 ? `温室收获 ${f1(p.harvest)} 点食物。宇航员消耗 ${FOOD_USE} 点。` : `温室没有收获。3 天前没有给温室分电。食物 −${FOOD_USE}。`);
    if (G.shieldLv > lvBefore) notes.push(`屏蔽已升到 ${G.shieldLv} 级。之后每天的辐射会减少。`);
    if (T.flareDose > 0) notes.push(`太阳风暴让舱内宇航员多受了 ${f1(T.flareDose)} 毫希辐射；出舱额外剂量已在出发时记录。`);
    if (p.wasted) notes.push(`电池已满。${p.wasted} 格电被浪费掉。`);
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
    if (stormEnded) notes.unshift('沙尘暴已结束。太阳能板恢复正常发电。');
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
    $('#journalChoices').innerHTML = `<div class="page-eyebrow">今日操作</div><h2>今日操作记录</h2><p class="page-subtitle">已记录 ${notes.length} 次操作。结束当天后可查看完整记录。</p><ul class="summary-notes">${notes.slice(-3).map(n => `<li>${n}</li>`).join('')}</ul>`;
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
    const action = (key, label, hint, allowed, change, note) => ({ label: G.care[key] ? '今天已经完成' : label, hint, disabled: !!G.care[key] || !allowed(), run: () => careForCrew(key, allowed, change, note) });
    const bookAction = (page, label) => ({ label, hint: page === 'brief' ? '翻开今日手册' : '打开基地控制台', run: () => showJournal(true, page) });
    if (item === 'food') return card({ title: '食物补给箱', value: `${f1(G.food)}<small>点</small>`, description: `宇航员每天消耗 ${FOOD_USE} 点食物。温室收获后会增加食物。加餐可提高心情。`, actions: [
      action('snack', '给大家加一餐', '食物 −3 · 心情 +6 · 每日一次', () => G.food >= 3 && G.morale < 100, () => { G.food -= 3; G.morale = clamp(G.morale + 6, 0, 100); }, '宇航员已加餐。食物 −3。心情最多 +6。'), bookAction('supplies', '清点生存物资')
    ] });
    if (item === 'water') return card({ title: '饮用水桶', value: `${f1(G.water)}<small>点</small>`, description: `宇航员每天消耗 ${WATER_USE} 点水。净水机可以补充饮水。净水需要电池。`, actions: [
      action('drink', '给宇航员喝水', '饮水 −2 · 心情 +4 · 每日一次', () => G.water >= 2 && G.morale < 100, () => { G.water -= 2; G.morale = clamp(G.morale + 4, 0, 100); }, '宇航员已喝水。饮水 −2。心情最多 +4。'), bookAction('care', '查看饮水和照护物资')
    ] });
    if (item === 'purifier') return card({ title: '循环净水机', value: `${G.batt}<small>格电池</small>`, description: '净水机会净化回收水。每次消耗 2 格电池。饮水最多增加 12 点。', actions: [
      action('filter', '启动净水', '电池 −2 · 饮水最多 +12 · 每日一次', () => G.batt >= 2 && G.water < 100, () => { G.batt -= 2; G.water = clamp(G.water + 12, 0, 100); }, '净水已完成。电池 −2。饮水最多 +12。'), bookAction('plan', '查看今天的电力')
    ] });
    if (item === 'medicine') return card({ title: '急救药品', value: `${G.meds}<small>份</small>`, description: `宇航员健康为 ${G.health} / 4。药品可以恢复健康和心情。每天最多使用一份。`, actions: [
      action('medicine', '使用一份药品', '药品 −1 · 健康 +1 · 心情 +8', () => G.meds > 0 && (G.health < 4 || G.morale < 100), () => { G.meds--; G.health = clamp(G.health + 1, 0, 4); G.morale = clamp(G.morale + 8, 0, 100); }, '宇航员已使用药品。药品 −1。健康最多 +1。心情最多 +8。'), bookAction('care', '查看宇航员照护记录')
    ] });
    if (item === 'crew') return card({ title: '宇航员 · 阿星', value: `${Math.round(G.morale)}<small>心情</small>`, description: G.morale < 30 || G.water < 10 || G.food < 10 ? '阿星状态较差。请检查食物和饮水。' : G.morale < 60 ? '阿星心情偏低。聊天和加餐可提高心情。' : '阿星状态良好。你可以和宇航员聊天。', actions: [
      action('chat', '陪大家聊一会儿', '心情 +4 · 每日一次', () => G.morale < 100, () => { G.morale = clamp(G.morale + 4, 0, 100); }, '宇航员已聊天。心情最多 +4。'), bookAction('care', '查看宇航员状态')
    ] });
    if (item === 'calendar') return card({ title: '墙上的任务日历', value: `${G.sol}<small>/30 日</small>`, description: `你已完成 ${G.hist.length} 天。今天要保障宇航员生活。还要分配科研电量。`, actions: [bookAction('brief', '翻开今天的手册'), { label: '查看历史记录', hint: '打开事件档案', run: () => { Habitat.closeCard(); bookType = 'archive'; showJournal(true); } }] });
    if (item === 'radio') return card({ title: '地球通讯器', value: G.conj > 0 ? '<small>信号中断</small>' : '<small>信号在线</small>', description: G.conj > 0 ? '太阳干扰了通信。日凌结束后才能收听消息。' : '每天可以收听一条消息。你需要选择处理方法。', actions: [
      { label: G.care.signal ? '今天的消息已经听过' : '收听一条新消息', hint: '触发一个双选事件 · 每日一次', disabled: !!G.care.signal || G.conj > 0, run: () => {
        if (busy || encounterOpen || G.care.signal || G.conj > 0) return;
        G.care.signal = true; busy = true; lockPlanning(true); presentEncounter(nextCabinEvent(), () => { busy = false; lockPlanning(false); renderAll(); renderTodayRecords(); renderArchive(); updateShelf(); Habitat.toast('消息和选择已记入档案。'); $('#todayBook').focus({ preventScroll: true }); }, false);
      } }, { label: '查看事件档案', hint: '回看消息与过去的决定', run: () => { Habitat.closeCard(); bookType = 'archive'; showJournal(true); } }
    ] });
  }
  function nextCabinEvent() {
    const events = [
      { id: 'cabin-garden', kicker: '生活舱的新发现', title: '番茄长出了新叶', body: '番茄已发芽。你可以浇水。也可以记录生长情况。', choices: [
        { t: '给小番茄浇一点水', d: [chip('pwr', '饮水 −3'), chip('sci', '心情 +9')], disabled: G.water < 3 ? '饮水不足' : '', fn: () => { G.water -= 3; G.morale = clamp(G.morale + 9, 0, 100); return '番茄已浇水。饮水 −3。心情最多 +9。'; } },
        { t: '拍照记录生长', d: [chip('sci', '科学 +4')], fn: () => { G.sci += 4; return '生长数据已记录。科学 +4。'; } }
      ] },
      { id: 'cabin-goodnight', kicker: '来自地球的讯息', title: '家人发来了语音', body: '家人发来了语音。你可以播放语音。也可以录制回信。', choices: [
        { t: '播放家人语音', d: [chip('sci', '心情 +8')], fn: () => { G.morale = clamp(G.morale + 8, 0, 100); return '宇航员已收听语音。心情最多 +8。'; } },
        { t: '录一段基地观测回信', d: [chip('sci', '科学 +3'), chip('pwr', '心情 +2')], fn: () => { G.sci += 3; G.morale = clamp(G.morale + 2, 0, 100); return '回信已发送。科学 +3。心情最多 +2。'; } }
      ] },
      { id: 'cabin-pipe', kicker: '管道检查', title: '水管出现气泡', body: '气泡堵住了水管。检修可回收积水。你也可以切换备用管路。', choices: [
        { t: '检修水管', d: [chip('pwr', '电池 −2'), chip('sci', '饮水最多 +12')], disabled: G.batt < 2 ? '电池不足' : '', fn: () => { G.batt -= 2; G.water = clamp(G.water + 12, 0, 100); return '水管已疏通。电池 −2。饮水最多 +12。'; } },
        { t: '切到备用管路', d: [chip('pwr', '饮水 −4')], fn: () => { G.water = Math.max(0, G.water - 4); return '已切换备用管路。饮水 −4。'; } }
      ] },
      { id: 'cabin-package', kicker: '整理储物柜', title: '发现备用补给标签', body: '你发现了一张补给标签。你可以选择药品或食物。', choices: [
        { t: '选择急救药品', d: [chip('sci', '药品最多 +1')], fn: () => { G.meds = Math.min(9, G.meds + 1); return '补给已收到。药品最多 +1。'; } },
        { t: '选择备用食物', d: [chip('food', '食物最多 +8')], fn: () => { G.food = clamp(G.food + 8, 0, 100); return '补给已收到。食物最多 +8。'; } }
      ] },
      { id: 'cabin-cold', kicker: '宇航员照护', title: '阿星需要休息', body: '阿星感到疲劳。你可以使用药品。也可以减少科研工作。', choices: [
        { t: '用一份药品照护', d: [chip('pwr', '药品 −1'), chip('sci', '健康 +1 · 心情 +6')], disabled: G.meds < 1 ? '没有备用药品' : '', fn: () => { G.meds--; G.health = Math.min(4, G.health + 1); G.morale = clamp(G.morale + 6, 0, 100); return '宇航员已使用药品。药品 −1。健康最多 +1。心情最多 +6。'; } },
        { t: '减少科研工作', d: [chip('sci', '科学 −3 · 心情 +4')], fn: () => { G.sci = Math.max(0, G.sci - 3); G.morale = clamp(G.morale + 4, 0, 100); return '宇航员已减少工作。科学 −3。心情最多 +4。'; } }
      ] },
      { id: 'cabin-soup', kicker: '准备晚餐', title: '宇航员想喝热汤', body: '宇航员想喝番茄汤。做汤需要食物和饮水。', choices: [
        { t: '一起做一锅热汤', d: [chip('food', '食物 −3 · 饮水 −2'), chip('sci', '心情 +12')], disabled: G.food < 3 || G.water < 2 ? '食物或饮水不足' : '', fn: () => { G.food -= 3; G.water -= 2; G.morale = clamp(G.morale + 12, 0, 100); return '热汤已做好。食物 −3。饮水 −2。心情最多 +12。'; } },
        { t: '整理科研数据', d: [chip('sci', '科学 +4')], fn: () => { G.sci += 4; return '科研数据已整理。科学 +4。'; } }
      ] },
      { id: 'cabin-photo', kicker: '拍照记录', title: '火星出现晚霞', body: '天空出现了晚霞。阿星准备拍照。', choices: [
        { t: '为宇航员合拍一张照片', d: [chip('sci', '心情 +8')], fn: () => { G.morale = clamp(G.morale + 8, 0, 100); return '宇航员已拍摄合照。心情最多 +8。'; } },
        { t: '拍摄大气与地貌', d: [chip('sci', '科学 +4')], fn: () => { G.sci += 4; return '大气照片已记录。科学 +4。'; } }
      ] }
    ];
    if (!G.cabinDeck.length) G.cabinDeck = shuffle(events.map((_,i) => i));
    return events[G.cabinDeck.shift()];
  }
  function presentEncounter(e, resolved, daily) {
    encounterOpen = true; journalPhase = 'event'; Habitat.closeCard(); showJournal(false);
    if (daily) G.today.eventId = e.id || 'cabin';
    let options = e.choices.slice();
    const defer = { t: '保留资源', d: [chip('none', '不消耗额外物资')], fn: () => '本次未消耗资源。' };
    while (options.length < 2) options.push(defer);
    if (options.every(c => c.disabled)) options[1] = e.choices.find(c => !c.disabled) || defer;
    const panel = $('#dailyEventModal .daily-event-card');
    panel.innerHTML = `<div class="daily-event-kicker"><span>${daily ? '今日事件' : '新消息'}</span><span>SOL ${String(G.sol).padStart(2,'0')}</span></div><h2 id="dailyEventTitle">${e.title}</h2><div id="dailyEventBody" class="event-description">${e.body}</div><div class="event-option-list">${options.map((c,i) => `<button class="event-option" data-option="${i}" ${c.disabled ? 'disabled' : ''}><b>${c.t}</b><span>${c.d.join('')}${c.disabled ? `<span class="chip none">${c.disabled}</span>` : ''}</span></button>`).join('')}</div>${e.real ? `<details class="event-science"><summary>${e.real.label}${e.real.date ? ' · '+e.real.date : ''} ↗</summary><p>${e.real.text}</p><small>${e.real.src}${e.real.est ? ' · 剂量为游戏估算' : ''}</small></details>` : ''}<p class="daily-event-foot">${daily ? '选择会影响今天的资源。电力不足时会减少设备用电。' : '今天只能收听一次消息。你的选择会记入档案。'}</p>`;
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
          const text = c.fn(); G.today.notes.push(`${c.t}：${text}`); return text;
        } });
        result = queued ? '现场任务已添加。请出舱完成工作。' : '设备已经恢复。无需重复处理。本次未扣除资源。';
      } else result = c.fn();
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
        body: `太阳刚刚发生了一次<b>${f.kind}</b>。高能粒子将在<b>几十分钟</b>后到达火星。<br>当前屏蔽为 <b>${G.shieldLv} 级</b>。可挡住这类粒子的 <b>${Math.round((1 - fac) * 100)}%</b>。`,
        real: { label: f.live ? '实时数据 · NASA DONKI' : '真实事件 · NASA DONKI 存档', date: f.date, text: f.note, src: f.src, est: f.doseKind !== 'measured' },
        choices: [
          { t: '全员躲进风暴避难所', d: [chip('dose', `辐射 +${f1(sep * fac * .2)}`), chip('sci', '今天科研暂停'), chip('food', '温室没人照看 −3')],
            fn: () => { T.flareDose = sep * fac * .2; T.sciLock = true; T.shelter = true; G.food = Math.max(0, G.food - 3);
              return '宇航员已进入避难所。墙内的水能减少辐射。今天暂停科研。'; } },
          { t: '照常工作', d: [chip('dose', `辐射 +${f1(sep * fac)}`), chip('sci', '科研照常'), chip('dose', `今天出舱再 +${f1(sep * .5)}`)],
            fn: () => { T.flareDose = sep * fac; T.flareOut = sep * .5;
              return `宇航员继续工作。舱内增加 ${f1(sep * fac)} 毫希辐射。<b>今天出舱会增加额外辐射。</b>`; } },
          { t: '请求地球指导', d: [chip('time', `往返约 ${lt * 2} 分钟`), chip('dose', `辐射 +${f1(sep * fac * .7)}`), chip('sci', '今天科研暂停')], disabled: G.conj > 0 ? '日凌期间无法联系地球' : '',
            fn: () => { T.flareDose = sep * fac * .7; T.sciLock = true;
              return `地球回复需要 ${lt * 2} 分钟。等待期间仍会受到辐射。<b>请根据基地探测器提前选择防护措施。</b>`; } }
        ] };
    },
    stormWarn() {
      World.focus('solar'); Sound.alert();
      return { kicker: '气象预报', title: '沙尘暴明天到达', art: 'storm',
        body: `气象卫星发现沙尘暴。沙尘暴将在<b>明天</b>到达。发电量将降到平时的约三成。预计持续 ${G.stormLen} 天。`,
        real: { label: '真实记录', date: '2018-06', text: `2018 年发生了全球沙尘暴。尘埃厚度 τ 超过 10。靠太阳能的机遇号在 6 月 10 日失去联系。机遇号原计划工作 ${F.opportunityPlanned} 个火星日。实际工作了 ${F.opportunityActual} 个。`, src: 'NASA/JPL 机遇号任务' },
        choices: [
          { t: '把漫游车的电池接进基地', d: [chip('pwr', `风暴期间电池上限 +4`), chip('sci', '漫游车停驶：科学 −4')],
            fn: () => { G.battBonus = 4; G.sci = Math.max(0, G.sci - 4); return '漫游车电池已接入基地。风暴期间最多可存 12 格电。'; } },
          { t: '出舱把太阳能板擦干净', d: [chip('pwr', '清洁度 → 100%'), chip('dose', '辐射 +0.2'), chip('o2', '氧气 −3')],
            fn: () => { G.panelEff = 1; G.dose += .2; G.doseParts.eva += .2; G.o2 = Math.max(0, G.o2 - 3); World.fx('clean'); return '太阳能板已清扫。发电量已提高。'; } },
          { t: '不做准备', d: [chip('none', '现在什么也不花')], fn: () => '本次未增加储备。请检查电池余量。' }
        ] };
    },
    stormStart() {
      G.storm = G.stormLen; G.panelEff = Math.max(.5, G.panelEff - .08); World.setStorm(1); Sound.storm(1); World.focus('solar');
      return { kicker: '沙尘暴', title: '沙尘暴已到达', art: 'storm',
        body: `沙尘暴已到达。接下来 ${G.stormLen} 天发电量会降低。宇航员的氧气消耗不会减少。`,
        real: { label: '真实知识', date: '', text: '火星沙尘暴能覆盖整颗火星。沙尘暴也能持续数周。好奇号和毅力号使用核电池。不依赖太阳能发电。', src: 'NASA 火星探索计划' },
        choices: [
          { t: '进入节能模式', d: [chip('pwr', '每晚供暖少 1 格'), chip('sci', '风暴期间科研暂停')],
            fn: () => { G.stormSave = true; return '已停用两个舱段。每晚供暖少用 1 格电。风暴期间暂停科研。'; } },
          { t: '趁机研究这场沙尘暴', d: [chip('sci', '科学 +8'), chip('pwr', '设备照常耗电')],
            fn: () => { G.sci += 8; return '沙尘暴观测已完成。科学 +8。设备照常耗电。'; } }
        ] };
    },
    dustDevil() {
      World.focus('solar'); Sound.good(); G.today.devil = true;
      return { kicker: '好消息', title: '一股尘卷风扫过了太阳能板', art: 'devil',
        body: `尘卷风吹走了部分灰尘。太阳能板清洁度将从 <b>${Math.round(G.panelEff * 100)}%</b> 提高。`,
        real: { label: '真实记录', date: '2005 起', text: '尘卷风曾吹走勇气号和机遇号太阳能板上的灰尘。这使发电量回升。也帮助它们延长了工作时间。', src: 'NASA/JPL 火星探测漫游车任务' },
        choices: [
          { t: '出舱再仔细擦一遍', d: [chip('pwr', '清洁度 → 105%'), chip('dose', '辐射 +0.2'), chip('o2', '氧气 −3')].concat(G.damaged ? [chip('pwr', '顺便修好损坏的板子')] : []),
            fn: () => { G.panelEff = 1.05; G.damaged = 0; G.dose += .2; G.doseParts.eva += .2; G.o2 = Math.max(0, G.o2 - 3); World.fx('clean'); return '清扫已完成。太阳能板效率提高到 105%。'; } },
          { t: '等待尘卷风清扫', d: [chip('pwr', '清洁度 → 95%')],
            fn: () => { G.panelEff = Math.max(G.panelEff, .95); return '尘卷风已吹走部分灰尘。清洁度至少恢复到 95%。'; } }
        ] };
    },
    o2fault() {
      World.focus('o2'); Sound.alert();
      const hours = (F.moxieTotal / (F.o2PerPerson * 1000) * 24).toFixed(1);
      return { kicker: '设备故障', title: '制氧机过热了', art: 'o2',
        body: '制氧机需要把二氧化碳加热到约 800°C。然后提取氧气。现在温度传感器出现故障。',
        real: { label: '真实测量', date: '2021–2023', text: `毅力号的 MOXIE 是第一台在另一颗星球上制造氧气的机器。MOXIE 运行了 16 次。累计制造 ${F.moxieTotal} 克氧气。每人每天约需 ${F.o2PerPerson} 千克氧气。MOXIE 的这些产量只够一人呼吸约 ${hours} 小时。`, src: 'NASA 毅力号 MOXIE 实验' },
        choices: [
          { t: '立刻抢修', d: [chip('pwr', '今天可用电 −3')], fn: () => { G.today.poolPenalty += 3; G.o2Fault = 2; World.fx('repair'); return '制氧机已修好。今天可用电减少 3 格。'; } },
          { t: '降温运行 3 天', d: [chip('o2', '制氧效率只有 60%（3 天）')], fn: () => { G.o2Mul = .6; G.o2MulDays = 3; G.o2Fault = 1; G.o2FaultDays = 3; return '制氧机已降低功率。接下来 3 天的制氧效率为平时的 60%。'; } },
          { t: '请地球远程诊断', d: [chip('sci', '用掉科研时间：科学 −6'), chip('time', `往返 ${Math.round(LT.minutes * 2)} 分钟`)], disabled: G.sci < 6 || G.conj > 0 ? (G.conj > 0 ? '日凌期间无法联系地球' : '科学成果不够 6 分') : '',
            fn: () => { G.sci -= 6; World.fx('repair'); World.signal(4); return `地球工程师已完成远程诊断。每轮信息往返约需 ${Math.round(LT.minutes * 2)} 分钟。`; } }
        ] };
    },
    delta() {
      World.focus('sci'); Sound.beep();
      const storm = G.storm > 0;
      return { kicker: '科学发现', title: '三角洲发现特殊岩石', art: 'rock',
        body: '漫游车拍到一块带斑点的岩石。岩石位于古老的河流三角洲边缘。这类斑点值得进一步研究。',
        real: { label: '真实发现', date: '2024-07', text: '毅力号在杰泽罗陨石坑发现了“夏耶瓦瀑布”岩石。NASA 在 2025 年 9 月公布了研究结果。岩样可能含有古代生命活动的线索。科学家仍需进一步确认。', src: 'NASA 毅力号任务' },
        choices: [
          { t: '亲自出舱采样', d: [chip('sci', '科学 +18'), chip('dose', '辐射 +0.6'), chip('o2', '氧气 −5')], disabled: storm ? '沙尘暴中不能出舱' : G.evaLock > 0 ? '日凌期间暂停出舱' : '',
            fn: () => { G.sci += 18; G.dose += .6; G.doseParts.eva += .6; G.o2 = Math.max(0, G.o2 - 5); G.sample = true; G.today.evaShow = true; return '岩样已装入密封管。请带回舱内分析。'; } },
          { t: '派漫游车去拍高清照片', d: [chip('sci', '科学 +7'), chip('pwr', '今天可用电 −2')],
            fn: () => { G.sci += 7; G.today.poolPenalty += 2; World.fx('sample'); return '漫游车已拍回照片。科学 +7。今天可用电 −2。'; } },
          { t: '记录岩石位置', d: [chip('none', '不花任何东西')], fn: () => '岩石位置已记录。本次不采样。' }
        ] };
    },
    conjunction() {
      World.focus('antenna'); Sound.alert(); G.conj = 4;
      return { kicker: '通信中断', title: '日凌：太阳挡在了地球和火星中间', art: 'conj',
        body: '接下来 4 天无法联系地球。太阳会干扰无线电信号。',
        real: { label: '真实知识', date: '', text: '地球和火星约每 26 个月会位于太阳两侧。太阳会干扰通信。NASA 通常暂停发送新指令约两周。', src: 'NASA 火星探索计划' },
        choices: [
          { t: '暂停出舱 4 天', d: [chip('sci', '4 天不能出舱')], fn: () => { G.evaLock = 4; return '已暂停出舱。宇航员将在舱内工作 4 天。'; } },
          { t: '照常出舱', d: [chip('o2', '每次出舱有 1/3 机会出意外：氧气 −6')], fn: () => { G.conjRisk = 4; return '已允许出舱。日凌期间无法获得地球支援。'; } }
        ] };
    },
    cold() {
      World.focus('hub'); Sound.alert();
      return { kicker: '气象预报', title: '今晚是这个季节最冷的一夜', art: 'cold',
        body: '气象站预报今晚会降到 −95°C 左右。加热器需要比平时多用 2 格电。',
        real: { label: '真实测量', date: '', text: `毅力号的气象站测得当地夜温可降至约 ${F.nightTemp}°C。火星大气不到地球的 1%。夜间热量会迅速散失。`, src: 'NASA 毅力号 MEDA 气象站' },
        choices: [
          { t: '加热器全开', d: [chip('pwr', '今天可用电 −2')], fn: () => { G.today.heatAdj += 2; return '供暖已增加。今晚多用 2 格电。'; } },
          { t: '关掉温室的灯一晚', d: [chip('food', '正在生长的作物减半')], fn: () => { G.queue = G.queue.map(x => x * .5); World.setFrost(1); World.focus('food'); return '温室已停止照明。未来收成减少一半。'; } },
          { t: '大家挤到一个舱里睡', d: [chip('pwr', '今天可用电 −1'), chip('sci', '睡不好：科学 −3')], fn: () => { G.today.heatAdj += 1; G.today.shelter = true; G.sci = Math.max(0, G.sci - 3); return '宇航员将共用一个舱段。今晚多用 1 格电。科学 −3。'; } }
        ] };
    },
    blight() {
      World.focus('food'); Sound.alert(); G.blight = 1; G.blightFix = false;
      return { kicker: '温室警报', title: '生菜的叶子发黄了', art: 'plant',
        body: '温室湿度过高。霉菌正在蔓延。',
        real: { label: '真实记录', date: '2015–2016', text: '宇航员在 2015 年 8 月首次吃到空间站种植的红叶生菜。之后有百日菊因湿度过高而发霉。宇航员 Scott Kelly 处理了患病植株。', src: 'NASA Veggie 太空菜园实验' },
        choices: [
          { t: '拔掉生病的植株', d: [chip('food', '正在生长的作物 −40%')], fn: () => { G.queue = G.queue.map(x => x * .6); G.cull = Math.min(.6, G.cull + .4); G.blight = .35; World.fx('pull'); return '患病植株已清除。未来收成减少 40%。'; } },
          { t: '加强通风和光照 2 天', d: [chip('pwr', '接下来 2 天每天可用电 −2')], fn: () => { G.drain = 2; G.drainDays = 2; G.blightFix = true; computePool(); return '通风和照明已加强。接下来 2 天每天多用 2 格电。'; } }
        ] };
    },
    resupply() {
      World.focus('pods'); Sound.beep();
      const land = () => { G.pods++; syncWorld(); };
      return { kicker: '来自地球', title: '补给舱要发射了', art: 'ship',
        body: '补给舱只能装一种物资。请选择补给。',
        real: { label: '真实知识', date: '', text: '适合从地球飞往火星的发射窗口约每 26 个月出现一次。基地需要尽量自行生产物资。', src: 'NASA 火星探索计划' },
        choices: [
          { t: '食物', d: [chip('food', '食物 +20')], fn: () => { G.food = Math.min(100, G.food + 20); land(); return '补给舱已降落。食物最多 +20。'; } },
          { t: '制氧机升级件', d: [chip('o2', '以后每格电 +3 氧气（原来 +2.5）')], fn: () => { G.o2Rate = 3; land(); return '制氧机已升级。每格电可生产 3 点氧气。基地增加了两个储氧罐。'; } },
          { t: '屏蔽材料', d: [chip('shield', '屏蔽直接 +1 级')], fn: () => { G.shieldLv = Math.min(5, G.shieldLv + 1); land(); return '屏蔽材料已安装。屏蔽等级最多 +1。'; } }
        ] };
    },
    bones() {
      World.focus('astro');
      return { kicker: '健康检查', title: '医生建议每天锻炼', art: 'health',
        body: `火星重力只有地球的 ${Math.round(F.gravity * 100)}%。低重力会导致骨骼和肌肉流失。每天锻炼可以减缓这种变化。运动也会增加氧气消耗。`,
        real: { label: '真实研究 · NASA OSDR', date: '2019', text: `失重环境中的骨密度流失速度约为${F.boneLoss}。NASA 对比了 Scott Kelly 和他的双胞胎兄弟。Scott 曾在空间站生活近一年。返航半年后仍有约 7% 的基因表达变化未恢复。`, src: 'NASA 双胞胎研究（Garrett-Bakelman 等，2019，Science）；OSDR/GeneLab' },
        choices: [
          { t: '每天加练 1 小时', d: [chip('o2', '以后每天氧气 −1')], fn: () => { G.exercise = 1; return '宇航员已开始加练。空间站宇航员每天通常锻炼约 2 小时。'; } },
          { t: '暂不锻炼', d: [chip('health', '任务结束时健康评分 −1')], fn: () => { G.health -= 1; return '已取消加练。健康评分 −1。'; } }
        ] };
    },
    letter() {
      World.focus('antenna'); Sound.beep();
      const lt = LT.minutes;
      return { kicker: '来自地球', title: '一封来自小学生的信', art: 'letter',
        body: '一所小学的同学们发来了一段视频：“火星上冷吗？你们晚上能看到地球吗？”',
        real: { label: '实时计算', date: new Date().toISOString().slice(0, 10), text: `今天地球距火星约 ${(LT.km / 1e8).toFixed(2)} 亿公里。无线电信号单程约需 ${f1(lt)} 分钟。`, src: 'JPL 行星轨道根数' },
        choices: [
          { t: '录一段视频回信', d: [chip('pwr', '电池 −1'), chip('health', '健康 +1 · 心情 +6')],
            fn: () => { if (G.batt > 0) G.batt--; else G.today.poolPenalty += 1; G.health = Math.min(4, G.health + 1); G.morale = clamp(G.morale + 6, 0, 100); sendSignalDemo(); return `回信已发送。健康最多 +1。心情最多 +6。演示中 1 秒代表 1 分钟。`; } },
          { t: '暂不回复', d: [chip('none', '不花任何东西')], fn: () => '视频被存进了“待回复”文件夹。' }
        ] };
    },
    build() {
      World.focus('overview'); Sound.beep();
      const B2 = G.build, opts = [];
      if (B2.rows < 5) opts.push({ t: '扩建太阳能阵列', d: [chip('pwr', '以后每天发电 +3'), chip('pwr', '今天施工 −2 格')], focus: 'solar',
        fn: () => { B2.rows++; G.today.poolPenalty += 2; return '太阳能板已扩建。每天发电 +3。施工消耗 2 格电。'; } });
      if (B2.domes < 3) opts.push({ t: '再建一座温室', d: [chip('food', '每格电种出的食物 +25%'), chip('pwr', '今天施工 −2 格')], focus: 'food',
        fn: () => { B2.domes++; G.today.poolPenalty += 2; return '温室已建成。每格电的食物产量增加 25%。施工消耗 2 格电。'; } });
      if (B2.labs < 2) opts.push({ t: '加装一个实验舱', d: [chip('sci', '每格电的科学 +0.5'), chip('pwr', '今天施工 −2 格')], focus: 'hub',
        fn: () => { B2.labs++; G.today.poolPenalty += 2; return '实验舱已安装。每格电的科学成果增加 0.5。施工消耗 2 格电。'; } });
      return { kicker: '建设机会', title: '建筑材料已备齐', art: 'ship',
        body: '建筑材料已备齐。请选择一种扩建设施。<b>新设施会改变资源产量。</b>',
        real: { label: '真实研究', date: '', text: 'NASA 正在研究用当地土壤打印建筑。这能减少从地球运输材料的需求。NASA 也举办过相关建筑设计挑战赛。', src: 'NASA 3D-Printed Habitat Challenge' },
        choices: opts.map(o => ({ t: o.t, d: o.d, fn: () => { const r = o.fn(); World.focus(o.focus); syncWorld(); return r; } })) };
    },
    quake() {
      World.focus('solar'); Sound.bad(); G.damaged = 1; World.fx('flashSmall');
      return { kicker: '火星地震', title: '地面晃了一下', art: 'storm',
        body: '一次火星地震让太阳能阵列里的一块板子歪倒了。受损板每天少发 2 格电。',
        real: { label: '真实测量', date: '2022-05-04', text: 'InSight 共记录到 1,300 多次火星地震。最大一次发生于 2022 年 5 月 4 日。震级约为 4.7 级。', src: 'NASA InSight 任务' },
        choices: [
          { t: '马上出舱修好它', d: [chip('pwr', '恢复发电'), chip('dose', '辐射 +0.3'), chip('o2', '氧气 −4')], disabled: G.storm > 0 ? '沙尘暴中不能出舱' : '',
            fn: () => { G.damaged = 0; G.dose += .3; G.doseParts.eva += .3; G.o2 = Math.max(0, G.o2 - 4); World.fx('repair'); syncWorld(); return '太阳能板已修好。发电量已恢复。'; } },
          { t: '暂不维修', d: [chip('pwr', '维修前每天发电 −2')], fn: () => '太阳能板仍有故障。每天少发 2 格电。' }
        ] };
    },
    dirty() {
      World.focus('solar'); Sound.alert();
      return { kicker: '设备提醒', title: '太阳能板越来越脏了', art: 'devil',
        body: `太阳能板正在积灰。当前清洁度为 <b>${Math.round(G.panelEff * 100)}%</b>。灰尘会降低发电量。`,
        real: { label: '真实记录', date: '2022-12', text: 'InSight 在火星工作了四年。太阳能板积灰使发电量下降。InSight 因电力耗尽于 2022 年 12 月结束任务。', src: 'NASA InSight 任务' },
        choices: [
          { t: '出舱清扫', d: [chip('pwr', '清洁度 → 100%'), chip('dose', '辐射 +0.2'), chip('o2', '氧气 −3')].concat(G.damaged ? [chip('pwr', '顺便修好损坏的板子')] : []),
            fn: () => { G.panelEff = 1; G.damaged = 0; G.dose += .2; G.doseParts.eva += .2; G.o2 = Math.max(0, G.o2 - 3); World.fx('clean'); return '太阳能板已清扫。发电量已提高。'; } },
          { t: '等风来吹', d: [chip('none', '清洁度会继续下降')], fn: () => '已选择等待。太阳能板会继续积灰。' }
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
      if (!ExpeditionModel.canAfford(G,cost)) e.choices[i].disabled = '资源不足。请选择其他方案。';
    }
    if (id === 'o2fault') { G.o2Fault = 1; G.o2Mul = .6; G.o2MulDays = 3; G.o2FaultDays = 3;
      const repair = e.choices[0].fn; e.choices[0].fn = () => { const text=repair();G.o2Mul=1;G.o2MulDays=0;G.o2Fault=0;G.o2FaultDays=0;return text; };
      const remote = e.choices[2].fn; e.choices[2].fn = () => {const text=remote();G.o2Mul=1;G.o2MulDays=0;G.o2Fault=0;G.o2FaultDays=0;return text;};
    }
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
      c2: '地球有可供人类呼吸的空气。<br>大气和磁场能减少宇宙辐射。',
      c3: '<span class="big">在火星上需要自己生产氧气和食物。</span>',
      c4: `今天火星距地球 <b>${dist} 亿公里</b>。<br>无线电信号要走 <b>${f1(LT.minutes)} 分钟</b>。`,
      c5: '你要管理这座火星基地。<br>任务持续 <b>30 个火星日</b>。',
      c6: '<span class="big">请给设备分配电力。</span><br>请先检查行动消耗。'
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
      sub: '样本舱已升空。返航飞船将把岩样带回地球。科学家会继续研究这些岩样。',
      caps: [[0, '<span class="big">样本管已经封好。</span>'], [4200, '<span class="big">点火！</span><br>样本舱已发射。']] },
    builder: { title: '开拓者', badge: '开拓者', color: '#d9692f',
      sub: '你已扩建基地。第二批宇航员正在降落。新设施可支持他们继续工作。',
      caps: [[0, '<span class="big">第二批宇航员正在降落。</span>'], [5200, '第二批宇航员到了。<br>他们将使用扩建后的基地。']] },
    guardian: { title: '守护者', badge: '守护者', color: '#3f8f93',
      sub: '宇航员完成了 30 天任务。健康状况良好。辐射剂量低于上限。',
      caps: [[0, '<span class="big">最后一个夜晚。</span>'], [5200, '大家都出来了。<br>头顶亮起了绿色的极光。']] },
    success: { title: '任务成功', badge: '任务成功', color: '#7fae5b',
      sub: '宇航员已完成生存和科学目标。上升器正在将宇航员和数据送往返航飞船。',
      caps: [[0, '<span class="big">全员登舱。</span>'], [6000, '宇航员正在离开火星。']] },
    home: { title: '平安归来', badge: '平安归来', color: '#8cc7c3',
      sub: `宇航员已安全返航。科学成果未达到 ${GOAL} 分。下次可以增加科研或采样任务。`,
      caps: [[0, '<span class="big">全员登舱。</span>'], [6000, '宇航员已安全返航。']] },
    evac: { title: '任务提前结束', badge: '紧急撤离', color: '#b8452a',
      sub: '本次任务已提前结束。请查看资源记录。你可以重新尝试。',
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
    Expedition.finish();
    G.over = true; busy = true; hideTip(); Habitat.closeCard(); setSceneView('exterior'); $('#frame').classList.remove('notebook-open');
    $('#hud').classList.remove('on'); $('#modal').classList.remove('on');
    World.setStorm(0); World.setFrost(0); G.eva = false; G.today.shelter = false; syncWorld({ eva: false, shelter: false });
    const ek = endingKind(kind); G.ending = ek;
    const why = kind === 'win' ? '' : kind === 'o2' ? '氧气快要耗尽了。' : kind === 'food' ? '食物已耗尽。' : kind === 'water' ? '饮用水耗尽了。' : '辐射剂量超过了任务上限。';
    kind === 'win' ? Sound.good() : Sound.bad();
    showCap(kind === 'win' ? '<span class="big">第 30 个火星日。</span><br>任务完成。' : `<span class="big">${why}</span><br>宇航员正在撤离火星。`, 3600);
    const E = ENDINGS[ek];
    setTimeout(() => {
      E.caps.forEach(([t, c]) => setTimeout(() => showCap(c, 3800), t));
      World.ending(ek, () => {
        World.lookEarth();
        const caps = ['画面中的蓝色星球是地球。', '火星基地需要生产氧气和食物。<br>基地还需要电力和辐射防护。', '地球的大气和磁场能减少辐射。<br>地球的水和空气支持生命。', '<span class="big">请保护地球。</span>'];
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
    out.push(`累计辐射为 <b>${f1(G.dose)} 毫希</b>。其中银河宇宙射线贡献 ${f1(dp.gcr)}。太阳风暴贡献 ${f1(dp.sep)}。出舱贡献 ${f1(dp.eva)}。${dp.gcr > dp.sep ? '<b>银河宇宙射线较难阻挡。需要持续做好防护。</b>' : '<b>一次太阳风暴可能增加大量辐射。</b>'}`);
    let mi = 0; G.hist.forEach((d, i) => { if (d.o2 < G.hist[mi].o2) mi = i; });
    if (G.hist.length) { const m = G.hist[mi]; out.push(`第 ${m.sol} 天氧气最低。剩余 <b>${Math.round(m.o2)}%</b>${m.gen <= 5 ? '。当天发生沙尘暴。发电量很低' : ''}。`); }
    if (kind === 'o2') {
      let run = 0, i = G.hist.length - 1; while (i >= 0 && G.hist[i].alloc.o2 * G.o2Rate < O2_USE) { run++; i--; }
      out.push(`<b>发生了什么：</b>最后 ${run} 天的制氧电量不足。宇航员每天至少消耗 ${O2_USE} 点氧气。储备因此持续减少。`);
    }
    if (kind === 'food') out.push('<b>发生了什么：</b>温室需要 3 天才能收获。请在食物耗尽前提前给温室分电。');
    if (kind === 'water') out.push('<b>发生了什么：</b>宇航员每天消耗饮水。请提前启动净水机补充饮水。');
    if (kind === 'dose') out.push('<b>发生了什么：</b>辐射剂量会持续累积。提前升级屏蔽可以减少剂量。太阳风暴期间可进入避难所。');
    if (G.decisions.length) out.push('你做过的关键决定：' + G.decisions.slice(0, 5).map(d => `第 ${d.sol} 天「${d.choice}」`).join('、') + '。');
    return out;
  }
  function showReport(kind) {
    const win = kind === 'win';
    const sciOk = G.sci >= GOAL;
    const E = ENDINGS[G.ending || 'home'];
    const title = E.title, sub = E.sub;
    const all = ['discovery', 'builder', 'guardian'], got = badges(kind);
    const hint = { discovery: `科学成果 ≥ 130。或分析三角洲岩样且科学 ≥ 110`, builder: '建造 3 次扩建（或 2 次 + 屏蔽 4 级）', guardian: '辐射 ≤ 13 毫希。宇航员健康 ≥ 3' };
    const badgeHtml = `<div class="rp-badges">${all.map(k => `<div class="bdg ${got.includes(k) ? 'got' : ''}" style="--c:${ENDINGS[k].color}"><b>${ENDINGS[k].badge}</b><span>${got.includes(k) ? '已达成' : hint[k]}</span></div>`).join('')}</div>`;
    const build = `太阳能板 ${G.build.rows} 排 · 温室 ${G.build.domes} 座 · 实验舱 ${G.build.labs} 个 · 储氧罐 ${tanks()} 个 · 考察旗 ${G.evaCount + (G.sample ? 1 : 0)} 面`;
    const crewO2 = (F.o2PerPerson * 4).toFixed(2);
    const earthYears = (G.dose / F.earthBackground).toFixed(1);
    $('#report').innerHTML = `<div class="rp">
      <div class="rp-k">任务报告 · 杰泽罗前哨站</div>
      <h1><span style="background:linear-gradient(transparent 58%,${E.color} 58%);padding:0 .1em">${title}</span></h1><p class="rp-sub">${sub}</p>
      ${badgeHtml}
      <div class="rp-build">你建起的基地：${build}</div>
      <p class="rp-care">返航时的储备：饮水 ${f1(G.water)} · 药品 ${G.meds} · 宇航员心情 ${Math.round(G.morale)} / 100</p>
      <div class="rp-stats">
        <div><b>${G.hist.length}</b><span>火星日</span></div>
        <div><b>${Math.round(G.sci)}</b><span>科学成果 / ${GOAL}</span></div>
        <div><b>${f1(G.dose)}</b><span>辐射剂量（毫希）</span></div>
        <div><b>${G.shieldLv}</b><span>屏蔽等级</span></div>
        <div><b>${'●'.repeat(clamp(G.health, 0, 4))}${'○'.repeat(4 - clamp(G.health, 0, 4))}</b><span>宇航员健康</span></div>
      </div>
      <div class="rp-chart"><div class="lg"><i style="background:#3f8f93"></i>氧气 <i style="background:#7fae5b"></i>食物 <i style="background:#d9692f"></i>辐射 <i style="background:#e6a83f"></i>科学 <i class="ev"></i>事件</div>${chartSVG()}</div>
      <div class="rp-cols">
        <div><h3>任务结果说明</h3><ul>${insights(kind).map(x => `<li>${x}</li>`).join('')}</ul></div>
        <div><h3>和真实世界对比</h3><ul>
          <li>你的 4 人宇航员每天需要约 <b>${crewO2} 千克</b>氧气。毅力号的 MOXIE 三年一共造了 <b>${F.moxieTotal} 克</b>。</li>
          <li>本次 ${G.hist.length} 天的辐射剂量相当于地球平均天然辐射的 <b>${earthYears} 年</b>。NASA 规定宇航员一生最多 <b>${F.careerLimit} 毫希</b>。</li>
          <li>机遇号原计划工作 ${F.opportunityPlanned} 个火星日。实际工作了 <b>${F.opportunityActual}</b> 个。之后因沙尘暴失去联系。</li>
        </ul></div>
      </div>
      <div class="rp-end">火星基地需要持续生产氧气。请根据资源记录调整下一次分配。</div>
      <div class="rp-btns"><button class="btn big" id="bAgain">再来一次</button><button class="btn" id="bSrc2">数据来源</button></div>
    </div>`;
    $('#report').classList.add('on');
    $('#bAgain').onclick = () => { Sound.click(); $('#report').classList.remove('on'); World.reset(); newGame(); $('#hud').classList.add('on'); setSceneView('interior'); beginSol(); };
    $('#bSrc2').onclick = openSources;
  }

  /* ======================= 数据来源 / 通信 ======================= */
  function openSources() {
    const L = DATA.live;
    const liveHtml = L.status === 'ok' ? (L.flares.length ? `<b class="ok">● 已连接</b> 最近 30 天记录到 <b>${L.flares.length}</b> 次耀斑。最强的几次：${L.flares.slice(0, 5).map(f => `<span class="chip pwr">${f.cls} · ${f.peak.slice(0, 10)}</span>`).join(' ')}` : '<b class="ok">● 已连接</b> 最近 30 天没有记录到耀斑。')
      : L.status === 'loading' ? '正在连接 NASA DONKI……' : '<b class="bad">● 未连接</b> 当前无法连接 NASA。游戏将使用历史事件存档。';
    $('#srcCard').innerHTML = `<button class="x" id="srcX" aria-label="关闭">×</button>
      <div class="rp-k">数据来源与说明</div><h2>数据来源</h2>
      <div class="live">${liveHtml}</div>
      <div class="live">今天（${new Date().toISOString().slice(0, 10)}）地球到火星：<b>${(LT.km / 1e8).toFixed(2)} 亿公里</b>。信号单程 <b>${f1(LT.minutes)} 分钟</b>。按 JPL 行星轨道根数实时计算。</div>
      <div class="src-list">${DATA.sources.map(s => `<div class="src"><span class="r-tag">${s.tag}</span><h4>${s.title}</h4><p>${s.body}</p><a href="${s.link}" target="_blank" rel="noopener">${s.link.replace('https://', '')}</a></div>`).join('')}</div>
      <h3>游戏做了哪些简化</h3><ul class="simp">${DATA.simplifications.map(s => `<li>${s}</li>`).join('')}</ul>
      <h3>给老师和家长</h3>
      <p class="teach">游戏规则：<br>① 每格电只能分给一个设备。<br>② 温室需要 3 天才能收获。<br>③ 请在太阳风暴前升级屏蔽。<br>④ 地球回复需要时间。请先检查本地数据。</p>`;
    $('#sources').classList.add('on');
    $('#srcX').onclick = () => $('#sources').classList.remove('on');
  }
  function openComm() {
    if (!G) return;
    const blocked = G.conj > 0;
    $('#mcard').innerHTML = `<div class="ev-art art-letter"><div class="ev-k">与地球通信</div></div>
      <h2>${blocked ? '日凌期间通信中断' : `信号单程 ${f1(LT.minutes)} 分钟`}</h2>
      <p class="ev-b">今天地球距火星约 <b>${(LT.km / 1e8).toFixed(2)} 亿公里</b>。无线电信号仍需 <b>${f1(LT.minutes)} 分钟</b>。一次信息往返至少需要 <b>${f1(LT.minutes * 2)} 分钟</b>。地火最近时单程约需 3 分钟。最远时约需 22 分钟。</p>
      <div class="choices"><button class="btn go" id="cmSend" ${blocked ? 'disabled' : ''}>发一句「你好，地球」</button><button class="btn" id="cmX">关闭</button></div>`;
    $('#modal').classList.add('on'); World.focus('antenna');
    $('#cmX').onclick = () => { $('#modal').classList.remove('on'); World.focus('overview'); };
    const s = $('#cmSend'); if (s) s.onclick = () => { $('#modal').classList.remove('on'); sendSignalDemo(); };
  }

  /* ======================= 启动 ======================= */
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
    $('#bSnd').onclick = () => { Sound.init(); const on = Sound.toggle(); $('#bSnd').textContent = on ? '声音：开' : '声音：关'; };
    $('#bSnd').textContent = Sound.on ? '声音：开' : '声音：关';
    $('#bComm').textContent = `地球 · ${f1(LT.minutes)} 分钟`;
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
    tl.innerHTML = `今天地球到火星 <b>${(LT.km / 1e8).toFixed(2)} 亿公里</b> · 信号要走 <b>${f1(LT.minutes)} 分钟</b><br><span id="tDonki">正在读取 NASA 太空天气……</span>`;
    DATA.fetchDonki().then(L => {
      const d = $('#tDonki');
      if (L.status === 'ok') d.innerHTML = L.flares.length ? `NASA DONKI 实时：最近 30 天太阳爆发了 <b>${L.flares.length}</b> 次耀斑，最高等级为 <b>${L.flares[0].cls}</b>` : 'NASA DONKI 实时：最近 30 天暂无耀斑记录';
      else d.textContent = '离线模式：使用 NASA DONKI 存档中的真实事件';
      if (!G.over && G.sol === 1 && !$('#hud').classList.contains('on')) newGame(); // 拿到实时数据后重新排一次事件
    });
  }
  boot();
  if (/debug/.test(location.search)) window.__dbg = { G: () => G, endGame, syncWorld, renderAll, beginSol, startGame, newGame, openEvent, preview, endSol };
})();
