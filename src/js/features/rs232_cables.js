/**
 * RS232 Cables
 * Extracted from renderer.js for modular architecture.
 */
(function(global) {
  'use strict';

// ════════════════════════════════════════════════════════════════
//  RS232 PİN VE LEHİMLEME BAĞLANTI REHBERİ
// ════════════════════════════════════════════════════════════════
const Rs232CableSchematics = {
  software: {
    title: "DB9 (PC Side) - DB25 (CNC Side) Software Handshake (XON/XOFF) Kablo Şeması",
    desc: "Yazılımsal akış kontrolü kullanan standart kablo şeması. Donanımsal RTS/CTS köprüleri konektörlerin kendi içinde yapılmıştır.",
    wiring: [
      { from: "DB9 Pin 2 (RxD)", to: "DB25 Pin 2 (TxD)", color: "var(--text-accent)" },
      { from: "DB9 Pin 3 (TxD)", to: "DB25 Pin 3 (RxD)", color: "var(--text-accent)" },
      { from: "DB9 Pin 5 (GND)", to: "DB25 Pin 7 (SG)", color: "var(--green)" },
      { from: "DB25 Köprü (CNC)", to: "Pin 4 (RTS) - Pin 5 (CTS) Arası Köprü", color: "var(--red)" },
      { from: "DB25 Köprü (CNC)", to: "Pin 6 (DSR) - Pin 8 (CD) - Pin 20 (DTR) Arası Köprü", color: "var(--red)" },
      { from: "DB9 Köprü (PC)", to: "Pin 7 (RTS) - Pin 8 (CTS) Arası Köprü", color: "var(--yellow)" },
      { from: "DB9 Köprü (PC)", to: "Pin 1 (CD) - Pin 4 (DTR) - Pin 6 (DSR) Arası Köprü", color: "var(--yellow)" }
    ]
  },
  hardware: {
    title: "DB9 (PC Side) - DB25 (CNC Side) Full Hardware Handshake (DTR/DSR/RTS/CTS) Şeması",
    desc: "Donanımsal el sıkışma (RTS/CTS) kullanan tam bağlantılı kablo. Akış kontrolü CNC donanımı üzerinden elektriksel olarak kesilir.",
    wiring: [
      { from: "DB9 Pin 2 (RxD)", to: "DB25 Pin 2 (TxD)", color: "var(--text-accent)" },
      { from: "DB9 Pin 3 (TxD)", to: "DB25 Pin 3 (RxD)", color: "var(--text-accent)" },
      { from: "DB9 Pin 5 (GND)", to: "DB25 Pin 7 (SG)", color: "var(--green)" },
      { from: "DB9 Pin 7 (RTS)", to: "DB25 Pin 5 (CTS)", color: "var(--yellow)" },
      { from: "DB9 Pin 8 (CTS)", to: "DB25 Pin 4 (RTS)", color: "var(--yellow)" },
      { from: "DB9 Pin 4 (DTR)", to: "DB25 Pin 6 (DSR) + Pin 8 (CD)", color: "var(--blue)" },
      { from: "DB9 Pin 6 (DSR)", to: "DB25 Pin 20 (DTR)", color: "var(--blue)" }
    ]
  }
};

function renderRs232Cables() {
  const page = createPage('rs232_cables');
  page.innerHTML = `
    <div class="page-header">
      <h1>🔌 RS232 Pin & Lehim Bağlantı Rehberi</h1>
      <p>FANUC CNC üniteleri ile PC arasındaki DNC haberleşme kablosunun lehimleme pin şeması ve süreklilik testleri</p>
    </div>
    <div class="page-body">
      <div class="grid-2" style="grid-template-columns: 1.2fr 0.8fr; gap:16px">

        <!-- Left: Wiring Schematic Details -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">🔌 Kablo Şeması Seçici</div>

          <div class="form-group">
            <label class="form-label">Bağlantı Tipi</label>
            <select class="form-control" id="r2-scheme-select" onchange="showRs232Schematic()">
              <option value="software">XON/XOFF Yazılımsal Akış Kontrolü (Önerilen)</option>
              <option value="hardware">RTS/CTS Donanımsal Akış Kontrolü</option>
            </select>
          </div>

          <div id="r2-scheme-detail" style="margin-top:10px">
            <h3 id="r2-sch-title" style="color:var(--text-accent); font-size:13.5px; font-weight:bold; margin-bottom:4px"></h3>
            <p id="r2-sch-desc" style="font-size:12px; color:var(--text-secondary); margin-bottom:12px"></p>

            <div style="background:#0f172a; padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border)">
              <div style="font-size:12px; font-weight:bold; color:var(--text-primary); margin-bottom:8px">Lehimleme Bağlantı Tablosu:</div>
              <div id="r2-sch-wiring-list" style="font-family:monospace; font-size:11.5px; display:flex; flex-direction:column; gap:6px"></div>
            </div>
          </div>
        </div>

        <!-- Right: Continuity & Shield Ground Tests -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">⚡ Kablo Süreklilik ve Şase Test Kılavuzu</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Kablonuzu lehimledikten sonra CNC'ye bağlamadan önce mutlaka bir multimetre yardımıyla şu testleri gerçekleştirin:
          </p>

          <div style="display:flex; flex-direction:column; gap:10px; font-size:12px">
            <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--green); border-radius:4px">
              <strong style="color:var(--green)">1. Kısa Devre Kontrolü:</strong><br>
              Multimetreyi direnç veya buzzer konumuna alın. Yandaki tabloda yer almayan **hiçbir pin çiftinin** kendi arasında kısa devre yapmadığını doğrulayın. (Özellikle 2 ve 3 numaralı pinler).
            </div>

            <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--text-accent); border-radius:4px">
              <strong>2. Dış Ekranlama (Shield GND) Testi:</strong><br>
              Kablo dışındaki metal örgü (blendaj) korumasını **sadece DB25 (CNC) tarafındaki Pin 1 (Frame Ground)** terminaline lehimleyin. PC tarafındaki DB9 tarafında ekranlama boşta kalmalıdır. Bu kural toprak döngüsü parazitlerini engeller.
            </div>

            <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--red); border-radius:4px">
              <strong style="color:var(--red)">3. SR0086 (DR Signal Off) Hatası Alırsanız:</strong><br>
              CNC tarafındaki DB25 konektöründe 6, 8 ve 20 numaralı pinlerin kendi arasında tam kısa devre (köprü) yapılıp lehimlendiğini teyit edin.
            </div>
          </div>

          <!-- Interactive Continuity Tester -->
          <div style="margin-top:8px; padding:12px; background:#0b0f19; border:1px solid var(--border); border-radius:var(--radius-md);">
            <div style="font-size:12px; font-weight:800; color:var(--text-accent); display:flex; align-items:center; gap:6px; margin-bottom:8px;">
              <span>🎛️</span> İnteraktif Multimetre Buzzer Test Simülatörü
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
              <div>
                <label style="font-size:10.5px; color:var(--text-secondary); display:block; margin-bottom:2px;">PC Tarafı (DB9 Pin):</label>
                <select id="rs-test-db9" class="form-control" style="font-size:11px; padding:3px 6px;" onchange="runRsContinuityTest()">
                  <option value="2">Pin 2 (RxD - Veri Alış)</option>
                  <option value="3">Pin 3 (TxD - Veri Gönderim)</option>
                  <option value="5">Pin 5 (GND - Şase Sinyali)</option>
                  <option value="7">Pin 7 (RTS)</option>
                  <option value="8">Pin 8 (CTS)</option>
                  <option value="1">Pin 1 (CD)</option>
                  <option value="4">Pin 4 (DTR)</option>
                </select>
              </div>
              <div>
                <label style="font-size:10.5px; color:var(--text-secondary); display:block; margin-bottom:2px;">CNC Tarafı (DB25 Pin):</label>
                <select id="rs-test-db25" class="form-control" style="font-size:11px; padding:3px 6px;" onchange="runRsContinuityTest()">
                  <option value="2">Pin 2 (TxD)</option>
                  <option value="3">Pin 3 (RxD)</option>
                  <option value="7">Pin 7 (Signal GND)</option>
                  <option value="4">Pin 4 (RTS)</option>
                  <option value="5">Pin 5 (CTS)</option>
                  <option value="6">Pin 6 (DSR)</option>
                  <option value="8">Pin 8 (CD)</option>
                  <option value="20">Pin 20 (DTR)</option>
                  <option value="1">Pin 1 (Frame Ground / Şase)</option>
                </select>
              </div>
            </div>
            <div id="rs-test-result" style="padding:8px 10px; border-radius:4px; font-size:11.5px; background:var(--bg-card2); border:1px solid var(--border);">
              Seçilen pin kombinasyonunun ölçüm sonucu burada görünür.
            </div>
          </div>

      </div>
    </div>
  `;

  setTimeout(() => {
    showRs232Schematic(page);
    runRsContinuityTest(page);
  }, 10);

  return page;
}

window.runRsContinuityTest = function(page = document) {
  const db9 = String(page.querySelector('#rs-test-db9')?.value || '2');
  const db25 = String(page.querySelector('#rs-test-db25')?.value || '2');
  const resEl = page.querySelector('#rs-test-result');
  if (!resEl) return;

  // Expected connections for software handshake
  const validPairs = [
    { db9: '2', db25: '2', label: 'DB9 Pin 2 (RxD) ➔ DB25 Pin 2 (TxD)', desc: 'Ana Veri Hattı: PC Alış hattı CNC Gönderim hattına bağlı.' },
    { db9: '3', db25: '3', label: 'DB9 Pin 3 (TxD) ➔ DB25 Pin 3 (RxD)', desc: 'Ana Veri Hattı: PC Gönderim hattı CNC Alış hattına bağlı.' },
    { db9: '5', db25: '7', label: 'DB9 Pin 5 (GND) ➔ DB25 Pin 7 (SG)', desc: 'Sinyal Şasesi: Ortak referans topraklama hattı.' }
  ];

  const match = validPairs.find(p => p.db9 === db9 && p.db25 === db25);
  if (match) {
    resEl.innerHTML = `
      <div style="color:#34d399; font-weight:800; display:flex; align-items:center; gap:6px;">
        <span>🔊</span> BUZZER ÖTMELİ (0.1 - 0.5 Ω) — BAĞLANTI DOĞRU
      </div>
      <div style="font-size:11px; color:var(--text-secondary); margin-top:3px;">
        ${match.desc}
      </div>
    `;
    resEl.style.borderColor = 'rgba(52, 211, 153, 0.4)';
    resEl.style.background = 'rgba(52, 211, 153, 0.08)';
  } else {
    resEl.innerHTML = `
      <div style="color:#f87171; font-weight:800; display:flex; align-items:center; gap:6px;">
        <span>🔇</span> BUZZER ÖTMEMELİ (AÇIK DEVRE / ∞ Ω)
      </div>
      <div style="font-size:11px; color:var(--text-secondary); margin-top:3px;">
        DB9 Pin ${db9} ile DB25 Pin ${db25} arasında hiçbir elektriksel temas olmamalıdır. Eğer multimetre ötüyorsa lehimde <strong>kısa devre çapağı</strong> vardır!
      </div>
    `;
    resEl.style.borderColor = 'rgba(248, 113, 113, 0.3)';
    resEl.style.background = 'rgba(248, 113, 113, 0.06)';
  }
};

window.showRs232Schematic = function(page = document) {
  const select = page.querySelector('#r2-scheme-select');
  if (!select) return;

  const key = select.value;
  const sch = Rs232CableSchematics[key];
  if (!sch) return;

  page.querySelector('#r2-sch-title').innerText = sch.title;
  page.querySelector('#r2-sch-desc').innerText = sch.desc;

  const wList = page.querySelector('#r2-sch-wiring-list');
  wList.innerHTML = sch.wiring.map(w => `
    <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #1e293b; padding-bottom:4px">
      <span>${w.from}</span>
      <span style="color:#64748b">────────►</span>
      <span style="color:${w.color}; font-weight:bold">${w.to}</span>
    </div>
  `).join('');
};


  const MTBRs232Cables = {
    renderRs232Cables: typeof renderRs232Cables !== 'undefined' ? renderRs232Cables : undefined,
    showRs232Schematic: typeof showRs232Schematic !== 'undefined' ? showRs232Schematic : undefined,
    runRsContinuityTest: typeof runRsContinuityTest !== 'undefined' ? runRsContinuityTest : undefined
  };

  global.MTBRs232Cables = MTBRs232Cables;
  if (typeof renderRs232Cables !== 'undefined') global.renderRs232Cables = renderRs232Cables;
  if (typeof showRs232Schematic !== 'undefined') global.showRs232Schematic = showRs232Schematic;
  if (typeof runRsContinuityTest !== 'undefined') global.runRsContinuityTest = runRsContinuityTest;
})(window);
