async page => {
  await page.route('**/*',r=>r.continue());await page.setViewportSize({width:1680,height:900});await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'开始教程',exact:true}).click();await page.locator('#cabinPower').click();
  const text=await page.locator('#missionGuide').innerText();
  if(/积灰|接头.*松/.test(text))throw Error('出舱前直接宣布尚未看到的故障');
  if(await page.locator('#evaDepart .sw').count())throw Error('出舱按钮仍然伪装成开关');
  if(!await page.locator('#guideLocate').evaluate(el=>el.classList.contains('primary')))throw Error('教程中的出舱按钮不醒目');
  await page.screenshot({path:'output/playwright/departure-guide-visible.png'});
  await page.locator('#guideLocate').click();
  if(!await page.locator('#fieldDialog').innerText().then(t=>t.includes('检查太阳能板')&&!t.includes('供电接头')))throw Error('出舱检查提前宣布故障');
  return {departure:'visible action button',diagnosis:'after inspection'};
}
