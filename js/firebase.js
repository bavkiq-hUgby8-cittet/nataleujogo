(function (global) {
    const cfg = global.JOGOS_FIREBASE || {};
    const hostLocal = /^(localhost|127\.0\.0\.1)$/.test(global.location.hostname);
    const emulador = hostLocal && cfg.emuladorAutomatico !== false;
    const nuvemPronta = typeof cfg.apiKey === 'string' && cfg.apiKey.length > 10 && !cfg.apiKey.startsWith('demo-');

    global.JogosFirebase = {
        emulador: emulador,
        nuvemPronta: nuvemPronta,
        podeConectar: emulador || nuvemPronta,
        motivo: emulador || nuvemPronta ? '' : 'sem-config'
    };

    if (!global.JogosFirebase.podeConectar || typeof global.firebase === 'undefined') return;

    global.firebase.initializeApp(cfg);
    if (emulador) {
        global.firebase.auth().useEmulator('http://127.0.0.1:9099');
        global.firebase.database().useEmulator('127.0.0.1', 9000);
    }

    // A página do celular usa outro app do Firebase para o login anônimo
    // não derrubar a conta da TV quando as duas abas estão no mesmo navegador.
    const papel = document.querySelector('meta[name="jogos-papel"]');
    if (papel && papel.content === 'convidado') {
        const app = global.firebase.initializeApp(cfg, 'convidado');
        const auth = global.firebase.auth(app);
        const db = global.firebase.database(app);
        if (emulador) {
            auth.useEmulator('http://127.0.0.1:9099');
            db.useEmulator('127.0.0.1', 9000);
        }
        global.JogosFirebase.auth = auth;
        global.JogosFirebase.db = db;
    }
})(window);
