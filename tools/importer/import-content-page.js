/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import columnsIntroParser from './parsers/columns-intro.js';
import columnsContactParser from './parsers/columns-contact.js';
import cardsBooksParser from './parsers/cards-books.js';

// TRANSFORMER IMPORTS
import praxisSchnetzlerCleanupTransformer from './transformers/praxis-schnetzler-cleanup.js';
import praxisSchnetzlerSectionsTransformer from './transformers/praxis-schnetzler-sections.js';
import praxisSchnetzlerMetadataTransformer from './transformers/praxis-schnetzler-metadata.js';

// PARSER REGISTRY
const parsers = {
  'columns-intro': columnsIntroParser,
  'columns-contact': columnsContactParser,
  'cards-books': cardsBooksParser,
};

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  "name": "content-page",
  "description": "Standard WordPress page: page title plus rich text, optional floated image, optional column rows (contact options, intro with portrait and logos, book covers)",
  "urls": [
    "https://www.praxis-schnetzler.de/praxis",
    "https://www.praxis-schnetzler.de/amerikanische-chiropraktik",
    "https://www.praxis-schnetzler.de/klassische-homoeopathie",
    "https://www.praxis-schnetzler.de/fragen",
    "https://www.praxis-schnetzler.de/veroeffentlichungen",
    "https://www.praxis-schnetzler.de/kontakt",
    "https://www.praxis-schnetzler.de/impressum",
    "https://www.praxis-schnetzler.de/datenschutz",
    "https://www.praxis-schnetzler.de/test"
  ],
  "blocks": [
    {
      "name": "columns-intro",
      "instances": [
        ".entry-content > .container > .row:has(> .col-sm-2)"
      ]
    },
    {
      "name": "columns-contact",
      "instances": [
        ".entry-content > .container > .row:has(> .col-md-4)"
      ]
    },
    {
      "name": "cards-books",
      "instances": [
        ".entry-content > .container > .row:has(> .col-sm-6)"
      ]
    }
  ],
  "sections": [
    {
      "id": "1",
      "name": "page-content",
      "selector": [
        "article.page"
      ],
      "style": null,
      "blocks": [
        "columns-intro",
        "columns-contact",
        "cards-books"
      ],
      "defaultContent": [
        ".entry-title",
        ".entry-content"
      ]
    }
  ]
};

// TRANSFORMER REGISTRY - cleanup, then sections (only for 2+ sections), then metadata
const transformers = [
  praxisSchnetzlerCleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [praxisSchnetzlerSectionsTransformer] : []),
  praxisSchnetzlerMetadataTransformer,
];

/**
 * Execute all page transformers for a specific hook
 * @param {string} hookName - 'beforeTransform' or 'afterTransform'
 * @param {Element} element - The DOM element to transform
 * @param {Object} payload - { document, url, html, params }
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on the embedded template configuration
 * @param {Document} document - The DOM document
 * @param {Object} template - The embedded PAGE_TEMPLATE object
 * @returns {Array} block instances found on the page
 */
function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
      }
      elements.forEach((element) => {
        pageBlocks.push({
          name: blockDef.name, selector, element, section: blockDef.section || null,
        });
      });
    });
  });
  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;

    // body, not main: the hero (#myCarousel) sits in header.site-header outside <main>
    const main = document.body;

    // 1. Initial cleanup
    executeTransformers('beforeTransform', main, payload);

    // 2. Find and 3. parse blocks
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (parser) {
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    // 4. Final cleanup, section breaks and metadata block (metadata transformer replaces createMetadata)
    executeTransformers('afterTransform', main, payload);

    // 5. Built-in rules
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // 6. Sanitized path; root maps to /index
    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
