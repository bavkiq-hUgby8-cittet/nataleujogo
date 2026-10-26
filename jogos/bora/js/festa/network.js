import {createParty,reconcile,startRound,nextRound,step,DT,pack,unpack,input} from './engine.js';
import {FirebaseBackend,firebaseConnection,pathFor,createRoom} from '../backend.js';
export async function newOnlineRoom(){const connection=await firebaseConnection(true);const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let room='';for(const b of crypto.getRandomValues(new Uint8Array(5)))room+=chars[b%chars.length];return createRoom(connection,{room,mode:'torre'});}
// Uses the already deployed private-room transport envelope. The app marker is bora/v2;
// construction sessions have separate URLs and are never converted or overwritten.
export class PartyNetwork {
  constructor({family,room,invite,name,onState,onStatus,onPeople,onError}){Object.assign(this,{family,room,invite,name,onState,onStatus,onPeople,onError});this.instance=crypto.randomUUID();this.host=null;this.beat=0;this.people={};this.online={};this.controls={};this.state=null;this.connected=false;this.seq=0;this.lastInput=0;this.lastPublish=0;this.lastBeat=0;this.value={x:0,y:0,a:0,b:0};this.timers=[];this.stopped=false;}
  get isHost(){return this.connected&&this.host?.uid===this.uid&&this.host?.instance===this.instance;}
  humans(){return Object.entries(this.people).filter(([id])=>Object.keys(this.online[id]||{}).length).sort((a,b)=>a[1].entrouEm-b[1].entrouEm||a[0].localeCompare(b[0])).slice(0,6).map(([uid,p])=>({uid,name:p.nome}));}
  async join(){
    const conn=await firebaseConnection();this.uid=conn.uid;this.b=new FirebaseBackend(conn,pathFor(this.family,this.room,'torre'));
    const old=await this.b.read('jogadores/'+this.uid);
    await this.b.write('jogadores/'+this.uid,{nome:this.name.slice(0,30),avatar:'🎮',convite:this.invite,entrouEm:old?.entrouEm||this.b.now(),ready:true});
    const cfg=await this.b.read('config');if(cfg?.closed)throw Error('Esta sala foi encerrada. Peça um novo convite.');
    const last=await this.b.read('inputs/'+this.uid);this.seq=last?.seq||0;try{this.value={...this.value,a:JSON.parse(last?.data||'{}').a||0,b:JSON.parse(last?.data||'{}').b||0};}catch{}
    const fail=e=>this.fail(e);
    this.b.watch('jogadores',v=>{this.people=v||{};this.roster();},fail);
    this.b.watch('online',v=>{this.online=v||{};this.roster();},fail);
    this.b.watch('hostBeat',v=>{this.beat=v?.t||0;},fail);
    this.b.watch('host',v=>{const changed=v?.epoch!==this.host?.epoch||v?.instance!==this.host?.instance;this.host=v;if(changed){this.ready=false;this.onStatus(this.isHost?'Assumindo a rodada…':'Turma conectada');if(this.isHost)this.takeover().catch(fail);}},fail);
    const received=v=>{if(!v||v.epoch<(this.host?.epoch||0))return;try{const next=unpack(v.payload);if(!this.isHost&&(!this.state||next.revision>=this.state.revision)){this.state=next;this.onState(next);}}catch(e){this.fail(e);}};
    this.b.watch('estado/frame',received,fail);
    this.b.watch('inputs',v=>{this.controls=v||{};},fail);
    this.b.watch('config',v=>{if(v?.closed){this.fail(Error('O anfitrião encerrou a sala.'));this.close();}},fail);
    this.b.connection(async yes=>{this.connected=yes;this.onStatus(yes?'Conectando a turma…':'Sem conexão · reconectando');if(yes&&!this.stopped){try{await this.b.presence(this.uid,this.instance);await this.elect();}catch(e){this.fail(e);}}});
    this.timers.push(setInterval(()=>this.elect().catch(fail),500));
    this.timers.push(setInterval(()=>this.tick(),1000/30));
    this.timers.push(setInterval(()=>this.sendInput().catch(fail),90));
    this.onHide=()=>{this.value.x=this.value.y=0;this.sendInput().catch(()=>{});};
    this.onExit=()=>{this.b.leave(this.uid,this.instance).catch(()=>{});};
    addEventListener('blur',this.onHide);addEventListener('pagehide',this.onExit);return this;
  }
  roster(){const humans=this.humans();if(this.isHost&&this.ready&&this.state)reconcile(this.state,humans);this.onPeople(humans);}
  async elect(){
    if(!this.connected||this.electing||this.stopped||!this.online[this.uid]?.[this.instance])return;
    const now=this.b.now(),alive=this.host&&this.online[this.host.uid]?.[this.host.instance];
    if(alive&&now-Math.max(this.beat,this.host.desde||0)<3100)return;
    const humans=this.humans().filter(h=>!(alive&&h.uid===this.host?.uid&&now-this.beat>=3100));
    if(humans[0]?.uid!==this.uid)return;
    this.electing=true;this.onStatus('Trocando anfitrião…');
    try{await this.b.transaction('host',current=>{
      if(current&&this.online[current.uid]?.[current.instance]&&now-Math.max(this.beat,current.desde||0)<3100)return;
      return {uid:this.uid,instance:this.instance,epoch:(current?.epoch||0)+1,desde:now};
    });}finally{this.electing=false;}
  }
  async takeover(){
    const epoch=this.host.epoch;
    const [frame,snap]=await Promise.all([this.b.read('estado/frame'),this.b.read('estado/snapshot')]);
    const stored=[frame,snap].filter(Boolean).map(v=>unpack(v.payload)).sort((a,b)=>b.revision-a.revision)[0];
    if(!this.isHost||this.host.epoch!==epoch)return;
    this.state=stored||createParty({humans:this.humans()});reconcile(this.state,this.humans());this.ready=true;this.lastBeat=0;this.onState(this.state);this.onStatus('Você é o anfitrião · online');await this.publish(true);
  }
  tick(){
    if(!this.isHost||!this.ready||!this.state||this.stopped)return;
    const controls={};for(const [uid,v]of Object.entries(this.controls)){
      try{if(v.type!=='mover')continue;const u=input(JSON.parse(v.data));if(this.b.now()-v.t>400){u.x=0;u.y=0;}controls[uid]=u;}catch{}
    }
    controls[this.uid]=input(this.value);step(this.state,controls,DT);this.onState(this.state);
    const now=this.b.now();if(now-this.lastPublish>100){this.lastPublish=now;this.publish().catch(e=>this.fail(e));}
    if(now-this.lastBeat>900&&!this.beating){this.lastBeat=now;this.beating=true;this.b.write('hostBeat',{epoch:this.host.epoch,t:now}).catch(e=>this.fail(e)).finally(()=>this.beating=false);}
  }
  async publish(full=false){if(!this.isHost||!this.state||this.publishing)return;this.publishing=true;const data={epoch:this.host.epoch,payload:pack(this.state),t:this.b.now()};try{await this.b.patch({'estado/frame':data,...(full||this.b.now()-(this.checkpoint||0)>2000?{'estado/snapshot':data}:{})});if(full||this.b.now()-(this.checkpoint||0)>2000)this.checkpoint=this.b.now();}finally{this.publishing=false;}}
  async sendInput(){if(!this.connected||this.sending||this.stopped)return;this.sending=true;const seq=this.seq+1;try{await this.b.write('inputs/'+this.uid,{seq,type:'mover',data:JSON.stringify({...input(this.value),x:Math.round(this.value.x*100)/100,y:Math.round(this.value.y*100)/100}),t:this.b.now()});this.seq=seq;}finally{this.sending=false;}}
  start(game,playlist){if(!this.isHost||!this.ready)return false;if(!['lobby','final'].includes(this.state.status))return false;this.state.round=0;this.state.results=[];this.state.players.forEach(p=>p.cup=0);this.state.playlist=playlist;startRound(this.state,game);this.publish(true).catch(e=>this.fail(e));return true;}
  next(){if(!this.isHost)return;nextRound(this.state);this.publish(true).catch(e=>this.fail(e));}
  async fail(e){if(this.stopped)return;if(/permission/i.test(e.message)&&this.host){try{const host=await this.b.read('host');if(host?.epoch!==this.host.epoch){this.host=host;this.ready=false;this.onStatus('Novo anfitrião conectado');return;}}catch{}}
    this.onError(e);}
  async close(){this.stopped=true;this.timers.forEach(clearInterval);removeEventListener('blur',this.onHide);removeEventListener('pagehide',this.onExit);if(this.b){try{await this.b.leave(this.uid,this.instance);}finally{this.b.close();}}}
}
