(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const allowedName = /^[A-Za-z0-9 _-]{1,64}$/;
  let templates = [];
  let pendingDelete = '';
  let initialized = false;

  async function request(url, options) {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
    return body;
  }

  function setLibraryStatus(message, isError = false) {
    const status = $('#template-library-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function closeModal(modal) {
    modal.hidden = true;
    const form = $('#save-template-form');
    if (form) form.reset();
    const error = $('#save-template-error');
    if (error) { error.textContent = ''; error.hidden = true; }
    const deleteError = $('#delete-template-error');
    if (deleteError) { deleteError.textContent = ''; deleteError.hidden = true; }
  }

  function openSaveModal() {
    const modal = $('#save-template-modal');
    const input = $('#template-name-input');
    const error = $('#save-template-error');
    error.textContent = ''; error.hidden = true;
    modal.hidden = false;
    input.value = '';
    requestAnimationFrame(() => input.focus());
  }

  function openDeleteModal(name) {
    pendingDelete = name;
    $('#delete-template-name').textContent = `${name}.nd`;
    $('#delete-template-error').hidden = true;
    $('#delete-template-modal').hidden = false;
    requestAnimationFrame(() => $('#delete-template-confirm').focus());
  }

  function formatDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Saved template';
    return `Saved ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)}`;
  }

  function makeCard(template) {
    const card = document.createElement('article');
    card.className = 'template-card';

    const head = document.createElement('div');
    head.className = 'template-card-head';
    const mark = document.createElement('span');
    mark.className = 'template-card-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '◈';
    const titleWrap = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = template.name;
    const date = document.createElement('span');
    date.className = 'template-card-date';
    date.textContent = formatDate(template.createdAt);
    titleWrap.append(title, date);
    head.append(mark, titleWrap);

    const description = document.createElement('p');
    description.className = 'template-card-description';
    const hasMask = Boolean(template.settings?.mask?.strokes?.length);
    description.textContent = `Color settings · ${String(template.outputFormat || 'png').toUpperCase()} output${hasMask ? ' · Mask included' : ''}`;

    const actions = document.createElement('div');
    actions.className = 'template-card-actions';
    const apply = document.createElement('button');
    apply.className = 'button button-primary template-use-button';
    apply.type = 'button';
    apply.dataset.templateAction = 'apply';
    apply.textContent = 'Open in Editor';
    const download = document.createElement('button');
    download.className = 'button button-quiet';
    download.type = 'button';
    download.dataset.templateAction = 'download';
    download.textContent = 'Download';
    const remove = document.createElement('button');
    remove.className = 'button button-danger';
    remove.type = 'button';
    remove.dataset.templateAction = 'delete';
    remove.textContent = 'Delete';
    actions.append(apply, download, remove);
    card.append(head, description, actions);
    card.dataset.templateName = template.name;
    return card;
  }

  async function loadTemplates() {
    const list = $('#template-list');
    const empty = $('#template-empty');
    if (!list || !empty) return;
    list.replaceChildren();
    empty.hidden = true;
    setLibraryStatus('Loading templates…');
    try {
      const result = await request('/api/templates');
      templates = result.templates || [];
      $('#template-download-all').disabled = templates.length === 0;
      if (!templates.length) {
        empty.hidden = false;
        setLibraryStatus('No saved templates.');
        return;
      }
      const fragment = document.createDocumentFragment();
      templates.forEach(template => fragment.append(makeCard(template)));
      list.append(fragment);
      setLibraryStatus(`${templates.length} template${templates.length === 1 ? '' : 's'}`);
    } catch (error) {
      setLibraryStatus(error.message, true);
    }
  }

  async function saveTemplate(event) {
    event.preventDefault();
    const input = $('#template-name-input');
    const error = $('#save-template-error');
    const name = input.value.trim();
    if (!allowedName.test(name)) {
      error.textContent = 'Use 1–64 letters, numbers, spaces, underscores, or hyphens only.';
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    const confirm = $('#save-template-confirm');
    confirm.disabled = true;
    error.hidden = true;
    try {
      await request('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          settings: window.NiDiEditor.getSettings(),
          outputFormat: window.NiDiEditor.getOutputFormat(),
        }),
      });
      closeModal($('#save-template-modal'));
      window.NiDiNavigation.show('templates');
    } catch (saveError) {
      error.textContent = saveError.message;
      error.hidden = false;
    } finally {
      confirm.disabled = false;
    }
  }

  function downloadTemplate(template) {
    const data = {
      schemaVersion: 1,
      name: template.name,
      createdAt: template.createdAt,
      outputFormat: template.outputFormat,
      settings: template.settings,
    };
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${template.name}.nd`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function downloadAllTemplates() {
    if (!templates.length) return;
    const data = {
      schemaVersion: 1,
      templates: templates.map(template => ({
        schemaVersion: 1,
        name: template.name,
        createdAt: template.createdAt,
        outputFormat: template.outputFormat,
        settings: template.settings,
      })),
    };
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'nidi-all-templates.nd';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  async function importTemplateFiles(files) {
    const importButton = $('#template-import-button');
    const input = $('#template-import-input');
    if (!files.length) return;
    importButton.disabled = true;
    setLibraryStatus('Reading .nd file(s)…');
    try {
      const imported = [];
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.nd')) throw new Error(`"${file.name}" must use the .nd extension.`);
        let data;
        try { data = JSON.parse(await file.text()); }
        catch { throw new Error(`"${file.name}" does not contain valid JSON data.`); }
        if (Array.isArray(data)) imported.push(...data);
        else if (Array.isArray(data?.templates)) imported.push(...data.templates);
        else imported.push(data);
      }
      const result = await request('/api/templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: imported }),
      });
      await loadTemplates();
      setLibraryStatus(`${result.templates.length} template${result.templates.length === 1 ? '' : 's'} imported.`);
    } catch (error) {
      setLibraryStatus(error.message, true);
    } finally {
      importButton.disabled = false;
      input.value = '';
    }
  }

  async function deleteTemplate() {
    if (!pendingDelete) return;
    const confirm = $('#delete-template-confirm');
    const error = $('#delete-template-error');
    confirm.disabled = true;
    error.hidden = true;
    try {
      await request(`/api/templates/${encodeURIComponent(`${pendingDelete}.nd`)}`, { method: 'DELETE' });
      closeModal($('#delete-template-modal'));
      pendingDelete = '';
      await loadTemplates();
    } catch (deleteError) {
      error.textContent = deleteError.message;
      error.hidden = false;
    } finally {
      confirm.disabled = false;
    }
  }

  function handleListClick(event) {
    const button = event.target.closest('[data-template-action]');
    if (!button) return;
    const card = button.closest('[data-template-name]');
    const template = templates.find(item => item.name === card?.dataset.templateName);
    if (!template) return;
    if (button.dataset.templateAction === 'download') return downloadTemplate(template);
    if (button.dataset.templateAction === 'delete') return openDeleteModal(template.name);
    if (button.dataset.templateAction === 'apply') {
      window.NiDiEditor.applyTemplate(template.settings, template.outputFormat, template.name);
      window.NiDiNavigation.show('editor');
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    $('#save-template-button').addEventListener('click', openSaveModal);
    $('#template-import-button').addEventListener('click', () => $('#template-import-input').click());
    $('#template-import-input').addEventListener('change', event => void importTemplateFiles([...event.currentTarget.files]));
    $('#template-download-all').addEventListener('click', downloadAllTemplates);
    $('#save-template-form').addEventListener('submit', saveTemplate);
    $('#delete-template-confirm').addEventListener('click', deleteTemplate);
    $('#template-list').addEventListener('click', handleListClick);
    document.querySelectorAll('[data-modal-close]').forEach(button => button.addEventListener('click', () => closeModal(button.closest('.modal-backdrop'))));
    document.querySelectorAll('.modal-backdrop').forEach(modal => modal.addEventListener('click', event => {
      if (event.target === modal) closeModal(modal);
    }));
    $('#template-name-input').addEventListener('input', event => {
      const input = event.currentTarget;
      input.removeAttribute('aria-invalid');
      $('#save-template-error').hidden = true;
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(closeModal);
    });
  }

  window.addEventListener('nidi:templates:show', loadTemplates);
  window.NiDiTemplates = { init, load: loadTemplates };
})();
