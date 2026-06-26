/**
 * Mail service — booking confirmation e-mails.
 * Ready to activate: set RESEND_API_KEY (resend.com, free tier) + MAIL_FROM on
 * Render. Without a key it logs and no-ops (never blocks a booking).
 */
import { env } from '../config/env.js';

export const mailService = {
  configured(): boolean {
    return Boolean(env.resendApiKey && env.mailFrom);
  },

  async sendBookingConfirmation(to: string, data: { destination: string; ref: string; total: number; pax: number; currency?: string }): Promise<boolean> {
    if (!to || !this.configured()) return false;
    const cur = (data.currency || 'EUR') === 'EUR' ? '€' : (data.currency || 'EUR');
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0B1A33">
        <div style="background:linear-gradient(135deg,#1E63C7,#0E8FA3);color:#fff;padding:24px;border-radius:16px 16px 0 0">
          <div style="font-weight:700;font-size:18px">TravelFamily.AI</div>
          <div style="opacity:.9;font-size:14px;margin-top:4px">Votre réservation est confirmée 🎉</div>
        </div>
        <div style="border:1px solid #E2E8F2;border-top:none;border-radius:0 0 16px 16px;padding:22px">
          <p style="font-size:15px">Bonjour,</p>
          <p style="font-size:15px;line-height:1.5">Votre voyage vers <b>${data.destination}</b> est bien réservé pour <b>${data.pax} voyageur(s)</b>. Webbina reste à vos côtés pour la suite.</p>
          <table style="width:100%;font-size:14px;margin:16px 0;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#6B7A93">Référence</td><td style="text-align:right;font-weight:700">${data.ref}</td></tr>
            <tr><td style="padding:8px 0;color:#6B7A93">Total</td><td style="text-align:right;font-weight:700">${Math.round(data.total)} ${cur}</td></tr>
          </table>
          <p style="font-size:13px;color:#6B7A93;line-height:1.5">Pensez à vérifier vos formalités (passeport, visa) avant le départ. Pour toute question, répondez à cet e-mail ou ouvrez l'aide dans l'application.</p>
        </div>
      </div>`;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.mailFrom, to, subject: `Réservation confirmée — ${data.destination}`, html }),
      });
      return r.ok;
    } catch {
      return false;
    }
  },
};
