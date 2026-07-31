(function (global) {
  'use strict';

  if (global.__ULIM_STAFF_FIRESTORE_OPERATIONAL_73108__) return;
  global.__ULIM_STAFF_FIRESTORE_OPERATIONAL_73108__ = true;

  const VERSION = '2026-07-31.731.08';
  const CACHE_PREFIX = 'ulim_staff_fsop_7318_';
  const inflight = new Map();
  let runtimePromise = null;
  const revisionListeners7318 = {
    attendance: { date: '', unsubscribe: null, initialized: false, lastRevision: 0, reloadTimer: null },
    daily: { date: '', unsubscribe: null, initialized: false, lastRevision: 0, reloadTimer: null }
  };

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
  function classCoreKey(value) {
    let raw = text(value);
    raw = raw.replace(/^\s*\[\s*[^\]]+?\s*\]\s*[-–—:]?\s*/i, '');
    raw = raw.replace(/^\s*[가-힣A-Za-z0-9_]{2,24}\s*T?\s*[-–—:]\s*/i, '');
    return normalize(raw);
  }
  function classNamesEquivalent(left, right) {
    const a = normalize(left);
    const b = normalize(right);
    if (a && b && a === b) return true;
    const coreA = classCoreKey(left);
    const coreB = classCoreKey(right);
    return !!(coreA && coreB && coreA === coreB);
  }
  function teacherIdentityKey7318(value) {
    return normalize(text(value).replace(/^name:/i, '').replace(/(?:선생님|강사)$/g, '').replace(/T$/i, ''));
  }
  function teacherKeysMatch7318(left, right) {
    const a = Array.isArray(left) ? left.filter(Boolean) : [];
    const b = Array.isArray(right) ? right.filter(Boolean) : [];
    return a.some(function (x) {
      return b.some(function (y) {
        return x === y || (x.length >= 2 && y.length >= 2 && (x.indexOf(y) >= 0 || y.indexOf(x) >= 0));
      });
    });
  }
  function selectedTeacherKeys7318(ctx) {
    const item = currentClassItem(ctx && ctx.className || '');
    return Array.from(new Set([
      teacherIdentityKey7318(ctx && ctx.teacherScopeKey || ''),
      teacherIdentityKey7318(teacherNameFor(ctx && ctx.className || '', item)),
      teacherIdentityKey7318(item && (item.teacher || item.instructor || item.instructorName) || '')
    ].filter(Boolean)));
  }
  function rowTeacherKeys7318(row) {
    const r = row || {};
    return Array.from(new Set([
      teacherIdentityKey7318(r.teacherScopeKey || r.evaluatorTeacherKey || ''),
      teacherIdentityKey7318(r.instructor || r.instructorName || r.teacher || r.teacherName || ''),
      teacherIdentityKey7318(teacherNameFor(r.className || r.currentClass || '', r))
    ].filter(Boolean)));
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

      let rt = typeof room.waitUntilAuthenticated === 'function'
        ? await room.waitUntilAuthenticated(12000)
        : await room.ensureAuthenticated();

      if (!rt || !rt.auth || !rt.auth.currentUser) {
        if (typeof room.forceReauthenticate === 'function') rt = await room.forceReauthenticate('staff-runtime');
      }
      if ((!rt || !rt.auth || !rt.auth.currentUser) && typeof room.waitUntilAuthenticated === 'function') {
        rt = await room.waitUntilAuthenticated(12000);
      }
      if (!rt || !rt.sdk || !rt.functions || !rt.auth || !rt.auth.currentUser) {
        throw new Error('Firebase 교직원 인증을 완료하지 못했습니다. 교직원 세션 복원 후 다시 시도해주세요.');
      }

      await rt.sdk.getIdToken(rt.auth.currentUser, true);
      if (!rt.staffOperational731) {
        rt.staffOperational731 = {
          getAttendance: rt.sdk.httpsCallable(rt.functions, 'getStaffAttendanceOperationalSnapshot'),
          getClasses: rt.sdk.httpsCallable(rt.functions, 'getStaffClassListOperationalSnapshot'),
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

  function isAuthFailure(error) {
    const code = text(error && (error.code || error.name)).toLowerCase();
    const message = text(error && error.message).toLowerCase();
    return code.indexOf('unauthenticated') >= 0 || code.indexOf('401') >= 0 ||
      message.indexOf('firebase 로그인이 필요') >= 0 || message.indexOf('unauthorized') >= 0;
  }

  function callableForLabel73105(rt, label, fallback) {
    const api = rt && rt.staffOperational731;
    if (!api) return fallback;
    const map = {
      getAttendance: 'getAttendance',
      getClasses: 'getClasses',
      saveAttendance: 'saveAttendance',
      getDaily: 'getDaily',
      saveDaily: 'saveDaily',
      getSyncStatus: 'getSyncStatus',
      refreshDate: 'refreshDate'
    };
    return api[map[label]] || fallback;
  }

  async function invokeStaff(rt, fn, payload, label) {
    try {
      return callableData(await fn(payload));
    } catch (error) {
      if (!isAuthFailure(error)) throw error;
      const room = global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727;
      if (!room || typeof room.forceReauthenticate !== 'function') throw error;
      safeConsole('warn', '[ULIM 7.31.5 staff auth retry]', label || '', error);

      runtimePromise = null;
      let fresh = await room.forceReauthenticate('staff-call-' + (label || 'unknown'));
      if ((!fresh || !fresh.auth || !fresh.auth.currentUser) && typeof room.waitUntilAuthenticated === 'function') {
        fresh = await room.waitUntilAuthenticated(12000);
      }
      if (!fresh || !fresh.auth || !fresh.auth.currentUser) throw error;
      await fresh.sdk.getIdToken(fresh.auth.currentUser, true);

      const freshRt = await runtime();
      const freshFn = callableForLabel73105(freshRt, label, fn);
      return callableData(await freshFn(payload));
    }
  }

  function isFullAdmin() {
    try {
      if (typeof adminIsFullAdmin === 'function') return !!adminIsFullAdmin();
    } catch (ignore) {}
    const role = normalize(info().role || '');
    return role === normalize('관리자') || role === normalize('전체관리자') || role === 'admin' || role === 'superadmin';
  }

  function normalizeDatasets(value) {
    const raw = Array.isArray(value) ? value : [];
    const out = [];
    raw.forEach(function (item) {
      const key = text(item);
      if (key === 'attendance' && out.indexOf('attendance') < 0) out.push('attendance');
      if ((key === 'dailyEvaluations' || key === 'daily') && out.indexOf('dailyEvaluations') < 0) out.push('dailyEvaluations');
    });
    return out.length ? out : ['attendance', 'dailyEvaluations'];
  }

  async function syncDateFromSheets(rt, date, reason, force, datasets) {
    return invokeStaff(rt, rt.staffOperational731.refreshDate, {
      date: text(date),
      reason: reason || 'manual_refresh',
      force: force === true,
      datasets: normalizeDatasets(datasets)
    }, 'refreshDate');
  }

  async function bootstrapDateOnce(rt, date, reason, datasets) {
    const normalizedDatasets = normalizeDatasets(datasets || ['attendance']);
    const datasetKey = normalizedDatasets.join('_');
    const key = 'ulim_staff_fsop_7313_bootstrap_' + owner() + '_' + text(date) + '_' + datasetKey;
    try { if (sessionStorage.getItem(key)) return null; } catch (ignore) {}
    try { sessionStorage.setItem(key, '1'); } catch (ignore) {}
    try {
      return await syncDateFromSheets(rt, date, reason || 'empty_bootstrap', false, normalizedDatasets);
    } catch (error) {
      try { sessionStorage.removeItem(key); } catch (ignore) {}
      throw error;
    }
  }

  function currentClassItem(className) {
    let list = [];
    try { list = Array.isArray(adminClassList) ? adminClassList : []; } catch (ignore) {}
    const target = normalize(className);
    const exact = list.find(function (item) { return normalize(item && item.className) === target; });
    if (exact) return exact;
    return list.find(function (item) { return classNamesEquivalent(item && item.className, className); }) || {};
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
    const className = text(document.getElementById('adminAttendanceClass') && document.getElementById('adminAttendanceClass').value);
    const classItem = currentClassItem(className);
    return {
      date: text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value) || localDateText(),
      className: className,
      classId: text(classItem.classId),
      teacherScopeKey: text(classItem.teacherScopeKey) || teacherScope(className, classItem),
      keyword: text(document.getElementById('adminAttendanceFilter') && document.getElementById('adminAttendanceFilter').value),
      statusFilter: text(document.getElementById('adminAttendanceStatusFilter') && document.getElementById('adminAttendanceStatusFilter').value)
    };
  }

  function dailyContext() {
    const className = text(document.getElementById('adminDailyEvalClass') && document.getElementById('adminDailyEvalClass').value);
    const classItem = currentClassItem(className);
    return {
      date: text(document.getElementById('adminDailyEvalDate') && document.getElementById('adminDailyEvalDate').value) || localDateText(),
      className: className,
      classId: text(classItem.classId),
      keyword: text(document.getElementById('adminDailyEvalFilter') && document.getElementById('adminDailyEvalFilter').value),
      teacherScopeKey: text(classItem.teacherScopeKey) || teacherScope(className, classItem)
    };
  }

  function cacheKey(kind, ctx) {
    return CACHE_PREFIX + kind + '_' + owner() + '_' + [ctx.date, ctx.classId || '', ctx.className, ctx.keyword || '', ctx.statusFilter || '', ctx.teacherScopeKey || '']
      .map(function (v) { return normalize(v).slice(0, 120); }).join('__');
  }

  function filterAttendanceForSelectedClass(records, ctx) {
    const list = Array.isArray(records) ? records : [];
    if (!ctx || (!ctx.className && !ctx.classId)) return list;
    const selectedKeys = selectedTeacherKeys7318(ctx);
    return list.filter(function (row) {
      const rowClassId = text(row && row.classId);
      if (ctx.classId && rowClassId) return rowClassId === text(ctx.classId);
      const rowName = text(row && (row.className || row.currentClass));
      if (normalize(rowName) === normalize(ctx.className)) return true;
      if (classCoreKey(rowName) !== classCoreKey(ctx.className)) return false;
      const rowKeys = rowTeacherKeys7318(row);
      return selectedKeys.length > 0 && rowKeys.length > 0 && teacherKeysMatch7318(selectedKeys, rowKeys);
    });
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
    bindRevisionListener7318('attendance', ctx.date);
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
        let sheetSyncResult = null;
        if (forceSheetSync) {
          const summary = document.getElementById('adminAttendanceSummary');
          if (summary) summary.textContent = 'Google Sheets 원본 → Firestore 동기화 중...';
          try {
            sheetSyncResult = await syncDateFromSheets(rt, ctx.date, 'attendance_button_refresh', true, ['attendance']);
            if (rt.staffOperational731.getClasses) {
              const classData = await invokeStaff(rt, rt.staffOperational731.getClasses, { date: ctx.date }, 'getClasses');
              if (Array.isArray(classData.classes) && classData.classes.length) applyClassListFast(ctx.date, classData.classes, true);
            }
          } catch (error) {
            sheetSyncError = error;
            safeConsole('warn', '[ULIM 7.31.3 attendance sheet refresh]', error);
          }
        }

        let data = await invokeStaff(rt, rt.staffOperational731.getAttendance, ctx, 'getAttendance');
        let records = Array.isArray(data.records) ? data.records : [];

        // 운영 데이터에는 동일 반의 짧은 반명과 화면용 전체 반명이 함께 존재할 수 있습니다.
        // classId가 아직 선택값에 붙지 않은 초기 화면에서도 담당강사에게 허용된 전체반을
        // 한 번 읽어 같은 classId 또는 반 핵심명으로 다시 매칭합니다.
        if (!records.length && (ctx.className || ctx.classId)) {
          try {
            const broadData = await invokeStaff(rt, rt.staffOperational731.getAttendance, {
              date: ctx.date,
              className: '전체반',
              classId: '',
              teacherScopeKey: ctx.teacherScopeKey || '',
              keyword: ctx.keyword || '',
              statusFilter: ctx.statusFilter || ''
            }, 'getAttendance');
            const broadRecords = Array.isArray(broadData.records) ? broadData.records : [];
            const matched = filterAttendanceForSelectedClass(broadRecords, ctx);
            if (matched.length) {
              records = matched;
              data = Object.assign({}, broadData, {
                records: matched,
                count: matched.length,
                message: 'Firestore 출석부 ' + matched.length + '건 · classId/반명 자동매칭'
              });
            }
          } catch (broadError) {
            safeConsole('warn', '[ULIM 7.31.6 attendance broad fallback]', broadError);
          }
        }

        if (!records.length && !forceSheetSync) {
          const summary = document.getElementById('adminAttendanceSummary');
          if (summary) summary.textContent = '오늘 출석부 최초 자동적재 중...';
          const refreshed = await bootstrapDateOnce(rt, ctx.date, 'attendance_empty_bootstrap', ['attendance']);
          if (refreshed) {
            data = await invokeStaff(rt, rt.staffOperational731.getAttendance, ctx, 'getAttendance');
            records = Array.isArray(data.records) ? data.records : [];
          }
        }
        writeCache(key, records);
        const syncClassCount = sheetSyncResult ? Number(sheetSyncResult.classCount || 0) : 0;
        const syncAttendanceCount = sheetSyncResult ? Number(sheetSyncResult.attendanceUpdated || sheetSyncResult.attendanceCount || 0) : 0;
        const message = sheetSyncError
          ? ('시트 동기화 실패 · 기존 Firestore 출석부 ' + records.length + '건 표시')
          : (forceSheetSync
            ? ('시트 원본 동기화 완료 · 반 ' + syncClassCount + '개 · 선택 반 출석부 ' + records.length + '건')
            : (data.message || ('Firestore 출석부 ' + records.length + '건')));
        renderAttendance(records, message);
        if (sheetSyncError && showAlert) alert('Google Sheets 원본 동기화에 실패했습니다. 기존 Firestore 자료를 표시합니다.\n' + (sheetSyncError.message || String(sheetSyncError)));
        else if (showAlert && !records.length) alert(forceSheetSync
          ? 'Google Sheets 원본 동기화는 완료됐지만 선택한 반의 출석 학생을 찾지 못했습니다. 반 목록을 다시 선택한 뒤 확인해주세요.'
          : '조건에 맞는 출석부 데이터가 없습니다. 날짜/반명/학생명을 확인해주세요.');
        return true;
      } catch (error) {
        safeConsole('warn', '[ULIM 7.31.3 attendance Firestore read]', error);
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
        const status = await invokeStaff(rt, rt.staffOperational731.getSyncStatus, { requestId: requestIdValue }, 'getSyncStatus');
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
      const data = await invokeStaff(rt, rt.staffOperational731.saveAttendance, {
        requestId: rid,
        rows: compact,
        adminId: info().id || '',
        adminName: info().name || ''
      }, 'saveAttendance');
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
    bindRevisionListener7318('daily', ctx.date);
    if (!ctx.className && !ctx.keyword) return alert('반명 또는 학생명을 입력하거나 반 목록에서 선택해주세요.');
    if (ctx.className && ctx.className !== '전체반' && !ctx.teacherScopeKey) return alert('선택한 반의 담당강사를 확인하지 못했습니다. 반 목록에서 다시 선택해주세요.');

    const key = cacheKey('daily', ctx);
    const cached = readCache(key);
    if (cached && Array.isArray(cached.rows)) {
      renderDaily(cached.rows, forceSheetSync
        ? '최근 학생 명단을 즉시 표시했습니다. 시트 원본을 백그라운드에서 확인합니다...'
        : '최근 Firestore 일일평가를 먼저 표시했습니다.');
    }

    let attendanceSyncError = null;
    let dailySyncError = null;

    async function readAndRender(rt, message) {
      const data = await invokeStaff(rt, rt.staffOperational731.getDaily, ctx, 'getDaily');
      const roster = Array.isArray(data.roster) ? data.roster : [];
      const savedRows = Array.isArray(data.rows) ? data.rows : [];
      const rows = mergeDailyStrict(roster, savedRows, ctx);
      writeCache(key, { rows: rows });
      renderDaily(rows, message || data.message || ('Firestore 학생 ' + rows.length + '명'));
      return { data: data, roster: roster, savedRows: savedRows, rows: rows };
    }

    try {
      const rt = await runtime();

      if (forceSheetSync) {
        renderDaily(cached && Array.isArray(cached.rows) ? cached.rows : [], '출석부 명단을 먼저 동기화하는 중...');

        const attendanceSyncPromise = syncDateFromSheets(
          rt,
          ctx.date,
          'daily_roster_attendance_refresh',
          true,
          ['attendance']
        ).catch(function (error) {
          attendanceSyncError = error;
          safeConsole('warn', '[ULIM 7.31.3 daily attendance sheet refresh]', error);
          return null;
        });

        const dailySyncPromise = syncDateFromSheets(
          rt,
          ctx.date,
          'daily_evaluation_sheet_refresh',
          true,
          ['dailyEvaluations']
        ).catch(function (error) {
          dailySyncError = error;
          safeConsole('warn', '[ULIM 7.31.3 daily evaluation sheet refresh]', error);
          return null;
        });

        await attendanceSyncPromise;
        const early = await readAndRender(
          rt,
          attendanceSyncError
            ? '출석 시트 동기화 실패 · 기존 Firestore 학생 명단 표시'
            : '현재 반 학생 명단 표시 완료 · 작성 평가 확인 중...'
        );

        await dailySyncPromise;
        const finalResult = dailySyncError
          ? early
          : await readAndRender(rt, '시트 원본 동기화 완료 · 학생 및 담당강사 평가 반영');

        if ((attendanceSyncError || dailySyncError) && !finalResult.rows.length) {
          const messages = [];
          if (attendanceSyncError) messages.push('출석부: ' + (attendanceSyncError.message || String(attendanceSyncError)));
          if (dailySyncError) messages.push('일일평가: ' + (dailySyncError.message || String(dailySyncError)));
          alert('Google Sheets 원본 동기화 일부가 실패했습니다.\n' + messages.join('\n'));
        }
        return true;
      }

      let result = await readAndRender(rt);
      if (!result.roster.length) {
        renderDaily(result.rows, '오늘 학생 명단 최초 자동적재 중...');
        try {
          await bootstrapDateOnce(rt, ctx.date, 'daily_attendance_empty_bootstrap', ['attendance']);
          result = await readAndRender(rt, '현재 반 학생 명단 자동적재 완료');
        } catch (error) {
          attendanceSyncError = error;
          safeConsole('warn', '[ULIM 7.31.3 daily attendance bootstrap]', error);
        }
      }

      if (!result.savedRows.length) {
        bootstrapDateOnce(rt, ctx.date, 'daily_evaluation_empty_bootstrap', ['dailyEvaluations'])
          .then(async function (refreshed) {
            if (!refreshed) return;
            try { await readAndRender(rt, '담당강사 일일평가 최신자료 반영 완료'); }
            catch (error) { safeConsole('warn', '[ULIM 7.31.3 daily background refresh]', error); }
          })
          .catch(function (error) {
            safeConsole('warn', '[ULIM 7.31.3 daily evaluation bootstrap]', error);
          });
      }

      if (attendanceSyncError && !result.rows.length && !cached) {
        alert(attendanceSyncError.message || String(attendanceSyncError));
      }
      return true;
    } catch (error) {
      safeConsole('warn', '[ULIM 7.31.3 daily Firestore read]', error);
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
      const data = await invokeStaff(rt, rt.staffOperational731.saveDaily, {
        requestId: rid,
        rows: compact,
        sendSms: sendSms,
        sendChannel: sendChannel,
        recipientTypes: recipientTypes,
        adminId: info().id || '',
        adminName: info().name || ''
      }, 'saveDaily');
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

  const CLASS_CACHE_PREFIX = 'ulim_staff_classlist_7313_';
  const LEGACY_CLASS_CACHE_PREFIX = 'ulim_staff_classlist_7312_';

  function classCacheKey(date) {
    return CLASS_CACHE_PREFIX + owner() + '_' + text(date);
  }

  function teacherFromClassName(className) {
    const match = text(className).match(/\[\s*([^\]]+?)\s*T?\s*\]/i);
    return match && match[1] ? match[1].replace(/T$/i, '').trim() : '';
  }

  function classItemsFromRecords(records) {
    const map = new Map();
    (records || []).forEach(function (row) {
      const className = text(row && (row.className || row.currentClass));
      if (!className) return;
      const key = normalize(className);
      if (!key || map.has(key)) return;
      map.set(key, {
        className: className,
        teacher: text(row && (row.instructor || row.instructorName)) || teacherFromClassName(className),
        classId: text(row && row.classId),
        source: 'firestore_attendance'
      });
    });
    return Array.from(map.values()).sort(function (a, b) {
      return String(a.className).localeCompare(String(b.className), 'ko');
    });
  }

  function weekdayKorean(dateTextValue) {
    const parts = text(dateTextValue).split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return '';
    const day = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    return ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][day] || '';
  }

  function fixedClassItemsForDate(date) {
    let source = [];
    try { source = Array.isArray(ADMIN_NOTICE_FIXED_CLASS_LIST) ? ADMIN_NOTICE_FIXED_CLASS_LIST : []; } catch (ignore) {}
    const weekday = weekdayKorean(date);
    return source
      .filter(function (name) { return !weekday || text(name).indexOf(weekday) >= 0; })
      .map(function (name) {
        return { className: text(name), teacher: teacherFromClassName(name), source: 'fixed_fast_seed' };
      });
  }

  function readPersistentClassList(date) {
    try {
      const exact = JSON.parse(localStorage.getItem(classCacheKey(date)) || 'null');
      if (exact && Array.isArray(exact.classes) && exact.classes.length) return exact.classes;
      const legacyExact = JSON.parse(localStorage.getItem(LEGACY_CLASS_CACHE_PREFIX + owner() + '_' + text(date)) || 'null');
      if (legacyExact && Array.isArray(legacyExact.classes) && legacyExact.classes.length) return legacyExact.classes;
      const last = JSON.parse(localStorage.getItem(CLASS_CACHE_PREFIX + owner() + '_last') || localStorage.getItem(LEGACY_CLASS_CACHE_PREFIX + owner() + '_last') || 'null');
      if (last && Array.isArray(last.classes) && last.classes.length) {
        const weekday = weekdayKorean(date);
        const sameWeekday = weekday ? last.classes.filter(function (item) {
          return text(item && item.className).indexOf(weekday) >= 0;
        }) : last.classes;
        if (sameWeekday.length) return sameWeekday;
      }
    } catch (ignore) {}
    return null;
  }

  function writePersistentClassList(date, classes) {
    if (!Array.isArray(classes) || !classes.length) return;
    const payload = JSON.stringify({ savedAt: Date.now(), date: date, classes: clone(classes) });
    try {
      localStorage.setItem(classCacheKey(date), payload);
      localStorage.setItem(CLASS_CACHE_PREFIX + owner() + '_last', payload);
    } catch (ignore) {}
  }

  function applyClassListFast(date, classes, exact) {
    let filtered = Array.isArray(classes) ? classes.filter(function (item) {
      return item && text(item.className);
    }) : [];
    try {
      if (typeof adminFilterClassListForRole === 'function') filtered = adminFilterClassListForRole(filtered);
    } catch (ignore) {}

    try { adminClassList = filtered; global.adminClassList = filtered; } catch (ignore) {}
    try {
      if (typeof getAdminClassListCacheKey === 'function') {
        adminClassListLoadedKey = getAdminClassListCacheKey(date);
        if (typeof writeAdminClassListCache === 'function') writeAdminClassListCache(adminClassListLoadedKey, filtered);
      }
    } catch (ignore) {}
    if (exact) writePersistentClassList(date, filtered);
    try { if (typeof adminRenderClassSelectors === 'function') adminRenderClassSelectors(); } catch (ignore) {}
    if (exact) {
      try { if (typeof adminClearInvalidClassSelection704_ === 'function') adminClearInvalidClassSelection704_(date); } catch (ignore) {}
    }
    return filtered;
  }

  async function legacyClassListForDate(date, force) {
    if (typeof adminApi !== 'function') return [];
    try {
      const data = await adminApi('adminGetClassList', {
        adminToken: token(),
        date: date,
        force: force ? '1' : '',
        exactDateVersion: '704'
      });
      return Array.isArray(data && data.classes) ? data.classes : [];
    } catch (error) {
      safeConsole('warn', '[ULIM 7.31.3 legacy class list]', error);
      return [];
    }
  }

  global.adminLoadClassList = async function (dateOverride, force) {
    if (!token()) return [];
    const date = text(dateOverride)
      || text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value)
      || text(document.getElementById('adminDailyEvalDate') && document.getElementById('adminDailyEvalDate').value)
      || localDateText();
    force = force === true;

    let immediate = readPersistentClassList(date);
    if (!immediate || !immediate.length) {
      try {
        const sessionKey = typeof getAdminClassListCacheKey === 'function' ? getAdminClassListCacheKey(date) : '';
        immediate = sessionKey && typeof readAdminClassListCache === 'function' ? readAdminClassListCache(sessionKey) : null;
      } catch (ignore) {}
    }
    if (!immediate || !immediate.length) {
      try { immediate = Array.isArray(adminClassList) && adminClassList.length ? adminClassList : null; } catch (ignore) {}
    }
    if (!immediate || !immediate.length) immediate = fixedClassItemsForDate(date);
    if (immediate && immediate.length) applyClassListFast(date, immediate, false);

    const requestKey = 'classlist|' + owner() + '|' + date + '|' + (force ? 'force' : 'normal');
    if (inflight.has(requestKey)) return inflight.get(requestKey);

    const promise = (async function () {
      const rt = await runtime();

      async function readFirestoreClasses() {
        if (rt.staffOperational731.getClasses) {
          const classData = await invokeStaff(rt, rt.staffOperational731.getClasses, { date: date }, 'getClasses');
          const classes = Array.isArray(classData.classes) ? classData.classes : [];
          if (classes.length) return classes;
        }
        const data = await invokeStaff(rt, rt.staffOperational731.getAttendance, {
          date: date,
          className: '전체반',
          keyword: '',
          statusFilter: ''
        }, 'getAttendance');
        const records = Array.isArray(data.records) ? data.records : [];
        return classItemsFromRecords(records);
      }

      let firestoreClasses = [];
      try {
        firestoreClasses = await readFirestoreClasses();
        if (firestoreClasses.length) applyClassListFast(date, firestoreClasses, true);
      } catch (error) {
        safeConsole('warn', '[ULIM 7.31.3 Firestore class list]', error);
      }

      const legacyPromise = legacyClassListForDate(date, false).then(function (classes) {
        if (classes.length) applyClassListFast(date, classes, true);
        return classes;
      });

      if (force || !firestoreClasses.length) {
        try {
          await syncDateFromSheets(
            rt,
            date,
            force ? 'class_list_force_refresh' : 'class_list_empty_bootstrap',
            force,
            ['attendance']
          );
          firestoreClasses = await readFirestoreClasses();
          if (firestoreClasses.length) applyClassListFast(date, firestoreClasses, true);
        } catch (error) {
          safeConsole('warn', '[ULIM 7.31.3 class list sheet sync]', error);
        }
      }

      const legacyClasses = await legacyPromise;
      if (!firestoreClasses.length && !legacyClasses.length && force) {
        applyClassListFast(date, [], true);
      }
      return firestoreClasses.length ? firestoreClasses : legacyClasses;
    })().finally(function () {
      inflight.delete(requestKey);
    });

    inflight.set(requestKey, promise);
    return promise;
  };
  try { adminLoadClassList = global.adminLoadClassList; } catch (ignore) {}

  global.ulimRefreshStaffOperationalDateFromSheets731 = async function (date, reason, force, datasets) {
    const target = text(date || attendanceContext().date || localDateText());
    const rt = await runtime();
    return syncDateFromSheets(rt, target, reason || 'manual_refresh', force !== false, datasets);
  };

  let autoBootstrapStarted = false;
  let legacyWarmupSent = false;
  async function autoBootstrapTodayIfNeeded() {
    if (autoBootstrapStarted || !token()) return false;
    autoBootstrapStarted = true;
    try {
      const rt = await runtime();
      const date = localDateText();
      const data = await invokeStaff(rt, rt.staffOperational731.getAttendance, {
        date: date,
        className: '',
        keyword: '',
        statusFilter: ''
      }, 'getAttendance');
      const records = Array.isArray(data.records) ? data.records : [];
      if (!records.length) await bootstrapDateOnce(rt, date, 'login_empty_bootstrap', ['attendance']);
      return true;
    } catch (error) {
      autoBootstrapStarted = false;
      safeConsole('warn', '[ULIM 7.31.3 login auto bootstrap]', error);
      return false;
    }
  }

  function revisionDate7318(kind) {
    const id = kind === 'attendance' ? 'adminAttendanceDate' : 'adminDailyEvalDate';
    return text(document.getElementById(id) && document.getElementById(id).value) || localDateText();
  }

  function scheduleRevisionReload7318(kind, date, revision) {
    const state = revisionListeners7318[kind];
    if (!state || state.date !== date) return;
    if (state.reloadTimer) clearTimeout(state.reloadTimer);
    state.reloadTimer = setTimeout(function () {
      state.reloadTimer = null;
      if (revisionDate7318(kind) !== date) return;
      if (kind === 'attendance') {
        const select = document.getElementById('adminAttendanceClass');
        if (select && text(select.value) && typeof global.adminLoadAttendanceSnapshot === 'function') {
          global.adminLoadAttendanceSnapshot(false, false).catch(function (error) {
            safeConsole('warn', '[ULIM 7.31.8 attendance realtime reload]', error);
          });
        }
      } else {
        const select = document.getElementById('adminDailyEvalClass');
        if (select && text(select.value) && typeof global.adminLoadDailyEvalStudents === 'function') {
          global.adminLoadDailyEvalStudents(false).catch(function (error) {
            safeConsole('warn', '[ULIM 7.31.8 daily realtime reload]', error);
          });
        }
      }
    }, 180);
  }

  async function bindRevisionListener7318(kind, date) {
    const targetDate = text(date) || localDateText();
    const state = revisionListeners7318[kind];
    if (!state) return;
    if (state.date === targetDate && typeof state.unsubscribe === 'function') return;
    if (typeof state.unsubscribe === 'function') {
      try { state.unsubscribe(); } catch (ignore) {}
    }
    if (state.reloadTimer) clearTimeout(state.reloadTimer);
    state.date = targetDate;
    state.unsubscribe = null;
    state.initialized = false;
    state.lastRevision = 0;

    try {
      const rt = await runtime();
      const ref = rt.sdk.doc(rt.db, 'staffOperationalRevisions', targetDate);
      state.unsubscribe = rt.sdk.onSnapshot(ref, function (snapshot) {
        const data = snapshot && snapshot.exists() ? snapshot.data() || {} : {};
        const field = kind === 'attendance' ? 'attendanceRevision' : 'dailyRevision';
        const revision = Number(data[field] || 0);
        if (!state.initialized) {
          state.initialized = true;
          state.lastRevision = revision;
          return;
        }
        if (revision <= state.lastRevision) return;
        state.lastRevision = revision;
        safeConsole('info', '[ULIM 7.31.8 ' + kind + ' revision]', targetDate, revision);
        scheduleRevisionReload7318(kind, targetDate, revision);
      }, function (error) {
        state.unsubscribe = null;
        safeConsole('warn', '[ULIM 7.31.8 ' + kind + ' revision listener]', error);
      });
    } catch (error) {
      safeConsole('warn', '[ULIM 7.31.8 revision bind]', kind, error);
    }
  }

  function ensureRevisionListeners7318() {
    if (!token()) return;
    bindRevisionListener7318('attendance', revisionDate7318('attendance'));
    bindRevisionListener7318('daily', revisionDate7318('daily'));
  }

  function resetRevisionListeners7318() {
    ['attendance', 'daily'].forEach(function (kind) {
      const state = revisionListeners7318[kind];
      if (!state) return;
      if (typeof state.unsubscribe === 'function') {
        try { state.unsubscribe(); } catch (ignore) {}
      }
      if (state.reloadTimer) clearTimeout(state.reloadTimer);
      state.date = '';
      state.unsubscribe = null;
      state.initialized = false;
      state.lastRevision = 0;
      state.reloadTimer = null;
    });
  }

  function installRevisionDateHandlers7318() {
    ['adminAttendanceDate', 'adminDailyEvalDate'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el || el.dataset.ulimRevisionListener7318 === '1') return;
      el.dataset.ulimRevisionListener7318 = '1';
      el.addEventListener('change', function () { setTimeout(ensureRevisionListeners7318, 0); });
    });
  }

  function prewarm() {
    installRevisionDateHandlers7318();
    ensureRevisionListeners7318();
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
    try { if (typeof adminLoadClassList === 'function') adminLoadClassList('', false); } catch (ignore) {}
    runtime().then(function () {
      autoBootstrapTodayIfNeeded().catch(function () {});
    }).catch(function (error) { safeConsole('warn', '[ULIM 7.31.3 Firebase prewarm]', error); });
  }
  function retryPrewarm(attempt) {
    prewarm();
    if (!token() && attempt < 120) setTimeout(function () { retryPrewarm(attempt + 1); }, 750);
  }
  setTimeout(function () { retryPrewarm(0); }, 0);
  global.addEventListener('online', prewarm);
  global.addEventListener('pageshow', function () { setTimeout(prewarm, 100); });

  let lastAuthReadyUid73105 = '';
  let lastAuthReadyAt73105 = 0;
  global.addEventListener('ulim-firebase-auth-ready', function (event) {
    const uid = text(event && event.detail && event.detail.uid);
    const now = Date.now();
    if (uid && uid === lastAuthReadyUid73105 && now - lastAuthReadyAt73105 < 1500) return;
    lastAuthReadyUid73105 = uid;
    lastAuthReadyAt73105 = now;
    runtimePromise = null;

    setTimeout(function () {
      resetRevisionListeners7318();
      installRevisionDateHandlers7318();
      ensureRevisionListeners7318();
      try {
        if (typeof adminLoadClassList === 'function') adminLoadClassList('', false);
      } catch (error) { safeConsole('warn', '[ULIM 7.31.5 auth-ready class reload]', error); }

      try {
        const attendancePanel = document.getElementById('adminPanelAttendance');
        const classSelect = document.getElementById('adminAttendanceClass');
        if (attendancePanel && attendancePanel.classList.contains('active') && classSelect && text(classSelect.value)) {
          if (typeof adminLoadAttendanceSnapshot === 'function') adminLoadAttendanceSnapshot(false, false);
        }
      } catch (error) { safeConsole('warn', '[ULIM 7.31.5 auth-ready attendance reload]', error); }
    }, 60);
  });

  const style = document.createElement('style');
  style.id = 'ulim-staff-firestore-operational-7318-style';
  style.textContent = '.ulim-firestore-sync-note-731{font-size:11px;font-weight:800;color:#047857}';
  document.head.appendChild(style);

  safeConsole('info', '[ULIM staff Firestore operational auth-gated]', VERSION);
})(typeof window !== 'undefined' ? window : globalThis);
