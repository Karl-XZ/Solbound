async page => {
  // 3D-only paths: clicking the 3D model (not the label) opens the same card; hover glow; weather follows game state.
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.continue());await page.setViewportSize({width:1440,height:860});await page.reload();
  await page.evaluate(()=>{World.setMode('surface');document.querySelector('#title').classList.remove('on');World.reset();__dbg.newGame();__dbg.startGame();});
  await page.getByRole('button',{name:'Skip Tutorial',exact:true}).click();
  await page.evaluate(()=>{const g=__dbg.G();g.sol=2;g.events={};g.panelEff=1;g.damaged=0;g.dirtyShown=true;__dbg.beginSol();});
  await page.waitForTimeout(1500);
  if(await page.locator('#cabinDrawing canvas.cabin3d-canvas').count()!==1)throw Error('The 3D habitat canvas is missing');
  // click on the purifier body: a point between its label and the top of the unit
  const tag=await page.locator('[data-object="purifier"]').boundingBox();
  const x=tag.x+tag.width/2,y=tag.y-90;
  await page.mouse.move(x,y);await page.waitForTimeout(200);
  if(!await page.locator('[data-object="purifier"]').evaluate(el=>el.classList.contains('is-hover')))throw Error('Hovering the 3D water recycler does not highlight it');
  await page.mouse.click(x,y);
  await page.locator('#itemPopover').waitFor({state:'visible',timeout:3000});
  const title=await page.locator('#itemTitle').innerText();
  if(!title.includes('Recycler'))throw Error('Clicking the 3D model opened the wrong card '+title);
  await page.locator('.item-close').click();
  await page.evaluate(()=>{const g=__dbg.G();g.storm=2;__dbg.renderAll();});await page.waitForTimeout(300);
  const storm=await page.locator('#cabinDrawing').getAttribute('data-weather');
  await page.evaluate(()=>{const g=__dbg.G();g.storm=0;__dbg.renderAll();document.querySelector('#frame').classList.add('nightfall');});await page.waitForTimeout(300);
  const night=await page.locator('#cabinDrawing').getAttribute('data-weather');
  await page.evaluate(()=>document.querySelector('#frame').classList.remove('nightfall'));await page.waitForTimeout(300);
  const day=await page.locator('#cabinDrawing').getAttribute('data-weather');
  if(storm!=='storm'||night!=='night'||day!=='day')throw Error('Weather does not follow the game state '+[storm,night,day]);
  if(errors.length)throw Error(errors.join(';'));
  return {pick:'3D model opens '+title,hover:'glow',weather:[storm,night,day]};
}
