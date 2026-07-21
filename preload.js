const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),

  // Dialogs
  openFileDialog: (filters) => ipcRenderer.invoke('dialog-open-file', filters),
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
  pingTcpPort: (host, port, timeoutMs) => ipcRenderer.invoke('ping-tcp-port', { host, port, timeoutMs }),
  searchPDFText: (pdfPath, query) => ipcRenderer.invoke('search-pdf-text', pdfPath, query),



  // Shell
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Export
  exportCSV: (csvContent, defaultName) => ipcRenderer.invoke('export-csv', csvContent, defaultName),

  // Native notifications
  showNativeNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),

  // PDF Print
  printToPDF: (htmlContent, defaultName) => ipcRenderer.invoke('print-to-pdf', htmlContent, defaultName),
});
