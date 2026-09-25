/* eslint-disable */
/* global WebImporter */

/**
 * Parser: quotes-rotating
 * Source: homepage blockquote.quotescollection-quote (WordPress "Quotes Collection" random quote)
 *
 * The widget renders one random quote per request, so the parsed page only contains one of them.
 * The block therefore carries every quote in the collection (quotes-data.js), one row per quote:
 *   cell 1: quote paragraph(s), cell 2: attribution.
 * The quote present on the page is added too if it is not in the collected set.
 */
import QUOTES from './quotes-data.js';

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

export default function parse(element, { document }) {
  const quotes = QUOTES.map((q) => ({ ...q }));

  const footer = element.querySelector('footer, .attribution');
  const pageCite = footer ? norm(footer.textContent).replace(/^[—–-]\s*/, '') : '';
  const pageParagraphs = [...element.querySelectorAll('p')]
    .filter((p) => !footer || !footer.contains(p))
    .map((p) => p.innerHTML.trim())
    .filter(Boolean);
  const pageText = norm(pageParagraphs.join(' ').replace(/<[^>]+>/g, ''));
  const known = quotes.some((q) => norm(q.paragraphs.join(' ').replace(/<[^>]+>/g, '')) === pageText);
  if (pageText && !known) quotes.unshift({ paragraphs: pageParagraphs, cite: pageCite });

  const cells = quotes.map((q) => {
    const quoteCell = document.createElement('div');
    q.paragraphs.forEach((html) => {
      const p = document.createElement('p');
      p.innerHTML = html;
      quoteCell.append(p);
    });
    const citeCell = document.createElement('div');
    if (q.cite) {
      const p = document.createElement('p');
      p.textContent = q.cite;
      citeCell.append(p);
    }
    return [quoteCell, citeCell];
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'Quotes (rotating)', cells });
  element.replaceWith(block);
}
