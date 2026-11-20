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
  const controlGroups = {
    basic: [
      { title: 'Light', fields: [
        ['exposure', 'Exposure', -100, 100], ['contrast', 'Contrast', -100, 100],
        ['brightness', 'Brightness', -100, 100], ['highlights', 'Highlights', -100, 100],
        ['shadows', 'Shadows', -100, 100], ['whites', 'Whites', -100, 100], ['blacks', 'Blacks', -100, 100],
      ] },
      { title: 'Color', fields: [
        ['temperature', 'Temperature', -100, 100, '°', { gradient: 'temperature' }],
        ['tint', 'Tint', -100, 100, '', { gradient: 'tint' }],
        ['saturation', 'Saturation', -100, 100, '', { gradient: 'saturation' }],
        ['hue', 'Color / Hue', -180, 180],
      ] },
      { title: 'Presence / Detail', fields: [
        ['texture', 'Texture', -100, 100], ['clarity', 'Clarity', -100, 100],
      ] },
    ],
    effects: [
      { title: 'Vignette', fields: [
        ['vignette', 'Amount', -100, 100], ['vignetteMidpoint', 'Midpoint', 0, 100],
        ['vignetteRoundness', 'Roundness', -100, 100], ['vignetteFeather', 'Feather', 1, 100],
      ] },
    ],
  };
  const emptyWheels = () => Object.fromEntries(['shadows', 'midtones', 'highlights'].map(key => [key, { hue: 0, amount: 0, luminance: 0 }]));
  const freshState = () => ({
    temperature: 0, tint: 0, hue: 0, contrast: 0, brightness: 0, exposure: 0,
    highlights: 0, shadows: 0, whites: 0, blacks: 0, texture: 0, clarity: 0,
    saturation: 0, vignette: 0, vignetteMidpoint: 45, vignetteRoundness: 0, vignetteFeather: 70,
    curves: Object.fromEntries(['master', 'red', 'green', 'blue'].map(key => [key, [{ x: 0, y: 0 }, { x: 1, y: 1 }]])),
    hsl: Object.fromEntries(bands.map(({ key }) => [key, { h: 0, s: 0, l: 0 }])),
    wheels: emptyWheels(),
  });

  let state = freshState();
  let imageId = '';
  let currentFileName = '';
  let currentOutputExtension = 'png';
  let previewUrl = '';
  let originalUrl = '';
  let debounceTimer = 0;
  let previewController = null;
  let renderNumber = 0;
  let toastTimer = 0;
  let isComparing = false;
  let curveDragIndex = -1;
  let selectedCurveChannel = 'master';
  let selectedHslBand = 'red';

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
    const position = ((value - min) / (max - min)) * 100;
    const zero = min < 0 && max > 0 ? ((-min) / (max - min)) * 100 : 0;
    range.style.setProperty('--zero', `${zero}%`);
    range.style.setProperty('--fill-start', `${Math.min(position, zero)}%`);
    range.style.setProperty('--fill-end', `${Math.max(position, zero)}%`);
    range.style.setProperty('--fill', `${position}%`);
  }
  function makeControl(path, label, min, max, suffix = '', options = {}) {
    const row = document.createElement('label');
    row.className = options.compact ? 'control-row control-row-compact' : 'control-row';
    const title = document.createElement('span'); title.className = 'control-label'; title.textContent = label;
    const range = document.createElement('input');
    range.className = `range${options.gradient ? ` gradient-${options.gradient}` : ''}`;
    range.type = 'range'; range.min = min; range.max = max; range.step = 1; range.dataset.setting = path;
    if (options.color) range.style.setProperty('--hsl-color', options.color);
    range.value = path.split('.').reduce((obj, key) => obj[key], state);
    range.setAttribute('aria-label', label);
    const output = document.createElement('output'); output.className = 'control-value'; output.textContent = formatValue(range.value, suffix);
    range.addEventListener('input', () => {
      setPath(path, Number(range.value)); output.textContent = formatValue(range.value, suffix);
      updateRangeFill(range);
      if (path === 'vignette') updateVignetteControls();
      queuePreview();
    });
    row.append(title, range, output); updateRangeFill(range);
    return row;
  }
  function buildControls() {
    const basicRoot = $('#basic-controls'); basicRoot.replaceChildren();
    const effectsRoot = $('#effect-controls'); effectsRoot.replaceChildren();
    appendAccordions(basicRoot, controlGroups.basic, ['Light']);
    appendAccordions(effectsRoot, controlGroups.effects, ['Vignette']);
    updateVignetteControls(); buildHslControls(); buildWheels(); updateCurve();
  }
  function appendAccordions(root, groups, openGroups = []) {
    for (const group of groups) {
      const details = document.createElement('details'); details.className = 'setting-accordion';
      details.open = openGroups.includes(group.title);
      const summary = document.createElement('summary'); summary.textContent = group.title;
      const body = document.createElement('div'); body.className = 'accordion-body control-list';
      for (const [path, label, min, max, suffix = '', options = {}] of group.fields) {
        body.append(makeControl(path, label, min, max, suffix, options));
      }
      details.append(summary, body); root.append(details);
    }
  }
  function updateVignetteControls() {
    const disabled = Number(state.vignette) === 0;
    $$('#effect-controls input[data-setting^="vignette"]')
      .filter(input => input.dataset.setting !== 'vignette')
      .forEach(input => { input.disabled = disabled; input.closest('.control-row').classList.toggle('is-disabled', disabled); });
  }
  function buildHslControls() {
    const swatches = $('#hsl-swatches'); swatches.replaceChildren();
    for (const band of bands) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'hsl-swatch';
      button.style.setProperty('--swatch-color', band.color); button.classList.toggle('is-selected', band.key === selectedHslBand);
      button.setAttribute('aria-label', band.label); button.setAttribute('aria-pressed', String(band.key === selectedHslBand)); button.title = band.label;
      button.addEventListener('click', () => { selectedHslBand = band.key; buildHslControls(); });
      swatches.append(button);
    }
    const band = bands.find(item => item.key === selectedHslBand) || bands[0];
    const selected = $('#hsl-selected'); selected.replaceChildren();
    const chip = document.createElement('i'); chip.className = 'color-chip'; chip.style.background = band.color;
    const label = document.createElement('strong'); label.textContent = band.label;
    const hint = document.createElement('span'); hint.textContent = 'HUE / SATURATION / LUMINANCE';
    selected.append(chip, label, hint);
    const controls = $('#hsl-controls'); controls.replaceChildren();
    controls.append(
      makeControl(`hsl.${band.key}.h`, 'Hue', -100, 100, '', { gradient: 'hsl-hue', color: band.color }),
      makeControl(`hsl.${band.key}.s`, 'Saturation', -100, 100, '', { gradient: 'hsl-saturation', color: band.color }),
      makeControl(`hsl.${band.key}.l`, 'Luminance', -100, 100, '', { gradient: 'hsl-luminance', color: band.color }),
    );
  }
  function buildWheels() {
    const root = $('#wheel-controls'); root.replaceChildren();
    for (const [key, label] of [['shadows', 'SHADOWS'], ['midtones', 'MIDTONES'], ['highlights', 'HIGHLIGHTS']]) {
      const card = document.createElement('div'); card.className = 'wheel-card';
      const caption = document.createElement('span'); caption.className = 'wheel-tonal'; caption.textContent = label;
      const wheel = document.createElement('div'); wheel.className = 'color-wheel'; wheel.dataset.wheel = key; wheel.setAttribute('role', 'slider'); wheel.setAttribute('aria-label', `${label} color wheel`); wheel.setAttribute('tabindex', '0');
      const marker = document.createElement('span'); marker.className = 'wheel-marker'; wheel.append(marker);
      const adjustments = document.createElement('div'); adjustments.className = 'wheel-adjustments';
      adjustments.append(makeControl(`wheels.${key}.luminance`, 'Luma', -50, 50, '', { compact: true, gradient: 'wheel-luminance' }));
      card.append(caption, wheel, adjustments); root.append(card);
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
    const points = state.curves[selectedCurveChannel];
    const coords = points.map(point => `${20 + point.x * 240},${260 - point.y * 240}`);
    $('#curve-line').setAttribute('points', coords.join(' '));
    const group = $('#curve-points'); group.replaceChildren();
    points.forEach((value, index) => {
      const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      point.setAttribute('cx', String(20 + value.x * 240)); point.setAttribute('cy', String(260 - value.y * 240));
      point.setAttribute('r', index === 0 || index === points.length - 1 ? '4' : '5');
      point.setAttribute('class', `curve-point${index === 0 || index === points.length - 1 ? ' is-endpoint' : ''}`);
      point.setAttribute('tabindex', index === 0 || index === points.length - 1 ? '-1' : '0');
      point.setAttribute('role', 'slider'); point.setAttribute('aria-label', `${selectedCurveChannel} curve point ${index + 1}`);
      point.setAttribute('aria-valuemin', '0'); point.setAttribute('aria-valuemax', '100'); point.setAttribute('aria-valuenow', String(Math.round(value.y * 100)));
      point.dataset.index = String(index); group.append(point);
    });
    $('#panel-curves').dataset.channel = selectedCurveChannel;
    $$('.channel-button').forEach(button => {
      const active = button.dataset.channel === selectedCurveChannel;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
  }
  function curveCoordinates(event) {
    const svg = $('#curve-editor'); const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }
  function curvePointer(event) {
    const local = curveCoordinates(event); const points = state.curves[selectedCurveChannel];
    const previous = points[curveDragIndex - 1]; const next = points[curveDragIndex + 1];
    const minX = previous.x + .01; const maxX = next.x - .01;
    if (maxX >= minX) points[curveDragIndex].x = Math.max(minX, Math.min(maxX, (local.x - 20) / 240));
    points[curveDragIndex].y = Math.max(0, Math.min(1, (260 - local.y) / 240));
    updateCurve(); queuePreview();
  }
  const curveSvg = $('#curve-editor');
  curveSvg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const local = curveCoordinates(event); const points = state.curves[selectedCurveChannel];
    let closest = -1; let distance = 12;
    points.forEach((point, index) => {
      const d = Math.hypot(local.x - (20 + point.x * 240), local.y - (260 - point.y * 240));
      if (d < distance) { distance = d; closest = index; }
    });
    if (closest >= 0) {
      if (closest === 0 || closest === points.length - 1) return;
      curveDragIndex = closest;
    } else {
      if (points.length >= 10) return showToast('Kurva sudah mencapai batas 10 titik.');
      const x = Math.max(.01, Math.min(.99, (local.x - 20) / 240));
      if (points.some(point => Math.abs(point.x - x) < .025)) return;
      points.push({ x, y: Math.max(0, Math.min(1, (260 - local.y) / 240)) });
      points.sort((a, b) => a.x - b.x); curveDragIndex = points.findIndex(point => point.x === x);
    }
    curveSvg.setPointerCapture(event.pointerId); curvePointer(event);
  });
  curveSvg.addEventListener('pointermove', event => { if (curveDragIndex > 0) curvePointer(event); });
  const endCurveDrag = () => { curveDragIndex = -1; };
  curveSvg.addEventListener('pointerup', endCurveDrag); curveSvg.addEventListener('pointercancel', endCurveDrag);
  function removeCurvePoint(event) {
    const dot = event.target.closest('.curve-point'); if (!dot) return;
    const index = Number(dot.dataset.index); const points = state.curves[selectedCurveChannel];
    if (index <= 0 || index >= points.length - 1) return;
    event.preventDefault(); points.splice(index, 1); updateCurve(); queuePreview();
  }
  curveSvg.addEventListener('dblclick', removeCurvePoint);
  curveSvg.addEventListener('contextmenu', removeCurvePoint);
  curveSvg.addEventListener('keydown', event => {
    const dot = event.target.closest('.curve-point'); if (!dot) return;
    const index = Number(dot.dataset.index); const points = state.curves[selectedCurveChannel];
    if ((event.key === 'Backspace' || event.key === 'Delete') && index > 0 && index < points.length - 1) {
      event.preventDefault(); points.splice(index, 1); updateCurve(); queuePreview(); return;
    }
    const amount = event.shiftKey ? .05 : .01; let delta = 0;
    if (event.key === 'ArrowUp') delta = amount;
    if (event.key === 'ArrowDown') delta = -amount;
    if (delta) { event.preventDefault(); points[index].y = Math.max(0, Math.min(1, points[index].y + delta)); updateCurve(); queuePreview(); }
  });
  $('#curve-channels').addEventListener('click', event => {
    const button = event.target.closest('.channel-button'); if (!button) return;
    selectedCurveChannel = button.dataset.channel; updateCurve();
  });
  function updateHistogram(values) {
    if (!values?.length) return;
    const maximum = Math.max(1, ...values);
    const line = values.map((value, index) => `${20 + index / Math.max(1, values.length - 1) * 240},${260 - value / maximum * 230}`);
    $('#histogram-area').setAttribute('points', [`20,260`, ...line, `260,260`].join(' '));
  }

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
      const histogram = response.headers.get('X-Histogram');
      const url = URL.createObjectURL(await response.blob());
      if (version !== renderNumber || activeId !== imageId || isComparing) { URL.revokeObjectURL(url); return; }
      if (histogram) updateHistogram(histogram.split(',').map(Number));
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
    const histogram = response.headers.get('X-Histogram');
    const url = URL.createObjectURL(await response.blob());
    if (activeId !== imageId) { URL.revokeObjectURL(url); return; }
    if (histogram) updateHistogram(histogram.split(',').map(Number));
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
      currentOutputExtension = result.outputExtension || 'png';
      selectedCurveChannel = 'master'; selectedHslBand = 'red';
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
    const activeId = imageId;
    exportButton.disabled = true; setStatus('Ekspor ukuran penuh…', true);
    try {
      const response = await fetch('/api/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: activeId, settings: state }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Ekspor gagal.');
      const extension = response.headers.get('X-Output-Extension') || currentOutputExtension;
      const blob = await response.blob(); const href = URL.createObjectURL(blob); const link = document.createElement('a');
      const stem = (currentFileName.replace(/\.[^.]+$/, '') || 'foto').replace(/[\\/:*?"<>|]/g, '-');
      link.href = href; link.download = `${stem}-nidi.${extension}`; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(href);
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
  $('#reset-curve').addEventListener('click', () => { state.curves[selectedCurveChannel] = [{ x: 0, y: 0 }, { x: 1, y: 1 }]; updateCurve(); queuePreview(); });
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
