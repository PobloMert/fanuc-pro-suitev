(function archiveFeature(global) {
  'use strict';
  const definitions = Object.freeze({
    machines: { label: 'Tezgâh', save: 'saveMachines', title: item => item.numarasi || item.name },
    maintenances: { label: 'Bakım', save: 'saveMaintenances', title: item => item.aciklama || item.tarih },
    batteries: { label: 'Pil', save: 'saveBatteries', title: item => `${item.machine || item.tezgah_id || 'Tezgâh'} / ${item.eksen || 'Pil'}` },
    fans: { label: 'Fan', save: 'saveFans', title: item => `${item.machine || item.tezgah_id || 'Tezgâh'} / ${item.konum || 'Fan'}` },
    backup_logs: { label: 'Yedek takibi', save: 'saveBackupLogs', title: item => item.son_yedek_tarihi || item.tarih || 'Yedek kaydı' },
    custom_mcodes: { label: 'Özel M-kodu', save: 'saveCustomMCodes', title: item => `${item.code || ''} ${item.name || ''}` },
    custom_alarms: { label: 'Özel alarm', save: 'saveCustomAlarms', title: item => `${item.code || ''} ${item.title || ''}` },
    wiki: { label: 'Teknik makale', save: 'saveWiki', title: item => item.title || item.error_code },
    diagnostic_history: { label: 'Teşhis geçmişi', save: 'saveDiagnosticHistory', title: item => `${item.code || 'Olay'} ${item.note || ''}` },
    projects: { label: 'Proje', save: 'projectMeta', title: item => item.name || 'Proje' }
  });
  const view = { from: '', to: '', page: 1 };
  const esc = value => global.escapeHTML ? global.escapeHTML(String(value ?? '')) : String(value ?? '');
  const archived = () => Object.entries(definitions).flatMap(([collection, definition]) =>
    (global.State?.[collection] || []).filter(item => item.deletedAt).map(item => ({ collection, definition, item }))
  ).sort((a, b) => String(b.item.deletedAt).localeCompare(String(a.item.deletedAt)));
  async function persist(collection) {
    const method = definitions[collection]?.save;
    if (method === 'projectMeta') {
      const writes = (global.State.projects || []).filter(item => item.id).map(item => global.electronAPI.writeFile(`${global.State.appDataDir}/projects/${item.id}/meta.json`, JSON.stringify(item, null, 2)));
      return (await Promise.all(writes)).every(result => result?.ok);
    }
    return method && typeof global.DataPersistence?.[method] === 'function' ? global.DataPersistence[method]() : false;
  }
  function renderArchive() {
    const page = global.createPage('archive');
    if (!global.canDelete?.()) {
      page.innerHTML = '<div class="page-body"><div class="card" style="padding:24px">Bu ekran yalnızca silme yetkisi olan yöneticilere açıktır.</div></div>';
      return page;
    }
    const allRows = archived();
    const growth = global.MTBHistoryGrowth;
    const result = growth?.query(allRows.map(row => ({ ...row, deletedAt: row.item.deletedAt })), { ...view, pageSize: 100 }) || { rows: allRows, total: allRows.length, page: 1, pages: 1 };
    const rows = result.rows;
    const compacted = allRows.filter(row => row.item.tombstone).length;
    page.innerHTML = `<div class="page-header"><div class="flex items-center justify-between"><div><h1>Silinen Kayıtlar</h1><p>Kayıtlar 90 gün geri yüklenebilir; ardından içerik küçültülür, senkronizasyon tombstone işareti korunur.</p></div><button class="btn btn-secondary" data-archive-compact>90 günü aşanları güvenle küçült</button></div></div><div class="page-body">
      <div class="card" style="padding:16px;margin-bottom:12px"><div class="flex gap-2 items-end"><label>Başlangıç<input class="form-control" type="date" data-archive-from value="${esc(view.from)}"></label><label>Bitiş<input class="form-control" type="date" data-archive-to value="${esc(view.to)}"></label><button class="btn btn-secondary" data-archive-filter>Filtrele</button><span class="tag tag-gray">${result.total} kayıt</span><span class="tag tag-gray">${compacted} küçültülmüş tombstone</span></div></div>
      <div class="card" style="overflow:auto"><table class="data-table"><thead><tr><th>Tür</th><th>Kayıt</th><th>Silinme zamanı</th><th>Silen</th><th>Sürüm</th><th>İşlem</th></tr></thead><tbody>${rows.length ? rows.map(({ collection, definition, item }) => `<tr><td><span class="tag tag-gray">${esc(definition.label)}</span></td><td><strong>${esc(item.tombstone ? `#${item.id} (içerik temizlendi)` : definition.title(item) || `#${item.id}`)}</strong></td><td>${esc(new Date(item.deletedAt).toLocaleString('tr-TR'))}</td><td>${esc(item.deletedBy || 'Bilinmiyor')}</td><td>${esc(item.revision || 1)}</td><td>${item.tombstone ? '<span class="text-xs" style="color:var(--text-muted)">Geri yükleme süresi doldu</span>' : `<button class="btn btn-primary btn-sm" data-archive-restore="${esc(item.id)}" data-archive-collection="${collection}">Geri yükle</button>`}</td></tr>`).join('') : '<tr><td colspan="6" style="padding:32px;text-align:center;color:var(--text-muted)">Bu tarih aralığında arşiv kaydı yok.</td></tr>'}</tbody></table></div>
      <div class="flex justify-between items-center" style="margin-top:12px"><button class="btn btn-secondary" data-archive-page="${result.page - 1}" ${result.page <= 1 ? 'disabled' : ''}>Önceki</button><span>Sayfa ${result.page} / ${result.pages}</span><button class="btn btn-secondary" data-archive-page="${result.page + 1}" ${result.page >= result.pages ? 'disabled' : ''}>Sonraki</button></div></div>`;
    page.querySelector('[data-archive-filter]')?.addEventListener('click', () => { view.from = page.querySelector('[data-archive-from]').value; view.to = page.querySelector('[data-archive-to]').value; view.page = 1; renderArchive(); });
    page.querySelectorAll('[data-archive-page]').forEach(button => button.addEventListener('click', () => { view.page = Number(button.dataset.archivePage); renderArchive(); }));
    page.querySelector('[data-archive-compact]')?.addEventListener('click', () => global.compactExpiredArchive());
    page.querySelectorAll('[data-archive-restore]').forEach(button => button.addEventListener('click', () => global.restoreArchivedRecord(button.dataset.archiveCollection, button.dataset.archiveRestore)));
    return page;
  }
  global.restoreArchivedRecord = async function (collection, id) {
    if (!global.canDelete?.() || !definitions[collection]) return;
    const list = global.State[collection] || [];
    const index = list.findIndex(item => String(item.id) === String(id) && item.deletedAt && !item.tombstone);
    if (index < 0) return global.showToast?.('Arşiv kaydı bulunamadı.', 'error');
    list[index] = global.MTBRecordRepository.restore(list[index], global.State.currentUser);
    await persist(collection);
    global.showToast?.('Kayıt geri yüklendi ve diğer cihazlara aktarılmaya hazır.', 'success');
    renderArchive();
  };
  global.compactExpiredArchive = async function () {
    if (!global.canDelete?.()) return;
    let total = 0; const saves = [];
    Object.keys(definitions).forEach(collection => {
      const result = global.MTBRecordRepository.compactExpired(global.State[collection], 90);
      if (result.compacted) { global.State[collection] = result.records; total += result.compacted; saves.push(persist(collection)); }
    });
    await Promise.all(saves);
    global.showToast?.(total ? `${total} eski kayıt güvenli tombstone biçimine küçültüldü.` : '90 günü aşan arşiv kaydı yok.', total ? 'success' : 'info');
    renderArchive();
  };
  global.MTBArchiveFeature = Object.freeze({ renderArchive, definitions, archived });
  global.renderArchive = renderArchive;
})(window);
