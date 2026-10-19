(function () {
    const { familia, partida } = Plataforma.consulta();
    const app = document.getElementById('app');
    const caminho = 'families/' + familia + '/karaoke/partidas/' + partida;
    let estado = null;

    function linkCelular() {
        const url = new URL('celular.html', location.href);
        url.searchParams.set('familia', familia);
        url.searchParams.set('partida', partida);
        return url.href;
    }

    function placar() {
        return Object.values(estado?.placar || {}).sort((a, b) => (b.pontos || 0) - (a.pontos || 0));
    }

    function render() {
        if (!estado) {
            app.textContent = 'Partida não encontrada.';
            return;
        }
        Plataforma.aplicarTema(estado.tema);
        if (estado.status === 'fim') {
            app.innerHTML = `<h1>Fim do karaokê</h1><div class="ranking">${placar().map((p) => `<div class="rank"><span>${Plataforma.esc(p.nome)}</span><strong>${p.pontos}</strong></div>`).join('') || '<p>Sem notas.</p>'}</div>`;
            return;
        }
        const fila = Object.entries(estado.fila || {});
        const atual = estado.atual;
        app.innerHTML = `<p><a href="../../painel.html#/karaoke">Voltar ao painel</a></p><h1>Karaokê</h1>
            ${estado.status === 'lobby' ? `<p class="codigo-grande" id="codigo-sala">${Plataforma.esc(estado.codigo || '')}</p><div class="qr-caixa" id="qr"></div><p><a id="link-celular" href="${Plataforma.esc(linkCelular())}">Abrir no celular</a></p>` : ''}
            <div id="palco-musica"></div>
            <h2>Fila</h2><div class="ranking" id="fila"></div>
            <h2>Placar</h2><div class="ranking">${placar().map((p) => `<div class="rank"><span>${Plataforma.esc(p.nome)}</span><strong>${p.pontos}</strong></div>`).join('') || '<p>Ainda sem notas.</p>'}</div>
            <div class="linha" id="acoes"></div>`;
        if (estado.status === 'lobby') Plataforma.desenharQr(document.getElementById('qr'), linkCelular());
        const palco = document.getElementById('palco-musica');
        if (atual) {
            palco.innerHTML = `<h2>${Plataforma.esc(atual.nome)} canta</h2><p class="pergunta-tv">${Plataforma.esc(atual.titulo)}</p>`;
            if (atual.videoId && estado.fase === 'cantando') {
                const frame = document.createElement('iframe');
                frame.className = 'video';
                frame.title = 'Vídeo do karaokê';
                frame.allow = 'autoplay; fullscreen';
                frame.src = 'https://www.youtube-nocookie.com/embed/' + atual.videoId + '?rel=0';
                palco.appendChild(frame);
            }
            if (estado.fase === 'resultado') {
                const extra = document.createElement('p');
                extra.textContent = 'Notas somadas: ' + (estado.ultimaSoma || 0);
                palco.appendChild(extra);
            }
        }
        const lista = document.getElementById('fila');
        fila.forEach(([, item]) => {
            const linha = document.createElement('div');
            linha.className = 'rank';
            linha.textContent = item.nome + ' · ' + item.titulo;
            lista.appendChild(linha);
        });
        if (!fila.length) lista.innerHTML = '<p>Ninguém na fila.</p>';
        const acoes = document.getElementById('acoes');
        if (estado.fase !== 'votando' && fila.length) {
            const chamar = document.createElement('button');
            chamar.className = 'botao';
            chamar.type = 'button';
            chamar.textContent = 'Chamar o próximo';
            chamar.addEventListener('click', chamarProximo);
            acoes.appendChild(chamar);
        }
        if (atual && estado.fase === 'cantando') {
            const votar = document.createElement('button');
            votar.className = 'botao-ok';
            votar.type = 'button';
            votar.textContent = 'Abrir votação';
            votar.addEventListener('click', () => firebase.database().ref(caminho).update({ fase: 'votando', votos: null }));
            acoes.appendChild(votar);
        }
        if (estado.fase === 'votando') {
            const fechar = document.createElement('button');
            fechar.className = 'botao';
            fechar.type = 'button';
            fechar.textContent = 'Fechar votação';
            fechar.addEventListener('click', fecharVotacao);
            acoes.appendChild(fechar);
        }
    }

    async function chamarProximo() {
        const ids = Object.keys(estado.fila || {}).sort();
        if (!ids.length) return;
        const item = estado.fila[ids[0]];
        try {
            await firebase.database().ref(caminho).update({
                status: 'show',
                fase: 'cantando',
                votos: null,
                atual: { uid: item.uid, nome: item.nome, titulo: item.titulo, videoId: item.videoId || '' }
            });
            await firebase.database().ref(caminho + '/fila/' + ids[0]).remove();
        } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
    }

    async function fecharVotacao() {
        const notas = Object.values(estado.votos || {}).map(Number);
        const soma = notas.reduce((acc, n) => acc + n, 0);
        const placarAtual = { ...(estado.placar || {}) };
        const uid = estado.atual.uid;
        placarAtual[uid] = {
            nome: estado.atual.nome,
            pontos: (placarAtual[uid]?.pontos || 0) + soma
        };
        try {
            await firebase.database().ref(caminho).update({
                fase: 'resultado',
                placar: placarAtual,
                ultimaSoma: soma
            });
        } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
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
