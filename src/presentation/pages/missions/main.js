import {
  STORY_MISSIONS,
  OPEN_MISSIONS,
  getMissionById,
  isOpenMission,
} from './missionCatalog.js';
import { addProfile, listProfiles } from './profileStore.js';
import {
  setBootMode,
  setMissionId,
  setProfileName,
} from '../site/bootSession.js';
import {
  setMissionMapLayoutId,
  clearMissionMapLayout,
} from '../../../shared/gameplay/customMapLayout.js';
import { bootSiteChrome } from '../site/bootSiteChrome.js';
import {
  deleteEditorMapById,
  loadAvailableEditorMaps,
  renderMapGrid,
  renderMyMapSection,
  uploadEditorMapFile,
} from './mapLayoutPanel.js';

bootSiteChrome();

const listEl = document.getElementById('missions-list');
const detailEl = document.getElementById('mission-detail');
const startBtn = document.getElementById('mission-start-btn');
const profileModal = document.getElementById('profile-modal');
const profileModalList = document.getElementById('profile-modal-list');
const profileModalClose = document.getElementById('profile-modal-close');
const profileModalConfirm = document.getElementById('profile-modal-confirm');

/** @type {import('../../../contexts/world-layout/domain/EditorMapLayout.js').EditorMapSummary[]} */
let mapSummaries = [];

let selectedMissionId = STORY_MISSIONS[0]?.id ?? '';
/** Carte choisie pour la mission open (public/maps), indépendante de l'id mission. */
let selectedMapLayoutId = null;
let profileMode = 'new';
let selectedExistingProfile = '';

function getSelectedMission() {
  return getMissionById(selectedMissionId);
}

function getProfileNewInput() {
  return document.getElementById('profile-new-name');
}

function getActiveProfileName() {
  if (profileMode === 'existing') {
    return selectedExistingProfile.trim();
  }
  return getProfileNewInput()?.value?.trim() ?? '';
}

function updateStartButtonState() {
  if (!startBtn) return;
  const mission = getSelectedMission();
  const name = getActiveProfileName();
  const openReady = !isOpenMission(mission) || Boolean(selectedMapLayoutId);
  startBtn.disabled = !name || !openReady;
}

function setProfileMode(mode) {
  profileMode = mode;
  const newPanel = document.getElementById('profile-new-panel');
  const existingPanel = document.getElementById('profile-existing-panel');
  if (newPanel) {
    newPanel.hidden = mode !== 'new';
  }
  if (existingPanel) {
    existingPanel.hidden = mode !== 'existing';
  }
  document.querySelectorAll('input[name="profile-mode"]').forEach((input) => {
    input.checked = input.value === mode;
  });
  updateStartButtonState();
}

function renderProfileModalList() {
  if (!profileModalList) return;
  const profiles = listProfiles();
  profileModalList.innerHTML = profiles.map((name) => `
    <li
      class="mission-modal-list-item${name === selectedExistingProfile ? ' is-selected' : ''}"
      data-name="${name}"
      role="button"
      tabindex="0"
    >${name}</li>
  `).join('');

  profileModalList.querySelectorAll('.mission-modal-list-item').forEach((item) => {
    const pick = () => {
      selectedExistingProfile = item.dataset.name ?? '';
      profileModalList.querySelectorAll('.mission-modal-list-item').forEach((el) => {
        el.classList.toggle('is-selected', el === item);
      });
    };
    item.addEventListener('click', pick);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick();
      }
    });
  });
}

function openProfileModal() {
  if (!profileModal) return;
  renderProfileModalList();
  profileModal.hidden = false;
}

function closeProfileModal() {
  if (!profileModal) return;
  profileModal.hidden = true;
  const selectedEl = document.getElementById('profile-selected-name');
  if (selectedEl && selectedExistingProfile) {
    selectedEl.textContent = `Profil : ${selectedExistingProfile}`;
  }
  updateStartButtonState();
}

function selectMapLayout(mapId) {
  selectedMapLayoutId = mapId;
  renderDetail(getSelectedMission());
}

function bindMyMapPanel() {
  const uploadInput = document.getElementById('mission-map-upload');
  const statusEl = document.getElementById('mission-map-upload-status');
  const gridEl = document.getElementById('mission-map-grid');
  const openEditorBtn = document.getElementById('mission-map-open-editor');

  openEditorBtn?.addEventListener('click', () => {
    setBootMode('editor');
    window.location.href = '/game';
  });

  const showStatus = (message, isError = false) => {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', isError);
  };

  renderMapGrid(
    gridEl,
    mapSummaries,
    selectedMapLayoutId,
    selectMapLayout,
    async (mapId) => {
      if (!window.confirm('Supprimer cette carte ?')) {
        return;
      }
      try {
        await deleteEditorMapById(mapId);
        if (selectedMapLayoutId === mapId) {
          selectedMapLayoutId = null;
        }
        await refreshMaps();
        renderDetail(getSelectedMission());
      } catch (error) {
        showStatus(
          error instanceof Error ? error.message : 'Suppression impossible',
          true
        );
      }
    }
  );

  uploadInput?.addEventListener('change', async () => {
    const file = uploadInput.files?.[0];
    uploadInput.value = '';
    if (!file) return;

    try {
      const summary = await uploadEditorMapFile(file);
      showStatus(`Carte « ${summary.name} » enregistrée.`);
      await refreshMaps();
      selectMapLayout(summary.id);
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : 'Téléversement impossible',
        true
      );
    }
  });
}

function renderDetail(mission) {
  if (!detailEl) return;

  const winHtml = mission.winConditions
    .map((c) => `<li>${c.label} : <strong>${c.value}</strong></li>`)
    .join('');

  const buildingsHtml = mission.buildings?.length
    ? `<p class="missions-buildings">Bâtiments notables : ${mission.buildings.join(', ')}</p>`
    : '';

  const myMapHtml = isOpenMission(mission)
    ? renderMyMapSection(selectedMapLayoutId)
    : '';

  detailEl.innerHTML = `
    <div class="missions-detail-header">
      <div class="missions-preview" aria-hidden="true">${mission.previewEmoji}</div>
      <div class="missions-detail-titles">
        <h2>${mission.name}</h2>
        <p class="missions-detail-subtitle">${mission.title}</p>
      </div>
    </div>
    <ul class="missions-meta">
      <li><strong>${mission.date}</strong></li>
      <li>${mission.climate}</li>
      <li>Taille de la cité : <strong>${mission.citySize} × ${mission.citySize}</strong></li>
      <li>${mission.combat}</li>
      <li>${mission.difficulty}</li>
    </ul>
    <p class="site-section-title">Conditions de victoire</p>
    <ul class="missions-win-list">${winHtml}</ul>
    ${buildingsHtml}
    <div class="mission-profile">
      <p class="site-section-title" id="mission-profile-label">Profil</p>
      <div
        class="mission-profile-modes"
        role="radiogroup"
        aria-labelledby="mission-profile-label"
      >
        <label class="mission-profile-mode">
          <input
            type="radio"
            name="profile-mode"
            value="new"
            ${profileMode === 'new' ? 'checked' : ''}
          >
          Nouveau profil
        </label>
        <label class="mission-profile-mode">
          <input
            type="radio"
            name="profile-mode"
            value="existing"
            ${profileMode === 'existing' ? 'checked' : ''}
          >
          Profil existant
        </label>
      </div>
      <p class="mission-profile-modes-hint">Utilisez les flèches du clavier pour changer d'option.</p>
      <div id="profile-new-panel" class="mission-profile-panel" ${profileMode !== 'new' ? 'hidden' : ''}>
        <input
          type="text"
          id="profile-new-name"
          class="mission-profile-input"
          placeholder="Nom du profil"
          maxlength="32"
          autocomplete="name"
        >
      </div>
      <div id="profile-existing-panel" class="mission-profile-panel" ${profileMode !== 'existing' ? 'hidden' : ''}>
        <button type="button" id="profile-pick-btn" class="site-btn site-btn--inline">
          Choisir un profil…
        </button>
        <p id="profile-selected-name" class="mission-profile-selected">${selectedExistingProfile ? `Profil : ${selectedExistingProfile}` : ''}</p>
      </div>
    </div>
    ${myMapHtml}
  `;

  document.querySelectorAll('input[name="profile-mode"]').forEach((input) => {
    input.addEventListener('change', () => setProfileMode(input.value));
  });

  const newInput = getProfileNewInput();
  if (newInput) {
    newInput.addEventListener('input', updateStartButtonState);
  }

  const pickBtn = document.getElementById('profile-pick-btn');
  if (pickBtn) {
    pickBtn.addEventListener('click', openProfileModal);
  }

  if (isOpenMission(mission)) {
    bindMyMapPanel();
  }

  updateStartButtonState();
}

function renderMissionList() {
  if (!listEl) return;

  const storyItems = STORY_MISSIONS.map((mission) => `
    <li
      class="missions-list-item${mission.id === selectedMissionId ? ' is-selected' : ''}"
      data-id="${mission.id}"
      role="button"
      tabindex="0"
    >${mission.name}</li>
  `).join('');

  const openItems = OPEN_MISSIONS.map((mission) => `
    <li
      class="missions-list-item${mission.id === selectedMissionId ? ' is-selected' : ''}"
      data-id="${mission.id}"
      role="button"
      tabindex="0"
    >${mission.name}</li>
  `).join('');

  listEl.innerHTML = `
    <li class="missions-list-section" aria-hidden="true">Missions scénarisées</li>
    ${storyItems}
    <li class="missions-list-section" aria-hidden="true">Open mission</li>
    ${openItems}
  `;

  listEl.querySelectorAll('.missions-list-item').forEach((item) => {
    item.addEventListener('click', () => selectMission(item.dataset.id));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectMission(item.dataset.id);
      }
    });
  });
}

function selectMission(id) {
  if (!id) return;
  selectedMissionId = id;
  if (!isOpenMission(getMissionById(id))) {
    selectedMapLayoutId = null;
  }
  renderMissionList();
  renderDetail(getSelectedMission());
}

async function refreshMaps() {
  mapSummaries = await loadAvailableEditorMaps();
  if (selectedMapLayoutId && !mapSummaries.some((m) => m.id === selectedMapLayoutId)) {
    selectedMapLayoutId = null;
  }
}

function startMission() {
  const profileName = getActiveProfileName();
  if (!profileName) return;

  const mission = getSelectedMission();
  if (isOpenMission(mission) && !selectedMapLayoutId) {
    return;
  }

  if (profileMode === 'new') {
    addProfile(profileName);
  }

  setBootMode('mission');
  setMissionId(mission.id);
  setProfileName(profileName);
  if (isOpenMission(mission) && selectedMapLayoutId) {
    setMissionMapLayoutId(selectedMapLayoutId);
  } else {
    clearMissionMapLayout();
  }
  window.location.href = '/game';
}

if (startBtn) {
  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    startMission();
  });
}

if (profileModalClose) {
  profileModalClose.addEventListener('click', closeProfileModal);
}

if (profileModalConfirm) {
  profileModalConfirm.addEventListener('click', closeProfileModal);
}

if (profileModal) {
  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
      closeProfileModal();
    }
  });
}

await refreshMaps();
renderMissionList();
selectMission(selectedMissionId);
