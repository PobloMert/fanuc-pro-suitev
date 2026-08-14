/**
 * MTB Elektrik Bakım — MTConnect Live Client & Stream Parser
 * Universal ANSI/ISO MTConnect Standard Protocol Adapter
 * Supports /probe, /current, and /sample XML/JSON streams
 */

(function initMTConnectClient(global) {
  'use strict';

  class MTConnectClient {
    constructor(options = {}) {
      this.defaultPort = options.defaultPort || 5000;
      this.timeoutMs = options.timeoutMs || 4000;
    }

    buildUrl(host, port, path = '/current') {
      const cleanHost = String(host || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
      const p = parseInt(port) || this.defaultPort;
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `http://${cleanHost}:${p}${cleanPath}`;
    }

    async probe(host, port) {
      const url = this.buildUrl(host, port, '/probe');
      try {
        const text = await this.fetchText(url);
        return { ok: true, url, ...this.parseProbe(text) };
      } catch (err) {
        return { ok: false, url, error: err.message };
      }
    }

    async getCurrent(host, port) {
      const url = this.buildUrl(host, port, '/current');
      try {
        const text = await this.fetchText(url);
        const data = this.parseCurrent(text);
        return { ok: true, url, data };
      } catch (err) {
        return { ok: false, url, error: err.message };
      }
    }

    async fetchText(url) {
      if (global.electronAPI?.fetchProxy) {
        // Under electron privileged proxy or direct fetch
        const res = await fetch(url, { headers: { Accept: 'application/xml, text/xml, application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return await res.text();
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    }

    parseProbe(rawText) {
      const result = {
        name: 'MTConnect Device',
        model: 'Universal CNC',
        serialNumber: '',
        axes: [],
        dataItems: []
      };

      if (!rawText) return result;

      // Try JSON parsing
      if (rawText.trim().startsWith('{')) {
        try {
          const json = JSON.parse(rawText);
          const device = json?.MTConnectDevices?.Devices?.[0]?.Device || json?.devices?.[0] || {};
          result.name = device.name || result.name;
          result.model = device.model || device.description || result.model;
          result.serialNumber = device.serialNumber || device.uuid || '';
          return result;
        } catch (e) {}
      }

      // XML Parsing
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawText, 'text/xml');
        const deviceNode = doc.querySelector('Device, Header');
        if (deviceNode) {
          result.name = deviceNode.getAttribute('name') || result.name;
          result.model = deviceNode.getAttribute('model') || result.model;
          result.serialNumber = deviceNode.getAttribute('serialNumber') || deviceNode.getAttribute('uuid') || '';
        }
        const descNode = doc.querySelector('Description');
        if (descNode && descNode.textContent) {
          result.model = descNode.textContent.trim();
        }
        const dataItemNodes = doc.querySelectorAll('DataItem');
        dataItemNodes.forEach(node => {
          result.dataItems.push({
            id: node.getAttribute('id'),
            type: node.getAttribute('type'),
            subType: node.getAttribute('subType'),
            category: node.getAttribute('category'),
            name: node.getAttribute('name')
          });
        });
      } catch (e) {}

      return result;
    }

    parseCurrent(rawText) {
      const sample = {
        execution: 'ACTIVE',
        program: '',
        partCount: 0,
        spindleLoad: 0,
        feedrateOverride: 100,
        spindleOverride: 100,
        feedrate: 0,
        spindleSpeed: 0,
        emergencyStop: 'ARMED',
        alarms: [],
        timestamp: new Date().toISOString()
      };

      if (!rawText) return sample;

      // JSON parsing support
      if (rawText.trim().startsWith('{')) {
        try {
          const json = JSON.parse(rawText);
          const streams = json?.MTConnectStreams?.Streams || json?.streams || [];
          // Extract streams recursively
          const searchJson = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            for (const [k, v] of Object.entries(obj)) {
              const lk = k.toLowerCase();
              const val = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
              if (typeof val !== 'object') {
                if (lk.includes('execution')) sample.execution = String(val).toUpperCase();
                if (lk.includes('program')) sample.program = String(val);
                if (lk.includes('partcount') || lk.includes('part_count')) sample.partCount = parseInt(val, 10) || sample.partCount;
                if ((lk.includes('feed') && lk.includes('override')) || lk.includes('path_feedrate_ovr') || lk.includes('feedrate_ovr')) {
                  sample.feedrateOverride = parseFloat(val) || sample.feedrateOverride;
                }
                if ((lk.includes('spindle') && lk.includes('override')) || lk.includes('rotaryvelocityoverride') || lk.includes('spindle_ovr')) {
                  sample.spindleOverride = parseFloat(val) || sample.spindleOverride;
                }
                if ((lk.includes('spindle') && lk.includes('load')) || lk === 'load' || lk.includes('actualload')) {
                  sample.spindleLoad = parseFloat(val) || sample.spindleLoad;
                }
                if (lk.includes('rotaryvelocity') || (lk.includes('spindle') && lk.includes('speed')) || lk.includes('actualspeed')) {
                  sample.spindleSpeed = parseFloat(val) || sample.spindleSpeed;
                }
                if (lk.includes('pathfeedrate') || (lk.includes('feed') && lk.includes('rate')) || lk.includes('actualfeed')) {
                  sample.feedrate = parseFloat(val) || sample.feedrate;
                }
              }
              searchJson(v);
            }
          };
          searchJson(streams);
          return sample;
        } catch (e) {}
      }

      // XML parsing (Standard MTConnect Streams)
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawText, 'text/xml');

        const readValue = (selector) => {
          const el = doc.querySelector(selector);
          return el ? el.textContent.trim() : null;
        };

        const exec = readValue('Execution, PathExecution');
        if (exec) sample.execution = exec.toUpperCase();

        const prog = readValue('Program, PartProgram, ActiveProgram');
        if (prog) sample.program = prog;

        const part = readValue('PartCount, PartCounter, TotalPartCount');
        if (part) sample.partCount = parseInt(part, 10) || 0;

        const fOvr = readValue('PathFeedrateOverride, FeedrateOverride');
        if (fOvr) sample.feedrateOverride = Math.max(0, Math.min(300, parseFloat(fOvr) || 100));

        const sOvr = readValue('SpindleSpeedOverride, RotaryVelocityOverride, SpindleOverride');
        if (sOvr) sample.spindleOverride = Math.max(0, Math.min(300, parseFloat(sOvr) || 100));

        const sLoad = readValue('SpindleLoad, Load, ActualLoad');
        if (sLoad) sample.spindleLoad = Math.max(0, parseFloat(sLoad) || 0);

        const rVel = readValue('RotaryVelocity, SpindleSpeed, ActualSpeed');
        if (rVel) sample.spindleSpeed = Math.max(0, parseFloat(rVel) || 0);

        const pFeed = readValue('PathFeedrate, Feedrate, ActualFeedrate');
        if (pFeed) sample.feedrate = Math.max(0, parseFloat(pFeed) || 0);

        const eStop = readValue('EmergencyStop');
        if (eStop) sample.emergencyStop = eStop.toUpperCase();

        // Detect any active alarms
        const alarmNodes = doc.querySelectorAll('Alarm, Condition, Fault, Warning');
        alarmNodes.forEach(node => {
          const msg = node.textContent.trim();
          const code = node.getAttribute('nativeCode') || node.getAttribute('dataItemId') || 'ALM';
          if (msg && msg !== 'UNAVAILABLE' && msg !== 'NORMAL') {
            sample.alarms.push({ code, message: msg, type: node.tagName });
          }
        });
      } catch (e) {}

      return sample;
    }

    getOfflineFallback(machineName, reason = 'AĞ BAĞLANTISI YOK / ŞALTER İNİK') {
      return {
        execution: 'OFFLINE',
        power: 'OFF',
        program: '---',
        partCount: 0,
        spindleLoad: 0,
        feedrateOverride: 100,
        spindleOverride: 100,
        feedrate: 0,
        spindleSpeed: 0,
        emergencyStop: 'UNAVAILABLE',
        alarms: [],
        statusLabel: '⚪ ÇEVRİMDIŞI (Şalter İnik)',
        reason,
        timestamp: new Date().toISOString(),
        quality: 'stale'
      };
    }

    toTelemetrySample(parsedData, machineName) {
      const isOffline = parsedData.execution === 'OFFLINE' || parsedData.quality === 'stale';
      return {
        machine: machineName || 'CNC',
        sampledAt: parsedData.timestamp || new Date().toISOString(),
        execution: parsedData.execution || (isOffline ? 'OFFLINE' : 'ACTIVE'),
        program: parsedData.program || (isOffline ? '---' : 'O0001'),
        partCount: parsedData.partCount || 0,
        spindleLoad: parsedData.spindleLoad || 0,
        feedrateOverride: parsedData.feedrateOverride ?? 100,
        spindleOverride: parsedData.spindleOverride ?? 100,
        dataAgeMs: isOffline ? 5000 : 50,
        quality: isOffline ? 'stale' : 'good',
        simulated: false
      };
    }
  }

  global.MTBMTConnectClient = MTConnectClient;
  global.mtconnectClient = new MTConnectClient();
})(typeof window !== 'undefined' ? window : globalThis);
