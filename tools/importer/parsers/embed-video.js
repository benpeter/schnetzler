/* eslint-disable */
/* global WebImporter */

/**
 * Parser for embed-video.
 * Base block: embed. Source: https://www.praxis-schnetzler.de/ (two videos). Generated: 2026-09-25
 *
 * Output table (DA block name "Embed (video)"): one row, one cell with a link whose text and
 * href are the video URL (optional poster image above the link, per the embed convention).
 *
 * Handles both instances (migration-work/block-context/embed-video/source.html + instances/01.html):
 *   1. figure.wp-block-embed > .wp-block-embed__wrapper > iframe[src*="player.vimeo.com/video/<id>"]
 *        -> https://vimeo.com/<id>   (YouTube embeds -> https://www.youtube.com/watch?v=<id>)
 *   2. .wp-video > video.wp-video-shortcode > source[src] + fallback <a href>
 *      and the live MediaElement.js variant (.mejs-container / mediaelementwrapper > video[src])
 *        -> mp4 URL with the "?_=N" cache buster removed
 * A figcaption (if any) is kept as a paragraph after the block so nothing is dropped.
 */
export default function parse(element, { document }) {
  const stripCacheBuster = (url) => url.replace(/([?&])_=\d+(&|$)/, (m, pre, post) => (post ? pre : '')).replace(/[?&]$/, '');

  const fromIframe = (src) => {
    let m = src.match(/player\.vimeo\.com\/video\/(\d+)/i);
    if (m) return `https://vimeo.com/${m[1]}`;
    m = src.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]+)/i);
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
    return src.startsWith('//') ? `https:${src}` : src;
  };

  let url = '';
  const iframe = element.querySelector('iframe[src], iframe[data-src]');
  if (iframe) {
    url = fromIframe(iframe.getAttribute('src') || iframe.getAttribute('data-src') || '');
  }

  const video = element.querySelector('video');
  if (!url) {
    const candidates = [
      video && video.getAttribute('src'),
      ...[...element.querySelectorAll('video source[src], source[src]')].map((s) => s.getAttribute('src')),
      ...[...element.querySelectorAll('video a[href], a[href]')].map((a) => a.getAttribute('href')),
    ].filter((u) => u && !u.startsWith('blob:') && !u.startsWith('#'));
    const preferred = candidates.find((u) => /\.(mp4|webm|ogv|m4v|mov)(\?|$)/i.test(u)) || candidates[0];
    if (preferred) url = stripCacheBuster(preferred);
  }

  // Figure-level embed with only a link (e.g. oEmbed not rendered)
  if (!url) {
    const wrapper = element.querySelector('.wp-block-embed__wrapper');
    const text = wrapper && wrapper.textContent.trim();
    if (text && /^https?:\/\//.test(text)) url = text;
  }

  if (!url) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cell = [];
  const poster = video && video.getAttribute('poster');
  if (poster) {
    const img = document.createElement('img');
    img.src = poster;
    cell.push(img);
  }
  const a = document.createElement('a');
  a.href = url;
  a.textContent = url;
  cell.push(a);

  const cells = [[cell]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'Embed (video)', cells });

  const caption = element.querySelector('figcaption');
  if (caption && caption.textContent.trim()) {
    const p = document.createElement('p');
    while (caption.firstChild) p.append(caption.firstChild);
    element.replaceWith(block, p);
    return;
  }
  element.replaceWith(block);
}
