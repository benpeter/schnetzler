import { readBlockConfig, toClassName } from '../../scripts/aem.js';

/**
 * Section Metadata: applies authored settings to the enclosing section.
 * "Style" values become section classes (comma separated), other keys become data attributes.
 * @param {Element} block The section metadata block element
 */
export default function decorate(block) {
  const section = block.closest('.section');
  const config = readBlockConfig(block);
  if (section) {
    Object.entries(config).forEach(([key, value]) => {
      if (key === 'style') {
        String(value).split(',').map((s) => toClassName(s.trim())).filter(Boolean)
          .forEach((style) => section.classList.add(style));
      } else {
        section.dataset[toClassName(key).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      }
    });
  }
  const wrapper = block.closest('.section-metadata-wrapper');
  (wrapper || block).remove();
}
