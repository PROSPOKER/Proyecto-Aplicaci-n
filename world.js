
/* Habita · a small, living coast. No dependencies. */
(() => {
'use strict';
const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const hash=(x,y)=>{let n=Math.imul(x+23,374761393)+Math.imul(y+71,668265263);n=(n^(n>>>13))*1274126177;return ((n^(n>>>16))>>>0)/4294967295;};
const POIS=[
{id:'beach',name:'Playa del Sol',icon:'≈',x:7,y:28,description:'La brisa y el sonido del Pacífico, a unos pasos de casa.'},
{id:'park',name:'Parque costero',icon:'♧',x:21,y:34,description:'Sombra, aire fresco y un espacio para volver a ti.'},
{id:'home',name:'Mi departamento',icon:'⌂',x:13,y:30,description:'Tu departamento en Viña del Mar: una ventana al Pacífico.',bx:10,by:26,bw:4,bd:3,color:'#f0e0ca',roof:'#b5634e'},
{id:'office',name:'El estudio',icon:'▤',x:23,y:30,description:'Ideas, foco y pequeños pasos que sí cuentan.',bx:20,by:26,bw:4,bd:3,color:'#e9dcc2',roof:'#60858b'},
{id:'gym',name:'Casa del movimiento',icon:'↗',x:25,y:18,description:'Moverse también puede sentirse como jugar.',bx:22,by:14,bw:4,bd:3,color:'#e6ceb0',roof:'#b57958'},
{id:'library',name:'Biblioteca del mar',icon:'▥',x:15,y:10,description:'Cada página abre una pequeña ventana.',bx:12,by:6,bw:4,bd:3,color:'#dddcca',roof:'#6b8990'},
{id:'cafe',name:'Café Bruma',icon:'☕',x:10,y:19,description:'Una pausa tibia junto al Pacífico.',bx:7,by:15,bw:4,bd:3,color:'#edc995',roof:'#ae664f'},
{id:'garden',name:'Jardín compartido',icon:'✿',x:25,y:9,description:'Cuidar algo pequeño cambia el paisaje.'},
{id:'friend',name:'Encuentro con Emilia',icon:'♡',x:18,y:21,description:'A veces, el siguiente paso es conversar.'},
{id:'trail',name:'Sendero del mirador',icon:'⌁',x:30,y:8,description:'El cerro guarda otra perspectiva.'},
{id:'bridge',name:'Puente de madera',icon:'≋',x:32,y:23,description:'Una conexión que se construye paso a paso.'},
{id:'expedition',name:'Mirador del Pacífico',icon:'◈',x:36,y:6,description:'Un horizonte nuevo, sin prisa por alcanzarlo.'}
];
class HabitaWorld {
 constructor(canvas,opts={}) {
  this.canvas=canvas; this.ctx=canvas.getContext('2d',{alpha:false}); this.opts=opts;
  this.size=42; this.tw=48; this.th=24; this.zone='outdoor'; this.scene=null; this.sceneKey=null;
  this.player={x:14,y:31,dir:4}; this.cat={x:13.2,y:32,path:[]}; this.camera={x:0,y:0};
  this.zoomLevel=1; this.path=[]; this.motion=null; this.motionSerial=0;
  this.keys=new Set(); this.pointers=new Map(); this.events=new Map(); this.listeners=[];
  this.time=0; this.lastInput=performance.now(); this.anim='idle'; this.animUntil=0;
  this.near=null; this.nearId=null; this.paused=false; this.running=false;
  this.particles=[]; this.discovered=new Set(); this.turn=0; this.moving=false;
  this.activeTask=null; this.pendingInteraction=null; this.npcs=[];this.reservations=new Map();
  this.buildMap(); this.initNPCs(); this.resize(); this.camera=this.project(this.player.x,this.player.y); this.bind();
 }
 state(){try{return this.opts.getState?.()||{};}catch{return {};}}
 flags(){return this.state().flags||{};}
 getPOIs(){return POIS.map(p=>({...p,...(p.id==='friend'?{name:this.flags().friend?'Encuentro con '+(this.state().friend?.name||'Emilia'):'Alguien en la plaza'}:{})}));}
 getZone(){return this.zone;}
 getScene(){return this.scene;}
 actorId(id='player'){return id==='avatar'?'player':id;}
 getActor(id='player'){id=this.actorId(id);return id==='player'?this.player:this.npcs.find(n=>n.id===id)||null;}
 actorArrived(id,target,tolerance=.45){const actor=this.getActor(id);return !!actor&&!!target&&Number.isFinite(target.x)&&Number.isFinite(target.y)&&Math.hypot(target.x-actor.x,target.y-actor.y)<=tolerance;}
 cancelActor(id='player',reason='cancelled'){id=this.actorId(id);if(id==='player'){this.cancelMovement(reason);return;}const actor=this.getActor(id);if(!actor)return;if(actor.motion?.status==='moving'){actor.motion.status='cancelled';actor.motion.reason=reason;}actor.path=[];actor.moving=false;if(reason!=='superseded'){actor.activeTask=null;this.releaseReservation(id);}}
 setActorAnimation(id,animation,seconds=5){id=this.actorId(id);if(id==='player'){this.setActivityAnimation(animation,seconds);return true;}const actor=this.getActor(id);if(!actor)return false;actor.directorOwned=true;actor.anim=animation||'idle';actor.animUntil=this.time+Math.max(0,seconds);return true;}
 setActorTask(id,task){id=this.actorId(id);if(id==='player'){this.setTaskVisual(task);return true;}const actor=this.getActor(id);if(!actor)return false;if(task)actor.directorOwned=true;actor.activeTask=task?{...task}:null;return true;}
 releaseActorControl(id){id=this.actorId(id);if(id==='player')return;const actor=this.getActor(id);if(!actor)return;this.cancelActor(id,'control-released');actor.directorOwned=false;actor.anim='idle';actor.animUntil=0;actor.activeTask=null;actor.wait=1;this.releaseReservation(id);}
 reserveObject(objectId,actorId='player'){actorId=this.actorId(actorId);if(!this.getActor(actorId)||!this.scene?.objects?.some(o=>o.id===objectId))return false;const existing=this.reservations.get(objectId);if(existing&&existing.actorId!==actorId)return false;this.reservations.set(objectId,{objectId,actorId,sceneId:this.zone});return true;}
 releaseReservation(actorId='player'){actorId=this.actorId(actorId);for(const [id,r] of this.reservations)if(r.actorId===actorId)this.reservations.delete(id);}
 reservationSnapshot(){return [...this.reservations.values()].map(r=>({...r}));}
 cancelAllActors(reason){this.cancelMovement(reason);for(const actor of this.npcs)this.cancelActor(actor.id,reason);this.reservations.clear();}
 on(type,fn){if(typeof fn!=='function')return ()=>{};if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);return ()=>this.events.get(type)?.delete(fn);}
 emit(type,detail){for(const fn of [...(this.events.get(type)||[])])fn(detail);}
 buildMap(){this.trees=[];this.rocks=[];for(let x=0;x<42;x++)for(let y=0;y<42;y++){
  let h=hash(x,y);if(x>10&&y>2&&y<39&&h>.90&&!this.onRoad(x,y)&&!POIS.some(p=>Math.hypot(p.x-x,p.y-y)<3.2||(p.bx!=null&&x>=p.bx-1&&x<=p.bx+p.bw&&y>=p.by-1&&y<=p.by+p.bd)))this.trees.push({x:x+.5,y:y+.5,h:32+h*24,type:h>.96?'pine':'round'});
  if(x>=5&&x<=7&&h>.91)this.rocks.push({x:x+.5,y:y+.5,h:8+h*6});
 }this.treeCells=new Set(this.trees.map(t=>`${Math.floor(t.x)},${Math.floor(t.y)}`));}
 onRoad(x,y){return Math.abs(x-14)<1.4||Math.abs(y-12)<1.1||Math.abs(y-24)<1.1||Math.abs(y-34)<1.1||(Math.abs(x-26)<1.3&&y<30)||(Math.abs(x-10)<1&&y>17&&y<25)||(y>=7&&y<=9&&x>=26);}
 terrain(x,y){if(this.zone!=='outdoor')return 'floor';if(x<4+Math.sin(y*.22)*1.1)return 'ocean';if(x<8+Math.sin(y*.22)*.6)return 'sand';if(y===21&&x>=29)return 'river';if(this.onRoad(x,y))return 'path';return 'grass';}
 walkable(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;x=Math.floor(x);y=Math.floor(y);
  if(this.scene){if(x<0||y<0||x>=this.scene.width||y>=this.scene.height)return false;return !(this.scene.solids||[]).some(p=>x<p.x+p.w&&x+1>p.x&&y<p.y+p.d&&y+1>p.y);}
  if(this.zone!=='outdoor')return x>=1&&x<15&&y>=1&&y<15&&!this.furniture().some(p=>x>=p.x&&x<p.x+p.w&&y>=p.y&&y<p.y+p.d);
  if(x<1||y<1||x>=41||y>=41)return false;const f=this.flags(),t=this.terrain(x,y);if(t==='ocean')return false;if(t==='river'&&!(x>=32&&x<=34&&f.bridge))return false;if(x>=31&&y<=10&&!f.trail)return false;if(x>=35&&y<=10&&!f.expedition)return false;if(this.treeCells.has(`${x},${y}`))return false;if(POIS.some(p=>p.bx!=null&&x>=p.bx&&x<p.bx+p.bw&&y>=p.by&&y<p.by+p.bd))return false;return true;
 }
 canStand(x,y,margin=.16){return this.walkable(x-margin,y-margin)&&this.walkable(x+margin,y-margin)&&this.walkable(x-margin,y+margin)&&this.walkable(x+margin,y+margin);}
 project(x,y,z=0){return{x:(x-y)*this.tw/2,y:(x+y)*this.th/2-z};}
 anchorY(){const home=document.body.classList.contains('homeView'),smallHome=home&&this.w<=700&&this.h<740;return this.h*(smallHome?.39:home?(this.h<740?.30:.36):.53);}
 unproject(sx,sy){const px=(sx-this.w/2)/this.zoomLevel+this.camera.x,py=(sy-this.anchorY())/this.zoomLevel+this.camera.y;return{x:px/this.tw+py/this.th,y:py/this.th-px/this.tw};}
 listen(target,type,fn,options){target.addEventListener(type,fn,options);this.listeners.push(()=>target.removeEventListener(type,fn,options));}
 manualInput(kind,detail={}){this.lastInput=performance.now();this.emit('manualinput',{kind,...detail});this.cancelMovement('manual-input');this.setTaskVisual(null);}
 bind(){const c=this.canvas;c.style.touchAction='none';c.tabIndex=0;
  this.listen(window,'resize',()=>this.resize());
  this.listen(window,'keydown',e=>{
   if(this.paused||/INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY/.test(e.target?.tagName)||e.target?.isContentEditable)return;
   const k=e.key.toLowerCase();if(!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e',' '].includes(k))return;
   e.preventDefault();if(!e.repeat&&!this.keys.has(k)){this.manualInput('keyboard',{key:k});this.animUntil=0;}
   this.keys.add(k);this.lastInput=performance.now();if((k==='e'||k===' ')&&!e.repeat)this.interact(this.near,{manual:false});
  });
  this.listen(window,'keyup',e=>this.keys.delete(e.key.toLowerCase()));this.listen(window,'blur',()=>{this.keys.clear();this.pointers.clear();this.gesture=false;});
  this.listen(c,'wheel',e=>{e.preventDefault();if(!this.paused)this.zoom(-e.deltaY*.001);},{passive:false});
  this.listen(c,'pointerdown',e=>{if(this.paused)return;c.focus({preventScroll:true});c.setPointerCapture?.(e.pointerId);const r=c.getBoundingClientRect();this.pointers.set(e.pointerId,{x:e.clientX-r.left,y:e.clientY-r.top});if(this.pointers.size===1)this.down={x:e.clientX,y:e.clientY,time:performance.now()};this.gesture=this.pointers.size>1;this.lastInput=performance.now();if(this.pointers.size===2)this.pinch=this.pinchDistance();});
  this.listen(c,'pointermove',e=>{if(!this.pointers.has(e.pointerId))return;const r=c.getBoundingClientRect();this.pointers.set(e.pointerId,{x:e.clientX-r.left,y:e.clientY-r.top});if(this.pointers.size===2){const d=this.pinchDistance();if(this.pinch&&d>0)this.zoom(Math.log(d/this.pinch));this.pinch=d;this.gesture=true;}});
  this.listen(c,'pointerup',e=>{
   const p=this.pointers.get(e.pointerId);this.pointers.delete(e.pointerId);if(!p)return;
   if(!this.paused&&!this.gesture&&this.down&&Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)<12){
    const q=this.unproject(p.x,p.y),a=this.project(this.player.x,this.player.y,23),ax=(a.x-this.camera.x)*this.zoomLevel+this.w/2,ay=(a.y-this.camera.y)*this.zoomLevel+this.anchorY();
    this.manualInput('pointer',{x:q.x,y:q.y});
    if(Math.hypot(p.x-ax,p.y-ay)<22){this.opts.onAvatar?.();}
    else {const actor=this.hitCharacter(p);if(actor){this.emit('characterselect',{actorId:actor.id});this.opts.onCharacter?.(actor.id);}else{const poi=this.hitInteraction(p,q);if(poi)this.interact(poi,{manual:false});else this.navigateTo(q.x,q.y,{source:'manual',notify:false});}}
   }
   if(!this.pointers.size){this.gesture=false;this.pinch=null;this.down=null;}
  });
  this.listen(c,'pointercancel',e=>{this.pointers.delete(e.pointerId);this.gesture=false;this.down=null;});
 }
 hitInteraction(p,q){
  const candidates=this.localPOIs();
  if(!this.scene)return candidates.find(o=>Math.hypot(q.x-o.x,q.y-o.y)<1.8)||null;
  return candidates.map(o=>{
   const w=o.w||.6,d=o.d||.6,z=o.kind==='portal'?15:18,center=this.project(o.x+w/2,o.y+d/2,z);
   const sx=(center.x-this.camera.x)*this.zoomLevel+this.w/2,sy=(center.y-this.camera.y)*this.zoomLevel+this.anchorY();
   return {object:o,distance:Math.hypot(p.x-sx,p.y-sy),radius:Math.max(19,(w+d)*this.tw/4*this.zoomLevel+9),floorDistance:Math.hypot(q.x-o.x-w/2,q.y-o.y-d/2)};
  }).filter(o=>o.distance<o.radius||o.floorDistance<.8).sort((a,b)=>a.distance-b.distance)[0]?.object||null;
 }
 hitCharacter(point){return this.npcs.map(actor=>{const p=this.project(actor.x,actor.y,24);return {actor,distance:Math.hypot(point.x-((p.x-this.camera.x)*this.zoomLevel+this.w/2),point.y-((p.y-this.camera.y)*this.zoomLevel+this.anchorY()))};}).filter(n=>n.distance<Math.max(16,19*this.zoomLevel)).sort((a,b)=>a.distance-b.distance)[0]?.actor||null;}
 pinchDistance(){const p=[...this.pointers.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}
 fitScene(){if(!this.scene)return 1;const width=(this.scene.width+this.scene.height)*this.tw/2,height=(this.scene.width+this.scene.height)*this.th/2+90,smallHome=this.scene.id==='home'&&this.w<=700&&this.h<740;return clamp(Math.min(this.scene.zoom||1,(this.w-36)/width,this.h*.58/height,smallHome?.60:Infinity),.4,1.4);}
 resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width||window.innerWidth;this.h=r.height||window.innerHeight;const d=Math.min(window.devicePixelRatio||1,2);this.dpr=d;this.canvas.width=Math.round(this.w*d);this.canvas.height=Math.round(this.h*d);if(this.scene&&!this.manualZoom)this.zoomLevel=this.fitScene();}
 zoom(delta){this.zoomLevel=clamp(this.zoomLevel*Math.exp(delta),.4,2.4);this.manualZoom=true;this.lastInput=performance.now();}
 recenter(){this.camera=this.scene?.camera?this.project(this.scene.camera.x,this.scene.camera.y):this.project(this.player.x,this.player.y);this.manualZoom=false;this.zoomLevel=this.fitScene();}
 pause(bool){this.paused=!!bool;this.keys.clear();this.pointers.clear();this.gesture=false;this.down=null;}
 destroy(){this.running=false;this.cancelAllActors('destroyed');cancelAnimationFrame(this.raf);this.listeners.forEach(f=>f());this.listeners=[];this.events.clear();}
 start(){if(this.running)return;this.running=true;this.prev=performance.now();const loop=t=>{if(!this.running)return;const dt=Math.min(Math.max((t-this.prev)/1000,0),.04);this.prev=t;if(!this.paused)this.update(dt,t);this.render();this.raf=requestAnimationFrame(loop);};this.raf=requestAnimationFrame(loop);}
 nearestFree(x,y,maxRadius=4){let best=null;for(let r=0;r<=maxRadius&&!best;r++)for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){const px=Math.floor(x)+i+.5,py=Math.floor(y)+j+.5;if(this.canStand(px,py)){const d=Math.hypot(px-x,py-y);if(!best||d<best.d)best={x:px,y:py,d};}}return best;}
 sceneKeyFor(id,state){return id==='home'?id+':'+(state.profile?.care?.room?.kind||'bedroom')+':'+(state.homeLayout?.revision||0):id;}
 refreshScene(scene=window.HabitaScenes?.get?.(this.zone,this.state())){
  if(!scene)return false;
  this.cancelAllActors('scene-refresh');this.scene=scene;this.sceneKey=this.sceneKeyFor(this.zone,this.state());this.setTaskVisual(null);this.keys.clear();
  if(!this.canStand(this.player.x,this.player.y)){const free=this.nearestFree(this.player.x,this.player.y);if(free){this.player.x=free.x;this.player.y=free.y;}}
  this.near=null;this.nearId=null;this.opts.onNear?.(null);this.emit('scenechange',{from:this.zone,to:this.zone,refreshed:true});return true;
 }
 setZone(id){
  if(id==='outside'||id==='world')id='outdoor';const state=this.state(),scene=window.HabitaScenes?.get?.(id,state)||null;
  if(!scene&&id!=='outdoor'&&!['home','office','gym','library','cafe'].includes(id))return false;
  if(id===this.zone){if(scene&&this.sceneKey!==this.sceneKeyFor(id,state))this.refreshScene(scene);return true;}const from=this.zone;if(from==='outdoor')this.outside={...this.player};
  this.cancelAllActors('scene-change');this.zone=id;this.scene=scene;this.sceneKey=this.sceneKeyFor(id,state);this.size=scene?.width|| (id==='outdoor'?42:16);this.keys.clear();this.setTaskVisual(null);
  const spawn=scene?.spawn||(id==='outdoor'?(this.outside||{x:14,y:31,dir:4}):{x:8,y:12,dir:4});
  this.player={x:spawn.x,y:spawn.y,dir:spawn.dir??4};if(!this.canStand(this.player.x,this.player.y)){const free=this.nearestFree(spawn.x,spawn.y);if(free)this.player={x:free.x,y:free.y,dir:spawn.dir??4};}
  const cp=this.nearestFree(this.player.x-.8,this.player.y+.7);this.cat={x:cp?.x??this.player.x,y:cp?.y??this.player.y,path:[],nextPlan:0};
  this.initNPCs();this.recenter();this.nearId=null;this.near=null;this.opts.onNear?.(null);this.anim='look';this.animUntil=performance.now()+1200;this.discover(id);this.emit('scenechange',{from,to:id});return true;
 }
 getInteractions(){if(this.scene)return [...(this.scene.objects||[]).map(o=>({...o,kind:'task',sceneId:this.zone})),...(this.scene.portals||[]).map(o=>({...o,kind:'portal',sceneId:this.zone,usePoints:o.usePoints||[{x:o.x,y:o.y}]}))];return this.localPOIs().map(o=>({...o,kind:'legacy',sceneId:this.zone}));}
 getTaskCandidates(){if(!this.scene)return [];return (this.scene.objects||[]).flatMap(o=>(o.tasks||[]).map(t=>({...t,objectId:o.id,sceneId:this.zone,name:o.name,usePoints:(o.usePoints||[]).map(p=>({...p}))})));}
 localPOIs(){if(this.scene)return [...(this.scene.objects||[]).map(o=>({...o,kind:'task',sceneId:this.zone})),...(this.scene.portals||[]).map(o=>({...o,kind:'portal',sceneId:this.zone,usePoints:o.usePoints||[{x:o.x,y:o.y}]}))];return this.zone==='outdoor'?this.getPOIs():[{id:'moment',name:({home:'Un momento en casa',office:'Entre dos reuniones',gym:'A tu propio ritmo',library:'Una página por descubrir',cafe:'Una pausa tibia'})[this.zone],icon:'✦',x:8,y:10,description:'Un lugar para elegir un pequeño paso real.'},{id:'exit',name:'Volver a la costa',icon:'↗',x:8,y:14,description:'La ciudad sigue ahí, a tu ritmo.'}];}
 interactionPoints(object){return object.usePoints?.length?object.usePoints:[{x:object.x,y:object.y}];}
 interactionDistance(object){return Math.min(...this.interactionPoints(object).map(p=>Math.hypot(this.player.x-p.x,this.player.y-p.y)));}
 interact(object=this.near,{manual=true}={}){
  if(!object||this.paused)return false;if(manual)this.manualInput('interaction',{objectId:object.id});
  const points=this.interactionPoints(object).filter(p=>this.canStand(p.x,p.y)).sort((a,b)=>Math.hypot(this.player.x-a.x,this.player.y-a.y)-Math.hypot(this.player.x-b.x,this.player.y-b.y));
  if(!this.scene){if(object.id==='exit'){this.setZone('outdoor');this.opts.onInteract?.({...object});return true;}if(this.interactionDistance(object)<2.6){this.fireInteraction(object);return true;}return this.navigateTo(object.x,object.y,{source:'interaction'}).status!=='failed';}
  for(const point of points){
   if(this.arrived(point)){this.fireInteraction(object);return true;}
   const path=this.findPath(Math.floor(this.player.x),Math.floor(this.player.y),Math.floor(point.x),Math.floor(point.y));if(!path)continue;
   const token=this.navigateTo(point.x,point.y,{source:'interaction'});if(token.status==='failed')continue;
   this.pendingInteraction={object,token,sceneId:this.zone};return true;
  }
  return false;
 }
 fireInteraction(object){
  this.pendingInteraction=null;this.lastInput=performance.now();this.emit('interaction',{object:{...object}});
  this.opts.onInteract?.({...object});
 }
 travel(id){const object=this.localPOIs().find(p=>p.id===id);if(!object)return false;this.manualInput('travel',{objectId:id});return this.scene?this.interact(object,{manual:false}):this.navigateTo(object.x,object.y,{source:'manual',notify:false}).status!=='failed';}
 setTaskVisual(task){this.activeTask=task?{...task}:null;}
 setActivityAnimation(animation,seconds=5){this.anim=animation||'idle';this.animUntil=performance.now()+Math.max(0,seconds)*1000;}
 react(animation,seconds=5){
  this.cancelMovement('reaction');this.setActivityAnimation(animation,seconds);
  if(['walk','run'].includes(animation))this.shortWalk(animation);
  if(['celebrate','surprised'].includes(animation))for(let i=0;i<12;i++)this.particles.push({x:this.player.x,y:this.player.y,z:25,vx:(Math.random()-.5)*1.7,vy:(Math.random()-.5)*1.7,vz:20+Math.random()*30,life:1.5,color:['#f5bc67','#91bda1','#e08e75'][i%3]});
 }
 shortWalk(animation='walk'){const px=Math.floor(this.player.x),py=Math.floor(this.player.y);const offset=Math.floor(hash(Math.floor(this.time),11)*8),dirs=[[3,0],[2,2],[0,3],[-2,2],[-3,0],[-2,-2],[0,-3],[2,-2]];for(let n=0;n<8;n++){const [dx,dy]=dirs[(n+offset)%8],x=px+dx+.5,y=py+dy+.5;if(!this.canStand(x,y))continue;const path=this.findPath(px,py,Math.floor(x),Math.floor(y));if(path&&path.length>0&&path.length<7){const m=this.navigateTo(x,y,{source:'interaction'});if(m.status!=='failed'){this.anim=animation;return true;}}}return false;}
 arrived(target,tolerance=.45){return !!target&&Number.isFinite(target.x)&&Number.isFinite(target.y)&&Math.hypot(target.x-this.player.x,target.y-this.player.y)<=tolerance;}
 cancelMovement(reason='cancelled'){if(this.motion?.status==='moving'){this.motion.status='cancelled';this.motion.reason=reason;}this.path=[];this.pendingInteraction=null;this.moving=false;if(reason!=='superseded'){this.setTaskVisual(null);this.releaseReservation('player');}}
 navigateTo(x,y,{source='manual',notify=true}={}){
  if(source==='manual'&&notify)this.manualInput('navigation',{x,y});else this.cancelMovement('superseded');
  const token={id:++this.motionSerial,entityId:'player',status:'moving',target:{x,y},requested:{x,y},source,replans:0,stall:0,elapsed:0};this.motion=token;
  if(this.paused||!Number.isFinite(x)||!Number.isFinite(y)){this.failPlayerMotion(this.paused?'paused':'invalid-target');return token;}
  if(!this.canStand(x,y)){
   if(source!=='manual'){this.failPlayerMotion('blocked-target');return token;}
   const free=this.nearestFree(x,y,3);if(!free){this.failPlayerMotion('blocked-target');return token;}token.target={x:free.x,y:free.y};
  }
  if(!this.planMotion(token)){this.failPlayerMotion('no-route');return token;}
  this.animUntil=0;this.marker={...token.target,time:this.time};return token;
 }
 go(x,y){return this.navigateTo(x,y,{source:'manual'}).status!=='failed';}
 navigateActor(id,x,y,{source='simulation'}={}){
  id=this.actorId(id);if(id==='player')return this.navigateTo(x,y,{source,notify:false});
  const actor=this.getActor(id),token={id:++this.motionSerial,entityId:id,status:'moving',target:{x,y},requested:{x,y},source,replans:0,stall:0,elapsed:0};
  if(!actor){token.status='failed';token.reason='unknown-actor';return token;}
  this.cancelActor(id,'superseded');actor.directorOwned=true;actor.motion=token;actor.animUntil=0;actor.activeTask=null;
  if(this.paused||!Number.isFinite(x)||!Number.isFinite(y)||!this.canStand(x,y)){this.failActorMotion(actor,this.paused?'paused':!Number.isFinite(x)||!Number.isFinite(y)?'invalid-target':'blocked-target');return token;}
  if(!this.planActorMotion(actor,token)){this.failActorMotion(actor,'no-route');}return token;
 }
 planActorMotion(actor,token){
  if(this.actorArrived(actor.id,token.target,.04)){actor.path=[];token.status='arrived';return true;}
  const path=this.findPath(Math.floor(actor.x),Math.floor(actor.y),Math.floor(token.target.x),Math.floor(token.target.y));if(!path)return false;
  actor.path=path.map(p=>({x:p.x+.5,y:p.y+.5}));const last=actor.path.at(-1);if(!last||Math.hypot(last.x-token.target.x,last.y-token.target.y)>.02)actor.path.push({...token.target});
  let length=0,prev=actor;for(const p of actor.path){length+=Math.hypot(p.x-prev.x,p.y-prev.y);prev=p;}token.maxSeconds=token.elapsed+Math.max(8,length/.95*3+8);token.stall=0;return true;
 }
 failActorMotion(actor,reason){if(actor.motion){actor.motion.status='failed';actor.motion.reason=reason;}actor.path=[];actor.activeTask=null;actor.moving=false;this.releaseReservation(actor.id);}
 replanActorMotion(actor,reason){const token=actor.motion;if(!token||token.status!=='moving')return;if(token.replans>=2||!this.canStand(token.target.x,token.target.y)){this.failActorMotion(actor,reason);return;}token.replans++;if(!this.planActorMotion(actor,token))this.failActorMotion(actor,'no-route');}
 advanceActor(actor,dt){
  const token=actor.motion;if(!token||token.status!=='moving')return;token.elapsed+=dt;
  if(token.elapsed>token.maxSeconds){this.failActorMotion(actor,'route-timeout');return;}
  if(!actor.path.length){if(this.actorArrived(actor.id,token.target,.04))token.status='arrived';else this.replanActorMotion(actor,'incomplete-route');return;}
  const p=actor.path[0];if(!this.canStand(p.x,p.y)){this.replanActorMotion(actor,'route-blocked');return;}
  const dx=p.x-actor.x,dy=p.y-actor.y,d=Math.hypot(dx,dy),step=Math.min(d,dt*(actor.speed||1.35)),before={x:actor.x,y:actor.y};
  if(d>.001)actor.moving=this.moveActor(actor,dx/d*step,dy/d*step,.12);actor.dir=Math.atan2(dy,dx);if(Math.hypot(p.x-actor.x,p.y-actor.y)<.035)actor.path.shift();
  const progress=Math.hypot(before.x-actor.x,before.y-actor.y);token.stall=progress<.0001?token.stall+dt:0;if(token.stall>1.4)this.replanActorMotion(actor,'stalled');
  if(!actor.path.length&&this.actorArrived(actor.id,token.target,.04))token.status='arrived';
 }
 planMotion(token){
  if(this.arrived(token.target,.04)){this.path=[];token.status='arrived';return true;}
  const p=this.player,t=token.target,path=this.findPath(Math.floor(p.x),Math.floor(p.y),Math.floor(t.x),Math.floor(t.y));
  if(!path)return false;this.path=path.map(q=>({x:q.x+.5,y:q.y+.5}));
  const last=this.path[this.path.length-1];if(!last||Math.hypot(last.x-t.x,last.y-t.y)>.02)this.path.push({...t});
  let length=0,prev=p;for(const next of this.path){length+=Math.hypot(next.x-prev.x,next.y-prev.y);prev=next;}
  token.maxSeconds=token.elapsed+Math.max(8,length/2.75*3+8);token.stall=0;return true;
 }
 findPath(sx,sy,gx,gy){
  sx=Math.floor(sx);sy=Math.floor(sy);gx=Math.floor(gx);gy=Math.floor(gy);if(!this.walkable(sx,sy)||!this.walkable(gx,gy))return null;
  const key=(x,y)=>`${x},${y}`,open=[{x:sx,y:sy,g:0,f:Math.hypot(gx-sx,gy-sy)}],cost=new Map([[key(sx,sy),0]]),from=new Map(),closed=new Set();let n=0;
  const limit=this.scene?this.scene.width*this.scene.height*4:7000;
  while(open.length&&n++<limit){let bi=0;for(let i=1;i<open.length;i++)if(open[i].f<open[bi].f)bi=i;const p=open.splice(bi,1)[0],pk=key(p.x,p.y);if(closed.has(pk))continue;
   if(p.x===gx&&p.y===gy){let out=[],k=pk;while(k!==key(sx,sy)){const [x,y]=k.split(',').map(Number);out.push({x,y});k=from.get(k);if(!k)return null;}return out.reverse();}
   closed.add(pk);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const x=p.x+dx,y=p.y+dy;if(!this.walkable(x,y)||(dx&&dy&&(!this.walkable(p.x+dx,p.y)||!this.walkable(p.x,p.y+dy))))continue;
    const k=key(x,y),g=p.g+(dx&&dy?Math.SQRT2:1);if(g>=(cost.get(k)??Infinity))continue;cost.set(k,g);from.set(k,pk);open.push({x,y,g,f:g+Math.hypot(gx-x,gy-y)});
   }
  }return null;
 }
 discover(id){if(this.discovered.has(id))return;this.discovered.add(id);this.opts.onDiscover?.(id);}
 failPlayerMotion(reason){if(this.motion){this.motion.status='failed';this.motion.reason=reason;}this.path=[];this.pendingInteraction=null;this.moving=false;this.setTaskVisual(null);this.releaseReservation('player');}
 replanMotion(reason){const m=this.motion;if(!m||m.status!=='moving')return;if(m.replans>=2||!this.canStand(m.target.x,m.target.y)){this.failPlayerMotion(reason);return;}m.replans++;if(!this.planMotion(m))this.failPlayerMotion('no-route');}
 advancePlayer(dt){
  const m=this.motion;if(!m||m.status!=='moving')return;
  m.elapsed+=dt;if(m.elapsed>m.maxSeconds){this.failPlayerMotion('route-timeout');return;}
  if(!this.path.length){if(this.arrived(m.target,.04))m.status='arrived';else this.replanMotion('incomplete-route');return;}
  const target=this.path[0];if(!this.canStand(target.x,target.y)){this.replanMotion('route-blocked');return;}
  const vx=target.x-this.player.x,vy=target.y-this.player.y,d=Math.hypot(vx,vy),step=dt*(this.anim==='run'?4.5:2.75),before={...this.player};
  if(d>.001)this.move(vx/d*Math.min(step,d),vy/d*Math.min(step,d));this.player.dir=Math.atan2(vy,vx);
  if(Math.hypot(target.x-this.player.x,target.y-this.player.y)<.035)this.path.shift();
  const progress=Math.hypot(before.x-this.player.x,before.y-this.player.y);m.stall=progress<.0001?m.stall+dt:0;
  if(m.stall>1)this.replanMotion('stalled');
  if(!this.path.length&&this.arrived(m.target,.04))m.status='arrived';
 }
 initNPCs(){const definitions=this.scene?.npcs||(this.zone==='outdoor'?[{id:'emilia',x:18.5,y:21.5,waypoints:[{x:18.5,y:21.5},{x:19.5,y:24.5},{x:16.5,y:24.5},{x:16.5,y:20.5}],shirt:'#b98065'}]:[]);this.npcs=definitions.map((n,i)=>({...n,waypoints:(n.waypoints||[]).map(p=>({...p})),path:[],motion:null,activeTask:null,directorOwned:false,anim:'idle',animUntil:0,waypoint:0,wait:i*1.4+1,blocked:0,turn:i,moving:false,dir:1}));}
 updateNPCs(dt){for(const n of this.npcs){
  n.moving=false;
  if(n.directorOwned){this.advanceActor(n,dt);if(this.time>n.animUntil)n.anim=n.moving?'walk':'idle';n.turn+=n.moving?dt*7:0;continue;}
  if(n.path.length){const t=n.path[0],dx=t.x-n.x,dy=t.y-n.y,d=Math.hypot(dx,dy),step=Math.min(d,dt*.8);if(d>.001)n.moving=this.moveActor(n,dx/d*step,dy/d*step,.12);n.dir=Math.atan2(dy,dx);n.turn+=n.moving?dt*7:0;if(Math.hypot(t.x-n.x,t.y-n.y)<.035)n.path.shift();n.blocked=n.moving?0:n.blocked+dt;if(n.blocked>1){n.path=[];n.wait=1;n.blocked=0;}if(!n.path.length)n.wait=2+hash(n.waypoint,Math.floor(this.time))*4;}
  else{n.wait-=dt;if(n.wait<=0&&n.waypoints.length){const target=n.waypoints[n.waypoint%n.waypoints.length];n.waypoint++;const path=this.findPath(Math.floor(n.x),Math.floor(n.y),Math.floor(target.x),Math.floor(target.y));if(path){n.path=path.map(p=>({x:p.x+.5,y:p.y+.5}));if(!n.path.length||Math.hypot(n.path[n.path.length-1].x-target.x,n.path[n.path.length-1].y-target.y)>.02)n.path.push({...target});}else n.wait=3;}}
 }}
 updateCat(dt){
  const cat=this.cat,distance=Math.hypot(this.player.x-cat.x,this.player.y-cat.y);cat.moving=false;cat.nextPlan=(cat.nextPlan||0)-dt;
  if(distance>1.6&&cat.nextPlan<=0){const candidates=[[-.8,.8],[.8,.8],[-.8,-.8],[.8,-.8]].map(([x,y])=>this.nearestFree(this.player.x+x,this.player.y+y,1)).filter(Boolean).sort((a,b)=>Math.hypot(a.x-cat.x,a.y-cat.y)-Math.hypot(b.x-cat.x,b.y-cat.y));
   for(const target of candidates){const path=this.findPath(Math.floor(cat.x),Math.floor(cat.y),Math.floor(target.x),Math.floor(target.y));if(path){cat.path=path.map(p=>({x:p.x+.5,y:p.y+.5}));if(!cat.path.length)cat.path.push({x:target.x,y:target.y});break;}}cat.nextPlan=1.5;
  }
  if(distance<1)cat.path=[];
  if(cat.path?.length){const t=cat.path[0],dx=t.x-cat.x,dy=t.y-cat.y,d=Math.hypot(dx,dy),step=Math.min(d,dt*3.3);if(d>.001)cat.moving=this.moveActor(cat,dx/d*step,dy/d*step,.1);if(Math.hypot(t.x-cat.x,t.y-cat.y)<.035)cat.path.shift();if(!cat.moving)cat.nextPlan=0;}
 }
 update(dt,now=performance.now()){
  if(this.paused)return;dt=clamp(Number(dt)||0,0,.1);this.time+=dt;let dx=0,dy=0;const k=this.keys;
  if(k.has('w')||k.has('arrowup')){dx--;dy--;}if(k.has('s')||k.has('arrowdown')){dx++;dy++;}if(k.has('a')||k.has('arrowleft')){dx--;dy++;}if(k.has('d')||k.has('arrowright')){dx++;dy--;}
  this.moving=false;if(dx||dy){if(this.motion?.status==='moving')this.cancelMovement('keyboard');this.animUntil=0;this.lastInput=now;const l=Math.hypot(dx,dy);this.move(dx/l*dt*3.1,dy/l*dt*3.1);this.player.dir=Math.atan2(dy,dx);}else this.advancePlayer(dt);
  if(this.moving){this.turn+=dt*11;if(!this.moveNotified||now-this.moveNotified>1800){this.opts.onMove?.();this.moveNotified=now;}}else this.turn=lerp(this.turn,Math.round(this.turn/Math.PI)*Math.PI,Math.min(dt*10,1));
  if(now>this.animUntil)this.anim=this.moving?'walk':'idle';
  if(!this.opts.onUpdate&&now-this.lastInput>18000&&!this.path.length&&now>this.animUntil){this.lastInput=now-9000;const moods=['look','stretch','curious','wave'];this.react(moods[Math.floor(hash(Math.floor(this.time),5)*moods.length)],2.6);}
  const cp=this.scene?.camera?this.project(this.scene.camera.x,this.scene.camera.y):this.project(this.player.x,this.player.y),f=1-Math.exp(-dt*5);this.camera.x=lerp(this.camera.x,cp.x,f);this.camera.y=lerp(this.camera.y,cp.y,f);
  this.updateCat(dt);this.updateNPCs(dt);
  const nearby=this.localPOIs().filter(p=>this.interactionDistance(p)<1.5).sort((a,b)=>this.interactionDistance(a)-this.interactionDistance(b))[0]||null;
  this.near=nearby;if(nearby?.id!==this.nearId){this.nearId=nearby?.id;this.opts.onNear?.(nearby?{...nearby}:null);}
  const pending=this.pendingInteraction;if(pending&&pending.sceneId===this.zone&&pending.token===this.motion){if(pending.token.status==='arrived'&&this.arrived(pending.token.target))this.fireInteraction(pending.object);else if(['failed','cancelled'].includes(pending.token.status))this.pendingInteraction=null;}
  if(this.zone==='outdoor'){if(this.player.x<10)this.discover('beach');if(this.player.y<12)this.discover('north');if(this.player.x>31)this.discover('mirador');}
  for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=45*dt;p.life-=dt;}this.particles=this.particles.filter(p=>p.life>0);
  this.opts.onUpdate?.(dt,now);
 }
 actorSpace(actor,x,y){if(actor===this.cat)return true;return [this.player,...this.npcs].every(other=>{if(actor===other)return true;const distance=Math.hypot(x-other.x,y-other.y);return distance>=.36||distance>Math.hypot(actor.x-other.x,actor.y-other.y)+.0001;});}
 moveActor(actor,dx,dy,margin=.16){let did=false;if(dx&&this.canStand(actor.x+dx,actor.y,margin)&&this.actorSpace(actor,actor.x+dx,actor.y)){actor.x+=dx;did=true;}if(dy&&this.canStand(actor.x,actor.y+dy,margin)&&this.actorSpace(actor,actor.x,actor.y+dy)){actor.y+=dy;did=true;}return did;}
 move(dx,dy){this.moving=this.moveActor(this.player,dx,dy);return this.moving;}
 poly(points,fill,stroke){const c=this.ctx;c.beginPath();c.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.7;c.stroke();}}
 box(x,y,w,d,h,color,top,left,z=0){const a=this.project(x,y,z),b=this.project(x+w,y,z),cc=this.project(x+w,y+d,z),dd=this.project(x,y+d,z),at={x:a.x,y:a.y-h},bt={x:b.x,y:b.y-h},ct={x:cc.x,y:cc.y-h},dt={x:dd.x,y:dd.y-h};this.poly([dd,cc,ct,dt],left||color);this.poly([b,cc,ct,bt],color);this.poly([at,bt,ct,dt],top||color);}
 ellipse(x,y,rx,ry,color){const c=this.ctx;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();}
 line(a,b,color,width=1){const c=this.ctx;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
 tile(x,y,color){this.poly([this.project(x,y),this.project(x+1,y),this.project(x+1,y+1),this.project(x,y+1)],color);}
 render(){const c=this.ctx,d=this.dpr;c.setTransform(d,0,0,d,0,0);const sky=c.createLinearGradient(0,0,0,this.h);const atmosphere=window.HabitaScenes?.getAtmosphere?.()||this.atmosphere?.();sky.addColorStop(0,atmosphere?.sky?.[0]||'#dce8e2');sky.addColorStop(1,atmosphere?.sky?.[1]||'#accac4');c.fillStyle=sky;c.fillRect(0,0,this.w,this.h);window.HabitaScenes?.drawBackdrop?.(this);c.save();c.translate(this.w/2,this.anchorY());c.scale(this.zoomLevel,this.zoomLevel);c.translate(-this.camera.x,-this.camera.y);
  if(window.HabitaScenes?.render?.(this)!==true){if(this.zone==='outdoor')this.drawOutdoor();else this.drawInterior();}
  for(const p of this.particles){const q=this.project(p.x,p.y,p.z);c.globalAlpha=clamp(p.life,0,1);c.fillStyle=p.color;c.fillRect(q.x,q.y,4,4);}c.globalAlpha=1;
  c.restore();if(atmosphere?.tint){c.fillStyle=atmosphere.tint;c.fillRect(0,0,this.w,this.h);}const vignette=c.createRadialGradient(this.w*.5,this.h*.4,this.w*.25,this.w*.5,this.h*.5,Math.max(this.w,this.h)*.85);vignette.addColorStop(0,'rgba(56,65,57,0)');vignette.addColorStop(1,'rgba(36,56,55,.14)');c.fillStyle=vignette;c.fillRect(0,0,this.w,this.h);
 }
 drawOutdoor(){const c=this.ctx,f=this.flags(),groundKey=!!f.trail;if(!this.groundCache||this.groundKey!==groundKey){const ground=document.createElement('canvas');ground.width=2050;ground.height=1040;const gc=ground.getContext('2d');gc.translate(1025,10);this.ctx=gc;for(let y=0;y<42;y++)for(let x=0;x<42;x++){const p=this.project(x,y);const t=this.terrain(x,y),h=hash(x,y);let color=t==='ocean'?['#8cbebd','#85b9b9','#90c1bf'][Math.floor(h*3)]:t==='sand'?['#e6d3b0','#e9d8b7','#e2cfaa'][Math.floor(h*3)]:t==='path'?['#d8c9ae','#d5c4a6','#dbcdb5'][Math.floor(h*3)]:t==='river'?'#89b8b2':['#a5b991','#a9bc94','#a1b58c','#adbe99'][Math.floor(h*4)];if(x>=31&&y<=10)color=f.trail?'#a5b58e':'#a7b5a3';this.tile(x,y,color);
   if(t==='ocean'&&h>.68){let q=this.project(x+.5,y+.5);this.line({x:q.x-8,y:q.y+Math.sin(this.time*1.1+x)*2},{x:q.x+7,y:q.y+Math.sin(this.time*1.1+x)*2},`rgba(242,248,224,${.15+.12*Math.sin(this.time+x+y)})`,1.5);}if(t==='sand'&&h>.8){let q=this.project(x+.4,y+.4);this.ellipse(q.x,q.y,1.6,.7,'#c9b894');}if(t==='grass'&&h>.7&&!this.treeCells.has(`${x},${y}`)){let q=this.project(x+.4,y+.4);this.line(q,{x:q.x-2,y:q.y-3},'#8da47d',.8);}
  }
  this.ctx=c;this.groundCache=ground;this.groundKey=groundKey;}c.drawImage(this.groundCache,-1025,-10);
  for(let y=0;y<42;y+=1.5){let x=1.5+Math.sin(y)*1.2,q=this.project(x,y),dy=Math.sin(this.time+y)*1.3;this.line({x:q.x-7,y:q.y+dy},{x:q.x+5,y:q.y+dy},'rgba(239,248,224,.22)',1.2);}
  // Continuous soft foam along the water's edge.
  for(let y=0;y<42;y+=.45){let x=4+Math.sin(y*.22)*1.1,q=this.project(x,y);this.ellipse(q.x+Math.sin(this.time+y)*2,q.y,8,2.2,'rgba(243,241,214,.38)');}
  this.drawGarden(f.garden);this.drawBridge(f.bridge);this.drawRoute();
  const objects=[];for(const t of this.trees)objects.push({depth:t.x+t.y,draw:()=>this.drawTree(t)});for(const r of this.rocks)objects.push({depth:r.x+r.y,draw:()=>this.box(r.x,r.y,.8,.6,r.h,'#a4a69b','#c7c5b3','#b6b5a7')});for(const p of POIS.filter(p=>p.bx!=null))objects.push({depth:p.bx+p.by+p.bw+p.bd-.5,draw:()=>this.drawBuilding(p)});
  objects.push({depth:39,draw:()=>this.drawBench(18,20)});for(const npc of this.npcs)objects.push({depth:npc.x+npc.y,draw:()=>this.drawPerson(npc.x,npc.y,npc.moving?'walk':'look',npc)});
  for(const [x,y] of [[12,23],[16,33],[25,12],[10,12],[27,25]])objects.push({depth:x+y,draw:()=>this.drawLamp(x,y)});
  objects.push({depth:this.player.x+this.player.y,draw:()=>this.drawPerson(this.player.x,this.player.y,this.anim)});objects.push({depth:this.cat.x+this.cat.y,draw:()=>this.drawCat()});
  objects.push({depth:39,draw:()=>this.drawGate(f.trail)});objects.push({depth:43,draw:()=>this.drawLookout()});objects.sort((a,b)=>a.depth-b.depth).forEach(o=>{const cy=o.depth*this.th/2;if(Math.abs(cy-this.camera.y)<this.h/this.zoomLevel/2+190)o.draw();});
  for(const poi of this.getPOIs())this.drawPoi(poi);
  if(!f.expedition){c.save();for(let i=0;i<7;i++){const q=this.project(34+(i%3),3+i);const g=c.createRadialGradient(q.x,q.y,5,q.x,q.y,100);g.addColorStop(0,'rgba(225,230,213,.44)');g.addColorStop(1,'rgba(225,230,213,0)');c.fillStyle=g;c.fillRect(q.x-100,q.y-100,200,200);}c.restore();}
  // Little gulls over the sea.
  for(let i=0;i<3;i++){const q=this.project(2+Math.sin(this.time*.09+i)*1.5,12+i*7,80+Math.sin(this.time*.3+i)*10);const flap=Math.sin(this.time*2+i)*3;this.line({x:q.x-6,y:q.y+flap},q,'#f5efde',1.8);this.line(q,{x:q.x+6,y:q.y+flap},'#f5efde',1.8);}
 }
 drawRoute(){if(this.path.length){for(let i=1;i<this.path.length;i+=2){const p=this.project(this.path[i].x,this.path[i].y,1);this.ellipse(p.x,p.y,2.2,1.2,'rgba(249,250,227,.7)');}}if(this.marker&&this.time-this.marker.time<3){const p=this.project(this.marker.x,this.marker.y,1);this.ctx.strokeStyle='rgba(252,250,229,.8)';this.ctx.lineWidth=1.7;this.ctx.beginPath();this.ctx.ellipse(p.x,p.y,12+Math.sin(this.time*4)*2,6,0,0,TAU);this.ctx.stroke();}}
 drawTree(t){const q=this.project(t.x,t.y),sway=Math.sin(this.time*.7+t.x)*1;this.ellipse(q.x+5,q.y+2,19,7,'rgba(59,78,58,.14)');this.box(t.x-.08,t.y-.08,.16,.16,t.h*.6,'#867854','#ac9263','#8c805b');if(t.type==='pine'){for(let n=0;n<3;n++){const r=15-n*3,z=t.h*.36+n*10;this.poly([{x:q.x+sway,y:q.y-z-21},{x:q.x+r+sway,y:q.y-z},{x:q.x+sway,y:q.y-z+7},{x:q.x-r+sway,y:q.y-z}],['#648a6d','#709577','#7b9e7d'][n]);}}else{this.box(t.x-.65+sway/30,t.y-.6,1.25,1.2,19,'#779770','#a1b78a','#89a57b',t.h*.57);this.box(t.x-.43+sway/30,t.y-.45,.86,.88,15,'#86a27a','#aec192','#91ac81',t.h*.57+16);}}
 drawApartment(p){const {bx:x,by:y,bw:w,bd:d}=p;this.box(x-.1,y-.1,w+.2,d+.2,7,'#b8b4a3','#ded4bd','#c6bba4');this.box(x,y,w,d,125,'#e6dfcc','#f5ecd7','#c7cebd',7);for(let floor=0;floor<5;floor++){const z=17+floor*22;for(let i=.45;i<w-.2;i+=1.1){this.box(x+i,y+d+.025,.68,.025,13,'#84a8a7','#cbd6bd','#709b9b',z);this.box(x+i-.08,y+d,.84,.38,2,'#e2d9c2','#f2e7cc','#c5c7b4',z-2);this.line(this.project(x+i-.08,y+d+.38,z+3),this.project(x+i+.76,y+d+.38,z+3),'#9aaea4',1);}for(let j=.35;j<d-.2;j+=1)this.box(x+w+.015,y+j,.025,.62,13,'#7eaaa9','#dce0c5','#91b3ad',z);}this.box(x-.1,y-.1,w+.2,d+.2,5,'#adb9aa','#d7dac5','#b8c3b2',132);this.box(x+1,y+.7,1.8,1.2,14,'#bbc4b2','#dedec6','#abb9aa',137);this.box(x+w-1.2,y+d+.025,.8,.025,18,'#698a8a','#c2d0bc','#779b98',7);this.box(x+w-1.4,y+d,1.3,.7,3,'#9baa9b','#ccd4bd','#b3c0ac',28);const q=this.project(x+.6,y+d+.05,13);this.ctx.fillStyle='#667f75';this.ctx.font='bold 6px sans-serif';this.ctx.fillText('BRISA',q.x,q.y);}
 drawBuilding(p){if(p.id==='home'){this.drawApartment(p);return;}const {bx:x,by:y,bw:w,bd:d}=p,q=this.project(x+w/2,y+d/2);this.ellipse(q.x+12,q.y+9,w*21,d*10,'rgba(61,77,65,.12)');this.box(x-.1,y-.1,w+.2,d+.2,5,'#b6b09a','#d1c6ae','#c0b79f');this.box(x,y,w,d,49,p.color,'#f3e8d5',this.shade(p.color,-16),5);
  const a=this.project(x-.25,y-.25,55),b=this.project(x+w+.25,y-.25,55),cc=this.project(x+w+.25,y+d+.25,55),dd=this.project(x-.25,y+d+.25,55),r1=this.project(x-.25,y+d/2,81),r2=this.project(x+w+.25,y+d/2,81);this.poly([a,b,r2,r1],this.shade(p.roof,15));this.poly([r1,r2,cc,dd],p.roof);this.poly([b,r2,cc],this.shade(p.roof,-20));
  for(let i=.6;i<w-.3;i+=1.2){this.box(x+i,y+d+.015,.65,.025,18,'#668f92','#f4e4be','#96b6b0',19);const v=this.project(x+i+.325,y+d+.05,19);this.line(v,{x:v.x,y:v.y-18},'#e5d8bf',1.5);}
  this.box(x+w,y+.5,.025,.75,20,'#709697','#eee5ce','#7c9996',18);this.box(x+w-1,y+d+.025,.65,.04,28,'#927958','#b39873','#987f5e',5);if(p.id==='cafe'){this.box(x+.1,y+d,.0+3.7,.85,5,'#e4b58a','#edd3a2','#d49c75',34);for(let i=0;i<4;i++)this.box(x+.15+i*.9,y+d,.4,.85,1,'#faf0d5','#f7e7c3','#f7e7c3',39);this.drawBench(x+.4,y+d+1.4);}
  if(p.id==='library'&&this.flags().library){const z=this.project(x+w/2,y+d+.1,43);this.ctx.fillStyle='#5c7d76';this.ctx.font='bold 15px serif';this.ctx.textAlign='center';this.ctx.fillText('▥',z.x,z.y);}
  this.box(x+.45,y+.5,.5,.6,16,'#a18c79','#c3ac91','#b3997f',76);const chimney=this.project(x+.7,y+.8,96);for(let i=0;i<3;i++)this.ellipse(chimney.x+Math.sin(this.time*.5+i)*6,chimney.y-((this.time*7+i*9)%28),5+i*2,3+i,'rgba(250,244,225,.17)');
 }
 shade(hex,n){const v=parseInt(hex.slice(1),16);return '#'+[v>>16,(v>>8)&255,v&255].map(c=>clamp(c+n,0,255).toString(16).padStart(2,'0')).join('');}
 drawBench(x,y){this.box(x,y,.15,.6,8,'#68776a','#88917b','#76836e');this.box(x+1.45,y,.15,.6,8,'#68776a','#88917b','#76836e');this.box(x-.1,y,1.9,.7,4,'#9c8061','#bca07b','#a48a66',8);this.box(x-.1,y-.08,1.9,.1,14,'#aa906c','#c6ac83','#ae916a',11);}
 drawLamp(x,y){this.box(x,y,.1,.1,39,'#73857b','#8c998c','#6e8077');this.box(x-.15,y-.15,.4,.4,7,'#d2cfa9','#f6e2ac','#e1d8ad',39);const q=this.project(x,y,43);const g=this.ctx.createRadialGradient(q.x,q.y,1,q.x,q.y,22);g.addColorStop(0,'rgba(254,226,157,.2)');g.addColorStop(1,'rgba(254,226,157,0)');this.ctx.fillStyle=g;this.ctx.fillRect(q.x-22,q.y-22,44,44);}
 drawGarden(active){for(let x=23;x<28;x++)for(let y=5;y<8;y++){this.box(x,y,.88,.88,3,'#b9a187','#c8b295','#b49d80');const h=hash(x,y);for(let i=0;i<3;i++){const q=this.project(x+.15+i*.23,y+.4,active?7:4);this.line(q,{x:q.x,y:q.y-4},'#6b966a',1.5);if(active)this.ellipse(q.x,q.y-5,2.7,2,['#e4aa83','#f3d88c','#e8c9ab'][Math.floor(h*3)]);}}}
 drawBridge(active){for(let x=32;x<35;x++)for(let y=20;y<23;y++){if(!active&&y===21&&x>32)continue;this.box(x,y,.92,.98,active?6:3,'#ac906c','#c9ae84','#b79b72');}for(const x of [32,35])for(const y of [20,22])this.box(x,y,.12,.12,18,'#9c8467','#b59b79','#a0896c');if(active)for(const x of [32,35])this.line(this.project(x,20,17),this.project(x,22,17),'#b6a082',2);}
 drawGate(active){this.box(30.4,7,.17,.17,24,'#97866c','#b9a17e','#a79274');this.box(30.4,9.4,.17,.17,24,'#97866c','#b9a17e','#a79274');if(!active){this.line(this.project(30.5,7.1,15),this.project(30.5,9.5,15),'#b89b71',4);this.line(this.project(30.5,7.1,5),this.project(30.5,9.5,20),'#c2a980',3);}else this.line(this.project(30.5,7.1,15),this.project(32.3,7.1,15),'#b89b71',3);}
 drawLookout(){this.box(35,4,3,3,8,'#b3a88e','#d0c5ab','#bcb199');for(let x=35;x<=38;x+=1)this.box(x,4,.1,.1,18,'#a0957e','#b9ac8d','#a2957a',8);this.line(this.project(35,4,26),this.project(38,4,26),'#aea084',2);}
 drawPoi(p){const near=this.near?.id===p.id,q=this.project(p.x,p.y,near?31:25),c=this.ctx;if(Math.hypot(this.player.x-p.x,this.player.y-p.y)<1.2){q.x+=24;q.y-=14;}if(Math.abs(q.x-this.camera.x)>this.w/this.zoomLevel/2+30)return;const locked=(p.id==='expedition'&&!this.flags().expedition);c.globalAlpha=locked?.5:1;this.ellipse(q.x,q.y+2,near?13:10,near?13:10,near?'#fbf5df':'rgba(249,246,225,.9)');c.fillStyle='#57756d';c.font=`${near?'bold ':''}${near?13:11}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(locked?'?':p.icon,q.x,q.y+1);this.line({x:q.x,y:q.y+12},{x:q.x,y:q.y+17},'rgba(89,117,107,.45)',1);c.globalAlpha=1;c.textBaseline='alphabetic';}
 drawPerson(x,y,anim,npc=false){if(window.HabitaScenes?.drawPerson?.(this,x,y,anim,npc)===true)return;const c=this.ctx,p=this.project(x,y),t=this.time,walk=(!npc&&this.moving)||anim==='walk'||anim==='run',phase=walk?Math.sin(npc?.turn??this.turn):0;let bob=walk?Math.abs(phase)*1.3:Math.sin(t*1.9)*.45,z=0;
  this.ellipse(p.x+2,p.y+2,10,4,'rgba(44,66,61,.18)');if(anim==='celebrate'||anim==='surprised')z=Math.abs(Math.sin(t*6))*5;if(anim==='sleep'){this.box(x-.6,y-.2,1.1,.5,10,'#385763','#486b75','#314c59',3);this.box(x+.3,y-.2,.4,.5,11,'#cca589','#e6bf9b','#d6ac8b',4);const q=this.project(x+.6,y-.2,26);c.font='12px sans-serif';c.fillStyle='#6d8987';c.fillText('z',q.x+5,q.y-Math.sin(t)*3);return;}
  let profile=this.state().profile||{},shirt=npc?'#b98065':(/^#[0-9a-f]{6}$/i.test(profile.shirt)?profile.shirt:'#314e65'),skin=/^#[0-9a-f]{6}$/i.test(profile.skin)?profile.skin:'#d7ad88',hair=/^#[0-9a-f]{6}$/i.test(profile.hair)?profile.hair:'#353c3a';const sit=anim==='sit'||anim==='read'||anim==='eat',crouch=sit?7:anim==='train'?Math.sin(t*4)*4+4:0,base=z+bob-crouch;
  this.box(x-.22,y-.12,.19,.23,10+phase*2,'#354857','#52606a','#3d4d57',z+Math.max(0,phase)*3);this.box(x+.07,y-.12,.19,.23,10-phase*2,'#354857','#52606a','#3d4d57',z+Math.max(0,-phase)*3);this.box(x-.25,y-.09,.21,.28,3,'#e1dcca','#f3ead6','#bbc0b5',z+Math.max(0,phase)*3);this.box(x+.06,y-.09,.21,.28,3,'#e1dcca','#f3ead6','#bbc0b5',z+Math.max(0,-phase)*3);
  this.box(x-.27,y-.21,.53,.43,13,shirt,this.shade(shirt,18),this.shade(shirt,-12),11+base);
  let raise=['wave','celebrate','stretch','train','interact'].includes(anim)?7+Math.sin(t*5)*3:anim==='think'?5:0;
  this.box(x-.41,y-.12,.14,.2,10,skin,this.shade(skin,12),this.shade(skin,-10),10+base+raise+phase*2);this.box(x+.29,y-.12,.14,.2,10,skin,this.shade(skin,12),this.shade(skin,-10),10+base+(anim==='celebrate'||anim==='stretch'?raise:0)-phase*2);
  this.box(x-.25,y-.23,.5,.48,12,skin,this.shade(skin,16),this.shade(skin,-10),25+base);this.box(x-.28,y-.25,.56,.52,5,hair,this.shade(hair,10),this.shade(hair,-8),35+base);this.box(x-.28,y-.25,.15,.52,9,hair,hair,this.shade(hair,-8),29+base);
  const facing=npc||Math.sin(this.player.dir)>=0;let face=this.project(x+(facing?.03:.27),y+(facing?.255:.02),31+base);c.fillStyle='#34433f';c.fillRect(face.x-2,face.y,1.7,2);c.fillRect(face.x+3,face.y-2,1.7,2);
  if(anim==='read'){this.box(x+.03,y+.35,.46,.35,2,'#c99969','#eed8a5','#bd8b5e',20+base);this.line(this.project(x+.25,y+.35,23+base),this.project(x+.25,y+.7,23+base),'#c4b88f',1);}if(anim==='eat'){const q=this.project(x+.35,y+.15,27+base);this.ellipse(q.x,q.y,4,3,'#e5c086');}if(anim==='train'){this.box(x-.52,y-.15,.2,.25,5,'#627776','#93a39c','#5c7270',15+raise);this.box(x+.38,y-.15,.2,.25,5,'#627776','#93a39c','#5c7270',15);}
  if(['curious','surprised','think','tired'].includes(anim)){const q=this.project(x,y,53+base);c.fillStyle='#6f8275';c.font='bold 15px sans-serif';c.textAlign='center';c.fillText(anim==='curious'?'?':anim==='surprised'?'!':anim==='tired'?'…':'· ·',q.x,q.y+Math.sin(t*2));}
  if(npc&&this.flags().friend){const q=this.project(x,y,48);c.fillStyle='#c5907b';c.font='12px sans-serif';c.fillText('♥',q.x,q.y+Math.sin(t)*2);}
 }
 drawCat(){if(window.HabitaScenes?.drawCat?.(this)===true)return;const {x,y}=this.cat,p=this.project(x,y),z=Math.sin(this.time*4)*.4;this.ellipse(p.x,p.y,7,3,'rgba(44,66,61,.14)');this.box(x-.22,y-.18,.44,.55,7,'#909c99','#c1c6bc','#a8b2ac',3+z);this.box(x-.2,y+.16,.4,.3,8,'#c9cec3','#e5e4d8','#afbdb4',7+z);this.box(x-.2,y+.16,.1,.15,4,'#8a9894','#aeb9b0','#98a69e',15+z);this.box(x+.1,y+.16,.1,.15,4,'#8a9894','#aeb9b0','#98a69e',15+z);const a=this.project(x,y-.25,7),b={x:a.x+8,y:a.y-5+Math.sin(this.time*2)*3};this.line(a,b,'#a1ada5',3);const q=this.project(x,y+.47,11+z);this.ctx.fillStyle='#586a60';this.ctx.fillRect(q.x-3,q.y,1.5,1.5);this.ctx.fillRect(q.x+2,q.y-2,1.5,1.5);}
 furniture(){const z=this.zone;if(z==='home')return [{x:2,y:2,w:4,d:2,type:this.state().profile?.care?.room?.kind==='studio'?'desk':'bed'},{x:10,y:3,w:3,d:2,type:'sofa'},{x:3,y:8,w:2,d:2,type:'table'},{x:12,y:10,w:1,d:1,type:'plant'}];if(z==='gym')return [{x:3,y:3,w:3,d:2,type:'mat'},{x:9,y:3,w:3,d:2,type:'mat'},{x:3,y:8,w:2,d:2,type:'weights'},{x:11,y:9,w:1,d:1,type:'plant'}];if(z==='library')return [{x:2,y:2,w:5,d:1,type:'books'},{x:9,y:2,w:4,d:1,type:'books'},{x:3,y:6,w:2,d:3,type:'books'},{x:9,y:7,w:3,d:2,type:'table'}];return [{x:3,y:3,w:3,d:2,type:'desk'},{x:9,y:4,w:3,d:2,type:'table'},{x:3,y:9,w:2,d:2,type:'sofa'},{x:12,y:11,w:1,d:1,type:'plant'}];}
 drawInterior(){const c=this.ctx,room=this.zone==='home'?this.state().profile?.care?.room:null;this.box(0,0,16,16,8,'#bdad91','#deceb0','#c8b89a',-8);for(let x=0;x<16;x++)for(let y=0;y<16;y++)this.tile(x,y,room?((x+y)%2?room.floor:this.shade(room.floor,7)):((x+y)%2?'#deceb2':'#e3d4b9'));this.box(0,0,16,.2,70,room?.wall||'#d8d8c4',room?this.shade(room.wall,12):'#f2e6cf',room?this.shade(room.wall,-10):'#d0d2bd');this.box(0,0,.2,16,70,room?.wall||'#d9d9c5',room?this.shade(room.wall,12):'#f2e6cf',room?this.shade(room.wall,-10):'#c6cdbb');for(let x=3;x<14;x+=5)this.box(x,.23,2.3,.03,30,'#a7c7bf','#e4ead5','#a4c0b7',25);const rug=this.zone==='gym'?'#9cafaa':this.zone==='library'?'#b9b58b':'#beaa8b';this.poly([this.project(5,5),this.project(11,5),this.project(11,11),this.project(5,11)],rug);this.drawRoute();const o=this.furniture().map(p=>({depth:p.x+p.y+p.w+p.d,draw:()=>this.drawFurniture(p)}));o.push({depth:this.player.x+this.player.y,draw:()=>this.drawPerson(this.player.x,this.player.y,this.anim)},{depth:this.cat.x+this.cat.y,draw:()=>this.drawCat()});o.sort((a,b)=>a.depth-b.depth).forEach(p=>p.draw());this.localPOIs().forEach(p=>this.drawPoi(p));}
 drawFurniture(p){const {x,y,w,d,type}=p;if(type==='plant'){this.box(x,y,.6,.6,12,'#ba8f70','#d5ad83','#bd9473');this.drawTree({x:x+.3,y:y+.3,h:27,type:'round'});return;}if(type==='mat'){this.box(x,y,w,d,2,'#829d98','#9db7ad','#78988c');return;}if(type==='books'){this.box(x,y,w,d,38,'#9a8260','#c2a77e','#aa906a');for(let z=6;z<35;z+=12)for(let i=.15;i<w-.1;i+=.3)this.box(x+i,y+d,.18,.05,9,['#75918c','#b98064','#c6b582'][Math.floor(hash(Math.floor(i*10),z)*3)],'#d5c7a5','#82918a',z);return;}if(type==='bed'){this.box(x,y,w,d,14,'#ad9473','#e7dec5','#b7a080');this.box(x+1,y+.1,w-1,d-.2,4,'#859d97','#b0c0ac','#91a79b',14);this.box(x+.15,y+.2,.8,d-.4,5,'#e9e5d3','#f6efdb','#dddcca',15);return;}if(type==='sofa'){this.box(x,y,w,d,11,'#8a9e8c','#a7b59d','#899e89');this.box(x,y,w,.35,23,'#92a690','#b3bea1','#9aae91');return;}this.box(x,y,.17,.17,17,'#9b8464','#bca27a','#ab9270');this.box(x+w-.17,y+d-.17,.17,.17,17,'#9b8464','#bca27a','#ab9270');this.box(x,y,w,d,5,'#b79b75','#d4ba90','#c5aa80',17);if(type==='desk'){this.box(x+.8,y+.5,1,.1,14,'#596e70','#879992','#617a78',22);this.box(x+.7,y+.7,1.2,.5,1,'#b7c1b3','#d5d8c5','#bac5b7',22);}else{this.box(x+.5,y+.5,.7,.6,2,'#b78b62','#eee0b7','#bd926d',22);}}
}
window.HabitaWorld=HabitaWorld;
})();
