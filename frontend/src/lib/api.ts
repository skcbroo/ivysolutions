/**
 * Base URL da API. Em dev fica vazio (Vite proxia /api → backend local).
 * Em produção, VITE_API_URL é injetada no build do Docker (Railway build arg)
 * apontando para o domínio público do backend.
 */
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const apiUrl = (path: string) => `${API_BASE}${path}`
