/* A reversible home editor. Drafts never touch the saved room before confirmation. */
(() => {
'use strict';
const clone=value=>JSON.parse(JSON.stringify(value));
let draft=null,base=null,selected=null,history=[],pendingRotation=0,initialIssue='';
const editorState=()=>({...world.state(),homeLayout:draft,economy:run().economy});
function items(){
 const originals=HabitaHomeLayout.baseIds.map(id=>{const object=base.objects.find(o=>o.id===id);return {instanceId:id,itemId:'base-'+id,name:object?.name||id,type:object?.type||'table'};});
 const owned=(window.HabitaCatalog?.items||[]).filter(item=>item.kind==='furniture'&&!item.id.startsWith('base-')&&(run().economy?.owned||[]).includes(item.id));
 return [...originals,...owned.map(item=>({instanceId:'owned-'+item.id,itemId:item.id,name:item.name,type:item.furniture?.type||'table'}))];
}
const placement=()=>draft?.placements.find(p=>p.instanceId===selected)||null;
function actors(){return world.getZone()==='home'?[world.player,world.cat,...world.npcs]:[];}
function result(){return HabitaHomeLayout.validateLayout(base,draft,editorState(),{actors:actors()});}
function remember(){history.push(clone(draft));if(history.length>40)history.shift();initialIssue='';}
function open(){
 base=window.HabitaScenes.getBase('home',world.state());
 if(!base)return toast('No pudimos abrir tu casa. Vuelve a intentarlo.');
 initialIssue='';history=[];pendingRotation=0;
 try{draft=run().homeLayout?HabitaHomeLayout.normalize(clone(run().homeLayout)):HabitaHomeLayout.fresh(base);}catch(error){draft=HabitaHomeLayout.fresh(base);initialIssue='Tu distribución guardada necesita reparación. Conservamos sus datos hasta que decidas guardar una nueva.';}
 selected=items()[0]?.instanceId||null;
 modal(`<div class="eyebrow">MI CASA · DECORAR</div><h2 style="margin-top:8px">Un espacio que tiene vida.</h2><p class="small">Elige un mueble y toca una casilla para moverlo. Puedes girarlo o guardarlo en el inventario. Los cambios se aplican al guardar.</p><canvas id="housePreview" class="houseEditorPreview" width="640" height="360" aria-label="Vista previa de la distribución de tu casa"></canvas><div id="houseValidation" class="houseValidation" role="status" aria-live="polite"></div><label>Muebles que tengo</label><div id="houseInventory" class="houseInventory"></div><p id="houseSelection" class="small"></p><div id="houseGrid" class="houseGrid" role="group" aria-label="Distribución de la casa: diez columnas y nueve filas" style="display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:2px"></div><div class="houseCoordinates grid2" style="margin-top:12px"><div><label for="houseX">Columna</label><input id="houseX" type="number" min="1" max="10" inputmode="numeric"></div><div><label for="houseY">Fila</label><input id="houseY" type="number" min="1" max="9" inputmode="numeric"></div></div><div class="dialogButtons"><button class="btn secondary" data-house-action="move" onclick="RoomEditor.moveFromFields()">Mover aquí</button><button class="btn secondary" data-house-action="rotate" onclick="RoomEditor.rotate()">Girar 90°</button><button class="btn secondary" data-house-action="store" onclick="RoomEditor.store()">Guardar en inventario</button><button class="btn secondary" data-house-action="undo" onclick="RoomEditor.undo()">Deshacer</button></div><div class="dialogButtons"><button class="btn" data-house-action="save" onclick="RoomEditor.save()">Guardar mi casa</button><button class="btn secondary" data-house-action="cancel" onclick="RoomEditor.cancel()">Cancelar cambios</button></div><button class="textbtn full" data-house-action="reset" onclick="RoomEditor.reset()">Recuperar la distribución original</button><p class="small">Los muebles nuevos se consiguen en la tienda. Tu foto de referencia y tus actividades se conservan.</p>`);
 render();
}
function render(){
 if(!draft||!$('#houseInventory'))return;
 const all=items(),current=placement(),check=result();
 $('#houseInventory').innerHTML=all.map(item=>`<button data-house-item="${esc(item.instanceId)}" class="${selected===item.instanceId?'on':''}" aria-pressed="${selected===item.instanceId}" onclick="RoomEditor.select('${esc(item.instanceId)}')"><strong>${esc(item.name)}</strong><small>${draft.placements.some(p=>p.instanceId===item.instanceId)?'En mi casa':'En inventario'}</small></button>`).join('');
 const item=all.find(item=>item.instanceId===selected),rotation=current?.rotation??pendingRotation;
 $('#houseSelection').textContent=(item?.name||'Selecciona un mueble')+' · '+(current?'columna '+(current.x+1)+', fila '+(current.y+1):'toca una casilla para colocarlo')+' · '+(rotation*90)+'°';
 $('#houseX').value=current?current.x+1:1;$('#houseY').value=current?current.y+1:1;
 const scene=check.scene||base,cells=[];
 for(let y=0;y<base.height;y++)for(let x=0;x<base.width;x++){
  const object=scene.objects.find(o=>o.solid&&x>=o.x&&x<o.x+o.w&&y>=o.y&&y<o.y+o.d),isSelected=object?.id===selected;
  const atSpawn=Math.floor(base.spawn.x)===x&&Math.floor(base.spawn.y)===y,atPortal=base.portals.some(p=>Math.floor(p.x)===x&&Math.floor(p.y)===y);
  const label='Columna '+(x+1)+', fila '+(y+1)+(object?'. '+object.name:atPortal?'. Salida':atSpawn?'. Entrada':'');
  cells.push(`<button class="houseCell${object?' occupied':''}${isSelected?' selected':''}${!check.ok&&object?' invalid':''}${atSpawn?' spawn':''}${atPortal?' portal':''}" data-house-cell="${x},${y}" aria-label="${esc(label)}" onclick="RoomEditor.move(${x},${y})">${object?esc(object.name.slice(0,2)):atPortal?'↗':atSpawn?'⌂':'·'}</button>`);
 }
 $('#houseGrid').innerHTML=cells.join('');
 const message=initialIssue||(check.ok?'Hay caminos libres y todos los muebles se pueden utilizar.':check.errors[0]);
 $('#houseValidation').textContent=message;$('#houseValidation').classList.toggle('invalid',!check.ok||!!initialIssue);
 $('[data-house-action="save"]').disabled=!check.ok;
 $('[data-house-action="undo"]').disabled=!history.length;
 $('[data-house-action="store"]').disabled=!current;
 preview(check.scene||base);
}
function preview(scene){
 const canvas=$('#housePreview');if(!canvas||!world)return;
 const view=Object.create(world);view.canvas=canvas;view.ctx=canvas.getContext('2d',{alpha:false});view.w=canvas.width;view.h=canvas.height;view.dpr=1;view.zone='home';view.scene=scene;view.state=()=>editorState();
 view.player={...(world.getZone()==='home'?world.player:base.spawn)};view.cat={x:base.spawn.x-.8,y:base.spawn.y+.7};view.npcs=[];view.activeTask=null;view.path=[];view.particles=[];view.anim='idle';view.moving=false;view.marker=null;
 view.camera=view.project(base.camera.x,base.camera.y);view.zoomLevel=Math.min((view.w-36)/((base.width+base.height)*view.tw/2),(view.h-70)/((base.width+base.height)*view.th/2+80));view.anchorY=()=>view.h*.40;
 view.render();
}
function select(id){if(!items().some(item=>item.instanceId===id))return;selected=id;pendingRotation=0;render();}
function move(x,y){
 if(!draft||!Number.isInteger(x)||!Number.isInteger(y))return;
 const item=items().find(item=>item.instanceId===selected);if(!item)return;
 const current=placement();if(current&&current.x===x&&current.y===y)return;
 remember();if(current){current.x=x;current.y=y;}else draft.placements.push({instanceId:item.instanceId,itemId:item.itemId,x,y,rotation:pendingRotation});render();
}
function moveFromFields(){move(Number($('#houseX').value)-1,Number($('#houseY').value)-1);}
function rotate(){const current=placement();if(current){remember();current.rotation=(current.rotation+1)%4;}else pendingRotation=(pendingRotation+1)%4;render();}
function store(){if(!placement())return;remember();draft.placements=draft.placements.filter(p=>p.instanceId!==selected);pendingRotation=0;render();}
function undo(){if(!history.length)return;draft=history.pop();initialIssue='';render();}
function reset(){remember();draft=HabitaHomeLayout.fresh(base);render();}
function cancel(){draft=null;history=[];closeModal();}
function commit(){
 if(!draft)return;const check=result();if(!check.ok){render();return toast(check.errors[0]);}
 const next=clone(draft);next.revision=(run().homeLayout?.revision||0)+1;run().homeLayout=next;
 save();draft=null;history=[];if(world.getZone()==='home'){world.refreshScene();world.recenter();}closeModal();head();updateContext();toast('Tu casa está lista. Sus muebles abren nuevas posibilidades.');
}
window.RoomEditor={open,select,move,moveFromFields,rotate,store,undo,reset,cancel,save:commit,snapshot:()=>draft?{draft:clone(draft),selected,history:history.length,validation:result()}:null};
})();
