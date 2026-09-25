/**
 * Classifies a contact column by the kind of link it offers.
 * @param {Element} col The column element
 * @returns {string} phone | email | booking
 */
function contactType(col) {
  if (col.querySelector('a[href^="tel:"]')) return 'phone';
  if (col.querySelector('a[href^="mailto:"]')) return 'email';
  return 'booking';
}

export default function decorate(block) {
  const firstRow = block.firstElementChild;
  if (!firstRow) return;
  const cols = [...firstRow.children];
  block.classList.add(`columns-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          picWrapper.classList.add('columns-img-col');
        }
      }
      // columns holding only images (and their links) are shown as a logo/badge group
      const hasText = [...col.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li')]
        .some((el) => el.textContent.trim());
      if (col.querySelector('picture') && !hasText) col.classList.add('columns-media-col');

      if (block.classList.contains('contact')) {
        col.classList.add('columns-contact-card', `columns-contact-${contactType(col)}`);
        // a paragraph holding only an email link is the primary action of its card
        col.querySelectorAll('p > a[href^="mailto:"]:only-child').forEach((a) => {
          const p = a.parentElement;
          if (p.textContent.trim() !== a.textContent.trim() || p.closest('h1, h2, h3, h4, h5, h6')) return;
          a.className = 'button primary';
          p.className = 'button-wrapper';
        });
      }
    });
  });

  if (block.classList.contains('intro')) {
    // the first column is the portrait with its caption
    const portrait = cols[0];
    if (portrait && portrait.querySelector('picture')) {
      portrait.classList.add('columns-portrait');
      const caption = [...portrait.querySelectorAll('p')].find((p) => !p.querySelector('picture') && p.textContent.trim());
      if (caption) caption.classList.add('columns-caption');
    }
  }
}
