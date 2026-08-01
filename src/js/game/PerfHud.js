/**
 * Overlay perf net — format colonnes (comme stats.js multi-panels).
 * FPS | MS | MB | draw-calls (jaune)
 */
export function createPerfHud({
  widthRatio = 0.28,
  minWidth = 320,
  maxWidth = 520,
  bottom = 96,
  right = 16,
} = {}) {
  const root = document.createElement('div');
  root.id = 'stats-js';
  Object.assign(root.style, {
    position: 'fixed',
    top: 'auto',
    left: 'auto',
    right: `${right}px`,
    bottom: `${bottom}px`,
    zIndex: '99999',
    opacity: '0.95',
    cursor: 'default',
    pointerEvents: 'auto',
  });

  const canvas = document.createElement('canvas');
  canvas.className = 'perf-hud-canvas';
  root.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let displayW = 0;
  let displayH = 0;
  let dpr = 1;

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

  function resize() {
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

  resize();
  window.addEventListener('resize', resize);

  return {
    dom: root,
    begin,
    end,
    dispose() {
      window.removeEventListener('resize', resize);
      root.remove();
    },
  };
}
