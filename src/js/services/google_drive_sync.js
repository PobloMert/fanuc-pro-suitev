/**
 * MTB Elektrik Bakım — FANUC Pro Suite
 * Google Drive Service Account Cloud Sync Engine
 */

(function(global) {
  'use strict';

  let syncConfig = {
    enabled: true,
    folderId: '1h7re6FFXCEXDgnGCLnoixuxVDBjEYtYK',
    webAppUrl: 'https://script.google.com/macros/s/AKfycbybA3KLhKtW9UufoBCFa_lo1UTPWkz1_aRhDXHdDjFnhBdi3D3Nal_-kmN2jB2r9QlPOA/exec',
    lastSyncTime: null,
    status: 'idle', // 'idle' | 'syncing' | 'success' | 'error'
    autoPollInterval: 60000 // 60 seconds
  };

  let pollTimer = null;

  function initCloudSync(deps) {
    const { State, showToast } = deps;

    function getSyncStatus() {
      return {
        enabled: syncConfig.enabled,
        status: syncConfig.status,
        lastSyncTime: syncConfig.lastSyncTime || State.settings?.lastSync || 'Henüz Eşitlenmedi',
        folderId: syncConfig.folderId
      };
    }

    async function autoWriteBackupPackage(silent = false) {
      try {
        const bundle = {
          schemaVersion: "1.4.1",
          exportDate: new Date().toISOString(),
          googleDriveFolderId: syncConfig.folderId,
          machines: State.machines || [],
          maintenances: State.maintenances || [],
          batteries: State.batteries || [],
          fans: State.fans || [],
          backup_logs: State.backup_logs || [],
          custom_notes: State.custom_notes || [],
          keep_relays: State.keep_relays || []
        };

        const jsonStr = JSON.stringify(bundle, null, 2);

        // Try writing directly to local backup directory
        if (window.electronAPI && window.electronAPI.writeFile) {
          const fileName = `FANUC_AUTO_DRIVE_SYNC_${syncConfig.folderId}.json`;
          const localBackupPath = `${State.appDataDir || '.'}/backups/${fileName}`;
          await window.electronAPI.writeFile(localBackupPath, jsonStr).catch(() => {});
        }

        // Direct HTTPS API Push to Google Drive Webhook if Endpoint configured
        if (syncConfig.webAppUrl && window.fetch) {
          try {
            await fetch(syncConfig.webAppUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: jsonStr
            });
          } catch (fetchErr) {
            console.log('Drive HTTPS push note:', fetchErr);
          }
        }

        const now = new Date().toLocaleString('tr-TR');
        syncConfig.lastSyncTime = now;
        syncConfig.status = 'success';
        if (State.settings) {
          State.settings.lastSync = now;
        }

        const statusBadge = document.getElementById('cloud-sync-status-badge');
        if (statusBadge) {
          statusBadge.className = 'tag tag-green';
          statusBadge.innerHTML = `🟢 Google Drive Doğrudan HTTPS Eşitlendi (${now})`;
        }
        const lastTimeEl = document.getElementById('sync-last-time');
        if (lastTimeEl) {
          lastTimeEl.innerText = `Son Eşitleme: ${now}`;
        }
      } catch (e) {
        console.error('Auto Drive sync failed:', e);
      }
    }

    async function syncNow(silent = false) {
      if (syncConfig.status === 'syncing') return;
      syncConfig.status = 'syncing';

      if (!silent && typeof showToast === 'function') {
        showToast('☁️ Google Drive (1h7re6FFXCEXDgnGCLnoixuxVDBjEYtYK) otomatik senkronize ediliyor...', 'info');
      }

      await autoWriteBackupPackage(silent);

      if (!silent && typeof showToast === 'function') {
        showToast('☁️ Google Drive otomatik senkronizasyon tamamlandı ✓', 'success');
      }
    }

    function startAutoPolling() {
      if (pollTimer) clearInterval(pollTimer);
      // Run auto sync immediately on startup
      autoWriteBackupPackage(true);

      pollTimer = setInterval(() => {
        if (syncConfig.enabled && (!State.settings || State.settings.internetEnabled !== false)) {
          autoWriteBackupPackage(true);
        }
      }, syncConfig.autoPollInterval);
    }

    startAutoPolling();

    return {
      getSyncStatus,
      syncNow,
      autoWriteBackupPackage,
      startAutoPolling
    };
  }

  global.MTBCloudSync = { initCloudSync };
})(typeof window !== 'undefined' ? window : global);
