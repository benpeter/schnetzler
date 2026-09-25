import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  buildBlock,
} from './aem.js';

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

/**
 * Local preview serves content below /content; production serves it from the root.
 * @returns {string} '/content' in local preview, otherwise ''
 */
export function getContentRoot() {
  return /^\/content(\/|$)/.test(window.location.pathname) ? '/content' : '';
}

/**
 * Resolves a site path against the content root, e.g. /nav -> /content/nav locally.
 * @param {string} path site-relative path
 * @returns {string} resolved path
 */
export function resolveContentPath(path) {
  const root = getContentRoot();
  return root && !path.startsWith(`${root}/`) ? `${root}${path === '/' ? '/' : path}` : path;
}

/**
 * Prefixes site-relative links with the content root (local preview only).
 * @param {Element} container The container element
 */
export function localizeLinks(container) {
  if (!getContentRoot()) return;
  container.querySelectorAll('a[href^="/"]:not([href^="//"])').forEach((a) => {
    a.setAttribute('href', resolveContentPath(a.getAttribute('href')));
  });
}

/**
 * Points a picture's sources at media-bus renditions of the given widths, so the browser
 * picks the rendition that matches the rendered size (w descriptors + sizes).
 * The element is changed in place, so no second request is triggered for the same image.
 * @param {HTMLPictureElement} picture The picture element
 * @param {number[]} widths Rendition widths in px
 * @param {string} sizes The sizes attribute describing the rendered width
 */
export function setResponsiveSources(picture, widths, sizes) {
  const img = picture && picture.querySelector('img');
  if (!img) return;
  const { origin, pathname } = new URL(img.getAttribute('src'), window.location.href);
  if (!pathname.includes('/media_')) return;
  const base = `${origin}${pathname}`;
  const ext = pathname.split('.').pop().toLowerCase();
  const fallback = ext === 'png' || ext === 'gif' ? 'png' : 'jpg';
  const set = (format) => widths.map((w) => `${base}?width=${w}&format=${format}&optimize=medium ${w}w`).join(', ');

  picture.querySelectorAll('source').forEach((source) => source.remove());
  const webp = document.createElement('source');
  webp.type = 'image/webp';
  webp.srcset = set('webply');
  webp.sizes = sizes;
  picture.prepend(webp);
  img.srcset = set(fallback);
  img.sizes = sizes;
}

// hero image slot: full width minus gutters below 900px, 1.1fr of a two-column grid above
const HERO_IMAGE_WIDTHS = [400, 540, 640, 800, 1080, 1280];
const HERO_IMAGE_SIZES = '(min-width: 1160px) 532px, (min-width: 900px) calc((100vw - 144px) * 0.524), calc(100vw - 48px)';

/**
 * Prepares the LCP candidate before the first section is shown: the first image of a hero
 * in the first section is loaded eagerly, with high priority and a matching rendition.
 * @param {Element} main The main element
 */
function prepareLcpImage(main) {
  const first = main.querySelector(':scope > div');
  const picture = first && first.querySelector('picture');
  const img = picture && picture.querySelector('img');
  if (!img) return;
  if (picture.closest('.hero')) setResponsiveSources(picture, HERO_IMAGE_WIDTHS, HERO_IMAGE_SIZES);
  img.loading = 'eager';
  img.fetchPriority = 'high';
}

export { HERO_IMAGE_WIDTHS, HERO_IMAGE_SIZES };

/**
 * Runs a callback in the delayed phase (after the page has loaded and settled).
 * @param {Function} fn The callback
 */
export function onDelayed(fn) {
  if (window.hlx && window.hlx.delayedPhase) fn();
  else document.addEventListener('aem:delayed', () => fn(), { once: true });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Turns `/widgets/...` links into widget blocks.
 * @param {Element} main The container element
 */
function buildWidgetAutoBlocks(main) {
  const widgetLinks = [...main.querySelectorAll('a[href*="/widgets/"]')];
  widgetLinks.forEach((link) => {
    if (link.closest('.widget')) return;
    const newLink = link.cloneNode(true);
    const widgetBlock = buildBlock('widget', { elems: [newLink] });
    const p = link.closest('p');
    if (
      p
      && p.querySelectorAll('a').length === 1
      && p.querySelector('a') === link
      && p.textContent.trim() === link.textContent.trim()
    ) {
      p.replaceWith(widgetBlock);
    } else {
      link.replaceWith(widgetBlock);
    }
  });
}

/**
 * Moves the leading page heading of pages without a hero into its own
 * "page-title" section so it can be styled as a title band.
 * @param {Element} main The container element
 */
function buildPageTitleSection(main) {
  if (main.querySelector('.hero')) return;
  const first = main.querySelector(':scope > div');
  const h1 = first && first.firstElementChild;
  if (!h1 || h1.tagName !== 'H1') return;
  const section = document.createElement('div');
  section.className = 'page-title';
  section.append(h1);
  main.prepend(section);
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    if (main.closest('body > main')) buildPageTitleSection(main);
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
    buildWidgetAutoBlocks(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Marks paragraphs that start with an image followed by text, so the image can float beside it.
 * @param {Element} main The container element
 */
function decorateInlineImages(main) {
  main.querySelectorAll('p > picture:first-child').forEach((pic) => {
    const p = pic.parentElement;
    const text = [...p.childNodes].filter((n) => n !== pic).map((n) => n.textContent).join('').trim();
    if (text) p.classList.add('has-inline-image');
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  localizeLinks(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
  decorateInlineImages(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'de';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    main.id = 'main';
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#main';
    skip.textContent = 'Zum Inhalt springen';
    doc.body.prepend(skip);
    prepareLcpImage(main);
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('body > header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  window.setTimeout(() => {
    window.hlx.delayedPhase = true;
    document.dispatchEvent(new CustomEvent('aem:delayed'));
    import('./consent-check.js');
    // load anything that can be postponed to the latest here
  }, 3000);
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
