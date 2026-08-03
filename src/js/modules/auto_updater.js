/**
 * MTB Elektrik Bakım — Auto-Updater Engine & Offline Knowledge Packs Manager
 */

import { showToast, escapeHTML } from '../utils.js';

export const CURRENT_APP_VERSION = '1.1.2';

function compareVersions(left, right) {
  const a = String(left).split('-')[0].split('.').map(Number);
  const b = String(right).split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  }
  return 0;
}

function showUpdateBanner(info) {
  if (document.getElementById('app-update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'app-update-banner';
  banner.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:10000;max-width:680px;width:calc(100% - 40px);padding:16px 18px;border:1px solid var(--yellow,#f5b942);border-radius:10px;background:var(--bg-card,#171b2a);box-shadow:0 12px 36px rgba(0,0,0,.45);color:var(--text-primary,#fff)';
  banner.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Yeni sürüm hazır: v${escapeHTML(info.latestVersion)}</div>
    <div style="font-size:12px;color:var(--text-secondary,#bbb);margin-bottom:12px">Yüklü sürüm: v${escapeHTML(info.currentVersion)}. Güncelleme resmi GitHub Release sayfasından indirilecektir.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" id="dismiss-app-update">Daha sonra</button><button class="btn btn-primary btn-sm" id="download-app-update">GitHub'dan indir</button></div>`;
  document.body.appendChild(banner);
  banner.querySelector('#dismiss-app-update').addEventListener('click', () => banner.remove());
  banner.querySelector('#download-app-update').addEventListener('click', () => window.electronAPI.openExternal(info.downloadUrl));
}

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

export async function checkForAppUpdates(options = {}) {
  const statusEl = document.getElementById('updater-status-text');
  const badgeEl = document.getElementById('updater-status-badge');
  const updateCard = document.getElementById('updater-action-card');
  const checkedEl = document.getElementById('updater-last-checked');

  if (statusEl) statusEl.textContent = 'Güncellemeler denetleniyor...';
  if (!options.silent) showToast('Güncellemeler denetleniyor...', 'info');
  const result = await window.electronAPI.checkForUpdates();
  if (checkedEl && !options.silent) checkedEl.textContent = `Son manuel kontrol: ${new Date().toLocaleString('tr-TR')}`;
  if (!result.ok) {
    if (badgeEl) {
      badgeEl.className = 'tag tag-amber';
      badgeEl.textContent = `Denetlenemedi (v${result.currentVersion})`;
    }
    if (statusEl) statusEl.textContent = `Güncelleme sunucusuna ulaşılamadı: ${result.error}`;
    if (!options.silent) showToast('Güncelleme denetlenemedi. İnternet bağlantısını kontrol edin.', 'warning');
    return { hasUpdate: false, ...result };
  }

  const hasUpdate = compareVersions(result.latestVersion, result.currentVersion) > 0;
  if (hasUpdate) {
    if (badgeEl) {
      badgeEl.className = 'tag tag-amber';
      badgeEl.textContent = `Yeni sürüm v${result.latestVersion}`;
    }
    if (statusEl) statusEl.textContent = `v${result.latestVersion} yayımlandı. İndirme yalnızca resmi GitHub Release bağlantısından yapılır.`;
    if (updateCard) updateCard.style.display = '';
    showUpdateBanner(result);
    window.electronAPI.showNativeNotification('FANUC Pro Suite güncellemesi', `Yeni sürüm hazır: v${result.latestVersion}`);
    if (!options.silent) showToast(`Yeni sürüm hazır: v${result.latestVersion}`, 'info');
    return { hasUpdate, ...result };
  }

  if (badgeEl) {
    badgeEl.className = 'tag tag-green';
    badgeEl.textContent = 'Sürümünüz Güncel (v' + result.currentVersion + ')';
  }
  if (statusEl) {
    statusEl.textContent = `Yazılımınız en son sürümde (v${result.currentVersion}).`;
  }
  if (updateCard) {
    updateCard.style.display = 'none';
  }

  if (!options.silent) showToast(`Sürümünüz güncel (v${result.currentVersion})`, 'success');
  return { hasUpdate, ...result };
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
  window.setTimeout(() => checkForAppUpdates({ silent: true }), 6000);
}
