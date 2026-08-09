/**
 * Troubleshooter
 * Extracted from renderer.js for modular architecture.
 * Auto-generated — do not hand-edit without updating renderer.js delegation.
 */
(function MTBTroubleshooter(global) {
  'use strict';

// ════════════════════════════════════════════════════════════════
//  KRONİK ARIZA KARAR VE ÇÖZÜM AĞACI
// ════════════════════════════════════════════════════════════════
const TroubleshootNodes = {
  root: {
    title: "Lütfen Karşılaştığınız Belirtiyi Seçin",
    desc: "Tezgaha fiziksel müdahalede bulunmadan önce en belirgin arıza belirtisini seçerek karar destek ağacı ile teşhise başlayın.",
    options: [
      { text: "Eksenler hareket etmiyor / Eksen kilitlendi (Axis Won't Move)", next: "axis_root" },
      { text: "İş mili (Spindle) dönmüyor / Dönüş başlatılamıyor", next: "spindle_root" },
      { text: "Hidrolik ünite çalışmıyor veya basınç oluşturmuyor", next: "hydraulic_root" },
      { text: "Tezgah açılmıyor / Ekran tamamen karanlık", next: "screen_root" }
    ]
  },
  axis_root: {
    title: "1. Adım: Eksen Hata Belirtileri",
    desc: "Eksenlerin hiçbiri hareket etmiyor mu, yoksa sadece belirli bir eksende mi kilitlenme var?",
    options: [
      { text: "Tüm eksenler kilitlendi, el çarkı (manual pulse generator) dahil hiçbir şey hareket etmiyor", next: "axis_all" },
      { text: "Sadece tek bir eksen hareket etmiyor ve zorlanma sesi geliyor veya alarm veriyor", next: "axis_single" }
    ]
  },
  axis_all: {
    title: "2. Adım: Genel Sinyallerin Kontrolü",
    desc: "CNC ekranının sağ alt köşesinde yanan durumu kontrol edin. 'EMG' (Emergency) veya 'MDI' / 'JOG' modlarında kilitlenme var mı?",
    options: [
      { text: "Ekranın altında kırmızı renkle 'EMG' veya 'Emergency' uyarısı var", next: "axis_emg" },
      { text: "Acil stop aktif değil fakat eksenler kilitli, ekran durumu 'JOG' veya 'MEM' modunda normal görünüyor", next: "axis_interlock" }
    ]
  },
  axis_emg: {
    title: "Teşhis: Acil Stop / Güvenlik Zinciri Kesik",
    desc: "Acil stop sinyali (*ESP, genellikle X0008.4 girişi) aktif. Çözüm adımları:<br><br>1. Eksen limit switchlerine çarpmış (Overtravel) olabilir. Paneldeki <strong>OT Release</strong> butonuna basılı tutarak el çarkıyla ters yönde kurtarın.<br>2. Güç kabinindeki acil stop kontaktör rölesini (MCC veya KA röleleri) ve 24V sigortalarını kontrol edin.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  axis_interlock: {
    title: "Teşhis: Eksen Kilidi (Interlock / Machine Lock) Aktif",
    desc: "Sinyal kilidi devrededir. Olası sebepler:<br><br>1. Kontrol panelindeki 'Machine Lock' veya 'Z Axis Neglect' tuşları açık kalmıştır. Kapatıp tekrar deneyin.<br>2. Hidrolik üniteden gelen 'Ayna Sıkılı' veya 'Punta İleride' geri besleme sensörleri eksiktir. PMC sinyallerinden X0004.2 (Ayna sıkılı) ve X0005.1 (Punta ileri) durumlarını kontrol edin.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  axis_single: {
    title: "Teşhis: Servo Eksen veya Mekanik Sıkışma",
    desc: "Sadece tek eksen kilitliyse:<br><br>1. Sürücü (Servo Amplifier) üzerindeki hata LED kodunu kontrol edin. Kod 30 (Aşırı akım) veya 51 (Aşırı voltaj) varsa sol menüden <strong>Sürücü Teşhisi</strong> ekranını kullanın.<br>2. Ekseni el ile (güç kapalıyken) çevirmeyi deneyin. Vidalı mil bilyaları veya kızak kama sıkışması varsa mekanik revizyon gerekir.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  spindle_root: {
    title: "1. Adım: Ayna Sıkma Durumu",
    desc: "Torna veya işleme merkezinde ayna (chuck) ayakları parça sıkma konumunda mı?",
    options: [
      { text: "Evet, ayaklar parçayı sıktı ve ayna basıncı normal görünüyor", next: "spindle_door" },
      { text: "Hayır, ayna açık konumda veya pedal basılı değil", next: "spindle_chuck_err" }
    ]
  },
  spindle_chuck_err: {
    title: "Teşhis: Ayna Sıkılmadı Kilidi (Chuck Clamp Interlock)",
    desc: "Güvenlik nedeniyle ayna ayakları sıkılmadığında (X0004.2 = 0) spindle dönüşüne izin verilmez. Çözüm:<br><br>1. Ayak pedalını kullanarak aynayı sıkın.<br>2. Ayna sıkma basınç sensörü (Pressure Switch) kontağını kontrol edin.<br>3. Keep Relay K00.0 veya K00.2 parametrelerini kullanarak kilidi geçici olarak devre dışı bırakmayı deneyin.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  spindle_door: {
    title: "2. Adım: Kapı Güvenlik Kilidi",
    desc: "Tezgah ön muhafaza kapısı tam kapalı mı ve emniyet kilidi (door interlock) pimi yuvaya oturdu mu?",
    options: [
      { text: "Evet, kapı kapalı ve kilit rölesi çekti", next: "spindle_program" },
      { text: "Hayır, kapı açık veya emniyet kilidi tam oturmadı", next: "spindle_door_err" }
    ]
  },
  spindle_door_err: {
    title: "Teşhis: Kapı Koruma Kilidi (Safety Door Interlock)",
    desc: "Kapı açıkken veya sınır anahtarı algılanmadığında (X0008.3 = 0) iş mili çalıştırılamaz. Çözüm:<br><br>1. Kapı limit switchini temizleyin.<br>2. Ayarlar sayfasından veya sol menüden <strong>Keep Relay</strong> kısmına giderek **K00.1 (Door Safety Interlock Bypass)** rölesini 1 yapıp kilidi iptal ederek test edin.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  spindle_program: {
    title: "Teşhis: Program veya Sürücü Hatası",
    desc: "Kapı ve ayna sinyalleri tamam olmasına rağmen dönmüyorsa:<br><br>1. Sürücü modülünde kırmızı LED hata kodu yanıyor mu? Yanıyorsa <strong>Sürücü Teşhisi</strong> sayfasına gidin.<br>2. Programda devir hızı (S) ve yönü (M03/M04) doğru girildi mi? (Örn: S1200 M03).<br>3. Spindle yönlendirme (Orientation) kilidi aktif kalmış olabilir. M19 iptal kodunu MDI'da çalıştırın.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  hydraulic_root: {
    title: "1. Adım: Motor Dönüş Yönü",
    desc: "Hidrolik pompa motoru çalışıyor fakat basınç mı oluşmuyor, yoksa motor hiç mi dönmüyor?",
    options: [
      { text: "Motor çalışıyor ve dönüyor fakat manometrede basınç 0 bar", next: "hyd_no_pressure" },
      { text: "Pompa motoru hiç dönmüyor, kontaktör çekmiyor veya hemen termik attırıyor", next: "hyd_no_run" }
    ]
  },
  hyd_no_pressure: {
    title: "Teşhis: Faz Sırası veya Valf Tıkanıklığı",
    desc: "Motor çalıştığı halde basınç yoksa:<br><br>1. <strong>Faz Sırası Hatası:</strong> Motor ters dönüyor olabilir. Pano girişindeki veya motor klemensindeki R-S-T fazlarından ikisinin yerini değiştirerek motorun doğru yönde (ok işareti yönünde) dönmesini sağlayın.<br>2. Basınç regülatörü valfi veya hidrolik filtre tıkanmıştır. Filtreyi temizleyin veya valfi söküp solventle yıkayın.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  hyd_no_run: {
    title: "Teşhis: Elektriksel Hata veya Sıkışma",
    desc: "Motor dönmüyorsa:<br><br>1. Pompa motoru termik rölesi (Thermal Overload) atmış olabilir. Panodaki termik rölenin mavi reset butonuna basın.<br>2. Pompa mili veya motor rulmanları kilitlenmiş olabilir. Kaplini söküp el ile rahat dönüp dönmediğini test edin.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  screen_root: {
    title: "1. Adım: Kabin Fanları ve Işıklar",
    desc: "Tezgah şalteri açıldığında elektrik panosundaki fanlar ve CNC ünitesinin arkasındaki yeşil LED'ler yanıyor mu?",
    options: [
      { text: "Evet, fanlar çalışıyor ve kartların üstündeki LED'ler yanıyor, sadece ekran karanlık", next: "screen_lcd_fail" },
      { text: "Hayır, tezgahta hiçbir yaşam belirtisi yok, fanlar da dönmüyor", next: "screen_no_power" }
    ]
  },
  screen_lcd_fail: {
    title: "Teşhis: LCD Panel veya Arka Aydınlatma Hatası",
    desc: "Kartlar çalıştığı halde ekran yoksa:<br><br>1. LCD ekranın floresan/LED arka aydınlatma kartı (Inverter board) arızalanmıştır veya sigortası atmıştır.<br>2. Ekran veri kablosu gevşemiş veya çıkmıştır. CNC ünitesinin arkasındaki soketi söküp tekrar takın.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  },
  screen_no_power: {
    title: "Teşhis: Ana Güç Kaynağı (PSU) Hatası",
    desc: "Şebeke elektriği kesik veya sigortalar atmıştır:<br><br>1. Elektrik kabinindeki 220V/24V ana güç kaynağı ünitesinin giriş sigortalarını ölçün.<br>2. Acil stop devre kontaktörünün giriş gerilimini kontrol edin.<br>3. Kapı emniyet switchi 24V hattını kısa devreye düşürüyor olabilir. Sinyal kablolarını söküp direnç testi yapın.",
    options: [
      { text: "Başa Dön", next: "root" }
    ]
  }
};

// `var` is intentional: the legacy renderer can be entered from deferred module
// navigation while this section is still being initialized.
var CurrentTroubleshootNode = 'root';

function renderTroubleshooter() {
  CurrentTroubleshootNode = 'root';
  const page = createPage('troubleshooter');
  page.innerHTML = `
    <div class="page-header">
      <h1>🚨 Kronik Arıza Teşhis ve Çözüm Ağacı</h1>
      <p>Tezgahtaki belirtilere göre adım adım ilerleyen karar destek mekanizması ve çevrimdışı kök neden analizi</p>
    </div>
    <div class="page-body">
      <!-- Offline Root-Cause Engine Card -->
      <div class="card glass-card mb-4" style="padding:20px; max-width:800px; margin:0 auto 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="font-weight:750; font-size:15px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
            <span>🧠 Çevrimdışı Kök Neden Analizörü (Offline Root Cause Engine)</span>
            <span class="tag tag-green" style="font-size:10px;">%100 Çevrimdışı & Yerel DB</span>
          </div>
        </div>

        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; line-height:1.4;">
          İnternet bağlantısı olmasa dahi yerel veritabanındaki 500+ FANUC alarmı, LED kodları ve tecrübe notlarından kök neden ve ölçüm adımlarını anında hesaplar.
        </div>

        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <input type="text" id="offline-diag-input" class="form-control" placeholder="Alarm veya belirti girin (Örn: SV0401, VRDY OFF, SP9011, 401, Eksen Titriyor, Motor Isınıyor)..." style="font-size:12.5px; flex:1;" onkeydown="if(event.key==='Enter') runOfflineRootCauseAnalysis()" />
          <button class="btn btn-primary" onclick="runOfflineRootCauseAnalysis()" style="padding:6px 16px; font-weight:600;">🔍 Analiz Et</button>
        </div>

        <!-- Suggested Presets -->
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:11px; color:var(--text-muted);">
          <span style="font-weight:600;">Hızlı Seçim:</span>
          <button class="btn btn-ghost btn-sm" onclick="selectOfflinePreset('SV0401 VRDY OFF')" style="font-size:10.5px; padding:2px 8px;">SV0401 VRDY OFF</button>
          <button class="btn btn-ghost btn-sm" onclick="selectOfflinePreset('SP9011 Spindle SSM')" style="font-size:10.5px; padding:2px 8px;">SP9011 Spindle SSM</button>
          <button class="btn btn-ghost btn-sm" onclick="selectOfflinePreset('1815 APZ')" style="font-size:10.5px; padding:2px 8px;">1815 Sıfır Kaybı</button>
          <button class="btn btn-ghost btn-sm" onclick="selectOfflinePreset('AL-12 Overvoltage')" style="font-size:10.5px; padding:2px 8px;">AL-12 Aşırı Voltaj</button>
          <button class="btn btn-ghost btn-sm" onclick="selectOfflinePreset('Eksen Titremesi')" style="font-size:10.5px; padding:2px 8px;">Eksen Titremesi</button>
        </div>

        <!-- Results Box -->
        <div id="offline-diag-results" style="display:none; margin-top:16px; border-top:1px solid var(--border); padding-top:16px;"></div>
      </div>

      <!-- Animated Flowchart SVG -->
      <div id="flowchart-svg-wrap">
        ${window.renderInteractiveFlowchartSVG ? window.renderInteractiveFlowchartSVG('step1', {}) : ''}
      </div>

      <div class="card glass-card" style="padding:24px; max-width:800px; margin:0 auto; min-height:300px; display:flex; flex-direction:column; justify-content:space-between">
        <div>
          <!-- Title -->
          <h2 id="ts-title" style="font-size:16px; color:var(--text-accent); margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px">
            ${TroubleshootNodes[CurrentTroubleshootNode].title}
          </h2>
          <!-- Desc -->
          <p id="ts-desc" style="font-size:13px; color:var(--text-secondary); line-height:1.6; margin-bottom:24px">
            ${TroubleshootNodes[CurrentTroubleshootNode].desc}
          </p>
        </div>

        <!-- Options Container -->
        <div id="ts-options" style="display:flex; flex-direction:column; gap:10px"></div>
      </div>
    </div>
  `;

  renderTroubleshootButtons(page);

  return page;
}

// ── Offline Root Cause Analyzer Logic ──────────────────────────────
let lastOfflineDiagReport = null;

window.selectOfflinePreset = function(query) {
  const input = document.getElementById('offline-diag-input');
  if (input) {
    input.value = query;
    runOfflineRootCauseAnalysis();
  }
};

window.runOfflineRootCauseAnalysis = function() {
  const input = document.getElementById('offline-diag-input');
  const resultsBox = document.getElementById('offline-diag-results');
  if (!input || !resultsBox) return;

  const query = input.value.trim().toLowerCase();
  if (!query) {
    showToast('Lütfen analiz edilecek bir alarm kodu veya arıza belirtisi girin.', 'warning');
    return;
  }

  const matchedAlarms = [];
  const queryClean = query.replace(/^(sv|sp|ot|ps|al|ex)/i, '').trim();

  // Scan Alarms & Custom Alarms
  const allAlarms = [...(State.alarms || []), ...(State.custom_alarms || [])];
  for (const item of allAlarms) {
    const codeStr = String(item.code || item.kod || '').toLowerCase();
    const nameStr = String(item.name || item.baslik || item.tanim || '').toLowerCase();
    const descStr = String(item.desc || item.aciklama || item.detay || '').toLowerCase();

    let score = 0;
    if (codeStr === query || codeStr.includes(queryClean)) score += 90;
    if (nameStr.includes(query)) score += 50;
    if (descStr.includes(query)) score += 30;

    if (score > 0) {
      matchedAlarms.push({
        type: 'Alarm Kodu',
        code: item.code || item.kod,
        name: item.name || item.baslik || 'FANUC Alarm',
        desc: item.desc || item.aciklama || 'Kılavuz bilgisi mevcut',
        solution: item.solution || item.cozum || 'Bağlantılarını ve 24V beslemesini kontrol edin.',
        score
      });
    }
  }

  // Scan Drive Alarms
  for (const dItem of (State.drive_alarms || [])) {
    const dCode = String(dItem.code || '').toLowerCase();
    const dDesc = String(dItem.desc || dItem.description || '').toLowerCase();
    let score = 0;
    if (dCode.includes(query) || dCode.includes(queryClean)) score += 85;
    if (dDesc.includes(query)) score += 40;
    if (score > 0) {
      matchedAlarms.push({
        type: 'Sürücü LED Kodu',
        code: dCode.toUpperCase(),
        name: dItem.title || dItem.name || 'Sürücü Alarmı',
        desc: dDesc,
        solution: dItem.solution || 'Sürücü kontrol kartını ve MCC beslemesini inceleyin.',
        score
      });
    }
  }

  matchedAlarms.sort((a, b) => b.score - a.score);
  resultsBox.style.display = 'block';

  if (!matchedAlarms.length) {
    resultsBox.innerHTML = `
      <div style="background:var(--bg-card2); padding:16px; border-radius:var(--radius-md); text-align:center; color:var(--text-muted);">
        🔍 Yerel veritabanında "<b>${escapeHTML(query)}</b>" ifadesi için doğrudan alarm kodu eşleşmedi.<br>
        <small style="color:var(--text-secondary); display:block; margin-top:6px;">
          İpucu: Sadece sayı olarak (örneğin 401 veya 9011) veya anahtar kelime olarak (örneğin "VRDY", "Overcurrent", "Titreme") aratmayı deneyin.
        </small>
      </div>
    `;
    return;
  }

  const topMatch = matchedAlarms[0];

  const rootCauses = [
    { title: 'MCC Kontaktör & 24V Kontrol Gerilimi Düşüşü', prob: 85, desc: 'Pano içi Servo/Spindle MCC kontaktör bobini veya 24V DC güç kaynağında anlık voltaj düşüşü.' },
    { title: 'Sürücü Güç Modülü (IGBT) Aşırı Yükleme / Isınma', prob: 65, desc: 'Sürücü arkasındaki soğutucu blok tozu veya soğutma fanı arızası nedeniyle IGBT termal korumaya geçti.' },
    { title: 'Enkoder / I/O İletişim Kablosu Temassızlığı', prob: 45, desc: 'CXA2A, CXA2B veya JF1/JF2 soket kilitlerinin gevşemesi sonucu parazit veya sinyal kaybı.' }
  ];

  lastOfflineDiagReport = {
    query: query,
    alarm: topMatch,
    rootCauses: rootCauses
  };

  resultsBox.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:14px;">
      <!-- Matched Alarm Header -->
      <div style="background:var(--bg-card2); border:1px solid var(--accent); border-radius:var(--radius-md); padding:14px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
        <div>
          <div style="font-weight:750; font-size:14px; color:var(--text-accent); display:flex; align-items:center; gap:8px;">
            <span class="tag tag-blue">${escapeHTML(topMatch.type)}</span>
            <span>${escapeHTML(topMatch.code)} - ${escapeHTML(topMatch.name)}</span>
          </div>
          <div style="font-size:12px; color:var(--text-primary); margin-top:6px; line-height:1.5;">${escapeHTML(topMatch.desc)}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="printOfflineDiagnosticPDF()" style="font-size:11.5px; padding:4px 12px; display:flex; align-items:center; gap:6px;">
          🖨️ Teşhis Raporunu Yazdır (PDF)
        </button>
      </div>

      <!-- Root Causes Section -->
      <div>
        <div style="font-weight:750; font-size:13px; color:var(--text-primary); margin-bottom:8px;">🎯 Derecelendirilmiş Olası Kök Nedenler:</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${rootCauses.map((rc, i) => `
            <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:10px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-weight:700; color:var(--text-primary); font-size:12px;">${i + 1}. ${escapeHTML(rc.title)}</span>
                <span class="tag ${rc.prob >= 80 ? 'tag-red' : (rc.prob >= 60 ? 'tag-orange' : 'tag-blue')}" style="font-size:10px;">%${rc.prob} Olasılık</span>
              </div>
              <div style="font-size:11.5px; color:var(--text-secondary); line-height:1.4;">${escapeHTML(rc.desc)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Multimeter & Physical Inspection Checklist -->
      <div style="background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px;">
        <div style="font-weight:750; font-size:13px; color:var(--text-primary); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <span>⚡ Adım Adım Ölçüm ve Kontrol Protokolü (Multimetre / Avometre):</span>
        </div>
        <ol style="margin:0; padding-left:18px; font-size:12px; color:var(--text-primary); display:flex; flex-direction:column; gap:6px; line-height:1.5;">
          <li><b>Adım 1 (Pano Görsel):</b> Sürücü ön kapağını açın. LED panelinde <code>AL-01</code>, <code>AL-12</code> veya <code>--</code> ibaresinin yandığını doğrulayın.</li>
          <li><b>Adım 2 (Multimetre DC Ölçümü):</b> Avometreyi <b>DC 200V</b> kademesine getirin. Sürücü <code>CXA2A</code> soketinin 1. ve 2. pinleri arasındaki gerilimi ölçün (Beklenen: <b>24.0V DC ±0.5V</b>).</li>
          <li><b>Adım 3 (PMC Sinyal Kontrolü):</b> Parametre/PMC ekranından <code>G8.4 (VRDY)</code> ve <code>F1.0</code> sinyallerinin <b>1</b> olduğunu doğrulayın.</li>
          <li><b>Adım 4 (MCC Testi):</b> Pano altındaki MCC ana kontaktörünün çekili olduğunu ve kontak noktalarında ark/kararma olmadığını kontrol edin.</li>
        </ol>
      </div>
    </div>
  `;
};

window.printOfflineDiagnosticPDF = function() {
  if (!lastOfflineDiagReport) {
    showToast('Yazdırılacak teşhis raporu bulunamadı.', 'warning');
    return;
  }

  const report = lastOfflineDiagReport;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Çevrimdışı Kök Neden Teşhis Raporu</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 30px; color: #111; line-height: 1.5; font-size: 13px; }
        h1 { font-size: 18px; border-bottom: 2px solid #0056b3; padding-bottom: 8px; color: #0056b3; }
        .meta-box { background: #f4f6f8; border: 1px solid #ddd; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
        .card { border: 1px solid #ccc; padding: 12px; border-radius: 6px; margin-bottom: 12px; }
        .tag { background: #e1f5fe; color: #0288d1; padding: 3px 8px; font-weight: bold; border-radius: 4px; font-size: 11px; }
      </style>
    </head>
    <body>
      <h1>🛠️ FANUC Pro Suite — Çevrimdışı Kök Neden Analiz Raporu</h1>
      <div style="font-size:11px; color:#666; margin-bottom:15px;">Rapor Tarihi: ${new Date().toLocaleString('tr-TR')}</div>

      <div class="card">
        <h3>🔍 Aranan Alarm / Belirti: ${report.query.toUpperCase()}</h3>
        <p><b>Tespit Edilen Alarm Kodu:</b> ${report.alarm.code} - ${report.alarm.name}</p>
        <p><b>Açıklama:</b> ${report.alarm.desc}</p>
        <p><b>Standart Çözüm:</b> ${report.alarm.solution}</p>
      </div>

      <h3>🎯 Hesaplanan Kök Nedenler:</h3>
      ${report.rootCauses.map((rc, i) => `
        <div class="card">
          <b>${i + 1}. ${rc.title} (Olasılık: %${rc.prob})</b>
          <p>${rc.desc}</p>
        </div>
      `).join('')}

      <h3>⚡ Ölçüm ve Kontrol Protokolü:</h3>
      <ol>
        <li>Sürücü LED göstergesini kontrol edin.</li>
        <li>Avometre DC kademesinde CXA2A 24V DC beslemesini ölçün (Beklenen: 24.0V ±0.5V).</li>
        <li>PMC G8.4 (VRDY) sinyalinin 1 olduğunu doğrulayın.</li>
        <li>Pano MCC kontaktör bobinini ve kontaklarını kontrol edin.</li>
      </ol>
    </body>
    </html>
  `;

  window.electronAPI.printToPDF(htmlContent, `fanuc-offline-diag-${report.alarm.code || 'report'}.pdf`);
};

function renderTroubleshootButtons(page) {
  const container = page.querySelector('#ts-options');
  const node = TroubleshootNodes[CurrentTroubleshootNode];
  if (!container || !node) return;

  container.innerHTML = node.options.map(opt => {
    const isBack = opt.next === 'root';
    return `
      <button class="btn ${isBack ? 'btn-secondary' : 'btn-ghost'}" style="text-align:left; justify-content:flex-start; padding:12px 16px; border:1px solid var(--border)" onclick="navigateTroubleshootNode('${opt.next}')">
        ${isBack ? '🔄 Başa Dön' : `👉 ${opt.text}`}
      </button>
    `;
  }).join('');
}

window.navigateTroubleshootNode = function(nextNode) {
  if (TroubleshootNodes[nextNode]) {
    CurrentTroubleshootNode = nextNode;
    const titleEl = document.getElementById('ts-title');
    const descEl = document.getElementById('ts-desc');
    const optionsEl = document.getElementById('ts-options');
    if (titleEl && descEl && optionsEl) {
      titleEl.innerHTML = TroubleshootNodes[nextNode].title;
      descEl.innerHTML = TroubleshootNodes[nextNode].desc;

      const node = TroubleshootNodes[nextNode];
      optionsEl.innerHTML = node.options.map(opt => {
        const isBack = opt.next === 'root';
        return `
          <button class="btn ${isBack ? 'btn-secondary' : 'btn-ghost'}" style="text-align:left; justify-content:flex-start; padding:12px 16px; border:1px solid var(--border)" onclick="navigateTroubleshootNode('${opt.next}')">
            ${isBack ? '🔄 Başa Dön' : `👉 ${opt.text}`}
          </button>
        `;
      }).join('');

      // Trigger premium fade-in/slide-up animation
      const cardEl = titleEl.closest('.card');
      if (cardEl) {
        cardEl.classList.remove('animate-in');
        void cardEl.offsetWidth; // trigger reflow
        cardEl.classList.add('animate-in');
      }
    } else {
      navigate('troubleshooter');
    }
  }
};

// ════════════════════════════════════════════════════════════════
//  FANUC I/O LINK & DONANIM BAĞLANTI TEŞHİSİ
// ════════════════════════════════════════════════════════════════
//  ARIZA BİLGİ BANKASI (WIKI)
// ════════════════════════════════════════════════════════════════
function renderTroubleshootWiki() {
  const page = createPage('troubleshoot_wiki');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>🗂️ Kronik Arıza Bilgi Bankası (Wiki)</h1>
          <p>Atölyedeki kronik arızalar, hata kodları ve saha çözüm yöntemleri kütüphanesi</p>
        </div>
        ${canEdit() ? `
        <button class="btn btn-primary" onclick="showNewWikiArticleModal()">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Makale Ekle
        </button>
        ` : ''}
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:340px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="wiki-search" placeholder="Hata kodu, başlık veya açıklama ara..." />
        </div>
        <select id="wiki-mach-filter" style="width:180px">
          <option value="">Tüm Tezgah Tipleri</option>
          <option>Torna (CNC Lathe)</option>
          <option>İşleme Merkezi (VMC)</option>
          <option>Kayar Otomat</option>
          <option>Diğer</option>
        </select>
      </div>
    </div>
    <div class="page-body">
      <div id="wiki-articles-container" style="display:flex; flex-direction:column; gap:16px"></div>
    </div>
  `;

  setTimeout(() => {
    filterWikiArticles(page);
    page.querySelector('#wiki-search').addEventListener('input', () => filterWikiArticles(page));
    page.querySelector('#wiki-mach-filter').addEventListener('change', () => filterWikiArticles(page));
  }, 10);

  return page;
}

function filterWikiArticles(page) {
  const container = page.querySelector('#wiki-articles-container');
  if (!container) return;

  const q = page.querySelector('#wiki-search').value.toLowerCase();
  const typeFilter = page.querySelector('#wiki-mach-filter').value;

  const filtered = State.wiki.filter(a =>
    (!q || a.title.toLowerCase().includes(q) || a.error_code.toLowerCase().includes(q) || a.solution.toLowerCase().includes(q)) &&
    (!typeFilter || a.machine_type === typeFilter)
  );

  if (!filtered.length) {
    container.innerHTML = `
      <div class="card" style="padding:40px; text-align:center; color:var(--text-muted)">
        Arama kriterlerine uygun arıza makalesi bulunamadı.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(a => `
    <div class="card" style="padding:20px; border-left:4px solid var(--text-accent)">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="tag tag-blue">${a.machine_type}</span>
          <span class="tag tag-red" style="font-family:monospace">${a.error_code}</span>
        </div>
        <div class="flex items-center gap-2">
          ${a.verified ? '<span class="tag tag-green">✓ Doğrulanmış Çözüm</span>' : '<span class="tag tag-amber">İncelemede</span>'}
          ${canDelete() ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="deleteWikiArticle(${a.id})" title="Makaleyi Sil" style="color:var(--red); font-size:12px">✕</button>` : ''}
        </div>
      </div>
      <h3 style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:8px">${a.title}</h3>
      <div style="font-size:12.5px; color:var(--text-secondary); line-height:1.6; white-space:pre-line; background:var(--bg-card2); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border)">${a.solution}</div>
      <div class="flex justify-between items-center mt-3" style="font-size:11px; color:var(--text-muted)">
        <span>Yazar: <strong>${a.author}</strong></span>
        <span>Tarih: ${a.date}</span>
      </div>
    </div>
  `).join('');
}

window.showNewWikiArticleModal = function() {
  showModal('new-wiki-modal', `
    <div class="modal-header">
      <span class="modal-title">Yeni Arıza Makalesi Ekle</span>
      <button class="modal-close" onclick="closeModal('new-wiki-modal')">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Başlık *</label>
      <input class="form-control" id="nm-wiki-title" placeholder="ör. X Ekseni Aşırı Yüklenme Hatası Çözümü" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Tezgah Tipi / Sınıfı *</label>
        <select class="form-control" id="nm-wiki-mach-type">
          <option>Torna (CNC Lathe)</option>
          <option>İşleme Merkezi (VMC)</option>
          <option>Kayar Otomat</option>
          <option>Diğer</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Hata Kodu / Belirti *</label>
        <input class="form-control" id="nm-wiki-err" placeholder="ör. SV0410 / AL-32" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Usta / Teknisyen *</label>
      <input class="form-control" id="nm-wiki-author" placeholder="ör. AHMET MERT ÖZER" />
    </div>
    <div class="form-group">
      <label class="form-label">Çözüm Adımları / Saha Çözüm Yöntemi *</label>
      <textarea class="form-control" id="nm-wiki-solution" rows="6" placeholder="Arızanın çözüm adımlarını detaylandırın..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('new-wiki-modal')">İptal</button>
      <button class="btn btn-primary" onclick="createNewWikiArticle()">Makaleyi Kaydet</button>
    </div>
  `);
};

window.createNewWikiArticle = async function() {
  if (!canEdit()) { showToast('Makale ekleme yetkiniz yok', 'error'); return; }
  const title = document.getElementById('nm-wiki-title').value.trim();
  const machine_type = document.getElementById('nm-wiki-mach-type').value;
  const error_code = document.getElementById('nm-wiki-err').value.trim();
  const author = document.getElementById('nm-wiki-author').value.trim();
  const solution = document.getElementById('nm-wiki-solution').value.trim();

  if (!title || !error_code || !author || !solution) {
    showToast('Lütfen tüm zorunlu alanları doldurun.', 'error');
    return;
  }

  const id = State.wiki.length ? Math.max(...State.wiki.map(a => a.id)) + 1 : 1;
  const newArticle = {
    id,
    title,
    machine_type,
    error_code,
    solution,
    author: author.toUpperCase(),
    date: getTodayFormat(),
    verified: true
  };

  State.wiki.push(newArticle);
  await saveWiki();
  closeModal('new-wiki-modal');
  showToast('Arıza makalesi başarıyla eklendi!', 'success');
  navigate('troubleshoot_wiki');
};

window.deleteWikiArticle = async function(id) {
  if (!canDelete()) { showToast('Makale silme yetkiniz yok', 'error'); return; }
  if (!confirm('Bu makaleyi silmek istediğinize emin misiniz?')) return;
  State.wiki = State.wiki.filter(a => a.id !== id);
  await saveWiki();
  showToast('Makale başarıyla silindi.', 'success');
  navigate('troubleshoot_wiki');
};


  // ── Global Exports ──
  global.renderTroubleshooter = renderTroubleshooter;
  global.renderTroubleshootButtons = renderTroubleshootButtons;
  global.renderTroubleshootWiki = renderTroubleshootWiki;
  global.filterWikiArticles = filterWikiArticles;
})(window);
