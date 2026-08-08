/* Salt okunur RS232/DNC rehberi ve yerel aktarım simülasyonu. */
(function rs232Feature(global) {
  'use strict';
  let api = null;

  function initialize(deps) {
    if (api) return api;
    const { createPage, showToast } = deps;

function renderRS232() {
  const page = createPage('rs232');
  page.innerHTML = `
    <div class="page-header">
      <h1>📶 RS232 / DNC Seri Haberleşme & Parametre Rehberi</h1>
      <p>FANUC tezgahları için RS232 port ayarları, kablo şemaları ve interaktif G-Kod transfer simülatörü</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 1.2fr 0.8fr; gap:16px">
        
        <!-- Left: Simulator -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:between">
          <div>
            <div class="card-title mb-3">📤 DNC Dosya Aktarım Simülatörü</div>
            <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:12px">
              Bu ekran gerçek CNC bağlantısı kurmaz. G-Kod metnini ve DNC ayarlarını salt okunur bir aktarım simülasyonu ile kontrol edin.
            </p>
            
            <div class="grid-2 mb-3" style="gap:8px">
              <div class="form-group" style="margin:0">
                <label class="form-label" style="font-size:10.5px">Baud Rate</label>
                <select class="form-control" id="dnc-baud" style="padding:6px; font-size:11.5px">
                  <option value="4800">4800 Baud</option>
                  <option value="9600" selected>9600 Baud</option>
                  <option value="19200">19200 Baud</option>
                </select>
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label" style="font-size:10.5px">Akış Kontrolü (Handshake)</label>
                <select class="form-control" id="dnc-flow" style="padding:6px; font-size:11.5px">
                  <option value="xon">XON / XOFF (Yazılımsal)</option>
                  <option value="hw">Donanımsal (RTS/CTS)</option>
                </select>
              </div>
            </div>

            <!-- Signal Leds -->
            <div style="display:flex; gap:14px; margin-bottom:14px; background:var(--bg-card2); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border)">
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600">
                <span id="led-tx" style="width:10px; height:10px; border-radius:50%; background:#374151; display:inline-block; transition:background .15s ease"></span> TX (Send)
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600">
                <span id="led-rx" style="width:10px; height:10px; border-radius:50%; background:#374151; display:inline-block; transition:background .15s ease"></span> RX (Recv)
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600">
                <span id="led-rts" style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block; transition:background .15s ease"></span> RTS (Ready)
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600">
                <span id="led-cts" style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block; transition:background .15s ease"></span> CTS (Clear)
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size:11px">Gönderilecek G-Code Sinyal İçeriği</label>
              <textarea class="form-control" id="dnc-gcode-input" rows="8" style="font-family:monospace; font-size:11.5px; background:#0f172a; color:#a5f3fc; line-height:1.4">%
O1001 (RS232 DNC TEST)
G21 G90 G40 G80
T0101 M06 (DIS CAP TORNA)
G97 S1200 M03
G00 X50.0 Z5.0 M08
G01 Z-25.0 F0.2
G01 X60.0 F0.5
G00 X100.0 Z100.0 M09
G28 U0.0 W0.0
M30
%</textarea>
            </div>

            <!-- Progress Bar -->
            <div style="width:100%; height:6px; background:#1f2937; border-radius:3px; overflow:hidden; margin-bottom:12px">
              <div id="dnc-progress" style="width:0%; height:100%; background:var(--accent); transition:width .1s linear"></div>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-primary" id="btn-dnc-send" onclick="startDncTransmission()">📤 Simülasyonu Başlat</button>
            <button class="btn btn-secondary" id="btn-dnc-stop" onclick="stopDncTransmission()" disabled>Durdur</button>
          </div>
        </div>

        <!-- Right: Wiring Diagram & Params -->
        <div class="card" style="display:flex; flex-direction:column; gap:16px">
          <div>
            <div class="card-title mb-2">🔌 FANUC RS232 Parametre Ayarları</div>
            <table class="data-table" style="font-size:11px">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Parametre Adı</th>
                  <th>Ayar Değeri</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong class="font-mono">0000</strong></td>
                  <td>ISO Kodu Çıkışı</td>
                  <td><strong style="color:var(--text-accent)">1 (ISO)</strong></td>
                </tr>
                <tr>
                  <td><strong class="font-mono">0020</strong></td>
                  <td>I/O Kanal Seçimi</td>
                  <td><strong style="color:var(--text-accent)">0 (Channel 1 RS232)</strong></td>
                </tr>
                <tr>
                  <td><strong class="font-mono">0101</strong></td>
                  <td>Veri formatı / Stop Bit</td>
                  <td><strong>10000001 (1 Stop Bit, 7-E)</strong></td>
                </tr>
                <tr>
                  <td><strong class="font-mono">0102</strong></td>
                  <td>Cihaz Tipi</td>
                  <td><strong>3 (RS-232C Terminal)</strong></td>
                </tr>
                <tr>
                  <td><strong class="font-mono">0103</strong></td>
                  <td>Baud Rate Hızı</td>
                  <td><strong>11 (9600) veya 12 (19200)</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <div class="card-title mb-2">🗺️ DB9 (PC) - DB25 (CNC) Kablo Şeması</div>
            <p style="font-size:11px; color:var(--text-secondary); margin-bottom:8px">
              Yazılımsal Akış Kontrolü (XON/XOFF) için Null-Modem kablo bağlantı şeması:
            </p>
            <div style="background:#0f172a; padding:12px; border-radius:4px; border:1px solid var(--border); font-family:monospace; font-size:11px; line-height:1.5; color:var(--green)">
              PC (DB9 Dişi)               CNC (DB25 Erkek)
              -------------               ----------------
              Pin 2 (RXD)  <------------  Pin 2 (TXD)
              Pin 3 (TXD)  ------------->  Pin 3 (RXD)
              Pin 5 (GND)  =============  Pin 7 (SG)
              
              Pin 7 (RTS) --+             Pin 4 (RTS) --+
              Pin 8 (CTS) --+ (Köprü)     Pin 5 (CTS) --+ (Köprü)
              
              Pin 4 (DTR) --+             Pin 6 (DSR) --+
              Pin 6 (DSR) --+ (Köprü)     Pin 20(DTR) --+ (Köprü)
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  return page;
}

let DncInterval = null;
window.startDncTransmission = function() {
  const codeText = document.getElementById('dnc-gcode-input').value;
  const lines = codeText.split('\n');
  if (!lines.length || !codeText.trim()) {
    showToast('Gönderilecek G-Code bulunamadı.', 'error');
    return;
  }

  const sendBtn = document.getElementById('btn-dnc-send');
  const stopBtn = document.getElementById('btn-dnc-stop');
  const progBar = document.getElementById('dnc-progress');
  const ledTx = document.getElementById('led-tx');

  sendBtn.disabled = true;
  stopBtn.disabled = false;
  progBar.style.width = '0%';

  let currentLine = 0;
  const totalLines = lines.length;

  DncInterval = setInterval(() => {
    if (currentLine >= totalLines) {
      clearInterval(DncInterval);
      DncInterval = null;
      sendBtn.disabled = false;
      stopBtn.disabled = true;
      ledTx.style.background = '#374151';
      showToast("DNC aktarım simülasyonu tamamlandı; CNC'ye veri gönderilmedi.", 'success');
      return;
    }

    // Toggle LED flash for TX transmit
    ledTx.style.background = ledTx.style.background === 'rgb(59, 130, 246)' ? '#374151' : '#3b82f6';

    // Update progress
    currentLine++;
    const percent = Math.round((currentLine / totalLines) * 100);
    progBar.style.width = percent + '%';
  }, 180);
};

window.stopDncTransmission = function() {
  if (DncInterval) {
    clearInterval(DncInterval);
    DncInterval = null;
  }
  document.getElementById('btn-dnc-send').disabled = false;
  document.getElementById('btn-dnc-stop').disabled = true;
  document.getElementById('led-tx').style.background = '#374151';
  showToast('DNC aktarım simülasyonu durduruldu.', 'info');
};


    api = { renderRS232 };
    return api;
  }

  global.MTBRS232Feature = Object.freeze({ initialize });
})(window);
