(function(){
'use strict';
// Single owner: this file is the only UI/controller owner for the standalone mock examination.
const EXAM_ID='2026-10-17';
const FN={sessions:'listMockExamSessions20261017',overview:'getMockExamOverview20261017',save:'saveMockExamGrade20261017',admin:'manageMockExam20261017',r04RosterPreview:'getMockExamCanonicalRosterAdminR04',r04Persisted:'getMockExamPersistedSessionAdminR04',r04State:'setMockExamSessionGradingAdminR04',r04TeacherWorkspace:'getMockExamTeacherWorkspaceR04',r04TeacherSave:'saveMockExamTeacherGradeR04'};
const NA=['발음의 정확성','발성의 안정성','호흡과 문장 처리','정보 전달력','다큐멘터리 톤과 리듬'];
const ACT=['인물 및 상황 이해','감정·의도 표현','발성·발음','호흡·대사 흐름','몰입도와 전달력'];
const GROUPS=['청소년','성인'];
const defaultRubrics=()=>Object.fromEntries(GROUPS.map(group=>[group,{na:NA.map(title=>({title,description:''})),act:ACT.map(title=>({title,description:''}))}]));
// The score scale is fixed: exactly 5 named criteria per section x 5 points = 25 + 25.
// To protect comparability, rubric changes are rejected after the first teacher draft/save.
function normalizeRubrics(value){const defaults=defaultRubrics();if(!value||typeof value!=='object')return defaults;
  for(const group of GROUPS){for(const key of ['na','act']){const a=value[group]&&value[group][key];if(!Array.isArray(a)||a.length!==5)continue;defaults[group][key]=a.map((item,i)=>({title:str(item&&item.title)||defaults[group][key][i].title,description:str(item&&item.description)}));}}
  return defaults;
}
function checkRubrics(value){if(!value||typeof value!=='object')throw Error('평가 기준 정보를 확인해주세요.');
  for(const group of GROUPS)for(const key of ['na','act']){const items=value[group]&&value[group][key];if(!Array.isArray(items)||items.length!==5)throw Error(`${group} ${key==='na'?'NA':'독백'} 항목은 정확히 5개여야 합니다.`);
    const seen=new Set();for(const item of items){const title=str(item&&item.title),description=str(item&&item.description);if(!title||title.length>70||description.length>160)throw Error('평가 항목명은 1~70자, 설명은 160자 이하로 입력해주세요.');const k=title.normalize('NFKC').replace(/\s+/g,'').toLowerCase();if(seen.has(k))throw Error('동일 영역에 중복된 평가 항목명이 있습니다.');seen.add(k);}}
  return value;
}
const preview=document.documentElement.dataset.preview==='yes';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const str=s=>String(s==null?'':s).trim();
const score=sum=>sum.reduce((n,v)=>n+(typeof v==='number'?v:0),0);
const validScores=a=>Array.isArray(a)&&a.length===5&&a.every(v=>typeof v==='number'&&v>=0&&v<=5&&Math.round(v*2)===v*2);
const fullScore=g=>g&&validScores(g.na)&&validScores(g.act);
const gradeTotal=g=>g&&fullScore(g)?score(g.na)+score(g.act):null;
const fmt=n=>Number.isFinite(n)?(Math.round(n*10)/10).toFixed(1):'—';
const gradeKey=(stu,teacher)=>stu+'__'+teacher;
const SAFE_HOSTS=new Set(['drive.google.com','docs.google.com']);
function driveLink(value){try{const u=new URL(str(value));return u.protocol==='https:'&&SAFE_HOSTS.has(u.hostname)?u.href:null;}catch(_){return null;}}
function toast(msg){const t=$('toast');if(!t)return;t.textContent=str(msg);t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),4000)}
function errorMessage(e){const c=str(e&&e.code);if(c.includes('permission-denied'))return'접근 권한이 없습니다.';if(c.includes('unauthenticated'))return'로그인 후 다시 진행해주세요.';if(c.includes('not-found'))return'평가 서버 기능이 아직 연결되지 않았습니다.';return str(e&&e.message)||'요청을 처리하지 못했습니다.';}
let S={role:null,auth:null,rt:null,examId:'',sessions:[],sessionTitle:'',examDate:'',archived:false,previewData:{},roster:[],grades:[],judges:[],folders:{},published:false,selected:null,group:'청소년',view:'completion',judgePage:0,edit:{},previewRole:'teacher',expandedClasses:{'청소년':[],'성인':[]},rubrics:defaultRubrics(),rubricVersion:0,rubricFrozen:false,rosterSearch:'',rosterGroup:'전체',rosterPreviewOnly:false,rosterDate:'',rosterReview:[],rosterReviewSummary:{},r04SessionId:'r04_202610_r01',r04SessionState:null,r04StateMutationPending:false,r04TeacherReady:false,r04TeacherGradingOpen:false,r04TeacherSavePending:false};
const app=$('app'),logoutBtn=$('logoutBtn');
function badge(){const a=$('accountBadge');if(a)a.textContent=S.auth?`${S.auth.name} · ${S.role==='teacher'?'강사':S.role==='admin'?'관리자':'학생'}`:'로그인 필요';logoutBtn.hidden=!S.auth||preview;}
function withBusy(btn,fn){if(btn)btn.disabled=true;return Promise.resolve().then(fn).catch(e=>{toast(errorMessage(e));return null}).finally(()=>{if(btn)btn.disabled=false})}
const DEMO={participants:[
{studentUid:'stu01',name:'김하늘',group:'청소년',classId:'C-1',className:'청소년 연기반',media:{audio:'',video:''}},
{studentUid:'stu02',name:'이서진',group:'청소년',classId:'C-1',className:'청소년 연기반',media:{audio:'',video:''}},
{studentUid:'stu03',name:'박지우',group:'청소년',classId:'C-2',className:'중등 더빙반',media:{audio:'',video:''}},
{studentUid:'stu04',name:'최도윤',group:'성인',classId:'C-3',className:'성인 연기반',media:{audio:'',video:''}},
{studentUid:'stu05',name:'정다온',group:'성인',classId:'C-3',className:'성인 연기반',media:{audio:'',video:''}}
],judges:[{teacherUid:'judge01',name:'평가강사 A'},{teacherUid:'judge02',name:'평가강사 B'}],grades:[
{studentUid:'stu01',teacherUid:'judge01',na:[4,4.5,4,4.5,4],act:[4.5,4,4,4.5,4],note:'문장 전달이 명료하며 감정 변화가 자연스럽습니다.',status:'submitted'},
{studentUid:'stu01',teacherUid:'judge02',na:[4,4,4,4,4],act:[4,4,4.5,4,4],note:'호흡의 끝맺음을 더 안정적으로 다듬어 보세요.',status:'submitted'},
{studentUid:'stu02',teacherUid:'judge01',na:[3.5,4,4,4,4],act:[4,4.5,4,4,4],note:'무대 집중도가 좋습니다.',status:'submitted'},
{studentUid:'stu03',teacherUid:'judge01',na:[5,4.5,5,4.5,4],act:[4.5,4.5,4.5,5,4.5],note:'장면 이해도가 뛰어납니다.',status:'submitted'},
{studentUid:'stu04',teacherUid:'judge01',na:[4,4,4,4,4],act:[4,4,4,4,4],note:'담담한 독백의 의도가 선명합니다.',status:'submitted'},
{studentUid:'stu04',teacherUid:'judge02',na:[4,4.5,4.5,4,4],act:[4,4.5,4.5,4,4],note:'상황의 전환이 자연스럽습니다.',status:'submitted'},
{studentUid:'stu05',teacherUid:'judge01',na:[3.5,3.5,4,3.5,4],act:[4,3.5,4,4,3.5],note:'호흡과 발음의 완성도를 높여 보세요.',status:'submitted'}
]};
const clone=v=>JSON.parse(JSON.stringify(v));
function currentSnapshot(){return clone({roster:S.roster,grades:S.grades,judges:S.judges,folders:S.folders,published:S.published,archived:S.archived,rubrics:S.rubrics,rubricVersion:S.rubricVersion,rubricFrozen:S.rubricFrozen});}
function applySnapshot(v){S.roster=clone(v.roster||[]);S.grades=clone(v.grades||[]);S.judges=clone(v.judges||[]);S.folders=clone(v.folders||{});S.published=!!v.published;S.archived=!!v.archived;S.rubrics=normalizeRubrics(v.rubrics);S.rubricVersion=v.rubricVersion||0;S.rubricFrozen=!!v.rubricFrozen;S.edit={};S.selected=null;S.judgePage=0;S.expandedClasses={'청소년':[],'성인':[]};S.rosterSearch='';S.rosterGroup='전체';}
function initPreview(){S.previewRole='admin';S.examId=EXAM_ID;S.sessions=[{examId:EXAM_ID,date:'2026-10-17',month:'2026-10',title:'10월 중간평가',published:false,archived:false},{examId:'2026-11-21__01',date:'2026-11-21',month:'2026-11',title:'11월 정기평가 (빈 채점표)',published:false,archived:false}];S.previewData={};S.previewData[EXAM_ID]={roster:clone(DEMO.participants),grades:clone(DEMO.grades),judges:clone(DEMO.judges),folders:{},published:false,archived:false,rubrics:defaultRubrics(),rubricVersion:1,rubricFrozen:true};S.previewData['2026-11-21__01']={roster:clone(DEMO.participants),grades:[],judges:clone(DEMO.judges),folders:{},published:false,archived:false,rubrics:defaultRubrics(),rubricVersion:0,rubricFrozen:false};applySnapshot(S.previewData[EXAM_ID]);setPreviewRole('admin')}
function switchPreviewExam(id){if(S.examId)S.previewData[S.examId]=currentSnapshot();if(!S.previewData[id])throw Error('선택한 미리보기 회차가 없습니다.');S.examId=id;applySnapshot(S.previewData[id]);const meta=S.sessions.find(x=>x.examId===id);S.sessionTitle=meta&&meta.title||'';S.examDate=meta&&meta.date||'';render();}
// R04 Phase 1: visible read-only canonical roster after real Firebase staff sign-in.
// No session, score, media, enrollment or persisted participation mutation exists here.
function kstRosterDateR04(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
async function refreshCanonicalAdminRosterR04(date){
 const requested=date||S.rosterDate||kstRosterDateR04();
 const response=await call(FN.r04RosterPreview,{date:requested});
 if(response.ok!==true||response.mode!=='admin-roster-preview-read-only'||response.saveEnabled!==false)throw Error('R04 명단 조회 응답이 올바르지 않습니다.');
 if(!Array.isArray(response.participants)||!Array.isArray(response.reviewItems))throw Error('R04 명단 자료가 올바르지 않습니다.');
 S.rosterPreviewOnly=true;S.rosterDate=requested;S.roster=response.participants;S.rosterReview=response.reviewItems;
 S.rosterReviewSummary=response.reviewSummary||{};S.grades=[];S.judges=[];S.folders={};S.sessions=[];S.examId='';
 S.view='targets';S.published=false;S.archived=false;S.selected=null;render();
}
function renderCanonicalAdminRosterR04(){
 const rows=S.roster||[],checks=S.rosterReview||[],summary=S.rosterReviewSummary||{};
 const visible=rows.filter(p=>(S.rosterGroup==='전체'||p.group===S.rosterGroup)&&(!S.rosterSearch||[p.name,p.className,p.classId].some(x=>str(x).toLowerCase().includes(S.rosterSearch.toLowerCase()))));
 const classes=new Set(rows.map(p=>str(p.classId))).size;
 app.innerHTML=prefix()+`<div class="heading-row"><div><h1>울림앱 현재 수강생 · R04 평가 대상</h1><p class="muted">기존 울림앱 수강 명단 연결 확인 · 관리자 전용 조회 · 이 표는 현재 수강 명단의 미리보기이며 회차 상태와 별도입니다</p></div><span class="chip wait">읽기 전용</span></div><div class="panel"><div class="flex"><strong>${esc(S.rosterDate)} 기준 · ${classes}개 반 · 준비 대상 ${rows.length}건</strong><label>조회 날짜 <input id="r04PreviewDate" type="date" value="${esc(S.rosterDate)}"></label><button id="r04PreviewRefresh" class="btn line">새로고침</button></div><div class="flex top-gap"><label>구분 <select id="r04PreviewGroup"><option value="전체">전체</option>${GROUPS.map(g=>`<option value="${g}" ${g===S.rosterGroup?'selected':''}>${g}</option>`).join('')}</select></label><label>학생 · 반 검색 <input id="r04PreviewSearch" maxlength="100" value="${esc(S.rosterSearch)}" placeholder="학생 또는 반"></label></div><div class="scroll-table top-gap"><table class="wide-table"><thead><tr><th>구분</th><th>반</th><th>학생</th><th>상태</th></tr></thead><tbody>${visible.map(p=>`<tr><td>${esc(p.group)}</td><td>${esc(p.className)}</td><td>${esc(p.name)}</td><td><span class="chip wait">현재 수강 명단</span></td></tr>`).join('')||'<tr><td colspan="4">조회 결과가 없습니다.</td></tr>'}</tbody></table></div></div><div class="panel"><h2 class="panel-title">관리자 확인 필요 · ${checks.length}건</h2><p class="hint">담당 강사를 확인할 수 없는 반 등은 평가 대상 발급 전 관리자가 확인해야 합니다. 이 화면에서 자동으로 청소년반에 배정하지 않습니다.</p>${checks.length?`<div class="scroll-table"><table class="wide-table"><thead><tr><th>학생</th><th>사유</th><th>수강 반</th></tr></thead><tbody>${checks.map(x=>`<tr><td>${esc(x.studentName)}</td><td>${esc(x.reason)}</td><td>${esc((x.classes||[]).map(c=>c.className).join(', '))}</td></tr>`).join('')}</tbody></table></div>`:'<p>현재 관리자 확인 대상으로 분류된 명단이 없습니다.</p>'}<p class="hint">이 목록은 서버의 실제 수강 명단을 읽어 표시한 것입니다. 아직 회차 생성, 참가 ID 저장, 강사 채점·학생 공개, 관리자 이동/삭제 기능은 연결되지 않았습니다.</p></div>`;
 renderR04AdminSessionControls();
 $('r04PreviewDate').onchange=()=>{};
 $('r04PreviewRefresh').onclick=()=>withBusy($('r04PreviewRefresh'),()=>refreshCanonicalAdminRosterR04($('r04PreviewDate').value));
 $('r04PreviewGroup').onchange=e=>{S.rosterGroup=e.target.value;renderCanonicalAdminRosterR04();};
 $('r04PreviewSearch').onchange=e=>{S.rosterSearch=str(e.target.value);renderCanonicalAdminRosterR04();};
}
// RUN167: administrator-only R04 persisted session status and explicit ON/OFF UI.
// Independent of the legacy 20261017 grading controls; no implicit state mutation.
const R04_EXAM_ID_PATTERN=/^r04_20\d{4}_r0[1-9]$/;
function parseR04StateReadOnly(out,id){
 if(!out||out.ok!==true||out.mode!=='admin-persisted-session-roster-read-only'||
    out.saveEnabled!==false||out.examId!==id||!R04_EXAM_ID_PATTERN.test(id)||
    !Number.isSafeInteger(out.stateVersion)||out.stateVersion<0||
    !Number.isSafeInteger(out.participantCount)||out.participantCount<1||
    !Array.isArray(out.participants)||out.participants.length!==out.participantCount||
    (out.sessionState!=='open'&&out.sessionState!=='closed')||
    typeof out.gradingOpen!=='boolean'||typeof out.resultsReleased!=='boolean'||
    (out.sessionState==='closed'&&out.gradingOpen===true))
   throw Error('회차 상태·버전을 확인할 수 없습니다. 변경은 차단합니다.');
 return {examId:id,sessionState:out.sessionState,stateVersion:out.stateVersion,
   gradingOpen:out.gradingOpen,resultsReleased:out.resultsReleased,
   participantCount:out.participantCount};
}
async function loadR04SessionState(id){
 if(!R04_EXAM_ID_PATTERN.test(id))throw Error('R04 회차 ID 형식이 올바르지 않습니다.');
 const result=await call(FN.r04Persisted,{examId:id});
 const meta=parseR04StateReadOnly(result,id);
 if(str(S.r04SessionId)!==id)return; // A different session was selected meanwhile.
 S.r04SessionState=meta;render();
}
async function changeR04SessionState(action){
 if(preview||S.role!=='admin'||S.r04StateMutationPending)return;
 const m=S.r04SessionState;
 if(!m||m.examId!==S.r04SessionId||m.sessionState!=='open'||
    (action==='open'&&m.gradingOpen!==false)||
    (action==='close'&&m.gradingOpen!==true)||
    (action!=='open'&&action!=='close'))return;
 const phrase=(action==='open'?'ON 시작 ':'OFF 최종 종료 ')+m.examId;
 const msg=action==='close'?
  'OFF는 최종 종료이며 이 API로 다시 열 수 없습니다. 기존 평가 결과는 열람 가능하나 채점과 수정은 차단됩니다.':
  '평가를 ON으로 전환하면 배정된 강사의 채점이 허용됩니다. 실제 평가표 배정 기능은 별도 연결이 필요합니다.';
 if(window.prompt(msg+'\n승인하려면 정확하게 입력하세요: '+phrase,'')!==phrase)return;
 if(!window.confirm('최종 확인: '+phrase+'을(를) 실행할까요?'))return;
 S.r04StateMutationPending=true;S.r04SessionState=null;render();
 try{
  const result=await call(FN.r04State,{examId:m.examId,action,expectedVersion:m.stateVersion});
  if(!result||result.ok!==true||result.examId!==m.examId||
     result.action!==action||typeof result.gradingOpen!=='boolean'||
     !Number.isSafeInteger(result.stateVersion))throw Error('서버 변경 응답을 검증하지 못했습니다.');
  toast('상태 변경 응답을 확인했습니다. 서버에서 상태를 다시 조회합니다.');
  await loadR04SessionState(m.examId);
 }catch(e){toast('변경 결과 불확실: 회차 상태를 읽기 전용으로 다시 확인하세요. 재요청 금지. '+errorMessage(e));}
 finally{S.r04StateMutationPending=false;}
}
function renderR04AdminSessionControls(){
 if(preview||S.role!=='admin')return;
 const m=S.r04SessionState;
 const valid=m&&m.examId===S.r04SessionId;
 const terminal=valid&&m.sessionState==='closed';
 const label=!valid?'조회 전':terminal?'OFF · 최종 종료':m.gradingOpen?'ON · 평가 진행':'대기 · 평가 시작 전';
 const action=valid&&!terminal?(m.gradingOpen?'close':m.resultsReleased?null:'open'):null;
 const title=action==='close'?'평가 OFF · 최종 종료':'평가 ON 시작';
 const disabled=(!action||S.r04StateMutationPending);
 const hint=terminal?'이 회차는 최종 종료되어 ON으로 되돌릴 수 없습니다. 과거 평가 열람은 유지됩니다.':
  valid?('참가자 '+m.participantCount+'건 · 상태 버전 '+m.stateVersion+' · 읽기/쓰기 권한은 서버가 검증합니다.'):
  '회차를 조회해야 현재 상태와 버전을 확인할 수 있습니다. 조회 전에는 변경할 수 없습니다.';
 app.insertAdjacentHTML('afterbegin',`<section class="panel" id="r04AdminStatePanel"><div class="heading-row"><div><h2>R04 평가 회차 관리</h2><p class="muted">평가 기간 제한 없음 · 관리자만 ON/OFF · OFF 후 최종 잠금</p></div><span class="chip ${valid&&m.gradingOpen?'ok':'wait'}">${esc(label)}</span></div><div class="flex"><label>회차 ID <input id="r04StateExamId" maxlength="20" value="${esc(S.r04SessionId)}" aria-label="R04 평가 회차 ID"></label><button id="r04LoadState" class="btn line" type="button">현재 상태 조회</button><button id="r04ApplyState" class="btn" type="button" ${disabled?'disabled':''}>${esc(action?title:'상태 변경 불가')}</button></div><p class="hint">${esc(hint)}</p><p class="warn">OFF는 취소할 수 없습니다. 상태 조회 및 ON/OFF는 현재 관리자 계정에만 허용됩니다. 강사 평가 저장 및 학생 결과 공개는 별도 기능입니다.</p></section>`);
 $('r04StateExamId').onchange=e=>{S.r04SessionId=str(e.target.value);S.r04SessionState=null;render();};
 $('r04LoadState').onclick=()=>withBusy($('r04LoadState'),()=>{
  const id=str($('r04StateExamId').value);
  if(!R04_EXAM_ID_PATTERN.test(id))throw Error('R04 회차 ID 형식을 확인해 주세요.');
  S.r04SessionId=id;S.r04SessionState=null;
  return loadR04SessionState(id);
 });
 if(action&&!S.r04StateMutationPending)$('r04ApplyState').onclick=()=>changeR04SessionState(action);
}

// RUN178 R04 teacher workspace uses only the deployed authenticated R04 API.
// The legacy grading overview and save endpoints are never invoked by a live teacher.
function validateR04TeacherRow(row){
 if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.participationId!=='string'||
   !/^[^/\\\x00-\x1f\x7f]{1,180}$/u.test(row.participationId)||
   !['adult','youth'].includes(row.audience)||!['active','archived'].includes(row.participationStatus)||
   typeof row.classLabel!=='string'||typeof row.studentLabel!=='string'||
   !/^(성인|청소년) [가나다라마바사아자차카타파하]\d*반$/u.test(row.classLabel)||
   !/^[가나다라마바사아자차카타파하]\d*$/u.test(row.studentLabel))throw Error('강사 익명 평가 명단의 형식이 올바르지 않습니다.');
 const g=row.grade;
 if(g!==null){
  if(!g||typeof g!=='object'||!['draft','submitted'].includes(g.status)||
    !Number.isSafeInteger(g.revision)||g.revision<1||!validR04GradeScores(g.na,g.status)||
    !validR04GradeScores(g.act,g.status)||typeof g.note!=='string'||g.note.length>1000||
    (g.status==='submitted'&&!g.note.trim()))throw Error('저장된 평가표 정보가 올바르지 않습니다.');
 }
 return true;
}
function validR04GradeScores(arr,status){return Array.isArray(arr)&&arr.length===5&&arr.every(x=>x===null&&status==='draft'||
 typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=5&&Number.isInteger(x*2));}
async function reloadR04Teacher(){
 const examId=S.examId;
 const out=await call(FN.r04TeacherWorkspace,{examId});
 if(!out||out.ok!==true||out.mode!=='teacher-grade-workspace'||out.examId!==examId||
    out.group!=='all'||!['open','closed'].includes(out.sessionState)||typeof out.gradingOpen!=='boolean'||
    !Number.isSafeInteger(out.participantCount)||out.participantCount<1||out.participantCount>150||
    !Array.isArray(out.rows)||out.rows.length!==out.participantCount)
   throw Error('R04 강사 평가 명단을 확인할 수 없습니다.');
 const ids=new Set(),rows=[],grades=[];
 for(const row of out.rows){
  validateR04TeacherRow(row);
  if(ids.has(row.participationId))throw Error('중복된 평가 참가 ID가 있습니다.');
  ids.add(row.participationId);
  rows.push({participationId:row.participationId,studentUid:'',classId:row.classLabel,
    className:row.classLabel,name:row.studentLabel,group:row.audience==='adult'?'성인':'청소년',
    participationStatus:row.participationStatus,media:{audio:'',video:''}});
  if(row.grade)grades.push({...row.grade,participationId:row.participationId,teacherUid:S.auth.teacherUid});
 }
 if(examId!==S.examId||S.role!=='teacher')return;
 S.roster=rows;S.grades=grades;S.judges=[];S.folders={};S.archived=out.sessionState==='closed';
 S.published=false;S.r04TeacherReady=true;S.r04TeacherGradingOpen=out.gradingOpen===true&&out.sessionState==='open';
 S.edit={};S.selected=S.roster.some(p=>participantKey(p)===S.selected)?S.selected:null;
 render();
}
async function refreshSessions(){if(preview)return;if(S.role==='teacher'){S.examId='r04_202610_r01';S.sessions=[{examId:S.examId,date:'2026-10-30',month:'2026-10',title:'R04 모의고사 1회차',published:false,archived:false}];return reloadR04Teacher();}if(S.role==='admin')return refreshCanonicalAdminRosterR04();const out=await call(FN.sessions,{});if(out.ok!==true)throw Error('평가 회차 목록을 불러오지 못했습니다.');S.sessions=Array.isArray(out.sessions)?out.sessions:[];if(!S.sessions.some(x=>x.examId===S.examId))S.examId=S.sessions.length?S.sessions[0].examId:'';if(S.examId)await reload();else{applySnapshot({});S.sessionTitle='';render();}}
async function switchExam(id){if(!S.sessions.some(x=>x.examId===id))return toast('해당 회차를 열람할 수 없습니다.');if(preview){switchPreviewExam(id);return;}S.examId=id;S.edit={};S.selected=null;S.judgePage=0;S.expandedClasses={'청소년':[],'성인':[]};await reload();}
function sessionBar(){const m=S.sessions.find(x=>x.examId===S.examId);return `<section class="session-bar"><div><strong>평가 회차</strong><small>${m?esc(m.date+' · '+m.title):'생성 또는 선택된 회차 없음'}</small></div><div class="session-picker"><select aria-label="평가 회차 선택" id="sessionSelect"><option value="" ${!S.examId?'selected':''} disabled>회차를 선택하세요</option>${S.sessions.map(x=>`<option value="${esc(x.examId)}" ${S.examId===x.examId?'selected':''}>${esc(x.month+' · '+x.title)}${x.archived?' · 보관':x.published?' · 공개':''}</option>`).join('')}</select><span class="chip ${S.archived?'wait':S.published?'ok':'wait'}">${S.archived?'보관됨':S.published?'공개됨':'작성 중'}</span></div></section>`;}
function prefix(){return (preview?previewBar():'')+sessionBar();}
function bindSessionPicker(){const el=$('sessionSelect');if(el)el.onchange=e=>withBusy(el,()=>switchExam(e.target.value));}

function setPreviewRole(role){S.previewRole=role;S.role=role;S.auth=role==='teacher'?{uid:'judge01',teacherUid:'judge01',name:'평가강사 A'}:role==='student'?{uid:'stu01',studentUid:'stu01',name:'김하늘'}:{uid:'admin01',name:'관리자'};S.selected=null;S.expandedClasses={'청소년':[],'성인':[]};S.judgePage=0;badge();render();}
function previewBar(){return `<div class="panel" style="border-style:dashed"><div class="flex"><strong>미배포 화면 미리보기</strong><span class="muted">예시 이름·점수만 사용하며 실제 학원 데이터와 연결되지 않습니다.</span></div><div class="login-switch">${['admin','teacher','student'].map(r=>`<button class="seg ${S.role===r?'active':''}" data-preview-role="${r}">${r==='admin'?'관리자 화면':r==='teacher'?'강사 화면':'학생 화면'}</button>`).join('')}<button class="seg" id="togglePreviewPublished">${S.published?'공개 해제 (시연)':'결과 공개 (시연)'}</button></div></div>`}
async function runtime(){if(S.rt)return S.rt;const owner=window.ULIM_ROOM_CLASSROOM_REALTIME_72919;if(!owner||typeof owner.preloadRuntime!=='function')throw Error('기존 Firebase 인증 모듈을 불러오지 못했습니다.');S.rt=await owner.preloadRuntime();return S.rt}
async function call(name,payload){const rt=await runtime();if(!rt.auth.currentUser)throw Error('로그인이 필요합니다.');const res=await rt.sdk.httpsCallable(rt.functions,name)(payload||{});return res&&res.data||{};}
async function authenticateStaff(id,pw){const rt=await runtime();const norm=str(id).normalize('NFKC').toLowerCase();if(!norm||!pw)throw Error('교직원 ID와 비밀번호를 입력해주세요.');const bytes=new TextEncoder().encode('ulimvoice-staff-password-v1\u001f'+norm),d=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));let raw='';d.forEach(v=>raw+=String.fromCharCode(v));const email='u_'+btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')+'@auth.ulimvoice.app';await rt.sdk.setPersistence(rt.auth,rt.sdk.browserLocalPersistence);await rt.sdk.signInWithEmailAndPassword(rt.auth,email,pw);await bindSession();}
async function authenticateStudent(name,pw){const rt=await runtime();const login=await rt.sdk.httpsCallable(rt.functions,'loginStudentFirebaseSecure73551526')({name:str(name),password:String(pw)});const token=str(login&&login.data&&login.data.customToken);if(!token)throw Error('학생 인증에 실패했습니다.');await rt.sdk.setPersistence(rt.auth,rt.sdk.browserLocalPersistence);await rt.sdk.signInWithCustomToken(rt.auth,token);await bindSession();}
async function bindSession(){const rt=await runtime(),user=rt.auth.currentUser;if(!user){S.auth=null;S.role=null;badge();render();return;}const c=(await rt.sdk.getIdTokenResult(user,false)).claims||{},r=str(c.role);if(!['teacher','admin','superAdmin','student'].includes(r)||c.authVersion==null)throw Error('현재 계정의 인증 권한을 확인할 수 없습니다.');if(r==='teacher'&&!str(c.teacherUid)||r==='student'&&!str(c.studentUid))throw Error('계정 식별 정보가 없습니다.');
S.role=r==='superAdmin'||r==='admin'?'admin':r;
S.auth={uid:str(user.uid),studentUid:str(c.studentUid),teacherUid:str(c.teacherUid),name:str(c.name||c.displayName||user.displayName||c.loginId||(r==='student'?'학생':'강사'))};
// Personal names and permissions displayed here are advisory: every endpoint must revalidate Firebase token claims.
try{if(S.role==='student'){const p=await call('getStudentFirebaseProfile7355030',{});if(p&&p.ok&&str(p.studentUid)===S.auth.studentUid)S.auth.name=str(p.name)||S.auth.name;else throw Error('학생 프로필 확인에 실패했습니다.');}}catch(e){if(S.role==='student')throw e;}
badge();await refreshSessions();}
async function reload(){if(!preview&&S.role==='teacher')return reloadR04Teacher();if(!S.examId){applySnapshot({});render();return;}const requestExamId=S.examId;const a=await call(FN.overview,{examId:requestExamId});if(requestExamId!==S.examId)return;if(a.ok!==true)throw Error('평가 현황을 불러오지 못했습니다.');S.roster=rosterForView(Array.isArray(a.participants)?a.participants:[],S.role);S.grades=Array.isArray(a.grades)?a.grades:[];S.judges=Array.isArray(a.judges)?a.judges:[];S.folders=a.classFolders||{};S.rubrics=normalizeRubrics(a.rubrics);S.rubricVersion=Number(a.rubricVersion)||0;S.rubricFrozen=a.rubricFrozen===true;S.published=a.published===true;S.archived=a.archived===true;S.sessionTitle=str(a.title);S.examDate=str(a.date);S.selected=S.roster.some(p=>participantKey(p)===S.selected)?S.selected:null;render();}
function loginView(){app.innerHTML=`<section class="login-box"><h1>모의고사 평가</h1><p class="muted">강사는 울림앱 교직원 계정, 학생은 기존 울림앱 학생 계정으로 로그인합니다.</p><div class="login-switch"><button class="seg active" data-login-mode="staff">강사 · 관리자</button><button class="seg" data-login-mode="student">학생</button></div><form id="loginForm"><div class="field"><label id="loginIdLabel">교직원 아이디</label><input name="loginId" required autocomplete="username" placeholder="울림앱 아이디"></div><div class="field"><label>비밀번호</label><input name="loginPw" required type="password" autocomplete="current-password"></div><button class="btn wide" type="submit">로그인</button></form><div class="warn">평가 서버가 연결되고 계정 권한이 검증되기 전에는 평가 데이터를 표시하거나 저장하지 않습니다.</div></section>`;let mode='staff';app.querySelectorAll('[data-login-mode]').forEach(btn=>btn.onclick=()=>{mode=btn.dataset.loginMode;app.querySelectorAll('[data-login-mode]').forEach(x=>x.classList.toggle('active',x===btn));$('loginIdLabel').textContent=mode==='student'?'학생 이름':'교직원 아이디';app.querySelector('[name=loginId]').placeholder=mode==='student'?'학생 이름':'울림앱 아이디'});$('loginForm').onsubmit=e=>{e.preventDefault();const form=e.target,id=form.elements.loginId.value,pw=form.elements.loginPw.value;const btn=form.querySelector('button[type=submit]');withBusy(btn,async()=>{if(mode==='staff')await authenticateStaff(id,pw);else await authenticateStudent(id,pw);toast('로그인이 완료되었습니다.')})};}
function rubric(g,editable,group){const sections=S.rubrics[group]||defaultRubrics()[group];const row=(items,key)=>`<section class="rubric"><h3>${key==='na'?'NA · 나레이션':'독백 · 연기'} <span class="numeric" data-sum="${key}">${fmt((g&&Array.isArray(g[key])?g[key]:[]).reduce((n,x)=>n+(typeof x==='number'?x:0),0))} / 25</span></h3><table><thead><tr><th>평가 항목</th><th>5점 만점</th></tr></thead><tbody>${items.map((item,i)=>`<tr><td><strong>${esc(item.title)}</strong>${item.description?`<div class="rubric-detail">${esc(item.description)}</div>`:''}</td><td>${editable?`<select data-score="${key}" data-idx="${i}"><option value="">선택</option>${Array.from({length:11},(_,p)=>{const x=p*.5;return `<option value="${x}" ${g&&g[key]&&g[key][i]===x?'selected':''}>${x}점</option>`}).join('')}</select>`:`<strong>${g&&typeof g[key][i]==='number'?fmt(g[key][i])+'점':'—'}</strong>`}</td></tr>`).join('')}</tbody></table></section>`;return row(sections.na,'na')+row(sections.act,'act');}

function media(p){const a=driveLink(p.media&&p.media.audio),v=driveLink(p.media&&p.media.video);return `<div class="media-links">${a?`<a target="_blank" rel="noopener noreferrer" href="${esc(a)}">▶ 음성 녹음 열기</a>`:'<span>음성 링크 없음</span>'}${v?`<a target="_blank" rel="noopener noreferrer" href="${esc(v)}">▶ 영상 열기</a>`:'<span>영상 링크 없음</span>'}</div>`}
function hero(p,val,caption){return `<div class="score-hero"><div><h2>${esc(p.name)}</h2><p>${esc(p.className||'')} · ${esc(p.group||'')}</p></div><div class="score-number">${fmt(val)} <small>${esc(caption||'50점 만점')}</small></div></div>`}
// A student can legitimately have multiple independent class participations.
// Never associate grades using studentUid alone when there is more than one class.
// The R04 teacher client receives only server-issued aliases and participation IDs.
// Missing alias evidence is never replaced by a real student/class label.
function rosterForView(participants,role){if(role!=='teacher')return participants;
 return participants.filter(p=>str(p.participationId)&&str(p.studentLabel)&&str(p.classLabel))
 .map(p=>({participationId:str(p.participationId),studentUid:'',classId:str(p.classLabel),group:p.group,name:str(p.studentLabel),className:str(p.classLabel),media:{audio:driveLink(p.media&&p.media.audio)||'',video:driveLink(p.media&&p.media.video)||''}}));
}
function participantKey(p){return str(p&&p.participationId)||JSON.stringify([str(p&&p.group),str(p&&p.classId),str(p&&p.studentUid)]);}
function gradeFor(p,teacherUid){if(!p||!teacherUid)return null;
 const ownId=str(p.participationId);
 if(ownId)return S.grades.find(g=>str(g.participationId)===ownId&&g.teacherUid===teacherUid)||null;
 const sameStudent=S.roster.filter(x=>x.studentUid===p.studentUid);
 if(sameStudent.length!==1)return null; // old server payload is ambiguous
 return S.grades.find(g=>!str(g.participationId)&&g.studentUid===p.studentUid&&g.teacherUid===teacherUid)||null;
}
function myGrade(p){return gradeFor(p,S.auth&&S.auth.teacherUid);}
function draft(p){const key=participantKey(p),old=S.edit[key];if(old)return old;const g=myGrade(p);return S.edit[key]={na:g&&Array.isArray(g.na)?g.na.slice():Array(5).fill(null),act:g&&Array.isArray(g.act)?g.act.slice():Array(5).fill(null),note:str(g&&g.note),status:g&&g.status||'draft'};}
// R03: evaluate candidates through class headers; allow independent expand/collapse per class.
// Do not read participant records from the browser; only render the authorized server roster.
function teacherClasses(list){
 const map=new Map();
 list.forEach(student=>{
  const id=str(student.classId),name=str(student.className)||'반명 미지정';
  const key=id?'id:'+id:'name:'+name;
  if(!map.has(key))map.set(key,{key,name,id,students:[]});
  map.get(key).students.push(student);
 });
 return [...map.values()];
}
function teacherView(){
 const list=S.roster.filter(p=>p.group===S.group);
 const classes=teacherClasses(list);
 if(S.selected&&!list.some(p=>participantKey(p)===S.selected))S.selected=null;
 const p=list.find(x=>participantKey(x)===S.selected)||null,g=p?draft(p):null;
 const opened=S.expandedClasses[S.group]||[];
 const classMarkup=classes.map((c,i)=>{
   const isOpen=opened.includes(c.key),done=c.students.filter(x=>{const grade=myGrade(x);return grade&&grade.status==='submitted'}).length;
   return `<section class="class-accordion"><button type="button" class="class-toggle ${isOpen?'open':''}" data-class-toggle="${esc(c.key)}" aria-expanded="${isOpen?'true':'false'}" aria-controls="exam-class-${i}"><span class="class-title"><span class="class-chevron" aria-hidden="true">${isOpen?'▾':'▸'}</span><span><strong>${esc(c.name)}</strong>${preview&&c.id?`<small>${esc(c.id)}</small>`:''}</span></span><span class="class-count">${c.students.length}명 <small>완료 ${done}/${c.students.length}</small></span></button><div class="class-students" id="exam-class-${i}" ${isOpen?'':'hidden'}>${c.students.map(student=>{const h=myGrade(student),key=participantKey(student);return `<button type="button" class="student-choice ${S.selected===key?'active':''}" data-student="${esc(key)}" ${S.selected===key?'aria-current="true"':''}><b>${esc(student.name)}</b><span class="chip ${h&&h.status==='submitted'?'ok':'wait'}">${h&&h.status==='submitted'?'완료':'미완료'}</span></button>`}).join('')}</div></section>`;
 }).join('');
 app.innerHTML=prefix()+`<div class="heading-row"><div><h1>강사 평가 입력</h1><p>NA 25점 + 독백 25점 = 총 50점 · ${!preview?(S.r04TeacherGradingOpen?'현재 채점 ON':'현재 채점 OFF · 읽기 전용'): '미리보기'}</p></div><button class="btn line" id="refreshBtn" ${preview?'hidden':''}>새로고침</button></div><div class="tabs"><button class="seg ${S.group==='청소년'?'active':''}" data-group="청소년">청소년반</button><button class="seg ${S.group==='성인'?'active':''}" data-group="성인">성인반</button></div><div class="layout"><aside class="panel"><div class="panel-title">평가 대상 <span class="hint">${classes.length}개 반 · ${list.length}명</span></div><p class="hint class-help">반명을 눌러 학생 목록을 펼치거나 접을 수 있습니다.</p><div class="student-list">${classMarkup||'<p class="muted">이 그룹에 연결된 익명 평가 대상이 없습니다. 서버에서 R04 익명 명단 API를 연결해야 합니다.</p>'}</div></aside><article class="panel">${p?hero(p,gradeTotal(g),'작성 중 · 50점 만점')+media(p)+rubric(g,preview||S.r04TeacherGradingOpen&&!S.archived&&p.participationStatus==='active',p.group)+`<div class="field"><label>강사 한줄평 · 최종 제출 시 필수</label><textarea id="noteInput" maxlength="300" ${!preview&&(!S.r04TeacherGradingOpen||S.archived||p.participationStatus==='archived')?'disabled':''} placeholder="학생의 강점과 개선점을 구체적으로 작성해주세요.">${esc(g.note)}</textarea></div><p class="hint">임시저장은 미완료 상태로 기록됩니다. 최종 제출하려면 점수 10항목과 한줄평을 모두 작성해주세요.</p><div class="action-row"><button id="draftBtn" class="btn line" ${S.archived||S.published||!preview&&(!S.r04TeacherGradingOpen||p.participationStatus==='archived'||S.r04TeacherSavePending)?'disabled':''}>임시저장</button><button id="submitBtn" class="btn" ${S.archived||S.published||!preview&&(!S.r04TeacherGradingOpen||p.participationStatus==='archived'||S.r04TeacherSavePending)?'disabled':''}>평가 완료 · 저장</button></div>`:'<div class="empty-evaluation"><h2>평가 학생 선택</h2><p>왼쪽에서 반명을 클릭해 학생 목록을 펼친 후 평가할 학생을 선택해주세요.</p></div>'}</article></div>`;
 app.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{S.group=b.dataset.group;S.selected=null;render()});
 app.querySelectorAll('[data-class-toggle]').forEach(b=>b.onclick=()=>{
   const group=S.group,key=b.dataset.classToggle,opened=S.expandedClasses[group]||[];
   S.expandedClasses[group]=opened.includes(key)?opened.filter(x=>x!==key):[...opened,key];
   render();
   const next=[...app.querySelectorAll('[data-class-toggle]')].find(el=>el.dataset.classToggle===key);
   if(next)next.focus();
 });
 app.querySelectorAll('[data-student]').forEach(b=>b.onclick=()=>{S.selected=b.dataset.student;render()});
 if($('refreshBtn'))$('refreshBtn').onclick=()=>withBusy($('refreshBtn'),reload);
 if(!p)return;
 app.querySelectorAll('[data-score]').forEach(el=>el.onchange=()=>{g[el.dataset.score][Number(el.dataset.idx)]=el.value===''?null:Number(el.value);const total=gradeTotal(g);app.querySelector('.score-number').firstChild.textContent=fmt(total)+' ';for(const key of ['na','act'])app.querySelector(`[data-sum="${key}"]`).textContent=fmt(score(g[key]))+' / 25'});
 $('noteInput').oninput=e=>g.note=e.target.value;
 $('draftBtn').onclick=()=>saveGrade(p,g,'draft',$('draftBtn'));
 $('submitBtn').onclick=()=>saveGrade(p,g,'submitted',$('submitBtn'));
}

// Only server-issued participation IDs are used for live R04 teacher writes.
// expectedRevision comes from this authenticated teacher's own grade document.
async function saveR04TeacherGrade(p,g,status,btn){
 if(S.r04TeacherSavePending)return;
 if(!S.r04TeacherReady||!S.r04TeacherGradingOpen||S.archived||S.published||
    p.participationStatus!=='active'||!S.examId||!str(p.participationId))
  return toast('현재 회차는 채점 또는 수정이 허용되지 않습니다.');
 const old=myGrade(p),expectedRevision=old?old.revision:0;
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)return toast('평가 저장 버전을 확인할 수 없습니다.');
 if(!validR04GradeScores(g.na,status)||!validR04GradeScores(g.act,status)||
    typeof g.note!=='string'||g.note.trim().length>1000||
    status==='submitted'&&!g.note.trim())return toast('평가 10항목 점수와 한줄평을 확인해 주세요.');
 const payload={examId:S.examId,participationId:p.participationId,na:g.na.map(x=>x),
   act:g.act.map(x=>x),note:g.note.trim(),status,expectedRevision};
 S.r04TeacherSavePending=true;
 await withBusy(btn,async()=>{
  const result=await call(FN.r04TeacherSave,payload);
  if(!result||result.ok!==true||result.examId!==payload.examId||
     result.participationId!==payload.participationId||result.status!==status||
     result.revision!==expectedRevision+1)throw Error('R04 평가 저장 응답이 올바르지 않습니다.');
  await reloadR04Teacher();
  toast(status==='submitted'?'평가표가 저장·제출됐습니다.':'임시저장했습니다.');
 });
 S.r04TeacherSavePending=false;
 // If a server error happened, restore the original view without assuming a write succeeded.
 // A conflict is resolved only by refreshing server-owned revisions.
}
async function saveGrade(p,g,status,btn){if(!preview&&S.role==='teacher')return saveR04TeacherGrade(p,g,status,btn);if(!str(p.participationId)&&S.roster.filter(x=>x.studentUid===p.studentUid).length>1)return toast('동일 학생의 복수 반 평가 ID가 서버에서 전달되지 않아 저장을 차단했습니다.');if(S.published||S.archived||!S.examId)throw Error('해당 평가 회차는 저장할 수 없습니다.');if(status==='submitted'&&(!fullScore(g)||!str(g.note)))return toast('10개 항목 점수와 강사 한줄평을 모두 작성해주세요.');await withBusy(btn,async()=>{const payload={examId:S.examId,studentUid:p.studentUid,classId:p.classId,...(str(p.participationId)?{participationId:p.participationId}:{}),na:g.na,act:g.act,note:str(g.note),status};if(preview){const i=S.grades.findIndex(x=>x.teacherUid===S.auth.teacherUid&&(str(p.participationId)?str(x.participationId)===str(p.participationId):x.studentUid===p.studentUid&&!str(x.participationId)));const next={...payload,teacherUid:S.auth.teacherUid};if(i>=0)S.grades[i]=next;else S.grades.push(next);S.rubricFrozen=true;}else{const x=await call(FN.save,payload);if(!x.ok)throw Error('서버 저장 확인에 실패했습니다.');await reload()}
g.status=status;toast(status==='submitted'?'평가가 서버에 제출되었습니다.':'임시저장되었습니다.');if(preview)render()});}
function submitted(p,j){const g=gradeFor(p,j.teacherUid);return g&&g.status==='submitted'&&fullScore(g)?g:null;}
function studentAverage(p){const vals=S.judges.map(j=>submitted(p,j));if(!vals.length||vals.some(x=>!x))return null;return vals.reduce((x,g)=>x+gradeTotal(g),0)/vals.length;}
function leaderboard(group){let arr=S.roster.filter(p=>p.group===group).map(p=>({p,avg:studentAverage(p),done:S.judges.filter(j=>submitted(p,j)).length}));arr.sort((a,b)=>(b.avg??-1)-(a.avg??-1)||a.p.name.localeCompare(b.p.name,'ko'));let last=null,rank=0;arr.forEach((x,i)=>{if(x.avg==null){x.rank=null;return;}if(last===null||Math.abs(last-x.avg)>1e-8)rank=i+1;last=x.avg;x.rank=rank});return arr;}
function completion(){return {total:S.roster.length*S.judges.length,done:S.roster.reduce((sum,p)=>sum+S.judges.filter(j=>submitted(p,j)).length,0)}}
function adminView(){const c=completion();app.innerHTML=prefix()+`<div class="heading-row"><div><h1>모의고사 운영 관리</h1><p>평가 완료 확인 · 청소년/성인 순위 · 학생별 미디어 연결</p></div><button id="refreshBtn" class="btn line" ${preview?'hidden':''}>새로고침</button></div><div class="stat-grid"><div class="stat"><small>평가 대상 학생</small><strong>${S.roster.length}명</strong></div><div class="stat"><small>평가 강사</small><strong>${S.judges.length}명</strong></div><div class="stat"><small>평가 완료 건수</small><strong>${c.done}/${c.total}</strong></div><div class="stat"><small>학생 결과 공개</small><strong>${S.published?'공개':'비공개'}</strong></div></div><div class="tabs">${[['completion','완료 현황'],['targets','학생 · 반 명단'],['ranking','전체 순위'],['media','드라이브 · 미디어'],['rubric','평가항목 설정'],['sessions','회차 관리']].map(([v,t])=>`<button data-view="${v}" class="seg ${v===S.view?'active':''}">${t}</button>`).join('')}</div><div id="adminContent"></div>`;
app.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{S.view=b.dataset.view;render()});if($('refreshBtn'))$('refreshBtn').onclick=()=>withBusy($('refreshBtn'),reload);if(S.view==='completion')renderCompletion();if(S.view==='targets')renderTargetsAdmin();if(S.view==='ranking')renderRank();if(S.view==='media')renderMediaAdmin();if(S.view==='rubric')renderRubricAdmin();if(S.view==='sessions')renderSessionsAdmin();}
function renderSessionsAdmin(){
 const root=$('adminContent'),items=S.sessions.slice().sort((a,b)=>b.examId.localeCompare(a.examId)),active=S.sessions.find(x=>x.examId===S.examId);
 root.innerHTML=`<div class="panel"><div class="heading-row"><div><h2 class="panel-title">새 평가 회차 생성</h2><p class="muted">이전 평가를 지우지 않고 새 기록 공간을 만듭니다. 수강생은 생성 후 '울림앱 수강생 동기화'로 해당 시점의 명단을 불러옵니다.</p></div></div><form id="createSessionForm"><div class="session-form-grid"><div class="field"><label>평가 날짜</label><input name="examDate" type="date" min="2020-01-01" max="2099-12-31" value="${preview?'2026-12-19':new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}" required></div><div class="field"><label>회차 이름</label><input name="examTitle" maxlength="80" value="정기 모의고사" placeholder="예: 12월 모의고사" required></div><div class="field"><label>평가항목 가져오기</label><select name="sourceExamId"><option value="">기본 평가항목 사용</option>${items.map(x=>`<option value="${esc(x.examId)}" ${x.examId===S.examId?'selected':''}>${esc(x.month+' · '+x.title)}</option>`).join('')}</select></div></div><div class="action-row"><button class="btn" type="submit">새 회차 생성 · 빈 평가표 준비</button></div></form><p class="hint">'초기화'는 과거 기록 삭제가 아니라 새 회차 생성입니다. 이전 점수·한줄평·미디어 링크는 새 회차로 복사되지 않습니다.</p></div>
 <div class="panel"><h2 class="panel-title">월별 평가 기록 불러오기</h2><div class="scroll-table"><table class="wide-table"><thead><tr><th>월 / 날짜</th><th>회차</th><th>상태</th><th>관리</th></tr></thead><tbody>${items.map(x=>`<tr><td><strong>${esc(x.month)}</strong><br><small>${esc(x.date)}</small></td><td>${esc(x.title)}${x.examId===S.examId?' · 현재 선택':''}</td><td><span class="chip ${x.published?'ok':'wait'}">${x.archived?'보관 완료':x.published?'결과 공개':'평가 진행 중'}</span></td><td><div class="flex"><button class="btn small line" data-open-session="${esc(x.examId)}" ${x.examId===S.examId?'disabled':''}>불러오기</button><button class="btn small line" data-archive-session="${esc(x.examId)}" ${!x.published||x.archived?'disabled':''}>보관</button></div></td></tr>`).join('')||'<tr><td colspan="4">생성된 회차가 없습니다.</td></tr>'}</tbody></table></div><p class="hint">보관된 회차는 삭제되지 않으며 관리자·강사·학생이 자신의 권한에 따라 과거 기록을 다시 조회할 수 있습니다.</p></div>`;
 const form=$('createSessionForm');form.onsubmit=e=>{e.preventDefault();const body={date:form.elements.examDate.value,title:str(form.elements.examTitle.value),sourceExamId:form.elements.sourceExamId.value};if(!confirm(`${body.date} / ${body.title} 새 평가 회차를 생성할까요? 과거 기록은 그대로 유지됩니다.`))return;adminAction('createExam',body,form.querySelector('[type="submit"]'));};
 root.querySelectorAll('[data-open-session]').forEach(b=>b.onclick=()=>withBusy(b,()=>switchExam(b.dataset.openSession)));
 root.querySelectorAll('[data-archive-session]').forEach(b=>b.onclick=()=>{if(!confirm('공개가 끝난 회차를 보관할까요? 보관 후 점수·미디어 수정은 차단되며 과거 평가 조회는 가능합니다.'))return;adminAction('archiveExam',{examId:b.dataset.archiveSession},b)});
}
// Read-only presentation of the already authenticated server roster.
// Any future add/remove/move feature requires an authenticated R04 server mutation owner.
function renderTargetsAdmin(){
 const root=$('adminContent'),items=S.roster.filter(p=>(S.rosterGroup==='전체'||p.group===S.rosterGroup)&&(!S.rosterSearch||[p.name,p.className,p.classId].some(x=>str(x).toLowerCase().includes(S.rosterSearch.toLowerCase()))));
 const classes=new Set(items.map(p=>p.classId));
 root.innerHTML=`<div class="panel"><div class="heading-row"><div><h2 class="panel-title">울림앱 연동 평가 대상</h2><p class="muted">서버에서 승인된 반별 명단을 표시합니다. 복수 수강생은 각 반마다 한 건으로 집계합니다.</p></div><span class="chip">${classes.size}개 반 · ${items.length}건</span></div><div class="flex"><label>그룹 <select id="rosterGroupFilter"><option value="전체">전체</option>${GROUPS.map(g=>`<option value="${g}" ${S.rosterGroup===g?'selected':''}>${g}</option>`).join('')}</select></label><label>학생 · 반 검색 <input id="rosterSearchInput" maxlength="100" placeholder="학생명 또는 반명" value="${esc(S.rosterSearch)}"></label></div><div class="scroll-table top-gap"><table class="wide-table"><thead><tr><th>구분</th><th>반</th><th>학생</th><th>참가 식별</th></tr></thead><tbody>${items.map(p=>`<tr><td>${esc(p.group)}</td><td>${esc(p.className)}</td><td>${esc(p.name)}</td><td>${str(p.participationId)?'<span class="chip ok">반별 참가 ID</span>':'<span class="chip wait">식별자 연결 필요</span>'}</td></tr>`).join('')||'<tr><td colspan="4">해당 조건의 평가 대상이 없습니다.</td></tr>'}</tbody></table></div><p class="hint">실제 명단 반영은 기존 '울림앱 수강생 동기화'에서 수행합니다. 임의 추가·삭제·반 이동의 서버 저장 기능은 아직 연결되지 않았으며 이 화면은 읽기 전용입니다.</p></div>`;
 $('rosterGroupFilter').onchange=e=>{S.rosterGroup=e.target.value;renderTargetsAdmin()};
 $('rosterSearchInput').onchange=e=>{S.rosterSearch=str(e.target.value);renderTargetsAdmin()};
}
function renderCompletion(){const root=$('adminContent');root.innerHTML=`<div class="panel"><div class="heading-row"><div><h2 class="panel-title">강사별 · 학생별 완료 현황</h2><p class="muted">상태는 10항목 채점과 한줄평까지 최종 제출한 경우에만 완료로 표시됩니다.</p></div></div><div class="scroll-table"><table class="wide-table"><thead><tr><th>그룹</th><th>학생명</th><th>소속 반</th>${S.judges.map(j=>`<th>${esc(j.name)}</th>`).join('')}<th>완료</th></tr></thead><tbody>${S.roster.map(p=>{const count=S.judges.filter(j=>submitted(p,j)).length;return `<tr><td>${esc(p.group)}</td><td><button class="link-btn" data-popup="${esc(participantKey(p))}">${esc(p.name)}</button></td><td>${esc(p.className)}</td>${S.judges.map(j=>`<td><span class="chip ${submitted(p,j)?'ok':'wait'}">${submitted(p,j)?'완료':'미완료'}</span></td>`).join('')}<td>${count}/${S.judges.length}</td></tr>`}).join('')}</tbody></table></div><div class="action-row"><button id="syncRosterBtn" class="btn line" ${S.published?'disabled':''}>울림앱 수강생 동기화</button><button id="publishBtn" class="btn" ${!cReady()||S.published?'disabled':''}>${S.published?'평가 공개 완료':'모든 평가 완료 → 학생에게 공개'}</button></div><p class="hint">동기화는 서버의 실제 수강 상태 및 UID를 기준으로 처리해야 합니다. 이름만으로 학생을 자동 결합하지 않습니다.</p></div>`;
root.querySelectorAll('[data-popup]').forEach(b=>b.onclick=()=>openPopup(b.dataset.popup));$('syncRosterBtn').onclick=()=>adminAction('syncRoster',{},$('syncRosterBtn'));$('publishBtn').onclick=()=>{if(confirm('모든 강사의 평가가 완료되었습니다. 학생이 평가 결과를 열람하도록 공개할까요? 공개 후 강사 수정이 제한됩니다.'))adminAction('publish',{},$('publishBtn'))};}
function cReady(){const c=completion();return c.total>0&&c.total===c.done;}
function renderRank(){const root=$('adminContent');root.innerHTML=`<div class="tabs"><button class="seg ${S.group==='청소년'?'active':''}" data-rank-group="청소년">청소년반</button><button class="seg ${S.group==='성인'?'active':''}" data-rank-group="성인">성인반</button></div><div class="panel"><h2 class="panel-title">${esc(S.group)} 전체 점수 · 순위</h2><p class="muted">총점은 제출을 마친 모든 평가 강사의 50점 만점 점수의 평균입니다. 강사별 평가가 하나라도 미완료면 순위에서 제외됩니다. 동점자는 공동 순위입니다.</p><div class="scroll-table top-gap"><table class="wide-table"><thead><tr><th>순위</th><th>학생명</th><th>반</th><th>강사 평가</th><th>평균 점수 / 50점</th></tr></thead><tbody>${leaderboard(S.group).map(x=>`<tr><td><strong>${x.rank==null?'—':x.rank+'위'}</strong></td><td><button class="link-btn" data-popup="${esc(participantKey(x.p))}">${esc(x.p.name)}</button></td><td>${esc(x.p.className)}</td><td>${x.done}/${S.judges.length}</td><td><strong>${fmt(x.avg)}</strong></td></tr>`).join('')}</tbody></table></div></div>`;root.querySelectorAll('[data-rank-group]').forEach(b=>b.onclick=()=>{S.group=b.dataset.rankGroup;renderRank()});root.querySelectorAll('[data-popup]').forEach(b=>b.onclick=()=>openPopup(b.dataset.popup));}
function renderMediaAdmin(){const classes=[...new Map(S.roster.map(p=>[p.classId,{id:p.classId,name:p.className}])).values()];const root=$('adminContent');root.innerHTML=`<div class="panel"><h2 class="panel-title">반별 Google Drive 폴더</h2><p class="muted">관리자만 입력·수정할 수 있습니다. 구글 드라이브의 폴더 권한은 별도로 설정해야 합니다.</p>${classes.map(c=>`<div class="field"><label>${esc(c.name)} · ${esc(c.id)}</label><div class="flex"><input style="flex:1;min-width:210px" data-folder-input="${esc(c.id)}" placeholder="https://drive.google.com/drive/folders/..." value="${esc(S.folders[c.id]||'')}"><button class="btn small" data-folder-save="${esc(c.id)}">저장</button><button class="btn small line" data-folder-auto="${esc(c.id)}">파일명 자동매칭</button></div></div>`).join('')}<p class="hint">동명이인·다중 매칭은 자동 연결하지 않고 수동 확인해야 합니다.</p></div><div class="panel"><h2 class="panel-title">학생별 음성·영상 링크</h2><div class="scroll-table"><table class="wide-table"><thead><tr><th>학생</th><th>음성 링크</th><th>영상 링크</th><th>저장</th></tr></thead><tbody>${S.roster.map(p=>`<tr><td><strong>${esc(p.name)}</strong><br><small>${esc(p.className)}</small></td><td><input style="min-width:210px" data-link="audio" data-student="${esc(p.studentUid)}" value="${esc(p.media&&p.media.audio||'')}" placeholder="Google Drive URL"></td><td><input style="min-width:210px" data-link="video" data-student="${esc(p.studentUid)}" value="${esc(p.media&&p.media.video||'')}" placeholder="Google Drive URL"></td><td><button class="btn small" data-media-save="${esc(p.studentUid)}">저장</button></td></tr>`).join('')}</tbody></table></div></div>`;
root.querySelectorAll('[data-folder-save]').forEach(b=>b.onclick=()=>{const id=b.dataset.folderSave,link=root.querySelector(`[data-folder-input="${CSS.escape(id)}"]`).value.trim();if(link&&!driveLink(link))return toast('Google Drive의 올바른 HTTPS 폴더 주소를 입력해주세요.');adminAction('setClassFolder',{classId:id,folderUrl:link},b)});
root.querySelectorAll('[data-folder-auto]').forEach(b=>b.onclick=()=>adminAction('autoMedia',{classId:b.dataset.folderAuto},b));
root.querySelectorAll('[data-media-save]').forEach(b=>b.onclick=()=>{const id=b.dataset.mediaSave;if(S.roster.filter(p=>p.studentUid===id).length>1)return toast('복수 수강 학생의 미디어는 반별 서버 저장 연결 후 수정할 수 있습니다.');const urls={};root.querySelectorAll('[data-student]').forEach(e=>{if(e.dataset.student===id)urls[e.dataset.link]=e.value.trim()});if(Object.values(urls).some(x=>x&&!driveLink(x)))return toast('Google Drive HTTPS 링크만 사용할 수 있습니다.');adminAction('setMedia',{studentUid:id,media:urls},b)});}
// Admin-only rubric settings UI; the server is the authorization owner.
function renderRubricAdmin(){
 const root=$('adminContent'),locked=S.archived||S.published||S.rubricFrozen;
 root.innerHTML=`<div class="panel rubric-admin"><div class="heading-row"><div><h2 class="panel-title">평가항목 설정</h2><p class="muted">청소년반과 성인반의 NA·독백 항목을 각각 수정합니다. 항목당 최고 5점, 5개 항목 × 5점 = 각 25점이며 총점은 50점으로 고정됩니다.</p></div><span class="chip ${locked?'wait':'ok'}">${locked?'채점 시작 · 수정 잠금':'수정 가능'} · 기준 v${S.rubricVersion}</span></div>
 <div class="tabs">${GROUPS.map(group=>`<button class="seg ${S.group===group?'active':''}" data-edit-group="${group}">${group}반</button>`).join('')}</div>
 ${locked?`<div class="warn">평가 임시저장·최종제출 중 하나라도 이루어진 후에는 채점 공정성을 위해 항목 수정이 잠깁니다. 기존 점수를 삭제하거나 자동 변환하지 않습니다.${preview?' 데모에서는 아래 예시 평가 초기화로 편집 동작을 확인할 수 있습니다.':''}</div>`:''}
 <form id="rubricForm">${[['na','NA · 나레이션'],['act','독백 · 연기']].map(([key,title])=>`<section class="rubric-settings-section"><h3>${title}<small>25점 만점 · 5점 × 5항목</small></h3>${S.rubrics[S.group][key].map((item,index)=>`<div class="rubric-edit-row"><span class="rubric-edit-number">${index+1}</span><div class="rubric-edit-fields"><label>평가 항목명<input data-rubric-title="${key}" data-index="${index}" maxlength="70" required value="${esc(item.title)}" ${locked?'disabled':''}></label><label>평가 기준 설명 (선택)<input data-rubric-description="${key}" data-index="${index}" maxlength="160" placeholder="평가자가 참고할 구체적인 기준" value="${esc(item.description)}" ${locked?'disabled':''}></label></div><span class="rubric-points">/ 5점</span></div>`).join('')}</section>`).join('')}
 <div class="action-row">${preview&&locked?'<button type="button" class="btn line" id="resetDemoGrading">예시 평가 초기화 후 편집</button>':''}<button type="button" class="btn line" id="restoreRubricBtn" ${locked?'disabled':''}>이 그룹 기본값 복원</button><button type="submit" class="btn" ${locked?'disabled':''}>전체 그룹 평가항목 저장</button></div></form><p class="hint">제출 시 현재 선택된 그룹과 이미 설정한 다른 그룹의 항목을 함께 보존합니다. 새로고침 후에도 저장 여부는 서버에서 확인합니다.</p></div>`;
 root.querySelectorAll('[data-edit-group]').forEach(b=>b.onclick=()=>{S.group=b.dataset.editGroup;renderRubricAdmin()});
 const form=$('rubricForm');
 if(!locked){
 const readInputs=()=>{const next=clone(S.rubrics);for(const key of ['na','act']){next[S.group][key]=Array.from({length:5},(_,i)=>({title:str(form.querySelector(`[data-rubric-title="${key}"][data-index="${i}"]`).value),description:str(form.querySelector(`[data-rubric-description="${key}"][data-index="${i}"]`).value)}));}return checkRubrics(next)};
 // Local group edits are intentionally held in form until explicitly saved.
 $('restoreRubricBtn').onclick=()=>{if(!confirm(`${S.group}반의 평가 항목을 기본값으로 되돌릴까요? 저장 버튼을 눌러야 반영됩니다.`))return;const defaults=defaultRubrics()[S.group];for(const key of ['na','act'])defaults[key].forEach((item,i)=>{form.querySelector(`[data-rubric-title="${key}"][data-index="${i}"]`).value=item.title;form.querySelector(`[data-rubric-description="${key}"][data-index="${i}"]`).value=item.description;})};
 form.onsubmit=e=>{e.preventDefault();let rubrics;try{rubrics=readInputs()}catch(err){toast(err.message);return;}if(!confirm('평가항목을 저장할까요? 이미 채점이 시작되었다면 서버에서 저장을 거부합니다.'))return;adminAction('setRubrics',{rubrics,expectedVersion:S.rubricVersion},form.querySelector('[type="submit"]'))};
 }
 if(preview&&locked&&$('resetDemoGrading'))$('resetDemoGrading').onclick=()=>{if(!confirm('미리보기용 예시 점수를 모두 초기화하고 평가항목을 수정할까요? 실제 학생 데이터에는 영향이 없습니다.'))return;S.grades=[];S.edit={};S.rubricFrozen=false;S.published=false;renderRubricAdmin()};
}
async function adminAction(action,body,btn){await withBusy(btn,async()=>{
 if(preview){
  if(action==='createExam'){
   const date=str(body.date);if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))throw Error('날짜를 확인해주세요.');
   const id=date+'__'+String(1+S.sessions.filter(x=>x.date===date).length).padStart(2,'0');
   S.previewData[S.examId]=currentSnapshot();
   const src=S.previewData[body.sourceExamId],rubrics=src?clone(src.rubrics):defaultRubrics();
   S.previewData[id]={roster:[],grades:[],judges:[],folders:{},published:false,archived:false,rubrics,rubricVersion:0,rubricFrozen:false};
   S.sessions.unshift({examId:id,date,month:date.slice(0,7),title:body.title,published:false,archived:false});switchPreviewExam(id);toast('새 예시 회차가 생성됐습니다. 점수는 비어 있습니다.');return;
  }
  if(action==='archiveExam'){
   const id=body.examId||S.examId;const record=id===S.examId?currentSnapshot():S.previewData[id];if(!record||!record.published)throw Error('공개가 완료된 회차만 보관할 수 있습니다.');record.archived=true;S.previewData[id]=record;if(id===S.examId)S.archived=true;
   const meta=S.sessions.find(x=>x.examId===id);if(meta)meta.archived=true;render();return;
  }
  if(S.archived)throw Error('보관한 평가 회차는 수정할 수 없습니다.');
  if(action==='setClassFolder')S.folders[body.classId]=body.folderUrl;
  if(action==='setMedia'){const p=S.roster.find(x=>x.studentUid===body.studentUid);if(p)p.media=body.media;}
  if(action==='publish'&&!cReady())throw Error('미완료 평가가 있습니다.');
  if(action==='publish')S.published=true;
  if(action==='syncRoster')toast('미리보기에서는 실제 학생 명단에 연결하지 않습니다.');
  if(action==='setRubrics'){if(S.rubricFrozen)throw Error('채점을 시작한 뒤에는 평가 기준을 변경할 수 없습니다.');S.rubrics=normalizeRubrics(body.rubrics);S.rubricVersion++;}
  if(action==='autoMedia')toast('미리보기에서는 Google Drive 검색을 수행하지 않습니다.');
  const meta=S.sessions.find(x=>x.examId===S.examId);if(meta)meta.published=S.published;
  S.previewData[S.examId]=currentSnapshot();render();return;
 }
 const out=await call(FN.admin,{examId:S.examId,action,...body});if(!out.ok)throw Error('관리자 작업이 완료되지 않았습니다.');
 if(action==='createExam')S.examId=out.examId;
 toast(out.message||'변경 사항이 서버에 저장되었습니다.');await refreshSessions();
});} 
function gradePresentation(g,j,group){return `<section class="judge-card"><h3>${S.role==='student'?'평가표':esc(j.name)}</h3>${g?`<p class="muted">총점 ${fmt(gradeTotal(g))} / 50점</p>${rubric(g,false,group)}<div class="field"><label>강사 한줄평</label><div class="note">${esc(g.note||'한줄평 없음')}</div></div>`:'<p class="muted">아직 평가를 완료하지 않았습니다.</p>'}</section>`}
function openPopup(id){const p=S.roster.find(x=>participantKey(x)===id);if(!p)return;const overlay=document.createElement('div');overlay.className='modal-wrap';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.innerHTML=`<div class="modal"><div class="modal-head"><h2>${esc(p.name)} · 강사별 평가</h2><button class="btn subtle" id="closeModal">닫기 ✕</button></div>${hero(p,studentAverage(p),'평가 강사 평균 / 50점')}${media(p)}<div id="modalGrade"></div><div class="pager"><button id="prevJudge">◀ 이전 강사</button><span id="pageInfo"></span><button id="nextJudge">다음 강사 ▶</button></div></div>`;document.body.appendChild(overlay);let page=0;const show=()=>{const j=S.judges[page];overlay.querySelector('#modalGrade').innerHTML=j?gradePresentation(submitted(p,j),j,p.group):'<p>평가 강사가 없습니다.</p>';overlay.querySelector('#pageInfo').textContent=j?`${page+1} / ${S.judges.length}`:'0 / 0';overlay.querySelector('#prevJudge').disabled=page<=0;overlay.querySelector('#nextJudge').disabled=page>=S.judges.length-1;};overlay.querySelector('#prevJudge').onclick=()=>{page--;show()};overlay.querySelector('#nextJudge').onclick=()=>{page++;show()};overlay.querySelector('#closeModal').onclick=()=>overlay.remove();overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};const onKey=e=>{if(e.key==='Escape'){overlay.remove();document.removeEventListener('keydown',onKey)}};document.addEventListener('keydown',onKey);show()}
function studentView(){const mine=S.roster.filter(p=>p.studentUid===S.auth.studentUid);const p=mine.find(p=>participantKey(p)===S.selected)||mine[0];if(!p||!S.published){app.innerHTML=prefix()+`<div class="center-state"><h1>평가 결과 공개 대기</h1><p>전체 강사의 평가가 완료되고 관리자가 공개하면 평가표를 확인할 수 있습니다.</p></div>`;return;}const j=S.judges[S.judgePage],g=j?submitted(p,j):null;
 const classPicker=mine.length>1?`<div class="tabs">${mine.map(x=>`<button class="seg ${participantKey(x)===participantKey(p)?'active':''}" data-own-class="${esc(participantKey(x))}">${esc(x.className)}</button>`).join('')}</div>`:'';
 app.innerHTML=prefix()+`<div class="heading-row"><div><h1>나의 모의고사 평가표</h1><p>평가표를 넘기며 확인할 수 있습니다. 강사 이름은 비공개입니다.</p></div></div>${classPicker}<div class="panel">${hero(p,studentAverage(p),'평가 점수 평균 / 50점')}${media(p)}${j?gradePresentation(g,j,p.group):'<p>평가 자료가 없습니다.</p>'}<div class="pager"><button id="prevJudge">◀ 이전 평가표</button><span>${S.judges.length?S.judgePage+1:0} / ${S.judges.length}</span><button id="nextJudge">다음 평가표 ▶</button></div></div>`;
 app.querySelectorAll('[data-own-class]').forEach(b=>b.onclick=()=>{S.selected=b.dataset.ownClass;S.judgePage=0;render()});
 if($('prevJudge')){$('prevJudge').disabled=S.judgePage===0;$('prevJudge').onclick=()=>{S.judgePage--;render()}}if($('nextJudge')){$('nextJudge').disabled=S.judgePage>=S.judges.length-1;$('nextJudge').onclick=()=>{S.judgePage++;render()}}}
function render(){badge();if(!S.auth){loginView();return;}if(S.role==='admin'&&S.rosterPreviewOnly){renderCanonicalAdminRosterR04();return;}if(S.role==='teacher')teacherView();else if(S.role==='admin')adminView();else studentView();bindSessionPicker();if(preview){app.querySelectorAll('[data-preview-role]').forEach(b=>b.onclick=()=>setPreviewRole(b.dataset.previewRole));const pb=$('togglePreviewPublished');if(pb)pb.onclick=()=>{S.published=!S.published;const meta=S.sessions.find(x=>x.examId===S.examId);if(meta)meta.published=S.published;S.previewData[S.examId]=currentSnapshot();render()}}}
logoutBtn.onclick=()=>withBusy(logoutBtn,async()=>{const rt=await runtime();await rt.sdk.signOut(rt.auth);S={...S,role:null,auth:null,rt,roster:[],grades:[],judges:[],folders:{},edit:{},examId:'',sessions:[],rosterPreviewOnly:false,rosterDate:'',rosterReview:[],rosterReviewSummary:{},r04SessionState:null,r04StateMutationPending:false,r04TeacherReady:false,r04TeacherGradingOpen:false,r04TeacherSavePending:false};render()});
async function start(){if(preview){initPreview();return}render();try{const rt=await runtime();await new Promise(resolve=>{let settled=false;let stop=()=>{};const timer=setTimeout(()=>{if(!settled){settled=true;stop();resolve()}},4500);stop=rt.sdk.onAuthStateChanged(rt.auth,()=>{if(!settled){settled=true;clearTimeout(timer);resolve()}},()=>{if(!settled){settled=true;clearTimeout(timer);resolve()}})});if(rt.auth.currentUser)await bindSession();else loginView()}catch(e){app.innerHTML=`<section class="center-state"><h1>평가 서비스 연결을 확인해주세요.</h1><p>${esc(errorMessage(e))}</p><div class="action-row"><button id="retryBtn" class="btn">다시 시도</button></div></section>`;$('retryBtn').onclick=start}}
start();
})();
