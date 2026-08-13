/* ULIM_STUDENT_UI_CONSOLIDATION_7355038 */
/* ULIM_R19R7_STUDENT_ADD_FORM_RESTORE_7355040 */
(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_MANAGEMENT_V2_7355020__) {
    global.__ULIM_STUDENT_MANAGEMENT_V2_7355019__ = true;
    global.__ULIM_STUDENT_MANAGEMENT_V2_7355018__ = true;
    global.__ULIM_STUDENT_MANAGEMENT_V2_7355002__ = true;
    global.__ULIM_STUDENT_MANAGEMENT_V2_735410__ = true;
    return;
  }
  global.__ULIM_STUDENT_MANAGEMENT_V2_7355020__ = true;
  global.__ULIM_STUDENT_MANAGEMENT_V2_7355019__ = true;
  global.__ULIM_STUDENT_MANAGEMENT_V2_7355018__ = true;
  global.__ULIM_STUDENT_MANAGEMENT_V2_7355016__ = true;
  global.__ULIM_STUDENT_MANAGEMENT_V2_7355002__ = true;
  // Compatibility marker for 7.35.4.10/7.35.5.0 readiness checks.
  global.__ULIM_STUDENT_MANAGEMENT_V2_735410__ = true;

  const VERSION = '2026-08-14.735.05.0.51-admin-practice-reset-controls';
  const PANEL_ID = 'adminPanelStudentManagement7352';
  const CARD_ID = 'ulimStudentManagementCard7352';
  const STATUS_ID = 'ulimStudentManagementStatus7352';
  const TABLE_ID = 'ulimStudentManagementTable7352';
  const SUMMARY_ID = 'ulimStudentManagementSummary7352';
  const FILTER_ID = 'ulimStudentManagementFilter7352';
  const STATUS_FILTER_ID = 'ulimStudentManagementStatusFilter7352';
  const CREATE_FORM_ID = 'ulimStudentCreateForm7352';

  let installed = false;
  let targetPanelId = PANEL_ID;
  let students = [];
  let filtered = [];
  let classes = [];
  let teachers = [];
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
  function friendlyError7355016(error, fallback) {
    const raw = text(error && error.message);
    const code = text(error && error.code).toLowerCase();
    if (!raw || raw.toLowerCase() === 'internal' || code.indexOf('internal') >= 0 || code.indexOf('resource-exhausted') >= 0 || code.indexOf('deadline-exceeded') >= 0) {
      return fallback || '학생정보를 불러오는 중 연결이 지연되었습니다. 잠시 후 다시 시도해주세요.';
    }
    return raw;
  }
  function legacyStudentRows7355016() {
    return students.map(function (student) {
      return {
        studentUid: text(student.studentUid),
        name: text(student.name), studentName: text(student.name),
        studentNo: text(student.attendanceNo), attendanceNo: text(student.attendanceNo),
        studentPhone: text(student.studentPhone), parentPhone: text(student.parentPhone),
        enrollmentStatus: text(student.enrollmentStatus) || 'active',
        studentStatus: text(student.enrollmentStatus) || 'active',
        status: text(student.enrollmentStatus) || 'active',
        classIds: unique(student.selectedClassIds), selectedClassIds: unique(student.selectedClassIds),
        classNames: unique(student.classNames), className: text((student.classNames || [])[0]),
        instructorNames: unique(student.instructorNames), instructor: text((student.instructorNames || [])[0]),
        memo: text(student.memo), birthDate: text(student.birthDate),
        initialRegisteredDate: text(student.initialRegisteredDate), registrationCancelled: student.registrationCancelled === true
      };
    });
  }
  function publishDirectory7355016(reason, detail) {
    const snapshot = {
      version: VERSION, loadedAt: Date.now(), reason: text(reason) || 'update',
      students: students.map(function (student) { return Object.assign({}, student, { selectedClassIds: unique(student.selectedClassIds), classNames: unique(student.classNames), instructorNames: unique(student.instructorNames) }); }),
      classes: classes.map(function (item) { return Object.assign({}, item); }),
      teachers: teachers.map(function (item) { return Object.assign({}, item); })
    };
    global.__ULIM_STUDENT_DIRECTORY_7355016__ = snapshot;
    const legacyRows = legacyStudentRows7355016();
    try { adminStudents = legacyRows; adminStudentsLoaded = true; } catch (_ignore) {}
    global.adminStudents = legacyRows; global.adminStudentsLoaded = true;
    try { global.dispatchEvent(new CustomEvent('ulim-student-directory-updated', { detail: Object.assign({ reason: snapshot.reason, version: VERSION }, detail || {}) })); } catch (_ignore2) {}
    return snapshot;
  }
  function dispatchRosterChanged7355016(reason, detail) {
    publishDirectory7355016(reason, detail);
    try { global.dispatchEvent(new CustomEvent('ulim-student-roster-updated', { detail: Object.assign({ reason: text(reason), version: VERSION }, detail || {}) })); } catch (_ignore) {}
  }
  function patchStudentFromExternal7355016(patch, reason) {
    const incoming = patch && typeof patch === 'object' ? patch : {};
    const studentUid = text(incoming.studentUid);
    if (!studentUid) return null;
    const student = students.find(function(item){ return item.studentUid === studentUid; });
    if (!student) return null;
    ['name','attendanceNo','studentPhone','parentPhone','birthDate','initialRegisteredDate','enrollmentStatus','memo'].forEach(function(field){
      if (Object.prototype.hasOwnProperty.call(incoming, field)) student[field] = incoming[field];
    });
    if (Array.isArray(incoming.selectedClassIds) || Array.isArray(incoming.classIds)) {
      student.selectedClassIds = unique(incoming.selectedClassIds || incoming.classIds);
      const details = selectedClassDetails(student.selectedClassIds);
      student.classNames = details.map(function(item){ return item.className; }).filter(Boolean);
      student.instructorNames = details.map(function(item){ return item.instructorName; }).filter(Boolean);
    }
    if (Object.prototype.hasOwnProperty.call(incoming, 'registrationCancelled')) student.registrationCancelled = incoming.registrationCancelled === true;
    applyFilter();
    dispatchRosterChanged7355016(reason || 'external-student-patch', { studentUids: [studentUid] });
    return student;
  }
  function dispatchClassCatalogChanged7355016(reason, detail) {
    publishDirectory7355016(reason, detail);
    try { global.dispatchEvent(new CustomEvent('ulim-class-catalog-updated', { detail: Object.assign({ reason: text(reason), classCatalogChanged: true, version: VERSION }, detail || {}) })); } catch (_ignore) {}
  }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function today() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const map = {};
    parts.forEach(function (part) { if (part.type !== 'literal') map[part.type] = part.value; });
    return map.year + '-' + map.month + '-' + map.day;
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
    return role === 'super' || role === 'superadmin' || role === normalize('전체관리자') || role === normalize('전체관리') || role === normalize('원장');
  }
  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_72917 || global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('학생정보 관리 기능을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('교직원 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'student-management-v2-7352');
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
  function sameTextSet(left, right) {
    const a = unique(left).sort();
    const b = unique(right).sort();
    return a.length === b.length && a.every(function (value, index) { return value === b[index]; });
  }
  function effectiveStudentStatus(student) {
    return student && student.registrationCancelled === true ? 'cancelled' : (text(student && student.enrollmentStatus) || 'active');
  }
  function teacherOptionsHtml(selectedUid) {
    return '<option value="">강사 선택</option>' + teachers.map(function (item) {
      return '<option value="' + escapeHtml(item.instructorUid) + '"' + (item.instructorUid === selectedUid ? ' selected' : '') + '>' + escapeHtml(item.instructorName + 'T') + '</option>';
    }).join('');
  }
  function timeSlotsHtml() {
    const slots = [];
    for (let hour = 10; hour < 22; hour += 1) {
      slots.push('<label class="ulim-time-slot"><input type="checkbox" value="' + hour + '"><span>' + String(hour).padStart(2, '0') + ':00~' + String(hour + 1).padStart(2, '0') + ':00</span></label>');
    }
    return slots.join('');
  }
  function selectedClassHours() {
    return Array.from(document.querySelectorAll('#ulimClassTimeSlots7354 input[type="checkbox"]:checked'))
      .map(function (input) { return Number(input.value); }).filter(Number.isInteger).sort(function (a, b) { return a - b; });
  }
  function contiguousHours(hours) {
    for (let index = 1; index < hours.length; index += 1) if (hours[index] !== hours[index - 1] + 1) return false;
    return true;
  }
  function classPreviewText() {
    const instructorUid = text(document.getElementById('ulimClassInstructor7354') && document.getElementById('ulimClassInstructor7354').value);
    const teacher = teachers.find(function (item) { return item.instructorUid === instructorUid; }) || {};
    const baseName = text(document.getElementById('ulimClassBaseName7354') && document.getElementById('ulimClassBaseName7354').value);
    const hours = selectedClassHours();
    if (!teacher.instructorName || !baseName || !hours.length || !contiguousHours(hours)) return '';
    return '[' + teacher.instructorName + 'T] - ' + baseName + ' ' + String(hours[0]).padStart(2, '0') + ':00 ~ ' + String(hours[hours.length - 1] + 1).padStart(2, '0') + ':00';
  }
  function updateClassPreview7354() {
    const preview = document.getElementById('ulimClassPreview7354');
    const hours = selectedClassHours();
    if (preview) preview.value = classPreviewText() || (hours.length && !contiguousHours(hours) ? '시간을 연속으로 선택해주세요.' : '');
  }
  function renderClassManagerList7354() {
    const wrap = document.getElementById('ulimClassCatalogList7354');
    if (!wrap) return;
    if (!classes.length) { wrap.innerHTML = '<div style="font-size:12px;color:#64748b;">등록된 반이 없습니다.</div>'; return; }
    wrap.innerHTML = classes.map(function (item) {
      const group=text(item.audienceGroup);
      return `<div class="ulim-class-catalog-row"><span class="ulim-class-catalog-name7355038">${escapeHtml(item.className)}</span><select class="ulim-class-audience7355038" id="ulimClassAudienceExisting7355038_${escapeHtml(item.classId)}"><option value="adult"${group==='adult'?' selected':''}>성인반</option><option value="youth"${group==='youth'?' selected':''}>청소년반</option></select><button type="button" class="admin-btn" onclick="ulimClassAudienceSave7355038('${escapeHtml(item.classId)}')">구분 저장</button><button type="button" class="admin-btn" onclick="ulimClassCatalogRetire7354('${escapeHtml(item.classId)}')">사용중지</button></div>`;
    }).join('');
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
      syncBadge('앱운영', student.operationalSyncState || 'complete', student.operationalSyncMessage) +
      syncBadge('명단', student.sheetSyncState, student.sheetSyncMessage) +
      syncBadge('로그인', student.authSyncState, student.authSyncMessage) +
      syncBadge('출석부', student.attendanceSyncState, student.attendanceSyncMessage) +
      '</div>';
  }
  function injectStyles() {
    if (document.getElementById('ulimStudentManagementStyle7355002')) return;
    const style = document.createElement('style');
    style.id = 'ulimStudentManagementStyle7355002';
    style.textContent = `
      #${CARD_ID}{margin-bottom:16px}#${CARD_ID} .ulim-student-help{padding:12px 14px;border-radius:12px;background:#eff6ff;color:#1e3a8a;font-size:13px;line-height:1.6;margin-bottom:12px}
      #${STATUS_ID}{display:none;white-space:pre-line;padding:11px 13px;border-radius:10px;margin:10px 0;font-size:13px;font-weight:700;position:relative;z-index:4}#${STATUS_ID}[data-state="ok"]{display:block;background:#ecfdf5;color:#166534}#${STATUS_ID}[data-state="warn"]{display:block;background:#fffbeb;color:#92400e}#${STATUS_ID}[data-state="error"]{display:block;background:#fff1f2;color:#9f1239}#${STATUS_ID}[data-state="loading"]{display:block;background:#eff6ff;color:#1d4ed8}
      #${CARD_ID} .ulim-create-box{margin:14px 0;padding:14px;border:1px solid #bfdbfe;background:#f8fbff;border-radius:14px}#${CARD_ID} .ulim-create-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px}#${CARD_ID} .wide{grid-column:span 2}
      #${CARD_ID} .ulim-create-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}#${CARD_ID} .ulim-password-preview{margin-right:auto;padding:8px 10px;border-radius:9px;background:#fff7ed;color:#9a3412;font-size:12px;font-weight:800}
      #${CARD_ID} .ulim-time-slots{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:7px}#${CARD_ID} .ulim-time-slot{display:flex;align-items:center;gap:5px;padding:7px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:11px;cursor:pointer}#${CARD_ID} .ulim-time-slot input{width:auto}#${CARD_ID} .ulim-class-catalog-list{display:grid;gap:6px;max-height:280px;overflow:auto}#${CARD_ID} .ulim-class-catalog-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:9px;background:#fff;font-size:12px}#${CARD_ID} .ulim-class-catalog-row span{font-weight:700}#${CARD_ID} .ulim-class-catalog-name7355038{flex:1 1 420px;min-width:240px}#${CARD_ID} .ulim-class-audience7355038{width:150px;flex:0 0 150px}#${CARD_ID} .ulim-audience-meta7355038{margin-top:4px;font-size:10px;color:#64748b;white-space:nowrap}
      #${CARD_ID} .ulim-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 160px auto;gap:10px;align-items:end;margin:14px 0}#${CARD_ID} .ulim-toolbar-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
      #${CARD_ID} .ulim-table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px}#${CARD_ID} table{width:100%;min-width:1940px;border-collapse:collapse;background:#fff}#${CARD_ID} th{position:sticky;top:0;z-index:2;background:#f8fafc;color:#334155;font-size:12px;padding:9px;border-bottom:1px solid #cbd5e1;white-space:nowrap}#${CARD_ID} td{padding:7px;border-bottom:1px solid #edf2f7;vertical-align:top}#${CARD_ID} td input,#${CARD_ID} td select,#${CARD_ID} .ulim-create-grid input,#${CARD_ID} .ulim-create-grid select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:#fff;font-size:12px}#${CARD_ID} td select[multiple]{min-width:260px}
      #${CARD_ID} tr.ulim-dirty-row{background:#fffbea}#${CARD_ID} tr.ulim-saving-row{opacity:.58}#${CARD_ID} .ulim-operation-note{font-size:10px;color:#64748b;line-height:1.45;margin-top:4px;max-width:180px}#${CARD_ID} .ulim-student-uid{margin-top:4px;font-size:10px;color:#94a3b8}#${CARD_ID} .ulim-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;max-width:310px}#${CARD_ID} .ulim-student-class-tag{display:inline-flex;padding:3px 7px;border-radius:999px;background:#dbeafe;color:#1e40af;font-size:10px;font-weight:800}#${CARD_ID} .ulim-student-class-tag.legacy{background:#fef3c7;color:#92400e}#${CARD_ID} .ulim-student-empty-tag{font-size:10px;color:#94a3b8}
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
      <div class="ulim-student-help"><b>앱 운영 원본은 학생명단입니다.</b> 학생정보와 수강반을 저장하면 출석부와 태블릿에 즉시 반영됩니다. Google Sheets는 매일 오전 6시 백업으로만 갱신됩니다.</div>
      <div id="${STATUS_ID}"></div>
      
            <details class="ulim-create-box" open><summary style="cursor:pointer;font-weight:900;color:#1e3a8a;">학생 추가</summary>
        <div id="${CREATE_FORM_ID}" class="ulim-create-grid" style="margin-top:12px;">
          <div class="admin-field"><label>학생명 *</label><input id="ulimNewStudentName7352" autocomplete="off"></div>
          <div class="admin-field"><label>생년월일</label><input id="ulimNewStudentBirth7352" type="date"></div>
          <div class="admin-field"><label>학생 전화번호 *</label><input id="ulimNewStudentPhone7352" inputmode="tel" autocomplete="off"></div>
          <div class="admin-field"><label>보호자 전화번호</label><input id="ulimNewStudentParent7352" inputmode="tel" autocomplete="off"></div>
          <div class="admin-field"><label>재원상태</label><select id="ulimNewStudentStatus7352"><option value="active">재원</option><option value="leave">휴원</option><option value="withdrawn">퇴원</option></select></div>
          <div class="admin-field"><label>수강 시작일</label><input id="ulimNewStudentStart7352" type="date" value="${today()}"></div>
          <div class="admin-field"><label>등록 구분</label><select id="ulimNewStudentType7352"><option value="new">신규</option><option value="existing">기존등록</option></select></div>
          <div class="admin-field"><label>관리자 메모</label><input id="ulimNewStudentMemo7352"></div>
          <div class="admin-field wide"><label>수강반 (복수선택)</label><select id="ulimNewStudentClasses7352" multiple size="6"></select><div id="ulimNewStudentTags7352" class="ulim-tags"></div></div>
          <div class="admin-field wide"><label>담당강사 자동 연결</label><input id="ulimNewStudentInstructors7352" readonly placeholder="수강반을 선택하면 표시됩니다."></div>
        </div>
        <div class="ulim-create-actions"><span id="ulimNewStudentPassword7352" class="ulim-password-preview">출결번호·최초 비밀번호: 전화번호 마지막 네 자리</span><button type="button" class="admin-btn blue" onclick="ulimStudentManagementCreate7352()">학생 추가</button></div>
      </details>
<details class="ulim-create-box"><summary style="cursor:pointer;font-weight:900;color:#7c3aed;">운영 반 목록 관리</summary>
        <div style="margin:12px 0;padding:11px 13px;border-radius:10px;background:#f5f3ff;color:#5b21b6;font-size:12px;line-height:1.55;"><b>강의실은 반에 고정 저장하지 않습니다.</b> 당일 강의실 사용일지의 날짜·시간·담당강사로 출석부·태블릿·알림톡에 반영됩니다.</div>
        <div class="ulim-create-grid" style="margin-top:12px;">
          <div class="admin-field"><label>담당강사 *</label><select id="ulimClassInstructor7354"></select></div>
          <div class="admin-field wide"><label>반명 *</label><input id="ulimClassBaseName7354" placeholder="목요일 연기기초"></div>
          <div class="admin-field"><label>반 구분</label><select id="ulimClassAudience7355038"><option value="">자동(반명 기준)</option><option value="adult">성인반</option><option value="youth">청소년반</option></select></div>
          <div class="admin-field wide"><label>수업시간 (복수·연속선택)</label><div id="ulimClassTimeSlots7354" class="ulim-time-slots">${timeSlotsHtml()}</div></div>
          <div class="admin-field wide"><label>생성될 반명</label><input id="ulimClassPreview7354" readonly></div>
          <div class="admin-field wide"><label>현재 사용 중인 반</label><div id="ulimClassCatalogList7354" class="ulim-class-catalog-list"></div></div>
        </div>
        <div class="ulim-create-actions"><button type="button" class="admin-btn" onclick="ulimStudentManagementReloadClasses7352()">반 목록 새로고침</button><button type="button" class="admin-btn blue" onclick="ulimClassCatalogSave7354()">반 추가</button></div>
      </details>
      <details class="ulim-create-box"><summary style="cursor:pointer;font-weight:900;color:#166534;">앱 수강신청 기간·모집반 설정</summary>
        <div class="ulim-create-grid" style="margin-top:12px;">
          <div class="admin-field"><label>신청 대상월</label><input id="ulimCourseWindowMonth7352" type="month"></div>
          <div class="admin-field"><label>신청 시작</label><input id="ulimCourseWindowOpen7352" type="datetime-local"></div>
          <div class="admin-field"><label>신청 종료</label><input id="ulimCourseWindowClose7352" type="datetime-local"></div>
          <div class="admin-field"><label>학생 화면 표시</label><select id="ulimCourseWindowActive7352"><option value="true">열기</option><option value="false">닫기</option></select></div>
          <div class="admin-field wide"><label>모집반(복수선택)</label><select id="ulimCourseWindowClasses7352" multiple size="7"></select></div>
          <div class="admin-field wide"><label>학생 안내문</label><input id="ulimCourseWindowNotice7352" placeholder="수강신청 및 반 이동 신청을 받습니다."></div>
        </div>
        <div class="ulim-create-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentManagementWindow7352()">수강신청 설정 저장 · 게시</button></div>
      </details>
      <div class="ulim-toolbar">
        <div class="admin-field"><label>학생 검색</label><input id="${FILTER_ID}" placeholder="학생명 · 출결번호 · 전화번호 · 반 · 강사"></div>
        <div class="admin-field"><label>재원상태</label><select id="${STATUS_FILTER_ID}"><option value="">전체</option><option value="active">재원</option><option value="leave">휴원</option><option value="withdrawn">퇴원</option><option value="cancelled">등록취소</option></select></div>
        <div class="ulim-toolbar-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentManagementLoad7352()">목록 새로고침</button><button type="button" class="admin-btn orange" id="ulimStudentManagementSaveAll7352" onclick="ulimStudentManagementSaveAll7352()">변경사항 전체 저장</button></div>
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
        else global.ulimStudentManagementLoad7352();
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
      studentUid: text(student.studentUid), name: text(student.name), birthDate: text(student.birthDate),
      audienceGroup: text(student.audienceGroup), audienceGroupAuto: text(student.audienceGroupAuto), audienceGroupOverride: text(student.audienceGroupOverride), audienceGroupSource: text(student.audienceGroupSource),
      studentPhone: text(student.studentPhone), parentPhone: text(student.parentPhone), attendanceNo: text(student.attendanceNo),
      enrollmentStatus: text(student.enrollmentStatus) || 'active', registrationCancelled: student.registrationCancelled === true,
      initialRegisteredDate: text(student.initialRegisteredDate), privacyConsent: student.privacyConsent === true,
      portraitConsent: student.portraitConsent === true, mustChangePassword: student.mustChangePassword !== false,
      memo: text(student.memo), selectedClassIds: unique(student.selectedClassIds),
      legacyUnmappedClassNames: unique(student.legacyUnmappedClassNames), instructorNames: unique(student.instructorNames),
      dataSaveState: text(student.dataSaveState) || 'complete', sheetSyncState: 'backup_0600', sheetSyncMessage: '매일 오전 6시 백업',
      authSyncState: text(student.authSyncState) || 'complete', authSyncMessage: text(student.authSyncMessage),
      attendanceSyncState: text(student.attendanceSyncState) || 'complete', attendanceSyncMessage: text(student.attendanceSyncMessage),
      operationalSyncState: text(student.operationalSyncState) || 'complete', operationalSyncMessage: text(student.operationalSyncMessage),
      retryable: student.retryable === true, relationSource: text(student.relationSource) || 'studentEnrollments'
    };
  }
  function renderCreateClasses() {
    const select = document.getElementById('ulimNewStudentClasses7352');
    if (select) { const selected = selectedValues(select); select.innerHTML = classOptionsHtml(selected); }
    const applicationSelect = document.getElementById('ulimCourseWindowClasses7352');
    if (applicationSelect) { const selected = selectedValues(applicationSelect); applicationSelect.innerHTML = classOptionsHtml(selected); }
    const instructorSelect = document.getElementById('ulimClassInstructor7354');
    if (instructorSelect) { const selected = text(instructorSelect.value); instructorSelect.innerHTML = teacherOptionsHtml(selected); }
    const monthInput = document.getElementById('ulimCourseWindowMonth7352');
    if (monthInput && !monthInput.value) monthInput.value = currentMonth();
    renderClassManagerList7354(); updateClassPreview7354(); updateCreateClassPreview();
  }


  function updateCreateClassPreview() {
    const select = document.getElementById('ulimNewStudentClasses7352');
    const ids = selectedValues(select);
    const tags = document.getElementById('ulimNewStudentTags7352');
    const instructors = document.getElementById('ulimNewStudentInstructors7352');
    if (tags) tags.innerHTML = tagsHtml(ids, []);
    if (instructors) instructors.value = instructorText(ids, []);
  }

  function updatePasswordPreview() {
    const phone = text(document.getElementById('ulimNewStudentPhone7352') && document.getElementById('ulimNewStudentPhone7352').value);
    const digits = phone.replace(/\D/g, '');
    const preview = document.getElementById('ulimNewStudentPassword7352');
    if (!preview) return;
    preview.textContent = digits.length >= 4 ? '최초 비밀번호: 출결번호 ' + digits.slice(-4) : '최초 비밀번호: 학생 저장 후 확정된 출결번호 4자리';
  }
  function rowData(key) {
    const uid = rowKeyMap.get(key) || '';
    const current = students.find(function (student) { return student.studentUid === uid; }) || {};
    let classIds = selectedValues(document.getElementById(key + '_classes'));
    const originalClassIds = unique(current.selectedClassIds);
    const registrationType = text(document.getElementById(key + '_operation') && document.getElementById(key + '_operation').value) || 'existing';
    // "신규 추가"는 membership 추가 전용입니다. 기존 반을 실수로 해제하지 않습니다.
    if (registrationType === 'new') classIds = unique(originalClassIds.concat(classIds));
    return {
      studentUid: uid,
      attendanceNo: text(document.getElementById(key + '_attendance_no') && document.getElementById(key + '_attendance_no').value).replace(/\D/g, ''),
      changeAttendanceNo: text(document.getElementById(key + '_attendance_no') && document.getElementById(key + '_attendance_no').value).replace(/\D/g, '') !== text(current.attendanceNo).replace(/\D/g, ''),
      name: text(document.getElementById(key + '_name') && document.getElementById(key + '_name').value),
      birthDate: text(document.getElementById(key + '_birth') && document.getElementById(key + '_birth').value),
      audienceGroupOverride: text(document.getElementById(key + '_audience') && document.getElementById(key + '_audience').value),
      studentPhone: text(document.getElementById(key + '_phone') && document.getElementById(key + '_phone').value),
      parentPhone: text(document.getElementById(key + '_parent') && document.getElementById(key + '_parent').value),
      enrollmentStatus: text(document.getElementById(key + '_status') && document.getElementById(key + '_status').value) || 'active',
      initialRegisteredDate: text(document.getElementById(key + '_start') && document.getElementById(key + '_start').value),
      operationDate: text(document.getElementById(key + '_operation_date') && document.getElementById(key + '_operation_date').value),
      classIds: classIds, originalClassIds: originalClassIds, replaceClassAssignments: !sameTextSet(classIds, originalClassIds),
      registrationType: registrationType, memo: text(document.getElementById(key + '_memo') && document.getElementById(key + '_memo').value),
      privacyConsent: current.privacyConsent === true, portraitConsent: current.portraitConsent === true,
      preserveLegacyClassNames: unique(current.legacyUnmappedClassNames)
    };
  }
  function audienceLabel7355038(value) { return value === 'adult' ? '성인' : value === 'youth' ? '청소년' : '미분류'; }
  function audienceSourceLabel7355038(student) { return student && student.audienceGroupSource === 'manual' ? '관리자' : (student && student.audienceGroupSource === 'auto_birth_year' ? '자동' : '자동'); }
  function audienceSelectHtml7355038(student, key, disabled) {
    const override=text(student && student.audienceGroupOverride);
    return '<select id="'+key+'_audience" data-row-key="'+key+'"'+(disabled?' disabled':'')+'><option value=""'+(!override?' selected':'')+'>자동</option><option value="adult"'+(override==='adult'?' selected':'')+'>성인</option><option value="youth"'+(override==='youth'?' selected':'')+'>청소년</option></select><div class="ulim-audience-meta7355038">현재 '+audienceLabel7355038(text(student&&student.audienceGroup))+' · '+audienceSourceLabel7355038(student)+'</div>';
  }
  function render() {
    const wrap = document.getElementById(TABLE_ID); if (!wrap) return; rowKeyMap.clear();
    if (!filtered.length) { wrap.innerHTML = '<div style="padding:18px;color:#64748b;">조건에 맞는 학생이 없습니다.</div>'; updateSummary(); return; }
    const rows = filtered.map(function (student) {
      const key = safeKey(student.studentUid); const cancelled = student.registrationCancelled === true;
      const rowClass = [dirtyKeys.has(key) ? 'ulim-dirty-row' : '', cancelled ? 'ulim-cancelled-row' : ''].filter(Boolean).join(' ');
      const teacherNames = instructorText(student.selectedClassIds, student.instructorNames);
      const statusSelect = cancelled ? '<select disabled><option selected>등록취소</option></select>' : '<select id="' + key + '_status" data-row-key="' + key + '"><option value="active"' + (student.enrollmentStatus === 'active' ? ' selected' : '') + '>재원</option><option value="leave"' + (student.enrollmentStatus === 'leave' ? ' selected' : '') + '>휴원</option><option value="withdrawn"' + (student.enrollmentStatus === 'withdrawn' ? ' selected' : '') + '>퇴원</option></select>';
      return `<tr${rowClass ? ' class="' + rowClass + '"' : ''} data-row-key="${key}" data-student-uid="${escapeHtml(student.studentUid)}">
        <td>${statusSelect}</td><td><input id="${key}_attendance_no" data-row-key="${key}" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="${escapeHtml(student.attendanceNo)}"><div class="ulim-student-uid">UID ${escapeHtml(maskedUid(student.studentUid))}</div></td>
        <td><input id="${key}_name" data-row-key="${key}" value="${escapeHtml(student.name)}"></td><td><input id="${key}_birth" type="date" data-row-key="${key}" value="${escapeHtml(student.birthDate)}"></td>
        <td>${audienceSelectHtml7355038(student,key,cancelled)}</td>
        <td><input id="${key}_phone" data-row-key="${key}" value="${escapeHtml(student.studentPhone)}"></td><td><input id="${key}_parent" data-row-key="${key}" value="${escapeHtml(student.parentPhone)}"></td>
        <td><input id="${key}_start" type="date" data-row-key="${key}" value="${escapeHtml(student.initialRegisteredDate)}"></td>
        <td><select id="${key}_operation" data-row-key="${key}"${cancelled ? ' disabled' : ''}><option value="existing">일반 수정</option><option value="new">신규 추가</option><option value="class_move">반이동</option></select><div id="${key}_operation_note" class="ulim-operation-note">수강반을 수정하면 출석부·태블릿에 즉시 반영됩니다.</div></td>
        <td><input id="${key}_operation_date" type="date" data-row-key="${key}"${cancelled ? ' disabled' : ''}></td>
        <td><select id="${key}_classes" data-row-key="${key}" multiple size="4"${cancelled ? ' disabled' : ''}>${classOptionsHtml(student.selectedClassIds)}</select><div id="${key}_tags" class="ulim-tags">${tagsHtml(student.selectedClassIds, student.legacyUnmappedClassNames)}</div></td>
        <td><input id="${key}_instructors" value="${escapeHtml(teacherNames)}" readonly></td><td><input id="${key}_memo" data-row-key="${key}" value="${escapeHtml(student.memo)}"></td>
        <td>${studentSyncHtml(student)}</td><td><div class="ulim-row-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentManagementSaveRow7352('${key}')">저장</button>${student.retryable ? `<button type="button" class="admin-btn" onclick="ulimStudentManagementRetry7352('${key}')">로그인 재시도</button>` : ''}<button type="button" class="admin-btn" onclick="ulimStudentFirebasePasswordReset7355030('${key}')">비밀번호 초기화</button><button type="button" class="admin-btn" onclick="ulimStudentManagementRetire7352('${key}','withdraw')">퇴원</button><button type="button" class="admin-btn red" onclick="ulimStudentManagementRetire7352('${key}','cancel')">등록취소</button></div></td>
      </tr>`;
    }).join('');
    wrap.innerHTML = `<table><thead><tr><th>재원상태</th><th>출결번호/UID</th><th>학생명</th><th>생년월일</th><th>구분</th><th>학생전화</th><th>보호자전화</th><th>최초 등록일</th><th>처리구분</th><th>처리일</th><th>수강반</th><th>담당강사</th><th>관리자 메모</th><th>저장상태</th><th>관리</th></tr></thead><tbody>${rows}</tbody></table>`; updateSummary();
  }
  function updateRowClassPreview(key) {
    const ids = selectedValues(document.getElementById(key + '_classes'));
    const student = students.find(function (item) { return item.studentUid === (rowKeyMap.get(key) || ''); }) || {};
    const tags = document.getElementById(key + '_tags'); const instructors = document.getElementById(key + '_instructors');
    if (tags) tags.innerHTML = tagsHtml(ids, student.legacyUnmappedClassNames || []);
    if (instructors) instructors.value = instructorText(ids, student.instructorNames || []);
  }
  function handleOperationModeChange(key) {
    const modeEl = document.getElementById(key + '_operation'); const dateEl = document.getElementById(key + '_operation_date'); const note = document.getElementById(key + '_operation_note');
    const mode = text(modeEl && modeEl.value) || 'existing';
    if ((mode === 'class_move' || mode === 'new') && dateEl && !dateEl.value) dateEl.value = today();
    if (note) note.textContent = mode === 'class_move'
      ? '처리일부터 기존 반을 종료하고 선택한 새 반으로 이동합니다.'
      : (mode === 'new'
          ? '처리일부터 선택한 새 반을 추가합니다. 기존 수강반은 유지됩니다.'
          : '선택한 반목록을 현재 수강반으로 저장합니다. 신규·반이동 표시 없이 즉시 반영됩니다.');
    updateRowClassPreview(key);
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
      if (wantedStatus && effectiveStudentStatus(student) !== wantedStatus) return false;
      if (!keyword) return true;
      const classNames = selectedClassDetails(student.selectedClassIds).map(function (item) { return item.className; });
      return normalize([student.name, student.attendanceNo, student.studentPhone, student.parentPhone, student.birthDate, classNames.join(' '), student.instructorNames.join(' '), student.memo].join(' ')).indexOf(keyword) >= 0;
    }); render();
  }
  function updateSummary() {
    const summary = document.getElementById(SUMMARY_ID); if (!summary) return;
    const count = function (status) { return filtered.filter(function (student) { return effectiveStudentStatus(student) === status; }).length; };
    summary.textContent = '표시 ' + filtered.length + '명 / 전체 ' + students.length + '명 · 재원 ' + count('active') + ' · 휴원 ' + count('leave') + ' · 퇴원 ' + count('withdrawn') + ' · 등록취소 ' + count('cancelled') + ' · 운영반 ' + classes.length + '개 · 저장 대기 ' + dirtyKeys.size + '명';
    const button = document.getElementById('ulimStudentManagementSaveAll7352'); if (button) button.textContent = dirtyKeys.size ? '변경사항 전체 저장 (' + dirtyKeys.size + ')' : '변경사항 전체 저장';
  }
  async function load(forceDiscardDirty) {
    if (!isSuperAdmin()) { setStatus('학생정보 관리는 전체관리자만 사용할 수 있습니다.', 'error'); return false; }
    if (loadingPromise) return loadingPromise;
    if (!forceDiscardDirty && dirtyKeys.size && !confirm('저장하지 않은 학생 수정사항이 ' + dirtyKeys.size + '명 있습니다. 목록을 다시 불러오면 사라집니다. 계속할까요?')) return false;
    loadingPromise = (async function () {
      setStatus('학생정보와 운영 반 목록을 불러오는 중...', 'loading');
      const result = await call('listStudentManagementAdmin7352', { requestId: requestId('student-list-7355016') });
      classes = (Array.isArray(result.classes) ? result.classes : []).map(function (item) { return { classId:text(item.classId), className:text(item.className), instructorUid:text(item.instructorUid), instructorName:text(item.instructorName), audienceGroup:text(item.audienceGroup), selectable:item.selectable!==false, baseName:text(item.baseName), weekday:Number(item.weekday), startTime:text(item.startTime), endTime:text(item.endTime), timeSlots:Array.isArray(item.timeSlots)?item.timeSlots.map(Number):[] }; }).filter(function (item) { return item.classId && item.className; });
      teachers = (Array.isArray(result.teachers) ? result.teachers : []).map(function (item) { return { instructorUid:text(item.instructorUid), instructorName:text(item.instructorName) }; }).filter(function (item) { return item.instructorUid && item.instructorName; });
      students = (Array.isArray(result.students) ? result.students : []).map(normalizeStudent); filtered = students.slice(); dirtyKeys.clear(); renderCreateClasses(); render(); publishDirectory7355016('student-list-load', { studentCount: students.length, classCount: classes.length });
      const hidden = Number(result.hiddenIncomplete || 0); setStatus('학생 ' + students.length + '명과 운영 반 ' + classes.length + '개를 불러왔습니다.' + (hidden ? '\n정보가 불완전한 문서 ' + hidden + '건은 제외했습니다.' : ''), hidden ? 'warn' : 'ok'); return true;
    })().catch(function (error) { setStatus(friendlyError7355016(error, '학생정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'), 'error'); return false; }).finally(function () { loadingPromise = null; });
    return loadingPromise;
  }
  async function reloadClasses() {
    try {
      showLoading('운영 반 목록을 다시 불러오는 중...');
      const result = await call('getStudentClassCatalogAdmin7352', { requestId: requestId('class-list-7355016') });
      classes = (Array.isArray(result.classes) ? result.classes : []).map(function (item) { return { classId:text(item.classId), className:text(item.className), instructorUid:text(item.instructorUid), instructorName:text(item.instructorName), audienceGroup:text(item.audienceGroup), selectable:item.selectable!==false, baseName:text(item.baseName), weekday:Number(item.weekday), startTime:text(item.startTime), endTime:text(item.endTime), timeSlots:Array.isArray(item.timeSlots)?item.timeSlots.map(Number):[] }; });
      teachers = (Array.isArray(result.teachers) ? result.teachers : teachers).map(function (item) { return { instructorUid:text(item.instructorUid), instructorName:text(item.instructorName) }; }).filter(function (item) { return item.instructorUid && item.instructorName; });
      renderCreateClasses(); if (!dirtyKeys.size) render(); dispatchClassCatalogChanged7355016('class-catalog-reload', { classCount: classes.length }); setStatus('운영 반 ' + classes.length + '개를 다시 불러왔습니다.', 'ok');
    } catch (error) { setStatus(text(error && error.message) || '반 목록을 불러오지 못했습니다.', 'error'); } finally { hideLoading(); }
  }


  function createInput() {
    return {
      name: text(document.getElementById('ulimNewStudentName7352') && document.getElementById('ulimNewStudentName7352').value),
      birthDate: text(document.getElementById('ulimNewStudentBirth7352') && document.getElementById('ulimNewStudentBirth7352').value),
      studentPhone: text(document.getElementById('ulimNewStudentPhone7352') && document.getElementById('ulimNewStudentPhone7352').value),
      parentPhone: text(document.getElementById('ulimNewStudentParent7352') && document.getElementById('ulimNewStudentParent7352').value),
      enrollmentStatus: text(document.getElementById('ulimNewStudentStatus7352') && document.getElementById('ulimNewStudentStatus7352').value) || 'active',
      startDate: text(document.getElementById('ulimNewStudentStart7352') && document.getElementById('ulimNewStudentStart7352').value),
      registrationType: text(document.getElementById('ulimNewStudentType7352') && document.getElementById('ulimNewStudentType7352').value) || 'new',
      classIds: selectedValues(document.getElementById('ulimNewStudentClasses7352')),
      memo: text(document.getElementById('ulimNewStudentMemo7352') && document.getElementById('ulimNewStudentMemo7352').value),
      requestId: requestId('student-create-7352')
    };
  }
  function validateInput(input) {
    if (!input.name) return '학생명을 입력해주세요.';
    if (Object.prototype.hasOwnProperty.call(input, 'attendanceNo') && !/^\d{4}$/.test(String(input.attendanceNo || ''))) return '출결번호는 숫자 4자리로 입력해주세요.';
    if (String(input.studentPhone || '').replace(/\D/g, '').length < 4) return '학생 전화번호를 정확히 입력해주세요.';
    return '';
  }
  async function createStudent() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const input = createInput(); const error = validateInput(input); if (error) return alert(error);
    if (!confirm(input.name + ' 학생을 추가할까요?')) return;
    try {
      showLoading('학생정보를 저장하는 중...'); const result = await call('createStudentAdmin7352', input);
      const created = normalizeStudent({ studentUid:text(result.studentUid), name:input.name, birthDate:input.birthDate, studentPhone:input.studentPhone, parentPhone:input.parentPhone, attendanceNo:text(result.attendanceNo), enrollmentStatus:input.enrollmentStatus, initialRegisteredDate:input.startDate, memo:input.memo, selectedClassIds:unique(input.classIds), instructorNames:selectedClassDetails(input.classIds).map(function (item) { return item.instructorName; }), authSyncState:'pending' });
      if (created.studentUid) students = [created].concat(students.filter(function (item) { return item.studentUid !== created.studentUid; }));
      const form = document.getElementById(CREATE_FORM_ID); if (form) form.querySelectorAll('input').forEach(function (el) { el.value = ''; });
      const start = document.getElementById('ulimNewStudentStart7352'); if (start) start.value = today(); const classSelect = document.getElementById('ulimNewStudentClasses7352'); if (classSelect) Array.from(classSelect.options).forEach(function (option) { option.selected = false; });
      updateCreateClassPreview(); updatePasswordPreview(); applyFilter();
      dispatchRosterChanged7355016('student-created', { studentUids: created.studentUid ? [created.studentUid] : [] });
      setStatus(input.name + ' 학생을 추가했습니다.\n출결번호: ' + text(result.attendanceNo) + '\n최초 비밀번호: ' + text(result.initialPassword) + '\n출석부·태블릿에 즉시 반영됩니다. 시트는 오전 6시에 백업됩니다.', 'ok');
    } catch (error2) { setStatus(text(error2 && error2.message) || '학생을 추가하지 못했습니다.', 'error'); alert(text(error2 && error2.message) || '학생을 추가하지 못했습니다.'); } finally { hideLoading(); }
  }
  async function saveKeys(keys) {
    const selectedKeys = unique(keys).filter(function (key) { return rowKeyMap.has(key); }); const edits = selectedKeys.map(rowData); if (!edits.length) return alert('수정된 학생정보가 없습니다.');
    for (const edit of edits) { const error = validateInput(edit); if (error) return alert(edit.name + ': ' + error); if ((edit.registrationType === 'class_move' || edit.registrationType === 'new') && !edit.operationDate) return alert(edit.name + ': 처리일을 선택해주세요.'); }
    if (!confirm('학생 ' + edits.length + '명의 변경사항을 저장할까요?\n수강반 변경은 출석부와 태블릿에 즉시 반영됩니다.')) return;
    selectedKeys.forEach(function (key) { const row=document.querySelector('tr[data-row-key="'+key+'"]'); if(row) row.classList.add('ulim-saving-row'); });
    try {
      showLoading('학생정보 ' + edits.length + '명 저장 중...'); let result;
      if (edits.length === 1) result={results:[await call('updateStudentAdmin7352', Object.assign({},edits[0],{requestId:requestId('student-update-7355016')}))]};
      else result=await call('updateStudentsBatchAdmin7352',{edits:edits,requestId:requestId('student-batch-7355016')});
      const results=Array.isArray(result.results)?result.results:[]; const failed=results.filter(function(item){return item.ok===false;}); const succeeded=new Set(results.filter(function(item){return item.ok!==false;}).map(function(item){return text(item.studentUid);}));
      edits.forEach(function (edit) { if (results.length && !succeeded.has(edit.studentUid)) return; const student=students.find(function(item){return item.studentUid===edit.studentUid;}); if(student){student.attendanceNo=edit.attendanceNo;student.studentNo=edit.attendanceNo;student.name=edit.name;student.birthDate=edit.birthDate;student.audienceGroupOverride=edit.audienceGroupOverride;student.audienceGroup=edit.audienceGroupOverride||student.audienceGroupAuto||'';student.audienceGroupSource=edit.audienceGroupOverride?'manual':(student.audienceGroupAuto?'auto_birth_year':'unclassified');student.studentPhone=edit.studentPhone;student.parentPhone=edit.parentPhone;student.enrollmentStatus=edit.enrollmentStatus;student.initialRegisteredDate=edit.initialRegisteredDate;student.memo=edit.memo;student.selectedClassIds=unique(edit.classIds);student.classNames=selectedClassDetails(edit.classIds).map(function(item){return item.className;}).filter(Boolean);student.instructorNames=selectedClassDetails(edit.classIds).map(function(item){return item.instructorName;}).filter(Boolean);student.sheetSyncState='backup_0600';student.sheetSyncMessage='매일 오전 6시 백업';student.retryable=false;} const key=selectedKeys.find(function(candidate){return (rowKeyMap.get(candidate)||'')===edit.studentUid;}); if(key) dirtyKeys.delete(key); });
      applyFilter(); dispatchRosterChanged7355016('student-updated', { studentUids: edits.map(function(edit){return edit.studentUid;}) });
      if(failed.length) setStatus('저장 완료 후 확인이 필요한 학생이 '+failed.length+'명 있습니다.\n'+failed.slice(0,5).map(function(item){return text(item.message);}).join('\n'),'warn'); else setStatus('학생정보 '+edits.length+'명의 변경사항을 저장했습니다. 출석부·태블릿에 즉시 반영되며 시트는 오전 6시에 백업됩니다.','ok');
    } catch(error){setStatus(text(error&&error.message)||'학생정보를 저장하지 못했습니다.','error');alert(text(error&&error.message)||'학생정보를 저장하지 못했습니다.');}
    finally{selectedKeys.forEach(function(key){const row=document.querySelector('tr[data-row-key="'+key+'"]');if(row)row.classList.remove('ulim-saving-row');});hideLoading();updateSummary();}
  }


  async function saveRow(key) { return saveKeys([key]); }
  async function saveAll() { return saveKeys(Array.from(dirtyKeys)); }

  async function retry(key) {
    const studentUid = rowKeyMap.get(key) || '';
    if (!studentUid) return;
    try {
      showLoading('연동 작업을 다시 요청하는 중...');
      const result = await call('retryStudentOperationAdmin7352', { studentUid: studentUid, requestId: requestId('student-retry-7352') });
      await load(true);
      setStatus(text(result.message) || '연동 작업을 다시 요청했습니다.', 'ok');
    } catch (error) {
      setStatus(text(error && error.message) || '재시도 요청에 실패했습니다.', 'error');
    } finally { hideLoading(); }
  }
  async function provisionStudentFirebaseAuthAll7355030() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    if (!confirm('현재 학생명단을 기준으로 학생 Firebase 로그인 계정을 전체동기화할까요?\n\n아이디: 학생명\n최초 비밀번호: 출결번호 4자리\n이미 개인 비밀번호를 변경한 학생은 비밀번호를 유지합니다.')) return;
    try {
      showLoading('학생 로그인 계정을 동기화하는 중...');
      const result = await call('provisionStudentsFirebaseDirectAuthAdmin7355030', {});
      if (Number(result.failed || 0) > 0) {
        setStatus('학생 로그인 계정 동기화: 성공 ' + Number(result.succeeded || 0) + '명 / 실패 ' + Number(result.failed || 0) + '명\n학생명과 출결번호를 확인해주세요.', 'warn');
      } else {
        setStatus('학생 로그인 계정 ' + Number(result.succeeded || 0) + '명을 Firebase Auth에 동기화했습니다.\n학생은 학생명 / 출결번호 4자리로 최초 로그인할 수 있습니다.', 'ok');
      }
      await load(true);
    } catch (error) {
      setStatus(text(error && error.message) || '학생 로그인 계정 전체동기화에 실패했습니다.', 'error');
      alert(text(error && error.message) || '학생 로그인 계정 전체동기화에 실패했습니다.');
    } finally { hideLoading(); }
  }

  async function resetStudentFirebasePassword7355030(key) {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const studentUid = rowKeyMap.get(key) || '';
    const student = students.find(function(item){ return item.studentUid === studentUid; }) || {};
    if (!studentUid) return;
    const no = text(student.attendanceNo).replace(/\D/g, '').slice(-4);
    if (!/^\d{4}$/.test(no)) return alert('출결번호가 4자리가 아닙니다. 출결번호를 먼저 저장해주세요.');
    if (!confirm(text(student.name) + ' 학생의 로그인 비밀번호를 현재 출결번호 ' + no + '로 초기화할까요?\n다음 로그인 후 학생이 새 비밀번호로 변경할 수 있습니다.')) return null;
    try {
      showLoading('학생 비밀번호 초기화 중...');
      const result = await call('resetStudentFirebasePasswordAdmin7355030', { studentUid: studentUid });
      setStatus(text(result.message) || '학생 비밀번호를 출결번호로 초기화했습니다.', 'ok');
      await load(true);
      return result || { ok:true, message:'학생 비밀번호를 출결번호로 초기화했습니다.' };
    } catch (error) {
      setStatus(text(error && error.message) || '학생 비밀번호 초기화에 실패했습니다.', 'error');
      alert(text(error && error.message) || '학생 비밀번호 초기화에 실패했습니다.');
      return null;
    } finally { hideLoading(); }
  }

  async function resetStudentPracticeDaily7355051(key, scope) {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const studentUid = rowKeyMap.get(key) || '';
    const student = students.find(function(item){ return item.studentUid === studentUid; }) || {};
    if (!studentUid) return alert('학생정보를 다시 불러와주세요.');
    const cleanScope = text(scope || 'all');
    const labels = { vocal:'발성훈련', standard:'표준발음', past:'기출문제', all:'발성훈련·표준발음·기출문제' };
    const label = labels[cleanScope] || labels.all;
    if (!confirm(text(student.name) + ' 학생의 ' + label + ' 오늘 사용제한을 초기화할까요?\n기존 연습기록과 장기 진도는 삭제하지 않습니다.')) return null;
    try {
      showLoading(label + ' 오늘 사용제한 초기화 중...');
      const result = await call('resetStudentPracticeDailyLimitsAdmin7355051', {
        studentUid: studentUid,
        scopes: cleanScope === 'all' ? ['vocal','standard','past'] : [cleanScope],
        requestId: requestId('practice-limit-reset-7355051')
      });
      setStatus(text(result.message) || (label + ' 오늘 사용제한을 초기화했습니다.'), 'ok');
      return result || { ok:true, message:label + ' 오늘 사용제한을 초기화했습니다.' };
    } catch (error) {
      setStatus(text(error && error.message) || (label + ' 오늘 사용제한 초기화에 실패했습니다.'), 'error');
      alert(text(error && error.message) || (label + ' 오늘 사용제한 초기화에 실패했습니다.'));
      return null;
    } finally { hideLoading(); }
  }

  function currentMonth() { return today().slice(0, 7); }


  async function saveClassCatalog7354() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const instructorUid=text(document.getElementById('ulimClassInstructor7354')&&document.getElementById('ulimClassInstructor7354').value); const baseName=text(document.getElementById('ulimClassBaseName7354')&&document.getElementById('ulimClassBaseName7354').value); const hours=selectedClassHours();
    if(!instructorUid)return alert('담당강사를 선택해주세요.'); if(!baseName)return alert('반명을 입력해주세요.'); if(!/(월요일|화요일|수요일|목요일|금요일|토요일|일요일)/.test(baseName))return alert('반명에 수업 요일을 포함해주세요.'); if(!hours.length||!contiguousHours(hours))return alert('수업시간을 연속으로 선택해주세요.');
    const preview=classPreviewText(); if(!confirm(preview+'\n\n이 반을 추가할까요?'))return;
    try{showLoading('반 목록에 추가하는 중...');const audienceGroup=text(document.getElementById('ulimClassAudience7355038')&&document.getElementById('ulimClassAudience7355038').value);const result=await call('saveClassCatalogAdmin7354',{instructorUid:instructorUid,baseName:baseName,hours:hours,audienceGroup:audienceGroup,requestId:requestId('class-save-7355016')});if(document.getElementById('ulimClassAudience7355038'))document.getElementById('ulimClassAudience7355038').value='';document.getElementById('ulimClassBaseName7354').value='';document.querySelectorAll('#ulimClassTimeSlots7354 input[type="checkbox"]').forEach(function(input){input.checked=false;});await reloadClasses();setStatus(text(result.message)||'반을 추가했습니다.','ok');}catch(error){setStatus(text(error&&error.message)||'반을 추가하지 못했습니다.','error');alert(text(error&&error.message)||'반을 추가하지 못했습니다.');}finally{hideLoading();}
  }
  async function saveClassAudience7355038(classId) {
    const item=classById(classId); if(!item)return; const select=document.getElementById('ulimClassAudienceExisting7355038_'+classId); const audienceGroup=text(select&&select.value);
    try{showLoading('반 구분 저장 중...');const result=await call('saveClassAudienceAdmin7355034',{classId:classId,audienceGroup:audienceGroup});item.audienceGroup=text(result.audienceGroup)||audienceGroup;renderClassManagerList7354();setStatus(text(result.message)||'반 구분을 저장했습니다.','ok');}catch(error){setStatus(text(error&&error.message)||'반 구분을 저장하지 못했습니다.','error');alert(text(error&&error.message)||'반 구분을 저장하지 못했습니다.');}finally{hideLoading();}
  }
  async function retireClassCatalog7354(classId) {
    const item=classById(classId); if(!item||!confirm(item.className+'\n\n이 반을 사용중지할까요? 기존 기록은 유지됩니다.'))return;
    try{showLoading('반 사용중지 처리 중...');const result=await call('retireClassCatalogAdmin7354',{classId:classId,requestId:requestId('class-retire-7355016')});await reloadClasses();setStatus(text(result.message)||'반을 사용중지했습니다.','ok');}catch(error){setStatus(text(error&&error.message)||'반을 사용중지하지 못했습니다.','error');}finally{hideLoading();}
  }

  async function configureApplicationWindow() {
    const month = text(document.getElementById('ulimCourseWindowMonth7352') && document.getElementById('ulimCourseWindowMonth7352').value);
    const active = text(document.getElementById('ulimCourseWindowActive7352') && document.getElementById('ulimCourseWindowActive7352').value) === 'true';
    const notice = text(document.getElementById('ulimCourseWindowNotice7352') && document.getElementById('ulimCourseWindowNotice7352').value);
    const openText = text(document.getElementById('ulimCourseWindowOpen7352') && document.getElementById('ulimCourseWindowOpen7352').value);
    const closeText = text(document.getElementById('ulimCourseWindowClose7352') && document.getElementById('ulimCourseWindowClose7352').value);
    const recruitingClassIds = selectedValues(document.getElementById('ulimCourseWindowClasses7352'));
    if (!/^\d{4}-\d{2}$/.test(month)) return alert('신청 대상월을 선택해주세요.');
    if (active && !recruitingClassIds.length) return alert('학생이 신청할 모집반을 하나 이상 선택해주세요.');
    if (!confirm(month + ' 앱 수강신청 설정을 저장할까요?\n학생 화면: ' + (active ? '열기' : '닫기') + '\n모집반: ' + recruitingClassIds.length + '개')) return;
    try {
      showLoading('수강신청 기간을 저장하는 중...');
      const result = await call('saveCourseApplicationWindowAdmin7352', {
        month: month,
        active: active,
        title: month + ' 수강신청',
        notice: notice || month + ' 수강신청 및 반 이동 신청을 받습니다.',
        openAtMs: openText ? new Date(openText).getTime() : 0,
        closeAtMs: closeText ? new Date(closeText).getTime() : 0,
        recruitingClassIds: recruitingClassIds,
        requestId: requestId('course-window-7352')
      });
      setStatus(month + ' 앱 수강신청을 ' + (active ? '열었습니다.' : '닫았습니다.') + '\n신청 가능 반 ' + Number((result.recruitingClassIds || []).length) + '개', 'ok');
    } catch (error) { setStatus(text(error && error.message) || '수강신청 기간을 저장하지 못했습니다.', 'error'); }
    finally { hideLoading(); }
  }
  async function retire(key, mode) {
    const studentUid=rowKeyMap.get(key)||''; const student=students.find(function(item){return item.studentUid===studentUid;})||{}; if(!studentUid)return;
    const label=mode==='cancel'?'등록 취소':'퇴원 처리'; if(!confirm(text(student.name)+' 학생을 '+label+'할까요?\n과거 출석·평가 기록은 보존됩니다.'))return;
    try{showLoading(label+' 중...');const result=await call('retireStudentAdmin7352',{studentUid:studentUid,mode:mode,requestId:requestId('student-retire-7355002')});if(mode==='cancel'){student.registrationCancelled=true;}student.enrollmentStatus='withdrawn';applyFilter();dispatchRosterChanged7355016('student-retired',{studentUids:[studentUid]});setStatus(text(result.message)||label+'했습니다.','ok');}catch(error){setStatus(text(error&&error.message)||label+'에 실패했습니다.','error');}finally{hideLoading();}
  }
  function bindUi() {
    const filter=document.getElementById(FILTER_ID), statusFilter=document.getElementById(STATUS_FILTER_ID), createClasses=document.getElementById('ulimNewStudentClasses7352'), createPhone=document.getElementById('ulimNewStudentPhone7352'), classInstructor=document.getElementById('ulimClassInstructor7354'), classBaseName=document.getElementById('ulimClassBaseName7354'), classTimeSlots=document.getElementById('ulimClassTimeSlots7354'), table=document.getElementById(TABLE_ID);
    if(filter&&!filter.dataset.ulim7355002Bound){filter.dataset.ulim7355002Bound='1';filter.addEventListener('input',applyFilter);} if(statusFilter&&!statusFilter.dataset.ulim7355002Bound){statusFilter.dataset.ulim7355002Bound='1';statusFilter.addEventListener('change',applyFilter);} if(createClasses&&!createClasses.dataset.ulim7355002Bound){createClasses.dataset.ulim7355002Bound='1';createClasses.addEventListener('change',updateCreateClassPreview);} if(createPhone&&!createPhone.dataset.ulim7355002Bound){createPhone.dataset.ulim7355002Bound='1';createPhone.addEventListener('input',updatePasswordPreview);} if(classInstructor&&!classInstructor.dataset.ulim7355002Bound){classInstructor.dataset.ulim7355002Bound='1';classInstructor.addEventListener('change',updateClassPreview7354);} if(classBaseName&&!classBaseName.dataset.ulim7355002Bound){classBaseName.dataset.ulim7355002Bound='1';classBaseName.addEventListener('input',updateClassPreview7354);} if(classTimeSlots&&!classTimeSlots.dataset.ulim7355002Bound){classTimeSlots.dataset.ulim7355002Bound='1';classTimeSlots.addEventListener('change',updateClassPreview7354);}
    if(table&&!table.dataset.ulim7355002Bound){table.dataset.ulim7355002Bound='1';table.addEventListener('input',function(event){const key=event.target&&event.target.dataset&&event.target.dataset.rowKey;if(key)markDirty(key);});table.addEventListener('change',function(event){const target=event.target;const key=target&&target.dataset&&target.dataset.rowKey;if(!key)return;if(target.id===key+'_operation')handleOperationModeChange(key);markDirty(key);});}
  }


  function installPanelHook() {
    const original = global.showAdminPanel;
    if (typeof original !== 'function' || original.__ulimStudentManagement7352Wrapped) return;
    const wrapped = function (panelId) {
      const result = original.apply(this, arguments);
      if (panelId === targetPanelId) setTimeout(function () { if (!students.length) load(); }, 0);
      return result;
    };
    wrapped.__ulimStudentManagement7352Wrapped = true;
    global.showAdminPanel = wrapped;
    try { showAdminPanel = wrapped; } catch (_ignore) {}
  }
  function install() {
    if(installed)return; installed=true; injectStyles(); injectPanel(); bindUi(); installPanelHook();
    global.ulimStudentManagementLoad7352=load; global.ulimStudentDirectoryGet7355016=function(){return global.__ULIM_STUDENT_DIRECTORY_7355016__ || publishDirectory7355016('snapshot-read',{});}; global.ulimStudentDirectoryEnsure7355016=async function(force){if(force===true || !global.__ULIM_STUDENT_DIRECTORY_7355016__) await load(force===true); return global.__ULIM_STUDENT_DIRECTORY_7355016__ || publishDirectory7355016('snapshot-ensure',{});}; global.ulimStudentDirectoryPatch7355016=patchStudentFromExternal7355016; global.ulimStudentManagementCreate7352=createStudent; global.ulimStudentManagementSaveRow7352=saveRow; global.ulimStudentManagementSaveAll7352=saveAll; global.ulimStudentManagementRetry7352=retry; global.ulimStudentManagementReloadClasses7352=reloadClasses; global.ulimClassCatalogSave7354=saveClassCatalog7354; global.ulimClassAudienceSave7355038=saveClassAudience7355038; global.ulimClassCatalogRetire7354=retireClassCatalog7354; global.ulimStudentManagementWindow7352=configureApplicationWindow; global.ulimStudentManagementRetire7352=retire; global.ulimStudentFirebaseAuthProvisionAll7355030=provisionStudentFirebaseAuthAll7355030; global.ulimStudentFirebasePasswordReset7355030=resetStudentFirebasePassword7355030; global.ulimStudentPracticeDailyReset7355051=resetStudentPracticeDaily7355051;
    global.addEventListener('ulim-firebase-token-invalid',function(){setStatus('로그인 시간이 만료되었습니다. 다시 로그인해주세요.','error');});
  }


  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof window !== 'undefined' ? window : globalThis);
