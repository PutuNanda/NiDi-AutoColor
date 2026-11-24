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
    mask: { strokes: [], inverted: false, brushSize: 72 },
  });

  let state = freshState();
  let imageId = '';
  let currentFileName = '';
  let currentImageFile = null;
  let previewUrl = '';
  let originalPreviewUrl = '';
  let previewTimer = 0;
  let previewFrame = 0;
  let lastRenderStarted = 0;
  let isExporting = false;
  let previewQueued = false;
  let pendingTemplate = false;
  let importNumber = 0;
  let renderNumber = 0;
  const renderer = window.NiDiRender.create();
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
  let maskEditing = false;
  let maskErasing = false;
  let maskPointerId = -1;
  let sessionRestorePromise = null;
  let sessionRestoring = true;
  let sessionDbPromise = null;
  let sessionSaveQueued = false;
  let sessionWriteActive = false;
  let pendingSessionRecord = null;
  let pendingPhotoUpdate = null;
  let sessionSaveWarningShown = false;
  let sessionSaveNoticeShown = false;

  const fileInput = $('#file-input');
  const importButton = $('#import-button');
  const exportButton = $('#export-button');
  const exportFormat = $('#export-format');
  const compareButton = $('#compare-button');
  const preview = $('#photo-preview');
  const previewLoading = $('#preview-loading');
  const emptyState = $('#empty-state');
  const dropZone = $('#drop-zone');
  const maskOverlay = $('#mask-overlay');
  const maskContext = maskOverlay.getContext('2d');
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
  const SESSION_CACHE_DB = 'nidi-autocolor-editor-cache';
  const SESSION_CACHE_STORE = 'sessions';
  const SESSION_CACHE_KEY = 'active-state';
  const SESSION_CACHE_PHOTO_KEY = 'active-photo';
  const LEGACY_SESSION_CACHE_KEY = 'active-editor';
  const SESSION_CACHE_TTL = 24 * 60 * 60 * 1000;

  function openSessionCache() {
    if (sessionDbPromise) return sessionDbPromise;
    sessionDbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('Browser storage is unavailable.')); return; }
      const request = window.indexedDB.open(SESSION_CACHE_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SESSION_CACHE_STORE)) db.createObjectStore(SESSION_CACHE_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open browser storage.'));
    });
    return sessionDbPromise;
  }
  async function readSessionCache() {
    const db = await openSessionCache();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_CACHE_STORE, 'readonly');
      const store = transaction.objectStore(SESSION_CACHE_STORE);
      let stateRecord = null, photoRecord = null, legacyRecord = null;
      store.get(SESSION_CACHE_KEY).onsuccess = event => { stateRecord = event.target.result || null; };
      store.get(SESSION_CACHE_PHOTO_KEY).onsuccess = event => { photoRecord = event.target.result || null; };
      store.get(LEGACY_SESSION_CACHE_KEY).onsuccess = event => { legacyRecord = event.target.result || null; };
      transaction.oncomplete = () => {
        if (stateRecord) resolve({
          ...stateRecord,
          imageBlob: photoRecord?.imageBlob || null,
          fileName: photoRecord?.fileName || stateRecord.fileName || '',
        });
        else if (legacyRecord) resolve({ ...legacyRecord, legacy: true });
        else resolve(null);
      };
      transaction.onerror = () => reject(transaction.error || new Error('Could not read browser storage.'));
      transaction.onabort = () => reject(transaction.error || new Error('Browser storage read was interrupted.'));
    });
  }
  async function writeSessionCache(record, photoFile = null) {
    const db = await openSessionCache();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_CACHE_STORE, 'readwrite');
      const store = transaction.objectStore(SESSION_CACHE_STORE);
      store.put(record, SESSION_CACHE_KEY);
      if (photoFile) store.put({ imageBlob: photoFile, fileName: record.fileName }, SESSION_CACHE_PHOTO_KEY);
      else if (!record.hasImage) store.delete(SESSION_CACHE_PHOTO_KEY);
      store.delete(LEGACY_SESSION_CACHE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Could not save browser storage.'));
      transaction.onabort = () => reject(transaction.error || new Error('Browser storage save was interrupted.'));
    });
  }
  async function deleteSessionCache() {
    const db = await openSessionCache();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_CACHE_STORE, 'readwrite');
      const store = transaction.objectStore(SESSION_CACHE_STORE);
      store.delete(SESSION_CACHE_KEY); store.delete(SESSION_CACHE_PHOTO_KEY); store.delete(LEGACY_SESSION_CACHE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Could not clear browser storage.'));
    });
  }
  function buildSessionRecord() {
    return {
      updatedAt: Date.now(), expiresAt: Date.now() + SESSION_CACHE_TTL,
      fileName: currentFileName, hasImage: Boolean(currentImageFile),
      settings: structuredClone(state), outputFormat: exportFormat.value,
      pendingTemplate, zoomLevel, panX, panY,
    };
  }
  function scheduleSessionSave(photoFile = null) {
    if (!currentImageFile && !pendingTemplate) return;
    pendingSessionRecord = buildSessionRecord();
    if (photoFile) pendingPhotoUpdate = photoFile;
    if (sessionSaveQueued) return;
    sessionSaveQueued = true;
    queueMicrotask(() => {
      sessionSaveQueued = false;
      void drainSessionWrites();
    });
  }
  async function drainSessionWrites() {
    if (sessionWriteActive) return;
    sessionWriteActive = true;
    try {
      while (pendingSessionRecord) {
        const record = pendingSessionRecord, photo = pendingPhotoUpdate;
        pendingSessionRecord = null; pendingPhotoUpdate = null;
        await writeSessionCache(record, photo);
        if (!sessionSaveNoticeShown) {
          sessionSaveNoticeShown = true;
          showToast('Editing session saved in this browser for 24 hours.');
        }
      }
    } catch (error) {
      if (!sessionSaveWarningShown) {
        sessionSaveWarningShown = true;
        console.warn('Editing session could not be saved in browser storage:', error.message);
        showToast('This browser could not save your editing session.');
      }
    } finally {
      sessionWriteActive = false;
      if (pendingSessionRecord && !sessionSaveQueued) {
        sessionSaveQueued = true;
        queueMicrotask(() => { sessionSaveQueued = false; void drainSessionWrites(); });
      }
    }
  }
  function flushSessionSave() {
    scheduleSessionSave();
  }

  function currentMask() {
    if (!state.mask || typeof state.mask !== 'object') state.mask = { strokes: [], inverted: false, brushSize: 72 };
    if (!Array.isArray(state.mask.strokes)) state.mask.strokes = [];
    return state.mask;
  }
  function maskPointCount(mask = currentMask()) {
    return mask.strokes.reduce((total, stroke) => total + (Array.isArray(stroke.points) ? stroke.points.length : 0), 0);
  }
  function drawMaskOverlay() {
    const width = dropZone.clientWidth, height = dropZone.clientHeight;
    if (!width || !height) return;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.round(width * scale)), pixelHeight = Math.max(1, Math.round(height * scale));
    if (maskOverlay.width !== pixelWidth || maskOverlay.height !== pixelHeight) {
      maskOverlay.width = pixelWidth; maskOverlay.height = pixelHeight;
    }
    maskContext.setTransform(scale, 0, 0, scale, 0, 0);
    maskContext.clearRect(0, 0, width, height);
    const mask = currentMask();
    if (!mask.strokes.length || isComparing || !imageId) return;
    maskContext.save();
    maskContext.fillStyle = 'rgba(255, 48, 64, .32)';
    if (mask.inverted) maskContext.fillRect(0, 0, width, height);
    for (const stroke of mask.strokes) {
      if (!Array.isArray(stroke.points) || !stroke.points.length) continue;
      const cutOut = mask.inverted ? !stroke.erase : stroke.erase;
      maskContext.globalCompositeOperation = cutOut ? 'destination-out' : 'source-over';
      maskContext.strokeStyle = 'rgba(255, 48, 64, .32)';
      maskContext.fillStyle = 'rgba(255, 48, 64, .32)';
      maskContext.lineCap = 'round'; maskContext.lineJoin = 'round';
      maskContext.lineWidth = Math.max(1, Number(stroke.size) * width);
      const first = stroke.points[0];
      if (stroke.points.length === 1) {
        maskContext.beginPath(); maskContext.arc(first.x * width, first.y * height, maskContext.lineWidth / 2, 0, Math.PI * 2); maskContext.fill();
      } else {
        maskContext.beginPath(); maskContext.moveTo(first.x * width, first.y * height);
        for (let i = 1; i < stroke.points.length; i++) maskContext.lineTo(stroke.points[i].x * width, stroke.points[i].y * height);
        maskContext.stroke();
      }
    }
    maskContext.restore();
  }
  function updateMaskControls() {
    const mask = currentMask(), hasPhoto = Boolean(imageId), hasMask = mask.strokes.length > 0;
    const paint = $('#mask-paint-toggle'), eraser = $('#mask-eraser-toggle'), invert = $('#mask-invert-toggle');
    paint.disabled = !hasPhoto; eraser.disabled = !hasPhoto; invert.disabled = !hasMask;
    paint.classList.toggle('is-active', maskEditing && !maskErasing);
    eraser.classList.toggle('is-active', maskEditing && maskErasing);
    invert.classList.toggle('is-active', Boolean(mask.inverted));
    paint.setAttribute('aria-pressed', String(maskEditing && !maskErasing));
    eraser.setAttribute('aria-pressed', String(maskEditing && maskErasing));
    invert.setAttribute('aria-pressed', String(Boolean(mask.inverted)));
    $('#mask-brush-size').disabled = !hasPhoto;
    $('#mask-brush-size').value = String(mask.brushSize || 72);
    updateRangeFill($('#mask-brush-size'));
    $('#mask-brush-value').value = `${mask.brushSize || 72} px`;
    $('#mask-undo').disabled = !hasMask;
    $('#mask-clear').disabled = !hasMask;
    $('#mask-count').textContent = hasMask ? `${mask.strokes.length} STROKE${mask.strokes.length === 1 ? '' : 'S'}` : 'NO MASK';
    $('#mask-help').textContent = !hasPhoto ? 'Impor foto untuk membuat mask. Posisi kuas mengikuti proporsi foto.'
      : hasMask ? 'Area merah menerima penyesuaian. Balik mask untuk menerapkannya di luar area cat.'
        : 'Cat area terlebih dahulu. Tanpa mask, penyesuaian berlaku ke seluruh foto.';
    maskOverlay.hidden = !hasPhoto;
    dropZone.classList.toggle('is-mask-editing', maskEditing && hasPhoto && !isComparing);
    drawMaskOverlay();
  }
  function setMaskEditing(enabled, erase = false) {
    if (enabled && !imageId) { showToast('Impor foto terlebih dahulu untuk membuat mask.'); return; }
    maskEditing = enabled; maskErasing = enabled && erase;
    updateMaskControls();
  }
  function maskPoint(event) {
    const rect = maskOverlay.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height))),
    };
  }

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
    updateMaskControls();
  }
  function resetCanvasView() {
    if (!imageId) return;
    fitCanvasToViewport();
    setZoom(1);
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
    maskOverlay.style.transformOrigin = '50% 50%';
    maskOverlay.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    drawMaskOverlay();
    scheduleSessionSave();
  }
  function queuePreview() {
    scheduleSessionSave();
    if (!imageId || isComparing) return;
    if (isExporting) { previewQueued = true; return; }
    if (previewFrame || previewTimer) return;
    const wait = Math.max(0, 45 - (performance.now() - lastRenderStarted));
    if (wait) {
      previewTimer = setTimeout(() => { previewTimer = 0; schedulePreviewFrame(); }, wait);
      return;
    }
    schedulePreviewFrame();
  }
  function schedulePreviewFrame() {
    if (previewFrame || !imageId || isComparing || isExporting) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = 0;
      lastRenderStarted = performance.now();
      void renderPreview();
    });
  }
  async function renderPreview() {
    if (!imageId || isComparing || isExporting) return;
    const activeId = imageId;
    const version = ++renderNumber;
    setStatus('Merender di perangkat…', true);
    if (previewUrl) previewLoading.hidden = true;
    else {
      previewLoading.querySelector('strong').textContent = 'Menerapkan edit di perangkat…';
      previewLoading.hidden = false;
    }
    try {
      const result = await renderer.render(state, { maxDimension: 1600, typeHint: 'image/png' });
      if (!result || version !== renderNumber || activeId !== imageId || isComparing) return;
      updateHistogram(result.histogram);
      setPreviewUrl(URL.createObjectURL(result.blob));
      preview.hidden = false; previewLoading.hidden = true;
      setStatus('Pratinjau diperbarui');
    } catch (error) {
      if (version !== renderNumber || activeId !== imageId) return;
      setStatus('Gagal merender');
      if (!previewUrl) {
        previewLoading.querySelector('strong').textContent = 'Pratinjau gagal dibuat. Coba buka ulang foto.';
        previewLoading.hidden = false;
      }
      showToast(error.message);
    }
  }
  async function importFile(file) {
    if (!file) return;
    if (sessionRestoring && sessionRestorePromise) await sessionRestorePromise;
    if (!window.NiDiRender.supports(file)) return showToast('Pilih file foto atau gambar yang didukung.');
    const activeImport = ++importNumber;
    importButton.disabled = true; setStatus('Membuka foto di perangkat…', true);
    try {
      const result = await renderer.load(file);
      if (!result || activeImport !== importNumber) return;
      clearTimeout(previewTimer); previewTimer = 0;
      if (previewFrame) cancelAnimationFrame(previewFrame); previewFrame = 0;
      renderNumber++;
      if (previewUrl) URL.revokeObjectURL(previewUrl); if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
      previewUrl = ''; originalPreviewUrl = ''; imageId = `local-${activeImport}`; currentFileName = file.name;
      currentImageFile = file;
      state = pendingTemplate ? state : freshState(); pendingTemplate = false; isComparing = false;
      compareButton.classList.remove('is-active');
      photoWidth = result.width; photoHeight = result.height; setZoom(1); fitCanvasToViewport(); zoomIndicator.hidden = false;
      selectedCurveChannel = 'master'; selectedHslBand = 'red';
      $('#photo-name').textContent = file.name; $('#photo-dimensions').textContent = `${result.width.toLocaleString('id-ID')} × ${result.height.toLocaleString('id-ID')}`;
      emptyState.hidden = true; preview.removeAttribute('src'); preview.hidden = true;
      previewLoading.querySelector('strong').textContent = 'Menerapkan edit di perangkat…'; previewLoading.hidden = true;
      exportButton.disabled = false; compareButton.disabled = false; $('#reset-view-button').disabled = false; $('#reset-button').disabled = false;
      buildControls(); setStatus('Foto dibuka di perangkat');
      maskEditing = false; maskErasing = false; updateMaskControls();
      scheduleSessionSave(file);
      queuePreview(0);
    } catch (error) {
      if (activeImport === importNumber) { setStatus('Impor gagal'); showToast(error.message); }
    } finally {
      if (activeImport === importNumber) { importButton.disabled = false; fileInput.value = ''; }
    }
  }
  async function restoreEditingSession() {
    const emptyImportButton = $('#empty-import');
    importButton.disabled = true; emptyImportButton.disabled = true;
    setStatus('Checking for a saved editing session…', true);
    try {
      const record = await readSessionCache();
      if (!record) { setStatus('Siap mengedit'); return false; }
      if (!record.expiresAt || record.expiresAt <= Date.now()) {
        await deleteSessionCache();
        setStatus('Siap mengedit');
        return false;
      }
      state = cloneTemplateState(record.settings);
      pendingTemplate = Boolean(record.pendingTemplate);
      if (['png', 'jpg', 'jpeg'].includes(record.outputFormat)) exportFormat.value = record.outputFormat;
      if (record.imageBlob) {
        const name = String(record.fileName || 'restored-photo').slice(0, 200);
        const file = new File([record.imageBlob], name, { type: record.imageBlob.type || 'application/octet-stream' });
        const result = await renderer.load(file);
        currentImageFile = file; currentFileName = name; imageId = `local-restored-${Date.now()}`;
        photoWidth = result.width; photoHeight = result.height;
        emptyState.hidden = true; preview.removeAttribute('src'); preview.hidden = true;
        previewLoading.hidden = true; exportButton.disabled = false; compareButton.disabled = false;
        $('#reset-view-button').disabled = false; $('#reset-button').disabled = false;
        $('#photo-name').textContent = name;
        $('#photo-dimensions').textContent = `${result.width.toLocaleString('id-ID')} × ${result.height.toLocaleString('id-ID')}`;
        setZoom(1); fitCanvasToViewport();
        setZoom(Math.max(.25, Math.min(5, Number(record.zoomLevel) || 1)));
        const bounds = dropZone.getBoundingClientRect();
        panX = Number.isFinite(record.panX) ? record.panX : 0;
        panY = Number.isFinite(record.panY) ? record.panY : 0;
        panX = Math.max(-Math.max(48, bounds.width * (zoomLevel - 1) / 2), Math.min(Math.max(48, bounds.width * (zoomLevel - 1) / 2), panX));
        panY = Math.max(-Math.max(48, bounds.height * (zoomLevel - 1) / 2), Math.min(Math.max(48, bounds.height * (zoomLevel - 1) / 2), panY));
        updatePreviewTransform(); buildControls(); updateMaskControls();
        setStatus('Editing session restored');
        queuePreview();
        sessionSaveNoticeShown = true;
        showToast('Previous editing session restored.');
      } else if (pendingTemplate) {
        buildControls(); updateMaskControls();
        setStatus('Saved template settings restored. Import a photo to continue.');
        sessionSaveNoticeShown = true;
        showToast('Saved template settings restored.');
      } else {
        await deleteSessionCache();
        return false;
      }
      scheduleSessionSave(record.legacy ? currentImageFile : null);
      return true;
    } catch (error) {
      console.warn('Saved editing session could not be restored:', error.message);
      setStatus('Could not restore the saved editing session.', true);
      return false;
    } finally {
      sessionRestoring = false;
      importButton.disabled = false; emptyImportButton.disabled = false;
    }
  }
  async function exportImage() {
    if (!imageId) return;
    exportButton.disabled = true; isExporting = true; previewQueued = false;
    setStatus('Mengekspor ukuran penuh di perangkat…', true);
    try {
      const outputMime = exportFormat.value === 'png' ? 'image/png' : 'image/jpeg';
      const result = await renderer.render(structuredClone(state), {
        width: photoWidth, height: photoHeight, typeHint: outputMime,
      });
      if (!result) throw new Error('Ekspor dibatalkan. Coba lagi.');
      if (result.blob.type !== outputMime) throw new Error(`Browser tidak dapat mengekspor ${exportFormat.value.toUpperCase()}.`);
      const href = URL.createObjectURL(result.blob);
      if (!isComparing) {
        setPreviewUrl(href); preview.hidden = false; previewLoading.hidden = true;
        updateHistogram(result.histogram);
      }
      const link = document.createElement('a');
      const stem = (currentFileName.replace(/\.[^.]+$/, '') || 'foto').replace(/[\\/:*?"<>|]/g, '-');
      const extension = exportFormat.value;
      link.href = href; link.download = `${stem}-nidi.${extension}`; document.body.append(link); link.click(); link.remove();
      if (isComparing) setTimeout(() => URL.revokeObjectURL(href), 1000);
      setStatus('Ekspor selesai'); showToast(`Foto hasil edit berhasil diekspor sebagai ${extension.toUpperCase()}.`);
    } catch (error) { setStatus('Ekspor gagal'); showToast(error.message); }
    finally {
      isExporting = false; exportButton.disabled = false;
      if (previewQueued) { previewQueued = false; queuePreview(); }
    }
  }
  function resetEdits() { state = freshState(); pendingTemplate = false; maskEditing = false; maskErasing = false; buildControls(); updateMaskControls(); queuePreview(); }
  function openResetConfirm() {
    const modal = $('#reset-confirm-modal');
    modal.hidden = false;
    requestAnimationFrame(() => $('#reset-confirm-cancel').focus());
  }
  function closeResetConfirm() {
    $('#reset-confirm-modal').hidden = true;
    $('#reset-button').focus({ preventScroll: true });
  }
  function toggleCompare(active) {
    if (!imageId || isComparing === active) return;
    isComparing = active; compareButton.classList.toggle('is-active', active);
    updateMaskControls();
    if (active) {
      clearTimeout(previewTimer); previewTimer = 0;
      if (previewFrame) cancelAnimationFrame(previewFrame); previewFrame = 0;
      renderNumber++;
      if (originalPreviewUrl) {
        preview.src = originalPreviewUrl; preview.hidden = false; previewLoading.hidden = true; setStatus('Foto asli');
        return;
      }
      preview.hidden = true; previewLoading.hidden = false;
      previewLoading.querySelector('strong').textContent = 'Membuat pratinjau foto asli...';
      setStatus('Membuka foto asli di perangkat...', true);
      const activeId = imageId;
      void renderer.render(freshState(), { maxDimension: 1600, typeHint: 'image/png' }).then(result => {
        if (activeId !== imageId || !isComparing) return;
        if (!result) { toggleCompare(false); return; }
        originalPreviewUrl = URL.createObjectURL(result.blob);
        preview.src = originalPreviewUrl; preview.hidden = false; previewLoading.hidden = true;
        setStatus('Foto asli');
      }).catch(error => {
        if (activeId !== imageId || !isComparing) return;
        isComparing = false; compareButton.classList.remove('is-active');
        if (previewUrl) { preview.src = previewUrl; preview.hidden = false; previewLoading.hidden = true; }
        else {
          previewLoading.querySelector('strong').textContent = 'Pratinjau asli gagal dibuat';
          previewLoading.hidden = false;
        }
        setStatus('Pratinjau asli gagal');
        showToast(error.message);
      });
    } else { setStatus('Memulihkan pratinjau…', true); queuePreview(); }
  }

  importButton.addEventListener('click', () => fileInput.click());
  $('#empty-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => importFile(fileInput.files[0]));
  exportButton.addEventListener('click', exportImage);
  $('#reset-button').addEventListener('click', openResetConfirm);
  $('#reset-confirm-cancel').addEventListener('click', closeResetConfirm);
  $('#reset-confirm-accept').addEventListener('click', () => { closeResetConfirm(); resetEdits(); });
  $('#reset-confirm-modal').addEventListener('click', event => {
    if (event.target === event.currentTarget) closeResetConfirm();
  });
  exportFormat.addEventListener('change', scheduleSessionSave);
  $('#reset-view-button').addEventListener('click', resetCanvasView);
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
    if (!$('#reset-confirm-modal').hidden) closeResetConfirm();
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
    if (!imageId) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? dropZone.clientHeight : 1);
    setZoom(zoomLevel * Math.exp(-delta * .0015), event);
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
  maskOverlay.addEventListener('pointerdown', event => {
    if (!maskEditing || !imageId || isComparing || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const mask = currentMask();
    if (mask.strokes.length >= 400) { showToast('Mask dapat berisi maksimal 400 goresan.'); return; }
    if (maskPointCount(mask) >= 5000) { showToast('Mask dapat berisi maksimal 5.000 titik kuas.'); return; }
    const point = maskPoint(event);
    const width = Math.max(1, dropZone.clientWidth);
    mask.strokes.push({ erase: maskErasing, size: Math.max(1, Number(mask.brushSize) || 72) / width, points: [point] });
    maskPointerId = event.pointerId;
    maskOverlay.setPointerCapture(event.pointerId);
    updateMaskControls();
  });
  maskOverlay.addEventListener('pointermove', event => {
    if (maskPointerId !== event.pointerId) return;
    const points = currentMask().strokes.at(-1)?.points;
    if (!points?.length) return;
    const point = maskPoint(event), previous = points.at(-1), rect = maskOverlay.getBoundingClientRect();
    const dx = (point.x - previous.x) * rect.width, dy = (point.y - previous.y) * rect.height;
    if (dx * dx + dy * dy < 2.25) return;
    if (points.length < 512 && maskPointCount() < 5000) points.push(point);
    else points[points.length - 1] = point;
    drawMaskOverlay();
  });
  const finishMaskStroke = event => {
    if (maskPointerId !== event.pointerId) return;
    maskPointerId = -1;
    updateMaskControls();
    queuePreview();
  };
  maskOverlay.addEventListener('pointerup', finishMaskStroke);
  maskOverlay.addEventListener('pointercancel', finishMaskStroke);
  $('#mask-paint-toggle').addEventListener('click', () => setMaskEditing(!(maskEditing && !maskErasing), false));
  $('#mask-eraser-toggle').addEventListener('click', () => setMaskEditing(!(maskEditing && maskErasing), true));
  $('#mask-invert-toggle').addEventListener('click', () => {
    const mask = currentMask(); if (!mask.strokes.length) return;
    mask.inverted = !mask.inverted; updateMaskControls(); queuePreview();
  });
  $('#mask-brush-size').addEventListener('input', event => {
    const size = Number(event.currentTarget.value);
    currentMask().brushSize = size;
    $('#mask-brush-value').value = `${size} px`;
    scheduleSessionSave();
  });
  $('#mask-undo').addEventListener('click', () => {
    currentMask().strokes.pop();
    if (!currentMask().strokes.length) currentMask().inverted = false;
    updateMaskControls(); queuePreview();
  });
  $('#mask-clear').addEventListener('click', () => {
    currentMask().strokes = []; currentMask().inverted = false;
    updateMaskControls(); queuePreview();
  });
  window.addEventListener('resize', fitCanvasToViewport);
  document.addEventListener('dragover', event => event.preventDefault());
  document.addEventListener('drop', event => event.preventDefault());
  window.addEventListener('beforeunload', () => {
    flushSessionSave();
    renderer.destroy();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
  });

  function cloneTemplateState(settings) {
    const defaults = freshState();
    const source = settings && typeof settings === 'object' ? structuredClone(settings) : {};
    return {
      ...defaults,
      ...source,
      curves: { ...defaults.curves, ...(source.curves || {}) },
      hsl: Object.fromEntries(bands.map(({ key }) => [key, { ...defaults.hsl[key], ...(source.hsl?.[key] || {}) }])),
      wheels: Object.fromEntries(['shadows', 'midtones', 'highlights'].map(key => [key, { ...defaults.wheels[key], ...(source.wheels?.[key] || {}) }])),
      mask: {
        ...defaults.mask,
        ...(source.mask || {}),
        strokes: Array.isArray(source.mask?.strokes) ? source.mask.strokes : [],
      },
    };
  }

  window.NiDiEditor = {
    getSettings: () => structuredClone(state),
    getOutputFormat: () => exportFormat.value,
    applyTemplate: (settings, outputFormat, name) => {
      renderNumber++;
      isComparing = false;
      compareButton.classList.remove('is-active');
      state = cloneTemplateState(settings);
      maskEditing = false; maskErasing = false;
      pendingTemplate = !imageId;
      if (['png', 'jpg', 'jpeg'].includes(outputFormat)) exportFormat.value = outputFormat;
      buildControls();
      updateMaskControls();
      if (imageId) { setStatus(`Template applied: ${name}`); queuePreview(); }
      else setStatus(`Template loaded: ${name}. Import a photo to apply it.`);
      scheduleSessionSave();
      showToast(`Template “${name}” applied.`);
    },
  };

  buildControls();
  updateMaskControls();
  sessionRestorePromise = restoreEditingSession();
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSessionSave(); });
  window.addEventListener('pagehide', flushSessionSave);
})();
