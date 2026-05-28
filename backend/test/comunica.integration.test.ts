import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, type Dispatcher } from 'undici'
import { searchComunica } from '../src/apis/comunica.js'

const COM = 'https://comunicaapi.pje.jus.br'

let agent: MockAgent
let prev: Dispatcher

beforeAll(() => {
  prev = getGlobalDispatcher()
})
afterAll(() => setGlobalDispatcher(prev))
beforeEach(() => {
  agent = new MockAgent()
  agent.disableNetConnect()
  setGlobalDispatcher(agent)
})
afterEach(async () => {
  await agent.close()
})

/** Helper para reduzir verbosidade. */
function interceptComunica(query: Record<string, string>, items: unknown[]) {
  agent
    .get(COM)
    .intercept({ path: '/api/v1/comunicacao', method: 'GET', query: { ...query, itensPorPagina: '100' } })
    .reply(200, { status: 'success', count: items.length, items })
}

describe('searchComunica — triangulação nome + CPF + empresas', () => {
  it('classifica vínculo pessoal quando alvo é destinatário', async () => {
    interceptComunica(
      { nomeParte: 'Sidnei Piva de Jesus', pagina: '1' },
      [
        {
          id: 1,
          siglaTribunal: 'TRT2',
          nomeOrgao: '10ª Turma',
          numero_processo: '00002579420155020203',
          numeroprocessocommascara: '0000257-94.2015.5.02.0203',
          nomeClasse: 'AGRAVO DE PETIÇÃO',
          tipoComunicacao: 'Distribuição',
          texto: 'Processo distribuído',
          link: 'https://pje.trt2.jus.br/x',
          destinatarios: [
            { nome: 'SIDNEI PIVA DE JESUS', polo: 'P' },
            { nome: 'PROCARTA SERVICOS LTDA', polo: 'P' },
            { nome: 'CAMILA SOUZA', polo: 'A' },
          ],
          destinatarioadvogados: [
            { advogado: { nome: 'GILCENOR SARAIVA', numero_oab: '171081', uf_oab: 'SP' } },
          ],
        },
      ],
    )
    interceptComunica({ texto: '062.567.398-09', pagina: '1' }, [])
    interceptComunica({ texto: '06256739809', pagina: '1' }, [])
    // sem busca por empresa (input vazio nesse teste)

    const result = await searchComunica({
      nome: 'Sidnei Piva de Jesus',
      cpf: '06256739809',
      empresas: [],
    })

    expect(result.processos).toHaveLength(1)
    const p = result.processos[0]
    expect(p.numero).toBe('0000257-94.2015.5.02.0203')
    expect(p.tribunal).toBe('TRT2')
    expect(p.polo).toBe('P')
    expect(p.vinculo).toBe('pessoal')

    // empresas vinculadas (PJs entre destinatários, não o alvo)
    expect(result.empresasVinculadas.map((e) => e.nome)).toContain('PROCARTA SERVICOS LTDA')
    expect(result.empresasVinculadas.map((e) => e.nome)).not.toContain('CAMILA SOUZA') // PF, não casa regex

    // advogados extraídos
    expect(result.advogados).toHaveLength(1)
    expect(result.advogados[0]).toMatchObject({ nome: 'GILCENOR SARAIVA', oab: 'SP 171081' })
  })

  it('paginação multi-página: para quando vier menos que page size', async () => {
    const pagina1 = Array.from({ length: 100 }, (_, i) => ({
      id: 100 + i,
      siglaTribunal: 'TRT2',
      nomeOrgao: 'orgão',
      numero_processo: `0000${i.toString().padStart(3, '0')}9420155020203`,
      numeroprocessocommascara: `0000${i.toString().padStart(3, '0')}-94.2015.5.02.0203`,
      nomeClasse: 'AGRAVO',
      destinatarios: [{ nome: 'ALVO PAGINADO', polo: 'P' }],
    }))
    const pagina2 = [
      {
        id: 999,
        siglaTribunal: 'TJSP',
        nomeOrgao: 'foro',
        numeroprocessocommascara: '9999999-99.2024.8.26.0100',
        nomeClasse: 'EXECUÇÃO FISCAL',
        destinatarios: [{ nome: 'ALVO PAGINADO', polo: 'P' }],
      },
    ]
    interceptComunica({ nomeParte: 'Alvo Paginado', pagina: '1' }, pagina1)
    interceptComunica({ nomeParte: 'Alvo Paginado', pagina: '2' }, pagina2)
    interceptComunica({ texto: '062.567.398-09', pagina: '1' }, [])
    interceptComunica({ texto: '06256739809', pagina: '1' }, [])

    const result = await searchComunica({
      nome: 'Alvo Paginado',
      cpf: '06256739809',
      empresas: [],
    })

    expect(result.processos).toHaveLength(101) // 100 únicos da pg1 + 1 da pg2
    expect(result.processos.some((p) => p.numero === '9999999-99.2024.8.26.0100')).toBe(true)
  })

  it('dedup por numero_processo entre páginas e múltiplas comunicações', async () => {
    // mesma comunicação repetida em 3 dias diferentes da mesma busca
    interceptComunica(
      { nomeParte: 'Repete Aí', pagina: '1' },
      [
        {
          id: 1,
          siglaTribunal: 'TRT2',
          numeroprocessocommascara: '0000257-94.2015.5.02.0203',
          nomeClasse: 'AGRAVO',
          destinatarios: [{ nome: 'REPETE AÍ', polo: 'P' }],
        },
        {
          id: 2,
          siglaTribunal: 'TRT2',
          numeroprocessocommascara: '0000257-94.2015.5.02.0203',
          nomeClasse: 'AGRAVO',
          tipoComunicacao: 'Intimação',
          destinatarios: [{ nome: 'REPETE AÍ', polo: 'P' }],
        },
      ],
    )
    interceptComunica({ texto: '062.567.398-09', pagina: '1' }, [])
    interceptComunica({ texto: '06256739809', pagina: '1' }, [])

    const result = await searchComunica({
      nome: 'Repete Aí',
      cpf: '06256739809',
      empresas: [],
    })

    expect(result.processos).toHaveLength(1)
    expect(result.processos[0].comunicacoes.length).toBeGreaterThanOrEqual(1)
  })

  it('vinculo empresarial: busca por razão social sem alvo direto', async () => {
    interceptComunica({ nomeParte: 'Alvo Indireto', pagina: '1' }, [])
    interceptComunica({ texto: '062.567.398-09', pagina: '1' }, [])
    interceptComunica({ texto: '06256739809', pagina: '1' }, [])
    interceptComunica(
      { nomeParte: 'CRUZACAO FUNDICAO LTDA', pagina: '1' },
      [
        {
          id: 50,
          siglaTribunal: 'TRT3',
          numeroprocessocommascara: '5000000-50.2020.5.03.0001',
          nomeClasse: 'CUMPRIMENTO DE SENTENÇA',
          destinatarios: [{ nome: 'CRUZACAO FUNDICAO LTDA', polo: 'P' }],
        },
      ],
    )

    const result = await searchComunica({
      nome: 'Alvo Indireto',
      cpf: '06256739809',
      empresas: ['CRUZACAO FUNDICAO LTDA'],
    })

    expect(result.processos).toHaveLength(1)
    const p = result.processos[0]
    expect(p.vinculo).toBe('empresarial')
    expect(p.empresaVinculada).toBe('CRUZACAO FUNDICAO LTDA')
  })

  it('hierarquia: processo aparece em busca por empresa E por nome → vira pessoal', async () => {
    const item = {
      id: 7,
      siglaTribunal: 'TJSP',
      numeroprocessocommascara: '1111111-11.2023.8.26.0001',
      nomeClasse: 'EXECUÇÃO FISCAL',
      destinatarios: [
        { nome: 'ALVO MISTO', polo: 'P' },
        { nome: 'EMPRESA MISTA LTDA', polo: 'P' },
      ],
    }
    // mesma comunicação retorna nas 2 buscas
    interceptComunica({ nomeParte: 'Alvo Misto', pagina: '1' }, [item])
    interceptComunica({ texto: '062.567.398-09', pagina: '1' }, [])
    interceptComunica({ texto: '06256739809', pagina: '1' }, [])
    interceptComunica({ nomeParte: 'EMPRESA MISTA LTDA', pagina: '1' }, [item])

    const result = await searchComunica({
      nome: 'Alvo Misto',
      cpf: '06256739809',
      empresas: ['EMPRESA MISTA LTDA'],
    })

    expect(result.processos).toHaveLength(1)
    expect(result.processos[0].vinculo).toBe('pessoal') // pessoal > empresarial
  })

  it('detecta criminais via regex de classe', async () => {
    interceptComunica(
      { nomeParte: 'Réu Penal', pagina: '1' },
      [
        {
          id: 1,
          siglaTribunal: 'TJSP',
          numeroprocessocommascara: '1111111-11.2023.8.26.0001',
          nomeClasse: 'AÇÃO PENAL - PROCEDIMENTO ORDINÁRIO',
          destinatarios: [{ nome: 'RÉU PENAL', polo: 'P' }],
        },
        {
          id: 2,
          siglaTribunal: 'TJSP',
          numeroprocessocommascara: '2222222-22.2023.8.26.0001',
          nomeClasse: 'EXECUÇÃO FISCAL',
          destinatarios: [{ nome: 'RÉU PENAL', polo: 'P' }],
        },
      ],
    )
    interceptComunica({ texto: '062.567.398-09', pagina: '1' }, [])
    interceptComunica({ texto: '06256739809', pagina: '1' }, [])

    const result = await searchComunica({
      nome: 'Réu Penal',
      cpf: '06256739809',
      empresas: [],
    })

    const criminais = result.processos.filter((p) => p.criminal)
    expect(criminais).toHaveLength(1)
    expect(criminais[0].classe).toMatch(/PENAL/i)
  })

  it('captura comunicacoes (data, tipo, texto limpo) por processo', async () => {
    interceptComunica(
      { nomeParte: 'Texto Rico', pagina: '1' },
      [
        {
          id: 1,
          siglaTribunal: 'TJSP',
          numeroprocessocommascara: '1234567-89.2024.8.26.0100',
          nomeClasse: 'PROCEDIMENTO COMUM CÍVEL',
          tipoComunicacao: 'Sentença',
          data_disponibilizacao: '2024-12-01',
          texto: 'Sentença <b>condenou</b> o réu ao pagamento de R$ 1.000,00.<br>Veja anexo.',
          destinatarios: [{ nome: 'TEXTO RICO', polo: 'P' }],
        },
      ],
    )
    interceptComunica({ texto: '062.567.398-09', pagina: '1' }, [])
    interceptComunica({ texto: '06256739809', pagina: '1' }, [])

    const result = await searchComunica({
      nome: 'Texto Rico',
      cpf: '06256739809',
      empresas: [],
    })

    expect(result.processos).toHaveLength(1)
    const c = result.processos[0].comunicacoes[0]
    expect(c.tipo).toBe('Sentença')
    expect(c.data).toBe('2024-12-01')
    expect(c.texto).toContain('condenou')
    expect(c.texto).not.toContain('<b>')
    expect(c.texto).toContain('\nVeja anexo')
  })
})
