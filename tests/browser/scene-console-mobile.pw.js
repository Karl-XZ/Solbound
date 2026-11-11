async page => {
  await page.route('**/*',route=>route.continue());
  await page.setViewportSize({width:390,height:844});await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'跳过教程',exact:true}).click();
  await page.locator('#cabinPower').click();
  if(!await page.locator('#notebook').isHidden())throw Error('手机控制台仍打开日记');
  await page.locator('#consoleReturn').click({trial:true});
  const panel=await page.locator('#power').boundingBox();
  if(panel.y<400 || panel.y+panel.height>844)throw Error('手机能源卡超出屏幕');
  for(const k of ['o2','food','shield','sci']){
    const button=page.locator(`.slot[data-k="${k}"] .mn`);await button.click({trial:true});
    const r=await button.boundingBox();
    if(r.x<0||r.y<panel.y||r.x+r.width>390||r.y+r.height>844)throw Error(k+' 分电按钮超出屏幕');
  }
  await page.mouse.move(200,100);await page.waitForTimeout(1500);
  await page.waitForFunction(()=>!document.querySelector('#cabinToast').classList.contains('visible'));
  await page.screenshot({path:'output/playwright/scene-console-mobile.png'});
  await page.locator('#evaDepart').click();
  await page.locator('#fieldDialog').getByRole('button',{name:'出舱',exact:true}).click();
  if(!await page.locator('#baseConsole').isHidden() || !await page.evaluate(()=>Expedition.outside && World.getPlayer().active))throw Error('手机控制台没有切换到实际出舱');
  return {viewport:'390x844',console:'bottom card',allocation:'four reachable',EVA:'third person'};
}
