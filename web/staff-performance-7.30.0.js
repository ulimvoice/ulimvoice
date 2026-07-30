(function () {
  'use strict';

  if (window.__ULIM_STAFF_PERFORMANCE_73000__) return;
  window.__ULIM_STAFF_PERFORMANCE_73000__ = true;

  const VERSION = '2026-07-30.730.00';
  const CLASS_CACHE_PREFIX = 'ulim_staff_perf_730_class_';
  const ATT_CACHE_PREFIX = 'ulim_staff_perf_730_att_';
  const DAILY_CACHE_PREFIX = 'ulim_staff_perf_730_daily_';
  const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
  const CLASS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const pendingRefresh = new Map();
  let attendanceRequestSeq = 0;
  let dailyRequestSeq = 0;
  let sessionValidationSeq = 0;
  let sessionValidationPromise = null;
  let lastSessionValidatedAt = 0;
  const attendanceDirtyContexts = new Set();
  const dailyDirtyContexts = new Set();
  const dailyDraftPromptedContexts = new Set();

  function safeConsole(level, ...args) {
    try {
      const fn = console && console[level];
      if (typeof fn === 'function') fn.apply(console, args);
    } catch (ignore) {}
  }

  function getToken() {
    try { return String(typeof adminToken !== 'undefined' && adminToken || localStorage.getItem('adminToken') || '').trim(); }
    catch (ignore) { return ''; }
  }

  function getInfo() {
    try {
      if (typeof adminInfo !== 'undefined' && adminInfo) return adminInfo;
      return JSON.parse(localStorage.getItem('adminInfo') || '{}') || {};
    } catch (ignore) { return {}; }
  }

  function sanitize(value) {
    return String(value || '').trim().replace(/[^0-9A-Za-z가-힣_-]/g, '_').slice(0, 120);
  }

  function ownerKey() {
    const info = getInfo();
    return sanitize(
      info.principalUidV2 || info.firebaseAuthUid || info.accountUid ||
      info.adminUid || info.uid || info.id || info.adminId || info.name ||
      getToken().slice(0, 24)
    ) || 'NO_STAFF';
  }

  function api(action, params) {
    const fn = window.adminApi || (typeof adminApi === 'function' ? adminApi : null);
    if (!fn) return Promise.reject(new Error('관리자 API를 찾지 못했습니다.'));
    return fn(action, params || {});
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (ignore) { return Array.isArray(value) ? value.slice() : value; }
  }

  function readCache(key, maxAge) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.savedAt || Date.now() - Number(parsed.savedAt) > Number(maxAge || CACHE_MAX_AGE_MS)) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch (ignore) { return null; }
  }

  function writeCache(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(Object.assign({ savedAt: Date.now(), owner: ownerKey() }, value || {})));
      return true;
    } catch (ignore) { return false; }
  }

  function removeOwnerCaches(prefix) {
    const owner = ownerKey();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i) || '';
        if (key.indexOf(prefix + owner + '_') === 0) localStorage.removeItem(key);
      }
    } catch (ignore) {}
  }

  function currentDate(inputId) {
    const el = document.getElementById(inputId);
    if (el && el.value) return String(el.value);
    try { return typeof getTodayInputValue === 'function' ? getTodayInputValue() : new Date().toISOString().slice(0, 10); }
    catch (ignore) { return new Date().toISOString().slice(0, 10); }
  }

  function classCacheKey(date) {
    return CLASS_CACHE_PREFIX + ownerKey() + '_' + sanitize(date);
  }

  function attendanceContext() {
    return {
      date: currentDate('adminAttendanceDate'),
      className: String(document.getElementById('adminAttendanceClass')?.value || '').trim(),
      keyword: String(document.getElementById('adminAttendanceFilter')?.value || '').trim(),
      statusFilter: String(document.getElementById('adminAttendanceStatusFilter')?.value || '').trim()
    };
  }

  function attendanceCacheKey(ctx) {
    return ATT_CACHE_PREFIX + ownerKey() + '_' + [ctx.date, ctx.className, ctx.keyword, ctx.statusFilter].map(sanitize).join('__');
  }

  function attendanceContextId(ctx) {
    return [ownerKey(), ctx.date, ctx.className, ctx.keyword, ctx.statusFilter].map(sanitize).join('|');
  }

  function dailyContext() {
    return {
      date: currentDate('adminDailyEvalDate'),
      className: String(document.getElementById('adminDailyEvalClass')?.value || '').trim(),
      keyword: String(document.getElementById('adminDailyEvalFilter')?.value || '').trim()
    };
  }

  function dailyContextId(ctx) {
    return [ownerKey(), ctx.date, ctx.className, ctx.keyword].map(sanitize).join('|');
  }

  function dailyCacheKey(ctx) {
    return DAILY_CACHE_PREFIX + ownerKey() + '_' + [ctx.date, ctx.className, ctx.keyword].map(sanitize).join('__');
  }

  function sameOwnerAndToken(ownerAtStart, tokenAtStart) {
    return ownerAtStart === ownerKey() && tokenAtStart === getToken();
  }

  function showAdminShell() {
    const storedToken = getToken();
    if (!storedToken) return false;
    const storedInfo = getInfo();
    try { if (typeof adminToken !== 'undefined' && !adminToken) adminToken = storedToken; } catch (ignore) {}
    try { if (typeof adminInfo !== 'undefined' && (!adminInfo || !Object.keys(adminInfo).length)) adminInfo = storedInfo; } catch (ignore) {}
    try { adminModeActive = true; } catch (ignore) {}
    document.body.classList.add('admin-mode');

    try { if (typeof setAdminTabVisibility === 'function') setAdminTabVisibility(); } catch (ignore) {}
    try { if (typeof adminInitDates === 'function') adminInitDates(); } catch (ignore) {}
    try { if (typeof applyAdminPermissions === 'function') applyAdminPermissions(); } catch (ignore) {}
    try { if (typeof window.adminEnableAllTabsForAdminMode === 'function') window.adminEnableAllTabsForAdminMode(); } catch (ignore) {}
    try { if (typeof window.__ULIM_APPLY_RESERVATION_VISIBILITY_713__ === 'function') window.__ULIM_APPLY_RESERVATION_VISIBILITY_713__(); } catch (ignore) {}

    const loginBox = document.getElementById('adminLoginBox');
    const dashboard = document.getElementById('adminDashboard');
    if (loginBox) loginBox.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';

    try {
      if (typeof adminIsTeacherMode === 'function' && adminIsTeacherMode() && typeof showAdminPanel === 'function') {
        const visiblePanel = document.querySelector('.admin-panel[style*="display: block"]');
        if (!visiblePanel) showAdminPanel('adminPanelAttendance');
      }
    } catch (ignore) {}
    return true;
  }

  function isDefinitelyExpired(error) {
    const msg = String(error && error.message || error || '');
    return /세션.*(만료|유효하지)|로그인.*필요|다시.*로그인|토큰.*(만료|유효하지)|권한.*확인.*실패/i.test(msg);
  }

  async function validateSessionInBackground() {
    if (Date.now() - lastSessionValidatedAt < 30000) return true;
    if (sessionValidationPromise) return sessionValidationPromise;

    sessionValidationPromise = (async () => {
      const seq = ++sessionValidationSeq;
      const tokenAtStart = getToken();
      const ownerAtStart = ownerKey();
      if (!tokenAtStart) return false;

      try {
        const data = await api('adminGetSession', { adminToken: tokenAtStart, noCache: '1', performanceVersion: '73000' });
        if (seq !== sessionValidationSeq || !sameOwnerAndToken(ownerAtStart, tokenAtStart)) return false;
        if (data && data.admin) {
          try { adminInfo = data.admin; } catch (ignore) {}
          try { localStorage.setItem('adminInfo', JSON.stringify(data.admin)); } catch (ignore) {}
        }
        showAdminShell();
        lastSessionValidatedAt = Date.now();
        try { sessionStorage.setItem('ulim_admin_active_owner_613', ownerKey()); } catch (ignore) {}
        return true;
      } catch (error) {
        if (seq !== sessionValidationSeq || !sameOwnerAndToken(ownerAtStart, tokenAtStart)) return false;
        if (error && error.code === 'ULIM_STALE_ADMIN_RESPONSE_613') return false;
        if (isDefinitelyExpired(error)) {
          safeConsole('warn', '[ULIM 7.30] 저장 세션 만료:', error);
          try { alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.'); } catch (ignore) {}
          try {
            const fn = window.adminLogout || (typeof adminLogout === 'function' ? adminLogout : null);
            if (fn) fn();
          } catch (ignore) {}
        } else {
          safeConsole('warn', '[ULIM 7.30] 세션 백그라운드 확인 지연 — 현재 화면 유지:', error);
        }
        return false;
      }
    })();

    try {
      return await sessionValidationPromise;
    } finally {
      sessionValidationPromise = null;
    }
  }

  function prewarmAfterLogin() {
    setTimeout(() => {
      try {
        const room = window.ULIM_ROOM_CLASSROOM_REALTIME_728;
        if (room && typeof room.ensureAuthenticated === 'function') room.ensureAuthenticated().catch(() => {});
      } catch (ignore) {}
      try {
        if (window.ulimReliableWrite614 && typeof window.ulimReliableWrite614.flush === 'function') {
          window.ulimReliableWrite614.flush({ force: true });
        }
      } catch (ignore) {}
      try {
        const fn = window.adminLoadClassList || (typeof adminLoadClassList === 'function' ? adminLoadClassList : null);
        if (fn) fn(currentDate('adminAttendanceDate'), false);
      } catch (ignore) {}
    }, 0);
  }

  // 로그인 후 두 번째 세션 확인을 기다리지 않고 저장된 권한으로 화면부터 엽니다.
  window.adminLoadInitialData = async function () {
    if (!getToken()) return false;
    showAdminShell();
    prewarmAfterLogin();
    setTimeout(validateSessionInBackground, 0);
    return { status: 'success', fastShell: true, version: VERSION };
  };
  try { adminLoadInitialData = window.adminLoadInitialData; } catch (ignore) {}

  // 날짜별 반 목록은 계정별 영구 캐시를 먼저 표시하고 서버 원본은 뒤에서 확인합니다.
  window.adminLoadClassList = function (dateOverride, force) {
    if (!getToken()) return Promise.resolve(false);
    const date = String(dateOverride || currentDate('adminAttendanceDate') || currentDate('adminDailyEvalDate')).trim();
    const key = classCacheKey(date);
    const cached = !force ? readCache(key, CLASS_CACHE_MAX_AGE_MS) : null;

    if (cached && Array.isArray(cached.classes)) {
      let classes = cached.classes;
      try { if (typeof adminFilterClassListForRole === 'function') classes = adminFilterClassListForRole(classes); } catch (ignore) {}
      try { adminClassList = classes; } catch (ignore) {}
      try { adminClassListLoadedKey = typeof getAdminClassListCacheKey === 'function' ? getAdminClassListCacheKey(date) : key; } catch (ignore) {}
      try { if (typeof adminRenderClassSelectors === 'function') adminRenderClassSelectors(); } catch (ignore) {}
      try { if (typeof adminClearInvalidClassSelection704_ === 'function') adminClearInvalidClassSelection704_(date); } catch (ignore) {}
    }

    const refreshKey = 'class|' + ownerKey() + '|' + date;
    if (pendingRefresh.has(refreshKey)) return pendingRefresh.get(refreshKey);
    const ownerAtStart = ownerKey();
    const tokenAtStart = getToken();

    const promise = api('adminGetClassList', {
      adminToken: tokenAtStart,
      date,
      force: force ? '1' : '',
      exactDateVersion: '73000',
      noCache: force ? '1' : ''
    }).then(data => {
      if (!sameOwnerAndToken(ownerAtStart, tokenAtStart)) return false;
      let classes = Array.isArray(data && data.classes) ? data.classes : [];
      try { if (typeof adminFilterClassListForRole === 'function') classes = adminFilterClassListForRole(classes); } catch (ignore) {}
      try { adminClassList = classes; } catch (ignore) {}
      try { adminClassListLoadedKey = typeof getAdminClassListCacheKey === 'function' ? getAdminClassListCacheKey(date) : key; } catch (ignore) {}
      writeCache(key, { classes });
      try { if (typeof writeAdminClassListCache === 'function' && typeof getAdminClassListCacheKey === 'function') writeAdminClassListCache(getAdminClassListCacheKey(date), classes); } catch (ignore) {}
      try { if (typeof adminRenderClassSelectors === 'function') adminRenderClassSelectors(); } catch (ignore) {}
      try { if (typeof adminClearInvalidClassSelection704_ === 'function') adminClearInvalidClassSelection704_(date); } catch (ignore) {}
      return true;
    }).catch(error => {
      if (!cached && !(error && error.code === 'ULIM_STALE_ADMIN_RESPONSE_613')) safeConsole('warn', '[ULIM 7.30] 반 목록 조회 오류:', error);
      return false;
    }).finally(() => pendingRefresh.delete(refreshKey));

    pendingRefresh.set(refreshKey, promise);
    return promise;
  };
  try { adminLoadClassList = window.adminLoadClassList; } catch (ignore) {}

  function attendanceKey(record) {
    const r = record || {};
    return String(r.studentIdentityKey || r.studentNo || r.attendanceNo || r.studentPhone || r.studentName || r.name || '') +
      '|' + String(r.date || '') + '|' + String(r.className || '');
  }

  function pendingAttendanceRows(baseRows, ctx) {
    const rows = Array.isArray(baseRows) ? baseRows.map(row => Object.assign({}, row)) : [];
    const index = new Map(rows.map((row, i) => [attendanceKey(row), i]));
    let jobs = [];
    try { jobs = window.ulimReliableWrite614 && typeof window.ulimReliableWrite614.jobs === 'function' ? window.ulimReliableWrite614.jobs() : []; } catch (ignore) {}

    jobs.filter(job => job && job.operation === 'attendance' && job.state !== 'complete').forEach(job => {
      let records = [];
      try { records = JSON.parse(job.payload && job.payload.records || '[]'); } catch (ignore) {}
      records.forEach(record => {
        if (ctx.date && String(record.date || '') !== ctx.date) return;
        if (ctx.className && ctx.className !== '전체반' && String(record.className || '') !== ctx.className) return;
        const key = attendanceKey(record);
        const at = index.get(key);
        const pendingState = job.state === 'failed' ? '확인 필요' : (navigator.onLine ? '전송 중...' : '오프라인 저장');
        const merged = Object.assign({}, at == null ? {} : rows[at], record, { __ulimPending730: pendingState });
        if (at == null) {
          index.set(key, rows.length);
          rows.push(merged);
        } else rows[at] = merged;
      });
    });
    return rows;
  }

  function assignAttendance(rows, message) {
    const next = Array.isArray(rows) ? rows : [];
    try { adminAttendanceRecords = next; } catch (ignore) {}
    try { window.adminAttendanceRecords = next; } catch (ignore) {}
    try {
      const render = window.adminRenderAttendanceTable || (typeof adminRenderAttendanceTable === 'function' ? adminRenderAttendanceTable : null);
      if (render) render();
    } catch (ignore) {}
    const summary = document.getElementById('adminAttendanceSummary');
    if (summary && message) summary.textContent = message;
    setTimeout(() => {
      next.forEach((row, idx) => {
        if (!row || !row.__ulimPending730) return;
        try { if (typeof adminSetAttendanceSaveState_ === 'function') adminSetAttendanceSaveState_(idx, row.__ulimPending730, row.__ulimPending730 === '확인 필요'); } catch (ignore) {}
      });
    }, 0);
  }

  window.adminLoadAttendanceSnapshot = function (showAlert) {
    if (!getToken()) return Promise.resolve(false);
    const shouldAlert = showAlert !== false;
    const ctx = attendanceContext();
    const contextId = attendanceContextId(ctx);
    if (shouldAlert) attendanceDirtyContexts.delete(contextId);
    const key = attendanceCacheKey(ctx);
    const cached = readCache(key, CACHE_MAX_AGE_MS);
    const seq = ++attendanceRequestSeq;
    const ownerAtStart = ownerKey();
    const tokenAtStart = getToken();

    if (cached && Array.isArray(cached.rows)) {
      assignAttendance(pendingAttendanceRows(clone(cached.rows), ctx), (cached.message || `출석부 ${cached.rows.length}건`) + ' · 캐시 즉시 표시 / 최신 원본 확인 중');
    } else {
      const wrap = document.getElementById('adminAttendanceTableWrap');
      if (wrap) wrap.innerHTML = '<div class="admin-data-guard-message">출석부 원본을 불러오는 중입니다...</div>';
      const summary = document.getElementById('adminAttendanceSummary');
      if (summary) summary.textContent = 'Google Sheets 출석부 확인 중...';
    }

    const request = api('adminGetAttendanceSnapshot', {
      adminToken: tokenAtStart,
      date: ctx.date,
      className: ctx.className,
      keyword: ctx.keyword,
      statusFilter: ctx.statusFilter,
      forceRefresh: 'Y',
      noCache: 'Y',
      performanceVersion: '73000'
    }).then(data => {
      if (seq !== attendanceRequestSeq || !sameOwnerAndToken(ownerAtStart, tokenAtStart)) return false;
      const canonical = Array.isArray(data && data.records) ? data.records : [];
      const message = data && data.message || `출석부 반영 ${canonical.length}건`;
      writeCache(key, { rows: canonical, message, context: ctx });
      if (attendanceDirtyContexts.has(contextId)) {
        const summary = document.getElementById('adminAttendanceSummary');
        if (summary) summary.textContent = message + ' · 최신 원본 확인 완료 / 현재 입력은 유지';
      } else {
        assignAttendance(pendingAttendanceRows(clone(canonical), ctx), message + (canonical.length ? ' · 최신 시트 확인 완료' : ''));
      }
      if (shouldAlert && !canonical.length) alert('조건에 맞는 출석부 데이터가 없습니다. 날짜/반명/학생명을 확인해주세요.');
      return true;
    }).catch(error => {
      if (error && error.code === 'ULIM_STALE_ADMIN_RESPONSE_613') return false;
      const summary = document.getElementById('adminAttendanceSummary');
      if (summary) summary.textContent = cached ? '캐시 표시 중 · 최신 원본 확인 지연' : '출석부 조회 실패';
      if (!cached && shouldAlert) alert(error && error.message || '출석부 조회 중 문제가 발생했습니다.');
      else safeConsole('warn', '[ULIM 7.30] 출석부 백그라운드 조회 오류:', error);
      return false;
    });

    return request;
  };
  try { adminLoadAttendanceSnapshot = window.adminLoadAttendanceSnapshot; } catch (ignore) {}

  function mapAttendanceToDaily(record, ctx) {
    const r = record || {};
    let video = r.videoLink || '';
    try { if (!video && typeof adminGetVideoLinkForClassName_ === 'function') video = adminGetVideoLinkForClassName_(r.className || ctx.className); } catch (ignore) {}
    return {
      date: r.date || ctx.date,
      className: r.className || ctx.className,
      studentName: r.studentName || r.name || '',
      name: r.studentName || r.name || '',
      studentNo: r.studentNo || r.attendanceNo || '',
      studentIdentityKey: r.studentIdentityKey || '',
      studentPhone: r.studentPhone || '',
      parentPhone: r.parentPhone || '',
      instructor: r.instructor || r.instructorName || '',
      attendanceStatus: r.status || r.attendanceStatus || '',
      specialStatus: r.specialStatus || '',
      memo: r.memo || '',
      videoLink: video,
      lessonContent: '', lessonAttitude: '', teacherComment: '', evaluation: ''
    };
  }

  function mapStudentToDaily(student, ctx) {
    const s = student || {};
    const className = s.className || s.currentClass || ctx.className;
    let instructor = s.instructor || s.instructorName || '';
    try { if (!instructor && typeof adminNoticeExtractTeacher_ === 'function') instructor = adminNoticeExtractTeacher_(className) || ''; } catch (ignore) {}
    let video = s.videoLink || '';
    try { if (!video && typeof adminGetVideoLinkForClassName_ === 'function') video = adminGetVideoLinkForClassName_(className); } catch (ignore) {}
    return {
      date: ctx.date, className,
      studentName: s.studentName || s.name || '', name: s.name || s.studentName || '',
      studentNo: s.studentNo || s.attendanceNo || '', studentIdentityKey: s.studentIdentityKey || '',
      studentPhone: s.studentPhone || '', parentPhone: s.parentPhone || '', instructor,
      attendanceStatus: '', specialStatus: '', memo: s.memo || '', videoLink: video,
      lessonContent: '', lessonAttitude: '', teacherComment: '', evaluation: ''
    };
  }

  function assignDaily(rows, message) {
    const next = Array.isArray(rows) ? rows : [];
    try { adminDailyEvalRows = next; } catch (ignore) {}
    try { window.adminDailyEvalRows = next; } catch (ignore) {}
    try {
      const render = window.adminRenderDailyEvalRows || (typeof adminRenderDailyEvalRows === 'function' ? adminRenderDailyEvalRows : null);
      if (render) render(message || '');
    } catch (ignore) {}
  }

  function maybeRestoreDailyDraft(ctx) {
    const contextId = dailyContextId(ctx);
    if (dailyDraftPromptedContexts.has(contextId)) return;
    dailyDraftPromptedContexts.add(contextId);

    setTimeout(() => {
      try {
        const key = typeof window.ulimGetDailyEvalLocalDraftKey704_ === 'function'
          ? window.ulimGetDailyEvalLocalDraftKey704_()
          : '';
        if (!key) return;
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const draft = JSON.parse(raw);
        const savedAt = draft && draft.savedAtClient
          ? new Date(draft.savedAtClient).toLocaleString('ko-KR')
          : '';
        const ok = confirm('이 반의 로컬 자동 임시저장본이 있습니다.' +
          (savedAt ? '\n저장시각: ' + savedAt : '') + '\n불러올까요?');
        if (ok && typeof window.ulimApplyDailyEvalDraft704_ === 'function') {
          window.ulimApplyDailyEvalDraft704_(draft);
          dailyDirtyContexts.add(contextId);
        }
      } catch (error) {
        safeConsole('warn', '[ULIM 7.30] 일일평가 로컬 임시저장 복구 확인 오류:', error);
      }
    }, 180);
  }

  async function buildCanonicalDailyRows(ctx, tokenAtStart) {
    const attendancePromise = api('adminGetAttendanceSnapshot', {
      adminToken: tokenAtStart, date: ctx.date, className: ctx.className, keyword: ctx.keyword,
      statusFilter: '', forceRefresh: 'Y', noCache: 'Y', performanceVersion: '73000'
    });
    const savedPromise = api('adminGetDailyEvaluations', {
      adminToken: tokenAtStart, date: ctx.date, className: ctx.className, keyword: ctx.keyword,
      forceRefresh: 'Y', noCache: 'Y', performanceVersion: '73000'
    });

    const [attendanceResult, savedResult] = await Promise.allSettled([attendancePromise, savedPromise]);
    let baseRows = [];
    let sourceMessage = '';
    let firstError = null;

    if (attendanceResult.status === 'fulfilled') {
      const records = Array.isArray(attendanceResult.value && attendanceResult.value.records) ? attendanceResult.value.records : [];
      if (records.length) {
        baseRows = records.map(record => mapAttendanceToDaily(record, ctx));
        sourceMessage = attendanceResult.value.message || '출석부 수업일 기준 학생';
      }
    } else firstError = attendanceResult.reason;

    if (!baseRows.length && ctx.className && ctx.className !== '전체반') {
      try {
        const roster = await api('adminGetStudentsByClass', {
          adminToken: tokenAtStart, className: ctx.className, keyword: ctx.keyword,
          forceRefresh: 'Y', noCache: 'Y', performanceVersion: '73000'
        });
        const students = Array.isArray(roster && roster.students) ? roster.students : [];
        if (students.length) {
          baseRows = students.map(student => mapStudentToDaily(student, ctx));
          sourceMessage = roster.message || '현재반 학생 명단';
        }
      } catch (error) { if (!firstError) firstError = error; }
    }

    if (!baseRows.length) {
      try {
        if (typeof adminEnsureStudentsLoaded === 'function') await adminEnsureStudentsLoaded(false);
        if (typeof adminBuildDailyRowsFromStudents === 'function') {
          const prior = typeof adminDailyEvalRows !== 'undefined' ? adminDailyEvalRows : [];
          adminDailyEvalRows = [];
          adminBuildDailyRowsFromStudents();
          baseRows = clone(adminDailyEvalRows || []);
          adminDailyEvalRows = prior;
          window.adminDailyEvalRows = prior;
          if (baseRows.length) sourceMessage = '학생명단 기준';
        }
      } catch (error) { if (!firstError) firstError = error; }
    }

    const savedRows = savedResult.status === 'fulfilled' && Array.isArray(savedResult.value && savedResult.value.rows)
      ? savedResult.value.rows : [];
    if (savedResult.status === 'rejected' && !firstError) firstError = savedResult.reason;

    const priorRows = typeof adminDailyEvalRows !== 'undefined' ? adminDailyEvalRows : [];
    adminDailyEvalRows = clone(baseRows);
    window.adminDailyEvalRows = adminDailyEvalRows;
    try {
      if (typeof adminDailyEvalApplySavedRows715_ === 'function') adminDailyEvalApplySavedRows715_(savedRows);
    } catch (error) { if (!firstError) firstError = error; }
    const finalRows = clone(adminDailyEvalRows || []);
    adminDailyEvalRows = priorRows;
    window.adminDailyEvalRows = priorRows;

    return {
      rows: finalRows,
      message: [sourceMessage, `저장 평가 ${savedRows.length}건`].filter(Boolean).join(' / '),
      error: firstError
    };
  }

  window.adminLoadDailyEvalStudents = function () {
    if (!getToken()) { alert('관리자 로그인이 필요합니다.'); return Promise.resolve(false); }
    const ctx = dailyContext();
    if (!ctx.className && !ctx.keyword) {
      alert('반명 또는 학생명을 입력하거나 반 목록에서 선택해주세요.');
      return Promise.resolve(false);
    }

    const contextId = dailyContextId(ctx);
    dailyDirtyContexts.delete(contextId);
    const key = dailyCacheKey(ctx);
    const cached = readCache(key, CACHE_MAX_AGE_MS);
    const seq = ++dailyRequestSeq;
    const ownerAtStart = ownerKey();
    const tokenAtStart = getToken();

    if (cached && Array.isArray(cached.rows)) {
      assignDaily(clone(cached.rows), (cached.message || `일일평가 ${cached.rows.length}명`) + ' · 캐시 즉시 표시 / 최신 원본 확인 중');
    } else {
      const wrap = document.getElementById('adminDailyEvalTableWrap');
      if (wrap) wrap.innerHTML = '<div class="admin-data-guard-message">출석부 명단과 저장 평가를 동시에 불러오는 중입니다...</div>';
      const status = document.getElementById('adminDailyDraftStatus');
      if (status) status.textContent = 'Google Sheets 원본 확인 중...';
    }

    const request = buildCanonicalDailyRows(ctx, tokenAtStart).then(result => {
      if (seq !== dailyRequestSeq || !sameOwnerAndToken(ownerAtStart, tokenAtStart)) return false;
      writeCache(key, { rows: result.rows, message: result.message, context: ctx });

      if (dailyDirtyContexts.has(contextId)) {
        const status = document.getElementById('adminDailyDraftStatus');
        if (status) status.textContent = '최신 원본 확인 완료 · 현재 입력 중인 내용은 유지했습니다.';
        return true;
      }

      assignDaily(result.rows, (result.message || `일일평가 ${result.rows.length}명`) + ' · 최신 시트 확인 완료');
      maybeRestoreDailyDraft(ctx);
      if (!result.rows.length && result.error) alert(result.error.message || String(result.error));
      else if (!result.rows.length) alert('조건에 맞는 학생 또는 저장된 일일평가가 없습니다.');
      return true;
    }).catch(error => {
      if (error && error.code === 'ULIM_STALE_ADMIN_RESPONSE_613') return false;
      const status = document.getElementById('adminDailyDraftStatus');
      if (status) status.textContent = cached ? '캐시 표시 중 · 최신 원본 확인 지연' : '일일평가 조회 실패';
      if (!cached) alert(error && error.message || '일일평가 조회 중 문제가 발생했습니다.');
      else {
        maybeRestoreDailyDraft(ctx);
        safeConsole('warn', '[ULIM 7.30] 일일평가 백그라운드 조회 오류:', error);
      }
      return false;
    });

    return request;
  };
  try { adminLoadDailyEvalStudents = window.adminLoadDailyEvalStudents; } catch (ignore) {}

  document.addEventListener('input', event => {
    if (!event.target || !event.target.closest || !event.target.closest('#adminAttendanceTableWrap')) return;
    attendanceDirtyContexts.add(attendanceContextId(attendanceContext()));
  }, true);
  document.addEventListener('change', event => {
    if (!event.target || !event.target.closest || !event.target.closest('#adminAttendanceTableWrap')) return;
    attendanceDirtyContexts.add(attendanceContextId(attendanceContext()));
  }, true);
  document.addEventListener('click', event => {
    if (!event.target || !event.target.closest || !event.target.closest('#adminAttendanceTableWrap .admin-att-mini')) return;
    attendanceDirtyContexts.add(attendanceContextId(attendanceContext()));
  }, true);

  document.addEventListener('input', event => {
    if (!event.target || !event.target.closest || !event.target.closest('#adminDailyEvalTableWrap')) return;
    dailyDirtyContexts.add(dailyContextId(dailyContext()));
  }, true);
  document.addEventListener('change', event => {
    if (!event.target || !event.target.closest || !event.target.closest('#adminDailyEvalTableWrap')) return;
    dailyDirtyContexts.add(dailyContextId(dailyContext()));
  }, true);

  window.addEventListener('ulimReliableWrite614', event => {
    const detail = event.detail || {};
    const job = detail.job || {};
    if (detail.state !== 'complete') return;
    if (job.operation === 'attendance') {
      removeOwnerCaches(ATT_CACHE_PREFIX);
      setTimeout(() => {
        const panel = document.getElementById('adminPanelAttendance');
        if (panel && panel.offsetParent !== null) window.adminLoadAttendanceSnapshot(false);
      }, 250);
    }
    if (job.operation === 'dailyEvaluations') {
      removeOwnerCaches(DAILY_CACHE_PREFIX);
      dailyDirtyContexts.delete(dailyContextId(dailyContext()));
    }
  });

  const priorLogout = window.adminLogout || (typeof adminLogout === 'function' ? adminLogout : null);
  if (priorLogout) {
    window.adminLogout = async function () {
      removeOwnerCaches(ATT_CACHE_PREFIX);
      removeOwnerCaches(DAILY_CACHE_PREFIX);
      attendanceDirtyContexts.clear();
      dailyDirtyContexts.clear();
      dailyDraftPromptedContexts.clear();
      return priorLogout.apply(this, arguments);
    };
    try { adminLogout = window.adminLogout; } catch (ignore) {}
  }

  // 자동 저장 입력은 캐시 갱신보다 우선합니다. 저장 함수는 기존 검증된 Reliable Write를 그대로 사용합니다.
  window.__ULIM_STAFF_PERFORMANCE_730__ = {
    version: VERSION,
    clearAttendanceCache: () => removeOwnerCaches(ATT_CACHE_PREFIX),
    clearDailyCache: () => removeOwnerCaches(DAILY_CACHE_PREFIX),
    validateSession: validateSessionInBackground
  };

  if (getToken()) {
    showAdminShell();
    prewarmAfterLogin();
    setTimeout(validateSessionInBackground, 50);
  }

  safeConsole('info', '[ULIM 7.30] 로그인·출석·일일평가 가속 설치:', VERSION);
})();
