/**
 * MTB Elektrik Bakım — Central State Management
 */

export const State = {
  currentPage: 'dashboard',
  appDataDir: null,
  activeDiagnostic: null,
  alarms: [],
  parameters: [],
  nc_codes: [],
  pmc_signals: [],
  library: [],
  projects: [],
  machines: [],
  maintenances: [],
  batteries: [],
  keep_relays: [],
  drive_alarms: [],
  fans: [],
  wiki: [],
  backup_logs: [],
  custom_mcodes: [],
  custom_alarms: [],
  custom_alarm_notes: {},
  users: [],
  notifications: [],
  onlineSearchEnabled: false,
  currentUser: null,
  settings: {
    aiProvider: 'offline',
    aiApiKey: '',
    aiModel: 'gpt-4o',
    theme: 'dark',
    pdfPaths: {}
  }
};

export const StartupErrors = [];

// Attach to window for legacy inline script compatibility
if (typeof window !== 'undefined') {
  window.State = State;
}
