// Tracking de conversão via Google Tag Manager.
// O container GTM é carregado pelo snippet em index.html; aqui só empurramos
// eventos custom para o dataLayer. GA4/Meta Pixel/Google Ads são configurados
// dentro do GTM, sem mexer no código de novo.

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

/** Empurra um evento custom para o dataLayer (no-op se o GTM não carregou). */
export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, ...params })
}
