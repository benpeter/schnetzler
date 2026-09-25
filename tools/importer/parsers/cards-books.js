/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-books.
 * Base block: cards. Source: https://www.praxis-schnetzler.de/test. Generated: 2026-09-25
 *
 * Output table (DA block name "Cards (books)"): one row per book
 *   cell 1: the cover image
 *   cell 2: the book title (text after the <br> inside the cover link) as a link to Amazon
 *
 * Source per book (migration-work/block-context/cards-books/source.html):
 *   <div class="col-sm-6"><a href="amazon..."><img ...><br>Title</a></div>
 * Iteration is keyed on the column <div>s, NOT on the <a> wrappers: the anchors wrap the
 * whole card, so they are the inline-wrapper shape html2md can merge.
 */
export default function parse(element, { document }) {
  let items = [...element.querySelectorAll(':scope > [class*="col-"]')];
  if (!items.length) items = [...element.children];

  const clean = (text) => text.replace(/\s+/g, ' ').trim();

  const cells = [];
  items.forEach((item) => {
    const img = item.querySelector('img');
    const link = (img && img.closest('a[href]')) || item.querySelector('a[href]');

    // Title: text inside the link that is not the image (i.e. the text after the <br>).
    let title = '';
    if (link) {
      const br = link.querySelector('br');
      if (br) {
        let n = br.nextSibling;
        const parts = [];
        while (n) { parts.push(n.textContent); n = n.nextSibling; }
        title = clean(parts.join(' '));
      }
      if (!title) title = clean(link.textContent);
    }
    if (!title && img) title = clean(img.getAttribute('alt') || '');

    const textCell = [];
    if (title) {
      const p = document.createElement('p');
      if (link) {
        const a = document.createElement('a');
        a.href = link.getAttribute('href');
        a.textContent = title;
        p.append(a);
      } else {
        p.textContent = title;
      }
      textCell.push(p);
    }

    // Keep any extra content in the item that lives outside the cover link.
    [...item.childNodes].forEach((node) => {
      if (link && (node === link || node.contains?.(link))) return;
      if (node.nodeType === 3) {
        if (clean(node.textContent)) {
          const p = document.createElement('p');
          p.textContent = clean(node.textContent);
          textCell.push(p);
        }
        return;
      }
      if (node.nodeType !== 1 || node.tagName === 'BR') return;
      if (node === img || node.contains(img)) return;
      if (!clean(node.textContent) && !node.querySelector('img, picture, video, iframe')) return;
      textCell.push(node);
    });

    if (!img && !textCell.length) return;
    cells.push([img || '', textCell.length ? textCell : '']);
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards (books)', cells });
  element.replaceWith(block);
}
