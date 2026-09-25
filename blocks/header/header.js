import { getMetadata } from '../../scripts/aem.js';
import { resolveContentPath } from '../../scripts/scripts.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates desktop width
const isDesktop = window.matchMedia('(width >= 1200px)');

/**
 * Opens or closes the mobile menu
 * @param {Element} nav The nav element
 * @param {Boolean} [force] Optional state to force (true = open)
 */
function toggleMenu(nav, force) {
  const open = typeof force === 'boolean' ? force : nav.getAttribute('aria-expanded') !== 'true';
  const button = nav.querySelector('.nav-hamburger button');
  nav.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  document.body.classList.toggle('nav-open', open && !isDesktop.matches);
}

function normalizePath(path) {
  return path.replace(/\/(index)?$/, '') || '/';
}

/**
 * Marks the link to the current page with aria-current
 * @param {Element} nav The nav element
 */
function markCurrentPage(nav) {
  const current = normalizePath(window.location.pathname);
  nav.querySelectorAll('.nav-sections a[href]').forEach((a) => {
    const { pathname, origin } = new URL(a.href, window.location);
    if (origin === window.location.origin && normalizePath(pathname) === current) {
      a.setAttribute('aria-current', 'page');
    }
  });
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : resolveContentPath('/nav');
  const fragment = await loadFragment(navPath);
  if (!fragment) return;

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Hauptnavigation');
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  // brand and CTA links are plain links, not buttons
  nav.querySelectorAll('.button').forEach((link) => {
    link.className = '';
    const wrapper = link.closest('.button-wrapper');
    if (wrapper) wrapper.className = '';
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand && navBrand.querySelector('a');
  if (brandLink) brandLink.classList.add('nav-brand-link');

  const navTools = nav.querySelector('.nav-tools');
  if (navTools) navTools.querySelectorAll('a').forEach((a) => a.classList.add('nav-cta'));

  markCurrentPage(nav);

  // hamburger for mobile
  const navSections = nav.querySelector('.nav-sections');
  if (navSections) navSections.id = 'nav-sections';
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav-sections" aria-expanded="false" aria-label="Menü öffnen">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.querySelector('button').addEventListener('click', () => toggleMenu(nav));
  nav.append(hamburger);
  nav.setAttribute('aria-expanded', 'false');

  // close the menu on escape, on link click and when switching to desktop
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && nav.getAttribute('aria-expanded') === 'true') {
      toggleMenu(nav, false);
      hamburger.querySelector('button').focus();
    }
  });
  if (navSections) {
    navSections.addEventListener('click', (e) => {
      if (e.target.closest('a')) toggleMenu(nav, false);
    });
  }
  isDesktop.addEventListener('change', () => toggleMenu(nav, false));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);

  // subtle elevation once the page is scrolled
  const onScroll = () => navWrapper.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
