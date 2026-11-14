async page => {
  await page.route('**/*',route=>route.continue());
  await page.setViewportSize({width:390,height:844});await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'Start Tutorial',exact:true}).click();
  await page.locator('#cabinPower').click();
  if(!await page.evaluate(()=>Expedition.model.guide.active)||!await page.locator('#missionGuide').isVisible())throw Error('The active tutorial guide is missing from the phone Console');
  const guide=await page.locator('#missionGuide').boundingBox();
  for(const id of ['meters','power']){
    const r=await page.locator('#'+id).boundingBox();
    if(guide.x<r.x+r.width&&guide.x+guide.width>r.x&&guide.y<r.y+r.height&&guide.y+guide.height>r.y)throw Error('The active phone tutorial covers '+id);
  }
  if(guide.x<0||guide.y<0||guide.x+guide.width>390||guide.y+guide.height>844)throw Error('The active phone tutorial goes off screen');
  await page.screenshot({path:'output/playwright/scene-console-mobile-guide.png'});
  await page.locator('#skipGuide').click();
  if(!await page.locator('#notebook').isHidden())throw Error('The phone console still opens the log');
  await page.locator('#consoleReturn').click({trial:true});
  const panel=await page.locator('#power').boundingBox();
  if(panel.y<400 || panel.y+panel.height>844)throw Error('The phone power card goes off screen');
  for(const k of ['o2','food','shield','sci']){
    for(const control of ['mn','pl']){
      const button=page.locator(`.slot[data-k="${k}"] .${control}`);await button.click({trial:true});
      const r=await button.boundingBox();
      if(r.x<panel.x||r.y<panel.y||r.x+r.width>panel.x+panel.width||r.y+r.height>panel.y+panel.height||r.x<0||r.x+r.width>390||r.y+r.height>844)throw Error(k+' '+control+' power button goes outside the card or screen');
    }
  }
  await page.mouse.move(200,100);await page.waitForTimeout(1500);
  await page.waitForFunction(()=>!document.querySelector('#cabinToast').classList.contains('visible'));
  await page.screenshot({path:'output/playwright/scene-console-mobile.png'});
  await page.locator('#evaDepart').click();
  await page.locator('#fieldDialog').getByRole('button',{name:'Go Out',exact:true}).click();
  if(!await page.locator('#baseConsole').isHidden() || !await page.evaluate(()=>Expedition.outside && World.getPlayer().active))throw Error('The phone console did not switch to a real trip outside');
  return {viewport:'390x844',console:'bottom card',allocation:'all eight power controls reachable',EVA:'third person'};
}
