# Registro da publicação

Publicação autorizada pelo responsável em 25/10/2026 (America/Fortaleza).

- Projeto Firebase dedicado: `torre-cidade-juntos`, app `Torre Cidade Web`, plano Spark (US$ 0/mês), sem upgrade de cobrança.
- RTDB: `https://torre-cidade-juntos-default-rtdb.firebaseio.com`, região us-central1, criado inicialmente bloqueado; regras isoladas do jogo publicadas pelo console.
- Auth e-mail/senha e anônimo habilitados. Domínio autorizado: `bavkiq-hugby8-cittet.github.io`.
- Gemini e Analytics desativados na criação. Nenhum projeto ou sala antiga foi alterado.
- `conta.html` permite cadastrar/entrar na conta da família e criar sala; convidados recebem o link e só informam nome/avatar. A conta usa o app Auth padrão, compatível com a integração futura da plataforma.
- Publicação do jogo isolado em `main`, mantendo o HTML e os links dos outros jogos do portal. A branch multifamília completa não é promovida junto.
- Otimização: matrizes de instâncias enviam apenas as posições ocupadas, em vez da capacidade inteira de 2.048/4.096 instâncias. Nível Baixo usa DPR 0,75. O limite de 30 FPS foi mantido nos testes.
- O cenário de 5 navegadores recebeu limite total de 180 s para inicialização/renderização com GPU emulada; limites individuais de ACK e eleição não foram alterados.

## Validação

17 testes unitários e 8 cenários de segurança passaram. Os 4 testes de desempenho e os 3 cenários de TV passaram juntos após a otimização. A suíte E2E completa inclui mais um cenário de entrada da conta pela interface. Resultados finais da publicação ficam no PR e no workflow do GitHub.

## Pendência operacional

O Google Cloud Console retornou `Site Unavailable` ao abrir a página de credenciais; por isso a restrição HTTP referrer da chave web não foi configurada por este agente. Aplicar manualmente em APIs e serviços → Credenciais, projeto `torre-cidade-juntos`: permitir `https://bavkiq-hugby8-cittet.github.io/*`, `http://localhost/*`, `http://127.0.0.1/*`. Não desativar as restrições de API existentes. A chave web é pública; autorização de leitura/escrita é imposta por Auth + RTDB Rules, já publicadas e testadas.

Permanecem os limites documentados em VALIDACAO.md: validação em aparelhos reais, teste com crianças/avós, escala máxima e efeitos avançados. Esta é a primeira versão utilizável, não uma certificação de todos os critérios ambiciosos do briefing.
