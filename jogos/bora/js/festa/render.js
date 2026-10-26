import {W,H,COLORS,obstacles} from './engine.js';
const P=Math.PI*2;
export class ArcadeRenderer {
  constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.frames=0;this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);}
  resize(){const d=Math.min(devicePixelRatio||1,1.5),r=this.canvas.getBoundingClientRect();this.canvas.width=Math.max(1,Math.round(r.width*d));this.canvas.height=Math.max(1,Math.round(r.height*d));}
  rect(x,y,w,h,color,r=0){const c=this.c;c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  circle(x,y,r,color){const c=this.c;c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,P);c.fill();}
  text(t,x,y,size=18,color='#fff',align='center'){const c=this.c;c.fillStyle=color;c.font=`800 ${size}px system-ui, sans-serif`;c.textAlign=align;c.fillText(t,x,y);}
  line(x,y,xx,yy,color,width=2){const c=this.c;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
  draw(s,uid,time=0){
    if(document.hidden||this.canvas.hidden)return;
    const c=this.c;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);this.frames++;this.time=time;this.s=s;
    this.rect(0,0,W,H,'#111321');
    const player=s.players.find(p=>p.uid===uid)||s.players[0];this.camera=s.game==='corrida'?Math.max(0,(player?.x||0)-240):0;
    if(s.game==='rua')this.street(s);else if(s.game==='lava')this.floor(s);else if(s.game==='corrida')this.race(s);else this.park(s);
    if(s.game==='rua')for(const e of s.enemies)if(e.hp>0)this.robot(e);
    for(const p of [...s.players].sort((a,b)=>a.y-b.y))this.hero(p,p.uid===uid);
    for(const e of s.effects)this.text(e.text,e.x-this.camera,e.y-55,22,e.color);
    if(s.status==='lobby'){this.rect(0,0,W,H,'#11132118');this.text('YOUR NEXT GOOD TIME.',480,75,16,'#b0b1cd');}
  }
  street(s){
    this.rect(0,0,W,100,'#17182c');
    for(let i=0;i<12;i++){const h=45+(i*29)%65;this.rect(i*85-10,90-h,72,h,'#252540',4);for(let j=0;j<4;j++)this.rect(i*85+j*13,95-h,5,8,j%2?'#6a55bf':'#46778f',1);}
    this.rect(0,100,W,440,'#25283c');
    for(let i=0;i<12;i++)this.line(i*90-30,105,i*90-30,540,'#31344a',1);
    for(let i=0;i<7;i++)this.line(0,110+i*70,W,110+i*70,'#31344a',1);
    this.rect(30,85,900,12,'#bb8bff',4);this.rect(30,542,900,8,'#7bded3',4);
    this.rect(25,15,180,57,'#35304c',10);this.text('NEON DISTRICT',115,48,15,'#e6d2ff');
    this.rect(746,20,181,50,'#24273e',8);this.text('SECTOR 0'+s.wave,836,51,18,'#88efdb');
    for(const x of [40,910]){this.rect(x,140,16,100,'#424358',3);this.rect(x-5,138,26,9,'#85eee5',3);this.rect(x-8,430,33,38,'#393c52',5);}
    this.text('NEON RUSH',480,581,15,'#797b9c');
  }
  floor(s){
    this.rect(0,65,W,490,'#151a34');
    for(let i=0;i<10;i++)this.circle((i*179)%960,70+(i*93)%470,2,'#625b96');
    for(const t of s.tiles){const x=80+t.id%8*100,y=100+Math.floor(t.id/8)*80;
      if(t.hole>0){this.rect(x+4,y+6,92,72,'#090d1d',8);this.line(x+15,y+15,x+85,y+62,'#242543',1);continue;}
      const warn=t.warning>0;const color=warn?(Math.sin(this.time*18)>0?'#ffae65':'#b85c54'):(t.id+Math.floor(t.id/8))%2?'#6158a0':'#7568bc';
      this.rect(x+3,y+8,94,72,'#302c5b',8);this.rect(x+3,y+2,94,67,color,8);this.line(x+14,y+8,x+86,y+8,warn?'#ffd3a4':'#aa96ec',2);
      if(warn)this.text('!',x+50,y+46,26,'#321f36');
    }
    this.text('GLITCH / STAY ONLINE',480,62,20,'#c9b8ff');this.text('NÃO CONFIE NO CHÃO.',480,558,14,'#83809f');
  }
  race(s){
    this.rect(0,76,W,460,'#213b43');
    for(let i=0;i<5;i++){this.rect(0,88+i*87,W,80,i%2?'#2b4550':'#29424c');this.line(0,171+i*87,W,171+i*87,'#789e9c',2);}
    for(let x=0;x<3500;x+=160){const xx=x-this.camera;this.rect(xx,69,58,8,'#b6e5a1',3);this.rect(xx,543,58,8,'#b6e5a1',3);}
    for(const o of obstacles()){const x=o.x-this.camera;if(x<-60||x>W+60)continue;this.rect(x-22,o.y-35,44,70,'#bb684c',8);this.rect(x-22,o.y-42,44,24,'#ffb077',7);this.line(x-15,o.y-35,x+15,o.y-35,'#ffebc0',4);}
    const end=2800-this.camera;for(let y=88;y<520;y+=40)for(let x=0;x<2;x++)this.rect(end+x*20,y,20,40,(Math.floor(y/40)+x)%2?'#f4f0db':'#151b29');
    this.text('TURBO LOOP',145,47,22,'#c3f2cb');this.text('2800m / CHEGADA',800,47,15,'#8dada9');
  }
  park(s){
    this.rect(30,90,900,450,'#283e3c',36);
    this.rect(330,100,300,430,'#3d5148',24);
    this.rect(60,220,130,170,'#564381',32);this.rect(770,220,130,170,'#9e573d',32);
    this.circle(125,305,47,'#9f84ef');this.circle(835,305,47,'#ffac76');this.text('⌄',125,320,42,'#392b63');this.text('⌄',835,320,42,'#6f3928');
    this.text('ROXO '+s.teams[0],125,195,18,'#d8c5ff');this.text('LARANJA '+s.teams[1],835,195,18,'#ffd0a6');
    for(const [x,y]of [[230,135],[730,135],[230,480],[730,480]]){this.rect(x-5,y,10,30,'#74604c',3);this.circle(x,y-15,33,'#4a7063');this.circle(x-10,y-22,20,'#6b9580');}
    for(const i of s.items)if(i.wait<=0)this.snack(i.x,i.y);
    this.text('SNACK CLASH',480,55,22,'#ffe1a4');
  }
  snack(x,y){this.circle(x,y+7,14,'#00000025');this.rect(x-12,y-8,24,14,'#cf7444',4);this.rect(x-14,y-12,28,9,'#ffcc7a',8);this.rect(x-14,y-1,28,5,'#9bd984',2);this.rect(x-12,y+4,24,5,'#eaa45e',3);}
  hero(p,you){
    let x=p.x-this.camera,y=p.y;if(x<-50||x>W+50)return;
    const c=this.c,down=p.down>0,jump=p.jump>0?Math.sin(Math.min(1,p.jump/.8)*Math.PI)*42:0;
    this.circle(x,y+9,24,'#00000030');
    if(you){c.strokeStyle='#f7f2e9';c.lineWidth=2;c.beginPath();c.ellipse(x,y+10,30,12,0,0,P);c.stroke();}
    c.save();c.translate(x,y-jump);if(down)c.rotate(-Math.PI/2);
    const blink=p.inv>0&&Math.floor(this.time*8)%2===0;c.globalAlpha=blink?.55:1;
    const bob=this.reduced?0:Math.sin(this.time*9+p.id)*2;
    this.rect(-15,-4,11,14,p.color,4);this.rect(4,-4,11,14,p.color,4);
    this.rect(-19,-38+bob,38,36,p.color,12);this.rect(-23,-33+bob,10,22,p.color,5);this.rect(13,-33+bob,10,22,p.color,5);
    this.rect(-18,-60+bob,36,34,'#e3dcda',13);this.rect(-15,-53+bob,30,15,'#1a2235',7);
    this.rect(p.face>0?-3:-11,-49+bob,16,4,p.color,2);this.rect(-12,-66+bob,24,11,p.color,5);
    this.rect(-8,-25+bob,16,4,'#ffffff70',2);
    if(p.attack>0){c.strokeStyle=p.cool>3.6?'#c6f5a4':'#fff4bc';c.lineWidth=6;c.beginPath();c.arc(0,-24,47,p.face>0?-.9:2.2,p.face>0?.9:4.1);c.stroke();}
    if(p.carry)this.snack(0,-83);
    c.restore();
    const label=p.name+(p.bot?' · CPU':'');this.rect(x-56,y-jump-94,112,21,you?'#f2efe6':'#181b30c9',8);this.text(label.slice(0,17),x,y-jump-79,11,you?'#222339':'#e1deef');
    if(this.s.game==='rua'){for(let i=0;i<5;i++)this.rect(x-22+i*9,y+22,7,4,i<p.hp?'#98e8c5':'#4b4c65',2);if(down)this.text('✚',x,y-15,24,'#ffc894');}
  }
  robot(e){const x=e.x,y=e.y;if(e.boss){this.c.save();this.c.translate(x,y);this.c.scale(1.55,1.55);this.c.translate(-x,-y);}this.circle(x,y+9,24,'#00000030');this.rect(x-22,y-39,44,42,e.hit?'#fff2cb':'#53657f',10);this.rect(x-27,y-34,10,21,'#39465d',4);this.rect(x+17,y-34,10,21,'#39465d',4);this.rect(x-17,y-32,34,12,'#171d32',4);this.rect(x-12,y-28,8,4,'#ff8c9d',2);this.rect(x+4,y-28,8,4,'#ff8c9d',2);this.line(x,y-39,x+5,y-51,'#6f8299',3);this.circle(x+5,y-53,4,'#ff9aa7');this.rect(x-17,y+2,12,9,'#35455f',3);this.rect(x+5,y+2,12,9,'#35455f',3);if(e.boss){this.c.restore();this.text('BOSS',x,y-92,13,'#ffabbf');}}
}
