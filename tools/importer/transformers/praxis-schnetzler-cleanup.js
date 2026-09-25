/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: praxis-schnetzler.de site-wide cleanup (WordPress theme "_chi").
 *
 * All selectors verified in migration-work/cleaned.html and migration-work/source/*.html:
 *   - a.carousel-control                      (header carousel prev/next controls)
 *   - #nav.navbar                             (main navigation bar)
 *   - footer.page-footer                      (site footer with address/footer menu)
 *   - a.skip-link.screen-reader-text          (skip link)
 *   - footer.entry-footer                     (empty WP entry footer)
 *   - .wp-video .mejs-container / .mejs-*     (MediaElement.js player chrome)
 *   - div.wpcf7 / form.wpcf7-form             (Contact Form 7, /kontakt)
 *   - i.fa                                    (Font Awesome icons, hero CTA + /kontakt)
 *   - .entry-content > .container > .row > [class*="col-"]  (Bootstrap layout wrappers)
 *   - body.home article h1.entry-title        (homepage article title)
 *
 * #myCarousel (inside header.site-header) is intentionally kept: the hero-home parser consumes it.
 */

const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

const EMAIL = 'info@praxis-schnetzler.de';

// Alt text for images with empty alt, keyed by a distinctive src fragment.
const ALT_BY_SRC = [
  ['Stempel_240x240', 'Stempel Stiftung Homöopathie-Zertifikat'],
  ['Stempel_01.gif', 'Siegel Stiftung Homöopathie-Zertifikat'],
  ['jens-schnetzler-portrait', 'Heilpraktiker Jens Schnetzler'],
  ['Zertifikat-Vitamin-D-Coach', 'Zertifikat Vitamin D Coach, April 2021, Jens Schnetzler'],
  ['2018/10/image', 'Praxisräume'],
  ['2021/06/Image-1', 'Chiropraktik-Behandlungsliege'],
  ['Wirkstoffe', 'Homöopathische Wirkstoffe'],
];

// Alt text that replaces non-descriptive or wrong source alts (file names, wrong book title).
const ALT_OVERRIDE_BY_SRC = [
  ['cover1', 'Buchcover: Minimal Repertory of Maximum Importance'],
  ['cover2', 'Buchcover: Minimal Materia Medica of Maximum Importance'],
  ['logo-fdh', 'Logo Fachverband Deutscher Heilpraktiker, Landesverband Hessen'],
  ['jameda-Logo', 'jameda Logo'],
];

const SITE_HOST_RE = /^https?:\/\/(www\.)?praxis-schnetzler\.de(?=\/|$)/i;

// German phone numbers: "+49 176 84288540", "06421 – 952041", "06421-952041", "06421 952041"
const PHONE_RE = /(\+49(?:[ \u00a0]?\d){6,13})|(\b0\d{3,5}[ \u00a0]*[–—-]?[ \u00a0]*\d{4,8}\b)/g;

function getDoc(element, payload) {
  return element.ownerDocument || (payload && payload.document) || document;
}

function toTel(number) {
  const digits = number.replace(/\D/g, '');
  if (number.trim().startsWith('+')) return `tel:+${digits}`;
  if (digits.startsWith('0')) return `tel:+49${digits.slice(1)}`;
  return `tel:${digits}`;
}

function collectTextNodes(doc, root) {
  const nodes = [];
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }
  return nodes;
}

function isHomePage(element, payload) {
  const doc = getDoc(element, payload);
  if (element.matches && element.matches('body.home')) return true;
  if (doc && doc.body && doc.body.classList.contains('home')) return true;
  if (payload && payload.document && payload.document.body
    && payload.document.body.classList.contains('home')) return true;
  return false;
}

function renameElement(doc, el, tagName) {
  const repl = doc.createElement(tagName);
  [...el.attributes].forEach((attr) => repl.setAttribute(attr.name, attr.value));
  while (el.firstChild) repl.appendChild(el.firstChild);
  el.replaceWith(repl);
  return repl;
}

function unwrap(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  el.remove();
}

function safeQueryAll(root, selector) {
  try {
    return [...root.querySelectorAll(selector)];
  } catch (e) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// beforeTransform helpers (content fixes parsers should already see)
// ---------------------------------------------------------------------------

function cleanMediaElement(element) {
  // Replace MediaElement.js chrome with the underlying <video> (keeps src/<source>/<a> fallback).
  element.querySelectorAll('.mejs-container').forEach((container) => {
    const video = container.querySelector('video');
    if (video) container.replaceWith(video);
    else container.remove();
  });
  element.querySelectorAll('mediaelementwrapper').forEach(unwrap);
  WebImporter.DOMUtils.remove(element, ['.mejs-offscreen', '[class*="mejs-"]']);
}

function replaceContactForm(element, doc) {
  const forms = [...element.querySelectorAll('div.wpcf7')];
  element.querySelectorAll('form.wpcf7-form').forEach((form) => {
    if (!form.closest('div.wpcf7')) forms.push(form);
  });
  if (!forms.length) return;
  const p = doc.createElement('p');
  const a = doc.createElement('a');
  a.href = `mailto:${EMAIL}`;
  a.textContent = 'E-Mail schreiben';
  p.appendChild(a);
  forms[0].replaceWith(p);
  forms.slice(1).forEach((f) => f.remove());
}

function removeHoneypotText(element, doc) {
  collectTextNodes(doc, element).forEach((node) => {
    if (node.nodeValue.includes('[honeypot website]')) {
      node.nodeValue = node.nodeValue.replace(/\[honeypot website\]/g, '');
    }
  });
}

function fixImages(element) {
  element.querySelectorAll('img').forEach((img) => {
    ['src', 'data-src'].forEach((attr) => {
      const val = img.getAttribute(attr);
      if (val && /^http:\/\/(www\.)?praxis-schnetzler\.de\/wp-content\//.test(val)) {
        img.setAttribute(attr, val.replace(/^http:\/\/(www\.)?praxis-schnetzler\.de\//, 'https://www.praxis-schnetzler.de/'));
      }
    });
    const ref = `${img.getAttribute('src') || ''} ${img.getAttribute('srcset') || ''} ${img.getAttribute('data-src') || ''}`;
    const override = ALT_OVERRIDE_BY_SRC.find(([fragment]) => ref.includes(fragment));
    if (override) {
      img.setAttribute('alt', override[1]);
      return;
    }
    const alt = (img.getAttribute('alt') || '').trim();
    if (alt) return;
    const match = ALT_BY_SRC.find(([fragment]) => ref.includes(fragment));
    if (match) img.setAttribute('alt', match[1]);
  });
}

function stripMp4CacheBuster(element) {
  element.querySelectorAll('video[src], source[src], a[href]').forEach((el) => {
    const attr = el.hasAttribute('src') ? 'src' : 'href';
    const val = el.getAttribute(attr);
    if (val && /\.mp4\?_=\d+$/i.test(val)) {
      el.setAttribute(attr, val.replace(/\?_=\d+$/, ''));
    }
  });
}

function linkPhoneNumbers(element, doc) {
  collectTextNodes(doc, element).forEach((node) => {
    const parent = node.parentElement;
    if (!parent || parent.closest('a, script, style, textarea, title')) return;
    const text = node.nodeValue;
    PHONE_RE.lastIndex = 0;
    if (!PHONE_RE.test(text)) return;
    PHONE_RE.lastIndex = 0;
    const frag = doc.createDocumentFragment();
    let last = 0;
    let m = PHONE_RE.exec(text);
    while (m) {
      if (m.index > last) frag.appendChild(doc.createTextNode(text.slice(last, m.index)));
      const a = doc.createElement('a');
      a.href = toTel(m[0]);
      a.textContent = m[0];
      frag.appendChild(a);
      last = m.index + m[0].length;
      m = PHONE_RE.exec(text);
    }
    if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  });
}

function linkEmailElements(element, doc) {
  // Link every plain-text occurrence of the practice email address (headings, Impressum "E-mail: ...").
  collectTextNodes(doc, element).forEach((node) => {
    const parent = node.parentElement;
    if (!parent || parent.closest('a, script, style, textarea, title')) return;
    const idx = node.nodeValue.indexOf(EMAIL);
    if (idx < 0) return;
    const text = node.nodeValue;
    const a = doc.createElement('a');
    a.href = `mailto:${EMAIL}`;
    a.textContent = EMAIL;
    node.replaceWith(doc.createTextNode(text.slice(0, idx)), a, doc.createTextNode(text.slice(idx + EMAIL.length)));
  });
}

function splitLines(p) {
  // Split a paragraph's child nodes at <br> into per-line fragments of HTML.
  const lines = [[]];
  [...p.childNodes].forEach((n) => {
    if (n.nodeName === 'BR') lines.push([]);
    else lines[lines.length - 1].push(n);
  });
  return lines.filter((l) => l.some((n) => (n.textContent || '').trim() || n.nodeName === 'A'));
}

function convertLineListsToLists(element, doc) {
  // <br>-separated enumerations directly following an intro paragraph become real lists.
  element.querySelectorAll('.entry-content > p').forEach((p) => {
    const prev = p.previousElementSibling;
    if (!prev || prev.tagName !== 'P') return;
    const intro = prev.textContent.trim();
    const isList = /^Inhalt:$/.test(intro) || /folgende Elemente:$/.test(intro);
    if (!isList) return;
    const lines = splitLines(p);
    if (lines.length < 3) return;
    // Homöopathie: the last line is a concluding sentence, not a list item.
    const trailing = /^Die so gewonnenen/.test(lines[lines.length - 1].map((n) => n.textContent).join('').trim())
      ? lines.pop() : null;
    const ul = doc.createElement('ul');
    lines.forEach((line) => {
      const li = doc.createElement('li');
      line.forEach((n) => li.appendChild(n));
      li.innerHTML = li.innerHTML.trim();
      ul.appendChild(li);
    });
    p.replaceWith(ul);
    if (trailing) {
      const tp = doc.createElement('p');
      trailing.forEach((n) => tp.appendChild(n));
      tp.innerHTML = tp.innerHTML.trim();
      ul.after(tp);
    }
  });
}

function removeLeadingBreaks(element) {
  element.querySelectorAll('p > br:first-child').forEach((br) => {
    let prev = br.previousSibling;
    while (prev && prev.nodeType === 3 && !prev.nodeValue.trim()) prev = prev.previousSibling;
    if (!prev) br.remove();
  });
}

function removeFormReferences(element) {
  // The contact form is replaced by a mailto link; its lead-in sentence would point at nothing.
  element.querySelectorAll('p').forEach((p) => {
    if (/^oder einfach das folgende Formular ausfüllen und abschicken:?$/.test(p.textContent.trim())) p.remove();
  });
}

function relativizeInternalLinks(element) {
  element.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!SITE_HOST_RE.test(href) || /\/wp-(content|login|admin)/.test(href)) return;
    const rel = href.replace(SITE_HOST_RE, '').replace(/\/$/, '') || '/';
    a.setAttribute('href', rel);
  });
}

function normalizeHeadings(element, doc, isHome) {
  element.querySelectorAll('article').forEach((article) => {
    if (isHome) {
      article.querySelectorAll('h1.entry-title').forEach((h1) => renameElement(doc, h1, 'h2'));
    }
    // Close level gaps while preserving relative hierarchy.
    const stack = []; // { orig, level }
    article.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      const orig = parseInt(h.tagName.substring(1), 10);
      while (stack.length && stack[stack.length - 1].orig >= orig) stack.pop();
      const level = stack.length ? Math.min(stack[stack.length - 1].level + 1, 6) : orig;
      stack.push({ orig, level });
      if (level !== orig) renameElement(doc, h, `h${level}`);
    });
  });
}

function unwrapUnmappedRows(element, payload) {
  // Keep every row targeted by a block instance in page-templates.json (parsers need them).
  const blocks = (payload && payload.template && payload.template.blocks) || [];
  const mapped = new Set();
  blocks.forEach((block) => (block.instances || []).forEach((sel) => {
    safeQueryAll(element, sel).forEach((el) => mapped.add(el));
  }));
  element.querySelectorAll('.entry-content .row').forEach((row) => {
    if (mapped.has(row) || [...mapped].some((m) => m.contains(row) || row.contains(m))) return;
    [...row.children].forEach((child) => {
      if ([...child.classList].some((c) => /^col-/.test(c))) unwrap(child);
    });
    unwrap(row);
  });
  // Containers left without any mapped row are plain layout wrappers.
  element.querySelectorAll('.entry-content .container').forEach((container) => {
    if ([...mapped].some((m) => container.contains(m))) return;
    unwrap(container);
  });
}

// ---------------------------------------------------------------------------
// afterTransform helpers
// ---------------------------------------------------------------------------

function removeComments(element, doc) {
  const walker = doc.createTreeWalker(element, 128 /* NodeFilter.SHOW_COMMENT */);
  const comments = [];
  let node = walker.nextNode();
  while (node) {
    comments.push(node);
    node = walker.nextNode();
  }
  comments.forEach((c) => c.remove());
}

function removeEmptyParagraphs(element) {
  element.querySelectorAll('p').forEach((p) => {
    if (p.querySelector('img, picture, video, iframe, source, table, a')) return;
    if (p.textContent.replace(/\u00a0/g, ' ').trim() === '') p.remove();
  });
}

export default function transform(hookName, element, payload) {
  const doc = getDoc(element, payload);

  if (hookName === TransformHook.beforeTransform) {
    // Chrome that would otherwise leak into block parsing
    WebImporter.DOMUtils.remove(element, ['a.carousel-control', 'i.fa']);
    cleanMediaElement(element);
    replaceContactForm(element, doc);
    removeHoneypotText(element, doc);

    fixImages(element);
    stripMp4CacheBuster(element);
    linkPhoneNumbers(element, doc);
    linkEmailElements(element, doc);
    removeLeadingBreaks(element);
    convertLineListsToLists(element, doc);
    normalizeHeadings(element, doc, isHomePage(element, payload));
    unwrapUnmappedRows(element, payload);
  }

  if (hookName === TransformHook.afterTransform) {
    WebImporter.DOMUtils.remove(element, [
      '#nav',
      '.navbar',
      'footer.page-footer',
      '.skip-link',
      '.screen-reader-text',
      '.entry-footer',
      'script',
      'style',
      'link',
      'noscript',
      '[class*="mejs-"]',
    ]);
    removeComments(element, doc);
    removeHoneypotText(element, doc);
    removeFormReferences(element);
    relativizeInternalLinks(element);
    removeEmptyParagraphs(element);

    // Remaining Bootstrap wrappers around already-parsed block tables
    element.querySelectorAll('.entry-content .container, .entry-content .row').forEach(unwrap);
  }
}
