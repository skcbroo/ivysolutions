import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OsintLayout } from '../../../components/osint/Layout'
import { StatusBadge } from '../../../components/osint/StatusBadge'
import { useVisibleInterval } from '../../../hooks/useVisibleInterval'
import { isAbortError, osintApi, type InvestigacaoFull } from '../../../lib/osint'
import { DossieProtocolo } from './DossieProtocolo'
import { formatBRL, formatDateTime } from './format'
import { RunningPanel } from './RunningPanel'
import { SancoesFlag } from './SancoesFlag'
import { TabEmpresas } from './TabEmpresas'
import { TabProcessos } from './TabProcessos'
import { TabRelatorio } from './TabRelatorio'
import { TabTimeline } from './TabTimeline'
import { panelId, tabId, TabPanel, Tabs, type Tab } from './Tabs'

// Re-exports públicos para testes e outros consumidores
export { Tabs } from './Tabs'
export { SortableTh, FilterChip } from './Tabs'
export { ContatoToggle, ContatoCell } from './TabEmpresas'

const isFinal = (s: string) => s === 'concluido' || s === 'concluido_parcial' || s === 'erro'

const BLOCO_LABEL: Record<string, string> = {
  block1: 'Sociedades',
  block2: 'Processos',
  block3: 'Análise patrimonial (IA)',
  block4: 'Buscas internacionais',
}

export function Relatorio() {
  const { id } = useParams()
  const [data, setData] = useState<InvestigacaoFull | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('empresas')
  const fullAbort = useRef<AbortController | null>(null)
  const statusAbort = useRef<AbortController | null>(null)
  const doneRef = useRef(false)

  const loadFull = useCallback(async () => {
    if (!id) return
    fullAbort.current?.abort()
    const ctl = new AbortController()
    fullAbort.current = ctl
    try {
      const d = await osintApi.buscar(id, ctl.signal)
      setData(d)
      setError(null)
      if (isFinal(d.status)) doneRef.current = true
    } catch (err) {
      if (isAbortError(err)) return
      setError(err instanceof Error ? err.message : 'erro de rede')
    }
  }, [id])

  const tick = useCallback(async () => {
    if (!id || doneRef.current) return
    statusAbort.current?.abort()
    const ctl = new AbortController()
    statusAbort.current = ctl
    try {
      const s = await osintApi.status(id, ctl.signal)
      setData((prev) =>
        prev
          ? {
              ...prev,
              status: s.status,
              progresso: s.progresso,
              capital_total: s.capital_total ?? prev.capital_total,
              pje_count: s.pje_count ?? prev.pje_count,
              erro_msg: s.erro_msg,
            }
          : prev,
      )
      if (isFinal(s.status)) {
        doneRef.current = true
        await loadFull()
      }
    } catch (err) {
      if (isAbortError(err)) return
      /* falha de rede transiente — próximo tick tenta de novo */
    }
  }, [id, loadFull])

  // primeiro fetch completo
  useEffect(() => {
    doneRef.current = false
    void loadFull()
    return () => {
      fullAbort.current?.abort()
      statusAbort.current?.abort()
    }
  }, [loadFull])

  // polling de status (pausa quando aba oculta, para quando concluído)
  useVisibleInterval(tick, 4_000)

  if (error) {
    return (
      <OsintLayout protocol="Protocolo · Erro" title="Não foi possível abrir o dossiê.">
        <div className="ivy-page pb-20">
          <p role="alert" className="ivy-meta" style={{ color: 'var(--color-ivy-blood)' }}>
            {error}
          </p>
          <div className="mt-6 flex items-center gap-6">
            <button
              type="button"
              onClick={loadFull}
              className="ivy-meta"
              style={{
                background: 'var(--color-ivy-olive)',
                color: 'var(--color-ivy-bone)',
                padding: '12px 22px',
                border: 0,
                letterSpacing: '0.3em',
                fontSize: 12,
              }}
            >
              Tentar novamente
            </button>
            <Link
              to="/osint"
              className="ivy-meta"
              style={{ color: 'var(--color-ivy-mid)', padding: '12px 0' }}
            >
              ← Voltar
            </Link>
          </div>
        </div>
      </OsintLayout>
    )
  }

  if (!data) {
    return (
      <OsintLayout protocol="Protocolo · Carregando" title="Recuperando dossiê...">
        <div className="ivy-page pb-20">
          <p className="ivy-meta" style={{ color: 'var(--color-ivy-mid)' }}>aguarde</p>
        </div>
      </OsintLayout>
    )
  }

  const isRunning = data.status === 'rodando' || data.status === 'pendente'
  const totalProcessos = data.processos.length || (data.pje_count ?? 0)
  const criminais = data.processos.filter((p) => p.criminal).length

  return (
    <OsintLayout
      protocol={`Dossiê #${data.id}`}
      title={data.nome}
      subtitle={
        <>
          CPF <span style={{ fontVariantNumeric: 'tabular-nums' }}>{data.cpf}</span>
          {' · '}
          Aberto em {formatDateTime(data.created_at)}
        </>
      }
      rightSlot={<StatusBadge status={data.status} />}
    >
      <div className="ivy-page pb-[clamp(64px,8vw,120px)]">
        <hr className="ivy-rule-olive mb-10" />

        {isRunning && <RunningPanel progresso={data.progresso} />}

        {(data.warnings?.length ?? 0) > 0 && (
          <div
            role="alert"
            className="mb-10 p-6"
            style={{
              border: '1px solid var(--color-ivy-blood)',
              background: 'oklch(0.36 0.135 28 / 0.06)',
            }}
          >
            <p className="ivy-meta" style={{ color: 'var(--color-ivy-blood)' }}>
              ⚠ Atenção: identificação do alvo
            </p>
            <ul className="ivy-list mt-3" style={{ color: 'var(--color-ivy-near)' }}>
              {data.warnings.map((w, i) => (
                <li key={i} style={{ fontSize: 'clamp(14px,1vw,16px)', lineHeight: 1.5 }}>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        <SancoesFlag sancoes={data.sancoes ?? []} />

        {data.status === 'concluido_parcial' && (data.falhas?.length ?? 0) > 0 && (
          <div
            className="mb-10 p-6"
            style={{ border: '1px solid var(--color-ivy-blood)', background: 'oklch(0.36 0.135 28 / 0.06)' }}
          >
            <p className="ivy-meta" style={{ color: 'var(--color-ivy-blood)' }}>
              ⚠ Investigação concluída parcialmente
            </p>
            <p className="mt-2" style={{ color: 'var(--color-ivy-mid)', fontSize: 14, lineHeight: 1.5 }}>
              Alguns blocos falharam e foram omitidos. O restante do dossiê está completo.
            </p>
            <ul className="ivy-list mt-3" style={{ color: 'var(--color-ivy-near)' }}>
              {data.falhas.map((f, i) => (
                <li key={i} style={{ fontSize: 'clamp(14px,1vw,16px)', lineHeight: 1.5 }}>
                  <strong>{BLOCO_LABEL[f.bloco] ?? f.bloco}:</strong> {f.msg}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.status === 'erro' && data.erro_msg && (
          <div
            className="mb-10 p-6 border"
            style={{ borderColor: 'var(--color-ivy-blood)' }}
          >
            <p className="ivy-meta" style={{ color: 'var(--color-ivy-blood)' }}>
              Falha
            </p>
            <p className="mt-2" style={{ color: 'var(--color-ivy-near)', fontSize: 'clamp(14px,1vw,16px)' }}>
              {data.erro_msg}
            </p>
          </div>
        )}

        <DossieProtocolo
          empresas={data.empresas.length}
          capital={formatBRL(data.capital_total)}
          processos={totalProcessos}
          criminais={criminais}
        />
        <hr className="ivy-rule-olive mb-10" />

        <Tabs
          tab={tab}
          onChange={setTab}
          counts={{
            empresas: data.empresas.length + (data.empresas_exterior?.length ?? 0),
            processos: totalProcessos,
          }}
        />

        {/* Os 3 painéis ficam SEMPRE no DOM (com hidden quando inativos)
            para que aria-controls aponte para IDs válidos a qualquer momento.
            O conteúdo pesado só é montado na tab ativa. */}
        <TabPanel id={panelId('empresas')} labelledBy={tabId('empresas')} hidden={tab !== 'empresas'}>
          {tab === 'empresas' && <TabEmpresas data={data} />}
        </TabPanel>
        <TabPanel id={panelId('processos')} labelledBy={tabId('processos')} hidden={tab !== 'processos'}>
          {tab === 'processos' && <TabProcessos data={data} />}
        </TabPanel>
        <TabPanel id={panelId('timeline')} labelledBy={tabId('timeline')} hidden={tab !== 'timeline'}>
          {tab === 'timeline' && <TabTimeline data={data} />}
        </TabPanel>
        <TabPanel id={panelId('relatorio')} labelledBy={tabId('relatorio')} hidden={tab !== 'relatorio'}>
          {tab === 'relatorio' && <TabRelatorio md={data.relatorio_md} />}
        </TabPanel>
      </div>
    </OsintLayout>
  )
}
