import { labelForNewsSource, labelForNewsCategory } from '../../../../composition/intelligenceCatalog.js';
import { TimeManager } from '../../../../shared/time/TimeManager.js';
import { listHamlets } from '../../../../core/persistence/hamlet/hamletSession.js';
import { renderRichText } from '../../shell/richText.js';
import { raw } from '../../shell/safeHtml.js';

const TRASH_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    <line x1="10" x2="10" y1="11" y2="17"/>
    <line x1="14" x2="14" y1="11" y2="17"/>
  </svg>
`;

export class ArchivesSectionPresenter {
  /**
   * @param {{ intelligence: object }} deps
   */
  constructor(deps) {
    this.intelligence = deps.intelligence;
    this.listEl = null;
    this._onListClick = this._onListClick.bind(this);
  }

  init() {
    this.listEl = document.getElementById('archives-news-list');
    if (this.listEl && !this.listEl.dataset.deleteBound) {
      this.listEl.addEventListener('click', this._onListClick);
      this.listEl.dataset.deleteBound = '1';
    }
    void this.loadArchives();
  }

  /**
   * @param {MouseEvent} event
   */
  async _onListClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('[data-archives-delete]');
    if (!btn || !this.listEl?.contains(btn)) return;

    const newsId = btn.getAttribute('data-archives-delete');
    if (!newsId) return;

    btn.setAttribute('disabled', 'true');
    try {
      await this.intelligence.deleteNewsItem({ newsItemId: newsId });
      await this.loadArchives();
    } catch (err) {
      console.error('[Archives] delete failed:', err?.message || err);
      btn.removeAttribute('disabled');
    }
  }

  async loadArchives() {
    if (!this.listEl) {
      this.listEl = document.getElementById('archives-news-list');
    }
    if (!this.listEl) return;

    if (!this.listEl.dataset.deleteBound) {
      this.listEl.addEventListener('click', this._onListClick);
      this.listEl.dataset.deleteBound = '1';
    }

    const items = await this.intelligence.listArchivedNews();
    if (!items.length) {
      this.listEl.innerHTML =
        '<p class="archives-empty">Aucune dépêche archivée pour le moment.</p>';
      return;
    }

    const hamletNames = new Map((await listHamlets()).map((hamlet) => [hamlet.id, hamlet.name]));
    // Built with the DOM: what a dépêche says (title, text, hamlet name) only ever becomes text nodes or attribute values, never markup. The one innerHTML left is the
    // trash icon, a constant of this file.
    this.listEl.replaceChildren(...items.map((item) => {
      const hamletName = hamletNames.get(item.hamletId);
      if (hamletName === undefined) {
        throw new Error(`[archives] news ${item.id} belongs to an unknown hamlet ${item.hamletId}`);
      }
      let when = `Tour ${item.turn}`;
      try {
        const info = TimeManager.getTimeInfo(item.turn);
        when = `${info.month} — an ${info.year + 1}`;
      } catch {
        /* keep fallback */
      }
      const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
      };
      const article = element('article', 'archives-news-item');
      article.dataset.newsId = item.id;
      const header = element('header', 'archives-news-item-header');
      const heading = element('div', 'archives-news-item-heading');
      heading.append(
        element('span', 'archives-news-item-meta', `${labelForNewsSource(item.sourceId)} · ${labelForNewsCategory(item.categoryId)} · ${when} · ${hamletName}`),
        element('h4', 'archives-news-item-title', item.title),
      );
      const deleteButton = element('button', 'archives-news-delete-btn');
      deleteButton.type = 'button';
      deleteButton.dataset.archivesDelete = item.id;
      deleteButton.title = 'Supprimer cette dépêche';
      deleteButton.setAttribute('aria-label', `Supprimer la dépêche ${item.title}`);
      deleteButton.innerHTML = raw(TRASH_ICON);
      header.append(heading, deleteButton);
      const body = element('div', 'archives-news-item-body');
      renderRichText(body, item.body);
      article.append(header, body);
      return article;
    }));
  }
}
