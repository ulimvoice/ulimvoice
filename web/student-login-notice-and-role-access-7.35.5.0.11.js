(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_LOGIN_NOTICE_ROLE_ACCESS_7355011__) return;
  global.__ULIM_STUDENT_LOGIN_NOTICE_ROLE_ACCESS_7355011__ = true;

  var VERSION = '2026-08-07.735.05.0.11';
  var contentCache = null;
  var contentPromise = null;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function info() { if (global.adminInfo && typeof global.adminInfo === 'object') return global.adminInfo; try { return JSON.parse(localStorage.getItem('adminInfo') || '{}') || {}; } catch(_e){ return {}; } }
  function isStaff() {
    var role = normalize(info().firebaseRole || info().role);
    if (['teacher','admin','superadmin',normalize('강사'),normalize('관리자'),normalize('전체관리자'),normalize('전체관리'),normalize('원장')].indexOf(role) >= 0) return true;
    try {
      if (document.body && (document.body.classList.contains('admin-mode') || document.body.classList.contains('teacher-mode') || document.body.classList.contains('full-admin-mode'))) return true;
    } catch (_e) {}
    try { if (typeof global.adminModeActive !== 'undefined' && global.adminModeActive === true) return true; } catch (_e2) {}
    return false;
  }
  function isStudent() {
    try { if (typeof global.ulimIsStudentLoggedIn_ === 'function') return global.ulimIsStudentLoggedIn_(); } catch(_e){}
    return !!(localStorage.getItem('studentName') && localStorage.getItem('studentSessionToken')) && !isStaff();
  }
  function roomRealtime() { return global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || null; }
  async function runtime() {
    var room=roomRealtime();
    if(!room||typeof room.preloadRuntime!=='function')throw new Error('공지 기능을 준비하지 못했습니다.');
    var rt=await room.preloadRuntime();
    if(!rt||!rt.auth||!rt.auth.currentUser||!rt.sdk||!rt.functions)throw new Error('로그인이 필요합니다.');
    if(typeof room.getStableIdToken==='function')await room.getStableIdToken(rt,false,'student-login-content-7355011');
    return rt;
  }
  async function call(name,payload){var rt=await runtime();var fn=rt.sdk.httpsCallable(rt.functions,name);var response=await fn(payload||{});return response&&response.data||{};}

  function removeStudentCourseApplicationUi() {
    ['ulimCourseApplicationTabButton7352','tabCourseApplication7352','ulimCourseApplicationBanner7352'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});
    document.querySelectorAll('.tab').forEach(function(tab){if(/수강\s*신청/.test(text(tab.textContent)))tab.remove();});
  }

  function activateTab(tabId) {
    var tab=document.querySelector('.tab[data-tab="'+tabId+'"]');var content=document.getElementById(tabId);if(!tab||!content)return false;
    document.querySelectorAll('.tab').forEach(function(el){el.classList.remove('active');});
    document.querySelectorAll('.tab-content').forEach(function(el){el.classList.remove('active');});
    tab.classList.add('active');content.classList.add('active');
    try{localStorage.setItem('ulimActiveTabId',tabId);}catch(_e){}
    return true;
  }
  function restoreStaffStudentTabs() {
    removeStudentCourseApplicationUi();
    if(!isStaff())return;
    var ids=['tab1','tab2','tab3','tab4','tabPronunciation','tabRoom'];
    ids.forEach(function(tabId){
      var tab=document.querySelector('.tab[data-tab="'+tabId+'"]');var content=document.getElementById(tabId);if(!tab)return;
      tab.style.display='';tab.style.opacity='1';tab.style.pointerEvents='auto';tab.removeAttribute('disabled');
      if(content)content.style.display='';
      tab.onclick=function(event){if(event)event.preventDefault();activateTab(tabId);return false;};
    });
    try{if(typeof global.adminEnableAllTabsForAdminMode==='function')global.adminEnableAllTabsForAdminMode();}catch(_e){}
  }

  function targetMatched(notice, student) {
    var target=text(notice&&notice.target)||'전체';
    if(!target||target==='전체'||target.toLowerCase()==='all')return true;
    var wanted=normalize(target);var name=normalize(student&&student.name||localStorage.getItem('studentName'));
    if(name&&wanted.indexOf(name)>=0)return true;
    var instructors=(student&&Array.isArray(student.instructorNames)?student.instructorNames:[]).map(normalize);
    return instructors.some(function(value){return value&&(wanted.indexOf(value)>=0||value.indexOf(wanted)>=0);});
  }
  function noticeCard(notice) {
    var html='<div class="notice-card"><div class="notice-card-title">'+escapeHtml(notice.title||'공지사항')+'</div>';
    if(notice.content)html+='<div class="notice-text">'+escapeHtml(notice.content).replace(/\n/g,'<br>')+'</div>';
    if(notice.classNames&&notice.classNames.length)html+='<div class="notice-text" style="margin-top:10px"><b>등록 수강반</b><br>'+notice.classNames.map(escapeHtml).join('<br>')+'</div>';
    if(notice.imageUrl)html+='<img src="'+escapeHtml(notice.imageUrl)+'" alt="'+escapeHtml(notice.title||'공지')+'">';
    if(notice.youtubeUrl)html+='<div class="notice-youtube-wrap"><iframe src="'+escapeHtml(notice.youtubeUrl)+'" title="'+escapeHtml(notice.title||'공지')+'" allowfullscreen></iframe></div>';
    if(notice.videoUrl)html+='<video controls playsinline><source src="'+escapeHtml(notice.videoUrl)+'"></video>';
    if(notice.linkUrl)html+='<a href="'+escapeHtml(notice.linkUrl)+'" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;margin-top:14px;padding:13px 16px;background:#2ecc71;color:#fff;border-radius:12px;text-decoration:none;font-weight:900">🔗 '+escapeHtml(notice.linkText||'자세히 보기')+'</a>';
    return html+'</div>';
  }

  async function loadLoginContent(force) {
    if(!isStudent())return {appNotice:null,studentNotices:[]};
    if(!force&&contentCache)return contentCache;
    if(!force&&contentPromise)return contentPromise;
    contentPromise=call('getStudentLoginContent7355011',{force:force===true}).then(function(data){contentCache=data||{};return contentCache;}).finally(function(){contentPromise=null;});
    return contentPromise;
  }
  function preloadNoticesFirestore7355011(){if(isStudent())loadLoginContent(false).catch(function(){});}
  async function showNoticesFirestore7355011(){
    if(!isStudent())return;
    try{
      var data=await loadLoginContent(false);var list=[];var appNotice=data.appNotice||{};
      if(appNotice.enabled!==false&&(appNotice.title||appNotice.content||appNotice.imageUrl||appNotice.videoUrl||appNotice.youtubeUrl)&&targetMatched(appNotice,data.student||{})){
        list.push(Object.assign({id:'APP_'+String(appNotice.updatedAtMs||0)},appNotice));
      }
      var courseNoticeIds=[];
      (Array.isArray(data.studentNotices)?data.studentNotices:[]).forEach(function(row){
        var noticeId=row.id||('COURSE_'+String(row.createdAtMs||0));
        courseNoticeIds.push(noticeId);
        list.push({id:noticeId,title:row.title||'수강 등록 안내',content:row.content||'',classNames:row.classNames||[]});
      });
      if(!list.length)return;
      var today=(typeof global.getTodayStringForNotice==='function'?global.getTodayStringForNotice():new Date().toISOString().slice(0,10));
      var ids=list.map(function(row){return row.id;}).join('_');
      var hideKey='noticeHideToday_'+today+'_'+ids;
      try{if(localStorage.getItem(hideKey)==='Y')return;}catch(_e){}
      global.currentNoticeHideKey=hideKey;
      try{currentNoticeHideKey=hideKey;}catch(_e){}
      var body=document.getElementById('noticeBody'),check=document.getElementById('noticeTodayHide'),overlay=document.getElementById('noticeOverlay');
      function acknowledgeCourseNotices7355011(){
        if(!courseNoticeIds.length)return;
        call('ackStudentLoginNotices7355011',{noticeIds:courseNoticeIds}).catch(function(){});
      }
      if(body&&overlay){body.innerHTML=list.map(noticeCard).join('');if(check)check.checked=false;overlay.style.display='flex';acknowledgeCourseNotices7355011();return;}
      var fallback=document.createElement('div');fallback.id='ulimStudentLoginNoticeFallback7355011';fallback.style.cssText='position:fixed;inset:0;z-index:2147483600;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:18px';fallback.innerHTML='<section style="width:min(760px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:18px"><div style="display:flex;justify-content:space-between;gap:8px"><h3 style="margin:0">공지사항</h3><button type="button" style="border:0;border-radius:9px;padding:8px 12px" data-close="1">닫기</button></div>'+list.map(noticeCard).join('')+'</section>';fallback.onclick=function(e){if(e.target===fallback||e.target.closest('[data-close]'))fallback.remove();};document.body.appendChild(fallback);acknowledgeCourseNotices7355011();
    }catch(error){/* 학생 화면에 기술 오류를 노출하지 않습니다. */}
  }

  function install() {
    removeStudentCourseApplicationUi();restoreStaffStudentTabs();
    global.preloadNoticesFromSheet=preloadNoticesFirestore7355011;
    global.loadNoticesFromSheet=function(){return loadLoginContent(false).then(function(data){var rows=[];if(data.appNotice&&data.appNotice.enabled!==false)rows.push(data.appNotice);return rows;});};
    global.showNoticeIfNeeded=showNoticesFirestore7355011;
    try{preloadNoticesFromSheet=global.preloadNoticesFromSheet;loadNoticesFromSheet=global.loadNoticesFromSheet;showNoticeIfNeeded=global.showNoticeIfNeeded;}catch(_e){}
    if(isStudent())setTimeout(function(){preloadNoticesFirestore7355011();showNoticesFirestore7355011();},500);
  }
  var tabRestoreTimer7355011 = 0;
  function scheduleTabRestore7355011() {
    clearTimeout(tabRestoreTimer7355011);
    tabRestoreTimer7355011 = setTimeout(function () {
      removeStudentCourseApplicationUi();
      restoreStaffStudentTabs();
    }, 0);
  }
  function observeTabVisibility7355011() {
    if (global.__ULIM_TAB_VISIBILITY_OBSERVER_7355011__ || typeof MutationObserver !== 'function') return;
    global.__ULIM_TAB_VISIBILITY_OBSERVER_7355011__ = true;
    var root = document.querySelector('.tabs') || document.body || document.documentElement;
    if (!root) return;
    var observer = new MutationObserver(function () { scheduleTabRestore7355011(); });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','class','disabled','hidden'] });
  }

  global.addEventListener('ulim-firebase-auth-ready',function(){setTimeout(function(){install();scheduleTabRestore7355011();},100);});
  global.addEventListener('pageshow',function(){setTimeout(function(){install();scheduleTabRestore7355011();},120);});
  document.addEventListener('click',function(){scheduleTabRestore7355011();},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){install();observeTabVisibility7355011();},{once:true});else{install();observeTabVisibility7355011();}
  setTimeout(function(){install();observeTabVisibility7355011();},800);
})(typeof window!=='undefined'?window:globalThis);
