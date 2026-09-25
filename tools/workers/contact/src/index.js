const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = {
  name: 200, email: 200, subject: 200, message: 5000,
};

function originPattern(entry) {
  const escaped = entry.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+');
  return new RegExp(`^${escaped}$`);
}

function allowedOrigin(origin, env) {
  if (!origin) return false;
  return (env.ALLOWED_ORIGINS || '').split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .some((o) => originPattern(o).test(origin));
}

function cors(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function reply(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

async function readFields(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return request.json();
  return Object.fromEntries(await request.formData());
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin');
    if (!allowedOrigin(origin, env)) return reply(403, { ok: false, error: 'origin not allowed' });
    const headers = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'method not allowed' }, headers);
    if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.MAIL_TO) {
      console.error('missing RESEND_API_KEY, MAIL_FROM or MAIL_TO');
      return reply(500, { ok: false, error: 'not configured' }, headers);
    }

    let raw;
    try {
      raw = await readFields(request);
    } catch {
      return reply(400, { ok: false, error: 'unreadable body' }, headers);
    }

    if (clean(raw.website)) return reply(200, { ok: true }, headers);

    const fields = Object.fromEntries(Object.keys(LIMITS).map((k) => [k, clean(raw[k])]));
    const missing = ['name', 'email', 'message'].filter((k) => !fields[k]);
    if (missing.length) return reply(400, { ok: false, error: `missing: ${missing.join(', ')}` }, headers);
    if (!EMAIL.test(fields.email)) return reply(400, { ok: false, error: 'invalid email' }, headers);
    const long = Object.keys(LIMITS).filter((k) => fields[k].length > LIMITS[k]);
    if (long.length) return reply(400, { ok: false, error: `too long: ${long.join(', ')}` }, headers);

    const subject = `Kontaktformular: ${fields.subject || 'Neue Nachricht'}`.replace(/[\r\n]+/g, ' ');
    const text = [
      `Name: ${fields.name}`,
      `E-Mail: ${fields.email}`,
      `Betreff: ${fields.subject || '-'}`,
      '',
      fields.message,
    ].join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: env.MAIL_TO.split(',').map((t) => t.trim()),
        reply_to: fields.email,
        subject,
        text,
      }),
    });

    if (!res.ok) {
      console.error('resend failed', res.status, await res.text());
      return reply(502, { ok: false, error: 'send failed' }, headers);
    }
    return reply(200, { ok: true }, headers);
  },
};
