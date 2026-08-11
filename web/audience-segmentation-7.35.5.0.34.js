(function (global) {
  'use strict';
  if (global.__ULIM_AUDIENCE_SEGMENTATION_7355034__) return;
  global.__ULIM_AUDIENCE_SEGMENTATION_7355034__ = true;
  global.ULIM_AUDIENCE_SEGMENTATION_VERSION = '2026-08-11.7355038-policy-only';

  var installed = false;
  var loaded = null;
  var loading = false;
  function text(value) { return String(value == null ? '' : value).trim(); }
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
      +'#ulimAudienceSegmentation7355034{margin-top:14px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;overflow:hidden}#ulimAudienceSegmentation7355034>summary{cursor:pointer;padding:12px 14px;font-size:14px;font-weight:900;background:#f8fafc}#ulimAudienceSegmentation7355034 .ulim-aud-body{padding:12px 14px}.ulim-aud-policy7355034{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:10px 12px;border:1px solid #dbeafe;border-radius:10px;background:#eff6ff}.ulim-aud-policy7355034 label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:900}.ulim-aud-policy7355034 input{width:auto}.ulim-aud-status7355034{font-size:12px;color:#64748b;margin:6px 0 10px}';document.head.appendChild(style);
  }
  function container() { return document.getElementById('ulimStudentManagementCard7352') || document.getElementById('adminPanelStudentManagement7352'); }
  function install() {
    if (!isSuperAdmin()) return;
    var host=container();if(!host)return;ensureStyle();
    if (!document.getElementById('ulimAudienceSegmentation7355034')) {
      var details=document.createElement('details');details.id='ulimAudienceSegmentation7355034';details.innerHTML='<summary>알림톡 발송 대상</summary><div class="ulim-aud-body"><div id="ulimAudienceStatus7355034" class="ulim-aud-status7355034">열면 현재 발송 기준을 불러옵니다.</div><div id="ulimAudienceContent7355034"></div></div>';
      host.appendChild(details);
      details.addEventListener('toggle',function(){if(details.open)load();});
    }
    installed=true;
  }
  function render() {
    var root=document.getElementById('ulimAudienceContent7355034');if(!root||!loaded)return;
    var policy=loaded.policy||{};
    root.innerHTML='<div class="ulim-aud-policy7355034"><b>알림톡 발송</b><label><input type="checkbox" id="ulimAudAdultNotify7355034"'+(policy.adultEnabled!==false?' checked':'')+'> 성인반 발송</label><label><input type="checkbox" id="ulimAudYouthNotify7355034"'+(policy.youthEnabled!==false?' checked':'')+'> 청소년반 발송</label><button type="button" class="admin-btn blue" id="ulimAudPolicySave7355034">저장</button><span>태블릿 등·하원 등 반 기준 알림에 적용</span></div>';
    document.getElementById('ulimAudPolicySave7355034').onclick=savePolicy;
  }
  async function load() {
    if(loading)return;loading=true;var status=document.getElementById('ulimAudienceStatus7355034');if(status)status.textContent='알림톡 발송 기준을 불러오는 중...';
    try{loaded=await call('getAudienceSegmentationAdmin7355034',{});render();if(status)status.textContent='반 구분은 반 추가 화면에서, 학생 구분은 학생목록의 구분 항목에서 관리합니다.';}catch(error){if(status)status.textContent=text(error&&error.message)||'알림톡 발송 기준을 불러오지 못했습니다.';}finally{loading=false;}
  }
  async function savePolicy(){try{await call('saveAudienceNotificationPolicyAdmin7355034',{adultEnabled:!!document.getElementById('ulimAudAdultNotify7355034').checked,youthEnabled:!!document.getElementById('ulimAudYouthNotify7355034').checked});await load();}catch(error){alert(text(error&&error.message)||'알림톡 기준을 저장하지 못했습니다.');}}

  global.ULIM_AUDIENCE_SEGMENTATION_API_7355034={install:install,reload:load};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  global.addEventListener('ulim-firebase-auth-ready',function(){setTimeout(install,80);});
  document.addEventListener('click',function(){if(!installed)setTimeout(install,30);},true);
})(typeof window!=='undefined'?window:globalThis);
