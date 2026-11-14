async page => {
  await page.route('**/*',route=>route.continue());
  await page.setViewportSize({width:2032,height:1024});
  const results=[];
  for(const {control,start} of [{control:'guideLocate',start:8},{control:'bGo',start:8},{control:'guideLocate',start:2}]){
    await page.reload();
    await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
    await page.getByRole('button',{name:'Start Tutorial',exact:true}).click();
    await page.evaluate(start=>{
      const g=__dbg.G();g.o2=57;g.dose=.25;g.batt=4;g.panelEff=1;g.damaged=0;g.gen=12;g.heat=3;g.pool=13;
      g.alloc={o2:start,food:2,shield:1,sci:2};g.want={...g.alloc};
      for(const a of ['console','depart','move','clean','repair','return','filter','drink'])Expedition.notify(a);
      __dbg.renderAll();
    },start);
    await page.locator('#cabinPower').click();
    if(!await page.locator('#missionGuide').innerText().then(s=>s.includes('3 blocks')&&s.includes('Finish Power Plan')))throw Error('The power tutorial does not explain the goal and the next step');
    if(start===2){
      await page.locator('#guideLocate').click();
      if(await page.evaluate(()=>Expedition.model.step)!=='allocate')throw Error('The power plan finished even with too little power');
    }
    await page.locator('.slot[data-k="o2"] .pl').click();
    await page.locator('#'+control).click();
    if(await page.evaluate(()=>Expedition.model.step)!=='sleep' || !await page.locator('#habitatScene').isVisible())throw Error(control+' Cannot finish the power plan');
    results.push({control,start});
  }
  return {allocation:'8/2/1/2',completedVia:results,next:'sleep'};
}
