(function () {
    const { familia, partida } = Plataforma.consulta();
    const app = document.getElementById('app');
    const caminho = 'families/' + familia + '/memoria/partidas/' + partida;
    let eu = null;
    let publico = null;
    let visiveis = {};
    let jogadores = {};
    let primeira = null;

    function cartaEl(indice) {
        const carta = visiveis[indice] || visiveis[String(indice)];
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'carta' + (carta ? ' aberta' : '') + (carta?.achado ? ' achada' : '');
        botao.disabled = publico.status !== 'jogando' || publico.vezUid !== eu.uid || Boolean(carta);
        if (carta && String(carta.rotulo || '').startsWith('data:image/jpeg')) {
            const img = document.createElement('img');
            img.alt = 'Carta';
            img.src = carta.rotulo;
            botao.appendChild(img);
        } else {
            botao.textContent = carta ? carta.rotulo : '';
        }
        botao.addEventListener('click', () => escolher(indice));
        return botao;
    }

    async function escolher(indice) {
        if (primeira === null) {
            primeira = indice;
            return;
        }
        if (primeira === indice) return;
        const a = primeira;
        primeira = null;
        try {
            await Plataforma.banco().ref(caminho + '/tentativa').set({
                uid: eu.uid,
                a,
                b: indice,
                n: Date.now()
            });
        } catch (e) {
            Plataforma.avisar(Plataforma.erroAmigavel(e));
        }
    }

    function render() {
        if (!publico) return;
        if (!jogadores[eu.uid]) {
            if (!document.getElementById('entrar')) formulario();
            return;
        }
        Plataforma.aplicarTema(publico.tema);
        const total = Number(publico.pares || 0) * 2;
        const minhaVez = publico.vezUid === eu.uid;
        app.innerHTML = `<h1>${Plataforma.esc(publico.nome || 'Memória')}</h1><p id="vez"></p><div class="tabuleiro" id="tabuleiro"></div>`;
        const vez = document.getElementById('vez');
        if (publico.status === 'lobby') vez.textContent = 'Esperando a TV começar.';
        else if (publico.status === 'fim') vez.textContent = 'Fim de jogo. O placar está na TV.';
        else vez.textContent = minhaVez ? 'Sua vez. Abra duas cartas.' : 'Vez de ' + (publico.vezNome || 'outra pessoa');
        const tab = document.getElementById('tabuleiro');
        for (let i = 0; i < total; i += 1) tab.appendChild(cartaEl(i));
    }

    function formulario() {
        app.innerHTML = `<h1>Jogo da Memória</h1><form id="entrar" class="formulario cartao">
            <label for="nome">Seu nome</label>
            <input id="nome" required maxlength="40" value="${Plataforma.esc(Plataforma.nomeGuardado())}">
            <label for="foto">Foto opcional</label>
            <input id="foto" type="file" accept="image/*">
            <button class="botao" type="submit">Entrar</button></form>`;
        document.getElementById('entrar').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const nome = document.getElementById('nome').value.trim();
            let foto = '';
            const arquivo = document.getElementById('foto').files[0];
            try {
                if (arquivo) foto = await Plataforma.comprimirFoto(arquivo);
                if (publico?.status !== 'lobby') return Plataforma.avisar('A partida já começou.');
                Plataforma.guardarNome(nome);
                await Plataforma.banco().ref(caminho + '/jogadores/' + eu.uid).set({ nome, foto, pontos: 0 });
            } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
        });
    }

    (async function iniciar() {
        if (!familia || !partida || !window.JogosFirebase?.podeConectar) {
            app.textContent = 'Link incompleto.';
            return;
        }
        eu = await Plataforma.entrarConvidado();
        Plataforma.banco().ref(caminho + '/publico').on('value', (snap) => {
            publico = snap.val();
            render();
        });
        Plataforma.banco().ref(caminho + '/visiveis').on('value', (snap) => {
            visiveis = snap.val() || {};
            render();
        });
        Plataforma.banco().ref(caminho + '/jogadores').on('value', (snap) => {
            jogadores = snap.val() || {};
            render();
        });
    })();
})();
