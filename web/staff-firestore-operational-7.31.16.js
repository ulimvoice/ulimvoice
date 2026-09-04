(function (global) {
  'use strict';

  if (global.__ULIM_STAFF_FIRESTORE_OPERATIONAL_73116__) return;
  global.__ULIM_STAFF_FIRESTORE_OPERATIONAL_73116__ = true;

  const VERSION = '2026-08-01.731.16-efficiency';
  const CACHE_PREFIX = 'ulim_staff_fsop_73116_';
  const inflight = new Map();
  let runtimePromise = null;
  let revisionEnsurePromise73112 = null;
  const revisionListeners7318 = {
    attendance: { date: '', classId: '', scopeId: '', unsubscribe: null, initialized: false, lastRevision: 0, reloadTimer: null, blockedUntil: 0 },
    daily: { date: '', classId: '', scopeId: '', unsubscribe: null, initialized: false, lastRevision: 0, reloadTimer: null, blockedUntil: 0 }
  };

  function safeConsole() {
    // 운영 배포본에서는 브라우저 콘솔에 앱 내부 정보를 출력하지 않습니다.
    return undefined;
  }

  function text(value) { return String(value == null ? '' : value).trim(); }

function attendanceOnly73115(value) {
  const raw = text(value);
  const key = raw.replace(/\s+/g, '').toUpperCase();
  if (/^(O|○|ㅇ|출|출석|TRUE|V|✓|✔)$/.test(key)) return '출석';
  if (/^(X|×|✕|결|결석|FALSE)$/.test(key)) return '결석';
  if (/^(지|지각|△|늦음)$/.test(key)) return '지각';
  return '미체크';
}

function specialStatusOnly73115(row) {
  const r = row || {};
  const raw = [
    r.specialStatus,
    r.specialType,
    r.special,
    r.colorStatus,
    r.enrollmentStatus,
    r.studentStatus
  ].map(text).filter(Boolean).join(' ');
  const found = [];
  ['보강', '신규', '반이동', '휴원'].forEach(function (word) {
    if (raw.indexOf(word) >= 0 && found.indexOf(word) < 0) found.push(word);
  });
  return found.join(' / ');
}

function isLegacyAutoCurrentStatus73115(value) {
  return /^\d{4}-\d{2}-\d{2}\s+(?:재원|휴원|퇴원)\s+(?:출석|결석|지각)\s*[-–—:]?\s*$/.test(text(value));
}

function manualCurrentStatus73115(value) {
  const raw = text(value);
  return isLegacyAutoCurrentStatus73115(raw) ? '' : raw;
}

function currentStatusEdited73115(row) {
  const r = row || {};
  return r.__currentStatusDirty734310 === true ||
    String(r.__currentStatusDirty734310 || '').toLowerCase() === 'true' ||
    String(r.__currentStatusDirty734310 || '') === '1';
}

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

      if (room && typeof room.getStableIdToken === 'function') {
        await room.getStableIdToken(rt, false, 'staff-operational-runtime');
      } else {
        await rt.sdk.getIdToken(rt.auth.currentUser, false);
      }
      if (!rt.staffOperational731) {
        rt.staffOperational731 = {
          getAttendance: rt.sdk.httpsCallable(rt.functions, 'getStaffAttendanceOperationalSnapshot'),
          getClasses: rt.sdk.httpsCallable(rt.functions, 'getStaffClassListOperationalSnapshot'),
          saveAttendance: rt.sdk.httpsCallable(rt.functions, 'saveStaffAttendanceOperational'),
          getDaily: rt.sdk.httpsCallable(rt.functions, 'getStaffDailyEvaluationOperationalSnapshot'),
          saveDaily: rt.sdk.httpsCallable(rt.functions, 'saveStaffDailyEvaluationsOperational')
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
      saveDaily: 'saveDaily'
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
      if (room && typeof room.getStableIdToken === 'function') {
        await room.getStableIdToken(fresh, true, 'staff-call-retry-' + (label || 'unknown'));
      } else {
        await fresh.sdk.getIdToken(fresh.auth.currentUser, false);
      }

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


  function setAttendanceSummary(adminMessage, staffMessage) {
    const summary = document.getElementById('adminAttendanceSummary');
    if (!summary) return;
    if (isFullAdmin()) {
      summary.textContent = text(adminMessage);
      summary.style.display = '';
      summary.dataset.ulimTechnicalHidden = '0';
      return;
    }
    if (typeof staffMessage === 'undefined') return;
    summary.textContent = text(staffMessage);
    summary.style.display = staffMessage ? '' : 'none';
    summary.dataset.ulimTechnicalHidden = staffMessage ? '0' : '1';
  }

  function friendlyError(error, fallback) {
    if (isFullAdmin()) return text(error && error.message || error) || fallback || '처리 중 문제가 발생했습니다.';
    return fallback || '처리 중 문제가 발생했습니다. 다시 시도해주세요.';
  }

  function simpleCountLabel(kind, count) {
    return kind + ' ' + Number(count || 0) + '명';
  }

  function currentClassItem(className, date) {
    let list = [];

    try {
      if (
        date &&
        typeof global.adminGetClassListForDate704_ === 'function'
      ) {
        list = global.adminGetClassListForDate704_(date);
      }
    } catch (ignore) {}

    if (!Array.isArray(list) || !list.length) {
      try {
        const expectedKey =
          date && typeof getAdminClassListCacheKey === 'function'
            ? getAdminClassListCacheKey(date)
            : '';

        const loadedKey =
          typeof adminClassListLoadedKey !== 'undefined'
            ? text(adminClassListLoadedKey)
            : '';

        const canUseSharedList =
          !date ||
          (expectedKey && loadedKey === expectedKey);

        list =
          canUseSharedList &&
          Array.isArray(adminClassList)
            ? adminClassList
            : [];
      } catch (ignore) {
        list = [];
      }
    }

    const target = normalize(className);
    const exact = list.find(function (item) {
      return normalize(item && item.className) === target;
    });

    if (exact) return exact;

    return list.find(function (item) {
      return classNamesEquivalent(item && item.className, className);
    }) || {};
  }

  function teacherNameFor(className, row, date) {
    const bracket = text(className).match(/\[\s*([^\]]+?)\s*T?\s*\]/i);
    if (bracket && bracket[1]) return bracket[1].replace(/T$/i, '').trim();

    const item = currentClassItem(className, date);
    return text(
      item.teacher ||
      item.instructor ||
      row && (row.instructor || row.instructorName) ||
      ''
    ).replace(/T$/i, '').trim();
  }

  function teacherScope(className, row, date) {
    const name = teacherNameFor(className, row, date);
    return name ? 'name:' + normalize(name) : '';
  }

  function attendanceContext() {
    const date =
      text(
        document.getElementById('adminAttendanceDate') &&
        document.getElementById('adminAttendanceDate').value
      ) || localDateText();

    const className = text(
      document.getElementById('adminAttendanceClass') &&
      document.getElementById('adminAttendanceClass').value
    );

    const classItem = currentClassItem(className, date);

    return {
      date: date,
      className: className,
      classId: text(classItem.classId),
      teacherScopeKey:
        text(classItem.teacherScopeKey) ||
        teacherScope(className, classItem, date),
      keyword: text(
        document.getElementById('adminAttendanceFilter') &&
        document.getElementById('adminAttendanceFilter').value
      ),
      statusFilter: text(
        document.getElementById('adminAttendanceStatusFilter') &&
        document.getElementById('adminAttendanceStatusFilter').value
      )
    };
  }

  function dailyContext() {
    const date =
      text(
        document.getElementById('adminDailyEvalDate') &&
        document.getElementById('adminDailyEvalDate').value
      ) || localDateText();

    const className = text(
      document.getElementById('adminDailyEvalClass') &&
      document.getElementById('adminDailyEvalClass').value
    );

    const classItem = currentClassItem(className, date);

    return {
      date: date,
      className: className,
      classId: text(classItem.classId),
      keyword: text(
        document.getElementById('adminDailyEvalFilter') &&
        document.getElementById('adminDailyEvalFilter').value
      ),
      teacherScopeKey:
        text(classItem.teacherScopeKey) ||
        teacherScope(className, classItem, date)
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

  const attendanceLocalEdits73116 = new Map();
  let activeAttendanceLoadSeq73116 = 0;
  let activeAttendanceLoadContextKey73116 = '';

  function attendanceEditContextKey73116(ctx) {
    const current = ctx || attendanceContext();
    return [
      text(current.date),
      text(current.classId),
      normalize(current.className),
      normalize(current.keyword),
      normalize(current.statusFilter),
      text(current.teacherScopeKey)
    ].join('|');
  }

  function attendanceRows73116() {
    try {
      if (Array.isArray(adminAttendanceRecords)) {
        return adminAttendanceRecords;
      }
    } catch (ignore) {}

    try {
      if (Array.isArray(global.adminAttendanceRecords)) {
        return global.adminAttendanceRecords;
      }
    } catch (ignore) {}

    return [];
  }

  function attendanceEditMapKey73116(contextKey, row) {
    return contextKey + '||' + studentMatchKey(row || {});
  }

  function captureAttendanceRow73116(tr) {
    if (!tr) return;

    const index = Number(tr.dataset.attIndex);
    const base = attendanceRows73116()[index];
    if (!base) return;

    const statusEl = tr.querySelector('select[data-field="status"]');
    const memoEl = tr.querySelector('input[data-field="memo"]');
    const currentEl = tr.querySelector('input[data-field="currentStatus"]');
    const checkEl = tr.querySelector('.admin-att-check');
    const contextKey = attendanceEditContextKey73116();
    const mapKey = attendanceEditMapKey73116(contextKey, base);

    const draft = {
      status: statusEl ? statusEl.value : (base.status || base.attendanceStatus || ''),
      attendanceStatus: statusEl ? statusEl.value : (base.attendanceStatus || base.status || ''),
      memo: memoEl ? memoEl.value : (base.memo || ''),
      checked: !checkEl || checkEl.checked !== false,
      __localAttendanceDirty73116: true
    };

    if (currentEl) {
      const currentValue = currentEl.value || '';
      currentEl.dataset.currentStatusDirty = '1';
      tr.dataset.currentStatusDirty = '1';

      draft.currentStatus = currentValue;
      draft.remarkText = currentValue;
      draft.sheetRemark = currentValue;
      draft.currentStatusDirty = true;
      draft.remarkDirty = true;
      draft.sheetRemarkDirty = true;
      draft.__currentStatusDirty734310 = true;
    }

    attendanceLocalEdits73116.set(mapKey, draft);

    while (attendanceLocalEdits73116.size > 500) {
      const oldestKey = attendanceLocalEdits73116.keys().next().value;
      if (!oldestKey) break;
      attendanceLocalEdits73116.delete(oldestKey);
    }
  }

  function captureAttendanceEditEvent73116(event) {
    const target = event && event.target;
    if (!target || typeof target.closest !== 'function') return;

    const quickButton = target.closest('.admin-att-mini');
    const editable =
      typeof target.matches === 'function' &&
      target.matches(
        '#adminAttendanceTableWrap select[data-field="status"], ' +
        '#adminAttendanceTableWrap input[data-field="memo"], ' +
        '#adminAttendanceTableWrap input[data-field="currentStatus"], ' +
        '#adminAttendanceTableWrap input.admin-att-check'
      );

    if (!quickButton && !editable) return;

    const tr = target.closest(
      '#adminAttendanceTableWrap tr[data-att-index]'
    );
    captureAttendanceRow73116(tr);
  }

  function preserveAttendanceEdits73116(records) {
    const contextKey = attendanceEditContextKey73116();
    const source = Array.isArray(records) ? records : [];
    const seen = new Set();

    const prepared = source.map(function (row) {
      const mapKey = attendanceEditMapKey73116(contextKey, row);
      const draft = attendanceLocalEdits73116.get(mapKey);
      seen.add(mapKey);

      return draft
        ? Object.assign({}, row, draft)
        : row;
    });

    /*
     * 실시간 갱신 중 일시적으로 빈 응답이 와도
     * 저장되지 않은 편집 행은 현재 화면에 유지합니다.
     */
    attendanceRows73116().forEach(function (row) {
      const mapKey = attendanceEditMapKey73116(contextKey, row);
      const draft = attendanceLocalEdits73116.get(mapKey);
      if (!draft || seen.has(mapKey)) return;

      seen.add(mapKey);
      prepared.push(Object.assign({}, row, draft));
    });

    return prepared;
  }

  function clearSavedAttendanceEdits73116(records, ctx) {
    const contextKey = attendanceEditContextKey73116(ctx);

    (records || []).forEach(function (row) {
      const mapKey = attendanceEditMapKey73116(contextKey, row);
      const draft = attendanceLocalEdits73116.get(mapKey);
      if (!draft) return;

      const sameStatus =
        normalize(draft.status) ===
        normalize(row.status || row.attendanceStatus);

      const sameMemo =
        text(draft.memo) === text(row.memo);

      const sameCurrent =
        !draft.currentStatusDirty ||
        text(draft.currentStatus) ===
        text(row.currentStatus || row.remarkText || row.sheetRemark);

      if (sameStatus && sameMemo && sameCurrent && draft.checked !== false) {
        attendanceLocalEdits73116.delete(mapKey);
      }
    });
  }

  if (!global.__ULIM_ATTENDANCE_EDIT_GUARD_73116__) {
    global.__ULIM_ATTENDANCE_EDIT_GUARD_73116__ = true;

    document.addEventListener(
      'input',
      captureAttendanceEditEvent73116,
      false
    );
    document.addEventListener(
      'change',
      captureAttendanceEditEvent73116,
      false
    );
    document.addEventListener(
      'click',
      captureAttendanceEditEvent73116,
      false
    );
  }

  function renderAttendance(records, message) {
    const preparedRecords = preserveAttendanceEdits73116(records);
    try {
      adminAttendanceRecords = preparedRecords.map(clone);
      global.adminAttendanceRecords = adminAttendanceRecords;
    } catch (ignore) {}
    try { if (typeof adminRenderAttendanceTable === 'function') adminRenderAttendanceTable(); } catch (ignore) {}
    const count = (records && records.length) || 0;
    setAttendanceSummary(message || ('Firestore 출석부 ' + count + '건'), simpleCountLabel('학생', count));
  }

  global.adminLoadAttendanceSnapshot = async function (showAlert, forceRefresh) {
    if (!token()) return false;
    showAlert = showAlert !== false;
    forceRefresh = forceRefresh === true;
    const ctx = attendanceContext();
    const loadContextKey73116 = attendanceEditContextKey73116(ctx);

    if (activeAttendanceLoadContextKey73116 !== loadContextKey73116) {
      activeAttendanceLoadContextKey73116 = loadContextKey73116;
      activeAttendanceLoadSeq73116 += 1;
    }
    const loadSeq73116 = activeAttendanceLoadSeq73116;
    const canRenderAttendanceLoad73116 = function () {
      return loadSeq73116 === activeAttendanceLoadSeq73116 &&
        attendanceEditContextKey73116() === loadContextKey73116;
    };

    bindRevisionListener7318('attendance', ctx.date);
    const key = cacheKey('attendance', ctx);
    const cached = forceRefresh ? null : readCache(key);
    if (Array.isArray(cached) && canRenderAttendanceLoad73116()) {
      renderAttendance(cached, '최근 Firestore 출석부를 먼저 표시했습니다.');
    }

    const requestKey = 'attendance|' + key + '|' + (forceRefresh ? 'refresh' : 'normal');
    if (inflight.has(requestKey)) return inflight.get(requestKey);

    const promise = (async function () {
      try {
        const rt = await runtime();

        if (forceRefresh && rt.staffOperational731.getClasses) {
          try {
            const classData = await invokeStaff(rt, rt.staffOperational731.getClasses, { date: ctx.date }, 'getClasses');
            if (Array.isArray(classData.classes)) applyClassListFast(ctx.date, classData.classes, true);
          } catch (classError) {
            safeConsole('warn', '[ULIM 7.31.17 Firestore class refresh]', classError);
          }
        }

        let data = await invokeStaff(rt, rt.staffOperational731.getAttendance, ctx, 'getAttendance');
        let records = Array.isArray(data.records) ? data.records : [];

        if (!records.length && data.queryOptimized !== true && (ctx.className || ctx.classId)) {
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
            safeConsole('warn', '[ULIM 7.31.17 attendance broad fallback]', broadError);
          }
        }

        writeCache(key, records);
        if (canRenderAttendanceLoad73116()) {
          renderAttendance(records, data.message || ('Firestore 출석부 ' + records.length + '건'));
        }
        if (showAlert && !records.length) {
          alert('조건에 맞는 출석부 데이터가 없습니다. 날짜/반명/학생명을 확인해주세요.');
        }
        return true;
      } catch (error) {
        safeConsole('warn', '[ULIM 7.31.17 attendance Firestore read]', error);
        if (!cached) {
          setAttendanceSummary('출석부 조회 실패 · 네트워크 연결을 확인해주세요.', '출석부를 불러오지 못했습니다.');
          if (showAlert) alert(friendlyError(error, '출석부를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'));
        }
        return false;
      } finally {
        inflight.delete(requestKey);
      }
    })();
    inflight.set(requestKey, promise);
    return promise;
  };
  try { adminLoadAttendanceSnapshot = global.adminLoadAttendanceSnapshot; } catch (ignore) {}


function attendanceMinimal(row) {
  const r = row || {};
  const ctx = attendanceContext();
  const currentStatusDirty = currentStatusEdited73115(r);
  const result = {
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
    status: attendanceOnly73115(r.status || r.attendanceStatus),
    attendanceStatus: attendanceOnly73115(r.attendanceStatus || r.status),
    specialStatus: specialStatusOnly73115(r),
    currentStatusDirty: currentStatusDirty,
    remarkDirty: currentStatusDirty,
    sheetRemarkDirty: currentStatusDirty,
    __currentStatusDirty734310: currentStatusDirty,
    memo: r.memo || '',
    classroom: r.classroom || r.roomName || r.room || '',
    sourceSheet: r.sourceSheet || r.sheetName || '',
    sheetName: r.sheetName || r.sourceSheet || '',
    sourceCell: r.sourceCell || r.cellA1 || '',
    cellA1: r.cellA1 || r.sourceCell || '',
    rowNumber: r.rowNumber || r.row || 0,
    row: r.row || r.rowNumber || 0
  };

  // 현재상태는 이 브라우저 세션에서 강사가 입력칸을 편집했을 때만 보냅니다.
  if (currentStatusDirty) {
    const value = manualCurrentStatus73115(r.currentStatus || r.remarkText || r.sheetRemark || '');
    result.currentStatus = value;
    result.remarkText = value;
    result.sheetRemark = value;
  }
  return result;
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
      clearSavedAttendanceEdits73116(compact, attendanceContext());
      setAttendanceState(compact, '저장됨', false);
      const summary = document.getElementById('adminAttendanceSummary');
      setAttendanceSummary(data.message || ('출석 ' + compact.length + '건 Firestore 저장 완료'), '저장 완료');
      const ctx = attendanceContext();
      writeCache(cacheKey('attendance', ctx), typeof adminAttendanceRecords !== 'undefined' ? adminAttendanceRecords : compact);
      if (!silent) alert(data.message || '출석부가 저장되었습니다.');
      try {
        const keys = new Set(compact.map(function (row) {
          return [row.date, row.className, row.studentIdentityKey || row.studentNo || row.studentName].map(normalize).join('|');
        }));
        const all = Array.isArray(global.adminAttendanceRecords) ? global.adminAttendanceRecords : [];
        all.forEach(function (row) {
          const key = [row.date, row.className, row.studentIdentityKey || row.studentNo || row.studentName].map(normalize).join('|');
          if (!keys.has(key)) return;
          row.currentStatusDirty = false;
          row.remarkDirty = false;
          row.sheetRemarkDirty = false;
          row.__currentStatusDirty734310 = false;
          row.__currentStatusDirty73439 = false;
        });
        document.querySelectorAll('#adminAttendanceTableWrap tr[data-att-index]').forEach(function (tr) {
          delete tr.dataset.currentStatusDirty;
          const input = tr.querySelector('input[data-field="currentStatus"]');
          if (input) delete input.dataset.currentStatusDirty;
        });
      } catch (ignore) {}
      return true;
    } catch (error) {
      setAttendanceState(compact, '저장 실패', true);
      if (!silent) alert(friendlyError(error, '출석부 저장에 실패했습니다. 다시 시도해주세요.'));
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

    // 출석 명단과 저장 평가에 공통으로 존재하는 식별키를 최우선 사용합니다.
    if (text(r.studentIdentityKey)) {
      return 'KEY|' + text(r.studentIdentityKey);
    }

    if (text(r.studentUid)) {
      return 'UID|' + text(r.studentUid);
    }

    const phone = text(r.studentPhone).replace(/\D/g, '');
    if (phone.length >= 8) {
      return 'PHONE|' + phone;
    }

    if (text(r.studentNo || r.attendanceNo)) {
      return 'NO|' + normalize(r.studentNo || r.attendanceNo);
    }

    return 'NAME|' +
      normalize(r.studentName || r.name) +
      '|' +
      classCoreKey(r.className);
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
      specialStatus: r.specialStatus || r.specialType || r.enrollmentStatus || r.studentStatus || '',
      memo: r.memo || '',
      videoLink: r.videoLink || (typeof adminGetVideoLinkForClassName_ === 'function' ? adminGetVideoLinkForClassName_(r.className || ctx.className) : ''),
      lessonContent: '', lessonAttitude: '', teacherComment: '', evaluation: ''
    };
  }

  function mergeDailyStrict(roster, savedRows, ctx) {
    const savedMap = new Map();

    // 동일 학생의 저장 평가가 여러 건이면 가장 최근 자료만 사용합니다.
    (savedRows || []).forEach(function (saved) {
      const key = studentMatchKey(saved);
      if (!key) return;

      const previous = savedMap.get(key);

      const savedTime = Date.parse(
        saved.savedAt ||
        saved.updatedAt ||
        saved.createdAt ||
        ''
      ) || 0;

      const previousTime = previous
        ? (Date.parse(
            previous.savedAt ||
            previous.updatedAt ||
            previous.createdAt ||
            ''
          ) || 0)
        : -1;

      if (!previous || savedTime >= previousTime) {
        savedMap.set(key, saved);
      }
    });

    // 화면에는 현재 출석 명단에 존재하는 학생만 표시합니다.
    return (roster || []).map(function (source) {
      const base = dailyRosterRow(source, ctx);
      const saved = savedMap.get(studentMatchKey(base));

      if (!saved) return base;

      return Object.assign({}, base, saved, {
        date: ctx.date,
        className: base.className,
        classId: base.classId || saved.classId || '',
        teacherScopeKey: ctx.teacherScopeKey,
        studentUid: base.studentUid || saved.studentUid || '',
        studentIdentityKey:
          base.studentIdentityKey ||
          saved.studentIdentityKey ||
          '',
        instructor:
          base.instructor ||
          saved.instructor ||
          teacherNameFor(ctx.className, saved)
      });
    });
  }
  const dailyLocalEdits73116 = new Map();
  let activeDailyLoadSeq73116 = 0;

  function dailyEditContextKey73116(ctx) {
    const current = ctx || dailyContext();
    return [
      text(current.date),
      normalize(current.className),
      normalize(current.keyword),
      text(current.teacherScopeKey)
    ].join('|');
  }

  function dailyEditMapKey73116(contextKey, row) {
    return contextKey + '||' + studentMatchKey(row || {});
  }

  function dailyRows73116() {
    try {
      if (Array.isArray(global.adminDailyEvalRows)) {
        return global.adminDailyEvalRows;
      }
    } catch (ignore) {}

    try {
      if (Array.isArray(adminDailyEvalRows)) {
        return adminDailyEvalRows;
      }
    } catch (ignore) {}

    return [];
  }

  function captureDailyEditEvent73116(event) {
    const target = event && event.target;
    if (!target || typeof target.matches !== 'function') return;

    if (!target.matches(
      '.admin-eval-lesson, .admin-eval-attitude, .admin-eval-comment, .admin-daily-check'
    )) return;

    const tr = target.closest(
      '#adminDailyEvalTableWrap tr[data-daily-index]'
    );
    if (!tr) return;

    const index = Number(tr.dataset.dailyIndex);
    const base = dailyRows73116()[index];
    if (!base) return;

    const contextKey = dailyEditContextKey73116();
    const mapKey = dailyEditMapKey73116(contextKey, base);

    dailyLocalEdits73116.set(mapKey, {
      lessonContent:
        (tr.querySelector('.admin-eval-lesson') || {}).value || '',
      lessonAttitude:
        (tr.querySelector('.admin-eval-attitude') || {}).value || '',
      teacherComment:
        (tr.querySelector('.admin-eval-comment') || {}).value || '',
      checked:
        !tr.querySelector('.admin-daily-check') ||
        tr.querySelector('.admin-daily-check').checked !== false,
      __localDailyDirty73116: true
    });

    while (dailyLocalEdits73116.size > 500) {
      const oldestKey = dailyLocalEdits73116.keys().next().value;
      if (!oldestKey) break;
      dailyLocalEdits73116.delete(oldestKey);
    }
  }

  function preserveDailyEdits73116(rows) {
    const contextKey = dailyEditContextKey73116();
    const source = Array.isArray(rows) ? rows : [];
    const seen = new Set();

    const prepared = source.map(function (row) {
      const mapKey = dailyEditMapKey73116(contextKey, row);
      const draft = dailyLocalEdits73116.get(mapKey);
      seen.add(mapKey);

      return draft
        ? Object.assign({}, row, draft)
        : row;
    });

    /*
     * 동기화 도중 서버가 일시적으로 빈 명단을 반환하더라도
     * 현재 화면에서 작성 중인 학생 행은 제거하지 않습니다.
     */
    dailyRows73116().forEach(function (row) {
      const mapKey = dailyEditMapKey73116(contextKey, row);
      const draft = dailyLocalEdits73116.get(mapKey);
      if (!draft || seen.has(mapKey)) return;

      seen.add(mapKey);
      prepared.push(Object.assign({}, row, draft));
    });

    return prepared;
  }

  function clearSavedDailyEdits73116(rows, ctx) {
    const contextKey = dailyEditContextKey73116(ctx);

    (rows || []).forEach(function (row) {
      const mapKey = dailyEditMapKey73116(contextKey, row);
      const draft = dailyLocalEdits73116.get(mapKey);
      if (!draft) return;

      const same =
        text(draft.lessonContent) === text(row.lessonContent) &&
        text(draft.lessonAttitude) === text(row.lessonAttitude) &&
        text(draft.teacherComment) === text(row.teacherComment) &&
        draft.checked !== false;

      if (same) dailyLocalEdits73116.delete(mapKey);
    });
  }

  if (!global.__ULIM_DAILY_EDIT_GUARD_73116__) {
    global.__ULIM_DAILY_EDIT_GUARD_73116__ = true;
    document.addEventListener(
      'input',
      captureDailyEditEvent73116,
      true
    );
    document.addEventListener(
      'change',
      captureDailyEditEvent73116,
      true
    );
  }

  function renderDaily(rows, message) {
    const preparedRows = preserveDailyEdits73116(rows);
    try { adminDailyEvalRows = preparedRows.map(clone); global.adminDailyEvalRows = adminDailyEvalRows; } catch (ignore) {}
    try {
      const displayMessage = isFullAdmin()
        ? (message || ('Firestore 일일평가 ' + rows.length + '건'))
        : simpleCountLabel('학생', rows.length);
      if (typeof adminRenderDailyEvalRows === 'function') adminRenderDailyEvalRows(displayMessage);
      else if (typeof adminRenderDailyEvalTable === 'function') adminRenderDailyEvalTable();
    } catch (ignore) {}
  }

  global.adminLoadDailyEvalStudents = async function (forceRefresh) {
    forceRefresh = forceRefresh === true;
    if (!token()) return alert('로그인이 필요합니다.');
    const ctx = dailyContext();
    const loadSeq73116 = ++activeDailyLoadSeq73116;
    const loadContextKey73116 = dailyEditContextKey73116(ctx);
    const canRenderDailyLoad73116 = function () {
      return loadSeq73116 === activeDailyLoadSeq73116 &&
        dailyEditContextKey73116() === loadContextKey73116;
    };

    bindRevisionListener7318('daily', ctx.date);
    if (!ctx.className && !ctx.keyword) return alert('반명 또는 학생명을 입력하거나 반 목록에서 선택해주세요.');
    if (ctx.className && ctx.className !== '전체반' && !ctx.teacherScopeKey) {
      return alert('선택한 반의 담당강사를 확인하지 못했습니다. 반 목록에서 다시 선택해주세요.');
    }

    const key = cacheKey('daily', ctx);
    const cached = forceRefresh ? null : readCache(key);
    if (cached && Array.isArray(cached.rows) && canRenderDailyLoad73116()) {
      renderDaily(cached.rows, '최근 Firestore 일일평가를 먼저 표시했습니다.');
    }

    async function readAndRender(rt, message) {
      const data = await invokeStaff(rt, rt.staffOperational731.getDaily, ctx, 'getDaily');
      const roster = Array.isArray(data.roster) ? data.roster : [];
      const savedRows = Array.isArray(data.rows) ? data.rows : [];
      const rows = mergeDailyStrict(roster, savedRows, ctx);
      writeCache(key, { rows: rows });
      if (canRenderDailyLoad73116()) {
        renderDaily(rows, message || data.message || ('Firestore 학생 ' + rows.length + '명'));
      }
      return { data: data, roster: roster, savedRows: savedRows, rows: rows };
    }

    try {
      const rt = await runtime();
      if (forceRefresh && rt.staffOperational731.getClasses) {
        try {
          const classData = await invokeStaff(rt, rt.staffOperational731.getClasses, { date: ctx.date }, 'getClasses');
          if (Array.isArray(classData.classes)) applyClassListFast(ctx.date, classData.classes, true);
        } catch (classError) {
          safeConsole('warn', '[ULIM 7.31.17 daily class refresh]', classError);
        }
      }
      const result = await readAndRender(rt);
      if (!result.rows.length && !cached) {
        alert('조건에 맞는 학생 또는 일일평가 데이터가 없습니다.');
      }
      return true;
    } catch (error) {
      safeConsole('warn', '[ULIM 7.31.17 daily Firestore read]', error);
      if (!cached) {
        alert(friendlyError(error, '학생 명단 또는 일일평가를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'));
      }
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
      specialStatus: r.specialStatus || r.specialType || r.enrollmentStatus || r.studentStatus || '',
      memo: r.memo || '',
      lessonContent: r.lessonContent || '',
      lessonAttitude: r.lessonAttitude || '',
      teacherComment: r.teacherComment || '',
      videoLink: r.clearEvaluation === true ? '' : (r.videoLink || ''),
      evaluation: r.clearEvaluation === true ? '' : (r.evaluation || ''),
      clearEvaluation: r.clearEvaluation === true
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
    const saveConfirmText = isFullAdmin()
      ? ('일일평가를 Firestore에 저장하고  [' + recipientTypes.join(', ') + ']에게 ' + channelLabel + '으로 발송할까요?')
      : ('일일평가를 저장한 뒤 [' + recipientTypes.join(', ') + ']에게 ' + channelLabel + '으로 발송할까요?');
    if (sendSms && !confirm(saveConfirmText)) return false;
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
      clearSavedDailyEdits73116(compact, ctx);
      try {
        adminDailyEvalRows = (adminDailyEvalRows || []).map(function (row) {
          const saved = savedMap.get(studentMatchKey(row));
          return saved ? Object.assign({}, row, saved, { savedAt: '방금 Firestore 저장', savedBy: info().name || info().id || '' }) : row;
        });
        global.adminDailyEvalRows = adminDailyEvalRows;
      } catch (ignore) {}
      renderDaily(adminDailyEvalRows || compact, '저장 완료');
      writeCache(cacheKey('daily', ctx), { rows: adminDailyEvalRows || compact });
      if (statusEl) statusEl.textContent = isFullAdmin()
        ? (data.message || 'Firestore 저장 완료')
        : '저장 완료';
      alert(sendSms
        ? '일일평가가 저장되었고 발송이 진행됩니다.'
        : '일일평가가 저장되었습니다.');
      try {
        const draftKey = typeof global.ulimGetDailyEvalLocalDraftKey704_ === 'function' ? global.ulimGetDailyEvalLocalDraftKey704_() : '';
        if (draftKey) localStorage.removeItem(draftKey);
      } catch (ignore) {}
      return true;
    } catch (error) {
      if (statusEl) statusEl.textContent = '저장 실패';
      alert(friendlyError(error, '일일평가 저장에 실패했습니다. 입력 내용은 유지됩니다.'));
      return false;
    }
  };
  try { adminSaveDailyEvaluations = global.adminSaveDailyEvaluations; } catch (ignore) {}

  // 이전 자동저장 훅은 로컬 임시저장만 담당합니다. 명시적 평가저장만 Firestore에 반영합니다.
  global.ulimScheduleDailyEvalSheetSync704_ = function () {
    const statusEl = document.getElementById('adminDailyDraftStatus');
    if (statusEl) statusEl.textContent = isFullAdmin()
      ? '로컬 임시저장 완료 · 평가저장 시 Firestore에 즉시 반영'
      : '입력 내용 임시저장 완료';
    return false;
  };
  global.__ULIM_DAILY_AUTOSAVE_SHEET_MODE_704__ = 'FIRESTORE_EXPLICIT_SAVE_ONLY_731';

  const CLASS_CACHE_PREFIX = 'ulim_staff_classlist_7313_';
  const LEGACY_CLASS_CACHE_PREFIX = 'ulim_staff_classlist_7312_';
  let activeClassListRequestDate73116 = '';

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
      if (typeof adminFilterClassListForRole === 'function') {
        filtered = adminFilterClassListForRole(filtered);
      }
    } catch (ignore) {}

    try {
      if (typeof global.adminRememberClassListForDate704_ === 'function') {
        filtered = global.adminRememberClassListForDate704_(date, filtered);
      }
    } catch (ignore) {}

    const responseDate = text(date);
    const latestDate = text(activeClassListRequestDate73116);
    const isLatestRequest = !latestDate || responseDate === latestDate;

    // 날짜별 캐시는 과거 응답도 정상적으로 보관합니다.
    if (exact) writePersistentClassList(responseDate, filtered);

    // 늦게 도착한 과거 날짜 응답은 현재 화면을 덮어쓰지 않습니다.
    if (!isLatestRequest) {
      try {
        if (typeof adminRenderClassSelectors === 'function') {
          adminRenderClassSelectors();
        }
      } catch (ignore) {}

      if (exact) {
        try {
          if (typeof adminClearInvalidClassSelection704_ === 'function') {
            adminClearInvalidClassSelection704_(responseDate);
          }
        } catch (ignore) {}
      }

      return filtered;
    }

    try {
      adminClassList = filtered;
      global.adminClassList = filtered;
    } catch (ignore) {}

    try {
      if (typeof getAdminClassListCacheKey === 'function') {
        adminClassListLoadedKey = getAdminClassListCacheKey(responseDate);
        if (typeof writeAdminClassListCache === 'function') {
          writeAdminClassListCache(adminClassListLoadedKey, filtered);
        }
      }
    } catch (ignore) {}

    try {
      if (typeof adminRenderClassSelectors === 'function') {
        adminRenderClassSelectors();
      }
    } catch (ignore) {}

    if (exact) {
      try {
        if (typeof adminClearInvalidClassSelection704_ === 'function') {
          adminClearInvalidClassSelection704_(responseDate);
        }
      } catch (ignore) {}
    }

    return filtered;
  }
  global.adminLoadClassList = async function (dateOverride, force) {
    if (!token()) return [];
    const date = text(dateOverride)
      || text(document.getElementById('adminAttendanceDate') && document.getElementById('adminAttendanceDate').value)
      || text(document.getElementById('adminDailyEvalDate') && document.getElementById('adminDailyEvalDate').value)
      || localDateText();
    force = force === true;
    activeClassListRequestDate73116 = date;

    let immediate = force ? [] : readPersistentClassList(date);
    if ((!immediate || !immediate.length) && !force) {
      try {
        const sessionKey = typeof getAdminClassListCacheKey === 'function' ? getAdminClassListCacheKey(date) : '';
        immediate = sessionKey && typeof readAdminClassListCache === 'function'
          ? readAdminClassListCache(sessionKey)
          : null;
      } catch (ignore) {}
    }
    if (Array.isArray(immediate) && immediate.length) applyClassListFast(date, immediate, true);

    const requestKey = 'classes|' + date + '|' + (force ? 'refresh' : 'normal');
    if (inflight.has(requestKey)) return inflight.get(requestKey);

    const promise = (async function () {
      const rt = await runtime();
      try {
        const classData = await invokeStaff(rt, rt.staffOperational731.getClasses, { date: date }, 'getClasses');
        const classes = Array.isArray(classData.classes) ? classData.classes : [];
        applyClassListFast(date, classes, true);
        return classes;
      } catch (error) {
        safeConsole('warn', '[ULIM 7.31.17 Firestore class list]', error);
        if (!immediate || !immediate.length) applyClassListFast(date, [], true);
        return Array.isArray(immediate) ? immediate : [];
      }
    })().finally(function () {
      inflight.delete(requestKey);
    });

    inflight.set(requestKey, promise);
    return promise;
  };
  try { adminLoadClassList = global.adminLoadClassList; } catch (ignore) {}

  // Deprecated compatibility alias retained for older callers.
  // It performs Firestore refresh only and never calls GAS/Sheets.
  global.ulimRefreshStaffOperationalDateFromSheets731 = async function (date, reason, force, datasets) {
    const target = text(date || attendanceContext().date || localDateText());
    await global.adminLoadClassList(target, true);
    await global.adminLoadAttendanceSnapshot(false, true);
    return { status: 'success', state: 'complete', dataAuthority: 'firestore', date: target };
  };

  let autoBootstrapStarted = false;
  async function autoBootstrapTodayIfNeeded() {
    if (autoBootstrapStarted || !token()) return false;
    autoBootstrapStarted = true;
    try {
      const rt = await runtime();
      const date = localDateText();
      const classData = await invokeStaff(rt, rt.staffOperational731.getClasses, { date: date }, 'getClasses');
      if (Array.isArray(classData.classes)) applyClassListFast(date, classData.classes, true);
      return true;
    } catch (error) {
      autoBootstrapStarted = false;
      safeConsole('warn', '[ULIM 7.31.17 Firestore bootstrap]', error);
      return false;
    }
  }

  async function firebaseStaffClaimsReady73111(rt) {
    try {
      if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || typeof rt.sdk.getIdTokenResult !== 'function') return false;
      const tokenResult = await rt.sdk.getIdTokenResult(rt.auth.currentUser, false);
      const claims = tokenResult && tokenResult.claims || {};
      const role = text(claims.role);
      const authVersion = claims.authVersion;
      if (['teacher', 'admin', 'superAdmin'].indexOf(role) < 0) return false;
      if (!(typeof authVersion === 'number' || (typeof authVersion === 'string' && authVersion.length > 0))) return false;
      if (role === 'teacher' && !text(claims.teacherUid)) return false;
      return true;
    } catch (ignore) {
      return false;
    }
  }

  function revisionContext73116(kind) {
    const ctx = kind === 'attendance' ? attendanceContext() : dailyContext();
    return {
      date: text(ctx && ctx.date) || localDateText(),
      classId: text(ctx && ctx.classId)
    };
  }

  function revisionScopeId73116(date, classId) {
    return classId ? date + '__' + String(classId) : date;
  }

  function scheduleRevisionReload7318(kind, date, classId, revision) {
    const state = revisionListeners7318[kind];
    if (!state || state.date !== date || text(state.classId) !== text(classId)) return;
    if (state.reloadTimer) clearTimeout(state.reloadTimer);
    state.reloadTimer = setTimeout(function () {
      state.reloadTimer = null;
      const current = revisionContext73116(kind);
      if (current.date !== date || (classId && current.classId !== classId)) return;
      if (kind === 'attendance') {
        const select = document.getElementById('adminAttendanceClass');
        if (select && text(select.value) && typeof global.adminLoadAttendanceSnapshot === 'function') {
          global.adminLoadAttendanceSnapshot(false, false).catch(function (error) {
            safeConsole('warn', '[ULIM 7.31.16 attendance realtime reload]', error);
          });
        }
      } else {
        const select = document.getElementById('adminDailyEvalClass');
        if (select && text(select.value) && typeof global.adminLoadDailyEvalStudents === 'function') {
          global.adminLoadDailyEvalStudents(false).catch(function (error) {
            safeConsole('warn', '[ULIM 7.31.16 daily realtime reload]', error);
          });
        }
      }
    }, 180);
  }

  async function bindRevisionListener7318(kind, date, classId, forceDateScope) {
    const targetDate = text(date) || localDateText();
    const targetClassId = forceDateScope ? '' : text(classId);
    const scopeId = revisionScopeId73116(targetDate, targetClassId);
    const state = revisionListeners7318[kind];
    if (!state) return;
    if (Date.now() < Number(state.blockedUntil || 0)) return;
    if (state.scopeId === scopeId && typeof state.unsubscribe === 'function') return;
    if (typeof state.unsubscribe === 'function') {
      try { state.unsubscribe(); } catch (ignore) {}
    }
    if (state.reloadTimer) clearTimeout(state.reloadTimer);
    state.date = targetDate;
    state.classId = targetClassId;
    state.scopeId = scopeId;
    state.unsubscribe = null;
    state.initialized = false;
    state.lastRevision = 0;

    try {
      const rt = await runtime();
      if (!(await firebaseStaffClaimsReady73111(rt))) {
        state.blockedUntil = Date.now() + 1200;
        return;
      }
      const collectionName = targetClassId ? 'staffOperationalClassRevisions' : 'staffOperationalRevisions';
      const ref = rt.sdk.doc(rt.db, collectionName, scopeId);
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
        scheduleRevisionReload7318(kind, targetDate, targetClassId, revision);
      }, function (error) {
        state.unsubscribe = null;
        const code = text(error && error.code).toLowerCase();
        if (code.indexOf('permission-denied') >= 0 && targetClassId) {
          state.blockedUntil = 0;
          bindRevisionListener7318(kind, targetDate, '', true).catch(function () {});
          return;
        }
        if (code.indexOf('permission-denied') >= 0) {
          state.blockedUntil = Date.now() + 3000;
          return;
        }
        safeConsole('warn', '[ULIM 7.31.16 ' + kind + ' revision listener]', error);
      });
    } catch (error) {
      state.blockedUntil = Date.now() + 1500;
      safeConsole('warn', '[ULIM 7.31.16 revision bind]', kind, error);
    }
  }

  function ensureRevisionListeners7318() {
    if (revisionEnsurePromise73112) return revisionEnsurePromise73112;
    revisionEnsurePromise73112 = (async function () {
      const rt = await runtime().catch(function () { return null; });
      if (!rt || !(await firebaseStaffClaimsReady73111(rt))) return false;
      const attendanceRevision = revisionContext73116('attendance');
      const dailyRevision = revisionContext73116('daily');
      await Promise.all([
        bindRevisionListener7318('attendance', attendanceRevision.date, attendanceRevision.classId, false),
        bindRevisionListener7318('daily', dailyRevision.date, dailyRevision.classId, false)
      ]);
      return true;
    })().finally(function () { revisionEnsurePromise73112 = null; });
    return revisionEnsurePromise73112;
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
      state.classId = '';
      state.scopeId = '';
      state.unsubscribe = null;
      state.initialized = false;
      state.lastRevision = 0;
      state.reloadTimer = null;
      state.blockedUntil = 0;
    });
  }

  function installRevisionDateHandlers7318() {
    ['adminAttendanceDate', 'adminDailyEvalDate', 'adminAttendanceClass', 'adminDailyEvalClass'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el || el.dataset.ulimRevisionListener7318 === '1') return;
      el.dataset.ulimRevisionListener7318 = '1';
      el.addEventListener('change', function () { setTimeout(ensureRevisionListeners7318, 0); });
    });
  }

  function prewarm() {
    installRevisionDateHandlers7318();

    // 로그인 전에는 보호 데이터/리스너를 시작하지 않습니다.
    if (!token()) return;

    /*
     * token이 생겼다는 이유만으로 class list/revision listener를 먼저 열지 않습니다.
     * Firebase Auth 완료 이벤트(ulim-firebase-auth-ready)가 실제 조회를 시작합니다.
     */
    try {
      const room = global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727;
      if (room && typeof room.ensureAuthenticated === 'function') {
        room.ensureAuthenticated().catch(function (error) {
          safeConsole('warn', '[ULIM 7.31.12 auth prewarm]', error);
        });
      }
    } catch (ignore) {}
  }
  function retryPrewarm(attempt) {
    prewarm();
    if (!token() && attempt < 40) {
      setTimeout(function () { retryPrewarm(attempt + 1); }, 750);
    }
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
      Promise.resolve(ensureRevisionListeners7318()).catch(function () {});
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
  style.id = 'ulim-staff-firestore-operational-73111-style';
  style.textContent = '.ulim-firestore-sync-note-731{font-size:11px;font-weight:800;color:#047857}';
  document.head.appendChild(style);
})(typeof window !== 'undefined' ? window : globalThis);
