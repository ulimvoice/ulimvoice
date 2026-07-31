(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_MASTER_ADMIN_7343__) return;
  global.__ULIM_STUDENT_MASTER_ADMIN_7343__ = true;

  const VERSION = '2026-08-01.734.03';
  const PANEL_ID = 'adminPanelStudentMaster7343';
  const CARD_ID = 'ulimStudentMasterCard7343';
  const STATUS_ID = 'ulimStudentMasterStatus7343';
  const TABLE_ID = 'ulimStudentMasterTable7343';
  const SUMMARY_ID = 'ulimStudentMasterSummary7343';
  const FILTER_ID = 'ulimStudentMasterFilter7343';
  const STATUS_FILTER_ID = 'ulimStudentMasterStatusFilter7343';

  let installed = false;
  let targetPanelId = PANEL_ID;
  let students = [];
  let filtered = [];
  let loadingPromise = null;
  const rowKeyMap = new Map();
  const dirtyKeys = new Set();

  function text(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function splitList(value) {
    return Array.from(new Set(String(value == null ? '' : value).split(/[\n,;/|]+/g).map(text).filter(Boolean)));
  }
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
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions || !rt.db) throw new Error('Firebase 교직원 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'student-master-admin-7343');
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
    if (document.getElementById('ulimStudentMasterStyle7343')) return;
    const style = document.createElement('style');
    style.id = 'ulimStudentMasterStyle7343';
    style.textContent = `
      #${CARD_ID}{margin-bottom:14px}
      #${CARD_ID} .ulim-student-toolbar{display:grid;grid-template-columns:minmax(240px,1fr) 150px auto;gap:8px;align-items:end}
      #${CARD_ID} .ulim-student-toolbar-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      #${CARD_ID} .ulim-student-table-wrap{max-height:68vh;overflow:auto;border:1px solid #e5e7eb;border-radius:12px;background:#fff}
      #${CARD_ID} .ulim-student-table{width:100%;border-collapse:separate;border-spacing:0;min-width:1540px}
      #${CARD_ID} .ulim-student-table th,#${CARD_ID} .ulim-student-table td{border-bottom:1px solid #e5e7eb;padding:6px;vertical-align:middle;font-size:12px;background:inherit}
      #${CARD_ID} .ulim-student-table th{background:#f8fafc;text-align:left;position:sticky;top:0;z-index:3;box-shadow:0 1px 0 #e5e7eb}
      #${CARD_ID} input,#${CARD_ID} select{width:100%;box-sizing:border-box;padding:7px;border:1px solid #d1d5db;border-radius:8px;background:#fff;min-width:85px}
      #${CARD_ID} input[data-list-field]{min-width:165px}
      #${CARD_ID} .ulim-student-uid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:#64748b;white-space:nowrap}
      #${CARD_ID} .ulim-student-help{font-size:12px;color:#64748b;line-height:1.65}
      #${CARD_ID} .ulim-student-row-actions{display:flex;gap:5px;align-items:center}
      #${CARD_ID} tr[data-status="leave"]{background:#fffbeb}
      #${CARD_ID} tr[data-status="withdrawn"]{background:#f8fafc;opacity:.76}
      #${CARD_ID} tr.ulim-dirty-row{background:#fff7ed;opacity:1}
      #${CARD_ID} tr.ulim-saving-row{opacity:.55}
      #${STATUS_ID}{display:none;margin:10px 0;padding:10px 12px;border-radius:9px;font-size:13px;white-space:pre-wrap}
      #${STATUS_ID}[data-state="ok"]{display:block;background:#ecfdf5;color:#166534}
      #${STATUS_ID}[data-state="warn"]{display:block;background:#fffbeb;color:#92400e}
      #${STATUS_ID}[data-state="error"]{display:block;background:#fff7ed;color:#9a3412}
      #${STATUS_ID}[data-state="loading"]{display:block;background:#eff6ff;color:#1d4ed8}
      .ulim-student-sync{display:inline-block;padding:3px 7px;border-radius:999px;font-size:11px;font-weight:700;background:#f1f5f9;color:#475569;white-space:nowrap}
      .ulim-student-sync.ok{background:#dcfce7;color:#166534}.ulim-student-sync.fs{background:#e0f2fe;color:#075985}.ulim-student-sync.fail{background:#fee2e2;color:#991b1b}
      @media(max-width:900px){#${CARD_ID} .ulim-student-toolbar{grid-template-columns:1fr}#${CARD_ID} .ulim-student-toolbar-actions{justify-content:flex-start}}
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
          <b>목록 새로고침</b>을 누르면 Google Sheets 학생명단을 기준으로 UID가 확정된 학생을 Firestore에 갱신합니다.
          아래 목록은 전체 학생을 한 번에 표시하며, UID를 제외한 항목을 표에서 바로 수정할 수 있습니다.
          <b>변경사항 전체 저장</b>은 수정된 행만 Firestore와 학생명단 시트에 함께 반영합니다.
        </div>
        <div id="${STATUS_ID}"></div>
        <div class="ulim-student-toolbar">
          <div class="admin-field"><label>검색(선택)</label><input id="${FILTER_ID}" placeholder="전체 목록이 기본 표시됩니다. 학생명 · 출결번호 · 전화 · 반 · 강사 검색"></div>
          <div class="admin-field"><label>재원상태</label><select id="${STATUS_FILTER_ID}"><option value="">전체</option><option value="active">재원</option><option value="leave">휴원</option><option value="withdrawn">퇴원</option></select></div>
          <div class="ulim-student-toolbar-actions">
            <button type="button" class="admin-btn blue" onclick="ulimStudentMasterLoad7343(true)">목록 새로고침</button>
            <button type="button" class="admin-btn" onclick="ulimStudentMasterLoad7343(false)">Firestore만 다시조회</button>
            <button type="button" class="admin-btn orange" id="ulimStudentMasterSaveAll7343" onclick="ulimStudentMasterSaveAll7343()">변경사항 전체 저장</button>
          </div>
        </div>
        <div id="${SUMMARY_ID}" style="font-size:12px;color:#64748b;margin:10px 0;"></div>
        <div class="ulim-student-table-wrap"><div id="${TABLE_ID}"></div></div>
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
        else global.ulimStudentMasterLoad7343(false);
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
      loginId: text(student.loginId || student.studentNo),
      name: text(student.name || student.studentName),
      phone: text(student.phone || student.studentPhone),
      parentPhone: text(student.parentPhone),
      status: statusValue(student.status || student.enrollmentStatus),
      classNames: Array.isArray(student.classNames) ? student.classNames.map(text).filter(Boolean) : splitList(student.className),
      instructorNames: Array.isArray(student.instructorNames) ? student.instructorNames.map(text).filter(Boolean) : splitList(student.instructorName),
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
      return normalize([student.name,student.loginId,student.phone,student.parentPhone,student.classNames.join(' '),student.instructorNames.join(' '),student.memo].join(' ')).indexOf(keyword) >= 0;
    });
    render();
  }
  function rowData(key) {
    return {
      studentUid: rowKeyMap.get(key) || '',
      loginId: text(document.getElementById(key + '_login')?.value),
      name: text(document.getElementById(key + '_name')?.value),
      phone: text(document.getElementById(key + '_phone')?.value),
      parentPhone: text(document.getElementById(key + '_parent')?.value),
      status: text(document.getElementById(key + '_status')?.value) || 'active',
      classNames: splitList(document.getElementById(key + '_classes')?.value),
      instructorNames: splitList(document.getElementById(key + '_instructors')?.value),
      memo: text(document.getElementById(key + '_memo')?.value)
    };
  }
  function updateSummary() {
    const summary = document.getElementById(SUMMARY_ID);
    if (!summary) return;
    const active = filtered.filter(function (s) { return s.status === 'active'; }).length;
    const leave = filtered.filter(function (s) { return s.status === 'leave'; }).length;
    const withdrawn = filtered.filter(function (s) { return s.status === 'withdrawn'; }).length;
    summary.textContent = '표시 ' + filtered.length + '명 / 전체 ' + students.length + '명 · 재원 ' + active + ' · 휴원 ' + leave + ' · 퇴원 ' + withdrawn + ' · 수정 대기 ' + dirtyKeys.size + '명';
    const saveAll = document.getElementById('ulimStudentMasterSaveAll7343');
    if (saveAll) saveAll.textContent = dirtyKeys.size ? '변경사항 전체 저장 (' + dirtyKeys.size + ')' : '변경사항 전체 저장';
  }
  function render() {
    const wrap = document.getElementById(TABLE_ID);
    if (!wrap) return;
    rowKeyMap.clear();
    if (!filtered.length) {
      wrap.innerHTML = '<div style="padding:18px;color:#64748b;">조건에 맞는 학생이 없습니다.</div>';
      updateSummary();
      return;
    }
    const rows = filtered.map(function (student) {
      const key = safeKey(student.studentUid);
      const dirty = dirtyKeys.has(key) ? ' ulim-dirty-row' : '';
      return `<tr class="${dirty}" data-row-key="${key}" data-status="${escapeHtml(student.status)}">
        <td><select id="${key}_status" data-row-key="${key}"><option value="active"${student.status === 'active' ? ' selected' : ''}>재원</option><option value="leave"${student.status === 'leave' ? ' selected' : ''}>휴원</option><option value="withdrawn"${student.status === 'withdrawn' ? ' selected' : ''}>퇴원</option></select></td>
        <td><input id="${key}_login" data-row-key="${key}" value="${escapeHtml(student.loginId)}"></td>
        <td><input id="${key}_name" data-row-key="${key}" value="${escapeHtml(student.name)}"><div class="ulim-student-uid">UID ${escapeHtml(maskedUid(student.studentUid))}</div></td>
        <td><input id="${key}_phone" data-row-key="${key}" value="${escapeHtml(student.phone)}"></td>
        <td><input id="${key}_parent" data-row-key="${key}" value="${escapeHtml(student.parentPhone)}"></td>
        <td><input id="${key}_classes" data-row-key="${key}" data-list-field="true" value="${escapeHtml(student.classNames.join(', '))}"></td>
        <td><input id="${key}_instructors" data-row-key="${key}" data-list-field="true" value="${escapeHtml(student.instructorNames.join(', '))}"></td>
        <td><input id="${key}_memo" data-row-key="${key}" value="${escapeHtml(student.memo)}"></td>
        <td>${syncLabel(student)}<div style="font-size:10px;color:#64748b;max-width:150px;word-break:break-all;">${escapeHtml(student.sheetSyncMessage)}</div></td>
        <td><div class="ulim-student-row-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentMasterSaveRow7343('${key}')">저장</button></div></td>
      </tr>`;
    }).join('');
    wrap.innerHTML = `<table class="ulim-student-table"><thead><tr><th>재원상태</th><th>출결번호</th><th>학생명/UID</th><th>학생전화</th><th>보호자전화</th><th>현재반</th><th>담당강사</th><th>메모</th><th>동기화</th><th>관리</th></tr></thead><tbody>${rows}</tbody></table>`;
    updateSummary();
  }
  async function listFirestoreDirect() {
    const rt = await runtime();
    const ref = rt.sdk.collection(rt.db, 'students');
    const snap = await rt.sdk.getDocs(rt.sdk.query(ref, rt.sdk.limit(3000)));
    students = snap.docs.map(function (doc) { return source(Object.assign({ studentUid: doc.id }, doc.data() || {})); });
    students.sort(function (left, right) {
      const order = { active: 0, leave: 1, withdrawn: 2 };
      const diff = (order[left.status] ?? 9) - (order[right.status] ?? 9);
      return diff || text(left.name).localeCompare(text(right.name), 'ko');
    });
    filtered = students.slice();
    dirtyKeys.clear();
    render();
    return { source: 'firestore-direct', count: students.length };
  }
  async function listFirestore() {
    try {
      const data = await call('listStudentsAdmin7342', { limit: 3000 });
      students = (Array.isArray(data.students) ? data.students : []).map(source);
      filtered = students.slice();
      dirtyKeys.clear();
      render();
      return Object.assign({ source: 'callable' }, data || {});
    } catch (error) {
      const fallback = await listFirestoreDirect();
      fallback.callableError = text(error && error.message || error);
      return fallback;
    }
  }
  async function load(importFromSheet) {
    if (!isSuperAdmin()) { setStatus('학생정보 관리는 전체관리자만 사용할 수 있습니다.', 'error'); return false; }
    if (loadingPromise) return loadingPromise;
    if (dirtyKeys.size && !confirm('저장하지 않은 학생 수정사항이 ' + dirtyKeys.size + '명 있습니다. 목록을 다시 불러오면 사라집니다. 계속할까요?')) return false;
    loadingPromise = (async function () {
      let syncResult = null;
      let syncError = null;
      if (importFromSheet === true) {
        if (!confirm('Google Sheets 학생명단을 기준으로 전체 학생 목록을 새로고침할까요?\n학생인증 UID가 확정된 학생만 Firestore에 연결하며 비밀번호는 변경하지 않습니다.')) return false;
        setStatus('학생명단 시트에서 전체 학생 목록을 새로고침하는 중...', 'loading');
        try { syncResult = await call('syncStudentsFromSheetsAdmin7342', { requestId: requestId('student-directory') }); }
        catch (error) { syncError = error; }
      }
      setStatus('전체 학생 목록을 불러오는 중...', 'loading');
      const listResult = await listFirestore();
      if (syncResult) {
        const message = '학생목록 새로고침 완료: 신규 ' + Number(syncResult.created || 0) + '명 · 갱신 ' + Number(syncResult.updated || 0) + '명 · 유지 ' + Number(syncResult.preserved || 0) + '명 · UID 없음 제외 ' + Number(syncResult.unresolved || 0) + '명' + (Number(syncResult.failed || 0) ? ' · 실패 ' + Number(syncResult.failed || 0) + '명' : '');
        setStatus(message, Number(syncResult.failed || 0) ? 'warn' : 'ok');
      } else if (syncError) {
        setStatus('시트 새로고침은 실패했지만 현재 Firestore 목록 ' + students.length + '명을 표시했습니다. ' + text(syncError.message || syncError), 'warn');
      } else {
        setStatus(listResult && listResult.source === 'firestore-direct' ? '전체 학생 ' + students.length + '명을 표시했습니다. 서버 목록 함수 대신 Firestore 직접 조회를 사용했습니다.' : '전체 학생 ' + students.length + '명을 표시했습니다.', listResult && listResult.source === 'firestore-direct' ? 'warn' : 'ok');
      }
      return true;
    })().catch(function (error) {
      setStatus(text(error && error.message) || '학생목록 조회에 실패했습니다.', 'error');
      return false;
    }).finally(function () { loadingPromise = null; });
    return loadingPromise;
  }
  function markDirty(key) {
    if (!rowKeyMap.has(key)) return;
    const draft = rowData(key);
    const target = students.find(function (item) { return item.studentUid === draft.studentUid; });
    if (target) Object.assign(target, draft);
    dirtyKeys.add(key);
    const row = document.querySelector('tr[data-row-key="' + key + '"]');
    if (row) {
      row.classList.add('ulim-dirty-row');
      const status = document.getElementById(key + '_status');
      if (status) row.dataset.status = text(status.value);
    }
    updateSummary();
  }
  async function saveEdits(edits) {
    if (!edits.length) return { ok: true, results: [] };
    try {
      return await call('updateStudentsMetadataBatchAdmin7343', {
        edits: edits,
        syncSheet: true,
        requestId: requestId('student-metadata-batch')
      });
    } catch (batchError) {
      if (edits.length > 20) throw batchError;
      const results = [];
      for (const edit of edits) {
        try {
          const result = await call('updateStudentMetadataAdmin7342', Object.assign({}, edit, { syncSheet: true, requestId: requestId('student-metadata') }));
          results.push({ studentUid: edit.studentUid, ok: result.sheetSyncState !== 'failed', sheetSyncState: result.sheetSyncState, sheetSyncMessage: result.sheetSyncMessage });
        } catch (error) {
          results.push({ studentUid: edit.studentUid, ok: false, sheetSyncState: 'failed', sheetSyncMessage: text(error && error.message || error) });
        }
      }
      return { ok: results.every(function (item) { return item.ok; }), results: results, fallback: true };
    }
  }
  async function saveKeys(keys) {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const uniqueKeys = Array.from(new Set(keys)).filter(function (key) { return rowKeyMap.has(key); });
    const edits = uniqueKeys.map(rowData);
    if (!edits.length) return alert('수정된 학생정보가 없습니다.');
    for (const edit of edits) {
      if (!edit.studentUid || !edit.loginId || !edit.name) return alert('출결번호와 학생명은 비워둘 수 없습니다.');
    }
    if (!confirm('수정된 학생 ' + edits.length + '명의 정보를 Firestore와 Google Sheets에 저장할까요?')) return;
    uniqueKeys.forEach(function (key) { document.querySelector('tr[data-row-key="' + key + '"]')?.classList.add('ulim-saving-row'); });
    try {
      showLoading('학생정보 ' + edits.length + '명 저장 중...');
      const result = await saveEdits(edits);
      const rows = Array.isArray(result.results) ? result.results : [];
      const failed = rows.filter(function (item) { return item.ok !== true; });
      const succeededUids = new Set(rows.filter(function (item) { return item.ok === true; }).map(function (item) { return text(item.studentUid); }));
      uniqueKeys.forEach(function (key) {
        const uid = rowKeyMap.get(key) || '';
        if (!rows.length || succeededUids.has(uid)) dirtyKeys.delete(key);
      });
      await listFirestore();
      if (failed.length) {
        setStatus('학생정보 ' + (edits.length - failed.length) + '명 저장 완료 · ' + failed.length + '명은 시트 반영을 확인해야 합니다.\n' + failed.slice(0, 5).map(function (item) { return text(item.name || item.studentUid) + ': ' + text(item.sheetSyncMessage || item.message); }).join('\n'), 'warn');
      } else {
        setStatus('학생정보 ' + edits.length + '명을 Firestore와 Google Sheets에 저장했습니다.', 'ok');
      }
    } catch (error) {
      setStatus(text(error && error.message) || '학생정보 저장에 실패했습니다.', 'error');
      alert(text(error && error.message) || '학생정보 저장에 실패했습니다.');
    } finally {
      uniqueKeys.forEach(function (key) { document.querySelector('tr[data-row-key="' + key + '"]')?.classList.remove('ulim-saving-row'); });
      hideLoading();
      updateSummary();
    }
  }
  async function saveRow(key) { return saveKeys([key]); }
  async function saveAll() { return saveKeys(Array.from(dirtyKeys)); }
  function installPanelHook() {
    const original = global.showAdminPanel;
    if (typeof original === 'function' && !original.__ulimStudent7343Wrapped) {
      const wrapped = function (panelId) {
        const result = original.apply(this, arguments);
        if (panelId === targetPanelId) setTimeout(function () { if (!students.length) load(false); }, 0);
        return result;
      };
      wrapped.__ulimStudent7343Wrapped = true;
      global.showAdminPanel = wrapped;
      try { showAdminPanel = wrapped; } catch (_ignore) {}
    }
  }
  function bindUi() {
    const filter = document.getElementById(FILTER_ID);
    const statusFilter = document.getElementById(STATUS_FILTER_ID);
    const table = document.getElementById(TABLE_ID);
    if (filter && !filter.dataset.ulim7343Bound) { filter.dataset.ulim7343Bound = '1'; filter.addEventListener('input', applyFilter); }
    if (statusFilter && !statusFilter.dataset.ulim7343Bound) { statusFilter.dataset.ulim7343Bound = '1'; statusFilter.addEventListener('change', applyFilter); }
    if (table && !table.dataset.ulim7343Bound) {
      table.dataset.ulim7343Bound = '1';
      table.addEventListener('input', function (event) { const key = event.target && event.target.dataset && event.target.dataset.rowKey; if (key) markDirty(key); });
      table.addEventListener('change', function (event) { const key = event.target && event.target.dataset && event.target.dataset.rowKey; if (key) markDirty(key); });
    }
  }
  function install() {
    if (installed) return;
    installed = true;
    injectStyles();
    injectPanel();
    bindUi();
    installPanelHook();
    global.ulimStudentMasterLoad7343 = load;
    global.ulimStudentMasterSaveRow7343 = saveRow;
    global.ulimStudentMasterSaveAll7343 = saveAll;
    global.ulimStudentMasterLoad7342 = load;
    global.ulimStudentMasterSave7342 = function (key) { return saveRow(key); };
    global.addEventListener('ulim-firebase-token-invalid', function () { setStatus('Firebase 로그인 세션이 만료되어 학생정보 조회를 중단했습니다. 다시 로그인해주세요.', 'error'); });
    try { console.info('[ULIM 7.34.3] full editable student directory installed'); } catch (_ignore) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof window !== 'undefined' ? window : globalThis);
