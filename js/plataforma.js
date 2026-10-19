(function (global) {
    function raiz() {
        const meta = document.querySelector('meta[name="jogos-raiz"]');
        return meta ? meta.content : '';
    }

    function esc(valor) {
        return String(valor ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function consulta() {
        return Object.fromEntries(new URLSearchParams(global.location.search));
    }

    function codigo() {
        const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const bytes = new Uint8Array(8);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
    }

    function embaralhar(lista) {
        const arr = [...lista];
        for (let i = arr.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function videoId(entrada) {
        const texto = String(entrada || '').trim();
        if (/^[\w-]{11}$/.test(texto)) return texto;
        try {
            const url = new URL(texto);
            const host = url.hostname.replace(/^www\./, '');
            if (host === 'youtu.be') {
                const id = (url.pathname.split('/').filter(Boolean)[0] || '').split('?')[0];
                return /^[\w-]{11}$/.test(id) ? id : '';
            }
            if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
                const v = url.searchParams.get('v') || '';
                if (/^[\w-]{11}$/.test(v)) return v;
            }
        } catch (e) {
            return '';
        }
        return '';
    }

    function erroAmigavel(erro) {
        const code = String(erro?.code || '');
        const msg = String(erro?.message || erro || '');
        if (code.includes('email-already-in-use')) return 'Já existe uma conta com este e-mail.';
        if (code.includes('invalid-email')) return 'Digite um e-mail válido.';
        if (code.includes('weak-password')) return 'A senha precisa ter pelo menos 6 caracteres.';
        if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
            return 'E-mail ou senha não conferem.';
        }
        if (code.includes('permission') || /permission/i.test(msg)) {
            return 'O Firebase recusou esta ação. Confira se as regras do Realtime Database foram publicadas.';
        }
        if (/network|offline|failed to fetch/i.test(code + msg)) return 'Sem conexão com o Firebase. Confira a internet.';
        return 'Não foi possível concluir. ' + msg;
    }

    function avisar(mensagem) {
        let el = document.getElementById('aviso-flutuante');
        if (!el) {
            el = document.createElement('div');
            el.id = 'aviso-flutuante';
            el.className = 'aviso';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.textContent = mensagem;
        el.classList.add('visivel');
        clearTimeout(avisar._t);
        avisar._t = setTimeout(() => el.classList.remove('visivel'), 4600);
    }

    function aplicarTema(tema) {
        document.body.classList.toggle('tema-natal', tema === 'natal');
    }

    function nomeGuardado() {
        try { return localStorage.getItem('jogos-nome') || ''; } catch (e) { return ''; }
    }

    function guardarNome(nome) {
        try { localStorage.setItem('jogos-nome', nome); } catch (e) { /* navegador privado */ }
    }

    function desenharQr(elemento, texto) {
        elemento.replaceChildren();
        elemento.dataset.link = texto;
        if (typeof global.QRCode !== 'function') {
            elemento.textContent = texto;
            return;
        }
        new global.QRCode(elemento, {
            text: texto,
            width: 220,
            height: 220,
            correctLevel: global.QRCode.CorrectLevel.M
        });
    }

    function urlAbsoluta(relativo) {
        return new URL(relativo, global.location.href).href;
    }

    async function comprimirFoto(arquivo, limite) {
        const teto = limite || 85000;
        if (!arquivo) return '';
        if (!arquivo.type || !arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
        const bitmap = await createImageBitmap(arquivo);
        const max = teto > 100000 ? 520 : 360;
        const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        const largura = Math.max(1, Math.round(bitmap.width * escala));
        const altura = Math.max(1, Math.round(bitmap.height * escala));
        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        canvas.getContext('2d').drawImage(bitmap, 0, 0, largura, altura);
        bitmap.close?.();
        let qualidade = 0.72;
        let data = canvas.toDataURL('image/jpeg', qualidade);
        while (data.length > teto && qualidade > 0.42) {
            qualidade -= 0.08;
            data = canvas.toDataURL('image/jpeg', qualidade);
        }
        if (data.length > teto + 4000) throw new Error('Essa foto ficou grande demais. Tente outra mais simples.');
        return data;
    }

    function banco() {
        return global.JogosFirebase?.db || firebase.database();
    }

    async function entrarConvidado() {
        const auth = global.JogosFirebase?.auth || firebase.auth();
        if (!auth.currentUser) await auth.signInAnonymously();
        return auth.currentUser;
    }

    async function exigirAdmin(familia) {
        const user = await new Promise((resolve) => {
            const parar = firebase.auth().onAuthStateChanged((atual) => {
                parar();
                resolve(atual || null);
            });
        });
        if (!user || user.isAnonymous || user.uid !== familia) {
            const destino = new URL(raiz() + 'painel.html', global.location.href);
            destino.searchParams.set('aviso', 'Entre com a conta da família para abrir a TV.');
            global.location.replace(destino.href);
            return null;
        }
        return user;
    }

    function refFamilia(familia) {
        return firebase.database().ref('families/' + familia);
    }

    global.Plataforma = {
        raiz,
        esc,
        consulta,
        codigo,
        embaralhar,
        videoId,
        erroAmigavel,
        avisar,
        aplicarTema,
        nomeGuardado,
        guardarNome,
        desenharQr,
        urlAbsoluta,
        comprimirFoto,
        entrarConvidado,
        exigirAdmin,
        refFamilia,
        banco
    };
})(window);
