/**
 * Cliente da API OSINT (uso interno).
 * Token em localStorage; cabeçalho Authorization Bearer.
 */
const TOKEN_KEY = 'ivy_osint_token'
const USER_KEY = 'ivy_osint_user'

export type OsintRole = 'admin' | 'analista'

export type OsintUser = {
  id: number
  email: string
  nome?: string | null
  role: OsintRole
  must_change_password?: boolean
  active?: boolean
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): OsintUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as OsintUser
  } catch {
    return null
  }
}

export function setSession(token: string, user: OsintUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

type RequestOpts = RequestInit & { signal?: AbortSignal; silentAuthFailure?: boolean }

async function request<T>(path: string, init: RequestOpts = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (token) headers.authorization = `Bearer ${token}`

  const { silentAuthFailure, ...fetchInit } = init
  const res = await fetch(path, { ...fetchInit, headers })
  const text = await res.text()
  const body = text ? safeJson(text) : null
  if (!res.ok) {
    // Em chamadas de polling de background, NÃO derrubar a sessão:
    // um 401 transiente (rede instável, deploy do backend, JWT expirando entre
    // requests) jogaria o usuário pro login no meio do uso. O próximo poll
    // tenta de novo; se for 401 real, a próxima ação interativa derruba.
    if (res.status === 401 && !silentAuthFailure) clearSession()
    throw new ApiError(res.status, body, (body as { error?: string })?.error ?? `HTTP ${res.status}`)
  }
  return body as T
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export type InvestigacaoLite = {
  id: string
  created_at: string
  updated_at: string
  nome: string
  cpf: string
  status: 'pendente' | 'rodando' | 'concluido' | 'concluido_parcial' | 'erro'
  progresso: {
    bloco_atual?: string
    etapa?: string
    atual?: number
    total?: number
    eta_ms?: number | null
  }
  capital_total: string | null
  pje_count: number | null
  erro_msg: string | null
}

export type Empresa = {
  id: string
  cnpj14: string
  nome: string | null
  nome_fantasia: string | null
  situacao: string | null
  data_situacao: string | null
  abertura: string | null
  capital: string | null
  cnae: string | null
  natureza: string | null
  porte: string | null
  cargo: string | null
  data_entrada: string | null
  endereco: string | null
  email: string | null
  telefone: string | null
  emails: string[]
  telefones: string[]
  qsa: Array<{ nome_socio?: string; qualificacao_socio?: string; data_entrada_sociedade?: string }>
  alertas: string[]
}

export type Processo = {
  id: string
  numero: string
  tribunal: string | null
  orgao: string | null
  classe: string | null
  tipo: string | null
  polo: string | null
  link: string | null
  criminal: boolean
  vinculo: 'pessoal' | 'cpf' | 'empresarial' | null
  empresa_vinculada: string | null
  comunicacoes: Array<{ data: string | null; tipo: string | null; texto: string; link: string | null }>
  analise_llm: string | null
}

export type Advogado = { id: string; nome: string; oab: string | null }
export type EmpresaVinculada = { id: string; nome: string; polo: string | null }

export type Sancao = {
  entidade: string
  score: number | null
  match: boolean
  paises: string[]
  programas: string[]
  listas: string[]
  aliases: string[]
  url: string | null
}

export type EmpresaExterior = {
  officer: string
  empresa: string
  numero: string | null
  jurisdicao: string
  cargo: string | null
  entrada: string | null
  saida: string | null
  url: string | null
  score: number | null
}

export type InvestigacaoFull = InvestigacaoLite & {
  uuid_cnpja: string | null
  cpf_mascarado: string | null
  warnings: string[]
  empresas: Empresa[]
  processos: Processo[]
  advogados: Advogado[]
  empresas_vinculadas: EmpresaVinculada[]
  sancoes: Sancao[]
  empresas_exterior: EmpresaExterior[]
  falhas: Falha[]
  relatorio_md: string | null
  relatorio_gerado_em: string | null
}

export type Falha = { bloco: string; msg: string }

export type StatusResponse = {
  status: InvestigacaoLite['status']
  progresso: InvestigacaoLite['progresso']
  capital_total: string | null
  pje_count: number | null
  erro_msg: string | null
  falhas?: Falha[]
}

export type AdminUser = OsintUser & {
  active: boolean
  must_change_password: boolean
  created_at: string
}

export type Opcoes = {
  processos: boolean
  analiseLlm: boolean
  internacional: { opensanctions: boolean; companiesHouse: boolean }
}

export type Capabilities = {
  processos: boolean
  analiseLlm: boolean
  internacional: boolean
  opensanctions: boolean
  companiesHouse: boolean
}

export const osintApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: OsintUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, nome?: string) =>
    request<OsintUser>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nome }),
    }),

  me: () => request<AdminUser>('/api/auth/me'),

  changeMyPassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/api/auth/me/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  listUsers: () => request<AdminUser[]>('/api/users'),

  createUser: (email: string, nome: string, role: OsintRole) =>
    request<AdminUser & { default_password: string }>('/api/users', {
      method: 'POST',
      body: JSON.stringify({ email, nome, role }),
    }),

  patchUser: (id: number, patch: Partial<{ email: string; nome: string; role: OsintRole; active: boolean }>) =>
    request<AdminUser>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  resetUserPassword: (id: number) =>
    request<{ ok: true; default_password: string }>(`/api/users/${id}/reset-password`, {
      method: 'POST',
    }),

  capabilities: (signal?: AbortSignal) =>
    request<Capabilities>('/api/investigacoes/capabilities', { signal }),

  criarInvestigacao: (nome: string, cpf: string, opcoes?: Opcoes) =>
    request<InvestigacaoLite>('/api/investigacoes', {
      method: 'POST',
      body: JSON.stringify({ nome, cpf, opcoes }),
    }),

  listar: (signal?: AbortSignal) =>
    request<InvestigacaoLite[]>('/api/investigacoes', { signal, silentAuthFailure: true }),

  status: (id: number | string, signal?: AbortSignal) =>
    request<StatusResponse>(`/api/investigacoes/${id}/status`, { signal, silentAuthFailure: true }),

  buscar: (id: number | string, signal?: AbortSignal) =>
    request<InvestigacaoFull>(`/api/investigacoes/${id}`, { signal, silentAuthFailure: true }),
}

export { ApiError }
