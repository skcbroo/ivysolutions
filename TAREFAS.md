# Tarefas pendentes

## Passo 3 — Trocar fonte de dados de empresas para publica.cnpj.ws

- [ ] Criar `backend/src/apis/cnpjws.ts` — cliente para `https://publica.cnpj.ws/cnpj/{cnpj14}` com retry/backoff
- [ ] Criar `normalizeCnpjWs()` no `block1.ts` mapeando o schema da nova API para `EmpresaNormalizada`
- [ ] Substituir as chamadas paralelas de `fetchCnpj` (BrasilAPI) + `fetchCnpjOpen` (CNPJa) pela nova função
- [ ] Avaliar o que fazer com `brasilapi.ts`, `cnpja.ts` e `cnpja-bff.ts` após a migração

---

## Block 3 — Análise de comunicados via LLM (Claude)

- [ ] Remover o limite de 5 comunicados por processo (`MAX_COMUNICACOES_POR_PROCESSO` em `comunica.ts`) — guardar todos no banco para passar à LLM
- [ ] Criar `backend/src/apis/claude.ts` — cliente para a API da Anthropic com retry/backoff e prompt caching
- [ ] Criar `backend/src/blocks/block3.ts` — para cada processo com comunicados, envia o histórico completo ao Claude e pede que identifique informações relevantes para a investigação patrimonial (penhoras, bloqueios, condenações, execuções fiscais, valores, bens mencionados)
- [ ] Adicionar nova coluna `analise_llm TEXT` na tabela `processos` (nova migration) para guardar o resultado
- [ ] Chamar `runBlock3` no `worker.ts` após o Block2, antes da geração do relatório
- [ ] Incluir o campo `analise_llm` na seção de cada processo no relatório Markdown e na aba Processos do frontend
- [ ] Usar `claude-haiku-4-5` por padrão (volume alto de processos); configurável via env `CLAUDE_MODEL`

---

## Alertas — novos critérios

- [ ] `backend/src/blocks/block1.ts` — Adicionar alerta de **endereço compartilhado entre empresas**
  - Chave de comparação: `logradouro + numero + bairro + CEP` (sem complemento, que varia por sala/lote)
  - Normalização antes de comparar: minúsculo, sem acentos, sem vírgulas/pontuação, trim de espaços
  - Se 2+ empresas baterem na mesma chave → alerta `"endereço compartilhado em X empresas"`
  - Mesma lógica já usada para e-mail compartilhado (post-processing após buscar todas as empresas)

---

## Investigação — Busca sem retorno (Bruno Ladeira Junqueira / 102.087.326-40)

- [ ] Verificar os logs do worker para a investigação desse alvo e identificar onde a busca falhou (Block1 vazio? Block2 sem resultados? erro silencioso?)
- [ ] Checar se o Comunica retornou 0 itens em todas as queries ou se houve erro de rate limit (429) não tratado corretamente
- [ ] Garantir que processos únicos são listados corretamente — a dedup já usa `processosMap` por número de processo, mas validar se o problema não está antes disso (nenhuma comunicação chegando)
- [ ] Revisar o limite de `MAX_PAGES_EMPRESA` (atualmente 5 páginas / 500 comunicados por empresa) — considerar aumentar para não perder processos de empresas com alta atividade judicial
- [ ] Adicionar log explícito por query no Block2: quantas páginas foram percorridas, quantos comunicados recebidos e quantos processos únicos acumulados — facilita diagnóstico de casos futuros

---

## Bugs críticos

- [ ] `backend/src/worker.ts:37` — Adicionar `try/catch` global no `runWorker` para chamar `setStatus(id, 'erro')` em qualquer exceção, evitando investigações presas em `rodando`
- [ ] `backend/src/apis/comunica.ts:311` — Corrigir dedup de comunicados sem link: usar `data + tipo` como chave em vez de `link === null`

---

## UX — Fluxo de primeiro acesso

- [ ] `frontend/src/pages/osint/Perfil.tsx` — Após troca de senha obrigatória bem-sucedida, redirecionar para `/osint` (página inicial do usuário logado) em vez de permanecer no perfil

---

## Bugs altos

- [ ] `frontend/src/components/osint/RequireAdmin.tsx:7` — Adicionar verificação de `must_change_password` igual ao `RequireAuth`
- [ ] `frontend/src/pages/osint/Relatorio/Tabs.tsx:1` — Adicionar `import type React from 'react'`
- [ ] `backend/src/routes/investigacoes.ts:52` — Filtrar `listRecent` por `created_by` do usuário autenticado

---

## Migration

- [ ] `backend/migrations/010_users_role.sql:13` — Remover `UPDATE users SET role = 'admin' WHERE email = 'analista@ivy.com'`
