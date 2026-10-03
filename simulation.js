/* Habita · local memory, contextual plans and independent neighbour encounters. */
window.HabitaLife=(()=>{
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),clone=v=>JSON.parse(JSON.stringify(v));
const NEIGHBOURS={
 'coast-reader':{name:'Emilia',interest:'los libros y el mar',topics:['el libro que lleva al paseo','una historia que descubrió ayer','el dibujo que quiere comenzar']},
 'coast-walker':{name:'Tomás',interest:'los paseos y la fotografía',topics:['la luz que cambia sobre el Pacífico','su camino favorito por la costanera','una gaviota que vio esta mañana']},
 'plaza-gardener':{name:'Sol',interest:'las plantas y la cocina',topics:['las flores nuevas del jardín','una receta que quiere probar','cómo cuidar una planta pequeña']},
 'plaza-visitor':{name:'Nico',interest:'la música y los dibujos',topics:['una melodía que está practicando','los colores del Reloj de Flores','un dibujo que dejó por terminar']}
};
const PROJECTS={
 art:{title:'Un dibujo con historia',steps:[{label:'Buscar inspiración junto al mar',scene:'coast'},{label:'Dibujar en casa',scene:'home'},{label:'Colgar el dibujo terminado',scene:'home'}],reward:24},
 garden:{title:'Una planta que crece contigo',steps:[{label:'Cuidar una planta',scene:'home'},{label:'Observar las hojas nuevas',scene:'home'},{label:'Preparar su rincón',scene:'home'}],reward:18},
 recipe:{title:'Una pequeña receta para compartir',steps:[{label:'Preparar la mesa',scene:'home'},{label:'Preparar algo sencillo',scene:'home'},{label:'Disfrutar lo preparado',scene:'home'}],reward:20}
};
const fresh=()=>({version:1,simSeconds:0,lastSeenAt:Date.now(),needs:{energy:72,comfort:75,curiosity:64,social:66},projects:[],memories:[],relationships:{},homeEffects:{artwork:0,plantGrowth:0,meals:0},careEchoes:[],returnSummary:null,neighbours:{}});
function validate(value){
 const fail=()=>{throw Error('Vida local no compatible')},obj=x=>x&&typeof x==='object'&&!Array.isArray(x),num=(x,max=1e14)=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max?x:fail(),str=(x,max=600)=>typeof x==='string'&&x.length<=max?x:fail(),id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x)?x:fail(),arr=(x,max)=>Array.isArray(x)&&x.length<=max?x:fail();
 if(!obj(value)||value.version!==1||!obj(value.needs)||!obj(value.homeEffects)||!obj(value.relationships))fail();
 const out=fresh();out.simSeconds=num(value.simSeconds,1e9);out.lastSeenAt=num(value.lastSeenAt);for(const k of Object.keys(out.needs))out.needs[k]=num(value.needs[k],100);
 out.projects=arr(value.projects,12).map(p=>{if(!obj(p)||!Object.hasOwn(PROJECTS,p.type)||!['active','completed'].includes(p.status)||!Number.isInteger(p.stage)||p.status==='completed'&&p.stage!==3||p.status==='active'&&p.stage>=3)fail();return{id:id(p.id),type:p.type,title:str(p.title,120),stage:num(p.stage,3),status:p.status,createdAt:num(p.createdAt),detail:str(p.detail,160),...(p.completedAt!==undefined?{completedAt:num(p.completedAt)}:{})};});
 if(out.projects.filter(p=>p.status==='active').length>1||new Set(out.projects.map(p=>p.id)).size!==out.projects.length)fail();
 out.memories=arr(value.memories,60).map(m=>{if(!obj(m))fail();return{id:id(m.id),at:num(m.at),kind:str(m.kind,40),title:str(m.title,120),text:str(m.text,600),sceneId:str(m.sceneId,30),...(m.npcId?{npcId:id(m.npcId)}:{}),...(m.recordId!==undefined?{recordId:id(m.recordId)}:{})};});
 if(Object.keys(value.relationships).length>30)fail();for(const [key,r]of Object.entries(value.relationships)){id(key);if(['__proto__','prototype','constructor'].includes(key)||!obj(r))fail();out.relationships[key]={name:str(r.name,40),affinity:num(r.affinity,100),encounters:num(r.encounters,1e7),lastAt:num(r.lastAt),lastTopic:str(r.lastTopic,160)};}
 for(const k of Object.keys(out.homeEffects))out.homeEffects[k]=num(value.homeEffects[k],1e7);
 out.careEchoes=arr(value.careEchoes,12).map(e=>{if(!obj(e)||typeof e.action!=='string'||typeof ACTIONS!=='undefined'&&!Object.hasOwn(ACTIONS,e.action))fail();return{action:str(e.action,60),at:num(e.at),...(e.recordId?{recordId:id(e.recordId)}:{})};});
 out.returnSummary=value.returnSummary===null?null:str(value.returnSummary,1200);
 if(value.neighbours!==undefined){if(!obj(value.neighbours)||Object.keys(value.neighbours).length>30)fail();for(const [key,n]of Object.entries(value.neighbours)){id(key);if(!Object.hasOwn(NEIGHBOURS,key)||!obj(n)||!obj(n.needs)||!obj(n.known))fail();const needs={};for(const name of Object.keys(out.needs))needs[name]=num(n.needs[name],100);if(Object.keys(n.known).length>20)fail();const known={};for(const [other,k]of Object.entries(n.known)){if(!Object.hasOwn(NEIGHBOURS,other)||!obj(k))fail();known[other]={name:str(k.name,40),encounters:num(k.encounters,1e7),lastTopic:str(k.lastTopic,160)};}out.neighbours[key]={needs,goal:str(n.goal,250),recent:arr(n.recent,8).map(t=>str(t,120)),meetings:num(n.meetings,1e7),lastAt:num(n.lastAt),known};}}
 return out;
}
const api={
 world:null,boundRun:null,encounter:null,encounterWait:12,lastSavedAt:0,projectWait:0,visibilityBound:false,npcPlans:new Map(),npcWait:new Map(),npcEncounter:null,npcEncounterWait:26,
 fresh,validate,
 ensure(data=run()){if(!data.life)data.life=fresh();if(!data.life.neighbours)data.life.neighbours={};return data.life;},
 init(w){
  this.world=w;this.boundRun=run();const life=this.ensure();const now=Date.now(),elapsed=Math.max(0,now-life.lastSeenAt);
  if(elapsed>=5*60000){
   const minutes=Math.floor(elapsed/60000),duration=minutes<60?minutes+' minutos':Math.floor(minutes/60)+' '+(minutes<120?'hora':'horas');
   const p=this.activeProject(),continuity=p?'Su proyecto «'+p.title+'» espera en la misma etapa.':'Sus próximos planes siguen abiertos.';
   life.returnSummary='Volviste después de '+duration+'. Reconstruimos un pequeño momento de descanso en casa. '+continuity+' La simulación no se ejecutó continuamente mientras la aplicación estaba cerrada.';
   // An absence never takes away money, objects, wellbeing or progress.
   life.needs.energy=Math.max(life.needs.energy,72);life.needs.comfort=Math.max(life.needs.comfort,75);
   this.remember('return','La vida continúa',life.returnSummary,'home');
  }
  life.lastSeenAt=now;this.lastSavedAt=now;this.encounterWait=12;this.cancelEncounter('initialise');this.cancelNeighbours('initialise');
  if(!life.projects.length)this.newProject();save();
  if(!this.visibilityBound){this.visibilityBound=true;document.addEventListener('visibilitychange',()=>{if(document.hidden){this.ensure().lastSeenAt=Date.now();save();}});}
 },
 ensureBound(){if(this.boundRun!==run())this.init(this.world||world);},
 remember(kind,title,text,sceneId=this.world?.getZone?.()||'home',npcId=null,recordId=null){const life=this.ensure(),memory={id:uid(),at:Date.now(),kind,title,text,sceneId,...(npcId?{npcId}:{}),...(recordId?{recordId}:{})};life.memories.push(memory);life.memories=life.memories.slice(-60);return memory;},
 activeProject(){return this.ensure().projects.find(p=>p.status==='active')||null;},
 newProject(type=null){
  const life=this.ensure();if(this.activeProject())return this.activeProject();
  const interests=state.profile.interests||[],types=interests.includes('cooking')?['recipe','art','garden']:interests.includes('nature')?['garden','art','recipe']:['art','garden','recipe'];
  const latest=life.projects.at(-1);type=type||types.find(t=>t!==latest?.type)||'art';if(!Object.hasOwn(PROJECTS,type))return null;
  const themes=['La luz del Pacífico','Las flores del Reloj','Una tarde en Viña','Mi rincón junto al gato','Un paseo que quiero recordar'];
  const detail=type==='art'?themes[life.homeEffects.artwork%themes.length]:type==='garden'?['Una hoja nueva','Mi planta junto a la ventana','Un rincón verde'][life.homeEffects.plantGrowth%3]:['Una taza y algo rico','Una mesa preparada con cariño','Una receta a mi manera'][life.homeEffects.meals%3];
  const p={id:uid(),type,title:PROJECTS[type].title,stage:0,status:'active',createdAt:Date.now(),detail};life.projects.push(p);life.projects=life.projects.slice(-12);this.projectWait=0;
  this.remember('project-start','Un propósito nuevo',type==='art'?'Quiere buscar inspiración en la costanera y llevarla a un dibujo en casa.':type==='garden'?'Quiere cuidar su planta y ver cómo cambia su rincón.':'Quiere preparar algo sencillo y disfrutarlo en su casa.');save();return p;
 },
 matchesProject(task,p){
  if(!p||p.status!=='active')return false;const a=task.animation||task.anim,id=task.id,scene=task.sceneId||this.world?.getZone?.();
  if(p.type==='art'){if(p.stage===0)return['coast','plaza'].includes(scene)&&['look','draw','write'].includes(a);if(p.stage===1)return scene==='home'&&['draw','write'].includes(a);if(p.stage===2)return scene==='home'&&(task.objectId==='home-window'||task.type==='window'||task.id==='hang-art');}
  if(p.type==='garden'){if(scene!=='home')return false;if(p.stage===0)return a==='water';if(p.stage===1)return a==='look'&&(/plant|leaf/.test(id)||task.prop==='leaf');if(p.stage===2)return['tidy','water'].includes(a);}
  if(p.type==='recipe'){if(scene!=='home')return false;if(p.stage===0)return a==='tidy'&&(/table|prepare|kitchen/.test(task.objectId+' '+id));if(p.stage===1)return a==='eat';if(p.stage===2)return a==='eat';}
  return false;
 },
 decorate(task,p=this.activeProject()){
  if(!this.matchesProject(task,p))return task;const step=PROJECTS[p.type].steps[p.stage];
  const decorated={...task,lifeProject:{id:p.id,stage:p.stage},reason:'Quiere '+step.label.toLowerCase()+' para «'+p.detail+'».'};
  if(p.type==='art'&&p.stage===2){decorated.id='hang-art';decorated.animation='tidy';decorated.prop='frame';decorated.label='colgar el dibujo que terminó';decorated.minSeconds=7;decorated.maxSeconds=10;}
  if(p.type==='recipe'&&p.stage===1){decorated.label='preparar su pequeña receta';decorated.prop='cup';decorated.animation='eat';}
  if(p.type==='recipe'&&p.stage===2){decorated.label='disfrutar lo que preparó';decorated.animation='eat';}
  if(p.type==='garden'&&p.stage===2)decorated.label='acomodar el rincón de su planta';
  return decorated;
 },
 priority(candidates){
  const p=this.activeProject();if(!p)return null;
  const matching=candidates.filter(t=>this.matchesProject(t,p));if(!matching.length)return null;
  // Prefer the workspace or the sea horizon instead of an unrelated pose.
  matching.sort((a,b)=>Number(/desk|easel|view|plant/.test(b.objectId))-Number(/desk|easel|view|plant/.test(a.objectId)));
  return this.decorate(matching[0],p);
 },
 weight(task){const needs=this.ensure().needs,a=task.animation;let w=1;if(['sit','sleep','pet'].includes(a))w+=(100-needs.energy)/45;if(['look','draw','read','write'].includes(a))w+=(100-needs.curiosity)/45;if(['wave','pet'].includes(a))w+=(100-needs.social)/50;if(['tidy','water','eat'].includes(a))w+=(100-needs.comfort)/50;return w;},
 completed(task){
  const life=this.ensure(),a=task.animation;life.needs.energy=clamp(life.needs.energy+(['sit','sleep','eat','pet'].includes(a)?8:-2),25,100);life.needs.comfort=clamp(life.needs.comfort+(['tidy','water','eat'].includes(a)?8:0),25,100);life.needs.curiosity=clamp(life.needs.curiosity+(['look','draw','read','write'].includes(a)?9:0),25,100);life.needs.social=clamp(life.needs.social+(a==='pet'||a==='wave'?7:0),25,100);
  const p=this.activeProject();if(!p||!task.lifeProject||task.lifeProject.id!==p.id||task.lifeProject.stage!==p.stage)return;
  const stage=p.stage;p.stage=Math.min(3,p.stage+1);const config=PROJECTS[p.type];
  this.remember('project-step',config.steps[stage].label,p.type==='art'&&stage===0?'Se quedó con una idea: «'+p.detail+'». Quiere dibujarla al volver a casa.':p.type==='art'&&stage===1?'Terminó el boceto «'+p.detail+'». Ahora busca un lugar para colgarlo.':'Avanzó en «'+p.title+'»: '+config.steps[stage].label.toLowerCase()+'.');
  if(p.stage>=3){p.status='completed';p.completedAt=Date.now();const key={art:'artwork',garden:'plantGrowth',recipe:'meals'}[p.type];life.homeEffects[key]++;this.projectWait=30;this.remember('project-complete','Un proyecto que deja huella',p.type==='art'?'Colgó «'+p.detail+'» en casa. Ese dibujo conserva la historia de su paseo.':p.type==='garden'?'Su planta tiene una hoja nueva. El rincón guarda el cuidado que le dedicó.':'Terminó y disfrutó su receta. La mesa recuerda ese pequeño momento.');window.HabitaEconomy?.rewardProject?.(p.id);}
  save();
 },
 onCare(action,recordId){
  this.ensureBound();const life=this.ensure();if(recordId&&life.careEchoes.some(e=>e.recordId===recordId))return;
  life.careEchoes.push({action,at:Date.now(),...(recordId?{recordId}:{})});life.careEchoes=life.careEchoes.slice(-12);
  const a=ACTIONS[action];this.remember('care','Tu momento deja una huella','Registraste «'+(a?.name||action)+'». Ese paso inspira un momento relacionado de tu compañero.',this.world?.getZone?.()||'home',null,recordId);save();
 },
 correctCare(recordId,action){
  const life=this.ensure(),echoes=life.careEchoes.filter(e=>e.recordId===recordId),label=ACTIONS[action]?.name||action;
  const legacy=life.memories.filter(m=>m.kind==='care'&&m.recordId===undefined&&m.text.includes('«'+label+'»')),removeLegacy=new Set();
  // Earlier care memories had no record ID. Match only an exact, unique echo timestamp and action.
  for(const echo of echoes.filter(e=>e.action===action)){
   const matches=legacy.filter(m=>m.at===echo.at),sameMoment=life.careEchoes.filter(e=>e.at===echo.at&&e.action===action);
   if(matches.length===1&&sameMoment.length===1)removeLegacy.add(matches[0].id);
  }
  const ambiguous=legacy.some(m=>!removeLegacy.has(m.id)&&!life.careEchoes.some(e=>e.recordId&&e.recordId!==recordId&&e.action===action&&e.at===m.at));
  life.careEchoes=life.careEchoes.filter(e=>e.recordId!==recordId);
  life.memories=life.memories.filter(m=>!(m.kind==='care'&&m.recordId===recordId)&&!removeLegacy.has(m.id));
  if(ambiguous)this.remember('care-correction','Un registro corregido','Retiraste «'+label+'» de tus actividades. Los recuerdos anteriores que no pudimos vincular de forma inequívoca se conservaron como parte de la historia.',this.world?.getZone?.()||'home',null,recordId);
 },
 sceneChanged(){this.cancelEncounter('scenechange');this.cancelNeighbours('scenechange');this.encounterWait=8;this.npcEncounterWait=26;},
 manualInput(){this.cancelEncounter('manualinput');this.encounterWait=12;},
 cancelEncounter(reason='cancelled'){
  const e=this.encounter;if(e&&this.world){this.world.cancelActor?.(e.npcId,reason);this.world.setActorTask?.(e.npcId,null);this.world.releaseActorControl?.(e.npcId);const n=this.world.getActor?.(e.npcId);if(n)n.bubble=null;}
  this.encounter=null;
 },
 beginEncounter(){
  const w=this.world;if(!w?.navigateActor||!w.npcs?.length||Companion.manualCooldown>0||Companion.phase!=='idle'||w.moving||w.motion?.status==='moving')return false;
  const life=this.ensure(),possible=w.npcs.filter(n=>NEIGHBOURS[n.id]&&!n.directorOwned);if(!possible.length)return false;
  possible.sort((a,b)=>(life.relationships[a.id]?.lastAt||0)-(life.relationships[b.id]?.lastAt||0));
  for(const n of possible){
   const offsets=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];const points=offsets.map(p=>({x:Math.floor(w.player.x)+.5+p.x,y:Math.floor(w.player.y)+.5+p.y})).filter(p=>w.canStand(p.x,p.y)).sort((a,b)=>Math.hypot(a.x-n.x,a.y-n.y)-Math.hypot(b.x-n.x,b.y-n.y));
   for(const target of points){const m=w.navigateActor(n.id,target.x,target.y,{source:'encounter'});if(!m||m.status==='failed'){w.releaseActorControl?.(n.id);continue;}
    this.encounter={npcId:n.id,name:NEIGHBOURS[n.id].name,phase:'approach',target,motion:m,elapsed:0,remaining:0,initiatedBy:'npc',reason:'Quiere acercarse a conversar contigo.'};n.bubble={text:'¿Te acompaño un momento?',until:w.time+6};return true;}
  }
  return false;
 },
 updateEncounter(dt){
  const e=this.encounter,w=this.world;if(!e)return;
  const n=w.getActor?.(e.npcId);if(!n){this.cancelEncounter('missing-neighbour');return;}
  e.elapsed+=dt;
  if(e.phase==='approach'){
   if(w.actorArrived(e.npcId,e.target,.4)&&Math.hypot(n.x-w.player.x,n.y-w.player.y)<2){
    const r=this.ensure().relationships[e.npcId],spec=NEIGHBOURS[e.npcId],p=this.activeProject();let topic=r&&p?'cómo va tu proyecto «'+p.detail+'»':spec.topics[(r?.encounters||0)%spec.topics.length];
    e.topic=topic;e.phase='conversation';e.remaining=6;e.elapsed=0;e.reason=r?'Recuerda su último encuentro y pregunta por '+topic+'.':'Quiere presentarse y compartir '+topic+'.';
    w.setActorAnimation(e.npcId,'wave',7);w.setActorTask(e.npcId,{animation:'wave',prop:'heart',phase:'doing',progress:0});n.dir=Math.atan2(w.player.y-n.y,w.player.x-n.x);n.bubble={text:r?'Qué bueno verte otra vez.':'Hola, soy '+spec.name+'.',until:w.time+6};
    Companion.status(spec.name+' se acercó. '+(r?'Recuerda su último encuentro.':'Quería conocerte.'));
   }else if(e.elapsed>24||['failed','cancelled'].includes(e.motion.status)||Math.hypot(w.player.x-e.target.x,w.player.y-e.target.y)>4)this.cancelEncounter('encounter-unavailable');
  }else{
   if(Math.hypot(n.x-w.player.x,n.y-w.player.y)>2.2){this.cancelEncounter('walked-away');return;}
   e.remaining-=dt;w.setActorTask(e.npcId,{animation:'wave',prop:'heart',phase:'doing',progress:clamp(1-e.remaining/6,0,1)});
   if(e.remaining<=0){
    const life=this.ensure(),old=life.relationships[e.npcId],spec=NEIGHBOURS[e.npcId];life.relationships[e.npcId]={name:spec.name,affinity:clamp((old?.affinity||0)+(old?4:8),0,100),encounters:(old?.encounters||0)+1,lastAt:Date.now(),lastTopic:e.topic};life.needs.social=clamp(life.needs.social+12,25,100);
    this.remember('encounter',old?'Volviste a conversar con '+spec.name:'Conociste a '+spec.name,(old?spec.name+' recordó su encuentro anterior. Conversaron sobre ':spec.name+' inició una conversación sobre ')+e.topic+'. Su próximo encuentro conservará este recuerdo.',w.getZone(),e.npcId);
    const n=w.getActor(e.npcId);if(n)n.bubble={text:'Nos vemos por aquí.',until:w.time+4};w.setActorTask(e.npcId,null);w.releaseActorControl(e.npcId);this.encounter=null;this.encounterWait=38;Companion.idle=Math.max(Companion.idle,1.5);save();
   }
  }
 },
 neighbour(id){const life=this.ensure();if(!life.neighbours[id])life.neighbours[id]={needs:{energy:76,comfort:75,curiosity:64,social:62},goal:'Disfrutar un paseo a su ritmo.',recent:[],meetings:0,lastAt:0,known:{}};return life.neighbours[id];},
 dropNpcPlan(id,reason='finished'){const w=this.world;w?.cancelActor?.(id,reason);w?.setActorTask?.(id,null);w?.releaseActorControl?.(id);this.npcPlans.delete(id);this.npcWait.set(id,3+Math.random()*4);},
 cancelNeighbours(reason){for(const id of [...this.npcPlans.keys()])this.dropNpcPlan(id,reason);this.cancelNpcEncounter(reason);this.npcPlans.clear();this.npcWait.clear();},
 npcPreference(id,task){const a=task.animation,hour=habitaTime().hour;let score=1;if(id.includes('reader')&&a==='read')score+=5;if(id.includes('gardener')&&a==='water')score+=5;if(id.includes('walker')&&['look','stretch'].includes(a))score+=4;if(id.includes('visitor')&&['draw','write','look'].includes(a))score+=3;if(hour>=21||hour<6){if(['sit','read','look'].includes(a))score+=3;else score*=.6;}const memory=this.neighbour(id);if(['sit','eat'].includes(a))score+=(100-memory.needs.energy)/35;if(['read','look','draw','write'].includes(a))score+=(100-memory.needs.curiosity)/40;if(['wave','pet'].includes(a))score+=(100-memory.needs.social)/35;if(['water','tidy'].includes(a))score+=(100-memory.needs.comfort)/40;score*=Math.pow(.4,memory.recent.slice(-3).filter(t=>t===task.id).length);return score;},
 beginNpcPlan(n){
  const w=this.world;if(!w?.navigateActor||n.directorOwned)return;const candidates=w.getTaskCandidates().filter(t=>!['hang-art'].includes(t.id)&&t.usePoints?.some(p=>w.canStand(p.x,p.y)&&Math.hypot(p.x-w.player.x,p.y-w.player.y)>.65));
  if(!candidates.length)return;const sorted=candidates.map(t=>({task:t,score:this.npcPreference(n.id,t)*(1+Math.random())})).sort((a,b)=>b.score-a.score);
  for(const {task}of sorted){
   if(!w.reserveObject(task.objectId,n.id))continue;const points=task.usePoints.filter(p=>w.canStand(p.x,p.y)&&Math.hypot(p.x-w.player.x,p.y-w.player.y)>.65).sort((a,b)=>Math.hypot(a.x-n.x,a.y-n.y)-Math.hypot(b.x-n.x,b.y-n.y));
   for(const target of points){const motion=w.navigateActor(n.id,target.x,target.y,{source:'npc-routine'});if(motion?.status==='failed')continue;this.npcPlans.set(n.id,{task,target,motion,phase:'travel',elapsed:0,remaining:0,duration:7+Math.random()*5});this.neighbour(n.id).goal='Quiere '+task.label+'.';return;}
   w.releaseActorControl(n.id);
  }
  this.npcWait.set(n.id,3);
 },
 updateNpcPlans(dt){
  const w=this.world;for(const n of w.npcs||[]){if(!NEIGHBOURS[n.id])continue;const memory=this.neighbour(n.id);memory.needs.energy=clamp(memory.needs.energy-dt*.015,25,100);memory.needs.curiosity=clamp(memory.needs.curiosity-dt*.018,25,100);memory.needs.social=clamp(memory.needs.social-dt*.02,25,100);
   if(this.encounter?.npcId===n.id||this.npcEncounter?.ids.includes(n.id))continue;
   const plan=this.npcPlans.get(n.id);if(!plan){const wait=(this.npcWait.get(n.id)??(4+this.npcWait.size*2))-dt;this.npcWait.set(n.id,wait);if(wait<=0)this.beginNpcPlan(n);continue;}
   plan.elapsed+=dt;if(plan.phase==='travel'){if(w.actorArrived(n.id,plan.target,.4)){plan.phase='doing';plan.elapsed=0;plan.remaining=plan.duration;w.cancelActor(n.id,'at-object');w.reserveObject(plan.task.objectId,n.id);w.setActorAnimation(n.id,plan.task.animation,plan.duration+.5);w.setActorTask(n.id,{...plan.task,phase:'doing',progress:0});}else if(plan.elapsed>30||['failed','cancelled'].includes(plan.motion.status))this.dropNpcPlan(n.id,'routine-unavailable');}
   else{if(!w.actorArrived(n.id,plan.target,.45)){this.dropNpcPlan(n.id,'routine-displaced');continue;}plan.remaining-=dt;w.setActorAnimation(n.id,plan.task.animation,Math.max(0,plan.remaining)+.5);w.setActorTask(n.id,{...plan.task,phase:'doing',progress:clamp(1-plan.remaining/plan.duration,0,1)});if(plan.remaining<=0){memory.recent.push(plan.task.id);memory.recent=memory.recent.slice(-8);memory.lastAt=Date.now();const a=plan.task.animation;if(['read','look','draw','write'].includes(a))memory.needs.curiosity=clamp(memory.needs.curiosity+10,25,100);if(['sit','eat'].includes(a))memory.needs.energy=clamp(memory.needs.energy+10,25,100);if(['water','tidy'].includes(a))memory.needs.comfort=clamp(memory.needs.comfort+9,25,100);memory.goal='Terminó de '+plan.task.label+' y está eligiendo su próximo momento.';this.dropNpcPlan(n.id);}}
  }
 },
 beginNpcEncounter(){
  const w=this.world,actors=w.npcs.filter(n=>NEIGHBOURS[n.id]&&this.encounter?.npcId!==n.id);if(actors.length<2)return false;const [a,b]=actors;this.dropNpcPlan(a.id,'meeting');this.dropNpcPlan(b.id,'meeting');
  const objects=w.getScene()?.objects?.filter(o=>(o.usePoints?.length||0)>=2&&o.usePoints.every(p=>w.canStand(p.x,p.y)))||[];
  objects.sort((a,b)=>Number(['bench','table','fountain'].includes(b.type))-Number(['bench','table','fountain'].includes(a.type)));
  for(const object of objects){const points=object.usePoints.filter(p=>Math.hypot(p.x-w.player.x,p.y-w.player.y)>.8);if(points.length<2||!w.reserveObject(object.id,a.id))continue;const targets=[points[0],points.find(p=>Math.hypot(p.x-points[0].x,p.y-points[0].y)>.7)];if(!targets[1]){w.releaseReservation(a.id);continue;}
   const tokens=[w.navigateActor(a.id,targets[0].x,targets[0].y,{source:'neighbour-meeting'}),w.navigateActor(b.id,targets[1].x,targets[1].y,{source:'neighbour-meeting'})];if(tokens.some(t=>!t||t.status==='failed')){w.releaseActorControl(a.id);w.releaseActorControl(b.id);continue;}
   this.npcEncounter={ids:[a.id,b.id],names:[NEIGHBOURS[a.id].name,NEIGHBOURS[b.id].name],targets,tokens,objectId:object.id,phase:'approach',elapsed:0,remaining:0,initiatedBy:'npc'};
   this.neighbour(a.id).goal='Quiere conversar con '+NEIGHBOURS[b.id].name+'.';this.neighbour(b.id).goal='Quiere compartir un momento con '+NEIGHBOURS[a.id].name+'.';a.bubble={text:'¿Conversamos un rato?',until:w.time+5};return true;
  }
  return false;
 },
 cancelNpcEncounter(reason='finished'){const e=this.npcEncounter;if(e){for(const id of e.ids){this.world?.cancelActor?.(id,reason);this.world?.setActorTask?.(id,null);this.world?.releaseActorControl?.(id);this.npcWait.set(id,5);}this.npcEncounter=null;}},
 updateNpcEncounter(dt){
  const e=this.npcEncounter,w=this.world;if(!e)return;e.elapsed+=dt;if(e.phase==='approach'){
   if(e.ids.every((id,i)=>w.actorArrived(id,e.targets[i],.4))){e.phase='conversation';e.remaining=7;e.elapsed=0;const known=this.neighbour(e.ids[0]).known[e.ids[1]],spec=NEIGHBOURS[e.ids[0]];e.topic=known?'lo que conversaron la última vez':spec.topics[this.neighbour(e.ids[0]).meetings%spec.topics.length];for(let i=0;i<2;i++){const n=w.getActor(e.ids[i]),other=w.getActor(e.ids[1-i]);n.dir=Math.atan2(other.y-n.y,other.x-n.x);w.setActorAnimation(n.id,'wave',8);w.setActorTask(n.id,{animation:'wave',prop:'heart',phase:'doing',progress:0});n.bubble={text:known?'Me acordé de nuestra charla.':i===0?'Me gusta pasear por aquí.':'A mí también. Qué gusto verte.',until:w.time+7};}}
   else if(e.elapsed>30||e.tokens.some(t=>['failed','cancelled'].includes(t.status))){this.cancelNpcEncounter('meeting-unavailable');this.npcEncounterWait=10;}
  }else{e.remaining-=dt;for(const id of e.ids)w.setActorTask(id,{animation:'wave',prop:'heart',phase:'doing',progress:clamp(1-e.remaining/7,0,1)});if(e.remaining<=0){for(let i=0;i<2;i++){const me=this.neighbour(e.ids[i]),other=e.ids[1-i],previous=me.known[other];me.known[other]={name:NEIGHBOURS[other].name,encounters:(previous?.encounters||0)+1,lastTopic:e.topic};me.meetings++;me.needs.social=clamp(me.needs.social+14,25,100);me.goal='Recuerda la conversación con '+NEIGHBOURS[other].name+' y quiere seguir su paseo.';}
    this.remember('neighbour-encounter',e.names.join(' y ')+' compartieron un momento','Se encontraron por iniciativa propia y conversaron sobre '+e.topic+'. Ambos recordarán este encuentro.',w.getZone());this.cancelNpcEncounter('meeting-completed');this.npcEncounterWait=52;save();}
  }
 },
 update(dt){
  this.ensureBound();const w=this.world||world;if(!w||w.paused||page!=='world'||document.hidden||!Number.isFinite(dt)||dt<=0)return;
  const life=this.ensure();life.simSeconds+=dt;life.lastSeenAt=Date.now();life.needs.energy=clamp(life.needs.energy-dt*.018,25,100);life.needs.curiosity=clamp(life.needs.curiosity-dt*.025,25,100);life.needs.social=clamp(life.needs.social-dt*.018,25,100);
  if(!this.activeProject()){this.projectWait-=dt;if(this.projectWait<=0)this.newProject();}
  if(this.encounter)this.updateEncounter(dt);else{this.encounterWait-=dt;if(this.encounterWait<=0){if(!this.beginEncounter())this.encounterWait=2;}}
  if(this.npcEncounter)this.updateNpcEncounter(dt);else{this.npcEncounterWait-=dt;if(this.npcEncounterWait<=0&&!this.encounter){if(!this.beginNpcEncounter())this.npcEncounterWait=3;}}
  this.updateNpcPlans(dt);
  if(Date.now()-this.lastSavedAt>=15000){this.lastSavedAt=Date.now();save();}
 },
 describe(){const p=this.activeProject();if(this.encounter)return this.encounter.name+' quiere compartir un momento; '+this.encounter.reason;if(p){const step=PROJECTS[p.type].steps[Math.min(p.stage,2)],here=this.world?.getZone?.();return 'Quiere '+step.label.toLowerCase()+' para «'+p.detail+'».'+(here!==step.scene?' Puede continuar cuando visite '+(step.scene==='home'?'su casa':'la costanera')+'.':'');}return 'Está eligiendo su próximo pequeño proyecto.';},
 describeActor(id){if(id==='player')return this.describe();const spec=NEIGHBOURS[id],r=this.ensure().relationships[id];if(!spec)return 'Está recorriendo el barrio a su ritmo.';if(this.encounter?.npcId===id)return this.encounter.reason;return spec.name+' disfruta '+spec.interest+'. '+(this.ensure().neighbours[id]?.goal||'Está eligiendo su próximo paseo.')+' '+(r?'Recuerda que hablaron sobre '+r.lastTopic+'.':'Todavía pueden conocerse durante un paseo.');},
 inspectActor(id){const r=this.ensure().relationships[id],name=id==='player'?state.profile.name:NEIGHBOURS[id]?.name||'Un vecino';modal(`<div class="eyebrow">${id==='player'?'SU PRÓXIMO PROPÓSITO':'VIDA EN EL BARRIO'}</div><h2 style="margin-top:8px">${esc(name)}</h2><p>${esc(this.describeActor(id))}</p>${r?`<p class="small">${r.encounters} ${r.encounters===1?'encuentro':'encuentros'} recordados en este navegador.</p>`:''}<button class="btn full" onclick="HabitaLife.openJournal()">Ver recuerdos y proyectos</button><button class="textbtn full" onclick="closeModal()">Volver al mundo</button>`);},
 goProject(){const p=this.activeProject();if(!p)return;const target=PROJECTS[p.type].steps[Math.min(p.stage,2)].scene;visitScene(target);},
 openJournal(){
  const life=this.ensure(),p=this.activeProject(),relations=Object.values(life.relationships),last=life.projects.filter(p=>p.status==='completed').slice(-3).reverse();
  modal(`<div class="eyebrow">UNA VIDA QUE CONTINÚA</div><h2 style="margin-top:8px">Proyectos y recuerdos</h2>${life.returnSummary?`<div class="notice" data-return-summary>${esc(life.returnSummary)}</div>`:''}${p?`<div class="card" data-project-id="${esc(p.id)}"><h3>${esc(p.title)}</h3><p>${esc(p.detail)}</p><p>${esc(this.describe())}</p><ol>${PROJECTS[p.type].steps.map((s,i)=>`<li style="opacity:${i<p.stage?'.65':'1'}">${i<p.stage?'✓ ':i===p.stage?'→ ':''}${esc(s.label)}</li>`).join('')}</ol><button class="btn full" data-action="continue-project" onclick="HabitaLife.goProject()">${PROJECTS[p.type].steps[Math.min(p.stage,2)].scene==='home'?'Continuar en casa':'Buscar inspiración en la costanera'}</button></div>`:''}${last.length?`<h3>Lo que ya dejó huella</h3>${last.map(p=>`<p data-completed-project="${esc(p.id)}">✓ ${esc(p.detail)} · ${esc(p.title)}</p>`).join('')}`:''}${relations.length?`<h3>Vecinos que te recuerdan</h3>${relations.map(r=>`<p>${esc(r.name)} · ${r.encounters} encuentros<br><span class="small">Conversaron sobre ${esc(r.lastTopic)}.</span></p>`).join('')}`:''}<h3>Últimos recuerdos</h3>${life.memories.slice(-8).reverse().map(m=>`<div style="padding:10px 0;border-bottom:1px solid #dce7df" data-memory-kind="${esc(m.kind)}"><strong>${esc(m.title)}</strong><p class="small" style="margin:5px 0">${esc(m.text)}</p></div>`).join('')||'<p>Todavía está comenzando su historia.</p>'}<p class="small">Necesidades y recuerdos de una simulación local. No representan mediciones de tu salud. Los personajes deciden mediante reglas, memoria y planificación; no tienen conciencia subjetiva demostrada.</p><button class="btn secondary full" onclick="closeModal()">Volver al mundo</button>`);
 },
 snapshot(){const life=this.ensure(),p=this.activeProject();return{...clone(life),npcPlans:[...this.npcPlans.entries()].map(([id,p])=>({id,phase:p.phase,taskId:p.task.id,objectId:p.task.objectId,target:clone(p.target),motionStatus:p.motion.status})),npcEncounter:this.npcEncounter?{ids:[...this.npcEncounter.ids],names:[...this.npcEncounter.names],phase:this.npcEncounter.phase,initiatedBy:'npc',objectId:this.npcEncounter.objectId,targets:clone(this.npcEncounter.targets)}:null,project:p?{...clone(p),targetScene:PROJECTS[p.type].steps[Math.min(p.stage,2)].scene,steps:clone(PROJECTS[p.type].steps),reason:this.describe()}:null,recentMemories:clone(life.memories.slice(-8)),effects:clone(life.homeEffects),encounter:this.encounter?{npcId:this.encounter.npcId,name:this.encounter.name,phase:this.encounter.phase,initiatedBy:'npc',reason:this.encounter.reason,target:clone(this.encounter.target),motionStatus:this.encounter.motion?.status}:null};}
};
return api;
})();
