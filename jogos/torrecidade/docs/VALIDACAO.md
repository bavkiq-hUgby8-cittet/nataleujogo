# Validação — 25/10/2026

## Resultados executados

- 17 testes unitários passaram: papéis 1–6, rebalanceamento com peça em mãos, sequência idempotente, limites e permissão de papel, eleição, quaternion, interpolação, zonas, vidas, vitória e física determinística.
- 8 cenários de regras passaram no Auth + RTDB Emulator: isolamento, convite, nome/tipos, UID, somente host, lease, rate limit, epoch antigo e reset restrito.
- 23 cenários Playwright exercitados em rodadas, todos passaram na última execução correspondente: 5 remotos/persistência/bairros, 3 TV/Torre/admin, 3 rede, 4 performance e 8 comparações visuais. A rodada de integração passou 10/10 e a verificação adicional de TV/admin passou 2/2, incluindo criar/reabrir o mundo e o recorde da família; performance e visuais haviam passado na rodada completa anterior.
- 3 celulares completaram Missão Cidade e Torre. Depois da saída de dois, o último virou host e concluiu sozinho. Duas TVs compartilharam a sala com só uma instância de física e uma vitória no placar.
- Fechamento abrupto da última aba e reabertura por outra identidade preservaram peças e linha do tempo. O teste não esperou literalmente um dia nem avançou o relógio em 24 h; atesta persistência após fechar/reabrir.
- Um bairro foi desbloqueado por 12 peças, descarregado, visitado novamente e comparado pelos IDs das peças.
- O perfil CDP de 150/300 ms testou reconexão. Um teste separado interceptou mensagens WebSocket, aplicando 150 ms em cada sentido, jitter e atraso de retransmissão em cada vigésima mensagem. Isso simula o efeito de 5% de retransmissão, não perda real de pacotes IP/TCP.
- Console sem erros inesperados nos cenários de jogo. Erro de conexão WebSocket durante desconexão forçada é esperado e verificado separadamente.
- O pacote inicial medido por gzip foi 379.644 bytes; física lazy adiciona 75.119 bytes. Isso mede os arquivos, não o tempo real de download em uma operadora 4G.

## Performance observada

Chromium com SwiftShader, viewport 360×640, qualidade Baixa, CPU throttling, 4 peças e janela de 8 s. A contagem de bytes é de payload da aplicação recebido/enviado, sem overhead de transporte. Não generalizar para 150 corpos ativos ou 6 aparelhos físicos.

| Papel | CPU | FPS médio | p95 frame (ms) | Draw calls | Triângulos | Payload KB/s |
|---|---:|---:|---:|---:|---:|---:|
| cliente | 4× | 47.8 | 50.1 | 16 | 5152 | 1.82 |
| cliente | 6× | 50 | 50 | 15 | 5008 | 1.74 |
| host | 4× | 54.4 | 50 | 15 | 5008 | 2.08 |
| host | 6× | 50.6 | 66.7 | 15 | 5008 | 2.11 |

O piso de 30 FPS **médios** passou. O p95 mostra engasgos; não comprova 30 FPS estáveis em cada quadro. 60 FPS em TV, memória GPU ≤150 MB e entrada em ≤5 s sob 4G real ainda não foram comprovados.

## Checklist de aceite

- [x] Três modos utilizáveis no Emulator e demo local explicitamente identificada.
- [x] Remote-first com render por celular, papéis, convite/QR/WhatsApp e TV opcional.
- [x] Entrar/sair durante a fase, herdar host e continuar sozinho.
- [x] Estado/ACK/contribuições transacionais, sem duplicar ações.
- [x] Persistência após fechar a última aba; bairros ativos sob demanda.
- [x] Segurança por família/sala, UID e epoch; regras testadas.
- [x] Card no portal e painel multifamília; presença privada da própria família.
- [x] Física somente no host em worker; clientes carregam ao migrar.
- [x] ES Modules, dependências fixadas locais, sem build de produção.
- [x] Tema neutro e Natal, qualidade automática/manual, 2D, som após gesto.
- [x] Capturas de TV/celular e baselines visuais; gravações Playwright.
- [x] README, direção de produto, CI e instruções de publicação.
- [ ] Configuração Firebase de produção, regras publicadas e Auth/domínios/chave restrita.
- [ ] GitHub Pages com URL de jogo publicamente verificada. A entrega é PR rascunho, sem merge.
- [ ] Safari/iOS real, Android antigo real e teste de usabilidade com criança/avô.
- [ ] Migração ≤3 s cronometrada sob todas as condições (a recuperação foi testada, mas o timeout de asserção é 8 s).
- [ ] Performance estável no aparelho-alvo, 150 corpos e carga simultânea entre famílias; custo/limites de RTDB.
- [ ] Rotação em 24 orientações: implementadas 4 rotações em Y.
- [ ] Arraste contínuo com canal de predição volátil a 10–15 Hz: atualmente toque/setas com ações confirmadas.
- [ ] Chão inclinado, terremoto, peças irregulares, slow motion e animações avançadas de celebração. Há vento progressivo, peças de três proporções e partículas de encaixe.
- [ ] HDR/PMREM, lightmaps de cenário completos, KTX2/Draco: a arte atual é procedural, usa AO radial e sombras, sem assets GLB/texturas grandes que justifiquem codecs.
- [ ] Aprovação visual humana e vídeo revisado para divulgação.

## Riscos e decisões

O host é um membro confiável da família. Sem servidor próprio, as regras cercam identidade/epoch, mas não validam cada resultado da física produzido por um host malicioso. A sala aceita registro de convidados com convite; somente os 6 primeiros recebem papéis jogáveis, os demais acompanham. Não há controle rígido de cota de conexões no banco.

Uma família visita o mesmo bairro ativo em conjunto; não são seis bairros simulados em paralelo. Limite atual: 64 bairros de 25 células. Linha do tempo conserva as últimas 40 entradas; contribuições cumulativas permanecem. O formato é versionado para futura migração.

Não foram lidas nem escritas salas reais. Não foram reutilizados projetos Firebase dos jogos antigos. Não há segredo ou token de teste nos artefatos versionados. O SDK Firebase pode registrar advertências no console durante negações deliberadas dos testes de segurança; isso é esperado no teste, não falha escondida do jogo.

## Atualização para publicação

Ver `PRODUCAO.md` para o Firebase real e as validações da liberação. A medição anterior e o checklist de recursos são históricos; a configuração de produção agora existe.
