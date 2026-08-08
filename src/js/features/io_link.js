/* Renderer'dan ayrılmış mühendislik ekranı. */
(function feature(global) {
  'use strict';
  let api = null;
  function initialize(deps) {
    if (api) return api;
    const { createPage } = deps;

window.CurrentIOTab = 'graph';

function renderIOLink() {
  const page = createPage('io_link');
  page.innerHTML = `
    <div class="page-header">
      <h1>🔌 FANUC I/O Link & Donanım Bağlantı Teşhisi</h1>
      <p>I/O Link kartları, veri kablosu mimarisi, adresleme kuralları ve donanımsal slot eşlemeleri</p>
      
      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-io-graph" onclick="switchIOTab('graph')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          🔌 I/O Kablo Mimarisi & Alarmlar
        </button>
        <button class="tab-btn" id="tab-io-map" onclick="switchIOTab('map')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🗺️ Donanımsal Slot & Adres Eşleme
        </button>
      </div>
    </div>
    
    <div class="page-body" id="io-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchIOTab(window.CurrentIOTab, page);
  }, 10);

  return page;
}

window.switchIOTab = function(tab, page = document) {
  window.CurrentIOTab = tab;
  
  const graphBtn = page.querySelector('#tab-io-graph');
  const mapBtn = page.querySelector('#tab-io-map');
  if (graphBtn && mapBtn) {
    graphBtn.style.color = tab === 'graph' ? 'var(--text-accent)' : 'var(--text-secondary)';
    graphBtn.style.fontWeight = tab === 'graph' ? 'bold' : 'normal';
    mapBtn.style.color = tab === 'map' ? 'var(--text-accent)' : 'var(--text-secondary)';
    mapBtn.style.fontWeight = tab === 'map' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#io-tab-content');
  if (!content) return;

  if (tab === 'graph') {
    content.innerHTML = `
      <div class="grid-2 mb-4" style="grid-template-columns: 1fr 1fr; gap:16px">
        <!-- Connection Graph -->
        <div class="card" style="padding:16px; display:flex; flex-direction:column; justify-content:between">
          <div>
            <div class="card-title mb-2">🔌 I/O Link Kablo Mimarisi</div>
            <p style="font-size:11px; color:var(--text-secondary); margin-bottom:12px">
              FANUC I/O Link, kontrol kartı (Master) ile üniteler (Slave) arasındaki seri bağlantı zinciridir. Kablo soket etiketleri <strong>JD1A (OUT)</strong> ve <strong>JD1B (IN)</strong> şeklinde takip edilmelidir.
            </p>
            
            <div style="background:#0f172a; padding:16px; border-radius:4px; font-family:monospace; font-size:10.5px; color:var(--green); line-height:1.6; border:1px solid var(--border); margin-bottom:12px">
              [ CNC Main Board (COP10A) ]  JD1A (Master Port)
                           │
                           ▼ (I/O Link Kablosu)
              [ Operator Panel Board ]     JD1B (IN) -> JD1A (OUT)
                           │
                           ▼ (I/O Link Kablosu)
              [ I/O Base Module 1 ]        JD1B (IN) -> JD1A (OUT)
                           │
                           ▼ (I/O Link Kablosu)
              [ I/O Base Module 2 ]        JD1B (IN)
            </div>
          </div>
          <div class="card" style="background:rgba(239,68,68,0.03); border-color:rgba(239,68,68,0.12); padding:10px; font-size:11px; line-height:1.5">
            ⚠️ <strong>Sinyal Kuralı:</strong> Zincirdeki herhangi bir ara ünite (Örn: Operatör Paneli Kartı) 24V güç beslemesini kaybederse, kendisinden sonraki tüm I/O kartlarının sinyal bağlantısı kopar ve sistem anında acil stopa geçer (ER97 hatası).
          </div>
        </div>

        <!-- Alarm Table -->
        <div class="card" style="padding:16px">
          <div class="card-title mb-2">🚨 Yaygın I/O Link Alarm Kodları</div>
          <table class="data-table" style="font-size:11px">
            <thead>
              <tr>
                <th style="width:120px">Ekran Alarmı</th>
                <th>Donanımsal Anlamı</th>
                <th>Arıza Arama & Saha Çözümü</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong style="color:var(--red)">ER97 I/O LINK FAILURE</strong></td>
                <td>Haberleşme hattı tamamen koptu.</td>
                <td>Sarı I/O ünitelerinin 24V DC besleme sigortalarını ölçün. JD1A/JD1B metal soketlerinin yuvalarına tam oturduğundan emin olun.</td>
              </tr>
              <tr>
                <td><strong style="color:var(--red)">ER96 I/O LINK FAILURE</strong></td>
                <td>Genişleme kartında veya slotta hata var.</td>
                <td>Sarı modüllerin arkasındaki sabitleme tırnaklarını kontrol edin. Gevşeme varsa kartı söküp pinleri temizleyin ve yeniden oturtun.</td>
              </tr>
              <tr>
                <td><strong style="color:var(--red)">SYS_ALM 160 I/O LINK</strong></td>
                <td>Ana kart FSSB / optik link arızası.</td>
                <td>COP10A optik kablo hattındaki tozlanmayı temizleyin. Optik konnektörün kırmızı ışık verip vermediğini kontrol edin.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1.2fr; gap:16px">
        
        <!-- Left: Slot selector -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">🗺️ Donanımsal I/O Modülü Seçin</div>
          <div class="form-group">
            <label class="form-label">Sarı I/O Ünitesi Modülü</label>
            <select class="form-control" id="io-slot-select" onchange="showIoSlotMapping()">
              <option value="slot1">MODÜL 1 - 16 Girişli Dijital Giriş Kartı (Slot 1)</option>
              <option value="slot2">MODÜL 2 - 16 Çıkışlı Dijital Çıkış Kartı (Slot 2)</option>
              <option value="slot3">MODÜL 3 - Operatör Paneli Dahili Kartı (Slot 3)</option>
            </select>
          </div>

          <div id="io-slot-details" style="background:var(--bg-card2); border:1px solid var(--border); padding:12px; border-radius:4px; font-size:12px">
            <div style="font-weight:bold; color:var(--text-accent); margin-bottom:6px" id="io-slot-name">MODÜL 1 - Dijital Giriş Kartı</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px">
              <span>PMC Lojik Adres Aralığı:</span>
              <strong id="io-slot-addr" style="font-family:monospace; color:var(--green)">X0.0 - X1.7</strong>
            </div>
            <div style="display:flex; justify-content:space-between">
              <span>Fiziksel Konnektör:</span>
              <strong id="io-slot-conn" style="font-family:monospace">CB104 (50-Pin)</strong>
            </div>
          </div>
        </div>

        <!-- Right: Terminal Pin mapping list -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">🔌 Pin ve PMC Lojik Adres Eşlemesi</div>
          <div style="overflow-y:auto; max-height:300px; background:#0f172a; padding:12px; border-radius:4px; border:1px solid var(--border)">
            <table class="data-table" style="font-size:11.5px; font-family:monospace">
              <thead>
                <tr>
                  <th>Fiziksel Pin No</th>
                  <th>Sinyal Yönü</th>
                  <th>PMC Lojik Adresi</th>
                  <th>Tipik Fonksiyon (CNC)</th>
                </tr>
              </thead>
              <tbody id="io-mapping-tbody"></tbody>
            </table>
          </div>
        </div>

      </div>
    `;
    setTimeout(showIoSlotMapping, 10);
  }
};

window.showIoSlotMapping = function() {
  const select = document.getElementById('io-slot-select');
  if (!select) return;

  const val = select.value;
  const tbody = document.getElementById('io-mapping-tbody');
  if (!tbody) return;

  const slotData = {
    slot1: {
      name: "MODÜL 1 - 16 Girişli Dijital Giriş Kartı (Slot 1)",
      addr: "X0.0 - X1.7",
      conn: "CB104 (20-Pin Klemens)",
      mapping: [
        { pin: "Pin 1 (X0.0)", dir: "Giriş (IN)", addr: "X0.0", func: "Acil Stop Butonu (ESP)" },
        { pin: "Pin 2 (X0.1)", dir: "Giriş (IN)", addr: "X0.1", func: "Eksen Limit Limit Switch +" },
        { pin: "Pin 3 (X0.2)", dir: "Giriş (IN)", addr: "X0.2", func: "Eksen Limit Limit Switch -" },
        { pin: "Pin 4 (X0.3)", dir: "Giriş (IN)", addr: "X0.3", func: "Kabin Kapağı Emniyet Sensörü" },
        { pin: "Pin 5 (X0.4)", dir: "Giriş (IN)", addr: "X0.4", func: "Kızak Yağ Seviyesi Switch'i" },
        { pin: "Pin 6 (X0.5)", dir: "Giriş (IN)", addr: "X0.5", func: "Hidrolik Basınç Okuma Girişi" },
        { pin: "Pin 7 to 16", dir: "Giriş (IN)", addr: "X0.6 - X1.7", func: "Kullanıcı Tanımlı Genel Sensörler" }
      ]
    },
    slot2: {
      name: "MODÜL 2 - 16 Çıkışlı Dijital Çıkış Kartı (Slot 2)",
      addr: "Y0.0 - Y1.7",
      conn: "CB105 (20-Pin Klemens)",
      mapping: [
        { pin: "Pin 1 (Y0.0)", dir: "Çıkış (OUT)", addr: "Y0.0", func: "Merkezi Yağlama Motor Rölesi" },
        { pin: "Pin 2 (Y0.1)", dir: "Çıkış (OUT)", addr: "Y0.1", func: "Kabin İçi Soğutucu Solenoid Valf" },
        { pin: "Pin 3 (Y0.2)", dir: "Çıkış (OUT)", addr: "Y0.2", func: "Hidrolik Motor Kontaktörü Tetik" },
        { pin: "Pin 4 (Y0.3)", dir: "Çıkış (OUT)", addr: "Y0.3", func: "Ayna Hidrolik Bobin Sıkma Rölesi" },
        { pin: "Pin 5 (Y0.4)", dir: "Çıkış (OUT)", addr: "Y0.4", func: "Ayna Hidrolik Bobin Açma Rölesi" },
        { pin: "Pin 6 (Y0.5)", dir: "Çıkış (OUT)", addr: "Y0.5", func: "Fener Mili Yağ Soğutma Pompası" },
        { pin: "Pin 7 to 16", dir: "Çıkış (OUT)", addr: "Y0.6 - Y1.7", func: "Genel Valf / Röle Tetik çıkışları" }
      ]
    },
    slot3: {
      name: "MODÜL 3 - Operatör Paneli Dahili Giriş Kartı (Slot 3)",
      addr: "X4.0 - X7.7",
      conn: "Dahili Şerit Kablo (Flat Cable)",
      mapping: [
        { pin: "Matrix 1 (X4.0)", dir: "Giriş (IN)", addr: "X4.0", func: "Panel Cycle Start Butonu" },
        { pin: "Matrix 2 (X4.1)", dir: "Giriş (IN)", addr: "X4.1", func: "Panel Feed Hold Butonu" },
        { pin: "Matrix 3 (X4.2)", dir: "Giriş (IN)", addr: "X4.2", func: "MDI Input Buton Girişi" },
        { pin: "Matrix 4 (X4.3)", dir: "Giriş (IN)", addr: "X4.3", func: "Mod Seçici Switche (AUTO/MDI/JOG)" },
        { pin: "Matrix 5 to 32", dir: "Giriş (IN)", addr: "X4.4 - X7.7", func: "Panel Diğer Tuş Girişleri" }
      ]
    }
  };

  const current = slotData[val];
  if (!current) return;

  document.getElementById('io-slot-name').innerText = current.name;
  document.getElementById('io-slot-addr').innerText = current.addr;
  document.getElementById('io-slot-conn').innerText = current.conn;

  tbody.innerHTML = current.mapping.map(m => `
    <tr>
      <td>${m.pin}</td>
      <td><span class="tag ${m.dir.includes('Giriş') ? 'tag-blue' : 'tag-orange'}">${m.dir}</span></td>
      <td style="color:var(--text-accent); font-weight:bold">${m.addr}</td>
      <td style="color:var(--text-secondary)">${m.func}</td>
    </tr>
  `).join('');
};

// ════════════════════════════════════════════════════════════════
//  FANUC PARAMETRE & PROGRAM YEDEKLEME/YÜKLEME SİHİRBAZI


    api = { renderIOLink };
    return api;
  }
  global.MTBIOLinkFeature = Object.freeze({ initialize });
})(window);
