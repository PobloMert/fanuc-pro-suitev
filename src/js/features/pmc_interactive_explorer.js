// ════════════════════════════════════════════════════════════════
//  FANUC PRO SUITE — INTERACTIVE PMC SIGNAL EXPLORER MODULE
// ════════════════════════════════════════════════════════════════

(function(window) {
  'use strict';

  const PmcSimState = {
    'G8.4': 1, // VRDY
    'G8.5': 1, // *SP Feed Hold
    'X4.2': 1, // Door Interlock
    'X4.0': 1, // Lube Pressure Switch
    'X8.0': 1, // Air Pressure Switch
    'K0.0': 0  // Spindle Interlock Bypass
  };

  function renderPmcInteractiveExplorer() {
    return `
      <div class="card glass-card mb-4" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="font-weight:750; font-size:15px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span>🔌 İnteraktif PMC Sinyal & Ladder Simülatörü</span>
              <span class="tag tag-blue" style="font-size:10px;">Canlı Sinyal Akış Testi</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
              Sinyal bitlerini 0 / 1 olarak değiştirerek CNC ve servo sürücüler üzerindeki anlık tepkisini simüle edin.
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="printPmcSignalGuidePDF()" style="font-size:11.5px; padding:4px 12px; display:flex; align-items:center; gap:6px;">
            🖨️ PMC Adres Haritasını Yazdır (PDF)
          </button>
        </div>

        <!-- Signal Buttons Grid -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:12px; margin-bottom:16px;">
          
          <!-- G8.4 VRDY -->
          <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:700; font-size:12.5px; color:var(--text-primary);">G8.4 (VRDY)</span>
                <span class="tag ${PmcSimState['G8.4'] ? 'tag-green' : 'tag-red'}" id="pmc-tag-G8.4" style="font-weight:700;">
                  ${PmcSimState['G8.4'] ? '1 (HAZIR)' : '0 (KESİK)'}
                </span>
              </div>
              <div style="font-size:11px; color:var(--text-secondary); line-height:1.4; margin-bottom:10px;">
                Servo Ready (Servo Hazır Sinyali). 0 yapılırsa CNC anında SV0401 uyarısı verir.
              </div>
            </div>
            <button class="btn ${PmcSimState['G8.4'] ? 'btn-danger' : 'btn-success'} btn-sm" onclick="togglePmcSignal('G8.4')" style="font-weight:600; padding:4px;">
              ${PmcSimState['G8.4'] ? '⚡ Sinyali Kes (0 Yap)' : '✅ Sinyali Ver (1 Yap)'}
            </button>
          </div>

          <!-- G8.5 *SP -->
          <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:700; font-size:12.5px; color:var(--text-primary);">G8.5 (*SP)</span>
                <span class="tag ${PmcSimState['G8.5'] ? 'tag-green' : 'tag-orange'}" id="pmc-tag-G8.5" style="font-weight:700;">
                  ${PmcSimState['G8.5'] ? '1 (NORMAL)' : '0 (HOLD)'}
                </span>
              </div>
              <div style="font-size:11px; color:var(--text-secondary); line-height:1.4; margin-bottom:10px;">
                Feed Hold (İlerleme Durdurma). 0 yapılırsa eksen hareketi duraklatılır.
              </div>
            </div>
            <button class="btn ${PmcSimState['G8.5'] ? 'btn-secondary' : 'btn-success'} btn-sm" onclick="togglePmcSignal('G8.5')" style="font-weight:600; padding:4px;">
              ${PmcSimState['G8.5'] ? '⏸️ Feed Hold Et (0 Yap)' : '▶️ Çalıştır (1 Yap)'}
            </button>
          </div>

          <!-- X4.2 Door Interlock -->
          <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:700; font-size:12.5px; color:var(--text-primary);">X4.2 (DOOR_SW)</span>
                <span class="tag ${PmcSimState['X4.2'] ? 'tag-green' : 'tag-red'}" id="pmc-tag-X4.2" style="font-weight:700;">
                  ${PmcSimState['X4.2'] ? '1 (KAPALI/KİLİTLİ)' : '0 (KAPI AÇIK)'}
                </span>
              </div>
              <div style="font-size:11px; color:var(--text-secondary); line-height:1.4; margin-bottom:10px;">
                Kapı Güvenlik Şalteri. Kapı açıldığında (0) Spindle ve Otomatik Çalışma kilitlenir.
              </div>
            </div>
            <button class="btn ${PmcSimState['X4.2'] ? 'btn-danger' : 'btn-success'} btn-sm" onclick="togglePmcSignal('X4.2')" style="font-weight:600; padding:4px;">
              ${PmcSimState['X4.2'] ? '🚪 Kapıyı Aç (0 Yap)' : '🔒 Kapıyı Kapat (1 Yap)'}
            </button>
          </div>

          <!-- X4.0 Lube Switch -->
          <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:700; font-size:12.5px; color:var(--text-primary);">X4.0 (LUBE_SW)</span>
                <span class="tag ${PmcSimState['X4.0'] ? 'tag-green' : 'tag-red'}" id="pmc-tag-X4.0" style="font-weight:700;">
                  ${PmcSimState['X4.0'] ? '1 (YAĞ SEVİYESİ TAM)' : '0 (YAĞ BİTTİ)'}
                </span>
              </div>
              <div style="font-size:11px; color:var(--text-secondary); line-height:1.4; margin-bottom:10px;">
                Kızak Yağlama Seviye Şalteri. Yağ bittiğinde (0) EX0001 uyarısı tetiklenir.
              </div>
            </div>
            <button class="btn ${PmcSimState['X4.0'] ? 'btn-danger' : 'btn-success'} btn-sm" onclick="togglePmcSignal('X4.0')" style="font-weight:600; padding:4px;">
              ${PmcSimState['X4.0'] ? '🛢️ Yağı Boşalt (0 Yap)' : '💧 Yağ Doldur (1 Yap)'}
            </button>
          </div>

        </div>

        <!-- Simulation Output Box -->
        <div id="pmc-sim-output" style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px;">
          ${getPmcSimOutputHTML()}
        </div>
      </div>
    `;
  }

  function getPmcSimOutputHTML() {
    const alerts = [];

    if (!PmcSimState['G8.4']) {
      alerts.push({
        type: 'red',
        title: '🚨 SV0401 SERVO ALARM: V-READY OFF',
        desc: 'Servo sürücüler hazırlık sinyalini kaybetti! Kontakör (MCC) bobini enerjisiz kaldı ve 3-faz motor beslemeleri kesildi.'
      });
    }

    if (!PmcSimState['G8.5']) {
      alerts.push({
        type: 'orange',
        title: '⏸️ FEED HOLD ACTIVE (G8.5 = 0)',
        desc: 'Eksen ilerlemesi duraklatıldı. CNC program okuması askıda, Spindle dönmeye devam ediyor.'
      });
    }

    if (!PmcSimState['X4.2']) {
      alerts.push({
        type: 'red',
        title: '🚪 TEZGAH GÜVENLİK KAPISI AÇIK (X4.2 = 0)',
        desc: 'Spindle dönüşü ve otomatik çalışma kilitlendi. Manuel ayarlama moduna geçildi.'
      });
    }

    if (!PmcSimState['X4.0']) {
      alerts.push({
        type: 'red',
        title: '🛢️ EX0001 KIZAK YAĞLAMA SEVİYE ALARMI (X4.0 = 0)',
        desc: 'Kızak yağ tankı boşaldı! Kızakların çizilmesini önlemek için periyodik çalışma engellendi.'
      });
    }

    if (!alerts.length) {
      return `
        <div style="color:var(--text-accent); font-weight:700; font-size:13px; display:flex; align-items:center; gap:8px;">
          <span>✅ TÜM PMC SİNYALLERİ NORMAL (Sistem Çalışmaya Hazır)</span>
        </div>
        <div style="font-size:11.5px; color:var(--text-secondary); margin-top:4px;">
          G8.4 VRDY=1, G8.5 *SP=1, X4.2 Door=1, X4.0 Lube=1. CNC ve Servo Sürücüler sorunsuz çalışabilir durumdadır.
        </div>
      `;
    }

    return `
      <div style="font-weight:750; font-size:13px; color:var(--text-primary); margin-bottom:8px;">⚡ Simüle Edilen CNC & Sürücü Tepkileri (${alerts.length} Tetiklenme):</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${alerts.map(a => `
          <div style="background:var(--bg-card); border-left:4px solid var(--${a.type === 'red' ? 'danger' : 'warning'}); padding:10px 12px; border-radius:4px;">
            <div style="font-weight:700; font-size:12px; color:var(--text-primary);">${a.title}</div>
            <div style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">${a.desc}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  window.togglePmcSignal = function(key) {
    if (typeof PmcSimState[key] !== 'undefined') {
      PmcSimState[key] = PmcSimState[key] ? 0 : 1;
      
      const tag = document.getElementById('pmc-tag-' + key);
      if (tag) {
        tag.className = `tag ${PmcSimState[key] ? 'tag-green' : 'tag-red'}`;
        tag.textContent = PmcSimState[key] ? '1 (HAZIR)' : '0 (KESİK)';
      }

      const out = document.getElementById('pmc-sim-output');
      if (out) {
        out.innerHTML = getPmcSimOutputHTML();
      }
    }
  };

  window.printPmcSignalGuidePDF = function() {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>FANUC PMC Sinyal Adres Haritası</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 30px; color: #111; font-size: 12px; line-height: 1.5; }
          h1 { font-size: 18px; color: #0056b3; border-bottom: 2px solid #0056b3; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f0f4f8; color: #0056b3; }
        </style>
      </head>
      <body>
        <h1>🔌 FANUC PMC Sinyal & Adres Haritası (Saha Referansı)</h1>
        <p>Rapor Tarihi: ${new Date().toLocaleString('tr-TR')}</p>

        <table>
          <thead>
            <tr>
              <th>Adres</th>
              <th>Sembol</th>
              <th>Yön (Direction)</th>
              <th>Açıklama & İşlev</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><b>G0008.4</b></td><td>VRDY</td><td>PMC → CNC</td><td>Servo Ready (Servo Sürücüler Hazır Sinyali). 1 olmalıdır.</td></tr>
            <tr><td><b>G0008.5</b></td><td>*SP</td><td>PMC → CNC</td><td>Feed Hold (İlerleme Durdurma). Active Low (1=Çalışır, 0=Durur).</td></tr>
            <tr><td><b>G0007.2</b></td><td>ST</td><td>PMC → CNC</td><td>Cycle Start (Döngü Başlatma). Yükselen kenar ile program çalıştırır.</td></tr>
            <tr><td><b>F0001.0</b></td><td>DEN</td><td>CNC → PMC</td><td>Distribution Completed (Komut Dağıtımı Tamamlandı).</td></tr>
            <tr><td><b>X0004.2</b></td><td>DOOR_SW</td><td>Machine → PMC</td><td>Tezgah Kapı Güvenlik Şalteri Girişi (1=Kapalı/Kilitli).</td></tr>
            <tr><td><b>Y0002.1</b></td><td>COOLANT_SOL</td><td>PMC → Machine</td><td>Soğutma Sıvısı Pompa Solenoid Çıkışı (M08).</td></tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
    window.electronAPI.printToPDF(htmlContent, 'fanuc-pmc-signal-map.pdf');
  };

  window.renderPmcInteractiveExplorer = renderPmcInteractiveExplorer;
})(window);
