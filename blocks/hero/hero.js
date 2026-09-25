import {
  onDelayed, setResponsiveSources, HERO_IMAGE_WIDTHS, HERO_IMAGE_SIZES,
} from '../../scripts/scripts.js';

const ROTATE_MS = 6000;
// without any interaction, the rotation starts this long after the delayed phase
const IDLE_START_MS = 8000;
const INTERACTIONS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'];

/**
 * Calls fn once, on the visitor's first interaction or after the idle fallback,
 * whichever comes first (never before the delayed phase).
 * @param {Function} fn The callback
 */
function onEngaged(fn) {
  let done = false;
  let timer;
  const run = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    INTERACTIONS.forEach((type) => window.removeEventListener(type, run));
    fn();
  };
  onDelayed(() => {
    const options = { passive: true, once: true };
    INTERACTIONS.forEach((type) => window.addEventListener(type, run, options));
    timer = setTimeout(run, IDLE_START_MS);
  });
}

/**
 * Crossfades through the hero images; pausable and off for reduced motion.
 * Only the first image is part of the initial page. The others are fetched and the
 * rotation starts once the visitor engages (or after an idle fallback), so nothing in
 * the hero changes while the page is still loading.
 * @param {Element} media The media container
 * @param {Element[]} pictures The pictures to rotate (first one already in media)
 */
function rotate(media, pictures) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (pictures.length < 2 || reduced.matches) return;

  let index = 0;
  let timer;
  let started = false;
  let playing = true;
  const show = (i) => {
    pictures[index].classList.remove('is-active');
    index = (i + pictures.length) % pictures.length;
    pictures[index].classList.add('is-active');
  };
  const start = () => { timer = setInterval(() => show(index + 1), ROTATE_MS); };
  const stop = () => clearInterval(timer);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hero-pause';
  const setState = (on) => {
    playing = on;
    button.setAttribute('aria-pressed', on ? 'false' : 'true');
    button.setAttribute('aria-label', on ? 'Bildwechsel anhalten' : 'Bildwechsel fortsetzen');
    button.dataset.state = on ? 'playing' : 'paused';
  };
  button.addEventListener('click', () => {
    if (playing) stop(); else if (started) start();
    setState(!playing);
  });
  setState(true);
  media.append(button);

  onEngaged(() => {
    const loads = pictures.slice(1).map((pic) => {
      setResponsiveSources(pic, HERO_IMAGE_WIDTHS, HERO_IMAGE_SIZES);
      const img = pic.querySelector('img');
      button.before(pic);
      if (!img) return Promise.resolve();
      img.loading = 'eager';
      img.decoding = 'async';
      // the first switch waits for the next image, so a fade never shows a half-loaded image
      return img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    });
    loads[0].then(() => {
      started = true;
      if (playing) start();
    });
  });
}

/**
 * Hero: row 1 holds one or more images, row 2 holds heading, text and call to action.
 * Rows and cells may be missing or combined; everything is sorted by content type.
 * @param {Element} block The hero block element
 */
export default function decorate(block) {
  const pictures = [...block.querySelectorAll('picture')];
  const content = document.createElement('div');
  content.className = 'hero-content';

  [...block.querySelectorAll(':scope > div > div')].forEach((cell) => {
    [...cell.children].forEach((child) => {
      if (child.tagName === 'PICTURE' || (child.querySelector('picture') && !child.textContent.trim())) return;
      content.append(child);
    });
  });

  // the last standalone link becomes the call to action
  const ctaLinks = [...content.querySelectorAll('p > a:only-child')]
    .filter((a) => a.parentElement.textContent.trim() === a.textContent.trim());
  ctaLinks.forEach((a, i) => {
    a.className = `button ${i === 0 ? 'primary' : 'secondary'}`;
    a.parentElement.className = 'button-wrapper';
  });

  const media = document.createElement('div');
  media.className = 'hero-media';
  pictures.forEach((pic, i) => {
    pic.classList.add('hero-image');
    if (i === 0) pic.classList.add('is-active');
    else pic.remove(); // added back in the delayed phase
  });
  if (pictures[0]) media.append(pictures[0]);

  block.replaceChildren(content);
  if (pictures.length) {
    block.append(media);
    block.classList.add('has-media');
    rotate(media, pictures);
  }
}
