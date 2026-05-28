# Tarefas do dia — 28/05/2026

---

## 1 — Mergear `feat/osint-block3-cnpjws` na `main` e subir para produção

A branch está 3 commits à frente da `main` e nunca foi para produção. Ela traz:

- **Block 3 (LLM):** para cada processo com comunicados, envia o histórico ao Claude (Haiku) e retorna um parágrafo telegráfico focado em patrimônio (penhoras, bloqueios, bens, execuções fiscais). Resultado exibido no frontend ao expandir o processo, antes das comunicações brutas.
- **CNPJ.ws como fonte primária:** substitui BrasilAPI + CNPJa Open por `publica.cnpj.ws` (fila de rate limit embutida, fallback mantido).
- **Alerta de endereço compartilhado:** cruza `logradouro + numero + bairro + CEP` entre todas as empresas do alvo — mesma lógica do alerta de email compartilhado.
- **Isolamento de investigações por usuário:** analista só vê e acessa os próprios dossiês; admin vê tudo.
- **Remoção do `/api/debug/*`:** endpoints temporários de diagnóstico de IP deletados.
- **Migration `011_processos_analise_llm.sql`:** coluna `analise_llm TEXT` na tabela `processos` — rodar em produção.
- **Fix frontend:** redirect pós-troca de senha obrigatória vai para `/osint` em vez de ficar no perfil.

### Checklist
- [ ] Abrir PR de `feat/osint-block3-cnpjws` → `main` e fazer o merge
- [ ] Rodar migration `011_processos_analise_llm.sql` em produção
- [ ] Garantir que `ANTHROPIC_API_KEY` e `CLAUDE_MODEL` estão no `.env` de produção
- [ ] Validar deploy: iniciar uma investigação e confirmar que o Block 3 aparece nos processos

---

## 2 — Validação de CPF no frontend

Hoje o campo de CPF não valida os dígitos verificadores — qualquer sequência de 11 dígitos passa.

### Como funciona o cálculo
O CPF tem 11 dígitos. Os 2 últimos são dígitos verificadores calculados a partir dos 9 primeiros:

**1º dígito verificador:**
- Multiplica os 9 primeiros dígitos por 10, 9, 8, 7, 6, 5, 4, 3, 2 (respectivamente)
- Soma os produtos → resto = soma % 11
- Se resto < 2 → dígito = 0; senão → dígito = 11 - resto

**2º dígito verificador:**
- Multiplica os 10 primeiros dígitos (incluindo o 1º verificador) por 11, 10, 9, 8, 7, 6, 5, 4, 3, 2
- Soma os produtos → resto = soma % 11
- Se resto < 2 → dígito = 0; senão → dígito = 11 - resto

Casos inválidos a rejeitar além do cálculo: sequências repetidas (`000.000.000-00`, `111.111.111-11`, ..., `999.999.999-99`).

### Checklist
- [ ] Criar utilitário `frontend/src/utils/cpf.ts` com funções `validateCpf(cpf: string): boolean` e `formatCpf(cpf: string): string`
- [ ] Localizar o(s) formulário(s) de CPF no frontend e plugar a validação
- [ ] Exibir mensagem de erro inline ao usuário quando o CPF for inválido
- [ ] Bloquear o envio do formulário enquanto o CPF não passar na validação

---

## 3 — Busca reversa por email e endereço na base nacional (Block 1.5) — ⏳ PENDENTE

> ⚠ **Em avaliação — implementar por último.** Viabilidade depende de validação local da base de CNPJs da Receita Federal antes de qualquer implementação.
>
> **Status (2026-05-28):** os arquivos CSV da Receita estão disponíveis localmente (confirmado pelo usuário). Falta definir a estratégia de ingestão (importar p/ Postgres + índices em email normalizado e chave de endereço, vs. consultar CSVs direto — para cruzamento por email/endereço, importar e indexar é o único caminho que escala). A implementação começa depois de definir caminho dos arquivos, layouts disponíveis (Empresas / Estabelecimentos — que traz email+endereço / Sócios) e tamanho da base.

A ideia: após o Block 1, usar os emails e endereços coletados das empresas do alvo para fazer uma busca reversa na base completa de CNPJs — revelando empresas correlatas que não aparecem no QSA, inclusive estrangeiras com CNPJ BR que compartilham o mesmo email de contato.

### Fluxo esperado (quando viabilizado)
1. Block 1 termina → coleta emails únicos e chaves de endereço de todas as empresas
2. Busca reversa por email na base → outros CNPJs com o mesmo contato
3. Busca reversa por endereço → outros CNPJs no mesmo local (apenas BR)
4. CNPJs novos entram no dossiê como "empresas correlatas" com flag de origem
5. Se empresa correlata tiver domicílio estrangeiro → alerta + dispara Block 4

### Próximo passo
- [ ] Validar a base baixada: confirmar presença dos campos de email e endereço e definir estratégia (importar para Postgres ou consultar CSVs diretamente)

---

## 4 — Buscas internacionais (Block 4)

Rodar após exaurir a busca nacional. Disparado automaticamente também quando o Block 1.5 encontrar empresa correlata domiciliada no exterior.

Para cada fonte abaixo o fluxo é: buscar pelo nome do alvo (e variações) → verificar match → extrair dados relevantes → salvar no dossiê.

---

### 4.1 — OpenSanctions
**Tipo:** API REST JSON — mais simples de integrar.

- Endpoint: `GET https://api.opensanctions.org/search/default?q={nome}`
- Retorna entidades sancionadas com score de similaridade
- Verificar match pelo nome e score; extrair: países, programas de sanção, aliases, datas

**Checklist**
- [ ] Criar `backend/src/apis/opensanctions.ts` com retry/backoff
- [ ] Considerar `OPENSANCTIONS_API_KEY` se necessário (plano gratuito tem limite)
- [ ] Integrar ao Block 4 como primeira verificação (mais rápida)

---

### 4.2 — UK Companies House
**Tipo:** HTML scraping, dois passos.

- Passo 1 — busca: `GET https://find-and-update.company-information.service.gov.uk/search?q={nome}`
  - Retorna HTML com lista de resultados; identificar matches pelo nome
- Passo 2 — detalhes: navegar até a página do officer correspondente
  - Ex: `https://find-and-update.company-information.service.gov.uk/officers/{id}/appointments`
  - Extrair: empresas associadas, cargos, datas de nomeação/saída, endereços registrados
- Investigar se existe API oficial (Companies House tem API REST, vale checar se cobre a busca por nome de pessoa)

**Checklist**
- [x] Estudar a API oficial do Companies House — usada (evita scraping)
- [x] `backend/src/apis/ukcompanies.ts` criado
- [x] Fluxo de dois passos mapeado: search → officer page → appointments

---

### 4.3 — ICIJ Offshore Leaks
**Tipo:** HTML scraping, verificação de match.

- Endpoint: `https://offshoreleaks.icij.org/search?q="{nome completo entre aspas}"`
- Busca com nome entre aspas para match exato
- Retorna HTML com resultados de Panama Papers, Pandora Papers, Paradise Papers etc.
- Verificar se há match; se sim, extrair: entidade, jurisdição, dataset de origem, intermediários

**Checklist**
- [x] Criar `backend/src/apis/offshoreleaks.ts` — usa a **Reconciliation API JSON oficial** (`POST /api/v1/reconcile/{dataset}`, sem chave), não scraping
- [x] Integrado ao Block 4 como 3ª fonte (`runOffshoreLeaks`): itera os 5 datasets, busca em **todas as categorias** (Officer/Entity/Intermediary/Address), filtra por `match`/contenção de tokens do nome
- [x] **Enriquecimento de grafo:** para cada hit, `getConnections` (`/nodes/{id}.json`) traz a entidade offshore, endereço e intermediário conectados (jurisdição, status, data de incorporação) — ex.: alvo → SSG International Holdings Ltd. (BVI, Miami)
- [x] Persistência (`investigacao_offshore` + coluna `conexoes` JSONB, migrations `014`/`015`), exibição no dossiê (relatório + `OffshoreFlag` com conexões), toggle no form
- [x] Testes: cliente (`offshoreleaks.test.ts`) + integração no Block 4 (`block4-icij.test.ts`). Validado contra a API real (alvo → 1 hit + entidade/endereço)

---

### 4.4 — Florida Sunbiz (Secretary of State) — ⏳ PENDENTE (parcial: link manual entregue)
**Tipo:** HTML scraping, formato de nome invertido.

- Endpoint: `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults/OfficerRegisteredAgentName/{SOBRENOME}%20{NOME}/Page1`
- **Atenção:** nome deve ser invertido (`DE JESUS SIDNEI`, não `SIDNEI DE JESUS`).
- Retorna lista de empresas registradas na Flórida onde o alvo é officer ou registered agent.

#### Testes realizados (2026-05-28)
- `curl` direto no endpoint de SearchResults → **HTTP 403** com **Cloudflare managed challenge** (resposta com `cType: 'managed'` + challenge JS `/cdn-cgi/challenge-platform/.../orchestrate`, exige "Enable JavaScript and cookies").
- User-Agent de navegador + headers completos **não passam** — o gate é por JS/cookies/JA3 fingerprint.
- **Conclusão:** scraping ao vivo com `undici`+`cheerio` é **inviável**.

#### Pesquisas de contorno (em avaliação)
1. **Feed bulk via SFTP (caminho recomendado):** `sftp.floridados.gov` (user `Public`), arquivos **fixed-width** (registro `cor`, 1440 chars) com nome da entidade, status, datas, endereços, **registered agent** e até **6 officers**. Quarterly = snapshot completo das ativas; Daily = filings do dia. → Pipeline: cliente SFTP (`ssh2-sftp-client`) + parser fixed-width + índice por nome normalizado no Postgres. Evita Cloudflare e dá busca offline confiável. **É praticamente uma task própria.**
2. **Browser headless + bypass Cloudflare** (Playwright stealth ou serviço) — frágil e sujeito a quebra; não recomendado.

#### Entregue nesta branch (parcial)
- [x] Lógica de inversão de nome (`DE JESUS SIDNEI`) e variações geradas no relatório.
- [x] Link de busca por officer/registered agent pré-preenchido na seção "Verificação manual" do dossiê.
- [ ] **PENDENTE:** pipeline SFTP bulk (item 1 acima) — automação real.

---

### 4.5 — Miami-Dade Clerk — Official Records — ⏳ PENDENTE (parcial: link manual entregue)
**Tipo:** SPA + reCAPTCHA v3.

- Portal: `https://onlineservices.miamidadeclerk.gov/officialrecords` (SPA React).
- Busca por "Party Name" (formato last-name-first: `DE JESUS SIDNEI PIVA`).
- Registros: Party Name, Address, Document Type, Rec Date, Book/Page, Legal Description, Clerk's File Number (CFN). Doc types críticos: LIS PENDENS, foreclosure, deed, mortgage.

#### Arquitetura descoberta (2026-05-28)
Dois endpoints distintos:
| Endpoint | Função | Captcha |
|---|---|---|
| `POST /officialrecords/api/home/standardsearch?partyName=…` | **gera** um `qs` (token de busca) | exige header `x-recaptcha-token` (**reCAPTCHA v3**, site key `6LfI8ikaAAAAAH0qlQMApskMGd1U6EqDyniH5t0x`) |
| `GET /officialrecords/api/SearchResults/getStandardRecords?qs=…` | **lê** os resultados de um `qs` | nenhum |

O `qs` é **criptografado no servidor**, embute os critérios e é descartável (um por busca). A API oficial de developers (`www2.miamidadeclerk.gov`) é **paga** e busca só por CFN/Book-Page/Folio — **não por nome**.

#### Testes realizados (todos ao vivo)
| Cenário | Resultado |
|---|---|
| `curl` no `getStandardRecords` com `qs` válido (gerado por humano) | **HTTP 200 + JSON** com 1 registro real do alvo (ST TROPEZ II LLC) |
| `curl` no `standardsearch` **sem** token (ou token falso/Origin realista) | `{"isValidSearch":false,"qs":null}` — recusa gerar `qs` |
| Playwright (Chrome real) gerando token v3 + `standardsearch` | `isValidSearch:true` + `qs` novo — **o captcha passa mecanicamente** |
| Ler resultados com o `qs` gerado pela automação | **0 resultados** |
| Mesma string, mesma sessão/IP: `qs` do humano vs `qs` da automação | humano → **1**, automação → **0** |
| Playwright + stealth (`navigator.webdriver` mascarado) | ainda **0** |
| Playwright com profile real logado no Google (cópia) | sessão não carregou; direto no profile real → travou em about:blank (inviável) |

#### Conclusão
A barreira **não é bloqueio clássico nem ordenação de nome** — é **score-gating do reCAPTCHA v3**: o backend "assa" a nota do v3 dentro do `qs`; tráfego automatizado/datacenter recebe nota baixa e o `qs` retorna **lista vazia** (anti-scraping silencioso). Humano em navegador real (com sessão Google) tira nota alta → recebe os dados. Mascarar o fingerprint não basta.

#### Pesquisas de contorno (em avaliação)
1. **Solver de token v3** (2captcha/Anti-Captcha) que entregue tokens de score alto → resto do fluxo (`standardsearch` → `qs` → `getStandardRecords`) é HTTP limpo. Custo por solve, frágil, **zona cinzenta de ToS**.
2. **Navegador real + IP residencial/móvel** (não datacenter) + sessão estabelecida.
3. **Teste pendente decisivo:** rodar o fluxo **no IP do servidor de produção** (os testes acima foram em IP local) — confirma se o score muda no ambiente real. Script portátil (Playwright headless + stealth) a montar.

#### Entregue nesta branch (parcial)
- [x] Link pré-preenchido + variações de nome (`DE JESUS SIDNEI`, `JESUS SIDNEI`, …) na seção "Verificação manual" do dossiê.
- [ ] **PENDENTE:** automação (depende de uma das opções de contorno acima + teste no IP do servidor).
