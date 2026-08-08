(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_COURSE_APPLICATION_POPUP_7355028__) return;
  global.__ULIM_STUDENT_COURSE_APPLICATION_POPUP_7355028__ = true;

  const VERSION = '2026-08-09.735.05.0.30-r8-course-load-stable';
  const MODAL_ID = 'ulimCourseApplicationPopup7355028';
  const STYLE_ID = 'ulimCourseApplicationPopupStyle7355028';
  let config = null;
  let step = 1;
  let busy = false;
  let dismissedThisPage = false;
  let loadingPromise = null;
  let loadGeneration = 0;
  let scheduledLoadTimer = null;
  const CONFIG_TIMEOUT_MS = 12000;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function info() {
    if (global.adminInfo && typeof global.adminInfo === 'object') return global.adminInfo;
    try { return JSON.parse(localStorage.getItem('adminInfo') || '{}') || {}; } catch (_e) { return {}; }
  }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function isStaff() {
    const role = normalize(info().firebaseRole || info().role || info().permission);
    return ['teacher','admin','superadmin',normalize('강사'),normalize('관리자'),normalize('전체관리자'),normalize('전체관리'),normalize('원장')].includes(role);
  }
  function passwordChangeActive() { return global.__ULIM_STUDENT_PASSWORD_CHANGE_IN_PROGRESS_7355030__ === true; }
  function isStudent() {
    const direct = global.__ULIM_STUDENT_FIREBASE_DIRECT_AUTH_7355030__ || null;
    if (direct && typeof direct.hasValidatedSession === 'function') return direct.hasValidatedSession() && !isStaff();
    try { if (typeof global.ulimIsStudentLoggedIn_ === 'function') return global.ulimIsStudentLoggedIn_() && !isStaff(); } catch (_e) {}
    return false;
  }
  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_72917 || global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || null;
  }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('수강신청 기능을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('학생 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'student-course-application-7355028');
    return rt;
  }
  async function call(name, payload) {
    const rt = await runtime();
    const fn = rt.sdk.httpsCallable(rt.functions, name);
    const response = await fn(payload || {});
    return response && response.data || {};
  }
  function withTimeout(promise, timeoutMs) {
    let timer = null;
    return Promise.race([
      Promise.resolve(promise),
      new Promise(function (_resolve, reject) {
        timer = setTimeout(function () { reject(new Error('수강신청 정보를 불러오는 데 시간이 오래 걸리고 있습니다.')); }, timeoutMs);
      })
    ]).finally(function () { if (timer) clearTimeout(timer); });
  }

  function monthLabel(month) {
    const match = /^(\d{4})-(\d{2})$/.exec(text(month));
    return match ? Number(match[2]) + '월' : '다음 달';
  }
  function currentClassesText() {
    const rows = config && Array.isArray(config.currentEnrollments) ? config.currentEnrollments : [];
    const names = rows.map(function (row) { return text(row.className); }).filter(Boolean);
    return names.length ? names.join('\n') : '현재 등록된 수강반이 없습니다.';
  }
  function availableClasses() { return config && Array.isArray(config.classes) ? config.classes : []; }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${MODAL_ID}{position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
      #${MODAL_ID} .ulim-course-dialog{width:min(680px,96vw);max-height:92vh;overflow:hidden;background:#fff;border-radius:22px;box-shadow:0 28px 100px rgba(15,23,42,.45);display:flex;flex-direction:column}
      #${MODAL_ID} .ulim-course-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid #e5e7eb;background:#f8fafc}
      #${MODAL_ID} .ulim-course-head h2{margin:0;color:#166534;font-size:22px;font-weight:900}
      #${MODAL_ID} .ulim-course-close{border:0;border-radius:10px;background:#e2e8f0;color:#334155;width:40px;height:40px;font-size:22px;font-weight:900;cursor:pointer}
      #${MODAL_ID} .ulim-course-body{padding:22px;overflow:auto}
      #${MODAL_ID} .ulim-course-notice{padding:16px;border:1px solid #bbf7d0;border-radius:14px;background:#f0fdf4;color:#14532d;line-height:1.7;white-space:pre-wrap}
      #${MODAL_ID} .ulim-course-question{font-size:21px;font-weight:900;color:#0f172a;line-height:1.45;margin:4px 0 16px}
      #${MODAL_ID} .ulim-course-sub{font-size:13px;color:#64748b;line-height:1.55;margin:8px 0 16px;white-space:pre-wrap}
      #${MODAL_ID} .ulim-course-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}
      #${MODAL_ID} .ulim-course-btn{border:0;border-radius:14px;padding:16px 14px;font-size:17px;font-weight:900;cursor:pointer;background:#e2e8f0;color:#334155}
      #${MODAL_ID} .ulim-course-btn.primary{background:#16a34a;color:#fff}#${MODAL_ID} .ulim-course-btn.danger{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
      #${MODAL_ID} .ulim-course-btn:disabled{opacity:.55;cursor:not-allowed}
      #${MODAL_ID} .ulim-course-class-list{display:grid;gap:9px;margin-top:10px}
      #${MODAL_ID} .ulim-course-class{display:flex;align-items:flex-start;gap:10px;padding:13px;border:1px solid #dbe4ef;border-radius:12px;background:#fff;cursor:pointer}
      #${MODAL_ID} .ulim-course-class input{margin-top:3px;width:20px;height:20px;flex:0 0 auto}
      #${MODAL_ID} .ulim-course-class span{font-size:14px;line-height:1.45;color:#1e293b;font-weight:700}
      #${MODAL_ID} .ulim-course-progress{display:flex;gap:6px;margin-bottom:17px}#${MODAL_ID} .ulim-course-progress i{display:block;height:5px;flex:1;border-radius:999px;background:#e2e8f0}#${MODAL_ID} .ulim-course-progress i.on{background:#22c55e}
      #${MODAL_ID} .ulim-course-complete{text-align:center;padding:24px 8px}#${MODAL_ID} .ulim-course-complete b{display:block;font-size:24px;color:#166534;margin-bottom:8px}
      @media(max-width:520px){#${MODAL_ID}{padding:10px}#${MODAL_ID} .ulim-course-body{padding:18px}#${MODAL_ID} .ulim-course-actions{grid-template-columns:1fr}#${MODAL_ID} .ulim-course-question{font-size:19px}}
    `;
    document.head.appendChild(style);
  }

  function closePopup(markDismissed) {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.remove();
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    if (markDismissed === true) { dismissedThisPage = true; loadGeneration += 1; }
  }
  function progressHtml() {
    return '<div class="ulim-course-progress">' + [1,2,3,4].map(function (n) { return '<i class="' + (n <= step ? 'on' : '') + '"></i>'; }).join('') + '</div>';
  }
  function shell(body) {
    injectStyle();
    closePopup(false);
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.innerHTML = '<section class="ulim-course-dialog" role="dialog" aria-modal="true">' +
      '<header class="ulim-course-head"><h2>' + escapeHtml((config && config.title) || monthLabel(config && config.month) + ' 수강신청') + '</h2>' +
      '<button type="button" class="ulim-course-close" data-course-close="1" aria-label="닫기">×</button></header>' +
      '<div class="ulim-course-body">' + progressHtml() + body + '</div></section>';
    overlay.addEventListener('click', function (event) {
      const close = event.target && event.target.closest && event.target.closest('[data-course-close="1"]');
      if (close) closePopup(true);
    });
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return overlay;
  }

  function render() {
    if (!config || config.needsApplication !== true || !config.active) return closePopup(false);
    const label = monthLabel(config.month);
    if (step === 1) {
      const overlay = shell(
        '<div class="ulim-course-question">' + escapeHtml(label) + ' 수강신청 안내</div>' +
        '<div class="ulim-course-notice">' + escapeHtml(text(config.notice) || label + ' 수강신청을 진행합니다.').replace(/\n/g,'<br>') + '</div>' +
        '<div class="ulim-course-actions" style="grid-template-columns:1fr"><button type="button" class="ulim-course-btn primary" data-course-next="1">다음</button></div>'
      );
      overlay.querySelector('[data-course-next]').onclick = function () { step = 2; render(); };
      return;
    }
    if (step === 2) {
      const overlay = shell(
        '<div class="ulim-course-question">' + escapeHtml(label) + ' 수강신청 여부</div>' +
        '<div class="ulim-course-sub">아니오를 선택하면 ' + escapeHtml(label) + ' 휴원 신청으로 접수됩니다. 관리자 승인 후 대상월부터 적용됩니다.</div>' +
        '<div class="ulim-course-actions"><button type="button" class="ulim-course-btn danger" data-course-leave="1">X · 휴원</button><button type="button" class="ulim-course-btn primary" data-course-yes="1">O · 수강신청</button></div>'
      );
      overlay.querySelector('[data-course-leave]').onclick = function () { submitDecision('leave', []); };
      overlay.querySelector('[data-course-yes]').onclick = function () { step = 3; render(); };
      return;
    }
    if (step === 3) {
      const overlay = shell(
        '<div class="ulim-course-question">현재 수강반을 그대로 유지하시겠습니까?</div>' +
        '<div class="ulim-course-notice"><b>현재 수강반</b><br>' + escapeHtml(currentClassesText()).replace(/\n/g,'<br>') + '</div>' +
        '<div class="ulim-course-actions"><button type="button" class="ulim-course-btn" data-course-change="1">X · 반 변경</button><button type="button" class="ulim-course-btn primary" data-course-keep="1">O · 현재반 유지</button></div>'
      );
      overlay.querySelector('[data-course-keep]').onclick = function () { submitDecision('continue', []); };
      overlay.querySelector('[data-course-change]').onclick = function () { step = 4; render(); };
      return;
    }

    const classes = availableClasses();
    const classHtml = classes.length ? classes.map(function (item) {
      const labelText = text(item.className) + (text(item.instructorName) ? ' / ' + text(item.instructorName) : '');
      return '<label class="ulim-course-class"><input type="checkbox" data-course-class value="' + escapeHtml(item.classId) + '"><span>' + escapeHtml(labelText) + '</span></label>';
    }).join('') : '<div class="ulim-course-notice">현재 신청 가능한 반이 없습니다. 학원으로 문의해주세요.</div>';
    const overlay = shell(
      '<div class="ulim-course-question">' + escapeHtml(label) + '에 수강할 반을 선택해주세요.</div>' +
      '<div class="ulim-course-sub">한 개 또는 여러 개의 반을 선택할 수 있습니다.</div>' +
      '<div class="ulim-course-class-list">' + classHtml + '</div>' +
      '<div class="ulim-course-actions"><button type="button" class="ulim-course-btn" data-course-back="1">이전</button><button type="button" class="ulim-course-btn primary" data-course-submit="1"' + (classes.length ? '' : ' disabled') + '>수강신청 완료</button></div>'
    );
    overlay.querySelector('[data-course-back]').onclick = function () { step = 3; render(); };
    const submit = overlay.querySelector('[data-course-submit]');
    if (submit) submit.onclick = function () {
      const ids = Array.from(overlay.querySelectorAll('[data-course-class]:checked')).map(function (input) { return input.value; });
      if (!ids.length) return alert('수강할 반을 하나 이상 선택해주세요.');
      submitDecision('class_move', ids);
    };
  }

  function setBusy(value) {
    busy = !!value;
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.querySelectorAll('button,input').forEach(function (el) { el.disabled = busy; });
  }
  async function submitDecision(decision, requestedClassIds) {
    if (busy || !config) return;
    setBusy(true);
    try {
      const result = await call('submitStudentCourseApplication7352', {
        month: config.month,
        registrationDecision: decision,
        requestedClassIds: Array.isArray(requestedClassIds) ? requestedClassIds : [],
        submissionId: requestId('course-application-7355028'),
        idempotencyKey: config.month + '|' + text(config.studentUid || localStorage.getItem('studentName'))
      });
      config.needsApplication = false;
      config.existingApplication = Object.assign({}, config.existingApplication || {}, {
        applicationId: result.applicationId || '', state: 'submitted', registrationDecision: decision, requestedClassIds: requestedClassIds || []
      });
      const overlay = shell('<div class="ulim-course-complete"><b>수강신청이 완료되었습니다.</b><span>관리자 확인 후 ' + escapeHtml(monthLabel(config.month)) + '부터 반영됩니다.</span></div>');
      const closeButton = overlay.querySelector('[data-course-close]');
      if (closeButton) closeButton.style.display = 'none';
      setTimeout(function () { closePopup(false); }, 1100);
    } catch (error) {
      alert(text(error && error.message) || '수강신청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
      setBusy(false);
    }
  }

  async function loadConfig(force) {
    if (!isStudent() || dismissedThisPage) return null;
    if (passwordChangeActive()) { scheduleLoad(700, false); return null; }
    if (document.getElementById(MODAL_ID) && config && config.active === true && config.needsApplication === true) return config;
    if (loadingPromise) return loadingPromise;

    const generation = ++loadGeneration;
    loadingPromise = withTimeout(
      call('getStudentCourseApplicationConfig7352', {
        requestId: requestId('course-config-7355028'),
        force: force === true
      }),
      CONFIG_TIMEOUT_MS
    ).then(function (result) {
      if (generation !== loadGeneration || dismissedThisPage || passwordChangeActive()) return result || null;
      config = result || null;
      if (config && config.active === true && config.needsApplication === true) {
        if (!document.getElementById(MODAL_ID)) step = 1;
        render();
      } else {
        closePopup(false);
      }
      return config;
    }).catch(function () {
      return null;
    }).finally(function () {
      loadingPromise = null;
    });
    return loadingPromise;
  }

  function scheduleLoad(delay, force) {
    if (dismissedThisPage || document.getElementById(MODAL_ID)) return;
    if (scheduledLoadTimer) clearTimeout(scheduledLoadTimer);
    scheduledLoadTimer = setTimeout(function () {
      scheduledLoadTimer = null;
      if (dismissedThisPage || document.getElementById(MODAL_ID)) return;
      if (passwordChangeActive()) { scheduleLoad(700, false); return; }
      if (loadingPromise) return;
      if (isStudent()) loadConfig(force === true);
    }, Math.max(0, Number(delay) || 0));
  }
  function install() {
    injectStyle();
    global.ulimRefreshCourseApplication7355028 = function () { dismissedThisPage = false; return loadConfig(true); };
    scheduleLoad(900, false);
  }

  global.addEventListener('ulim-firebase-auth-ready', function () { scheduleLoad(350, false); });
  global.addEventListener('ulim-student-password-change-finished', function () { if (!dismissedThisPage) { config = null; scheduleLoad(350, true); } });
  global.addEventListener('pageshow', function () { scheduleLoad(650, false); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})(typeof window !== 'undefined' ? window : globalThis);
