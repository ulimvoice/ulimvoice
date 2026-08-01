(function (global) {
  'use strict';

  if (global.__ULIM_STAFF_FIRESTORE_OPERATIONAL_73116__) return;
  global.__ULIM_STAFF_FIRESTORE_OPERATIONAL_73116__ = true;

  const VERSION = '2026-08-02.731.16-independent-context';
  const CACHE_PREFIX = 'ulim_staff_fsop_73116e1_';
  const inflight = new Map();
  let runtimePromise = null;
  let revisionEnsurePromise73112 = null;
  const revisionListeners7318 = {
    attendance: {
      date: '', classId: '', scopeId: '', unsubscribe: null,
      initialized: false, lastRevision: 0, reloadTimer: null,
      blockedUntil: 0, reloadInFlight: false, pendingRevision: 0,
      lastReloadAt: 0
    },
    daily: {
      date: '', classId: '', scopeId: '', unsubscribe: null,
      initialized: false, lastRevision: 0, reloadTimer: null,
      blockedUntil: 0, reloadInFlight: false, pendingRevision: 0,
      lastReloadAt: 0
    }
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
    const current = ctx || {};
    const item = currentClassItem(current.className || '', current.date || '');
    return Array.from(new Set([
      teacherIdentityKey7318(current.teacherScopeKey || ''),
      teacherIdentityKey7318(
        teacherNameFor(current.className || '', item, current.date || '')
      ),
      teacherIdentityKey7318(
        item && (item.teacher || item.instructor || item.instructorName) || ''
      )
    ].filter(Boolean)));
  }
  function rowTeacherKeys7318(row, fallbackDate) {
    const r = row || {};
    const rowDate = r.date || r.classDate || r.sessionDate || fallbackDate || '';
    return Array.from(new Set([
      teacherIdentityKey7318(r.teacherScopeKey || r.evaluatorTeacherKey || ''),
      teacherIdentityKey7318(r.instructor || r.instructorName || r.teacher || r.teacherName || ''),
      teacherIdentityKey7318(
        teacherNameFor(r.className || r.currentClass || '', r, rowDate)
      )
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

  function attendanceViewContextKey73116(ctx) {
    const current = ctx || attendanceContext();
    return [
      text(current.date),
      normalize(current.className),
      normalize(current.keyword),
      normalize(current.statusFilter)
    ].join('|');
  }

  function dailyViewContextKey73116(ctx) {
    const current = ctx || dailyContext();
    return [
      text(current.date),
      normalize(current.className),
      normalize(current.keyword)
    ].join('|');
  }

  function cacheKey(kind, ctx) {
    const viewKey = kind === 'attendance'
      ? attendanceViewContextKey73116(ctx)
      : dailyViewContextKey73116(ctx);
    return CACHE_PREFIX + kind + '_' + owner() + '_' +
      viewKey.split('|').map(function (v) {
        return normalize(v).slice(0, 120);
      }).join('__');
  }

  async function refreshContextClassMetadata73116(kind, ctx) {
    let current = Object.assign({}, ctx || {});
    const className = text(current.className);
    if (!className || className === '전체반') return current;
    if (text(current.classId) && text(current.teacherScopeKey)) return current;

    try {
      if (typeof global.adminLoadClassList === 'function') {
        await global.adminLoadClassList(current.date, false);
      } else if (typeof adminLoadClassList === 'function') {
        await adminLoadClassList(current.date, false);
      }
    } catch (ignore) {}

    const refreshed = kind === 'attendance'
      ? attendanceContext()
      : dailyContext();

    if (
      text(refreshed.date) === text(current.date) &&
      normalize(refreshed.className) === normalize(current.className)
    ) {
      current = refreshed;
    }
    return current;
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
      const rowKeys = rowTeacherKeys7318(row, ctx.date);
      return selectedKeys.length > 0 && rowKeys.length > 0 && teacherKeysMatch7318(selectedKeys, rowKeys);
    });
  }

  const attendanceLocalEdits73116 = new Map();
  let activeAttendanceLoadSeq73116 = 0;
  let activeAttendanceLoadContextKey73116 = '';

  function attendanceEditContextKey73116(ctx) {
    return attendanceViewContextKey73116(ctx);
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

  function preserveAttendanceEdits73116(records, ctx) {
    const contextKey = attendanceEditContextKey73116(ctx);
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

  let lastAttendanceRenderedContextKey73116 = '';

  function renderAttendance(records, message, ctx) {
    const renderContext = ctx || attendanceContext();
    const preparedRecords = preserveAttendanceEdits73116(records, renderContext);
    try {
      adminAttendanceRecords = preparedRecords.map(clone);
      global.adminAttendanceRecords = adminAttendanceRecords;
    } catch (ignore) {}
    lastAttendanceRenderedContextKey73116 =
      attendanceViewContextKey73116(renderContext);
    try {
      if (typeof adminRenderAttendanceTable === 'function') {
        adminRenderAttendanceTable();
      }
    } catch (ignore) {}
    const count = preparedRecords.length;
    setAttendanceSummary(
      message || ('Firestore 출석부 ' + count + '건'),
      simpleCountLabel('학생', count)
    );
  }

  global.adminLoadAttendanceSnapshot = async function (showAlert, forceSheetSync) {
    if (!token()) return false;
    showAlert = showAlert !== false;
    forceSheetSync = forceSheetSync === true;

    let ctx = attendanceContext();
    const initialViewKey73116 = attendanceViewContextKey73116(ctx);
    ctx = await refreshContextClassMetadata73116('attendance', ctx);

    /*
     * 반 목록 메타데이터를 기다리는 사이 사용자가 날짜나 반을 바꿨다면
     * 이전 화면 요청은 시작하지 않습니다.
     */
    if (attendanceViewContextKey73116() !== initialViewKey73116) return false;

    const loadContextKey73116 = attendanceViewContextKey73116(ctx);
    const key = cacheKey('attendance', ctx);
    const requestKey =
      'attendance|' + key + '|' + (forceSheetSync ? 'sheet' : 'firestore');

    if (inflight.has(requestKey)) return inflight.get(requestKey);

    activeAttendanceLoadContextKey73116 = loadContextKey73116;
    const loadSeq73116 = ++activeAttendanceLoadSeq73116;
    const canRenderAttendanceLoad73116 = function () {
      return (
        loadSeq73116 === activeAttendanceLoadSeq73116 &&
        attendanceViewContextKey73116() === loadContextKey73116
      );
    };

    bindRevisionListener7318('attendance', ctx.date, '', true);

    const cached = readCache(key);
    const silentRealtime73116 = showAlert === false && forceSheetSync === false;
    const alreadyRendered73116 =
      lastAttendanceRenderedContextKey73116 === loadContextKey73116 &&
      attendanceRows73116().length > 0;

    if (
      Array.isArray(cached) &&
      canRenderAttendanceLoad73116() &&
      (!silentRealtime73116 || !alreadyRendered73116)
    ) {
      renderAttendance(
        cached,
        forceSheetSync
          ? '최근 출석부를 표시했습니다. Google Sheets 원본을 확인 중입니다...'
          : '최근 Firestore 출석부를 먼저 표시했습니다.',
        ctx
      );
    }

    const promise = (async function () {
      let sheetSyncError = null;
      try {
        const rt = await runtime();
        let sheetSyncResult = null;

        if (forceSheetSync) {
          if (canRenderAttendanceLoad73116()) {
            setAttendanceSummary('Google Sheets 원본 → Firestore 동기화 중...');
          }
          try {
            sheetSyncResult = await syncDateFromSheets(
              rt,
              ctx.date,
              'attendance_button_refresh',
              true,
              ['attendance']
            );
            if (rt.staffOperational731.getClasses) {
              const classData = await invokeStaff(
                rt,
                rt.staffOperational731.getClasses,
                { date: ctx.date },
                'getClasses'
              );
              if (Array.isArray(classData.classes) && classData.classes.length) {
                applyClassListFast(ctx.date, classData.classes, true);
              }
            }
          } catch (error) {
            sheetSyncError = error;
            safeConsole('warn', '[ULIM 7.31.3 attendance sheet refresh]', error);
          }
        }

        let data = await invokeStaff(
          rt,
          rt.staffOperational731.getAttendance,
          ctx,
          'getAttendance'
        );
        let records = Array.isArray(data.records) ? data.records : [];

        if (
          !records.length &&
          data.queryOptimized !== true &&
          (ctx.className || ctx.classId)
        ) {
          try {
            const broadData = await invokeStaff(
              rt,
              rt.staffOperational731.getAttendance,
              {
                date: ctx.date,
                className: '전체반',
                classId: '',
                teacherScopeKey: ctx.teacherScopeKey || '',
                keyword: ctx.keyword || '',
                statusFilter: ctx.statusFilter || ''
              },
              'getAttendance'
            );
            const broadRecords = Array.isArray(broadData.records)
              ? broadData.records
              : [];
            const matched = filterAttendanceForSelectedClass(
              broadRecords,
              ctx
            );
            if (matched.length) {
              records = matched;
              data = Object.assign({}, broadData, {
                records: matched,
                count: matched.length,
                message:
                  'Firestore 출석부 ' +
                  matched.length +
                  '건 · classId/반명 자동매칭'
              });
            }
          } catch (broadError) {
            safeConsole(
              'warn',
              '[ULIM 7.31.6 attendance broad fallback]',
              broadError
            );
          }
        }

        if (!records.length && !forceSheetSync) {
          if (canRenderAttendanceLoad73116() && !silentRealtime73116) {
            setAttendanceSummary('오늘 출석부 최초 자동적재 중...');
          }
          const refreshed = await bootstrapDateOnce(
            rt,
            ctx.date,
            'attendance_empty_bootstrap',
            ['attendance']
          );
          if (refreshed) {
            data = await invokeStaff(
              rt,
              rt.staffOperational731.getAttendance,
              ctx,
              'getAttendance'
            );
            records = Array.isArray(data.records) ? data.records : [];
          }
        }

        writeCache(key, records);

        const syncClassCount = sheetSyncResult
          ? Number(sheetSyncResult.classCount || 0)
          : 0;
        const message = sheetSyncError
          ? (
              '시트 동기화 실패 · 기존 Firestore 출석부 ' +
              records.length +
              '건 표시'
            )
          : (
              forceSheetSync
                ? (
                    '시트 원본 동기화 완료 · 반 ' +
                    syncClassCount +
                    '개 · 선택 반 출석부 ' +
                    records.length +
                    '건'
                  )
                : (
                    data.message ||
                    ('Firestore 출석부 ' + records.length + '건')
                  )
            );

        if (canRenderAttendanceLoad73116()) {
          renderAttendance(records, message, ctx);
        }

        if (sheetSyncError && showAlert) {
          alert(
            isFullAdmin()
              ? (
                  'Google Sheets 원본 동기화에 실패했습니다. 기존 Firestore 자료를 표시합니다.\n' +
                  (sheetSyncError.message || String(sheetSyncError))
                )
              : '최신 출석부 확인에 실패했습니다. 현재 표시된 출석부를 계속 사용합니다.'
          );
        } else if (showAlert && !records.length) {
          alert(
            forceSheetSync
              ? 'Google Sheets 원본 동기화는 완료됐지만 선택한 반의 출석 학생을 찾지 못했습니다. 반 목록을 다시 선택한 뒤 확인해주세요.'
              : '조건에 맞는 출석부 데이터가 없습니다. 날짜/반명/학생명을 확인해주세요.'
          );
        }
        return true;
      } catch (error) {
        safeConsole(
          'warn',
          '[ULIM 7.31.3 attendance Firestore read]',
          error
        );
        if (!cached && canRenderAttendanceLoad73116()) {
          setAttendanceSummary(
            '출석부 조회 실패 · 네트워크 연결을 확인해주세요.',
            '출석부를 불러오지 못했습니다.'
          );
          if (showAlert) {
            alert(
              friendlyError(
                error,
                '출석부를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
              )
            );
          }
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
    classId: r.classId || ctx.classId || '',
    teacherScopeKey:
      r.teacherScopeKey ||
      ctx.teacherScopeKey ||
      teacherScope(r.className || ctx.className, r, r.date || ctx.date),
    teacherUid: r.teacherUid || '',
    instructor:
      r.instructor ||
      r.instructorName ||
      teacherNameFor(r.className || ctx.className, r, r.date || ctx.date),
    instructorName:
      r.instructorName ||
      r.instructor ||
      teacherNameFor(r.className || ctx.className, r, r.date || ctx.date),
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

  async function pollSync(requestIdValue, kind, summaryEl) {
    const delays = [2500, 6000, 12000, 25000];
    for (let i = 0; i < delays.length; i++) {
      await new Promise(function (resolve) { setTimeout(resolve, delays[i]); });
      try {
        const rt = await runtime();
        const status = await invokeStaff(rt, rt.staffOperational731.getSyncStatus, { requestId: requestIdValue }, 'getSyncStatus');
        if (status.state === 'complete' || status.state === 'partial' || status.state === 'failed') {
          if (summaryEl && isFullAdmin()) {
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
      clearSavedAttendanceEdits73116(compact, attendanceContext());
      setAttendanceState(compact, '저장됨 · 시트전송중', false);
      const summary = document.getElementById('adminAttendanceSummary');
      setAttendanceSummary(data.message || ('출석 ' + compact.length + '건 Firestore 저장 완료 · 시트 백그라운드 전송 중'), '저장 완료');
      const ctx = attendanceContext();
      writeCache(cacheKey('attendance', ctx), typeof adminAttendanceRecords !== 'undefined' ? adminAttendanceRecords : compact);
      pollSync(rid, '출석', summary).catch(function () {});
      if (!silent) alert(isFullAdmin()
        ? (data.message || '출석이 Firestore에 저장되었고 Google Sheets로 백그라운드 전송됩니다.')
        : '출석부가 저장되었습니다.');
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

    if (text(r.studentIdentityKey || r.identityKey)) {
      return 'KEY|' + text(r.studentIdentityKey || r.identityKey);
    }

    if (text(r.studentUid || r.studentUID || r.uidV2 || r.uid)) {
      return 'UID|' + text(r.studentUid || r.studentUID || r.uidV2 || r.uid);
    }

    const phone = text(r.studentPhone || r.phone).replace(/\D/g, '');
    if (phone.length >= 8) {
      return 'PHONE|' + phone;
    }

    if (text(r.studentNo || r.attendanceNo)) {
      return 'NO|' + normalize(r.studentNo || r.attendanceNo);
    }

    return 'NAME|' +
      normalize(r.studentName || r.name) +
      '|' +
      classCoreKey(r.className || r.currentClass);
  }

  function dailyMatchKeys73116(row) {
    const r = row || {};
    const keys = [];
    const add = function (value) {
      const key = text(value);
      if (key && keys.indexOf(key) < 0) keys.push(key);
    };

    [
      r.studentIdentityKey,
      r.identityKey,
      r.studentUid,
      r.studentUID,
      r.uidV2,
      r.uid
    ].forEach(function (value) {
      const stable = text(value);
      if (!stable) return;
      add('KEY|' + stable);
      add('UID|' + stable);
    });

    const phone = text(r.studentPhone || r.phone).replace(/\D/g, '');
    if (phone.length >= 8) add('PHONE|' + phone);

    const no = normalize(r.studentNo || r.attendanceNo);
    const classKey = classCoreKey(r.className || r.currentClass);
    const nameKey = normalize(r.studentName || r.name);

    if (no && classKey && nameKey) add('NOCLASSNAME|' + no + '|' + classKey + '|' + nameKey);
    if (no && nameKey) add('NONAME|' + no + '|' + nameKey);
    if (classKey && nameKey) add('CLASSNAME|' + classKey + '|' + nameKey);
    if (nameKey) add('NAME|' + nameKey);

    return keys;
  }

  function dailySavedTime73116(row) {
    const r = row || {};
    return Date.parse(
      r.savedAt ||
      r.updatedAt ||
      r.createdAt ||
      ''
    ) || Number(r.savedRow || r.rowNumber || 0) || 0;
  }

  function preferDailySaved73116(previous, candidate) {
    if (!previous) return candidate;
    if (!candidate) return previous;
    return dailySavedTime73116(candidate) >= dailySavedTime73116(previous)
      ? candidate
      : previous;
  }

  function dailyRosterRow(row, ctx) {
    const r = row || {};
    const rowDate = r.date || r.sessionDate || r.classDate || ctx.date;
    const rowClass = r.className || r.currentClass || ctx.className;
    return {
      date: rowDate,
      className: rowClass,
      classId: r.classId || ctx.classId || '',
      teacherScopeKey: r.teacherScopeKey || ctx.teacherScopeKey,
      teacherUid: r.teacherUid || '',
      instructor:
        r.instructor ||
        r.instructorName ||
        teacherNameFor(rowClass, r, rowDate),
      studentUid: r.studentUid || r.studentUID || '',
      studentIdentityKey: r.studentIdentityKey || r.identityKey || '',
      studentName: r.studentName || r.name || '',
      name: r.name || r.studentName || '',
      studentNo: r.studentNo || r.attendanceNo || '',
      attendanceNo: r.attendanceNo || r.studentNo || '',
      studentPhone: r.studentPhone || r.phone || '',
      parentPhone: r.parentPhone || '',
      attendanceStatus: r.attendanceStatus || r.status || '',
      specialStatus: r.specialStatus || r.specialType || r.enrollmentStatus || r.studentStatus || '',
      memo: r.memo || '',
      videoLink:
        r.videoLink ||
        (typeof adminGetVideoLinkForClassName_ === 'function'
          ? adminGetVideoLinkForClassName_(rowClass)
          : ''),
      lessonContent: '',
      lessonAttitude: '',
      teacherComment: '',
      evaluation: ''
    };
  }

  function mergeDailyStrict(roster, savedRows, ctx) {
    const rosterRows = Array.isArray(roster) ? roster : [];
    const savedList = Array.isArray(savedRows) ? savedRows : [];
    const savedMap = new Map();
    const savedByName = new Map();

    savedList.forEach(function (saved) {
      dailyMatchKeys73116(saved).forEach(function (key) {
        if (key.indexOf('NAME|') === 0) return;
        savedMap.set(
          key,
          preferDailySaved73116(savedMap.get(key), saved)
        );
      });

      const nameKey = normalize(saved && (saved.studentName || saved.name));
      if (nameKey) {
        const list = savedByName.get(nameKey) || [];
        list.push(saved);
        savedByName.set(nameKey, list);
      }
    });

    /*
     * 이름 단독 매칭은 같은 이름 학생이 현재 명단에 한 명이고,
     * 저장 자료의 전화번호·학생번호·반명이 서로 충돌하지 않을 때만 허용합니다.
     */
    const rosterNameCount = new Map();
    rosterRows.forEach(function (row) {
      const nameKey = normalize(row && (row.studentName || row.name));
      if (nameKey) rosterNameCount.set(nameKey, Number(rosterNameCount.get(nameKey) || 0) + 1);
    });

    const uniqueSavedByName = new Map();
    savedByName.forEach(function (list, nameKey) {
      const phones = new Set();
      const numbers = new Set();
      const classes = new Set();
      let latest = null;

      list.forEach(function (saved) {
        const phone = text(saved && (saved.studentPhone || saved.phone)).replace(/\D/g, '');
        const no = normalize(saved && (saved.studentNo || saved.attendanceNo));
        const classKey = classCoreKey(saved && (saved.className || saved.currentClass));
        if (phone.length >= 8) phones.add(phone);
        if (no) numbers.add(no);
        if (classKey) classes.add(classKey);
        latest = preferDailySaved73116(latest, saved);
      });

      if (
        Number(rosterNameCount.get(nameKey) || 0) === 1 &&
        phones.size <= 1 &&
        numbers.size <= 1 &&
        classes.size <= 1
      ) {
        uniqueSavedByName.set(nameKey, latest);
      }
    });

    if (!rosterRows.length) {
      return savedList.map(function (saved) {
        return Object.assign(
          {},
          dailyRosterRow(saved, ctx),
          saved,
          {
            date: ctx.date,
            className: saved.className || ctx.className,
            classId: saved.classId || ctx.classId || '',
            teacherScopeKey: saved.teacherScopeKey || ctx.teacherScopeKey || ''
          }
        );
      });
    }

    return rosterRows.map(function (source) {
      const base = dailyRosterRow(source, ctx);
      let saved = null;

      const keys = dailyMatchKeys73116(base);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (key.indexOf('NAME|') === 0) continue;
        if (savedMap.has(key)) {
          saved = savedMap.get(key);
          break;
        }
      }

      if (!saved) {
        const nameKey = normalize(base.studentName || base.name);
        saved = uniqueSavedByName.get(nameKey) || null;
      }

      if (!saved) return base;

      return Object.assign({}, base, saved, {
        date: ctx.date,
        className: base.className || saved.className || ctx.className,
        classId: base.classId || saved.classId || ctx.classId || '',
        teacherScopeKey:
          ctx.teacherScopeKey ||
          base.teacherScopeKey ||
          saved.teacherScopeKey ||
          '',
        studentUid: base.studentUid || saved.studentUid || saved.studentUID || '',
        studentIdentityKey:
          base.studentIdentityKey ||
          saved.studentIdentityKey ||
          saved.identityKey ||
          '',
        instructor:
          base.instructor ||
          saved.instructor ||
          saved.instructorName ||
          teacherNameFor(ctx.className, saved, ctx.date)
      });
    });
  }

  const dailyLocalEdits73116 = new Map();
  let activeDailyLoadSeq73116 = 0;

  function dailyEditContextKey73116(ctx) {
    return dailyViewContextKey73116(ctx);
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

  function preserveDailyEdits73116(rows, ctx) {
    const contextKey = dailyEditContextKey73116(ctx);
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

  let lastDailyRenderedContextKey73116 = '';

  function renderDaily(rows, message, ctx) {
    const renderContext = ctx || dailyContext();
    const preparedRows = preserveDailyEdits73116(rows, renderContext);
    try {
      adminDailyEvalRows = preparedRows.map(clone);
      global.adminDailyEvalRows = adminDailyEvalRows;
    } catch (ignore) {}
    lastDailyRenderedContextKey73116 =
      dailyViewContextKey73116(renderContext);
    try {
      const displayMessage = isFullAdmin()
        ? (
            message ||
            ('Firestore 일일평가 ' + preparedRows.length + '건')
          )
        : simpleCountLabel('학생', preparedRows.length);
      if (typeof adminRenderDailyEvalRows === 'function') {
        adminRenderDailyEvalRows(displayMessage);
      } else if (typeof adminRenderDailyEvalTable === 'function') {
        adminRenderDailyEvalTable();
      }
    } catch (ignore) {}
  }

  global.adminLoadDailyEvalStudents = async function (forceSheetSync) {
    forceSheetSync = forceSheetSync === true;
    if (!token()) return alert('로그인이 필요합니다.');

    let ctx = dailyContext();
    const initialViewKey73116 = dailyViewContextKey73116(ctx);
    ctx = await refreshContextClassMetadata73116('daily', ctx);

    if (dailyViewContextKey73116() !== initialViewKey73116) return false;

    if (!ctx.className && !ctx.keyword) {
      return alert(
        '반명 또는 학생명을 입력하거나 반 목록에서 선택해주세요.'
      );
    }
    if (
      ctx.className &&
      ctx.className !== '전체반' &&
      !ctx.teacherScopeKey
    ) {
      return alert(
        '선택한 반의 담당강사를 확인하지 못했습니다. 반 목록에서 다시 선택해주세요.'
      );
    }

    const loadContextKey73116 = dailyViewContextKey73116(ctx);
    const loadSeq73116 = ++activeDailyLoadSeq73116;
    const canRenderDailyLoad73116 = function () {
      return (
        loadSeq73116 === activeDailyLoadSeq73116 &&
        dailyViewContextKey73116() === loadContextKey73116
      );
    };

    bindRevisionListener7318('daily', ctx.date, '', true);

    const key = cacheKey('daily', ctx);
    const cached = readCache(key);
    const silentRealtime73116 = forceSheetSync === false;
    const alreadyRendered73116 =
      lastDailyRenderedContextKey73116 === loadContextKey73116 &&
      dailyRows73116().length > 0;

    if (
      cached &&
      Array.isArray(cached.rows) &&
      canRenderDailyLoad73116() &&
      (!silentRealtime73116 || !alreadyRendered73116)
    ) {
      renderDaily(
        cached.rows,
        forceSheetSync
          ? '최근 학생 명단을 즉시 표시했습니다. 시트 원본을 백그라운드에서 확인합니다...'
          : '최근 Firestore 일일평가를 먼저 표시했습니다.',
        ctx
      );
    }

    let attendanceSyncError = null;
    let dailySyncError = null;

    async function readAndRender(rt, message) {
      const data = await invokeStaff(
        rt,
        rt.staffOperational731.getDaily,
        ctx,
        'getDaily'
      );
      const roster = Array.isArray(data.roster) ? data.roster : [];
      const savedRows = Array.isArray(data.rows) ? data.rows : [];
      const rows = mergeDailyStrict(roster, savedRows, ctx);
      writeCache(key, { rows: rows });
      if (canRenderDailyLoad73116()) {
        renderDaily(
          rows,
          message ||
            data.message ||
            ('Firestore 학생 ' + rows.length + '명'),
          ctx
        );
      }
      return {
        data: data,
        roster: roster,
        savedRows: savedRows,
        rows: rows
      };
    }

    try {
      const rt = await runtime();

      if (forceSheetSync) {
        if (
          canRenderDailyLoad73116() &&
          cached &&
          Array.isArray(cached.rows) &&
          !alreadyRendered73116
        ) {
          renderDaily(
            cached.rows,
            '출석부 명단을 먼저 동기화하는 중...',
            ctx
          );
        } else {
          const statusEl =
            document.getElementById('adminDailyDraftStatus');
          if (statusEl && canRenderDailyLoad73116()) {
            statusEl.textContent =
              '출석부 명단과 저장 평가 원본을 동기화하는 중...';
          }
        }

        const attendanceSyncPromise = syncDateFromSheets(
          rt,
          ctx.date,
          'daily_roster_attendance_refresh',
          true,
          ['attendance']
        ).catch(function (error) {
          attendanceSyncError = error;
          safeConsole(
            'warn',
            '[ULIM 7.31.3 daily attendance sheet refresh]',
            error
          );
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
          safeConsole(
            'warn',
            '[ULIM 7.31.3 daily evaluation sheet refresh]',
            error
          );
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
          : await readAndRender(
              rt,
              '시트 원본 동기화 완료 · 학생 및 담당강사 평가 반영'
            );

        if (
          (attendanceSyncError || dailySyncError) &&
          !finalResult.rows.length
        ) {
          const messages = [];
          if (attendanceSyncError) {
            messages.push(
              '출석부: ' +
                (attendanceSyncError.message ||
                  String(attendanceSyncError))
            );
          }
          if (dailySyncError) {
            messages.push(
              '일일평가: ' +
                (dailySyncError.message ||
                  String(dailySyncError))
            );
          }
          alert(
            isFullAdmin()
              ? (
                  'Google Sheets 원본 동기화 일부가 실패했습니다.\n' +
                  messages.join('\n')
                )
              : '최신 학생 명단 또는 평가 확인에 실패했습니다. 잠시 후 다시 시도해주세요.'
          );
        }
        return true;
      }

      let result = await readAndRender(rt);

      if (!result.roster.length) {
        const statusEl =
          document.getElementById('adminDailyDraftStatus');
        if (statusEl && canRenderDailyLoad73116()) {
          statusEl.textContent =
            '현재 날짜의 학생 명단을 최초 자동적재하는 중...';
        }
        try {
          await bootstrapDateOnce(
            rt,
            ctx.date,
            'daily_attendance_empty_bootstrap',
            ['attendance']
          );
          result = await readAndRender(
            rt,
            '현재 반 학생 명단 자동적재 완료'
          );
        } catch (error) {
          attendanceSyncError = error;
          safeConsole(
            'warn',
            '[ULIM 7.31.3 daily attendance bootstrap]',
            error
          );
        }
      }

      if (!result.savedRows.length) {
        bootstrapDateOnce(
          rt,
          ctx.date,
          'daily_evaluation_empty_bootstrap',
          ['dailyEvaluations']
        )
          .then(async function (refreshed) {
            if (!refreshed || !canRenderDailyLoad73116()) return;
            try {
              await readAndRender(
                rt,
                '담당강사 일일평가 최신자료 반영 완료'
              );
            } catch (error) {
              safeConsole(
                'warn',
                '[ULIM 7.31.3 daily background refresh]',
                error
              );
            }
          })
          .catch(function (error) {
            safeConsole(
              'warn',
              '[ULIM 7.31.3 daily evaluation bootstrap]',
              error
            );
          });
      }

      if (
        attendanceSyncError &&
        !result.rows.length &&
        !cached &&
        canRenderDailyLoad73116()
      ) {
        alert(
          friendlyError(
            attendanceSyncError,
            '학생 명단을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
          )
        );
      }
      return true;
    } catch (error) {
      safeConsole(
        'warn',
        '[ULIM 7.31.3 daily Firestore read]',
        error
      );
      if (!cached && canRenderDailyLoad73116()) {
        alert(
          friendlyError(
            error,
            '일일평가를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
          )
        );
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
      classId: r.classId || ctx.classId || '',
      teacherScopeKey: r.teacherScopeKey || ctx.teacherScopeKey,
      teacherUid: r.teacherUid || '',
      instructor:
        r.instructor ||
        r.instructorName ||
        teacherNameFor(
          r.className || ctx.className,
          r,
          r.date || ctx.date
        ),
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
    let ctx = dailyContext();
    ctx = await refreshContextClassMetadata73116('daily', ctx);
    if (!ctx.teacherScopeKey) return alert('담당강사 범위를 확인하지 못했습니다. 반 목록에서 다시 선택해주세요.');
    const sendChannel = typeof adminGetSendChannel === 'function' ? adminGetSendChannel('daily') : 'alimtalk';
    const channelLabel = typeof adminGetSendChannelLabel === 'function' ? adminGetSendChannelLabel(sendChannel) : sendChannel;
    const saveConfirmText = isFullAdmin()
      ? ('일일평가를 Firestore에 저장하고 Google Sheets 반영 후 [' + recipientTypes.join(', ') + ']에게 ' + channelLabel + '으로 발송할까요?')
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
      renderDaily(
        adminDailyEvalRows || compact,
        'Firestore 저장 완료 · Google Sheets 백그라운드 전송 중',
        ctx
      );
      writeCache(cacheKey('daily', ctx), { rows: adminDailyEvalRows || compact });
      if (statusEl) statusEl.textContent = isFullAdmin()
        ? (data.message || 'Firestore 저장 완료 · 시트 백그라운드 전송 중')
        : '저장 완료';
      pollSync(rid, '일일평가', statusEl).catch(function () {});
      alert(isFullAdmin()
        ? (sendSms
          ? '일일평가가 Firestore에 저장되었습니다. Google Sheets 반영 후 발송도 백그라운드에서 처리됩니다.'
          : '일일평가가 Firestore에 저장되었습니다. Google Sheets는 백그라운드에서 반영됩니다.')
        : (sendSms ? '일일평가가 저장되었고 발송이 진행됩니다.' : '일일평가가 저장되었습니다.'));
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

  // 7.04의 1분 후 시트 직접 자동저장은 중단합니다. 명시적 평가저장만 Firestore job을 만듭니다.
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
    activeClassListRequestDate73116 = date;

    let immediate = readPersistentClassList(date);
    if (!immediate || !immediate.length) {
      try {
        const sessionKey = typeof getAdminClassListCacheKey === 'function' ? getAdminClassListCacheKey(date) : '';
        immediate = sessionKey && typeof readAdminClassListCache === 'function' ? readAdminClassListCache(sessionKey) : null;
      } catch (ignore) {}
    }
    if (!immediate || !immediate.length) {
      try {
        const expectedKey = typeof getAdminClassListCacheKey === 'function'
          ? getAdminClassListCacheKey(date)
          : '';
        const currentKey = typeof adminClassListLoadedKey !== 'undefined'
          ? text(adminClassListLoadedKey)
          : '';

        immediate = expectedKey &&
          currentKey === expectedKey &&
          Array.isArray(adminClassList) &&
          adminClassList.length
            ? adminClassList
            : null;
      } catch (ignore) {}
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
    const ctx = kind === 'attendance'
      ? attendanceContext()
      : dailyContext();
    return {
      date: text(ctx && ctx.date) || localDateText(),
      classId: ''
    };
  }

  function revisionScopeId73116(date) {
    return text(date) || localDateText();
  }

  function revisionPanelActive73116(kind) {
    const panelId = kind === 'attendance'
      ? 'adminPanelAttendance'
      : 'adminPanelDailyEval';
    const panel = document.getElementById(panelId);
    return !!(
      panel &&
      panel.classList &&
      panel.classList.contains('active')
    );
  }

  function revisionSelectionReady73116(kind) {
    const inputId = kind === 'attendance'
      ? 'adminAttendanceClass'
      : 'adminDailyEvalClass';
    const input = document.getElementById(inputId);
    return !!(input && text(input.value));
  }

  function scheduleRevisionReload7318(kind, date, classId, revision) {
    const state = revisionListeners7318[kind];
    const targetDate = text(date);
    if (!state || state.date !== targetDate) return;

    state.pendingRevision = Math.max(
      Number(state.pendingRevision || 0),
      Number(revision || 0)
    );

    if (
      state.reloadTimer ||
      state.reloadInFlight ||
      !revisionPanelActive73116(kind) ||
      !revisionSelectionReady73116(kind)
    ) {
      return;
    }

    const elapsed = Date.now() - Number(state.lastReloadAt || 0);
    const delay = Math.max(250, 900 - elapsed);

    state.reloadTimer = setTimeout(function () {
      state.reloadTimer = null;

      const current = revisionContext73116(kind);
      if (
        current.date !== targetDate ||
        !revisionPanelActive73116(kind) ||
        !revisionSelectionReady73116(kind)
      ) {
        return;
      }

      if (state.reloadInFlight) return;

      const handledRevision = Number(state.pendingRevision || 0);
      state.pendingRevision = 0;
      state.reloadInFlight = true;
      state.lastReloadAt = Date.now();

      const task = kind === 'attendance'
        ? (
            typeof global.adminLoadAttendanceSnapshot === 'function'
              ? global.adminLoadAttendanceSnapshot(false, false)
              : false
          )
        : (
            typeof global.adminLoadDailyEvalStudents === 'function'
              ? global.adminLoadDailyEvalStudents(false)
              : false
          );

      Promise.resolve(task)
        .catch(function (error) {
          safeConsole(
            'warn',
            '[ULIM 7.31.16 ' + kind + ' realtime reload]',
            error
          );
        })
        .finally(function () {
          state.reloadInFlight = false;
          if (Number(state.pendingRevision || 0) > handledRevision) {
            scheduleRevisionReload7318(
              kind,
              targetDate,
              '',
              state.pendingRevision
            );
          }
        });
    }, delay);
  }

  async function bindRevisionListener7318(
    kind,
    date,
    classId,
    forceDateScope
  ) {
    const targetDate = text(date) || localDateText();
    const targetClassId = '';
    const scopeId = revisionScopeId73116(targetDate);
    const state = revisionListeners7318[kind];
    if (!state) return;

    if (Date.now() < Number(state.blockedUntil || 0)) return;
    if (
      state.scopeId === scopeId &&
      typeof state.unsubscribe === 'function'
    ) {
      return;
    }

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
    state.pendingRevision = 0;
    state.reloadInFlight = false;

    try {
      const rt = await runtime();
      if (!(await firebaseStaffClaimsReady73111(rt))) {
        state.blockedUntil = Date.now() + 1200;
        return;
      }

      const ref = rt.sdk.doc(
        rt.db,
        'staffOperationalRevisions',
        scopeId
      );

      state.unsubscribe = rt.sdk.onSnapshot(
        ref,
        function (snapshot) {
          const data =
            snapshot && snapshot.exists()
              ? snapshot.data() || {}
              : {};
          const field = kind === 'attendance'
            ? 'attendanceRevision'
            : 'dailyRevision';
          const revision = Number(data[field] || 0);

          if (!state.initialized) {
            state.initialized = true;
            state.lastRevision = revision;
            return;
          }
          if (revision <= state.lastRevision) return;

          state.lastRevision = revision;
          scheduleRevisionReload7318(
            kind,
            targetDate,
            '',
            revision
          );
        },
        function (error) {
          state.unsubscribe = null;
          const code = text(error && error.code).toLowerCase();
          if (code.indexOf('permission-denied') >= 0) {
            state.blockedUntil = Date.now() + 3000;
            return;
          }
          safeConsole(
            'warn',
            '[ULIM 7.31.16 ' + kind + ' revision listener]',
            error
          );
        }
      );
    } catch (error) {
      state.blockedUntil = Date.now() + 1500;
      safeConsole(
        'warn',
        '[ULIM 7.31.16 revision bind]',
        kind,
        error
      );
    }
  }

  function ensureRevisionListeners7318() {
    if (revisionEnsurePromise73112) {
      return revisionEnsurePromise73112;
    }

    revisionEnsurePromise73112 = (async function () {
      const rt = await runtime().catch(function () { return null; });
      if (!rt || !(await firebaseStaffClaimsReady73111(rt))) {
        return false;
      }

      const attendanceRevision =
        revisionContext73116('attendance');
      const dailyRevision =
        revisionContext73116('daily');

      await Promise.all([
        bindRevisionListener7318(
          'attendance',
          attendanceRevision.date,
          '',
          true
        ),
        bindRevisionListener7318(
          'daily',
          dailyRevision.date,
          '',
          true
        )
      ]);
      return true;
    })().finally(function () {
      revisionEnsurePromise73112 = null;
    });

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
      state.reloadInFlight = false;
      state.pendingRevision = 0;
      state.lastReloadAt = 0;
    });
  }

  function installRevisionDateHandlers7318() {
    ['adminAttendanceDate', 'adminDailyEvalDate'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el || el.dataset.ulimRevisionListener7318 === '1') return;
      el.dataset.ulimRevisionListener7318 = '1';
      el.addEventListener('change', function () {
        setTimeout(ensureRevisionListeners7318, 0);
      });
    });

    if (document.body.dataset.ulimRevisionPanelHandlers73116 !== '1') {
      document.body.dataset.ulimRevisionPanelHandlers73116 = '1';
      document.addEventListener('click', function (event) {
        const button = event.target && event.target.closest
          ? event.target.closest('.admin-subtab[data-admin-panel]')
          : null;
        if (!button) return;

        setTimeout(function () {
          const panelId = text(button.dataset.adminPanel);
          const kind = panelId === 'adminPanelAttendance'
            ? 'attendance'
            : (
                panelId === 'adminPanelDailyEval'
                  ? 'daily'
                  : ''
              );
          if (!kind) return;

          const state = revisionListeners7318[kind];
          if (
            state &&
            Number(state.pendingRevision || 0) > 0
          ) {
            scheduleRevisionReload7318(
              kind,
              state.date,
              '',
              state.pendingRevision
            );
          }
        }, 80);
      }, true);
    }
  }

  function prewarm() {
    installRevisionDateHandlers7318();

    // 로그인 전에는 GAS 런타임만 깨우며 보호 데이터/리스너는 시작하지 않습니다.
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
    const sameUid = !!uid && uid === lastAuthReadyUid73105;
    const uidChanged = !!uid && !!lastAuthReadyUid73105 && !sameUid;

    if (sameUid && now - lastAuthReadyAt73105 < 30000) return;

    const shouldResetListeners = !lastAuthReadyUid73105 || uidChanged;
    lastAuthReadyUid73105 = uid || lastAuthReadyUid73105;
    lastAuthReadyAt73105 = now;
    runtimePromise = null;

    setTimeout(function () {
      if (shouldResetListeners) resetRevisionListeners7318();
      installRevisionDateHandlers7318();
      Promise.resolve(ensureRevisionListeners7318()).catch(function () {});

      try {
        const attendancePanel =
          document.getElementById('adminPanelAttendance');
        const dailyPanel =
          document.getElementById('adminPanelDailyEval');
        const activeDate = dailyPanel &&
          dailyPanel.classList.contains('active')
            ? text(
                document.getElementById('adminDailyEvalDate') &&
                document.getElementById('adminDailyEvalDate').value
              )
            : text(
                document.getElementById('adminAttendanceDate') &&
                document.getElementById('adminAttendanceDate').value
              );

        if (typeof adminLoadClassList === 'function') {
          adminLoadClassList(activeDate, false);
        }

        if (
          attendancePanel &&
          attendancePanel.classList.contains('active')
        ) {
          const classSelect =
            document.getElementById('adminAttendanceClass');
          if (
            classSelect &&
            text(classSelect.value) &&
            typeof adminLoadAttendanceSnapshot === 'function'
          ) {
            adminLoadAttendanceSnapshot(false, false);
          }
        } else if (
          dailyPanel &&
          dailyPanel.classList.contains('active')
        ) {
          const dailyClass =
            document.getElementById('adminDailyEvalClass');
          if (
            dailyClass &&
            text(dailyClass.value) &&
            typeof adminLoadDailyEvalStudents === 'function'
          ) {
            adminLoadDailyEvalStudents(false);
          }
        }
      } catch (error) {
        safeConsole(
          'warn',
          '[ULIM 7.31.16 auth-ready active panel refresh]',
          error
        );
      }
    }, 60);
  });

  const style = document.createElement('style');
  style.id = 'ulim-staff-firestore-operational-73111-style';
  style.textContent = '.ulim-firestore-sync-note-731{font-size:11px;font-weight:800;color:#047857}';
  document.head.appendChild(style);
})(typeof window !== 'undefined' ? window : globalThis);
