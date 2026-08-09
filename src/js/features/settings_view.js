/**
 * Settings View
 * Extracted from renderer.js for modular architecture.
 * Auto-generated — do not hand-edit without updating renderer.js delegation.
 */
(function MTBSettingsView(global) {
  'use strict';

// ════════════════════════════════════════════════════════════════
//  LIBRARY
// ════════════════════════════════════════════════════════════════
let KnowledgeScreens;
let AlarmParameterScreens;
const sendAIMessage = (...args) => { getAIScreen(); return window.sendAIMessage(...args); };
function getAlarmParameterScreens(){if(!AlarmParameterScreens)AlarmParameterScreens=window.MTBAlarmParameterScreens.initialize({State,createPage,escapeHTML,showToast,showModal,closeModal,canEdit,saveCustomAlarmNotes,navigate,alarmCategoryTag,sendAIMessage});return AlarmParameterScreens;}
function renderAlarms(){return getAlarmParameterScreens().renderAlarms();}
function renderParameters(){return getAlarmParameterScreens().renderParameters();}
function getKnowledgeScreens(){if(!KnowledgeScreens)KnowledgeScreens=window.MTBKnowledgeScreens.initialize({State,createPage,escapeHTML,showToast,navigate,saveKnowledgePreferences});return KnowledgeScreens;}
function renderLibrary(){return getKnowledgeScreens().renderLibrary();}
function renderPdfViewer(extraData){return getKnowledgeScreens().renderPdfViewer(extraData);}
const renderProjects = (...args) => window.OperationsInsights.renderProjects(...args);

function renderSettings() {
  const page = createPage('settings');
  const themeOptions = [
    { id: 'dark', label: '🌑 Dark', desc: 'Koyu lacivert, premium industrial' },
    { id: 'light', label: '☀️ Light', desc: 'Beyaz zemin, temiz görünüm' },
    { id: 'retro', label: '🖥️ FANUC Retro', desc: 'Siyah ekran, yeşil terminal estetiği' },
  ];

  page.innerHTML = `
    <div class="page-header">
      <h1>⚙️ Ayarlar</h1>
      <p>Uygulama, tema ve kullanıcı ayarları</p>
    </div>
    <div class="page-body" style="max-width:100%">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start">
        <!-- Sol Sütun (Left Column) -->
        <div style="display:flex; flex-direction:column; gap:20px">
          <!-- Theme Switcher -->
      <div class="card mb-4">
        <div class="card-title mb-4" style="font-size:14px">🎨 Tema Seçimi</div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px" id="theme-options">
          ${themeOptions.map(t => `
            <button class="theme-opt-btn ${State.settings.theme === t.id ? 'active' : ''}" data-theme="${t.id}" onclick="setThemeOption('${t.id}')">
              <span style="font-size:22px">${t.label.split(' ')[0]}</span>
              <strong>${t.label.split(' ').slice(1).join(' ')}</strong>
              <span style="font-size:10px; color:var(--text-muted)">${t.desc}</span>
            </button>
          `).join('')}
        </div>
      </div>
          <!-- Auto-Updater & Knowledge Packs Card -->
          <div class="card mb-4">
            <div class="card-title mb-3" style="font-size:14px; display:flex; align-items:center; justify-content:space-between">
              <span>🔄 Sürüm & Kütüphane Güncelleme Paneli</span>
              <span id="updater-status-badge" class="tag tag-green">Güncel (v1.4.1)</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px" id="updater-status-text">
              Yüklü sürüm: v1.4.1. GitHub üzerinden istediğiniz zaman manuel güncelleme denetimi yapabilirsiniz.
            </div>
            <div id="updater-last-checked" style="font-size:11px; color:var(--text-muted); margin-bottom:10px">Henüz manuel kontrol yapılmadı.</div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick="checkForAppUpdates()">
                🔍 Güncellemeleri Denetle
              </button>
              <button class="btn btn-ghost btn-sm" onclick="window.electronAPI.openExternal('https://github.com/PobloMert/fanuc-pro-suitev/releases')">
                GitHub Sürümleri
              </button>
              <button class="btn btn-secondary btn-sm" onclick="navigate('library')">
                📦 Çevrimdışı Paketler
              </button>
            </div>
          </div>

          <!-- User Management -->

      <div class="card mb-4">
        <div class="card-title mb-3" style="font-size:14px">👥 Kullanıcı Yönetimi</div>
        <div style="margin-bottom:12px; padding:10px; background:var(--bg-card2); border-radius:var(--radius-sm); font-size:11.5px; color:var(--text-secondary)">
          Aktif Kullanıcı: <strong style="color:var(--text-primary)">${State.currentUser ? escapeHTML(State.currentUser.name) : 'Misafir'}</strong> — ${getRoleLabel(State.currentUser ? State.currentUser.role : 'operator')}
        </div>
        <table class="data-table">
          <thead><tr><th>Kullanıcı</th><th>Rol</th><th>PIN</th><th>İşlem</th></tr></thead>
          <tbody id="users-table-body">
            ${State.users.map(u => `
              <tr>
                <td>
                  <div style="display:flex; align-items:center; gap:8px">
                    <div style="width:24px; height:24px; border-radius:50%; background:${u.color}; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:#fff">${escapeHTML(u.initials)}</div>
                    ${escapeHTML(u.name)}
                  </div>
                </td>
                <td>${escapeHTML(getRoleLabel(u.role))}</td>
                <td><span class="font-mono" style="letter-spacing:4px; color:var(--text-muted)">••••</span></td>
                <td>
                  ${canDelete() ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})" ${(State.currentUser && u.id === State.currentUser.id) ? 'disabled title="Kendi hesabınızı silemezsiniz"' : ''}>Sil</button>` : '—'}
                </td>
              </tr>

            `).join('')}
          </tbody>
        </table>
        ${canEdit() ? `
          <div style="margin-top:14px; padding-top:14px; border-top:1px solid var(--border)">
            <div class="card-title mb-3" style="font-size:12px">Yeni Kullanıcı Ekle</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Ad</label>
                <input type="text" id="new-user-name" class="form-control" placeholder="Kullanıcı adı" />
              </div>
              <div class="form-group">
                <label class="form-label">Rol</label>
                <select id="new-user-role" class="form-control">
                  <option value="operator">👤 Operatör</option>
                  <option value="technician">🔧 Bakım Teknisyeni</option>
                  ${canDelete() ? '<option value="admin">🔑 Yönetici</option>' : ''}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">PIN (4-6 hane)</label>
                <input type="password" id="new-user-pin" class="form-control" placeholder="••••" maxlength="6" />
              </div>
              <div class="form-group">
                <label class="form-label">Baş harfler (2 harf)</label>
                <input type="text" id="new-user-initials" class="form-control" placeholder="BT" maxlength="2" />
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="addNewUser()">+ Kullanıcı Ekle</button>
          </div>
        ` : ''}
      </div>
          <!-- PIN Change (Self Service) -->
      ${State.currentUser ? `
      <div class="card mb-4">
        <div class="card-title mb-3" style="font-size:14px">🔐 PIN Şifre Değiştir</div>
        <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:12px">
          Mevcut PIN şifrenizi girerek yeni bir PIN şifresi belirleyebilirsiniz.
        </p>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Mevcut PIN</label>
            <input type="password" id="change-pin-old" class="form-control" placeholder="••••" maxlength="6" />
          </div>
          <div class="form-group">
            <label class="form-label">Yeni PIN (4-6 hane)</label>
            <input type="password" id="change-pin-new" class="form-control" placeholder="••••" maxlength="6" />
          </div>
          <div class="form-group">
            <label class="form-label">Yeni PIN (Tekrar)</label>
            <input type="password" id="change-pin-new2" class="form-control" placeholder="••••" maxlength="6" />
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="changeMyPin()">PIN Güncelle</button>
      </div>
      ` : ''}
        </div>
        <!-- Sağ Sütun (Right Column) -->
        <div style="display:flex; flex-direction:column; gap:20px">
          <!-- AI Settings -->
      <div class="card mb-4">
        <div class="card-title mb-4" style="font-size:14px">🤖 Yapay Zeka Ayarları</div>
        <div class="form-group">
          <label class="form-label">AI Sağlayıcı</label>
          <select class="form-control" id="ai-provider" style="max-width:280px">
            <option value="offline" ${State.settings.aiProvider==='offline'?'selected':''}>🔒 Offline (API gereksiz)</option>
            <option value="openai"  ${State.settings.aiProvider==='openai' ?'selected':''}>🟢 OpenAI (GPT-4)</option>
            <option value="gemini"  ${State.settings.aiProvider==='gemini' ?'selected':''}>🔵 Google Gemini</option>
          </select>
        </div>
        <div class="form-group" id="api-key-group" style="${State.settings.aiProvider==='offline'?'display:none':''}">
          <label class="form-label">API Anahtarı</label>
          <div class="flex gap-2" style="max-width:420px">
            <input type="password" class="form-control" id="ai-api-key" placeholder="Windows güvenli deposunda saklanır" value="" />
            <button class="btn btn-secondary btn-sm" id="btn-toggle-key">Göster</button>
          </div>
        </div>
        <div class="form-group" id="ai-model-group" style="${State.settings.aiProvider==='offline'?'display:none':''}">
          <label class="form-label">Model</label>
          <select class="form-control" id="ai-model" style="max-width:280px">
            <option value="gpt-4o" ${State.settings.aiModel==='gpt-4o'?'selected':''}>GPT-4o</option>
            <option value="gpt-4-turbo" ${State.settings.aiModel==='gpt-4-turbo'?'selected':''}>GPT-4 Turbo</option>
            <option value="gpt-3.5-turbo" ${State.settings.aiModel==='gpt-3.5-turbo'?'selected':''}>GPT-3.5 Turbo</option>
            <option value="gemini-pro" ${State.settings.aiModel==='gemini-pro'?'selected':''}>Gemini Pro</option>
            <option value="gemini-1.5-pro" ${State.settings.aiModel==='gemini-1.5-pro'?'selected':''}>Gemini 1.5 Pro</option>
          </select>
        </div>
        <div style="padding:10px; background:var(--accent-glow); border-radius:var(--radius-sm); font-size:11.5px; color:var(--text-secondary); margin-top:4px">
          💡 Offline modda FANUC alarm veritabanı ve kural tabanlı yapay zeka çalışır. API gerektirmez.
        </div>
      </div>

      <!-- Tezgah Ağ Ayarları -->
      <div class="card mb-4">
        <div class="card-title mb-4" style="font-size:14px">🖥️ Tezgah Ağ Ayarları (Canlı İzleme)</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fanuc Tezgah 1 IP Adresi</label>
            <input type="text" id="cnc-m1-ip" class="form-control" placeholder="192.168.30.20" value="Yükleniyor..." />
          </div>
          <div class="form-group">
            <label class="form-label">Fanuc 1 FOCAS Portu</label>
            <input type="number" id="cnc-m1-port" class="form-control" placeholder="8193" value="8193" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fanuc Tezgah 2 IP Adresi</label>
            <input type="text" id="cnc-m2-ip" class="form-control" placeholder="192.168.30.21" value="Yükleniyor..." />
          </div>
          <div class="form-group">
            <label class="form-label">Fanuc 2 FOCAS Portu</label>
            <input type="number" id="cnc-m2-port" class="form-control" placeholder="8193" value="8193" />
          </div>
        </div>
        <div style="padding:10px; background:var(--accent-glow); border-radius:var(--radius-sm); font-size:11.5px; color:var(--text-secondary); margin-top:4px">
          💡 IP adreslerini güncelledikten sonra kaydet butonuna bastığınızda telemetri servisi otomatik olarak yeniden başlatılacaktır.
        </div>
      </div>

      <!-- Google Drive Service Account Cloud Sync Card -->
      <div class="card mb-4" style="padding:20px; background:var(--bg-card);">
        <div class="flex items-center justify-between mb-3" style="flex-wrap:wrap; gap:8px;">
          <div class="card-title" style="display:flex; align-items:center; gap:10px;">
            <span>☁️ Google Drive Bulut Veri Senkronizasyonu</span>
            <span id="cloud-sync-status-badge" class="tag tag-green" style="font-size:11px;">🟢 Webhook Bulut Yükleme Aktif</span>
          </div>
          <div class="flex gap-2" style="flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="triggerCloudSyncNow()">⚡ Drive'a Yükle (Gönder)</button>
            <button class="btn btn-secondary btn-sm" onclick="pullDirectFromGoogleDrive()">☁️ Drive'dan İndir & Güncelle (Çek)</button>
            <button class="btn btn-ghost btn-sm" onclick="exportFullCloudBundle()">📥 Bilgisayara İndir</button>
            <button class="btn btn-ghost btn-sm" onclick="importFullCloudBundle()">📤 Bilgisayardan Yükle</button>
          </div>
        </div>
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; line-height:1.4;">
          Fabrikadaki tüm bilgisayarlardaki FANUC Pro Suite uygulamaları arka planda otomatik olarak doğrudan Google Drive Webhook endpoint'ine (Google Apps Script) bağlanır. Bilgisayarlara hiçbir Google Drive programı kurulmasına gerek kalmadan tüm veriler canlı senkronize edilir.
        </div>
        <div style="background:var(--bg-card2); border:1px solid var(--border); padding:12px; border-radius:var(--radius-md); font-size:11.5px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:700; color:var(--text-primary); margin-bottom:2px;">Google Drive Depo Klasörü & Webhook:</div>
            <div class="font-mono text-xs" style="color:var(--text-accent);">
              1h7re6FFXCEXDgnGCLnoixuxVDBjEYtYK (Aktif Webhook Entegre)
              <a href="https://drive.google.com/drive/folders/1h7re6FFXCEXDgnGCLnoixuxVDBjEYtYK" target="_blank" style="color:var(--accent); margin-left:6px; text-decoration:underline;">🔗 Google Drive'da Aç</a>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px; color:var(--text-muted);" id="sync-last-time">Son Senkronizasyon: ${escapeHTML(State.settings.lastSync || 'Henüz Eşitlenmedi')}</div>
          </div>
        </div>
      </div>

      <!-- Privacy, Storage & Accessibility -->
      <div class="card mb-4">
        <div class="card-title mb-3" style="font-size:14px">🛡️ Gizlilik, Depolama ve Erişilebilirlik</div>
        <label class="flex items-center gap-2 mb-3" style="font-size:12px">
          <input type="checkbox" id="internet-enabled" ${State.settings.internetEnabled !== false ? 'checked' : ''} />
          İnternet erişimine izin ver (kapalıyken AI bulut ve güncelleme denetimi devre dışıdır)
        </label>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Telemetri saklama süresi</label><input class="form-control" id="retention-days" type="number" min="1" max="3650" value="${Number(State.settings.retentionDays)||30}" /><small>gün</small></div>
          <div class="form-group"><label class="form-label">Veri tabanı yumuşak sınırı</label><input class="form-control" id="disk-limit-mb" type="number" min="250" max="102400" value="${Number(State.settings.diskLimitMB)||2048}" /><small>MB</small></div>
        </div>
        <div class="form-group">
          <label class="form-label">Yedek klasörü</label>
          <div id="backup-directory-value" class="font-mono text-xs" style="padding:8px;background:var(--bg-card2);border-radius:6px;word-break:break-all">${escapeHTML(State.settings.backupDirectory || (State.appDataDir + '/backups'))}</div>
          <button class="btn btn-ghost btn-sm mt-2" onclick="chooseBackupDirectory()">Klasör Seç</button>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Yazı büyüklüğü</label><input id="text-scale" type="range" min="85" max="140" value="${Number(State.settings.textScale)||100}" /><span id="text-scale-value">%${Number(State.settings.textScale)||100}</span></div>
          <label class="flex items-center gap-2"><input type="checkbox" id="high-contrast" ${State.settings.highContrast?'checked':''}/> Yüksek kontrast</label>
          <label class="flex items-center gap-2"><input type="checkbox" id="color-blind-mode" ${State.settings.colorBlindMode?'checked':''}/> Renk körlüğü paleti</label>
          <div class="form-group"><label class="form-label">Hareket seviyesi</label><select class="form-control" id="motion-mode"><option value="full" ${State.settings.motionMode==='full'?'selected':''}>Tam</option><option value="reduced" ${State.settings.motionMode==='reduced'?'selected':''}>Azaltılmış</option><option value="off" ${State.settings.motionMode==='off'?'selected':''}>Kapalı</option></select></div>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="exportSafeConfiguration()">Yapılandırmayı Dışa Aktar</button>
          <button class="btn btn-secondary btn-sm" onclick="importSafeConfiguration()">Yapılandırmayı İçe Aktar</button>
          <button class="btn btn-ghost btn-sm" onclick="resetSafeSettings()">Güvenli Varsayılana Dön</button>
        </div>
      </div>

      <!-- Connection Profiles -->
      <div class="card mb-4">
        <div class="card-title mb-3" style="font-size:14px">🔌 Bağlantı Profilleri</div>
        <div class="flex gap-2">
          <input class="form-control" id="profile-name" placeholder="Profil adı (örn. Atölye A)" />
          <button class="btn btn-secondary btn-sm" onclick="saveConnectionProfile()">Mevcut IP'leri Kaydet</button>
        </div>
        <div id="connection-profile-list" style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
          ${(State.settings.connectionProfiles||[]).map((p,i)=>`<div class="flex justify-between items-center" style="padding:8px;background:var(--bg-card2);border-radius:6px"><span>${escapeHTML(p.name)}</span><div class="flex gap-2"><button class="btn btn-ghost btn-sm" onclick="applyConnectionProfile(${i})">Uygula</button><button class="btn btn-danger btn-sm" onclick="deleteConnectionProfile(${i})">Sil</button></div></div>`).join('') || '<span class="text-xs" style="color:var(--text-muted)">Kayıtlı profil yok.</span>'}
        </div>
      </div>

      <!-- App Settings -->
      <div class="card mb-4">
        <div class="card-title mb-4" style="font-size:14px">📁 Uygulama</div>
        <div class="flex gap-2 mb-3"><span class="tag tag-blue">Sürüm v${escapeHTML(window.CURRENT_APP_VERSION || '1.4.1')}</span><span class="tag tag-red">KALICI SALT OKUNUR</span></div>
        <p style="font-size:11px;color:var(--text-secondary)">Uygulama CNC programı etkinleştiremez, silemez veya yükleyemez; CNC parametresi yazamaz. İzleme ve yerel analiz amacıyla tasarlanmıştır.</p>
        <div class="form-group">
          <label class="form-label">Veri Dizini</label>
          <div class="font-mono text-sm" style="padding:8px; background:var(--bg-card2); border-radius:var(--radius-sm); color:var(--text-secondary); word-break:break-all">
            ${State.appDataDir || 'Yükleniyor...'}
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="openDataDir()">
          <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          Klasörü Aç
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-export-diagnostics">Tanılama Paketi Oluştur</button>
      </div>

      <!-- CSV Export -->
      <div class="card mb-4">
        <div class="card-title mb-3" style="font-size:14px">📊 Dışa Aktarma (CSV / Excel)</div>
        <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:14px">Verileri Excel'de açılabilir CSV formatında kaydedin.</p>
        <div class="flex gap-2" style="flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="exportMaintenanceCSV()">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Bakım Defteri CSV
          </button>
          <button class="btn btn-secondary btn-sm" onclick="exportAlarmsCSV()">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Alarm DB CSV
          </button>
        </div>
      </div>

      <!-- Database Sync -->
      <div class="card mb-4" style="border:1px solid rgba(16,185,129,0.15); background:rgba(16,185,129,0.02)">
        <div class="card-title mb-2" style="font-size:14px; color:var(--green)">🔄 Bulut Veri Senkronizasyonu</div>
        <p style="font-size:11.5px; color:var(--text-secondary); margin-bottom:12px">
          İnternete bağlanarak en güncel FANUC G-Kodlarını, alarm hata çözümlerini ve parametre veritabanlarını resmi sunuculardan çeker ve uygulamayı günceller.
        </p>
        <div class="flex items-center justify-between">
          <span style="font-size:11px; color:var(--text-muted)" id="sync-last-time">Son Senkronizasyon: ${State.settings.lastSync || 'Hiç yapılmadı'}</span>
          <button class="btn btn-primary btn-sm" onclick="startDatabaseSync()">Buluttan Güncelle</button>
        </div>
      </div>
        </div>
      </div>

      <div class="flex gap-2 mt-4" style="border-top:1px solid var(--border); padding-top:20px">
        <button class="btn btn-primary" id="btn-save-settings">Ayarları Kaydet</button>
        <button class="btn btn-ghost" onclick="navigate('dashboard')">İptal</button>
      </div>
    </div>
  `;

  addStyle(`
    .theme-opt-btn {
      display:flex; flex-direction:column; align-items:center; gap:4px;
      padding:16px 10px; border-radius:var(--radius-md);
      background:var(--bg-card2); border:2px solid var(--border);
      cursor:pointer; transition:all .2s; font-family:inherit; color:var(--text-primary);
    }
    .theme-opt-btn:hover { border-color:var(--accent); background:var(--bg-hover); }
    .theme-opt-btn.active { border-color:var(--accent); background:var(--accent-glow); }
    .theme-opt-btn strong { font-size:12px; }
    body.high-contrast-mode { --border:#ffffff; --text-secondary:#f3f4f6; --text-muted:#d1d5db; }
    body.color-blind-mode { --accent:#3b82f6; --green:#0072b2; --red:#d55e00; --amber:#e69f00; }
  `);

  // Theme selection
  window.setThemeOption = function(theme) {
    applyTheme(theme);
    page.querySelectorAll('.theme-opt-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  };

  // AI provider toggle
  const providerSel = page.querySelector('#ai-provider');
  const apiKeyGroup = page.querySelector('#api-key-group');
  const modelGroup  = page.querySelector('#ai-model-group');
  providerSel.addEventListener('change', () => {
    const offline = providerSel.value === 'offline';
    apiKeyGroup.style.display = offline ? 'none' : '';
    modelGroup.style.display  = offline ? 'none' : '';
  });

  page.querySelector('#btn-toggle-key').addEventListener('click', () => {
    const inp = page.querySelector('#ai-api-key');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  page.querySelector('#btn-export-diagnostics')?.addEventListener('click', async () => {
    const result = await window.electronAPI.exportDiagnostics();
    if (result?.ok) showToast(`Tanılama paketi oluşturuldu. SHA-256: ${result.checksum.slice(0, 12)}…`, 'success');
    else if (!result?.canceled) showToast(result?.error || 'Tanılama paketi oluşturulamadı.', 'error');
  });

  // Load CNC Machine Network Settings from bin/adapter.config.json
  window.electronAPI.readFile('bin/adapter.config.json').then(res => {
    if (res.ok) {
      try {
        const configData = JSON.parse(res.data);
        const m1 = configData.find(c => c.id === 'Fanuc');
        const m2 = configData.find(c => c.id === 'Fanuc2');
        if (m1) {
          page.querySelector('#cnc-m1-ip').value = m1.ip || '192.168.30.20';
          page.querySelector('#cnc-m1-port').value = m1.port || 8193;
        }
        if (m2) {
          page.querySelector('#cnc-m2-ip').value = m2.ip || '192.168.30.21';
          page.querySelector('#cnc-m2-port').value = m2.port || 8193;
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      page.querySelector('#cnc-m1-ip').value = '192.168.30.20';
      page.querySelector('#cnc-m2-ip').value = '192.168.30.21';
    }
  }).catch(() => {
    page.querySelector('#cnc-m1-ip').value = '192.168.30.20';
    page.querySelector('#cnc-m2-ip').value = '192.168.30.21';
  });
  const scaleInput = page.querySelector('#text-scale');
  scaleInput.addEventListener('input', () => {
    page.querySelector('#text-scale-value').textContent = `%${scaleInput.value}`;
    document.documentElement.style.fontSize = `${scaleInput.value}%`;
  });

  if (State.currentUser?.role === 'admin') {
    window.electronAPI.getAISecret().then(res => {
      if (res?.ok) {
        State.settings.aiApiKey = res.value || '';
        const input = page.querySelector('#ai-api-key');
        if (input) input.value = State.settings.aiApiKey;
      }
    });
  }

  page.querySelector('#btn-save-settings').addEventListener('click', async () => {
    State.settings.aiProvider = page.querySelector('#ai-provider').value;
    State.settings.aiApiKey   = page.querySelector('#ai-api-key').value;
    State.settings.aiModel    = page.querySelector('#ai-model').value;
    State.settings.internetEnabled = page.querySelector('#internet-enabled').checked;
    State.settings.retentionDays = Math.max(1, Math.min(3650, Number(page.querySelector('#retention-days').value) || 30));
    State.settings.diskLimitMB = Math.max(250, Math.min(102400, Number(page.querySelector('#disk-limit-mb').value) || 2048));
    State.settings.textScale = Number(page.querySelector('#text-scale').value) || 100;
    State.settings.highContrast = page.querySelector('#high-contrast').checked;
    State.settings.colorBlindMode = page.querySelector('#color-blind-mode').checked;
    State.settings.motionMode = page.querySelector('#motion-mode').value;
    if (!State.settings.internetEnabled) State.settings.aiProvider = 'offline';
    const secretResult = await window.electronAPI.setAISecret(State.settings.aiApiKey);
    if (!secretResult?.ok && State.currentUser?.role === 'admin') {
      showToast('API anahtarı güvenli depoya kaydedilemedi: ' + secretResult.error, 'error');
      return;
    }
    await saveSettings();
    applyAccessibilitySettings();
    const storageResult = await window.electronAPI.applyStoragePolicy({ retentionDays: State.settings.retentionDays, diskLimitMB: State.settings.diskLimitMB });
    if (!storageResult?.ok) showToast(`Depolama ilkesi uygulanamadı: ${storageResult?.error}`, 'warning');
    else if (storageResult.overLimit) showToast('Veri tabanı sınırın üzerinde. Telemetri bir güne indirildi; kalıcı kayıtlar güvenlik nedeniyle silinmedi.', 'warning');

    // Save CNC Machine Network Settings
    try {
      const m1_ip = page.querySelector('#cnc-m1-ip').value.trim();
      const m1_port = parseInt(page.querySelector('#cnc-m1-port').value) || 8193;
      const m2_ip = page.querySelector('#cnc-m2-ip').value.trim();
      const m2_port = parseInt(page.querySelector('#cnc-m2-port').value) || 8193;

      const configData = [
        { id: "Fanuc", ip: m1_ip, port: m1_port, shdrPort: 7880, prefix: "f" },
        { id: "Fanuc2", ip: m2_ip, port: m2_port, shdrPort: 7881, prefix: "f2" }
      ];

      const writeRes = await window.electronAPI.writeFile('bin/adapter.config.json', JSON.stringify(configData, null, 2));
      if (writeRes && writeRes.ok) {
        showToast('Ayarlar kaydedildi! Servis yeniden başlatılıyor...', 'success');
        await window.electronAPI.restartAdapter();
      } else {
        throw new Error(writeRes?.error || 'Dosyaya yazılamadı');
      }
    } catch (err) {
      showToast('Tezgah IP adresleri kaydedilemedi: ' + err.message, 'error');
    }
  });

  return page;
}

// Add user
window.addNewUser = async function() {
  if (!canEdit()) { showToast('Kullanıcı ekleme yetkiniz yok', 'error'); return; }
  const name = document.getElementById('new-user-name').value.trim();
  const role = document.getElementById('new-user-role').value;
  const pin = document.getElementById('new-user-pin').value.trim();
  const initials = document.getElementById('new-user-initials').value.trim().toUpperCase();
  if (!name || !pin || pin.length < 4) { showToast('Ad ve en az 4 haneli PIN gerekli', 'error'); return; }
  // Verify that only users with canDelete privileges (Admins) can create admin users
  if (role === 'admin' && !canDelete()) {
    showToast('Yönetici ekleme yetkiniz yok', 'error');
    return;
  }
  const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
  const newUser = { name, role, pin, initials: initials || name.slice(0,2).toUpperCase(), color: colors[State.users.length % colors.length] };

  try {
    const res = await window.electronAPI.addUser(newUser);
    if (res && res.ok) {
      State.users.push(res.user);
      showToast('Kullanıcı eklendi ✓', 'success');
      navigate('settings');
    } else {
      showToast('Kullanıcı kaydedilemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Kullanıcı kaydedilirken hata oluştu: ' + err.message, 'error');
  }
};

// Delete user
window.deleteUser = async function(userId) {
  if (!canDelete()) { showToast('Silme yetkiniz yok', 'error'); return; }
  if (userId === State.currentUser.id) { showToast('Kendi hesabınızı silemezsiniz', 'error'); return; }
  try {
    const res = await window.electronAPI.deleteUser(userId);
    if (res && res.ok) {
      State.users = State.users.filter(u => u.id !== userId);
      showToast('Kullanıcı silindi', 'success');
      navigate('settings');
    } else {
      showToast('Kullanıcı silinemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Kullanıcı silinirken hata oluştu: ' + err.message, 'error');
  }
};

window.changeMyPin = async function() {
  if (!State.currentUser) {
    showToast('Öncelikle giriş yapmalısınız', 'error');
    return;
  }
  const oldPin = document.getElementById('change-pin-old').value;
  const newPin = document.getElementById('change-pin-new').value.trim();
  const newPin2 = document.getElementById('change-pin-new2').value.trim();

  if (!oldPin || !newPin || !newPin2) {
    showToast('Lütfen tüm şifre alanlarını doldurun.', 'error');
    return;
  }

  if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
    showToast('Yeni PIN sadece rakamlardan oluşmalı ve 4-6 hane uzunluğunda olmalıdır.', 'error');
    return;
  }

  if (newPin !== newPin2) {
    showToast('Yeni PIN şifreleri eşleşmiyor.', 'error');
    return;
  }

  try {
    const res = await window.electronAPI.changePin(oldPin, newPin);
    if (res && res.ok) {
      showToast('PIN şifreniz başarıyla güncellendi!', 'success');
      document.getElementById('change-pin-old').value = '';
      document.getElementById('change-pin-new').value = '';
      document.getElementById('change-pin-new2').value = '';
      navigate('settings');
    } else {
      showToast('Şifre güncellenemedi: ' + (res?.error || 'Bilinmeyen hata'), 'error');
    }
  } catch (err) {
    showToast('Şifre güncellenirken hata oluştu: ' + err.message, 'error');
  }
};

window.openDataDir = function() {
  if (State.appDataDir) window.electronAPI.openExternal(State.appDataDir);
};



})(window);
