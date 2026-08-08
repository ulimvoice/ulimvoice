(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_LOGIN_NOTICE_ROLE_ACCESS_7355012__) return;
  global.__ULIM_STUDENT_LOGIN_NOTICE_ROLE_ACCESS_7355012__ = true;

  const VERSION = '2026-08-09.735.05.0.30-r8-notice-load-stable';
  let contentCache = null;
  let contentPromise = null;
  let noticeShownThisPage = false;
  let noticeScheduleTimer = null;
  const NOTICE_TIMEOUT_MS = 12000;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function info() { if (global.adminInfo && typeof global.adminInfo === 'object') return global.adminInfo; try { return JSON.parse(localStorage.getItem('adminInfo') || '{}') || {}; } catch(_e){ return {}; } }
  function isStaff() {
    const role = normalize(info().firebaseRole || info().role);
    if (['teacher','admin','superadmin',normalize('강사'),normalize('관리자'),normalize('전체관리자'),normalize('전체관리'),normalize('원장')].includes(role)) return true;
    try { if (document.body && (document.body.classList.contains('admin-mode') || document.body.classList.contains('teacher-mode') || document.body.classList.contains('full-admin-mode'))) return true; } catch (_e) {}
    try { if (typeof global.adminModeActive !== 'undefined' && global.adminModeActive === true) return true; } catch (_e2) {}
    return false;
  }
  function isStudent() {
    const direct = global.__ULIM_STUDENT_FIREBASE_DIRECT_AUTH_7355030__ || null;
    if (direct && typeof direct.hasValidatedSession === 'function') return direct.hasValidatedSession() && !isStaff();
    try { if (typeof global.ulimIsStudentLoggedIn_ === 'function') return global.ulimIsStudentLoggedIn_() && !isStaff(); } catch(_e){}
    return false;
  }
  function roomRealtime() { return global.ULIM_ROOM_CLASSROOM_REALTIME_72917 || global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || null; }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('공지 기능을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'student-login-content-7355012');
    return rt;
  }
  async function call(name,payload){const rt=await runtime();const fn=rt.sdk.httpsCallable(rt.functions,name);const response=await fn(payload||{});return response&&response.data||{};}
  function withTimeout(promise,timeoutMs){let timer=null;return Promise.race([Promise.resolve(promise),new Promise(function(_resolve,reject){timer=setTimeout(function(){reject(new Error('공지사항을 불러오는 데 시간이 오래 걸리고 있습니다.'));},timeoutMs);})]).finally(function(){if(timer)clearTimeout(timer);});}

  // 과거 별도 수강신청 탭/배너는 더 이상 사용하지 않습니다. 로그인 수강신청은 전용 팝업 owner가 담당합니다.
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
      tab.style.display='';tab.style.opacity='1';tab.style.pointerEvents='auto';tab.removeAttribute('disabled');
      if(content)content.style.display='';
      tab.onclick=function(event){if(event)event.preventDefault();activateTab(tabId);return false;};
    });
    try{if(typeof global.adminEnableAllTabsForAdminMode==='function')global.adminEnableAllTabsForAdminMode();}catch(_e){}
  }

  function targetMatched(notice, student) {
    const target=text(notice&&notice.target)||'전체';
    if(!target||target==='전체'||target.toLowerCase()==='all')return true;
    const wanted=normalize(target);const name=normalize(student&&student.name||localStorage.getItem('studentName'));
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

  async function loadLoginContent(force) {
    if(!isStudent())return {appNotice:null,studentNotices:[]};
    if(contentPromise)return contentPromise;
    if(!force&&contentCache)return contentCache;
    contentPromise=withTimeout(call('getStudentLoginContent7355011',{force:force===true}),NOTICE_TIMEOUT_MS)
      .then(function(data){contentCache=data||{};return contentCache;})
      .finally(function(){contentPromise=null;});
    return contentPromise;
  }
  function preloadNoticesFirestore7355012(){if(isStudent())loadLoginContent(false).catch(function(){});}
  async function showNoticesFirestore7355012(){
    if(!isStudent()||noticeShownThisPage)return;
    try{
      const data=await loadLoginContent(false);const list=[];const appNotice=data.appNotice||{};
      if(appNotice.enabled!==false&&(appNotice.title||appNotice.content||appNotice.imageUrl||appNotice.videoUrl||appNotice.youtubeUrl)&&targetMatched(appNotice,data.student||{})){
        list.push(Object.assign({id:'APP_'+String(appNotice.updatedAtMs||0)},appNotice));
      }
      // 0.12: 과거 "학생 수강 등록/로그인 안내"가 만든 studentNotices는 더 이상 학생 화면에 표시하지 않습니다.
      // 수강신청 안내는 student-course-application-7.35.5.0.28.js가 단독 소유합니다.
      if(!list.length){noticeShownThisPage=true;return;}
      const today=(typeof global.getTodayStringForNotice==='function'?global.getTodayStringForNotice():new Date().toISOString().slice(0,10));
      const ids=list.map(function(row){return row.id;}).join('_');
      const hideKey='noticeHideToday_'+today+'_'+ids;
      try{if(localStorage.getItem(hideKey)==='Y'){noticeShownThisPage=true;return;}}catch(_e){}
      global.currentNoticeHideKey=hideKey;try{currentNoticeHideKey=hideKey;}catch(_e){}
      const body=document.getElementById('noticeBody'),check=document.getElementById('noticeTodayHide'),overlay=document.getElementById('noticeOverlay');
      if(body&&overlay){body.innerHTML=list.map(noticeCard).join('');if(check)check.checked=false;overlay.style.display='flex';noticeShownThisPage=true;return;}
      const fallback=document.createElement('div');fallback.id='ulimStudentLoginNoticeFallback7355012';fallback.style.cssText='position:fixed;inset:0;z-index:2147483600;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:18px';fallback.innerHTML='<section style="width:min(760px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:18px"><div style="display:flex;justify-content:space-between;gap:8px"><h3 style="margin:0">공지사항</h3><button type="button" style="border:0;border-radius:9px;padding:8px 12px" data-close="1">닫기</button></div>'+list.map(noticeCard).join('')+'</section>';fallback.onclick=function(e){if(e.target===fallback||e.target.closest('[data-close]'))fallback.remove();};document.body.appendChild(fallback);noticeShownThisPage=true;
    }catch(_error){/* 학생 화면에 기술 오류를 노출하지 않습니다. */}
  }

  function scheduleStudentNotice7355012(delay) {
    if(noticeShownThisPage||!isStudent())return;
    if(noticeScheduleTimer)clearTimeout(noticeScheduleTimer);
    noticeScheduleTimer=setTimeout(function(){
      noticeScheduleTimer=null;
      if(noticeShownThisPage||!isStudent()||contentPromise)return;
      showNoticesFirestore7355012();
    },Math.max(0,Number(delay)||0));
  }
  function install() {
    removeLegacyCourseUi();restoreStaffStudentTabs();
    global.preloadNoticesFromSheet=preloadNoticesFirestore7355012;
    global.loadNoticesFromSheet=function(){return loadLoginContent(false).then(function(data){const rows=[];if(data.appNotice&&data.appNotice.enabled!==false)rows.push(data.appNotice);return rows;});};
    global.showNoticeIfNeeded=showNoticesFirestore7355012;
    global.ulimRefreshStudentLoginNotice7355012=function(){contentCache=null;noticeShownThisPage=false;return showNoticesFirestore7355012();};
    try{preloadNoticesFromSheet=global.preloadNoticesFromSheet;loadNoticesFromSheet=global.loadNoticesFromSheet;showNoticeIfNeeded=global.showNoticeIfNeeded;}catch(_e){}
    scheduleStudentNotice7355012(650);
  }
  let tabRestoreTimer7355012 = 0;
  function scheduleTabRestore7355012() {
    clearTimeout(tabRestoreTimer7355012);
    tabRestoreTimer7355012 = setTimeout(function () { removeLegacyCourseUi(); restoreStaffStudentTabs(); }, 0);
  }
  function observeTabVisibility7355012() {
    if (global.__ULIM_TAB_VISIBILITY_OBSERVER_7355012__ || typeof MutationObserver !== 'function') return;
    global.__ULIM_TAB_VISIBILITY_OBSERVER_7355012__ = true;
    const root = document.querySelector('.tabs') || document.body || document.documentElement;
    if (!root) return;
    const observer = new MutationObserver(function () { scheduleTabRestore7355012(); });
    observer.observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:['style','class','disabled','hidden'] });
  }

  global.addEventListener('ulim-firebase-auth-ready',function(){scheduleStudentNotice7355012(450);scheduleTabRestore7355012();});
  global.addEventListener('pageshow',function(){setTimeout(function(){restoreStaffStudentTabs();scheduleStudentNotice7355012(650);scheduleTabRestore7355012();},120);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){install();observeTabVisibility7355012();},{once:true});else{install();observeTabVisibility7355012();}
  setTimeout(function(){restoreStaffStudentTabs();observeTabVisibility7355012();scheduleStudentNotice7355012(900);},800);
})(typeof window!=='undefined'?window:globalThis);
