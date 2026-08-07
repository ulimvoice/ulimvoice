(function (global) {
  'use strict';
  if (global.__ULIM_FIRESTORE_PRIMARY_OPERATIONAL_7355014__) return;
  global.__ULIM_FIRESTORE_PRIMARY_OPERATIONAL_7355014__ = true;
  global.__ULIM_FIRESTORE_PRIMARY_OPERATIONAL_7355011__ = true;
  global.__ULIM_FIRESTORE_PRIMARY_OPERATIONAL_73550__ = true;

  const VERSION = '2026-08-07.735.05.0.14-nonattendance-operational-clean';
  const MODAL_ID = 'ulimOperationalModal73550';
  const LOADING_ID = 'ulimTopLoading73550';
  const COURSE_PANEL_ID = 'adminPanelCourseApplications73550';
  const NOTES_CARD_ID = 'ulimStaffPrivateNotesCard73550';
  const NOTES_PANEL_ID = 'adminPanelStaffNotes73550';
  let staffRows = [];
  let studentCourseModuleInstalled = false;
  let loadingDepth = 0;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/[\s\-–—_()[\]{}~～·:]/g, ''); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function unique(values) { return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))); }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function isFullAdmin() {
    const info = global.adminInfo || {};
    const role = normalize(info.firebaseRole || info.role);
    return role === 'admin' || role === 'superadmin' || role === normalize('전체관리자') || role === normalize('전체관리') || role === normalize('원장');
  }
  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('기능을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions || !rt.db) throw new Error('로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'firestore-primary-73550');
    else await rt.sdk.getIdToken(rt.auth.currentUser, false);
    return rt;
  }
  async function call(name, payload) {
    const rt = await runtime();
    const fn = rt.sdk.httpsCallable(rt.functions, name);
    const response = await fn(payload || {});
    return response && response.data || {};
  }
  function seoulDateString(date) {
    const value = date instanceof Date ? date : new Date();
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
  }
  function seoulMonthString(date) { return seoulDateString(date).slice(0, 7); }
  function currentDate() {
    return text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value) || seoulDateString();
  }
  function currentClassName() {
    return text(document.getElementById('adminAttendanceClass') && document.getElementById('adminAttendanceClass').value);
  }
  function selectedAttendanceRows() {
    const rows = [];
    document.querySelectorAll('#adminAttendanceTableWrap tr[data-att-index]').forEach(function (tr) {
      const checkbox = tr.querySelector('.admin-att-check');
      if (!checkbox || !checkbox.checked) return;
      const index = Number(tr.getAttribute('data-att-index'));
      const record = (typeof adminAttendanceRecords !== 'undefined' && adminAttendanceRecords[index]) || null;
      if (record) rows.push(record);
    });
    return rows;
  }
  function installStyles() {
    if (document.getElementById('ulimFirestorePrimaryStyle73550')) return;
    const style = document.createElement('style');
    style.id = 'ulimFirestorePrimaryStyle73550';
    style.textContent = `
      #${LOADING_ID}{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.48);display:none;align-items:flex-start;justify-content:center;padding-top:32px;box-sizing:border-box}
      #${LOADING_ID}.active{display:flex}#${LOADING_ID}>div{max-width:min(620px,92vw);padding:14px 20px;border-radius:14px;background:#fff;color:#0f172a;font-weight:900;box-shadow:0 18px 70px rgba(0,0,0,.35);border:2px solid #22c55e;text-align:center}
      #${MODAL_ID}{position:fixed;inset:0;z-index:2147483645;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
      #${MODAL_ID} .ulim-modal-card{width:min(920px,96vw);max-height:92vh;background:#fff;border-radius:18px;box-shadow:0 24px 90px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden}
      #${MODAL_ID} .ulim-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 18px;background:#0f172a;color:#fff}#${MODAL_ID} .ulim-modal-head h3{margin:0;font-size:18px}
      #${MODAL_ID} .ulim-modal-close{border:0;border-radius:9px;background:#fff;color:#111827;padding:8px 12px;font-weight:900;cursor:pointer}
      #${MODAL_ID} .ulim-modal-body{padding:16px;overflow:auto}#${MODAL_ID} .ulim-modal-foot{padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
      .ulim-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ulim-modal-field label{display:block;font-size:12px;font-weight:900;color:#475569;margin-bottom:5px}.ulim-modal-field input,.ulim-modal-field select,.ulim-modal-field textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}.ulim-modal-field.wide{grid-column:1/-1}
      .ulim-candidate-list{display:grid;gap:6px;max-height:54vh;overflow:auto}.ulim-candidate-row{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:9px;border:1px solid #e2e8f0;border-radius:10px}.ulim-candidate-row small{color:#64748b}
      .ulim-student-detail{display:grid;grid-template-columns:150px 1fr;gap:8px;font-size:13px}.ulim-student-detail dt{font-weight:900;color:#475569}.ulim-student-detail dd{margin:0;word-break:break-all}
      .ulim-whole-class-card{border:1px solid #cbd5e1;border-radius:14px;overflow:hidden;margin-bottom:12px}.ulim-whole-class-title{padding:10px 12px;background:#1e3a8a;color:#fff;font-weight:900}.ulim-whole-class-body{padding:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:7px}.ulim-whole-student{padding:8px;border:1px solid #e2e8f0;border-radius:9px;background:#fff}
      #${NOTES_CARD_ID}{margin-top:14px}.ulim-staff-note-layout{display:grid;grid-template-columns:minmax(220px,320px) 1fr;gap:12px}.ulim-staff-note-list{max-height:460px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px}.ulim-staff-note-item{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #e2e8f0;padding:10px;background:#fff;cursor:pointer}.ulim-staff-note-item.active{background:#e0f2fe}.ulim-staff-note-editor textarea{width:100%;min-height:300px;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:10px}
      #${COURSE_PANEL_ID} .ulim-course-table{width:100%;border-collapse:collapse;min-width:1000px}#${COURSE_PANEL_ID} .ulim-course-table th,#${COURSE_PANEL_ID} .ulim-course-table td{padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;vertical-align:top}#${COURSE_PANEL_ID} .ulim-course-table th{background:#f8fafc;position:sticky;top:0}
      .ulim-firestore-only-badge{display:inline-block;padding:3px 7px;border-radius:999px;background:#dcfce7;color:#166534;font-size:10px;font-weight:900}
      @media(max-width:700px){.ulim-modal-grid{grid-template-columns:1fr}.ulim-staff-note-layout{grid-template-columns:1fr}.ulim-student-detail{grid-template-columns:110px 1fr}}
    `;
    document.head.appendChild(style);
  }
  function ensureLoading() {
    let overlay = document.getElementById(LOADING_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = LOADING_ID;
      overlay.innerHTML = '<div id="ulimTopLoadingText73550">처리 중...</div>';
      document.body.appendChild(overlay);
    }
    return overlay;
  }
  function topLoading(message) {
    loadingDepth += 1;
    const overlay = ensureLoading();
    const label = document.getElementById('ulimTopLoadingText73550');
    if (label) label.textContent = message || '처리 중...';
    overlay.classList.add('active');
  }
  function topLoadingDone(force) {
    loadingDepth = force === true ? 0 : Math.max(0, loadingDepth - 1);
    const overlay = document.getElementById(LOADING_ID);
    if (overlay && loadingDepth === 0) overlay.classList.remove('active');
  }
  function replaceGlobalLoading() {
    global.showLoading = topLoading;
    global.hideLoading = topLoadingDone;
    try { showLoading = topLoading; hideLoading = topLoadingDone; } catch (_ignore) {}
  }
  function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.remove();
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }
  function openModal(title, bodyHtml, footerHtml, options) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.innerHTML = '<section class="ulim-modal-card" role="dialog" aria-modal="true">' +
      '<header class="ulim-modal-head"><h3>' + escapeHtml(title) + '</h3><button type="button" class="ulim-modal-close" data-ulim-close="1">닫기</button></header>' +
      '<div class="ulim-modal-body">' + bodyHtml + '</div>' +
      (footerHtml ? '<footer class="ulim-modal-foot">' + footerHtml + '</footer>' : '') + '</section>';
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay || event.target.closest('[data-ulim-close="1"]')) closeModal();
    });
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (options && typeof options.afterOpen === 'function') options.afterOpen(overlay);
    return overlay;
  }
  function installModalCloseGuard() {
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeModal(); });
    global.ulimCloseOperationalModal73550 = closeModal;
  }

  function removeLegacyPanels() {
    ['ulimDataAuthorityCard7354143','adminPanelDataAuthority7354143','adminPanelDataAuthority','ulimStableBuildMissing735410'].forEach(function (id) {
      const el = document.getElementById(id); if (el) el.remove();
    });
    document.querySelectorAll('.admin-subtab').forEach(function (button) {
      const label = text(button.textContent);
      if (/원본\s*전환|6단계\s*정리|데이터\s*원본/.test(label)) button.remove();
    });
  }
  function replaceLoginMessages(root) {
    const target = root || document.body;
    if (!target) return;
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (/firebase\s*로그인\s*중/i.test(node.nodeValue || '')) node.nodeValue = String(node.nodeValue || '').replace(/firebase\s*로그인\s*중\.?\.?\.?/ig, '로그인 중...');
    });
  }
  function installTextObserver() {
    replaceLoginMessages(document.body);
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) { if (node.nodeType === 1 || node.nodeType === 3) replaceLoginMessages(node.nodeType === 1 ? node : node.parentNode); });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // 출석부는 attendance-admin-integrated-7.35.4.15가 단독 소유합니다.
  // 이 모듈에는 과거 출석부 렌더러/툴바/자동갱신 코드를 두지 않습니다.

  async function loadStaffRows() {
    if (!isFullAdmin()) return [];
    try {
      const data = await call('listStaffPrivateNotesAdmin73550', {});
      staffRows = Array.isArray(data.staff) ? data.staff : [];
      return staffRows;
    } catch (_ignore) { return []; }
  }
  function installStaffNotes() {
    if (document.getElementById(NOTES_CARD_ID) || !isFullAdmin()) return;
    const subtabs = document.querySelector('#adminDashboard .admin-subtabs');
    const dashboard = document.getElementById('adminDashboard');
    if (!subtabs || !dashboard) return;
    let panel = document.getElementById(NOTES_PANEL_ID);
    if (!panel) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'admin-subtab admin-full-only'; button.dataset.adminPanel = NOTES_PANEL_ID; button.textContent = '교직원 메모';
      button.onclick = function () { if (typeof global.showAdminPanel === 'function') global.showAdminPanel(NOTES_PANEL_ID); };
      subtabs.appendChild(button);
      panel = document.createElement('div'); panel.id = NOTES_PANEL_ID; panel.className = 'admin-panel'; dashboard.appendChild(panel);
    }
    const card = document.createElement('div');
    card.className = 'admin-card';
    card.id = NOTES_CARD_ID;
    card.innerHTML = '<h3 style="margin-top:0">교직원 메모</h3><p style="font-size:12px;color:#64748b">관리자 전용 메모입니다. 운영 원본은 Firestore이며 시트에는 매일 오전 6시에 백업됩니다.</p><div class="ulim-staff-note-layout"><div><input id="ulimStaffNoteSearch73550" placeholder="교직원 검색" style="width:100%;box-sizing:border-box;padding:9px;border:1px solid #cbd5e1;border-radius:9px;margin-bottom:8px"><div class="ulim-staff-note-list" id="ulimStaffNoteList73550"></div></div><div class="ulim-staff-note-editor"><div id="ulimStaffNoteSelected73550" style="font-weight:900;margin-bottom:8px">교직원을 선택하세요.</div><textarea id="ulimStaffNoteText73550" disabled></textarea><div style="display:flex;justify-content:flex-end;margin-top:8px"><button type="button" class="admin-btn blue" id="ulimStaffNoteSave73550" disabled>메모 저장</button></div></div></div>';
    panel.appendChild(card);
    let selectedUid = '';
    function renderList(keyword) {
      const key = normalize(keyword);
      const list = document.getElementById('ulimStaffNoteList73550');
      list.innerHTML = staffRows.filter(function (row) { return !key || normalize([row.name,row.role].join(' ')).includes(key); }).map(function (row) { return '<button type="button" class="ulim-staff-note-item' + (text(row.firebaseUid) === selectedUid ? ' active' : '') + '" data-uid="' + escapeHtml(row.firebaseUid) + '"><b>' + escapeHtml(row.name) + '</b><br><small>' + escapeHtml(row.role) + (row.memo ? ' · 메모 있음' : '') + '</small></button>'; }).join('');
      list.querySelectorAll('[data-uid]').forEach(function (button) { button.addEventListener('click', function () { selectedUid = text(button.getAttribute('data-uid')); const row = staffRows.find(function (item) { return text(item.firebaseUid) === selectedUid; }) || {}; document.getElementById('ulimStaffNoteSelected73550').textContent = text(row.name) || selectedUid; const textarea = document.getElementById('ulimStaffNoteText73550'); textarea.disabled = false; textarea.value = text(row.memo); document.getElementById('ulimStaffNoteSave73550').disabled = false; renderList(document.getElementById('ulimStaffNoteSearch73550').value); }); });
    }
    document.getElementById('ulimStaffNoteSearch73550').addEventListener('input', function (event) { renderList(event.target.value); });
    document.getElementById('ulimStaffNoteSave73550').addEventListener('click', async function () {
      if (!selectedUid) return;
      topLoading('교직원 메모 저장 중...');
      try { await call('saveStaffPrivateNoteAdmin73550', { firebaseUid: selectedUid, memo: document.getElementById('ulimStaffNoteText73550').value }); const row = staffRows.find(function (item) { return text(item.firebaseUid) === selectedUid; }); if (row) row.memo = document.getElementById('ulimStaffNoteText73550').value; alert('메모가 저장되었습니다.'); renderList(document.getElementById('ulimStaffNoteSearch73550').value); }
      catch (error) { alert(text(error && error.message) || '메모 저장에 실패했습니다.'); }
      finally { topLoadingDone(); }
    });
    loadStaffRows().then(function () { renderList(''); });
  }

  function installCourseApplicationAdmin() {
    if (!isFullAdmin() || document.getElementById(COURSE_PANEL_ID)) return;
    const subtabs = document.querySelector('#adminDashboard .admin-subtabs');
    const dashboard = document.getElementById('adminDashboard');
    if (!subtabs || !dashboard) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'admin-subtab admin-full-only'; button.dataset.adminPanel = COURSE_PANEL_ID; button.textContent = '수강신청 관리';
    button.onclick = function () { if (typeof global.showAdminPanel === 'function') global.showAdminPanel(COURSE_PANEL_ID); loadCourseApplications(); };
    subtabs.appendChild(button);
    const panel = document.createElement('div'); panel.id = COURSE_PANEL_ID; panel.className = 'admin-panel';
    panel.innerHTML = '<div class="admin-card"><h3 style="margin-top:0">수강신청 관리 <span class="ulim-firestore-only-badge">Firestore</span></h3><div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap"><div class="admin-field"><label>신청월</label><input type="month" id="ulimCourseMonth73550"></div><button type="button" class="admin-btn blue" id="ulimCourseLoad73550">신청내역 조회</button><button type="button" class="admin-btn green" id="ulimCourseApprove73550">선택 승인</button><button type="button" class="admin-btn red" id="ulimCourseReject73550">선택 반려</button></div><div id="ulimCourseTable73550" style="overflow:auto;margin-top:12px"></div></div>';
    dashboard.appendChild(panel);
    const month = document.getElementById('ulimCourseMonth73550'); month.value = seoulMonthString();
    document.getElementById('ulimCourseLoad73550').onclick = loadCourseApplications;
    document.getElementById('ulimCourseApprove73550').onclick = function () { decideCourseApplications('approved'); };
    document.getElementById('ulimCourseReject73550').onclick = function () { decideCourseApplications('rejected'); };
  }
  async function loadCourseApplications() {
    const wrap = document.getElementById('ulimCourseTable73550'); if (!wrap) return;
    topLoading('수강신청 조회 중...');
    try {
      const data = await call('listCourseApplicationsAdmin73550', { month: text(document.getElementById('ulimCourseMonth73550').value) });
      const rows = Array.isArray(data.applications) ? data.applications : [];
      wrap.innerHTML = '<table class="ulim-course-table"><thead><tr><th><input type="checkbox" id="ulimCourseAll73550"></th><th>학생</th><th>신청구분</th><th>신청반</th><th>상태</th><th>신청일</th></tr></thead><tbody>' + rows.map(function (row) { return '<tr><td><input type="checkbox" class="ulim-course-check" value="' + escapeHtml(row.applicationId) + '"></td><td><b>' + escapeHtml(row.studentName) + '</b><br><small>' + escapeHtml(row.attendanceNo) + '</small></td><td>' + escapeHtml(row.registrationDecision || row.decision || row.type) + '</td><td>' + escapeHtml((row.requestedClassNames || row.classNames || row.requestedClassIds || []).join ? (row.requestedClassNames || row.classNames || row.requestedClassIds || []).join(', ') : text(row.requestedClassName)) + '</td><td>' + escapeHtml(row.state) + '</td><td>' + escapeHtml(row.submittedAtMs ? new Date(Number(row.submittedAtMs)).toLocaleString('ko-KR') : '') + '</td></tr>'; }).join('') + '</tbody></table>';
      const all = document.getElementById('ulimCourseAll73550'); if (all) all.onchange = function () { wrap.querySelectorAll('.ulim-course-check').forEach(function (checkbox) { checkbox.checked = all.checked; }); };
    } catch (error) { wrap.innerHTML = '<div class="notice-empty">' + escapeHtml(text(error && error.message) || '조회 실패') + '</div>'; }
    finally { topLoadingDone(); }
  }
  async function decideCourseApplications(state) {
    const ids = Array.from(document.querySelectorAll('.ulim-course-check:checked')).map(function (checkbox) { return checkbox.value; });
    if (!ids.length) return alert('처리할 신청을 선택해주세요.');
    if (!confirm(ids.length + '건을 ' + (state === 'approved' ? '승인' : '반려') + '할까요?')) return;
    topLoading('수강신청 처리 중...');
    try { await call('decideCourseApplicationsAdmin73550', { decisions: ids.map(function (applicationId) { return { applicationId: applicationId, state: state }; }) }); await loadCourseApplications(); }
    catch (error) { alert(text(error && error.message) || '수강신청 처리에 실패했습니다.'); }
    finally { topLoadingDone(); }
  }

  function installShowPanelHook() {
    const original = global.showAdminPanel;
    if (typeof original !== 'function' || original.__ulim73550Wrapped) return;
    const wrapped = function (panelId) {
      const result = original.apply(this, arguments);
      // 출석부 UI와 갱신은 attendance-admin-integrated-7.35.4.15가 단독 소유합니다.
      // 이 모듈에서는 출석부를 다시 불러오거나 덮어쓰지 않습니다.
      if (panelId === 'adminPanelStaffAccounts' || panelId === NOTES_PANEL_ID) setTimeout(installStaffNotes, 20);
      return result;
    };
    wrapped.__ulim73550Wrapped = true;
    global.showAdminPanel = wrapped;
    try { showAdminPanel = wrapped; } catch (_ignore) {}
  }
  function recipientTargetValues(kind) {
    try {
      if (typeof global.adminGetRecipientTypes === 'function') return global.adminGetRecipientTypes(kind).map(function (value) { return value === '학부모' ? 'parent' : value === '학생' ? 'student' : value; });
    } catch (_ignore) {}
    return ['student', 'parent'];
  }
  function recipientsFromRows(rows, targets, variableFactory) {
    const recipients = [];
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      const variables = typeof variableFactory === 'function' ? (variableFactory(row) || {}) : {};
      (targets || []).forEach(function (target) {
        let phone = '';
        if (target === 'parent') phone = text(row.parentPhone || row.guardianPhone);
        else if (target === 'student') phone = text(row.studentPhone || row.phone);
        else if (target === 'teacher') phone = text(row.instructorPhone || row.teacherPhone);
        else if (target === 'admin') phone = text(row.adminPhone);
        if (!phone) return;
        recipients.push({ phone: phone, studentUid: text(row.studentUid), target: target, variables: Object.assign({ studentName: text(row.studentName || row.name) }, variables) });
      });
    });
    return recipients;
  }
  async function sendDirect(type, recipients, variables, label) {
    if (!recipients.length) throw new Error('발송 가능한 전화번호가 없습니다.');
    topLoading((label || '알림톡') + ' 발송 중...');
    try {
      const data = await call('sendOperationalAlimtalkAdmin73550', { type: type, recipients: recipients, variables: variables || {}, requestId: requestId('operational-message-73550') });
      alert(data.message || (label || '알림톡') + ' 발송 요청이 완료되었습니다.');
      return data;
    } finally { topLoadingDone(); }
  }

  function installOperationalDataOverrides() {
    global.adminLoadStudents = async function (showOverlay) {
      if (!isFullAdmin()) return null;
      if (showOverlay !== false) topLoading('학생 목록 불러오는 중...');
      try {
        const data = await call('listStudentManagementAdmin7352', { requestId: requestId('admin-student-list-73550') });
        const rows = (Array.isArray(data.students) ? data.students : []).map(function (student) {
          return {
            studentUid: text(student.studentUid), name: text(student.name || student.studentName), studentName: text(student.name || student.studentName),
            studentNo: text(student.attendanceNo || student.studentNo || student.loginId), attendanceNo: text(student.attendanceNo || student.studentNo || student.loginId),
            studentPhone: text(student.studentPhone || student.phone), parentPhone: text(student.parentPhone),
            enrollmentStatus: text(student.enrollmentStatus) || 'active', studentStatus: text(student.enrollmentStatus) || 'active',
            status: text(student.enrollmentStatus) || 'active', classIds: Array.isArray(student.selectedClassIds) ? student.selectedClassIds : [],
            classNames: Array.isArray(student.classNames) ? student.classNames : [], className: text((student.classNames || [])[0]),
            instructorNames: Array.isArray(student.instructorNames) ? student.instructorNames : [], instructor: text((student.instructorNames || [])[0]),
            memo: text(student.memo), birthDate: text(student.birthDate)
          };
        });
        try { adminStudents = rows; adminStudentsLoaded = true; } catch (_ignore) { global.adminStudents = rows; global.adminStudentsLoaded = true; }
        try { if (typeof adminRenderStudentDatalist === 'function') adminRenderStudentDatalist(); } catch (_ignore) {}
        try { if (typeof adminRenderStudentTable === 'function') adminRenderStudentTable(); } catch (_ignore) {}
        try { if (typeof adminInitNoticeSelectors === 'function') adminInitNoticeSelectors(); } catch (_ignore) {}
        return { status: 'success', students: rows, count: rows.length, source: 'firestore' };
      } catch (error) { alert(text(error && error.message) || '학생 목록을 불러오지 못했습니다.'); return null; }
      finally { if (showOverlay !== false) topLoadingDone(); }
    };
    global.adminLoadRoomReservations = async function (showOverlay) {
      if (!isFullAdmin()) return alert('연습실 예약 알림은 관리자 권한에서만 가능합니다.');
      let date = currentDate();
      try { if (typeof adminRoomDateValue === 'function') date = adminRoomDateValue(); } catch (_ignore) {}
      if (showOverlay !== false) topLoading('연습실 예약 명단 불러오는 중...');
      try {
        const data = await call('listRoomReservationsAdmin73550', { date: date });
        let rows = Array.isArray(data.reservations) ? data.reservations : [];
        try { rows = rows.map(function (row, index) { return typeof normalizeAdminRoomReservationRow === 'function' ? normalizeAdminRoomReservationRow(row, index) : row; }); } catch (_ignore) {}
        try { adminRoomReservations = rows; adminRoomSelectedMap = {}; rows.forEach(function (row, index) { adminRoomSelectedMap[typeof adminRoomRowKey === 'function' ? adminRoomRowKey(row,index) : index] = false; }); }
        catch (_ignore) { global.adminRoomReservations = rows; }
        try { if (typeof adminRenderRoomReservationTable === 'function') adminRenderRoomReservationTable(); } catch (_ignore) {}
        const summary = document.getElementById('adminRoomSummary'); if (summary) summary.textContent = '예약 ' + rows.length + '건 / 기준 ' + date;
        return data;
      } catch (error) { alert(text(error && error.message) || '연습실 예약 명단을 불러오지 못했습니다.'); return null; }
      finally { if (showOverlay !== false) topLoadingDone(); }
    };
    global.adminSavePayment = async function () {
      if (!isFullAdmin()) return alert('결제관리는 관리자 권한에서만 가능합니다.');
      const studentName = text(document.getElementById('paymentStudentInput') && document.getElementById('paymentStudentInput').value);
      let rows = []; try { rows = Array.isArray(adminStudents) ? adminStudents : []; } catch (_ignore) { rows = global.adminStudents || []; }
      const matches = rows.filter(function (row) { return text(row.name || row.studentName) === studentName; });
      if (matches.length !== 1) return alert('학생명단에서 학생을 정확히 선택해주세요.');
      const student = matches[0];
      const payload = {
        studentUid: text(student.studentUid), studentName: studentName,
        month: text(document.getElementById('paymentMonthInput') && document.getElementById('paymentMonthInput').value),
        amount: text(document.getElementById('paymentAmountInput') && document.getElementById('paymentAmountInput').value),
        method: text(document.getElementById('paymentMethodInput') && document.getElementById('paymentMethodInput').value),
        date: text(document.getElementById('paymentDateInput') && document.getElementById('paymentDateInput').value),
        memo: text(document.getElementById('paymentMemoInput') && document.getElementById('paymentMemoInput').value),
        sendNotification: !!(document.getElementById('paymentSendSmsCheck') && document.getElementById('paymentSendSmsCheck').checked),
        targets: ['student','parent']
      };
      if (!payload.month || !payload.amount) return alert('수강월과 결제금액을 입력해주세요.');
      topLoading(payload.sendNotification ? '결제 등록 및 알림톡 발송 중...' : '결제 등록 중...');
      try { const data = await call('savePaymentAdmin73550', payload); alert(data.message || '결제 등록이 완료되었습니다.'); return data; }
      catch (error) { alert(text(error && error.message) || '결제 등록에 실패했습니다.'); }
      finally { topLoadingDone(); }
    };
    try { adminLoadStudents = global.adminLoadStudents; adminLoadRoomReservations = global.adminLoadRoomReservations; adminSavePayment = global.adminSavePayment; } catch (_ignore) {}
  }

  function installMessageOverrides() {
    global.adminSendAttendanceMessages = async function () {
      if (!isFullAdmin()) return alert('발송은 관리자 권한에서만 가능합니다.');
      let rows = [];
      try { if (typeof global.adminGetSelectedAttendanceRecords === 'function') rows = global.adminGetSelectedAttendanceRecords(); } catch (_ignore) {}
      if (!rows.length) rows = selectedAttendanceRows();
      if (!rows.length) return alert('선택된 출석 데이터가 없습니다.');
      const targets = recipientTargetValues('attendance').filter(function (value) { return value === 'student' || value === 'parent'; });
      if (!targets.length) return alert('수신 대상을 선택해주세요.');
      if (!confirm('선택한 ' + rows.length + '명의 출결 알림톡을 발송할까요?')) return;
      const recipients = recipientsFromRows(rows, targets, function (row) {
        return { date: text(row.date || row.sessionDate || currentDate()), className: text(row.className || currentClassName()), status: text(row.status || row.attendanceStatus), instructorName: text(row.instructorName || row.instructor), roomName: text(row.roomName || row.classroom) };
      });
      try { await sendDirect('attendance', recipients, {}, '출결 알림톡'); } catch (error) { alert(text(error && error.message) || '발송에 실패했습니다.'); }
    };
    global.adminSendNoticeMessages = async function () {
      if (!isFullAdmin()) return alert('공지 발송은 관리자 권한에서만 가능합니다.');
      const message = text(document.getElementById('noticeMessageText') && document.getElementById('noticeMessageText').value);
      let rows = [];
      try { if (typeof global.adminGetCheckedNoticeTargets === 'function') rows = global.adminGetCheckedNoticeTargets(); } catch (_ignore) {}
      if (!message) return alert('공지 문구를 입력해주세요.');
      if (!rows.length) return alert('체크된 발송 대상 학생이 없습니다.');
      const targets = recipientTargetValues('notice').filter(function (value) { return value === 'student' || value === 'parent' || value === 'teacher' || value === 'admin'; });
      const recipients = recipientsFromRows(rows, targets, function (row) {
        let personalized = message;
        try { if (typeof global.buildNoticeMessage === 'function') personalized = global.buildNoticeMessage(message, row); } catch (_ignore) {}
        return { messageText: personalized, className: text(row.className || row.currentClass), instructorName: text(row.instructor || row.instructorName) };
      });
      if (!confirm('공지 ' + rows.length + '명에게 알림톡을 발송할까요?')) return;
      try { await sendDirect('notice', recipients, {}, '공지 알림톡'); } catch (error) { alert(text(error && error.message) || '발송에 실패했습니다.'); }
    };
    global.adminSendAbsenceForNoticeTargets = async function () {
      if (!isFullAdmin()) return alert('결석 알림톡 발송은 관리자 권한에서만 가능합니다.');
      let rows = [];
      try { if (typeof global.adminGetCheckedNoticeTargets === 'function') rows = global.adminGetCheckedNoticeTargets(); } catch (_ignore) {}
      if (!rows.length) return alert('체크된 학생이 없습니다.');
      const date = prompt('결석 수업일을 입력해주세요.', currentDate()); if (date === null || !text(date)) return;
      const className = prompt('결석 반명을 입력해주세요.', currentClassName()); if (className === null || !text(className)) return;
      const targets = recipientTargetValues('notice').filter(function (value) { return value === 'student' || value === 'parent'; });
      const recipients = recipientsFromRows(rows, targets, function (row) { return { date: text(date), className: text(className), status: '결석', instructorName: text(row.instructor || row.instructorName) }; });
      if (!confirm('선택한 ' + rows.length + '명에게 결석 알림톡을 발송할까요?')) return;
      try { await sendDirect('absence', recipients, {}, '결석 알림톡'); } catch (error) { alert(text(error && error.message) || '발송에 실패했습니다.'); }
    };
    global.adminSendAbsenceForStudent = async function (index) {
      if (!isFullAdmin()) return alert('결석 알림톡 발송은 관리자 권한에서만 가능합니다.');
      const rows = Array.isArray(global.adminStudentSearchRows) ? global.adminStudentSearchRows : [];
      const row = rows[Number(index)]; if (!row) return alert('학생 정보를 찾지 못했습니다.');
      const date = prompt('결석 수업일을 입력해주세요.', currentDate()); if (date === null || !text(date)) return;
      const className = prompt('결석 반명을 입력해주세요.', text(row.className || row.currentClass)); if (className === null || !text(className)) return;
      const recipients = recipientsFromRows([row], ['student','parent'], function () { return { date: text(date), className: text(className), status: '결석', instructorName: text(row.instructor || row.instructorName) }; });
      try { await sendDirect('absence', recipients, {}, '결석 알림톡'); } catch (error) { alert(text(error && error.message) || '발송에 실패했습니다.'); }
    };
    global.adminSendRoomReservationMessage = async function (index, actionType, option, silent) {
      if (!isFullAdmin()) throw new Error('연습실 예약 알림은 관리자 권한에서만 가능합니다.');
      const rows = Array.isArray(global.adminRoomReservations) ? global.adminRoomReservations : [];
      const row = rows[Number(index)]; if (!row) throw new Error('예약 정보를 찾지 못했습니다.');
      const opt = option || {};
      const roomType = actionType === 'change' ? 'room_change' : (actionType === 'unavailable' ? 'room_unavailable' : 'room_confirm');
      const recipients = recipientsFromRows([row], recipientTargetValues('room').filter(function (value) { return value === 'student' || value === 'parent'; }), function () {
        const studentName = text(row.studentName || row.name);
        const date = text(row.date);
        const roomName = text(row.room || row.roomName);
        const time = text(row.time || row.reservationTime);
        const doorPassword = text(opt.doorPassword);
        const newDate = text(opt.newDate);
        const newRoom = text(opt.newRoom);
        const newTime = text(opt.newTime);
        const reason = text(opt.reason);
        return {
          studentName: studentName, date: date, roomName: roomName, time: time, actionType: text(actionType),
          newDate: newDate, newRoom: newRoom, newTime: newTime, reason: reason, doorPassword: doorPassword,
          '학생명': studentName, '예약일': date, '예약시간': time, '연습실': roomName,
          '변경일': newDate, '변경시간': newTime, '변경연습실': newRoom,
          '사용불가사유': reason, '현관비밀번호': doorPassword
        };
      });
      try { return await sendDirect(roomType, recipients, {}, '연습실 알림톡'); }
      catch (error) { if (!silent) alert(text(error && error.message) || '발송에 실패했습니다.'); throw error; }
    };
    global.adminLoadDailyEvalTemplate = async function () {
      try {
        const data = await call('getDailyEvaluationTemplateAdmin73550', {});
        global.adminDailyEvalTemplateText = text(data.template) || global.adminDailyEvalTemplateText || '';
        global.adminDailyEvalTemplateLoaded = true;
        const el = document.getElementById('adminDailyEvalTemplate'); if (el) el.value = global.adminDailyEvalTemplateText;
        return data;
      } catch (error) { const el = document.getElementById('adminDailyEvalTemplate'); if (el && !el.value) el.value = global.adminDailyEvalTemplateText || ''; throw error; }
    };
    global.adminSaveDailyEvalTemplate = async function () {
      if (!isFullAdmin()) return alert('기본 문구 수정은 관리자 권한에서만 가능합니다.');
      const template = text(document.getElementById('adminDailyEvalTemplate') && document.getElementById('adminDailyEvalTemplate').value);
      if (!template) return alert('저장할 기본 문구를 입력해주세요.');
      topLoading('일일평가 기본문구 저장 중...');
      try { const data = await call('saveDailyEvaluationTemplateAdmin73550', { template: template }); global.adminDailyEvalTemplateText = template; global.adminDailyEvalTemplateLoaded = true; alert(data.message || '기본 문구를 저장했습니다.'); return data; }
      catch (error) { alert(text(error && error.message) || '기본 문구 저장에 실패했습니다.'); }
      finally { topLoadingDone(); }
    };
    try {
      adminSendAttendanceMessages = global.adminSendAttendanceMessages;
      adminSendNoticeMessages = global.adminSendNoticeMessages;
      adminSendAbsenceForNoticeTargets = global.adminSendAbsenceForNoticeTargets;
      adminSendAbsenceForStudent = global.adminSendAbsenceForStudent;
      adminSendRoomReservationMessage = global.adminSendRoomReservationMessage;
      adminLoadDailyEvalTemplate = global.adminLoadDailyEvalTemplate;
      adminSaveDailyEvalTemplate = global.adminSaveDailyEvalTemplate;
    } catch (_ignore) {}
  }

  function installGasOperationalGuard() {
    const blocked = new Set(['adminGetStudents','adminGetStudentsByClass','adminGetClassList','adminGetAttendanceSnapshot','adminSaveAttendance','adminGetDailyEvaluations','adminSaveDailyEvaluations','tabletCheck','tabletGetDailySnapshot','adminSendAttendanceMessages','adminSendSelectedAttendanceMessages','adminSendAbsenceMessage','adminSendNoticeMessages','adminSendRoomReservationMessage']);
    const originalFetch = global.fetch;
    if (typeof originalFetch !== 'function' || originalFetch.__ulim73550Guard) return;
    const guarded = function (input, init) {
      try {
        const url = new URL(typeof input === 'string' ? input : input.url, global.location.href);
        if (/script\.google\.com\/macros\/s\//.test(url.href)) {
          let action = url.searchParams.get('action') || '';
          if (!action && init && init.body) {
            try { action = text(JSON.parse(String(init.body)).action); } catch (_ignore) {}
          }
          if (blocked.has(action)) return Promise.reject(new Error('이 운영 기능은 Firestore에서만 처리합니다.'));
        }
      } catch (_ignore) {}
      return originalFetch.apply(this, arguments);
    };
    guarded.__ulim73550Guard = true;
    global.fetch = guarded;
  }

  function markAttendanceSingleOwner7355014() {
    global.__ULIM_ATTENDANCE_AUTO_REFRESH_DISABLED_7355014__ = true;
    global.__ULIM_ATTENDANCE_SINGLE_OWNER_7355014__ = 'attendance-admin-integrated-7.35.4.15';
  }

  async function install() {
    installStyles(); ensureLoading(); replaceGlobalLoading(); installModalCloseGuard(); markAttendanceSingleOwner7355014(); removeLegacyPanels(); installTextObserver(); installGasOperationalGuard();
    // 7.35.5.0.11: 출석부는 전용 통합 모듈만 소유합니다.
    // 자동 revision 구독/3초 polling/자동 reload를 시작하지 않습니다.
    installOperationalDataOverrides(); installMessageOverrides(); installShowPanelHook(); installStaffNotes();
    global.__ULIM_ATTENDANCE_AUTO_REFRESH_DISABLED_7355014__ = true;
    global.__ULIM_LOADED_BUILD_73550__ = VERSION;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof window !== 'undefined' ? window : globalThis);
