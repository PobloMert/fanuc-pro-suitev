(function sourceProvenance(global) {
  'use strict';

  const SOURCE_TYPES = Object.freeze({
    manual: 'FANUC kılavuzuyla karşılaştırıldı',
    oem: 'OEM doğrulaması gerekli',
    series: 'Seriye göre değişebilir',
    field: 'Kullanıcı saha notu',
    adapter: 'Adaptör verisi'
  });
  const SERIES = Object.freeze(['0i-D', '0i-F', '0i-F Plus', '30i/31i/32i-B', '30i/31i/32i-B Plus']);

  const textOf = item => [item?.series, item?.title, item?.type, item?.category, item?.description].filter(Boolean).join(' ');
  function inferSeries(item) {
    const text = textOf(item);
    if (/0i[- ]?D/i.test(text)) return ['0i-D'];
    if (/0i[- ]?F.*Plus/i.test(text)) return ['0i-F Plus'];
    if (/0i[- ]?F/i.test(text)) return ['0i-F'];
    if (/(30i|31i|32i).*Plus/i.test(text)) return ['30i/31i/32i-B Plus'];
    if (/(30i|31i|32i)/i.test(text)) return ['30i/31i/32i-B'];
    return [...SERIES];
  }
  function normalize(item, defaults = {}) {
    if (!item || typeof item !== 'object') return item;
    const sourceType = item.sourceType || defaults.sourceType || 'series';
    const note = item.applicabilityNote || defaults.applicabilityNote || 'Kontrol modeli, yazılım revizyonu ve makine üreticisi dokümanıyla doğrulayın.';
    return {
      ...item,
      sourceType,
      sourceLabel: SOURCE_TYPES[sourceType] || SOURCE_TYPES.series,
      manualNumber: item.manualNumber || defaults.manualNumber || 'Kılavuz numarası belirtilmemiş',
      manualRevision: item.manualRevision || defaults.manualRevision || 'Revizyon belirtilmemiş',
      applicableSeries: item.applicableSeries || defaults.applicableSeries || inferSeries(item),
      applicabilityNote: note.startsWith(SOURCE_TYPES[sourceType] || SOURCE_TYPES.series) ? note : `${SOURCE_TYPES[sourceType] || SOURCE_TYPES.series}. ${note}`
    };
  }
  function enrichState(state) {
    if (!state) return state;
    const collections = ['alarms', 'parameters', 'library', 'drive_alarms', 'pmc_signals'];
    collections.forEach(key => {
      if (!Array.isArray(state[key])) return;
      const defaults = key === 'library'
        ? { sourceType: 'manual', manualNumber: 'Belge kimliği kaydında', manualRevision: 'Kayıt revizyonu' }
        : { sourceType: 'series' };
      state[key] = state[key].map(item => normalize(item, {
        ...defaults,
        manualNumber: item?.manualNumber || (key === 'library' ? item?.id : defaults.manualNumber)
      }));
    });
    return state;
  }
  function badge(meta) {
    const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const normalized = normalize(meta);
    return `<span class="tag tag-gray" title="${safe(normalized.applicabilityNote)}">${safe(normalized.sourceLabel)}</span>`;
  }

  global.MTBSourceProvenance = Object.freeze({ SOURCE_TYPES, SERIES, normalize, enrichState, badge });
})(window);
