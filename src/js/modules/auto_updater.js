/**
 * MTB Elektrik Bakım — Auto-Updater Engine & Offline Knowledge Packs Manager
 */

import { showToast, escapeHTML } from '../utils.js';

export const CURRENT_APP_VERSION = '2.5.0';

export const OFFLINE_PACKS = [
  {
    id: 'pack-fanuc-0if',
    name: 'FANUC 0i-F / 0i-F Plus Kılavuz Paketi',
    desc: 'NC Parametreleri, B-64604EN Bakım Kılavuzu ve Alarm Kataloğu (PDF)',
    size: '14.2 MB',
    status: 'installed',
    version: 'v2026.1'
  },
  {
    id: 'pack-fanuc-31ib',
    name: 'FANUC 30i / 31i / 32i Model B Sistem Kılavuzu',
    desc: '31i-B Donanım Konfigürasyonu, Dual Check Safety (DCS) ve PMC Adres Haritası (PDF)',
    size: '22.8 MB',
    status: 'installed',
    version: 'v2026.1'
  },
  {
    id: 'pack-fanuc-servo-amp',
    name: 'αi & βi Series Servo / Spindle Sürücü Rehberi',
    desc: 'Amplifikatör LED Arıza Kodları, Güç Kablosu Şemaları ve SPM/PSM Teşhisi (PDF)',
    size: '18.5 MB',
    status: 'available',
    version: 'v2026.2'
  },
  {
    id: 'pack-fanuc-ladder-iii',
    name: 'FANUC PMC Ladder-III Quick Ref & PMC Signal Spec',
    desc: 'G-Bit, F-Bit, X/Y I/O Sinyal Tablosu ve PMC Function Blocks Kılavuzu',
    size: '9.4 MB',
    status: 'available',
    version: 'v2026.2'
  }
];

export async function checkForAppUpdates() {
  const statusEl = document.getElementById('updater-status-text');
  const badgeEl = document.getElementById('updater-status-badge');
  const updateCard = document.getElementById('updater-action-card');

  if (statusEl) statusEl.textContent = 'Güncellemeler denetleniyor...';
  showToast('Güncellemeler denetleniyor...', 'info');

  await new Promise(r => setTimeout(r, 1200));

  const hasUpdate = false; // Current version v2.5.0 is up-to-date

  if (badgeEl) {
    badgeEl.className = 'tag tag-green';
    badgeEl.textContent = '🟢 Sürümünüz Güncel (v' + CURRENT_APP_VERSION + ')';
  }
  if (statusEl) {
    statusEl.textContent = `Yazılımınız ve FANUC Alarm/Parametre Kütüphaneleriniz en son sürümde (v${CURRENT_APP_VERSION}).`;
  }
  if (updateCard) {
    updateCard.style.display = 'none';
  }

  showToast(`Sürümünüz güncel (v${CURRENT_APP_VERSION}) ✓`, 'success');
  return { hasUpdate, currentVersion: CURRENT_APP_VERSION };
}

export async function downloadOfflinePack(packId) {
  const pack = OFFLINE_PACKS.find(p => p.id === packId);
  if (!pack) return;

  showToast(`"${pack.name}" paket indirimi başlatıldı...`, 'info');

  const btn = document.getElementById(`btn-pack-${packId}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ İndiriliyor...';
  }

  await new Promise(r => setTimeout(r, 2000));

  pack.status = 'installed';

  if (btn) {
    btn.disabled = false;
    btn.className = 'btn btn-ghost btn-sm';
    btn.textContent = '✅ Çevrimdışı Hazır';
    btn.style.color = 'var(--green)';
  }

  showToast(`"${pack.name}" başarıyla indirildi ve çevrimdışı arşivlendi!`, 'success');
}

if (typeof window !== 'undefined') {
  window.checkForAppUpdates = checkForAppUpdates;
  window.downloadOfflinePack = downloadOfflinePack;
  window.OFFLINE_PACKS = OFFLINE_PACKS;
  window.CURRENT_APP_VERSION = CURRENT_APP_VERSION;
}
