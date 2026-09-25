/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-intro.
 * Base block: columns. Sources: https://www.praxis-schnetzler.de/ (col-md-2/7/3)
 *   and https://www.praxis-schnetzler.de/test (col-sm-2/8/2). Generated: 2026-09-25
 *
 * Output table (DA block name "Columns (intro)"): one row, one cell per Bootstrap column.
 * Every column keeps all of its content:
 *   - figure.wp-caption -> img + figcaption text as a paragraph (home)
 *   - img followed by a centered <p> caption (test)
 *   - paragraphs with links (both)
 *   - linked logos (<a><img></a>), with or without a wrapping <p>, separated by <br> (both)
 *   - extra images (home: Stempel)
 *
 * Selectors verified in migration-work/block-context/columns-intro/source.html (+ instances/01.html):
 *   .row > .col-md-2 / .col-md-7 / .col-md-3   and   .row > .col-sm-2 / .col-sm-8 / .col-sm-2
 *   figure.wp-caption > img + figcaption.wp-caption-text
 * Iteration is keyed on the column <div>s (block-level, never nested), not on anchors.
 */
export default function parse(element, { document }) {
  let columns = [...element.querySelectorAll(':scope > [class*="col-"]')];
  if (!columns.length) columns = [...element.children];

  const isEmptyParagraph = (node) => node.nodeType === 1
    && node.tagName === 'P'
    && !node.querySelector('img, picture, video, iframe, a, br')
    && !node.textContent.replace(/ /g, ' ').trim();

  const buildCell = (col) => {
    // Figures: image + caption paragraph, figure wrapper dropped.
    col.querySelectorAll('figure').forEach((figure) => {
      const parts = [];
      figure.querySelectorAll('img, picture').forEach((media) => {
        if (media.tagName === 'IMG' && media.closest('picture')) return;
        parts.push(media.closest('a') && figure.contains(media.closest('a')) ? media.closest('a') : media);
      });
      const caption = figure.querySelector('figcaption');
      if (caption && caption.textContent.trim()) {
        const p = document.createElement('p');
        while (caption.firstChild) p.append(caption.firstChild);
        parts.push(p);
      }
      figure.replaceWith(...parts);
    });

    const nodes = [];
    [...col.childNodes].forEach((node) => {
      if (node.nodeType === 8) return; // comments
      if (node.nodeType === 3) {
        if (!node.textContent.trim()) return;
        nodes.push(node);
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.matches('script, style, noscript')) return;
      if (isEmptyParagraph(node)) return;
      nodes.push(node);
    });
    // Trim leading/trailing line breaks that only separated removed nodes.
    while (nodes.length && nodes[0].nodeType === 1 && nodes[0].tagName === 'BR') nodes.shift();
    while (nodes.length && nodes[nodes.length - 1].nodeType === 1 && nodes[nodes.length - 1].tagName === 'BR') nodes.pop();
    return nodes;
  };

  const row = columns.map(buildCell);
  if (!row.some((cell) => cell.length)) {
    element.replaceWith(...element.childNodes);
    return;
  }
  const cells = [row.map((cell) => (cell.length ? cell : ''))];

  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns (intro)', cells });
  element.replaceWith(block);
}
