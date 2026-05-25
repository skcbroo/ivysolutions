# PRODUCT — IVY Recuperação de Ativos

## Register
brand

## Product purpose
Landing page de captação para a IVY, empresa de inteligência aplicada à recuperação de ativos de devedores contumazes. O site é o produto: ele apresenta a operação, qualifica leads de alto ticket (créditos a partir de R$500k individual / R$5M em carteira) e abre conversa via formulário sigiloso. Não há fluxo transacional, não há login, não há autoatendimento.

## Users
- **Diretor jurídico / contencioso** de empresas com carteira de inadimplência relevante.
- **Sócio de escritório de advocacia** com execuções travadas e cliente cobrando resultado.
- **Investidor / gestor de NPL** avaliando teses de recuperação.
- Todos: sofisticados, céticos a marketing, alta sensibilidade a sigilo, decisão racional baseada em prova de método.

## Brand voice (do manual oficial v1.0)
- Sóbria: comunicação direta, sem adjetivos desnecessários. Cada palavra tem peso.
- Misteriosa: não revelamos tudo. O não-dito comunica.
- Operacional: tom de briefing, não de marketing.
- Precisa: dados, fatos, resultados. Sem promessas vagas, sem superlativos.

Três palavras-âncora do objeto físico que o site precisa ser: **briefing, dossiê, relatório de inteligência**.

Exemplos canônicos:
- ✓ "Levantamentos iniciais apontam movimentação compatível com ocultação."
- ✗ "Descobrimos evidências chocantes de fraude!"
- ✓ "O tempo é um fator crítico para o resultado."
- ✗ "Corra! Cada segundo conta! Aja agora!"

## Strategic principles
1. **IVY não pede, apresenta. Não convence, demonstra.** Zero urgência artificial. Substituir "escassez" por evidência de método e custo do tempo perdido (frase real do manual).
2. **Sigilo é diferencial, não slogan.** Nomes de clientes, valores e técnicas operacionais são parcialmente redigidos no próprio layout (estilo FOIA), porque é assim que a IVY trata informação.
3. **Densidade vence ornamento.** Texto técnico, números reais, vocabulário do setor (NPL, desconsideração, blindagem patrimonial, grupo econômico). Nenhuma metáfora genérica.
4. **A IVY não é cobrança. Não é advocacia. Não é software.** Esta negação tripla é o posicionamento — deve aparecer literal na LP.

## Anti-references
- Sites corporativos jurídicos com stock photo de aperto-de-mão, gavel, balança de justiça.
- "Premium luxo" com Playfair italic + dourado.
- Tech-startup com Inter + gradient roxo + cards iguais com ícones em círculo.
- Cyberpunk "hacker" com Matrix verde + glitch + chevron caps.
- Editorial-magazine genérico (Fraunces + drop cap + colunas com fio).
- O próprio mxativos.com.br: fontes genéricas, scroll pesado, hero com vídeo.

## Visual reference (physical object)
Um documento desclassificado real, anos 1970–80: papel paper-bone levemente envelhecido, carimbo "SIGILO INSTITUCIONAL" em sangue desbotado, headers com numeração de protocolo, blocos olive de seção, redações em barra preta sólida cobrindo identificadores. Não é estética cyberpunk de filme — é a coisa real, feia-funcional, austera.

## Hard constraints
- Mobile-first. Leads vão suar muito no celular.
- Performance: scroll fluido em iPhone de 2 anos. 3D com fallback `prefers-reduced-motion`.
- Identidade tipográfica e cromática travada pelo manual de marca v1.0 (não negociável):
  - Fontes: Impact (display) + Trebuchet MS (corpo + metadata). Apenas duas.
  - Paleta: olive `#3D4A3A` / paper `#F4F0E8` / bone `#EAE4D4` / tan `#B8A88A` / sangue `#8B1A1A` / preto `#0D0D0D` / charcoal `#2C2C2C`.
  - Sangue jamais como fundo. Apenas em redações, selos, alerta pontual.
  - Sem gradientes. Sem sombras difusas. Sem border-radius > 4px.
- Deploy: Railway. Frontend Vite estático + backend Node + Postgres.
