/* Opt-in original audio, durable activity timer and procedural local companion. */
const QuietSound={on:false,ctx:null,loop:null,step:0,busy:false,
 async toggle(){if(this.busy)return;this.busy=true;try{if(this.on){this.on=false;clearInterval(this.loop);this.loop=null;await this.ctx?.suspend()}else{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return toast('Este navegador no permite activar el sonido.');this.ctx=this.ctx||new AC();await this.ctx.resume();this.on=true;this.melody();this.loop=setInterval(()=>this.melody(),12000)}this.label()}catch{this.on=false;clearInterval(this.loop);this.loop=null;this.label();toast('No pudimos activar el sonido. Puedes seguir sin audio.')}finally{this.busy=false}},
 label(){const b=$('#soundControl');if(!b)return;b.setAttribute('aria-pressed',String(this.on));b.setAttribute('aria-label',this.on?'Silenciar música y alertas':'Activar música y alertas suaves');b.textContent=this.on?'♫':'♪';b.classList.toggle('enabled',this.on)},
 note(freq,when,duration=2,volume=.025){if(!this.on||!this.ctx||this.ctx.state!=='running')return;const t=this.ctx.currentTime+when,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.16);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+duration+.05);o.onended=()=>{o.disconnect();g.disconnect()}},
 melody(){if(document.hidden)return;const sequence=[261.63,329.63,392,329.63,293.66,349.23,440,392];for(let i=0;i<4;i++)this.note(sequence[(this.step+i)%sequence.length],i*2.8,3.8,.018);this.note(130.81,0,10,.013);this.step=(this.step+4)%sequence.length},
 chime(){if(this.on&&this.ctx?.state==='suspended'){this.ctx.resume().then(()=>{if(this.on)this.chime()}).catch(()=>{});return}this.note(523.25,0,1.8,.025);this.note(659.25,.3,2,.021);this.note(783.99,.65,2.2,.017)}
};
let pendingCareNotice=null,rewardTimeout=null;
function reminderKey(slot){return localDate()+'-'+slot.index}
function showActivityNotice(slot){if(run().active)return;pendingCareNotice={slot,key:reminderKey(slot)};renderActivityNotice();QuietSound.chime();}
function renderActivityNotice(){const el=$('#activityNotice');if(!el)return;const show=!!pendingCareNotice&&mode==='real'&&!run().active&&page==='world';el.classList.toggle('hidden',!show);if(show){$('#noticeTitle').textContent='Tu momento de '+pendingCareNotice.slot.name.toLowerCase();$('#noticeActivity').textContent=ACTIONS[careSuggestion().options[0].id].name}}
function openActivityNotice(){const o=careSuggestion().options[0],a=ACTIONS[o.id];modal(`<div class="eyebrow">TU MOMENTO · ${pendingCareNotice?esc(pendingCareNotice.slot.time):'A TU RITMO'}</div><h2 style="margin-top:8px">${a.name}</h2><p>${esc(careInstructions(o.id))}</p><div class="notice">${o.duration} minutos · ${esc(a.dim)}<br><span class="small">Puedes terminar antes o dejarlo para otro momento.</span></div><button class="btn full" onclick="beginSuggestedActivity('${o.id}',${o.duration})">Empezar · ${o.duration} min</button><button class="textbtn full" onclick="dismissActivityNotice();closeModal()">Ahora no</button><button class="textbtn full" onclick="dismissActivityNotice();openDecision('home')">Elegir otra actividad</button>`)}
function dismissActivityNotice(){if(pendingCareNotice){const d=run();d.reminderAcks=d.reminderAcks||{};d.reminderAcks[pendingCareNotice.key]=true;const keys=Object.keys(d.reminderAcks);while(keys.length>30)delete d.reminderAcks[keys.shift()];save()}pendingCareNotice=null;renderActivityNotice()}
function beginSuggestedActivity(id,duration){if(run().active)return;current=careSuggestion();const o=current.options.find(x=>x.id===id);if(!o)return;run().active={id:uid(),action:id,duration:o.duration,situation:current.id,title:current.title,day:day(),date:stamp()};run().choices.push({action:id,situation:current.id,status:'accepted',day:day()});dismissActivityNotice();startCareTimer();}
function startCareTimer(){const c=run().active;if(!c)return;if(!c.timerEnd)c.timerEnd=Date.now()+c.duration*60000;save();closeModal();navigate('world');timerTick();}
function timerTick(){const c=run().active,el=$('#careTimer');if(!el)return;if(!c?.timerEnd){el.classList.add('hidden');return}el.classList.remove('hidden');const remaining=Math.max(0,Math.ceil((c.timerEnd-Date.now())/1000));$('#careTimerValue').textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');$('#careTimerLabel').textContent=remaining?'Tu pequeño momento':'Tu tiempo terminó · vuelve a tu ritmo';$('#careTimerProgress').style.setProperty('--progress',String(1-Math.min(1,remaining/(c.duration*60))));if(!remaining&&!c.timerAlerted&&!document.hidden){c.timerAlerted=true;save();QuietSound.chime();toast('Tu tiempo terminó. Cuando quieras, toca «Ya lo hice».')}renderActivityNotice()}
function companionHome(){const c=run().active;$('#homeCard').classList.toggle('isActive',!!c);if(c){$('#homeMode').textContent=mode==='demo'?'ACTIVIDAD DE ENSAYO':'TU ACTIVIDAD';$('#homeCard h2').textContent=ACTIONS[c.action].name;$('#phaseNote').textContent=careInstructions(c.action);$('#homeCopy').textContent='Tú decides cuándo darla por realizada.';$('#homeSchedule').textContent='';$('#homeAction').textContent='Ya lo hice';$('#homeAction').onclick=finishAction;$('#activityControls').classList.remove('hidden');$('#timerStart').classList.toggle('hidden',!!c.timerEnd);$('#homePlanLink').classList.add('hidden')}else{$('#homeCard h2').textContent='Un momento para cuidarte.';$('#homeAction').textContent='Ver mi actividad';$('#homeAction').onclick=openActivityNotice;$('#phaseNote').textContent=realClock().phase.message;$('#activityControls').classList.add('hidden');$('#homePlanLink').classList.remove('hidden')}timerTick();renderActivityNotice()}
function showCareReward(action){const d=run(),dim=ACTIONS[action].dim,n=d.records.filter(r=>r.status==='done'&&r.day===day()).length;$('#rewardDimension').textContent=dim+' · +1 registro';$('#rewardCount').textContent=n+' '+(n===1?'paso registrado':'pasos registrados')+' hoy';$('#careReward').classList.remove('hidden');$('#careReward').setAttribute('aria-label','Paso registrado. '+dim+'. '+n+' registros hoy. Son registros de actividad, no mediciones de salud.');clearTimeout(rewardTimeout);rewardTimeout=setTimeout(()=>$('#careReward').classList.add('hidden'),6500);QuietSound.chime();}
function preferenceScore(action){const d=run(),records=d.records.filter(r=>r.action===action),done=records.filter(r=>r.status==='done').length,skip=records.filter(r=>r.status==='deferred').length;return(done+1)/(done+skip+2)}
const COMPANION_TASKS=[
 {id:'read',label:'leer unas páginas',anim:'read',at:[3.5,5.5],actions:['learn','idea','goal'],prop:'book'},
 {id:'write',label:'anotar una idea',anim:'write',at:[3.5,3.5],actions:['idea','goal','self','prepare'],prop:'pencil'},
 {id:'water',label:'cuidar su planta',anim:'water',at:[5.5,5.5],actions:['organize','water','food'],prop:'water'},
 {id:'tea',label:'preparar una taza',anim:'eat',at:[3.5,5.5],actions:['food','water','rest','social'],prop:'cup'},
 {id:'rest',label:'hacer una pausa junto a su gato',anim:'sit',at:[4.5,4.5],actions:['rest','sleep','self'],prop:'heart'},
 {id:'window',label:'contemplar la luz de la ventana',anim:'look',at:[4.5,3.5],actions:['walk','rest','hobby'],prop:'spark'},
 {id:'stretch',label:'estirarse despacio',anim:'stretch',at:[4.5,5.5],actions:['exercise','walk','box'],prop:null},
 {id:'tidy',label:'acomodar su rincón',anim:'tidy',at:[3.5,3.5],actions:['organize','prepare','goal'],prop:'cloth'},
 {id:'draw',label:'dibujar algo que le gusta',anim:'draw',at:[3.5,5.5],actions:['hobby','idea','self'],prop:'pencil'},
 {id:'cat',label:'acariciar a su gato',anim:'pet',at:[4.5,5.5],actions:['social','self','hobby'],prop:'heart'}
];
/* Scene objects own destinations and available tasks. No fictional task writes a care record. */
const COMPANION_INTEREST_ACTIONS={
 reading:['learn','idea'],art:['hobby','idea','self'],nature:['walk','water','rest'],
 music:['hobby','rest'],movement:['walk','exercise','box'],cooking:['food','water'],projects:['goal','prepare','organize','idea']
};
const COMPANION_MOVEMENT_KEYS=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
const Companion={
 task:null,remaining:0,phase:'idle',queue:[],idle:2,serial:0,history:[],lastAction:null,
 motion:null,target:null,sceneId:null,manualCooldown:0,elapsed:0,stalledFor:0,
 retries:0,failures:0,lastPosition:null,failedTasks:new Set(),subscriptions:[],boundWorld:null,
 memory(){
  const d=run();
  if(!d.companionMemory||!Array.isArray(d.companionMemory.recent))d.companionMemory={recent:[],total:0};
  return d.companionMemory;
 },
 currentScene(){return world?.getScene?.()?.id||world?.getZone?.()||world?.zone||null},
 supported(){return ['home','coast','plaza'].includes(this.currentScene())},
 clearVisual(){world?.setTaskVisual?.(null);if(this.phase==='doing')world?.setActivityAnimation?.('idle',0)},
 dropTask(reason='cancelled'){
  if(this.motion&&world?.motion===this.motion&&this.motion.source==='autonomy'&&this.motion.status==='moving')world.cancelMovement(reason);
  this.clearVisual();this.task=null;this.motion=null;this.target=null;this.remaining=0;
  this.phase='idle';this.elapsed=0;this.stalledFor=0;this.lastPosition=null;this.retries=0;
 },
 reset(){
  this.dropTask('reset');this.queue=[];this.history=[];this.phase='idle';this.idle=2;
  this.lastAction=null;this.manualCooldown=0;this.sceneId=this.currentScene();this.failedTasks.clear();this.status('');
 },
 sceneChanged(){
  this.dropTask('scenechange');this.queue=[];this.sceneId=this.currentScene();this.idle=2;
  this.manualCooldown=0;this.failedTasks.clear();this.status('');
 },
 manualInput(){
  this.dropTask('manualinput');this.queue=[];this.manualCooldown=6;this.idle=1.5;this.status('');
 },
 candidates(){
  const sceneId=this.currentScene();
  return (world?.getTaskCandidates?.()||[]).filter(t=>t&&typeof t.id==='string'&&typeof t.objectId==='string'&&(!t.sceneId||t.sceneId===sceneId)&&Array.isArray(t.usePoints)&&t.usePoints.length).map(t=>({
   ...t,sceneId:t.sceneId||sceneId,key:(t.sceneId||sceneId)+'/'+t.objectId+'/'+t.id,
   animation:t.animation||t.anim||'look',actions:Array.isArray(t.actions)?t.actions:[],
   usePoints:t.usePoints.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&(!world.walkable||world.walkable(p.x,p.y)))
  })).filter(t=>t.usePoints.length);
 },
 choose(action=null,objectId=null){
  let choices=this.candidates().filter(t=>(!objectId||t.objectId===objectId)&&!(!objectId&&state.profile.avoidPhysical&&['stretch','train','run'].includes(t.animation)));
  const available=choices.filter(t=>!this.failedTasks.has(t.key));if(available.length)choices=available;
  if(!choices.length)return null;
  // Care rewards must visibly relate to the confirmed action whenever possible.
  // Failed/unavailable tasks remain excluded; scenes without a match use their usual routine.
  if(action){const related=choices.filter(t=>t.actions.includes(action));if(related.length)choices=related;}
  const memory=this.memory(),recent=memory.recent.slice(-6),lastTwo=recent.slice(-2);
  if(!objectId){const fresh=choices.filter(t=>!lastTwo.includes(t.key)),different=choices.filter(t=>t.key!==recent.at(-1));if(fresh.length)choices=fresh;else if(different.length)choices=different;}
  const goals=(state.profile.care?.goals||[]).flatMap(g=>CARE_GOALS[g]?.actions||[]);
  const interests=(state.profile.interests||[]).flatMap(id=>COMPANION_INTEREST_ACTIONS[id]||[]);
  const hour=realClock().hour;
  const weights=choices.map(t=>{
   let weight=1;
   if(action&&t.actions.includes(action))weight+=5;
   weight+=t.actions.filter(id=>goals.includes(id)).length*.6;
   weight+=t.actions.filter(id=>interests.includes(id)).length*.9;
   if(t.interests?.some(id=>state.profile.interests?.includes(id)))weight+=1.5;
   if(t.actions.length)weight+=t.actions.reduce((sum,id)=>sum+preferenceScore(id),0)/t.actions.length*1.8;
   if(hour>=21||hour<6){if(['sit','read','look','sleep','pet'].includes(t.animation))weight+=2;if(['train','stretch','tidy'].includes(t.animation))weight*=.6;}
   else if(hour<12&&['water','stretch','eat'].includes(t.animation))weight+=1;
   else if(hour>=12&&hour<19&&['draw','write','tidy','walk'].includes(t.animation))weight+=.7;
   const repeats=recent.filter(key=>key===t.key).length;
   return Math.max(.1,weight*Math.pow(.45,repeats));
  });
  let roll=Math.random()*weights.reduce((sum,w)=>sum+w,0),index=0;
  for(;index<weights.length-1;index++){roll-=weights[index];if(roll<=0)break;}
  const task=choices[index],min=Math.max(5,Math.min(40,Number(task.minSeconds)||8)),max=Math.max(min,Math.min(45,Number(task.maxSeconds)||16));
  const duration=min+Math.random()*(max-min);
  const openings=['Con calma, decide','Se toma un momento para','Ahora le apetece'];
  return {...task,duration,caption:openings[Math.floor(Math.random()*openings.length)]+' '+(task.label||task.name||'observar su entorno')+'.',serial:++this.serial};
 },
 begin(action){
  this.dropTask('care-reward');this.lastAction=action;
  const related=this.candidates().filter(t=>t.actions.includes(action)&&!this.failedTasks.has(t.key)&&!(state.profile.avoidPhysical&&['stretch','train','run'].includes(t.animation)));
  const count=new Set(related.map(t=>t.key)).size;
  this.queue=Array.from({length:Math.max(1,Math.min(3,count))},()=>action);this.idle=0;
  // Manual movement keeps its priority; an active activity never finishes itself.
  if(this.manualCooldown<=0&&!world?.paused&&page==='world')this.next();
 },
 next(){
  if(!world||!this.supported()||world.paused||page!=='world'||this.manualCooldown>0)return;
  const task=this.choose(this.queue.length?this.queue.shift():null);
  if(!task){this.idle=5;this.status('');return;}
  this.startTask(task);
 },
 startTask(task){
  this.dropTask('new-task');this.task=task;this.sceneId=this.currentScene();this.phase='travel';this.retries=0;
  this.elapsed=0;this.stalledFor=0;this.lastPosition={x:world.player.x,y:world.player.y};
  this.navigate();
 },
 navigate(){
  if(!this.task)return false;
  const points=[...this.task.usePoints].sort((a,b)=>Math.hypot(a.x-world.player.x,a.y-world.player.y)-Math.hypot(b.x-world.player.x,b.y-world.player.y));
  this.target=points[this.retries%points.length];
  if(world.arrived(this.target,.45)){this.startDoing();return true;}
  this.phase='travel';this.motion=world.navigateTo(this.target.x,this.target.y,{source:'autonomy'});
  this.stalledFor=0;this.lastPosition={x:world.player.x,y:world.player.y};
  this.status('Camina para '+(this.task.label||'acercarse')+'…');
  if(!this.motion||this.motion.status==='failed'){this.recover('unreachable');return false;}
  return true;
 },
 recover(reason){
  if(!this.task)return;
  if(this.retries<2){
   this.clearVisual();
   this.retries++;
   if(this.motion&&world.motion===this.motion&&this.motion.status==='moving')world.cancelMovement(reason);
   this.motion=null;this.elapsed=0;this.navigate();return;
  }
  this.failedTasks.add(this.task.key);if(this.failedTasks.size>24)this.failedTasks.delete(this.failedTasks.values().next().value);
  this.failures++;this.dropTask(reason);this.idle=1.5;this.status('Busca otro momento en su entorno.');
 },
 startDoing(){
  // Empty paths and reported arrival are insufficient: proximity is always checked.
  if(!this.task||!this.target||!world.arrived(this.target,.45)){this.recover('not-at-object');return;}
  if(this.motion&&world.motion===this.motion&&this.motion.status==='moving')world.cancelMovement('task-start');
  const object=world.getScene()?.objects?.find(o=>o.id===this.task.objectId);
  if(object)world.player.dir=Math.atan2(object.y+(object.d||0)/2-world.player.y,object.x+(object.w||0)/2-world.player.x);
  this.phase='doing';this.remaining=this.task.duration;this.elapsed=0;this.stalledFor=0;
  world.setTaskVisual({id:this.task.id,objectId:this.task.objectId,animation:this.task.animation,prop:this.task.prop||null,phase:'doing',progress:0});
  world.setActivityAnimation(this.task.animation,this.task.duration+.5);this.status(this.task.caption);
 },
 complete(){
  const memory=this.memory();
  memory.recent.push(this.task.key);memory.recent=memory.recent.slice(-24);memory.total=(Number(memory.total)||0)+1;
  this.history.push(this.task.id);this.history=this.history.slice(-12);this.failedTasks.clear();
  // Saves only companion memory; real/demo activity records are untouched.
  save();this.dropTask('completed');this.idle=2.5+Math.random()*3;this.status('');
 },
 interact(object){
  if(!object||object.kind==='portal'||!this.supported())return;
  const task=this.choose(null,object.id||object.objectId);if(!task)return;
  this.manualCooldown=0;this.queue=[];this.startTask(task);
 },
 status(text){
  const el=$('#companionStatus');if(!el)return;
  el.textContent=text;el.classList.toggle('hidden',!text||page!=='world'||!this.supported());
 },
 update(dt){
  if(!world||!Number.isFinite(dt)||dt<=0)return;
  if(this.sceneId!==this.currentScene())this.sceneChanged();
  const el=$('#companionStatus');if(el&&(page!=='world'||world.paused||!this.supported()))el.classList.add('hidden');
  if(!this.supported()||world.paused||page!=='world'||document.hidden)return;
  if(this.task)this.status(this.phase==='doing'?this.task.caption:'Camina para '+(this.task.label||'acercarse')+'…');
  if(COMPANION_MOVEMENT_KEYS.some(key=>world.keys?.has(key))){if(this.task)this.manualInput();this.manualCooldown=6;return;}
  if(this.manualCooldown>0){
   // Pointer routes get as long as needed; the grace period starts after arrival.
   if(['manual','interaction'].includes(world.motion?.source)&&world.motion.status==='moving')return;
   this.manualCooldown=Math.max(0,this.manualCooldown-dt);return;
  }
  if(this.task){
   if(this.phase==='travel'){
    this.elapsed+=dt;
    if(this.motion&&world.motion!==this.motion&&['manual','interaction'].includes(world.motion?.source)){this.manualInput();return;}
    if(world.arrived(this.target,.45)){this.startDoing();return;}
    if(!this.motion||['failed','cancelled','arrived','stalled'].includes(this.motion.status)){this.recover('motion-'+(this.motion?.status||'missing'));return;}
    const distance=Math.hypot(world.player.x-this.lastPosition.x,world.player.y-this.lastPosition.y);
    if(distance>.02){this.lastPosition={x:world.player.x,y:world.player.y};this.stalledFor=0;}else this.stalledFor+=dt;
    if(this.stalledFor>=3||this.elapsed>=35)this.recover('stalled');
   }else if(this.phase==='doing'){
    if(!world.arrived(this.target,.45)){this.recover('displaced');return;}
    this.remaining=Math.max(0,this.remaining-dt);
    // Animation deadlines use wall time; restore the pose after a paused modal/tab.
    if(world.anim!==this.task.animation)world.setActivityAnimation(this.task.animation,this.remaining+.5);
    world.setTaskVisual({id:this.task.id,objectId:this.task.objectId,animation:this.task.animation,prop:this.task.prop||null,phase:'doing',progress:Math.min(1,1-this.remaining/this.task.duration)});
    if(this.remaining<=0)this.complete();
   }
  }else{this.idle-=dt;if(this.idle<=0)this.next();}
 },
 cancel(){this.dropTask('cancelled');this.queue=[];this.idle=6;this.status('')},
 snapshot(){
  const memory=this.memory(),point=p=>p?{x:p.x,y:p.y}:null;
  return {
   sceneId:this.currentScene(),phase:this.phase,
   task:this.task?{id:this.task.id,objectId:this.task.objectId,key:this.task.key,animation:this.task.animation,target:point(this.target),duration:this.task.duration}:null,
   target:point(this.target),motion:this.motion?{id:this.motion.id,status:this.motion.status,target:point(this.motion.target),source:this.motion.source}:null,
   remaining:this.remaining,idle:this.idle,serial:this.serial,manualCooldown:this.manualCooldown,
   completed:memory.total,total:memory.total,recent:[...memory.recent],history:[...this.history],retries:this.retries,failures:this.failures
  };
 }
};
function openCompanionAbout(){modal(`<div class="eyebrow">TU COMPAÑERO</div><h2 style="margin-top:8px">Un ritmo que se parece al tuyo.</h2><p>Elige pequeños momentos en casa, la costanera y el jardín. Considera tus intereses, objetivos, actividades realizadas o pospuestas, la hora del día y lo que hizo recientemente. También introduce variación al azar.</p><p>Camina hasta un objeto antes de usarlo. Puedes tocar muebles y lugares para compartir un momento; después recupera su propio ritmo. Combina un catálogo ampliable de tareas, objetos, duraciones y gestos. No tiene conciencia real.</p><p class="small">Su apariencia la eliges tú. Sus gestos son ficción y sus indicadores cuentan actividades; no evalúan tu salud o personalidad. Las preferencias y recuerdos se guardan en este navegador y las acciones del personaje no completan actividades reales.</p><button class="btn full" onclick="closeModal()">Volver a mi rincón</button>`)}
let companionTimerInterval=null,companionVisibilityBound=false;
function initCompanion(){
 if(!companionTimerInterval)companionTimerInterval=setInterval(timerTick,500);
 QuietSound.label();
 if(Companion.boundWorld!==world){
  Companion.subscriptions.forEach(unsubscribe=>unsubscribe());Companion.subscriptions=[];Companion.boundWorld=world;
  Companion.subscriptions.push(world.on('scenechange',()=>Companion.sceneChanged()));
  Companion.subscriptions.push(world.on('manualinput',()=>Companion.manualInput()));
  Companion.subscriptions.push(world.on('interaction',event=>Companion.interact(event.object)));
  Companion.sceneChanged();
 }
 if(!companionVisibilityBound){
  companionVisibilityBound=true;
  document.addEventListener('visibilitychange',()=>{
   if(QuietSound.on){if(document.hidden)QuietSound.ctx?.suspend();else QuietSound.ctx?.resume().catch(()=>{});}
   if(!document.hidden)timerTick();
  });
 }
 timerTick();
}
/* Retained compatibility helper; manual input is now owned by the engine events. */
function thisInputCancel(){return Companion.manualInput()}
