/* eslint-disable */
/* global WebImporter */

/**
 * Import script: site footer fragment (/footer) from the praxis-schnetzler.de homepage.
 *
 * Source: footer.page-footer with three columns:
 *   - address (<adress>): practice name link, street, city, landline, phone consultation hours (<small>)
 *   - footer menu (#menu-footermenu): Impressum, Datenschutz, Kontakt, Anmelden (wp-login.php)
 *   - copyright line
 *
 * The "Anmelden" item is the WordPress admin login (wp-login.php); it has no counterpart on
 * Edge Delivery and is left out.
 *
 * Output sections (flat and semantic for DA): 1. contact, 2. legal links, 3. copyright.
 */

const SITE_HOST_RE = /^https?:\/\/(www\.)?praxis-schnetzler\.de(?=\/|$)/i;

function relative(href) {
  if (!href || !SITE_HOST_RE.test(href)) return href;
  return href.replace(SITE_HOST_RE, '').replace(/\/$/, '') || '/';
}

// "06421 – 952041" -> tel:+496421952041
function toTel(number) {
  const digits = number.replace(/\D/g, '');
  return digits.startsWith('0') ? `tel:+49${digits.slice(1)}` : `tel:+${digits}`;
}

const PHONE_RE = /(\b0\d{3,5}[\s ]*[–—-]?[\s ]*\d{4,8}\b)/;

/** Splits an element's content at <br> into trimmed line node lists. */
function lines(el) {
  const out = [[]];
  [...el.childNodes].forEach((n) => {
    if (n.nodeName === 'BR') out.push([]);
    else out[out.length - 1].push(n);
  });
  return out.filter((l) => l.some((n) => (n.textContent || '').trim()));
}

/** Appends a line to a paragraph, linking phone numbers and relativizing links. */
function appendLine(document, p, nodes) {
  if (p.childNodes.length) p.append(document.createElement('br'));
  nodes.forEach((n, i) => {
    if (n.nodeType === 3) {
      let text = n.nodeValue.replace(/\s+/g, ' ');
      if (i === 0) text = text.trimStart();
      if (i === nodes.length - 1) text = text.trimEnd();
      const m = text.match(PHONE_RE);
      if (m) {
        const a = document.createElement('a');
        a.href = toTel(m[0]);
        a.textContent = m[0];
        p.append(text.slice(0, m.index), a, text.slice(m.index + m[0].length));
      } else {
        p.append(text);
      }
    } else if (n.nodeName === 'A') {
      const a = document.createElement('a');
      a.href = relative(n.getAttribute('href'));
      a.textContent = n.textContent.trim();
      p.append(a);
    } else {
      p.append(n.textContent.replace(/\s+/g, ' ').trim());
    }
  });
}

export default {
  transform: ({ document }) => {
    const main = document.createElement('main');
    const footer = document.querySelector('footer.page-footer');

    // 1. Contact / address
    const contact = document.createElement('div');
    const address = footer.querySelector('adress, address');
    if (address) {
      const small = address.querySelector('small');
      if (small) small.remove();
      const p = document.createElement('p');
      lines(address).forEach((l) => appendLine(document, p, l));
      contact.append(p);
      if (small) {
        const hours = document.createElement('p');
        lines(small).forEach((l) => appendLine(document, hours, l));
        contact.append(hours);
      }
    }

    // 2. Footer menu (without the WordPress admin login)
    const legal = document.createElement('div');
    const ul = document.createElement('ul');
    footer.querySelectorAll('#menu-footermenu > li > a').forEach((a) => {
      const href = a.getAttribute('href');
      if (/wp-login\.php/.test(href)) return;
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = relative(href);
      link.textContent = a.textContent.trim();
      li.append(link);
      ul.append(li);
    });
    legal.append(ul);

    // 3. Copyright
    const copy = document.createElement('div');
    const cols = [...footer.querySelectorAll('.container > [class*="col-"]')];
    const last = cols[cols.length - 1];
    if (last) {
      const p = document.createElement('p');
      p.textContent = last.textContent.replace(/\s+/g, ' ').trim();
      copy.append(p);
    }

    main.append(contact, document.createElement("hr"), legal, document.createElement("hr"), copy);

    return [{
      element: main,
      path: '/footer',
      report: {
        title: 'footer',
        links: ul.children.length,
      },
    }];
  },
};
