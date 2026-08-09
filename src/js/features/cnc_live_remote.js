/**
 * CNC Live Remote
 * Extracted from renderer.js for modular architecture.
 * Auto-generated — do not hand-edit without updating renderer.js delegation.
 */
(function MTBCncLiveRemote(global) {
  'use strict';

function renderCncDashboard() {
  const page = createPage('cnc_dashboard');
  page.style.height = '100%';
  page.style.display = 'flex';
  page.style.flexDirection = 'column';
  page.style.padding = '0';

  // Sort machines alphabetically by name (Turkish locale aware natural sort)
  const sortedMachines = [...State.machines].sort((a, b) => {
    return String(a.numarasi || '').localeCompare(String(b.numarasi || ''), 'tr-TR', { numeric: true, sensitivity: 'base' });
  });

  // Build dynamic dropdown option elements from sortedMachines
  const machineOptions = sortedMachines.map(m => {
    return `<option value="${m.id}">${escapeHTML(m.numarasi)} (${escapeHTML(m.tip || 'CNC')})</option>`;
  }).join('');

  page.innerHTML = `
    <div style="padding:16px 18px 12px; background:var(--bg-base); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
      <div><div style="font-size:18px; font-weight:750; letter-spacing:-.2px;">Canlı Tezgâh Merkezi</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">FOCAS telemetrisi salt-okunur izleme modunda çalışır. Yapılandırma ve adaptör başlatma yönetici yetkisi ister.</div></div>
      <div id="cnc-adapter-state" class="tag tag-gray">Telemetri durumu kontrol ediliyor</div>
    </div>
    <div style="background: var(--bg-surface); padding: 8px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 14px; flex-wrap: wrap; flex-shrink: 0; box-shadow: var(--shadow-sm);">
      <div style="display: flex; align-items: center; gap: 8px;">
        <label style="font-weight: 700; font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">İzleme Yuvası:</label>
        <select id="cnc-sel-slot" class="form-control" style="width: 145px; padding: 4px 8px; font-size: 12px; background: var(--bg-card2); border-color: var(--border);">
          <option value="0">Slot 1 (Sol Panel)</option>
          <option value="1">Slot 2 (Sağ Panel)</option>
        </select>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <label style="font-weight: 700; font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Tezgah:</label>
        <select id="cnc-sel-machine" class="form-control" style="width: 180px; padding: 4px 8px; font-size: 12px; background: var(--bg-card2); border-color: var(--border);">
          <option value="">-- Tezgah Seçin --</option>
          ${machineOptions}
        </select>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <label style="font-weight: 700; font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">IP Adresi:</label>
        <input type="text" id="cnc-sel-ip" class="form-control" placeholder="192.168.30.20" style="width: 130px; padding: 4px 8px; font-size: 12px; background: var(--bg-card2); border-color: var(--border);" />
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <label style="font-weight: 700; font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Port:</label>
        <input type="number" id="cnc-sel-port" class="form-control" placeholder="8193" style="width: 75px; padding: 4px 8px; font-size: 12px; background: var(--bg-card2); border-color: var(--border);" value="8193" />
      </div>
      <button class="btn btn-primary btn-sm" id="btn-cnc-connect" style="padding: 5px 12px; font-size: 11.5px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
        <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2.5;"><polyline points="16 16 20 20 24 16"/><path d="M18 20V10a4 4 0 00-8 0v4"/><path d="M12 10a4 4 0 00-8 0v10"/><polyline points="8 16 4 20 0 16"/></svg>
        Bağlan ve İzle
      </button>
      <button class="btn btn-secondary btn-sm" id="btn-cnc-scan" onclick="showFocasScannerModal()" style="padding: 5px 12px; font-size: 11.5px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
        🌐 Otomatik Ağ Tarayıcısı
      </button>
    </div>
    <div style="flex: 1; position: relative; width: 100%; height: 100%;">
      <iframe src="./dashboard/index.html" style="width: 100%; height: 100%; border: none; background: #171a1c;"></iframe>
    </div>
  `;

  const selSlot = page.querySelector('#cnc-sel-slot');
  const selMachine = page.querySelector('#cnc-sel-machine');
  const txtIp = page.querySelector('#cnc-sel-ip');
  const txtPort = page.querySelector('#cnc-sel-port');
  const btnConnect = page.querySelector('#btn-cnc-connect');
  const isCncAdmin = State.currentUser?.role === 'admin';
  if (!isCncAdmin) {
    txtIp.readOnly = true;
    txtPort.readOnly = true;
    btnConnect.style.display = 'none';
  }
  window.electronAPI.getAdapterStatus().then(res => {
    const badge = page.querySelector('#cnc-adapter-state');
    if (!badge || !res?.ok) return;
    const running = res.data?.state === 'running';
    badge.className = `tag ${running ? 'tag-green' : 'tag-orange'}`;
    badge.textContent = running ? '● Telemetri adaptörü çalışıyor' : `● Adaptör: ${res.data?.state || 'bilinmiyor'}`;
  });

  // Load slot names from LocalStorage
  State.cnc_slot1_name = localStorage.getItem('cnc_slot1_name') || 'Fanuc Tezgah 1';
  State.cnc_slot2_name = localStorage.getItem('cnc_slot2_name') || 'Fanuc Tezgah 2';

  // Read current IPs/ports from adapter config to update State.machines
  window.electronAPI.readFile('bin/adapter.config.json').then(res => {
    if (res.ok) {
      try {
        const configData = JSON.parse(res.data);
        const m1 = configData[0];
        const m2 = configData[1];
        if (m1) {
          const found = State.machines.find(m => m.numarasi === State.cnc_slot1_name);
          if (found) {
            found.ip = m1.ip;
            found.port = m1.port;
          }
        }
        if (m2) {
          const found = State.machines.find(m => m.numarasi === State.cnc_slot2_name);
          if (found) {
            found.ip = m2.ip;
            found.port = m2.port;
          }
        }
        // Pre-fill fields with Slot 1 on startup if mapped
        if (State.cnc_slot1_name) {
          const match = State.machines.find(m => m.numarasi === State.cnc_slot1_name);
          if (match) {
            selMachine.value = match.id;
            txtIp.value = match.ip || '';
            txtPort.value = match.port || 8193;
          }
        }
      } catch (e) {}
    }
  });

  selMachine.addEventListener('change', () => {
    const mId = parseInt(selMachine.value);
    if (!isNaN(mId)) {
      const machine = State.machines.find(m => m.id === mId);
      if (machine) {
        txtIp.value = machine.ip || '';
        txtPort.value = machine.port || 8193;
      }
    } else {
      txtIp.value = '';
      txtPort.value = '8193';
    }
  });

  selSlot.addEventListener('change', () => {
    const slotIdx = parseInt(selSlot.value);
    const targetName = slotIdx === 0 ? State.cnc_slot1_name : State.cnc_slot2_name;
    if (targetName) {
      const match = State.machines.find(m => m.numarasi === targetName);
      if (match) {
        selMachine.value = match.id;
        txtIp.value = match.ip || '';
        txtPort.value = match.port || 8193;
        return;
      }
    }
    selMachine.value = '';
    txtIp.value = '';
    txtPort.value = '8193';
  });

  btnConnect.addEventListener('click', async () => {
    if (!isCncAdmin) { showToast('Bağlantı ayarları yalnızca yönetici tarafından değiştirilebilir.', 'error'); return; }
    const slotIdx = parseInt(selSlot.value);
    const mId = parseInt(selMachine.value);
    const ip = txtIp.value.trim();
    const port = parseInt(txtPort.value) || 8193;

    if (isNaN(mId)) {
      showToast('Lütfen listeden bir tezgah seçin.', 'error');
      return;
    }
    if (!ip) {
      showToast('Lütfen geçerli bir IP adresi girin.', 'error');
      return;
    }

    const machine = State.machines.find(m => m.id === mId);
    if (!machine) return;

    machine.ip = ip;
    machine.port = port;
    await saveMachines();

    if (slotIdx === 0) {
      State.cnc_slot1_name = machine.numarasi;
      localStorage.setItem('cnc_slot1_name', machine.numarasi);
    } else {
      State.cnc_slot2_name = machine.numarasi;
      localStorage.setItem('cnc_slot2_name', machine.numarasi);
    }

    try {
      let configData = [
        { id: "Fanuc", ip: "192.168.30.20", port: 8193, shdrPort: 7880, prefix: "f" },
        { id: "Fanuc2", ip: "192.168.30.21", port: 8193, shdrPort: 7881, prefix: "f2" }
      ];

      const readRes = await window.electronAPI.readFile('bin/adapter.config.json');
      if (readRes.ok) {
        try { configData = JSON.parse(readRes.data); } catch (e) {}
      }

      configData[slotIdx] = {
        id: slotIdx === 0 ? "Fanuc" : "Fanuc2",
        ip: ip,
        port: port,
        shdrPort: slotIdx === 0 ? 7880 : 7881,
        prefix: slotIdx === 0 ? "f" : "f2"
      };

      const writeRes = await window.electronAPI.writeFile('bin/adapter.config.json', JSON.stringify(configData, null, 2));
      if (writeRes && writeRes.ok) {
        showToast(`${machine.numarasi} bağlantısı kuruluyor, lütfen bekleyin...`, 'success');
        await window.electronAPI.restartAdapter();

        // Refresh iframe to reload app.js with updated State.cnc_slotX_name values
        setTimeout(() => {
          const iframe = page.querySelector('iframe');
          if (iframe) iframe.src = iframe.src;
        }, 800);
      } else {
        throw new Error(writeRes?.error || 'Konfigürasyon yazılamadı.');
      }
    } catch (err) {
      showToast('Bağlantı kaydedilemedi: ' + err.message, 'error');
    }
  });

  return page;
}

function renderCncScreenViewer() {
  const page = createPage('cnc_screen_viewer');

  const sortedMachines = [...State.machines].sort((a, b) => {
    return String(a.numarasi || '').localeCompare(String(b.numarasi || ''), 'tr-TR', { numeric: true, sensitivity: 'base' });
  });

  const machineOptions = sortedMachines.map(m => {
    return `<option value="${m.id}" data-ip="${escapeHTML(m.ip || '192.168.1.50')}">${escapeHTML(m.numarasi)} (${escapeHTML(m.tip || 'CNC')})</option>`;
  }).join('');

  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>🖥️ Canlı CNC Ekran İzleyici (Remote VNC / iHMI Display)</h1>
          <p>FANUC CNC kontrolör ekranını uzaktan canlı izleyin, tuş takımı ile kumanda edin ve ekran görüntüsü kaydedin</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary" onclick="captureCncScreenSnapshot(document.getElementById('cnc-view-mach-sel').value)">
            📸 Ekran Görüntüsü Al & Bakıma Ekle
          </button>
        </div>
      </div>
    </div>

    <div class="page-body">
      <!-- Control Panel & Machine Picker -->
      <div class="card mb-4" style="padding:14px">
        <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:12px">
          <div class="flex items-center gap-3" style="flex-wrap:wrap">
            <label style="font-weight:700; font-size:12px; color:var(--text-secondary)">Tezgâh Seçin:</label>
            <select id="cnc-view-mach-sel" class="form-control" style="width:200px" onchange="onCncScreenMachineChange()">
              <option value="">-- Tezgâh Seçin --</option>
              ${machineOptions}
            </select>

            <label style="font-weight:700; font-size:12px; color:var(--text-secondary)">IP Adresi:</label>
            <input type="text" id="cnc-view-ip-input" class="form-control" placeholder="192.168.1.50" style="width:140px" value="192.168.1.50" />

            <label style="font-weight:700; font-size:12px; color:var(--text-secondary)">VNC Port:</label>
            <input type="number" id="cnc-view-port-input" class="form-control" placeholder="5900" style="width:80px" value="5900" />
          </div>

          <div class="flex gap-2">
            <button class="btn btn-primary btn-sm" onclick="connectCncScreenStream(document.getElementById('cnc-view-ip-input').value, document.getElementById('cnc-view-port-input').value)">
              ▶️ Canlı Bağlantıyı Başlat
            </button>
            <button class="btn btn-secondary btn-sm" onclick="disconnectCncScreenStream()">
              ⏹️ Bağlantıyı Kes
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between mt-3" style="font-size:11.5px; border-top:1px solid var(--border); padding-top:10px">
          <div id="cnc-screen-status-badge" class="tag tag-gray">⚪ Çevrimdışı</div>
          <div id="cnc-screen-status-text" style="color:var(--text-muted)">Bağlantı Bekleniyor...</div>
        </div>
      </div>

      <!-- Main Live Screen Area -->
      <div id="cnc-screen-frame-wrap" class="card mb-4" style="padding:10px; background:#0b0f19">
        <div style="width:100%; height:380px; background:var(--bg-card2); border:2px dashed var(--border); border-radius:var(--radius-md); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:30px">
          <div style="font-size:36px; margin-bottom:10px; opacity:0.6">🖥️</div>
          <div style="font-weight:600; font-size:14px; margin-bottom:6px">CNC Canlı Ekran Akışı Bekleniyor</div>
          <div style="font-size:12px; color:var(--text-muted); max-width:400px">
            Yukarıdaki tezgâhı seçip "Canlı Bağlantıyı Başlat" butonuna basarak uzaktan ekran izlemeyi başlatın.
          </div>
        </div>
      </div>

      <!-- Virtual FANUC Keypad Control -->
      <div class="card" style="padding:16px">
        <div class="card-title mb-3" style="display:flex; align-items:center; justify-content:between">
          <span>⌨️ Sanal FANUC Tuş Takımı (Remote Keypad)</span>
          <span style="font-size:11px; color:var(--text-muted)">Tıkladığınız tuş canlı CNC kontrolörüne iletilir</span>
        </div>

        <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:8px">
          <button class="btn btn-danger btn-sm" onclick="sendCncKeypress('RESET')" style="font-weight:bold; font-size:11px">🔴 RESET</button>
          <button class="btn btn-secondary btn-sm" onclick="sendCncKeypress('POS')" style="font-weight:bold; font-size:11px">📍 POS</button>
          <button class="btn btn-secondary btn-sm" onclick="sendCncKeypress('PROG')" style="font-weight:bold; font-size:11px">📜 PROG</button>
          <button class="btn btn-secondary btn-sm" onclick="sendCncKeypress('OFS/SET')" style="font-weight:bold; font-size:11px">📐 OFS/SET</button>
          <button class="btn btn-secondary btn-sm" onclick="sendCncKeypress('SYSTEM')" style="font-weight:bold; font-size:11px">⚙️ SYSTEM</button>
          <button class="btn btn-secondary btn-sm" onclick="sendCncKeypress('MESSAGE')" style="font-weight:bold; font-size:11px">⚠️ MESSAGE</button>

          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('F1')" style="font-size:11px">F1</button>
          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('F2')" style="font-size:11px">F2</button>
          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('F3')" style="font-size:11px">F3</button>
          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('F4')" style="font-size:11px">F4</button>
          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('F5')" style="font-size:11px">F5</button>
          <button class="btn btn-ghost btn-sm" onclick="sendCncKeypress('CHAPTER')" style="font-size:11px">◀ ▶ NEXT</button>
        </div>
      </div>
    </div>
  `;

  return page;
}

window.onCncScreenMachineChange = function() {
  const sel = document.getElementById('cnc-view-mach-sel');
  const ipInput = document.getElementById('cnc-view-ip-input');
  if (!sel || !ipInput) return;

  const opt = sel.options[sel.selectedIndex];
  if (opt && opt.dataset && opt.dataset.ip) {
    ipInput.value = opt.dataset.ip;
  }
};

// ── FANUC Network Scanner & Machine Matcher ────────────────────────
let lastScannerResults = [];

window.showFocasScannerModal = async function() {
  const content = `
    <div class="modal-header">
      <div class="modal-title" style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:18px;">🌐</span>
        <span>FANUC Otomatik Ağ Tarayıcısı & Tezgah Eşleştirici</span>
      </div>
      <button class="modal-close" onclick="closeModal('focas-scanner')">&times;</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap:14px; font-size:12px;">
      <div style="background:var(--bg-card2); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border);">
        <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">🔍 Gelişmiş Ağ Taraması & Çoklu Port Sorgulama</div>
        <p style="color:var(--text-secondary); margin:0; line-height:1.4;">
          Uygulama yerel ağ kartlarını ve VLAN bloklarını taraayarak FOCAS (8193), FTP (21) ve MTConnect (5000) portlarını eşzamanlı sorgular. Ağ gecikme sürelerini (latency) milisaniye cinsinden ölçer.
        </p>
      </div>

      <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
        <div style="flex:1; min-width:200px;">
          <label class="form-label" style="font-size:11px; font-weight:700;">Hedef Subnet / IP Bloğu:</label>
          <input type="text" id="scanner-subnet-input" class="form-control" placeholder="192.168.30.1-254 (Veya 192.168.30)" style="font-size:12px;" />
        </div>
        <div style="width:130px;">
          <label class="form-label" style="font-size:11px; font-weight:700;">Sorgulanacak Portlar:</label>
          <input type="text" id="scanner-ports-input" class="form-control" value="8193, 21, 5000" style="font-size:12px;" />
        </div>
        <button class="btn btn-primary" id="btn-run-scanner" onclick="runFocasScanner()" style="padding:7px 16px;">
          ⚡ Taramayı Başlat
        </button>
      </div>

      <!-- Live Scan Progress -->
      <div id="scanner-progress-box" style="display:none; background:var(--bg-card2); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--accent); color:var(--text-accent);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:700;">● Çoklu Port & Latency Taraması Yapılıyor...</span>
          <span id="scanner-progress-status" class="font-mono">IP adresleri sorgulanıyor...</span>
        </div>
        <div style="height:4px; background:var(--border); border-radius:2px; overflow:hidden;">
          <div id="scanner-progress-bar" style="width:30%; height:100%; background:var(--accent); transition:width 0.3s;"></div>
        </div>
      </div>

      <!-- Discovered Devices Section -->
      <div id="scanner-results-container" style="display:none; flex-direction:column; gap:10px; margin-top:6px;">
        <div style="font-weight:700; color:var(--text-primary); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <span>🟢 Bulunan CNC Cihazları, Latency & Servis Haritası</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="exportScannerResultsCSV()" style="font-size:11px; padding:3px 10px;">
              📥 Ağ Haritasını CSV İndir
            </button>
            <span id="scanner-count-badge" class="tag tag-green">0 Cihaz</span>
          </div>
        </div>
        <div id="scanner-results-list" style="max-height:340px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:4px;"></div>
      </div>
    </div>
  `;

  showModal('focas-scanner', content, 'lg');

  // Auto-detect local subnet in background to prefill input
  try {
    const scanRes = await window.electronAPI.scanFocasNetwork({ subnet: '', timeoutMs: 1 });
    if (scanRes && scanRes.detectedSubnets && scanRes.detectedSubnets.length > 0) {
      const input = document.getElementById('scanner-subnet-input');
      if (input) input.value = `${scanRes.detectedSubnets[0].subnetPrefix}.1-254`;
    }
  } catch (e) {}
};

window.runFocasScanner = async function() {
  const subnetInput = document.getElementById('scanner-subnet-input')?.value.trim() || '';
  const portsRaw = document.getElementById('scanner-ports-input')?.value || '8193, 21, 5000';
  const parsedPorts = portsRaw.split(',').map(p => parseInt(p.trim())).filter(Boolean);
  const btn = document.getElementById('btn-run-scanner');
  const progressBox = document.getElementById('scanner-progress-box');
  const progressBar = document.getElementById('scanner-progress-bar');
  const progressStatus = document.getElementById('scanner-progress-status');
  const resultsContainer = document.getElementById('scanner-results-container');
  const resultsList = document.getElementById('scanner-results-list');
  const countBadge = document.getElementById('scanner-count-badge');

  if (btn) btn.disabled = true;
  if (progressBox) progressBox.style.display = 'block';
  if (progressBar) progressBar.style.width = '20%';
  if (progressStatus) progressStatus.textContent = 'Paralel TCP port ve latency sorgusu başlatılıyor...';

  try {
    const response = await window.electronAPI.scanFocasNetwork({
      subnet: subnetInput,
      ports: parsedPorts,
      timeoutMs: 350
    });

    if (progressBar) progressBar.style.width = '100%';
    if (progressStatus) progressStatus.textContent = 'Tarama tamamlandı!';

    setTimeout(() => {
      if (progressBox) progressBox.style.display = 'none';
    }, 400);

    if (!response || !response.ok) {
      showToast('Ağ taraması sırasında hata oluştu: ' + (response?.error || 'Bilinmeyen hata'), 'error');
      if (btn) btn.disabled = false;
      return;
    }

    const devices = response.foundDevices || [];
    lastScannerResults = devices;
    if (resultsContainer) resultsContainer.style.display = 'flex';
    if (countBadge) countBadge.textContent = `${devices.length} Cihaz Bulundu`;

    if (!devices.length) {
      if (resultsList) {
        resultsList.innerHTML = `
          <div style="text-align:center; padding:20px; color:var(--text-muted); background:var(--bg-card2); border-radius:var(--radius-md);">
            🔍 Taranan IP bloğunda belirtilen portları (8193, 21, 5000) açık cihaz bulunamadı.<br>
            <small style="color:var(--text-secondary); display:block; margin-top:4px;">Lütfen tezgâh panosundaki Ethernet kablosunun takılı ve FOCAS2 / FTP servislerinin aktif olduğunu kontrol edin.</small>
          </div>
        `;
      }
      if (btn) btn.disabled = false;
      return;
    }

    // Render discovered devices with latency quality badges and multi-port indicators
    const sortedMachines = [...State.machines].sort((a, b) => {
      return String(a.numarasi || '').localeCompare(String(b.numarasi || ''), 'tr-TR', { numeric: true, sensitivity: 'base' });
    });

    if (resultsList) {
      resultsList.innerHTML = devices.map((dev, idx) => {
        const matched = sortedMachines.find(m => m.ip === dev.ip);
        const matchLabel = matched ? `🟢 Tanımlı Tezgah: ${escapeHTML(matched.numarasi)}` : '⚠️ Yeni Cihaz (Tanımsız IP)';

        const machineOptionsHtml = sortedMachines.map(m => `
          <option value="${m.id}" ${matched && matched.id === m.id ? 'selected' : ''}>${escapeHTML(m.numarasi)} (${escapeHTML(m.tip || 'CNC')})</option>
        `).join('');

        // Latency badge formatting
        let latTagClass = 'tag-green';
        if (dev.quality === 'poor') latTagClass = 'tag-red';
        else if (dev.quality === 'good') latTagClass = 'tag-orange';

        // Service badges
        const serviceBadges = [];
        if (dev.services?.focas) serviceBadges.push('<span class="tag tag-blue" style="font-size:10px;">FOCAS (8193)</span>');
        if (dev.services?.ftp) serviceBadges.push('<span class="tag tag-purple" style="font-size:10px;">FTP (21)</span>');
        if (dev.services?.mtconnect) serviceBadges.push('<span class="tag tag-teal" style="font-size:10px;">MTConnect (5000)</span>');
        if (!serviceBadges.length) serviceBadges.push(`<span class="tag tag-gray" style="font-size:10px;">Port: ${dev.openPorts.join(', ')}</span>`);

        return `
          <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
            <div style="flex:1; min-width:240px;">
              <div style="font-weight:750; font-size:13px; color:var(--text-primary); display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="font-mono" style="color:var(--text-accent); font-size:13.5px;">IP: ${dev.ip}</span>
                <span class="tag ${latTagClass}" style="font-size:10.5px;">⚡ ${dev.latencyMs} ms (${dev.qualityLabel})</span>
              </div>
              <div style="font-size:11px; color:var(--text-secondary); margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="font-weight:600; color:var(--text-primary);">${dev.cncModel}</span>
                <span>•</span>
                <span>${matchLabel}</span>
              </div>
              <div style="display:flex; align-items:center; gap:4px; margin-top:6px; flex-wrap:wrap;">
                ${serviceBadges.join('')}
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <select id="scan-assign-m-${idx}" class="form-control" style="width:150px; font-size:11.5px; padding:3px 6px;">
                <option value="">-- Tezgâh Eşleştir --</option>
                ${machineOptionsHtml}
              </select>
              <button class="btn btn-secondary btn-sm" onclick="saveDiscoveredMachine('${dev.ip}', ${dev.openPorts[0] || 8193}, 'scan-assign-m-${idx}')" style="padding:4px 10px; font-size:11px;">
                💾 Eşleştir
              </button>
              ${!matched ? `<button class="btn btn-primary btn-sm" onclick="autoCreateMachineFromScan('${dev.ip}', ${dev.openPorts[0] || 8193}, '${dev.cncModel}')" style="padding:4px 10px; font-size:11px;">✨ Yeni Tezgah Ekle</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    showToast('Ağ tarama hatası: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.saveDiscoveredMachine = async function(ip, port, selectId) {
  const sel = document.getElementById(selectId);
  if (!sel || !sel.value) {
    showToast('Lütfen IP adresinin atanacağı tezgahı listeden seçin.', 'warning');
    return;
  }
  const machineId = parseInt(sel.value);
  const machine = State.machines.find(m => m.id === machineId);
  if (!machine) return;

  machine.ip = ip;
  machine.port = port;

  try {
    await window.electronAPI.upsertRecord('machines', machine.id, machine);
    showToast(`✓ ${machine.numarasi} IP adresi ${ip}:${port} olarak güncellendi ve kaydedildi.`, 'success');
  } catch (e) {
    showToast('Kaydetme hatası: ' + e.message, 'error');
  }
};

window.autoCreateMachineFromScan = async function(ip, port, modelName) {
  const nextNumber = `CNF ${String(State.machines.length + 1).padStart(2, '0')}`;
  const newMachine = {
    id: Date.now(),
    numarasi: nextNumber,
    ip: ip,
    port: port || 8193,
    tip: modelName || 'FANUC CNC',
    model: modelName || 'Series 0i-MF',
    durum: 'Aktif',
    eklenmeTarihi: new Date().toISOString().slice(0, 10)
  };

  try {
    State.machines.push(newMachine);
    await window.electronAPI.upsertRecord('machines', newMachine.id, newMachine);
    showToast(`✓ Yeni Tezgah ${nextNumber} (${ip}:${port}) başarıyla oluşturuldu ve kaydedildi!`, 'success');
    runFocasScanner();
  } catch (e) {
    showToast('Tezgah ekleme hatası: ' + e.message, 'error');
  }
};

window.exportScannerResultsCSV = function() {
  if (!lastScannerResults || !lastScannerResults.length) {
    showToast('Dışa aktarılacak tarama sonucu bulunamadı.', 'warning');
    return;
  }

  let csv = '\uFEFFIP Adresi;Ağ Gecikmesi (ms);Hat Kalitesi;Model;Açık Portlar;FOCAS;FTP;MTConnect;Tanımlı Tezgah\n';
  for (const dev of lastScannerResults) {
    const matched = State.machines.find(m => m.ip === dev.ip);
    const mName = matched ? matched.numarasi : 'Tanımsız';
    csv += `${dev.ip};${dev.latencyMs};${dev.qualityLabel.replace(/,/, ' ')};${dev.cncModel};"${dev.openPorts.join(', ')}";${dev.services.focas ? 'EVET' : 'HAYIR'};${dev.services.ftp ? 'EVET' : 'HAYIR'};${dev.services.mtconnect ? 'EVET' : 'HAYIR'};${mName}\n`;
  }

  window.electronAPI.exportCSV(csv, `fanuc-network-scan-${new Date().toISOString().slice(0, 10)}.csv`);
};

window.triggerParamFileUpload = function() { window.ParamInspectorFeature?.triggerParamFileUpload(); };
window.onParamFileSelected = function(e) { window.ParamInspectorFeature?.onParamFileSelected(e); };

})(window);
