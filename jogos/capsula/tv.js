(function () {
    const { familia, partida } = Plataforma.consulta();
    const app = document.getElementById('app');
    const caminho = 'families/' + familia + '/capsula/eventos/' + partida;
    let publico = null;
    let nomes = {};
    let segredos = null;
    let codigo = '';

    function linkCelular() {
        const url = new URL('celular.html', location.href);
        url.searchParams.set('familia', familia);
        url.searchParams.set('partida', partida);
        return url.href;
    }

    function aberta() {
        return publico && Date.now() >= Number(publico.abreEm);
    }

    function render() {
        if (!publico) {
            app.textContent = 'Cápsula não encontrada.';
            return;
        }
        const falta = Math.max(0, Number(publico.abreEm) - Date.now());
        const dias = Math.floor(falta / 86400000);
        const horas = Math.floor((falta % 86400000) / 3600000);
        const minutos = Math.floor((falta % 3600000) / 60000);
        const segundos = Math.floor((falta % 60000) / 1000);
        const gente = Object.entries(nomes);
        app.innerHTML = `<p><a href="../../painel.html#/capsula">Voltar ao painel</a></p>
            <h1>${Plataforma.esc(publico.titulo)}</h1>
            <p class="codigo-grande" id="codigo-sala">${Plataforma.esc(codigo)}</p>
            <div class="qr-caixa" id="qr"></div>
            <p><a id="link-celular" href="${Plataforma.esc(linkCelular())}">Deixar uma carta</a></p>
            <p class="contador" id="contagem">${aberta() ? 'A data chegou.' : `Faltam ${dias}d ${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`}</p>
            <p>${gente.length} carta(s) na cápsula.</p>
            <div id="cartas" class="lista"></div>`;
        Plataforma.desenharQr(document.getElementById('qr'), linkCelular());
        const caixa = document.getElementById('cartas');
        if (!aberta() || !segredos) {
            gente.forEach(([uid, nome]) => {
                const item = document.createElement('article');
                item.className = 'item';
                item.innerHTML = `<div><strong>${Plataforma.esc(nome)}</strong><p>Carta lacrada</p></div>`;
                const botao = document.createElement('button');
                botao.className = 'botao-perigo';
                botao.type = 'button';
                botao.textContent = 'Remover';
                botao.addEventListener('click', async () => {
                    const updates = {};
                    updates[caminho + '/nomes/' + uid] = null;
                    updates[caminho + '/segredos/' + uid] = null;
                    await firebase.database().ref().update(updates);
                });
                item.appendChild(botao);
                caixa.appendChild(item);
            });
            return;
        }
        gente.forEach(([uid, nome]) => {
            const segredo = segredos[uid];
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
                img.alt = 'Foto da carta de ' + nome;
                img.src = segredo.foto;
                item.appendChild(img);
            }
            caixa.appendChild(item);
        });
    }

    (async function iniciar() {
        if (!window.JogosFirebase?.podeConectar) return;
        const admin = await Plataforma.exigirAdmin(familia);
        if (!admin) return;
        const indice = (await firebase.database().ref('families/' + familia + '/capsula/indice/' + partida).get()).val();
        codigo = indice?.codigo || '';
        firebase.database().ref(caminho + '/publico').on('value', (snap) => {
            publico = snap.val();
            render();
            if (aberta()) ouvirSegredos();
        });
        firebase.database().ref(caminho + '/nomes').on('value', (snap) => {
            nomes = snap.val() || {};
            render();
        });
    })();

    let ouvindoSegredo = false;
    function ouvirSegredos() {
        if (ouvindoSegredo) return;
        ouvindoSegredo = true;
        firebase.database().ref(caminho + '/segredos').on('value', (snap) => {
            segredos = snap.val() || {};
            render();
        }, () => {
            segredos = null;
        });
    }

    setInterval(() => {
        const contagem = document.getElementById('contagem');
        if (!publico || !contagem || aberta()) return;
        const falta = Math.max(0, Number(publico.abreEm) - Date.now());
        const dias = Math.floor(falta / 86400000);
        const horas = Math.floor((falta % 86400000) / 3600000);
        const minutos = Math.floor((falta % 3600000) / 60000);
        const segundos = Math.floor((falta % 60000) / 1000);
        contagem.textContent = `Faltam ${dias}d ${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;
        if (falta <= 0) ouvirSegredos();
    }, 1000);
})();
