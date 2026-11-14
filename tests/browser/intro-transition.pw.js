async page => {
  await page.route('**/*',route=>route.continue());
  await page.setViewportSize({width:1280,height:720});
  const results=[];
  for(const scenario of [{name:'skip-midflight',skipAt:9000},{name:'skip-early',skipAt:1000},{name:'quick',quick:true},{name:'complete'}]){
    await page.reload();
    await page.evaluate(()=>{
      window.transitionFrames=[];
      const original=THREE.PerspectiveCamera.prototype.updateMatrixWorld;
      THREE.PerspectiveCamera.prototype.updateMatrixWorld=function(...args){
        window.transitionCamera=this;
        const result=original.apply(this,args),entry=document.querySelector('#entry');
        if(entry.classList.contains('on'))transitionFrames.push({mode:World.mode,opacity:+getComputedStyle(entry).opacity,p:this.position.toArray(),q:this.quaternion.toArray()});
        return result;
      };
      const stop=World.stopIntro;
      World.stopIntro=function(){window.stoppedPose={p:transitionCamera.position.toArray(),q:transitionCamera.quaternion.toArray()};return stop.call(this);};
    });
    await page.waitForFunction(()=>window.transitionCamera);
    if(scenario.quick)await page.getByRole('button',{name:'Skip Intro',exact:true}).click();
    else{
      await page.getByRole('button',{name:'Start Mission',exact:true}).click();
      if(scenario.skipAt){await page.waitForTimeout(scenario.skipAt);await page.locator('#skip').click();}
    }
    await page.waitForFunction(()=>transitionFrames.some(f=>f.mode==='surface'),null,{timeout:40000});
    const measured=await page.evaluate(()=>{
      const space=transitionFrames.filter(f=>f.mode==='space'),surface=transitionFrames.find(f=>f.mode==='surface');
      const first=window.stoppedPose;
      return {holdFrames:space.length,drift:first?Math.max(...space.map(f=>Math.hypot(...f.p.map((v,i)=>v-first.p[i])))):0,rotationDrift:first?Math.max(...space.map(f=>Math.hypot(...f.q.map((v,i)=>v-first.q[i])))):0,switchOpacity:surface.opacity};
    });
    if(measured.holdFrames<2)throw Error('No camera position recorded before the transition '+scenario.name);
    if(measured.drift>.001||measured.rotationDrift>.001)throw Error('The camera jumped back during the transition '+JSON.stringify({scenario:scenario.name,...measured}));
    if(measured.switchOpacity<.99)throw Error('The cover did not fully hide the scene switch '+JSON.stringify(measured));
    await page.getByRole('button',{name:'Start Tutorial',exact:true}).waitFor({timeout:15000});
    results.push({scenario:scenario.name,...measured});
  }
  return results;
}
