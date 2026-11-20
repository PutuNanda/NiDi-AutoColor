(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const bands = [
    { key: 'red', label: 'Merah', color: '#e65c58' }, { key: 'orange', label: 'Oranye', color: '#e99a4b' },
    { key: 'yellow', label: 'Kuning', color: '#e8d55f' }, { key: 'green', label: 'Hijau', color: '#8dbb68' },
    { key: 'aqua', label: 'Aqua', color: '#60c9b3' }, { key: 'blue', label: 'Biru', color: '#608fe2' },
    { key: 'purple', label: 'Ungu', color: '#a47edc' }, { key: 'magenta', label: 'Magenta', color: '#d56ea7' },
  ];
  const controlDefinitions = {
    basic: [
      ['temperature', 'Warna / suhu', -100, 100], ['tint', 'Tint', -100, 100],
      ['contrast', 'Kontras', -100, 100], ['brightness', 'Kecerahan', -100, 100],
      ['exposure', 'Exposure', -100, 100], ['highlights', 'Highlights', -100, 100],
      ['shadows', 'Shadows', -100, 100], ['whites', 'White', -100, 100], ['blacks', 'Black', -100, 100],
      ['saturation', 'Saturation', -100, 100], ['hue', 'Warna / hue', -180, 180],
    ],
    effects: [
      ['texture', 'Texture', -100, 100], ['clarity', 'Clarity', -100, 100], ['vignette', 'Vignette', -100, 100],
      ['vignetteMidpoint', 'Titik tengah', 0, 100], ['vignetteFeather', 'Feather', 1, 100],
    ],
  };
  const emptyWheels = () => Object.fromEntries(['shadows', 'midtones', 'highlights'].map(key => [key, { hue: 0, amount: 0, luminance: 0 }]));
  const freshState = () => ({
    temperature: 0, tint: 0, hue: 0, contrast: 0, brightness: 0, exposure: 0,
    highlights: 0, shadows: 0, whites: 0, blacks: 0, texture: 0, clarity: 0,
    saturation: 0, vignette: 0, vignetteMidpoint: 45, vignetteFeather: 70,
    curve: [0, .25, .5, .75, 1],
    hsl: Object.fromEntries(bands.map(({ key }) => [key, { h: 0, s: 0, l: 0 }])),
    wheels: emptyWheels(),
  });

  let state = freshState();
  let imageId = '';
  let currentFileName = '';
  let previewUrl = '';
  let originalUrl = '';
  let debounceTimer = 0;
  let previewController = null;
  let renderNumber = 0;
  let toastTimer = 0;
  let isComparing = false;
  let curveDragIndex = -1;

  const fileInput = $('#file-input');
  const importButton = $('#import-button');
  const exportButton = $('#export-button');
  const compareButton = $('#compare-button');
  const preview = $('#photo-preview');
  const previewLoading = $('#preview-loading');
  const emptyState = $('#empty-state');
  const dropZone = $('#drop-zone');
  const dropOverlay = $('#drop-overlay');
  const status = $('#render-status');
  const toast = $('#toast');

  function setPath(path, value) {
    const keys = path.split('.');
    let target = state;
    while (keys.length > 1) target = target[keys.shift()];
    target[keys[0]] = value;
  }
  function formatValue(value, suffix = '') {
    const number = Number(value);
    const text = number > 0 ? `+${number}` : `${number}`;
    return `${text}${suffix}`;
  }
  function updateRangeFill(range) {
    const min = Number(range.min); const max = Number(range.max); const value = Number(range.value);
    range.style.setProperty('--fill', `${((value - min) / (max - min)) * 100}%`);
  }
  function makeControl(path, label, min, max, suffix = '') {
    const row = document.createElement('label');
    row.className = 'control-row';
    const title = document.createElement('span'); title.className = 'control-label'; title.textContent = label;
    const range = document.createElement('input');
    range.className = 'range'; range.type = 'range'; range.min = min; range.max = max; range.step = 1;
    range.value = path.split('.').reduce((obj, key) => obj[key], state);
    range.setAttribute('aria-label', label);
    const output = document.createElement('output'); output.className = 'control-value'; output.textContent = formatValue(range.value, suffix);
    range.addEventListener('input', () => {
      setPath(path, Number(range.value)); output.textContent = formatValue(range.value, suffix);
      updateRangeFill(range); queuePreview();
    });
    row.append(title, range, output); updateRangeFill(range);
    return row;
  }
  function buildControls() {
    for (const [key, definitions] of Object.entries(controlDefinitions)) {
      const targetId = key === 'effects' ? 'effect-controls' : `${key}-controls`;
      const target = $(`#${targetId}`); target.replaceChildren();
      for (const [name, label, min, max] of definitions) target.append(makeControl(name, label, min, max, name === 'temperature' ? '°' : ''));
    }
    const hslRoot = $('#hsl-controls'); hslRoot.replaceChildren();
    for (const band of bands) {
      const details = document.createElement('details'); details.className = 'hsl-band';
      const summary = document.createElement('summary');
      const chip = document.createElement('i'); chip.className = 'color-chip'; chip.style.background = band.color; chip.style.color = band.color;
      const name = document.createElement('span'); name.textContent = band.label;
      summary.append(chip, name); details.append(summary);
      const sliders = document.createElement('div'); sliders.className = 'hsl-sliders';
      sliders.append(makeControl(`hsl.${band.key}.h`, 'Hue', -100, 100), makeControl(`hsl.${band.key}.s`, 'Saturation', -100, 100), makeControl(`hsl.${band.key}.l`, 'Luminance', -100, 100));
      details.append(sliders); hslRoot.append(details);
    }
    buildWheels(); updateCurve();
  }
  function buildWheels() {
    const root = $('#wheel-controls'); root.replaceChildren();
    for (const [key, label] of [['shadows', 'SHADOWS'], ['midtones', 'MIDTONES'], ['highlights', 'HIGHLIGHTS']]) {
      const card = document.createElement('div'); card.className = 'wheel-card';
      const visual = document.createElement('div'); visual.className = 'wheel-visual';
      const wheel = document.createElement('div'); wheel.className = 'color-wheel'; wheel.dataset.wheel = key; wheel.setAttribute('role', 'slider'); wheel.setAttribute('aria-label', `${label} color wheel`); wheel.setAttribute('tabindex', '0');
      const marker = document.createElement('span'); marker.className = 'wheel-marker'; wheel.append(marker);
      const caption = document.createElement('span'); caption.className = 'wheel-tonal'; caption.textContent = label; visual.append(wheel, caption);
      const adjustments = document.createElement('div'); adjustments.className = 'wheel-adjustments';
      adjustments.append(makeControl(`wheels.${key}.luminance`, 'Luminance', -50, 50));
      card.append(visual, adjustments); root.append(card);
      wheel.addEventListener('pointerdown', wheelPointerDown);
      wheel.addEventListener('keydown', event => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault(); const current = state.wheels[key];
        if (event.key === 'ArrowUp') current.amount = Math.min(1, current.amount + .04);
        if (event.key === 'ArrowDown') current.amount = Math.max(0, current.amount - .04);
        if (event.key === 'ArrowRight') current.hue = (current.hue + 4) % 360;
        if (event.key === 'ArrowLeft') current.hue = (current.hue + 356) % 360;
        updateWheelMarker(wheel); queuePreview();
      });
      updateWheelMarker(wheel);
    }
  }
  function updateWheelMarker(wheel) {
    const { hue, amount } = state.wheels[wheel.dataset.wheel];
    const angle = hue * Math.PI / 180;
    const x = 50 + Math.sin(angle) * amount * 43;
    const y = 50 - Math.cos(angle) * amount * 43;
    wheel.style.setProperty('--wheel-x', `${x}%`); wheel.style.setProperty('--wheel-y', `${y}%`);
    wheel.setAttribute('aria-valuetext', `Hue ${Math.round(hue)} derajat, kekuatan ${Math.round(amount * 100)} persen`);
  }
  function wheelPointerDown(event) {
    const wheel = event.currentTarget; const key = wheel.dataset.wheel;
    const rect = wheel.getBoundingClientRect(); const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2 - 5;
    const update = pointer => {
      const dx = pointer.clientX - cx; const dy = pointer.clientY - cy;
      const distance = Math.min(radius, Math.hypot(dx, dy));
      const hue = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      state.wheels[key].hue = hue; state.wheels[key].amount = distance / radius;
      updateWheelMarker(wheel); queuePreview();
    };
    update(event); wheel.setPointerCapture(event.pointerId);
    const move = pointer => update(pointer);
    const end = () => { wheel.removeEventListener('pointermove', move); wheel.removeEventListener('pointerup', end); wheel.removeEventListener('pointercancel', end); };
    wheel.addEventListener('pointermove', move); wheel.addEventListener('pointerup', end); wheel.addEventListener('pointercancel', end);
  }

  function updateCurve() {
    const points = state.curve.map((value, index) => `${20 + index * 60},${200 - value * 180}`);
    $('#curve-line').setAttribute('points', points.join(' '));
    const group = $('#curve-points'); group.replaceChildren();
    state.curve.slice(1, 4).forEach((value, innerIndex) => {
      const index = innerIndex + 1; const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      point.setAttribute('cx', String(20 + index * 60)); point.setAttribute('cy', String(200 - value * 180));
      point.setAttribute('r', '5'); point.setAttribute('class', 'curve-point'); point.setAttribute('tabindex', '0');
      point.setAttribute('role', 'slider'); point.setAttribute('aria-label', `Kurva tonal titik ${index}`);
      point.setAttribute('aria-valuemin', '0'); point.setAttribute('aria-valuemax', '100'); point.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      point.dataset.index = String(index); group.append(point);
    });
  }
  function curvePointer(event) {
    const svg = $('#curve-editor'); const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM().inverse());
    const value = Math.max(0, Math.min(1, (200 - local.y) / 180));
    state.curve[curveDragIndex] = value; updateCurve(); queuePreview();
  }
  $('#curve-editor').addEventListener('pointerdown', event => {
    const dot = event.target.closest('.curve-point'); if (!dot) return;
    curveDragIndex = Number(dot.dataset.index); $('#curve-editor').setPointerCapture(event.pointerId); curvePointer(event);
  });
  $('#curve-editor').addEventListener('pointermove', event => { if (curveDragIndex >= 0) curvePointer(event); });
  const endCurveDrag = () => { curveDragIndex = -1; };
  $('#curve-editor').addEventListener('pointerup', endCurveDrag); $('#curve-editor').addEventListener('pointercancel', endCurveDrag);
  $('#curve-editor').addEventListener('keydown', event => {
    const dot = event.target.closest('.curve-point'); if (!dot) return;
    const amount = event.shiftKey ? .05 : .01; let delta = 0;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') delta = amount;
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') delta = -amount;
    if (delta) { event.preventDefault(); const index = Number(dot.dataset.index); state.curve[index] = Math.max(0, Math.min(1, state.curve[index] + delta)); updateCurve(); queuePreview(); }
  });

  function setStatus(message, working = false) { status.textContent = message; status.classList.toggle('is-working', working); }
  function showToast(message) {
    toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000);
  }
  function setPreviewUrl(url) {
    const previous = previewUrl; previewUrl = url; preview.src = url;
    if (previous && previous !== url) URL.revokeObjectURL(previous);
  }
  function queuePreview(delay = 130) {
    if (!imageId || isComparing) return;
    clearTimeout(debounceTimer); debounceTimer = setTimeout(renderPreview, delay);
  }
  async function renderPreview() {
    if (!imageId || isComparing) return;
    clearTimeout(debounceTimer);
    if (previewController) previewController.abort();
    previewController = new AbortController();
    const controller = previewController; const activeId = imageId; const version = ++renderNumber;
    setStatus('Merender di server…', true);
    try {
      const response = await fetch('/api/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ imageId: activeId, settings: state }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Pratinjau gagal dibuat.');
      const url = URL.createObjectURL(await response.blob());
      if (version !== renderNumber || activeId !== imageId || isComparing) { URL.revokeObjectURL(url); return; }
      setPreviewUrl(url); preview.hidden = false; previewLoading.hidden = true; setStatus('Pratinjau diperbarui');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setStatus('Gagal merender');
      if (!previewUrl) { previewLoading.querySelector('strong').textContent = 'Pratinjau gagal dibuat. Coba impor ulang foto.'; previewLoading.hidden = false; }
      showToast(error.message);
    }
  }
  async function loadOriginalPreview(activeId) {
    const response = await fetch('/api/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId: activeId, original: true }),
    });
    if (!response.ok) throw new Error('Pratinjau asli tidak dapat dimuat.');
    const url = URL.createObjectURL(await response.blob());
    if (activeId !== imageId) { URL.revokeObjectURL(url); return; }
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = url;
    if (isComparing) { preview.src = originalUrl; preview.hidden = false; previewLoading.hidden = true; }
  }
  async function importFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return showToast('Pilih file gambar untuk diimpor.');
    if (file.size > 35 * 1024 * 1024) return showToast('Ukuran foto maksimal 35 MB.');
    importButton.disabled = true; setStatus('Mengirim foto ke server…', true);
    try {
      const response = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: file,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Foto gagal diunggah.');
      if (previewController) previewController.abort(); clearTimeout(debounceTimer);
      if (previewUrl) URL.revokeObjectURL(previewUrl); if (originalUrl) URL.revokeObjectURL(originalUrl);
      previewUrl = ''; originalUrl = ''; imageId = result.imageId; currentFileName = file.name; state = freshState(); isComparing = false;
      $('#photo-name').textContent = file.name; $('#photo-dimensions').textContent = `${result.width.toLocaleString('id-ID')} × ${result.height.toLocaleString('id-ID')}`;
      emptyState.hidden = true; preview.hidden = true; previewLoading.querySelector('strong').textContent = 'Memproses foto di server…'; previewLoading.hidden = false;
      exportButton.disabled = false; compareButton.disabled = false; $('#reset-button').disabled = false;
      buildControls(); setStatus('Foto tersimpan di server');
      void loadOriginalPreview(imageId).catch(error => showToast(error.message));
      queuePreview(0);
    } catch (error) { setStatus('Impor gagal'); showToast(error.message); }
    finally { importButton.disabled = false; fileInput.value = ''; }
  }
  async function exportImage() {
    if (!imageId) return;
    const activeId = imageId; const format = $('#export-format').value;
    exportButton.disabled = true; setStatus('Ekspor ukuran penuh…', true);
    try {
      const response = await fetch('/api/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: activeId, settings: state, format }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Ekspor gagal.');
      const blob = await response.blob(); const href = URL.createObjectURL(blob); const link = document.createElement('a');
      const stem = (currentFileName.replace(/\.[^.]+$/, '') || 'foto').replace(/[\\/:*?"<>|]/g, '-');
      link.href = href; link.download = `${stem}-nidi.${format === 'jpeg' ? 'jpg' : 'png'}`; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(href);
      setStatus('Ekspor selesai'); showToast('Foto hasil edit berhasil diekspor.');
    } catch (error) { setStatus('Ekspor gagal'); showToast(error.message); }
    finally { exportButton.disabled = false; }
  }
  function resetEdits() { state = freshState(); buildControls(); queuePreview(0); }
  function toggleCompare(active) {
    if (!imageId || isComparing === active) return;
    isComparing = active; compareButton.classList.toggle('is-active', active);
    if (active) {
      clearTimeout(debounceTimer); if (previewController) previewController.abort();
      if (originalUrl) { preview.src = originalUrl; preview.hidden = false; previewLoading.hidden = true; setStatus('Foto asli'); }
      else { setStatus('Memuat foto asli…', true); void loadOriginalPreview(imageId).catch(error => showToast(error.message)); }
    } else { setStatus('Memulihkan pratinjau…', true); queuePreview(0); }
  }

  importButton.addEventListener('click', () => fileInput.click());
  $('#empty-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => importFile(fileInput.files[0]));
  exportButton.addEventListener('click', exportImage);
  $('#reset-button').addEventListener('click', resetEdits);
  $('#reset-curve').addEventListener('click', () => { state.curve = [0, .25, .5, .75, 1]; updateCurve(); queuePreview(); });
  compareButton.addEventListener('pointerdown', event => { event.preventDefault(); toggleCompare(true); });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) compareButton.addEventListener(type, () => toggleCompare(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') toggleCompare(false); });
  $$('.tab-button').forEach(button => button.addEventListener('click', () => {
    $$('.tab-button').forEach(tab => { const selected = tab === button; tab.classList.toggle('is-active', selected); tab.setAttribute('aria-selected', String(selected)); });
    $$('.tab-panel').forEach(panel => { const active = panel.id === `panel-${button.dataset.tab}`; panel.classList.toggle('is-active', active); panel.hidden = !active; });
  }));
  for (const type of ['dragenter', 'dragover']) dropZone.addEventListener(type, event => { event.preventDefault(); dropOverlay.hidden = false; dropZone.classList.add('is-dragging'); });
  for (const type of ['dragleave', 'drop']) dropZone.addEventListener(type, event => { event.preventDefault(); dropOverlay.hidden = true; dropZone.classList.remove('is-dragging'); });
  dropZone.addEventListener('drop', event => importFile(event.dataTransfer.files[0]));
  document.addEventListener('dragover', event => event.preventDefault());
  document.addEventListener('drop', event => event.preventDefault());
  window.addEventListener('beforeunload', () => { if (previewUrl) URL.revokeObjectURL(previewUrl); if (originalUrl) URL.revokeObjectURL(originalUrl); });

  buildControls();
})();
