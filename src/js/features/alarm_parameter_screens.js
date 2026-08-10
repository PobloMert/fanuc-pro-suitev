(function(global){'use strict';let api;function initialize(deps){if(api)return api;const {State,createPage,escapeHTML,showToast,showModal,closeModal,canEdit,saveCustomAlarmNotes,navigate,alarmCategoryTag,sendAIMessage}=deps;
function renderAlarms() {
  const page = createPage('alarms');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚠️ FANUC Alarm Veritabanı</h1>
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px">
        <p style="margin:0">${State.alarms.length} alarm kodu — Servo, PMC, Program, Overtravel, Spindle</p>
        <div class="flex gap-1" style="flex-wrap:wrap">
          <span class="tag tag-red" style="font-size:10.5px">Servo (${State.alarms.filter(a => a.category === 'Servo').length})</span>
          <span class="tag tag-blue" style="font-size:10.5px">Program (${State.alarms.filter(a => a.category === 'Program').length})</span>
          <span class="tag tag-amber" style="font-size:10.5px">Spindle (${State.alarms.filter(a => a.category === 'Spindle').length})</span>
          <span class="tag tag-gray" style="font-size:10.5px">PMC (${State.alarms.filter(a => a.category === 'PMC').length})</span>
        </div>
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:340px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="alarm-search" placeholder="Kod veya no ara... (ör: SV0401, 401, servo)" />
        </div>
        <select id="alarm-cat-filter" style="width:150px">
          <option value="">Tüm Kategoriler</option>
          <option>Servo</option>
          <option>Program</option>
          <option>Overtravel</option>
          <option>Spindle</option>
          <option>Overheat</option>
          <option>PMC</option>
          <option>System</option>
          <option>External</option>
        </select>
        <select id="alarm-series-filter" style="width:130px">
          <option value="">Tüm Seriler</option>
          <option>0i-F</option>
          <option>30i-B</option>
          <option>31i-B</option>
          <option>32i-B</option>
        </select>
      </div>
    </div>
    <div class="page-body" style="padding:0">
      <div id="alarm-detail-pane" style="display:none; padding:20px 28px; border-bottom:1px solid var(--border); background:var(--bg-surface)"></div>
      <div style="overflow-y:auto; flex:1">
        <table class="data-table" id="alarm-table">
          <thead>
            <tr>
              <th>Kod</th>
              <th>Kategori</th>
              <th>Başlık</th>
              <th>Seri</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody id="alarm-tbody"></tbody>
        </table>
        <div id="alarm-pager" class="flex justify-between items-center" style="padding:10px 16px;border-top:1px solid var(--border)"></div>
      </div>
    </div>
  `;

  renderAlarmTable(State.alarms, page);

  page.querySelector('#alarm-search').addEventListener('input', () => filterAlarms(page));
  page.querySelector('#alarm-cat-filter').addEventListener('change', () => filterAlarms(page));
  page.querySelector('#alarm-series-filter').addEventListener('change', () => filterAlarms(page));

  return page;
}

function filterAlarms(page) {
  const rawQ = page.querySelector('#alarm-search').value.toLowerCase().trim();
  const cat = page.querySelector('#alarm-cat-filter').value;
  const series = page.querySelector('#alarm-series-filter').value;

  const featureResult = window.AlarmParameterFeature.filterAlarms(State.alarms, { query: rawQ, category: cat, series });
  renderAlarmTable(featureResult, page);
  return;

  const cleanQ = rawQ.replace(/[^a-z0-9]/g, '');

  const filtered = State.alarms.filter(a => {
    const catMatch = !cat || a.category === cat;
    const seriesMatch = !series || a.series.includes(series);
    if (!catMatch || !seriesMatch) return false;

    if (!rawQ) return true;

    const cleanCode = a.code.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    let numMatch = false;
    const queryNumMatch = rawQ.match(/\d+/);
    const codeNumMatch = a.code.match(/\d+/);

    if (queryNumMatch && codeNumMatch) {
      const qNum = parseInt(queryNumMatch[0], 10);
      const cNum = parseInt(codeNumMatch[0], 10);
      
      const qAlpha = rawQ.replace(/\d+/g, '').replace(/[^a-z]/g, '');
      const cAlpha = a.code.toLowerCase().replace(/\d+/g, '').replace(/[^a-z]/g, '');
      
      const alphaMatches = !qAlpha || cAlpha.includes(qAlpha);
      
      if (alphaMatches) {
        const diff = Math.abs(cNum - qNum);
        // Match if the query number is a substring of the alarm code's numeric part
        // OR if the numeric difference is within a tolerance of +/- 5 (fuzzy numeric search)
        if (codeNumMatch[0].includes(queryNumMatch[0]) || diff <= 5) {
          numMatch = true;
        }
      }
    }

    const textMatch = a.code.toLowerCase().includes(rawQ) ||
                      (cleanQ !== '' && cleanCode.includes(cleanQ)) ||
                      a.title.toLowerCase().includes(rawQ) ||
                      a.description.toLowerCase().includes(rawQ);

    return textMatch || numMatch;
  });
  renderAlarmTable(filtered, page);
}

function renderAlarmTable(alarms, page) {
  const tbody = (page || document).querySelector('#alarm-tbody');
  if (!tbody) return;
  if (!alarms.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted)">Alarm bulunamadı</td></tr>`;
    const pager = (page || document).querySelector('#alarm-pager');
    if (pager) pager.innerHTML = '';
    return;
  }
  const root = page || document;
  const requestedPage = Number(root.querySelector('#alarm-pager')?.dataset.page || 1);
  const pager = window.MTBPerformance?.pagerModel?.(alarms, requestedPage, 75) || { items: alarms, page: 1, total: alarms.length, totalPages: 1, first: alarms.length ? 1 : 0, last: alarms.length, hasPrevious: false, hasNext: false };
  tbody.innerHTML = pager.items.map(a => `
    <tr class="alarm-tr" data-code="${a.code}" style="cursor:pointer">
      <td><span class="font-mono text-sm" style="color:var(--text-accent); font-weight:600">${a.code}</span></td>
      <td><span class="tag ${alarmCategoryTag(a.category)}">${a.category}</span></td>
      <td><span style="font-size:12px">${a.title}</span></td>
      <td><span style="font-size:11px; color:var(--text-muted)">${a.series.join(', ')}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="showAlarmDetail('${a.code}')">
          Detay
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.alarm-tr').forEach(tr => {
    tr.addEventListener('click', () => showAlarmDetail(tr.dataset.code));
  });
  renderTablePager(root.querySelector('#alarm-pager'), pager, next => { root.querySelector('#alarm-pager').dataset.page = String(next); renderAlarmTable(alarms, root); });
}

function renderTablePager(container, pager, onPage) {
  if (!container) return;
  container.dataset.page = String(pager.page);
  container.innerHTML = `<span style="font-size:11px;color:var(--text-muted)">${pager.first}-${pager.last} / ${pager.total}</span><div class="flex gap-1"><button class="btn btn-ghost btn-sm" data-page-prev ${pager.hasPrevious ? '' : 'disabled'}>Ã–nceki</button><span style="font-size:11px;padding:6px">${pager.page} / ${pager.totalPages}</span><button class="btn btn-ghost btn-sm" data-page-next ${pager.hasNext ? '' : 'disabled'}>Sonraki</button></div>`;
  container.querySelector('[data-page-prev]')?.addEventListener('click', () => onPage(pager.page - 1));
  container.querySelector('[data-page-next]')?.addEventListener('click', () => onPage(pager.page + 1));
}

window.showAlarmDetail = function(code) {
  const alarm = State.alarms.find(a => a.code === code);
  if (!alarm) return;

  // Parse linked parameters
  const linkedParams = [];
  const textToScan = (alarm.description + ' ' + alarm.causes.join(' ') + ' ' + alarm.solutions.join(' ')).toLowerCase();
  
  State.parameters.forEach(p => {
    const regex = new RegExp('\\b' + p.no + '\\b');
    if (regex.test(textToScan) && p.no > 0) {
      linkedParams.push(p);
    }
  });

  showModal('alarm-detail', `
    <div class="modal-header">
      <span class="modal-title">
        <span class="font-mono" style="color:var(--text-accent); margin-right:8px">${escapeHTML(alarm.code)}</span>
        ${escapeHTML(alarm.title)}
      </span>
      <button class="modal-close" onclick="closeModal('alarm-detail')">✕</button>
    </div>
    <div class="flex gap-2 mb-3" style="flex-wrap:wrap">
      <span class="tag ${alarmCategoryTag(alarm.category)}">${escapeHTML(alarm.category)}</span>
      ${alarm.series.map(s => `<span class="tag tag-gray">${escapeHTML(s)}</span>`).join('')}
    </div>
    <div class="card" style="margin-bottom:12px">
      <div class="card-title mb-2">📋 Açıklama</div>
      <p style="font-size:12.5px; line-height:1.6; color:var(--text-secondary)">${escapeHTML(alarm.description)}</p>
    </div>
    <div class="grid-2" style="gap:12px">
      <div class="card">
        <div class="card-title mb-2" style="color:var(--amber)">⚠️ Olası Nedenler</div>
        <ul style="list-style:none; display:flex; flex-direction:column; gap:6px">
          ${alarm.causes.map(c => `
            <li style="display:flex; gap:8px; font-size:12px">
              <span style="color:var(--amber); flex-shrink:0">▸</span>
              <span style="color:var(--text-secondary)">${escapeHTML(c)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="card">
        <div class="card-title mb-2" style="color:var(--green)">✅ Çözüm Adımları</div>
        <ol style="list-style:none; display:flex; flex-direction:column; gap:6px">
          ${alarm.solutions.map((s, i) => `
            <li style="display:flex; gap:8px; font-size:12px">
              <span class="font-mono" style="color:var(--green); flex-shrink:0; min-width:16px">${i+1}.</span>
              <span style="color:var(--text-secondary)">${escapeHTML(s)}</span>
            </li>
          `).join('')}
        </ol>
      </div>
    </div>
    
    ${linkedParams.length > 0 ? `
      <div class="card mt-3">
        <div class="card-title mb-2" style="color:var(--text-accent)">⚙️ İlişkili Sistem Parametreleri</div>
        <div style="display:flex; flex-direction:column; gap:8px">
          ${linkedParams.map(p => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card2); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border)">
              <div style="font-size:12.5px">
                <strong class="font-mono" style="color:var(--text-accent); font-size:13px; margin-right:6px">No. ${escapeHTML(String(p.no))}</strong>
                <span style="color:var(--text-secondary)">${escapeHTML(p.name)}</span>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="goToParameterFromAlarm(${p.no})" style="font-size:11px; padding:2px 8px; border:1px solid var(--border)">
                ⚙️ Parametreye Git
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="card mt-3" style="border: 1px solid rgba(59, 130, 246, 0.2); background: rgba(59, 130, 246, 0.02)">
      <div class="flex justify-between items-center mb-2">
        <span class="card-title" style="color:var(--text-accent); font-size:12px">📝 Fabrika Özel Çözüm Notları</span>
        ${canEdit() ? `<span style="font-size:10px; font-weight:normal; color:var(--text-muted)">Düzenleme Yetkisi Var</span>` : ''}
      </div>
      
      <div id="custom-note-view-container" style="display:${State.custom_alarm_notes[alarm.code] ? 'block' : 'none'}">
        <p style="font-size:12px; line-height:1.6; color:var(--text-secondary); white-space:pre-wrap; background:var(--bg-card2); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border)" id="custom-note-text-display">${escapeHTML(State.custom_alarm_notes[alarm.code] || '')}</p>
        ${canEdit() ? `<button class="btn btn-secondary btn-sm mt-2" onclick="editCustomAlarmNote()">Notu Düzenle</button>` : ''}
      </div>

      <div id="custom-note-empty-container" style="display:${State.custom_alarm_notes[alarm.code] ? 'none' : 'block'}">
        <p style="font-size:11.5px; color:var(--text-muted); font-style:italic">Bu hata koduna ait fabrika tecrübe notu eklenmemiş.</p>
        ${canEdit() ? `<button class="btn btn-secondary btn-sm mt-2" onclick="editCustomAlarmNote()">+ Not Ekle</button>` : ''}
      </div>

      ${canEdit() ? `
        <div id="custom-note-edit-container" style="display:none; margin-top:8px">
          <textarea class="form-control" id="custom-note-textarea" rows="3" style="font-size:12px; width:100%; font-family:inherit" placeholder="Örn: CNC-02 tezgahında bu hata X ekseni motorunun arkasındaki soketin gevşemesinden dolayı oluyor. Önce soketi sıkın...">${escapeHTML(State.custom_alarm_notes[alarm.code] || '')}</textarea>
          <div class="flex gap-2 mt-2">
            <button class="btn btn-primary btn-sm" onclick="saveCustomAlarmNote('${alarm.code}')">Notu Kaydet</button>
            <button class="btn btn-ghost btn-sm" onclick="cancelEditCustomAlarmNote('${alarm.code}')">İptal</button>
          </div>
        </div>
      ` : ''}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('alarm-detail')">Kapat</button>
      <button class="btn btn-primary" onclick="askAIAboutAlarm('${alarm.code}')">
        🤖 AI'ya Sor
      </button>
    </div>
  `, 'lg');
};

window.editCustomAlarmNote = function() {
  const v = document.getElementById('custom-note-view-container');
  const em = document.getElementById('custom-note-empty-container');
  const ed = document.getElementById('custom-note-edit-container');
  if (v) v.style.display = 'none';
  if (em) em.style.display = 'none';
  if (ed) ed.style.display = 'block';
  const ta = document.getElementById('custom-note-textarea');
  if (ta) ta.focus();
};

window.cancelEditCustomAlarmNote = function(code) {
  const v = document.getElementById('custom-note-view-container');
  const em = document.getElementById('custom-note-empty-container');
  const ed = document.getElementById('custom-note-edit-container');
  const ta = document.getElementById('custom-note-textarea');
  
  if (code && ta) {
    ta.value = State.custom_alarm_notes[code] || '';
  }
  const hasNote = !!(ta && ta.value.trim());

  if (v) v.style.display = hasNote ? 'block' : 'none';
  if (em) em.style.display = hasNote ? 'none' : 'block';
  if (ed) ed.style.display = 'none';
};

window.saveCustomAlarmNote = async function(code) {
  if (!canEdit()) { showToast('Düzenleme yetkiniz yok', 'error'); return; }
  const ta = document.getElementById('custom-note-textarea');
  if (!ta) return;
  const noteVal = ta.value.trim();

  if (noteVal) {
    State.custom_alarm_notes[code] = noteVal;
  } else {
    delete State.custom_alarm_notes[code];
  }

  const ok = await saveCustomAlarmNotes();
  if (ok) {
    showToast('Fabrika notu başarıyla kaydedildi ✓', 'success');
    const disp = document.getElementById('custom-note-text-display');
    if (disp) disp.textContent = noteVal;
    window.cancelEditCustomAlarmNote(code);
  }
};

window.goToParameterFromAlarm = function(paramNo) {
  closeModal('alarm-detail');
  navigate('parameters');
  setTimeout(() => {
    const page = document.getElementById('page-parameters');
    const searchInput = document.getElementById('param-search');
    if (searchInput) {
      searchInput.value = paramNo;
      if (page) {
        filterParams(page);
      }
    }
  }, 100);
};

window.askAIAboutAlarm = function(code) {
  const alarm = State.alarms.find(a => a.code === code);
  if (alarm) {
    State.activeDiagnostic = { type: 'alarm', code, data: alarm };
  }
  closeModal('alarm-detail');
  navigate('ai');
  setTimeout(() => {
    const input = document.getElementById('ai-input');
    if (input) {
      input.value = `FANUC alarm kodu ${code} hakkında detaylı bilgi ver ve çözüm önerilerini açıkla.`;
      input.dispatchEvent(new Event('input'));
      sendAIMessage();
    }
  }, 300);
};

// ════════════════════════════════════════════════════════════════
//  PARAMETERS
// ════════════════════════════════════════════════════════════════
window.CurrentParamTab = 'db';

function renderParameters() {
  const page = createPage('parameters');
  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ FANUC Parametre İnceleme</h1>
      <p>Parametreleri salt okunur inceleyin; uygulama CNC'ye yazmaz veya koruma kilidi aşma talimatı vermez.</p>
      
      <!-- Tabs -->
      <div class="tabs mt-3" style="border-bottom:1px solid var(--border); display:flex; gap:16px; padding-bottom:8px">
        <button class="tab-btn" id="tab-par-db" onclick="switchParamTab('db')" style="background:none; border:none; color:var(--text-accent); font-weight:bold; cursor:pointer">
          🔎 Parametre Veritabanı
        </button>
        <button class="tab-btn" id="tab-par-pwe" onclick="switchParamTab('pwe')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer">
          🔒 Yazma Koruması ve Eskalasyon
        </button>
      </div>
    </div>
    
    <div class="page-body" id="param-tab-content" style="padding-top:16px"></div>
  `;

  setTimeout(() => {
    switchParamTab(window.CurrentParamTab, page);
  }, 10);

  return page;
}

window.switchParamTab = function(tab, page = document) {
  window.CurrentParamTab = tab;

  const dbBtn = page.querySelector('#tab-par-db');
  const pweBtn = page.querySelector('#tab-par-pwe');
  if (dbBtn && pweBtn) {
    dbBtn.style.color = tab === 'db' ? 'var(--text-accent)' : 'var(--text-secondary)';
    dbBtn.style.fontWeight = tab === 'db' ? 'bold' : 'normal';
    pweBtn.style.color = tab === 'pwe' ? 'var(--text-accent)' : 'var(--text-secondary)';
    pweBtn.style.fontWeight = tab === 'pwe' ? 'bold' : 'normal';
  }

  const content = page.querySelector('#param-tab-content');
  if (!content) return;

  if (tab === 'db') {
    content.innerHTML = `
      <div class="flex gap-2 mb-3" style="padding:0 20px; flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:300px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="param-search" placeholder="Parametre no veya adı ara... (ör: 1320, soft limit)" />
        </div>
        <select id="param-cat-filter" style="width:140px">
          <option value="">Tüm Kategoriler</option>
          <option value="axis">Eksen</option>
          <option value="spindle">Spindle</option>
          <option value="feed">Besleme</option>
          <option value="io">I/O</option>
          <option value="pmc">PMC</option>
          <option value="display">Ekran</option>
        </select>
        <div class="flex gap-1" id="param-range-filters" style="flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm active" onclick="switchParamRangeFilter(this, 'all')">Tümü</button>
          <button class="btn btn-secondary btn-sm" onclick="switchParamRangeFilter(this, '1000-1200')" title="1000 - 1200 aralığı">Eksen (1000+)</button>
          <button class="btn btn-secondary btn-sm" onclick="switchParamRangeFilter(this, '1300-1400')" title="1300 - 1400 aralığı">Limitler (1300+)</button>
          <button class="btn btn-secondary btn-sm" onclick="switchParamRangeFilter(this, '1800-1900')" title="1800 - 1900 aralığı">Referans/Boşluk (1800+)</button>
          <button class="btn btn-secondary btn-sm" onclick="switchParamRangeFilter(this, '3000-3300')" title="3000 - 3300 aralığı">Ekran/Dil (3000+)</button>
          <button class="btn btn-secondary btn-sm" onclick="switchParamRangeFilter(this, '4000-4100')" title="4000 - 4100 aralığı">Spindle (4000+)</button>
        </div>
      </div>
      <div style="overflow:auto; flex:1">
        <table class="data-table" id="param-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Adı</th>
              <th>Kategori</th>
              <th>Tip</th>
              <th>Aralık</th>
              <th>Varsayılan</th>
              <th>Açıklama</th>
            </tr>
          </thead>
          <tbody id="param-tbody"></tbody>
        </table>
        <div id="param-pager" class="flex justify-between items-center" style="padding:10px 16px;border-top:1px solid var(--border)"></div>
      </div>
    `;

    window.CurrentParamRange = 'all';
    renderParamTable(State.parameters, page);
    page.querySelector('#param-search').addEventListener('input', () => filterParams(page));
    page.querySelector('#param-cat-filter').addEventListener('change', () => filterParams(page));
  } else {
    content.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap:16px; padding:0 20px">
        
        <!-- Read-only policy -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title" style="color:var(--text-accent)">🔒 Parameter Write Enable (PWE) güvenlik politikası</div>
          <p style="font-size:12px; color:var(--text-secondary); line-height:1.5">
            Bu uygulama PWE açma, kilit aşma, parametre yazma veya PMC sinyali zorlama adımları sağlamaz.
          </p>

          <div style="font-size:12.5px; display:flex; flex-direction:column; gap:8px">
            <strong>Güvenli inceleme sırası</strong>
            <div>• Kontrol serisini, yazılım revizyonunu ve makine üreticisini kaydedin.</div>
            <div>• Güncel yedeği alın ve geri okunabilirliğini doğrulayın.</div>
            <div>• Eski/yeni değerleri ve değişiklik gerekçesini karşılaştırma raporunda belgeleyin.</div>
            <div>• Yazma gerektiren işlemi yalnız yetkili bakım personeline, ilgili OEM/FANUC seri-revizyon prosedürüyle eskale edin.</div>
          </div>
        </div>

        <!-- Right: Coordinate & Program Unlock parameters -->
        <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:12px">
          <div class="card-title">⚙️ İş Sıfırı (G54) ve Macro Program Kilitleri</div>
          <p style="font-size:12px; color:var(--text-secondary); line-height:1.5">
            Operatörlerin G54 iş sıfırlarını değiştirmesini engellemek veya O9000 macro programlarını görünür/düzenlenebilir yapmak için parametreler:
          </p>

          <div style="background:#0f172a; padding:12px; border-radius:4px; font-family:monospace; font-size:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:8px">
            <div>
              <strong style="color:var(--text-accent)">• Parameter 3290 #0 (WPCO):</strong><br>
              <code>1</code> yapıldığında, operatörün G54-G59 sayfasına veri yazması engellenir (İş sıfırı kilidi). Yazmak için <code>0</code> yapılmalıdır.
            </div>
            <div>
              <strong style="color:var(--text-accent)">• Parameter 3202 #4 (NE9):</strong><br>
              <code>1</code> olduğunda, O9000-O9999 aralığındaki imalatçı özel makro programları koruma altındadır (Düzenlenemez/Silinemez). Düzenleme yapmak veya yedeklemek için <code>0</code> yapılmalıdır. (Not: Bit 0 (NE8) ise O8000-O8999 makrolarını korur).
            </div>
          </div>
        </div>

      </div>
    `;
  }
};

window.switchParamRangeFilter = function(btn, rangeVal) {
  const container = document.getElementById('param-range-filters');
  if (container) {
    container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  }
  btn.classList.add('active');
  window.CurrentParamRange = rangeVal;
  filterParams(document.getElementById('page-parameters'));
};

function filterParams(page) {
  if (!page) page = document.getElementById('page-parameters') || document;
  const searchInput = page.querySelector('#param-search');
  const catSelect = page.querySelector('#param-cat-filter');
  if (!searchInput || !catSelect) return;
  const q = searchInput.value.toLowerCase();
  const cat = catSelect.value;
  const range = window.CurrentParamRange || 'all';

  const featureResult = window.AlarmParameterFeature.filterParameters(State.parameters, { query: q, category: cat, range });
  renderParamTable(featureResult, page);
  return;

  const filtered = State.parameters.filter(p => {
    const textMatch = !q || String(p.no).includes(q) || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    const catMatch = !cat || p.category === cat;
    
    let rangeMatch = true;
    if (range === '1000-1200') {
      rangeMatch = p.no >= 1000 && p.no <= 1200;
    } else if (range === '1300-1400') {
      rangeMatch = p.no >= 1300 && p.no <= 1400;
    } else if (range === '1800-1900') {
      rangeMatch = p.no >= 1800 && p.no <= 1900;
    } else if (range === '3000-3300') {
      rangeMatch = p.no >= 3000 && p.no <= 3300;
    } else if (range === '4000-4100') {
      rangeMatch = p.no >= 4000 && p.no <= 4100;
    }

    return textMatch && catMatch && rangeMatch;
  });
  renderParamTable(filtered, page);
}

function renderParamTable(params, page) {
  const tbody = (page || document).querySelector('#param-tbody');
  if (!tbody) return;
  if (!params.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">Parametre bulunamadı</td></tr>`;
    const pager = (page || document).querySelector('#param-pager');
    if (pager) pager.innerHTML = '';
    return;
  }
  const catLabels = { axis:'Eksen', spindle:'Spindle', feed:'Besleme', io:'I/O', pmc:'PMC', display:'Ekran' };
  const catTags   = { axis:'tag-blue', spindle:'tag-cyan', feed:'tag-green', io:'tag-amber', pmc:'tag-purple', display:'tag-gray' };
  const root = page || document;
  const requestedPage = Number(root.querySelector('#param-pager')?.dataset.page || 1);
  const pager = window.MTBPerformance?.pagerModel?.(params, requestedPage, 75) || { items: params, page: 1, total: params.length, totalPages: 1, first: params.length ? 1 : 0, last: params.length, hasPrevious: false, hasNext: false };
  tbody.innerHTML = pager.items.map(p => `
    <tr style="cursor:pointer" onclick="showParamDetail('${p.no}')">
      <td><span class="font-mono" style="color:var(--text-accent); font-weight:600; font-size:13px">${p.no}</span></td>
      <td><span style="font-weight:500; font-size:12px">${p.name}</span></td>
      <td><span class="tag ${catTags[p.category]||'tag-gray'}">${catLabels[p.category]||p.category}</span></td>
      <td><span class="font-mono text-sm" style="color:var(--text-muted)">${p.dataType}</span></td>
      <td><span class="font-mono text-sm">${p.range}</span></td>
      <td><span class="font-mono text-sm" style="color:var(--green)">${p.default}</span></td>
      <td><span style="font-size:11.5px; color:var(--text-secondary)">${p.description}</span><div style="font-size:9.5px;color:var(--text-muted);margin-top:3px">${escapeHTML((p.applicableSeries || ['Seri doğrulanmadı']).join ? (p.applicableSeries || ['Seri doğrulanmadı']).join(', ') : p.applicableSeries)} · ${escapeHTML(p.manualNumber || 'Kılavuz belirtilmemiş')} · ${escapeHTML(p.manualRevision || 'Revizyon belirtilmemiş')}</div></td>
    </tr>
  `).join('');
  renderTablePager(root.querySelector('#param-pager'), pager, next => { root.querySelector('#param-pager').dataset.page = String(next); renderParamTable(params, root); });
}

window.showParamDetail = function(no) {
  const param = State.parameters.find(p => p.no == no);
  if (!param) return;

  const bitDescriptions = {
    1815: {
      5: "APC (Mutlak Enkoder Aktif)",
      4: "APZ (Referans Pozisyonu Senkronize)"
    },
    1006: {
      0: "ROT (Lineer/Dairesel Eksen Tipi Seçimi)",
      3: "DIA (Çap/Yarıçap Programlama Seçimi)",
      5: "ZMI (Manuel Referansa Dönüş Hareketi Yönü)"
    },
    3111: {
      0: "SVS (Servo Ayar ve Tuning Ekranı Gösterimi)",
      1: "SPS (Spindle Tuning Ekranı Gösterimi)",
      5: "OPS (Operatör Geçmişi İzleme Kaydı)",
      6: "OPH (Operatör Geçmişi Ekranı Gösterimi)",
      7: "NPA (Alarm Ekranı Geçişi / Otomatik Sayfa Değişimi)"
    },
    3202: {
      0: "NE8 (8000-8999 Program Kilidi / Koruma Durumu)",
      4: "NE9 (9000-9999 Program Kilidi / Koruma Durumu)"
    },
    1001: {
      0: "INM (Metrik/İnç Taban Ölçü Sistemi Seçimi)"
    },
    1002: {
      0: "JAX (Aynı Anda Manuel Hareketi Destekleyen Eksen Sayısı)",
      1: "DLZ (Decel Switch'siz Referans Noktası Bulma)",
      7: "IDG (Absolute Enkoder Referans Sıfırlama İnhibisyonu)"
    }
  };

  const isBit = param.dataType && param.dataType.toLowerCase() === 'bit';
  const defaultValue = (param.default && /^[01]+$/.test(param.default.trim()))
    ? param.default.trim().padStart(8, '0')
    : '00000000';

  showModal('param-detail', `
    <div class="modal-header">
      <span class="modal-title">Parametre No. <span class="font-mono" style="color:var(--text-accent)">${escapeHTML(String(param.no))}</span> — ${escapeHTML(param.name)}</span>
      <button class="modal-close" onclick="closeModal('param-detail')">✕</button>
    </div>
    <div class="grid-2" style="gap:10px; margin-bottom:14px">
      <div class="card"><div class="card-sub">Veri Tipi</div><div style="font-family:var(--font-mono);margin-top:4px">${escapeHTML(param.dataType)}</div></div>
      <div class="card"><div class="card-sub">Aralık</div><div style="font-family:var(--font-mono);margin-top:4px">${escapeHTML(param.range || '—')}</div></div>
      <div class="card"><div class="card-sub">Varsayılan</div><div style="font-family:var(--font-mono);color:var(--green);margin-top:4px">${escapeHTML(param.default || '—')}</div></div>
      <div class="card"><div class="card-sub">Kategori</div><div style="margin-top:4px">${escapeHTML(param.category)}</div></div>
    </div>
    <div class="card">
      <div class="card-title mb-2">📋 Açıklama</div>
      <p style="font-size:12.5px; line-height:1.6; color:var(--text-secondary)">${escapeHTML(param.description)}</p>
      ${param.note ? `<div style="margin-top:8px; padding:8px; background:var(--accent-glow); border-radius:var(--radius-sm); font-size:11.5px; color:var(--text-accent)">💡 ${escapeHTML(param.note)}</div>` : ''}
    </div>
    <div class="card mt-3" style="border-left:3px solid var(--amber)">
      <div class="card-title mb-2">Kaynak ve uygulanabilirlik</div>
      <p style="font-size:11.5px;color:var(--text-secondary)"><strong>Seri:</strong> ${escapeHTML(Array.isArray(param.applicableSeries) ? param.applicableSeries.join(', ') : (param.applicableSeries || 'Seri doğrulanmadı'))}<br><strong>Kılavuz:</strong> ${escapeHTML(param.manualNumber || 'Belirtilmemiş')} · <strong>Revizyon:</strong> ${escapeHTML(param.manualRevision || 'Belirtilmemiş')}<br>${escapeHTML(param.applicabilityNote || 'Makine üreticisi dokümanı ve kontrol yazılım revizyonuyla doğrulayın.')}</p>
      <p style="font-size:11px;color:var(--amber);margin-top:6px">Salt okunur referans: uygulama CNC'ye parametre yazmaz.</p>
    </div>

    ${isBit ? `
      <div class="card mt-3" style="border: 1px solid rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.02)">
        <div class="card-title mb-1" style="font-size:12.5px; color:var(--text-accent)">🖥️ İnteraktif 8-Bit Değer Simülatörü</div>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px">Yerel simülasyonda bitlerin anlamını inceleyebilirsiniz; değişiklik CNC'ye gönderilmez.</p>
        
        <div class="flex gap-2 justify-center mb-3" style="flex-wrap:wrap">
          ${[7, 6, 5, 4, 3, 2, 1, 0].map(bit => {
            const desc = (bitDescriptions[param.no] && bitDescriptions[param.no][bit]) || `Bit ${bit}`;
            const initialVal = defaultValue[7 - bit];
            const isSet = initialVal === '1';
            const btnBorder = isSet ? 'var(--green)' : 'var(--border)';
            const btnBg = isSet ? 'rgba(16,185,129,0.03)' : 'var(--bg-card2)';
            return `
              <button class="param-bit-btn" id="bit-btn-${bit}" onclick="toggleParamDetailBit(${bit})" title="${escapeHTML(desc)}" style="width:52px; height:52px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:2px solid ${btnBorder}; background:${btnBg}; border-radius:var(--radius-sm); cursor:pointer; transition:all 0.15s">
                <span style="font-size:9px; color:var(--text-muted); font-weight:600">${bitDescriptions[param.no] && bitDescriptions[param.no][bit] ? escapeHTML(bitDescriptions[param.no][bit].split(' ')[0]) : 'B' + bit}</span>
                <strong style="font-size:15px; color:${isSet ? 'var(--green)' : 'var(--text-secondary)'}" id="bit-val-${bit}">${initialVal}</strong>
              </button>
            `;
          }).join('')}
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; font-family:var(--font-mono); font-size:12.5px; padding-top:8px; border-top:1px solid var(--border)">
          <span>İkilik (Binary): <strong id="param-bit-binary" style="color:var(--text-accent)">${escapeHTML(defaultValue)}</strong></span>
          <span>Ondalık (Decimal): <strong id="param-bit-decimal" style="color:var(--green)">${parseInt(defaultValue, 2)}</strong></span>
        </div>
      </div>
    ` : ''}

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('param-detail')">Kapat</button>
      <button class="btn btn-primary" onclick="askAIAboutParam(${param.no})">🤖 AI'ya Sor</button>
    </div>
  `, 'lg');
};

window.toggleParamDetailBit = function(bit) {
  const strong = document.getElementById(`bit-val-${bit}`);
  const btn = document.getElementById(`bit-btn-${bit}`);
  if (!strong) return;

  const currentVal = strong.textContent === '1' ? '0' : '1';
  strong.textContent = currentVal;
  strong.style.color = currentVal === '1' ? 'var(--green)' : 'var(--text-secondary)';
  if (currentVal === '1') {
    btn.style.borderColor = 'var(--green)';
    btn.style.background = 'rgba(16,185,129,0.03)';
  } else {
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'var(--bg-card2)';
  }

  let binary = '';
  for (let b = 7; b >= 0; b--) {
    const s = document.getElementById(`bit-val-${b}`);
    binary += s ? s.textContent : '0';
  }

  const binarySpan = document.getElementById('param-bit-binary');
  const decimalSpan = document.getElementById('param-bit-decimal');
  if (binarySpan) binarySpan.textContent = binary;
  if (decimalSpan) decimalSpan.textContent = parseInt(binary, 2);
};

window.askAIAboutParam = function(no) {
  const param = State.parameters.find(p => p.no == no);
  if (param) {
    State.activeDiagnostic = { type: 'parameter', code: String(no), data: param };
  }
  closeModal('param-detail');
  navigate('ai');
  setTimeout(() => {
    const input = document.getElementById('ai-input');
    if (input) {
      input.value = `FANUC parametre No.${no} hakkında salt okunur teknik açıklama yap. Seri/revizyon uygulanabilirliğini ve güvenli inceleme yöntemini belirt; yazma adımı verme.`;
      sendAIMessage();
    }
  }, 300);
};

// ════════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════════

api={renderAlarms,renderParameters};return api;}global.MTBAlarmParameterScreens=Object.freeze({initialize});})(window);
