# Jogos de Família

Plataforma estática para qualquer família. Uma conta de administrador comanda o quiz, a cápsula do tempo, o bingo, o karaokê e o jogo da memória. Quem está na sala entra pelo QR Code ou por um código de 8 caracteres, só com o nome e uma foto opcional. Não há cadastro de convidado.

O Natal é um tema opcional (cores, perguntas de Natal e cápsula de fim de ano). Não é o produto.

Os sites antigos da família Veloso, em outros repositórios, continuam como estão. Este projeto não mexe neles nem nos projetos Firebase `karaoke-46db0`, `quiz-dos-veloso`, `capsuladotempo-f86bf`, `bingo-16f47` e `jogodamemoria-61432`. A cápsula antiga, que abre em 25/12/2026, permanece no endereço de sempre.

## Por que esta arquitetura

O site é HTML, CSS e JavaScript puros. Dá para publicar no GitHub Pages sem servidor de aplicação.

O tempo real fica num único projeto Firebase, no plano gratuito:

- **Authentication**: e-mail e senha para o administrador; login anônimo para o convidado, só para as regras saberem quem é quem. O convidado não vê tela de conta.
- **Realtime Database**: os jogos já nasceram nesse modelo (sala, presença, resposta na hora). Um banco só, com tudo embaixo de `families/{familyId}`. O `familyId` é o uid da conta da família.
- Sem Cloud Functions, sem Firestore e sem Storage. Fotos pequenas viram JPEG comprimido dentro do banco, com limite nas regras. Isso reduz o que é preciso ligar no console.

As regras em `database.rules.json` são o isolamento de verdade:

- Só a conta da família edita cadastro, perguntas, músicas, fotos e o estado da TV.
- Convidado não lista partidas. Precisa do link ou do código.
- No quiz, o convidado não lê o banco de perguntas nem o gabarito. Só vê a pergunta que a TV publicou e grava a própria resposta, uma vez, enquanto a pergunta está aberta. O relógio da TV é um aviso: a resposta continua valendo até todo mundo da sala responder ou até o operador revelar. O convidado não mexe na pontuação.
- No bingo, cada um lê só a própria cartela. A TV confere a linha.
- Na cápsula, a carta fica ilegível para todo mundo, inclusive para o administrador, até `abreEm`.
- Na memória, as cartas viradas para baixo não vão para o celular. A TV (conta da família) resolve o par.

## O que ficou de fora nesta versão

**O Poder do Dedo** não entra. É jogo de cartas com bebida, marcado para maiores de 18 anos. Numa plataforma cujo padrão é a casa inteira, ele não deve aparecer ao lado do bingo. O site antigo continua no ar para quem já o usava.

Também não vieram, de propósito, estes enfeites dos jogos antigos: o globo animado e as reações do bingo, a busca na API do YouTube (a chave antiga não foi copiada; cola-se o link ou escolhe-se do repertório, sem letra de música) e o tabuleiro de 18 pares com Firebase Storage. O miolo jogável está aqui.

## Como o Ramon publica

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com). O plano Spark (grátis) basta.
2. Em **Build → Authentication → Sign-in method**, ative **E-mail/senha** e **Anônimo**.
3. Em **Build → Realtime Database**, crie o banco. Pode começar no modo bloqueado.
4. Na aba **Regras** desse banco, cole o conteúdo de `database.rules.json` e publique.
5. Em **Authentication → Settings → Authorized domains**, inclua o domínio do GitHub Pages (algo como `seu-usuario.github.io`).
6. Em **Project settings → Your apps**, crie um app Web e copie a configuração para `js/firebase-config.js`:

```js
window.JOGOS_FIREBASE = {
    apiKey: 'AQUI',
    authDomain: 'SEU-PROJETO.firebaseapp.com',
    databaseURL: 'https://SEU-PROJETO-default-rtdb.firebaseio.com',
    projectId: 'SEU-PROJETO',
    emuladorAutomatico: false
};
```

7. Publique a pasta no GitHub Pages (branch desta pasta, pasta raiz). Abra `https://….github.io/nataleujogo/`, crie a conta da família e uma partida. A TV precisa abrir esse endereço publicado: o QR aponta para o mesmo site, e o celular dos parentes alcança.

O e-mail de “esqueci a senha” usa o envio padrão do Firebase. No plano gratuito há cota; se não chegar, veja o spam ou o modelo em Authentication → Templates.

Não apague os projetos Firebase antigos.

## Experimentar neste computador

É preciso Node.js e Java (o emulador do Realtime Database usa Java).

```bash
npm install
npx firebase emulators:exec --only auth,database "node tests/regras.mjs"
```

Para clicar no navegador, em dois terminais:

```bash
npx firebase emulators:start --only auth,database
python3 -m http.server 8765
```

Abra `http://127.0.0.1:8765`. Em localhost as chaves `demo-` falam com o emulador. O QR gerado aponta para o seu computador; o celular da sala só entra de verdade depois da publicação do passo 7.
