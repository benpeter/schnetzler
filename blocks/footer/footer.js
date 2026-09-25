import { getMetadata } from '../../scripts/aem.js';
import { resolveContentPath } from '../../scripts/scripts.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : resolveContentPath('/footer');
  const fragment = await loadFragment(footerPath);
  if (!fragment) return;

  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  // sections: contact, legal links, copyright
  ['contact', 'links', 'copyright'].forEach((name, i) => {
    const section = footer.children[i];
    if (section) section.classList.add(`footer-${name}`);
  });

  const links = footer.querySelector('.footer-links ul');
  if (links) {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Rechtliches');
    links.replaceWith(nav);
    nav.append(links);
  }

  block.append(footer);
}
