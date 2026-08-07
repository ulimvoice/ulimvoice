(function (global) {
  'use strict';
  if (global.__ULIM_OPERATIONAL_CONTENT_ADMIN_7355011__) return;
  global.__ULIM_OPERATIONAL_CONTENT_ADMIN_7355011__ = true;

  var VERSION = '2026-08-07.735.05.0.11';
  var PANEL_ID = 'adminPanelOperationalContent7355011';
  var BUTTON_ID = 'adminOperationalContentSubtab7355011';
  var directory = null;
  var contentData = null;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function unique(values) { return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))); }
  function requestId(prefix) { return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
  function today() { var d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); }
  function info() {
    if (global.adminInfo && typeof global.adminInfo === 'object') return global.adminInfo;
    try { return JSON.parse(localStorage.getItem('adminInfo') || '{}') || {}; } catch (_e) { return {}; }
  }
  function isFullAdmin() {
    var role = normalize(info().firebaseRole || info().role || info().permission);
    return ['admin','superadmin',normalize('전체관리자'),normalize('전체관리'),normalize('원장')].indexOf(role) >= 0;
  }
  function roomRealtime() { return global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || null; }
  async function runtime() {
    var room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('관리자 기능을 준비하지 못했습니다.');
    var rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('관리자 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'operational-content-admin-7355011');
    return rt;
  }
  async function call(name, payload) {
    var rt = await runtime();
    var fn = rt.sdk.httpsCallable(rt.functions, name);
    var response = await fn(payload || {});
    return response && response.data || {};
  }
  function loading(message) { try { if (typeof global.showLoading === 'function') global.showLoading(message); } catch (_e) {} }
  function loadingDone() { try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_e) {} }

  function injectStyles() {
    if (document.getElementById('ulimOperationalContentStyle7355011')) return;
    var style = document.createElement('style');
    style.id = 'ulimOperationalContentStyle7355011';
    style.textContent = [
      '#'+PANEL_ID+' .ulim-content-grid7355011{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
      '#'+PANEL_ID+' .ulim-content-card7355011{border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:16px}',
      '#'+PANEL_ID+' .ulim-content-card7355011.wide{grid-column:1/-1}',
      '#'+PANEL_ID+' .ulim-content-card7355011 h3{margin:0 0 12px;color:#0f172a}',
      '#'+PANEL_ID+' .ulim-field7355011{margin:9px 0}',
      '#'+PANEL_ID+' .ulim-field7355011 label{display:block;font-size:12px;font-weight:900;color:#475569;margin-bottom:5px}',
      '#'+PANEL_ID+' input,#'+PANEL_ID+' textarea,#'+PANEL_ID+' select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:9px;background:#fff}',
      '#'+PANEL_ID+' textarea{min-height:110px;resize:vertical}',
      '#'+PANEL_ID+' select[multiple]{min-height:190px}',
      '#ulimTabletAdRows7355011{display:grid;gap:9px}',
      '.ulim-tablet-ad-row7355011{display:grid;grid-template-columns:1.1fr 1.4fr 1.4fr 90px auto;gap:7px;align-items:end;padding:9px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}',
      '.ulim-tablet-ad-row7355011 textarea{grid-column:1/-1;min-height:62px!important}',
      '.ulim-content-note7355011{font-size:12px;color:#64748b;line-height:1.55}',
      '@media(max-width:850px){#'+PANEL_ID+' .ulim-content-grid7355011{grid-template-columns:1fr}#'+PANEL_ID+' .ulim-content-card7355011.wide{grid-column:1}.ulim-tablet-ad-row7355011{grid-template-columns:1fr 1fr}.ulim-tablet-ad-row7355011 textarea{grid-column:1/-1}}'
    ].join('');
    document.head.appendChild(style);
  }

  function panelHtml() {
    return '<div class="admin-card"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><h2 style="margin:0">앱 공지 · 수강안내 · 태블릿 광고</h2><div class="ulim-content-note7355011">운영값은 Firestore에 저장됩니다. Google Sheets 공지/태블릿 광고는 사용하지 않습니다.</div></div><button type="button" class="admin-btn blue" id="ulimContentReload7355011">다시 불러오기</button></div>'+
      '<div class="ulim-content-grid7355011" style="margin-top:14px">'+
      '<section class="ulim-content-card7355011"><h3>앱 공지사항</h3><div class="ulim-field7355011"><label><input type="checkbox" id="ulimNoticeEnabled7355011" style="width:auto"> 공지 사용</label></div><div class="ulim-field7355011"><label>제목</label><input id="ulimNoticeTitle7355011"></div><div class="ulim-field7355011"><label>내용</label><textarea id="ulimNoticeContent7355011"></textarea></div><div class="ulim-field7355011"><label>대상</label><input id="ulimNoticeTarget7355011" placeholder="전체 또는 학생명/강사명"></div><div class="ulim-field7355011"><label>이미지 URL</label><input id="ulimNoticeImage7355011"></div><div class="ulim-field7355011"><label>YouTube URL</label><input id="ulimNoticeYoutube7355011"></div><div class="ulim-field7355011"><label>영상 URL</label><input id="ulimNoticeVideo7355011"></div><div class="ulim-field7355011"><label>링크 URL</label><input id="ulimNoticeLink7355011"></div><div class="ulim-field7355011"><label>링크 문구</label><input id="ulimNoticeLinkText7355011"></div><button type="button" class="admin-btn green" id="ulimNoticeSave7355011">공지 저장</button></section>'+
      '<section class="ulim-content-card7355011"><h3>학생 수강 등록 / 로그인 안내</h3><div class="ulim-content-note7355011">학생이 직접 수강신청하지 않습니다. 여기서 수강반을 등록하면 학생 로그인 시 공지 팝업으로 안내합니다.</div><div class="ulim-field7355011"><label>학생</label><select id="ulimCourseStudent7355011"><option value="">학생목록 불러오는 중...</option></select></div><div class="ulim-field7355011"><label>수강반</label><select id="ulimCourseClasses7355011" multiple></select></div><div class="ulim-field7355011"><label>학생에게 보일 안내문</label><textarea id="ulimCourseNoticeText7355011" placeholder="비워두면 선택한 수강반으로 자동 안내문을 만듭니다."></textarea></div><button type="button" class="admin-btn green" id="ulimCourseRegister7355011">수강 등록 + 로그인 공지 생성</button></section>'+
      '<section class="ulim-content-card7355011 wide"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h3>태블릿 홍보/광고</h3><div class="ulim-content-note7355011">제목·내용·이미지·영상 중 필요한 항목만 입력하세요. 태블릿은 Firestore에서 이 목록을 불러옵니다.</div></div><button type="button" class="admin-btn blue" id="ulimTabletAdAdd7355011">광고 슬라이드 추가</button></div><div id="ulimTabletAdRows7355011" style="margin-top:10px"></div><button type="button" class="admin-btn green" id="ulimTabletAdsSave7355011" style="margin-top:10px">태블릿 광고 저장</button></section>'+
      '</div></div>';
  }

  function injectUi() {
    if (!isFullAdmin()) return false;
    injectStyles();
    var subtabs = document.querySelector('#adminDashboard .admin-subtabs');
    var dashboard = document.getElementById('adminDashboard');
    if (!subtabs || !dashboard) return false;
    if (!document.getElementById(BUTTON_ID)) {
      var button = document.createElement('button');
      button.type = 'button'; button.id = BUTTON_ID; button.className = 'admin-subtab admin-full-only'; button.dataset.adminPanel = PANEL_ID; button.textContent = '앱/태블릿 설정';
      button.addEventListener('click', function () { if (typeof global.showAdminPanel === 'function') global.showAdminPanel(PANEL_ID); loadAll(false); });
      subtabs.appendChild(button);
    }
    if (!document.getElementById(PANEL_ID)) {
      var panel = document.createElement('div'); panel.id = PANEL_ID; panel.className = 'admin-panel'; panel.innerHTML = panelHtml(); dashboard.appendChild(panel);
      bindUi();
    }
    return true;
  }

  function bindUi() {
    document.getElementById('ulimContentReload7355011').onclick = function () { loadAll(true); };
    document.getElementById('ulimNoticeSave7355011').onclick = saveNotice;
    document.getElementById('ulimTabletAdAdd7355011').onclick = function () { addAdRow({}); };
    document.getElementById('ulimTabletAdsSave7355011').onclick = saveAds;
    document.getElementById('ulimCourseStudent7355011').onchange = syncCourseStudent;
    document.getElementById('ulimCourseRegister7355011').onclick = registerCourse;
  }

  function fillNotice(notice) {
    notice = notice || {};
    document.getElementById('ulimNoticeEnabled7355011').checked = notice.enabled !== false;
    document.getElementById('ulimNoticeTitle7355011').value = text(notice.title);
    document.getElementById('ulimNoticeContent7355011').value = text(notice.content);
    document.getElementById('ulimNoticeTarget7355011').value = text(notice.target) || '전체';
    document.getElementById('ulimNoticeImage7355011').value = text(notice.imageUrl);
    document.getElementById('ulimNoticeYoutube7355011').value = text(notice.youtubeUrl);
    document.getElementById('ulimNoticeVideo7355011').value = text(notice.videoUrl);
    document.getElementById('ulimNoticeLink7355011').value = text(notice.linkUrl);
    document.getElementById('ulimNoticeLinkText7355011').value = text(notice.linkText);
  }

  function addAdRow(slide) {
    var wrap = document.getElementById('ulimTabletAdRows7355011'); if (!wrap) return;
    slide = slide || {};
    var row = document.createElement('div'); row.className = 'ulim-tablet-ad-row7355011';
    row.innerHTML = '<div class="ulim-field7355011"><label>제목</label><input data-ad-field="title" value="'+escapeHtml(slide.title || '')+'"></div><div class="ulim-field7355011"><label>이미지 URL</label><input data-ad-field="imageUrl" value="'+escapeHtml(slide.imageUrl || '')+'"></div><div class="ulim-field7355011"><label>영상/YouTube URL</label><input data-ad-field="videoUrl" value="'+escapeHtml(slide.videoUrl || '')+'"></div><div class="ulim-field7355011"><label>초</label><input data-ad-field="seconds" type="number" min="5" max="120" value="'+escapeHtml(slide.seconds || 10)+'"></div><button type="button" class="admin-btn red" data-ad-remove="1">삭제</button><textarea data-ad-field="content" placeholder="텍스트 광고/안내 내용">'+escapeHtml(slide.content || '')+'</textarea>';
    row.querySelector('[data-ad-remove]').onclick = function () { row.remove(); };
    wrap.appendChild(row);
  }
  function fillAds(slides) {
    var wrap = document.getElementById('ulimTabletAdRows7355011'); if (!wrap) return;
    wrap.innerHTML = '';
    (Array.isArray(slides) && slides.length ? slides : [{}]).forEach(addAdRow);
  }

  function fillDirectory(data) {
    directory = data || { students:[], classes:[] };
    var studentSelect = document.getElementById('ulimCourseStudent7355011');
    var classSelect = document.getElementById('ulimCourseClasses7355011');
    var students = (directory.students || []).filter(function (student) { return student.registrationCancelled !== true && text(student.enrollmentStatus) !== 'withdrawn'; }).sort(function(a,b){return text(a.name||a.studentName).localeCompare(text(b.name||b.studentName),'ko');});
    studentSelect.innerHTML = '<option value="">학생 선택</option>' + students.map(function(student){return '<option value="'+escapeHtml(student.studentUid)+'">'+escapeHtml(text(student.name||student.studentName))+' / 출결 '+escapeHtml(text(student.attendanceNo||student.studentNo))+'</option>';}).join('');
    classSelect.innerHTML = (directory.classes || []).filter(function(cls){return cls.selectable !== false;}).map(function(cls){return '<option value="'+escapeHtml(cls.classId)+'">'+escapeHtml(cls.className)+'</option>';}).join('');
  }
  function syncCourseStudent() {
    if (!directory) return;
    var uid = text(document.getElementById('ulimCourseStudent7355011').value);
    var student = (directory.students || []).find(function(row){return text(row.studentUid)===uid;});
    var selected = new Set(unique(student && (student.selectedClassIds || student.classIds)));
    Array.from(document.getElementById('ulimCourseClasses7355011').options).forEach(function(option){option.selected=selected.has(option.value);});
  }

  async function loadAll(force) {
    if (!injectUi()) return;
    loading('앱/태블릿 설정 불러오는 중...');
    try {
      var values = await Promise.all([
        call('getOperationalContentAdmin7355011', { force: force === true, requestId: requestId('content-admin-load-7355011') }),
        call('listStudentManagementAdmin7352', { requestId: requestId('content-student-list-7355011') })
      ]);
      contentData = values[0] || {};
      fillNotice(contentData.notice || {});
      fillAds(contentData.tabletAds || []);
      fillDirectory(values[1] || {});
    } catch (error) { alert(text(error && error.message) || '설정 정보를 불러오지 못했습니다.'); }
    finally { loadingDone(); }
  }

  async function saveNotice() {
    var notice = {
      enabled: document.getElementById('ulimNoticeEnabled7355011').checked,
      title: text(document.getElementById('ulimNoticeTitle7355011').value),
      content: text(document.getElementById('ulimNoticeContent7355011').value),
      target: text(document.getElementById('ulimNoticeTarget7355011').value) || '전체',
      imageUrl: text(document.getElementById('ulimNoticeImage7355011').value), youtubeUrl: text(document.getElementById('ulimNoticeYoutube7355011').value),
      videoUrl: text(document.getElementById('ulimNoticeVideo7355011').value), linkUrl: text(document.getElementById('ulimNoticeLink7355011').value), linkText: text(document.getElementById('ulimNoticeLinkText7355011').value)
    };
    loading('공지사항 저장 중...');
    try { await call('saveOperationalContentAdmin7355011', { kind:'notice', notice:notice, requestId:requestId('notice-save-7355011') }); alert('앱 공지사항을 저장했습니다.'); }
    catch(error){alert(text(error&&error.message)||'공지 저장에 실패했습니다.');}
    finally{loadingDone();}
  }

  function readAdRows() {
    return Array.from(document.querySelectorAll('#ulimTabletAdRows7355011 .ulim-tablet-ad-row7355011')).map(function(row){
      function value(name){var el=row.querySelector('[data-ad-field="'+name+'"]');return text(el&&el.value);}
      return { title:value('title'), content:value('content'), imageUrl:value('imageUrl'), videoUrl:value('videoUrl'), seconds:Number(value('seconds')||10), type:'공지' };
    }).filter(function(slide){return slide.title||slide.content||slide.imageUrl||slide.videoUrl;});
  }
  async function saveAds() {
    var slides = readAdRows();
    if (!slides.length && !confirm('태블릿 광고를 모두 비울까요?')) return;
    loading('태블릿 광고 저장 중...');
    try { await call('saveOperationalContentAdmin7355011', { kind:'tabletAds', slides:slides, requestId:requestId('tablet-ads-save-7355011') }); alert('태블릿 광고를 저장했습니다.'); }
    catch(error){alert(text(error&&error.message)||'태블릿 광고 저장에 실패했습니다.');}
    finally{loadingDone();}
  }

  async function registerCourse() {
    if (!directory) return alert('학생목록을 다시 불러와주세요.');
    var uid = text(document.getElementById('ulimCourseStudent7355011').value);
    var student = (directory.students || []).find(function(row){return text(row.studentUid)===uid;});
    if (!student) return alert('학생을 선택해주세요.');
    var classSelect = document.getElementById('ulimCourseClasses7355011');
    var classIds = Array.from(classSelect.selectedOptions || []).map(function(option){return option.value;});
    if (!classIds.length) return alert('수강반을 하나 이상 선택해주세요.');
    var classes = (directory.classes || []).filter(function(cls){return classIds.indexOf(text(cls.classId))>=0;});
    var classNames = classes.map(function(cls){return text(cls.className);}).filter(Boolean);
    var content = text(document.getElementById('ulimCourseNoticeText7355011').value) || ('수강 등록이 완료되었습니다.\n\n' + classNames.join('\n'));
    if (!confirm(text(student.name||student.studentName)+' 학생의 수강반을 아래와 같이 저장할까요?\n\n'+classNames.join('\n'))) return;
    loading('수강 등록 및 로그인 안내 생성 중...');
    try {
      var currentIds = unique(student.selectedClassIds || student.classIds);
      await call('updateStudentAdmin7352', {
        studentUid:uid, name:text(student.name||student.studentName), attendanceNo:text(student.attendanceNo||student.studentNo), changeAttendanceNo:false,
        studentPhone:text(student.studentPhone||student.phone), parentPhone:text(student.parentPhone), birthDate:text(student.birthDate||student.dateOfBirth),
        initialRegisteredDate:text(student.initialRegisteredDate||student.registeredDate)||today(), enrollmentStatus:text(student.enrollmentStatus||student.status)||'active',
        classIds:classIds, originalClassIds:currentIds, replaceClassAssignments:true, registrationType:'existing', memo:text(student.memo||student.adminMemo),
        privacyConsent:student.privacyConsent===true, portraitConsent:student.portraitConsent===true, preserveLegacyClassNames:unique(student.legacyUnmappedClassNames), requestId:requestId('admin-course-register-7355011')
      });
      await call('createStudentCourseNoticeAdmin7355011', { studentUid:uid, title:'수강 등록 안내', content:content, classNames:classNames, requestId:requestId('admin-course-notice-7355011') });
      student.selectedClassIds = classIds.slice(); student.classIds = classIds.slice(); student.classNames = classNames.slice();
      document.getElementById('ulimCourseNoticeText7355011').value='';
      try { global.dispatchEvent(new CustomEvent('ulim-student-roster-updated',{detail:{studentUid:uid,source:'course-register-7355011'}})); } catch(_e){}
      alert('수강 등록을 완료했습니다. 학생은 다음 로그인 시 공지 팝업으로 안내를 받습니다.');
    } catch(error){alert(text(error&&error.message)||'수강 등록에 실패했습니다.');}
    finally{loadingDone();}
  }

  function install() {
    if (!isFullAdmin()) return;
    injectUi();
    global.ULIM_OPERATIONAL_CONTENT_ADMIN_7355011 = { version:VERSION, reload:loadAll };
  }
  global.addEventListener('ulim-firebase-auth-ready', function(){setTimeout(install,80);});
  global.addEventListener('pageshow', function(){setTimeout(install,120);});
  document.addEventListener('click', function(event){
    var tab=event.target&&event.target.closest?event.target.closest('[data-admin-panel="'+PANEL_ID+'"]'):null;
    if(tab)setTimeout(function(){loadAll(false);},30);
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,100);},{once:true});else setTimeout(install,100);
})(typeof window!=='undefined'?window:globalThis);
