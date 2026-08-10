(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const count = key => Array.isArray(window.State?.[key]) ? window.State[key].length : 0;
  const percentile = (values, ratio) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * ratio))] : 0;

  function summary(metrics) {
    const durations = metrics.map(item => Number(item.duration) || 0).sort((a, b) => a - b);
    const total = durations.reduce((sum, value) => sum + value, 0);
    return {
      average: durations.length ? total / durations.length : 0,
      p95: percentile(durations, 0.95),
      slowest: durations.length ? durations[durations.length - 1] : 0
    };
  }

  function render() {
    const page = document.createElement('div');
    page.className = 'page active';
    page.id = 'page-performance_diagnostics';
    if (window.State?.currentUser?.role !== 'admin') {
      page.innerHTML = '<div class="page-body"><div class="empty-state-guided"><h2>Yönetici yetkisi gerekli</h2><p>Performans teşhisi yalnızca yöneticilere açıktır.</p></div></div>';
      return page;
    }

    const metrics = window.MTBPerformance?.getMetrics?.() || [];
    const stats = summary(metrics);
    const memory = performance.memory
      ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB / ${Math.round(performance.memory.jsHeapSizeLimit / 1048576)} MB`
      : 'Bu cihazda kullanılamıyor';
    const rows = metrics.slice().reverse().map(item => `<tr><td>${esc(item.name)}</td><td>${Number(item.duration).toFixed(1)} ms</td><td>${esc(item.at)}</td></tr>`).join('');
    const datasets = [
      ['Tezgâh', count('machines')], ['Bakım', count('maintenances')], ['Pil', count('batteries')],
      ['Fan', count('fans')], ['Alarm', count('alarms')], ['Parametre', count('parameters')],
      ['PMC sinyali', count('pmc_signals')], ['Yedek', count('backup_logs')]
    ];

    page.innerHTML = `<div class="page-header"><h1>Yerel Performans Teşhisi</h1><p>Veriler yalnızca bu oturumun belleğinde tutulur ve dışarı gönderilmez.</p></div>
      <div class="page-body">
        <div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
          <div class="card"><small>Kayıtlı ölçüm</small><strong style="display:block;font-size:24px">${metrics.length}</strong></div>
          <div class="card"><small>Ortalama süre</small><strong style="display:block;font-size:18px">${stats.average.toFixed(1)} ms</strong></div>
          <div class="card"><small>P95 süre</small><strong style="display:block;font-size:18px">${stats.p95.toFixed(1)} ms</strong></div>
          <div class="card"><small>En yavaş işlem</small><strong style="display:block;font-size:18px">${stats.slowest.toFixed(1)} ms</strong></div>
          <div class="card"><small>JavaScript belleği</small><strong style="display:block;font-size:18px">${memory}</strong></div>
        </div>
        <div class="card mt-3"><h2>Yerel veri büyüklükleri</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">${datasets.map(([label, value]) => `<div style="padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm)"><small>${esc(label)}</small><strong style="display:block;font-size:18px">${value}</strong></div>`).join('')}</div></div>
        <div class="card mt-3"><div class="flex justify-between items-center"><h2>Son sayfa süreleri</h2><button class="btn btn-ghost btn-sm" data-perf-refresh>Yenile</button></div><div style="max-height:420px;overflow:auto"><table class="data-table"><thead><tr><th>İşlem</th><th>Süre</th><th>Zaman</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Henüz ölçüm yok.</td></tr>'}</tbody></table></div></div>
      </div>`;
    page.querySelector('[data-perf-refresh]')?.addEventListener('click', () => window.navigate('performance_diagnostics'));
    return page;
  }

  window.MTBPerformanceDiagnostics = Object.freeze({ render, summary });
})();
