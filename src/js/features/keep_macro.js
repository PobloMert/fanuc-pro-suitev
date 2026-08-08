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
    <div class="page-body" style="padding:0">
      <div style="overflow-y:auto; flex:1">
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

// ════════════════════════════════════════════════════════════════
//  RS232 / DNC SERİ HABERLEŞME SİMÜLATÖRÜ & KILAVUZU


    api = { renderKeepRelays, renderMacroVariables };
    return api;
  }
  global.MTBKeepMacroFeature = Object.freeze({ initialize });
})(window);
