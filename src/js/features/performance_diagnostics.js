(() => {
  'use strict';
  function render() {
    const page = document.createElement('div');
    page.className = 'page active';
    page.id = 'page-performance_diagnostics';
    if (window.State?.currentUser?.role !== 'admin') {
      page.innerHTML = '<div class="page-body"><div class="empty-state-guided"><h2>Yönetici yetkisi gerekli</h2><p>Performans teşhisi yalnızca yöneticilere açıktır.</p></div></div>';
      return page;
    }
    const metrics = window.MTBPerformance?.getMetrics?.() || [];
    const memory = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB / ${Math.round(performance.memory.jsHeapSizeLimit / 1048576)} MB` : 'Bu cihazda kullanılamıyor';
    const rows = metrics.slice().reverse().map(item => `<tr><td>${escapeText(item.name)}</td><td>${Number(item.duration).toFixed(1)} ms</td><td>${escapeText(item.at)}</td></tr>`).join('');
    page.innerHTML = `<div class="page-header"><h1>Yerel Performans Teşhisi</h1><p>Veriler yalnızca bu oturumun belleğinde tutulur ve dışarı gönderilmez.</p></div><div class="page-body"><div class="grid-2"><div class="card"><small>Kayıtlı ölçüm</small><strong style="display:block;font-size:24px">${metrics.length}</strong></div><div class="card"><small>JavaScript belleği</small><strong style="display:block;font-size:18px">${memory}</strong></div></div><div class="card mt-3"><div class="flex justify-between items-center"><h2>Son sayfa süreleri</h2><button class="btn btn-ghost btn-sm" data-perf-refresh>Yenile</button></div><div style="max-height:420px;overflow:auto"><table class="data-table"><thead><tr><th>İşlem</th><th>Süre</th><th>Zaman</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Henüz ölçüm yok.</td></tr>'}</tbody></table></div></div></div>`;
    page.querySelector('[data-perf-refresh]')?.addEventListener('click', () => window.navigate('performance_diagnostics'));
    return page;
  }
  function escapeText(value) { const node = document.createElement('span'); node.textContent = String(value ?? ''); return node.innerHTML; }
  window.MTBPerformanceDiagnostics = Object.freeze({ render });
})();
