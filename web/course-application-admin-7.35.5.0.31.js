(function (global) {
  'use strict';
  if (global.__ULIM_COURSE_APPLICATION_ADMIN_7355031__) return;
  global.__ULIM_COURSE_APPLICATION_ADMIN_7355031__ = true;

  const VERSION = '2026-08-09.7355031-course-application-admin';
  const PANEL_ID = 'adminPanelCourseApplication7355031';
  const BUTTON_ID = 'adminCourseApplicationSubtab7355031';
  const STYLE_ID = 'ulimCourseApplicationAdminStyle7355031';
  let dashboardData = null;
  let loadingPromise = null;
  let installed = false;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function info() { if (global.adminInfo && typeof global.adminInfo === 'object') return global.adminInfo; try { return JSON.parse(localStorage.getItem('adminInfo') || '{}') || {}; } catch (_e) { return {}; } }
  function isSuperAdmin() {
    const role = normalize(info().firebaseRole || info().role || info().permission);
    return ['superadmin', normalize('전체관리자'), normalize('전체관리'), normalize('원장')].includes(role);
  }
  function roomRealtime() { return global.ULIM_ROOM_CLASSROOM_REALTIME_72917 || global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || null; }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('관리자 기능을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('관리자 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'course-application-admin-7355031');
    return rt;
  }
  async function call(name, payload) { const rt = await runtime(); const fn = rt.sdk.httpsCallable(rt.functions, name); const response = await fn(payload || {}); return response && response.data || {}; }
  function requestId(prefix) { if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID(); return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
  function showLoading(message) { try { if (typeof global.showLoading === 'function') global.showLoading(message || '처리 중...'); } catch (_e) {} }
  function hideLoading() { try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_e) {} }
  function monthNow() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function msToLocalInput(ms) {
    const n = Number(ms || 0); if (!n) return '';
    const d = new Date(n); if (Number.isNaN(d.getTime())) return '';
    const pad = function (v) { return String(v).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function localInputToMs(value) { const raw = text(value); if (!raw) return 0; const ms = new Date(raw).getTime(); return Number.isFinite(ms) ? ms : 0; }
  function timeText(ms) { const n=Number(ms||0); if(!n)return '-'; const d=new Date(n); return Number.isNaN(d.getTime())?'-':d.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
  function statusLabel(value) {
    const map = { not_submitted:'미신청', submitted:'확인대기', approved:'승인', scheduled:'승인·적용대기', applied:'적용완료', rejected:'반려' };
    return map[text(value)] || text(value) || '-';
  }
  function decisionLabel(value) {
    const map = { continue:'현재반 유지', class_move:'반 변경', leave:'휴원' };
    return map[text(value)] || '-';
  }
  function statusClass(value) { return 'st-' + text(value).replace(/[^a-z_]/g,''); }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style'); style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{--ca-border:#dbe4ef;--ca-muted:#64748b}
      #${PANEL_ID} .ca-grid{display:grid;grid-template-columns:minmax(340px,.95fr) minmax(360px,1.05fr);gap:14px;align-items:start}
      #${PANEL_ID} .ca-card{background:#fff;border:1px solid var(--ca-border);border-radius:14px;padding:15px}
      #${PANEL_ID} .ca-card h3{margin:0 0 10px;color:#0f172a}
      #${PANEL_ID} .ca-field{margin:9px 0}#${PANEL_ID} .ca-field>label{display:block;font-size:12px;font-weight:900;color:#475569;margin-bottom:5px}
      #${PANEL_ID} input,#${PANEL_ID} textarea,#${PANEL_ID} select{box-sizing:border-box;width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}
      #${PANEL_ID} textarea{min-height:110px;resize:vertical}
      #${PANEL_ID} .ca-inline{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #${PANEL_ID} .ca-class-list{max-height:280px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px;padding:8px;display:grid;gap:5px;background:#f8fafc}
      #${PANEL_ID} .ca-class-item{display:flex;gap:7px;align-items:flex-start;padding:7px;border-radius:8px;background:#fff;border:1px solid #edf2f7;font-size:12px;line-height:1.45}
      #${PANEL_ID} .ca-class-item input{width:17px;height:17px;margin-top:1px;flex:0 0 auto}
      #${PANEL_ID} .ca-summary{display:grid;grid-template-columns:repeat(6,minmax(85px,1fr));gap:7px;margin:12px 0}
      #${PANEL_ID} .ca-summary>div{padding:9px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center}.ca-summary b{display:block;font-size:18px;color:#0f172a}.ca-summary span{font-size:11px;color:#64748b}
      #${PANEL_ID} .ca-toolbar{display:grid;grid-template-columns:minmax(160px,1fr) 150px auto;gap:7px;align-items:center;margin:10px 0}
      #${PANEL_ID} .ca-table-wrap{max-height:62vh;overflow:auto;border:1px solid #e2e8f0;border-radius:11px}
      #${PANEL_ID} table{width:100%;border-collapse:separate;border-spacing:0;min-width:1180px}#${PANEL_ID} th,#${PANEL_ID} td{padding:7px;border-bottom:1px solid #edf2f7;font-size:11px;vertical-align:top;background:#fff}#${PANEL_ID} th{position:sticky;top:0;z-index:2;background:#f8fafc;text-align:left}
      #${PANEL_ID} .ca-status{display:inline-flex;padding:3px 7px;border-radius:999px;font-weight:900;background:#f1f5f9;color:#475569;white-space:nowrap}.ca-status.st-submitted{background:#fef3c7;color:#92400e}.ca-status.st-approved,.ca-status.st-scheduled{background:#dbeafe;color:#1d4ed8}.ca-status.st-applied{background:#dcfce7;color:#166534}.ca-status.st-rejected{background:#fee2e2;color:#b91c1c}
      #${PANEL_ID} .ca-preview-shell{border:1px solid #dbe4ef;border-radius:14px;padding:13px;background:#f8fafc}.ca-preview-card{background:#fff;border-radius:14px;padding:15px;box-shadow:0 10px 35px rgba(15,23,42,.08)}.ca-preview-title{font-size:17px;font-weight:900;color:#166534;margin-bottom:10px}.ca-preview-notice{padding:11px;border:1px solid #bbf7d0;border-radius:10px;background:#f0fdf4;white-space:pre-wrap;color:#14532d;line-height:1.55}
      #${PANEL_ID} .ca-publish{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:900}.ca-publish.on{background:#dcfce7;color:#166534}.ca-publish.off{background:#f1f5f9;color:#64748b}
      #${PANEL_ID} .ca-note{font-size:11px;color:#64748b;line-height:1.5}.ca-actions{display:flex;gap:5px;flex-wrap:wrap}.ca-check{width:17px!important;height:17px}
      @media(max-width:1050px){#${PANEL_ID} .ca-grid{grid-template-columns:1fr}#${PANEL_ID} .ca-summary{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:650px){#${PANEL_ID} .ca-inline{grid-template-columns:1fr}#${PANEL_ID} .ca-toolbar{grid-template-columns:1fr}#${PANEL_ID} .ca-summary{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function panelHtml() {
    return '<div class="admin-card"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><h2 style="margin:0">수강신청 관리</h2><div class="ca-note">학생 수강신청 공지·기간·모집반과 신청 처리상태를 한 곳에서 관리합니다.</div></div><div style="display:flex;gap:7px;align-items:center"><span id="caPublishBadge7355031" class="ca-publish off">게시 안 함</span><button type="button" class="admin-btn blue" id="caReload7355031">새로고침</button></div></div>'+ 
      '<div class="ca-grid" style="margin-top:13px">'+
        '<section class="ca-card"><h3>신청 기간 · 학생 안내</h3><div class="ca-field"><label>신청 대상월</label><input id="caMonth7355031" type="month"></div><div class="ca-field"><label style="display:flex;gap:7px;align-items:center"><input id="caActive7355031" class="ca-check" type="checkbox"> 학생 화면에 수강신청 게시</label></div><div class="ca-inline"><div class="ca-field"><label>신청 시작</label><input id="caOpen7355031" type="datetime-local"></div><div class="ca-field"><label>신청 종료</label><input id="caClose7355031" type="datetime-local"></div></div><div class="ca-field"><label>제목</label><input id="caTitle7355031"></div><div class="ca-field"><label>학생 안내문</label><textarea id="caNotice7355031"></textarea></div><div class="ca-field"><label>모집반</label><div id="caClasses7355031" class="ca-class-list"></div></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button type="button" class="admin-btn green" id="caSave7355031">설정 저장 / 즉시 반영</button><button type="button" class="admin-btn" id="caPreview7355031">학생 화면 미리보기</button></div><div class="ca-note" style="margin-top:8px">신청기간 중에도 제목·안내문·모집반을 수정해 저장할 수 있습니다.</div></section>'+
        '<section class="ca-card"><h3>현재 게시 미리보기</h3><div id="caPreviewBox7355031" class="ca-preview-shell"></div><div class="ca-note" style="margin-top:9px">미리보기는 안내 1단계 화면입니다. 실제 학생은 이후 수강 여부 → 현재반 유지 여부 → 반 선택 순으로 진행합니다.</div></section>'+
      '</div>'+
      '<section class="ca-card" style="margin-top:14px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><h3 style="margin:0">신청 현황</h3><div class="ca-actions"><button type="button" class="admin-btn green" id="caBatchApprove7355031">선택 승인</button><button type="button" class="admin-btn red" id="caBatchReject7355031">선택 반려</button></div></div><div id="caSummary7355031" class="ca-summary"></div><div class="ca-toolbar"><input id="caSearch7355031" placeholder="학생명 · 출결번호 · 반 검색"><select id="caStatusFilter7355031"><option value="all">전체 상태</option><option value="not_submitted">미신청</option><option value="submitted">확인대기</option><option value="approved">승인</option><option value="scheduled">승인·적용대기</option><option value="applied">적용완료</option><option value="rejected">반려</option></select><div class="ca-note" id="caRowCount7355031"></div></div><div class="ca-table-wrap"><table><thead><tr><th><input type="checkbox" class="ca-check" id="caSelectAll7355031"></th><th>학생</th><th>현재반</th><th>신청내용</th><th>상태</th><th>신청시각</th><th>처리</th></tr></thead><tbody id="caRows7355031"></tbody></table></div></section>'+ 
      '</div>';
  }

  function injectUi() {
    if (!isSuperAdmin()) return false;
    injectStyle();
    const subtabs = document.querySelector('#adminDashboard .admin-subtabs');
    const dashboard = document.getElementById('adminDashboard');
    if (!subtabs || !dashboard) return false;
    if (!document.getElementById(BUTTON_ID)) {
      const button=document.createElement('button');button.type='button';button.id=BUTTON_ID;button.className='admin-subtab admin-full-only';button.dataset.adminPanel=PANEL_ID;button.textContent='수강신청';button.addEventListener('click',function(){if(typeof global.showAdminPanel==='function')global.showAdminPanel(PANEL_ID);loadDashboard(false);});subtabs.appendChild(button);
    }
    if (!document.getElementById(PANEL_ID)) {
      const panel=document.createElement('div');panel.id=PANEL_ID;panel.className='admin-panel';panel.innerHTML=panelHtml();dashboard.appendChild(panel);bindUi();
    }
    installed = true;
    return true;
  }

  function bindUi() {
    document.getElementById('caReload7355031').onclick=function(){loadDashboard(true);};
    document.getElementById('caMonth7355031').onchange=function(){loadDashboard(true);};
    document.getElementById('caSave7355031').onclick=saveWindow;
    document.getElementById('caPreview7355031').onclick=renderPreview;
    document.getElementById('caSearch7355031').oninput=renderRows;
    document.getElementById('caStatusFilter7355031').onchange=renderRows;
    document.getElementById('caSelectAll7355031').onchange=function(){const checked=this.checked;document.querySelectorAll('#caRows7355031 input[data-ca-select]').forEach(function(el){el.checked=checked;});};
    document.getElementById('caBatchApprove7355031').onclick=function(){batchDecision('approved');};
    document.getElementById('caBatchReject7355031').onclick=function(){batchDecision('rejected');};
    ['caActive7355031','caTitle7355031','caNotice7355031','caOpen7355031','caClose7355031'].forEach(function(id){const el=document.getElementById(id);if(el)el.addEventListener('input',renderPreview);});
  }

  function renderClasses(classes, selectedIds) {
    const box=document.getElementById('caClasses7355031');if(!box)return;const selected=new Set(Array.isArray(selectedIds)?selectedIds:[]);
    box.innerHTML=(Array.isArray(classes)?classes:[]).map(function(item){const label=text(item.className)+(text(item.instructorName)?' / '+text(item.instructorName):'');return '<label class="ca-class-item"><input class="ca-check" type="checkbox" data-ca-class value="'+escapeHtml(item.classId)+'"'+(selected.has(item.classId)?' checked':'')+'><span>'+escapeHtml(label)+'</span></label>';}).join('') || '<div class="ca-note">현재 모집반 목록이 없습니다.</div>';
  }
  function selectedClassIds(){return Array.from(document.querySelectorAll('#caClasses7355031 [data-ca-class]:checked')).map(function(el){return el.value;});}
  function renderPreview() {
    const box=document.getElementById('caPreviewBox7355031');if(!box)return;
    const month=text(document.getElementById('caMonth7355031')&&document.getElementById('caMonth7355031').value)||monthNow();
    const label=Number(month.slice(5,7))+'월';const title=text(document.getElementById('caTitle7355031')&&document.getElementById('caTitle7355031').value)||label+' 수강신청';const notice=text(document.getElementById('caNotice7355031')&&document.getElementById('caNotice7355031').value)||label+' 수강신청을 진행합니다.';
    box.innerHTML='<div class="ca-preview-card"><div class="ca-preview-title">'+escapeHtml(title)+'</div><div style="font-weight:900;margin-bottom:9px">'+escapeHtml(label)+' 수강신청 안내</div><div class="ca-preview-notice">'+escapeHtml(notice).replace(/\n/g,'<br>')+'</div><button type="button" style="width:100%;margin-top:12px;border:0;border-radius:10px;padding:11px;background:#16a34a;color:#fff;font-weight:900" disabled>다음</button></div>';
    updatePublishBadge();
  }
  function updatePublishBadge() {
    const badge=document.getElementById('caPublishBadge7355031');if(!badge)return;const active=!!(document.getElementById('caActive7355031')&&document.getElementById('caActive7355031').checked);const now=Date.now();const open=localInputToMs(document.getElementById('caOpen7355031')&&document.getElementById('caOpen7355031').value);const close=localInputToMs(document.getElementById('caClose7355031')&&document.getElementById('caClose7355031').value);const inPeriod=active&&(!open||open<=now)&&(!close||close>=now);badge.className='ca-publish '+(inPeriod?'on':'off');badge.textContent=inPeriod?'현재 게시중':(active?'게시 예약/기간외':'게시 안 함');
  }
  function fillWindow(data) {
    const windowData=data&&data.window||{};const month=text(data&&data.month)||text(windowData.month)||monthNow();
    document.getElementById('caMonth7355031').value=month;document.getElementById('caActive7355031').checked=windowData.active===true;document.getElementById('caOpen7355031').value=msToLocalInput(windowData.openAtMs);document.getElementById('caClose7355031').value=msToLocalInput(windowData.closeAtMs);document.getElementById('caTitle7355031').value=text(windowData.title)||month+' 수강신청';document.getElementById('caNotice7355031').value=text(windowData.notice);renderClasses(data&&data.classes,windowData.recruitingClassIds);renderPreview();
  }
  function renderSummary(summary) {
    summary=summary||{};const box=document.getElementById('caSummary7355031');if(!box)return;const approvalPending=Number(summary.approved||0)+Number(summary.scheduled||0);const cells=[['eligible','대상'],['notSubmitted','미신청'],['submitted','확인대기'],[approvalPending,'승인·적용대기'],['applied','적용완료'],['rejected','반려']];box.innerHTML=cells.map(function(pair){const value=typeof pair[0]==='number'?pair[0]:Number(summary[pair[0]]||0);return '<div><b>'+value+'</b><span>'+pair[1]+'</span></div>';}).join('');
  }
  function rowMatches(row, query, status) {
    if(status!=='all'&&text(row.status)!==status)return false;if(!query)return true;const hay=normalize([row.studentName,row.attendanceNo,(row.currentClassNames||[]).join(' '),(row.requestedClassNames||[]).join(' '),(row.instructorNames||[]).join(' ')].join(' '));return hay.indexOf(normalize(query))>=0;
  }
  function renderRows() {
    const body=document.getElementById('caRows7355031');if(!body)return;const rows=dashboardData&&Array.isArray(dashboardData.rows)?dashboardData.rows:[];const q=text(document.getElementById('caSearch7355031')&&document.getElementById('caSearch7355031').value);const status=text(document.getElementById('caStatusFilter7355031')&&document.getElementById('caStatusFilter7355031').value)||'all';const filtered=rows.filter(function(row){return rowMatches(row,q,status);});document.getElementById('caRowCount7355031').textContent='표시 '+filtered.length+'명 / 전체 '+rows.length+'명';
    body.innerHTML=filtered.map(function(row){const actionable=text(row.status)==='submitted'&&text(row.applicationId);const request=decisionLabel(row.registrationDecision)+(Array.isArray(row.requestedClassNames)&&row.requestedClassNames.length?'<br><span class="ca-note">'+escapeHtml(row.requestedClassNames.join(', '))+'</span>':'');const current=Array.isArray(row.currentClassNames)&&row.currentClassNames.length?row.currentClassNames.join(', '):'-';const action=actionable?'<div class="ca-actions"><button type="button" class="admin-btn green" data-ca-decision="approved" data-app="'+escapeHtml(row.applicationId)+'">승인</button><button type="button" class="admin-btn red" data-ca-decision="rejected" data-app="'+escapeHtml(row.applicationId)+'">반려</button></div>':'-';return '<tr><td><input class="ca-check" type="checkbox" data-ca-select value="'+escapeHtml(row.applicationId||'')+'"'+(actionable?'':' disabled')+'></td><td><b>'+escapeHtml(row.studentName)+'</b><br><span class="ca-note">'+escapeHtml(row.attendanceNo)+' · '+escapeHtml((row.instructorNames||[]).join(', '))+'</span></td><td>'+escapeHtml(current)+'</td><td>'+request+'</td><td><span class="ca-status '+statusClass(row.status)+'">'+escapeHtml(statusLabel(row.status))+'</span></td><td>'+escapeHtml(timeText(row.submittedAtMs))+'</td><td>'+action+'</td></tr>';}).join('') || '<tr><td colspan="7" style="text-align:center;padding:22px;color:#64748b">조건에 맞는 학생이 없습니다.</td></tr>';
    body.querySelectorAll('[data-ca-decision]').forEach(function(button){button.onclick=function(){decide([button.dataset.app],button.dataset.caDecision);};});const all=document.getElementById('caSelectAll7355031');if(all)all.checked=false;
  }

  async function loadDashboard(force) {
    if (!injectUi()) return null;if(loadingPromise)return loadingPromise;const month=text(document.getElementById('caMonth7355031')&&document.getElementById('caMonth7355031').value)||monthNow();showLoading('수강신청 현황 불러오는 중...');
    loadingPromise=call('getCourseApplicationAdminDashboard7355031',{month:month,force:force===true,requestId:requestId('course-dashboard-7355031')}).then(function(data){dashboardData=data||{};fillWindow(dashboardData);renderSummary(dashboardData.summary);renderRows();return dashboardData;}).catch(function(error){alert(text(error&&error.message)||'수강신청 현황을 불러오지 못했습니다.');return null;}).finally(function(){loadingPromise=null;hideLoading();});return loadingPromise;
  }
  async function saveWindow() {
    const month=text(document.getElementById('caMonth7355031').value);const openAtMs=localInputToMs(document.getElementById('caOpen7355031').value);const closeAtMs=localInputToMs(document.getElementById('caClose7355031').value);if(!/^\d{4}-\d{2}$/.test(month))return alert('신청 대상월을 선택해주세요.');if(openAtMs&&closeAtMs&&closeAtMs<=openAtMs)return alert('신청 종료시간은 시작시간보다 뒤여야 합니다.');const payload={month:month,active:document.getElementById('caActive7355031').checked,title:text(document.getElementById('caTitle7355031').value),notice:text(document.getElementById('caNotice7355031').value),openAtMs:openAtMs,closeAtMs:closeAtMs,recruitingClassIds:selectedClassIds(),requestId:requestId('course-window-save-7355031')};if(payload.active&&!payload.recruitingClassIds.length&&!confirm('모집반을 선택하지 않았습니다. 현재 운영 중인 모든 선택 가능 반을 학생에게 표시할까요?'))return;showLoading('수강신청 설정 저장 중...');try{await call('saveCourseApplicationWindowAdmin7352',payload);alert('수강신청 설정을 저장했습니다. 학생 화면에 바로 반영됩니다.');await loadDashboard(true);}catch(error){alert(text(error&&error.message)||'수강신청 설정 저장에 실패했습니다.');}finally{hideLoading();}
  }
  function selectedApplicationIds(){return Array.from(document.querySelectorAll('#caRows7355031 [data-ca-select]:checked')).map(function(el){return text(el.value);}).filter(Boolean);}
  function batchDecision(state){const ids=selectedApplicationIds();if(!ids.length)return alert('처리할 신청을 선택해주세요.');decide(ids,state);}
  async function decide(ids,state){ids=Array.isArray(ids)?ids.filter(Boolean):[];if(!ids.length)return;const label=state==='approved'?'승인':'반려';if(!confirm('선택한 수강신청 '+ids.length+'건을 '+label+'할까요?'))return;showLoading('수강신청 '+label+' 처리 중...');try{const result=await call('decideCourseApplicationsAdmin73550',{decisions:ids.map(function(id){return{applicationId:id,state:state};}),requestId:requestId('course-decision-7355031')});const failed=Array.isArray(result.results)?result.results.filter(function(row){return row.ok!==true;}):[];if(failed.length)alert((ids.length-failed.length)+'건 처리 완료 · '+failed.length+'건 확인이 필요합니다.');else alert(ids.length+'건 '+label+' 완료');await loadDashboard(true);}catch(error){alert(text(error&&error.message)||'수강신청 처리에 실패했습니다.');}finally{hideLoading();}}

  function install(){if(!isSuperAdmin())return;if(injectUi()&&!installed)installed=true;}
  global.addEventListener('ulim-firebase-auth-ready',function(){setTimeout(install,80);});
  global.addEventListener('pageshow',function(){setTimeout(install,100);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  setTimeout(install,600);
})(typeof window!=='undefined'?window:globalThis);
