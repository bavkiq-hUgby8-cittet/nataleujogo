// Public web configuration; permissions are enforced by Firebase Auth and RTDB rules.
// Local development always uses the demo project in the Emulator.
window.JOGOS_FIREBASE = ['localhost', '127.0.0.1'].includes(location.hostname) ? {
  apiKey: 'demo-jogos-familia',
  authDomain: 'demo-jogos-familia.firebaseapp.com',
  databaseURL: 'https://demo-jogos-familia-default-rtdb.firebaseio.com',
  projectId: 'demo-jogos-familia',
  emuladorAutomatico: true
} : {
  apiKey: 'AIzaSyD_FJiwQA9VpMezIF95zPIY-EasXezVtko',
  authDomain: 'torre-cidade-juntos.firebaseapp.com',
  databaseURL: 'https://torre-cidade-juntos-default-rtdb.firebaseio.com',
  projectId: 'torre-cidade-juntos',
  messagingSenderId: '877905321948',
  appId: '1:877905321948:web:08ade80c897a1451d33919',
  emuladorAutomatico: false
};
