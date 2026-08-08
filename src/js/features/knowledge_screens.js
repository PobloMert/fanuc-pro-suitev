(function(global){'use strict';let api;function initialize(deps){if(api)return api;const {State,createPage,escapeHTML,showToast,navigate,saveKnowledgePreferences}=deps;
function renderLibrary() {
  const page = createPage('library');
  page.innerHTML = `
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1>📚 Tezgah Kitaplığı</h1>
          <p>${State.library.length} teknik doküman — Operatör, Bakım, PMC, Servo, Elektrik, Mekanik</p>
        </div>
        <button class="btn btn-primary" id="btn-import-book">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          PDF Ekle
        </button>
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <div class="search-bar" style="flex:1; max-width:320px">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="lib-search" placeholder="Kitap ara..." />
        </div>
        <select id="lib-cat-filter" style="width:160px">
          <option value="">Tüm Kategoriler</option>
          <option>Operatör</option>
          <option>Bakım</option>
          <option>Parametre</option>
          <option>PMC / PLC</option>
          <option>Servo</option>
          <option>Spindle</option>
          <option>Elektrik</option>
          <option>Mekanik</option>
        </select>
        <select id="lib-series-filter" style="width:140px">
          <option value="">Tüm Seriler</option>
          <option>0i-F</option>
          <option>30i-B</option>
          <option>31i-B</option>
          <option>Genel</option>
        </select>
        <select id="lib-view-filter" style="width:150px"><option value="all">Tüm Belgeler</option><option value="favorites">Favoriler</option><option value="recent">Son Görüntülenenler</option></select>
      </div>
    </div>
    <div class="page-body">
      <!-- Offline Knowledge Packs Card -->
      <div class="card mb-4" style="padding:16px; background:var(--bg-card2)">
        <div class="card-title mb-3" style="display:flex; align-items:center; justify-content:space-between">
          <span>📦 Çevrimdışı Kılavuz Paketleri (Offline Knowledge Packs)</span>
          <span class="tag tag-blue" style="font-size:11px">İnternetsiz Fabrika Kullanımı</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
          ${(window.OFFLINE_PACKS || []).map(p => `
            <div style="background:var(--bg-card); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border); display:flex; flex-direction:column; justify-content:space-between">
              <div>
                <div style="font-weight:700; font-size:12.5px; color:var(--text-accent); margin-bottom:4px">${escapeHTML(p.name)}</div>
                <div style="font-size:11px; color:var(--text-secondary); margin-bottom:8px">${escapeHTML(p.desc)}</div>
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; border-top:1px solid var(--border-light); padding-top:8px">
                <span class="font-mono text-xs" style="color:var(--text-muted)">${p.size} · ${p.version}</span>
                ${p.status === 'installed' ? `
                  <span class="tag tag-green" style="font-size:11px">✅ Çevrimdışı Hazır</span>
                ` : `
                  <button class="btn btn-primary btn-sm" id="btn-pack-${p.id}" onclick="downloadOfflinePack('${p.id}')" style="font-size:11px; padding:3px 10px">
                    📥 İndir & Arşivle
                  </button>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card mb-4"><div class="card-title mb-2">🔎 Birleşik Yerel Bilgi Araması</div><div style="font-size:11px;color:var(--text-secondary)">Kılavuz başlıkları, açıklamalar, bölümler ve alarm kataloğu çevrimdışı tam metin indeksinde birlikte aranır.</div><div id="knowledge-search-results" style="margin-top:10px"></div></div>
      <div id="lib-grid" class="grid-2"></div>
    </div>

  `;

  renderLibraryGrid(State.library);

  page.querySelector('#lib-search').addEventListener('input', filterLibrary);
  page.querySelector('#lib-cat-filter').addEventListener('change', filterLibrary);
  page.querySelector('#lib-series-filter').addEventListener('change', filterLibrary);
  page.querySelector('#lib-view-filter').addEventListener('change', filterLibrary);
  page.querySelector('#btn-import-book').addEventListener('click', importBook);

  function filterLibrary() {
    const q = page.querySelector('#lib-search').value.toLowerCase();
    const cat = page.querySelector('#lib-cat-filter').value;
    const series = page.querySelector('#lib-series-filter').value;
    const view = page.querySelector('#lib-view-filter').value;
    const favorites = State.settings.knowledgeFavorites || [];
    const recent = State.settings.knowledgeRecent || [];
    const filtered = State.library.filter(b =>
      (!q || [b.id,b.title,b.description,...(b.chapters||[])].join(' ').toLowerCase().includes(q)) &&
      (!cat || b.category === cat) &&
      (!series || b.series.includes(series)) &&
      (view === 'all' || (view === 'favorites' && favorites.includes(b.id)) || (view === 'recent' && recent.includes(b.id)))
    );
    renderLibraryGrid(filtered);
    const results = page.querySelector('#knowledge-search-results');
    if (!q) { results.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Alarm kodu veya teknik terim yazın.</span>'; return; }
    const alarmHits = State.alarms.filter(a => [a.code,a.title,a.description,...(a.causes||[]),...(a.solutions||[])].join(' ').toLowerCase().includes(q)).slice(0, 8);
    results.innerHTML = alarmHits.length ? alarmHits.map(a => `<button class="btn btn-ghost btn-sm" style="margin:3px" onclick="openAlarmFromKnowledge('${escapeHTML(a.code)}')">${escapeHTML(a.code)} — ${escapeHTML(a.title)}</button>`).join('') : '<span style="font-size:11px;color:var(--text-muted)">Alarm kataloğunda eşleşme yok.</span>';
  }

  function renderLibraryGrid(books) {
    const grid = page.querySelector('#lib-grid');
    if (!books.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg><p>Kitap bulunamadı</p></div>`;
      return;
    }
    grid.innerHTML = books.map(b => `
      <div class="card book-card" data-id="${b.id}">
        <div class="flex items-center gap-3 mb-3">
          <div class="book-icon">${bookIcon(b.category)}</div>
          <div style="flex:1; min-width:0">
            <div class="card-title truncate">${escapeHTML(b.title)}</div>
            <div class="card-sub">${escapeHTML(b.series)} · ${b.pages} sayfa</div>
          </div>
          <span class="tag ${bookCatTag(b.category)}">${escapeHTML(b.category)}</span>
          <button class="btn btn-ghost btn-sm btn-icon" title="Favori" onclick="event.stopPropagation(); toggleKnowledgeFavorite('${b.id}')">${(State.settings.knowledgeFavorites||[]).includes(b.id)?'★':'☆'}</button>
        </div>
        <p style="font-size:11.5px; color:var(--text-secondary); line-height:1.5; margin-bottom:12px">${escapeHTML(b.description)}</p>
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:10px">
          <strong>Sürüm:</strong> ${escapeHTML(b.version || 'Yerel 2026.1')} · <strong>Kaynak:</strong> ${escapeHTML(b.id)}<br>
          <strong style="color:var(--text-secondary)">Bölümler:</strong><br>
          ${b.chapters.slice(0, 3).map(escapeHTML).join(' · ')}${b.chapters.length > 3 ? ` · +${b.chapters.length-3} daha` : ''}
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" onclick="openBook('${b.id}')">
            <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            İncele
          </button>
          <button class="btn btn-secondary btn-sm" onclick="openChapters('${b.id}')">
            <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Bölümler
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" title="PDF Aç" onclick="openBookPDF('${b.id}')">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="openKnowledgeNote('${b.id}')">Yerel Not</button>
          <button class="btn btn-ghost btn-sm" onclick="openBookPDFPage('${b.id}')">Sayfaya Git</button>
        </div>
      </div>
    `).join('');
  }

  return page;
}

function bookIcon(cat) {
  const icons = { Operatör:'📖', Bakım:'🔧', Parametre:'⚙️', 'PMC / PLC':'💻', Servo:'⚡', Spindle:'🔄', Elektrik:'🔌', Mekanik:'⚙️' };
  return `<div style="font-size:28px">${icons[cat] || '📄'}</div>`;
}
function bookCatTag(cat) {
  const map = { Operatör:'tag-blue', Bakım:'tag-amber', Parametre:'tag-red', 'PMC / PLC':'tag-purple', Servo:'tag-cyan', Spindle:'tag-green', Elektrik:'tag-amber', Mekanik:'tag-gray' };
  return map[cat] || 'tag-gray';
}

window.openBook = function(id) {
  const book = State.library.find(b => b.id === id);
  if (!book) return;
  State.settings.knowledgeRecent = [id, ...(State.settings.knowledgeRecent || []).filter(x => x !== id)].slice(0, 20);
  saveKnowledgePreferences();
  showModal('book-detail', `
    <div class="modal-header">
      <span class="modal-title">${escapeHTML(book.title)}</span>
      <button class="modal-close" onclick="closeModal('book-detail')">✕</button>
    </div>
    <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap">
      <span class="tag tag-blue">${escapeHTML(book.series)}</span>
      <span class="tag ${bookCatTag(book.category)}">${escapeHTML(book.category)}</span>
      <span class="tag tag-gray">${book.language === 'TR' ? '🇹🇷 Türkçe' : escapeHTML(book.language)}</span>
      <span class="tag tag-gray">${book.pages} Sayfa</span>
    </div>
    <p style="font-size:12.5px; color:var(--text-secondary); line-height:1.6; margin-bottom:16px">${escapeHTML(book.description)}</p>
    <strong style="font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted)">İçindekiler</strong>
    <div style="margin-top:8px; display:flex; flex-direction:column; gap:4px">
      ${book.chapters.map((ch, i) => `
        <div style="display:flex; gap:10px; align-items:center; padding:6px 10px; background:var(--bg-card2); border-radius:var(--radius-sm)">
          <span class="font-mono text-sm" style="color:var(--accent); min-width:20px">${i+1}</span>
          <span style="font-size:12px">${escapeHTML(ch)}</span>
        </div>
      `).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('book-detail')">Kapat</button>
      <button class="btn btn-primary" onclick="openBookPDF('${book.id}'); closeModal('book-detail')">
        <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        PDF Aç
      </button>
    </div>
  `);
};

window.openChapters = window.openBook;

window.openBookPDF = async function(id, pageNumber = null) {
  const book = State.library.find(b => b.id === id);
  if (!book) return;
  if (book.webUrl) {
    navigate('pdf_viewer', { bookId: id, filePath: book.webUrl, title: book.title, pageNumber });
    return;
  }
  const savedPath = State.settings.pdfPaths[id];
  if (savedPath) {
    navigate('pdf_viewer', { bookId: id, filePath: savedPath, title: book.title, pageNumber });
  } else {
    const filters = [{ name: 'PDF Dosyası', extensions: ['pdf'] }];
    const filePath = await window.electronAPI.openFileDialog(filters);
    if (filePath) {
      State.settings.pdfPaths[id] = filePath;
      await saveSettings();
      showToast('PDF kılavuzu başarıyla ilişkilendirildi.', 'success');
      navigate('pdf_viewer', { bookId: id, filePath, title: book.title, pageNumber });
    } else {
      showToast('Kılavuz için PDF dosyası seçilmedi.', 'info');
    }
  }
};

window.changeBookPDF = async function(id) {
  const book = State.library.find(b => b.id === id);
  if (!book) return;
  const filters = [{ name: 'PDF Dosyası', extensions: ['pdf'] }];
  const filePath = await window.electronAPI.openFileDialog(filters);
  if (filePath) {
    State.settings.pdfPaths[id] = filePath;
    await saveSettings();
    showToast('PDF kılavuzu güncellendi.', 'success');
    navigate('pdf_viewer', { bookId: id, filePath, title: book.title });
  }
};

async function importBook() {
  const filters = [{ name: 'PDF Dosyası', extensions: ['pdf'] }];
  const filePath = await window.electronAPI.openFileDialog(filters);
  if (!filePath) return;
  showToast('PDF kütüphaneye eklendi (demo)', 'success');
}

function renderPdfViewer(extraData) {
  const page = createPage('pdf_viewer');
  if (!extraData || !extraData.filePath) {
    page.innerHTML = `
      <div class="page-header">
        <div class="flex items-center gap-3">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="navigate('library')">
            <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>
          </button>
          <h1>PDF Okuyucu</h1>
        </div>
      </div>
      <div class="page-body">
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          <p>Herhangi bir doküman yüklenmedi. Lütfen kitaplıktan bir kitap seçip "PDF Aç" butonuna basın.</p>
        </div>
      </div>
    `;
    return page;
  }

  const { bookId, filePath, title, pageNumber } = extraData;
  const isWeb = filePath.startsWith('http://') || filePath.startsWith('https://');
  const baseFileUrl = isWeb ? filePath : 'app-file:///' + filePath.replace(/\\/g, '/');
  const fileUrl = pageNumber ? `${baseFileUrl}#page=${pageNumber}` : baseFileUrl;

  page.innerHTML = `
    <div class="page-header" style="padding: 12px 28px; display:flex; align-items:center; justify-content:space-between; height: 56px;">
      <div class="flex items-center gap-3" style="min-width:0; flex:1">
        <button class="btn btn-secondary btn-sm btn-icon" onclick="navigate('library')" title="Kitaplığa Dön">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>
        </button>
        <h1 style="font-size:14px; margin:0; font-weight:600;" class="truncate">${title}</h1>
      </div>
      <div class="flex gap-2">
        ${isWeb ? '' : `
        <button class="btn btn-secondary btn-sm" onclick="changeBookPDF('${bookId}')">
          <svg style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67"/></svg>
          Dosyayı Değiştir
        </button>
        `}
        <button class="btn btn-ghost btn-sm btn-icon" onclick="window.electronAPI.openExternal('${fileUrl}')" title="Harici Tarayıcıda Aç">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </button>
      </div>
    </div>
    <div class="page-body" style="padding:0; overflow:hidden; display:flex; flex-direction:column; height:calc(100vh - 56px)">
      <iframe src="${fileUrl}" style="width:100%; height:100%; border:none;" id="pdf-frame"></iframe>
    </div>
  `;
  return page;
}

api={renderLibrary,renderPdfViewer};return api;}global.MTBKnowledgeScreens=Object.freeze({initialize});})(window);
