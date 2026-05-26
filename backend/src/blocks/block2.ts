import { searchComunica, type Comunicado, type ProgressInfo, type Vinculo } from '../apis/comunica.js'

export type Block2Processo = {
  numero: string
  tribunal: string
  orgao: string | null
  classe: string | null
  tipo: string | null
  polo: string | null
  link: string | null
  criminal: boolean
  vinculo: Vinculo | null
  empresaVinculada: string | null
  comunicacoes: Comunicado[]
}

export type Block2Result = {
  processos: Block2Processo[]
  empresasVinculadas: Array<{ nome: string; polo?: string | null }>
  advogados: Array<{ nome: string; oab?: string | null }>
  count: number
}

export type Block2Input = {
  nome: string
  cpf: string
  empresas: string[] // razões sociais do block1
  cpfParcial?: string | null
}

/**
 * Bloco 2: triangulação por nome + CPF + empresas via API Comunica do CNJ (DJEN).
 *
 * Cobertura: TJs, TRTs, TRFs e Superiores que integram ao DJEN — praticamente
 * todos os processos digitalizados ativos no Brasil. A busca por nome de cada
 * empresa do alvo capta também processos onde só a empresa é parte
 * (vínculo "empresarial") — útil para massa falida e recuperação de ativos.
 */
export async function runBlock2(
  input: Block2Input,
  onProgress: (info: ProgressInfo) => Promise<void>,
): Promise<Block2Result> {
  const comunica = await searchComunica(input, onProgress)

  return {
    processos: comunica.processos.map((p) => ({
      numero: p.numero,
      tribunal: p.tribunal,
      orgao: p.orgao,
      classe: p.classe,
      tipo: null,
      polo: p.polo,
      link: p.link,
      criminal: p.criminal,
      vinculo: p.vinculo,
      empresaVinculada: p.empresaVinculada,
      comunicacoes: p.comunicacoes,
    })),
    empresasVinculadas: comunica.empresasVinculadas,
    advogados: comunica.advogados,
    count: comunica.processos.length,
  }
}
