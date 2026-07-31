(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_MASTER_ADMIN_7342__) return;
  global.__ULIM_STUDENT_MASTER_ADMIN_7342__ = true;

  const VERSION = '2026-08-01.734.02';
  const PANEL_ID = 'adminPanelStudentMaster7342';
  const CARD_ID = 'ulimStudentMasterCard7342';
  const STATUS_ID = 'ulimStudentMasterStatus7342';
  const TABLE_ID = 'ulimStudentMasterTable7342';
  const SUMMARY_ID = 'ulimStudentMasterSummary7342';
  const FILTER_ID = 'ulimStudentMasterFilter7342';
  const STATUS_FILTER_ID = 'ulimStudentMasterStatusFilter7342';
  const PAGE_SIZE = 100;

  let installed = false;
  let targetPanelId = PANEL_ID;
  let students = [];
  let filtered = [];
  let loadingPromise = null;
  let page = 1;
  const rowKeyMap = new Map();

  function text(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function safeKey(uid) {
    const key = 's_' + String(uid || '').replace(/[^0-9A-Za-z_-]/g, '_');
    rowKeyMap.set(key, uid);
    return key;
  }
  function maskedUid(uid) { const value = text(uid); return value ? '•••' + value.slice(-6) : ''; }
  function isSuperAdmin() {
    const info = global.adminInfo || {};
    const role = normalize(info.firebaseRole || info.role);
    return role === 'superadmin' || role === normalize('전체관리자') || role === normalize('전체관리') || role === normalize('원장');
  }
  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('Firebase 모듈을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('Firebase 교직원 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'student-master-admin-7342');
    else await rt.sdk.getIdToken(rt.auth.currentUser, false);
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
  function setStatus(message, state) {
    const el = document.getElementById(STATUS_ID);
    if (!el) return;
    el.textContent = message || '';
    el.dataset.state = state || '';
    el.style.display = message ? 'block' : 'none';
  }
  function statusValue(value) {
    const key = normalize(value);
    if (key === 'leave' || key === normalize('휴원')) return 'leave';
    if (key === 'withdrawn' || key === normalize('퇴원')) return 'withdrawn';
    return 'active';
  }
  function syncLabel(student) {
    const state = text(student.sheetSyncState);
    if (state === 'complete') return '<span class="ulim-student-sync ok">시트완료</span>';
    if (state === 'firestore-only') return '<span class="ulim-student-sync fs">Firestore</span>';
    if (state === 'failed') return '<span class="ulim-student-sync fail">확인필요</span>';
    return '<span class="ulim-student-sync">미확인</span>';
  }
  function injectStyles() {
    if (document.getElementById('ulimStudentMasterStyle7342')) return;
    const style = document.createElement('style');
    style.id = 'ulimStudentMasterStyle7342';
    style.textContent = `
      #${CARD_ID}{margin-bottom:14px}
      #${CARD_ID} .ulim-student-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 150px auto;gap:8px;align-items:end}
      #${CARD_ID} .ulim-student-actions{display:flex;gap:6px;flex-wrap:wrap}
      #${CARD_ID} .ulim-student-table{width:100%;border-collapse:collapse;min-width:1340px}
      #${CARD_ID} .ulim-student-table th,#${CARD_ID} .ulim-student-table td{border-bottom:1px solid #e5e7eb;padding:7px;vertical-align:middle;font-size:12px}
      #${CARD_ID} .ulim-student-table th{background:#f8fafc;text-align:left;position:sticky;top:0;z-index:2}
      #${CARD_ID} input,#${CARD_ID} select{width:100%;box-sizing:border-box;padding:7px;border:1px solid #d1d5db;border-radius:8px;background:#fff}
      #${CARD_ID} .ulim-readonly{padding:7px 4px;color:#475569;line-height:1.45;word-break:break-word}
      #${CARD_ID} .ulim-student-uid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:#64748b;margin-top:3px}
      #${CARD_ID} .ulim-student-help{font-size:12px;color:#64748b;line-height:1.65}
      #${STATUS_ID}{display:none;margin:10px 0;padding:10px 12px;border-radius:9px;font-size:13px;white-space:pre-wrap}
      #${STATUS_ID}[data-state="ok"]{display:block;background:#ecfdf5;color:#166534}
      #${STATUS_ID}[data-state="warn"]{display:block;background:#fffbeb;color:#92400e}
      #${STATUS_ID}[data-state="error"]{display:block;background:#fff7ed;color:#9a3412}
      #${STATUS_ID}[data-state="loading"]{display:block;background:#eff6ff;color:#1d4ed8}
      .ulim-student-sync{display:inline-block;padding:3px 7px;border-radius:999px;font-size:11px;font-weight:700;background:#f1f5f9;color:#475569}
      .ulim-student-sync.ok{background:#dcfce7;color:#166534}.ulim-student-sync.fs{background:#e0f2fe;color:#075985}.ulim-student-sync.fail{background:#fee2e2;color:#991b1b}
      #${CARD_ID} tr[data-status="leave"]{background:#fffbeb}#${CARD_ID} tr[data-status="withdrawn"]{background:#f8fafc;opacity:.72}
      #${CARD_ID} .ulim-student-pagination{display:flex;gap:8px;justify-content:center;align-items:center;margin:12px 0 2px}
      @media(max-width:800px){#${CARD_ID} .ulim-student-toolbar{grid-template-columns:1fr}#${CARD_ID} .ulim-student-table{min-width:1180px}}
    `;
    document.head.appendChild(style);
  }
  function findExistingPanel() {
    const ids = ['adminPanelStudents','adminPanelStudentList','adminPanelStudentRoster','adminPanelStudent','adminPanelRoster'];
    for (const id of ids) { const panel = document.getElementById(id); if (panel) return panel; }
    return null;
  }
  function cardHtml() {
    return `
      <div id="${CARD_ID}" class="admin-card admin-full-only">
        <h3 style="margin-top:0;">학생정보 관리</h3>
        <div class="ulim-student-help">
          <b>학생목록 시트 가져오기</b>는 학생인증 UID가 이미 확정된 학생만 Firestore로 이관합니다.
          UID가 없는 학생은 임의 생성하지 않고 제외합니다. 학생 비밀번호와 Firebase 학생 로그인은 이번 단계에서 변경하지 않습니다.<br>
          학생의 반·담당강사는 안전을 위해 조회 전용이며, 이름·전화번호·재원상태·메모만 수정할 수 있습니다.
        </div>
        <div id="${STATUS_ID}"></div>
        <div class="ulim-student-toolbar">
          <div class="admin-field"><label>검색</label><input id="${FILTER_ID}" placeholder="학생명 · 출결번호 · 전화번호 · 반명 · 담당강사"></div>
          <div class="admin-field"><label>재원상태</label><select id="${STATUS_FILTER_ID}"><option value="">전체</option><option value="active">재원</option><option value="leave">휴원</option><option value="withdrawn">퇴원</option></select></div>
          <div class="ulim-student-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentMasterLoad7342(false)">Firestore 다시조회</button><button type="button" class="admin-btn orange" onclick="ulimStudentMasterLoad7342(true)">학생목록 시트 가져오기</button></div>
        </div>
        <div id="${SUMMARY_ID}" style="font-size:12px;color:#64748b;margin:10px 0;"></div>
        <div class="admin-table-wrap"><div id="${TABLE_ID}"></div></div>
        <div id="ulimStudentMasterPagination7342" class="ulim-student-pagination"></div>
      </div>`;
  }
  function injectPanel() {
    const existing = findExistingPanel();
    if (existing) {
      targetPanelId = existing.id;
      if (!document.getElementById(CARD_ID)) existing.insertAdjacentHTML('afterbegin', cardHtml());
      return;
    }
    const subtabs = document.querySelector('#adminDashboard .admin-subtabs');
    if (subtabs && !document.querySelector('[data-admin-panel="' + PANEL_ID + '"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-subtab admin-full-only';
      button.dataset.adminPanel = PANEL_ID;
      button.textContent = '학생정보 관리';
      button.onclick = function () {
        if (typeof global.showAdminPanel === 'function') global.showAdminPanel(PANEL_ID);
        else global.ulimStudentMasterLoad7342(false);
      };
      subtabs.appendChild(button);
    }
    const dashboard = document.getElementById('adminDashboard');
    if (!dashboard || document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'admin-panel';
    panel.innerHTML = cardHtml();
    dashboard.appendChild(panel);
  }
  function source(raw) {
    const student = raw || {};
    return {
      studentUid: text(student.studentUid),
      loginId: text(student.loginId),
      name: text(student.name),
      phone: text(student.phone),
      parentPhone: text(student.parentPhone),
      status: statusValue(student.status),
      classNames: Array.isArray(student.classNames) ? student.classNames.map(text).filter(Boolean) : [],
      instructorNames: Array.isArray(student.instructorNames) ? student.instructorNames.map(text).filter(Boolean) : [],
      memo: text(student.memo),
      sheetSyncState: text(student.sheetSyncState),
      sheetSyncMessage: text(student.sheetSyncMessage),
      unresolved: student.unresolved === true
    };
  }
  function applyFilter() {
    const keyword = normalize(document.getElementById(FILTER_ID)?.value);
    const wantedStatus = text(document.getElementById(STATUS_FILTER_ID)?.value);
    filtered = students.filter(function (student) {
      if (wantedStatus && student.status !== wantedStatus) return false;
      if (!keyword) return true;
      return normalize([student.name,student.loginId,student.phone,student.parentPhone,student.classNames.join(' '),student.instructorNames.join(' ')].join(' ')).indexOf(keyword) >= 0;
    });
    page = 1;
    render();
  }
  function rowData(key) {
    return {
      studentUid: rowKeyMap.get(key) || '',
      name: text(document.getElementById(key + '_name')?.value),
      phone: text(document.getElementById(key + '_phone')?.value),
      parentPhone: text(document.getElementById(key + '_parent')?.value),
      status: text(document.getElementById(key + '_status')?.value) || 'active',
      memo: text(document.getElementById(key + '_memo')?.value)
    };
  }
  function renderPagination(totalPages) {
    const wrap = document.getElementById('ulimStudentMasterPagination7342');
    if (!wrap) return;
    if (totalPages <= 1) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `<button type="button" class="admin-btn" ${page <= 1 ? 'disabled' : ''} onclick="ulimStudentMasterPage7342(${page - 1})">이전</button><span>${page} / ${totalPages}</span><button type="button" class="admin-btn" ${page >= totalPages ? 'disabled' : ''} onclick="ulimStudentMasterPage7342(${page + 1})">다음</button>`;
  }
  function render() {
    const wrap = document.getElementById(TABLE_ID);
    const summary = document.getElementById(SUMMARY_ID);
    if (!wrap) return;
    rowKeyMap.clear();
    const active = filtered.filter(function (s) { return s.status === 'active'; }).length;
    const leave = filtered.filter(function (s) { return s.status === 'leave'; }).length;
    const withdrawn = filtered.filter(function (s) { return s.status === 'withdrawn'; }).length;
    if (summary) summary.textContent = '표시 ' + filtered.length + '명 / 전체 ' + students.length + '명 · 재원 ' + active + ' · 휴원 ' + leave + ' · 퇴원 ' + withdrawn;
    if (!filtered.length) { wrap.innerHTML = '<div style="padding:18px;color:#64748b;">조건에 맞는 학생이 없습니다.</div>'; renderPagination(0); return; }
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > totalPages) page = totalPages;
    const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const rows = visible.map(function (student) {
      const key = safeKey(student.studentUid);
      return `<tr data-status="${escapeHtml(student.status)}">
        <td><select id="${key}_status"><option value="active"${student.status === 'active' ? ' selected' : ''}>재원</option><option value="leave"${student.status === 'leave' ? ' selected' : ''}>휴원</option><option value="withdrawn"${student.status === 'withdrawn' ? ' selected' : ''}>퇴원</option></select></td>
        <td><input id="${key}_name" value="${escapeHtml(student.name)}"></td>
        <td><div class="ulim-readonly">${escapeHtml(student.loginId)}<div class="ulim-student-uid">UID ${escapeHtml(maskedUid(student.studentUid))}</div></div></td>
        <td><input id="${key}_phone" value="${escapeHtml(student.phone)}"></td>
        <td><input id="${key}_parent" value="${escapeHtml(student.parentPhone)}"></td>
        <td><div class="ulim-readonly">${escapeHtml(student.classNames.join(', '))}</div></td>
        <td><div class="ulim-readonly">${escapeHtml(student.instructorNames.join(', '))}</div></td>
        <td><input id="${key}_memo" value="${escapeHtml(student.memo)}"></td>
        <td>${syncLabel(student)}<div style="font-size:10px;color:#64748b;max-width:150px;word-break:break-all;">${escapeHtml(student.sheetSyncMessage)}</div></td>
        <td><div class="ulim-student-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentMasterSave7342('${key}',false)">Firestore 저장</button><button type="button" class="admin-btn orange" onclick="ulimStudentMasterSave7342('${key}',true)">시트 반영 저장</button></div></td>
      </tr>`;
    }).join('');
    wrap.innerHTML = `<table class="ulim-student-table"><thead><tr><th>재원상태</th><th>학생명</th><th>출결번호</th><th>학생전화</th><th>보호자전화</th><th>현재반</th><th>담당강사</th><th>메모</th><th>동기화</th><th>관리</th></tr></thead><tbody>${rows}</tbody></table>`;
    renderPagination(totalPages);
  }
  async function listFirestore() {
    const data = await call('listStudentsAdmin7342', { limit: 3000 });
    students = (Array.isArray(data.students) ? data.students : []).map(source);
    filtered = students.slice();
    page = 1;
    render();
  }
  async function load(importFromSheet) {
    if (!isSuperAdmin()) { setStatus('학생정보 관리는 전체관리자만 사용할 수 있습니다.', 'error'); return false; }
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async function () {
      let syncResult = null;
      let syncError = null;
      if (importFromSheet === true) {
        if (!confirm('Google Sheets 학생명단에서 학생인증 UID가 확정된 학생만 Firestore로 가져올까요?\n비밀번호·반 UID·학생 로그인 자격증명은 변경하지 않습니다.')) return false;
        setStatus('학생명단을 안전하게 이관하는 중...', 'loading');
        try { syncResult = await call('syncStudentsFromSheetsAdmin7342', { requestId: requestId('student-directory') }); }
        catch (error) { syncError = error; }
      }
      setStatus('Firestore 학생목록을 불러오는 중...', 'loading');
      await listFirestore();
      if (syncResult) {
        const message = '학생 이관: 신규 ' + Number(syncResult.created || 0) + '명 · 갱신 ' + Number(syncResult.updated || 0) + '명 · 유지 ' + Number(syncResult.preserved || 0) + '명 · UID 없음 제외 ' + Number(syncResult.unresolved || 0) + '명' + (Number(syncResult.failed || 0) ? ' · 실패 ' + Number(syncResult.failed || 0) + '명' : '');
        setStatus(message, Number(syncResult.failed || 0) ? 'warn' : 'ok');
      } else if (syncError) {
        setStatus('시트 이관은 실패했지만 현재 Firestore 목록은 불러왔습니다. ' + text(syncError.message || syncError), 'warn');
      } else setStatus('Firestore 학생목록을 불러왔습니다.', 'ok');
      return true;
    })().catch(function (error) {
      setStatus(text(error && error.message) || '학생목록 조회에 실패했습니다.', 'error');
      return false;
    }).finally(function () { loadingPromise = null; });
    return loadingPromise;
  }
  async function save(key, syncSheet) {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const data = rowData(key);
    if (!data.studentUid || !data.name) return alert('학생 UID와 학생명을 확인해주세요.');
    const label = syncSheet ? 'Firestore와 Google Sheets에 저장' : 'Firestore에만 저장';
    if (!confirm(data.name + ' 학생 정보를 ' + label + '할까요?')) return;
    try {
      showLoading(syncSheet ? '학생정보 시트 반영 중...' : '학생정보 저장 중...');
      const result = await call('updateStudentMetadataAdmin7342', Object.assign({}, data, { syncSheet: syncSheet === true, requestId: requestId('student-metadata') }));
      await load(false);
      if (result.sheetSyncState === 'failed') alert('Firestore 저장은 완료됐지만 Google Sheets 반영에 실패했습니다.\n' + text(result.sheetSyncMessage));
      else alert(syncSheet ? '학생정보를 Firestore와 Google Sheets에 저장했습니다.' : '학생정보를 Firestore에 저장했습니다.');
    } catch (error) {
      alert(text(error && error.message) || '학생정보 저장에 실패했습니다.');
    } finally { hideLoading(); }
  }
  function goPage(next) {
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    page = Math.max(1, Math.min(totalPages, Number(next || 1)));
    render();
    document.getElementById(CARD_ID)?.scrollIntoView({ block: 'start' });
  }
  function installPanelHook() {
    const original = global.showAdminPanel;
    if (typeof original === 'function' && !original.__ulimStudent7342Wrapped) {
      const wrapped = function (panelId) {
        const result = original.apply(this, arguments);
        if (panelId === targetPanelId) setTimeout(function () { if (!students.length) load(false); }, 0);
        return result;
      };
      wrapped.__ulimStudent7342Wrapped = true;
      global.showAdminPanel = wrapped;
      try { showAdminPanel = wrapped; } catch (_ignore) {}
    }
  }
  function bindFilters() {
    const filter = document.getElementById(FILTER_ID);
    const statusFilter = document.getElementById(STATUS_FILTER_ID);
    if (filter && !filter.dataset.ulim7342Bound) { filter.dataset.ulim7342Bound = '1'; filter.addEventListener('input', applyFilter); }
    if (statusFilter && !statusFilter.dataset.ulim7342Bound) { statusFilter.dataset.ulim7342Bound = '1'; statusFilter.addEventListener('change', applyFilter); }
  }
  function install() {
    if (installed) return;
    installed = true;
    injectStyles();
    injectPanel();
    bindFilters();
    installPanelHook();
    global.ulimStudentMasterLoad7342 = load;
    global.ulimStudentMasterSave7342 = save;
    global.ulimStudentMasterPage7342 = goPage;
    global.addEventListener('ulim-firebase-token-invalid', function () { setStatus('Firebase 로그인 세션이 만료되어 학생정보 조회를 중단했습니다. 다시 로그인해주세요.', 'error'); });
    try { console.info('[ULIM 7.34.2] safe student directory management installed'); } catch (_ignore) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof window !== 'undefined' ? window : globalThis);
