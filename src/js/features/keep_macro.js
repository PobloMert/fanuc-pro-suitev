/* Renderer'dan ayrılmış mühendislik ekranı. */
(function feature(global) {
  'use strict';
  let api = null;
  function initialize(deps) {
    if (api) return api;
    const { State, createPage, canEdit, showModal, closeModal, showToast, navigate, evaluateSafeMathExpression } = deps;

function renderKeepRelays() {
  const page = createPage('keep_relays');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>🔌 Keep Relay & Zamanlayıcı Veritabanı</h1>
          <p>Tezgah opsiyon parametreleri, sinyal kilitleri ve süre ayarları el kitabı</p>
        </div>
        ${canEdit() ? `
        <button class="btn btn-primary" onclick="showNewKeepRelayModal()">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Parametre Tanımla
        </button>
        ` : ''}
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:320px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="kr-search" placeholder="Parametre adı veya kodu ara..." />
        </div>
        <select id="kr-type-filter" style="width:180px">
          <option value="">Tüm Tipler</option>
          <option>Keep Relay</option>
          <option>Timer</option>
        </select>
      </div>
    </div>
    <div class="page-body" style="padding:16px">
      <!-- Keep Relay Diff Engine Card -->
      <div id="kr-diff-section" class="card glass-card mb-4" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="font-weight:750; font-size:15px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span>🔌 Keep Relay Karşılaştırma & Side-by-Side Diff Engine</span>
              <span class="tag tag-blue" style="font-size:10px;">PMC K00 - K15 Karşılaştırma</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
              İki ayrı Keep Relay yedeğini yan yana kıyaslayarak güvenlik kilitlerindeki (K00.0, K00.1, K00.7) ve opsiyon bitlerindeki değişiklikleri tespit edin.
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="runKeepRelayDiffComparison()">⚡ Farkları Analiz Et</button>
            <button class="btn btn-secondary btn-sm" onclick="loadDefaultKeepRelayDiff()">🔄 Örnek Veri Yükle</button>
          </div>
        </div>

        <!-- Side-by-Side Textarea Inputs -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px;">
          <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:700; font-size:12px; color:var(--text-accent);">📋 Yedek A (Referans / Orijinal)</span>
              <button class="btn btn-ghost btn-sm" onclick="clearKeepRelayInput('a')">🗑️</button>
            </div>
            <textarea id="kr-file-a" class="form-control font-mono" rows="5" style="font-size:11px; background:#0b0f19; color:#34d399; resize:vertical;" placeholder="K00 = 00000000 veya K00.0 = 0...">K00 = 00000000
K01 = 00000000
K02 = 00000000</textarea>
          </div>

          <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:700; font-size:12px; color:var(--amber);">📋 Yedek B (Yeni / Mevcut Ayarlar)</span>
              <button class="btn btn-ghost btn-sm" onclick="clearKeepRelayInput('b')">🗑️</button>
            </div>
            <textarea id="kr-file-b" class="form-control font-mono" rows="5" style="font-size:11px; background:#0b0f19; color:#fbbf24; resize:vertical;" placeholder="K00 = 00000011 veya K00.0 = 1...">K00 = 00000011
K01 = 00000100
K02 = 00000000</textarea>
          </div>
        </div>

        <!-- KPI Summary Cards -->
        <div id="kr-diff-kpis" style="display:none; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:16px;">
          <div style="background:var(--bg-card2); border:1px solid var(--border); padding:10px 14px; border-radius:var(--radius-md);">
            <div id="kr-kpi-changed" style="font-size:20px; font-weight:800; color:#fbbf24;">0</div>
            <div style="font-size:11px; color:var(--text-secondary);">Değişen Bit Sayısı</div>
          </div>
          <div style="background:var(--bg-card2); border:1px solid var(--border); padding:10px 14px; border-radius:var(--radius-md);">
            <div id="kr-kpi-critical" style="font-size:20px; font-weight:800; color:#f87171;">0</div>
            <div style="font-size:11px; color:var(--text-secondary);">Kritik Emniyet Uyarısı</div>
          </div>
          <div style="background:var(--bg-card2); border:1px solid var(--border); padding:10px 14px; border-radius:var(--radius-md);">
            <div id="kr-kpi-total" style="font-size:20px; font-weight:800; color:#34d399;">0</div>
            <div style="font-size:11px; color:var(--text-secondary);">Toplam İncelenen Adres</div>
          </div>
        </div>

        <!-- Results Table -->
        <div id="kr-diff-results" style="display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-weight:700; font-size:13px; color:var(--text-primary);">Side-by-Side Keep Relay Farkları:</span>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary btn-sm" onclick="exportKeepRelayDiffPDF()" style="font-size:11px;">🖨️ PDF Rapor</button>
              <button class="btn btn-secondary btn-sm" onclick="exportKeepRelayDiffCSV()" style="font-size:11px;">📊 CSV İndir</button>
            </div>
          </div>
          <table class="data-table" style="font-size:11.5px;">
            <thead>
              <tr>
                <th style="width:110px;">Keep Relay</th>
                <th>Açıklama & İşlev</th>
                <th style="width:140px; background:rgba(16,185,129,0.08);">Yedek A (Referans)</th>
                <th style="width:140px; background:rgba(245,158,11,0.08);">Yedek B (Yeni)</th>
                <th style="width:100px;">Durum</th>
              </tr>
            </thead>
            <tbody id="kr-diff-tbody"></tbody>
          </table>
        </div>
      </div>

      <div style="overflow-y:auto; flex:1">
        <div style="font-weight:700; font-size:13px; margin-bottom:8px; color:var(--text-primary);">📚 Keep Relay & Timer El Kitabı Kataloğu</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:120px">Adres / No</th>
              <th style="width:80px">Tip</th>
              <th>Parametre İsmi</th>
              <th>Açıklama</th>
              <th>Özel Notlar (Tezgaha Özel)</th>
              <th style="width:100px">İşlemler</th>
            </tr>
          </thead>
          <tbody id="kr-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderKeepRelayTable(State.keep_relays, page);

  page.querySelector('#kr-search').addEventListener('input', () => filterKeepRelays(page));
  page.querySelector('#kr-type-filter').addEventListener('change', () => filterKeepRelays(page));

  return page;
}

function filterKeepRelays(page) {
  const q = page.querySelector('#kr-search').value.toLowerCase();
  const type = page.querySelector('#kr-type-filter').value;

  const filtered = State.keep_relays.filter(k =>
    (k.id.toLowerCase().includes(q) || k.name.toLowerCase().includes(q) || k.description.toLowerCase().includes(q)) &&
    (!type || k.type === type)
  );
  renderKeepRelayTable(filtered, page);
}

function renderKeepRelayTable(list, page) {
  const tbody = page.querySelector('#kr-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Kayıt bulunamadı</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(k => {
    const isTimer = k.type === 'Timer';
    return `
      <tr>
        <td><strong class="font-mono text-sm" style="color:var(--text-accent)">${k.id}</strong></td>
        <td><span class="tag ${isTimer ? 'tag-purple' : 'tag-blue'}">${k.type}</span></td>
        <td><span style="font-weight:600">${k.name}</span></td>
        <td><span style="font-size:12px; color:var(--text-secondary)">${k.description}</span></td>
        <td><span style="font-size:12px; color:var(--amber); font-style:italic">${k.note || '—'}</span></td>
        <td>
          ${canEdit() ? `
          <button class="btn btn-secondary btn-sm" onclick="showEditKeepRelayModal('${k.id}')">Not Ekle</button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

window.showEditKeepRelayModal = function(id) {
  const k = State.keep_relays.find(x => x.id === id);
  if (!k) return;

  showModal('edit-kr', `
    <div class="modal-header">
      <span class="modal-title">Röle Notu Düzenle — ${k.id}</span>
      <button class="modal-close" onclick="closeModal('edit-kr')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Parametre Adı</label>
      <input class="form-control" value="${k.name}" readonly style="opacity:0.6" />
    </div>
    <div class="form-group">
      <label class="form-label">Açıklama</label>
      <textarea class="form-control" readonly style="opacity:0.6" rows="2">${k.description}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Tezgaha Özel Notlar *</label>
      <textarea class="form-control" id="kr-edit-note" rows="3" placeholder="Örn: CNC-101 tezgahında otomatik kapıyı devre dışı bırakmak için 1 yapılır.">${k.note || ''}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('edit-kr')">İptal</button>
      <button class="btn btn-primary" onclick="saveKeepRelayNote('${k.id}')">Notu Kaydet</button>
    </div>
  `);
};

window.saveKeepRelayNote = async function(id) {
  if (!canEdit()) { showToast('Not düzenleme yetkiniz yok', 'error'); return; }
  const note = document.getElementById('kr-edit-note').value.trim();
  const k = State.keep_relays.find(x => x.id === id);
  if (k) {
    const oldNote = k.note;
    k.note = note;
    try {
      const res = await window.electronAPI.writeFile('./data/keep_relays.json', JSON.stringify({ keep_relays: State.keep_relays }, null, 2));
      if (res && res.ok) {
        closeModal('edit-kr');
        showToast('Not başarıyla kaydedildi!', 'success');
        navigate('keep_relays');
      } else {
        k.note = oldNote; // revert
        showToast('Not kaydedilemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (err) {
      k.note = oldNote; // revert
      showToast('Not kaydedilirken hata: ' + err.message, 'error');
    }
  }
};

window.showNewKeepRelayModal = function() {
  showModal('new-kr', `
    <div class="modal-header">
      <span class="modal-title">Yeni PMC Parametresi Tanımla</span>
      <button class="modal-close" onclick="closeModal('new-kr')">✕</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Adres / No (ör. K00.4 veya T004) *</label>
        <input class="form-control" id="nk-id" placeholder="K00.4" />
      </div>
      <div class="form-group">
        <label class="form-label">Parametre Tipi *</label>
        <select class="form-control" id="nk-type">
          <option>Keep Relay</option>
          <option>Timer</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Parametre İsmi *</label>
      <input class="form-control" id="nk-name" placeholder="Kapı Kilidi İptali" />
    </div>
    <div class="form-group">
      <label class="form-label">Açıklama *</label>
      <textarea class="form-control" id="nk-desc" rows="3" placeholder="Sinyalin görevini açıklayın..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Özel Notlar</label>
      <input class="form-control" id="nk-note" placeholder="Tezgaha özel not ekleyin..." />
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-kr')">İptal</button>
      <button class="btn btn-primary" onclick="createNewKeepRelay()">Parametreyi Kaydet</button>
    </div>
  `);
};

window.createNewKeepRelay = async function() {
  if (!canEdit()) { showToast('Keep Relay ekleme yetkiniz yok', 'error'); return; }
  const id = document.getElementById('nk-id').value.trim();
  const type = document.getElementById('nk-type').value;
  const name = document.getElementById('nk-name').value.trim();
  const description = document.getElementById('nk-desc').value.trim();
  const note = document.getElementById('nk-note').value.trim();

  if (!id || !name || !description) {
    showToast('Adres, isim ve açıklama girmek zorunludur.', 'error');
    return;
  }

  const newKR = { id, type, name, description, note };
  try {
    const res = await window.electronAPI.writeFile('./data/keep_relays.json', JSON.stringify({ keep_relays: [...State.keep_relays, newKR] }, null, 2));
    if (res && res.ok) {
      State.keep_relays.push(newKR);
      closeModal('new-kr');
      showToast('Parametre veritabanına eklendi!', 'success');
      navigate('keep_relays');
    } else {
      showToast('Parametre kaydedilemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Parametre kaydedilirken hata: ' + err.message, 'error');
  }
};

// ════════════════════════════════════════════════════════════════
//  MAKRO DEĞİŞKENLERİ REHBERİ & HESAPLAYICISI
// ════════════════════════════════════════════════════════════════
function renderMacroVariables() {
  const page = createPage('macro');
  page.innerHTML = `
    <div class="page-header">
      <h1>🧮 FANUC Makro Değişkenleri Kılavuzu</h1>
      <p>Macro B değişken tablosu, sistem değişkenleri referansı ve interaktif hesaplayıcı</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 1fr 1fr; gap:16px">
        <div class="card" style="display:flex; flex-direction:column; height:100%">
          <div class="card-title mb-3">🧮 İnteraktif Makro Değer Hesaplayıcı</div>
          <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:12px">
            FANUC Macro B aritmetik ifadelerini test edin. Değişken kutularına (# sembolü olmadan) değerleri yazıp hesaplama yapabilirsiniz. Trigonometrik fonksiyonlar derece cinsinden hesaplanır (FANUC standardı).
          </p>
          <div class="grid-2 mb-3" style="gap:8px">
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:10.5px">#1 değeri (A)</label>
              <input class="form-control" id="mc-v1" value="30.0" style="padding:6px; font-family:monospace" />
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:10.5px">#2 değeri (B)</label>
              <input class="form-control" id="mc-v2" value="2.0" style="padding:6px; font-family:monospace" />
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:10.5px">#100 değeri</label>
              <input class="form-control" id="mc-v100" value="150.5" style="padding:6px; font-family:monospace" />
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:10.5px">#500 değeri</label>
              <input class="form-control" id="mc-v500" value="10.0" style="padding:6px; font-family:monospace" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:11px">Makro Formülü Girin (örn. [#100 + #500] * SIN[#1])</label>
            <input class="form-control" id="mc-expression" value="[#100 + #500] * SIN[#1]" style="font-family:monospace; background:#0f172a; color:#38bdf8" />
          </div>
          <button class="btn btn-primary w-100" onclick="evaluateMacro()">⚡ Formülü Hesapla</button>
          
          <div class="card mt-3" style="background:var(--bg-card2); padding:10px; border-color:var(--border)">
            <div style="font-size:11px; color:var(--text-muted)">HESAPLAMA SONUCU:</div>
            <div id="mc-result" style="font-size:18px; font-family:monospace; font-weight:700; color:var(--green); margin-top:4px">—</div>
          </div>
        </div>

        <div class="card" style="display:flex; flex-direction:column; height:100%">
          <div class="card-title mb-2">📋 Değişken Türleri Referansı</div>
          <div style="flex:1; overflow-y:auto; font-size:11.5px; display:flex; flex-direction:column; gap:10px">
            <div style="background:var(--bg-card2); padding:8px; border-radius:4px">
              <strong style="color:var(--text-accent)">#1 - #33 (Yerel Değişkenler):</strong><br>
              G65 makro çağrılarında (alt program) lokal parametre transferi için kullanılır. Örneğin, <code>A=10.0</code> yazıldığında alt programda <code>#1</code> değeri 10.0 olur.
            </div>
            <div style="background:var(--bg-card2); padding:8px; border-radius:4px">
              <strong style="color:var(--text-accent)">#100 - #199 / #500 - #999 (Ortak Değişkenler):</strong><br>
              Tüm programlar tarafından erişilebilir. <strong>#100 serisi</strong> güç kapatıldığında sıfırlanırken (volatile), <strong>#500 serisi</strong> kalıcı bellekte saklanır (non-volatile).
            </div>
            <div style="background:var(--bg-card2); padding:8px; border-radius:4px">
              <strong style="color:var(--text-accent)">#1000 - #1131 (PMC Giriş/Çıkış Arayüzü):</strong><br>
              Makro programından PMC sinyal kontaklarını okumak (#1000) veya yazmak (#1100) için kullanılır.
            </div>
            <div style="background:var(--bg-card2); padding:8px; border-radius:4px">
              <strong style="color:var(--text-accent)">#5021 - #5023 (Eksen Makine Koordinatları):</strong><br>
              Tezgahın o anki makine koordinat sistemindeki X, Y, Z mutlak pozisyonlarını okur (Salt Okunur).
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  return page;
}

window.evaluateMacro = function() {
  const v1 = parseFloat(document.getElementById('mc-v1').value) || 0;
  const v2 = parseFloat(document.getElementById('mc-v2').value) || 0;
  const v100 = parseFloat(document.getElementById('mc-v100').value) || 0;
  const v500 = parseFloat(document.getElementById('mc-v500').value) || 0;
  let expr = document.getElementById('mc-expression').value.trim();

  const resEl = document.getElementById('mc-result');
  if (!expr) {
    resEl.innerText = 'Formül girilmedi';
    resEl.style.color = 'var(--red)';
    return;
  }

  // Define vars mapping
  const vars = {
    '1': v1,
    '2': v2,
    '100': v100,
    '500': v500
  };

  try {
    // 1. Replace brackets with parentheses for eval
    expr = expr.replace(/\[/g, '(').replace(/\]/g, ')');

    // 2. Replace math functions: SIN, COS, TAN, SQRT, ABS
    // FANUC uses degrees, so convert SIN(x) -> Math.sin(x * PI/180)
    expr = expr.replace(/SIN\(([^)]+)\)/gi, (m, p1) => `Math.sin((${p1}) * Math.PI / 180)`);
    expr = expr.replace(/COS\(([^)]+)\)/gi, (m, p1) => `Math.cos((${p1}) * Math.PI / 180)`);
    expr = expr.replace(/TAN\(([^)]+)\)/gi, (m, p1) => `Math.tan((${p1}) * Math.PI / 180)`);
    expr = expr.replace(/SQRT\(([^)]+)\)/gi, 'Math.sqrt($1)');
    expr = expr.replace(/ABS\(([^)]+)\)/gi, 'Math.abs($1)');
    expr = expr.replace(/ROUND\(([^)]+)\)/gi, 'Math.round($1)');

    // 3. Replace variables #1, #2, #100, #500
    expr = expr.replace(/#100/g, vars['100']);
    expr = expr.replace(/#500/g, vars['500']);
    expr = expr.replace(/#1/g, vars['1']);
    expr = expr.replace(/#2/g, vars['2']);

    // Check if there are unreplaced variables (e.g. #3, #150)
    if (/#\d+/g.test(expr)) {
      resEl.innerText = 'Hata: Tanımsız değişken (Sadece #1, #2, #100, #500)';
      resEl.style.color = 'var(--red)';
      return;
    }

    // 4. Safe evaluate
    // Use Function constructor instead of direct eval for safety
    const result = evaluateSafeMathExpression(expr);

    if (isNaN(result) || result === Infinity || result === -Infinity) {
      resEl.innerText = 'Hesaplama Hatası (Bölünme veya Geçersiz İşlem)';
      resEl.style.color = 'var(--red)';
    } else {
      resEl.innerText = result.toFixed(4);
      resEl.style.color = 'var(--green)';
    }
  } catch (e) {
    resEl.innerText = 'Hata: ' + e.message;
    resEl.style.color = 'var(--red)';
  }
};

let lastKeepRelayDiffs = [];

window.clearKeepRelayInput = function(type) {
  const el = document.getElementById(`kr-file-${type}`);
  if (el) el.value = '';
  showToast(`Yedek ${type.toUpperCase()} temizlendi.`, 'info');
};

window.loadDefaultKeepRelayDiff = function() {
  const elA = document.getElementById('kr-file-a');
  const elB = document.getElementById('kr-file-b');
  if (elA && elB) {
    elA.value = "K00 = 00000000\nK01 = 00000000\nK02 = 00000000";
    elB.value = "K00 = 00000011\nK01 = 00000100\nK02 = 00000000";
    runKeepRelayDiffComparison();
    showToast('Örnek Keep Relay yedeği yüklendi.', 'success');
  }
};

window.runKeepRelayDiffComparison = function() {
  const textA = document.getElementById('kr-file-a')?.value || '';
  const textB = document.getElementById('kr-file-b')?.value || '';
  const resultsCard = document.getElementById('kr-diff-results');
  const kpisCard = document.getElementById('kr-diff-kpis');
  const tbody = document.getElementById('kr-diff-tbody');

  if (!resultsCard || !tbody) return;

  const parseKRM = (txt) => {
    const map = {};
    const lines = txt.split('\n');
    lines.forEach(l => {
      const clean = l.replace(/Keep/gi, '').replace(/=/g, ' ').trim();
      const parts = clean.split(/\s+/);
      if (parts.length >= 2) {
        const key = parts[0].toUpperCase();
        map[key] = parts[1].trim();
      }
    });
    return map;
  };

  const mapA = parseKRM(textA);
  const mapB = parseKRM(textB);
  const allKeys = Array.from(new Set([...Object.keys(mapA), ...Object.keys(mapB)])).sort();

  const diffs = [];
  let changedCount = 0;
  let criticalCount = 0;

  allKeys.forEach(key => {
    const valA = mapA[key];
    const valB = mapB[key];

    if (valA !== valB) {
      changedCount++;
      const vA = valA || '────────';
      const vB = valB || '────────';
      const isCritical = key.includes('K00') || key.includes('K01') || key.includes('K00.0') || key.includes('K00.1');
      if (isCritical) criticalCount++;

      const krInfo = (State.keep_relays || []).find(k => k.id === key || k.id.startsWith(key));
      const desc = krInfo ? `${krInfo.name} - ${krInfo.description}` : 'Standart PMC Keep Relay Adresi';

      diffs.push({
        key,
        desc,
        valA: vA,
        valB: vB,
        isCritical,
        status: !valA ? 'Eklendi' : (!valB ? 'Silindi' : 'Değişti'),
        colorClass: !valA ? 'tag-green' : (!valB ? 'tag-red' : 'tag-orange')
      });
    }
  });

  lastKeepRelayDiffs = diffs;

  if (kpisCard) {
    kpisCard.style.display = 'grid';
    document.getElementById('kr-kpi-changed').textContent = changedCount;
    document.getElementById('kr-kpi-critical').textContent = criticalCount;
    document.getElementById('kr-kpi-total').textContent = allKeys.length;
  }

  resultsCard.style.display = 'block';

  if (!diffs.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--green);">✔️ İki yedeğin Keep Relay değerleri %100 birebir aynıdır.</td></tr>`;
    return;
  }

  tbody.innerHTML = diffs.map(d => `
    <tr class="${d.isCritical ? 'diff-critical' : ''}">
      <td>
        <strong class="font-mono" style="color:var(--text-accent); font-size:12px;">${escapeHTML(d.key)}</strong>
        ${d.isCritical ? '<span style="font-size:9px; background:rgba(239,68,68,0.18); color:#f87171; padding:1px 4px; border-radius:3px; margin-left:4px">KRİTİK EMNİYET</span>' : ''}
      </td>
      <td>
        <div style="font-size:12px; color:var(--text-primary); font-weight:600;">${escapeHTML(d.desc)}</div>
      </td>
      <td style="background:rgba(16,185,129,0.04)"><span class="font-mono" style="color:#34d399; font-size:12px;">${escapeHTML(d.valA)}</span></td>
      <td style="background:rgba(245,158,11,0.04)"><span class="font-mono" style="color:#fbbf24; font-size:12px; font-weight:bold;">${escapeHTML(d.valB)}</span></td>
      <td><span class="tag ${d.colorClass}">${d.status}</span></td>
    </tr>
  `).join('');
};

window.exportKeepRelayDiffCSV = function() {
  if (!lastKeepRelayDiffs.length) {
    showToast('Dışa aktarılacak Keep Relay farkı bulunamadı.', 'warning');
    return;
  }
  let csv = '\uFEFF';
  csv += 'Keep Relay Adres;Açıklama;Yedek A (Referans);Yedek B (Yeni);Durum;Kritik Sinyal\n';
  lastKeepRelayDiffs.forEach(d => {
    csv += `${d.key};"${d.desc.replace(/;/g, ',')}";"${d.valA}";"${d.valB}";"${d.status}";"${d.isCritical ? 'KRİTİK' : 'Normal'}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `fanuc-keeprelay-diff-${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Keep Relay fark raporu CSV olarak indirildi (Excel Uyumlu) ✓', 'success');
};

window.exportKeepRelayDiffPDF = function() {
  if (!lastKeepRelayDiffs.length) {
    showToast('Dışa aktarılacak Keep Relay farkı bulunamadı.', 'warning');
    return;
  }
  window.print();
};

    api = { renderKeepRelays, renderMacroVariables };
    return api;
  }
  global.MTBKeepMacroFeature = Object.freeze({ initialize });
})(window);
