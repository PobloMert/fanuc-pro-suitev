/**
 * MTB Elektrik Bakım — FANUC Pro Suite
 * FANUC .PRM / .TXT Parameter Backup File Inspector Feature
 */

(function(global) {
  'use strict';

  let currentParsedParams = [];
  let selectedParamNo = null;

  function createPage(id) {
    const el = document.createElement('div');
    el.id = `page-${id}`;
    el.className = 'page';
    return el;
  }

  function getParamDbDesc(no) {
    if (!window.State || !window.State.parameters) return 'Sistem Parametresi';
    const match = window.State.parameters.find(p => p.no == no);
    if (!match) return 'FANUC Sistem Parametresi';
    return `${match.name} — ${match.description}`;
  }

  function getParamCategory(no, value) {
    const n = parseInt(no, 10);
    if ([1815, 3202, 3111, 1006, 1001, 1002, 3000].includes(n) || /^[01]{8}$/.test(String(value).trim())) return 'binary';
    if ([1320, 1321, 1420, 1851, 1825, 2084, 2085].includes(n)) return 'axis';
    if ([3201, 3202, 3204, 3210, 3211].includes(n)) return 'protection';
    if ([0, 2, 20, 101, 102, 103, 111, 112, 113].includes(n)) return 'comm';
    return 'general';
  }

  function isCriticalParam(no) {
    const n = parseInt(no, 10);
    return [1815, 1320, 1321, 3111, 3202, 1851, 1006, 4002, 4003].includes(n);
  }

  function renderParamInspector() {
    const page = createPage('param_inspector');

    page.innerHTML = `
      <div class="page-header flex justify-between items-center mb-4" style="flex-wrap:wrap; gap:12px;">
        <div>
          <h1 class="page-title" style="display:flex; align-items:center; gap:8px;">
            <span>🔍 FANUC Parametre Yedeği İnceleyici</span>
            <span class="tag tag-accent font-mono" style="font-size:11px;">.PRM / .TXT / .DAT</span>
          </h1>
          <p class="page-sub">CNC kontrol ünitesinden alınan parametre yedek dosyalarını yükleyin, 8-bitlik bit detaylarını görün ve saniyeler içinde analiz edin.</p>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="triggerParamFileUpload()">📂 PRM Dosyası Seç</button>
          <button class="btn btn-secondary btn-sm" onclick="loadSamplePrmBackup()">⚡ Örnek PRM Yedeği Yükle</button>
          <button class="btn btn-ghost btn-sm" onclick="exportParamInspectorPDF()">📄 PDF Raporu Al</button>
          <button class="btn btn-ghost btn-sm" onclick="exportParamInspectorCSV()">📊 CSV (Excel) İndir</button>
        </div>
      </div>

      <!-- File Dropzone -->
      <div id="param-inspector-dropzone" 
           style="border:2px dashed var(--border); border-radius:var(--radius-lg); padding:24px; text-align:center; background:var(--bg-card); cursor:pointer; margin-bottom:20px; transition:all 0.2s ease;"
           onclick="triggerParamFileUpload()"
           ondragover="handleParamDragOver(event)"
           ondragleave="handleParamDragLeave(event)"
           ondrop="handleParamFileDrop(event)">
        <div style="font-size:32px; margin-bottom:8px;">📂</div>
        <div style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">
          FANUC Parametre Dosyasını Sürükleyip Buraya Bırakın veya Tıklayın
        </div>
        <div style="font-size:12px; color:var(--text-secondary);">
          Desteklenen formatlar: <code style="color:var(--accent);">.PRM</code>, <code style="color:var(--accent);">.TXT</code>, <code style="color:var(--accent);">.NC</code>, <code style="color:var(--accent);">.DAT</code> (FANUC 0i, 16i, 18i, 31i-B tüm yedek metinleri)
        </div>
        <input type="file" id="param-inspector-file-input" accept=".prm,.txt,.dat,.nc,.cnc" style="display:none;" onchange="onParamFileSelected(event)" />
      </div>

      <!-- KPI Overview Cards -->
      <div id="param-inspector-kpi" class="grid grid-cols-4 gap-4 mb-4" style="display:none;">
        <div class="card p-3" style="background:var(--bg-card);">
          <div style="font-size:11px; color:var(--text-muted); font-weight:600;">TOPLAM PARAMETRE</div>
          <div id="kpi-prm-total" class="font-mono" style="font-size:22px; font-weight:700; color:var(--text-primary);">0</div>
        </div>
        <div class="card p-3" style="background:var(--bg-card);">
          <div style="font-size:11px; color:var(--text-muted); font-weight:600;">KRİTİK PARAMETRELER</div>
          <div id="kpi-prm-critical" class="font-mono" style="font-size:22px; font-weight:700; color:var(--warning);">0</div>
        </div>
        <div class="card p-3" style="background:var(--bg-card);">
          <div style="font-size:11px; color:var(--text-muted); font-weight:600;">8-BİT İKİLİ (BINARY)</div>
          <div id="kpi-prm-binary" class="font-mono" style="font-size:22px; font-weight:700; color:var(--accent);">0</div>
        </div>
        <div class="card p-3" style="background:var(--bg-card);">
          <div style="font-size:11px; color:var(--text-muted); font-weight:600;">EKSEN & MİKTAR</div>
          <div id="kpi-prm-axis" class="font-mono" style="font-size:22px; font-weight:700; color:var(--success);">0</div>
        </div>
      </div>

      <!-- Search & Filter Controls -->
      <div id="param-inspector-controls" class="card p-3 mb-4" style="display:none; background:var(--bg-card);">
        <div class="flex items-center gap-3" style="flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <input type="text" id="param-inspector-search" class="form-input w-full" placeholder="Parametre no (1815, 3202) veya açıklama ara..." oninput="filterParamInspectorRows()" />
          </div>
          <div>
            <select id="param-inspector-category" class="form-select" onchange="filterParamInspectorRows()">
              <option value="all">Tüm Kategoriler</option>
              <option value="critical">🚨 Yalnızca Kritik Parametreler</option>
              <option value="binary">🔢 8-Bit İkili (Binary) Parametreler</option>
              <option value="axis">🎯 Eksen & Limit Parametreleri</option>
              <option value="protection">🔒 Program Korumaları (NE9)</option>
              <option value="comm">🌐 RS232 / Haberleşme</option>
            </select>
          </div>
          <div>
            <span id="param-inspector-count-badge" class="tag tag-blue">0 Parametre Listelendi</span>
          </div>
        </div>
      </div>

      <!-- Bit Detail Explorer (Sticky Section when selecting a binary parameter) -->
      <div id="param-bit-detail-card" class="card mb-4" style="display:none; background:var(--bg-card2); border:1px solid var(--accent); padding:16px;">
        <div class="flex justify-between items-center mb-3">
          <div style="font-weight:700; color:var(--text-primary); font-size:14px; display:flex; align-items:center; gap:8px;">
            <span>🔬 8-Bit Detay İnceleme:</span>
            <span id="param-bit-title" class="font-mono" style="color:var(--accent);">Parametre #1815 (00110000)</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="closeParamBitDetail()">✕ Kapat</button>
        </div>
        <div id="param-bit-body" class="grid grid-cols-8 gap-2 text-center font-mono"></div>
      </div>

      <!-- Main Parameters Table -->
      <div id="param-inspector-table-wrap" class="card p-0" style="display:none; overflow-x:auto;">
        <table class="table w-full" style="border-collapse:collapse;">
          <thead>
            <tr style="background:var(--bg-card2); text-align:left; font-size:11.5px; border-bottom:1px solid var(--border);">
              <th style="padding:10px 14px; width:120px;">Parametre No</th>
              <th style="padding:10px 14px; width:160px;">Okunan Değer</th>
              <th style="padding:10px 14px; width:140px;">Biçim</th>
              <th style="padding:10px 14px;">Parametre Tanımı & İşlevi</th>
              <th style="padding:10px 14px; width:100px; text-align:center;">İşlem</th>
            </tr>
          </thead>
          <tbody id="param-inspector-tbody"></tbody>
        </table>
      </div>
    `;

    return page;
  }

  function parsePrmText(text) {
    if (!text) return [];
    const lines = text.split(/[\r\n]+/);
    const parsed = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('%') || trimmed.startsWith('O') || trimmed.startsWith('(')) return;

      // Matches N01815 P 00110000 or N1815 P 00110000 or 1815 00110000 or N1815P00110000
      const match = trimmed.match(/^N?(\d+)\s+[PQ]?\s*([0-9a-zA-B\s]+)/i) || 
                    trimmed.match(/^(\d+)[,\s\t]+([0-9a-zA-B]+)/);

      if (match) {
        const no = parseInt(match[1], 10);
        const val = match[2].trim().replace(/\s+/g, '');
        parsed.push({
          no,
          value: val,
          raw: trimmed
        });
      }
    });

    return parsed;
  }

  function displayParsedParams(params) {
    currentParsedParams = params || [];

    const kpiWrap = document.getElementById('param-inspector-kpi');
    const controlsWrap = document.getElementById('param-inspector-controls');
    const tableWrap = document.getElementById('param-inspector-table-wrap');

    if (!params || params.length === 0) {
      if (kpiWrap) kpiWrap.style.display = 'none';
      if (controlsWrap) controlsWrap.style.display = 'none';
      if (tableWrap) tableWrap.style.display = 'none';
      if (typeof showToast === 'function') showToast('⚠️ Dosyada okunabilir FANUC parametresi bulunamadı.', 'warning');
      return;
    }

    if (kpiWrap) kpiWrap.style.display = 'grid';
    if (controlsWrap) controlsWrap.style.display = 'block';
    if (tableWrap) tableWrap.style.display = 'block';

    let countCritical = 0;
    let countBinary = 0;
    let countAxis = 0;

    params.forEach(p => {
      if (isCriticalParam(p.no)) countCritical++;
      if (/^[01]{8}$/.test(p.value)) countBinary++;
      if (getParamCategory(p.no, p.value) === 'axis') countAxis++;
    });

    const elTotal = document.getElementById('kpi-prm-total');
    const elCrit = document.getElementById('kpi-prm-critical');
    const elBin = document.getElementById('kpi-prm-binary');
    const elAxis = document.getElementById('kpi-prm-axis');

    if (elTotal) elTotal.textContent = params.length.toLocaleString('tr-TR');
    if (elCrit) elCrit.textContent = countCritical;
    if (elBin) elBin.textContent = countBinary;
    if (elAxis) elAxis.textContent = countAxis;

    filterParamInspectorRows();
    if (typeof showToast === 'function') {
      showToast(`✅ ${params.length} adet FANUC parametresi başarıyla incelendi!`, 'success');
    }
  }

  function filterParamInspectorRows() {
    const tbody = document.getElementById('param-inspector-tbody');
    if (!tbody) return;

    const query = (document.getElementById('param-inspector-search')?.value || '').toLowerCase().trim();
    const category = document.getElementById('param-inspector-category')?.value || 'all';

    const filtered = currentParsedParams.filter(p => {
      const pNoStr = String(p.no);
      const desc = getParamDbDesc(p.no).toLowerCase();
      const valStr = String(p.value).toLowerCase();

      const matchesQuery = !query || pNoStr.includes(query) || desc.includes(query) || valStr.includes(query);
      if (!matchesQuery) return false;

      if (category === 'critical') return isCriticalParam(p.no);
      if (category === 'binary') return /^[01]{8}$/.test(p.value);
      if (category === 'axis') return getParamCategory(p.no, p.value) === 'axis';
      if (category === 'protection') return getParamCategory(p.no, p.value) === 'protection';
      if (category === 'comm') return getParamCategory(p.no, p.value) === 'comm';

      return true;
    });

    const badge = document.getElementById('param-inspector-count-badge');
    if (badge) badge.textContent = `${filtered.length} Parametre Listelendi`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">
            Arama kriterlerine uygun parametre bulunamadı.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const isBinary = /^[01]{8}$/.test(p.value);
      const isCrit = isCriticalParam(p.no);
      const desc = getParamDbDesc(p.no);

      const rowStyle = isCrit ? 'background:rgba(239,68,68,0.06);' : '';
      const critTag = isCrit ? '<span class="tag tag-red" style="font-size:10px; margin-left:6px;">KRİTİK</span>' : '';
      const binTag = isBinary ? '<span class="tag tag-blue" style="font-size:10px; margin-left:6px;">8-BIT</span>' : '<span class="tag tag-gray" style="font-size:10px; margin-left:6px;">SAYISAL</span>';

      return `
        <tr style="border-bottom:1px solid var(--border); font-size:12.5px; ${rowStyle}">
          <td style="padding:10px 14px; font-weight:700;" class="font-mono">
            Param ${p.no} ${critTag}
          </td>
          <td style="padding:10px 14px; font-weight:700; color:var(--accent);" class="font-mono">
            ${p.value}
          </td>
          <td style="padding:10px 14px;">
            ${binTag}
          </td>
          <td style="padding:10px 14px; color:var(--text-primary);">
            ${desc}
          </td>
          <td style="padding:10px 14px; text-align:center;">
            ${isBinary ? `<button class="btn btn-ghost btn-xs" onclick="inspectParamBitDetail(${p.no}, '${p.value}')">🔬 Bit Detay</button>` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  }

  function inspectParamBitDetail(no, value) {
    selectedParamNo = no;
    const card = document.getElementById('param-bit-detail-card');
    const title = document.getElementById('param-bit-title');
    const body = document.getElementById('param-bit-body');

    if (!card || !body) return;

    if (title) title.textContent = `Parametre #${no} (${value})`;

    const dbParam = (window.State && window.State.parameters) ? window.State.parameters.find(p => p.no == no) : null;
    const bitDescs = dbParam?.bits || {};

    let html = '';
    const valStr = String(value).padStart(8, '0');

    for (let b = 0; b < 8; b++) {
      const bitNum = 7 - b;
      const bitVal = valStr[b] || '0';
      const bitDescObj = bitDescs[`bit${bitNum}`] || bitDescs[bitNum];
      const bitName = typeof bitDescObj === 'object' ? bitDescObj.name : (bitDescObj || `Bit ${bitNum}`);

      const isActive = bitVal === '1';
      const activeStyle = isActive 
        ? 'background:rgba(16,185,129,0.15); border:1px solid var(--success); color:var(--success);' 
        : 'background:var(--bg-card); border:1px solid var(--border); color:var(--text-muted);';

      html += `
        <div style="padding:8px; border-radius:var(--radius-md); ${activeStyle}">
          <div style="font-size:10px; font-weight:700;">BIT ${bitNum}</div>
          <div style="font-size:18px; font-weight:700; margin:2px 0;">${bitVal}</div>
          <div style="font-size:9.5px; line-height:1.2; font-family:var(--font-sans); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${bitName}">
            ${bitName}
          </div>
        </div>
      `;
    }

    body.innerHTML = html;
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeParamBitDetail() {
    const card = document.getElementById('param-bit-detail-card');
    if (card) card.style.display = 'none';
  }

  function triggerParamFileUpload() {
    const input = document.getElementById('param-inspector-file-input');
    if (input) input.click();
  }

  function onParamFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    readParamFile(file);
  }

  function handleParamDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dz = document.getElementById('param-inspector-dropzone');
    if (dz) dz.style.borderColor = 'var(--accent)';
  }

  function handleParamDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dz = document.getElementById('param-inspector-dropzone');
    if (dz) dz.style.borderColor = 'var(--border)';
  }

  function handleParamFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dz = document.getElementById('param-inspector-dropzone');
    if (dz) dz.style.borderColor = 'var(--border)';

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      readParamFile(e.dataTransfer.files[0]);
    }
  }

  function readParamFile(file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target.result;
      const parsed = parsePrmText(text);
      displayParsedParams(parsed);
    };
    reader.readAsText(file);
  }

  function loadSamplePrmBackup() {
    const sample = `
%
O0001 (FANUC 31i-B BACKUP SAMPLE)
N01000 P 00000000
N01001 P 00000001
N01002 P 00000000
N01006 P 00000001
N01320 P 99999999
N01321 P -99999999
N01420 P 36000
N01815 P 00110000
N01825 P 3000
N01851 P 00000005
N03111 P 00000001
N03202 P 00010000
N04002 P 00000001
N04003 P 00000100
%
    `.trim();

    const parsed = parsePrmText(sample);
    displayParsedParams(parsed);
  }

  function exportParamInspectorCSV() {
    if (!currentParsedParams || currentParsedParams.length === 0) {
      if (typeof showToast === 'function') showToast('⚠️ Dışa aktarılacak parametre bulunamadı.', 'warning');
      return;
    }

    let csv = '\uFEFFParametre No;Okunan Değer;Biçim;Açıklama & İşlev\n';
    currentParsedParams.forEach(p => {
      const desc = getParamDbDesc(p.no).replace(/;/g, ' ');
      const isBinary = /^[01]{8}$/.test(p.value) ? '8-Bit Binary' : 'Sayısal';
      csv += `${p.no};${p.value};${isBinary};${desc}\n`;
    });

    if (window.electronAPI && window.electronAPI.exportCSV) {
      window.electronAPI.exportCSV(csv, 'FANUC_Parametre_Yedek_Analizi.csv');
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'FANUC_Parametre_Yedek_Analizi.csv';
      link.click();
    }
  }

  function exportParamInspectorPDF() {
    if (!currentParsedParams || currentParsedParams.length === 0) {
      if (typeof showToast === 'function') showToast('⚠️ Dışa aktarılacak parametre bulunamadı.', 'warning');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>FANUC Parametre İnceleme Raporu</title>
        <style>
          body { font-family: sans-serif; font-size: 12px; padding: 20px; color: #1e293b; }
          h1 { color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background: #f1f5f9; font-weight: bold; }
          .mono { font-family: monospace; }
        </style>
      </head>
      <body>
        <h1>🔍 FANUC Parametre Yedeği İnceleme Raporu</h1>
        <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleString('tr-TR')}</p>
        <p><strong>Toplam Parametre Sayısı:</strong> ${currentParsedParams.length}</p>
        <table>
          <thead>
            <tr>
              <th>Parametre No</th>
              <th>Değer</th>
              <th>Açıklama</th>
            </tr>
          </thead>
          <tbody>
            ${currentParsedParams.map(p => `
              <tr>
                <td class="mono">Param ${p.no}</td>
                <td class="mono"><strong>${p.value}</strong></td>
                <td>${getParamDbDesc(p.no)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    if (window.electronAPI && window.electronAPI.printToPDF) {
      window.electronAPI.printToPDF(html, 'FANUC_Parametre_Raporu.pdf');
    } else {
      window.print();
    }
  }

  global.ParamInspectorFeature = {
    renderParamInspector,
    parsePrmText,
    displayParsedParams,
    filterParamInspectorRows,
    inspectParamBitDetail,
    closeParamBitDetail,
    triggerParamFileUpload,
    onParamFileSelected,
    handleParamDragOver,
    handleParamDragLeave,
    handleParamFileDrop,
    loadSamplePrmBackup,
    exportParamInspectorCSV,
    exportParamInspectorPDF
  };

})(typeof window !== 'undefined' ? window : global);
