const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const DB = 'http://127.0.0.1:9000';
const CHAVE = 'demo-jogos-familia';
const NS = 'demo-jogos-familia-default-rtdb';

const falhas = [];

function assert(condicao, mensagem, extra) {
    if (!condicao) {
        falhas.push(mensagem);
        console.error('FALHOU', mensagem, extra ? JSON.stringify(extra).slice(0, 400) : '');
    } else console.log('ok', mensagem);
}

async function conta(corpo) {
    const res = await fetch(AUTH + '/accounts:signUp?key=' + CHAVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...corpo, returnSecureToken: true })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(json));
    return json;
}

async function db(method, path, token, body) {
    const url = new URL(DB + '/' + path + '.json');
    url.searchParams.set('ns', NS);
    if (token) url.searchParams.set('auth', token);
    const res = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const texto = await res.text();
    let json = texto;
    try { json = JSON.parse(texto); } catch (e) { /* texto puro */ }
    return { status: res.status, json };
}

const negado = (res) => {
    const ok = res.status === 401 || res.status === 403;
    if (!ok) console.error('esperava negação', res.status, JSON.stringify(res.json).slice(0, 350));
    return ok;
};

const familia = await conta({ email: `casa.${Date.now()}@exemplo.com`, password: 'senha-teste-123' });
const outra = await conta({ email: `outra.${Date.now()}@exemplo.com`, password: 'senha-teste-123' });
const convidado = await conta({});
const uid = familia.localId;
const token = familia.idToken;
const tokenB = outra.idToken;
const tokenC = convidado.idToken;

const meta = await db('PUT', `families/${uid}/meta`, token, {
    nome: 'Família Teste',
    ownerUid: uid,
    tema: 'padrao',
    criadaEm: Date.now()
});
assert(meta.status === 200, 'administrador grava a própria família');

const metaAnon = await db('PUT', `families/${convidado.localId}/meta`, tokenC, {
    nome: 'Visitante',
    ownerUid: convidado.localId,
    tema: 'padrao',
    criadaEm: Date.now()
});
assert(negado(metaAnon), 'convidado anônimo não cria família', metaAnon);

const leituraAlheia = await db('GET', `families/${uid}/meta`, tokenB);
assert(negado(leituraAlheia), 'outra família não lê o cadastro', leituraAlheia);

const pergunta = await db('PUT', `families/${uid}/quiz/perguntas/p1`, token, {
    texto: 'Capital do Brasil?',
    opcoes: ['São Paulo', 'Brasília', 'Recife', 'Manaus'],
    correta: 1
});
assert(pergunta.status === 200, 'administrador grava pergunta');

const perguntaConvidado = await db('GET', `families/${uid}/quiz/perguntas/p1`, tokenC);
assert(negado(perguntaConvidado), 'convidado não lê o banco de perguntas');

const agora = Date.now();
const partida = await db('PUT', `families/${uid}/quiz/partidas/sala1`, token, {
    nome: 'Quiz',
    tema: 'padrao',
    status: 'lobby',
    criadaEm: agora,
    segundos: 20,
    rodada: 0,
    indice: -1,
    total: 1,
    codigo: 'TESTQUIZ'
});
assert(partida.status === 200, 'administrador cria a partida');

const lista = await db('GET', `families/${uid}/quiz/partidas`, tokenC);
assert(negado(lista), 'convidado não lista as partidas da casa');

const entra = await db('PUT', `families/${uid}/quiz/partidas/sala1/jogadores/${convidado.localId}`, tokenC, {
    nome: 'Bia',
    foto: '',
    pontos: 0,
    entrouEm: agora
});
assert(entra.status === 200, 'convidado entra só com o nome');

const trapaça = await db('PATCH', `families/${uid}/quiz/partidas/sala1/jogadores/${convidado.localId}`, tokenC, { pontos: 999 });
assert(negado(trapaça), 'convidado não altera a própria pontuação');

const status = await db('PUT', `families/${uid}/quiz/partidas/sala1/status`, token, 'pergunta');
await db('PUT', `families/${uid}/quiz/partidas/sala1/rodada`, token, 1);
await db('PUT', `families/${uid}/quiz/partidas/sala1/encerraEm`, token, agora + 60000);
const resposta = await db('PUT', `families/${uid}/quiz/partidas/sala1/respostas/1/${convidado.localId}`, tokenC, 1);
assert(resposta.status === 200, 'convidado grava a resposta da rodada');

const segunda = await db('PUT', `families/${uid}/quiz/partidas/sala1/respostas/1/${convidado.localId}`, tokenC, 0);
assert(negado(segunda), 'convidado não troca a resposta');

const gabarito = await db('PUT', `families/${uid}/quiz/gabaritos/sala1`, token, 1);
assert(gabarito.status === 200, 'administrador guarda o gabarito');
const verGabarito = await db('GET', `families/${uid}/quiz/gabaritos/sala1`, tokenC);
assert(negado(verGabarito), 'convidado não lê o gabarito');

const pontos = await db('PUT', `families/${uid}/quiz/partidas/sala1/jogadores/${convidado.localId}/pontos`, token, 10);
assert(pontos.status === 200, 'administrador atualiza o placar');

const abreFuturo = agora + 86400000;
const abrePassado = agora - 60000;
await db('PUT', `families/${uid}/capsula/eventos/evt/publico`, token, { titulo: 'Cápsula', abreEm: abreFuturo });
const carta = await db('PUT', `families/${uid}/capsula/eventos/evt/segredos/${convidado.localId}`, tokenC, {
    texto: 'Segredo da Bia',
    foto: ''
});
const nomeCarta = await db('PUT', `families/${uid}/capsula/eventos/evt/nomes/${convidado.localId}`, tokenC, 'Bia');
assert(carta.status === 200 && nomeCarta.status === 200, 'convidado lacra uma carta antes da data');
const cedo = await db('GET', `families/${uid}/capsula/eventos/evt/segredos/${convidado.localId}`, tokenC);
assert(negado(cedo), 'ninguém lê a carta antes da hora');
const adminCedo = await db('GET', `families/${uid}/capsula/eventos/evt/segredos/${convidado.localId}`, token);
assert(negado(adminCedo), 'nem o administrador lê a carta antes da hora');
await db('PATCH', `families/${uid}/capsula/eventos/evt/publico`, token, { abreEm: abrePassado });
const aberta = await db('GET', `families/${uid}/capsula/eventos/evt/segredos/${convidado.localId}`, tokenC);
assert(aberta.status === 200 && aberta.json?.texto === 'Segredo da Bia', 'a carta abre depois da data');

await db('PUT', `families/${uid}/bingo/partidas/b1/publico`, token, { status: 'lobby', nome: 'Bingo' });
const cartela = await db('PUT', `families/${uid}/bingo/partidas/b1/cartelas/${convidado.localId}`, tokenC, '1,16,31,46,61,2,17,32,47,62,3,18,0,48,63,4,19,33,49,64,5,20,34,50,65');
assert(cartela.status === 200, 'convidado recebe a própria cartela');
const outraCartela = await db('GET', `families/${uid}/bingo/partidas/b1/cartelas/${convidado.localId}`, tokenB);
assert(negado(outraCartela), 'outra conta não lê a cartela');
const donoVe = await db('GET', `families/${uid}/bingo/partidas/b1/cartelas/${convidado.localId}`, token);
assert(donoVe.status === 200, 'administrador confere a cartela');
const troca = await db('PUT', `families/${uid}/bingo/partidas/b1/cartelas/${convidado.localId}`, tokenC, '1,2,3');
assert(negado(troca), 'convidado não reescreve a cartela');

if (falhas.length) {
    console.error('\nFalhas:\n- ' + falhas.join('\n- '));
    process.exit(1);
}
console.log('\nTodas as regras conferidas.');
