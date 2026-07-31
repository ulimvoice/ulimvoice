(function (global) {
  'use strict';
  if (global.__ULIM_STAFF_ACCOUNT_ADMIN_73434__) return;
  global.__ULIM_STAFF_ACCOUNT_ADMIN_73434__ = true;

  const VERSION = '2026-08-01.734.03.4';
  let accounts = [];
  let listLoadingPromise = null;
  let sheetSyncPromise = null;
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
  function maskedUid(uid) {
    const value = text(uid);
    return value ? '•••' + value.slice(-6) : '';
  }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function isSuperAdmin() {
    const info = global.adminInfo || {};
    const role = text(info.firebaseRole || info.role).replace(/\s+/g, '').toLowerCase();
    return role === 'superadmin' || role === '전체관리자' || role === '전체관리' || role === '원장';
  }
  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }
  function timeoutError(name, timeoutMs) {
    const error = new Error(name + ' 요청이 ' + Math.ceil(timeoutMs / 1000) + '초 안에 완료되지 않았습니다.');
    error.code = 'ulim/client-timeout';
    return error;
  }
  async function withTimeout(promiseFactory, timeoutMs, name) {
    const limit = Math.max(1000, Number(timeoutMs || 15000));
    let timer = null;
    try {
      return await Promise.race([
        Promise.resolve().then(promiseFactory),
        new Promise(function (_resolve, reject) {
          timer = setTimeout(function () { reject(timeoutError(name || 'Firebase', limit)); }, limit);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async function runtime(timeoutMs) {
    return withTimeout(async function () {
      const room = roomRealtime();
      if (!room || typeof room.preloadRuntime !== 'function') throw new Error('Firebase 모듈을 준비하지 못했습니다.');
      const rt = await room.preloadRuntime();
      if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('Firebase 교직원 로그인이 필요합니다.');
      if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'staff-account-admin-73434');
      else await rt.sdk.getIdToken(rt.auth.currentUser, false);
      return rt;
    }, Number(timeoutMs || 12000), 'Firebase 인증 준비');
  }
  async function call(name, payload, timeoutMs) {
    const limit = Math.max(3000, Number(timeoutMs || 30000));
    return withTimeout(async function () {
      const rt = await runtime(Math.min(12000, Math.max(5000, limit - 1000)));
      const fn = rt.sdk.httpsCallable(rt.functions, name);
      const response = await fn(payload || {});
      return response && response.data || {};
    }, limit, name);
  }
  function showLoading(message) { try { if (typeof global.showLoading === 'function') global.showLoading(message || '처리 중...'); } catch (_ignore) {} }
  function hideLoading() { try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {} }
  function status(message, state) {
    const el = document.getElementById('ulimStaffAccountStatus7342');
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
  function credentialLabel(account) {
    if (account.passwordLoginEnabled === true && account.mustChangePassword !== true) return '<span class="ulim-credential ok">사용가능</span>';
    if (account.passwordLoginEnabled === true) return '<span class="ulim-credential wait">변경필요</span>';
    return '<span class="ulim-credential fail">암호초기화 필요</span>';
  }
  function injectStyles() {
    if (document.getElementById('ulimStaffAccountStyle7342')) return;
    const style = document.createElement('style');
    style.id = 'ulimStaffAccountStyle7342';
    style.textContent = `
      #adminPanelStaffAccounts .ulim-staff-account-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
      #adminPanelStaffAccounts .ulim-staff-account-actions{display:flex;gap:6px;flex-wrap:wrap}
      #adminPanelStaffAccounts .ulim-staff-account-table{width:100%;border-collapse:collapse;min-width:1080px}
      #adminPanelStaffAccounts .ulim-staff-account-table th,#adminPanelStaffAccounts .ulim-staff-account-table td{border-bottom:1px solid #e5e7eb;padding:8px;vertical-align:middle;font-size:12px}
      #adminPanelStaffAccounts .ulim-staff-account-table th{background:#f8fafc;text-align:left;position:sticky;top:0;z-index:1}
      #adminPanelStaffAccounts input,#adminPanelStaffAccounts select{width:100%;box-sizing:border-box;padding:8px;border:1px solid #d1d5db;border-radius:8px;background:#fff}
      #adminPanelStaffAccounts .ulim-staff-account-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#64748b;margin-top:3px}
      #ulimStaffAccountStatus7342{display:none;margin:10px 0;padding:10px 12px;border-radius:9px;font-size:13px;white-space:pre-wrap}
      #ulimStaffAccountStatus7342[data-state="ok"]{display:block;background:#ecfdf5;color:#166534}
      #ulimStaffAccountStatus7342[data-state="warn"]{display:block;background:#fffbeb;color:#92400e}
      #ulimStaffAccountStatus7342[data-state="error"]{display:block;background:#fff7ed;color:#9a3412}
      #ulimStaffAccountStatus7342[data-state="loading"]{display:block;background:#eff6ff;color:#1d4ed8}
      .ulim-staff-sync,.ulim-credential{display:inline-block;padding:3px 7px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:11px;font-weight:700}
      .ulim-staff-sync.ok,.ulim-credential.ok{background:#dcfce7;color:#166534}.ulim-staff-sync.wait,.ulim-credential.wait{background:#fef3c7;color:#92400e}.ulim-staff-sync.fail,.ulim-credential.fail{background:#fee2e2;color:#991b1b}
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
        else global.ulimStaffAccountLoad7342(false);
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
          Firebase Authentication과 Firestore의 <b>users</b> 문서가 계정·권한 원본입니다.
          <b>목록 새로고침</b>은 Google Sheets 관리자 시트를 기준으로 이름·ID·전화번호·UID 연결을 갱신합니다. 비밀번호·Hash·Salt는 읽지 않습니다.
          새로 연결된 계정은 관리자가 암호를 초기화해야 Firebase 비밀번호 로그인이 활성화됩니다.
        </p>
        <div id="ulimStaffAccountStatus7342"></div>
        <div class="ulim-staff-account-grid">
          <div class="admin-field"><label>로그인 ID</label><input id="ulimStaffNewLoginId7342" autocomplete="off" placeholder="예: kimcs"></div>
          <div class="admin-field"><label>이름</label><input id="ulimStaffNewName7342" placeholder="강사명"></div>
          <div class="admin-field"><label>전화번호</label><input id="ulimStaffNewPhone7342" placeholder="선택 입력"></div>
          <div class="admin-field"><label>역할</label><select id="ulimStaffNewRole7342"><option value="teacher">강사</option><option value="admin">관리자</option><option value="superAdmin">전체관리자</option></select></div>
          <div class="admin-field"><label>임시 비밀번호</label><input id="ulimStaffNewPassword7342" type="password" autocomplete="new-password" placeholder="6자 이상"></div>
          <div class="admin-field"><label>최초 로그인</label><select id="ulimStaffNewMustChange7342"><option value="true">비밀번호 변경 필요</option><option value="false">변경 없이 사용</option></select></div>
        </div>
        <div class="admin-btn-row" style="margin-top:10px;">
          <button type="button" class="admin-btn" onclick="ulimStaffAccountCreate7342()">교직원 추가</button>
          <button type="button" id="ulimStaffSheetRefresh73434" class="admin-btn blue">목록 새로고침</button>
          <button type="button" id="ulimStaffFirestoreRefresh73434" class="admin-btn">Firestore만 다시조회</button>
        </div>
        <div id="ulimStaffAccountSummary7342" style="font-size:12px;color:#64748b;margin:10px 0;"></div>
        <div class="admin-table-wrap"><div id="ulimStaffAccountTable7342"></div></div>
      </div>`;
    dashboard.appendChild(panel);
  }
  function render() {
    const wrap = document.getElementById('ulimStaffAccountTable7342');
    const summary = document.getElementById('ulimStaffAccountSummary7342');
    if (!wrap) return;
    rowKeyMap.clear();
    if (!accounts.length) {
      wrap.innerHTML = '<div style="padding:18px;color:#64748b;">등록된 교직원이 없습니다.</div>';
      if (summary) summary.textContent = '교직원 0명';
      return;
    }
    const activeCount = accounts.filter(function (item) { return item.active === true; }).length;
    const resetCount = accounts.filter(function (item) { return item.passwordLoginEnabled !== true; }).length;
    if (summary) summary.textContent = '전체 ' + accounts.length + '명 · 활성 ' + activeCount + '명 · 중지/퇴사 ' + (accounts.length - activeCount) + '명 · 암호 초기화 필요 ' + resetCount + '명';
    const rows = accounts.map(function (account) {
      const key = safeKey(account.firebaseUid);
      const disabledClass = account.active === true ? '' : ' class="ulim-staff-account-disabled"';
      return `<tr${disabledClass}>
        <td><input id="${key}_name" value="${escapeHtml(account.name)}"></td>
        <td><input id="${key}_login" value="${escapeHtml(account.loginId)}"><div class="ulim-staff-account-id">UID ${escapeHtml(maskedUid(account.firebaseUid))}</div></td>
        <td><input id="${key}_phone" value="${escapeHtml(account.phone || '')}"></td>
        <td><select id="${key}_role"><option value="teacher"${account.role === 'teacher' ? ' selected' : ''}>강사</option><option value="admin"${account.role === 'admin' ? ' selected' : ''}>관리자</option><option value="superAdmin"${account.role === 'superAdmin' ? ' selected' : ''}>전체관리자</option></select></td>
        <td><select id="${key}_active"><option value="true"${account.active === true ? ' selected' : ''}>사용</option><option value="false"${account.active !== true ? ' selected' : ''}>중지</option></select></td>
        <td>${credentialLabel(account)}<br><select id="${key}_must" style="margin-top:5px"><option value="false"${account.mustChangePassword !== true ? ' selected' : ''}>변경완료</option><option value="true"${account.mustChangePassword === true ? ' selected' : ''}>변경필요</option></select></td>
        <td>${syncLabel(account)}<div style="font-size:10px;color:#64748b;max-width:170px;word-break:break-all;">${escapeHtml(account.legacySyncMessage || '')}</div></td>
        <td><div class="ulim-staff-account-actions">
          <button type="button" class="admin-btn blue" onclick="ulimStaffAccountSave7342('${key}')">저장</button>
          <button type="button" class="admin-btn orange" onclick="ulimStaffAccountResetPassword7342('${key}')">암호 초기화</button>
          <button type="button" class="admin-btn red" onclick="ulimStaffAccountRetire7342('${key}')">퇴사처리</button>
        </div></td>
      </tr>`;
    }).join('');
    wrap.innerHTML = `<table class="ulim-staff-account-table"><thead><tr><th>이름</th><th>로그인 ID</th><th>전화번호</th><th>역할</th><th>상태</th><th>암호상태</th><th>시트호환</th><th>관리</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function accountFromDoc(doc) {
    const user = doc && typeof doc.data === 'function' ? (doc.data() || {}) : {};
    return {
      firebaseUid: text(doc && doc.id),
      loginId: text(user.loginId || user.adminId || user.legacyAdminId),
      name: text(user.name || user.displayName || user.teacherName || user.adminName),
      phone: text(user.phone || user.phoneNumber),
      role: text(user.role) || 'teacher',
      active: user.active === true,
      mustChangePassword: user.mustChangePassword === true,
      passwordLoginEnabled: user.passwordLoginEnabled === true,
      teacherUid: text(user.teacherUid),
      legacySyncState: text(user.legacySyncState),
      legacySyncMessage: text(user.legacySyncMessage),
      updatedAtMs: Number(user.updatedAtMs || 0)
    };
  }
  async function listAccountsDirect() {
    return withTimeout(async function () {
      const rt = await runtime(12000);
      const ref = rt.sdk.collection(rt.db, 'users');
      const snap = await rt.sdk.getDocs(rt.sdk.query(ref, rt.sdk.limit(500)));
      accounts = snap.docs.map(accountFromDoc).filter(function (item) {
        return item.role === 'teacher' || item.role === 'admin' || item.role === 'superAdmin';
      }).sort(function (left, right) {
        const activeDiff = Number(right.active === true) - Number(left.active === true);
        if (activeDiff) return activeDiff;
        return text(left.name).localeCompare(text(right.name), 'ko');
      });
      render();
      return { ok: true, accounts: accounts, count: accounts.length, source: 'firestore-direct' };
    }, 20000, 'Firestore 교직원 직접 조회');
  }
  async function listAccounts() {
    try {
      const data = await call('listStaffAccountsAdmin', {}, 20000);
      accounts = Array.isArray(data.accounts) ? data.accounts : [];
      render();
      return Object.assign({ source: 'callable' }, data || {});
    } catch (error) {
      const fallback = await listAccountsDirect();
      fallback.callableError = text(error && error.message || error);
      return fallback;
    }
  }
  function setRefreshBusy(busy) {
    const sheetButton = document.getElementById('ulimStaffSheetRefresh73434');
    const firestoreButton = document.getElementById('ulimStaffFirestoreRefresh73434');
    if (sheetButton) {
      sheetButton.disabled = busy === true;
      sheetButton.textContent = busy === true ? '시트 동기화 중...' : '목록 새로고침';
    }
    if (firestoreButton) firestoreButton.disabled = busy === true;
  }
  async function refreshFirestoreOnly(options) {
    const opts = options || {};
    if (!isSuperAdmin()) {
      status('교직원 계정 관리는 전체관리자만 사용할 수 있습니다.', 'error');
      return false;
    }
    if (listLoadingPromise && opts.force !== true) return listLoadingPromise;
    const run = (async function () {
      if (opts.keepStatus !== true) status('Firestore 교직원 목록을 불러오는 중...', 'loading');
      try { console.info('[ULIM 7.34.3.4 staff list] Firestore refresh start'); } catch (_ignore) {}
      const listResult = await listAccounts();
      if (opts.keepStatus !== true) {
        status(listResult && listResult.source === 'firestore-direct'
          ? '교직원 목록을 불러왔습니다. 서버 목록 함수 대신 Firestore를 직접 조회했습니다.'
          : '교직원 목록을 불러왔습니다.',
        listResult && listResult.source === 'firestore-direct' ? 'warn' : 'ok');
      }
      try { console.info('[ULIM 7.34.3.4 staff list] Firestore refresh complete', { count: accounts.length }); } catch (_ignore) {}
      return listResult;
    })().catch(function (error) {
      if (opts.keepStatus !== true) status(text(error && error.message) || '교직원 계정 목록 조회에 실패했습니다.', 'error');
      try { console.error('[ULIM 7.34.3.4 staff list] failed', error); } catch (_ignore) {}
      throw error;
    }).finally(function () {
      if (listLoadingPromise === run) listLoadingPromise = null;
    });
    listLoadingPromise = run;
    return run;
  }
  async function syncDirectoryFromSheet() {
    if (!isSuperAdmin()) {
      status('교직원 계정 관리는 전체관리자만 사용할 수 있습니다.', 'error');
      return false;
    }
    if (sheetSyncPromise) {
      status('Google Sheets 교직원 동기화가 이미 진행 중입니다.', 'loading');
      return sheetSyncPromise;
    }
    if (!confirm('Google Sheets 관리자 시트를 기준으로 교직원 목록을 새로고침할까요?\n이름·로그인 ID·전화번호·UID 연결만 갱신하며 비밀번호·Hash·Salt는 읽지 않습니다.')) return false;

    const run = (async function () {
      setRefreshBusy(true);
      status('1/3 Google Sheets 관리자 시트 동기화를 시작합니다...', 'loading');
      try { console.info('[ULIM 7.34.3.4 staff sheet sync] click accepted'); } catch (_ignore) {}

      let syncResult;
      try {
        status('1/3 Google Sheets 관리자 시트를 읽고 Firebase 계정을 연결하는 중... 최대 100초', 'loading');
        syncResult = await call('syncStaffDirectoryFromSheetsAdmin7342', { requestId: requestId('staff-directory') }, 100000);
        try { console.info('[ULIM 7.34.3.4 staff sheet sync] callable complete', { total: Number(syncResult && syncResult.total || 0), created: Number(syncResult && syncResult.created || 0), failed: Number(syncResult && syncResult.failed || 0) }); } catch (_ignore) {}
      } catch (error) {
        try { console.error('[ULIM 7.34.3.4 staff sheet sync] callable failed', error); } catch (_ignore) {}
        status('시트 동기화에 실패했습니다. 현재 Firestore 목록을 다시 확인합니다.\n' + text(error && error.message || error), 'error');
        try { await refreshFirestoreOnly({ force: true, keepStatus: true }); } catch (_ignore) {}
        return false;
      }

      status('2/3 Firestore 교직원 목록을 다시 읽는 중...', 'loading');
      try {
        await refreshFirestoreOnly({ force: true, keepStatus: true });
      } catch (error) {
        status('시트 동기화는 완료됐지만 Firestore 목록 재조회에 실패했습니다.\n' + text(error && error.message || error), 'warn');
        return false;
      }

      const message = '3/3 연결 완료: 전체 ' + Number(syncResult.total || accounts.length || 0) + '명 · 신규 ' + Number(syncResult.created || 0) + '명 · 연결수정 ' + Number(syncResult.repaired || 0) + '명 · 유지 ' + Number(syncResult.preserved || 0) + '명 · 암호초기화 필요 ' + Number(syncResult.resetRequired || 0) + '명' + (Number(syncResult.roleReviewRequired || 0) ? ' · 관리자 권한 검토 ' + Number(syncResult.roleReviewRequired || 0) + '명' : '') + (Number(syncResult.failed || 0) ? ' · 실패 ' + Number(syncResult.failed || 0) + '명' : '');
      status(message, Number(syncResult.failed || 0) || Number(syncResult.bindingFailed || 0) ? 'warn' : 'ok');
      return true;
    })().catch(function (error) {
      status('교직원 시트 동기화가 중단되었습니다.\n' + (text(error && error.message) || '알 수 없는 오류'), 'error');
      try { console.error('[ULIM 7.34.3.4 staff sheet sync] unexpected failure', error); } catch (_ignore) {}
      return false;
    }).finally(function () {
      setRefreshBusy(false);
      if (sheetSyncPromise === run) sheetSyncPromise = null;
    });
    sheetSyncPromise = run;
    return run;
  }
  async function load(syncFromSheet) {
    return syncFromSheet === true ? syncDirectoryFromSheet() : refreshFirestoreOnly();
  }
  async function create() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const loginId = text(document.getElementById('ulimStaffNewLoginId7342')?.value);
    const name = text(document.getElementById('ulimStaffNewName7342')?.value);
    const phone = text(document.getElementById('ulimStaffNewPhone7342')?.value);
    const role = text(document.getElementById('ulimStaffNewRole7342')?.value) || 'teacher';
    const password = String(document.getElementById('ulimStaffNewPassword7342')?.value || '');
    const mustChangePassword = text(document.getElementById('ulimStaffNewMustChange7342')?.value) !== 'false';
    if (!loginId || !name || password.length < 6) return alert('로그인 ID, 이름, 6자 이상의 임시 비밀번호를 입력해주세요.');
    if (!confirm(name + ' 교직원 계정을 생성할까요?')) return;
    try {
      showLoading('교직원 계정 생성 중...');
      await call('createStaffAccountAdmin', { loginId, name, phone, role, password, mustChangePassword });
      ['ulimStaffNewLoginId7342','ulimStaffNewName7342','ulimStaffNewPhone7342','ulimStaffNewPassword7342'].forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ''; });
      await load(false);
      alert('교직원 계정이 생성되었습니다.');
    } catch (error) {
      alert(text(error && error.message) || '교직원 계정 생성에 실패했습니다.');
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
      await load(false);
      const state = result && result.legacySync && result.legacySync.state;
      alert(state === 'complete' ? '교직원 계정이 저장되었습니다.' : 'Firebase 계정은 저장되었고 Google Sheets 호환 반영은 백그라운드에서 재시도합니다.');
    } catch (error) {
      alert(text(error && error.message) || '교직원 계정 저장에 실패했습니다.');
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
      await load(false);
      alert(result.legacySyncState === 'complete' ? '비밀번호가 초기화되었습니다. 기존 로그인은 모두 해제됩니다.' : 'Firebase 비밀번호는 초기화되었습니다. 기존 GAS 기능용 보안 Hash 반영은 확인이 필요합니다.');
    } catch (error) {
      alert(text(error && error.message) || '비밀번호 초기화에 실패했습니다.');
    } finally { hideLoading(); }
  }
  async function retire(key) {
    const data = rowData(key);
    const confirmId = prompt(data.name + ' 계정을 퇴사 처리합니다.\n작성 기록은 보존되고 로그인은 차단됩니다.\n확인을 위해 로그인 ID를 입력해주세요.');
    if (!confirmId) return;
    try {
      showLoading('퇴사 처리 중...');
      await call('deleteStaffAccountAdmin', { firebaseUid: data.firebaseUid, confirmLoginId: confirmId });
      await load(false);
      alert('퇴사 처리가 완료되었습니다.');
    } catch (error) {
      alert(text(error && error.message) || '퇴사 처리에 실패했습니다.');
    } finally { hideLoading(); }
  }
  function installPanelHook() {
    const original = global.showAdminPanel;
    if (typeof original === 'function' && !original.__ulim7342Wrapped) {
      const wrapped = function (panelId) {
        const result = original.apply(this, arguments);
        if (panelId === 'adminPanelStaffAccounts') setTimeout(function () { load(false); }, 0);
        return result;
      };
      wrapped.__ulim7342Wrapped = true;
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
    global.ulimStaffAccountLoad7342 = load;
    global.ulimStaffAccountCreate7342 = create;
    global.ulimStaffAccountSave7342 = save;
    global.ulimStaffAccountResetPassword7342 = resetPassword;
    global.ulimStaffAccountRetire7342 = retire;
    const sheetRefreshButton = document.getElementById('ulimStaffSheetRefresh73434');
    const firestoreRefreshButton = document.getElementById('ulimStaffFirestoreRefresh73434');
    if (sheetRefreshButton && !sheetRefreshButton.dataset.ulimBound73434) {
      sheetRefreshButton.dataset.ulimBound73434 = '1';
      sheetRefreshButton.addEventListener('click', function () { syncDirectoryFromSheet(); });
    }
    if (firestoreRefreshButton && !firestoreRefreshButton.dataset.ulimBound73434) {
      firestoreRefreshButton.dataset.ulimBound73434 = '1';
      firestoreRefreshButton.addEventListener('click', function () { refreshFirestoreOnly({ force: true }); });
    }
    global.addEventListener('ulim-firebase-auth-ready', function () {
      if (document.getElementById('adminPanelStaffAccounts')?.classList.contains('active')) load(false);
    });
    global.addEventListener('ulim-firebase-token-invalid', function () {
      status('Firebase 로그인 세션이 만료되어 계정 목록 조회를 중단했습니다. 다시 로그인해주세요.', 'error');
    });
    try {
      if (!global.__ULIM_CONSOLE_CLEANED_7342__) {
        global.__ULIM_CONSOLE_CLEANED_7342__ = true;
        console.clear();
      }
      console.info('[ULIM 7.34.3.4 CLEAN START] independent sheet sync button + visible progress');
    } catch (_ignore) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof window !== 'undefined' ? window : globalThis);
