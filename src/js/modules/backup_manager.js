/**
 * MTB Elektrik Bakım — Backup & Restore Manager Module
 */

import { showToast } from '../utils.js';

export async function fetchBackupsList() {
  if (window.electronAPI && window.electronAPI.getBackupsList) {
    const res = await window.electronAPI.getBackupsList();
    if (res && res.ok) return res.items || [];
  }
  return [];
}

export async function triggerManualBackup() {
  if (window.electronAPI && window.electronAPI.createManualBackup) {
    const res = await window.electronAPI.createManualBackup();
    if (res && res.ok) {
      showToast('Manuel sistem yedeği alındı ✓', 'success');
      return true;
    } else {
      showToast('Yedek alma hatası: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  }
  return false;
}

export async function restoreBackupSnapshot(backupFilePath) {
  if (!confirm('Seçilen yedeğe geri dönmek üzeresiniz. Mevcut verilerin üzerine yazılacak. Devam etmek istiyor musunuz?')) {
    return false;
  }
  if (window.electronAPI && window.electronAPI.restoreBackup) {
    const res = await window.electronAPI.restoreBackup(backupFilePath);
    if (res && res.ok) {
      showToast('Veriler yedekten başarıyla geri yüklendi! Uygulama güncelleniyor...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
      return true;
    } else {
      showToast('Yedek geri yükleme hatası: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.fetchBackupsList = fetchBackupsList;
  window.triggerManualBackup = triggerManualBackup;
  window.restoreBackupSnapshot = restoreBackupSnapshot;
}
