/* Direct scene actions, physical jobs and the case-based first day. */
window.Expedition = (() => {
  const $ = s => document.querySelector(s);
  let api, model = ExpeditionModel.create(), outside = false, activity = null, choiceOpen = false, lastGuide = '', moved = 0, lastPos, hazardNotified=false;
  let releaseStick = () => {};
  const guide = {
    filter: ['先给基地补一点水', '伙伴口渴了。点净水机，看看一格格电怎样变成干净的水。', 'purifier'],
    drink: ['把水分享给伙伴', '水位升高了！现在点饮水桶，倒一杯水，看看伙伴的表情。', 'water'],
    console: ['找出电少的原因', '点电力台：太阳能板积了灰，还有一个接头松了。设备需要我们帮忙。', 'console'],
    depart: ['带上工具，准备出发', '点舱门检查天气和氧气。出去一趟会用掉氧气，但看说明不会额外消耗。', 'door'],
    move: ['你来带路！', '用 WASD / 方向键移动，触屏用左下摇杆。先走到附近发光的练习点。拖动画面可以转头。'],
    clean: ['太阳能板在等你', '沿着金色标记走到太阳能板旁，按 E 或“开始清扫”，用刷子擦掉灰尘。'],
    repair: ['接头也要接好', '仍在板子旁，选择“固定松脱接头”。把部件接回正确位置，再看看发电量。'],
    return: ['把好消息带回家', '发电恢复了！沿舱门标记走回基地，靠近后按 E 回舱。'],
    allocate: ['把电分给需要的设备', '点电力台，给制氧至少 3 格电。氧气会在今晚结算，温室要等三天才能收获。', 'console'],
    sleep: ['第一天，做得不错', '点床看看今晚的收支，再确认休息。明天你就能自己安排探索了！', 'bed']
  };
  const costText = c => [c.o2 ? `氧气 −${c.o2}` : '', c.dose ? `辐射 +${Math.round(c.dose * 100) / 100}` : '', c.power ? `可用电 −${c.power}` : ''].filter(Boolean).join(' · ') || '不额外消耗物资';
  function paused() { return !api.canAct() || activity || choiceOpen || !$('#notebook').hidden || !$('#itemPopover').hidden || document.hidden; }
  function refresh() { api.refresh(); render(api.state()); }
  function notify(action) { model.notify(action); renderGuide(); }
  function showChoice(title, body, buttons) {
    choiceOpen = true; World.setPlayerInput(false);
    $('#fieldDialog').hidden = false;
    $('#fieldDialog').innerHTML = `<section class="field-card" role="dialog" aria-modal="true" aria-labelledby="fieldTitle"><span class="field-eyebrow">JEZERO · 小小任务指挥官</span><h2 id="fieldTitle">${title}</h2><div class="field-description">${body}</div><div class="field-choices">${buttons.map((b,i)=>`<button data-choice="${i}" class="field-button ${i===0?'primary':''}" ${b.disabled?'disabled':''}>${b.label}</button>`).join('')}</div></section>`;
    $('#fieldDialog').querySelectorAll('[data-choice]').forEach(el => el.onclick = () => { const b=buttons[+el.dataset.choice]; if(b.disabled)return; closeDialog(); b.run(); });
    $('#fieldDialog button:not(:disabled)')?.focus({preventScroll:true});
  }
  function closeDialog() { choiceOpen=false;$('#fieldDialog').hidden=true;$('#fieldDialog').innerHTML=''; }
  function markers() {
    if (!outside) return World.setMarkers([]);
    const entries = [{target:'door'}];
    const targets = new Set();
    model.tasks.filter(t=>t.phase!=='done').forEach(t=>{ if(!targets.has(t.target)){entries.push({target:t.target});targets.add(t.target);} });
    if(model.guide.active && model.step==='move')entries.push({target:'walk'});
    World.setMarkers(entries);
  }
  function addTask(task) { model.add(task); markers(); render(api.state()); }
  function queueWork(task) {
    if(task.needed && !task.needed(api.state()))return false;
    model.tasks.filter(t=>t.id.startsWith('maintenance-') && t.phase!=='done' && t.kind===task.kind && t.target===task.target).forEach(t=>{t.phase='done';t.resolved=true;});
    addTask(task);
    Habitat.toast('任务已标在基地外。到设备旁亲手完成它。');
    return true;
  }
  function newDay(g) {
    outside=false; World.setPlayerActive(false); lastPos=null;moved=0;hazardNotified=false;
    model.tasks=model.tasks.filter(t=>t.phase!=='done' && !t.daily);
    if(g.sol>1)model.skip();
    if(g.sol===1){
      model=ExpeditionModel.create();
      addTask({id:'first-clean',title:'清扫太阳能板',kind:'clean',target:'solar',cost:{},needed:g=>g.panelEff<1,complete:()=>api.effect(()=>{g.panelEff=1;World.fx('clean');},'板面干净了！太阳能板清洁度恢复到 100%。')});
      addTask({id:'first-repair',title:'固定松脱接头',kind:'repair',target:'solar',cost:{},needed:g=>g.damaged>0,complete:()=>api.effect(()=>{g.damaged=0;World.fx('repair');},'接头固定了，发电恢复！')});
      showChoice('欢迎来到火星，今天你来值班。', '<p>伙伴口渴了，基地的电也有点少。</p><p>一起找出原因：照顾伙伴，穿上宇航服，亲手把太阳能板修好。</p><p class="field-note">第一天就是正式任务的一部分。没有操作倒计时，可以慢慢学。</p>', [
        {label:'跟着学，开始第一天 →',run:()=>{model.guide.active=true;model.guide.index=0;renderGuide();}},
        {label:'我会玩，跳过教程',run:()=>{model.skip();renderGuide();Habitat.toast('自由安排第一天；清扫和维修任务仍可完成。');}}
      ]);
    }
    const maintenance = (kind,target,needed,title,cost,complete) => {
      if(needed(g) && !model.tasks.some(t=>t.phase!=='done' && t.kind===kind && t.target===target)) addTask({id:`maintenance-${kind}-${target}-${g.sol}`,kind,target,needed,title,cost,complete});
    };
    maintenance('clean','solar',g=>g.panelEff<.98,'清扫积灰的太阳能板',{o2:3,dose:.2},()=>api.effect(()=>{g.panelEff=1;g.o2-=3;g.dose+=.2;g.doseParts.eva+=.2;World.fx('clean');},'清扫完成：清洁度恢复 100%，氧气 −3，辐射 +0.2。'));
    maintenance('repair','solar',g=>g.damaged>0,'修复受损太阳能板',{o2:4,dose:.3},()=>api.effect(()=>{g.damaged=0;g.o2-=4;g.dose+=.3;g.doseParts.eva+=.3;World.fx('repair');},'太阳能板修好了：氧气 −4，辐射 +0.3，发电恢复。'));
    maintenance('repair','o2',g=>g.o2Fault>0,'修复制氧机传感器',{power:3},()=>api.effect(()=>{g.today.poolPenalty+=3;g.o2Fault=0;g.o2FaultDays=0;g.o2Mul=1;g.o2MulDays=0;World.fx('repair');},'传感器恢复正常：今天可用电 −3，制氧效率恢复。'));
    addTask({id:`survey-${g.sol}`,title:'观察今日地貌',kind:'survey',target:'survey',daily:true,cost:{},complete:()=>api.effect(()=>{g.sci+=6;g.evaCount++;},'地貌观察完成，科学 +6。这个观察点今天已记录。')});
    render(g);
  }
  function requestDeparture() {
    if(outside)return;
    if(!api.canAct() || activity || choiceOpen)return;
    const g=api.state(), blocked=api.blockReason(), cost={o2:3,dose:.25+g.today.flareOut};
    showChoice('准备好，走出舱门。', `<div class="departure-weather ${blocked?'warning':''}">${blocked?'⛔ '+blocked:g.today.flareOut?'☀️ 太阳活跃，今天出舱辐射更高':'☀️ 天气适合出发'}</div><p>这一趟：<b>${costText(cost)}</b></p>${g.conjRisk>0?'<p class="departure-weather warning">日凌中，每次出舱约有 1/3 的机会漏掉额外 6 点氧气。</p>':''}<p>氧气 ${Math.round(g.o2)} → ${Math.round((g.o2-3)*10)/10}；累计辐射 ${g.dose.toFixed(2)} → ${(g.dose+cost.dose).toFixed(2)} / 25 mSv。</p><p class="field-note">固定按一趟计算。走路、看说明和调镜头不会继续扣氧气。数值为游戏简化值。</p>`,[
      {label:blocked || (!ExpeditionModel.canAfford(g,cost)?'补足氧气，或降低辐射风险后再来':'带上工具，出发 →'),disabled:!!blocked || !ExpeditionModel.canAfford(g,cost),run:()=>{
        if(api.blockReason() || !ExpeditionModel.canAfford(g,cost))return;
        const actual=ExpeditionModel.departureCost(g,Math.random());
        api.effect(()=>{g.o2=Math.max(0,g.o2-actual.o2);g.dose+=actual.dose;g.doseParts.eva+=.25;g.doseParts.sep+=g.today.flareOut;g.eva=true;},`出舱准备完成：${costText(actual)}。${actual.leak?'日凌期间宇航服阀门意外漏气，伙伴修好了它，多消耗了 6 点氧气。':''}`);
        outside=true;api.view('exterior');World.resetPlayer();World.setPlayerActive(true);lastPos=World.getPlayer();notify('depart');markers();render(g);
      }}, {label:'还要准备一下',run:()=>{}}
    ]);
  }
  function returnHome(rescue=false) {
    if(!outside || activity || choiceOpen)return;
    const p=World.getPlayer(), door=World.getSite('door');
    if(!rescue && Math.hypot(p.x-door.x,p.z-door.z)>4){Habitat.toast('先走回发光的舱门，再按 E 回家。右上角可以查看回舱方向。');return;}
    outside=false;World.setPlayerActive(false);model.returnSamples();api.effect(()=>{api.state().eva=false;},'回到生活舱，带回的样品已放上实验台。');api.view('interior');notify('return');markers();render(api.state());
  }
  function showMap() {
    if(!outside)return requestDeparture();
    const p=World.getPlayer(), rows=[['舱门','door'],...model.tasks.filter(t=>t.phase!=='done').map(t=>[t.title,t.target])];
    showChoice('抬头看看，基地就在这里。',`<p>金色光圈是可以到达的工作点。拖动画面转头，“镜头回正”能帮你找回方向。</p><ul>${rows.map(([name,target])=>{const s=World.getSite(target);return `<li>${name}：约 ${Math.round(Math.hypot(p.x-s.x,p.z-s.z))} 米</li>`;}).join('')}</ul>`,[
      {label:'继续探索',run:()=>{}},{label:'我迷路了，带我到舱门',run:()=>{World.resetPlayer();Habitat.toast('已到舱门外，按 E 回舱。任务和资源保持原样。');}}
    ]);
  }
  function startTask(t) {
    if(!outside || paused() || !t || t.phase==='done')return;
    if(model.guide.active && ['move','clean'].includes(model.step) && t.id==='first-repair'){Habitat.toast('先擦掉灰尘，再固定接头。');return;}
    const p=World.getPlayer(),s=World.getSite(t.target);
    if(Math.hypot(p.x-s.x,p.z-s.z)>4.5)return;
    if(!ExpeditionModel.canAfford(api.state(),t.cost)){Habitat.toast('完成这项工作需要更多物资。先回舱准备，任务会为你保留。');return;}
    model.start(t.id);activity=t;World.setPlayerInput(false);
    const type=t.kind;
    let art='';
    if(type==='clean') art=`<div class="clean-board" id="cleanBoard" role="group" aria-label="在太阳能板上拖动刷子擦灰"><div class="panel-grid"></div>${Array.from({length:18},(_,i)=>`<div class="dust-patch" data-dust="${i}" style="left:${i%6/6*100}%;top:${Math.floor(i/6)/3*100}%"></div>`).join('')}<span class="brush-hint">按住，来回擦一擦 🧹</span></div><label class="work-progress">清洁进度 <progress id="workProgress" max="18" value="0"></progress></label>`;
    else if(type==='repair') art=`<div class="repair-board"><div class="repair-machine"><span class="repair-lamp"></span><b>供电接头</b><div class="wire left-wire"></div><button class="connector" id="looseConnector" aria-label="拿起松脱接头">🔌<small>松脱的接头</small></button><button class="socket" id="repairSocket" disabled aria-label="把接头接回接口">◉<small>接回这里</small></button></div></div><p id="repairInstruction">① 点松脱的接头，把它拿起来。</p><button class="field-button" id="fasten" disabled>③ 拧紧固定环</button>`;
    else art=`<div class="sample-board"><span class="sample-rock">🪨</span><div class="scan-line"></div><span id="sampleVisual">等待扫描</span></div><p id="sampleInstruction">先扫描，看看我们发现了什么。</p><button class="field-button" id="scanRock">① 扫描${type==='survey'?'地貌':'岩石'}</button><button class="field-button" id="collectRock" disabled>② ${type==='survey'?'记录观察':'将岩样装进密封盒'}</button>`;
    $('#fieldDialog').hidden=false;
    $('#fieldDialog').innerHTML=`<section class="field-card work-card" role="dialog" aria-modal="true" aria-labelledby="fieldTitle"><span class="field-eyebrow">现场工作 · ${type==='clean'?'清扫':type==='repair'?'维修':'探索'}</span><h2 id="fieldTitle">${t.title}</h2><p class="field-note">完成时：${costText(t.cost)}。可以暂停，回来接着做。</p>${art}<div class="field-choices"><button class="field-button primary" id="finishWork" disabled>完成工作 ✓</button><button class="field-button" id="cancelWork">先放下工具</button></div></section>`;
    $('#cancelWork').onclick=()=>{model.cancel(t.id);activity=null;$('#fieldDialog').hidden=true;render(api.state());};
    $('#finishWork').onclick=()=>finishWork(t);
    const done=()=>{$('#finishWork').disabled=false;};
    if(type==='clean'){
      const board=$('#cleanBoard'), erased=new Set(); let brushing=false;
      const brush=e=>{if(!brushing)return;const r=board.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
        board.querySelectorAll('[data-dust]').forEach(patch=>{const i=+patch.dataset.dust;if(Math.hypot((i%6+.5)/6-x,(Math.floor(i/6)+.5)/3-y)<.28){erased.add(i);patch.classList.add('erased');}});
        $('#workProgress').value=erased.size;if(erased.size===18){board.classList.add('clean');done();}
      };
      board.onpointerdown=e=>{brushing=true;board.setPointerCapture(e.pointerId);brush(e);};board.onpointermove=brush;
      board.onpointerup=board.onpointercancel=()=>{brushing=false;};
      board.tabIndex=0; board.setAttribute('aria-label','拖动刷子清扫；也可以按住空格擦洗');
      board.onkeydown=e=>{if(e.code==='Space'){e.preventDefault();const patch=board.querySelector('[data-dust]:not(.erased)');if(patch){patch.classList.add('erased');erased.add(+patch.dataset.dust);$('#workProgress').value=erased.size;}if(erased.size===18){board.classList.add('clean');done();}}};
    } else if(type==='repair'){
      $('#looseConnector').onclick=()=>{$('#looseConnector').classList.add('picked');$('#repairSocket').disabled=false;$('#repairInstruction').textContent='② 点圆形接口，把接头接回去。';};
      $('#repairSocket').onclick=()=>{$('#repairSocket').classList.add('connected');$('#fasten').disabled=false;$('#repairInstruction').textContent='接上了！再拧紧固定环，别让它松开。';};
      $('#fasten').onclick=()=>{$('.repair-lamp').classList.add('working');$('#repairInstruction').textContent='连接牢固，指示灯亮了！';$('#fasten').disabled=true;done();};
    } else {
      $('#scanRock').onclick=()=>{$('#scanRock').disabled=true;$('.sample-board').classList.add('scanned');$('#sampleVisual').textContent=type==='survey'?'地貌扫描完成':'找到了可采集的岩样';$('#collectRock').disabled=false;$('#sampleInstruction').textContent=type==='survey'?'把这次观察记入档案。':'把岩样放进盒子，回舱后还要分析。';};
      $('#collectRock').onclick=()=>{$('#collectRock').disabled=true;$('.sample-board').classList.add('collected');$('#sampleVisual').textContent=type==='survey'?'观察已记录':'📦 岩样已密封';done();};
    }
    $('#fieldDialog button:not(:disabled)')?.focus({preventScroll:true});
  }
  function finishWork(t) {
    if(activity!==t || $('#finishWork').disabled)return;
    if(!ExpeditionModel.canAfford(api.state(),t.cost)){Habitat.toast('物资不足，先回舱准备。工作尚未结算。');return;}
    const g=api.state(), before=g.sci;
    if(!model.finish(t.id))return;
    if(t.kind==='sample'){
      const reward=Math.max(0,g.sci-before);g.sci=before;g.sample=false;model.collect(t.id,reward);
      g.today.notes.pop();
      g.today.notes.push('样品已装入背包。回舱分析后才能得到科学成果。');
    }
    activity=null;$('#fieldDialog').hidden=true;notify(t.kind==='clean'?'clean':t.kind==='repair'?'repair':t.kind);markers();refresh();
    Habitat.toast(t.kind==='sample'?'岩样收好了！回舱放上实验台。':'工作完成！看看设备和资源的变化。');
  }
  function analyse() {
    if(outside || !api.canAct())return;
    const s=model.samples.find(s=>s.status==='stored'),g=api.state();
    if(!s)return Habitat.toast(model.samples.some(s=>s.status==='carried')?'先把背包里的样品带回舱。':'实验台还没有待分析样品。出去找找标记的岩石吧！');
    showChoice('看看岩样里面藏着什么。',`<p>分析要用 <b>2 格可用电</b>，完成获得科学 <b>+${s.reward}</b>。</p><p>岩石留下了古老水流与矿物变化的线索。线索需要继续验证，不能直接证明存在生命。</p>`,[
      {label:g.pool<2?'可用电不足，先调整安排':'启动分析',disabled:g.pool<2,run:()=>{
        if(g.pool<2)return;const reward=model.analyse(s.id);if(!reward)return;
        api.effect(()=>{g.today.poolPenalty+=2;g.sci+=reward;g.sample=true;},`岩样分析完成：可用电 −2，科学 +${reward}。`);refresh();
      }},{label:'先放好，待会儿分析',run:()=>{}}
    ]);
  }
  function sleep() {
    if(outside)return Habitat.toast('先回到生活舱，再休息。');
    if(!api.canAct() || choiceOpen)return;
    const g=api.state(),p=api.preview();
    showChoice('今天辛苦了，准备休息吗？',`<p>今晚按电力安排运行设备，明天会变成：</p><div class="night-ledger"><span>氧气 <b>${Math.max(0,g.o2+p.o2).toFixed(1)}</b></span><span>食物 <b>${Math.max(0,g.food+p.food).toFixed(1)}</b></span><span>饮水 <b>${Math.max(0,g.water-2.5).toFixed(1)}</b></span><span>科学 <b>${(g.sci+p.sci).toFixed(1)}</b></span></div><p>${p.o2<0?'⚠️ 今晚氧气会减少，先给制氧多分一点电。':'制氧正在按计划工作。'} 温室今天投入的电，三天后才会变成收成。</p>`,[
      {label:'确认安排，好好休息 →',run:()=>{notify('sleep');api.endDay();}},
      {label:'再看一下电力安排',run:()=>{api.plan();notify('console');}}
    ]);
  }
  function renderGuide() {
    const card=$('#missionGuide');if(!card)return;
    document.querySelectorAll('.tutorial-target').forEach(e=>e.classList.remove('tutorial-target'));
    const active=model.guide.active && api.state().sol===1 && !api.state().over;
    $('#bookSkipGuide').hidden=!active;
    $('#fieldHud').classList.toggle('guided',active);
    $('#fieldHud').classList.toggle('guide-on-left',active && !outside && ['filter','drink','sleep'].includes(model.step));
    card.hidden=!active;
    if(!active){lastGuide='';return;}
    const step=model.step,g=guide[step];if(!g)return;
    let powerHint=$('#powerGuideHint');
    if(!powerHint && $('#power .p-h')){powerHint=document.createElement('p');powerHint.id='powerGuideHint';powerHint.className='field-note';$('#power .p-h').appendChild(powerHint);}
    if(powerHint)powerHint.textContent=step==='allocate'?'给制氧至少 3 格电，然后点“安排好了”。':'一格电只能分给一个设备。先看看制氧要用几格。';
    if(step!==lastGuide){
      card.innerHTML=`<span class="field-eyebrow">第一天 · 边做边学 ${model.guide.index+1} / 10</span><h3>${g[0]}</h3><p>${g[1]}</p><div><button id="guideLocate" class="field-button">${g[2]?'找到它 →':'看看任务地图'}</button><button id="skipGuide" class="text-button">跳过剩余引导</button></div>`;
      $('#skipGuide').onclick=()=>{model.skip();renderGuide();markers();Habitat.toast('引导已收起，继续自由探索。');};
      $('#guideLocate').onclick=()=>{if(g[2]){const el=document.querySelector(`[data-object="${g[2]}"]`);if(el){el.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});el.focus({preventScroll:true});api.inspect(g[2],el);}}else showMap();};
      lastGuide=step;markers();
    }
    if(g[2])document.querySelector(`[data-object="${g[2]}"]`)?.classList.add('tutorial-target');
  }
  function render(g) {
    if(!$('#fieldHud'))return;
    if(model.reconcile(g))markers();
    const active=$('#hud').classList.contains('on') && !g.over;
    $('#fieldHud').hidden=!active;$('#fieldControls').hidden=!outside || !active;$('#fieldStats').hidden=!outside;
    $('#fieldStats').innerHTML=`<span>🫧 氧气 <b>${Math.round(g.o2)}</b></span><span>⚡ 可用电 <b>${g.pool}</b></span><span>☀ 辐射 <b>${g.dose.toFixed(1)} /25</b></span>`;
    $('#missionWeather').textContent=g.storm>0?'🌪 沙尘暴 · 留在仓内':g.today?.flareOut?'☀ 太阳活跃 · 注意辐射':'☀ 天气平静';
    const pending=model.tasks.filter(t=>t.phase!=='done');
    $('#missionTasks').innerHTML=pending.slice(0,5).map(t=>`<li><span>${t.kind==='repair'?'🔧':t.kind==='clean'?'🧹':'🔎'}</span>${t.title}<small>${outside?'到金色标记旁':'经舱门出发'}</small></li>`).join('') || '<li>✓ 今日舱外工作已完成</li>';
    $('#carriedSamples').textContent=model.samples.some(s=>s.status==='carried')?'📦 背包：有岩样，记得带回舱':model.samples.some(s=>s.status==='stored')?'🔬 实验台：有样品待分析':'';
    Habitat.samples?.(model.samples);
    renderGuide();
  }
  function nearest() {
    const p=World.getPlayer(), candidates=[{id:'door',title:'回到生活舱',target:'door'},...model.tasks.filter(t=>t.phase!=='done')];
    let closest=null,distance=Infinity;
    for(const t of candidates){const s=World.getSite(t.target),d=Math.hypot(p.x-s.x,p.z-s.z);if(d<distance){distance=d;closest=t;}}
    return {task:closest,distance};
  }
  function interact() {
    if(!outside || paused())return;
    if(model.guide.active && model.step==='move'){const p=World.getPlayer(),s=World.getSite('walk');if(Math.hypot(p.x-s.x,p.z-s.z)<4){notify('move');return;}}
    const n=nearest();if(n.distance>4.5)return;
    if(n.task.id==='door')returnHome();else startTask(n.task);
  }
  function loop() {
    if(outside){
      const pause=!!paused();World.setPlayerInput(!pause);
      if(pause)releaseStick();
      const p=World.getPlayer();if(lastPos)moved+=Math.hypot(p.x-lastPos.x,p.z-lastPos.z);lastPos=p;
      if(model.guide.active && model.step==='move'){const s=World.getSite('walk');if(moved>3 && Math.hypot(p.x-s.x,p.z-s.z)<4){notify('move');markers();}}
      const n=nearest(),close=n.distance<=4.5;
      const action=$('#nearbyAction');action.disabled=!close || pause; action.textContent=close?`E · ${n.task.title}`:`走向金色标记 · ${Math.round(n.distance)} 米`;
      const door=World.getSite('door'),angle=Math.atan2(door.x-p.x,door.z-p.z)-p.yaw;
      $('#homeDirection').innerHTML=`<span style="display:inline-block;transform:rotate(${-angle}rad)">↓</span> 舱门 ${Math.round(Math.hypot(door.x-p.x,door.z-p.z))} 米`;
      const target=model.guide.active && model.step==='move' ? {target:'walk',title:'练习点'} : model.tasks.find(t=>t.phase!=='done');
      if(target){const s=World.getSite(target.target),a=Math.atan2(s.x-p.x,s.z-p.z)-p.yaw;$('#objectiveDirection').innerHTML=`<span style="display:inline-block;transform:rotate(${-a}rad)">↓</span> ${target.title} · ${Math.round(Math.hypot(s.x-p.x,s.z-p.z))} 米`;}else $('#objectiveDirection').textContent='✓ 今天的探索已完成，可以回舱了';
      if(api.blockReason() && !pause && !hazardNotified){hazardNotified=true;showChoice('天气变了，先回基地。','<p>安全更重要。可以沿标记返回，也可以呼叫伙伴接你回舱。</p>',[{label:'伙伴接我回舱',run:()=>returnHome(true)},{label:'我沿标记走回去',run:()=>{}}]);}
    }
    requestAnimationFrame(loop);
  }
  function init(adapter) {
    api=adapter;
    const root=document.createElement('div');root.id='expeditionUI';root.innerHTML=`<div id="fieldHud" hidden><aside class="mission-card"><span class="field-eyebrow" id="missionWeather"></span><h3>今天，去做点什么？</h3><ul id="missionTasks"></ul><p id="carriedSamples"></p></aside><div id="fieldStats" hidden></div><aside id="missionGuide" hidden></aside></div><div id="fieldControls" hidden><div id="objectiveDirection"></div><div id="homeDirection"></div><div class="camera-tools"><button id="fieldMap">基地地图</button><button id="cameraReset">镜头回正</button></div><div id="touchStick" aria-label="移动摇杆"><span></span></div><div class="field-help">WASD / 方向键移动 · 拖动画面转头</div><button id="nearbyAction" disabled></button></div><div id="fieldDialog" hidden></div>`;
    $('#frame').appendChild(root);
    const bookSkip=document.createElement('button');bookSkip.id='bookSkipGuide';bookSkip.className='text-button';bookSkip.textContent='跳过引导';bookSkip.hidden=true;bookSkip.onclick=()=>{model.skip();renderGuide();};$('#closeBook').before(bookSkip);
    $('#nearbyAction').onclick=interact;$('#fieldMap').onclick=showMap;$('#cameraReset').onclick=()=>{World.controller.yaw=0;World.controller.pitch=.38;World.controller.clear();};
    const stick=$('#touchStick');let touchId=null;
    const move=e=>{if(e.pointerId!==touchId)return;const r=stick.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.36),y=(e.clientY-r.top-r.height/2)/(r.height*.36),len=Math.max(1,Math.hypot(x,y));World.controller.stick.x=x/len;World.controller.stick.y=y/len;stick.firstElementChild.style.transform=`translate(${x/len*27}px,${y/len*27}px)`;};
    stick.onpointerdown=e=>{if(paused())return;touchId=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);};stick.onpointermove=move;
    const release=()=>{touchId=null;World.controller.stick.x=World.controller.stick.y=0;stick.firstElementChild.style.transform='';};stick.onpointerup=stick.onpointercancel=stick.onlostpointercapture=release;
    releaseStick=release;
    addEventListener('keydown',e=>{
      if(e.code==='Tab' && !$('#fieldDialog').hidden){const items=[...$('#fieldDialog').querySelectorAll('button:not(:disabled),[tabindex="0"]')];const first=items[0],last=items.at(-1);if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}}
      if(!outside || paused() || e.target.closest('input,textarea'))return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();World.controller.key(e.code,true);}
      if(e.code==='KeyE' && !e.repeat){e.preventDefault();interact();}
    });
    addEventListener('keyup',e=>World.controller.key(e.code,false));
    addEventListener('blur',()=>{World.controller.clear();release();});document.addEventListener('visibilitychange',()=>{World.controller.clear();release();});
    loop();
  }
  function finish() {
    outside=false;activity=null;choiceOpen=false;World.setPlayerActive(false);World.setMarkers([]);
    for(const id of ['fieldHud','fieldControls','fieldDialog','missionGuide','bookSkipGuide'])$('#'+id).hidden=true;
  }
  function reset() { finish();model=ExpeditionModel.create();lastGuide=''; }
  return {init,newDay,render,notify,queueWork,requestDeparture,returnHome,showMap,sleep,analyse,reset,finish,
    get outside(){return outside;},get model(){return model;},get busy(){return !!activity || choiceOpen;},interact};
})();
