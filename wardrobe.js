/* An isolated wardrobe draft. Applying it is always an explicit user choice. */
(() => {
  'use strict';
  let draft=null,activeTab='face',direction=1,animation='idle',frame=null,openedAt=0;
  const TABS=[['face','Rostro'],['hair','Cabello'],['clothes','Ropa'],['extras','Extras']];
  const LABELS={silhouette:'Silueta',face:'Forma del rostro',eyes:'Ojos',brows:'Cejas',expression:'Expresión',hairStyle:'Peinado',outfit:'Conjunto base',top:'Prenda superior',bottom:'Prenda inferior',shoes:'Calzado',accessory:'Accesorio',skin:'Tono de piel',hair:'Color del cabello',shirt:'Color de la prenda',bottomColor:'Color de abajo',shoeColor:'Color del calzado',eyeColor:'Color de ojos'};
  const INTERESTS={reading:'Lectura',art:'Arte',nature:'Naturaleza',music:'Música',movement:'Movimiento',cooking:'Cocina',projects:'Proyectos'};
  const copy=value=>JSON.parse(JSON.stringify(value));
  const html=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const owns=id=>id==='none'||!!window.HabitaEconomy?.owns?.(id);
  const catalog=()=>Array.isArray(window.HabitaCatalog?.items)?window.HabitaCatalog.items:[];
  const selectedValue=key=>Object.hasOwn(draft.avatar,key)?draft.avatar[key]:draft[key];
  const fieldId=key=>['skin','hair','shirt'].includes(key)?key:'avatar-'+key;
  function select(key){return `<div><label for="avatar-${key}">${LABELS[key]}</label><select id="avatar-${key}" onchange="Wardrobe.set('${key}',this.value)">${Appearance.OPTIONS[key].map(([value,label])=>`<option value="${value}" ${draft.avatar[key]===value?'selected':''}>${label}</option>`).join('')}</select></div>`;}
  function swatches(key){const value=selectedValue(key),id=fieldId(key);return `<fieldset class="wardrobeSwatchGroup"><legend>${LABELS[key]}</legend><div class="wardrobeSwatches">${Appearance.PALETTES[key].map((tone,index)=>`<button type="button" style="--swatch:${tone}" data-wardrobe-color="${key}" data-color="${tone}" aria-label="${LABELS[key]}, opción ${index+1}" aria-pressed="${tone.toLowerCase()===value.toLowerCase()}" onclick="Wardrobe.set('${key}','${tone}')"><span aria-hidden="true"></span></button>`).join('')}<label class="wardrobeCustomColor" for="${id}"><span>Elegir otro</span><input type="color" id="${id}" aria-label="${LABELS[key]} personalizado" value="${value}" oninput="Wardrobe.set('${key}',this.value)"></label></div></fieldset>`;}
  function faceContent(){return `<div class="wardrobeGrid">${['silhouette','face','eyes','brows','expression'].map(select).join('')}</div>${swatches('skin')}${swatches('eyeColor')}`;}
  function hairContent(){return `<div class="wardrobeGrid">${select('hairStyle')}${select('accessory')}</div>${swatches('hair')}<p class="small">Puedes combinar libremente tu cabello, rostro y ropa. No necesitas elegir género.</p>`;}
  function clothesContent(){return `<div class="wardrobeGrid">${['outfit','top','bottom','shoes'].map(select).join('')}</div>${swatches('shirt')}${swatches('bottomColor')}${swatches('shoeColor')}<p class="small">El editor básico es gratuito. La tienda ofrece conjuntos especiales y trajes opcionales.</p>`;}
  function extraContent(){
    const purchased=catalog().filter(item=>item.kind==='outfit'&&owns(item.id));
    const costumeName=catalog().find(item=>item.id===draft.avatar.costume)?.name;
    return `${select('accessory')}<div class="wardrobePremium"><h3>Mi ropa especial</h3><p class="small">${costumeName?'En la vista previa: '+html(costumeName)+'.':'Tu apariencia cotidiana está en la vista previa.'}</p><button class="btn secondary" id="wardrobe-no-costume" onclick="Wardrobe.clearCostume()">Usar mi ropa cotidiana</button><div class="wardrobeCatalogGrid">${purchased.map(item=>`<button class="wardrobeCatalogCard" data-wardrobe-item="${html(item.id)}" onclick="Wardrobe.wear('${html(item.id)}')">${Appearance.itemSVG(item.id)}<span>${html(item.name)}</span><small>En tu inventario</small></button>`).join('')}</div>${!purchased.length?'<p class="small">Tus compras aparecerán aquí. Puedes probar cada traje en la tienda antes de comprarlo.</p>':''}<button class="textbtn" id="wardrobe-open-shop" onclick="Wardrobe.shop()">Ver la tienda</button><p class="small">Abrir la tienda descarta los cambios de esta vista previa.</p></div><div class="wardrobeLooks"><h3>Mis conjuntos</h3><p class="small">Guarda hasta seis combinaciones. Se conservarán al confirmar el personaje.</p><div class="wardrobeLookEntry"><label for="wardrobe-look-name">Nombre del conjunto</label><input id="wardrobe-look-name" maxlength="32" placeholder="Por ejemplo, paseo por la costa"><button class="btn secondary" id="wardrobe-save-look" onclick="Wardrobe.saveLook()">Preparar este conjunto</button></div>${draft.avatarLooks.map((look,index)=>`<div class="wardrobeLook"><button class="option" data-wardrobe-look="${index}" onclick="Wardrobe.loadLook(${index})"><span><strong>${html(look.name)}</strong><small>Mostrar en la vista previa</small></span></button><button class="icon" data-wardrobe-delete-look="${index}" aria-label="Quitar conjunto ${html(look.name)}" onclick="Wardrobe.deleteLook(${index})">×</button></div>`).join('')}</div><h3>Lo que disfruto</h3><p class="small">Tus gustos pueden inspirar sus proyectos; no cambian tu ropa.</p><div class="chips" id="profileInterests">${Object.entries(INTERESTS).map(([id,label])=>`<button data-interest="${id}" class="${draft.interests.includes(id)?'on':''}" aria-pressed="${draft.interests.includes(id)}" onclick="Wardrobe.interest('${id}',this)">${label}</button>`).join('')}</div>`;
  }
  function render(){
    if(!draft)return;
    const contents={face:faceContent,hair:hairContent,clothes:clothesContent,extras:extraContent};
    modal(`<div class="wardrobeHeader"><div class="eyebrow">TU IDENTIDAD · A TU MANERA</div><h2>Crea un personaje que se sienta tuyo.</h2><p class="small">Prueba todo con calma. Tu personaje cambia cuando tú lo confirmas.</p></div><div class="wardrobePreview"><canvas id="avatarPreview" width="320" height="220" aria-label="Vista previa de tu personaje"></canvas><div class="wardrobeControls"><button class="textbtn" id="wardrobe-rotate" onclick="Wardrobe.rotate()">${direction===1?'Ver de espaldas':'Ver de frente'}</button><select id="wardrobe-animation" aria-label="Probar movimiento" onchange="Wardrobe.pose(this.value)">${[['idle','En calma'],['walk','Caminar'],['wave','Saludar'],['read','Leer'],['sit','Sentarse']].map(([value,label])=>`<option value="${value}" ${animation===value?'selected':''}>${label}</option>`).join('')}</select></div></div><div class="wardrobeIdentity wardrobeGrid"><div><label for="name">Nombre o apodo</label><input id="name" maxlength="24" value="${html(draft.name)}" oninput="Wardrobe.identity('name',this.value)"></div><div><label for="catName">Nombre del gato</label><input id="catName" maxlength="24" value="${html(draft.cat)}" oninput="Wardrobe.identity('cat',this.value)"></div></div><div class="wardrobeTabs" role="tablist" aria-label="Personalizar personaje">${TABS.map(([id,label])=>`<button role="tab" tabindex="${activeTab===id?0:-1}" id="wardrobe-tab-${id}" data-wardrobe-tab="${id}" aria-selected="${activeTab===id}" aria-controls="wardrobe-fields" onkeydown="Wardrobe.key(event,'${id}')" onclick="Wardrobe.tab('${id}')">${label}</button>`).join('')}</div><section class="wardrobeFields" id="wardrobe-fields" role="tabpanel" aria-labelledby="wardrobe-tab-${activeTab}">${contents[activeTab]()}</section><div class="wardrobeNotice small" role="status" id="wardrobe-status">Los cambios de esta vista previa aún no están guardados.</div><div class="wardrobeFooter dialogButtons"><button class="btn" id="wardrobe-save" onclick="Wardrobe.save()">Guardar mi personaje</button><button class="btn secondary" id="wardrobe-cancel" onclick="Wardrobe.cancel()">Cancelar cambios</button></div>`);
    paint();startPreview();
  }
  function open(){
    const profile=state.profile;
    draft={name:profile.name,cat:profile.cat,skin:profile.skin,hair:profile.hair,shirt:profile.shirt,avatar:Appearance.normalizeAvatar(profile.avatar),avatarLooks:copy(profile.avatarLooks||[]),interests:copy(profile.interests||[])};
    if(!owns(draft.avatar.costume))draft.avatar.costume='none';
    activeTab='face';direction=1;animation='idle';openedAt=performance.now();render();
  }
  function paint(time=1){const canvas=document.querySelector('#avatarPreview');if(canvas&&draft)Appearance.preview(canvas,draft,animation,{direction,time});}
  function startPreview(){
    if(frame!==null)return;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduced)return;
    const next=now=>{if(!draft||!document.querySelector('#modal')?.open||!document.querySelector('#wardrobe-save')){frame=null;return;}if(animation==='walk'||animation==='wave')paint((now-openedAt)/1000);frame=requestAnimationFrame(next);};
    frame=requestAnimationFrame(next);
  }
  function set(key,value){
    if(!draft)return;
    if(['skin','hair','shirt'].includes(key)){if(!/^#[a-f0-9]{6}$/i.test(value))return;draft[key]=value;}
    else if(['bottomColor','shoeColor','eyeColor'].includes(key)){if(!/^#[a-f0-9]{6}$/i.test(value))return;draft.avatar[key]=value;}
    else if(Appearance.OPTIONS[key]?.some(([id])=>id===value)){draft.avatar[key]=value;if(key==='outfit'){draft.avatar.top={casual:'tee',coastal:'striped',creative:'blouse',active:'hoodie'}[value];const top=document.querySelector('#avatar-top');if(top)top.value=draft.avatar.top;}}
    else return;
    const field=document.querySelector('#'+fieldId(key));if(field)field.value=value;
    document.querySelectorAll(`[data-wardrobe-color="${key}"]`).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.color===value)));
    paint();
  }
  function identity(key,value){if(draft&&['name','cat'].includes(key))draft[key]=value.slice(0,24);}
  function interest(id,button){if(!draft||!Object.hasOwn(INTERESTS,id))return;const index=draft.interests.indexOf(id);if(index>=0)draft.interests.splice(index,1);else draft.interests.push(id);button?.classList.toggle('on',index<0);button?.setAttribute('aria-pressed',String(index<0));}
  function tab(id){if(!TABS.some(([value])=>value===id)||!draft)return;activeTab=id;render();}
  function key(event,id){const index=TABS.findIndex(([value])=>value===id);let next;if(event.key==='ArrowRight')next=(index+1)%TABS.length;else if(event.key==='ArrowLeft')next=(index+TABS.length-1)%TABS.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=TABS.length-1;else return;event.preventDefault();tab(TABS[next][0]);document.querySelector('#wardrobe-tab-'+TABS[next][0])?.focus();}
  function rotate(){if(!draft)return;direction=direction===1?-2.4:1;document.querySelector('#wardrobe-rotate').textContent=direction===1?'Ver de espaldas':'Ver de frente';paint();}
  function pose(value){if(['idle','walk','wave','read','sit'].includes(value)){animation=value;paint();startPreview();}}
  function wear(id){
    if(!draft)return;const item=catalog().find(candidate=>candidate.id===id&&candidate.kind==='outfit');
    if(!item||!owns(id)){toast('Compra primero este conjunto en la tienda.');return;}
    const appearance=item.appearance||{};draft.avatar=Appearance.normalizeAvatar({...draft.avatar,costume:'none',...appearance});
    for(const key of ['skin','hair','shirt'])if(/^#[a-f0-9]{6}$/i.test(appearance[key]||''))draft[key]=appearance[key];render();
  }
  function clearCostume(){if(draft){draft.avatar.costume='none';render();}}
  function saveLook(){
    if(!draft)return;const input=document.querySelector('#wardrobe-look-name'),name=(input?.value.trim()||'Conjunto '+(draft.avatarLooks.length+1)).slice(0,32),index=draft.avatarLooks.findIndex(look=>look.name===name);
    if(index<0&&draft.avatarLooks.length>=6){toast('Puedes guardar seis conjuntos. Quita uno para hacer espacio.');return;}
    const look={name,avatar:copy(draft.avatar),skin:draft.skin,hair:draft.hair,shirt:draft.shirt};if(index>=0)draft.avatarLooks[index]=look;else draft.avatarLooks.push(look);render();
    document.querySelector('#wardrobe-status').textContent='Conjunto preparado. Guarda tu personaje para conservarlo.';
  }
  function loadLook(index){if(!draft||!draft.avatarLooks[index])return;const look=draft.avatarLooks[index];draft.avatar=Appearance.normalizeAvatar(look.avatar);for(const key of ['skin','hair','shirt'])draft[key]=look[key];if(!owns(draft.avatar.costume)){draft.avatar.costume='none';toast('Ese traje pertenece al otro inventario. Mostramos la ropa cotidiana.');}render();}
  function deleteLook(index){if(draft&&Number.isInteger(index)&&index>=0&&index<draft.avatarLooks.length){draft.avatarLooks.splice(index,1);render();}}
  function stop(){if(frame!==null)cancelAnimationFrame(frame);frame=null;draft=null;}
  function cancel(){stop();closeModal();}
  function saveWardrobe(){
    if(!draft)return;const name=draft.name.trim(),cat=draft.cat.trim();if(!name||!cat){toast('Escribe un nombre para ti y tu gato.');return;}
    if(loadIssue){toast('Primero revisa el guardado anterior para poder conservar tus cambios.');return;}
    const avatar=Appearance.normalizeAvatar(draft.avatar);if(!owns(avatar.costume))avatar.costume='none';
    state.profile={...state.profile,name,cat,skin:draft.skin,hair:draft.hair,shirt:draft.shirt,avatar,avatarLooks:copy(draft.avatarLooks),interests:copy(draft.interests)};
    save();stop();closeModal();if(typeof page!=='undefined'&&page==='me')renderMe();world?.react('wave',3);toast('Tu personaje y tus conjuntos quedaron guardados.');
  }
  function shop(){stop();window.Market?.open?.();}
  window.Wardrobe={open,set,identity,interest,tab,key,rotate,pose,wear,clearCostume,saveLook,loadLook,deleteLook,save:saveWardrobe,cancel,shop,refresh:render,snapshot:()=>draft?copy(draft):null};
  window.openWardrobe=open;
})();
