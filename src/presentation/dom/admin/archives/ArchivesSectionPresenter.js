import { labelForNewsSource } from '../../../../contexts/intelligence/domain/catalogs/NewsSourceCatalog.js';
import { labelForNewsCategory } from '../../../../contexts/intelligence/domain/catalogs/NewsCategoryCatalog.js';
import { TimeManager } from '../../../../shared/time/TimeManager.js';

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

    this.listEl.innerHTML = items
      .map((item) => {
        let when = `Tour ${item.turn}`;
        try {
          const info = TimeManager.getTimeInfo(item.turn);
          when = `${info.month} — an ${info.year + 1}`;
        } catch {
          /* keep fallback */
        }
        const source = labelForNewsSource(item.sourceId);
        const category = labelForNewsCategory(item.categoryId);
        const safeId = escapeHtml(item.id);
        return `
          <article class="archives-news-item" data-news-id="${safeId}">
            <header class="archives-news-item-header">
              <div class="archives-news-item-heading">
                <span class="archives-news-item-meta">${source} · ${category} · ${when}</span>
                <h4 class="archives-news-item-title">${escapeHtml(item.title)}</h4>
              </div>
              <button
                type="button"
                class="archives-news-delete-btn"
                data-archives-delete="${safeId}"
                title="Supprimer cette dépêche"
                aria-label="Supprimer la dépêche ${escapeHtml(item.title)}"
              >${TRASH_ICON}</button>
            </header>
            <p class="archives-news-item-body">${escapeHtml(item.body)}</p>
          </article>
        `;
      })
      .join('');
  }
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
