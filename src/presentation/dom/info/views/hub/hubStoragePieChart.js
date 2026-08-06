/**
 * SVG pie chart for hub storage — real occupation of total capacity.
 */

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} startDeg
 * @param {number} endDeg
 */
function wedgePath(cx, cy, r, startDeg, endDeg) {
  const sweep = endDeg - startDeg;
  if (sweep <= 0.01) return '';
  if (sweep >= 359.99) {
    endDeg = startDeg + 359.99;
  }

  const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} midDeg
 */
function labelPoint(cx, cy, r, midDeg) {
  const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(toRad(midDeg)),
    y: cy + r * Math.sin(toRad(midDeg)),
  };
}

/**
 * @param {object} view
 */
export function renderHubStoragePieChart(view) {
  const segments = view.pieSegments ?? [];
  if (segments.length === 0) return '';

  const cx = 100;
  const cy = 100;
  const r = 88;
  const labelR = 58;

  const wedges = segments
    .flatMap((seg) => {
      const parts = [];
      let cursor = seg.startAngle;

      if (seg.kind === 'free') {
        const idle = seg.idleAngle ?? seg.segmentAngle ?? 0;
        if (idle > 0.01) {
          parts.push(
            `<path class="hub-pie-wedge hub-pie-wedge--free" d="${wedgePath(cx, cy, r, cursor, cursor + idle)}" fill="#eceff1" data-product="__free__" />`
          );
        }
        return parts;
      }

      if (seg.darkAngle > 0.01) {
        parts.push(
          `<path class="hub-pie-wedge hub-pie-wedge--dark" d="${wedgePath(cx, cy, r, cursor, cursor + seg.darkAngle)}" fill="${seg.colors.dark}" data-product="${seg.productId}" />`
        );
        cursor += seg.darkAngle;
      }

      const paleStart = seg.paleStartAngle ?? cursor;
      if (seg.paleAngle > 0.01) {
        parts.push(
          `<path class="hub-pie-wedge hub-pie-wedge--pale" d="${wedgePath(cx, cy, r, paleStart, paleStart + seg.paleAngle)}" fill="${seg.colors.pale}" data-product="${seg.productId}" />`
        );
      }

      return parts;
    })
    .join('');

  const labels = segments
    .filter((seg) => seg.kind !== 'free' && (seg.darkAngle > 12 || seg.segmentAngle > 18))
    .map((seg) => {
      const mid = seg.startAngle + Math.max(seg.darkAngle, seg.segmentAngle) / 2;
      const { x, y } = labelPoint(cx, cy, labelR, mid);
      return `
        <text class="hub-pie-label" x="${x}" y="${y - 4}" text-anchor="middle">${seg.emoji}</text>
        <text class="hub-pie-qty" x="${x}" y="${y + 10}" text-anchor="middle">${seg.amount}</text>
      `;
    })
    .join('');

  const legend = segments
    .filter((seg) => seg.kind !== 'free')
    .map((seg) => {
      const overClass = seg.overMax ? ' hub-pie-legend-item--over' : '';
      return `
        <div class="hub-pie-legend-item${overClass}" data-product="${seg.productId}">
          <span class="hub-pie-legend-swatch">
            <span class="hub-pie-legend-swatch-dark" style="background:${seg.colors.dark}"></span>
            <span class="hub-pie-legend-swatch-pale" style="background:${seg.colors.pale}"></span>
          </span>
          <span class="hub-pie-legend-emoji">${seg.emoji}</span>
          <span class="hub-pie-legend-text">${seg.label} — ${seg.amount} / ${seg.maxCap} <span class="hub-pie-legend-pct">(max ${seg.maxPercent} %)</span>${seg.remainingInbound > 0 ? ` · encore possible ${seg.remainingInbound}` : ''}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="hub-pie-chart">
      <svg class="hub-pie-svg" viewBox="0 0 200 200" role="img" aria-label="Occupation de l'entrepôt">
        <circle cx="${cx}" cy="${cy}" r="${r + 1}" fill="#fff" stroke="#dee2e6" stroke-width="1" />
        ${wedges}
        ${labels}
      </svg>
      <div class="hub-pie-legend">${legend}</div>
      <p class="hub-pie-caption">
        Foncé = stock actuel · gris = place libre (<strong>premier arrivé</strong> si plusieurs denrées
        peuvent la prendre — les plafonds % peuvent se chevaucher).
        Capacité : <strong class="hub-pie-capacity">${view.currentTotal} / ${view.totalCapacity}</strong>.
      </p>
    </div>
  `;
}

/**
 * Replace pie chart DOM in place (no full modal reload).
 *
 * @param {HTMLElement} root
 * @param {object} view
 */
export function patchHubStoragePieChart(root, view) {
  const section = root.querySelector('.hub-storage-chart-section');
  if (!section) return;
  const title = section.querySelector('.hub-storage-chart-title');
  const titleHtml = title ? title.outerHTML : `<h3 class="hub-storage-chart-title">Répartition de l'entrepôt</h3>`;
  section.innerHTML = `${titleHtml}${renderHubStoragePieChart(view)}`;
}
