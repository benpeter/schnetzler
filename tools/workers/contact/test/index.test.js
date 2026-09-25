import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const env = {
  RESEND_API_KEY: 're_test',
  MAIL_FROM: 'Practice <contact@example.com>',
  MAIL_TO: 'a@example.com,b@example.com',
  ALLOWED_ORIGINS: 'https://*--site--org.aem.page, https://*--site--org.aem.live,https://www.example.com',
};

const ORIGIN = 'https://main--site--org.aem.page';
const valid = {
  name: 'Erika Mustermann',
  email: 'erika@example.org',
  subject: 'Termin',
  message: 'Ich hätte gern einen Termin.',
};

let calls;
let resendStatus;
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  resendStatus = 200;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 'x' }), { status: resendStatus });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function post(body, { origin = ORIGIN, type = 'json', cfg = env } = {}) {
  const headers = { origin };
  let payload;
  if (type === 'json') {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  } else {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(body).toString();
  }
  return worker.fetch(new Request('https://worker.test/', { method: 'POST', headers, body: payload }), cfg);
}

test('valid JSON submission sends one email to every recipient', async () => {
  const res = await post(valid);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 1);
  const { url, init, body } = calls[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.authorization, 'Bearer re_test');
  assert.equal(body.from, env.MAIL_FROM);
  assert.deepEqual(body.to, ['a@example.com', 'b@example.com']);
  assert.equal(body.reply_to, 'erika@example.org');
  assert.match(body.subject, /Termin/);
  assert.match(body.text, /Erika Mustermann/);
  assert.match(body.text, /erika@example\.org/);
  assert.match(body.text, /Ich hätte gern einen Termin\./);
});

test('form-urlencoded submission is accepted', async () => {
  const res = await post(valid, { type: 'form' });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
});

test('subject is optional', async () => {
  const { subject, ...rest } = valid;
  const res = await post(rest);
  assert.equal(res.status, 200);
  assert.match(calls[0].body.subject, /Kontaktformular/);
});

['name', 'email', 'message'].forEach((field) => {
  test(`missing ${field} is rejected without sending`, async () => {
    const res = await post({ ...valid, [field]: '  ' });
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  });
});

test('invalid email is rejected', async () => {
  const res = await post({ ...valid, email: 'not-an-email' });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('overlong message is rejected', async () => {
  const res = await post({ ...valid, message: 'x'.repeat(5001) });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('newline in subject cannot inject headers', async () => {
  await post({ ...valid, subject: 'Hi\r\nBcc: evil@example.com' });
  assert.doesNotMatch(calls[0].body.subject, /[\r\n]/);
});

test('filled honeypot answers ok and sends nothing', async () => {
  const res = await post({ ...valid, website: 'http://spam.example' });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});

test('Resend failure answers 502', async () => {
  resendStatus = 500;
  const res = await post(valid);
  assert.equal(res.status, 502);
});

test('allowed origin is echoed in CORS header', async () => {
  const res = await post(valid);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
});

test('wildcard origin matches any branch', async () => {
  const res = await post(valid, { origin: 'https://feature-1--site--org.aem.live' });
  assert.equal(res.status, 200);
});

test('wildcard does not match across dots or other sites', async () => {
  const origins = [
    'https://a.b--site--org.aem.page',
    'https://main--site--other.aem.page',
    'https://main--site--org.aem.page.evil.example',
  ];
  const responses = await Promise.all(origins.map((origin) => post(valid, { origin })));
  const statuses = responses.map((r) => r.status);
  assert.deepEqual(statuses, [403, 403, 403]);
  assert.equal(calls.length, 0);
});

test('exact configured origin is allowed', async () => {
  const res = await post(valid, { origin: 'https://www.example.com' });
  assert.equal(res.status, 200);
});

test('no origin is allowed when ALLOWED_ORIGINS is unset', async () => {
  const { ALLOWED_ORIGINS, ...rest } = env;
  const res = await post(valid, { cfg: rest });
  assert.equal(res.status, 403);
});

['RESEND_API_KEY', 'MAIL_FROM', 'MAIL_TO'].forEach((key) => {
  test(`missing ${key} answers 500 without sending`, async () => {
    const res = await post(valid, { cfg: { ...env, [key]: '' } });
    assert.equal(res.status, 500);
    assert.equal(calls.length, 0);
  });
});

test('foreign origin is refused without sending', async () => {
  const res = await post(valid, { origin: 'https://evil.example' });
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
});

test('preflight from allowed origin answers 204 with CORS headers', async () => {
  const res = await worker.fetch(new Request('https://worker.test/', {
    method: 'OPTIONS',
    headers: { origin: ORIGIN, 'access-control-request-method': 'POST' },
  }), env);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  assert.match(res.headers.get('access-control-allow-methods'), /POST/);
});

test('GET answers 405', async () => {
  const res = await worker.fetch(new Request('https://worker.test/', { headers: { origin: ORIGIN } }), env);
  assert.equal(res.status, 405);
});
