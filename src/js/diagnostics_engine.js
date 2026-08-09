(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DiagnosticEngine = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function scanGcode(source) {
    const errors = [];
    let hasFeedrate = false;
    let hasSpindleSpeed = false;
    let hasG43 = false;
    let hasHadToolChange = false;
    let inRapidMode = true;

    String(source || '').split('\n').forEach((line, index) => {
      const clean = line.replace(/\([^)]*\)/g, '').replace(/;.*$/, '').toUpperCase().trim();
      if (!clean) return;

      const hasRapid = /\bG0*0\b/.test(clean);
      const hasFeedMotion = /\bG0*[123]\b/.test(clean);
      if (hasRapid && !hasFeedMotion) inRapidMode = true;
      if (hasFeedMotion && !hasRapid) inRapidMode = false;

      if (/\bG43\b/.test(clean)) hasG43 = true;
      if (/\bG49\b/.test(clean)) hasG43 = false;

      if (/\bM0*6\b/.test(clean) || /\bT\d+\b/.test(clean)) {
        if (/\bM0*6\b/.test(clean)) {
          hasG43 = false;
          hasHadToolChange = true;
        }
      }

      const sMatch = clean.match(/\bS(\d+)\b/);
      if (sMatch && Number(sMatch[1]) > 0) hasSpindleSpeed = true;
      if (/\bM0*[34]\b/.test(clean) && !hasSpindleSpeed && (!sMatch || Number(sMatch[1]) <= 0)) {
        errors.push({ line: index + 1, type: 'warning', title: 'Devirsiz Mil Dönüşü', desc: 'M03/M04 komutu verildi fakat mil devri (S > 0) tanımlanmadı.' });
      }

      const fMatch = clean.match(/\bF(\d+(?:\.\d+)?)\b/);
      if (fMatch && Number(fMatch[1]) > 0) hasFeedrate = true;
      if (hasFeedMotion && !hasFeedrate && (!fMatch || Number(fMatch[1]) <= 0)) {
        errors.push({ line: index + 1, type: 'danger', title: 'Tanımsız İlerleme Hızı (F)', desc: 'Kesme hareketi başlatıldı fakat ilerleme hızı (F > 0) tanımlanmadı.' });
      }

      const noDecimalRegex = /(?:^|[^A-Z0-9.])([XYZIJKUWVABC])(-?\d+)(?!\.)(?=[^0-9.]|$)/g;
      let match;
      while ((match = noDecimalRegex.exec(clean)) !== null) {
        errors.push({ line: index + 1, type: 'danger', title: 'Nokta Hatası Algılandı', desc: `"${match[1]}${match[2]}" komutunda ondalık nokta eksik.` });
      }

      const zMatch = clean.match(/\bZ(-?\d+(?:\.\d+)?)\b/);
      if (inRapidMode && zMatch && Number(zMatch[1]) < 0) {
        errors.push({ line: index + 1, type: 'danger', title: 'Hızlı Hareketle Z- Dalışı', desc: 'G00 modunda Z- hareketi tespit edildi; çarpışma riski operatör tarafından doğrulanmalıdır.' });
      }

      if (hasHadToolChange && zMatch && !hasG43 && (inRapidMode || hasFeedMotion)) {
        errors.push({ line: index + 1, type: 'warning', title: 'G43 Boy Telafisi Eksik', desc: 'Takım değişiminden sonra Z hareketinde G43 etkin görünmüyor.' });
      }
    });

    return errors;
  }

  function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
  function calculateGearRatio({ pitch, encoder, motorTeeth, screwTeeth, lci }) {
    const values = [pitch, encoder, motorTeeth, screwTeeth, lci].map(Number);
    if (values.some(v => !Number.isFinite(v) || v <= 0)) return null;
    const commandUnits = values[0] / values[4];
    let numerator = values[1] * values[3];
    let denominator = commandUnits * values[2];
    const divisor = gcd(numerator, denominator) || 1;
    numerator /= divisor; denominator /= divisor;
    let approximated = false;
    if (numerator > 32767 || denominator > 32767) {
      const scale = Math.max(numerator, denominator) / 30000;
      numerator = Math.round(numerator / scale); denominator = Math.round(denominator / scale); approximated = true;
    }
    return { numerator, denominator, commandUnits, approximated };
  }

  function generateBacklashGcode({ axis = 'X', distance = 10, feed = 500, dwell = 2 }) {
    axis = ['X', 'Y', 'Z'].includes(String(axis).toUpperCase()) ? String(axis).toUpperCase() : 'X';
    distance = Number(distance) || 10; feed = Number(feed) || 500; dwell = Number(dwell) || 2;
    return `%\nO1851 (BACKLASH TEST ${axis})\nG21 G90 G94 (Metric, Abs, Feed/Min)\nG00 ${axis}0.0 (Baslangic noktasina konumlan)\nG04 X${dwell.toFixed(1)} (Komparator saati ayarlamak icin bekleme)\nG01 ${axis}${distance.toFixed(3)} F${feed} (Ileri hareket - Komparator saati 0 yapin)\nG04 X${dwell.toFixed(1)} (Ileri okuma beklemesi)\nG01 ${axis}0.0 F${feed} (Geri hareket - Sapmayi olcun)\nG04 X${dwell.toFixed(1)} (Geri okuma beklemesi)\nM30\n%`;
  }
  function calculateBacklash(measuredMm, currentMicrons) {
    const measuredMicrons = Math.round((Number(measuredMm) || 0) * 1000);
    return { measuredMicrons, newValue: (Number.parseInt(currentMicrons, 10) || 0) + measuredMicrons };
  }
  function maskSensitive(text, machineNames = [], userName = '') {
    let safe = String(text || '')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP MASKELENDİ]')
      .replace(/\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, '[IP MASKELENDİ]')
      .replace(/[A-Z]:\\[^\s]+/gi, '[DOSYA YOLU MASKELENDİ]')
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[E-POSTA MASKELENDİ]')
      .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]+)\b/g, '[TOKEN MASKELENDİ]')
      .replace(/\b(?:SN|S\/N|Seri\s*No|Serial)[:\s=]*[A-Z0-9-]{4,20}\b/gi, '[SERİ NO MASKELENDİ]')
      .replace(/\b(?:PIN|pin|passcode)[:\s=]*\d{4,8}\b/gi, '[PIN MASKELENDİ]')
      .replace(/(?:password|passwd|pass|pwd|secret)[:\s=]+[^\s,;]+/gi, '[PAROLA MASKELENDİ]');
    [...machineNames, userName].filter(v => String(v).trim().length > 2).forEach(value => { safe = safe.split(String(value).trim()).join(value === userName ? '[KULLANICI MASKELENDİ]' : '[MAKİNE MASKELENDİ]'); });
    return safe;
  }
  return { scanGcode, calculateGearRatio, generateBacklashGcode, calculateBacklash, maskSensitive };
});
