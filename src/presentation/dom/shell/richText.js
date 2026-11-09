/**
 * A text as the catalogs write it (a dépêche, an explanation of the help), turned into the structure a modal shows. One convention for all of them, so every text is laid
 * out the same way: a blank line starts a block; a line starting with `## ` is a heading (an h3: the modal's own title is the h2); lines starting with `- ` make a list
 * (a row of pills that wraps, one per line, no bullet); `**…**` is bold; anything else is a paragraph, a single line break kept inside it.
 *
 * Built with the DOM (createElement, createTextNode), never with innerHTML: the text only ever becomes text nodes, so nothing in it, whatever it holds (a name the player typed,
 * a `<script>`), can become markup. There is no escaping to forget, because there is nothing to escape. Do not bring innerHTML back to "simplify" this.
 */

/** @param {string} line @returns {Array<{ text: string, bold: boolean }>} the pieces of a line, the ones between `**…**` bold */
function inlinePieces(line) {
  // Split on a capturing group: the odd pieces are what sat between the markers.
  return line.split(/\*\*(.+?)\*\*/).map((text, index) => ({ text, bold: index % 2 === 1 })).filter((piece) => piece.text !== '');
}

/** @param {HTMLElement} parent @param {string} line */
function appendInline(parent, line) {
  for (const { text, bold } of inlinePieces(line)) {
    if (!bold) {
      parent.append(document.createTextNode(text));
      continue;
    }
    const strong = document.createElement('strong');
    strong.textContent = text;
    parent.append(strong);
  }
}

/**
 * @param {string} text
 * @returns {DocumentFragment} the blocks of the text: p, h3, ul (li), with the classes the modals style
 */
export function richTextNodes(text) {
  const blocks = [];
  for (const group of String(text).split(/\n{2,}/)) {
    // Inside a group, consecutive lines of one kind make one block, in the order they were written.
    for (const line of group.split('\n')) {
      const kind = line.startsWith('## ') ? 'heading' : line.startsWith('- ') ? 'list' : 'paragraph';
      const content = kind === 'heading' ? line.slice(3) : kind === 'list' ? line.slice(2) : line;
      const last = blocks[blocks.length - 1];
      if (kind !== 'heading' && last && last.kind === kind && last.group === group) last.lines.push(content);
      else blocks.push({ kind, group, lines: [content] });
    }
  }
  const fragment = document.createDocumentFragment();
  for (const { kind, lines } of blocks) {
    if (kind === 'heading') {
      const heading = document.createElement('h3');
      heading.className = 'news-event-heading';
      appendInline(heading, lines[0]);
      fragment.append(heading);
    } else if (kind === 'list') {
      const list = document.createElement('ul');
      list.className = 'news-event-list';
      for (const line of lines) {
        const item = document.createElement('li');
        appendInline(item, line);
        list.append(item);
      }
      fragment.append(list);
    } else {
      const paragraph = document.createElement('p');
      paragraph.className = 'news-event-paragraph';
      lines.forEach((line, index) => {
        if (index > 0) paragraph.append(document.createElement('br'));
        appendInline(paragraph, line);
      });
      fragment.append(paragraph);
    }
  }
  return fragment;
}

/**
 * Shows a text in a container, replacing what it held.
 * @param {HTMLElement} container a div (the blocks are p, h3 and ul: never a p)
 * @param {string} text
 */
export function renderRichText(container, text) {
  container.replaceChildren(richTextNodes(text));
}
