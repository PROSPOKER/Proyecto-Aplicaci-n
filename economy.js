/* Habita's local, fictional economy. Transactions never create care records. */
(() => {
'use strict';
const BASE=['base-home-bed','base-home-desk','base-home-plant','base-home-books','base-home-sofa','base-home-table','base-home-cat'];
const task=(id,label,animation,prop,actions,minSeconds=8,maxSeconds=15)=>({id,label,animation,prop,actions,minSeconds,maxSeconds});
const items=[
  {id:'outfit-daily',kind:'outfit',name:'Un día a tu manera',price:0,description:'Tu conjunto cotidiano. Siempre disponible.',appearance:{outfit:'casual',top:'tee',bottom:'trousers',shoes:'sneakers',costume:'none'}},
  {id:'outfit-coastal',kind:'outfit',name:'Paseo junto al mar',price:35,description:'Rayas, shorts y sandalias para sentir la brisa.',appearance:{outfit:'coastal',top:'striped',bottom:'shorts',shoes:'sandals',costume:'none'}},
  {id:'outfit-creative',kind:'outfit',name:'Tarde de taller',price:40,description:'Una chaqueta suave y pantalones amplios para crear.',appearance:{outfit:'creative',top:'cardigan',bottom:'wide',shoes:'sneakers',costume:'none'}},
  {id:'outfit-active',kind:'outfit',name:'Paso ligero',price:35,description:'Polerón y zapatillas para los paseos del barrio.',appearance:{outfit:'active',top:'hoodie',bottom:'shorts',shoes:'sneakers',costume:'none'}},
  {id:'outfit-evening',kind:'outfit',name:'Encuentro al atardecer',price:45,description:'Blusa, falda y botas para un encuentro especial.',appearance:{outfit:'casual',top:'blouse',bottom:'skirt',shoes:'boots',costume:'none'}},
  {id:'costume-shark',kind:'outfit',name:'Tiburón con zapatillas',price:90,collection:'Italian brainrot',description:'Un tiburón amable con zapatillas enormes. Diseño original de Habita.',appearance:{costume:'costume-shark'}},
  {id:'costume-cappuccino',kind:'outfit',name:'Bailarina cappuccino',price:95,collection:'Italian brainrot',description:'Una taza que sale a bailar con su falda de espuma. Diseño original de Habita.',appearance:{costume:'costume-cappuccino'}},
  {id:'costume-croc-plane',kind:'outfit',name:'Cocodrilo avión',price:105,collection:'Italian brainrot',description:'Un cocodrilo con alas suaves para pasear por el barrio. Diseño original de Habita.',appearance:{costume:'costume-croc-plane'}},
  {id:'base-home-bed',kind:'furniture',name:'Mi cama',price:0,starter:true,description:'El descanso que ya forma parte de tu casa.',furniture:{type:'bed',w:2,d:2}},
  {id:'base-home-desk',kind:'furniture',name:'Mi escritorio',price:0,starter:true,description:'Tu lugar para anotar ideas.',furniture:{type:'desk',w:2,d:1}},
  {id:'base-home-plant',kind:'furniture',name:'Mi planta',price:0,starter:true,description:'Una pequeña compañía verde.',furniture:{type:'plant',w:1,d:1}},
  {id:'base-home-books',kind:'furniture',name:'Mis libros',price:0,starter:true,description:'Historias que ya te acompañan.',furniture:{type:'books',w:1,d:1}},
  {id:'base-home-sofa',kind:'furniture',name:'Mi sofá',price:0,starter:true,description:'Un rincón para detenerte.',furniture:{type:'sofa',w:2,d:1}},
  {id:'base-home-table',kind:'furniture',name:'Mi mesa',price:0,starter:true,description:'Una taza y un momento tranquilo.',furniture:{type:'table',w:2,d:1}},
  {id:'base-home-cat',kind:'furniture',name:'Rincón de mi gato',price:0,starter:true,description:'Su lugar favorito de la casa.',furniture:{type:'basket',w:1,d:1}},
  {id:'furniture-easel',kind:'furniture',name:'Caballete de taller',price:55,description:'Abre un rincón para avanzar en dibujos y proyectos.',furniture:{type:'easel',w:1,d:1,color:'#c79261',tasks:[task('draw-project','avanzar en su dibujo','draw','pencil',['hobby','idea','goal'])]}},
  {id:'furniture-library',kind:'furniture',name:'Biblioteca de mareas',price:60,description:'Un lugar para elegir páginas, leer y buscar inspiración.',furniture:{type:'books',w:1,d:1,color:'#b79670',tasks:[task('read-pages','elegir unas páginas','read','book',['learn','idea','rest'])]}},
  {id:'furniture-kitchen',kind:'furniture',name:'Mesa de cocina',price:70,description:'Prepara una receta, una taza o un encuentro.',furniture:{type:'table',w:2,d:1,color:'#d0a875',tasks:[task('meal-project','preparar su receta','cook','cup',['food','water','social']),task('make-tea','preparar una taza','eat','cup',['food','water','rest'])]}},
  {id:'furniture-sofa',kind:'furniture',name:'Sofá para compartir',price:75,description:'Un rincón amplio para leer y recibir a alguien.',furniture:{type:'sofa',w:2,d:1,color:'#8aa9a1',tasks:[task('sofa-social','preparar un encuentro tranquilo','sit','cup',['social','self','rest']),task('sofa-read','leer con calma','read','book',['learn','rest','sleep'])]}},
  {id:'furniture-monstera',kind:'furniture',name:'Monstera del jardín',price:45,description:'Cuida sus hojas y acompaña tu proyecto verde.',furniture:{type:'plant',w:1,d:1,color:'#67947b',tasks:[task('water-leaves','cuidar las hojas nuevas','water','water',['hobby','organize','water'])]}},
  {id:'furniture-arcade',kind:'furniture',name:'Mesa de proyectos',price:85,description:'Un escritorio alegre para escribir, diseñar e imaginar.',furniture:{type:'desk',w:2,d:1,color:'#ab9db8',tasks:[task('write-idea','desarrollar su proyecto','write','pencil',['idea','goal','prepare'])]}}
];
const CONFIG=Object.freeze({initialBalance:180,careReward:8,careDailyCap:3,projectReward:24,projectDailyCap:4,discoveryReward:6,maxBalance:1000000,maxLedger:200,maxRewarded:5000,maxDayCaps:120});
const byId=new Map(items.map(item=>[item.id,item]));
const get=id=>byId.get(id)||null;
function fresh(){return {version:1,balance:CONFIG.initialBalance,owned:[...BASE,'outfit-daily'],ledger:[],rewarded:[],dayCaps:{}};}
const obj=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const textValue=(value,max=180)=>typeof value==='string'&&value.length>0&&value.length<=max;
function invalid(){throw new Error('La economía guardada tiene un formato incompatible. Conserva tu copia anterior.');}
function validate(value){
  if(!obj(value)||value.version!==1||!Number.isInteger(value.balance)||value.balance<0||value.balance>CONFIG.maxBalance||!Array.isArray(value.owned)||value.owned.length>items.length||!Array.isArray(value.ledger)||value.ledger.length>CONFIG.maxLedger||!Array.isArray(value.rewarded)||value.rewarded.length>CONFIG.maxRewarded||!obj(value.dayCaps)||Object.keys(value.dayCaps).length>CONFIG.maxDayCaps)invalid();
  if(value.owned.some(id=>!textValue(id,100)||!get(id))||new Set(value.owned).size!==value.owned.length)invalid();
  if(value.rewarded.some(id=>!textValue(id,180))||new Set(value.rewarded).size!==value.rewarded.length)invalid();
  const ledger=value.ledger.map(entry=>{
    if(!obj(entry)||!textValue(entry.id)||!Number.isFinite(entry.at)||entry.at<0||!textValue(entry.day,50)||!['purchase','care','project','discovery'].includes(entry.kind)||!Number.isInteger(entry.amount)||Math.abs(entry.amount)>CONFIG.maxBalance||!textValue(entry.label,120)||entry.itemId!==undefined&&!get(entry.itemId))invalid();
    return {id:entry.id,at:entry.at,day:entry.day,kind:entry.kind,amount:entry.amount,label:entry.label,...(entry.itemId?{itemId:entry.itemId}:{})};
  });
  const dayCaps={};for(const [day,cap] of Object.entries(value.dayCaps)){
    if(!textValue(day,50)||!obj(cap)||!Number.isInteger(cap.care)||cap.care<0||cap.care>CONFIG.careDailyCap||!Number.isInteger(cap.project)||cap.project<0||cap.project>CONFIG.projectDailyCap)invalid();
    Object.defineProperty(dayCaps,day,{value:{care:cap.care,project:cap.project},enumerable:true,writable:true,configurable:true});
  }
  return {version:1,balance:value.balance,owned:[...value.owned],ledger,rewarded:[...value.rewarded],dayCaps};
}
function account(target){return target||(typeof run==='function'?run():null);}
function ensure(target){const current=account(target);if(!current)return null;if(current.economy==null)current.economy=fresh();return current.economy;}
function owns(id,target){return !!ensure(target)?.owned.includes(id);}
function today(){return typeof mode!=='undefined'&&mode==='demo'?'demo:'+String(account()?.day??0):typeof localDate==='function'?localDate():new Date().toISOString().slice(0,10);}
function persist(){if(typeof save==='function')save();}
function result(ok,reason,message,economy,extra={}){return {ok,reason,message,balance:economy?.balance??0,...extra};}
function ledger(economy,kind,amount,label,itemId){economy.ledger.push({id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),at:Date.now(),day:today(),kind,amount,label,...(itemId?{itemId}:{})});economy.ledger=economy.ledger.slice(-CONFIG.maxLedger);}
function buy(id){
  const economy=ensure(),item=get(id);if(!economy)return result(false,'unavailable','Abre tu partida para comprar.',economy);
  if(!item)return result(false,'unknown-item','Ese artículo no existe.',economy);
  if(economy.owned.includes(id))return result(false,'owned','Ya tienes este artículo.',economy,{item});
  if(economy.balance<item.price)return result(false,'insufficient','Te faltan '+(item.price-economy.balance)+' monedas. Puedes volver cuando quieras.',economy,{item});
  economy.balance-=item.price;economy.owned.push(id);ledger(economy,'purchase',-item.price,item.name,id);persist();return result(true,'purchased','Ya es tuyo: '+item.name+'.',economy,{item});
}
function equip(id){
  const economy=ensure(),item=get(id);if(!item||item.kind!=='outfit')return result(false,'invalid-outfit','Elige un conjunto de tu inventario.',economy);
  if(!economy?.owned.includes(id))return result(false,'unowned','Primero debes comprar este conjunto.',economy,{item});
  if(typeof state==='undefined'||!state.profile)return result(false,'unavailable','Tu personaje todavía no está disponible.',economy);
  state.profile.avatar={...state.profile.avatar,...item.appearance};persist();return result(true,'equipped','Llevas '+item.name+'.',economy,{item});
}
function reward(kind,id,amount,label){
  const economy=ensure();if(!economy||!textValue(id,150))return result(false,'invalid-reward','No se pudo identificar esta recompensa.',economy);
  const key=kind+':'+id;if(economy.rewarded.includes(key))return result(false,'already-rewarded','Esta recompensa ya quedó guardada.',economy,{amount:0});
  if(economy.rewarded.length>=CONFIG.maxRewarded)return result(false,'history-full','El historial de recompensas está completo. Tus objetos siguen guardados.',economy,{amount:0});
  const day=today(),cap=economy.dayCaps[day]||{care:0,project:0};
  if(kind==='care'&&cap.care>=CONFIG.careDailyCap||kind==='project'&&cap.project>=CONFIG.projectDailyCap)return result(false,'daily-cap','Las monedas de hoy ya están completas. Puedes seguir a tu ritmo.',economy,{amount:0});
  const credited=Math.min(amount,CONFIG.maxBalance-economy.balance);if(!credited)return result(false,'balance-cap','Tu monedero está completo.',economy,{amount:0});
  economy.balance+=credited;economy.rewarded.push(key);if(kind==='care'||kind==='project'){cap[kind]++;Object.defineProperty(economy.dayCaps,day,{value:cap,enumerable:true,writable:true,configurable:true});const days=Object.keys(economy.dayCaps);while(days.length>CONFIG.maxDayCaps)delete economy.dayCaps[days.shift()];}
  ledger(economy,kind,credited,label);persist();return result(true,'rewarded','+'+credited+' monedas · '+label,economy,{amount:credited});
}
function rewardCare(record){const valid=record&&typeof record==='object'&&record.status==='done'&&textValue(record.id,150)&&typeof record.action==='string'&&Object.hasOwn(ACTIONS,record.action)&&Number.isFinite(record.minutes)&&record.minutes>0&&run().records.some(r=>r.id===record.id&&r.status==='done'&&r.action===record.action);if(!valid)return result(false,'invalid-record','La actividad necesita una confirmación guardada.',ensure(),{amount:0});return reward('care',record.id,CONFIG.careReward,'Un paso en tu vida');}
function rewardProject(id){return reward('project',id,CONFIG.projectReward,'Un proyecto terminado');}
function rewardDiscovery(scene){const id=typeof scene==='string'?scene:scene?.id;if(!['home','coast','plaza'].includes(id))return result(false,'unknown-scene','Este lugar no entrega una recompensa de exploración.',ensure(),{amount:0});return reward('discovery',id,CONFIG.discoveryReward,({home:'Mi casa',coast:'Paseo costero',plaza:'Jardín de las flores'})[id]);}
window.HabitaCatalog={items,get,config:CONFIG};
window.HabitaEconomy={fresh,validate,ensure,owns,buy,equip,rewardCare,rewardProject,rewardDiscovery,config:CONFIG};
})();
