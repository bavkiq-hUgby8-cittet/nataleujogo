(function () {
    const { familia, partida } = Plataforma.consulta();
    const app = document.getElementById('app');
    const caminho = 'families/' + familia + '/bingo/partidas/' + partida;
    let estado = null;
    let conferindo = false;

    function linkCelular() {
        const url = new URL('celular.html', location.href);
        url.searchParams.set('familia', familia);
        url.searchParams.set('partida', partida);
        return url.href;
    }

    function bolas() {
        return Object.values(estado?.publico?.bolas || {}).map(Number);
    }

    function render() {
        if (!estado?.publico) {
            app.textContent = 'Partida não encontrada.';
            return;
        }
        const pub = estado.publico;
        Plataforma.aplicarTema(pub.tema);
        if (pub.status === 'lobby') {
            const gente = Object.values(estado.presenca || {});
            app.innerHTML = `<p><a href="../../painel.html#/bingo">Voltar ao painel</a></p><h1>${Plataforma.esc(pub.nome || 'Bingo')}</h1>
                <p>Prêmio: ${Plataforma.esc(pub.premio || '')}</p>
                <p class="codigo-grande" id="codigo-sala">${Plataforma.esc(estado.codigo || '')}</p>
                <div class="qr-caixa" id="qr"></div>
                <p><a id="link-celular" href="${Plataforma.esc(linkCelular())}">Abrir no celular</a></p>
                <h2>${gente.length} na sala</h2>
                <div class="ranking">${gente.map((nome) => `<div class="rank"><span>${Plataforma.esc(nome)}</span></div>`).join('') || '<p>Esperando cartelas.</p>'}</div>
                <button class="botao" id="iniciar" type="button">Começar o sorteio</button>`;
            Plataforma.desenharQr(document.getElementById('qr'), linkCelular());
            document.getElementById('iniciar').addEventListener('click', () => firebase.database().ref(caminho + '/publico').update({ status: 'jogando' }));
            return;
        }
        if (pub.status === 'fim') {
            app.innerHTML = `<h1>Bingo!</h1><p class="pergunta-tv">${Plataforma.esc(pub.vencedorNome || 'Partida encerrada')}</p><p>${bolas().length} bolas saíram.</p>`;
            return;
        }
        app.innerHTML = `<h1>${Plataforma.esc(pub.nome || 'Bingo')}</h1>
            <div class="bola" aria-live="polite">${pub.numeroAtual ? Plataforma.esc((pub.letraAtual || '') + ' ' + pub.numeroAtual) : '—'}</div>
            <p>${Plataforma.esc(pub.aviso || '')}</p>
            <button class="botao" id="sortear" type="button">Sortear bola</button>
            <div class="ranking" id="saidas"></div>`;
        const saidas = document.getElementById('saidas');
        bolas().sort((a, b) => a - b).forEach((n) => {
            const linha = document.createElement('div');
            linha.className = 'rank';
            linha.textContent = Cartela.letra(n) + ' ' + n;
            saidas.appendChild(linha);
        });
        document.getElementById('sortear').addEventListener('click', sortear);
        Object.keys(estado.pedidos || {}).forEach((uid) => conferir(uid));
    }

    async function sortear() {
        const ja = new Set(bolas());
        const restantes = [];
        for (let n = 1; n <= 75; n += 1) if (!ja.has(n)) restantes.push(n);
        if (!restantes.length) return Plataforma.avisar('As 75 bolas já saíram.');
        const n = restantes[Math.floor(Math.random() * restantes.length)];
        const mapa = { ...(estado.publico.bolas || {}) };
        mapa[n] = n;
        try {
            await firebase.database().ref(caminho + '/publico').update({
                bolas: mapa,
                numeroAtual: n,
                letraAtual: Cartela.letra(n),
                aviso: ''
            });
        } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
    }

    async function conferir(uid) {
        if (conferindo || estado.publico.status !== 'jogando') return;
        conferindo = true;
        try {
            const bruta = (await firebase.database().ref(caminho + '/cartelas/' + uid).get()).val();
            const grid = Cartela.ler(bruta);
            const sorteados = new Set(bolas());
            const nome = estado.presenca?.[uid] || 'Alguém';
            if (Cartela.valida(grid) && Cartela.temLinha(grid, sorteados)) {
                await firebase.database().ref(caminho + '/publico').update({ status: 'fim', vencedorNome: nome });
                if (estado.codigo) await firebase.database().ref('codigos/' + estado.codigo).remove();
            } else {
                await firebase.database().ref(caminho + '/pedidos/' + uid).remove();
                await firebase.database().ref(caminho + '/publico/aviso').set(nome + ' ainda não fechou linha, coluna ou diagonal.');
            }
        } catch (e) {
            Plataforma.avisar(Plataforma.erroAmigavel(e));
        } finally {
            conferindo = false;
        }
    }

    (async function iniciar() {
        if (!window.JogosFirebase?.podeConectar) return;
        const admin = await Plataforma.exigirAdmin(familia);
        if (!admin) return;
        firebase.database().ref(caminho).on('value', (snap) => {
            estado = snap.val();
            render();
        });
    })();
})();
