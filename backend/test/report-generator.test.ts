import { describe, expect, it } from 'vitest'
import { generateReport, type ReportMeta } from '../src/report/generator.js'
import type { Block1Result } from '../src/blocks/block1.js'
import type { Block2Result } from '../src/blocks/block2.js'
import type { Sancao, VinculoOffshore } from '../src/blocks/block4.js'

const b1Vazio: Block1Result = { uuid: null, cpfMasked: null, totalCapital: 0, empresas: [], warnings: [] }
const b2Vazio: Block2Result = { processos: [], empresasVinculadas: [], advogados: [], count: 0 }

const sancao: Sancao = {
  entidade: 'Fulano',
  score: 0.95,
  match: true,
  paises: ['ru'],
  programas: ['sanction'],
  listas: ['us_ofac_sdn'],
  aliases: [],
  url: 'https://www.opensanctions.org/entities/NK-1/',
}

const offshore: VinculoOffshore = {
  entidade: 'Fulano de Tal',
  tipo: 'Officer',
  dataset: 'panama-papers',
  score: 80,
  match: true,
  url: 'https://offshoreleaks.icij.org/nodes/NK-1',
}

type Internacional = { sancoes: Sancao[]; empresasExterior: []; offshore?: VinculoOffshore[] }
const gen = (meta?: ReportMeta | null, internacional?: Internacional) =>
  generateReport('Sidnei de Jesus', '06256739809', b1Vazio, b2Vazio, null, internacional ?? null, meta)

describe('generateReport — estados de bloco (não executado vs. nada encontrado)', () => {
  // Regressão (bug #2): blocos pulados/falhos não podem ser renderizados como
  // "Nenhum X encontrado", o que mente sobre o escopo da investigação.

  it('sem meta: mantém o comportamento legado ("Nenhum processo encontrado")', () => {
    const md = gen()
    expect(md).toContain('_Nenhum processo encontrado._')
    expect(md).not.toContain('não foram incluídos no escopo')
  })

  it('processos fora do escopo: marca "não executado" em vez de "nada encontrado"', () => {
    const md = gen({ plano: { processos: false, internacional: false }, falhas: [] })
    expect(md).toContain('não foram incluídos no escopo')
    expect(md).not.toContain('_Nenhum processo encontrado._')
  })

  it('processos que falharam: marca "não executado" com a mensagem da falha', () => {
    const md = gen({
      plano: { processos: true, internacional: false },
      falhas: [{ bloco: 'block2', msg: 'pje timeout' }],
    })
    expect(md).toContain('a busca de processos falhou')
    expect(md).toContain('pje timeout')
    expect(md).not.toContain('_Nenhum processo encontrado._')
  })

  it('sociedades (B1) que falharam: Empresas e Processos refletem a falha', () => {
    const md = gen({
      plano: { processos: true, internacional: false },
      falhas: [{ bloco: 'block1', msg: 'bff 500' }],
    })
    expect(md).toContain('a busca de sociedades falhou')
    expect(md).toContain('depende das sociedades')
    expect(md).not.toContain('_Nenhuma empresa encontrada._')
  })

  it('B4 parcial (uma fonte falhou mas houve resultado): marca "Resultado parcial"', () => {
    const md = gen(
      {
        plano: { processos: false, internacional: true },
        falhas: [{ bloco: 'block4', msg: 'Companies House: 500 erro' }],
      },
      { sancoes: [sancao], empresasExterior: [] },
    )
    expect(md).toContain('Resultado parcial')
    expect(md).toContain('Companies House: 500 erro')
  })

  it('B4 falhou sem resultado: marca "não executado"', () => {
    const md = gen({
      plano: { processos: false, internacional: true },
      falhas: [{ bloco: 'block4', msg: 'OpenSanctions: 429' }],
    })
    expect(md).toContain('## Buscas internacionais')
    expect(md).toContain('Bloco não executado: OpenSanctions: 429')
  })

  it('B4 no escopo, sem falha e sem resultado: "Nenhum vínculo internacional encontrado"', () => {
    const md = gen({ plano: { processos: false, internacional: true }, falhas: [] })
    expect(md).toContain('Nenhum vínculo internacional encontrado')
  })

  it('vínculos offshore (ICIJ) renderizam seção própria com dataset legível', () => {
    const md = gen(
      { plano: { processos: false, internacional: true }, falhas: [] },
      { sancoes: [], empresasExterior: [], offshore: [offshore] },
    )
    expect(md).toContain('Vínculos offshore (ICIJ Offshore Leaks)')
    expect(md).toContain('Panama Papers')
    expect(md).toContain('Fulano de Tal')
    expect(md).not.toContain('Nenhum vínculo internacional encontrado')
  })

  it('links manuais usam nome invertido (Sunbiz/Miami-Dade)', () => {
    const md = gen()
    // "Sidnei de Jesus" → "DE JESUS SIDNEI" (url-encoded no link do Sunbiz)
    expect(md).toContain('DE%20JESUS%20SIDNEI')
    expect(md).toContain('Florida Sunbiz')
    expect(md).toContain('Miami-Dade Clerk')
  })
})
