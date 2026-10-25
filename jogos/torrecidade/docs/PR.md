# Torre / Cidade Juntos: cooperação remota e cidade persistente

A família pode construir sem TV e sem combinar horário: cada celular renderiza a maquete, recebe um papel e entra no meio da fase. Quem fica sozinho assume todas as funções; o estado confirmado permanece salvo quando a última pessoa sai.

Esta entrega adiciona Torre, Missão Cidade e Nossa Cidade em `jogos/torrecidade/`, com Three.js local, física em worker no host eleito, Firebase modular, convites, presença por conexão, snapshots/ACK transacionais e bairros carregados sob demanda. Integra o card ao portal e ao painel multifamília. Não altera os jogos legados.

## Evidências

![Maquete e entrada](https://raw.githubusercontent.com/bavkiq-hUgby8-cittet/nataleujogo/cursor/jogo-torrecidade/jogos/torrecidade/docs/inicio-tv.png)

![Partida no celular](https://raw.githubusercontent.com/bavkiq-hUgby8-cittet/nataleujogo/cursor/jogo-torrecidade/jogos/torrecidade/docs/cidade-celular.png)

![TV](https://raw.githubusercontent.com/bavkiq-hUgby8-cittet/nataleujogo/cursor/jogo-torrecidade/jogos/torrecidade/docs/cidade-tv.png)

[Vídeo curto do Playwright](https://github.com/bavkiq-hUgby8-cittet/nataleujogo/blob/cursor/jogo-torrecidade/jogos/torrecidade/docs/demonstracao.webm) · [Relatório e checklist detalhado](https://github.com/bavkiq-hUgby8-cittet/nataleujogo/blob/cursor/jogo-torrecidade/jogos/torrecidade/docs/VALIDACAO.md)

## Aceite verificado

- [x] Lógica pura, física determinística e papéis 1–6: 17 testes unitários.
- [x] Segurança no Emulator: 8 cenários, incluindo UID, convite, isolamento e epoch antigo.
- [x] Partida Cidade e Torre com 3 celulares, sem TV.
- [x] Drop-in/drop-out, migração e conclusão solo.
- [x] Fechamento abrupto do último jogador preserva a construção.
- [x] Desbloquear, sair e retornar a um bairro preserva suas peças.
- [x] 2 TVs + 3 celulares: só uma instância host, placar sem duplicação.
- [x] Reconexão, perfis de latência e teste WebSocket com RTT 300 ms, jitter e 5% de retransmissões simuladas.
- [x] 4 perfis de CPU throttling (host/cliente × 4×/6×), 8 baselines visuais e evidências anexadas.
- [x] Configuração única, dependências fixadas e vendorizadas, tema neutro/Natal, áudio após toque e controles 2D.
- [x] Card, documentação de operação e workflow CI.
- [ ] Publicação de produção no GitHub Pages e configuração real do Firebase.
- [ ] Validação em Safari/iPhone e Android antigos físicos; 30 FPS estáveis/60 FPS TV, memória GPU e entrada 4G em 5 s.
- [ ] Ensaios de carga com 150 corpos ativos e múltiplas famílias; migração cronometrada ≤3 s sob toda a matriz.
- [ ] Recursos avançados restantes do briefing: arraste contínuo a 15 Hz, 24 orientações, terreno inclinado/terremoto, HDR/lightmaps completos e celebrações avançadas.
- [ ] Aprovação visual/usabilidade com criança e avô.

## Decisões e riscos

Cannon ES foi escolhido como alternativa autorizada ao Rapier para a física de blocos, com download lazy menor e sem inicialização WASM. RTDB é o único transporte; WebRTC permanece extensão documentada. A cidade compartilha um bairro ativo por família, limitado a 25 células; até 64 bairros, com snapshots limitados ao bairro ativo. Não há ranking individual.

A aplicação é cooperativa e confia no membro eleito host; as regras cercam identidade/epoch, mas não tornam um host malicioso matematicamente confiável. A medição de FPS é média em Chromium/SwiftShader e não comprova fluidez em hardware físico. A contagem de rede mede payload JSON, sem overhead TLS/WebSocket. As limitações estão marcadas no relatório, não tratadas como aprovadas.

## Passos manuais antes de produção

1. Configurar o projeto em `js/firebase-config.js`; a branch base ainda usa projeto demo.
2. Habilitar Auth anônimo e e-mail/senha; autorizar o domínio do GitHub Pages.
3. Restringir a chave web aos referrers do GitHub Pages e localhost.
4. Publicar **a regra composta da raiz**, preservando os jogos existentes.
5. Revisar as pendências, depois aprovar merge/publicação em outro passo.

PR em rascunho para `cursor/plataforma-multifamilia-c89d`, conforme a referência oficial. Nenhum merge, nenhum deploy e nenhuma escrita em salas reais. O repo separado `torrecidade` não existia; a implementação permanece isolada no portal existente.
