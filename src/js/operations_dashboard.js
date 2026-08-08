(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);
  const asDate = value => {
    if (!value) return null;
    const parts = String(value).split(/[-./]/);
    const date = parts.length === 3 && parts[0].length !== 4 ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const backupDate = item => item?.son_yedek_tarihi || item?.tarih || item?.date;
  const recordTime = (item, fields) => asDate(fields.map(key => item?.[key]).find(Boolean))?.getTime() || Number(item?.id) || 0;
  const latestPer = (items, keyFor, fields) => {
    const latest = new Map();
    items.forEach(item => {
      const key = keyFor(item);
      const current = latest.get(key);
      if (!current || recordTime(item, fields) >= recordTime(current, fields)) latest.set(key, item);
    });
    return [...latest.values()];
  };
  const indexBackups = items => {
    const byId = new Map();
    const byName = new Map();
    items.forEach(item => {
      const id = item.tezgah_id ?? item.machine_id;
      const name = item.machine || item.machine_name;
      if (id !== undefined && id !== null) {
        const key = String(id);
        if (!byId.has(key)) byId.set(key, []);
        byId.get(key).push(item);
      }
      if (name) {
        const key = String(name).toLocaleLowerCase('tr-TR');
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(item);
      }
    });
    return machine => {
      const machineName = String(machine.numarasi || machine.name || '').toLocaleLowerCase('tr-TR');
      const matched = [...(byId.get(String(machine.id)) || []), ...(byName.get(machineName) || [])];
      return [...new Set(matched)];
    };
  };

  window.renderOperationsBrief = function(app) {
    const now = new Date();
    const openJobs = (app.maintenances || []).filter(item => !/tamam/i.test(item.durum || item.status || ''));
    const currentBatteries = latestPer(app.batteries || [], item => `${item.tezgah_id ?? item.machine_id ?? item.machine ?? item.machine_name ?? ''}|${String(item.eksen || item.axis || 'genel').toLocaleLowerCase('tr-TR')}`, ['tarih','date']);
    const currentFans = latestPer(app.fans || [], item => `${item.tezgah_id ?? item.machine_id ?? item.machine ?? item.machine_name ?? ''}|${String(item.konum || item.location || 'genel').toLocaleLowerCase('tr-TR')}`, ['tarih','date','updatedAt']);
    const criticalBatteries = currentBatteries.filter(item => { const changed = asDate(item.tarih || item.date); return changed && (now - changed) / 86400000 >= 365; });
    const fanWarnings = currentFans.filter(item => 20000 - Number(item.calisma_saati || item.hours || 0) <= 5000);
    const backupsFor = indexBackups(app.backup_logs || []);
    const backupRisk = (app.machines || []).filter(machine => {
      const backups = backupsFor(machine);
      if (!backups.length) return true;
      const latest = backups.map(item => asDate(backupDate(item))).filter(Boolean).sort((a,b) => b-a)[0];
      return !latest || (now - latest) / 86400000 > 180;
    });
    const missingInventory = (app.machines || []).filter(machine => !(machine.moduleInventory || []).length);
    const totalAttention = openJobs.length + criticalBatteries.length + fanWarnings.length + backupRisk.length + missingInventory.length;
    const priority = [
      { icon:'!', title:'Açık bakım işleri', count:openJobs.length, page:'maintenance', tone:openJobs.length ? 'warn' : 'ok', detail:openJobs.length ? 'Tamamlanmayı bekleyen işler' : 'Açık bakım işi yok' },
      { icon:'▰', title:'Kritik pil', count:criticalBatteries.length, page:'battery', tone:criticalBatteries.length ? 'danger' : 'ok', detail:criticalBatteries.length ? 'Değişim zamanı yaklaşan/geçen' : 'Pil kayıtları normal' },
      { icon:'✣', title:'Fan bakım uyarısı', count:fanWarnings.length, page:'battery', tone:fanWarnings.length ? 'warn' : 'ok', detail:'5.000 saat veya daha az kalan' },
      { icon:'↥', title:'Yedek riski', count:backupRisk.length, page:'backup_tracker', tone:backupRisk.length ? 'danger' : 'ok', detail:'Yedeği yok veya 180 günden eski' },
      { icon:'▦', title:'Eksik modül envanteri', count:missingInventory.length, page:'fanuc_center', tone:missingInventory.length ? 'info' : 'ok', detail:'Pano/modül listesi oluşturulmamış' }
    ];
    return `<section class="ops-brief"><div class="ops-brief-head"><div><span>GÜNLÜK OPERASYON ÖZETİ</span><h2>${totalAttention ? `${totalAttention} konu dikkat bekliyor` : 'Bakım durumu normal'}</h2><p>Kritik kayıtlar tek yerde; karta tıklayarak ilgili çalışma ekranına geçin.</p></div><button class="btn btn-secondary btn-sm" data-ops-nav="fanuc_center">FANUC Merkezini Aç</button></div><div class="ops-priority-grid">${priority.map(item => `<button class="ops-priority-card ${item.tone}" data-ops-nav="${item.page}"><span class="ops-priority-icon">${item.icon}</span><span class="ops-priority-copy"><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span><b>${item.count}</b></button>`).join('')}</div></section>`;
  };

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-ops-nav]');
    if (target) window.navigate?.(target.dataset.opsNav);
  });
})();
