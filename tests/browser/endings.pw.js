async page => {
  await page.route('**/*', route => route.continue());await page.reload();await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'我会玩，跳过教程'}).click();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(()=>__dbg.endGame('o2'));
  if(await page.locator('#fieldHud').isVisible()||await page.locator('#fieldControls').isVisible())throw Error('field HUD leaked into ending');
  await page.locator('#bAgain').waitFor({state:'visible',timeout:60000});
  await page.screenshot({path:'output/playwright/ending-report.png'});
  await page.locator('#bAgain').click();await page.getByRole('button',{name:'跟着学，开始第一天 →'}).waitFor();
  const state=await page.evaluate(()=>({sol:__dbg.G().sol,water:__dbg.G().water,o2:__dbg.G().o2,samples:Expedition.model.samples.length,tasks:Expedition.model.tasks.length,report:document.querySelector('#report').classList.contains('on')}));
  if(state.sol!==1||state.water!==55||state.o2!==60||state.samples!==0||state.report)throw Error('restart '+JSON.stringify(state));
  if(errors.length)throw Error(errors.join('\n'));
  return {ending:'report shown',restart:state,errors};
}
