(function (global) {
  'use strict';

  if (global.__ULIM_STAFF_FIRESTORE_OPERATIONAL_73101__) return;
  global.__ULIM_STAFF_FIRESTORE_OPERATIONAL_73101__ = true;

  const VERSION = '2026-07-31.731.01';
  const CACHE_PREFIX = 'ulim_staff_fsop_7311_';
  const inflight = new Map();
  let runtimePromise = null;

  function safeConsole(level) {
    try {
      const args = Array.prototype.slice.call(arguments, 1);
      if (console && typeof console[level] === 'function') console[level].apply(console, args);
    } catch (ignore) {}
  }

  function text(value) { return String(value == null ? '' : value).trim(); }
  function localDateText() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function normalize(value) {
    return text(value).normalize('NFC').toLowerCase().replace(/\s+/g, '').replace(/[\[\](){}<>~～\-_/\\:·.,'"`]/g, '');
  }
  function token() {
    try { return text(typeof adminToken !== 'undefined' && adminToken || localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken')); }
    catch (ignore) { return ''; }
  }
  function info() {
    try {
      if (typeof adminInfo !== 'undefined' && adminInfo) return adminInfo;
      return JSON.parse(localStorage.getItem('adminInfo') || sessionStorage.getItem('adminInfo') || '{}') || {};
    } catch (ignore) { return {}; }
  }
  function owner() {
    const a = info();
    return text(a.principalUidV2 || a.firebaseAuthUid || a.accountUid || a.uid || a.id || a.name || token().slice(0, 24))
      .replace(/[^0-9A-Za-z가-힣_-]/g, '_').slice(0, 120) || 'NO_STAFF';
  }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (ignore) { return value; }
  }
  function readCache(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (!parsed || Date.now() - Number(parsed.savedAt || 0) > 24 * 60 * 60 * 1000) return null;
      return parsed.value;
    } catch (ignore) { return null; }
  }
  function writeCache(key, value) {
    try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value: clone(value) })); } catch (ignore) {}
  }

  async function runtime() {
    if (runtimePromise) return runtimePromise;
    runtimePromise = (async function () {
      const room = global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727;
      if (!room || typeof room.ensureAuthenticated !== 'function') throw new Error('Firebase 실시간 모듈을 찾지 못했습니다.');
      const rt = await room.ensureAuthenticated();
      if (!rt || !rt.sdk || !rt.functions) throw new Error('Firebase 교직원 인증을 완료하지 못했습니다.');
      if (!rt.staffOperational731) {
        rt.staffOperational731 = {
          getAttendance: rt.sdk.httpsCallable(rt.functions, 'getStaffAttendanceOperationalSnapshot'),
          saveAttendance: rt.sdk.httpsCallable(rt.functions, 'saveStaffAttendanceOperational'),
          getDaily: rt.sdk.httpsCallable(rt.functions, 'getStaffDailyEvaluationOperationalSnapshot'),
          saveDaily: rt.sdk.httpsCallable(rt.functions, 'saveStaffDailyEvaluationsOperational'),
          getSyncStatus: rt.sdk.httpsCallable(rt.functions, 'getStaffSheetSyncStatus'),
          refreshDate: rt.sdk.httpsCallable(rt.functions, 'refreshStaffOperationalDateFromSheets')
        };
      }
      return rt;
    })().catch(function (error) {
      runtimePromise = null;
      throw error;
    });
    return runtimePromise;
  }

  function callableData(result) { return result && result.data ? result.data : result || {}; }

  function isFullAdmin() {
    try {
      if (typeof adminIsFullAdmin === 'function') return !!adminIsFullAdmin();
    } catch (ignore) {}
    const role = normalize(info().role || '');
    return role === normalize('관리자') || role === normalize('전체관리자') || role === 'admin' || role === 'superadmin';
  }

  async function syncDateFromSheets(rt, date, reason, force) {
    return callableData(await rt.staffOperational731.refreshDate({
      date: text(date),
      reason: reason || 'manual_refresh',
      force: force === true
    }));
  }

  async function bootstrapDateOnce(rt, date, reason) {
    const key = 'ulim_staff_fsop_7311_bootstrap_' + owner() + '_' + text(date);
    try { if (sessionStorage.getItem(key)) return null; } catch (ignore) {}
    try { sessionStorage.setItem(key, '1'); } catch (ignore) {}
    try {
      return await syncDateFromSheets(rt, date, reason || 'empty_bootstrap', false);
    } catch (error) {
      try { sessionStorage.removeItem(key); } catch (ignore) {}
      throw error;
    }
  }

  function currentClassItem(className) {
    let list = [];
    try { list = Array.isArray(adminClassList) ? adminClassList : []; } catch (ignore) {}
    const target = normalize(className);
    return list.find(function (item) { return normalize(item && item.className) === target; }) || {};
  }

  function teacherNameFor(className, row) {
    const bracket = text(className).match(/\[\s*([^\]]+?)\s*T?\s*\]/i);
    if (bracket && bracket[1]) return bracket[1].replace(/T$/i, '').trim();
    const item = currentClassItem(className);
    return text(item.teacher || item.instructor || row && (row.instructor || row.instructorName) || '').replace(/T$/i, '').trim();
  }

  function teacherScope(className, row) {
    const name = teacherNameFor(className, row);
    return name ? 'name:' + normalize(name) : '';
  }

  function attendanceContext() {
    return {
      date: text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value) || localDateText(),
      className: text(document.getElementById('adminAttendanceClass') && document.getElementById('adminAttendanceClass').value),
      keyword: text(document.getElementById('adminAttendanceFilter') && document.getElementById('adminAttendanceFilter').value),
      statusFilter: text(document.getElementById('adminAttendanceStatusFilter') && document.getElementById('adminAttendanceStatusFilter').value)
    };
  }

  function dailyContext() {
    const className = text(document.getElementById('adminDailyEvalClass') && document.getElementById('adminDailyEvalClass').value);
    return {
      date: text(document.getElementById('adminDailyEvalDate') && document.getElementById('adminDailyEvalDate').value) || localDateText(),
      className: className,
      keyword: text(document.getElementById('adminDailyEvalFilter') && document.getElementById('adminDailyEvalFilter').value),
      teacherScopeKey: teacherScope(className)
    };
  }

  function cacheKey(kind, ctx) {
    return CACHE_PREFIX + kind + '_' + owner() + '_' + [ctx.date, ctx.className, ctx.keyword || '', ctx.statusFilter || '', ctx.teacherScopeKey || '']
      .map(function (v) { return normalize(v).slice(0, 120); }).join('__');
  }

  function renderAttendance(records, message) {
    try { adminAttendanceRecords = Array.isArray(records) ? records.map(clone) : []; } catch (ignore) {}
    try { if (typeof adminRenderAttendanceTable === 'function') adminRenderAttendanceTable(); } catch (ignore) {}
    const summary = document.getElementById('adminAttendanceSummary');
    if (summary) summary.textContent = message || ('Firestore 출석부 ' + ((records && records.length) || 0) + '건');
  }

  global.adminLoadAttendanceSnapshot = async function (showAlert, forceSheetSync) {
    if (!token()) return false;
    showAlert = showAlert !== false;
    forceSheetSync = forceSheetSync === true;
    const ctx = attendanceContext();
    const key = cacheKey('attendance', ctx);
    const cached = readCache(key);
    if (Array.isArray(cached)) renderAttendance(cached, forceSheetSync
      ? '최근 출석부를 표시했습니다. Google Sheets 원본을 확인 중입니다...'
      : '최근 Firestore 출석부를 먼저 표시했습니다.');

    const requestKey = 'attendance|' + key + '|' + (forceSheetSync ? 'sheet' : 'firestore');
    if (inflight.has(requestKey)) return inflight.get(requestKey);
    const promise = (async function () {
      let sheetSyncError = null;
      try {
        const rt = await runtime();
        if (forceSheetSync) {
          const summary = document.getElementById('adminAttendanceSummary');
          if (summary) summary.textContent = 'Google Sheets 원본 → Firestore 동기화 중...';
          try {
            await syncDateFromSheets(rt, ctx.date, 'attendance_button_refresh', true);
          } catch (error) {
            sheetSyncError = error;
            safeConsole('warn', '[ULIM 7.31.1 attendance sheet refresh]', error);
          }
        }

        let data = callableData(await rt.staffOperational731.getAttendance(ctx));
        let records = Array.isArray(data.records) ? data.records : [];
        if (!records.length && !forceSheetSync) {
          const summary = document.getElementById('adminAttendanceSummary');
          if (summary) summary.textContent = '오늘 출석부 최초 자동적재 중...';
          const refreshed = await bootstrapDateOnce(rt, ctx.date, 'attendance_empty_bootstrap');
          if (refreshed) {
            data = callableData(await rt.staffOperational731.getAttendance(ctx));
            records = Array.isArray(data.records) ? data.records : [];
          }
        }
        writeCache(key, records);
        const message = sheetSyncError
          ? ('시트 동기화 실패 · 기존 Firestore 출석부 ' + records.length + '건 표시')
          : (forceSheetSync ? ('시트 원본 동기화 완료 · 출석부 ' + records.length + '건') : (data.message || ('Firestore 출석부 ' + records.length + '건')));
        renderAttendance(records, message);
        if (sheetSyncError && showAlert) alert('Google Sheets 원본 동기화에 실패했습니다. 기존 Firestore 자료를 표시합니다.\n' + (sheetSyncError.message || String(sheetSyncError)));
        else if (showAlert && !records.length) alert('조건에 맞는 출석부 데이터가 없습니다. 날짜/반명/학생명을 확인해주세요.');
        return true;
      } catch (error) {
        safeConsole('warn', '[ULIM 7.31.1 attendance Firestore read]', error);
        if (!cached) {
          const summary = document.getElementById('adminAttendanceSummary');
          if (summary) summary.textContent = '출석부 조회 실패 · 네트워크 연결을 확인해주세요.';
          if (showAlert) alert(error.message || String(error));
        }
        return false;
      } finally { inflight.delete(requestKey); }
    })();
    inflight.set(requestKey, promise);
    return promise;
  };
  try { adminLoadAttendanceSnapshot = global.adminLoadAttendanceSnapshot; } catch (ignore) {}

  function attendanceMinimal(row) {
    const r = row || {};
    const ctx = attendanceContext();
    return {
      date: r.date || r.sessionDate || r.classDate || ctx.date,
      classDate: r.classDate || r.date || r.sessionDate || ctx.date,
      className: r.className || r.currentClass || ctx.className,
      currentClass: r.currentClass || r.className || ctx.className,
      classId: r.classId || '',
      teacherScopeKey: r.teacherScopeKey || teacherScope(r.className || ctx.className, r),
      teacherUid: r.teacherUid || '',
      instructor: r.instructor || r.instructorName || teacherNameFor(r.className || ctx.className, r),
      instructorName: r.instructorName || r.instructor || teacherNameFor(r.className || ctx.className, r),
      studentUid: r.studentUid || '',
      studentIdentityKey: r.studentIdentityKey || '',
      studentNo: r.studentNo || r.attendanceNo || '',
      attendanceNo: r.attendanceNo || r.studentNo || '',
      studentName: r.studentName || r.name || '',
      name: r.name || r.studentName || '',
      studentPhone: r.studentPhone || '',
      parentPhone: r.parentPhone || '',
      status: r.status || r.attendanceStatus || '',
      attendanceStatus: r.attendanceStatus || r.status || '',
      specialStatus: r.specialStatus || '',
      memo: r.memo || '',
      classroom: r.classroom || r.roomName || r.room || '',
      sourceSheet: r.sourceSheet || r.sheetName || '',
      sheetName: r.sheetName || r.sourceSheet || '',
      sourceCell: r.sourceCell || r.cellA1 || '',
      cellA1: r.cellA1 || r.sourceCell || '',
      rowNumber: r.rowNumber || r.row || 0,
      row: r.row || r.rowNumber || 0
    };
  }

  function setAttendanceState(records, label, isError) {
    let all = [];
    try { all = Array.isArray(adminAttendanceRecords) ? adminAttendanceRecords : []; } catch (ignore) {}
    (records || []).forEach(function (record) {
      const key = [record.date, record.className, record.studentIdentityKey || record.studentNo || record.studentName].map(normalize).join('|');
      const idx = all.findIndex(function (item) {
        return [item.date, item.className, item.studentIdentityKey || item.studentNo || item.studentName].map(normalize).join('|') === key;
      });
      if (idx >= 0 && typeof adminSetAttendanceSaveState_ === 'function') {
        try { adminSetAttendanceSaveState_(idx, label, !!isError); } catch (ignore) {}
      }
    });
  }

  async function pollSync(requestIdValue, kind, summaryEl) {
    const delays = [2500, 6000, 12000, 25000];
    for (let i = 0; i < delays.length; i++) {
      await new Promise(function (resolve) { setTimeout(resolve, delays[i]); });
      try {
        const rt = await runtime();
        const status = callableData(await rt.staffOperational731.getSyncStatus({ requestId: requestIdValue }));
        if (status.state === 'complete' || status.state === 'partial' || status.state === 'failed') {
          if (summaryEl) {
            summaryEl.textContent = status.state === 'complete'
              ? kind + ' Firestore 및 Google Sheets 백그라운드 저장 완료'
              : (status.message || (kind + ' Google Sheets 백그라운드 상태: ' + status.state));
          }
          return status;
        }
      } catch (error) { safeConsole('warn', '[ULIM 7.31 sync status]', error); }
    }
    return null;
  }

  async function saveAttendanceFirestore(records, silent) {
    if (!records || !records.length) return false;
    const compact = records.map(attendanceMinimal);
    setAttendanceState(compact, 'Firestore 저장중...', false);
    try {
      const rt = await runtime();
      const rid = requestId('ATT731');
      const data = callableData(await rt.staffOperational731.saveAttendance({
        requestId: rid,
        rows: compact,
        adminId: info().id || '',
        adminName: info().name || ''
      }));
      setAttendanceState(compact, '저장됨 · 시트전송중', false);
      const summary = document.getElementById('adminAttendanceSummary');
      if (summary) summary.textContent = data.message || ('출석 ' + compact.length + '건 Firestore 저장 완료 · 시트 백그라운드 전송 중');
      const ctx = attendanceContext();
      writeCache(cacheKey('attendance', ctx), typeof adminAttendanceRecords !== 'undefined' ? adminAttendanceRecords : compact);
      pollSync(rid, '출석', summary).catch(function () {});
      if (!silent) alert(data.message || '출석이 Firestore에 저장되었고 Google Sheets로 백그라운드 전송됩니다.');
      return true;
    } catch (error) {
      setAttendanceState(compact, '저장 실패', true);
      if (!silent) alert(error.message || String(error));
      return false;
    }
  }

  global.adminSaveAttendanceFromTable = async function (silent) {
    const records = typeof adminGetSelectedAttendanceRecords === 'function' ? adminGetSelectedAttendanceRecords() : [];
    if (!records.length) { alert('선택된 출석 데이터가 없습니다.'); return false; }
    return saveAttendanceFirestore(records, !!silent);
  };
  global.adminSaveAttendance = global.adminSaveAttendanceFromTable;
  global.adminSaveAttendanceRecords_ = saveAttendanceFirestore;
  try {
    adminSaveAttendanceFromTable = global.adminSaveAttendanceFromTable;
    adminSaveAttendance = global.adminSaveAttendance;
    adminSaveAttendanceRecords_ = global.adminSaveAttendanceRecords_;
  } catch (ignore) {}

  function studentMatchKey(row) {
    const r = row || {};
    if (text(r.studentUid)) return 'UID|' + text(r.studentUid);
    if (text(r.studentIdentityKey)) return 'KEY|' + text(r.studentIdentityKey);
    const phone = text(r.studentPhone).replace(/\D/g, '');
    if (phone.length >= 8) return 'PHONE|' + phone;
    if (text(r.studentNo || r.attendanceNo)) return 'NO|' + normalize(r.studentNo || r.attendanceNo);
    return 'NAME|' + normalize(r.studentName || r.name) + '|' + normalize(r.className);
  }

  function dailyRosterRow(row, ctx) {
    const r = row || {};
    return {
      date: r.date || r.sessionDate || ctx.date,
      className: r.className || ctx.className,
      classId: r.classId || '',
      teacherScopeKey: r.teacherScopeKey || ctx.teacherScopeKey,
      teacherUid: r.teacherUid || '',
      instructor: r.instructor || teacherNameFor(r.className || ctx.className, r),
      studentUid: r.studentUid || '',
      studentIdentityKey: r.studentIdentityKey || '',
      studentName: r.studentName || r.name || '',
      name: r.name || r.studentName || '',
      studentNo: r.studentNo || r.attendanceNo || '',
      studentPhone: r.studentPhone || '',
      parentPhone: r.parentPhone || '',
      attendanceStatus: r.attendanceStatus || r.status || '',
      specialStatus: r.specialStatus || '',
      memo: r.memo || '',
      videoLink: r.videoLink || (typeof adminGetVideoLinkForClassName_ === 'function' ? adminGetVideoLinkForClassName_(r.className || ctx.className) : ''),
      lessonContent: '', lessonAttitude: '', teacherComment: '', evaluation: ''
    };
  }

  function mergeDailyStrict(roster, savedRows, ctx) {
    const map = new Map();
    (savedRows || []).forEach(function (saved) { map.set(studentMatchKey(saved), saved); });
    const result = (roster || []).map(function (source) {
      const base = dailyRosterRow(source, ctx);
      const saved = map.get(studentMatchKey(base));
      return saved ? Object.assign({}, base, saved, {
        date: ctx.date,
        className: base.className,
        teacherScopeKey: ctx.teacherScopeKey,
        instructor: base.instructor || saved.instructor || teacherNameFor(ctx.className, saved)
      }) : base;
    });
    // 평가만 남아 있고 현재 출석 명단에서 빠진 학생은 누락시키지 않습니다.
    (savedRows || []).forEach(function (saved) {
      if (!result.some(function (row) { return studentMatchKey(row) === studentMatchKey(saved); })) {
        result.push(Object.assign(dailyRosterRow(saved, ctx), saved, { teacherScopeKey: ctx.teacherScopeKey }));
      }
    });
    return result;
  }

  function renderDaily(rows, message) {
    try { adminDailyEvalRows = Array.isArray(rows) ? rows.map(clone) : []; global.adminDailyEvalRows = adminDailyEvalRows; } catch (ignore) {}
    try {
      if (typeof adminRenderDailyEvalRows === 'function') adminRenderDailyEvalRows(message || ('Firestore 일일평가 ' + rows.length + '건'));
      else if (typeof adminRenderDailyEvalTable === 'function') adminRenderDailyEvalTable();
    } catch (ignore) {}
  }

  global.adminLoadDailyEvalStudents = async function (forceSheetSync) {
    forceSheetSync = forceSheetSync === true;
    if (!token()) return alert('관리자 로그인이 필요합니다.');
    const ctx = dailyContext();
    if (!ctx.className && !ctx.keyword) return alert('반명 또는 학생명을 입력하거나 반 목록에서 선택해주세요.');
    if (ctx.className && ctx.className !== '전체반' && !ctx.teacherScopeKey) return alert('선택한 반의 담당강사를 확인하지 못했습니다. 반 목록에서 다시 선택해주세요.');
    const key = cacheKey('daily', ctx);
    const cached = readCache(key);
    if (cached && Array.isArray(cached.rows)) renderDaily(cached.rows, forceSheetSync
      ? '최근 학생 명단을 표시했습니다. Google Sheets 원본을 확인 중입니다...'
      : '최근 Firestore 일일평가를 먼저 표시했습니다.');
    let sheetSyncError = null;
    try {
      const rt = await runtime();
      if (forceSheetSync) {
        renderDaily(cached && Array.isArray(cached.rows) ? cached.rows : [], 'Google Sheets 원본 → Firestore 동기화 중...');
        try {
          await syncDateFromSheets(rt, ctx.date, 'daily_roster_button_refresh', true);
        } catch (error) {
          sheetSyncError = error;
          safeConsole('warn', '[ULIM 7.31.1 daily sheet refresh]', error);
        }
      }

      let data = callableData(await rt.staffOperational731.getDaily(ctx));
      let roster = Array.isArray(data.roster) ? data.roster : [];
      let savedRows = Array.isArray(data.rows) ? data.rows : [];
      if (!roster.length && !savedRows.length && !forceSheetSync) {
        renderDaily([], '오늘 학생 명단 최초 자동적재 중...');
        const refreshed = await bootstrapDateOnce(rt, ctx.date, 'daily_empty_bootstrap');
        if (refreshed) {
          data = callableData(await rt.staffOperational731.getDaily(ctx));
          roster = Array.isArray(data.roster) ? data.roster : [];
          savedRows = Array.isArray(data.rows) ? data.rows : [];
        }
      }
      const rows = mergeDailyStrict(roster, savedRows, ctx);
      writeCache(key, { rows: rows });
      const message = sheetSyncError
        ? ('시트 동기화 실패 · 기존 Firestore 학생 ' + rows.length + '명 표시')
        : (forceSheetSync ? ('시트 원본 동기화 완료 · 학생 ' + rows.length + '명') : (data.message || ('Firestore 학생 ' + rows.length + '명')));
      renderDaily(rows, message);
      if (sheetSyncError) alert('Google Sheets 원본 동기화에 실패했습니다. 기존 Firestore 자료를 표시합니다.\n' + (sheetSyncError.message || String(sheetSyncError)));
      return true;
    } catch (error) {
      safeConsole('warn', '[ULIM 7.31.1 daily Firestore read]', error);
      if (!cached) alert(error.message || String(error));
      return false;
    }
  };
  try { adminLoadDailyEvalStudents = global.adminLoadDailyEvalStudents; } catch (ignore) {}

  function compactDaily(row, ctx) {
    const r = row || {};
    return {
      date: r.date || ctx.date,
      className: r.className || ctx.className,
      classId: r.classId || '',
      teacherScopeKey: r.teacherScopeKey || ctx.teacherScopeKey,
      teacherUid: r.teacherUid || '',
      instructor: r.instructor || teacherNameFor(r.className || ctx.className, r),
      studentUid: r.studentUid || '',
      studentIdentityKey: r.studentIdentityKey || '',
      studentName: r.studentName || r.name || '',
      name: r.name || r.studentName || '',
      studentNo: r.studentNo || r.attendanceNo || '',
      studentPhone: r.studentPhone || '',
      parentPhone: r.parentPhone || '',
      attendanceStatus: r.attendanceStatus || r.status || '',
      specialStatus: r.specialStatus || '',
      memo: r.memo || '',
      lessonContent: r.lessonContent || '',
      lessonAttitude: r.lessonAttitude || '',
      teacherComment: r.teacherComment || '',
      videoLink: r.videoLink || '',
      evaluation: r.evaluation || ''
    };
  }

  global.adminSaveDailyEvaluations = async function (sendSms) {
    sendSms = !!sendSms;
    if (sendSms && typeof adminIsFullAdmin === 'function' && !adminIsFullAdmin()) return alert('발송은 관리자 권한에서만 가능합니다.');
    const rows = typeof adminGetSelectedDailyRows === 'function' ? adminGetSelectedDailyRows() : [];
    const recipientTypes = typeof adminGetRecipientTypes === 'function' ? adminGetRecipientTypes('daily') : [];
    if (!rows.length) return alert('저장할 일일평가 내용이 없습니다.');
    if (sendSms && !recipientTypes.length) return alert('수신 대상을 선택해주세요.');
    const ctx = dailyContext();
    if (!ctx.teacherScopeKey) return alert('담당강사 범위를 확인하지 못했습니다. 반 목록에서 다시 선택해주세요.');
    const sendChannel = typeof adminGetSendChannel === 'function' ? adminGetSendChannel('daily') : 'alimtalk';
    const channelLabel = typeof adminGetSendChannelLabel === 'function' ? adminGetSendChannelLabel(sendChannel) : sendChannel;
    if (sendSms && !confirm('일일평가를 Firestore에 저장하고 Google Sheets 반영 후 [' + recipientTypes.join(', ') + ']에게 ' + channelLabel + '으로 발송할까요?')) return false;
    const compact = rows.map(function (row) { return compactDaily(row, ctx); });
    const statusEl = document.getElementById('adminDailyDraftStatus');
    if (statusEl) statusEl.textContent = 'Firestore 저장 중...';
    try {
      const rt = await runtime();
      const rid = requestId('DEV731');
      const data = callableData(await rt.staffOperational731.saveDaily({
        requestId: rid,
        rows: compact,
        sendSms: sendSms,
        sendChannel: sendChannel,
        recipientTypes: recipientTypes,
        adminId: info().id || '',
        adminName: info().name || ''
      }));
      const savedMap = new Map(compact.map(function (row) { return [studentMatchKey(row), row]; }));
      try {
        adminDailyEvalRows = (adminDailyEvalRows || []).map(function (row) {
          const saved = savedMap.get(studentMatchKey(row));
          return saved ? Object.assign({}, row, saved, { savedAt: '방금 Firestore 저장', savedBy: info().name || info().id || '' }) : row;
        });
        global.adminDailyEvalRows = adminDailyEvalRows;
      } catch (ignore) {}
      renderDaily(adminDailyEvalRows || compact, 'Firestore 저장 완료 · Google Sheets 백그라운드 전송 중');
      writeCache(cacheKey('daily', ctx), { rows: adminDailyEvalRows || compact });
      if (statusEl) statusEl.textContent = data.message || 'Firestore 저장 완료 · 시트 백그라운드 전송 중';
      pollSync(rid, '일일평가', statusEl).catch(function () {});
      alert(sendSms
        ? '일일평가가 Firestore에 저장되었습니다. Google Sheets 반영 후 발송도 백그라운드에서 처리됩니다.'
        : '일일평가가 Firestore에 저장되었습니다. Google Sheets는 백그라운드에서 반영됩니다.');
      try {
        const draftKey = typeof global.ulimGetDailyEvalLocalDraftKey704_ === 'function' ? global.ulimGetDailyEvalLocalDraftKey704_() : '';
        if (draftKey) localStorage.removeItem(draftKey);
      } catch (ignore) {}
      return true;
    } catch (error) {
      if (statusEl) statusEl.textContent = 'Firestore 저장 실패 · 로컬 입력 유지';
      alert(error.message || String(error));
      return false;
    }
  };
  try { adminSaveDailyEvaluations = global.adminSaveDailyEvaluations; } catch (ignore) {}

  // 7.04의 1분 후 시트 직접 자동저장은 중단합니다. 명시적 평가저장만 Firestore job을 만듭니다.
  global.ulimScheduleDailyEvalSheetSync704_ = function () {
    const statusEl = document.getElementById('adminDailyDraftStatus');
    if (statusEl) statusEl.textContent = '로컬 임시저장 완료 · 평가저장 시 Firestore에 즉시 반영';
    return false;
  };
  global.__ULIM_DAILY_AUTOSAVE_SHEET_MODE_704__ = 'FIRESTORE_EXPLICIT_SAVE_ONLY_731';

  global.ulimRefreshStaffOperationalDateFromSheets731 = async function (date, reason, force) {
    const target = text(date || attendanceContext().date || localDateText());
    const rt = await runtime();
    return syncDateFromSheets(rt, target, reason || 'manual_refresh', force !== false);
  };

  let autoBootstrapStarted = false;
  let legacyWarmupSent = false;
  async function autoBootstrapTodayIfNeeded() {
    if (autoBootstrapStarted || !token()) return false;
    autoBootstrapStarted = true;
    try {
      const rt = await runtime();
      const date = localDateText();
      const data = callableData(await rt.staffOperational731.getAttendance({
        date: date,
        className: '',
        keyword: '',
        statusFilter: ''
      }));
      const records = Array.isArray(data.records) ? data.records : [];
      if (!records.length) await bootstrapDateOnce(rt, date, 'login_empty_bootstrap');
      return true;
    } catch (error) {
      autoBootstrapStarted = false;
      safeConsole('warn', '[ULIM 7.31.1 login auto bootstrap]', error);
      return false;
    }
  }

  function prewarm() {
    // 로그인 전에는 Apps Script 런타임만 가볍게 깨워 콜드 스타트를 줄입니다.
    if (!token()) {
      if (!legacyWarmupSent) {
        legacyWarmupSent = true;
        try {
          const url = typeof GET_API_URL !== 'undefined' ? String(GET_API_URL || '') : '';
          if (url) fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=ulimWarmup731&_=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(function () {});
        } catch (ignore) {}
      }
      return;
    }
    runtime().then(function () { autoBootstrapTodayIfNeeded().catch(function () {}); })
      .catch(function (error) { safeConsole('warn', '[ULIM 7.31.1 Firebase prewarm]', error); });
  }
  function retryPrewarm(attempt) {
    prewarm();
    if (!token() && attempt < 120) setTimeout(function () { retryPrewarm(attempt + 1); }, 750);
  }
  setTimeout(function () { retryPrewarm(0); }, 0);
  global.addEventListener('online', prewarm);
  global.addEventListener('pageshow', function () { setTimeout(prewarm, 100); });

  const style = document.createElement('style');
  style.id = 'ulim-staff-firestore-operational-7311-style';
  style.textContent = '.ulim-firestore-sync-note-731{font-size:11px;font-weight:800;color:#047857}';
  document.head.appendChild(style);

  safeConsole('info', '[ULIM staff Firestore operational]', VERSION);
})(typeof window !== 'undefined' ? window : globalThis);
