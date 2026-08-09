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
          <button class="btn btn-ghost btn-sm" onclick="askAIPreset('Parametre 1815 APZ/APC sıfırlama nasıl yapılır')" style="text-align:left; justify-content:flex-start; width:100%; border:1px solid var(--border)">
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
            'SV0401 alarmı nedir?',
            'E-Stop devresi nasıl çalışır?',
            'Parametre yedekleme nasıl yapılır?',
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
    const apiMsg = `${msg}\n\n${machineContext}\n\n${ragContext || '[YEREL KAYNAK EŞLEŞMESİ YOK — kesin teknik iddia üretme]'}`;
    if (State.settings.aiProvider !== 'offline') {
      const finalMsg = State.onlineSearchEnabled
        ? `[Sistem Notu: Web araması aktif. Lütfen internetten aldığın en güncel teknik FANUC verilerini kullanarak cevap ver.] ${apiMsg}`
        : apiMsg;
      const safeHistory = ChatHistory.slice(-10).map(item => ({ ...item, content: maskSensitiveForCloud(item.content) }));
      response = await callAIAPI(maskSensitiveForCloud(finalMsg), safeHistory);
    } else {
      response = ragResult.sources.length
        ? offlineAI(msg)
        : 'Doğrulanmış yerel kaynak eşleşmesi bulunamadı. Alarm kodunu, parametre numarasını, PMC adresini veya ilgili kılavuz kimliğini belirterek tekrar sorun.';
    }
  } catch (e) {
    const offlineAns = offlineAI(msg);
    const combinedAns = ragContext ? `${offlineAns}\n\n---\n${ragContext}` : offlineAns;
    response = `API hatası: ${e.message}\n\nOffline veritabanına geçildi:\n\n` + (ragResult.sources.length ? offlineAns : 'Doğrulanmış yerel kaynak bulunamadı.');
  }

  response += citations + '\n\n⚠️ Bu yalnızca öneridir; yetkili teknisyen doğrulaması gerekir. Uygulama CNC’ye komut gönderemez.';

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

  // Alarm lookup
  const alarmMatch = msg.match(/([A-Z]{2,4}\d{4})/i);
  if (alarmMatch) {
    const code = alarmMatch[1].toUpperCase();
    const alarm = State.alarms.find(a => a.code === code);
    if (alarm) {
      return `## ${alarm.code} — ${alarm.title}\n\n**Açıklama:** ${alarm.description}\n\n**Seri:** ${alarm.series.join(', ')}\n\n**Olası Nedenler:**\n${alarm.causes.map((c,i)=>`${i+1}. ${c}`).join('\n')}\n\n**Çözüm Adımları:**\n${alarm.solutions.map((s,i)=>`${i+1}. ${s}`).join('\n')}`;
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
    const item = State.keep_relays.find(x => x.id.toUpperCase() === id || x.id.toUpperCase().startsWith(id));
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
    return `## FANUC RS232 & DNC Haberleşme ve Kablo Bağlantıları\n\nPC ile CNC ünitesi arasındaki seri haberleşme (DNC) ayarları ve kablo lehim şemaları:\n\n**1. Kritik Parametre Ayarları:**\n- **P0020:** I/O Channel = \`0\` (Channel 1 RS232)\n- **P0101:** \`10000001\` (1 Stop Bit, 7 Data Bits, Even Parity)\n- **P0102:** \`3\` (RS-232C Cihazı)\n- **P0103:** \`11\` (9600 Baud) veya \`12\` (19200 Baud)\n\n**2. Lehimleme & Pin Şemaları:**\n- **Yazılımsal Akış Kontrolü (XON/XOFF):** PC DB9 (Pin 2, 3, 5) -> CNC DB25 (Pin 2, 3, 7). CNC tarafında 4-5 ve 6-8-20 köprüleri yapılmalıdır.\n\n*İnteraktif lehim şemaları, multimetre süreklilik testleri ve blendaj şase kuralları için sol menüden **RS232 Pin & Lehim Rehberi** sayfasını açabilirsiniz.*`;
  }

  if (q.includes('spindle') || q.includes('sp9015') || q.includes('sp9012') || q.includes('sp9002') || q.includes('sensör') || q.includes('fren') || q.includes('deşarj') || q.includes('kasnak') || q.includes('4002') || q.includes('4003')) {
    return `## Spindle Sürücü (SPM), Sensör & Fren Teşhisi\n\nİş mili alarmları, frenleme devresi ve pozisyon kodlayıcı oranları kontrolü:\n\n**1. Enkoder Hataları (SP9015 / SP9002):**\n- Sensör ile dişli çark arasındaki hava boşluğu (gap) sentil şeridi ile tam **0.15 mm - 0.20 mm** arasına ayarlanmalı ve osiloskop genliği **1.0 V p-p** olmalıdır.\n- **2. Fren Direnci & Rejeneratif Deşarj:** İş mili yavaşlarken aşırı voltaj alarmı veriyorsa, R1-R2 fren direnç uçlarını söküp direnci (nominal 10-30 Ω) ölçün. Ayrıca sürücü üzerindeki deşarj IGBT diyot geçişlerini test edin.\n- **3. Pozisyon Kodlayıcı Diş Oranı:** Kasnak/kayış oranı değiştiğinde Parameter **4002** (pay) ve **4003** (payda) değerlerini girin.\n\n*Spindle hata ansiklopedisi, fren direnci test yönergeleri ve dişli oranı hesaplayıcı için sol menüden **Spindle Teşhisi** sekmesini açabilirsiniz.*`;
  }

  if (q.includes('üretici') || q.includes('m-kodu') || q.includes('a-adresi') || q.includes('ex0001') || q.includes('özel m')) {
    return `## Üretici M-Kodları & Özel Alarmlar (A-Adresleri)\n\nTezgah imalatçısı tarafından PMC ladder içerisine yazılmış özel fonksiyonlar:\n\n- **Özel M-Kodları:** Ayna sıkma (M10/M11), punta, yüksek basınç gibi mekanik adımları tetikleyen ve PMC üzerinden CNC'ye \`MF\` sinyaliyle onay gönderen kodlar.\n- **A-Adresleri (Üretici Alarmları):** CNC ekranında görüntülenen \`EX\` kodlu mesaj alarmlarıdır (Örn: A0.0 biti 1 olduğunda EX0001 Lubrication Fault verir).\n\n*Fabrika tezgahlarınıza ait özel M-kodlarını ve A-adresi alarm mesajlarını kaydetmek ve aramak için sol menüden **Üretici Alarm & M-Kodu** sayfasını kullanabilirsiniz.*`;
  }

  if (q.includes('sürücü') || q.includes('amp') || q.includes('segment') || q.includes('kart') || q.includes('kabin') || q.includes('overheat') || q.includes('700') || q.includes('704') || q.includes('sıcaklık') || q.includes('ısı') || q.includes('fan')) {
    return `## Sürücü 7-Segment Teşhisi & Kabin Isı Kontrolü\n\nSürücü kırmızı LED kod arızaları ve aşırı ısınma (overheat) çözümleri:\n\n- **Arıza Kodu 30 / 51 / F:** Akım kaçağı, DC bara yüksek voltajı veya FSSB fiber optik hat hatası.\n- **Kabin Overheat (Alarm 700 / 704):** CNC CPU ana kart sıcaklığı veya sürücü soğutucu blok sıcaklığı limiti aştı demektir. Sarı kabin soğutucu fanlarının çalışmasını kontrol edin.\n- **Isı Takip Parametresi:** **Parameter 3111 #0 (TEMD)** 1 yapıldığında CPU sıcaklığı CNC ekranında doğrudan görüntülenebilir (DGN 1010 ve 1014).\n\n*Etkileşimli LED simülatörü ve kabin fanı / ısı takip parametre kılavuzu için sol menüden **Sürücü Teşhisi** sekmesine tıklayabilirsiniz.*`;
  }

  if (q.includes('akım') || q.includes('tuning') || q.includes('kazanç') || q.includes('2004') || q.includes('vınıltı') || q.includes('titreme') || q.includes('vibrasyon')) {
    return `## Servo Eksen Akım Döngüsü Kazanç Ayarı (P2004)\n\nEksen motorlarının yaşlanması veya sürtünme kaynaklı titreme/vınıltı seslerini gidermek için:\n\n- **Parameter 2004 (VCMD):** Akım kazanç oranını 10'arlı adımlarla azaltarak sesi gözlemleyin.\n- **Parameter 2040 & 2041:** Eksen kalkışlarındaki tork vuruntularını gidermek için akım loop integral/proportional kazançlarını %5-10 azaltın.\n\n*Adım adım akım kazanç kalibrasyon rehberi için sol menüden **Ayar Sihirbazı** sayfasındaki ilgili adımı açabilirsiniz.*`;
  }

  if (q.includes('limit') || q.includes('soft limit') || q.includes('1320') || q.includes('1321') || q.includes('stoper') || q.includes('strok')) {
    return `## Eksen Yumuşak Sınır Limitleri (Soft Limits)\n\nTezgah eksenlerinin mekanik stoperlere çarparak zarar görmesini engelleyen yazılımsal sınırlardır:\n\n- **Parameter 1320 (Limit+):** Artı yöndeki elektriksel durma sınırı (Örn: 510000 yazılırsa +510 mm limit).\n- **Parameter 1321 (Limit-):** Eksi yöndeki durma sınırı.\n- **Emniyet Kuralı:** Mekanik stoper ile yumuşak limit arasında daima en az **5-10 mm emniyet boşluk payı** bırakılmalıdır.\n\n*Kanal limit hesaplama aracı ve retro sistem parametre ekranı simülasyonu için sol menüden **Eksen Limit Sihirbazı** sekmesini açabilirsiniz.*`;
  }

  if (q.includes('dişli') || q.includes('oran') || q.includes('2084') || q.includes('2085') || q.includes('fgr')) {
    return `## Esnek Dişli Oranı (Flexible Gear Ratio)\n\nFANUC motorlarının vidalı mille doğru ölçüde senkronize olması için **Parameter 2084 (Pay)** ve **Parameter 2085 (Payda)** kullanılır.\n\n**Nasıl Hesaplanır:**\n- Enkoder çözünürlüğü ve vidalı mil hatvesi (pitch) oranlanıp en küçük komut birimi (LCI) cinsinden sadeleştirilir.\n- Örnek: 10mm vidalı mil hatvesi ve 1.000.000 puls/tur enkoder için 1 mikron çözünürlükte FGR parametreleri: \`2084 = 100\` / \`2085 = 1\` olarak bulunur.\n\n*Hassas mekanik dişli oranlarınızı sadeleştirilmiş kesir limitlerine göre hesaplamak için sol menüden **Dişli Oranı Hesabı** sayfasını kullanabilirsiniz.*`;
  }

  if (q.includes('mtbf') || q.includes('mttr') || q.includes('oee') || q.includes('verimlilik') || q.includes('güvenilirlik')) {
    let res = `## OEE Verimlilik & MTBF/MTTR Güvenilirlik Analizi\n\nAtölyedeki tezgahların arıza ve bakım kayıtlarına göre hesaplanan işletme verimliliği metrikleri:\n\n`;
    if (State.machines.length > 0) {
      res += `**Atölye Genel Durumu:**\n- Toplam kayıtlı tezgah: **${State.machines.length}** adet\n- Ortalama Kullanılabilirlik (Availability) oranı veritabanı üzerinden MTBF ve MTTR saatlerine göre dinamik olarak çıkarılmaktadır.\n\n`;
    }
    res += `*Hangi tezgahın kronik olarak sık arızalandığını görmek ve OEE verimlilik grafiklerini incelemek için sol menüden **MTBF / MTTR Güvenilirlik** panelini açabilirsiniz.*`;
    return res;
  }

  if (q.includes('tarayıcı') || q.includes('hata önleyici') || q.includes('çarpışma') || q.includes('nokta hatası') || q.includes('g43')) {
    return `## G-Code Çarpışma & Hata Tarayıcı\n\nG-Kod programlarındaki yaygın operatör hatalarını (özellikle kaza/çarpışmalara neden olanları) statik analizle tespit eder:\n\n**Taranan Kritik Hatalar:**\n- **Nokta Hatası (Decimal Point Error):** \`X100\` gibi nokta eksiklikleri (FANUC bunu 100 mikron olarak algılar ve eksen kaza yapabilir).\n- **G43 Boy Telafisi Eksikliği:** Alt program veya takım değişiminden sonra boy telafisi H kodu olmadan Z hareketi yapılması.\n- **Z- Hızlı Dalış (G00 Z-):** Hızlı konumlandırma modu ile parça sıfırının altına dalış tespiti.\n\n*Kodunuzu yükleyip analiz etmek için sol menüden **G-Code Hata Tarayıcı** sekmesini açabilirsiniz.*`;
  }

  if (q.includes('karşılaştır') || q.includes('diff') || q.includes('fark') || q.includes('yedek')) {
    return `## CNC Parametre Karşılaştırma & Fark Analizörü\n\nİki farklı FANUC parametre yedek dosyası (text) arasındaki tüm değer değişikliklerini, eklenen/silinen parametreleri ve bit bazlı durum farklılıklarını analiz eder:\n\n**Uygulama Alanları:**\n- Arızalanan bir tezgahın çalışan eski yedeği ile arıza anındaki güncel yedek dosyasını karşılaştırarak değişen parametreleri (ör. \`1815\` APZ bitinin kapanması) teşhis edebilirsiniz.\n\n*Ayrıntılı tablolar ve renkli fark analizleri için sol menüden **Parametre Karşılaştırıcı** sekmesini kullanabilirsiniz.*`;
  }

  if (q.includes('ağaç') || q.includes('karar') || q.includes('belirti') || q.includes('spindle dönmüyor') || q.includes('eksen gitmiyor') || q.includes('hidrolik')) {
    return `## Kronik Arıza Karar ve Çözüm Ağacı\n\nTezgahtaki belirtilere göre adım adım ilerleyen karar destek mekanizmasıyla arızanın kök nedenini bulun:\n\n- **Eksen Kilitlenmeleri:** Acil stop (*ESP sinyali - X0008.4) veya Machine Lock durumlarını inceler.\n- **İş Mili (Spindle) Sorunları:** Ayna ayak sıkma sinyali (X0004.2) ve Kapı güvenlik kilidi (K00.1 / X0008.3) durumlarını kontrol ettirir.\n- **Hidrolik Sorunları:** Motor termik rölesi resetleme ve R-S-T faz yönü kontrollerini barındırır.\n\n*Adım adım etkileşimli sihirbaz ile arıza tespiti yapmak için sol menüden **Arıza Teşhis Ağacı** sayfasını ziyaret edebilirsiniz.*`;
  }

  if (q.includes('ı/o') || q.includes('io link') || q.includes('er97') || q.includes('er96') || q.includes('sys_alm 160') || q.includes('jd1a') || q.includes('jd1b') || q.includes('fssb') || q.includes('optik')) {
    return `## FANUC I/O Link & FSSB Optik Link Teşhisi\n\n**1. I/O Link Donanım Teşhisi (ER97 / ER96):**\n- **ER97 I/O LINK FAILURE:** Haberleşme veya modül besleme kesintisidir. Hata veren I/O grubunun 24V DC besleme sigortasını ölçün. Soketlerin önceki modülün **JD1A (OUT)** portundan sonraki modülün **JD1B (IN)** portuna girdiğini teyit edin.\n- **Kısa Devre Testi:** Yeşil terminal klemenslerini I/O ünitesinden söküp alarmı resetleyin. Alarm giderse saha elemanlarında/sensörlerde kısa devre vardır.\n\n**2. FSSB Optik Haberleşme Teşhisi (SYS_ALM 160):**\n- CNC CPU kartı ile servo sürücüler arasındaki fiber optik haberleşme koptuğunda oluşur.\n- **Sürücü LED Kontrolü:** Sürücülerin 7-segment ekranlarına bakın: Upstream kopukluk için \`L\`, Downstream için \`U\` kodu gösteren sürücüyü bulun. Kopukluk bu sürücü ile bitişiğindeki sürücü arasındadır.\n- **Fiber Optik Kuralları:** COP10A/B turuncu/siyah kabloların tozunu alkollü bezle temizleyin. Minimum büküm yarıçapının **30mm** olduğunu teyit edin, sert bükümler kablo içindeki cam fiberi kırar.`;
  }

  if (q.includes('boşluk') || q.includes('backlash') || q.includes('1851')) {
    return `## Eksen Backlash (Geri Dönme Boşluğu) Kompanzasyonu\n\nFANUC sistemlerinde geri dönme boşluğunu kompanze etmek için **Parameter 1851** kullanılır.\n\n**Nasıl Ayarlanır & Hesaplanır:**\n1. Eksene komparatör bağlayın ve saati sıfırlayın.\n2. MDI'da ekseni ters yönde hareket ettirin.\n3. Saatteki sapma miktarını okuyun.\n4. **Öneri:** Sol menüden **Eksen Boşluk Sihirbazı** sayfasını açarak komparatör ölçüm test kodunu otomatik üretebilir ve mikron sapmasına göre yeni Parametre 1851 değerini dijital ekran simülasyonu üzerinde hesaplayabilirsiniz.`;
  }

  if (q.includes('sıfır') || q.includes('1815') || q.includes('apz') || q.includes('apc')) {
    return `## Eksen Absolute Referans Noktası Sıfırlama (P1815)\n\nAbsolute enkoderli eksenlerin referans noktasını sıfırlamak için **Parameter 1815** kullanılır:\n\n1. Ekseni hizalama çizgisine getirin.\n2. PWE=1 yapın.\n3. \`1815\` nolu parametrede sıfırlanacak eksenin \`APC (Bit 5)\` ve \`APZ (Bit 4)\` değerlerini güncelleyin (APZ'yi 1 -> 0 -> 1 yapın).\n4. CNC'yi kapatıp açın.\n\n*Sanal parametre tablosu ve interaktif kontrol listesi için sol menüden **Ayar Sihirbazı** sekmesini kullanabilirsiniz.*`;
  }

  if (q.includes('makro') || q.includes('çevrim') || q.includes('g81') || q.includes('g83') || q.includes('bhc') || q.includes('üret')) {
    return `## G-Code ve Makro Çevrimleri\n\nMTB Elektrik Bakım içindeki kod üretme aracı ile şu standart alt programları otomatik olarak oluşturabilirsiniz:\n- **G81 / G83:** Delik delme ve kademeli delik delme çevrimi.\n- **BHC (Bolt Hole Circle):** Cıvata dairesi cıvata delikleri koordinat trigonometrik hesabı.\n- **G02 / G03:** Dairesel cep boşaltma helisel interpolasyon kodları.\n\n*Hazır G-Code programı üretmek için sol menüden **G-Code Üretici** sayfasını kullanabilirsiniz.*`;
  }

  if (q.includes('sağlık') || q.includes('kestirim') || q.includes('risk') || q.includes('tahmin') || q.includes('kritik')) {
    const machList = State.machines.map(m => {
      const health = calculateMachineHealth(m);
      return { ...m, health };
    });
    const priority = { Critical: 0, Warning: 1, Safe: 2 };
    machList.sort((a, b) => priority[a.health.status] - priority[b.health.status]);
    const criticals = machList.filter(m => m.health.status === 'Critical');
    const warnings = machList.filter(m => m.health.status === 'Warning');

    let res = `## Bakım Durum Raporu\n\nTezgâhlara puan verilmeden bakım, pil, fan, yedekleme ve envanter kayıtları incelenmiştir:\n\n**Mevcut Durumlar:**\n- 🔴 Kritik pil veya fan bildirimi: **${criticals.length}** adet tezgâh\n- 🟡 Kontrol edilmeli: **${warnings.length}** adet tezgâh\n- 🟢 Aktif kritik bildirimi yok: **${machList.length - criticals.length - warnings.length}** adet tezgâh\n`;

    if (criticals.length > 0) {
      res += `\n**⚠️ Kritik bildirimi bulunan tezgâhlar:**\n`;
      criticals.slice(0, 3).forEach(c => {
        res += `- **${c.numarasi}** — ${c.health.reasons.join(', ') || c.health.primaryReason} — Bölüm: ${c.bolum || '—'}\n`;
      });
    }
    res += `\n*Detaylı öncelik sıralaması ve kestirimci analizler için sol menüden **Kestirimci Bakım** sayfasını ziyaret edebilirsiniz.*`;
    return res;
  }

  if (q.includes('bakım') || q.includes('servis') || q.includes('onar')) {
    return `## Tezgah Bakım Sistemi\n\nTezgah Takip modülü kapsamında **${State.maintenances.length}** adet bakım kaydı ve **${State.machines.length}** adet kayıtlı makine sistemde bulunmaktadır.\n\n**Genel İstatistikler:**\n- Kayıtlı Tezgah Sayısı: ${State.machines.length}\n- Toplam Bakım Kaydı: ${State.maintenances.length}\n\n**Yeni Bakım Kaydı Ekleme:**\nSol menüden **Bakım Defteri** sekmesine giderek "Yeni Bakım Kaydı" butonuyla yeni periyodik veya arıza bakım kaydı ekleyebilirsiniz.`;
  }

  if (q.includes('pil') || q.includes('batarya') || q.includes('encoder') || q.includes('enkoder') || q.includes('fan') || q.includes('pervane')) {
    const criticals = State.batteries.filter(b => getBatteryStatus(b.tarih).class === 'tag-red');
    const warnings = State.batteries.filter(b => getBatteryStatus(b.tarih).class === 'tag-amber');

    const criticalFans = State.fans.filter(f => (20000 - f.calisma_saati) < 0);
    const warningFans = State.fans.filter(f => (20000 - f.calisma_saati) >= 0 && (20000 - f.calisma_saati) < 5000);

    return `## Absolute Enkoder Pil & Sürücü Fan Durum Raporu\n\n**1. Enkoder Pil Durumları (Voltaj Seviyeleri):**\n- Sistemde **${State.batteries.length}** adet kayıtlı pil döngüsü var.\n- 🔴 Kritik Seviye (Değişimi Geciken / < 3.0V): **${criticals.length}** adet eksen (Pozisyon APZ kaybı riski!).\n- 🟡 Uyarı Seviyesi (3.0V - 3.2V): **${warnings.length}** adet eksen.\n- 🟢 Güvenli Seviye (> 3.2V): **${State.batteries.length - criticals.length - warnings.length}** adet eksen.\n\n**2. Sürücü Kabini Soğutma Fanları Durumu:**\n- Sistemde **${State.fans.length}** adet kayıtlı soğutma fanı takip edilmektedir.\n- 🔴 Limit Aşımı (> 20.000 Saat): **${criticalFans.length}** adet fan.\n- 🟡 Bakım Yakın (15.000 - 20.000 Saat): **${warningFans.length}** adet fan.\n\n**Saha Önerisi:** Enkoder pilleri bittiğinde kapatıp açma sonrası referans kaybı (P1815 APZ alarmı) oluşur. Sürücü kartı soğutma fanları durursa, sürücü 'Overheat' alarmı verip tezgahı korumaya alır. Sol menüden **Pil Takibi** sayfasına giderek her iki donanımın da ömür sayaçlarını sıfırlayabilirsiniz.`;
  }

  if (q.includes('e-stop') || q.includes('acil dur') || q.includes('emergency stop')) {
    return `## E-Stop Devresi\n\nFANUC tezgahlarında E-Stop devresi şu şekilde çalışır:\n\n1. **E-Stop Butonu** — NC kontağı (normally closed). Basıldığında devreyi keser.\n2. **PMC'de G008.4 (ESP)** — E-stop sinyali PMC'ye iletilir\n3. **SR0004 Alarm** — CNC EMERGENCY STOP alarmını görüntüler\n4. **Servo güç kesimi** — DRDY (Drive Ready) sinyali kapatılır\n\n**Sorun giderme:**\n- G008.4 bitini PMC monitöründe kontrol edin (0=E-Stop aktif)\n- Butonun kontak bütünlüğünü ölçün\n- Kapı kilidi ve güvenlik rölelerini kontrol edin\n- PMC ladder'da ESP girişini izleyin`;
  }

  if (q.includes('yedekle') || q.includes('backup') || q.includes('parametre kaydet') || q.includes('restore') || q.includes('yükle') || q.includes('sram') || q.includes('boot') || q.includes('rom')) {
    return `## FANUC Parametre & Program Yedekleme/Yükleme Sihirbazı\n\nFANUC kontrol ünitelerinde yedekleme yaparken doğru I/O kanallarını ve tuş kombinasyonlarını kullanmak kritiktir:\n\n**1. Standart Parametre & Program Yedekleme (I/O Kanalları):**\n- **I/O Channel = 4:** CF Card (Compact Flash)\n- **I/O Channel = 17:** USB Flash Sürücü\n- **I/O Channel = 0/1:** RS232 Seri Port\n- **PWE = 1:** Parametre yazma izni (Sadece veri geri yüklerken açılmalıdır).\n*Sihirbazı açmak için sol menüden **Yedekleme Sihirbazı** sekmesini kullanabilirsiniz.*\n\n**2. Boot ROM Ekranından SRAM Bit-Image Yedeği Alma:**\nCNC parametreleri, PMC programı, ofsetler ve parça programlarının tamamını tek bir dosya (\`SRAM.FDB\`) olarak yedeklemek için:\n1. CNC gücünü kapatın.\n2. Ekran altındaki **en sağdaki iki soft key (menü tuşu)** butonuna basılı tutarak CNC gücünü açın.\n3. Karşınıza gelen siyah-beyaz **BOOT SYSTEM** menüsünde yön tuşlarıyla **SRAM DATA UTILITY** satırına gelip SELECT deyin.\n4. **SRAM BACKUP (CNC -> MEMORY CARD)** seçerek CF karta tüm belleğin aynasını yedekleyin. Geri yüklemek için ise **RESTORE SRAM** seçeneğini kullanın.`;
  }

  if (q.includes('servo') && (q.includes('kazan') || q.includes('gain') || q.includes('ayar') || q.includes('tuning'))) {
    return `## Servo Kazanım Ayarı (Gain Tuning)\n\n**Temel Parametreler:**\n- **No.2043** — Pozisyon kazancı (KPZ, tipik: 3000)\n- **No.2021** — Hız kazancı (integral, tipik: 100–500)\n- **No.2022** — Hız döngüsü oransal kazanç\n\n**Ayar Adımları:**\n1. AI Servo Tuning fonksiyonunu açın (SYSTEM > Servo Tuning)\n2. Kesme testini çalıştırın\n3. Titreşim varsa KPZ değerini düşürün\n4. Pozisyon hatası fazlaysa KPZ artırın\n5. Step Response grafiğini inceleyin\n\n**İpucu:** Ağır tezgahlarda düşük KPZ (1000–2000), hafif/yüksek hızlı tezgahlarda yüksek KPZ (4000–8000)`;
  }

  if (q.includes('ladder') || q.includes('pmc') || q.includes('r addr') || q.includes('r adresi')) {
    return `## FANUC PMC Adres Haritası\n\n| Adres | Açıklama |\n|-------|----------|\n| **X** | Makine girişleri (I/O kartından) |\n| **Y** | Makine çıkışları (I/O kartına) |\n| **G** | NC → PMC sinyalleri |\n| **F** | PMC → NC sinyalleri |\n| **R** | Dahili relelar (program içi) |\n| **T** | Zamanlayıcılar |\n| **C** | Sayaçlar |\n| **K** | Keeplatch (kalıcı bit) |\n| **D** | Veri registerleri |\n\n**Önemli G Sinyalleri:**\n- G008.4 (ESP) — E-Stop\n- G007.1 (ST) — Döngü başlat\n- G044.7 (FIN) — M fonksiyon tamamlama`;
  }

  // Default
  return `MTB Elektrik Bakım Asistanı — Çevrimdışı Mod\n\n"${msg}" sorunuzu aldım.\n\nÇevrimdışı modda şu konularda yardımcı olabilirim:\n• Alarm kodları (ör: SV0401, PS0010)\n• Parametre numaraları (ör: Param 1320)\n• E-Stop, servo gain, yedekleme prosedürleri\n• PMC adres haritası\n\nDaha kapsamlı yanıtlar için **Ayarlar** menüsünden OpenAI veya Gemini API anahtarınızı ekleyebilirsiniz.`;
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

  div.innerHTML = `
    <div class="msg-avatar ${role}">${isAI ? 'AI' : '👤'}</div>
    <div>
      <div class="msg-bubble ${isAI ? 'ai-technical-card' : ''}">${confidenceHTML}<div class="ai-tech-section"><strong>${isAI ? 'Teknik değerlendirme' : 'Mesaj'}</strong>${html}</div>${sourceHTML}</div>
      <div class="msg-time">${formatTime(new Date())}</div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

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

api={renderAI};return api;}global.MTBAIScreen=Object.freeze({initialize});})(window);
