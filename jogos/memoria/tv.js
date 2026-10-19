(function () {
    const { familia, partida } = Plataforma.consulta();
    const app = document.getElementById('app');
    const caminho = 'families/' + familia + '/memoria/partidas/' + partida;
    let estado = null;
    let resolvendo = '';
    let pulando = false;

    function linkCelular() {
        const url = new URL('celular.html', location.href);
        url.searchParams.set('familia', familia);
        url.searchParams.set('partida', partida);
        return url.href;
    }

    function listaSegredo() {
        const bruto = estado?.segredo;
        if (!bruto) return [];
        if (Array.isArray(bruto)) return bruto;
        return Object.keys(bruto).sort((a, b) => Number(a) - Number(b)).map((chave) => bruto[chave]);
    }

    function desenharCarta(carta, indice) {
        const el = document.createElement('div');
        el.className = 'carta' + (carta ? ' aberta' : '') + (carta?.achado ? ' achada' : '');
        if (!carta) {
            el.textContent = String(indice + 1);
            return el;
        }
        if (String(carta.rotulo || '').startsWith('data:image/jpeg')) {
            const img = document.createElement('img');
            img.alt = 'Carta aberta';
            img.src = carta.rotulo;
            el.appendChild(img);
            el.style.color = 'inherit';
        } else {
            el.textContent = carta.rotulo || '';
        }
        return el;
    }

    function render() {
        if (!estado?.publico) {
            app.textContent = 'Partida não encontrada.';
            return;
        }
        const pub = estado.publico;
        Plataforma.aplicarTema(pub.tema);
        const total = Number(pub.pares || 0) * 2;
        const gente = Object.entries(estado.jogadores || {});
        app.innerHTML = `<p><a href="../../painel.html#/memoria">Voltar ao painel</a></p><h1>${Plataforma.esc(pub.nome || 'Memória')}</h1><div id="extra"></div><div class="tabuleiro" id="tabuleiro"></div><div class="ranking" id="placar"></div>`;
        const extra = document.getElementById('extra');
        if (pub.status === 'lobby') {
            extra.innerHTML = `<p class="codigo-grande" id="codigo-sala">${Plataforma.esc(estado.codigo || '')}</p><div class="qr-caixa" id="qr"></div><p><a id="link-celular" href="${Plataforma.esc(linkCelular())}">Abrir no celular</a></p><p>${gente.length} pessoa(s). Dá para jogar sozinho.</p><button class="botao" id="comecar" type="button">Começar</button>`;
            Plataforma.desenharQr(document.getElementById('qr'), linkCelular());
            document.getElementById('comecar').addEventListener('click', comecar);
        } else if (pub.status === 'fim') {
            extra.innerHTML = '<h2>Todos os pares foram encontrados</h2>';
        } else {
            const falta = Math.max(0, Math.ceil(((pub.prazo || 0) - Date.now()) / 1000));
            extra.innerHTML = `<p>Vez de ${Plataforma.esc(pub.vezNome || '')} · <span id="contagem">${falta}s</span></p><button class="botao-sec" id="pular" type="button">Pular a vez</button>`;
            document.getElementById('pular').addEventListener('click', pular);
        }
        const tab = document.getElementById('tabuleiro');
        for (let i = 0; i < total; i += 1) tab.appendChild(desenharCarta(estado.visiveis?.[i] || estado.visiveis?.[String(i)], i));
        const placar = document.getElementById('placar');
        gente.sort((a, b) => (b[1].pontos || 0) - (a[1].pontos || 0)).forEach(([, j]) => {
            const linha = document.createElement('div');
            linha.className = 'rank';
            linha.innerHTML = `<span>${Plataforma.esc(j.nome)}</span><strong>${j.pontos || 0}</strong>`;
            placar.appendChild(linha);
        });
        if (estado.tentativa) resolver(estado.tentativa);
    }

    async function comecar() {
        const gente = Object.entries(estado.jogadores || {});
        if (!gente.length) return Plataforma.avisar('Espera alguém entrar com o celular.');
        try {
            await firebase.database().ref(caminho + '/publico').update({
                status: 'jogando',
                vezUid: gente[0][0],
                vezNome: gente[0][1].nome,
                prazo: Date.now() + 20000
            });
        } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
    }

    function proximoUid(atual) {
        const ids = Object.keys(estado.jogadores || {});
        const i = ids.indexOf(atual);
        return ids[(i + 1) % ids.length];
    }

    async function pular() {
        if (pulando || estado?.publico?.status !== 'jogando') return;
        pulando = true;
        const seguinte = proximoUid(estado.publico.vezUid);
        const nome = estado.jogadores?.[seguinte]?.nome || '';
        try {
            await firebase.database().ref(caminho).update({
                'publico/vezUid': seguinte,
                'publico/vezNome': nome,
                'publico/prazo': Date.now() + 20000,
                tentativa: null
            });
        } finally {
            pulando = false;
        }
    }

    async function resolver(tentativa) {
        const marca = tentativa.uid + ':' + tentativa.a + ':' + tentativa.b + ':' + tentativa.n;
        if (resolvendo === marca) return;
        resolvendo = marca;
        const segredo = listaSegredo();
        const a = segredo[tentativa.a];
        const b = segredo[tentativa.b];
        if (!a || !b) {
            await firebase.database().ref(caminho + '/tentativa').remove();
            return;
        }
        const visiveis = { ...(estado.visiveis || {}) };
        visiveis[tentativa.a] = { rotulo: a.rotulo, achado: false };
        visiveis[tentativa.b] = { rotulo: b.rotulo, achado: false };
        try {
            await firebase.database().ref(caminho + '/visiveis').set(visiveis);
            await new Promise((resolve) => setTimeout(resolve, 900));
            const acertou = a.par === b.par;
            if (acertou) {
                visiveis[tentativa.a].achado = true;
                visiveis[tentativa.b].achado = true;
                const pontos = (estado.jogadores?.[tentativa.uid]?.pontos || 0) + 1;
                const achados = Object.values(visiveis).filter((carta) => carta?.achado).length;
                const fim = achados >= segredo.length;
                const updates = {
                    visiveis,
                    tentativa: null,
                    ['jogadores/' + tentativa.uid + '/pontos']: pontos
                };
                if (fim) updates['publico/status'] = 'fim';
                else updates['publico/prazo'] = Date.now() + 20000;
                await firebase.database().ref(caminho).update(updates);
            } else {
                delete visiveis[tentativa.a];
                delete visiveis[tentativa.b];
                const seguinte = proximoUid(tentativa.uid);
                await firebase.database().ref(caminho).update({
                    visiveis,
                    tentativa: null,
                    'publico/vezUid': seguinte,
                    'publico/vezNome': estado.jogadores?.[seguinte]?.nome || '',
                    'publico/prazo': Date.now() + 20000
                });
            }
        } catch (e) {
            Plataforma.avisar(Plataforma.erroAmigavel(e));
        }
    }

    setInterval(() => {
        const contagem = document.getElementById('contagem');
        if (!estado?.publico || estado.publico.status !== 'jogando') return;
        const falta = Math.max(0, Math.ceil(((estado.publico.prazo || 0) - Date.now()) / 1000));
        if (contagem) contagem.textContent = falta + 's';
        if (falta <= 0 && !estado.tentativa) pular();
    }, 500);

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
