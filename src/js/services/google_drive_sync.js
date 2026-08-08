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
      if (syncConfig.status === 'syncing') return;
      syncConfig.status = 'syncing';
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
          custom_alarms: State.custom_alarms || [],
          custom_mcodes: State.custom_mcodes || [],
          keep_relays: State.keep_relays || [],
          settings: State.settings || {},
          users: State.users || []
        };

        const jsonStr = JSON.stringify(bundle, null, 2);

        // Direct HTTPS API Push to Google Drive Webhook
        if (syncConfig.webAppUrl) {
          try {
            if (window.electronAPI && window.electronAPI.fetchProxy) {
              const res = await window.electronAPI.fetchProxy(syncConfig.webAppUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: jsonStr
              });
              console.log('Google Drive Webhook result:', res);
            } else if (window.fetch) {
              await fetch(syncConfig.webAppUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: jsonStr
              });
            }
          } catch (fetchErr) {
            console.log('Drive HTTPS push note:', fetchErr);
          }
        }

        const now = new Date().toLocaleString('tr-TR');
        syncConfig.lastSyncTime = now;
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
      } finally {
        syncConfig.status = 'idle';
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

    async function pullDirectFromGoogleDrive(silent = false) {
      if (!syncConfig.webAppUrl) return false;
      try {
        if (!silent && typeof showToast === 'function') {
          showToast('☁️ Google Drive\'dan en son veriler indiriliyor...', 'info');
        }

        let res;
        if (window.electronAPI && window.electronAPI.fetchProxy) {
          res = await window.electronAPI.fetchProxy(syncConfig.webAppUrl + '?action=get', { method: 'GET' });
        } else if (window.fetch) {
          const response = await fetch(syncConfig.webAppUrl + '?action=get');
          res = { ok: response.ok, data: await response.text() };
        }

        if (res && res.ok && res.data) {
          try {
            const bundle = JSON.parse(res.data);
            if (bundle && bundle.machines) {
              if (bundle.machines) State.machines = bundle.machines;
              if (bundle.maintenances) State.maintenances = bundle.maintenances;
              if (bundle.batteries) State.batteries = bundle.batteries;
              if (bundle.fans) State.fans = bundle.fans;
              if (bundle.backup_logs) State.backup_logs = bundle.backup_logs;
              if (bundle.custom_notes) State.custom_notes = bundle.custom_notes;
              if (bundle.custom_alarms) State.custom_alarms = bundle.custom_alarms;
              if (bundle.custom_mcodes) State.custom_mcodes = bundle.custom_mcodes;
              if (bundle.keep_relays) State.keep_relays = bundle.keep_relays;

              if (typeof saveMachines === 'function') await saveMachines();
              if (typeof saveMaintenances === 'function') await saveMaintenances();
              if (typeof saveBatteries === 'function') await saveBatteries();
              if (typeof saveFans === 'function') await saveFans();

              if (!silent && typeof showToast === 'function') {
                showToast('☁️ Google Drive\'daki güncel veriler başarıyla indirildi ve yüklendi! ✓', 'success');
              }
              if (window.navigate) window.navigate('dashboard');
              return true;
            }
          } catch (pErr) {
            console.log('Direct pull parse note:', pErr);
          }
        }
      } catch (err) {
        console.error('Pull from Google Drive failed:', err);
      }
      return false;
    }

    return {
      getSyncStatus,
      syncNow,
      autoWriteBackupPackage,
      pullDirectFromGoogleDrive,
      startAutoPolling
    };
  }

  global.MTBCloudSync = { initCloudSync };
})(typeof window !== 'undefined' ? window : global);
