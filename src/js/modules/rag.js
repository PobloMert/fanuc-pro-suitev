/**
 * MTB Elektrik Bakım — RAG (Retrieval-Augmented Generation) Engine
 * Scans local FANUC datasets to build precise, zero-hallucination context prompts.
 */

import { State } from '../state.js';

export function buildRAGContext(query) {
  if (!query || typeof query !== 'string') return '';

  const q = query.trim().toLowerCase();
  const contextParts = [];

  // 1. Alarms Match
  const alarmMatches = State.alarms.filter(a => {
    const code = (a.code || '').toLowerCase();
    const title = (a.title || '').toLowerCase();
    return q.includes(code) || (code && code.length > 3 && q.includes(code.replace(/[^a-z0-9]/gi, '')));
  }).slice(0, 3);

  if (alarmMatches.length > 0) {
    contextParts.push("### 🚨 Eşleşen FANUC Alarmları (Yerel Kataloğunuzdan):");
    alarmMatches.forEach(a => {
      let itemStr = `- **${a.code} — ${a.title}** (${a.category || ''} Serisi)\n  *Açıklama:* ${a.description}\n`;
      if (a.causes && a.causes.length) itemStr += `  *Olası Nedenler:* ${a.causes.join(' | ')}\n`;
      if (a.solutions && a.solutions.length) itemStr += `  *Çözüm Adımları:* ${a.solutions.join(' | ')}\n`;
      contextParts.push(itemStr);
    });
  }

  // 2. Drive Alarms Match (Sürücü LED / 7-Segment Kodları)
  const driveMatches = State.drive_alarms.filter(d => {
    const code = (d.code || '').toLowerCase();
    const name = (d.name || '').toLowerCase();
    return (code && q.includes(code)) || (name && q.includes(name));
  }).slice(0, 3);

  if (driveMatches.length > 0) {
    contextParts.push("### ⚡ Eşleşen Sürücü / Amplifikatör Arızaları:");
    driveMatches.forEach(d => {
      contextParts.push(`- **Sürücü Kodu ${d.code} — ${d.name}**\n  *Açıklama:* ${d.description || ''}\n  *Çözüm:* ${d.solution || d.solutions || ''}\n`);
    });
  }

  // 3. Parameters Match
  const paramNumbers = q.match(/\b\d{4}\b/g) || [];
  const paramMatches = State.parameters.filter(p => {
    const pNo = String(p.no || p.number || '');
    return paramNumbers.includes(pNo) || (p.name && q.includes(p.name.toLowerCase()));
  }).slice(0, 3);

  if (paramMatches.length > 0) {
    contextParts.push("### ⚙️ Eşleşen FANUC Parametreleri:");
    paramMatches.forEach(p => {
      contextParts.push(`- **Parametre No.${p.no || p.number} — ${p.name || ''}**\n  *Açıklama:* ${p.description}\n  *Veri Tipi:* ${p.dataType || '—'} | *Aralık:* ${p.range || '—'} | *Varsayılan:* ${p.default || '—'}\n  ${p.note ? `*Not:* ${p.note}\n` : ''}`);
    });
  }

  // 4. PMC Signals Match
  const pmcMatches = State.pmc_signals.filter(s => {
    const addr = (s.address || '').toLowerCase();
    const sym = (s.symbol || '').toLowerCase();
    return (addr && q.includes(addr)) || (sym && q.includes(sym));
  }).slice(0, 3);

  if (pmcMatches.length > 0) {
    contextParts.push("### 🔌 Eşleşen PMC Sinyal Adresleri:");
    pmcMatches.forEach(s => {
      contextParts.push(`- **${s.address} (${s.symbol || ''})** — Yön: ${s.direction || ''}\n  *Açıklama:* ${s.description}\n  ${s.ladder_example ? `*Ladder Örneği:* ${s.ladder_example}\n` : ''}`);
    });
  }

  // 5. Keep Relays Match
  const krMatches = State.keep_relays.filter(k => {
    const id = (k.id || '').toLowerCase();
    const name = (k.name || '').toLowerCase();
    return (id && q.includes(id)) || (name && q.includes(name));
  }).slice(0, 3);

  if (krMatches.length > 0) {
    contextParts.push("### 📌 Eşleşen PMC Keep Relays / Timers:");
    krMatches.forEach(k => {
      contextParts.push(`- **${k.id} — ${k.name}**\n  *Açıklama:* ${k.description}\n  ${k.note ? `*Not:* ${k.note}\n` : ''}`);
    });
  }

  // 6. NC Codes Match
  const ncMatches = State.nc_codes.filter(n => {
    const code = (n.code || '').toLowerCase();
    return code && q.includes(code);
  }).slice(0, 2);

  if (ncMatches.length > 0) {
    contextParts.push("### 📜 Eşleşen NC G/M Kodları:");
    ncMatches.forEach(n => {
      contextParts.push(`- **${n.code} — ${n.name}**\n  *Açıklama:* ${n.description}\n  *Sözdizimi:* ${n.syntax || '—'}\n`);
    });
  }

  if (contextParts.length === 0) {
    return '';
  }

  return `\n[YEREL VERİTABANI KONTROLÜ — RAG BAĞLAMI]:\nAşağıdaki teknik veriler fabrika yerel FANUC veritabanından başarıyla çekilmiştir. Yanıtınızı verirken öncelikle bu resmi teknik verilere dayandırarak adım adım açık ve net yönlendirmeler sunun:\n\n${contextParts.join('\n')}\n`;
}

if (typeof window !== 'undefined') {
  window.buildRAGContext = buildRAGContext;
}
