/**
 * MTB Elektrik Bakım — Spotlight Search (Ctrl+K)
 */

import { State } from '../state.js';
import { escapeHTML } from '../utils.js';

export function openSpotlight() {
  const overlay = document.getElementById('spotlight-overlay');
  const input = document.getElementById('spotlight-input');
  const results = document.getElementById('spotlight-results');
  if (!overlay || !input || !results) return;

  overlay.classList.add('open');
  input.value = '';
  results.innerHTML = '<div id="spotlight-empty">Aramak istediğiniz alarm, parametre, tezgah, bakım kaydı veya PDF kılavuzu yazın...</div>';
  setTimeout(() => input.focus(), 80);
}

export function closeSpotlight(event) {
  const overlay = document.getElementById('spotlight-overlay');
  if (!overlay) return;
  if (!event || event.target === overlay) {
    overlay.classList.remove('open');
  }
}

export function spotlightSearch(query) {
  const q = (query || '').trim().toLowerCase();
  const resultsEl = document.getElementById('spotlight-results');
  if (!resultsEl) return;

  if (!q || q.length < 2) {
    resultsEl.innerHTML = '<div id="spotlight-empty">En az 2 karakter giriniz...</div>';
    return;
  }

  const results = [];
  const includes = (...values) => values.some(value => String(value || '').toLocaleLowerCase('tr-TR').includes(q));

  // Alarms
  State.alarms.filter(a => (a.code || '').toLowerCase().includes(q) || (a.title || '').toLowerCase().includes(q)).slice(0, 4).forEach(a => {
    results.push({ icon: '🚨', title: a.code + ' — ' + a.title, sub: a.category || '', type: 'Alarm', action: () => window.navigate && window.navigate('alarms') });
  });
  // Parameters
  State.parameters.filter(p => String(p.number || p.no || '').includes(q) || (p.description || '').toLowerCase().includes(q)).slice(0, 4).forEach(p => {
    results.push({ icon: '⚙️', title: 'P' + (p.number || p.no) + ' — ' + (p.description || p.name || ''), sub: p.group || p.category || '', type: 'Parametre', action: () => window.navigate && window.navigate('parameters') });
  });
  // Machines
  State.machines.filter(m => includes(m.name, m.numarasi, m.serial, m.bolum, m.tip, m.fanucProfile?.series, m.fanucProfile?.serial, m.fanucProfile?.modules)).slice(0, 4).forEach(m => {
    results.push({ icon: '🏭', title: m.numarasi || m.name, sub: `${m.fanucProfile?.series || m.tip || 'Tezgâh'} · ${m.bolum || ''}`, type: 'Tezgâh', action: () => { window.ActiveFanucMachineId = m.id; window.navigate && window.navigate('fanuc_center'); } });
  });
  State.machines.flatMap(m => (m.moduleInventory || []).map(module => ({ machine:m, module })))
    .filter(({machine,module}) => includes(module.name, module.model, module.serial, module.category, module.location, module.axis, machine.numarasi))
    .slice(0, 5).forEach(({machine,module}) => results.push({ icon:'▦', title:`${module.model} — ${module.name}`, sub:`${machine.numarasi || machine.name} · ${module.location || module.axis || module.category}`, type:'Pano Modülü', action:() => { window.ActiveFanucMachineId = machine.id; window.navigate && window.navigate('fanuc_center'); } }));
  // Maintenance
  State.maintenances.filter(r => (r.description || '').toLowerCase().includes(q) || (r.machine_name || '').toLowerCase().includes(q)).slice(0, 3).forEach(r => {
    results.push({ icon: '🔧', title: r.description || 'Bakım', sub: (r.machine_name || '') + ' — ' + (r.date || ''), type: 'Bakım', action: () => window.navigate && window.navigate('maintenance') });
  });
  // Library PDF Manuals
  State.library.filter(b => (b.title || '').toLowerCase().includes(q) || (b.category || '').toLowerCase().includes(q)).slice(0, 3).forEach(b => {
    results.push({ icon: '📄', title: b.title, sub: (b.category || 'Doküman') + (b.pdfPath ? ' • PDF Kılavuz Bağlı' : ''), type: 'Kılavuz', action: () => window.navigate && window.navigate('library') });
  });
  // Wiki
  State.wiki.filter(w => (w.title || '').toLowerCase().includes(q) || (w.content || '').toLowerCase().includes(q)).slice(0, 3).forEach(w => {
    results.push({ icon: '📖', title: w.title, sub: w.category || '', type: 'Wiki', action: () => window.navigate && window.navigate('troubleshoot_wiki') });
  });
  // Keep relays
  State.keep_relays.filter(r => (r.address || r.id || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)).slice(0, 2).forEach(r => {
    results.push({ icon: '🔌', title: (r.address || r.id) + ' — ' + (r.description || r.name || ''), sub: '', type: 'Keep Relay', action: () => window.navigate && window.navigate('keep_relays') });
  });
  State.backup_logs.filter(item => includes(item.tip, item.type, item.aciklama, item.description, item.dosya_konumu, item.dosya, item.file, item.machine, item.machine_name, item.son_yedek_tarihi)).slice(0, 3).forEach(item => {
    const machine = State.machines.find(candidate => Number(candidate.id) === Number(item.tezgah_id ?? item.machine_id));
    results.push({ icon:'↥', title:item.dosya_konumu || item.dosya || item.file || item.tip || item.type || 'Yedek kaydı', sub:`${item.machine || item.machine_name || machine?.numarasi || ''} · ${item.son_yedek_tarihi || item.tarih || item.date || ''}`, type:'Yedek', action:() => window.navigate && window.navigate('backup_tracker') });
  });
  (window.FanucCenterCatalog?.scenarios || []).filter(item => includes(item.title, item.category, ...(item.checks || []))).slice(0,3).forEach(item => {
    results.push({ icon:item.icon || '◇', title:item.title, sub:`${item.category} teşhis senaryosu`, type:'FANUC Teşhis', action:() => window.navigate && window.navigate('fanuc_center') });
  });
  (window.FanucCenterCatalog?.ledGuide || []).filter(item => includes(item.code, item.module, item.state, item.checks)).slice(0,3).forEach(item => {
    results.push({ icon:'▣', title:`LED ${item.code} — ${item.state}`, sub:`${item.module} · Model kılavuzuyla doğrulayın`, type:'LED Kodu', action:() => window.navigate && window.navigate('fanuc_center') });
  });

  if (!results.length) {
    resultsEl.innerHTML = `<div id="spotlight-empty">🔍 "<strong>${escapeHTML(query)}</strong>" için sonuç bulunamadı.</div>`;
    return;
  }

  resultsEl.innerHTML = results.map((r, i) => `
    <div class="spotlight-item" onclick="spotlightGo(${i})" id="spl-item-${i}">
      <div class="spotlight-item-icon">${r.icon}</div>
      <div class="spotlight-item-text">
        <div class="spotlight-item-title">${escapeHTML(r.title)}</div>
        ${r.sub ? `<div class="spotlight-item-sub">${escapeHTML(r.sub)}</div>` : ''}
      </div>
      <span class="spotlight-item-type">${escapeHTML(r.type)}</span>
    </div>
  `).join('');

  window._spotlightResults = results;
}

export function spotlightGo(index) {
  const overlay = document.getElementById('spotlight-overlay');
  if (overlay) overlay.classList.remove('open');
  if (window._spotlightResults && window._spotlightResults[index]) {
    window._spotlightResults[index].action();
  }
}

if (typeof window !== 'undefined') {
  window.openSpotlight = openSpotlight;
  window.closeSpotlight = closeSpotlight;
  window.spotlightSearch = spotlightSearch;
  window.spotlightGo = spotlightGo;
}
