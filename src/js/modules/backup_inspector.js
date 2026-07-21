/**
 * MTB Elektrik Bakım — FANUC SRAM, Parameter & PMC Ladder Backup Inspector
 */

export function inspectBackupFile(dataStringOrBuffer, fileName = '') {
  const nameUpper = fileName.toUpperCase();
  let type = 'Bilinmeyen FANUC Dosyası';
  let category = 'Genel';
  let controlSeries = 'FANUC 0i / 31i / 18i Serisi Uyumlu';
  let estimatedSize = '0 KB';
  let isValid = true;
  let details = [];

  const rawLength = typeof dataStringOrBuffer === 'string' ? dataStringOrBuffer.length : (dataStringOrBuffer ? dataStringOrBuffer.byteLength : 0);
  estimatedSize = Math.round(rawLength / 1024) + ' KB';

  if (nameUpper.includes('SRAM') || nameUpper.endsWith('.FDB') || nameUpper.endsWith('.MEM')) {
    type = 'SRAM Sistem İmajı (System Memory Dump)';
    category = 'Kritik Sistem İmajı';
    
    if (rawLength >= 8000000) {
      controlSeries = 'FANUC 30i / 31i / 32i Model B (8 MB SRAM)';
    } else if (rawLength >= 4000000) {
      controlSeries = 'FANUC 0i-F / 0i-D (4 MB SRAM)';
    } else if (rawLength >= 2000000) {
      controlSeries = 'FANUC 0i-MC / 0i-TC (2 MB SRAM)';
    } else if (rawLength >= 1000000) {
      controlSeries = 'FANUC 16i / 18i / 21i (1 MB SRAM)';
    } else {
      controlSeries = 'FANUC 0-M / 0-T Legacy Serisi';
    }

    details.push('Tüm Sistem Parametreleri, Pitch Error, Werkzeug Offset ve Makro Değişkenlerini İçerir.');
    details.push('Boş Parça & Sistem Çökmesinde SRAM Boot Ekranından Geri Yüklenebilir.');
  } else if (nameUpper.includes('PARM') || nameUpper.includes('CNCPARAM') || nameUpper.endsWith('.DAT')) {
    type = 'CNC Parametre Yedek Dosyası';
    category = 'Sistem Parametreleri';
    controlSeries = 'Tüm FANUC 0i / 16i / 18i / 31i Kontrolörler';

    if (typeof dataStringOrBuffer === 'string') {
      const match1815 = dataStringOrBuffer.match(/N1815/g);
      const match1006 = dataStringOrBuffer.match(/N1006/g);
      if (match1815) details.push(`Eksen Referans (P1815) Blokları Doğrulandı (${match1815.length} Adet).`);
      if (match1006) details.push('Eksen Tanım (P1006) Blokları Mevcut.');
    }
    details.push('MDI modunda I/O kanalı üzerinden RS232 / USB / Ethernet ile yüklenebilir.');
  } else if (nameUpper.includes('LADDER') || nameUpper.endsWith('.PMC') || nameUpper.endsWith('.LAD')) {
    type = 'PMC Ladder Merdiven Diyagramı (PLC Logic)';
    category = 'PLC & Dizilim Yazılımı';
    controlSeries = 'FANUC PMC-SA1 / PMC-SB7 / PMC-30i';
    details.push('Makine imalatçısının (MTB) PLC merdiven mantığı kodlarını içerir.');
    details.push('FANUC LADDER-III yazılımı ile açılabilir ve düzenlenebilir.');
  } else if (nameUpper.endsWith('.NC') || nameUpper.endsWith('.TXT') || nameUpper.endsWith('.PRG')) {
    type = 'NC Program & Makro Kütüphanesi';
    category = 'NC Programlar';
    details.push('G-Kodu parçaları ve O9000 özel makro programlarını içerir.');
  } else {
    isValid = false;
    details.push('Standart FANUC dosya formatı tespit edilemedi ancak ham metin/ikili olarak saklanabilir.');
  }

  return {
    fileName,
    type,
    category,
    controlSeries,
    estimatedSize,
    isValid,
    details
  };
}

if (typeof window !== 'undefined') {
  window.inspectBackupFile = inspectBackupFile;
}
