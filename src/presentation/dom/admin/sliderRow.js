/**
 * One labelled slider. A move shows the value; the release stores it.
 * @param {{ label: string, scope: string, min: number, max: number, value: number, unit: string, ariaLabel: string, store: (value: number) => Promise<unknown>, active?: boolean, dataset?: Record<string, string> }} options
 */
export function createSliderRow({ label, scope, min, max, value, unit, ariaLabel, store, active = true, dataset = {} }) {
  const row = document.createElement('div');
  row.className = `taxes-row${active ? '' : ' taxes-row--future'}`;
  Object.assign(row.dataset, dataset);

  const head = document.createElement('div');
  head.className = 'taxes-row-head';
  const labelSpan = document.createElement('span');
  labelSpan.className = 'taxes-row-label';
  labelSpan.textContent = label;
  const scopeSpan = document.createElement('span');
  scopeSpan.className = 'taxes-row-scope';
  scopeSpan.textContent = scope;
  head.append(labelSpan, scopeSpan);

  const controls = document.createElement('div');
  controls.className = 'commerce-customs-controls';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'commerce-customs-slider';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = '1';
  slider.value = String(value);
  slider.disabled = !active;
  slider.setAttribute('aria-label', ariaLabel);
  const valueSpan = document.createElement('span');
  valueSpan.className = 'commerce-customs-value';
  valueSpan.textContent = `${value} ${unit}`;

  slider.addEventListener('input', () => {
    valueSpan.textContent = `${slider.value} ${unit}`;
  });
  slider.addEventListener('change', () => {
    void store(Number(slider.value));
  });

  controls.append(slider, valueSpan);
  row.append(head, controls);
  return row;
}
