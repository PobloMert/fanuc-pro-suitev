/**
 * MTB Elektrik Bakım — Smart I/O Sniffer & PMC Signal Engine
 * Detects sensor bit changes in real-time without electrical schematics
 */

(function initIOSniffer(global) {
  'use strict';

  class IOSniffer {
    constructor() {
      this.isListening = false;
      this.baseline = null;
      this.detectedEvents = [];
    }

    parseAddress(addr) {
      const match = String(addr || '').trim().toUpperCase().match(/^([XYRFGKDC])(\d+)(?:\.(\d))?$/);
      if (!match) return null;
      return {
        type: match[1],
        byte: parseInt(match[2], 10),
        bit: match[3] !== undefined ? parseInt(match[3], 10) : 0,
        formatted: `${match[1]}${String(match[2]).padStart(4, '0')}.${match[3] !== undefined ? match[3] : '0'}`
      };
    }

    formatAddress(type, byte, bit) {
      return `${type.toUpperCase()}${String(byte).padStart(4, '0')}.${bit}`;
    }

    startListening(initialBytes = {}) {
      this.isListening = true;
      this.baseline = { ...initialBytes };
      this.detectedEvents = [];
      return { ok: true, timestamp: Date.now() };
    }

    stopListening() {
      this.isListening = false;
      return { ok: true, events: [...this.detectedEvents] };
    }

    checkBytes(currentBytes = {}) {
      if (!this.isListening || !this.baseline) return [];
      const changes = [];

      for (const [key, curVal] of Object.entries(currentBytes)) {
        const baseVal = this.baseline[key] !== undefined ? this.baseline[key] : 0;
        const diff = (baseVal ^ curVal) & 0xFF;

        if (diff !== 0) {
          const parsedKey = this.parseAddress(key);
          const type = parsedKey ? parsedKey.type : 'X';
          const byteNum = parsedKey ? parsedKey.byte : 0;

          for (let bit = 0; bit < 8; bit++) {
            if ((diff & (1 << bit)) !== 0) {
              const from = (baseVal >> bit) & 1;
              const to = (curVal >> bit) & 1;
              const addr = this.formatAddress(type, byteNum, bit);
              const changeEvent = {
                address: addr,
                type,
                byte: byteNum,
                bit,
                from,
                to,
                direction: to === 1 ? 'RISING' : 'FALLING',
                timestamp: Date.now()
              };
              changes.push(changeEvent);
              this.detectedEvents.push(changeEvent);
            }
          }
        }
      }

      return changes;
    }

    evaluateSignal(signal, bytesState = {}) {
      if (!signal || !signal.address) {
        return { isOk: true, state: 0, label: 'Bilinmiyor', color: 'gray' };
      }

      const parsed = this.parseAddress(signal.address);
      if (!parsed) {
        return { isOk: true, state: 0, label: 'Geçersiz Adres', color: 'gray' };
      }

      const key = `${parsed.type}${parsed.byte}`;
      const byteVal = bytesState[key] !== undefined ? bytesState[key] : (bytesState[signal.address] !== undefined ? bytesState[signal.address] : 0);
      const bitVal = (byteVal >> parsed.bit) & 1;

      const activeState = signal.activeState !== undefined ? signal.activeState : 1;
      const isOk = signal.isAlarmSensor ? bitVal !== activeState : bitVal === activeState;

      let label = isOk ? (signal.okLabel || 'NORMAL') : (signal.warnLabel || 'İKAZ');
      let color = isOk ? 'green' : (signal.isAlarmSensor || signal.isSafety ? 'red' : 'orange');

      return {
        address: parsed.formatted,
        name: signal.name || 'Sensör',
        bit: bitVal,
        isOk,
        label,
        color
      };
    }

    getPresetTemplates() {
      return {
        standard_mill: [
          { id: 'door_interlock', name: 'Ön Kapı Güvenlik Switchi', address: 'X0008.3', activeState: 1, okLabel: 'KAPALI (Güvenli)', warnLabel: 'AÇIK', isSafety: true },
          { id: 'hyd_pressure', name: 'Hidrolik Basınç Sensörü', address: 'X0012.0', activeState: 1, okLabel: 'NORMAL', warnLabel: 'DÜŞÜK BASINÇ', isSafety: true },
          { id: 'lube_level', name: 'Kızak Yağı Seviyesi', address: 'X0004.5', activeState: 1, okLabel: 'SEVİYE TAMAM', warnLabel: 'YAĞ EKSİK', isSafety: false },
          { id: 'air_pressure', name: 'Hava Basınç Şalteri', address: 'X0001.7', activeState: 1, okLabel: 'BASINÇ NORMAL', warnLabel: 'HAVA DÜŞÜK', isSafety: true },
          { id: 'spindle_clamp', name: 'Spindle Takım Tutma', address: 'X0002.1', activeState: 1, okLabel: 'SIKILI', warnLabel: 'ÇÖZÜK', isSafety: false },
          { id: 'e_stop', name: 'Acil Stop Butonu (CNC)', address: 'G0008.4', activeState: 1, okLabel: 'DEVREDE DEĞİL', warnLabel: 'ACİL STOP BASILI', isSafety: true }
        ],
        standard_lathe: [
          { id: 'door_interlock', name: 'Kabin Kapı Switchi', address: 'X0004.0', activeState: 1, okLabel: 'KAPALI', warnLabel: 'AÇIK', isSafety: true },
          { id: 'chuck_clamp', name: 'Ayna Sıkma (Chuck Clamped)', address: 'X0005.1', activeState: 1, okLabel: 'SIKILI', warnLabel: 'AYNA AÇIK', isSafety: true },
          { id: 'tailstock_quill', name: 'Punta İleri (Quill Advance)', address: 'X0005.4', activeState: 1, okLabel: 'PUNTA İLERİ', warnLabel: 'PUNTA GERİDE', isSafety: false },
          { id: 'hyd_pressure', name: 'Hidrolik Ünite Basıncı', address: 'X0010.2', activeState: 1, okLabel: 'NORMAL', warnLabel: 'BASINÇ YOK', isSafety: true },
          { id: 'lube_level', name: 'Kızak Yağı Şamandırası', address: 'X0002.6', activeState: 1, okLabel: 'DOLU', warnLabel: 'YAĞ SEVİYESİ DÜŞÜK', isSafety: false },
          { id: 'e_stop', name: 'Acil Stop Butonu', address: 'G0008.4', activeState: 1, okLabel: 'NORMAL', warnLabel: 'ACİL STOP', isSafety: true }
        ],
        doosan_dnm: [
          { id: 'door_interlock', name: 'Doosan Ön Kapı Interlock', address: 'X0008.3', activeState: 1, okLabel: 'KAPALI (Kilitli)', warnLabel: 'KAPI AÇIK', isSafety: true },
          { id: 'hyd_pressure', name: 'Doosan Hidrolik Basınç', address: 'X0009.2', activeState: 1, okLabel: 'NORMAL (45 Bar)', warnLabel: 'DÜŞÜK BASINÇ', isSafety: true },
          { id: 'lube_level', name: 'Kızak Yağlama Seviyesi', address: 'X0004.5', activeState: 1, okLabel: 'TAM', warnLabel: 'YAĞ BİTTİ', isSafety: false },
          { id: 'coolant_level', name: 'Bor Yağı Seviyesi', address: 'X0006.1', activeState: 1, okLabel: 'NORMAL', warnLabel: 'SOĞUTMA AZ', isSafety: false },
          { id: 'air_pressure', name: 'Ana Pnömatik Giriş Basıncı', address: 'X0001.7', activeState: 1, okLabel: '6.0 BAR', warnLabel: 'HAVA KESİK', isSafety: true }
        ]
      };
    }
  }

  global.MTBIOSniffer = IOSniffer;
  global.ioSniffer = new IOSniffer();
})(typeof window !== 'undefined' ? window : globalThis);
