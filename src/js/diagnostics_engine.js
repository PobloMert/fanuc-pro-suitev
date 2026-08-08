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
    let inRapidMode = true;
    String(source || '').split('\n').forEach((line, index) => {
      const clean = line.replace(/\([^)]*\)/g, '').toUpperCase().trim();
      if (!clean) return;
      if (clean.includes('G00')) inRapidMode = true;
      if (/G0[123]/.test(clean)) inRapidMode = false;
      if (clean.includes('G43')) hasG43 = true;
      if (clean.includes('T') && clean.includes('M06')) hasG43 = false;
      if (clean.includes('S')) hasSpindleSpeed = true;
      if (/M0[34]/.test(clean) && !hasSpindleSpeed && !clean.includes('S')) errors.push({ line: index + 1, type: 'warning', title: 'Devirsiz Mil Dönüşü', desc: 'M03/M04 komutu verildi fakat mil devri (S) tanımlanmadı.' });
      if (clean.includes('F')) hasFeedrate = true;
      if (/G0[123]/.test(clean) && !hasFeedrate && !clean.includes('F')) errors.push({ line: index + 1, type: 'danger', title: 'Tanımsız İlerleme Hızı (F)', desc: 'Kesme hareketi başlatıldı fakat ilerleme hızı (F) tanımlanmadı.' });
      const coordinates = clean.match(/\b([XYZIJKUWV])(-?\d+)(?!\.)\b/g) || [];
      coordinates.forEach(value => errors.push({ line: index + 1, type: 'danger', title: 'Nokta Hatası Algılandı', desc: `"${value}" komutunda ondalık nokta eksik.` }));
      if (inRapidMode && clean.includes('Z-')) errors.push({ line: index + 1, type: 'danger', title: 'Hızlı Hareketle Z- Dalışı', desc: 'G00 modunda Z- hareketi tespit edildi; çarpışma riski operatör tarafından doğrulanmalıdır.' });
      if (clean.includes('Z') && !hasG43 && /G0[01]/.test(clean)) errors.push({ line: index + 1, type: 'warning', title: 'G43 Boy Telafisi Eksik', desc: 'Takım değişiminden sonra Z hareketinde G43 etkin görünmüyor.' });
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
    let safe = String(text || '').replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP MASKELENDİ]').replace(/[A-Z]:\\[^\s]+/gi, '[DOSYA YOLU MASKELENDİ]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[E-POSTA MASKELENDİ]').replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,})\b/g, '[API ANAHTARI MASKELENDİ]');
    [...machineNames, userName].filter(v => String(v).trim().length > 2).forEach(value => { safe = safe.split(String(value).trim()).join(value === userName ? '[KULLANICI MASKELENDİ]' : '[MAKİNE MASKELENDİ]'); });
    return safe;
  }
  return { scanGcode, calculateGearRatio, generateBacklashGcode, calculateBacklash, maskSensitive };
});
