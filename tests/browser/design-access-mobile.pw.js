async page => {
  await page.setViewportSize({width:390,height:844});
  await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'跳过教程',exact:true}).click();
  for(const id of ['resourceBook','energyBook','viewOverview']){
    const button=page.locator('#'+id); await button.click({trial:true});
    const r=await button.boundingBox();
    if(!r || r.x<0 || r.y<0 || r.x+r.width>390 || r.y+r.height>844)throw Error(id+' 超出手机屏幕');
    if(!await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}))throw Error(id+' 被其他界面挡住');
  }
  await page.locator('#resourceBook').click();
  if(!await page.locator('#meters').isVisible())throw Error('手机资源仪表打不开');
  await page.locator('#energyBook').click();
  await page.locator('.slot[data-k="sci"] .pl').scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/playwright/restored-energy-mobile.png'});
  const row=await page.locator('.slot[data-k="sci"]').boundingBox();
  if(row.y<0 || row.y+row.height>844)throw Error('手机无法滚动到科研分电');
  await page.locator('#bGo').scrollIntoViewIfNeeded();
  await page.locator('#closeBook').click();
  await page.locator('#viewOverview').click();
  if(await page.locator('#viewOverview').getAttribute('aria-pressed')!=='true')throw Error('手机全景打不开');
  await page.screenshot({path:'output/playwright/restored-panorama-mobile.png'});
  return {viewport:'390x844',shortcuts:'reachable',allocation:'all four reachable',panorama:'visible'};
}
