/**
 * PDF Builders
 * Extracted from renderer.js for modular architecture.
 */
(function(global) {
  'use strict';

// ════════════════════════════════════════════════════════════════
//  PDF RAPOR ÜRETICI
// ════════════════════════════════════════════════════════════════

function getPdfBaseStyles() {
  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1f3a; background: #fff; line-height: 1.4; }
      .pdf-page { padding: 20px 24px; }
      @media print {
        body { background: #fff; color: #1a1f3a; }
        .pdf-page { padding: 0; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        .section-title, .kpi-row, .info-grid, .signature-row { page-break-inside: avoid; break-inside: avoid; }
      }
      .pdf-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 14px; border-bottom: 2px solid #2563eb; margin-bottom: 20px; }
      .pdf-logo { display: flex; align-items: center; gap: 10px; }
      .pdf-logo-box { width: 40px; height: 40px; border-radius: 8px; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; font-weight: 800; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .pdf-logo-text .t1 { font-size: 16px; font-weight: 700; color: #1a1f3a; }
      .pdf-logo-text .t2 { font-size: 10px; color: #6b7280; margin-top: 2px; }
      .pdf-meta { text-align: right; font-size: 10px; color: #6b7280; }
      .pdf-meta strong { color: #1a1f3a; font-size: 12px; display: block; margin-bottom: 2px; }
      .pdf-title { font-size: 17px; font-weight: 700; color: #2563eb; margin-bottom: 4px; }
      .pdf-subtitle { font-size: 10.5px; color: #6b7280; margin-bottom: 18px; }
      .section-title { font-size: 12px; font-weight: 700; color: #1a1f3a; background: #f0f4ff; padding: 6px 10px; border-left: 3px solid #2563eb; margin: 16px 0 8px; border-radius: 0 4px 4px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; table-layout: fixed; }
      th { background: #2563eb; color: #fff; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 5px 6px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; }
      td { padding: 5px 6px; border-bottom: 1px solid #e8ecf8; font-size: 10px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; }
      tr:nth-child(even) td { background: #f8f9ff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 9px; font-weight: 600; text-align: center; white-space: nowrap; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .badge-red { background: #fee2e2; color: #dc2626; }
      .badge-green { background: #d1fae5; color: #059669; }
      .badge-amber { background: #fef3c7; color: #d97706; }
      .badge-blue { background: #dbeafe; color: #2563eb; }
      .badge-gray { background: #f1f5f9; color: #64748b; }
      .kpi-row { display: flex; gap: 12px; margin-bottom: 16px; }
      .kpi-box { flex: 1; border: 1px solid #e8ecf8; border-radius: 8px; padding: 12px 14px; border-top: 3px solid #2563eb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .kpi-box.green { border-top-color: #059669; }
      .kpi-box.red { border-top-color: #dc2626; }
      .kpi-box.amber { border-top-color: #d97706; }
      .kpi-num { font-size: 24px; font-weight: 700; color: #1a1f3a; line-height: 1; }
      .kpi-lbl { font-size: 9.5px; color: #6b7280; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
      .info-item { padding: 8px 10px; background: #f8f9ff; border-radius: 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .info-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; margin-bottom: 3px; }
      .info-value { font-size: 11px; color: #1a1f3a; font-weight: 500; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; }
      .pdf-footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e8ecf8; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; }
      .signature-row { display: flex; gap: 40px; margin-top: 30px; }
      .signature-box { flex: 1; border-top: 1px solid #1a1f3a; padding-top: 6px; font-size: 9.5px; color: #6b7280; }
    </style>
  `;
}

function buildMaintenanceReportHTML(filters = {}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR');
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Helper function to safely parse Turkish/standard date formats for sorting
  const parseMaintDate = (dStr) => {
    if (!dStr) return new Date(0);
    const parts = dStr.split(/[\.-]/);
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dStr);
  };

  // Helper function to dynamically identify maintenance record type
  const getRecordType = (r) => {
    let type = r.tur || r.type;
    if (!type) {
      const desc = (r.aciklama || r.description || '').toLowerCase();
      if (desc.includes('[pm]') || desc.includes('periyodik') || desc.includes('planli') || desc.includes('planlı')) {
        type = 'Planlı Bakım';
      } else {
        type = 'Arıza';
      }
    }
    return type;
  };

  // Helper function to resolve machine name
  const getMachineName = (r) => {
    const mach = State.machines.find(x => x.id == (r.tezgah_id || r.machine_id));
    return mach ? mach.numarasi : (r.tezgah_adi || r.machine_name || `Tezgah #${r.tezgah_id || r.machine_id}`);
  };

  let records = [...State.maintenances];
  if (filters.machineId) records = records.filter(r => r.tezgah_id == filters.machineId || r.machine_id == filters.machineId);
  if (filters.startDate) {
    const sd = parseDateHelper(filters.startDate);
    records = records.filter(r => parseDateHelper(r.tarih || r.date) >= sd);
  }
  if (filters.endDate) {
    const ed = parseDateHelper(filters.endDate);
    records = records.filter(r => parseDateHelper(r.tarih || r.date) <= ed);
  }

  // Sort by parsed date descending
  records.sort((a, b) => parseMaintDate(b.tarih || b.date) - parseMaintDate(a.tarih || a.date));

  const totalFault = records.filter(r => getRecordType(r) === 'Arıza').length;
  const totalPM = records.filter(r => getRecordType(r) !== 'Arıza').length;
  const machines = [...new Set(records.map(r => getMachineName(r)))].filter(Boolean);

  const selectedMachine = filters.machineId
    ? (State.machines.find(m => m.id == filters.machineId) || {})
    : null;

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
    <title>Bakım Defteri Raporu</title>${getPdfBaseStyles()}</head><body>
    <div class="pdf-page">

      <div class="pdf-header">
        <div class="pdf-logo">
          <div class="pdf-logo-box">M</div>
          <div class="pdf-logo-text">
            <div class="t1">MTB Elektrik Bakım</div>
            <div class="t2">CNC Bakım & Teşhis Platformu</div>
          </div>
        </div>
        <div class="pdf-meta">
          <strong>Bakım Defteri Raporu</strong>
          Oluşturma: ${dateStr} ${timeStr}<br>
          Hazırlayan: ${State.currentUser ? escapeHTML(State.currentUser.name) : 'Misafir'}
        </div>
      </div>

      <div class="pdf-title">🔧 Bakım Defteri Raporu</div>
      <div class="pdf-subtitle">
        ${selectedMachine ? (selectedMachine.numarasi || selectedMachine.name) + ' — ' : 'Tüm Tezgahlar — '}
        ${records.length} kayıt
      </div>

      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-num">${records.length}</div>
          <div class="kpi-lbl">Toplam Kayıt</div>
        </div>
        <div class="kpi-box red">
          <div class="kpi-num">${totalFault}</div>
          <div class="kpi-lbl">Arıza Müdahale</div>
        </div>
        <div class="kpi-box green">
          <div class="kpi-num">${totalPM}</div>
          <div class="kpi-lbl">Planlı Bakım</div>
        </div>
        <div class="kpi-box amber">
          <div class="kpi-num">${machines.length}</div>
          <div class="kpi-lbl">Tezgah Sayısı</div>
        </div>
      </div>

      <div class="section-title">Bakım Kayıtları</div>
      <table>
        <thead>
          <tr>
            <th style="width:14%">Tarih</th>
            <th style="width:14%">Tezgah</th>
            <th style="width:15%">Tür</th>
            <th style="width:34%">Açıklama</th>
            <th style="width:15%">Teknisyen</th>
            <th style="width:8%">Süre</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => {
            const tur = getRecordType(r);
            const badgeCls = tur === 'Arıza' ? 'badge-red' : tur === 'Planlı Bakım' ? 'badge-green' : 'badge-blue';
            return `<tr>
              <td class="font-mono">${r.tarih || r.date || '—'}</td>
              <td>${getMachineName(r)}</td>
              <td><span class="badge ${badgeCls}">${tur || '—'}</span></td>
              <td>${r.aciklama || r.description || '—'}</td>
              <td>${r.bakim_yapan || r.technician || '—'}</td>
              <td>${r.sure || r.duration ? (r.sure || r.duration) + ' dk' : '—'}</td>
            </tr>`;
          }).join('')}
          ${!records.length ? '<tr><td colspan="6" style="text-align:center; color:#9ca3af; padding:20px">Kayıt bulunamadı</td></tr>' : ''}
        </tbody>
      </table>

      <div class="signature-row">
        <div class="signature-box">Hazırlayan: ${State.currentUser ? escapeHTML(State.currentUser.name) : 'Misafir'}<br><br></div>

        <div class="signature-box">Onaylayan:<br><br></div>
        <div class="signature-box">Tarih: ${dateStr}<br><br></div>
      </div>

      <div class="pdf-footer">
        <span>MTB Elektrik Bakım — Otomatik Oluşturulan Rapor</span>
        <span>${dateStr} ${timeStr}</span>
      </div>
    </div>
  </body></html>`;
}

function buildMachineCardHTML(machineId) {
  const m = State.machines.find(x => x.id === machineId);
  if (!m) return '<html><body>Tezgah bulunamadı.</body></html>';

  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR');
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Helper functions
  const parseMaintDate = (dStr) => {
    if (!dStr) return new Date(0);
    const parts = dStr.split(/[\.-]/);
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dStr);
  };

  const getRecordType = (r) => {
    let type = r.tur || r.type;
    if (!type) {
      const desc = (r.aciklama || r.description || '').toLowerCase();
      if (desc.includes('[pm]') || desc.includes('periyodik') || desc.includes('planli') || desc.includes('planlı')) {
        type = 'Planlı Bakım';
      } else {
        type = 'Arıza';
      }
    }
    return type;
  };

  const machMaint = State.maintenances.filter(r =>
    r.tezgah_id === m.id || r.machine_id === m.id ||
    r.tezgah_adi === m.numarasi || r.machine_name === m.numarasi
  ).sort((a, b) => parseMaintDate(b.tarih || b.date) - parseMaintDate(a.tarih || a.date));

  const machBatt = State.batteries.filter(b => b.tezgah_id === m.id || b.machine === m.numarasi);
  const machFans = State.fans.filter(f => f.tezgah_id === m.id || f.machine === m.numarasi);

  const totalFault = machMaint.filter(r => getRecordType(r) === 'Arıza').length;
  const lastMaint = machMaint[0];

  const critBatt = machBatt.filter(b => {
    const d = parseDateHelper(b.tarih || b.lastChanged);
    if (!d || d.getTime() === 0) return false;
    const age = (now - d) / (1000 * 60 * 60 * 24 * 30);
    return age >= 12;
  });

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
    <title>Makine Kartı — ${m.numarasi || m.name}</title>${getPdfBaseStyles()}</head><body>
    <div class="pdf-page">

      <div class="pdf-header">
        <div class="pdf-logo">
          <div class="pdf-logo-box">M</div>
          <div class="pdf-logo-text">
            <div class="t1">MTB Elektrik Bakım</div>
            <div class="t2">CNC Bakım & Teşhis Platformu</div>
          </div>
        </div>
        <div class="pdf-meta">
          <strong>Makine Kartı</strong>
          Oluşturma: ${dateStr} ${timeStr}<br>
          Hazırlayan: ${State.currentUser ? escapeHTML(State.currentUser.name) : 'Misafir'}
        </div>
      </div>

      <div class="pdf-title">🏭 Makine Kartı — ${m.numarasi || m.name || '—'}</div>
      <div class="pdf-subtitle">${m.marka || m.brand || ''} ${m.model || ''} · Seri No: ${m.seri_no || m.serial || '—'}</div>

      <div class="kpi-row">
        <div class="kpi-box">
          <div class="kpi-num">${machMaint.length}</div>
          <div class="kpi-lbl">Toplam Bakım</div>
        </div>
        <div class="kpi-box red">
          <div class="kpi-num">${totalFault}</div>
          <div class="kpi-lbl">Arıza</div>
        </div>
        <div class="kpi-box ${critBatt.length > 0 ? 'red' : 'green'}">
          <div class="kpi-num">${critBatt.length}</div>
          <div class="kpi-lbl">Kritik Pil</div>
        </div>
        <div class="kpi-box amber">
          <div class="kpi-num">${machFans.length}</div>
          <div class="kpi-lbl">Fan Kaydı</div>
        </div>
      </div>

      <div class="section-title">Tezgah Bilgileri</div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Tezgah No / Adı</div><div class="info-value">${m.numarasi || m.name || '—'}</div></div>
        <div class="info-item"><div class="info-label">Marka / Model</div><div class="info-value">${m.marka || m.brand || '—'} ${m.model || ''}</div></div>
        <div class="info-item"><div class="info-label">Seri No</div><div class="info-value">${m.seri_no || m.serial || '—'}</div></div>
        <div class="info-item"><div class="info-label">FANUC Kontrol</div><div class="info-value">${m.fanuc || m.control || '—'}</div></div>
        <div class="info-item"><div class="info-label">Bölüm</div><div class="info-value">${m.bolum || m.department || '—'}</div></div>
        <div class="info-item"><div class="info-label">Tezgah Tipi</div><div class="info-value">${m.tip || m.type || '—'}</div></div>
        <div class="info-item"><div class="info-label">Son Bakım</div><div class="info-value">${lastMaint ? (lastMaint.tarih || lastMaint.date) : '—'}</div></div>
        <div class="info-item"><div class="info-label">Devreye Giriş</div><div class="info-value">${m.devreye_tarihi || m.installDate || '—'}</div></div>
      </div>

      <div class="section-title">Son Bakım Kayıtları (En Yeni 10)</div>
      <table>
        <thead>
          <tr>
            <th style="width:15%">Tarih</th>
            <th style="width:15%">Tür</th>
            <th style="width:50%">Açıklama</th>
            <th style="width:20%">Teknisyen</th>
          </tr>
        </thead>
        <tbody>
          ${machMaint.slice(0, 10).map(r => {
            const tur = getRecordType(r);
            const badgeCls = tur === 'Arıza' ? 'badge-red' : 'badge-green';
            return `<tr>
              <td>${r.tarih || r.date || '—'}</td>
              <td><span class="badge ${badgeCls}">${tur || '—'}</span></td>
              <td>${r.aciklama || r.description || '—'}</td>
              <td>${r.bakim_yapan || r.technician || '—'}</td>
            </tr>`;
          }).join('')}
          ${!machMaint.length ? '<tr><td colspan="4" style="text-align:center; color:#9ca3af; padding:16px">Bakım kaydı yok</td></tr>' : ''}
        </tbody>
      </table>

      ${machBatt.length ? `
        <div class="section-title">Pil Takip Durumu</div>
        <table>
          <thead>
            <tr>
              <th style="width:15%">Eksen</th>
              <th style="width:20%">Pil Modeli</th>
              <th style="width:20%">Son Değişim</th>
              <th style="width:25%">Yapan</th>
              <th style="width:20%">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${machBatt.map(b => {
              const d = parseDateHelper(b.tarih || b.lastChanged);
              let status = '✓ Normal', badgeCls = 'badge-green';
              if (d && d.getTime() > 0) {
                const months = (now - d) / (1000 * 60 * 60 * 24 * 30);
                if (months >= 12) { status = '⚠ Değişim Gerekli'; badgeCls = 'badge-red'; }
                else if (months >= 10) { status = '! Yaklaşıyor'; badgeCls = 'badge-amber'; }
              }
              return `<tr>
                <td>${b.eksen || b.axis || '—'}</td>
                <td>${b.pil_modeli || b.model || '—'}</td>
                <td>${b.tarih || b.lastChanged || '—'}</td>
                <td>${b.bakim_yapan || b.technician || '—'}</td>
                <td><span class="badge ${badgeCls}">${status}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      ` : ''}

      <div class="signature-row">
        <div class="signature-box">Hazırlayan: ${State.currentUser ? escapeHTML(State.currentUser.name) : 'Misafir'}<br><br></div>

        <div class="signature-box">Onaylayan:<br><br></div>
        <div class="signature-box">Tarih: ${dateStr}<br><br></div>
      </div>

      <div class="pdf-footer">
        <span>MTB Elektrik Bakım — Makine Kartı</span>
        <span>${dateStr} ${timeStr}</span>
      </div>
    </div>
  </body></html>`;
}

window.ReportBuilders = Object.freeze({
  maintenance: machineId => buildMaintenanceReportHTML(machineId ? { machineId } : {}),
  machineCard: machineId => buildMachineCardHTML(machineId)
});


  const MTBPdfBuilders = {
    getPdfBaseStyles: typeof getPdfBaseStyles !== 'undefined' ? getPdfBaseStyles : undefined,
    buildMaintenanceReportHTML: typeof buildMaintenanceReportHTML !== 'undefined' ? buildMaintenanceReportHTML : undefined,
    buildMachineCardHTML: typeof buildMachineCardHTML !== 'undefined' ? buildMachineCardHTML : undefined
  };

  global.MTBPdfBuilders = MTBPdfBuilders;
  if (typeof getPdfBaseStyles !== 'undefined') global.getPdfBaseStyles = getPdfBaseStyles;
  if (typeof buildMaintenanceReportHTML !== 'undefined') global.buildMaintenanceReportHTML = buildMaintenanceReportHTML;
  if (typeof buildMachineCardHTML !== 'undefined') global.buildMachineCardHTML = buildMachineCardHTML;
})(window);
