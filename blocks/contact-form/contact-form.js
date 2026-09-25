/**
 * Contact Form: posts name, email, subject, message and a honeypot as JSON to the endpoint
 * authored in the first row (a link). Optional further rows override labels:
 *   name | email | subject | message | submit  ->  label text
 */

const FALLBACK_PHONE = { text: '06421 – 952041', href: 'tel:+496421952041' };
const FALLBACK_EMAIL = { text: 'info@praxis-schnetzler.de', href: 'mailto:info@praxis-schnetzler.de' };
const TIMEOUT_MS = 15000;

const FIELDS = [
  {
    key: 'name', label: 'Ihr Name (Pflichtfeld)', type: 'text', required: true, autocomplete: 'name',
  },
  {
    key: 'email', label: 'Ihre E-Mail-Adresse (Pflichtfeld)', type: 'email', required: true, autocomplete: 'email',
  },
  { key: 'subject', label: 'Betreff', type: 'text' },
  {
    key: 'message', label: 'Ihre Nachricht', type: 'textarea', required: true,
  },
];

const MESSAGES = {
  required: 'Bitte füllen Sie dieses Pflichtfeld aus.',
  email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  sending: 'Wird gesendet …',
  success: 'Vielen Dank für Ihre Nachricht! Ich melde mich so bald wie möglich bei Ihnen.',
  invalid: 'Ihre Nachricht konnte nicht gesendet werden. Bitte prüfen Sie Ihre Angaben.',
  failed: 'Ihre Nachricht konnte leider nicht gesendet werden. Bitte versuchen Sie es später erneut.',
  fallback: 'Sie erreichen die Praxis auch telefonisch unter {phone} oder per E-Mail an {email}.',
};

let formCount = 0;

/**
 * Reads the authored configuration from the block rows.
 * @param {Element} block The block element
 * @returns {{endpoint: string, labels: Object<string, string>}}
 */
function readConfig(block) {
  const link = block.querySelector('a[href]');
  const labels = {};
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    if (!keyCell || !valueCell || keyCell.querySelector('a')) return;
    const key = keyCell.textContent.trim().toLowerCase();
    const value = valueCell.textContent.trim();
    if (key && value) labels[key] = value;
  });
  return { endpoint: link ? link.href : '', labels };
}

/**
 * Finds the practice phone/email links on the page for the error fallback.
 * @returns {{phone: {text, href}, email: {text, href}}}
 */
function findContacts() {
  const pick = (selector, fallback) => {
    const a = document.querySelector(`main ${selector}`);
    return a ? { text: a.textContent.trim(), href: a.getAttribute('href') } : fallback;
  };
  return {
    phone: pick('a[href^="tel:"]', FALLBACK_PHONE),
    email: pick('a[href^="mailto:"]', FALLBACK_EMAIL),
  };
}

function buildFallback(container) {
  const { phone, email } = findContacts();
  const [before, middle, after] = MESSAGES.fallback.split(/\{phone\}|\{email\}/);
  const link = ({ text, href }) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    return a;
  };
  container.append(before, link(phone), middle, link(email), after);
}

function buildField(field, id, labelText) {
  const wrapper = document.createElement('div');
  wrapper.className = 'contact-form-field';

  const label = document.createElement('label');
  label.htmlFor = id;
  // required fields are marked like the source form's required fields
  label.textContent = field.required && !/pflichtfeld/i.test(labelText)
    ? `${labelText} (Pflichtfeld)` : labelText;

  const control = document.createElement(field.type === 'textarea' ? 'textarea' : 'input');
  control.id = id;
  control.name = field.key;
  if (field.type === 'textarea') control.rows = 7;
  else control.type = field.type;
  if (field.autocomplete) control.autocomplete = field.autocomplete;
  if (field.required) {
    control.required = true;
    control.setAttribute('aria-required', 'true');
  }

  const error = document.createElement('p');
  error.className = 'contact-form-field-error';
  error.id = `${id}-error`;
  error.hidden = true;

  wrapper.append(label, control, error);
  return wrapper;
}

function buildHoneypot(id) {
  const wrapper = document.createElement('div');
  wrapper.className = 'contact-form-hp';
  wrapper.setAttribute('aria-hidden', 'true');
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = 'Website';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = id;
  input.name = 'website';
  input.tabIndex = -1;
  input.autocomplete = 'off';
  wrapper.append(label, input);
  return wrapper;
}

function setFieldError(control, message) {
  const error = control.parentElement.querySelector('.contact-form-field-error');
  if (message) {
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', error.id);
    error.textContent = message;
    error.hidden = false;
  } else {
    control.removeAttribute('aria-invalid');
    control.removeAttribute('aria-describedby');
    error.textContent = '';
    error.hidden = true;
  }
}

function validate(control) {
  const value = control.value.trim();
  if (control.required && !value) return MESSAGES.required;
  if (control.type === 'email' && value && !control.checkValidity()) return MESSAGES.email;
  return '';
}

async function send(endpoint, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let data = {};
    try {
      data = await resp.json();
    } catch {
      // non-JSON answer: treated by status below
    }
    return { status: resp.status, ok: resp.ok && data.ok === true };
  } catch {
    return { status: 0, ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export default function decorate(block) {
  const { endpoint, labels } = readConfig(block);
  formCount += 1;
  const prefix = `contact-form-${formCount}`;

  const form = document.createElement('form');
  form.noValidate = true;
  form.setAttribute('aria-label', 'Kontaktformular');

  const controls = FIELDS.map((field) => {
    const wrapper = buildField(field, `${prefix}-${field.key}`, labels[field.key] || field.label);
    form.append(wrapper);
    return wrapper.querySelector('input, textarea');
  });
  form.append(buildHoneypot(`${prefix}-website`));

  const status = document.createElement('div');
  status.className = 'contact-form-status';
  status.setAttribute('role', 'alert');
  status.setAttribute('aria-live', 'assertive');

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'button primary';
  const buttonLabel = labels.submit || 'Senden';
  button.textContent = buttonLabel;

  const actions = document.createElement('div');
  actions.className = 'contact-form-actions';
  actions.append(button);
  form.append(status, actions);

  controls.forEach((control) => {
    control.addEventListener('blur', () => {
      if (control.getAttribute('aria-invalid') === 'true' || control.value) {
        setFieldError(control, validate(control));
      }
    });
  });

  const showError = (message) => {
    status.textContent = '';
    const p = document.createElement('p');
    p.textContent = `${message} `;
    buildFallback(p);
    status.append(p);
    status.classList.add('is-error');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('is-error');

    const invalid = controls.filter((control) => {
      const message = validate(control);
      setFieldError(control, message);
      return message;
    });
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    if (!endpoint) {
      showError(MESSAGES.failed);
      return;
    }

    const payload = Object.fromEntries(['name', 'email', 'subject', 'message', 'website']
      .map((key) => [key, (form.elements[key].value || '').trim()]));

    button.disabled = true;
    button.textContent = MESSAGES.sending;
    form.setAttribute('aria-busy', 'true');

    const result = await send(endpoint, payload);

    form.removeAttribute('aria-busy');
    button.disabled = false;
    button.textContent = buttonLabel;

    if (result.ok) {
      const success = document.createElement('div');
      success.className = 'contact-form-success';
      success.setAttribute('role', 'status');
      success.tabIndex = -1;
      const p = document.createElement('p');
      p.textContent = MESSAGES.success;
      success.append(p);
      form.replaceWith(success);
      success.focus();
      return;
    }
    showError(result.status === 400 ? MESSAGES.invalid : MESSAGES.failed);
  });

  block.replaceChildren(form);
}
