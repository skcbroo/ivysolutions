# IVY OSINT — Backlog de Desenvolvimento

> Tarefas extraídas do documento *Esqueleto OSINT v1.1*.
> Sequência segue o roadmap: **D0 → D+1 → D+2 → D+3**.
> Cada tarefa traz objetivo, escopo, critério de aceite. Dúvida técnica não resolvida → perguntar antes de codar.

---

## Fundação transversal (pré-requisito de tudo)

### F-001. Implementar o modelo de dados base
**Objetivo:** criar o esquema único que sustenta os nove módulos.
**Escopo:** modelar e migrar as entidades abaixo no banco.

- `Caso` (cliente, alvo principal, escopo, produto contratado, prazo)
- `Alvo` (PF ou PJ; um caso tem 1 principal + N secundários: cônjuge, sócio, suspeito de testa-de-ferro)
- `Entidade` (genérico: empresa, imóvel, veículo, processo, perfil de rede, publicação, notícia, offshore, trust)
- `Vínculo` (relação entre duas entidades, com natureza e força)
- `Achado` (data, módulo de origem, classificação de confiança, fonte)
- `Fonte` (URL/identificador, data e hora da coleta, identidade do coletor — robô ou operador, excerto relevante)
- `Evidência` (par fonte + achado que sustenta uma afirmação)
- `Hipótese` (tese em aberto, com classificação explícita)
- `Evento patrimonial` (subtipo de achado, datado, alimenta a Linha do Tempo)

**Critério de aceite:**
- Migrations rodam limpo em ambiente novo.
- Todo `Achado` exige `Fonte`, classificação de confiança (`CONFIRMADO` / `FORTE_INDICIO` / `HIPOTESE`) e `módulo_origem`.
- Toda `Fonte` exige URL/identificador, `coletado_em` (timestamp), `coletor_id` e `excerto`.
- Schema diagramado em `/docs/data-model.md`.

---

### F-002. Sistema de classificação de confiança
**Objetivo:** garantir que confiança não é cosmética — é regra de negócio.

**Escopo:**
- Enum `CONFIRMADO` / `FORTE_INDICIO` / `HIPOTESE` aplicado a `Entidade`, `Vínculo`, `Achado`.
- Função de **promoção automática**: 3+ fontes independentes convergentes → `CONFIRMADO`.
- Função de **promoção/rebaixamento manual**: apenas via chat do módulo 8, com log.
- Hipóteses **não entram** no dossiê final, salvo se promovidas.

**Critério de aceite:**
- Tentativa de gerar dossiê com afirmação classificada como `HIPOTESE` bloqueia exportação e exige confirmação do operador.
- Histórico de classificações é versionado (não sobrescreve, registra).

---

### F-003. Rastreabilidade de fonte
**Objetivo:** toda afirmação rastreável até a origem pública.

**Escopo:**
- Carimbo automático (`coletado_em`, `coletor_id`) em qualquer inserção de `Fonte`.
- Campo `url_ou_identificador` obrigatório (URL pública, número de matrícula, número da publicação, ID de processo).
- Campo `excerto` obrigatório (trecho textual ou metadado).
- Upload opcional de PDF/imagem anexada (para fontes voláteis tipo Instagram).
- Não arquivar página inteira por padrão — só quando o operador anexar.

**Critério de aceite:**
- Não é possível salvar `Fonte` sem URL/identificador, excerto e timestamp.
- Anexo de PDF/imagem opcional, validado.

---

## D0 — Próxima entrega (foco: Módulos 1 e 2 prontos + fundação)

### M1-001. Subir base própria de empresas brasileiras
**Objetivo:** não depender de query restritiva de terceiros.

**Escopo:**
- Definir fonte da base (Receita, CNPJ.ws, base comprada — decidir com o time).
- ETL para popular a base local.
- Job de atualização periódica (definir frequência: diário/semanal — perguntar).
- Tabela indexada por CNPJ, sócios (CPF), endereço, e-mail, telefone.

**Critério de aceite:**
- Consulta por CNPJ retorna em < 200ms local.
- Atualização incremental sem downtime.
- Documentar fonte, frequência e cobertura em `/docs/base-empresas.md`.

---

### M1-002. Cruzamento por confusão patrimonial
**Objetivo:** capturar laranjas e empresas internacionais via testa-de-ferro.

**Escopo:** dado um alvo (nome + CPF), o sistema varre a base e marca empresas que compartilham com o alvo OU com empresas já vinculadas ao alvo ao menos um dos seguintes:

| Coincidência | Classificação inicial |
|---|---|
| CPF do sócio = CPF do alvo | `CONFIRMADO` |
| 1 coincidência (e-mail OU telefone OU endereço) | `FORTE_INDICIO` |
| 2+ coincidências combinadas | `CONFIRMADO` por convergência |

**Critério de aceite:**
- Função `cruzar_confusao_patrimonial(alvo_id)` retorna lista de empresas marcadas com classificação correta.
- Testes unitários cobrindo os 4 cenários acima.
- Documentar lógica em `/docs/modulo-1.md`.

---

### M2-001. Anti-homônimos — Etapa 1: Filtro de nome exato
**Objetivo:** descartar homônimos por divergência literal de nome.

**Escopo:**
- Robô que varre o retorno do Comunica CNJ.
- Compara nome do processo com nome cadastrado do alvo via **igualdade estrita** (case-insensitive, mas sem fuzzy).
- "Divino da Silva" ≠ "Divino Silva". "Maria Aparecida Cunha" ≠ "Maria Aparecida Cunha de Souza".
- Normalização: trim, lowercase, normalização Unicode (NFD), remoção de acentos para comparação. **Não usar Levenshtein.**

**Critério de aceite:**
- Bateria de testes com 20 pares (10 que devem passar, 10 que não).
- Função `filtrar_nome_exato(processos, nome_alvo)` retorna apenas os que batem.

---

### M2-002. Anti-homônimos — Etapa 2: Confirmação por CPF nos tribunais (web scraping)
**Objetivo:** confirmar identidade nos tribunais que aceitam busca por CPF.

**Escopo:**
- Identificar tribunal/UF de maior concentração dos homônimos remanescentes.
- Scrapers para **TJSP, TJMG e TJRJ** (prioritários — confirmar se aceitam busca pública por CPF, validar URLs e captchas).
- Cruzar CPF do alvo com cada processo restante. Match = confirmado, no_match = descartado.
- Respeitar rate limit e headers educados (User-Agent identificando IVY, intervalo entre requests).

**Critério de aceite:**
- Scrapers funcionando para TJSP, TJMG, TJRJ em ambiente de teste.
- Logs estruturados de cada consulta.
- Fallback gracioso se tribunal estiver fora do ar.
- Documentar status de cada tribunal em `/docs/scrapers-tribunais.md`.

> ⚠️ **Ponto a confirmar com o Lucas:** quais outros tribunais entram no D0 (TRTs? TJDFT?).

---

### M2-003. Anti-homônimos — Etapa 3: Ticagem manual acelerada
**Objetivo:** se sobrarem > 50 processos após etapas 1 e 2, validar manualmente.

**Escopo:**
- Interface de revisão em lote: cada processo aparece com identidade-chave (vara, parte contrária, valor, primeira movimentação).
- Botões **É o alvo / Não é / Pular** com atalho de teclado.
- Persistir decisão no banco (com timestamp e operador).
- Reabrir só processos não decididos.

**Critério de aceite:**
- Operador consegue ticar 50 processos em menos de 5 minutos.
- Decisões são versionadas (operador pode mudar de ideia).

---

### M2-004. Análise de conteúdo — Passo 1: Alerta por classe processual
**Objetivo:** sinalizar processos com potencial de crédito judicial.

**Escopo:**
- Extrair `classe_processual` do JSON da comunicação CNJ.
- Disparar alerta `CRÉDITO_JUDICIAL_POTENCIAL` quando o alvo está **no polo ativo** de:
  - Execução de título extrajudicial
  - Execução de título judicial e cumprimento de sentença (todas as modalidades)
  - Ação monitória
  - Ação de cobrança
  - Falência
  - Recuperação judicial
  - **Agravo de Instrumento no TST** (exclusivamente este — outros agravos NÃO disparam)

**Critério de aceite:**
- Tabela de mapeamento código CNJ → classe nomeada em `/docs/classes-processuais.md`.
- Testes para cada classe (positiva e negativa).
- Filtro por polo ativo funcionando (não disparar se alvo for réu).

---

### M2-005. Análise de conteúdo — Passo 2: Eventos patrimoniais por gatilhos lexicais
**Objetivo:** identificar eventos relevantes no texto da comunicação.

**Escopo:** parser textual com dicionário de gatilhos (case-insensitive, com normalização):

| Categoria | Gatilhos |
|---|---|
| Acordo | acordo homologado, acordo celebrado, transação, autocomposição |
| Constrição de imóveis | penhora de imóvel, arresto de imóvel, sequestro, indisponibilidade, alienação fiduciária constrita |
| Constrição de outros bens | penhora de veículo, de aplicações financeiras, de cotas societárias, de faturamento, de créditos |
| Bloqueio eletrônico | Bacenjud, Sisbajud, Renajud, Infojud, Serasajud |
| Adjudicação e leilão | designação de leilão, adjudicação determinada, hasta pública |
| Desconsideração e fraude | instauração de IDPJ, fraude à execução, fraude contra credores, sucessão fraudulenta |

Cada gatilho cria um `EventoPatrimonial` ligado ao processo e ao alvo, com **peso próprio no ranqueamento** (ver M2-007).

**Critério de aceite:**
- Dicionário em arquivo de configuração (não hardcoded), editável sem deploy.
- Testes de regressão com comunicações reais (pegar amostra do banco atual).
- Peso de cada gatilho definido em config; default proposto pelo dev, calibração final com Lucas.

> ⚠️ **Ponto a confirmar com o Lucas:** lista de pesos relativos. Tem callout no doc dizendo "primeira proposta, calibrar com a equipe operacional".

---

### M2-006. Análise de conteúdo — Passo 3: Ficha narrativa por processo
**Objetivo:** cada processo conta uma história em 8-12 linhas.

**Escopo:** para cada processo, gerar estrutura:

```
Identidade:        parte contrária | vara | valor atualizado | fase atual
Status patrimonial: o que existe AGORA (constrição, acordo, leilão, IDPJ, bens)
Tese de relevância: por que importa (crédito a haver, bem localizado, indício de ocultação)
Próxima ação:      monitorar leilão / requerer habilitação / instaurar IDPJ / buscar matrícula
Timeline enxuta:   3 a 5 marcos datados (NÃO movimentação inteira)
```

**Critério de aceite:**
- Função `montar_ficha_narrativa(processo_id)` retorna o objeto estruturado.
- Geração da ficha usa a LLM do módulo 8 (texto curto, tom de briefing, sem emoji, sem adjetivos vazios).
- UI exibe a ficha em modo síntese; "expandir" mostra movimentações detalhadas.

---

### M2-007. Análise de conteúdo — Passo 4: Ranqueamento por relevância patrimonial
**Objetivo:** lista de processos ordenada por densidade patrimonial.

**Escopo:** função de scoring que pondera:

| Fator | Peso (proposta) | Observação |
|---|---|---|
| Classe processual relevante no polo ativo | alto | crédito judicial = ativo mais valioso |
| Eventos patrimoniais ativos | médio-alto | constrição efetiva > requerimento |
| Valor atualizado da causa | médio | não dominante |
| Recência (último movimento ≤ 90 dias) | médio | parado vale menos |
| Indícios de ocultação/fraude | bonificador forte | IDPJ, fraude alegada, sucessão |

**Critério de aceite:**
- Função `calcular_score(processo)` retorna número.
- Pesos em config, NÃO hardcoded.
- Lista retornada já ordenada decrescente.
- Bateria de testes garantindo que: bloqueio Sisbajud > pedido de penhora; adjudicação determinada > designação de leilão; IDPJ instaurado > requerimento de IDPJ.

> ⚠️ **Calibração final com Lucas antes de produção.**

---

## D+1 — Médio prazo (demais módulos no nível inicial)

### M1-D1. Empresas Brasil — expansões
- **Cruzamento por sócios em comum:** dado sócio X em empresa do alvo, varrer empresas em que X aparece.
- **Análise de capital social desproporcional:** flag para empresa com capital incompatível com perfil do sócio formal.
- **Cruzamento com vínculos familiares:** extrair cônjuge/pais/filhos/irmãos de fontes públicas (processos de família, óbitos, casamentos) e usar como âncoras.
- **Datas de constituição relacionais:** empresa aberta em janela curta após evento de constrição contra o alvo = `FORTE_INDICIO`.

---

### M2-D1. Processos — expansões
- **Cruzamento com módulos vizinhos:** processo que cita empresa do módulo 1 ou imóvel do módulo 7 sobe no ranking.
- **Detecção de polos ativos recorrentes:** mapeia quem o alvo costuma processar (revela rede de negócios).
- **Acompanhamento contínuo:** após cadastro do alvo, monitorar comunicações novas e alertar.

---

### M3-001. Offshores e Internacional — bases consultáveis
**Escopo:** integrar consultas (priorizar gratuitas, OSINT puro):
- Companies House (UK) — API pública
- Registros estaduais EUA: Delaware, Flórida, Califórnia, Texas, Nevada, Wyoming (cada um tem seu portal — confirmar viabilidade)
- OpenCorporates — API (verificar limites do tier gratuito)
- Bases de leaks consolidados: ICIJ Offshore Leaks Database, Paradise Papers, Pandora Papers
- Registros públicos de Portugal, Espanha e Itália

**Critério de aceite:**
- Função `buscar_empresa_internacional(nome, jurisdicao)` por jurisdição.
- Resultado padronizado para o modelo de `Entidade`.
- Documentar cobertura e limitações em `/docs/modulo-3.md`.

---

### M3-002. Robô de identificação de trusts (por indícios)
**Objetivo:** trust não tem registro público — identificar por convergência de pistas.

**Escopo:** detectores que viram `Hipótese` quando bate:
- **Menção a trust em escrituras brasileiras** (parsing de palavras: "trust", "settlor", "trustee", "fiduciary", "beneficiário do trust").
- **Beneficiário em jurisdição típica de trust:** Bahamas, Cayman, Jersey, Guernsey, BVI, Liechtenstein, Cook Islands.
- **Padrão societário sintomático:** empresa BR cujo sócio é PJ estrangeira de jurisdição opaca sem beneficiário final declarado.
- **Menção em mídia/processos** com os termos acima vinculados ao alvo.
- **Declarações fiscais públicas** envolvendo bens no exterior do alvo.

**Critério de aceite:**
- Cada indício gera achado individual com classificação `HIPOTESE`.
- 2+ indícios convergentes promovem para `FORTE_INDICIO`.
- Operador via chat (módulo 8) pode promover para `CONFIRMADO` com instrução explícita.

---

### M3-003. Imóveis no exterior
**Escopo:** integração com:
- County recorders (EUA) — por estado/condado de interesse
- HM Land Registry (UK)
- Registros públicos de Portugal e Espanha

Busca por nome do alvo, cônjuge e sócios identificados em outros módulos.

---

### M4-001. Redes Sociais — upload e indexação
**Escopo:**
- Upload manual pelo técnico: Instagram, Facebook, LinkedIn, X, TikTok.
- **Apenas conteúdo público.** Perfis privados NÃO são acessados. Sem engenharia social.
- Parser que extrai:
  - Bens visíveis (imóveis, veículos, embarcações, aeronaves, objetos de valor)
  - Padrão de viagens (frequência, destinos — cruza com módulo 3)
  - Círculo próximo (alimenta cruzamento dos outros módulos)
  - Eventos e datas (cruza com Linha do Tempo)
  - Negócios mencionados (cruza com módulo 1)

**Critério de aceite:**
- Upload de exportação oficial das plataformas ou screenshots.
- Anexar arquivos como `Fonte` com URL volátil sinalizada.
- Nada é coletado automaticamente — só o que o operador subir.

---

### M5-001. Comunicados Oficiais
**Escopo:**
- Operador indica os estados de interesse (com base nos achados anteriores).
- Buscadores em:
  - Diário Oficial da União
  - DOEs dos estados indicados
  - DOMs das capitais e municípios identificados
  - Portais de transparência estaduais
  - Portal da Transparência federal

**O que extrair:** nomeações, sanções e penalidades, editais e contratações, benefícios fiscais.

**Critério de aceite:** lista de portais com endpoints/scrapers documentada em `/docs/modulo-5.md`.

---

### M6-001. Notícias
**Escopo:** varredura em fontes ranqueadas por confiança:

| Categoria | Veículos | Confiança padrão |
|---|---|---|
| Grande imprensa | Valor, Folha, Estadão, O Globo, G1 | `CONFIRMADO` quanto ao fato narrado |
| Imprensa especializada | Jota, Migalhas, Conjur, Brazil Journal | `CONFIRMADO` |
| Jornalismo investigativo | Piauí, Agência Pública, Intercept | `CONFIRMADO` |
| Imprensa regional | conforme estado | `FORTE_INDICIO` |
| Blogs profissionais | conforme análise | `FORTE_INDICIO` |
| Blogs anônimos | qualquer | máximo `FORTE_INDICIO`, geralmente `HIPOTESE` |

**Critério de aceite:**
- Busca por nome do alvo e por empresas do módulo 1.
- Classificação automática conforme tabela acima (editável em config).

---

### M7-001. ONR — Integração API + Gate de custo
**Objetivo:** consulta cirúrgica com confirmação financeira explícita.

**Escopo:** fluxo obrigatório de 4 passos para CADA consulta:

1. Software **propõe** a consulta (parâmetros, escopo geográfico, alvo) e **mostra o custo** conforme tabela ONR vigente.
2. Operador **confirma escopo e preço.** Confirmação fica em log com data, hora, operador.
3. Software executa e devolve matrículas localizadas (números, comarca, titularidade declarada).
4. Cada matrícula relevante pode ter cópia integral solicitada — **novo gate de custo, ciclo repete.**

**Critério de aceite:**
- Não há código path que execute consulta ONR sem passar pelo gate.
- Tabela de custos atualizável sem deploy.
- Log de cada consulta auditável.

> ⚠️ **Ponto a confirmar:** política de faixas de autorização — operador júnior pode autorizar até X reais sem aprovação? Está em aberto no doc ("Definição da política de gate de custo do módulo 7").

---

### M8-001. Chat do Operador — aba dedicada
**Objetivo:** interface de diálogo com LLM ancorada no banco de achados do caso.

**Escopo:**
- Aba "Chat" acumula conversa do caso em ordem cronológica.
- LLM tem acesso (via context injection) ao banco de achados do caso atual: entidades, vínculos, achados, fontes, classificações.
- LLM **não inventa fontes.** Não promove `HIPOTESE` a `CONFIRMADO` sem instrução explícita do operador.
- Histórico permanente, auditável.

**Critério de aceite:**
- Resposta da LLM cita os achados referenciados (com IDs internos).
- Operador pode revisar todo o histórico antes de gerar o dossiê.
- Logs por turno (input, output, tokens, latência).

> ⚠️ **Definir com Lucas:** qual LLM (Claude via Anthropic API faz sentido pelo histórico). Modelo, contexto máximo, política de retenção.

---

### M8-002. Chat do Operador — botões de contexto em cada módulo
**Objetivo:** abrir o chat já referenciando um achado específico.

**Escopo:**
- Em cada achado (empresa, processo, matrícula, offshore, perfil, notícia), botão "Discutir" abre o chat.
- Chat abre com contexto pré-carregado: "Operador está discutindo: [tipo] [identificação curta]."
- Conversa fica vinculada ao achado (relacionamento N:N entre `Chat_Mensagem` e `Achado`).

**Critério de aceite:**
- Botão presente em TODOS os módulos (1 a 7 e 9).
- Pré-contexto montado automaticamente e visível ao operador antes de enviar a primeira mensagem.

---

### M8-003. Chat do Operador — funções editoriais
**Objetivo:** operador instrui redação do dossiê e da cadeia de provas via chat.

**Escopo:** a LLM precisa entender e agir sobre instruções como:
- **Análise das fontes:** "essas 3 empresas são claramente do mesmo grupo, ligue" → cria vínculos com classificação correta.
- **Instruções editoriais ao relatório:** "tese principal: ocultação patrimonial via cônjuge a partir de 2022" / "dê destaque ao módulo 3" / "linguagem mais sóbria na seção de redes sociais".
- **Instruções à cadeia de provas:** "agrupe penhoras separadas de alienações" / "essas duas fontes do DO são redundantes, mantenha a mais recente" / "matrícula X é peça central, prioridade máxima".

**Critério de aceite:**
- Cada instrução vira **uma anotação persistida** ligada ao achado/seção referida.
- Geração final do dossiê (M9-002/M9-003) **consome essas anotações** ao montar o documento.

---

## D+2 — Maturidade (Linha do Tempo + geração automática dos entregáveis)

### M9-001. Linha do Tempo Patrimonial — síntese automática
**Objetivo:** narrativa cronológica cruzando todos os módulos.

**Escopo:** consumir todos os `EventoPatrimonial` do caso e organizar em 4 eixos paralelos:

| Eixo | O que entra |
|---|---|
| Patrimonial positivo | aquisição de empresas/imóveis/veículos; aporte declarado; incentivos; constituição de offshore |
| Patrimonial negativo | alienação de bens; encerramento de empresas; transferência de cotas; movimentação para terceiros |
| Endividamento | início de execuções; lavraturas; constrições; leilões designados; IDPJs; falências; recuperações |
| Pessoal | casamento, divórcio, nascimento de filhos, óbito de cônjuge/pais; mudança de regime de bens; partilhas; heranças |

Primeira versão é máquina; revisão final é humana.

**Critério de aceite:**
- Função `montar_linha_do_tempo(caso_id)` retorna timeline estruturada.
- Eventos ordenados por data, agrupados por eixo, com referência cruzada à evidência que os sustenta.
- LLM redige o texto narrativo a partir da estrutura — operador edita.

---

### M9-002. Geração automática do Dossiê
**Objetivo:** gerar o documento final do cliente em layout IVY.

**Escopo:** Word (.docx) seguindo identidade visual:
- Paleta: Olive `#3D4A3A`, Black `#0D0D0D`, Paper `#F4F0E8`, Tan `#B8A88A`, Bone `#EAE4D4`, Red `#8B1A1A` (só alertas).
- Tipografia: Impact (display, uppercase, tracking expandido) + Trebuchet MS (corpo).
- Barra olive 6-8px no topo de toda página.
- Marcadores quadrados (■), nunca círculos.
- **Sem em-dashes.** Sem gradientes. Sem border-radius > 4px. Sem emojis. Sem stock photos.

**Estrutura padrão do dossiê:**
1. Sumário executivo (meia página, tese principal, recomendações imediatas)
2. Identidade do alvo
3. Panorama empresarial
4. Panorama processual (ranqueado)
5. Estrutura internacional
6. Sinais públicos (síntese de redes/oficiais/notícias)
7. Patrimônio imobiliário
8. Linha do tempo patrimonial
9. Teses de recuperação
10. Próximos passos

**Critério de aceite:**
- Função `gerar_dossie(caso_id)` produz .docx válido.
- Layout idêntico ao manual de marca IVY v1.0.
- Operador edita versão final antes da liberação.
- Templates internos centralizados para consistência entre entregas.

---

### M9-003. Geração automática da Cadeia de Provas
**Objetivo:** mapa indexado de fontes que sustenta cada afirmação do dossiê.

**Escopo:**
- **Índice de afirmações:** toda afirmação fática do dossiê catalogada com ID.
- **Mapeamento afirmação → evidência:** cada afirmação aponta para as evidências que a sustentam.
- **Ficha de cada evidência:** fonte, URL/identificador, data/hora da coleta, coletor, excerto, classificação de confiança.
- **Ordem temática:** evidências agrupadas por bloco (empresas, processos, imóveis, internacional, oficial, mídia, redes) para facilitar juntada por categoria em peças.
- **Versionamento:** cada emissão tem versão + data; nova emissão gera diff.

**Critério de aceite:**
- Função `gerar_cadeia_provas(caso_id)` produz .docx ou PDF com índice clicável.
- Cada afirmação do dossiê tem ao menos uma evidência referenciada.
- Layout segue identidade IVY.
- Versão emitida fica imutável; nova versão gera novo registro.

> Referência operacional: o caso BLJ exigiu cadeia de 7 fontes públicas em sequência sem quebra de sigilo. Este é o padrão que o software automatiza.

---

### M-MON. Monitoramento contínuo
**Objetivo:** após cadastro do alvo, alertar sobre comunicações/publicações/eventos novos.

**Escopo:**
- Job recorrente que reexecuta módulos 2, 5, 6 para casos abertos.
- Quando entra evento patrimonial novo → notificação no painel do operador + entrada no chat do módulo 8.
- Configurável por caso (operador define se quer monitorar).

---

## D+3 — Inteligência avançada

### M-INT-001. Cruzamento de segunda camada
- Sócios de sócios.
- Vínculos familiares estendidos.
- Padrões de empresa-irmã.

### M-INT-002. Detecção automática de padrões
- Constituição reativa (empresa aberta logo após constrição contra o alvo).
- Alienação reativa (bem alienado em janela próxima a constrição).
- Endereço migrante (sede transferida em sequência para endereço de terceiro).
- Sucessão fragmentada (encerramento da empresa A + abertura da B com mesmo objeto/endereço/sócios).
- Fluxo offshore correlato (constituição no exterior em janela próxima a evento doméstico).

### M-INT-003. Calibração por perfil (aprendizado entre casos)
- LLM aprende, a partir do histórico de casos IVY, quais combinações de indícios costumam confirmar.
- Memória respeitando sigilo de cada caso.

### M-INT-004. Versão mobile (campo)
- Painel reduzido para consulta rápida em deslocamento.
- Acesso ao chat do módulo 8 e aos achados consolidados do caso.

### M8-D2. Chat — sugestões proativas
- LLM detecta padrões nos achados e abre o chat sugerindo hipóteses ao operador.
- Ex.: "detectei janela temporal entre módulo 2 e módulo 7, quer que eu construa uma hipótese?"

### M9-D2. Linha do tempo — visualização gráfica
- Linha cronológica visual.
- Faixas paralelas para os 4 eixos.
- Marcadores de eventos de alto peso.
- Duas versões: pública (cliente) e técnica (peça processual, com referências cruzadas à cadeia de provas).

---

## Pendências de produto (NÃO codificar antes de Lucas decidir)

| # | Item | Quem decide |
|---|---|---|
| Q-001 | Pesos relativos do ranqueamento do Módulo 2 | Lucas + equipe operacional |
| Q-002 | Especificação técnica dos robôs do Módulo 1 (frequência de atualização da base, política de cruzamento, performance esperada) | Lucas + CTO |
| Q-003 | Política de gate de custo do Módulo 7: faixas de autorização, perfis de operador, limites por caso | Lucas |
| Q-004 | Modelo gráfico do Dossiê e da Cadeia de Provas: layout final, exemplos, biblioteca de blocos visuais | Lucas |
| Q-005 | Plano de testes com casos históricos (Sidnei Piva, BLJ) — software deve reproduzir os achados manuais a partir do mesmo input | Lucas + equipe IVY |
| Q-006 | Tribunais além de TJSP/TJMG/TJRJ no scraping anti-homônimos (TRTs? TJDFT?) | Lucas |
| Q-007 | Provedor de LLM (modelo, contexto, política de retenção) | Lucas + CTO |
| Q-008 | Fonte da base de empresas brasileiras (Receita pública? CNPJ.ws? base paga?) | Lucas + CTO |

---

## Princípios operacionais (não-negociáveis em qualquer ticket)

1. **OSINT estrito.** Zero HUMINT. Tudo deriva de fonte pública rastreável.
2. **Toda fonte é datada e identificada.** URL/ID, timestamp, coletor, excerto. Sem exceção.
3. **Toda afirmação tem grau de confiança.** `CONFIRMADO`, `FORTE_INDICIO`, `HIPOTESE`. Nunca implícito.
4. **Operador é a última camada de decisão.** Software não promove confiança nem entrega ao cliente sem revisão humana.
5. **Privacidade respeitada.** Conteúdo público apenas. Perfis privados, engenharia social, bot detection bypass — fora de cogitação.
6. **Auditabilidade integral.** Toda ação relevante (consulta paga, promoção de confiança, geração de entregável, interação com LLM) deixa log.

---

*v1.0 — derivado do Esqueleto OSINT v1.1 (Maio 2026). Uso restrito IVY.*
