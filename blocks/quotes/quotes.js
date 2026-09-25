/**
 * Quotes: one row per quote (cell 1: quote text, cell 2: attribution).
 * The "rotating" variant shows one quote at a time, starting at a random one,
 * with previous/next controls. Without JavaScript all quotes stay readable.
 */

function buildQuote(row) {
  const [textCell, citeCell] = [...row.children];
  const figure = document.createElement('figure');
  figure.className = 'quotes-item';
  const blockquote = document.createElement('blockquote');
  if (textCell) blockquote.append(...textCell.childNodes);
  figure.append(blockquote);
  const citeText = citeCell ? citeCell.textContent.trim() : '';
  if (citeText) {
    const caption = document.createElement('figcaption');
    caption.textContent = citeText.replace(/^[—–-]\s*/, '');
    figure.append(caption);
  }
  return figure;
}

function setupRotation(block, items) {
  let index = Math.floor(Math.random() * items.length);
  const status = document.createElement('p');
  status.className = 'quotes-status';
  status.setAttribute('aria-live', 'polite');

  const show = (i) => {
    items[index].hidden = true;
    index = (i + items.length) % items.length;
    items[index].hidden = false;
    status.textContent = `Zitat ${index + 1} von ${items.length}`;
  };

  const controls = document.createElement('div');
  controls.className = 'quotes-controls';
  [['prev', 'Vorheriges Zitat', -1], ['next', 'Nächstes Zitat', 1]].forEach(([name, label, step]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `quotes-${name}`;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => show(index + step));
    controls.append(button);
  });
  controls.insertBefore(status, controls.lastElementChild);

  items.forEach((item) => { item.hidden = true; });
  items[index].hidden = false;
  status.textContent = `Zitat ${index + 1} von ${items.length}`;
  block.append(controls);
}

export default function decorate(block) {
  const items = [...block.children]
    .filter((row) => row.textContent.trim())
    .map(buildQuote);
  const list = document.createElement('div');
  list.className = 'quotes-list';
  list.append(...items);
  block.replaceChildren(list);

  if (block.classList.contains('rotating') && items.length > 1) setupRotation(block, items);
}
