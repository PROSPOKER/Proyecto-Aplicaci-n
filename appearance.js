/* Habita's original layered character illustrations. No simulation or purchases. */
(() => {
  'use strict';
  const OPTIONS = {
    silhouette: [['slim','Estrecha'],['regular','Media'],['broad','Amplia']],
    face: [['soft','Suave'],['round','Redondo'],['angular','Marcado']],
    eyes: [['dot','Pequeños'],['almond','Almendrados'],['wide','Abiertos']],
    brows: [['soft','Suaves'],['arched','Arqueadas'],['bold','Expresivas']],
    expression: [['warm','Sonrisa suave'],['calm','Serenidad'],['bright','Alegría']],
    hairStyle: [['short','Corto'],['bob','Media melena'],['curls','Rizado'],['long','Largo'],['braids','Trenzas'],['bald','Sin cabello'],['afro','Afro'],['pixie','Pixie'],['bun','Moño'],['locs','Locs'],['undercut','Rapado lateral']],
    outfit: [['casual','Cómodo'],['coastal','Costero'],['creative','Creativo'],['active','Activo']],
    top: [['tee','Camiseta'],['striped','Marinera'],['hoodie','Polerón'],['cardigan','Cárdigan'],['jacket','Chaqueta'],['blouse','Camisa']],
    bottom: [['trousers','Pantalón'],['shorts','Short'],['skirt','Falda'],['wide','Pantalón amplio']],
    shoes: [['sneakers','Zapatillas'],['boots','Botines'],['sandals','Sandalias']],
    accessory: [['none','Sin accesorio'],['glasses','Lentes'],['headphones','Audífonos'],['cap','Gorra'],['scarf','Pañuelo'],['earrings','Aros'],['beanie','Gorro tejido'],['flower','Flor']]
  };
  const DEFAULTS = {hairStyle:'short',outfit:'casual',accessory:'none',silhouette:'regular',face:'soft',eyes:'dot',brows:'soft',expression:'warm',top:'tee',bottom:'trousers',shoes:'sneakers',bottomColor:'#78889b',shoeColor:'#fff0d5',eyeColor:'#4d4244',costume:'none'};
  const PALETTES = {
    skin: ['#f6ddc8','#ebc5ab','#d69c76','#c38b65','#b87a51','#9c623f','#7d4d36','#5c392c','#e8b18f','#b17b67','#8b594a','#f0c7b2'],
    hair: ['#292832','#47362d','#724b35','#a77244','#d2ab6d','#ede0bb','#958f92','#e1b3bf','#8b93b1','#6d8f82','#ab654e','#dedbd5'],
    shirt: ['#5f8d83','#88b5ae','#81a8c9','#a6b3d6','#bf99c4','#d99baa','#dfb26f','#e9d99b','#96b476','#455d79','#a36b58','#f2eee0'],
    bottomColor: ['#78889b','#596b80','#404953','#8a8b72','#b09c87','#c0b7a7','#996e84','#6c8f84'],
    shoeColor: ['#fff0d5','#d5ddda','#4d5961','#ca9784','#a7bdda','#c5b3d7'],
    eyeColor: ['#4d4244','#795741','#57776b','#547d99','#665281']
  };
  const COSTUMES = ['costume-shark','costume-cappuccino','costume-croc-plane'];
  const color = (v,fallback) => /^#[a-f0-9]{6}$/i.test(v || '') ? v : fallback;
  const shade = (hex,amount) => { const n=parseInt(color(hex,'#789789').slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.min(255,Math.max(0,v+amount)).toString(16).padStart(2,'0')).join(''); };
  function normalizeAvatar(raw = {}) {
    const a = {...DEFAULTS};
    for (const [key,values] of Object.entries(OPTIONS)) if (values.some(v=>v[0]===raw[key])) a[key]=raw[key];
    for (const key of ['bottomColor','shoeColor','eyeColor']) a[key]=color(raw[key],DEFAULTS[key]);
    a.costume=COSTUMES.includes(raw.costume)?raw.costume:'none';
    if (!raw.top) a.top={casual:'tee',coastal:'striped',creative:'blouse',active:'hoodie'}[a.outfit];
    return a;
  }
  function validateAvatar(raw,fail=()=>{throw Error('Personaje no compatible');}) {
    if (!raw || typeof raw!=='object' || Array.isArray(raw)) return fail();
    for (const [key,values] of Object.entries(OPTIONS)) if(raw[key]!==undefined&&!values.some(v=>v[0]===raw[key]))return fail();
    for (const key of ['bottomColor','shoeColor','eyeColor']) if(raw[key]!==undefined&&!/^#[a-f0-9]{6}$/i.test(raw[key]))return fail();
    if(raw.costume!==undefined&&raw.costume!=='none'&&!COSTUMES.includes(raw.costume))return fail();
    return normalizeAvatar(raw);
  }
  function validateLooks(raw,fail=()=>{throw Error('Conjuntos no compatibles');}) {
    if(!Array.isArray(raw)||raw.length>6)return fail();
    return raw.map(look=>{
      if(!look||typeof look!=='object'||Array.isArray(look)||typeof look.name!=='string'||!look.name.trim()||look.name.length>32)return fail();
      const result={name:look.name,avatar:validateAvatar(look.avatar,fail)};
      for(const key of ['skin','hair','shirt']){if(!/^#[a-f0-9]{6}$/i.test(look[key]||''))return fail();result[key]=look[key];}
      return result;
    });
  }
  const rounded=(c,x,y,w,h,r,fill,stroke=null)=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.8;c.stroke();}};
  const ellipse=(c,x,y,rx,ry,fill)=>{c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);c.fillStyle=fill;c.fill();};
  const line=(c,x1,y1,x2,y2,stroke,width=1)=>{c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=stroke;c.lineWidth=width;c.lineCap='round';c.stroke();};
  const polygon=(c,points,fill,stroke=null)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.8;c.stroke();}};
  function costumeAllowed(id,allow=false) { return id!=='none'&&COSTUMES.includes(id)&&(allow||!!window.HabitaEconomy?.owns?.(id)); }
  function drawHair(c,a,hair,headTilt=0,back=false){
    const hs=a.hairStyle;if(hs==='bald')return;
    if(hs==='long'){rounded(c,-15,-55+headTilt,6,31,3,hair);rounded(c,9,-55+headTilt,6,31,3,hair);}
    if(hs==='braids')for(const side of [-1,1])for(let i=0;i<6;i++)ellipse(c,side*12+Math.sin(i*Math.PI)*1.5,-48+i*4+headTilt,2.8,2.2,hair);
    if(hs==='locs')for(const side of [-1,1])for(let strand=0;strand<3;strand++){line(c,side*(10+strand*2),-54+headTilt,side*(10+strand*2)+(strand-1),-28+strand*2+headTilt,shade(hair,strand*7),2);}
    if(hs==='afro'){ellipse(c,0,-58+headTilt,19,16,hair);for(let i=0;i<11;i++){const angle=i/11*Math.PI*2;ellipse(c,Math.cos(angle)*16,-58+Math.sin(angle)*13+headTilt,5,5,hair);}return;}
    if(hs==='bun')ellipse(c,0,-67+headTilt,8,7,hair);
    rounded(c,-13,-61+headTilt,26,10,hs==='pixie'?5:3,hair);
    if(hs==='curls'){for(let i=0;i<6;i++)ellipse(c,-11+i*4.5,-57+headTilt-Math.sin(i)*2,4.7,4.7,hair);ellipse(c,-12,-49+headTilt,4,5,hair);ellipse(c,12,-49+headTilt,4,5,hair);}
    else if(hs==='bob'){rounded(c,-14,-56+headTilt,5,19,2,hair);rounded(c,9,-56+headTilt,5,19,2,hair);rounded(c,-9,-57+headTilt,8,8,1,hair);}
    else if(hs==='undercut'){rounded(c,-12,-55+headTilt,3,8,1,shade(hair,28));polygon(c,[[-8,-61],[13,-61],[11,-52],[-8,-55]],hair);}
    else if(hs==='pixie')polygon(c,[[-13,-58],[13,-58],[4,-49],[-1,-53],[-10,-52]],hair);
    else{rounded(c,-13,-57+headTilt,4,13,2,hair);rounded(c,1,-54+headTilt,11,4,1,hair);}
    if(hs==='braids'){rounded(c,-14,-25+headTilt,4,3,1,'#c4a48d');rounded(c,10,-25+headTilt,4,3,1,'#c4a48d');}
    if(back){rounded(c,-12,-59+headTilt,24,23,4,hair);}
  }
  function drawFace(c,a,skin,t,anim,back,tilt){
    const width=a.face==='round'?26:a.face==='angular'?23:24,height=a.face==='round'?25:27,radius=a.face==='angular'?2:a.face==='round'?9:5;
    rounded(c,-width/2,-59+tilt,width,height,radius,skin,shade(skin,-18));ellipse(c,-width/2,-43+tilt,2.5,3.5,skin);ellipse(c,width/2,-43+tilt,2.5,3.5,skin);
    if(back)return;
    const blink=anim==='sleep'||t%5.4<.12,gaze=anim==='look'?-1:0,eye=a.eyeColor;
    for(const x of [-4,5]){if(blink)line(c,x-1,-44+tilt,x+1,-44+tilt,eye,.8);else if(a.eyes==='almond'){ellipse(c,x+gaze,-44+tilt,2.4,1.2,'#f5eadb');ellipse(c,x+gaze,-44+tilt,1,1.25,eye);}else if(a.eyes==='wide'){ellipse(c,x+gaze,-44+tilt,2.6,2.4,'#fff1de');ellipse(c,x+gaze,-44+tilt,1.3,1.8,eye);}else ellipse(c,x+gaze,-44+tilt,1.4,1.7,eye);}
    const brow=a.brows==='bold'?1.8:1.1;
    if(a.brows==='arched'){line(c,-7,-49+tilt,-4,-50+tilt,shade(eye,8),brow);line(c,-4,-50+tilt,-1,-49+tilt,shade(eye,8),brow);line(c,2,-49+tilt,5,-50+tilt,shade(eye,8),brow);line(c,5,-50+tilt,8,-49+tilt,shade(eye,8),brow);}else{line(c,-7,-49+tilt,-1,-49+tilt,shade(eye,12),brow);line(c,2,-49+tilt,8,-49+tilt,shade(eye,12),brow);}
    ellipse(c,-8,-39+tilt,2.3,1.1,'rgba(220,134,127,.32)');ellipse(c,9,-39+tilt,2.3,1.1,'rgba(220,134,127,.32)');
    if(a.expression==='calm')line(c,-1,-36+tilt,3,-36+tilt,'#966a61',1);
    else if(a.expression==='bright'){rounded(c,-2,-39+tilt,6,4,2,'#a77469');line(c,-1,-38+tilt,3,-38+tilt,'#f6eadd',1);}
    else{c.beginPath();c.arc(1,-40+tilt,2.3,.12,Math.PI-.12);c.strokeStyle='#987367';c.lineWidth=1;c.stroke();}
  }
  function accessories(c,a,shirt,back){
    const acc=a.accessory;
    if(acc==='scarf'){rounded(c,-9,-35,18,5,2,'#d5a590');rounded(c,3,-33,5,13,2,'#d5a590');}
    if(acc==='headphones'){c.beginPath();c.arc(0,-48,15,Math.PI,Math.PI*2);c.strokeStyle='#959dbb';c.lineWidth=3;c.stroke();rounded(c,-17,-49,5,10,2,'#aab0cf');rounded(c,12,-49,5,10,2,'#aab0cf');}
    if(acc==='cap'){rounded(c,-14,-63,28,8,3,shade(shirt,-5));rounded(c,-3,-57,21,3,1,shade(shirt,-20));}
    if(acc==='beanie'){rounded(c,-14,-66,28,11,6,shade(shirt,10));rounded(c,-14,-58,28,5,2,shade(shirt,-10));for(let i=-9;i<12;i+=5)line(c,i,-63,i,-60,shade(shirt,28),1);ellipse(c,0,-67,3,3,shade(shirt,24));}
    if(acc==='flower'){for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;ellipse(c,12+Math.cos(angle)*3,-56+Math.sin(angle)*3,2.4,2.4,'#e9b5bd');}ellipse(c,12,-56,2,2,'#f2db95');}
    if(back)return;
    if(acc==='glasses'){rounded(c,-9,-47,8,6,2,'rgba(244,243,210,.13)','#776473');rounded(c,2,-47,8,6,2,'rgba(244,243,210,.13)','#776473');line(c,-1,-45,2,-45,'#776473',1);}
    if(acc==='earrings'){ellipse(c,-13,-39,1.6,2.5,'#dfbb72');ellipse(c,13,-39,1.6,2.5,'#dfbb72');}
  }
  function drawCostume(c,id,width,t,phase,back,skin,sleeping=false){
    if(id==='costume-shark'){
      rounded(c,-width/2-3,-40,width+6,30,8,'#85b6c6','#679bac');ellipse(c,0,-25,width*.43,12,'#e0ece4');polygon(c,[[width/2+1,-35],[width/2+12,-23],[width/2,-23]],'#72a4b9');polygon(c,[[-width/2-1,-35],[-width/2-12,-23],[-width/2,-23]],'#72a4b9');
      rounded(c,-17,-65,34,32,10,'#91bed0','#679bac');polygon(c,[[0,-64],[4,-76],[10,-62]],'#72a4b9');
      if(!back){ellipse(c,0,-45,12,10,'#f3ecd8');rounded(c,-10,-48,20,9,4,skin);if(sleeping){line(c,-12,-55,-8,-55,'#4d5c63',1);line(c,8,-55,12,-55,'#4d5c63',1);}else{ellipse(c,-10,-55,2,2,'#4d5c63');ellipse(c,10,-55,2,2,'#4d5c63');}polygon(c,[[-8,-50],[-5,-47],[-2,-50]],'#fff7e7');polygon(c,[[2,-50],[5,-47],[8,-50]],'#fff7e7');}
      for(const x of [-width*.4-2,width*.1-1]){rounded(c,x,-5+(x<0?phase:-phase)*3,12,6,3,'#e8e9dc','#759fad');line(c,x+3,-2+(x<0?phase:-phase)*3,x+9,-2+(x<0?phase:-phase)*3,'#759fad',1);}
    }else if(id==='costume-cappuccino'){
      rounded(c,-width/2,-35,width,23,4,'#d7b6a2','#b28e7c');polygon(c,[[-width/2,-18],[width/2,-18],[width/2+9,-10],[-width/2-9,-10]],'#e6b6c1');for(let x=-width/2;x<=width/2;x+=5)line(c,x,-17,x*1.4,-11,'#d9a0b0',1);
      rounded(c,-17,-64,34,31,5,'#f2e3cf','#c7af96');ellipse(c,0,-63,17,4,'#b78664');ellipse(c,0,-63,12,2.6,'#e7c7a5');c.beginPath();c.arc(18,-49,7,-Math.PI/2,Math.PI/2);c.strokeStyle='#d8c2a8';c.lineWidth=4;c.stroke();
      if(!back){if(sleeping){line(c,-7,-47,-3,-47,'#765b51',1);line(c,3,-47,7,-47,'#765b51',1);}else{ellipse(c,-5,-47,1.4,1.8,'#765b51');ellipse(c,5,-47,1.4,1.8,'#765b51');}c.beginPath();c.arc(0,-42,3,.15,Math.PI-.15);c.strokeStyle='#9c7065';c.lineWidth=1;c.stroke();}
      for(const x of [-5,5]){c.beginPath();c.moveTo(x,-69);c.quadraticCurveTo(x-4+Math.sin(t)*2,-72,x,-77);c.strokeStyle='rgba(237,226,210,.7)';c.lineWidth=1.2;c.stroke();}
    }else if(id==='costume-croc-plane'){
      polygon(c,[[-width/2,-32],[-width/2-20,-17],[-width/2,-21]],'#adb497','#7f8e73');polygon(c,[[width/2,-32],[width/2+20,-17],[width/2,-21]],'#adb497','#7f8e73');rounded(c,-width/2,-39,width,29,5,'#a5b68e','#7f966c');ellipse(c,0,-25,width*.37,10,'#cad0ae');
      rounded(c,-15,-62,30,27,5,'#9bb68a','#7c9569');rounded(c,2,-48,23,12,4,'#a9bf96','#7c9569');ellipse(c,4,-60,5,4,'#a9bf96');ellipse(c,-8,-60,5,4,'#a9bf96');
      if(!back){if(sleeping){line(c,-10,-59,-6,-59,'#53694b',1);line(c,2,-59,6,-59,'#53694b',1);}else{ellipse(c,-8,-59,1.2,1.4,'#53694b');ellipse(c,4,-59,1.2,1.4,'#53694b');}ellipse(c,19,-43,1,1,'#758b66');line(c,5,-38,22,-38,'#788968',1);polygon(c,[[11,-38],[13,-35],[15,-38]],'#edf0d9');}
      for(let y=-29;y<-13;y+=5)rounded(c,-1,y,3,2,1,'#7f966c');rounded(c,-6,-35,12,4,1,'#d8bd83');
    }
  }
  function draw(w,x,y,anim='idle',npc=false,extras={}){
    const c=w.ctx,q=w.project(x,y),profile=w.state?.().profile||{},person=typeof npc==='object'?npc:null,isNPC=!!npc;
    const raw=isNPC?(person?.avatar||person?.appearance||{hairStyle:person?.id?.includes('visitor')?'bob':'short'}):(profile.avatar||{}),a=normalizeAvatar(raw);
    const skin=color(person?.skin||profile.skin,'#cf9b79'),hair=color(person?.hair||profile.hair,'#413942'),shirt=color(person?.shirt||profile.shirt,isNPC?'#d79c9b':'#82aba0');
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,t=reduced?0:w.time||0,walking=isNPC?!!person?.moving:!!w.moving,phase=walking&&!reduced?Math.sin(person?.turn??w.turn??t*8):0,width=a.silhouette==='broad'?26:a.silhouette==='slim'?19:22;
    const sit=['sit','read','eat','pet'].includes(anim)&&!walking,direction=person?.dir??w.player?.dir??1,back=Math.cos(direction)+Math.sin(direction)<-.15;
    const task=isNPC?person?.activeTask: w.activeTask,doing=task?.phase==='doing'&&!walking,gesture=!reduced?Math.sin(t*2)*3:0,allowedCostume=!isNPC&&costumeAllowed(a.costume,extras.allowCostume);
    c.save();c.translate(q.x,q.y);ellipse(c,0,2,Math.max(12,width*.6),4,'rgba(57,69,69,.16)');c.translate(0,-(walking?Math.abs(phase)*1.2:Math.sin(t*1.4)*.4)+(sit?5:0));if(Math.cos(direction)-Math.sin(direction)<-.2)c.scale(-1,1);
    if(anim==='sleep'&&!walking){c.translate(-20,-10);c.rotate(Math.PI/2);c.scale(.75,.75);a.expression='calm';}
    const stride=phase*3,legWidth=a.bottom==='wide'?9:7,legHeight=a.bottom==='shorts'?10:17;
    for(const [lx,ls] of [[-width*.4,stride],[width*.1,-stride]]){const knee=sit?-5:0;rounded(c,lx,-17+ls,legWidth,sit?12:17,2,skin);rounded(c,lx,-17+ls,legWidth,Math.min(legHeight,sit?12:17),2,a.bottomColor);const sh=a.shoes==='boots'?10:a.shoes==='sandals'?3:5;rounded(c,lx-2,-sh+ls+knee,legWidth+3,sh,2,a.shoeColor,shade(a.shoeColor,-30));if(a.shoes==='sandals')line(c,lx+1,-3+ls+knee,lx+4,-7+ls+knee,a.shoeColor,2);else if(a.shoes==='sneakers')line(c,lx+2,-3+ls+knee,lx+6,-3+ls+knee,shade(a.shoeColor,-30),1);}
    if(a.bottom==='skirt')polygon(c,[[-width*.4,-21],[width*.45,-21],[width*.62,-6],[-width*.6,-6]],a.bottomColor,shade(a.bottomColor,-18));
    if(a.top==='hoodie'){rounded(c,-width/2-2,-38,width+4,10,5,shade(shirt,-10));}
    rounded(c,-width/2,-35,width,22,3,shirt,shade(shirt,-18));
    if(a.top==='striped'){for(let i=0;i<3;i++)rounded(c,-width/2+1,-30+i*5,width-2,2,0,'#f1ecd7');}
    else if(a.top==='hoodie'){line(c,-4,-34,-4,-28,'#e9e3d2',1);line(c,4,-34,4,-28,'#e9e3d2',1);rounded(c,-6,-22,12,6,2,shade(shirt,-9));}
    else if(a.top==='jacket'||a.top==='cardigan'){rounded(c,-4,-33,8,20,1,'#f0e7d3');polygon(c,[[-width/2+2,-34],[-2,-29],[-width/2+3,-21]],shade(shirt,22));polygon(c,[[width/2-2,-34],[2,-29],[width/2-3,-21]],shade(shirt,22));if(a.top==='cardigan')for(let yy=-27;yy<-14;yy+=5)ellipse(c,3,yy,.9,.9,'#c3b8a0');else{rounded(c,-width/2+2,-22,5,4,1,shade(shirt,-13));rounded(c,width/2-7,-22,5,4,1,shade(shirt,-13));}}
    else if(a.top==='blouse'){polygon(c,[[-6,-35],[0,-30],[-4,-28]],'#eee9d6');polygon(c,[[6,-35],[0,-30],[4,-28]],'#eee9d6');for(let yy=-27;yy<-16;yy+=4)ellipse(c,0,yy,.6,.6,shade(shirt,-30));}
    else{line(c,-5,-34,0,-31,'#e6e3ca',1.7);line(c,0,-31,5,-34,'#e6e3ca',1.7);}
    let leftY=-16+phase*1.6,rightY=-16-phase*1.6,leftX=-width/2-3,rightX=width/2+3;
    if(['stretch','train','celebrate'].includes(anim)&&!walking){leftY=-45-gesture*.5;rightY=-45+gesture*.5;leftX-=3;rightX+=3;}else if(anim==='wave'&&!walking){rightY=-47+gesture;rightX+=4;}else if(['read','write','draw','eat'].includes(anim)&&!walking){leftY=-23;rightY=-25+gesture*.4;leftX=-8;rightX=10;}else if(['water','tidy','pet','interact','cook'].includes(anim)&&!walking){rightY=-21+gesture*.6;rightX+=4+gesture;}else if(anim==='look'&&!walking){rightY=-31;rightX+=3;}
    line(c,-width/2,-32,leftX,leftY,shade(shirt,-5),7);line(c,width/2,-32,rightX,rightY,shade(shirt,-5),7);ellipse(c,leftX,leftY,3.3,3.3,skin);ellipse(c,rightX,rightY,3.3,3.3,skin);
    const tilt=['draw','write'].includes(anim)?1.5:0;
    if(a.hairStyle==='afro'){drawHair(c,a,hair,tilt);drawFace(c,a,skin,t,anim,back,tilt);if(back)drawHair(c,a,hair,tilt,true);}else{drawFace(c,a,skin,t,anim,back,tilt);drawHair(c,a,hair,tilt,back);}
    accessories(c,a,shirt,back);if(allowedCostume)drawCostume(c,a.costume,width,t,phase,back,skin,anim==='sleep');
    if(extras.drawProp){if(doing)extras.drawProp(w,task.animation||anim,task.prop);else if(!walking&&['read','eat'].includes(anim))extras.drawProp(w,anim,anim==='read'?'book':'cup');}
    c.restore();return true;
  }
  function preview(canvas,profile,animation='idle',options={}){
    if(!canvas)return;const c=canvas.getContext('2d'),ww=canvas.width,hh=canvas.height;
    c.clearRect(0,0,ww,hh);const bg=c.createLinearGradient(0,0,0,hh);bg.addColorStop(0,'#e4eee3');bg.addColorStop(1,'#f7ecd7');c.fillStyle=bg;c.fillRect(0,0,ww,hh);
    c.save();c.translate(ww/2,hh*.84);const scale=Math.min(ww/100,hh/85);c.scale(scale,scale);
    draw({ctx:c,project:()=>({x:0,y:0}),state:()=>({profile}),time:options.time??1,turn:(options.time??1)*8,moving:animation==='walk',player:{dir:options.direction??1},activeTask:null},0,0,animation,false,{allowCostume:options.allowCostume,drawProp:(w,kind)=>{if(kind==='read'){rounded(c,-11,-24,21,13,2,'#e8d4b1','#b69d7e');line(c,0,-24,0,-11,'#b69d7e',1);line(c,3,-19,8,-19,'#c2ae90',1);}}});c.restore();
  }
  function itemSVG(id){
    const base='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" aria-hidden="true">';
    const end='</svg>',bg='<rect x="3" y="3" width="90" height="90" rx="22" fill="#edf1e4"/>';
    if(id==='costume-shark')return base+bg+'<path d="M42 22l6-14 8 15" fill="#70a7bc"/><rect x="29" y="19" width="38" height="37" rx="13" fill="#8ebdd0"/><ellipse cx="48" cy="43" rx="13" ry="10" fill="#f6efd9"/><circle cx="37" cy="31" r="2.5" fill="#4b6270"/><circle cx="59" cy="31" r="2.5" fill="#4b6270"/><rect x="32" y="50" width="32" height="27" rx="10" fill="#8ebdd0"/><path d="M32 52L18 67l14-3M64 52l14 15-14-3" fill="#71a8bf"/><ellipse cx="48" cy="63" rx="11" ry="12" fill="#dcece3"/><rect x="28" y="76" width="18" height="8" rx="4" fill="#f6ecd7" stroke="#7da9ba"/><rect x="51" y="76" width="18" height="8" rx="4" fill="#f6ecd7" stroke="#7da9ba"/>'+end;
    if(id==='costume-cappuccino')return base+bg+'<path d="M39 18q-7-5 0-11M52 18q-7-5 0-11" fill="none" stroke="#c8b8a1" stroke-width="2"/><rect x="28" y="23" width="39" height="32" rx="7" fill="#f3e4cd" stroke="#bea78e"/><ellipse cx="47.5" cy="24" rx="19.5" ry="5" fill="#b98b66"/><ellipse cx="47.5" cy="24" rx="13" ry="3" fill="#e9cba6"/><path d="M68 32q20 12 0 20" fill="none" stroke="#ccb494" stroke-width="6"/><circle cx="40" cy="40" r="2" fill="#84634f"/><circle cx="54" cy="40" r="2" fill="#84634f"/><path d="M43 45q5 5 10 0" fill="none" stroke="#a77868" stroke-width="1.5"/><rect x="36" y="55" width="24" height="13" rx="4" fill="#d4ad9a"/><path d="M36 64h24l13 11H23z" fill="#e9b6c2"/><path d="M41 75v8m14-8v8" stroke="#c995a8" stroke-width="5" stroke-linecap="round"/>'+end;
    if(id==='costume-croc-plane')return base+bg+'<path d="M34 52L9 73l27-7m26-14 25 21-27-7" fill="#aeb895" stroke="#84966e"/><rect x="32" y="42" width="33" height="37" rx="8" fill="#a0b587"/><rect x="27" y="20" width="42" height="34" rx="8" fill="#9bb787"/><rect x="46" y="36" width="35" height="16" rx="5" fill="#adc194"/><circle cx="36" cy="24" r="7" fill="#adc194"/><circle cx="58" cy="24" r="7" fill="#adc194"/><circle cx="36" cy="24" r="2" fill="#5b704b"/><circle cx="58" cy="24" r="2" fill="#5b704b"/><path d="M55 47h22" stroke="#748662" stroke-width="2"/><path d="M61 48l3 4 3-4" fill="#f0eed6"/><rect x="40" y="58" width="17" height="6" rx="2" fill="#dec799"/><rect x="30" y="78" width="17" height="7" rx="3" fill="#d4d8c0"/><rect x="53" y="78" width="17" height="7" rx="3" fill="#d4d8c0"/>'+end;
    return base+bg+'<path d="M33 25L19 39l11 13 7-5v29h24V47l7 5 11-13-14-14-9 6H42z" fill="#89aa9c" stroke="#5f8675" stroke-width="2"/><path d="M42 25q6 12 14 0" fill="none" stroke="#f7eedb" stroke-width="4"/>'+end;
  }
  window.Appearance={OPTIONS,DEFAULTS,PALETTES,COSTUMES,normalizeAvatar,validateAvatar,validateLooks,draw,preview,itemSVG};
  window.HabitaAppearance=window.Appearance;
})();
