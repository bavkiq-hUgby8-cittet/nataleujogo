import {GAMES,createParty,startRound,nextRound,step,DT} from './engine.js';
import {ArcadeRenderer} from './render.js';
import {PartyNetwork,newOnlineRoom} from './network.js';
import {unlock,sound,mute} from '../audio.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let state=null,net=null,uid='local',selected='rua',playlist=GAMES.map(g=>g.id),lastKey='',rosterKey='',lastEvent=0,onlineRequested=false,soundOn=false,starting=false,shareUrl='';
const controls={x:0,y:0,a:0,b:0},keys=new Set(),held={a:false,b:false};let repeat=0;
const mainRender=new ArcadeRenderer($('game')),heroRender=new ArcadeRenderer($('preview'));
let preview=createParty({humans:[],seed:31});startRound(preview);preview.status='playing';preview.left=9999;
const descriptions={rua:'3 fases. Drones, supergolpes e amigos que se salvam.',lava:'O piso falha. Pule, escape e continue na disputa.',corrida:'Pegue impulso, salte e deixe a turma para trás.',lanche:'Pegue, corra, entregue. Uma cesta para cada equipe.'};
for(const g of GAMES){const card=document.createElement('button');card.className='card';card.dataset.game=g.id;card.setAttribute('aria-label','Jogar '+g.title);const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');const copy=document.createElement('div');copy.className='copy';const tag=document.createElement('span');tag.className='tag';tag.textContent=g.tag;const title=document.createElement('h3');title.textContent=g.title;const arrow=document.createElement('span');arrow.className='arrow';arrow.textContent='↗';title.append(arrow);const p=document.createElement('p');p.textContent=descriptions[g.id];copy.append(tag,title,p);card.append(canvas,copy);$('cards').append(card);const r=new ArcadeRenderer(canvas),s=createParty({humans:[]});startRound(s,g.id);s.status='lobby';if(g.id==='lava'){s.tiles[11].warning=1;s.tiles[28].hole=4;}r.draw(s,null,1);new ResizeObserver(()=>r.draw(s,null,1)).observe(canvas);card.onclick=()=>local(g.id,[g.id]);}
function audio(){if(!soundOn)return;try{unlock();}catch{}}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,7000);}
function fail(e){console.warn('Bora:',e.code||e.message);const msg=/permission|PERMISSION|convite/i.test(e.message)?'O convite não foi aceito. Peça ao anfitrião um novo link.':e.message||'Não foi possível conectar. Tente novamente.';$('join-note').textContent=msg;toast(msg);}
function setState(s){state=s;renderUI();}
function showPlay(){document.body.classList.add('playing');$('home').hidden=true;$('play').hidden=false;$('entry').close();mainRender.resize();audio();}
function local(game='rua',list=GAMES.map(g=>g.id)){if(net)return;selected=game;playlist=list;uid='local';controls.x=controls.y=controls.a=controls.b=0;lastKey='';state=createParty({humans:[{uid,name:localStorage.getItem('bora-name')||'Você'}],seed:Number(params.get('seed'))||17,quick:params.has('rapido')});state.playlist=list;startRound(state,game);$('connection').textContent='Você + máquina · local';showPlay();renderUI();}
function members(){if(!state)return;const key=state.players.map(p=>`${p.name}:${p.bot}:${p.cup}:${p.uid}`).join('|');if(key===rosterKey)return;rosterKey=key;$('roster').replaceChildren();for(const p of state.players){const span=document.createElement('span');span.className='person';span.style.setProperty('--c',p.color);const dot=document.createElement('i');const name=document.createElement('span');name.textContent=p.name+(p.uid===uid?' · você':'');const info=document.createElement('small');info.textContent=p.bot?'MÁQUINA':'JOGADOR';span.append(dot,name,info);$('roster').append(span);}}
function renderUI(){
  if(!state)return;const g=GAMES.find(g=>g.id===state.game),own=state.players.find(p=>p.uid===uid);
  $('game-title').textContent=g.title;$('game-tag').textContent=g.tag;$('timer').textContent=Math.ceil(state.left)+'s';$('round-label').textContent=`RODADA ${state.round+1} / ${state.playlist.length}`;
  $('mission').textContent=state.game==='rua'?`FASE ${state.wave} / 3`:state.game==='lanche'?`ROXO ${state.teams[0]} × ${state.teams[1]} LARANJA`:state.game==='corrida'?`${Math.min(100,Math.floor((own?.x||0)/28))}% DO PERCURSO`:'FIQUE NA ARENA';
  $('label-a').textContent=g.a;$('label-b').textContent=own?.cool>0?Math.ceil(own.cool)+'s':g.b;$('tip').textContent=g.tip;
  members();const key=[state.status,state.game,state.round,net?.isHost].join(':');
  $('overlay').hidden=state.status==='playing';
  if(state.status==='intro')$('count').textContent=Math.max(1,Math.ceil((state.quick?.3:3)-state.phaseTime));
  if(key!==lastKey){lastKey=key;$('results').hidden=true;$('count').hidden=true;$('advance').hidden=false;$('advance').disabled=false;$('overlay-tag').textContent=g.tag;
    if(state.status==='lobby'){$('overlay-title').textContent='A turma está pronta.';$('overlay-desc').textContent='Amigos podem entrar durante a partida. A máquina completa os lugares vazios.';$('advance').textContent=net&&!net.isHost?'Aguardando o anfitrião…':'Começar festa →';$('advance').disabled=!!net&&!net.isHost;}
    if(state.status==='intro'){$('overlay-title').textContent=g.title;$('overlay-desc').textContent=g.instruction;$('count').hidden=false;$('advance').hidden=true;$('status').textContent=g.instruction;}
    if(state.status==='playing'){$('status').textContent=own?(g.id==='lanche'?`Sua equipe: ${own.team?'laranja · cesta à direita':'roxa · cesta à esquerda'}`:g.tip):'A sala está cheia. Você está assistindo.';}
    if(state.status==='result'||state.status==='final'){
      const final=state.status==='final';$('overlay-title').textContent=final?'Isso é só o começo.':state.game==='rua'?(state.lost?'Bora tentar de novo?':'A cidade é nossa!'):'Rodada fechada!';
      $('overlay-desc').textContent=final?'Mais uma? Troque de jogo ou reúna a turma.':state.game==='rua'?(state.lost?'Os drones levaram essa. Juntos, vocês conseguem.':'Três fases, uma equipe. Todo mundo levou pontos!'):state.game==='lanche'?`Cestas: roxo ${state.teams[0]} × ${state.teams[1]} laranja.`:'Pontos da festa — vale a revanche.';
      $('results').replaceChildren();$('results').hidden=false;const result=state.results.at(-1);for(const p of [...state.players].sort((a,b)=>b.cup-a.cup)){const row=document.createElement('div');row.className='result-row';const name=document.createElement('span');name.textContent=p.name+(p.bot?' · CPU':'');const val=document.createElement('i');val.textContent=final?`${p.cup} pts`:`+${result?.points[p.id]||0} · ${p.cup} pts`;row.append(name,val);$('results').append(row);}
      $('advance').textContent=final?'Outra festa →':state.round<state.playlist.length-1?'Próximo minigame →':'Ver resultado →';$('advance').disabled=!!net&&!net.isHost;if(net&&!net.isHost)$('advance').textContent='Aguardando o anfitrião…';if(soundOn)sound('vitoria');
    }
  }
  if(state.event!==lastEvent){lastEvent=state.event;if(soundOn&&state.status==='playing')sound('encaixe');}
}
$('quick-play').onclick=()=>local();
$('online').onclick=()=>{onlineRequested=true;$('entry-title').textContent='Chama a turma.';$('entry-description').textContent='Quem organiza entra na conta uma vez. Os convidados usam só o link e o nome.';$('enter').textContent='Criar sala online ↗';$('account-link').hidden=false;$('entry').showModal();};
$('entry-form').onsubmit=async e=>{e.preventDefault();if(starting)return;starting=true;$('enter').disabled=true;$('join-note').textContent='Preparando a sala…';try{
  const name=$('name').value.trim()||'Amigo';localStorage.setItem('bora-name',name);
  let family=params.get('familia'),room=params.get('sala'),invite=params.get('convite');
  if(onlineRequested){const info=await newOnlineRoom();family=info.family;room=info.room;invite=info.invite;}
  const url=new URL('index.html',location.href);url.search=new URLSearchParams({familia:family,sala:room,convite:invite}).toString();shareUrl=url.href;
  net=new PartyNetwork({family,room,invite,name,onState:setState,onStatus:t=>{$('connection').textContent=t;renderUI();},onPeople:()=>{},onError:fail});await net.join();uid=net.uid;lastKey='';showPlay();$('join-note').textContent='';if(onlineRequested){history.replaceState({},'',shareUrl);openShare();}
}catch(e){if(net){await net.close();net=null;}fail(e);if(/painel/.test(e.message)){$('join-note').textContent='Entre na conta do anfitrião pelo botão abaixo e volte para criar a sala.';$('account-link').hidden=false;}}
finally{starting=false;$('enter').disabled=false;}};
$('advance').onclick=()=>{audio();if(!state)return;if(state.status==='lobby'||state.status==='final'){if(net)net.start('rua',GAMES.map(g=>g.id));else local();}else{if(net)net.next();else nextRound(state);}renderUI();};
function openShare(){if(!shareUrl){toast('Para convidar outros celulares, crie uma sala em “Chamar a turma”. A rodada atual é local com a máquina.');return;}$('invite-url').value=shareUrl;$('qr').replaceChildren();if(window.QRCode)new QRCode($('qr'),{text:shareUrl,width:160,height:160,colorDark:'#172124',colorLight:'#fff'});$('share').showModal();}
$('invite').onclick=openShare;
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(shareUrl);toast('Convite copiado!');}catch{$('invite-url').select();toast('Selecione e copie o link acima.');}};
$('whatsapp').onclick=async()=>{const text='Bora jogar? Entra na nossa festa de minigames: '+shareUrl;if(navigator.share){try{await navigator.share({title:'Bora! — Party Arcade',text,url:shareUrl});return;}catch(e){if(e.name==='AbortError')return;}}window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
$('sound').onclick=()=>{try{if(!soundOn){unlock();if($('sound').dataset.used)mute();soundOn=true;$('sound').dataset.used='1';sound('encaixe');}else{mute();soundOn=false;}$('sound').textContent=soundOn?'♫':'♪';$('sound').setAttribute('aria-label',soundOn?'Desativar som':'Ativar som');}catch{toast('O som não está disponível neste navegador.');}};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('play').requestFullscreen();}catch{toast('Vire o celular de lado para uma arena maior.');}};
async function leave(){keys.clear();held.a=held.b=false;controls.x=controls.y=0;if(net){await net.close();net=null;}state=null;lastKey=rosterKey='';$('play').hidden=true;$('home').hidden=false;document.body.classList.remove('playing');history.replaceState({},'',location.pathname);shareUrl='';heroRender.resize();}
$('leave').onclick=leave;
function press(k){if(!state||state.status!=='playing')return;controls[k]++;if(net){net.value[k]=controls[k];}audio();}
for(const k of ['a','b']){const el=$('action-'+k);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);held[k]=true;press(k);el.classList.add('pressed');});const up=()=>{held[k]=false;el.classList.remove('pressed');};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);el.addEventListener('click',e=>{if(e.detail===0)press(k);});}
let stickPointer=null;
function stickMove(e){const r=$('stick').getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,d=Math.max(34,Math.hypot(dx,dy));controls.x=Math.round(dx/d*100)/100;controls.y=Math.round(dy/d*100)/100;$('knob').style.transform=`translate(${controls.x*30}px,${controls.y*30}px)`;}
$('stick').onpointerdown=e=>{stickPointer=e.pointerId;$('stick').setPointerCapture(e.pointerId);stickMove(e);};$('stick').onpointermove=e=>{if(stickPointer===e.pointerId)stickMove(e);};const resetStick=()=>{stickPointer=null;controls.x=controls.y=0;$('knob').style.transform='';};$('stick').onpointerup=resetStick;$('stick').onpointercancel=resetStick;$('stick').onlostpointercapture=resetStick;
const codes=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'];
addEventListener('keydown',e=>{if(!state||document.querySelector('dialog[open]')||!codes.includes(e.code))return;e.preventDefault();keys.add(e.code);if(!e.repeat&&e.code==='Space'){held.a=true;press('a');}if(!e.repeat&&e.code.startsWith('Shift')){held.b=true;press('b');}});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')held.a=false;if(e.code.startsWith('Shift'))held.b=false;});
addEventListener('blur',()=>{keys.clear();held.a=held.b=false;resetStick();});
let then=performance.now(),acc=0,previewAcc=0;
function loop(now){const dt=Math.min((now-then)/1000,.1);then=now;
  if(!document.hidden){
    if(state){
      if(stickPointer===null){controls.x=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);controls.y=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);}
      repeat+=dt;if(repeat>.23){repeat=0;for(const k of ['a','b'])if(held[k])press(k);}
      if(net){controls.a=Math.max(controls.a,net.value.a);controls.b=Math.max(controls.b,net.value.b);Object.assign(net.value,controls);}else{acc+=dt;while(acc>=DT){step(state,{[uid]:controls},DT);acc-=DT;}renderUI();}
      mainRender.draw(state,uid,now/1000);
    }else{previewAcc+=dt;while(previewAcc>=DT){step(preview,{},DT);previewAcc-=DT;}if(preview.status!=='playing'){startRound(preview);preview.status='playing';preview.left=9999;}heroRender.draw(preview,null,now/1000);}
  }requestAnimationFrame(loop);
}requestAnimationFrame(loop);
if(params.has('sala')&&params.has('familia')&&params.has('convite')){onlineRequested=false;$('entry-description').textContent='Seu convite está pronto. Entre para jogar com a turma.';$('account-link').hidden=true;$('name').value=localStorage.getItem('bora-name')||'';$('entry').showModal();}
else if(params.has('criar'))$('online').click();
else if(params.has('demo'))local(GAMES.some(g=>g.id===params.get('game'))?params.get('game'):'rua');
// Read-only diagnostics for integration tests and performance inspection; no state mutators.
Object.defineProperty(window,'bora',{value:{get state(){return state},get uid(){return uid},get host(){return !!net?.isHost},get renderer(){return {frames:mainRender.frames}},get connected(){return net?.connected??true}}});
