const ROTATE_MS = 6000;

/**
 * Crossfades through the hero images; pausable and off for reduced motion.
 * @param {Element} media The media container
 * @param {Element[]} pictures The pictures to rotate
 */
function rotate(media, pictures) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (pictures.length < 2 || reduced.matches) return;

  let index = 0;
  let timer;
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
  const setState = (playing) => {
    button.setAttribute('aria-pressed', playing ? 'false' : 'true');
    button.setAttribute('aria-label', playing ? 'Bildwechsel anhalten' : 'Bildwechsel fortsetzen');
    button.dataset.state = playing ? 'playing' : 'paused';
  };
  button.addEventListener('click', () => {
    const playing = button.dataset.state === 'playing';
    if (playing) stop(); else start();
    setState(!playing);
  });
  setState(true);
  media.append(button);

  // lazy images beyond the first only load once rotation is about to show them
  pictures.slice(1).forEach((pic) => {
    const img = pic.querySelector('img');
    if (img) img.loading = 'lazy';
  });
  start();
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
    media.append(pic);
  });

  block.replaceChildren(content);
  if (pictures.length) {
    block.append(media);
    block.classList.add('has-media');
    rotate(media, pictures);
  }
}
