(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const MIN_DELETE_AFTER = 1;
  const MAX_DELETE_AFTER = 10080;
  let initialized = false;
  let templates = [];
  let savedNames = new Set();
  let savedDeleteAfterMinutes = 60;

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request gagal (${response.status}).`);
    return body;
  }

  function setStatus(message, isError = false) {
    const status = $('#automatic-template-status');
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function selectedNames() {
    return [...$('#automatic-template-list').querySelectorAll('input[type="checkbox"]:checked')]
      .map(input => input.value);
  }

  function isDeleteAfterValid() {
    const value = Number($('#automatic-delete-after').value);
    return Number.isInteger(value) && value >= MIN_DELETE_AFTER && value <= MAX_DELETE_AFTER;
  }

  function hasUnsavedChanges() {
    const names = selectedNames();
    const selectionChanged = names.length !== savedNames.size || names.some(name => !savedNames.has(name));
    return selectionChanged || Number($('#automatic-delete-after').value) !== savedDeleteAfterMinutes;
  }

  function syncActions() {
    const validDuration = isDeleteAfterValid();
    const changed = hasUnsavedChanges();
    $('#automatic-save-templates').disabled = !validDuration || !changed;
    if (!validDuration) setStatus(`Masukkan waktu antara ${MIN_DELETE_AFTER} dan ${MAX_DELETE_AFTER} menit.`, true);
    else if (changed) setStatus('Ada perubahan pengaturan yang belum disimpan.');
    else if (!savedNames.size) setStatus('Belum ada template yang dipilih. Buat template di Template Library.');
    else setStatus(`${savedNames.size} template tersimpan · Delete After ${savedDeleteAfterMinutes} menit.`);
  }

  function renderTemplates() {
    const list = $('#automatic-template-list');
    list.replaceChildren();
    if (!templates.length) {
      const empty = document.createElement('div');
      empty.className = 'automatic-template-empty';
      empty.append('Belum ada template. Buat template di ');
      const link = document.createElement('button');
      link.type = 'button'; link.className = 'text-button'; link.dataset.appView = 'templates'; link.textContent = 'Template Library';
      empty.append(link, '.');
      list.append(empty);
      syncActions();
      return;
    }
    for (const template of templates) {
      const label = document.createElement('label');
      label.className = 'automatic-template-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.value = template.name;
      checkbox.checked = savedNames.has(template.name);
      const name = document.createElement('span'); name.textContent = template.name;
      label.append(checkbox, name);
      list.append(label);
    }
    syncActions();
  }

  async function loadSettings() {
    setStatus('Memuat template dan pengaturan...');
    try {
      const [library, settings] = await Promise.all([
        requestJson('/api/templates'),
        requestJson('/api/automatic-processing/templates'),
      ]);
      templates = library.templates || [];
      savedNames = new Set((settings.selectedTemplates || []).map(template => template.name));
      savedDeleteAfterMinutes = Number(settings.deleteAfterMinutes) || 60;
      $('#automatic-delete-after').value = String(savedDeleteAfterMinutes);
      renderTemplates();
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function saveSettings() {
    if (!isDeleteAfterValid()) { syncActions(); return; }
    const button = $('#automatic-save-templates');
    button.disabled = true;
    setStatus('Menyimpan pengaturan...');
    try {
      const result = await requestJson('/api/automatic-processing/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateNames: selectedNames(),
          deleteAfterMinutes: Number($('#automatic-delete-after').value),
        }),
      });
      savedNames = new Set((result.selectedTemplates || []).map(template => template.name));
      savedDeleteAfterMinutes = Number(result.deleteAfterMinutes) || 60;
      $('#automatic-delete-after').value = String(savedDeleteAfterMinutes);
      syncActions();
    } catch (error) {
      setStatus(error.message, true);
      button.disabled = false;
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    $('#automatic-template-list').addEventListener('change', event => {
      if (event.target.matches('input[type="checkbox"]') && selectedNames().length > 20) {
        event.target.checked = false;
        setStatus('Maksimal 20 template dapat dipilih.', true);
        return;
      }
      syncActions();
    });
    $('#automatic-template-list').addEventListener('click', event => {
      const button = event.target.closest('[data-app-view]');
      if (button) window.NiDiNavigation?.show(button.dataset.appView);
    });
    $('#automatic-delete-after').addEventListener('input', syncActions);
    $('#automatic-save-templates').addEventListener('click', () => void saveSettings());
    window.addEventListener('nidi:automatic-processing:show', () => void loadSettings());
    void loadSettings();
  }

  window.NiDiAutomaticProcessing = { init };
})();
