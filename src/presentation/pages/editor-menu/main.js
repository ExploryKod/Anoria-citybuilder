import { setBootMode } from '../site/bootSession.js';
import { bootSiteChrome } from '../site/bootSiteChrome.js';
import { setPendingEditorMap, takePendingEditorMap } from '../../../shared/gameplay/customMapLayout.js';
import { editorMapDocumentOf, readEditorMapDocument } from '../../../contexts/world-layout/application/queries/EditorMapDocument.js';
import { listEditorMapSummaries } from '../../../contexts/world-layout/application/queries/ListEditorMapSummaries.js';
import { loadEditorMapLayout } from '../../../contexts/world-layout/application/queries/LoadEditorMapLayout.js';
import { getEditorMapRepository } from '../../../composition/editorMapRepository.js';

bootSiteChrome();

const statusEl = document.getElementById('editor-menu-status');
const mapsEl = document.getElementById('editor-menu-maps');
if (!statusEl || !mapsEl) throw new Error('[editor-menu] #editor-menu-status and #editor-menu-maps are missing from editor.html');

function showError(message) {
  statusEl.hidden = false;
  statusEl.classList.add('is-error');
  statusEl.textContent = message;
}

/**
 * Enters the editor: on `mapDocument`, or blank when there is none.
 * @param {object | null} mapDocument a map document (see `parseEditorMapLayout`)
 */
function openEditor(mapDocument) {
  if (mapDocument) setPendingEditorMap(mapDocument);
  else takePendingEditorMap(); // blank: drop any map left waiting by an earlier choice
  setBootMode('editor');
  window.location.href = '/game';
}

document.getElementById('editor-menu-blank')?.addEventListener('click', () => openEditor(null));

const fileInput = document.getElementById('editor-menu-file');
fileInput?.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const mapDocument = JSON.parse(await file.text());
    readEditorMapDocument(mapDocument); // refused here, with its reason, rather than in the middle of the boot
    openEditor(mapDocument);
  } catch (error) {
    showError(`« ${file.name} » ne peut pas être ouvert : ${error instanceof Error ? error.message : error}`);
  }
});

async function renderSavedMaps() {
  const repository = getEditorMapRepository();
  const summaries = await listEditorMapSummaries(repository);
  if (summaries.length === 0) {
    mapsEl.innerHTML = '<li class="mission-modal-list-item">Aucune carte dans <code>public/maps</code>.</li>';
    return;
  }
  mapsEl.replaceChildren(...summaries.map((summary) => {
    const item = document.createElement('li');
    item.className = 'mission-modal-list-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.textContent = `${summary.name} (${summary.citySize} × ${summary.citySize})`;
    const open = async () => {
      try {
        openEditor(editorMapDocumentOf(await loadEditorMapLayout(repository, summary.id)));
      } catch (error) {
        showError(`« ${summary.name} » ne peut pas être ouverte : ${error instanceof Error ? error.message : error}`);
      }
    };
    item.addEventListener('click', open);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
    return item;
  }));
}

renderSavedMaps().catch((error) => showError(`Les cartes enregistrées ne peuvent pas être lues : ${error.message}`));
