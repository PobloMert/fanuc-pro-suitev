(() => {
  'use strict';
  const normalize = value => String(value ?? '').trim().toLocaleLowerCase('tr-TR');
  const empty = Object.freeze([]);
  let cachedState = null, cachedRefs = null, cachedLengths = null, cachedIndex = null;
  const add = (map, key, item) => { if (key) { if (!map.has(key)) map.set(key, []); map.get(key).push(item); } };
  function makeRecordIndex(items) {
    const byId = new Map(), byName = new Map();
    (items || []).forEach(item => { const id = item?.tezgah_id ?? item?.machine_id; if (id !== undefined && id !== null && id !== '') add(byId, String(id), item); add(byName, normalize(item?.machine ?? item?.machine_name), item); });
    return { byId, byName };
  }
  function matchesFor(index, machine) {
    if (!machine) return empty;
    const idItems = index.byId.get(String(machine.id)) || empty;
    const nameItems = index.byName.get(normalize(machine.numarasi || machine.name)) || empty;
    if (!idItems.length) return nameItems; if (!nameItems.length) return idItems;
    return [...new Set([...idItems, ...nameItems])];
  }
  function build(state) {
    const refs = [state?.maintenances, state?.batteries, state?.fans, state?.backup_logs];
    const lengths = refs.map(items => items?.length || 0);
    if (cachedState === state && cachedRefs?.every((value, index) => value === refs[index]) && cachedLengths?.every((value, index) => value === lengths[index])) return cachedIndex;
    cachedState = state; cachedRefs = refs; cachedLengths = lengths;
    const indexes = refs.map(makeRecordIndex);
    cachedIndex = Object.freeze({ forMachine(machine) { return { maintenance: matchesFor(indexes[0], machine), batteries: matchesFor(indexes[1], machine), fans: matchesFor(indexes[2], machine), backups: matchesFor(indexes[3], machine) }; } });
    return cachedIndex;
  }
  function debounce(callback, wait = 180) { let timer; return function (...args) { clearTimeout(timer); timer = setTimeout(() => callback.apply(this, args), wait); }; }
  function paginate(items, page = 1, pageSize = 50) {
    const source = Array.isArray(items) ? items : empty, size = Math.max(1, Math.min(250, Number(pageSize) || 50));
    const totalPages = Math.max(1, Math.ceil(source.length / size)), current = Math.max(1, Math.min(totalPages, Number(page) || 1)), start = (current - 1) * size;
    return { items: source.slice(start, start + size), page: current, pageSize: size, total: source.length, totalPages };
  }
  const metrics = [];
  function measure(name, callback) { const start = performance.now(); try { return callback(); } finally { metrics.push({ name: String(name), duration: Math.round((performance.now() - start) * 10) / 10, at: new Date().toISOString() }); if (metrics.length > 100) metrics.splice(0, metrics.length - 100); } }
  function record(name, startedAt) { metrics.push({ name: String(name), duration: Math.round((performance.now() - startedAt) * 10) / 10, at: new Date().toISOString() }); if (metrics.length > 100) metrics.splice(0, metrics.length - 100); }
  window.MTBPerformance = Object.freeze({ buildRecordIndex: build, debounce, paginate, measure, getMetrics: () => metrics.map(item => ({ ...item })) });
  if (typeof document !== 'undefined') document.addEventListener('click', event => {
    const navigation = event.target.closest?.('[data-page], [data-ops-nav], [data-machine-nav], [data-fanuc-nav]');
    if (!navigation) return;
    const page = navigation.dataset.page || navigation.dataset.opsNav || navigation.dataset.machineNav || navigation.dataset.fanucNav;
    const startedAt = performance.now();
    (window.requestAnimationFrame || (callback => setTimeout(callback, 0)))(() => record(`page-render:${page}`, startedAt));
  }, true);
})();
