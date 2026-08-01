/**
 * DOM helpers for the building info overlay (.info-building__body).
 */

export function makeInfoBuildingText(textContent, isHTMLReset = true, customClass = null) {
  const infoObjectContent = document.querySelector('.info-building__body');

  if (!infoObjectContent) {
    console.warn('there is no info objects content wrapper div with class info-building__body');
    return false;
  }

  if (isHTMLReset) {
    infoObjectContent.innerHTML = '';
  }
  const buildingText = document.createElement('p');
  buildingText.classList.add('anoria-text');
  buildingText.classList.add('info-building-item');
  if (customClass) {
    buildingText.classList.add(customClass);
  }
  buildingText.textContent = textContent;
  infoObjectContent.appendChild(buildingText);
}

/**
 * @param {string} label
 * @param {string|number} value
 * @param {string} [subtext]
 */
export function makeInfoKeyValue(label, value, subtext = null) {
  const infoObjectContent = document.querySelector('.info-building__body');
  if (!infoObjectContent) return false;
  const row = document.createElement('div');
  row.className = 'kv-row';
  const k = document.createElement('div');
  k.className = 'kv-key';
  k.textContent = label;
  const v = document.createElement('div');
  v.className = 'kv-value';
  v.textContent = value !== undefined && value !== null ? String(value) : '';

  if (subtext) {
    const sub = document.createElement('div');
    sub.className = 'kv-subtext';
    sub.textContent = subtext;
    sub.style.cssText =
      'color: #888; font-size: 11px; font-style: italic; font-weight: 400; margin-top: 2px;';
    v.appendChild(sub);
  }

  row.appendChild(k);
  row.appendChild(v);
  infoObjectContent.appendChild(row);
}

/** @param {string} title */
export function makeInfoSection(title) {
  const infoObjectContent = document.querySelector('.info-building__body');
  if (!infoObjectContent) return false;
  const h = document.createElement('h3');
  h.className = 'info-section-title';
  h.textContent = title;
  infoObjectContent.appendChild(h);
}
