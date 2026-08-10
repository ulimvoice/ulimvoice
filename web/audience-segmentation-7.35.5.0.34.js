(function (global) {
  'use strict';
  if (global.__ULIM_AUDIENCE_SEGMENTATION_7355034__) return;
  global.__ULIM_AUDIENCE_SEGMENTATION_7355034__ = true;
  global.ULIM_AUDIENCE_SEGMENTATION_VERSION = '2026-08-10.735.05.0.34';

  var installed = false;
  var loaded = null;
  var loading = false;
  function text(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function label(group) { return group === 'adult' ? '성인' : group === 'youth' ? '청소년' : '미분류'; }
  function roomRealtime() { return global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null; }
  async function runtime() {
    var room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('Firebase 모듈을 준비하지 못했습니다.');
    var rt = await room.preloadRuntime();
    if (!rt || !rt.sdk || !rt.functions) throw new Error('Firebase 교직원 로그인이 필요합니다.');
    return rt;
  }
  async function call(name, payload) { var rt = await runtime(); var fn = rt.sdk.httpsCallable(rt.functions, name); var result = await fn(payload || {}); return result && result.data || {}; }
  function isSuperAdmin() {
    var info = global.adminInfo || {};
    var role = text(info.firebaseRole || info.role).toLowerCase();
    return role === 'superadmin' || role === '전체관리자' || role === '전체관리' || role === '원장';
  }
  function ensureStyle() {
    if (document.getElementById('ulimAudienceStyle7355034')) return;
    var style=document.createElement('style');style.id='ulimAudienceStyle7355034';style.textContent=''
      +'#ulimAudienceSegmentation7355034{margin-top:14px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;overflow:hidden}#ulimAudienceSegmentation7355034>summary{cursor:pointer;padding:12px 14px;font-size:14px;font-weight:900;background:#f8fafc}#ulimAudienceSegmentation7355034 .ulim-aud-body{padding:12px 14px}.ulim-aud-policy7355034{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:10px 12px;border:1px solid #dbeafe;border-radius:10px;background:#eff6ff;margin-bottom:12px}.ulim-aud-policy7355034 label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:900}.ulim-aud-policy7355034 input{width:auto}.ulim-aud-section7355034{margin-top:14px}.ulim-aud-section7355034 h4{margin:0 0 8px;font-size:13px}.ulim-aud-table-wrap7355034{max-height:360px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px}.ulim-aud-table7355034{width:100%;border-collapse:collapse;min-width:680px}.ulim-aud-table7355034 th,.ulim-aud-table7355034 td{padding:7px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:left}.ulim-aud-table7355034 th{position:sticky;top:0;background:#f8fafc;z-index:1}.ulim-aud-table7355034 select{padding:6px;border:1px solid #cbd5e1;border-radius:7px;background:#fff}.ulim-aud-toolbar7355034{display:flex;gap:8px;align-items:center;margin-bottom:8px}.ulim-aud-toolbar7355034 input{flex:1;min-width:160px;padding:8px;border:1px solid #cbd5e1;border-radius:8px}.ulim-aud-toolbar7355034 select{min-width:110px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.ulim-aud-status7355034{font-size:12px;color:#64748b;margin:6px 0}.ulim-aud-badge7355034{display:inline-block;padding:2px 7px;border-radius:999px;background:#f1f5f9;font-size:11px;font-weight:800}';document.head.appendChild(style);
  }
  function container() {
    return document.getElementById('ulimStudentManagementCard7352') || document.getElementById('adminPanelStudentManagement7352');
  }
  function install() {
    if (!isSuperAdmin()) return;
    var host=container();if(!host)return;ensureStyle();
    if (!document.getElementById('ulimAudienceSegmentation7355034')) {
      var details=document.createElement('details');details.id='ulimAudienceSegmentation7355034';details.innerHTML='<summary>성인·청소년 구분 / 알림톡 대상</summary><div class="ulim-aud-body"><div id="ulimAudienceStatus7355034" class="ulim-aud-status7355034">열면 최신 구분을 불러옵니다.</div><div id="ulimAudienceContent7355034"></div></div>';
      host.appendChild(details);
      details.addEventListener('toggle',function(){if(details.open)load(false);});
    }
    installed=true;
  }
  function render() {
    var root=document.getElementById('ulimAudienceContent7355034');if(!root||!loaded)return;
    var policy=loaded.policy||{};var classes=Array.isArray(loaded.classes)?loaded.classes:[];var students=Array.isArray(loaded.students)?loaded.students:[];
    root.innerHTML='<div class="ulim-aud-policy7355034"><b>알림톡 발송</b><label><input type="checkbox" id="ulimAudAdultNotify7355034"'+(policy.adultEnabled!==false?' checked':'')+'> 성인반 발송</label><label><input type="checkbox" id="ulimAudYouthNotify7355034"'+(policy.youthEnabled!==false?' checked':'')+'> 청소년반 발송</label><button type="button" class="admin-btn blue" id="ulimAudPolicySave7355034">저장</button><span>태블릿 등·하원 등 반 기준 알림에 적용</span></div>'
      +'<section class="ulim-aud-section7355034"><h4>수업반 구분</h4><div class="ulim-aud-table-wrap7355034"><table class="ulim-aud-table7355034"><thead><tr><th>수업반</th><th>담당강사</th><th>구분</th><th></th></tr></thead><tbody>'+classes.map(function(row){return '<tr><td>'+escapeHtml(row.className)+'</td><td>'+escapeHtml(row.instructorName||'')+'</td><td><select data-aud-class-select7355034="'+escapeHtml(row.classId)+'"><option value="adult"'+(row.audienceGroup==='adult'?' selected':'')+'>성인반</option><option value="youth"'+(row.audienceGroup==='youth'?' selected':'')+'>청소년반</option></select></td><td><button type="button" class="admin-btn" data-aud-class-save7355034="'+escapeHtml(row.classId)+'">저장</button></td></tr>';}).join('')+'</tbody></table></div></section>'
      +'<section class="ulim-aud-section7355034"><h4>학생 구분</h4><div class="ulim-aud-toolbar7355034"><input id="ulimAudStudentSearch7355034" placeholder="학생명·출결번호 검색"><select id="ulimAudStudentGroupFilter7355034"><option value="">전체</option><option value="adult">성인</option><option value="youth">청소년</option><option value="unclassified">미분류</option></select><button type="button" class="admin-btn" id="ulimAudStudentReload7355034">조회</button></div><div class="ulim-aud-table-wrap7355034"><table class="ulim-aud-table7355034"><thead><tr><th>학생명</th><th>출결번호</th><th>생년월일</th><th>자동구분</th><th>최종구분</th><th>관리자 지정</th><th></th></tr></thead><tbody>'+students.map(function(row){var source=row.audienceGroupSource==='manual'?'관리자 지정':row.audienceGroupSource==='auto_birth_year'?'생년월일 자동':'미분류';return '<tr><td>'+escapeHtml(row.studentName)+'</td><td>'+escapeHtml(row.attendanceNo)+'</td><td>'+escapeHtml(row.birthDate||'-')+'</td><td>'+escapeHtml(label(row.audienceGroupAuto))+'</td><td><span class="ulim-aud-badge7355034">'+escapeHtml(label(row.audienceGroup))+' · '+escapeHtml(source)+'</span></td><td><select data-aud-student-select7355034="'+escapeHtml(row.studentUid)+'"><option value=""'+(!row.audienceGroupOverride?' selected':'')+'>자동</option><option value="adult"'+(row.audienceGroupOverride==='adult'?' selected':'')+'>성인</option><option value="youth"'+(row.audienceGroupOverride==='youth'?' selected':'')+'>청소년</option></select></td><td><button type="button" class="admin-btn" data-aud-student-save7355034="'+escapeHtml(row.studentUid)+'">저장</button></td></tr>';}).join('')+'</tbody></table></div></section>';
    document.getElementById('ulimAudPolicySave7355034').onclick=savePolicy;
    document.getElementById('ulimAudStudentReload7355034').onclick=function(){load(true);};
    root.addEventListener('click',handleTableClick,{once:true});
  }
  async function load(useQuery) {
    if(loading)return;loading=true;var status=document.getElementById('ulimAudienceStatus7355034');if(status)status.textContent='성인·청소년 구분을 불러오는 중...';
    try{var query=useQuery?text(document.getElementById('ulimAudStudentSearch7355034')&&document.getElementById('ulimAudStudentSearch7355034').value):'';var group=useQuery?text(document.getElementById('ulimAudStudentGroupFilter7355034')&&document.getElementById('ulimAudStudentGroupFilter7355034').value):'';loaded=await call('getAudienceSegmentationAdmin7355034',{query:query,audienceGroup:group});render();if(status)status.textContent='생년월일은 올해 기준 만 나이가 아니라 출생연도 기준으로 20세 이상 성인, 미만 청소년으로 자동 구분합니다. 관리자 지정이 있으면 그 값이 우선합니다.';}catch(error){if(status)status.textContent=text(error&&error.message)||'구분 정보를 불러오지 못했습니다.';}finally{loading=false;}
  }
  async function savePolicy(){try{await call('saveAudienceNotificationPolicyAdmin7355034',{adultEnabled:!!document.getElementById('ulimAudAdultNotify7355034').checked,youthEnabled:!!document.getElementById('ulimAudYouthNotify7355034').checked});await load(false);}catch(error){alert(text(error&&error.message)||'알림톡 기준을 저장하지 못했습니다.');}}
  async function handleTableClick(event){var classBtn=event.target&&event.target.closest?event.target.closest('[data-aud-class-save7355034]'):null;var studentBtn=event.target&&event.target.closest?event.target.closest('[data-aud-student-save7355034]'):null;try{if(classBtn){var cid=text(classBtn.dataset.audClassSave7355034);var sel=document.querySelector('[data-aud-class-select7355034="'+CSS.escape(cid)+'"]');await call('saveClassAudienceAdmin7355034',{classId:cid,audienceGroup:text(sel&&sel.value)});await load(false);return;}if(studentBtn){var uid=text(studentBtn.dataset.audStudentSave7355034);var ssel=document.querySelector('[data-aud-student-select7355034="'+CSS.escape(uid)+'"]');await call('saveStudentAudienceAdmin7355034',{studentUid:uid,audienceGroupOverride:text(ssel&&ssel.value)});await load(false);return;}}catch(error){alert(text(error&&error.message)||'구분을 저장하지 못했습니다.');}finally{var root=document.getElementById('ulimAudienceContent7355034');if(root)root.addEventListener('click',handleTableClick,{once:true});}}

  global.ULIM_AUDIENCE_SEGMENTATION_API_7355034={install:install,reload:function(){return load(false);}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  global.addEventListener('ulim-firebase-auth-ready',function(){setTimeout(install,80);});
  document.addEventListener('click',function(){if(!installed)setTimeout(install,30);},true);
})(typeof window!=='undefined'?window:globalThis);
