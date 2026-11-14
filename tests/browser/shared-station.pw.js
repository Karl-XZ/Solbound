async page => {
  await page.route('**/*',route=>route.continue());await page.setViewportSize({width:1280,height:720});await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'Start Tutorial',exact:true}).click();
  const svg=page.locator('#cabinDrawing'),before=await svg.boundingBox(),viewBox=await svg.locator('canvas.cabin3d-canvas').count()===1?'0 0 1440 900':'missing 3D canvas';
  await page.locator('#skipGuide').click();
  const after=await svg.boundingBox();
  if(JSON.stringify(before)!==JSON.stringify(after)||viewBox!=='0 0 1440 900')throw Error('The tutorial changed the scene size or position');
  if(!await page.locator('#meters').isVisible())throw Error('Outpost Status is missing inside');
  await page.evaluate(()=>{window.stationMeterBefore=document.querySelector('#meters');});
  await page.locator('#cabinPower').click();
  if(!await page.evaluate(()=>document.querySelector('#meters')===window.stationMeterBefore))throw Error('The Console used a second resource bar');
  await page.locator('#consoleReturn').click();
  await page.getByRole('button',{name:'Water recycler: use battery power to clean drinking water'}).click();await page.getByRole('button',{name:/Start Cleaning Water/}).click();
  const batt=await page.evaluate(()=>__dbg.G().batt);
  if(!await page.locator('#meters .m-row[data-k="batt"] .v').innerText().then(s=>s.startsWith(String(batt))))throw Error('The battery reading inside is out of sync');
  await page.locator('#viewExterior').click();await page.locator('#fieldDialog').getByRole('button',{name:'Go Out',exact:true}).click();
  if(!await page.locator('#meters').isVisible()||!await page.evaluate(()=>document.querySelector('#meters')===window.stationMeterBefore))throw Error('The shared status bar is lost outside');
  const o2=await page.evaluate(()=>Math.round(__dbg.G().o2));
  if(!await page.locator('#meters .m-row[data-k="o2"] .v').innerText().then(s=>s.startsWith(String(o2))))throw Error('The oxygen reading outside is out of sync');
  return {scene:'fixed',station:'one shared DOM',battery:batt,outsideOxygen:o2};
}
