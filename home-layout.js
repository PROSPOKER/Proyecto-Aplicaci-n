/* Habita home layout. Pure composition and the same tile collisions as HabitaWorld. */
(() => {
'use strict';
const BASE_IDS = ['home-bed','home-desk','home-plant','home-books','home-sofa','home-table','home-cat'];
const START = [
  ['home-bed',1,1],['home-desk',6,1],['home-plant',8,2],
  ['home-books',1,3],['home-sofa',1,5],['home-table',6,5],['home-cat',8,6]
];
const copy = value => Array.isArray(value) ? value.map(copy) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).map(([key,item]) => [key,copy(item)])) : value;
const key = (x,y) => x+','+y;
const finitePoint = p => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const overlaps = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.d && a.y+a.d > b.y;
const rect = p => finitePoint(p) && Number.isInteger(p.w) && Number.isInteger(p.d) && p.w > 0 && p.d > 0;
const catalogItems = () => Array.isArray(window.HabitaCatalog?.items) ? window.HabitaCatalog.items : [];
function problem(message,code='invalid-layout') {const error=new Error(message);error.code=code;throw error;}

function fresh(baseScene) {
  return {version:1,revision:0,placements:START.map(([id,x,y])=>{
    const base=baseScene?.objects?.find(o=>o.id===id);
    return {instanceId:id,itemId:'base-'+id,x:base?.x??x,y:base?.y??y,rotation:0};
  })};
}

function normalize(raw) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw) || raw.version!==1 ||
     !Number.isInteger(raw.revision) || raw.revision<0 || !Array.isArray(raw.placements) || raw.placements.length>120)
    problem('La distribución guardada tiene un formato incompatible.');
  const instances=new Set();
  const placements=raw.placements.map(p=>{
    if(!p || typeof p!=='object' || typeof p.instanceId!=='string' || !p.instanceId || p.instanceId.length>160 ||
       typeof p.itemId!=='string' || !p.itemId || p.itemId.length>120 ||
       !Number.isInteger(p.x) || !Number.isInteger(p.y) ||
       !Number.isInteger(p.rotation) || p.rotation<0 || p.rotation>3)
      problem('Un mueble tiene coordenadas o identificación inválidas.','invalid-placement');
    if(instances.has(p.instanceId))problem('Hay un mueble colocado más de una vez.','duplicate');
    instances.add(p.instanceId);
    return {instanceId:p.instanceId,itemId:p.itemId,x:p.x,y:p.y,rotation:p.rotation};
  });
  return {version:1,revision:raw.revision,placements};
}

function turnPoint(p,w,d,rotation) {
  if(rotation===1)return {x:d-p.y,y:p.x};
  if(rotation===2)return {x:w-p.x,y:d-p.y};
  if(rotation===3)return {x:p.y,y:w-p.x};
  return {x:p.x,y:p.y};
}

function adjacentPoints(w,d) {
  const points=[];
  for(let x=0;x<w;x++){points.push({x:x+.5,y:d+.5},{x:x+.5,y:-.5});}
  for(let y=0;y<d;y++){points.push({x:w+.5,y:y+.5},{x:-.5,y:y+.5});}
  return points;
}

function fallbackTasks(type) {
  const task=(id,label,animation,prop,actions)=>({id,label,animation,prop,actions,minSeconds:7,maxSeconds:14});
  const tasks={
    bed:[task('prepare-rest','preparar su descanso','tidy','cloth',['sleep','prepare','rest'])],
    desk:[task('write-idea','anotar una idea','write','pencil',['idea','goal','prepare'])],
    books:[task('read-pages','elegir unas páginas','read','book',['learn','idea','rest'])],
    sofa:[task('sofa-read','leer con calma','read','book',['learn','rest','sleep'])],
    table:[task('make-tea','preparar una taza','eat','cup',['food','water','social','rest'])],
    plant:[task('water-leaves','regar su planta','water','water',['hobby','organize','water'])],
    planter:[task('water-leaves','cuidar las flores','water','water',['hobby','organize','water'])],
    basket:[task('pet-cat','acompañar a su gato','pet','heart',['social','self','hobby'])],
    easel:[task('draw-project','avanzar en su dibujo','draw','pencil',['hobby','idea','goal'])],
    bench:[task('pause','tomarse un respiro','sit','none',['rest','self'])],
    rug:[task('stretch','estirarse despacio','stretch',null,['exercise','walk'])],
    lamp:[task('quiet-light','preparar una luz tranquila','interact','spark',['rest','sleep','prepare'])]
  };
  return tasks[type]||[task('care-object','cuidar su espacio','tidy','cloth',['organize','prepare'])];
}

function ownedItem(state,id) {return Array.isArray(state?.economy?.owned) && state.economy.owned.includes(id);}
function definition(baseScene,p,state) {
  if(BASE_IDS.includes(p.instanceId)){
    if(p.itemId!=='base-'+p.instanceId)problem('La identidad de un mueble del piloto cambió.','invalid-item');
    const base=baseScene.objects.find(o=>o.id===p.instanceId);
    if(!base)problem('Falta un mueble de referencia del piloto.','invalid-item');
    const w=base.w||1,d=base.d||1;
    return {...copy(base),w,d,solid:true,usePoints:(base.usePoints||adjacentPoints(w,d).map(v=>({x:v.x+base.x,y:v.y+base.y})))
      .map(v=>({x:v.x-base.x,y:v.y-base.y}))};
  }
  const item=catalogItems().find(item=>item.id===p.itemId && item.kind==='furniture');
  if(!item || !item.furniture)problem('Un mueble ya no está disponible en el catálogo.','unknown-item');
  if(p.instanceId!=='owned-'+item.id)problem('La identificación del mueble comprado es inválida.','invalid-item');
  if(!ownedItem(state,item.id))problem('Sólo puedes colocar muebles que ya tengas.','unowned-item');
  const furniture=copy(item.furniture),w=furniture.w,d=furniture.d;
  if(!Number.isInteger(w)||w<1||!Number.isInteger(d)||d<1||typeof furniture.type!=='string')
    problem('Las medidas del mueble son incompatibles.','invalid-item');
  const type=furniture.type;
  return {...furniture,id:p.instanceId,name:item.name||item.label||p.itemId,w,d,
    solid:furniture.solid??(type!=='rug'),
    usePoints:Array.isArray(furniture.usePoints)&&furniture.usePoints.length?furniture.usePoints:adjacentPoints(w,d),
    tasks:Array.isArray(furniture.tasks)&&furniture.tasks.length?furniture.tasks:fallbackTasks(type)};
}

function compose(baseScene,raw,state={}) {
  if(!baseScene || baseScene.id!=='home' || !Array.isArray(baseScene.objects))problem('Falta la casa de referencia.','invalid-scene');
  const layout=normalize(raw),scene=copy(baseScene),baseMovable=baseScene.objects.filter(o=>BASE_IDS.includes(o.id));
  // Remove only the seven original footprints; retain any structural collision rectangles.
  scene.solids=(baseScene.solids||[]).filter(s=>!baseMovable.some(o=>s.x===o.x&&s.y===o.y&&s.w===(o.w||1)&&s.d===(o.d||1))).map(copy);
  scene.objects=baseScene.objects.filter(o=>!BASE_IDS.includes(o.id)).map(copy);
  for(const p of layout.placements){
    const source=definition(baseScene,p,state),w=source.w,d=source.d;
    if(!rect({x:0,y:0,w,d}))problem('Las medidas del mueble son inválidas.','invalid-item');
    const usePoints=source.usePoints.map(point=>{
      if(!finitePoint(point))problem('El punto de uso de un mueble es inválido.','invalid-item');
      const turned=turnPoint(point,w,d,p.rotation);return {x:p.x+turned.x,y:p.y+turned.y};
    });
    const object={...source,id:p.instanceId,itemId:p.itemId,instanceId:p.instanceId,x:p.x,y:p.y,
      w:p.rotation%2?d:w,d:p.rotation%2?w:d,rotation:p.rotation,
      baseW:w,baseD:d,usePoints};
    scene.objects.push(object);
    if(object.solid)scene.solids.push({x:object.x,y:object.y,w:object.w,d:object.d,objectId:object.id});
  }
  scene.layoutRevision=layout.revision;
  return scene;
}

function validate(scene,{actors=[]}={}) {
  const errors=[],codes=[];
  const fail=(code,message)=>{codes.push(code);errors.push(message);};
  if(!scene || !Number.isInteger(scene.width)||scene.width<1||!Number.isInteger(scene.height)||scene.height<1||
     !Array.isArray(scene.solids)||!Array.isArray(scene.objects)||!finitePoint(scene.spawn))
    return {ok:false,errors:['La casa tiene un formato incompatible.'],code:'invalid-scene'};
  const solids=scene.solids;
  for(const solid of solids){
    if(!rect(solid)){fail('invalid-item','Un mueble tiene medidas inválidas.');continue;}
    if(solid.x<0||solid.y<0||solid.x+solid.w>scene.width||solid.y+solid.d>scene.height)
      fail('outside','Un mueble queda fuera de la habitación.');
  }
  for(const object of scene.objects){
    if(BASE_IDS.includes(object.id)||object.instanceId){
      if(!rect(object)||object.x<0||object.y<0||object.x+object.w>scene.width||object.y+object.d>scene.height)
        fail('outside',(object.name||'Un mueble')+' queda fuera de la habitación.');
    }
  }
  for(let a=0;a<solids.length;a++)for(let b=a+1;b<solids.length;b++){
    if(rect(solids[a])&&rect(solids[b])&&overlaps(solids[a],solids[b]))
      fail('overlap','Dos muebles ocupan el mismo espacio.');
  }
  // HabitaWorld.walkable floors coordinates and blocks every tile intersecting a solid.
  const walkable=(x,y)=>{
    if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    x=Math.floor(x);y=Math.floor(y);
    return x>=0&&y>=0&&x<scene.width&&y<scene.height && !solids.some(s=>rect(s)&&x<s.x+s.w&&x+1>s.x&&y<s.y+s.d&&y+1>s.y);
  };
  const canStand=(p,margin=.16)=>finitePoint(p)&&walkable(p.x-margin,p.y-margin)&&walkable(p.x+margin,p.y-margin)&&
    walkable(p.x-margin,p.y+margin)&&walkable(p.x+margin,p.y+margin);
  if(!canStand(scene.spawn))fail('spawn-blocked','Deja libre el punto de entrada a tu casa.');
  const reached=new Set(),queue=[];
  if(canStand(scene.spawn)){const x=Math.floor(scene.spawn.x),y=Math.floor(scene.spawn.y);reached.add(key(x,y));queue.push({x,y});}
  for(let i=0;i<queue.length;i++){
    const p=queue[i];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=p.x+dx,y=p.y+dy,k=key(x,y);
      if(!reached.has(k)&&walkable(x,y)){reached.add(k);queue.push({x,y});}
    }
  }
  const accessible=p=>canStand(p)&&reached.has(key(Math.floor(p.x),Math.floor(p.y)));
  for(const portal of scene.portals||[]){
    const points=portal.usePoints?.length?portal.usePoints:[portal];
    if(!points.some(accessible))fail('portal-blocked','Mantén un camino libre hasta la salida.');
  }
  for(const object of scene.objects){
    if(!(object.tasks||[]).length)continue;
    if(!(object.usePoints||[]).some(accessible))
      fail('unreachable-object','Necesitas dejar un lugar accesible para usar '+(object.name||'este mueble')+'.');
  }
  let free=0;
  for(let x=0;x<scene.width;x++)for(let y=0;y<scene.height;y++)if(walkable(x,y))free++;
  if(reached.size!==free)fail('isolated-floor','Esta distribución deja una parte de la casa sin acceso.');
  for(const actor of actors||[]){
    if(!accessible(actor))fail('actor-blocked','Un personaje quedaría atrapado. Muévelo antes de guardar.');
  }
  return {ok:errors.length===0,errors,code:codes[0]||null,codes,reachableCells:reached.size,walkableCells:free};
}

function validateLayout(baseScene,layout,state={},options={}) {
  try {const scene=compose(baseScene,layout,state),result=validate(scene,options);return {...result,scene};}
  catch(error){return {ok:false,errors:[error.message||'No se puede leer la distribución.'],code:error.code||'invalid-layout',scene:null};}
}

function apply(baseScene,state={}) {
  if(!baseScene || baseScene.id!=='home')return baseScene;
  if(state.homeLayout==null)return copy(baseScene);
  const result=validateLayout(baseScene,state.homeLayout,state);
  if(result.ok)return result.scene;
  // Preserve the saved layout for repair/export. The renderer gets a safe, explicit fallback.
  return {...copy(baseScene),layoutIssue:result.errors.join(' '),layoutValidation:{ok:false,errors:result.errors,code:result.code}};
}

window.HabitaHomeLayout={baseIds:[...BASE_IDS],fresh,defaults:fresh,normalize,compose,apply,validate,validateLayout};
})();
