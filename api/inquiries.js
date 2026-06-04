// Vercel serverless function: receives booking-form submissions and forwards
// them to the Go High Level (GHL) Inbound Webhook. All CRM logic (contact
// creation, pipeline, emails, SMS) lives in the GHL workflow — this function
// only validates input, blocks obvious spam, and relays the data.
//
// The GHL webhook URL is read from the GHL_WEBHOOK_URL environment variable
// and is NEVER stored in the repo (the repo is public).

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // Vercel auto-parses JSON bodies, but guard against string/empty bodies.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const {
    client_name,
    client_phone,
    client_email,
    event_date,
    guest_count,
    budget = null,
    consent,
    consent_text = '',
    consent_timestamp = '',
    company = '',      // honeypot — should always be empty for real users
    source_url = '',
  } = body;

  // Honeypot: bots fill hidden fields. Pretend success, forward nothing.
  if (company && String(company).trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  // Server-side validation (mirrors the client checks).
  const missing = [];
  if (!client_name || !String(client_name).trim()) missing.push('name');
  if (!client_phone || !String(client_phone).trim()) missing.push('phone');
  if (!client_email || !String(client_email).trim()) missing.push('email');
  if (!event_date) missing.push('event date');
  if (guest_count === undefined || guest_count === null || guest_count === '') missing.push('guest count');
  if (consent !== true) missing.push('consent');

  if (missing.length) {
    return res.status(400).json({ error: `Missing or invalid: ${missing.join(', ')}.` });
  }

  const webhookUrl = process.env.GHL_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('GHL_WEBHOOK_URL is not set.');
    return res.status(500).json({ error: 'Server is not configured yet. Please call us at (707) 392-3391.' });
  }

  const payload = {
    client_name: String(client_name).trim(),
    client_phone: String(client_phone).trim(),
    client_email: String(client_email).trim(),
    event_date,
    guest_count: parseInt(guest_count, 10),
    budget: budget !== null && budget !== '' ? parseFloat(budget) : null,
    consent: true,
    consent_text,
    consent_timestamp,
    source_url,
    submitted_at: new Date().toISOString(),
  };

  try {
    const ghlRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!ghlRes.ok) {
      const text = await ghlRes.text().catch(() => '');
      console.error('GHL webhook error:', ghlRes.status, text);
      return res.status(502).json({ error: 'Could not submit your inquiry. Please call us at (707) 392-3391.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Forwarding to GHL failed:', err);
    return res.status(502).json({ error: 'Could not submit your inquiry. Please call us at (707) 392-3391.' });
  }
};
