(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AlarmParameterFeature = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function filterAlarms(items, { query = '', category = '', series = '' } = {}) {
    const raw = String(query).toLowerCase().trim();
    const compact = raw.replace(/[^a-z0-9]/g, '');
    return (items || []).filter(item => {
      if (category && item.category !== category) return false;
      if (series && !(item.series || []).includes(series)) return false;
      if (!raw) return true;
      const code = String(item.code || '').toLowerCase();
      const queryNumber = raw.match(/\d+/)?.[0];
      const codeNumber = code.match(/\d+/)?.[0];
      const alpha = raw.replace(/\d+/g, '').replace(/[^a-z]/g, '');
      const numericNear = queryNumber && codeNumber && (!alpha || code.replace(/\d+/g, '').replace(/[^a-z]/g, '').includes(alpha)) && (codeNumber.includes(queryNumber) || Math.abs(Number(codeNumber) - Number(queryNumber)) <= 5);
      return numericNear || code.includes(raw) || (compact && code.replace(/[^a-z0-9]/g, '').includes(compact)) || String(item.title || '').toLowerCase().includes(raw) || String(item.description || '').toLowerCase().includes(raw);
    });
  }
  function filterParameters(items, { query = '', category = '', range = 'all' } = {}) {
    const q = String(query).toLowerCase();
    const bounds = { '1000-1200': [1000,1200], '1300-1400': [1300,1400], '1800-1900': [1800,1900], '3000-3300': [3000,3300], '4000-4100': [4000,4100] }[range];
    return (items || []).filter(item => (!q || String(item.no).includes(q) || String(item.name || '').toLowerCase().includes(q) || String(item.description || '').toLowerCase().includes(q)) && (!category || item.category === category) && (!bounds || (Number(item.no) >= bounds[0] && Number(item.no) <= bounds[1])));
  }
  return { filterAlarms, filterParameters };
});
