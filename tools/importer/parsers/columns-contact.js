/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-contact.
 * Base block: columns. Source: https://www.praxis-schnetzler.de/kontakt. Generated: 2026-09-25
 *
 * Output table (DA block name "Columns (contact)"): one row, one cell per .col-md-4 (3 cells).
 * Each cell keeps its headings (levels as left by the cleanup transformer's heading
 * normalization), paragraphs, links (tel:/mailto: added by cleanup) and the linked jameda logo.
 * The Contact Form 7 form is not part of this block: it becomes its own contact-form block.
 *
 * Selectors verified in migration-work/block-context/columns-contact/source.html:
 *   .row > .col-md-4 (x3), h3 / h4 / p, div.wpcf7 > form.wpcf7-form, p > a > img (jameda)
 * Iteration is keyed on the column <div>s (block-level, never nested), not on anchors.
 *
 * Defensive fallbacks (normally already done by praxis-schnetzler-cleanup.js beforeTransform):
 *   - a Contact Form 7 widget still inside a column is moved after the row (contact-form parser)
 *   - Font Awesome <i> icons and the "[honeypot website]" shortcode text are dropped
 */
export default function parse(element, { document }) {
  let columns = [...element.querySelectorAll(':scope > [class*="col-"]')];
  if (!columns.length) columns = [...element.children];

  const isEmptyParagraph = (node) => node.tagName === 'P'
    && !node.querySelector('img, picture, video, iframe, a, br')
    && !node.textContent.replace(/ /g, ' ').trim();

  const buildCell = (col) => {
    // Blocks cannot nest: move a form that is still inside the column after the row.
    col.querySelectorAll('div.wpcf7').forEach((form) => element.after(form));
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
