async page => {
  const missing=[];
  page.on('requestfailed',req=>{if(req.url().startsWith('http://127.0.0.1:'))missing.push(req.url());});
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
  await page.evaluate(()=>localStorage.removeItem('donki-cache'));
  await page.setViewportSize({width:1280,height:720});await page.reload();
  await page.waitForFunction(()=>document.querySelector('#tDonki').textContent.includes('Offline'));
  await page.evaluate(()=>document.fonts.ready);
  const fonts=await page.evaluate(()=>({body:document.fonts.check('16px Nunito'),heading:document.fonts.check('16px Fredoka')}));
  if(!fonts.body||!fonts.heading)throw Error('Bundled English fonts failed offline');
  async function english(stage){
    const han=await page.evaluate(()=>{
      const values=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){
        const n=walker.currentNode,e=n.parentElement;
        if(e&&!e.closest('script,style,[hidden]')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&/\p{Script=Han}/u.test(n.textContent))values.push(n.textContent);
      }
      for(const e of document.querySelectorAll('[aria-label],[title]'))if(e.getClientRects().length&&!e.closest('[hidden]'))for(const a of ['aria-label','title'])if(/\p{Script=Han}/u.test(e.getAttribute(a)||''))values.push(e.getAttribute(a));
      return values;
    });
    if(han.length)throw Error('Chinese at '+stage+': '+JSON.stringify(han));
  }
  await english('title');await page.locator('#bSrc0').click();await english('sources');
  if(!(await page.locator('#srcCard').innerText()).includes('archive'))throw Error('Offline source does not identify archive');
  await page.locator('#srcX').click();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'Skip Tutorial',exact:true}).click();
  await page.evaluate(()=>{const g=__dbg.G();g.sol=2;g.events={};g.panelEff=1;g.damaged=0;g.dirtyShown=true;__dbg.beginSol();});
  await english('habitat');
  for(const item of ['food','water','purifier','medicine','crew','radio','bench']){
    await page.locator('[data-object="'+item+'"]').click();await english(item+' card');
    if(await page.locator('.item-close').isVisible())await page.locator('.item-close').click();
  }
  await page.locator('#cabinPower').click();await english('console');
  await page.screenshot({path:'output/playwright/english-offline-console.png'});
  if(missing.length)throw Error('Local assets failed: '+missing.join(', '));
  return {language:'English',externalNetwork:'blocked',fallback:'archive',fonts,checkedCards:7,missingAssets:missing};
}
