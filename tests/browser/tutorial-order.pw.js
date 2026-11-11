async page => {
  await page.route('**/*',route=>route.continue());await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'开始教程'}).click();
  await page.getByRole('button',{name:'净水机：消耗电池净化饮用水'}).click();
  if(await page.locator('#itemPopover').isVisible())await page.getByRole('button',{name:/启动净水/}).click();
  if(await page.evaluate(()=>__dbg.G().water)!==55)throw Error('guided tutorial permits purification before repairing power');
  await page.locator('#viewExterior').click();
  if(!await page.locator('#fieldDialog').isHidden())throw Error('guided departure bypassed power inspection');
  await page.locator('#cabinPower').click();
  if(await page.evaluate(()=>Expedition.model.step)!=='depart' || !await page.locator('#fieldDialog').isHidden())throw Error('console should inspect power without departing');
  await page.locator('#evaDepart').click();
  await page.locator('#fieldDialog').getByRole('button',{name:'取消出舱'}).click();
  if(await page.evaluate(()=>Expedition.outside || __dbg.G().o2!==60))throw Error('cancelling departure charged resources');
  await page.locator('#skipGuide').click();
  await page.locator('#consoleReturn').click();
  await page.getByRole('button',{name:'净水机：消耗电池净化饮用水'}).click();
  await page.getByRole('button',{name:/启动净水/}).click();
  if(await page.evaluate(()=>__dbg.G().water)!==67)throw Error('skipping does not unlock ordinary actions');
  return {order:'power before water',console:'inspection only',skip:'unlocks actions'};
}
