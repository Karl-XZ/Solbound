const { test } = require('node:test');
const assert = require('node:assert/strict');
const modelPath = '../js/expedition-model.js', controllerPath = '../js/astronaut.js';
{
  const { create, canAfford, departureCost } = require(modelPath);
  test('reopening or completing a job twice never repeats its effect', () => {
    const m = create(); let count = 0;
    m.add({ id:'repair', kind:'repair', complete:() => count++ });
    assert.equal(m.finish('repair'), false);
    m.start('repair'); assert.equal(m.finish('repair'), true);
    assert.equal(m.start('repair'), false); assert.equal(m.finish('repair'), false); assert.equal(count,1);
  });
  test('cancelled work can resume without being rewarded early', () => {
    const m=create(); let count=0; m.add({id:'clean',complete:()=>count++});
    m.start('clean'); m.cancel('clean'); assert.equal(count,0);
    m.start('clean'); m.finish('clean'); assert.equal(count,1);
  });
  test('samples must return to cabin and can only be analysed once', () => {
    const m=create(); m.collect('rock',18); assert.equal(m.analyse('rock'),0);
    m.returnSamples(); assert.equal(m.analyse('rock'),18); assert.equal(m.analyse('rock'),0);
  });
  test('skipping guide preserves tasks and earned samples', () => {
    const m=create(); m.add({id:'repair'}); m.collect('rock',18);
    m.guide.active=true; m.notify('filter'); m.skip();
    assert.equal(m.guide.active,false); assert.equal(m.tasks[0].phase,'ready'); assert.equal(m.samples[0].status,'carried');
  });
  test('insufficient resources and lethal spending cannot start work', () => {
    const g={o2:3,dose:24.9,batt:1,pool:1};
    assert.equal(canAfford(g,{o2:3}),false); assert.equal(canAfford(g,{dose:.25}),false);
    assert.equal(canAfford(g,{power:2}),false); assert.equal(canAfford(g,{batt:2}),false);
    assert.equal(canAfford({...g,o2:60,dose:0,pool:5},{o2:3,dose:.25,power:2}),true);
  });
  test('a no-power job can fix a base that currently has a power deficit',()=>{
    assert.equal(canAfford({o2:60,dose:0,batt:0,pool:-1},{}),true);
  });
  test('work costs are charged once on completion, never on cancellation',()=>{
    const m=create(),g={o2:60,sci:0};m.add({id:'sample',complete:()=>{g.o2-=5;g.sci+=18;}});
    m.start('sample');m.cancel('sample');assert.deepEqual(g,{o2:60,sci:0});
    m.start('sample');m.finish('sample');m.finish('sample');assert.deepEqual(g,{o2:55,sci:18});
  });
  test('tutorial advances through actual actions and skipping never advances tasks',()=>{
    const m=create();m.guide.active=true;assert.equal(m.step,'filter');
    for(const action of ['filter','drink','console','depart','move','clean','repair','return','allocate','sleep'])m.notify(action);
    assert.equal(m.guide.active,false);assert.equal(m.guide.index,10);
  });
  test('doing a later tutorial action early never strands a once-a-day action',()=>{
    const m=create();m.guide.active=true;m.notify('drink');assert.equal(m.step,'filter');
    m.notify('filter');assert.equal(m.step,'console');
  });
  test('conjunction leak is applied to each actual departure, with its advertised probability boundary',()=>{
    const g={conjRisk:4,today:{flareOut:.5}};
    assert.deepEqual(departureCost(g,.1),{o2:9,dose:.75,leak:true});
    assert.deepEqual(departureCost(g,.9),{o2:3,dose:.75,leak:false});
    assert.deepEqual(departureCost({...g,conjRisk:0},.1),{o2:3,dose:.75,leak:false});
  });
  test('jobs resolved by other means disappear without charging resources or granting rewards',()=>{
    const m=create();let charged=0;m.add({id:'oxygen',needed:g=>g.fault>0,complete:()=>charged++});
    m.start('oxygen');assert.equal(m.reconcile({fault:0}),true);
    assert.equal(m.finish('oxygen'),false);assert.equal(m.start('oxygen'),false);assert.equal(charged,0);
  });
}
{
  const { create }=require(controllerPath);
  test('diagonal movement is normalized and camera relative',()=>{
    const c=create(); c.setActive(true); c.key('KeyW',true); c.key('KeyD',true);
    const p={x:0,z:0}; c.update(1,p,[]); assert.ok(Math.abs(Math.hypot(p.x,p.z)-7)<.001);
    c.clear(); c.yaw=Math.PI/2; c.key('KeyW',true); const q={x:0,z:0}; c.update(1,q,[]); assert.ok(q.x < -6.9); assert.ok(Math.abs(q.z)<.001);
  });
  test('collision prevents walking through a building even with a long frame',()=>{
    const c=create(); c.setActive(true); c.key('KeyW',true); const p={x:0,z:5};
    c.update(1,p,[{x:0,z:0,r:3}]); assert.ok(p.z>=3.6);
  });
  test('pausing clears held input and cannot move after resuming',()=>{
    const c=create(); c.setActive(true); c.key('KeyW',true); c.setActive(false); c.setActive(true);
    const p={x:0,z:0}; c.update(.1,p,[]); assert.deepEqual(p,{x:0,z:0});
  });
}
