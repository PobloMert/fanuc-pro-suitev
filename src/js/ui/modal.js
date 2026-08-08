(() => {
  'use strict';

  const returnFocus = new Map();
  const focusableSelector = [
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  function focusableElements(modal) {
    return [...modal.querySelectorAll(focusableSelector)]
      .filter(element => !element.hidden && element.offsetParent !== null);
  }

  function close(id) {
    const overlay = document.getElementById(`modal-${id}`);
    if (!overlay) return;

    overlay.classList.remove('open');
    window.setTimeout(() => {
      overlay.remove();
      const target = returnFocus.get(id);
      returnFocus.delete(id);
      if (target?.isConnected) target.focus();
    }, 200);
  }

  function show(id, content, size = 'md') {
    let overlay = document.getElementById(`modal-${id}`);
    if (!overlay) {
      returnFocus.set(id, document.activeElement instanceof HTMLElement ? document.activeElement : null);
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = `modal-${id}`;

      const modal = document.createElement('div');
      modal.className = `modal modal-${size}`;
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('tabindex', '-1');
      modal.innerHTML = content;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      overlay.addEventListener('click', event => {
        if (event.target === overlay) close(id);
      });
      overlay.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const elements = focusableElements(modal);
        if (!elements.length) {
          event.preventDefault();
          modal.focus();
          return;
        }
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
    } else {
      const modal = overlay.querySelector('.modal');
      modal.className = `modal modal-${size}`;
      modal.innerHTML = content;
    }

    const modal = overlay.querySelector('.modal');
    const title = modal.querySelector('.modal-title');
    if (title) {
      title.id ||= `modal-${id}-title`;
      modal.setAttribute('aria-labelledby', title.id);
      modal.removeAttribute('aria-label');
    } else {
      modal.removeAttribute('aria-labelledby');
      modal.setAttribute('aria-label', 'Uygulama penceresi');
    }

    window.requestAnimationFrame(() => {
      overlay.classList.add('open');
      const initial = modal.querySelector('[role="tab"][aria-selected="true"], [autofocus], input:not([type="hidden"]), select, textarea, button');
      (initial || modal).focus();
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const overlays = [...document.querySelectorAll('.modal-overlay.open')];
    const overlay = overlays[overlays.length - 1];
    if (!overlay) return;
    event.preventDefault();
    close(overlay.id.replace(/^modal-/, ''));
  });

  window.showModal = show;
  window.closeModal = close;
  window.MTBModal = Object.freeze({ show, close });
})();
