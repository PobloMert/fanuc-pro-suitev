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

  // Helper for PMC Address Normalization (X4.2 <-> X0004.2, G8.4 <-> G0008.4)
  function normalizeAddr(addrStr) {
    if (!addrStr) return '';
    const clean = String(addrStr).toLowerCase().trim();
    // Convert X4.2 -> X0004.2 or X0004.2 -> X4.2
    return clean.replace(/([xygfk])0*(\d+)\.(\d+)/g, '$1$2.$3');
  }

  const normalizedQuery = normalizeAddr(q);

  // 3. Parameters Match (Support 1 to 5 digit parameter numbers e.g. P20, P102, P1320, P1815, P12000)
  const paramNumbers = q.match(/\b\d{1,5}\b/g) || [];
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

  // 4. PMC Signals Match (Supports normalized short forms like X4.2, G8.4, F1.0)
  const pmcMatches = State.pmc_signals.filter(s => {
    const addr = (s.address || '').toLowerCase();
    const normAddr = normalizeAddr(addr);
    const sym = (s.symbol || '').toLowerCase();
    return (addr && (q.includes(addr) || normalizedQuery.includes(normAddr))) || (sym && q.includes(sym));
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
    const normId = normalizeAddr(id);
    const name = (k.name || '').toLowerCase();
    return (id && (q.includes(id) || normalizedQuery.includes(normId))) || (name && q.includes(name));
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

  // 7. Official FANUC PDF Manuals Knowledge & Citation Mapping
  const pdfManualCitations = [
    { keywords: ['1815', '1850', 'grid shift', 'apc', 'apz', '3202', 'ne9', '1320', 'stroke', '3111', '1851', 'backlash', 'parametre', '6000', 'thermal'], title: 'FANUC Series 0i-MF / 31i-B Parametre El Kitabı', manualNo: 'B-64310EN', section: 'Bölüm 4 — Sistem, Eksen & Termal Kompanzasyon Parametreleri' },
    { keywords: ['sv0401', 'sv0438', 'sv0449', 'vrdy', 'servo', 'overcurrent', 'hcam', 'a06b-6114', 'a06b-6124', 'encoder', 'pil', 'batarya'], title: 'FANUC Servo Sürücü Alpha i / Beta i Bakım Kılavuzu', manualNo: 'B-65270EN', section: 'Bölüm 7 — Servo Alarm & LED Teşhis Adımları' },
    { keywords: ['sp9011', 'sp9012', 'ssm', 'spindle', 'a06b-6117', 'a06b-6127', 'motor', 'overheat'], title: 'FANUC Spindle Sürücü & Amplifikatör Arıza Kılavuzu', manualNo: 'B-65282EN', section: 'Bölüm 5 — Spindle LED & Yük Teşhisi' },
    { keywords: ['pmc', 'ladder', 'k00', 'keep relay', 'g8.4', 'f1.0', 'x4.2', 'y2.1', 'x0004.2', 'g0008.4', 'rs232', 'sr0085', 'sr0086', 'ps0085', 'p0101', 'p0103'], title: 'FANUC PMC Ladder & Sinyal Adres Spesifikasyonu', manualNo: 'B-64303EN', section: 'Bölüm 3 — PMC X/Y/G/F Sinyal Tablosu & Haberleşme' }
  ];

  const matchedPdfs = pdfManualCitations.filter(pm => pm.keywords.some(kw => q.includes(kw)));
  if (matchedPdfs.length > 0) {
    contextParts.push("### 📖 Eşleşen Resmi FANUC PDF El Kitapçıkları & Sayfa Referansları:");
    matchedPdfs.forEach(pm => {
      contextParts.push(`- **[${pm.manualNo}] ${pm.title}** (${pm.section})\n  *Google Drive Kütüphanesi:* https://drive.google.com/drive/folders/1UEJP5MTj6cAkYvGmHI8DDMfEiKnQFIAx\n`);
    });
  }

  if (contextParts.length === 0) {
    return '';
  }

  return `\n[YEREL VERİTABANI VE RESMİ FANUC PDF KILAVUZ KONTROLÜ — RAG BAĞLAMI]:\nAşağıdaki teknik veriler ve resmi FANUC PDF el kitapçığı sayfa referansları fabrika yerel veritabanınızdan çekilmiştir. Yanıtınızı sunarken mutlaka ilgili PDF Kılavuz Kodunu ([B-64310EN], [B-65270EN] vb.) kaynak gösterin:\n\n${contextParts.join('\n')}\n🔗 **Canlı PDF Kütüphanesi:** https://drive.google.com/drive/folders/1UEJP5MTj6cAkYvGmHI8DDMfEiKnQFIAx\n`;
}

export function buildRAGResult(query) {
  const context = buildRAGContext(query);
  const q = String(query || '').toLowerCase();
  const sources = [];
  State.alarms.filter(a => q.includes(String(a.code || '').toLowerCase())).slice(0, 3)
    .forEach(a => sources.push({ type: 'Alarm kataloğu', id: a.code, title: a.title }));
  const numbers = q.match(/\b\d{4}\b/g) || [];
  State.parameters.filter(p => numbers.includes(String(p.no || p.number || ''))).slice(0, 3)
    .forEach(p => sources.push({ type: 'Parametre veritabanı', id: String(p.no || p.number), title: p.name }));
  State.pmc_signals.filter(s => q.includes(String(s.address || '').toLowerCase()) || q.includes(String(s.symbol || '').toLowerCase())).slice(0, 3)
    .forEach(s => sources.push({ type: 'PMC sinyal kataloğu', id: s.address, title: s.symbol }));
  State.nc_codes.filter(n => q.includes(String(n.code || '').toLowerCase())).slice(0, 2)
    .forEach(n => sources.push({ type: 'NC kod kataloğu', id: n.code, title: n.name }));
  State.keep_relays.filter(k => q.includes(String(k.id || '').toLowerCase())).slice(0, 2)
    .forEach(k => sources.push({ type: 'Keep relay kataloğu', id: k.id, title: k.name }));
  return { context, sources };
}

if (typeof window !== 'undefined') {
  window.buildRAGContext = buildRAGContext;
  window.buildRAGResult = buildRAGResult;
}
