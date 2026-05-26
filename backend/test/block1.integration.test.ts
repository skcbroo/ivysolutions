import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, type Dispatcher } from 'undici'
import { runBlock1 } from '../src/blocks/block1.js'

let agent: MockAgent
let prevDispatcher: Dispatcher

const BFF = 'https://bff.cnpja.com'
const BRASIL = 'https://brasilapi.com.br'
const OPEN = 'https://open.cnpja.com'

beforeAll(() => {
  prevDispatcher = getGlobalDispatcher()
})

afterAll(() => {
  setGlobalDispatcher(prevDispatcher)
})

beforeEach(() => {
  agent = new MockAgent()
  agent.disableNetConnect()
  setGlobalDispatcher(agent)
})

afterEach(async () => {
  agent.assertNoPendingInterceptors()
  await agent.close()
})

describe('runBlock1 — mapeamento completo CPF → empresas', () => {
  it('happy path: 2 empresas, merge CNPJa Open enriquece email/phones', async () => {
    const personId = 'uuid-fake-1234'

    agent
      .get(BFF)
      .intercept({ path: '/search', method: 'GET', query: { query: 'Sidnei Piva de Jesus' } })
      .reply(200, {
        records: [
          {
            score: 9,
            index: 'person',
            person: { id: personId, type: 'NATURAL', name: 'Sidnei Piva de Jesus', taxId: '***567398**' },
          },
        ],
      })

    agent.get(BFF).intercept({ path: `/person/${personId}`, method: 'GET' }).reply(200, {
      id: personId,
      name: 'Sidnei Piva de Jesus',
      taxId: '***567398**',
      membership: [
        {
          since: '2021-08-19',
          role: { id: 5, text: 'Administrador' },
          company: { id: '43198710', name: 'ITAPEMIRIM TRANSPORTE URBANO LTDA', equity: 170000000 },
        },
        {
          since: '2014-01-20',
          role: { id: 49, text: 'Sócio-Administrador' },
          company: { id: '11047649', name: 'VIACAO CAICARA LTDA', equity: 15500000 },
        },
      ],
    })

    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: '43198710' } }).reply(200, {
      records: [{ score: 1, index: 'office', office: { head: true, taxId: '43198710000180', company: { name: 'ITAPEMIRIM TRANSPORTE URBANO LTDA' } } }],
    })
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: '11047649' } }).reply(200, {
      records: [{ score: 1, index: 'office', office: { head: true, taxId: '11047649000184', company: { name: 'VIACAO CAICARA LTDA' } } }],
    })

    agent.get(BRASIL).intercept({ path: '/api/cnpj/v1/43198710000180' }).reply(200, {
      cnpj: '43198710000180',
      razao_social: 'ITAPEMIRIM TRANSPORTE URBANO LTDA',
      descricao_situacao_cadastral: 'INAPTA',
      data_inicio_atividade: '2021-08-19',
      capital_social: 170000000,
      ddd_telefone_1: '1123401623',
      ddd_telefone_2: '1123401660',
      qsa: [
        { nome_socio: 'SIDNEI PIVA DE JESUS', qualificacao_socio: 'Administrador', data_entrada_sociedade: '2021-08-19' },
      ],
    })
    agent.get(BRASIL).intercept({ path: '/api/cnpj/v1/11047649000184' }).reply(200, {
      cnpj: '11047649000184',
      razao_social: 'VIACAO CAICARA LTDA',
      descricao_situacao_cadastral: 'INAPTA',
      capital_social: 15500000,
      ddd_telefone_1: '1146891802',
      qsa: [],
    })

    agent.get(OPEN).intercept({ path: '/office/43198710000180' }).reply(200, {
      taxId: '43198710000180',
      emails: [{ address: 'nfe.itapemirim@itapemirim.com.br' }],
      phones: [
        { area: '11', number: '23401623' },
        { area: '11', number: '23401660' },
      ],
    })
    agent.get(OPEN).intercept({ path: '/office/11047649000184' }).reply(200, {
      taxId: '11047649000184',
      emails: [],
      phones: [{ area: '11', number: '46891802' }],
    })

    const result = await runBlock1('Sidnei Piva de Jesus', '06256739809', async () => {})

    expect(result.uuid).toBe(personId)
    expect(result.cpfMasked).toBe('062.567.398-09')
    expect(result.empresas).toHaveLength(2)
    expect(result.totalCapital).toBe(170000000 + 15500000)

    const itapemirim = result.empresas.find((e) => e.cnpj14 === '43198710000180')!
    expect(itapemirim.nome).toBe('ITAPEMIRIM TRANSPORTE URBANO LTDA')
    expect(itapemirim.capital).toBe(170000000)
    expect(itapemirim.situacao).toBe('INAPTA')
    expect(itapemirim.cargo).toBe('Administrador')
    // CNPJa Open trouxe email + 2 phones formatados (BrasilAPI veio sem email)
    expect(itapemirim.emails).toEqual(['nfe.itapemirim@itapemirim.com.br'])
    expect(itapemirim.telefones).toEqual(['(11) 2340-1623', '(11) 2340-1660'])
    expect(itapemirim.email).toBe('nfe.itapemirim@itapemirim.com.br')

    const caicara = result.empresas.find((e) => e.cnpj14 === '11047649000184')!
    expect(caicara.emails).toEqual([])
    expect(caicara.telefones).toEqual(['(11) 4689-1802'])
  })

  it('filtro homônimo: CPF parcial bate → escolhe pessoa certa mesmo com score menor', async () => {
    // CPF 00012345670 → slice(3,9) = '123456'
    agent
      .get(BFF)
      .intercept({ path: '/search', method: 'GET', query: { query: 'João da Silva' } })
      .reply(200, {
        records: [
          { score: 10, index: 'person', person: { id: 'wrong-id', type: 'NATURAL', name: 'João da Silva', taxId: '***999999**' } },
          { score: 9, index: 'person', person: { id: 'right-id', type: 'NATURAL', name: 'João da Silva', taxId: '***123456**' } },
        ],
      })
    agent.get(BFF).intercept({ path: '/person/right-id', method: 'GET' }).reply(200, {
      id: 'right-id',
      membership: [],
    })

    const result = await runBlock1('João da Silva', '00012345670', async () => {})
    expect(result.uuid).toBe('right-id')
    expect(result.empresas).toHaveLength(0)
  })

  it('homônimo estrito: nenhum candidato com CPF compatível → rejeita SEM chutar', async () => {
    // CPF 08361627146 → slice(3,9) = '616271'. Nenhum candidato bate.
    agent
      .get(BFF)
      .intercept({ path: '/search', method: 'GET', query: { query: 'Gabriel Dantas' } })
      .reply(200, {
        records: [
          { score: 99999, index: 'person', person: { id: 'errado-1', name: 'Gabriel Dantas', taxId: '***224588**' } },
          { score: 88888, index: 'person', person: { id: 'errado-2', name: 'Gabriel Dantas', taxId: '***003188**' } },
        ],
      })
    // O test deve NÃO chamar /person/errado-X — se chamar, o assertNoPendingInterceptors avisa

    const result = await runBlock1('Gabriel Dantas', '08361627146', async () => {})
    expect(result.uuid).toBeNull()
    expect(result.empresas).toHaveLength(0)
    expect(result.warnings.join(' ')).toMatch(/nenhuma tem CPF compatível/i)
  })

  it('BFF não acha pessoa → empresas vazia + warning', async () => {
    agent
      .get(BFF)
      .intercept({ path: '/search', method: 'GET', query: { query: 'Sem Pessoa Aqui' } })
      .reply(200, { records: [] })

    const result = await runBlock1('Sem Pessoa Aqui', '11122233344', async () => {})
    expect(result.empresas).toEqual([])
    expect(result.uuid).toBeNull()
    expect(result.warnings.join(' ')).toMatch(/nenhuma pessoa.*encontrada/i)
  })

  it('BrasilAPI 404 cai pra CNPJa Open como fonte primária', async () => {
    const personId = 'pid-1'
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: 'Fallback Test' } }).reply(200, {
      records: [{ score: 9, index: 'person', person: { id: personId, type: 'NATURAL', name: 'Fallback Test', taxId: '***567398**' } }],
    })
    agent.get(BFF).intercept({ path: `/person/${personId}`, method: 'GET' }).reply(200, {
      id: personId,
      membership: [
        { since: '2020-01-01', role: { text: 'Sócio' }, company: { id: '99999999', name: 'EMPRESA X LTDA', equity: 100 } },
      ],
    })
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: '99999999' } }).reply(200, {
      records: [{ score: 1, index: 'office', office: { head: true, taxId: '99999999000100', company: { name: 'EMPRESA X LTDA' } } }],
    })
    agent.get(BRASIL).intercept({ path: '/api/cnpj/v1/99999999000100' }).reply(404, { message: 'not found' })
    agent.get(OPEN).intercept({ path: '/office/99999999000100' }).reply(200, {
      taxId: '99999999000100',
      company: { name: 'EMPRESA X LTDA', equity: 500 },
      status: { text: 'ATIVA' },
      emails: [{ address: 'contato@x.com.br' }],
      phones: [{ area: '11', number: '99999999' }],
      members: [{ person: { name: 'FALLBACK TEST' }, role: { text: 'Sócio' } }],
    })

    const result = await runBlock1('Fallback Test', '06256739809', async () => {})
    expect(result.empresas).toHaveLength(1)
    const e = result.empresas[0]
    expect(e.situacao).toBe('ATIVA')
    expect(e.capital).toBe(500)
    expect(e.emails).toEqual(['contato@x.com.br'])
    expect(e.telefones).toEqual(['(11) 9999-9999'])
  })

  it('detecta alerta de email pessoal em empresa de alto capital', async () => {
    const personId = 'pid-alert'
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: 'Alvo Alto' } }).reply(200, {
      records: [{ score: 9, index: 'person', person: { id: personId, type: 'NATURAL', name: 'Alvo Alto', taxId: '***567398**' } }],
    })
    agent.get(BFF).intercept({ path: `/person/${personId}`, method: 'GET' }).reply(200, {
      id: personId,
      membership: [
        { role: { text: 'Sócio' }, company: { id: '11111111', name: 'BIG CO LTDA', equity: 5_000_000 } },
      ],
    })
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: '11111111' } }).reply(200, {
      records: [{ score: 1, index: 'office', office: { head: true, taxId: '11111111000111', company: { name: 'BIG CO LTDA' } } }],
    })
    agent.get(BRASIL).intercept({ path: '/api/cnpj/v1/11111111000111' }).reply(200, {
      cnpj: '11111111000111',
      razao_social: 'BIG CO LTDA',
      capital_social: 5_000_000,
      qsa: [],
    })
    agent.get(OPEN).intercept({ path: '/office/11111111000111' }).reply(200, {
      emails: [{ address: 'fulano@gmail.com' }],
      phones: [],
    })

    const result = await runBlock1('Alvo Alto', '06256739809', async () => {})
    expect(result.empresas[0].alertas).toContain('email pessoal em empresa de alto capital')
  })
})
