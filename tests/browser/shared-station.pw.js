async page => {
  await page.route('**/*',route=>route.continue());await page.setViewportSize({width:1280,height:720});await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'开始教程',exact:true}).click();
  const svg=page.locator('#cabinDrawing'),before=await svg.boundingBox(),viewBox=await svg.getAttribute('viewBox');
  await page.locator('#skipGuide').click();
  const after=await svg.boundingBox();
  if(JSON.stringify(before)!==JSON.stringify(after)||viewBox!=='0 0 1440 900')throw Error('教程改变了 2D 场景大小或位置');
  if(!await page.locator('#meters').isVisible())throw Error('舱内缺少前哨站状态');
  await page.evaluate(()=>{window.stationMeterBefore=document.querySelector('#meters');});
  await page.locator('#cabinPower').click();
  if(!await page.evaluate(()=>document.querySelector('#meters')===window.stationMeterBefore))throw Error('控制台用了第二套资源栏');
  await page.locator('#consoleReturn').click();
  await page.getByRole('button',{name:'净水机：消耗电池净化饮用水'}).click();await page.getByRole('button',{name:/启动净水/}).click();
  const batt=await page.evaluate(()=>__dbg.G().batt);
  if(!await page.locator('#meters .m-row[data-k="batt"] .v').innerText().then(s=>s.startsWith(String(batt))))throw Error('舱内电池读数未同步');
  await page.locator('#viewExterior').click();await page.locator('#fieldDialog').getByRole('button',{name:'出舱',exact:true}).click();
  if(!await page.locator('#meters').isVisible()||!await page.evaluate(()=>document.querySelector('#meters')===window.stationMeterBefore))throw Error('出舱后丢失共用状态栏');
  const o2=await page.evaluate(()=>Math.round(__dbg.G().o2));
  if(!await page.locator('#meters .m-row[data-k="o2"] .v').innerText().then(s=>s.startsWith(String(o2))))throw Error('出舱氧气读数未同步');
  return {scene:'fixed',station:'one shared DOM',battery:batt,outsideOxygen:o2};
}
