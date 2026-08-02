(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_MASTER_ADMIN_7344__) return;
  global.__ULIM_STUDENT_MASTER_ADMIN_7344__ = true;

  const VERSION = '2026-08-02.734.04.0';
  const PANEL_ID = 'adminPanelStudentMaster7344';
  const CARD_ID = 'ulimStudentMasterCard7344';
  const CREATE_ID = 'ulimStudentCreate7344';
  const STATUS_ID = 'ulimStudentMasterStatus7344';
  const TABLE_ID = 'ulimStudentMasterTable7344';
  const SUMMARY_ID = 'ulimStudentMasterSummary7344';
  const FILTER_ID = 'ulimStudentMasterFilter7344';
  const STATUS_FILTER_ID = 'ulimStudentMasterStatusFilter7344';

  let installed = false;
  let targetPanelId = PANEL_ID;
  let students = [];
  let filtered = [];
  let loadingPromise = null;
  let classLoadingPromise = null;
  let operatingClasses = [];
  let hiddenIncompleteCount = 0;
  let sheetOnlyCount = 0;
  let sheetMergeError = '';
  const rowKeyMap = new Map();
  const dirtyKeys = new Set();

  function text(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function splitList(value) { return Array.from(new Set(String(value == null ? '' : value).split(/[\n,;/|]+/g).map(text).filter(Boolean))); }
  function unique(values) { return Array.from(new Set((Array.isArray(values) ? values : splitList(values)).map(text).filter(Boolean))); }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function safeKey(uid) { const key = 's_' + String(uid || '').replace(/[^0-9A-Za-z_-]/g, '_'); rowKeyMap.set(key, uid); return key; }
  function maskedUid(uid) { const value = text(uid); return value ? '•••' + value.slice(-6) : ''; }
  function isSuperAdmin() {
    const info = global.adminInfo || {};
    const role = normalize(info.firebaseRole || info.role);
    return role === 'superadmin' || role === normalize('전체관리자') || role === normalize('전체관리') || role === normalize('원장');
  }
  function roomRealtime() { return global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null; }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('Firebase 모듈을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions || !rt.db) throw new Error('Firebase 교직원 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'student-master-admin-7344');
    else await rt.sdk.getIdToken(rt.auth.currentUser, false);
    return rt;
  }
  async function call(name, payload) { const rt = await runtime(); const fn = rt.sdk.httpsCallable(rt.functions, name); const response = await fn(payload || {}); return response && response.data || {}; }
  function showLoading(message) { try { if (typeof global.showLoading === 'function') global.showLoading(message || '처리 중...'); } catch (_ignore) {} }
  function hideLoading() { try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {} }
  function setStatus(message, state) { const el = document.getElementById(STATUS_ID); if (!el) return; el.textContent = message || ''; el.dataset.state = state || ''; el.style.display = message ? 'block' : 'none'; }
  function statusValue(value) { const key = normalize(value); if (key === 'leave' || key === normalize('휴원')) return 'leave'; if (key === 'withdrawn' || key === normalize('퇴원')) return 'withdrawn'; return 'active'; }
  function syncLabel(student) {
    const state = text(student.sheetSyncState);
    if (student.firestorePersisted === false) return '<span class="ulim-student-sync wait">시트만</span>';
    if (state === 'complete') return '<span class="ulim-student-sync ok">시트완료</span>';
    if (state === 'pending' || state === 'retry') return '<span class="ulim-student-sync wait">기록대기</span>';
    if (state === 'sheet-merged') return '<span class="ulim-student-sync wait">시트보완</span>';
    if (state === 'firestore-only') return '<span class="ulim-student-sync fs">Firestore</span>';
    if (state === 'failed') return '<span class="ulim-student-sync fail">확인필요</span>';
    return '<span class="ulim-student-sync">미확인</span>';
  }
  function extractTeacher(className, explicitTeacher) {
    const direct = text(explicitTeacher);
    if (direct) return direct.replace(/T$/i, '').trim();
    const match = text(className).match(/\[([^\]]+?)T?\]/);
    return match && match[1] ? text(match[1]).replace(/T$/i, '').trim() : '';
  }
  function addClassToMap(map, className, teacher, source) {
    const name = text(className);
    if (!name || name === '전체반' || name === '-' || name === '없음') return;
    const key = normalize(name);
    if (!key) return;
    const nextTeacher = extractTeacher(name, teacher);
    const current = map.get(key);
    if (!current) map.set(key, { className: name, teacher: nextTeacher, source: source || '' });
    else if (!current.teacher && nextTeacher) current.teacher = nextTeacher;
  }
  function dateText(offset) { const d = new Date(); d.setDate(d.getDate() + offset); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); }
  async function loadOperatingClasses(force) {
    if (classLoadingPromise && !force) return classLoadingPromise;
    classLoadingPromise = (async function () {
      const map = new Map();
      try { const fixed = typeof ADMIN_NOTICE_FIXED_CLASS_LIST !== 'undefined' ? ADMIN_NOTICE_FIXED_CLASS_LIST : global.ADMIN_NOTICE_FIXED_CLASS_LIST; (Array.isArray(fixed) ? fixed : []).forEach(name => addClassToMap(map, name, '', 'fixed')); } catch (_ignore) {}
      try { const loaded = typeof adminClassList !== 'undefined' ? adminClassList : global.adminClassList; (Array.isArray(loaded) ? loaded : []).forEach(item => addClassToMap(map, item && item.className, item && item.teacher, 'loaded')); } catch (_ignore) {}
      try {
        if (typeof global.adminBuildNoticeClassList === 'function') {
          (global.adminBuildNoticeClassList() || []).forEach(item => addClassToMap(map, item && item.className, item && item.teacher, 'catalog'));
        }
      } catch (_ignore) {}
      if (typeof global.adminApi === 'function') {
        const token = text(global.adminToken || (typeof adminToken !== 'undefined' ? adminToken : ''));
        if (token) {
          const dates = Array.from({ length: 7 }, function (_, index) { return dateText(index); });
          const results = await Promise.allSettled(dates.map(function (date) {
            return global.adminApi('adminGetClassList', { adminToken: token, date: date, force: force ? '1' : '', exactDateVersion: '704' });
          }));
          results.forEach(function (result) {
            if (result.status !== 'fulfilled') return;
            const list = result.value && Array.isArray(result.value.classes) ? result.value.classes : [];
            list.forEach(function (item) { addClassToMap(map, item && item.className, item && item.teacher, 'weekly'); });
          });
        }
      }
      operatingClasses = Array.from(map.values()).sort(function (a, b) { return a.className.localeCompare(b.className, 'ko'); });
      renderCreateClasses();
      if (students.length) render();
      return operatingClasses;
    })().finally(function () { classLoadingPromise = null; });
    return classLoadingPromise;
  }
  function classOptions(selected) {
    const selectedValues = unique(selected);
    const map = new Map();
    operatingClasses.forEach(function (item) { map.set(normalize(item.className), item); });
    selectedValues.forEach(function (name) { if (!map.has(normalize(name))) map.set(normalize(name), { className: name, teacher: '', source: 'saved' }); });
    return Array.from(map.values()).sort(function (a, b) { return a.className.localeCompare(b.className, 'ko'); });
  }
  function selectedValues(select) { return select ? Array.from(select.selectedOptions || []).map(function (option) { return text(option.value); }).filter(Boolean) : []; }
  function deriveInstructors(classNames, fallback) {
    const byClass = new Map(operatingClasses.map(function (item) { return [normalize(item.className), text(item.teacher)]; }));
    const mapped = unique(classNames.map(function (name) { return byClass.get(normalize(name)) || extractTeacher(name, ''); }).filter(Boolean));
    return mapped.length ? mapped : unique(fallback);
  }
  function classSelectHtml(id, rowKey, selected) {
    const chosen = new Set(unique(selected));
    const options = classOptions(selected).map(function (item) {
      const label = item.teacher ? item.className + ' / ' + item.teacher : item.className;
      return '<option value="' + escapeHtml(item.className) + '"' + (chosen.has(item.className) ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    }).join('');
    return '<select id="' + id + '" data-row-key="' + escapeHtml(rowKey || '') + '" data-class-select="true" multiple size="3">' + options + '</select>';
  }
  function injectStyles() {
    if (document.getElementById('ulimStudentMasterStyle7344')) return;
    const style = document.createElement('style');
    style.id = 'ulimStudentMasterStyle7344';
    style.textContent = `
      #${CARD_ID}{margin-bottom:14px}#${CARD_ID} .ulim-student-create{margin:14px 0;padding:14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:12px}
      #${CARD_ID} .ulim-create-grid{display:grid;grid-template-columns:repeat(4,minmax(145px,1fr));gap:10px}#${CARD_ID} .ulim-create-wide{grid-column:span 2}
      #${CARD_ID} .ulim-create-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:10px;flex-wrap:wrap}
      #${CARD_ID} .ulim-password-preview{font-size:12px;color:#1d4ed8;font-weight:700}#${CARD_ID} .ulim-student-toolbar{display:grid;grid-template-columns:minmax(240px,1fr) 150px auto;gap:8px;align-items:end}
      #${CARD_ID} .ulim-student-toolbar-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}#${CARD_ID} .ulim-student-table-wrap{max-height:68vh;overflow:auto;border:1px solid #e5e7eb;border-radius:12px;background:#fff}
      #${CARD_ID} .ulim-student-table{width:100%;border-collapse:separate;border-spacing:0;min-width:1780px}#${CARD_ID} .ulim-student-table th,#${CARD_ID} .ulim-student-table td{border-bottom:1px solid #e5e7eb;padding:6px;vertical-align:middle;font-size:12px;background:inherit}
      #${CARD_ID} .ulim-student-table th{background:#f8fafc;text-align:left;position:sticky;top:0;z-index:3;box-shadow:0 1px 0 #e5e7eb}#${CARD_ID} input,#${CARD_ID} select,#${CARD_ID} textarea{width:100%;box-sizing:border-box;padding:7px;border:1px solid #d1d5db;border-radius:8px;background:#fff;min-width:85px}
      #${CARD_ID} select[multiple]{min-width:220px;padding:4px}#${CARD_ID} input[readonly]{background:#f8fafc;color:#475569}#${CARD_ID} .ulim-student-uid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:#64748b;white-space:nowrap}
      #${CARD_ID} .ulim-student-help{font-size:12px;color:#64748b;line-height:1.65}#${CARD_ID} .ulim-student-row-actions{display:flex;gap:5px;align-items:center;flex-wrap:wrap}#${CARD_ID} tr[data-status="leave"]{background:#fffbeb}
      #${CARD_ID} tr[data-status="withdrawn"]{background:#f8fafc;opacity:.76}#${CARD_ID} tr.ulim-dirty-row{background:#fff7ed;opacity:1}#${CARD_ID} tr.ulim-saving-row{opacity:.55}
      #${STATUS_ID}{display:none;margin:10px 0;padding:10px 12px;border-radius:9px;font-size:13px;white-space:pre-wrap}#${STATUS_ID}[data-state="ok"]{display:block;background:#ecfdf5;color:#166534}#${STATUS_ID}[data-state="warn"]{display:block;background:#fffbeb;color:#92400e}
      #${STATUS_ID}[data-state="error"]{display:block;background:#fff7ed;color:#9a3412}#${STATUS_ID}[data-state="loading"]{display:block;background:#eff6ff;color:#1d4ed8}.ulim-student-sync{display:inline-block;padding:3px 7px;border-radius:999px;font-size:11px;font-weight:700;background:#f1f5f9;color:#475569;white-space:nowrap}
      .ulim-student-sync.ok{background:#dcfce7;color:#166534}.ulim-student-sync.fs{background:#e0f2fe;color:#075985}.ulim-student-sync.wait{background:#fef3c7;color:#92400e}.ulim-student-sync.fail{background:#fee2e2;color:#991b1b}
      @media(max-width:1100px){#${CARD_ID} .ulim-create-grid{grid-template-columns:repeat(2,minmax(145px,1fr))}}@media(max-width:900px){#${CARD_ID} .ulim-student-toolbar{grid-template-columns:1fr}#${CARD_ID} .ulim-student-toolbar-actions{justify-content:flex-start}}
      @media(max-width:620px){#${CARD_ID} .ulim-create-grid{grid-template-columns:1fr}#${CARD_ID} .ulim-create-wide{grid-column:span 1}}
    `;
    document.head.appendChild(style);
  }
  function findExistingPanel() { const ids = ['adminPanelStudents','adminPanelStudentList','adminPanelStudentRoster','adminPanelStudent','adminPanelRoster']; for (const id of ids) { const panel = document.getElementById(id); if (panel) return panel; } return null; }
  function cardHtml() {
    return `<div id="${CARD_ID}" class="admin-card admin-full-only"><h3 style="margin-top:0;">학생정보 관리</h3>
      <div class="ulim-student-help">신규 학생은 서버가 임의 UID를 생성해 Firestore에 먼저 저장합니다. 초기 비밀번호는 학생 전화번호 뒤 4자리이며, Google Sheets 학생명단과 학생인증 기록은 백그라운드에서 안전하게 처리됩니다. 현재반은 운영 중인 수업반에서 여러 개 선택할 수 있고 담당강사는 선택한 반에 따라 자동 연결됩니다.</div>
      <div id="${STATUS_ID}"></div>
      <details id="${CREATE_ID}" class="ulim-student-create" open><summary style="cursor:pointer;font-weight:800;color:#1e3a8a;">신규 학생 추가</summary>
        <div class="ulim-create-grid" style="margin-top:12px;">
          <div class="admin-field"><label>출결번호 *</label><input id="ulimNewStudentLogin7344" autocomplete="off"></div>
          <div class="admin-field"><label>학생명 *</label><input id="ulimNewStudentName7344" autocomplete="off"></div>
          <div class="admin-field"><label>생년월일</label><input id="ulimNewStudentBirth7344" type="date"></div>
          <div class="admin-field"><label>재원상태</label><select id="ulimNewStudentStatus7344"><option value="active">재원</option><option value="leave">휴원</option><option value="withdrawn">퇴원</option></select></div>
          <div class="admin-field"><label>학생 전화번호 *</label><input id="ulimNewStudentPhone7344" inputmode="tel" autocomplete="off"></div>
          <div class="admin-field"><label>보호자 전화번호</label><input id="ulimNewStudentParent7344" inputmode="tel" autocomplete="off"></div>
          <div class="admin-field ulim-create-wide"><label>현재 수강반 * (복수선택)</label><select id="ulimNewStudentClasses7344" multiple size="5"></select></div>
          <div class="admin-field ulim-create-wide"><label>자동 연결 담당강사</label><input id="ulimNewStudentInstructors7344" readonly placeholder="수강반을 선택하면 자동 표시됩니다."></div>
          <div class="admin-field ulim-create-wide"><label>메모</label><input id="ulimNewStudentMemo7344"></div>
        </div>
        <div class="ulim-create-actions"><span id="ulimNewStudentPassword7344" class="ulim-password-preview">초기 비밀번호: 학생 전화번호 뒤 4자리</span><button type="button" class="admin-btn" onclick="ulimStudentMasterReloadClasses7344()">수업반 다시 불러오기</button><button type="button" class="admin-btn blue" onclick="ulimStudentMasterCreate7344()">학생 추가</button></div>
      </details>
      <div class="ulim-student-toolbar"><div class="admin-field"><label>검색(선택)</label><input id="${FILTER_ID}" placeholder="전체 목록이 기본 표시됩니다. 학생명 · 출결번호 · 전화 · 반 · 강사 검색"></div>
        <div class="admin-field"><label>재원상태</label><select id="${STATUS_FILTER_ID}"><option value="">전체</option><option value="active">재원</option><option value="leave">휴원</option><option value="withdrawn">퇴원</option></select></div>
        <div class="ulim-student-toolbar-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentMasterLoad7344(true)">목록 새로고침</button><button type="button" class="admin-btn" onclick="ulimStudentMasterLoad7344(false)">Firestore만 다시조회</button><button type="button" class="admin-btn orange" id="ulimStudentMasterSaveAll7344" onclick="ulimStudentMasterSaveAll7344()">변경사항 전체 저장</button></div></div>
      <div id="${SUMMARY_ID}" style="font-size:12px;color:#64748b;margin:10px 0;"></div><div class="ulim-student-table-wrap"><div id="${TABLE_ID}"></div></div></div>`;
  }
  function injectPanel() {
    const existing = findExistingPanel();
    if (existing) { targetPanelId = existing.id; if (!document.getElementById(CARD_ID)) existing.insertAdjacentHTML('afterbegin', cardHtml()); return; }
    const subtabs = document.querySelector('#adminDashboard .admin-subtabs');
    if (subtabs && !document.querySelector('[data-admin-panel="' + PANEL_ID + '"]')) { const button = document.createElement('button'); button.type = 'button'; button.className = 'admin-subtab admin-full-only'; button.dataset.adminPanel = PANEL_ID; button.textContent = '학생정보 관리'; button.onclick = function () { if (typeof global.showAdminPanel === 'function') global.showAdminPanel(PANEL_ID); else global.ulimStudentMasterLoad7344(false); }; subtabs.appendChild(button); }
    const dashboard = document.getElementById('adminDashboard'); if (!dashboard || document.getElementById(PANEL_ID)) return; const panel = document.createElement('div'); panel.id = PANEL_ID; panel.className = 'admin-panel'; panel.innerHTML = cardHtml(); dashboard.appendChild(panel);
  }
  function source(raw) {
    const student = raw || {}; const sheet = student.sheetSnapshot && typeof student.sheetSnapshot === 'object' ? student.sheetSnapshot : {}; const local = student.localOverrides && typeof student.localOverrides === 'object' ? student.localOverrides : {};
    function pick(keys) { for (const key of keys) if (Object.prototype.hasOwnProperty.call(local, key)) return local[key]; for (const key of keys) { const value = sheet[key]; if (Array.isArray(value) ? value.length : text(value)) return value; } for (const key of keys) { const value = student[key]; if (Array.isArray(value) ? value.length : text(value)) return value; } return ''; }
    const loginId = text(pick(['loginId','studentNo'])); const name = text(pick(['name','studentName'])); const classValue = pick(['classNames','className','currentClass']); const instructorValue = pick(['instructorNames','instructorName','instructor']);
    return { studentUid: text(student.studentUid), loginId: loginId, name: name, phone: text(pick(['phone','studentPhone'])), parentPhone: text(pick(['parentPhone'])), birthDate: text(pick(['birthDate','dateOfBirth'])), status: statusValue(pick(['status','enrollmentStatus'])), classNames: Array.isArray(classValue) ? classValue.map(text).filter(Boolean) : splitList(classValue), instructorNames: Array.isArray(instructorValue) ? instructorValue.map(text).filter(Boolean) : splitList(instructorValue), memo: text(pick(['memo'])), sheetSyncState: text(student.sheetSyncState), sheetSyncMessage: text(student.sheetSyncMessage), unresolved: student.unresolved === true, incomplete: student.incomplete === true || (!loginId && !name), firestorePersisted: student.firestorePersisted !== false, mergedFromSheet: student.mergedFromSheet === true };
  }
  function applyFilter() { const keyword = normalize(document.getElementById(FILTER_ID)?.value); const wantedStatus = text(document.getElementById(STATUS_FILTER_ID)?.value); filtered = students.filter(function (student) { if (wantedStatus && student.status !== wantedStatus) return false; if (!keyword) return true; return normalize([student.name,student.loginId,student.phone,student.parentPhone,student.birthDate,student.classNames.join(' '),student.instructorNames.join(' '),student.memo].join(' ')).indexOf(keyword) >= 0; }); render(); }
  function rowData(key) { const classes = selectedValues(document.getElementById(key + '_classes')); const existing = students.find(function (student) { return student.studentUid === (rowKeyMap.get(key) || ''); }); return { studentUid: rowKeyMap.get(key) || '', loginId: text(document.getElementById(key + '_login')?.value), name: text(document.getElementById(key + '_name')?.value), phone: text(document.getElementById(key + '_phone')?.value), parentPhone: text(document.getElementById(key + '_parent')?.value), birthDate: text(document.getElementById(key + '_birth')?.value), status: text(document.getElementById(key + '_status')?.value) || 'active', classNames: classes, instructorNames: deriveInstructors(classes, existing && existing.instructorNames || []), memo: text(document.getElementById(key + '_memo')?.value) }; }
  function updateSummary() { const summary = document.getElementById(SUMMARY_ID); if (!summary) return; const active = filtered.filter(function (s) { return s.status === 'active'; }).length; const leave = filtered.filter(function (s) { return s.status === 'leave'; }).length; const withdrawn = filtered.filter(function (s) { return s.status === 'withdrawn'; }).length; summary.textContent = '표시 ' + filtered.length + '명 / 전체 ' + students.length + '명 · 재원 ' + active + ' · 휴원 ' + leave + ' · 퇴원 ' + withdrawn + ' · 시트만 ' + sheetOnlyCount + '명 · UID 전용 숨김 ' + hiddenIncompleteCount + '명 · 운영반 ' + operatingClasses.length + '개 · 수정 대기 ' + dirtyKeys.size + '명'; const saveAll = document.getElementById('ulimStudentMasterSaveAll7344'); if (saveAll) saveAll.textContent = dirtyKeys.size ? '변경사항 전체 저장 (' + dirtyKeys.size + ')' : '변경사항 전체 저장'; }
  function render() {
    const wrap = document.getElementById(TABLE_ID); if (!wrap) return; rowKeyMap.clear(); if (!filtered.length) { wrap.innerHTML = '<div style="padding:18px;color:#64748b;">조건에 맞는 학생이 없습니다.</div>'; updateSummary(); return; }
    const rows = filtered.map(function (student) { const key = safeKey(student.studentUid); const dirty = dirtyKeys.has(key) ? ' ulim-dirty-row' : ''; const autoTeachers = deriveInstructors(student.classNames, student.instructorNames); return `<tr class="${dirty}" data-row-key="${key}" data-status="${escapeHtml(student.status)}"><td><select id="${key}_status" data-row-key="${key}"><option value="active"${student.status === 'active' ? ' selected' : ''}>재원</option><option value="leave"${student.status === 'leave' ? ' selected' : ''}>휴원</option><option value="withdrawn"${student.status === 'withdrawn' ? ' selected' : ''}>퇴원</option></select></td><td><input id="${key}_login" data-row-key="${key}" value="${escapeHtml(student.loginId)}"></td><td><input id="${key}_name" data-row-key="${key}" value="${escapeHtml(student.name)}"><div class="ulim-student-uid">UID ${escapeHtml(maskedUid(student.studentUid))}</div></td><td><input id="${key}_birth" type="date" data-row-key="${key}" value="${escapeHtml(student.birthDate)}"></td><td><input id="${key}_phone" data-row-key="${key}" value="${escapeHtml(student.phone)}"></td><td><input id="${key}_parent" data-row-key="${key}" value="${escapeHtml(student.parentPhone)}"></td><td>${classSelectHtml(key + '_classes', key, student.classNames)}</td><td><input id="${key}_instructors" readonly value="${escapeHtml(autoTeachers.join(', '))}"></td><td><input id="${key}_memo" data-row-key="${key}" value="${escapeHtml(student.memo)}"></td><td>${syncLabel(student)}<div style="font-size:10px;color:#64748b;max-width:160px;word-break:break-all;">${escapeHtml(student.sheetSyncMessage)}</div></td><td><div class="ulim-student-row-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentMasterSaveRow7344('${key}')"${student.firestorePersisted === false ? ' disabled' : ''}>${student.firestorePersisted === false ? '시트 가져오기 필요' : '저장'}</button>${student.sheetSyncState === 'failed' || student.sheetSyncState === 'retry' ? `<button type="button" class="admin-btn" onclick="ulimStudentMasterRetrySheet7344('${key}')">시트 재시도</button>` : ''}</div></td></tr>`; }).join('');
    wrap.innerHTML = `<table class="ulim-student-table"><thead><tr><th>재원상태</th><th>출결번호</th><th>학생명/UID</th><th>생년월일</th><th>학생전화</th><th>보호자전화</th><th>현재반(복수)</th><th>담당강사(자동)</th><th>메모</th><th>동기화</th><th>관리</th></tr></thead><tbody>${rows}</tbody></table>`; updateSummary();
  }
  function renderCreateClasses() { const select = document.getElementById('ulimNewStudentClasses7344'); if (!select) return; const before = new Set(selectedValues(select)); select.innerHTML = operatingClasses.map(function (item) { const label = item.teacher ? item.className + ' / ' + item.teacher : item.className; return '<option value="' + escapeHtml(item.className) + '"' + (before.has(item.className) ? ' selected' : '') + '>' + escapeHtml(label) + '</option>'; }).join(''); updateCreateInstructors(); }
  function updateCreateInstructors() { const classes = selectedValues(document.getElementById('ulimNewStudentClasses7344')); const names = deriveInstructors(classes, []); const input = document.getElementById('ulimNewStudentInstructors7344'); if (input) input.value = names.join(', '); }
  function updatePasswordPreview() { const digits = text(document.getElementById('ulimNewStudentPhone7344')?.value).replace(/[^0-9]/g, ''); const el = document.getElementById('ulimNewStudentPassword7344'); if (el) el.textContent = digits.length >= 4 ? '초기 비밀번호: ' + digits.slice(-4) : '초기 비밀번호: 학생 전화번호 뒤 4자리'; }
  function clearCreateForm() { ['ulimNewStudentLogin7344','ulimNewStudentName7344','ulimNewStudentBirth7344','ulimNewStudentPhone7344','ulimNewStudentParent7344','ulimNewStudentMemo7344'].forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ''; }); const status = document.getElementById('ulimNewStudentStatus7344'); if (status) status.value = 'active'; const classes = document.getElementById('ulimNewStudentClasses7344'); if (classes) Array.from(classes.options).forEach(function (option) { option.selected = false; }); updateCreateInstructors(); updatePasswordPreview(); }
  async function createStudent() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const classNames = selectedValues(document.getElementById('ulimNewStudentClasses7344')); const phone = text(document.getElementById('ulimNewStudentPhone7344')?.value); const phoneDigits = phone.replace(/[^0-9]/g, '');
    const payload = { loginId: text(document.getElementById('ulimNewStudentLogin7344')?.value), name: text(document.getElementById('ulimNewStudentName7344')?.value), birthDate: text(document.getElementById('ulimNewStudentBirth7344')?.value), phone: phone, parentPhone: text(document.getElementById('ulimNewStudentParent7344')?.value), status: text(document.getElementById('ulimNewStudentStatus7344')?.value) || 'active', classNames: classNames, instructorNames: deriveInstructors(classNames, []), memo: text(document.getElementById('ulimNewStudentMemo7344')?.value), requestId: requestId('student-create') };
    if (!payload.loginId || !payload.name) return alert('출결번호와 학생명을 입력해주세요.'); if (phoneDigits.length < 4) return alert('학생 전화번호를 숫자 4자리 이상 입력해주세요.'); if (!classNames.length) return alert('현재 수강반을 하나 이상 선택해주세요.');
    if (!confirm(payload.name + ' 학생을 추가할까요?\n초기 비밀번호는 ' + phoneDigits.slice(-4) + '입니다.')) return;
    try { showLoading('신규 학생을 Firestore에 생성하는 중...'); setStatus('신규 학생을 생성하는 중...', 'loading'); const result = await call('createStudentAdmin7344', payload); clearCreateForm(); await listFirestore(); setStatus(payload.name + ' 학생을 생성했습니다.\nUID: ' + text(result.studentUid) + '\n초기 비밀번호: ' + text(result.initialPassword) + '\nGoogle Sheets 기록은 백그라운드에서 진행됩니다.', 'ok'); alert(payload.name + ' 학생 추가 완료\n\n출결번호: ' + payload.loginId + '\n초기 비밀번호: ' + text(result.initialPassword)); return result; }
    catch (error) { const message = text(error && error.message) || '학생 생성에 실패했습니다.'; setStatus(message, 'error'); alert(message); return null; } finally { hideLoading(); }
  }
  async function retrySheet(key) { const studentUid = rowKeyMap.get(key) || ''; if (!studentUid) return; try { showLoading('Google Sheets 기록을 다시 요청하는 중...'); await call('retryStudentSheetSyncAdmin7344', { studentUid: studentUid, requestId: requestId('student-sheet-retry') }); await listFirestore(); setStatus('Google Sheets 학생명단 기록을 다시 요청했습니다.', 'ok'); } catch (error) { setStatus(text(error && error.message) || '시트 재시도 요청에 실패했습니다.', 'error'); } finally { hideLoading(); } }
  async function listFirestoreDirect() { const rt = await runtime(); const ref = rt.sdk.collection(rt.db, 'students'); const snap = await rt.sdk.getDocs(rt.sdk.query(ref, rt.sdk.limit(3000))); const all = snap.docs.map(function (doc) { return source(Object.assign({ studentUid: doc.id }, doc.data() || {})); }); hiddenIncompleteCount = all.filter(function (item) { return item.incomplete; }).length; sheetOnlyCount = 0; sheetMergeError = '서버 병합 목록 호출 실패'; students = all.filter(function (item) { return !item.incomplete; }); students.sort(function (left, right) { const order = { active: 0, leave: 1, withdrawn: 2 }; const diff = (order[left.status] ?? 9) - (order[right.status] ?? 9); return diff || text(left.name).localeCompare(text(right.name), 'ko'); }); filtered = students.slice(); dirtyKeys.clear(); render(); return { source: 'firestore-direct', count: students.length, hiddenIncomplete: hiddenIncompleteCount }; }
  async function listFirestore() { try { const data = await call('listStudentsAdmin7342', { limit: 3000, mergeSheet: true, requestId: requestId('student-list-merged') }); students = (Array.isArray(data.students) ? data.students : []).map(source).filter(function (item) { return !item.incomplete; }); hiddenIncompleteCount = Number(data.hiddenIncomplete || 0); sheetOnlyCount = Number(data.sheetOnlyCount || 0); sheetMergeError = text(data.sheetMergeError); filtered = students.slice(); dirtyKeys.clear(); render(); return Object.assign({ source: 'callable' }, data || {}); } catch (error) { const fallback = await listFirestoreDirect(); fallback.callableError = text(error && error.message || error); return fallback; } }
  async function load(importFromSheet) { if (!isSuperAdmin()) { setStatus('학생정보 관리는 전체관리자만 사용할 수 있습니다.', 'error'); return false; } if (loadingPromise) return loadingPromise; if (dirtyKeys.size && !confirm('저장하지 않은 학생 수정사항이 ' + dirtyKeys.size + '명 있습니다. 목록을 다시 불러오면 사라집니다. 계속할까요?')) return false; loadingPromise = (async function () { await loadOperatingClasses(false).catch(function () { return []; }); let syncResult = null; let syncError = null; if (importFromSheet === true) { if (!confirm('Google Sheets 학생명단을 기준으로 전체 학생 목록을 새로고침할까요?\n학생인증 UID가 확정된 학생만 Firestore에 연결하며 비밀번호는 변경하지 않습니다.')) return false; setStatus('학생명단 시트에서 전체 학생 목록을 새로고침하는 중...', 'loading'); try { syncResult = await call('syncStudentsFromSheetsAdmin7342', { requestId: requestId('student-directory') }); } catch (error) { syncError = error; } } setStatus('전체 학생 목록을 불러오는 중...', 'loading'); const listResult = await listFirestore(); if (syncResult) setStatus('학생목록 새로고침 완료: 신규 ' + Number(syncResult.created || 0) + '명 · 갱신 ' + Number(syncResult.updated || 0) + '명 · 유지 ' + Number(syncResult.preserved || 0) + '명 · UID 없음 제외 ' + Number(syncResult.unresolved || 0) + '명' + (Number(syncResult.failed || 0) ? ' · 실패 ' + Number(syncResult.failed || 0) + '명' : ''), Number(syncResult.failed || 0) ? 'warn' : 'ok'); else if (syncError) setStatus('시트 새로고침은 실패했지만 현재 Firestore 목록 ' + students.length + '명을 표시했습니다. ' + text(syncError.message || syncError), 'warn'); else { const notes = []; if (sheetOnlyCount) notes.push('시트에만 있는 학생 ' + sheetOnlyCount + '명은 목록 새로고침 후 저장할 수 있습니다.'); if (hiddenIncompleteCount) notes.push('이름·출결번호가 없는 UID 전용 문서 ' + hiddenIncompleteCount + '건은 목록에서 숨겼습니다.'); if (sheetMergeError) notes.push('시트 보완 조회 실패: ' + sheetMergeError); const base = listResult && listResult.source === 'firestore-direct' ? '전체 학생 ' + students.length + '명을 표시했습니다. 서버 목록 함수 대신 Firestore 직접 조회를 사용했습니다.' : '전체 학생 ' + students.length + '명을 표시했습니다.'; setStatus(base + (notes.length ? '\n' + notes.join('\n') : ''), (listResult && listResult.source === 'firestore-direct') || notes.length ? 'warn' : 'ok'); } return true; })().catch(function (error) { setStatus(text(error && error.message) || '학생목록 조회에 실패했습니다.', 'error'); return false; }).finally(function () { loadingPromise = null; }); return loadingPromise; }
  function markDirty(key) { if (!rowKeyMap.has(key)) return; const draft = rowData(key); const target = students.find(function (item) { return item.studentUid === draft.studentUid; }); if (target) Object.assign(target, draft); dirtyKeys.add(key); const row = document.querySelector('tr[data-row-key="' + key + '"]'); if (row) { row.classList.add('ulim-dirty-row'); const status = document.getElementById(key + '_status'); if (status) row.dataset.status = text(status.value); const instructors = document.getElementById(key + '_instructors'); if (instructors) instructors.value = draft.instructorNames.join(', '); } updateSummary(); }
  async function saveEdits(edits) { if (!edits.length) return { ok: true, results: [] }; try { return await call('updateStudentsMetadataBatchAdmin7343', { edits: edits, syncSheet: true, requestId: requestId('student-metadata-batch') }); } catch (batchError) { if (edits.length > 20) throw batchError; const results = []; for (const edit of edits) { try { const result = await call('updateStudentMetadataAdmin7342', Object.assign({}, edit, { syncSheet: true, requestId: requestId('student-metadata') })); results.push({ studentUid: edit.studentUid, ok: result.sheetSyncState !== 'failed', sheetSyncState: result.sheetSyncState, sheetSyncMessage: result.sheetSyncMessage, firestoreSaved: result.firestoreSaved === true }); } catch (error) { results.push({ studentUid: edit.studentUid, ok: false, sheetSyncState: 'failed', sheetSyncMessage: text(error && error.message || error) }); } } return { ok: results.every(function (item) { return item.ok; }), results: results, fallback: true }; } }
  async function saveKeys(keys) { if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.'); const uniqueKeys = Array.from(new Set(keys)).filter(function (key) { return rowKeyMap.has(key); }); const edits = uniqueKeys.map(rowData); if (!edits.length) return alert('수정된 학생정보가 없습니다.'); for (const edit of edits) { if (!edit.studentUid || !edit.loginId || !edit.name) return alert('출결번호와 학생명은 비워둘 수 없습니다.'); if (!edit.classNames.length) return alert(edit.name + ' 학생의 현재반을 하나 이상 선택해주세요.'); } if (!confirm('수정된 학생 ' + edits.length + '명의 정보를 Firestore와 Google Sheets에 저장할까요?')) return; uniqueKeys.forEach(function (key) { document.querySelector('tr[data-row-key="' + key + '"]')?.classList.add('ulim-saving-row'); }); try { showLoading('학생정보 ' + edits.length + '명 저장 중...'); const result = await saveEdits(edits); const rows = Array.isArray(result.results) ? result.results : []; const failed = rows.filter(function (item) { return item.ok !== true; }); const succeededUids = new Set(rows.filter(function (item) { return item.ok === true || item.firestoreSaved === true; }).map(function (item) { return text(item.studentUid); })); uniqueKeys.forEach(function (key) { const uid = rowKeyMap.get(key) || ''; if (!rows.length || succeededUids.has(uid)) dirtyKeys.delete(key); }); await listFirestore(); if (failed.length) setStatus('학생정보는 Firestore에 저장되었지만 ' + failed.length + '명은 Google Sheets 반영을 확인해야 합니다.\n' + failed.slice(0, 5).map(function (item) { return text(item.name || item.studentUid) + ': ' + text(item.sheetSyncMessage || item.message); }).join('\n'), 'warn'); else setStatus('학생정보 ' + edits.length + '명을 Firestore와 Google Sheets에 저장했습니다.', 'ok'); } catch (error) { setStatus(text(error && error.message) || '학생정보 저장에 실패했습니다.', 'error'); alert(text(error && error.message) || '학생정보 저장에 실패했습니다.'); } finally { uniqueKeys.forEach(function (key) { document.querySelector('tr[data-row-key="' + key + '"]')?.classList.remove('ulim-saving-row'); }); hideLoading(); updateSummary(); } }
  async function saveRow(key) { return saveKeys([key]); } async function saveAll() { return saveKeys(Array.from(dirtyKeys)); }
  function installPanelHook() { const original = global.showAdminPanel; if (typeof original === 'function' && !original.__ulimStudent7344Wrapped) { const wrapped = function (panelId) { const result = original.apply(this, arguments); if (panelId === targetPanelId) setTimeout(function () { if (!students.length) load(false); else loadOperatingClasses(false); }, 0); return result; }; wrapped.__ulimStudent7344Wrapped = true; global.showAdminPanel = wrapped; try { showAdminPanel = wrapped; } catch (_ignore) {} } }
  function bindUi() { const filter = document.getElementById(FILTER_ID); const statusFilter = document.getElementById(STATUS_FILTER_ID); const table = document.getElementById(TABLE_ID); const createClasses = document.getElementById('ulimNewStudentClasses7344'); const createPhone = document.getElementById('ulimNewStudentPhone7344'); if (filter && !filter.dataset.ulim7344Bound) { filter.dataset.ulim7344Bound = '1'; filter.addEventListener('input', applyFilter); } if (statusFilter && !statusFilter.dataset.ulim7344Bound) { statusFilter.dataset.ulim7344Bound = '1'; statusFilter.addEventListener('change', applyFilter); } if (createClasses && !createClasses.dataset.ulim7344Bound) { createClasses.dataset.ulim7344Bound = '1'; createClasses.addEventListener('change', updateCreateInstructors); } if (createPhone && !createPhone.dataset.ulim7344Bound) { createPhone.dataset.ulim7344Bound = '1'; createPhone.addEventListener('input', updatePasswordPreview); } if (table && !table.dataset.ulim7344Bound) { table.dataset.ulim7344Bound = '1'; table.addEventListener('input', function (event) { const key = event.target && event.target.dataset && event.target.dataset.rowKey; if (key) markDirty(key); }); table.addEventListener('change', function (event) { const key = event.target && event.target.dataset && event.target.dataset.rowKey; if (key) markDirty(key); }); } }
  function install() { if (installed) return; installed = true; injectStyles(); injectPanel(); bindUi(); installPanelHook(); global.ulimStudentMasterLoad7344 = load; global.ulimStudentMasterCreate7344 = createStudent; global.ulimStudentMasterSaveRow7344 = saveRow; global.ulimStudentMasterSaveAll7344 = saveAll; global.ulimStudentMasterRetrySheet7344 = retrySheet; global.ulimStudentMasterReloadClasses7344 = function () { return loadOperatingClasses(true); }; global.ulimStudentMasterLoad7343 = load; global.ulimStudentMasterSaveRow7343 = saveRow; global.ulimStudentMasterSaveAll7343 = saveAll; global.addEventListener('ulim-firebase-token-invalid', function () { setStatus('Firebase 로그인 세션이 만료되어 학생정보 조회를 중단했습니다. 다시 로그인해주세요.', 'error'); }); setTimeout(function () { loadOperatingClasses(false); }, 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})(typeof window !== 'undefined' ? window : globalThis);
