/* Renderer'dan ayrılmış mühendislik ekranı. */
(function feature(global) {
  'use strict';
  let api = null;
  function initialize(deps) {
    if (api) return api;
    const { createPage, showToast } = deps;

window.CurrentDriveTab = 'led';

function renderDriveDiagnostics() {
  const page = createPage('drive_diagnostics');
  page.innerHTML = `
    <div class="page-header">
      <h1>🔧 Servo & Spindle Sürücü Hata Teşhis Sihirbazı</h1>
      <p>Sürücü arızalarını teşhis edin ve kabin içi sıcaklık / watchdog koruma parametrelerini inceleyin</p>
      
      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-dr-led" onclick="switchDriveTab('led')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          🚨 7-Segment LED Hata Teşhisi
        </button>
        <button class="tab-btn" id="tab-dr-heat" onclick="switchDriveTab('heat')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🌡️ Kabin Isı Kontrolü & Alarmlar
        </button>
        <button class="tab-btn" id="tab-dr-comm" onclick="switchDriveTab('commutation')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          ⚡ Servo Enkoder Kutup Hizalama
        </button>
      </div>
    </div>
    
    <div class="page-body" id="drive-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchDriveTab(window.CurrentDriveTab, page);
  }, 10);

  return page;
}

window.switchDriveTab = function(tab, page = document) {
  window.CurrentDriveTab = tab;
  
  const ledBtn = page.querySelector('#tab-dr-led');
  const heatBtn = page.querySelector('#tab-dr-heat');
  const commBtn = page.querySelector('#tab-dr-comm');
  if (ledBtn && heatBtn && commBtn) {
    ledBtn.style.color = tab === 'led' ? 'var(--text-accent)' : 'var(--text-secondary)';
    ledBtn.style.fontWeight = tab === 'led' ? 'bold' : 'normal';
    heatBtn.style.color = tab === 'heat' ? 'var(--text-accent)' : 'var(--text-secondary)';
    heatBtn.style.fontWeight = tab === 'heat' ? 'bold' : 'normal';
    commBtn.style.color = tab === 'commutation' ? 'var(--text-accent)' : 'var(--text-secondary)';
    commBtn.style.fontWeight = tab === 'commutation' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#drive-tab-content');
  if (!content) return;

  if (tab === 'led') {
    content.innerHTML = `
      <div class="grid-2 mb-4" style="grid-template-columns: 0.8fr 1.2fr; gap:16px">
        <!-- Left: Input & LED Simulation -->
        <div class="card" style="display:flex; flex-direction:column; align-items:center; text-align:center; justify-content:space-between; padding:24px">
          <div style="width:100%">
            <div class="card-title mb-3" style="text-align:left">🚨 7-Segment Dijital Ekran</div>
            <div class="form-group" style="text-align:left">
              <label class="form-label">Sürücü Ekran Kodu Seçin</label>
              <select class="form-control" id="diag-code-select" onchange="updateDiagLedDisplay()">
                <option value="">Kod Seçin...</option>
                ${State.drive_alarms.map(a => `<option value="${a.code}">${a.code} — ${a.title}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Glow LED Box -->
          <div style="width:120px; height:160px; background:#000; border:4px solid #1f2937; border-radius:8px; display:flex; align-items:center; justify-content:center; margin:24px 0; box-shadow:0 0 20px rgba(239,68,68,0.15)">
            <span id="led-display-text" style="font-family:'Courier New', monospace; font-size:90px; font-weight:900; color:#1f2937; text-shadow:none; transition:all .3s ease">--</span>
          </div>

          <button class="btn btn-primary w-100" onclick="runDriveDiagnosis()">⚡ Arızayı Teşhis Et</button>
        </div>

        <!-- Right: Diagnosis Details -->
        <div class="card" id="diag-results-card" style="padding:20px; min-height:300px">
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted)" id="diag-empty-state">
            <svg style="width:48px; height:48px; stroke:currentColor; fill:none; stroke-width:1.5; margin-bottom:12px" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p style="font-size:13px">Lütfen sol taraftan sürücü ekranında yanan kodu seçip "Arızayı Teşhis Et" butonuna basın.</p>
          </div>
          <div id="diag-details-content" style="display:none; line-height:1.6"></div>
        </div>
      </div>
    `;
  } else if (tab === 'heat') {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">
        
        <!-- Left: Overheat alarms guide -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title" style="color:var(--red)">🌡️ Kabin & Kart Aşırı Isınma Alarmları</div>
          
          <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--red); border-radius:4px; font-size:12px">
            <strong>ALARM 700 - CNC MAIN BOARD OVERHEAT:</strong><br>
            CNC ana işlemci kartı (Main CPU) sıcaklığı kritik eşiği aştı. Soğutucu fanın çalışıp çalışmadığını kontrol edin.
          </div>
          
          <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--amber); border-radius:4px; font-size:12px">
            <strong>ALARM 704 - SPINDLE/SERVO DRIVE OVERHEAT:</strong><br>
            Sürücü soğutucu bloklarında (heatsink) aşırı ısınma algılandı. Genellikle sürücü gövdesinin dışındaki kabin fanları durduğunda tetiklenir.
          </div>

          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:6px">
            <strong>🔧 Arıza Giderme Adımları:</strong>
            <div>1. Elektrik kabininin arkasındaki ve sürücü üstündeki sarı fanların dönüp dönmediğini fiziksel olarak kontrol edin.</div>
            <div>2. Filtreleri söküp hava üfleyin (yağ buharı fan kanatlarını kilitleyebilir).</div>
            <div>3. Geçici acil durum kurtarması için elektrik kabin kapağını açıp harici vantilatör ile soğutma sağlayın.</div>
          </div>
        </div>

        <!-- Right: Temperature monitoring parameters -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">⚙️ Isı İzleme ve Parametre Göstergeleri</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Ana kart sıcaklığını doğrudan CNC ekranında görmek için parametreyi aktif edin:
          </p>

          <div style="background:#0f172a; padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border); font-family:monospace; font-size:12.5px; color:#00ff00">
            <div style="border-bottom:1px solid #00ff00; padding-bottom:4px; font-size:11px; margin-bottom:8px">PARAMETER SETTING</div>
            <div style="display:flex; justify-content:space-between">
              <span>Parametre 3111 #0 (TEMD)</span>
              <span><strong>1</strong> (Ekranda Sıcaklık Göster)</span>
            </div>
          </div>

          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:6px">
            <strong>📊 Diagnostic İzleme Değerleri:</strong>
            <div style="display:flex; justify-content:space-between; background:var(--bg-card2); padding:6px; border-radius:4px">
              <span>DGN 1010 (CPU Isısı):</span>
              <strong style="color:var(--text-accent)">Maksimum 85°C Sınırı</strong>
            </div>
            <div style="display:flex; justify-content:space-between; background:var(--bg-card2); padding:6px; border-radius:4px">
              <span>DGN 1014 (Sürücü Modül Sıcaklığı):</span>
              <strong style="color:var(--text-accent)">Maksimum 90°C Sınırı</strong>
            </div>
          </div>
        </div>

      </div>
    `;
  } else if (tab === 'commutation') {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px; padding:0 20px">
        
        <!-- Left: Phase angle alignment -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title" style="color:var(--text-accent)">⚡ Servo Motor Enkoder Kutup (Phase Angle) Hizalama</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            Servo motorların enkoderi (Pulsecoder) tamir veya değişim için söküldüğünde, motor kutup açısı (rotor mıknatıs sıfır noktası) ile enkoder sıfır noktası arasındaki faz açısı kayar. Bu durum tezgah açıldığında eksenin aniden fırlamasına ve aşırı sapma (Excessive Error) alarmlarına yol açar.
          </p>

          <div style="font-size:12px; display:flex; flex-direction:column; gap:8px">
            <strong>🔧 Adım Adım Faz Hizalama Prosedürü:</strong>
            <div>1. CNC gücünü kapatın. Motoru makineden söküp boşa alın (miller serbest dönmelidir).</div>
            <div>2. <code>SYSTEM > PARAM > 2000</code> serisindeki motor parametrelerini kontrol edin. Akım hizalamayı açmak için Parameter <strong>2013#0 (FCMD)</strong> bitini <code>1</code> yapın.</div>
            <div>3. Tezgahı açın. Eksene çok düşük bir hızda (MDI modunda jog) manuel hareket verin.</div>
            <div>4. Sürücü kontrol kartı, enkoderden gelen Z sinyali ile motorun U-Fazı sargı akımını otomatik olarak eşleştirecektir.</div>
            <div>5. İşlem bittiğinde <strong>FCMD</strong> parametresini tekrar <code>0</code> yapıp CNC'yi yeniden başlatın.</div>
          </div>
        </div>

        <!-- Right: Diagnostic value checking -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">📊 Kutup Açısı İzleme Diagnostic Ekranı</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Hizalama bittikten sonra faz açısının doğruluğunu diagnostic ekranı üzerinden teyit edin:
          </p>

          <div style="background:#0f172a; padding:12px; border-radius:4px; font-family:monospace; font-size:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:8px">
            <div>
              <strong style="color:var(--text-accent)">• Diagnostic 453 (Phase Angle):</strong><br>
              Hizalama sonrasında bu değer kararlı olmalıdır. Eksen boştayken elinizle mili zorladığınızda değerin dalgalanıp eski haline döndüğünü gözlemleyin.
            </div>
            <div style="padding:8px; background:rgba(239,68,68,0.06); border-radius:4px; border:1px solid rgba(239,68,68,0.15); color:var(--red); font-size:11px">
              ⚠️ <strong>DİKKAT:</strong> Yanlış kutup hizalaması motorun kontrolsüzce son hızda dönüp çarparak mekanik stoperleri kırmasına yol açabilir! Test sırasında eksen yakınında durmayın ve eliniz acil stop butonunda hazır bekleyin.
            </div>
          </div>
        </div>

      </div>
    `;
  }
};

window.updateDiagLedDisplay = function() {
  const code = document.getElementById('diag-code-select').value;
  const led = document.getElementById('led-display-text');
  if (led) {
    if (code) {
      led.innerText = code;
      led.style.color = '#ef4444';
      led.style.textShadow = '0 0 15px rgba(239, 68, 68, 0.8)';
    } else {
      led.innerText = '--';
      led.style.color = '#1f2937';
      led.style.textShadow = 'none';
    }
  }
};

window.runDriveDiagnosis = function() {
  const code = document.getElementById('diag-code-select').value;
  const emptyState = document.getElementById('diag-empty-state');
  const detailsContent = document.getElementById('diag-details-content');

  if (!code) {
    showToast('Lütfen bir arıza kodu seçin.', 'error');
    return;
  }

  const alarm = State.drive_alarms.find(a => a.code === code);
  if (!alarm) return;

  emptyState.style.display = 'none';
  detailsContent.style.display = 'block';

  let typeTag = 'tag-blue';
  if (alarm.type.includes('Servo')) typeTag = 'tag-purple';
  if (alarm.type.includes('Spindle')) typeTag = 'tag-orange';

  detailsContent.innerHTML = `
    <div style="display:flex; justify-content:between; align-items:center; margin-bottom:12px">
      <h2 style="font-size:16px; color:var(--text-accent); margin:0">${alarm.code} — ${alarm.title}</h2>
      <span class="tag ${typeTag}">${alarm.type}</span>
    </div>
    <p style="font-size:12.5px; color:var(--text-secondary); margin-bottom:16px">${alarm.description}</p>
    
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">
      <div>
        <strong style="font-size:11px; text-transform:uppercase; color:var(--red); letter-spacing:.5px">Olası Arıza Nedenleri:</strong>
        <ul style="font-size:12px; color:var(--text-secondary); margin-top:6px; padding-left:16px; display:flex; flex-direction:column; gap:4px">
          ${alarm.causes.map(c => `<li>${c}</li>`).join('')}
        </ul>
      </div>
      <div>
        <strong style="font-size:11px; text-transform:uppercase; color:var(--green); letter-spacing:.5px">Çözüm / Kontrol Adımları:</strong>
        <ul style="font-size:12px; color:var(--text-secondary); margin-top:6px; padding-left:16px; display:flex; flex-direction:column; gap:4px">
          ${alarm.solutions.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
};

// ════════════════════════════════════════════════════════════════
//  ESNEK DİŞLİ ORANI (FGR 2084/2085) HESAPLAYICI


    api = { renderDriveDiagnostics };
    return api;
  }
  global.MTBDriveDiagnosticsFeature = Object.freeze({ initialize });
})(window);
