/* Direct scene actions, physical jobs and the case-based first day. */
window.Expedition = (() => {
  const $ = s => document.querySelector(s);
  let api, model = ExpeditionModel.create(), outside = false, activity = null, choiceOpen = false, lastGuide = '', moved = 0, lastPos, hazardNotified=false;
  let releaseStick = () => {};
  const touchControls = () => innerWidth <= 700 || matchMedia('(pointer:coarse)').matches;
  const guide = {
    console: ['打开电力台', '点击电力台或下方的电量卡。查看发电量。', 'console', '打开电力台'],
    depart: ['点击「出舱探索」', '底部显示发电量。太阳能板有积灰。供电接头也松了。我们要出舱维修。', 'departure', '出舱探索'],
    move: ['走到黄色光圈', '让宇航员走进黄色光圈。'],
    clean: ['清扫太阳能板', '沿箭头走到太阳能板旁。点击「清扫太阳能板」。再用刷子擦掉灰尘。'],
    repair: ['修复供电接头', '接头仍然松着。点击「固定松脱接头」。再把接头接回接口。'],
    return: ['走回舱门', '太阳能板已修好。沿舱门箭头返回。靠近后点击「回舱」。'],
    filter: ['点击净水机', '发电已恢复。我们用电净水。净水会消耗 2 格电池。', 'purifier', '打开净水机'],
    drink: ['点击饮水桶', '净水已完成。现在给宇航员喝水。', 'water', '打开饮水桶'],
    allocate: ['给制氧机分电', '宇航员每天需要氧气。制氧机需要电。点击电力台。', 'console', '打开电力台'],
    sleep: ['点击床结束今天', '净水和维修已完成。点击床。确认后进入第 2 天。', 'bed', '查看床']
  };
  const costText = c => [c.o2 ? `氧气 −${c.o2}` : '', c.dose ? `辐射 +${Math.round(c.dose * 100) / 100}` : '', c.power ? `可用电 −${c.power}` : ''].filter(Boolean).join(' · ') || '不额外消耗物资';
  function taskInstruction(t) {
    if(t.kind==='survey')return '走到火箭旁的黄色标记。扫描地面并保存结果。科学 +6。';
    if(t.kind==='clean')return '走到太阳能板旁。擦掉板面的灰尘。';
    if(t.kind==='repair')return t.target==='o2'?'走到制氧机旁。接回传感器接头。':'走到太阳能板旁。接回供电接头。';
    return '走到岩石旁。扫描岩石并收集岩样。带回舱后分析。';
  }
  function paused() { return !api.canAct() || activity || choiceOpen || !$('#notebook').hidden || !$('#itemPopover').hidden || document.hidden; }
  function refresh() { api.refresh(); render(api.state()); }
  function notify(action) { model.notify(action); renderGuide(); }
  function showChoice(title, body, buttons) {
    choiceOpen = true; World.setPlayerInput(false);
    $('#fieldDialog').hidden = false;
    $('#fieldDialog').innerHTML = `<section class="field-card" role="dialog" aria-modal="true" aria-labelledby="fieldTitle"><span class="field-eyebrow">基地任务</span><h2 id="fieldTitle">${title}</h2><div class="field-description">${body}</div><div class="field-choices">${buttons.map((b,i)=>`<button data-choice="${i}" class="field-button ${i===0?'primary':''}" ${b.disabled?'disabled':''}>${b.label}</button>`).join('')}</div></section>`;
    $('#fieldDialog').querySelectorAll('[data-choice]').forEach(el => el.onclick = () => { const b=buttons[+el.dataset.choice]; if(b.disabled)return; closeDialog(); b.run(); });
    $('#fieldDialog button:not(:disabled)')?.focus({preventScroll:true});
  }
  function closeDialog() { choiceOpen=false;$('#fieldDialog').hidden=true;$('#fieldDialog').innerHTML=''; }
  function guideTask() {
    if(!model.guide.active || !outside)return null;
    if(model.step==='move')return {id:'walk',title:'走到黄色光圈',target:'walk'};
    if(model.step==='return')return {id:'door',title:'回舱',target:'door'};
    return model.tasks.find(t=>t.id===(model.step==='clean'?'first-clean':model.step==='repair'?'first-repair':''));
  }
  function allowCabinAction(item) {
    if(!model.guide.active)return true;
    if(model.step==='depart' && item==='door')return true;
    if(guide[model.step]?.[2]===item)return true;
    Habitat.toast(guide[model.step]?.[0] || '请先完成当前步骤。');return false;
  }
  function markers() {
    if (!outside) return World.setMarkers([]);
    const current=guideTask();
    if(current)return World.setMarkers([{target:current.target}]);
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
    Habitat.toast('任务已添加。请走到黄色标记旁。');
    return true;
  }
  function newDay(g) {
    outside=false; World.setPlayerActive(false); lastPos=null;moved=0;hazardNotified=false;
    model.tasks=model.tasks.filter(t=>t.phase!=='done' && !t.daily);
    if(g.sol>1)model.skip();
    if(g.sol===1){
      model=ExpeditionModel.create();
      addTask({id:'first-clean',title:'清扫太阳能板',kind:'clean',target:'solar',cost:{},needed:g=>g.panelEff<1,complete:()=>api.effect(()=>{g.panelEff=1;World.fx('clean');},'清扫完成。太阳能板清洁度恢复到 100%。')});
      addTask({id:'first-repair',title:'固定松脱接头',kind:'repair',target:'solar',cost:{},needed:g=>g.damaged>0,complete:()=>api.effect(()=>{g.damaged=0;World.fx('repair');},'接头已固定。发电量已恢复。')});
      showChoice('第 1 天：修复太阳能板', '<p>灰尘盖住了太阳能板。</p><p>一个供电接头也松了。太阳能板因此少发了电。</p><p>先出舱修复设备。再回舱学习净水和分电。</p><p class="field-note">教程没有操作倒计时。你可以随时跳过。</p>', [
        {label:'开始教程',run:()=>{model.guide.active=true;model.guide.index=0;renderGuide();}},
        {label:'跳过教程',run:()=>{model.skip();renderGuide();Habitat.toast('教程已跳过。你可以自行完成任务。');}}
      ]);
    }
    const maintenance = (kind,target,needed,title,cost,complete) => {
      if(needed(g) && !model.tasks.some(t=>t.phase!=='done' && t.kind===kind && t.target===target)) addTask({id:`maintenance-${kind}-${target}-${g.sol}`,kind,target,needed,title,cost,complete});
    };
    maintenance('clean','solar',g=>g.panelEff<.98,'清扫积灰的太阳能板',{o2:3,dose:.2},()=>api.effect(()=>{g.panelEff=1;g.o2-=3;g.dose+=.2;g.doseParts.eva+=.2;World.fx('clean');},'清扫完成。清洁度恢复 100%。氧气 −3。辐射 +0.2。'));
    maintenance('repair','solar',g=>g.damaged>0,'修复受损太阳能板',{o2:4,dose:.3},()=>api.effect(()=>{g.damaged=0;g.o2-=4;g.dose+=.3;g.doseParts.eva+=.3;World.fx('repair');},'太阳能板已修好。氧气 −4。辐射 +0.3。'));
    maintenance('repair','o2',g=>g.o2Fault>0,'修复制氧机传感器',{power:3},()=>api.effect(()=>{g.today.poolPenalty+=3;g.o2Fault=0;g.o2FaultDays=0;g.o2Mul=1;g.o2MulDays=0;World.fx('repair');},'传感器已修好。今天可用电 −3。制氧效率恢复。'));
    addTask({id:`survey-${g.sol}`,title:'扫描火箭旁的地面',kind:'survey',target:'survey',daily:true,cost:{},complete:()=>api.effect(()=>{g.sci+=6;g.evaCount++;},'地面扫描结果已保存。科学 +6。今天不能重复领奖。')});
    render(g);
  }
  function inspectPower() {
    if(!api.canAct() || choiceOpen)return;
    api.plan(); notify('console');
  }
  function requestDeparture() {
    if(outside)return;
    if(!api.canAct() || activity || choiceOpen)return;
    if(model.guide.active && model.step!=='depart'){Habitat.toast(guide[model.step][0]);return;}
    const g=api.state(), blocked=api.blockReason(), cost={o2:3,dose:.25+g.today.flareOut};
    const jobs=model.tasks.filter(t=>t.phase!=='done' && (!model.guide.active || t.kind!=='survey'));
    const jobsHTML=jobs.length?`<div class="departure-tasks"><b>本次可做的工作</b><ul>${jobs.map(t=>`<li><strong>${t.title}</strong><p>${taskInstruction(t)}</p></li>`).join('')}</ul></div>`:'<p>今天的工作已完成。你仍可出舱查看基地。</p>';
    showChoice('出舱检查', `<div class="departure-weather ${blocked?'warning':''}">${blocked?' '+blocked:g.today.flareOut?' 发生太阳风暴。今天出舱会增加辐射。':' 天气适合出发'}</div>${jobsHTML}<p>本次消耗：<b>${costText(cost)}</b></p>${g.conjRisk>0?'<p class="departure-weather warning">日凌会影响通信。每次出舱有约 1/3 的概率发生漏气。漏气会额外消耗 6 点氧气。</p>':''}<p>氧气 ${Math.round(g.o2)} → ${Math.round((g.o2-3)*10)/10}；累计辐射 ${g.dose.toFixed(2)} → ${(g.dose+cost.dose).toFixed(2)} / 25 mSv。</p><p class="field-note">出舱只收费一次。移动和阅读不额外消耗氧气。这些数值是游戏规则。</p>`,[
      {label:blocked || (!ExpeditionModel.canAfford(g,cost)?'氧气不足或辐射过高':'出舱'),disabled:!!blocked || !ExpeditionModel.canAfford(g,cost),run:()=>{
        if(api.blockReason() || !ExpeditionModel.canAfford(g,cost))return;
        const actual=ExpeditionModel.departureCost(g,Math.random());
        api.effect(()=>{g.o2=Math.max(0,g.o2-actual.o2);g.dose+=actual.dose;g.doseParts.eva+=.25;g.doseParts.sep+=g.today.flareOut;g.eva=true;},`出舱消耗：${costText(actual)}。${actual.leak?'宇航服发生漏气。宇航员已修复阀门。氧气额外减少 6 点。':''}`);
        outside=true;api.view('exterior');World.resetPlayer();World.setPlayerActive(true);lastPos=World.getPlayer();notify('depart');markers();render(g);
      }}, {label:'取消出舱',run:()=>{}}
    ]);
  }
  function returnHome(rescue=false) {
    if(!outside || activity || choiceOpen)return;
    if(model.guide.active && model.step!=='return' && !rescue){Habitat.toast(guide[model.step][0]);return;}
    const p=World.getPlayer(), door=World.getSite('door');
    if(!rescue && Math.hypot(p.x-door.x,p.z-door.z)>4){Habitat.toast('请沿舱门箭头返回。靠近后点击「回舱」。');return;}
    const carried=model.samples.some(s=>s.status==='carried');
    outside=false;World.setPlayerActive(false);model.returnSamples();api.effect(()=>{api.state().eva=false;},carried?'你已回舱。岩样已存入实验台。':'你已回到生活舱。');api.view('interior');notify('return');markers();render(api.state());
  }
  function showMap() {
    if(!outside)return requestDeparture();
    const p=World.getPlayer(), current=guideTask(), rows=current?[[current.title,current.target]]:[['舱门','door'],...model.tasks.filter(t=>t.phase!=='done').map(t=>[t.title,t.target])];
    showChoice('任务位置',`<p>黄色标记表示工作地点。下方列出各地点的距离。迷路时可以移到舱门外。</p><ul>${rows.map(([name,target])=>{const s=World.getSite(target);return `<li>${name}：约 ${Math.round(Math.hypot(p.x-s.x,p.z-s.z))} 米</li>`;}).join('')}</ul>`,[
      {label:'关闭列表',run:()=>{}},{label:'移到舱门外',run:()=>{World.resetPlayer();Habitat.toast('你已到达舱门外。点击「回舱」进入生活舱。');}}
    ]);
  }
  function startTask(t) {
    if(!outside || paused() || !t || t.phase==='done')return;
    if(model.guide.active && guideTask()?.id!==t.id){Habitat.toast(guide[model.step][0]);return;}
    const p=World.getPlayer(),s=World.getSite(t.target);
    if(Math.hypot(p.x-s.x,p.z-s.z)>4.5)return;
    if(!ExpeditionModel.canAfford(api.state(),t.cost)){Habitat.toast('资源不足。请回舱补充资源。');return;}
    model.start(t.id);activity=t;World.setPlayerInput(false);
    const type=t.kind;
    let art='';
    if(type==='clean') art=`<div class="clean-board" id="cleanBoard" role="group" aria-label="在太阳能板上拖动刷子擦灰"><div class="panel-grid"></div>${Array.from({length:18},(_,i)=>`<div class="dust-patch" data-dust="${i}" style="left:${i%6/6*100}%;top:${Math.floor(i/6)/3*100}%"></div>`).join('')}<span class="brush-hint">拖动刷子清扫 </span></div><label class="work-progress">清洁进度 <progress id="workProgress" max="18" value="0"></progress></label>`;
    else if(type==='repair') art=`<div class="repair-board"><div class="repair-machine"><span class="repair-lamp"></span><b>${t.target==='o2'?'传感器接头':'供电接头'}</b><div class="wire left-wire"></div><button class="connector" id="looseConnector" aria-label="拿起松脱接头"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M16 5v12m16-12v12M11 17h26v11q0 10-13 10T11 28Zm13 21v9" fill="none" stroke="currentColor" stroke-width="4"/></svg><small>松脱的接头</small></button><button class="socket" id="repairSocket" disabled aria-label="把接头接回接口">◉<small>接回这里</small></button></div></div><p id="repairInstruction">① 点击松脱的接头。</p><button class="field-button" id="fasten" disabled>③ 拧紧固定环</button>`;
    else art=`<div class="sample-board"><svg class="sample-rock" viewBox="0 0 160 80" aria-hidden="true"><path d="m10 64 20-32 43-17 39 9 37 40Z" fill="#bb7650" stroke="#2b1a24" stroke-width="4"/><path d="m31 51 38-15 39 7m-66 20 43-12 38 8" fill="none" stroke="#e4ac70" stroke-width="4"/></svg><div class="scan-line"></div><span id="sampleVisual">尚未扫描</span></div><p id="sampleInstruction">${type==='survey'?'点击「扫描地面」检查地面。':'点击「扫描岩石」检查岩样。'}</p><button class="field-button" id="scanRock">① 扫描${type==='survey'?'地面':'岩石'}</button><button class="field-button" id="collectRock" disabled>② ${type==='survey'?'保存扫描结果':'将岩样装进密封盒'}</button>`;
    $('#fieldDialog').hidden=false;
    $('#fieldDialog').innerHTML=`<section class="field-card work-card" role="dialog" aria-modal="true" aria-labelledby="fieldTitle"><span class="field-eyebrow">现场工作 · ${type==='clean'?'清扫':type==='repair'?'维修':'探索'}</span><h2 id="fieldTitle">${t.title}</h2><p class="field-note">完成时：${costText(t.cost)}。暂停不会扣除资源。</p>${art}<div class="field-choices"><button class="field-button primary" id="finishWork" disabled>完成工作 </button><button class="field-button" id="cancelWork">暂停工作</button></div></section>`;
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
      board.tabIndex=0; board.setAttribute('aria-label','拖动刷子清扫。也可按空格清扫。');
      board.onkeydown=e=>{if(e.code==='Space'){e.preventDefault();const patch=board.querySelector('[data-dust]:not(.erased)');if(patch){patch.classList.add('erased');erased.add(+patch.dataset.dust);$('#workProgress').value=erased.size;}if(erased.size===18){board.classList.add('clean');done();}}};
    } else if(type==='repair'){
      $('#looseConnector').onclick=()=>{$('#looseConnector').classList.add('picked');$('#repairSocket').disabled=false;$('#repairInstruction').textContent='② 点击圆形接口。接回接头。';};
      $('#repairSocket').onclick=()=>{$('#repairSocket').classList.add('connected');$('#fasten').disabled=false;$('#repairInstruction').textContent='接头已接好。点击「拧紧固定环」。';};
      $('#fasten').onclick=()=>{$('.repair-lamp').classList.add('working');$('#repairInstruction').textContent='接头已固定。指示灯已亮起。';$('#fasten').disabled=true;done();};
    } else {
      $('#scanRock').onclick=()=>{$('#scanRock').disabled=true;$('.sample-board').classList.add('scanned');$('#sampleVisual').textContent=type==='survey'?'地面扫描完成':'找到了可采集的岩样';$('#collectRock').disabled=false;$('#sampleInstruction').textContent=type==='survey'?'点击「保存扫描结果」。':'请将岩样装入密封盒。回舱后才能分析。';};
      $('#collectRock').onclick=()=>{$('#collectRock').disabled=true;$('.sample-board').classList.add('collected');$('#sampleVisual').textContent=type==='survey'?'扫描结果已保存':' 岩样已密封';done();};
    }
    $('#fieldDialog button:not(:disabled)')?.focus({preventScroll:true});
  }
  function finishWork(t) {
    if(activity!==t || $('#finishWork').disabled)return;
    if(!ExpeditionModel.canAfford(api.state(),t.cost)){Habitat.toast('资源不足。请先回舱。工作尚未扣费。');return;}
    const g=api.state(), before=g.sci;
    if(!model.finish(t.id))return;
    if(t.kind==='sample'){
      const reward=Math.max(0,g.sci-before);g.sci=before;g.sample=false;model.collect(t.id,reward);
      g.today.notes.pop();
      g.today.notes.push('岩样已装入背包。回舱分析后可获得科学成果。');
    }
    activity=null;$('#fieldDialog').hidden=true;notify(t.kind==='clean'?'clean':t.kind==='repair'?'repair':t.kind);markers();refresh();
    Habitat.toast(t.kind==='sample'?'岩样已装入背包。请回舱分析。':'工作已完成。设备和资源已更新。');
  }
  function analyse() {
    if(outside || !api.canAct())return;
    const s=model.samples.find(s=>s.status==='stored'),g=api.state();
    if(!s)return Habitat.toast(model.samples.some(s=>s.status==='carried')?'请先带岩样回舱。':'实验台没有岩样。请出舱采样。');
    showChoice('分析岩样',`<p>分析需要 <b>2 格可用电</b>。完成后可获得科学 <b>+${s.reward}</b>。</p><p>岩样可以帮助科学家研究火星。一次分析不能证明火星曾有生命。</p>`,[
      {label:g.pool<2?'可用电不足':'启动分析',disabled:g.pool<2,run:()=>{
        if(g.pool<2)return;const reward=model.analyse(s.id);if(!reward)return;
        api.effect(()=>{g.today.poolPenalty+=2;g.sci+=reward;g.sample=true;},`岩样分析已完成。可用电 −2。科学 +${reward}。`);refresh();
      }},{label:'暂不分析',run:()=>{}}
    ]);
  }
  function sleep() {
    if(outside)return Habitat.toast('请先回到生活舱。再点击床。');
    if(!api.canAct() || choiceOpen)return;
    if(model.guide.active && model.step!=='sleep'){Habitat.toast(guide[model.step][0]);return;}
    const g=api.state(),p=api.preview();
    showChoice(`结束第 ${g.sol} 天`,`<p>${g.sol<30?`确认后进入第 ${g.sol+1} 天。`:'确认后结束任务。'}设备会按分电方案运行。</p><p>预计资源如下：</p><div class="night-ledger"><span>氧气 <b>${Math.max(0,g.o2+p.o2).toFixed(1)}</b></span><span>食物 <b>${Math.max(0,g.food+p.food).toFixed(1)}</b></span><span>饮水 <b>${Math.max(0,g.water-2.5).toFixed(1)}</b></span><span>科学 <b>${(g.sci+p.sci).toFixed(1)}</b></span></div><p>${p.o2<0?' 今晚氧气会减少。请给制氧机增加电量。':'制氧电量已分配。'} 温室需要 3 天才能收获。</p>`,[
      {label:'确认结束今天',run:()=>{notify('sleep');api.endDay();}},
      {label:'返回电力台',run:()=>{api.plan();notify('console');}}
    ]);
  }
  function renderGuide() {
    const card=$('#missionGuide');if(!card)return;
    document.querySelectorAll('.tutorial-target').forEach(e=>e.classList.remove('tutorial-target'));
    const active=model.guide.active && api.state().sol===1 && !api.state().over;
    $('#bGo').disabled=active && model.step!=='allocate';
    $('#bGo').innerHTML=active && model.step==='allocate'?'完成分电<span>▶</span>':'结束今天<span>▶</span>';
    $('#frame').classList.toggle('tutorial-focused',active);
    $('#bookSkipGuide').hidden=!active;
    $('#fieldHud').classList.toggle('guided',active);
    $('#fieldHud').classList.toggle('guide-on-left',active && !outside && ['filter','drink','sleep'].includes(model.step));
    card.hidden=!active;
    if(!active){lastGuide='';return;}
    const step=model.step,g=guide[step];if(!g)return;
    const power=api.powerStatus();
    let description=g[1];
    if(step==='console')description=`下方显示：今日发电 ${api.state().gen} 格。正常约 ${power.normal} 格。点击电量卡打开电力台。`;
    if(step==='depart')description=`底部显示：今日发电 ${api.state().gen} 格。正常约 ${power.normal} 格。太阳能板有积灰。供电接头也松了。点击「出舱探索」。`;
    if(step==='move')description=touchControls()?'拖动左下角的摇杆。让宇航员走进黄色光圈。':'按方向键移动。让宇航员走进黄色光圈。';
    if(step==='repair')description=`清扫后发电提高到 ${api.state().gen} 格。接头仍然松着。点击「固定松脱接头」。`;
    if(step==='return')description=`发电量已提高到 ${api.state().gen} 格。沿舱门箭头返回。靠近后点击「回舱」。`;
    let powerHint=$('#powerGuideHint');
    if(!powerHint && $('#power .p-h')){powerHint=document.createElement('p');powerHint.id='powerGuideHint';powerHint.className='field-note';$('#power .p-h').appendChild(powerHint);}
    if(powerHint)powerHint.textContent=step==='allocate'?'给制氧分配至少 3 格电。点击「完成分电」。':'每格电只能分给一个设备。';
    const atPower=$('#frame').classList.contains('console-open');
    if(step==='allocate')description=atPower?`给制氧分配至少 3 格电。当前已分配 ${api.state().alloc.o2} 格。点击「完成分电」。`:'点击电力台。给制氧分配至少 3 格电。';
    const guideState=`${step}:${atPower}:${step==='allocate'?api.state().alloc.o2:''}`;
    if(guideState!==lastGuide){
      card.innerHTML=`<span class="field-eyebrow">第 1 天 · 步骤 ${model.guide.index+1} / 10</span><h3>${g[0]}</h3><p>${description}</p><div><button id="guideLocate" class="field-button">${step==='allocate' && atPower?'完成分电':g[3] || '查看任务位置'}</button><button id="skipGuide" class="text-button">跳过教程</button></div>`;
      $('#skipGuide').onclick=()=>{model.skip();renderGuide();markers();Habitat.toast('教程已跳过。你可以自行完成任务。');};
      $('#guideLocate').onclick=()=>{if(step==='allocate' && atPower)return api.completeAllocation();if(g[2]==='departure')return requestDeparture();if(g[2]){const el=g[2]==='console'?$('#cabinPower'):document.querySelector(`[data-object="${g[2]}"]`);if(el){el.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});el.focus({preventScroll:true});api.inspect(g[2],el);}}else showMap();};
      lastGuide=guideState;markers();
    }
    if(g[2])document.querySelector(`[data-object="${g[2]}"]`)?.classList.add('tutorial-target');
    $('#cabinPower').classList.toggle('tutorial-target',step==='console' || step==='allocate');
  }
  function render(g) {
    if(!$('#fieldHud'))return;
    if(model.reconcile(g))markers();
    const active=$('#hud').classList.contains('on') && !g.over;
    $('#fieldHud').hidden=!active;$('#fieldControls').hidden=!outside || !active;$('#fieldStats').hidden=!outside;
    const power=api.powerStatus(), low=power.lost>0 || g.storm>0, batteryCap=8+g.battBonus;
    $('#cabinPower').hidden=outside;$('#cabinPower').dataset.battery=String(g.batt);$('#cabinPower').dataset.loss=String(power.lost);$('#cabinPower').classList.toggle('low',low);
    $('#cabinPower').setAttribute('aria-label',`电量卡。今日发电 ${g.gen} 格。正常约 ${power.normal} 格。电池余量 ${g.batt} 格。可分配 ${g.pool} 格。${low?'发电偏低。':''}点击查看故障和用电。`);
    $('#cabinPower').innerHTML=`<span class="power-generation"><small>今日发电</small><strong>${g.gen}<small> 格</small></strong><span>正常约 ${power.normal} 格</span></span><span class="power-battery"><small>电池余量</small><strong>${g.batt}<small> / ${batteryCap} 格</small></strong><span>可分配 ${g.pool} 格</span></span><span class="power-status"><b>${g.storm>0?'风暴影响发电':low?'发电偏低':'发电正常'}</b><small>打开电力台 →</small></span>`;
    $('#fieldStats').innerHTML=`<span> 氧气 <b>${Math.round(g.o2)}</b></span><span> 发电 <b>${g.gen}</b> · 可用 <b>${g.pool}</b></span><span> 辐射 <b>${g.dose.toFixed(1)} /25</b></span>`;
    $('#missionWeather').textContent=g.storm>0?' 沙尘暴 · 留在仓内':g.today?.flareOut?' 发生太阳风暴 · 注意辐射':' 天气正常';
    const pending=model.tasks.filter(t=>t.phase!=='done');
    $('#missionTasks').innerHTML=pending.slice(0,5).map((t,i)=>`<li><span class="task-index">${i+1}</span>${t.title}<small>${taskInstruction(t)}</small></li>`).join('') || '<li> 今日舱外工作已完成</li>';
    $('#carriedSamples').textContent=model.samples.some(s=>s.status==='carried')?' 背包有岩样。请带回舱。':model.samples.some(s=>s.status==='stored')?' 实验台有待分析岩样。':'';
    Habitat.samples?.(model.samples);
    renderGuide();
  }
  function nearest() {
    const current=guideTask();
    if(current){const p=World.getPlayer(),s=World.getSite(current.target);return {task:current,distance:Math.hypot(p.x-s.x,p.z-s.z)};}
    const p=World.getPlayer(), candidates=[{id:'door',title:'回舱',target:'door'},...model.tasks.filter(t=>t.phase!=='done')];
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
      const action=$('#nearbyAction');action.disabled=!close || pause; action.textContent=close?`${touchControls()?'':'E · '}${n.task.title}`:`走到黄色标记 · ${Math.round(n.distance)} 米`;
      const door=World.getSite('door'),angle=Math.atan2(door.x-p.x,door.z-p.z)-p.yaw;
      $('#homeDirection').innerHTML=`<span style="display:inline-block;transform:rotate(${-angle}rad)">↓</span> 舱门 ${Math.round(Math.hypot(door.x-p.x,door.z-p.z))} 米`;
      const target=guideTask() || model.tasks.find(t=>t.phase!=='done');
      if(target){const s=World.getSite(target.target),a=Math.atan2(s.x-p.x,s.z-p.z)-p.yaw;$('#objectiveDirection').innerHTML=`<span style="display:inline-block;transform:rotate(${-a}rad)">↓</span> ${target.title} · ${Math.round(Math.hypot(s.x-p.x,s.z-p.z))} 米`;}else $('#objectiveDirection').textContent=' 今日探索已完成。请回舱。';
      if(api.blockReason() && !pause && !hazardNotified){hazardNotified=true;showChoice('天气已变化。请回舱。','<p>天气不允许出舱。请返回生活舱。</p>',[{label:'立即回舱',run:()=>returnHome(true)},{label:'步行回舱',run:()=>{}}]);}
    }
    requestAnimationFrame(loop);
  }
  function init(adapter) {
    api=adapter;
    const root=document.createElement('div');root.id='expeditionUI';root.innerHTML=`<div id="fieldHud" hidden><aside class="mission-card"><span class="field-eyebrow" id="missionWeather"></span><h3>今日任务</h3><ul id="missionTasks"></ul><p id="carriedSamples"></p></aside><div id="fieldStats" hidden></div><aside id="missionGuide" hidden></aside></div><div id="fieldControls" hidden><div id="objectiveDirection"></div><div id="homeDirection"></div><div class="camera-tools"><button id="fieldMap">任务位置</button><button id="cameraReset">重置视角</button></div><div id="touchStick" aria-label="移动摇杆"><span></span></div><div class="field-help">WASD / 方向键：移动 · 拖动画面：转动视角</div><button id="nearbyAction" disabled></button></div><div id="fieldDialog" hidden></div>`;
    $('#frame').appendChild(root);
    const powerCard=document.createElement('button');powerCard.id='cabinPower';powerCard.className='cabin-power';powerCard.setAttribute('aria-label','电量卡：查看今日发电、电池余量和故障原因');powerCard.onclick=()=>api.inspect('console',powerCard);$('#cabinPowerMount').append(powerCard);
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
  return {init,newDay,render,notify,queueWork,requestDeparture,returnHome,showMap,sleep,analyse,reset,finish,inspectPower,allowCabinAction,
    get outside(){return outside;},get model(){return model;},get busy(){return !!activity || choiceOpen;},interact};
})();
