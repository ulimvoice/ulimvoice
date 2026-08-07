(function (global) {
  'use strict';

  if (global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735414__) return;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735414__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735413__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735410__ = true;
  global.__ULIM_ATTENDANCE_DIRECTORY_AUTH_GUARD_735414__ = true;
  global.ULIM_ATTENDANCE_ADMIN_INTEGRATED_VERSION = '2026-08-07.735.04.14-auth-gated-directory-preload';

  var VERSION = '2026-08-07.735.04.14-auth-gated-directory-preload';
  var loadSequence = 0;
  var directoryCache = null;
  var directoryLoadedAt = 0;
  var directoryLoadingPromise735414 = null;
  var directoryRetryAfter735414 = 0;
  var wholeClassPreloadTimer735414 = 0;
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


  function staffDashboardActive735414() {
    try {
      if (document.body && document.body.classList.contains('admin-mode')) return true;
    } catch (_ignore1) {}
    try {
      if (global.adminModeActive === true) return true;
    } catch (_ignore2) {}
    try {
      var dashboard = document.getElementById('adminDashboard');
      var loginBox = document.getElementById('adminLoginBox');
      if (!dashboard) return false;
      var dashboardVisible = global.getComputedStyle ? global.getComputedStyle(dashboard).display !== 'none' : dashboard.style.display !== 'none';
      var loginHidden = !loginBox || (global.getComputedStyle ? global.getComputedStyle(loginBox).display === 'none' : loginBox.style.display === 'none');
      return dashboardVisible && loginHidden;
    } catch (_ignore3) {
      return false;
    }
  }

  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }

  async function runtime() {
    var room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('교직원 인증 기능을 준비하지 못했습니다.');
    var rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('교직원 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'attendance-admin-integrated-735410');
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
    try { if (typeof adminClassListLoadedKey !== 'undefined') adminClassListLoadedKey = 'firebase-operational|' + date + '|735410'; } catch (_ignore3) {}
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
        requestId: requestId('attendance-class-list-735410')
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
      requestId: requestId('attendance-snapshot-735410')
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
      openAllClassesModal735410();
      return { status: 'all-classes-modal' };
    }
    var key = contextKey(context);
    var sequence = ++loadSequence;
    global.__ULIM_ATTENDANCE_ACTIVE_REQUEST_735410__ = { sequence: sequence, key: key, startedAt: Date.now() };
    clearAttendanceForNewRequest('출석부를 불러오는 중...');

    try {
      var data = await loadFromFirebase(context);

      if (sequence !== loadSequence || contextKey(attendanceContext()) !== key) return { stale: true };
      var records = Array.isArray(data && data.records) ? data.records : [];
      assignAttendanceRecords(records);
      renderAttendance();
      setSummary(text(data && data.message) || ('출석부 ' + records.length + '건'));
      global.__ULIM_ATTENDANCE_LAST_COMPLETED_735410__ = { sequence: sequence, key: key, completedAt: Date.now(), count: records.length };
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
    global.__ULIM_ATTENDANCE_ACTIVE_REQUEST_735410__ = null;
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

  function weekdayFromClass735410(item) {
    var explicit = Number(item && item.weekday);
    if (Number.isInteger(explicit) && explicit >= 0 && explicit <= 6) return explicit;
    var source = text(item && (item.weekdayLabel || item.className || item.baseName));
    var labels = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
    for (var index = 0; index < labels.length; index += 1) if (source.indexOf(labels[index]) >= 0) return index;
    return -1;
  }

  function normalizeClass(raw) {
    var item = raw || {};
    return {
      classId: text(item.classId),
      className: text(item.className),
      baseName: text(item.baseName),
      instructorName: text(item.instructorName),
      selectable: item.selectable !== false,
      weekday: weekdayFromClass735410(item),
      weekdayLabel: text(item.weekdayLabel),
      startTime: text(item.startTime),
      endTime: text(item.endTime),
      dates: Array.isArray(item.dates) ? item.dates.map(text).filter(Boolean) : []
    };
  }

  async function loadDirectory(force) {
    if (!force && directoryCache && Date.now() - directoryLoadedAt < 30000) return directoryCache;
    if (directoryLoadingPromise735414) return directoryLoadingPromise735414;
    if (!staffDashboardActive735414()) throw new Error('교직원 로그인 후 학생명단을 불러올 수 있습니다.');
    if (!force && Date.now() < directoryRetryAfter735414) throw new Error('학생명단 재시도 대기 중입니다.');

    directoryLoadingPromise735414 = (async function () {
      try {
        var result = await call('listStudentManagementAdmin7352', { requestId: requestId('attendance-student-detail-list-735414') });
        directoryCache = {
          students: (Array.isArray(result.students) ? result.students : []).map(normalizeStudent),
          classes: (Array.isArray(result.classes) ? result.classes : []).map(normalizeClass).filter(function (item) { return item.classId && item.className; })
        };
        directoryLoadedAt = Date.now();
        directoryRetryAfter735414 = 0;
        return directoryCache;
      } catch (error) {
        directoryRetryAfter735414 = Date.now() + 15000;
        throw error;
      } finally {
        directoryLoadingPromise735414 = null;
      }
    })();
    return directoryLoadingPromise735414;
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
    if (document.getElementById('ulimAttendanceAdminIntegratedStyle735410')) return;
    var style = document.createElement('style');
    style.id = 'ulimAttendanceAdminIntegratedStyle735410';
    style.textContent = [
      '#adminAttendanceTableWrap .ulim-attendance-student-link735410{border:0;background:transparent;color:#166534;font-weight:900;font-size:inherit;padding:3px 2px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;}',
      '#adminAttendanceTableWrap .ulim-attendance-student-link735410:hover{color:#2563eb;}',
      '.ulim-att-detail-modal735410{display:none;position:fixed;inset:0;z-index:2147483000;align-items:center;justify-content:center;padding:18px;}',
      '.ulim-att-detail-modal735410.open{display:flex;}',
      '.ulim-att-detail-backdrop735410{position:absolute;inset:0;background:rgba(15,23,42,.62);}',
      '.ulim-att-detail-panel735410{position:relative;z-index:1;width:min(900px,96vw);max-height:92vh;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(15,23,42,.35);display:flex;flex-direction:column;overflow:hidden;}',
      '.ulim-att-detail-head735410{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #e2e8f0;}',
      '.ulim-att-detail-head735410 h3{margin:0;font-size:19px;color:#0f172a;}',
      '.ulim-att-detail-close735410{border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:25px;cursor:pointer;}',
      '.ulim-att-detail-body735410{padding:16px 18px;overflow:auto;}',
      '.ulim-att-detail-grid735410{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:12px;}',
      '.ulim-att-detail-grid735410 label{display:block;font-size:12px;font-weight:900;color:#334155;margin-bottom:5px;}',
      '.ulim-att-detail-grid735410 input,.ulim-att-detail-grid735410 select,.ulim-att-detail-grid735410 textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:10px 11px;background:#fff;font-size:14px;}',
      '.ulim-att-detail-grid735410 select[multiple]{min-height:180px;}',
      '.ulim-att-detail-grid735410 textarea{min-height:110px;resize:vertical;}',
      '.ulim-att-detail-wide735410{grid-column:1/-1;}',
      '.ulim-att-detail-note735410{padding:10px 12px;border-radius:10px;background:#eff6ff;color:#1e40af;font-size:12px;line-height:1.55;margin-bottom:12px;}',
      '.ulim-att-detail-warning735410{background:#fff7ed;color:#9a3412;}',
      '.ulim-att-detail-footer735410{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #e2e8f0;background:#f8fafc;}',
      '@media(max-width:700px){.ulim-att-detail-grid735410{grid-template-columns:1fr}.ulim-att-detail-wide735410{grid-column:1}.ulim-att-detail-panel735410{width:98vw}}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureDetailModal() {
    var modal = document.getElementById('ulimAttendanceStudentDetailModal735410');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimAttendanceStudentDetailModal735410';
    modal.className = 'ulim-att-detail-modal735410';
    modal.innerHTML = '<div class="ulim-att-detail-backdrop735410" data-ulim-att-detail-close="1"></div>'
      + '<section class="ulim-att-detail-panel735410" role="dialog" aria-modal="true" aria-labelledby="ulimAttendanceStudentDetailTitle735410">'
      + '<header class="ulim-att-detail-head735410"><h3 id="ulimAttendanceStudentDetailTitle735410">학생정보</h3><button type="button" class="ulim-att-detail-close735410" data-ulim-att-detail-close="1">×</button></header>'
      + '<div id="ulimAttendanceStudentDetailBody735410" class="ulim-att-detail-body735410"></div>'
      + '<footer class="ulim-att-detail-footer735410"><button type="button" class="admin-btn gray" data-ulim-att-detail-close="1">취소</button><button type="button" class="admin-btn blue" id="ulimAttendanceStudentDetailSave735410">수정 반영</button></footer>'
      + '</section>';
    modal.addEventListener('click', function (event) {
      if (event.target && event.target.closest('[data-ulim-att-detail-close]')) closeDetailModal();
    });
    document.body.appendChild(modal);
    document.getElementById('ulimAttendanceStudentDetailSave735410').addEventListener('click', saveAttendanceStudentDetail);
    return modal;
  }

  function closeDetailModal() {
    var modal = document.getElementById('ulimAttendanceStudentDetailModal735410');
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
    return (warning ? '<div class="ulim-att-detail-note735410 ulim-att-detail-warning735410">' + escapeHtml(warning) + '</div>' : '')
      + candidateSelectorHtml
      + '<div class="ulim-att-detail-note735410">출석부에서 수정한 학생정보는 학생목록과 이후 출석 운영자료에 반영됩니다. 수강반을 바꾸면 선택한 반목록이 최종 수강반으로 저장됩니다.</div>'
      + '<div class="ulim-att-detail-grid735410">'
      + '<div><label>학생명</label><input id="ulimAttDetailName735410" value="' + escapeHtml(student.name) + '"></div>'
      + '<div><label>출결번호</label><input id="ulimAttDetailAttendanceNo735410" inputmode="numeric" value="' + escapeHtml(student.attendanceNo) + '"></div>'
      + '<div><label>학생 전화번호</label><input id="ulimAttDetailPhone735410" value="' + escapeHtml(student.studentPhone) + '"></div>'
      + '<div><label>학부모 전화번호</label><input id="ulimAttDetailParent735410" value="' + escapeHtml(student.parentPhone) + '"></div>'
      + '<div><label>생년월일</label><input id="ulimAttDetailBirth735410" type="date" value="' + escapeHtml(student.birthDate) + '"></div>'
      + '<div><label>등록일</label><input id="ulimAttDetailStart735410" type="date" value="' + escapeHtml(student.initialRegisteredDate) + '"></div>'
      + '<div><label>재원상태</label><select id="ulimAttDetailStatus735410"><option value="active"' + (student.enrollmentStatus === 'active' ? ' selected' : '') + '>재원</option><option value="leave"' + (student.enrollmentStatus === 'leave' ? ' selected' : '') + '>휴원</option><option value="withdrawn"' + (student.enrollmentStatus === 'withdrawn' ? ' selected' : '') + '>퇴원</option></select></div>'
      + '<div class="ulim-att-detail-wide735410"><label>현재 수강반</label><select id="ulimAttDetailClasses735410" multiple>' + classOptionsHtml(student, directory.classes) + '</select></div>'
      + '<div class="ulim-att-detail-wide735410"><label>관리자 메모</label><textarea id="ulimAttDetailMemo735410">' + escapeHtml(student.memo) + '</textarea></div>'
      + '</div>';
  }

  function renderDetailStudent(student, directory, warning) {
    detailStudent = student || null;
    var body = document.getElementById('ulimAttendanceStudentDetailBody735410');
    var saveButton = document.getElementById('ulimAttendanceStudentDetailSave735410');
    if (!body) return;
    if (!student) {
      body.innerHTML = '<div class="ulim-att-detail-note735410 ulim-att-detail-warning735410">학생목록과 연결된 학생정보를 찾지 못했습니다. 출석부의 임시·보강 학생이거나 학생 UID가 누락된 기록일 수 있습니다.</div>';
      if (saveButton) saveButton.disabled = true;
      return;
    }
    var selectorHtml = '';
    if (detailCandidates.length > 1) {
      selectorHtml = '<div class="ulim-att-detail-note735410 ulim-att-detail-warning735410">동명이인 후보가 여러 명입니다. 생년월일과 전화번호를 확인해 수정할 학생을 선택해주세요.</div>'
        + '<div style="margin-bottom:12px;"><label style="display:block;font-size:12px;font-weight:900;margin-bottom:5px;">학생 선택</label><select id="ulimAttDetailCandidate735410" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:10px;">'
        + detailCandidates.map(function (candidate) { return '<option value="' + escapeHtml(candidate.studentUid) + '"' + (candidate.studentUid === student.studentUid ? ' selected' : '') + '>' + escapeHtml(studentCandidateLabel(candidate)) + '</option>'; }).join('')
        + '</select></div>';
    }
    body.innerHTML = detailFormHtml(student, directory, selectorHtml, warning || '');
    if (saveButton) saveButton.disabled = false;
    var selector = document.getElementById('ulimAttDetailCandidate735410');
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
    var body = document.getElementById('ulimAttendanceStudentDetailBody735410');
    if (body) body.innerHTML = '<div class="ulim-att-detail-note735410">학생정보를 불러오는 중...</div>';
    modal.classList.add('open');
    try {
      var directory = await loadDirectory(false);
      if (detailRecordIndex !== Number(index)) return;
      detailCandidates = resolveStudentCandidates(record, directory);
      var selected = detailCandidates.length === 1 ? detailCandidates[0] : null;
      if (detailCandidates.length > 1) selected = detailCandidates[0];
      renderDetailStudent(selected, directory, '');
    } catch (error) {
      if (body) body.innerHTML = '<div class="ulim-att-detail-note735410 ulim-att-detail-warning735410">' + escapeHtml(text(error && error.message) || '학생정보를 불러오지 못했습니다.') + '</div>';
      var save = document.getElementById('ulimAttendanceStudentDetailSave735410');
      if (save) save.disabled = true;
    }
  }

  function selectedClassIds() {
    var select = document.getElementById('ulimAttDetailClasses735410');
    return select ? Array.from(select.selectedOptions || []).map(function (option) { return text(option.value); }).filter(Boolean) : [];
  }

  async function saveAttendanceStudentDetail() {
    if (!isFullAdmin()) return alert('전체관리자 권한이 필요합니다.');
    var student = detailStudent;
    if (!student || !student.studentUid) return alert('수정할 학생을 정확히 선택해주세요.');
    var name = text(document.getElementById('ulimAttDetailName735410') && document.getElementById('ulimAttDetailName735410').value);
    var attendanceNo = digits(document.getElementById('ulimAttDetailAttendanceNo735410') && document.getElementById('ulimAttDetailAttendanceNo735410').value);
    var studentPhone = text(document.getElementById('ulimAttDetailPhone735410') && document.getElementById('ulimAttDetailPhone735410').value);
    var parentPhone = text(document.getElementById('ulimAttDetailParent735410') && document.getElementById('ulimAttDetailParent735410').value);
    var birthDate = text(document.getElementById('ulimAttDetailBirth735410') && document.getElementById('ulimAttDetailBirth735410').value);
    var initialRegisteredDate = text(document.getElementById('ulimAttDetailStart735410') && document.getElementById('ulimAttDetailStart735410').value);
    var enrollmentStatus = text(document.getElementById('ulimAttDetailStatus735410') && document.getElementById('ulimAttDetailStatus735410').value) || 'active';
    var memo = text(document.getElementById('ulimAttDetailMemo735410') && document.getElementById('ulimAttDetailMemo735410').value);
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
        requestId: requestId('attendance-student-detail-update-735410')
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
        requestId: requestId('attendance-page-remove-735410')
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
      if (!cell || cell.querySelector('.ulim-attendance-student-link735410')) return;
      var record = recordAt(index);
      if (!record) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'ulim-attendance-student-link735410';
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
    if (date && !date.dataset.ulimRaceGuard735410) {
      date.dataset.ulimRaceGuard735410 = '1';
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
    if (status && !status.dataset.ulimRaceGuard735410) {
      status.dataset.ulimRaceGuard735410 = '1';
      status.addEventListener('change', function () { safeLoadAttendanceSnapshot(false); });
    }
    var filter = document.getElementById('adminAttendanceFilter');
    if (filter && !filter.dataset.ulimRaceGuard735410) {
      filter.dataset.ulimRaceGuard735410 = '1';
      filter.addEventListener('keydown', function (event) { if (event.key === 'Enter') safeLoadAttendanceSnapshot(false); });
    }
    var classDisplay = document.getElementById('adminAttendanceClassDisplay');
    if (classDisplay && !classDisplay.dataset.ulimClassRefresh735410) {
      classDisplay.dataset.ulimClassRefresh735410 = '1';
      classDisplay.addEventListener('click', function () {
        var currentDate = text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value) || today();
        if (!currentGlobalClassList().length) loadClassListFirebaseFirst(currentDate, false);
      }, true);
    }
  }



  var attendanceAddDirectory735410 = null;
  var allClassesDragData735410 = null;
  var allClassesState735410 = {
    month: '',
    weekday: 'all',
    date: '',
    directory: null,
    temporaryRecords: [],
    temporaryDate: '',
    pendingStudentUid: '',
    pendingMode: 'new',
    teacher: 'all',
    selectedCards: new Map(),
    loadSequence: 0,
    loadingKey: '',
    loadingPromise: null,
    renderedKey: ''
  };

  function classByContext735410(directory, className) {
    var target = normalize(className);
    return (directory.classes || []).find(function (item) { return normalize(item.className) === target; }) || null;
  }

  function attendanceAddModeLabel735410(mode) {
    return mode === 'class_move' ? '반이동' : (mode === 'makeup' ? '보강' : (mode === 'daily_special' ? '일일특강' : '신규'));
  }

  function ensureAttendanceAddModal735410() {
    var modal = document.getElementById('ulimAttendanceAddModal735410');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimAttendanceAddModal735410';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:2147483650;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.62)';
    modal.innerHTML = '<section role="dialog" aria-modal="true" style="width:min(720px,96vw);max-height:92vh;background:#fff;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(15,23,42,.38)">'
      + '<header style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #e2e8f0"><div><h3 style="margin:0;font-size:19px">출석부 학생추가</h3><div id="ulimAttendanceAddContext735410" style="font-size:12px;color:#64748b;margin-top:4px"></div></div><button type="button" data-close-att-add="1" style="border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:25px;cursor:pointer">×</button></header>'
      + '<div style="padding:17px 18px;overflow:auto">'
      + '<div style="display:grid;grid-template-columns:180px 1fr;gap:12px"><label style="font-size:12px;font-weight:900;color:#334155">등록 구분<select id="ulimAttendanceAddMode735410" style="width:100%;margin-top:5px;padding:10px;border:1px solid #cbd5e1;border-radius:10px"><option value="new">신규</option><option value="makeup">보강</option><option value="class_move">반이동</option><option value="daily_special">일일특강</option></select></label><label style="font-size:12px;font-weight:900;color:#334155">학생 검색<input id="ulimAttendanceAddSearch735410" type="search" placeholder="학생명·출결번호·전화번호" style="width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid #cbd5e1;border-radius:10px"></label></div>'
      + '<label style="display:block;margin-top:12px;font-size:12px;font-weight:900;color:#334155">학생 선택<select id="ulimAttendanceAddStudent735410" size="9" style="width:100%;box-sizing:border-box;margin-top:5px;padding:8px;border:1px solid #cbd5e1;border-radius:10px"></select></label>'
      + '<label id="ulimAttendanceAddDirectWrap735410" style="display:none;margin-top:12px;font-size:12px;font-weight:900;color:#334155">명단에 없는 학생 이름<input id="ulimAttendanceAddDirectName735410" style="width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid #cbd5e1;border-radius:10px" placeholder="보강생·일일특강생 이름"></label>'
      + '<div id="ulimAttendanceAddHint735410" style="margin-top:12px;padding:10px 12px;border-radius:10px;background:#eff6ff;color:#1e40af;font-size:12px;line-height:1.55"></div></div>'
      + '<footer style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #e2e8f0;background:#f8fafc"><button type="button" class="admin-btn gray" data-close-att-add="1">취소</button><button type="button" class="admin-btn orange" id="ulimAttendanceAddSubmit735410">학생추가</button></footer></section>';
    modal.addEventListener('click', function (event) {
      if (event.target === modal || (event.target && event.target.closest('[data-close-att-add="1"]'))) modal.style.display = 'none';
    });
    document.body.appendChild(modal);
    document.getElementById('ulimAttendanceAddSearch735410').addEventListener('input', renderAttendanceAddCandidates735410);
    document.getElementById('ulimAttendanceAddMode735410').addEventListener('change', updateAttendanceAddMode735410);
    document.getElementById('ulimAttendanceAddSubmit735410').addEventListener('click', submitAttendanceAdd735410);
    return modal;
  }

  function renderAttendanceAddCandidates735410() {
    var select = document.getElementById('ulimAttendanceAddStudent735410');
    if (!select || !attendanceAddDirectory735410) return;
    var query = normalize(document.getElementById('ulimAttendanceAddSearch735410') && document.getElementById('ulimAttendanceAddSearch735410').value);
    var selected = text(select.value);
    var rows = (attendanceAddDirectory735410.students || []).filter(function (student) {
      if (student.enrollmentStatus === 'withdrawn' || student.registrationCancelled === true) return false;
      if (!query) return true;
      return normalize([student.name, student.attendanceNo, student.studentPhone, student.parentPhone, (student.classNames || []).join(' ')].join(' ')).indexOf(query) >= 0;
    }).sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); }).slice(0, 300);
    select.innerHTML = '<option value="">학생을 선택해주세요.</option>' + rows.map(function (student) {
      return '<option value="' + escapeHtml(student.studentUid) + '"' + (student.studentUid === selected ? ' selected' : '') + '>' + escapeHtml(studentCandidateLabel(student)) + '</option>';
    }).join('');
  }

  function updateAttendanceAddMode735410() {
    var mode = text(document.getElementById('ulimAttendanceAddMode735410') && document.getElementById('ulimAttendanceAddMode735410').value) || 'new';
    var directWrap = document.getElementById('ulimAttendanceAddDirectWrap735410');
    var allowDirect = mode === 'makeup' || mode === 'daily_special';
    if (directWrap) directWrap.style.display = allowDirect ? 'block' : 'none';
    var hint = document.getElementById('ulimAttendanceAddHint735410');
    if (hint) hint.textContent = mode === 'new'
      ? '현재 수강반은 유지하고 선택한 반을 신규로 추가합니다.'
      : (mode === 'class_move'
        ? '기존 수강반을 종료하고 선택한 반만 최종 수강반으로 변경합니다.'
        : (mode === 'makeup' ? '선택한 수업일에만 보강 학생으로 추가합니다.' : '선택한 수업일에만 일일특강 학생으로 추가합니다.'));
  }

  async function openAttendanceAddModal735410() {
    if (!isFullAdmin()) return alert('전체관리자 권한이 필요합니다.');
    var context = attendanceContext();
    if (!context.className || context.className === '전체반') return alert('학생을 추가할 반 출석부를 먼저 선택해주세요.');
    var modal = ensureAttendanceAddModal735410();
    var contextEl = document.getElementById('ulimAttendanceAddContext735410');
    if (contextEl) contextEl.textContent = context.date + ' · ' + context.className;
    modal.style.display = 'flex';
    var search = document.getElementById('ulimAttendanceAddSearch735410');
    var select = document.getElementById('ulimAttendanceAddStudent735410');
    var direct = document.getElementById('ulimAttendanceAddDirectName735410');
    if (search) search.value = '';
    if (select) select.innerHTML = '<option>학생목록을 불러오는 중...</option>';
    if (direct) direct.value = '';
    updateAttendanceAddMode735410();
    try {
      attendanceAddDirectory735410 = await loadDirectory(false);
      renderAttendanceAddCandidates735410();
      setTimeout(function () { if (search) search.focus(); }, 30);
    } catch (error) {
      if (select) select.innerHTML = '<option>학생목록을 불러오지 못했습니다.</option>';
      alert(text(error && error.message) || '학생목록을 불러오지 못했습니다.');
    }
  }

  async function updateStudentClass735410(student, targetClass, mode, sourceClassId) {
    var currentIds = unique(student.selectedClassIds);
    var nextIds = currentIds.slice();
    var replace = false;
    if (mode === 'class_move') {
      nextIds = [targetClass.classId];
      replace = true;
    } else if (mode === 'existing') {
      nextIds = unique(currentIds.filter(function (id) { return id !== sourceClassId; }).concat([targetClass.classId]));
      replace = true;
    } else {
      nextIds = unique(currentIds.concat([targetClass.classId]));
      replace = false;
    }
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
      classIds: mode === 'new' ? [targetClass.classId] : nextIds,
      originalClassIds: currentIds,
      replaceClassAssignments: replace,
      registrationType: mode,
      operationDate: mode === 'class_move' ? allClassesSelectedDate735410() : '',
      memo: student.memo,
      privacyConsent: student.privacyConsent === true,
      portraitConsent: student.portraitConsent === true,
      preserveLegacyClassNames: unique(student.legacyUnmappedClassNames),
      requestId: requestId('attendance-class-update-735410')
    });
    student.selectedClassIds = nextIds;
    student.classNames = nextIds.map(function (id) {
      var cls = (allClassesState735410.directory && allClassesState735410.directory.classes || []).find(function (item) { return item.classId === id; });
      return cls ? cls.className : '';
    }).filter(Boolean);
  }

  async function submitAttendanceAdd735410() {
    var context = attendanceContext();
    var directory = attendanceAddDirectory735410;
    if (!directory) return alert('학생목록을 다시 불러와주세요.');
    var targetClass = classByContext735410(directory, context.className);
    if (!targetClass) return alert('선택한 반 정보를 찾지 못했습니다. 반 목록을 새로고침해주세요.');
    var mode = text(document.getElementById('ulimAttendanceAddMode735410').value) || 'new';
    var studentUid = text(document.getElementById('ulimAttendanceAddStudent735410').value);
    var directName = text(document.getElementById('ulimAttendanceAddDirectName735410').value);
    var student = directory.students.find(function (item) { return item.studentUid === studentUid; }) || null;
    if (!student && mode !== 'makeup' && mode !== 'daily_special') return alert('학생목록에서 학생을 선택해주세요.');
    if (!student && !directName) return alert('기존 학생을 선택하거나 학생명을 입력해주세요.');
    var studentName = student ? student.name : directName;
    if (!confirm(context.date + '\n' + targetClass.className + '\n' + studentName + ' · ' + attendanceAddModeLabel735410(mode) + '\n\n추가할까요?')) return;
    try {
      if (typeof global.showLoading === 'function') global.showLoading(studentName + ' 학생을 추가하는 중...');
      if (mode === 'makeup' || mode === 'daily_special') {
        await call('addTemporaryAttendanceAdmin7354', {
          studentUid: student ? student.studentUid : '',
          studentName: studentName,
          kind: mode,
          date: context.date,
          classId: targetClass.classId,
          className: targetClass.className,
          requestId: requestId('attendance-add-735410')
        });
      } else {
        await updateStudentClass735410(student, targetClass, mode, '');
      }
      directoryCache = null;
      directoryLoadedAt = 0;
      document.getElementById('ulimAttendanceAddModal735410').style.display = 'none';
      await safeLoadAttendanceSnapshot(false);
      alert(studentName + ' 학생을 추가했습니다.');
    } catch (error) {
      alert(text(error && error.message) || '학생을 추가하지 못했습니다.');
    } finally {
      if (typeof global.hideLoading === 'function') global.hideLoading();
    }
  }

  function monthValue735410(dateValue) {
    var value = text(dateValue);
    return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : today().slice(0, 7);
  }

  function allClassesSelectedDate735410() {
    var select = document.getElementById('ulimAllClassesDate735410');
    return text(select && select.value) || allClassesState735410.date || attendanceContext().date;
  }

  function dateListForMonth735410(month, weekday) {
    if (!/^\d{4}-\d{2}$/.test(month)) return [];
    var parts = month.split('-').map(Number);
    var year = parts[0];
    var monthIndex = parts[1] - 1;
    var result = [];
    var cursor = new Date(year, monthIndex, 1);
    while (cursor.getMonth() === monthIndex) {
      if (weekday === 'all' || cursor.getDay() === Number(weekday)) {
        result.push([cursor.getFullYear(), String(cursor.getMonth() + 1).padStart(2, '0'), String(cursor.getDate()).padStart(2, '0')].join('-'));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  function syncAllClassesDateOptions735410() {
    var monthEl = document.getElementById('ulimAllClassesMonth735410');
    var weekdayEl = document.getElementById('ulimAllClassesWeekday735410');
    var dateEl = document.getElementById('ulimAllClassesDate735410');
    if (!monthEl || !weekdayEl || !dateEl) return;
    var month = text(monthEl.value) || monthValue735410(attendanceContext().date);
    var weekday = text(weekdayEl.value) || 'all';
    var previous = text(dateEl.value || allClassesState735410.date || attendanceContext().date);
    var dates = dateListForMonth735410(month, weekday);
    var labels = ['일','월','화','수','목','금','토'];
    dateEl.innerHTML = dates.map(function (dateValue) {
      var day = new Date(dateValue + 'T00:00:00').getDay();
      return '<option value="' + dateValue + '">' + dateValue.slice(5).replace('-', '/') + ' (' + labels[day] + ')</option>';
    }).join('');
    var selected = dates.indexOf(previous) >= 0 ? previous : '';
    if (!selected) {
      var contextDate = attendanceContext().date;
      selected = dates.indexOf(contextDate) >= 0 ? contextDate : (dates[0] || '');
    }
    dateEl.value = selected;
    allClassesState735410.month = month;
    allClassesState735410.weekday = weekday;
    allClassesState735410.date = selected;
  }

  function ensureAllClassesModal735410() {
    var modal = document.getElementById('ulimAllClassesAttendanceModal735410');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimAllClassesAttendanceModal735410';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:2147483500;background:rgba(15,23,42,.62);padding:12px;box-sizing:border-box';
    modal.innerHTML = '<section style="height:calc(100vh - 24px);background:#fff;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(15,23,42,.38)">'
      + '<header style="padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#fff"><div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><h3 style="margin:0;font-size:19px">전체반 출석부</h3><div id="ulimAllClassesContext735410" style="font-size:12px;color:#64748b;margin-top:4px"></div></div><div style="display:flex;align-items:end;gap:8px;flex-wrap:wrap"><label style="font-size:11px;font-weight:900;color:#334155">월<input id="ulimAllClassesMonth735410" type="month" style="display:block;margin-top:4px;padding:8px;border:1px solid #cbd5e1;border-radius:9px"></label><label style="font-size:11px;font-weight:900;color:#334155">요일<select id="ulimAllClassesWeekday735410" style="display:block;margin-top:4px;padding:8px;border:1px solid #cbd5e1;border-radius:9px"><option value="all">전체요일</option><option value="1">월요일</option><option value="2">화요일</option><option value="3">수요일</option><option value="4">목요일</option><option value="5">금요일</option><option value="6">토요일</option><option value="0">일요일</option></select></label><label style="font-size:11px;font-weight:900;color:#334155">수업일<select id="ulimAllClassesDate735410" style="display:block;margin-top:4px;padding:8px;border:1px solid #cbd5e1;border-radius:9px;min-width:112px"></select></label><label style="font-size:11px;font-weight:900;color:#334155">강사<select id="ulimAllClassesTeacher735413" style="display:block;margin-top:4px;padding:8px;border:1px solid #cbd5e1;border-radius:9px;min-width:110px"><option value="all">전체강사</option></select></label><label style="font-size:11px;font-weight:900;color:#334155">기존 카드 이동<select id="ulimAllClassesMoveMode735410" style="display:block;margin-top:4px;padding:8px;border:1px solid #cbd5e1;border-radius:9px"><option value="existing">일반 수정</option><option value="new">신규</option><option value="class_move">반이동</option><option value="makeup">보강</option></select></label><button type="button" class="admin-btn red" id="ulimAllClassesRemoveSelected735413">선택 학생 제거</button><button type="button" class="admin-btn blue" id="ulimAllClassesReload735410">새로고침</button><button type="button" class="admin-btn gray" data-close-all-classes="1">닫기</button></div></div></header>'
      + '<div style="padding:10px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0"><div style="font-size:12px;color:#475569;line-height:1.55;margin-bottom:9px"><b>기존 학생카드</b>는 다른 반으로 끌어 놓아 이동합니다. 일반 수정은 잘못 연결된 반만 바로잡고 신규·반이동·보강 기록을 만들지 않습니다.</div><div style="display:grid;grid-template-columns:150px minmax(220px,1fr) 190px auto;gap:8px;align-items:end"><label style="font-size:11px;font-weight:900;color:#334155">학생 추가 구분<select id="ulimAllClassesAddMode735410" style="width:100%;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:9px"><option value="new">신규</option><option value="makeup">보강</option><option value="class_move">반이동</option></select></label><label style="font-size:11px;font-weight:900;color:#334155">학생 검색<input id="ulimAllClassesStudentSearch735410" type="search" placeholder="학생명·출결번호·전화번호" style="width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:9px"></label><label style="font-size:11px;font-weight:900;color:#334155">학생 선택<select id="ulimAllClassesStudentSelect735410" style="width:100%;margin-top:4px;padding:9px;border:1px solid #cbd5e1;border-radius:9px"></select></label><button type="button" class="admin-btn orange" id="ulimAllClassesCreatePending735410">추가 대기카드 만들기</button></div><div id="ulimAllClassesPendingTray735410" style="margin-top:9px;min-height:44px;padding:7px;border:1px dashed #94a3b8;border-radius:11px;background:#fff;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:12px;color:#64748b">학생을 선택해 대기카드를 만든 뒤 원하는 반으로 끌어 놓으세요.</span></div></div>'
      + '<div id="ulimAllClassesBoard735410" style="flex:1;overflow:auto;padding:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;align-items:start"></div>'
      + '<div id="ulimAllClassesStatus735410" style="padding:10px 16px;border-top:1px solid #e2e8f0;min-height:20px;font-size:13px;font-weight:800;color:#475569"></div>'
      + '</section>';
    modal.addEventListener('click', function (event) {
      if (event.target === modal || (event.target && event.target.closest('[data-close-all-classes="1"]'))) modal.style.display = 'none';
    });
    document.body.appendChild(modal);
    document.getElementById('ulimAllClassesReload735410').addEventListener('click', function () { renderAllClassesBoard735410(true); });
    document.getElementById('ulimAllClassesMonth735410').addEventListener('change', function () { syncAllClassesDateOptions735410(); renderAllClassesBoard735410(false); });
    document.getElementById('ulimAllClassesWeekday735410').addEventListener('change', function () { syncAllClassesDateOptions735410(); renderAllClassesBoard735410(false); });
    document.getElementById('ulimAllClassesDate735410').addEventListener('change', function () { allClassesState735410.date = text(this.value); renderAllClassesBoard735410(false); });
    document.getElementById('ulimAllClassesTeacher735413').addEventListener('change', function () { allClassesState735410.teacher = text(this.value) || 'all'; renderAllClassesBoardLocal735410(); });
    document.getElementById('ulimAllClassesRemoveSelected735413').addEventListener('click', removeSelectedAllClassStudents735413);
    document.getElementById('ulimAllClassesStudentSearch735410').addEventListener('input', renderAllClassesStudentOptions735410);
    document.getElementById('ulimAllClassesCreatePending735410').addEventListener('click', createAllClassesPendingCard735410);
    return modal;
  }

  function setAllClassesStatus735410(message, error) {
    var el = document.getElementById('ulimAllClassesStatus735410');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = error ? '#b91c1c' : '#166534';
  }

  function renderAllClassesStudentOptions735410() {
    var directory = allClassesState735410.directory;
    var select = document.getElementById('ulimAllClassesStudentSelect735410');
    if (!directory || !select) return;
    var query = normalize(document.getElementById('ulimAllClassesStudentSearch735410') && document.getElementById('ulimAllClassesStudentSearch735410').value);
    var selected = text(select.value);
    var rows = directory.students.filter(function (student) {
      if (student.enrollmentStatus === 'withdrawn' || student.registrationCancelled === true) return false;
      if (!query) return true;
      return normalize([student.name, student.attendanceNo, student.studentPhone, student.parentPhone, (student.classNames || []).join(' ')].join(' ')).indexOf(query) >= 0;
    }).sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); }).slice(0, 300);
    select.innerHTML = '<option value="">학생 선택</option>' + rows.map(function (student) {
      return '<option value="' + escapeHtml(student.studentUid) + '"' + (student.studentUid === selected ? ' selected' : '') + '>' + escapeHtml(studentCandidateLabel(student)) + '</option>';
    }).join('');
  }

  function renderAllClassesPendingTray735410() {
    var tray = document.getElementById('ulimAllClassesPendingTray735410');
    var directory = allClassesState735410.directory;
    if (!tray || !directory) return;
    var student = directory.students.find(function (item) { return item.studentUid === allClassesState735410.pendingStudentUid; });
    if (!student) {
      tray.innerHTML = '<span style="font-size:12px;color:#64748b">학생을 선택해 대기카드를 만든 뒤 원하는 반으로 끌어 놓으세요.</span>';
      return;
    }
    var label = attendanceAddModeLabel735410(allClassesState735410.pendingMode);
    tray.innerHTML = '<div id="ulimAllClassesPendingCard735410" draggable="true" style="padding:9px 12px;border:2px solid #f97316;border-radius:10px;background:#fff7ed;cursor:grab;font-size:13px;font-weight:900;color:#9a3412">' + escapeHtml(student.name) + ' · ' + escapeHtml(label) + '<span style="font-size:11px;font-weight:700;margin-left:6px">원하는 반으로 끌기</span></div><button type="button" id="ulimAllClassesPendingClear735410" style="border:0;background:#e2e8f0;border-radius:8px;padding:7px 9px;cursor:pointer">취소</button>';
    var card = document.getElementById('ulimAllClassesPendingCard735410');
    card.addEventListener('dragstart', function () {
      allClassesDragData735410 = { kind: 'pending', studentUid: student.studentUid, mode: allClassesState735410.pendingMode, sourceClassId: '' };
      card.style.opacity = '.55';
    });
    card.addEventListener('dragend', function () { card.style.opacity = ''; });
    document.getElementById('ulimAllClassesPendingClear735410').addEventListener('click', function () {
      allClassesState735410.pendingStudentUid = '';
      renderAllClassesPendingTray735410();
    });
  }

  function createAllClassesPendingCard735410() {
    var studentUid = text(document.getElementById('ulimAllClassesStudentSelect735410') && document.getElementById('ulimAllClassesStudentSelect735410').value);
    var mode = text(document.getElementById('ulimAllClassesAddMode735410') && document.getElementById('ulimAllClassesAddMode735410').value) || 'new';
    if (!studentUid) return alert('추가할 학생을 선택해주세요.');
    allClassesState735410.pendingStudentUid = studentUid;
    allClassesState735410.pendingMode = mode;
    renderAllClassesPendingTray735410();
  }

  function classForRecord735410(record, directory) {
    var classId = text(record.classId);
    if (classId) {
      var exact = directory.classes.find(function (item) { return item.classId === classId; });
      if (exact) return exact;
    }
    var className = normalize(record.className);
    return directory.classes.find(function (item) { return normalize(item.className) === className; }) || null;
  }

  function studentForRecord735410(record, directory) {
    var uid = text(record.studentUid || record.studentIdentityKey || record.studentKey);
    if (uid) {
      var exact = directory.students.find(function (item) { return item.studentUid === uid; });
      if (exact) return exact;
    }
    var candidates = resolveStudentCandidates(record, directory);
    return candidates.length === 1 ? candidates[0] : null;
  }

  function syncAllClassesTeacherOptions735413(directory) {
    var select = document.getElementById('ulimAllClassesTeacher735413');
    if (!select || !directory) return;
    var selected = text(select.value || allClassesState735410.teacher) || 'all';
    var teachers = unique((directory.classes || []).map(function (cls) { return allClassesTeacherName735412(cls); })).sort(function (a,b) { return a.localeCompare(b, 'ko'); });
    select.innerHTML = '<option value="all">전체강사</option>' + teachers.map(function (teacher) { return '<option value="' + escapeHtml(teacher) + '">' + escapeHtml(teacher) + '</option>'; }).join('');
    select.value = teachers.indexOf(selected) >= 0 ? selected : 'all';
    allClassesState735410.teacher = select.value || 'all';
  }

  function allClassesVisibleClasses735410(directory) {
    var weekday = text(document.getElementById('ulimAllClassesWeekday735410') && document.getElementById('ulimAllClassesWeekday735410').value) || allClassesState735410.weekday || 'all';
    var teacher = text(document.getElementById('ulimAllClassesTeacher735413') && document.getElementById('ulimAllClassesTeacher735413').value) || allClassesState735410.teacher || 'all';
    return directory.classes.filter(function (item) {
      if (item.selectable === false) return false;
      if (weekday !== 'all' && item.weekday !== Number(weekday)) return false;
      if (teacher !== 'all' && allClassesTeacherName735412(item) !== teacher) return false;
      return true;
    }).sort(function (a, b) {
      var aw = a.weekday < 0 ? 9 : a.weekday;
      var bw = b.weekday < 0 ? 9 : b.weekday;
      return aw - bw || a.className.localeCompare(b.className, 'ko');
    });
  }

  function allClassesTeacherName735412(cls) {
    var explicit = text(cls && (cls.instructorName || cls.teacher || cls.teacherName));
    if (explicit) return explicit.replace(/\s*T\s*$/i, '').trim() + 'T';
    var matched = text(cls && cls.className).match(/^\s*\[([^\]]+)\]\s*/);
    var teacher = matched ? text(matched[1]).replace(/\s*T\s*$/i, '').trim() : '';
    return teacher ? teacher + 'T' : '담당강사 미지정';
  }

  function allClassesClassLabel735412(cls) {
    return text(cls && cls.className).replace(/^\s*\[[^\]]+\]\s*[-–—:]?\s*/, '').trim();
  }

  function allClassesStartMinutes735412(cls) {
    var start = text(cls && cls.startTime);
    var source = start || text(cls && cls.className);
    var matched = source.match(/(\d{1,2})\s*:\s*(\d{2})/);
    return matched ? Number(matched[1]) * 60 + Number(matched[2]) : 99999;
  }

  function renderAllClassesBoardLocal735410() {
    var board = document.getElementById('ulimAllClassesBoard735410');
    var directory = allClassesState735410.directory;
    if (!board || !directory) return;
    syncAllClassesTeacherOptions735413(directory);
    var activeClasses = allClassesVisibleClasses735410(directory);
    var grouped = new Map(activeClasses.map(function (item) { return [item.classId, []]; }));
    var seen = new Set();
    directory.students.forEach(function (student) {
      if (student.registrationCancelled === true || student.enrollmentStatus === 'withdrawn') return;
      unique(student.selectedClassIds).forEach(function (classId) {
        if (!grouped.has(classId)) return;
        var key = classId + '|' + student.studentUid;
        if (seen.has(key)) return;
        seen.add(key);
        grouped.get(classId).push({ student: student, sourceClassId: classId, temporary: false, specialStatus: '' });
      });
    });
    (allClassesState735410.temporaryRecords || []).forEach(function (record, temporaryRecordIndex) {
      var cls = classForRecord735410(record, directory);
      if (!cls || !grouped.has(cls.classId)) return;
      var student = studentForRecord735410(record, directory);
      var uid = student ? student.studentUid : text(record.studentUid || record.studentIdentityKey || record.studentName || record.name);
      var key = cls.classId + '|' + uid;
      var special = text(record.specialStatus || record.registrationType || record.kind);
      if (seen.has(key)) {
        var existing = grouped.get(cls.classId).find(function (entry) { return entry.student && entry.student.studentUid === uid; });
        if (existing && special) {
          existing.specialStatus = special;
          existing.specialRecord = record;
          existing.specialRecordIndex = temporaryRecordIndex;
        }
        return;
      }
      seen.add(key);
      grouped.get(cls.classId).push({
        student: student || { studentUid: '', name: text(record.studentName || record.name), attendanceNo: text(record.attendanceNo || record.studentNo), enrollmentStatus: 'active' },
        sourceClassId: cls.classId,
        temporary: true,
        temporaryRecordIndex: temporaryRecordIndex,
        record: record,
        specialStatus: special || '임시'
      });
    });
    if (!activeClasses.length) {
      board.innerHTML = '<div style="padding:32px;text-align:center;color:#64748b">선택한 요일의 반이 없습니다.</div>';
      setAllClassesStatus735410('선택한 월·요일 조건에 맞는 반이 없습니다.');
      return;
    }
    function columnHtml(cls, rows) {
      rows.sort(function (a, b) { return text(a.student && a.student.name).localeCompare(text(b.student && b.student.name), 'ko'); });
      return '<section data-all-class-drop="' + escapeHtml(cls.classId) + '" style="border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;min-height:160px;overflow:hidden">'
        + '<header style="padding:11px 12px;background:#e0f2fe;border-bottom:1px solid #bae6fd;font-size:13px;font-weight:900;color:#075985">' + escapeHtml(allClassesClassLabel735412(cls)) + '<span style="float:right">' + rows.length + '명</span></header>'
        + '<div style="display:grid;gap:7px;padding:9px;min-height:100px">'
        + rows.map(function (entry) {
          var student = entry.student || {};
          var temporaryIndex = Number.isInteger(entry.temporaryRecordIndex) ? entry.temporaryRecordIndex : (Number.isInteger(entry.specialRecordIndex) ? entry.specialRecordIndex : -1);
          var isTemporaryMove = temporaryIndex >= 0 && !!entry.temporary;
          var draggable = !!student.studentUid || isTemporaryMove;
          var sub = [student.attendanceNo ? '출결 ' + student.attendanceNo : '', entry.specialStatus].filter(Boolean).join(' · ');
          return '<div draggable="' + (draggable ? 'true' : 'false') + '" data-all-student="' + escapeHtml(student.studentUid || '') + '" data-source-class="' + escapeHtml(entry.sourceClassId || cls.classId) + '" data-temporary-index="' + temporaryIndex + '" data-temporary-card="' + (isTemporaryMove ? '1' : '0') + '" style="padding:9px 10px;border:1px solid ' + (entry.temporary || entry.specialStatus ? '#f59e0b' : '#e2e8f0') + ';border-radius:10px;background:' + (entry.temporary || entry.specialStatus ? '#fffbeb' : '#fff') + ';cursor:' + (draggable ? 'grab' : 'default') + ';font-size:13px"><label style="display:flex;gap:7px;align-items:flex-start;cursor:pointer"><input type="checkbox" class="ulim-all-student-select735413" data-select-student="' + escapeHtml(student.studentUid || '') + '" data-select-class="' + escapeHtml(entry.sourceClassId || cls.classId) + '" data-select-temporary-index="' + temporaryIndex + '" data-select-temporary="' + (isTemporaryMove ? '1' : '0') + '" style="margin-top:2px"><span><b>' + escapeHtml(student.name || '') + '</b>' + (sub ? '<div style="font-size:10px;color:' + (entry.temporary || entry.specialStatus ? '#92400e' : '#64748b') + ';margin-top:3px">' + escapeHtml(sub) + '</div>' : '') + '</span></label></div>';
        }).join('')
        + '</div></section>';
    }
    var teacherGroups = new Map();
    activeClasses.forEach(function (cls) {
      var teacher = allClassesTeacherName735412(cls);
      if (!teacherGroups.has(teacher)) teacherGroups.set(teacher, []);
      teacherGroups.get(teacher).push(cls);
    });
    var orderedTeachers = Array.from(teacherGroups.keys()).sort(function (left, right) {
      if (left === '담당강사 미지정') return 1;
      if (right === '담당강사 미지정') return -1;
      return left.replace(/T$/i, '').localeCompare(right.replace(/T$/i, ''), 'ko');
    });
    board.innerHTML = orderedTeachers.map(function (teacher) {
      var classes = teacherGroups.get(teacher) || [];
      classes.sort(function (left, right) {
        return allClassesStartMinutes735412(left) - allClassesStartMinutes735412(right) ||
          allClassesClassLabel735412(left).localeCompare(allClassesClassLabel735412(right), 'ko');
      });
      return '<div class="ulim-all-teacher-column735412" data-all-teacher="' + escapeHtml(teacher) + '" style="min-width:340px;max-width:390px;width:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:16px;background:#eef2f7;overflow:hidden">'
        + '<div class="ulim-all-teacher-header735412" style="padding:12px 14px;background:#1e3a8a;color:#fff;font-size:16px;font-weight:950;border-bottom:1px solid #1e40af">' + escapeHtml(teacher) + '</div>'
        + '<div class="ulim-all-teacher-classes735412" style="display:flex;flex-direction:column;gap:12px;padding:10px;min-width:0">'
        + classes.map(function (cls) { return columnHtml(cls, grouped.get(cls.classId) || []); }).join('')
        + '</div></div>';
    }).join('');
    board.style.display = 'grid';
    board.style.gridTemplateColumns = 'none';
    board.style.gridAutoFlow = 'column';
    board.style.gridAutoColumns = 'minmax(340px,390px)';
    board.style.alignItems = 'start';
    board.querySelectorAll('[draggable="true"][data-all-student]').forEach(function (card) {
      card.addEventListener('dragstart', function () {
        var temporaryIndex = Number(card.getAttribute('data-temporary-index'));
        var temporaryCard = card.getAttribute('data-temporary-card') === '1' && Number.isInteger(temporaryIndex) && temporaryIndex >= 0;
        allClassesDragData735410 = {
          kind: temporaryCard ? 'temporary' : 'existing',
          temporaryRecordIndex: temporaryCard ? temporaryIndex : -1,
          studentUid: text(card.getAttribute('data-all-student')),
          sourceClassId: text(card.getAttribute('data-source-class')),
          mode: text(document.getElementById('ulimAllClassesMoveMode735410') && document.getElementById('ulimAllClassesMoveMode735410').value) || 'existing'
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
        if (!allClassesDragData735410 || !targetClassId) return;
        applyAllClassesDrop735410(allClassesDragData735410, targetClassId);
      });
    });
    board.querySelectorAll('.ulim-all-student-select735413').forEach(function (checkbox) {
      var key = [text(checkbox.getAttribute('data-select-student')), text(checkbox.getAttribute('data-select-class')), text(checkbox.getAttribute('data-select-temporary-index'))].join('|');
      checkbox.checked = allClassesState735410.selectedCards.has(key);
      checkbox.addEventListener('click', function (event) { event.stopPropagation(); });
      checkbox.addEventListener('change', function () {
        var payload = {
          studentUid: text(checkbox.getAttribute('data-select-student')),
          classId: text(checkbox.getAttribute('data-select-class')),
          temporaryIndex: Number(checkbox.getAttribute('data-select-temporary-index')),
          temporary: checkbox.getAttribute('data-select-temporary') === '1'
        };
        if (checkbox.checked) allClassesState735410.selectedCards.set(key, payload);
        else allClassesState735410.selectedCards.delete(key);
      });
    });
    renderAllClassesStudentOptions735410();
    renderAllClassesPendingTray735410();
    allClassesState735410.renderedKey = [allClassesState735410.month, allClassesState735410.weekday, allClassesState735410.date].join('|');
    setAllClassesStatus735410('표시 반 ' + activeClasses.length + '개 · 재원 학생카드 ' + seen.size + '개 · 수업일 ' + (allClassesState735410.date || '-'));
  }

  async function loadAllClassesData735410(force) {
    var dateValue = allClassesSelectedDate735410();
    var key = dateValue + '|' + (force === true ? 'force' : 'normal');
    if (allClassesState735410.loadingPromise && allClassesState735410.loadingKey === key) return allClassesState735410.loadingPromise;
    var sequence = ++allClassesState735410.loadSequence;
    allClassesState735410.loadingKey = key;
    var board = document.getElementById('ulimAllClassesBoard735410');
    if (!allClassesState735410.directory && board) board.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b">전체반 명단을 처음 한 번 불러오는 중...</div>';
    setAllClassesStatus735410(force ? '전체반 자료를 새로고침하는 중...' : '전체반 자료를 불러오는 중...');
    allClassesState735410.loadingPromise = (async function () {
      try {
        var directoryPromise = (!allClassesState735410.directory || force) ? loadDirectory(force === true) : Promise.resolve(allClassesState735410.directory);
        var tempPromise = (!dateValue || (!force && allClassesState735410.temporaryDate === dateValue))
          ? Promise.resolve({ records: allClassesState735410.temporaryRecords })
          : call('getStaffAttendanceOperationalSnapshot', { date: dateValue, className: '전체반', keyword: '', statusFilter: '', requestId: requestId('all-classes-attendance-735410') });
        var values = await Promise.all([directoryPromise, tempPromise]);
        if (sequence !== allClassesState735410.loadSequence) return { stale: true };
        allClassesState735410.directory = values[0];
        allClassesState735410.temporaryRecords = Array.isArray(values[1] && values[1].records) ? values[1].records : [];
        allClassesState735410.temporaryDate = dateValue;
        renderAllClassesBoardLocal735410();
        return { ok: true };
      } catch (error) {
        if (sequence !== allClassesState735410.loadSequence) return { stale: true };
        if (!allClassesState735410.directory && board) board.innerHTML = '<div style="padding:30px;text-align:center;color:#b91c1c">' + escapeHtml(text(error && error.message) || '전체반을 불러오지 못했습니다.') + '</div>';
        setAllClassesStatus735410(text(error && error.message) || '전체반을 불러오지 못했습니다.', true);
        return { ok: false };
      } finally {
        if (sequence === allClassesState735410.loadSequence) {
          allClassesState735410.loadingPromise = null;
          allClassesState735410.loadingKey = '';
        }
      }
    })();
    return allClassesState735410.loadingPromise;
  }

  function renderAllClassesBoard735410(force) {
    syncAllClassesDateOptions735410();
    if (allClassesState735410.directory) renderAllClassesBoardLocal735410();
    return loadAllClassesData735410(force === true);
  }

  function temporaryKind735412(record) {
    var raw = normalize(record && (record.registrationType || record.kind || record.specialStatus || record.specialType));
    if (raw === normalize('일일특강') || raw === 'daily_special') return 'daily_special';
    if (raw === normalize('반이동') || raw === 'class_move') return 'class_move';
    if (raw === normalize('신규') || raw === 'new') return 'new';
    return 'makeup';
  }

  function temporaryLabel735412(kind) {
    return kind === 'daily_special' ? '일일특강' : (kind === 'class_move' ? '반이동' : (kind === 'new' ? '신규' : '보강'));
  }

  async function moveTemporaryAttendance735412(record, recordIndex, target, directory) {
    var sourceClassId = text(record.classId);
    if (sourceClassId === target.classId) return { skipped: true };
    var kind = temporaryKind735412(record);
    if (kind === 'new' || kind === 'class_move') {
      var regularStudentUid = text(record.studentUid || record.studentIdentityKey || record.studentKey);
      var regularStudent = directory.students.find(function (item) { return item.studentUid === regularStudentUid; });
      if (!regularStudent) throw new Error('신규·반이동 학생의 학생목록 연결정보를 찾지 못했습니다. 전체반을 새로고침한 뒤 다시 시도해주세요.');
      await updateStudentClass735410(regularStudent, target, 'existing', sourceClassId);
      return { regular: true, student: regularStudent };
    }

    var sourceRecordId = text(record.attendanceRecordId || record.recordId || record.id);
    var sourceStudentUid = text(record.studentUid || record.studentIdentityKey || record.studentKey);
    var linkedStudent = directory.students.find(function (item) { return item.studentUid === sourceStudentUid; });
    var temporaryOnly = record.temporaryStudent === true || /^TMPATT_/i.test(sourceStudentUid);
    var studentName = text(record.studentName || record.name || (linkedStudent && linkedStudent.name));
    if (!studentName) throw new Error('이동할 임시 학생명을 찾지 못했습니다.');
    var dateValue = text(record.sessionDate || record.date) || allClassesSelectedDate735410();
    var createPayload = {
      studentName: studentName,
      kind: kind,
      date: dateValue,
      classId: target.classId,
      className: target.className,
      requestId: requestId('all-class-temp-create-735412')
    };
    if (linkedStudent && !temporaryOnly) createPayload.studentUid = linkedStudent.studentUid;

    var created = await call('addTemporaryAttendanceAdmin7354', createPayload);
    var createdRecordId = text(created && (created.attendanceRecordId || created.recordId));
    try {
      await call('removeAttendanceStudentAdmin73545', {
        attendanceRecordId: sourceRecordId,
        recordId: sourceRecordId,
        date: dateValue,
        classId: sourceClassId,
        className: text(record.className),
        studentUid: sourceStudentUid,
        studentName: studentName,
        attendanceNo: text(record.attendanceNo || record.studentNo),
        studentPhone: text(record.studentPhone || record.phone),
        birthDate: text(record.birthDate || record.dateOfBirth),
        requestId: requestId('all-class-temp-remove-735412')
      });
    } catch (removeError) {
      if (createdRecordId) {
        try {
          await call('removeAttendanceStudentAdmin73545', {
            attendanceRecordId: createdRecordId,
            recordId: createdRecordId,
            date: dateValue,
            classId: target.classId,
            className: target.className,
            studentUid: text(created && created.studentUid),
            studentName: studentName,
            requestId: requestId('all-class-temp-rollback-735412')
          });
        } catch (_rollbackError) {
          throw new Error('원래 반 삭제에 실패했고 새 반 자동 원복도 완료하지 못했습니다. 전체반을 새로고침해 중복 여부를 확인해주세요.');
        }
      }
      throw removeError;
    }

    var replacement = Object.assign({}, record, {
      attendanceRecordId: createdRecordId,
      recordId: createdRecordId,
      classId: target.classId,
      className: target.className,
      date: dateValue,
      sessionDate: dateValue,
      registrationType: kind,
      kind: kind,
      specialStatus: temporaryLabel735412(kind),
      studentUid: text(created && created.studentUid) || sourceStudentUid,
      studentName: studentName,
      active: true
    });
    allClassesState735410.temporaryRecords.splice(recordIndex, 1, replacement);
    return { temporary: true, record: replacement, student: linkedStudent || { studentUid: '', name: studentName, attendanceNo: text(record.attendanceNo || record.studentNo) } };
  }

  async function removeSelectedAllClassStudents735413() {
    if (!isFullAdmin()) return alert('관리자 권한이 필요합니다.');
    var selected = Array.from(allClassesState735410.selectedCards.values());
    if (!selected.length) return alert('제거할 학생을 먼저 체크해주세요.');
    if (!confirm('선택한 ' + selected.length + '개 학생카드를 현재 반에서 제거할까요?')) return;
    var directory = allClassesState735410.directory;
    if (!directory) return alert('전체반 자료를 다시 불러와주세요.');
    try {
      if (typeof global.showLoading === 'function') global.showLoading('선택 학생을 출석부에서 제거하는 중...');
      for (var i = 0; i < selected.length; i += 1) {
        var item = selected[i];
        if (item.temporary && Number.isInteger(item.temporaryIndex) && item.temporaryIndex >= 0) {
          var record = allClassesState735410.temporaryRecords[item.temporaryIndex];
          if (!record) continue;
          await call('removeAttendanceStudentAdmin73545', {
            attendanceRecordId: text(record.attendanceRecordId || record.recordId),
            recordId: text(record.attendanceRecordId || record.recordId),
            date: text(record.sessionDate || record.date) || allClassesSelectedDate735410(),
            classId: text(record.classId || item.classId),
            className: text(record.className),
            studentUid: text(record.studentUid || record.studentIdentityKey),
            studentName: text(record.studentName || record.name),
            requestId: requestId('all-class-remove-temp-735413')
          });
          record.active = false;
          continue;
        }
        var student = directory.students.find(function (row) { return row.studentUid === item.studentUid; });
        if (!student) continue;
        var nextIds = unique(student.selectedClassIds).filter(function (id) { return id !== item.classId; });
        if (!nextIds.length && student.enrollmentStatus !== 'withdrawn') {
          throw new Error(student.name + ' 학생은 마지막 수강반이므로 학생목록에서 재원상태/수강반을 먼저 수정해주세요.');
        }
        await call('updateStudentAdmin7352', {
          studentUid: student.studentUid, name: student.name, attendanceNo: student.attendanceNo, changeAttendanceNo: false,
          studentPhone: student.studentPhone, parentPhone: student.parentPhone, birthDate: student.birthDate || '',
          initialRegisteredDate: student.initialRegisteredDate, enrollmentStatus: student.enrollmentStatus,
          classIds: nextIds, originalClassIds: unique(student.selectedClassIds), replaceClassAssignments: true, registrationType: 'existing',
          memo: student.memo, privacyConsent: student.privacyConsent === true, portraitConsent: student.portraitConsent === true,
          preserveLegacyClassNames: unique(student.legacyUnmappedClassNames), requestId: requestId('all-class-remove-regular-735413')
        });
        student.selectedClassIds = nextIds;
      }
      allClassesState735410.selectedCards.clear();
      directoryCache = null; directoryLoadedAt = 0;
      await loadAllClassesData735410(true);
    } catch (error) {
      alert(text(error && error.message) || '학생 제거에 실패했습니다.');
    } finally { if (typeof global.hideLoading === 'function') global.hideLoading(); }
  }

  async function applyAllClassesDrop735410(drag, targetClassId) {
    var directory = allClassesState735410.directory;
    if (!directory) return alert('전체반 자료를 다시 불러와주세요.');
    var target = directory.classes.find(function (item) { return item.classId === targetClassId; });
    if (!target) return alert('이동할 반을 찾지 못했습니다.');

    var temporaryRecord = drag.kind === 'temporary'
      ? allClassesState735410.temporaryRecords[Number(drag.temporaryRecordIndex)]
      : null;
    var student = directory.students.find(function (item) { return item.studentUid === drag.studentUid; });
    if (!student && temporaryRecord) {
      student = {
        studentUid: '',
        name: text(temporaryRecord.studentName || temporaryRecord.name),
        attendanceNo: text(temporaryRecord.attendanceNo || temporaryRecord.studentNo)
      };
    }
    if (!student || !student.name) return alert('이동할 학생정보를 찾지 못했습니다.');

    var mode = drag.kind === 'pending' ? drag.mode : (drag.mode || 'existing');
    if (drag.kind !== 'pending' && drag.sourceClassId === targetClassId) return;
    var labels = { existing: '일반 수정', new: '신규', class_move: '반이동', makeup: '보강', daily_special: '일일특강' };
    var actionLabel = drag.kind === 'temporary' ? temporaryLabel735412(temporaryKind735412(temporaryRecord)) + ' 이동' : (labels[mode] || '이동');
    if (!confirm(student.name + ' 학생을\n' + target.className + '\n반으로 ' + actionLabel + ' 처리할까요?')) return;
    try {
      setAllClassesStatus735410(student.name + ' 학생을 처리하는 중...');
      if (drag.kind === 'temporary') {
        await moveTemporaryAttendance735412(temporaryRecord, Number(drag.temporaryRecordIndex), target, directory);
      } else if (mode === 'makeup' || mode === 'daily_special') {
        var dateValue = allClassesSelectedDate735410();
        var added = await call('addTemporaryAttendanceAdmin7354', {
          studentUid: student.studentUid,
          studentName: student.name,
          kind: mode,
          date: dateValue,
          classId: target.classId,
          className: target.className,
          requestId: requestId('all-class-special-735412')
        });
        allClassesState735410.temporaryRecords.push({
          attendanceRecordId: text(added && (added.attendanceRecordId || added.recordId)),
          recordId: text(added && (added.attendanceRecordId || added.recordId)),
          studentUid: student.studentUid,
          studentName: student.name,
          attendanceNo: student.attendanceNo,
          classId: target.classId,
          className: target.className,
          date: dateValue,
          sessionDate: dateValue,
          registrationType: mode,
          specialStatus: temporaryLabel735412(mode),
          active: true
        });
      } else {
        await updateStudentClass735410(student, target, mode, drag.sourceClassId || '');
      }
      directoryCache = null;
      directoryLoadedAt = 0;
      if (drag.kind === 'pending') {
        allClassesState735410.pendingStudentUid = '';
        renderAllClassesPendingTray735410();
      }
      renderAllClassesBoardLocal735410();
      setAllClassesStatus735410(student.name + ' 학생 처리를 완료했습니다. 전체 새로고침은 자동으로 실행하지 않습니다.');
    } catch (error) {
      setAllClassesStatus735410(text(error && error.message) || '학생 반 변경에 실패했습니다.', true);
      alert(text(error && error.message) || '학생 반 변경에 실패했습니다.');
    } finally {
      allClassesDragData735410 = null;
    }
  }

  function openAllClassesModal735410() {
    if (!isFullAdmin()) return alert('관리자 권한이 필요합니다.');
    var modal = ensureAllClassesModal735410();
    var context = attendanceContext();
    var monthEl = document.getElementById('ulimAllClassesMonth735410');
    var weekdayEl = document.getElementById('ulimAllClassesWeekday735410');
    if (!allClassesState735410.month) allClassesState735410.month = monthValue735410(context.date);
    if (monthEl) monthEl.value = allClassesState735410.month;
    if (weekdayEl && !weekdayEl.value) weekdayEl.value = allClassesState735410.weekday || 'all';
    syncAllClassesDateOptions735410();
    var label = document.getElementById('ulimAllClassesContext735410');
    if (label) label.textContent = '울림앱 전체반 명단 · 자동 새로고침 없음';
    var alreadyOpen = modal.style.display === 'block';
    modal.style.display = 'block';
    if (allClassesState735410.directory) {
      renderAllClassesBoardLocal735410();
      if (allClassesState735410.temporaryDate !== allClassesSelectedDate735410()) loadAllClassesData735410(false);
    } else if (!alreadyOpen) {
      loadAllClassesData735410(false);
    }
  }


  function ensureSheetActionModal735410() {
    var modal = document.getElementById('ulimAttendanceSheetActionModal735410');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimAttendanceSheetActionModal735410';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:2147483600;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.58)';
    modal.innerHTML = '<section role="dialog" aria-modal="true" style="width:min(560px,96vw);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,.35)">'
      + '<header style="display:flex;align-items:center;justify-content:space-between;padding:17px 19px;border-bottom:1px solid #e2e8f0"><h3 style="margin:0;font-size:19px">출석부 반영</h3><button type="button" data-close-sheet-modal="1" style="border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:25px;cursor:pointer">×</button></header>'
      + '<div style="padding:18px"><p style="margin:0 0 16px;line-height:1.65;color:#475569">Google Sheets는 아래 버튼을 누른 경우에만 읽거나 기록합니다. 평소 출석부 조회와 저장은 울림앱 자료만 사용합니다.</p>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><button type="button" id="ulimAttendanceSheetImport735410" class="admin-btn blue" style="min-height:54px">구글시트 가져오기</button><button type="button" id="ulimAttendanceSheetExport735410" class="admin-btn" style="min-height:54px">구글시트에 기록</button></div>'
      + '<div id="ulimAttendanceSheetStatus735410" style="margin-top:14px;min-height:20px;font-size:13px;font-weight:800;color:#475569"></div></div>'
      + '<footer style="display:flex;justify-content:flex-end;padding:12px 18px;border-top:1px solid #e2e8f0;background:#f8fafc"><button type="button" class="admin-btn gray" data-close-sheet-modal="1">닫기</button></footer>'
      + '</section>';
    modal.addEventListener('click', function (event) {
      if (event.target === modal || event.target.closest('[data-close-sheet-modal="1"]')) modal.style.display = 'none';
    });
    document.body.appendChild(modal);
    document.getElementById('ulimAttendanceSheetImport735410').addEventListener('click', importAttendanceFromSheet735410);
    document.getElementById('ulimAttendanceSheetExport735410').addEventListener('click', exportAttendanceToSheet735410);
    return modal;
  }

  function setSheetActionStatus735410(message, error) {
    var el = document.getElementById('ulimAttendanceSheetStatus735410');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = error ? '#b91c1c' : '#166534';
  }

  function openSheetActionModal735410() {
    if (!isFullAdmin()) return alert('관리자 권한이 필요합니다.');
    var context = attendanceContext();
    if (!context.date) return alert('수업일을 선택해주세요.');
    var modal = ensureSheetActionModal735410();
    setSheetActionStatus735410(context.date + (context.className ? ' · ' + context.className : '') + ' 기준');
    modal.style.display = 'flex';
  }

  async function importAttendanceFromSheet735410() {
    var context = attendanceContext();
    if (!confirm(context.date + ' 출석부를 Google Sheets에서 가져올까요?\n현재 울림앱 출석부에 시트 내용을 반영합니다.')) return;
    try {
      if (typeof global.showLoading === 'function') global.showLoading('Google Sheets 출석부를 가져오는 중...');
      setSheetActionStatus735410('Google Sheets 출석부를 가져오는 중...');
      var result = await call('refreshStaffOperationalDateFromSheets', {
        date: context.date,
        datasets: ['attendance'],
        force: true,
        reason: 'manual_attendance_import_735410',
        requestId: requestId('attendance-sheet-import-735410')
      });
      await safeLoadAttendanceSnapshot(false);
      setSheetActionStatus735410(text(result && result.message) || 'Google Sheets 가져오기를 완료했습니다.');
    } catch (error) {
      setSheetActionStatus735410(text(error && error.message) || '가져오기에 실패했습니다.', true);
      alert(text(error && error.message) || 'Google Sheets 출석부를 가져오지 못했습니다.');
    } finally { if (typeof global.hideLoading === 'function') global.hideLoading(); }
  }

  async function exportAttendanceToSheet735410() {
    var context = attendanceContext();
    if (!confirm(context.date + ' 울림앱 출석부 현재값을 Google Sheets에 기록할까요?')) return;
    try {
      if (typeof global.showLoading === 'function') global.showLoading('울림앱 출석부를 Google Sheets에 기록하는 중...');
      setSheetActionStatus735410('현재 화면값을 울림앱에 저장한 뒤 Google Sheets에 기록하는 중...');
      if (typeof global.adminSaveAttendanceFromTable === 'function') await global.adminSaveAttendanceFromTable(true);
      var result = await call('pushStaffOperationalDateToSheets', {
        date: context.date,
        datasets: ['attendance'],
        requestId: requestId('attendance-sheet-export-735410')
      });
      setSheetActionStatus735410('Google Sheets 기록 완료: ' + Number(result && result.count || 0) + '건');
    } catch (error) {
      setSheetActionStatus735410(text(error && error.message) || '기록에 실패했습니다.', true);
      alert(text(error && error.message) || 'Google Sheets에 기록하지 못했습니다.');
    } finally { if (typeof global.hideLoading === 'function') global.hideLoading(); }
  }

  function bindAttendanceReflectButton735410() {
    document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('button') : null;
      if (!button || normalize(button.textContent) !== normalize('출석부 반영')) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      openSheetActionModal735410();
    }, true);
  }

  function installOverrides() {
    global.adminLoadAttendanceSnapshot = safeLoadAttendanceSnapshot;
    global.adminLoadClassList = loadClassListFirebaseFirst;
    global.ulimAttendanceRemoveRow73545 = removeAttendanceRow;
    global.ulimAttendanceOpenAddModal73545 = openAttendanceAddModal735410;
    global.ulimAttendanceOpenStudentDetail735410 = openStudentDetail;
    global.ulimGetAdminAttendanceRecord73545 = recordAt;
    global.ulimOpenAttendanceSheetDialog735410 = openSheetActionModal735410;
    global.ulimOpenAllClassesAttendance735410 = openAllClassesModal735410;
    try { adminLoadAttendanceSnapshot = safeLoadAttendanceSnapshot; } catch (_ignore1) {}
    try { adminLoadClassList = loadClassListFirebaseFirst; } catch (_ignore2) {}
    try { ulimAttendanceRemoveRow73545 = removeAttendanceRow; } catch (_ignore3) {}
    try { ulimAttendanceOpenAddModal73545 = openAttendanceAddModal735410; } catch (_ignore4) {}

    var currentSelect = global.adminSelectClass;
    if (typeof currentSelect === 'function' && !currentSelect.__ulim735410Wrapped) {
      var wrappedSelectClass = function (className, targetId, panelId) {
        var result = currentSelect.apply(this, arguments);
        if ((targetId || 'adminAttendanceClass') === 'adminAttendanceClass' && text(className) === '전체반') {
          openAllClassesModal735410();
        }
        return result;
      };
      wrappedSelectClass.__ulim735410Wrapped = true;
      wrappedSelectClass.__ulim735410Original = currentSelect;
      global.adminSelectClass = wrappedSelectClass;
      try { adminSelectClass = wrappedSelectClass; } catch (_ignore5) {}
    }
  }

  function preloadWholeClass735414() {
    if (!staffDashboardActive735414() || !isFullAdmin() || allClassesState735410.directory) return;
    loadDirectory(false).then(function (directory) {
      allClassesState735410.directory = directory;
      syncAllClassesTeacherOptions735413(directory);
    }).catch(function () {});
  }

  function scheduleWholeClassPreload735414(delay) {
    clearTimeout(wholeClassPreloadTimer735414);
    if (!staffDashboardActive735414()) return;
    wholeClassPreloadTimer735414 = setTimeout(preloadWholeClass735414, Number(delay) || 0);
  }

  function install() {
    ensureStyles();
    ensureDetailModal();
    installOverrides();
    bindContextEvents();
    if (!global.__ULIM_ATTENDANCE_REFLECT_BUTTON_BOUND_735410__) { global.__ULIM_ATTENDANCE_REFLECT_BUTTON_BOUND_735410__ = true; bindAttendanceReflectButton735410(); }
    bindWrapObserver(attendanceWrap());
    scheduleDecorate(0);
    scheduleWholeClassPreload735414(120);
    var panel = document.getElementById('adminPanelAttendance');
    if (panel && panel.classList.contains('active') && !currentGlobalClassList().length) {
      loadClassListFirebaseFirst(text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value) || today(), false);
    }
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('.admin-subtab,[data-admin-panel]') : null;
    if (!target) return;
    var panelId = text(target.getAttribute && target.getAttribute('data-admin-panel'));
    var label = normalize(target.textContent);
    if (panelId === 'adminPanelAttendance' || label === normalize('출석부 확인/발송')) {
      setTimeout(function () {
        install();
        if (!currentGlobalClassList().length) loadClassListFirebaseFirst(text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value) || today(), false);
      }, 30);
    }
  }, true);

  global.addEventListener('pageshow', function () { setTimeout(install, 30); });
  global.addEventListener('ulim-firebase-auth-ready', function () { setTimeout(function(){ install(); scheduleWholeClassPreload735414(80); }, 60); });

  global.ULIM_ATTENDANCE_ADMIN_API_735410 = {
    install: install,
    loadAttendance: safeLoadAttendanceSnapshot,
    loadClasses: loadClassListFirebaseFirst,
    openStudentAdd: openAttendanceAddModal735410,
    openStudentDetail: openStudentDetail,
    openAllClasses: openAllClassesModal735410,
    removeSelectedAllClasses: removeSelectedAllClassStudents735413,
    decorate: decorateAttendanceTable
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  setTimeout(install, 180);
})(typeof window !== 'undefined' ? window : globalThis);
