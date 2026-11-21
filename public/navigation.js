(() => {
  'use strict';

  const editorView = document.querySelector('#editor-view');
  const navigationRoot = document.querySelector('#navigation-root');
  const templateRoot = document.querySelector('#template-view-root');
  const modalRoot = document.querySelector('#template-modal-root');
  const brandToggle = document.querySelector('#brand-menu-toggle');
  let sidebar = null;
  let backdrop = null;
  let templateView = null;

  function setSidebarOpen(open) {
    if (!sidebar || !backdrop) return;
    const wasOpen = sidebar.classList.contains('is-open');
    sidebar.classList.toggle('is-open', open);
    sidebar.setAttribute('aria-hidden', String(!open));
    sidebar.inert = !open;
    backdrop.hidden = !open;
    brandToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('sidebar-is-open', open);
    if (open) sidebar.querySelector('#sidebar-close').focus();
    else if (wasOpen) brandToggle.focus({ preventScroll: true });
  }

  function show(view) {
    const showTemplates = view === 'templates' && Boolean(templateView);
    editorView.hidden = showTemplates;
    if (templateView) templateView.hidden = !showTemplates;
    document.querySelectorAll('[data-app-view]').forEach(button => {
      if (button.classList.contains('sidebar-link')) {
        const active = button.dataset.appView === (showTemplates ? 'templates' : 'editor');
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-current', active ? 'page' : 'false');
      }
    });
    setSidebarOpen(false);
    if (showTemplates) window.dispatchEvent(new Event('nidi:templates:show'));
  }

  window.NiDiNavigation = { show, openSidebar: () => setSidebarOpen(true), closeSidebar: () => setSidebarOpen(false) };
  brandToggle.addEventListener('click', () => setSidebarOpen(!sidebar?.classList.contains('is-open')));

  async function loadFragments() {
    try {
      const [navigationHtml, templateHtml, modalHtml] = await Promise.all([
        fetch('/partials/sidebar.html').then(response => { if (!response.ok) throw new Error('Navigation could not be loaded.'); return response.text(); }),
        fetch('/views/template-library.html').then(response => { if (!response.ok) throw new Error('Template Library could not be loaded.'); return response.text(); }),
        fetch('/partials/template-modals.html').then(response => { if (!response.ok) throw new Error('Template dialogs could not be loaded.'); return response.text(); }),
      ]);
      navigationRoot.innerHTML = navigationHtml;
      templateRoot.innerHTML = templateHtml;
      modalRoot.innerHTML = modalHtml;
      sidebar = navigationRoot.querySelector('#app-sidebar');
      backdrop = navigationRoot.querySelector('#sidebar-backdrop');
      templateView = templateRoot.querySelector('#template-library-view');

      brandToggle.setAttribute('aria-controls', 'app-sidebar');
      navigationRoot.querySelector('#sidebar-close').addEventListener('click', () => setSidebarOpen(false));
      backdrop.addEventListener('click', () => setSidebarOpen(false));
      navigationRoot.querySelectorAll('[data-app-view]').forEach(button => button.addEventListener('click', () => show(button.dataset.appView)));
      templateView.querySelectorAll('[data-app-view]').forEach(button => button.addEventListener('click', () => show(button.dataset.appView)));
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && sidebar.classList.contains('is-open')) setSidebarOpen(false);
      });
      if (window.NiDiTemplates) window.NiDiTemplates.init();
      show('editor');
    } catch (error) {
      navigationRoot.textContent = error.message;
    }
  }

  void loadFragments();
})();
