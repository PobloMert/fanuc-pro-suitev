(function historyGrowth(global) {
  'use strict';
  const PAGE_SIZE = 100;
  const timestamp = record => Date.parse(record?.createdAt || record?.time || record?.deletedAt || '') || 0;
  function query(records, options = {}) {
    const from = options.from ? new Date(`${options.from}T00:00:00`).getTime() : -Infinity;
    const to = options.to ? new Date(`${options.to}T23:59:59.999`).getTime() : Infinity;
    const filtered = (Array.isArray(records) ? records : []).filter(item => timestamp(item) >= from && timestamp(item) <= to);
    const pageSize = Math.min(250, Math.max(25, Number(options.pageSize) || PAGE_SIZE));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(pages, Math.max(1, Number(options.page) || 1));
    return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pages, pageSize };
  }
  function years(records) {
    return [...new Set((records || []).map(timestamp).filter(Boolean).map(value => new Date(value).getFullYear()))].sort((a,b) => b-a);
  }
  function csv(records) {
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Zaman', 'Tür', 'Kod', 'Açıklama', 'Tezgâh', 'Cihaz'];
    return '\uFEFF' + [header, ...(records || []).map(row => [row.createdAt || row.time, row.type, row.code, row.note, row.machineId || row.tezgah_id, row.deviceId])]
      .map(columns => columns.map(quote).join(';')).join('\r\n');
  }
  function exportYear(records, year, prefix = 'fanuc-teshis') {
    const selected = (records || []).filter(item => new Date(timestamp(item)).getFullYear() === Number(year));
    const blob = new Blob([csv(selected)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `${prefix}-${year}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return selected.length;
  }
  global.MTBHistoryGrowth = Object.freeze({ PAGE_SIZE, timestamp, query, years, csv, exportYear });
})(window);
