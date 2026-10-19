(function () {
    const { familia, partida } = Plataforma.consulta();
    const app = document.getElementById('app');
    const caminho = 'families/' + familia + '/bingo/partidas/' + partida;
    let eu = null;
    let publico = null;
    let grid = [];
    const marcas = new Set();

    function desenhar() {
        if (!publico) return;
        Plataforma.aplicarTema(publico.tema);
        if (!grid.length) return;
        const sorteados = new Set(Object.values(publico.bolas || {}).map(Number));
        app.innerHTML = `<h1>${Plataforma.esc(publico.nome || 'Bingo')}</h1>
            <p>${publico.numeroAtual ? 'Saiu ' + Plataforma.esc((publico.letraAtual || '') + ' ' + publico.numeroAtual) : 'Aguardando o primeiro sorteio.'}</p>
            <div class="letras-bingo"><span>B</span><span>I</span><span>N</span><span>G</span><span>O</span></div>
            <div class="cartela" id="cartela"></div>
            <p>${Plataforma.esc(publico.aviso || '')}</p>
            <button class="botao" id="gritar" type="button">Bingo!</button>`;
        const caixa = document.getElementById('cartela');
        grid.forEach((n) => {
            const casa = document.createElement('button');
            casa.type = 'button';
            casa.className = 'casa';
            casa.textContent = n === 0 ? '★' : String(n);
            if (n === 0) casa.classList.add('livre');
            if (n !== 0 && sorteados.has(n)) casa.classList.add('saiu');
            if (marcas.has(n) || n === 0) casa.classList.add('marcada');
            casa.addEventListener('click', () => {
                if (n === 0 || !sorteados.has(n)) return;
                if (marcas.has(n)) marcas.delete(n);
                else marcas.add(n);
                desenhar();
            });
            caixa.appendChild(casa);
        });
        const gritar = document.getElementById('gritar');
        gritar.disabled = publico.status !== 'jogando';
        if (publico.status === 'fim') {
            gritar.textContent = publico.vencedorNome ? publico.vencedorNome + ' fez bingo' : 'Encerrado';
        }
        gritar.addEventListener('click', async () => {
            try {
                await Plataforma.banco().ref(caminho + '/pedidos/' + eu.uid).set(true);
                Plataforma.avisar('A TV está conferindo a cartela.');
            } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
        });
    }

    function formulario() {
        app.innerHTML = `<h1>Bingo</h1><form id="entrar" class="formulario cartao">
            <label for="nome">Seu nome</label>
            <input id="nome" required maxlength="40" value="${Plataforma.esc(Plataforma.nomeGuardado())}">
            <button class="botao" type="submit">Pegar minha cartela</button>
        </form>`;
        document.getElementById('entrar').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const nome = document.getElementById('nome').value.trim();
            const nova = Cartela.gerar();
            try {
                Plataforma.guardarNome(nome);
                await Plataforma.banco().ref(caminho + '/presenca/' + eu.uid).set(nome);
                await Plataforma.banco().ref(caminho + '/cartelas/' + eu.uid).set(Cartela.serializar(nova));
                grid = nova;
            } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
        });
    }

    (async function iniciar() {
        if (!familia || !partida || !window.JogosFirebase?.podeConectar) {
            app.textContent = 'Link incompleto.';
            return;
        }
        eu = await Plataforma.entrarConvidado();
        const salva = await Plataforma.banco().ref(caminho + '/cartelas/' + eu.uid).get();
        if (salva.exists()) grid = Cartela.ler(salva.val());
        else formulario();
        Plataforma.banco().ref(caminho + '/publico').on('value', (snap) => {
            publico = snap.val();
            if (!publico) {
                app.textContent = 'Partida não encontrada.';
                return;
            }
            if (!grid.length) {
                if (publico.status !== 'lobby' && !document.getElementById('entrar')) {
                    app.innerHTML = '<h1>A sala já começou</h1><p>Esta cartela só entra antes do sorteio.</p>';
                }
                return;
            }
            desenhar();
        });
    })();
})();
