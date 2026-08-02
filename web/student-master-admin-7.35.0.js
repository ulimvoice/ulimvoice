(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_MANAGEMENT_V2_7350__) return;
  global.__ULIM_STUDENT_MANAGEMENT_V2_7350__ = true;

  const VERSION = '2026-08-02.735.00.0';
  const PANEL_ID = 'adminPanelStudentManagement7350';
  const CARD_ID = 'ulimStudentManagementCard7350';
  const STATUS_ID = 'ulimStudentManagementStatus7350';
  const TABLE_ID = 'ulimStudentManagementTable7350';
  const SUMMARY_ID = 'ulimStudentManagementSummary7350';
  const FILTER_ID = 'ulimStudentManagementFilter7350';
  const STATUS_FILTER_ID = 'ulimStudentManagementStatusFilter7350';
  const CREATE_FORM_ID = 'ulimStudentCreateForm7350';

  let installed = false;
  let targetPanelId = PANEL_ID;
  let students = [];
  let filtered = [];
  let classes = [];
  let loadingPromise = null;
  const rowKeyMap = new Map();
  const dirtyKeys = new Set();

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
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
  function today() {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function safeKey(uid) {
    const key = 'sv2_' + String(uid || '').replace(/[^0-9A-Za-z_-]/g, '_');
    rowKeyMap.set(key, uid);
    return key;
  }
  function maskedUid(uid) {
    const value = text(uid);
    return value ? '•••' + value.slice(-7) : '';
  }
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
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('학생정보 관리 기능을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('교직원 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'student-management-v2-7350');
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
  function classById(classId) { return classes.find(function (item) { return item.classId === classId; }) || null; }
  function selectedValues(select) {
    return select ? Array.from(select.selectedOptions || []).map(function (option) { return text(option.value); }).filter(Boolean) : [];
  }
  function statusLabel(value) {
    if (value === 'leave') return '휴원';
    if (value === 'withdrawn') return '퇴원';
    return '재원';
  }
  function selectedClassDetails(classIds) {
    return unique(classIds).map(classById).filter(Boolean);
  }
  function classOptionsHtml(selectedClassIds) {
    const selected = new Set(unique(selectedClassIds));
    return classes.map(function (item) {
      const label = item.className + (item.instructorName ? ' / ' + item.instructorName : ' / 담당강사 연결 필요');
      return '<option value="' + escapeHtml(item.classId) + '"' + (selected.has(item.classId) ? ' selected' : '') + (item.selectable === false ? ' disabled' : '') + '>' + escapeHtml(label) + '</option>';
    }).join('');
  }
  function tagsHtml(classIds, legacyNames) {
    const tags = selectedClassDetails(classIds).map(function (item) {
      return '<span class="ulim-student-class-tag">' + escapeHtml(item.className) + '</span>';
    });
    unique(legacyNames).forEach(function (name) {
      tags.push('<span class="ulim-student-class-tag legacy">' + escapeHtml(name) + ' · 기존 연결</span>');
    });
    return tags.length ? tags.join('') : '<span class="ulim-student-empty-tag">선택된 반 없음</span>';
  }
  function instructorText(classIds, fallback) {
    const names = selectedClassDetails(classIds).map(function (item) { return text(item.instructorName); }).filter(Boolean);
    return unique(names.length ? names : fallback || []).join(', ');
  }
  function syncBadge(label, state, message) {
    const key = text(state) || 'complete';
    const css = key === 'failed' ? 'fail' : (key === 'pending' || key === 'processing' ? 'wait' : 'ok');
    const textLabel = key === 'failed' ? label + ' 확인필요' : (key === 'pending' || key === 'processing' ? label + ' 대기' : label + ' 완료');
    return '<span class="ulim-student-sync ' + css + '" title="' + escapeHtml(message || '') + '">' + escapeHtml(textLabel) + '</span>';
  }
  function studentSyncHtml(student) {
    return '<div class="ulim-sync-stack">' +
      syncBadge('기본정보', student.dataSaveState || 'complete', '') +
      syncBadge('명단', student.sheetSyncState, student.sheetSyncMessage) +
      syncBadge('로그인', student.authSyncState, student.authSyncMessage) +
      syncBadge('출석부', student.attendanceSyncState, student.attendanceSyncMessage) +
      '</div>';
  }

  function injectStyles() {
    if (document.getElementById('ulimStudentManagementStyle7350')) return;
    const style = document.createElement('style');
    style.id = 'ulimStudentManagementStyle7350';
    style.textContent = `
      #${CARD_ID}{margin-bottom:16px}#${CARD_ID} .ulim-student-help{padding:12px 14px;border-radius:12px;background:#eff6ff;color:#1e3a8a;font-size:13px;line-height:1.6;margin-bottom:12px}
      #${STATUS_ID}{display:none;white-space:pre-line;padding:11px 13px;border-radius:10px;margin:10px 0;font-size:13px;font-weight:700}#${STATUS_ID}[data-state="ok"]{display:block;background:#ecfdf5;color:#166534}#${STATUS_ID}[data-state="warn"]{display:block;background:#fffbeb;color:#92400e}#${STATUS_ID}[data-state="error"]{display:block;background:#fff1f2;color:#9f1239}#${STATUS_ID}[data-state="loading"]{display:block;background:#eff6ff;color:#1d4ed8}
      #${CARD_ID} .ulim-create-box{margin:14px 0;padding:14px;border:1px solid #bfdbfe;background:#f8fbff;border-radius:14px}#${CARD_ID} .ulim-create-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px}#${CARD_ID} .wide{grid-column:span 2}
      #${CARD_ID} .ulim-create-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}#${CARD_ID} .ulim-password-preview{margin-right:auto;padding:8px 10px;border-radius:9px;background:#fff7ed;color:#9a3412;font-size:12px;font-weight:800}
      #${CARD_ID} .ulim-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 160px auto;gap:10px;align-items:end;margin:14px 0}#${CARD_ID} .ulim-toolbar-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
      #${CARD_ID} .ulim-table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px}#${CARD_ID} table{width:100%;min-width:1640px;border-collapse:collapse;background:#fff}#${CARD_ID} th{position:sticky;top:0;z-index:2;background:#f8fafc;color:#334155;font-size:12px;padding:9px;border-bottom:1px solid #cbd5e1;white-space:nowrap}#${CARD_ID} td{padding:7px;border-bottom:1px solid #edf2f7;vertical-align:top}#${CARD_ID} td input,#${CARD_ID} td select,#${CARD_ID} .ulim-create-grid input,#${CARD_ID} .ulim-create-grid select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:#fff;font-size:12px}#${CARD_ID} td select[multiple]{min-width:260px}
      #${CARD_ID} tr.ulim-dirty-row{background:#fffbea}#${CARD_ID} tr.ulim-saving-row{opacity:.58}#${CARD_ID} .ulim-student-uid{margin-top:4px;font-size:10px;color:#94a3b8}#${CARD_ID} .ulim-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;max-width:310px}#${CARD_ID} .ulim-student-class-tag{display:inline-flex;padding:3px 7px;border-radius:999px;background:#dbeafe;color:#1e40af;font-size:10px;font-weight:800}#${CARD_ID} .ulim-student-class-tag.legacy{background:#fef3c7;color:#92400e}#${CARD_ID} .ulim-student-empty-tag{font-size:10px;color:#94a3b8}
      #${CARD_ID} .ulim-sync-stack{display:flex;gap:4px;flex-wrap:wrap;max-width:210px}#${CARD_ID} .ulim-student-sync{display:inline-flex;padding:3px 6px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}#${CARD_ID} .ulim-student-sync.ok{background:#dcfce7;color:#166534}#${CARD_ID} .ulim-student-sync.wait{background:#fef3c7;color:#92400e}#${CARD_ID} .ulim-student-sync.fail{background:#fee2e2;color:#991b1b}#${CARD_ID} .ulim-row-actions{display:flex;gap:5px;flex-wrap:wrap}
      @media(max-width:1100px){#${CARD_ID} .ulim-create-grid{grid-template-columns:repeat(2,minmax(150px,1fr))}}@media(max-width:850px){#${CARD_ID} .ulim-toolbar{grid-template-columns:1fr}#${CARD_ID} .ulim-toolbar-actions{justify-content:flex-start}}@media(max-width:620px){#${CARD_ID} .ulim-create-grid{grid-template-columns:1fr}#${CARD_ID} .wide{grid-column:span 1}}
    `;
    document.head.appendChild(style);
  }

  function findExistingPanel() {
    const ids = ['adminPanelStudents', 'adminPanelStudentList', 'adminPanelStudentRoster', 'adminPanelStudent', 'adminPanelRoster'];
    for (const id of ids) {
      const panel = document.getElementById(id);
      if (panel) return panel;
    }
    return null;
  }

  function cardHtml() {
    return `<div id="${CARD_ID}" class="admin-card admin-full-only">
      <h3 style="margin-top:0;">학생정보 관리</h3>
      <div class="ulim-student-help">학생 기본정보와 수강반을 함께 관리합니다. 출결번호와 최초 비밀번호는 학생 전화번호의 마지막 네 자리로 자동 생성됩니다. 학생정보는 먼저 안전하게 저장되고, 명단·로그인·출석부 반영은 순차 처리됩니다.</div>
      <div id="${STATUS_ID}"></div>
      <details class="ulim-create-box" open><summary style="cursor:pointer;font-weight:900;color:#1e3a8a;">학생 추가</summary>
        <div id="${CREATE_FORM_ID}" class="ulim-create-grid" style="margin-top:12px;">
          <div class="admin-field"><label>학생명 *</label><input id="ulimNewStudentName7350" autocomplete="off"></div>
          <div class="admin-field"><label>생년월일 *</label><input id="ulimNewStudentBirth7350" type="date"></div>
          <div class="admin-field"><label>학생 전화번호 *</label><input id="ulimNewStudentPhone7350" inputmode="tel" autocomplete="off"></div>
          <div class="admin-field"><label>보호자 전화번호</label><input id="ulimNewStudentParent7350" inputmode="tel" autocomplete="off"></div>
          <div class="admin-field"><label>재원상태</label><select id="ulimNewStudentStatus7350"><option value="active">재원</option><option value="leave">휴원</option><option value="withdrawn">퇴원</option></select></div>
          <div class="admin-field"><label>수강 시작일 *</label><input id="ulimNewStudentStart7350" type="date" value="${today()}"></div>
          <div class="admin-field"><label>등록 구분</label><select id="ulimNewStudentType7350"><option value="new">신규</option><option value="existing">기존등록</option></select></div>
          <div class="admin-field"><label>관리자 메모</label><input id="ulimNewStudentMemo7350"></div>
          <div class="admin-field wide"><label>수강반 * (복수선택)</label><select id="ulimNewStudentClasses7350" multiple size="6"></select><div id="ulimNewStudentTags7350" class="ulim-tags"></div></div>
          <div class="admin-field wide"><label>담당강사 자동 연결</label><input id="ulimNewStudentInstructors7350" readonly placeholder="수강반을 선택하면 표시됩니다."></div>
        </div>
        <div class="ulim-create-actions"><span id="ulimNewStudentPassword7350" class="ulim-password-preview">출결번호·최초 비밀번호: 전화번호 마지막 네 자리</span><button type="button" class="admin-btn" onclick="ulimStudentManagementReloadClasses7350()">반 목록 다시 불러오기</button><button type="button" class="admin-btn blue" onclick="ulimStudentManagementCreate7350()">학생 추가</button></div>
      </details>
      <div class="ulim-toolbar">
        <div class="admin-field"><label>학생 검색</label><input id="${FILTER_ID}" placeholder="학생명 · 출결번호 · 전화번호 · 반 · 강사"></div>
        <div class="admin-field"><label>재원상태</label><select id="${STATUS_FILTER_ID}"><option value="">전체</option><option value="active">재원</option><option value="leave">휴원</option><option value="withdrawn">퇴원</option></select></div>
        <div class="ulim-toolbar-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentManagementLoad7350()">목록 새로고침</button><button type="button" class="admin-btn orange" id="ulimStudentManagementSaveAll7350" onclick="ulimStudentManagementSaveAll7350()">변경사항 전체 저장</button></div>
      </div>
      <div id="${SUMMARY_ID}" style="font-size:12px;color:#64748b;margin:10px 0;"></div>
      <div class="ulim-table-wrap"><div id="${TABLE_ID}"></div></div>
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
        else global.ulimStudentManagementLoad7350();
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

  function normalizeStudent(raw) {
    const student = raw || {};
    return {
      studentUid: text(student.studentUid),
      name: text(student.name),
      birthDate: text(student.birthDate),
      studentPhone: text(student.studentPhone),
      parentPhone: text(student.parentPhone),
      attendanceNo: text(student.attendanceNo),
      enrollmentStatus: text(student.enrollmentStatus) || 'active',
      initialRegisteredDate: text(student.initialRegisteredDate) || today(),
      privacyConsent: student.privacyConsent === true,
      portraitConsent: student.portraitConsent === true,
      mustChangePassword: student.mustChangePassword !== false,
      memo: text(student.memo),
      selectedClassIds: unique(student.selectedClassIds),
      legacyUnmappedClassNames: unique(student.legacyUnmappedClassNames),
      instructorNames: unique(student.instructorNames),
      dataSaveState: text(student.dataSaveState) || 'complete',
      sheetSyncState: text(student.sheetSyncState) || 'complete',
      sheetSyncMessage: text(student.sheetSyncMessage),
      authSyncState: text(student.authSyncState) || 'complete',
      authSyncMessage: text(student.authSyncMessage),
      attendanceSyncState: text(student.attendanceSyncState) || 'complete',
      attendanceSyncMessage: text(student.attendanceSyncMessage),
      retryable: student.retryable === true
    };
  }

  function renderCreateClasses() {
    const select = document.getElementById('ulimNewStudentClasses7350');
    if (!select) return;
    const selected = new Set(selectedValues(select));
    select.innerHTML = classOptionsHtml(Array.from(selected));
    updateCreateClassPreview();
  }

  function updateCreateClassPreview() {
    const select = document.getElementById('ulimNewStudentClasses7350');
    const ids = selectedValues(select);
    const tags = document.getElementById('ulimNewStudentTags7350');
    const instructors = document.getElementById('ulimNewStudentInstructors7350');
    if (tags) tags.innerHTML = tagsHtml(ids, []);
    if (instructors) instructors.value = instructorText(ids, []);
  }

  function updatePasswordPreview() {
    const phone = text(document.getElementById('ulimNewStudentPhone7350') && document.getElementById('ulimNewStudentPhone7350').value);
    const digits = phone.replace(/\D/g, '');
    const preview = document.getElementById('ulimNewStudentPassword7350');
    if (!preview) return;
    preview.textContent = digits.length >= 4 ? '출결번호·최초 비밀번호: ' + digits.slice(-4) : '출결번호·최초 비밀번호: 전화번호 마지막 네 자리';
  }

  function rowData(key) {
    const uid = rowKeyMap.get(key) || '';
    const current = students.find(function (student) { return student.studentUid === uid; }) || {};
    return {
      studentUid: uid,
      name: text(document.getElementById(key + '_name') && document.getElementById(key + '_name').value),
      birthDate: text(document.getElementById(key + '_birth') && document.getElementById(key + '_birth').value),
      studentPhone: text(document.getElementById(key + '_phone') && document.getElementById(key + '_phone').value),
      parentPhone: text(document.getElementById(key + '_parent') && document.getElementById(key + '_parent').value),
      enrollmentStatus: text(document.getElementById(key + '_status') && document.getElementById(key + '_status').value) || 'active',
      initialRegisteredDate: text(document.getElementById(key + '_start') && document.getElementById(key + '_start').value) || today(),
      classIds: selectedValues(document.getElementById(key + '_classes')),
      registrationType: 'existing',
      memo: text(document.getElementById(key + '_memo') && document.getElementById(key + '_memo').value),
      privacyConsent: current.privacyConsent === true,
      portraitConsent: current.portraitConsent === true,
      preserveLegacyClassNames: unique(current.legacyUnmappedClassNames)
    };
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
      const dirty = dirtyKeys.has(key) ? ' class="ulim-dirty-row"' : '';
      const teachers = instructorText(student.selectedClassIds, student.instructorNames);
      return `<tr${dirty} data-row-key="${key}">
        <td><select id="${key}_status" data-row-key="${key}"><option value="active"${student.enrollmentStatus === 'active' ? ' selected' : ''}>재원</option><option value="leave"${student.enrollmentStatus === 'leave' ? ' selected' : ''}>휴원</option><option value="withdrawn"${student.enrollmentStatus === 'withdrawn' ? ' selected' : ''}>퇴원</option></select></td>
        <td><input value="${escapeHtml(student.attendanceNo)}" readonly><div class="ulim-student-uid">UID ${escapeHtml(maskedUid(student.studentUid))}</div></td>
        <td><input id="${key}_name" data-row-key="${key}" value="${escapeHtml(student.name)}"></td>
        <td><input id="${key}_birth" type="date" data-row-key="${key}" value="${escapeHtml(student.birthDate)}"></td>
        <td><input id="${key}_phone" data-row-key="${key}" value="${escapeHtml(student.studentPhone)}"></td>
        <td><input id="${key}_parent" data-row-key="${key}" value="${escapeHtml(student.parentPhone)}"></td>
        <td><input id="${key}_start" type="date" data-row-key="${key}" value="${escapeHtml(student.initialRegisteredDate || today())}"></td>
        <td><select id="${key}_classes" data-row-key="${key}" data-class-select="true" multiple size="4">${classOptionsHtml(student.selectedClassIds)}</select><div id="${key}_tags" class="ulim-tags">${tagsHtml(student.selectedClassIds, student.legacyUnmappedClassNames)}</div></td>
        <td><input id="${key}_instructors" value="${escapeHtml(teachers)}" readonly></td>
        <td><input id="${key}_memo" data-row-key="${key}" value="${escapeHtml(student.memo)}"></td>
        <td>${studentSyncHtml(student)}</td>
        <td><div class="ulim-row-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentManagementSaveRow7350('${key}')">저장</button>${student.retryable ? `<button type="button" class="admin-btn" onclick="ulimStudentManagementRetry7350('${key}')">재시도</button>` : ''}</div></td>
      </tr>`;
    }).join('');
    wrap.innerHTML = `<table><thead><tr><th>재원상태</th><th>출결번호/UID</th><th>학생명</th><th>생년월일</th><th>학생전화</th><th>보호자전화</th><th>최초 등록일</th><th>수강반(복수)</th><th>담당강사</th><th>관리자 메모</th><th>저장상태</th><th>관리</th></tr></thead><tbody>${rows}</tbody></table>`;
    updateSummary();
  }

  function updateRowClassPreview(key) {
    const ids = selectedValues(document.getElementById(key + '_classes'));
    const student = students.find(function (item) { return item.studentUid === (rowKeyMap.get(key) || ''); }) || {};
    const tags = document.getElementById(key + '_tags');
    const instructors = document.getElementById(key + '_instructors');
    if (tags) tags.innerHTML = tagsHtml(ids, student.legacyUnmappedClassNames || []);
    if (instructors) instructors.value = instructorText(ids, student.instructorNames || []);
  }

  function markDirty(key) {
    if (!rowKeyMap.has(key)) return;
    dirtyKeys.add(key);
    const row = document.querySelector('tr[data-row-key="' + key + '"]');
    if (row) row.classList.add('ulim-dirty-row');
    updateRowClassPreview(key);
    updateSummary();
  }

  function applyFilter() {
    const keyword = normalize(document.getElementById(FILTER_ID) && document.getElementById(FILTER_ID).value);
    const wantedStatus = text(document.getElementById(STATUS_FILTER_ID) && document.getElementById(STATUS_FILTER_ID).value);
    filtered = students.filter(function (student) {
      if (wantedStatus && student.enrollmentStatus !== wantedStatus) return false;
      if (!keyword) return true;
      const classNames = selectedClassDetails(student.selectedClassIds).map(function (item) { return item.className; });
      const haystack = [student.name, student.attendanceNo, student.studentPhone, student.parentPhone, student.birthDate, classNames.join(' '), student.legacyUnmappedClassNames.join(' '), student.instructorNames.join(' '), student.memo].join(' ');
      return normalize(haystack).indexOf(keyword) >= 0;
    });
    render();
  }

  function updateSummary() {
    const summary = document.getElementById(SUMMARY_ID);
    if (!summary) return;
    const active = filtered.filter(function (student) { return student.enrollmentStatus === 'active'; }).length;
    const leave = filtered.filter(function (student) { return student.enrollmentStatus === 'leave'; }).length;
    const withdrawn = filtered.filter(function (student) { return student.enrollmentStatus === 'withdrawn'; }).length;
    const retry = students.filter(function (student) { return student.retryable; }).length;
    summary.textContent = '표시 ' + filtered.length + '명 / 전체 ' + students.length + '명 · 재원 ' + active + ' · 휴원 ' + leave + ' · 퇴원 ' + withdrawn + ' · 운영반 ' + classes.length + '개 · 저장 대기 ' + dirtyKeys.size + '명 · 확인 필요 ' + retry + '명';
    const button = document.getElementById('ulimStudentManagementSaveAll7350');
    if (button) button.textContent = dirtyKeys.size ? '변경사항 전체 저장 (' + dirtyKeys.size + ')' : '변경사항 전체 저장';
  }

  async function load(forceDiscardDirty) {
    if (!isSuperAdmin()) {
      setStatus('학생정보 관리는 전체관리자만 사용할 수 있습니다.', 'error');
      return false;
    }
    if (loadingPromise) return loadingPromise;
    if (!forceDiscardDirty && dirtyKeys.size && !confirm('저장하지 않은 학생 수정사항이 ' + dirtyKeys.size + '명 있습니다. 목록을 다시 불러오면 사라집니다. 계속할까요?')) return false;
    loadingPromise = (async function () {
      setStatus('학생정보와 운영 반 목록을 불러오는 중...', 'loading');
      const result = await call('listStudentManagementAdmin7350', { requestId: requestId('student-list-7350') });
      classes = Array.isArray(result.classes) ? result.classes.map(function (item) {
        return {
          classId: text(item.classId), className: text(item.className), instructorUid: text(item.instructorUid),
          instructorName: text(item.instructorName), selectable: item.selectable !== false, dates: Array.isArray(item.dates) ? item.dates : []
        };
      }).filter(function (item) { return item.classId && item.className; }) : [];
      students = (Array.isArray(result.students) ? result.students : []).map(normalizeStudent);
      filtered = students.slice();
      dirtyKeys.clear();
      renderCreateClasses();
      render();
      const hidden = Number(result.hiddenIncomplete || 0);
      setStatus('학생 ' + students.length + '명과 운영 반 ' + classes.length + '개를 불러왔습니다.' + (hidden ? '\n정보가 불완전한 문서 ' + hidden + '건은 목록에서 제외했습니다.' : ''), hidden ? 'warn' : 'ok');
      return true;
    })().catch(function (error) {
      setStatus(text(error && error.message) || '학생정보를 불러오지 못했습니다.', 'error');
      return false;
    }).finally(function () { loadingPromise = null; });
    return loadingPromise;
  }

  async function reloadClasses() {
    try {
      showLoading('운영 반 목록을 다시 불러오는 중...');
      const result = await call('getStudentClassCatalogAdmin7350', { requestId: requestId('student-class-catalog-7350') });
      classes = Array.isArray(result.classes) ? result.classes : [];
      renderCreateClasses();
      if (!dirtyKeys.size) render();
      setStatus('운영 반 ' + classes.length + '개를 다시 불러왔습니다.' + (dirtyKeys.size ? '\n입력 중인 변경사항을 보호하기 위해 현재 표는 저장 후 갱신됩니다.' : ''), dirtyKeys.size ? 'warn' : 'ok');
    } catch (error) {
      setStatus(text(error && error.message) || '반 목록을 불러오지 못했습니다.', 'error');
    } finally { hideLoading(); }
  }

  function createInput() {
    return {
      name: text(document.getElementById('ulimNewStudentName7350') && document.getElementById('ulimNewStudentName7350').value),
      birthDate: text(document.getElementById('ulimNewStudentBirth7350') && document.getElementById('ulimNewStudentBirth7350').value),
      studentPhone: text(document.getElementById('ulimNewStudentPhone7350') && document.getElementById('ulimNewStudentPhone7350').value),
      parentPhone: text(document.getElementById('ulimNewStudentParent7350') && document.getElementById('ulimNewStudentParent7350').value),
      enrollmentStatus: text(document.getElementById('ulimNewStudentStatus7350') && document.getElementById('ulimNewStudentStatus7350').value) || 'active',
      startDate: text(document.getElementById('ulimNewStudentStart7350') && document.getElementById('ulimNewStudentStart7350').value),
      registrationType: text(document.getElementById('ulimNewStudentType7350') && document.getElementById('ulimNewStudentType7350').value) || 'new',
      classIds: selectedValues(document.getElementById('ulimNewStudentClasses7350')),
      memo: text(document.getElementById('ulimNewStudentMemo7350') && document.getElementById('ulimNewStudentMemo7350').value),
      requestId: requestId('student-create-7350')
    };
  }

  function validateInput(input) {
    if (!input.name) return '학생명을 입력해주세요.';
    if (!input.birthDate) return '생년월일을 입력해주세요.';
    if (String(input.studentPhone || '').replace(/\D/g, '').length < 4) return '학생 전화번호를 정확히 입력해주세요.';
    if (!input.startDate) return '수강 시작일을 입력해주세요.';
    if (!input.classIds.length && input.enrollmentStatus !== 'withdrawn') return '수강반을 하나 이상 선택해주세요.';
    return '';
  }

  async function createStudent() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const input = createInput();
    const error = validateInput(input);
    if (error) return alert(error);
    const selectedNames = selectedClassDetails(input.classIds).map(function (item) { return item.className; }).join('\n');
    if (!confirm(input.name + ' 학생을 추가할까요?\n\n수강반\n' + selectedNames)) return;
    try {
      showLoading('학생정보를 저장하는 중...');
      const result = await call('createStudentAdmin7350', input);
      const form = document.getElementById(CREATE_FORM_ID);
      if (form) Array.from(form.querySelectorAll('input')).forEach(function (el) { if (el.type !== 'date' || el.id !== 'ulimNewStudentStart7350') el.value = ''; });
      const classSelect = document.getElementById('ulimNewStudentClasses7350');
      if (classSelect) Array.from(classSelect.options).forEach(function (option) { option.selected = false; });
      document.getElementById('ulimNewStudentStart7350').value = today();
      updateCreateClassPreview();
      updatePasswordPreview();
      await load(true);
      setStatus(input.name + ' 학생을 추가했습니다.\n출결번호: ' + text(result.attendanceNo) + '\n최초 비밀번호: ' + text(result.initialPassword) + '\n명단·로그인·출석부 반영은 순차 진행됩니다.', 'ok');
    } catch (error2) {
      setStatus(text(error2 && error2.message) || '학생을 추가하지 못했습니다.', 'error');
      alert(text(error2 && error2.message) || '학생을 추가하지 못했습니다.');
    } finally { hideLoading(); }
  }

  async function saveKeys(keys) {
    const selectedKeys = unique(keys).filter(function (key) { return rowKeyMap.has(key); });
    const edits = selectedKeys.map(rowData);
    if (!edits.length) return alert('수정된 학생정보가 없습니다.');
    for (const edit of edits) {
      const error = validateInput({
        name: edit.name, birthDate: edit.birthDate, studentPhone: edit.studentPhone,
        startDate: edit.initialRegisteredDate, classIds: edit.classIds, enrollmentStatus: edit.enrollmentStatus
      });
      if (error) return alert(edit.name + ': ' + error);
    }
    if (!confirm('학생 ' + edits.length + '명의 변경사항을 저장할까요?\n기존 수강반 종료와 반이동은 다음 단계의 처리구분 기능에서 진행됩니다.')) return;
    selectedKeys.forEach(function (key) {
      const row = document.querySelector('tr[data-row-key="' + key + '"]');
      if (row) row.classList.add('ulim-saving-row');
    });
    try {
      showLoading('학생정보 ' + edits.length + '명 저장 중...');
      let result;
      if (edits.length === 1) result = { results: [await call('updateStudentAdmin7350', Object.assign({}, edits[0], { requestId: requestId('student-update-7350') }))] };
      else result = await call('updateStudentsBatchAdmin7350', { edits: edits, requestId: requestId('student-batch-7350') });
      const results = Array.isArray(result.results) ? result.results : [];
      const failed = results.filter(function (item) { return item.ok === false; });
      const succeeded = new Set(results.filter(function (item) { return item.ok !== false; }).map(function (item) { return text(item.studentUid); }));
      selectedKeys.forEach(function (key) { if (!results.length || succeeded.has(rowKeyMap.get(key) || '')) dirtyKeys.delete(key); });
      await load(true);
      if (failed.length) setStatus('저장 완료 후 확인이 필요한 학생이 ' + failed.length + '명 있습니다.\n' + failed.slice(0, 5).map(function (item) { return text(item.message); }).join('\n'), 'warn');
      else setStatus('학생정보 ' + edits.length + '명의 변경사항을 저장했습니다. 명단 반영은 순차 처리됩니다.', 'ok');
    } catch (error) {
      setStatus(text(error && error.message) || '학생정보를 저장하지 못했습니다.', 'error');
      alert(text(error && error.message) || '학생정보를 저장하지 못했습니다.');
    } finally {
      selectedKeys.forEach(function (key) {
        const row = document.querySelector('tr[data-row-key="' + key + '"]');
        if (row) row.classList.remove('ulim-saving-row');
      });
      hideLoading();
      updateSummary();
    }
  }

  async function saveRow(key) { return saveKeys([key]); }
  async function saveAll() { return saveKeys(Array.from(dirtyKeys)); }

  async function retry(key) {
    const studentUid = rowKeyMap.get(key) || '';
    if (!studentUid) return;
    try {
      showLoading('연동 작업을 다시 요청하는 중...');
      const result = await call('retryStudentOperationAdmin7350', { studentUid: studentUid, requestId: requestId('student-retry-7350') });
      await load(true);
      setStatus(text(result.message) || '연동 작업을 다시 요청했습니다.', 'ok');
    } catch (error) {
      setStatus(text(error && error.message) || '재시도 요청에 실패했습니다.', 'error');
    } finally { hideLoading(); }
  }

  function bindUi() {
    const filter = document.getElementById(FILTER_ID);
    const statusFilter = document.getElementById(STATUS_FILTER_ID);
    const createClasses = document.getElementById('ulimNewStudentClasses7350');
    const createPhone = document.getElementById('ulimNewStudentPhone7350');
    const table = document.getElementById(TABLE_ID);
    if (filter && !filter.dataset.ulim7350Bound) { filter.dataset.ulim7350Bound = '1'; filter.addEventListener('input', applyFilter); }
    if (statusFilter && !statusFilter.dataset.ulim7350Bound) { statusFilter.dataset.ulim7350Bound = '1'; statusFilter.addEventListener('change', applyFilter); }
    if (createClasses && !createClasses.dataset.ulim7350Bound) { createClasses.dataset.ulim7350Bound = '1'; createClasses.addEventListener('change', updateCreateClassPreview); }
    if (createPhone && !createPhone.dataset.ulim7350Bound) { createPhone.dataset.ulim7350Bound = '1'; createPhone.addEventListener('input', updatePasswordPreview); }
    if (table && !table.dataset.ulim7350Bound) {
      table.dataset.ulim7350Bound = '1';
      table.addEventListener('input', function (event) { const key = event.target && event.target.dataset && event.target.dataset.rowKey; if (key) markDirty(key); });
      table.addEventListener('change', function (event) { const key = event.target && event.target.dataset && event.target.dataset.rowKey; if (key) markDirty(key); });
    }
  }

  function installPanelHook() {
    const original = global.showAdminPanel;
    if (typeof original !== 'function' || original.__ulimStudentManagement7350Wrapped) return;
    const wrapped = function (panelId) {
      const result = original.apply(this, arguments);
      if (panelId === targetPanelId) setTimeout(function () { if (!students.length) load(); }, 0);
      return result;
    };
    wrapped.__ulimStudentManagement7350Wrapped = true;
    global.showAdminPanel = wrapped;
    try { showAdminPanel = wrapped; } catch (_ignore) {}
  }

  function install() {
    if (installed) return;
    installed = true;
    injectStyles();
    injectPanel();
    bindUi();
    installPanelHook();
    global.ulimStudentManagementLoad7350 = load;
    global.ulimStudentManagementCreate7350 = createStudent;
    global.ulimStudentManagementSaveRow7350 = saveRow;
    global.ulimStudentManagementSaveAll7350 = saveAll;
    global.ulimStudentManagementRetry7350 = retry;
    global.ulimStudentManagementReloadClasses7350 = reloadClasses;
    global.addEventListener('ulim-firebase-token-invalid', function () { setStatus('로그인 시간이 만료되었습니다. 다시 로그인해주세요.', 'error'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof window !== 'undefined' ? window : globalThis);
