(() => {
  'use strict';

  const bridge = () => window.MachineWorkspaceBridge;
  const state = () => bridge()?.getState?.() || {};
  let compactTable = localStorage.getItem('machine-table-density') === 'compact';
  const esc = value => bridge()?.escapeHTML?.(String(value ?? '')) || String(value ?? '');
  const asDate = value => {
    if (!value) return null;
    const parts = String(value).split(/[-./]/);
    const date = parts.length === 3 && parts[0].length !== 4
      ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
      : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const machineMatch = (record, machine) => Number(record.tezgah_id ?? record.machine_id) === Number(machine.id)
    || record.machine === machine.numarasi || record.machine_name === machine.numarasi;
  const recordsFor = machine => {
    const app = state();
    const indexed = window.MTBPerformance?.buildRecordIndex?.(app)?.forMachine?.(machine);
    if (indexed) return indexed;
    return {
      maintenance: (app.maintenances || []).filter(item => machineMatch(item, machine)),
      batteries: (app.batteries || []).filter(item => machineMatch(item, machine)),
      fans: (app.fans || []).filter(item => machineMatch(item, machine)),
      backups: (app.backup_logs || []).filter(item => machineMatch(item, machine))
    };
  };
  const newest = (items, fields = ['tarih', 'date']) => [...items].sort((a, b) => {
    const bd = asDate(fields.map(key => b[key]).find(Boolean));
    const ad = asDate(fields.map(key => a[key]).find(Boolean));
    return (bd?.getTime() || 0) - (ad?.getTime() || 0);
  })[0];
  const daysSince = date => date ? Math.floor((Date.now() - date.getTime()) / 86400000) : Infinity;
  const backupDate = item => item?.son_yedek_tarihi || item?.tarih || item?.date;
  const backupPath = item => item?.dosya_konumu || item?.dosya || item?.file || '';
  const recordTime = (item, fields) => asDate(fields.map(key => item?.[key]).find(Boolean))?.getTime() || Number(item?.id) || 0;
  const latestPer = (items, keyFor, dateFields) => {
    const latest = new Map();
    items.forEach(item => {
      const key = keyFor(item);
      const current = latest.get(key);
      if (!current || recordTime(item, dateFields) >= recordTime(current, dateFields)) latest.set(key, item);
    });
    return [...latest.values()];
  };

  function machineStatus(machine) {
    const records = recordsFor(machine);
    const issues = [];
    const openMaintenance = records.maintenance.filter(item => !/tamam/i.test(item.durum || item.status || ''));
    const currentBatteries = latestPer(records.batteries, item => String(item.eksen || item.axis || 'genel').toLocaleLowerCase('tr-TR'), ['tarih','date']);
    const currentFans = latestPer(records.fans, item => String(item.konum || item.location || 'genel').toLocaleLowerCase('tr-TR'), ['tarih','date','updatedAt']);
    const criticalBatteries = currentBatteries.filter(item => {
      const voltage = Number(item.voltaj || item.voltage || 0);
      return (voltage > 0 && voltage < 3) || daysSince(asDate(item.tarih || item.date)) >= 365;
    });
    const fanRisks = currentFans.filter(item => Number(item.calisma_saati || item.hours || 0) >= 15000);
    const latestBackup = newest(records.backups, ['son_yedek_tarihi','tarih','date']);
    if (criticalBatteries.length) issues.push({ level: 'danger', text: 'Kritik pil', key: 'battery' });
    if (fanRisks.length) issues.push({ level: fanRisks.some(item => Number(item.calisma_saati || item.hours || 0) >= 20000) ? 'danger' : 'warn', text: 'Fan bakımı gerekli', key: 'fan' });
    if (openMaintenance.length) issues.push({ level: 'warn', text: `${openMaintenance.length} açık bakım`, key: 'maintenance' });
    if (!latestBackup || daysSince(asDate(backupDate(latestBackup))) > 180) issues.push({ level: 'warn', text: 'Yedek güncel değil', key: 'backup' });
    if (!(machine.moduleInventory || []).length) issues.push({ level: 'info', text: 'Modül envanteri eksik', key: 'inventory' });
    if (!machine.fanucProfile?.series) issues.push({ level: 'muted', text: 'FANUC profili eksik', key: 'profile' });
    const primary = issues.find(item => item.level === 'danger') || issues.find(item => item.level === 'warn') || issues[0]
      || { level: 'ok', text: 'Normal', key: 'normal' };
    return { primary, issues, records, latestBackup, lastMaintenance: newest(records.maintenance), openMaintenance };
  }

  function renderSummary(machines) {
    const statuses = machines.map(machineStatus);
    const critical = statuses.filter(item => item.issues.some(issue => issue.level === 'danger')).length;
    const attention = statuses.filter(item => !item.issues.some(issue => issue.level === 'danger') && item.issues.some(issue => issue.level === 'warn')).length;
    const backup = statuses.filter(item => item.issues.some(issue => issue.key === 'backup')).length;
    return `<div class="machine-summary">
      <button data-machine-filter="all"><span>TOPLAM TEZGÂH</span><strong>${machines.length}</strong><small>Tüm kayıtlar</small></button>
      <button class="danger" data-machine-filter="danger"><span>KRİTİK DURUM</span><strong>${critical}</strong><small>Pil veya fan müdahalesi</small></button>
      <button class="warn" data-machine-filter="warn"><span>KONTROL EDİLMELİ</span><strong>${attention}</strong><small>Açık bakım veya yaklaşan işlem</small></button>
      <button class="info" data-machine-filter="backup"><span>GÜNCEL YEDEK YOK</span><strong>${backup}</strong><small>Yok veya 180 günden eski</small></button>
    </div>`;
  }

  function row(machine) {
    const info = machineStatus(machine);
    const profile = machine.fanucProfile || {};
    return `<tr data-machine-id="${machine.id}" data-machine-level="${info.primary.level}" data-machine-issues="${info.issues.map(item => item.key).join(' ')}">
      <td><button class="machine-name-link" data-machine-action="details" data-machine-id="${machine.id}">${esc(machine.numarasi || machine.name)}</button><small>${esc(machine.manufacturer || '')} ${esc(machine.model || '')}</small></td>
      <td><span class="machine-state ${info.primary.level}"><i></i>${esc(info.primary.text)}</span>${info.issues.length > 1 ? `<details class="machine-reasons"><summary>${info.issues.length - 1} diğer nedeni göster</summary><ul>${info.issues.slice(1).map(issue=>`<li>${esc(issue.text)}</li>`).join('')}</ul></details>` : ''}</td>
      <td><strong>${esc(machine.bolum || '—')}</strong><small>${esc(machine.tip || '—')}</small></td>
      <td><strong>${esc(profile.series || 'Belirtilmedi')}</strong><small>${esc(profile.software || '')}</small></td>
      <td>${esc(info.lastMaintenance?.tarih || info.lastMaintenance?.date || 'Kayıt yok')}</td>
      <td class="${!info.latestBackup ? 'machine-cell-warn' : ''}">${esc(backupDate(info.latestBackup) || 'Yedek yok')}</td>
      <td><div class="machine-row-actions"><button class="btn btn-secondary btn-sm" data-machine-action="details" data-machine-id="${machine.id}">Detay</button><button class="btn btn-ghost btn-sm" data-machine-action="fanuc" data-machine-id="${machine.id}">FANUC</button></div></td>
    </tr>`;
  }

  function render() {
    const app = state();
    const machines = app.machines || [];
    const page = document.createElement('section');
    page.className = 'page active machine-workspace-page';
    page.id = 'page-machines';
    page.innerHTML = `<div class="page-header machine-workspace-header"><div><span class="page-eyebrow">OPERASYON / TEZGÂHLAR</span><h1>Tezgâh Listesi</h1><p>Durum, bakım, yedek ve FANUC kayıtlarını tek yerden yönetin</p></div><div class="machine-header-actions"><button class="btn btn-secondary btn-sm" data-machine-action="toggle-density" aria-pressed="${compactTable}">${compactTable?'Rahat':'Kompakt'} görünüm</button>${bridge()?.canEdit?.() ? '<button class="btn btn-primary" data-machine-action="new">+ Yeni Tezgâh</button>' : ''}</div></div>
      <div class="page-body machine-workspace-body">${renderSummary(machines)}
        <div class="machine-tools"><div class="search-bar"><label class="sr-only" for="machine-workspace-search">Tezgâhlarda ara</label><input id="machine-workspace-search" aria-describedby="machine-workspace-results" placeholder="Tezgâh, bölüm, kontrol serisi veya parça ara…"></div><label class="sr-only" for="machine-workspace-dept">Bölüm filtresi</label><select id="machine-workspace-dept"><option value="">Tüm bölümler</option>${[...new Set(machines.map(item => item.bolum).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr')).map(value => `<option>${esc(value)}</option>`).join('')}</select><label class="sr-only" for="machine-workspace-status">Durum filtresi</label><select id="machine-workspace-status"><option value="">Tüm durumlar</option><option value="danger">Kritik</option><option value="warn">Kontrol edilmeli</option><option value="ok">Normal</option><option value="backup">Yedek güncel değil</option><option value="inventory">Envanter eksik</option></select></div><div id="machine-workspace-results" class="sr-only" role="status" aria-live="polite">${machines.length} tezgâh gösteriliyor</div>
        <div class="machine-table-wrap"><table class="data-table machine-workspace-table${compactTable?' is-compact':''}"><thead><tr><th>Tezgâh</th><th>Durum</th><th>Bölüm / Tip</th><th>FANUC</th><th>Son bakım</th><th>Son yedek</th><th>İşlem</th></tr></thead><tbody>${machines.length ? machines.map(row).join('') : `<tr><td colspan="7"><div class="machine-empty"><strong>Henüz tezgâh eklenmedi</strong><span>Bakım, pil, fan ve FANUC kayıtlarını ilişkilendirmek için ilk tezgâhı oluşturun.</span>${bridge()?.canEdit?.()?'<button class="btn btn-primary btn-sm" data-machine-action="new">Tezgâh ekle</button>':''}</div></td></tr>`}</tbody></table></div>
      </div>`;
    return page;
  }

  function detailOverview(machine, info) {
    const profile = machine.fanucProfile || {};
    const events = timeline(machine, info).slice(0, 5);
    return `<div class="machine-detail-alerts">${info.issues.length ? info.issues.map(issue => `<span class="${issue.level}">${esc(issue.text)}</span>`).join('') : '<span class="ok">Aktif bakım bildirimi yok</span>'}</div><div class="machine-detail-grid"><article class="machine-detail-panel"><h3>Tezgâh kimliği</h3><dl><div><dt>Üretici / Model</dt><dd>${esc([machine.manufacturer, machine.model].filter(Boolean).join(' ') || 'Belirtilmedi')}</dd></div><div><dt>Seri numarası</dt><dd>${esc(machine.serial || 'Belirtilmedi')}</dd></div><div><dt>Kontrol serisi</dt><dd>${esc(profile.series || 'Belirtilmedi')}</dd></div><div><dt>Çalışma durumu</dt><dd>${esc(machine.operationalStatus || 'Üretimde')}</dd></div><div><dt>Sorumlu ekip</dt><dd>${esc(machine.responsibleTeam || 'Belirtilmedi')}</dd></div><div><dt>Devreye alma</dt><dd>${esc(machine.commissionedAt || 'Belirtilmedi')}</dd></div></dl></article><article class="machine-detail-panel"><h3>Son hareketler</h3><div class="machine-mini-timeline">${events.length ? events.map(event => `<div><i class="${event.level}"></i><span><strong>${esc(event.title)}</strong><small>${esc(event.detail)}</small></span><time>${esc(event.date || '')}</time></div>`).join('') : '<p class="text-muted">Henüz hareket kaydı yok.</p>'}</div></article></div>`;
  }

  function maintenanceTab(machine, info) {
    return `<div class="machine-tab-head"><div><h3>Bakım geçmişi</h3><p>${info.records.maintenance.length} kayıt · ${info.openMaintenance.length} açık işlem</p></div><button class="btn btn-primary btn-sm" data-machine-nav="maintenance" data-machine-id="${machine.id}">Tümünü bakım defterinde aç</button></div><div class="machine-record-list">${newestList(info.records.maintenance).slice(0,20).map(item => `<div><span class="machine-record-icon">🔧</span><div><strong>${esc(item.aciklama || item.description || 'Bakım kaydı')}</strong><small>${esc(item.bakim_yapan || item.technician || 'Teknisyen belirtilmedi')}</small></div><time>${esc(item.tarih || item.date || '')}</time><em>${esc(item.durum || item.status || '')}</em></div>`).join('') || empty('Bu tezgâha ait bakım kaydı bulunmuyor.')}</div>`;
  }
  const newestList = items => [...items].sort((a,b)=>(asDate(b.tarih || b.date)?.getTime() || 0)-(asDate(a.tarih || a.date)?.getTime() || 0));
  const empty = text => `<div class="machine-detail-empty">${esc(text)}</div>`;

  function batteryFanTab(machine, info) {
    return `<div class="machine-tab-head"><div><h3>Pil ve fan geçmişi</h3><p>Son 20 kayıt gösteriliyor</p></div><button class="btn btn-primary btn-sm" data-machine-nav="battery" data-machine-id="${machine.id}">Tümünü pil ve fan ekranında aç</button></div><div class="machine-detail-grid"><article class="machine-detail-panel"><h3>Pil kayıtları</h3><div class="machine-record-list compact">${newestList(info.records.batteries).slice(0,20).map(item => { const status=bridge()?.getBatteryStatus?.(item.tarih || item.date) || {}; return `<div><span class="machine-record-icon">🔋</span><div><strong>${esc(item.eksen || item.axis || 'Eksen')} · ${esc(item.pil_modeli || item.model || 'Model yok')}</strong><small>${esc(item.bakim_yapan || item.technician || '')}</small></div><time>${esc(item.tarih || item.date || '')}</time><em>${esc(status.label || '')}</em></div>`; }).join('') || empty('Pil kaydı bulunmuyor.')}</div></article><article class="machine-detail-panel"><h3>Fan kayıtları</h3><div class="machine-record-list compact">${newestList(info.records.fans).slice(0,20).map(item => `<div><span class="machine-record-icon">✣</span><div><strong>${esc(item.konum || item.location || 'Fan')}</strong><small>${esc(item.bakim_yapan || item.technician || '')}</small></div><time>${esc(item.calisma_saati || item.hours || 0)} saat</time><em>${Number(item.calisma_saati || item.hours || 0)>=20000?'Bakım gerekli':Number(item.calisma_saati || item.hours || 0)>=15000?'Yaklaşıyor':'Normal'}</em></div>`).join('') || empty('Fan kaydı bulunmuyor.')}</div></article></div>`;
  }

  function fanucTab(machine) {
    const p=machine.fanucProfile || {};
    return `<div class="machine-tab-head"><div><h3>FANUC teknik profili</h3><p>Kontrol ve sürücü kimliği</p></div><button class="btn btn-primary btn-sm" data-machine-action="fanuc" data-machine-id="${machine.id}">FANUC Merkezini aç</button></div><article class="machine-detail-panel"><dl><div><dt>Kontrol serisi</dt><dd>${esc(p.series || 'Belirtilmedi')}</dd></div><div><dt>Yazılım sürümü</dt><dd>${esc(p.software || 'Belirtilmedi')}</dd></div><div><dt>CNC seri numarası</dt><dd>${esc(p.serial || 'Belirtilmedi')}</dd></div><div><dt>Eksen / Spindle</dt><dd>${esc(p.axes || '—')} / ${esc(p.spindles || '—')}</dd></div><div><dt>PSM / SVM / SPM</dt><dd>${esc(p.modules || 'Belirtilmedi')}</dd></div><div><dt>FSSB / I/O</dt><dd>${esc(p.topology || 'Belirtilmedi')}</dd></div></dl></article>`;
  }

  function modulesTab(machine) {
    const items=machine.moduleInventory || [];
    return `<div class="machine-tab-head"><div><h3>Pano ve modül envanteri</h3><p>${items.length} kayıtlı bileşen · ilk 20 kayıt</p></div><button class="btn btn-primary btn-sm" data-machine-action="fanuc" data-machine-id="${machine.id}">Tümünü FANUC Merkezinde aç</button></div><div class="machine-module-list">${items.slice(0,20).map(item => `<div><span>${esc(item.category || 'Modül')}</span><strong>${esc(item.name || 'Adsız modül')}</strong><code>${esc(item.model || 'Parça no yok')}</code><small>${esc(item.location || 'Konum yok')} · ${esc(item.axis || 'Bağlantı yok')}</small></div>`).join('') || empty('Modül envanteri henüz oluşturulmamış.')}</div>`;
  }

  function backupTab(machine, info) {
    const backups=[...info.records.backups].sort((a,b)=>(asDate(backupDate(b))?.getTime() || 0)-(asDate(backupDate(a))?.getTime() || 0));
    return `<div class="machine-tab-head"><div><h3>Yedekleme geçmişi</h3><p>${info.records.backups.length} kayıt</p></div><button class="btn btn-primary btn-sm" data-machine-nav="backup_tracker" data-machine-id="${machine.id}">Tümünü yedek takip defterinde aç</button></div><div class="machine-record-list">${backups.slice(0,20).map(item => `<div><span class="machine-record-icon">↥</span><div><strong>${esc(item.tip || item.type || backupPath(item) || 'Yedek')}</strong><small>${esc(item.aciklama || item.description || backupPath(item))}</small></div><time>${esc(backupDate(item) || '')}</time></div>`).join('') || empty('Bu tezgâha ait yedek kaydı bulunmuyor.')}</div>`;
  }

  function timeline(machine, info) {
    return [
      ...info.records.maintenance.map(item=>({title:item.aciklama || 'Bakım kaydı',detail:item.bakim_yapan || '',date:item.tarih || item.date,level:'maintenance'})),
      ...info.records.batteries.map(item=>({title:`${item.eksen || 'Eksen'} pili değiştirildi`,detail:item.pil_modeli || '',date:item.tarih || item.date,level:'battery'})),
      ...info.records.fans.map(item=>({title:`${item.konum || 'Fan'} kaydı`,detail:`${item.calisma_saati || 0} saat`,date:item.tarih || item.date,level:'fan'})),
      ...info.records.backups.map(item=>({title:item.tip || item.type || 'Yedek kaydı',detail:backupPath(item),date:backupDate(item),level:'backup'})),
      ...(machine.moduleInventory || []).map(item=>({title:`${item.name || 'Modül'} envantere eklendi`,detail:item.model || '',date:item.installedAt || item.updatedAt?.slice(0,10),level:'module'}))
    ].sort((a,b)=>(asDate(b.date)?.getTime() || 0)-(asDate(a.date)?.getTime() || 0));
  }

  function timelineTab(machine, info) {
    const items=timeline(machine,info).slice(0,20);
    return `<div class="machine-tab-head"><div><h3>Tezgâh zaman çizelgesi</h3><p>Bakım, pil, fan, yedek ve modül hareketleri</p></div></div><div class="machine-full-timeline">${items.map(item=>`<div><i class="${item.level}"></i><time>${esc(item.date || 'Tarih yok')}</time><span><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span></div>`).join('') || empty('Zaman çizelgesinde gösterilecek kayıt bulunmuyor.')}</div>`;
  }

  function showDetails(id, tab='overview') {
    const machine=(state().machines || []).find(item=>Number(item.id)===Number(id));
    if (!machine) return;
    const info=machineStatus(machine);
    const tabs=[['overview','Genel Bakış'],['maintenance','Bakım'],['battery','Pil & Fan'],['fanuc','FANUC Profili'],['modules','Modüller'],['backup','Yedekleme'],['timeline','Zaman Çizelgesi']];
    const panes={overview:detailOverview(machine,info),maintenance:maintenanceTab(machine,info),battery:batteryFanTab(machine,info),fanuc:fanucTab(machine),modules:modulesTab(machine),backup:backupTab(machine,info),timeline:timelineTab(machine,info)};
    const activeTab=tabs.some(([key])=>key===tab)?tab:'overview';
    window.showModal('machine-workspace-detail',`<div class="modal-header machine-detail-header"><div><span class="modal-title">${esc(machine.numarasi || machine.name)}</span><small>${esc(machine.bolum || 'Bölüm yok')} · ${esc(machine.tip || 'Tip yok')} · ${esc(machine.fanucProfile?.series || 'FANUC serisi yok')}</small></div><div class="machine-detail-header-actions">${bridge()?.canEdit?.()?`<button class="btn btn-secondary btn-sm" data-machine-action="edit" data-machine-id="${machine.id}">Düzenle</button>`:''}<button class="modal-close" aria-label="Tezgâh detayını kapat" data-machine-action="close-detail">×</button></div></div><div class="machine-detail-tabs" role="tablist" aria-label="Tezgâh detay bölümleri">${tabs.map(([key,label])=>`<button id="machine-tab-${key}" role="tab" aria-selected="${key===activeTab}" aria-controls="machine-panel-${key}" tabindex="${key===activeTab?'0':'-1'}" class="${key===activeTab?'active':''}" data-machine-detail-tab="${key}" data-machine-id="${machine.id}">${label}</button>`).join('')}</div><div class="machine-detail-context" aria-label="Aktif tezgâh bağlamı"><span><small>TEZGÂH</small><strong>${esc(machine.numarasi || machine.name)}</strong></span><span><small>ÇALIŞMA DURUMU</small><strong>${esc(machine.operationalStatus || 'Üretimde')}</strong></span><span><small>ANA BİLDİRİM</small><strong class="${info.primary.level}">${esc(info.primary.text)}</strong></span><span><small>SORUMLU EKİP</small><strong>${esc(machine.responsibleTeam || 'Belirtilmedi')}</strong></span></div><div id="machine-panel-${activeTab}" class="machine-detail-content" role="tabpanel" tabindex="0" aria-labelledby="machine-tab-${activeTab}">${panes[activeTab] || panes.overview}</div><div class="modal-footer"><button class="btn btn-secondary" data-machine-action="pdf" data-machine-id="${machine.id}">PDF Kartı</button><button class="btn btn-ghost" data-machine-action="close-detail">Kapat</button><button class="btn btn-secondary" data-machine-action="fanuc" data-machine-id="${machine.id}">FANUC Merkezi</button><button class="btn btn-primary" data-machine-nav="maintenance" data-machine-id="${machine.id}">Bakım Defteri</button></div>`,'xl');
    const footer=document.querySelector('#modal-machine-workspace-detail .modal-footer');
    if(footer&&!footer.querySelector('[data-machine-nav="diagnostic_history"]')){const button=document.createElement('button');button.className='btn btn-secondary';button.dataset.machineNav='diagnostic_history';button.dataset.machineId=String(machine.id);button.textContent='Teşhis Geçmişi';footer.insertBefore(button,footer.lastElementChild);}
  }

  function editDetails(id) {
    const m=(state().machines || []).find(item=>Number(item.id)===Number(id));
    if (!m || !bridge()?.canEdit?.()) return;
    window.showModal('machine-workspace-edit',`<div class="modal-header"><span class="modal-title">Tezgâh bilgilerini düzenle</span><button class="modal-close" data-machine-action="close-edit">×</button></div><input type="hidden" id="mwe-id" value="${m.id}"><div class="form-row"><div class="form-group"><label class="form-label">Tezgâh numarası *</label><input class="form-control" id="mwe-name" value="${esc(m.numarasi || '')}"></div><div class="form-group"><label class="form-label">Çalışma durumu</label><select class="form-control" id="mwe-status">${['Üretimde','Bakımda','Devre dışı','Kurulumda'].map(value=>`<option ${m.operationalStatus===value?'selected':''}>${value}</option>`).join('')}</select></div></div><div class="form-row"><div class="form-group"><label class="form-label">Üretici</label><input class="form-control" id="mwe-manufacturer" value="${esc(m.manufacturer || '')}"></div><div class="form-group"><label class="form-label">Model</label><input class="form-control" id="mwe-model" value="${esc(m.model || '')}"></div></div><div class="form-row"><div class="form-group"><label class="form-label">Seri numarası</label><input class="form-control" id="mwe-serial" value="${esc(m.serial || '')}"></div><div class="form-group"><label class="form-label">Devreye alma tarihi</label><input type="date" class="form-control" id="mwe-commissioned" value="${esc(m.commissionedAt || '')}"></div></div><div class="form-row"><div class="form-group"><label class="form-label">Bölüm</label><input class="form-control" id="mwe-dept" value="${esc(m.bolum || '')}"></div><div class="form-group"><label class="form-label">Tezgâh tipi</label><input class="form-control" id="mwe-type" value="${esc(m.tip || '')}"></div></div><div class="form-group"><label class="form-label">Sorumlu ekip</label><input class="form-control" id="mwe-team" value="${esc(m.responsibleTeam || '')}"></div><div class="form-group"><label class="form-label">Teknik açıklama</label><textarea class="form-control" id="mwe-notes" rows="3">${esc(m.notes || '')}</textarea></div><div class="modal-footer"><button class="btn btn-ghost" data-machine-action="close-edit">Vazgeç</button><button class="btn btn-primary" data-machine-action="save-edit">Kaydet</button></div>`,'lg');
  }

  async function saveDetails() {
    const id=Number(document.getElementById('mwe-id')?.value);
    const machine=(state().machines || []).find(item=>Number(item.id)===id);
    const name=document.getElementById('mwe-name')?.value.trim();
    if (!machine || !name) return window.MTBUX?.notify({type:'warning',message:'Tezgâh numarası zorunludur.'});
    const previous={...machine};
    Object.assign(machine,{numarasi:name,operationalStatus:document.getElementById('mwe-status')?.value,manufacturer:document.getElementById('mwe-manufacturer')?.value.trim(),model:document.getElementById('mwe-model')?.value.trim(),serial:document.getElementById('mwe-serial')?.value.trim(),commissionedAt:document.getElementById('mwe-commissioned')?.value,bolum:document.getElementById('mwe-dept')?.value.trim(),tip:document.getElementById('mwe-type')?.value.trim(),responsibleTeam:document.getElementById('mwe-team')?.value.trim(),notes:document.getElementById('mwe-notes')?.value.trim(),updatedAt:new Date().toISOString()});
    const saved = await bridge().saveMachines();
    if (!saved) { Object.assign(machine,previous); return window.MTBUX?.notify({type:'error',title:'Tezgâh kaydedilemedi',message:'Değişiklikler diske yazılamadı. Form açık bırakıldı; tekrar deneyin.'}); }
    window.closeModal?.('machine-workspace-edit');
    window.MTBUX?.notify({type:'success',title:'Tezgâh bilgileri güncellendi',message:`${name} kaydı güvenli biçimde kaydedildi.`});
    window.navigate?.('machines');
  }

  function applyFilters() {
    const root=document.getElementById('page-machines'); if(!root) return;
    const q=(root.querySelector('#machine-workspace-search')?.value || '').toLocaleLowerCase('tr-TR');
    const dept=root.querySelector('#machine-workspace-dept')?.value || '';
    const status=root.querySelector('#machine-workspace-status')?.value || '';
    let visible=0;
    root.querySelectorAll('tbody tr[data-machine-id]').forEach(row=>{const machine=(state().machines||[]).find(item=>Number(item.id)===Number(row.dataset.machineId));const haystack=`${machine?.numarasi||''} ${machine?.bolum||''} ${machine?.tip||''} ${machine?.manufacturer||''} ${machine?.model||''} ${machine?.serial||''} ${machine?.fanucProfile?.series||''} ${(machine?.moduleInventory||[]).map(item=>`${item.name} ${item.model} ${item.serial}`).join(' ')}`.toLocaleLowerCase('tr-TR');const statusMatch=!status || row.dataset.machineLevel===status || row.dataset.machineIssues.includes(status);row.hidden=!(haystack.includes(q)&&(!dept||machine?.bolum===dept)&&statusMatch);if(!row.hidden)visible+=1;});
    const tbody=root.querySelector('tbody'); let emptyRow=root.querySelector('#machine-filter-empty');
    if(!visible && (state().machines||[]).length){if(!emptyRow){emptyRow=document.createElement('tr');emptyRow.id='machine-filter-empty';emptyRow.innerHTML='<td colspan="7"><div class="machine-empty"><strong>Eşleşen tezgâh bulunamadı</strong><span>Arama metnini veya bölüm ve durum filtrelerini değiştirin.</span><button class="btn btn-secondary btn-sm" data-machine-action="clear-filters">Filtreleri temizle</button></div></td>';tbody?.appendChild(emptyRow);}emptyRow.hidden=false;}else if(emptyRow)emptyRow.hidden=true;const resultStatus=root.querySelector('#machine-workspace-results');if(resultStatus)resultStatus.textContent=`${visible} tezgâh gösteriliyor`;
  }

  const applySearchFilters = window.MTBPerformance?.debounce?.(applyFilters, 180) || applyFilters;
  document.addEventListener('input',event=>{if(event.target.id==='machine-workspace-search')applySearchFilters();});
  document.addEventListener('change',event=>{if(['machine-workspace-dept','machine-workspace-status'].includes(event.target.id))applyFilters();});
  document.addEventListener('click',async event=>{
    const summary=event.target.closest('[data-machine-filter]'); if(summary){const select=document.getElementById('machine-workspace-status');if(select){select.value=summary.dataset.machineFilter==='all'?'':summary.dataset.machineFilter;applyFilters();}return;}
    const detailTab=event.target.closest('[data-machine-detail-tab]'); if(detailTab){showDetails(detailTab.dataset.machineId,detailTab.dataset.machineDetailTab);return;}
    const nav=event.target.closest('[data-machine-nav]'); if(nav){window.closeModal?.('machine-workspace-detail');window.navigate?.(nav.dataset.machineNav,{machineId:Number(nav.dataset.machineId)});return;}
    const actionEl=event.target.closest('[data-machine-action]'); if(!actionEl)return;
    const id=Number(actionEl.dataset.machineId); const action=actionEl.dataset.machineAction;
    if(action==='toggle-density'){compactTable=!compactTable;localStorage.setItem('machine-table-density',compactTable?'compact':'comfortable');window.navigate?.('machines');return;}
    if(action==='details')showDetails(id); if(action==='new')window.showNewMachineModal?.(); if(action==='fanuc'){window.closeModal?.('machine-workspace-detail');window.openFanucCenter?.(id);} if(action==='pdf')window.printMachineCard?.(id); if(action==='edit')editDetails(id); if(action==='save-edit')await saveDetails(); if(action==='close-detail')window.closeModal?.('machine-workspace-detail'); if(action==='close-edit')window.closeModal?.('machine-workspace-edit'); if(action==='clear-filters'){const root=document.getElementById('page-machines');if(root){root.querySelector('#machine-workspace-search').value='';root.querySelector('#machine-workspace-dept').value='';root.querySelector('#machine-workspace-status').value='';applyFilters();}}
  });
  document.addEventListener('keydown',event=>{const tab=event.target.closest?.('[role="tab"][data-machine-detail-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=[...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];const index=tabs.indexOf(tab);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;event.preventDefault();tabs[next].focus();tabs[next].click();});

  window.editMachineDetails=editDetails;
  window.saveMachineDetails=saveDetails;
  window.MachineWorkspace=Object.freeze({render,showDetails,machineStatus});
})();
