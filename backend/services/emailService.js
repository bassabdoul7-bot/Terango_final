// Email delivery via Resend HTTP API.
// Hetzner blocks outbound SMTP (port 25/465/587), so SMTP-based providers
// like Gmail can't be used. Resend uses HTTPS so it works through the firewall.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'TeranGO <noreply@terango.sn>';

async function sendEmail({ to, subject, text, html }) {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping send to ' + to);
    return { skipped: true };
  }
  if (!to || !subject) throw new Error('email: to and subject are required');

  const payload = {
    from: FROM_EMAIL,
    to: Array.isArray(to) ? to : [to],
    subject: subject
  };
  if (html) payload.html = html;
  if (text) payload.text = text;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const body = await res.text().catch(function() { return ''; });
    throw new Error('Resend ' + res.status + ': ' + body);
  }
  return await res.json();
}

module.exports = { sendEmail };
