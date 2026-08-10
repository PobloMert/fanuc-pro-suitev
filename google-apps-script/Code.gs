/* FANUC Pro Suite Google Drive synchronization endpoint.
 * Script Properties required:
 *   FANUC_DRIVE_TOKEN     - same 16+ character key configured in the app
 *   FANUC_DRIVE_FOLDER_ID - target Drive folder id
 */
var CURRENT_FILE = 'FANUC_SYNC_CURRENT.json';
var ALLOWED = ['machines','maintenances','batteries','fans','backup_logs','custom_alarms','custom_mcodes','keep_relays','wiki','diagnostic_history'];

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function property_(name) {
  return String(PropertiesService.getScriptProperties().getProperty(name) || '');
}

function authorized_(e) {
  var expected = property_('FANUC_DRIVE_TOKEN');
  var actual = String((e && e.parameter && e.parameter.deviceKey) || '');
  return expected.length >= 16 && actual === expected;
}

function stable_(value) {
  if (Array.isArray(value)) return '[' + value.map(stable_).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + stable_(value[key]); }).join(',') + '}';
  return JSON.stringify(value);
}

function sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8).map(function (byte) {
    var unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

function emptyBundle_() {
  var collections = {};
  ALLOWED.forEach(function (name) { collections[name] = []; });
  return { schemaVersion: 3, exportedAt: new Date().toISOString(), collections: collections, devices: [], conflicts: [], checksum: sha256_(stable_(collections)) };
}

function folder_() {
  var id = property_('FANUC_DRIVE_FOLDER_ID');
  if (!id) throw new Error('FANUC_DRIVE_FOLDER_ID ayarlanmamış.');
  return DriveApp.getFolderById(id);
}

function readCurrent_() {
  var files = folder_().getFilesByName(CURRENT_FILE);
  if (!files.hasNext()) return emptyBundle_();
  var parsed = JSON.parse(files.next().getBlob().getDataAsString('UTF-8'));
  return validate_(parsed);
}

function validate_(bundle) {
  var schemaVersion = Number(bundle && bundle.schemaVersion || 1);
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 3) throw new Error('Unsupported synchronization schema.');
  if (!bundle || typeof bundle !== 'object' || !bundle.collections) throw new Error('Geçersiz senkronizasyon paketi.');
  Object.keys(bundle.collections).forEach(function (name) { if (ALLOWED.indexOf(name) < 0) throw new Error('İzin verilmeyen koleksiyon: ' + name); });
  ALLOWED.forEach(function (name) { if (!Array.isArray(bundle.collections[name] || [])) throw new Error('Geçersiz koleksiyon: ' + name); });
  if (Number(bundle.schemaVersion) >= 3 && sha256_(stable_(bundle.collections)) !== String(bundle.checksum || '').toLowerCase()) throw new Error('Checksum doğrulanamadı.');
  return bundle;
}

function key_(record, collection) {
  if (collection === 'machines') return String(record.id != null ? record.id : (record.numarasi || record.name || stable_(record)));
  if (record.id != null && (record.createdAt || record.updatedAt || record.revision != null)) return String(record.id);
  return stable_(record);
}

function mergeCollections_(base, incoming, conflicts) {
  ALLOWED.forEach(function (name) {
    var map = {};
    (base[name] || []).forEach(function (item) { map[key_(item, name)] = item; });
    (incoming[name] || []).forEach(function (remote) {
      var key = key_(remote, name), local = map[key];
      if (!local) { map[key] = remote; return; }
      var lr = Number(local.revision) || 0, rr = Number(remote.revision) || 0;
      var lt = Date.parse(local.updatedAt || local.createdAt || '') || 0, rt = Date.parse(remote.updatedAt || remote.createdAt || '') || 0;
      if (rr > lr || (rr === lr && rt > lt)) map[key] = remote;
      else if (rr === lr && rt === lt && stable_(local) !== stable_(remote)) conflicts.push({ id:name + ':' + key, collection:name, recordId:key, local:local, remote:remote, detectedAt:new Date().toISOString() });
    });
    base[name] = Object.keys(map).map(function (key) { return map[key]; });
  });
  return base;
}

function writeCurrent_(bundle) {
  bundle.schemaVersion = 3;
  bundle.exportedAt = new Date().toISOString();
  bundle.checksum = sha256_(stable_(bundle.collections));
  var folder = folder_(), files = folder.getFilesByName(CURRENT_FILE);
  while (files.hasNext()) files.next().setTrashed(true);
  folder.createFile(CURRENT_FILE, JSON.stringify(bundle), MimeType.PLAIN_TEXT);
  createVersions_(folder, bundle);
}

function createVersions_(folder, bundle) {
  var now = new Date(), day = Utilities.formatDate(now, 'UTC', 'yyyy-MM-dd');
  var daily = 'FANUC_SYNC_DAILY_' + day + '.json';
  if (!folder.getFilesByName(daily).hasNext()) folder.createFile(daily, JSON.stringify(bundle), MimeType.PLAIN_TEXT);
  if (now.getUTCDay() === 1) {
    var weekly = 'FANUC_SYNC_WEEKLY_' + day + '.json';
    if (!folder.getFilesByName(weekly).hasNext()) folder.createFile(weekly, JSON.stringify(bundle), MimeType.PLAIN_TEXT);
  }
  retain_(folder, 'FANUC_SYNC_DAILY_', 7);
  retain_(folder, 'FANUC_SYNC_WEEKLY_', 4);
}

function retain_(folder, prefix, keep) {
  var files = folder.getFiles(), matches = [];
  while (files.hasNext()) { var file = files.next(); if (file.getName().indexOf(prefix) === 0) matches.push(file); }
  matches.sort(function (a,b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  matches.slice(keep).forEach(function (file) { file.setTrashed(true); });
}

function doGet(e) {
  try {
    if (!authorized_(e)) return json_({ ok:false, error:'unauthorized' });
    var action = String((e.parameter && e.parameter.action) || 'get');
    if (action === 'capabilities') return json_({ capabilities:{ delta:true, retention:true, authenticated:true, conflicts:true, devices:true }, protocol:'delta-v1' });
    if (action !== 'get') return json_({ ok:false, error:'invalid-action' });
    return json_(readCurrent_());
  } catch (error) { return json_({ ok:false, error:String(error.message || error) }); }
}

function doPost(e) {
  try {
    if (!authorized_(e)) return json_({ ok:false, error:'unauthorized' });
    var incoming = validate_(JSON.parse(e.postData.contents || '{}'));
    var current = readCurrent_(), conflicts = current.conflicts || [];
    current.collections = mergeCollections_(current.collections, incoming.collections, conflicts);
    current.conflicts = conflicts.slice(-500);
    var devices = {};
    (current.devices || []).concat(incoming.devices || []).forEach(function (device) { if (device && device.id) devices[device.id] = device; });
    current.devices = Object.keys(devices).map(function (id) { return devices[id]; }).slice(-100);
    writeCurrent_(current);
    return json_({ ok:true, checksum:current.checksum, conflicts:current.conflicts.length });
  } catch (error) { return json_({ ok:false, error:String(error.message || error) }); }
}
