async page => {
  await page.route('**/*',route=>route.continue());
  const results=[];
  for(const size of [{width:2032,height:1024},{width:1280,height:720},{width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(size);await page.reload();
    await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
    await page.getByRole('button',{name:'跳过教程',exact:true}).click();
    await page.evaluate(()=>{const g=__dbg.G();g.sol=2;g.events={};g.panelEff=1;g.damaged=0;g.dirtyShown=true;__dbg.beginSol();});
    await page.locator('#cabinPower').click({trial:true});
    const dashboard=await page.locator('#cabinDashboard').boundingBox();
    if(!dashboard)throw Error('物资和电量没有集中到底部');
    const room=await page.locator('#habitatScene').boundingBox(),frame=await page.locator('#frame').evaluate(el=>({width:el.clientWidth,height:el.clientHeight}));
    if(Math.abs(room.width-frame.width)>1||Math.abs(room.height-frame.height)>1)throw Error('2D 场景没有铺满原有区域');
    if(await page.locator('.mission-card').isVisible())throw Error('舱外任务仍然遮住生活舱');
    await page.screenshot({path:`output/playwright/cabin-check-${size.width}x${size.height}.png`});
    if(size.width>700){
      await page.waitForFunction(()=>[...document.querySelectorAll('#cabinDrawing .habitat-object')].every(el=>{const r=el.querySelector('.object-caption').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-object]')===el;}),null,{timeout:5000});
      const blocked=await page.locator('#cabinDrawing').evaluate(svg=>[...svg.querySelectorAll('.habitat-object')].filter(el=>{const label=el.querySelector('.object-caption'),r=label.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-object]')!==el;}).map(el=>el.dataset.object));
      if(blocked.length)throw Error('物品标签被挡住 '+JSON.stringify(blocked));
    }
    const emoji=await page.evaluate(()=>{const nodes=[...document.querySelectorAll('#hud *,#expeditionUI *')].filter(el=>el.children.length===0 && el.getClientRects().length && getComputedStyle(el).visibility!=='hidden');return nodes.map(el=>el.textContent).filter(s=>/\p{Extended_Pictographic}/u.test(s));});
    if(emoji.length)throw Error('界面仍有 emoji '+JSON.stringify(emoji));
    for(const id of ['cabinPower','survivalHUD']){
      const r=await page.locator('#'+id).boundingBox();
      if(r.x<0||r.x+r.width>size.width||r.y+r.height>size.height)throw Error(id+' 超出屏幕');
    }
    await page.waitForFunction(()=>!document.querySelector('#cabinToast').classList.contains('visible'));
    await page.screenshot({path:`output/playwright/cabin-clean-${size.width}.png`});
    await page.getByRole('button',{name:'净水机：消耗电池净化饮用水'}).click();
    await page.getByRole('button',{name:/启动净水/}).click();
    if(await page.evaluate(()=>__dbg.G().water)!==67)throw Error('净水机无法操作');
    if(!await page.locator('#itemPopover').isHidden())throw Error('操作完成后卡片仍挡住其他物品');
    if(await page.locator('#itemPopover').isVisible())await page.locator('.item-close').click();
    await page.locator('#cabinPower').click();
    if(!await page.locator('#notebook').isHidden()||!await page.locator('#power').isVisible())throw Error('控制台入口失效');
    await page.locator('#evaDepart').click();
    if(!await page.locator('#fieldDialog').innerText().then(s=>s.includes('扫描火箭旁的地面')&&s.includes('保存')&&s.includes('科学 +6')))throw Error('出舱前没有说明扫描任务');
    results.push(size);
  }
  return {viewports:results,layout:'full-size fixed scene',emoji:'none',actions:'purifier and console',task:'concrete scan and save'};
}
