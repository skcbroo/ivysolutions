/**
 * Em dev: Vite proxia /api → backend local (vite.config.ts)
 * Em prod: nginx do frontend proxia /api → backend Railway (nginx.conf.template)
 * Mesmo origin nos dois casos — zero CORS no browser.
 */
export const apiUrl = (path: string) => path
