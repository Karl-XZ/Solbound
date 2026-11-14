async page => {
  await page.route('**/*', route => route.continue());await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'跳过教程'}).click();
  await page.evaluate(()=>{
    const g=__dbg.G();g.panelEff=1;g.damaged=0;g.stormLen=4;
    g.events={2:'stormWarn',3:'stormStart',7:'dustDevil',8:'o2fault',12:'delta',13:'conjunction',17:'cold',19:'blight',20:'resupply',21:'bones',22:'letter',23:'build',24:'quake',25:'dirty',26:'flare'};
    g.flareSols=[26];__dbg.beginSol();
  });
  await page.getByRole('button',{name:'跳过教程'}).click();
  const visited=[],trace=[];
  for(let i=0;i<30;i++){
    const day=await page.evaluate(()=>__dbg.G().sol);
    if(await page.locator('#dailyEventModal').isVisible()){
      const id=await page.evaluate(()=>__dbg.G().today.eventId);visited.push(id);
      const choice={flare:0,stormWarn:0,stormStart:1,dustDevil:1,o2fault:1,delta:1,conjunction:0,cold:0,blight:1,resupply:0,bones:1,letter:0,build:1,quake:1,dirty:1}[id]??0;
      let button=page.locator(`#dailyEventModal [data-option="${choice}"]`);
      if(await button.isDisabled())button=page.locator('#dailyEventModal .event-option:not(:disabled)').first();
      await button.click();
    }
    // This run exercises the 30-day economy. Field effects use the real task model;
    // reaching and doing those jobs is tested with actual movement in first-day/sample-loop.
    const trip=await page.evaluate(()=>{const g=__dbg.G();return g.storm===0&&g.evaLock===0&&!g.today.sciLock&&g.o2>28&&((g.panelEff<.9||g.damaged>0||g.o2Fault>0)||g.sci<g.sol*3.5);});
    if(trip){
      await page.evaluate(()=>Expedition.requestDeparture());
      await page.getByRole('button',{name:'出舱',exact:true}).click();
      await page.evaluate(()=>{const g=__dbg.G(),m=Expedition.model;for(const t of [...m.tasks])if(t.phase!=='done'&&ExpeditionModel.canAfford(g,t.cost)&&(t.kind==='repair'||(t.kind==='clean'&&g.panelEff<.9)||t.kind==='survey')){m.start(t.id);m.finish(t.id);}});
      await page.waitForFunction(()=>!document.querySelector('#nearbyAction').disabled);
      await page.locator('#nearbyAction').click();
    }
    const water=await page.evaluate(()=>({water:__dbg.G().water,batt:__dbg.G().batt}));
    if(water.water<30&&water.batt>=2){
      await page.getByRole('button',{name:'净水机：消耗电池净化饮用水'}).click();await page.getByRole('button',{name:/启动净水/}).click();if(await page.locator('#itemPopover').isVisible())await page.locator('.item-close').click();
    }
    await page.evaluate(()=>{const g=__dbg.G();g.want={o2:Math.ceil((7+g.exercise+(g.o2<45?2:0))/(g.o2Rate*g.o2Mul)),food:g.food<40?3:2,shield:g.shieldLv<3&&g.storm===0&&g.batt>=4?1:0,sci:g.storm>0||g.batt<4?0:2};__dbg.renderAll();});
    trace.push(await page.evaluate(()=>({sol:__dbg.G().sol,o2:__dbg.G().o2,food:__dbg.G().food,water:__dbg.G().water,pool:__dbg.G().pool,alloc:__dbg.G().alloc})));
    await page.evaluate(()=>__dbg.endSol());
    await page.waitForFunction(sol=>__dbg.G().over||__dbg.G().sol!==sol,day,{timeout:8000});
    if(await page.evaluate(()=>__dbg.G().over))break;
  }
  const result=await page.evaluate(()=>{const g=__dbg.G();return {sol:g.sol,days:g.hist.length,o2:g.o2,food:g.food,water:g.water,sci:g.sci,dose:g.dose,parts:g.doseParts,over:g.over};});
  if(result.days!==30||result.o2<=0||result.food<=0||result.water<=0||result.dose>=25||result.sci<100)throw Error('30-day strategy failed '+JSON.stringify({result,trace}));
  if(new Set(visited).size!==15)throw Error('event coverage '+JSON.stringify(visited));
  if(Math.abs(result.dose-Object.values(result.parts).reduce((a,b)=>a+b,0))>1e-8)throw Error('radiation counted twice');
  return {result,events:visited};
}
