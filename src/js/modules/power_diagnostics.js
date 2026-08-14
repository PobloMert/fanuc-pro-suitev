/**
 * MTB Elektrik Bakım — FANUC DC Bus & Power Supply Diagnostics Module
 * Real-time monitoring of DC Link Voltage, Regenerative Braking and PSM Health
 */

(function initPowerDiagnostics(global) {
  'use strict';

  class PowerDiagnostics {
    constructor(options = {}) {
      this.nominalVoltage = options.nominalVoltage || 300.0; // 300V DC for standard 200V AC, 600V for 400V HV
    }

    evaluateDcBus(voltage, nominal = this.nominalVoltage) {
      const v = parseFloat(voltage) || nominal;
      const underThresh = nominal * 0.85;   // e.g. 255V
      const warnThresh = nominal * 1.14;    // e.g. 342V
      const overThresh = nominal * 1.25;    // e.g. 375V (PSM 01 Trip)

      if (v < underThresh) {
        return {
          voltage: v,
          nominal,
          status: 'UNDERVOLTAGE',
          label: 'Düşük DC Bara Voltajı (Şebeke Çökmesi / Giriş Faz Eksik)',
          color: 'red',
          isAlarm: true,
          alarmCode: 'PSM 02'
        };
      }

      if (v > overThresh) {
        return {
          voltage: v,
          nominal,
          status: 'OVERVOLTAGE',
          label: 'Aşırı Voltaj (PSM 01 Alarm Eşiği Aşıldı!)',
          color: 'red',
          isAlarm: true,
          alarmCode: 'PSM 01'
        };
      }

      if (v > warnThresh) {
        return {
          voltage: v,
          nominal,
          status: 'WARNING',
          label: 'Yüksek DC Gerilim (Agresif Frenleme / Şebeke Dalgalanması)',
          color: 'orange',
          isAlarm: false
        };
      }

      return {
        voltage: v,
        nominal,
        status: 'OPTIMAL',
        label: 'DC Bara Kararlı & Güvenli',
        color: 'green',
        isAlarm: false
      };
    }

    evaluateRegen(loadPct) {
      const load = Math.max(0, Math.min(100, parseFloat(loadPct) || 0));
      if (load > 80) {
        return {
          load,
          status: 'OVERHEAT_RISK',
          label: 'Frenleme Direnci Aşırı Isınma Riski (PSM 03)',
          color: 'red',
          isAlarm: true,
          alarmCode: 'PSM 03'
        };
      }
      if (load > 50) {
        return {
          load,
          status: 'ELEVATED',
          label: 'Yoğun Rejeneratif Deşarj Yükü',
          color: 'orange',
          isAlarm: false
        };
      }
      return {
        load,
        status: 'NORMAL',
        label: 'Fren Direnci Yükü Normal',
        color: 'green',
        isAlarm: false
      };
    }

    evaluatePsmTemp(tempC) {
      const temp = parseFloat(tempC) || 40.0;
      if (temp > 80) {
        return {
          temp,
          status: 'HOT',
          label: 'Kritik IGBT Radyatör Sıcaklığı (PSM 04 Alarmı)',
          color: 'red',
          isAlarm: true,
          alarmCode: 'PSM 04'
        };
      }
      if (temp > 60) {
        return {
          temp,
          status: 'WARM',
          label: 'Sürücü Isısı Yüksek (Pano Fanlarını Kontrol Edin)',
          color: 'orange',
          isAlarm: false
        };
      }
      return {
        temp,
        status: 'NORMAL',
        label: 'Sürücü Çalışma Sıcaklığı Normal',
        color: 'green',
        isAlarm: false
      };
    }

    getTroubleshootingAdvice(dcEvaluation, regenEvaluation, tempEvaluation) {
      const tips = [];

      if (dcEvaluation.status === 'OVERVOLTAGE' || dcEvaluation.status === 'WARNING') {
        tips.push('⚡ Spindle yavaşlama / durma rampasını (Deceleration Time) CNC parametrelerinden uzatın.');
        tips.push('⚡ Pano arkasındaki harici deşarj direncinin (Braking Resistor) ohm değerini ve termik kontağını ölçün.');
        tips.push('⚡ Fabrika ana trafosunun kademe voltajını (200V / 380V AC) multimetre ile kontrol edin.');
      }

      if (dcEvaluation.status === 'UNDERVOLTAGE') {
        tips.push('🔌 PSM ana kontaktörünün (MCC) çekili olduğunu ve 3 faz AC giriş sigortalarını kontrol edin.');
        tips.push('🔌 Fabrika şebekesinde kompresör veya pres devreye girdiğindeki anlık voltaj çökmesini inceleyin.');
      }

      if (regenEvaluation.status === 'OVERHEAT_RISK') {
        tips.push('🔥 Parça işleme programındaki sık dur-kalk (rapid cycle) operasyonlarını optimize edin.');
        tips.push('🔥 Frenleme direncinin soğutma fanının çalıştığından ve hava kanalının tıkalı olmadığından emin olun.');
      }

      if (tempEvaluation.status === 'HOT' || tempEvaluation.status === 'WARM') {
        tips.push('🌡️ Elektrik panosu klima ünitesinin (Pano Soğutucu) filtresini temizleyin.');
        tips.push('🌡️ PSM güç modülü arkasındaki dahili soğutma fanının döndüğünü teyit edin.');
      }

      if (!tips.length) {
        tips.push('✓ Tüm güç elektroniği ve DC bara parametreleri ideal çalışma aralığındadır.');
      }

      return tips;
    }
  }

  global.MTBPowerDiagnostics = PowerDiagnostics;
  global.powerDiagnostics = new PowerDiagnostics();
})(typeof window !== 'undefined' ? window : globalThis);
