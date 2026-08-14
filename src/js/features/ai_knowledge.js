(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AIKnowledgeFeature = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function buildMachineContext(state) {
    const diagnostic = state.activeDiagnostic ? `Aktif teşhis: ${state.activeDiagnostic.type} ${state.activeDiagnostic.code || ''}` : 'Aktif teşhis yok';
    const machines = (state.machines || []).slice(0, 4).map(m => `${m.numarasi || m.name || 'Makine'}; model=${m.model || m.kontrol || 'bilinmiyor'}; durum=${m.status || 'bilinmiyor'}`);
    let maintSnippet = '';
    if (state.activeDiagnostic?.type === 'machine') {
      const targetMach = state.activeDiagnostic.data || (state.machines || []).find(m => m.numarasi === state.activeDiagnostic.code);
      if (targetMach) {
        const logs = (state.maintenances || []).filter(m => Number(m.tezgah_id) === Number(targetMach.id)).slice(-3).reverse();
        if (logs.length) {
          maintSnippet = `\n[${targetMach.numarasi} Son Bakım Kayıtları]:\n` + logs.map(l => `- ${l.tarih} (${l.bakim_yapan || 'Teknisyen'}): ${l.aciklama}`).join('\n');
        }
      }
    }
    return `[YEREL MAKİNE VE ALARM BAĞLAMI]\n${diagnostic}\n${machines.join('\n')}${maintSnippet}`;
  }
  function maskForCloud(text, state, masker) {
    const names = (state.machines || []).map(machine => machine.numarasi || machine.name || '');
    return masker(text, names, state.currentUser?.name || '');
  }
  return { buildMachineContext, maskForCloud };
});
