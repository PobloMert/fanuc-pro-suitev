(function initSyncCenter(global) {
  'use strict';

  const SCOPE_KEY = 'mtb-sync-scope-v1';
  const DEVICE_NAME_KEY = 'mtb-sync-device-name';
  const scopes = Object.freeze([
    ['machines', 'Tezgâhlar'], ['maintenances', 'Bakım kayıtları'],
    ['batteries_fans', 'Pil ve fan kayıtları'], ['backup_logs', 'Yedek takip kayıtları'],
    ['custom_alarms', 'Özel alarmlar'], ['wiki', 'Wiki ve teknik notlar']
  ]);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const date = value => value ? new Date(value).toLocaleString('tr-TR') : 'Henüz yok';
  const num = value => Number.isFinite(Number(value)) ? Number(value) : '—';

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }

  function service() {
    try {
      return global.MTBCloudSync?.initCloudSync?.({ State: global.State, showToast: global.showToast }) || null;
    } catch { return null; }
  }

  function normalizeStatus(raw = {}) {
    const counts = raw.counts || raw.stats || {};
    return {
      state: raw.state || 'unknown',
      lastPush: raw.lastPushTime || raw.lastUploadTime || raw.lastSyncTime || null,
      lastPull: raw.lastPullTime || raw.lastDownloadTime || raw.lastSyncTime || null,
      sent: raw.sent ?? counts.sent,
      received: raw.received ?? counts.received,
      merged: raw.merged ?? counts.merged,
      conflicts: raw.conflicts ?? counts.conflicts,
      lastError: raw.lastError || raw.error || null,
      retryAt: raw.retryAt || raw.nextRetryAt || null,
      devices: Array.isArray(raw.devices) ? raw.devices : [],
      conflictItems: Array.isArray(raw.conflictItems) ? raw.conflictItems : []
    };
  }

  function protocolNotice(message) {
    return `<div class="sync-protocol-notice" role="status"><strong>Sunucu/protokol desteği bekleniyor</strong><span>${esc(message)}</span></div>`;
  }

  function render() {
    const page = document.createElement('div');
    page.id = 'page-sync_center';
    page.className = 'page active sync-center';
    if (global.State?.currentUser?.role !== 'admin') {
      page.innerHTML = '<div class="page-body"><div class="empty-state-guided"><h2>Yönetici yetkisi gerekli</h2><p>Senkronizasyon ayarları ve çakışma kararları yalnızca yöneticilere açıktır.</p></div></div>';
      return page;
    }

    const engine = service();
    const status = normalizeStatus(engine?.getSyncStatus?.());
    const selectedScopes = readJson(SCOPE_KEY, Object.fromEntries(scopes.map(([key]) => [key, true])));
    const deviceName = localStorage.getItem(DEVICE_NAME_KEY) || 'Bu bilgisayar';
    const detailSupported = [status.sent, status.received, status.merged, status.conflicts].some(value => value !== undefined);
    const scopeSupported = typeof engine?.setSyncScope === 'function';
    const conflictSupported = typeof engine?.resolveConflict === 'function';
    const deviceSupported = typeof engine?.setDeviceName === 'function';

    page.innerHTML = `<div class="page-header"><div><h1>Senkronizasyon Merkezi</h1><p>Google Drive yedekleme, cihazlar ve kayıt birleştirme durumunu yönetin.</p></div><button class="btn btn-primary" data-sync-now ${engine?.syncNow ? '' : 'disabled'}>Şimdi senkronize et</button></div>
      <div class="page-body">
        <section class="sync-summary-grid" aria-label="Senkronizasyon özeti">
          <article class="card"><small>Durum</small><strong>${esc({ idle: 'Hazır', syncing: 'Senkronize ediliyor', success: 'Başarılı', error: 'Hata' }[status.state] || 'Bilinmiyor')}</strong></article>
          <article class="card"><small>Son gönderme</small><strong>${esc(date(status.lastPush))}</strong></article>
          <article class="card"><small>Son çekme</small><strong>${esc(date(status.lastPull))}</strong></article>
          <article class="card"><small>Yeniden deneme</small><strong>${esc(status.retryAt ? date(status.retryAt) : status.state === 'error' ? 'Manuel tekrar gerekli' : 'Bekleyen işlem yok')}</strong></article>
        </section>
        <section class="card sync-section"><div class="sync-section-heading"><div><h2>Aktarım özeti</h2><p>Son senkronizasyon döngüsünün kayıt sayıları.</p></div><button class="btn btn-ghost btn-sm" data-sync-refresh>Yenile</button></div>
          <div class="sync-count-grid"><span>Gönderilen <strong>${num(status.sent)}</strong></span><span>Alınan <strong>${num(status.received)}</strong></span><span>Birleştirilen <strong>${num(status.merged)}</strong></span><span>Çatışan <strong>${num(status.conflicts)}</strong></span></div>
          ${detailSupported ? '' : protocolNotice('Mevcut servis yalnızca genel başarı durumunu bildiriyor; ayrıntılı kayıt sayaçları geldiğinde burada gösterilecek.')}
          <div class="sync-error ${status.lastError ? 'has-error' : ''}"><strong>Son hata</strong><span>${esc(status.lastError || 'Kayıtlı hata yok.')}</span>${status.state === 'error' ? '<button class="btn btn-secondary btn-sm" data-sync-retry>Yeniden dene</button>' : ''}</div>
        </section>
        <div class="sync-columns">
          <section class="card sync-section"><h2>Bu cihaz</h2><label class="field-label" for="sync-device-name">Görünen cihaz adı</label><div class="sync-inline"><input id="sync-device-name" maxlength="80" value="${esc(deviceName)}"><button class="btn btn-secondary" data-device-save>Kaydet</button></div><p class="text-muted">Son görülme: ${esc(date(status.lastPull || status.lastPush))}</p>${deviceSupported ? '' : protocolNotice('Ad yerel olarak kaydedilir. Diğer cihazlarda görünmesi için servis cihaz kimliği desteği sağlamalı.')}</section>
          <section class="card sync-section"><h2>Senkronizasyon kapsamı</h2><div class="sync-scope-list">${scopes.map(([key, label]) => `<label><input type="checkbox" data-sync-scope="${key}" ${selectedScopes[key] !== false ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div><button class="btn btn-secondary" data-scope-save>Kapsamı kaydet</button>${scopeSupported ? '' : protocolNotice('Seçimler yerel tercih olarak saklanır; servis kapsam filtrelemeyi destekleyene kadar tüm iş kayıtları senkronize edilir.')}</section>
        </div>
        <section class="card sync-section" id="sync-offline-queue-section"><div class="sync-section-heading"><div><h2>Çevrimdışı Kuyruk & Delta Durumu</h2><p>İnternet kesintilerinde yerel SQLite'a kaydedilen ve Drive'a aktarılmayı bekleyen işlemler.</p></div><span class="tag tag-blue" id="sync-queue-count-badge">Kontrol ediliyor…</span></div><div style="display:flex;align-items:center;gap:10px;margin-top:8px"><button class="btn btn-secondary btn-sm" id="btn-flush-offline-queue">Kuyruğu Şimdi Gönder (Delta)</button><span class="text-muted" style="font-size:11.5px" id="sync-queue-desc">Bağlantı kurulduğunda otomatik aktarılır.</span></div></section>
        <section class="card sync-section sync-secret-card"><div class="sync-section-heading"><div><h2>Drive cihaz erişim anahtarı</h2><p>Anahtar Windows güvenli depolamasında saklanır ve kaydedildikten sonra hiçbir zaman geri okunmaz.</p></div><span class="sync-secret-status" data-secret-status role="status">Durum denetleniyor…</span></div>
          <label class="field-label" for="sync-drive-secret">Yeni erişim anahtarı</label><div class="sync-inline"><input id="sync-drive-secret" type="password" minlength="16" maxlength="512" autocomplete="new-password" spellcheck="false" placeholder="En az 16 karakter"><button class="btn btn-primary" data-secret-save>Güvenli kaydet</button><button class="btn btn-ghost" data-secret-clear>Temizle</button></div>
          <small class="text-muted">Mevcut anahtar gösterilmez veya bu alana doldurulmaz. Yeni bir değer kaydetmek mevcut anahtarı değiştirir.</small>
        </section>
        <section class="card sync-section"><h2>Cihazlar</h2><div class="table-responsive"><table class="data-table"><thead><tr><th>Cihaz</th><th>Son görülme</th><th>Durum</th></tr></thead><tbody>${status.devices.length ? status.devices.map(item => `<tr><td>${esc(item.name || item.deviceName || item.id)}</td><td>${esc(date(item.lastSeen || item.lastSyncTime))}</td><td>${esc(item.state || 'Bilinmiyor')}</td></tr>`).join('') : '<tr><td colspan="3">Servisten cihaz listesi alınamadı.</td></tr>'}</tbody></table></div>${status.devices.length ? '' : protocolNotice('Cihaz listesi, Apps Script cihaz durumu protokolünü sağladığında burada görüntülenecek.')}</section>
        <section class="card sync-section"><h2>Çakışma inceleme</h2><p>Aynı kaydın iki cihazda değiştirilmesi halinde iki sürümü karşılaştırın.</p><div class="sync-conflicts">${status.conflictItems.length ? status.conflictItems.map(item => `<article class="sync-conflict"><div><strong>${esc(item.title || item.recordId || 'Kayıt')}</strong><small>${esc(item.collection || 'Bilinmeyen koleksiyon')}</small></div><div class="sync-conflict-actions"><button class="btn btn-ghost btn-sm" data-resolve="local" data-conflict-id="${esc(item.id)}" ${conflictSupported ? '' : 'disabled'}>Yereli kullan</button><button class="btn btn-ghost btn-sm" data-resolve="remote" data-conflict-id="${esc(item.id)}" ${conflictSupported ? '' : 'disabled'}>Drive'ı kullan</button><button class="btn btn-secondary btn-sm" data-resolve="merge" data-conflict-id="${esc(item.id)}" ${conflictSupported ? '' : 'disabled'}>Birleştir</button></div></article>`).join('') : '<div class="empty-state-guided"><h3>İncelenecek çakışma yok</h3><p>Servis tarafından bildirilen çakışmalar burada listelenir.</p></div>'}</div>${conflictSupported ? '' : protocolNotice('Yerel/Drive/birleştir kararları ancak servis resolveConflict({ conflictId, strategy }) sözleşmesini sağladığında etkinleşir.')}</section>
      </div>`;

    const notify = (message, type = 'info') => global.showToast?.(message, type);
    const runSync = async button => {
      if (!engine?.syncNow) return notify('Senkronizasyon servisi kullanılamıyor.', 'warning');
      button.disabled = true; button.textContent = 'Senkronize ediliyor…';
      try { const result = await engine.syncNow(false); if (!result?.ok) notify(result?.error || 'Senkronizasyon tamamlanamadı.', 'error'); }
      finally { global.navigate?.('sync_center'); }
    };
    page.querySelector('[data-sync-now]')?.addEventListener('click', event => runSync(event.currentTarget));
    page.querySelector('[data-sync-retry]')?.addEventListener('click', event => runSync(event.currentTarget));
    page.querySelector('[data-sync-refresh]')?.addEventListener('click', () => global.navigate?.('sync_center'));
    page.querySelector('[data-device-save]')?.addEventListener('click', async () => {
      const name = page.querySelector('#sync-device-name')?.value.trim();
      if (!name) return notify('Cihaz adı boş bırakılamaz.', 'warning');
      localStorage.setItem(DEVICE_NAME_KEY, name);
      if (deviceSupported) await engine.setDeviceName(name);
      notify(deviceSupported ? 'Cihaz adı kaydedildi.' : 'Cihaz adı yerel olarak kaydedildi; sunucu desteği bekleniyor.', deviceSupported ? 'success' : 'info');
    });
    const secretInput = page.querySelector('#sync-drive-secret');
    const secretStatus = page.querySelector('[data-secret-status]');
    const refreshSecretStatus = async () => {
      if (!global.electronAPI?.getDriveSecretStatus) {
        secretStatus.textContent = 'Güvenli depolama API’si kullanılamıyor';
        secretStatus.className = 'sync-secret-status is-error';
        return;
      }
      const result = await global.electronAPI.getDriveSecretStatus();
      if (!result?.ok) {
        secretStatus.textContent = result?.error || 'Durum alınamadı';
        secretStatus.className = 'sync-secret-status is-error';
        return;
      }
      secretStatus.textContent = result.configured ? 'Yapılandırıldı ••••••••' : 'Yapılandırılmadı';
      secretStatus.className = `sync-secret-status ${result.configured ? 'is-configured' : ''}`;
      page.querySelector('[data-secret-clear]').disabled = !result.configured;
    };
    page.querySelector('[data-secret-save]')?.addEventListener('click', async event => {
      const value = secretInput?.value.trim() || '';
      if (value.length < 16) return notify('Erişim anahtarı en az 16 karakter olmalıdır.', 'warning');
      if (!global.electronAPI?.setDriveSecret) return notify('Güvenli anahtar depolama kullanılamıyor.', 'error');
      event.currentTarget.disabled = true;
      const result = await global.electronAPI.setDriveSecret(value);
      secretInput.value = '';
      event.currentTarget.disabled = false;
      notify(result?.ok ? 'Drive erişim anahtarı güvenli biçimde kaydedildi.' : result?.error || 'Anahtar kaydedilemedi.', result?.ok ? 'success' : 'error');
      await refreshSecretStatus();
    });
    page.querySelector('[data-secret-clear]')?.addEventListener('click', async () => {
      if (!global.electronAPI?.setDriveSecret) return notify('Güvenli anahtar depolama kullanılamıyor.', 'error');
      if (!global.confirm?.('Drive erişim anahtarı temizlensin mi? Otomatik senkronizasyon yeni anahtar kaydedilene kadar çalışmayabilir.')) return;
      const result = await global.electronAPI.setDriveSecret('');
      secretInput.value = '';
      notify(result?.ok ? 'Drive erişim anahtarı temizlendi.' : result?.error || 'Anahtar temizlenemedi.', result?.ok ? 'success' : 'error');
      await refreshSecretStatus();
    });
    const queueBadge = page.querySelector('#sync-queue-count-badge');
    const queueDesc = page.querySelector('#sync-queue-desc');
    const flushQueueBtn = page.querySelector('#btn-flush-offline-queue');

    const updateOfflineQueueDisplay = async () => {
      if (!global.electronAPI?.listSyncQueue) return;
      const res = await global.electronAPI.listSyncQueue();
      const count = res?.ok && Array.isArray(res.items) ? res.items.length : 0;
      if (queueBadge) {
        queueBadge.textContent = count > 0 ? `${count} İşlem Bekliyor` : 'Kuyruk Temiz (0)';
        queueBadge.className = count > 0 ? 'tag tag-orange' : 'tag tag-green';
      }
      if (queueDesc) {
        queueDesc.textContent = count > 0 
          ? `${count} adet yerel kayıt/güncelleme çevrimdışı kuyruğunda bekliyor.` 
          : 'Tüm yerel kayıtlar güncel ve senkronize.';
      }
      if (flushQueueBtn) flushQueueBtn.disabled = count === 0;
    };

    flushQueueBtn?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      event.currentTarget.textContent = 'Aktarılıyor…';
      try {
        if (engine?.syncNow) {
          const res = await engine.syncNow(false);
          if (res?.ok) {
            notify('Çevrimdışı kuyruk ve delta kayıtları başarıyla aktarıldı.', 'success');
          } else {
            notify('Aktarım uyarısı: ' + (res?.error || 'Tamamlanamadı'), 'warning');
          }
        }
      } catch (err) {
        notify('Kuyruk aktarım hatası: ' + err.message, 'error');
      } finally {
        await updateOfflineQueueDisplay();
        if (flushQueueBtn) {
          flushQueueBtn.disabled = false;
          flushQueueBtn.textContent = 'Kuyruğu Şimdi Gönder (Delta)';
        }
      }
    });

    updateOfflineQueueDisplay();
    refreshSecretStatus();
    page.querySelector('[data-scope-save]')?.addEventListener('click', async () => {
      const value = Object.fromEntries([...page.querySelectorAll('[data-sync-scope]')].map(input => [input.dataset.syncScope, input.checked]));
      localStorage.setItem(SCOPE_KEY, JSON.stringify(value));
      if (scopeSupported) await engine.setSyncScope(value);
      notify(scopeSupported ? 'Senkronizasyon kapsamı kaydedildi.' : 'Tercih yerel olarak kaydedildi; sunucu desteği bekleniyor.', scopeSupported ? 'success' : 'info');
    });
    page.querySelectorAll('[data-resolve]').forEach(button => button.addEventListener('click', async () => {
      if (!conflictSupported) return notify('Çakışma çözme için sunucu/protokol desteği bekleniyor.', 'warning');
      const result = await engine.resolveConflict({ conflictId: button.dataset.conflictId, strategy: button.dataset.resolve });
      notify(result?.ok ? 'Çakışma kararı kaydedildi.' : result?.error || 'Karar kaydedilemedi.', result?.ok ? 'success' : 'error');
      if (result?.ok) global.navigate?.('sync_center');
    }));
    return page;
  }

  global.MTBSyncCenter = Object.freeze({ render, normalizeStatus });
})(typeof window !== 'undefined' ? window : globalThis);
