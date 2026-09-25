# Contact form worker

Accepts the contact form from the site and sends it as an email through Resend.

`POST /` with JSON or form-encoded `name`, `email`, `subject` (optional), `message` and the
honeypot `website`. Answers `{"ok":true}` (200), a validation error (400), `origin not allowed`
(403) or `send failed` (502).

## Configuration

All settings are Worker secrets, so none of them are in the repository:

| secret | value |
|---|---|
| `RESEND_API_KEY` | Resend API key with sending access |
| `MAIL_FROM` | sender, on a domain verified in Resend, e.g. `Name <kontakt@domain>` |
| `MAIL_TO` | comma-separated recipients |
| `ALLOWED_ORIGINS` | comma-separated origins; `*` matches one hostname label part, e.g. `https://*--site--org.aem.page` |

Set them with `npx wrangler secret put <NAME>`. For `wrangler dev`, put them in `.dev.vars`.

## Develop

```sh
npm test
npx wrangler dev
npx wrangler deploy
```
