async page => {
  await page.route('**/*',route=>route.continue());await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'开始教程'}).click();
  if(!await page.locator('#cabinPower').isVisible())throw Error('No visible power readout before opening the notebook');
  const initial=await page.evaluate(()=>({gen:__dbg.G().gen,batt:__dbg.G().batt}));
  const text=await page.locator('#cabinPower').innerText();
  if(!text.includes(String(initial.gen))||!text.includes(String(initial.batt))||!text.includes('发电偏低'))throw Error('power readout does not explain the initial problem');
  if(!await page.locator('#missionGuide').innerText().then(s=>s.includes('上方')&&s.includes(String(initial.gen))))throw Error('tutorial does not point to the visible reading');
  await page.screenshot({path:'output/playwright/power-tutorial-desktop.png',scale:'css'});
  await page.locator('#cabinPower').click();
  if(!await page.locator('#fieldDialog').innerText().then(s=>s.includes('积灰')&&s.includes('接头')))throw Error('inspection lacks a visible cause');
  await page.locator('#fieldDialog').getByRole('button',{name:'关闭说明'}).click();
  await page.setViewportSize({width:390,height:844});
  const box=await page.locator('#cabinPower').boundingBox(),guide=await page.locator('#missionGuide').boundingBox();
  if(box.x<0||box.x+box.width>390||box.y+box.height>guide.y)throw Error('power card hidden under tutorial on mobile');
  await page.screenshot({path:'output/playwright/power-tutorial-mobile.png',scale:'css'});
  await page.locator('#skipGuide').click();
  await page.getByRole('button',{name:'净水机：消耗电池净化饮用水'}).click();await page.getByRole('button',{name:/启动净水/}).click();
  if(await page.locator('#cabinPower').getAttribute('data-battery')!==String(initial.batt-2))throw Error('water purification did not visibly spend battery power');
  return {initial,batteryAfterPurifying:initial.batt-2,mobileReadout:box};
}
