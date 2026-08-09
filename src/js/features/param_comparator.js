/**
 * Param Comparator
 * Extracted from renderer.js for modular architecture.
 * Auto-generated — do not hand-edit without updating renderer.js delegation.
 */
(function MTBParamComparator(global) {
  'use strict';

function renderParamComparator() {
  const page = createPage('param_comparator');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>📁 CNC Parametre Karşılaştırma & Side-by-Side Diff Engine</h1>
          <p>İki ayrı FANUC parametre yedeğini yan yana karşılaştırın, bit seviyesinde değişiklikleri ve kritik eksen farklarını tespit edin</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" onclick="compareParameterFiles()">
            ⚡ Farkları Analiz Et
          </button>
          <button class="btn btn-secondary btn-sm" onclick="loadDefaultParamDiff()">
            🔄 Örnek Veri Yükle
          </button>
        </div>
      </div>
    </div>

    <div class="page-body">

      <!-- Hidden file inputs -->
      <input type="file" id="param-file-a-input" style="display:none" onchange="uploadParamFile('a')" accept=".txt,.cnm,.dat,.nc,.par,.all,.prm" />
      <input type="file" id="param-file-b-input" style="display:none" onchange="uploadParamFile('b')" accept=".txt,.cnm,.dat,.nc,.par,.all,.prm" />

      <!-- Side-by-Side File Input Cards -->
      <div class="grid-2 mb-4" style="grid-template-columns: 1fr 1fr; gap:16px">

        <!-- File Input A (Reference) -->
        <div class="card" style="padding:16px; display:flex; flex-direction:column; gap:10px">
          <div class="flex justify-between items-center">
            <div class="card-title" style="display:flex; align-items:center; gap:8px">
              <span style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block"></span>
              <span>📋 Yedek A (Referans / Orijinal Ayarlar)</span>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-secondary btn-sm" onclick="document.getElementById('param-file-a-input').click()">📁 Dosya Seç</button>
              <button class="btn btn-ghost btn-sm" onclick="clearParamInput('a')" title="Temizle">🗑️</button>
            </div>
          </div>

          <div id="dropzone-a" class="dropzone-box" style="border: 2px dashed var(--border); border-radius: var(--radius-md); padding: 10px; text-align: center; background: var(--bg-card2); transition: border-color 0.2s;"
               ondragover="handleParamDragOver(event, 'a')" ondragleave="handleParamDragLeave(event, 'a')" ondrop="handleParamDrop(event, 'a')">
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px">Dosyayı buraya sürükleyip bırakın veya metni aşağıya yapıştırın</div>
            <textarea class="form-control" id="pmc-file-a" rows="7" placeholder="PRM 1815 = 00110000 veya 1815 00110000..." style="font-family:var(--font-mono); font-size:11px; background:#0b0f19; color:#34d399; line-height:1.4; resize:vertical">1001 00001000
1320 500000
1321 -500000
1815 00110000
1851 12</textarea>
          </div>
        </div>

        <!-- File Input B (Target) -->
        <div class="card" style="padding:16px; display:flex; flex-direction:column; gap:10px">
          <div class="flex justify-between items-center">
            <div class="card-title" style="display:flex; align-items:center; gap:8px">
              <span style="width:10px; height:10px; border-radius:50%; background:#f59e0b; display:inline-block"></span>
              <span>📋 Yedek B (Karşılaştırılan / Yeni Ayarlar)</span>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-secondary btn-sm" onclick="document.getElementById('param-file-b-input').click()">📁 Dosya Seç</button>
              <button class="btn btn-ghost btn-sm" onclick="clearParamInput('b')" title="Temizle">🗑️</button>
            </div>
          </div>

          <div id="dropzone-b" class="dropzone-box" style="border: 2px dashed var(--border); border-radius: var(--radius-md); padding: 10px; text-align: center; background: var(--bg-card2); transition: border-color 0.2s;"
               ondragover="handleParamDragOver(event, 'b')" ondragleave="handleParamDragLeave(event, 'b')" ondrop="handleParamDrop(event, 'b')">
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px">Dosyayı buraya sürükleyip bırakın veya metni aşağıya yapıştırın</div>
            <textarea class="form-control" id="pmc-file-b" rows="7" placeholder="PRM 1815 = 00100000 veya 1815 00100000..." style="font-family:var(--font-mono); font-size:11px; background:#0b0f19; color:#fbbf24; line-height:1.4; resize:vertical">1001 00001000
1320 450000
1321 -500000
1815 00100000
1851 25
9999 1</textarea>
          </div>
        </div>

      </div>

      <!-- Diff Summary KPI Cards (Hidden initially) -->
      <div id="diff-kpi-summary" class="stats-grid mb-4" style="display:none; grid-template-columns: repeat(4, 1fr); gap:12px">
        <div class="stat-card amber" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-diff-changed" style="color:#fbbf24; font-size:22px">0</div>
            <div class="stat-label">Değişen Parametre</div>
          </div>
        </div>
        <div class="stat-card green" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-diff-added" style="color:#34d399; font-size:22px">0</div>
            <div class="stat-label">Yeni Eklendi</div>
          </div>
        </div>
        <div class="stat-card red" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-diff-removed" style="color:#f87171; font-size:22px">0</div>
            <div class="stat-label">Silindi / Eksik</div>
          </div>
        </div>
        <div class="stat-card purple" style="padding:12px 16px">
          <div class="stat-data">
            <div class="stat-value" id="kpi-diff-critical" style="color:#a78bfa; font-size:22px">0</div>
            <div class="stat-label">Kritik Bit Uyarısı</div>
          </div>
        </div>
      </div>

      <!-- Diff Results View Card -->
      <div class="card" style="padding:20px; display:none" id="pmc-diff-card">
        <div class="flex items-center justify-between mb-3" style="flex-wrap:wrap; gap:10px">
          <div class="card-title" style="display:flex; align-items:center; gap:10px">
            <span>📊 Side-by-Side Değişiklik Tablosu</span>
            <span id="diff-total-badge" class="tag tag-blue" style="font-size:11px">0 Fark</span>
          </div>

          <!-- Filters and Search -->
          <div class="flex gap-2" style="align-items:center">
            <input type="text" id="diff-search-input" class="form-control" placeholder="Parametre no veya isim ara..." style="width:200px; padding:4px 8px; font-size:11.5px" oninput="filterDiffRows()" />
            <button class="btn btn-ghost btn-sm" onclick="filterDiffMode('all')" id="btn-diff-all" style="color:var(--text-accent); font-weight:bold">Tümü</button>
            <button class="btn btn-ghost btn-sm" onclick="filterDiffMode('critical')" id="btn-diff-critical">⚠️ Kritikler</button>
            <button class="btn btn-secondary btn-sm" onclick="exportDiffPDF()">🖨️ PDF Rapor</button>
            <button class="btn btn-secondary btn-sm" onclick="exportDiffCSV()">📊 CSV İndir</button>
          </div>
        </div>

        <div style="overflow-x:auto">
          <table class="data-table" style="font-size:11.5px">
            <thead>
              <tr>
                <th style="width:110px">Parametre No</th>
                <th>Parametre Tanımı & Bit Detayı</th>
                <th style="width:160px; background:rgba(16,185,129,0.08)">Yedek A (Referans)</th>
                <th style="width:160px; background:rgba(245,158,11,0.08)">Yedek B (Yeni)</th>
                <th style="width:100px">Fark Durumu</th>
              </tr>
            </thead>
            <tbody id="pmc-diff-tbody"></tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  setTimeout(() => compareParameterFiles(), 50);

  return page;
}

window.handleParamDragOver = function(e, type) {
  e.preventDefault();
  const dz = document.getElementById(`dropzone-${type}`);
  if (dz) dz.style.borderColor = 'var(--accent)';
};

window.handleParamDragLeave = function(e, type) {
  e.preventDefault();
  const dz = document.getElementById(`dropzone-${type}`);
  if (dz) dz.style.borderColor = 'var(--border)';
};

window.handleParamDrop = function(e, type) {
  e.preventDefault();
  const dz = document.getElementById(`dropzone-${type}`);
  if (dz) dz.style.borderColor = 'var(--border)';
  if (e.dataTransfer && e.dataTransfer.files.length) {
    const file = e.dataTransfer.files[0];
    const reader = new FileReader();
    reader.onload = function(evt) {
      document.getElementById(`pmc-file-${type}`).value = evt.target.result;
      showToast(`Dosya ${type.toUpperCase()} yüklendi: ${file.name}`, 'success');
      compareParameterFiles();
    };
    reader.readAsText(file);
  }
};

window.clearParamInput = function(type) {
  document.getElementById(`pmc-file-${type}`).value = '';
  showToast(`Yedek ${type.toUpperCase()} temizlendi.`, 'info');
};

window.uploadParamFile = function(type) {
  const input = document.getElementById(`param-file-${type}-input`);
  if (!input || !input.files.length) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById(`pmc-file-${type}`).value = e.target.result;
    showToast(`Dosya ${type.toUpperCase()} başarıyla yüklendi ✓`, 'success');
  };
  reader.readAsText(file);
};

window.loadDefaultParamDiff = function() {
  document.getElementById('pmc-file-a').value = `1001 00001000\n1320 500000\n1321 -500000\n1815 00110000\n1851 12`;
  document.getElementById('param-file-a-input').value = '';
  document.getElementById('pmc-file-b').value = `1001 00001000\n1320 450000\n1321 -500000\n1815 00100000\n1851 25\n9999 1`;
  document.getElementById('param-file-b-input').value = '';
};

window.compareParameterFiles = function() {
  const textA = document.getElementById('pmc-file-a')?.value || '';
  const textB = document.getElementById('pmc-file-b')?.value || '';
  const diffCard = document.getElementById('pmc-diff-card');
  const kpiCard = document.getElementById('diff-kpi-summary');
  const tbody = document.getElementById('pmc-diff-tbody');

  if (!diffCard || !tbody) return;

  const parseParams = (txt) => {
    const map = {};
    const lines = txt.split('\n');
    lines.forEach(l => {
      // support both "1815 00110000" and standard Fanuc "PRM 1815 = 00110000" formats
      const clean = l.replace(/PRM/gi, '').replace(/=/g, ' ').trim();
      const parts = clean.split(/\s+/);
      if (parts.length >= 2) {
        const no = parseInt(parts[0]);
        if (!isNaN(no)) {
          map[no] = parts[1];
        }
      }
    });
    return map;
  };

  const paramsA = parseParams(textA);
  const paramsB = parseParams(textB);

  const allKeys = Array.from(new Set([...Object.keys(paramsA), ...Object.keys(paramsB)])).map(Number).sort((a,b)=>a-b);
  const diffs = [];

  let countChanged = 0;
  let countAdded = 0;
  let countRemoved = 0;
  let countCritical = 0;

  allKeys.forEach(no => {
    const valA = paramsA[no];
    const valB = paramsB[no];

    if (valA !== valB) {
      let status = 'Değişti';
      let colorClass = 'tag-orange';
      if (valA === undefined) {
        status = 'Eklendi';
        colorClass = 'tag-green';
        countAdded++;
      } else if (valB === undefined) {
        status = 'Silindi';
        colorClass = 'tag-red';
        countRemoved++;
      } else {
        countChanged++;
      }

      // Check if parameter is critical (1815, 1320, 1321, 3111, 3202, 1006)
      const isCritical = [1815, 1320, 1321, 3111, 3202, 1006, 1001, 1002].includes(no);
      if (isCritical) countCritical++;

      // Lookup description in State.parameters
      const dbParam = State.parameters.find(p => p.no === no);
      const desc = dbParam ? `${dbParam.name} - ${dbParam.description}` : 'Bilinmeyen Sistem Parametresi';

      diffs.push({
        no,
        desc,
        valA: valA !== undefined ? valA : '—',
        valB: valB !== undefined ? valB : '—',
        status,
        colorClass,
        isCritical
      });
    }
  });

  window.CurrentDiffs = diffs;

  // Update KPI summary cards
  if (kpiCard) {
    kpiCard.style.display = 'grid';
    const elChanged = document.getElementById('kpi-diff-changed');
    const elAdded = document.getElementById('kpi-diff-added');
    const elRemoved = document.getElementById('kpi-diff-removed');
    const elCritical = document.getElementById('kpi-diff-critical');
    const badgeTotal = document.getElementById('diff-total-badge');

    if (elChanged) animateCounter(elChanged, countChanged);
    if (elAdded) animateCounter(elAdded, countAdded);
    if (elRemoved) animateCounter(elRemoved, countRemoved);
    if (elCritical) animateCounter(elCritical, countCritical);
    if (badgeTotal) badgeTotal.textContent = `${diffs.length} Fark Tespiti`;
  }

  diffCard.style.display = 'block';
  renderDiffTableRows(diffs);
};

function renderDiffTableRows(diffsList) {
  const tbody = document.getElementById('pmc-diff-tbody');
  if (!tbody) return;

  if (!diffsList.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--green)">
      ✔️ Seçilen filtre ölçütlerine uygun hiçbir fark bulunamadı. Değerler eşleşmektedir.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = diffsList.map(d => {
    let cellStyle = '';
    // Special highlight for Parameter 1815 APZ bit change!
    if (d.no === 1815 && d.valA.length === 8 && d.valB.length === 8) {
      if (d.valA[3] !== d.valB[3]) {
        cellStyle = 'background:rgba(239,68,68,0.08); font-weight:bold';
      }
    } else if (d.isCritical) {
      cellStyle = 'background:rgba(245,158,11,0.04)';
    }

    // Binary bit differential analysis helper
    const bitDiffsHtml = getBitDifferenceDetails(d.no, d.valA, d.valB);

    return `
      <tr class="${d.isCritical ? 'diff-critical' : ''}" style="${cellStyle}">
        <td>
          <strong class="font-mono" style="font-size:12px; color:var(--text-accent)">#${d.no}</strong>
          ${d.isCritical ? '<span style="font-size:9px; background:rgba(239,68,68,0.18); color:#f87171; padding:1px 4px; border-radius:3px; margin-left:4px">KRİTİK</span>' : ''}
        </td>
        <td>
          <div style="font-size:12px; color:var(--text-primary); font-weight:600">${escapeHTML(d.desc)}</div>
          ${bitDiffsHtml}
        </td>
        <td style="background:rgba(16,185,129,0.04)"><span class="font-mono" style="color:#34d399; font-size:12px">${escapeHTML(d.valA)}</span></td>
        <td style="background:rgba(245,158,11,0.04)"><span class="font-mono" style="color:#fbbf24; font-size:12px; font-weight:bold">${escapeHTML(d.valB)}</span></td>
        <td><span class="tag ${d.colorClass}">${d.status}</span></td>
      </tr>
    `;
  }).join('');
}

window.filterDiffRows = function() {
  const q = (document.getElementById('diff-search-input')?.value || '').toLowerCase().trim();
  const diffs = window.CurrentDiffs || [];
  const filtered = diffs.filter(d =>
    !q || String(d.no).includes(q) || d.desc.toLowerCase().includes(q)
  );
  renderDiffTableRows(filtered);
};

window.filterDiffMode = function(mode) {
  const diffs = window.CurrentDiffs || [];
  const btnAll = document.getElementById('btn-diff-all');
  const btnCrit = document.getElementById('btn-diff-critical');

  if (btnAll && btnCrit) {
    btnAll.style.color = mode === 'all' ? 'var(--text-accent)' : 'var(--text-secondary)';
    btnAll.style.fontWeight = mode === 'all' ? 'bold' : 'normal';
    btnCrit.style.color = mode === 'critical' ? 'var(--text-accent)' : 'var(--text-secondary)';
    btnCrit.style.fontWeight = mode === 'critical' ? 'bold' : 'normal';
  }

  if (mode === 'critical') {
    renderDiffTableRows(diffs.filter(d => d.isCritical));
  } else {
    renderDiffTableRows(diffs);
  }
};

window.exportDiffPDF = function() {
  const diffs = window.CurrentDiffs || [];
  if (!diffs.length) {
    showToast('Dışa aktarılacak bir fark tespiti yok.', 'warning');
    return;
  }
  window.print();
};

window.exportDiffCSV = function() {
  const diffs = window.CurrentDiffs || [];
  if (!diffs.length) {
    showToast('Dışa aktarılacak parametre farkı bulunamadı.', 'warning');
    return;
  }

  let csvContent = '\uFEFF';
  csvContent += 'Parametre No;Parametre Tanimi;Yedek A (Eski);Yedek B (Yeni);Fark Durumu;Kritik Sinyal\n';

  diffs.forEach(d => {
    const cleanDesc = (d.desc || '').replace(/;/g, ',');
    csvContent += `${d.no};"${cleanDesc}";"${d.valA}";"${d.valB}";"${d.status}";"${d.isCritical ? 'KRITIK' : 'Normal'}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `fanuc-param-diff-${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Parametre fark raporu CSV olarak indirildi (Excel Uyumlu) ✓', 'success');
};

window.loadPresetBackupForDiff = function(target, presetId) {
  const area = document.getElementById(`pmc-file-${target}`);
  if (!area) return;

  if (presetId === 'factory_default') {
    area.value = `1001 00001000\n1002 00000000\n1006 00000000\n1320 500000\n1321 -500000\n1815 00110000\n1851 10\n3111 00000001\n3202 00010001`;
  } else if (presetId === 'modified_site') {
    area.value = `1001 00001000\n1002 00000000\n1006 00000000\n1320 450000\n1321 -500000\n1815 00100000\n1851 25\n3111 00000001\n3202 00000001`;
  }
  showToast(`Örnek ${presetId} yedeği ${target.toUpperCase()} alanına aktarıldı.`, 'info');
  compareParameterFiles();
};

function getBitDifferenceDetails(no, valA, valB) {
  if (valA.length !== 8 || valB.length !== 8 || !/^[01]+$/.test(valA) || !/^[01]+$/.test(valB)) {
    return '';
  }

  const bitDescriptions = {
    1815: {
      5: "APC (Mutlak Enkoder Aktif/Pasif)",
      4: "APZ (Referans Pozisyonu Senkronize)"
    },
    1006: {
      0: "ROT (Lineer/Dairesel Eksen Tipi Seçimi)",
      3: "DIA (Çap/Yarıçap Programlama Seçimi)",
      5: "ZMI (Manuel Referansa Dönüş Hareketi Yönü)"
    },
    3111: {
      0: "SVS (Servo Ayar ve Tuning Ekranı Gösterimi)",
      1: "SPS (Spindle Tuning Ekranı Gösterimi)",
      5: "OPS (Operatör Geçmişi İzleme Kaydı)",
      6: "OPH (Operatör Geçmişi Ekranı Gösterimi)",
      7: "NPA (Alarm Ekranı Geçişi / Otomatik Sayfa Değişimi)"
    },
    3202: {
      0: "NE8 (8000-8999 Program Kilidi / Koruma Durumu)",
      4: "NE9 (9000-9999 Program Kilidi / Koruma Durumu)"
    },
    1001: {
      0: "INM (Metrik/İnç Taban Ölçü Sistemi Seçimi)"
    },
    1002: {
      0: "JAX (Aynı Anda Manuel Hareketi Destekleyen Eksen Sayısı)",
      1: "DLZ (Decel Switch'siz Referans Noktası Bulma)",
      7: "IDG (Absolute Enkoder Referans Sıfırlama İnhibisyonu)"
    }
  };

  let rows = '';
  const bitStrip = `<div class="bit-diff" aria-label="8 bit karşılaştırması">${Array.from({length:8},(_,index)=>{ const bit=7-index; const changed=valA[index]!==valB[index]; return `<span class="${changed?'changed':''}" title="Bit ${bit}: ${valA[index]} → ${valB[index]}">${valB[index]}</span>`; }).join('')}</div>`;
  for (let bit = 7; bit >= 0; bit--) {
    const charA = valA[7 - bit];
    const charB = valB[7 - bit];
    if (charA !== charB) {
      const bitDesc = (bitDescriptions[no] && bitDescriptions[no][bit]) || `Genel Bit ${bit}`;
      rows += `
        <div style="padding: 4px 10px; display: flex; justify-content: space-between; font-size: 11px; border-bottom: 1px dashed var(--border)">
          <span style="color:var(--text-accent); font-family:monospace">Bit ${bit}: ${bitDesc}</span>
          <span>
            <span style="color:var(--red); font-family:monospace">${charA}</span>
            ➔
            <span style="color:var(--green); font-family:monospace; font-weight:bold">${charB}</span>
          </span>
        </div>
      `;
    }
  }

  if (!rows) return '';
  return `
    <div style="background:var(--bg-card2); border-left: 3px solid var(--accent); padding: 8px; margin: 6px 0 10px 0; border-radius: var(--radius-sm)">
      <strong style="font-size:10px; text-transform:uppercase; color:var(--text-accent)">Değişen Bitlerin Analizi:</strong>
      ${bitStrip}
      ${rows}
    </div>
  `;
}


  // ── Global Exports ──
  global.renderParamComparator = renderParamComparator;
  global.renderDiffTableRows = renderDiffTableRows;
  global.getBitDifferenceDetails = getBitDifferenceDetails;
})(window);
