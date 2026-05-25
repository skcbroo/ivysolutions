# DESIGN — IVY Recuperação de Ativos

## Named reference
"Dossiê desclassificado anos 70/80. Papel envelhecido olive-paper. Carimbos sangue desbotados. Numeração de protocolo. Redações FOIA pretas sobre identificadores. Tipografia institucional bruta."

## Color strategy
**Committed.** Olive carrega 40–50% da superfície via blocos de seção e elementos estruturais. Paper/black alternam como containers de leitura. Sangue aparece em três momentos cirúrgicos apenas: barra vertical do hero, redações FOIA nos cases, confirmação do form. Tan é a tinta dos fios finos. Bone é o "branco" sobre fundo escuro.

OKLCH (tinted toward olive hue ~120):
- `--ivy-olive:    oklch(0.32 0.025 130)` ≈ #3D4A3A
- `--ivy-olive-2:  oklch(0.23 0.020 130)` ≈ #2B3528 (hover/active)
- `--ivy-paper:    oklch(0.94 0.012 90)`  ≈ #F4F0E8
- `--ivy-bone:     oklch(0.91 0.018 88)`  ≈ #EAE4D4
- `--ivy-tan:      oklch(0.72 0.030 80)`  ≈ #B8A88A
- `--ivy-sand:     oklch(0.83 0.028 84)`  ≈ #D4C9A8
- `--ivy-black:    oklch(0.12 0.003 130)` ≈ #0D0D0D (tinted off pure black)
- `--ivy-charcoal: oklch(0.22 0.003 130)` ≈ #2C2C2C
- `--ivy-blood:    oklch(0.36 0.135 28)`  ≈ #8B1A1A
- `--ivy-mid:      oklch(0.50 0.005 130)` ≈ #6B6B6B (labels)
- `--ivy-near:     oklch(0.16 0.003 130)` ≈ #1A1A1A (body text)

## Typography
Duas famílias, locked pelo manual. Sem terceira voz mono — Trebuchet uppercase tracked já cobre metadata (decisão revisada: IBM Plex Mono reflex-rejeitado pelo impeccable, e adicionar uma terceira voz mono na LP de uma empresa não-dev vira costume).

- **Display**: `'Impact', 'Haettenschweiler', 'Arial Narrow Bold', sans-serif`. Caixa alta sempre, tracking +200 a +400.
- **Corpo**: `'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', sans-serif`. Sentence case para corpo, UPPERCASE tracked 0.3em para labels/metadata, UPPERCASE tracked 0.15em para footer/timestamps.

### Scale (mobile → desktop, fluid)
- `--fs-mega`: `clamp(72px, 22vw, 240px)` — IVY hero word, único caso.
- `--fs-h1`:   `clamp(40px, 8vw, 96px)` — section headlines.
- `--fs-h2`:   `clamp(28px, 4.5vw, 56px)` — sub-headlines.
- `--fs-h3`:   `clamp(20px, 2.4vw, 32px)`
- `--fs-num`:  `clamp(40px, 7vw, 88px)` — Impact números destaque.
- `--fs-body`: `clamp(15px, 1.05vw, 17px)` — Trebuchet corpo, line-height 1.65.
- `--fs-meta`: `11px` mobile, `12px` desktop — Trebuchet uppercase tracked 0.3em.
- `--fs-foot`: `10px` mobile, `11px` desktop — tracked 0.15em.

Ratio entre h3 → h2 ≥ 1.4. h2 → h1 ≥ 1.5. Forte contraste, sem flatness.

## Layout system
12 colunas estritas, gutter 16px mobile, 24px desktop, max-width 1440px, page margin `clamp(20px, 5vw, 96px)`. Asymmetria por colunas vazias e por sangrar headlines pra fora da grid à esquerda.

### Document header (named brand system)
**Não é** "uppercase tracked kicker decorativo" (reflex). **É** a faixa real de protocolo de um documento institucional, presente em TODA seção, com 4 campos:

```
ARQUIVO IVY-002 · CLASSIFICAÇÃO: SIGILO INSTITUCIONAL · SEÇÃO 03/08 · 2026.05.25
```

Renderização: faixa topo da seção, 32px altura, fundo `--ivy-paper` ou `--ivy-charcoal` conforme, texto `--ivy-mid` em Trebuchet uppercase 11px tracking 0.3em, divisores `·` em `--ivy-tan`. Sob ela, fio horizontal 1px `--ivy-tan`. Isso é a assinatura: cada bloco do site é um pedaço do dossiê.

### Section anchors
- Hero: black. Sangue vertical bar 4px à esquerda do bloco de texto principal.
- Posicionamento: paper. Duas colunas (8/4 desktop, 1col mobile).
- Metodologia: split 50/50 paper/olive vertical em desktop, stack em mobile. 4 etapas com tratamentos DIFERENTES entre si (não card grid).
- Cases: paper. Dois "arquivos" verticais, layout de relatório real com redações pretas sobre identificadores (CPF, CNPJ, nome).
- Quem opera: charcoal. Sem fotos. Texto curto + números grandes inline no corpo (não stat card).
- Termos: paper. Tabela densa em formato FAQ.
- Contato: black. Form de uma coluna. Borda tan, fundo transparente. Botão olive sólido.
- Footer: olive. Texto bone tracked.

## Motion philosophy
- **Zero entrance animation.** Página carrega instantaneamente, 3D já a meio-frame quando o usuário chega. Sem stagger reveal — visitante é tratado como alguém que já tem acesso ao documento.
- **Único espetáculo**: a cena 3D scroll-driven (jornada do dinheiro) em wireframe olive sobre preto.
- Hover desktop: cursor crosshair `+` em zonas clicáveis. Sem hover playful em cards.
- Transições só em propriedades transform/opacity/filter, nunca layout.
- `prefers-reduced-motion`: 3D substituído por sequência SVG estática + texto.
- Easing único: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo). Duração 400ms padrão, 800ms para o pulse do selo.

## Imagery
A imagem do site é o 3D WebGL: wireframe low-poly em fio olive sobre preto, sem PBR, sem reflexo cromado, fog leve. Quatro cenas:

1. **PERDIDO** — nota wireframe cai e desaparece numa malha subterrânea.
2. **MAPEADO** — grafo de empresas/sócios; nós críticos em sangue.
3. **EXPOSTO** — ativos ocultos (imóvel, conta) emergem como blocos sólidos.
4. **RETORNADO** — blocos voltam em seta ao cubo "credor".

Render: Three.js + R3F + Drei `useScroll`. Materiais: `MeshBasicMaterial` para edges, `LineBasicMaterial` para fios. Frametime budget mobile 33ms (30fps), desktop 16ms.

Nenhuma stock photo. Nenhum ícone genérico. O 3D é a imagem.

## Decorative system
- **Barra olive 6px topo do site inteiro** (não da seção — do site).
- **Selo "RESERVADO"**: SVG circular ~120px, contorno duplo, número de protocolo no centro, Impact uppercase. Aparece UMA vez por sessão na entrada da seção Cases, pulsa 600ms, fica estático depois.
- **Redação FOIA**: barras pretas sólidas `--ivy-black` cobrindo identificadores (CPF `███.███.███-██`, CNPJ, nomes de empresa). Não é decoração — é o jeito de mostrar sigilo sem dizer "sigilo".
- **Fio horizontal**: 1px `--ivy-tan` separa blocos dentro de uma seção.
- **Barra olive 3–4px abaixo de h1 de seção**.
- **Marcadores quadrados** ■ olive em listas. Nunca ●.
- **Noise SVG sutil** em fundos paper (opacity .035). Texture papel envelhecido.
- **Scanlines 1px / 4px** em fundos black, opacity .03.

## Banned (instance-specific, on top of impeccable defaults)
- Carrousel de logos de clientes (a IVY não exibe clientes).
- Stats cards "Big number / small label" em grid de 3 — números aparecem inline em parágrafo ou como dado de protocolo de caso.
- Carrousel/slider de depoimentos.
- Ícones em círculo.
- "Hero metric template".
- Live chat / floating WhatsApp redondo verde.
- Selo "100% seguro" / cadeado / certificados SSL no footer.
