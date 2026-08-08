/** Projects, reports, explainable maintenance conditions and reliability views. */
(function () {
'use strict';

// ════════════════════════════════════════════════════════════════
//  PROJECTS
// ════════════════════════════════════════════════════════════════
function renderProjects() {
  const page = createPage('projects');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>📁 Proje Yöneticisi</h1>
          <p>Mekanik, elektrik ve PMC projelerinizi yönetin</p>
        </div>
        <button class="btn btn-primary" id="btn-new-project">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Proje
        </button>
      </div>
      <div class="flex gap-2 mt-3">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="proj-search" placeholder="Proje ara..." />
        </div>
        <select id="proj-type-filter" style="width:160px">
          <option value="">Tüm Tipler</option>
          <option value="mech">Mekanik</option>
          <option value="elec">Elektrik</option>
          <option value="pmc">PMC / Ladder</option>
        </select>
      </div>
    </div>
    <div class="page-body">
      <div id="proj-grid" class="grid-3"></div>
    </div>
  `;

  renderProjectGrid(page);
  page.querySelector('#btn-new-project').addEventListener('click', showNewProjectModal);
  page.querySelector('#proj-search').addEventListener('input', () => renderProjectGrid(page));
  page.querySelector('#proj-type-filter').addEventListener('change', () => renderProjectGrid(page));

  return page;
}

function renderProjectGrid(page) {
  const container = (page || document).querySelector('#proj-grid');
  if (!container) return;
  const q = ((page || document).querySelector('#proj-search')?.value || '').toLowerCase();
  const type = (page || document).querySelector('#proj-type-filter')?.value || '';

  let projs = State.projects.filter(p =>
    (!q || p.name.toLowerCase().includes(q)) &&
    (!type || p.type === type)
  );

  if (!projs.length) {
    const filtered = State.projects.length > 0;
    container.innerHTML = `<div style="grid-column:1/-1">${window.MTBUX.emptyState({
      icon: '▣',
      title: filtered ? 'Filtrelere uygun proje bulunamadı' : 'Henüz proje oluşturulmadı',
      description: filtered ? 'Arama ifadesini veya proje tipi filtresini değiştirerek tekrar deneyin.' : 'Elektrik, mekanik veya PMC çalışmalarınızı tek yerde takip etmek için ilk projeyi oluşturun.',
      actionLabel: filtered ? 'Filtreleri temizle' : 'İlk projeyi oluştur',
      command: filtered ? 'clear-filters' : 'new-project'
    })}</div>`;
    return;
  }

  const typeLabel = { mech:'⚙️ Mekanik', elec:'⚡ Elektrik', pmc:'💻 PMC/Ladder' };
  container.innerHTML = projs.map(p => `
    <div class="project-card ${p.type}" onclick="openProject('${p.id}')">
      <div class="project-header">
        <div>
          <div class="project-name">${escapeHTML(p.name)}</div>
          <div class="project-type">${escapeHTML(typeLabel[p.type] || p.type)}</div>
        </div>
        <span class="tag ${p.type==='mech'?'tag-blue':p.type==='elec'?'tag-amber':'tag-purple'}">${escapeHTML(p.status || 'Aktif')}</span>
      </div>
      <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:10px">${escapeHTML(p.description || 'Açıklama yok')}</p>
      <div class="progress-bar"><div class="progress-fill" style="width:${p.progress||0}%"></div></div>
      <div class="project-meta">
        <div class="project-meta-item">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${p.createdAt ? new Date(p.createdAt).toLocaleDateString('tr-TR') : '-'}
        </div>
        <div class="project-meta-item">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          ${escapeHTML(p.owner || 'Kullanıcı')}
        </div>
        <div class="project-meta-item" style="margin-left:auto; color:var(--accent)">
          %${p.progress||0}
        </div>
      </div>
    </div>
  `).join('');
}

window.openProject = function(id) {
  const proj = State.projects.find(p => p.id === id);
  if (!proj) return;
  showToast(`"${proj.name}" projesi açıldı`, 'info');
};

function showNewProjectModal() {
  showModal('new-project', `
    <div class="modal-header">
      <span class="modal-title">Yeni Proje Oluştur</span>
      <button class="modal-close" onclick="closeModal('new-project')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Proje Adı *</label>
      <input class="form-control" id="np-name" placeholder="ör. VMC-850 Elektrik Revizyonu" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Proje Tipi *</label>
        <select class="form-control" id="np-type">
          <option value="mech">⚙️ Mekanik</option>
          <option value="elec">⚡ Elektrik</option>
          <option value="pmc">💻 PMC / Ladder</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">FANUC Serisi</label>
        <select class="form-control" id="np-series">
          <option>0i-F</option>
          <option>30i-B</option>
          <option>31i-B</option>
          <option>32i-B</option>
          <option>Genel</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Açıklama</label>
      <textarea class="form-control" id="np-desc" rows="3" placeholder="Proje açıklaması..."></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Sorumlu</label>
        <input class="form-control" id="np-owner" placeholder="Ad Soyad" />
      </div>
      <div class="form-group">
        <label class="form-label">Tezgah / Makine</label>
        <input class="form-control" id="np-machine" placeholder="ör. VMC-850" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-project')">İptal</button>
      <button class="btn btn-primary" id="btn-create-proj">Proje Oluştur</button>
    </div>
  `);

  document.getElementById('btn-create-proj').addEventListener('click', createProject);
}

async function createProject() {
  const name = document.getElementById('np-name').value.trim();
  if (!name) { showToast('Proje adı zorunlu!', 'error'); return; }

  const id = 'proj_' + Date.now();
  const proj = {
    id,
    name,
    type: document.getElementById('np-type').value,
    series: document.getElementById('np-series').value,
    description: document.getElementById('np-desc').value,
    owner: document.getElementById('np-owner').value || 'Kullanıcı',
    machine: document.getElementById('np-machine').value,
    progress: 0,
    status: 'Aktif',
    createdAt: new Date().toISOString(),
    files: []
  };

  // Save to disk
  const projDir = State.appDataDir + '/projects/' + id;
  try {
    const dirRes = await window.electronAPI.ensureDir(projDir);
    if (!dirRes || !dirRes.ok) {
      showToast('Proje dizini oluşturulamadı: ' + (dirRes?.error || 'Bilinmeyen hata'), 'error');
      return;
    }
    const writeRes = await window.electronAPI.writeFile(projDir + '/meta.json', JSON.stringify(proj, null, 2));
    if (writeRes && writeRes.ok) {
      State.projects.push(proj);
      closeModal('new-project');
      showToast('Proje oluşturuldu!', 'success');
      renderProjectGrid();
    } else {
      showToast('Proje kaydedilemedi: ' + (writeRes?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Proje oluşturulurken hata: ' + err.message, 'error');
  }
}


// ════════════════════════════════════════════════════════════════
//  RAPORLAR & ANALİZ
// ════════════════════════════════════════════════════════════════
function renderReports() {
  const page = createPage('reports');
  
  // Calculate stats
  const monthCounts = {};
  State.maintenances.forEach(m => {
    const dateStr = m.tarih || m.date;
    if (!dateStr) return;
    const d = parseDateHelper(dateStr);
    if (d && d.getTime() > 0) {
      const monthYear = String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
      monthCounts[monthYear] = (monthCounts[monthYear] || 0) + 1;
    }
  });

  const deptCounts = {};
  State.maintenances.forEach(m => {
    const mach = State.machines.find(x => x.id === m.tezgah_id);
    const dept = mach ? (mach.bolum || 'Diğer') : 'Diğer';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });

  const machFailures = {};
  State.maintenances.forEach(m => {
    machFailures[m.tezgah_id] = (machFailures[m.tezgah_id] || 0) + 1;
  });

  const topMachines = Object.keys(machFailures)
    .map(tid => {
      const mach = State.machines.find(x => x.id === parseInt(tid));
      return {
        id: tid,
        name: mach ? mach.numarasi : `Tezgah #${tid}`,
        count: machFailures[tid],
        dept: mach ? (mach.bolum || '—') : '—'
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  page.innerHTML = `
    <div class="page-header">
      <h1>📊 Raporlar & Analiz Paneli</h1>
      <p>Bakım sıklığı, arıza analizleri ve departman bazlı istatistikler</p>
    </div>
    <div class="page-body">
      <div class="grid-2 mb-4" style="gap:16px">
        <div class="card">
          <div class="card-title mb-3">📈 Aylara Göre Bakım Dağılımı</div>
          <div style="display:flex; justify-content:center; padding:10px">
            <canvas id="maint-bar-chart" width="450" height="220" style="width:100%; max-width:450px"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-title mb-3">🍩 Departmanlara Göre Arıza Dağılımı</div>
          <div style="display:flex; align-items:center; justify-content:space-around; padding:10px">
            <canvas id="maint-donut-chart" width="200" height="200" style="max-width:200px"></canvas>
            <div style="font-size:11.5px; display:flex; flex-direction:column; gap:6px" id="donut-legend"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title mb-3">🚨 En Sık Arızalanan Kritik Tezgahlar (Top 5)</div>
        <table class="data-table" style="font-size:12px">
          <thead>
            <tr>
              <th>Tezgah</th>
              <th>Bölüm</th>
              <th>Toplam Arıza Sayısı</th>
              <th>Kritik Durum Derecesi</th>
            </tr>
          </thead>
          <tbody>
            ${topMachines.map(m => {
              const severityClass = m.count > 10 ? 'tag-red' : m.count > 5 ? 'tag-amber' : 'tag-blue';
              const severityText = m.count > 10 ? 'Çok Yüksek' : m.count > 5 ? 'Orta-Yüksek' : 'Düşük-Orta';
              return `
                <tr>
                  <td><strong style="color:var(--text-accent)">${m.name}</strong></td>
                  <td>${m.dept}</td>
                  <td><span class="font-mono" style="font-weight:600">${m.count} Defa</span></td>
                  <td><span class="tag ${severityClass}">${severityText}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Draw charts asynchronously to ensure canvas elements exist in DOM
  setTimeout(() => {
    drawBarChart('maint-bar-chart', monthCounts);
    drawDonutChart('maint-donut-chart', deptCounts, 'donut-legend');
  }, 100);

  return page;
}

function drawBarChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const keys = Object.keys(data).sort((a,b) => {
    const aP = a.split('/'), bP = b.split('/');
    return new Date(aP[1], aP[0]-1) - new Date(bP[1], bP[0]-1);
  }).slice(-6); // last 6 active months
  
  if (!keys.length) return;
  const values = keys.map(k => data[k]);
  const maxVal = Math.max(...values, 1);
  
  const width = canvas.width;
  const height = canvas.height;
  const padding = 35;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  
  // Helper grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const yGrid = padding + (chartHeight / 4) * i;
    ctx.moveTo(padding, yGrid);
    ctx.lineTo(width - padding, yGrid);
  }
  ctx.stroke();

  // Axis lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();
  
  const barGap = 18;
  const barWidth = (chartWidth - (barGap * (keys.length - 1))) / keys.length;
  
  keys.forEach((key, idx) => {
    const val = data[key];
    const barHeight = (val / maxVal) * chartHeight;
    const x = padding + idx * (barWidth + barGap);
    const y = height - padding - barHeight;
    
    // Create glowing neon gradient
    const grad = ctx.createLinearGradient(x, y, x, height - padding);
    grad.addColorStop(0, '#60a5fa');
    grad.addColorStop(0.5, '#a78bfa');
    grad.addColorStop(1, 'rgba(167, 139, 250, 0.05)');
    
    // Draw bar with shadow/glow
    ctx.save();
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 12;
    ctx.fillStyle = grad;
    
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
    } else {
      ctx.rect(x, y, barWidth, barHeight);
    }
    ctx.fill();
    ctx.restore();
    
    // Text value
    ctx.fillStyle = '#f3f4f6';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(val, x + barWidth / 2, y - 8);
    
    // Label
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px monospace';
    ctx.fillText(key, x + barWidth / 2, height - padding + 18);
  });
}

function drawDonutChart(canvasId, data, legendId) {
  const canvas = document.getElementById(canvasId);
  const legend = document.getElementById(legendId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Get top 4 depts and group others
  const sortedDepts = Object.keys(data).sort((a,b) => data[b] - data[a]);
  const displayDepts = sortedDepts.slice(0, 4);
  let otherSum = 0;
  sortedDepts.slice(4).forEach(d => otherSum += data[d]);
  
  const chartData = {};
  displayDepts.forEach(d => chartData[d] = data[d]);
  if (otherSum > 0) chartData['Diğer'] = otherSum;

  const total = Object.values(chartData).reduce((a, b) => a + b, 0);
  const keys = Object.keys(chartData);
  if (total === 0) return;
  
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 15;
  
  let startAngle = 0;
  // Modern glowing colors
  const colors = ['#3b82f6', '#10b981', '#fbbf24', '#f43f5e', '#a78bfa'];
  
  keys.forEach((key, idx) => {
    const val = chartData[key];
    const sliceAngle = (val / total) * 2 * Math.PI;
    const color = colors[idx % colors.length];
    
    ctx.save();
    ctx.fillStyle = color;
    // Add neon shadow
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    startAngle += sliceAngle;
  });
  
  // Donut hole
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.6, 0, 2 * Math.PI);
  ctx.fill();

  // Draw legend
  if (legend) {
    legend.innerHTML = keys.map((key, idx) => {
      const val = chartData[key];
      const pct = ((val / total) * 100).toFixed(1);
      return `
        <div class="flex items-center gap-2" style="padding: 4px 0">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${colors[idx % colors.length]}; box-shadow: 0 0 6px ${colors[idx % colors.length]}"></span>
          <span class="truncate" style="max-width:110px; font-weight:500; color:var(--text-secondary)">${key}</span>
          <span style="margin-left:auto; font-weight:600; color:var(--text-primary)">%${pct}</span>
          <span class="text-muted" style="font-size:10px; margin-left:4px">(${val})</span>
        </div>
      `;
    }).join('');
  }
}

// ════════════════════════════════════════════════════════════════
//  KESTİRİMCİ BAKIM PANELİ
// ════════════════════════════════════════════════════════════════
function calculateMachineHealth(m) {
  const workspaceStatus = window.MachineWorkspace?.machineStatus?.(m);
  const issues = workspaceStatus?.issues || [];
  const status = issues.some(item => item.level === 'danger') ? 'Critical'
    : issues.some(item => item.level === 'warn') ? 'Warning' : 'Safe';
  return {
    status,
    colorClass: status === 'Critical' ? 'tag-red' : status === 'Warning' ? 'tag-amber' : 'tag-green',
    reasons: issues.map(item => item.text),
    primaryReason: workspaceStatus?.primary?.text || 'Aktif kritik bildirim yok'
  };
}

function renderPredictive() {
  const page = createPage('predictive');
  
  // Calculate health for all machines
  const machList = State.machines.map(m => {
    const health = calculateMachineHealth(m);
    return { ...m, health };
  });

  const priority = { Critical: 0, Warning: 1, Safe: 2 };
  machList.sort((a, b) => priority[a.health.status] - priority[b.health.status]);

  const criticals = machList.filter(m => m.health.status === 'Critical');
  const warnings = machList.filter(m => m.health.status === 'Warning');
  const safes = machList.filter(m => m.health.status === 'Safe');

  page.innerHTML = `
    <div class="page-header">
      <h1>Bakım Durum Analizi</h1>
      <p>Bakım, pil, fan, yedekleme ve envanter kayıtlarına dayalı açıklanabilir durumlar</p>
    </div>
    <div class="page-body">
      <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:18px">
        <div class="stat-card red">
          <div class="stat-icon red">🔴</div>
          <div class="stat-data">
            <div class="stat-value" style="color:#f87171">${criticals.length}</div>
            <div class="stat-label">Kritik pil veya fan bildirimi</div>
          </div>
        </div>
        <div class="stat-card amber">
          <div class="stat-icon amber">🟡</div>
          <div class="stat-data">
            <div class="stat-value" style="color:#fbbf24">${warnings.length}</div>
            <div class="stat-label">Kontrol edilmesi gereken</div>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon green">🟢</div>
          <div class="stat-data">
            <div class="stat-value" style="color:#34d399">${safes.length}</div>
            <div class="stat-label">Aktif kritik bildirimi olmayan</div>
          </div>
        </div>
      </div>

      <div class="card mb-4" style="border-left: 4px solid var(--red)">
        <div class="card-title text-red">Açıklanabilir bakım bildirimleri</div>
        <p style="font-size:12px; color:var(--text-secondary); line-height:1.5">
          Tezgâhlara puan verilmez. Her durum doğrudan bakım, pil, fan, yedekleme veya eksik kayıt nedeniyle açıklanır.
        </p>
      </div>

      <div class="flex gap-2 mb-3">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="pred-search" placeholder="Tezgah adı ara..." />
        </div>
        <select id="pred-status-filter" style="width:160px">
          <option value="">Tüm Durumlar</option>
          <option value="Critical">🔴 Kritik</option>
          <option value="Warning">🟡 Riskli</option>
          <option value="Safe">🟢 Güvenli</option>
        </select>
      </div>

      <div style="overflow-y:auto; flex:1">
        <table class="data-table" id="pred-table">
          <thead>
            <tr>
              <th>Tezgah</th>
              <th>Bölüm</th>
              <th>Birincil Bildirim</th>
              <th>Diğer Nedenler</th>
              <th>Öncelik Durumu</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody id="pred-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderPredictiveTable(machList, page);

  page.querySelector('#pred-search').addEventListener('input', () => filterPredictive(page, machList));
  page.querySelector('#pred-status-filter').addEventListener('change', () => filterPredictive(page, machList));

  return page;
}

function filterPredictive(page, fullList) {
  const q = page.querySelector('#pred-search').value.toLowerCase();
  const status = page.querySelector('#pred-status-filter').value;

  const filtered = fullList.filter(m =>
    (!q || m.numarasi.toLowerCase().includes(q)) &&
    (!status || m.health.status === status)
  );
  renderPredictiveTable(filtered, page);
}

function renderPredictiveTable(list, page) {
  const tbody = page.querySelector('#pred-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Tezgah bulunamadı</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(m => {
    return `
      <tr>
        <td><strong style="color:var(--text-accent)">${escapeHTML(m.numarasi)}</strong></td>
        <td>${escapeHTML(m.bolum || '—')}</td>
        <td><strong>${escapeHTML(m.health.primaryReason)}</strong></td>
        <td><span style="color:var(--text-secondary)">${escapeHTML(m.health.reasons.slice(1).join(' · ') || '—')}</span></td>
        <td><span class="tag ${m.health.colorClass}">${m.health.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="showMachineDetailsModal(${m.id})">Kayıtlar</button>
        </td>
      </tr>
    `;
  }).join('');
}


// ════════════════════════════════════════════════════════════════
//  MTBF & MTTR GÜVENİLİRLİK ANALİZÖRÜ
// ════════════════════════════════════════════════════════════════
function renderReliability() {
  const page = createPage('reliability');
  page.innerHTML = `
    <div class="page-header">
      <h1>📊 Tezgah Güvenilirlik & MTBF / MTTR Analiz Paneli</h1>
      <p>Arıza sıklığı (MTBF), ortalama tamir süresi (MTTR) ve tezgahlara özel kullanılabilirlik oranları</p>
    </div>
    <div class="page-body">
      
      <!-- Summary metrics cards -->
      <div class="flex gap-4 mb-4" style="flex-wrap:wrap">
        <div class="card" style="flex:1; min-width:200px; padding:16px; background:var(--bg-card2)">
          <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase">Ortalama MTBF (Arızasızlık)</div>
          <div id="stat-avg-mtbf" style="font-size:24px; font-weight:700; color:var(--accent); margin-top:4px">Yükleniyor...</div>
        </div>
        <div class="card" style="flex:1; min-width:200px; padding:16px; background:var(--bg-card2)">
          <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase">Ortalama MTTR (Tamir Süresi)</div>
          <div id="stat-avg-mttr" style="font-size:24px; font-weight:700; color:var(--accent); margin-top:4px">Yükleniyor...</div>
        </div>
        <div class="card" style="flex:1; min-width:200px; padding:16px; background:var(--bg-card2)">
          <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase">Atölye Genel Kullanılabilirlik</div>
          <div id="stat-avg-avail" style="font-size:24px; font-weight:700; color:var(--green); margin-top:4px">Yükleniyor...</div>
        </div>
      </div>

      <div class="grid-2 mb-4" style="grid-template-columns: 1.2fr 0.8fr; gap:16px; align-items:stretch">
        
        <!-- Table -->
        <div class="card" style="padding:16px; display:flex; flex-direction:column; height:100%">
          <div class="card-title mb-3">📋 Tezgah Analiz Tablosu</div>
          <div style="overflow-x:auto; flex:1">
            <table class="data-table" style="font-size:11.5px">
              <thead>
                <tr>
                  <th>Tezgah Adı</th>
                  <th>Hata Sayısı</th>
                  <th>MTBF (Saat)</th>
                  <th>MTTR (Saat)</th>
                  <th>Kullanılabilirlik</th>
                  <th>Güvenilirlik Durumu</th>
                </tr>
              </thead>
              <tbody id="reliability-tbody"></tbody>
            </table>
          </div>
        </div>

        <!-- OEE Component Card -->
        <div class="card" style="padding:18px; display:flex; flex-direction:column; height:100%">
          <div style="margin-bottom:14px">
            <div class="card-title mb-1" style="display:flex; align-items:center; justify-content:space-between;">
              <span>📊 OEE Verimlilik Karşılaştırması (%)</span>
              <span class="tag tag-blue" style="font-size:10px; padding:2px 8px">Dinamik Hesaplama</span>
            </div>
            <p style="font-size:11px; color:var(--text-muted)">
              Kullanılabilirlik × Performans × Kalite formülüyle hesaplanan genel ekipman verimliliği
            </p>
          </div>
          <div id="oee-bar-container" style="flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding-right:4px;">
            <div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px">Hesaplanıyor...</div>
          </div>
        </div>

      </div>

    </div>
  `;

  setTimeout(() => calculateReliabilityMetrics(page), 50);

  return page;
}

function calculateReliabilityMetrics(page) {
  const tbody = page.querySelector('#reliability-tbody');
  const avgMtbfEl = page.querySelector('#stat-avg-mtbf');
  const avgMttrEl = page.querySelector('#stat-avg-mttr');
  const avgAvailEl = page.querySelector('#stat-avg-avail');

  if (!State.machines.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Tezgah kaydı bulunamadı</td></tr>`;
    return;
  }

  let totalMtbf = 0;
  let totalMttr = 0;
  let totalAvail = 0;
  let activeMachineCount = 0;

  const dataList = State.machines.map(m => {
    // Filter failures (non-PM/non-periyodik maintenance entries)
    const failures = State.maintenances.filter(maint => 
      maint.tezgah_id === m.id && 
      !(maint.aciklama && (maint.aciklama.includes('[PM]') || maint.aciklama.toLowerCase().includes('periyodik')))
    );
    const failureCount = failures.length;

    // Operating hours calculation (assumed default 2400 hours)
    const opHours = 2400;

    // Repair hours sum
    let repairHours = 0;
    failures.forEach(f => {
      // parse duration or fallback to 3 hours
      const hrs = parseFloat(f.duration) || 3;
      repairHours += hrs;
    });

    const mtbf = failureCount > 0 ? opHours / failureCount : opHours;
    const mttr = failureCount > 0 ? repairHours / failureCount : 0;
    
    // Availability %
    const avail = mtbf > 0 ? (mtbf / (mtbf + mttr)) * 100 : 100;

    // OEE % (mocking Performance 94% and Quality 98%)
    const oee = (avail * 94 * 98) / 10000;

    totalMtbf += mtbf;
    totalMttr += mttr;
    totalAvail += avail;
    activeMachineCount++;

    return {
      name: m.numarasi,
      failures: failureCount,
      mtbf,
      mttr,
      avail,
      oee
    };
  });

  // Render Table
  tbody.innerHTML = dataList.map(d => {
    let statusLabel = '🟢 Yüksek';
    let statusClass = 'tag-green';
    if (d.mtbf < 400) {
      statusLabel = '🔴 Kritik (Sık Hata)';
      statusClass = 'tag-red';
    } else if (d.mtbf < 800) {
      statusLabel = '🟡 Orta';
      statusClass = 'tag-orange';
    }

    return `
      <tr>
        <td><strong>${escapeHTML(d.name)}</strong></td>
        <td style="text-align:center">${d.failures}</td>
        <td><span class="font-mono">${Math.round(d.mtbf)} Sa</span></td>
        <td><span class="font-mono">${d.mttr.toFixed(1)} Sa</span></td>
        <td><strong style="color:var(--green)">${d.avail.toFixed(1)}%</strong></td>
        <td><span class="tag ${statusClass}">${statusLabel}</span></td>
      </tr>
    `;
  }).join('');

  // Set global stats
  const avgMtbf = totalMtbf / activeMachineCount;
  const avgMttr = totalMttr / activeMachineCount;
  const avgAvail = totalAvail / activeMachineCount;

  avgMtbfEl.innerText = `${Math.round(avgMtbf)} Saat`;
  avgMttrEl.innerText = `${avgMttr.toFixed(1)} Saat`;
  avgAvailEl.innerText = `${avgAvail.toFixed(1)}%`;

  // Render Modern OEE Bar List Component
  const oeeContainer = page.querySelector('#oee-bar-container');
  if (oeeContainer) {
    const sortedData = [...dataList].sort((a, b) => 
      String(a.name || '').localeCompare(String(b.name || ''), 'tr', { numeric: true, sensitivity: 'base' })
    );

    oeeContainer.innerHTML = sortedData.map(d => {
      const oeeVal = d.oee.toFixed(1);
      const isHigh = d.oee >= 85;
      const isMid = d.oee >= 70 && d.oee < 85;
      const barGradient = isHigh 
        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' 
        : (isMid ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)');
      const badgeClass = isHigh ? 'tag-green' : (isMid ? 'tag-amber' : 'tag-red');
      const glowColor = isHigh ? 'rgba(16, 185, 129, 0.3)' : (isMid ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)');

      return `
        <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:10px 14px; transition:transform 0.2s ease, border-color 0.2s ease;" class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span style="font-size:12.5px; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:8px">
              <span style="width:8px; height:8px; border-radius:50%; background:${isHigh ? '#10b981' : (isMid ? '#f59e0b' : '#ef4444')}; display:inline-block; box-shadow:0 0 6px ${glowColor}"></span>
              ${escapeHTML(d.name)}
            </span>
            <span class="tag ${badgeClass}" style="font-family:var(--font-mono); font-size:11.5px; font-weight:700">
              %${oeeVal}
            </span>
          </div>
          <div style="position:relative; width:100%; height:8px; background:var(--bg-base); border-radius:4px; overflow:hidden">
            <div style="width:${Math.min(Math.max(d.oee, 5), 100)}%; height:100%; background:${barGradient}; border-radius:4px; transition:width 0.8s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 0 8px ${glowColor}"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}



window.OperationsInsights = Object.freeze({
  renderProjects,
  renderReports,
  renderPredictive,
  renderReliability,
  calculateMachineHealth
});
})();