(function () {
  'use strict';
  const clean = value => String(value ?? '').replace(/;/g, ',').replace(/[\r\n]+/g, ' ');
  const csv = (head, rows) => [head, ...rows].map(row => row.join(';')).join('\r\n');
  const typeOf = r => r.tur || r.type || (/\[pm\]|periyodik|planli|planlı/.test(String(r.aciklama || r.description || '').toLocaleLowerCase('tr-TR')) ? 'Planlı Bakım' : 'Arıza');
  window.exportMaintenanceCSV = async function () {
    const state = window.State;
    const rows = state.maintenances.map(r => {
      const id = r.tezgah_id || r.machine_id;
      const machine = state.machines.find(m => m.id == id);
      return [r.tarih || r.date, machine?.numarasi || r.tezgah_adi || r.machine_name || `Tezgah #${id}`, typeOf(r), r.aciklama || r.description, r.bakim_yapan || r.technician, r.sure || r.duration].map(clean);
    });
    const result = await window.electronAPI.exportCSV(csv(['Tarih', 'Tezgah', 'Tür', 'Açıklama', 'Teknisyen', 'Süre (dk)'], rows), `bakim_defteri_${new Date().toISOString().slice(0, 10)}.csv`);
    window.showToast?.(result?.ok ? 'CSV başarıyla kaydedildi ✓' : 'CSV kaydedilemedi', result?.ok ? 'success' : 'error');
  };
  window.exportAlarmsCSV = async function () {
    const rows = window.State.alarms.map(a => [a.code, a.category, a.title, a.description, Array.isArray(a.causes) ? a.causes.join(' | ') : a.causes, Array.isArray(a.solutions) ? a.solutions.join(' | ') : a.solution || a.solutions].map(clean));
    const result = await window.electronAPI.exportCSV(csv(['Kod', 'Kategori', 'Başlık', 'Açıklama', 'Olası Nedenler', 'Çözüm Önerileri'], rows), `alarm_veritabani_${new Date().toISOString().slice(0, 10)}.csv`);
    window.showToast?.(result?.ok ? 'Alarm CSV kaydedildi ✓' : 'CSV kaydedilemedi', result?.ok ? 'success' : 'error');
  };
  async function print(kind, id) {
    try {
      const machine = id ? window.State.machines.find(m => m.id == id) : null;
      const card = kind === 'machineCard';
      window.showToast?.(card ? 'Makine kartı hazırlanıyor...' : 'PDF hazırlanıyor...', 'info');
      const html = window.ReportBuilders[kind](id);
      const date = new Date().toISOString().slice(0, 10);
      const name = String(machine?.numarasi || machine?.name || 'tezgah').replace(/\s/g, '_');
      const file = card ? `makine_karti_${name}_${date}.pdf` : machine ? `makine_kart_${name}_${date}.pdf` : `bakim_raporu_${date}.pdf`;
      const result = await window.electronAPI.printToPDF(html, file);
      if (result?.ok) window.showToast?.(`✓ ${card ? 'Makine kartı' : 'PDF'} kaydedildi: ${result.filePath.split('\\').pop()}`, 'success');
      else if (result && result.filePath === undefined) window.showToast?.('PDF iptal edildi', 'info');
      else window.showToast?.(`PDF oluşturulamadı: ${result?.error || ''}`, 'error');
    } catch (error) { window.showToast?.(`PDF hatası: ${error.message}`, 'error'); }
  }
  window.printMaintenanceReport = id => print('maintenance', id);
  window.printMachineCard = id => print('machineCard', id);
})();
