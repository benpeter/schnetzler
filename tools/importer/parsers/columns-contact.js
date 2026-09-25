/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-contact.
 * Base block: columns. Source: https://www.praxis-schnetzler.de/kontakt. Generated: 2026-09-25
 *
 * Output table (DA block name "Columns (contact)"): one row, one cell per .col-md-4 (3 cells).
 * Each cell keeps its headings (levels as left by the cleanup transformer's heading
 * normalization), paragraphs, links (tel:/mailto: added by cleanup), the mailto paragraph
 * that replaced the Contact Form 7 form, and the linked jameda logo.
 *
 * Selectors verified in migration-work/block-context/columns-contact/source.html:
 *   .row > .col-md-4 (x3), h3 / h4 / p, div.wpcf7 > form.wpcf7-form, p > a > img (jameda)
 * Iteration is keyed on the column <div>s (block-level, never nested), not on anchors.
 *
 * Defensive fallbacks (normally already done by praxis-schnetzler-cleanup.js beforeTransform):
 *   - a remaining Contact Form 7 widget is replaced by the same mailto paragraph
 *   - Font Awesome <i> icons and the "[honeypot website]" shortcode text are dropped
 */
const EMAIL = 'info@praxis-schnetzler.de';

export default function parse(element, { document }) {
  let columns = [...element.querySelectorAll(':scope > [class*="col-"]')];
  if (!columns.length) columns = [...element.children];

  const isEmptyParagraph = (node) => node.tagName === 'P'
    && !node.querySelector('img, picture, video, iframe, a, br')
    && !node.textContent.replace(/ /g, ' ').trim();

  const buildCell = (col) => {
    // Form fallback: mirror the cleanup transformer (first widget -> mailto paragraph).
    const forms = [...col.querySelectorAll('div.wpcf7')];
    col.querySelectorAll('form').forEach((form) => {
      if (!form.closest('div.wpcf7')) forms.push(form);
    });
    if (forms.length) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = `mailto:${EMAIL}`;
      a.textContent = 'E-Mail schreiben';
      p.append(a);
      forms[0].replaceWith(p);
      forms.slice(1).forEach((f) => f.remove());
    }
    col.querySelectorAll('i.fa, i[class*="fa-"]').forEach((icon) => icon.remove());

    const nodes = [];
    [...col.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        const text = node.textContent.replace(/\[honeypot website\]/g, '');
        if (!text.trim()) return;
        node.textContent = text;
        nodes.push(node);
        return;
      }
      if (node.nodeType !== 1) return; // comments etc.
      if (node.matches('script, style, noscript')) return;
      if (isEmptyParagraph(node)) return;
      // Trailing <br> left inside a paragraph after the form was lifted out.
      if (node.tagName === 'P') {
        while (node.lastChild && (node.lastChild.nodeName === 'BR'
          || (node.lastChild.nodeType === 3 && !node.lastChild.textContent.trim()))) {
          node.lastChild.remove();
        }
      }
      nodes.push(node);
    });
    return nodes;
  };

  const row = columns.map(buildCell);
  if (!row.some((cell) => cell.length)) {
    element.replaceWith(...element.childNodes);
    return;
  }
  const cells = [row.map((cell) => (cell.length ? cell : ''))];

  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns (contact)', cells });
  element.replaceWith(block);
}
