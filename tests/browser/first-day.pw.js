async (page) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*', route => route.continue());await page.reload();
  await page.evaluate(()=>{
    const original=THREE.Scene.prototype.updateMatrixWorld;
    THREE.Scene.prototype.updateMatrixWorld=function(...args){if(this.name==='MarsSurface')window.surfaceUnderTest=this;return original.apply(this,args);};
  });
  await page.getByRole('button',{name:'Skip Intro',exact:true}).click();
  await page.getByRole('button',{name:'Start Tutorial'}).waitFor({timeout:20000});
  await page.getByRole('button',{name:'Start Tutorial'}).click();
  await page.locator('#cabinPower').click();
  if(!await page.locator('#missionGuide').innerText().then(t=>t.includes('know why yet')&&t.includes('yellow')))throw Error('departure should not invent a visible diagnosis');
  await page.locator('#evaDepart').click();
  await page.locator('#fieldDialog').getByRole('button',{name:'Go Out',exact:true}).click();
  let g;
  g=await page.evaluate(()=>({water:__dbg.G().water,o2:__dbg.G().o2,dose:__dbg.G().dose,step:Expedition.model.step,outside:Expedition.outside,player:World.getPlayer(),sites:{solar:World.getSite('solar'),walk:World.getSite('walk'),door:World.getSite('door')}}));
  if(g.water!==55 || g.o2!==57 || g.dose!==.25 || !g.outside) throw Error('departure '+JSON.stringify(g));
  await page.screenshot({path:'output/playwright/third-person.png'});
  await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await page.keyboard.up('KeyD');
  const after=await page.evaluate(()=>World.getPlayer());
  if(after.x<=g.player.x)throw Error('player did not move');

  async function walkTo(x,z) {
    let stuck=0,last=null;
    for(let i=0;i<100;i++) {
      const p=await page.evaluate(()=>World.getPlayer());
      if(Math.hypot(p.x-x,p.z-z)<.9)return;
      if(last && Math.hypot(p.x-last.x,p.z-last.z)<.03)stuck++;else stuck=0;
      if(stuck>8)throw Error('walking stuck '+JSON.stringify({p,target:{x,z}}));
      const keys=[];if(x-p.x>.6)keys.push('KeyD');if(x-p.x<-.6)keys.push('KeyA');if(z-p.z>.6)keys.push('KeyS');if(z-p.z<-.6)keys.push('KeyW');
      for(const k of keys)await page.keyboard.down(k);
      await page.waitForTimeout(110);
      for(const k of keys)await page.keyboard.up(k);
      last=p;
    }
    throw Error('walk timeout');
  }
  await walkTo(11,17);
  if(await page.evaluate(()=>Expedition.model.step)!=='clean')throw Error('movement lesson not complete');
  const solar=await page.evaluate(()=>World.getSite('solar'));
  await walkTo(solar.x+2,17);await walkTo(solar.x+2,solar.z);await walkTo(solar.x,solar.z);
  if(await page.locator('#guideLocate').innerText()==='Look at Solar Panels')await page.locator('#guideLocate').click();
  await page.waitForTimeout(1800);
  const before=await page.evaluate(()=>({gen:__dbg.G().gen,dust:surfaceUnderTest.getObjectByName('solar-dust-front').visible,plugX:surfaceUnderTest.getObjectByName('solar-power-plug').position.x}));
  if(!before.dust||before.plugX<1)throw Error('work site has no visible dust or disconnected plug');
  await page.screenshot({path:'output/playwright/at-solar.png'});
  await page.locator('#nearbyAction').click();
  const board=await page.locator('#cleanBoard').boundingBox();
  await page.mouse.move(board.x+10,board.y+10);await page.mouse.down();
  for(let row=0;row<3;row++)for(let col=0;col<6;col++)await page.mouse.move(board.x+(col+.5)*board.width/6,board.y+(row+.5)*board.height/3,{steps:2});
  await page.mouse.up();await page.locator('#finishWork').click();
  let state=await page.evaluate(()=>({eff:__dbg.G().panelEff,damage:__dbg.G().damaged,step:Expedition.model.step}));
  if(state.eff!==1 || state.damage!==1 || state.step!=='repair')throw Error('clean '+JSON.stringify(state));
  const cleaned=await page.evaluate(()=>({gen:__dbg.G().gen,dust:surfaceUnderTest.getObjectByName('solar-dust-front').visible,plugX:surfaceUnderTest.getObjectByName('solar-power-plug').position.x}));
  if(cleaned.dust||cleaned.plugX<1||cleaned.gen<=before.gen)throw Error('cleaning did not visibly clear dirt and improve generation');
  await page.waitForTimeout(1700);await page.screenshot({path:'output/playwright/solar-clean-plug-loose.png'});
  await page.locator('#nearbyAction').click();
  await page.locator('#looseConnector').click();await page.locator('#repairSocket').click();await page.locator('#fasten').click();
  await page.screenshot({path:'output/playwright/repair-work.png'});
  await page.locator('#finishWork').click();
  state=await page.evaluate(()=>({damage:__dbg.G().damaged,step:Expedition.model.step,gen:__dbg.G().gen}));
  if(state.damage!==0 || state.step!=='return')throw Error('repair '+JSON.stringify(state));
  const fixed=await page.evaluate(()=>({gen:__dbg.G().gen,plugX:surfaceUnderTest.getObjectByName('solar-power-plug').position.x,color:surfaceUnderTest.getObjectByName('solar-power-plug').material.color.getHexString()}));
  if(fixed.plugX!==0||fixed.color!=='7fae5b'||fixed.gen<=cleaned.gen)throw Error('repair did not visibly reconnect the plug and restore generation');
  await page.waitForTimeout(1700);await page.screenshot({path:'output/playwright/solar-repaired.png'});
  await page.locator('#cameraReset').click();
  await walkTo(solar.x+2,17);await walkTo(2,17);await walkTo(2,12);
  await page.locator('#nearbyAction').click();
  if(await page.evaluate(()=>Expedition.outside))throw Error('return failed');
  if(await page.evaluate(()=>Expedition.model.step)!=='filter')throw Error('purification should follow repair');
  await page.getByRole('button',{name:'Water recycler: use battery power to clean drinking water'}).click();
  await page.getByRole('button',{name:/Start Cleaning Water/}).click();
  const water=await page.evaluate(()=>({water:__dbg.G().water,batt:__dbg.G().batt,step:Expedition.model.step}));
  if(water.water!==67||water.batt!==4||water.step!=='drink')throw Error('filter '+JSON.stringify(water));
  await page.getByRole('button',{name:'Water tank: check your water and take a drink'}).click();
  await page.getByRole('button',{name:/Give the astronaut a drink/}).click();
  await page.getByRole('button',{name:'Console: check power and share it out'}).click();
  await page.locator('#guideLocate').click();
  if(await page.evaluate(()=>Expedition.model.step)!=='sleep'||!await page.locator('#notebook').isHidden())throw Error('allocation must lead to the bed');
  await page.getByRole('button',{name:'Bed: check tonight’s gains and losses and end the day'}).click();
  await page.getByRole('button',{name:'Confirm End of Day'}).click();
  await page.waitForFunction(()=>__dbg.G().sol===2,null,{timeout:15000});
  const result=await page.evaluate(()=>({sol:__dbg.G().sol,o2:__dbg.G().o2,dose:__dbg.G().dose,guide:Expedition.model.guide,water:__dbg.G().water,hist:__dbg.G().hist.length}));
  if(result.hist!==1 || result.guide.active || result.o2!==57.5 || result.water!==62.5)throw Error('settlement '+JSON.stringify(result));
  await page.screenshot({path:'output/playwright/day-two.png'});
  return {result,errors};
}
