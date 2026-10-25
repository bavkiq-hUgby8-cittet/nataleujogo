(function () {
    const JOGOS = {
        quiz: { nome: 'Quiz', icone: '🎯', texto: 'Perguntas na TV, respostas no celular.' },
        capsula: { nome: 'Cápsula do Tempo', icone: '💌', texto: 'Cartas lacradas até a data combinada.' },
        bingo: { nome: 'Bingo', icone: '🎱', texto: 'Bolas na TV e cartela no celular.' },
        karaoke: { nome: 'Karaokê', icone: '🎤', texto: 'Fila, música e nota da família.' },
        memoria: { nome: 'Jogo da Memória', icone: '🧠', texto: 'Pares na vez de cada pessoa.' }
    };

    const app = document.getElementById('app');
    let usuario = null;
    let meta = null;
    let ouvintes = [];

    function limparOuvintes() {
        ouvintes.forEach((parar) => parar());
        ouvintes = [];
    }

    function ouvir(ref, cb) {
        const fn = ref.on('value', cb);
        ouvintes.push(() => ref.off('value', fn));
    }

    function rota() {
        const nome = (location.hash || '#/').replace(/^#\/?/, '');
        return JOGOS[nome] ? nome : 'inicio';
    }

    function htmlSetup() {
        app.innerHTML = `
            <a class="marca" href="index.html">Jogos de Família</a>
            <article class="cartao">
                <h1>Falta configurar o Firebase</h1>
                <p>Este site estático ainda aponta para o projeto de demonstração. Crie um projeto no console do Firebase, ative o login por e-mail e o login anônimo, crie o Realtime Database e publique o arquivo <strong>database.rules.json</strong>. Depois troque <strong>js/firebase-config.js</strong> pelas chaves do seu projeto e deixe <strong>emuladorAutomatico</strong> como false.</p>
                <p>No computador, para experimentar sem nuvem, abra esta página em localhost com os emuladores ligados. O passo a passo está no README.</p>
                <a class="botao" href="index.html">Voltar ao início</a>
            </article>`;
    }

    function desenhar() {
        limparOuvintes();
        if (!window.JogosFirebase?.podeConectar) {
            htmlSetup();
            return;
        }
        if (!usuario || usuario.isAnonymous) {
            desenharAuth();
            return;
        }
        if (!meta) {
            app.innerHTML = '<article class="cartao"><h1>Não achamos esta família</h1><p>A conta entrou, mas os dados da casa não foram criados.</p><button class="botao" id="sair" type="button">Sair</button></article>';
            document.getElementById('sair').addEventListener('click', () => firebase.auth().signOut());
            return;
        }
        Plataforma.aplicarTema(meta.tema);
        const jogo = rota();
        if (jogo === 'inicio') desenharInicio();
        else desenharJogo(jogo);
    }

    function desenharAuth() {
        const aviso = new URLSearchParams(location.search).get('aviso');
        app.innerHTML = `
            <a class="marca" href="index.html">Jogos de Família</a>
            <h1>Conta da família</h1>
            <p class="nota">Um login comanda todos os jogos. Convidados não usam esta tela.</p>
            ${aviso ? `<p class="erro">${Plataforma.esc(aviso)}</p>` : ''}
            <form id="form-conta" class="formulario cartao">
                <div id="campo-nome">
                    <label for="nome">Nome da família</label>
                    <input id="nome" name="nome" required minlength="2" maxlength="60" autocomplete="organization" placeholder="Família Silva">
                </div>
                <label for="email">E-mail do administrador</label>
                <input id="email" name="email" type="email" required autocomplete="username">
                <label for="senha">Senha</label>
                <input id="senha" name="senha" type="password" required minlength="8" autocomplete="new-password">
                <button class="botao" id="enviar" type="submit">Criar conta</button>
                <button class="botao-sec" id="trocar" type="button">Já tenho conta</button>
                <button class="botao-sec" id="esqueci" type="button">Esqueci a senha</button>
                <p id="erro" class="erro" hidden></p>
            </form>`;
        const form = document.getElementById('form-conta');
        let modo = 'criar';
        const erro = document.getElementById('erro');
        document.getElementById('trocar').addEventListener('click', () => {
            modo = modo === 'criar' ? 'entrar' : 'criar';
            document.getElementById('campo-nome').hidden = modo === 'entrar';
            document.getElementById('nome').required = modo === 'criar';
            document.getElementById('enviar').textContent = modo === 'criar' ? 'Criar conta' : 'Entrar';
            document.getElementById('trocar').textContent = modo === 'criar' ? 'Já tenho conta' : 'Quero criar a conta';
            document.getElementById('senha').autocomplete = modo === 'criar' ? 'new-password' : 'current-password';
        });
        document.getElementById('esqueci').addEventListener('click', async () => {
            const email = document.getElementById('email').value.trim();
            erro.hidden = true;
            if (!email) {
                erro.hidden = false;
                erro.textContent = 'Digite o e-mail para receber o link.';
                return;
            }
            try {
                await firebase.auth().sendPasswordResetEmail(email);
                Plataforma.avisar('Se a conta existir, o e-mail de redefinição foi enviado.');
            } catch (e) {
                erro.hidden = false;
                erro.textContent = Plataforma.erroAmigavel(e);
            }
        });
        form.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            erro.hidden = true;
            const email = document.getElementById('email').value.trim();
            const senha = document.getElementById('senha').value;
            const nome = document.getElementById('nome').value.trim();
            document.getElementById('enviar').disabled = true;
            try {
                if (modo === 'criar') {
                    const cred = await firebase.auth().createUserWithEmailAndPassword(email, senha);
                    await firebase.database().ref('families/' + cred.user.uid + '/meta').set({
                        nome,
                        ownerUid: cred.user.uid,
                        tema: 'padrao',
                        criadaEm: Date.now()
                    });
                    await semear(cred.user.uid);
                } else {
                    await firebase.auth().signInWithEmailAndPassword(email, senha);
                }
            } catch (e) {
                erro.hidden = false;
                erro.textContent = Plataforma.erroAmigavel(e);
            } finally {
                document.getElementById('enviar').disabled = false;
            }
        });
    }

    async function semear(uid) {
        const base = firebase.database().ref('families/' + uid);
        const jaQuiz = await base.child('quiz/perguntas/aquecimento-1').get();
        if (!jaQuiz.exists()) {
            const updates = {};
            PACOTES.aquecimento.forEach((q, i) => {
                updates['aquecimento-' + (i + 1)] = { texto: q.texto, opcoes: q.opcoes, correta: q.correta };
            });
            await base.child('quiz/perguntas').update(updates);
        }
        const jaMusica = await base.child('karaoke/musicas/sugestao-1').get();
        if (!jaMusica.exists()) {
            const updates = {};
            PACOTES.musicas.forEach((m, i) => { updates['sugestao-' + (i + 1)] = m; });
            await base.child('karaoke/musicas').update(updates);
        }
    }

    function desenharInicio() {
        app.innerHTML = cabecalho() + `
            <section class="cartao">
                <label for="nome-familia">Nome da família</label>
                <div class="linha">
                    <input id="nome-familia" maxlength="60" value="${Plataforma.esc(meta.nome)}">
                    <button class="botao-sec" id="salvar-nome" type="button">Salvar</button>
                </div>
                <p class="nota">Tema da casa</p>
                <div class="linha">
                    <button class="botao${meta.tema === 'padrao' ? '' : '-sec'}" id="tema-padrao" type="button">O ano todo</button>
                    <button class="botao${meta.tema === 'natal' ? '' : '-sec'}" id="tema-natal" type="button">Natal</button>
                </div>
            </section>
            <section class="grade" id="grade-jogos"></section>`;
        document.getElementById('sair').addEventListener('click', () => firebase.auth().signOut());
        document.getElementById('salvar-nome').addEventListener('click', async () => {
            const nome = document.getElementById('nome-familia').value.trim();
            if (nome.length < 2) return Plataforma.avisar('O nome precisa ter pelo menos 2 letras.');
            try {
                await firebase.database().ref('families/' + usuario.uid + '/meta').update({ nome });
                meta.nome = nome;
                Plataforma.avisar('Nome salvo.');
            } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
        });
        document.getElementById('tema-padrao').addEventListener('click', () => mudarTema('padrao'));
        document.getElementById('tema-natal').addEventListener('click', () => mudarTema('natal'));
        const grade = document.getElementById('grade-jogos');
        Object.entries(JOGOS).forEach(([id, jogo]) => {
            const card = document.createElement('a');
            card.className = 'cartao';
            card.href = '#/' + id;
            card.innerHTML = `<div class="icone" aria-hidden="true">${jogo.icone}</div><h2>${jogo.nome}</h2><p>${jogo.texto}</p>`;
            grade.appendChild(card);
        });
        const torreCard = document.createElement('article');
        torreCard.className = 'cartao';
        const torreTitle = document.createElement('h2');
        torreTitle.textContent = '🏗️ Torre / Cidade Juntos';
        const torreDescription = document.createElement('p');
        torreDescription.textContent = 'Construam juntos, cada um no seu celular. 1–6 jogadores. Torre, missões e a cidade persistente da família.';
        const torreLink = document.createElement('a');
        torreLink.className = 'botao';
        torreLink.href = 'jogos/torrecidade/jogar.html?criar=1&admin=1&familia=' + encodeURIComponent(usuario.uid);
        torreLink.textContent = 'Abrir nossa construção';
        const torreTv = document.createElement('a');
        torreTv.className = 'botao-sec';
        torreTv.href = 'jogos/torrecidade/tv.html?criar=1&admin=1&familia=' + encodeURIComponent(usuario.uid);
        torreTv.textContent = 'Jogar com TV';
        const agora = document.createElement('p');
        agora.textContent = 'A cidade espera a próxima visita da família.';
        const mundo = firebase.database().ref('familias/' + usuario.uid + '/jogos/torrecidade/mundo');
        const pessoas = {};
        ouvir(mundo.child('jogadores'), (snap) => { Object.assign(pessoas, snap.val() || {}); });
        const presencaFn = mundo.child('online').on('value', (snap) => {
            const online = Object.keys(snap.val() || {}).map((uid) => pessoas[uid]?.nome || 'Alguém da família');
            agora.textContent = online.length ? '🟢 ' + online.slice(0, 3).join(' e ') + ' estão construindo agora' : 'A cidade espera a próxima visita da família.';
        }, () => { agora.textContent = 'Ative as regras do novo jogo para conectar a família.'; });
        ouvintes.push(() => mundo.child('online').off('value', presencaFn));
        torreCard.append(torreTitle, torreDescription, agora, torreLink, torreTv);
        grade.appendChild(torreCard);

    }

    async function mudarTema(tema) {
        try {
            await firebase.database().ref('families/' + usuario.uid + '/meta').update({ tema });
            meta.tema = tema;
            desenhar();
        } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
    }

    function cabecalho() {
        return `<header class="topo-painel"><a class="marca" href="#/">Jogos de Família</a><div class="linha"><strong>${Plataforma.esc(meta.nome)}</strong><button class="botao-sec" id="sair" type="button">Sair</button></div></header>`;
    }

    function desenharJogo(id) {
        app.innerHTML = cabecalho() + `
            <p><a href="#/">← Todos os jogos</a></p>
            <h1>${JOGOS[id].icone} ${JOGOS[id].nome}</h1>
            <div id="editor" class="miolo"></div>
            <section class="miolo">
                ${id === 'capsula' ? '' : '<div class="linha"><button class="botao" id="nova" type="button">Nova partida</button></div>'}
                <div id="partidas" class="lista"></div>
            </section>`;
        document.getElementById('sair').addEventListener('click', () => firebase.auth().signOut());
        document.getElementById('nova')?.addEventListener('click', () => criarPartida(id));
        editores[id](document.getElementById('editor'));
        listarPartidas(id);
    }

    const editores = {
        quiz: editorQuiz,
        capsula: editorCapsula,
        bingo(el) { el.innerHTML = '<p class="nota">Não há cartela para cadastrar. Cada celular recebe a sua quando entra na sala.</p>'; },
        karaoke: editorKaraoke,
        memoria: editorMemoria
    };

    function editorQuiz(el) {
        el.innerHTML = `
            <form id="form-pergunta" class="formulario cartao">
                <h2>Nova pergunta</h2>
                <label for="texto">Pergunta</label>
                <textarea id="texto" required maxlength="280"></textarea>
                ${[0, 1, 2, 3].map((i) => `<label for="op${i}">Alternativa ${i + 1}${i === 0 ? ' (a correta, se não marcar outra)' : ''}</label><input id="op${i}" required maxlength="120">`).join('')}
                <label for="correta">Qual está certa?</label>
                <select id="correta"><option value="0">1</option><option value="1">2</option><option value="2">3</option><option value="3">4</option></select>
                <button class="botao" type="submit">Salvar pergunta</button>
            </form>
            <div class="linha">
                <button class="botao-sec" id="pack-natal" type="button">Trazer perguntas de Natal</button>
            </div>
            <div id="lista-perguntas" class="lista"></div>`;
        el.querySelector('#form-pergunta').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const opcoes = [0, 1, 2, 3].map((i) => document.getElementById('op' + i).value.trim());
            const correta = Number(document.getElementById('correta').value);
            try {
                await firebase.database().ref('families/' + usuario.uid + '/quiz/perguntas').push({
                    texto: document.getElementById('texto').value.trim(),
                    opcoes,
                    correta
                });
                evento.target.reset();
                Plataforma.avisar('Pergunta salva.');
            } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
        });
        el.querySelector('#pack-natal').addEventListener('click', async () => {
            const updates = {};
            PACOTES.natal.forEach((q, i) => { updates['natal-' + (i + 1)] = { texto: q.texto, opcoes: q.opcoes, correta: q.correta }; });
            try {
                await firebase.database().ref('families/' + usuario.uid + '/quiz/perguntas').update(updates);
                Plataforma.avisar('Perguntas de Natal adicionadas. Dá para apagar as que não quiser.');
            } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
        });
        const ref = firebase.database().ref('families/' + usuario.uid + '/quiz/perguntas');
        ouvir(ref, (snap) => {
            const lista = document.getElementById('lista-perguntas');
            if (!lista) return;
            lista.replaceChildren();
            const val = snap.val() || {};
            if (!Object.keys(val).length) {
                lista.innerHTML = '<p class="nota">Nenhuma pergunta ainda.</p>';
                return;
            }
            Object.entries(val).forEach(([id, q]) => {
                const item = document.createElement('article');
                item.className = 'item';
                item.innerHTML = `<div><strong>${Plataforma.esc(q.texto)}</strong><p>Certa: ${Plataforma.esc(q.opcoes?.[q.correta] || '')}</p></div>`;
                const botao = document.createElement('button');
                botao.className = 'botao-perigo';
                botao.type = 'button';
                botao.textContent = 'Apagar';
                botao.addEventListener('click', () => ref.child(id).remove());
                item.appendChild(botao);
                lista.appendChild(item);
            });
        });
    }

    function editorKaraoke(el) {
        el.innerHTML = `
            <form id="form-musica" class="formulario cartao">
                <h2>Música do repertório</h2>
                <label for="titulo">Título</label>
                <input id="titulo" required maxlength="80">
                <label for="artista">Artista</label>
                <input id="artista" maxlength="80">
                <label for="link">Link do YouTube (opcional)</label>
                <input id="link" placeholder="https://">
                <button class="botao" type="submit">Salvar música</button>
            </form>
            <div id="lista-musicas" class="lista"></div>`;
        el.querySelector('#form-musica').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            try {
                await firebase.database().ref('families/' + usuario.uid + '/karaoke/musicas').push({
                    titulo: document.getElementById('titulo').value.trim(),
                    artista: document.getElementById('artista').value.trim(),
                    videoId: Plataforma.videoId(document.getElementById('link').value)
                });
                evento.target.reset();
            } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
        });
        const ref = firebase.database().ref('families/' + usuario.uid + '/karaoke/musicas');
        ouvir(ref, (snap) => {
            const lista = document.getElementById('lista-musicas');
            if (!lista) return;
            lista.replaceChildren();
            Object.entries(snap.val() || {}).forEach(([id, m]) => {
                const item = document.createElement('article');
                item.className = 'item';
                item.innerHTML = `<div><strong>${Plataforma.esc(m.titulo)}</strong><p>${Plataforma.esc(m.artista || 'Sem artista')}${m.videoId ? ' · com vídeo' : ''}</p></div>`;
                const botao = document.createElement('button');
                botao.className = 'botao-perigo';
                botao.type = 'button';
                botao.textContent = 'Apagar';
                botao.addEventListener('click', () => ref.child(id).remove());
                item.appendChild(botao);
                lista.appendChild(item);
            });
        });
    }

    function editorMemoria(el) {
        el.innerHTML = `
            <form id="form-foto" class="formulario cartao">
                <h2>Fotos da casa</h2>
                <p>Opcional. Sem fotos, a partida usa emojis. Com 6 fotos ou mais, dá para jogar com elas.</p>
                <label for="foto">Foto</label>
                <input id="foto" type="file" accept="image/*">
                <button class="botao" type="submit">Guardar foto</button>
            </form>
            <div id="lista-fotos" class="lista"></div>`;
        el.querySelector('#form-foto').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const arquivo = document.getElementById('foto').files[0];
            if (!arquivo) return;
            try {
                const imagem = await Plataforma.comprimirFoto(arquivo, 110000);
                await firebase.database().ref('families/' + usuario.uid + '/memoria/fotos').push({ imagem });
                evento.target.reset();
            } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
        });
        const ref = firebase.database().ref('families/' + usuario.uid + '/memoria/fotos');
        ouvir(ref, (snap) => {
            const lista = document.getElementById('lista-fotos');
            if (!lista) return;
            lista.replaceChildren();
            const fotos = snap.val() || {};
            if (!Object.keys(fotos).length) {
                lista.innerHTML = '<p class="nota">Nenhuma foto ainda. A partida de emoji funciona mesmo assim.</p>';
                return;
            }
            Object.entries(fotos).forEach(([id, foto]) => {
                const item = document.createElement('article');
                item.className = 'item';
                const img = document.createElement('img');
                img.alt = 'Foto da família';
                img.src = String(foto.imagem || '');
                img.style.maxWidth = '96px';
                img.style.borderRadius = '12px';
                const botao = document.createElement('button');
                botao.className = 'botao-perigo';
                botao.type = 'button';
                botao.textContent = 'Apagar';
                botao.addEventListener('click', () => ref.child(id).remove());
                item.append(img, botao);
                lista.appendChild(item);
            });
        });
    }

    function editorCapsula(el) {
        const ano = new Date().getFullYear();
        el.innerHTML = `
            <form id="form-capsula" class="formulario cartao">
                <h2>Nova cápsula</h2>
                <label for="titulo-capsula">Título</label>
                <input id="titulo-capsula" required maxlength="80" value="Cápsula da família">
                <label for="abre">Abre em</label>
                <input id="abre" type="datetime-local" required>
                <div class="linha">
                    <button class="botao" type="submit">Criar cápsula</button>
                    <button class="botao-sec" id="modelo-ano" type="button">Fim de ano</button>
                    <button class="botao-sec" id="modelo-natal" type="button">Natal</button>
                </div>
            </form>
            <p class="nota">A carta fica ilegível para todo mundo, inclusive para esta conta, até a data. O horário é o deste aparelho.</p>`;
        const abre = document.getElementById('abre');
        document.getElementById('modelo-ano').addEventListener('click', () => {
            document.getElementById('titulo-capsula').value = 'Cápsula de fim de ano';
            abre.value = ano + '-12-31T18:00';
        });
        document.getElementById('modelo-natal').addEventListener('click', () => {
            document.getElementById('titulo-capsula').value = 'Cápsula de Natal';
            abre.value = ano + '-12-25T18:00';
        });
        el.querySelector('#form-capsula').addEventListener('submit', async (evento) => {
            evento.preventDefault();
            const titulo = document.getElementById('titulo-capsula').value.trim();
            const ms = new Date(abre.value).getTime();
            if (!Number.isFinite(ms)) return Plataforma.avisar('Escolha a data de abertura.');
            await criarCapsula(titulo, ms);
        });
    }

    async function criarCapsula(titulo, abreEm) {
        const eid = firebase.database().ref().push().key;
        const code = Plataforma.codigo();
        try {
            await firebase.database().ref().update({
                ['families/' + usuario.uid + '/capsula/indice/' + eid]: { titulo, abreEm, criadaEm: Date.now(), codigo: code },
                ['families/' + usuario.uid + '/capsula/eventos/' + eid + '/publico']: { titulo, abreEm },
                ['codigos/' + code]: { familia: usuario.uid, jogo: 'capsula', partida: eid }
            });
            Plataforma.avisar('Cápsula criada. Abra na lista abaixo.');
        } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
    }

    function listarPartidas(id) {
        if (id === 'capsula') {
            listarCapsulas();
            return;
        }
        const ref = firebase.database().ref('families/' + usuario.uid + '/' + id + '/partidas');
        ouvir(ref, (snap) => {
            const lista = document.getElementById('partidas');
            if (!lista) return;
            lista.replaceChildren();
            const val = snap.val() || {};
            const entradas = Object.entries(val);
            if (!entradas.length) {
                lista.innerHTML = '<p class="nota">Nenhuma partida ainda.</p>';
                return;
            }
            entradas.reverse().forEach(([pid, partida]) => {
                const status = partida.status || partida.publico?.status || 'lobby';
                const nome = partida.nome || partida.publico?.nome || JOGOS[id].nome;
                const item = document.createElement('article');
                item.className = 'item';
                item.innerHTML = `<div><strong>${Plataforma.esc(nome)}</strong><p>${Plataforma.esc(rotuloStatus(status))}${partida.codigo ? ' · código ' + Plataforma.esc(partida.codigo) : ''}</p></div>`;
                const acoes = document.createElement('div');
                acoes.className = 'linha';
                const abrir = document.createElement('a');
                abrir.className = 'botao';
                abrir.textContent = 'Abrir na TV';
                abrir.href = 'jogos/' + id + '/tv.html?familia=' + encodeURIComponent(usuario.uid) + '&partida=' + encodeURIComponent(pid);
                abrir.target = '_blank';
                abrir.rel = 'noopener';
                const fim = document.createElement('button');
                fim.className = 'botao-perigo';
                fim.type = 'button';
                fim.textContent = 'Encerrar';
                fim.addEventListener('click', () => encerrar(id, pid, partida));
                acoes.append(abrir, fim);
                item.appendChild(acoes);
                lista.appendChild(item);
            });
        });
    }

    function listarCapsulas() {
        const ref = firebase.database().ref('families/' + usuario.uid + '/capsula/indice');
        ouvir(ref, (snap) => {
            const lista = document.getElementById('partidas');
            if (!lista) return;
            lista.replaceChildren();
            const entradas = Object.entries(snap.val() || {});
            if (!entradas.length) {
                lista.innerHTML = '<p class="nota">Nenhuma cápsula ainda. Use o formulário acima.</p>';
                return;
            }
            entradas.reverse().forEach(([eid, evento]) => {
                const item = document.createElement('article');
                item.className = 'item';
                const quando = new Date(evento.abreEm).toLocaleString('pt-BR');
                item.innerHTML = `<div><strong>${Plataforma.esc(evento.titulo)}</strong><p>Abre em ${Plataforma.esc(quando)}${evento.codigo ? ' · código ' + Plataforma.esc(evento.codigo) : ''}</p></div>`;
                const acoes = document.createElement('div');
                acoes.className = 'linha';
                const abrir = document.createElement('a');
                abrir.className = 'botao';
                abrir.textContent = 'Abrir na TV';
                abrir.target = '_blank';
                abrir.rel = 'noopener';
                abrir.href = 'jogos/capsula/tv.html?familia=' + encodeURIComponent(usuario.uid) + '&partida=' + encodeURIComponent(eid);
                const apagar = document.createElement('button');
                apagar.className = 'botao-perigo';
                apagar.type = 'button';
                apagar.textContent = 'Apagar';
                apagar.addEventListener('click', async () => {
                    try {
                        const updates = {};
                        updates['families/' + usuario.uid + '/capsula/indice/' + eid] = null;
                        updates['families/' + usuario.uid + '/capsula/eventos/' + eid] = null;
                        if (evento.codigo) updates['codigos/' + evento.codigo] = null;
                        await firebase.database().ref().update(updates);
                    } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
                });
                acoes.append(abrir, apagar);
                item.appendChild(acoes);
                lista.appendChild(item);
            });
        });
    }

    function rotuloStatus(status) {
        return { lobby: 'Na sala de espera', pergunta: 'Pergunta no ar', revelada: 'Resposta revelada', fim: 'Encerrada', jogando: 'Em jogo', show: 'Show no ar' }[status] || status;
    }

    async function criarPartida(id) {
        if (id === 'capsula') {
            Plataforma.avisar('A cápsula é criada pelo formulário, com a data de abertura.');
            return;
        }
        const code = Plataforma.codigo();
        const base = firebase.database().ref('families/' + usuario.uid + '/' + id);
        try {
            if (id === 'quiz') {
                const perguntas = (await base.child('perguntas').get()).val() || {};
                const ids = Object.keys(perguntas);
                if (!ids.length) return Plataforma.avisar('Cadastre ao menos uma pergunta.');
                const ref = base.child('partidas').push();
                const ordem = Plataforma.embaralhar(ids);
                await ref.set({
                    nome: 'Quiz da família',
                    tema: meta.tema,
                    status: 'lobby',
                    criadaEm: Date.now(),
                    segundos: 60,
                    rodada: 0,
                    indice: -1,
                    total: Math.min(ordem.length, 10),
                    ordem,
                    codigo: code
                });
                await firebase.database().ref('codigos/' + code).set({ familia: usuario.uid, jogo: 'quiz', partida: ref.key });
            } else if (id === 'bingo') {
                const ref = base.child('partidas').push();
                await ref.set({
                    codigo: code,
                    publico: { nome: 'Bingo da família', tema: meta.tema, status: 'lobby', premio: 'Aplausos da casa', bolas: {}, numeroAtual: 0 }
                });
                await firebase.database().ref('codigos/' + code).set({ familia: usuario.uid, jogo: 'bingo', partida: ref.key });
            } else if (id === 'karaoke') {
                const musicas = (await base.child('musicas').get()).val() || {};
                const ref = base.child('partidas').push();
                await ref.set({
                    nome: 'Karaokê da família',
                    tema: meta.tema,
                    status: 'lobby',
                    fase: 'espera',
                    codigo: code,
                    repertorio: musicas,
                    placar: {}
                });
                await firebase.database().ref('codigos/' + code).set({ familia: usuario.uid, jogo: 'karaoke', partida: ref.key });
            } else if (id === 'memoria') {
                const fotos = (await base.child('fotos').get()).val() || {};
                const idsFotos = Object.keys(fotos);
                const usarFotos = idsFotos.length >= 6;
                const pares = usarFotos ? Plataforma.embaralhar(idsFotos).slice(0, 8) : PACOTES.emojis.slice(0, 8);
                const cartas = [];
                pares.forEach((par, indice) => {
                    const rotulo = usarFotos ? fotos[par].imagem : par;
                    cartas.push({ par: String(indice), rotulo }, { par: String(indice), rotulo });
                });
                const ref = base.child('partidas').push();
                await ref.set({
                    codigo: code,
                    segredo: Plataforma.embaralhar(cartas),
                    publico: {
                        nome: usarFotos ? 'Memória das fotos' : 'Memória de emoji',
                        tema: meta.tema,
                        status: 'lobby',
                        pares: pares.length,
                        vezUid: '',
                        prazo: 0
                    }
                });
                await firebase.database().ref('codigos/' + code).set({ familia: usuario.uid, jogo: 'memoria', partida: ref.key });
            }
            Plataforma.avisar('Partida criada. Abra na TV para mostrar o QR Code.');
        } catch (e) {
            Plataforma.avisar(Plataforma.erroAmigavel(e));
        }
    }

    async function encerrar(id, pid, partida) {
        const codigo = partida.codigo || partida.publico?.codigo;
        try {
            const refPartida = firebase.database().ref('families/' + usuario.uid + '/' + id + '/partidas/' + pid);
            if (id === 'bingo' || id === 'memoria') await refPartida.child('publico').update({ status: 'fim' });
            else await refPartida.update({ status: 'fim' });
            if (codigo) await firebase.database().ref('codigos/' + codigo).remove();
        } catch (e) { Plataforma.avisar(Plataforma.erroAmigavel(e)); }
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        usuario = user && !user.isAnonymous ? user : null;
        meta = null;
        if (!usuario || !window.JogosFirebase?.podeConectar) {
            desenhar();
            return;
        }
        try {
            for (let i = 0; i < 8 && !meta; i += 1) {
                meta = (await firebase.database().ref('families/' + usuario.uid + '/meta').get()).val();
                if (!meta) await new Promise((resolve) => setTimeout(resolve, 250));
            }
        } catch (e) {
            Plataforma.avisar(Plataforma.erroAmigavel(e));
        }
        desenhar();
    });

    window.addEventListener('hashchange', () => { if (usuario && meta) desenhar(); });
    if (!window.firebase) desenhar();
})();
