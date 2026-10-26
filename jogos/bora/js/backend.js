// Shared modular SDK/auth transport, separate Bora namespace. No construction-room writes.
import * as F from '../../torrecidade/vendor/firebase.js';
export {firebaseConnection,FirebaseBackend} from '../../torrecidade/js/backend.js';
import {FirebaseBackend} from '../../torrecidade/js/backend.js';
export function pathFor(family,room){if(!/^[\w-]{1,128}$/.test(family)||!(/^[A-HJ-NP-Z2-9]{4,6}$/.test(room)||room==='ensaio'))throw Error('Link de convite inválido.');return `familias/${family}/jogos/bora/salas/${room}`;}
export async function createRoom(connection,{room}){
  const family=connection.uid,b=new FirebaseBackend(connection,pathFor(family,room));
  await F.runTransaction(F.ref(connection.db,`familias/${family}/adminUid`),v=>v?undefined:family);
  const old=await b.read('config');if(old)throw Error('Esse código já existe. Tente criar novamente.');
  const invite=Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');
  await b.write('config',{mode:'festa',difficulty:'familia',theme:'neutro',invite,created:Date.now(),closed:false});
  return {family,room,invite};
}
