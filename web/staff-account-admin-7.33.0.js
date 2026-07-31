(function (global) {
  'use strict';
  if (global.__ULIM_STAFF_ACCOUNT_ADMIN_7330__) return;
  global.__ULIM_STAFF_ACCOUNT_ADMIN_7330__ = true;

  const VERSION = '2026-07-31.733.00';
  let accounts = [];
  let loadingPromise = null;
  let installed = false;
  const rowKeyMap = new Map();

  function text(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function safeKey(uid) {
    const key = 'u_' + String(uid || '').replace(/[^0-9A-Za-z_-]/g, '_');
    rowKeyMap.set(key, uid);
    return key;
  }
  function isSuperAdmin() {
    const info = global.adminInfo || {};
    const role = text(info.firebaseRole || info.role).replace(/\s+/g, '').toLowerCase();
    return role === 'superadmin' || role === '전체관리자' || role === '전체관리' || role === '원장';
  }
  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('Firebase 모듈을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('Firebase 교직원 로그인이 필요합니다.');
    await rt.sdk.getIdToken(rt.auth.currentUser, true);
    return rt;
  }
  async function call(name, payload) {
    const rt = await runtime();
    const fn = rt.sdk.httpsCallable(rt.functions, name);
    const response = await fn(payload || {});
    return response && response.data || {};
  }
  function showLoading(message) { try { if (typeof global.showLoading === 'function') global.showLoading(message || '처리 중...'); } catch (_ignore) {} }
  function hideLoading() { try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {} }
  function status(message, state) {
    const el = document.getElementById('ulimStaffAccountStatus7330');
    if (!el) return;
    el.textContent = message || '';
    el.dataset.state = state || '';
    el.style.display = message ? 'block' : 'none';
  }
  function syncLabel(account) {
    const state = text(account.legacySyncState);
    if (state === 'complete') return '<span class="ulim-staff-sync ok">시트완료</span>';
    if (state === 'retry' || state === 'pending' || state === 'processing') return '<span class="ulim-staff-sync wait">시트대기</span>';
    if (state === 'manual-retry' || state === 'failed') return '<span class="ulim-staff-sync fail">확인필요</span>';
    return '<span class="ulim-staff-sync">미확인</span>';
  }
  function injectStyles() {
    if (document.getElementById('ulimStaffAccountStyle7330')) return;
    const style = document.createElement('style');
    style.id = 'ulimStaffAccountStyle7330';
    style.textContent = `
      #adminPanelStaffAccounts .ulim-staff-account-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
      #adminPanelStaffAccounts .ulim-staff-account-actions{display:flex;gap:6px;flex-wrap:wrap}
      #adminPanelStaffAccounts .ulim-staff-account-table{width:100%;border-collapse:collapse;min-width:980px}
      #adminPanelStaffAccounts .ulim-staff-account-table th,#adminPanelStaffAccounts .ulim-staff-account-table td{border-bottom:1px solid #e5e7eb;padding:8px;vertical-align:middle;font-size:12px}
      #adminPanelStaffAccounts .ulim-staff-account-table th{background:#f8fafc;text-align:left;position:sticky;top:0;z-index:1}
      #adminPanelStaffAccounts input,#adminPanelStaffAccounts select{width:100%;box-sizing:border-box;padding:8px;border:1px solid #d1d5db;border-radius:8px;background:#fff}
      #adminPanelStaffAccounts .ulim-staff-account-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#475569;word-break:break-all}
      #ulimStaffAccountStatus7330{display:none;margin:10px 0;padding:10px 12px;border-radius:9px;font-size:13px}
      #ulimStaffAccountStatus7330[data-state="ok"]{display:block;background:#ecfdf5;color:#166534}
      #ulimStaffAccountStatus7330[data-state="error"]{display:block;background:#fff7ed;color:#9a3412}
      #ulimStaffAccountStatus7330[data-state="loading"]{display:block;background:#eff6ff;color:#1d4ed8}
      .ulim-staff-sync{display:inline-block;padding:3px 7px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:11px;font-weight:700}
      .ulim-staff-sync.ok{background:#dcfce7;color:#166534}.ulim-staff-sync.wait{background:#fef3c7;color:#92400e}.ulim-staff-sync.fail{background:#fee2e2;color:#991b1b}
      .ulim-staff-account-disabled{opacity:.6;background:#f8fafc}
    `;
    document.head.appendChild(style);
  }
  function injectPanel() {
    if (document.getElementById('adminPanelStaffAccounts')) return;
    const subtabs = document.querySelector('#adminDashboard .admin-subtabs');
    if (subtabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-subtab admin-full-only';
      button.dataset.adminPanel = 'adminPanelStaffAccounts';
      button.textContent = '교직원 관리';
      button.onclick = function () {
        if (typeof global.showAdminPanel === 'function') global.showAdminPanel('adminPanelStaffAccounts');
        global.ulimStaffAccountLoad7330(false);
      };
      subtabs.appendChild(button);
    }
    const dashboard = document.getElementById('adminDashboard');
    if (!dashboard) return;
    const panel = document.createElement('div');
    panel.id = 'adminPanelStaffAccounts';
    panel.className = 'admin-panel';
    panel.innerHTML = `
      <div class="admin-card admin-full-only">
        <h3 style="margin-top:0;">교직원 계정 관리</h3>
        <p style="font-size:13px;color:#64748b;line-height:1.65;margin-top:-4px;">
          Firebase Authentication과 Firestore가 계정·권한 원본입니다. Google Sheets 관리자/관리자인증 시트는 자동으로 호환 반영됩니다.
          퇴사 처리는 작성 기록을 보존하고 로그인만 차단합니다.
        </p>
        <div id="ulimStaffAccountStatus7330"></div>
        <div class="ulim-staff-account-grid">
          <div class="admin-field"><label>로그인 ID</label><input id="ulimStaffNewLoginId7330" autocomplete="off" placeholder="예: kimcs"></div>
          <div class="admin-field"><label>이름</label><input id="ulimStaffNewName7330" placeholder="강사명"></div>
          <div class="admin-field"><label>전화번호</label><input id="ulimStaffNewPhone7330" placeholder="선택 입력"></div>
          <div class="admin-field"><label>역할</label><select id="ulimStaffNewRole7330"><option value="teacher">강사</option><option value="admin">관리자</option><option value="superAdmin">전체관리자</option></select></div>
          <div class="admin-field"><label>임시 비밀번호</label><input id="ulimStaffNewPassword7330" type="password" autocomplete="new-password" placeholder="6자 이상"></div>
          <div class="admin-field"><label>최초 로그인</label><select id="ulimStaffNewMustChange7330"><option value="true">비밀번호 변경 필요</option><option value="false">변경 없이 사용</option></select></div>
        </div>
        <div class="admin-btn-row" style="margin-top:10px;">
          <button type="button" class="admin-btn" onclick="ulimStaffAccountCreate7330()">교직원 추가</button>
          <button type="button" class="admin-btn blue" onclick="ulimStaffAccountLoad7330(true)">목록 새로고침</button>
        </div>
        <div id="ulimStaffAccountSummary7330" style="font-size:12px;color:#64748b;margin:10px 0;"></div>
        <div class="admin-table-wrap"><div id="ulimStaffAccountTable7330"></div></div>
      </div>`;
    dashboard.appendChild(panel);
  }
  function render() {
    const wrap = document.getElementById('ulimStaffAccountTable7330');
    const summary = document.getElementById('ulimStaffAccountSummary7330');
    if (!wrap) return;
    if (!accounts.length) {
      wrap.innerHTML = '<div style="padding:18px;color:#64748b;">등록된 교직원이 없습니다.</div>';
      if (summary) summary.textContent = '교직원 0명';
      return;
    }
    const activeCount = accounts.filter(function (item) { return item.active === true; }).length;
    if (summary) summary.textContent = '전체 ' + accounts.length + '명 · 활성 ' + activeCount + '명 · 중지/퇴사 ' + (accounts.length - activeCount) + '명';
    const rows = accounts.map(function (account) {
      const key = safeKey(account.firebaseUid);
      const disabledClass = account.active === true ? '' : ' class="ulim-staff-account-disabled"';
      return `<tr${disabledClass}>
        <td><input id="${key}_name" value="${escapeHtml(account.name)}"></td>
        <td><input id="${key}_login" value="${escapeHtml(account.loginId)}"><div class="ulim-staff-account-id">${escapeHtml(account.firebaseUid)}</div></td>
        <td><input id="${key}_phone" value="${escapeHtml(account.phone || '')}"></td>
        <td><select id="${key}_role"><option value="teacher"${account.role === 'teacher' ? ' selected' : ''}>강사</option><option value="admin"${account.role === 'admin' ? ' selected' : ''}>관리자</option><option value="superAdmin"${account.role === 'superAdmin' ? ' selected' : ''}>전체관리자</option></select></td>
        <td><select id="${key}_active"><option value="true"${account.active === true ? ' selected' : ''}>사용</option><option value="false"${account.active !== true ? ' selected' : ''}>중지</option></select></td>
        <td><select id="${key}_must"><option value="false"${account.mustChangePassword !== true ? ' selected' : ''}>변경완료</option><option value="true"${account.mustChangePassword === true ? ' selected' : ''}>변경필요</option></select></td>
        <td>${syncLabel(account)}<div style="font-size:10px;color:#64748b;max-width:170px;word-break:break-all;">${escapeHtml(account.legacySyncMessage || '')}</div></td>
        <td><div class="ulim-staff-account-actions">
          <button type="button" class="admin-btn blue" onclick="ulimStaffAccountSave7330('${key}')">저장</button>
          <button type="button" class="admin-btn orange" onclick="ulimStaffAccountResetPassword7330('${key}')">암호 초기화</button>
          <button type="button" class="admin-btn red" onclick="ulimStaffAccountRetire7330('${key}')">퇴사처리</button>
        </div></td>
      </tr>`;
    }).join('');
    wrap.innerHTML = `<table class="ulim-staff-account-table"><thead><tr><th>이름</th><th>로그인 ID / UID</th><th>전화번호</th><th>역할</th><th>상태</th><th>암호상태</th><th>시트호환</th><th>관리</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  async function load(force) {
    if (!isSuperAdmin()) {
      status('교직원 계정 관리는 전체관리자만 사용할 수 있습니다.', 'error');
      return false;
    }
    if (loadingPromise && !force) return loadingPromise;
    status('교직원 계정 목록을 불러오는 중...', 'loading');
    loadingPromise = call('listStaffAccountsAdmin', { forceRefresh: !!force })
      .then(function (data) {
        accounts = Array.isArray(data.accounts) ? data.accounts : [];
        render();
        status('교직원 계정 목록을 불러왔습니다.', 'ok');
        return true;
      })
      .catch(function (error) {
        status(error && error.message ? error.message : '교직원 계정 목록 조회에 실패했습니다.', 'error');
        return false;
      })
      .finally(function () { loadingPromise = null; });
    return loadingPromise;
  }
  async function create() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const loginId = text(document.getElementById('ulimStaffNewLoginId7330')?.value);
    const name = text(document.getElementById('ulimStaffNewName7330')?.value);
    const phone = text(document.getElementById('ulimStaffNewPhone7330')?.value);
    const role = text(document.getElementById('ulimStaffNewRole7330')?.value) || 'teacher';
    const password = String(document.getElementById('ulimStaffNewPassword7330')?.value || '');
    const mustChangePassword = text(document.getElementById('ulimStaffNewMustChange7330')?.value) !== 'false';
    if (!loginId || !name || password.length < 6) return alert('로그인 ID, 이름, 6자 이상의 임시 비밀번호를 입력해주세요.');
    if (!confirm(name + ' 교직원 계정을 생성할까요?')) return;
    try {
      showLoading('교직원 계정 생성 중...');
      await call('createStaffAccountAdmin', { loginId, name, phone, role, password, mustChangePassword });
      ['ulimStaffNewLoginId7330','ulimStaffNewName7330','ulimStaffNewPhone7330','ulimStaffNewPassword7330'].forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ''; });
      await load(true);
      alert('교직원 계정이 생성되었습니다.');
    } catch (error) {
      alert(error && error.message ? error.message : '교직원 계정 생성에 실패했습니다.');
    } finally { hideLoading(); }
  }
  function rowData(key) {
    return {
      firebaseUid: rowKeyMap.get(key) || '',
      name: text(document.getElementById(key + '_name')?.value),
      loginId: text(document.getElementById(key + '_login')?.value),
      phone: text(document.getElementById(key + '_phone')?.value),
      role: text(document.getElementById(key + '_role')?.value),
      active: text(document.getElementById(key + '_active')?.value) === 'true',
      mustChangePassword: text(document.getElementById(key + '_must')?.value) === 'true'
    };
  }
  async function save(key) {
    const data = rowData(key);
    if (!data.firebaseUid || !data.loginId || !data.name) return alert('이름과 로그인 ID를 확인해주세요.');
    if (!confirm(data.name + ' 계정 정보를 저장할까요?\n권한이나 상태 변경 시 해당 계정은 다시 로그인해야 합니다.')) return;
    try {
      showLoading('교직원 계정 저장 중...');
      const result = await call('updateStaffAccountAdmin', data);
      await load(true);
      const state = result && result.legacySync && result.legacySync.state;
      alert(state === 'complete' ? '교직원 계정이 저장되었습니다.' : 'Firebase 계정은 저장되었고 Google Sheets 반영은 백그라운드에서 재시도합니다.');
    } catch (error) {
      alert(error && error.message ? error.message : '교직원 계정 저장에 실패했습니다.');
    } finally { hideLoading(); }
  }
  async function resetPassword(key) {
    const data = rowData(key);
    const first = prompt(data.name + ' 계정의 새 임시 비밀번호를 입력해주세요.\n6자 이상');
    if (!first) return;
    if (first.length < 6) return alert('비밀번호는 6자 이상이어야 합니다.');
    const second = prompt('새 임시 비밀번호를 한 번 더 입력해주세요.');
    if (first !== second) return alert('비밀번호가 서로 다릅니다.');
    try {
      showLoading('비밀번호 초기화 중...');
      const result = await call('resetStaffPasswordAdmin', { firebaseUid: data.firebaseUid, password: first, mustChangePassword: true });
      await load(true);
      alert(result.legacySyncState === 'complete'
        ? '비밀번호가 초기화되었습니다. 기존 로그인은 모두 해제됩니다.'
        : 'Firebase 비밀번호는 초기화되었습니다. 연습일지·연습실 예약 호환 비밀번호 반영은 확인이 필요합니다. 같은 비밀번호로 다시 초기화하면 재시도됩니다.');
    } catch (error) {
      alert(error && error.message ? error.message : '비밀번호 초기화에 실패했습니다.');
    } finally { hideLoading(); }
  }
  async function retire(key) {
    const data = rowData(key);
    const confirmId = prompt(data.name + ' 계정을 퇴사 처리합니다.\n작성 기록은 보존되고 로그인은 차단됩니다.\n확인을 위해 로그인 ID를 입력해주세요.');
    if (!confirmId) return;
    try {
      showLoading('퇴사 처리 중...');
      await call('deleteStaffAccountAdmin', { firebaseUid: data.firebaseUid, confirmLoginId: confirmId });
      await load(true);
      alert('퇴사 처리가 완료되었습니다.');
    } catch (error) {
      alert(error && error.message ? error.message : '퇴사 처리에 실패했습니다.');
    } finally { hideLoading(); }
  }
  function installPanelHook() {
    const original = global.showAdminPanel;
    if (typeof original === 'function' && !original.__ulim7330Wrapped) {
      const wrapped = function (panelId) {
        const result = original.apply(this, arguments);
        if (panelId === 'adminPanelStaffAccounts') setTimeout(function () { load(false); }, 0);
        return result;
      };
      wrapped.__ulim7330Wrapped = true;
      global.showAdminPanel = wrapped;
      try { showAdminPanel = wrapped; } catch (_ignore) {}
    }
  }
  function install() {
    if (installed) return;
    installed = true;
    injectStyles();
    injectPanel();
    installPanelHook();
    global.ulimStaffAccountLoad7330 = load;
    global.ulimStaffAccountCreate7330 = create;
    global.ulimStaffAccountSave7330 = save;
    global.ulimStaffAccountResetPassword7330 = resetPassword;
    global.ulimStaffAccountRetire7330 = retire;
    global.addEventListener('ulim-firebase-auth-ready', function () {
      if (document.getElementById('adminPanelStaffAccounts')?.classList.contains('active')) load(true);
    });
    try {
      if (!global.__ULIM_CONSOLE_CLEANED_7330__) {
        global.__ULIM_CONSOLE_CLEANED_7330__ = true;
        console.clear();
      }
      console.info('[ULIM 7.33.0 CLEAN START] Firebase staff account management installed', VERSION);
    } catch (_ignore) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof window !== 'undefined' ? window : globalThis);
