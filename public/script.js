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
        ['temperature', 'Temperature (°)', -100, 100, '', { gradient: 'temperature' }],
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
  let photoWidth = 0;
  let photoHeight = 0;
  let zoomLevel = 1;
  let panX = 0;
  let panY = 0;
  let panStart = null;
  let controlIdCounter = 0;
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
  const zoomIndicator = $('#zoom-indicator');
  const status = $('#render-status');
  const toast = $('#toast');
  const wheelEditorLayer = $('#wheel-editor-layer');
  const wheelEditorWindow = $('#wheel-editor-window');
  const wheelEditorDragHandle = $('#wheel-editor-drag-handle');
  const wheelEditorClose = $('#wheel-editor-close');
  const expandedColorWheel = $('#expanded-color-wheel');
  let wheelEditorOpener = null;

  function setPath(path, value) {
    const keys = path.split('.');
    let target = state;
    while (keys.length > 1) target = target[keys.shift()];
    target[keys[0]] = value;
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
    const row = document.createElement('div');
    row.className = options.compact ? 'control-row control-row-compact' : 'control-row';
    const id = `control-${++controlIdCounter}`;
    const title = document.createElement('label'); title.className = 'control-label'; title.textContent = label; title.htmlFor = id;
    const range = document.createElement('input');
    range.className = `range${options.gradient ? ` gradient-${options.gradient}` : ''}`;
    range.id = id; range.type = 'range'; range.min = min; range.max = max; range.step = .01; range.dataset.setting = path;
    if (options.color) range.style.setProperty('--hsl-color', options.color);
    const readPath = source => path.split('.').reduce((obj, key) => obj[key], source);
    const defaultValue = Number(readPath(freshState()));
    range.value = Number(readPath(state));
    range.setAttribute('aria-label', label);
    const valueWrap = document.createElement('div'); valueWrap.className = 'control-value-wrap';
    const valueInput = document.createElement('input'); valueInput.className = 'control-value'; valueInput.type = 'number';
    valueInput.min = min; valueInput.max = max; valueInput.step = .01; valueInput.value = range.value;
    valueInput.setAttribute('aria-label', `${label}${suffix ? ` (${suffix})` : ''} numeric value`);
    valueInput.title = suffix ? `Satuan: ${suffix}` : 'Ketik nilai edit dengan presisi';
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'control-reset';
    reset.textContent = '↺'; reset.title = `Reset ${label}`; reset.setAttribute('aria-label', `Reset ${label}`); reset.hidden = true;
    const syncValue = value => {
      const clean = Number(Number(value).toFixed(2));
      setPath(path, clean); range.value = clean; valueInput.value = clean;
      updateRangeFill(range);
      const modified = Math.abs(clean - defaultValue) > .0001;
      row.classList.toggle('is-modified', modified); reset.hidden = !modified;
    };
    const commitManualValue = () => {
      const typed = valueInput.value.trim();
      if (!typed || !Number.isFinite(Number(typed))) { valueInput.value = range.value; return; }
      syncValue(Math.max(Number(min), Math.min(Number(max), Number(typed))));
      if (path === 'vignette') updateVignetteControls();
      queuePreview();
    };
    range.addEventListener('input', () => {
      syncValue(Number(range.value));
      if (path === 'vignette') updateVignetteControls();
      queuePreview();
    });
    valueInput.addEventListener('change', commitManualValue);
    valueInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commitManualValue(); valueInput.blur(); } });
    reset.addEventListener('click', () => {
      syncValue(defaultValue);
      if (path === 'vignette') updateVignetteControls();
      queuePreview();
    });
    valueWrap.append(valueInput, reset);
    row.append(title, range, valueWrap); updateRangeFill(range);
    const modified = Math.abs(Number(range.value) - defaultValue) > .0001;
    row.classList.toggle('is-modified', modified); reset.hidden = !modified;
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
      .forEach(input => {
        const row = input.closest('.control-row');
        row.querySelectorAll('input, button').forEach(control => { control.disabled = disabled; });
        row.classList.toggle('is-disabled', disabled);
      });
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
      const card = document.createElement('div'); card.className = 'wheel-card'; card.dataset.wheelCard = key;
      const header = document.createElement('div'); header.className = 'wheel-card-header';
      const caption = document.createElement('span'); caption.className = 'wheel-tonal'; caption.textContent = label;
      const actions = document.createElement('div'); actions.className = 'wheel-card-actions';
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'wheel-card-action wheel-reset'; reset.textContent = '\u21ba';
      reset.title = `Reset color wheel ${label}`; reset.setAttribute('aria-label', `Reset color wheel ${label}`);
      reset.addEventListener('click', () => resetWheel(key));
      const expand = document.createElement('button'); expand.type = 'button'; expand.className = 'wheel-card-action wheel-expand'; expand.textContent = '\u2922';
      expand.title = `Perbesar color wheel ${label}`; expand.setAttribute('aria-label', `Perbesar color wheel ${label}`);
      expand.addEventListener('click', () => openWheelEditor(key, label, expand));
      actions.append(reset, expand); header.append(caption, actions);
      const wheel = document.createElement('div'); wheel.className = 'color-wheel'; wheel.dataset.wheel = key; wheel.setAttribute('role', 'slider'); wheel.setAttribute('aria-label', `${label} color wheel`); wheel.setAttribute('tabindex', '0');
      const marker = document.createElement('span'); marker.className = 'wheel-marker'; wheel.append(marker);
      const adjustments = document.createElement('div'); adjustments.className = 'wheel-adjustments';
      adjustments.append(makeControl(`wheels.${key}.luminance`, 'Luma', -50, 50, '', { compact: true, gradient: 'wheel-luminance' }));
      card.append(header, wheel, adjustments); root.append(card);
      wheel.addEventListener('pointerdown', wheelPointerDown);
      wheel.addEventListener('keydown', wheelKeyDown);
      updateWheelMarker(wheel);
    }
    if (!wheelEditorLayer.hidden && expandedColorWheel.dataset.wheel) updateWheelMarker(expandedColorWheel);
  }
  function updateWheelCardActions(key) {
    const wheel = state.wheels[key];
    const reset = $(`[data-wheel-card="${key}"] .wheel-reset`);
    if (reset) reset.disabled = Math.abs(wheel.hue) < .0001 && Math.abs(wheel.amount) < .0001;
  }
  function updateWheelMarker(wheel) {
    const { hue, amount } = state.wheels[wheel.dataset.wheel];
    const angle = hue * Math.PI / 180;
    const x = 50 + Math.sin(angle) * amount * 43;
    const y = 50 - Math.cos(angle) * amount * 43;
    wheel.style.setProperty('--wheel-x', `${x}%`); wheel.style.setProperty('--wheel-y', `${y}%`);
    wheel.setAttribute('aria-valuetext', `Hue ${Math.round(hue)} derajat, kekuatan ${Math.round(amount * 100)} persen`);
    updateWheelCardActions(wheel.dataset.wheel);
  }
  function updateWheelMarkers(key) {
    $$('.color-wheel').filter(wheel => wheel.dataset.wheel === key).forEach(updateWheelMarker);
  }
  function wheelKeyDown(event) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); const key = event.currentTarget.dataset.wheel; const current = state.wheels[key];
    if (event.key === 'ArrowUp') current.amount = Math.min(1, current.amount + .04);
    if (event.key === 'ArrowDown') current.amount = Math.max(0, current.amount - .04);
    if (event.key === 'ArrowRight') current.hue = (current.hue + 4) % 360;
    if (event.key === 'ArrowLeft') current.hue = (current.hue + 356) % 360;
    updateWheelMarkers(key); queuePreview();
  }
  function resetWheel(key) {
    state.wheels[key].hue = 0; state.wheels[key].amount = 0;
    updateWheelMarkers(key); queuePreview();
  }
  function openWheelEditor(key, label, opener) {
    wheelEditorOpener = opener;
    $('#wheel-editor-title').textContent = `${label} color wheel`;
    expandedColorWheel.dataset.wheel = key;
    expandedColorWheel.setAttribute('aria-label', `${label} color wheel yang diperbesar`);
    wheelEditorLayer.hidden = false;
    const rect = wheelEditorWindow.getBoundingClientRect();
    wheelEditorWindow.style.left = `${Math.max(8, (window.innerWidth - rect.width) / 2)}px`;
    wheelEditorWindow.style.top = `${Math.max(8, (window.innerHeight - rect.height) / 2)}px`;
    updateWheelMarker(expandedColorWheel);
    wheelEditorClose.focus();
  }
  function closeWheelEditor(restoreFocus = true) {
    if (wheelEditorLayer.hidden) return;
    wheelEditorLayer.hidden = true;
    if (restoreFocus && wheelEditorOpener?.isConnected) wheelEditorOpener.focus();
    wheelEditorOpener = null;
  }
  function startWheelEditorDrag(event) {
    if (event.button !== 0 || event.target.closest('button')) return;
    event.preventDefault();
    const rect = wheelEditorWindow.getBoundingClientRect();
    const offsetX = event.clientX - rect.left; const offsetY = event.clientY - rect.top;
    wheelEditorDragHandle.setPointerCapture(event.pointerId);
    const move = pointer => {
      const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
      const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
      wheelEditorWindow.style.left = `${Math.max(8, Math.min(maxLeft, pointer.clientX - offsetX))}px`;
      wheelEditorWindow.style.top = `${Math.max(8, Math.min(maxTop, pointer.clientY - offsetY))}px`;
    };
    const end = () => {
      wheelEditorDragHandle.removeEventListener('pointermove', move);
      wheelEditorDragHandle.removeEventListener('pointerup', end);
      wheelEditorDragHandle.removeEventListener('pointercancel', end);
    };
    wheelEditorDragHandle.addEventListener('pointermove', move);
    wheelEditorDragHandle.addEventListener('pointerup', end);
    wheelEditorDragHandle.addEventListener('pointercancel', end);
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
      updateWheelMarkers(key); queuePreview();
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
  function fitCanvasToViewport() {
    if (!imageId || !photoWidth || !photoHeight) return;
    const oldWidth = dropZone.clientWidth;
    const oldHeight = dropZone.clientHeight;
    const workspace = $('.workspace');
    const style = getComputedStyle(workspace);
    const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const maxWidth = Math.max(120, workspace.clientWidth - horizontalPadding - 32);
    const toolbarHeight = $('.workspace-toolbar').getBoundingClientRect().height;
    const footerHeight = $('.workspace-footer').getBoundingClientRect().height;
    const availableHeight = workspace.clientHeight - toolbarHeight - footerHeight - verticalPadding;
    const maxHeight = Math.max(120, Math.min(availableHeight, window.innerHeight * .76));
    const ratio = photoWidth / photoHeight;
    let width = Math.min(maxWidth, maxHeight * ratio);
    let height = width / ratio;
    if (height > maxHeight) { height = maxHeight; width = height * ratio; }
    dropZone.classList.add('has-image');
    dropZone.style.width = `${Math.round(width)}px`;
    dropZone.style.height = `${Math.round(height)}px`;
    dropZone.style.aspectRatio = `${photoWidth} / ${photoHeight}`;
    if (oldWidth && oldHeight) { panX *= width / oldWidth; panY *= height / oldHeight; }
    updatePreviewTransform();
  }
  function setZoom(value, event) {
    const nextZoom = Math.max(.25, Math.min(5, value));
    if (event) {
      const rect = dropZone.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      const factor = nextZoom / zoomLevel;
      panX = x + (panX - x) * factor;
      panY = y + (panY - y) * factor;
    } else { panX = 0; panY = 0; }
    zoomLevel = nextZoom;
    updatePreviewTransform();
    zoomIndicator.querySelector('strong').textContent = `${Math.round(zoomLevel * 100)}%`;
  }
  function updatePreviewTransform() {
    preview.style.transformOrigin = '50% 50%';
    preview.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
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
      photoWidth = result.width; photoHeight = result.height; setZoom(1); fitCanvasToViewport(); zoomIndicator.hidden = false;
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
  wheelEditorClose.addEventListener('click', () => closeWheelEditor());
  expandedColorWheel.addEventListener('pointerdown', wheelPointerDown);
  expandedColorWheel.addEventListener('keydown', wheelKeyDown);
  wheelEditorDragHandle.addEventListener('pointerdown', startWheelEditorDrag);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeWheelEditor(); toggleCompare(false);
  });
  window.addEventListener('resize', () => {
    if (wheelEditorLayer.hidden) return;
    const rect = wheelEditorWindow.getBoundingClientRect();
    wheelEditorWindow.style.left = `${Math.max(8, Math.min(window.innerWidth - rect.width - 8, rect.left))}px`;
    wheelEditorWindow.style.top = `${Math.max(8, Math.min(window.innerHeight - rect.height - 8, rect.top))}px`;
  });
  $$('.tab-button').forEach(button => button.addEventListener('click', () => {
    $$('.tab-button').forEach(tab => { const selected = tab === button; tab.classList.toggle('is-active', selected); tab.setAttribute('aria-selected', String(selected)); });
    $$('.tab-panel').forEach(panel => { const active = panel.id === `panel-${button.dataset.tab}`; panel.classList.toggle('is-active', active); panel.hidden = !active; });
  }));
  for (const type of ['dragenter', 'dragover']) dropZone.addEventListener(type, event => { event.preventDefault(); dropOverlay.hidden = false; dropZone.classList.add('is-dragging'); });
  for (const type of ['dragleave', 'drop']) dropZone.addEventListener(type, event => { event.preventDefault(); dropOverlay.hidden = true; dropZone.classList.remove('is-dragging'); });
  dropZone.addEventListener('drop', event => importFile(event.dataTransfer.files[0]));
  dropZone.addEventListener('wheel', event => {
    if (!event.ctrlKey || !imageId) return;
    event.preventDefault();
    setZoom(zoomLevel * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event);
  }, { passive: false });
  preview.addEventListener('dragstart', event => event.preventDefault());
  dropZone.addEventListener('pointerdown', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!imageId || event.button !== 0 || target?.closest('#zoom-indicator, #drop-overlay, #preview-loading')) return;
    event.preventDefault();
    panStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX, panY };
    dropZone.classList.add('is-panning');
    dropZone.setPointerCapture(event.pointerId);
  });
  dropZone.addEventListener('pointermove', event => {
    if (!panStart || event.pointerId !== panStart.pointerId) return;
    const rect = dropZone.getBoundingClientRect();
    const maxX = Math.max(48, rect.width * (zoomLevel - 1) / 2);
    const maxY = Math.max(48, rect.height * (zoomLevel - 1) / 2);
    panX = Math.max(-maxX, Math.min(maxX, panStart.panX + event.clientX - panStart.x));
    panY = Math.max(-maxY, Math.min(maxY, panStart.panY + event.clientY - panStart.y));
    updatePreviewTransform();
  });
  const stopPanning = event => {
    if (panStart && (!event || event.pointerId === panStart.pointerId)) {
      panStart = null; dropZone.classList.remove('is-panning');
    }
  };
  dropZone.addEventListener('pointerup', stopPanning);
  dropZone.addEventListener('pointercancel', stopPanning);
  window.addEventListener('resize', fitCanvasToViewport);
  document.addEventListener('dragover', event => event.preventDefault());
  document.addEventListener('drop', event => event.preventDefault());
  window.addEventListener('beforeunload', () => { if (previewUrl) URL.revokeObjectURL(previewUrl); if (originalUrl) URL.revokeObjectURL(originalUrl); });

  buildControls();
})();
