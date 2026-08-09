/**
 * NC/PMC Library
 * Extracted from renderer.js for modular architecture.
 */
(function(global) {
  'use strict';

function renderNcCodes() {
  const page = createPage('nc_codes');
  page.innerHTML = `
    <div class="page-header">
      <h1>🗂 G/M NC Kod Kütüphanesi</h1>
      <p>${State.nc_codes.length} standart NC kodu — Freze, Torna G-Kodları ve Genel M-Kodları</p>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:360px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="nc-search" placeholder="Kod veya tanım ara... (ör: G76, G02, M03)" />
        </div>
        <select id="nc-type-filter" style="width:200px">
          <option value="">Tüm Tipler</option>
          <option value="G-Milling">G-Kodları (Freze / MC)</option>
          <option value="G-Lathe">G-Kodları (Torna / Lathe)</option>
          <option value="M-Code">M-Kodları (Genel / Yardımcı)</option>
        </select>
      </div>
    </div>
    <div class="page-body" style="padding:0; overflow:auto">
      <table class="data-table" id="nc-table">
        <thead>
          <tr>
            <th>Kod</th>
            <th>Tip</th>
            <th>Adı</th>
            <th>Sözdizimi / Örnek</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody id="nc-tbody"></tbody>
      </table>
    </div>
  `;

  renderNcTable(State.nc_codes, page);
  page.querySelector('#nc-search').addEventListener('input', () => filterNc(page));
  page.querySelector('#nc-type-filter').addEventListener('change', () => filterNc(page));

  return page;
}

function filterNc(page) {
  const q = page.querySelector('#nc-search').value.toLowerCase();
  const type = page.querySelector('#nc-type-filter').value;
  const filtered = State.nc_codes.filter(n =>
    (!q || n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)) &&
    (!type || n.type === type)
  );
  renderNcTable(filtered, page);
}

function renderNcTable(codes, page) {
  const tbody = (page || document).querySelector('#nc-tbody');
  if (!tbody) return;
  if (!codes.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">NC kodu bulunamadı</td></tr>`;
    return;
  }
  const typeLabels = { 'G-Milling': 'G (Freze)', 'G-Lathe': 'G (Torna)', 'M-Code': 'M Kodu' };
  const typeTags   = { 'G-Milling': 'tag-blue', 'G-Lathe': 'tag-cyan', 'M-Code': 'tag-purple' };
  tbody.innerHTML = codes.map(n => `
    <tr style="cursor:pointer" onclick="showNcDetail('${n.code}')">
      <td><span class="font-mono" style="color:var(--text-accent); font-weight:600; font-size:13px">${n.code}</span></td>
      <td><span class="tag ${typeTags[n.type]||'tag-gray'}">${typeLabels[n.type]||n.type}</span></td>
      <td><span style="font-size:12px; font-weight:500">${n.name || ''}</span></td>
      <td><span class="font-mono text-sm" style="color:var(--text-secondary)">${n.syntax || '—'}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); showNcDetail('${n.code}')">Detay</button></td>
    </tr>
  `).join('');
}

window.showNcDetail = function(code) {
  const item = State.nc_codes.find(n => n.code === code);
  if (!item) return;
  const typeLabels = { 'G-Milling': 'G (Freze)', 'G-Lathe': 'G (Torna)', 'M-Code': 'M Kodu' };
  const typeTags   = { 'G-Milling': 'tag-blue', 'G-Lathe': 'tag-cyan', 'M-Code': 'tag-purple' };

  showModal('nc-detail', `
    <div class="modal-header">
      <span class="modal-title">NC Kodu <span class="font-mono" style="color:var(--text-accent)">${item.code}</span> — ${item.name || ''}</span>
      <button class="modal-close" onclick="closeModal('nc-detail')">✕</button>
    </div>
    <div class="flex gap-2 mb-3">
      <span class="tag ${typeTags[item.type]}">${typeLabels[item.type]}</span>
    </div>
    <div class="card mb-3">
      <div class="card-title mb-2">📋 Açıklama</div>
      <p style="font-size:12.5px; line-height:1.6; color:var(--text-secondary)">${item.description}</p>
    </div>
    <div class="card mb-3">
      <div class="card-title mb-2">💻 Sözdizimi / Örnek</div>
      <pre style="font-family:var(--font-mono); background:var(--bg-base); padding:8px; border-radius:4px; font-size:11.5px; overflow-x:auto; border:1px solid var(--border)">${item.syntax || '—'}</pre>
    </div>
    ${item.example ? `
      <div class="card mb-3">
        <div class="card-title mb-2">📝 Program Örneği</div>
        <pre style="font-family:var(--font-mono); background:var(--bg-base); padding:8px; border-radius:4px; font-size:11.5px; overflow-x:auto; border:1px solid var(--border)">${item.example}</pre>
      </div>
    ` : ''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('nc-detail')">Kapat</button>
      <button class="btn btn-primary" onclick="askAIAboutNc('${item.code}')">🤖 AI'ya Sor</button>
    </div>
  `);
};

window.askAIAboutNc = function(code) {
  closeModal('nc-detail');
  navigate('ai');
  setTimeout(() => {
    const input = document.getElementById('ai-input');
    if (input) {
      input.value = `FANUC CNC NC kodu ${code} hakkında detaylı bilgi, sözdizimi yapısı ve parametrik kullanım örnekleri sun.`;
      sendAIMessage();
    }
  }, 300);
};

// ════════════════════════════════════════════════════════════════
//  PMC SIGNALS DATABASE
// ════════════════════════════════════════════════════════════════
function renderPmcSignals() {
  const page = createPage('pmc_signals');
  page.innerHTML = `
    <div class="page-header">
      <h1>🔌 PMC Sinyal Listesi</h1>
      <p>${State.pmc_signals.length} standart PMC arayüz sinyali — G, F, X, Y Adresleri</p>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:360px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="pmc-search" placeholder="Adres veya isim ara... (ör: G008.4, ESP, ST)" />
        </div>
        <select id="pmc-dir-filter" style="width:180px">
          <option value="">Tüm Yönler</option>
          <option value="NC->PMC">NC -> PMC (F / G Giriş)</option>
          <option value="PMC->NC">PMC -> NC (G / F Çıkış)</option>
          <option value="I/O">I/O (X Giriş / Y Çıkış)</option>
        </select>
      </div>
    </div>
    <div class="page-body" style="padding:0; overflow:auto">
      <table class="data-table" id="pmc-table">
        <thead>
          <tr>
            <th>Adres</th>
            <th>Yön</th>
            <th>Sembol / İsim</th>
            <th>Açıklama</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody id="pmc-tbody"></tbody>
      </table>
    </div>
  `;

  renderPmcTable(State.pmc_signals, page);
  page.querySelector('#pmc-search').addEventListener('input', () => filterPmc(page));
  page.querySelector('#pmc-dir-filter').addEventListener('change', () => filterPmc(page));

  return page;
}

function filterPmc(page) {
  const q = page.querySelector('#pmc-search').value.toLowerCase();
  const dir = page.querySelector('#pmc-dir-filter').value;
  const filtered = State.pmc_signals.filter(p =>
    (!q || p.address.toLowerCase().includes(q) || p.symbol.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) &&
    (!dir || p.direction === dir)
  );
  renderPmcTable(filtered, page);
}

function renderPmcTable(signals, page) {
  const tbody = (page || document).querySelector('#pmc-tbody');
  if (!tbody) return;
  if (!signals.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">PMC sinyali bulunamadı</td></tr>`;
    return;
  }
  const dirTags = { 'NC->PMC': 'tag-blue', 'PMC->NC': 'tag-purple', 'I/O': 'tag-amber' };
  tbody.innerHTML = signals.map(p => `
    <tr style="cursor:pointer" onclick="showPmcDetail('${p.address}')">
      <td><span class="font-mono" style="color:var(--text-accent); font-weight:600; font-size:13px">${p.address}</span></td>
      <td><span class="tag ${dirTags[p.direction]||'tag-gray'}">${p.direction}</span></td>
      <td><span style="font-weight:500; font-size:12px">${p.symbol}</span></td>
      <td><span style="font-size:11.5px; color:var(--text-secondary)">${p.description}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); showPmcDetail('${p.address}')">Detay</button></td>
    </tr>
  `).join('');
}

window.showPmcDetail = function(address) {
  const item = State.pmc_signals.find(p => p.address === address);
  if (!item) return;
  const dirTags = { 'NC->PMC': 'tag-blue', 'PMC->NC': 'tag-purple', 'I/O': 'tag-amber' };

  showModal('pmc-detail', `
    <div class="modal-header">
      <span class="modal-title">PMC Sinyali <span class="font-mono" style="color:var(--text-accent)">${item.address}</span></span>
      <button class="modal-close" onclick="closeModal('pmc-detail')">✕</button>
    </div>
    <div class="flex gap-2 mb-3">
      <span class="tag ${dirTags[item.direction]}">${item.direction}</span>
      <span class="tag tag-gray">${item.symbol}</span>
    </div>
    <div class="card mb-3">
      <div class="card-title mb-2">📋 Açıklama</div>
      <p style="font-size:12.5px; line-height:1.6; color:var(--text-secondary)">${item.description}</p>
    </div>
    ${item.ladder_example ? `
      <div class="card mb-3">
        <div class="card-title mb-2">🔌 Ladder Programındaki Rolü</div>
        <p style="font-size:12px; color:var(--text-secondary)">${item.ladder_example}</p>
      </div>
    ` : ''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('pmc-detail')">Kapat</button>
      <button class="btn btn-primary" onclick="askAIAboutPmc('${item.address}')">🤖 AI'ya Sor</button>
    </div>
  `);
};

window.askAIAboutPmc = function(address) {
  closeModal('pmc-detail');
  navigate('ai');
  setTimeout(() => {
    const input = document.getElementById('ai-input');
    if (input) {
      input.value = `FANUC PMC arayüz sinyali ${address} (${State.pmc_signals.find(p=>p.address===address)?.symbol}) nedir? Hangi interlock devrelerinde ve nasıl kullanılır?`;
      sendAIMessage();
    }
  }, 300);
};

// Reports and explainable maintenance views delegated to operations_insights.js
const renderReports = (...args) => window.OperationsInsights.renderReports(...args);
const renderPredictive = (...args) => window.OperationsInsights.renderPredictive(...args);
const calculateMachineHealth = (...args) => window.OperationsInsights.calculateMachineHealth(...args);

// ════════════════════════════════════════════════════════════════
//  ÜRETİCİ ÖZEL M-KODU VE ALARM KÜTÜPHANESİ (A-ADRESLERİ)
// ════════════════════════════════════════════════════════════════
window.CurrentBuilderTab = 'mcodes';

function renderCustomBuilderLibrary() {
  const page = createPage('custom_builder_library');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>📖 Üretici Özel M-Kodu ve Alarm Kütüphanesi</h1>
          <p>Tezgah üreticisine özel tanımlanmış M-kodları ve PMC A-adresi alarm mesajları kılavuzu</p>
        </div>
        ${canEdit() ? `
        <div>
          <button class="btn btn-primary" id="bl-add-btn" onclick="showNewBuilderItemModal()">
            Yeni Ekle
          </button>
        </div>
        ` : ''}
      </div>

      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-mcodes" onclick="switchBuilderTab('mcodes')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          📦 Özel M-Kodları
        </button>
        <button class="tab-btn" id="tab-alarms" onclick="switchBuilderTab('alarms')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🚨 Üretici Alarmları (A-Adresleri)
        </button>
      </div>

      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="builder-search" placeholder="Kod veya açıklama ara..." />
        </div>
      </div>
    </div>
    <div class="page-body" style="padding:0">
      <div style="overflow-y:auto; flex:1">
        <table class="data-table">
          <thead id="builder-thead"></thead>
          <tbody id="builder-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  setTimeout(() => {
    switchBuilderTab(window.CurrentBuilderTab, page);
    page.querySelector('#builder-search').addEventListener('input', () => filterBuilderList(page));
  }, 10);

  return page;
}

window.switchBuilderTab = function(tab, page = document) {
  window.CurrentBuilderTab = tab;

  const mBtn = page.querySelector('#tab-mcodes');
  const aBtn = page.querySelector('#tab-alarms');
  if (mBtn && aBtn) {
    mBtn.style.color = tab === 'mcodes' ? 'var(--text-accent)' : 'var(--text-secondary)';
    mBtn.style.fontWeight = tab === 'mcodes' ? 'bold' : 'normal';
    aBtn.style.color = tab === 'alarms' ? 'var(--text-accent)' : 'var(--text-secondary)';
    aBtn.style.fontWeight = tab === 'alarms' ? 'bold' : 'normal';
  }

  const thead = page.querySelector('#builder-thead');
  if (tab === 'mcodes') {
    thead.innerHTML = `
      <tr>
        <th>M-Kodu</th>
        <th>İşlev Adı</th>
        <th>Tetikleyici Sinyal</th>
        <th>Açıklama</th>
        <th style="width:100px">İşlemler</th>
      </tr>
    `;
  } else {
    thead.innerHTML = `
      <tr>
        <th>A-Adresi</th>
        <th>Hata Kodu</th>
        <th>Alarm Başlığı</th>
        <th>Açıklama</th>
        <th style="width:100px">İşlemler</th>
      </tr>
    `;
  }

  filterBuilderList(page);
};

function filterBuilderList(page) {
  const tbody = page.querySelector('#builder-tbody');
  if (!tbody) return;

  const q = page.querySelector('#builder-search').value.toLowerCase();

  if (window.CurrentBuilderTab === 'mcodes') {
    const filtered = State.custom_mcodes.filter(m =>
      !q || m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
    );

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Özel M-Kodu bulunamadı.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(m => `
      <tr>
        <td><strong style="color:var(--text-accent); font-family:monospace">${m.code}</strong></td>
        <td><strong>${m.name}</strong></td>
        <td><span class="tag tag-blue" style="font-family:monospace">${m.signal}</span></td>
        <td><div style="font-size:12px; white-space:normal; max-width:500px">${m.description}</div></td>
        <td>
          ${canDelete() ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="deleteCustomMcode(${m.id})" title="Sil" style="color:var(--red)">✕</button>` : ''}
        </td>
      </tr>
    `).join('');
  } else {
    const filtered = State.custom_alarms.filter(a =>
      !q || a.address.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    );

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Üretici Alarmı bulunamadı.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(a => `
      <tr>
        <td><strong style="color:var(--text-accent); font-family:monospace">${a.address}</strong></td>
        <td><span class="tag tag-red" style="font-family:monospace">${a.code}</span></td>
        <td><strong>${a.title}</strong></td>
        <td><div style="font-size:12px; white-space:normal; max-width:400px">${a.description}</div></td>
        <td>
          ${canDelete() ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="deleteCustomAlarm(${a.id})" title="Sil" style="color:var(--red)">✕</button>` : ''}
        </td>
      </tr>
    `).join('');
  }
}

window.showNewBuilderItemModal = function() {
  if (window.CurrentBuilderTab === 'mcodes') {
    showModal('new-builder-mcode', `
      <div class="modal-header">
        <span class="modal-title">Yeni Özel M-Kodu Ekle</span>
        <button class="modal-close" onclick="closeModal('new-builder-mcode')">✕</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">M-Kodu (ör. M10) *</label>
          <input class="form-control" id="nm-mc-code" placeholder="M10" />
        </div>
        <div class="form-group">
          <label class="form-label">Tetikleyici PMC Sinyali (ör. Y22.4)</label>
          <input class="form-control" id="nm-mc-signal" placeholder="Y22.4" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">İşlev Adı *</label>
        <input class="form-control" id="nm-mc-name" placeholder="ör. AYNA SIKMA" />
      </div>
      <div class="form-group">
        <label class="form-label">Açıklama</label>
        <textarea class="form-control" id="nm-mc-desc" rows="3" placeholder="İşlev hakkında detaylı bilgi girin..."></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('new-builder-mcode')">İptal</button>
        <button class="btn btn-primary" onclick="createNewCustomMcode()">Kaydet</button>
      </div>
    `);
  } else {
    showModal('new-builder-alarm', `
      <div class="modal-header">
        <span class="modal-title">Yeni Üretici Alarmı (A-Adresi) Ekle</span>
        <button class="modal-close" onclick="closeModal('new-builder-alarm')">✕</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">A-Adresi (ör. A0.0) *</label>
          <input class="form-control" id="nm-al-addr" placeholder="A0.0" />
        </div>
        <div class="form-group">
          <label class="form-label">Hata Kodu (ör. EX0001) *</label>
          <input class="form-control" id="nm-al-code" placeholder="EX0001" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Alarm Başlığı *</label>
        <input class="form-control" id="nm-al-title" placeholder="ör. LUBRICATION PRESSURE FAULT" />
      </div>
      <div class="form-group">
        <label class="form-label">Açıklama / Saha Önerileri</label>
        <textarea class="form-control" id="nm-al-desc" rows="3" placeholder="Hatanın çözümü ve nedenleri hakkında bilgi girin..."></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('new-builder-alarm')">İptal</button>
        <button class="btn btn-primary" onclick="createNewCustomAlarm()">Kaydet</button>
      </div>
    `);
  }
};

window.createNewCustomMcode = async function() {
  if (!canEdit()) { showToast('M-Kodu ekleme yetkiniz yok', 'error'); return; }
  const code = document.getElementById('nm-mc-code').value.trim().toUpperCase();
  const signal = document.getElementById('nm-mc-signal').value.trim().toUpperCase();
  const name = document.getElementById('nm-mc-name').value.trim().toUpperCase();
  const description = document.getElementById('nm-mc-desc').value.trim();

  if (!code || !name) {
    showToast('Lütfen zorunlu alanları doldurun.', 'error');
    return;
  }

  const id = State.custom_mcodes.length ? Math.max(...State.custom_mcodes.map(m => m.id)) + 1 : 1;
  State.custom_mcodes.push({ id, code, signal, name, description });
  await saveCustomMCodes();
  closeModal('new-builder-mcode');
  showToast('Özel M-Kodu eklendi.', 'success');
  navigate('custom_builder_library');
};

window.createNewCustomAlarm = async function() {
  if (!canEdit()) { showToast('Özel alarm ekleme yetkiniz yok', 'error'); return; }
  const address = document.getElementById('nm-al-addr').value.trim().toUpperCase();
  const code = document.getElementById('nm-al-code').value.trim().toUpperCase();
  const title = document.getElementById('nm-al-title').value.trim().toUpperCase();
  const description = document.getElementById('nm-al-desc').value.trim();

  if (!address || !code || !title) {
    showToast('Lütfen zorunlu alanları doldurun.', 'error');
    return;
  }

  const id = State.custom_alarms.length ? Math.max(...State.custom_alarms.map(a => a.id)) + 1 : 1;
  State.custom_alarms.push({ id, address, code, title, description, causes: [], solutions: [] });
  await saveCustomAlarms();
  closeModal('new-builder-alarm');
  showToast('Üretici alarmı eklendi.', 'success');
  navigate('custom_builder_library');
};

window.deleteCustomMcode = async function(id) {
  if (!canDelete()) { showToast('M-Kodu silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu M-kodunu silmek istediğinize emin misiniz?')) return;
  State.custom_mcodes = State.custom_mcodes.filter(m => m.id !== id);
  await saveCustomMCodes();
  showToast('M-kodu silindi.', 'success');
  navigate('custom_builder_library');
};

window.deleteCustomAlarm = async function(id) {
  if (!canDelete()) { showToast('Özel alarm silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu alarmı silmek istediğinize emin misiniz?')) return;
  State.custom_alarms = State.custom_alarms.filter(a => a.id !== id);
  await saveCustomAlarms();
  showToast('Alarm silindi.', 'success');
  navigate('custom_builder_library');
};



  const MTBNcPmcLibrary = {
    renderNcCodes: typeof renderNcCodes !== 'undefined' ? renderNcCodes : undefined,
    filterNc: typeof filterNc !== 'undefined' ? filterNc : undefined,
    renderNcTable: typeof renderNcTable !== 'undefined' ? renderNcTable : undefined,
    renderPmcSignals: typeof renderPmcSignals !== 'undefined' ? renderPmcSignals : undefined,
    filterPmc: typeof filterPmc !== 'undefined' ? filterPmc : undefined,
    renderPmcTable: typeof renderPmcTable !== 'undefined' ? renderPmcTable : undefined,
    renderReports: typeof renderReports !== 'undefined' ? renderReports : undefined,
    renderPredictive: typeof renderPredictive !== 'undefined' ? renderPredictive : undefined,
    calculateMachineHealth: typeof calculateMachineHealth !== 'undefined' ? calculateMachineHealth : undefined,
    renderCustomBuilderLibrary: typeof renderCustomBuilderLibrary !== 'undefined' ? renderCustomBuilderLibrary : undefined,
    filterBuilderList: typeof filterBuilderList !== 'undefined' ? filterBuilderList : undefined,
    showNcDetail: typeof showNcDetail !== 'undefined' ? showNcDetail : undefined,
    askAIAboutNc: typeof askAIAboutNc !== 'undefined' ? askAIAboutNc : undefined,
    showPmcDetail: typeof showPmcDetail !== 'undefined' ? showPmcDetail : undefined,
    askAIAboutPmc: typeof askAIAboutPmc !== 'undefined' ? askAIAboutPmc : undefined,
    switchBuilderTab: typeof switchBuilderTab !== 'undefined' ? switchBuilderTab : undefined,
    showNewBuilderItemModal: typeof showNewBuilderItemModal !== 'undefined' ? showNewBuilderItemModal : undefined,
    createNewCustomMcode: typeof createNewCustomMcode !== 'undefined' ? createNewCustomMcode : undefined,
    createNewCustomAlarm: typeof createNewCustomAlarm !== 'undefined' ? createNewCustomAlarm : undefined,
    deleteCustomMcode: typeof deleteCustomMcode !== 'undefined' ? deleteCustomMcode : undefined,
    deleteCustomAlarm: typeof deleteCustomAlarm !== 'undefined' ? deleteCustomAlarm : undefined
  };

  global.MTBNcPmcLibrary = MTBNcPmcLibrary;
  if (typeof renderNcCodes !== 'undefined') global.renderNcCodes = renderNcCodes;
  if (typeof filterNc !== 'undefined') global.filterNc = filterNc;
  if (typeof renderNcTable !== 'undefined') global.renderNcTable = renderNcTable;
  if (typeof renderPmcSignals !== 'undefined') global.renderPmcSignals = renderPmcSignals;
  if (typeof filterPmc !== 'undefined') global.filterPmc = filterPmc;
  if (typeof renderPmcTable !== 'undefined') global.renderPmcTable = renderPmcTable;
  if (typeof renderReports !== 'undefined') global.renderReports = renderReports;
  if (typeof renderPredictive !== 'undefined') global.renderPredictive = renderPredictive;
  if (typeof calculateMachineHealth !== 'undefined') global.calculateMachineHealth = calculateMachineHealth;
  if (typeof renderCustomBuilderLibrary !== 'undefined') global.renderCustomBuilderLibrary = renderCustomBuilderLibrary;
  if (typeof filterBuilderList !== 'undefined') global.filterBuilderList = filterBuilderList;
  if (typeof showNcDetail !== 'undefined') global.showNcDetail = showNcDetail;
  if (typeof askAIAboutNc !== 'undefined') global.askAIAboutNc = askAIAboutNc;
  if (typeof showPmcDetail !== 'undefined') global.showPmcDetail = showPmcDetail;
  if (typeof askAIAboutPmc !== 'undefined') global.askAIAboutPmc = askAIAboutPmc;
  if (typeof switchBuilderTab !== 'undefined') global.switchBuilderTab = switchBuilderTab;
  if (typeof showNewBuilderItemModal !== 'undefined') global.showNewBuilderItemModal = showNewBuilderItemModal;
  if (typeof createNewCustomMcode !== 'undefined') global.createNewCustomMcode = createNewCustomMcode;
  if (typeof createNewCustomAlarm !== 'undefined') global.createNewCustomAlarm = createNewCustomAlarm;
  if (typeof deleteCustomMcode !== 'undefined') global.deleteCustomMcode = deleteCustomMcode;
  if (typeof deleteCustomAlarm !== 'undefined') global.deleteCustomAlarm = deleteCustomAlarm;
})(window);
