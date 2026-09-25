/* eslint-disable */
/* global WebImporter */

/**
 * Import script: site navigation fragment (/nav) from the praxis-schnetzler.de homepage.
 *
 * Source: WordPress Bootstrap navbar (#nav) — brand link (.navbar-brand) plus the flat
 * main menu (#menu-hauptmenu). The hero CTA ("Termin ausmachen!" -> /kontakt) becomes the
 * header call to action.
 *
 * Output sections (flat and semantic for DA):
 *   1. brand   — link to the homepage
 *   2. sections — list of the main menu links
 *   3. tools   — appointment CTA
 */

const SITE_HOST_RE = /^https?:\/\/(www\.)?praxis-schnetzler\.de(?=\/|$)/i;

function relative(href) {
  if (!href || !SITE_HOST_RE.test(href)) return href;
  return href.replace(SITE_HOST_RE, '').replace(/\/$/, '') || '/';
}

function link(document, href, text) {
  const a = document.createElement('a');
  a.href = relative(href);
  a.textContent = text.trim();
  return a;
}

export default {
  transform: ({ document, params }) => {
    const main = document.createElement('main');

    // 1. Brand
    const brandSrc = document.querySelector('#nav .navbar-brand') || document.querySelector('#myCarousel .hero h1');
    const brand = document.createElement('div');
    const brandP = document.createElement('p');
    brandP.append(link(document, brandSrc && brandSrc.getAttribute('href') ? brandSrc.getAttribute('href') : '/', brandSrc.textContent));
    brand.append(brandP);

    // 2. Main menu
    const sections = document.createElement('div');
    const ul = document.createElement('ul');
    document.querySelectorAll('#menu-hauptmenu > li > a').forEach((a) => {
      const li = document.createElement('li');
      li.append(link(document, a.getAttribute('href'), a.textContent));
      ul.append(li);
    });
    sections.append(ul);

    // 3. Appointment CTA (from the homepage hero button)
    const tools = document.createElement('div');
    const cta = document.querySelector('#myCarousel .hero a.btn');
    if (cta) {
      const p = document.createElement('p');
      p.append(link(document, cta.getAttribute('href'), cta.textContent));
      tools.append(p);
    }

    main.append(brand, document.createElement("hr"), sections, document.createElement("hr"), tools);

    return [{
      element: main,
      path: '/nav',
      report: {
        title: 'nav',
        links: ul.children.length,
      },
    }];
  },
};
