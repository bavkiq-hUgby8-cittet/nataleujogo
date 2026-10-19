(function () {
    const { familia, partida } = Plataforma.consulta();
    const app = document.getElementById('app');
    let eu = null;
    let estado = null;

    function base() {
        return Plataforma.banco().ref('families/' + familia + '/quiz/partidas/' + partida);
    }

    function minhaResposta() {
        if (!estado || !eu) return undefined;
        return estado.respostas?.[estado.rodada]?.[eu.uid];
    }

    function render() {
        if (!estado) {
            app.textContent = 'Partida não encontrada.';
            return;
        }
        Plataforma.aplicarTema(estado.tema);
        if (estado.status === 'fim') {
            const ranking = Object.values(estado.jogadores || {}).sort((a, b) => (b.pontos || 0) - (a.pontos || 0));
            app.innerHTML = `<h1>Quiz encerrado</h1><div class="ranking">${ranking.map((j) => `<div class="rank"><span>${Plataforma.esc(j.nome)}</span><strong>${j.pontos || 0}</strong></div>`).join('')}</div>`;
            return;
        }
        if (estado.status !== 'pergunta' && estado.status !== 'revelada') {
            app.innerHTML = '<h1>Você está na sala</h1><p>A TV ainda não soltou a pergunta. Deixa essa tela aberta.</p>';
            return;
        }
        const resposta = minhaResposta();
        const falta = estado.status === 'pergunta' ? Math.max(0, Math.ceil((Number(estado.encerraEm || 0) - Date.now()) / 1000)) : 0;
        app.innerHTML = `<p>Pergunta ${Number(estado.indice) + 1}${estado.status === 'pergunta' ? ' · <span id="contagem">' + falta + 's</span>' : ''}</p><h1>${Plataforma.esc(estado.perguntaTexto || '')}</h1><div class="opcoes-cel" id="opcoes"></div><p id="estado-resposta"></p>`;
        const caixa = document.getElementById('opcoes');
        [0, 1, 2, 3].forEach((i) => {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'opcao';
            botao.textContent = estado.opcoes?.[i] || '';
            if (estado.status === 'revelada' && i === estado.indiceCorreto) botao.classList.add('certa');
            if (estado.status === 'revelada' && resposta === i && i !== estado.indiceCorreto) botao.classList.add('errada');
            botao.disabled = estado.status !== 'pergunta' || resposta !== undefined;
            botao.addEventListener('click', () => responder(i));
            caixa.appendChild(botao);
        });
        const dica = estado.status === 'revelada'
            ? 'O tempo desta pergunta fechou.'
            : (falta > 0 ? 'Escolhe uma alternativa.' : 'O relógio da TV zerou. Sua resposta ainda vale.');
        document.getElementById('estado-resposta').textContent = resposta === undefined
            ? dica
            : (estado.status === 'revelada' ? 'Placar atualizado na TV.' : 'Resposta registrada. Olha a TV.');
    }

    async function responder(indice) {
        const rodada = estado && estado.rodada;
        const aviso = document.getElementById('estado-resposta');
        document.querySelectorAll('#opcoes button').forEach((botao) => { botao.disabled = true; });
        if (aviso) aviso.textContent = 'Enviando resposta…';
        try {
            await base().child('respostas/' + rodada + '/' + eu.uid).set(indice);
        } catch (e) {
            document.querySelectorAll('#opcoes button').forEach((botao) => { botao.disabled = false; });
            if (aviso) aviso.textContent = Plataforma.erroAmigavel(e);
            Plataforma.avisar(Plataforma.erroAmigavel(e));
        }
    }

    function formulario() {
        app.innerHTML = `<h1>Quiz</h1><form id="entrar" class="formulario cartao">
            <label for="nome">Seu nome</label>
            <input id="nome" required maxlength="40" value="${Plataforma.esc(Plataforma.nomeGuardado())}">
            <label for="foto">Foto opcional</label>
            <input id="foto" type="file" accept="image/*">
            <button class="botao" type="submit">Entrar</button>
        </form>`;
        document.getElementById('entrar').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const nome = document.getElementById('nome').value.trim();
            let foto = '';
            const arquivo = document.getElementById('foto').files[0];
            try {
                if (arquivo) foto = await Plataforma.comprimirFoto(arquivo);
                Plataforma.guardarNome(nome);
                await base().child('jogadores/' + eu.uid).set({ nome, foto, pontos: 0, entrouEm: Date.now() });
            } catch (e) {
                Plataforma.avisar(Plataforma.erroAmigavel(e));
            }
        });
    }

    setInterval(() => {
        const contagem = document.getElementById('contagem');
        if (!contagem || !estado || estado.status !== 'pergunta') return;
        contagem.textContent = Math.max(0, Math.ceil((Number(estado.encerraEm || 0) - Date.now()) / 1000)) + 's';
    }, 400);

    (async function iniciar() {
        if (!familia || !partida || !window.JogosFirebase?.podeConectar) {
            app.textContent = 'Link incompleto ou Firebase sem configurar.';
            return;
        }
        try {
            eu = await Plataforma.entrarConvidado();
            const meu = await base().child('jogadores/' + eu.uid).get();
            if (!meu.exists()) formulario();
            base().on('value', (snap) => {
                estado = snap.val();
                if (!estado) {
                    app.textContent = 'Partida não encontrada.';
                    return;
                }
                if (!estado.jogadores?.[eu.uid]) {
                    if (!document.getElementById('entrar')) formulario();
                    return;
                }
                render();
            });
        } catch (e) {
            app.textContent = Plataforma.erroAmigavel(e);
        }
    })();
})();
