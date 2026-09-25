/* eslint-disable */
/* global WebImporter */

/**
 * Parser for contact-form.
 * Source: https://www.praxis-schnetzler.de/kontakt — Contact Form 7 widget (div.wpcf7 > form.wpcf7-form),
 * moved out of its contact column by praxis-schnetzler-cleanup.js (blocks cannot nest).
 *
 * Output table (DA block name "Contact Form"):
 *   row 1: link to the form endpoint (authored; placeholder until the real Worker URL is known)
 *   rows 2+: field key | label, taken from the source form's <label> texts
 *            (name, email, subject, message) plus the submit button text (submit)
 *
 * Source fields: your-name, your-email, your-subject, your-message, submit "Senden".
 * The WordPress honeypot shortcode and CF7 hidden inputs are not carried over; the block renders
 * its own honeypot field.
 */

const ENDPOINT = 'https://schnetzler-contact.example.workers.dev/';

const FIELDS = [
  ['name', 'your-name'],
  ['email', 'your-email'],
  ['subject', 'your-subject'],
  ['message', 'your-message'],
];

function labelText(label) {
  const clone = label.cloneNode(true);
  clone.querySelectorAll('input, textarea, select, span.wpcf7-form-control-wrap').forEach((n) => n.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

export default function parse(element, { document }) {
  const form = element.querySelector('form') || element;

  const link = document.createElement('a');
  link.href = ENDPOINT;
  link.textContent = ENDPOINT;
  const cells = [[link]];

  FIELDS.forEach(([key, name]) => {
    const control = form.querySelector(`[name="${name}"]`);
    const label = control && control.closest('label');
    const text = label ? labelText(label) : '';
    if (text) cells.push([key, text]);
  });

  const submit = form.querySelector('input[type="submit"], button[type="submit"]');
  const submitText = submit && (submit.value || submit.textContent || '').trim();
  if (submitText) cells.push(['submit', submitText]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'Contact Form', cells });
  element.replaceWith(block);
}
