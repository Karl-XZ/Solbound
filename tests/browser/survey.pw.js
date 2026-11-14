async page => {
  await page.route('**/*',route=>route.continue());await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'Skip Tutorial'}).click();
  await page.locator('#viewExterior').click();await page.getByRole('button',{name:'Go Out',exact:true}).click();
  async function walkTo(x,z) {
    let stuck=0,last=null;
    for(let i=0;i<100;i++) {
      const p=await page.evaluate(()=>World.getPlayer());
      if(Math.hypot(p.x-x,p.z-z)<.9)return;
      if(last && Math.hypot(p.x-last.x,p.z-last.z)<.03)stuck++;else stuck=0;
      if(stuck>8)throw Error('walking stuck '+JSON.stringify({p,target:{x,z}}));
      const keys=[];if(x-p.x>.6)keys.push('KeyD');if(x-p.x<-.6)keys.push('KeyA');if(z-p.z>.6)keys.push('KeyS');if(z-p.z<-.6)keys.push('KeyW');
      for(const k of keys)await page.keyboard.down(k);
      await page.waitForTimeout(110);
      for(const k of keys)await page.keyboard.up(k);
      last=p;
    }
    throw Error('walk timeout');
  }

  await walkTo(2,17);await walkTo(-20,17);await walkTo(-20,23);
  await page.locator('#nearbyAction').click();
  const label=(await page.locator('#scanRock').innerText()).replace(/^[①②③]\s*/, '');
  const instruction=await page.locator('#sampleInstruction').innerText();
  if(!instruction.includes(label))throw Error('instruction names a different button: '+JSON.stringify({label,instruction}));
  await page.locator('#scanRock').click();await page.locator('#collectRock').click();await page.locator('#finishWork').click();
  const sci=await page.evaluate(()=>__dbg.G().sci);if(sci!==6)throw Error('survey reward');
  return {label,instruction,science:sci};
}