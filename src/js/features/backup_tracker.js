/**
 * Backup Tracker
 * Extracted from renderer.js for modular architecture.
 */
(function(global) {
  'use strict';

// ════════════════════════════════════════════════════════════════
window.BackupWizardState = {
  media: 'cf',  // 'cf', 'usb', 'rs232'
  action: 'backup', // 'backup', 'restore'
  type: 'param'  // 'param', 'pmc', 'program', 'offset'
};

const BackupGuides = {
  cf_backup_param: [
    "MDI modunu kontrol edin: Kontrol paneli üzerindeki mod anahtarını <span class='tag tag-gray'>MDI</span> konumuna getirin.",
    "I/O Kanalını seçin: <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basın, ardından ekran altındaki <strong>[SETTING]</strong> sekmesini seçip <strong>I/O CHANNEL</strong> değerini <strong>4</strong> yapın (4 = CF Card).",
    "EDİT moduna geçin: Mod anahtarını <kbd class='kbd'>EDIT</kbd> (Program Yazma) konumuna getirin.",
    "I/O Ekranına erişin: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, sağ yön tuşu ile <strong>[>]</strong> ilerleyin ve <strong>[ALL IO]</strong> (veya DOSYA/PROGRAM transfer) sekmesini seçin.",
    "Parametre yedeklemeyi başlatın: Ekran altındaki menüden <strong>[PARAM]</strong> -> <strong>[PUNCH]</strong> (Dışarı Aktar) seçin. Dosya adını yazıp (örn: CNCPARAM.PRM) <strong>[O-SET]</strong> (Çıktı Belirle) ve ardından <strong>[EXEC]</strong> (Yürüt) tuşuna basın. Ekranın sağ alt köşesinde yanıp sönen <strong>OUTPUT</strong> ibaresi durana kadar bekleyin."
  ],
  cf_restore_param: [
    "MDI modunu kontrol edin: Kontrol paneli üzerindeki mod anahtarını <span class='tag tag-gray'>MDI</span> konumuna getirin.",
    "I/O Kanalını seçin: <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basın, ardından ekran altındaki <strong>[SETTING]</strong> sekmesini seçip <strong>I/O CHANNEL</strong> değerini <strong>4</strong> yapın (4 = CF Card).",
    "PWE (Parametre Yazma İzni) açın: <kbd class='kbd'>OFFSET/SETTING</kbd> ekranında <strong>PARAMETER WRITE (PWE)</strong> değerini <strong>1</strong> yapın. Tezgah 100 nolu Parameter Write Enable alarmı verecektir (Normaldir).",
    "EDİT moduna geçin: Mod anahtarını <kbd class='kbd'>EDIT</kbd> konumuna getirin ve Acil Stop butonuna basın (Parametre yazmak için acil stop basılı olmalıdır).",
    "Parametreleri yükleyin: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, sağ yön tuşu <strong>[>]</strong> ile ilerleyip <strong>[ALL IO]</strong> sekmesine girin. Ekran altındaki menüden <strong>[PARAM]</strong> -> <strong>[READ]</strong> (Oku) seçin. Yüklenecek dosya numarasını veya adını seçip <strong>[EXEC]</strong> butonuna basın. Yükleme bitince PWE=0 yapın ve tezgahı kapatıp açın."
  ],
  cf_backup_pmc: [
    "MDI modunu kontrol edin: Mod anahtarını <span class='tag tag-gray'>MDI</span> konumuna getirin.",
    "I/O Kanalını kontrol edin: <kbd class='kbd'>OFFSET/SETTING</kbd> ekranında <strong>I/O CHANNEL</strong> değerini <strong>4</strong> yapın.",
    "PMC Ekranına erişin: <kbd class='kbd'>SYSTEM</kbd> tuşuna basın, alt menüden sırasıyla <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> seçin.",
    "Parametreleri çıkartın: <strong>DEVICE</strong> değerini F-CARD, <strong>FUNCTION</strong> değerini WRITE, <strong>DATA KIND</strong> değerini PARAMETER olarak ayarlayın.",
    "Dosya adını belirleyin: FILE NAME kısmına PMC_DATA.LAD yazıp alt menüdeki <strong>[EXEC]</strong> (Yürüt) tuşuna basın. İşlem bitince kartı çıkarabilirsiniz."
  ],
  cf_restore_pmc: [
    "MDI modunu kontrol edin: Mod anahtarını <span class='tag tag-gray'>MDI</span> konumuna getirin ve PWE=1 yapın.",
    "PMC Ekranına erişin: <kbd class='kbd'>SYSTEM</kbd> -> <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> sayfasına girin.",
    "Girdi ayarlarını yapın: <strong>DEVICE</strong> = F-CARD, <strong>FUNCTION</strong> = READ, <strong>DATA KIND</strong> = PARAMETER seçin.",
    "Dosya ismini seçin: F-CARD üzerindeki yedek dosya adını (örn: PMC_DATA.LAD) yazıp <strong>[EXEC]</strong> tuşuna basın. Yükleme bitince PWE=0 yapıp CNC'yi yeniden başlatın."
  ],
  usb_backup_param: [
    "I/O Kanalını seçin: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basıp <strong>I/O CHANNEL</strong> değerini <strong>17</strong> yapın (17 = USB Flash Sürücü).",
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "I/O Ekranına erişin: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, sağ yön tuşu <strong>[>]</strong> ile ilerleyip <strong>[ALL IO]</strong> sekmesine girin.",
    "Parametreleri çıkarın: <strong>[PARAM]</strong> -> <strong>[PUNCH]</strong> seçin. Dosya adını yazıp <strong>[O-SET]</strong> ve ardından <strong>[EXEC]</strong> tuşuna basın."
  ],
  usb_restore_param: [
    "I/O Kanalını seçin: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basıp <strong>I/O CHANNEL</strong> değerini <strong>17</strong> yapın (17 = USB Flash Sürücü).",
    "PWE (Parametre Yazma İzni) açın: <kbd class='kbd'>OFFSET/SETTING</kbd> ekranında <strong>PARAMETER WRITE</strong> değerini <strong>1</strong> yapın. Acil Stop butonuna basın.",
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "Parametreleri yükleyin: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, <strong>[ALL IO]</strong> sekmesine girin. Menüden <strong>[PARAM]</strong> -> <strong>[READ]</strong> seçip <strong>[EXEC]</strong> tuşuna basın. İşlem bitince PWE=0 yapıp tezgahı kapatıp açın."
  ],
  usb_backup_pmc: [
    "I/O Kanalını ayarlayın: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> basıp <strong>I/O CHANNEL</strong> değerini <strong>17</strong> yapın.",
    "PMC I/O Sayfasına girin: <kbd class='kbd'>SYSTEM</kbd> -> <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> seçin.",
    "Ayarlar: <strong>DEVICE</strong> = USB-MEM, <strong>FUNCTION</strong> = WRITE, <strong>DATA KIND</strong> = PARAMETER yapın.",
    "Dosya adını yazıp <strong>[EXEC]</strong> tuşuna basarak aktarımı tamamlayın."
  ],
  usb_restore_pmc: [
    "MDI modunu açın ve PWE=1 yapın. Acil stop basın.",
    "PMC I/O Sayfasına girin: <kbd class='kbd'>SYSTEM</kbd> -> <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> seçin.",
    "Ayarlar: <strong>DEVICE</strong> = USB-MEM, <strong>FUNCTION</strong> = READ, <strong>DATA KIND</strong> = PARAMETER yapın.",
    "Dosya adını seçip <strong>[EXEC]</strong> tuşuna basarak yüklemeyi başlatın. Bitince PWE=0 yapıp CNC'yi kapatıp açın."
  ],
  rs232_backup_param: [
    "I/O Kanalını seçin: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basıp <strong>I/O CHANNEL</strong> değerini <strong>0</strong> veya <strong>1</strong> yapın (0/1 = RS232 Haberleşme Portu).",
    "RS232 Haberleşme programını PC tarafında (örn: DNC Precision) 9600 Baud Rate ile 'Alım' (Receive) konumunda açın.",
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "Parametreleri gönderin: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, <strong>[ALL IO]</strong> sekmesine girin. Menüden <strong>[PARAM]</strong> -> <strong>[PUNCH]</strong> seçip <strong>[EXEC]</strong> tuşuna basarak aktarımı başlatın."
  ],
  rs232_restore_param: [
    "I/O Kanalını seçin: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> tuşuna basıp <strong>I/O CHANNEL</strong> değerini <strong>0</strong> yapın. PWE=1 yapın ve Acil Stop butonuna basın.",
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "Yüklemeyi başlatın: <kbd class='kbd'>SYSTEM</kbd> butonuna basın, <strong>[ALL IO]</strong> sekmesine girin. Menüden <strong>[PARAM]</strong> -> <strong>[READ]</strong> seçip <strong>[EXEC]</strong> tuşuna basın. CNC ekranında INPUT ibaresi yanıp sönecektir.",
    "PC'den programı gönderin: PC tarafındaki haberleşme yazılımından parametre dosyasını gönder (Send) deyin. Aktarım bitince PWE=0 yapıp CNC'yi yeniden başlatın."
  ],
  rs232_backup_pmc: [
    "I/O Kanalını ayarlayın: MDI modunda <kbd class='kbd'>OFFSET/SETTING</kbd> basıp <strong>I/O CHANNEL</strong> değerini <strong>0</strong> yapın.",
    "PC'deki haberleşme programını 9600 Baud rate ile veri alım konumuna getirin.",
    "PMC I/O Sayfasına girin: <kbd class='kbd'>SYSTEM</kbd> -> <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> seçin.",
    "Ayarlar: <strong>DEVICE</strong> = OTHERS, <strong>FUNCTION</strong> = WRITE, <strong>DATA KIND</strong> = PARAMETER yapın.",
    "Alt menüden <strong>[EXEC]</strong> tuşuna basarak PMC parametrelerini seri porttan dışarı aktarın."
  ],
  rs232_restore_pmc: [
    "MDI modunu açın ve PWE=1 yapın. Acil stop basın. I/O Channel = 0 yapın.",
    "PMC I/O Sayfasına girin: <kbd class='kbd'>SYSTEM</kbd> -> <strong>[PMC]</strong> -> <strong>[PMC CONFIG]</strong> -> <strong>[I/O]</strong> seçin.",
    "Ayarlar: <strong>DEVICE</strong> = OTHERS, <strong>FUNCTION</strong> = READ, <strong>DATA KIND</strong> = PARAMETER yapın.",
    "Ekran altından <strong>[EXEC]</strong> tuşuna basın (Ekran INPUT durumuna geçer). PC'den PMC dosyasını gönderin. İşlem bitince PWE=0 yapıp CNC'yi kapatıp açın."
  ]
};

// Fallback guides for programs / offsets (standard methods)
const StandardBackupMethods = {
  program: [
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "<strong>PROGRAM</strong> butonuna basın, ardından ekran altındaki <strong>[DIR]</strong> (Dizin) sekmesine girin.",
    "Yedekleme kanalına göre (CF Card için I/O Channel=4, USB için 17) alt menüden sırasıyla <strong>[F-OUTPUT]</strong> (Dosya Çıkış) seçin.",
    "Gönderilecek program numarasını yazın (Örn: <strong>O1001</strong> veya tüm programlar için <strong>-9999</strong>).",
    "<strong>[O-SET]</strong> sekmesine basın, ardından <strong>[EXEC]</strong> (Yürüt) tuşuna basarak aktarımı tamamlayın."
  ],
  offset: [
    "Mod anahtarını <span class='tag tag-gray'>EDIT</span> konumuna getirin.",
    "<strong>SYSTEM</strong> butonuna basıp sağ yön tuşu <strong>[>]</strong> ile ilerleyin ve <strong>[ALL IO]</strong> sekmesine girin.",
    "Alt menüden sırasıyla <strong>[OFFSET]</strong> -> <strong>[PUNCH]</strong> (Dışarı Aktar) seçin.",
    "Dosya adı girip (örn: OFFSETS.GDF) <strong>[O-SET]</strong> sekmesine basın.",
    "Son olarak <strong>[EXEC]</strong> tuşuna basarak takım aşınma, sıfır ofsetleri ve geometri değerlerini yedekleyin."
  ]
};

window.CurrentBackupTab = 'steps';

function renderBackupWizard() {
  const page = createPage('backup_wizard');
  page.innerHTML = `
    <div class="page-header">
      <h1>📄 FANUC Parametre & Program Yedekleme</h1>
      <p>CNC parametre yedeklerinizi kaydedin veya Boot ROM SRAM yedekleme işlemlerini inceleyin</p>

      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-bk-steps" onclick="switchBackupTab('steps')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          📋 Adım Adım Yedekleme Sihirbazı
        </button>
        <button class="tab-btn" id="tab-bk-boot" onclick="switchBackupTab('boot_rom')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🔋 Boot ROM SRAM & Kart Formatlama
        </button>
      </div>
    </div>

    <div class="page-body" id="backup-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchBackupTab(window.CurrentBackupTab, page);
  }, 10);

  return page;
}

window.switchBackupTab = function(tab, page = document) {
  window.CurrentBackupTab = tab;

  const stepsBtn = page.querySelector('#tab-bk-steps');
  const bootBtn = page.querySelector('#tab-bk-boot');
  if (stepsBtn && bootBtn) {
    stepsBtn.style.color = tab === 'steps' ? 'var(--text-accent)' : 'var(--text-secondary)';
    stepsBtn.style.fontWeight = tab === 'steps' ? 'bold' : 'normal';
    bootBtn.style.color = tab === 'boot_rom' ? 'var(--text-accent)' : 'var(--text-secondary)';
    bootBtn.style.fontWeight = tab === 'boot_rom' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#backup-tab-content');
  if (!content) return;

  if (tab === 'steps') {
    content.innerHTML = `
      <div class="grid-2 mb-4" style="grid-template-columns: 0.9fr 1.1fr; gap:16px">
        <!-- Left: Configuration selectors -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:16px">
          <div class="card-title">⚙️ İşlem Konfigürasyonu</div>

          <!-- 1. Media Select -->
          <div>
            <label class="form-label" style="font-weight:700">1. Yedekleme Ortamı (Media)</label>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:6px">
              <button class="btn btn-ghost" id="wz-media-cf" onclick="setWizardConfig('media', 'cf')" style="border:1px solid var(--border)">💾 CF Card</button>
              <button class="btn btn-ghost" id="wz-media-usb" onclick="setWizardConfig('media', 'usb')" style="border:1px solid var(--border)">🔌 USB Drive</button>
              <button class="btn btn-ghost" id="wz-media-rs232" onclick="setWizardConfig('media', 'rs232')" style="border:1px solid var(--border)">💻 RS232 Port</button>
            </div>
          </div>

          <!-- 2. Action Select -->
          <div>
            <label class="form-label" style="font-weight:700">2. İşlem Tipi (Action)</label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px">
              <button class="btn btn-ghost" id="wz-action-backup" onclick="setWizardConfig('action', 'backup')" style="border:1px solid var(--border)">➡️ CNC -> Medya (Yedek Al)</button>
              <button class="btn btn-ghost" id="wz-action-restore" onclick="setWizardConfig('action', 'restore')" style="border:1px solid var(--border)">⬅️ Medya -> CNC (Yükle)</button>
            </div>
          </div>

          <!-- 3. Data Type Select -->
          <div>
            <label class="form-label" style="font-weight:700">3. Veri Tipi (Data Type)</label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px">
              <button class="btn btn-ghost" id="wz-type-param" onclick="setWizardConfig('type', 'param')" style="border:1px solid var(--border)">Parametre (NC)</button>
              <button class="btn btn-ghost" id="wz-type-pmc" onclick="setWizardConfig('type', 'pmc')" style="border:1px solid var(--border)">PMC (Ladder)</button>
              <button class="btn btn-ghost" id="wz-type-program" onclick="setWizardConfig('type', 'program')" style="border:1px solid var(--border)">Programlar</button>
              <button class="btn btn-ghost" id="wz-type-offset" onclick="setWizardConfig('type', 'offset')" style="border:1px solid var(--border)">Takım Ofsetleri</button>
            </div>
          </div>
        </div>

        <!-- Right: Step-by-step Interactive Guide -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column">
          <div class="card-title mb-2">📋 Adım Adım Uygulama Rehberi</div>
          <p style="font-size:11px; color:var(--text-secondary); margin-bottom:14px">
            Seçtiğiniz donanım konfigürasyonuna göre kontrol ünitesi panelinde basılması gereken tuş kombinasyonları aşağıdadır:
          </p>
          <div id="wz-steps-container" style="display:flex; flex-direction:column; gap:10px; flex:1"></div>
        </div>
      </div>
    `;
    setTimeout(() => {
      updateWizardUI(page);
    }, 10);
  } else {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px; padding:0 20px">

        <!-- Left: Boot ROM SRAM procedures -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title" style="color:var(--text-accent)">🔋 Boot ROM / System Monitor SRAM Yedekleme</div>
          <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5">
            CNC ünitesi açılmadan (anakart seviyesinde) tüm sistemi ve SRAM hafızasını (programlar, parametreler, ofsetler dahil) tek bir dosya halinde yedeklemek için:
          </p>

          <div style="font-size:12px; display:flex; flex-direction:column; gap:8px">
            <strong>🔧 Adım Adım SRAM Yedek Alma Prosedürü:</strong>
            <div>1. CNC ana enerjisini kapatın. Ekranın solundaki PCMCIA yuvasına FAT formatlı CF kartı takın.</div>
            <div>2. Panel üzerindeki en sağdaki iki tuşa (genellikle <strong>. (nokta)</strong> ve <strong>- (eksi)</strong> tuşları veya <code>MDI</code> ekranındaki en sağdaki iki yatay tuş) aynı anda basılı tutarak CNC şalterini açın.</div>
            <div>3. Ekranda sarı harflerle yazılmış <strong>SYSTEM MONITOR</strong> (Boot ekranı) gelene kadar tuşları bırakmayın.</div>
            <div>4. Yön tuşlarıyla <strong>SYSTEM DATA BACKUP</strong> veya <strong>SRAM BACKUP</strong> seçeneğinin üzerine gelin ve SELECT (INPUT) tuşuna basın.</div>
            <div>5. Çıkan menüden <strong>SRAM BACKUP (CNC -> CARD)</strong> seçin. Dosya adı <code>SRAM.FDB</code> olarak otomatik yazılacaktır. YES tuşuna basarak aktarımı başlatın.</div>
          </div>
        </div>

        <!-- Right: CF Card Formatting limits -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">💾 CF Kart Format Sınırları & Hataları</div>
          <p style="font-size:11.5px; color:var(--text-secondary)">
            Eski FANUC Boot Loader yazılımları modern büyük kapasiteli kartları tanıyamaz:
          </p>

          <div style="background:#0f172a; padding:12px; border-radius:4px; font-family:monospace; font-size:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:8px">
            <div>
              <strong style="color:var(--text-accent)">• CF Kart Boyut Limiti:</strong><br>
              Tavsiye edilen kart boyutu <strong>128 MB ila 2 GB</strong> arasıdır. 4 GB ve üzeri SDHC/SDXC kartlar adaptörle takılsa dahi ünitede okunmaz.
            </div>
            <div>
              <strong style="color:var(--text-accent)">• Dosya Sistemi:</strong><br>
              Kart bilgisayara takılıp mutlaka <strong>FAT (FAT16)</strong> olarak formatlanmalıdır. FAT32 veya NTFS kartlar boş ekran veya kart hatası verir.
            </div>
            <div style="color:var(--red)">
              ⚠️ <strong>SRAM Write Protected Hatası:</strong><br>
              Eğer yedek yüklerken bu hatayı alırsanız, PCMCIA adaptörünün veya CF kartın yanındaki minik tırnağın (Lock) kilitli olmadığını doğrulayın.
            </div>
          </div>
        </div>

      </div>
    `;
  }
};


window.setWizardConfig = function(key, value) {
  window.BackupWizardState[key] = value;
  const page = document.getElementById('page-backup_wizard');
  if (page) {
    updateWizardUI(page);
    renderWizardSteps(page);
  }
};

function updateWizardUI(page = document) {
  const state = window.BackupWizardState;

  // Reset all buttons
  const ids = [
    'wz-media-cf', 'wz-media-usb', 'wz-media-rs232',
    'wz-action-backup', 'wz-action-restore',
    'wz-type-param', 'wz-type-pmc', 'wz-type-program', 'wz-type-offset'
  ];
  ids.forEach(id => {
    const el = page.querySelector('#' + id);
    if (el) {
      el.className = 'btn btn-ghost';
      el.style.borderColor = 'var(--border)';
      el.style.color = 'var(--text-secondary)';
    }
  });

  // Highlight active
  const activeIds = [
    'wz-media-' + state.media,
    'wz-action-' + state.action,
    'wz-type-' + state.type
  ];
  activeIds.forEach(id => {
    const el = page.querySelector('#' + id);
    if (el) {
      el.className = 'btn btn-primary';
      el.style.borderColor = 'var(--text-accent)';
      el.style.color = '#fff';
    }
  });
}

function renderWizardSteps(page) {
  const container = page.querySelector('#wz-steps-container');
  const completeCard = page.querySelector('#wz-complete-card');
  if (!container || !completeCard) return;

  completeCard.style.display = 'none';

  const state = window.BackupWizardState;
  let steps = [];

  // Determine steps array
  if (state.type === 'program') {
    steps = StandardBackupMethods.program;
  } else if (state.type === 'offset') {
    steps = StandardBackupMethods.offset;
  } else {
    const key = `${state.media}_${state.action}_${state.type}`;
    steps = BackupGuides[key] || [
      "Lütfen geçerli bir yedekleme medyası, işlem tipi ve veri türü seçin."
    ];
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px">
      ${steps.map((step, idx) => `
        <label class="flex items-start gap-3" style="cursor:pointer; font-size:12.5px; line-height:1.5; color:var(--text-secondary)">
          <input type="checkbox" class="wz-step-checkbox" style="margin-top:3px" onchange="checkWizardStepsCompletion()"/>
          <span><strong>Adım ${idx + 1}:</strong> ${step}</span>
        </label>
      `).join('')}
    </div>
  `;
}

window.checkWizardStepsCompletion = function() {
  const checkboxes = document.querySelectorAll('.wz-step-checkbox');
  const completeCard = document.getElementById('wz-complete-card');
  if (!checkboxes.length || !completeCard) return;

  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  if (allChecked) {
    completeCard.style.display = 'block';
    showToast('Tebrikler! Yedekleme adımlarını tamamladınız.', 'success');
  } else {
    completeCard.style.display = 'none';
  }
};


// ════════════════════════════════════════════════════════════════
//  YEDEK TAKİP DEFTERİ (BACKUP TRACKER)
// ════════════════════════════════════════════════════════════════
function renderBackupTracker(extraData = null) {
  const page = createPage('backup_tracker');
  const contextMachine = State.machines.find(machine => Number(machine.id) === Number(extraData?.machineId));
  if (contextMachine) page.dataset.contextMachineId = String(contextMachine.id);
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>💾 Yedek Takip Defteri (SRAM & Parameter)</h1>
          <p>Tezgah parametreleri ve SRAM yedeklerinin güncellik durumları ve arşiv takibi</p>
        </div>
        ${canEdit() ? `
        <button class="btn btn-primary" onclick="showNewBackupLogModal()">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Yedek Kaydı Ekle
        </button>
        ` : ''}
      </div>
      ${contextMachine ? `<div class="context-filter-chip"><span>${escapeHTML(contextMachine.numarasi)} tezgâhı filtrelendi</span><button type="button" id="backup-clear-machine-context" aria-label="Tezgâh filtresini temizle">×</button></div>` : ''}
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:340px">
          <label class="sr-only" for="bk-search">Yedek kayıtlarında ara</label>
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="bk-search" placeholder="Tezgah no veya açıklama ara..." />
        </div>
        <label class="sr-only" for="bk-status-filter">Yedek durumu filtresi</label><select id="bk-status-filter" style="width:180px">
          <option value="">Tüm Durumlar</option>
          <option value="ok">🟢 Güncel (&lt;= 180 Gün)</option>
          <option value="warn">🔴 Güncel Değil (&gt; 180 Gün)</option>
          <option value="none">❌ Hiç Yedeklenmemiş</option>
        </select>
      </div>
    </div>
    <div class="page-body">

      <!-- Backup Inspector Drag & Drop Card -->
      <div class="card mb-4" style="padding:16px; background:var(--bg-card2)">
        <div class="card-title mb-2" style="display:flex; align-items:center; gap:8px">
          <span>🔍 FANUC SRAM & Ladder Dosya İnceleyici (Backup Inspector)</span>
        </div>
        <div id="backup-inspector-dropzone" style="border: 2px dashed var(--border); border-radius: var(--radius-md); padding: 18px; text-align: center; background: var(--bg-card); cursor: pointer; transition: border-color 0.2s;"
             onclick="document.getElementById('backup-file-inspector-input').click()"
             ondragover="event.preventDefault(); this.style.borderColor='var(--accent)'"
             ondragleave="event.preventDefault(); this.style.borderColor='var(--border)'"
             ondrop="handleBackupFileDrop(event)">
          <div style="font-size: 24px; margin-bottom: 6px">📁</div>
          <div style="font-weight:600; font-size:12.5px">İncelemek istediğiniz .FDB, .DAT, .PMC veya .TXT yedek dosyasını buraya bırakın</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px">FANUC SRAM imajı, Parametre yedeği veya Ladder versiyonunu anında analiz eder</div>
          <input type="file" id="backup-file-inspector-input" style="display:none" onchange="handleBackupFileSelect(event)" accept=".fdb,.dat,.pmc,.lad,.txt,.nc,.mem" />
        </div>
        <div id="backup-inspector-result" style="display:none; margin-top:14px; padding:12px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm)"></div>
      </div>

      <div class="card" style="padding:0; overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tezgah</th>
              <th>Son Yedek Tarihi</th>
              <th>Yedekleyen</th>
              <th>Dosya Konumu / Arşiv</th>
              <th>Durum / Kalan Süre</th>
              <th style="width:200px">İşlemler</th>
            </tr>
          </thead>
          <tbody id="backup-tbody"></tbody>
        </table>
      </div>
    </div>

  `;

  setTimeout(() => {
    filterBackupTracker(page);
    page.querySelector('#bk-search').addEventListener('input', () => filterBackupTracker(page));
    page.querySelector('#bk-status-filter').addEventListener('change', () => filterBackupTracker(page));
    page.querySelector('#backup-clear-machine-context')?.addEventListener('click', event => { delete page.dataset.contextMachineId; event.currentTarget.closest('.context-filter-chip')?.remove(); filterBackupTracker(page); });
  }, 10);

  return page;
}

function filterBackupTracker(page) {
  const tbody = page.querySelector('#backup-tbody');
  if (!tbody) return;

  const q = page.querySelector('#bk-search').value.toLowerCase();
  const statusFilter = page.querySelector('#bk-status-filter').value;
  const contextMachineId = Number(page.dataset.contextMachineId || 0);

  const list = State.machines.map(m => {
    // Find logs for this machine
    const logs = State.backup_logs.filter(l => l.tezgah_id === m.id);
    // Sort logs by date desc to find the latest
    // Date format is DD.MM.YYYY
    const sortedLogs = [...logs].sort((a, b) => {
      return parseDateHelper(b.son_yedek_tarihi) - parseDateHelper(a.son_yedek_tarihi);
    });

    const latest = sortedLogs[0] || null;
    let daysPassed = null;
    let status = 'none'; // 'ok', 'warn', 'none'

    if (latest) {
      const backupDate = parseDateHelper(latest.son_yedek_tarihi);
      if (backupDate && backupDate.getTime() > 0) {
        const diffTime = Math.abs(new Date() - backupDate);
        daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        status = daysPassed <= 180 ? 'ok' : 'warn';
      }
    }

    return {
      machine: m,
      latest,
      daysPassed,
      status
    };
  });

  // Filter based on UI selections
  const filtered = list.filter(item => {
    const matchSearch = !q || item.machine.numarasi.toLowerCase().includes(q) || (item.latest && item.latest.aciklama.toLowerCase().includes(q));
    const matchStatus = !statusFilter || item.status === statusFilter;
    const matchMachine = !contextMachineId || Number(item.machine.id) === contextMachineId;
    return matchSearch && matchStatus && matchMachine;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Yedek takip kaydı bulunadı.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const m = item.machine;
    const l = item.latest;

    let dateStr = '<span style="color:var(--red); font-weight:700">Yedek Yok</span>';
    let techStr = '—';
    let pathStr = '—';
    let statusBadge = '<span class="tag tag-red">🔴 Yedeksiz</span>';

    if (l) {
      dateStr = `<span class="font-mono">${l.son_yedek_tarihi}</span>`;
      techStr = `<strong>${l.yedekleyen}</strong>`;
      pathStr = `<span class="font-mono" style="font-size:11px; color:var(--text-muted)" title="${l.dosya_konumu}">${l.dosya_konumu.length > 28 ? l.dosya_konumu.substring(0,25)+'...' : l.dosya_konumu}</span>`;

      if (item.status === 'ok') {
        const remaining = 180 - item.daysPassed;
        statusBadge = `<span class="tag tag-green">🟢 Güncel (${remaining} Gün Kaldı)</span>`;
      } else {
        const exceeded = item.daysPassed - 180;
        statusBadge = `<span class="tag tag-red">⚠️ Güncel Değil (${exceeded} Gün Geçti)</span>`;
      }
    }

    return `
      <tr>
        <td><strong style="color:var(--text-accent); font-size:13px">${m.numarasi}</strong></td>
        <td>${dateStr}</td>
        <td>${techStr}</td>
        <td>${pathStr}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex; gap:6px">
            ${canEdit() ? `
            <button class="btn btn-ghost btn-sm" onclick="showNewBackupLogModal(${m.id})" style="font-size:11px; padding:2px 8px; border:1px solid var(--border)">
              💾 Yedekle
            </button>
            ` : ''}
            <button class="btn btn-ghost btn-sm" onclick="showBackupHistoryModal(${m.id})" style="font-size:11px; padding:2px 8px; border:1px solid var(--border)">
              📋 Geçmiş
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.showNewBackupLogModal = function(mId = null) {
  showModal('new-backup-log', `
    <div class="modal-header">
      <span class="modal-title">Yeni Yedek Kaydı Ekle</span>
      <button class="modal-close" onclick="closeModal('new-backup-log')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Tezgah *</label>
      <select class="form-control" id="nm-bk-mach">
        ${getSortedMachines().map(m => `<option value="${m.id}" ${mId && m.id === mId ? 'selected' : ''}>${escapeHTML(m.numarasi)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Tarih (GG.AA.YYYY) *</label>
        <input class="form-control" id="nm-bk-date" value="${getTodayFormat()}" />
      </div>
      <div class="form-group">
        <label class="form-label">Yedekleyen Teknisyen *</label>
        <input class="form-control" id="nm-bk-tech" placeholder="ör. AHMET MERT ÖZER" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Yedek Dosya Konumu / Sunucu Arşiv Yolu *</label>
      <input class="form-control" id="nm-bk-path" placeholder="ör. DNC-SERVER/BACKUPS/CNF37_SRAM_2026.FDB" />
    </div>
    <div class="form-group">
      <label class="form-label">Açıklama / Revizyon Notları</label>
      <textarea class="form-control" id="nm-bk-desc" rows="3" placeholder="Yedekleme içeriği hakkında bilgi girin (örn. Yıllık rutin yedek)"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-backup-log')">İptal</button>
      <button class="btn btn-primary" onclick="createNewBackupLog()">Yedek Kaydını Oluştur</button>
    </div>
  `);
};

window.createNewBackupLog = async function() {
  if (!canEdit()) { showToast('Yedek kaydı ekleme yetkiniz yok', 'error'); return; }
  const tezgah_id = parseInt(document.getElementById('nm-bk-mach').value);
  const son_yedek_tarihi = document.getElementById('nm-bk-date').value.trim();
  const yedekleyen = document.getElementById('nm-bk-tech').value.trim();
  const dosya_konumu = document.getElementById('nm-bk-path').value.trim();
  const aciklama = document.getElementById('nm-bk-desc').value.trim();

  if (!son_yedek_tarihi || !yedekleyen || !dosya_konumu) {
    showToast('Tarih, yedekleyen ve dosya konumu girmek zorunludur.', 'error');
    return;
  }

  const id = State.backup_logs.length ? Math.max(...State.backup_logs.map(l => l.id)) + 1 : 1;
  const newLog = {
    id,
    tezgah_id,
    son_yedek_tarihi,
    yedekleyen: yedekleyen.toUpperCase(),
    dosya_konumu,
    aciklama
  };

  State.backup_logs.push(newLog);
  await saveBackupLogs();
  closeModal('new-backup-log');
  showToast('Yedek kaydı başarıyla deftere eklendi!', 'success');
  navigate('backup_tracker');
};

window.showBackupHistoryModal = function(mId) {
  const m = State.machines.find(x => x.id === mId);
  if (!m) return;

  const logs = State.backup_logs.filter(l => l.tezgah_id === mId).sort((a,b) => b.id - a.id);

  showModal('backup-history', `
    <div class="modal-header">
      <span class="modal-title">Yedekleme Geçmişi: ${m.numarasi}</span>
      <button class="modal-close" onclick="closeModal('backup-history')">✕</button>
    </div>
    <div style="max-height:300px; overflow-y:auto; padding:10px 0">
      ${logs.length ? logs.map(l => `
        <div class="card mb-3" style="padding:12px">
          <div class="flex justify-between items-center mb-1">
            <span class="font-mono" style="font-weight:700; color:var(--text-accent)">${l.son_yedek_tarihi}</span>
            <span style="font-size:11px; color:var(--text-muted)">Yapan: ${l.yedekleyen}</span>
          </div>
          <div style="font-size:11.5px; font-family:monospace; color:var(--text-secondary); background:var(--bg-card2); padding:6px; border-radius:4px; border:1px solid var(--border); word-break:break-all" class="mb-2">${l.dosya_konumu}</div>
          <p style="font-size:12px; color:var(--text-secondary); margin:0">${l.aciklama || 'Açıklama belirtilmemiş.'}</p>
        </div>
      `).join('') : '<div style="text-align:center; color:var(--text-muted); padding:20px">Bu tezgaha ait yedek kaydı bulunamadı</div>'}
    </div>
  `);
};

window.handleBackupFileDrop = function(e) {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files.length) {
    runBackupInspectorOnFile(e.dataTransfer.files[0]);
  }
};

window.handleBackupFileSelect = function(e) {
  if (e.target && e.target.files.length) {
    runBackupInspectorOnFile(e.target.files[0]);
  }
};

function runBackupInspectorOnFile(file) {
  const reader = new FileReader();
  reader.onload = function(evt) {
    const content = evt.target.result;
    const res = window.inspectBackupFile ? window.inspectBackupFile(content, file.name) : null;
    const resEl = document.getElementById('backup-inspector-result');
    if (!resEl || !res) return;

    resEl.style.display = 'block';
    resEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
        <strong style="color:var(--text-accent); font-size:13px">📋 Dosya Analizi: ${escapeHTML(res.fileName)}</strong>
        <span class="tag ${res.isValid ? 'tag-green' : 'tag-amber'}">${escapeHTML(res.category)}</span>
      </div>
      <div style="font-size:12px; margin-bottom:6px; color:var(--text-primary)">
        <strong>Tür:</strong> ${escapeHTML(res.type)} · <strong>Boyut:</strong> ${res.estimatedSize}
      </div>
      <div style="font-size:11.5px; color:var(--text-secondary); margin-bottom:8px">
        <strong>Uyumlu Sistem:</strong> ${escapeHTML(res.controlSeries)}
      </div>
      <div style="font-size:11px; color:var(--text-muted)">
        ${res.details.map(d => `• ${escapeHTML(d)}`).join('<br>')}
      </div>
    `;
    showToast(`Yedek dosyası analiz edildi: ${file.name}`, 'success');
  };
  reader.readAsText(file);
}




  const MTBBackupTracker = {
    renderBackupWizard: typeof renderBackupWizard !== 'undefined' ? renderBackupWizard : undefined,
    renderBackupTracker: typeof renderBackupTracker !== 'undefined' ? renderBackupTracker : undefined,
    filterBackupTracker: typeof filterBackupTracker !== 'undefined' ? filterBackupTracker : undefined,
    runBackupInspectorOnFile: typeof runBackupInspectorOnFile !== 'undefined' ? runBackupInspectorOnFile : undefined,
    switchBackupTab: typeof switchBackupTab !== 'undefined' ? switchBackupTab : undefined,
    setWizardConfig: typeof setWizardConfig !== 'undefined' ? setWizardConfig : undefined,
    checkWizardStepsCompletion: typeof checkWizardStepsCompletion !== 'undefined' ? checkWizardStepsCompletion : undefined,
    showNewBackupLogModal: typeof showNewBackupLogModal !== 'undefined' ? showNewBackupLogModal : undefined,
    createNewBackupLog: typeof createNewBackupLog !== 'undefined' ? createNewBackupLog : undefined,
    showBackupHistoryModal: typeof showBackupHistoryModal !== 'undefined' ? showBackupHistoryModal : undefined,
    handleBackupFileDrop: typeof handleBackupFileDrop !== 'undefined' ? handleBackupFileDrop : undefined,
    handleBackupFileSelect: typeof handleBackupFileSelect !== 'undefined' ? handleBackupFileSelect : undefined
  };

  global.MTBBackupTracker = MTBBackupTracker;
  if (typeof renderBackupWizard !== 'undefined') global.renderBackupWizard = renderBackupWizard;
  if (typeof renderBackupTracker !== 'undefined') global.renderBackupTracker = renderBackupTracker;
  if (typeof filterBackupTracker !== 'undefined') global.filterBackupTracker = filterBackupTracker;
  if (typeof runBackupInspectorOnFile !== 'undefined') global.runBackupInspectorOnFile = runBackupInspectorOnFile;
  if (typeof switchBackupTab !== 'undefined') global.switchBackupTab = switchBackupTab;
  if (typeof setWizardConfig !== 'undefined') global.setWizardConfig = setWizardConfig;
  if (typeof checkWizardStepsCompletion !== 'undefined') global.checkWizardStepsCompletion = checkWizardStepsCompletion;
  if (typeof showNewBackupLogModal !== 'undefined') global.showNewBackupLogModal = showNewBackupLogModal;
  if (typeof createNewBackupLog !== 'undefined') global.createNewBackupLog = createNewBackupLog;
  if (typeof showBackupHistoryModal !== 'undefined') global.showBackupHistoryModal = showBackupHistoryModal;
  if (typeof handleBackupFileDrop !== 'undefined') global.handleBackupFileDrop = handleBackupFileDrop;
  if (typeof handleBackupFileSelect !== 'undefined') global.handleBackupFileSelect = handleBackupFileSelect;
})(window);
