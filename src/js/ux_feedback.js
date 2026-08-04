(() => {
  'use strict';

  const icons = { success: '✓', error: '!', warning: '⚠', info: 'i' };
  const titles = { success: 'İşlem tamamlandı', error: 'İşlem tamamlanamadı', warning: 'Dikkat gerekiyor', info: 'Bilgilendirme' };
  let toastSequence = 0;

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
  }

  function getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'false');
      document.body.appendChild(container);
    }
    return container;
  }

  function notify(input, fallbackType = 'info', extra = {}) {
    const options = typeof input === 'object' && input !== null
      ? { ...input }
      : { ...extra, message: String(input ?? ''), type: fallbackType };
    const type = ['success', 'error', 'warning', 'info'].includes(options.type) ? options.type : fallbackType;
    const message = String(options.message || 'İşlem hakkında ayrıntı bulunmuyor.');
    const container = getToastContainer();

    const duplicate = [...container.querySelectorAll('.toast')].find(item => item.dataset.message === message);
    if (duplicate) {
      duplicate.classList.remove('toast-pulse');
      requestAnimationFrame(() => duplicate.classList.add('toast-pulse'));
      return duplicate;
    }

    const toast = document.createElement('section');
    toast.className = `toast ${type}`;
    toast.dataset.message = message;
    toast.id = `toast-${++toastSequence}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = icons[type];

    const content = document.createElement('div');
    content.className = 'toast-content';
    const heading = document.createElement('strong');
    heading.className = 'toast-title';
    heading.textContent = options.title || titles[type];
    const detail = document.createElement('span');
    detail.className = 'toast-message';
    detail.textContent = message;
    content.append(heading, detail);
    if (type === 'error' || options.help) {
      const help = document.createElement('span');
      help.className = 'toast-help';
      help.textContent = options.help || (
        /bağlan|ağ|sunucu/i.test(message) ? 'Bağlantıyı kontrol edip işlemi yeniden deneyin.' :
        /kaydet|alan|bilgi/i.test(message) ? 'Girdiğiniz alanları kontrol edip tekrar deneyin.' :
        /pdf|dosya/i.test(message) ? 'Dosya konumunu ve erişim iznini kontrol edin.' :
        'İşlemi tekrar deneyin. Sorun sürerse tanı kayıtlarını kontrol edin.'
      );
      content.appendChild(help);
    }

    const controls = document.createElement('div');
    controls.className = 'toast-controls';
    if (options.actionLabel && typeof options.onAction === 'function') {
      const action = document.createElement('button');
      action.className = 'toast-action';
      action.type = 'button';
      action.textContent = options.actionLabel;
      action.addEventListener('click', () => {
        options.onAction();
        dismiss(toast);
      });
      controls.appendChild(action);
    }
    const close = document.createElement('button');
    close.className = 'toast-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Bildirimi kapat');
    close.textContent = '×';
    close.addEventListener('click', () => dismiss(toast));
    controls.appendChild(close);
    toast.append(icon, content, controls);
    container.appendChild(toast);

    if (!options.persistent) {
      const duration = Number(options.duration) || (type === 'error' ? 7000 : 4800);
      window.setTimeout(() => dismiss(toast), duration);
    }
    return toast;
  }

  function dismiss(toast) {
    if (!toast?.isConnected || toast.classList.contains('toast-leave')) return;
    toast.classList.add('toast-leave');
    window.setTimeout(() => toast.remove(), 260);
  }

  function emptyState(options = {}) {
    const icon = escapeHTML(options.icon || '○');
    const title = escapeHTML(options.title || 'Henüz kayıt bulunmuyor');
    const description = escapeHTML(options.description || 'İlk kaydı ekleyerek bu alanı kullanmaya başlayabilirsiniz.');
    const action = options.actionLabel && options.command
      ? `<button type="button" class="btn btn-primary btn-sm empty-state-action" data-empty-command="${escapeHTML(options.command)}">${escapeHTML(options.actionLabel)}</button>`
      : '';
    return `<div class="empty-state empty-state-guided"><div class="empty-state-icon" aria-hidden="true">${icon}</div><h3>${title}</h3><p>${description}</p>${action}</div>`;
  }

  function emptyTableRow(options = {}) {
    return `<tr class="empty-table-row"><td colspan="${Number(options.colspan) || 1}">${emptyState(options)}</td></tr>`;
  }

  function loadingState(label = 'Veriler yükleniyor') {
    return `<div class="page-loading-state" role="status" aria-label="${escapeHTML(label)}"><div class="loading-heading"><span class="spinner"></span><span>${escapeHTML(label)}</span></div><div class="loading-skeleton-grid"><span class="skeleton skeleton-card"></span><span class="skeleton skeleton-card"></span><span class="skeleton skeleton-card"></span></div><div class="loading-skeleton-lines"><span class="skeleton skeleton-text"></span><span class="skeleton skeleton-text"></span><span class="skeleton skeleton-text short"></span></div></div>`;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-empty-command]');
    if (!button) return;
    const commands = {
      'new-machine': () => window.showNewMachineModal?.(),
      'new-maintenance': () => window.showNewMaintModal?.(),
      'new-battery': () => window.showNewBattModal?.(),
      'new-fan': () => window.showNewFanModal?.(),
      'new-project': () => document.getElementById('btn-new-project')?.click(),
      'clear-filters': () => {
        const page = button.closest('[id^="page-"]');
        page?.querySelectorAll('input[type="text"], input[type="search"]').forEach(input => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); });
        page?.querySelectorAll('select').forEach(select => { select.selectedIndex = 0; select.dispatchEvent(new Event('change', { bubbles: true })); });
      }
    };
    commands[button.dataset.emptyCommand]?.();
  });

  window.MTBUX = Object.freeze({ notify, emptyState, emptyTableRow, loadingState });
})();
