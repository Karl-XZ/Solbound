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
  await page.locator('#fieldDialog').getByRole('button',{name:'关闭说明'}).click();
  if(await page.evaluate(()=>Expedition.model.step)!=='console')throw Error('closing the explanation advanced the guide');
  await page.locator('#cabinPower').click();
  await page.locator('#fieldDialog').getByRole('button',{name:'检查舱门',exact:true}).click();
  await page.locator('#fieldDialog').getByRole('button',{name:'取消出舱'}).click();
  await page.locator('#skipGuide').click();
  await page.getByRole('button',{name:'净水机：消耗电池净化饮用水'}).click();
  await page.getByRole('button',{name:/启动净水/}).click();
  if(await page.evaluate(()=>__dbg.G().water)!==67)throw Error('skipping does not unlock ordinary actions');
  return {order:'power before water',explanation:'closing does not advance',skip:'unlocks actions'};
}