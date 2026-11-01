/**
 * The Problems tab: what stands in the way of the building, one group per kind (infrastructure, purchases, later the strikes), each line opening with its emoji. The groups
 * are told apart by space, not by frames.
 * @param {HTMLElement} container
 * @param {{ groups: Array<{ title: string, lines: Array<{ emoji: string, text: string }> }> } | null} model
 */
export function renderProblemsView(container, model) {
  container.replaceChildren();
  if (!model) return;

  if (model.groups.length === 0) {
    const none = document.createElement('p');
    none.className = 'problems-none';
    none.textContent = '✅ Aucun problème connu';
    container.append(none);
    return;
  }

  for (const group of model.groups) {
    const section = document.createElement('section');
    section.className = 'problems-group';
    const title = document.createElement('h3');
    title.className = 'problems-group__title';
    title.textContent = group.title;
    const list = document.createElement('ul');
    list.className = 'problems-group__lines';
    for (const line of group.lines) {
      const item = document.createElement('li');
      item.className = 'problems-line';
      const emoji = document.createElement('span');
      emoji.className = 'problems-line__emoji';
      emoji.setAttribute('aria-hidden', 'true');
      emoji.textContent = line.emoji;
      const text = document.createElement('span');
      text.className = 'problems-line__text';
      text.textContent = line.text;
      item.append(emoji, text);
      list.append(item);
    }
    section.append(title, list);
    container.append(section);
  }
}
