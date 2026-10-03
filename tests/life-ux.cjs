/* Browser acceptance: reachable controls, editing, keyboard and long-lived simulation. */
'use strict';
process.env.HABITA_TEST_ARTIFACTS ||= '/tmp/habita-life-ux';
const {assert,launch,session,advance,noErrors,shot,reporter,fs,path,ARTIFACTS}=require('./life-helpers.cjs');
const report=reporter();
let browser;
async function reachable(p,selector,{scroll=false}={}){
 const item=p.locator(selector);await item.waitFor({state:'visible'});if(scroll)await item.scrollIntoViewIfNeeded();
 const result=await item.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return{width:r.width,height:r.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,hit:!!hit&&(hit===el||el.contains(hit)),label:el.getAttribute('aria-label')||el.textContent.trim()};});
 assert.ok(result.inside,`${selector} outside viewport: ${JSON.stringify(result)}`);assert.ok(result.hit,`${selector} covered: ${JSON.stringify(result)}`);return result;
}
(async()=>{
 browser=await launch();
 for(const viewport of [{width:375,height:667},{width:390,height:844},{width:1280,height:800}]){
  await report.test('ux-layout',`Home and modal controls are reachable at ${viewport.width}×${viewport.height}`,async()=>{
   const s=await session(browser,{viewport});try{
    // Give the real renderer its first animation frames before visual evidence.
    await advance(s.p,200);
    const geometry={};
    for(const selector of ['#walletBtn','#homeAction','#lifeTeaser','#homePlanLink','#sceneNav [data-scene="coast"]','#tab-decisions'])geometry[selector]=await reachable(s.p,selector);
    const noOverflow=await s.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert.equal(noOverflow,true,'No horizontal document overflow');
    await shot(s.p,`home-${viewport.width}`);
    await s.p.locator('#lifeTeaser').click();await s.p.getByRole('heading',{name:'Proyectos y recuerdos'}).waitFor();
    await reachable(s.p,'[data-action="continue-project"]',{scroll:true});await s.p.evaluate(()=>closeModal());
    await s.p.locator('#walletBtn').click();await s.p.getByRole('heading',{name:'El pequeño mercado'}).waitFor();
    await shot(s.p,`market-${viewport.width}`);
    const preview=s.p.locator('.marketGrid [data-action="preview"]').last();await preview.scrollIntoViewIfNeeded();await preview.click();
    await reachable(s.p,'.marketPanel [data-action="back"]',{scroll:true});await shot(s.p,`market-preview-${viewport.width}`);
    await s.p.locator('.marketPanel [data-action="back"]').click();await s.p.evaluate(()=>closeModal());
    await s.p.locator('#worldTools summary').click();await s.p.getByRole('button',{name:'Mi personaje y preferencias',exact:true}).click();
    await s.p.locator('#wardrobe-save').waitFor();await shot(s.p,`wardrobe-${viewport.width}`);
    await reachable(s.p,'#wardrobe-save',{scroll:true});await reachable(s.p,'#wardrobe-cancel',{scroll:true});
    await s.p.locator('#wardrobe-tab-extras').click();await reachable(s.p,'#wardrobe-save-look',{scroll:true});await reachable(s.p,'#wardrobe-open-shop',{scroll:true});
    await s.p.locator('#wardrobe-cancel').click();
    await s.p.locator('#worldTools summary').click();await s.p.getByRole('button',{name:'Decorar y mover muebles',exact:true}).click();
    await s.p.locator('#houseGrid').waitFor();await shot(s.p,`room-${viewport.width}`);
    for(const selector of ['#houseX','#houseY','[data-house-action="move"]','[data-house-action="save"]','[data-house-action="cancel"]'])geometry[selector]=await reachable(s.p,selector,{scroll:true});
    assert.ok(geometry['#houseX'].height>=44&&geometry['#houseY'].height>=44,'A precise 44px coordinate alternative to small floor cells');
    await s.p.locator('[data-house-action="cancel"]').click();
    assert.equal(await s.p.locator('#modal').evaluate(el=>el.open),false);
    await noErrors(s);return{viewport,geometry};
   }finally{await s.context.close();}
  });
 }
 await report.test('ux-keyboard','Wardrobe has roving tab focus and preserves cancellation',async()=>{
  const s=await session(browser);try{
   const original=await s.p.evaluate(()=>structuredClone(state.profile));
   await s.p.evaluate(()=>openSettings());const face=s.p.locator('#wardrobe-tab-face');await face.focus();
   await s.p.keyboard.press('ArrowRight');assert.equal(await s.p.locator('#wardrobe-tab-hair').getAttribute('aria-selected'),'true');assert.equal(await s.p.locator('#wardrobe-tab-hair').evaluate(e=>document.activeElement===e),true);
   await s.p.keyboard.press('End');assert.equal(await s.p.locator('#wardrobe-tab-extras').getAttribute('aria-selected'),'true');
   await s.p.keyboard.press('Home');assert.equal(await face.getAttribute('aria-selected'),'true');
   assert.equal(await s.p.locator('#wardrobe-fields').getAttribute('aria-labelledby'),'wardrobe-tab-face');
   assert.equal(await s.p.locator('[role="tab"][tabindex="0"]').count(),1);
   await s.p.locator('#avatar-face').selectOption({index:1});await s.p.locator('#name').fill('Una vista previa');
   await s.p.locator('#wardrobe-cancel').click();assert.deepEqual(await s.p.evaluate(()=>state.profile),original);
   await noErrors(s);return{keys:['ArrowRight','End','Home'],singleTabStop:true,cancelPreservesProfile:true};
  }finally{await s.context.close();}
 });
 await report.test('ux-keyboard','Enter previews and buys without closing the modal or implicitly equipping',async()=>{
  const s=await session(browser,{viewport:{width:390,height:844}});try{
   const id='costume-shark',before=await s.p.evaluate(()=>({avatar:structuredClone(state.profile.avatar),balance:run().economy.balance}));
   const price=await s.p.evaluate(item=>HabitaCatalog.get(item).price,id);
   await s.p.evaluate(()=>Market.open());
   const preview=s.p.locator(`.marketGrid [data-action="preview"][data-item="${id}"]`);await preview.focus();await s.p.keyboard.press('Enter');
   assert.equal(await s.p.locator('#modal').evaluate(el=>el.open),true,'Keyboard activation of an inner control is not a backdrop click');
   await s.p.locator('#marketAvatarPreview').waitFor({state:'visible'});
   const buy=s.p.locator(`.marketPanel [data-action="buy"][data-item="${id}"]`);await buy.focus();await s.p.keyboard.press('Enter');
   assert.equal(await s.p.locator('#modal').evaluate(el=>el.open),true,'Purchase receipt stays open for a deliberate next choice');
   const bought=await s.p.evaluate(()=>({avatar:state.profile.avatar,balance:run().economy.balance,purchases:run().economy.ledger.filter(t=>t.kind==='purchase')}));
   assert.deepEqual(bought.avatar,before.avatar,'Buying does not equip');assert.equal(bought.balance,before.balance-price);assert.equal(bought.purchases.length,1);
   await s.p.keyboard.press('Enter');
   assert.deepEqual(await s.p.evaluate(()=>state.profile.avatar),before.avatar,'Repeated Enter on receipt cannot equip');
   assert.equal(await s.p.evaluate(()=>run().economy.balance),bought.balance,'Repeated Enter cannot charge again');
   const equip=s.p.locator(`.marketPanel [data-action="equip"][data-item="${id}"]`);await equip.focus();await s.p.keyboard.press('Enter');
   assert.equal(await s.p.evaluate(()=>state.profile.avatar.costume),id,'A distinct deliberate keyboard action equips');
   assert.equal(await s.p.locator('#modal').evaluate(el=>el.open),false,'Successful equip returns to the world');
   await s.p.evaluate(()=>Market.open());await s.p.mouse.click(1,1);
   assert.equal(await s.p.locator('#modal').evaluate(el=>el.open),false,'Actual pointer click on backdrop still closes');
   await noErrors(s);return{keys:['Enter preview','Enter purchase','Enter receipt','Enter equip'],onePurchase:true,backdropCloses:true};
  }finally{await s.context.close();}
 });
 await report.test('ux-reduced-motion','Reduced motion removes decorative transitions while autonomy continues',async()=>{
  const s=await session(browser,{viewport:{width:375,height:667},reducedMotion:'reduce'});try{
   const css=await s.p.evaluate(()=>({matches:matchMedia('(prefers-reduced-motion: reduce)').matches,reward:getComputedStyle(document.querySelector('#careReward')).animationName,status:getComputedStyle(document.querySelector('#companionStatus')).transitionDuration}));
   assert.equal(css.matches,true);assert.equal(css.reward,'none');assert.match(css.status,/^0s/);
   await advance(s.p,90000);const snap=await s.p.evaluate(()=>({companion:Companion.snapshot(),records:run().records.length}));
   assert.ok(snap.companion.completed>=2,JSON.stringify(snap));assert.equal(snap.records,0);await noErrors(s);return{css,completed:snap.companion.completed};
  }finally{await s.context.close();}
 });
 await report.test('ux-long-run','15 minutes of live RAF retain progress, valid arrivals and bounded reservations',async()=>{
  const s=await session(browser);const observations=[];try{
   let priorTotal=0;const spans=[];const locks=new Map();const stalled=new Map();
   for(const scene of ['coast','plaza','coast']){
    await s.p.evaluate(id=>visitScene(id),scene);locks.clear();stalled.clear();const startTotal=await s.p.evaluate(()=>Companion.snapshot().completed);
    const windowStart=observations.length;
    for(let second=5;second<=300;second+=5){
     await advance(s.p,5000);
     const snap=await s.p.evaluate(()=>({scene:world.getZone(),companion:Companion.snapshot(),life:HabitaLife.snapshot(),player:{x:world.player.x,y:world.player.y,canStand:world.canStand(world.player.x,world.player.y)},npcs:world.npcs.map(n=>({id:n.id,x:n.x,y:n.y,canStand:world.canStand(n.x,n.y),animation:n.anim,task:n.activeTask?.id})),reservations:world.reservationSnapshot(),objects:world.getInteractions().map(o=>o.id),records:run().records.length,notice:!document.querySelector('#activityNotice').classList.contains('hidden'),simTime:world.time}));
     observations.push({second:observations.length*5+5,scene,...snap});assert.equal(snap.scene,scene,'Scene changes require user navigation');assert.equal(snap.records,0,'No real activities generated');assert.equal(snap.notice,false,'Disabled schedules remain silent');
     assert.equal(snap.player.canStand,true,`Avatar inside obstacle: ${JSON.stringify(snap.player)}`);
     assert.ok(snap.npcs.every(n=>n.canStand),`NPC in obstacle: ${JSON.stringify(snap.npcs)}`);
     assert.ok(snap.companion.completed>=priorTotal,'Completion count never rolls backwards');priorTotal=snap.companion.completed;
     if(snap.companion.phase==='doing')assert.ok(Math.hypot(snap.player.x-snap.companion.target.x,snap.player.y-snap.companion.target.y)<=.46,`Avatar starts task before arrival: ${JSON.stringify(snap.companion)}`);
     for(const plan of snap.life.npcPlans){const actor=snap.npcs.find(n=>n.id===plan.id);assert.ok(actor,'NPC plan retains actor');if(plan.phase==='doing')assert.ok(Math.hypot(actor.x-plan.target.x,actor.y-plan.target.y)<=.46,`NPC ${plan.id} starts before arrival`);const key=plan.id+':'+plan.phase+':'+plan.taskId+':'+plan.objectId,previous=stalled.get(plan.id);if(previous?.key===key)assert.ok(snap.simTime-previous.since<=50,`NPC plan stalled: ${key}`);else stalled.set(plan.id,{key,since:snap.simTime});}
     for(const id of [...stalled.keys()])if(!snap.life.npcPlans.some(p=>p.id===id))stalled.delete(id);
     const ownerProgress=id=>id==='player'?String(snap.companion.completed):JSON.stringify(snap.life.neighbours[id]?.recent||[])+':'+(snap.life.neighbours[id]?.meetings||0);
     for(const lock of snap.reservations){assert.equal(lock.sceneId,scene);assert.ok(snap.objects.includes(lock.objectId),'Reserved object exists');assert.ok(lock.actorId==='player'||snap.npcs.some(n=>n.id===lock.actorId),'Reservation owner exists');const key=lock.objectId+':'+lock.actorId,progress=ownerProgress(lock.actorId),before=locks.get(key);if(before?.progress===progress)assert.ok(snap.simTime-before.since<=65,`Reservation without progress >65s: ${key}`);else locks.set(key,{since:snap.simTime,progress});}
     for(const key of [...locks.keys()])if(!snap.reservations.some(r=>key===r.objectId+':'+r.actorId))locks.delete(key);
    }
    const last=observations.at(-1),delta=last.companion.completed-startTotal,section=observations.slice(windowStart);
    assert.ok(delta>=4,`Avatar starved in ${scene}: only ${delta} completions in five minutes`);
    const movedNpcs=last.npcs.filter(n=>section.some(v=>{const p=v.npcs.find(q=>q.id===n.id);return p&&Math.hypot(p.x-n.x,p.y-n.y)>.5;}));assert.equal(movedNpcs.length,last.npcs.length,'Every NPC moves across the observation window');
    const rememberedNpcs=Object.entries(last.life.neighbours).filter(([id,m])=>last.npcs.some(n=>n.id===id)&&(m.recent?.length||m.meetings));assert.equal(rememberedNpcs.length,last.npcs.length,'Every NPC finishes a routine or meeting');
    spans.push({scene,seconds:300,playerCompletions:delta,npcsMoved:movedNpcs.length,npcsWithConsequences:rememberedNpcs.length});await shot(s.p,`long-run-${scene}-${spans.length}`);
   }
   await noErrors(s);return{simulatedSeconds:900,samples:observations.length,spans,totalCompletions:priorTotal};
  }finally{fs.writeFileSync(path.join(ARTIFACTS,'long-run-observations.json'),JSON.stringify(observations,null,2));await s.context.close();}
 });
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();report.finish();});
