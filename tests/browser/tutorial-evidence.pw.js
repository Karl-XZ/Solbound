async page => {
  await page.route('**/*',r=>r.continue());await page.setViewportSize({width:1680,height:900});await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'Start Tutorial',exact:true}).click();await page.locator('#cabinPower').click();
  const text=await page.locator('#missionGuide').innerText();
  if(/[Dd]usty|[Ll]oose [Pp]lug|[Pp]lug is loose/.test(text))throw Error('The trip check announced a fault that was not seen yet');
  if(await page.locator('#evaDepart .sw').count())throw Error('The Go Outside button still looks like a switch');
  if(!await page.locator('#guideLocate').evaluate(el=>el.classList.contains('primary')))throw Error('The Go Outside button in the tutorial does not stand out');
  await page.screenshot({path:'output/playwright/departure-guide-visible.png'});
  await page.locator('#guideLocate').click();
  if(!await page.locator('#fieldDialog').innerText().then(t=>t.includes('check the solar panels')&&!t.includes('Power plug')))throw Error('The trip check announced the fault too early');
  return {departure:'visible action button',diagnosis:'after inspection'};
}
