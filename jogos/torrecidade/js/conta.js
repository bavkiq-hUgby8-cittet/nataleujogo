import * as F from '../vendor/firebase.js';
const $ = id => document.getElementById(id);
const config = window.JOGOS_FIREBASE;
const app = F.getApps().find(a => a.name === '[DEFAULT]') || F.initializeApp(config);
const auth = F.initializeAuth(app, {persistence:[F.indexedDBLocalPersistence,F.browserLocalPersistence]});
if (['localhost','127.0.0.1'].includes(location.hostname) && config.emuladorAutomatico !== false) F.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
const errors = {'auth/invalid-credential':'E-mail ou senha incorretos.','auth/invalid-email':'Confira o e-mail.','auth/email-already-in-use':'Esta conta já existe. Use Entrar ou Recuperar senha.','auth/weak-password':'Use uma senha com pelo menos 8 caracteres.','auth/too-many-requests':'Muitas tentativas. Aguarde alguns minutos.','auth/network-request-failed':'Sem conexão. Tente novamente.','auth/operation-not-allowed':'O acesso da família ainda está sendo ativado. Tente novamente em instantes.'};
async function action(fn) {
  for(const b of document.querySelectorAll('button')) b.disabled=true;
  $('message').textContent='Conectando…';
  try {await fn();} catch(e) {$('message').textContent=errors[e.code] || 'Não foi possível entrar agora. Tente novamente.';}
  finally {for(const b of document.querySelectorAll('button')) b.disabled=false;}
}
F.onAuthStateChanged(auth,user => {
  const ready = user && !user.isAnonymous;
  $('login').hidden=!!ready; $('signed').hidden=!ready;
  $('identity').textContent=ready ? user.email : '';
  $('message').textContent=ready ? (new URLSearchParams(location.search).has('festa') ? 'Conta conectada. Bora jogar!' : 'Conta conectada. Vamos construir!') : '';
});
$('login').onsubmit=e=>{e.preventDefault();action(()=>F.signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value));};
$('register').onclick=()=>{if(!$('login').reportValidity()) return; action(()=>F.createUserWithEmailAndPassword(auth,$('email').value.trim(),$('password').value));};
$('recover').onclick=()=>{if(!$('email').reportValidity())return;action(async()=>{await F.sendPasswordResetEmail(auth,$('email').value.trim());$('message').textContent='Se houver uma conta com esse e-mail, você receberá as instruções para recuperar o acesso.';});};
$('logout').onclick=()=>action(()=>F.signOut(auth));

if(new URLSearchParams(location.search).has('festa')) {
  document.title='Conta do anfitrião · Bora!';
  document.querySelector('h1').textContent='Sua turma, na mesma partida.';
  document.querySelector('.brand').textContent='↗ bora! party arcade';
  const links=document.querySelectorAll('#signed a');
  links[0].href='../bora/index.html?criar=1'; links[0].textContent='Criar sala Bora!';
  links[1].hidden=true;
}
