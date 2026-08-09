/**
 * RS232 Cables
 * Extracted from renderer.js for modular architecture.
 * Auto-generated — do not hand-edit without updating renderer.js delegation.
 */
(function MTBRs232Cables(global) {
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
        </div>

      </div>
    </div>
  `;

  setTimeout(() => showRs232Schematic(page), 10);

  return page;
}

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


})(window);
