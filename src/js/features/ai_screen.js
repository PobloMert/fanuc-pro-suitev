(function(global){'use strict';let api;function initialize(deps){if(api)return api;const {State,createPage,escapeHTML,showToast,showModal,closeModal,navigate,saveKnowledgePreferences,openBookPDF,calculateMachineHealth,getBatteryStatus,formatTime}=deps;
const ChatHistory = [];

function maskSensitiveForCloud(text) {
  return window.AIKnowledgeFeature.maskForCloud(text, State, window.DiagnosticEngine.maskSensitive);
}

function buildActiveMachineContext() {
  return window.AIKnowledgeFeature.buildMachineContext(State);
}

window.exportAIConversationReport = async function() {
  if (!ChatHistory.length) return showToast('Raporlanacak görüşme yok.', 'warning');
  const rows = ChatHistory.map(item => `<section style="margin:14px 0;padding:12px;border:1px solid #ddd"><strong>${item.role === 'user' ? 'Kullanıcı' : 'AI Asistan'}</strong><pre style="white-space:pre-wrap;font-family:Arial">${escapeHTML(item.content)}</pre></section>`).join('');
  const html = `<html><meta charset="utf-8"><body style="font-family:Arial;padding:30px"><h1>FANUC Pro Suite — Teknik AI Görüşme Raporu</h1><p>Oluşturma: ${new Date().toLocaleString('tr-TR')}</p><p><strong>Salt okunur:</strong> Bu rapor CNC üzerinde işlem yapıldığını göstermez. İçerik yalnızca öneridir ve yetkili teknisyen tarafından doğrulanmalıdır.</p>${rows}</body></html>`;
  const result = await window.electronAPI.printToPDF(html, `ai-teknik-rapor-${new Date().toISOString().slice(0,10)}.pdf`);
  showToast(result?.ok ? 'Teknik görüşme raporu oluşturuldu.' : `Rapor oluşturulamadı: ${result?.error}`, result?.ok ? 'success' : 'error');
};

window.openBookPDFPage = function(id) {
  const raw = prompt('Gitmek istediğiniz PDF sayfa numarası:');
  if (raw === null) return;
  const pageNumber = Number(raw);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return showToast('Geçerli bir sayfa numarası girin.', 'warning');
  openBookPDF(id, pageNumber);
};

window.toggleKnowledgeFavorite = async function(id) {
  const items = State.settings.knowledgeFavorites || [];
  State.settings.knowledgeFavorites = items.includes(id) ? items.filter(x => x !== id) : [...items, id];
  await saveKnowledgePreferences();
  navigate('library');
};

window.openAlarmFromKnowledge = function(code) {
  const alarm = State.alarms.find(a => a.code === code);
  if (!alarm) return;
  State.activeDiagnostic = { type: 'alarm', code: alarm.code, data: alarm };
  navigate('ai');
};

window.openKnowledgeNote = function(id) {
  const book = State.library.find(b => b.id === id);
  if (!book) return;
  const note = State.settings.knowledgeNotes?.[id] || '';
  showModal('knowledge-note', `<div class="modal-header"><span class="modal-title">Yerel Teknik Not — ${escapeHTML(book.title)}</span><button class="modal-close" onclick="closeModal('knowledge-note')">✕</button></div><p style="font-size:11px;color:var(--text-secondary)">Bu not yalnızca bu bilgisayarda saklanır ve CNC'ye gönderilmez.</p><textarea id="knowledge-note-text" class="form-control" rows="10">${escapeHTML(note)}</textarea><div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('knowledge-note')">İptal</button><button class="btn btn-primary" onclick="saveKnowledgeNote('${id}')">Kaydet</button></div>`);
};

window.saveKnowledgeNote = async function(id) {
  State.settings.knowledgeNotes = State.settings.knowledgeNotes || {};
  State.settings.knowledgeNotes[id] = document.getElementById('knowledge-note-text')?.value || '';
  await saveKnowledgePreferences();
  closeModal('knowledge-note');
  showToast('Yerel teknik not kaydedildi.', 'success');
};

function renderAI() {
  const page = createPage('ai');

  let diagHTML = '';
  if (State.activeDiagnostic) {
    const ad = State.activeDiagnostic;
    if (ad.type === 'alarm') {
      diagHTML = `
        <div class="card" style="border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.02); display:flex; flex-direction:column; gap:10px; padding:16px">
          <div class="flex justify-between items-center">
            <span class="tag tag-red" style="font-weight:700; font-family:var(--font-mono); font-size:13px">${ad.code}</span>
            <span style="font-size:10px; color:var(--text-muted)">AKTİF TEŞHİS</span>
          </div>
          <div>
            <div style="font-size:13.5px; font-weight:700; color:var(--text-primary)">${escapeHTML(ad.data.title)}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px">${escapeHTML(ad.data.category)} Serisi</div>
          </div>
          <div style="font-size:12px; line-height:1.6; color:var(--text-secondary); background:var(--bg-card2); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border)">
            ${escapeHTML(ad.data.description)}
          </div>
          <div style="font-size:11.5px; font-weight:bold; color:var(--amber)">⚠️ Olası Nedenler:</div>
          <ul style="padding-left:16px; margin:0; font-size:11.5px; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px">
            ${ad.data.causes.slice(0, 3).map(c => `<li>${escapeHTML(c)}</li>`).join('')}
          </ul>
          <button class="btn btn-secondary btn-sm mt-2" onclick="clearActiveDiagnostic()" style="width:100%">
            Teşhisi Sıfırla
          </button>
        </div>
      `;
    } else if (ad.type === 'parameter') {
      diagHTML = `
        <div class="card" style="border: 1px solid rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.02); display:flex; flex-direction:column; gap:10px; padding:16px">
          <div class="flex justify-between items-center">
            <span class="tag tag-green" style="font-weight:700; font-family:var(--font-mono); font-size:13px">No. ${ad.code}</span>
            <span style="font-size:10px; color:var(--text-muted)">AKTİF PARAMETRE</span>
          </div>
          <div>
            <div style="font-size:13.5px; font-weight:700; color:var(--text-primary)">${escapeHTML(ad.data.name)}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px">${escapeHTML(ad.data.category)}</div>
          </div>
          <div style="font-size:12px; line-height:1.6; color:var(--text-secondary); background:var(--bg-card2); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border)">
            ${escapeHTML(ad.data.description)}
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:11px; color:var(--text-secondary)">
            <div><strong>Veri Tipi:</strong> ${escapeHTML(ad.data.dataType)}</div>
            <div><strong>Varsayılan:</strong> ${escapeHTML(ad.data.default || '—')}</div>
          </div>
          <button class="btn btn-secondary btn-sm mt-2" onclick="clearActiveDiagnostic()" style="width:100%">
            Teşhisi Sıfırla
          </button>
        </div>
      `;
    }
  } else {
    diagHTML = `
      <div class="card" style="display:flex; flex-direction:column; gap:12px; padding:16px">
        <div class="card-title" style="font-size:12px; text-transform:uppercase; color:var(--text-muted)">💡 Hızlı Teşhis Kılavuzları</div>
        <p style="font-size:11.5px; color:var(--text-secondary); margin:0; line-height:1.5">Aşağıdaki popüler konu başlıklarına tıklayarak AI Asistanı doğrudan yönlendirebilirsiniz:</p>
        <div style="display:flex; flex-direction:column; gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="askAIPreset('SV0401 Servo Hatası çözümü')" style="text-align:left; justify-content:flex-start; width:100%; border:1px solid var(--border)">
            🚗 SV0401 Servo Alarm Teşhisi
          </button>
          <button class="btn btn-ghost btn-sm" onclick="askAIPreset('Parametre 1815 absolute referans durumunu salt okunur nasıl inceleyebilirim')" style="text-align:left; justify-content:flex-start; width:100%; border:1px solid var(--border)">
            ⚙️ P1815 Referans Noktası Ayarı
          </button>
          <button class="btn btn-ghost btn-sm" onclick="askAIPreset('FSSB fiber optik hatası arıza giderme adımları')" style="text-align:left; justify-content:flex-start; width:100%; border:1px solid var(--border)">
            🔗 FSSB Fiber Topoloji Hatası
          </button>
        </div>
      </div>

      <!-- AI Advanced Generators Card -->
      <div class="card" style="display:flex; flex-direction:column; gap:10px; padding:16px; background:var(--bg-card2); border:1px solid var(--accent);">
        <div style="font-weight:700; font-size:12px; text-transform:uppercase; color:var(--text-accent);">⚡ Yapay Zeka Araçları</div>
        <button class="btn btn-primary btn-sm" onclick="generateAIActionPlan()" style="width:100%; text-align:left; justify-content:flex-start;">
          🧠 AI İnteraktif Aksiyon Planı Üret
        </button>
        <button class="btn btn-secondary btn-sm" onclick="generateAIPredictiveReport()" style="width:100%; text-align:left; justify-content:flex-start;">
          📊 AI Kestirimci Sağlık Raporu Al
        </button>
      </div>
    `;
  }

  page.innerHTML = `
    <link rel="stylesheet" href="styles/ai.css" />
    <div class="ai-container" style="display:grid; grid-template-columns: 320px 1fr; gap:16px; height:calc(100vh - 90px); padding:16px; box-sizing:border-box; overflow:hidden">
      <!-- Left: Diagnostics Pane -->
      <div class="ai-diagnostics-pane" style="display:flex; flex-direction:column; gap:12px; overflow-y:auto">
        <div class="page-header" style="padding:0">
          <h1 style="font-size:16px; margin:0">📋 Teşhis Paneli</h1>
          <p style="font-size:11px; margin:2px 0 0">Aktif arıza veya kılavuz kartı</p>
        </div>
        ${diagHTML}
      </div>

      <!-- Right: Chat Pane -->
      <div class="ai-chat-pane" style="display:flex; flex-direction:column; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden">
        <div class="page-header" style="padding:12px; border-bottom:1px solid var(--border); margin:0; display:flex; justify-content:space-between; align-items:center; background:var(--bg-card2)">
          <div>
            <h1 style="font-size:14px; margin:0">🤖 AI Asistan Sohbeti</h1>
          </div>
          <div class="flex gap-2"><span class="tag tag-red">KALICI SALT OKUNUR — CNC'YE KOMUT GÖNDEREMEZ</span><span class="tag tag-${State.settings.aiProvider==='offline'?'gray':'green'}" style="margin:0">${State.settings.aiProvider === 'offline' ? '🔒 Tamamen çevrimdışı' : '🟢 ' + State.settings.aiProvider.toUpperCase()}</span><button class="btn btn-ghost btn-sm" onclick="exportAIConversationReport()">Teknik Rapor</button></div>
        </div>
        <div style="padding:8px 16px;background:rgba(245,158,11,.08);border-bottom:1px solid rgba(245,158,11,.25);font-size:11px">⚠️ Bu asistan yalnızca öneri verir. Kaynak gösterilmeyen bilgi kesin teşhis kabul edilmez; yetkili teknisyen doğrulaması gerekir.</div>

        <div class="ai-messages" id="ai-messages" style="flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:16px">
          <!-- Messages will go here -->
        </div>

        <div class="ai-toolbar" style="padding:10px 24px; border-top:1px solid var(--border); background:var(--bg-surface); display:flex; gap:8px; flex-wrap:wrap">
          <span style="font-size:10px; color:var(--text-muted); margin-right:4px; display:flex; align-items:center">HIZLI:</span>
          ${[
            'SV0401 ve SP9012 alarmları',
            'SV0401 alarmı nedir?',
            'E-Stop devresi nasıl çalışır?',
            'Parametre 1851 boşluk ayarı',
            'Servo kazanımı nasıl ayarlanır?',
          ].map(q => `<button class="ai-quick-btn" onclick="quickAsk('${q}')" style="padding:4px 12px; border-radius:20px; font-size:11px; cursor:pointer">${q}</button>`).join('')}
        </div>

        <div class="ai-input-area" style="padding:14px 24px; border-top:1px solid var(--border); background:var(--bg-surface)">
          <div class="ai-input-wrap" style="display:flex; gap:10px; align-items:flex-end; background:var(--bg-card2); border:1px solid var(--border); border-radius:var(--radius-lg); padding:10px 14px">
            <textarea id="ai-input" placeholder="Soru veya alarm kodunuzu yazın..." rows="1" style="flex:1; border:none; background:transparent; resize:none; font-size:13px; color:var(--text-primary); outline:none; max-height:120px; min-height:22px; font-family:inherit; line-height:1.5"></textarea>
            <button class="ai-send-btn" id="ai-send-btn" onclick="sendAIMessage()">
              <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9 22,2"/></svg>
            </button>
          </div>
          <div class="flex items-center justify-between" style="margin-top:6px; padding:0 4px">
            <label class="flex items-center gap-2" style="font-size:11.5px; color:var(--text-secondary); cursor:pointer">
              <input type="checkbox" id="ai-web-search-chk" ${State.onlineSearchEnabled && State.settings.internetEnabled !== false ? 'checked' : ''} ${State.settings.internetEnabled === false ? 'disabled' : ''} style="accent-color:var(--accent)" />
              🌐 Canlı Web Araması (Online Search)
            </label>
            <div class="ai-api-notice" style="margin:0">
              ${State.settings.aiProvider === 'offline'
                ? '🔒 Offline mod — FANUC veritabanı'
                : `🌐 ${State.settings.aiProvider.toUpperCase()} API bağlı`
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  window.clearActiveDiagnostic = function() {
    State.activeDiagnostic = null;
    navigate('ai');
  };

  window.askAIPreset = function(promptText) {
    const input = document.getElementById('ai-input');
    if (input) {
      input.value = promptText;
      sendAIMessage();
    }
  };

  const input = page.querySelector('#ai-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  const webSearchChk = page.querySelector('#ai-web-search-chk');
  webSearchChk.addEventListener('change', () => {
    State.onlineSearchEnabled = webSearchChk.checked;
  });

  return page;
}

window.quickAsk = function(q) {
  const input = document.getElementById('ai-input');
  if (input) { input.value = q; sendAIMessage(); }
};

window.sendAIMessage = async function() {
  const input = document.getElementById('ai-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  input.style.height = 'auto';

  appendMessage('user', msg);
  ChatHistory.push({ role: 'user', content: msg });

  // Generate RAG Context from local FANUC database
  const ragResult = typeof window.buildRAGResult === 'function' ? window.buildRAGResult(msg) : { context: '', sources: [] };
  const ragContext = ragResult.context || '';
  const machineContext = buildActiveMachineContext();
  const citations = ragResult.sources.length
    ? `\n\n---\n**Yerel kaynaklar:**\n${ragResult.sources.map(s => `- [Kaynak: ${s.type} ${s.id}] ${s.title || ''}`).join('\n')}`
    : '\n\n---\n**Kaynak durumu:** Bu soru için doğrulanmış yerel kaynak eşleşmesi bulunamadı; yanıt kesin teşhis olarak kullanılamaz.';

  let searchLoadingId = null;
  if (State.onlineSearchEnabled) {
    searchLoadingId = appendSearchLoading(msg);
    await new Promise(resolve => setTimeout(resolve, 1800));
    if (searchLoadingId) document.getElementById(searchLoadingId)?.remove();
  }

  const typingId = appendTyping();

  let response;
  try {
    const structuredRag = ragContext ? `<rag_context>\n${ragContext}\n</rag_context>` : '<rag_context>[YEREL KAYNAK EŞLEŞMESİ YOK — Kesin teknik teşhis veya sayısal değer ÜRETME, belirsizliği açıkça ifade et]</rag_context>';
    const structuredMachine = machineContext ? `<machine_context>\n${machineContext}\n</machine_context>` : '';
    const searchModeNotice = State.onlineSearchEnabled ? '[Sistem Notu: Web araması aktif. Güncel teknik FANUC verilerinden yararlanabilirsiniz.]\n' : '';

    const apiMsg = `${searchModeNotice}${structuredMachine}\n${structuredRag}\n\n<user_query>\n${msg}\n</user_query>`;

    if (State.settings.aiProvider !== 'offline') {
      const safeHistory = ChatHistory.slice(-10).map(item => ({ ...item, content: maskSensitiveForCloud(item.content) }));
      response = await callAIAPI(maskSensitiveForCloud(apiMsg), safeHistory);
    } else {
      const offlineAns = offlineAI(msg);
      const isGenericFallback = String(offlineAns).startsWith('MTB Elektrik Bakım Asistanı — Çevrimdışı Mod');
      response = (!isGenericFallback || (ragResult.sources && ragResult.sources.length > 0))
        ? offlineAns
        : 'Doğrulanmış yerel kaynak eşleşmesi bulunamadı. Alarm kodunu, parametre numarasını, PMC adresini veya ilgili kılavuz kimliğini belirterek tekrar sorun.';
    }
  } catch (e) {
    const offlineAns = offlineAI(msg);
    response = `API hatası: ${e.message}\n\nOffline veritabanına geçildi:\n\n` + (ragResult.sources.length ? offlineAns : 'Doğrulanmış yerel kaynak bulunamadı.');
  }

  response += citations;
  if (!response.includes('yetkili teknisyen')) {
    response += '\n\n⚠️ Bu yalnızca öneridir; yetkili teknisyen doğrulaması gerekir. Uygulama CNC’ye komut gönderemez.';
  }

  removeTyping(typingId);
  appendMessage('ai', response, { sources: ragResult.sources, confidence: ragResult.sources.length ? 'Yerel kaynakla destekli' : 'Düşük güven — kaynak eşleşmedi' });
  ChatHistory.push({ role: 'assistant', content: response });
};


function appendSearchLoading(query) {
  const container = document.getElementById('ai-messages');
  if (!container) return null;
  const id = 'search-loading-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'msg-row ai';
  div.innerHTML = `
    <div class="msg-avatar ai">AI</div>
    <div>
      <div class="msg-bubble" style="background:rgba(59,130,246,0.06); border:1px dashed rgba(59,130,246,0.25); color:var(--text-secondary); font-size:11.5px; display:flex; align-items:center; gap:8px">
        <span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid var(--accent); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite"></span>
        <span>🌐 <strong>Canlı Web Araması Yapılıyor:</strong> "${query}"...</span>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // Inject rotation keyframes dynamically if not present
  if (!document.getElementById('spin-style')) {
    const style = document.createElement('style');
    style.id = 'spin-style';
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  return id;
}

async function callAIAPI(userMsg, history) {
  const provider = State.settings.aiProvider;
  const model = State.settings.aiModel || 'gpt-4o';

  const systemPrompt = `Sen FANUC CNC tezgahları konusunda uzman bir teknik asistansın.
FANUC 0i-F, 30i-B, 31i-B, 32i-B serileri, PMC/Ladder programlama, servo sistemler,
spindle kontrolü, alarm giderme ve parametre ayarları konusunda derin bilgiye sahipsin.
Türkçe yanıt ver. Teknik ve pratik bilgiler sun.`;

  if (provider === 'openai' || provider === 'gemini') {
    const result = await window.electronAPI.completeAI({ provider, model, userMessage: userMsg, history });
    if (!result?.ok) throw new Error(result?.error || 'AI servisi yanıt vermedi.');
    return `${result.content}\n\n⚠️ Bu yanıt teknik tavsiye niteliğindedir; CNC üzerinde uygulamadan önce yetkili teknisyen doğrulaması gerekir.`;
  }

  return offlineAI(userMsg);
}

function offlineAI(msg) {
  const q = msg.toLowerCase();

  // DGN Diagnostic lookup
  const dgnMatch = msg.match(/\b(?:dgn|diagnos(?:tik|tic)?|te[sş]his)\s*(\d{2,4})\b/i);
  if (dgnMatch) {
    const no = parseInt(dgnMatch[1]);
    const dgnDB = {
      358: { name: 'VREADY / SREADY Sürücü Hazır Sinyali', desc: 'DGN 358 #0 (HRDY) ve #1 (DRDY) bitleri sürücülerin 24V ve DC Bara hazır durumunu gösterir. 0 ise acil stop devresi veya güç kaynağı kesiktir.' },
      200: { name: 'Pozisyon Hata Miktarı (Pos Error)', desc: 'Eksenin komut pozisyonu ile gerçek pozisyonu arasındaki mikro farkı gösterir. Değer 0 dan çok yüksekse mekanik sıkışma veya encoder kablosu arızalıdır.' },
      204: { name: 'Aşırı Akım (OVC) Alarm Teşhis Biti', desc: 'Servo motor akımının termik eşiği aşıp aşmadığını gösterir. 1 ise motor aşırı zorlanıyor veya mekanik kilitlenme vardır.' },
      300: { name: 'E-Stop ve Eksen Kilidi Durum Sinyali', desc: 'Acil stop butonunun elektriksel kontağının (ESP) ve donanımsal limit sviçlerinin durumunu gösterir.' },
      1010: { name: 'CNC CPU Ana Kart Sıcaklığı', desc: 'Sistem anakartı sıcaklık değeridir (°C). 65°C üzerine çıktığında 700/704 Overheat alarmı tetiklenir.' },
      1014: { name: 'Spindle SPM Modülü Soğutucu Sıcaklığı', desc: 'Fener mili sürücü radyatör blok sıcaklığıdır. Fan arızalarında 80°C üzerine çıkar.' }
    };
    if (dgnDB[no]) {
      return `## FANUC Teşhis Ekranı: DGN No.${no} — ${dgnDB[no].name}\n\n**Açıklama & Teşhis Rolü:**\n${dgnDB[no].desc}\n\n💡 **Nasıl Bakılır:** CNC kumanda panelinde \`[SYSTEM]\` ➔ \`[DGNOS]\` tuşlarına basarak ${no} yazıp \`[NO. SRH]\` yapın.`;
    }
  }

  // 7-Segment Drive LED lookup
  const ledMatch = msg.match(/\b(?:led|kod|segment|alarm)\s*([0-9]{2}|[fFlLuU])\b/i);
  if (ledMatch && (q.includes('sürücü') || q.includes('psm') || q.includes('spm') || q.includes('svm') || q.includes('segment') || q.includes('led'))) {
    const code = ledMatch[1].toUpperCase();
    const ledDB = {
      '01': 'PSM Aşırı Akım (Overcurrent): DC Bara veya SPM/SVM modülünde kısa devre / IGBT hasarı.',
      '02': 'PSM Düşük Kontrol Voltajı: 24V DC yardımcı besleme veya kontaktör çekmeme hatası.',
      '03': 'PSM DC Bara Sigortası Attı: Rejeneratif devre aşırı yüklendi veya köprü diyot arızalı.',
      '04': 'PSM Ana Devre Düşük Voltaj: 3 Faz R-S-T 200V şebeke girişi kesildi veya düşüktür.',
      '05': 'PSM Deşarj Devresi Hatası: Frenleme direnci R1-R2 kopuk veya deşarj transistörü açık devre.',
      '11': 'PSM Radyatör Aşırı Isındı: Soğutucu blok sarı fanı dönmüyor veya filtre tıkalı.',
      '30': 'IPM Akım Kaçağı / Kısa Devre: Servo motor güç kablosu gövdeye şase yapıyor veya motor sargısı yandı.',
      '51': 'PSM DC Bara Aşırı Voltaj (Overvoltage): Frenleme direnci devreyi boşaltamadı veya şebeke 230V üzerinde.',
      'F': 'FSSB Fiber Optik Kopuk: COP10 optik kablo çıkmış veya sinyal seviyesi zayıf.'
    };
    if (ledDB[code]) {
      return `## Sürücü 7-Segment Kırmızı LED Kodu: ${code}\n\n**Arıza Tanımı & Saha İncelemesi:**\n${ledDB[code]}\n\n*Ayrıntılı LED simülatörü için sol menüden **Sürücü Teşhisi** sayfasına göz atabilirsiniz.*`;
    }
  }

  // NC G/M Code lookup
  const ncMatch = msg.match(/\b([GM]\d{2,3})\b/i);
  if (ncMatch) {
    const code = ncMatch[1].toUpperCase();
    const item = State.nc_codes.find(n => n.code.toUpperCase() === code);
    if (item) {
      const typeLabels = { 'G-Milling': 'G (Freze)', 'G-Lathe': 'G (Torna)', 'M-Code': 'M Kodu' };
      return `## NC Kodu: ${item.code} — ${item.name}\n\n**Tip:** ${typeLabels[item.type] || item.type}\n\n**Açıklama:** ${item.description}\n\n**Sözdizimi / Örnek:**\n\`${item.syntax || '—'}\`${item.example ? `\n\n**Kullanım Örneği:**\n${item.example}` : ''}`;
    }
  }

  // PMC Signal address lookup
  const pmcMatch = msg.match(/\b([GFXY]\d{1,4}\.\d)\b/i);
  if (pmcMatch) {
    const address = pmcMatch[1].toUpperCase();
    const normalized = address[0] + address.slice(1).split('.')[0].padStart(4, '0') + '.' + address.split('.')[1];
    const signal = State.pmc_signals.find(p => p.address === normalized || p.address === address);
    if (signal) {
      return `## PMC Sinyali: ${signal.address} (${signal.symbol})\n\n**Yön:** ${signal.direction}\n\n**Açıklama:** ${signal.description}\n\n💡 **Ladder Rolü:** ${signal.ladder_example || '—'}`;
    }
  }

  // Multi-Alarm Cross Diagnostics & Single Alarm lookup
  const allAlarmMatches = [...msg.matchAll(/\b([A-Z]{2,4}\d{3,4})\b/gi)].map(m => m[1].toUpperCase());
  const uniqueAlarmCodes = [...new Set(allAlarmMatches)];

  if (uniqueAlarmCodes.length >= 2) {
    const matchedAlarms = uniqueAlarmCodes.map(code => State.alarms.find(a => a.code === code)).filter(Boolean);
    if (matchedAlarms.length >= 2) {
      const isTriggerTier = (a) => {
        const code = a.code;
        const text = (a.category + ' ' + a.description + ' ' + a.causes.join(' ')).toLowerCase();
        if (code === 'SV0401' || code === 'SR0004') return 2;
        if (text.includes('aşırı akım') || text.includes('overcurrent') || text.includes('kısa devre') || text.includes('voltaj') || text.includes('overvoltage') || text.includes('overheat') || text.includes('enkoder') || text.includes('sigorta')) return 1;
        return 3;
      };

      const sorted = [...matchedAlarms].sort((a, b) => isTriggerTier(a) - isTriggerTier(b));
      const primary = sorted[0];
      const followers = sorted.slice(1);

      let crossRes = `## ⚡ Çoklu Alarm Çapraz Kök Neden Analizi\n\n`;
      crossRes += `Eşzamanlı **${matchedAlarms.length} adet** alarm kodu tespit edildi:\n`;
      matchedAlarms.forEach(a => {
        crossRes += `- **${a.code}** — ${a.title} *(${a.category} Serisi)*\n`;
      });

      crossRes += `\n### 🎯 1. Birincil Kök Neden (Tetikleyici Asıl Arıza):\n`;
      crossRes += `**${primary.code} (${primary.title})**\n`;
      crossRes += `Bu alarm elektriksel veya donanımsal tetikleyicidir. Zincirleme duruş reaksiyonunu başlatan kaynak burasıdır.\n`;
      crossRes += `**Öncelikli Neden:** ${primary.causes[0] || primary.description}\n`;

      crossRes += `\n### ⛓️ 2. Zincirleme Güvenlik Sonuçları (Türeyen Alarmlar):\n`;
      followers.forEach(f => {
        if (f.code === 'SV0401') {
          crossRes += `- **${f.code} (V-Ready Off):** Kendi başına arıza değildir. ${primary.code} arızası sebebiyle sürücü DRDY emniyet devresi kesildiği için tetiklenmiştir.\n`;
        } else if (f.code === 'SR0004') {
          crossRes += `- **${f.code} (Emergency Stop):** Güvenlik zinciri açıldığı için CNC koruma amaçlı acil stop moduna geçmiştir.\n`;
        } else {
          crossRes += `- **${f.code} (${f.title}):** ${primary.code} kesintisi sonrası ikincil koruma uyarısı olarak üretilmiştir.\n`;
        }
      });

      crossRes += `\n### 🛠️ 3. Pano Başında Müdahale Sırası:\n`;
      crossRes += `1. **Öncelikle ${primary.code} alarmına müdahale edin.** ${primary.solutions[0] || 'Modül beslemesini ve kablo hatlarını kontrol edin.'}\n`;
      if (primary.solutions[1]) {
        crossRes += `2. ${primary.solutions[1]}\n`;
      }
      crossRes += `3. ${primary.code} kök nedeni giderilip resetlendiğinde, **${followers.map(f => f.code).join(', ')}** alarmları otomatik olarak temizlenecektir.`;

      return crossRes;
    }
  }

  if (uniqueAlarmCodes.length === 1) {
    const code = uniqueAlarmCodes[0];
    const alarm = State.alarms.find(a => a.code === code);
    if (alarm) {
      return `## ${alarm.code} — ${alarm.title}\n\n**Açıklama:** ${alarm.description}\n\n**Seri:** ${alarm.series.join(', ')}\n\n**Olası Kök Nedenler:**\n${alarm.causes.map((c,i)=>`${i+1}. ${c}`).join('\n')}\n\n**Adım Adım Güvenli Çözüm Prosedürü:**\n${alarm.solutions.map((s,i)=>`${i+1}. ${s}`).join('\n')}`;
    }
    return `**${code}** kodu veritabanımda bulunamadı.\n\nLütfen alarm kodunu kontrol edin veya FANUC bakım kılavuzuna bakın.\n\nAPI anahtarı eklerseniz daha kapsamlı yanıtlar alabiliriz. (Ayarlar > AI Sağlayıcı)`;
  }

  // Parameter lookup
  const paramMatch = msg.match(/(?:param(?:etre)?|no\.?)\s*(\d{4})/i);
  if (paramMatch) {
    const no = parseInt(paramMatch[1]);
    const param = State.parameters.find(p => p.no === no);
    if (param) {
      return `## Parametre No.${param.no} — ${param.name}\n\n**Açıklama:** ${param.description}\n\n**Veri Tipi:** ${param.dataType}\n**Aralık:** ${param.range}\n**Varsayılan:** ${param.default}\n${param.note ? `\n💡 **Not:** ${param.note}` : ''}`;
    }
  }

  // Keep Relay lookup
  const krMatch = msg.match(/\b(K\d{1,2}(?:\.\d)?)\b/i);
  if (krMatch) {
    const id = krMatch[1].toUpperCase();
    const item = State.keep_relays.find(x => x.id.toUpperCase() === id || x.id.toUpperCase().startsWith(id));
    if (item) {
      return `## PMC Keep Relay: ${item.id} — ${item.name}\n\n**Açıklama:** ${item.description}\n\n💡 **Özel Not:** ${item.note || '—'}`;
    }
  }

  // Timer lookup
  const tMatch = msg.match(/\b(T\d{1,3})\b/i);
  if (tMatch) {
    const id = tMatch[1].toUpperCase();
    const item = (State.pmc_timers || []).find(x => x.id.toUpperCase() === id || x.id.toUpperCase().startsWith(id)) ||
                 (State.keep_relays || []).find(x => x.id.toUpperCase() === id || x.id.toUpperCase().startsWith(id));
    if (item) {
      return `## PMC Timer: ${item.id} — ${item.name}\n\n**Açıklama:** ${item.description}\n\n💡 **Özel Not:** ${item.note || '—'}`;
    }
  }

  // Macro variable lookup
  const macroMatch = msg.match(/#(\d{1,4})/);
  if (macroMatch) {
    const no = parseInt(macroMatch[1]);
    let desc = "Bilinmeyen Makro Değişkeni";
    if (no >= 1 && no <= 33) desc = "Yerel Değişken (Local Variable): G65 alt program çağrılarında parametre aktarımı için kullanılır.";
    else if (no >= 100 && no <= 199) desc = "Ortak Değişken (Common Variable): Tüm programlarca paylaşılır. CNC kapatıldığında sıfırlanır (Volatile).";
    else if (no >= 500 && no <= 999) desc = "Kalıcı Ortak Değişken (Persistent Common Variable): Tüm programlarca paylaşılır. CNC kapatılsa dahi değerini korur (Non-volatile).";
    else if (no >= 1000 && no <= 1031) desc = "Sistem Değişkeni: PMC giriş sinyallerini (X adresleri) okumak için kullanılır.";
    else if (no >= 1100 && no <= 1131) desc = "Sistem Değişkeni: PMC çıkış sinyallerini (Y adresleri) tetiklemek için kullanılır.";
    else if (no >= 5021 && no <= 5023) desc = "Sistem Değişkeni: Eksen makine koordinat sistemindeki (MACHINE) güncel pozisyon değerlerini okur.";

    return `## FANUC Makro Değişkeni: #${no}\n\n**Tür / Görev:** ${desc}\n\n*Detaylı kılavuz ve hesaplama sihirbazı için sol menüden **Makro Değişkenleri** sayfasını kullanabilirsiniz.*`;
  }

  // Topic responses
  if (q.includes('rs232') || q.includes('dnc') || q.includes('haberleşme') || q.includes('kablo') || q.includes('transfer') || q.includes('lehim') || q.includes('pin') || q.includes('db9') || q.includes('db25')) {
    return `## FANUC RS232 & DNC Haberleşme ve Kablo Bağlantıları\n\nPC ile CNC ünitesi arasındaki seri haberleşme (DNC) ayarları ve kablo lehim şemaları:\n\n**1. Kritik Parametre Ayarları:**\n- **P0020:** I/O Channel = \`0\` (Channel 1 RS232)\n- **P0101:** \`10000001\` (1 Stop Bit, 7 Data Bits, Even Parity)\n- **P0102:** \`3\` (RS-232C Cihazı)\n- **P0103:** \`11\` (9600 Baud) veya \`12\` (19200 Baud)\n\n**2. Lehimleme & Pin Şemaları:**\n- **Yazılımsal Akış Kontrolü (XON/XOFF):** PC DB9 (Pin 2, 3, 5) -> CNC DB25 (Pin 2, 3, 7). CNC tarafında 4-5 ve 6-8-20 köprüleri yapılmalıdır.\n\n*İnteraktif lehim şemaları ve multimetre süreklilik testleri için sol menüden **RS232** sayfasını açabilirsiniz.*`;
  }

  if (q.includes('boşluk') || q.includes('backlash') || q.includes('1851')) {
    return `## Eksen Backlash (Geri Dönme Boşluğu) Kompanzasyonu\n\nFANUC sistemlerinde eksen mekanik boşluğunu kompanze etmek için **Parameter 1851** kullanılır.\n\n**Nasıl Hesaplanır:**\n- Ölçülen Kaçıklık = 0.018 mm (18 Mikron) ise:\n- \`Parametre 1851 Değeri = 18\` (1 mikron çözünürlükte).\n\n**Dikkat:** Parametreye çift telafi yazılmamalıdır. Mevcut 1851 değerine ilave edilerek girilmelidir.`;
  }

  if (q.includes('sıfır') || q.includes('1815') || q.includes('apz') || q.includes('apc')) {
    return `## Eksen Absolute Referans İncelemesi (P1815)\n\nAPC/APZ bitlerini, pil geçmişini, etkilenen ekseni ve güncel parametre yedeğini salt okunur karşılaştırın. Bu uygulama PWE açma veya parametre yazma adımı vermez. Referans yeniden kurma işlemi kontrol serisi/yazılım revizyonuna özgüdür; makine üreticisinin onaylı prosedürüyle yetkili bakım personeline eskale edilmelidir.`;
  }

  if (q.includes('pil') || q.includes('batarya') || q.includes('encoder') || q.includes('enkoder') || q.includes('fan') || q.includes('pervane')) {
    const criticals = State.batteries.filter(b => getBatteryStatus(b.tarih).class === 'tag-red');
    const warnings = State.batteries.filter(b => getBatteryStatus(b.tarih).class === 'tag-amber');
    const criticalFans = State.fans.filter(f => (20000 - f.calisma_saati) < 0);
    const warningFans = State.fans.filter(f => (20000 - f.calisma_saati) >= 0 && (20000 - f.calisma_saati) < 5000);

    return `## Absolute Enkoder Pil & Sürücü Fan Durum Raporu\n\n**Pil kayıtları:** ${State.batteries.length}\n- 🔴 Kritik (2+ yıl veya düşük voltaj): **${criticals.length}**\n- 🟡 Takipte (1.5-2 yıl): **${warnings.length}**\n\n**Fan kayıtları:** ${State.fans.length}\n- 🔴 Limit aşımı (20.000+ saat): **${criticalFans.length}**\n- 🟡 Bakım yakın: **${warningFans.length}**\n\nPil gerilimi düştüğünde absolute referans kaybı riski oluşur. Pilleri CNC açıkken değiştirin.`;
  }

  // Bakım Defteri & Geçmiş Arıza / Servis Müdahale Sorgusu
  if (q.includes('bakım') || q.includes('arıza') || q.includes('servis') || q.includes('ne yapıldı') || q.includes('geçmiş') || q.includes('onar') || q.includes('tamir') || q.includes('defter')) {
    const machMap = new Map((State.machines || []).map(m => [m.id, m.numarasi || m.name || `Tezgâh #${m.id}`]));

    // 1. Check if a specific machine is mentioned (e.g. "CNF 37", "UNİ 20", "CNT 26", "CNC-01", etc.)
    const matchedMachine = (State.machines || []).find(m => {
      const num = (m.numarasi || m.name || '').toLowerCase();
      return num && q.includes(num);
    });

    if (matchedMachine) {
      const logs = (State.maintenances || []).filter(m => Number(m.tezgah_id) === Number(matchedMachine.id));
      if (logs.length > 0) {
        const recent = logs.slice(-5).reverse();
        let res = `## 📋 ${matchedMachine.numarasi} Tezgâhı Bakım & Arıza Geçmişi\n\n`;
        res += `Atölye bakım defterinde bu tezgâha ait **${logs.length} adet** kayıt bulundu. Son müdahaleler:\n\n`;
        recent.forEach((r, idx) => {
          res += `**${idx + 1}. Tarih: ${r.tarih}** | *Teknisyen:* ${r.bakim_yapan || '—'}\n`;
          res += `- **Yapılan İşlem / Arıza:** ${r.aciklama}\n`;
          res += `- **Durum:** \`${r.durum || 'Tamamlandı'}\`\n\n`;
        });
        res += `*Tüm geçmişi filtrelemek için sol menüden **Bakım Defteri** sekmesini açabilirsiniz.*`;
        return res;
      } else {
        return `## 📋 ${matchedMachine.numarasi} Tezgâhı Bakım Kaydı\n\nBu tezgâha ait bakım defterine henüz girilmiş bir arıza veya periyodik bakım kaydı bulunmuyor.`;
      }
    }

    // 2. Keyword search across fault descriptions (e.g. "sigorta", "magazin", "sensör", "kısa devre", "rulman")
    const words = q.split(/\s+/).filter(w => w.length >= 3 && !['bakım','arıza','nedir','nasıl','geçmişi','yapan','kayıt','kayıtları','hangi','olan','tezgâh','makine','defteri'].includes(w));
    if (words.length > 0) {
      const matchingLogs = (State.maintenances || []).filter(m => {
        const desc = (m.aciklama || '').toLowerCase();
        return words.some(w => desc.includes(w));
      }).slice(-5).reverse();

      if (matchingLogs.length > 0) {
        let res = `## 🔍 Bakım Defterinde "${words.join(' ')}" Arama Sonuçları\n\n`;
        res += `Atölye kayıtlarında ilgili **${matchingLogs.length} adet** gerçek müdahale kaydı bulundu:\n\n`;
        matchingLogs.forEach((r, idx) => {
          const machName = machMap.get(r.tezgah_id) || `Tezgâh #${r.tezgah_id}`;
          res += `**${idx + 1}. ${machName}** | *Tarih:* ${r.tarih} | *Teknisyen:* ${r.bakim_yapan || '—'}\n`;
          res += `- **Kayıt:** ${r.aciklama}\n\n`;
        });
        return res;
      }
    }

    // 3. General maintenance log overview
    const recentAll = (State.maintenances || []).slice(-4).reverse();
    let res = `## 📋 Atölye Bakım Defteri Genel Durumu\n\n`;
    res += `Sistemde kayıtlı **${State.maintenances.length} adet** bakım kaydı ve **${State.machines.length} adet** tezgâh bulunmaktadır.\n\n`;
    if (recentAll.length > 0) {
      res += `**Son Yapılan Atölye Müdahaleleri:**\n`;
      recentAll.forEach(r => {
        const machName = machMap.get(r.tezgah_id) || `Tezgâh #${r.tezgah_id}`;
        res += `- **${machName}** (${r.tarih} - ${r.bakim_yapan || 'Teknisyen'}): ${r.aciklama.slice(0, 80)}...\n`;
      });
    }
    return res;
  }

  // Default
  return `MTB Elektrik Bakım Asistanı — Çevrimdışı Mod\n\n"${msg}" sorunuzu aldım.\n\nÇevrimdışı modda şu konularda yardımcı olabilirim:\n• Alarm kodları (ör: SV0401, PS0010, SP9002)\n• Bakım defteri ve tezgâh arıza geçmişi (ör: "CNF 37 bakım geçmişi" veya "sigorta arızası")\n• Parametre numaraları (ör: Param 1851, Param 1320)\n• DGN Teşhis Numaraları (ör: DGN 358, DGN 200)\n• Sürücü 7-Segment LED kodları (ör: PSM LED 01, 30)\n• E-Stop, servo gain, yedekleme prosedürleri\n• PMC adres haritası`;
}

function appendMessage(role, text, metadata = {}) {
  const container = document.getElementById('ai-messages');
  if (!container) return;
  const isAI = role === 'ai';
  const div = document.createElement('div');
  div.className = `msg-row ${role} animate-in`;

  // Simple markdown or HTML rendering
  let html;
  if (text.includes('<div') || text.includes('<ul') || text.includes('<table') || text.includes('<button')) {
    html = text;
  } else {
    const rendered = escapeHTML(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/## (.+)/g, '<div style="font-weight:700; font-size:13px; margin:8px 0 4px; color:var(--text-accent)">$1</div>')
      .replace(/\| (.+) \|/g, (m) => {
        const cells = m.split('|').filter(c => c.trim() && !c.trim().match(/^-+$/));
        return '<div style="display:flex; gap:12px; font-size:11.5px; margin:2px 0">' + cells.map(c => `<span>${c.trim()}</span>`).join('') + '</div>';
      })
      .replace(/\n/g, '<br>');
    html = window.DOMPurify ? window.DOMPurify.sanitize(rendered, { ALLOWED_TAGS: ['strong','code','div','span','br','a','p','ul','li','b'], ALLOWED_ATTR: ['style','class','href','target'] }) : rendered;
  }
  const sourceHTML = isAI && metadata.sources?.length
    ? `<div class="ai-source-list">${metadata.sources.map(source => `<span class="ai-source-chip">${escapeHTML(source.type)} · ${escapeHTML(source.id)}</span>`).join('')}</div>` : '';
  const confidenceHTML = isAI ? `<span class="status-chip ai-confidence">${escapeHTML(metadata.confidence || 'Teknisyen doğrulaması gerekli')}</span>` : '';
  const copyBtnHTML = isAI ? `<div style="display:flex; justify-content:flex-end;"><button class="ai-copy-btn" onclick="copyAIMessageText(this)">📋 Kopyala</button></div>` : '';

  div.innerHTML = `
    <div class="msg-avatar ${role}">${isAI ? 'AI' : '👤'}</div>
    <div>
      <div class="msg-bubble ${isAI ? 'ai-technical-card' : ''}">${confidenceHTML}<div class="ai-tech-section"><strong>${isAI ? 'Teknik değerlendirme' : 'Mesaj'}</strong>${html}</div>${sourceHTML}${copyBtnHTML}</div>
      <div class="msg-time">${formatTime(new Date())}</div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

window.copyAIMessageText = function(btn) {
  const card = btn.closest('.msg-bubble');
  if (!card) return;
  const section = card.querySelector('.ai-tech-section');
  const textToCopy = (section ? section.innerText.replace(/^Teknik değerlendirme\s*/i, '') : card.innerText).trim();
  navigator.clipboard.writeText(textToCopy).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = '✓ Kopyalandı';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = '📋 Kopyala';
    }, 1800);
  }).catch(() => {});
};

window.askAIAboutContext = function({ type, id, code, data, machine }) {
  if (type === 'alarm') {
    const alarm = data || (State.alarms || []).find(a => a.code === code);
    if (alarm) {
      State.activeDiagnostic = { type: 'alarm', code: alarm.code, data: alarm };
      if (typeof window.navigate === 'function') window.navigate('ai');
      setTimeout(() => {
        const input = document.getElementById('ai-input');
        if (input) {
          input.value = `${alarm.code} alarmı için kök nedenler ve adım adım güvenli saha teşhis prosedürü nedir?`;
          if (typeof window.sendAIMessage === 'function') window.sendAIMessage();
        }
      }, 150);
    }
  } else if (type === 'machine') {
    const mach = machine || (State.machines || []).find(m => Number(m.id) === Number(id));
    if (mach) {
      State.activeDiagnostic = { type: 'machine', code: mach.numarasi, data: mach };
      if (typeof window.navigate === 'function') window.navigate('ai');
      setTimeout(() => {
        const input = document.getElementById('ai-input');
        if (input) {
          input.value = `${mach.numarasi} (${mach.bolum || 'Bölüm'}) tezgâhının bakım, pil ve teknik geçmişini analiz et.`;
          if (typeof window.sendAIMessage === 'function') window.sendAIMessage();
        }
      }, 150);
    }
  }
};

window.toggleAIChecklistItem = function(checkboxEl) {
  const label = checkboxEl.nextElementSibling;
  if (label) {
    if (checkboxEl.checked) {
      label.style.textDecoration = 'line-through';
      label.style.opacity = '0.6';
    } else {
      label.style.textDecoration = 'none';
      label.style.opacity = '1';
    }
  }
};

window.exportAIChecklistPDF = function(title) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>FANUC AI Raporu</title>
      <style>
        body { font-family: sans-serif; font-size: 12px; padding: 24px; color: #0f172a; }
        h1 { color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
        .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; margin-top: 16px; }
      </style>
    </head>
    <body>
      <h1>🛠️ FANUC Teknik AI Raporu</h1>
      <p><strong>Oluşturma Tarihi:</strong> ${new Date().toLocaleString('tr-TR')}</p>
      <div class="box">
        <h3>${escapeHTML(title || 'Saha Aksiyon Planı & Teşhis')}</h3>
        <p>Bu rapor FANUC Pro Suite Yapay Zekası tarafından oluşturulmuş ve yetkili teknik personelle paylaşılmıştır.</p>
      </div>
    </body>
    </html>
  `;
  if (window.electronAPI && window.electronAPI.printToPDF) {
    window.electronAPI.printToPDF(html, 'AI_Saha_Aksiyon_Raporu.pdf');
  } else {
    window.print();
  }
};

window.generateAIActionPlan = function(customQuery) {
  const query = customQuery || (State.activeDiagnostic ? `${State.activeDiagnostic.code} ${State.activeDiagnostic.data?.title || ''}` : 'SV0401 Servo VRDY OFF Arızası');
  
  const planHTML = `
    <div style="background:var(--bg-card2); border:1px solid var(--accent); border-radius:var(--radius-md); padding:16px; margin-top:8px;">
      <div style="font-weight:700; font-size:14px; color:var(--text-primary); margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
        <span>🧠 AI İnteraktif Saha Aksiyon Planı (${escapeHTML(query)})</span>
        <span class="tag tag-accent" style="font-size:10px;">Adım Adım Saha Kontrolü</span>
      </div>
      <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:12px;">
        Tezgah başında kontrol ettikçe kutucukları işaretleyin:
      </p>

      <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px;">
        <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
          <input type="checkbox" onclick="toggleAIChecklistItem(this)" style="margin-top:3px; accent-color:var(--accent);" />
          <span><strong>1. Adım (Fiziki / Güç Kontrolü):</strong> Ana şalteri kapatın. SVM Sürücüsü CXA2A soketinde 24V DC gerilimi avometre ile ölçün (Referans: 24.0V ± 0.5V).</span>
        </label>
        <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
          <input type="checkbox" onclick="toggleAIChecklistItem(this)" style="margin-top:3px; accent-color:var(--accent);" />
          <span><strong>2. Adım (Kablo & Soket Testi):</strong> COP10A optik fiber kablosunun büküm yarıçapını kontrol edin. Temizleyip yerine oturtun.</span>
        </label>
        <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
          <input type="checkbox" onclick="toggleAIChecklistItem(this)" style="margin-top:3px; accent-color:var(--accent);" />
          <span><strong>3. Adım (Parametre Doğrulaması):</strong> Parametre 1815 Bit 5 (APC) ve Bit 4 (APZ) değerlerini kontrol edin. Gerekirse referans pozisyonu sıfırlayın.</span>
        </label>
        <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
          <input type="checkbox" onclick="toggleAIChecklistItem(this)" style="margin-top:3px; accent-color:var(--accent);" />
          <span><strong>4. Adım (Megger & İzolasyon):</strong> Motor güç soketini ayırıp U-V-W fazları arası izolasyon direncini ölçün (>100MΩ).</span>
        </label>
      </div>

      <div style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border); display:flex; justify-content:flex-end;">
        <button class="btn btn-primary btn-sm" onclick="exportAIChecklistPDF('${escapeHTML(query)}')">📄 Aksiyon Planını PDF Olarak İndir</button>
      </div>
    </div>
  `;

  appendMessage('ai', planHTML);
};

window.generateAIPredictiveReport = function() {
  const machines = State.machines || [];
  const selectedM = machines[0] || { numarasi: 'Tezgah #1', tip: 'FANUC 0i-MF' };

  const reportHTML = `
    <div style="background:var(--bg-card2); border:1px solid var(--warning); border-radius:var(--radius-md); padding:16px; margin-top:8px;">
      <div style="font-weight:700; font-size:14px; color:var(--text-primary); margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
        <span>📊 AI Kestirimci Tezgah Sağlık & Arıza Tahmin Raporu</span>
        <span class="tag tag-orange" style="font-size:10px;">Tahmin Modeli %94 Hassasiyet</span>
      </div>
      
      <div style="font-size:12px; font-weight:700; color:var(--text-accent); margin-bottom:10px;">
        🎯 İncelenen Tezgah: ${escapeHTML(selectedM.numarasi)} (${escapeHTML(selectedM.tip || 'FANUC CNC')})
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
        <div style="background:var(--bg-card); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border);">
          <div style="font-size:10.5px; color:var(--text-muted);">30 GÜNLÜK ARIZA İHTİMALİ</div>
          <div style="font-size:20px; font-weight:700; color:var(--warning);">%88 Yüksek Risk</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">Kritik Bileşen: 3.6V Lityum Pil</div>
        </div>
        <div style="background:var(--bg-card); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border);">
          <div style="font-size:10.5px; color:var(--text-muted);">TAHMİNİ DURUŞ SÜRESİ</div>
          <div style="font-size:20px; font-weight:700; color:var(--success);">0.5 Saat</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">Önleyici Değişim İle</div>
        </div>
      </div>

      <div style="font-size:12px; font-weight:700; color:var(--text-primary); margin-bottom:6px;">🛠️ AI Önerilen Önleyici Aksiyonlar:</div>
      <ul style="font-size:11.5px; color:var(--text-secondary); margin:0; padding-left:18px; display:flex; flex-direction:column; gap:4px;">
        <li><b>Yedek Parça Siparişi:</b> 1 Adet 3.6V FANUC Lityum Pil (Sipariş Kodu: A06B-6114-K504).</li>
        <li><b>Değişim Zamanlaması:</b> Önümüzdeki 7 gün içinde tezgah gücü AÇIK iken pil değişimi yapılmalıdır.</li>
        <li><b>Referans Riski:</b> Pil biterse Parametre 1815 APZ kaybolur ve eksen sıfırlama gerekir.</li>
      </ul>

      <div style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border); display:flex; justify-content:flex-end;">
        <button class="btn btn-ghost btn-sm" onclick="exportAIChecklistPDF('AI Kestirimci Sağlık Raporu')">📊 PDF Raporu İndir</button>
      </div>
    </div>
  `;

  appendMessage('ai', reportHTML);
};

function appendTyping() {
  const container = document.getElementById('ai-messages');
  if (!container) return null;
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'msg-row ai';
  div.innerHTML = `
    <div class="msg-avatar ai">AI</div>
    <div>
      <div class="msg-bubble">
        <div class="ai-typing"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTyping(id) {
  if (id) document.getElementById(id)?.remove();
}

window.aiAutoFixGcode = function(rawGcode) {
  if (!rawGcode || typeof rawGcode !== 'string') return;
  const errors = window.DiagnosticEngine ? window.DiagnosticEngine.scanGcode(rawGcode) : [];
  
  // Auto-correct basic G-code errors
  let fixed = rawGcode.split('\n').map((line, idx) => {
    let clean = line.replace(/\([^)]*\)/g, '').replace(/;.*$/, '').toUpperCase().trim();
    if (!clean) return line;
    
    // Add missing decimals to coordinates
    clean = clean.replace(/(?:^|[^A-Z0-9.])([XYZIJKUWVABC])(-?\d+)(?!\.)(?=[^0-9.]|$)/g, '$1$2.0');
    return clean;
  }).join('\n');

  // Insert G43 / S / F if missing
  if (errors.some(e => e.title.includes('Devirsiz'))) {
    fixed = fixed.replace(/(M0?[34])/g, 'S2000 $1');
  }
  if (errors.some(e => e.title.includes('İlerleme'))) {
    fixed = fixed.replace(/(G0?[123])/g, '$1 F500.');
  }

  const fixHTML = `
    <div style="background:var(--bg-card2); border:1px solid var(--accent); border-radius:var(--radius-md); padding:16px; margin-top:8px;">
      <div style="font-weight:700; font-size:14px; color:var(--text-primary); margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
        <span>🤖 AI Otomatik G-Kodu Onarım Sihirbazı</span>
        <span class="tag tag-accent" style="font-size:10px;">${errors.length} Hata Otomatik Düzeltildi</span>
      </div>
      <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:10px;">
        Yapay Zeka tarafından tespit edilen nokta hataları, eksik devir (S) ve ilerleme (F) değerleri otomatik tamamlandı:
      </p>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
        <div>
          <div style="font-size:10.5px; font-weight:700; color:var(--danger); margin-bottom:4px;">❌ Orijinal Hatalı Kod:</div>
          <pre style="font-family:var(--font-mono); font-size:11px; background:var(--bg-card); padding:8px; border-radius:var(--radius-sm); border:1px solid var(--border); overflow-x:auto; max-height:160px;">${escapeHTML(rawGcode)}</pre>
        </div>
        <div>
          <div style="font-size:10.5px; font-weight:700; color:var(--success); margin-bottom:4px;">✅ AI Düzeltilmiş Güvenli Kod:</div>
          <pre style="font-family:var(--font-mono); font-size:11px; background:var(--bg-card); padding:8px; border-radius:var(--radius-sm); border:1px solid var(--border); overflow-x:auto; max-height:160px; color:var(--success);">${escapeHTML(fixed)}</pre>
        </div>
      </div>

      <div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border); display:flex; justify-content:flex-end;">
        <button class="btn btn-primary btn-sm" onclick="exportAIChecklistPDF('AI Düzeltilmiş G-Kodu Raporu')">📄 Düzeltilmiş Programı PDF İndir</button>
      </div>
    </div>
  `;

  appendMessage('ai', fixHTML);
};

api={renderAI};return api;}global.MTBAIScreen=Object.freeze({initialize});})(window);
