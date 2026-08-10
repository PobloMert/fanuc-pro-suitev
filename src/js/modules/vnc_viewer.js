/**
 * MTB Elektrik Bakım — read-only CNC display port reachability check.
 * This module never opens a control channel and never sends a CNC command.
 */

import { showToast, escapeHTML } from '../utils.js';

let _activeStreamIp = null;
let _isStreaming = false;

export async function connectCncScreenStream(ipAddress, port = 5900) {
  const ip = (ipAddress || '').trim();
  const numPort = parseInt(port) || 5900;

  if (!ip) {
    showToast('Geçerli bir tezgâh IP adresi giriniz (Örn: 192.168.1.50)', 'error');
    return false;
  }

  const container = document.getElementById('cnc-screen-frame-wrap');
  const statusBadge = document.getElementById('cnc-screen-status-badge');
  const statusText = document.getElementById('cnc-screen-status-text');

  if (statusBadge) {
    statusBadge.className = 'tag tag-amber';
    statusBadge.innerHTML = '🟡 Bağlantı Sınanıyor...';
  }
  if (statusText) {
    statusText.textContent = `${ip}:${numPort} salt-okunur erişilebilirlik kontrolü yapılıyor...`;
  }

  showToast(`${ip}:${numPort} adresine bağlantı deneniyor...`, 'info');

  // A short-lived TCP reachability probe only. No VNC protocol or command payload is sent.
  let pingResult = { ok: false, error: 'Ping API mevcut değil' };
  if (window.electronAPI && typeof window.electronAPI.pingTcpPort === 'function') {
    pingResult = await window.electronAPI.pingTcpPort(ip, numPort, 3000);
  }

  if (!pingResult.ok || !pingResult.connected) {
    _activeStreamIp = null;
    _isStreaming = false;

    if (statusBadge) {
      statusBadge.className = 'tag tag-red';
      statusBadge.innerHTML = '🔴 Bağlantı Başarısız';
    }
    if (statusText) {
      statusText.textContent = `${ip}:${numPort} — ${pingResult.error || 'Cihaza ulaşılamadı'}`;
    }

    if (container) {
      container.innerHTML = `
        <div style="width:100%; height:400px; background:#111827; border:2px solid #ef4444; border-radius:var(--radius-md); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:30px">
          <div style="font-size:42px; margin-bottom:12px">⚠️</div>
          <div style="font-weight:700; font-size:16px; color:#f87171; margin-bottom:8px">GERÇEK BAĞLANTI HATASI</div>
          <div style="font-size:13px; color:#e2e8f0; max-width:550px; margin-bottom:14px; background:rgba(239,68,68,0.1); padding:10px; border-radius:6px; border:1px solid rgba(239,68,68,0.3)">
            <strong>${escapeHTML(ip)}:${numPort}</strong> adresiyle iletişim kurulamadı.<br>
            <span style="font-size:11.5px; color:#fca5a5">${escapeHTML(pingResult.error || 'TCP Socket Timeout / Refused')}</span>
          </div>
          <div style="font-size:12px; color:#94a3b8; text-align:left; max-width:500px">
            📌 <strong>Elektrik Kontrol Adımları:</strong><br>
            1. Tezgâh elektrik panosundaki Ethernet (RJ45) kablosunu kontrol edin.<br>
            2. FANUC ekranından <code>SYSTEM → EMBEDDED ETHERNET</code> menüsünden tezgâh IP adresini doğrulayın.<br>
            3. Tezgâhta VNC / Remote Screen Display parametre kilidinin açık olduğunu doğrulayın.
          </div>
        </div>
      `;
    }

    showToast(`Bağlantı Başarısız: ${ip}:${numPort} adresine ulaşılamadı!`, 'error');
    return false;
  }

  // The port accepted a TCP connection. This does not imply a screen stream.
  _activeStreamIp = ip;
  _isStreaming = true;

  if (statusBadge) {
    statusBadge.className = 'tag tag-green';
    statusBadge.innerHTML = '🟢 Port Erişilebilir';
  }
  if (statusText) {
    statusText.textContent = `IP: ${ip}:${numPort} — yalnızca bağlantı kontrolü başarılı`;
  }

  if (container) {
    container.innerHTML = `
      <div id="cnc-virtual-screen" style="width:100%; height:450px; background:#000; border-radius:var(--radius-md); display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; overflow:hidden; border:2px solid #10b981; box-shadow:0 0 20px rgba(16,185,129,0.3)">
        <div style="position:absolute; top:0; left:0; right:0; height:32px; background:#0f172a; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between; padding:0 14px; font-family:var(--font-mono); font-size:12px; color:#38bdf8">
          <span>FANUC SALT-OKUNUR BAĞLANTI KONTROLÜ — ${escapeHTML(ip)}:${numPort}</span>
          <span style="color:#4ade80">● PORT ERİŞİLEBİLİR</span>
        </div>
        <div id="crt-canvas-area" style="margin-top:32px; width:100%; height:calc(100% - 32px); background:#060d17; padding:20px; font-family:var(--font-mono); color:#4ade80; display:flex; flex-direction:column; justify-content:between">
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid #1e293b; padding-bottom:10px; margin-bottom:10px">
            <div>
              <div style="font-size:16px; font-weight:bold; color:#facc15">KUMANDA KANALI DEVRE DIŞI</div>
              <div style="font-size:13px; color:#94a3b8; margin-top:10px">Ekran verisi okunmadı. CNC'ye tuş, program veya parametre komutu gönderilmedi.</div>
            </div>
            <div style="text-align:right; font-size:12px; color:#94a3b8">
              <div>ERİŞİLEBİLİRLİK: <strong style="color:#4ade80">TCP OK</strong></div>
              <div>PORT: <strong style="color:#38bdf8">${numPort}</strong></div>
            </div>
          </div>
          <div style="font-size:11.5px; color:#64748b; margin-top:auto">
            SALT-OKUNUR PORT KONTROLÜ (${escapeHTML(ip)}) · Komut aktarımı yok
          </div>
        </div>
      </div>
    `;
  }

  showToast(`Salt-okunur port kontrolü başarılı: ${ip}:${numPort}`, 'success');
  return true;
}


export function disconnectCncScreenStream() {
  _activeStreamIp = null;
  _isStreaming = false;

  const container = document.getElementById('cnc-screen-frame-wrap');
  const statusBadge = document.getElementById('cnc-screen-status-badge');
  const statusText = document.getElementById('cnc-screen-status-text');

  if (statusBadge) {
    statusBadge.className = 'tag tag-gray';
    statusBadge.innerHTML = '⚪ Çevrimdışı';
  }
  if (statusText) {
    statusText.textContent = 'Bağlantı Kesildi';
  }

  if (container) {
    container.innerHTML = `
      <div style="width:100%; height:380px; background:var(--bg-card2); border:2px dashed var(--border); border-radius:var(--radius-md); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:30px">
        <div style="font-size:36px; margin-bottom:10px; opacity:0.6">🖥️</div>
        <div style="font-weight:600; font-size:14px; margin-bottom:6px">CNC Canlı Ekran Akışı Durduruldu</div>
        <div style="font-size:12px; color:var(--text-muted); max-width:400px">
          Tezgâh IP adresini girip "Canlı Bağlantıyı Başlat" butonuna tıklayarak uzaktan ekran izlemeyi aktifleştirin.
        </div>
      </div>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.connectCncScreenStream = connectCncScreenStream;
  window.disconnectCncScreenStream = disconnectCncScreenStream;
}
