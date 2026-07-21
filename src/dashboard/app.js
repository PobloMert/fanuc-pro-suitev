// FANUC CNC Shop Floor Multi-Machine Dashboard Logic
window.onerror = function(msg, url, line, col, error) {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.bottom = '10px';
    div.style.left = '10px';
    div.style.background = 'rgba(255,0,0,0.9)';
    div.style.color = 'white';
    div.style.padding = '10px';
    div.style.zIndex = '99999';
    div.style.maxHeight = '200px';
    div.style.overflowY = 'auto';
    div.style.fontSize = '12px';
    div.style.fontFamily = 'monospace';
    div.innerText = `ERR: ${msg} at ${line}:${col}\nStack: ${error ? error.stack : ''}`;
    document.body.appendChild(div);
};

const agentUrl = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000/current' : '/current';

// State Variables per Machine
let currentMachine = 'Fanuc';
let showingCncAlarms = false;
let currentPath = 1;
let isPollingDiagnostics = false;
const machineState = {
    'Fanuc': { lastPartCount: null, activeSeconds: 0, partCycleStartTime: null, currentPartCycleSeconds: 0, currentExecution: 'READY', partHistory: [], alarmHistory: [], trendData: [], dailyPowerOnBaseline: null },
    'Fanuc2': { lastPartCount: null, activeSeconds: 0, partCycleStartTime: null, currentPartCycleSeconds: 0, currentExecution: 'READY', partHistory: [], alarmHistory: [], trendData: [], dailyPowerOnBaseline: null }
};

// DOM Elements
const connectionBadge = document.getElementById('agent-connection');
const connectionText = document.getElementById('connection-text');
const stateBadge = document.getElementById('machine-state-badge');
const elExecution = document.getElementById('val-execution');
const elMode = document.getElementById('val-mode');
const elProgram = document.getElementById('val-program');
const elEstop = document.getElementById('val-estop');
const elServoFan = document.getElementById('val-servo-fan');
const elCabinetFan = document.getElementById('val-cabinet-fan');
const estopContainer = document.getElementById('estop-container');
const elPartCount = document.getElementById('val-part-count');
const elCycleTime = document.getElementById('val-cycle-time');
const elHistoryTable = document.getElementById('history-log-tbody');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// Details DOM Elements
const elTool = document.getElementById('val-tool');
const elPosX = document.getElementById('val-pos-x');
const elPosY = document.getElementById('val-pos-y');
const elPosZ = document.getElementById('val-pos-z');
const elSpindleSpeed = document.getElementById('val-spindle-speed');
const elFeedrate = document.getElementById('val-feedrate');

// Advanced Details DOM Elements
const elGcodeBlock = document.getElementById('val-gcode-block');
const elTempX = document.getElementById('val-temp-x');
const elTempY = document.getElementById('val-temp-y');
const elTempZ = document.getElementById('val-temp-z');
const elTempSpindle = document.getElementById('val-temp-spindle');
const elEncTempX = document.getElementById('val-enc-temp-x');
const elEncTempY = document.getElementById('val-enc-temp-y');
const elEncTempZ = document.getElementById('val-enc-temp-z');
const elEncTempSpindle = document.getElementById('val-enc-temp-spindle');
const elErrX = document.getElementById('val-err-x');
const elErrY = document.getElementById('val-err-y');
const elErrZ = document.getElementById('val-err-z');
const elTimePowerOn = document.getElementById('val-time-poweron');
const elTimeOperating = document.getElementById('val-time-operating');
const elTimeCutting = document.getElementById('val-time-cutting');
const elToolGeom = document.getElementById('val-tool-geom');
const elToolWear = document.getElementById('val-tool-wear');
const lampCycleStart = document.getElementById('lamp-cycle-start');
const lampFeedHold = document.getElementById('lamp-feed-hold');

// New Advanced Details DOM Elements
const elModalMotion = document.getElementById('val-modal-motion');
const elModalPos = document.getElementById('val-modal-pos');
const elWcsActive = document.getElementById('val-wcs-active');
const elSpindleOverride = document.getElementById('val-spindle-override');
const elFeedOverride = document.getElementById('val-feed-override');
const elCurrentX = document.getElementById('val-current-x');
const elSequence = document.getElementById('val-sequence');
const elToolLife = document.getElementById('val-tool-life');
const elOffsetsListTbody = document.getElementById('offsets-list-tbody');
const elCurrentY = document.getElementById('val-current-y');
const elCurrentZ = document.getElementById('val-current-z');
const lampDoorSafety = document.getElementById('lamp-door-safety');
const lampCoolantLow = document.getElementById('lamp-coolant-low');
const elGcodeMatrix = document.getElementById('val-gcode-matrix');
const lampLubeLow = document.getElementById('lamp-lube-low');
const lampAirLow = document.getElementById('lamp-air-low');
const lampSpindleClamp = document.getElementById('lamp-spindle-clamp');
const lampSpindleUnclamp = document.getElementById('lamp-spindle-unclamp');
const elProgramsTbody = document.getElementById('programs-list-tbody');
const refreshProgramsBtn = document.getElementById('refresh-programs-btn');
const towerLightRed = document.getElementById('tower-light-red');
const towerLightYellow = document.getElementById('tower-light-yellow');
const towerLightGreen = document.getElementById('tower-light-green');
const elAlarmsTable = document.getElementById('alarms-log-tbody');
const clearAlarmsBtn = document.getElementById('clear-alarms-btn');

// Diagnostics & Macro Query Selections
const elAxisTelemetryTbody = document.getElementById('axis-telemetry-tbody');
const refreshAxisBtn = document.getElementById('refresh-axis-btn');
const diagSpindleActual = document.getElementById('diag-spindle-actual');
const diagSpindleTarget = document.getElementById('diag-spindle-target');
const diagSpindleTemp = document.getElementById('diag-spindle-temp');
const diagSpindleTorque = document.getElementById('diag-spindle-torque');
const diagPowerConsumption = document.getElementById('diag-power-consumption');
const diagDistanceToGo = document.getElementById('diag-distance-to-go');
const macroInput = document.getElementById('macro-input');
const queryMacroBtn = document.getElementById('query-macro-btn');
const macroResultBox = document.getElementById('macro-result-box');
const macroResultVal = document.getElementById('macro-result-val');
const viewLocalAlarmsBtn = document.getElementById('view-local-alarms-btn');
const fetchCncAlarmsBtn = document.getElementById('fetch-cnc-alarms-btn');

// Tool Group Management DOM Elements
const elToolGroupInput = document.getElementById('tool-group-input');
const queryToolGroupBtn = document.getElementById('query-tool-group-btn');
const elToolGroupActiveId = document.getElementById('tool-group-active-id');
const elToolGroupLifeInfo = document.getElementById('tool-group-life-info');
const elToolGroupSisterList = document.getElementById('tool-group-sister-list');

// Program & File Explorer DOM Elements
const elSubprogChainContainer = document.getElementById('subprog-chain-container');
const elStorageTreeContainer = document.getElementById('storage-tree-container');
const refreshExplorerBtn = document.getElementById('refresh-explorer-btn');

// CNC Parameters & Keep Relays DOM Elements
const elParamRapidTraverse = document.getElementById('param-rapid-traverse');
const elParamPartsCounter = document.getElementById('param-parts-counter');
const elKeepRelaysContainer = document.getElementById('keep-relays-container');

// OEE & Panel Buttons DOM Elements
const elOeePowerOn = document.getElementById('oee-power-on');
const elOeeOperating = document.getElementById('oee-operating');
const elOeeCutting = document.getElementById('oee-cutting');
const elCncCabinetTemp = document.getElementById('cnc-cabinet-temp');
const elCncBatteryVolt = document.getElementById('cnc-battery-volt');
const elBtnSingleBlock = document.getElementById('btn-single-block-indicator');
const elBtnDryRun = document.getElementById('btn-dry-run-indicator');
const elBtnOptionalStop = document.getElementById('btn-optional-stop-indicator');

// Probing & Forensics DOM Elements
const refreshProbingBtn = document.getElementById('refresh-probing-btn');
const probingTrendContainer = document.getElementById('probing-trend-container');
const probingMin = document.getElementById('probing-min');
const probingMax = document.getElementById('probing-max');
const probingAvg = document.getElementById('probing-avg');
const refreshOphistoryBtn = document.getElementById('refresh-ophistory-btn');
const ophistoryTbody = document.getElementById('ophistory-tbody');

// Multi-Path & Alarm History DOM Elements
const elActivePathSelect = document.getElementById('active-path-select');
const elCncAlarmHistoryTbody = document.getElementById('cnc-alarmhistory-tbody');

// Digital Twin & State Optimization DOM Elements
const elFeedOverrideText = document.getElementById('feed-override-text');
const elSpindleOverrideText = document.getElementById('spindle-override-text');
const elGcodeSlidingViewer = document.getElementById('gcode-sliding-viewer');
const elWorkOffsetsTbody = document.getElementById('work-offsets-tbody');
const elModalBadgeMotion = document.getElementById('modal-badge-motion');
const elModalBadgeUnits = document.getElementById('modal-badge-units');
const elModalBadgeCoord = document.getElementById('modal-badge-coord');
const elModalBadgeWcs = document.getElementById('modal-badge-wcs');
const elModalBadgeSpindle = document.getElementById('modal-badge-spindle');
const elModalBadgeCoolant = document.getElementById('modal-badge-coolant');
const elPmcCoolantLbl = document.getElementById('pmc-coolant-lbl');
const elPmcCoolantBar = document.getElementById('pmc-coolant-bar');
const elPmcLubeOilLbl = document.getElementById('pmc-lubeoil-lbl');
const elPmcLubeOilBar = document.getElementById('pmc-lubeoil-bar');
const elPmcAirLbl = document.getElementById('pmc-air-lbl');
const elPmcAirBar = document.getElementById('pmc-air-bar');
const elDiagWarningBanner = document.getElementById('diagnostic-warning-banner');
const elDiagWarningMsg = document.getElementById('diagnostic-warning-msg');
const elDiagCumulativeKwh = document.getElementById('diag-cumulative-kwh');
const elPmcSniffInput = document.getElementById('pmc-sniffer-input');
const elPmcSniffBtn = document.getElementById('pmc-sniffer-btn');
const elPmcSniffResult = document.getElementById('pmc-sniffer-result');
const elPmcSniffAddrLbl = document.getElementById('pmc-sniffer-addr-lbl');
const elPmcSniffValLbl = document.getElementById('pmc-sniffer-val-lbl');
const elPmcSniffLamp = document.getElementById('pmc-sniffer-lamp');

let activeSniffAddress = "";
let currentsHistory = { X: [], Y: [], Z: [] };

// Load progress elements
const barLoadX = document.getElementById('bar-load-x');
const txtLoadX = document.getElementById('txt-load-x');
const barLoadY = document.getElementById('bar-load-y');
const txtLoadY = document.getElementById('txt-load-y');
const barLoadZ = document.getElementById('bar-load-z');
const txtLoadZ = document.getElementById('txt-load-z');
const barLoadSpindle = document.getElementById('bar-load-spindle');
const txtLoadSpindle = document.getElementById('txt-load-spindle');

// Alarm Banner Elements
const alarmBanner = document.getElementById('alarm-banner');
const alarmBannerNo = document.getElementById('alarm-banner-no');
const alarmBannerMsg = document.getElementById('alarm-banner-msg');

// Machine Switcher Name UI
const elSelectedMachineName = document.getElementById('selected-machine-name');

const machinesConfig = [
    { id: 'Fanuc', prefix: 'f', badgeId: 'm1-badge', progId: 'm1-prog', partsId: 'm1-parts', name: 'Fanuc Tezgah 1' },
    { id: 'Fanuc2', prefix: 'f2', badgeId: 'm2-badge', progId: 'm2-prog', partsId: 'm2-parts', name: 'Fanuc Tezgah 2' }
];

// Initialize
function init() {
    // Dynamic naming mapping from parent Electron State
    if (window.parent && window.parent.State) {
        if (window.parent.State.cnc_slot1_name) {
            machinesConfig[0].name = window.parent.State.cnc_slot1_name;
        }
        if (window.parent.State.cnc_slot2_name) {
            machinesConfig[1].name = window.parent.State.cnc_slot2_name;
        }
    }
    
    // Update card titles dynamically in DOM
    const shopCards = document.querySelectorAll('.shop-card');
    if (shopCards.length >= 2) {
        shopCards[0].querySelector('.shop-card-title').innerHTML = `<i class="fa-solid fa-server"></i> ${machinesConfig[0].name}`;
        shopCards[1].querySelector('.shop-card-title').innerHTML = `<i class="fa-solid fa-server"></i> ${machinesConfig[1].name}`;
    }
    if (elSelectedMachineName) {
        elSelectedMachineName.textContent = machinesConfig[0].name;
    }

    // Load states from LocalStorage for all machines
    machinesConfig.forEach(m => {
        const savedHistory = localStorage.getItem(`history_${m.id}`);
        if (savedHistory) {
            try {
                const parsed = JSON.parse(savedHistory);
                machineState[m.id].partHistory = parsed.filter(item => item && item.duration <= 7200);
                localStorage.setItem(`history_${m.id}`, JSON.stringify(machineState[m.id].partHistory));
            } catch(e) {
                machineState[m.id].partHistory = [];
            }
        }
        const savedAlarms = localStorage.getItem(`alarms_${m.id}`);
        if (savedAlarms) {
            machineState[m.id].alarmHistory = JSON.parse(savedAlarms);
        }
        const savedPart = localStorage.getItem(`lastPart_${m.id}`);
        if (savedPart) {
            machineState[m.id].lastPartCount = parseInt(savedPart);
        }
        const savedSec = localStorage.getItem(`activeSeconds_${m.id}`);
        if (savedSec) {
            machineState[m.id].activeSeconds = parseInt(savedSec);
        }
        // Load daily power-on baseline (reset if date changed)
        const today = new Date().toDateString();
        const savedBaselineDate = localStorage.getItem(`powerOnBaselineDate_${m.id}`);
        const savedBaseline = localStorage.getItem(`powerOnBaseline_${m.id}`);
        if (savedBaseline && savedBaselineDate === today) {
            machineState[m.id].dailyPowerOnBaseline = parseInt(savedBaseline);
        } else {
            // New day or first run - will be set on first data arrival
            machineState[m.id].dailyPowerOnBaseline = null;
            localStorage.setItem(`powerOnBaselineDate_${m.id}`, today);
        }
    });

    renderHistory();
    renderAlarms();
    loadProgramExplorer();
    loadCncParamsAndKeepRelays();
    loadPanelSwitchesAndTimers();
    loadProbingData();
    loadOperationHistory();
    loadAxisAndDiagnostics();

    // Start Polling
    pollAgent();
    setInterval(pollAgent, 200);

    // Refresh daily power-on display every 60 seconds in case data arrives late
    setInterval(() => {
        machinesConfig.forEach(m => updateDailyPowerOnDisplay(m.id, machineState[m.id]._lastPowerOnMin || 0));
    }, 60000);

    // Start second-by-second high-frequency automatic diagnostic polling
    setInterval(() => loadAxisAndDiagnostics(false), 1500);

    // Load extra hardware features
    loadHardwareProfile();
    pollActFeedrate();
    setInterval(pollActFeedrate, 1000);

    // Event Listeners
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearHistory);
    }
    if (clearAlarmsBtn) {
        clearAlarmsBtn.addEventListener('click', clearAlarms);
    }
    if (refreshProgramsBtn) {
        refreshProgramsBtn.addEventListener('click', loadProgramsList);
    }
    if (refreshAxisBtn) {
        refreshAxisBtn.addEventListener('click', () => loadAxisAndDiagnostics(true));
    }
    if (refreshProbingBtn) {
        refreshProbingBtn.addEventListener('click', loadProbingData);
    }
    if (refreshOphistoryBtn) {
        refreshOphistoryBtn.addEventListener('click', loadOperationHistory);
    }
    if (elActivePathSelect) {
        elActivePathSelect.addEventListener('change', () => {
            currentPath = parseInt(elActivePathSelect.value) || 1;
            loadAxisAndDiagnostics(true);
        });
    }
    if (queryToolGroupBtn) {
        queryToolGroupBtn.addEventListener('click', () => {
            const grpVal = elToolGroupInput ? parseInt(elToolGroupInput.value) : 1;
            loadToolGroupManagement(isNaN(grpVal) ? 1 : grpVal);
        });
    }
    if (refreshExplorerBtn) {
        refreshExplorerBtn.addEventListener('click', loadProgramExplorer);
    }
    if (viewLocalAlarmsBtn && fetchCncAlarmsBtn) {
        viewLocalAlarmsBtn.addEventListener('click', () => {
            showingCncAlarms = false;
            viewLocalAlarmsBtn.style.background = 'rgba(59, 130, 246, 0.2)';
            viewLocalAlarmsBtn.style.color = 'var(--neon-cyan)';
            viewLocalAlarmsBtn.style.borderColor = 'rgba(59, 130, 246, 0.4)';

            fetchCncAlarmsBtn.style.background = 'rgba(255, 255, 255, 0.05)';
            fetchCncAlarmsBtn.style.color = '#9ca3af';
            fetchCncAlarmsBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';

            renderAlarms();
        });

        fetchCncAlarmsBtn.addEventListener('click', async () => {
            showingCncAlarms = true;
            fetchCncAlarmsBtn.style.background = 'rgba(59, 130, 246, 0.2)';
            fetchCncAlarmsBtn.style.color = 'var(--neon-cyan)';
            fetchCncAlarmsBtn.style.borderColor = 'rgba(59, 130, 246, 0.4)';

            viewLocalAlarmsBtn.style.background = 'rgba(255, 255, 255, 0.05)';
            viewLocalAlarmsBtn.style.color = '#9ca3af';
            viewLocalAlarmsBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';

            await loadCncAlarms();
        });
    }
    initPmcSniffer();
}

// Switch Active Machine Tab
window.switchMachine = function(machineId) {
    if (machineId === currentMachine) return;

    // Update UI active card states
    const cards = {
        'Fanuc': 'btn-m1',
        'Fanuc2': 'btn-m2'
    };

    Object.keys(cards).forEach(key => {
        const el = document.getElementById(cards[key]);
        if (key === machineId) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    currentMachine = machineId;
    lastFetchedProgMachine = null;
    currentPath = 1;
    if (elActivePathSelect) elActivePathSelect.value = "1";
    elSelectedMachineName.textContent = machinesConfig.find(m => m.id === machineId).name;
    
    // Refresh cycle time view immediately
    if (elCycleTime) elCycleTime.textContent = formatTime(machineState[currentMachine].activeSeconds);
    
    renderHistory();
    renderAlarms();

    if (elProgramsTbody) {
        elProgramsTbody.innerHTML = '<tr><td colspan="3" class="empty-table-msg">Programları yüklemek için Yenile butonuna basın.</td></tr>';
    }
    if (elAxisTelemetryTbody) {
        elAxisTelemetryTbody.innerHTML = '<tr><td colspan="7" class="empty-table-msg">Eksen verilerini yüklemek için Güncelle butonuna basın.</td></tr>';
    }
    const elHours = document.getElementById('pmc-operating-hours');
    const elLube = document.getElementById('pmc-lube-pressure');
    const elPallet = document.getElementById('pmc-pallet-state');
    const elPlcAlarms = document.getElementById('plc-alarms-tbody');
    if (elHours) elHours.textContent = '0 sa';
    if (elLube) elLube.textContent = '0.0 bar';
    if (elPallet) elPallet.textContent = 'BEKLENİYOR';
    if (elPlcAlarms) {
        elPlcAlarms.innerHTML = '<tr><td colspan="3" class="empty-table-msg" style="padding: 10px;">PLC alarmı bulunmamaktadır.</td></tr>';
    }
    if (macroResultBox) {
        macroResultBox.style.display = 'none';
    }
    if (macroInput) {
        macroInput.value = '';
    }
    if (elFeedOverrideText) elFeedOverrideText.textContent = "100%";
    if (elSpindleOverrideText) elSpindleOverrideText.textContent = "100%";
    if (elGcodeSlidingViewer) elGcodeSlidingViewer.innerHTML = '<span style="color: #6b7280;">Yükleniyor...</span>';
    if (elWorkOffsetsTbody) elWorkOffsetsTbody.innerHTML = '<tr><td colspan="4" class="empty-table-msg">Yükleniyor...</td></tr>';
    if (elPmcCoolantLbl) elPmcCoolantLbl.textContent = "0.0%";
    if (elPmcCoolantBar) elPmcCoolantBar.style.width = "0%";
    if (elPmcLubeOilLbl) elPmcLubeOilLbl.textContent = "0.0%";
    if (elPmcLubeOilBar) elPmcLubeOilBar.style.width = "0%";
    if (elPmcAirLbl) elPmcAirLbl.textContent = "0.0 Bar";
    if (elPmcAirBar) elPmcAirBar.style.width = "0%";
    if (diagSpindleActual) diagSpindleActual.textContent = '0 RPM';
    if (diagSpindleTarget) diagSpindleTarget.textContent = '0 RPM';
    if (diagSpindleTemp) diagSpindleTemp.textContent = '0 °C';
    if (diagSpindleTorque) diagSpindleTorque.textContent = '0.0 %';
    if (diagPowerConsumption) diagPowerConsumption.textContent = '0.00 kW';
    if (diagDistanceToGo) diagDistanceToGo.textContent = 'X: 0.000 | Y: 0.000 | Z: 0.000';
    if (elToolGroupActiveId) elToolGroupActiveId.textContent = '-';
    if (elToolGroupLifeInfo) elToolGroupLifeInfo.textContent = '-';
    if (elToolGroupSisterList) elToolGroupSisterList.textContent = 'Yükleniyor...';
    if (elToolGroupInput) elToolGroupInput.value = '';
    if (elSubprogChainContainer) elSubprogChainContainer.innerHTML = '<span style="font-size: 0.9em; color: #9ca3af;">Veriler yükleniyor...</span>';
    if (elStorageTreeContainer) elStorageTreeContainer.innerHTML = '<span style="font-size: 0.9em; color: #9ca3af;">Dizin ağacı yükleniyor...</span>';
    if (elParamRapidTraverse) elParamRapidTraverse.textContent = 'X: - | Y: - | Z: -';
    if (elParamPartsCounter) elParamPartsCounter.textContent = '-';
    if (elKeepRelaysContainer) elKeepRelaysContainer.innerHTML = 'Yükleniyor...';
    if (elOeePowerOn) elOeePowerOn.textContent = '0 dk';
    if (elOeeOperating) elOeeOperating.textContent = '0 dk';
    if (elOeeCutting) elOeeCutting.textContent = '0 dk';
    if (elCncCabinetTemp) elCncCabinetTemp.textContent = '-- °C';
    if (elCncBatteryVolt) elCncBatteryVolt.textContent = '-- V';
    if (elBtnSingleBlock) elBtnSingleBlock.style.background = '#374151';
    if (elBtnDryRun) elBtnDryRun.style.background = '#374151';
    if (elBtnOptionalStop) elBtnOptionalStop.style.background = '#374151';
    
    // Switch explorer panel immediately
    loadProgramExplorer();
    loadCncParamsAndKeepRelays();
    loadPanelSwitchesAndTimers();
    loadProbingData();
    loadOperationHistory();
    loadAxisAndDiagnostics();
    renderLiveTrendChart();
    loadHardwareProfile();
    pollActFeedrate();
    
    showingCncAlarms = false;
    if (viewLocalAlarmsBtn && fetchCncAlarmsBtn) {
        viewLocalAlarmsBtn.style.background = 'rgba(59, 130, 246, 0.2)';
        viewLocalAlarmsBtn.style.color = 'var(--neon-cyan)';
        viewLocalAlarmsBtn.style.borderColor = 'rgba(59, 130, 246, 0.4)';

        fetchCncAlarmsBtn.style.background = 'rgba(255, 255, 255, 0.05)';
        fetchCncAlarmsBtn.style.color = '#9ca3af';
        fetchCncAlarmsBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }
};

// Format Seconds to MM:SS
function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    let result = '';
    if (hrs > 0) {
        result += (hrs < 10 ? '0' : '') + hrs + ':';
    }
    result += (mins < 10 ? '0' : '') + mins + ':';
    result += (secs < 10 ? '0' : '') + secs;
    return result;
}

// Normalize status strings to handle case and Turkish locale (i/ı, İ/I) variations
function normalizeStatus(status) {
    if (!status) return 'READY';
    const s = status.toString().trim().toUpperCase().replace('İ', 'I').replace('ı', 'i');
    if (s.includes('UNAVAILABLE') || s.includes('UNAV')) return 'UNAVAILABLE';
    if (s.includes('ACTIVE') || s.includes('ACT')) return 'ACTIVE';
    if (s.includes('STOPPED') || s.includes('STOP')) return 'STOPPED';
    if (s.includes('INTERRUPTED') || s.includes('INT')) return 'INTERRUPTED';
    if (s.includes('READY') || s.includes('REA')) return 'READY';
    return 'READY';
}

// Update daily power-on time display (called from updateDetailsPanel when time_poweron arrives)
function updateDailyPowerOnDisplay(machineId, totalPowerOnMinutes) {
    if (isNaN(totalPowerOnMinutes) || totalPowerOnMinutes <= 0) return;
    const state = machineState[machineId];
    const today = new Date().toDateString();
    // Set baseline on first data of the day
    if (state.dailyPowerOnBaseline === null) {
        state.dailyPowerOnBaseline = totalPowerOnMinutes;
        localStorage.setItem(`powerOnBaseline_${machineId}`, totalPowerOnMinutes);
        localStorage.setItem(`powerOnBaselineDate_${machineId}`, today);
    }
    const dailyMinutes = Math.max(0, totalPowerOnMinutes - state.dailyPowerOnBaseline);
    if (machineId === currentMachine && elCycleTime) {
        const h = Math.floor(dailyMinutes / 60);
        const m = dailyMinutes % 60;
        elCycleTime.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }
}

// Fetch and Parse MTConnect XML
async function pollAgent() {
    try {
        const response = await fetch(agentUrl);
        if (!response.ok) throw new Error('HTTP error');
        
        let xmlText = await response.text();
        // Sanitize Turkish locale character corruption in MTConnect XML tag names
        xmlText = xmlText.replace(/ı/g, 'i').replace(/İ/g, 'I');
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('XML parsing error');
        }

        connectionBadge.className = 'connection-status-badge con';
        connectionText.textContent = 'Agent Bağlantısı Aktif';

        // 1. Update the Shop Floor Grid Cards
        updateShopFloorGrid(xmlDoc);

        // 2. Update the Details Panel for selected machine
        updateDetailsPanel(xmlDoc);
    } catch (error) {
        console.error('Fetch error:', error);
        connectionBadge.className = 'connection-status-badge err';
        connectionText.textContent = `Ağ Hatası: ${error.message}`;
        
        // Mark all as offline in the grid
        machinesConfig.forEach(m => {
            const badge = document.getElementById(m.badgeId);
            badge.textContent = 'OFFLINE';
            badge.className = 'badge offline';
            document.getElementById(m.progId).textContent = '-';
            document.getElementById(m.partsId).textContent = '-';
            machineState[m.id].currentExecution = 'OFFLINE';
        });

        setOfflineState();
    }
}

// Update Grid Overview Cards
function updateShopFloorGrid(xmlDoc) {
    machinesConfig.forEach(m => {
        // Query elements dynamically based on prefix
        const availQuery = m.customAvail ? m.customAvail : `${m.prefix}_avail`;
        const execQuery = m.id === 'Okuma' ? 'L2p1execution' : (m.id === 'Mazak' ? 'execution' : `${m.prefix}_execution`);
        const progQuery = m.customProg ? m.customProg : `${m.prefix}_program`;
        const partsQuery = m.customParts ? m.customParts : `${m.prefix}_part_count`;

        const availNode = xmlDoc.querySelector(`[dataItemId="${availQuery}"]`);
        const execNode = xmlDoc.querySelector(`[dataItemId="${execQuery}"]`);
        const progNode = xmlDoc.querySelector(`[dataItemId="${progQuery}"]`);
        const partsNode = xmlDoc.querySelector(`[dataItemId="${partsQuery}"]`);

        const isAvail = availNode && availNode.textContent.trim() === 'AVAILABLE';
        const badge = document.getElementById(m.badgeId);
        const progText = document.getElementById(m.progId);
        const partsText = document.getElementById(m.partsId);

        const mapId = { 'Fanuc': 1, 'Fanuc2': 2, 'Okuma': 3, 'Mazak': 4 }[m.id];
        const loadText = document.getElementById('m' + mapId + '-load');
        const toolText = document.getElementById('m' + mapId + '-tool');

        if (!isAvail) {
            badge.textContent = 'OFFLINE';
            badge.className = 'badge offline';
            progText.textContent = '-';
            partsText.textContent = '-';
            if (loadText) loadText.textContent = '-';
            if (toolText) toolText.textContent = '-';
            machineState[m.id].currentExecution = 'OFFLINE';
            return;
        }

        // Available - read execution & details
        const execVal = normalizeStatus(execNode ? execNode.textContent : 'READY');
        const progVal = progNode ? progNode.textContent.trim() : 'UNAVAILABLE';
        const partsVal = partsNode ? parseInt(partsNode.textContent.trim()) : 0;

        machineState[m.id].currentExecution = execVal;
        progText.textContent = progVal !== 'UNAVAILABLE' ? progVal : 'BOŞTA';
        partsText.textContent = partsVal;

        // Read power-on time for daily uptime display
        const powerOnQuery = `${m.prefix}_time_poweron`;
        const powerOnNode = xmlDoc.querySelector(`[dataItemId="${powerOnQuery}"]`);
        if (powerOnNode) {
            const totalMin = parseInt(powerOnNode.textContent.trim());
            updateDailyPowerOnDisplay(m.id, totalMin);
        }

        // Part completion history: only trigger on valid numeric increment
        const validParts = !isNaN(partsVal) && partsVal > 0;
        const prevCount = machineState[m.id].lastPartCount;
        // Guard: only fire if prev was stored AND new value is exactly higher (not a data reset/fluctuation)
        if (validParts && prevCount !== null && !isNaN(prevCount) && partsVal > prevCount && (partsVal - prevCount) <= 5) {
            handlePartCompleted(m.id, progVal);
        }
        if (validParts) {
            machineState[m.id].lastPartCount = partsVal;
            localStorage.setItem(`lastPart_${m.id}`, partsVal);
        }

        const cycleText = document.getElementById('m' + mapId + '-cycle');
        if (cycleText) {
            const state = machineState[m.id];
            const baseline = state.dailyPowerOnBaseline;
            if (powerOnNode && baseline !== null) {
                const totalMin = parseInt(powerOnNode.textContent.trim());
                const dayMin = Math.max(0, totalMin - baseline);
                const h = Math.floor(dayMin / 60);
                const mm = dayMin % 60;
                cycleText.textContent = `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
            }
        }

        const spLoadQuery = `${m.prefix}_spindle_load`;
        const spLoadNode = xmlDoc.querySelector(`[dataItemId="${spLoadQuery}"]`);

        if (loadText) {
            if (execVal !== 'ACTIVE' && execVal !== 'EXECUTING' && execVal !== 'RUNNING') {
                loadText.textContent = '0.0 %';
            } else if (spLoadNode) {
                const spVal = parseFloat(spLoadNode.textContent.trim());
                if (!isNaN(spVal) && spVal <= 100) loadText.textContent = spVal.toFixed(1) + ' %';
                else loadText.textContent = (18.5 + (mapId % 2) * 5.2).toFixed(1) + ' %';
            } else {
                loadText.textContent = '0.0 %';
            }
        }
            if (toolText) {
                const toolQuery = `${m.prefix}_tool`;
                const tNode = xmlDoc.querySelector(`[dataItemId="${toolQuery}"]`);
                const tVal = tNode ? parseFloat(tNode.textContent.trim()) : 0;
                toolText.textContent = tVal > 0 ? 'T' + String(tVal).padStart(2, '0') : (m.id === 'Okuma' ? 'T02' : (m.id === 'Mazak' ? 'T05' : 'T01'));
            }

        // Color badge based on execution status
        if (execVal === 'ACTIVE') {
            badge.textContent = 'ÇALIŞIYOR';
            badge.className = 'badge online';
        } else if (execVal === 'READY') {
            badge.textContent = 'BEKLEMEDE';
            badge.className = 'badge active-mode';
        } else if (execVal === 'STOPPED' || execVal === 'INTERRUPTED') {
            badge.textContent = 'DURDURULDU';
            badge.className = 'badge stopped';
        } else {
            badge.textContent = 'AKTİF';
            badge.className = 'badge active-mode';
        }

        // Part count change trigger for all machines (even background ones)
        if (machineState[m.id].lastPartCount === null) {
            machineState[m.id].lastPartCount = partsVal;
            localStorage.setItem(`lastPart_${m.id}`, partsVal);
        } else if (partsVal > machineState[m.id].lastPartCount) {
            handlePartCompleted(m.id, progVal);
            machineState[m.id].lastPartCount = partsVal;
            localStorage.setItem(`lastPart_${m.id}`, partsVal);
        }
    });
}

// Update Details Panel
function updateDetailsPanel(xmlDoc) {
    const config = machinesConfig.find(m => m.id === currentMachine);
    
    // If selected machine is currently offline
    if (machineState[currentMachine].currentExecution === 'OFFLINE') {
        setOfflineState();
        return;
    }

    // Set prefixes/selectors for details query
    const pfx = config.prefix;

    // For non-Fanuc placeholder devices, we display simulated/static values or fallback
    if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
        stateBadge.textContent = 'ONLINE';
        stateBadge.className = 'badge online';
        elExecution.textContent = machineState[currentMachine].currentExecution;
        elMode.textContent = 'OTOMATİK';
        elProgram.textContent = document.getElementById(config.progId).textContent;
        if (elPartCount) elPartCount.textContent = document.getElementById(config.partsId).textContent;
        elEstop.innerHTML = '<i class="fa-solid fa-circle-check"></i> Hazır (ARMED)';
        estopContainer.className = 'status-item warning-item';
        elTool.textContent = 'T01';
        if (elPosX) elPosX.textContent = '0.000';
        if (elPosY) elPosY.textContent = '0.000';
        if (elPosZ) elPosZ.textContent = '0.000';
        if (elSpindleSpeed) elSpindleSpeed.textContent = '0';
        if (elFeedrate) elFeedrate.textContent = '0';
        updateLoadBar(barLoadX, txtLoadX, 0);
        updateLoadBar(barLoadY, txtLoadY, 0);
        updateLoadBar(barLoadZ, txtLoadZ, 0);
        updateLoadBar(barLoadSpindle, txtLoadSpindle, 0);
        
        if (elGcodeBlock) elGcodeBlock.textContent = 'BOŞTA / ÇEVRİM DIŞI';
        if (elTempX) elTempX.textContent = '35 °C';
        if (elTempY) elTempY.textContent = '37 °C';
        if (elTempZ) elTempZ.textContent = '40 °C';
        if (elTempSpindle) elTempSpindle.textContent = '42 °C';
        if (elErrX) elErrX.textContent = '0.002 mm';
        if (elErrY) elErrY.textContent = '0.001 mm';
        if (elErrZ) elErrZ.textContent = '0.003 mm';
        if (elTimePowerOn) elTimePowerOn.textContent = '12050 dk';
        if (elTimeOperating) elTimeOperating.textContent = '8400 dk';
        if (elTimeCutting) elTimeCutting.textContent = '5120 dk';
        if (elToolGeom) elToolGeom.textContent = '120.450 mm';
        if (elToolWear) elToolWear.textContent = '0.015 mm';
        if (elSequence) elSequence.textContent = 'N100';
        if (elToolLife) elToolLife.textContent = '90/150 min';
        if (elOffsetsListTbody) {
            let html = '';
            for (let idx = 1; idx <= 40; idx++) {
                html += `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <td style="padding: 4px; color: var(--neon-cyan); font-weight: bold;">T${idx}</td>
                    <td style="padding: 4px;">${(10 + idx * 1.5).toFixed(3)} mm</td>
                    <td style="padding: 4px;">${(idx * 0.002).toFixed(3)} mm</td>
                </tr>`;
            }
            elOffsetsListTbody.innerHTML = html;
        }
        if (lampCycleStart) lampCycleStart.classList.remove('active');
        if (lampFeedHold) lampFeedHold.classList.remove('active');
        
        if (elGcodeMatrix) {
            elGcodeMatrix.innerHTML = `
                <span class="badge-gcode" style="background: rgba(59, 130, 246, 0.15); color: var(--neon-cyan); border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; font-family: monospace; font-weight: bold; margin-right: 4px;">G01</span>
                <span class="badge-gcode" style="background: rgba(59, 130, 246, 0.15); color: var(--neon-cyan); border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; font-family: monospace; font-weight: bold; margin-right: 4px;">G17</span>
                <span class="badge-gcode" style="background: rgba(59, 130, 246, 0.15); color: var(--neon-cyan); border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; font-family: monospace; font-weight: bold; margin-right: 4px;">G90</span>
                <span class="badge-gcode" style="background: rgba(59, 130, 246, 0.15); color: var(--neon-cyan); border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; font-family: monospace; font-weight: bold; margin-right: 4px;">G94</span>
                <span class="badge-gcode" style="background: rgba(59, 130, 246, 0.15); color: var(--neon-cyan); border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; font-family: monospace; font-weight: bold; margin-right: 4px;">G21</span>
            `;
        }
        if (lampLubeLow) lampLubeLow.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
        if (lampAirLow) lampAirLow.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
        if (lampSpindleClamp) lampSpindleClamp.querySelector('.lamp-bulb').style.backgroundColor = '#10b981';
        if (lampSpindleUnclamp) lampSpindleUnclamp.querySelector('.lamp-bulb').style.backgroundColor = '#374151';

        // Mock advanced details
        if (elModalMotion) elModalMotion.textContent = 'G01';
        if (elModalPos) elModalPos.textContent = 'G90';
        if (elWcsActive) elWcsActive.textContent = 'G54';
        if (elSpindleOverride) elSpindleOverride.textContent = 'Fener Mili Ov: 100%';
        if (elFeedOverride) elFeedOverride.textContent = 'İlerleme Ov: 100%';
        if (elCurrentX) elCurrentX.textContent = '4.2 A';
        if (elCurrentY) elCurrentY.textContent = '3.8 A';
        if (elCurrentZ) elCurrentZ.textContent = '5.1 A';
        if (lampDoorSafety) {
            lampDoorSafety.classList.remove('active');
            lampDoorSafety.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
            lampDoorSafety.querySelector('.lamp-label').textContent = 'Kabin Kapısı Kapalı';
        }
        if (lampCoolantLow) {
            lampCoolantLow.classList.remove('active');
            lampCoolantLow.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
            lampCoolantLow.querySelector('.lamp-label').textContent = 'Bor Yağı Seviyesi Normal';
        }
        if (towerLightRed) towerLightRed.classList.remove('active');
        if (towerLightYellow) towerLightYellow.classList.remove('active');
        if (towerLightGreen) towerLightGreen.classList.add('active');

        // Mock WCS table
        for (let w = 54; w <= 59; w++) {
            const valX = w === 54 ? '-120.450' : '0.000';
            const valY = w === 54 ? '-85.120' : '0.000';
            const valZ = w === 54 ? '-210.050' : '0.000';
            const elX = document.getElementById(`wcs-g${w}-x`);
            const elY = document.getElementById(`wcs-g${w}-y`);
            const elZ = document.getElementById(`wcs-g${w}-z`);
            if (elX) elX.textContent = valX;
            if (elY) elY.textContent = valY;
            if (elZ) elZ.textContent = valZ;
        }
        
        alarmBanner.classList.remove('active');
        return;
    }

    // Live Fanuc 1 & 2 parsing
    const estopNode = xmlDoc.querySelector(`[dataItemId="${pfx}_estop"]`);
    const modeNode = xmlDoc.querySelector(`[dataItemId="${pfx}_mode"]`);
    const execNode = xmlDoc.querySelector(`[dataItemId="${pfx}_execution"]`);
    const progNode = xmlDoc.querySelector(`[dataItemId="${pfx}_program"]`);
    const partCountNode = xmlDoc.querySelector(`[dataItemId="${pfx}_part_count"]`);
    const posXNode = xmlDoc.querySelector(`[dataItemId="${pfx}_abs_x"]`);
    const posYNode = xmlDoc.querySelector(`[dataItemId="${pfx}_abs_y"]`);
    const posZNode = xmlDoc.querySelector(`[dataItemId="${pfx}_abs_z"]`);
    const loadXNode = xmlDoc.querySelector(`[dataItemId="${pfx}_load_x"]`);
    const loadYNode = xmlDoc.querySelector(`[dataItemId="${pfx}_load_y"]`);
    const loadZNode = xmlDoc.querySelector(`[dataItemId="${pfx}_load_z"]`);
    const spSpeedNode = xmlDoc.querySelector(`[dataItemId="${pfx}_spindle_speed"]`);
    const spLoadNode = xmlDoc.querySelector(`[dataItemId="${pfx}_spindle_load"]`);
    const feedNode = xmlDoc.querySelector(`[dataItemId="${pfx}_feedrate"]`);
    const toolNode = xmlDoc.querySelector(`[dataItemId="${pfx}_tool"]`);
    const alarmNoNode = xmlDoc.querySelector(`[dataItemId="${pfx}_alarm_no"]`);
    const alarmMsgNode = xmlDoc.querySelector(`[dataItemId="${pfx}_alarm_msg"]`);

    // E-Stop
    const estop = estopNode ? estopNode.textContent.trim() : 'UNAVAILABLE';
    if (estop === 'TRIGGERED') {
        elEstop.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> ACİL DURDURMA';
        estopContainer.className = 'status-item warning-item triggered';
    } else {
        elEstop.innerHTML = '<i class="fa-solid fa-circle-check"></i> Hazır (ARMED)';
        estopContainer.className = 'status-item warning-item';
    }

    // Mode
    elMode.textContent = modeNode ? modeNode.textContent.trim() : 'UNAVAILABLE';

    // Execution
    const execution = normalizeStatus(execNode ? execNode.textContent : 'UNAVAILABLE');
    elExecution.textContent = execution;

    // Detail badge status
    if (execution === 'ACTIVE') {
        stateBadge.textContent = 'ÇALIŞIYOR';
        stateBadge.className = 'badge active';
    } else if (execution === 'READY') {
        stateBadge.textContent = 'BEKLEMEDE';
        stateBadge.className = 'badge ready';
    } else if (execution === 'STOPPED' || execution === 'INTERRUPTED') {
        stateBadge.textContent = 'DURDURULDU';
        stateBadge.className = 'badge stopped';
    } else {
        stateBadge.textContent = 'BİLİNMİYOR';
        stateBadge.className = 'badge offline';
    }

    // Program
    elProgram.textContent = progNode ? progNode.textContent.trim() : 'UNAVAILABLE';

    // Tool
    const toolNum = toolNode ? parseFloat(toolNode.textContent.trim()) : 0;
    elTool.textContent = toolNum > 0 ? 'T' + String(toolNum).padStart(2, '0') : 'T00';

    // Coordinates (Fanuc 1 raw pos is divided in adapter, Fanuc 2 comes raw or divided. In both, format correctly)
    const posX = posXNode ? parseFloat(posXNode.textContent.trim()) : 0;
    const posY = posYNode ? parseFloat(posYNode.textContent.trim()) : 0;
    const posZ = posZNode ? parseFloat(posZNode.textContent.trim()) : 0;
    
    // In our C# Adapter, we divide by 1000.0, so the XML value is already in mm. We just display it.
    if (elPosX) elPosX.textContent = posX.toFixed(3);
    if (elPosY) elPosY.textContent = posY.toFixed(3);
    if (elPosZ) elPosZ.textContent = posZ.toFixed(3);

    // Spindle / Feed
    if (elSpindleSpeed) elSpindleSpeed.textContent = spSpeedNode ? Math.round(parseFloat(spSpeedNode.textContent.trim())) : '0';
    if (elFeedrate) elFeedrate.textContent = feedNode ? Math.round(parseFloat(feedNode.textContent.trim())) : '0';

    // Loads (Handle high load values or normal values safely)
    const loadX = loadXNode ? parseFloat(loadXNode.textContent.trim()) : 0;
    const loadY = loadYNode ? parseFloat(loadYNode.textContent.trim()) : 0;
    const loadZ = loadZNode ? parseFloat(loadZNode.textContent.trim()) : 0;
    const loadSp = spLoadNode ? parseFloat(spLoadNode.textContent.trim()) : 0;

    // Make sure we clamp axis loads within 0-100 (in case of raw FOCAS registry error values)
    updateLoadBar(barLoadX, txtLoadX, loadX > 500 ? 0 : loadX);
    updateLoadBar(barLoadY, txtLoadY, loadY > 500 ? 0 : loadY);
    updateLoadBar(barLoadZ, txtLoadZ, loadZ > 500 ? 0 : loadZ);
    updateLoadBar(barLoadSpindle, txtLoadSpindle, loadSp > 500 ? 0 : loadSp);

    // Part Count
    if (elPartCount) elPartCount.textContent = partCountNode ? parseInt(partCountNode.textContent.trim()) : 0;

    // Advanced Telemetry Parse & Render
    const blockNode = xmlDoc.querySelector(`[dataItemId="${pfx}_block"]`);
    const tempXNode = xmlDoc.querySelector(`[dataItemId="${pfx}_temp_x"]`);
    const tempYNode = xmlDoc.querySelector(`[dataItemId="${pfx}_temp_y"]`);
    const tempZNode = xmlDoc.querySelector(`[dataItemId="${pfx}_temp_z"]`);
    const tempSpNode = xmlDoc.querySelector(`[dataItemId="${pfx}_temp_spindle"]`);
    const encTempXNode  = xmlDoc.querySelector(`[dataItemId="${pfx}_enc_temp_x"]`);
    const encTempYNode  = xmlDoc.querySelector(`[dataItemId="${pfx}_enc_temp_y"]`);
    const encTempZNode  = xmlDoc.querySelector(`[dataItemId="${pfx}_enc_temp_z"]`);
    const encTempSpNode = xmlDoc.querySelector(`[dataItemId="${pfx}_enc_temp_spindle"]`);
    const timePowerOnNode = xmlDoc.querySelector(`[dataItemId="${pfx}_time_poweron"]`);
    const timeOperatingNode = xmlDoc.querySelector(`[dataItemId="${pfx}_time_operating"]`);
    const timeCuttingNode = xmlDoc.querySelector(`[dataItemId="${pfx}_time_cutting"]`);
    const toolGeomNode = xmlDoc.querySelector(`[dataItemId="${pfx}_tool_geom"]`);
    const toolWearNode = xmlDoc.querySelector(`[dataItemId="${pfx}_tool_wear"]`);
    const pmcCycleStartNode = xmlDoc.querySelector(`[dataItemId="${pfx}_pmc_cycle_start"]`);
    const pmcFeedHoldNode = xmlDoc.querySelector(`[dataItemId="${pfx}_pmc_feed_hold"]`);
    
    // New Advanced Node Queries
    const feedOverrideNode = xmlDoc.querySelector(`[dataItemId="${pfx}_feed_override"]`);
    const spindleOverrideNode = xmlDoc.querySelector(`[dataItemId="${pfx}_spindle_override"]`);
    const modalMotionNode = xmlDoc.querySelector(`[dataItemId="${pfx}_modal_motion"]`);
    const modalPosNode = xmlDoc.querySelector(`[dataItemId="${pfx}_modal_pos"]`);
    const wcsActiveNode = xmlDoc.querySelector(`[dataItemId="${pfx}_wcs_active"]`);
    const currentXNode = xmlDoc.querySelector(`[dataItemId="${pfx}_current_x"]`);
    const currentYNode = xmlDoc.querySelector(`[dataItemId="${pfx}_current_y"]`);
    const currentZNode = xmlDoc.querySelector(`[dataItemId="${pfx}_current_z"]`);
    const pmcX0Node = xmlDoc.querySelector(`[dataItemId="${pfx}_pmc_x0"]`);
    const pmcY0Node = xmlDoc.querySelector(`[dataItemId="${pfx}_pmc_y0"]`);
    const pmcY1Node = xmlDoc.querySelector(`[dataItemId="${pfx}_pmc_y1"]`);
    const pmcY3Node = xmlDoc.querySelector(`[dataItemId="${pfx}_pmc_y3"]`);
    const pmcX1Node = xmlDoc.querySelector(`[dataItemId="${pfx}_pmc_x1"]`);
    const pmcX5Node = xmlDoc.querySelector(`[dataItemId="${pfx}_pmc_x5"]`);
    const pmcX8Node = xmlDoc.querySelector(`[dataItemId="${pfx}_pmc_x8"]`);
    const pmcX9Node = xmlDoc.querySelector(`[dataItemId="${pfx}_pmc_x9"]`);
    const pmcX10Node = xmlDoc.querySelector(`[dataItemId="${pfx}_pmc_x10"]`);
    const gcodeMatrixNode = xmlDoc.querySelector(`[dataItemId="${pfx}_gcode_matrix"]`);
    const sequenceNode = xmlDoc.querySelector(`[dataItemId="${pfx}_sequence"]`);
    const toolLifeNode = xmlDoc.querySelector(`[dataItemId="${pfx}_tool_life"]`);
    const toolOffsetsNode = xmlDoc.querySelector(`[dataItemId="${pfx}_tool_offsets"]`);

    // G-Code Block & Retro Multi-Line Terminal
    const blockText = blockNode ? blockNode.textContent.trim() : 'BOŞTA';
    const seqText = sequenceNode ? 'N' + sequenceNode.textContent.trim() : 'N0';
    if (elGcodeBlock) {
        elGcodeBlock.textContent = blockText;
    }
    renderGCodeTerminal(blockText, seqText);




    // Diagnostic Timers
    if (timePowerOnNode) {
        const totalPowerOnMin = parseInt(timePowerOnNode.textContent.trim());
        elTimePowerOn.textContent = totalPowerOnMin + ' dk';
        // Also sync daily uptime display for currently selected machine
        updateDailyPowerOnDisplay(currentMachine, totalPowerOnMin);
    }
    if (timeOperatingNode) elTimeOperating.textContent = parseInt(timeOperatingNode.textContent.trim()) + ' dk';
    if (timeCuttingNode) elTimeCutting.textContent = parseInt(timeCuttingNode.textContent.trim()) + ' dk';

    // Offsets - clamp unreasonably large values
    if (elToolGeom) {
        const geomVal = toolGeomNode ? parseFloat(toolGeomNode.textContent.trim()) : 0;
        elToolGeom.textContent = (Math.abs(geomVal) < 500) ? geomVal.toFixed(3) + ' mm' : '-- mm';
    }
    if (elToolWear) {
        const wearVal = toolWearNode ? parseFloat(toolWearNode.textContent.trim()) : 0;
        elToolWear.textContent = (Math.abs(wearVal) < 50) ? wearVal.toFixed(3) + ' mm' : '-- mm';
    }

    // Sequence (N Code)
    if (elSequence) {
        elSequence.textContent = sequenceNode ? 'N' + sequenceNode.textContent.trim() : 'N0';
    }

    // Tool Life
    if (elToolLife) {
        elToolLife.textContent = toolLifeNode ? toolLifeNode.textContent.trim() : 'UNAVAILABLE';
    }

    // Tool Offsets T1-T40 List population
    if (elOffsetsListTbody && toolOffsetsNode) {
        const rawOffsets = toolOffsetsNode.textContent.trim();
        if (rawOffsets && rawOffsets !== 'UNAVAILABLE') {
            const items = rawOffsets.split(',');
            let html = '';
            items.forEach(item => {
                const parts = item.split(':');
                if (parts.length === 2) {
                    const tNum = parts[0];
                    const vals = parts[1].split('/');
                    if (vals.length === 2) {
                        const geom = vals[0].substring(1);
                        const wear = vals[1].substring(1);
                        html += `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <td style="padding: 4px; color: var(--neon-cyan); font-weight: bold;">${tNum}</td>
                            <td style="padding: 4px;">${geom} mm</td>
                            <td style="padding: 4px;">${wear} mm</td>
                        </tr>`;
                    }
                }
            });
            elOffsetsListTbody.innerHTML = html;
        }
    }

    // Modals
    if (elModalMotion) elModalMotion.textContent = modalMotionNode ? modalMotionNode.textContent.trim() : 'G00';
    if (elModalPos) elModalPos.textContent = modalPosNode ? modalPosNode.textContent.trim() : 'G90';
    if (elWcsActive) elWcsActive.textContent = wcsActiveNode ? wcsActiveNode.textContent.trim() : 'G54';

    // Overrides
    if (elSpindleOverride) elSpindleOverride.textContent = spindleOverrideNode ? 'Fener Mili Ov: ' + spindleOverrideNode.textContent.trim() + '%' : 'Fener Mili Ov: 100%';
    if (elFeedOverride) elFeedOverride.textContent = feedOverrideNode ? 'İlerleme Ov: ' + feedOverrideNode.textContent.trim() + '%' : 'İlerleme Ov: 100%';

    // Currents
    if (elCurrentX) elCurrentX.textContent = formatCurrent(currentXNode);
    if (elCurrentY) elCurrentY.textContent = formatCurrent(currentYNode);
    if (elCurrentZ) elCurrentZ.textContent = formatCurrent(currentZNode);

    // PMC Lamps
    const pmcCS = pmcCycleStartNode ? pmcCycleStartNode.textContent.trim() : '0';
    const pmcFH = pmcFeedHoldNode ? pmcFeedHoldNode.textContent.trim() : '0';
    if (lampCycleStart) {
        if (pmcCS === '1') {
            lampCycleStart.classList.add('active');
        } else {
            lampCycleStart.classList.remove('active');
        }
    }
    if (lampFeedHold) {
        if (pmcFH === '1') {
            lampFeedHold.classList.add('active');
        } else {
            lampFeedHold.classList.remove('active');
        }
    }

    // PMC Raw registers parsing
    const pmcX0 = pmcX0Node ? parseInt(pmcX0Node.textContent.trim()) : 0;
    const pmcX1 = pmcX1Node ? parseInt(pmcX1Node.textContent.trim()) : 0;
    const pmcX5 = pmcX5Node ? parseInt(pmcX5Node.textContent.trim()) : 0;
    const pmcX8 = pmcX8Node ? parseInt(pmcX8Node.textContent.trim()) : 0;
    const pmcX9 = pmcX9Node ? parseInt(pmcX9Node.textContent.trim()) : 0;
    const pmcX10 = pmcX10Node ? parseInt(pmcX10Node.textContent.trim()) : 0;
    const pmcY0 = pmcY0Node ? parseInt(pmcY0Node.textContent.trim()) : 0;
    const pmcY1 = pmcY1Node ? parseInt(pmcY1Node.textContent.trim()) : 0;
 
    // Cabin Door Safety switch (bit 1 of X8 - DC&L.M DOOR CLOSE & LOCKING STATE)
    // If X8.1 is 1 (bit 1 = 0x02), the door is closed and locked. If 0, the door is open.
    const doorOpen = (pmcX8 & 0x02) === 0;
    if (lampDoorSafety) {
        if (doorOpen) {
            lampDoorSafety.classList.add('active');
            lampDoorSafety.querySelector('.lamp-bulb').style.backgroundColor = '#ef4444';
            lampDoorSafety.querySelector('.lamp-label').textContent = 'Kabin Kapısı Açık';
        } else {
            lampDoorSafety.classList.remove('active');
            lampDoorSafety.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
            lampDoorSafety.querySelector('.lamp-label').textContent = 'Kabin Kapısı Kapalı';
        }
    }
 
    // Bor yağı / Coolant level low (bit 4 of X5 - CLVL.M COOLANT LEVEL LOW CHECK)
    const coolantLow = (pmcX5 & 0x10) !== 0;
    if (lampCoolantLow) {
        if (coolantLow) {
            lampCoolantLow.classList.add('active');
            lampCoolantLow.querySelector('.lamp-bulb').style.backgroundColor = '#f59e0b';
            lampCoolantLow.querySelector('.lamp-label').textContent = 'Bor Yağı Seviyesi Az';
        } else {
            lampCoolantLow.classList.remove('active');
            lampCoolantLow.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
            lampCoolantLow.querySelector('.lamp-label').textContent = 'Bor Yağı Normal';
        }
    }

    // Grease/Lube low (bit 5 of X9 - LUB.M LUB.LEVEL LOW)
    const lubeLow = (pmcX9 & 0x20) !== 0;
    if (lampLubeLow) {
        if (lubeLow) {
            lampLubeLow.classList.add('active');
            lampLubeLow.querySelector('.lamp-bulb').style.backgroundColor = '#ef4444';
            lampLubeLow.querySelector('.lamp-label').textContent = 'Kızak Yağı Az';
        } else {
            lampLubeLow.classList.remove('active');
            lampLubeLow.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
            lampLubeLow.querySelector('.lamp-label').textContent = 'Kızak Yağı Normal';
        }
    }

    // Air pressure low (bit 5 of X10 - APRS.M AIR PRESSURE CHECK)
    // If X10.5 is 1 (bit 5 = 0x20), air pressure is OK. If 0, air pressure is low.
    const airLow = (pmcX10 & 0x20) === 0;
    if (lampAirLow) {
        if (airLow) {
            lampAirLow.classList.add('active');
            lampAirLow.querySelector('.lamp-bulb').style.backgroundColor = '#ef4444';
            lampAirLow.querySelector('.lamp-label').textContent = 'Hava Basıncı Düşük';
        } else {
            lampAirLow.classList.remove('active');
            lampAirLow.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
            lampAirLow.querySelector('.lamp-label').textContent = 'Hava Basıncı Normal';
        }
    }

    // Spindle clamp (bit 6 of Y0 - MCID.R MAIN-CHUCK INWARD)
    const spindleClamp = (pmcY0 & 0x40) !== 0;
    if (lampSpindleClamp) {
        if (spindleClamp) {
            lampSpindleClamp.classList.add('active');
            lampSpindleClamp.querySelector('.lamp-bulb').style.backgroundColor = '#10b981';
        } else {
            lampSpindleClamp.classList.remove('active');
            lampSpindleClamp.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
        }
    }

    // Spindle unclamp (bit 7 of Y0 - MCOD.R MAIN-CHUCK OUTWARD)
    const spindleUnclamp = (pmcY0 & 0x80) !== 0;
    if (lampSpindleUnclamp) {
        if (spindleUnclamp) {
            lampSpindleUnclamp.classList.add('active');
            lampSpindleUnclamp.querySelector('.lamp-bulb').style.backgroundColor = '#f59e0b';
        } else {
            lampSpindleUnclamp.classList.remove('active');
            lampSpindleUnclamp.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
        }
    }

    // Modal G-code Matrix
    if (elGcodeMatrix) {
        const matrixRaw = gcodeMatrixNode ? gcodeMatrixNode.textContent.trim() : '';
        if (matrixRaw && matrixRaw !== 'UNAVAILABLE') {
            const codes = matrixRaw.split(',');
            let html = '';
            codes.forEach(c => {
                html += `<span class="badge-gcode" style="background: rgba(59, 130, 246, 0.15); color: var(--neon-cyan); border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; font-family: monospace; font-weight: bold; margin-right: 4px;">${c}</span>`;
            });
            elGcodeMatrix.innerHTML = html;
        } else {
            elGcodeMatrix.innerHTML = `<span style="font-size: 0.85em; color: #6b7280;">Yok</span>`;
        }
    }

    // Alarm parse
    const alarmNo = alarmNoNode ? parseInt(alarmNoNode.textContent.trim()) : 0;
    const alarmMsg = alarmMsgNode ? alarmMsgNode.textContent.trim() : '';

    // Tower lights stack logic - use real Y3 bits (PTG, PTY, PTR) with fallback to execution state if all 0
    const pmcY3 = pmcY3Node ? parseInt(pmcY3Node.textContent.trim()) : 0;
    
    let greenActive = (pmcY3 & 0x01) !== 0;     // Y3.0 is PTG.R (Green)
    let yellowActive = (pmcY3 & 0x02) !== 0;    // Y3.1 is PTY.R (Yellow)
    let redActive = (pmcY3 & 0x04) !== 0;       // Y3.2 is PTR.R (Red)

    // Fallback to execution state if none of the physical lights are active in PMC
    if (!greenActive && !yellowActive && !redActive) {
        greenActive = execution === 'ACTIVE';
        yellowActive = execution === 'READY' || execution === 'INTERRUPTED';
        redActive = execution === 'STOPPED' || estop === 'TRIGGERED' || alarmNo > 0;
    }

    if (towerLightRed) {
        if (redActive) towerLightRed.classList.add('active');
        else towerLightRed.classList.remove('active');
    }
    if (towerLightYellow) {
        if (yellowActive) towerLightYellow.classList.add('active');
        else towerLightYellow.classList.remove('active');
    }
    if (towerLightGreen) {
        if (greenActive) towerLightGreen.classList.add('active');
        else towerLightGreen.classList.remove('active');
    }

    // Update WCS Coordinate Offset Table cells
    for (let w = 54; w <= 59; w++) {
        const xNode = xmlDoc.querySelector(`[dataItemId="${pfx}_wcs_g${w}_x"]`);
        const yNode = xmlDoc.querySelector(`[dataItemId="${pfx}_wcs_g${w}_y"]`);
        const zNode = xmlDoc.querySelector(`[dataItemId="${pfx}_wcs_g${w}_z"]`);
        const elX = document.getElementById(`wcs-g${w}-x`);
        const elY = document.getElementById(`wcs-g${w}-y`);
        const elZ = document.getElementById(`wcs-g${w}-z`);
        if (elX) elX.textContent = xNode ? parseFloat(xNode.textContent.trim()).toFixed(3) : '0.000';
        if (elY) elY.textContent = yNode ? parseFloat(yNode.textContent.trim()).toFixed(3) : '0.000';
        if (elZ) elZ.textContent = zNode ? parseFloat(zNode.textContent.trim()).toFixed(3) : '0.000';
    }

    // Alarm Log History Trigger

    if (alarmNo > 0) {
        alarmBannerNo.textContent = alarmNo;
        alarmBannerMsg.textContent = alarmMsg;
        alarmBanner.classList.add('active');

        // Log unique alarms to persistent LocalStorage log
        const history = machineState[currentMachine].alarmHistory;
        const lastAlarm = history[0];
        if (!lastAlarm || lastAlarm.no !== alarmNo) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('tr-TR');
            const newAlarm = {
                no: alarmNo,
                msg: alarmMsg || 'Tanımsız Alarm',
                time: timeStr,
                type: 'HATA'
            };
            history.unshift(newAlarm);
            if (history.length > 50) history.pop();
            localStorage.setItem(`alarms_${currentMachine}`, JSON.stringify(history));
            renderAlarms();
        }
    } else {
        alarmBanner.classList.remove('active');
    }
}

// Set Offline State on Connection Fail / Selection
function setOfflineState() {
    stateBadge.textContent = 'OFFLINE';
    stateBadge.className = 'badge offline';
    elExecution.textContent = 'BAĞLANTI YOK';
    elMode.textContent = 'BAĞLANTI YOK';
    elProgram.textContent = 'BAĞLANTI YOK';
    elEstop.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> BAĞLANTI YOK';
    if (elServoFan) {
        elServoFan.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> BAĞLANTI YOK';
        elServoFan.style.color = '';
    }
    if (elCabinetFan) {
        elCabinetFan.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> BAĞLANTI YOK';
        elCabinetFan.style.color = '';
    }
    estopContainer.className = 'status-item';
    
    if (elPosX) elPosX.textContent = '0.000';
    if (elPosY) elPosY.textContent = '0.000';
    if (elPosZ) elPosZ.textContent = '0.000';
    if (elSpindleSpeed) elSpindleSpeed.textContent = '0';
    if (elFeedrate) elFeedrate.textContent = '0';
    elTool.textContent = 'T00';
    if (elPartCount) elPartCount.textContent = '0';
    
    updateLoadBar(barLoadX, txtLoadX, 0);
    updateLoadBar(barLoadY, txtLoadY, 0);
    updateLoadBar(barLoadZ, txtLoadZ, 0);
    updateLoadBar(barLoadSpindle, txtLoadSpindle, 0);

    if (elGcodeBlock) elGcodeBlock.textContent = 'BAĞLANTI YOK';
    if (elTempX) elTempX.textContent = '0 °C';
    if (elTempY) elTempY.textContent = '0 °C';
    if (elTempZ) elTempZ.textContent = '0 °C';
    if (elTempSpindle) elTempSpindle.textContent = '0 °C';
    if (elErrX) elErrX.textContent = '0.000 mm';
    if (elErrY) elErrY.textContent = '0.000 mm';
    if (elErrZ) elErrZ.textContent = '0.000 mm';
    if (elTimePowerOn) elTimePowerOn.textContent = '0 dk';
    if (elTimeOperating) elTimeOperating.textContent = '0 dk';
    if (elTimeCutting) elTimeCutting.textContent = '0 dk';
    if (elToolGeom) elToolGeom.textContent = '0.000 mm';
    if (elToolWear) elToolWear.textContent = '0.000 mm';
    if (lampCycleStart) lampCycleStart.classList.remove('active');
    if (lampFeedHold) lampFeedHold.classList.remove('active');

    // Reset advanced details
    if (elModalMotion) elModalMotion.textContent = 'BAĞLANTI YOK';
    if (elModalPos) elModalPos.textContent = 'BAĞLANTI YOK';
    if (elWcsActive) elWcsActive.textContent = 'BAĞLANTI YOK';
    if (elSpindleOverride) elSpindleOverride.textContent = 'Fener Mili Ov: -';
    if (elFeedOverride) elFeedOverride.textContent = 'İlerleme Ov: -';
    if (elCurrentX) elCurrentX.textContent = '0.0 A';
    if (elCurrentY) elCurrentY.textContent = '0.0 A';
    if (elCurrentZ) elCurrentZ.textContent = '0.0 A';
    if (lampDoorSafety) {
        lampDoorSafety.classList.remove('active');
        lampDoorSafety.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
        lampDoorSafety.querySelector('.lamp-label').textContent = 'BAĞLANTI YOK';
    }
    if (lampCoolantLow) {
        lampCoolantLow.classList.remove('active');
        lampCoolantLow.querySelector('.lamp-bulb').style.backgroundColor = '#374151';
        lampCoolantLow.querySelector('.lamp-label').textContent = 'BAĞLANTI YOK';
    }
    if (towerLightRed) towerLightRed.classList.remove('active');
    if (towerLightYellow) towerLightYellow.classList.remove('active');
    if (towerLightGreen) towerLightGreen.classList.remove('active');

    for (let w = 54; w <= 59; w++) {
        const elX = document.getElementById(`wcs-g${w}-x`);
        const elY = document.getElementById(`wcs-g${w}-y`);
        const elZ = document.getElementById(`wcs-g${w}-z`);
        if (elX) elX.textContent = '0.000';
        if (elY) elY.textContent = '0.000';
        if (elZ) elZ.textContent = '0.000';
    }

    alarmBanner.classList.remove('active');
}

// NC Program Code Cache for Full Program View
const programCodeCache = {};
let lastFetchedProgMachine = null;

async function fetchFullProgramCode(machineId) {
    if (lastFetchedProgMachine === machineId && programCodeCache[machineId] && programCodeCache[machineId].length > 0) return;
    try {
        lastFetchedProgMachine = machineId;
        const res = await fetch(`/programcode?machine=${machineId}&number=0`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.code) {
            programCodeCache[machineId] = data.code.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        }
    } catch (e) {}
}

// Render Multi-line Retro G-Code Terminal with Line-by-Line Auto Scrolling
function renderGCodeTerminal(blockText, sequenceCode) {
    const box = document.getElementById('gcode-terminal-box');
    if (!box) return;
    
    // Trigger async fetch of full program if not loaded yet
    if (!programCodeCache[currentMachine]) {
        fetchFullProgramCode(currentMachine);
    }

    // Determine target lines (full NC program if cached, or execution block as fallback)
    let linesToRender = programCodeCache[currentMachine];
    if (!linesToRender || linesToRender.length === 0) {
        linesToRender = blockText ? blockText.split(/\r?\n|\|/).map(l => l.trim()).filter(l => l.length > 0) : [];
    }

    if (!linesToRender || linesToRender.length === 0) {
        box.innerHTML = `<div class="gcode-line" style="color: #6b7280; font-style: italic; padding: 5px;">[ PROGRAM BOŞTA / İŞLEME BEKLENİYOR ]</div>`;
        return;
    }

    const cleanBlock = (blockText || '').replace(/\|/g, ' ').trim();
    const seqNumStr = (sequenceCode || '').replace(/^N/, '').trim();

    let html = '';
    let activeFound = false;

    linesToRender.forEach((lineStr, idx) => {
        // Check if this line matches active sequence number (Nxxx) or active block
        let isActive = false;
        if (!activeFound && lineStr.length > 0) {
            if (seqNumStr && seqNumStr !== '0' && (lineStr.startsWith('N' + seqNumStr) || lineStr.includes('N' + seqNumStr + ' '))) {
                isActive = true;
                activeFound = true;
            } else if (cleanBlock && cleanBlock !== 'BOŞTA' && cleanBlock !== 'BLOCK ACTIVE' && lineStr.includes(cleanBlock)) {
                isActive = true;
                activeFound = true;
            }
        }

        if (isActive) {
            html += `<div class="gcode-line active-line" style="color: #10b981; font-weight: bold; background: rgba(16, 185, 129, 0.22); padding: 4px 8px; border-radius: 4px; margin: 3px 0; border-left: 4px solid #10b981; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);">
                <span><span style="color: var(--neon-orange); margin-right: 10px; font-weight: bold;">>>></span> ${lineStr}</span>
                <span style="font-size: 0.75em; background: #10b981; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold; text-transform: uppercase;">ÇALIŞIYOR</span>
            </div>`;
        } else {
            html += `<div class="gcode-line" style="color: #9ca3af; padding: 3px 8px; margin: 1px 0; opacity: 0.85; border-left: 4px solid transparent; font-family: monospace;">
                <span style="color: #4b5563; margin-right: 15px; user-select: none; font-size: 0.85em;">${(idx + 1).toString().padStart(3, '0')}</span> ${lineStr}
            </div>`;
        }
    });

    box.innerHTML = html;
    
    // Auto-scroll to active line smoothly
    const activeEl = box.querySelector('.active-line');
    if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Format temperature value - clamp unreasonable FOCAS raw values
function formatTemp(node) {
    if (!node) return '-- °C';
    const val = parseFloat(node.textContent.trim());
    if (isNaN(val) || val > 120 || val < -10) return '34.5 °C';
    return Math.round(val) + ' °C';
}

// Format current value - clamp unreasonable FOCAS raw values
function formatCurrent(node) {
    if (!node) return '0.0 A';
    const val = parseFloat(node.textContent.trim());
    if (isNaN(val) || val > 9999 || val < 0) return '-- A';
    return val.toFixed(1) + ' A';
}

// Update single load progress bar UI
function updateLoadBar(barElement, textElement, value) {
    const pct = Math.max(0, Math.min(100, Math.round(value)));
    barElement.style.width = pct + '%';
    textElement.textContent = pct + '%';
    
    if (pct <= 40) {
        barElement.style.backgroundColor = '#10b981'; // Green
    } else if (pct <= 80) {
        barElement.style.backgroundColor = '#f59e0b'; // Orange
    } else {
        barElement.style.backgroundColor = '#ef4444'; // Red
    }
}

// Handle Part Completed
function handlePartCompleted(machineId, programName) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('tr-TR');
    const duration = machineState[machineId].currentPartCycleSeconds || 0;

    const newPart = {
        id: machineState[machineId].partHistory.length + 1,
        program: (programName && programName !== 'UNAVAILABLE') ? programName : 'O1000',
        time: timeStr,
        duration: duration > 0 ? duration : 0
    };

    machineState[machineId].partHistory.unshift(newPart);
    if (machineState[machineId].partHistory.length > 30) machineState[machineId].partHistory.pop();
    localStorage.setItem(`history_${machineId}`, JSON.stringify(machineState[machineId].partHistory));
    
    if (machineId === currentMachine) {
        renderHistory();
    }
}

// Render History Table for selected machine
function renderHistory() {
    if (!elHistoryTable) return;
    const history = machineState[currentMachine].partHistory;

    if (history.length === 0) {
        elHistoryTable.innerHTML = `
            <tr>
                <td colspan="4" class="empty-table-msg">Henüz tamamlanan parça kaydı yok. Makine aktif çevrim tamamladığında buraya eklenecektir.</td>
            </tr>`;
        return;
    }

    let html = '';
    history.forEach((part, index) => {
        const displayId = history.length - index;
        const formattedDuration = formatTime(part.duration) + ' (' + (part.duration / 60).toFixed(1) + ' dk)';
        html += `
            <tr>
                <td class="history-part-num">Parça #${displayId}</td>
                <td class="program-code">${part.program}</td>
                <td>${part.time}</td>
                <td class="history-duration">${formattedDuration}</td>
            </tr>`;
    });

    elHistoryTable.innerHTML = html;
    updateCycleTimeChart(history);
}

// Function to update the SVG Bar Chart
function updateCycleTimeChart(history) {
    const svg = document.getElementById('cycle-time-svg');
    if (!svg) return;

    // Clear SVG
    svg.innerHTML = '';

    const last5 = history.slice(0, 5).reverse();
    if (last5.length === 0) {
        svg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-size="12">Yeterli veri yok</text>';
        return;
    }

    const svgWidth = svg.clientWidth || svg.getBoundingClientRect().width || 1000;
    const svgHeight = 120;
    const padding = 20;
    const barWidth = Math.max(20, (svgWidth - padding * 2) / 10);
    const spacing = (svgWidth - padding * 2) / last5.length;

    // Find max duration
    let maxDur = 0;
    last5.forEach(p => { if (p.duration > maxDur) maxDur = p.duration; });
    if (maxDur === 0) maxDur = 1; // avoid divide by zero

    last5.forEach((part, idx) => {
        const barH = (part.duration / maxDur) * (svgHeight - 40); // 40px for labels
        const x = padding + spacing * idx + (spacing - barWidth) / 2;
        const y = svgHeight - 20 - barH;

        // Draw Bar Group
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

        // Tooltip
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `Parça #${history.length - (4 - idx)}: ${part.duration} sn`;
        g.appendChild(title);

        // Rect
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", barWidth);
        rect.setAttribute("height", barH);
        rect.setAttribute("fill", "url(#barGradient)");
        rect.setAttribute("rx", 4);
        rect.setAttribute("ry", 4);
        rect.style.transition = "all 0.5s ease";
        rect.style.filter = "drop-shadow(0 0 4px rgba(6, 182, 212, 0.5))";
        g.appendChild(rect);

        // Top Label (Duration)
        const durText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        durText.setAttribute("x", x + barWidth / 2);
        durText.setAttribute("y", y - 5);
        durText.setAttribute("fill", "#fff");
        durText.setAttribute("text-anchor", "middle");
        durText.textContent = part.duration + "s";
        g.appendChild(durText);

        // Bottom Label (Part #)
        const idText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        idText.setAttribute("x", x + barWidth / 2);
        idText.setAttribute("y", svgHeight - 5);
        idText.setAttribute("fill", "#9ca3af");
        idText.setAttribute("text-anchor", "middle");
        idText.textContent = "#" + (history.length - (4 - idx));
        g.appendChild(idText);

        svg.appendChild(g);
    });

    // Defs for gradient
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#06b6d4" />
            <stop offset="100%" stop-color="rgba(6, 182, 212, 0.1)" />
        </linearGradient>
    `;
    svg.appendChild(defs);
}

// Actual Feedrate API Polling
async function pollActFeedrate() {
    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/actfeedrate?machine=${currentMachine}`);
        if (!response.ok) return;
        const data = await response.json();
        
        // Expected data: { actual: 120, programmed: 150 } or { value: 120, target: 150 } etc
        const act = data.actual || data.value || 0;
        const target = data.programmed || data.target || 1000;
        
        let pct = (target > 0) ? (act / target) * 100 : 0;
        if (pct > 100) pct = 100;
        
        const bar = document.getElementById('act-feedrate-bar');
        const valText = document.getElementById('act-feedrate-val');
        
        if (bar && valText) {
            bar.style.width = pct + '%';
            valText.textContent = `${act} mm/dk (${pct.toFixed(0)}%)`;
            
            if (pct < 50) bar.style.background = 'linear-gradient(90deg, #f59e0b, #fff)';
            else bar.style.background = 'linear-gradient(90deg, var(--neon-cyan), #fff)';
        }
    } catch (e) {
        // Silently fail or fallback
    }
}

// Hardware Profile API Fetch
async function loadHardwareProfile() {
    const hwBadge = document.getElementById('hw-profile-badge');
    const hwText = document.getElementById('hw-profile-text');
    if (!hwBadge || !hwText) return;

    try {
        hwBadge.style.display = 'inline-block';
        hwText.textContent = "Yükleniyor...";
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/sysinfo?machine=${currentMachine}`);
        
        if (response.ok) {
            const data = await response.json();
            // Expected data: { model: "FANUC Series 0i-TF Plus", axes: 3, memory: "2MB" }
            if (data.model) {
                hwText.textContent = data.model;
            } else if (data.info) {
                hwText.textContent = data.info;
            } else {
                hwText.textContent = "SysInfo: BİLİNMEYEN DONANIM";
            }
        } else {
            hwText.textContent = "SysInfo: BİLİNMEYEN DONANIM";
            hwBadge.style.display = 'none';
        }
    } catch (e) {
        hwText.textContent = "SysInfo: BAĞLANTI HATASI";
        hwBadge.style.display = 'none';
    }}

// Render Alarm History Table
function renderAlarms() {
    if (showingCncAlarms) return;
    const history = machineState[currentMachine].alarmHistory || [];

    if (history.length === 0) {
        elAlarmsTable.innerHTML = `
            <tr>
                <td colspan="4" class="empty-table-msg">Henüz kaydedilen alarm geçmişi yok. Tezgahta alarm tetiklendiğinde buraya eklenecektir.</td>
            </tr>`;
        return;
    }

    let html = '';
    history.forEach(alarm => {
        html += `
            <tr>
                <td style="color: var(--neon-red); font-weight: 600;">ALARM #${alarm.no}</td>
                <td><span class="badge stopped" style="padding: 3px 8px; font-size: 0.65rem;">${alarm.type}</span></td>
                <td>${alarm.time}</td>
                <td style="color: var(--text-primary); font-weight: 500;">${alarm.msg}</td>
            </tr>`;
    });

    elAlarmsTable.innerHTML = html;
}

// Clear History for selected machine
function clearHistory() {
    if (confirm(`${machinesConfig.find(m => m.id === currentMachine).name} için tüm parça geçmişini silmek istediğinize emin misiniz?`)) {
        machineState[currentMachine].partHistory = [];
        localStorage.removeItem(`history_${currentMachine}`);
        renderHistory();
    }
}

// Clear Alarms History for selected machine
function clearAlarms() {
    if (confirm(`${machinesConfig.find(m => m.id === currentMachine).name} için tüm alarm günlük geçmişini silmek istediğinize emin misiniz?`)) {
        machineState[currentMachine].alarmHistory = [];
        localStorage.removeItem(`alarms_${currentMachine}`);
        renderAlarms();
    }
}

// Collapsible Offsets List Drawer
window.toggleOffsetsList = function() {
    const container = document.getElementById('offsets-list-container');
    if (container) {
        if (container.style.display === 'none') {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }
};

// Async NC Program directory listing fetcher
async function loadProgramsList() {
    if (!elProgramsTbody) return;
    
    elProgramsTbody.innerHTML = `<tr><td colspan="4" class="empty-table-msg"><i class="fa-solid fa-spinner fa-spin"></i> Programlar tezgâh hafızasından okunuyor, lütfen bekleyin...</td></tr>`;
    
    if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
        setTimeout(() => {
            let html = '';
            const mockProgs = [
                { number: 1001, length: 12054, comment: "KABA_TORNA_OP1" },
                { number: 1002, length: 8432, comment: "FINIS_TORNA_OP2" },
                { number: 2005, length: 24150, comment: "DELIK_DELME_MILLING" },
                { number: 9000, length: 1840, comment: "TAKIM_DEGISTIRME_MACRO" }
            ];
            mockProgs.forEach(p => {
                html += `<tr>
                    <td style="color: var(--neon-cyan); font-weight: bold; font-family: monospace; cursor: pointer; text-decoration: underline;" onclick="viewProgramCode(${p.number})">O${p.number}</td>
                    <td>${p.length}</td>
                    <td style="color: #9ca3af;">${p.comment}</td>
                    <td style="text-align: center;">
                        <button class="clear-btn" onclick="activateProgram(${p.number})" style="padding: 2px 8px; font-size: 0.8em; color: #10b981; border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.1); margin-right: 5px;">Aktif Yap</button>
                        <button class="clear-btn" onclick="deleteProgram(${p.number})" style="padding: 2px 8px; font-size: 0.8em; color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1);">Sil</button>
                    </td>
                </tr>`;
            });
            elProgramsTbody.innerHTML = html;
        }, 600);
        return;
    }

    try {
        const config = machinesConfig.find(m => m.id === currentMachine);
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/programs?machine=${currentMachine}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        if (data.error) {
            elProgramsTbody.innerHTML = `<tr><td colspan="4" class="empty-table-msg" style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Hata: ${data.error}</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            elProgramsTbody.innerHTML = `<tr><td colspan="4" class="empty-table-msg">Tezgâh hafızasında program bulunamadı.</td></tr>`;
            return;
        }

        let html = '';
        data.forEach(p => {
            html += `<tr>
                <td style="color: var(--neon-cyan); font-weight: bold; font-family: monospace; cursor: pointer; text-decoration: underline;" onclick="viewProgramCode(${p.number})">O${p.number}</td>
                <td>${p.length}</td>
                <td style="color: #9ca3af;">${p.comment}</td>
                <td style="text-align: center;">
                    <button class="clear-btn" onclick="activateProgram(${p.number})" style="padding: 2px 8px; font-size: 0.8em; color: #10b981; border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.1); margin-right: 5px;">Aktif Yap</button>
                    <button class="clear-btn" onclick="deleteProgram(${p.number})" style="padding: 2px 8px; font-size: 0.8em; color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1);">Sil</button>
                </td>
            </tr>`;
        });
        elProgramsTbody.innerHTML = html;
    } catch (err) {
        console.error('Error fetching programs:', err);
        elProgramsTbody.innerHTML = `<tr><td colspan="4" class="empty-table-msg" style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Bağlantı Hatası: API sunucusuna erişilemedi (${err.message})</td></tr>`;
    }
}

window.activateProgram = async function(progNo) {
    if (!confirm(`O${progNo} programını aktif/yürütülen yapmak istediğinizden emin misiniz?`)) return;
    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/activateprogram?machine=${currentMachine}&number=${progNo}`);
        const result = await response.json();
        if (result.success) {
            alert(`O${progNo} programı başarıyla aktif edildi.`);
            loadProgramsList();
            loadProgramExplorer();
            loadOperationHistory();
        } else {
            alert(`Hata: ${result.error}`);
        }
    } catch (err) {
        alert(`Program aktif edilemedi: ${err.message}`);
    }
};

window.deleteProgram = async function(progNo) {
    if (!confirm(`O${progNo} programını tezgâh hafızasından KALICI OLARAK silmek istediğinizden emin misiniz?`)) return;
    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/deleteprogram?machine=${currentMachine}&number=${progNo}`);
        const result = await response.json();
        if (result.success) {
            alert(`O${progNo} programı başarıyla silindi.`);
            loadProgramsList();
            loadProgramExplorer();
            loadOperationHistory();
        } else {
            alert(`Hata: ${result.error}`);
        }
    } catch (err) {
        alert(`Program silinemedi: ${err.message}`);
    }
};

// G-code Program Code Viewer Modal Trigger
window.viewProgramCode = async function(progNo) {
    const modal = document.getElementById('code-viewer-modal');
    const modalNo = document.getElementById('modal-program-no');
    const modalCode = document.getElementById('modal-program-code');
    
    if (!modal || !modalNo || !modalCode) return;
    
    modalNo.textContent = progNo;
    modalCode.textContent = "Program indiriliyor, lütfen bekleyin...";
    modal.style.display = 'block';

    if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
        setTimeout(() => {
            modalCode.textContent = `O${progNo}\n(MOCK PROGRAM CODE FOR ${currentMachine.toUpperCase()})\nG90 G21 G17 G94\nT1 M6\nG00 X50. Y50. Z10.\nS1200 M3\nM08\nG01 Z-5. F150.\nG02 X50. Y50. I-50. J0. F200.\nG00 Z50. M9\nM30`;
        }, 400);
        return;
    }

    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/programcode?machine=${currentMachine}&number=${progNo}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) {
            modalCode.textContent = `Hata: ${data.error}`;
        } else {
            modalCode.textContent = data.code || "Program içeriği boş.";
        }
    } catch (err) {
        modalCode.textContent = `Bağlantı Hatası: API sunucusuna erişilemedi (${err.message})`;
    }
};

// Close code modal event
const closeCodeModalBtn = document.getElementById('close-code-modal');
if (closeCodeModalBtn) {
    closeCodeModalBtn.addEventListener('click', () => {
        const modal = document.getElementById('code-viewer-modal');
        if (modal) modal.style.display = 'none';
    });
}
window.addEventListener('click', (event) => {
    const modal = document.getElementById('code-viewer-modal');
    if (modal && event.target === modal) {
        modal.style.display = 'none';
    }
});

// Async CNC Memory Alarm History
async function loadCncAlarms() {
    const tbody = document.getElementById('alarms-log-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" class="empty-table-msg"><i class="fa-solid fa-spinner fa-spin"></i> CNC hafızasındaki alarmlar okunuyor...</td></tr>`;

    if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
        setTimeout(() => {
            tbody.innerHTML = `
                <tr>
                    <td style="color: #ef4444; font-weight: bold; font-family: monospace;">A1024</td>
                    <td>CNC Memory</td>
                    <td>2026-07-17 12:30:15</td>
                    <td style="color: #ef4444;">Fikir Kontrol Hatası (Simüle)</td>
                </tr>
            `;
        }, 500);
        return;
    }

    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/alarmhistory?machine=${currentMachine}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (data.error) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-table-msg" style="color: #ef4444;">Hata: ${data.error}</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-table-msg">CNC hafızasında kayıtlı geçmiş alarm bulunamadı.</td></tr>`;
            return;
        }

        let html = '';
        data.forEach(a => {
            html += `
                <tr>
                    <td style="color: #ef4444; font-weight: bold; font-family: monospace;">${a.no}</td>
                    <td>CNC Memory</td>
                    <td>${a.date}</td>
                    <td style="color: #ef4444;">${a.message}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-table-msg" style="color: #ef4444;">Bağlantı Hatası: ${err.message}</td></tr>`;
    }
}

// Async Dynamic Axis and Drives diagnostics
async function loadAxisAndDiagnostics(isManual = false) {
    if (!elAxisTelemetryTbody) return;
    if (isPollingDiagnostics) return;
    isPollingDiagnostics = true;
    
    if (isManual || elAxisTelemetryTbody.innerHTML.includes('empty-table-msg') || elAxisTelemetryTbody.innerHTML.includes('Güncelle butonuna')) {
        elAxisTelemetryTbody.innerHTML = `<tr><td colspan="8" class="empty-table-msg"><i class="fa-solid fa-spinner fa-spin"></i> Teşhis verileri okunuyor, lütfen bekleyin...</td></tr>`;
    }

    if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
        setTimeout(() => {
            const mockAxes = [
                { name: 'X', absolute: 120.452, machine: 120.452, relative: 10.452, temperature: 42, current: 4.2, errorLag: 2, load: 12 },
                { name: 'Y', absolute: -85.123, machine: -85.123, relative: -15.123, temperature: 39, current: 3.1, errorLag: 1, load: 8 },
                { name: 'Z', absolute: 345.981, machine: 345.981, relative: 45.981, temperature: 48, current: 6.8, errorLag: 4, load: 22 },
                { name: 'C', absolute: 0.000, machine: 0.000, relative: 0.000, temperature: 35, current: 0.5, errorLag: 0, load: 2 }
            ];
            let html = '';
            mockAxes.forEach(a => {
                html += `<tr>
                    <td style="color: var(--neon-cyan); font-weight: bold; font-family: monospace;">${a.name}</td>
                    <td style="font-family: monospace;">${a.absolute.toFixed(3)}</td>
                    <td style="font-family: monospace;">${a.machine.toFixed(3)}</td>
                    <td style="font-family: monospace;">${a.relative.toFixed(3)}</td>
                    <td>${a.temperature} °C</td>
                    <td>${a.current.toFixed(1)} A</td>
                    <td>${a.errorLag}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="progress-bar-bg" style="width: 50px; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                                <div class="progress-bar-fill" style="width: ${a.load}%; height: 100%; background: var(--neon-cyan);"></div>
                            </div>
                            <span>${a.load}%</span>
                        </div>
                    </td>
                </tr>`;
            });
            elAxisTelemetryTbody.innerHTML = html;

            if (diagSpindleActual) diagSpindleActual.textContent = "1200 RPM";
            if (diagSpindleTarget) diagSpindleTarget.textContent = "1200 RPM";
            if (diagSpindleTemp) diagSpindleTemp.textContent = "38 °C";

            // Render Okuma/Mazak mock motor & power telemetry
            const mockTorque = (Math.random() * 20 + 15).toFixed(1);
            const mockPower = (Math.random() * 3 + 2).toFixed(2);
            if (diagSpindleTorque) diagSpindleTorque.textContent = `${mockTorque} %`;
            if (diagPowerConsumption) diagPowerConsumption.textContent = `${mockPower} kW`;
            if (diagDistanceToGo) {
                diagDistanceToGo.textContent = `X: ${(Math.random() * 0.05).toFixed(3)} | Y: ${(Math.random() * 0.02).toFixed(3)} | Z: ${(Math.random() * 0.05).toFixed(3)}`;
            }

            // Mock PMC Diagnostics
            const elHours = document.getElementById('pmc-operating-hours');
            const elLube = document.getElementById('pmc-lube-pressure');
            const elPallet = document.getElementById('pmc-pallet-state');
            const elPlcAlarms = document.getElementById('plc-alarms-tbody');

            if (elHours) elHours.textContent = `${1580 + Math.floor(Math.random() * 10)} sa`;
            if (elLube) elLube.textContent = `${(4.0 + Math.random() * 0.8).toFixed(1)} bar`;
            if (elPallet) elPallet.textContent = 'READY';

            if (elPmcCoolantLbl && elPmcCoolantBar) {
                const cLevel = 78.2;
                elPmcCoolantLbl.textContent = `${cLevel}%`;
                elPmcCoolantBar.style.width = `${cLevel}%`;
                elPmcCoolantBar.style.background = 'var(--neon-cyan)';
            }
            if (elPmcLubeOilLbl && elPmcLubeOilBar) {
                const lLevel = 91.5;
                elPmcLubeOilLbl.textContent = `${lLevel}%`;
                elPmcLubeOilBar.style.width = `${lLevel}%`;
                elPmcLubeOilBar.style.background = 'var(--neon-orange)';
            }
            if (elPmcAirLbl && elPmcAirBar) {
                const aPress = 6.25;
                elPmcAirLbl.textContent = `${aPress} Bar`;
                elPmcAirBar.style.width = `${(aPress / 8.0) * 100}%`;
                elPmcAirBar.style.background = '#10b981';
            }

            if (elPlcAlarms) {
                if (Math.random() > 0.5) {
                    elPlcAlarms.innerHTML = `
                        <tr>
                            <td style="color: var(--neon-red); font-weight: bold;">1002</td>
                            <td>${new Date().toLocaleTimeString('tr-TR')}</td>
                            <td>PLC: LUBRICATION LEVEL LOW WARNING (MOCK)</td>
                        </tr>
                    `;
                } else {
                    elPlcAlarms.innerHTML = `
                        <tr>
                            <td colspan="3" class="empty-table-msg" style="padding: 10px;">PLC alarmı bulunmamaktadır.</td>
                        </tr>
                    `;
                }
            }
            loadDigitalTwin();
            checkDiagnosticThresholds();
            isPollingDiagnostics = false;
        }, 500);
        return;
    }

    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        
        // Fetch Axis telemetry
        const resAxis = await fetch(`http://${apiHost}:8090/axisinfo?machine=${currentMachine}&path=${currentPath}`);
        if (!resAxis.ok) throw new Error(`Axis API error: ${resAxis.status}`);
        const axes = await resAxis.json();

        // Fetch Spindle diagnostics
        const resDiag = await fetch(`http://${apiHost}:8090/diagnostics?machine=${currentMachine}&path=${currentPath}`);
        if (!resDiag.ok) throw new Error(`Diag API error: ${resDiag.status}`);
        const diag = await resDiag.json();

        // Fetch Motor & Power Telemetry
        let motorPower = null;
        try {
            const resMotorPower = await fetch(`http://${apiHost}:8090/motorpower?machine=${currentMachine}`);
            if (resMotorPower.ok) {
                motorPower = await resMotorPower.json();
            }
        } catch (e) {
            console.error("MotorPower API error:", e);
        }

        if (axes.error) {
            elAxisTelemetryTbody.innerHTML = `<tr><td colspan="9" class="empty-table-msg" style="color: #ef4444;">Eksen Hatası: ${axes.error}</td></tr>`;
        } else {
            let html = '';
            axes.forEach(a => {
                const fanStatusHtml = `
                    <span style="color: ${a.fanOk ? '#10b981' : '#ef4444'}; font-weight: bold; font-size: 0.9em; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-fan ${a.fanOk ? 'fan-spin' : ''}"></i> ${a.fanOk ? 'NORMAL' : 'DURDU'}
                    </span>
                `;
                html += `<tr>
                    <td style="color: var(--neon-cyan); font-weight: bold; font-family: monospace;">${a.name}</td>
                    <td style="font-family: monospace;">${a.absolute.toFixed(3)}</td>
                    <td style="font-family: monospace;">${a.machine.toFixed(3)}</td>
                    <td style="font-family: monospace;">${(a.relative || 0).toFixed(3)}</td>
                    <td>${a.temperature} °C</td>
                    <td>${a.current.toFixed(1)} A</td>
                    <td>${a.errorLag}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="progress-bar-bg" style="width: 50px; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                                <div class="progress-bar-fill" style="width: ${Math.min(a.load, 100)}%; height: 100%; background: ${a.load > 80 ? '#ef4444' : 'var(--neon-cyan)'};"></div>
                            </div>
                            <span>${a.load}%</span>
                        </div>
                    </td>
                    <td>${fanStatusHtml}</td>
                </tr>`;
            });
            elAxisTelemetryTbody.innerHTML = html;

            // Sync values to the main dashboard card "Motor & Encoder Sıcaklıkları"
            const axX = axes.find(a => a.name === 'X' || a.name === 'X1' || a.name === 'X2');
            const axY = axes.find(a => a.name === 'Y' || a.name === 'Y1' || a.name === 'Y2');
            const axZ = axes.find(a => a.name === 'Z' || a.name === 'Z1' || a.name === 'Z2');

            if (axX) {
                if (elTempX) elTempX.textContent = `${axX.temperature} °C`;
                if (elEncTempX) elEncTempX.textContent = `${axX.encoderTemp} °C`;
                currentsHistory.X.push(axX.current);
            } else {
                currentsHistory.X.push(0);
            }
            if (currentsHistory.X.length > 30) currentsHistory.X.shift();

            if (axY) {
                if (elTempY) elTempY.textContent = `${axY.temperature} °C`;
                if (elEncTempY) elEncTempY.textContent = `${axY.encoderTemp} °C`;
                currentsHistory.Y.push(axY.current);
            } else {
                currentsHistory.Y.push(0);
            }
            if (currentsHistory.Y.length > 30) currentsHistory.Y.shift();

            if (axZ) {
                if (elTempZ) elTempZ.textContent = `${axZ.temperature} °C`;
                if (elEncTempZ) elEncTempZ.textContent = `${axZ.encoderTemp} °C`;
                currentsHistory.Z.push(axZ.current);
            } else {
                currentsHistory.Z.push(0);
            }
            if (currentsHistory.Z.length > 30) currentsHistory.Z.shift();

            // Draw Oscillo-Chart
            drawCurrentOscilloChart();
        }

        if (diag.error) {
            if (diagSpindleActual) diagSpindleActual.textContent = "HATA";
            if (elServoFan) elServoFan.innerHTML = '<i class="fa-solid fa-fan" style="color: #ef4444;"></i> HATA';
            if (elCabinetFan) elCabinetFan.innerHTML = '<i class="fa-solid fa-fan" style="color: #ef4444;"></i> HATA';
        } else {
            if (diagSpindleActual) diagSpindleActual.textContent = `${Math.round(diag.spindleActualSpeed)} RPM`;
            if (diagSpindleTarget) diagSpindleTarget.textContent = `${Math.round(diag.spindleTargetSpeed)} RPM`;
            if (diagSpindleTemp) diagSpindleTemp.textContent = `${diag.spindleTemperature} °C`;
            
            if (elTempSpindle) elTempSpindle.textContent = `${diag.spindleTemperature} °C`;
            if (elEncTempSpindle) elEncTempSpindle.textContent = `${diag.spindleEncoderTemperature} °C`;
            
            if (elServoFan) {
                if (diag.servoFanOk) {
                    elServoFan.innerHTML = '<i class="fa-solid fa-fan fan-spin"></i> NORMAL';
                    elServoFan.style.color = '#10b981';
                } else {
                    elServoFan.innerHTML = '<i class="fa-solid fa-fan" style="color: #ef4444;"></i> ARIZA (DURDU)';
                    elServoFan.style.color = '#ef4444';
                }
            }
            if (elCabinetFan) {
                if (diag.cncFanOk) {
                    elCabinetFan.innerHTML = '<i class="fa-solid fa-fan fan-spin"></i> NORMAL';
                    elCabinetFan.style.color = '#10b981';
                } else {
                    elCabinetFan.innerHTML = '<i class="fa-solid fa-fan" style="color: #ef4444;"></i> ARIZA (DURDU)';
                    elCabinetFan.style.color = '#ef4444';
                }
            }
        }

        // Render Motor Power Telemetry
        if (motorPower && !motorPower.error) {
            if (diagSpindleTorque) diagSpindleTorque.textContent = `${motorPower.spindleTorque.toFixed(1)} %`;
            if (diagPowerConsumption) diagPowerConsumption.textContent = `${motorPower.powerConsumption.toFixed(2)} kW`;
            if (diagDistanceToGo && motorPower.distanceToGo) {
                const dists = [];
                Object.keys(motorPower.distanceToGo).forEach(axis => {
                    dists.push(`${axis}: ${motorPower.distanceToGo[axis].toFixed(3)}`);
                });
                diagDistanceToGo.textContent = dists.join(' | ') || 'X: 0.000 | Y: 0.000 | Z: 0.000';
            }
        } else {
            if (diagSpindleTorque) diagSpindleTorque.textContent = 'UNAVAILABLE';
            if (diagPowerConsumption) diagPowerConsumption.textContent = 'UNAVAILABLE';
            if (diagDistanceToGo) diagDistanceToGo.textContent = 'X: 0.000 | Y: 0.000 | Z: 0.000';
        }

        // Fetch PMC Diagnostics & PLC alarms
        try {
            const resPmc = await fetch(`http://${apiHost}:8090/pmcdiag?machine=${currentMachine}&path=${currentPath}`);
            if (resPmc.ok) {
                const pmc = await resPmc.json();
                const elHours = document.getElementById('pmc-operating-hours');
                const elLube = document.getElementById('pmc-lube-pressure');
                const elPallet = document.getElementById('pmc-pallet-state');
                const elPlcAlarms = document.getElementById('plc-alarms-tbody');

                if (elHours) elHours.textContent = `${pmc.operatingHours} sa`;
                if (elLube) elLube.textContent = `${pmc.lubePressureBar.toFixed(1)} bar`;
                if (elPallet) elPallet.textContent = pmc.palletState;

                // Update Coolant, Lube Oil, Air Pressure indicators
                if (elPmcCoolantLbl && elPmcCoolantBar) {
                    const cLevel = pmc.coolantLevel || 0.0;
                    elPmcCoolantLbl.textContent = `${cLevel.toFixed(1)}%`;
                    elPmcCoolantBar.style.width = `${cLevel}%`;
                    elPmcCoolantBar.style.background = cLevel < 20 ? 'var(--neon-red)' : 'var(--neon-cyan)';
                }
                if (elPmcLubeOilLbl && elPmcLubeOilBar) {
                    const lLevel = pmc.lubeOilLevel || 0.0;
                    elPmcLubeOilLbl.textContent = `${lLevel.toFixed(1)}%`;
                    elPmcLubeOilBar.style.width = `${lLevel}%`;
                    elPmcLubeOilBar.style.background = lLevel < 15 ? 'var(--neon-red)' : 'var(--neon-orange)';
                }
                if (elPmcAirLbl && elPmcAirBar) {
                    const aPress = pmc.airPressure || 0.00;
                    elPmcAirLbl.textContent = `${aPress.toFixed(2)} Bar`;
                    const percentage = Math.min(100, Math.max(0, (aPress / 8.0) * 100));
                    elPmcAirBar.style.width = `${percentage}%`;
                    elPmcAirBar.style.background = aPress < 5.0 ? 'var(--neon-red)' : '#10b981';
                }

                if (elPlcAlarms) {
                    if (pmc.plcAlarms && pmc.plcAlarms.length > 0) {
                        let alarmHtml = '';
                        pmc.plcAlarms.forEach(a => {
                            alarmHtml += `
                                <tr>
                                    <td style="color: var(--neon-red); font-weight: bold;">${a.code}</td>
                                    <td>${a.date}</td>
                                    <td style="color: var(--text-primary); font-weight: 500;">${a.message}</td>
                                </tr>
                            `;
                        });
                        elPlcAlarms.innerHTML = alarmHtml;
                    } else {
                        elPlcAlarms.innerHTML = `
                            <tr>
                                <td colspan="3" class="empty-table-msg" style="padding: 10px;">PLC alarmı bulunmamaktadır.</td>
                            </tr>
                        `;
                    }
                }
            }
        } catch (e) {
            console.error("PMC Diag API error:", e);
        }

        // Fetch CNC Alarm History (FOCAS)
        try {
            const elCncAlarmHistory = document.getElementById('cnc-alarmhistory-tbody');
            if (elCncAlarmHistory) {
                if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
                    elCncAlarmHistory.innerHTML = `
                        <tr>
                            <td style="color: #ef4444; font-weight: bold; font-family: monospace;">A1024</td>
                            <td>CNC</td>
                            <td>${new Date().toLocaleTimeString('tr-TR')}</td>
                            <td style="color: #ef4444;">Fikir Kontrol Hatası (Simüle)</td>
                        </tr>
                    `;
                } else {
                    const resCncAlarms = await fetch(`http://${apiHost}:8090/alarmhistory?machine=${currentMachine}&path=${currentPath}`);
                    if (resCncAlarms.ok) {
                        const alarms = await resCncAlarms.json();
                        if (alarms && alarms.length > 0) {
                            let alarmHtml = '';
                            alarms.forEach(a => {
                                alarmHtml += `
                                    <tr>
                                        <td style="color: #ef4444; font-weight: bold; font-family: monospace;">${a.no}</td>
                                        <td>CNC</td>
                                        <td>${a.date}</td>
                                        <td style="color: #ef4444; font-weight: 500;">${a.message}</td>
                                    </tr>
                                `;
                            });
                            elCncAlarmHistory.innerHTML = alarmHtml;
                        } else {
                            elCncAlarmHistory.innerHTML = `
                                <tr>
                                    <td colspan="4" class="empty-table-msg" style="padding: 10px;">CNC alarmı bulunmamaktadır.</td>
                                </tr>
                            `;
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Live CNC Alarm History API error:", e);
        }

        // Load Tool Group Management
        const grpVal = elToolGroupInput ? parseInt(elToolGroupInput.value) : 1;
        await loadToolGroupManagement(isNaN(grpVal) ? 1 : grpVal);

        // Load CNC Parameters and PMC Keep Relays
        await loadCncParamsAndKeepRelays();

        // Load Panel Switches, Timers, Probing Trend, and Operation History
        await loadPanelSwitchesAndTimers();
        await loadProbingData();
        await loadOperationHistory();
        await loadDigitalTwin();
        if (diag && typeof diag.cumulativeKwh !== 'undefined') {
            if (elDiagCumulativeKwh) elDiagCumulativeKwh.textContent = `${diag.cumulativeKwh.toFixed(4)} kWh`;
        }

        // Query active PMC sniffer address
        querySniffedAddress();

        checkDiagnosticThresholds();

    } catch (err) {
        console.error("Diagnostics load error:", err);
        elAxisTelemetryTbody.innerHTML = `<tr><td colspan="8" class="empty-table-msg" style="color: #ef4444;">Teşhis Sunucusu Hatası: ${err.message}</td></tr>`;
    } finally {
        isPollingDiagnostics = false;
    }
}

// Macro Query Form listener
if (queryMacroBtn && macroInput) {
    queryMacroBtn.addEventListener('click', async () => {
        const macroNo = macroInput.value;
        if (!macroNo) return;

        macroResultBox.style.display = 'block';
        macroResultVal.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sorgulanıyor...`;
        macroResultBox.style.background = 'rgba(255, 255, 255, 0.05)';
        macroResultBox.style.borderColor = 'rgba(255, 255, 255, 0.1)';

        if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
            setTimeout(() => {
                macroResultVal.textContent = (Math.random() * 100).toFixed(4);
                macroResultBox.style.background = 'rgba(16, 185, 129, 0.1)';
                macroResultBox.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            }, 400);
            return;
        }

        try {
            const apiHost = window.location.hostname || "127.0.0.1";
            const response = await fetch(`http://${apiHost}:8090/macro?machine=${currentMachine}&number=${macroNo}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.error) {
                macroResultVal.innerHTML = `<span style="color: #ef4444;">Hata: ${data.error}</span>`;
                macroResultBox.style.background = 'rgba(239, 68, 68, 0.1)';
                macroResultBox.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            } else {
                macroResultVal.textContent = data.value.toFixed(4);
                macroResultBox.style.background = 'rgba(16, 185, 129, 0.1)';
                macroResultBox.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            }
        } catch (err) {
            macroResultVal.innerHTML = `<span style="color: #ef4444;">Erişim Hatası</span>`;
            macroResultBox.style.background = 'rgba(239, 68, 68, 0.1)';
            macroResultBox.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        }
    });
}

// Async Tool Group & Sister Tools Fetcher
async function loadToolGroupManagement(groupNum) {
    if (!elToolGroupSisterList) return;

    elToolGroupSisterList.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Takım grubu verileri yükleniyor...`;

    if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
        setTimeout(() => {
            const mockGrp = (groupNum <= 0) ? 1 : groupNum;
            const mockTools = [
                { tool_num: mockGrp * 10 + 1, tuse_num: 1, h_code: mockGrp * 10 + 1, d_code: mockGrp * 10 + 1, tinfo: 1 },
                { tool_num: mockGrp * 10 + 2, tuse_num: 2, h_code: mockGrp * 10 + 2, d_code: mockGrp * 10 + 2, tinfo: 0 },
                { tool_num: mockGrp * 10 + 3, tuse_num: 3, h_code: mockGrp * 10 + 3, d_code: mockGrp * 10 + 3, tinfo: 0 }
            ];
            
            if (elToolGroupActiveId) elToolGroupActiveId.textContent = `${mockGrp} (Aktif)`;
            if (elToolGroupLifeInfo) elToolGroupLifeInfo.textContent = `180 / 65 dk (Mock)`;

            let listHtml = mockTools.map(t => {
                const activeStar = t.tinfo === 1 ? ' <span style="color: var(--neon-cyan);">[Aktif]</span>' : '';
                return `T${t.tool_num} (Kullanım Sırası: ${t.tuse_num}, H-Kodu: ${t.h_code})${activeStar}`;
            }).join('<br>');
            
            elToolGroupSisterList.innerHTML = listHtml;
        }, 400);
        return;
    }

    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/toolmgmt?machine=${currentMachine}&group=${groupNum}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (data.error) {
            elToolGroupSisterList.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Hata: ${data.error}</span>`;
            if (elToolGroupActiveId) elToolGroupActiveId.textContent = '-';
            if (elToolGroupLifeInfo) elToolGroupLifeInfo.textContent = '-';
            return;
        }

        if (elToolGroupActiveId) {
            elToolGroupActiveId.textContent = data.groupNum + (data.groupNum === data.activeGroup ? " (Aktif)" : "");
        }
        if (elToolGroupLifeInfo) {
            elToolGroupLifeInfo.textContent = `${data.life} / ${data.count} (Ömür/Sayaç)`;
        }

        if (!data.tools || data.tools.length === 0) {
            elToolGroupSisterList.textContent = "Bu grupta kayıtlı sister tool bulunamadı.";
        } else {
            let listHtml = data.tools.map(t => {
                const activeStar = (t.tinfo & 1) !== 0 ? ' <span style="color: var(--neon-cyan);">[Aktif]</span>' : '';
                return `T${t.tool_num} (Kullanım Sırası: ${t.tuse_num}, H-Kodu: ${t.h_code}, D-Kodu: ${t.d_code})${activeStar}`;
            }).join('<br>');
            
            if (data.macroSisterTools && data.macroSisterTools.length > 0) {
                listHtml += `<div style="margin-top: 6px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 4px; color: var(--neon-orange);">Makro Sister: T${data.macroSisterTools.join(', T')}</div>`;
            }

            elToolGroupSisterList.innerHTML = listHtml;
        }
    } catch (err) {
        console.error("Tool group load error:", err);
        elToolGroupSisterList.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Bağlantı Hatası: ${err.message}</span>`;
    }
}

async function loadProgramExplorer() {
    if (!elSubprogChainContainer || !elStorageTreeContainer) return;

    elSubprogChainContainer.innerHTML = `<span style="font-size: 0.9em; color: #9ca3af;"><i class="fa-solid fa-spinner fa-spin"></i> Çağrı zinciri okunuyor...</span>`;
    elStorageTreeContainer.innerHTML = `<span style="font-size: 0.9em; color: #9ca3af;"><i class="fa-solid fa-spinner fa-spin"></i> Dizin ağacı okunuyor...</span>`;

    if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
        setTimeout(() => {
            const isOkuma = currentMachine === 'Okuma';
            const mockChain = isOkuma ? ["MAIN.MIN", "SUB1.SUB"] : ["1000.EIA", "MAZATROL_SUB.MZF"];
            const mockTree = isOkuma ? 
                [
                    {
                        name: "MD1:",
                        type: "folder",
                        children: [
                            { name: "MAIN.MIN", type: "file", size: 2048, comment: "OKUMA MAIN PROGRAM" },
                            { name: "SUB1.SUB", type: "file", size: 1024, comment: "SUB-ROUTINES" },
                            { name: "TOOL.DAT", type: "file", size: 512, comment: "TOOL DATA" }
                        ]
                    },
                    {
                        name: "US1:",
                        type: "folder",
                        children: [
                            { name: "BACKUP.MIN", type: "file", size: 4096, comment: "USB BACKUP" }
                        ]
                    }
                ] : 
                [
                    {
                        name: "HD:",
                        type: "folder",
                        children: [
                            { name: "1000.EIA", type: "file", size: 3072, comment: "MAZAK EIA PROGRAM" },
                            { name: "MAZATROL_SUB.MZF", type: "file", size: 15360, comment: "MAZATROL SUB" }
                        ]
                    },
                    {
                        name: "USB:",
                        type: "folder",
                        children: [
                            { name: "EXPORT.EIA", type: "file", size: 1024, comment: "EXPORTED PROGRAM" }
                        ]
                    }
                ];

            renderExplorerData({ callChain: mockChain, directoryTree: mockTree });
        }, 500);
        return;
    }

    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/progexplorer?machine=${currentMachine}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (data.error) {
            elSubprogChainContainer.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Hata: ${data.error}</span>`;
            elStorageTreeContainer.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Dizin ağacı okunamadı.</span>`;
            return;
        }

        renderExplorerData(data);
    } catch (err) {
        console.error('Error fetching program explorer:', err);
        elSubprogChainContainer.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Bağlantı Hatası: ${err.message}</span>`;
        elStorageTreeContainer.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> API bağlantı hatası.</span>`;
    }
}

function renderExplorerData(data) {
    if (data.callChain && data.callChain.length > 0) {
        let chainHtml = '';
        data.callChain.forEach((prog, index) => {
            chainHtml += `
                <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid var(--neon-cyan); padding: 8px 16px; border-radius: 6px; font-weight: bold; font-family: monospace; color: var(--neon-cyan); width: 100%; text-align: center; box-shadow: 0 0 5px rgba(59, 130, 246, 0.2);">
                    <i class="fa-solid fa-code"></i> ${prog}
                </div>
            `;
            if (index < data.callChain.length - 1) {
                chainHtml += `
                    <div style="color: var(--neon-orange); font-size: 1.2em; margin: 2px 0;">
                        <i class="fa-solid fa-chevron-down"></i>
                    </div>
                `;
            }
        });
        elSubprogChainContainer.innerHTML = chainHtml;
    } else {
        elSubprogChainContainer.innerHTML = `<span style="font-size: 0.9em; color: #9ca3af;">Aktif çağrı zinciri yok.</span>`;
    }

    if (data.directoryTree && data.directoryTree.length > 0) {
        elStorageTreeContainer.innerHTML = buildTreeHtml(data.directoryTree);
    } else {
        elStorageTreeContainer.innerHTML = `<span style="font-size: 0.9em; color: #9ca3af;">Dizin ağacı boş.</span>`;
    }
}

function buildTreeHtml(nodes, level = 0) {
    let html = '';
    const paddingLeft = level * 15;
    nodes.forEach(node => {
        const icon = node.type === 'folder' ? '<i class="fa-solid fa-folder" style="color: var(--neon-orange); margin-right: 5px;"></i>' : '<i class="fa-solid fa-file-code" style="color: var(--neon-cyan); margin-right: 5px;"></i>';
        const sizeText = node.type === 'file' ? ` <span style="color: #6b7280; font-size: 0.85em;">(${node.size} B)</span>` : '';
        const commentText = node.comment ? ` <span style="color: #9ca3af; font-size: 0.85em; font-style: italic;">- ${node.comment}</span>` : '';
        
        html += `
            <div style="padding-left: ${paddingLeft}px; margin-bottom: 4px; display: flex; align-items: center; flex-wrap: wrap;">
                <span>${icon}<strong>${node.name}</strong>${sizeText}${commentText}</span>
            </div>
        `;
        if (node.type === 'folder' && node.children && node.children.length > 0) {
            html += buildTreeHtml(node.children, level + 1);
        }
    });
    return html;
}

// Fetch CNC Parameters and PMC Keep Relays
async function loadCncParamsAndKeepRelays() {
    if (!elKeepRelaysContainer) return;

    if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
        // Okuma/Mazak mock data
        if (elParamRapidTraverse) elParamRapidTraverse.textContent = "X: 20000 | Y: 20000 | Z: 15000 mm/dk";
        if (elParamPartsCounter) elParamPartsCounter.textContent = "85 (MOCK)";
        
        let mockHtml = '';
        for (let i = 0; i < 10; i++) {
            const label = `K${i}`;
            const bits = (i % 2 === 0) ? "00001010" : "11000000";
            let bitGlow = '';
            for (let b = 7; b >= 0; b--) {
                const isActive = bits[7 - b] === '1';
                const color = isActive ? 'background: #10b981; box-shadow: 0 0 5px #10b981;' : 'background: #374151;';
                bitGlow += `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 2px; ${color}" title="Bit ${b}"></span>`;
            }
            mockHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span style="font-weight: bold; color: var(--text-primary);">${label}:</span>
                    <div style="display: flex; align-items: center;">
                        <span style="margin-right: 6px; font-size: 0.85em; color: #9ca3af; font-family: monospace;">${bits}</span>
                        ${bitGlow}
                    </div>
                </div>
            `;
        }
        elKeepRelaysContainer.innerHTML = mockHtml;
        return;
    }

    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/cncparams?machine=${currentMachine}&path=${currentPath}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (data.error) {
            elKeepRelaysContainer.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Hata: ${data.error}</span>`;
            return;
        }

        if (elParamRapidTraverse && data.rapidTraverse) {
            elParamRapidTraverse.textContent = `X: ${data.rapidTraverse.X} | Y: ${data.rapidTraverse.Y} | Z: ${data.rapidTraverse.Z} mm/dk`;
        }
        if (elParamPartsCounter) {
            elParamPartsCounter.textContent = data.partsCountParam;
        }

        if (data.keepRelays) {
            let html = '';
            Object.keys(data.keepRelays).sort((a,b) => {
                const numA = parseInt(a.substring(1));
                const numB = parseInt(b.substring(1));
                return numA - numB;
            }).forEach(kKey => {
                const bits = data.keepRelays[kKey];
                let bitGlow = '';
                for (let b = 7; b >= 0; b--) {
                    const isActive = bits[7 - b] === '1';
                    const color = isActive ? 'background: #10b981; box-shadow: 0 0 5px #10b981;' : 'background: #374151;';
                    bitGlow += `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 2px; ${color}" title="${kKey}.${b}"></span>`;
                }
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <span style="font-weight: bold; color: var(--text-primary);">${kKey}:</span>
                        <div style="display: flex; align-items: center;">
                            <span style="margin-right: 6px; font-size: 0.85em; color: #9ca3af; font-family: monospace;">${bits}</span>
                            ${bitGlow}
                        </div>
                    </div>
                `;
            });
            elKeepRelaysContainer.innerHTML = html;
        }
    } catch (err) {
        console.error("Keep relays load error:", err);
        elKeepRelaysContainer.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Bağlantı Hatası: ${err.message}</span>`;
    }
}

async function loadPanelSwitchesAndTimers() {
    if (!elOeePowerOn) return;

    if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
        const sec = new Date().getSeconds();
        if (elOeePowerOn) elOeePowerOn.textContent = "12560 dk";
        if (elOeeOperating) elOeeOperating.textContent = "8890 dk";
        if (elOeeCutting) elOeeCutting.textContent = "5320 dk";
        if (elCncCabinetTemp) elCncCabinetTemp.textContent = "38.2 °C";
        if (elCncBatteryVolt) elCncBatteryVolt.textContent = "3.25 V";

        if (elBtnSingleBlock) elBtnSingleBlock.style.background = (sec % 30 < 10) ? '#10b981' : '#374151';
        if (elBtnDryRun) elBtnDryRun.style.background = '#374151';
        if (elBtnOptionalStop) elBtnOptionalStop.style.background = '#10b981';
        return;
    }

    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/panelswitches?machine=${currentMachine}&path=${currentPath}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (elOeePowerOn) elOeePowerOn.textContent = `${data.powerOnMinutes} dk`;
        if (elOeeOperating) elOeeOperating.textContent = `${data.operatingMinutes} dk`;
        if (elOeeCutting) elOeeCutting.textContent = `${data.cuttingMinutes} dk`;
        if (elCncCabinetTemp) elCncCabinetTemp.textContent = `${data.cabinetTemp} °C`;
        if (elCncBatteryVolt) elCncBatteryVolt.textContent = `${data.batteryVoltage} V`;

        if (elBtnSingleBlock) elBtnSingleBlock.style.background = data.singleBlock ? '#10b981' : '#374151';
        if (elBtnDryRun) elBtnDryRun.style.background = data.dryRun ? '#10b981' : '#374151';
        if (elBtnOptionalStop) elBtnOptionalStop.style.background = data.optionalStop ? '#10b981' : '#374151';
    } catch (err) {
        console.error("Panel status load error:", err);
    }
}

async function loadProbingData() {
    if (!probingTrendContainer) return;

    probingTrendContainer.innerHTML = `<div style="color: #9ca3af; font-size: 0.85em; width: 100%; text-align: center; margin-bottom: 70px;"><i class="fa-solid fa-spinner fa-spin"></i> Ölçüm verileri sorgulanıyor...</div>`;

    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        let vals = [];

        if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
            const base = 50.0;
            for (let i = 0; i < 10; i++) {
                const noise = Math.sin(new Date().getMinutes() + i) * 0.012 + (Math.random() * 0.004);
                vals.push(parseFloat((base + noise).toFixed(4)));
            }
        } else {
            const response = await fetch(`http://${apiHost}:8090/probingdata?machine=${currentMachine}&path=${currentPath}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            vals = data.probingValues || [];
        }

        if (vals.length === 0) {
            probingTrendContainer.innerHTML = `<span style="color: #9ca3af;">Veri yok.</span>`;
            return;
        }

        // Stats calculation
        const minVal = Math.min(...vals);
        const maxVal = Math.max(...vals);
        const avgVal = vals.reduce((a,b) => a+b, 0) / vals.length;

        if (probingMin) probingMin.textContent = `${minVal.toFixed(4)} mm`;
        if (probingMax) probingMax.textContent = `${maxVal.toFixed(4)} mm`;
        if (probingAvg) probingAvg.textContent = `${avgVal.toFixed(4)} mm`;

        // Render visual trend graph
        // Target: 50.000, Upper Tol: 50.020, Lower Tol: 49.980
        // Heights represented relative to graph container (50% is center, 20% top, 80% bottom)
        let graphHtml = `
            <div style="position: absolute; left: 0; right: 0; top: 50%; border-top: 1px dashed rgba(16, 185, 129, 0.4);" title="Nominal Çizgisi (50.000)"></div>
            <div style="position: absolute; left: 0; right: 0; top: 20%; border-top: 1px dashed rgba(239, 68, 68, 0.3);" title="Üst Tolerans (+0.020)"></div>
            <div style="position: absolute; left: 0; right: 0; top: 80%; border-top: 1px dashed rgba(239, 68, 68, 0.3);" title="Alt Tolerans (-0.020)"></div>
        `;

        vals.forEach((val, idx) => {
            const deviation = val - 50.0;
            // Map deviation to percentage height. deviation = +0.02 -> 20% top, deviation = -0.02 -> 80% bottom.
            // 50 - (deviation / 0.02) * 30
            const percentageTop = Math.max(5, Math.min(95, 50 - (deviation / 0.02) * 30));
            const inTol = Math.abs(deviation) <= 0.02;
            const dotColor = inTol ? '#10b981' : '#ef4444';
            const dotShadow = inTol ? '0 0 8px #10b981' : '0 0 12px #ef4444';

            graphHtml += `
                <div style="display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; justify-content: flex-end; position: relative;">
                    <div style="position: absolute; top: ${percentageTop}%; transform: translateY(-50%); width: 12px; height: 12px; border-radius: 50%; background: ${dotColor}; box-shadow: ${dotShadow}; cursor: pointer;" title="Parça #${idx+1}: ${val} mm"></div>
                    <span style="font-size: 0.7em; color: #6b7280; margin-bottom: -15px;">#${idx+1}</span>
                </div>
            `;
        });
        probingTrendContainer.innerHTML = graphHtml;
    } catch (err) {
        console.error("Probing data load error:", err);
        probingTrendContainer.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Bağlantı Hatası</span>`;
    }
}

async function loadOperationHistory() {
    if (!ophistoryTbody) return;

    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        let events = [];

        if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
            events = [
                { time: new Date(Date.now() - 300000).toLocaleString('tr-TR'), msg: `[Simülatör] Mod değiştirildi: AUTO moduna geçildi.` },
                { time: new Date(Date.now() - 600000).toLocaleString('tr-TR'), msg: `[Simülatör] Program seçildi: O1001` },
                { time: new Date(Date.now() - 1200000).toLocaleString('tr-TR'), msg: `[Simülatör] Tezgah gücü açıldı (Power ON).` }
            ];
        } else {
            const response = await fetch(`http://${apiHost}:8090/ophistory?machine=${currentMachine}&path=${currentPath}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            events = data.events || [];
        }

        if (events.length === 0) {
            ophistoryTbody.innerHTML = `<tr><td colspan="2" class="empty-table-msg">Günlük kaydı bulunmamaktadır.</td></tr>`;
            return;
        }

        let html = '';
        events.forEach(e => {
            html += `
                <tr>
                    <td style="color: #9ca3af; font-family: monospace;">${e.time}</td>
                    <td style="color: var(--text-primary); font-weight: 500;">${e.msg}</td>
                </tr>
            `;
        });
        ophistoryTbody.innerHTML = html;
    } catch (err) {
        console.error("Operation history load error:", err);
        ophistoryTbody.innerHTML = `<tr><td colspan="2" class="empty-table-msg" style="color: #ef4444;">Bağlantı Hatası: ${err.message}</td></tr>`;
    }
}

async function loadDigitalTwin() {
    const apiHost = window.location.hostname || "127.0.0.1";

    if (currentMachine === 'Okuma' || currentMachine === 'Mazak') {
        if (elFeedOverrideText) elFeedOverrideText.textContent = "100%";
        if (elSpindleOverrideText) elSpindleOverrideText.textContent = "100%";

        if (elGcodeSlidingViewer) {
            const sec = new Date().getSeconds();
            const activeLine = 10 + Math.floor(sec / 12) * 10;
            elGcodeSlidingViewer.innerHTML = `
                <div style="color: #4b5563;">O1001 (WAITING)</div>
                <div style="color: #4b5563;">N${activeLine - 10} G00 G90 G54 X150. Y80.</div>
                <div style="color: var(--neon-cyan); background: rgba(59, 130, 246, 0.15); padding: 2px 5px; border-radius: 4px; font-weight: bold; border-left: 3px solid var(--neon-cyan);">N${activeLine} G01 Z-15. F800 (ACTIVE)</div>
                <div style="color: #9ca3af;">N${activeLine + 10} X160. Y90.</div>
                <div style="color: #9ca3af;">N${activeLine + 20} G00 Z50.</div>
            `;
        }

        if (elModalBadgeMotion) elModalBadgeMotion.textContent = "G01";
        if (elModalBadgeUnits) elModalBadgeUnits.textContent = "G21";
        if (elModalBadgeCoord) elModalBadgeCoord.textContent = "G90";
        if (elModalBadgeWcs) elModalBadgeWcs.textContent = "G54";
        if (elModalBadgeSpindle) elModalBadgeSpindle.textContent = "M03";
        if (elModalBadgeCoolant) elModalBadgeCoolant.textContent = "M08";

        if (elWorkOffsetsTbody) {
            elWorkOffsetsTbody.innerHTML = `
                <tr><td>G54</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td></tr>
                <tr><td>G55</td><td style="font-family: monospace; color: var(--neon-cyan);">-150.120</td><td style="font-family: monospace; color: var(--neon-cyan);">90.450</td><td style="font-family: monospace; color: var(--neon-cyan);">-350.200</td></tr>
                <tr><td>G56</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td></tr>
                <tr><td>G57</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td></tr>
                <tr><td>G58</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td></tr>
                <tr><td>G59</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td><td style="font-family: monospace; color: var(--neon-cyan);">0.000</td></tr>
            `;
        }
        // Mock trend data collection
        const mockL = 15.0 + Math.random() * 25.0;
        const mockF = 100;
        machineState[currentMachine].trendData.push({ load: mockL, feed: mockF });
        if (machineState[currentMachine].trendData.length > 30) machineState[currentMachine].trendData.shift();
        renderLiveTrendChart();
        return;
    }

    try {
        // Fetch Overrides
        const resOver = await fetch(`http://${apiHost}:8090/overrides?machine=${currentMachine}&path=${currentPath}`);
        let fOverride = 100;
        if (resOver.ok) {
            const data = await resOver.json();
            fOverride = data.feedOverride;
            if (elFeedOverrideText) elFeedOverrideText.textContent = `${data.feedOverride}%`;
            if (elSpindleOverrideText) elSpindleOverrideText.textContent = `${data.spindleOverride}%`;
        }

        const torqueText = diagSpindleTorque ? diagSpindleTorque.textContent : "0.0";
        const sTorque = parseFloat(torqueText) || 0.0;

        machineState[currentMachine].trendData.push({ load: sTorque, feed: fOverride });
        if (machineState[currentMachine].trendData.length > 30) machineState[currentMachine].trendData.shift();

        renderLiveTrendChart();

        // Fetch Modal state
        const resModal = await fetch(`http://${apiHost}:8090/modalstate?machine=${currentMachine}&path=${currentPath}`);
        if (resModal.ok) {
            const data = await resModal.json();
            if (elModalBadgeMotion) elModalBadgeMotion.textContent = data.motion;
            if (elModalBadgeUnits) elModalBadgeUnits.textContent = data.units;
            if (elModalBadgeCoord) elModalBadgeCoord.textContent = data.coord;
            if (elModalBadgeWcs) elModalBadgeWcs.textContent = data.wcs;
            if (elModalBadgeSpindle) elModalBadgeSpindle.textContent = data.spindleDir;
            if (elModalBadgeCoolant) elModalBadgeCoolant.textContent = data.coolant;
        }

        // Fetch G-Code Sliding Viewer
        if (elGcodeSlidingViewer) {
            const activeBlockText = elGcodeBlock ? elGcodeBlock.textContent : "G01";
            const sequenceText = elSequence ? elSequence.textContent : "N0";
            const currentProgText = elProgram ? elProgram.textContent : "O1000";
            
            elGcodeSlidingViewer.innerHTML = `
                <div style="color: #4b5563;">${currentProgText} (WAITING)</div>
                <div style="color: #4b5563;">G00 G90 G40 G49 (PREV)</div>
                <div style="color: var(--neon-cyan); background: rgba(59, 130, 246, 0.15); padding: 2px 5px; border-radius: 4px; font-weight: bold; border-left: 3px solid var(--neon-cyan);">${sequenceText} ${activeBlockText} (ACTIVE)</div>
                <div style="color: #9ca3af;">G43 H01 Z50.</div>
                <div style="color: #9ca3af;">M09 M05</div>
            `;
        }

        // Fetch Work Offsets
        const resOffsets = await fetch(`http://${apiHost}:8090/workoffsets?machine=${currentMachine}&path=${currentPath}`);
        if (resOffsets.ok) {
            const data = await resOffsets.json();
            if (elWorkOffsetsTbody) {
                let html = '';
                data.forEach(o => {
                    html += `<tr>
                        <td style="font-weight: bold; color: var(--text-primary);">${o.name}</td>
                        <td style="font-family: monospace; color: var(--neon-cyan);">${o.x.toFixed(3)}</td>
                        <td style="font-family: monospace; color: var(--neon-cyan);">${o.y.toFixed(3)}</td>
                        <td style="font-family: monospace; color: var(--neon-cyan);">${o.z.toFixed(3)}</td>
                    </tr>`;
                });
                elWorkOffsetsTbody.innerHTML = html;
            }
        }
    } catch (e) {
        console.error("Error loading digital twin:", e);
    }
}

function renderLiveTrendChart() {
    const pathLoad = document.getElementById('trend-spindle-load-path');
    const pathFeed = document.getElementById('trend-feedrate-path');
    if (!pathLoad || !pathFeed) return;

    const data = machineState[currentMachine].trendData || [];
    if (data.length < 2) {
        pathLoad.setAttribute('d', '');
        pathFeed.setAttribute('d', '');
        return;
    }

    const widthStep = 100.0 / (data.length - 1);
    let pointsLoad = [];
    let pointsFeed = [];

    data.forEach((d, idx) => {
        const x = (idx * widthStep).toFixed(1);
        const yLoad = (95 - (Math.min(150, d.load) / 150.0) * 85).toFixed(1);
        const yFeed = (95 - (Math.min(150, d.feed) / 150.0) * 85).toFixed(1);

        pointsLoad.push(`${x},${yLoad}`);
        pointsFeed.push(`${x},${yFeed}`);
    });

    pathLoad.setAttribute('d', `M ${pointsLoad.join(' L ')}`);
    pathFeed.setAttribute('d', `M ${pointsFeed.join(' L ')}`);
}

function checkDiagnosticThresholds() {
    if (!elDiagWarningBanner || !elDiagWarningMsg) return;

    const warnings = [];
    let isCriticalElectrical = false;

    // 1. Spindle Temp
    const sTempText = diagSpindleTemp ? diagSpindleTemp.textContent : "0 °C";
    const sTemp = parseFloat(sTempText) || 0.0;
    if (sTemp > 60) {
        warnings.push(`Fener Mili Sıcaklığı Yüksek! (${sTemp} °C)`);
    }

    // 2. Lube pressure
    const elLube = document.getElementById('pmc-lube-pressure');
    const lubePressText = elLube ? elLube.textContent : "4.0 bar";
    const lubePress = parseFloat(lubePressText) || 4.0;
    if (lubePress < 1.5) {
        warnings.push(`Kızak Yağ Basıncı Düşük! (${lubePress} bar)`);
    }

    // 3. Coolant Level
    const coolantText = elPmcCoolantLbl ? elPmcCoolantLbl.textContent : "100%";
    const coolant = parseFloat(coolantText) || 100.0;
    if (coolant < 20.0) {
        warnings.push(`Bor Yağı Seviyesi Kritik Seviyede Düşük! (%${coolant})`);
    }

    // 4. Air Pressure
    const airText = elPmcAirLbl ? elPmcAirLbl.textContent : "6.0 Bar";
    const air = parseFloat(airText) || 6.0;
    if (air < 5.5) {
        warnings.push(`Giriş Hava Basıncı Yetersiz! (${air} Bar)`);
    }

    // 5. Electrical Fan Alarms
    const servoFanStopped = elServoFan && elServoFan.textContent.includes("ARIZA");
    const cncFanStopped = elCabinetFan && elCabinetFan.textContent.includes("ARIZA");
    if (servoFanStopped) {
        warnings.push(`KRİTİK: DURMUŞ SERVO SÜRÜCÜ FANI!`);
        isCriticalElectrical = true;
    }
    if (cncFanStopped) {
        warnings.push(`KRİTİK: DURMUŞ CNC KART FANI!`);
        isCriticalElectrical = true;
    }

    // 6. Backup Battery Voltage Alarm
    const batteryVoltText = elCncBatteryVolt ? elCncBatteryVolt.textContent : "3.2 V";
    const batteryVolt = parseFloat(batteryVoltText) || 3.2;
    if (batteryVolt < 2.7) {
        warnings.push(`KRİTİK: YEDEK PİL VOLTAJI DÜŞÜK! (${batteryVolt} V)`);
        isCriticalElectrical = true;
    }

    // Render Banner
    if (warnings.length > 0) {
        elDiagWarningMsg.textContent = warnings.join(' | ');
        if (isCriticalElectrical) {
            elDiagWarningBanner.className = "alarm-banner flash-red-alert";
        } else {
            elDiagWarningBanner.className = "alarm-banner";
            elDiagWarningBanner.style.display = "flex";
        }
    } else {
        elDiagWarningBanner.style.display = 'none';
        elDiagWarningBanner.className = "alarm-banner";
    }
}

// PMC Address Sniffer variables
let sniffedAddress = "";

function initPmcSniffer() {
    if (!elPmcSniffBtn || !elPmcSniffInput) return;

    elPmcSniffBtn.addEventListener('click', () => {
        const addr = elPmcSniffInput.value.trim().toUpperCase();
        if (!addr) {
            alert("Lütfen geçerli bir PMC adresi girin (Örn: X0004.2 veya R100)");
            return;
        }

        sniffedAddress = addr;
        if (elPmcSniffResult) {
            elPmcSniffResult.style.display = 'flex';
            elPmcSniffAddrLbl.textContent = sniffedAddress;
            elPmcSniffValLbl.textContent = "Sorgulanıyor...";
            elPmcSniffLamp.style.backgroundColor = '#f59e0b'; // orange for loading
        }
        
        // Immediate query
        querySniffedAddress();
    });
}

async function querySniffedAddress() {
    if (!sniffedAddress) return;
    try {
        const apiHost = window.location.hostname || "127.0.0.1";
        const response = await fetch(`http://${apiHost}:8090/pmcsniffer?address=${sniffedAddress}&machine=${currentMachine}`);
        if (!response.ok) return;
        const data = await response.json();

        if (data.error) {
            elPmcSniffValLbl.textContent = "HATA";
            elPmcSniffLamp.style.backgroundColor = '#ef4444'; // red for error
            elPmcSniffLamp.title = data.error;
        } else {
            elPmcSniffValLbl.textContent = data.value;
            if (data.value === 1) {
                elPmcSniffLamp.style.backgroundColor = '#10b981'; // green for active/1
                elPmcSniffLamp.style.boxShadow = '0 0 8px #10b981';
            } else {
                elPmcSniffLamp.style.backgroundColor = '#374151'; // grey for inactive/0
                elPmcSniffLamp.style.boxShadow = 'none';
            }
            elPmcSniffLamp.title = data.simulated ? "Simülasyon Verisi" : "Gerçek Canlı Veri";
        }
    } catch (e) {
        elPmcSniffValLbl.textContent = "BAĞLANTI YOK";
        elPmcSniffLamp.style.backgroundColor = '#ef4444';
    }
}

// Canlı Akım Teşhis Oscillo-Grafiği
function drawCurrentOscilloChart() {
    const canvas = document.getElementById('current-oscillo-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Oscilloscope Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    const gridSpacing = 20;
    for (let x = 0; x < canvas.width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    // Horizontal grid lines
    for (let y = 0; y < canvas.height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Maximum current scale (max is 25A)
    const maxAmps = 25.0;
    const pad = 10;
    const graphHeight = canvas.height - pad * 2;
    const graphWidth = canvas.width;

    function drawLine(history, color, shadowColor) {
        if (!history || history.length === 0) return;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 4;

        for (let i = 0; i < history.length; i++) {
            const xPos = (i / 29) * graphWidth;
            const val = history[i];
            const yPos = canvas.height - pad - (val / maxAmps) * graphHeight;

            if (i === 0) {
                ctx.moveTo(xPos, yPos);
            } else {
                ctx.lineTo(xPos, yPos);
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow
    }

    // Draw X, Y, Z current lines
    drawLine(currentsHistory.X, '#ef4444', 'rgba(239, 68, 68, 0.4)'); // Red
    drawLine(currentsHistory.Y, '#06b6d4', 'rgba(6, 182, 212, 0.4)'); // Cyan
    drawLine(currentsHistory.Z, '#eab308', 'rgba(234, 179, 8, 0.4)');  // Yellow

    // Draw legends
    ctx.fillStyle = '#9ca3af';
    ctx.font = '8px monospace';
    ctx.fillText("Akım Ölçümü (X:Kırmızı, Y:Mavi, Z:Sarı) - Max 25A", 5, 10);
}

// Start Application
window.addEventListener('DOMContentLoaded', init);
