import { MISSIONS, getMissionById } from './missionCatalog.js';
import { addProfile, listProfiles } from './profileStore.js';
import {
  setBootMode,
  setMissionId,
  setProfileName,
} from '../site/bootSession.js';
import { bootSiteChrome } from '../site/bootSiteChrome.js';

bootSiteChrome();

const listEl = document.getElementById('missions-list');
const detailEl = document.getElementById('mission-detail');
const startBtn = document.getElementById('mission-start-btn');
const profileModal = document.getElementById('profile-modal');
const profileModalList = document.getElementById('profile-modal-list');
const profileModalClose = document.getElementById('profile-modal-close');
const profileModalConfirm = document.getElementById('profile-modal-confirm');

let selectedMissionId = MISSIONS[0]?.id ?? '';
let profileMode = 'new';
let selectedExistingProfile = '';

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
  const name = getActiveProfileName();
  startBtn.disabled = !name;
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

function renderDetail(mission) {
  if (!detailEl) return;

  const winHtml = mission.winConditions
    .map((c) => `<li>${c.label} : <strong>${c.value}</strong></li>`)
    .join('');

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
      <li>${mission.land}</li>
      <li>Taille de la cité : <strong>${mission.citySize} × ${mission.citySize}</strong></li>
      <li>${mission.combat}</li>
      <li>${mission.difficulty}</li>
    </ul>
    <p class="site-section-title">Conditions de victoire</p>
    <ul class="missions-win-list">${winHtml}</ul>
    <p class="missions-buildings">
      Bâtiments notables : ${mission.buildings.join(', ')}
    </p>
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
      <p class="mission-profile-modes-hint">Utilisez les flèches du clavier pour changer d’option.</p>
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

  updateStartButtonState();
}

function selectMission(id) {
  selectedMissionId = id;
  const mission = getMissionById(id);

  listEl?.querySelectorAll('.missions-list-item').forEach((item) => {
    item.classList.toggle('is-selected', item.dataset.id === id);
  });

  renderDetail(mission);
}

function initList() {
  if (!listEl) return;

  listEl.innerHTML = MISSIONS.map((mission) => `
    <li
      class="missions-list-item${mission.id === selectedMissionId ? ' is-selected' : ''}"
      data-id="${mission.id}"
      role="button"
      tabindex="0"
    >${mission.name}</li>
  `).join('');

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

function startMission() {
  const profileName = getActiveProfileName();
  if (!profileName) return;

  if (profileMode === 'new') {
    addProfile(profileName);
  }

  setBootMode('mission');
  setMissionId(selectedMissionId);
  setProfileName(profileName);
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

initList();
selectMission(selectedMissionId);
