import nodemailer, { type Transporter } from 'nodemailer'
import { config } from './config.js'

let cached: Transporter | null = null

function transporter(): Transporter | null {
  if (cached) return cached
  if (
    !config.SMTP_HOST ||
    !config.SMTP_PORT ||
    !config.SMTP_USER ||
    !config.SMTP_PASS
  ) {
    return null
  }
  cached = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  })
  return cached
}

type LeadEmail = {
  name: string
  email: string
  phone: string
  ip?: string
  userAgent?: string
}

/** Envia notificação para o operador. Fire-and-forget. */
export async function notifyLead(lead: LeadEmail) {
  const t = transporter()
  if (!t || !config.LEAD_TO_EMAIL) {
    console.log('[mailer] SMTP não configurado — lead recebido:', lead)
    return
  }

  const from = config.LEAD_FROM_EMAIL || config.SMTP_USER!
  const html = `
    <div style="font-family: -apple-system, sans-serif; color: #1A1A1A; line-height: 1.5;">
      <h2 style="font-family: Impact, sans-serif; letter-spacing: 0.05em; text-transform: uppercase; border-bottom: 3px solid #3D4A3A; padding-bottom: 8px;">Novo lead — IVY</h2>
      <table style="border-collapse: collapse; margin-top: 16px;">
        <tr><td style="padding: 6px 16px 6px 0; color: #6B6B6B; text-transform: uppercase; font-size: 11px; letter-spacing: 0.2em;">Nome</td><td style="padding: 6px 0;">${escapeHtml(lead.name)}</td></tr>
        <tr><td style="padding: 6px 16px 6px 0; color: #6B6B6B; text-transform: uppercase; font-size: 11px; letter-spacing: 0.2em;">E-mail</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>
        <tr><td style="padding: 6px 16px 6px 0; color: #6B6B6B; text-transform: uppercase; font-size: 11px; letter-spacing: 0.2em;">Telefone</td><td style="padding: 6px 0;">${escapeHtml(formatPhoneBR(lead.phone))}</td></tr>
        ${lead.ip ? `<tr><td style="padding: 6px 16px 6px 0; color: #999; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em;">Origem</td><td style="padding: 6px 0; color: #999; font-size: 12px;">${escapeHtml(lead.ip)}</td></tr>` : ''}
      </table>
    </div>
  `

  try {
    console.log(
      `[mailer] tentando enviar para ${config.LEAD_TO_EMAIL} via ${config.SMTP_HOST}:${config.SMTP_PORT}`,
    )
    const info = await t.sendMail({
      from: `"IVY · Briefing" <${from}>`,
      to: config.LEAD_TO_EMAIL,
      replyTo: lead.email,
      subject: `[IVY] Novo lead — ${lead.name}`,
      text: `Nome: ${lead.name}\nE-mail: ${lead.email}\nTelefone: ${formatPhoneBR(lead.phone)}`,
      html,
    })
    console.log(`[mailer] envio ok — messageId=${info.messageId}`)
  } catch (err) {
    console.error('[mailer] envio falhou:', err)
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatPhoneBR(digits: string) {
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return digits
}
