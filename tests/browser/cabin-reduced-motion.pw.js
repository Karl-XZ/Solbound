async page => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1280,height:720});await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'跳过教程',exact:true}).click();
  await page.evaluate(()=>{const g=__dbg.G();g.water=5;g.storm=2;__dbg.renderAll();});
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
  const canvas=page.locator('.cabin3d-canvas');
  const still=await canvas.screenshot();await page.waitForTimeout(250);const later=await canvas.screenshot();
  if(!still.equals(later))throw Error('Reduced motion still animates the cabin');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(200);
  const moving=await canvas.screenshot();await page.waitForTimeout(250);const moved=await canvas.screenshot();
  if(moving.equals(moved))throw Error('Cabin animation did not resume with motion enabled');
  await page.screenshot({path:'output/playwright/cabin-motion-preference.png'});
  return {reducedMotion:'static cabin',normalMotion:'animated cabin',weather:await page.evaluate(()=>Cabin3D.weather)};
}
