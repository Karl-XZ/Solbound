async page => {
  await page.route('**/*',route=>route.continue());await page.setViewportSize({width:1280,height:720});await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'开始教程'}).click();
  const initial=await page.evaluate(()=>({gen:__dbg.G().gen,batt:__dbg.G().batt}));
  const text=await page.locator('#cabinPower').innerText();
  if(!text.includes(String(initial.gen))||!text.includes(String(initial.batt))||!text.includes('发电偏低'))throw Error('power readout missing initial problem');
  if(!await page.locator('#missionGuide').innerText().then(s=>s.includes('下方')&&s.includes(String(initial.gen))))throw Error('tutorial points to the wrong power position');
  await page.setViewportSize({width:390,height:844});
  const box=await page.locator('#cabinPower').boundingBox(),guide=await page.locator('#missionGuide').boundingBox();
  if(box.x<0||box.x+box.width>390||box.y<guide.y+guide.height)throw Error('bottom power card overlaps the tutorial');
  await page.screenshot({path:'output/playwright/power-tutorial-mobile.png',scale:'css'});
  await page.locator('#cabinPower').click();
  if(!await page.locator('#missionGuide').innerText().then(s=>s.includes('还没找到原因')&&s.includes('黄色')))throw Error('inspection is diagnosed before the child sees the equipment');
  await page.locator('#skipGuide').click();await page.locator('#consoleReturn').click();
  await page.getByRole('button',{name:'净水机：消耗电池净化饮用水'}).click();await page.getByRole('button',{name:/启动净水/}).click();
  if(await page.locator('#cabinPower').getAttribute('data-battery')!==String(initial.batt-2))throw Error('purification did not visibly spend battery power');
  return {initial,batteryAfterPurifying:initial.batt-2,mobileReadout:box};
}
