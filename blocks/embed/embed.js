/**
 * Embed: renders the linked video. Vimeo/YouTube load only after the visitor
 * clicks play (no third-party request before consent); .mp4 files use the
 * native video player.
 */

const PROVIDERS = [
  {
    name: 'Vimeo',
    match: /vimeo\.com\/(?:video\/)?(\d+)/,
    src: (id) => `https://player.vimeo.com/video/${id}?dnt=1&autoplay=1`,
  },
  {
    name: 'YouTube',
    match: /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/,
    src: (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
  },
];

function toHttps(url) {
  return url.replace(/^http:\/\//i, 'https://');
}

function buildVideo(url, title) {
  const video = document.createElement('video');
  video.controls = true;
  video.preload = 'metadata';
  video.playsInline = true;
  if (title) video.setAttribute('aria-label', title);
  const source = document.createElement('source');
  source.src = toHttps(url);
  source.type = 'video/mp4';
  const fallback = document.createElement('a');
  fallback.href = source.src;
  fallback.textContent = 'Video herunterladen';
  video.append(source, fallback);
  return video;
}

function buildFacade(provider, id, title, poster) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'embed-facade';
  button.setAttribute('aria-label', `${title || 'Video'} abspielen (lädt ${provider.name})`);
  if (poster) button.append(poster);
  const label = document.createElement('span');
  label.className = 'embed-facade-label';
  label.innerHTML = `<span class="embed-play" aria-hidden="true"></span><span>Video abspielen</span><small>Beim Abspielen wird eine Verbindung zu ${provider.name} hergestellt.</small>`;
  button.append(label);
  button.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = provider.src(id);
    iframe.title = title || `${provider.name} Video`;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    button.replaceWith(iframe);
    iframe.focus();
  });
  return button;
}

export default function decorate(block) {
  const link = block.querySelector('a[href]');
  if (!link) return;
  const url = link.href;
  const poster = block.querySelector('picture');

  // the nearest preceding heading names the video for assistive technology
  const wrapper = block.closest('.embed-wrapper') || block;
  let prev = wrapper.previousElementSibling;
  if (prev && prev.classList.contains('default-content-wrapper')) prev = prev.lastElementChild;
  const title = prev && /^H[1-6]$/.test(prev.tagName) ? prev.textContent.trim() : '';

  const frame = document.createElement('div');
  frame.className = 'embed-frame';

  const provider = PROVIDERS.find((p) => p.match.test(url));
  if (provider) {
    frame.append(buildFacade(provider, url.match(provider.match)[1], title, poster));
  } else if (/\.mp4(\?|$)/i.test(url)) {
    frame.append(buildVideo(url, title));
  } else {
    frame.append(link);
  }
  block.replaceChildren(frame);
}
