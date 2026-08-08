(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_LOGIN_NOTICE_ROLE_ACCESS_7355031__) return;
  global.__ULIM_STUDENT_LOGIN_NOTICE_ROLE_ACCESS_7355031__ = true;

  const VERSION = '2026-08-09.7355031-student-login-notice-bootstrap';
  let noticeResolved = false;
  let noticeVisible = false;
  let resolveGeneration = 0;
  let ensurePromise = null;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function info() { if (global.adminInfo && typeof global.adminInfo === 'object') return global.adminInfo; try { return JSON.parse(localStorage.getItem('adminInfo') || '{}') || {}; } catch(_e){ return {}; } }
  function directAuth() { return global.__ULIM_STUDENT_FIREBASE_DIRECT_AUTH_7355030__ || null; }
  function directStudentActive() { const auth=directAuth(); return !!(auth && typeof auth.hasValidatedSession === 'function' && auth.hasValidatedSession()); }
  function isStaff() {
    /* A validated Firebase student session outranks stale adminInfo/body classes from a prior staff session. */
    if (directStudentActive()) return false;
    const role = normalize(info().firebaseRole || info().role);
    if (['teacher','admin','superadmin',normalize('강사'),normalize('관리자'),normalize('전체관리자'),normalize('전체관리'),normalize('원장')].includes(role)) return true;
    try { if (document.body && (document.body.classList.contains('admin-mode') || document.body.classList.contains('teacher-mode') || document.body.classList.contains('full-admin-mode'))) return true; } catch (_e) {}
    return false;
  }
  function isStudent() { return directStudentActive(); }
  function passwordChangeActive() { return global.__ULIM_STUDENT_PASSWORD_CHANGE_IN_PROGRESS_7355030__ === true; }
  function bootstrap() { return global.__ULIM_STUDENT_HOME_BOOTSTRAP_7355031__ || null; }
  function roomRealtime() { return global.ULIM_ROOM_CLASSROOM_REALTIME_72917 || global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || null; }
  async function fallbackNoticeContent() {
    const room=roomRealtime();if(!room||typeof room.preloadRuntime!=='function')return null;
    const rt=await room.preloadRuntime();if(!rt||!rt.auth||!rt.auth.currentUser||!rt.sdk||!rt.functions)return null;
    const fn=rt.sdk.httpsCallable(rt.functions,'getStudentLoginContent7355011');
    let timer=0;
    try {
      const response=await Promise.race([fn({force:false}),new Promise(function(_resolve,reject){timer=setTimeout(function(){reject(new Error('timeout'));},6500);})]);
      return response&&response.data||null;
    } finally { if(timer)clearTimeout(timer); }
  }
  function firstUsable7355031(promises) {
    return new Promise(function (resolve) {
      let settled = false; let remaining = promises.length;
      function finish(value) {
        if (settled) return;
        if (value) { settled = true; resolve(value); return; }
        remaining -= 1; if (remaining <= 0) { settled = true; resolve(null); }
      }
      promises.forEach(function (candidate) { Promise.resolve(candidate).then(finish).catch(function () { finish(null); }); });
      if (!promises.length) resolve(null);
    });
  }

  function removeLegacyCourseUi() {
    ['ulimCourseApplicationTabButton7352','tabCourseApplication7352','ulimCourseApplicationBanner7352'].forEach(function(id){const el=document.getElementById(id);if(el)el.remove();});
    document.querySelectorAll('.tab').forEach(function(tab){if(/수강\s*신청/.test(text(tab.textContent)))tab.remove();});
  }
  function activateTab(tabId) {
    const tab=document.querySelector('.tab[data-tab="'+tabId+'"]');const content=document.getElementById(tabId);if(!tab||!content)return false;
    document.querySelectorAll('.tab').forEach(function(el){el.classList.remove('active');});
    document.querySelectorAll('.tab-content').forEach(function(el){el.classList.remove('active');});
    tab.classList.add('active');content.classList.add('active');
    try{localStorage.setItem('ulimActiveTabId',tabId);}catch(_e){}
    return true;
  }
  function restoreStaffStudentTabs() {
    removeLegacyCourseUi();
    if(!isStaff())return;
    ['tab1','tab2','tab3','tab4','tabPronunciation','tabRoom'].forEach(function(tabId){
      const tab=document.querySelector('.tab[data-tab="'+tabId+'"]');const content=document.getElementById(tabId);if(!tab)return;
      tab.style.display='';tab.style.opacity='1';tab.style.pointerEvents='auto';tab.removeAttribute('disabled');if(content)content.style.display='';
      tab.onclick=function(event){if(event)event.preventDefault();activateTab(tabId);return false;};
    });
    try{if(typeof global.adminEnableAllTabsForAdminMode==='function')global.adminEnableAllTabsForAdminMode();}catch(_e){}
  }
  function targetMatched(notice, student) {
    const target=text(notice&&notice.target)||'전체';
    if(!target||target==='전체'||target.toLowerCase()==='all')return true;
    const wanted=normalize(target);const name=normalize(student&&student.name);
    if(name&&wanted.indexOf(name)>=0)return true;
    const instructors=(student&&Array.isArray(student.instructorNames)?student.instructorNames:[]).map(normalize);
    return instructors.some(function(value){return value&&(wanted.indexOf(value)>=0||value.indexOf(wanted)>=0);});
  }
  function noticeCard(notice) {
    let html='<div class="notice-card"><div class="notice-card-title">'+escapeHtml(notice.title||'공지사항')+'</div>';
    if(notice.content)html+='<div class="notice-text">'+escapeHtml(notice.content).replace(/\n/g,'<br>')+'</div>';
    if(notice.imageUrl)html+='<img src="'+escapeHtml(notice.imageUrl)+'" alt="'+escapeHtml(notice.title||'공지')+'">';
    if(notice.youtubeUrl)html+='<div class="notice-youtube-wrap"><iframe src="'+escapeHtml(notice.youtubeUrl)+'" title="'+escapeHtml(notice.title||'공지')+'" allowfullscreen></iframe></div>';
    if(notice.videoUrl)html+='<video controls playsinline><source src="'+escapeHtml(notice.videoUrl)+'"></video>';
    if(notice.linkUrl)html+='<a href="'+escapeHtml(notice.linkUrl)+'" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;margin-top:14px;padding:13px 16px;background:#2ecc71;color:#fff;border-radius:12px;text-decoration:none;font-weight:900">🔗 '+escapeHtml(notice.linkText||'자세히 보기')+'</a>';
    return html+'</div>';
  }
  function notifyResolved(reason) {
    if (noticeResolved) return;
    noticeResolved = true;
    noticeVisible = false;
    try { global.dispatchEvent(new CustomEvent('ulim-student-login-notice-resolved', { detail: { reason: text(reason), version: VERSION } })); } catch (_ignore) {}
  }
  function todayKey() { return typeof global.getTodayStringForNotice==='function' ? global.getTodayStringForNotice() : new Date().toISOString().slice(0,10); }

  async function ensureNotice() {
    if (!isStudent()) return null;
    if (noticeResolved || noticeVisible) return true;
    if (passwordChangeActive()) return null;
    if (ensurePromise) return ensurePromise;
    const generation = ++resolveGeneration;
    ensurePromise = (async function () {
      const boot = bootstrap();
      if (!boot || typeof boot.load !== 'function') return null;
      let home = typeof boot.peek === 'function' ? boot.peek() : null;
      if (!home) {
        /* Fast lane: start the combined home bootstrap and the existing Firebase notice callable together.
           Whichever valid response arrives first may render the notice; the combined bootstrap keeps running for course data. */
        home = await firstUsable7355031([
          Promise.resolve().then(function () { return boot.load(false); }).catch(function () { return null; }),
          Promise.resolve().then(function () { return fallbackNoticeContent(); }).then(function (fallback) {
            return fallback ? { appNotice: fallback.appNotice || {}, student: fallback.student || {} } : null;
          }).catch(function () { return null; })
        ]);
      }
      if (generation !== resolveGeneration || !isStudent() || passwordChangeActive()) return null;
      if (!home) { notifyResolved('notice-load-unavailable'); return null; }
      const notice = home && home.appNotice && typeof home.appNotice === 'object' ? home.appNotice : {};
      const student = home && home.student && typeof home.student === 'object' ? home.student : {};
      const hasContent = notice.enabled !== false && (notice.title || notice.content || notice.imageUrl || notice.videoUrl || notice.youtubeUrl || notice.linkUrl);
      if (!hasContent || !targetMatched(notice, student)) { notifyResolved('no-notice'); return true; }

      const id='APP_'+String(notice.updatedAtMs||0);
      const hideKey='noticeHideToday_'+todayKey()+'_'+id;
      try { if(localStorage.getItem(hideKey)==='Y'){ notifyResolved('hidden-today'); return true; } } catch(_e){}
      global.currentNoticeHideKey=hideKey;try{currentNoticeHideKey=hideKey;}catch(_e){}
      const body=document.getElementById('noticeBody'),check=document.getElementById('noticeTodayHide'),overlay=document.getElementById('noticeOverlay');
      if(body&&overlay){
        body.innerHTML=noticeCard(notice);if(check)check.checked=false;overlay.style.display='flex';noticeVisible=true;return true;
      }
      const fallback=document.createElement('div');
      fallback.id='ulimStudentLoginNoticeFallback7355031';
      fallback.style.cssText='position:fixed;inset:0;z-index:2147483600;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:18px';
      fallback.innerHTML='<section style="width:min(760px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:18px"><div style="display:flex;justify-content:space-between;gap:8px"><h3 style="margin:0">공지사항</h3><button type="button" style="border:0;border-radius:9px;padding:8px 12px" data-close="1">닫기</button></div>'+noticeCard(notice)+'</section>';
      fallback.onclick=function(e){if(e.target===fallback||e.target.closest('[data-close]')){fallback.remove();notifyResolved('fallback-close');}};
      document.body.appendChild(fallback);noticeVisible=true;return true;
    })().catch(function () { notifyResolved('notice-load-error'); return null; }).finally(function () { ensurePromise = null; });
    return ensurePromise;
  }

  function preloadNoticesFirestore7355031(){ if(isStudent()){const boot=bootstrap();if(boot&&typeof boot.load==='function')boot.load(false).catch(function(){});} }
  async function loadNoticesFirestore7355031(){
    if(!isStudent())return [];
    const boot=bootstrap();if(!boot||typeof boot.load!=='function')return [];
    const home=(typeof boot.peek==='function'&&boot.peek())||await boot.load(false);
    const notice=home&&home.appNotice||{};return notice&&notice.enabled!==false?[notice]:[];
  }
  function resetForStudent() { resolveGeneration += 1; noticeResolved=false; noticeVisible=false; ensurePromise=null; }
  function install() {
    removeLegacyCourseUi();restoreStaffStudentTabs();
    global.preloadNoticesFromSheet=preloadNoticesFirestore7355031;
    global.loadNoticesFromSheet=loadNoticesFirestore7355031;
    global.showNoticeIfNeeded=ensureNotice;
    global.ulimRefreshStudentLoginNotice7355031=function(){resetForStudent();const boot=bootstrap();return boot&&typeof boot.load==='function'?boot.load(true).then(ensureNotice):ensureNotice();};
    try{preloadNoticesFromSheet=global.preloadNoticesFromSheet;loadNoticesFromSheet=global.loadNoticesFromSheet;showNoticeIfNeeded=global.showNoticeIfNeeded;}catch(_e){}
    if(isStudent())ensureNotice();
  }

  global.__ULIM_STUDENT_LOGIN_NOTICE_FLOW_7355031__ = Object.freeze({
    version: VERSION,
    isResolved: function(){return noticeResolved;},
    isVisible: function(){return noticeVisible;},
    ensure: ensureNotice,
    reset: resetForStudent
  });

  global.addEventListener('ulim-student-home-bootstrap-ready',function(){if(isStudent()&&!passwordChangeActive())ensureNotice();});
  global.addEventListener('ulim-student-password-change-finished',function(){if(isStudent())ensureNotice();});
  global.addEventListener('ulim-student-login-notice-closed',function(){if(noticeVisible)notifyResolved('close');});
  global.addEventListener('pageshow',function(){restoreStaffStudentTabs();if(isStudent()&&!passwordChangeActive())ensureNotice();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(typeof window!=='undefined'?window:globalThis);
