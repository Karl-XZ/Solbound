async page => {
  await page.route('**/*',route=>route.continue());
  const results=[];
  const captionsUncovered=onlyKey=>[...document.querySelectorAll('#cabinDrawing .habitat-object')].filter(el=>!onlyKey||el.dataset.object===onlyKey).every(el=>{
    const r=el.querySelector('.object-caption').getBoundingClientRect();
    return [.08,.5,.92].every(x=>[.08,.5,.92].every(y=>document.elementFromPoint(r.x+r.width*x,r.y+r.height*y)?.closest('[data-object]')===el));
  });
  for(const size of [{width:2032,height:1024},{width:1280,height:720},{width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(size);await page.reload();
    await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
    await page.getByRole('button',{name:'Skip Tutorial',exact:true}).click();
    await page.evaluate(()=>{const g=__dbg.G();g.sol=2;g.events={};g.panelEff=1;g.damaged=0;g.dirtyShown=true;__dbg.beginSol();});
    await page.locator('#cabinPower').click({trial:true});
    const dashboard=await page.locator('#cabinDashboard').boundingBox();
    if(!dashboard)throw Error('Supplies and power are not grouped at the bottom');
    const room=await page.locator('#habitatScene').boundingBox(),frame=await page.locator('#frame').evaluate(el=>({width:el.clientWidth,height:el.clientHeight}));
    if(Math.abs(room.width-frame.width)>1||Math.abs(room.height-frame.height)>1)throw Error('The scene does not fill its area');
    if(await page.locator('.mission-card').isVisible())throw Error('The outside task card still covers the habitat');
    if(size.width>700){
      await page.waitForFunction(()=>[...document.querySelectorAll('#cabinDrawing .habitat-object')].every(el=>{const r=el.querySelector('.object-caption').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-object]')===el;}),null,{timeout:5000});
      const blocked=await page.locator('#cabinDrawing').evaluate(svg=>[...svg.querySelectorAll('.habitat-object')].filter(el=>{const label=el.querySelector('.object-caption'),r=label.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-object]')!==el;}).map(el=>el.dataset.object));
      if(blocked.length)throw Error('An object label is covered '+JSON.stringify(blocked));
      await page.waitForFunction(captionsUncovered,null,{timeout:5000}).catch(async()=>{
        await page.screenshot({path:`output/playwright/cabin-covered-${size.width}.png`});
        const covered=await page.locator('#cabinDrawing [data-object]').evaluateAll(els=>els.filter(el=>{const r=el.querySelector('.object-caption').getBoundingClientRect();return [.08,.5,.92].some(x=>[.08,.5,.92].some(y=>document.elementFromPoint(r.x+r.width*x,r.y+r.height*y)?.closest('[data-object]')!==el));}).map(el=>el.dataset.object));
        throw Error(`Object captions are partly covered at ${size.width}x${size.height}: ${covered.join(',')}`);
      });
    }else{
      const scrollLeft=await page.locator('.room-scroll').evaluate(el=>el.scrollLeft);
      for(const key of await page.locator('#cabinDrawing [data-object]').evaluateAll(els=>els.map(el=>el.dataset.object))){
        await page.locator(`#cabinDrawing [data-object="${key}"]`).scrollIntoViewIfNeeded();
        await page.waitForFunction(captionsUncovered,key,{timeout:5000}).catch(async()=>{await page.screenshot({path:`output/playwright/cabin-covered-${size.width}.png`});throw Error(`Object caption is partly covered at ${size.width}x${size.height}: ${key}`);});
      }
      await page.locator('.room-scroll').evaluate((el,x)=>el.scrollLeft=x,scrollLeft);
    }
    const overlappingMeters=await page.locator('#stationStatus .m-row').evaluateAll(rows=>rows.filter(row=>{const range=document.createRange();range.selectNodeContents(row.querySelector('.m-l'));const label=range.getBoundingClientRect(),bar=row.querySelector('.bar').getBoundingClientRect();return label.bottom>bar.top&&bar.bottom>label.top&&label.right>bar.left+1;}).map(row=>row.dataset.k));
    if(overlappingMeters.length)throw Error('Resource labels overlap their bars '+overlappingMeters.join(','));
    const emoji=await page.evaluate(()=>{const nodes=[...document.querySelectorAll('#hud *,#expeditionUI *')].filter(el=>el.children.length===0 && el.getClientRects().length && getComputedStyle(el).visibility!=='hidden');return nodes.map(el=>el.textContent).filter(s=>/\p{Extended_Pictographic}/u.test(s));});
    if(emoji.length)throw Error('The interface still has emoji '+JSON.stringify(emoji));
    for(const id of ['cabinPower','survivalHUD']){
      const r=await page.locator('#'+id).boundingBox();
      if(r.x<0||r.x+r.width>size.width||r.y+r.height>size.height)throw Error(id+' goes off screen');
    }
    await page.waitForFunction(()=>!document.querySelector('#cabinToast').classList.contains('visible'));
    await page.screenshot({path:`output/playwright/cabin-clean-${size.width}.png`});
    await page.getByRole('button',{name:'Water recycler: use battery power to clean drinking water'}).click();
    await page.getByRole('button',{name:/Start Cleaning Water/}).click();
    if(await page.evaluate(()=>__dbg.G().water)!==67)throw Error('The water recycler does not work');
    if(!await page.locator('#itemPopover').isHidden())throw Error('The card still covers other objects after the action');
    if(await page.locator('#itemPopover').isVisible())await page.locator('.item-close').click();
    await page.locator('#cabinPower').click();
    if(!await page.locator('#notebook').isHidden()||!await page.locator('#power').isVisible())throw Error('The Console entry is broken');
    await page.locator('#evaDepart').click();
    if(!await page.locator('#fieldDialog').innerText().then(s=>s.includes('Scan the ground by the rocket')&&s.includes('save')&&s.includes('Science +6')))throw Error('The scan task was not explained before going out');
    results.push(size);
  }
  return {viewports:results,layout:'full-size fixed scene',emoji:'none',actions:'purifier and console',task:'concrete scan and save'};
}
