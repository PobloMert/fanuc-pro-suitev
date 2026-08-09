(() => {
  'use strict';

  const scenarios = [
    { id: 'reference', icon: '⌖', title: 'Eksen referansa gitmiyor', category: 'Servo', severity: 'warning',
      checks: ['Alarm ve eksen adını kaydedin; resetlemeden önce olay bilgisini koruyun.', 'Acil stop, overtravel ve eksen inhibit durumlarını salt-okunur sinyallerden kontrol edin.', 'Referans anahtarı ve deceleration sinyalinin geçişini PMC izleme ekranında doğrulayın.', 'Pulse coder pil ve absolute position alarm geçmişini inceleyin.', 'Mekanik sıkışma şüphesinde enerjiyi kesin, LOTO uygulayın ve ekseni üretici prosedürüne göre kontrol edin.'] },
    { id: 'servo-ready', icon: 'S', title: 'Servo Ready gelmiyor', category: 'Servo', severity: 'danger',
      checks: ['PSM ve servo amplifikatör LED kodlarını enerji varken yalnızca gözlemleyin.', 'Acil stop zinciri ve MCC geri besleme durumunu elektrik şemasından doğrulayın.', 'FSSB topolojisinde son haberleşen düğümü belirleyin.', '24 VDC kontrol beslemesi ve faz durumunu yetkili personelce ölçün.', 'LED kodunu doğru modül serisinin bakım kılavuzuyla doğrulayın.'] },
    { id: 'spindle', icon: 'M', title: 'Spindle dönmüyor', category: 'Spindle', severity: 'warning',
      checks: ['Aktif SP/SV/SYS alarmlarını ve komut edilen devri kaydedin.', 'Kapı, ayna, yağlama ve orientation interlock sinyallerini gözlemleyin.', 'SPM 7-segment göstergesini ve READY durumunu kaydedin.', 'Komut devri ile gerçek devri karşılaştırın; uygulamadan CNC’ye komut göndermeyin.', 'Güç devresi ölçümü gerekiyorsa enerjiyi kesin ve DC bara boşalma süresine uyun.'] },
    { id: 'tool-change', icon: 'T', title: 'Takım değiştirme tamamlanmıyor', category: 'PMC', severity: 'warning',
      checks: ['ATC adımını ve beklenen geri beslemeyi belirleyin.', 'Pot, kol, clamp/unclamp ve orientation sinyallerini zaman sırasıyla izleyin.', 'Eksik kalan ilk geri besleme sinyalini tespit edin.', 'Sensör beslemesini ve mekanik konumu LOTO sonrasında kontrol edin.', 'PMC bitini zorlamayın; üretici ladder açıklamasıyla çapraz doğrulayın.'] },
    { id: 'fssb', icon: '光', title: 'FSSB haberleşme hatası', category: 'FSSB', severity: 'danger',
      checks: ['Tüm amplifikatör LED göstergelerini sırayla fotoğraflayın.', 'CNC’den başlayarak son normal ve ilk anormal düğümü belirleyin.', 'COP10A/COP10B yönlerini ve fiber bükülme/ezilme durumunu enerjisiz kontrol edin.', 'Konnektörleri kuru ve uygun optik temizleme yöntemiyle temizleyin.', 'Modül değişiminden önce eksen sırası ve parametre yedeğini doğrulayın.'] },
    { id: 'battery', icon: '▰', title: 'Absolute pulse coder pil alarmı', category: 'Pil', severity: 'info',
      checks: ['Alarm kodunu, etkilenen ekseni ve mevcut absolute position durumunu kaydedin.', 'Doğru pil modelini ve üretici değişim prosedürünü doğrulayın.', 'Gerekli ise CNC enerjisi açıkken pil değişim prosedürünü yalnız yetkili personel uygulasın.', 'Konnektör polaritesini ve kablo hasarını kontrol edin.', 'Değişim tarihini Pil Takibi ekranına kaydedin; referans kaybı varsa yeniden referans prosedürünü uygulayın.'] }
  ];

  const ledGuide = [
    { code: '—', module: 'Genel', state: 'Gösterge kapalı', level: 'danger', checks: 'Kontrol beslemesi, sigorta, faz ve modül konnektörlerini kontrol edin.' },
    { code: '0', module: 'Servo', state: 'Hazır/bekleme durumu olabilir', level: 'ok', checks: 'Seriye göre anlam değişir; READY ve CNC alarm durumuyla birlikte doğrulayın.' },
    { code: '1', module: 'Servo', state: 'Başlatma sırası', level: 'info', checks: 'Kod kalıcıysa acil stop zinciri ve FSSB haberleşmesini inceleyin.' },
    { code: '2', module: 'PSM', state: 'Güç hazırlık durumu', level: 'info', checks: 'MCC, DC link ve faz geri beslemelerini ilgili PSM kılavuzuyla doğrulayın.' },
    { code: '8', module: 'Spindle', state: 'Çalışma/hazır geçişi olabilir', level: 'ok', checks: 'Komut/gerçek devir ve spindle alarm geçmişiyle birlikte değerlendirin.' },
    { code: 'L', module: 'FSSB', state: 'Optik bağlantı yönü uyarısı', level: 'danger', checks: 'Son normal ve ilk L/U gösteren modül arasındaki fiber hattı kontrol edin.' },
    { code: 'U', module: 'FSSB', state: 'Upstream/downstream bağlantı uyarısı', level: 'danger', checks: 'COP10A/COP10B yönü, fiber temizlik ve minimum büküm yarıçapını kontrol edin.' },
    { code: 'A', module: 'Servo', state: 'Alarm/başlatma göstergesi', level: 'warning', checks: 'Yanındaki sayısal kodu tam olarak kaydedip modül serisi kılavuzunda arayın.' },
    { code: 'F', module: 'PSM/Servo', state: 'Güç veya haberleşme hatası olabilir', level: 'danger', checks: 'Kesin anlam model bağımlıdır; faz, DC bara ve FSSB kontrollerini güvenli prosedürle yapın.' },
    { code: 'H', module: 'Spindle', state: 'Sıcaklık/koruma durumu olabilir', level: 'warning', checks: 'Kabin fanları, filtreler ve sıcaklık teşhis değerlerini kontrol edin.' }
  ];

  const tabs = [
    ['overview', 'Tezgâh Merkezi'], ['scenarios', 'Teşhis Senaryoları'], ['parameters', 'Parametre Yönetimi'],
    ['backups', 'Yedekleme Merkezi'], ['led', 'LED & Alarm Rehberi']
  ];
  window.FanucCenterCatalog = Object.freeze({ scenarios, ledGuide });

  let activeTab = 'overview';
  let selectedScenario = scenarios[0].id;
  let ledQuery = '';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);
  const state = () => window.FanucCenterBridge?.getState?.() || window.State || {};
  const canEdit = () => window.FanucCenterBridge?.canEdit?.() === true;
  const denyEdit = () => window.MTBUX?.notify({
    type: 'warning',
    title: 'Düzenleme yetkisi gerekli',
    message: 'FANUC profilini ve modül envanterini değiştirmek için düzenleme yetkisine sahip bir kullanıcıyla giriş yapın.'
  });
  const selectedMachine = () => {
    const machines = [...(state().machines || [])].sort((a, b) => {
      const nameA = String(a.numarasi || a.name || '');
      const nameB = String(b.numarasi || b.name || '');
      return nameA.localeCompare(nameB, 'tr', { numeric: true, sensitivity: 'base' });
    });
    const stored = Number(window.ActiveFanucMachineId);
    return machines.find(item => item.id === stored) || machines[0] || null;
  };

  function machineRecords(machine) {
    const app = state();
    if (!machine) return { maint: [], batteries: [], fans: [], backups: [] };
    const match = item => Number(item.tezgah_id ?? item.machine_id) === Number(machine.id) || item.machine === machine.numarasi || item.machine_name === machine.numarasi;
    return {
      maint: (app.maintenances || []).filter(match), batteries: (app.batteries || []).filter(match),
      fans: (app.fans || []).filter(match), backups: (app.backup_logs || []).filter(match)
    };
  }

  function renderOverview(machine) {
    if (!machine) return window.MTBUX?.emptyState({ icon:'⚙', title:'FANUC tezgâhı seçilemedi', description:'FANUC Merkezi için önce Tezgâh Listesi ekranından bir tezgâh oluşturun.', actionLabel:'Tezgâh listesine git', command:'new-machine' }) || '';
    const profile = machine.fanucProfile || {};
    const records = machineRecords(machine);
    const lastMaint = [...records.maint].sort((a,b) => Number(b.id)-Number(a.id))[0];
    const lastBackup = [...records.backups].sort((a,b) => String(b.tarih || b.date || '').localeCompare(String(a.tarih || a.date || '')))[0];
    const profileFields = [
      ['series', 'kontrol serisi'], ['software', 'yazılım sürümü'], ['serial', 'seri numarası'],
      ['axes', 'eksen sayısı'], ['spindles', 'spindle sayısı'], ['modules', 'modül bilgisi']
    ];
    const missingProfileFields = profileFields.filter(([key]) => !profile[key]).map(([, label]) => label);
    return `
      <section class="fanuc-hero">
        <div><span class="fanuc-eyebrow">SALT OKUNUR TEKNİK PROFİL</span><h2>${esc(machine.numarasi || machine.name)}</h2><p>${esc(machine.bolum || 'Bölüm belirtilmemiş')} · ${esc(machine.tip || 'Tezgâh tipi belirtilmemiş')}</p></div>
        <div class="fanuc-profile-status"><strong>${missingProfileFields.length ? `${missingProfileFields.length} profil alanı eksik` : 'Profil bilgileri tamam'}</strong><span>${esc(missingProfileFields.length ? missingProfileFields.join(', ') : 'Kontrol ve donanım kimliği kayıtlı')}</span></div>
      </section>
      <div class="fanuc-kpi-grid">
        <article><span>Kontrol</span><strong>${esc(profile.series || 'Belirtilmedi')}</strong><small>${esc(profile.software || 'Yazılım sürümü yok')}</small></article>
        <article><span>Eksen / Spindle</span><strong>${esc(profile.axes || '—')} / ${esc(profile.spindles || '—')}</strong><small>Yapılandırılmış kanal bilgisi</small></article>
        <article><span>Son bakım</span><strong>${esc(lastMaint?.tarih || lastMaint?.date || 'Kayıt yok')}</strong><small>${esc(lastMaint?.bakim_yapan || lastMaint?.technician || '—')}</small></article>
        <article><span>Son yedek</span><strong>${esc(lastBackup?.tarih || lastBackup?.date || 'Kayıt yok')}</strong><small>${records.backups.length} takip kaydı</small></article>
      </div>
      <div class="fanuc-layout-two">
        <article class="fanuc-panel"><div class="fanuc-panel-head"><div><span>DONANIM KİMLİĞİ</span><h3>FANUC teknik profil</h3></div>${canEdit() ? '<button class="btn btn-primary btn-sm" data-fanuc-action="edit-profile">Profili düzenle</button>' : '<span class="readonly-chip">Salt okunur</span>'}</div>
          <dl class="fanuc-spec-list"><div><dt>Seri numarası</dt><dd>${esc(profile.serial || '—')}</dd></div><div><dt>Kontrol serisi</dt><dd>${esc(profile.series || '—')}</dd></div><div><dt>CNC yazılımı</dt><dd>${esc(profile.software || '—')}</dd></div><div><dt>Modüller</dt><dd>${esc(profile.modules || '—')}</dd></div><div><dt>FSSB / I/O notu</dt><dd>${esc(profile.topology || '—')}</dd></div></dl>
        </article>
        <article class="fanuc-panel"><div class="fanuc-panel-head"><div><span>KAYIT ÖZETİ</span><h3>Tezgâha bağlı bilgiler</h3></div></div>
          <div class="fanuc-record-grid"><button data-fanuc-nav="maintenance"><strong>${records.maint.length}</strong><span>Bakım</span></button><button data-fanuc-nav="battery"><strong>${records.batteries.length}</strong><span>Pil</span></button><button data-fanuc-nav="battery"><strong>${records.fans.length}</strong><span>Fan</span></button><button data-fanuc-tab="backups"><strong>${records.backups.length}</strong><span>Yedek</span></button></div>
          <div class="fanuc-note"><strong>Teknik not</strong><p>${esc(profile.notes || 'Bu tezgâh için teknik not eklenmedi.')}</p></div>
        </article>
      </div>${renderInventory(machine)}`;
  }

  function renderInventory(machine) {
    const inventory = machine?.moduleInventory || [];
    const editControls = canEdit();
    return `<article class="fanuc-panel fanuc-inventory-panel"><div class="fanuc-panel-head"><div><span>ELEKTRİK PANO & MODÜL ENVANTERİ</span><h3>Takılı FANUC donanımları</h3></div>${editControls ? '<button class="btn btn-primary btn-sm" data-fanuc-action="add-module">Modül ekle</button>' : '<span class="readonly-chip">Salt okunur</span>'}</div>${inventory.length ? `<div class="fanuc-inventory-table"><div class="inventory-row inventory-head"><span>Modül</span><span>Model / Parça no</span><span>Konum</span><span>Bağlantı</span>${editControls ? '<span>İşlem</span>' : ''}</div>${inventory.map(item => `<div class="inventory-row${editControls ? '' : ' readonly'}"><span><i class="inventory-type">${esc(item.category || 'Modül')}</i><strong>${esc(item.name || 'Adsız modül')}</strong></span><span><strong>${esc(item.model || '—')}</strong><small>S/N: ${esc(item.serial || '—')}</small></span><span>${esc(item.location || '—')}</span><span>${esc(item.axis || '—')}</span>${editControls ? `<span><button class="btn btn-ghost btn-sm" data-module-edit="${esc(item.id)}">Düzenle</button><button class="btn btn-ghost btn-sm inventory-delete" data-module-delete="${esc(item.id)}">Sil</button></span>` : ''}</div>`).join('')}</div>` : `<div class="fanuc-inventory-empty"><span>▦</span><div><strong>Henüz modül eklenmedi</strong><p>PSM, SVM, SPM, I/O ünitesi ve diğer pano bileşenlerini kayıt altına alın.</p></div>${editControls ? '<button class="btn btn-secondary btn-sm" data-fanuc-action="add-module">İlk modülü ekle</button>' : ''}</div>`}</article>`;
  }

  function renderScenarios() {
    const current = scenarios.find(item => item.id === selectedScenario) || scenarios[0];
    return `<div class="fanuc-scenario-layout"><div class="fanuc-scenario-list">${scenarios.map(item => `<button class="${item.id === current.id ? 'active' : ''}" data-scenario-id="${item.id}"><span class="scenario-icon">${item.icon}</span><span><strong>${esc(item.title)}</strong><small>${item.category}</small></span><i class="scenario-level ${item.severity}"></i></button>`).join('')}</div>
      <article class="fanuc-panel fanuc-procedure"><div class="fanuc-panel-head"><div><span>${esc(current.category)} SENARYOSU</span><h3>${esc(current.title)}</h3></div><span class="readonly-chip">Salt okunur teşhis</span></div>
        <div class="fanuc-safety-callout"><strong>Önce güvenlik</strong><span>Ölçüm veya pano müdahalesi gerekiyorsa üretici prosedürü, yetki şartları ve LOTO uygulanmalıdır.</span></div>
        <ol class="fanuc-check-list">${current.checks.map((check,index) => `<li><span>${index+1}</span><div><strong>Kontrol ${index+1}</strong><p>${esc(check)}</p></div></li>`).join('')}</ol>
        <div class="fanuc-actions"><button class="btn btn-primary" data-fanuc-nav="troubleshooter">Etkileşimli teşhisi aç</button><button class="btn btn-secondary" data-fanuc-nav="drive_diagnostics">Sürücü rehberini aç</button></div>
      </article></div>`;
  }

  function renderParameters(machine) {
    const critical = [{group:'Eksen referans', nums:'1815, 1820–1829'}, {group:'Soft limit', nums:'1320–1321'}, {group:'Backlash', nums:'1851'}, {group:'Spindle', nums:'4000–4999'}, {group:'Haberleşme', nums:'0020, 0100–0138'}];
    return `<div class="fanuc-layout-two"><article class="fanuc-panel"><div class="fanuc-panel-head"><div><span>YEDEK KARŞILAŞTIRMA</span><h3>${esc(machine?.numarasi || 'Tezgâh')} parametre analizi</h3></div><span class="readonly-chip">CNC’ye yazmaz</span></div><p class="fanuc-panel-copy">İki FANUC parametre yedeğini bit seviyesinde karşılaştırın. Kritik farklılıklar otomatik vurgulanır; sonuçlar teknik inceleme içindir.</p><div class="fanuc-compare-visual"><div><span>A</span><strong>Referans yedek</strong><small>Onaylı/orijinal</small></div><i>⇄</i><div><span>B</span><strong>Yeni yedek</strong><small>Karşılaştırılacak</small></div></div><button class="btn btn-primary" data-fanuc-nav="param_comparator">Parametre karşılaştırıcıyı aç</button></article>
      <article class="fanuc-panel"><div class="fanuc-panel-head"><div><span>KRİTİK GRUPLAR</span><h3>Öncelikli inceleme alanları</h3></div></div><div class="fanuc-critical-groups">${critical.map(item => `<div><span>${item.group}</span><code>${item.nums}</code></div>`).join('')}</div><div class="fanuc-safety-callout compact"><strong>Değişiklik yönetimi</strong><span>Fark bulunan değerleri kılavuz, tezgâh üreticisi dokümanı ve onaylı yedekle doğrulayın.</span></div></article></div>`;
  }

  function renderBackups(machine) {
    const records = machineRecords(machine).backups;
    const types = [
      ['CNC parametreleri', ['param','cnc']], ['PMC ladder/parametre', ['pmc','ladder']],
      ['Macro değişkenleri', ['macro','makro']], ['Pitch error compensation', ['pitch','compensation']],
      ['Tool/Work offset', ['offset','ofset','tool']], ['SRAM / All Data', ['sram','all data','tüm veri']]
    ];
    const hasType = keywords => records.some(record => {
      const searchable = `${record.tip || record.type || ''} ${record.aciklama || record.description || ''} ${record.dosya || record.file || ''}`.toLowerCase();
      return keywords.some(keyword => searchable.includes(keyword));
    });
    return `<div class="fanuc-layout-two"><article class="fanuc-panel"><div class="fanuc-panel-head"><div><span>YEDEK SAĞLIĞI</span><h3>${esc(machine?.numarasi || 'Tezgâh')} kapsam kontrolü</h3></div><span class="fanuc-count">${records.length} kayıt</span></div><div class="fanuc-backup-checklist">${types.map(([type,keywords]) => { const found = hasType(keywords); return `<div><span class="backup-status ${found ? 'ok' : 'missing'}">${found ? '✓' : '!'}</span><strong>${type}</strong><small>${found ? 'Takip kaydı mevcut' : 'Doğrulanmalı'}</small></div>`; }).join('')}</div></article>
      <article class="fanuc-panel"><div class="fanuc-panel-head"><div><span>YEDEK İŞ AKIŞI</span><h3>Güvenli kayıt ve doğrulama</h3></div></div><ol class="fanuc-mini-steps"><li>Doğru tezgâh ve kontrol serisini doğrula</li><li>Yedek kapsamını ve medya tipini seç</li><li>Dosyaları bütünlük kontrolünden geçir</li><li>Takip defterine tarih ve teknisyeni kaydet</li><li>Önceki yedekle parametre farklarını incele</li></ol><div class="fanuc-actions"><button class="btn btn-primary" data-fanuc-nav="backup_wizard">Yedekleme sihirbazı</button><button class="btn btn-secondary" data-fanuc-nav="backup_tracker">Yedek takip defteri</button></div></article></div>`;
  }

  function renderLedGuide() {
    const query = ledQuery.trim().toLowerCase();
    const filtered = ledGuide.filter(item => !query || `${item.code} ${item.module} ${item.state} ${item.checks}`.toLowerCase().includes(query));
    return `<article class="fanuc-panel"><div class="fanuc-panel-head"><div><span>7-SEGMENT / DURUM LED</span><h3>Sürücü LED ve alarm rehberi</h3></div><span class="readonly-chip">Model kılavuzuyla doğrulayın</span></div><div class="fanuc-led-search"><div class="led-display">${esc((ledQuery || '0').slice(0,2).toUpperCase())}</div><input class="form-control" id="fanuc-led-search" value="${esc(ledQuery)}" maxlength="12" placeholder="Kod veya modül ara: L, U, PSM…"><button class="btn btn-secondary" data-fanuc-nav="drive_diagnostics">Detaylı teşhis</button></div>
      <div class="fanuc-led-grid">${filtered.map(item => `<div class="fanuc-led-card"><div class="led-display small ${item.level}">${esc(item.code)}</div><div><span>${esc(item.module)}</span><strong>${esc(item.state)}</strong><p>${esc(item.checks)}</p></div></div>`).join('') || `<div class="fanuc-no-result">Bu kod için eşleşme bulunamadı. Tam kodu ve modül modelini kontrol edin.</div>`}</div><div class="fanuc-safety-callout"><strong>Önemli</strong><span>7-segment kod anlamları PSM/SVM/SPM modeli ve yazılım serisine göre değişebilir. Bu rehber ön eleme içindir; kesin işlemden önce doğru FANUC bakım kılavuzunu kullanın.</span></div></article>`;
  }

  function renderContent(machine) {
    if (activeTab === 'scenarios') return renderScenarios();
    if (activeTab === 'parameters') return renderParameters(machine);
    if (activeTab === 'backups') return renderBackups(machine);
    if (activeTab === 'led') return renderLedGuide();
    return renderOverview(machine);
  }

  function rerender() {
    const content = document.getElementById('fanuc-center-content');
    if (content) content.innerHTML = renderContent(selectedMachine());
    document.querySelectorAll('[data-fanuc-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.fanucTab === activeTab));
  }

  window.renderFanucCenter = function() {
    const page = document.createElement('section');
    page.className = 'page active fanuc-center-page';
    page.id = 'page-fanuc_center';
    const machines = [...(state().machines || [])].sort((a, b) => {
      const nameA = String(a.numarasi || a.name || '');
      const nameB = String(b.numarasi || b.name || '');
      return nameA.localeCompare(nameB, 'tr', { numeric: true, sensitivity: 'base' });
    });
    if (!window.ActiveFanucMachineId && machines[0]) window.ActiveFanucMachineId = machines[0].id;
    page.innerHTML = `<div class="page-header fanuc-center-header"><div><span class="fanuc-eyebrow">FANUC READ-ONLY SERVICE WORKSPACE</span><h1>FANUC Bakım & Teşhis Merkezi</h1><p>Tezgâh profili, teşhis senaryoları, parametre analizi, yedek sağlığı ve sürücü LED rehberi</p></div><label class="fanuc-machine-picker"><span>AKTİF TEZGÂH</span><select id="fanuc-machine-select">${machines.map(m => `<option value="${m.id}" ${Number(m.id) === Number(window.ActiveFanucMachineId) ? 'selected' : ''}>${esc(m.numarasi || m.name)}</option>`).join('')}</select></label></div><div class="fanuc-tabbar">${tabs.map(([id,label]) => `<button class="${id === activeTab ? 'active' : ''}" data-fanuc-tab="${id}">${label}</button>`).join('')}</div><div class="page-body" id="fanuc-center-content">${renderContent(selectedMachine())}</div>`;
    return page;
  };

  window.openFanucCenter = function(machineId) {
    window.ActiveFanucMachineId = Number(machineId);
    window.closeModal?.('mach-details');
    window.navigate?.('fanuc_center');
  };

  function openProfileModal() {
    const machine = selectedMachine();
    if (!machine) return;
    const p = machine.fanucProfile || {};
    window.showModal('fanuc-profile', `<div class="modal-header"><span class="modal-title">FANUC Profili — ${esc(machine.numarasi)}</span><button class="modal-close" data-fanuc-action="close-profile">×</button></div><div class="form-row"><div class="form-group"><label class="form-label">Kontrol serisi</label><input class="form-control" id="fp-series" value="${esc(p.series || '')}" placeholder="0i-MF Plus, 31i-B…"></div><div class="form-group"><label class="form-label">CNC yazılım sürümü</label><input class="form-control" id="fp-software" value="${esc(p.software || '')}" placeholder="Seri/sürüm"></div></div><div class="form-row"><div class="form-group"><label class="form-label">Seri numarası</label><input class="form-control" id="fp-serial" value="${esc(p.serial || '')}"></div><div class="form-group"><label class="form-label">Eksen / Spindle</label><div style="display:flex;gap:8px"><input class="form-control" id="fp-axes" value="${esc(p.axes || '')}" inputmode="numeric" placeholder="4 eksen"><input class="form-control" id="fp-spindles" value="${esc(p.spindles || '')}" inputmode="numeric" placeholder="1 spindle"></div></div></div><div class="form-group"><label class="form-label">PSM / SVM / SPM modülleri</label><input class="form-control" id="fp-modules" value="${esc(p.modules || '')}" placeholder="A06B-…, αiSV…, αiSP…"></div><div class="form-group"><label class="form-label">FSSB / I/O topoloji notu</label><input class="form-control" id="fp-topology" value="${esc(p.topology || '')}" placeholder="CNC → SVM X/Y → SVM Z…"></div><div class="form-group"><label class="form-label">Teknik not</label><textarea class="form-control" id="fp-notes" rows="3">${esc(p.notes || '')}</textarea></div><div class="modal-footer"><button class="btn btn-ghost" data-fanuc-action="close-profile">Vazgeç</button><button class="btn btn-primary" data-fanuc-action="save-profile">Profili kaydet</button></div>`, 'lg');
  }

  function openModuleModal(moduleId = '') {
    const machine = selectedMachine();
    if (!machine) return;
    const item = (machine.moduleInventory || []).find(module => String(module.id) === String(moduleId)) || {};
    window.showModal('fanuc-module', `<div class="modal-header"><span class="modal-title">${item.id ? 'Modülü Düzenle' : 'Pano Modülü Ekle'} — ${esc(machine.numarasi)}</span><button class="modal-close" data-fanuc-action="close-module">×</button></div><input type="hidden" id="fm-id" value="${esc(item.id || '')}"><div class="form-row"><div class="form-group"><label class="form-label">Modül türü</label><select class="form-control" id="fm-category">${['CNC','PSM','SVM','SPM','I/O Unit','Operator Panel','Servo Motor','Pulse Coder','Diğer'].map(value => `<option ${item.category === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Modül adı</label><input class="form-control" id="fm-name" value="${esc(item.name || '')}" placeholder="X/Y Servo Amplifikatör"></div></div><div class="form-row"><div class="form-group"><label class="form-label">Model / FANUC parça numarası</label><input class="form-control" id="fm-model" value="${esc(item.model || '')}" placeholder="A06B-…"></div><div class="form-group"><label class="form-label">Seri numarası</label><input class="form-control" id="fm-serial" value="${esc(item.serial || '')}"></div></div><div class="form-row"><div class="form-group"><label class="form-label">Pano konumu</label><input class="form-control" id="fm-location" value="${esc(item.location || '')}" placeholder="Pano sol üst / Slot 2"></div><div class="form-group"><label class="form-label">Bağlı eksen/işlev</label><input class="form-control" id="fm-axis" value="${esc(item.axis || '')}" placeholder="X/Y, Z, Spindle…"></div></div><div class="form-row"><div class="form-group"><label class="form-label">Montaj/değişim tarihi</label><input class="form-control" type="date" id="fm-installed" value="${esc(item.installedAt || '')}"></div><div class="form-group"><label class="form-label">Yedek durumu</label><select class="form-control" id="fm-spare">${['Yok','Stokta','Siparişte'].map(value => `<option ${item.spare === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div></div><div class="form-group"><label class="form-label">Teknik not</label><textarea class="form-control" id="fm-notes" rows="3">${esc(item.notes || '')}</textarea></div><div class="modal-footer"><button class="btn btn-ghost" data-fanuc-action="close-module">Vazgeç</button><button class="btn btn-primary" data-fanuc-action="save-module">Modülü kaydet</button></div>`, 'lg');
  }

  async function persistInventory(inventory, message) {
    if (!canEdit()) return denyEdit();
    const result = await window.FanucCenterBridge.saveModuleInventory(selectedMachine()?.id, inventory);
    if (!result.ok) return window.MTBUX?.notify({ type:'error', message: result.error || 'Modül envanteri kaydedilemedi.' });
    window.closeModal?.('fanuc-module');
    window.MTBUX?.notify({ type:'success', title:'Modül envanteri güncellendi', message });
    rerender();
  }

  document.addEventListener('change', event => {
    if (event.target.id === 'fanuc-machine-select') { window.ActiveFanucMachineId = Number(event.target.value); rerender(); }
  });
  const applyLedSearch = window.MTBPerformance?.debounce?.(value => { ledQuery = value; rerender(); const input = document.getElementById('fanuc-led-search'); input?.focus(); input?.setSelectionRange(ledQuery.length, ledQuery.length); }, 180)
    || (value => { ledQuery = value; rerender(); });
  document.addEventListener('input', event => {
    if (event.target.id === 'fanuc-led-search') applyLedSearch(event.target.value);
  });
  document.addEventListener('click', async event => {
    const tab = event.target.closest('[data-fanuc-tab]');
    if (tab) { activeTab = tab.dataset.fanucTab; rerender(); return; }
    const scenario = event.target.closest('[data-scenario-id]');
    if (scenario) { selectedScenario = scenario.dataset.scenarioId; rerender(); return; }
    const nav = event.target.closest('[data-fanuc-nav]');
    if (nav) { window.navigate?.(nav.dataset.fanucNav); return; }
    const action = event.target.closest('[data-fanuc-action]')?.dataset.fanucAction;
    if (action === 'edit-profile') { if (!canEdit()) denyEdit(); else openProfileModal(); }
    if (action === 'add-module') { if (!canEdit()) denyEdit(); else openModuleModal(); }
    if (action === 'close-profile') window.closeModal?.('fanuc-profile');
    if (action === 'close-module') window.closeModal?.('fanuc-module');
    if (action === 'save-profile') {
      if (!canEdit()) return denyEdit();
      const profile = { series: document.getElementById('fp-series')?.value.trim(), software: document.getElementById('fp-software')?.value.trim(), serial: document.getElementById('fp-serial')?.value.trim(), axes: document.getElementById('fp-axes')?.value.trim(), spindles: document.getElementById('fp-spindles')?.value.trim(), modules: document.getElementById('fp-modules')?.value.trim(), topology: document.getElementById('fp-topology')?.value.trim(), notes: document.getElementById('fp-notes')?.value.trim() };
      const result = await window.FanucCenterBridge.saveMachineProfile(selectedMachine()?.id, profile);
      if (result.ok) { window.closeModal?.('fanuc-profile'); window.MTBUX?.notify({ type:'success', title:'FANUC profili güncellendi', message:'Tezgâhın kontrol, modül ve topoloji bilgileri kaydedildi.' }); rerender(); }
      else window.MTBUX?.notify({ type:'error', message: result.error || 'Profil kaydedilemedi.' });
    }
    if (action === 'save-module') {
      if (!canEdit()) return denyEdit();
      const name = document.getElementById('fm-name')?.value.trim();
      const model = document.getElementById('fm-model')?.value.trim();
      if (!name || !model) return window.MTBUX?.notify({ type:'warning', title:'Eksik modül bilgisi', message:'Modül adı ve model/parça numarası zorunludur.' });
      const id = document.getElementById('fm-id')?.value || `mod-${Date.now()}`;
      const entry = { id, category:document.getElementById('fm-category')?.value, name, model, serial:document.getElementById('fm-serial')?.value.trim(), location:document.getElementById('fm-location')?.value.trim(), axis:document.getElementById('fm-axis')?.value.trim(), installedAt:document.getElementById('fm-installed')?.value, spare:document.getElementById('fm-spare')?.value, notes:document.getElementById('fm-notes')?.value.trim(), updatedAt:new Date().toISOString() };
      const inventory = [...(selectedMachine()?.moduleInventory || [])];
      const index = inventory.findIndex(item => String(item.id) === String(id));
      if (index >= 0) inventory[index] = entry; else inventory.push(entry);
      await persistInventory(inventory, `${name} modülü tezgâh profiline kaydedildi.`);
    }
    const editId = event.target.closest('[data-module-edit]')?.dataset.moduleEdit;
    if (editId) { if (!canEdit()) denyEdit(); else openModuleModal(editId); }
    const deleteId = event.target.closest('[data-module-delete]')?.dataset.moduleDelete;
    if (deleteId && !canEdit()) return denyEdit();
    if (deleteId && window.confirm('Bu modül envanter kaydını silmek istediğinize emin misiniz?')) {
      const inventory = (selectedMachine()?.moduleInventory || []).filter(item => String(item.id) !== String(deleteId));
      await persistInventory(inventory, 'Modül envanter kaydı silindi.');
    }
  });
})();
