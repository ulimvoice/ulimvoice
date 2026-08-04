(function (global) {
  'use strict';
  if (global.__ULIM_FIRESTORE_ONLY_ADMIN_73549__) return;
  global.__ULIM_FIRESTORE_ONLY_ADMIN_73549__ = true;
  global.ULIM_FIRESTORE_ONLY_ADMIN_VERSION = '2026-08-04.735.04.9';

  function text(value) { return String(value == null ? '' : value).trim(); }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }
  async function runtime() {
    var room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('울림앱 저장 기능을 준비하지 못했습니다.');
    var rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('교직원 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'firestore-only-admin-73549');
    else await rt.sdk.getIdToken(rt.auth.currentUser, false);
    return rt;
  }
  async function call(name, payload) {
    var rt = await runtime();
    var fn = rt.sdk.httpsCallable(rt.functions, name);
    var response = await fn(payload || {});
    return response && response.data || {};
  }
  function showLoading(message) { try { if (typeof global.showLoading === 'function') global.showLoading(message); } catch (_ignore) {} }
  function hideLoading() { try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {} }
  function today() {
    var d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  function attendanceRowsFromArgument(rows) {
    return (Array.isArray(rows) ? rows : []).map(function (row) {
      var value = Object.assign({}, row || {});
      value.date = text(value.date || value.sessionDate || (document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value)) || today();
      value.className = text(value.className || (document.getElementById('adminAttendanceClass') && document.getElementById('adminAttendanceClass').value));
      value.studentName = text(value.studentName || value.name);
      value.studentUid = text(value.studentUid);
      value.studentIdentityKey = text(value.studentIdentityKey || value.studentKey);
      value.studentNo = text(value.studentNo || value.attendanceNo);
      value.status = text(value.status || value.attendanceStatus) || '미체크';
      value.attendanceStatus = value.status;
      value.currentStatus = text(value.currentStatus || value.remarkText || value.sheetRemark);
      value.memo = text(value.memo);
      return value;
    }).filter(function (row) { return row.date && row.className && row.studentName; });
  }

  async function saveAttendanceRecordsFirestore73549(records, silent) {
    var rows = attendanceRowsFromArgument(records);
    if (!rows.length) {
      if (!silent) alert('저장할 출석 상태가 없습니다.');
      return false;
    }
    try {
      showLoading(rows.length === 1 ? '출석부 저장 중...' : '선택한 ' + rows.length + '명 출석부 저장 중...');
      var result = await call('saveStaffAttendanceOperational', {
        requestId: requestId('attendance-save-73549'),
        rows: rows
      });
      var summary = document.getElementById('adminAttendanceSummary');
      if (summary) summary.textContent = text(result.message) || ('울림앱 출석부 저장 완료: ' + rows.length + '건');
      if (!silent) alert(text(result.message) || ('출석부 ' + rows.length + '건을 저장했습니다.'));
      return true;
    } catch (error) {
      if (!silent) alert(text(error && error.message) || '출석부를 저장하지 못했습니다.');
      throw error;
    } finally { hideLoading(); }
  }

  async function saveAttendanceFromTable73549(silent) {
    var rows = typeof global.adminGetSelectedAttendanceRecords === 'function'
      ? global.adminGetSelectedAttendanceRecords()
      : (typeof adminGetSelectedAttendanceRecords === 'function' ? adminGetSelectedAttendanceRecords() : []);
    if (!rows || !rows.length) {
      if (!silent) alert('선택된 출석 데이터가 없습니다.');
      return false;
    }
    return saveAttendanceRecordsFirestore73549(rows, silent === true);
  }

  function dailyContext73549() {
    return {
      date: text(document.getElementById('adminDailyEvalDate') && document.getElementById('adminDailyEvalDate').value) || today(),
      className: text(document.getElementById('adminDailyEvalClass') && document.getElementById('adminDailyEvalClass').value),
      keyword: text(document.getElementById('adminDailyEvalFilter') && document.getElementById('adminDailyEvalFilter').value)
    };
  }
  function dailyKey73549(row) {
    if (typeof global.adminDailyEvalExactKey === 'function') return global.adminDailyEvalExactKey(row || {});
    try { if (typeof adminDailyEvalExactKey === 'function') return adminDailyEvalExactKey(row || {}); } catch (_ignore) {}
    var value = row || {};
    return [text(value.studentUid || value.studentIdentityKey || value.studentNo), text(value.classId || value.className), text(value.studentName || value.name)].join('|');
  }
  function assignDailyRows73549(rows) {
    try { adminDailyEvalRows = rows; } catch (_ignore) {}
    global.adminDailyEvalRows = rows;
  }
  function renderDaily73549(message) {
    try {
      if (typeof global.adminRenderDailyEvalRows === 'function') global.adminRenderDailyEvalRows(message || '');
      else if (typeof adminRenderDailyEvalRows === 'function') adminRenderDailyEvalRows(message || '');
    } catch (_ignore) {}
  }

  async function loadDailyEvaluationsFirestore73549(showAlert) {
    var context = dailyContext73549();
    if (!context.className) {
      assignDailyRows73549([]);
      renderDaily73549('반을 선택해주세요.');
      return { status: 'empty-class' };
    }
    try {
      showLoading('일일평가 학생목록 불러오는 중...');
      var data = await call('getStaffDailyEvaluationOperationalSnapshot', {
        date: context.date,
        className: context.className,
        keyword: context.keyword,
        requestId: requestId('daily-list-73549')
      });
      var roster = Array.isArray(data.roster) ? data.roster : [];
      var saved = Array.isArray(data.rows) ? data.rows : [];
      var savedMap = new Map(saved.map(function (row) { return [dailyKey73549(row), row]; }));
      var merged = roster.map(function (row) {
        var prior = savedMap.get(dailyKey73549(row)) || {};
        return Object.assign({}, row, prior, {
          date: context.date,
          className: text(prior.className || row.className || context.className),
          studentName: text(prior.studentName || row.studentName || row.name),
          name: text(prior.studentName || row.studentName || row.name)
        });
      });
      saved.forEach(function (row) {
        if (!merged.some(function (item) { return dailyKey73549(item) === dailyKey73549(row); })) merged.push(row);
      });
      assignDailyRows73549(merged);
      renderDaily73549(text(data.message) || ('울림앱 학생 ' + merged.length + '명'));
      if (showAlert !== false && !merged.length) alert('조건에 맞는 학생이 없습니다. 날짜와 반을 확인해주세요.');
      return data;
    } catch (error) {
      assignDailyRows73549([]);
      renderDaily73549('일일평가 학생목록을 불러오지 못했습니다.');
      if (showAlert !== false) alert(text(error && error.message) || '일일평가 학생목록을 불러오지 못했습니다.');
      return { status: 'error', message: text(error && error.message) };
    } finally { hideLoading(); }
  }

  function selectedDailyRows73549() {
    try {
      if (typeof global.adminGetSelectedDailyRows === 'function') return global.adminGetSelectedDailyRows();
      if (typeof adminGetSelectedDailyRows === 'function') return adminGetSelectedDailyRows();
    } catch (_ignore) {}
    return [];
  }
  function recipientTypes73549() {
    var raw = [];
    try {
      raw = typeof global.adminGetRecipientTypes === 'function' ? global.adminGetRecipientTypes('daily') : adminGetRecipientTypes('daily');
    } catch (_ignore) {}
    var map = { '학생': 'student', '학부모': 'parent', '담당강사': 'teacher', '강사': 'teacher', '관리자': 'admin' };
    return Array.from(new Set((raw || []).map(function (value) { return map[text(value)] || text(value); }).filter(Boolean)));
  }
  function sendChannel73549() {
    try {
      return typeof global.adminGetSendChannel === 'function' ? global.adminGetSendChannel('daily') : adminGetSendChannel('daily');
    } catch (_ignore) { return 'alimtalk'; }
  }

  async function saveDailyEvaluationsFirestore73549(sendRequested) {
    var rows = selectedDailyRows73549();
    if (!rows.length) return alert('저장할 일일평가 내용이 없습니다.');
    var recipients = recipientTypes73549();
    var channel = sendChannel73549();
    if (sendRequested && !recipients.length) return alert('수신 대상을 선택해주세요.');
    if (sendRequested && !confirm('일일평가를 울림앱에 저장하고 선택한 대상에게 발송할까요?')) return;
    var compact = rows.map(function (row) {
      return {
        date: text(row.date || row.sessionDate),
        classId: text(row.classId),
        className: text(row.className),
        teacherUid: text(row.teacherUid),
        teacherScopeKey: text(row.teacherScopeKey),
        instructor: text(row.instructor || row.instructorName),
        studentUid: text(row.studentUid),
        studentIdentityKey: text(row.studentIdentityKey || row.studentKey),
        studentName: text(row.studentName || row.name),
        studentNo: text(row.studentNo || row.attendanceNo),
        studentPhone: text(row.studentPhone),
        parentPhone: text(row.parentPhone),
        attendanceStatus: text(row.attendanceStatus || row.status),
        specialStatus: text(row.specialStatus),
        memo: text(row.memo),
        lessonContent: text(row.lessonContent),
        lessonAttitude: text(row.lessonAttitude),
        teacherComment: text(row.teacherComment),
        videoLink: text(row.videoLink),
        evaluation: text(row.evaluation)
      };
    });
    try {
      showLoading(sendRequested ? '일일평가 저장 및 발송 요청 중...' : '일일평가 저장 중...');
      var result = await call('saveStaffDailyEvaluationsOperational', {
        requestId: requestId('daily-save-73549'),
        rows: compact,
        sendSms: sendRequested === true,
        sendChannel: channel,
        recipientTypes: recipients
      });
      var nowName = text((global.adminInfo || {}).name || (global.adminInfo || {}).id);
      var current = [];
      try { current = Array.isArray(adminDailyEvalRows) ? adminDailyEvalRows : []; } catch (_ignore) { current = Array.isArray(global.adminDailyEvalRows) ? global.adminDailyEvalRows : []; }
      var savedMap = new Map(compact.map(function (row) { return [dailyKey73549(row), row]; }));
      var next = current.map(function (row) {
        var saved = savedMap.get(dailyKey73549(row));
        return saved ? Object.assign({}, row, saved, { savedAt: '방금 저장', savedBy: nowName }) : row;
      });
      assignDailyRows73549(next);
      renderDaily73549('울림앱에 저장했습니다.');
      alert(text(result.message) || '일일평가를 저장했습니다.');
      return true;
    } catch (error) {
      alert(text(error && error.message) || '일일평가를 저장하지 못했습니다.');
      return false;
    } finally { hideLoading(); }
  }

  function disableSheetAutoSync73549() {
    global.__ULIM_DAILY_AUTOSAVE_SHEET_MODE_704__ = 'DISABLED_FIRESTORE_ONLY_73549';
    global.ulimScheduleDailyEvalSheetSync704_ = function () {
      var status = document.getElementById('adminDailyDraftStatus');
      if (status) status.textContent = '로컬 임시저장 완료 · 울림앱 저장 버튼을 누르면 반영됩니다.';
      return false;
    };
  }

  function install73549() {
    global.adminSaveAttendanceRecords_ = saveAttendanceRecordsFirestore73549;
    global.adminSaveAttendanceFromTable = saveAttendanceFromTable73549;
    global.adminSaveAttendance = saveAttendanceFromTable73549;
    global.adminLoadDailyEvalStudents = loadDailyEvaluationsFirestore73549;
    global.adminSaveDailyEvaluations = saveDailyEvaluationsFirestore73549;
    try { adminSaveAttendanceRecords_ = saveAttendanceRecordsFirestore73549; } catch (_ignore1) {}
    try { adminSaveAttendanceFromTable = saveAttendanceFromTable73549; } catch (_ignore2) {}
    try { adminSaveAttendance = saveAttendanceFromTable73549; } catch (_ignore3) {}
    try { adminLoadDailyEvalStudents = loadDailyEvaluationsFirestore73549; } catch (_ignore4) {}
    try { adminSaveDailyEvaluations = saveDailyEvaluationsFirestore73549; } catch (_ignore5) {}
    disableSheetAutoSync73549();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install73549, { once: true });
  else install73549();
  setTimeout(install73549, 250);
  setTimeout(install73549, 1200);
})(typeof window !== 'undefined' ? window : globalThis);
