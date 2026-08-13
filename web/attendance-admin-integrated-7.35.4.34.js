/* ULIM_R19R6_SUBSTITUTE_TEACHER_DISPLAY_7355039 */
(function (global) {
  'use strict';

  if (global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735433__) return;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735433__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735434__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735432__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735431__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735430__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735429__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735428__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735427__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735426__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735425__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735424__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735423__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735422__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735421__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735420__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735419__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735418__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735417__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735416__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735415__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735414__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735413__ = true;
  global.__ULIM_ATTENDANCE_ADMIN_INTEGRATED_735410__ = true;
  global.__ULIM_ATTENDANCE_DIRECTORY_AUTH_GUARD_735414__ = true;
  global.ULIM_ATTENDANCE_ADMIN_INTEGRATED_VERSION = '2026-08-13.735.04.34-roster-convergence-single-owner-7355049';

  var VERSION = '2026-08-13.735.04.34-roster-convergence-single-owner-7355049';
  var loadSequence = 0;
  var directoryCache = null;
  var directoryLoadedAt = 0;
  var directoryLoadingPromise735414 = null;
  var directoryRetryAfter735414 = 0;
  var wholeClassPreloadTimer735414 = 0;
  var detailRecordIndex = -1;
  var detailCandidates = [];
  var detailStudent = null;
  var classListSequence = 0;
  var classListLoadingPromise7355016 = null;
  var classListLoadingDate7355016 = '';
  var attendanceDraftDirty7355014 = false;
  var attendanceRealtimePending735423 = false;
  var studentRosterSyncTimer7355016 = 0;

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

  function firebaseStaffProfile735434() {
    try {
      var raw = localStorage.getItem('ulimFirebaseStaffProfile7320') || '';
      var profile = raw ? JSON.parse(raw) : null;
      if (profile && typeof profile === 'object') return profile;
    } catch (_ignore) {}
    return null;
  }

  function readAdminInfo() {
    // Firebase signed staff profile is the canonical browser identity. A stale legacy
    // adminInfo must never grant another teacher's name or full-admin privileges.
    var profile = firebaseStaffProfile735434();
    if (profile) return profile;
    var info = global.adminInfo && typeof global.adminInfo === 'object' ? global.adminInfo : null;
    if (info) return info;
    var raw = '';
    try { raw = localStorage.getItem('adminInfo') || sessionStorage.getItem('adminInfo') || ''; } catch (_ignore) {}
    try { return raw ? JSON.parse(raw) : {}; } catch (_ignore2) { return {}; }
  }

  function staffRole735434(info) {
    return normalize((info || {}).firebaseRole || (info || {}).role || (info || {}).adminRole || (info || {}).permission || '');
  }

  function isFullAdmin() {
    var info = readAdminInfo();
    var role = staffRole735434(info);
    if (role === 'teacher' || role === '강사') return false;
    if (role === 'super' || role === 'superadmin' || role === 'fulladmin' || role === '전체관리자' || role === '전체관리' || role === '원장' || role === 'owner' || role === 'admin' || role === '관리자') return true;
    // Compatibility fallbacks are used only when the current Firebase profile has no role.
    try { if (!role && typeof global.adminIsFullAdmin === 'function' && global.adminIsFullAdmin()) return true; } catch (_ignore1) {}
    try { if (!role && typeof adminIsFullAdmin === 'function' && adminIsFullAdmin()) return true; } catch (_ignore2) {}
    return false;
  }

  function staffNameKey735434(value) {
    return normalize(value).replace(/t$/i, '').replace(/[^0-9a-z가-힣]/gi, '');
  }

  function currentStaffIdentity735434() {
    var info = readAdminInfo() || {};
    return {
      role: staffRole735434(info),
      uid: text(info.principalUidV2 || info.teacherUid || info.accountUid || info.firebaseAuthUid || info.firebaseUid || info.uid || info.id),
      name: text(info.name || info.adminName || info.instructorName || info.displayName || info.id),
      nameKey: staffNameKey735434(info.name || info.adminName || info.instructorName || info.displayName || info.id)
    };
  }

  function classBelongsToCurrentStaff735434(item) {
    if (isFullAdmin()) return true;
    var actor = currentStaffIdentity735434();
    if (!actor.uid && !actor.nameKey) return false;
    var row = item || {};
    var rowUids = [row.instructorUid, row.teacherUid, row.effectiveInstructorUid, row.actualInstructorUid].map(text).filter(Boolean);
    if (actor.uid && rowUids.indexOf(actor.uid) >= 0) return true;
    var names = [row.effectiveInstructorName, row.actualInstructorName, row.instructorName, row.teacher, row.teacherName, row.instructor].map(staffNameKey735434).filter(Boolean);
    if (actor.nameKey && names.some(function (name) { return name === actor.nameKey || name.indexOf(actor.nameKey) >= 0 || actor.nameKey.indexOf(name) >= 0; })) return true;
    return false;
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
    return global.ULIM_ROOM_CLASSROOM_REALTIME_72917 || global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }

  async function runtime() {
    var room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('교직원 인증 기능을 준비하지 못했습니다.');
    var rt = await room.preloadRuntime();
    if (rt && rt.auth && !rt.auth.currentUser) {
      try {
        if (typeof room.waitUntilAuthenticated === 'function') {
          var waited = await room.waitUntilAuthenticated(4500);
          if (waited && waited.auth) rt = waited;
        } else if (typeof room.ensureAuthenticated === 'function') {
          var ensured = await room.ensureAuthenticated();
          if (ensured && ensured.auth) rt = ensured;
        }
      } catch (_ignoreWait735425) {}
    }
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('교직원 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'attendance-admin-integrated-735427');
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

  function dateWeekday7355015(dateValue) {
    var parts = text(dateValue).split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return -1;
    return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  }

  function explicitClassWeekday7355015(item) {
    var raw = item || {};
    var direct = text(raw.weekday);
    var short = ['일','월','화','수','목','금','토'].indexOf(direct.replace(/요일/g, ''));
    if (short >= 0) return short;
    if (direct !== '') {
      var numeric = Number(direct);
      if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;
    }
    return weekdayFromClass735410(raw);
  }

  function wholeClassWeekdaySort735432(item) {
    var day = explicitClassWeekday7355015(item || {});
    if (day < 0) return 8;
    return day === 0 ? 7 : day;
  }

  function wholeClassTimeSort735432(value) {
    var raw = text(value);
    var match = /^(\d{1,2}):(\d{2})/.exec(raw);
    if (!match) return 24 * 60 + 1;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function wholeClassGroupCompare735432(a, b) {
    var dayDiff = wholeClassWeekdaySort735432(a) - wholeClassWeekdaySort735432(b);
    if (dayDiff) return dayDiff;
    var timeDiff = wholeClassTimeSort735432(a && a.startTime) - wholeClassTimeSort735432(b && b.startTime);
    if (timeDiff) return timeDiff;
    var teacherDiff = text(a && a.instructorName).localeCompare(text(b && b.instructorName), 'ko');
    if (teacherDiff) return teacherDiff;
    return text(a && a.className).localeCompare(text(b && b.className), 'ko');
  }

  function classSemanticKey7355015(item) {
    var row = item || {};
    return [
      normalize(row.className),
      normalize(row.instructorName || row.teacher || row.teacherName),
      text(row.startTime),
      text(row.endTime)
    ].join('|');
  }

  function strictClassesForDate7355015(dateValue, rawClasses) {
    var targetWeekday = dateWeekday7355015(dateValue);
    var map = new Map();
    (Array.isArray(rawClasses) ? rawClasses : []).map(normalizeClassItem).forEach(function (item) {
      if (!item.className) return;
      var weekday = explicitClassWeekday7355015(item);
      if (targetWeekday >= 0 && weekday >= 0 && weekday !== targetWeekday) return;
      var key = classSemanticKey7355015(item);
      var current = map.get(key);
      if (!current) {
        map.set(key, item);
        return;
      }
      var currentScore = (current.instructorUid ? 4 : 0) + (current.classId ? 2 : 0) + (current.startTime && current.endTime ? 1 : 0);
      var itemScore = (item.instructorUid ? 4 : 0) + (item.classId ? 2 : 0) + (item.startTime && item.endTime ? 1 : 0);
      if (itemScore > currentScore) map.set(key, item);
    });
    return Array.from(map.values());
  }

  function normalizeClassItem(raw) {
    var item = raw || {};
    var className = text(item.className || item.name || item.label);
    var teacher = text(item.effectiveInstructorName || item.actualInstructorName || item.teacher || item.instructorName || item.instructor || item.teacherName);
    return Object.assign({}, item, {
      className: className,
      teacher: teacher,
      instructorName: teacher,
      classId: text(item.classId || item.id)
    });
  }

  function assignOperationalClassList(date, rawClasses) {
    var list = strictClassesForDate7355015(date, rawClasses);
    if (!isFullAdmin()) list = list.filter(classBelongsToCurrentStaff735434);
    try {
      if (typeof adminRememberClassListForDate704_ === 'function') {
        var remembered = adminRememberClassListForDate704_(date, list || [], { authoritative: true });
        // Legacy date caches may merge an older day. Re-apply the strict date guard
        // after writing the shared cache so a cached Wednesday can never re-enter Thursday.
        list = strictClassesForDate7355015(date, Array.isArray(remembered) ? remembered : list);
      }
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
    // 7.35.5.0.27: date-specific schedule changes are server-owned. The student
    // directory contains the recurring/base class catalog only and must never
    // short-circuit the effective class list for an attendance date.
    if (force !== true && classListLoadingPromise7355016 && classListLoadingDate7355016 === date) {
      return classListLoadingPromise7355016;
    }
    var sequence = ++classListSequence;
    /* 7.35.4.25: paint only the exact-date canonical cache immediately, then
       refresh from Callable. This removes the empty/slow class-picker interval
       without falling back to the recurring student-directory catalog. */
    if (force !== true) {
      try {
        var cachedExact = typeof adminGetClassListForDate704_ === 'function'
          ? adminGetClassListForDate704_(date)
          : [];
        var cachedStrict = strictClassesForDate7355015(date, cachedExact);
        if (cachedStrict.length) assignOperationalClassList(date, cachedStrict);
      } catch (_ignoreCachedClass735425) {}
    }
    var requestPromise = (async function () {
      try {
        var data = await call('getStaffClassListOperationalSnapshot', {
          date: date,
          force: force === true,
          requestId: requestId('attendance-class-list-7355027')
        });
        if (sequence !== classListSequence) return { stale: true };
        if (dateEl && text(dateEl.value) !== date) return { stale: true };
        if (text(data && data.source) !== 'firestore_canonical_class_catalog_7355016') {
          throw new Error('선택한 날짜의 수업반 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
        }
        var classes = Array.isArray(data && data.classes) ? data.classes : [];
        var assigned = assignOperationalClassList(date, classes);
        return { status: 'success', classes: assigned, source: text(data && data.source) || 'firestore-operational' };
      } catch (error) {
        if (sequence !== classListSequence) return { stale: true };
        // Never fall back to the recurring student-directory class catalog here.
        // It cannot represent one-off classScheduleChanges and would make a moved
        // class disappear from its target date or reappear on its original date.
        setSummary('선택한 날짜의 반 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        return { status: 'error', message: text(error && error.message) };
      }
    })();
    classListLoadingPromise7355016 = requestPromise;
    classListLoadingDate7355016 = date;
    try {
      return await requestPromise;
    } finally {
      if (classListLoadingPromise7355016 === requestPromise) {
        classListLoadingPromise7355016 = null;
        classListLoadingDate7355016 = '';
      }
    }
  }

  function attendanceContext() {
    var dateEl = document.getElementById('adminAttendanceDate');
    var classEl = document.getElementById('adminAttendanceClass');
    var keywordEl = document.getElementById('adminAttendanceFilter');
    var statusEl = document.getElementById('adminAttendanceStatusFilter');
    var className = text(classEl && classEl.value);
    var classId = text(classEl && classEl.dataset && classEl.dataset.classId);
    if (!classId && className && className !== '전체반') {
      var exact = currentGlobalClassList().filter(function (item) { return text(item && item.className) === className; });
      if (exact.length === 1) classId = text(exact[0].classId);
    }
    return {
      date: text(dateEl && dateEl.value) || today(),
      classId: classId,
      className: className,
      keyword: text(keywordEl && keywordEl.value),
      statusFilter: text(statusEl && statusEl.value)
    };
  }

  function contextKey(context) {
    return [context.date, context.classId, context.className, context.keyword, context.statusFilter].join('|');
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

  function cleanAttendanceStatus7355014(value) {
    var raw = text(value);
    var key = raw.replace(/\s+/g, '').toUpperCase();
    if (!raw || raw === '-' || /^(미체크|미출결)$/.test(raw)) return '미체크';
    if (/^(O|○|ㅇ|출|출석|TRUE|V|✓|✔)$/.test(key)) return '출석';
    if (/^(X|×|✕|결|결석|FALSE)$/.test(key)) return '결석';
    if (/^(지|지각|△|늦음)$/.test(key)) return '지각';
    return raw;
  }

  function attendanceSpecialStatus7355014(record) {
    // specialStatus is the server-owned display value. registrationType is persistent
    // membership metadata and must not make 신규/반이동 reappear on later sessions.
    var raw = [
      record && record.specialStatus,
      record && record.specialType,
      record && record.kind,
      record && record.colorStatus
    ].map(text).filter(Boolean).join(' ');
    var kind = specialKind7355033(raw);
    if (kind) return specialLabel7355033(kind);
    if (raw.indexOf('휴원') >= 0) return '휴원';
    return '';
  }

  function specialKind7355033(value) {
    var raw = normalize(value);
    if (!raw) return '';
    if (raw === 'existing' || raw.indexOf(normalize('기존변경')) >= 0) return 'existing';
    if (raw.indexOf(normalize('보강')) >= 0 || raw.indexOf('makeup') >= 0) return 'makeup';
    if (raw.indexOf(normalize('반이동')) >= 0 || raw.indexOf('class_move') >= 0 || raw.indexOf('classmove') >= 0) return 'class_move';
    if (raw.indexOf(normalize('신규')) >= 0 || raw === 'new' || raw.indexOf('registrationnew') >= 0) return 'new';
    if (raw.indexOf(normalize('일일특강')) >= 0 || raw.indexOf('daily_special') >= 0 || raw.indexOf('dailyspecial') >= 0) return 'daily_special';
    return '';
  }

  function specialLabel7355033(value) {
    var kind = specialKind7355033(value);
    if (kind === 'existing') return '';
    return kind === 'makeup' ? '보강' : (kind === 'class_move' ? '반이동' : (kind === 'new' ? '신규' : (kind === 'daily_special' ? '일일특강' : text(value))));
  }

  function specialCss7355033(value) {
    var kind = specialKind7355033(value);
    return kind && kind !== 'existing' ? ' ulim-special-' + kind.replace('_','-') + '-735430' : '';
  }

  function attendancePersistedSpecial735431(record) {
    var direct = text(record && (record.specialStatus || record.specialType || record.kind));
    var kind = specialKind7355033(direct);
    // 신규/반이동은 studentEnrollments에서 매 조회 시 계산하므로 attendance 문서에
    // 다시 저장하지 않습니다. 보강/일일특강만 명시적 세션 특이사항으로 보존합니다.
    if (kind === 'new' || kind === 'class_move' || kind === 'existing') return '';
    if (kind === 'makeup' || kind === 'daily_special') return specialLabel7355033(kind);
    return direct;
  }

  function attendanceNameSpecial7355033(record) {
    var nameSpecial = text(record && record.nameSpecialStatus);
    if (nameSpecial) return nameSpecial;
    var special = attendanceSpecialStatus7355014(record);
    if (specialKind7355033(special) === 'makeup') return '보강';
    return text(record && record.specialDisplayScope) === 'name' ? special : '';
  }

  function attendanceCurrentStatus7355014(record) {
    var raw = text(record && (record.currentStatus || record.remarkText || record.sheetRemark || record.currentState || record.remark));
    if (/^\d{4}-\d{2}-\d{2}\s+(?:재원|휴원|퇴원)\s+(?:출석|결석|지각)\s*[-–—:]?\s*$/.test(raw)) return '';
    return raw;
  }

  function attendanceStatusOptions7355014(status) {
    try {
      if (typeof global.adminAttendanceStatusOptions_ === 'function') return global.adminAttendanceStatusOptions_(status || '미체크');
    } catch (_ignore) {}
    return ['미체크','출석','결석','지각','보강','휴원'].map(function (value) {
      return '<option value="' + escapeHtml(value) + '"' + (value === status ? ' selected' : '') + '>' + escapeHtml(value) + '</option>';
    }).join('');
  }

  function attendanceRowPayload7355020(index, row) {
    var record = currentAttendanceRecords()[Number(index)] || {};
    var context = attendanceContext();
    var statusEl = row && row.querySelector('select[data-field="status"]');
    var currentEl = row && row.querySelector('input[data-field="currentStatus"]');
    var memoEl = row && row.querySelector('input[data-field="memo"]');
    var status = cleanAttendanceStatus7355014((statusEl && statusEl.value) || record.status || record.attendanceStatus);
    return {
      date: text(record.date || record.sessionDate || context.date),
      classId: text(record.classId || context.classId),
      className: text(record.className || context.className),
      studentUid: text(record.studentUid || record.studentIdentityKey || record.studentKey),
      studentName: text(record.studentName || record.name),
      name: text(record.studentName || record.name),
      attendanceNo: text(record.attendanceNo || record.studentNo || record.loginId),
      studentNo: text(record.attendanceNo || record.studentNo || record.loginId),
      studentPhone: text(record.studentPhone || record.phone),
      parentPhone: text(record.parentPhone),
      status: status,
      attendanceStatus: status,
      currentStatus: text(currentEl ? currentEl.value : attendanceCurrentStatus7355014(record)),
      specialStatus: attendancePersistedSpecial735431(record),
      memo: text(memoEl ? memoEl.value : (record.memo || record.appMemo || record.manualMemo))
    };
  }

  function setAttendanceRowUi7355020(row, status) {
    if (!row) return;
    var normalized = cleanAttendanceStatus7355014(status);
    var select = row.querySelector('select[data-field="status"]');
    if (select) select.value = normalized;
    row.querySelectorAll('[data-att-quick]').forEach(function (button) {
      button.classList.toggle('selected', text(button.getAttribute('data-att-quick')) === normalized);
    });
    var checkbox = row.querySelector('.admin-att-check');
    if (checkbox) checkbox.checked = true;
  }

  function setAttendanceSaveState7355020(index, message, failed) {
    var stateEl = document.getElementById('admin-att-save-state-' + Number(index));
    if (!stateEl) return;
    stateEl.textContent = message || '';
    stateEl.style.color = failed ? '#b91c1c' : '#166534';
  }

  async function saveAttendancePayloads7355020(rows, requestPrefix) {
    if (!Array.isArray(rows) || !rows.length) return { status: 'empty', count: 0 };
    return call('saveAttendanceRowsAdmin73550', {
      rows: rows,
      requestId: requestId(requestPrefix || 'attendance-save-7355020')
    });
  }

  async function setAttendanceRowStatusOwned7355020(index, value, row) {
    var records = currentAttendanceRecords();
    var record = records[Number(index)];
    if (!record || !row) return false;
    var next = cleanAttendanceStatus7355014(value);
    var previous = cleanAttendanceStatus7355014(record.status || record.attendanceStatus);
    record.status = next;
    record.attendanceStatus = next;
    setAttendanceRowUi7355020(row, next);
    setAttendanceSaveState7355020(index, '저장 중...', false);
    try {
      var payload = attendanceRowPayload7355020(index, row);
      if (!payload.classId || !payload.studentUid) throw new Error('반 또는 학생 식별정보를 찾지 못했습니다. 출석부를 다시 불러와주세요.');
      await saveAttendancePayloads7355020([payload], 'attendance-row-status-7355020');
      record.currentStatus = payload.currentStatus;
      record.memo = payload.memo;
      record.appMemo = payload.memo;
      record.manualMemo = payload.memo;
      delete row.dataset.currentStatusDirty;
      delete row.dataset.memoDirty;
      var currentInput = row.querySelector('input[data-field="currentStatus"]');
      var memoInput = row.querySelector('input[data-field="memo"]');
      if (currentInput) delete currentInput.dataset.currentStatusDirty;
      if (memoInput) delete memoInput.dataset.memoDirty;
      attendanceDraftDirty7355014 = !!attendanceWrap().querySelector('[data-current-status-dirty="1"],[data-memo-dirty="1"],tr[data-current-status-dirty="1"],tr[data-memo-dirty="1"]');
      flushAttendanceRealtimePending735423();
      setAttendanceSaveState7355020(index, '저장됨', false);
      setTimeout(function () { setAttendanceSaveState7355020(index, '', false); }, 1200);
      return true;
    } catch (error) {
      record.status = previous;
      record.attendanceStatus = previous;
      setAttendanceRowUi7355020(row, previous);
      setAttendanceSaveState7355020(index, '저장 실패', true);
      alert(text(error && error.message) || '출석 상태를 저장하지 못했습니다.');
      return false;
    }
  }

  async function saveSelectedAttendanceOwned7355020(wrap) {
    var rows = [];
    var indexes = [];
    wrap.querySelectorAll('tr[data-att-index]').forEach(function (row) {
      var checkbox = row.querySelector('.admin-att-check');
      if (!checkbox || !checkbox.checked) return;
      var index = Number(row.getAttribute('data-att-index'));
      var payload = attendanceRowPayload7355020(index, row);
      if (payload.classId && payload.studentUid) {
        rows.push(payload);
        indexes.push(index);
      }
    });
    if (!rows.length) return alert('저장할 학생을 선택해주세요.');
    var button = wrap.querySelector('#ulimAttendanceSaveSelected7355014');
    try {
      if (button) button.disabled = true;
      indexes.forEach(function (index) { setAttendanceSaveState7355020(index, '저장 중...', false); });
      var result = await saveAttendancePayloads7355020(rows, 'attendance-selected-save-7355020');
      var records = currentAttendanceRecords();
      indexes.forEach(function (index, position) {
        var row = wrap.querySelector('tr[data-att-index="' + index + '"]');
        var payload = rows[position];
        var record = records[index];
        if (record) {
          record.status = payload.status;
          record.attendanceStatus = payload.attendanceStatus;
          record.currentStatus = payload.currentStatus;
          record.memo = payload.memo;
          record.appMemo = payload.memo;
          record.manualMemo = payload.memo;
        }
        if (row) {
          delete row.dataset.currentStatusDirty;
          delete row.dataset.memoDirty;
          var currentInput = row.querySelector('input[data-field="currentStatus"]');
          var memoInput = row.querySelector('input[data-field="memo"]');
          if (currentInput) delete currentInput.dataset.currentStatusDirty;
          if (memoInput) delete memoInput.dataset.memoDirty;
        }
        setAttendanceSaveState7355020(index, '저장됨', false);
        setTimeout(function () { setAttendanceSaveState7355020(index, '', false); }, 1200);
      });
      attendanceDraftDirty7355014 = !!wrap.querySelector('tr[data-current-status-dirty="1"],tr[data-memo-dirty="1"]');
      flushAttendanceRealtimePending735423();
      setSummary(text(result && result.message) || ('출석 ' + rows.length + '건을 저장했습니다.'));
      return result;
    } catch (error) {
      indexes.forEach(function (index) { setAttendanceSaveState7355020(index, '저장 실패', true); });
      alert(text(error && error.message) || '출석 저장에 실패했습니다.');
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function renderAttendanceOwned7355014() {
    var wrap = attendanceWrap();
    if (!wrap) return false;
    var records = currentAttendanceRecords();
    if (!records.length) {
      wrap.innerHTML = '<div class="notice-empty">반을 선택하면 학생명단의 현재 수강반을 기준으로 출석부가 표시됩니다.</div>';
      return true;
    }

    // 보강 학생은 항상 정규 학생 아래에 배치합니다. 서버도 같은 정렬을
    // 사용하지만 화면 소유자에서도 한 번 더 보장해 강사/관리자 UI를 일치시킵니다.
    records.sort(function (a, b) {
      var aMakeup = specialKind7355033(attendanceSpecialStatus7355014(a)) === 'makeup' ? 1 : 0;
      var bMakeup = specialKind7355033(attendanceSpecialStatus7355014(b)) === 'makeup' ? 1 : 0;
      if (aMakeup !== bMakeup) return aMakeup - bMakeup;
      return text(a.studentName || a.name).localeCompare(text(b.studentName || b.name), 'ko');
    });

    var html = '<table class="admin-table ulim-attendance-owned-7355030"><thead><tr>'
      + '<th><input type="checkbox" id="adminAttendSelectAll" checked></th>'
      + '<th>학생명</th><th>출석체크</th><th>현재상태</th><th>특이사항</th><th>메모</th>'
      + '</tr></thead><tbody>';
    records.forEach(function (record, index) {
      var status = cleanAttendanceStatus7355014(record.status || record.attendanceStatus);
      var current = attendanceCurrentStatus7355014(record);
      var special = attendanceSpecialStatus7355014(record);
      var memo = text(record.memo || record.appMemo || record.manualMemo);
      var nameSpecial = attendanceNameSpecial7355033(record);
      var nameClass = specialCss7355033(nameSpecial);
      var badgeClass = specialCss7355033(special);
      html += '<tr data-att-index="' + index + '">'
        + '<td data-label="선택"><input type="checkbox" class="admin-att-check" checked></td>'
        + '<td data-label="학생명"><span class="ulim-att-student-name-wrap735421' + nameClass + '"><b>' + escapeHtml(record.studentName || record.name) + '</b>'
        + (isFullAdmin() ? '<button type="button" class="ulim-att-student-settings735421" data-att-detail-index="' + index + '" title="학생정보 확인·수정" aria-label="학생정보 확인·수정">⚙</button>' : '')
        + '</span></td>'
        + '<td data-label="출석체크"><div class="admin-att-action-wrap">'
        + '<button type="button" class="admin-att-mini ok' + (status === '출석' ? ' selected' : '') + '" data-att-quick="출석">O</button>'
        + '<button type="button" class="admin-att-mini no' + (status === '결석' ? ' selected' : '') + '" data-att-quick="결석">X</button>'
        + '<select class="admin-att-status-select" data-field="status">' + attendanceStatusOptions7355014(status) + '</select>'
        + '<span id="admin-att-save-state-' + index + '" class="admin-att-save-state"></span>'
        + '</div></td>'
        + '<td data-label="현재상태"><input class="admin-small-input" data-field="currentStatus" maxlength="500" value="' + escapeHtml(current) + '" placeholder="강사 입력사항"></td>'
        + '<td data-label="특이사항">' + (special ? '<span class="admin-status-badge' + badgeClass + '">' + escapeHtml(specialLabel7355033(special)) + '</span>' : '-') + '</td>'
        + '<td data-label="메모"><input class="admin-small-input" data-field="memo" value="' + escapeHtml(memo) + '" placeholder="해당 출석칸 메모"></td>'
        + '</tr>';
    });
    html += '</tbody></table><div class="ulim-attendance-actions-7355030" style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px">'
      + '<button type="button" class="admin-btn" id="ulimAttendanceSaveSelected7355014">선택 출석부 저장</button>'
      + '<button type="button" class="admin-btn gray" id="ulimAttendanceManualReload7355014">출석부 다시 불러오기</button>'
      + '</div>';
    wrap.innerHTML = html;

    var all = wrap.querySelector('#adminAttendSelectAll');
    if (all) all.addEventListener('change', function () {
      wrap.querySelectorAll('.admin-att-check').forEach(function (checkbox) { checkbox.checked = all.checked; });
    });

    wrap.querySelectorAll('tr[data-att-index]').forEach(function (row) {
      var index = Number(row.getAttribute('data-att-index'));
      var detailButton735421 = row.querySelector('[data-att-detail-index]');
      if (detailButton735421) detailButton735421.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        openStudentDetail(index);
      });
      row.querySelectorAll('[data-att-quick]').forEach(function (button) {
        button.addEventListener('click', function () {
          return setAttendanceRowStatusOwned7355020(index, button.getAttribute('data-att-quick'), row);
        });
      });
      var statusSelect = row.querySelector('select[data-field="status"]');
      if (statusSelect) statusSelect.addEventListener('change', function () {
        return setAttendanceRowStatusOwned7355020(index, statusSelect.value, row);
      });
      var currentInput = row.querySelector('input[data-field="currentStatus"]');
      if (currentInput) currentInput.addEventListener('input', function () {
        attendanceDraftDirty7355014 = true;
        row.dataset.currentStatusDirty = '1';
        currentInput.dataset.currentStatusDirty = '1';
        var checkbox = row.querySelector('.admin-att-check');
        if (checkbox) checkbox.checked = true;
      });
      var memoInput = row.querySelector('input[data-field="memo"]');
      if (memoInput) memoInput.addEventListener('input', function () {
        attendanceDraftDirty7355014 = true;
        row.dataset.memoDirty = '1';
        memoInput.dataset.memoDirty = '1';
        var checkbox = row.querySelector('.admin-att-check');
        if (checkbox) checkbox.checked = true;
      });
    });

    var saveButton = wrap.querySelector('#ulimAttendanceSaveSelected7355014');
    if (saveButton) saveButton.addEventListener('click', function () {
      saveSelectedAttendanceRows7355020();
    });
    var reloadButton = wrap.querySelector('#ulimAttendanceManualReload7355014');
    if (reloadButton) reloadButton.addEventListener('click', function () {
      safeLoadAttendanceSnapshot(false);
    });
    return true;
  }

  function renderAttendance() {
    try {
      if (typeof adminRenderAttendanceTable === 'function') adminRenderAttendanceTable();
      else if (typeof global.adminRenderAttendanceTable === 'function') global.adminRenderAttendanceTable();
    } catch (_ignore) {}
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
    return call('getAttendanceRosterAdmin73550', {
      date: context.date,
      classId: context.classId,
      className: context.className,
      keyword: context.keyword,
      statusFilter: context.statusFilter,
      requestId: requestId('attendance-snapshot-7355016')
    });
  }

  async function safeLoadAttendanceSnapshot(showAlert) {
    var alertWhenEmpty = showAlert !== false;
    var context = attendanceContext();
    if (!context.className) {
      invalidateAttendanceView('반을 선택하면 출석부가 표시됩니다.');
      return { status: 'empty-class' };
    }
    if (context.className !== '전체반' && !context.classId) {
      invalidateAttendanceView('선택한 반의 식별정보를 찾지 못했습니다. 반 목록을 다시 불러온 뒤 선택해주세요.');
      return { status: 'missing-class-id' };
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
      if (text(data && data.source) !== 'firestore_canonical_roster_7355049') {
        throw new Error('최신 학생명단 출석부 서버가 아직 반영되지 않았습니다. 이전 명단은 표시하지 않습니다.');
      }
      var records = Array.isArray(data && data.records) ? data.records : [];
      assignAttendanceRecords(records);
      attendanceDraftDirty7355014 = false;
      attendanceRealtimePending735423 = false;
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
      instructorUid: text(item.instructorUid || item.teacherUid),
      selectable: item.selectable !== false,
      weekday: weekdayFromClass735410(item),
      weekdayLabel: text(item.weekdayLabel),
      startTime: text(item.startTime),
      endTime: text(item.endTime),
      dates: Array.isArray(item.dates) ? item.dates.map(text).filter(Boolean) : []
    };
  }

  function directoryFromShared7355016(snapshot) {
    var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
      students: (Array.isArray(source.students) ? source.students : []).map(normalizeStudent),
      classes: (Array.isArray(source.classes) ? source.classes : []).map(normalizeClass).filter(function (item) { return item.classId && item.className; }),
      teachers: (Array.isArray(source.teachers) ? source.teachers : []).map(function (teacher) {
        return { instructorUid: text(teacher.instructorUid || teacher.teacherUid), instructorName: text(teacher.instructorName || teacher.name) };
      }).filter(function (teacher) { return teacher.instructorUid && teacher.instructorName; })
    };
  }

  function adoptSharedDirectory7355016(snapshot) {
    if (!snapshot) return null;
    directoryCache = directoryFromShared7355016(snapshot);
    directoryLoadedAt = Number(snapshot.loadedAt || Date.now());
    directoryRetryAfter735414 = 0;
    return directoryCache;
  }

  async function loadDirectory(force) {
    // 7.35.5.0.16: student-master is the only RPC owner for listStudentManagementAdmin7352.
    // Attendance consumes the shared single-flight directory so opening student detail / whole-class
    // cannot launch a second expensive list request or surface a raw Firebase "internal" alert.
    var shared = global.__ULIM_STUDENT_DIRECTORY_7355016__ || null;
    if (shared) {
      var sharedLoadedAt = Number(shared.loadedAt || 0);
      if (force || !directoryCache || sharedLoadedAt > directoryLoadedAt || Date.now() - directoryLoadedAt >= 30000) {
        adoptSharedDirectory7355016(shared);
      }
      if (directoryCache) return directoryCache;
    }
    if (!force && directoryCache && Date.now() - directoryLoadedAt < 30000) return directoryCache;
    if (directoryLoadingPromise735414) return directoryLoadingPromise735414;
    if (!staffDashboardActive735414()) throw new Error('교직원 로그인 후 학생명단을 불러올 수 있습니다.');
    if (!force && Date.now() < directoryRetryAfter735414) throw new Error('학생명단 재시도 대기 중입니다.');

    directoryLoadingPromise735414 = (async function () {
      try {
        var snapshot = null;
        if (typeof global.ulimStudentDirectoryEnsure7355016 === 'function') {
          snapshot = await global.ulimStudentDirectoryEnsure7355016(false);
        } else if (typeof global.ulimStudentManagementLoad7352 === 'function') {
          await global.ulimStudentManagementLoad7352(false);
          snapshot = global.__ULIM_STUDENT_DIRECTORY_7355016__ || null;
        }
        if (!snapshot) throw new Error('학생명단을 준비하지 못했습니다. 학생검색에서 목록을 한 번 불러와주세요.');
        return adoptSharedDirectory7355016(snapshot);
      } catch (error) {
        directoryRetryAfter735414 = Date.now() + 5000;
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
      '#adminAttendanceTableWrap .ulim-att-student-name-wrap735421{display:inline-flex;align-items:center;gap:7px;min-width:0;padding:3px 7px;border-radius:7px;}',
      '.ulim-special-new-735430{background:#fef3c7!important;color:#92400e!important;border-color:#fde68a!important;}',
      '.ulim-special-class-move-735430{background:#f3e8ff!important;color:#7e22ce!important;border-color:#d8b4fe!important;}',
      '.ulim-special-makeup-735430{background:#dcfce7!important;color:#166534!important;border-color:#86efac!important;}',
      '.ulim-special-daily-special-735430{background:#dbeafe!important;color:#1d4ed8!important;border-color:#93c5fd!important;}',
      '.ulim-att-student-settings735421{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;color:#334155;font-size:14px;line-height:1;cursor:pointer;padding:0;flex:0 0 auto;}',
      '.ulim-att-student-settings735421:hover{background:#dbeafe;border-color:#93c5fd;color:#1d4ed8;}',
      '#ulimAttendanceToolbar7355014{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:10px 0 14px;padding:10px 12px;border:1px solid #dbeafe;border-radius:12px;background:#f8fbff;}',
      '#ulimAttendanceToolbar7355014 .ulim-att-toolbar-group{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
      '.ulim-att-schedule-modal7355014{display:none;position:fixed;inset:0;z-index:2147483400;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.6);}',
      '.ulim-att-schedule-modal7355014.open{display:flex;}',
      '.ulim-att-schedule-card7355014{width:min(760px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(15,23,42,.38);}',
      '.ulim-att-schedule-grid7355014{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:12px;padding:18px;}',
      '.ulim-att-schedule-grid7355014 label{display:block;font-size:12px;font-weight:900;color:#334155;margin-bottom:5px;}',
      '.ulim-att-schedule-grid7355014 input,.ulim-att-schedule-grid7355014 select,.ulim-att-schedule-grid7355014 textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:10px 11px;background:#fff;font-size:14px;}',
      '.ulim-att-detail-modal735410{display:none;position:fixed;inset:0;z-index:2147483600;align-items:center;justify-content:center;padding:18px;}',
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
    ensureLedgerStyles735425();
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
      var patch7355016 = {
        studentUid: student.studentUid, name: name, attendanceNo: attendanceNo, studentPhone: studentPhone, parentPhone: parentPhone,
        birthDate: birthDate, initialRegisteredDate: initialRegisteredDate, enrollmentStatus: enrollmentStatus, memo: memo, selectedClassIds: classIds
      };
      if (typeof global.ulimStudentDirectoryPatch7355016 === 'function') {
        global.ulimStudentDirectoryPatch7355016(patch7355016, 'attendance-student-detail-updated');
      } else {
        Object.assign(student, patch7355016);
        directoryCache = null; directoryLoadedAt = 0;
      }
      syncSharedDirectoryIntoAttendance7355027(true);
      directoryCache = null;
      directoryLoadedAt = 0;
      if (typeof global.ulimStudentDirectoryEnsure7355016 === 'function') {
        try {
          var refreshedDirectory735432 = await global.ulimStudentDirectoryEnsure7355016(true);
          if (refreshedDirectory735432) {
            adoptSharedDirectory7355016(refreshedDirectory735432);
            allClassesState735410.directory = directoryCache;
          }
        } catch (_ignoreDirectoryRefresh735432) {}
      }
      closeDetailModal();
      var allModal7355016 = document.getElementById('ulimAllClassesAttendanceModal735410');
      if (allModal7355016 && allModal7355016.style.display === 'block') {
        await loadAllClassesData735410(true, 'student-detail-update-735432');
      }
      if (attendancePanelActive7355016()) {
        var selectedAttendanceClass735432 = text(document.getElementById('adminAttendanceClass') && document.getElementById('adminAttendanceClass').value);
        if (selectedAttendanceClass735432 && selectedAttendanceClass735432 !== '전체반') await safeLoadAttendanceSnapshot(false);
      }
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
      var result = await call('removeAttendanceStudentAdmin7355014', {
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


  function selectedAttendanceRows7355014() {
    try {
      if (typeof global.adminGetSelectedAttendanceRecords === 'function') {
        var selected = global.adminGetSelectedAttendanceRecords();
        if (Array.isArray(selected) && selected.length) return selected;
      }
    } catch (_ignore1) {}
    var rows = [];
    var wrap = attendanceWrap();
    if (!wrap) return rows;
    Array.from(wrap.querySelectorAll('tbody tr')).forEach(function (tr, fallbackIndex) {
      var checkbox = tr.querySelector('input[type="checkbox"]');
      if (!checkbox || !checkbox.checked) return;
      var index = Number(tr.getAttribute('data-att-index'));
      if (!Number.isFinite(index)) index = fallbackIndex;
      var record = recordAt(index);
      if (record) rows.push(record);
    });
    return rows;
  }

  async function removeSelectedAttendanceRows7355014() {
    if (!isFullAdmin()) return alert('전체관리자 권한이 필요합니다.');
    var context = attendanceContext();
    if (!context.className || context.className === '전체반') return alert('학생을 제거할 개별 반 출석부를 먼저 선택해주세요.');
    var rows = selectedAttendanceRows7355014();
    if (!rows.length) return alert('제거할 학생을 체크해주세요.');
    var classId = text(rows[0].classId);
    var studentUids = unique(rows.map(function (row) { return text(row.studentUid || row.studentIdentityKey || row.studentKey); }));
    if (!classId || !studentUids.length) return alert('선택한 학생의 반/학생 식별정보를 확인할 수 없습니다. 출석부를 다시 불러와주세요.');
    if (!confirm('선택한 ' + studentUids.length + '명을 ' + context.date + ' 출석부에서만 제거할까요?\n학생명단의 정규 수강반은 변경되지 않습니다.')) return;
    try {
      if (typeof global.showLoading === 'function') global.showLoading('선택 학생을 현재 수업일 출석부에서 제거하는 중...');
      await call('removeAttendanceSessionStudentsAdmin73550', { date: context.date, classId: classId, studentUids: studentUids, requestId: requestId('attendance-remove-selected-7355014') });
      await safeLoadAttendanceSnapshot(false);
    } catch (error) {
      alert(text(error && error.message) || '선택 학생을 제거하지 못했습니다.');
    } finally { if (typeof global.hideLoading === 'function') global.hideLoading(); }
  }

  function ensureScheduleChangeModal7355014() {
    var modal = document.getElementById('ulimAttendanceScheduleModal7355014');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimAttendanceScheduleModal7355014';
    modal.className = 'ulim-att-schedule-modal7355014';
    modal.innerHTML = '<section class="ulim-att-schedule-card7355014" role="dialog" aria-modal="true">'
      + '<header style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #e2e8f0"><h3 style="margin:0">수업일 변경</h3><button type="button" data-close-schedule7355014="1" style="border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:24px;cursor:pointer">×</button></header>'
      + '<div id="ulimAttendanceScheduleContext7355014" style="padding:12px 18px 0;font-size:13px;font-weight:900;color:#166534"></div>'
      + '<div class="ulim-att-schedule-grid7355014">'
      + '<div><label>기존 수업일</label><input type="date" id="ulimScheduleOriginal7355014" disabled></div>'
      + '<div><label>변경 수업일</label><input type="date" id="ulimScheduleTarget7355014"></div>'
      + '<div><label>시작시간</label><input type="time" id="ulimScheduleStart7355014"></div>'
      + '<div><label>종료시간</label><input type="time" id="ulimScheduleEnd7355014"></div>'
      + '<div><label>담당강사</label><select id="ulimScheduleTeacher7355014"></select></div>'
      + '<div><label>변경 요일</label><input id="ulimScheduleWeekday7355014" disabled></div>'
      + '<div style="grid-column:1/-1"><label>변경 사유</label><textarea rows="3" id="ulimScheduleReason7355014"></textarea></div>'
      + '<div style="grid-column:1/-1"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="ulimScheduleNotify7355014" style="width:auto"> 학생·학부모에게 수업일 변경 알림톡 발송</label></div>'
      + '</div>'
      + '<footer style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #e2e8f0"><button type="button" class="admin-btn gray" data-close-schedule7355014="1">취소</button><button type="button" class="admin-btn blue" id="ulimScheduleSave7355014">변경 저장</button></footer>'
      + '</section>';
    modal.addEventListener('click', function (event) {
      if (event.target === modal || (event.target.closest && event.target.closest('[data-close-schedule7355014="1"]'))) modal.classList.remove('open');
    });
    document.body.appendChild(modal);
    return modal;
  }

  function scheduleWeekday7355014(dateValue) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text(dateValue))) return '';
    var date = new Date(dateValue + 'T00:00:00+09:00');
    return ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'][date.getDay()] || '';
  }

  async function openScheduleChangeModal7355014() {
    if (!isFullAdmin()) return alert('전체관리자 권한이 필요합니다.');
    var context = attendanceContext();
    if (!context.className || context.className === '전체반') return alert('수업일을 변경할 개별 반을 먼저 선택해주세요.');
    try {
      var directory = await loadDirectory(false);
      var classItem = classByContext735410(directory, context.className);
      if (!classItem) throw new Error('선택한 반 정보를 학생명단의 현재 반 목록에서 찾지 못했습니다.');
      var modal = ensureScheduleChangeModal7355014();
      document.getElementById('ulimAttendanceScheduleContext7355014').textContent = context.className;
      document.getElementById('ulimScheduleOriginal7355014').value = context.date;
      document.getElementById('ulimScheduleTarget7355014').value = context.date;
      document.getElementById('ulimScheduleStart7355014').value = text(classItem.startTime);
      document.getElementById('ulimScheduleEnd7355014').value = text(classItem.endTime);
      document.getElementById('ulimScheduleReason7355014').value = '';
      document.getElementById('ulimScheduleNotify7355014').checked = false;
      var teacherSelect = document.getElementById('ulimScheduleTeacher7355014');
      var teachers = Array.isArray(directory.teachers) ? directory.teachers.slice() : [];
      if (!teachers.some(function (teacher) { return teacher.instructorUid === classItem.instructorUid; }) && classItem.instructorUid) {
        teachers.push({ instructorUid: classItem.instructorUid, instructorName: classItem.instructorName });
      }
      teacherSelect.innerHTML = teachers.map(function (teacher) {
        var selected = teacher.instructorUid === classItem.instructorUid || normalizeName(teacher.instructorName) === normalizeName(classItem.instructorName);
        return '<option value="' + escapeHtml(teacher.instructorUid) + '" data-name="' + escapeHtml(teacher.instructorName) + '"' + (selected ? ' selected' : '') + '>' + escapeHtml(teacher.instructorName + 'T') + '</option>';
      }).join('');
      var target = document.getElementById('ulimScheduleTarget7355014');
      var weekday = document.getElementById('ulimScheduleWeekday7355014');
      var updateWeekday = function () { weekday.value = scheduleWeekday7355014(target.value); };
      target.onchange = updateWeekday; updateWeekday();
      document.getElementById('ulimScheduleSave7355014').onclick = async function () {
        var selectedOption = teacherSelect.selectedOptions && teacherSelect.selectedOptions[0];
        var payload = {
          originalDate: context.date,
          targetDate: text(target.value),
          classId: classItem.classId,
          className: classItem.className,
          startTime: text(document.getElementById('ulimScheduleStart7355014').value),
          endTime: text(document.getElementById('ulimScheduleEnd7355014').value),
          instructorUid: text(teacherSelect.value) || classItem.instructorUid,
          instructorName: text(selectedOption && selectedOption.getAttribute('data-name')) || classItem.instructorName,
          reason: text(document.getElementById('ulimScheduleReason7355014').value),
          sendNotification: !!document.getElementById('ulimScheduleNotify7355014').checked,
          targets: ['student','parent'],
          requestId: requestId('attendance-schedule-change-7355014')
        };
        if (!payload.targetDate || !payload.startTime || !payload.endTime) return alert('변경 날짜와 시작·종료 시간을 입력해주세요.');
        try {
          if (typeof global.showLoading === 'function') global.showLoading(payload.sendNotification ? '수업일 변경 및 알림톡 발송 중...' : '수업일 변경 저장 중...');
          var result = await call('changeClassSessionAdmin73550', payload);
          modal.classList.remove('open');
          var dateEl = document.getElementById('adminAttendanceDate');
          if (dateEl) dateEl.value = payload.targetDate;
          await loadClassListFirebaseFirst(payload.targetDate, true);
          var hidden = document.getElementById('adminAttendanceClass');
          if (hidden) { hidden.value = classItem.className; hidden.dataset.classId = text(classItem.classId); }
          await safeLoadAttendanceSnapshot(false);
          if (result && result.notification && result.notification.requested && result.notification.ok === false) alert('수업일은 변경되었지만 알림톡 발송 상태를 확인해주세요.\n' + text(result.notification.error));
          else alert('수업일 변경을 저장했습니다.');
        } catch (error) { alert(text(error && error.message) || '수업일 변경에 실패했습니다.'); }
        finally { if (typeof global.hideLoading === 'function') global.hideLoading(); }
      };
      modal.classList.add('open');
    } catch (error) { alert(text(error && error.message) || '수업일 변경 화면을 열지 못했습니다.'); }
  }

  function installAttendanceToolbar7355014() {
    var panel = document.getElementById('adminPanelAttendance');
    if (!panel || !isFullAdmin()) return;
    var card = panel.querySelector('.admin-card') || panel;
    var toolbar = document.getElementById('ulimAttendanceToolbar7355014');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'ulimAttendanceToolbar7355014';
      toolbar.innerHTML = '<div class="ulim-att-toolbar-group"><button type="button" class="admin-btn blue" id="ulimAttendanceScheduleChange7355014">수업일 변경</button></div>'
        + '<div class="ulim-att-toolbar-group"><button type="button" class="admin-btn green" id="ulimAttendanceAdd7355014">학생 추가</button><button type="button" class="admin-btn red" id="ulimAttendanceRemoveSelected7355014">선택 학생 제거</button></div>';
      var grid = card.querySelector('.admin-grid');
      if (grid) card.insertBefore(toolbar, grid); else card.prepend(toolbar);
    }
    document.getElementById('ulimAttendanceScheduleChange7355014').onclick = openScheduleChangeModal7355014;
    document.getElementById('ulimAttendanceAdd7355014').onclick = openAttendanceAddModal735410;
    document.getElementById('ulimAttendanceRemoveSelected7355014').onclick = removeSelectedAttendanceRows7355014;
    Array.from(card.querySelectorAll('button')).forEach(function (button) {
      if (normalize(button.textContent) === normalize('출석부 반영')) button.remove();
    });
  }



  var attendanceAddDirectory735410 = null;
  var allClassesDragData735410 = null;
  var allClassesState735410 = {
    directory: null,
    ledger: null,
    teacher: 'all',
    addContext: null,
    loadingPromise: null,
    reloadTimer: 0,
    refreshAvailable: false,
    lastLoadedAt: 0,
    selectedCards: new Map(),
    actionInFlight: false,
    scheduleContext: null,
    scheduleAction: '',
    lastRevision: 0
  };

  function attendanceAddModeLabel735410(mode) {
    return mode === 'class_move' ? '반이동' : (mode === 'makeup' ? '보강' : (mode === 'daily_special' ? '일일특강' : (mode === 'existing' ? '기존변경' : '신규')));
  }
  function allClassesSelectedDate735410() {
    return text(allClassesState735410.addContext && allClassesState735410.addContext.date) || today();
  }
  function classById7355033(directory, classId) {
    return (directory && directory.classes || []).find(function (item) { return text(item.classId) === text(classId); }) || null;
  }
  function classByContext735410(directory, className) {
    var target = normalize(className);
    return (directory && directory.classes || []).find(function (item) { return normalize(item.className) === target; }) || null;
  }
  function monthLabel7355033(value) {
    var parts = text(value).split('-');
    return parts.length === 2 ? Number(parts[1]) + '월' : value;
  }
  function monthTitle7355033(value) {
    var parts=text(value).split('-');
    return parts.length===2 ? Number(parts[0])+'년 '+Number(parts[1])+'월' : value;
  }
  function dateLabel7355033(date) {
    var p = text(date).split('-');
    return p.length === 3 ? Number(p[1]) + '월 ' + Number(p[2]) + '일' : date;
  }
  function weekdayLabel7355033(session) { return text(session && session.weekday) ? text(session.weekday) + '요일' : ''; }
  function fullAdminOrTeacher7355033() {
    var info = readAdminInfo();
    var role = normalize(info.firebaseRole || info.role || info.adminRole || info.permission || '');
    return isFullAdmin() || role === 'teacher' || role === '강사';
  }

  function attendanceAddMonth735430(context) {
    var value = text(context && (context.month || context.date));
    return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : today().slice(0, 7);
  }

  function attendanceAddCandidateSessions735430(context, targetClass) {
    var month = attendanceAddMonth735430(context);
    var group = groupById735423(context && context.classId);
    var fromLedger = group && Array.isArray(group.sessions) ? group.sessions.filter(function (session) {
      return text(session.date).slice(0, 7) === month && session.state !== 'cancelled' && session.state !== 'moved';
    }) : [];
    if (fromLedger.length) return fromLedger.slice().sort(function (a, b) { return text(a.date).localeCompare(text(b.date)); });

    var explicitDates = unique(targetClass && targetClass.dates).filter(function (date) { return date.slice(0, 7) === month; });
    if (explicitDates.length) return explicitDates.sort().map(function (date) { return { date: date, state: 'normal' }; });
    var weekday = weekdayFromClass735410(targetClass || {});
    if (weekday < 0) {
      var only = text(context && context.date);
      return only ? [{ date: only, state: 'normal' }] : [];
    }
    var parts = month.split('-').map(Number);
    var year = parts[0], monthIndex = parts[1] - 1;
    var result = [];
    for (var day = 1; day <= 31; day += 1) {
      var utc = new Date(Date.UTC(year, monthIndex, day));
      if (utc.getUTCMonth() !== monthIndex) break;
      if (utc.getUTCDay() !== weekday) continue;
      result.push({ date: [year, String(monthIndex + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-'), state: 'normal' });
    }
    return result;
  }

  function selectedAttendanceAddDates735430() {
    return Array.from(document.querySelectorAll('#ulimAttendanceAddDates735430 input[data-att-add-date]:checked')).map(function (input) {
      return text(input.value);
    }).filter(Boolean).sort();
  }

  function renderAttendanceAddDates735430() {
    var wrap = document.getElementById('ulimAttendanceAddDatesWrap735430');
    var list = document.getElementById('ulimAttendanceAddDates735430');
    var all = document.getElementById('ulimAttendanceAddDatesAll735430');
    if (!wrap || !list || !all) return;
    var mode = text(document.getElementById('ulimAttendanceAddMode735423') && document.getElementById('ulimAttendanceAddMode735423').value) || 'new';
    var context = allClassesState735410.addContext || {};
    var historicalExisting735433 = mode === 'existing' && attendanceAddMonth735430(context) < today().slice(0, 7);
    if (mode === 'existing' && !historicalExisting735433) {
      wrap.style.display = 'none';
      list.innerHTML = '';
      all.checked = false;
      all.indeterminate = false;
      return;
    }
    wrap.style.display = 'block';
    var directory = attendanceAddDirectory735410 || allClassesState735410.directory || {};
    var targetClass = classById7355033(directory, context.classId) || classByContext735410(directory, context.className);
    var sessions = attendanceAddCandidateSessions735430(context, targetClass);
    var preferred = unique(Array.isArray(context.selectedDates) ? context.selectedDates : [context.date]);
    list.innerHTML = sessions.length ? sessions.map(function (session) {
      var checked = preferred.indexOf(text(session.date)) >= 0 ? ' checked' : '';
      return '<label class="ulim-att-add-date-item735430"><input type="checkbox" data-att-add-date="1" value="' + escapeHtml(session.date) + '"' + checked + '><span><b>' + escapeHtml(dateLabel7355033(session.date)) + '</b><small>' + escapeHtml(weekdayLabel7355033(session)) + '</small></span></label>';
    }).join('') : '<div class="ulim-att-add-date-empty735430">선택 가능한 수업일이 없습니다.</div>';
    var boxes = Array.from(list.querySelectorAll('input[data-att-add-date]'));
    var syncAll = function () {
      var checkedCount = boxes.filter(function (box) { return box.checked; }).length;
      all.checked = boxes.length > 0 && checkedCount === boxes.length;
      all.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
    };
    boxes.forEach(function (box) { box.addEventListener('change', syncAll); });
    syncAll();
  }

  function patchSharedStudentAfterClassUpdate735430(student, nextIds) {
    var classes = allClassesState735410.directory && allClassesState735410.directory.classes || [];
    var classNames = nextIds.map(function (id) { var cls = classById7355033({ classes: classes }, id); return cls ? cls.className : ''; }).filter(Boolean);
    var instructorNames = unique(nextIds.map(function (id) { var cls = classById7355033({ classes: classes }, id); return cls ? cls.instructorName : ''; }).filter(Boolean));
    student.selectedClassIds = nextIds.slice();
    student.classNames = classNames;
    student.instructorNames = instructorNames;
    if (typeof global.ulimStudentDirectoryPatch7355016 === 'function') {
      global.ulimStudentDirectoryPatch7355016({
        studentUid: student.studentUid,
        selectedClassIds: nextIds.slice(),
        classNames: classNames,
        instructorNames: instructorNames,
        enrollmentStatus: student.enrollmentStatus
      }, 'whole-class-student-class-updated-735430');
    }
    syncSharedDirectoryIntoAttendance7355027(true);
  }

  async function updateStudentClass735410(student, targetClass, mode, sourceClassId, operationDate) {
    var currentIds = unique(student.selectedClassIds);
    var nextIds = currentIds.slice();
    var replace = false;
    if (mode === 'class_move') {
      if (!sourceClassId && currentIds.length > 1) throw new Error('여러 반을 수강 중인 학생입니다. 이동 전 수강반을 선택해주세요.');
      nextIds = unique(currentIds.filter(function (id) { return sourceClassId ? id !== sourceClassId : false; }).concat([targetClass.classId]));
      replace = true;
    }
    else if (mode === 'existing') { nextIds = unique(currentIds.filter(function (id) { return id !== sourceClassId; }).concat([targetClass.classId])); replace = true; }
    else { nextIds = unique(currentIds.concat([targetClass.classId])); replace = false; }
    await call('updateStudentAdmin7352', {
      studentUid: student.studentUid, name: student.name, attendanceNo: student.attendanceNo, changeAttendanceNo: false,
      studentPhone: student.studentPhone, parentPhone: student.parentPhone, birthDate: student.birthDate,
      initialRegisteredDate: student.initialRegisteredDate, enrollmentStatus: student.enrollmentStatus,
      classIds: nextIds, originalClassIds: currentIds,
      replaceClassAssignments: replace, registrationType: mode,
      operationDate: (mode === 'class_move' || mode === 'new' || mode === 'existing') ? text(operationDate || allClassesSelectedDate735410()) : '', memo: student.memo,
      privacyConsent: student.privacyConsent === true, portraitConsent: student.portraitConsent === true,
      preserveLegacyClassNames: unique(student.legacyUnmappedClassNames), requestId: requestId('attendance-class-update-735430')
    });
    patchSharedStudentAfterClassUpdate735430(student, nextIds);
    return nextIds;
  }

  function ensureAttendanceAddModal735410() {
    var modal = document.getElementById('ulimAttendanceAddModal735423');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimAttendanceAddModal735423';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:2147483650;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.62)';
    modal.innerHTML = '<section role="dialog" aria-modal="true" style="width:min(760px,96vw);max-height:92vh;background:#fff;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(15,23,42,.38)">'
      + '<header style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #e2e8f0"><div><h3 style="margin:0;font-size:19px">출석부 학생추가</h3><div id="ulimAttendanceAddContext735423" style="font-size:12px;color:#64748b;margin-top:4px"></div></div><button type="button" data-close-att-add="1" style="border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:25px;cursor:pointer">×</button></header>'
      + '<div style="padding:17px 18px;overflow:auto"><div style="display:grid;grid-template-columns:180px 1fr;gap:12px"><label style="font-size:12px;font-weight:900;color:#334155">등록 구분<select id="ulimAttendanceAddMode735423" style="width:100%;margin-top:5px;padding:10px;border:1px solid #cbd5e1;border-radius:10px"><option value="new">신규</option><option value="class_move">반이동</option><option value="makeup">보강</option><option value="daily_special">일일특강</option><option value="existing">기존변경</option></select></label><label style="font-size:12px;font-weight:900;color:#334155">학생 검색<input id="ulimAttendanceAddSearch735423" type="search" placeholder="학생명·출결번호·전화번호" style="width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid #cbd5e1;border-radius:10px"></label></div>'
      + '<label style="display:block;margin-top:12px;font-size:12px;font-weight:900;color:#334155">학생 선택<select id="ulimAttendanceAddStudent735423" size="8" style="width:100%;box-sizing:border-box;margin-top:5px;padding:8px;border:1px solid #cbd5e1;border-radius:10px"></select></label>'
      + '<label id="ulimAttendanceAddMoveSourceWrap735430" style="display:none;margin-top:12px;font-size:12px;font-weight:900;color:#334155">이동 전 수강반<select id="ulimAttendanceAddMoveSource735430" style="width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid #cbd5e1;border-radius:10px"></select></label>'
      + '<label id="ulimAttendanceAddDirectWrap735423" style="display:none;margin-top:12px;font-size:12px;font-weight:900;color:#334155">명단에 없는 학생 이름<input id="ulimAttendanceAddDirectName735423" style="width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid #cbd5e1;border-radius:10px" placeholder="보강생·일일특강생 이름"></label>'
      + '<section id="ulimAttendanceAddDatesWrap735430" class="ulim-att-add-dates-wrap735430"><div class="ulim-att-add-dates-head735430"><b>적용 수업일</b><label><input type="checkbox" id="ulimAttendanceAddDatesAll735430"> 전체선택</label></div><div id="ulimAttendanceAddDates735430" class="ulim-att-add-dates735430"></div></section>'
      + '<div id="ulimAttendanceAddHint735423" style="margin-top:12px;padding:10px 12px;border-radius:10px;background:#eff6ff;color:#1e40af;font-size:12px;line-height:1.55"></div></div>'
      + '<footer style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #e2e8f0;background:#f8fafc"><button type="button" class="admin-btn gray" data-close-att-add="1">취소</button><button type="button" class="admin-btn orange" id="ulimAttendanceAddSubmit735423">학생추가</button></footer></section>';
    modal.addEventListener('click', function (event) { if (event.target === modal || (event.target && event.target.closest('[data-close-att-add="1"]'))) modal.style.display = 'none'; });
    document.body.appendChild(modal);
    document.getElementById('ulimAttendanceAddSearch735423').addEventListener('input', renderAttendanceAddCandidates735423);
    document.getElementById('ulimAttendanceAddStudent735423').addEventListener('change', renderAttendanceAddMoveSource735430);
    document.getElementById('ulimAttendanceAddMode735423').addEventListener('change', updateAttendanceAddMode735423);
    document.getElementById('ulimAttendanceAddDatesAll735430').addEventListener('change', function (event) {
      Array.from(document.querySelectorAll('#ulimAttendanceAddDates735430 input[data-att-add-date]')).forEach(function (box) { box.checked = event.target.checked; });
      event.target.indeterminate = false;
    });
    document.getElementById('ulimAttendanceAddSubmit735423').addEventListener('click', submitAttendanceAdd735423);
    return modal;
  }

  function renderAttendanceAddCandidates735423() {
    var select = document.getElementById('ulimAttendanceAddStudent735423');
    if (!select || !attendanceAddDirectory735410) return;
    var query = normalize(document.getElementById('ulimAttendanceAddSearch735423').value);
    var rows = (attendanceAddDirectory735410.students || []).filter(function (student) {
      if (student.enrollmentStatus === 'leave' || student.enrollmentStatus === 'withdrawn' || student.registrationCancelled === true) return false;
      return !query || normalize([student.name, student.attendanceNo, student.studentPhone, student.parentPhone, (student.classNames || []).join(' ')].join(' ')).indexOf(query) >= 0;
    }).sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); }).slice(0, 300);
    select.innerHTML = '<option value="">학생을 선택해주세요.</option>' + rows.map(function (student) { return '<option value="' + escapeHtml(student.studentUid) + '">' + escapeHtml(studentCandidateLabel(student)) + '</option>'; }).join('');
  }
  function renderAttendanceAddMoveSource735430() {
    var wrap = document.getElementById('ulimAttendanceAddMoveSourceWrap735430');
    var select = document.getElementById('ulimAttendanceAddMoveSource735430');
    if (!wrap || !select) return;
    var mode = text(document.getElementById('ulimAttendanceAddMode735423') && document.getElementById('ulimAttendanceAddMode735423').value) || 'new';
    if (mode !== 'class_move') { wrap.style.display = 'none'; select.innerHTML = ''; return; }
    wrap.style.display = 'block';
    var uid = text(document.getElementById('ulimAttendanceAddStudent735423') && document.getElementById('ulimAttendanceAddStudent735423').value);
    var directory = attendanceAddDirectory735410 || {};
    var student = (directory.students || []).find(function (item) { return text(item.studentUid) === uid; }) || null;
    var targetId = text(allClassesState735410.addContext && allClassesState735410.addContext.classId);
    var ids = student ? unique(student.selectedClassIds).filter(function (id) { return id !== targetId; }) : [];
    var options = ids.map(function (id) {
      var cls = classById7355033(directory, id);
      return '<option value="' + escapeHtml(id) + '">' + escapeHtml(cls ? cls.className : id) + '</option>';
    });
    select.innerHTML = options.length ? (options.length > 1 ? '<option value="">이동 전 수강반을 선택해주세요.</option>' : '') + options.join('') : '<option value="">현재 이동 가능한 수강반 없음</option>';
  }

  function updateAttendanceAddMode735423() {
    var mode = text(document.getElementById('ulimAttendanceAddMode735423').value) || 'new';
    var allowDirect = mode === 'makeup' || mode === 'daily_special';
    document.getElementById('ulimAttendanceAddDirectWrap735423').style.display = allowDirect ? 'block' : 'none';
    var hints = {
      new: '신규 처리일 이후 첫 실제 수업일에만 특이사항 신규와 노란색 학생이름을 표시합니다.',
      class_move: '반이동 처리일 이후 새 반의 첫 실제 수업일에만 특이사항 반이동과 보라색 학생이름을 표시합니다.',
      makeup: '지정한 날짜에만 보강으로 추가하며 초록색 학생이름으로 표시합니다.',
      daily_special: '체크한 날짜에만 일일특강 학생으로 추가합니다.',
      existing: '기존 학생의 현재 수강반 구성을 변경합니다. 신규·반이동 표시는 남기지 않습니다.'
    };
    if (mode === 'existing' && attendanceAddMonth735430(allClassesState735410.addContext || {}) < today().slice(0, 7)) {
      hints.existing = '전월 기존 학생 복원입니다. 체크한 과거 수업일 기록에만 추가되며 현재 학생명단·현재 수강반·태블릿에는 영향을 주지 않습니다.';
    }
    document.getElementById('ulimAttendanceAddHint735423').textContent = hints[mode] || '';
    renderAttendanceAddMoveSource735430();
    renderAttendanceAddDates735430();
  }

  async function openAttendanceAddModal735410(contextOverride) {
    if (!isFullAdmin()) return alert('전체관리자 권한이 필요합니다.');
    var base = attendanceContext();
    var context = contextOverride && contextOverride.classId ? Object.assign({}, contextOverride) : { date: base.date, classId: base.classId, className: base.className };
    if (!context.className || context.className === '전체반' || !context.classId) return alert('학생을 추가할 반과 날짜를 먼저 선택해주세요.');
    context.month = attendanceAddMonth735430(context);
    allClassesState735410.addContext = context;
    var modal = ensureAttendanceAddModal735410();
    document.getElementById('ulimAttendanceAddContext735423').textContent = monthTitle7355033(context.month) + ' · ' + context.className;
    document.getElementById('ulimAttendanceAddSearch735423').value = '';
    document.getElementById('ulimAttendanceAddDirectName735423').value = '';
    modal.style.display = 'flex';
    try {
      attendanceAddDirectory735410 = allClassesState735410.directory || await loadDirectory(false);
      renderAttendanceAddCandidates735423();
      updateAttendanceAddMode735423();
    } catch (error) { alert(text(error && error.message) || '학생목록을 불러오지 못했습니다.'); }
  }

  async function submitAttendanceAdd735423() {
    if (allClassesState735410.actionInFlight) return;
    var context = allClassesState735410.addContext || {};
    var directory = attendanceAddDirectory735410;
    if (!directory) return alert('학생목록을 다시 불러와주세요.');
    var targetClass = classById7355033(directory, context.classId) || classByContext735410(directory, context.className);
    if (!targetClass) return alert('선택한 반 정보를 찾지 못했습니다.');
    var mode = text(document.getElementById('ulimAttendanceAddMode735423').value) || 'new';
    var studentUid = text(document.getElementById('ulimAttendanceAddStudent735423').value);
    var directName = text(document.getElementById('ulimAttendanceAddDirectName735423').value);
    var student = (directory.students || []).find(function (item) { return item.studentUid === studentUid; }) || null;
    if (!student && mode !== 'makeup' && mode !== 'daily_special') return alert('신규·반이동·기존변경은 학생목록에서 학생을 선택해주세요.');
    if (!student && !directName) return alert('기존 학생을 선택하거나 학생명을 입력해주세요.');
    var historicalMode735433 = attendanceAddMonth735430(context) < today().slice(0, 7);
    var selectedDates = mode === 'existing' && !historicalMode735433 ? [] : selectedAttendanceAddDates735430();
    if ((mode !== 'existing' || historicalMode735433) && !selectedDates.length) return alert('적용할 수업일을 한 개 이상 체크해주세요.');
    var studentName = student ? student.name : directName;
    var dateSummary = mode === 'existing' && !historicalMode735433 ? '현재 수강반 정보 변경' : selectedDates.map(dateLabel7355033).join(', ');
    if (!confirm(targetClass.className + '\n' + studentName + ' · ' + attendanceAddModeLabel735410(mode) + '\n' + dateSummary + '\n\n적용할까요?')) return;
    try {
      allClassesState735410.actionInFlight = true;
      if (typeof global.showLoading === 'function') global.showLoading(studentName + ' 학생을 반영하는 중...');
      if (mode === 'new' || mode === 'class_move') {
        var targetMonth735432 = attendanceAddMonth735430(context);
        var currentMonth735432 = today().slice(0, 7);
        var historicalMonth735432 = targetMonth735432 < currentMonth735432;
        if (historicalMonth735432) {
          // Finished months are historical records. Never rewrite today's student class assignment
          // when an administrator is repairing a previous-month 신규/반이동 row.
          for (var historicalIndex735432 = 0; historicalIndex735432 < selectedDates.length; historicalIndex735432 += 1) {
            var historicalDate735432 = selectedDates[historicalIndex735432];
            if (historicalIndex735432 === 0) {
              await call('addTemporaryAttendanceAdmin7355014', {
                studentUid: student.studentUid,
                studentName: student.name,
                kind: mode,
                date: historicalDate735432,
                classId: targetClass.classId,
                className: targetClass.className,
                requestId: requestId('attendance-historical-special-' + mode + '-735432')
              });
            } else {
              await call('addAttendanceSessionStudentsAdmin73550', {
                date: historicalDate735432,
                classId: targetClass.classId,
                studentUids: [student.studentUid],
                requestId: requestId('attendance-historical-include-' + mode + '-735432')
              });
            }
          }
        } else {
          var operationDate = selectedDates[0];
          var sourceClassId735430 = mode === 'class_move' ? text(document.getElementById('ulimAttendanceAddMoveSource735430') && document.getElementById('ulimAttendanceAddMoveSource735430').value) : '';
          var movableIds735430 = mode === 'class_move' ? unique(student.selectedClassIds).filter(function (id) { return id !== targetClass.classId; }) : [];
          if (mode === 'class_move' && movableIds735430.length && !sourceClassId735430) throw new Error('이동 전 수강반을 선택해주세요.');
          await updateStudentClass735410(student, targetClass, mode, sourceClassId735430, operationDate);
          var monthSessions = attendanceAddCandidateSessions735430(context, targetClass).map(function (session) { return text(session.date); }).filter(Boolean);
          for (var i = 0; i < monthSessions.length; i += 1) {
            var sessionDate = monthSessions[i];
            var include = selectedDates.indexOf(sessionDate) >= 0;
            await call(include ? 'addAttendanceSessionStudentsAdmin73550' : 'removeAttendanceSessionStudentsAdmin73550', {
              date: sessionDate,
              classId: targetClass.classId,
              studentUids: [student.studentUid],
              normalizeRegularMembership: include && (mode === 'new' || mode === 'class_move'),
              requestId: requestId((include ? 'attendance-month-include-' : 'attendance-month-exclude-') + mode + '-735430')
            });
          }
        }
      } else if (mode === 'existing') {
        if (historicalMode735433) {
          for (var existingHistoryIndex735433 = 0; existingHistoryIndex735433 < selectedDates.length; existingHistoryIndex735433 += 1) {
            await call('addAttendanceSessionStudentsAdmin73550', {
              date: selectedDates[existingHistoryIndex735433], classId: targetClass.classId,
              studentUids: [student.studentUid], requestId: requestId('attendance-historical-existing-735433')
            });
          }
        } else {
          await updateStudentClass735410(student, targetClass, mode, '', text(context.date) || today());
        }
      } else {
        for (var j = 0; j < selectedDates.length; j += 1) {
          await call('addTemporaryAttendanceAdmin7355014', {
            studentUid: student ? student.studentUid : '', studentName: studentName, kind: mode,
            date: selectedDates[j], classId: targetClass.classId, className: targetClass.className,
            requestId: requestId('attendance-temp-' + mode + '-735430')
          });
        }
      }
      directoryCache = null;
      directoryLoadedAt = 0;
      document.getElementById('ulimAttendanceAddModal735423').style.display = 'none';
      await loadAllClassesData735410(true);
      if (attendancePanelActive7355016()) {
        var selectedClass = text(document.getElementById('adminAttendanceClass') && document.getElementById('adminAttendanceClass').value);
        if (selectedClass && selectedClass !== '전체반') await safeLoadAttendanceSnapshot(false);
      }
    } catch (error) { alert(text(error && error.message) || '학생을 추가하지 못했습니다.'); }
    finally { allClassesState735410.actionInFlight = false; if (typeof global.hideLoading === 'function') global.hideLoading(); }
  }

  function ensureAllClassesModal735410() {
    ensureLedgerStyles735425();
    var modal = document.getElementById('ulimAllClassesAttendanceModal735410');
    if (modal) {
      bindAllClassesHeaderControls735425(modal);
      return modal;
    }
    modal = document.createElement('div');
    modal.id = 'ulimAllClassesAttendanceModal735410';
    modal.innerHTML = ''
      + '<div class="ulim-ledger-shell735427">'
      +   '<header class="ulim-ledger-top735427">'
      +     '<div class="ulim-ledger-top-row735427">'
      +       '<div class="ulim-ledger-heading735427"><h3>전체반 출석부</h3></div>'
      +       '<div class="ulim-ledger-top-actions735427">'
      +         '<div class="ulim-ledger-context-tools735433"><span id="ulimAllClassesContext735410">전월·현재월 동시 표시</span><button type="button" id="ulimMonthlySessionPlan735433">수업일 지정</button><button type="button" id="ulimPreviousMonthEdit735433" title="전월 출석부 편집" aria-label="전월 출석부 편집">⚙</button></div>'
      +         '<label class="ulim-ledger-move-mode735427"><span>드래그 처리</span><select id="ulimAllClassesMoveMode735423"><option value="class_move">반이동</option><option value="existing">일반 이동</option><option value="new">신규</option><option value="makeup">보강</option></select></label>'
      +         '<button type="button" class="admin-btn red" id="ulimAllClassesRemoveSelected735423" style="display:none">선택 학생 제거</button>'
      +         '<button type="button" class="admin-btn blue" id="ulimAllClassesReload735423">새로고침</button>'
      +         '<button type="button" class="admin-btn gray" data-close-all-classes="1">닫기</button>'
      +       '</div>'
      +     '</div>'
      +     '<div id="ulimAllClassesTeacherTabs735423" class="ulim-ledger-teacher-tabs735427"></div>'
      +   '</header>'
      +   '<div id="ulimAllClassesStatus735410" class="ulim-ledger-status735427"></div>'
      +   '<main id="ulimAllClassesBoard735410" class="ulim-ledger-board735427"></main>'
      + '</div>';
    document.body.appendChild(modal);
    bindAllClassesHeaderControls735425(modal);
    return modal;
  }
  function closeAllClassesModal735425() {
    var modal = document.getElementById('ulimAllClassesAttendanceModal735410');
    if (modal) modal.style.display = 'none';
  }

  function bindAllClassesHeaderControls735425(modal) {
    if (!modal || modal.dataset.ulimHeaderControls735426 === '1') return;
    modal.dataset.ulimHeaderControls735426 = '1';
    modal.addEventListener('click', function (event) {
      var target = event && event.target && event.target.closest ? event.target.closest('button,[data-close-all-classes="1"]') : null;
      if (!target || !modal.contains(target)) return;
      if (target.closest('[data-close-all-classes="1"]')) {
        event.preventDefault();
        event.stopPropagation();
        closeAllClassesModal735425();
        return;
      }
      if (target.id === 'ulimAllClassesReload735423') {
        event.preventDefault();
        event.stopPropagation();
        requestManualAllClassesRefresh735426();
        return;
      }
      if (target.id === 'ulimAllClassesRemoveSelected735423') {
        event.preventDefault();
        event.stopPropagation();
        removeSelectedAllClassStudents735413();
        return;
      }
      if (target.id === 'ulimPreviousMonthEdit735433') {
        event.preventDefault(); event.stopPropagation(); openPreviousMonthEdit735433(); return;
      }
      if (target.id === 'ulimMonthlySessionPlan735433') {
        event.preventDefault(); event.stopPropagation(); openMonthlySessionPlan735433(); return;
      }
    }, true);
  }
  function setAllClassesStatus735410(message, isError) { var el = document.getElementById('ulimAllClassesStatus735410'); if (el) { el.textContent = message || ''; el.style.color = isError ? '#b91c1c' : '#475569'; } }
  function updateAllClassesRefreshButton735426(loading) {
    var button = document.getElementById('ulimAllClassesReload735423');
    if (!button) return;
    button.disabled = loading === true;
    button.textContent = loading === true ? '새로고침 중…' : (allClassesState735410.refreshAvailable ? '새로고침 ●' : '새로고침');
    button.setAttribute('aria-busy', loading === true ? 'true' : 'false');
  }
  function markAllClassesRefreshAvailable735426() {
    allClassesState735410.refreshAvailable = true;
    updateAllClassesRefreshButton735426(false);
    var modal = document.getElementById('ulimAllClassesAttendanceModal735410');
    if (modal && modal.style.display === 'block') {
      setAllClassesStatus735410('다른 화면에서 출석부가 변경되었습니다. 현재 화면은 유지됩니다. 새로고침을 눌러 반영하세요.');
    }
  }
  function requestManualAllClassesRefresh735426() {
    allClassesState735410.refreshAvailable = false;
    updateAllClassesRefreshButton735426(true);
    return loadAllClassesData735410(true, 'manual').catch(function () {});
  }
  function renderTeacherTabs735423() {
    var wrap = document.getElementById('ulimAllClassesTeacherTabs735423'); if (!wrap || !allClassesState735410.ledger) return;
    var teachers = Array.isArray(allClassesState735410.ledger.teachers) ? allClassesState735410.ledger.teachers.slice() : [];
    teachers = teachers.filter(Boolean).sort(function (a, b) { return text(a).localeCompare(text(b), 'ko'); });
    var allAllowed = isFullAdmin();
    var actor = currentStaffIdentity735434();
    if (!allAllowed) {
      teachers = actor.name ? [actor.name] : [];
      allClassesState735410.teacher = actor.name || '__self__';
    }
    var items = (allAllowed ? [{ value: 'all', label: '전체' }].concat(teachers.map(function (name) { return { value: name, label: name + 'T' }; })) : teachers.map(function (name) { return { value: name, label: name + 'T' }; }));
    wrap.innerHTML = items.map(function (item) { var active = normalize(allClassesState735410.teacher) === normalize(item.value); return '<button type="button" data-ledger-teacher="' + escapeHtml(item.value) + '" class="ulim-ledger-teacher-tab735425' + (active ? ' active' : '') + '">' + escapeHtml(item.label) + '</button>'; }).join('');
    if (wrap.dataset.ulimTeacherTabs735426 !== '1') {
      wrap.dataset.ulimTeacherTabs735426 = '1';
      wrap.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('[data-ledger-teacher]') : null;
        if (!button || !wrap.contains(button)) return;
        event.preventDefault();
        event.stopPropagation();
        allClassesState735410.teacher = text(button.getAttribute('data-ledger-teacher')) || 'all';
        renderAllClassesBoardLocal735410();
      }, true);
    }
  }
  function cellStatusHtml735423(group, student, session, cell) {
    var state = text(session.state); var eligible = cell && cell.eligible === true && state !== 'cancelled' && state !== 'moved';
    if (state === 'cancelled') return '<div class="ulim-ledger-session-off735423">휴강</div>';
    if (state === 'moved') return '<div class="ulim-ledger-session-off735423">변경</div>';
    if (!eligible) return '<button type="button" class="ulim-ledger-empty735423" data-ledger-add="1" title="학생 추가">＋</button>';
    var status = cleanAttendanceStatus7355014(cell.status || cell.attendanceStatus);
    var special = text(cell.specialStatus);
    var kind = specialKind7355033(special);
    var specialLabel = specialLabel7355033(special);
    var showDateSpecial = !!specialLabel && !(text(cell.specialDisplayScope) === 'name' && (kind === 'new' || kind === 'class_move'));
    return '<div class="ulim-ledger-cell-actions735423' + (cell && cell.__saving735425 ? ' saving' : '') + '"><button type="button" data-ledger-status="출석" class="ulim-ledger-ox735423 ' + (status === '출석' ? 'on-o' : '') + '">O</button><button type="button" data-ledger-status="결석" class="ulim-ledger-ox735423 ' + (status === '결석' ? 'on-x' : '') + '">X</button><button type="button" data-ledger-detail="1" class="ulim-ledger-more735423" title="당일 메모">⋯</button></div>' + (showDateSpecial ? '<div class="ulim-ledger-special735423' + specialCss7355033(special) + '">' + escapeHtml(specialLabel) + '</div>' : '');
  }

  function ledgerMonthNameSpecial735430(student, sessions) {
    var safeSessions = Array.isArray(sessions) ? sessions : [];
    var cells = student && student.cells || {};
    var eligibleCells = safeSessions.map(function (session) { return cells[session.date] || {}; }).filter(function (cell) { return cell.eligible === true; });
    for (var i = 0; i < eligibleCells.length; i += 1) {
      var cell = eligibleCells[i];
      var kind = specialKind7355033(cell.specialStatus);
      if (text(cell.specialDisplayScope) === 'name' && (kind === 'new' || kind === 'class_move')) return kind === 'new' ? '신규' : '반이동';
    }
    if (eligibleCells.length && eligibleCells.every(function (cell) { return specialKind7355033(cell.specialStatus) === 'makeup'; })) return '보강';
    return '';
  }

  function ledgerStudentMakeupOnly735430(student, sessions) {
    return specialKind7355033(ledgerMonthNameSpecial735430(student, sessions)) === 'makeup';
  }

  function ledgerStudentIdentityCells735427(group, student, rowIndex, monthKey, nameSpecial, historicalEdit) {
    var selectKey = group.classId + '|' + student.studentUid;
    var selected = allClassesState735410.selectedCards.has(selectKey);
    var selector = isFullAdmin() && !historicalEdit
      ? '<input type="checkbox" data-ledger-select="1" aria-label="학생 선택" ' + (selected ? 'checked' : '') + '>'
      : '';
    var gear = isFullAdmin() && !historicalEdit ? '<button type="button" data-ledger-gear="1" title="학생정보">⚙</button>' : '';
    var drag = isFullAdmin() && !historicalEdit ? '<span class="ulim-ledger-drag735423" data-ledger-drag="1" draggable="true" title="학생 이동">⋮⋮</span>' : '';
    var historyRemove = isFullAdmin() && historicalEdit ? '<button type="button" data-history-remove="1" title="이 전월 반에서 제거">×</button>' : '';
    var nameClass = specialCss7355033(nameSpecial);
    return '<td class="ulim-ledger-no735427">' + selector + '<span>' + (rowIndex + 1) + '</span></td>'
      + '<td class="ulim-ledger-name735427' + nameClass + '" data-month-roster="' + escapeHtml(monthKey) + '">' + drag + '<b>' + escapeHtml(student.studentName) + '</b>' + gear + historyRemove + '</td>';
  }


  function ledgerStudentsForMonth735429(group, sessions) {
    var safeSessions = Array.isArray(sessions) ? sessions : [];
    if (!safeSessions.length) return [];
    return (group && Array.isArray(group.students) ? group.students : []).filter(function (student) {
      var cells = student && student.cells || {};
      return safeSessions.some(function (session) {
        var cell = cells[session.date] || {};
        return cell.eligible === true;
      });
    }).sort(function (a, b) {
      var aMakeup = ledgerStudentMakeupOnly735430(a, safeSessions) ? 1 : 0;
      var bMakeup = ledgerStudentMakeupOnly735430(b, safeSessions) ? 1 : 0;
      if (aMakeup !== bMakeup) return aMakeup - bMakeup;
      return text(a.studentName).localeCompare(text(b.studentName), 'ko');
    });
  }


  function ledgerMonthBlockHtml735427(group, monthKey, sessions, kind, historicalEdit) {
    var isCurrent = kind === 'current';
    var safeSessions = Array.isArray(sessions) ? sessions : [];
    var students = ledgerStudentsForMonth735429(group, safeSessions);
    var columns = 3 + Math.max(1, safeSessions.length);
    var monthClass = isCurrent ? ' current' : ' prev';
    var classLine = '[' + text(group.instructorName) + 'T] ' + text(group.className) + ' · ' + text(group.startTime) + '~' + text(group.endTime);
    var header = '<tr><th colspan="' + columns + '" class="ulim-ledger-month735423' + monthClass + '"><b>' + escapeHtml(monthTitle7355033(monthKey)) + (isCurrent ? ' · 현재월' : ' · 전월') + '</b><small class="ulim-ledger-month-class735430">' + escapeHtml(classLine) + '</small></th></tr>';
    header += '<tr><th class="ulim-ledger-no735427">NO</th><th class="ulim-ledger-name735427">학생이름</th>';
    if (safeSessions.length) {
      header += safeSessions.map(function (session) {
        var substituteName = text(session.substituteInstructorName || session.instructorName || session.teacher); if (session.state === 'substitute' && !text(session.substituteInstructorName) && normalize(substituteName) === normalize(group.instructorName)) substituteName = ''; var badge = session.state === 'cancelled' ? '<span>휴강</span>' : session.state === 'substitute' ? '<span>대강 · ' + escapeHtml(substituteName ? substituteName + 'T' : '강사 확인필요') + '</span>' : session.state === 'moved' ? '<span>변경→' + escapeHtml(dateLabel7355033(session.targetDate)) + '</span>' : '';
        return '<th' + (historicalEdit ? '' : ' data-ledger-header="1"') + ' data-class-id="' + escapeHtml(group.classId) + '" data-date="' + escapeHtml(session.date) + '" class="ulim-ledger-date735423"><b>' + escapeHtml(dateLabel7355033(session.date)) + '</b><small>' + escapeHtml(weekdayLabel7355033(session)) + '</small>' + badge + '</th>';
      }).join('');
    } else {
      header += '<th class="ulim-ledger-date735423">-</th>';
    }
    header += '<th class="ulim-ledger-note735423">비고</th></tr>';

    var rows = students.map(function (student, rowIndex) {
      var cells = student.cells || {};
      var lastCurrentStatus = '';
      safeSessions.forEach(function (session) { var cell = cells[session.date] || {}; if (text(cell.currentStatus)) lastCurrentStatus = text(cell.currentStatus); });
      var nameSpecial = ledgerMonthNameSpecial735430(student, safeSessions);
      var row = '<tr data-ledger-student="' + escapeHtml(student.studentUid) + '" data-source-class="' + escapeHtml(group.classId) + '">';
      row += ledgerStudentIdentityCells735427(group, student, rowIndex, monthKey, nameSpecial, historicalEdit);
      if (safeSessions.length) {
        row += safeSessions.map(function (session) {
          var cell = cells[session.date] || { eligible: false };
          return '<td data-ledger-cell="1" data-class-id="' + escapeHtml(group.classId) + '" data-date="' + escapeHtml(session.date) + '" data-student-uid="' + escapeHtml(student.studentUid) + '">' + cellStatusHtml735423(group, student, session, cell) + '</td>';
        }).join('');
      } else {
        row += '<td class="ulim-ledger-empty-month735427">-</td>';
      }
      row += '<td class="ulim-ledger-note735423"><input type="text" data-ledger-note="1" data-class-id="' + escapeHtml(group.classId) + '" data-student-uid="' + escapeHtml(student.studentUid) + '" data-month="' + escapeHtml(monthKey) + '" value="' + escapeHtml(lastCurrentStatus) + '" placeholder="비고 입력" aria-label="' + escapeHtml(student.studentName) + ' 비고"></td>';
      return row + '</tr>';
    }).join('');

    if (isFullAdmin()) {
      var addDate = safeSessions[0];
      rows += '<tr class="ulim-ledger-add-row735423"><td></td><td><button type="button" data-ledger-add-class="1" data-class-id="' + escapeHtml(group.classId) + '" data-date="' + escapeHtml(addDate && addDate.date || '') + '" data-month="' + escapeHtml(monthKey) + '">＋ 학생 추가</button></td><td colspan="' + (Math.max(1, safeSessions.length) + 1) + '"></td></tr>';
    }
    var minimumTableWidth = 52 + 154 + 140 + (Math.max(1, safeSessions.length) * 92);
    return '<div class="ulim-ledger-month-card735427' + monthClass + '" data-ledger-month="' + escapeHtml(monthKey) + '"><table class="ulim-ledger-table735423" style="min-width:' + minimumTableWidth + 'px"><thead>' + header + '</thead><tbody>' + rows + '</tbody></table></div>';
  }


  function renderAllClassesBoardLocal735410() {
    var board = document.getElementById('ulimAllClassesBoard735410');
    if (!board) return;
    var scrollByClass735427 = {};
    board.querySelectorAll('[data-ledger-class]').forEach(function (section) {
      var classId = text(section.getAttribute('data-ledger-class'));
      var scroll = section.querySelector('.ulim-ledger-scroll735423');
      if (classId && scroll) scrollByClass735427[classId] = scroll.scrollLeft;
    });
    var ledger = allClassesState735410.ledger;
    if (!ledger) {
      board.innerHTML = '<div class="ulim-ledger-empty-state735427">출석부를 불러오는 중...</div>';
      return;
    }
    var removeButton = document.getElementById('ulimAllClassesRemoveSelected735423');
    if (removeButton) {
      removeButton.style.display = isFullAdmin() ? 'inline-flex' : 'none';
      removeButton.textContent = allClassesState735410.selectedCards.size ? '선택 학생 제거 (' + allClassesState735410.selectedCards.size + ')' : '선택 학생 제거';
    }
    renderTeacherTabs735423();
    var teacher = normalize(allClassesState735410.teacher || 'all');
    var groups = (ledger.groups || []).filter(function (group) {
      if (!isFullAdmin()) return classBelongsToCurrentStaff735434(group);
      return teacher === 'all' || normalize(group.instructorName) === teacher;
    }).sort(wholeClassGroupCompare735432);
    var adminTools735434 = document.querySelector('.ulim-ledger-context-tools735433');
    if (adminTools735434) adminTools735434.style.display = isFullAdmin() ? '' : 'none';
    var moveMode735434 = document.getElementById('ulimAllClassesMoveMode735423');
    var moveLabel735434 = moveMode735434 && moveMode735434.closest ? moveMode735434.closest('.ulim-ledger-move-mode735427') : null;
    if (moveLabel735434) moveLabel735434.style.display = isFullAdmin() ? '' : 'none';
    if (!groups.length) {
      board.innerHTML = '<div class="ulim-ledger-empty-state735427">표시할 반이 없습니다.</div>';
      return;
    }
    var prevMonth = text(ledger.previousMonth);
    var currentMonth = text(ledger.currentMonth);
    board.innerHTML = groups.map(function (group) {
      var prevSessions = (group.sessions || []).filter(function (session) { return text(session.date).slice(0, 7) === prevMonth; });
      var currentSessions = (group.sessions || []).filter(function (session) { return text(session.date).slice(0, 7) === currentMonth; });
      var currentRosterCount735429 = ledgerStudentsForMonth735429(group, currentSessions).length;
      return '<section class="ulim-ledger-class735423" data-ledger-class="' + escapeHtml(group.classId) + '">'
        + '<div class="ulim-ledger-class-title735423"><div><b>' + escapeHtml(group.className) + '</b><span>' + escapeHtml(group.instructorName + 'T · ' + group.startTime + '~' + group.endTime) + '</span></div><span>' + currentRosterCount735429 + '명</span></div>'
        + '<div class="ulim-ledger-scroll735423"><div class="ulim-ledger-month-pair735427">'
        + ledgerMonthBlockHtml735427(group, prevMonth, prevSessions, 'prev', false)
        + ledgerMonthBlockHtml735427(group, currentMonth, currentSessions, 'current', false)
        + '</div></div></section>';
    }).join('');
    bindLedgerEvents735423(board, false);
    board.querySelectorAll('[data-ledger-class]').forEach(function (section) {
      var classId = text(section.getAttribute('data-ledger-class'));
      var scroll = section.querySelector('.ulim-ledger-scroll735423');
      if (classId && scroll && Object.prototype.hasOwnProperty.call(scrollByClass735427, classId)) scroll.scrollLeft = scrollByClass735427[classId];
    });
    var contextText735433='전월 ' + monthLabel7355033(prevMonth) + ' / 현재월 ' + monthLabel7355033(currentMonth) + ' · ' + groups.length + '개 반';
    var contextNode735433=document.getElementById('ulimAllClassesContext735410');if(contextNode735433)contextNode735433.textContent=contextText735433;
    setAllClassesStatus735410('');
    var historyModal735433=document.getElementById('ulimPreviousMonthEditModal735433');if(historyModal735433&&historyModal735433.style.display==='flex')renderPreviousMonthEdit735433();
  }
  function ensurePreviousMonthEditModal735433() {
    var modal = document.getElementById('ulimPreviousMonthEditModal735433');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimPreviousMonthEditModal735433';
    modal.className = 'ulim-ledger-submodal735433';
    modal.innerHTML = '<section class="ulim-ledger-submodal-card735433"><header><div><b id="ulimPreviousMonthEditTitle735433">전월 출석부 편집</b><small>이 화면의 수정은 전월 기록에만 적용되며 현재 학생명단·현재 수강반·태블릿에는 영향을 주지 않습니다.</small></div><button type="button" data-close-prev-edit735433="1">×</button></header><main id="ulimPreviousMonthEditBoard735433"></main><footer><button type="button" class="admin-btn gray" data-close-prev-edit735433="1">닫기</button></footer></section>';
    modal.addEventListener('click', function (event) { if (event.target === modal || (event.target && event.target.closest('[data-close-prev-edit735433="1"]'))) modal.style.display = 'none'; });
    document.body.appendChild(modal);
    return modal;
  }
  function renderPreviousMonthEdit735433() {
    var modal = document.getElementById('ulimPreviousMonthEditModal735433');
    var board = document.getElementById('ulimPreviousMonthEditBoard735433');
    var ledger = allClassesState735410.ledger;
    if (!modal || !board || !ledger) return;
    var prevMonth = text(ledger.previousMonth);
    document.getElementById('ulimPreviousMonthEditTitle735433').textContent = monthLabel7355033(prevMonth) + ' 전월 출석부 편집';
    var groups = (ledger.groups || []).slice().sort(wholeClassGroupCompare735432);
    board.innerHTML = groups.map(function (group) {
      var sessions = (group.sessions || []).filter(function (session) { return text(session.date).slice(0, 7) === prevMonth; });
      if (!sessions.length) return '';
      return '<section class="ulim-ledger-class735423" data-ledger-class="' + escapeHtml(group.classId) + '"><div class="ulim-ledger-class-title735423"><div><b>' + escapeHtml(group.className) + '</b><span>' + escapeHtml(group.instructorName + 'T · ' + group.startTime + '~' + group.endTime) + '</span></div></div><div class="ulim-ledger-scroll735423">' + ledgerMonthBlockHtml735427(group, prevMonth, sessions, 'prev', true) + '</div></section>';
    }).join('') || '<div class="ulim-ledger-empty-state735427">전월 수업 기록이 없습니다.</div>';
    bindLedgerEvents735423(board, true);
  }
  async function openPreviousMonthEdit735433() {
    if (!isFullAdmin()) return alert('전체관리자 권한이 필요합니다.');
    if (!allClassesState735410.ledger) await loadAllClassesData735410(false);
    var modal = ensurePreviousMonthEditModal735433();
    renderPreviousMonthEdit735433();
    modal.style.display = 'flex';
  }
  async function removePreviousMonthStudent735433(group, student) {
    if (!isFullAdmin() || !group || !student || !allClassesState735410.ledger) return;
    var prevMonth = text(allClassesState735410.ledger.previousMonth);
    var dates = (group.sessions || []).filter(function (session) { return text(session.date).slice(0, 7) === prevMonth && student.cells && student.cells[session.date] && student.cells[session.date].eligible === true; }).map(function (session) { return session.date; });
    if (!dates.length) return;
    if (!confirm(student.studentName + ' 학생을 ' + monthLabel7355033(prevMonth) + ' ' + group.className + ' 기록에서 제거할까요?\n현재월 수강반은 변경되지 않습니다.')) return;
    try {
      allClassesState735410.actionInFlight = true;
      for (var i=0;i<dates.length;i+=1) await call('removeAttendanceSessionStudentsAdmin73550',{date:dates[i],classId:group.classId,studentUids:[student.studentUid],requestId:requestId('history-remove-735433')});
      await loadAllClassesData735410(true, 'history-remove');
    } catch(error) { alert(text(error&&error.message)||'전월 학생 기록을 제거하지 못했습니다.'); }
    finally { allClassesState735410.actionInFlight=false; }
  }

  function ensureMonthlySessionPlanModal735433() {
    var modal = document.getElementById('ulimMonthlySessionPlanModal735433');
    if (modal) return modal;
    modal = document.createElement('div'); modal.id='ulimMonthlySessionPlanModal735433'; modal.className='ulim-ledger-submodal735433';
    modal.innerHTML='<section class="ulim-ledger-plan-card735433"><header><div><b id="ulimMonthlySessionPlanTitle735433">현재월 수업일 지정</b><small>요일별 체크 상태를 해당 요일의 모든 반에 한 번에 적용합니다.</small></div><button type="button" data-close-session-plan735433="1">×</button></header><div class="ulim-ledger-weekday-tabs735433" id="ulimMonthlySessionWeekdays735433"></div><div id="ulimMonthlySessionPlanBody735433" class="ulim-ledger-plan-body735433"></div><footer><button type="button" class="admin-btn gray" data-close-session-plan735433="1">취소</button><button type="button" class="admin-btn blue" id="ulimMonthlySessionPlanApply735433" disabled>적용</button></footer></section>';
    modal.addEventListener('click',function(event){ if(event.target===modal||(event.target&&event.target.closest('[data-close-session-plan735433="1"]'))){modal.style.display='none';return;} var day=event.target&&event.target.closest?event.target.closest('[data-session-weekday735433]'):null;if(day)loadMonthlySessionWeekday735433(Number(day.dataset.sessionWeekday735433));});
    document.body.appendChild(modal); return modal;
  }
  async function openMonthlySessionPlan735433() {
    if(!isFullAdmin())return alert('전체관리자 권한이 필요합니다.');
    if(!allClassesState735410.ledger)await loadAllClassesData735410(false);
    var modal=ensureMonthlySessionPlanModal735433();var month=text(allClassesState735410.ledger&&allClassesState735410.ledger.currentMonth)||today().slice(0,7);
    modal.dataset.month=month;document.getElementById('ulimMonthlySessionPlanTitle735433').textContent=monthLabel7355033(month)+' 현재월 수업일 지정';
    var weekdays=document.getElementById('ulimMonthlySessionWeekdays735433');weekdays.innerHTML=[{label:'월',day:1},{label:'화',day:2},{label:'수',day:3},{label:'목',day:4},{label:'금',day:5},{label:'토',day:6},{label:'일',day:0}].map(function(item){return '<button type="button" data-session-weekday735433="'+item.day+'">'+item.label+'요일</button>';}).join('');
    document.getElementById('ulimMonthlySessionPlanBody735433').innerHTML='<div class="ulim-ledger-plan-guide735433">수업일을 조정할 요일을 선택해주세요.</div>';document.getElementById('ulimMonthlySessionPlanApply735433').disabled=true;modal.style.display='flex';
  }
  async function loadMonthlySessionWeekday735433(weekday) {
    var modal=document.getElementById('ulimMonthlySessionPlanModal735433');if(!modal)return;var month=text(modal.dataset.month)||today().slice(0,7);var body=document.getElementById('ulimMonthlySessionPlanBody735433');
    body.innerHTML='<div class="ulim-ledger-plan-guide735433">수업일을 불러오는 중...</div>';
    try{var data=await call('getMonthlyWeekdaySessionPlanAdmin7355034',{month:month,weekday:weekday,requestId:requestId('monthly-session-plan-read-735433')});modal.dataset.weekday=String(weekday);Array.from(document.querySelectorAll('#ulimMonthlySessionWeekdays735433 [data-session-weekday735433]')).forEach(function(btn){btn.classList.toggle('active',Number(btn.dataset.sessionWeekday735433)===weekday);});var dates=Array.isArray(data.dates)?data.dates:[];body.innerHTML='<div class="ulim-ledger-plan-summary735433"><b>'+escapeHtml(data.weekdayLabel||'')+'</b><span>'+Number(data.classCount||0)+'개 반에 일괄 적용</span><label><input type="checkbox" id="ulimMonthlySessionAll735433"> 전체선택</label></div><div class="ulim-ledger-plan-dates735433">'+(dates.length?dates.map(function(item){return '<label><input type="checkbox" data-month-session-date735433="1" value="'+escapeHtml(item.date)+'"'+(item.checked?' checked':'')+'><span><b>'+escapeHtml(dateLabel7355033(item.date))+'</b><small>'+escapeHtml(scheduleWeekday7355014(item.date))+(item.partial?' · 일부 반 제외됨':'')+'</small></span></label>';}).join(''):'<div class="ulim-ledger-plan-guide735433">해당 요일의 날짜가 없습니다.</div>')+'</div>';
      var boxes=Array.from(body.querySelectorAll('[data-month-session-date735433]'));var all=body.querySelector('#ulimMonthlySessionAll735433');var sync=function(){var count=boxes.filter(function(box){return box.checked;}).length;if(all){all.checked=boxes.length>0&&count===boxes.length;all.indeterminate=count>0&&count<boxes.length;}};boxes.forEach(function(box){box.addEventListener('change',sync);});if(all)all.addEventListener('change',function(){boxes.forEach(function(box){box.checked=all.checked;});all.indeterminate=false;});sync();var apply=document.getElementById('ulimMonthlySessionPlanApply735433');apply.disabled=!dates.length;apply.onclick=function(){applyMonthlySessionPlan735433();};
    }catch(error){body.innerHTML='<div class="ulim-ledger-plan-guide735433">'+escapeHtml(text(error&&error.message)||'수업일을 불러오지 못했습니다.')+'</div>';}
  }
  async function applyMonthlySessionPlan735433(){var modal=document.getElementById('ulimMonthlySessionPlanModal735433');if(!modal)return;var month=text(modal.dataset.month);var weekday=Number(modal.dataset.weekday);var selected=Array.from(modal.querySelectorAll('[data-month-session-date735433]:checked')).map(function(box){return text(box.value);});if(!Number.isInteger(weekday))return alert('요일을 선택해주세요.');if(!confirm('선택한 수업일을 이 요일의 모든 반에 적용할까요?\n체크 해제한 날짜는 수업일에서 제외됩니다.'))return;try{if(typeof global.showLoading==='function')global.showLoading('전체 반 수업일을 적용하는 중...');await call('setMonthlyWeekdaySessionsAdmin7355034',{month:month,weekday:weekday,selectedDates:selected,requestId:requestId('monthly-session-plan-save-735433')});modal.style.display='none';await loadAllClassesData735410(true,'monthly-session-plan');}catch(error){alert(text(error&&error.message)||'수업일을 저장하지 못했습니다.');}finally{if(typeof global.hideLoading==='function')global.hideLoading();}}

  function groupById735423(classId) { return (allClassesState735410.ledger && allClassesState735410.ledger.groups || []).find(function (group) { return text(group.classId) === text(classId); }) || null; }
  function studentByLedger735423(group, uid) { return (group && group.students || []).find(function (s) { return text(s.studentUid) === text(uid); }) || null; }
  function syncLedgerCellDom735427(group, student, session) {
    if (!group || !student || !session) return;
    var roots = [document.getElementById('ulimAllClassesBoard735410'), document.getElementById('ulimPreviousMonthEditBoard735433')].filter(Boolean);
    roots.forEach(function (board) { Array.from(board.querySelectorAll('[data-ledger-cell]')).forEach(function (node) {
      if (text(node.dataset.classId) !== text(group.classId)) return;
      if (text(node.dataset.studentUid) !== text(student.studentUid)) return;
      if (text(node.dataset.date) !== text(session.date)) return;
      var cell = student.cells && student.cells[session.date] || { eligible: false };
      node.innerHTML = cellStatusHtml735423(group, student, session, cell);
    }); });
  }

  async function saveLedgerCell735423(group, student, session, patch) {
    var cell = student.cells && student.cells[session.date] || {};
    var before = Object.assign({}, cell);
    var requestedStatus = patch && Object.prototype.hasOwnProperty.call(patch, 'status') ? text(patch.status) : text(cell.status || cell.attendanceStatus || '미체크');
    var payload = { date: session.date, classId: group.classId, className: group.className, studentUid: student.studentUid, studentName: student.studentName, name: student.studentName, attendanceNo: student.attendanceNo, studentNo: student.attendanceNo, status: requestedStatus || '미체크', attendanceStatus: requestedStatus || '미체크', specialStatus: text(patch.specialStatus != null ? patch.specialStatus : cell.specialStatus), currentStatus: text(patch.currentStatus != null ? patch.currentStatus : cell.currentStatus), memo: text(patch.memo != null ? patch.memo : cell.memo) };
    Object.assign(cell, payload, { eligible: true, __saving735425: true });
    if (!student.cells) student.cells = {};
    student.cells[session.date] = cell;
    syncLedgerCellDom735427(group, student, session);
    allClassesState735410.actionInFlight = true;
    try {
      await call('saveAttendanceRowsAdmin73550', { rows: [payload], requestId: requestId('ledger-attendance-save-735427') });
      delete cell.__saving735425;
      syncLedgerCellDom735427(group, student, session);
    } catch (error) {
      student.cells[session.date] = before;
      syncLedgerCellDom735427(group, student, session);
      alert(text(error && error.message) || '출석 저장에 실패했습니다.');
    } finally {
      allClassesState735410.actionInFlight = false;
    }
  }
  async function saveLedgerMonthNote735430(group, student, monthKey, value, input) {
    if (!fullAdminOrTeacher7355033() || !group || !student) return;
    var sessions = (group.sessions || []).filter(function (session) { return text(session.date).slice(0, 7) === text(monthKey) && session.state !== 'cancelled' && session.state !== 'moved'; });
    var rows = [];
    sessions.forEach(function (session) {
      var cell = student.cells && student.cells[session.date] || {};
      if (cell.eligible !== true) return;
      rows.push({
        date: session.date, classId: group.classId, className: group.className,
        studentUid: student.studentUid, studentName: student.studentName, name: student.studentName,
        attendanceNo: student.attendanceNo, studentNo: student.attendanceNo,
        status: cleanAttendanceStatus7355014(cell.status || cell.attendanceStatus) || '미체크',
        attendanceStatus: cleanAttendanceStatus7355014(cell.status || cell.attendanceStatus) || '미체크',
        specialStatus: text(cell.specialStatus), currentStatus: text(value), memo: text(cell.memo)
      });
    });
    if (!rows.length) return;
    if (input) { input.disabled = true; input.classList.add('saving'); }
    try {
      await call('saveAttendanceRowsAdmin73550', { rows: rows, requestId: requestId('ledger-month-note-735430') });
      rows.forEach(function (row) { if (student.cells && student.cells[row.date]) student.cells[row.date].currentStatus = text(value); });
      if (input) input.classList.add('saved');
      setTimeout(function () { if (input) input.classList.remove('saved'); }, 900);
    } catch (error) {
      alert(text(error && error.message) || '비고 저장에 실패했습니다.');
    } finally {
      if (input) { input.disabled = false; input.classList.remove('saving'); }
    }
  }

  function ensureLedgerDetailModal735423() {
    var modal = document.getElementById('ulimLedgerDetailModal735423'); if (modal) return modal;
    modal = document.createElement('div'); modal.id='ulimLedgerDetailModal735423'; modal.style.cssText='display:none;position:fixed;inset:0;z-index:2147483652;align-items:center;justify-content:center;background:rgba(15,23,42,.55);padding:18px';
    modal.innerHTML='<section style="width:min(520px,96vw);background:#fff;border-radius:16px;overflow:hidden"><header style="padding:14px 16px;border-bottom:1px solid #e2e8f0"><b id="ulimLedgerDetailTitle735423">당일 메모</b></header><div style="padding:16px"><label style="display:grid;gap:6px;font-size:12px;font-weight:900;color:#334155">메모<textarea id="ulimLedgerMemo735423" rows="5" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:9px" placeholder="해당 수업일 메모"></textarea></label></div><footer style="padding:12px 16px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:8px"><button class="admin-btn gray" data-ledger-detail-close="1">취소</button><button class="admin-btn blue" id="ulimLedgerDetailSave735423">저장</button></footer></section>';
    modal.onclick=function(e){if(e.target===modal || (e.target&&e.target.closest('[data-ledger-detail-close="1"]')))modal.style.display='none';}; document.body.appendChild(modal); return modal;
  }
  function openLedgerDetail735423(group, student, session) {
    var cell=student.cells&&student.cells[session.date]||{}; var modal=ensureLedgerDetailModal735423();
    document.getElementById('ulimLedgerDetailTitle735423').textContent=session.date+' · '+student.studentName+' · 메모';
    document.getElementById('ulimLedgerMemo735423').value=text(cell.memo);
    document.getElementById('ulimLedgerDetailSave735423').onclick=async function(){await saveLedgerCell735423(group,student,session,{memo:document.getElementById('ulimLedgerMemo735423').value}); modal.style.display='none';}; modal.style.display='flex';
  }

  function ensureLedgerScheduleModal735427() {
    var modal = document.getElementById('ulimLedgerScheduleModal735427');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimLedgerScheduleModal735427';
    modal.className = 'ulim-ledger-action-modal735427';
    modal.innerHTML = ''
      + '<section class="ulim-ledger-action-sheet735427">'
      +   '<header class="ulim-ledger-action-head735427"><div><b>수업 일정 관리</b><span id="ulimLedgerScheduleContext735427"></span></div><button type="button" data-ledger-schedule-close="1" aria-label="닫기">×</button></header>'
      +   '<div class="ulim-ledger-action-body735427">'
      +     '<div class="ulim-ledger-action-choice735427">'
      +       '<button type="button" data-ledger-schedule-action="cancel">휴강</button>'
      +       '<button type="button" data-ledger-schedule-action="substitute">대강</button>'
      +       '<button type="button" data-ledger-schedule-action="move">수업일 변경</button>'
      +       '<button type="button" data-ledger-schedule-action="exclude">수업일 제외</button>'
      +     '</div>'
      +     '<div id="ulimLedgerScheduleFields735427" class="ulim-ledger-action-fields735427"></div>'
      +   '</div>'
      +   '<footer class="ulim-ledger-action-foot735427"><button type="button" class="admin-btn gray" data-ledger-schedule-close="1">취소</button><button type="button" class="admin-btn blue" id="ulimLedgerScheduleSubmit735427" disabled>적용</button></footer>'
      + '</section>';
    modal.addEventListener('click', function (event) {
      if (event.target === modal || (event.target && event.target.closest('[data-ledger-schedule-close="1"]'))) {
        modal.style.display = 'none';
        return;
      }
      var actionButton = event.target && event.target.closest ? event.target.closest('[data-ledger-schedule-action]') : null;
      if (!actionButton) return;
      chooseLedgerScheduleAction735427(text(actionButton.dataset.ledgerScheduleAction));
    });
    var submit = modal.querySelector('#ulimLedgerScheduleSubmit735427');
    if (submit) submit.addEventListener('click', function () { applyScheduleOperation735423(); });
    document.body.appendChild(modal);
    return modal;
  }

  function teacherOptions735427(query) {
    var directory = allClassesState735410.directory || {};
    var q = normalize(query);
    var teachers = Array.isArray(directory.teachers) ? directory.teachers.slice() : [];
    if (!teachers.length) {
      teachers = (allClassesState735410.ledger && Array.isArray(allClassesState735410.ledger.teachers) ? allClassesState735410.ledger.teachers : []).map(function (name) {
        return { instructorName: text(name), instructorUid: '' };
      });
    }
    return teachers.filter(function (teacher) {
      var name = text(teacher.instructorName || teacher.name || teacher.teacherName);
      return name && (!q || normalize(name).indexOf(q) >= 0);
    }).sort(function (a, b) {
      var aName = text(a.instructorName || a.name || a.teacherName);
      var bName = text(b.instructorName || b.name || b.teacherName);
      return aName.localeCompare(bName, 'ko');
    });
  }

  function renderTeacherSelect735427(query) {
    var select = document.getElementById('ulimLedgerSubTeacher735427');
    if (!select) return;
    var current = text(select.value);
    var list = teacherOptions735427(query);
    select.innerHTML = '<option value="">강사를 선택하세요</option>' + list.map(function (teacher) {
      var name = text(teacher.instructorName || teacher.name || teacher.teacherName);
      var uid = text(teacher.instructorUid || teacher.teacherUid || teacher.uid);
      return '<option value="' + escapeHtml(uid + '|' + name) + '">' + escapeHtml(name) + '</option>';
    }).join('');
    if (current && Array.from(select.options).some(function (option) { return option.value === current; })) select.value = current;
  }

  function chooseLedgerScheduleAction735427(action) {
    var state = allClassesState735410.scheduleContext || {};
    var group = state.group || {};
    var session = state.session || {};
    allClassesState735410.scheduleAction = action;
    var modal = ensureLedgerScheduleModal735427();
    Array.from(modal.querySelectorAll('[data-ledger-schedule-action]')).forEach(function (button) {
      button.classList.toggle('active', text(button.dataset.ledgerScheduleAction) === action);
    });
    var fields = document.getElementById('ulimLedgerScheduleFields735427');
    var submit = document.getElementById('ulimLedgerScheduleSubmit735427');
    if (!fields || !submit) return;
    submit.disabled = !action;
    if (action === 'cancel') {
      fields.innerHTML = '<label class="ulim-ledger-field735427"><span>휴강 사유</span><textarea id="ulimLedgerScheduleReason735427" rows="3" placeholder="선택 입력"></textarea></label>'
        + '<label class="ulim-ledger-notify735427"><input type="checkbox" id="ulimLedgerScheduleNotify735427" checked><span>학생·학부모에게 알림톡 발송</span></label>';
      submit.textContent = '휴강 적용';
      return;
    }
    if (action === 'substitute') {
      fields.innerHTML = '<label class="ulim-ledger-field735427"><span>대강 강사 검색</span><input type="search" id="ulimLedgerSubTeacherSearch735427" placeholder="강사명을 입력하세요"></label>'
        + '<label class="ulim-ledger-field735427"><span>대강 강사 선택</span><select id="ulimLedgerSubTeacher735427"></select></label>'
        + '<div class="ulim-ledger-inline-info735427">' + escapeHtml(session.date || '') + ' · ' + escapeHtml((session.startTime || group.startTime || '') + '~' + (session.endTime || group.endTime || '')) + '</div>'
        + '<label class="ulim-ledger-field735427"><span>대강 사유</span><textarea id="ulimLedgerScheduleReason735427" rows="2" placeholder="선택 입력"></textarea></label>'
        + '<label class="ulim-ledger-notify735427"><input type="checkbox" id="ulimLedgerScheduleNotify735427" checked><span>학생·학부모에게 알림톡 발송</span></label>';
      var search = document.getElementById('ulimLedgerSubTeacherSearch735427');
      if (search) search.addEventListener('input', function () { renderTeacherSelect735427(search.value); });
      renderTeacherSelect735427('');
      submit.textContent = '대강 적용';
      return;
    }
    if (action === 'exclude') {
      fields.innerHTML = '<div class="ulim-ledger-action-warning735430">이 날짜를 이번 달 수업일에서 제외합니다. 저장 후 전체반·일반 출석부·태블릿에서 같은 날짜의 수업이 제외됩니다.</div>'
        + '<label class="ulim-ledger-field735427"><span>제외 사유</span><textarea id="ulimLedgerScheduleReason735427" rows="2" placeholder="예: 4주 수업 운영"></textarea></label>';
      submit.textContent = '수업일 제외';
      return;
    }
    if (action === 'move') {
      fields.innerHTML = '<div class="ulim-ledger-date-time-grid735427">'
        + '<label class="ulim-ledger-field735427"><span>변경 날짜</span><input type="date" id="ulimLedgerMoveDate735427" value="' + escapeHtml(session.date || today()) + '"></label>'
        + '<label class="ulim-ledger-field735427"><span>시작 시간</span><input type="time" id="ulimLedgerMoveStart735427" value="' + escapeHtml(session.startTime || group.startTime || '') + '"></label>'
        + '<label class="ulim-ledger-field735427"><span>종료 시간</span><input type="time" id="ulimLedgerMoveEnd735427" value="' + escapeHtml(session.endTime || group.endTime || '') + '"></label>'
        + '</div>'
        + '<label class="ulim-ledger-field735427"><span>변경 사유</span><textarea id="ulimLedgerScheduleReason735427" rows="2" placeholder="선택 입력"></textarea></label>'
        + '<label class="ulim-ledger-notify735427"><input type="checkbox" id="ulimLedgerScheduleNotify735427" checked><span>학생·학부모에게 알림톡 발송</span></label>';
      submit.textContent = '수업일 변경';
    }
  }

  async function scheduleOperationPrompt735423(group, session) {
    if (!isFullAdmin() || allClassesState735410.actionInFlight) return;
    allClassesState735410.scheduleContext = { group: group, session: session };
    allClassesState735410.scheduleAction = '';
    var modal = ensureLedgerScheduleModal735427();
    document.getElementById('ulimLedgerScheduleContext735427').textContent = session.date + ' · ' + group.className;
    document.getElementById('ulimLedgerScheduleFields735427').innerHTML = '<div class="ulim-ledger-action-guide735427">처리할 항목을 버튼으로 선택하세요.</div>';
    document.getElementById('ulimLedgerScheduleSubmit735427').disabled = true;
    Array.from(modal.querySelectorAll('[data-ledger-schedule-action]')).forEach(function (button) { button.classList.remove('active'); });
    modal.style.display = 'flex';
    try {
      if (!allClassesState735410.directory) allClassesState735410.directory = await loadDirectory(false);
      if (allClassesState735410.scheduleAction === 'substitute') {
        var teacherSearch735427 = document.getElementById('ulimLedgerSubTeacherSearch735427');
        renderTeacherSelect735427(teacherSearch735427 ? teacherSearch735427.value : '');
      }
    } catch (_ignoreDirectory735427) {}
  }

  async function applyScheduleOperation735423() {
    var state = allClassesState735410.scheduleContext || {};
    var group = state.group;
    var session = state.session;
    var operation = text(allClassesState735410.scheduleAction);
    if (!group || !session || !operation) return;
    var targetDate = session.date;
    var startTime = session.startTime || group.startTime;
    var endTime = session.endTime || group.endTime;
    var instructorUid = session.instructorUid || group.instructorUid;
    var instructorName = session.instructorName || group.instructorName;
    var reason = text(document.getElementById('ulimLedgerScheduleReason735427') && document.getElementById('ulimLedgerScheduleReason735427').value);
    var notify = operation === 'exclude' ? false : !!(document.getElementById('ulimLedgerScheduleNotify735427') && document.getElementById('ulimLedgerScheduleNotify735427').checked);
    if (operation === 'substitute') {
      var selectedTeacher = text(document.getElementById('ulimLedgerSubTeacher735427') && document.getElementById('ulimLedgerSubTeacher735427').value);
      if (!selectedTeacher) return alert('대강 강사를 선택해주세요.');
      var teacherParts = selectedTeacher.split('|');
      instructorUid = text(teacherParts.shift());
      instructorName = text(teacherParts.join('|'));
      if (!instructorName) return alert('대강 강사를 선택해주세요.');
    }
    if (operation === 'move') {
      targetDate = text(document.getElementById('ulimLedgerMoveDate735427') && document.getElementById('ulimLedgerMoveDate735427').value);
      startTime = text(document.getElementById('ulimLedgerMoveStart735427') && document.getElementById('ulimLedgerMoveStart735427').value);
      endTime = text(document.getElementById('ulimLedgerMoveEnd735427') && document.getElementById('ulimLedgerMoveEnd735427').value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return alert('변경 날짜를 선택해주세요.');
      if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return alert('시작·종료 시간을 선택해주세요.');
      if (startTime >= endTime) return alert('종료 시간은 시작 시간보다 늦어야 합니다.');
    }
    var label = operation === 'cancel' ? '휴강' : operation === 'substitute' ? '대강' : operation === 'exclude' ? '수업일 제외' : '수업일 변경';
    if (!confirm(label + '을 적용할까요?' + (notify ? '\n학생·학부모 알림톡도 발송합니다.' : ''))) return;
    try {
      allClassesState735410.actionInFlight = true;
      if (typeof global.showLoading === 'function') global.showLoading(label + ' 처리 중...');
      var result = await call('changeClassSessionAdmin73550', {
        operation: operation,
        originalDate: session.date,
        targetDate: targetDate,
        classId: group.classId,
        className: group.className,
        startTime: startTime,
        endTime: endTime,
        instructorUid: instructorUid,
        instructorName: instructorName,
        reason: reason,
        sendNotification: notify,
        targets: ['student', 'parent'],
        requestId: requestId('ledger-schedule-' + operation + '-735427')
      });
      document.getElementById('ulimLedgerScheduleModal735427').style.display = 'none';
      if (result && result.notification && result.notification.requested && result.notification.ok === false) alert(label + '은 저장됐지만 알림톡 발송 상태를 확인해주세요.\n' + text(result.notification.error));
      await loadAllClassesData735410(true, 'schedule-action');
    } catch (error) {
      alert(text(error && error.message) || label + ' 처리에 실패했습니다.');
    } finally {
      allClassesState735410.actionInFlight = false;
      if (typeof global.hideLoading === 'function') global.hideLoading();
    }
  }
  function bindLedgerEvents735423(board, historicalOnly) {
    board = board || document.getElementById('ulimAllClassesBoard735410');
    if (!board || board.dataset.ulimLedgerDelegation735433 === '1') return;
    board.dataset.ulimLedgerDelegation735433 = '1';

    board.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target.closest('[data-ledger-status],[data-ledger-detail],[data-ledger-add],[data-ledger-header],[data-ledger-gear],[data-ledger-add-class],[data-history-remove]') : null;
      if (!target || !board.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();

      if (target.hasAttribute('data-ledger-header')) {
        if (historicalOnly) return;
        var headerGroup = groupById735423(target.dataset.classId);
        var headerSession = headerGroup && (headerGroup.sessions || []).find(function (s) { return text(s.date) === text(target.dataset.date); });
        if (headerGroup && headerSession) scheduleOperationPrompt735423(headerGroup, headerSession);
        return;
      }

      if (target.hasAttribute('data-ledger-add-class')) {
        var addGroup = groupById735423(target.dataset.classId);
        var requestedDate = text(target.dataset.date);
        var addSession = addGroup && (addGroup.sessions || []).filter(function (s) { return (!requestedDate || text(s.date) === requestedDate) && s.state !== 'cancelled' && s.state !== 'moved'; })[0];
        if (!addSession && addGroup) addSession = (addGroup.sessions || []).filter(function (s) { return s.state !== 'cancelled' && s.state !== 'moved'; })[0];
        if (addGroup && addSession) openAttendanceAddModal735410({ date: addSession.date, month: text(target.dataset.month) || text(addSession.date).slice(0, 7), classId: addGroup.classId, className: addGroup.className, historicalOnly: historicalOnly === true });
        return;
      }

      var cellNode = target.closest('[data-ledger-cell]');
      var rowNode = target.closest('tr[data-ledger-student]');
      var classId = text((cellNode && cellNode.dataset.classId) || (rowNode && rowNode.dataset.sourceClass));
      var studentUid = text((cellNode && cellNode.dataset.studentUid) || (rowNode && rowNode.dataset.ledgerStudent));
      var group = groupById735423(classId);
      var student = group && studentByLedger735423(group, studentUid);

      if (target.hasAttribute('data-ledger-gear')) {
        if (historicalOnly) return;
        if (studentUid) openWholeClassStudentDetail7355016(studentUid);
        return;
      }
      if (target.hasAttribute('data-history-remove')) {
        if (historicalOnly && group && student) removePreviousMonthStudent735433(group, student);
        return;
      }
      if (!cellNode || !group || !student) return;
      var session = (group.sessions || []).find(function (s) { return text(s.date) === text(cellNode.dataset.date); });
      if (!session) return;
      if (target.hasAttribute('data-ledger-status')) {
        var desired = text(target.dataset.ledgerStatus);
        var currentCell = student.cells && student.cells[session.date] || {};
        saveLedgerCell735423(group, student, session, { status: cleanAttendanceStatus7355014(currentCell.status) === desired ? '미체크' : desired });
        return;
      }
      if (target.hasAttribute('data-ledger-detail')) {
        openLedgerDetail735423(group, student, session);
        return;
      }
      if (target.hasAttribute('data-ledger-add') && isFullAdmin()) {
        openAttendanceAddModal735410({ date: session.date, month: text(session.date).slice(0, 7), classId: group.classId, className: group.className });
      }
    }, true);

    board.addEventListener('change', function (event) {
      var note = event.target && event.target.closest ? event.target.closest('[data-ledger-note]') : null;
      if (note && board.contains(note)) {
        event.stopPropagation();
        var noteGroup = groupById735423(note.dataset.classId);
        var noteStudent = noteGroup && studentByLedger735423(noteGroup, note.dataset.studentUid);
        if (noteGroup && noteStudent) saveLedgerMonthNote735430(noteGroup, noteStudent, text(note.dataset.month), note.value, note);
        return;
      }
      var select = event.target && event.target.closest ? event.target.closest('[data-ledger-select]') : null;
      if (historicalOnly || !select || !board.contains(select)) return;
      event.stopPropagation();
      var row = select.closest('tr[data-ledger-student]');
      if (!row) return;
      var key = text(row.dataset.sourceClass) + '|' + text(row.dataset.ledgerStudent);
      if (select.checked) allClassesState735410.selectedCards.set(key, { classId: text(row.dataset.sourceClass), studentUid: text(row.dataset.ledgerStudent) });
      else allClassesState735410.selectedCards.delete(key);
      Array.from(row.querySelectorAll('[data-ledger-select]')).forEach(function (box) { if (box !== select) box.checked = select.checked; });
      var removeButton = document.getElementById('ulimAllClassesRemoveSelected735423');
      if (removeButton) removeButton.textContent = allClassesState735410.selectedCards.size ? '선택 학생 제거 (' + allClassesState735410.selectedCards.size + ')' : '선택 학생 제거';
    }, true);

    board.addEventListener('dragstart', function (event) {
      if (historicalOnly || !isFullAdmin()) return;
      var handle = event.target && event.target.closest ? event.target.closest('[data-ledger-drag]') : null;
      if (!handle) { event.preventDefault(); return; }
      var row = handle.closest('tr[data-ledger-student]');
      if (!row) { event.preventDefault(); return; }
      allClassesDragData735410 = { studentUid: text(row.dataset.ledgerStudent), sourceClassId: text(row.dataset.sourceClass) };
      try { if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', text(row.dataset.ledgerStudent)); } } catch (_ignoreDrag735427) {}
    });
    board.addEventListener('dragend', function () { allClassesDragData735410 = null; });
    board.addEventListener('dragover', function (event) {
      if (historicalOnly || !isFullAdmin()) return;
      var td = event.target && event.target.closest ? event.target.closest('[data-ledger-cell]') : null;
      if (!td) return;
      event.preventDefault();
      td.classList.add('drag-over');
    });
    board.addEventListener('dragleave', function (event) {
      var td = event.target && event.target.closest ? event.target.closest('[data-ledger-cell]') : null;
      if (td) td.classList.remove('drag-over');
    });
    board.addEventListener('drop', function (event) {
      if (historicalOnly) return;
      var td = event.target && event.target.closest ? event.target.closest('[data-ledger-cell]') : null;
      if (!td || !allClassesDragData735410) return;
      event.preventDefault();
      td.classList.remove('drag-over');
      applyAllClassesDrop735410(allClassesDragData735410, text(td.dataset.classId), text(td.dataset.date));
    });
  }
  async function openWholeClassStudentDetail7355016(studentUid) {
    if(!isFullAdmin())return alert('전체관리자 권한이 필요합니다.');
    try { var directory=allClassesState735410.directory||await loadDirectory(false); var student=(directory.students||[]).find(function(s){return text(s.studentUid)===text(studentUid);}); if(!student)return alert('학생정보를 찾지 못했습니다.'); detailRecordIndex=-1;detailCandidates=[student];detailStudent=student;ensureStyles();ensureLedgerStyles735425();var modal=ensureDetailModal();modal.classList.add('open');renderDetailStudent(student,directory,'전체반 학생정보입니다. 수정하면 학생명단과 출석부에 즉시 반영됩니다.'); } catch(error){alert(text(error&&error.message)||'학생정보를 열지 못했습니다.');}
  }
  async function applyAllClassesDrop735410(drag,targetClassId,targetDate) {
    if(!isFullAdmin()||allClassesState735410.actionInFlight)return;
    var directory=allClassesState735410.directory||await loadDirectory(false);
    var student=(directory.students||[]).find(function(s){return text(s.studentUid)===text(drag.studentUid);});
    var target=classById7355033(directory,targetClassId);
    if(!student||!target)return alert('학생 또는 반 정보를 찾지 못했습니다.');
    var mode=text(document.getElementById('ulimAllClassesMoveMode735423')&&document.getElementById('ulimAllClassesMoveMode735423').value)||'class_move';
    allClassesState735410.addContext={date:targetDate,month:text(targetDate).slice(0,7),classId:targetClassId,className:target.className};
    if(!confirm(student.name+' → '+target.className+'\n'+targetDate+' · '+attendanceAddModeLabel735410(mode)+' 처리할까요?'))return;
    try{
      allClassesState735410.actionInFlight=true;
      var historicalDrop735432=text(targetDate).slice(0,7)<today().slice(0,7);
      if(mode==='makeup'||mode==='daily_special'||(historicalDrop735432&&(mode==='new'||mode==='class_move'))){
        await call('addTemporaryAttendanceAdmin7355014',{studentUid:student.studentUid,studentName:student.name,kind:mode,date:targetDate,classId:target.classId,className:target.className,requestId:requestId(historicalDrop735432?'ledger-drop-historical-735432':'ledger-drop-temp-735430')});
      }else{
        await updateStudentClass735410(student,target,mode,drag.sourceClassId||'',(mode==='new'||mode==='class_move')?targetDate:'');
        if(mode==='new'||mode==='class_move') await call('addAttendanceSessionStudentsAdmin73550',{date:targetDate,classId:target.classId,studentUids:[student.studentUid],normalizeRegularMembership:true,requestId:requestId('ledger-drop-session-735434')});
      }
      directoryCache=null;directoryLoadedAt=0;await loadAllClassesData735410(true);
    }catch(error){alert(text(error&&error.message)||'학생 이동에 실패했습니다.');}
    finally{allClassesState735410.actionInFlight=false;}
  }

  async function removeSelectedAllClassStudents735413() {
    if(!isFullAdmin()||allClassesState735410.actionInFlight)return alert('전체관리자 권한이 필요합니다.');
    var selected=Array.from(allClassesState735410.selectedCards.values());
    if(!selected.length)return alert('제거할 학생을 먼저 체크해주세요.');
    if(!confirm('선택한 '+selected.length+'명의 학생을 해당 반에서 제거할까요?'))return;
    var directory=allClassesState735410.directory||await loadDirectory(false);
    try{
      allClassesState735410.actionInFlight=true;
      if(typeof global.showLoading==='function')global.showLoading('선택 학생을 제거하는 중...');
      for(var i=0;i<selected.length;i+=1){
        var item=selected[i];
        var student=(directory.students||[]).find(function(row){return text(row.studentUid)===text(item.studentUid);});
        var group=groupById735423(item.classId);
        if(!student||!group)continue;
        var currentIds=unique(student.selectedClassIds);
        var ledgerStudent=studentByLedger735423(group,item.studentUid);
        var hasCanonicalMembership735434=currentIds.indexOf(item.classId)>=0;
        var specialDates735434=[];
        if(ledgerStudent&&ledgerStudent.cells){
          for(var j=0;j<(group.sessions||[]).length;j+=1){
            var session=group.sessions[j];var cell=ledgerStudent.cells[session.date]||{};
            if(cell.eligible!==true)continue;
            var special=normalize(cell.specialStatus||cell.registrationType);
            var temporarySpecial735434=special===normalize('보강')||special===normalize('일일특강')||special==='makeup'||special==='daily_special';
            if(temporarySpecial735434) specialDates735434.push(session.date);
            else hasCanonicalMembership735434=true;
          }
        }
        if(hasCanonicalMembership735434){
          var nextIds=currentIds.filter(function(id){return id!==item.classId;});
          await call('updateStudentAdmin7352',{
            studentUid:student.studentUid,name:student.name,attendanceNo:student.attendanceNo,changeAttendanceNo:false,
            studentPhone:student.studentPhone,parentPhone:student.parentPhone,birthDate:student.birthDate||'',initialRegisteredDate:student.initialRegisteredDate,
            enrollmentStatus:student.enrollmentStatus,classIds:nextIds,originalClassIds:currentIds,replaceClassAssignments:true,registrationType:'existing',
            operationDate:'',memo:student.memo,privacyConsent:student.privacyConsent===true,portraitConsent:student.portraitConsent===true,
            preserveLegacyClassNames:unique(student.legacyUnmappedClassNames),requestId:requestId('ledger-remove-class-735434')
          });
          patchSharedStudentAfterClassUpdate735430(student,nextIds);
        }
        for(var specialIndex735434=0;specialIndex735434<specialDates735434.length;specialIndex735434+=1){
          await call('removeAttendanceStudentAdmin7355014',{date:specialDates735434[specialIndex735434],classId:group.classId,className:group.className,studentUid:item.studentUid,studentName:student.name,requestId:requestId('ledger-remove-temp-735434')});
        }
        if(!hasCanonicalMembership735434&&!specialDates735434.length)throw new Error(student.name+' 학생의 해당 반 소속 기록을 찾지 못했습니다.');
      }
      allClassesState735410.selectedCards.clear();directoryCache=null;directoryLoadedAt=0;await loadAllClassesData735410(true);
    }catch(error){alert(text(error&&error.message)||'학생 제거에 실패했습니다.');}
    finally{allClassesState735410.actionInFlight=false;if(typeof global.hideLoading==='function')global.hideLoading();}
  }
  async function saveWholeClassAttendance7355016() { return { status:'success', immediate:true }; }
  function syncAllClassesTeacherOptions735413() { renderTeacherTabs735423(); }
  function renderAllClassesBoard735410(force) { return loadAllClassesData735410(force===true); }
  async function loadAllClassesData735410(force, reason) {
    if (allClassesState735410.loadingPromise) return allClassesState735410.loadingPromise;
    var requestedForce735426 = force === true;
    var board = document.getElementById('ulimAllClassesBoard735410');
    if (board && !allClassesState735410.ledger) {
      board.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b">전월·현재월 출석부를 불러오는 중...</div>';
    }
    if (requestedForce735426) allClassesState735410.refreshAvailable = false;
    updateAllClassesRefreshButton735426(true);
    setAllClassesStatus735410(requestedForce735426 ? '최신 출석부를 갱신하는 중...' : '출석부를 불러오는 중...');

    allClassesState735410.loadingPromise = (async function () {
      try {
        // Every manual/open refresh performs a new Callable read. No timer/revision
        // event is allowed to repaint an open whole-class board automatically.
        var ledger = await call('getAttendanceRosterAdmin73550', {
          ledger: true,
          view: 'ledger',
          anchorDate: today(),
          force: requestedForce735426,
          refreshNonce: requestedForce735426 ? requestId('attendance-ledger-refresh-735426') : '',
          requestId: requestId('attendance-ledger-735426')
        });
        if (text(ledger && ledger.source) !== 'firestore_attendance_ledger_7355033') {
          throw new Error('최신 출석부 서버가 아직 반영되지 않았습니다.');
        }
        allClassesState735410.ledger = ledger;
        allClassesState735410.lastLoadedAt = Date.now();
        allClassesState735410.refreshAvailable = false;
        if (!isFullAdmin()) { var actor735434 = currentStaffIdentity735434(); allClassesState735410.teacher = actor735434.name || '__self__'; }
        renderAllClassesBoardLocal735410();
        updateAllClassesRefreshButton735426(false);

        // Directory supports edit/detail only. Attendance refresh never forces a
        // directory refetch, so the refresh button remains a fast attendance read.
        Promise.resolve(loadDirectory(false)).then(function (directory) {
          allClassesState735410.directory = directory;
          syncAllClassesTeacherOptions735413(directory);
        }).catch(function () {});

        return ledger;
      } catch (error) {
        setAllClassesStatus735410(text(error && error.message) || '전체 출석부를 불러오지 못했습니다.', true);
        throw error;
      } finally {
        allClassesState735410.loadingPromise = null;
        updateAllClassesRefreshButton735426(false);
      }
    })();
    return allClassesState735410.loadingPromise;
  }
  function openAllClassesModal735410() {
    if (!fullAdminOrTeacher7355033()) return alert('교직원 로그인이 필요합니다.');
    ensureLedgerStyles735425();
    var modal = ensureAllClassesModal735410();
    modal.style.display = 'block';
    modal.style.pointerEvents = 'auto';
    if (allClassesState735410.ledger && !allClassesState735410.refreshAvailable) {
      renderAllClassesBoardLocal735410();
      updateAllClassesRefreshButton735426(false);
    } else {
      loadAllClassesData735410(allClassesState735410.refreshAvailable === true, 'open-or-stale').catch(function () {});
    }
  }
  function invalidateWholeLedger7355049() {
    var modal = document.getElementById('ulimAllClassesAttendanceModal735410');
    if (modal && modal.style.display === 'block') {
      markAllClassesRefreshAvailable735426();
      return false;
    }
    allClassesState735410.ledger = null;
    allClassesState735410.lastLoadedAt = 0;
    allClassesState735410.refreshAvailable = false;
    return true;
  }
  function scheduleRealtimeAttendanceRefresh735423(detail) {
    if(allClassesState735410.actionInFlight)return;
    var revisionReason7355049 = normalize(detail && detail.reason);
    if (revisionReason7355049.indexOf('student_change') >= 0 || revisionReason7355049.indexOf('enrollment_change') >= 0 || revisionReason7355049.indexOf('course_application') >= 0) {
      attendanceAddDirectory735410 = null;
      directoryCache = null;
      directoryLoadedAt = 0;
      allClassesState735410.directory = null;
    }
    clearTimeout(allClassesState735410.reloadTimer);allClassesState735410.reloadTimer=setTimeout(function(){
      var modal=document.getElementById('ulimAllClassesAttendanceModal735410');
      if(modal&&modal.style.display==='block'){markAllClassesRefreshAvailable735426();return;}
      invalidateWholeLedger7355049();
      if(attendancePanelActive7355016()){
        if(attendanceDraftDirty7355014){attendanceRealtimePending735423=true;return;}
        var selected=text(document.getElementById('adminAttendanceClass')&&document.getElementById('adminAttendanceClass').value);if(selected&&selected!=='전체반'){attendanceRealtimePending735423=false;safeLoadAttendanceSnapshot(false);}
      }
    },120);
  }
  function flushAttendanceRealtimePending735423(){if(attendanceRealtimePending735423&&!attendanceDraftDirty7355014){attendanceRealtimePending735423=false;scheduleRealtimeAttendanceRefresh735423({scope:'pending'});}}
  if(!global.__ULIM_ATTENDANCE_REALTIME_EVENTS_735423__){global.__ULIM_ATTENDANCE_REALTIME_EVENTS_735423__=true;global.addEventListener('ulim-attendance-revision',function(event){scheduleRealtimeAttendanceRefresh735423(event&&event.detail||{});});}


  async function enterAttendancePanelToday735426() {
    var dateEl = document.getElementById('adminAttendanceDate');
    var dateValue = today();
    var previousDate = text(dateEl && dateEl.value);
    if (dateEl) dateEl.value = dateValue;
    if (previousDate && previousDate !== dateValue) {
      attendanceDraftDirty7355014 = false;
      try { if (typeof adminAttendanceRecords !== 'undefined') adminAttendanceRecords = []; } catch (_ignoreTodayRows735426) {}
      try { global.adminAttendanceRecords = []; } catch (_ignoreTodayGlobalRows735426) {}
      try { renderAttendanceOwned7355014(); } catch (_ignoreTodayRender735426) {}
    }
    await loadClassListFirebaseFirst(dateValue, false);
    var selected = text(document.getElementById('adminAttendanceClass') && document.getElementById('adminAttendanceClass').value);
    if (selected && selected !== '전체반') await safeLoadAttendanceSnapshot(false);
    return true;
  }

  // 7.35.4.24: restore the canonical attendance bindings that were accidentally
  // omitted from 7.35.4.23. No late wrapper is installed; these globals point
  // directly to this module's single-owner implementations.
  function installOverrides() {
    global.adminRenderAttendanceTable = renderAttendanceOwned7355014;
    try { adminRenderAttendanceTable = renderAttendanceOwned7355014; } catch (_ignore0) {}
    global.adminLoadAttendanceSnapshot = safeLoadAttendanceSnapshot;
    global.adminLoadClassList = loadClassListFirebaseFirst;
    global.ulimAttendanceRemoveRow73545 = removeAttendanceRow;
    global.ulimAttendanceOpenAddModal73545 = openAttendanceAddModal735410;
    global.ulimAttendanceOpenStudentDetail735410 = openStudentDetail;
    global.ulimGetAdminAttendanceRecord73545 = recordAt;
    global.ulimOpenAllClassesAttendance735410 = openAllClassesModal735410;
    global.ulimAttendanceOpenScheduleChange7355014 = openScheduleChangeModal7355014;
    global.ulimAttendanceRemoveSelected7355014 = removeSelectedAttendanceRows7355014;
    try { adminLoadAttendanceSnapshot = safeLoadAttendanceSnapshot; } catch (_ignore1) {}
    try { adminLoadClassList = loadClassListFirebaseFirst; } catch (_ignore2) {}
    try { ulimAttendanceRemoveRow73545 = removeAttendanceRow; } catch (_ignore3) {}
    try { ulimAttendanceOpenAddModal73545 = openAttendanceAddModal735410; } catch (_ignore4) {}

    global.ulimAttendanceOpenAllClasses735425 = openAllClassesModal735410;
    global.ulimAttendanceOpenAllClasses735424 = openAllClassesModal735410;
    global.ulimAttendanceOpenAllClasses735423 = openAllClassesModal735410;
    global.ulimAttendanceOpenAllClasses735420 = openAllClassesModal735410;
    global.ulimAttendanceOpenAllClasses735419 = openAllClassesModal735410;
    global.ulimAttendanceOpenAllClasses735418 = openAllClassesModal735410;
  }

  function preloadWholeClass735414() {
    if (!staffDashboardActive735414() || !fullAdminOrTeacher7355033() || allClassesState735410.directory) return;
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

  function attendancePanelActive7355016() {
    var panel = document.getElementById('adminPanelAttendance');
    return !!(panel && panel.classList.contains('active'));
  }

  function syncSharedDirectoryIntoAttendance7355027(reloadRoster) {
    var snapshot = global.__ULIM_STUDENT_DIRECTORY_7355016__ || null;
    if (!snapshot) return false;
    var directory = adoptSharedDirectory7355016(snapshot);
    allClassesState735410.directory = directory;
    // 7.35.5.0.27: the shared student directory owns student/detail data only.
    // Its recurring class catalog must never overwrite the date-effective attendance
    // class list because it cannot represent classScheduleChanges.
    if (reloadRoster === true && attendancePanelActive7355016()) {
      clearTimeout(studentRosterSyncTimer7355016);
      studentRosterSyncTimer7355016 = setTimeout(function () {
        var selected = text(document.getElementById('adminAttendanceClass') && document.getElementById('adminAttendanceClass').value);
        if (selected && selected !== '전체반') safeLoadAttendanceSnapshot(false);
      }, 80);
    }
    return true;
  }

  function reloadEffectiveAttendanceClasses7355027() {
    if (!attendancePanelActive7355016()) return;
    var dateValue = text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value) || today();
    Promise.resolve(loadClassListFirebaseFirst(dateValue, true)).catch(function () {});
  }

  function installStudentDirectoryEvents7355016() {
    if (global.__ULIM_ATTENDANCE_STUDENT_EVENTS_7355016__) return;
    global.__ULIM_ATTENDANCE_STUDENT_EVENTS_7355016__ = true;
    global.addEventListener('ulim-student-directory-updated', function () {
      syncSharedDirectoryIntoAttendance7355027(false);
      invalidateWholeLedger7355049();
    });
    global.addEventListener('ulim-class-catalog-updated', function () {
      syncSharedDirectoryIntoAttendance7355027(false);
      invalidateWholeLedger7355049();
      reloadEffectiveAttendanceClasses7355027();
    });
    global.addEventListener('ulim-student-roster-updated', function () {
      syncSharedDirectoryIntoAttendance7355027(true);
      invalidateWholeLedger7355049();
    });
  }


  function ensureLedgerStyles735425() {
    var legacyIds = ['ulim-attendance-ledger-style-735423','ulim-attendance-ledger-style-735426','ulim-attendance-ledger-style-735427','ulim-attendance-ledger-style-735428','ulim-attendance-ledger-style-735429'];
    legacyIds.forEach(function (id) { var node = document.getElementById(id); if (node) node.remove(); });
    if (document.getElementById('ulim-attendance-ledger-style-735430')) return;
    var style = document.createElement('style');
    style.id = 'ulim-attendance-ledger-style-735430';
    style.textContent = ''
      + '#ulimAllClassesAttendanceModal735410{display:none;position:fixed;inset:0;z-index:2147483000;background:#f1f5f9;overflow:auto;font-family:inherit;color:#0f172a;pointer-events:auto!important;overscroll-behavior:contain}'
      + '#ulimAllClassesAttendanceModal735410 *{box-sizing:border-box}'
      + '#ulimAllClassesAttendanceModal735410 button,#ulimAllClassesAttendanceModal735410 select,#ulimAllClassesAttendanceModal735410 input,#ulimAllClassesAttendanceModal735410 textarea{pointer-events:auto!important;touch-action:manipulation}'
      + '.ulim-ledger-shell735427{min-height:100%;background:#f8fafc}'
      + '.ulim-ledger-top735427{position:sticky;top:0;z-index:20;padding:10px 14px;border-bottom:1px solid #cbd5e1;background:rgba(255,255,255,.98);backdrop-filter:blur(8px)}'
      + '.ulim-ledger-top-row735427{display:flex;gap:12px;align-items:center;justify-content:space-between}.ulim-ledger-heading735427{min-width:170px}.ulim-ledger-heading735427 h3{margin:0;font-size:19px}.ulim-ledger-heading735427 div{font-size:11px;color:#64748b;margin-top:3px}'
      + '.ulim-ledger-top-actions735427{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.ulim-ledger-move-mode735427{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:900;color:#334155}.ulim-ledger-move-mode735427 select{padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}'
      + '.ulim-ledger-teacher-tabs735427{display:flex;gap:6px;overflow:auto;padding-top:8px;scrollbar-width:thin}.ulim-ledger-status735427{padding:8px 14px;font-size:11px;font-weight:800;color:#475569}.ulim-ledger-board735427{padding:0 14px 32px}'
      + '.ulim-ledger-class735423{margin:0 0 16px;background:#fff;border:1px solid #94a3b8;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08)}'
      + '.ulim-ledger-class-title735423{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:8px 11px;background:#eaf2ff;border-bottom:1px solid #94a3b8;color:#0f172a}.ulim-ledger-class-title735423 div{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.ulim-ledger-class-title735423 b{font-size:14px}.ulim-ledger-class-title735423 span{font-size:11px;font-weight:800;color:#475569}'
      + '.ulim-ledger-scroll735423{overflow-x:hidden;overflow-y:hidden;max-width:100%;background:#fff}.ulim-ledger-month-pair735427{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;width:100%;min-width:0}.ulim-ledger-month-card735427{min-width:0;width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}.ulim-ledger-month-card735427.current{border-left:3px solid #2563eb}'
      + '.ulim-ledger-table735423{border-collapse:collapse;border-spacing:0;width:100%;table-layout:fixed;font-size:12px}.ulim-ledger-table735423 th,.ulim-ledger-table735423 td{border:1px solid #cbd5e1;padding:5px 4px;text-align:center;background:#fff;min-width:92px;height:40px;vertical-align:middle}.ulim-ledger-table735423 thead th{background:#f8fafc;font-weight:900;color:#1e293b}'
      + '.ulim-ledger-table735423 tbody tr:nth-child(even) td{background:#fbfdff}.ulim-ledger-table735423 tbody tr:hover td{background:#f0f7ff}'
      + '.ulim-ledger-month735423{font-size:13px!important;min-height:42px!important}.ulim-ledger-month735423>b{display:block}.ulim-ledger-month-class735430{display:block!important;margin-top:3px!important;font-size:10px!important;color:#475569!important;font-weight:800!important}.ulim-ledger-month735423.prev{background:#eef2f7!important;color:#475569}.ulim-ledger-month735423.current{background:#dbeafe!important;color:#1e3a8a}'
      + '.ulim-ledger-no735427{min-width:52px!important;width:52px!important;background:#f8fafc!important}.ulim-ledger-no735427 input{margin:0 3px 0 0;vertical-align:middle}.ulim-ledger-no735427 span{vertical-align:middle}'
      + '.ulim-ledger-name735427{min-width:154px!important;width:154px!important;text-align:left!important;background:#fff!important;white-space:nowrap}.ulim-ledger-name735427 b{font-size:12px}.ulim-ledger-name735427 button{border:0;background:transparent;cursor:pointer;font-size:13px;padding:3px}.ulim-ledger-drag735423{display:inline-flex;align-items:center;justify-content:center;cursor:grab;color:#64748b;margin-right:4px;padding:3px 2px;user-select:none}.ulim-ledger-drag735423:active{cursor:grabbing}'
      + '.ulim-ledger-date735423{cursor:pointer;user-select:none;background:#f8fafc!important}.ulim-ledger-date735423:hover{background:#dbeafe!important}.ulim-ledger-date735423 b{display:block;font-size:12px}.ulim-ledger-date735423 small{display:block;margin-top:2px;color:#64748b}.ulim-ledger-date735423 span{display:block;margin-top:3px;color:#b45309;font-size:10px}'
      + '.ulim-ledger-note735423{min-width:140px!important;width:140px!important;max-width:180px}.ulim-ledger-note735423 input[data-ledger-note]{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:6px;padding:6px 7px;background:#fff;font-size:11px}.ulim-ledger-note735423 input[data-ledger-note]:focus{outline:2px solid #93c5fd;border-color:#60a5fa}.ulim-ledger-note735423 input[data-ledger-note].saving{opacity:.55}.ulim-ledger-note735423 input[data-ledger-note].saved{background:#dcfce7;border-color:#86efac}.ulim-ledger-empty-month735427{color:#94a3b8}'
      + '.ulim-ledger-cell-actions735423{display:flex;align-items:center;justify-content:center;gap:4px;min-height:28px}.ulim-ledger-cell-actions735423.saving{opacity:.55}.ulim-ledger-ox735423,.ulim-ledger-more735423{appearance:none;border:1px solid #94a3b8;border-radius:6px;background:#fff;padding:4px 8px;min-width:30px;min-height:28px;font-size:12px;font-weight:900;line-height:1;cursor:pointer}.ulim-ledger-ox735423:hover,.ulim-ledger-more735423:hover{background:#e2e8f0}.ulim-ledger-ox735423.on-o{background:#16a34a;color:#fff;border-color:#15803d}.ulim-ledger-ox735423.on-x{background:#dc2626;color:#fff;border-color:#b91c1c}.ulim-ledger-more735423{color:#334155}.ulim-ledger-special735423{margin-top:3px;font-size:10px;font-weight:900;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:5px;padding:2px 4px}.ulim-ledger-name735427.ulim-special-new-735430,.ulim-ledger-name735427.ulim-special-class-move-735430,.ulim-ledger-name735427.ulim-special-makeup-735430,.ulim-ledger-name735427.ulim-special-daily-special-735430{font-weight:900}.ulim-ledger-session-off735423{font-weight:900;color:#b91c1c;background:#fee2e2;border-radius:6px;padding:5px}.ulim-ledger-empty735423{appearance:none;border:1px dashed #94a3b8;background:#f8fafc;color:#475569;border-radius:6px;width:32px;height:28px;cursor:pointer;font-size:17px;line-height:1}.ulim-ledger-table735423 td.drag-over{outline:3px solid #22c55e;outline-offset:-3px;background:#f0fdf4!important}.ulim-ledger-add-row735423 button{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:7px;padding:5px 9px;font-weight:900;cursor:pointer}.ulim-ledger-empty-state735427{padding:30px;text-align:center;color:#64748b}'
      + '.ulim-ledger-teacher-tab735425{flex:0 0 auto;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:900;cursor:pointer}.ulim-ledger-teacher-tab735425.active{background:#2563eb;color:#fff;border-color:#2563eb}.ulim-ledger-teacher-tab735425:hover{border-color:#2563eb}'
      + '.ulim-ledger-action-modal735427{display:none;position:fixed;inset:0;z-index:2147483653;align-items:center;justify-content:center;background:rgba(15,23,42,.55);padding:16px}.ulim-ledger-action-sheet735427{width:min(620px,96vw);max-height:min(760px,92vh);overflow:auto;background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.28)}.ulim-ledger-action-head735427{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid #e2e8f0}.ulim-ledger-action-head735427>div{display:grid;gap:3px}.ulim-ledger-action-head735427 b{font-size:17px}.ulim-ledger-action-head735427 span{font-size:12px;color:#64748b}.ulim-ledger-action-head735427>button{border:0;background:#f1f5f9;border-radius:9px;width:36px;height:36px;font-size:22px;cursor:pointer}.ulim-ledger-action-body735427{padding:16px}.ulim-ledger-action-choice735427{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.ulim-ledger-action-choice735427 button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:12px 8px;font-weight:900;cursor:pointer}.ulim-ledger-action-choice735427 button.active{background:#2563eb;border-color:#2563eb;color:#fff}.ulim-ledger-action-fields735427{display:grid;gap:12px;margin-top:14px}.ulim-ledger-action-guide735427{padding:18px;border:1px dashed #cbd5e1;border-radius:10px;text-align:center;color:#64748b}.ulim-ledger-field735427{display:grid;gap:5px;font-size:12px;font-weight:900;color:#334155}.ulim-ledger-field735427 input,.ulim-ledger-field735427 select,.ulim-ledger-field735427 textarea{width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:10px;font:inherit;background:#fff}.ulim-ledger-date-time-grid735427{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:9px}.ulim-ledger-notify735427{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;font-size:12px;font-weight:800}.ulim-ledger-notify735427 input{width:auto}.ulim-ledger-inline-info735427{padding:9px 11px;background:#eff6ff;border-radius:9px;color:#1e40af;font-size:12px;font-weight:800}.ulim-ledger-action-warning735430{padding:10px 12px;border-radius:9px;background:#fff7ed;color:#9a3412;font-size:12px;font-weight:800;line-height:1.5}.ulim-ledger-action-foot735427{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #e2e8f0}'
      + '.ulim-att-add-dates-wrap735430{display:block;margin-top:12px;padding:11px;border:1px solid #dbeafe;border-radius:11px;background:#f8fbff}.ulim-att-add-dates-head735430{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:#334155}.ulim-att-add-dates-head735430 label{display:flex;align-items:center;gap:6px;font-weight:800}.ulim-att-add-dates735430{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:7px;margin-top:9px}.ulim-att-add-date-item735430{display:flex!important;align-items:center;gap:8px;border:1px solid #cbd5e1;border-radius:9px;padding:8px;background:#fff;cursor:pointer;font-size:12px!important}.ulim-att-add-date-item735430 input{width:auto!important;margin:0}.ulim-att-add-date-item735430 span{display:grid;gap:1px}.ulim-att-add-date-item735430 small{color:#64748b}.ulim-att-add-date-empty735430{padding:9px;color:#64748b;font-size:12px}'
      + '.ulim-ledger-context-tools735433{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex:1 0 100%;font-size:11px;color:#64748b}.ulim-ledger-context-tools735433 span{font-size:11px}.ulim-ledger-context-tools735433 button{border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:4px 8px;color:#334155;font-size:11px;font-weight:800;cursor:pointer}.ulim-ledger-context-tools735433 button:last-child{width:28px;padding:4px 0}.ulim-ledger-submodal735433{display:none;position:fixed;inset:0;z-index:2147483654;align-items:center;justify-content:center;background:rgba(15,23,42,.6);padding:16px}.ulim-ledger-submodal-card735433,.ulim-ledger-plan-card735433{width:min(1180px,97vw);max-height:94vh;display:flex;flex-direction:column;background:#f8fafc;border-radius:16px;overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,.35)}.ulim-ledger-plan-card735433{width:min(720px,96vw)}.ulim-ledger-submodal735433 header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;background:#fff;border-bottom:1px solid #e2e8f0}.ulim-ledger-submodal735433 header>div{display:grid;gap:3px}.ulim-ledger-submodal735433 header b{font-size:17px}.ulim-ledger-submodal735433 header small{font-size:11px;color:#64748b}.ulim-ledger-submodal735433 header>button{border:0;background:#f1f5f9;border-radius:9px;width:36px;height:36px;font-size:22px;cursor:pointer}.ulim-ledger-submodal735433 footer{display:flex;justify-content:flex-end;padding:10px 14px;background:#fff;border-top:1px solid #e2e8f0}#ulimPreviousMonthEditBoard735433{overflow:auto;padding:12px;min-height:0}#ulimPreviousMonthEditBoard735433 .ulim-ledger-month-card735427{width:100%}#ulimPreviousMonthEditBoard735433 [data-history-remove]{margin-left:5px;border:0;background:#fee2e2;color:#b91c1c;border-radius:6px;width:22px;height:22px;font-weight:900;cursor:pointer}.ulim-ledger-weekday-tabs735433{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:12px 14px;background:#fff;border-bottom:1px solid #e2e8f0}.ulim-ledger-weekday-tabs735433 button{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:9px 5px;font-weight:900;cursor:pointer}.ulim-ledger-weekday-tabs735433 button.active{background:#2563eb;color:#fff;border-color:#2563eb}.ulim-ledger-plan-body735433{padding:14px;overflow:auto}.ulim-ledger-plan-guide735433{padding:24px;text-align:center;color:#64748b}.ulim-ledger-plan-summary735433{display:flex;align-items:center;gap:12px;justify-content:space-between;margin-bottom:10px;padding:10px 12px;background:#eff6ff;border-radius:9px;color:#1e3a8a;font-size:12px}.ulim-ledger-plan-summary735433 label{display:flex;align-items:center;gap:5px}.ulim-ledger-plan-dates735433{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px}.ulim-ledger-plan-dates735433>label{display:flex;align-items:center;gap:8px;border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:10px;cursor:pointer}.ulim-ledger-plan-dates735433>label input{width:auto}.ulim-ledger-plan-dates735433>label span{display:grid;gap:2px}.ulim-ledger-plan-dates735433 small{color:#64748b}'
      + '@media(max-width:900px){#ulimAllClassesAttendanceModal735410{background:#f8fafc}.ulim-ledger-context-tools735433{justify-content:flex-start;flex-wrap:wrap}.ulim-ledger-context-tools735433 span{flex:1 0 100%}.ulim-ledger-submodal735433{align-items:flex-end;padding:0}.ulim-ledger-submodal-card735433,.ulim-ledger-plan-card735433{width:100%;max-height:92vh;border-radius:16px 16px 0 0}.ulim-ledger-weekday-tabs735433{grid-template-columns:repeat(4,1fr)}.ulim-ledger-top735427{padding:8px}.ulim-ledger-top-row735427{align-items:flex-start;display:grid;grid-template-columns:1fr}.ulim-ledger-heading735427 h3{font-size:17px}.ulim-ledger-top-actions735427{justify-content:flex-start;display:grid;grid-template-columns:1fr 1fr;gap:6px}.ulim-ledger-move-mode735427{grid-column:1/-1;justify-content:space-between}.ulim-ledger-top-actions735427 .admin-btn{width:100%;min-height:38px;padding:7px 9px}.ulim-ledger-teacher-tabs735427{padding-top:7px}.ulim-ledger-status735427{padding:7px 8px}.ulim-ledger-board735427{padding:0 8px 24px}.ulim-ledger-class735423{border-radius:8px;margin-bottom:12px}.ulim-ledger-class-title735423{align-items:flex-start}.ulim-ledger-scroll735423{overflow:visible}.ulim-ledger-month-pair735427{display:block;width:100%;min-width:0}.ulim-ledger-month-card735427{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border-bottom:1px solid #94a3b8}.ulim-ledger-month-card735427.current{border-left:0;border-top:3px solid #2563eb}.ulim-ledger-table735423{font-size:11px;width:max-content}.ulim-ledger-table735423 th,.ulim-ledger-table735423 td{min-width:78px;height:38px;padding:4px 3px}.ulim-ledger-no735427{position:static!important;min-width:46px!important;width:46px!important}.ulim-ledger-name735427{position:static!important;min-width:128px!important;width:128px!important}.ulim-ledger-note735423{min-width:110px!important;width:110px!important}.ulim-ledger-action-modal735427{align-items:flex-end;padding:0}.ulim-ledger-action-sheet735427{width:100%;max-height:90vh;border-radius:16px 16px 0 0}.ulim-ledger-action-choice735427{grid-template-columns:1fr}.ulim-ledger-action-choice735427 button{padding:11px}.ulim-ledger-date-time-grid735427{grid-template-columns:1fr 1fr}.ulim-ledger-date-time-grid735427 .ulim-ledger-field735427:first-child{grid-column:1/-1}.ulim-att-add-dates735430{grid-template-columns:1fr 1fr}}'
      + '@media(min-width:901px){.ulim-ledger-no735427,.ulim-ledger-name735427{position:static!important}}';
    document.head.appendChild(style);
  }
  function install() {
    global.__ULIM_ATTENDANCE_SINGLE_OWNER_7355016__ = 'attendance-admin-integrated-7.35.4.34';
    global.__ULIM_ATTENDANCE_SINGLE_OWNER_7355015__ = 'attendance-admin-integrated-7.35.4.34';
    global.__ULIM_ATTENDANCE_SINGLE_OWNER_7355014__ = 'attendance-admin-integrated-7.35.4.34';
    global.__ULIM_ATTENDANCE_NO_AUTO_REFRESH_7355016__ = true;
    global.__ULIM_ATTENDANCE_NO_AUTO_REFRESH_7355015__ = true;
    global.__ULIM_ATTENDANCE_NO_AUTO_REFRESH_7355014__ = true;
    global.__ULIM_WHOLE_CLASS_MANUAL_REFRESH_ONLY_735427__ = true;
    global.__ULIM_WHOLE_CLASS_MANUAL_REFRESH_ONLY_735426__ = true;
    global.__ULIM_WHOLE_CLASS_DUAL_MONTH_ROSTER_735427__ = true;
    global.__ULIM_WHOLE_CLASS_DESKTOP_DRAG_HANDLE_ONLY_735427__ = true;
    global.__ULIM_WHOLE_CLASS_SCHEDULE_ACTION_SHEET_735427__ = true;
    global.__ULIM_WHOLE_CLASS_PREVIOUS_MONTH_EDITOR_735433__ = true;
    global.__ULIM_WHOLE_CLASS_MONTHLY_WEEKDAY_PLAN_735433__ = true;
    global.__ULIM_ATTENDANCE_TODAY_ON_PANEL_ENTRY_735426__ = true;
    global.__ULIM_ATTENDANCE_RENDER_OWNER_7355016__ = true;
    global.__ULIM_ATTENDANCE_RENDER_OWNER_7355015__ = true;
    global.__ULIM_ATTENDANCE_RENDER_OWNER_7355014__ = true;
    global.__ULIM_ATTENDANCE_NO_MIXED_SOURCES_7355016__ = true;
    global.__ULIM_ATTENDANCE_NO_MIXED_SOURCES_7355015__ = true;
    ensureStyles();
    ensureLedgerStyles735425();
    ensureDetailModal();
    installOverrides();
    installStudentDirectoryEvents7355016();
    syncSharedDirectoryIntoAttendance7355027(false);
    bindContextEvents();
    installAttendanceToolbar7355014();
    scheduleWholeClassPreload735414(120);
    var panel = document.getElementById('adminPanelAttendance');
    if (panel && panel.classList.contains('active')) {
      // Explicit panel entry always rebinds the class selector to the current date.
      // The attendance class list is always the server-owned date-effective list.
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
      }, 30);
    }
  }, true);

  global.addEventListener('pageshow', function () { setTimeout(install, 30); });
  global.addEventListener('ulim-firebase-auth-ready', function () {
    setTimeout(function(){
      install();
      scheduleWholeClassPreload735414(80);
      var dateValue = text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value) || today();
      Promise.resolve(loadClassListFirebaseFirst(dateValue, false)).catch(function () {});
    }, 60);
  });

  global.__ULIM_ATTENDANCE_TABLE_INTERACTION_735427__ = true;
  global.__ULIM_ATTENDANCE_TABLE_INTERACTION_735426__ = true;
  global.__ULIM_ATTENDANCE_TABLE_INTERACTION_735425__ = true;

  global.ULIM_ATTENDANCE_ADMIN_API_735410 = {
    install: install,
    loadAttendance: safeLoadAttendanceSnapshot,
    loadClasses: loadClassListFirebaseFirst,
    enterToday: enterAttendancePanelToday735426,
    openStudentAdd: openAttendanceAddModal735410,
    openStudentDetail: openStudentDetail,
    openAllClasses: openAllClassesModal735410,
    removeSelectedAllClasses: removeSelectedAllClassStudents735413,
    removeSelectedAttendance: removeSelectedAttendanceRows7355014,
    openScheduleChange: openScheduleChangeModal7355014,
    openPreviousMonthEdit: openPreviousMonthEdit735433,
    openMonthlySessionPlan: openMonthlySessionPlan735433
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  setTimeout(install, 180);
})(typeof window !== 'undefined' ? window : globalThis);
