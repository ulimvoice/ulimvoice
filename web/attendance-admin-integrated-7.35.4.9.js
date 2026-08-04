(function (global) {
  'use strict';

  if (global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_73549__) return;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_73549__ = true;
  global.ULIM_ATTENDANCE_ADMIN_INTEGRATED_VERSION = '2026-08-04.735.04.9';

  var VERSION = '2026-08-04.735.04.9';
  var loadSequence = 0;
  var directoryCache = null;
  var directoryLoadedAt = 0;
  var detailRecordIndex = -1;
  var detailCandidates = [];
  var detailStudent = null;
  var decorateTimer = 0;
  var wrapObserver = null;
  var observedWrap = null;
  var classListSequence = 0;
  var originalSelectClass = typeof global.adminSelectClass === 'function' ? global.adminSelectClass : null;

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalize(value) {
    return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  }

  function normalizeName(value) {
    return text(value).normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  }

  function digits(value) {
    return text(value).replace(/\D/g, '');
  }

  function unique(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean)));
  }

  function sameSet(left, right) {
    var a = unique(left).sort();
    var b = unique(right).sort();
    return a.length === b.length && a.every(function (value, index) { return value === b[index]; });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function today() {
    var date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function readAdminInfo() {
    var info = global.adminInfo && typeof global.adminInfo === 'object' ? global.adminInfo : null;
    if (info) return info;
    var raw = '';
    try { raw = localStorage.getItem('adminInfo') || sessionStorage.getItem('adminInfo') || ''; } catch (_ignore) {}
    try { return raw ? JSON.parse(raw) : {}; } catch (_ignore2) { return {}; }
  }

  function isFullAdmin() {
    try { if (typeof global.adminIsFullAdmin === 'function' && global.adminIsFullAdmin()) return true; } catch (_ignore1) {}
    try { if (typeof adminIsFullAdmin === 'function' && adminIsFullAdmin()) return true; } catch (_ignore2) {}
    try { if (document.body && document.body.classList.contains('full-admin-mode')) return true; } catch (_ignore3) {}
    var info = readAdminInfo();
    var role = normalize(info.firebaseRole || info.role || info.adminRole || info.permission || '');
    return role === 'super' || role === 'superadmin' || role === '전체관리자' || role === '전체관리' || role === '원장' || role === 'owner';
  }

  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }

  async function runtime() {
    var room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('교직원 인증 기능을 준비하지 못했습니다.');
    var rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('교직원 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'attendance-admin-integrated-73548');
    else if (typeof rt.sdk.getIdToken === 'function') await rt.sdk.getIdToken(rt.auth.currentUser, false);
    return rt;
  }

  async function call(name, payload) {
    var rt = await runtime();
    var callable = rt.sdk.httpsCallable(rt.functions, name);
    var response = await callable(payload || {});
    return response && response.data || {};
  }

  function readLegacyToken() {
    try {
      if (typeof adminToken !== 'undefined' && adminToken) return text(adminToken);
    } catch (_ignore1) {}
    try { return text(global.adminToken || localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken')); } catch (_ignore2) { return ''; }
  }

  function normalizeClassItem(raw) {
    var item = raw || {};
    var className = text(item.className || item.name || item.label);
    var teacher = text(item.teacher || item.instructorName || item.instructor || item.teacherName);
    return Object.assign({}, item, {
      className: className,
      teacher: teacher,
      instructorName: text(item.instructorName || item.teacherName || item.teacher || item.instructor),
      classId: text(item.classId || item.id)
    });
  }

  function assignOperationalClassList(date, rawClasses) {
    var list = (Array.isArray(rawClasses) ? rawClasses : []).map(normalizeClassItem).filter(function (item) { return item.className; });
    try {
      if (typeof adminRememberClassListForDate704_ === 'function') list = adminRememberClassListForDate704_(date, list || []);
    } catch (_ignore1) {}
    try { if (typeof adminClassList !== 'undefined') adminClassList = list; } catch (_ignore2) {}
    try { if (typeof adminClassListLoadedKey !== 'undefined') adminClassListLoadedKey = 'firebase-operational|' + date + '|73549'; } catch (_ignore3) {}
    global.adminClassList = list;
    try { if (typeof adminRenderClassSelectors === 'function') adminRenderClassSelectors(); else if (typeof global.adminRenderClassSelectors === 'function') global.adminRenderClassSelectors(); } catch (_ignore4) {}
    try { if (typeof adminClearInvalidClassSelection704_ === 'function') adminClearInvalidClassSelection704_(date); } catch (_ignore5) {}
    return list;
  }

  function currentGlobalClassList() {
    try { if (typeof adminClassList !== 'undefined' && Array.isArray(adminClassList)) return adminClassList; } catch (_ignore) {}
    return Array.isArray(global.adminClassList) ? global.adminClassList : [];
  }

  async function loadClassListFirebaseFirst(dateOverride, force) {
    var dateEl = document.getElementById('adminAttendanceDate');
    var date = text(dateOverride || (dateEl && dateEl.value)) || today();
    var sequence = ++classListSequence;
    try {
      var data = await call('getStaffClassListOperationalSnapshot', {
        date: date,
        force: force === true,
        requestId: requestId('attendance-class-list-73549')
      });
      if (sequence !== classListSequence) return { stale: true };
      if (dateEl && text(dateEl.value) !== date) return { stale: true };
      var classes = Array.isArray(data && data.classes) ? data.classes : [];
      var assigned = assignOperationalClassList(date, classes);
      return { status: 'success', classes: assigned, source: text(data && data.source) || 'firestore-operational' };
    } catch (error) {
      if (sequence !== classListSequence) return { stale: true };
      setSummary('반 목록을 불러오지 못했습니다. 다시 열어주세요.');
      return { status: 'error', message: text(error && error.message) };
    }
  }

  function attendanceContext() {
    var dateEl = document.getElementById('adminAttendanceDate');
    var classEl = document.getElementById('adminAttendanceClass');
    var keywordEl = document.getElementById('adminAttendanceFilter');
    var statusEl = document.getElementById('adminAttendanceStatusFilter');
    return {
      date: text(dateEl && dateEl.value) || today(),
      className: text(classEl && classEl.value),
      keyword: text(keywordEl && keywordEl.value),
      statusFilter: text(statusEl && statusEl.value)
    };
  }

  function contextKey(context) {
    return [context.date, context.className, context.keyword, context.statusFilter].join('|');
  }

  function attendanceWrap() {
    return document.getElementById('adminAttendanceTableWrap');
  }

  function summaryElement() {
    return document.getElementById('adminAttendanceSummary');
  }

  function assignAttendanceRecords(records) {
    try { adminAttendanceRecords = Array.isArray(records) ? records : []; } catch (_ignore) {
      global.adminAttendanceRecords = Array.isArray(records) ? records : [];
    }
  }

  function currentAttendanceRecords() {
    try { return Array.isArray(adminAttendanceRecords) ? adminAttendanceRecords : []; } catch (_ignore) {
      return Array.isArray(global.adminAttendanceRecords) ? global.adminAttendanceRecords : [];
    }
  }

  function renderAttendance() {
    try {
      if (typeof adminRenderAttendanceTable === 'function') adminRenderAttendanceTable();
      else if (typeof global.adminRenderAttendanceTable === 'function') global.adminRenderAttendanceTable();
    } catch (_ignore) {}
    scheduleDecorate(0);
  }

  function setSummary(message) {
    var summary = summaryElement();
    if (summary) summary.textContent = message || '';
  }

  function clearAttendanceForNewRequest(message) {
    assignAttendanceRecords([]);
    renderAttendance();
    setSummary(message || '출석부를 불러오는 중...');
  }

  async function loadFromFirebase(context) {
    return call('getStaffAttendanceOperationalSnapshot', {
      date: context.date,
      className: context.className,
      keyword: context.keyword,
      statusFilter: context.statusFilter,
      requestId: requestId('attendance-snapshot-73549')
    });
  }

  async function safeLoadAttendanceSnapshot(showAlert) {
    var alertWhenEmpty = showAlert !== false;
    var context = attendanceContext();
    if (!context.className) {
      invalidateAttendanceView('반을 선택하면 출석부가 표시됩니다.');
      return { status: 'empty-class' };
    }
    if (context.className === '전체반') {
      invalidateAttendanceView('전체반 현황은 팝업에서 표시됩니다.');
      openAllClassesModal73549();
      return { status: 'all-classes-modal' };
    }
    var key = contextKey(context);
    var sequence = ++loadSequence;
    global.__ULIM_ATTENDANCE_ACTIVE_REQUEST_73549__ = { sequence: sequence, key: key, startedAt: Date.now() };
    clearAttendanceForNewRequest('출석부를 불러오는 중...');

    try {
      var data = await loadFromFirebase(context);

      if (sequence !== loadSequence || contextKey(attendanceContext()) !== key) return { stale: true };
      var records = Array.isArray(data && data.records) ? data.records : [];
      assignAttendanceRecords(records);
      renderAttendance();
      setSummary(text(data && data.message) || ('출석부 ' + records.length + '건'));
      global.__ULIM_ATTENDANCE_LAST_COMPLETED_73549__ = { sequence: sequence, key: key, completedAt: Date.now(), count: records.length };
      if (alertWhenEmpty && !records.length) alert('조건에 맞는 출석부 데이터가 없습니다. 날짜·반명·학생명을 확인해주세요.');
      return data;
    } catch (error) {
      if (sequence !== loadSequence || contextKey(attendanceContext()) !== key) return { stale: true };
      assignAttendanceRecords([]);
      renderAttendance();
      setSummary('출석부를 불러오지 못했습니다. 다시 시도해주세요.');
      if (alertWhenEmpty) alert(text(error && error.message) || '출석부를 불러오지 못했습니다.');
      return { status: 'error', message: text(error && error.message) };
    }
  }

  function invalidateAttendanceView(message) {
    loadSequence += 1;
    global.__ULIM_ATTENDANCE_ACTIVE_REQUEST_73549__ = null;
    clearAttendanceForNewRequest(message || '날짜와 반을 선택해주세요.');
  }

  function recordAt(index) {
    var records = currentAttendanceRecords();
    return records[Number(index)] || null;
  }

  function normalizeStudent(raw) {
    var student = raw || {};
    return {
      studentUid: text(student.studentUid),
      name: text(student.name || student.studentName),
      attendanceNo: text(student.attendanceNo || student.studentNo || student.loginId),
      studentPhone: text(student.studentPhone || student.phone),
      parentPhone: text(student.parentPhone),
      birthDate: text(student.birthDate || student.dateOfBirth),
      initialRegisteredDate: text(student.initialRegisteredDate || student.registeredDate || student.createdDate),
      enrollmentStatus: text(student.enrollmentStatus || student.status) || 'active',
      registrationCancelled: student.registrationCancelled === true,
      memo: text(student.memo || student.adminMemo),
      selectedClassIds: unique(student.selectedClassIds || student.classIds),
      classNames: unique(student.classNames || student.currentClasses),
      instructorNames: unique(student.instructorNames || student.instructors),
      legacyUnmappedClassNames: unique(student.legacyUnmappedClassNames),
      privacyConsent: student.privacyConsent === true,
      portraitConsent: student.portraitConsent === true
    };
  }

  function normalizeClass(raw) {
    var item = raw || {};
    return {
      classId: text(item.classId),
      className: text(item.className),
      instructorName: text(item.instructorName),
      selectable: item.selectable !== false
    };
  }

  async function loadDirectory(force) {
    if (!force && directoryCache && Date.now() - directoryLoadedAt < 30000) return directoryCache;
    var result = await call('listStudentManagementAdmin7352', { requestId: requestId('attendance-student-detail-list-73548') });
    directoryCache = {
      students: (Array.isArray(result.students) ? result.students : []).map(normalizeStudent),
      classes: (Array.isArray(result.classes) ? result.classes : []).map(normalizeClass).filter(function (item) { return item.classId && item.className; })
    };
    directoryLoadedAt = Date.now();
    return directoryCache;
  }

  function studentCandidateLabel(student) {
    var birth = student.birthDate ? ' / ' + student.birthDate : '';
    var phone = student.studentPhone ? ' / ' + student.studentPhone : '';
    var attendance = student.attendanceNo ? ' / 출결 ' + student.attendanceNo : '';
    return student.name + birth + phone + attendance;
  }

  function resolveStudentCandidates(record, directory) {
    var students = directory.students || [];
    var recordUid = text(record.studentUid || record.studentIdentityKey || record.studentKey);
    if (recordUid) {
      var exactUid = students.filter(function (student) { return student.studentUid === recordUid; });
      if (exactUid.length) return exactUid;
    }

    var nameKey = normalizeName(record.studentName || record.name);
    var phone = digits(record.studentPhone || record.phone);
    var attendanceNo = digits(record.attendanceNo || record.studentNo || record.loginId);
    var birthDate = text(record.birthDate || record.dateOfBirth);
    var named = students.filter(function (student) { return normalizeName(student.name) === nameKey; });
    if (phone) {
      var byPhone = named.filter(function (student) { return digits(student.studentPhone) === phone; });
      if (byPhone.length) return byPhone;
    }
    if (attendanceNo) {
      var byAttendance = named.filter(function (student) { return digits(student.attendanceNo) === attendanceNo; });
      if (byAttendance.length) return byAttendance;
    }
    if (birthDate) {
      var byBirth = named.filter(function (student) { return student.birthDate === birthDate; });
      if (byBirth.length) return byBirth;
    }
    return named;
  }

  function ensureStyles() {
    if (document.getElementById('ulimAttendanceAdminIntegratedStyle73547')) return;
    var style = document.createElement('style');
    style.id = 'ulimAttendanceAdminIntegratedStyle73547';
    style.textContent = [
      '#adminAttendanceTableWrap .ulim-attendance-student-link73547{border:0;background:transparent;color:#166534;font-weight:900;font-size:inherit;padding:3px 2px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;}',
      '#adminAttendanceTableWrap .ulim-attendance-student-link73547:hover{color:#2563eb;}',
      '.ulim-att-detail-modal73547{display:none;position:fixed;inset:0;z-index:2147483000;align-items:center;justify-content:center;padding:18px;}',
      '.ulim-att-detail-modal73547.open{display:flex;}',
      '.ulim-att-detail-backdrop73547{position:absolute;inset:0;background:rgba(15,23,42,.62);}',
      '.ulim-att-detail-panel73547{position:relative;z-index:1;width:min(900px,96vw);max-height:92vh;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(15,23,42,.35);display:flex;flex-direction:column;overflow:hidden;}',
      '.ulim-att-detail-head73547{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #e2e8f0;}',
      '.ulim-att-detail-head73547 h3{margin:0;font-size:19px;color:#0f172a;}',
      '.ulim-att-detail-close73547{border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:25px;cursor:pointer;}',
      '.ulim-att-detail-body73547{padding:16px 18px;overflow:auto;}',
      '.ulim-att-detail-grid73547{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:12px;}',
      '.ulim-att-detail-grid73547 label{display:block;font-size:12px;font-weight:900;color:#334155;margin-bottom:5px;}',
      '.ulim-att-detail-grid73547 input,.ulim-att-detail-grid73547 select,.ulim-att-detail-grid73547 textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:10px 11px;background:#fff;font-size:14px;}',
      '.ulim-att-detail-grid73547 select[multiple]{min-height:180px;}',
      '.ulim-att-detail-grid73547 textarea{min-height:110px;resize:vertical;}',
      '.ulim-att-detail-wide73547{grid-column:1/-1;}',
      '.ulim-att-detail-note73547{padding:10px 12px;border-radius:10px;background:#eff6ff;color:#1e40af;font-size:12px;line-height:1.55;margin-bottom:12px;}',
      '.ulim-att-detail-warning73547{background:#fff7ed;color:#9a3412;}',
      '.ulim-att-detail-footer73547{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #e2e8f0;background:#f8fafc;}',
      '@media(max-width:700px){.ulim-att-detail-grid73547{grid-template-columns:1fr}.ulim-att-detail-wide73547{grid-column:1}.ulim-att-detail-panel73547{width:98vw}}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureDetailModal() {
    var modal = document.getElementById('ulimAttendanceStudentDetailModal73547');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimAttendanceStudentDetailModal73547';
    modal.className = 'ulim-att-detail-modal73547';
    modal.innerHTML = '<div class="ulim-att-detail-backdrop73547" data-ulim-att-detail-close="1"></div>'
      + '<section class="ulim-att-detail-panel73547" role="dialog" aria-modal="true" aria-labelledby="ulimAttendanceStudentDetailTitle73547">'
      + '<header class="ulim-att-detail-head73547"><h3 id="ulimAttendanceStudentDetailTitle73547">학생정보</h3><button type="button" class="ulim-att-detail-close73547" data-ulim-att-detail-close="1">×</button></header>'
      + '<div id="ulimAttendanceStudentDetailBody73547" class="ulim-att-detail-body73547"></div>'
      + '<footer class="ulim-att-detail-footer73547"><button type="button" class="admin-btn gray" data-ulim-att-detail-close="1">취소</button><button type="button" class="admin-btn blue" id="ulimAttendanceStudentDetailSave73547">수정 반영</button></footer>'
      + '</section>';
    modal.addEventListener('click', function (event) {
      if (event.target && event.target.closest('[data-ulim-att-detail-close]')) closeDetailModal();
    });
    document.body.appendChild(modal);
    document.getElementById('ulimAttendanceStudentDetailSave73547').addEventListener('click', saveAttendanceStudentDetail);
    return modal;
  }

  function closeDetailModal() {
    var modal = document.getElementById('ulimAttendanceStudentDetailModal73547');
    if (modal) modal.classList.remove('open');
    detailRecordIndex = -1;
    detailCandidates = [];
    detailStudent = null;
  }

  function classOptionsHtml(student, classes) {
    var selected = new Set(unique(student && student.selectedClassIds));
    return (classes || []).map(function (item) {
      var label = item.className + (item.instructorName ? ' / ' + item.instructorName + 'T' : '');
      return '<option value="' + escapeHtml(item.classId) + '"' + (selected.has(item.classId) ? ' selected' : '') + (item.selectable === false ? ' disabled' : '') + '>' + escapeHtml(label) + '</option>';
    }).join('');
  }

  function detailFormHtml(student, directory, candidateSelectorHtml, warning) {
    return (warning ? '<div class="ulim-att-detail-note73547 ulim-att-detail-warning73547">' + escapeHtml(warning) + '</div>' : '')
      + candidateSelectorHtml
      + '<div class="ulim-att-detail-note73547">출석부에서 수정한 학생정보는 학생목록과 이후 출석 운영자료에 반영됩니다. 수강반을 바꾸면 선택한 반목록이 최종 수강반으로 저장됩니다.</div>'
      + '<div class="ulim-att-detail-grid73547">'
      + '<div><label>학생명</label><input id="ulimAttDetailName73547" value="' + escapeHtml(student.name) + '"></div>'
      + '<div><label>출결번호</label><input id="ulimAttDetailAttendanceNo73547" inputmode="numeric" value="' + escapeHtml(student.attendanceNo) + '"></div>'
      + '<div><label>학생 전화번호</label><input id="ulimAttDetailPhone73547" value="' + escapeHtml(student.studentPhone) + '"></div>'
      + '<div><label>학부모 전화번호</label><input id="ulimAttDetailParent73547" value="' + escapeHtml(student.parentPhone) + '"></div>'
      + '<div><label>생년월일</label><input id="ulimAttDetailBirth73547" type="date" value="' + escapeHtml(student.birthDate) + '"></div>'
      + '<div><label>등록일</label><input id="ulimAttDetailStart73547" type="date" value="' + escapeHtml(student.initialRegisteredDate) + '"></div>'
      + '<div><label>재원상태</label><select id="ulimAttDetailStatus73547"><option value="active"' + (student.enrollmentStatus === 'active' ? ' selected' : '') + '>재원</option><option value="leave"' + (student.enrollmentStatus === 'leave' ? ' selected' : '') + '>휴원</option><option value="withdrawn"' + (student.enrollmentStatus === 'withdrawn' ? ' selected' : '') + '>퇴원</option></select></div>'
      + '<div class="ulim-att-detail-wide73547"><label>현재 수강반</label><select id="ulimAttDetailClasses73547" multiple>' + classOptionsHtml(student, directory.classes) + '</select></div>'
      + '<div class="ulim-att-detail-wide73547"><label>관리자 메모</label><textarea id="ulimAttDetailMemo73547">' + escapeHtml(student.memo) + '</textarea></div>'
      + '</div>';
  }

  function renderDetailStudent(student, directory, warning) {
    detailStudent = student || null;
    var body = document.getElementById('ulimAttendanceStudentDetailBody73547');
    var saveButton = document.getElementById('ulimAttendanceStudentDetailSave73547');
    if (!body) return;
    if (!student) {
      body.innerHTML = '<div class="ulim-att-detail-note73547 ulim-att-detail-warning73547">학생목록과 연결된 학생정보를 찾지 못했습니다. 출석부의 임시·보강 학생이거나 학생 UID가 누락된 기록일 수 있습니다.</div>';
      if (saveButton) saveButton.disabled = true;
      return;
    }
    var selectorHtml = '';
    if (detailCandidates.length > 1) {
      selectorHtml = '<div class="ulim-att-detail-note73547 ulim-att-detail-warning73547">동명이인 후보가 여러 명입니다. 생년월일과 전화번호를 확인해 수정할 학생을 선택해주세요.</div>'
        + '<div style="margin-bottom:12px;"><label style="display:block;font-size:12px;font-weight:900;margin-bottom:5px;">학생 선택</label><select id="ulimAttDetailCandidate73547" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:10px;">'
        + detailCandidates.map(function (candidate) { return '<option value="' + escapeHtml(candidate.studentUid) + '"' + (candidate.studentUid === student.studentUid ? ' selected' : '') + '>' + escapeHtml(studentCandidateLabel(candidate)) + '</option>'; }).join('')
        + '</select></div>';
    }
    body.innerHTML = detailFormHtml(student, directory, selectorHtml, warning || '');
    if (saveButton) saveButton.disabled = false;
    var selector = document.getElementById('ulimAttDetailCandidate73547');
    if (selector) selector.addEventListener('change', function () {
      var selected = detailCandidates.find(function (candidate) { return candidate.studentUid === selector.value; }) || null;
      renderDetailStudent(selected, directory, '동명이인 후보 중 선택한 학생정보입니다.');
    });
  }

  async function openStudentDetail(index) {
    if (!isFullAdmin()) return alert('전체관리자 권한이 필요합니다.');
    var record = recordAt(index);
    if (!record) return alert('학생정보를 찾지 못했습니다. 출석부를 다시 불러와주세요.');
    detailRecordIndex = Number(index);
    ensureStyles();
    var modal = ensureDetailModal();
    var body = document.getElementById('ulimAttendanceStudentDetailBody73547');
    if (body) body.innerHTML = '<div class="ulim-att-detail-note73547">학생정보를 불러오는 중...</div>';
    modal.classList.add('open');
    try {
      var directory = await loadDirectory(false);
      if (detailRecordIndex !== Number(index)) return;
      detailCandidates = resolveStudentCandidates(record, directory);
      var selected = detailCandidates.length === 1 ? detailCandidates[0] : null;
      if (detailCandidates.length > 1) selected = detailCandidates[0];
      renderDetailStudent(selected, directory, '');
    } catch (error) {
      if (body) body.innerHTML = '<div class="ulim-att-detail-note73547 ulim-att-detail-warning73547">' + escapeHtml(text(error && error.message) || '학생정보를 불러오지 못했습니다.') + '</div>';
      var save = document.getElementById('ulimAttendanceStudentDetailSave73547');
      if (save) save.disabled = true;
    }
  }

  function selectedClassIds() {
    var select = document.getElementById('ulimAttDetailClasses73547');
    return select ? Array.from(select.selectedOptions || []).map(function (option) { return text(option.value); }).filter(Boolean) : [];
  }

  async function saveAttendanceStudentDetail() {
    if (!isFullAdmin()) return alert('전체관리자 권한이 필요합니다.');
    var student = detailStudent;
    if (!student || !student.studentUid) return alert('수정할 학생을 정확히 선택해주세요.');
    var name = text(document.getElementById('ulimAttDetailName73547') && document.getElementById('ulimAttDetailName73547').value);
    var attendanceNo = digits(document.getElementById('ulimAttDetailAttendanceNo73547') && document.getElementById('ulimAttDetailAttendanceNo73547').value);
    var studentPhone = text(document.getElementById('ulimAttDetailPhone73547') && document.getElementById('ulimAttDetailPhone73547').value);
    var parentPhone = text(document.getElementById('ulimAttDetailParent73547') && document.getElementById('ulimAttDetailParent73547').value);
    var birthDate = text(document.getElementById('ulimAttDetailBirth73547') && document.getElementById('ulimAttDetailBirth73547').value);
    var initialRegisteredDate = text(document.getElementById('ulimAttDetailStart73547') && document.getElementById('ulimAttDetailStart73547').value);
    var enrollmentStatus = text(document.getElementById('ulimAttDetailStatus73547') && document.getElementById('ulimAttDetailStatus73547').value) || 'active';
    var memo = text(document.getElementById('ulimAttDetailMemo73547') && document.getElementById('ulimAttDetailMemo73547').value);
    var classIds = selectedClassIds();
    var classChanged = !sameSet(classIds, student.selectedClassIds);
    if (!name) return alert('학생명을 입력해주세요.');
    if (digits(studentPhone).length < 4) return alert('학생 전화번호를 숫자 네 자리 이상 입력해주세요.');
    if (!attendanceNo) return alert('출결번호를 숫자로 입력해주세요.');
    if (attendanceNo.length > 20) return alert('출결번호는 숫자 20자리 이하로 입력해주세요.');
    if (classChanged && !classIds.length) {
      if (!confirm('선택된 수강반이 없습니다. 이 학생의 현재 수강반을 모두 종료할까요?')) return;
    }
    try {
      if (typeof global.showLoading === 'function') global.showLoading('학생정보를 수정하는 중...');
      var result = await call('updateStudentAdmin7352', {
        studentUid: student.studentUid,
        name: name,
        attendanceNo: attendanceNo,
        changeAttendanceNo: attendanceNo !== digits(student.attendanceNo),
        studentPhone: studentPhone,
        parentPhone: parentPhone,
        birthDate: birthDate,
        initialRegisteredDate: initialRegisteredDate,
        enrollmentStatus: enrollmentStatus,
        classIds: classIds,
        originalClassIds: unique(student.selectedClassIds),
        replaceClassAssignments: classChanged,
        registrationType: 'existing',
        operationDate: '',
        memo: memo,
        privacyConsent: student.privacyConsent === true,
        portraitConsent: student.portraitConsent === true,
        preserveLegacyClassNames: unique(student.legacyUnmappedClassNames),
        requestId: requestId('attendance-student-detail-update-73549')
      });
      directoryCache = null;
      directoryLoadedAt = 0;
      closeDetailModal();
      try { if (typeof global.ulimStudentManagementLoad7352 === 'function') global.ulimStudentManagementLoad7352(true); } catch (_ignore) {}
      await safeLoadAttendanceSnapshot(false);
      alert(text(result && result.message) || '학생정보를 수정했습니다.');
    } catch (error) {
      alert(text(error && error.message) || '학생정보를 수정하지 못했습니다.');
    } finally {
      if (typeof global.hideLoading === 'function') global.hideLoading();
    }
  }

  async function removeAttendanceRow(index) {
    if (!isFullAdmin()) return alert('전체관리자 권한이 필요합니다.');
    var record = recordAt(index);
    if (!record) return alert('삭제할 출석부 학생정보를 찾지 못했습니다. 출석부를 다시 불러와주세요.');
    var context = attendanceContext();
    var recordId = text(record.attendanceRecordId || record.recordId || record.id);
    var studentName = text(record.studentName || record.name);
    var date = text(record.date || record.sessionDate || context.date);
    var className = text(record.className || context.className);
    if (!confirm(date + '\n' + className + '\n' + studentName + '\n\n현재 출석부에서 이 학생 행을 삭제할까요?\n정규 수강반은 학생목록에서 별도로 변경해야 합니다.')) return;
    try {
      if (typeof global.showLoading === 'function') global.showLoading(studentName + ' 학생을 출석부에서 삭제하는 중...');
      var result = await call('removeAttendanceStudentAdmin73545', {
        attendanceRecordId: recordId,
        recordId: recordId,
        date: date,
        classId: text(record.classId),
        className: className,
        studentUid: text(record.studentUid || record.studentIdentityKey || record.studentKey),
        studentName: studentName,
        attendanceNo: text(record.attendanceNo || record.studentNo || record.loginId),
        studentPhone: text(record.studentPhone || record.phone),
        birthDate: text(record.birthDate || record.dateOfBirth),
        requestId: requestId('attendance-page-remove-73548')
      });
      await safeLoadAttendanceSnapshot(false);
      alert(text(result && result.message) || '출석부에서 학생을 삭제했습니다.');
    } catch (error) {
      alert(text(error && error.message) || '출석부에서 학생을 삭제하지 못했습니다.');
    } finally {
      if (typeof global.hideLoading === 'function') global.hideLoading();
    }
  }

  function headerIndex(table, label) {
    var headers = table ? Array.from(table.querySelectorAll('thead th')) : [];
    var target = normalize(label);
    return headers.findIndex(function (header) { return normalize(header.textContent) === target; });
  }

  function decorateAttendanceTable() {
    var wrap = attendanceWrap();
    bindWrapObserver(wrap);
    if (!wrap || !isFullAdmin()) return;
    ensureStyles();
    var table = wrap.querySelector('table');
    if (!table) return;
    var nameIndex = headerIndex(table, '학생명');
    if (nameIndex < 0) return;
    Array.from(table.querySelectorAll('tbody tr')).forEach(function (row, fallbackIndex) {
      var index = Number(row.getAttribute('data-att-index'));
      if (!Number.isFinite(index)) index = fallbackIndex;
      var cells = row.querySelectorAll('td');
      var cell = cells[nameIndex];
      if (!cell || cell.querySelector('.ulim-attendance-student-link73547')) return;
      var record = recordAt(index);
      if (!record) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'ulim-attendance-student-link73547';
      button.textContent = text(record.studentName || record.name) || text(cell.textContent);
      button.setAttribute('data-att-index', String(index));
      button.title = '학생정보 확인·수정';
      button.addEventListener('click', function () { openStudentDetail(index); });
      cell.innerHTML = '';
      cell.appendChild(button);
    });
  }

  function scheduleDecorate(delay) {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(decorateAttendanceTable, Number(delay) || 0);
  }

  function bindWrapObserver(wrap) {
    if (observedWrap === wrap) return;
    if (wrapObserver) {
      try { wrapObserver.disconnect(); } catch (_ignore) {}
      wrapObserver = null;
    }
    observedWrap = wrap || null;
    if (!wrap || typeof MutationObserver !== 'function') return;
    wrapObserver = new MutationObserver(function () { scheduleDecorate(0); });
    wrapObserver.observe(wrap, { childList: true, subtree: true });
  }

  function bindContextEvents() {
    var date = document.getElementById('adminAttendanceDate');
    if (date && !date.dataset.ulimRaceGuard73548) {
      date.dataset.ulimRaceGuard73548 = '1';
      date.addEventListener('change', function () {
        invalidateAttendanceView('새 수업일의 반 목록을 불러오는 중...');
        loadClassListFirebaseFirst(text(date.value), true).then(function () {
          var selected = text(document.getElementById('adminAttendanceClass') && document.getElementById('adminAttendanceClass').value);
          if (selected) safeLoadAttendanceSnapshot(false);
          else setSummary('반을 선택하면 출석부가 표시됩니다.');
        });
      }, true);
    }
    var status = document.getElementById('adminAttendanceStatusFilter');
    if (status && !status.dataset.ulimRaceGuard73548) {
      status.dataset.ulimRaceGuard73548 = '1';
      status.addEventListener('change', function () { safeLoadAttendanceSnapshot(false); });
    }
    var filter = document.getElementById('adminAttendanceFilter');
    if (filter && !filter.dataset.ulimRaceGuard73548) {
      filter.dataset.ulimRaceGuard73548 = '1';
      filter.addEventListener('keydown', function (event) { if (event.key === 'Enter') safeLoadAttendanceSnapshot(false); });
    }
    var classDisplay = document.getElementById('adminAttendanceClassDisplay');
    if (classDisplay && !classDisplay.dataset.ulimClassRefresh73548) {
      classDisplay.dataset.ulimClassRefresh73548 = '1';
      classDisplay.addEventListener('click', function () {
        var currentDate = text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value) || today();
        if (!currentGlobalClassList().length) loadClassListFirebaseFirst(currentDate, false);
      }, true);
    }
  }



  var allClassesDragData73549 = null;

  function ensureAllClassesModal73549() {
    var modal = document.getElementById('ulimAllClassesAttendanceModal73549');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimAllClassesAttendanceModal73549';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:2147483500;background:rgba(15,23,42,.62);padding:12px;box-sizing:border-box';
    modal.innerHTML = '<section style="height:calc(100vh - 24px);background:#fff;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(15,23,42,.38)">'
      + '<header style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:14px 17px;border-bottom:1px solid #e2e8f0"><div><h3 style="margin:0;font-size:19px">전체반 출석부</h3><div id="ulimAllClassesContext73549" style="font-size:12px;color:#64748b;margin-top:4px"></div></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><label style="font-size:13px;font-weight:800">이동 처리 <select id="ulimAllClassesMoveMode73549" style="padding:9px;border:1px solid #cbd5e1;border-radius:9px"><option value="existing">일반 수정</option><option value="new">신규</option><option value="class_move">반이동</option><option value="makeup">보강</option></select></label><button type="button" class="admin-btn blue" id="ulimAllClassesReload73549">새로고침</button><button type="button" class="admin-btn gray" data-close-all-classes="1">닫기</button></div></header>'
      + '<div style="padding:10px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;line-height:1.55"><b>학생 카드를 다른 반으로 끌어 놓으세요.</b> 일반 수정은 잘못 연결된 반만 정정하며 신규·반이동·보강 기록을 만들지 않습니다. 보강은 선택한 수업일에만 추가됩니다.</div>'
      + '<div id="ulimAllClassesBoard73549" style="flex:1;overflow:auto;padding:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;align-items:start"></div>'
      + '<div id="ulimAllClassesStatus73549" style="padding:10px 16px;border-top:1px solid #e2e8f0;min-height:20px;font-size:13px;font-weight:800;color:#475569"></div>'
      + '</section>';
    modal.addEventListener('click', function (event) {
      if (event.target === modal || event.target.closest('[data-close-all-classes="1"]')) modal.style.display = 'none';
    });
    document.body.appendChild(modal);
    document.getElementById('ulimAllClassesReload73549').addEventListener('click', function () { renderAllClassesBoard73549(true); });
    return modal;
  }

  function setAllClassesStatus73549(message, error) {
    var el = document.getElementById('ulimAllClassesStatus73549');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = error ? '#b91c1c' : '#166534';
  }

  function classForRecord73549(record, directory) {
    var classId = text(record.classId);
    if (classId) {
      var exact = directory.classes.find(function (item) { return item.classId === classId; });
      if (exact) return exact;
    }
    var className = normalize(record.className);
    return directory.classes.find(function (item) { return normalize(item.className) === className; }) || null;
  }

  function studentForRecord73549(record, directory) {
    var uid = text(record.studentUid || record.studentIdentityKey || record.studentKey);
    if (uid) {
      var exact = directory.students.find(function (item) { return item.studentUid === uid; });
      if (exact) return exact;
    }
    var candidates = resolveStudentCandidates(record, directory);
    return candidates.length === 1 ? candidates[0] : null;
  }

  async function renderAllClassesBoard73549(force) {
    var board = document.getElementById('ulimAllClassesBoard73549');
    if (!board) return;
    var context = attendanceContext();
    board.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b">전체반 명단을 불러오는 중...</div>';
    setAllClassesStatus73549('울림앱 전체반 자료를 불러오는 중...');
    try {
      var values = await Promise.all([
        loadDirectory(force === true),
        call('getStaffAttendanceOperationalSnapshot', {
          date: context.date,
          className: '전체반',
          keyword: '',
          statusFilter: '',
          requestId: requestId('all-classes-attendance-73549')
        })
      ]);
      var directory = values[0];
      var records = Array.isArray(values[1] && values[1].records) ? values[1].records : [];
      var activeClasses = directory.classes.filter(function (item) { return item.selectable !== false; });
      var grouped = new Map(activeClasses.map(function (item) { return [item.classId, []]; }));
      var unmatched = [];
      records.forEach(function (record, index) {
        var cls = classForRecord73549(record, directory);
        var student = studentForRecord73549(record, directory);
        var entry = { record: record, student: student, index: index, sourceClass: cls };
        if (cls && grouped.has(cls.classId)) grouped.get(cls.classId).push(entry);
        else unmatched.push(entry);
      });
      function columnHtml(cls, rows) {
        return '<section data-all-class-drop="' + escapeHtml(cls.classId) + '" style="border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;min-height:160px;overflow:hidden">'
          + '<header style="padding:11px 12px;background:#e0f2fe;border-bottom:1px solid #bae6fd;font-size:13px;font-weight:900;color:#075985">' + escapeHtml(cls.className) + '<span style="float:right">' + rows.length + '명</span></header>'
          + '<div style="display:grid;gap:7px;padding:9px;min-height:100px">'
          + rows.map(function (entry) {
            var record = entry.record || {};
            var student = entry.student;
            var draggable = !!(student && student.studentUid);
            return '<div draggable="' + (draggable ? 'true' : 'false') + '" data-all-student="' + escapeHtml(student ? student.studentUid : '') + '" data-source-class="' + escapeHtml(cls.classId) + '" data-record-index="' + entry.index + '" style="padding:9px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;cursor:' + (draggable ? 'grab' : 'default') + ';font-size:13px"><b>' + escapeHtml(record.studentName || record.name) + '</b><span style="margin-left:6px;color:#64748b">' + escapeHtml(record.status || record.attendanceStatus || '미체크') + '</span>' + (draggable ? '' : '<div style="font-size:10px;color:#b91c1c;margin-top:3px">학생 UID 확인 필요</div>') + '</div>';
          }).join('')
          + '</div></section>';
      }
      board.innerHTML = activeClasses.map(function (cls) { return columnHtml(cls, grouped.get(cls.classId) || []); }).join('')
        + (unmatched.length ? columnHtml({ classId: '__unmatched__', className: '반 연결 확인 필요' }, unmatched) : '');
      board.querySelectorAll('[draggable="true"]').forEach(function (card) {
        card.addEventListener('dragstart', function () {
          allClassesDragData73549 = {
            studentUid: text(card.getAttribute('data-all-student')),
            sourceClassId: text(card.getAttribute('data-source-class')),
            recordIndex: Number(card.getAttribute('data-record-index'))
          };
          card.style.opacity = '.55';
        });
        card.addEventListener('dragend', function () { card.style.opacity = ''; });
      });
      board.querySelectorAll('[data-all-class-drop]').forEach(function (column) {
        column.addEventListener('dragover', function (event) { event.preventDefault(); column.style.outline = '3px solid #22c55e'; });
        column.addEventListener('dragleave', function () { column.style.outline = ''; });
        column.addEventListener('drop', function (event) {
          event.preventDefault();
          column.style.outline = '';
          var targetClassId = text(column.getAttribute('data-all-class-drop'));
          if (!allClassesDragData73549 || !targetClassId || targetClassId === '__unmatched__') return;
          moveStudentBetweenClasses73549(allClassesDragData73549, targetClassId, directory, records);
        });
      });
      setAllClassesStatus73549('전체반 ' + activeClasses.length + '개 · 출석 학생행 ' + records.length + '건');
    } catch (error) {
      board.innerHTML = '<div style="padding:30px;text-align:center;color:#b91c1c">' + escapeHtml(text(error && error.message) || '전체반을 불러오지 못했습니다.') + '</div>';
      setAllClassesStatus73549(text(error && error.message) || '전체반을 불러오지 못했습니다.', true);
    }
  }

  async function moveStudentBetweenClasses73549(drag, targetClassId, directory, records) {
    var student = directory.students.find(function (item) { return item.studentUid === drag.studentUid; });
    var target = directory.classes.find(function (item) { return item.classId === targetClassId; });
    var record = records[drag.recordIndex] || {};
    if (!student || !target) return alert('학생 또는 이동할 반을 찾지 못했습니다.');
    if (drag.sourceClassId === targetClassId) return;
    var mode = text(document.getElementById('ulimAllClassesMoveMode73549') && document.getElementById('ulimAllClassesMoveMode73549').value) || 'existing';
    var labels = { existing: '일반 수정', new: '신규', class_move: '반이동', makeup: '보강' };
    if (!confirm(student.name + ' 학생을\n' + target.className + '\n반으로 ' + labels[mode] + ' 처리할까요?')) return;
    try {
      setAllClassesStatus73549(student.name + ' 학생을 처리하는 중...');
      if (mode === 'makeup') {
        await call('addTemporaryAttendanceAdmin7354', {
          studentUid: student.studentUid,
          studentName: student.name,
          kind: 'makeup',
          date: attendanceContext().date,
          classId: target.classId,
          className: target.className,
          requestId: requestId('all-class-makeup-73549')
        });
      } else {
        var currentIds = unique(student.selectedClassIds);
        var nextIds;
        if (mode === 'class_move') nextIds = [target.classId];
        else if (mode === 'new') nextIds = unique(currentIds.concat([target.classId]));
        else nextIds = unique(currentIds.filter(function (id) { return id !== drag.sourceClassId; }).concat([target.classId]));
        await call('updateStudentAdmin7352', {
          studentUid: student.studentUid,
          name: student.name,
          attendanceNo: student.attendanceNo,
          changeAttendanceNo: false,
          studentPhone: student.studentPhone,
          parentPhone: student.parentPhone,
          birthDate: student.birthDate,
          initialRegisteredDate: student.initialRegisteredDate,
          enrollmentStatus: student.enrollmentStatus,
          classIds: mode === 'new' ? [target.classId] : nextIds,
          originalClassIds: currentIds,
          replaceClassAssignments: mode !== 'new',
          registrationType: mode,
          operationDate: mode === 'class_move' ? attendanceContext().date : '',
          memo: student.memo,
          privacyConsent: student.privacyConsent === true,
          portraitConsent: student.portraitConsent === true,
          preserveLegacyClassNames: unique(student.legacyUnmappedClassNames),
          requestId: requestId('all-class-move-73549')
        });
      }
      directoryCache = null;
      directoryLoadedAt = 0;
      await renderAllClassesBoard73549(true);
      setAllClassesStatus73549(student.name + ' 학생 처리를 완료했습니다.');
    } catch (error) {
      setAllClassesStatus73549(text(error && error.message) || '학생 반 변경에 실패했습니다.', true);
      alert(text(error && error.message) || '학생 반 변경에 실패했습니다.');
    }
  }

  function openAllClassesModal73549() {
    if (!isFullAdmin()) return alert('관리자 권한이 필요합니다.');
    var modal = ensureAllClassesModal73549();
    var context = attendanceContext();
    var label = document.getElementById('ulimAllClassesContext73549');
    if (label) label.textContent = context.date + ' · 울림앱 전체반 현황';
    modal.style.display = 'block';
    renderAllClassesBoard73549(false);
  }

  function ensureSheetActionModal73549() {
    var modal = document.getElementById('ulimAttendanceSheetActionModal73549');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimAttendanceSheetActionModal73549';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:2147483600;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.58)';
    modal.innerHTML = '<section role="dialog" aria-modal="true" style="width:min(560px,96vw);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,.35)">'
      + '<header style="display:flex;align-items:center;justify-content:space-between;padding:17px 19px;border-bottom:1px solid #e2e8f0"><h3 style="margin:0;font-size:19px">출석부 반영</h3><button type="button" data-close-sheet-modal="1" style="border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:25px;cursor:pointer">×</button></header>'
      + '<div style="padding:18px"><p style="margin:0 0 16px;line-height:1.65;color:#475569">Google Sheets는 아래 버튼을 누른 경우에만 읽거나 기록합니다. 평소 출석부 조회와 저장은 울림앱 자료만 사용합니다.</p>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><button type="button" id="ulimAttendanceSheetImport73549" class="admin-btn blue" style="min-height:54px">구글시트 가져오기</button><button type="button" id="ulimAttendanceSheetExport73549" class="admin-btn" style="min-height:54px">구글시트에 기록</button></div>'
      + '<div id="ulimAttendanceSheetStatus73549" style="margin-top:14px;min-height:20px;font-size:13px;font-weight:800;color:#475569"></div></div>'
      + '<footer style="display:flex;justify-content:flex-end;padding:12px 18px;border-top:1px solid #e2e8f0;background:#f8fafc"><button type="button" class="admin-btn gray" data-close-sheet-modal="1">닫기</button></footer>'
      + '</section>';
    modal.addEventListener('click', function (event) {
      if (event.target === modal || event.target.closest('[data-close-sheet-modal="1"]')) modal.style.display = 'none';
    });
    document.body.appendChild(modal);
    document.getElementById('ulimAttendanceSheetImport73549').addEventListener('click', importAttendanceFromSheet73549);
    document.getElementById('ulimAttendanceSheetExport73549').addEventListener('click', exportAttendanceToSheet73549);
    return modal;
  }

  function setSheetActionStatus73549(message, error) {
    var el = document.getElementById('ulimAttendanceSheetStatus73549');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = error ? '#b91c1c' : '#166534';
  }

  function openSheetActionModal73549() {
    if (!isFullAdmin()) return alert('관리자 권한이 필요합니다.');
    var context = attendanceContext();
    if (!context.date) return alert('수업일을 선택해주세요.');
    var modal = ensureSheetActionModal73549();
    setSheetActionStatus73549(context.date + (context.className ? ' · ' + context.className : '') + ' 기준');
    modal.style.display = 'flex';
  }

  async function importAttendanceFromSheet73549() {
    var context = attendanceContext();
    if (!confirm(context.date + ' 출석부를 Google Sheets에서 가져올까요?\n현재 울림앱 출석부에 시트 내용을 반영합니다.')) return;
    try {
      if (typeof global.showLoading === 'function') global.showLoading('Google Sheets 출석부를 가져오는 중...');
      setSheetActionStatus73549('Google Sheets 출석부를 가져오는 중...');
      var result = await call('refreshStaffOperationalDateFromSheets', {
        date: context.date,
        datasets: ['attendance'],
        force: true,
        reason: 'manual_attendance_import_73549',
        requestId: requestId('attendance-sheet-import-73549')
      });
      await safeLoadAttendanceSnapshot(false);
      setSheetActionStatus73549(text(result && result.message) || 'Google Sheets 가져오기를 완료했습니다.');
    } catch (error) {
      setSheetActionStatus73549(text(error && error.message) || '가져오기에 실패했습니다.', true);
      alert(text(error && error.message) || 'Google Sheets 출석부를 가져오지 못했습니다.');
    } finally { if (typeof global.hideLoading === 'function') global.hideLoading(); }
  }

  async function exportAttendanceToSheet73549() {
    var context = attendanceContext();
    if (!confirm(context.date + ' 울림앱 출석부 현재값을 Google Sheets에 기록할까요?')) return;
    try {
      if (typeof global.showLoading === 'function') global.showLoading('울림앱 출석부를 Google Sheets에 기록하는 중...');
      setSheetActionStatus73549('현재 화면값을 울림앱에 저장한 뒤 Google Sheets에 기록하는 중...');
      if (typeof global.adminSaveAttendanceFromTable === 'function') await global.adminSaveAttendanceFromTable(true);
      var result = await call('pushStaffOperationalDateToSheets', {
        date: context.date,
        datasets: ['attendance'],
        requestId: requestId('attendance-sheet-export-73549')
      });
      setSheetActionStatus73549('Google Sheets 기록 완료: ' + Number(result && result.count || 0) + '건');
    } catch (error) {
      setSheetActionStatus73549(text(error && error.message) || '기록에 실패했습니다.', true);
      alert(text(error && error.message) || 'Google Sheets에 기록하지 못했습니다.');
    } finally { if (typeof global.hideLoading === 'function') global.hideLoading(); }
  }

  function bindAttendanceReflectButton73549() {
    document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('button') : null;
      if (!button || normalize(button.textContent) !== normalize('출석부 반영')) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      openSheetActionModal73549();
    }, true);
  }

  function installOverrides() {
    global.adminLoadAttendanceSnapshot = safeLoadAttendanceSnapshot;
    global.adminLoadClassList = loadClassListFirebaseFirst;
    global.ulimAttendanceRemoveRow73545 = removeAttendanceRow;
    global.ulimAttendanceOpenStudentDetail73547 = openStudentDetail;
    global.ulimGetAdminAttendanceRecord73545 = recordAt;
    global.ulimOpenAttendanceSheetDialog73549 = openSheetActionModal73549;
    global.ulimOpenAllClassesAttendance73549 = openAllClassesModal73549;
    try { adminLoadAttendanceSnapshot = safeLoadAttendanceSnapshot; } catch (_ignore1) {}
    try { adminLoadClassList = loadClassListFirebaseFirst; } catch (_ignore2) {}
    try { ulimAttendanceRemoveRow73545 = removeAttendanceRow; } catch (_ignore3) {}

    if (originalSelectClass && !global.adminSelectClass.__ulim73548Wrapped) {
      var wrappedSelectClass = function (className, targetId, panelId) {
        var result = originalSelectClass.apply(this, arguments);
        if ((targetId || 'adminAttendanceClass') === 'adminAttendanceClass' && text(className) === '전체반') {
          setTimeout(function () { openAllClassesModal73549(); }, 0);
        }
        return result;
      };
      wrappedSelectClass.__ulim73548Wrapped = true;
      global.adminSelectClass = wrappedSelectClass;
      try { adminSelectClass = wrappedSelectClass; } catch (_ignore4) {}
    }
  }

  function install() {
    ensureStyles();
    ensureDetailModal();
    installOverrides();
    bindContextEvents();
    if (!global.__ULIM_ATTENDANCE_REFLECT_BUTTON_BOUND_73549__) { global.__ULIM_ATTENDANCE_REFLECT_BUTTON_BOUND_73549__ = true; bindAttendanceReflectButton73549(); }
    bindWrapObserver(attendanceWrap());
    scheduleDecorate(0);
    var panel = document.getElementById('adminPanelAttendance');
    if (panel && panel.classList.contains('active') && !currentGlobalClassList().length) {
      loadClassListFirebaseFirst(text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value) || today(), false);
    }
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('.admin-subtab,button,[data-admin-panel]') : null;
    if (!target) return;
    var label = normalize(target.textContent);
    if (/출석부|출결/.test(label)) setTimeout(function () { install(); loadClassListFirebaseFirst(text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value) || today(), false); }, 30);
  }, true);

  global.addEventListener('pageshow', function () { setTimeout(install, 30); });
  global.addEventListener('ulim-firebase-auth-ready', function () { setTimeout(install, 60); });
  global.addEventListener('storage', function () { setTimeout(install, 60); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  setTimeout(install, 150);
  setTimeout(install, 700);
  setTimeout(install, 1800);
})(typeof window !== 'undefined' ? window : globalThis);
