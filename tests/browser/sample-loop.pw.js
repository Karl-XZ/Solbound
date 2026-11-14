async page => {
  await page.route('**/*', route => route.continue());await page.reload();await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'Skip Tutorial'}).click();
  await page.evaluate(()=>__dbg.openEvent('delta',()=>{}));
  await page.getByRole('button',{name:/Go out and collect a sample yourself/}).click();
  await page.getByRole('button',{name:'Airlock: check your gear and go outside'}).click();await page.getByRole('button',{name:'Go Out',exact:true}).click();
  async function walkTo(x,z){
    for(let i=0;i<130;i++){
      const p=await page.evaluate(()=>World.getPlayer());if(Math.hypot(p.x-x,p.z-z)<.9)return;
      const keys=[];if(x-p.x>.6)keys.push('KeyD');if(x-p.x<-.6)keys.push('KeyA');if(z-p.z>.6)keys.push('KeyS');if(z-p.z<-.6)keys.push('KeyW');
      for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(110);for(const k of keys)await page.keyboard.up(k);
    }throw Error('sample route blocked');
  }
  await walkTo(2,17);await walkTo(-32,17);await walkTo(-32,-18);await walkTo(-27,-18);
  await page.locator('#nearbyAction').click();await page.locator('#scanRock').click();await page.locator('#collectRock').click();await page.locator('#finishWork').click();
  let state=await page.evaluate(()=>({sci:__dbg.G().sci,o2:__dbg.G().o2,samples:Expedition.model.samples}));
  if(state.sci!==0||state.o2!==52||state.samples[0].status!=='carried')throw Error('sample custody '+JSON.stringify(state));
  await page.locator('#fieldMap').click();await page.getByRole('button',{name:'Move to Airlock'}).click();await page.locator('#nearbyAction').click();
  const before=await page.evaluate(()=>__dbg.G().pool);
  await page.getByRole('button',{name:'Lab bench: analyze rock samples you brought back'}).click();
  await page.getByRole('button',{name:'Start Analysis',exact:true}).click();
  state=await page.evaluate(()=>({sci:__dbg.G().sci,pool:__dbg.G().pool,sample:__dbg.G().sample,samples:Expedition.model.samples}));
  if(state.sci!==18||state.pool!==before-2||!state.sample||state.samples[0].status!=='analysed')throw Error('analysis '+JSON.stringify(state));
  await page.getByRole('button',{name:'Lab bench: analyze rock samples you brought back'}).click();
  if(await page.evaluate(()=>__dbg.G().sci)!==18)throw Error('duplicated sample reward');
  await page.screenshot({path:'output/playwright/sample-analysed.png'});
  return {sampling:'physically completed',analysis:state,repeatedAnalysis:'no reward'};
}
