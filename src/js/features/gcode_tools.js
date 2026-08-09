/**
 * G-Code Tools
 * Extracted from renderer.js for modular architecture.
 * Auto-generated — do not hand-edit without updating renderer.js delegation.
 */
(function MTBGcodeTools(global) {
  'use strict';

// ════════════════════════════════════════════════════════════════
//  G-CODE & MAKRO ÜRETİCİ
// ════════════════════════════════════════════════════════════════
function renderGenerator() {
  const page = createPage('generator');
  page.innerHTML = `
    <div class="page-header">
      <h1>🛠 Akıllı G-Code Makro Üretici</h1>
      <p>Delik delme, cep frezeleme ve cıvata dairesi koordinatlarını otomatik hesaplar ve G-Code üretir</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 320px 1fr; gap: 16px">
        <div class="card" style="display:flex; flex-direction:column; gap:12px">
          <div class="card-title">Operasyon Tipi</div>
          <select id="gen-op-select" onchange="toggleGeneratorFields()" class="form-control" style="width:100%; margin-bottom:10px">
            <option value="bhc">🔩 Cıvata Dairesi Delme (BHC)</option>
            <option value="pocket-circ">⭕ Dairesel Cep Boşaltma</option>
            <option value="pocket-rect">🟩 Dikdörtgen Cep Boşaltma</option>
          </select>

          <div id="gen-fields-container" style="display:flex; flex-direction:column; gap:8px"></div>

          <button class="btn btn-primary w-100 mt-2" onclick="generateGcode()">⚡ G-Code Oluştur</button>
        </div>

        <div class="card" style="display:flex; flex-direction:column; height:100%">
          <div class="flex items-center justify-between mb-2">
            <div class="card-title">Üretilen FANUC G-Kodu</div>
            <button class="btn btn-secondary btn-sm" onclick="copyGcodeToClipboard()">📋 Kopyala</button>
          </div>
          <textarea id="gen-output" readonly style="flex:1; width:100%; height:320px; font-family:monospace; font-size:12px; background:#0f172a; color:#38bdf8; border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px; resize:none"></textarea>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => toggleGeneratorFields(), 50);

  return page;
}

window.toggleGeneratorFields = function() {
  const op = document.getElementById('gen-op-select').value;
  const container = document.getElementById('gen-fields-container');
  if (!container) return;

  if (op === 'bhc') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Daire Merkez X (mm)</label>
        <input class="form-control" id="inp-bhc-x" value="0.0" />
      </div>
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Daire Merkez Y (mm)</label>
        <input class="form-control" id="inp-bhc-y" value="0.0" />
      </div>
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Daire Çapı (PCD - mm)</label>
        <input class="form-control" id="inp-bhc-dia" value="100.0" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Delik Sayısı</label>
          <input class="form-control" id="inp-bhc-num" value="6" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Başlangıç Açısı (°)</label>
          <input class="form-control" id="inp-bhc-ang" value="0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Delik Derinliği Z (mm)</label>
          <input class="form-control" id="inp-bhc-depth" value="-15.0" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Geri Çekilme R (mm)</label>
          <input class="form-control" id="inp-bhc-ret" value="2.0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">İlerleme F (mm/dk)</label>
          <input class="form-control" id="inp-bhc-feed" value="120" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Devir S (RPM)</label>
          <input class="form-control" id="inp-bhc-rpm" value="1200" />
        </div>
      </div>
    `;
  } else if (op === 'pocket-circ') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Takım Çapı (mm)</label>
        <input class="form-control" id="inp-pc-tooldia" value="10.0" />
      </div>
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Cep Çapı (mm)</label>
        <input class="form-control" id="inp-pc-dia" value="50.0" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Toplam Derinlik Z</label>
          <input class="form-control" id="inp-pc-depth" value="-10.0" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Paso Derinliği Q</label>
          <input class="form-control" id="inp-pc-peck" value="2.0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">İlerleme F (mm/dk)</label>
          <input class="form-control" id="inp-pc-feed" value="300" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Devir S (RPM)</label>
          <input class="form-control" id="inp-pc-rpm" value="2000" />
        </div>
      </div>
    `;
  } else if (op === 'pocket-rect') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label" style="font-size:11px">Takım Çapı (mm)</label>
        <input class="form-control" id="inp-pr-tooldia" value="10.0" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Cep Genişlik X (mm)</label>
          <input class="form-control" id="inp-pr-w" value="60.0" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Cep Uzunluk Y (mm)</label>
          <input class="form-control" id="inp-pr-l" value="40.0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Toplam Derinlik Z</label>
          <input class="form-control" id="inp-pr-depth" value="-12.0" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Paso Derinliği Q</label>
          <input class="form-control" id="inp-pr-peck" value="2.0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" style="font-size:11px">İlerleme F (mm/dk)</label>
          <input class="form-control" id="inp-pr-feed" value="350" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:11px">Devir S (RPM)</label>
          <input class="form-control" id="inp-pr-rpm" value="1800" />
        </div>
      </div>
    `;
  }
};

window.generateGcode = function() {
  const op = document.getElementById('gen-op-select').value;
  const output = document.getElementById('gen-output');
  if (!output) return;

  let gcode = "%\\nO9001 (CNC HIZLI PROGRAM URETICI)\\n";
  gcode += "G21 G90 G40 G80 G49 (MILIMETRE - ABSOLUTE SECIM)\\n";

  if (op === 'bhc') {
    const x = parseFloat(document.getElementById('inp-bhc-x').value) || 0;
    const y = parseFloat(document.getElementById('inp-bhc-y').value) || 0;
    const dia = parseFloat(document.getElementById('inp-bhc-dia').value) || 100;
    const num = parseInt(document.getElementById('inp-bhc-num').value) || 6;
    const ang = parseFloat(document.getElementById('inp-bhc-ang').value) || 0;
    const depth = parseFloat(document.getElementById('inp-bhc-depth').value) || -15;
    const ret = parseFloat(document.getElementById('inp-bhc-ret').value) || 2;
    const feed = parseInt(document.getElementById('inp-bhc-feed').value) || 120;
    const rpm = parseInt(document.getElementById('inp-bhc-rpm').value) || 1200;

    gcode += `T01 M06 (MATKAP TAKILIR)\\n`;
    gcode += `S${rpm} M03 (MILLI BASLAT - SAAT YONU)\\n`;
    gcode += `G00 G54 X${x.toFixed(3)} Y${y.toFixed(3)} M08 (MERKEZE GIT - SOGUTUCU ACIK)\\n`;
    gcode += `G43 H01 Z50.0 (TAKIM BOY TELAFISI ACIK)\\n`;
    gcode += `G99 G81 Z${depth.toFixed(3)} R${ret.toFixed(3)} F${feed} (DELIK ÇEVRIMI BAŞLAT)\\n`;

    const rad = dia / 2;
    for (let i = 0; i < num; i++) {
      const angleDeg = ang + (i * (360 / num));
      const angleRad = (angleDeg * Math.PI) / 180;
      const hx = x + rad * Math.cos(angleRad);
      const hy = y + rad * Math.sin(angleRad);
      gcode += `X${hx.toFixed(3)} Y${hy.toFixed(3)} (DELIK ${i+1} ACI: ${angleDeg}°)\\n`;
    }
    gcode += `G80 G00 Z100.0 M09 (CEVRIM IPTAL - SOGUTUCU KAPALI)\\n`;
    gcode += `M30 (PROGRAM SONU VE BASA DON)\\n%`;
  } else if (op === 'pocket-circ') {
    const tooldia = parseFloat(document.getElementById('inp-pc-tooldia').value) || 10;
    const dia = parseFloat(document.getElementById('inp-pc-dia').value) || 50;
    const depth = parseFloat(document.getElementById('inp-pc-depth').value) || -10;
    const peck = parseFloat(document.getElementById('inp-pc-peck').value) || 2;
    const feed = parseInt(document.getElementById('inp-pc-feed').value) || 300;
    const rpm = parseInt(document.getElementById('inp-pc-rpm').value) || 2000;

    const pocketRad = dia / 2;
    const toolRad = tooldia / 2;
    const cutRad = pocketRad - toolRad;

    gcode += `T02 M06 (PARMAK FREZE TAKILIR)\\n`;
    gcode += `S${rpm} M03 (DEVIR ACIK)\\n`;
    gcode += `G00 G54 X0.0 Y0.0 M08 (MERKEZ GOSTEGESI)\\n`;
    gcode += `G43 H02 Z5.0 (BOY TELAFISI ACIK)\\n`;

    let currentZ = 0;
    const targetZ = depth;
    let stepCount = 1;

    while (currentZ > targetZ) {
      currentZ -= peck;
      if (currentZ < targetZ) currentZ = targetZ;
      gcode += `(PASO ${stepCount} - DERINLIK Z: ${currentZ.toFixed(3)})\\n`;
      gcode += `G01 Z${currentZ.toFixed(3)} F${Math.round(feed/2)}\\n`;
      gcode += `G01 X${cutRad.toFixed(3)} F${feed}\\n`;
      gcode += `G03 I-${cutRad.toFixed(3)} (TAM DAIRESAL TUR)\\n`;
      gcode += `G01 X0.0\\n`;
      stepCount++;
    }
    gcode += `G00 Z100.0 M09\\n`;
    gcode += `M30\\n%`;
  } else if (op === 'pocket-rect') {
    const tooldia = parseFloat(document.getElementById('inp-pr-tooldia').value) || 10;
    const w = parseFloat(document.getElementById('inp-pr-w').value) || 60;
    const l = parseFloat(document.getElementById('inp-pr-l').value) || 40;
    const depth = parseFloat(document.getElementById('inp-pr-depth').value) || -12;
    const peck = parseFloat(document.getElementById('inp-pr-peck').value) || 2;
    const feed = parseInt(document.getElementById('inp-pr-feed').value) || 350;
    const rpm = parseInt(document.getElementById('inp-pr-rpm').value) || 1800;

    const toolRad = tooldia / 2;
    const cutW = w - tooldia;
    const cutL = l - tooldia;

    gcode += `T02 M06 (TAKIM DEGISIMI)\\n`;
    gcode += `S${rpm} M03\\n`;
    gcode += `G00 G54 X0.0 Y0.0 M08 (MERKEZ)\\n`;
    gcode += `G43 H02 Z5.0\\n`;

    let currentZ = 0;
    const targetZ = depth;
    let stepCount = 1;

    const halfW = cutW / 2;
    const halfL = cutL / 2;

    while (currentZ > targetZ) {
      currentZ -= peck;
      if (currentZ < targetZ) currentZ = targetZ;
      gcode += `(PASO ${stepCount} - DERINLIK Z: ${currentZ.toFixed(3)})\\n`;
      gcode += `G00 X0.0 Y0.0\\n`;
      gcode += `G01 Z${currentZ.toFixed(3)} F${Math.round(feed/2)}\\n`;
      gcode += `G01 X-${halfW.toFixed(3)} Y-${halfL.toFixed(3)} F${feed}\\n`;
      gcode += `G01 X${halfW.toFixed(3)}\\n`;
      gcode += `G01 Y${halfL.toFixed(3)}\\n`;
      gcode += `G01 X-${halfW.toFixed(3)}\\n`;
      gcode += `G01 Y-${halfL.toFixed(3)}\\n`;
      stepCount++;
    }
    gcode += `G01 X0.0 Y0.0 F${feed}\\n`;
    gcode += `G00 Z100.0 M09\\n`;
    gcode += `M30\\n%`;
  }

  output.value = gcode.replace(/\\n/g, '\n');
};

window.copyGcodeToClipboard = function() {
  const output = document.getElementById('gen-output');
  if (!output || !output.value) return;
  output.select();
  document.execCommand('copy');
  showToast('G-Code panoya kopyalandı!', 'success');
};

// ════════════════════════════════════════════════════════════════
//  G-CODE ÇARPIŞMA & HATA ÖNLEYİCİ
// ════════════════════════════════════════════════════════════════
function renderGcodeChecker() {
  const page = createPage('gcode_checker');
  page.innerHTML = `
    <div class="page-header">
      <h1>📉 G-Code Çarpışma & Hata Tarayıcı</h1>
      <p>CNC programınızı yükleyerek nokta hataları, eksik boy telafisi (G43) ve Z eksi yönlü hızlı hareketleri denetleyin</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 1.1fr 0.9fr; gap:16px">

        <!-- Left: Text Area and controls -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:between">
          <div>
            <div class="card-title mb-2">📥 G-Code Program Girişi</div>
            <p style="font-size:11px; color:var(--text-secondary); margin-bottom:12px">
              Aşağıdaki alana CNC programınızı yapıştırın veya örnek hatalı programı yükleyip "Hataları Tara" butonuna basın.
            </p>
            <textarea class="form-control" id="gcc-input" rows="12" style="font-family:monospace; font-size:11.5px; background:#0f172a; color:#a5f3fc; line-height:1.4">%
O2002 (BUGGY PROGRAM)
G21 G90
T0202 M06 (ALIN VE DIS CAP TORNA)
G00 X100 Z5.0 M03 (<- Hata: X100 ve Z5.0 noktası eksik! Fener mili devirsiz döndü)
G96 S180
G00 Z-15.0 M08 (<- Hata: G00 modunda Z eksiye hızlı hareket!)
G01 X50.0 (<- Hata: G01 modunda ilerleme F tanımlanmamış!)
G00 X150.0 Z100.0 M09
M30
%</textarea>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="btn btn-primary" onclick="runGcodeCheck()">⚡ Hataları Tara</button>
            <button class="btn btn-secondary" onclick="loadDefaultGcodeBug()">Örnek Kodu Yükle</button>
          </div>
        </div>

        <!-- Right: Diagnostic Results -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column">
          <div class="card-title mb-3">🔍 Tarama Sonuçları</div>

          <div id="gcc-summary" style="margin-bottom:14px; display:none">
            <div id="gcc-score-card" class="card" style="padding:10px 14px; display:flex; align-items:center; justify-content:space-between">
              <span style="font-weight:700" id="gcc-status-label">—</span>
              <span class="tag" id="gcc-tag-color">—</span>
            </div>
          </div>

          <div style="flex:1; overflow-y:auto; max-height:280px" id="gcc-logs-container">
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted)" id="gcc-empty">
              <svg style="width:40px; height:40px; stroke:currentColor; fill:none; stroke-width:1.5; margin-bottom:8px" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <p style="font-size:12px">Analizi başlatmak için sol taraftaki butona basın.</p>
            </div>
            <div id="gcc-results-list" style="display:none; flex-direction:column; gap:8px"></div>
          </div>
        </div>

      </div>
    </div>
  `;

  return page;
}

window.loadDefaultGcodeBug = function() {
  const txt = document.getElementById('gcc-input');
  if (txt) {
    txt.value = `%\nO2002 (BUGGY PROGRAM)\nG21 G90\nT0202 M06 (ALIN VE DIS CAP TORNA)\nG00 X100 Z5.0 M03\nG96 S180\nG00 Z-15.0 M08\nG01 X50.0\nG00 X150.0 Z100.0 M09\nM30\n%`;
  }
};

window.runGcodeCheck = function() {
  const code = document.getElementById('gcc-input').value;
  const empty = document.getElementById('gcc-empty');
  const summary = document.getElementById('gcc-summary');
  const resultsList = document.getElementById('gcc-results-list');
  const statusLabel = document.getElementById('gcc-status-label');
  const tagColor = document.getElementById('gcc-tag-color');

  if (!code.trim()) {
    showToast('Taranacak kod içeriği boş olamaz.', 'error');
    return;
  }

  empty.style.display = 'none';
  summary.style.display = 'block';
  resultsList.style.display = 'flex';
  resultsList.innerHTML = '';

  const lines = code.split('\n');
  const errors = [];

  let hasFeedrate = false;
  let hasSpindleSpeed = false;
  let hasG43 = false;
  let inRapidMode = true; // G00 default

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    let clean = line.replace(/\([^)]*\)/g, '').toUpperCase().trim(); // remove comments
    if (!clean) return;

    // Track motion mode
    if (clean.includes('G00')) inRapidMode = true;
    if (clean.includes('G01') || clean.includes('G02') || clean.includes('G03')) inRapidMode = false;

    // Track compensation
    if (clean.includes('G43')) hasG43 = true;
    if (clean.includes('T') && clean.includes('M06')) hasG43 = false; // Reset on tool change

    // Track spindle speed
    if (clean.includes('S')) hasSpindleSpeed = true;
    if (clean.includes('M03') || clean.includes('M04')) {
      if (!hasSpindleSpeed && !clean.includes('S')) {
        errors.push({
          line: lineNum,
          type: 'warning',
          title: 'Devirsiz Mil Dönüşü',
          desc: 'M03/M04 komutu verildi fakat mil devri (S) tanımlanmadı.'
        });
      }
    }

    // Track Feedrate
    if (clean.includes('F')) hasFeedrate = true;
    if (clean.includes('G01') || clean.includes('G02') || clean.includes('G03')) {
      if (!hasFeedrate && !clean.includes('F')) {
        errors.push({
          line: lineNum,
          type: 'danger',
          title: 'Tanımsız İlerleme Hızı (F)',
          desc: 'Kesme hareketi (G01/G02/G03) başlatıldı fakat ilerleme hızı (F) tanımlanmadı.'
        });
      }
    }

    // 1. Check for Decimal Point Errors
    // Regex matches coordinates letters followed by numbers with no dots, like X100, Z-5
    const dotMatches = clean.match(/\b([XYZIJKUWV])(-?\d+)(?!\.)\b/g);
    if (dotMatches) {
      dotMatches.forEach(match => {
        errors.push({
          line: lineNum,
          type: 'danger',
          title: 'Nokta Hatası Algılandı',
          desc: `"${match}" komutunda ondalık nokta eksik! FANUC bunu mikron düzeyinde çok küçük bir hareket olarak yorumlayabilir (Kaza riski).`
        });
      });
    }

    // 2. Check for Z- Rapid Plunge
    if (inRapidMode && clean.includes('Z-')) {
      errors.push({
        line: lineNum,
        type: 'danger',
        title: 'Hızlı Hareketle Z- Dalışı',
        desc: 'Hızlı hareket modunda (G00) parça sıfırının altına (Z-) hareket tespit edildi! Çarpışma riski.'
      });
    }

    // 3. Check for missing G43 after tool change
    if (clean.includes('Z') && !hasG43 && (clean.includes('G00') || clean.includes('G01'))) {
      errors.push({
        line: lineNum,
        type: 'warning',
        title: 'G43 Boy Telafisi Eksik',
        desc: 'Takım değişiminden sonra Z ekseni hareket ettirildi fakat G43 boy kompenzasyonu etkinleştirilmedi.'
      });
    }
  });

  if (!errors.length) {
    statusLabel.innerText = '🟢 Program Güvenli Görünüyor';
    tagColor.innerText = 'Sıfır Hata';
    tagColor.className = 'tag tag-green';
    resultsList.innerHTML = `<div style="text-align:center; padding:24px; color:var(--green)">
      🎉 Tebrikler! Yapılan statik taramada herhangi bir nokta hatası, G43 eksikliği veya Z- dalma riski bulunamadı.
    </div>`;
  } else {
    const dangerCount = errors.filter(e => e.type === 'danger').length;
    statusLabel.innerText = dangerCount > 0 ? '🔴 Kritik Güvenlik Riski!' : '🟡 Potansiyel Risk Uyarıları';
    tagColor.innerText = `${errors.length} Bulgular`;
    tagColor.className = dangerCount > 0 ? 'tag tag-red' : 'tag tag-orange';

    resultsList.innerHTML = errors.map(e => `
      <div style="background:var(--bg-card2); border-left:4px solid var(--${e.type === 'danger' ? 'red' : 'amber'}); padding:8px 12px; border-radius:var(--radius-sm)">
        <div style="display:flex; justify-content:space-between; align-items:center">
          <strong style="font-size:12px; color:var(--text-accent)">${e.title}</strong>
          <span style="font-size:10px; color:var(--text-muted)">Satır: ${e.line}</span>
        </div>
        <div style="font-size:11px; color:var(--text-secondary); margin-top:2px">${e.desc}</div>
      </div>
    `).join('');
  }
};

// ════════════════════════════════════════════════════════════════
//  CNC PARAMETRE KARŞILAŞTIRICI
// ════════════════════════════════════════════════════════════════

})(window);
