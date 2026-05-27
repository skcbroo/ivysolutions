import PQueue from 'p-queue'

// cnpj.biz: scraping com throttle conservador (1 req / 2s).
export const cnpjbizQueue = new PQueue({ concurrency: 1, interval: 2_000, intervalCap: 1 })

// Comunica DJEN: rate-limit observado em produção (~429 após bursts).
// Mantemos 2 req/s, com retry em 429 via backoff no cliente.
export const comunicaQueue = new PQueue({ concurrency: 1, interval: 500, intervalCap: 1 })

// CNPJa Open: free tier informal ~5 req/min. Throttle 1 req/s (~60 req/min)
// não é confiável; ficamos em 1 req/1.5s (~40 req/min). 43 empresas levam ~65s.
export const cnpjaOpenQueue = new PQueue({ concurrency: 1, interval: 1500, intervalCap: 1 })
