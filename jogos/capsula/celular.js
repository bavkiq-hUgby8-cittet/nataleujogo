(function () {
    const { familia, partida } = Plataforma.consulta();
    const app = document.getElementById('app');
    const caminho = 'families/' + familia + '/capsula/eventos/' + partida;
    let eu = null;
    let publico = null;
    let nomes = {};
    let segredos = null;

    function aberta() {
        return publico && Date.now() >= Number(publico.abreEm);
    }

    function renderCartas() {
        app.innerHTML = `<h1>${Plataforma.esc(publico.titulo)}</h1><p>A cápsula abriu.</p><div id="cartas" class="lista"></div>`;
        const caixa = document.getElementById('cartas');
        Object.entries(nomes).forEach(([uid, nome]) => {
            const segredo = segredos?.[uid];
            if (!segredo) return;
            const item = document.createElement('article');
            item.className = 'cartao';
            const titulo = document.createElement('h2');
            titulo.textContent = nome;
            const texto = document.createElement('p');
            texto.className = 'carta-texto';
            texto.textContent = segredo.texto || '';
            item.append(titulo, texto);
            if (String(segredo.foto || '').startsWith('data:image/jpeg')) {
                const img = document.createElement('img');
                img.alt = 'Foto enviada com a carta';
                img.src = segredo.foto;
                item.appendChild(img);
            }
            caixa.appendChild(item);
        });
    }

    function render() {
        if (!publico) {
            app.textContent = 'Cápsula não encontrada.';
            return;
        }
        if (aberta() && segredos) {
            renderCartas();
            return;
        }
        if (nomes[eu.uid]) {
            const quando = new Date(Number(publico.abreEm)).toLocaleString('pt-BR');
            app.innerHTML = `<h1>${Plataforma.esc(publico.titulo)}</h1><p>Sua carta está lacrada. Ninguém lê antes de ${Plataforma.esc(quando)}.</p>`;
            return;
        }
        if (document.getElementById('carta')) return;
        app.innerHTML = `<h1>${Plataforma.esc(publico.titulo)}</h1>
            <form id="carta" class="formulario cartao">
                <label for="nome">Seu nome</label>
                <input id="nome" required maxlength="40" value="${Plataforma.esc(Plataforma.nomeGuardado())}">
                <label for="texto">Carta</label>
                <textarea id="texto" required maxlength="1200" placeholder="Escreva para a família do futuro."></textarea>
                <label for="foto">Foto opcional</label>
                <input id="foto" type="file" accept="image/*">
                <button class="botao" type="submit">Lacrar carta</button>
            </form>`;
        document.getElementById('carta').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const nome = document.getElementById('nome').value.trim();
            const texto = document.getElementById('texto').value.trim();
            let foto = '';
            const arquivo = document.getElementById('foto').files[0];
            try {
                if (arquivo) foto = await Plataforma.comprimirFoto(arquivo);
                Plataforma.guardarNome(nome);
                const updates = {};
                updates[caminho + '/nomes/' + eu.uid] = nome;
                updates[caminho + '/segredos/' + eu.uid] = { texto, foto };
                await Plataforma.banco().ref().update(updates);
                Plataforma.avisar('Carta lacrada.');
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
            if (aberta()) {
                Plataforma.banco().ref(caminho + '/segredos').on('value', (seg) => {
                    segredos = seg.val() || {};
                    render();
                }, () => { segredos = null; });
            }
        });
        Plataforma.banco().ref(caminho + '/nomes').on('value', (snap) => {
            nomes = snap.val() || {};
            render();
        });
    })();
})();
