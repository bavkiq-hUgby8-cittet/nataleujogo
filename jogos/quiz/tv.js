(function () {
    const { familia, partida } = Plataforma.consulta();
    const app = document.getElementById('app');
    const base = () => firebase.database().ref('families/' + familia + '/quiz/partidas/' + partida);
    let estado = null;
    let perguntas = {};
    let ocupado = false;

    function linkCelular() {
        const url = new URL('celular.html', location.href);
        url.searchParams.set('familia', familia);
        url.searchParams.set('partida', partida);
        return url.href;
    }

    function jogadores() {
        return Object.entries(estado?.jogadores || {}).sort((a, b) => (b[1].pontos || 0) - (a[1].pontos || 0));
    }

    function respostasDaRodada() {
        if (!estado?.respostas) return {};
        return estado.respostas[estado.rodada] || {};
    }

    function render() {
        if (!estado) {
            app.textContent = 'Essa partida não existe mais.';
            return;
        }
        Plataforma.aplicarTema(estado.tema);
        if (estado.status === 'lobby') return renderLobby();
        if (estado.status === 'pergunta') return renderPergunta();
        if (estado.status === 'revelada') return renderRevelada();
        renderFim();
    }

    function blocoQr() {
        return `<p>Aponte a câmera ou entre em ${Plataforma.esc(new URL('../../entrar.html', location.href).href)}</p>
            <p class="codigo-grande" id="codigo-sala">${Plataforma.esc(estado.codigo || '')}</p>
            <div class="qr-caixa" id="qr"></div>
            <p><a id="link-celular" href="${Plataforma.esc(linkCelular())}">Abrir no celular</a></p>`;
    }

    function renderLobby() {
        const gente = jogadores();
        app.innerHTML = `<p><a href="../../painel.html#/quiz">Voltar ao painel</a></p>
            <h1>Quiz da família</h1>
            ${blocoQr()}
            <h2>${gente.length} na sala</h2>
            <div class="ranking">${gente.map(([, j]) => `<div class="rank"><span>${Plataforma.esc(j.nome)}</span></div>`).join('') || '<p>Esperando o primeiro nome.</p>'}</div>
            <p class="linha"><button class="botao" id="comecar" type="button">Começar</button></p>`;
        Plataforma.desenharQr(document.getElementById('qr'), linkCelular());
        document.getElementById('comecar').addEventListener('click', avancar);
    }

    function renderPergunta() {
        const respostas = respostasDaRodada();
        const nomes = Object.keys(respostas).map((uid) => estado.jogadores?.[uid]?.nome || 'Alguém');
        const falta = Math.max(0, Math.ceil(((estado.encerraEm || 0) - Date.now()) / 1000));
        app.innerHTML = `<p>Pergunta ${Number(estado.indice) + 1} de ${estado.total}</p>
            <h1 class="pergunta-tv">${Plataforma.esc(estado.perguntaTexto || '')}</h1>
            <p>Respondam no celular.</p>
            <div class="opcoes-tv">${[0, 1, 2, 3].map((i) => `<div class="opcao">${Plataforma.esc(estado.opcoes?.[i] || '')}</div>`).join('')}</div>
            <p class="contador" id="contagem">${falta > 0 ? falta + 's' : 'Tempo da tela zerou'}</p>
            <p>${nomes.length ? nomes.map(Plataforma.esc).join(', ') + ' já respondeu.' : 'Ninguém respondeu ainda.'}</p>
            <p>A resposta no celular continua valendo até todo mundo responder ou até você revelar.</p>
            <button class="botao" id="revelar" type="button">Revelar agora</button>`;
        document.getElementById('revelar').addEventListener('click', revelar);
    }

    function renderRevelada() {
        const ultima = Number(estado.indice) + 1 >= Number(estado.total);
        app.innerHTML = `<h1 class="pergunta-tv">${Plataforma.esc(estado.perguntaTexto || '')}</h1>
            <div class="opcoes-tv">${[0, 1, 2, 3].map((i) => `<div class="opcao ${i === estado.indiceCorreto ? 'certa' : ''}">${Plataforma.esc(estado.opcoes?.[i] || '')}</div>`).join('')}</div>
            <h2>Placar</h2>
            <div class="ranking">${jogadores().map(([, j], i) => `<div class="rank"><span>${i + 1}. ${Plataforma.esc(j.nome)}</span><strong>${j.pontos || 0}</strong></div>`).join('')}</div>
            <button class="botao" id="seguir" type="button">${ultima ? 'Encerrar' : 'Próxima pergunta'}</button>`;
        document.getElementById('seguir').addEventListener('click', () => (ultima ? encerrar() : avancar()));
    }

    function renderFim() {
        app.innerHTML = `<h1>Fim do quiz</h1>
            <div class="ranking">${jogadores().map(([, j], i) => `<div class="rank"><span>${i + 1}. ${Plataforma.esc(j.nome)}</span><strong>${j.pontos || 0}</strong></div>`).join('') || '<p>Ninguém pontuou.</p>'}</div>
            <a class="botao" href="../../painel.html#/quiz">Voltar ao painel</a>`;
    }

    async function avancar() {
        if (ocupado) return;
        ocupado = true;
        try {
            const indice = Number(estado.indice ?? -1) + 1;
            const ordem = estado.ordem || {};
            const qid = ordem[indice];
            const q = perguntas[qid];
            if (!q) return Plataforma.avisar('Acabaram as perguntas.');
            const rodada = Number(estado.rodada || 0) + 1;
            await firebase.database().ref('families/' + familia + '/quiz/gabaritos/' + partida).set(q.correta);
            await base().update({
                status: 'pergunta',
                indice,
                rodada,
                perguntaTexto: q.texto,
                opcoes: q.opcoes,
                indiceCorreto: null,
                encerraEm: Date.now() + (Number(estado.segundos) || 20) * 1000
            });
        } catch (e) {
            Plataforma.avisar(Plataforma.erroAmigavel(e));
        } finally {
            ocupado = false;
        }
    }

    async function revelar() {
        if (ocupado || !estado || estado.status !== 'pergunta') return;
        ocupado = true;
        try {
            const fresco = (await base().get()).val() || {};
            if (fresco.status !== 'pergunta') return;
            const gabarito = (await firebase.database().ref('families/' + familia + '/quiz/gabaritos/' + partida).get()).val();
            const respostas = (fresco.respostas && fresco.respostas[fresco.rodada]) || {};
            const updates = { status: 'revelada', indiceCorreto: gabarito, encerraEm: null };
            Object.entries(respostas).forEach(([uid, escolha]) => {
                if (escolha === null || typeof escolha === 'object') return;
                if (Number(escolha) === Number(gabarito)) {
                    updates['jogadores/' + uid + '/pontos'] = (fresco.jogadores?.[uid]?.pontos || 0) + 10;
                }
            });
            await base().update(updates);
        } catch (e) {
            Plataforma.avisar(Plataforma.erroAmigavel(e));
        } finally {
            ocupado = false;
        }
    }

    async function encerrar() {
        try {
            await base().update({ status: 'fim' });
            if (estado.codigo) await firebase.database().ref('codigos/' + estado.codigo).remove();
        } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
    }

    setInterval(() => {
        if (!estado || estado.status !== 'pergunta') return;
        const contagem = document.getElementById('contagem');
        const falta = Math.max(0, Math.ceil(((estado.encerraEm || 0) - Date.now()) / 1000));
        if (contagem) contagem.textContent = falta > 0 ? falta + 's' : 'Tempo da tela zerou';
        const total = Object.keys(estado.jogadores || {}).length;
        const responderam = Object.keys(respostasDaRodada()).length;
        if (total > 0 && responderam >= total) revelar();
    }, 400);

    (async function iniciar() {
        if (!window.JogosFirebase?.podeConectar) {
            app.textContent = 'Firebase não configurado.';
            return;
        }
        const admin = await Plataforma.exigirAdmin(familia);
        if (!admin) return;
        perguntas = (await firebase.database().ref('families/' + familia + '/quiz/perguntas').get()).val() || {};
        base().on('value', (snap) => {
            estado = snap.val();
            render();
        });
    })();
})();
