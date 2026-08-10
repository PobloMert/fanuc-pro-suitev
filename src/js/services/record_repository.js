(() => {
  'use strict';

  const hasValue = value => value !== undefined && value !== null && value !== '';
  const machineIdOf = record => record?.machineId ?? record?.machine_id ?? record?.tezgah_id ?? null;
  const actorName = actor => String(actor?.name || actor?.username || actor?.id || 'local-user');

  function nextId(records) {
    const numericIds = (Array.isArray(records) ? records : [])
      .map(record => Number(record?.id))
      .filter(Number.isFinite);
    return numericIds.length ? Math.max(...numericIds) + 1 : 1;
  }

  function create(records, input, actor, now = new Date().toISOString()) {
    const id = hasValue(input?.id) ? input.id : nextId(records);
    const machineId = machineIdOf(input);
    return {
      ...input,
      id,
      ...(hasValue(machineId) ? { machineId } : {}),
      createdAt: input?.createdAt || now,
      updatedAt: input?.updatedAt || now,
      createdBy: input?.createdBy || actorName(actor),
      revision: Math.max(1, Number(input?.revision) || 1)
    };
  }

  function update(record, changes, actor, now = new Date().toISOString()) {
    const merged = { ...record, ...changes };
    const machineId = machineIdOf(merged);
    return {
      ...merged,
      ...(hasValue(machineId) ? { machineId } : {}),
      createdAt: record?.createdAt || now,
      updatedAt: now,
      createdBy: record?.createdBy || actorName(actor),
      revision: Math.max(1, Number(record?.revision) || 1) + 1
    };
  }

  function read(record) {
    if (!record || typeof record !== 'object') return record;
    const machineId = machineIdOf(record);
    return { ...record, ...(hasValue(machineId) ? { machineId } : {}) };
  }

  function isDeleted(record) {
    return Boolean(record && record.deletedAt);
  }

  function active(records) {
    return (Array.isArray(records) ? records : []).filter(record => !isDeleted(record));
  }

  function archive(record, actor, now = new Date().toISOString()) {
    if (!record || typeof record !== 'object') return record;
    if (isDeleted(record)) return { ...record };
    return {
      ...record,
      deletedAt: now,
      deletedBy: actorName(actor),
      updatedAt: now,
      revision: Math.max(1, Number(record.revision) || 1) + 1
    };
  }

  function restore(record, actor, now = new Date().toISOString()) {
    if (!record || typeof record !== 'object') return record;
    const restored = { ...record };
    delete restored.deletedAt;
    delete restored.deletedBy;
    restored.restoredAt = now;
    restored.restoredBy = actorName(actor);
    restored.updatedAt = now;
    restored.revision = Math.max(1, Number(record.revision) || 1) + 1;
    return restored;
  }

  function archiveById(records, id, actor, now = new Date().toISOString()) {
    let changed = false;
    const next = (Array.isArray(records) ? records : []).map(record => {
      if (String(record?.id) !== String(id) || isDeleted(record)) return record;
      changed = true;
      return archive(record, actor, now);
    });
    return { records: next, changed };
  }

  // Tombstones are intentionally retained past the restore window. purgeExpired only
  // removes record payload fields and keeps identity/version metadata for offline peers.
  function compactTombstone(record, now = new Date().toISOString()) {
    if (!isDeleted(record)) return { ...record };
    const keep = ['id', 'machineId', 'machine_id', 'tezgah_id', 'deletedAt', 'deletedBy', 'updatedAt', 'revision', 'createdAt', 'createdBy'];
    const result = {};
    keep.forEach(key => { if (record[key] !== undefined) result[key] = record[key]; });
    result.tombstone = true;
    result.compactedAt = now;
    return result;
  }

  function compactExpired(records, retentionDays = 90, now = new Date().toISOString()) {
    const threshold = new Date(now).getTime() - Math.max(1, Number(retentionDays) || 90) * 86400000;
    let compacted = 0;
    const next = (Array.isArray(records) ? records : []).map(record => {
      const deletedTime = Date.parse(record?.deletedAt || '');
      if (!record?.tombstone && Number.isFinite(deletedTime) && deletedTime <= threshold) {
        compacted += 1;
        return compactTombstone(record, now);
      }
      return record;
    });
    return { records: next, compacted };
  }

  window.MTBRecordRepository = Object.freeze({
    create, update, read, machineIdOf, nextId, isDeleted, active,
    archive, restore, archiveById, compactTombstone, compactExpired
  });
})();
