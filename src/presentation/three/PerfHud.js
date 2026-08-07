/**
 * Overlay perf net — format colonnes (comme stats.js multi-panels).
 * FPS | MS | MB | draw-calls (jaune)
 * Collapsible: expanded panel OR discrete FAB icon (like cookie consent).
 */

const STORAGE_KEY = 'show-stats-js';

function activityIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>`;
}

function closeIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 6-12 12"/><path d="m6 6 12 12"/></svg>`;
}

export function createPerfHud({
  widthRatio = 0.28,
  minWidth = 320,
  maxWidth = 520,
  bottom = 96,
  right = 16,
} = {}) {
  const root = document.createElement('div');
  root.id = 'stats-js';
  root.className = 'perf-hud';
  Object.assign(root.style, {
    position: 'fixed',
    top: 'auto',
    left: 'auto',
    right: `${right}px`,
    bottom: `${bottom}px`,
    zIndex: '99999',
    pointerEvents: 'auto',
  });

  const panel = document.createElement('div');
  panel.className = 'perf-hud__panel';

  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'perf-hud__collapse';
  collapseBtn.title = 'Réduire les stats';
  collapseBtn.setAttribute('aria-label', 'Réduire les stats de performance');
  collapseBtn.innerHTML = closeIconSvg();

  const canvas = document.createElement('canvas');
  canvas.className = 'perf-hud-canvas';
  panel.appendChild(collapseBtn);
  panel.appendChild(canvas);

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'perf-hud__fab';
  fab.title = 'Stats de performance';
  fab.setAttribute('aria-label', 'Afficher les stats de performance');
  fab.innerHTML = activityIconSvg();

  root.appendChild(panel);
  root.appendChild(fab);

  const ctx = canvas.getContext('2d');
  let displayW = 0;
  let displayH = 0;
  let dpr = 1;
  let expanded = localStorage.getItem(STORAGE_KEY) !== 'false';

  let frameCount = 0;
  let fps = 0;
  let fpsMin = Infinity;
  let fpsMax = 0;
  let ms = 0;
  let msMin = Infinity;
  let msMax = 0;
  let mb = 0;
  let mbMin = Infinity;
  let mbMax = 0;
  let calls = 0;
  let callsMin = Infinity;
  let callsMax = 0;
  let beginAt = 0;
  let fpsWindowStart = performance.now();

  const HISTORY = 48;
  const historyFps = new Float32Array(HISTORY);
  const historyMs = new Float32Array(HISTORY);
  const historyMb = new Float32Array(HISTORY);
  const historyCalls = new Float32Array(HISTORY);
  let historyIndex = 0;
  const memorySupported = performance.memory != null;

  function applyExpandedState() {
    root.classList.toggle('perf-hud--expanded', expanded);
    root.classList.toggle('perf-hud--collapsed', !expanded);
    panel.hidden = !expanded;
    fab.hidden = expanded;
    localStorage.setItem(STORAGE_KEY, expanded ? 'true' : 'false');
    if (expanded) {
      resize();
    }
  }

  function setExpanded(next) {
    expanded = Boolean(next);
    applyExpandedState();
    return expanded;
  }

  function toggle() {
    return setExpanded(!expanded);
  }

  function resize() {
    if (!expanded) return;
    displayW = Math.round(
      Math.min(maxWidth, Math.max(minWidth, window.innerWidth * widthRatio))
    );
    // Ratio proche des panneaux stats.js (80×48) × 4 colonnes
    displayH = Math.round(displayW * (48 / (80 * 4)));
    displayH = Math.max(56, displayH);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(displayW * dpr);
    canvas.height = Math.round(displayH * dpr);
    canvas.style.setProperty('width', `${displayW}px`, 'important');
    canvas.style.setProperty('height', `${displayH}px`, 'important');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }

  function paint() {
    if (!expanded) return;
    const w = displayW;
    const h = displayH;
    if (!w || !h) return;

    const cols = 4;
    const colW = w / cols;
    const pad = 4;
    const fontSize = Math.max(10, Math.round(colW / 9));
    const graphTop = fontSize + 8;
    const graphH = Math.max(12, h - graphTop - 4);

    const columns = [
      {
        label: 'FPS',
        value: fps,
        min: fpsMin === Infinity ? 0 : fpsMin,
        max: fpsMax,
        history: historyFps,
        fg: '#00ffff',
        bg: '#002222',
        ceiling: 100,
      },
      {
        label: 'MS',
        value: ms,
        min: msMin === Infinity ? 0 : msMin,
        max: msMax,
        history: historyMs,
        fg: '#00ff00',
        bg: '#002200',
        ceiling: 50,
      },
      {
        label: 'MB',
        value: mb,
        min: mbMin === Infinity ? 0 : mbMin,
        max: mbMax,
        history: historyMb,
        fg: '#f080a0',
        bg: '#201010',
        ceiling: Math.max(128, mbMax * 1.2, 64),
        disabled: !memorySupported,
      },
      {
        // Jaune — draw calls Three.js (renderer.info.render.calls)
        label: 'calls',
        value: calls,
        min: callsMin === Infinity ? 0 : callsMin,
        max: callsMax,
        history: historyCalls,
        fg: '#ffcc00',
        bg: '#221100',
        ceiling: Math.max(100, callsMax * 1.2, 50),
      },
    ];

    columns.forEach((col, i) => {
      const x = i * colW;
      ctx.fillStyle = col.bg;
      ctx.fillRect(x, 0, colW, h);

      ctx.fillStyle = col.fg;
      ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
      ctx.textBaseline = 'top';
      const text = col.disabled
        ? `${col.label} n/a`
        : `${Math.round(col.value)} ${col.label} (${Math.round(col.min)}-${Math.round(col.max)})`;
      ctx.fillText(text, x + pad, 3, colW - pad * 2);

      if (col.disabled) return;

      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + pad, graphTop, colW - pad * 2, graphH);
      ctx.globalAlpha = 1;

      ctx.fillStyle = col.fg;
      const n = col.history.length;
      const barW = (colW - pad * 2) / n;
      for (let j = 0; j < n; j++) {
        const sample = col.history[(historyIndex + j) % n];
        const ratio = Math.min(1, sample / col.ceiling);
        const barH = Math.max(1, ratio * graphH);
        ctx.fillRect(
          x + pad + j * barW,
          graphTop + graphH - barH,
          Math.max(1, barW - 0.4),
          barH
        );
      }
    });
  }

  function begin() {
    beginAt = performance.now();
  }

  /**
   * @param {{ drawCalls?: number }} [frameInfo]
   */
  function end(frameInfo = {}) {
    const now = performance.now();
    ms = now - beginAt;
    msMin = Math.min(msMin, ms);
    msMax = Math.max(msMax, ms);

    if (typeof frameInfo.drawCalls === 'number') {
      calls = frameInfo.drawCalls;
      callsMin = Math.min(callsMin, calls);
      callsMax = Math.max(callsMax, calls);
    }

    if (memorySupported) {
      mb = performance.memory.usedJSHeapSize / 1048576;
      mbMin = Math.min(mbMin, mb);
      mbMax = Math.max(mbMax, mb);
    }

    frameCount += 1;
    const pushHistory = now >= fpsWindowStart + 1000;

    if (pushHistory) {
      fps = (frameCount * 1000) / (now - fpsWindowStart);
      fpsMin = Math.min(fpsMin, fps);
      fpsMax = Math.max(fpsMax, fps);

      historyFps[historyIndex] = fps;
      historyMs[historyIndex] = ms;
      historyMb[historyIndex] = mb;
      historyCalls[historyIndex] = calls;
      historyIndex = (historyIndex + 1) % HISTORY;

      frameCount = 0;
      fpsWindowStart = now;
      paint();
    } else if (frameCount % 6 === 0) {
      historyMs[historyIndex] = ms;
      historyCalls[historyIndex] = calls;
      paint();
    }
  }

  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setExpanded(false);
  });
  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    setExpanded(true);
  });

  applyExpandedState();
  resize();
  window.addEventListener('resize', resize);

  return {
    dom: root,
    begin,
    end,
    setExpanded,
    toggle,
    get expanded() {
      return expanded;
    },
    dispose() {
      window.removeEventListener('resize', resize);
      root.remove();
    },
  };
}
