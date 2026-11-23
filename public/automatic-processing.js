(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  let initialized = false;
  let templates = [];
  let savedNames = new Set();
  let selectedFiles = [];
  let pollingTimer = null;
  let isUploading = false;

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request gagal (${response.status}).`);
    return body;
  }

  function setStatus(selector, message, isError = false) {
    const target = $(selector);
    if (!target) return;
    target.textContent = message;
    target.classList.toggle('is-error', isError);
  }

  function selectedNames() {
    return [...$('#automatic-template-list').querySelectorAll('input[type="checkbox"]:checked')]
      .map(input => input.value);
  }

  function isSelectionSaved() {
    const current = selectedNames();
    return current.length === savedNames.size && current.every(name => savedNames.has(name));
  }

  function syncActions() {
    const hasChanged = !isSelectionSaved();
    const saveButton = $('#automatic-save-templates');
    const processButton = $('#automatic-process-button');
    saveButton.disabled = !hasChanged || isUploading;
    processButton.disabled = isUploading || !selectedFiles.length || !savedNames.size || hasChanged;
    $('#automatic-file-input').disabled = isUploading;
    $('#automatic-template-list').querySelectorAll('input[type="checkbox"]').forEach(input => { input.disabled = isUploading; });
    if (hasChanged) setStatus('#automatic-upload-status', 'Simpan pilihan template sebelum memulai pemrosesan.');
    else if (!savedNames.size) setStatus('#automatic-upload-status', 'Pilih dan simpan minimal satu template terlebih dahulu.');
    else if (!selectedFiles.length) setStatus('#automatic-upload-status', 'Pilih satu atau beberapa foto untuk diproses.');
  }

  function renderTemplates() {
    const list = $('#automatic-template-list');
    list.replaceChildren();
    if (!templates.length) {
      const empty = document.createElement('div');
      empty.className = 'automatic-template-empty';
      empty.append('Belum ada template. Buat template dari halaman Editing dengan tombol ', document.createElement('strong'));
      empty.lastChild.textContent = 'Save as Template';
      empty.append(' atau buka ');
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

  async function loadTemplates() {
    setStatus('#automatic-template-status', 'Memuat template...');
    try {
      const [library, selection] = await Promise.all([
        requestJson('/api/templates'),
        requestJson('/api/automatic-processing/templates'),
      ]);
      templates = library.templates || [];
      savedNames = new Set((selection.selectedTemplates || []).map(template => template.name));
      renderTemplates();
      setStatus('#automatic-template-status', templates.length
        ? `${templates.length} template tersedia. ${savedNames.size} template tersimpan untuk pemrosesan otomatis.`
        : 'Belum ada template yang tersedia.');
    } catch (error) {
      setStatus('#automatic-template-status', error.message, true);
    }
  }

  async function saveTemplates() {
    const button = $('#automatic-save-templates');
    const names = selectedNames();
    button.disabled = true;
    setStatus('#automatic-template-status', 'Menyimpan pilihan...');
    try {
      const result = await requestJson('/api/automatic-processing/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateNames: names }),
      });
      savedNames = new Set((result.selectedTemplates || []).map(template => template.name));
      setStatus('#automatic-template-status', `${savedNames.size} template disimpan di Automatic_Processing/template_settings.json.`);
      syncActions();
    } catch (error) {
      setStatus('#automatic-template-status', error.message, true);
      button.disabled = false;
    }
  }

  function formatJobStatus(status) {
    return ({ queued: 'Menunggu', processing: 'Memproses', done: 'Selesai', partial: 'Sebagian selesai', error: 'Gagal' })[status] || status;
  }

  function renderJobs(jobs) {
    const list = $('#automatic-jobs-list');
    list.replaceChildren();
    if (!jobs.length) {
      const empty = document.createElement('div');
      empty.className = 'automatic-template-empty';
      empty.textContent = 'Belum ada foto yang diproses.';
      list.append(empty);
      return;
    }
    for (const job of jobs) {
      const card = document.createElement('article');
      card.className = 'automatic-job-card';
      const heading = document.createElement('header'); heading.className = 'automatic-job-heading';
      const filename = document.createElement('strong'); filename.textContent = job.name;
      const state = document.createElement('span'); state.className = 'automatic-job-state'; state.textContent = `${formatJobStatus(job.status)} · ID ${job.id}`;
      heading.append(filename, state);
      const outputs = document.createElement('div'); outputs.className = 'automatic-output-list';
      for (const output of job.outputs || []) {
        const row = document.createElement('div'); row.className = 'automatic-output-row';
        const label = document.createElement('span');
        label.textContent = `${output.templateName} · ${formatJobStatus(output.status)}`;
        if (output.error) label.classList.add('automatic-output-error');
        row.append(label);
        if (output.status === 'done' && output.downloadUrl) {
          const download = document.createElement('a');
          download.className = 'button button-quiet'; download.href = output.downloadUrl;
          download.download = output.fileName || ''; download.textContent = 'Unduh';
          row.append(download);
        }
        outputs.append(row);
      }
      card.append(heading, outputs);
      list.append(card);
    }
  }

  async function loadJobs() {
    try {
      const result = await requestJson('/api/automatic-processing/jobs');
      const jobs = result.jobs || [];
      renderJobs(jobs);
      const active = jobs.some(job => ['queued', 'processing'].includes(job.status));
      if (pollingTimer) { clearTimeout(pollingTimer); pollingTimer = null; }
      if (active) pollingTimer = setTimeout(() => { pollingTimer = null; void loadJobs(); }, 1200);
      setStatus('#automatic-jobs-status', active ? 'Memperbarui status proses secara otomatis...' : `${jobs.length} proses tercatat.`);
    } catch (error) {
      setStatus('#automatic-jobs-status', error.message, true);
    }
  }

  async function uploadFile(file) {
    const response = await fetch('/api/automatic-processing/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${file.name}: ${body.error || `Request gagal (${response.status}).`}`);
    return body;
  }

  async function processFiles() {
    if (!selectedFiles.length || !savedNames.size || !isSelectionSaved()) return;
    const files = [...selectedFiles];
    isUploading = true;
    syncActions();
    setStatus('#automatic-upload-status', `Mengunggah ${files.length} foto...`);
    const failures = [];
    let finished = 0;
    const queue = [...files];
    const uploadWorker = async () => {
      while (queue.length) {
        const file = queue.shift();
        try { await uploadFile(file); }
        catch (error) { failures.push(error.message); }
        finished++;
        setStatus('#automatic-upload-status', `Mengunggah foto ${finished}/${files.length}...`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, files.length) }, uploadWorker));
    isUploading = false;
    selectedFiles = [];
    $('#automatic-file-input').value = '';
    $('#automatic-file-count').textContent = 'Belum ada foto dipilih';
    syncActions();
    setStatus('#automatic-upload-status', failures.length
      ? `${files.length - failures.length} foto masuk antrean. ${failures.join(' ')}`
      : `${files.length} foto masuk antrean pemrosesan.` , failures.length > 0);
    await loadJobs();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    $('#automatic-template-list').addEventListener('change', event => {
      if (event.target.matches('input[type="checkbox"]') && selectedNames().length > 20) {
        event.target.checked = false;
        setStatus('#automatic-template-status', 'Maksimal 20 template dapat dipilih.', true);
        return;
      }
      syncActions();
    });
    $('#automatic-template-list').addEventListener('click', event => {
      const button = event.target.closest('[data-app-view]');
      if (button) window.NiDiNavigation?.show(button.dataset.appView);
    });
    $('#automatic-save-templates').addEventListener('click', () => void saveTemplates());
    $('#automatic-file-input').addEventListener('change', event => {
      selectedFiles = [...event.target.files];
      $('#automatic-file-count').textContent = selectedFiles.length
        ? `${selectedFiles.length} foto dipilih`
        : 'Belum ada foto dipilih';
      syncActions();
    });
    $('#automatic-process-button').addEventListener('click', () => void processFiles());
    $('#automatic-refresh-jobs').addEventListener('click', () => void loadJobs());
    window.addEventListener('nidi:automatic-processing:show', () => {
      void loadTemplates();
      void loadJobs();
    });
    void loadTemplates();
    void loadJobs();
  }

  window.NiDiAutomaticProcessing = { init };
})();
