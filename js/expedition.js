/* Direct scene actions, physical jobs and the case-based first day. */
window.Expedition = (() => {
  const $ = s => document.querySelector(s);
  let api, model = ExpeditionModel.create(), outside = false, activity = null, choiceOpen = false, lastGuide = '', moved = 0, lastPos, hazardNotified=false;
  let releaseStick = () => {}, solarNear=false, solarInView=false;
  const touchControls = () => innerWidth <= 700 || matchMedia('(pointer:coarse)').matches;
  const guide = {
    console: ['Open the Console', 'Click the Console or the power card below. Check how much power you make.', 'console', 'Open the Console'],
    depart: ['Get ready to go outside', 'Power is low. We don’t know why yet. Click the yellow “Go Outside” button to check if you are ready to go out.', 'departure', 'Go Outside'],
    move: ['Walk to the yellow ring', 'Walk the astronaut into the yellow ring.'],
    clean: ['Clean the solar panels', 'Follow the arrow to the solar panels. Click “Clean Solar Panels”. Then wipe off the dust with the brush.'],
    repair: ['Check the power plug', 'Click “Fix Loose Plug”. Look where the plug and the socket are. Then plug it back in.'],
    return: ['Walk back to the airlock', 'The solar panels are fixed. Follow the airlock arrow back. When you are close, click “Go In”.'],
    filter: ['Click the water recycler', 'Power is back. We use power to clean water. Cleaning water uses 2 blocks of battery.', 'purifier', 'Open the water recycler'],
    drink: ['Click the water tank', 'The water is clean. Now give the astronaut a drink.', 'water', 'Open the water tank'],
    allocate: ['Give power to the oxygen maker', 'The astronaut needs oxygen every day. The oxygen maker needs power. Click the Console.', 'console', 'Open the Console'],
    sleep: ['Click the bed to end the day', 'Water and repairs are done. Click the bed. Confirm to start Sol 2.', 'bed', 'Check the bed']
  };
  const costText = c => [c.o2 ? `Oxygen −${c.o2}` : '', c.dose ? `Radiation +${Math.round(c.dose * 100) / 100}` : '', c.power ? `Usable power −${c.power}` : ''].filter(Boolean).join(' · ') || 'No extra supplies used';
  function taskInstruction(t) {
    if(t.kind==='survey')return 'Walk to the yellow marker by the rocket. Scan the ground and save the result. Science +6.';
    if(t.kind==='clean')return 'Walk to the solar panels. Wipe the dust off the panels.';
    if(t.kind==='repair')return t.target==='o2'?'Walk to the oxygen maker. Plug the sensor back in.':'Walk to the solar panels. Plug the power plug back in.';
    return 'Walk to the rock. Scan it and collect a sample. Analyze it after you go back in.';
  }
  function paused() { return !api.canAct() || activity || choiceOpen || !$('#notebook').hidden || !$('#itemPopover').hidden || document.hidden; }
  function refresh() { api.refresh(); render(api.state()); }
  function notify(action) { model.notify(action); renderGuide(); }
  function showChoice(title, body, buttons) {
    choiceOpen = true; World.setPlayerInput(false);
    $('#fieldDialog').hidden = false;
    $('#fieldDialog').innerHTML = `<section class="field-card" role="dialog" aria-modal="true" aria-labelledby="fieldTitle"><span class="field-eyebrow">Base Task</span><h2 id="fieldTitle">${title}</h2><div class="field-description">${body}</div><div class="field-choices">${buttons.map((b,i)=>`<button data-choice="${i}" class="field-button ${i===0?'primary':''}" ${b.disabled?'disabled':''}>${b.label}</button>`).join('')}</div></section>`;
    $('#fieldDialog').querySelectorAll('[data-choice]').forEach(el => el.onclick = () => { const b=buttons[+el.dataset.choice]; if(b.disabled)return; closeDialog(); b.run(); });
    $('#fieldDialog button:not(:disabled)')?.focus({preventScroll:true});
  }
  function closeDialog() { choiceOpen=false;$('#fieldDialog').hidden=true;$('#fieldDialog').innerHTML=''; }
  function guideTask() {
    if(!model.guide.active || !outside)return null;
    if(model.step==='move')return {id:'walk',title:'Walk to the yellow ring',target:'walk'};
    if(model.step==='return')return {id:'door',title:'Go In',target:'door'};
    return model.tasks.find(t=>t.id===(model.step==='clean'?'first-clean':model.step==='repair'?'first-repair':''));
  }
  function allowCabinAction(item) {
    if(!model.guide.active)return true;
    if(model.step==='depart' && item==='door')return true;
    if(guide[model.step]?.[2]===item)return true;
    Habitat.toast(guide[model.step]?.[0] || 'Finish the current step first.');return false;
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
    Habitat.toast('Task added. Walk to the yellow marker.');
    return true;
  }
  function newDay(g) {
    solarNear=solarInView=false;
    outside=false; World.setPlayerActive(false); lastPos=null;moved=0;hazardNotified=false;
    model.tasks=model.tasks.filter(t=>t.phase!=='done' && !t.daily);
    if(g.sol>1)model.skip();
    if(g.sol===1){
      model=ExpeditionModel.create();
      addTask({id:'first-clean',title:'Clean the solar panels',kind:'clean',target:'solar',cost:{},needed:g=>g.panelEff<1,complete:()=>api.effect(()=>{g.panelEff=1;World.fx('clean');},'Cleaning done. The solar panels are 100% clean again.')});
      addTask({id:'first-repair',title:'Fix Loose Plug',kind:'repair',target:'solar',cost:{},needed:g=>g.damaged>0,complete:()=>api.effect(()=>{g.damaged=0;},'The plug is fixed. Power is back to normal.')});
      showChoice('Sol 1: Check the Power', '<p>The Console shows low power.</p><p>First check how much power you make. Then go outside and check the solar panels.</p><p>Find the problem and fix it. Then come back in to learn about water and sharing power.</p><p class="field-note">The tutorial has no timer. You can skip it at any time.</p>', [
        {label:'Start Tutorial',run:()=>{model.guide.active=true;model.guide.index=0;renderGuide();}},
        {label:'Skip Tutorial',run:()=>{model.skip();renderGuide();Habitat.toast('Tutorial skipped. You can do the tasks on your own.');}}
      ]);
    }
    const maintenance = (kind,target,needed,title,cost,complete) => {
      if(needed(g) && !model.tasks.some(t=>t.phase!=='done' && t.kind===kind && t.target===target)) addTask({id:`maintenance-${kind}-${target}-${g.sol}`,kind,target,needed,title,cost,complete});
    };
    maintenance('clean','solar',g=>g.panelEff<.98,'Clean the dusty solar panels',{o2:3,dose:.2},()=>api.effect(()=>{g.panelEff=1;g.o2-=3;g.dose+=.2;g.doseParts.eva+=.2;World.fx('clean');},'Cleaning done. Panels are 100% clean. Oxygen −3. Radiation +0.2.'));
    maintenance('repair','solar',g=>g.damaged>0,'Repair the damaged solar panel',{o2:4,dose:.3},()=>api.effect(()=>{g.damaged=0;g.o2-=4;g.dose+=.3;g.doseParts.eva+=.3;World.fx('repair');},'The solar panel is fixed. Oxygen −4. Radiation +0.3.'));
    maintenance('repair','o2',g=>g.o2Fault>0,'Repair the oxygen maker sensor',{power:3},()=>api.effect(()=>{g.today.poolPenalty+=3;g.o2Fault=0;g.o2FaultDays=0;g.o2Mul=1;g.o2MulDays=0;World.fx('repair');},'The sensor is fixed. Usable power today −3. The oxygen maker works at full speed again.'));
    addTask({id:`survey-${g.sol}`,title:'Scan the ground by the rocket',kind:'survey',target:'survey',daily:true,cost:{},complete:()=>api.effect(()=>{g.sci+=6;g.evaCount++;},'Ground scan saved. Science +6. You can only get this reward once a day.')});
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
    const jobsHTML=model.guide.active?'<div class="departure-tasks"><b>Goal: check the solar panels</b><p>After you go out, practice moving first. Then follow the arrow to the solar panels. Check the panels and the power socket.</p></div>':jobs.length?`<div class="departure-tasks"><b>Jobs you can do this trip</b><ul>${jobs.map(t=>`<li><strong>${t.title}</strong><p>${taskInstruction(t)}</p></li>`).join('')}</ul></div>`:'<p>Today’s jobs are done. You can still go outside to look around the base.</p>';
    showChoice('Ready to Go Outside?', `<div class="departure-weather ${blocked?'warning':''}">${blocked?' '+blocked:g.today.flareOut?' A solar storm is happening. Going outside today adds radiation.':' Good weather for going out'}</div>${jobsHTML}<p>This trip costs: <b>${costText(cost)}</b></p>${g.conjRisk>0?'<p class="departure-weather warning">Solar conjunction disrupts radio contact. Each trip outside has about a 1 in 3 chance of a suit leak. A leak uses 6 more oxygen.</p>':''}<p>Oxygen ${Math.round(g.o2)} → ${Math.round((g.o2-3)*10)/10}; total radiation ${g.dose.toFixed(2)} → ${(g.dose+cost.dose).toFixed(2)} / 25 mSv.</p><p class="field-note">You only pay once per trip. Walking and reading do not use extra oxygen. These numbers are game rules.</p>`,[
      {label:blocked || (!ExpeditionModel.canAfford(g,cost)?'Not enough oxygen, or too much radiation':'Go Out'),disabled:!!blocked || !ExpeditionModel.canAfford(g,cost),run:()=>{
        if(api.blockReason() || !ExpeditionModel.canAfford(g,cost))return;
        const actual=ExpeditionModel.departureCost(g,Math.random());
        api.effect(()=>{g.o2=Math.max(0,g.o2-actual.o2);g.dose+=actual.dose;g.doseParts.eva+=.25;g.doseParts.sep+=g.today.flareOut;g.eva=true;},`Trip cost: ${costText(actual)}.${actual.leak?'The spacesuit leaked. The astronaut fixed the valve. Oxygen drops by 6 more.':''}`);
        outside=true;api.view('exterior');World.resetPlayer();World.setPlayerActive(true);lastPos=World.getPlayer();notify('depart');markers();render(g);
      }}, {label:'Cancel',run:()=>{}}
    ]);
  }
  function returnHome(rescue=false) {
    if(!outside || activity || choiceOpen)return;
    if(model.guide.active && model.step!=='return' && !rescue){Habitat.toast(guide[model.step][0]);return;}
    const p=World.getPlayer(), door=World.getSite('door');
    if(!rescue && Math.hypot(p.x-door.x,p.z-door.z)>4){Habitat.toast('Follow the airlock arrow back. When you are close, click “Go In”.');return;}
    const carried=model.samples.some(s=>s.status==='carried');
    outside=false;World.setPlayerActive(false);model.returnSamples();api.effect(()=>{api.state().eva=false;},carried?'You are back inside. The rock sample is on the lab bench.':'You are back in the habitat.');api.view('interior');notify('return');markers();render(api.state());
  }
  function showMap() {
    if(!outside)return requestDeparture();
    const p=World.getPlayer(), current=guideTask(), rows=current?[[current.title,current.target]]:[['Airlock','door'],...model.tasks.filter(t=>t.phase!=='done').map(t=>[t.title,t.target])];
    showChoice('Task Location',`<p>Yellow markers show work sites. The list below shows how far each one is. If you get lost, you can move to the airlock.</p><ul>${rows.map(([name,target])=>{const s=World.getSite(target);return `<li>${name}: about ${Math.round(Math.hypot(p.x-s.x,p.z-s.z))} m</li>`;}).join('')}</ul>`,[
      {label:'Close list',run:()=>{}},{label:'Move to Airlock',run:()=>{World.resetPlayer();Habitat.toast('You are at the airlock. Click “Go In” to enter the habitat.');}}
    ]);
  }
  function startTask(t) {
    if(!outside || paused() || !t || t.phase==='done')return;
    if(model.guide.active && guideTask()?.id!==t.id){Habitat.toast(guide[model.step][0]);return;}
    const p=World.getPlayer(),s=World.getSite(t.target);
    if(Math.hypot(p.x-s.x,p.z-s.z)>4.5)return;
    if(!ExpeditionModel.canAfford(api.state(),t.cost)){Habitat.toast('Not enough supplies. Go back inside to restock.');return;}
    model.start(t.id);activity=t;World.setPlayerInput(false);
    const type=t.kind;
    let art='';
    if(type==='clean') art=`<div class="clean-board" id="cleanBoard" role="group" aria-label="Drag the brush across the solar panel to wipe off the dust"><div class="panel-grid"></div>${Array.from({length:18},(_,i)=>`<div class="dust-patch" data-dust="${i}" style="left:${i%6/6*100}%;top:${Math.floor(i/6)/3*100}%"></div>`).join('')}<span class="brush-hint">Drag the brush to clean </span></div><label class="work-progress">Cleaning progress <progress id="workProgress" max="18" value="0"></progress></label>`;
    else if(type==='repair') art=`<div class="repair-board"><div class="repair-machine"><span class="repair-lamp"></span><b>${t.target==='o2'?'Sensor plug':'Power plug'}</b><div class="wire left-wire"></div><button class="connector" id="looseConnector" aria-label="Pick up the loose plug"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M16 5v12m16-12v12M11 17h26v11q0 10-13 10T11 28Zm13 21v9" fill="none" stroke="currentColor" stroke-width="4"/></svg><small>Loose plug</small></button><button class="socket" id="repairSocket" disabled aria-label="Plug it back into the socket">◉<small>Plug in here</small></button></div></div><p id="repairInstruction">① Click the loose plug.</p><button class="field-button" id="fasten" disabled>③ Turn the locking ring</button>`;
    else art=`<div class="sample-board"><svg class="sample-rock" viewBox="0 0 160 80" aria-hidden="true"><path d="m10 64 20-32 43-17 39 9 37 40Z" fill="#bb7650" stroke="#2b1a24" stroke-width="4"/><path d="m31 51 38-15 39 7m-66 20 43-12 38 8" fill="none" stroke="#e4ac70" stroke-width="4"/></svg><div class="scan-line"></div><span id="sampleVisual">Not scanned yet</span></div><p id="sampleInstruction">${type==='survey'?'Click “Scan Ground” to check the ground.':'Click “Scan Rock” to check the rock.'}</p><button class="field-button" id="scanRock">① Scan ${type==='survey'?'Ground':'Rock'}</button><button class="field-button" id="collectRock" disabled>② ${type==='survey'?'Save Scan Result':'Seal the sample in a box'}</button>`;
    $('#fieldDialog').hidden=false;
    $('#fieldDialog').innerHTML=`<section class="field-card work-card" role="dialog" aria-modal="true" aria-labelledby="fieldTitle"><span class="field-eyebrow">Field Work · ${type==='clean'?'Clean':type==='repair'?'Repair':'Explore'}</span><h2 id="fieldTitle">${t.title}</h2><p class="field-note">When done: ${costText(t.cost)}. Pausing does not use any supplies.</p>${art}<div class="field-choices"><button class="field-button primary" id="finishWork" disabled>Finish Work </button><button class="field-button" id="cancelWork">Pause Work</button></div></section>`;
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
      board.tabIndex=0; board.setAttribute('aria-label','Drag the brush to clean. You can also press Space.');
      board.onkeydown=e=>{if(e.code==='Space'){e.preventDefault();const patch=board.querySelector('[data-dust]:not(.erased)');if(patch){patch.classList.add('erased');erased.add(+patch.dataset.dust);$('#workProgress').value=erased.size;}if(erased.size===18){board.classList.add('clean');done();}}};
    } else if(type==='repair'){
      $('#looseConnector').onclick=()=>{$('#looseConnector').classList.add('picked');$('#repairSocket').disabled=false;$('#repairInstruction').textContent='② Click the round socket. Plug the plug back in.';};
      $('#repairSocket').onclick=()=>{$('#repairSocket').classList.add('connected');$('#fasten').disabled=false;$('#repairInstruction').textContent='The plug is in. Click “Turn Locking Ring”.';};
      $('#fasten').onclick=()=>{$('.repair-lamp').classList.add('working');$('#repairInstruction').textContent='The plug is locked. The light is on.';$('#fasten').disabled=true;done();};
    } else {
      $('#scanRock').onclick=()=>{$('#scanRock').disabled=true;$('.sample-board').classList.add('scanned');$('#sampleVisual').textContent=type==='survey'?'Ground scan complete':'Found a rock sample you can collect';$('#collectRock').disabled=false;$('#sampleInstruction').textContent=type==='survey'?'Click “Save Scan Result”.':'Put the rock sample in the sealed box. You can only analyze it back inside.';};
      $('#collectRock').onclick=()=>{$('#collectRock').disabled=true;$('.sample-board').classList.add('collected');$('#sampleVisual').textContent=type==='survey'?'Scan result saved':' Sample sealed';done();};
    }
    $('#fieldDialog button:not(:disabled)')?.focus({preventScroll:true});
  }
  function finishWork(t) {
    if(activity!==t || $('#finishWork').disabled)return;
    if(!ExpeditionModel.canAfford(api.state(),t.cost)){Habitat.toast('Not enough supplies. Go back inside first. You have not been charged for this job.');return;}
    const g=api.state(), before=g.sci;
    if(!model.finish(t.id))return;
    if(t.kind==='sample'){
      const reward=Math.max(0,g.sci-before);g.sci=before;g.sample=false;model.collect(t.id,reward);
      g.today.notes.pop();
      g.today.notes.push('The sample is in your backpack. Analyze it back inside to earn science.');
    }
    activity=null;$('#fieldDialog').hidden=true;notify(t.kind==='clean'?'clean':t.kind==='repair'?'repair':t.kind);markers();refresh();
    Habitat.toast(t.kind==='sample'?'The sample is in your backpack. Take it inside to analyze.':'Job done. Machines and supplies are updated.');
  }
  function analyse() {
    if(outside || !api.canAct())return;
    const s=model.samples.find(s=>s.status==='stored'),g=api.state();
    if(!s)return Habitat.toast(model.samples.some(s=>s.status==='carried')?'Bring the rock sample inside first.':'There is no sample on the lab bench. Go outside to collect one.');
    showChoice('Analyze Rock Sample',`<p>Analysis needs <b>2 blocks of usable power</b>. When done you get science <b>+${s.reward}</b>.</p><p>Rock samples help scientists study Mars. One analysis cannot prove that Mars once had life.</p>`,[
      {label:g.pool<2?'Not enough usable power':'Start Analysis',disabled:g.pool<2,run:()=>{
        if(g.pool<2)return;const reward=model.analyse(s.id);if(!reward)return;
        api.effect(()=>{g.today.poolPenalty+=2;g.sci+=reward;g.sample=true;},`Sample analysis done. Usable power −2. Science +${reward}.`);refresh();
      }},{label:'Not Now',run:()=>{}}
    ]);
  }
  function sleep() {
    if(outside)return Habitat.toast('Go back to the habitat first. Then click the bed.');
    if(!api.canAct() || choiceOpen)return;
    if(model.guide.active && model.step!=='sleep'){Habitat.toast(guide[model.step][0]);return;}
    const g=api.state(),p=api.preview();
    showChoice(`End Sol ${g.sol} `,`<p>${g.sol<30?`Confirm to start Sol ${g.sol+1} .`:'Confirm to finish the mission.'} Machines will run on your power plan.</p><p>Here is what to expect:</p><div class="night-ledger"><span>Oxygen <b>${Math.max(0,g.o2+p.o2).toFixed(1)}</b></span><span>Food <b>${Math.max(0,g.food+p.food).toFixed(1)}</b></span><span>Water <b>${Math.max(0,g.water-2.5).toFixed(1)}</b></span><span>Science <b>${(g.sci+p.sci).toFixed(1)}</b></span></div><p>${p.o2<0?' Oxygen will drop tonight. Give the oxygen maker more power.':'Oxygen maker power is set.'} The greenhouse takes 3 sols to harvest.</p>`,[
      {label:'Confirm End of Day',run:()=>{notify('sleep');api.endDay();}},
      {label:'Back to Console',run:()=>{api.plan();notify('console');}}
    ]);
  }
  function renderGuide() {
    const card=$('#missionGuide');if(!card)return;
    document.querySelectorAll('.tutorial-target').forEach(e=>e.classList.remove('tutorial-target'));
    const active=model.guide.active && api.state().sol===1 && !api.state().over;
    $('#bGo').disabled=active && model.step!=='allocate';
    $('#bGo').innerHTML=active && model.step==='allocate'?'Finish Power Plan <span>▶</span>':'End the Day <span>▶</span>';
    $('#frame').classList.toggle('tutorial-focused',active);
    $('#bookSkipGuide').hidden=!active;
    $('#fieldHud').classList.toggle('guided',active);
    $('#fieldHud').classList.toggle('guide-on-left',active && !outside && ['filter','drink','sleep'].includes(model.step));
    card.hidden=!active;
    if(!active){lastGuide='';return;}
    const step=model.step,g=guide[step];if(!g)return;
    const power=api.powerStatus();
    let description=g[1];
    if(step==='console')description=`Shown below: power today ${api.state().gen} blocks. Normal is about ${power.normal} blocks. Click the power card to open the Console.`;
    if(step==='depart')description=`Power today ${api.state().gen} blocks. Normal is about ${power.normal} blocks. We don’t know why yet. Click the yellow “Go Outside” button on this card.`;
    if(step==='move')description=touchControls()?'Drag the joystick in the bottom left. Walk the astronaut into the yellow ring.':'Use the arrow keys to move. Walk the astronaut into the yellow ring.';
    if(step==='repair')description=`After cleaning, power went up to ${api.state().gen} blocks, but it is still not normal. Next, check the power socket. Click “Fix Loose Plug”.`;
    if(step==='return')description=`Power is back up to ${api.state().gen} blocks. Follow the airlock arrow back. When you are close, click “Go In”.`;
    if(step==='clean')description=!solarNear?'Follow the arrow to the solar panels. Check the machines first.':!solarInView?'Click “Look at Solar Panels” to turn toward them.':'The brown patches on the panels are dust. Click “Clean Solar Panels” to look closer.';
    if(step==='repair' && solarNear)description=!solarInView?'Click “Look at Solar Panels” to turn toward the power socket.':`The panels are clean. The orange plug is still not in its socket. Click “Fix Loose Plug”.`;
    let powerHint=$('#powerGuideHint');
    if(!powerHint && $('#power .p-h')){powerHint=document.createElement('p');powerHint.id='powerGuideHint';powerHint.className='field-note';$('#power .p-h').appendChild(powerHint);}
    if(powerHint)powerHint.textContent=step==='allocate'?'Give the oxygen maker at least 3 blocks. Click “Finish Power Plan”.':'Each block of power can only go to one machine.';
    const atPower=$('#frame').classList.contains('console-open');
    if(step==='allocate')description=atPower?`Give the oxygen maker at least 3 blocks. It has ${api.state().alloc.o2} blocks now. Click “Finish Power Plan”.`:'Click the Console. Give the oxygen maker at least 3 blocks.';
    const atSolarWork=['clean','repair'].includes(step) && solarNear;
    const label=step==='allocate' && atPower?'Finish Power Plan':atSolarWork?(solarInView?guideTask().title:'Look at Solar Panels'):g[3] || 'Show Task Location';
    const guideState=`${step}:${atPower}:${step==='allocate'?api.state().alloc.o2:''}:${solarNear}:${solarInView}`;
    if(guideState!==lastGuide){
      card.innerHTML=`<span class="field-eyebrow">Sol 1 · Step ${model.guide.index+1} / 10</span><h3>${g[0]}</h3><p>${description}</p><div><button id="guideLocate" class="field-button ${step==='depart' || atSolarWork?'primary':''}">${label}</button><button id="skipGuide" class="text-button">Skip Tutorial</button></div>`;
      $('#skipGuide').onclick=()=>{model.skip();renderGuide();markers();Habitat.toast('Tutorial skipped. You can do the tasks on your own.');};
      $('#guideLocate').onclick=()=>{if(atSolarWork)return solarInView?interact():World.faceSolar();if(step==='allocate' && atPower)return api.completeAllocation();if(g[2]==='departure')return requestDeparture();if(g[2]){const el=g[2]==='console'?$('#cabinPower'):document.querySelector(`[data-object="${g[2]}"]`);if(el){el.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});el.focus({preventScroll:true});api.inspect(g[2],el);}}else showMap();};
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
    $('#cabinPower').setAttribute('aria-label',`Power card. Power today ${g.gen} blocks. Normal is about ${power.normal} blocks. Battery ${g.batt} blocks. Can share ${g.pool} blocks.${low?'Power is low.':''} Click to see faults and power use.`);
    $('#cabinPower').innerHTML=`<span class="power-generation"><small>Power today</small><strong>${g.gen}<small> blocks</small></strong><span>Normal about ${power.normal} blocks</span></span><span class="power-battery"><small>Battery</small><strong>${g.batt}<small> / ${batteryCap} blocks</small></strong><span>Can share ${g.pool} blocks</span></span><span class="power-status"><b>${g.storm>0?'Storm is cutting power':low?'Power is low':'Power is normal'}</b><small>Open Console →</small></span>`;
    $('#fieldStats').innerHTML=`<span> Oxygen <b>${Math.round(g.o2)}</b></span><span> Power <b>${g.gen}</b> · usable <b>${g.pool}</b></span><span> Radiation <b>${g.dose.toFixed(1)} /25</b></span>`;
    $('#missionWeather').textContent=g.storm>0?' Dust storm · Stay inside':g.today?.flareOut?' Solar storm · Watch the radiation':' Weather is normal';
    const pending=model.tasks.filter(t=>t.phase!=='done');
    $('#missionTasks').innerHTML=pending.slice(0,5).map((t,i)=>`<li><span class="task-index">${i+1}</span>${t.title}<small>${taskInstruction(t)}</small></li>`).join('') || '<li> Today’s outside work is done</li>';
    $('#carriedSamples').textContent=model.samples.some(s=>s.status==='carried')?' Your backpack has a rock sample. Take it inside.':model.samples.some(s=>s.status==='stored')?' There is a sample waiting on the lab bench.':'';
    Habitat.samples?.(model.samples);
    renderGuide();
  }
  function nearest() {
    const current=guideTask();
    if(current){const p=World.getPlayer(),s=World.getSite(current.target);return {task:current,distance:Math.hypot(p.x-s.x,p.z-s.z)};}
    const p=World.getPlayer(), candidates=[{id:'door',title:'Go In',target:'door'},...model.tasks.filter(t=>t.phase!=='done')];
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
      const site=World.getSite('solar'),near=Math.hypot(p.x-site.x,p.z-site.z)<=4.5;
      const projected=World.project(model.step==='repair'?'solarConnector':'solarDust'),stage=$('#stage').getBoundingClientRect();
      const visible=near && !!projected?.vis && document.elementFromPoint(stage.left+projected.x,stage.top+projected.y)===$('#stage canvas');
      if(near!==solarNear || visible!==solarInView){solarNear=near;solarInView=visible;renderGuide();}
      for(const [id,anchor,text] of [['dustEvidence','solarDust',api.state().panelEff<.98?'Brown patches: dust':'Panels are clean'],['connectorEvidence','solarConnector',api.state().damaged?'Orange plug is loose':'Plug is in']]){
        const label=$('#'+id),pos=World.project(anchor),otherStep=model.guide.active && model.step!==(id==='dustEvidence'?'clean':'repair');label.hidden=!near || pause || !pos?.vis || otherStep;
        if(!label.hidden){label.style.left=pos.x+'px';label.style.top=(pos.y-15)+'px';label.textContent=text;}
      }
      if(model.guide.active && model.step==='move'){const s=World.getSite('walk');if(moved>3 && Math.hypot(p.x-s.x,p.z-s.z)<4){notify('move');markers();}}
      const n=nearest(),close=n.distance<=4.5;
      const action=$('#nearbyAction');action.disabled=!close || pause; action.textContent=close?`${touchControls()?'':'E · '}${n.task.title}`:`Walk to the yellow marker · ${Math.round(n.distance)} m`;
      const door=World.getSite('door'),angle=Math.atan2(door.x-p.x,door.z-p.z)-p.yaw;
      $('#homeDirection').innerHTML=`<span style="display:inline-block;transform:rotate(${-angle}rad)">↓</span> Airlock ${Math.round(Math.hypot(door.x-p.x,door.z-p.z))} m`;
      const target=guideTask() || model.tasks.find(t=>t.phase!=='done');
      if(target){const s=World.getSite(target.target),a=Math.atan2(s.x-p.x,s.z-p.z)-p.yaw;$('#objectiveDirection').innerHTML=`<span style="display:inline-block;transform:rotate(${-a}rad)">↓</span> ${target.title} · ${Math.round(Math.hypot(s.x-p.x,s.z-p.z))} m`;}else $('#objectiveDirection').textContent=' Today’s exploring is done. Go back inside.';
      if(api.blockReason() && !pause && !hazardNotified){hazardNotified=true;showChoice('The weather changed. Go back inside.','<p>The weather is too dangerous to go out. Go back to the habitat.</p>',[{label:'Go In Now',run:()=>returnHome(true)},{label:'Walk Back In',run:()=>{}}]);}
    }
    requestAnimationFrame(loop);
  }
  function init(adapter) {
    api=adapter;
    const root=document.createElement('div');root.id='expeditionUI';root.innerHTML=`<div id="fieldHud" hidden><aside class="mission-card"><span class="field-eyebrow" id="missionWeather"></span><h3>Today’s Tasks</h3><ul id="missionTasks"></ul><p id="carriedSamples"></p></aside><div id="fieldStats" hidden></div><aside id="missionGuide" hidden></aside></div><div id="fieldControls" hidden><div id="objectiveDirection"></div><div id="homeDirection"></div><div class="camera-tools"><button id="fieldMap">Task Location</button><button id="cameraReset">Reset View</button></div><div id="touchStick" aria-label="Move joystick"><span></span></div><div class="field-help">WASD / Arrow keys: move · Drag: look around</div><button id="nearbyAction" disabled></button></div><div id="fieldDialog" hidden></div>`;
    $('#frame').appendChild(root);
    for(const id of ['dustEvidence','connectorEvidence']){const label=document.createElement('span');label.id=id;label.className='solar-evidence';label.hidden=true;$('#fieldControls').appendChild(label);}
    const powerCard=document.createElement('button');powerCard.id='cabinPower';powerCard.className='cabin-power';powerCard.setAttribute('aria-label','Power card: see today’s power, battery and fault causes');powerCard.onclick=()=>api.inspect('console',powerCard);$('#cabinPowerMount').append(powerCard);
    const bookSkip=document.createElement('button');bookSkip.id='bookSkipGuide';bookSkip.className='text-button';bookSkip.textContent='Skip guide';bookSkip.hidden=true;bookSkip.onclick=()=>{model.skip();renderGuide();};$('#closeBook').before(bookSkip);
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
