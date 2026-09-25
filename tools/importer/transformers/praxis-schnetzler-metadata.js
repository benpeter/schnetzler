/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: praxis-schnetzler.de page metadata block.
 *
 * - Title: source <title> text, decoded (e.g. "Kontakt – Praxis Jens Schnetzler"; suffix kept as in source)
 * - Description: <meta name="description"> if present (none of the current source pages have one)
 * - Image: <meta property="og:image"> if present (none of the current source pages have one)
 *
 * The import script should use this block instead of WebImporter.rules.createMetadata,
 * otherwise the page gets two Metadata blocks.
 */

function metaContent(doc, selector) {
  const el = doc && doc.querySelector(selector);
  const val = el && el.getAttribute('content');
  return val ? val.trim() : '';
}

export default function transform(hookName, element, payload) {
  if (hookName === 'afterTransform') {
    const doc = (payload && payload.document) || element.ownerDocument || document;
    const meta = {};

    const titleEl = doc.querySelector('head > title') || doc.querySelector('title');
    const title = (titleEl ? titleEl.textContent : doc.title || '').replace(/\s+/g, ' ').trim();
    if (title) meta.Title = title;

    const description = metaContent(doc, 'meta[name="description"]')
      || metaContent(doc, 'meta[property="og:description"]');
    if (description) meta.Description = description;

    const ogImage = metaContent(doc, 'meta[property="og:image"]');
    if (ogImage) {
      const img = doc.createElement('img');
      img.src = ogImage;
      img.alt = '';
      meta.Image = img;
    }

    if (!Object.keys(meta).length) return;
    const block = WebImporter.Blocks.getMetadataBlock
      ? WebImporter.Blocks.getMetadataBlock(doc, meta)
      : WebImporter.Blocks.createBlock(doc, { name: 'Metadata', cells: meta });
    element.append(block);
  }
}
