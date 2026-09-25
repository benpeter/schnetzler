/* eslint-disable */
/* global WebImporter */

/**
 * Parser for hero-home.
 * Base block: hero. Source: https://www.praxis-schnetzler.de/ (#myCarousel). Generated: 2026-09-25
 *
 * Output table (DA block name "Hero (home)"):
 *   row 1: one cell with ALL carousel images (alt kept)
 *   row 2: one cell with the h1, the tagline paragraph(s) and the CTA as a plain link
 *
 * Selectors verified in migration-work/block-context/hero-home/source.html:
 *   #myCarousel > .carousel-inner > .item > img   (slides, 3x)
 *   #myCarousel > .hero > h1 / p / a.btn           (caption + CTA "Termin ausmachen!")
 *   a.carousel-control                              (prev/next chrome, never copied)
 */
export default function parse(element, { document }) {
  // --- Images: every slide image, in slide order ------------------------------------------
  let images = [...element.querySelectorAll('.carousel-inner img')];
  if (!images.length) {
    images = [...element.querySelectorAll('img')].filter((img) => !img.closest('.carousel-control'));
  }
  const imageCell = images.map((img) => {
    const clone = document.createElement('img');
    clone.src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    clone.alt = img.getAttribute('alt') || '';
    return clone;
  }).filter((img) => img.getAttribute('src'));

  // --- Text: everything inside the .hero caption container ------------------------------
  const hero = element.querySelector(':scope > .hero')
    || element.querySelector('.hero')
    || element.querySelector('.carousel-caption:not(:empty)')
    || element;

  const makeCta = (link) => {
    const a = document.createElement('a');
    a.href = link.getAttribute('href') || '';
    a.textContent = link.textContent.replace(/\s+/g, ' ').trim();
    const p = document.createElement('p');
    p.append(a);
    return p;
  };

  const contentCell = [];
  const seenCta = new Set();
  [...hero.children].forEach((child) => {
    if (child.matches('a.carousel-control, .carousel-inner, .carousel-indicators, script, style')) return;
    if (child.matches('a.btn, a[role="button"]')) {
      seenCta.add(child);
      contentCell.push(makeCta(child));
      return;
    }
    if (child.matches('h1, h2, h3, h4, h5, h6, p')) {
      if (!child.textContent.trim() && !child.querySelector('img, a')) return;
      contentCell.push(child);
      return;
    }
    // Any other wrapper with real text is kept as-is so nothing is dropped.
    if (child.textContent.trim()) contentCell.push(child);
  });

  // CTA not a direct child of the caption container (markup variation)
  if (!seenCta.size) {
    const cta = element.querySelector('.hero a.btn, a.btn-primary, a[role="button"]:not(.carousel-control)');
    if (cta) contentCell.push(makeCta(cta));
  }

  // Heading fallback when the caption container was not found
  if (!contentCell.some((el) => /^H[1-6]$/.test(el.tagName) || el.querySelector?.('h1, h2, h3, h4, h5, h6'))) {
    const heading = element.querySelector('h1, h2');
    if (heading) contentCell.unshift(heading);
  }

  if (!imageCell.length && !contentCell.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [];
  if (imageCell.length) cells.push([imageCell]);
  cells.push([contentCell]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'Hero (home)', cells });
  element.replaceWith(block);
}
