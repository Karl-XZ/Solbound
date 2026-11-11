async (page) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*', route => route.continue());await page.reload();
  await page.getByRole('button',{name:'跳过开场',exact:true}).click();
  await page.getByRole('button',{name:'跟着学，开始第一天 →'}).waitFor({timeout:20000});
  await page.getByRole('button',{name:'跟着学，开始第一天 →'}).click();
  await page.getByRole('button',{name:'净水机：消耗电池净化饮用水'}).click();
  await page.getByRole('button',{name:/启动一轮净水/}).click();
  let g=await page.evaluate(()=>({water:__dbg.G().water,batt:__dbg.G().batt,step:Expedition.model.step}));
  if(g.water!==67 || g.batt!==4 || g.step!=='drink') throw Error('filter '+JSON.stringify(g));
  await page.getByRole('button',{name:'饮水桶：查看水资源与饮水休息'}).click();
  await page.getByRole('button',{name:/倒杯水，歇一会儿/}).click();
  await page.getByRole('button',{name:'电力台：查看发电和分配电力'}).click();
  await page.locator('#closeBook').click();
  await page.getByRole('button',{name:'舱门：检查装备并出舱'}).click();
  await page.getByRole('button',{name:'带上工具，出发 →'}).click();
  g=await page.evaluate(()=>({water:__dbg.G().water,o2:__dbg.G().o2,dose:__dbg.G().dose,step:Expedition.model.step,outside:Expedition.outside,player:World.getPlayer(),sites:{solar:World.getSite('solar'),walk:World.getSite('walk'),door:World.getSite('door')}}));
  if(g.water!==65 || g.o2!==57 || g.dose!==.25 || !g.outside) throw Error('departure '+JSON.stringify(g));
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
  await page.screenshot({path:'output/playwright/at-solar.png'});
  await page.locator('#nearbyAction').click();
  const board=await page.locator('#cleanBoard').boundingBox();
  await page.mouse.move(board.x+10,board.y+10);await page.mouse.down();
  for(let row=0;row<3;row++)for(let col=0;col<6;col++)await page.mouse.move(board.x+(col+.5)*board.width/6,board.y+(row+.5)*board.height/3,{steps:2});
  await page.mouse.up();await page.locator('#finishWork').click();
  let state=await page.evaluate(()=>({eff:__dbg.G().panelEff,damage:__dbg.G().damaged,step:Expedition.model.step}));
  if(state.eff!==1 || state.damage!==1 || state.step!=='repair')throw Error('clean '+JSON.stringify(state));
  await page.locator('#nearbyAction').click();
  await page.locator('#looseConnector').click();await page.locator('#repairSocket').click();await page.locator('#fasten').click();
  await page.screenshot({path:'output/playwright/repair-work.png'});
  await page.locator('#finishWork').click();
  state=await page.evaluate(()=>({damage:__dbg.G().damaged,step:Expedition.model.step,gen:__dbg.G().gen}));
  if(state.damage!==0 || state.step!=='return')throw Error('repair '+JSON.stringify(state));
  await walkTo(solar.x+2,17);await walkTo(2,17);await walkTo(2,12);
  await page.locator('#nearbyAction').click();
  if(await page.evaluate(()=>Expedition.outside))throw Error('return failed');
  await page.getByRole('button',{name:'电力台：查看发电和分配电力'}).click();
  await page.locator('#bGo').click();
  await page.getByRole('button',{name:'再看一下电力安排'}).click();
  await page.locator('#closeBook').click();
  await page.getByRole('button',{name:'床：确认收支并结束一天'}).click();
  await page.getByRole('button',{name:'确认安排，好好休息 →'}).click();
  await page.waitForFunction(()=>__dbg.G().sol===2,null,{timeout:15000});
  const result=await page.evaluate(()=>({sol:__dbg.G().sol,o2:__dbg.G().o2,dose:__dbg.G().dose,guide:Expedition.model.guide,water:__dbg.G().water,hist:__dbg.G().hist.length}));
  if(result.hist!==1 || result.guide.active || result.o2!==57.5 || result.water!==62.5)throw Error('settlement '+JSON.stringify(result));
  await page.screenshot({path:'output/playwright/day-two.png'});
  return {result,errors};
}
