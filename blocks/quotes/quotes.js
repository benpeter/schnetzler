/**
 * Quotes: one row per quote (cell 1: quote text, cell 2: attribution).
 * The "rotating" variant shows one quote at a time, starting at a random one,
 * with previous/next controls. Without JavaScript all quotes stay readable.
 */

const OPENING_MARKS = /^[„“"«»‚‘'…]/;

/**
 * Splits an attribution into the person's name and the context that follows,
 * e.g. "Dr. Peter Fisher, Forschungsleiter am …" -> ["Dr. Peter Fisher", "Forschungsleiter am …"].
 * Attributions that do not start with a short name stay context only.
 * @param {string} text The attribution text
 * @returns {string[]} [name, context]
 */
function splitAttribution(text) {
  const match = text.match(/^(.{2,48}?)(?:,\s+|\s+(?=(?:in|im|aus)\s))(.+)$/);
  if (/^(aus|in|im)\s/i.test(text)) return ['', text];
  if (!match) return text.length <= 48 ? [text, ''] : ['', text];
  return [match[1].trim(), match[2].trim()];
}

function buildQuote(row) {
  const [textCell, citeCell] = [...row.children];
  const figure = document.createElement('figure');
  figure.className = 'quotes-item';

  const blockquote = document.createElement('blockquote');
  if (textCell) blockquote.append(...textCell.childNodes);
  // add German quotation marks only when the authored text has none
  if (!OPENING_MARKS.test(blockquote.textContent.trim())) blockquote.classList.add('quotes-add-marks');
  figure.append(blockquote);

  const citeText = citeCell ? citeCell.textContent.trim().replace(/^[—–-]\s*/, '') : '';
  if (citeText) {
    const [name, context] = splitAttribution(citeText);
    const caption = document.createElement('figcaption');
    const cite = document.createElement('cite');
    if (name) {
      const nameEl = document.createElement('span');
      nameEl.className = 'quotes-name';
      nameEl.textContent = name;
      cite.append(nameEl);
    }
    if (context) {
      const contextEl = document.createElement('span');
      contextEl.className = 'quotes-context';
      if (name) {
        // joins name and context into one phrase for assistive technology
        const comma = document.createElement('span');
        comma.className = 'quotes-sr-only';
        comma.textContent = ', ';
        contextEl.append(comma);
      }
      contextEl.append(context);
      cite.append(contextEl);
    }
    caption.append(cite);
    figure.append(caption);
  }
  return figure;
}

function setupRotation(block, list, items) {
  let index = Math.floor(Math.random() * items.length);

  const controls = document.createElement('div');
  controls.className = 'quotes-controls';
  const status = document.createElement('p');
  status.className = 'quotes-status';

  const show = (i) => {
    items[index].hidden = true;
    index = (i + items.length) % items.length;
    items[index].hidden = false;
    status.textContent = `Zitat ${index + 1} von ${items.length}`;
  };

  const buttons = [['prev', 'Vorheriges Zitat', -1], ['next', 'Nächstes Zitat', 1]]
    .map(([name, label, step]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `quotes-${name}`;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-controls', list.id);
      button.addEventListener('click', () => show(index + step));
      return button;
    });

  controls.append(status, ...buttons);
  items.forEach((item) => { item.hidden = true; });
  items[index].hidden = false;
  status.textContent = `Zitat ${index + 1} von ${items.length}`;

  // the newly shown quote is announced when stepping
  list.setAttribute('aria-live', 'polite');
  block.prepend(controls);
}

let quotesCount = 0;

export default function decorate(block) {
  const items = [...block.children]
    .filter((row) => row.textContent.trim())
    .map(buildQuote);
  const list = document.createElement('div');
  list.className = 'quotes-list';
  quotesCount += 1;
  list.id = `quotes-list-${quotesCount}`;
  list.append(...items);
  block.replaceChildren(list);

  if (block.classList.contains('rotating') && items.length > 1) setupRotation(block, list, items);
}
