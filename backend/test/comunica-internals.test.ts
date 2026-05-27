import { describe, expect, it } from 'vitest'
import { __internals__ } from '../src/apis/comunica.js'

const { isEmpresa, strongerVinculo, cleanTexto, CRIMINAL_RX } = __internals__

describe('isEmpresa — heurística PJ', () => {
  it('reconhece LTDA, S/A, EIRELI', () => {
    expect(isEmpresa('ITAPEMIRIM TRANSPORTE URBANO LTDA')).toBe(true)
    expect(isEmpresa('TRANSPORTADORA ITAPEMIRIM S/A')).toBe(true)
    expect(isEmpresa('VIACAO X EIRELI')).toBe(true)
  })
  it('reconhece entes públicos', () => {
    expect(isEmpresa('UNIÃO FEDERAL (PGFN)')).toBe(true)
    expect(isEmpresa('MUNICÍPIO DE SÃO PAULO')).toBe(true)
    expect(isEmpresa('CAIXA ECONÔMICA FEDERAL')).toBe(true)
    expect(isEmpresa('INSS')).toBe(true)
  })
  it('não confunde pessoa física com PJ', () => {
    expect(isEmpresa('Sidnei Piva de Jesus')).toBe(false)
    expect(isEmpresa('Maria da Silva')).toBe(false)
    expect(isEmpresa('João das Neves')).toBe(false)
  })
})

describe('strongerVinculo — hierarquia pessoal > cpf > empresarial', () => {
  it('pessoal vence sempre', () => {
    expect(strongerVinculo('pessoal', 'cpf')).toBe('pessoal')
    expect(strongerVinculo('empresarial', 'pessoal')).toBe('pessoal')
  })
  it('cpf vence empresarial', () => {
    expect(strongerVinculo('cpf', 'empresarial')).toBe('cpf')
    expect(strongerVinculo('empresarial', 'cpf')).toBe('cpf')
  })
  it('idempotente', () => {
    expect(strongerVinculo('pessoal', 'pessoal')).toBe('pessoal')
    expect(strongerVinculo('empresarial', 'empresarial')).toBe('empresarial')
  })
})

describe('CRIMINAL_RX — classificação por classe', () => {
  const cases: Array<[string, boolean]> = [
    ['Ação Penal - Procedimento Ordinário', true],
    ['Habeas Corpus Criminal', true],
    ['Inquérito Policial', true],
    ['Execução Penal', true],
    ['Correição Parcial Criminal', true],
    ['Procedimento Comum Cível', false],
    ['Execução Fiscal', false],
    ['Apelação Cível', false],
    ['Falência de Empresários', false],
    ['Recurso em Sentido Estrito', true],
  ]
  it.each(cases)('"%s" => criminal=%s', (classe, expected) => {
    expect(CRIMINAL_RX.test(classe)).toBe(expected)
  })
})

describe('cleanTexto — sanitiza HTML do DJEN', () => {
  it('remove tags básicas', () => {
    expect(cleanTexto('Processo <b>123</b> distribuído')).toBe('Processo 123 distribuído')
  })
  it('quebra de linha vira \\n', () => {
    expect(cleanTexto('linha 1<br>linha 2<br/>linha 3')).toBe('linha 1\nlinha 2\nlinha 3')
  })
  it('decodifica entities comuns', () => {
    expect(cleanTexto('a &amp; b &lt;c&gt; &quot;d&quot;')).toBe('a & b <c> "d"')
  })
  it('colapsa whitespace e trim', () => {
    expect(cleanTexto('  muito   espaço   aqui  ')).toBe('muito espaço aqui')
  })
  it('trunca em ~1200 chars com elipse', () => {
    const long = 'x'.repeat(2000)
    const out = cleanTexto(long)
    expect(out.length).toBeLessThanOrEqual(1201)
    expect(out.endsWith('…')).toBe(true)
  })
})
