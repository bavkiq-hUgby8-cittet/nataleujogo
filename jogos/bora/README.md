# Bora! — Party Arcade

Coleção independente de minigames para 1–6 pessoas. O Torre/Cidade continua em `../torrecidade/`, com suas salas e mundo preservados. O nome Bora! é provisório; personagens, cenários e regras são próprios.

## Jogar

- **Jogar agora** começa uma sequência de quatro jogos, sem cadastro, com três participantes controlados pela máquina.
- Os cards iniciam um minigame avulso. Mover + A + B; no teclado, WASD/setas, espaço e Shift.
- **Chamar a turma** cria uma sala online. O anfitrião usa a conta da família; convidados entram pelo QR/link privado e informam apenas o nome. A máquina é substituída por quem entra e assume quem sai. Limite de seis humanos; participantes adicionais assistem.
- Neon Rush: três ondas de drones e um chefe, ataque, super e resgate de companheiros. Glitch: piso que desaparece, salto, impulso e retorno após queda. Turbo Loop: corrida com obstáculos, salto e turbo. Snack Clash: duas equipes coletam e entregam lanches.
- Partidas locais não são compartilhadas entre celulares. Para jogar online, crie uma sala. O botão de som depende de toque e começa desligado. Não há anúncios, compras ou chat.

## Arquitetura

HTML/CSS/ES Modules sem build; Canvas 2D com personagens desenhados por código. Esta direção prioriza ação simples e carregamento leve, sem prometer os efeitos 3D do projeto de construção. Simulação pura a 30 Hz, render por animation frame; máquinas determinísticas. Apenas o anfitrião simula no online. Inputs pequenos (eixos e contadores de A/B), presença por conexão, eleição por transação com epoch, snapshots e checkpoint. Pontos são calculados uma vez por rodada pelo host, nunca enviados pelo jogador. O total da festa fica no snapshot da sala; não há ranking público persistente.

Backend em `familias/{id}/jogos/bora/salas/{codigo}`. Compartilha **somente** a configuração, o SDK modular vendorizado e o transporte genérico de Torre/Cidade. A tela da conta recebe `?festa=1` para retornar ao Bora!. Não reutiliza nem converte salas de construção. O projeto Firebase continua no plano Spark, sem cobrança habilitada.

Para adicionar minigames, estenda o catálogo e a simulação em `js/festa/engine.js`, o desenho em `render.js`, instruções/controles e testes de conclusão determinística. Mantenha a mesma estrutura de sala, sem criar um backend por minigame.

## Desenvolvimento e testes

A partir da raiz do repositório: `python3 -m http.server 8765`; abra `/jogos/bora/`. `?demo&seed=1` inicia uma festa local; `?rapido` encurta partidas locais para testes. Não reduz partidas online.

```sh
node --test jogos/bora/tests/*.test.mjs
cd jogos/torrecidade && npm ci && npx playwright install chromium
cd ../bora
../torrecidade/node_modules/.bin/firebase emulators:exec --only auth,database --project demo-jogos-familia 'node --test tests/regras.mjs && ../torrecidade/node_modules/.bin/playwright test'
```

O emulator local usa `jogos/bora/database.rules.json`, isolado. Em produção publique **database.rules.json da raiz**, que preserva Torre/Cidade e acrescenta Bora!. Nunca publique o arquivo isolado por cima das regras de produção. Auth anônimo e e-mail/senha já são compartilhados com a plataforma.

## Validação desta versão

14 testes unitários, 7 testes de regras e 6 E2E passaram localmente. Os E2E cobrem os quatro jogos com CPU, festa completa, joystick/botões, 360px, três celulares online, entrada no meio da fase, saída do anfitrião, migração e substituição por CPU. O teste também verifica que a página original Torre/Cidade continua funcionando. Capturas e vídeos ficam no artefato `bora-evidencias` do workflow.

Não estão certificados: 300ms com perda de pacotes, orçamento de rede em escala, Android físico de entrada, migração após fechamento abrupto em todos os navegadores e equilíbrio de dificuldade com crianças/avós. Os snapshots remotos ainda usam renderização direta a aproximadamente 10 Hz; interpolação e medição de tráfego são próximos passos. O limite do projeto Spark é compartilhado; acompanhar conexões e tráfego antes de divulgação ampla. A restrição HTTP referrer da chave web continua pendente do projeto anterior; Auth e regras já isolam as salas por convite/uid.

## Publicação

GitHub Pages na pasta `jogos/bora/`, separado de Torre/Cidade. Portal recebe um card novo; nenhum outro jogo é substituído. Esta é uma versão inicial para testar a direção de jogo, não uma implementação de todos os requisitos do antigo briefing de construção.

A primeira execução no GitHub detectou um input antes da confirmação da presença/fora do intervalo mínimo. O transporte agora aguarda a presença e usa um único limitador para blur e envio periódico; três testes unitários cobrem essa regressão. As asserções de console limpo foram mantidas.
