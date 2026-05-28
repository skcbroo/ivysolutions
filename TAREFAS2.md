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

## 3 — Busca reversa por email e endereço na base nacional (Block 1.5)

Após o Block 1 (empresas do alvo), coletar todos os emails e endereços encontrados e realizar uma busca reversa na base de CNPJs para descobrir outras empresas que compartilham esses atributos — inclusive empresas domiciliadas no exterior que possuem CNPJ brasileiro mas não expõem o QSA explicitamente. O email de contato é o elo que as denuncia.

### Contexto
- A busca reversa por email pode revelar empresas estrangeiras com CNPJ BR que usam o mesmo contato de uma empresa já listada — isso é um indício forte de vínculo não declarado.
- A busca reversa por endereço é voltada apenas para empresas BR no mesmo local (complementa o alerta de endereço compartilhado já existente no Block 1).
- O usuário está baixando a base completa de CNPJs da Receita Federal para validar a viabilidade dessa busca localmente antes de implementar.

### Fluxo esperado
1. Block 1 termina → coleta lista de emails únicos e chaves de endereço de todas as empresas do alvo
2. Para cada email: busca na base de CNPJs quais outros CNPJs têm aquele email cadastrado
3. Para cada endereço: busca na base quais outros CNPJs estão no mesmo local
4. CNPJs novos encontrados são incorporados ao dossiê como "empresas correlatas" com flag de origem (`via email compartilhado` / `via endereço compartilhado`)
5. Se algum CNPJ correlato tiver `pais != BR` (domicílio estrangeiro) → acende alerta e dispara busca internacional para aquela empresa (Block 4)

### Checklist
- [ ] Validar base de CNPJs da Receita: confirmar que os campos de email e endereço estão presentes e em qual arquivo/tabela
- [ ] Definir estratégia de armazenamento: importar para Postgres local ou consultar os CSVs diretamente
- [ ] Criar `backend/src/apis/cnpjbase.ts` — funções `searchByEmail(email: string)` e `searchByAddress(key: string)` contra a base local
- [ ] Integrar ao worker após Block 1, antes do Block 2 — novo passo "Block 1.5"
- [ ] Armazenar empresas correlatas no banco com flag de origem e exibir no frontend (seção separada no dossiê)
- [ ] Alerta automático quando empresa correlata tiver domicílio estrangeiro → acionar Block 4

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
- [ ] Estudar a API oficial do Companies House (`api.company-information.service.gov.uk`) — pode evitar scraping
- [ ] Se scraping necessário: criar `backend/src/apis/ukcompanies.ts` com parser HTML (cheerio ou similar)
- [ ] Mapear o fluxo de dois passos: search → officer page → appointments

---

### 4.3 — ICIJ Offshore Leaks
**Tipo:** HTML scraping, verificação de match.

- Endpoint: `https://offshoreleaks.icij.org/search?q="{nome completo entre aspas}"`
- Busca com nome entre aspas para match exato
- Retorna HTML com resultados de Panama Papers, Pandora Papers, Paradise Papers etc.
- Verificar se há match; se sim, extrair: entidade, jurisdição, dataset de origem, intermediários

**Checklist**
- [ ] Criar `backend/src/apis/offshoreleaks.ts` com parser HTML
- [ ] Testar variações de nome (com e sem aspas, nome parcial) para calibrar falsos positivos
- [ ] Extrair links para entidades relacionadas se houver match

---

### 4.4 — Florida Sunbiz (Secretary of State)
**Tipo:** HTML scraping, formato de nome invertido.

- Endpoint: `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults/OfficerRegisteredAgentName/{SOBRENOME}%20{NOME}/Page1`
- **Atenção:** nome deve ser invertido (`DE JESUS SIDNEI`, não `SIDNEI DE JESUS`) — avaliar como montar automaticamente para nomes compostos
- Retorna lista de empresas registradas na Flórida onde o alvo é officer ou registered agent
- Se match: navegar até a página da empresa e verificar possibilidade de baixar o relatório anual (Annual Report)

**Checklist**
- [ ] Criar `backend/src/apis/sunbiz.ts` com lógica de inversão de nome e parser HTML
- [ ] Mapear variações possíveis do nome invertido (ex: `DE JESUS SIDNEI P`, `PIVA SIDNEI`)
- [ ] Extrair dados da empresa: status, data de registro, endereço registrado, outros officers
- [ ] Se relatório anual disponível: baixar e armazenar como anexo no dossiê

---

### 4.5 — Miami-Dade Clerk — Official Records
**Tipo:** HTML scraping complexo, múltiplas variações de nome.

- Portal: `https://onlineservices.miamidadeclerk.gov/officialrecords`
- Busca por "Party Name" — campo de texto livre
- Variações a testar: `DE JESUS SIDNEI`, `PIVA SIDNEI`, `DE JESUS SIDNEI P`, nome completo
- Retorna registros de cartório: procurações, compra/venda de imóvel, LIS PENDENS, hipotecas, etc.
- Cada registro tem: Party Name, Address, Document Type, Rec Date, Rec Book/Page, Legal Description, Clerk's File Number
- Múltiplos matches possíveis para o mesmo alvo com variações do nome

**Checklist**
- [ ] Investigar o portal: verificar se aceita requisições diretas ou usa captcha/session
- [ ] Criar `backend/src/apis/miamidade.ts` com lógica de busca por múltiplas variações do nome
- [ ] Parsear a tabela de resultados: extrair tipo de documento, data, book/page, descrição legal
- [ ] Consolidar matches duplicados (mesmo registro aparecendo por nomes diferentes)
- [ ] Exibir no dossiê com destaque para documentos críticos (LIS PENDENS, foreclosure, deed)
