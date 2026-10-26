// Pure fixed-step simulation. Rendering and Firebase are deliberately outside this module.
export const W = 960, H = 600, DT = 1 / 30;
export const GAMES = [
  {id:'rua', title:'Neon Rush', tag:'TODO MUNDO JUNTO', kind:'coop', color:'#ffb3aa', icon:'★', seconds:75, instruction:'Derrotem os drones da cidade. Ninguém fica para trás!', a:'Bater', b:'Super / salvar', tip:'Chegue perto e bata. O super também levanta um amigo caído.'},
  {id:'lava', title:'Glitch', tag:'CADA UM POR SI', kind:'versus', color:'#c7b9ff', icon:'◆', seconds:35, instruction:'O chão pisca? Saia daí! Pule para atravessar os buracos.', a:'Pular', b:'Disparar', tip:'As placas laranja vão cair. Se cair, você volta em dois segundos.'},
  {id:'corrida', title:'Turbo Loop', tag:'CADA UM POR SI', kind:'versus', color:'#bceacb', icon:'➜', seconds:35, instruction:'Desvie das barreiras e chegue primeiro ao arco!', a:'Pular', b:'Turbo', tip:'Você corre sozinho. Mova para cima e para baixo; pule as barreiras.'},
  {id:'lanche', title:'Snack Clash', tag:'EQUIPE × EQUIPE', kind:'teams', color:'#ffe09a', icon:'●', seconds:45, instruction:'Pegue os lanches no parque e leve para a cesta da sua equipe.', a:'Pegar / entregar', b:'Disparar', tip:'Roxo entrega à esquerda. Laranja entrega à direita. Aperte A perto da cesta.'},
];
export const COLORS = ['#7960e8','#ff8958','#50bcb0','#e1ad32','#d465a2','#6497e6'];
const names=['Nova','Bolt','Zig','Luna','Echo','Pixel'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function random(s) {s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function createParty({seed=17,humans=[{uid:'local',name:'Você'}],quick=false}={}) {
  const s={v:2,app:'bora',seed:seed>>>0,quick,revision:0,status:'lobby',game:'rua',round:0,playlist:GAMES.map(g=>g.id),t:0,left:0,phaseTime:0,wave:1,players:[],enemies:[],tiles:[],items:[],effects:[],teams:[0,0],results:[],event:0};
  for(let i=0;i<Math.max(4,Math.min(6,humans.length));i++) s.players.push(actor(i));
  reconcile(s,humans);return s;
}
function actor(i) {return {id:i,uid:null,name:names[i],bot:true,color:COLORS[i],team:i%2,x:150+i*100,y:300,face:1,hp:5,score:0,cup:0,down:0,jump:0,attack:0,cool:0,boost:0,inv:0,carry:false,a:0,b:0,slow:0,think:0,finish:0};}
export function reconcile(s, humans) {
  const active=humans.slice(0,6), ids=new Set(active.map(h=>h.uid));
  for(const p of s.players) if(p.uid&&!ids.has(p.uid)){p.uid=null;p.bot=true;p.name=names[p.id];p.a=0;p.b=0;}
  for(const h of active) {
    let p=s.players.find(p=>p.uid===h.uid);
    if(!p){p=s.players.find(p=>p.bot);if(!p&&s.players.length<6){p=actor(s.players.length);s.players.push(p);}if(p){p.uid=h.uid;p.bot=false;p.a=0;p.b=0;}}
    if(p)p.name=String(h.name||'Amigo').slice(0,30);
  }
  return s;
}
export function startRound(s, game=s.playlist[s.round]||'rua') {
  if(!GAMES.some(g=>g.id===game))return false;
  s.game=game;s.status='intro';s.phaseTime=0;s.t=0;s.left=s.quick?9:GAMES.find(g=>g.id===game).seconds;
  s.enemies=[];s.items=[];s.tiles=[];s.effects=[];s.teams=[0,0];s.wave=1;s.lost=false;s.allDown=0;
  for(const p of s.players)Object.assign(p,{x:game==='corrida'?60:game==='lanche'?(p.team?820:140):220+p.id*100,y:150+(p.id%3)*140,hp:5,score:0,down:0,jump:0,attack:0,cool:0,boost:0,inv:0,carry:false,slow:0,think:0,finish:0});
  if(game==='rua')spawnWave(s);
  if(game==='lava')for(let i=0;i<40;i++)s.tiles.push({id:i,warning:0,hole:0});
  if(game==='lanche')for(let i=0;i<10;i++)s.items.push({id:i,x:320+random(s)*320,y:120+random(s)*360,wait:0});
  s.revision++;return true;
}
function spawnWave(s){for(let i=0;i<(s.quick?2:2+s.wave);i++)s.enemies.push({id:s.wave*10+i,x:i%2?820:100,y:130+random(s)*350,hp:s.quick?1:(s.wave===3&&i===0?24:5+s.wave*2),boss:s.wave===3&&i===0,hit:0,cool:0});}
export function nextRound(s){if(s.status!=='result')return false;if(s.round>=s.playlist.length-1){s.status='final';return true;}s.round++;return startRound(s);}
export function input(value){return {x:clamp(Number(value?.x)||0,-1,1),y:clamp(Number(value?.y)||0,-1,1),a:clamp(Math.floor(Number(value?.a)||0),0,10000000),b:clamp(Math.floor(Number(value?.b)||0),0,10000000)};}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function aim(p,t){const d=Math.max(1,dist(p,t));return {x:(t.x-p.x)/d,y:(t.y-p.y)/d,a:0,b:0};}
function bot(s,p){
  let u={x:0,y:0,a:p.a,b:p.b};
  if(s.game==='rua'){
    const friend=s.players.find(q=>q.down>0&&dist(p,q)<120),target=s.enemies.filter(e=>e.hp>0).sort((a,b)=>dist(a,p)-dist(b,p))[0];
    if(target){u=aim(p,target);if(dist(p,target)<95)u.a=p.a+1;if((dist(p,target)<130||friend)&&p.cool<=0)u.b=p.b+1;}
  }else if(s.game==='lava'){
    const tile=tileAt(p),bad=s.tiles[tile]?.hole>0||s.tiles[tile]?.warning>0;
    const target=s.tiles.filter(t=>!t.hole&&!t.warning).map(t=>({x:80+(t.id%8)*100+50,y:100+Math.floor(t.id/8)*80+40})).sort((a,b)=>dist(a,p)-dist(b,p))[bad?0:Math.min(p.id,3)];
    if(target&&dist(p,target)>12)u=aim(p,target);if(bad&&p.jump<=0)u.a=p.a+1;
  }else if(s.game==='corrida'){
    u.y=Math.sin(s.t*.7+p.id)*.35;
    const near=obstacles().some(o=>o.x-p.x>0&&o.x-p.x<100&&Math.abs(o.y-p.y)<65);
    if(near&&p.jump<=0)u.a=p.a+1;if(p.cool<=0)u.b=p.b+1;
  }else{
    const target=p.carry?{x:p.team?860:100,y:300}:s.items.filter(i=>i.wait<=0).sort((a,b)=>dist(a,p)-dist(b,p))[0];
    if(target){u=aim(p,target);if(dist(p,target)<60)u.a=p.a+1;if(dist(p,target)>210&&p.cool<=0)u.b=p.b+1;}
  }
  u.a=Math.max(p.a,u.a);u.b=Math.max(p.b,u.b);if(s.game==='rua'){if(p.think>0){u.a=p.a;u.b=p.b;}else if(u.a>p.a||u.b>p.b)p.think=.65+p.id*.06;}return u;
}
export function obstacles(){const out=[];for(let i=0;i<12;i++)out.push({x:380+i*190,y:120+(i%4)*115});return out;}
function tileAt(p){return Math.floor((p.x-80)/100)+Math.floor((p.y-100)/80)*8;}
function effect(s,x,y,text,color='#fff'){s.effects.push({x,y,text,color,life:.7});s.effects=s.effects.slice(-16);s.event++;}
function actions(s,p,u){
  if(u.a>p.a){p.a=u.a;
    if(s.game==='rua'&&p.attack<=0){p.attack=.38;for(const e of s.enemies)if(e.hp>0&&dist(e,p)<100){e.hp--;e.hit=.18;e.x=clamp(e.x+p.face*22,60,900);if(e.hp<=0){p.score++;effect(s,e.x,e.y,'POW!');}}}
    else if((s.game==='lava'||s.game==='corrida')&&p.jump<=0)p.jump=.8;
    else if(s.game==='lanche'&&p.attack<=0){p.attack=.2;if(p.carry&&dist(p,{x:p.team?860:100,y:300})<100){p.carry=false;s.teams[p.team]++;p.score++;effect(s,p.x,p.y,'+1','#ffe184');}else if(!p.carry){const item=s.items.find(i=>i.wait<=0&&dist(i,p)<65);if(item){item.wait=5;p.carry=true;}}}
  }
  if(u.b>p.b){p.b=u.b;if(p.cool<=0){p.cool=p.bot?7:4;
    if(s.game==='rua'){p.attack=.45;for(const e of s.enemies)if(e.hp>0&&dist(e,p)<165){e.hp-=2;e.hit=.3;}for(const q of s.players)if(q.down>0&&dist(q,p)<130){q.down=0;q.hp=3;q.inv=2;}effect(s,p.x,p.y,'SUPER!','#ffe184');}
    else p.boost=.65;
  }}
}
export function step(s, controls={}, dt=DT){
  if(s.status==='intro'){s.phaseTime+=dt;if(s.phaseTime>=(s.quick?.3:3)){s.status='playing';s.phaseTime=0;}return s;}
  if(s.status!=='playing')return s;
  dt=clamp(dt,0,.05);s.t+=dt;s.left=Math.max(0,s.left-dt);s.revision++;
  for(const e of s.effects){e.life-=dt;e.y-=dt*25;}s.effects=s.effects.filter(e=>e.life>0);
  for(const p of s.players){
    for(const k of ['jump','attack','cool','boost','inv','slow','think'])p[k]=Math.max(0,p[k]-dt);
    if(p.down>0){p.down-=dt;if(p.down<=0){p.hp=3;p.inv=2;p.x=s.game==='lava'?480:p.x;p.y=300;}continue;}
    let u=p.bot?bot(s,p):input(controls[p.uid]);
    // A press is an edge counter, never a score or coordinate supplied by a client.
    actions(s,p,u);
    if(u.x)p.face=u.x>0?1:-1;
    const len=Math.max(1,Math.hypot(u.x,u.y)),speed=(p.boost>0?350:185)*(p.slow>0?.3:1);
    if(s.game==='corrida'){p.x+=(p.boost>0?250:135)*(p.slow>0?.3:1)*dt;p.y=clamp(p.y+u.y*speed*dt,85,510);for(const o of obstacles())if(Math.abs(p.x-o.x)<30&&Math.abs(p.y-o.y)<62&&p.jump<=0&&p.inv<=0){p.slow=.7;p.inv=1;effect(s,p.x,p.y,'OPA!','#ffb3aa');}if(p.x>=2800&&!p.finish)p.finish=s.t;}
    else{p.x=clamp(p.x+u.x/len*speed*dt,s.game==='lava'?90:55,s.game==='lava'?870:905);p.y=clamp(p.y+u.y/len*speed*dt,s.game==='lava'?110:100,s.game==='lava'?490:530);}
    if(s.game==='lava'){if(s.tiles[tileAt(p)]?.hole>0&&p.jump<=0&&p.inv<=0){p.down=2;p.score=Math.max(0,p.score-3);effect(s,p.x,p.y,'VOLTA JÁ!','#ffe184');}else p.score+=dt;}
  }
  if(s.game==='rua'){
    for(const e of s.enemies){if(e.hp<=0)continue;e.hit=Math.max(0,e.hit-dt);e.cool=Math.max(0,e.cool-dt);const p=s.players.filter(p=>p.down<=0).sort((a,b)=>dist(e,a)-dist(e,b))[0];if(!p)continue;const d=dist(e,p);if(d>45){const u=aim(e,p);e.x+=u.x*(45+s.wave*10)*dt;e.y+=u.y*(45+s.wave*10)*dt;}else if(e.cool<=0&&p.inv<=0){p.hp--;p.inv=1.1;e.cool=1.5;if(p.hp<=0){p.down=8;effect(s,p.x,p.y,'ME AJUDA!','#ffb3aa');}}}
    if(s.enemies.every(e=>e.hp<=0)){if(s.wave===3){finish(s);return s;}s.wave++;spawnWave(s);for(const p of s.players)p.hp=Math.min(5,p.hp+1);effect(s,480,160,'FASE '+s.wave,'#ffe184');}
    s.allDown=s.players.every(p=>p.down>0)?s.allDown+dt:0;if(s.allDown>1.5){s.lost=true;finish(s);}
  }
  if(s.game==='lava'){
    for(const t of s.tiles){if(t.warning>0){t.warning-=dt;if(t.warning<=0)t.hole=4;}else t.hole=Math.max(0,t.hole-dt);}
    if(Math.floor(s.t/1.5)!==Math.floor((s.t-dt)/1.5)){for(let i=0;i<4;i++){const t=s.tiles[Math.floor(random(s)*40)];if(!t.hole&&!t.warning)t.warning=1.6;}}
  }
  if(s.game==='lanche')for(const i of s.items)i.wait=Math.max(0,i.wait-dt);
  if(s.game==='corrida'&&s.players.some(p=>p.finish)){finish(s);return s;}
  if(s.left<=0){if(s.game==='rua')s.lost=true;finish(s);}return s;
}
export function finish(s){
  if(s.status!=='playing')return;
  s.status='result';s.phaseTime=0;
  const sorted=[...s.players].sort((a,b)=>s.game==='corrida'?b.x-a.x:b.score-a.score);
  const points=s.players.map(p=>s.game==='rua'?(s.lost?1:3):s.game==='lanche'?(s.teams[p.team]===Math.max(...s.teams)?3:1):Math.max(1,4-sorted.indexOf(p)));
  s.players.forEach((p,i)=>{p.cup+=points[i];});s.results.push({game:s.game,round:s.round,points,teams:[...s.teams],won:!s.lost});s.event++;
}
export function pack(s){return JSON.stringify(s,(k,v)=>typeof v==='number'&&!Number.isInteger(v)?Math.round(v*1000)/1000:v);}
export function unpack(str){const s=JSON.parse(str);if(s?.app!=='bora'||s.v!==2||!Array.isArray(s.players)||s.players.length>6||!GAMES.some(g=>g.id===s.game))throw Error('Esta sala pertence a outra versão do jogo. Crie uma sala Bora!');return s;}
