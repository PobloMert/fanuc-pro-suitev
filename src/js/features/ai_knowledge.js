(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AIKnowledgeFeature = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function buildMachineContext(state) {
    const diagnostic = state.activeDiagnostic ? `Aktif teşhis: ${state.activeDiagnostic.type} ${state.activeDiagnostic.code || ''}` : 'Aktif teşhis yok';
    const machines = (state.machines || []).slice(0, 4).map(m => `${m.numarasi || m.name || 'Makine'}; model=${m.model || m.kontrol || 'bilinmiyor'}; durum=${m.status || 'bilinmiyor'}`);
    return `[YEREL MAKİNE VE ALARM BAĞLAMI]\n${diagnostic}\n${machines.join('\n')}`;
  }
  function maskForCloud(text, state, masker) {
    const names = (state.machines || []).map(machine => machine.numarasi || machine.name || '');
    return masker(text, names, state.currentUser?.name || '');
  }
  return { buildMachineContext, maskForCloud };
});
