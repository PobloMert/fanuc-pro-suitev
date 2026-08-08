const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication (PIN values never enter renderer state or JSON storage)
  listUsers: () => ipcRenderer.invoke('auth-list-users'),
  getBootstrapStatus: () => ipcRenderer.invoke('auth-bootstrap-status'),
  bootstrapAdmin: (input) => ipcRenderer.invoke('auth-bootstrap-admin', input),
  login: (userId, pin) => ipcRenderer.invoke('auth-login', userId, pin),
  logout: () => ipcRenderer.invoke('auth-logout'),
  addUser: (user) => ipcRenderer.invoke('auth-add-user', user),
  deleteUser: (userId) => ipcRenderer.invoke('auth-delete-user', userId),
  changePin: (oldPin, newPin) => ipcRenderer.invoke('auth-change-pin', oldPin, newPin),
  getAISecret: () => ipcRenderer.invoke('secret-get'),
  setAISecret: (value) => ipcRenderer.invoke('secret-set', value),
  getKnowledgePreferences: () => ipcRenderer.invoke('knowledge-preferences-get'),
  setKnowledgePreferences: (input) => ipcRenderer.invoke('knowledge-preferences-set', input),
  getDataStoreStatus: () => ipcRenderer.invoke('data-store-status'),
  listRecords: (collection) => ipcRenderer.invoke('records-list', collection),
  upsertRecord: (collection, id, record) => ipcRenderer.invoke('records-upsert', collection, id, record),
  deleteRecord: (collection, id) => ipcRenderer.invoke('records-delete', collection, id),
  recordTelemetry: (samples) => ipcRenderer.invoke('telemetry-record', samples),
  queryTelemetry: (machine, since, limit) => ipcRenderer.invoke('telemetry-query', machine, since, limit),
  telemetrySummary: (since) => ipcRenderer.invoke('telemetry-summary', since),
  recordAlarm: (alarm) => ipcRenderer.invoke('alarm-record', alarm),
  runRetention: () => ipcRenderer.invoke('retention-run'),
  getBackupHealth: () => ipcRenderer.invoke('backup-health'),
  completeAI: (request) => ipcRenderer.invoke('ai-complete', request),
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),

  // Dialogs
  openFileDialog: (filters) => ipcRenderer.invoke('dialog-open-file', filters),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog-open-directory'),
  saveFileDialog: (filters, defaultName) => ipcRenderer.invoke('dialog-save-file', filters, defaultName),

  // File system
  readFile:   (filePath, encoding) => ipcRenderer.invoke('fs-read-file', filePath, encoding),
  writeFile:  (filePath, data, encoding) => ipcRenderer.invoke('fs-write-file', filePath, data, encoding),
  listDir:    (dirPath) => ipcRenderer.invoke('fs-list-dir', dirPath),
  ensureDir:  (dirPath) => ipcRenderer.invoke('fs-ensure-dir', dirPath),
  getAppDataDir: () => ipcRenderer.invoke('get-app-data-dir'),
  restartAdapter: () => ipcRenderer.invoke('restart-adapter'),
  getAdapterStatus: () => ipcRenderer.invoke('get-adapter-status'),
  onAdapterStatusChanged: (callback) => ipcRenderer.on('adapter-status-changed', (event, status) => callback(status)),

  // Backup & Restore Engine
  getBackupsList: () => ipcRenderer.invoke('get-backups-list'),
  createManualBackup: () => ipcRenderer.invoke('create-manual-backup'),
  restoreBackup: (backupFilePath) => ipcRenderer.invoke('restore-backup', backupFilePath),

  // Network & PDF Utilities
  fetchProxy: (url, options) => ipcRenderer.invoke('fetch-proxy', url, options),
  checkForUpdates: () => ipcRenderer.invoke('update-check'),
  applyStoragePolicy: (policy) => ipcRenderer.invoke('storage-policy-apply', policy),
  pingTcpPort: (host, port, timeoutMs) => ipcRenderer.invoke('ping-tcp-port', { host, port, timeoutMs }),
  scanFocasNetwork: (options) => ipcRenderer.invoke('scan-focas-network', options),
  searchPDFText: (pdfPath, query) => ipcRenderer.invoke('search-pdf-text', pdfPath, query),



  // Shell
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Export
  exportCSV: (csvContent, defaultName) => ipcRenderer.invoke('export-csv', csvContent, defaultName),
  exportDiagnostics: () => ipcRenderer.invoke('diagnostics-export'),

  // Native notifications
  showNativeNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),

  // PDF Print
  printToPDF: (htmlContent, defaultName) => ipcRenderer.invoke('print-to-pdf', htmlContent, defaultName),
});
