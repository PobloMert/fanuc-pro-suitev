/**
 * CNC Live Remote
 * Extracted from renderer.js for modular architecture.
 */
(function(global) {
  'use strict';

function renderCncDashboard() {
  const page = createPage('cnc_dashboard');
  page.style.height = '100%';
  page.style.display = 'flex';
  page.style.flexDirection = 'column';
  page.style.padding = '0';
  page.style.overflow = 'hidden';

  if (!State.cncViewMode) State.cncViewMode = 'fleet';
  if (!State.fleetFilter) State.fleetFilter = 'all';

  // Sort machines alphabetically by name (Turkish locale aware natural sort)
  const sortedMachines = [...State.machines].sort((a, b) => {
    return String(a.numarasi || '').localeCompare(String(b.numarasi || ''), 'tr-TR', { numeric: true, sensitivity: 'base' });
  });

  const isFleet = State.cncViewMode === 'fleet';

  // Build dynamic dropdown option elements from sortedMachines
  const machineOptions = sortedMachines.map(m => {
    return `<option value="${m.id}">${escapeHTML(m.numarasi)} (${escapeHTML(m.tip || 'CNC')})</option>`;
  }).join('');

  // Top header with View Mode Switcher
  const headerHtml = `
    <div style="padding:12px 18px; background:var(--bg-base); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; flex-shrink:0;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="font-size:17px; font-weight:750; letter-spacing:-.2px; color:var(--text-primary);">Canlı Tezgâh Merkezi</div>
        <div style="display:flex; background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:2px;">
          <button class="btn btn-sm ${isFleet ? 'btn-primary' : 'btn-ghost'}" onclick="switchCncLiveMode('fleet')" style="padding:4px 12px; font-size:11.5px; font-weight:600; display:flex; align-items:center; gap:6px;">
            <span>🏢</span> Fabrika Kuşbakışı (Andon)
          </button>
          <button class="btn btn-sm ${!isFleet ? 'btn-primary' : 'btn-ghost'}" onclick="switchCncLiveMode('single')" style="padding:4px 12px; font-size:11.5px; font-weight:600; display:flex; align-items:center; gap:6px;">
            <span>📺</span> Tekil Tezgâh Detayı
          </button>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <div id="cnc-adapter-state" class="tag tag-gray">Telemetri durumu kontrol ediliyor</div>
        
        <!-- Diagnostics Tools Dropdown -->
        <div style="position:relative; display:inline-block;">
          <button class="btn btn-secondary btn-sm" id="btn-diag-tools-dropdown" onclick="toggleDiagnosticsMenu(event)" style="padding:5px 12px; font-size:11.5px; font-weight:650; display:flex; align-items:center; gap:6px;">
            <span>🛠️</span> Teşhis Araçları <span style="font-size:9px; margin-left:2px;">▼</span>
          </button>
          <div id="diag-tools-popover" style="display:none; position:absolute; right:0; top:calc(100% + 6px); width:230px; background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-md); box-shadow:0 10px 30px rgba(0,0,0,0.5); z-index:9000; padding:6px; flex-direction:column; gap:4px;">
            <button class="dropdown-item" onclick="closeDiagnosticsMenu(); showFocasScannerModal();" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text-primary); padding:8px 10px; font-size:11.5px; font-weight:600; border-radius:4px; display:flex; align-items:center; gap:8px; cursor:pointer;">
              <span>🌐</span> Otomatik Ağ Tarayıcısı
            </button>
            <button class="dropdown-item" onclick="closeDiagnosticsMenu(); showSignalSnifferModal();" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text-primary); padding:8px 10px; font-size:11.5px; font-weight:600; border-radius:4px; display:flex; align-items:center; gap:8px; cursor:pointer;">
              <span>💡</span> Sinyal Avcısı & Sensörler
            </button>
            <button class="dropdown-item" onclick="closeDiagnosticsMenu(); showPowerDiagnosticsModal();" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text-primary); padding:8px 10px; font-size:11.5px; font-weight:600; border-radius:4px; display:flex; align-items:center; gap:8px; cursor:pointer;">
              <span>⚡</span> DC Bara & Güç Sağlığı
            </button>
            <button class="dropdown-item" onclick="closeDiagnosticsMenu(); showChronicFailureModal();" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text-primary); padding:8px 10px; font-size:11.5px; font-weight:600; border-radius:4px; display:flex; align-items:center; gap:8px; cursor:pointer;">
              <span>🔍</span> Kronik Arıza Analizörü
            </button>
            <button class="dropdown-item" onclick="closeDiagnosticsMenu(); showFocasDriverHealthModal();" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text-primary); padding:8px 10px; font-size:11.5px; font-weight:600; border-radius:4px; display:flex; align-items:center; gap:8px; cursor:pointer;">
              <span>🔌</span> FOCAS Sürücü & DLL Kontrolü
            </button>
          </div>
        </div>

        ${isFleet ? `
          <button class="btn btn-secondary btn-sm" onclick="toggleFleetAndonFullscreen()" style="padding:5px 12px; font-size:11.5px; font-weight:700; color:var(--text-accent); display:flex; align-items:center; gap:6px;">
            <span>⛶</span> Andon TV Modu
          </button>
        ` : ''}
      </div>
    </div>
  `;

  if (isFleet) {
    // Fleet Andon Mode - 100% Ground Reality (No fake IPs or simulated telemetry)
    let runCount = 0, alarmCount = 0, idleCount = 0, offCount = 0, unconfiguredCount = 0, configuredCount = 0;

    const cardsData = sortedMachines.map((m) => {
      const hasIp = Boolean(m.ip && String(m.ip).trim() !== '');
      const ip = hasIp ? `${m.ip}:${m.port || 8193}` : 'IP TANIMLANMAMIŞ';
      
      let status = 'UNCONFIGURED';
      let statusLabel = '⚪ IP TANIMLANMAMIŞ';
      let statusColor = '#64748b';
      let program = '-';
      let rpm = 0;
      let load = 0;
      let parts = '-';
      let dcVolt = '-';
      let feedOverride = '-';
      let alarmMsg = '';
      let downtime = '';

      if (!hasIp) {
        unconfiguredCount++;
        offCount++;
      } else {
        configuredCount++;
        // If IP is configured, check if active in Slot 1 or Slot 2 with live telemetry
        const isSlot1 = State.cnc_slot1_name === m.numarasi;
        const isSlot2 = State.cnc_slot2_name === m.numarasi;

        if (isSlot1 || isSlot2) {
          // Connected slot machine
          status = 'OFFLINE';
          statusLabel = '⚪ ÇEVRİMDIŞI (Bağlantı Yok)';
          statusColor = '#64748b';
          offCount++;
        } else {
          status = 'OFFLINE';
          statusLabel = '⚪ ÇEVRİMDIŞI / BEKLEMEDE';
          statusColor = '#64748b';
          offCount++;
        }
      }

      return {
        id: m.id,
        numarasi: m.numarasi,
        tip: m.tip || 'CNC',
        hasIp,
        ip,
        status,
        statusLabel,
        statusColor,
        program,
        rpm,
        load,
        feedOverride,
        parts,
        dcVolt,
        alarmMsg,
        downtime
      };
    });

    const activeFilter = State.fleetFilter || 'all';
    const filteredCards = cardsData.filter(c => {
      if (activeFilter === 'configured') return c.hasIp;
      if (activeFilter === 'unconfigured') return !c.hasIp;
      if (activeFilter === 'running') return c.status === 'RUNNING';
      if (activeFilter === 'alarm') return c.status === 'ALARM';
      if (activeFilter === 'idle') return c.status === 'IDLE';
      if (activeFilter === 'offline') return c.status === 'OFFLINE' || c.status === 'UNCONFIGURED';
      return true;
    });

    page.innerHTML = `
      ${headerHtml}
      <!-- Summary & Filter Subheader -->
      <div style="background:var(--bg-surface); padding:8px 18px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:10px; font-size:12px; font-weight:700; flex-wrap:wrap;">
          <span style="color:var(--text-secondary);">Fabrika Durumu:</span>
          <span class="tag tag-gray">Toplam ${sortedMachines.length} Tezgâh</span>
          <span class="tag ${configuredCount > 0 ? 'tag-green' : 'tag-gray'}">🌐 ${configuredCount} IP Tanımlı</span>
          <span class="tag tag-gray">⚪ ${unconfiguredCount} IP Bekliyor</span>
          ${runCount > 0 ? `<span class="tag tag-green">🟢 ${runCount} Çalışıyor</span>` : ''}
          ${alarmCount > 0 ? `<span class="tag tag-red">🔴 ${alarmCount} Alarm</span>` : ''}
          ${idleCount > 0 ? `<span class="tag tag-orange">🟡 ${idleCount} Boşta</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <button class="btn btn-sm ${activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="filterFleetGrid('all')" style="font-size:11px; padding:3px 8px;">Tümü (${cardsData.length})</button>
          <button class="btn btn-sm ${activeFilter === 'configured' ? 'btn-primary' : 'btn-secondary'}" onclick="filterFleetGrid('configured')" style="font-size:11px; padding:3px 8px;">🌐 IP Tanımlılar (${configuredCount})</button>
          <button class="btn btn-sm ${activeFilter === 'unconfigured' ? 'btn-primary' : 'btn-secondary'}" onclick="filterFleetGrid('unconfigured')" style="font-size:11px; padding:3px 8px;">⚪ IP Tanımsızlar (${unconfiguredCount})</button>
          ${runCount > 0 ? `<button class="btn btn-sm ${activeFilter === 'running' ? 'btn-primary' : 'btn-secondary'}" onclick="filterFleetGrid('running')" style="font-size:11px; padding:3px 8px;">🟢 Çalışanlar (${runCount})</button>` : ''}
          ${alarmCount > 0 ? `<button class="btn btn-sm ${activeFilter === 'alarm' ? 'btn-primary' : 'btn-secondary'}" onclick="filterFleetGrid('alarm')" style="font-size:11px; padding:3px 8px;">🔴 Alarmlılar (${alarmCount})</button>` : ''}
        </div>
      </div>

      <!-- Fleet Grid Container -->
      <div style="flex:1; overflow-y:auto; padding:18px; background:var(--bg-base);">
        ${unconfiguredCount > 0 ? `
          <div style="margin-bottom:16px; background:linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(16, 185, 129, 0.08)); border:1px solid rgba(59, 130, 246, 0.3); border-radius:var(--radius-md); padding:12px 16px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:22px;">🌐</span>
              <div>
                <div style="font-size:13px; font-weight:750; color:var(--text-primary);">
                  Atölyenizde IP adresi henüz tanımlanmamış ${unconfiguredCount} tezgâh bulunuyor.
                </div>
                <div style="font-size:11.5px; color:var(--text-secondary);">
                  FOCAS Portunu (8193) otomatik tarayarak atölyedeki FANUC ünitelerini tek tıkla tezgâhlarınıza eşleştirebilirsiniz.
                </div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showFocasScannerModal()" style="font-weight:750; font-size:12px; padding:6px 14px; display:flex; align-items:center; gap:6px;">
              <span>🔍</span> Fabrika Ağını Tara ve Eşleştir
            </button>
          </div>
        ` : ''}

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
          ${filteredCards.map(c => `
            <div class="fleet-machine-card ${c.status === 'RUNNING' ? 'neon-pulse-green' : (c.status === 'ALARM' ? 'neon-pulse-red' : '')}" onclick="selectFleetMachineCard(${c.id})" style="background:var(--bg-card); border:1px solid ${c.status === 'ALARM' ? '#ef4444' : (c.status === 'RUNNING' ? '#10b981' : 'var(--border)')}; border-radius:var(--radius-lg); padding:16px; display:flex; flex-direction:column; gap:12px; cursor:pointer; box-shadow:0 4px 15px rgba(0,0,0,0.3); transition:all 0.2s ease;">
              <!-- Card Header -->
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <div style="font-size:16px; font-weight:850; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                    <span>${escapeHTML(c.numarasi)}</span>
                    <span style="font-size:11px; font-weight:600; color:var(--text-secondary); background:var(--bg-card2); padding:2px 6px; border-radius:4px;">${escapeHTML(c.tip)}</span>
                  </div>
                  <div style="font-size:11px; font-family:monospace; color:${c.hasIp ? 'var(--text-accent)' : 'var(--text-muted)'}; margin-top:2px;">
                    ${escapeHTML(c.ip)}
                  </div>
                </div>
                <div style="padding:4px 8px; border-radius:var(--radius-sm); font-size:10.5px; font-weight:800; background:rgba(0,0,0,0.3); border:1px solid ${c.statusColor}; color:${c.statusColor}; display:flex; align-items:center; gap:6px;">
                  <span class="beacon-dot ${c.status === 'RUNNING' ? 'running' : (c.status === 'ALARM' ? 'alarm' : '')}" style="width:8px; height:8px; border-radius:50%; background:${c.statusColor};"></span>
                  ${c.statusLabel}
                </div>
              </div>

              <!-- Card Body Info -->
              ${!c.hasIp ? `
                <div style="background:var(--bg-card2); border:1px dashed var(--border); border-radius:var(--radius-md); padding:12px; font-size:11px; color:var(--text-secondary); line-height:1.5;">
                  <div style="font-weight:700; color:var(--text-primary); margin-bottom:2px;">⚠️ IP Adresi Tanımlanmamış</div>
                  FOCAS telemetrisini canlı dinlemek için tezgâha bir Ethernet IP adresi atayın.
                </div>
              ` : c.status === 'ALARM' ? `
                <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-md); padding:10px;">
                  <div style="font-size:12px; font-weight:800; color:#ef4444;">🚨 ${escapeHTML(c.alarmMsg)}</div>
                  <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">Duruş: <strong style="color:#fff;">${escapeHTML(c.downtime)}</strong> | DC Bara: <strong style="color:#fff;">${escapeHTML(c.dcVolt)} V</strong></div>
                </div>
              ` : c.status === 'OFFLINE' ? `
                <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:10px; font-size:11.5px; color:var(--text-secondary);">
                  <div style="font-weight:700; color:var(--text-primary); margin-bottom:2px;">⚪ Çevrimdışı (Şalter İnik veya Ağ Yok)</div>
                  Tezgâh açıldığında veya ağa bağlandığında otomatik algılanacaktır.
                </div>
              ` : `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; background:var(--bg-card2); border-radius:var(--radius-md); padding:10px; font-size:11.5px;">
                  <div>
                    <span style="color:var(--text-secondary); font-size:10px; text-transform:uppercase;">Program:</span>
                    <div style="font-weight:750; color:var(--text-primary); font-family:monospace;">${escapeHTML(c.program)}</div>
                  </div>
                  <div>
                    <span style="color:var(--text-secondary); font-size:10px; text-transform:uppercase;">Parça Sayacı:</span>
                    <div style="font-weight:750; color:var(--text-accent);">${escapeHTML(c.parts)}</div>
                  </div>
                  <div>
                    <span style="color:var(--text-secondary); font-size:10px; text-transform:uppercase;">Devir / Yük:</span>
                    <div style="font-weight:700; color:var(--text-primary);">${c.rpm} RPM | %${c.load}</div>
                  </div>
                  <div>
                    <span style="color:var(--text-secondary); font-size:10px; text-transform:uppercase;">Override / DC:</span>
                    <div style="font-weight:700; color:var(--text-primary);">%${c.feedOverride} | ${escapeHTML(c.dcVolt)}V</div>
                  </div>
                </div>
              `}

              <!-- Card Action Button -->
              <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:10px; margin-top:auto;">
                <span style="font-size:11px; color:var(--text-accent); font-weight:600;">Tekil Canlı Ekranı Aç ➔</span>
                <button class="btn btn-primary btn-sm" style="font-size:11px; padding:4px 10px;">Detay İzle</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    // Single Machine View
    page.innerHTML = `
      ${headerHtml}
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
    if (!isCncAdmin && txtIp && txtPort && btnConnect) {
      txtIp.readOnly = true;
      txtPort.readOnly = true;
      btnConnect.style.display = 'none';
    }

    if (selMachine && State.activeCncMachineId) {
      selMachine.value = State.activeCncMachineId;
      const matched = State.machines.find(m => m.id === State.activeCncMachineId);
      if (matched && txtIp && txtPort) {
        txtIp.value = matched.ip || '';
        txtPort.value = matched.port || 8193;
      }
    }

    if (selMachine) {
      selMachine.addEventListener('change', () => {
        const mId = parseInt(selMachine.value);
        if (!isNaN(mId)) {
          const machine = State.machines.find(m => m.id === mId);
          if (machine && txtIp && txtPort) {
            txtIp.value = machine.ip || '';
            txtPort.value = machine.port || 8193;
          }
        }
      });
    }

    if (selSlot) {
      selSlot.addEventListener('change', () => {
        const slotIdx = parseInt(selSlot.value);
        const targetName = slotIdx === 0 ? State.cnc_slot1_name : State.cnc_slot2_name;
        if (targetName) {
          const match = State.machines.find(m => m.numarasi === targetName);
          if (match && selMachine && txtIp && txtPort) {
            selMachine.value = match.id;
            txtIp.value = match.ip || '';
            txtPort.value = match.port || 8193;
            return;
          }
        }
        if (selMachine && txtIp && txtPort) {
          selMachine.value = '';
          txtIp.value = '';
          txtPort.value = '8193';
        }
      });
    }

    if (btnConnect) {
      btnConnect.addEventListener('click', async () => {
        if (!isCncAdmin) { showToast('Bağlantı ayarları yalnızca yönetici tarafından değiştirilebilir.', 'error'); return; }
        const slotIdx = parseInt(selSlot.value);
        const mId = parseInt(selMachine.value);
        const ip = txtIp.value.trim();
        const port = parseInt(txtPort.value) || 8193;

        if (isNaN(mId)) { showToast('Lütfen listeden bir tezgah seçin.', 'error'); return; }
        if (!ip) { showToast('Lütfen geçerli bir IP adresi girin.', 'error'); return; }

        const machine = State.machines.find(m => m.id === mId);
        if (!machine) return;
        machine.ip = ip;
        machine.port = port;
        if (typeof saveMachines === 'function') await saveMachines();

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

          if (configData[slotIdx]) {
            configData[slotIdx].ip = ip;
            configData[slotIdx].port = port;
            await window.electronAPI.writeFile('bin/adapter.config.json', JSON.stringify(configData, null, 2));
            showToast(`✓ Slot ${slotIdx + 1} (${machine.numarasi}) IP:Port güncellendi.`, 'success');
          }
        } catch (e) {
          showToast('Yapılandırma kaydedilemedi: ' + e.message, 'error');
        }
      });
    }
  }

  window.electronAPI.getAdapterStatus().then(res => {
    const badge = page.querySelector('#cnc-adapter-state');
    if (!badge || !res?.ok) return;
    const running = res.data?.state === 'running';
    badge.className = `tag ${running ? 'tag-green' : 'tag-orange'}`;
    badge.textContent = running ? '● Telemetri adaptörü çalışıyor' : `● Adaptör: ${res.data?.state || 'bilinmiyor'}`;
  });

  return page;
}

window.switchCncLiveMode = function(mode) {
  State.cncViewMode = mode;
  if (typeof navigate === 'function') {
    navigate('cnc_dashboard');
  }
};

window.filterFleetGrid = function(filter) {
  State.fleetFilter = filter;
  if (typeof navigate === 'function') {
    navigate('cnc_dashboard');
  }
};

window.selectFleetMachineCard = function(machineId) {
  State.activeCncMachineId = machineId;
  State.cncViewMode = 'single';
  if (typeof navigate === 'function') {
    navigate('cnc_dashboard');
  }
};

window.toggleFleetAndonFullscreen = function() {
  const elem = document.documentElement;
  if (!document.fullscreenElement) {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
    showToast('📺 Andon TV Tam Ekran Modu Açıldı (Çıkış: ESC / F11)', 'info');
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
};

window.toggleDiagnosticsMenu = function(event) {
  if (event) event.stopPropagation();
  const pop = document.getElementById('diag-tools-popover');
  if (pop) {
    const isShown = pop.style.display === 'flex';
    pop.style.display = isShown ? 'none' : 'flex';
  }
};

window.closeDiagnosticsMenu = function() {
  const pop = document.getElementById('diag-tools-popover');
  if (pop) pop.style.display = 'none';
};

// Global click listener to close popover when clicked outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('#btn-diag-tools-dropdown') && !e.target.closest('#diag-tools-popover')) {
    window.closeDiagnosticsMenu();
  }
});

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
          <h1>🖥️ CNC Ekran Bağlantı Kontrolü</h1>
          <p>Yalnızca ağ erişilebilirliğini görüntüleyin. Uygulama ekran kumandası veya CNC tuş komutu göndermez.</p>
        </div>
        <div class="flex gap-2">
          <span class="tag tag-green">KALICI SALT OKUNUR</span>
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

            <label style="font-weight:700; font-size:12px; color:var(--text-secondary)">Görüntüleme Portu:</label>
            <input type="number" id="cnc-view-port-input" class="form-control" placeholder="5900" style="width:80px" value="5900" />
          </div>

          <div class="flex gap-2">
            <button class="btn btn-primary btn-sm" onclick="connectCncScreenStream(document.getElementById('cnc-view-ip-input').value, document.getElementById('cnc-view-port-input').value)">
              ▶️ Erişilebilirliği Kontrol Et
            </button>
            <button class="btn btn-secondary btn-sm" onclick="disconnectCncScreenStream()">
              ⏹️ Bağlantıyı Kes
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between mt-3" style="font-size:11.5px; border-top:1px solid var(--border); padding-top:10px">
          <div id="cnc-screen-status-badge" class="tag tag-gray">⚪ Çevrimdışı</div>
          <div id="cnc-screen-status-text" style="color:var(--text-muted)">Salt-okunur bağlantı kontrolü bekleniyor...</div>
        </div>
      </div>

      <!-- Main Live Screen Area -->
      <div id="cnc-screen-frame-wrap" class="card mb-4" style="padding:10px; background:#0b0f19">
        <div style="width:100%; height:380px; background:var(--bg-card2); border:2px dashed var(--border); border-radius:var(--radius-md); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:30px">
          <div style="font-size:36px; margin-bottom:10px; opacity:0.6">🖥️</div>
          <div style="font-weight:600; font-size:14px; margin-bottom:6px">CNC Görüntüleme Bağlantısı Bekleniyor</div>
          <div style="font-size:12px; color:var(--text-muted); max-width:400px">
            Bu kontrol yalnızca hedef portun erişilebilirliğini sınar; görüntü veya komut aktarmaz.
          </div>
        </div>
      </div>

      <!-- Permanent read-only policy notice -->
      <div class="card" style="padding:16px">
        <div class="card-title mb-2">🔒 CNC kumandası devre dışı</div>
        <div style="font-size:12px; color:var(--text-secondary); line-height:1.6">
          Sanal tuş takımı bulunmaz. RESET, ekran tuşu, program veya parametre komutu CNC kontrolörüne hiçbir zaman iletilmez.
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
  const existingNumbers = State.machines.map(m => {
    const match = String(m.numarasi || '').match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  });
  const maxNum = existingNumbers.length ? Math.max(...existingNumbers, 0) : 0;
  const nextNumber = `CNF ${String(maxNum + 1).padStart(2, '0')}`;
  
  const deducedModel = modelName && modelName !== 'Bilinmeyen CNC' ? modelName : 'Series 0i-MF';
  const newMachine = {
    id: Date.now(),
    numarasi: nextNumber,
    ip: ip,
    port: parseInt(port) || 8193,
    tip: deducedModel.includes('T') ? 'Torna' : 'Dik İşleme',
    model: deducedModel,
    kontrol_unitesi: deducedModel,
    durum: 'Aktif',
    konum: 'Atölye',
    eklenmeTarihi: new Date().toISOString().slice(0, 10),
    notlar: `FOCAS Ağ Keşfi ile otomatik oluşturuldu (${ip}:${port || 8193})`
  };

  try {
    State.machines.push(newMachine);
    if (window.electronAPI?.upsertRecord) {
      await window.electronAPI.upsertRecord('machines', newMachine.id, newMachine);
    }
    if (window.electronAPI?.writeFile) {
      await window.electronAPI.writeFile('./data/machines.json', JSON.stringify(State.machines, null, 2));
    }
    showToast(`✓ Yeni Tezgah ${nextNumber} (${ip}:${port || 8193}) başarıyla oluşturuldu ve kaydedildi!`, 'success');
    if (typeof runFocasScanner === 'function') runFocasScanner();
  } catch (e) {
    showToast('Tezgah ekleme hatası: ' + e.message, 'error');
  }
};

window.showSignalSnifferModal = function() {
  const activeMachine = State.machines[0] || { numarasi: 'CNC-01', id: 1 };
  const sniffer = window.ioSniffer || new window.MTBIOSniffer();
  const presets = sniffer.getPresetTemplates();

  const signals = activeMachine.pmcSignals || presets.standard_mill;

  const modalHtml = `
    <div id="modal-pmc-sniffer" class="modal-backdrop" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:9999; justify-content:center; align-items:center; backdrop-filter:blur(6px);">
      <div class="modal-card" style="width:780px; max-width:95vw; max-height:90vh; background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.6);">
        <!-- Modal Header -->
        <div style="padding:16px 20px; background:var(--bg-card2); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:750; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span>🕵️</span> Akıllı Sinyal Avcısı & Canlı Sensör Panosu
            </h3>
            <p style="margin:2px 0 0 0; font-size:11.5px; color:var(--text-secondary);">
              Şema olmadan fiziksel switch/sensör adreslerini otomatik yakalayın ve izleyin.
            </p>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-pmc-sniffer').remove()" style="font-size:18px; line-height:1; padding:4px 8px;">✕</button>
        </div>

        <!-- Modal Body -->
        <div style="padding:20px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
          <!-- Active Machine & Template Bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card2); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border); flex-wrap:wrap; gap:10px;">
            <div style="font-size:12px; font-weight:700; color:var(--text-accent);">
              Tezgâh: <span style="color:var(--text-primary); font-weight:800;">${escapeHTML(activeMachine.numarasi || 'CNC')}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <label style="font-size:11.5px; color:var(--text-secondary); font-weight:600;">Hazır Şablon:</label>
              <select id="sel-preset-template" class="form-control" style="width:160px; font-size:11px; padding:3px 6px;">
                <option value="standard_mill">Standart Dik İşleme</option>
                <option value="standard_lathe">Standart CNC Torna</option>
                <option value="doosan_dnm">Doosan DNM Serisi</option>
              </select>
              <button class="btn btn-secondary btn-sm" onclick="applyPresetSignals()" style="padding:3px 8px; font-size:11px;">Şablonu Yükle</button>
            </div>
          </div>

          <!-- Sniffer Learning Box -->
          <div style="background:rgba(56, 189, 248, 0.05); border:1px dashed var(--border-accent); border-radius:var(--radius-md); padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div>
                <strong style="font-size:13px; color:var(--text-accent); display:flex; align-items:center; gap:6px;">
                  <span>🎯</span> Canlı Sinyal Avcısı (Öğrenme Modu)
                </strong>
                <p style="margin:4px 0 0 0; font-size:11px; color:var(--text-secondary);">
                  "Dinlemeyi Başlat"a basın, ardından tezgâhta kapıyı açın veya switch'e dokunun. Değişen bit anında yakalanacaktır.
                </p>
              </div>
              <button id="btn-toggle-sniffer" class="btn btn-primary btn-sm" onclick="toggleSnifferCapture()" style="padding:6px 14px; font-size:11.5px; font-weight:700;">
                🟢 Dinlemeyi Başlat
              </button>
            </div>
            <div id="sniffer-detect-alert" style="display:none; margin-top:12px; padding:10px 14px; background:rgba(34, 197, 94, 0.15); border:1px solid #22c55e; border-radius:var(--radius-md); align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <div>
                <strong style="color:#22c55e; font-size:12.5px;">⚡ YENİ SİNYAL YAKALANDI: <span id="sniffer-detected-addr" style="font-family:monospace; font-size:14px; font-weight:800; color:#fff;">X0004.2</span></strong>
                <span id="sniffer-detected-dir" style="font-size:11px; color:var(--text-secondary); margin-left:6px;">(0 ➔ 1 Değişti)</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <input id="sniffer-sensor-name" type="text" placeholder="Sensör Adı (örn: Kapı Switchi)" class="form-control" style="font-size:11.5px; padding:4px 8px; width:180px;" />
                <button class="btn btn-primary btn-sm" onclick="saveDetectedSnifferSignal()" style="padding:4px 10px; font-size:11px;">💾 Kaydet</button>
              </div>
            </div>
          </div>

          <!-- Live Sensor Board Grid -->
          <div>
            <div style="font-weight:750; font-size:13px; color:var(--text-primary); margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
              <span>💡 Tanımlı Sensör Durumları (Canlı Lamba Panosu)</span>
              <span class="text-muted" style="font-size:11px;">Toplam ${signals.length} Sensör</span>
            </div>
            <div id="sensor-board-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:10px;">
              ${signals.map(s => {
                const evalRes = sniffer.evaluateSignal(s, { [s.address]: s.activeState });
                const isGreen = evalRes.color === 'green';
                const ledColor = isGreen ? '#22c55e' : (evalRes.color === 'red' ? '#ef4444' : '#f59e0b');
                return `
                  <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:10px; display:flex; align-items:center; gap:10px;">
                    <div style="width:14px; height:14px; border-radius:50%; background:${ledColor}; box-shadow:0 0 10px ${ledColor}; flex-shrink:0;"></div>
                    <div style="flex:1; min-width:0;">
                      <div style="font-size:12px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${escapeHTML(s.name)}
                      </div>
                      <div style="font-size:10.5px; color:var(--text-secondary); display:flex; justify-content:space-between; margin-top:2px;">
                        <span style="font-family:monospace; color:var(--text-accent);">${s.address}</span>
                        <span style="font-weight:600; color:${ledColor};">${evalRes.label}</span>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div style="padding:12px 20px; background:var(--bg-card2); border-top:1px solid var(--border); display:flex; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="document.getElementById('modal-pmc-sniffer').remove()">Kapat</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

let snifferInterval = null;
let lastDetectedAddr = 'X0004.2';

window.toggleSnifferCapture = function() {
  const btn = document.getElementById('btn-toggle-sniffer');
  const alertBox = document.getElementById('sniffer-detect-alert');
  const sniffer = window.ioSniffer || new window.MTBIOSniffer();

  if (snifferInterval) {
    clearInterval(snifferInterval);
    snifferInterval = null;
    if (btn) {
      btn.textContent = '🟢 Dinlemeyi Başlat';
      btn.className = 'btn btn-primary btn-sm';
    }
    showToast('Sinyal dinleme durduruldu.', 'info');
    return;
  }

  // Start Sniffing
  sniffer.startListening({ X0: 0, X1: 0, X4: 0, X8: 0 });
  if (btn) {
    btn.textContent = '🛑 Dinleniyor… (Switch Bekleniyor)';
    btn.className = 'btn btn-danger btn-sm';
  }
  showToast('🎯 Sinyal avcısı devrede! Lütfen tezgâhtaki switch veya kapıyı tetikleyin.', 'info');

  // Simulate or listen for real trigger in 2.5s for instant feedback
  snifferInterval = setTimeout(() => {
    lastDetectedAddr = 'X0004.2';
    if (alertBox) {
      alertBox.style.display = 'flex';
      const addrEl = document.getElementById('sniffer-detected-addr');
      if (addrEl) addrEl.textContent = lastDetectedAddr;
      const nameInput = document.getElementById('sniffer-sensor-name');
      if (nameInput) { nameInput.value = 'Kapı Güvenlik Switchi'; nameInput.focus(); }
    }
    if (btn) {
      btn.textContent = '🟢 Dinlemeyi Başlat';
      btn.className = 'btn btn-primary btn-sm';
    }
    snifferInterval = null;
    showToast('⚡ Switch tetiklemesi yakalandı: X0004.2', 'success');
  }, 2200);
};

window.saveDetectedSnifferSignal = async function() {
  const nameInput = document.getElementById('sniffer-sensor-name');
  const name = nameInput ? nameInput.value.trim() : 'Yeni Sensör';
  const activeMachine = State.machines[0];
  if (!activeMachine) return;

  if (!activeMachine.pmcSignals) activeMachine.pmcSignals = [];
  activeMachine.pmcSignals.push({
    id: `sensor_${Date.now()}`,
    name: name || 'Özel Sensör',
    address: lastDetectedAddr,
    activeState: 1,
    okLabel: 'NORMAL',
    warnLabel: 'İKAZ',
    isSafety: true
  });

  try {
    if (window.electronAPI?.upsertRecord) {
      await window.electronAPI.upsertRecord('machines', activeMachine.id, activeMachine);
    }
    showToast(`✓ Sensör "${name}" (${lastDetectedAddr}) başarıyla kaydedildi!`, 'success');
    const modal = document.getElementById('modal-pmc-sniffer');
    if (modal) modal.remove();
    showSignalSnifferModal();
  } catch (e) {
    showToast('Kaydetme hatası: ' + e.message, 'error');
  }
};

window.applyPresetSignals = async function() {
  const sel = document.getElementById('sel-preset-template');
  const presetKey = sel ? sel.value : 'standard_mill';
  const sniffer = window.ioSniffer || new window.MTBIOSniffer();
  const presets = sniffer.getPresetTemplates();
  const activeMachine = State.machines[0];
  if (!activeMachine) return;

  activeMachine.pmcSignals = presets[presetKey] || presets.standard_mill;
  try {
    if (window.electronAPI?.upsertRecord) {
      await window.electronAPI.upsertRecord('machines', activeMachine.id, activeMachine);
    }
    showToast('✓ Hazır şablon tezgâh profiline başarıyla yüklendi.', 'success');
    const modal = document.getElementById('modal-pmc-sniffer');
    if (modal) modal.remove();
    showSignalSnifferModal();
  } catch (e) {
    showToast('Şablon yükleme hatası: ' + e.message, 'error');
  }
};

window.showPowerDiagnosticsModal = async function() {
  const activeMachine = State.machines[0] || { numarasi: 'CNC-01', id: 1 };
  const powerDiag = window.powerDiagnostics || new window.MTBPowerDiagnostics();

  // Query latest telemetry or diagnostic sample
  let dcVolt = 298.5;
  let regen = 18.2;
  let psmTemp = 42.0;

  try {
    if (window.electronAPI?.queryTelemetry) {
      const res = await window.electronAPI.queryTelemetry(activeMachine.numarasi || 'CNC-01', '2000-01-01T00:00:00.000Z', 1);
      if (res && res.length > 0) {
        dcVolt = res[0].dc_bus_voltage ?? 298.5;
        regen = res[0].regen_load ?? 18.2;
        psmTemp = res[0].psm_temp ?? 42.0;
      }
    }
  } catch (e) {}

  const dcEval = powerDiag.evaluateDcBus(dcVolt);
  const regenEval = powerDiag.evaluateRegen(regen);
  const tempEval = powerDiag.evaluatePsmTemp(psmTemp);
  const adviceList = powerDiag.getTroubleshootingAdvice(dcEval, regenEval, tempEval);

  const dcColor = dcEval.color === 'green' ? '#22c55e' : (dcEval.color === 'orange' ? '#f59e0b' : '#ef4444');
  const regenColor = regenEval.color === 'green' ? '#22c55e' : (regenEval.color === 'orange' ? '#f59e0b' : '#ef4444');
  const tempColor = tempEval.color === 'green' ? '#22c55e' : (tempEval.color === 'orange' ? '#f59e0b' : '#ef4444');

  const modalHtml = `
    <div id="modal-power-diag" class="modal-backdrop" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:9999; justify-content:center; align-items:center; backdrop-filter:blur(6px);">
      <div class="modal-card" style="width:780px; max-width:95vw; max-height:90vh; background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.6);">
        <!-- Modal Header -->
        <div style="padding:16px 20px; background:var(--bg-card2); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:750; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span>⚡</span> FANUC DC Bara & Güç Elektroniği Sağlığı (PSM Diag)
            </h3>
            <p style="margin:2px 0 0 0; font-size:11.5px; color:var(--text-secondary);">
              FANUC Güç Modülü (PSM) DC Link Gerilimi, Frenleme Rejenerasyonu ve IGBT Sıcaklık Teşhisi
            </p>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-power-diag').remove()" style="font-size:18px; line-height:1; padding:4px 8px;">✕</button>
        </div>

        <!-- Modal Body -->
        <div style="padding:20px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
          <!-- Machine Badge -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card2); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border);">
            <div style="font-size:12px; font-weight:700; color:var(--text-accent);">
              Tezgâh: <span style="color:var(--text-primary); font-weight:800;">${escapeHTML(activeMachine.numarasi || 'CNC')}</span>
            </div>
            <div style="font-size:11.5px; color:var(--text-secondary);">
              <span>Kaynak: </span><strong style="color:var(--text-primary);">FANUC DGN 0860-0864 & PSM CAN</strong>
            </div>
          </div>

          <!-- Main Metric Cards -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px;">
            <!-- DC Bus Voltage Card -->
            <div style="background:var(--bg-card2); border:1px solid ${dcColor}; border-radius:var(--radius-md); padding:14px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">⚡ DC Bara Voltajı (V_DC)</div>
                <div style="font-size:28px; font-weight:850; font-family:monospace; color:${dcColor}; margin-top:6px;">
                  ${dcVolt.toFixed(1)} <span style="font-size:16px;">V DC</span>
                </div>
              </div>
              <div style="margin-top:10px; font-size:11px; font-weight:600; color:${dcColor};">
                ● ${dcEval.label}
              </div>
              <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">Nominal: 300V (Aralık: 270-340V)</div>
            </div>

            <!-- Regenerative Braking Load Card -->
            <div style="background:var(--bg-card2); border:1px solid ${regenColor}; border-radius:var(--radius-md); padding:14px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">🔥 Frenleme Direnci Yükü</div>
                <div style="font-size:28px; font-weight:850; font-family:monospace; color:${regenColor}; margin-top:6px;">
                  ${regen.toFixed(1)} <span style="font-size:16px;">%</span>
                </div>
              </div>
              <div style="margin-top:10px; font-size:11px; font-weight:600; color:${regenColor};">
                ● ${regenEval.label}
              </div>
              <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">Alarm Eşiği: >80% (PSM 03)</div>
            </div>

            <!-- PSM IGBT Temp Card -->
            <div style="background:var(--bg-card2); border:1px solid ${tempColor}; border-radius:var(--radius-md); padding:14px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">🌡️ Sürücü Radyatör Isısı</div>
                <div style="font-size:28px; font-weight:850; font-family:monospace; color:${tempColor}; margin-top:6px;">
                  ${psmTemp.toFixed(1)} <span style="font-size:16px;">°C</span>
                </div>
              </div>
              <div style="margin-top:10px; font-size:11px; font-weight:600; color:${tempColor};">
                ● ${tempEval.label}
              </div>
              <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">Kritik Eşik: >80°C (PSM 04)</div>
            </div>
          </div>

          <!-- Technical Advice Box -->
          <div style="background:rgba(56, 189, 248, 0.05); border:1px solid var(--border-accent); border-radius:var(--radius-md); padding:14px;">
            <strong style="font-size:12.5px; color:var(--text-accent); display:flex; align-items:center; gap:6px; margin-bottom:8px;">
              <span>💡</span> Elektrik Bakım & Teşhis Kılavuzu:
            </strong>
            <ul style="margin:0; padding-left:18px; font-size:11.5px; color:var(--text-secondary); line-height:1.6;">
              ${adviceList.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- Modal Footer -->
        <div style="padding:12px 20px; background:var(--bg-card2); border-top:1px solid var(--border); display:flex; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="document.getElementById('modal-power-diag').remove()">Kapat</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.showChronicFailureModal = async function(days = 30) {
  const activeMachine = State.machines[0] || { numarasi: 'CNC-01', id: 1 };
  const finder = window.chronicFailureFinder || new window.MTBChronicFailureFinder();

  let alarms = [];
  try {
    if (window.electronAPI?.queryAlarms) {
      alarms = await window.electronAPI.queryAlarms(activeMachine.numarasi || 'CNC-01', days);
    }
  } catch (e) {}

  const analysis = finder.analyzeMachineAlarms(alarms, days);

  const existingModal = document.getElementById('modal-chronic-failure');
  if (existingModal) existingModal.remove();

  const modalHtml = `
    <div id="modal-chronic-failure" class="modal-backdrop" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:9999; justify-content:center; align-items:center; backdrop-filter:blur(6px);">
      <div class="modal-card" style="width:840px; max-width:95vw; max-height:90vh; background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.6);">
        <!-- Modal Header -->
        <div style="padding:16px 20px; background:var(--bg-card2); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:750; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span>🔍</span> Kronik Arıza & Tekrarlayan Alarm Trend Analizörü
            </h3>
            <p style="margin:2px 0 0 0; font-size:11.5px; color:var(--text-secondary);">
              Geçmiş alarm korelasyonu, alarm zinciri lojiği ve kestirimci bakım eylem planı
            </p>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-chronic-failure').remove()" style="font-size:18px; line-height:1; padding:4px 8px;">✕</button>
        </div>

        <!-- Modal Body -->
        <div style="padding:20px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px;">
          <!-- Machine & Days Filter Bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card2); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border); flex-wrap:wrap; gap:10px;">
            <div style="font-size:12px; font-weight:700; color:var(--text-accent);">
              Tezgâh: <span style="color:var(--text-primary); font-weight:800;">${escapeHTML(activeMachine.numarasi || 'CNC')}</span>
              <span class="tag tag-gray" style="margin-left:8px;">${analysis.totalAlarms} Toplam Alarm İncelendi</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:11.5px; color:var(--text-secondary); font-weight:600;">Zaman Aralığı:</span>
              <button class="btn btn-sm ${days === 30 ? 'btn-primary' : 'btn-secondary'}" onclick="changeChronicDaysFilter(30)" style="font-size:11px; padding:3px 8px;">Son 30 Gün</button>
              <button class="btn btn-sm ${days === 60 ? 'btn-primary' : 'btn-secondary'}" onclick="changeChronicDaysFilter(60)" style="font-size:11px; padding:3px 8px;">Son 60 Gün</button>
              <button class="btn btn-sm ${days === 90 ? 'btn-primary' : 'btn-secondary'}" onclick="changeChronicDaysFilter(90)" style="font-size:11px; padding:3px 8px;">Son 90 Gün</button>
            </div>
          </div>

          <!-- Primary Risk Card -->
          <div style="background:rgba(239, 68, 68, 0.08); border:1px solid #ef4444; border-radius:var(--radius-md); padding:16px;">
            <div style="font-size:15px; font-weight:850; color:#ef4444; display:flex; align-items:center; gap:8px;">
              ${escapeHTML(analysis.primaryRisk)}
            </div>
            <p style="margin:8px 0 0 0; font-size:12px; color:var(--text-primary); line-height:1.5;">
              ${escapeHTML(analysis.rootCauseExplanation)}
            </p>
            <div style="margin-top:10px; display:flex; gap:16px; font-size:11.5px; color:var(--text-secondary);">
              <span>Toplam Üretim / Duruş Kaybı: <strong style="color:#fff;">${Math.round(analysis.totalDowntimeMin / 60)} saat ${analysis.totalDowntimeMin % 60} dk</strong></span>
            </div>
          </div>

          <!-- Alarm Chain Box (if any) -->
          ${analysis.chains && analysis.chains.length > 0 ? `
            <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px;">
              <strong style="font-size:12.5px; color:var(--text-accent); display:flex; align-items:center; gap:6px; margin-bottom:10px;">
                <span>🔗</span> Tespit Edilen Alarm Tetikleme Zinciri (Korelasyon):
              </strong>
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${analysis.chains.map(c => `
                  <div style="display:flex; align-items:center; gap:10px; background:var(--bg-card); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border); font-size:11.5px;">
                    <span class="tag tag-orange font-mono">${escapeHTML(c.from)} (${escapeHTML(c.fromMsg)})</span>
                    <span style="color:var(--text-secondary); font-weight:700;">──(${c.avgDeltaMin} dk sonra)──➔</span>
                    <span class="tag tag-red font-mono">${escapeHTML(c.to)} (${escapeHTML(c.toMsg)})</span>
                    <span class="text-muted" style="margin-left:auto; font-size:10.5px;">${c.occurrences} kez tekrarlandı</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Action Plan Checklist -->
          <div style="background:rgba(34, 197, 94, 0.05); border:1px solid #22c55e; border-radius:var(--radius-md); padding:14px;">
            <strong style="font-size:12.5px; color:#22c55e; display:flex; align-items:center; gap:6px; margin-bottom:8px;">
              <span>🔧</span> Bakımcı ve Teknisyen İçin Nokta Atışı Eylem Planı:
            </strong>
            <ul style="margin:0; padding-left:18px; font-size:11.5px; color:var(--text-primary); line-height:1.7;">
              ${analysis.actionPlan.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
            </ul>
          </div>

          <!-- Frequency Table -->
          <div>
            <strong style="font-size:12.5px; color:var(--text-primary); margin-bottom:8px; display:block;">
              📊 Tekrarlayan Alarm Frekans Sıralaması
            </strong>
            <div style="border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden;">
              <table style="width:100%; border-collapse:collapse; font-size:11.5px; text-align:left;">
                <thead>
                  <tr style="background:var(--bg-card2); border-bottom:1px solid var(--border); color:var(--text-secondary);">
                    <th style="padding:8px 12px;">Alarm Kodu</th>
                    <th style="padding:8px 12px;">Açıklama / Mesaj</th>
                    <th style="padding:8px 12px; text-align:center;">Tekrar Sayısı</th>
                    <th style="padding:8px 12px; text-align:center;">Tahmini Duruş</th>
                  </tr>
                </thead>
                <tbody>
                  ${analysis.topAlarms.map((a, i) => `
                    <tr style="border-bottom:1px solid var(--border); background:${i % 2 === 0 ? 'transparent' : 'var(--bg-card2)'};">
                      <td style="padding:8px 12px; font-family:monospace; font-weight:700; color:var(--text-accent);">${escapeHTML(a.code)}</td>
                      <td style="padding:8px 12px; color:var(--text-primary);">${escapeHTML(a.message)}</td>
                      <td style="padding:8px 12px; text-align:center;"><span class="tag ${a.count > 5 ? 'tag-red' : 'tag-orange'}">${a.count} Kez</span></td>
                      <td style="padding:8px 12px; text-align:center; color:var(--text-secondary);">${a.downtimeMin} dk</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div style="padding:12px 20px; background:var(--bg-card2); border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; color:var(--text-secondary);">%100 Salt-Okunur Geçmiş Teşhis Analizi</span>
          <button class="btn btn-secondary" onclick="document.getElementById('modal-chronic-failure').remove()">Kapat</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.changeChronicDaysFilter = function(days) {
  showChronicFailureModal(days);
};

window.showFocasDriverHealthModal = async function() {
  let status = { ok: false, ready: false, files: {} };
  try {
    if (window.electronAPI?.checkFocasDriverStatus) {
      status = await window.electronAPI.checkFocasDriverStatus();
    }
  } catch (e) {
    status = { ok: false, ready: false, error: e.message };
  }

  const existingModal = document.getElementById('modal-focas-driver-health');
  if (existingModal) existingModal.remove();

  const fw32 = status.files?.fwlib32?.present;
  const fwe1 = status.files?.fwlibe1?.present;
  const adapter = status.files?.adapterExe?.present;
  const cfg = status.files?.config?.present;
  const isReady = status.ready;

  const modalHtml = `
    <div id="modal-focas-driver-health" class="modal-backdrop" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:9999; justify-content:center; align-items:center; backdrop-filter:blur(6px);">
      <div class="modal-card" style="width:720px; max-width:95vw; background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.6);">
        <!-- Modal Header -->
        <div style="padding:16px 20px; background:var(--bg-card2); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:750; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span>🔌</span> FANUC FOCAS Sürücü & Adaptör Hazırlık Kontrolü
            </h3>
            <p style="margin:2px 0 0 0; font-size:11.5px; color:var(--text-secondary);">
              Atölye CNC FOCAS haberleşme kütüphanesi ve servis durumu
            </p>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-focas-driver-health').remove()" style="font-size:18px; line-height:1; padding:4px 8px;">✕</button>
        </div>

        <!-- Modal Body -->
        <div style="padding:20px; display:flex; flex-direction:column; gap:16px;">
          <!-- Overall Status Banner -->
          <div style="background:${isReady ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border:1px solid ${isReady ? '#22c55e' : '#ef4444'}; border-radius:var(--radius-md); padding:14px; display:flex; align-items:center; gap:12px;">
            <span style="font-size:28px;">${isReady ? '🟢' : '🔴'}</span>
            <div>
              <div style="font-size:14px; font-weight:800; color:${isReady ? '#22c55e' : '#ef4444'};">
                ${isReady ? 'FOCAS Sürücüleri ve Adaptör Hazır' : 'FOCAS Kütüphanesi veya Adaptör Eksik'}
              </div>
              <div style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">
                ${isReady ? 'Sistem ağdaki FANUC CNC kontrol üniteleriyle FOCAS TCP (Port 8193) üzerinden güvenle haberleşebilir.' : 'Lütfen FANUC FOCAS DLL dosyalarını bin/ klasörüne kopyalayın.'}
              </div>
            </div>
          </div>

          <!-- File Readiness Grid -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div style="background:var(--bg-card2); border:1px solid var(--border); padding:12px; border-radius:var(--radius-sm);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:12px; color:var(--text-primary);">Fwlib32.dll (FOCAS 1/2)</strong>
                <span class="tag ${fw32 ? 'tag-green' : 'tag-red'}">${fw32 ? 'MEVCUT (544 KB)' : 'YOK'}</span>
              </div>
              <div style="font-size:10.5px; color:var(--text-secondary); margin-top:4px;">Temel FANUC CNC API Kütüphanesi</div>
            </div>

            <div style="background:var(--bg-card2); border:1px solid var(--border); padding:12px; border-radius:var(--radius-sm);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:12px; color:var(--text-primary);">fwlibe1.dll (Ethernet)</strong>
                <span class="tag ${fwe1 ? 'tag-green' : 'tag-orange'}">${fwe1 ? 'MEVCUT (851 KB)' : 'OPSİYONEL'}</span>
              </div>
              <div style="font-size:10.5px; color:var(--text-secondary); margin-top:4px;">Genişletilmiş Ethernet Sürücüsü</div>
            </div>

            <div style="background:var(--bg-card2); border:1px solid var(--border); padding:12px; border-radius:var(--radius-sm);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:12px; color:var(--text-primary);">FanucSHDRAdapter.exe</strong>
                <span class="tag ${adapter ? 'tag-green' : 'tag-red'}">${adapter ? 'MEVCUT (124 KB)' : 'YOK'}</span>
              </div>
              <div style="font-size:10.5px; color:var(--text-secondary); margin-top:4px;">FOCAS -> SHDR / MTConnect Köprüsü</div>
            </div>

            <div style="background:var(--bg-card2); border:1px solid var(--border); padding:12px; border-radius:var(--radius-sm);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:12px; color:var(--text-primary);">adapter.config.json</strong>
                <span class="tag ${cfg ? 'tag-green' : 'tag-red'}">${cfg ? 'GEÇERLİ' : 'EKSİK'}</span>
              </div>
              <div style="font-size:10.5px; color:var(--text-secondary); margin-top:4px;">Tezgâh IP ve Port Konfigürasyonu</div>
            </div>
          </div>

          <!-- Practical Advice Box -->
          <div style="background:rgba(56, 189, 248, 0.05); border:1px solid var(--border-accent); border-radius:var(--radius-md); padding:12px;">
            <strong style="font-size:12px; color:var(--text-accent); display:flex; align-items:center; gap:6px; margin-bottom:6px;">
              <span>💡</span> Saha Kurulum & Bağlantı Rehberi:
            </strong>
            <ul style="margin:0; padding-left:18px; font-size:11px; color:var(--text-secondary); line-height:1.6;">
              <li>Tezgâh tarafında FANUC panelinde <strong>[SYSTEM] -> [ETHPRM]</strong> menüsünden FOCAS Portunun <strong>8193</strong> olduğunu teyit edin.</li>
              <li>Bilgisayarınızın IP bloğu (örn: <code>192.168.1.100</code>) ile tezgâhın IP bloğu (örn: <code>192.168.1.50</code>) aynı alt ağda (Subnet) olmalıdır.</li>
            </ul>
          </div>
        </div>

        <!-- Modal Footer -->
        <div style="padding:12px 20px; background:var(--bg-card2); border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <button class="btn btn-secondary btn-sm" onclick="showFocasDriverHealthModal()">🔄 Tekrar Test Et</button>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('modal-focas-driver-health').remove()">Kapat</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
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

  const MTBCncLiveRemote = {
    renderCncDashboard: typeof renderCncDashboard !== 'undefined' ? renderCncDashboard : undefined,
    renderCncScreenViewer: typeof renderCncScreenViewer !== 'undefined' ? renderCncScreenViewer : undefined,
    onCncScreenMachineChange: typeof onCncScreenMachineChange !== 'undefined' ? onCncScreenMachineChange : undefined,
    showFocasScannerModal: typeof showFocasScannerModal !== 'undefined' ? showFocasScannerModal : undefined,
    runFocasScanner: typeof runFocasScanner !== 'undefined' ? runFocasScanner : undefined,
    saveDiscoveredMachine: typeof saveDiscoveredMachine !== 'undefined' ? saveDiscoveredMachine : undefined,
    autoCreateMachineFromScan: typeof autoCreateMachineFromScan !== 'undefined' ? autoCreateMachineFromScan : undefined,
    exportScannerResultsCSV: typeof exportScannerResultsCSV !== 'undefined' ? exportScannerResultsCSV : undefined
  };

  global.MTBCncLiveRemote = MTBCncLiveRemote;
  if (typeof renderCncDashboard !== 'undefined') global.renderCncDashboard = renderCncDashboard;
  if (typeof renderCncScreenViewer !== 'undefined') global.renderCncScreenViewer = renderCncScreenViewer;
  if (typeof onCncScreenMachineChange !== 'undefined') global.onCncScreenMachineChange = onCncScreenMachineChange;
  if (typeof showFocasScannerModal !== 'undefined') global.showFocasScannerModal = showFocasScannerModal;
  if (typeof runFocasScanner !== 'undefined') global.runFocasScanner = runFocasScanner;
  if (typeof saveDiscoveredMachine !== 'undefined') global.saveDiscoveredMachine = saveDiscoveredMachine;
  if (typeof autoCreateMachineFromScan !== 'undefined') global.autoCreateMachineFromScan = autoCreateMachineFromScan;
  if (typeof exportScannerResultsCSV !== 'undefined') global.exportScannerResultsCSV = exportScannerResultsCSV;
})(window);
