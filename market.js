/* A reversible preview and a one-item, explicit local purchase. */
(() => {
'use strict';
let tab='all',busy=false;
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tabs=[['all','Todo'],['outfit','Ropa'],['furniture','Casa'],['inventory','Mis cosas']];
function style(){
  if(document.getElementById('habitaMarketStyle'))return;
  const el=document.createElement('style');el.id='habitaMarketStyle';el.textContent=`
    .marketHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-right:28px}.marketWallet{white-space:nowrap;padding:9px 12px;border-radius:18px;background:#f3e6bc;color:#765a2f;font-weight:700}.marketTabs{display:flex;gap:7px;flex-wrap:wrap;margin:18px 0}.marketTabs button{padding:9px 13px;min-height:40px;border:1px solid #cddbcc;border-radius:16px;background:#f9f7ed;color:#425e51;cursor:pointer}.marketTabs button[aria-pressed=true]{background:#dbeadb;border-color:#85a389;font-weight:700}.marketGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.marketItem{border:1px solid #dce3d5;background:#fffdf5;border-radius:20px;padding:12px;display:flex;flex-direction:column;gap:7px;min-width:0}.marketArt{width:100%;aspect-ratio:1.15;background:#edf2e7;border-radius:15px;display:grid;place-items:center;overflow:hidden}.marketArt svg{width:100%;height:100%;max-height:150px}.marketItem h3{font-size:15px;margin:0;line-height:1.25}.marketItem p{font-size:12px;line-height:1.4;margin:0}.marketItem .btn{margin-top:auto;min-height:42px;font-size:13px;width:100%;padding:9px 6px}.marketPrice{font-size:13px;font-weight:700;color:#786337}.marketOwned{font-size:12px;color:#517862}.marketPreview{width:100%;max-width:270px;margin:14px auto;border-radius:22px;overflow:hidden}.marketPreview canvas{display:block;width:100%;height:auto}.marketPreview svg{display:block;width:100%;height:auto}.marketLedger{padding:12px 0}.marketLedger ul{list-style:none;padding:0;margin:8px 0}.marketLedger li{display:flex;gap:12px;justify-content:space-between;border-bottom:1px solid #e2e8dc;padding:9px 0;font-size:12px}.marketLedger span:first-child{flex:1}.marketLedger strong{white-space:nowrap}.marketEmpty{padding:24px;text-align:center;background:#eef2e7;border-radius:18px}.marketPanel .footnote{line-height:1.6}.marketPanel .dialogButtons{display:flex;flex-wrap:wrap;gap:8px}.marketPanel .dialogButtons .btn{flex:1;min-width:120px}@media(max-width:360px){.marketGrid{gap:8px}.marketItem{padding:9px}.marketItem h3{font-size:14px}.marketHeader{align-items:flex-start;flex-direction:column}}
  `;document.head.appendChild(el);
}
function economy(){return window.HabitaEconomy?.ensure();}
function profile(){return typeof state!=='undefined'?state.profile:{};}
function furnitureSVG(item){
  const type=item.furniture?.type,color=item.furniture?.color||'#9daf97',bg='<rect x="3" y="3" width="114" height="100" rx="18" fill="#edf2e7"/><ellipse cx="62" cy="84" rx="38" ry="8" fill="#d4dfcf"/>',start='<svg viewBox="0 0 120 106" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
  const images={
    bed:'<rect x="22" y="48" width="77" height="36" rx="8" fill="#9ea8bc"/><rect x="23" y="30" width="12" height="55" rx="3" fill="#bb9b72"/><rect x="34" y="39" width="19" height="21" rx="6" fill="#f6ecd7"/><path d="M53 44h43v35H53z" fill="#b7c7b5"/>',
    desk:'<path d="M22 42h77v12H22z" fill="'+color+'"/><path d="M29 54v31m62-31v31" stroke="#826e5b" stroke-width="6"/><rect x="51" y="29" width="24" height="16" rx="3" fill="#8a9fb4"/><path d="M58 35h10" stroke="#e9efe5" stroke-width="2"/><rect x="33" y="39" width="12" height="4" fill="#eac5a0"/>',
    books:'<rect x="35" y="23" width="50" height="61" rx="4" fill="'+color+'"/><path d="M40 45h40m-40 20h40" stroke="#7d6854" stroke-width="4"/><path d="M43 27v15m8-15v15m10-14v14m10-13v13M43 49v13m10-12v12m12-12v12m10-14v14M45 70v10m12-10v10m12-10v10" stroke="#d9ad8d" stroke-width="5"/>',
    sofa:'<rect x="24" y="46" width="72" height="30" rx="10" fill="'+color+'"/><rect x="25" y="30" width="69" height="26" rx="8" fill="'+color+'"/><rect x="20" y="44" width="13" height="30" rx="5" fill="#7d9b92"/><rect x="87" y="44" width="13" height="30" rx="5" fill="#7d9b92"/><path d="M35 76v8m51-8v8" stroke="#9e8265" stroke-width="5"/>',
    table:'<path d="M22 47h76v12H22z" fill="'+color+'"/><path d="M30 59v25m58-25v25" stroke="#a68664" stroke-width="6"/><rect x="45" y="34" width="14" height="14" rx="3" fill="#eed5b8"/><path d="M60 38q12 4 0 8" fill="none" stroke="#d1b494" stroke-width="4"/><ellipse cx="79" cy="43" rx="10" ry="4" fill="#e3e9d4"/>',
    plant:'<path d="M46 66h31l-6 20H52z" fill="#c79472"/><path d="M62 66V32" stroke="#62856a" stroke-width="4"/><path d="M61 49Q24 52 37 26q23 0 24 23M62 42q35 5 24-20-21 0-24 20M62 60q30 2 29-20-25 0-29 20" fill="'+color+'"/>',
    easel:'<path d="M42 85l17-67 23 67M39 68h45" stroke="#ad825b" stroke-width="6" stroke-linecap="round"/><rect x="34" y="28" width="53" height="39" rx="3" fill="#f6e9d1" stroke="#c8ad82" stroke-width="3"/><path d="M38 57l14-17 13 14 12-8 5 14" fill="#91b19e"/><circle cx="73" cy="39" r="6" fill="#e4c17c"/>',
    basket:'<ellipse cx="62" cy="74" rx="31" ry="14" fill="#c8ad87"/><ellipse cx="62" cy="69" rx="25" ry="10" fill="#ede0c5"/><path d="M50 63l2-14 10 8 10-8 2 15" fill="#be9574"/><ellipse cx="63" cy="66" rx="15" ry="9" fill="#be9574"/><circle cx="59" cy="62" r="1.5" fill="#5a6355"/><circle cx="69" cy="62" r="1.5" fill="#5a6355"/>'
  };
  return start+bg+(images[type]||images.desk)+'</svg>';
}
function art(item){return item.kind==='outfit'?(window.Appearance?.itemSVG?.(item.id)||'<span aria-hidden="true">✦</span>'):furnitureSVG(item);}
function bind(){const panel=document.querySelector('.marketPanel');if(!panel)return;panel.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||!panel.contains(button))return;
  if(button.dataset.tab){open(button.dataset.tab);return;}
  const id=button.dataset.item;switch(button.dataset.action){case 'preview':preview(id);break;case 'buy':buy(id);break;case 'equip':equip(id);break;case 'place':place();break;case 'back':open(tab);break;}
});}
function open(next='all'){
  if(!window.HabitaCatalog||!window.HabitaEconomy)return;
  style();tab=tabs.some(([id])=>id===next)?next:'all';const wallet=economy();if(!wallet)return;
  const filtered=window.HabitaCatalog.items.filter(item=>tab==='inventory'?wallet.owned.includes(item.id):!item.starter&&(tab==='all'||item.kind===tab));
  const ledger=wallet.ledger.slice(-12).reverse().map(entry=>'<li><span>'+e(entry.label)+'</span><strong>'+ (entry.amount>0?'+':'')+entry.amount+' ◈</strong></li>').join('');
  modal('<section class="marketPanel"><div class="marketHeader"><div><div class="eyebrow">COSAS QUE CUENTAN TU HISTORIA</div><h2 style="margin:7px 0">El pequeño mercado</h2></div><div class="marketWallet" aria-label="Saldo '+wallet.balance+' monedas"><span aria-hidden="true">◈</span> <span data-wallet>'+wallet.balance+'</span></div></div><p>Elige un detalle para tu personaje o un nuevo rincón para tu casa.</p><nav class="marketTabs" aria-label="Categorías de la tienda">'+tabs.map(([id,label])=>'<button type="button" data-tab="'+id+'" aria-pressed="'+(tab===id)+'">'+label+'</button>').join('')+'</nav><div class="marketGrid">'+filtered.map(item=>{
    const owned=wallet.owned.includes(item.id);return '<article class="marketItem" data-item="'+item.id+'"><div class="marketArt">'+art(item)+'</div><h3>'+e(item.name)+'</h3><p>'+e(item.description)+'</p>'+(owned?'<span class="marketOwned">✓ En tu inventario</span>':'<span class="marketPrice">◈ '+item.price+' monedas</span>')+'<button type="button" class="btn secondary" data-action="preview" data-item="'+item.id+'">'+(owned?'Ver mi artículo':'Ver antes de comprar')+'</button>'+(owned?'<button type="button" class="btn" data-action="'+(item.kind==='outfit'?'equip':'place')+'" data-item="'+item.id+'">'+(item.kind==='outfit'?'Vestir este conjunto':'Organizar mi casa')+'</button>':'')+'</article>';
  }).join('')+'</div>'+(!filtered.length?'<p class="marketEmpty">Tus cosas aparecerán aquí cuando elijas algo.</p>':'')+'<details class="marketLedger"><summary>Mi monedero y cómo conseguir monedas</summary><p class="footnote">Son monedas ficticias, sin pagos ni deudas. Empiezas con '+window.HabitaCatalog.config.initialBalance+'. Un pequeño paso confirmado aporta '+window.HabitaCatalog.config.careReward+' (hasta '+window.HabitaCatalog.config.careDailyCap+' al día); un proyecto terminado, '+window.HabitaCatalog.config.projectReward+' (hasta '+window.HabitaCatalog.config.projectDailyCap+' al día); descubrir un rincón, '+window.HabitaCatalog.config.discoveryReward+' una vez. Tus objetos permanecen aunque no vuelvas por un tiempo. Cuidarte no exige comprar nada.</p>'+(ledger?'<ul aria-label="Últimos movimientos del monedero">'+ledger+'</ul>':'<p class="small">Todavía no hay movimientos.</p>')+'</details><button class="textbtn full" onclick="closeModal()">Volver a mi vida</button></section>');bind();
}
function preview(id){
  const item=window.HabitaCatalog?.get(id),wallet=economy();if(!item||!wallet)return;
  style();const owned=wallet.owned.includes(id),short=Math.max(0,item.price-wallet.balance);
  modal('<section class="marketPanel"><div class="eyebrow">'+(owned?'YA FORMA PARTE DE TU HISTORIA':'PRUÉBALO CON CALMA')+'</div><h2 style="margin-top:8px">'+e(item.name)+'</h2><div class="marketPreview">'+(item.kind==='outfit'?'<canvas id="marketAvatarPreview" width="270" height="225" aria-label="Vista previa de '+e(item.name)+'"></canvas>':furnitureSVG(item))+'</div><p>'+e(item.description)+'</p>'+(item.collection?'<p class="small">Colección '+e(item.collection)+' · ilustración original.</p>':'')+(owned?'<div class="notice">Este artículo ya está en tu inventario.</div>':'<div class="notice">Precio: <strong>'+item.price+' monedas</strong> · Saldo: '+wallet.balance+'<br>'+(short?'Te faltan '+short+' monedas. Puedes seguir cuidándote y volver cuando quieras.':'Después de comprar te quedarán '+(wallet.balance-item.price)+' monedas.')+'</div>')+'<div class="dialogButtons">'+(owned?'<button class="btn" data-action="'+(item.kind==='outfit'?'equip':'place')+'" data-item="'+id+'">'+(item.kind==='outfit'?'Vestir este conjunto':'Organizar mi casa')+'</button>':'<button class="btn" data-action="buy" data-item="'+id+'" '+(short?'disabled':'')+'>Comprar por '+item.price+' ◈</button>')+'<button class="btn secondary" data-action="back">'+(owned?'Volver al mercado':'Cancelar y volver')+'</button></div><p class="footnote">'+(item.kind==='outfit'?'La vista previa no cambia tu personaje.':'Al comprar, el mueble se guarda. Tú eliges dónde colocarlo.')+'</p></section>');
  if(item.kind==='outfit'){const p=profile(),candidate={...p,avatar:{...p.avatar,...item.appearance}};window.Appearance?.preview?.(document.getElementById('marketAvatarPreview'),candidate,'idle',{allowCostume:true});}bind();
}
function buy(id){
  if(busy)return {ok:false,reason:'busy'};busy=true;
  try{const outcome=window.HabitaEconomy.buy(id);if(outcome.ok||outcome.reason==='owned')purchaseReceipt(id,outcome);else preview(id);if(typeof toast==='function')toast(outcome.message);return outcome;}finally{busy=false;}
}
function purchaseReceipt(id,outcome){
  const panel=document.querySelector('.marketPanel'),button=panel&&Array.from(panel.querySelectorAll('[data-action="buy"]')).find(el=>el.dataset.item===id),item=window.HabitaCatalog.get(id);
  if(!button||!item){preview(id);return;}
  // Keep the original target in place: a double tap must land on this inert
  // confirmation rather than on a newly inserted equip/place action.
  button.disabled=true;button.removeAttribute('data-action');button.textContent='Compra lista ✓';
  const notice=panel.querySelector('.notice');
  if(notice){notice.style.minHeight=notice.getBoundingClientRect().height+'px';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.tabIndex=-1;notice.innerHTML='Guardado en <strong>Mis cosas</strong>.<br>Tu saldo ahora es '+outcome.balance+' monedas.';}
  const back=panel.querySelector('[data-action="back"]');if(back)back.textContent='Volver al mercado';
  const actions=document.createElement('div');actions.className='dialogButtons';actions.style.marginTop='12px';actions.innerHTML='<button type="button" class="btn secondary" data-action="'+(item.kind==='outfit'?'equip':'place')+'" data-item="'+e(id)+'">'+(item.kind==='outfit'?'Vestir este conjunto':'Organizar mi casa')+'</button>';
  button.closest('.dialogButtons').after(actions);
  notice?.focus({preventScroll:true});
}
function equip(id){const outcome=window.HabitaEconomy.equip(id);if(outcome.ok){if(typeof closeModal==='function')closeModal();if(typeof world!=='undefined')world?.react?.('wave',2);}if(typeof toast==='function')toast(outcome.message);return outcome;}
function place(){const editor=window.HomeEditor||window.RoomEditor;if(editor?.open)editor.open();else if(typeof toast==='function')toast('Tu mueble ya está guardado. Abre Organizar mi casa para colocarlo.');}
window.Market={open,preview,buy,equip};window.HabitaShop=window.Market;window.openShop=(next='all')=>open(next);
})();
