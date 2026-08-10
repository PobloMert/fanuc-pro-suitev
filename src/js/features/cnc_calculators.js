/**
 * CNC Calculators
 * Extracted from renderer.js for modular architecture.
 */
(function(global) {
  'use strict';

// ════════════════════════════════════════════════════════════════
//  PARAMETRE AYAR SİHİRBAZI
// ════════════════════════════════════════════════════════════════
function renderTuning() {
  const page = createPage('tuning');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ CNC Parametre Ayar Sihirbazı</h1>
      <p>Kritik ayarlar için adım adım kılavuz ve sanal parametre kontrol paneli</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 280px 1fr; gap: 16px">
        <div class="card" style="display:flex; flex-direction:column; gap:10px">
          <div class="card-title">İşlem Seçin</div>
          <button class="btn btn-secondary text-left w-100" id="btn-tune-1815" onclick="selectTuningWizard(1815)">📍 Absolute Sıfırlama (P1815)</button>
          <button class="btn btn-secondary text-left w-100" id="btn-tune-1851" onclick="selectTuningWizard(1851)">⚙️ Backlash Kompanzasyonu (P1851)</button>
          <button class="btn btn-secondary text-left w-100" id="btn-tune-1320" onclick="selectTuningWizard(1320)">📏 Limit Ayarları (P1320/21)</button>
          <button class="btn btn-secondary text-left w-100" id="btn-tune-2004" onclick="selectTuningWizard(2004)">⚡ Eksen Akım Döngüsü Kazancı (P2004)</button>
        </div>
        <div class="card" id="tuning-wizard-content">
          <div class="empty-state">
            <p>Lütfen soldan gerçekleştirmek istediğiniz parametre sihirbazını seçin.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Select first by default
  setTimeout(() => selectTuningWizard(1815), 50);

  return page;
}

window.selectTuningWizard = function(id) {
  const container = document.getElementById('tuning-wizard-content');
  if (!container) return;

  // Highlight active button
  document.querySelectorAll('[id^="btn-tune-"]').forEach(b => b.classList.remove('btn-primary'));
  const activeBtn = document.getElementById('btn-tune-' + id);
  if (activeBtn) activeBtn.classList.add('btn-primary');

  if (id === 1815) {
    container.innerHTML = `
      <div class="card-title" style="font-size:15px; color:var(--text-accent); margin-bottom:12px">📍 Absolute Eksen Referans Noktası Ayarı (Parametre 1815)</div>
      <p style="font-size:12px; color:var(--text-secondary); line-height:1.6; margin-bottom:14px">
        Tezgahın elektrik kesintilerinde pozisyonunu kaybetmesini engelleyen absolute enkoder sıfır noktası bu sihirbaz ile ayarlanır. Piller bittiğinde veya söküldüğünde sıfırlama zorunludur.
      </p>

      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px">
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 1:</strong> Sıfırlanacak ekseni el çarkı (handle) ile fiziksel referans çizgisine veya komparatör sıfır noktasına getirin.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 2:</strong> Güncel parametre yedeğini ve kontrol serisi/yazılım revizyonunu doğrulayın. Uygulama PWE açma veya yazma adımı sağlamaz.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 3:</strong> <code>1815</code> APC/APZ durumunu salt okunur kaydedin ve eski yedekle karşılaştırın.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 4:</strong> Referans kurma gerekiyorsa makine üreticisinin seri-revizyon prosedürüyle yetkili bakıma eskale edin.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 5:</strong> Yetkili işlem sonrasında Machine Lock, Single Block ve düşük override içeren kontrollü test planını OEM prosedürüne göre uygulayın.</div>
        </div>
      </div>

      <strong style="font-size:11px; text-transform:uppercase; color:var(--text-muted)">Sanal Parametre Ekranı (1815)</strong>
      <table class="data-table" style="font-size:11.5px; margin-top:6px; font-family:monospace">
        <thead>
          <tr>
            <th>Eksen</th>
            <th>Bit 7</th>
            <th>Bit 6</th>
            <th>APC (B5)</th>
            <th>APZ (B4)</th>
            <th>Bit 3</th>
            <th>Bit 2</th>
            <th>Bit 1</th>
            <th>Bit 0</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>X Eksen</td>
            <td>0</td>
            <td>0</td>
            <td><span style="color:var(--green)">1</span></td>
            <td><span style="color:var(--green)">1</span></td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
          </tr>
          <tr>
            <td>Z Eksen</td>
            <td>0</td>
            <td>0</td>
            <td><span style="color:var(--green)">1</span></td>
            <td><span style="color:var(--green)">1</span></td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
          </tr>
        </tbody>
      </table>
    `;
  } else if (id === 1851) {
    container.innerHTML = `
      <div class="card-title" style="font-size:15px; color:var(--text-accent); margin-bottom:12px">⚙️ Backlash (Eksen Boşluk) Kompanzasyonu (Parametre 1851)</div>
      <p style="font-size:12px; color:var(--text-secondary); line-height:1.6; margin-bottom:14px">
        Eksen bilyalı millerindeki aşınmadan kaynaklanan geri dönme boşluğunu gidermek için parametrik kompanzasyon adımları:
      </p>

      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px">
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 1:</strong> Eksen üzerine bir komparatör saat yerleştirin. Ekseni pozitif (+) yönde hareket ettirip saati sıfırlayın.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 2:</strong> MDI modunda ekseni negatif (-) yönde 0.1 mm hareket ettirin (örn: <code>G91 G01 X-0.1 F100</code>).</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 3:</strong> Komparatördeki değeri okuyun. Eğer saat 0.08 mm gösteriyorsa, aradaki 0.02 mm (20 mikron) boşluktur.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 4:</strong> Ölçüm ve mevcut <code>1851</code> değerini raporlayın; değişiklik önerisini seri/revizyon prosedürüyle yetkili bakıma eskale edin.</div>
        </div>
      </div>

      <div class="card" style="background:rgba(245,158,11,0.06); border-color:rgba(245,158,11,0.15)">
        <div style="font-size:11.5px; color:var(--amber)">
          💡 <strong>İpucu:</strong> Eğer dairesel interpolasyonda (daire kesiminde) geçiş izleri kalıyorsa, Parameter <code>1852</code> (Kesme esnasında backlash) değerini de aynı miktarda güncelleyin.
        </div>
      </div>
    `;
  } else if (id === 1320) {
    container.innerHTML = `
      <div class="card-title" style="font-size:15px; color:var(--text-accent); margin-bottom:12px">📏 Yazılımsal Eksen Sınır Limitleri Ayarı (Parametre 1320 & 1321)</div>
      <p style="font-size:12px; color:var(--text-secondary); line-height:1.6; margin-bottom:14px">
        Tezgahın sınır anahtarlarına (limit switch) çarpmadan yazılımsal olarak duracağı sınır değerlerini (Stored Stroke Limit) ayarlar.
      </p>

      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px">
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 1:</strong> Ekseni el çarkı ile fiziksel limit anahtarına yaklaşana kadar (güvenli bir mesafede) jog edin.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 2:</strong> CNC ekranından Makine Koordinat Sistemindeki (MACHINE) değeri okuyun (örn: X ekseni için +450.000).</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 3:</strong> Mevcut <code>1320/1321</code> değerlerini salt okunur karşılaştırın; uygulama limit değeri yazma talimatı vermez.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 4:</strong> Negatif limit sınırları için <code>1321</code> parametresini kullanın. Değeri eksi (-) işaretiyle girin.</div>
        </div>
      </div>
    `;
  } else if (id === 2004) {
    container.innerHTML = `
      <div class="card-title" style="font-size:15px; color:var(--text-accent); margin-bottom:12px">⚡ Eksen Akım Döngüsü Kazanç Ayarı (Parametre 2004)</div>
      <p style="font-size:12px; color:var(--text-secondary); line-height:1.6; margin-bottom:14px">
        Eksen motorlarındaki yüksek frekanslı titremeleri (vibration) ve motordan gelen vınıltı seslerini kesmek için Parametre 2004 ve Parametre 2040/2041 akım kazancı ayarlama adımları:
      </p>

      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px">
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 1:</strong> Titreme veya vınıltı yapan ekseni tespit edin (örn: X ekseni).</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 2:</strong> <code>SYSTEM > PARAM > 2004</code> parametresine gidin (Akım Kazanç Oranı). Nominal fabrika değeri genelde <code>0</code> veya <code>100</code> civarıdır.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 3:</strong> Motordaki ses ve titremeyi azaltmak için bu değeri 10'arlı adımlarla azaltın (örn: 100'den 90'a, ardından gerekirse 80'e düşürün).</div>
        </div>
        <div style="display:flex; gap:12px; align-items:start; padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <input type="checkbox" style="margin-top:3px" />
          <div style="font-size:12px"><strong>Adım 4:</strong> Eğer eksen kalkış ve duruşlarda vuruntu yapıyorsa, <code>Parametre 2040</code> (Current Loop Integral) ve <code>Parametre 2041</code> (Current Loop Proportional) kazançlarını %5-10 azaltarak tork tepkisini yumuşatın.</div>
        </div>
      </div>

      <div class="card" style="background:rgba(239,68,68,0.06); border-color:rgba(239,68,68,0.15)">
        <div style="font-size:11.5px; color:var(--red)">
          ⚠️ <strong>Uyarı:</strong> Akım kazançlarını gereğinden fazla düşürmek eksenin tork kaybetmesine, pozisyonlama hassasiyetinin bozulmasına ve aşırı yüke (overload) girmesine neden olabilir. Ayar sonrası Servo Tuning ekranından akım dalgalanmasını izleyin.
        </div>
      </div>
    `;
  }
};

function renderGearRatio() {
  const page = createPage('gear_ratio');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ Esnek Dişli Oranı (Flexible Gear Ratio) Hesaplayıcı</h1>
      <p>Vidalı mil hatvesi ve enkoder çözünürlüğüne göre FANUC Parameter 2084 ve 2085 değerlerini bulun</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="grid-template-columns: 1fr 1fr; gap:16px">

        <!-- Left: Input Form -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; justify-content:between">
          <div>
            <div class="card-title mb-3">🛠 Mekanik & Enkoder Parametreleri</div>

            <div class="form-group">
              <label class="form-label">Vidalı Mil Hatvesi (Pitch - mm) *</label>
              <input class="form-control" id="fgr-pitch" type="number" value="10" />
            </div>

            <div class="form-group">
              <label class="form-label">Enkoder Çözünürlüğü (Puls / Tur) *</label>
              <select class="form-control" id="fgr-encoder">
                <option value="1000000" selected>1,000,000 (αi Serisi Standart Enkoder)</option>
                <option value="64000">64,000 (Eski Tip Seri Enkoder)</option>
                <option value="10000">10,000 (Artışlı Enkoder)</option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Motor Diş Sayısı *</label>
                <input class="form-control" id="fgr-motor-teeth" type="number" value="1" />
              </div>
              <div class="form-group">
                <label class="form-label">Mil Diş Sayısı (Bilyalı Vida) *</label>
                <input class="form-control" id="fgr-screw-teeth" type="number" value="1" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">İstenen Konumlandırma Hassasiyeti (LCI)</label>
              <select class="form-control" id="fgr-lci">
                <option value="0.001" selected>0.001 mm (1 Mikron)</option>
                <option value="0.0001">0.0001 mm (0.1 Mikron)</option>
              </select>
            </div>
          </div>

          <button class="btn btn-primary w-100" onclick="calculateFlexibleGearRatio()">⚡ Dişli Oranını Hesapla</button>
        </div>

        <!-- Right: Results -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center">
          <div id="fgr-empty" style="color:var(--text-muted)">
            <svg style="width:48px; height:48px; stroke:currentColor; fill:none; stroke-width:1.5; margin-bottom:12px" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <p style="font-size:13px">Gerekli değerleri doldurup "Dişli Oranını Hesapla" butonuna basın.</p>
          </div>

          <div id="fgr-results" style="display:none; width:100%; text-align:left">
            <h2 style="font-size:14px; color:var(--text-accent); text-align:center; margin-bottom:16px">📊 FANUC Parametre Giriş Değerleri</h2>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px">
              <div class="card" style="background:var(--bg-card2); border-color:var(--border); text-align:center; padding:14px">
                <div style="font-size:11px; color:var(--text-muted)">PA. 2084 (Pay - Numerator)</div>
                <div id="fgr-res-2084" style="font-size:28px; font-weight:800; color:var(--green); font-family:monospace; margin-top:6px">—</div>
              </div>
              <div class="card" style="background:var(--bg-card2); border-color:var(--border); text-align:center; padding:14px">
                <div style="font-size:11px; color:var(--text-muted)">PA. 2085 (Payda - Denominator)</div>
                <div id="fgr-res-2085" style="font-size:28px; font-weight:800; color:var(--green); font-family:monospace; margin-top:6px">—</div>
              </div>
            </div>

            <div class="card" style="background:rgba(59,130,246,0.04); border-color:rgba(59,130,246,0.12); padding:10px; font-size:11.5px; line-height:1.5">
              💡 <strong>Hassasiyet Notu:</strong> 1 tur vidalı mil hareketinde eksenin taradığı komut birimi sayısı <span id="fgr-cmd-units" style="font-weight:700">10000</span> LCI birimidir. Formül sonucu sadeleştirilmiş kesir oranı olarak parametrelere aktarılmıştır. Limitler aşılmadığı için sistem tam ölçü kalibrasyonundadır.
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  return page;
}

window.calculateFlexibleGearRatio = function() {
  const pitch = parseFloat(document.getElementById('fgr-pitch').value);
  const encoder = parseInt(document.getElementById('fgr-encoder').value);
  const motorTeeth = parseInt(document.getElementById('fgr-motor-teeth').value);
  const screwTeeth = parseInt(document.getElementById('fgr-screw-teeth').value);
  const lci = parseFloat(document.getElementById('fgr-lci').value);

  const result = window.DiagnosticEngine.calculateGearRatio({ pitch, encoder, motorTeeth, screwTeeth, lci });
  if (!result) {
    showToast('Lütfen geçerli mekanik girdiler girin.', 'error');
    return;
  }
  if (result.approximated) {
    showToast('Dişli oranı limit dışına çıktı, en yakın tamsayı oranı hesaplandı.', 'info');
  }

  document.getElementById('fgr-empty').style.display = 'none';
  const resDiv = document.getElementById('fgr-results');
  resDiv.style.display = 'block';

  document.getElementById('fgr-res-2084').innerText = result.numerator;
  document.getElementById('fgr-res-2085').innerText = result.denominator;
  document.getElementById('fgr-cmd-units').innerText = result.commandUnits;
};

// Reliability view delegated to js/features/operations_insights.js
const renderReliability = (...args) => window.OperationsInsights.renderReliability(...args);

// ════════════════════════════════════════════════════════════════
//  EKSEN BACKLASH (GERİ DÖNME BOŞLUĞU) HESAPLAMA SİHİRBAZI
// ════════════════════════════════════════════════════════════════
function renderBacklashHelper() {
  const page = createPage('backlash_helper');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ Eksen Backlash (Geri Dönme Boşluğu) Sihirbazı</h1>
      <p>Mekanik vidalı mil boşluklarını komparatör saatiyle ölçmek için G-kod üretin ve Parametre 1851 yeni değerlerini hesaplayın</p>
    </div>
    <div class="page-body">
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">

        <!-- Left: Test G-Code Generator -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">🚀 1. Boşluk Test G-Kodu Üretici</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Tezgah eksenini komparatör saatine temas ettirip boşluğu ölçmek için otomatik test programı oluşturun:
          </p>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Test Ekseni</label>
              <select class="form-control" id="bl-axis">
                <option value="X">X Ekseni</option>
                <option value="Y">Y Ekseni</option>
                <option value="Z">Z Ekseni</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Test Mesafesi (mm)</label>
              <input class="form-control" id="bl-dist" type="number" value="10" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Hız (Feedrate F)</label>
              <input class="form-control" id="bl-feed" type="number" value="500" />
            </div>
            <div class="form-group">
              <label class="form-label">Bekleme (Dwell - Saniye)</label>
              <input class="form-control" id="bl-dwell" type="number" value="2" />
            </div>
          </div>

          <button class="btn btn-primary" onclick="generateBacklashGcode()">G-Kod Oluştur</button>

          <div style="position:relative; margin-top:10px">
            <textarea class="form-control font-mono" id="bl-gcode-output" rows="6" readonly style="background:#0f172a; color:var(--green); font-size:11.5px; line-height:1.5" placeholder="G-kod programı burada görüntülenecektir..."></textarea>
            <button class="btn btn-secondary btn-sm" onclick="copyBacklashGcode()" style="position:absolute; right:8px; top:8px; font-size:11px; padding:2px 8px">Kopyala</button>
          </div>
        </div>

        <!-- Right: Calculation & Simulated Parameter Screen -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📊 2. Kompanzasyon & Parametre 1851 Hesaplayıcı</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Geri hareket sonrasında komparatör saati üzerindeki sapma miktarını ve mevcut parametreyi girin:
          </p>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Ölçülen Boşluk / Sapma (mm)</label>
              <input class="form-control" id="bl-measured" type="number" step="0.001" value="0.020" placeholder="ör. 0.020" />
            </div>
            <div class="form-group">
              <label class="form-label">Mevcut P1851 Değeri (Mikron)</label>
              <input class="form-control" id="bl-current-p1851" type="number" value="10" placeholder="ör. 10" />
            </div>
          </div>

          <button class="btn btn-primary" onclick="calculateNewBacklash()">Hesapla & Parametreyi Göster</button>

          <!-- Simulated FANUC Screen -->
          <div id="bl-simulated-screen" style="display:none; background:#000; border:3px solid #333; border-radius:4px; padding:12px; font-family:monospace; color:#00ff00; margin-top:10px">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #00ff00; padding-bottom:4px; font-size:11px; margin-bottom:8px">
              <span>SYSTEM PARAMETER</span>
              <span>No. 1851</span>
            </div>
            <div style="font-size:13px; line-height:1.8">
              <div>PARAMETER (BACKLASH COMP.)</div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="bl-screen-row-x">
                <span>X AXIS</span>
                <span id="bl-val-x" style="font-weight:bold; background:#222; padding:0 8px">10</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="bl-screen-row-y">
                <span>Y AXIS</span>
                <span id="bl-val-y" style="font-weight:bold; background:#222; padding:0 8px">15</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="bl-screen-row-z">
                <span>Z AXIS</span>
                <span id="bl-val-z" style="font-weight:bold; background:#222; padding:0 8px">8</span>
              </div>
            </div>
            <div style="margin-top:10px; font-size:10px; border-top:1px dashed #00ff00; padding-top:6px; color:#aaa" id="bl-calc-summary">
              Hesaplama: 20 mikron sapma + 10 mikron mevcut = 30 mikron yeni değer.
            </div>
          </div>

        </div>

      </div>
    </div>
  `;

  return page;
}

window.generateBacklashGcode = function() {
  const axis = document.getElementById('bl-axis').value;
  const dist = parseFloat(document.getElementById('bl-dist').value) || 10;
  const feed = parseInt(document.getElementById('bl-feed').value) || 500;
  const dwell = parseFloat(document.getElementById('bl-dwell').value) || 2;
  const code = window.DiagnosticEngine.generateBacklashGcode({ axis, distance: dist, feed, dwell });

  document.getElementById('bl-gcode-output').value = code;
  showToast('G-Kod başarıyla üretildi.', 'success');
};

window.copyBacklashGcode = function() {
  const txt = document.getElementById('bl-gcode-output').value;
  if (!txt) {
    showToast('Öncelikle G-Kod üretin.', 'error');
    return;
  }
  navigator.clipboard.writeText(txt);
  showToast('G-Kod panoya kopyalandı!', 'success');
};

window.calculateNewBacklash = function() {
  const axis = document.getElementById('bl-axis').value;
  const measured = parseFloat(document.getElementById('bl-measured').value) || 0;
  const current = parseInt(document.getElementById('bl-current-p1851').value) || 0;

  const { measuredMicrons, newValue } = window.DiagnosticEngine.calculateBacklash(measured, current);

  // Render values to simulated screen
  document.getElementById('bl-val-x').innerText = axis === 'X' ? newValue : '10';
  document.getElementById('bl-val-y').innerText = axis === 'Y' ? newValue : '15';
  document.getElementById('bl-val-z').innerText = axis === 'Z' ? newValue : '8';

  // Apply visual highlight to the calculated row
  document.getElementById('bl-screen-row-x').style.color = axis === 'X' ? '#ffff00' : '#00ff00';
  document.getElementById('bl-screen-row-y').style.color = axis === 'Y' ? '#ffff00' : '#00ff00';
  document.getElementById('bl-screen-row-z').style.color = axis === 'Z' ? '#ffff00' : '#00ff00';

  document.getElementById('bl-calc-summary').innerHTML = `
    <strong>HESAPLAMA DETAYI:</strong><br>
    - Ölçülen Sapma: ${measured.toFixed(3)} mm (${measuredMicrons} Mikron)<br>
    - Mevcut Parametre 1851: ${current} Mikron<br>
    - <strong>İNCELEME İÇİN HESAPLANAN ADAY DEĞER: ${newValue}</strong> (CNC'ye yazılmaz; OEM/FANUC seri-revizyon prosedürüyle doğrulanır).
  `;

  document.getElementById('bl-simulated-screen').style.display = 'block';
  showToast('Parametre hesabı tamamlandı.', 'success');
};


// ════════════════════════════════════════════════════════════════
//  SPINDLE SÜRÜCÜ TEŞHİSİ VE ENKODER KALİBRASYONU
// ════════════════════════════════════════════════════════════════
const SpindleDriveAlarms = [
  {
    code: "SP9002",
    title: "SPINDLE MOTOR OVERSPEED",
    desc: "Motor hızı belirlenen maksimum limiti aştı veya enkoder geri besleme sinyalinde sapma var.",
    causes: ["Enkoder kablosunda elektriksel parazit.", "Parametre 4020 (Spindle Max Hızı) yanlış girilmiş.", "Spindle enkoder okuyucu kafa ayarı bozuk."],
    solutions: ["Enkoder kablosunun ekranlamasını kontrol edin.", "Parametre 4020 ve 4001 nolu motor hız limitlerini kontrol edin.", "Enkoder hava boşluğunu ölçün (0.15mm olmalıdır)."]
  },
  {
    code: "SP9012",
    title: "SPINDLE MOTOR OVERCURRENT",
    desc: "Spindle sürücüsünün (SPM) çıkış devresinde aşırı akım algılandı.",
    causes: ["Motor sargılarında gövdeye kaçak veya kısa devre.", "Sürücü IGBT (güç transistörü) modülünde arıza.", "İş milinde mekanik kilitlenme veya aşırı yük."],
    solutions: ["Megger cihazı ile spindle motoru faz-faz ve faz-gövde sargı direncini ölçün.", "Sürücünün çıkış terminallerini söküp IGBT diyot testini yapın.", "Fener milinin elle rahat dönüp dönmediğini kontrol edin."]
  },
  {
    code: "SP9015",
    title: "SPINDLE FEEDBACK LOSS (ENCODER ALARM)",
    desc: "İş mili geri besleme enkoderinden gelen sinyal kesildi veya genliği düştü.",
    causes: ["Enkoder kablosunun kopması veya soketin çıkması.", "Enkoder okuyucu sensörün pislenmesi, yağlanması.", "Sensör ile dişli çark arasındaki hava boşluğunun açılması."],
    solutions: ["Sürücü kontrol kartı üzerindeki JY2/JY3 soket bağlantılarını sıkın.", "Enkoder sensör kafasını söküp temizleyici solventle temizleyin.", "Sensör boşluğunu (gap) sentil şeridi kullanarak 0.15mm - 0.20mm arasına ayarlayın."]
  },
  {
    code: "SP9056",
    title: "SPINDLE MOTOR SENSOR LOOP LOSS",
    desc: "Sürücü ile motorun dahili sensörü arasındaki dahili haberleşme halkası koptu.",
    causes: ["Dahili sıcaklık sensörü veya hız sensörü kablo temassızlığı.", "Sürücü SPM kontrol kartı arızası."],
    solutions: ["Motor klemens kutusundaki sensör bağlantılarını ve direnç değerlerini ölçün.", "Sürücü kablo konnektörlerini söküp oksitlenme temizliği yapın."]
  }
];

window.CurrentSpindleTab = 'alarms';

function renderSpindleDiagnostics() {
  const page = createPage('spindle_diagnostics');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚡ Spindle Sürücü Teşhisi ve Enkoder Kalibrasyonu</h1>
      <p>İş mili sürücü (SPM) alarmları, fren direnci testleri ve pozisyon kodlayıcı diş oranı ayarları</p>

      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-sp-alarms" onclick="switchSpindleTab('alarms')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          📖 Spindle Alarmları & Sensör Boşluğu
        </button>
        <button class="tab-btn" id="tab-sp-brake" onclick="switchSpindleTab('brake')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          ⚡ Fren Direnci & Deşarj Testi
        </button>
        <button class="tab-btn" id="tab-sp-gear" onclick="switchSpindleTab('gear')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          ⚙️ Pozisyon Kodlayıcı Diş Oranı
        </button>
      </div>
    </div>

    <div class="page-body" id="spindle-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchSpindleTab(window.CurrentSpindleTab, page);
  }, 10);

  return page;
}

window.switchSpindleTab = function(tab, page = document) {
  window.CurrentSpindleTab = tab;

  const alBtn = page.querySelector('#tab-sp-alarms');
  const brBtn = page.querySelector('#tab-sp-brake');
  const geBtn = page.querySelector('#tab-sp-gear');
  if (alBtn && brBtn && geBtn) {
    alBtn.style.color = tab === 'alarms' ? 'var(--text-accent)' : 'var(--text-secondary)';
    alBtn.style.fontWeight = tab === 'alarms' ? 'bold' : 'normal';
    brBtn.style.color = tab === 'brake' ? 'var(--text-accent)' : 'var(--text-secondary)';
    brBtn.style.fontWeight = tab === 'brake' ? 'bold' : 'normal';
    geBtn.style.color = tab === 'gear' ? 'var(--text-accent)' : 'var(--text-secondary)';
    geBtn.style.fontWeight = tab === 'gear' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#spindle-tab-content');
  if (!content) return;

  if (tab === 'alarms') {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">
        <!-- Left: Spindle Alarms lookup -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📖 Spindle Alarm Ansiklopedisi</div>
          <div class="form-group">
            <label class="form-label">Spindle Hata Kodu Seçin</label>
            <select class="form-control" id="spd-alarm-select" onchange="showSpindleAlarmDetail()">
              <option value="">-- Alarm Seçin --</option>
              ${SpindleDriveAlarms.map(a => `<option value="${a.code}">${a.code} - ${a.title}</option>`).join('')}
            </select>
          </div>

          <div id="spd-alarm-detail" style="display:none; background:var(--bg-card2); border:1px solid var(--border); padding:16px; border-radius:var(--radius-sm)">
            <h3 id="spd-det-title" style="color:var(--red); font-size:14px; margin-bottom:8px"></h3>
            <p id="spd-det-desc" style="font-size:12px; color:var(--text-secondary); margin-bottom:12px"></p>

            <div style="margin-bottom:10px">
              <strong style="font-size:12px; color:var(--text-accent)">Olası Nedenler:</strong>
              <ul id="spd-det-causes" style="font-size:11.5px; padding-left:18px; margin-top:4px"></ul>
            </div>
            <div>
              <strong style="font-size:12px; color:var(--green)">Saha Çözüm Adımları:</strong>
              <ol id="spd-det-sols" style="font-size:11.5px; padding-left:18px; margin-top:4px"></ol>
            </div>
          </div>
        </div>

        <!-- Right: Spindle Sensor Gap Calibration -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📐 Manyetik Sensör (Enkoder) Hava Boşluğu Kalibrasyonu</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            İş mili üzerindeki dişli çarkı okuyan manyetik sensörün (pre-amp) hava boşluğu, sinyal genliğini (V p-p) doğrudan etkiler:
          </p>

          <div style="background:#0f172a; padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border); font-size:12px">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px">
              <span>Hedef Hava Boşluğu:</span>
              <strong style="color:var(--text-accent)">0.15 mm - 0.20 mm</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px">
              <span>Sinyal Genliği (Peak-to-Peak):</span>
              <strong style="color:var(--green)">1.0 V p-p (±10%)</strong>
            </div>
            <div style="display:flex; justify-content:space-between">
              <span>Sınır Değer (Minimum):</span>
              <strong style="color:var(--red)">0.6 V p-p (Altı Hata Verir)</strong>
            </div>
          </div>

          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:8px">
            <strong>🔧 Adım Adım Kalibrasyon Prosedürü:</strong>
            <div>1. Sentil şeridi (pirinç/bronz plastik esaslı şerit) kullanarak sensör okuyucu kafası ile dişli çarkın diş tepesi arasındaki boşluğu ölçün.</div>
            <div>2. Sabitleme vidalarını hafifçe gevşetip **0.15mm** sentili araya sıkıştırarak kafayı dişliye yaklaştırın ve vidaları torkunda sıkın.</div>
            <div>3. Mil elle çevrilirken dişlerin sensöre çarpmadığını teyit edin.</div>
            <div>4. Sürücü kontrol kartı üzerindeki **MS** ve **MB** test noktalarından osiloskop yardımıyla sinüs/kosinüs dalga genliğini kontrol edin.</div>
          </div>
        </div>
      </div>
    `;
  } else if (tab === 'brake') {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1.1fr 0.9fr; gap:16px">
        <!-- Left: Brake Resistor multimeter test -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title" style="color:var(--red)">⚡ Fren Direnci & Rejeneratif Deşarj Testi</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            Spindle yavaşlarken aşırı bara voltajı (Overvoltage / DC Link High) hatası veriyorsa frenleme devresini test edin:
          </p>

          <div style="font-size:12px; display:flex; flex-direction:column; gap:8px">
            <strong>🔌 Direnç Ölçüm Adımları (Multimetre):</strong>
            <div>1. Tezgahın ana gücünü kapatın ve DC bara kondansatörlerinin boşalması için en az 10 dakika bekleyin. Sürücü üstündeki kırmızı <strong>CHARGE</strong> lambasının söndüğünü doğrulayın.</div>
            <div>2. Sürücünün altındaki harici frenleme direnci terminallerini (genellikle <strong>R1 ve R2</strong> veya <strong>PR ve CX</strong>) sökün.</div>
            <div>3. Multimetreyi Ohm (Ω) konumuna alın ve bu iki uç arasındaki direnci ölçün. Direnç değeri plaka üzerindeki değerle (genellikle 10 Ω ile 30 Ω arası) aynı olmalıdır. Sonsuz direnç (OL) kablonun veya direncin koptuğunu gösterir.</div>
            <div>4. Direnç uçlarının gövdeye kaçak (şase) yapıp yapmadığını Mega-Ohm seviyesinde kontrol edin (en az 10 MΩ olmalıdır).</div>
          </div>
        </div>

        <!-- Right: IGBT and discharge circuit diagnostics -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">🔌 IGBT & Deşarj Transistörü Kontrolü</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            Direnç sağlamsa, sürücü içerisindeki deşarj transistörü (IGBT) kısa devre veya açık devre olmuş olabilir:
          </p>
          <div style="background:#0f172a; padding:12px; border-radius:4px; font-family:monospace; font-size:11.5px; border:1px solid var(--border); display:flex; flex-direction:column; gap:6px">
            <div style="color:var(--text-accent)">• Transistör Kısa Devre Testi:</div>
            <div>Diyot modunda multimetre problarını <strong>DC+ (P)</strong> ve <strong>R1 (Deşarj)</strong> arasına tutun. Bir yönde diyot geçirgenliği (yaklaşık 0.4V), ters yönde açık devre (OL) görünmelidir. Her iki yönde 0V çıkarsa IGBT yanmıştır.</div>
          </div>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">
        <!-- Left: Gear Ratio Calculator -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">⚙️ Kasnak & Dişli Oranı Hesaplayıcı</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            İş mili (spindle) ile devir/pozisyon bilgisini okuyan sensör kasnağı arasındaki diş sayılarını girin:
          </p>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Spindle (Fener Mili) Diş Sayısı</label>
              <input class="form-control" id="sp-teeth-sp" type="number" value="120" />
            </div>
            <div class="form-group">
              <label class="form-label">Sensör Mili Diş Sayısı</label>
              <input class="form-control" id="sp-teeth-sens" type="number" value="120" />
            </div>
          </div>

          <button class="btn btn-primary" onclick="calculateSpindleGearRatio()">Parametreleri Hesapla</button>

          <!-- Simulated FANUC Screen -->
          <div id="sp-simulated-screen" style="display:none; background:#000; border:3px solid #333; border-radius:4px; padding:12px; font-family:monospace; color:#00ff00; margin-top:10px">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #00ff00; padding-bottom:4px; font-size:11px; margin-bottom:8px">
              <span>SYSTEM PARAMETER</span>
              <span>No. 4002 / 4003</span>
            </div>
            <div style="font-size:13px; line-height:1.8">
              <div>SPINDLE POSITION CODER RATIO</div>
              <div style="display:flex; justify-content:space-between; padding-left:10px">
                <span>P4002 (SPINDLE/MOTOR RATIO NUM.)</span>
                <span id="sp-val-4002" style="font-weight:bold; background:#222; padding:0 8px">1</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-left:10px">
                <span>P4003 (SPINDLE/MOTOR RATIO DENOM.)</span>
                <span id="sp-val-4003" style="font-weight:bold; background:#222; padding:0 8px">1</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Parameters Explanation -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📖 Pozisyon Kodlayıcı Parametre Ayarları</div>
          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:10px; line-height:1.5">
            <div>
              <strong style="color:var(--text-accent)">• Parameter 4001 #4 (GSM):</strong><br>
              Pozisyon kodlayıcı ile iş mili arasındaki bağlantı tipini belirler. Dişli/kasnak bağlantısı varsa <code>1</code>, iş mili ile birebir aynı devirde dönen direkt bağlantı (Direct Drive) varsa <code>0</code> setlenir.
            </div>
            <div>
              <strong style="color:var(--text-accent)">• Parameter 4002 & 4003:</strong><br>
              Dişli veya kayış kasnak oranlarının en sadeleştirilmiş kesir (pay ve payda) karşılıklarıdır. Eğer bu oranlar yanlış setlenirse, kılavuz çekme (tapping) veya spindle oryantasyon (M19) kilitlenmelerinde senkronizasyon kaçar ve takım kırılır.
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

window.calculateSpindleGearRatio = function() {
  const teethSp = parseInt(document.getElementById('sp-teeth-sp').value) || 120;
  const teethSens = parseInt(document.getElementById('sp-teeth-sens').value) || 120;

  // Simple fraction reduction (GCD helper)
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const common = gcd(teethSp, teethSens);

  const num = teethSp / common;
  const denom = teethSens / common;

  document.getElementById('sp-val-4002').innerText = num;
  document.getElementById('sp-val-4003').innerText = denom;

  document.getElementById('sp-simulated-screen').style.display = 'block';
  showToast('Spindle dişli oranı hesaplandı.', 'success');
};

window.showSpindleAlarmDetail = function() {
  const code = document.getElementById('spd-alarm-select').value;
  const detailDiv = document.getElementById('spd-alarm-detail');
  if (!code) {
    detailDiv.style.display = 'none';
    return;
  }

  const alarm = SpindleDriveAlarms.find(a => a.code === code);
  if (!alarm) return;

  document.getElementById('spd-det-title').innerText = `${alarm.code} - ${alarm.title}`;
  document.getElementById('spd-det-desc').innerText = alarm.desc;

  document.getElementById('spd-det-causes').innerHTML = alarm.causes.map(c => `<li>${c}</li>`).join('');
  document.getElementById('spd-det-sols').innerHTML = alarm.solutions.map(s => `<li>${s}</li>`).join('');

  detailDiv.style.display = 'block';
};


// ════════════════════════════════════════════════════════════════
//  EKSEN YUMUŞAK LİMİT (SOFT LIMIT) HESAPLAMA SİHİRBAZI
// ════════════════════════════════════════════════════════════════
window.CurrentLimitTab = 'limits';

function renderAxisLimitsHelper() {
  const page = createPage('axis_limits_helper');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ Eksen Yumuşak Limit & Hareket Kilidi (Interlock)</h1>
      <p>Yumuşak limit parametrelerini hesaplayın veya eksen hareket kilidi (interlock) sinyallerini teşhis edin</p>

      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-lim-calc" onclick="switchLimitTab('limits')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          📐 Stored Stroke Limits (P1320/21)
        </button>
        <button class="tab-btn" id="tab-lim-int" onclick="switchLimitTab('interlock')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🔒 Eksen Kilit Teşhisi (Interlock)
        </button>
      </div>
    </div>

    <div class="page-body" id="limit-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchLimitTab(window.CurrentLimitTab, page);
  }, 10);

  return page;
}

window.switchLimitTab = function(tab, page = document) {
  window.CurrentLimitTab = tab;

  const calcBtn = page.querySelector('#tab-lim-calc');
  const intBtn = page.querySelector('#tab-lim-int');
  if (calcBtn && intBtn) {
    calcBtn.style.color = tab === 'limits' ? 'var(--text-accent)' : 'var(--text-secondary)';
    calcBtn.style.fontWeight = tab === 'limits' ? 'bold' : 'normal';
    intBtn.style.color = tab === 'interlock' ? 'var(--text-accent)' : 'var(--text-secondary)';
    intBtn.style.fontWeight = tab === 'interlock' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#limit-tab-content');
  if (!content) return;

  if (tab === 'limits') {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">
        <!-- Left: Input & Calculation parameters -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📐 Limit Hesaplama Kriterleri</div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Eksen Seçimi</label>
              <select class="form-control" id="axl-axis">
                <option value="X">X Ekseni</option>
                <option value="Y">Y Ekseni</option>
                <option value="Z">Z Ekseni</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Mekanik Stoper Konumu (mm)</label>
              <input class="form-control" id="axl-stop" type="number" value="520" placeholder="ör. 520" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Emniyet Boşluk Payı (mm)</label>
              <input class="form-control" id="axl-margin" type="number" value="10" placeholder="ör. 10" />
            </div>
            <div class="form-group">
              <label class="form-label">Limit Yönü</label>
              <select class="form-control" id="axl-direction">
                <option value="positive">Artı Yön (+) - P1320</option>
                <option value="negative">Eksi Yön (-) - P1321</option>
              </select>
            </div>
          </div>

          <button class="btn btn-primary" onclick="calculateNewLimits()">Yeni Limit Değerini Hesapla</button>

          <!-- Simulated FANUC Screen for Parameters 1320 / 1321 -->
          <div id="axl-simulated-screen" style="display:none; background:#000; border:3px solid #333; border-radius:4px; padding:12px; font-family:monospace; color:#00ff00; margin-top:10px">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #00ff00; padding-bottom:4px; font-size:11px; margin-bottom:8px">
              <span>SYSTEM PARAMETER</span>
              <span id="axl-screen-param-no">No. 1320</span>
            </div>
            <div style="font-size:13px; line-height:1.8">
              <div id="axl-screen-param-name">LIMIT+ (STORED STROKE LIMIT 1)</div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="axl-row-x">
                <span>X AXIS</span>
                <span id="axl-val-x" style="font-weight:bold; background:#222; padding:0 8px">500000</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="axl-row-y">
                <span>Y AXIS</span>
                <span id="axl-val-y" style="font-weight:bold; background:#222; padding:0 8px">450000</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-left:10px" id="axl-row-z">
                <span>Z AXIS</span>
                <span id="axl-val-z" style="font-weight:bold; background:#222; padding:0 8px">600000</span>
              </div>
            </div>
            <div style="margin-top:10px; font-size:10px; border-top:1px dashed #00ff00; padding-top:6px; color:#aaa" id="axl-calc-summary"></div>
          </div>
        </div>

        <!-- Right: Field Guidelines and Explanation -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:14px">
          <div class="card-title">📖 Limit Parametreleri Saha Bilgisi</div>
          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:12px; line-height:1.5">
            <div>
              <strong style="color:var(--text-accent)">• Stored Stroke Limit 1 (P1320 & P1321):</strong><br>
              Tezgahın eksen limitlerini elektriksel olarak sınırlayan parametrelerdir. Buraya yazılan değerler milimetre cinsinden değerin 1000 katıdır (Örn: 510 mm limit için parametreye **510000** yazılır).
            </div>
            <div>
              <strong style="color:var(--text-accent)">• OT0500 / OT0501 Sınır Aşım Alarmları:</strong><br>
              Eksen yumuşak limiti aştığında bu alarmlar tetiklenir. Kurtarmak için MDI modunda limit aşım yönünün tersine el çarkıyla (MPG) jog çekilmeli veya acil stop basılıyken limit parametresi geçici olarak genişletilmelidir.
            </div>
            <div style="padding:10px; background:var(--bg-card2); border-left:3px solid var(--red); border-radius:4px">
              <strong style="color:var(--red)">Önemli Saha Kuralı:</strong><br>
              Limit değeri belirlenirken, mekanik stoper ile yumuşak limit arasında en az **5 ila 10 mm emniyet payı** bırakılmalıdır. Aksi halde, yüksek hızda (Rapid feed G00) eksen durana kadar mekanik takoza çarpar ve vidalı mil/rulman hasarı oluşur.
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px">

        <!-- Left: Axis interlock diagnostics -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title" style="color:var(--text-accent)">🔒 Eksen Kilidi (Interlock) PMC Teşhisi</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            Eksenler jog veya el çarkıyla (MPG) hareket etmiyorsa ve ekranda herhangi bir hata kodu yoksa, PMC ladder programı yazılımsal olarak eksen hareketlerini kilitlemiş olabilir:
          </p>

          <div style="font-size:12px; display:flex; flex-direction:column; gap:8px">
            <strong>🔍 Kontrol Edilmesi Gereken Kritik PMC Sinyalleri:</strong>
            <div style="padding:8px; background:var(--bg-card2); border-radius:4px">
              <strong style="color:var(--text-accent)">• Bütün Eksenler Kilidi (*IT / G8.0):</strong><br>
              Tüm eksenlerin genel hareket kilididir. Bu bitin değeri <strong>1 (High)</strong> olmalıdır. Eğer <code>0</code> ise hiçbir eksen hareket etmez.
            </div>
            <div style="padding:8px; background:var(--bg-card2); border-radius:4px">
              <strong style="color:var(--text-accent)">• Tekil Eksen Kilidi (G130):</strong><br>
              Eksenlerin ayrı ayrı kilitlenmesidir (G130.0 -> X, G130.1 -> Y, G130.2 -> Z). Bu bitlerin değeri <strong>0</strong> olmalıdır. Eğer ilgili bit <code>1</code> ise o eksenin PMC tarafından (kapı switch'i açık, ayna gevşek vb. nedenlerle) kilitlendiğini gösterir.
            </div>
          </div>
        </div>

        <!-- Right: Diagnostics steps -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">🔧 Adım Adım Sinyal İzleme Prosedürü</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            PMC ekranı üzerinden kilit sinyallerinin lojik durumlarını teyit edin:
          </p>

          <div style="font-size:12px; display:flex; flex-direction:column; gap:8px">
            <div>1. CNC panelinden <strong>SYSTEM > PMC > STATUS</strong> menüsüne girin.</div>
            <div>2. Arama çubuğuna <code>G130</code> yazıp SEARCH (veya G-DATA) basın.</div>
            <div>3. Lojik durum ekranında <strong>G130.0, G130.1, G130.2</strong> bitlerinin <code>0</code> olduğunu doğrulayın.</div>
            <div>4. Eğer ilgili eksen biti <code>1</code> ise, PMC ladder ekranından bu bitin gerisindeki sensör ve lojik röleleri (örn: kapı switch X veya ayna switch X) geriye doğru izleyerek hangi kilidin aktif kaldığını tespit edin.</div>
          </div>
        </div>

      </div>
    `;
  }
};

window.calculateNewLimits = function() {
  const axis = document.getElementById('axl-axis').value;
  const stop = parseFloat(document.getElementById('axl-stop').value) || 0;
  const margin = parseFloat(document.getElementById('axl-margin').value) || 0;
  const dir = document.getElementById('axl-direction').value;

  let newValue = 0;
  const absoluteStop = Math.abs(stop);
  if (dir === 'positive') {
    newValue = absoluteStop - margin;
  } else {
    newValue = -absoluteStop + margin;
  }

  // Convert to microns (multiply by 1000 for FANUC)
  const paramVal = Math.round(newValue * 1000);
  const paramNo = dir === 'positive' ? 'No. 1320' : 'No. 1321';
  const paramName = dir === 'positive' ? 'LIMIT+ (STORED STROKE LIMIT 1)' : 'LIMIT- (STORED STROKE LIMIT 1)';

  // Update Simulated Screen
  document.getElementById('axl-screen-param-no').innerText = paramNo;
  document.getElementById('axl-screen-param-name').innerText = paramName;

  document.getElementById('axl-val-x').innerText = axis === 'X' ? paramVal : (dir === 'positive' ? '500000' : '-500000');
  document.getElementById('axl-val-y').innerText = axis === 'Y' ? paramVal : (dir === 'positive' ? '450000' : '-450000');
  document.getElementById('axl-val-z').innerText = axis === 'Z' ? paramVal : (dir === 'positive' ? '600000' : '-600000');

  // Highlight active row
  document.getElementById('axl-row-x').style.color = axis === 'X' ? '#ffff00' : '#00ff00';
  document.getElementById('axl-row-y').style.color = axis === 'Y' ? '#ffff00' : '#00ff00';
  document.getElementById('axl-row-z').style.color = axis === 'Z' ? '#ffff00' : '#00ff00';

  document.getElementById('axl-calc-summary').innerHTML = `
    <strong>HESAPLAMA DETAYI:</strong><br>
    - Mekanik Stoper Sınırı: ${stop} mm<br>
    - Emniyet Boşluk Payı: ${margin} mm<br>
    - Hesaplanan Emniyetli Konum: ${newValue} mm<br>
    - <strong>YENİ GİRİLMESİ GEREKEN DEĞER: ${paramVal}</strong> (Parameter ${dir === 'positive' ? '1320' : '1321'} eksen satırına yazın).
  `;

  document.getElementById('axl-simulated-screen').style.display = 'block';
  showToast('Limit hesabı tamamlandı.', 'success');
};


  const MTBCncCalculators = {
    renderTuning: typeof renderTuning !== 'undefined' ? renderTuning : undefined,
    renderGearRatio: typeof renderGearRatio !== 'undefined' ? renderGearRatio : undefined,
    renderReliability: typeof renderReliability !== 'undefined' ? renderReliability : undefined,
    renderBacklashHelper: typeof renderBacklashHelper !== 'undefined' ? renderBacklashHelper : undefined,
    renderSpindleDiagnostics: typeof renderSpindleDiagnostics !== 'undefined' ? renderSpindleDiagnostics : undefined,
    renderAxisLimitsHelper: typeof renderAxisLimitsHelper !== 'undefined' ? renderAxisLimitsHelper : undefined,
    selectTuningWizard: typeof selectTuningWizard !== 'undefined' ? selectTuningWizard : undefined,
    calculateFlexibleGearRatio: typeof calculateFlexibleGearRatio !== 'undefined' ? calculateFlexibleGearRatio : undefined,
    generateBacklashGcode: typeof generateBacklashGcode !== 'undefined' ? generateBacklashGcode : undefined,
    copyBacklashGcode: typeof copyBacklashGcode !== 'undefined' ? copyBacklashGcode : undefined,
    calculateNewBacklash: typeof calculateNewBacklash !== 'undefined' ? calculateNewBacklash : undefined,
    switchSpindleTab: typeof switchSpindleTab !== 'undefined' ? switchSpindleTab : undefined,
    calculateSpindleGearRatio: typeof calculateSpindleGearRatio !== 'undefined' ? calculateSpindleGearRatio : undefined,
    showSpindleAlarmDetail: typeof showSpindleAlarmDetail !== 'undefined' ? showSpindleAlarmDetail : undefined,
    switchLimitTab: typeof switchLimitTab !== 'undefined' ? switchLimitTab : undefined,
    calculateNewLimits: typeof calculateNewLimits !== 'undefined' ? calculateNewLimits : undefined
  };

  global.MTBCncCalculators = MTBCncCalculators;
  if (typeof renderTuning !== 'undefined') global.renderTuning = renderTuning;
  if (typeof renderGearRatio !== 'undefined') global.renderGearRatio = renderGearRatio;
  if (typeof renderReliability !== 'undefined') global.renderReliability = renderReliability;
  if (typeof renderBacklashHelper !== 'undefined') global.renderBacklashHelper = renderBacklashHelper;
  if (typeof renderSpindleDiagnostics !== 'undefined') global.renderSpindleDiagnostics = renderSpindleDiagnostics;
  if (typeof renderAxisLimitsHelper !== 'undefined') global.renderAxisLimitsHelper = renderAxisLimitsHelper;
  if (typeof selectTuningWizard !== 'undefined') global.selectTuningWizard = selectTuningWizard;
  if (typeof calculateFlexibleGearRatio !== 'undefined') global.calculateFlexibleGearRatio = calculateFlexibleGearRatio;
  if (typeof generateBacklashGcode !== 'undefined') global.generateBacklashGcode = generateBacklashGcode;
  if (typeof copyBacklashGcode !== 'undefined') global.copyBacklashGcode = copyBacklashGcode;
  if (typeof calculateNewBacklash !== 'undefined') global.calculateNewBacklash = calculateNewBacklash;
  if (typeof switchSpindleTab !== 'undefined') global.switchSpindleTab = switchSpindleTab;
  if (typeof calculateSpindleGearRatio !== 'undefined') global.calculateSpindleGearRatio = calculateSpindleGearRatio;
  if (typeof showSpindleAlarmDetail !== 'undefined') global.showSpindleAlarmDetail = showSpindleAlarmDetail;
  if (typeof switchLimitTab !== 'undefined') global.switchLimitTab = switchLimitTab;
  if (typeof calculateNewLimits !== 'undefined') global.calculateNewLimits = calculateNewLimits;
})(window);
