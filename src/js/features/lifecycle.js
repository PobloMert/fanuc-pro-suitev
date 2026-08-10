/* Bakım, pil ve fan ekranlarının tek sorumluluklu yaşam döngüsü modülü. */
(function lifecycleFeature(global) {
  'use strict';
  let api = null;

  function initialize(deps) {
    if (api) return api;
    const { State, createPage, canEdit, canDelete, escapeHTML, getSortedMachines,
      saveMaintenances, saveBatteries, saveFans, showModal, closeModal, showToast,
      navigate, getTodayFormat, showPromptModal, parseDateHelper } = deps;

function renderMaintenance(extraData = null) {
  const page = createPage('maintenance');
  const contextMachine = State.machines.find(machine => Number(machine.id) === Number(extraData?.machineId));
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>🔧 Tezgah Bakım Defteri</h1>
          <p>Toplam ${State.maintenances.length} servis ve periyodik bakım kaydı</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="exportMaintenanceCSV()">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV İndir
          </button>
          <button class="btn btn-secondary btn-sm" onclick="printMaintenanceReport()">
            <svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            PDF Rapor
          </button>
          ${canEdit() ? `
          <button class="btn btn-primary" onclick="showNewMaintModal()">
            <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni Bakım Kaydı
          </button>
          ` : ''}
        </div>
      </div>
      ${contextMachine ? `<div class="context-filter-chip"><span>${escapeHTML(contextMachine.numarasi)} tezgâhı filtrelendi</span><button type="button" id="maint-clear-machine-context" aria-label="Tezgâh filtresini temizle">×</button></div>` : ''}
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:300px">
          <label class="sr-only" for="maint-search">Bakım kayıtlarında ara</label>
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="maint-search" placeholder="Usta veya açıklama ara..." />
        </div>
        <label class="sr-only" for="maint-mach-filter">Tezgâh filtresi</label><select id="maint-mach-filter" style="width:180px">
          <option value="">Tüm Tezgahlar</option>
          ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
        </select>
        <label class="sr-only" for="maint-status-filter">Bakım durumu filtresi</label><select id="maint-status-filter" style="width:150px">
          <option value="">Tüm Durumlar</option>
          <option>Tamamlandı</option>
          <option>Beklemede</option>
          <option>Devam Ediyor</option>
        </select>
      </div>
    </div>
    <div class="page-body" style="padding:0">
      <div style="overflow-y:auto; flex:1">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Tezgah</th>
              <th>Bakım Yapan</th>
              <th>Açıklama</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody id="maint-tbody"></tbody>
        </table>
        <div id="maint-pager" class="flex justify-between items-center" style="padding:10px 16px;border-top:1px solid var(--border)"></div>
      </div>
    </div>
  `;

  if (contextMachine) page.querySelector('#maint-mach-filter').value = String(contextMachine.id);
  filterMaintenances(page);

  page.querySelector('#maint-search').addEventListener('input', () => filterMaintenances(page));
  page.querySelector('#maint-mach-filter').addEventListener('change', () => filterMaintenances(page));
  page.querySelector('#maint-status-filter').addEventListener('change', () => filterMaintenances(page));
  page.querySelector('#maint-clear-machine-context')?.addEventListener('click', event => { page.querySelector('#maint-mach-filter').value=''; event.currentTarget.closest('.context-filter-chip')?.remove(); filterMaintenances(page); });

  return page;
}

function filterMaintenances(page) {
  const q = page.querySelector('#maint-search').value.toLowerCase();
  const machId = page.querySelector('#maint-mach-filter').value;
  const status = page.querySelector('#maint-status-filter').value;

  const filtered = State.maintenances.filter(m =>
    !m.deletedAt &&
    (!q || m.bakim_yapan.toLowerCase().includes(q) || m.aciklama.toLowerCase().includes(q)) &&
    (!machId || m.tezgah_id === parseInt(machId)) &&
    (!status || m.durum === status)
  );
  renderMaintTable(filtered, page);
}

function renderMaintTable(list, page) {
  const tbody = page.querySelector('#maint-tbody');
  if (!list.length) {
    const filtered = State.maintenances.length > 0;
    tbody.innerHTML = window.MTBUX.emptyTableRow({ colspan: 6, icon: '✓',
      title: filtered ? 'Bu filtrelerde bakım kaydı yok' : 'Henüz bakım kaydı oluşturulmadı',
      description: filtered ? 'Tezgâh, durum veya arama filtresini temizleyerek diğer kayıtları görüntüleyin.' : 'Yapılan işlemleri, teknisyeni ve bakım sonucunu kayıt altına alarak geçmişi oluşturmaya başlayın.',
      actionLabel: filtered ? 'Filtreleri temizle' : (canEdit() ? 'İlk bakım kaydını oluştur' : ''),
      command: filtered ? 'clear-filters' : 'new-maintenance' });
    const pager = page.querySelector('#maint-pager');
    if (pager) pager.innerHTML = '';
    return;
  }
  
  // Sort by date (latest first) or id
  const sorted = [...list].sort((a, b) => b.id - a.id);
  const requestedPage = Number(page.querySelector('#maint-pager')?.dataset.page || 1);
  const pager = window.MTBPerformance?.pagerModel?.(sorted, requestedPage, 50) || { items: sorted, page: 1, total: sorted.length, totalPages: 1, first: sorted.length ? 1 : 0, last: sorted.length, hasPrevious: false, hasNext: false };
  
  tbody.innerHTML = pager.items.map(m => {
    const mach = State.machines.find(x => x.id === m.tezgah_id);
    const machName = mach ? mach.numarasi : `Tezgah #${m.tezgah_id}`;
    const statusClass = m.durum === 'Tamamlandı' ? 'tag-green' : m.durum === 'Devam Ediyor' ? 'tag-blue' : 'tag-amber';
    return `
      <tr>
        <td><span class="font-mono text-sm" style="color:var(--text-secondary)">${escapeHTML(m.tarih)}</span></td>
        <td><strong style="color:var(--text-accent)">${escapeHTML(machName)}</strong></td>
        <td><span style="font-size:12.5px; font-weight:500">${escapeHTML(m.bakim_yapan)}</span></td>
        <td><div style="font-size:12px; max-width:400px; white-space:normal; line-height:1.5">${escapeHTML(m.aciklama)}</div></td>
        <td><span class="tag ${statusClass}">${escapeHTML(m.durum)}</span></td>
        <td>
          ${canDelete() ? `
          <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteMaint(${m.id})" title="Sil" style="color:var(--red)">
            ✕
          </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
  const pagerEl = page.querySelector('#maint-pager');
  if (pagerEl) {
    pagerEl.dataset.page = String(pager.page);
    pagerEl.innerHTML = `<span style="font-size:11px;color:var(--text-muted)">${pager.first}-${pager.last} / ${pager.total}</span><div class="flex gap-1"><button class="btn btn-ghost btn-sm" data-page-prev ${pager.hasPrevious ? '' : 'disabled'}>Ã–nceki</button><span style="font-size:11px;padding:6px">${pager.page} / ${pager.totalPages}</span><button class="btn btn-ghost btn-sm" data-page-next ${pager.hasNext ? '' : 'disabled'}>Sonraki</button></div>`;
    pagerEl.querySelector('[data-page-prev]')?.addEventListener('click', () => { pagerEl.dataset.page = String(pager.page - 1); renderMaintTable(list, page); });
    pagerEl.querySelector('[data-page-next]')?.addEventListener('click', () => { pagerEl.dataset.page = String(pager.page + 1); renderMaintTable(list, page); });
  }
}

window.showNewMaintModal = function() {
  showModal('new-maint', `
    <div class="modal-header">
      <span class="modal-title">Yeni Bakım Kaydı Ekle</span>
      <button class="modal-close" onclick="closeModal('new-maint')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Tezgah *</label>
      <select class="form-control" id="nm-maint-mach">
        ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Tarih (GG.AA.YYYY) *</label>
        <input class="form-control" id="nm-maint-tarih" value="${getTodayFormat()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Usta / Bakımcı *</label>
        <input class="form-control" id="nm-maint-yapan" placeholder="ör. Mehmet Özer" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Yapılan Bakım / Açıklama *</label>
      <textarea class="form-control" id="nm-maint-desc" rows="4" placeholder="Gerçekleştirilen işlemleri detaylandırın..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Durum</label>
      <select class="form-control" id="nm-maint-status">
        <option>Tamamlandı</option>
        <option>Beklemede</option>
        <option>Devam Ediyor</option>
      </select>
    </div>
    <fieldset class="form-group" id="nm-maint-evidence"><legend class="form-label">Tamamlama kanıtları</legend>
      <label><input type="checkbox" id="nm-maint-safe" /> Güvenli çalışma ön koşulları doğrulandı</label><br>
      <label><input type="checkbox" id="nm-maint-result" /> Yapılan işlem ve sonuç açıklamaya yazıldı</label><br>
      <label><input type="checkbox" id="nm-maint-observed" /> Alarm/durum sonucu gözlemlendi</label>
      <div class="form-hint">“Tamamlandı” seçildiğinde bu kanıtlar zorunludur. Eski kayıtlar değişmeden kalır.</div>
    </fieldset>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-maint')">İptal</button>
      <button class="btn btn-primary" onclick="createNewMaint()">Kaydı Kaydet</button>
    </div>
  `);
};

window.createNewMaint = async function() {
  if (!canEdit()) { showToast('Bakım kaydı ekleme yetkiniz yok', 'error'); return; }
  const tezgah_id = parseInt(document.getElementById('nm-maint-mach').value);
  const tarih = document.getElementById('nm-maint-tarih').value.trim();
  const bakim_yapan = document.getElementById('nm-maint-yapan').value.trim();
  const aciklama = document.getElementById('nm-maint-desc').value.trim();
  const durum = document.getElementById('nm-maint-status').value;
  const evidence = {
    safetyVerified: Boolean(document.getElementById('nm-maint-safe')?.checked),
    resultDocumented: Boolean(document.getElementById('nm-maint-result')?.checked),
    outcomeObserved: Boolean(document.getElementById('nm-maint-observed')?.checked),
    completedAt: durum === 'Tamamlandı' ? new Date().toISOString() : null
  };

  if (!tarih || !bakim_yapan || !aciklama) {
    showToast('Tarih, usta ve açıklama girmek zorunludur.', 'error');
    return;
  }

  if (durum === 'Tamamlandı' && (!evidence.safetyVerified || !evidence.resultDocumented || !evidence.outcomeObserved)) {
    showToast('Bakımı tamamlamak için güvenlik, işlem sonucu ve gözlem kanıtlarını doğrulayın.', 'error');
    return;
  }
  const newMaint = window.MTBRecordRepository.create(State.maintenances, { tezgah_id, tarih, bakim_yapan, aciklama, durum, completionEvidence: evidence }, State.currentUser);
  State.maintenances.push(newMaint);
  await saveMaintenances();
  closeModal('new-maint');
  showToast('Bakım kaydı başarıyla oluşturuldu!', 'success');
  navigate('maintenance');
};

window.deleteMaint = async function(id) {
  if (!canDelete()) { showToast('Bakım kaydı silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu bakım kaydını silmek istediğinize emin misiniz?')) return;
  State.maintenances = window.MTBRecordRepository.archiveById(State.maintenances, id, State.currentUser).records;
  await saveMaintenances();
  showToast('Bakım kaydı silindi.', 'success');
  navigate('maintenance');
};

// ════════════════════════════════════════════════════════════════
//  PİL TAKİBİ
// ════════════════════════════════════════════════════════════════
window.CurrentBatteryTab = 'battery';

function renderBattery(extraData = null) {
  const page = createPage('battery');
  const contextMachine = State.machines.find(machine => Number(machine.id) === Number(extraData?.machineId));
  const requestedTab = extraData?.tab === 'fan' ? 'fan' : (extraData?.tab === 'battery' ? 'battery' : window.CurrentBatteryTab);
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>🔋 Pil & Sürücü Fan Ömrü Takip Paneli (Lifecycle Calculator)</h1>
          <p>FANUC Absolute Enkoder Pil Voltajları, Geri Sayım Sayacı ve Sürücü Fan Ömrü Takip Sihirbazı</p>
        </div>
        ${canEdit() ? `
        <div class="flex gap-2">
          <button class="btn btn-primary" id="btn-add-battery" onclick="showNewBattModal()">
            <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Pil Değişimi Kaydet
          </button>
          <button class="btn btn-primary" id="btn-add-fan" onclick="showNewFanModal()" style="display:none">
            <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni Fan Takibi Ekle
          </button>
        </div>
        ` : ''}
      </div>

      ${contextMachine ? `<div class="context-filter-chip"><span>${escapeHTML(contextMachine.numarasi)} tezgâhı filtrelendi</span><button type="button" id="lifecycle-clear-machine-context" aria-label="Tezgâh filtresini temizle">×</button></div>` : ''}

      <!-- Lifecycle Summary KPI Cards -->
      <div class="stats-grid mt-3 mb-1" style="grid-template-columns: repeat(4, 1fr); gap:12px">
        <div class="stat-card blue" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-batt-avg-days" style="color:#60a5fa; font-size:22px">0 Gün</div>
            <div class="stat-label">Ortalama Kalan Pil Ömrü</div>
          </div>
        </div>
        <div class="stat-card amber" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-batt-warning" style="color:#fbbf24; font-size:22px">0</div>
            <div class="stat-label">Değişimi Yaklaşan (< 60 Gün)</div>
          </div>
        </div>
        <div class="stat-card red" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-batt-critical" style="color:#f87171; font-size:22px">0</div>
            <div class="stat-label">Kritik / Süresi Dolan</div>
          </div>
        </div>
        <div class="stat-card green" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-fan-critical" style="color:#34d399; font-size:22px">0</div>
            <div class="stat-label">Bakım Zamanı Gelen Fan</div>
          </div>
        </div>
      </div>
      
      <!-- Tabs Selector -->
      <div class="flex gap-2 mt-3" style="border-bottom: 1px solid var(--border); padding-bottom: 8px">
        <button class="btn btn-ghost" id="btn-tab-battery" onclick="switchBatteryTab('battery')" style="font-weight:700; color:var(--text-accent); border-bottom:2px solid var(--text-accent); border-radius:0">🔋 Enkoder Pilleri</button>
        <button class="btn btn-ghost" id="btn-tab-fan" onclick="switchBatteryTab('fan')" style="font-weight:700; border-radius:0">🌀 Sürücü & Kabin Fanları</button>
      </div>

      <!-- Battery Filters -->
      <div class="flex gap-2 mt-3" id="battery-filters" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="batt-search" placeholder="Eksen veya pil tipi ara..." />
        </div>
        <select id="batt-mach-filter" style="width:180px">
          <option value="">Tüm Tezgahlar</option>
          ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
        </select>
        <select id="batt-status-filter" style="width:150px">
          <option value="">Tüm Durumlar</option>
          <option value="normal">Normal (Güvenli)</option>
          <option value="warning">Uyarı (Yaklaştı)</option>
          <option value="critical">Kritik (Süresi Geçti)</option>
        </select>
      </div>

      <!-- Fan Filters -->
      <div class="flex gap-2 mt-3" id="fan-filters" style="flex-wrap:wrap; display:none">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="fan-search" placeholder="Konum veya fan tipi ara..." />
        </div>
        <select id="fan-mach-filter" style="width:180px">
          <option value="">Tüm Tezgahlar</option>
          ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
        </select>
        <select id="fan-status-filter" style="width:150px">
          <option value="">Tüm Durumlar</option>
          <option value="normal">Normal (Güvenli)</option>
          <option value="warning">Uyarı (Bakım Yakın)</option>
          <option value="critical">Kritik (Limit Aşımı)</option>
        </select>
      </div>
    </div>

    <div class="page-body" style="padding:0">
      <!-- Battery Tab Container -->
      <div style="overflow-y:auto; flex:1" id="tab-container-battery">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tezgah</th>
              <th>Eksen</th>
              <th>Pil Modeli</th>
              <th>Voltaj</th>
              <th>Son Değişim</th>
              <th>Düşük Pil Alarmı</th>
              <th>Değişimi Yapan</th>
              <th>Kalan Gün</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody id="batt-tbody"></tbody>
        </table>
      </div>

      <!-- Fan Tab Container -->
      <div style="overflow-y:auto; flex:1; display:none" id="tab-container-fan">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tezgah</th>
              <th>Konum / Fan Tipi</th>
              <th>Çalışma Saati</th>
              <th>Kalan Ömür (Sa)</th>
              <th>Son Bakım Yapan</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody id="fan-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  if (contextMachine) {
    page.querySelector('#batt-mach-filter').value = String(contextMachine.id);
    page.querySelector('#fan-mach-filter').value = String(contextMachine.id);
  }
  filterBatteries(page);
  filterFans(page);

  // Restore current tab visual state
  if (requestedTab === 'fan') {
    setTimeout(() => {
      window.switchBatteryTab('fan');
    }, 10);
  }

  // Hook filters
  page.querySelector('#batt-search').addEventListener('input', () => filterBatteries(page));
  page.querySelector('#batt-mach-filter').addEventListener('change', () => filterBatteries(page));
  page.querySelector('#batt-status-filter').addEventListener('change', () => filterBatteries(page));

  page.querySelector('#fan-search').addEventListener('input', () => filterFans(page));
  page.querySelector('#fan-mach-filter').addEventListener('change', () => filterFans(page));
  page.querySelector('#fan-status-filter').addEventListener('change', () => filterFans(page));
  page.querySelector('#lifecycle-clear-machine-context')?.addEventListener('click', event => {
    page.querySelector('#batt-mach-filter').value = '';
    page.querySelector('#fan-mach-filter').value = '';
    event.currentTarget.closest('.context-filter-chip')?.remove();
    filterBatteries(page);
    filterFans(page);
  });

  return page;
}

window.switchBatteryTab = function(tab) {
  window.CurrentBatteryTab = tab;
  const isBatt = tab === 'battery';

  // Toggle buttons
  const btnAddBatt = document.getElementById('btn-add-battery');
  const btnAddFan = document.getElementById('btn-add-fan');
  if (btnAddBatt) btnAddBatt.style.display = isBatt ? 'block' : 'none';
  if (btnAddFan) btnAddFan.style.display = isBatt ? 'none' : 'block';

  // Toggle tab buttons visual styles
  const tabBatt = document.getElementById('btn-tab-battery');
  const tabFan = document.getElementById('btn-tab-fan');
  if (tabBatt) {
    tabBatt.style.color = isBatt ? 'var(--text-accent)' : 'var(--text-secondary)';
    tabBatt.style.borderBottom = isBatt ? '2px solid var(--text-accent)' : 'none';
  }
  if (tabFan) {
    tabFan.style.color = !isBatt ? 'var(--text-accent)' : 'var(--text-secondary)';
    tabFan.style.borderBottom = !isBatt ? '2px solid var(--text-accent)' : 'none';
  }

  // Toggle filter divs
  const filtersBatt = document.getElementById('battery-filters');
  const filtersFan = document.getElementById('fan-filters');
  if (filtersBatt) filtersBatt.style.display = isBatt ? 'flex' : 'none';
  if (filtersFan) filtersFan.style.display = isBatt ? 'none' : 'flex';

  // Toggle containers
  const containerBatt = document.getElementById('tab-container-battery');
  const containerFan = document.getElementById('tab-container-fan');
  if (containerBatt) containerBatt.style.display = isBatt ? 'block' : 'none';
  if (containerFan) containerFan.style.display = isBatt ? 'none' : 'block';
};

function filterBatteries(page) {
  const q = page.querySelector('#batt-search').value.toLowerCase();
  const machId = page.querySelector('#batt-mach-filter').value;
  const statusFilter = page.querySelector('#batt-status-filter').value;

  const filtered = State.batteries.filter(b => {
    if (b.deletedAt) return false;
    const textMatch = !q || b.eksen.toLowerCase().includes(q) || b.pil_modeli.toLowerCase().includes(q);
    const machMatch = !machId || b.tezgah_id === parseInt(machId);
    
    const stat = getBatteryStatus(b.tarih);
    let statMatch = true;
    if (statusFilter === 'normal') statMatch = stat.class === 'tag-green';
    else if (statusFilter === 'warning') statMatch = stat.class === 'tag-amber';
    else if (statusFilter === 'critical') statMatch = stat.class === 'tag-red';

    return textMatch && machMatch && statMatch;
  });
  
  renderBatteryTable(filtered, page);
}

function filterFans(page) {
  const q = page.querySelector('#fan-search').value.toLowerCase();
  const machId = page.querySelector('#fan-mach-filter').value;
  const statusFilter = page.querySelector('#fan-status-filter').value;

  const filtered = State.fans.filter(f => {
    if (f.deletedAt) return false;
    const textMatch = !q || f.konum.toLowerCase().includes(q) || (f.bakim_yapan && f.bakim_yapan.toLowerCase().includes(q));
    const machMatch = !machId || f.tezgah_id === parseInt(machId);
    
    const lifeLeft = 20000 - f.calisma_saati;
    let statClass = 'tag-green';
    if (lifeLeft < 0) statClass = 'tag-red';
    else if (lifeLeft < 5000) statClass = 'tag-amber';

    let statMatch = true;
    if (statusFilter === 'normal') statMatch = statClass === 'tag-green';
    else if (statusFilter === 'warning') statMatch = statClass === 'tag-amber';
    else if (statusFilter === 'critical') statMatch = statClass === 'tag-red';

    return textMatch && machMatch && statMatch;
  });

  renderFanTable(filtered, page);
}

function renderBatteryTable(list, page) {
  const tbody = page.querySelector('#batt-tbody');
  if (!tbody) return;
  if (!list.length) {
    const filtered = State.batteries.length > 0;
    tbody.innerHTML = window.MTBUX.emptyTableRow({ colspan: 10, icon: '▰',
      title: filtered ? 'Bu filtrelerde pil kaydı yok' : 'Henüz pil değişimi kaydedilmedi',
      description: filtered ? 'Tezgâh, durum veya arama filtresini temizleyerek diğer pilleri görüntüleyin.' : 'Enkoder pilinin değişim tarihini kaydedin; kalan ömür ve kritik eşikler otomatik hesaplansın.',
      actionLabel: filtered ? 'Filtreleri temizle' : (canEdit() ? 'Pil değişimi kaydet' : ''),
      command: filtered ? 'clear-filters' : 'new-battery' });
    return;
  }

  tbody.innerHTML = list.map(b => {
    const mach = State.machines.find(x => x.id === b.tezgah_id);
    const machName = mach ? mach.numarasi : `Tezgah #${b.tezgah_id}`;
    const stat = getBatteryStatus(b.tarih);
    const deg = window.calculateDegradation ? window.calculateDegradation(b, 'battery') : { percentRemaining: 100, daysRemaining: stat.daysLeft, color: 'var(--green)' };
    const remainingDays = deg.daysRemaining;
    const alarm = getLowBatteryAlarmStatus(b.low_battery_alarm_date || b.lowBatteryAlarmDate);

    let volt = 3.6;
    if (remainingDays < 0) {
      volt = 2.4;
    } else if (remainingDays < 30) {
      volt = 2.9;
    } else if (remainingDays < 90) {
      volt = 3.2;
    }

    const statusColor = deg.color;

    return `
      <tr>
        <td><strong style="color:var(--text-accent)">${escapeHTML(machName)}</strong></td>
        <td><span style="font-weight:600">${escapeHTML(b.eksen)}</span></td>
        <td><span class="tag tag-gray">${escapeHTML(b.pil_modeli)}</span></td>
        <td><span class="font-mono" style="font-weight:700; color:${statusColor}">⚡ ${volt.toFixed(1)}V</span></td>
        <td><span class="font-mono text-sm">${escapeHTML(b.tarih)}</span></td>
        <td>${alarm.active ? `<div><span class="tag ${alarm.class}">${escapeHTML(alarm.label)}</span><div class="text-xs" style="margin-top:4px;color:var(--text-muted)">${escapeHTML(alarm.deadlineLabel)}</div><div class="text-xs" style="margin-top:3px;color:${b.backup_verified || b.backupVerified ? 'var(--green)' : 'var(--red)'}">${b.backup_verified || b.backupVerified ? 'Yedek doğrulandı' : 'Önce yedek doğrulanmalı'}</div></div>` : '<span class="text-xs" style="color:var(--text-muted)">Alarm kaydı yok</span>'}</td>
        <td><span>${escapeHTML(b.bakim_yapan)}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:6px">
            <span class="font-mono" style="font-weight:700; color:${deg.color}; font-size:12px">%${deg.percentRemaining}</span>
            <span class="font-mono text-xs" style="color:var(--text-muted)">(${deg.daysRemaining} Gün)</span>
          </div>
          <div class="lifecycle-timeline" style="width:180px;--life-percent:${Math.max(0, Math.min(100, 100 - deg.percentRemaining))}%;--life-color:${deg.color}"><div class="lifecycle-track"><div class="lifecycle-fill"></div></div><div class="lifecycle-marker"></div><div class="lifecycle-labels"><span>Değişim</span><span>Bugün</span><span>Limit</span></div></div>
        </td>
        <td><span class="tag ${stat.class}">${escapeHTML(stat.label.split(' ')[0])}</span></td>

        <td>
          <div style="display:flex; gap:6px; align-items:center">
            ${canEdit() ? `
            <button class="btn btn-ghost btn-sm" onclick="resetBatteryLife(${b.id})" style="color:var(--green); font-size:11px; padding:2px 8px; border:1px solid var(--green)">
              🔄 Değiştir
            </button>
            ` : ''}
            ${canDelete() ? `
            <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteBattery(${b.id})" title="Sil" style="color:var(--red)">
              ✕
            </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderFanTable(list, page) {
  const tbody = page.querySelector('#fan-tbody');
  if (!tbody) return;
  if (!list.length) {
    const filtered = State.fans.length > 0;
    tbody.innerHTML = window.MTBUX.emptyTableRow({ colspan: 7, icon: '✣',
      title: filtered ? 'Bu filtrelerde fan kaydı yok' : 'Henüz fan takibi başlatılmadı',
      description: filtered ? 'Tezgâh, durum veya arama filtresini temizleyerek diğer fanları görüntüleyin.' : 'Sürücü ve kabin fanlarının çalışma saatlerini kaydedin; yaklaşan bakım zamanını takip edin.',
      actionLabel: filtered ? 'Filtreleri temizle' : (canEdit() ? 'İlk fanı takibe al' : ''),
      command: filtered ? 'clear-filters' : 'new-fan' });
    return;
  }

  tbody.innerHTML = list.map(f => {
    const mach = State.machines.find(x => x.id === f.tezgah_id);
    const machName = mach ? mach.numarasi : `Tezgah #${f.tezgah_id}`;
    const lifeLeft = 20000 - f.calisma_saati;
    
    let statusLabel = 'Normal';
    let statusClass = 'tag-green';
    if (lifeLeft < 0) {
      statusLabel = 'Limit Aşımı';
      statusClass = 'tag-red';
    } else if (lifeLeft < 5000) {
      statusLabel = 'Bakım Yakın';
      statusClass = 'tag-amber';
    }

    const statusColor = lifeLeft < 0 ? 'var(--red)' : lifeLeft < 5000 ? 'var(--amber)' : 'var(--green)';

    return `
      <tr>
        <td><strong style="color:var(--text-accent)">${escapeHTML(machName)}</strong></td>
        <td><span style="font-weight:600">${escapeHTML(f.konum)}</span></td>
        <td><span class="font-mono">${f.calisma_saati.toLocaleString('tr-TR')} Sa</span></td>
        <td>
          <span class="font-mono" style="font-weight:600; color:${statusColor}">${lifeLeft.toLocaleString('tr-TR')} Sa</span>
          <div class="lifecycle-timeline" style="width:180px;--life-percent:${Math.max(0, Math.min(100, (f.calisma_saati / 20000) * 100))}%;--life-color:${statusColor}"><div class="lifecycle-track"><div class="lifecycle-fill"></div></div><div class="lifecycle-marker"></div><div class="lifecycle-labels"><span>0 saat</span><span>Bugün</span><span>20.000</span></div></div>
        </td>
        <td><span>${escapeHTML(f.bakim_yapan || '—')}</span></td>
        <td><span class="tag ${statusClass}">${escapeHTML(statusLabel)}</span></td>
        <td>
          <div style="display:flex; gap:6px; align-items:center">
            ${canEdit() ? `
            <button class="btn btn-ghost btn-sm" onclick="resetFanHours(${f.id})" style="color:var(--green); font-size:11px; padding:2px 8px; border:1px solid var(--green)">
              🔄 Sıfırla
            </button>
            ` : ''}
            ${canDelete() ? `
            <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteFan(${f.id})" title="Sil" style="color:var(--red)">
              ✕
            </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getBatteryStatus(dateStr) {
  if (!dateStr) return { label: 'Bilinmiyor', class: 'tag-gray', daysLeft: 0 };
  
  const date = parseDateHelper(dateStr);
  if (!date || date.getTime() === 0) return { label: 'Geçersiz', class: 'tag-gray', daysLeft: 0 };
  
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = todayStart.getTime() - dateStart.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const daysLeft = 365 - diffDays;
  
  if (daysLeft < 0) {
    return { label: `Kritik (${Math.abs(daysLeft)} gün geçti)`, class: 'tag-red', daysLeft };
  } else if (daysLeft < 30) {
    return { label: `Uyarı (${daysLeft} gün kaldı)`, class: 'tag-amber', daysLeft };
  } else {
    return { label: `Normal (${daysLeft} gün kaldı)`, class: 'tag-green', daysLeft };
  }
}

function getLowBatteryAlarmStatus(dateStr) {
  if (!dateStr) return { active: false, label: 'Alarm kaydı yok', class: 'tag-gray', deadlineLabel: '' };
  const alarmDate = parseDateHelper(dateStr);
  if (!alarmDate || alarmDate.getTime() === 0) return { active: true, label: 'Geçersiz alarm tarihi', class: 'tag-gray', deadlineLabel: '' };
  const start = new Date(alarmDate.getFullYear(), alarmDate.getMonth(), alarmDate.getDate());
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() + 7);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  const deadlineLabel = `Son tarih: ${String(deadline.getDate()).padStart(2, '0')}.${String(deadline.getMonth() + 1).padStart(2, '0')}.${deadline.getFullYear()}`;
  if (days < 0) return { active: true, label: `${Math.abs(days)} gün gecikti`, class: 'tag-red', deadlineLabel };
  if (days === 0) return { active: true, label: 'Son gün', class: 'tag-red', deadlineLabel };
  return { active: true, label: `${days} gün kaldı`, class: days <= 2 ? 'tag-amber' : 'tag-blue', deadlineLabel };
}

window.showNewBattModal = function() {
  showModal('new-batt', `
    <div class="modal-header">
      <span class="modal-title">Pil Değişimi Kaydet</span>
      <button class="modal-close" onclick="closeModal('new-batt')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Tezgah *</label>
      <select class="form-control" id="nm-batt-mach">
        ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Eksen (ör. X, Y, Z, Spindle) *</label>
        <input class="form-control" id="nm-batt-eksen" placeholder="X, Y, Z" />
      </div>
      <div class="form-group">
        <label class="form-label">Pil Modeli / Tipi *</label>
        <input class="form-control" id="nm-batt-model" placeholder="ör. 6V Lithium, D-Size" value="6V Lithium" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Değişim Tarihi (GG.AA.YYYY) *</label>
        <input class="form-control" id="nm-batt-tarih" value="${getTodayFormat()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Teknisyen *</label>
        <input class="form-control" id="nm-batt-yapan" placeholder="ör. Mehmet Özer" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Düşük pil alarm tarihi (isteğe bağlı)</label>
        <input class="form-control" id="nm-batt-alarm-date" placeholder="GG.AA.YYYY" />
        <div class="form-hint">Alarm kaydedilirse 7 günlük değişim son tarihi otomatik izlenir.</div>
      </div>
      <div class="form-group">
        <label class="form-label">Yedekleme ön koşulu</label>
        <label style="display:flex;align-items:center;gap:8px;margin-top:9px"><input type="checkbox" id="nm-batt-backup-verified" /> Güncel CNC/absolute konum yedeği doğrulandı</label>
      </div>
    </div>
    <fieldset class="form-group"><legend class="form-label">Pil değişimi kanıtları</legend>
      <label><input type="checkbox" id="nm-batt-alarm-recorded" /> Alarm kodu/durumu kaydedildi veya alarm olmadığı doğrulandı</label><br>
      <label><input type="checkbox" id="nm-batt-location-verified" /> Pil konumu ve doğru model doğrulandı</label><br>
      <label><input type="checkbox" id="nm-batt-alarm-cleared" /> Değişim sonrası alarmın kapandığı gözlemlendi</label><br>
      <label><input type="checkbox" id="nm-batt-reference-observed" /> Absolute konum/referans durumu gözlemlendi</label>
    </fieldset>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-batt')">İptal</button>
      <button class="btn btn-primary" onclick="createNewBattery()">Pil Değişimini Kaydet</button>
    </div>
  `);
};

window.createNewBattery = async function() {
  if (!canEdit()) { showToast('Pil kaydı ekleme yetkiniz yok', 'error'); return; }
  const tezgah_id = parseInt(document.getElementById('nm-batt-mach').value);
  const eksen = document.getElementById('nm-batt-eksen').value.trim();
  const pil_modeli = document.getElementById('nm-batt-model').value.trim();
  const tarih = document.getElementById('nm-batt-tarih').value.trim();
  const bakim_yapan = document.getElementById('nm-batt-yapan').value.trim();
  const low_battery_alarm_date = document.getElementById('nm-batt-alarm-date').value.trim();
  const backup_verified = document.getElementById('nm-batt-backup-verified').checked;
  const evidence = {
    backupVerified: backup_verified,
    alarmRecorded: Boolean(document.getElementById('nm-batt-alarm-recorded')?.checked),
    locationVerified: Boolean(document.getElementById('nm-batt-location-verified')?.checked),
    replacementDate: tarih,
    alarmCleared: Boolean(document.getElementById('nm-batt-alarm-cleared')?.checked),
    referenceObserved: Boolean(document.getElementById('nm-batt-reference-observed')?.checked)
  };

  if (!eksen || !pil_modeli || !tarih || !bakim_yapan) {
    showToast('Tüm alanları doldurmak zorunludur.', 'error');
    return;
  }

  if (low_battery_alarm_date && !backup_verified) {
    showToast('Düşük pil alarmı kaydında önce güncel yedeğin doğrulanması gerekir.', 'error');
    return;
  }

  if (!Object.values(evidence).every(Boolean)) {
    showToast('Pil değişimini kapatmak için yedek, alarm, konum, tarih ve referans kanıtlarını doğrulayın.', 'error');
    return;
  }
  const newBatt = window.MTBRecordRepository.create(State.batteries, { tezgah_id, eksen, pil_modeli, tarih, bakim_yapan, low_battery_alarm_date, backup_verified, completionEvidence: evidence }, State.currentUser);
  State.batteries.push(newBatt);
  await saveBatteries();
  closeModal('new-batt');
  showToast('Pil değişim kaydı başarıyla eklendi!', 'success');
  navigate('battery');
};

window.resetBatteryLife = async function(id) {
  if (!canEdit()) { showToast('Pil değiştirme yetkiniz yok', 'error'); return; }
  const batt = State.batteries.find(b => b.id == id);
  if (!batt) return;
  
  showPromptModal('Pil Değişimi Onayı', batt.bakim_yapan || '', async (tech) => {
    const todayStr = getTodayFormat();
    Object.assign(batt, window.MTBRecordRepository.update(batt, { tarih: todayStr, bakim_yapan: tech.toUpperCase(), low_battery_alarm_date: '', backup_verified: true }, State.currentUser));
    await saveBatteries();

    // Log in Maintenance Book!
    const newMaint = window.MTBRecordRepository.create(State.maintenances, {
      tezgah_id: batt.tezgah_id,
      tarih: todayStr,
      bakim_yapan: tech.toUpperCase(),
      aciklama: `[PM] ${batt.eksen} ekseni absolute enkoder pili değiştirildi (Voltaj 3.6V düzeyine resetlendi).`,
      durum: 'Tamamlandı'
    }, State.currentUser);
    State.maintenances.push(newMaint);
    await saveMaintenances();

    showToast('Enkoder pili başarıyla güncellendi ve bakım defterine işlendi!', 'success');
    navigate('battery');
  });
};

window.deleteBattery = async function(id) {
  if (!canDelete()) { showToast('Pil kaydı silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu pil değişim kaydını silmek istediğinize emin misiniz?')) return;
  State.batteries = window.MTBRecordRepository.archiveById(State.batteries, id, State.currentUser).records;
  await saveBatteries();
  showToast('Pil değişim kaydı silindi.', 'success');
  navigate('battery');
};

window.showNewFanModal = function() {
  showModal('new-fan', `
    <div class="modal-header">
      <span class="modal-title">Yeni Fan Takibi Ekle</span>
      <button class="modal-close" onclick="closeModal('new-fan')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Tezgah *</label>
      <select class="form-control" id="nm-fan-mach">
        ${getSortedMachines().map(m => `<option value="${m.id}">${escapeHTML(m.numarasi)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Konum / Fan Tipi *</label>
        <input class="form-control" id="nm-fan-konum" placeholder="ör. SVM Fanı, Kabin Emiş Fanı" />
      </div>
      <div class="form-group">
        <label class="form-label">Başlangıç Çalışma Saati *</label>
        <input class="form-control" id="nm-fan-hours" type="number" value="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Teknisyen *</label>
      <input class="form-control" id="nm-fan-yapan" placeholder="ör. AHMET MERT ÖZER" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-fan')">İptal</button>
      <button class="btn btn-primary" onclick="createNewFan()">Fan Takibini Kaydet</button>
    </div>
  `);
};

window.createNewFan = async function() {
  if (!canEdit()) { showToast('Fan kaydı ekleme yetkiniz yok', 'error'); return; }
  const tezgah_id = parseInt(document.getElementById('nm-fan-mach').value);
  const konum = document.getElementById('nm-fan-konum').value.trim();
  const calisma_saati = parseInt(document.getElementById('nm-fan-hours').value);
  const bakim_yapan = document.getElementById('nm-fan-yapan').value.trim();

  if (!konum || isNaN(calisma_saati) || !bakim_yapan) {
    showToast('Tüm alanları doldurmak zorunludur.', 'error');
    return;
  }

  const newFan = window.MTBRecordRepository.create(State.fans, { tezgah_id, konum, calisma_saati, bakim_yapan: bakim_yapan.toUpperCase() }, State.currentUser);
  State.fans.push(newFan);
  await saveFans();
  closeModal('new-fan');
  showToast('Yeni fan takip kaydı başarıyla eklendi!', 'success');
  navigate('battery');
};

window.resetFanHours = async function(id) {
  if (!canEdit()) { showToast('Fan sıfırlama yetkiniz yok', 'error'); return; }
  const fan = State.fans.find(f => f.id == id);
  if (!fan) return;
  
  showPromptModal('Fan Ömrü Sıfırlama Onayı', fan.bakim_yapan || '', async (tech) => {
    Object.assign(fan, window.MTBRecordRepository.update(fan, { calisma_saati: 0, bakim_yapan: tech.toUpperCase() }, State.currentUser));
    await saveFans();
    
    const newMaint = window.MTBRecordRepository.create(State.maintenances, {
      tezgah_id: fan.tezgah_id,
      tarih: getTodayFormat(),
      bakim_yapan: tech.toUpperCase(),
      aciklama: `[PM] ${fan.konum} bakımı/değişimi yapıldı ve çalışma saati sıfırlandı.`,
      durum: 'Tamamlandı'
    }, State.currentUser);
    State.maintenances.push(newMaint);
    await saveMaintenances();

    showToast('Fan çalışma saati başarıyla sıfırlandı ve bakım defterine kaydedildi!', 'success');
    navigate('battery');
  });
};

window.deleteFan = async function(id) {
  if (!canDelete()) { showToast('Fan kaydı silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu fan takip kaydını silmek istediğinize emin misiniz?')) return;
  State.fans = window.MTBRecordRepository.archiveById(State.fans, id, State.currentUser).records;
  await saveFans();
  showToast('Fan takip kaydı silindi.', 'success');
  navigate('battery');
};



    api = { renderMaintenance, renderBattery, filterMaintenances, filterBatteries, filterFans, getBatteryStatus };
    return api;
  }

  global.MTBLifecycleFeature = Object.freeze({ initialize });
})(window);
