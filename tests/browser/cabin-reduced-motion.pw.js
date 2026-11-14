async page => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1280,height:720});await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'Skip Tutorial',exact:true}).click();
  await page.evaluate(()=>{const g=__dbg.G();g.food=19;g.storm=2;__dbg.renderAll();});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#title')).visibility==='hidden'&&getComputedStyle(document.querySelector('#hud')).opacity==='1'&&!document.querySelector('#cabinToast').classList.contains('visible'));
  // Inspect render inputs: GPU dithering can change screenshot bytes even when cosmetic state is frozen.
  await page.evaluate(()=>{
    window.motionFrames=[];
    const original=THREE.Scene.prototype.updateMatrixWorld;
    THREE.Scene.prototype.updateMatrixWorld=function(...args){
      if(this.children.some(o=>o.userData.key==='crew'))window.motionScene=this;
      for(const o of this.children)if(o.material?.uniforms?.time){motionFrames.push(o.material.uniforms.time.value);if(motionFrames.length>120)motionFrames.shift();}
      return original.apply(this,args);
    };
    window.cosmeticState=()=>{
      const state=[];motionScene.traverse(o=>state.push({position:o.position.toArray(),visible:o.visible,glow:o.material?.emissiveIntensity}));return JSON.stringify(state);
    };
  });
  await page.waitForFunction(()=>window.motionScene&&motionFrames.length>2);
  const still=await page.evaluate(()=>cosmeticState());await page.waitForTimeout(250);const later=await page.evaluate(()=>cosmeticState());
  if(still!==later||!await page.evaluate(()=>motionFrames.every(t=>t===0)))throw Error('Reduced motion still animates cabin render inputs');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>motionFrames.at(-1)>0);
  const moving=await page.evaluate(()=>cosmeticState());await page.waitForTimeout(250);const moved=await page.evaluate(()=>cosmeticState());
  if(moving===moved)throw Error('Cabin animation did not resume with motion enabled');
  await page.screenshot({path:'output/playwright/cabin-motion-preference.png'});
  return {reducedMotion:'frozen cosmetic transforms, visibility, glow and shader time',normalMotion:'animation resumed',weather:await page.evaluate(()=>Cabin3D.weather)};
}
