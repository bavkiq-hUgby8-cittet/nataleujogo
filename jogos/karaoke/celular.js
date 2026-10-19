(function () {
    const { familia, partida } = Plataforma.consulta();
    const app = document.getElementById('app');
    const caminho = 'families/' + familia + '/karaoke/partidas/' + partida;
    let eu = null;
    let estado = null;
    let nome = '';

    function render() {
        if (!estado) {
            app.textContent = 'Partida não encontrada.';
            return;
        }
        if (!nome) {
            app.innerHTML = `<h1>Karaokê</h1><form id="entrar" class="formulario cartao">
                <label for="nome">Seu nome</label>
                <input id="nome" required maxlength="40" value="${Plataforma.esc(Plataforma.nomeGuardado())}">
                <button class="botao" type="submit">Entrar na fila</button></form>`;
            document.getElementById('entrar').addEventListener('submit', (evento) => {
                evento.preventDefault();
                nome = document.getElementById('nome').value.trim();
                Plataforma.guardarNome(nome);
                render();
            });
            return;
        }
        Plataforma.aplicarTema(estado.tema);
        const repertorio = Object.values(estado.repertorio || {});
        app.innerHTML = `<h1>Karaokê</h1><p id="agora"></p><div id="voto"></div>
            <form id="pedir" class="formulario cartao">
                <label for="escolha">Do repertório</label>
                <select id="escolha"><option value="">Escolher…</option></select>
                <label for="livre">Ou escreva outra música</label>
                <input id="livre" maxlength="80">
                <label for="link">Link do YouTube, se tiver</label>
                <input id="link">
                <button class="botao" type="submit">Entrar na fila</button>
            </form>
            <h2>Fila</h2><div class="ranking" id="fila"></div>`;
        const agora = document.getElementById('agora');
        const voto = document.getElementById('voto');
        if (estado.atual) {
            agora.textContent = estado.fase === 'votando'
                ? 'Nota para ' + estado.atual.nome + ' em ' + estado.atual.titulo
                : estado.atual.nome + ' canta ' + estado.atual.titulo;
        } else agora.textContent = 'A TV ainda não chamou ninguém.';
        if (estado.fase === 'votando' && !estado.votos?.[eu.uid]) {
            const estrelas = document.createElement('div');
            estrelas.className = 'estrelas';
            [1, 2, 3, 4, 5].forEach((nota) => {
                const botao = document.createElement('button');
                botao.type = 'button';
                botao.className = 'estrela';
                botao.textContent = nota + ' ★';
                botao.addEventListener('click', async () => {
                    try {
                        await Plataforma.banco().ref(caminho + '/votos/' + eu.uid).set(nota);
                    } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
                });
                estrelas.appendChild(botao);
            });
            voto.appendChild(estrelas);
        } else if (estado.fase === 'votando') {
            voto.textContent = 'Sua nota já foi.';
        }
        const select = document.getElementById('escolha');
        repertorio.forEach((m) => {
            const op = document.createElement('option');
            op.value = JSON.stringify({ titulo: m.titulo, videoId: m.videoId || '' });
            op.textContent = m.artista ? m.titulo + ' — ' + m.artista : m.titulo;
            select.appendChild(op);
        });
        document.getElementById('fila').innerHTML = Object.values(estado.fila || {}).map((item) => `<div class="rank"><span>${Plataforma.esc(item.nome)} · ${Plataforma.esc(item.titulo)}</span></div>`).join('') || '<p>Fila vazia.</p>';
        document.getElementById('pedir').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            let titulo = document.getElementById('livre').value.trim();
            let video = Plataforma.videoId(document.getElementById('link').value);
            const escolha = document.getElementById('escolha').value;
            if (escolha && !titulo) {
                const dados = JSON.parse(escolha);
                titulo = dados.titulo;
                if (!video) video = dados.videoId || '';
            }
            if (!titulo) return Plataforma.avisar('Escolha ou escreva uma música.');
            try {
                await Plataforma.banco().ref(caminho + '/fila').push({
                    uid: eu.uid,
                    nome,
                    titulo,
                    videoId: video || ''
                });
                document.getElementById('livre').value = '';
                document.getElementById('link').value = '';
            } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
        });
    }

    (async function iniciar() {
        if (!familia || !partida || !window.JogosFirebase?.podeConectar) {
            app.textContent = 'Link incompleto.';
            return;
        }
        eu = await Plataforma.entrarConvidado();
        nome = '';
        Plataforma.banco().ref(caminho).on('value', (snap) => {
            estado = snap.val();
            if (!nome) {
                if (!document.getElementById('entrar')) render();
                return;
            }
            const foco = document.activeElement;
            if (foco && (foco.id === 'livre' || foco.id === 'link' || foco.id === 'escolha')) return;
            render();
        });
    })();
})();
