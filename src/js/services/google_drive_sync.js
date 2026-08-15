/**
 * Google Drive business-record backup and multi-device merge.
 * Identity/PIN data, API secrets and local settings are deliberately excluded.
 */
(function (global) {
  'use strict';

  const FOLDER_ID = '1h7re6FFXCEXDgnGCLnoixuxVDBjEYtYK';
  const AUTO_INTERVAL_MS = 5 * 60 * 1000;
  const MAX_BUNDLE_BYTES = 15 * 1024 * 1024;
  const MAX_RECORDS_PER_COLLECTION = 100000;
  const QUEUE_KEY = 'mtb-drive-sync-queue-v1';
  const SNAPSHOT_KEY = 'mtb-drive-sync-snapshot-v1';
  const DEVICE_KEY = 'mtb-drive-device-id';
  const DEVICE_NAME_KEY = 'mtb-sync-device-name';
  const SCOPE_KEY = 'mtb-sync-scope-v1';
  const COLLECTIONS = Object.freeze({
    machines: ['machines.json', 'machines'],
    maintenances: ['maintenances.json', 'maintenances'],
    batteries: ['batteries.json', 'batteries'],
    fans: ['fans.json', 'fans'],
    backup_logs: ['backup_logs.json', 'backup_logs'],
    custom_alarms: ['custom_alarms.json', 'alarms'],
    custom_mcodes: ['custom_mcodes.json', 'mcodes'],
    keep_relays: ['keep_relays.json', 'keep_relays'],
    wiki: ['wiki.json', 'articles'],
    diagnostic_history: ['diagnostic_history.json', 'diagnostic_history']
  });
  const COLLECTION_NAMES = Object.freeze(Object.keys(COLLECTIONS));

  let instance;
  let timer;
  let activeCycle;

  function stable(value) {
    if (value === undefined) return 'null';
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(item => item === undefined ? 'null' : stable(item)).join(',')}]`;
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }

  function utf8Bytes(value) {
    return typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;
  }

  async function sha256(value) {
    if (!global.crypto?.subtle) throw new Error('SHA-256 doğrulaması kullanılamıyor.');
    const bytes = new TextEncoder().encode(value);
    const digest = await global.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function recordKey(record, collection) {
    if (!record || typeof record !== 'object') return stable(record);
    if (collection === 'machines') return String(record.id ?? record.numarasi ?? record.name ?? stable(record));
    if (record.id != null && (record.createdAt || record.updatedAt || record.revision != null)) return String(record.id);
    return stable(record);
  }

  function newer(left, right) {
    const leftRevision = Number(left?.revision) || 0;
    const rightRevision = Number(right?.revision) || 0;
    if (leftRevision !== rightRevision) return rightRevision > leftRevision ? right : left;
    const leftTime = Date.parse(left?.updatedAt || left?.createdAt || '') || 0;
    const rightTime = Date.parse(right?.updatedAt || right?.createdAt || '') || 0;
    if (leftTime !== rightTime) return rightTime > leftTime ? right : left;
    if (left && right) return { ...right, ...left };
    return left || right;
  }

  function mergeRecords(localItems, remoteItems, collection) {
    const merged = new Map();
    for (const item of Array.isArray(localItems) ? localItems : []) merged.set(recordKey(item, collection), item);
    for (const item of Array.isArray(remoteItems) ? remoteItems : []) {
      const key = recordKey(item, collection);
      merged.set(key, merged.has(key) ? newer(merged.get(key), item) : item);
    }
    return [...merged.values()];
  }

  function mergeRecordsDetailed(localItems, remoteItems, collection) {
    const localMap = new Map((Array.isArray(localItems) ? localItems : []).map(item => [recordKey(item, collection), item]));
    const conflicts = [];
    for (const remote of Array.isArray(remoteItems) ? remoteItems : []) {
      const key = recordKey(remote, collection);
      const local = localMap.get(key);
      if (local && stable(local) !== stable(remote)) {
        const sameRevision = (Number(local.revision) || 0) === (Number(remote.revision) || 0);
        const sameTime = (Date.parse(local.updatedAt || local.createdAt || '') || 0) === (Date.parse(remote.updatedAt || remote.createdAt || '') || 0);
        if (sameRevision && sameTime) conflicts.push({ id: `${collection}:${key}`, collection, recordId: key, title: local.name || local.numarasi || local.description || remote.name || remote.description || key, local, remote });
      }
      localMap.set(key, local ? newer(local, remote) : remote);
    }
    return { records: [...localMap.values()], conflicts };
  }

  function parseBundle(payload) {
    let value = payload;
    if (typeof value === 'string' && utf8Bytes(value) > MAX_BUNDLE_BYTES) throw new Error('Drive paketi izin verilen boyutu aşıyor.');
    for (let depth = 0; depth < 3 && typeof value === 'string'; depth += 1) value = JSON.parse(value);
    if (value?.data && typeof value.data === 'string') return parseBundle(value.data);
    return value;
  }

  function validateCollections(collections) {
    if (!collections || typeof collections !== 'object' || Array.isArray(collections)) throw new Error('Drive koleksiyonları geçersiz.');
    const names = Object.keys(collections);
    const forbidden = names.filter(name => !COLLECTION_NAMES.includes(name));
    if (forbidden.length) throw new Error(`Drive paketinde izin verilmeyen koleksiyon: ${forbidden[0]}`);
    const clean = {};
    for (const name of COLLECTION_NAMES) {
      const records = collections[name] ?? [];
      if (!Array.isArray(records) || records.length > MAX_RECORDS_PER_COLLECTION) throw new Error(`Drive koleksiyonu geçersiz: ${name}`);
      for (const record of records) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`Drive kaydı geçersiz: ${name}`);
      }
      clean[name] = records;
    }
    return clean;
  }

  async function validateBundle(payload) {
    const bundle = parseBundle(payload);
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new Error('Drive paketi geçersiz.');
    const collections = validateCollections(bundle.collections || bundle);
    const schemaVersion = Number(bundle.schemaVersion || 1);
    if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 3) throw new Error('Drive şema sürümü desteklenmiyor.');
    let integrity = 'legacy-unverified';
    if (schemaVersion >= 3) {
      if (!/^[a-f0-9]{64}$/i.test(String(bundle.checksum || ''))) throw new Error('Drive paketinin checksum değeri eksik veya geçersiz.');
      const actual = await sha256(stable(collections));
      if (actual !== String(bundle.checksum).toLowerCase()) throw new Error('Drive paketi bütünlük doğrulamasından geçemedi.');
      integrity = 'verified';
    }
    return { bundle, collections, schemaVersion, integrity };
  }

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function makeDelta(collections, previous) {
    const delta = {};
    for (const name of COLLECTION_NAMES) {
      if (stable(collections[name]) !== stable(previous?.[name] || [])) delta[name] = collections[name];
    }
    return delta;
  }

  function initCloudSync({ State, showToast } = {}) {
    if (instance) return instance;
    const notify = (message, type = 'info', silent = false) => {
      if (!silent && typeof showToast === 'function') showToast(message, type);
    };
    const deviceId = localStorage.getItem(DEVICE_KEY) || (crypto.randomUUID?.() || `device-${Date.now()}`);
    localStorage.setItem(DEVICE_KEY, deviceId);
    const status = {
      enabled: true,
      state: 'idle',
      lastSyncTime: State?.settings?.lastSync || null,
      folderId: FOLDER_ID,
      integrity: null,
      protocol: 'legacy-full',
      queued: loadJSON(QUEUE_KEY, []).length,
      retryAt: null,
      capabilities: { delta: false, retention: false, authenticated: false },
      counts: { sent: 0, received: 0, merged: 0, conflicts: 0 },
      devices: [],
      conflictItems: [],
      lastPushTime: null,
      lastPullTime: null,
      lastError: null
    };

    function selectedScope() {
      return loadJSON(SCOPE_KEY, {});
    }

    const UNSUPPORTED_COLLECTIONS_KEY = 'mtb-unsupported-remote-collections';

    function getUnsupportedCollections() {
      return new Set(loadJSON(UNSUPPORTED_COLLECTIONS_KEY, []));
    }

    function addUnsupportedCollection(name) {
      const set = getUnsupportedCollections();
      set.add(name);
      saveJSON(UNSUPPORTED_COLLECTIONS_KEY, [...set]);
    }

    function collectionEnabled(name) {
      const scope = selectedScope();
      if (name === 'batteries' || name === 'fans') return scope.batteries_fans !== false;
      return scope[name] !== false;
    }

    function currentCollections() {
      const collections = {};
      const unsupported = getUnsupportedCollections();
      for (const key of COLLECTION_NAMES) {
        if (unsupported.has(key)) continue;
        collections[key] = collectionEnabled(key) && Array.isArray(State?.[key]) ? State[key] : [];
      }
      return collections;
    }

    async function buildBundle() {
      const collections = currentCollections();
      const now = new Date().toISOString();
      const currentDevice = { id: deviceId, name: localStorage.getItem(DEVICE_NAME_KEY) || 'Bu bilgisayar', lastSeen: now, state: 'online' };
      const devices = [...status.devices.filter(item => item?.id && item.id !== deviceId), currentDevice];
      return {
        schemaVersion: 3,
        applicationVersion: '1.4.2',
        exportedAt: new Date().toISOString(),
        deviceId,
        folderId: FOLDER_ID,
        collections,
        devices,
        checksum: await sha256(stable(collections)),
        retentionRequest: { dailyCopies: 7, weeklyCopies: 4 }
      };
    }

    async function request(action, options = {}) {
      if (!global.electronAPI?.driveSyncRequest) throw new Error('Güvenli Drive bağlantısı kullanılamıyor.');
      const result = await global.electronAPI.driveSyncRequest(action, options);
      if (!result?.ok || Number(result.status) >= 400) throw new Error(result?.error || `Drive yanıtı başarısız (${result?.status || '?'})`);
      const responsePayload = parseBundle(result.data);
      if (responsePayload && typeof responsePayload === 'object' && responsePayload.ok === false) {
        throw new Error(String(responsePayload.error || 'Drive service rejected the operation.'));
      }
      if (action === 'capabilities' && result.capabilities) status.capabilities = { ...status.capabilities, ...result.capabilities };
      return result.data;
    }

    async function detectCapabilities() {
      try {
        const raw = await request('capabilities', { method: 'GET' });
        const value = parseBundle(raw);
        const caps = value?.capabilities || value;
        if (caps && typeof caps === 'object') {
          status.capabilities.delta = caps.delta === true;
          status.capabilities.retention = caps.retention === true;
          status.capabilities.authenticated = caps.authenticated === true;
        }
      } catch {
        // Existing Apps Script deployments may not expose capability discovery.
      }
      status.protocol = status.capabilities.delta ? 'delta-v1' : 'legacy-full';
      return { ...status.capabilities };
    }

    async function persistMergedCollections(remoteCollections) {
      let changed = false;
      let received = 0;
      let mergedCount = 0;
      const conflicts = [];
      for (const [key, [file, wrapper]] of Object.entries(COLLECTIONS)) {
        if (!collectionEnabled(key)) continue;
        const remote = remoteCollections?.[key] || [];
        received += remote.length;
        const detailed = mergeRecordsDetailed(State?.[key], remote, key);
        const merged = detailed.records;
        conflicts.push(...detailed.conflicts);
        if (stable(merged) === stable(State?.[key] || [])) continue;
        mergedCount += Math.max(0, merged.length - (State?.[key]?.length || 0));
        State[key] = merged;
        const saved = await global.DataPersistence?.saveJSONDatabase(file, wrapper, merged);
        if (saved === false) throw new Error(`${file} kaydedilemedi.`);
        changed = true;
      }
      status.counts.received = received;
      status.counts.merged = mergedCount;
      status.conflictItems = conflicts;
      status.counts.conflicts = conflicts.length;
      return changed;
    }

    async function pull() {
      try {
        const raw = await request('get', { method: 'GET' });
        if (!raw || !String(raw).trim()) return { changed: false, integrity: null };
        const validated = await validateBundle(raw);
        const changed = await persistMergedCollections(validated.collections);
        status.devices = Array.isArray(validated.bundle.devices) ? validated.bundle.devices.filter(item => item && typeof item === 'object').slice(0, 100) : status.devices;
        const serverConflicts = Array.isArray(validated.bundle.conflicts)
          ? validated.bundle.conflicts.filter(item => item && typeof item === 'object' && COLLECTION_NAMES.includes(item.collection)).slice(-500)
          : [];
        if (serverConflicts.length) {
          const combined = new Map(status.conflictItems.map(item => [String(item.id), item]));
          for (const item of serverConflicts) combined.set(String(item.id), item);
          status.conflictItems = [...combined.values()].slice(-500);
          status.counts.conflicts = status.conflictItems.length;
        }
        status.integrity = validated.integrity;
        status.lastPullTime = new Date().toISOString();
        return { changed, integrity: validated.integrity };
      } catch (error) {
        const match = String(error?.message || '').match(/İzin verilmeyen koleksiyon:\s*(\w+)/i);
        if (match && COLLECTION_NAMES.includes(match[1])) {
          addUnsupportedCollection(match[1]);
          return { changed: false, integrity: 'legacy-unverified' };
        }
        throw error;
      }
    }

    function enqueue(bundle, reason) {
      const queue = loadJSON(QUEUE_KEY, []);
      const existing = queue.find(item => item.bundle?.checksum === bundle.checksum);
      if (existing) {
        existing.bundle = bundle;
        existing.reason = String(reason || existing.reason || '');
        saveJSON(QUEUE_KEY, queue);
        status.queued = queue.length;
        return;
      }
      queue.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, createdAt: new Date().toISOString(), attempts: 0, reason: String(reason || ''), bundle });
      saveJSON(QUEUE_KEY, queue.slice(-20));
      status.queued = Math.min(queue.length, 20);
    }

    async function transmit(bundle) {
      const send = async (b) => {
        if (status.capabilities.delta) {
          const previous = loadJSON(SNAPSHOT_KEY, {});
          const collections = makeDelta(b.collections, previous);
          const deltaPayload = { ...b, mode: 'delta', collections, checksum: await sha256(stable(collections)) };
          await request('merge', { method: 'POST', body: JSON.stringify(deltaPayload) });
        } else {
          await request('put', { method: 'POST', body: JSON.stringify(b) });
        }
      };

      try {
        await send(bundle);
      } catch (error) {
        const match = String(error?.message || '').match(/İzin verilmeyen koleksiyon:\s*(\w+)/i);
        if (match && COLLECTION_NAMES.includes(match[1])) {
          const unsupportedName = match[1];
          addUnsupportedCollection(unsupportedName);
          delete bundle.collections[unsupportedName];
          bundle.checksum = await sha256(stable(bundle.collections));
          await send(bundle);
          notify(`⚠️ Drive sunucusu '${unsupportedName}' koleksiyonunu henüz desteklemiyor. Diğer tüm veriler başarıyla eşitlendi.`, 'warning');
        } else {
          throw error;
        }
      }

      saveJSON(SNAPSHOT_KEY, bundle.collections);
      status.counts.sent = Object.values(bundle.collections).reduce((sum, items) => sum + items.length, 0);
      status.lastPushTime = new Date().toISOString();
    }

    async function flushQueue(force = false) {
      const queue = loadJSON(QUEUE_KEY, []);
      if (!queue.length) return 0;
      let sent = 0;
      const unsupported = getUnsupportedCollections();
      while (queue.length) {
        const item = queue[0];
        const nextAttempt = Date.parse(item.nextAttemptAt || '') || 0;
        if (!force && nextAttempt > Date.now()) {
          status.retryAt = item.nextAttemptAt;
          break;
        }
        try {
          if (item.bundle?.collections) {
            let stripped = false;
            for (const un of unsupported) {
              if (item.bundle.collections[un]) {
                delete item.bundle.collections[un];
                stripped = true;
              }
            }
            if (stripped) {
              item.bundle.checksum = await sha256(stable(item.bundle.collections));
            }
          }
          await transmit(item.bundle);
          queue.shift();
          sent += 1;
          saveJSON(QUEUE_KEY, queue);
        } catch (error) {
          const match = String(error?.message || '').match(/İzin verilmeyen koleksiyon:\s*(\w+)/i);
          if (match && COLLECTION_NAMES.includes(match[1])) {
            addUnsupportedCollection(match[1]);
            if (item.bundle?.collections && item.bundle.collections[match[1]]) {
              delete item.bundle.collections[match[1]];
              item.bundle.checksum = await sha256(stable(item.bundle.collections));
              try {
                await transmit(item.bundle);
                queue.shift();
                sent += 1;
                saveJSON(QUEUE_KEY, queue);
                continue;
              } catch (_) {}
            }
          }
          item.attempts = Number(item.attempts || 0) + 1;
          item.reason = error.message;
          const delay = Math.min(30 * 60 * 1000, 5000 * (2 ** Math.min(item.attempts - 1, 8)));
          item.nextAttemptAt = new Date(Date.now() + delay).toISOString();
          status.retryAt = item.nextAttemptAt;
          saveJSON(QUEUE_KEY, queue);
          break;
        }
      }
      status.queued = queue.length;
      return sent;
    }

    async function push({ queueOnFailure = true, force = false } = {}) {
      const bundle = await buildBundle();
      try {
        await flushQueue(force);
        if (loadJSON(QUEUE_KEY, []).length && !force) throw new Error(`Drive yeniden denemesi ${status.retryAt || 'daha sonra'} zamanına ertelendi.`);
        await transmit(bundle);
        return true;
      } catch (error) {
        if (queueOnFailure) enqueue(bundle, error.message);
        throw error;
      }
    }

    async function syncNow(silent = false) {
      if (activeCycle) return activeCycle;
      activeCycle = (async () => {
        status.state = 'syncing';
        status.lastError = null;
        status.retryAt = null;
        notify('Google Drive kayıtları birleştiriliyor…', 'info', silent);
        try {
          await detectCapabilities();
          const pulled = await pull();
          await push({ force: true });
          status.state = 'success';
          status.lastError = null;
          status.lastSyncTime = new Date().toISOString();
          status.retryAt = null;
          if (State?.settings) State.settings.lastSync = status.lastSyncTime;
          notify(pulled.changed ? 'Drive kayıtları birleştirildi ve yedeklendi ✓' : 'Drive yedeği güncellendi ✓', 'success', silent);
          return { ok: true, changed: pulled.changed, integrity: pulled.integrity, protocol: status.protocol, capabilities: { ...status.capabilities }, lastSyncTime: status.lastSyncTime };
        } catch (error) {
          // A connection failure can occur before push() is reached. Preserve the
          // current business snapshot so the next successful cycle can transmit it.
          if (/network|fetch|ba[gÄŸ]lant|ENOTFOUND|ECONN|timeout|zaman a[sÅŸ][Ä±i]/i.test(String(error?.message || error))) {
            try { enqueue(await buildBundle(), error.message); } catch { /* keep original failure */ }
          }
          status.state = 'error';
          status.lastError = error.message;
          notify(`Drive senkronizasyonu başarısız: ${error.message}`, 'error', silent);
          return { ok: false, error: error.message, queued: status.queued, retryAt: status.retryAt };
        } finally {
          activeCycle = null;
        }
      })();
      return activeCycle;
    }

    function startAutoPolling() {
      if (timer) return true;
      syncNow(true);
      timer = setInterval(() => syncNow(true), AUTO_INTERVAL_MS);
      return true;
    }

    function setDeviceName(name) {
      const value = String(name || '').trim().slice(0, 80);
      if (!value) return { ok: false, error: 'Cihaz adı boş olamaz.' };
      localStorage.setItem(DEVICE_NAME_KEY, value);
      return { ok: true };
    }

    function setSyncScope(scope) {
      const allowed = new Set(['machines','maintenances','batteries_fans','backup_logs','custom_alarms','custom_mcodes','keep_relays','wiki','diagnostic_history']);
      const clean = {};
      for (const [key, value] of Object.entries(scope || {})) if (allowed.has(key)) clean[key] = value !== false;
      saveJSON(SCOPE_KEY, clean);
      return { ok: true, scope: clean };
    }

    async function resolveConflict({ conflictId, strategy } = {}) {
      const conflict = status.conflictItems.find(item => item.id === conflictId);
      if (!conflict) return { ok: false, error: 'Çakışma bulunamadı.' };
      if (!['local', 'remote', 'merge'].includes(strategy)) return { ok: false, error: 'Geçersiz çakışma kararı.' };
      const [file, wrapper] = COLLECTIONS[conflict.collection];
      const chosen = strategy === 'local' ? conflict.local : strategy === 'remote' ? conflict.remote : { ...conflict.remote, ...conflict.local };
      const resolved = { ...chosen, id: chosen.id ?? conflict.recordId, revision: Math.max(Number(conflict.local.revision)||0, Number(conflict.remote.revision)||0) + 1, updatedAt: new Date().toISOString(), conflictResolvedAt: new Date().toISOString(), conflictStrategy: strategy };
      State[conflict.collection] = (State[conflict.collection] || []).map(item => recordKey(item, conflict.collection) === conflict.recordId ? resolved : item);
      const saved = await global.DataPersistence?.saveJSONDatabase(file, wrapper, State[conflict.collection]);
      if (saved === false) return { ok: false, error: `${file} kaydedilemedi.` };
      status.conflictItems = status.conflictItems.filter(item => item.id !== conflictId);
      status.counts.conflicts = status.conflictItems.length;
      return { ok: true, record: resolved };
    }

    instance = Object.freeze({
      getSyncStatus: () => ({ ...status, capabilities: { ...status.capabilities } }),
      syncNow,
      autoWriteBackupPackage: silent => syncNow(Boolean(silent)),
      pullDirectFromGoogleDrive: silent => syncNow(Boolean(silent)),
      startAutoPolling,
      setDeviceName,
      setSyncScope,
      resolveConflict
    });
    return instance;
  }

  global.MTBCloudSync = Object.freeze({ initCloudSync, mergeRecords, mergeRecordsDetailed, validateBundle, makeDelta });
})(typeof window !== 'undefined' ? window : globalThis);
