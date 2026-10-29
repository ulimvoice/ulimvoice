(function(){
'use strict';
// Single owner: this file is the only UI/controller owner for the standalone mock examination.
const EXAM_ID='2026-10-17';
const FN={sessions:'listMockExamSessions20261017',overview:'getMockExamOverview20261017',save:'saveMockExamGrade20261017',admin:'manageMockExam20261017',r04RosterPreview:'getMockExamCanonicalRosterAdminR04',r04Persisted:'getMockExamPersistedSessionAdminR04',r04State:'setMockExamSessionGradingAdminR04',r04TeacherWorkspace:'getMockExamTeacherWorkspaceR04',r04TeacherSave:'saveMockExamTeacherGradeR04',r04StudentHistory:'getMockExamStudentHistoryR04',r04AdminRelease:'manageMockExamResultReleaseAdminR04',r04AdminMedia:'manageMockExamParticipationMediaAdminR04',r04GradingMatrix:'getMockExamAdminGradingMatrixR04',r04AdminRosterEdit:'manageMockExamAdminRosterEditR04',r04Scoreboard:'getMockExamAdminScoreboardR04',r04RubricAdmin:'manageMockExamRubricAdminR04',r04GradeAdmin:'manageMockExamAdminGradeR04'};
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
let S={role:null,auth:null,rt:null,examId:'',sessions:[],sessionTitle:'',examDate:'',archived:false,previewData:{},roster:[],grades:[],judges:[],folders:{},published:false,selected:null,group:'청소년',view:'completion',judgePage:0,edit:{},previewRole:'teacher',expandedClasses:{'청소년':[],'성인':[]},rubrics:defaultRubrics(),rubricVersion:0,rubricFrozen:false,rosterSearch:'',rosterGroup:'전체',rosterPreviewOnly:false,rosterDate:'',rosterReview:[],rosterReviewSummary:{},r04SessionId:'r04_202610_r01',r04SessionState:null,r04StateMutationPending:false,r04ReleasePreview:null,r04ReleasePending:false,r04ReleasePreviewPending:false,r04MediaRoster:[],r04MediaRosterExamId:'',r04MediaRosterState:'',r04MediaResultsReleased:false,r04MediaRosterPending:false,r04MediaSelection:'',r04MediaRecord:null,r04MediaReadPending:false,r04MediaSavePending:false,r04MediaUnsafe:false,r04TeacherReady:false,r04TeacherGradingOpen:false,r04TeacherSavePending:false,r04StudentHistoryRecords:[],r04StudentHistoryReady:false,r04StudentHistoryError:'',r04StudentHistorySelection:'',r04StudentEvaluationPage:0};
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
 S.view='targets';S.published=false;S.archived=false;S.selected=null;render();if(S.role==='admin')loadR04EditorRead();
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
 renderR04AdminCore();
}
// RUN286: Core R04 admin workspace. This is a VIEW of the existing canonical roster;
// it never edits persisted participants and never confuses grade statuses with scores.
// RUN288: R04 evaluation-only roster management in existing JS owner.
const R04_EDITOR={examId:'',stateVersion:-1,sessionState:'',rows:[],classes:[],sourceStudents:[],loading:false,mutating:false,error:'',selectedClass:'',selectedParticipant:''};
function r04EditEligible(){return !preview&&S.role==='admin'&&!!S.auth&&R04_EDITOR.examId===str(S.r04SessionId)&&R04_EDITOR.sessionState==='open'&&!R04_EDITOR.mutating;}
function r04EditSelectedClass(){const k=R04_EDITOR.selectedClass;return R04_EDITOR.classes.find(c=>c.group+'|'+c.classId===k)||null;}
function r04EditSelectedParticipant(){return R04_EDITOR.rows.find(p=>p.participationId===R04_EDITOR.selectedParticipant)||null;}
async function loadR04EditorRead(){
 if(preview||S.role!=='admin'||!S.auth||R04_EDITOR.loading||R04_EDITOR.mutating)return;
 const examId=str(S.r04SessionId),uid=str(S.auth.uid);if(!R04_EXAM_ID_PATTERN.test(examId))return;
 R04_EDITOR.loading=true;R04_EDITOR.error='';
 try{
  const out=await call(FN.r04AdminRosterEdit,{action:'read',examId});
  if(out.ok!==true||out.mode!=='admin-r04-edit-roster'||out.examId!==examId||
    !Number.isSafeInteger(out.stateVersion)||!Array.isArray(out.rows)||!Array.isArray(out.classes)||
    !Array.isArray(out.sourceStudents))throw Error('관리자 명단 조회 응답을 확인할 수 없습니다.');
  const ids=new Set();
  for(const p of out.rows){if(!p||!p.participationId||ids.has(p.participationId)||!['성인','청소년'].includes(p.group)||
     !['active','archived'].includes(p.status))throw Error('참가 명단에 중복 또는 손상된 식별자가 있습니다.');ids.add(p.participationId);}
  if(S.role!=='admin'||!S.auth||str(S.auth.uid)!==uid||S.r04SessionId!==examId)return;
  const oldClass=R04_EDITOR.selectedClass,oldPart=R04_EDITOR.selectedParticipant;
  Object.assign(R04_EDITOR,{examId,stateVersion:out.stateVersion,sessionState:out.sessionState,
    classes:out.classes,rows:out.rows,sourceStudents:out.sourceStudents,error:''});
  R04_EDITOR.selectedClass=out.classes.some(c=>c.group+'|'+c.classId===oldClass)?oldClass:
    out.classes.length?out.classes[0].group+'|'+out.classes[0].classId:'';
  R04_EDITOR.selectedParticipant=out.rows.some(p=>p.participationId===oldPart)?oldPart:
    out.rows.find(p=>p.status==='active')?.participationId||out.rows[0]?.participationId||'';
 }catch(e){if(S.r04SessionId===examId){R04_EDITOR.error=errorMessage(e);R04_EDITOR.examId='';R04_EDITOR.rows=[];}}
 finally{R04_EDITOR.loading=false;if(S.role==='admin'&&S.auth&&str(S.auth.uid)===uid&&S.r04SessionId===examId)render();}
}
async function commitR04Editor(action,body){
 if(!r04EditEligible()||R04_EDITOR.sessionState!=='open')throw Error('현재 회차가 편집 가능한 상태가 아닙니다.');
 const examId=str(S.r04SessionId),prev=R04_EDITOR.stateVersion;
 const irreversible=['archiveClass','reclassClass','archiveParticipant','moveParticipant'];
 if(irreversible.includes(action)&&!window.confirm('기존 참가 ID·평가표는 보관되고 새 반으로 점수가 복사되지 않습니다. 이 평가용 명단을 변경하시겠습니까?'))return;
 if(!irreversible.includes(action)&&!window.confirm('모의고사 전용 명단을 Firestore에 저장하시겠습니까? 실제 수강 명단은 수정하지 않습니다.'))return;
 R04_EDITOR.mutating=true;
 try{
  const out=await call(FN.r04AdminRosterEdit,{action,examId,expectedVersion:prev,...body});
  if(!out||out.ok!==true||out.mode!=='admin-r04-edit-mutation-committed'||
    out.examId!==examId||out.stateVersion!==prev+1)throw Error('서버 응답이 불확실합니다. 중복 저장하지 말고 다시 조회하세요.');
  // Do not treat HTTP success alone as persistence. Fresh read verifies the stateVersion.
  R04_EDITOR.mutating=false;
  await loadR04EditorRead();
  if(R04_EDITOR.examId!==examId||R04_EDITOR.stateVersion!==out.stateVersion)
    throw Error('저장 결과 확인이 필요합니다. 다시 조회한 뒤 상태를 확인하세요.');
  clearR04PersistedView();
  Object.assign(R04_EVALUATOR_VIEW,{examId:'',evaluators:[],stateVersion:-1});
  R04_ADMIN_CORE.autoExpanded=false;R04_ADMIN_CORE.selected=-1;
  toast('Firestore 저장 및 재조회 확인 완료');
  await loadR04PersistedRosterView();
  if(R04_PERSISTED_VIEW.examId===examId)await loadR04EvaluatorMatrix();
 }catch(e){R04_EDITOR.error=errorMessage(e);toast('편집 결과를 확인해주세요: '+R04_EDITOR.error);}
 finally{R04_EDITOR.mutating=false;render();}
}
function renderR04EditorSettings(){
 const host=$('r04EditorClassHost'),students=$('r04EditorStudentHost');if(!host||!students)return;
 const e=R04_EDITOR;
 const ready=e.examId===str(S.r04SessionId),allowed=r04EditEligible(),disabled=allowed?'':'disabled';
 const c=r04EditSelectedClass(),p=r04EditSelectedParticipant();
 const classOpts=e.classes.map(x=>`<option value="${esc(x.group+'|'+x.classId)}" ${e.selectedClass===x.group+'|'+x.classId?'selected':''}>${esc(x.group)} · ${esc(x.className)}${x.status==='archived'?' (보관)':''}</option>`).join('');
 const destOpts=e.classes.filter(x=>x.status==='active').map(x=>`<option value="${esc(x.group+'|'+x.classId)}">${esc(x.group)} · ${esc(x.className)}</option>`).join('');
 const partOpts=e.rows.map(x=>`<option value="${esc(x.participationId)}" ${e.selectedParticipant===x.participationId?'selected':''}>${esc(x.group)} · ${esc(x.className)} · ${esc(x.name)}${x.status==='archived'?' (보관)':''}</option>`).join('');
 const names=e.sourceStudents.map(s=>`<option value="${esc(s.studentUid)}">${esc(s.name)} · ${esc(s.classHint||'수강반 없음')}</option>`).join('');
 const intro=`<div class="r04-editor-status ${e.error?'error':''}">${e.loading?'Firestore 명단 조회 중':e.error?esc(e.error):ready?`저장 참가 기록 ${e.rows.length}건 · 반 ${e.classes.length}개 · 상태 버전 ${e.stateVersion} · ${e.sessionState==='open'?'운영 중':'종료'}`:'Firestore 평가용 명단을 조회해야 편집할 수 있습니다.'}</div><button type="button" class="btn line" id="r04EditorRefresh" ${e.loading||e.mutating?'disabled':''}>평가용 명단 새로고침</button>`;
 host.innerHTML=`<h3 class="panel-title">평가용 반 관리</h3>${intro}<form class="r04-edit-form" id="r04CreateClass"><label>새 반 이름<input name="className" maxlength="100" required placeholder="예: 성인 특별평가반" ${disabled}></label><label>구분<select name="group" ${disabled}><option value="청소년">청소년반</option><option value="성인">성인반</option></select></label><button class="btn" type="submit" ${disabled}>반 추가</button></form><div class="r04-edit-section"><label>관리할 반<select class="r04-editor-narrow" id="r04EditorClassSelect">${classOpts}</select></label>${c?`<form class="r04-edit-form" id="r04RenameClass"><label>평가용 반 이름<input name="className" maxlength="100" value="${esc(c.className)}" required ${disabled}></label><button type="submit" class="btn line" ${disabled}>이름 저장</button></form><div class="r04-edit-form"><button id="r04ArchiveClass" class="btn line" type="button" ${disabled}>${c.status==='active'?'반 보관':'반 복원'}</button><label>성인/청소년 재분류<select id="r04EditorReclassTo" ${disabled}><option value="${c.group==='성인'?'청소년':'성인'}">${c.group==='성인'?'청소년':'성인'}반으로 이동</option></select></label><button id="r04ReclassClass" type="button" class="btn line" ${disabled}>반 구분 변경</button></div><p class="hint">기존 채점 기록과 참가 ID는 보관됩니다.</p>`:''}</div>`;
 students.innerHTML=`<h3 class="panel-title">평가 참가 학생 관리</h3><p class="hint">기존 학생 계정으로 추가하거나, 평가용으로만 신규 등록할 수 있습니다.</p><form id="r04AddStudent" class="r04-edit-form"><label>평가용 반<select name="target" ${disabled}>${destOpts}</select></label><label>기존 울림앱 학생<input id="r04EditorFindStudent" type="search" placeholder="이름·수강반 검색" ${disabled}><select name="studentUid" ${disabled}><option value="">선택</option>${names}</select></label><button type="submit" class="btn" ${disabled}>기존 학생 추가</button></form><form id="r04AddManual" class="r04-edit-form"><label>평가용 반<select name="target" ${disabled}>${destOpts}</select></label><label>신규 평가 대상 표시명<input name="studentName" maxlength="100" placeholder="이름" required ${disabled}></label><button type="submit" class="btn line" ${disabled}>평가 대상 직접 추가</button></form><div class="r04-edit-section"><label>평가 참가 기록<select class="r04-editor-narrow" id="r04EditorPartSelect">${partOpts}</select></label>${p?`<p class="hint">${esc(p.className)} · ${esc(p.group)} · ${p.status==='active'?'활성':'보관'} · 반별 참가 ID 유지</p><form id="r04EditStudent" class="r04-edit-form"><label>평가용 표시명<input name="studentName" maxlength="100" required value="${esc(p.name)}" ${disabled}></label><button type="submit" class="btn line" ${disabled}>표시명 저장</button></form><div class="r04-edit-form"><button type="button" id="r04TogglePart" class="btn line" ${disabled}>${p.status==='active'?'평가 대상 제외':'평가 대상 복원'}</button><label>이동할 평가용 반<select id="r04EditorMoveTo" ${disabled}>${destOpts}</select></label><button type="button" id="r04MovePart" class="btn line" ${disabled}>다른 반에 추가 후 기존 기록 보관</button></div>`:''}</div>`;
 const refresh=$('r04EditorRefresh');if(refresh)refresh.onclick=()=>loadR04EditorRead();
 const cselect=$('r04EditorClassSelect');if(cselect)cselect.onchange=ev=>{e.selectedClass=ev.target.value;renderR04EditorSettings();};
 const pselect=$('r04EditorPartSelect');if(pselect)pselect.onchange=ev=>{e.selectedParticipant=ev.target.value;renderR04EditorSettings();};
 const search=$('r04EditorFindStudent');if(search)search.oninput=ev=>{const q=str(ev.target.value).toLocaleLowerCase('ko');const options=$('r04AddStudent')?.elements.studentUid?.options||[];for(const o of options){o.hidden=!!q&&!o.textContent.toLocaleLowerCase('ko').includes(q);} };
 if(!allowed)return;
 const bind=(formId,action,read)=>{const form=$(formId);if(form)form.onsubmit=ev=>{ev.preventDefault();commitR04Editor(action,read(new FormData(form)));};};
 const target=value=>{const ix=value.indexOf('|');return {group:value.slice(0,ix),classId:value.slice(ix+1)};};
 bind('r04CreateClass','createClass',f=>({className:str(f.get('className')),group:str(f.get('group'))}));
 bind('r04RenameClass','renameClass',f=>({classId:c.classId,group:c.group,className:str(f.get('className'))}));
 bind('r04AddStudent','addParticipant',f=>({...target(str(f.get('target'))),studentUid:str(f.get('studentUid'))}));
 bind('r04AddManual','addParticipant',f=>({...target(str(f.get('target'))),manual:true,studentName:str(f.get('studentName'))}));
 bind('r04EditStudent','updateParticipant',f=>({participationId:p.participationId,studentName:str(f.get('studentName'))}));
 const archiveClass=$('r04ArchiveClass');if(archiveClass)archiveClass.onclick=()=>commitR04Editor(c.status==='active'?'archiveClass':'restoreClass',{group:c.group,classId:c.classId});
 const reclass=$('r04ReclassClass');if(reclass)reclass.onclick=()=>commitR04Editor('reclassClass',{group:c.group,classId:c.classId,newGroup:$('r04EditorReclassTo').value});
 const toggle=$('r04TogglePart');if(toggle)toggle.onclick=()=>commitR04Editor(p.status==='active'?'archiveParticipant':'restoreParticipant',{participationId:p.participationId});
 const move=$('r04MovePart');if(move)move.onclick=()=>{const t=target($('r04EditorMoveTo').value);commitR04Editor('moveParticipant',{participationId:p.participationId,newClassId:t.classId,newGroup:t.group});};
}

const R04_TEACHER_LIST_SCROLL={'청소년':0,'성인':0};
const R04_ADMIN_CORE={group:'청소년',search:'',expanded:[],selected:-1,settingsOpen:false,settingsTab:'classes',autoExpanded:false,scrollY:0};
// RUN287: Admin-only scoring detail projection from a new authenticated read-only callable.
const R04_SCOREBOARD={examId:'',callerUid:'',stateVersion:-1,rows:[],loading:false,error:'',teacherCount:0,provisional:true};
function validateR04Scoreboard(raw,id){
 const integer=v=>Number.isSafeInteger(v)&&v>=0;
 if(!raw||raw.ok!==true||raw.mode!=='admin-scoreboard-read-only'||raw.examId!==id||
   !integer(raw.stateVersion)||!integer(raw.participantCount)||raw.participantCount<1||raw.participantCount>150||
   !integer(raw.activeParticipantCount)||!integer(raw.archivedParticipantCount)||
   raw.activeParticipantCount+raw.archivedParticipantCount!==raw.participantCount||
   !integer(raw.activeTeacherCount)||raw.activeTeacherCount>60||
   !integer(raw.submittedGradeCount)||!integer(raw.draftGradeCount)||
   typeof raw.rankingIsProvisional!=='boolean'||!Array.isArray(raw.rows)||
   raw.rows.length!==raw.activeParticipantCount)throw Error('관리자 평가 점수 응답이 올바르지 않습니다.');
 const ids=new Set();let submitted=0,draft=0;
 const rows=raw.rows.map(x=>{
   if(!x||typeof x.participationId!=='string'||!x.participationId||ids.has(x.participationId)||
     !['adult','youth'].includes(x.audience)||!Array.isArray(x.grades)||
     !integer(x.submittedCount)||!integer(x.draftCount)||
     x.submittedCount+x.draftCount!==x.grades.length||
     typeof x.sum!=='number'||!Number.isFinite(x.sum)||x.sum<0||
     (x.average!==null&&(!Number.isFinite(x.average)||x.average<0||x.average>50))||
     (x.rank!==null&&(!integer(x.rank)||x.rank<1))||typeof x.complete!=='boolean')
     throw Error('관리자 평가 점수 집계가 손상됐습니다.');
   ids.add(x.participationId);let sum=0,n=0,m=0;
   const grades=x.grades.map(g=>{
     if(!g||typeof g.teacherName!=='string'||!g.teacherName.trim()||g.teacherName.length>100||
       !['draft','submitted'].includes(g.status)||!integer(g.revision)||g.revision<1||
       typeof g.note!=='string'||g.note.length>1000||
       !Array.isArray(g.na)||g.na.length!==5||!Array.isArray(g.act)||g.act.length!==5||
       [...g.na,...g.act].some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>5||!Number.isInteger(v*2))))
       throw Error('강사별 평가표 내용이 손상됐습니다.');
     if(g.status==='submitted'){
       if([...g.na,...g.act].some(v=>v===null)||g.total===null||!Number.isFinite(g.total)||
         Math.abs(g.total-[...g.na,...g.act].reduce((a,b)=>a+b,0))>0.0001||!g.note.trim())
         throw Error('최종 제출 평가표 점수를 확인할 수 없습니다.');
       n++;sum+=g.total;
     }else{if(g.total!==null)throw Error('임시저장 평가표는 집계 대상이 아닙니다.');m++;}
     return {teacherName:g.teacherName,status:g.status,na:g.na,act:g.act,note:g.note,total:g.total,revision:g.revision};
   });
   if(n!==x.submittedCount||m!==x.draftCount||Math.abs(sum-x.sum)>0.0001||
     (n===0?(x.average!==null||x.rank!==null):
       (x.average===null||x.rank===null||Math.abs(Math.round(sum*100/n)/100-x.average)>0.001)))
       throw Error('최종 제출·평균·순위 집계가 일치하지 않습니다.');
   submitted+=n;draft+=m;
   return {...x,grades};
 });
 if(submitted!==raw.submittedGradeCount||draft!==raw.draftGradeCount)
   throw Error('전체 평가표 건수와 강사별 건수가 다릅니다.');
 return {examId:id,stateVersion:raw.stateVersion,activeCount:raw.activeParticipantCount,
   teacherCount:raw.activeTeacherCount+(raw.adminEvaluatorCount||0),provisional:raw.rankingIsProvisional,rows};
}
async function loadR04AdminScoreboard(){
 if(preview||S.role!=='admin'||!S.auth||R04_SCOREBOARD.loading)return;
 const id=str(S.r04SessionId),uid=str(S.auth.uid),p=R04_PERSISTED_VIEW;
 if(p.examId!==id||!p.rows.length)return toast('저장된 평가 참가 명단을 먼저 조회해주세요.');
 R04_SCOREBOARD.loading=true;R04_SCOREBOARD.error='';R04_SCOREBOARD.examId='';render();
 try{
   const parsed=validateR04Scoreboard(await call(FN.r04Scoreboard,{examId:id}),id);
   if(S.role!=='admin'||str(S.auth&&S.auth.uid)!==uid||S.r04SessionId!==id)return;
   const latest=R04_PERSISTED_VIEW;
   const known=new Set(latest.rows.filter(x=>x.status==='active').map(x=>x.participationId));
   if(latest.examId!==id||latest.stateVersion!==parsed.stateVersion||
     latest.rows.length!==parsed.activeCount+latest.rows.filter(x=>x.status==='archived').length||
     known.size!==parsed.activeCount||parsed.rows.some(r=>!known.has(r.participationId)))
      throw Error('평가 점수와 참가 명단의 회차 버전이 다릅니다.');
   Object.assign(R04_SCOREBOARD,{...parsed,callerUid:uid,error:''});
 }catch(e){if(S.role==='admin'&&str(S.auth&&S.auth.uid)===uid){R04_SCOREBOARD.error=errorMessage(e);R04_SCOREBOARD.rows=[];}}
 finally{R04_SCOREBOARD.loading=false;if(S.role==='admin'&&str(S.auth&&S.auth.uid)===uid)render();}
}

// RUN294: compact admin settings, per-round persisted criteria and independently owned admin grading.
const R04_RUBRIC_ADMIN={examId:'',version:0,rubrics:defaultRubrics(),locked:true,loading:false,saving:false,error:'',group:'청소년'};
const R04_ADMIN_GRADE={examId:'',participationId:'',grade:null,edit:null,loading:false,saving:false,gradingOpen:false,error:'',rubrics:defaultRubrics()};
function renderR04SettingsVisibility(){
 const overlay=$('r04AdminSettingsOverlay');if(!overlay)return;
 overlay.querySelectorAll('[data-r04-setting-section]').forEach(e=>e.hidden=e.dataset.r04SettingSection!==R04_ADMIN_CORE.settingsTab);
 overlay.querySelectorAll('[data-r04-setting-tab]').forEach(b=>{const active=b.dataset.r04SettingTab===R04_ADMIN_CORE.settingsTab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
}
async function loadR04RubricAdmin(){
 if(preview||S.role!=='admin'||!S.auth||R04_RUBRIC_ADMIN.loading||R04_RUBRIC_ADMIN.saving)return;
 const examId=str(S.r04SessionId),uid=str(S.auth.uid);
 R04_RUBRIC_ADMIN.loading=true;R04_RUBRIC_ADMIN.error='';renderR04RubricSettings();
 try{const x=await call(FN.r04RubricAdmin,{examId,action:'read'});
  if(!x||x.ok!==true||x.mode!=='admin-r04-rubric'||x.examId!==examId||
    !Number.isSafeInteger(x.version)||x.version<0||typeof x.locked!=='boolean')throw Error('평가기준 조회 응답이 올바르지 않습니다.');
  const rubrics=checkRubrics(normalizeRubrics({청소년:x.rubrics&&x.rubrics.youth,성인:x.rubrics&&x.rubrics.adult}));
  if(str(S.auth&&S.auth.uid)!==uid||S.r04SessionId!==examId)return;
  Object.assign(R04_RUBRIC_ADMIN,{examId,version:x.version,rubrics,locked:x.locked,error:''});
  S.rubrics=normalizeRubrics(rubrics);S.rubricVersion=x.version;
 }catch(e){R04_RUBRIC_ADMIN.error=errorMessage(e);R04_RUBRIC_ADMIN.examId='';}
 finally{R04_RUBRIC_ADMIN.loading=false;if(S.role==='admin')renderR04RubricSettings();}
}
function renderR04RubricSettings(){
 const host=$('r04RubricHost');if(!host)return;
 const state=R04_RUBRIC_ADMIN,ready=state.examId===str(S.r04SessionId),locked=!ready||state.locked||state.saving;
 const data=ready?state.rubrics:defaultRubrics(),group=state.group;
 host.innerHTML=`<div class="r04-setting-heading"><h3>평가항목 수정</h3><button type="button" class="btn line small" id="r04RubricRefresh" ${state.loading?'disabled':''}>서버 조회</button></div>
 <p class="hint">성인·청소년 별도 기준 · NA 25점 + 독백 25점 · 항목당 5점</p>
 ${state.error?`<p class="warn">${esc(state.error)}</p>`:''}
 <p class="hint">${ready?`기준 v${state.version} · ${state.locked?'채점 시작으로 수정 잠금':'수정 가능'}`:'먼저 서버 평가항목을 조회하세요.'}</p>
 <div class="tabs" role="group" aria-label="평가기준 구분"><button class="seg ${group==='청소년'?'active':''}" type="button" data-rubric-group="청소년">청소년반</button><button class="seg ${group==='성인'?'active':''}" type="button" data-rubric-group="성인">성인반</button></div>
 <form id="r04RubricForm">${[['na','NA'],['act','독백']].map(([key,label])=>`<div class="r04-criteria-section"><h4>${label} · 25점</h4>${data[group][key].map((item,i)=>`<div class="r04-criterion-row"><span>${i+1}</span><label>항목명<input name="${key}-${i}-title" maxlength="70" required value="${esc(item.title)}" ${locked?'disabled':''}></label><label>평가 기준 (선택)<input name="${key}-${i}-description" maxlength="160" value="${esc(item.description)}" ${locked?'disabled':''}></label><small>5점</small></div>`).join('')}</div>`).join('')}
 <div class="action-row"><button type="submit" class="btn" ${locked?'disabled':''}>평가항목 저장</button></div></form>
 ${state.locked?'<p class="hint">평가표가 한 건이라도 저장된 회차의 항목은 변경할 수 없습니다. 기존 평가표는 보존됩니다.</p>':''}`;
 const reload=$('r04RubricRefresh');if(reload)reload.onclick=()=>loadR04RubricAdmin();
 host.querySelectorAll('[data-rubric-group]').forEach(b=>b.onclick=()=>{state.group=b.dataset.rubricGroup;renderR04RubricSettings();});
 const form=$('r04RubricForm');if(form&&!locked)form.onsubmit=async ev=>{
  ev.preventDefault();if(state.saving)return;
  let next;try{next=clone(state.rubrics);const f=new FormData(form);for(const key of ['na','act'])next[group][key]=Array.from({length:5},(_,i)=>({title:str(f.get(`${key}-${i}-title`)),description:str(f.get(`${key}-${i}-description`))}));checkRubrics(next);}
  catch(e){return toast(errorMessage(e));}
  if(!confirm('이 회차의 평가 기준을 저장하시겠습니까? 기존 채점이 있으면 서버가 거부합니다.'))return;
  state.saving=true;renderR04RubricSettings();
  try{const out=await call(FN.r04RubricAdmin,{examId:state.examId,action:'save',rubrics:{adult:next['성인'],youth:next['청소년']},expectedVersion:state.version});
    if(!out||out.ok!==true||out.mode!=='admin-r04-rubric-saved'||out.examId!==state.examId||out.version!==state.version+1)
      throw Error('평가기준 저장 응답이 올바르지 않습니다. 서버를 재조회하세요.');
    toast('평가항목 저장 성공. 서버 설정을 다시 확인합니다.');
  }catch(e){toast('저장 여부를 서버에서 재조회하세요. '+errorMessage(e));}
  finally{state.saving=false;await loadR04RubricAdmin();}
 };
}
function selectedR04AdminGradeParticipant(){
 if(R04_EDITOR.examId!==str(S.r04SessionId))return null;
 const p=R04_EDITOR.rows.find((p,i)=>i===R04_ADMIN_CORE.selected&&p.status==='active'&&p.classStatus!=='archived');
 // The administrator display list may be reordered/filtered; always match by exact server ID.
 const roster=R04_EDITOR.rows.filter(x=>x.status==='active'&&x.classStatus!=='archived').map((p,i)=>({...p,__index:i}));
 return roster.find(p=>p.__index===R04_ADMIN_CORE.selected)||null;
}
async function loadR04AdminGrade(){
 if(preview||S.role!=='admin'||!S.auth||R04_ADMIN_GRADE.loading||R04_ADMIN_GRADE.saving)return;
 const p=selectedR04AdminGradeParticipant();if(!p)return;
 const examId=str(S.r04SessionId),uid=str(S.auth.uid),pid=p.participationId;
 R04_ADMIN_GRADE.loading=true;R04_ADMIN_GRADE.error='';renderR04AdminGradeForm();
 try{const x=await call(FN.r04GradeAdmin,{action:'read',examId,participationId:pid});
  if(!x||x.ok!==true||x.mode!=='admin-r04-grade-read'||x.examId!==examId||x.participationId!==pid||
     typeof x.gradingOpen!=='boolean'||!Number.isSafeInteger(x.rubricVersion))throw Error('관리자 평가표 조회 응답이 올바르지 않습니다.');
  if(str(S.auth&&S.auth.uid)!==uid||str(S.r04SessionId)!==examId||selectedR04AdminGradeParticipant()?.participationId!==pid)return;
  const g=x.grade;
  if(g&&(!validR04GradeScores(g.na,g.status)||!validR04GradeScores(g.act,g.status)||
    !Number.isSafeInteger(g.revision)||g.revision<1||!['draft','submitted'].includes(g.status)))throw Error('관리자 평가표 형식 오류');
  Object.assign(R04_ADMIN_GRADE,{examId,participationId:pid,grade:g,edit:{na:g?g.na.slice():Array(5).fill(null),
    act:g?g.act.slice():Array(5).fill(null),note:str(g&&g.note)},gradingOpen:x.gradingOpen,
    rubrics:checkRubrics(normalizeRubrics({청소년:x.rubrics&&x.rubrics.youth,성인:x.rubrics&&x.rubrics.adult})),error:''});
 }catch(e){R04_ADMIN_GRADE.error=errorMessage(e);R04_ADMIN_GRADE.examId='';}
 finally{R04_ADMIN_GRADE.loading=false;renderR04AdminGradeForm();}
}
function renderR04AdminGradeForm(){
 const host=$('r04AdminGradeHost');if(!host)return;
 const p=selectedR04AdminGradeParticipant(),a=R04_ADMIN_GRADE;
 if(!p){host.innerHTML='<p class="hint">관리자 평가를 진행할 학생을 선택하세요.</p>';return;}
 const valid=a.examId===str(S.r04SessionId)&&a.participationId===p.participationId&&a.edit;
 const busy=a.loading||a.saving;
 const allowed=valid&&a.gradingOpen&&!busy;
 const vals=valid?a.edit:{na:Array(5).fill(null),act:Array(5).fill(null),note:''};
 const rub=valid?a.rubrics:defaultRubrics(),items=rub[p.group]||defaultRubrics()[p.group];
 host.innerHTML=`<div class="r04-setting-heading"><h3>관리자 직접 평가</h3><button id="r04AdminGradeRead" class="btn line small" type="button" ${busy?'disabled':''}>${busy?'조회 중':'평가표 불러오기'}</button></div>
 ${a.error?`<p class="warn">${esc(a.error)}</p>`:''}<p class="hint">${valid?`관리자 별도 평가 · ${a.grade?a.grade.status==='submitted'?'제출 완료':'임시저장':'미평가'} · ${a.gradingOpen?'평가 ON':'평가 OFF'}`:'선택 학생의 관리자 평가표를 불러오세요.'}</p>
 ${valid?`<form id="r04AdminGradeForm">${[['na','NA'],['act','독백']].map(([key,name])=>`<div class="r04-criteria-section"><h4>${name} · 25점</h4>${items[key].map((item,i)=>`<label class="r04-admin-grade-row"><span>${esc(item.title)}</span><select data-r04-grade-section="${key}" data-index="${i}" ${allowed?'':'disabled'}><option value="">미입력</option>${Array.from({length:11},(_,v)=>v/2).map(v=>`<option value="${v}" ${vals[key][i]===v?'selected':''}>${v}점</option>`).join('')}</select></label>`).join('')}</div>`).join('')}
 <label class="r04-admin-grade-note">관리자 한줄평<textarea id="r04AdminGradeNote" maxlength="1000" ${allowed?'':'disabled'}>${esc(vals.note)}</textarea></label>
 <div class="action-row"><button type="button" id="r04AdminGradeDraft" class="btn line" ${allowed?'':'disabled'}>임시저장</button><button type="button" id="r04AdminGradeSubmit" class="btn" ${allowed?'':'disabled'}>평가 완료 · 제출</button></div></form>`:''}`;
 const read=$('r04AdminGradeRead');if(read)read.onclick=()=>loadR04AdminGrade();
 if(!valid)return;
 host.querySelectorAll('[data-r04-grade-section]').forEach(sel=>sel.onchange=()=>{a.edit[sel.dataset.r04GradeSection][Number(sel.dataset.index)]=sel.value===''?null:Number(sel.value);});
 const note=$('r04AdminGradeNote');if(note)note.oninput=()=>{a.edit.note=note.value;};
 if($('r04AdminGradeDraft'))$('r04AdminGradeDraft').onclick=()=>saveR04AdminGrade('draft');
 if($('r04AdminGradeSubmit'))$('r04AdminGradeSubmit').onclick=()=>saveR04AdminGrade('submitted');
}
async function saveR04AdminGrade(status){
 const a=R04_ADMIN_GRADE,p=selectedR04AdminGradeParticipant();
 if(!p||a.saving||!a.gradingOpen||a.participationId!==p.participationId||a.examId!==str(S.r04SessionId))return;
 const g=a.edit;
 if(!validR04GradeScores(g.na,status)||!validR04GradeScores(g.act,status)||
    status==='submitted'&&!str(g.note))return toast('10개 항목 점수와 한줄평을 확인하세요.');
 const expectedRevision=a.grade?a.grade.revision:0;
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)return toast('평가표 버전 오류');
 const payload={action:'save',examId:a.examId,participationId:a.participationId,expectedRevision,
  na:g.na.slice(),act:g.act.slice(),note:str(g.note),status};
 a.saving=true;renderR04AdminGradeForm();
 try{const out=await call(FN.r04GradeAdmin,payload);
  if(!out||out.ok!==true||out.mode!=='admin-r04-grade-saved'||out.examId!==payload.examId||
    out.participationId!==payload.participationId||out.status!==status||out.revision!==expectedRevision+1)
    throw Error('관리자 채점 결과가 불확실합니다. 서버 재조회가 필요합니다.');
  toast('관리자 평가 저장 성공. 저장된 평가표를 다시 확인합니다.');
 }catch(e){toast('저장 결과를 재조회하세요. '+errorMessage(e));}
 finally{a.saving=false;await loadR04AdminGrade();}
 // Re-query summary projections, not student/client supplied point values.
 if(R04_PERSISTED_VIEW.examId===str(S.r04SessionId)){await loadR04EvaluatorMatrix();await loadR04AdminScoreboard();}
}
function renderR04AdminCore(){
 if(preview||S.role!=='admin'||!S.rosterPreviewOnly)return;
 const roster=(R04_EDITOR.examId===str(S.r04SessionId)?R04_EDITOR.rows.filter(p=>p.status==='active'&&p.classStatus!=='archived'):(S.roster||[])).map((p,i)=>({...p,__index:i}));
 const id=str(S.r04SessionId),persisted=R04_PERSISTED_VIEW;
 const hasPersisted=persisted.examId===id&&persisted.rows.length>0;
 const matrix=R04_EVALUATOR_VIEW;
 const hasMatrix=hasPersisted&&matrix.examId===id&&matrix.stateVersion===persisted.stateVersion&&
   matrix.callerUid===str(S.auth&&S.auth.uid);
 const shown=roster.filter(p=>(R04_ADMIN_CORE.group==='전체'||p.group===R04_ADMIN_CORE.group)&&
   (!R04_ADMIN_CORE.search||[p.className,p.name,p.group].some(v=>str(v).toLocaleLowerCase('ko').includes(R04_ADMIN_CORE.search.toLocaleLowerCase('ko')))));
 const selected=shown.find(p=>p.__index===R04_ADMIN_CORE.selected)||shown[0]||null;
 R04_ADMIN_CORE.selected=selected?selected.__index:-1;
 if(selected&&!R04_ADMIN_CORE.autoExpanded){R04_ADMIN_CORE.expanded=[str(selected.group)+'|'+str(selected.classId||selected.className)];R04_ADMIN_CORE.autoExpanded=true;}
 const match=selected&&hasPersisted?persisted.rows.filter(p=>selected.participationId?p.participationId===selected.participationId:(p.classLabel===selected.className&&p.studentLabel===selected.name)):[];
 const exact=match&&match.length===1?match[0]:null;
 const teacherStatuses=hasMatrix&&exact?matrix.evaluators.map(t=>{
   const grade=t.grades.find(g=>g.participationId===exact.participationId);
   return {name:t.teacherName,status:grade?grade.status:'missing'};
 }):[];
 const matchLabel=hasPersisted&&!exact?'저장 참가 ID와 자동 연결 미확인':!hasPersisted?'저장 참가 명단 조회 전':'저장 참가 ID 확인';
 const classMap=new Map();
 shown.forEach(p=>{const key=str(p.group)+'|'+str(p.classId||p.className);if(!classMap.has(key))classMap.set(key,{key,name:p.className,group:p.group,students:[]});classMap.get(key).students.push(p);});
 if(R04_EDITOR.examId===str(S.r04SessionId))R04_EDITOR.classes.filter(c=>c.status==='active'&&(R04_ADMIN_CORE.group==='전체'||c.group===R04_ADMIN_CORE.group)&&(!R04_ADMIN_CORE.search||c.className.toLocaleLowerCase('ko').includes(R04_ADMIN_CORE.search.toLocaleLowerCase('ko')))).forEach(c=>{const key=c.group+'|'+c.classId;if(!classMap.has(key))classMap.set(key,{key,name:c.className,group:c.group,students:[]});});
 const groups=[...classMap.values()];
 const sidebar=groups.map((c,i)=>{
   const open=R04_ADMIN_CORE.expanded.includes(c.key);
   return `<section class="class-accordion"><button type="button" class="class-toggle ${open?'open':''}" data-admin-class="${esc(c.key)}" aria-expanded="${open?'true':'false'}"><span class="class-title"><span class="class-chevron">${open?'▾':'▸'}</span><span><strong>${esc(c.name)}</strong><small>${esc(c.group)} · 평가용 반 목록</small></span></span><span class="class-count">${c.students.length}명</span></button><div class="class-students" ${open?'':'hidden'}>${c.students.map(p=>`<button type="button" data-admin-student="${p.__index}" class="student-choice ${R04_ADMIN_CORE.selected===p.__index?'active':''}"><b class="r04-student-name">${esc(p.name)}</b><span class="chip ${p.group==='성인'?'ok':'wait'}">${esc(p.group)}</span></button>`).join('')}</div></section>`;
 }).join('');
 const stats=`<div class="stat-grid"><div class="stat"><small>현재 수강 명단</small><strong>${roster.length}건</strong></div><div class="stat"><small>수강반</small><strong>${new Set(roster.map(p=>p.classId||p.className)).size}개</strong></div><div class="stat"><small>저장 참가 기록</small><strong>${hasPersisted?persisted.rows.length+'건':'미조회'}</strong></div><div class="stat"><small>평가 강사</small><strong>${hasMatrix?matrix.evaluators.length+'명':'미조회'}</strong></div></div>`;
 const scores=R04_SCOREBOARD;
 const scoresReady=hasPersisted&&scores.examId===id&&scores.callerUid===str(S.auth&&S.auth.uid)&&
   scores.stateVersion===persisted.stateVersion&&scores.rows.length===persisted.rows.filter(r=>r.status==='active').length;
 const chosenScore=scoresReady&&exact?scores.rows.find(r=>r.participationId===exact.participationId):null;
 const scoreInfo=chosenScore&&chosenScore.submittedCount?`<div class="stat-grid"><div class="stat"><small>최종 제출 점수 합계</small><strong>${fmt(chosenScore.sum)}</strong></div><div class="stat"><small>강사 평균 / 50</small><strong>${fmt(chosenScore.average)}</strong></div><div class="stat"><small>잠정 순위</small><strong>${chosenScore.rank}위</strong></div><div class="stat"><small>완료 평가</small><strong>${chosenScore.submittedCount} / ${scores.teacherCount}</strong></div></div>`:
   '<p class="hint">현재 이 학생의 최종 제출된 평가표가 없습니다.</p>';
 const detailCriteria=(S.rubrics[selected?.group]||defaultRubrics()[selected?.group]||defaultRubrics().youth);
 const gradeDetails=chosenScore&&chosenScore.grades.length?chosenScore.grades.map(g=>`<details class="r04-grade-detail"><summary><b>${esc(g.teacherName)}</b> · ${g.status==='submitted'?'최종제출 '+fmt(g.total)+' / 50':'임시저장'}</summary><div class="grid2"><div><strong>NA · 나레이션 / 25</strong><ol>${detailCriteria.na.map((t,i)=>`<li>${esc(t.title)}: ${g.na[i]===null?'미입력':g.na[i]}</li>`).join('')}</ol></div><div><strong>독백 · 연기 / 25</strong><ol>${detailCriteria.act.map((t,i)=>`<li>${esc(t.title)}: ${g.act[i]===null?'미입력':g.act[i]}</li>`).join('')}</ol></div></div><p class="note">${esc(g.note||'한줄평 없음')}</p></details>`).join(''):'<p class="hint">저장된 강사별 평가표가 없습니다.</p>';
 const scoreRows=scoresReady?scores.rows.filter(x=>x.submittedCount>0).sort((a,b)=>a.rank-b.rank||b.average-a.average):[];
 const scoreLeaderboard=scoreRows.length?`<div class="scroll-table"><table class="wide-table"><thead><tr><th>순위</th><th>학생</th><th>수강반</th><th>합계</th><th>평균/50</th><th>제출 강사</th></tr></thead><tbody>${scoreRows.map(r=>{const p=persisted.rows.find(x=>x.participationId===r.participationId);return `<tr><td>${r.rank}위 ${r.complete?'':'· 잠정'}</td><td>${esc(p&&p.studentLabel||'확인 필요')}</td><td>${esc(p&&p.classLabel||'확인 필요')}</td><td>${fmt(r.sum)}</td><td>${fmt(r.average)}</td><td>${r.submittedCount}/${scores.teacherCount}</td></tr>`;}).join('')}</tbody></table></div>`:
   '<p class="hint">최종 제출된 평가표가 없어 아직 순위를 계산할 수 없습니다.</p>';
 const teacherTable=teacherStatuses.length?`<div class="scroll-table"><table class="wide-table"><thead><tr><th>강사</th><th>평가 상태</th><th>총점 / 50</th></tr></thead><tbody>${teacherStatuses.map(t=>`<tr><td>${esc(t.name)}</td><td><span class="chip ${t.status==='submitted'?'ok':'wait'}">${t.status==='submitted'?'완료':t.status==='draft'?'임시저장':'미평가'}</span></td><td>—</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">평가표 조회 전이거나 참가 ID의 정확한 연결을 확인할 수 없습니다. 다른 학생의 채점 기록은 추측하여 표시하지 않습니다.</p>';
 const chosen=selected?`<div class="score-hero"><div><h2>${esc(selected.name)}</h2><p>${esc(selected.className)} · ${esc(selected.group)}</p></div><div style="text-align:right;font-size:12px">${esc(matchLabel)}</div></div><h3 class="panel-title">강사별 채점 현황</h3>${teacherTable}<div id="r04AdminGradeHost" class="r04-admin-grading"></div><div class="r04-core-score"><h3 class="panel-title">평가 점수 · 총합 · 평균 · 순위</h3>${scoresReady?scoreInfo:`<p class="hint">${esc(scores.error||'아직 점수 조회 전입니다. 명단·채점 현황 조회를 눌러주세요.')}</p>`}<h3 class="panel-title top-gap">강사·관리자 평가 상세</h3>${scoresReady?gradeDetails:'<p class="hint">조회 전입니다.</p>'}</div>`:'<p class="hint">등록된 학생이 없습니다.</p>';
 const main=`<section id="r04OperationalDashboard" class="r04-core"><div class="heading-row"><div><h1>모의고사 평가 관리</h1><p>반별 학생 · 강사별 평가 현황 · 총점/평균 관리</p></div><button type="button" id="r04OpenSettings" class="btn line" aria-label="모의고사 설정 열기">⚙ 설정</button></div>${stats}<div class="panel"><div class="flex"><button class="btn" type="button" id="r04CoreReload">평가 명단 · 채점 현황 조회</button><span class="hint">현재 수강 명단 기준 · ${esc(S.rosterDate)} 조회</span></div><p class="hint top-gap">평가용 명단은 실제 수강반과 별도로 관리됩니다.</p></div><div class="panel"><div class="flex"><div class="r04-admin-group-tabs" role="group" aria-label="평가 대상 구분"><button type="button" class="seg ${R04_ADMIN_CORE.group==='청소년'?'active':''}" data-admin-group="청소년" aria-pressed="${R04_ADMIN_CORE.group==='청소년'}">청소년반</button><button type="button" class="seg ${R04_ADMIN_CORE.group==='성인'?'active':''}" data-admin-group="성인" aria-pressed="${R04_ADMIN_CORE.group==='성인'}">성인반</button></div><label>학생·수강반 검색 <input id="r04CoreSearch" type="search" maxlength="100" placeholder="학생 또는 반 이름" value="${esc(R04_ADMIN_CORE.search)}"></label><span class="muted">${shown.length}건 표시</span></div></div><div class="layout r04-core-grid"><aside class="panel"><h2 class="panel-title">전체 평가 반목록</h2><div class="student-list r04-admin-class-list">${sidebar||'<p class="hint">해당 조건의 반 또는 학생이 없습니다.</p>'}</div></aside><article class="panel">${chosen}</article></div><section class="panel"><div class="heading-row"><div><h2>총점 · 평균 · 순위</h2><p class="muted">최종 제출된 강사별 평가표를 기준으로 계산</p></div></div><p class="hint">최종 제출 평가만 합산합니다. 제출 강사 수가 다른 학생의 평균·순위는 잠정 비교이며 전체 강사 제출 후 확정됩니다.</p>${scoresReady?scoreLeaderboard:`<p class="hint">${esc(scores.error||'점수·순위 조회 전입니다.')}</p>`}</section></section>`;
 const settings=`<div id="r04AdminSettingsOverlay" class="modal-wrap r04-settings-overlay" role="dialog" aria-modal="true" aria-label="모의고사 관리자 설정" style="display:${R04_ADMIN_CORE.settingsOpen?'flex':'none'}"><div class="modal r04-settings-modal"><div class="modal-head"><div><h2>⚙ 모의고사 설정</h2><p class="hint">평가용 반·학생·평가기준·회차 운영</p></div><button type="button" class="btn line" id="r04CloseSettings">닫기 ✕</button></div><nav class="r04-settings-tabs" role="tablist" aria-label="모의고사 설정 분류">${[['classes','반 관리'],['students','학생 관리'],['rubric','평가항목'],['sessions','회차·공개'],['media','음성·영상']].map(([id,label])=>`<button type="button" class="seg ${R04_ADMIN_CORE.settingsTab===id?'active':''}" data-r04-setting-tab="${id}" role="tab" aria-selected="${R04_ADMIN_CORE.settingsTab===id}">${label}</button>`).join('')}</nav><section class="panel r04-setting-panel" data-r04-setting-section="classes" id="r04EditorClassHost"></section><section class="panel r04-setting-panel" data-r04-setting-section="students" id="r04EditorStudentHost"></section><section class="panel r04-setting-panel" data-r04-setting-section="rubric" id="r04RubricHost"></section><div class="r04-settings-live" id="r04SettingsLive"></div><details class="r04-core-advanced"><summary>고급 조회 · 현재 수강 명단 및 데이터 대조</summary><div id="r04SettingsAdvanced"></div></details></div></div>`;
 app.insertAdjacentHTML('afterbegin',main);
 app.insertAdjacentHTML('beforeend',settings);
 const live=$('r04SettingsLive'),advanced=$('r04SettingsAdvanced');
 // Existing operational controls remain functional; only their placement changes.
 for(const child of [...app.children]){
   if(child.id==='r04OperationalDashboard'||child.id==='r04AdminSettingsOverlay'||child.classList.contains('session-bar'))continue;
   if(['r04AdminStatePanel','r04AdminReleasePanel','r04AdminMediaPanel'].includes(child.id)){child.dataset.r04SettingSection=child.id==='r04AdminMediaPanel'?'media':'sessions';child.classList.add('r04-setting-panel');live.appendChild(child);}
   else advanced.appendChild(child);
 }
 const overlay=$('r04AdminSettingsOverlay');
 $('r04OpenSettings').onclick=()=>{R04_ADMIN_CORE.settingsOpen=true;overlay.style.display='flex';renderR04SettingsVisibility();if(R04_ADMIN_CORE.settingsTab==='rubric')loadR04RubricAdmin();};
 $('r04CloseSettings').onclick=()=>{R04_ADMIN_CORE.settingsOpen=false;overlay.style.display='none';};
 overlay.onclick=e=>{if(e.target===overlay){R04_ADMIN_CORE.settingsOpen=false;overlay.style.display='none';}};
 $('r04CoreReload').onclick=()=>withBusy($('r04CoreReload'),async()=>{await loadR04PersistedRosterView();await loadR04EvaluatorMatrix();await loadR04AdminScoreboard();});
 const adminList=app.querySelector('.r04-admin-class-list');
 if(adminList){adminList.scrollTop=R04_ADMIN_CORE.scrollY;adminList.addEventListener('scroll',()=>{R04_ADMIN_CORE.scrollY=adminList.scrollTop;},{passive:true});}
 app.querySelectorAll('[data-admin-group]').forEach(b=>b.onclick=()=>{R04_ADMIN_CORE.group=b.dataset.adminGroup;R04_ADMIN_CORE.selected=-1;R04_ADMIN_CORE.autoExpanded=false;R04_ADMIN_CORE.expanded=[];R04_ADMIN_CORE.scrollY=0;render();});
 $('r04CoreSearch').onchange=e=>{R04_ADMIN_CORE.search=str(e.target.value);render();};
 app.querySelectorAll('[data-admin-class]').forEach(btn=>btn.onclick=()=>{const key=btn.dataset.adminClass;R04_ADMIN_CORE.expanded=R04_ADMIN_CORE.expanded.includes(key)?R04_ADMIN_CORE.expanded.filter(x=>x!==key):[...R04_ADMIN_CORE.expanded,key];render();});
 app.querySelectorAll('[data-admin-student]').forEach(btn=>btn.onclick=()=>{R04_ADMIN_CORE.selected=Number(btn.dataset.adminStudent);render();loadR04AdminGrade();});
 renderR04EditorSettings();
 renderR04RubricSettings();renderR04SettingsVisibility();renderR04AdminGradeForm();
 app.querySelectorAll('[data-r04-setting-tab]').forEach(btn=>btn.onclick=()=>{R04_ADMIN_CORE.settingsTab=btn.dataset.r04SettingTab;renderR04SettingsVisibility();if(R04_ADMIN_CORE.settingsTab==='rubric')loadR04RubricAdmin();});
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
 S.r04SessionState=meta;S.r04ReleasePreview=null;render();
}
async function changeR04SessionState(action){
 if(preview||S.role!=='admin'||S.r04StateMutationPending||S.r04ReleasePending)return;
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
 S.r04StateMutationPending=true;S.r04SessionState=null;S.r04ReleasePreview=null;render();
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
 const disabled=(!action||S.r04StateMutationPending||S.r04ReleasePending);
 const hint=terminal?'이 회차는 최종 종료되어 ON으로 되돌릴 수 없습니다. 과거 평가 열람은 유지됩니다.':
  valid?('참가자 '+m.participantCount+'건 · 상태 버전 '+m.stateVersion+' · 읽기/쓰기 권한은 서버가 검증합니다.'):
  '회차를 조회해야 현재 상태와 버전을 확인할 수 있습니다. 조회 전에는 변경할 수 없습니다.';
 app.insertAdjacentHTML('afterbegin',`<section class="panel" id="r04AdminStatePanel"><div class="heading-row"><div><h2>R04 평가 회차 관리</h2><p class="muted">평가 기간 제한 없음 · 관리자만 ON/OFF · OFF 후 최종 잠금</p></div><span class="chip ${valid&&m.gradingOpen?'ok':'wait'}">${esc(label)}</span></div><div class="flex"><label>회차 ID <input id="r04StateExamId" maxlength="20" value="${esc(S.r04SessionId)}" aria-label="R04 평가 회차 ID"></label><button id="r04LoadState" class="btn line" type="button">현재 상태 조회</button><button id="r04ApplyState" class="btn" type="button" ${disabled?'disabled':''}>${esc(action?title:'상태 변경 불가')}</button></div><p class="hint">${esc(hint)}</p><p class="warn">OFF는 취소할 수 없습니다. 상태 조회 및 ON/OFF는 현재 관리자 계정에만 허용됩니다. 강사 평가 저장 및 학생 결과 공개는 별도 기능입니다.</p></section>`);
 $('r04StateExamId').onchange=e=>{const next=str(e.target.value);if(next!==S.r04SessionId)resetR04AdminMedia();S.r04SessionId=next;S.r04SessionState=null;S.r04ReleasePreview=null;render();};
 $('r04LoadState').onclick=()=>withBusy($('r04LoadState'),()=>{
  const id=str($('r04StateExamId').value);
  if(!R04_EXAM_ID_PATTERN.test(id))throw Error('R04 회차 ID 형식을 확인해 주세요.');
  S.r04SessionId=id;S.r04SessionState=null;S.r04ReleasePreview=null;
  return loadR04SessionState(id);
 });
 if(action&&!S.r04StateMutationPending)$('r04ApplyState').onclick=()=>changeR04SessionState(action);
 renderR04AdminReleaseControls();
 renderR04AdminMediaControls();
 renderR04PersistedRosterView();
}

// RUN274: Administrator-only persisted R04 participant overview, read-only.
// This panel never infers a teacher's grading completion from a participation record.
const R04_PERSISTED_VIEW={examId:'',rows:[],stateVersion:-1,loading:false,error:'',group:'전체',status:'전체',search:''};
function clearR04PersistedView(){
 R04_PERSISTED_VIEW.examId='';R04_PERSISTED_VIEW.rows=[];R04_PERSISTED_VIEW.stateVersion=-1;
 R04_PERSISTED_VIEW.loading=false;R04_PERSISTED_VIEW.error='';R04_PERSISTED_VIEW.group='전체';
 R04_PERSISTED_VIEW.status='전체';R04_PERSISTED_VIEW.search='';
}
async function loadR04PersistedRosterView(){
 if(preview||S.role!=='admin'||!S.auth||R04_PERSISTED_VIEW.loading)return;
 const id=str(S.r04SessionId),callerUid=str(S.auth.uid);if(!R04_EXAM_ID_PATTERN.test(id))return toast('R04 회차 ID를 확인해주세요.');
 R04_PERSISTED_VIEW.loading=true;R04_PERSISTED_VIEW.examId='';R04_PERSISTED_VIEW.rows=[];
 R04_PERSISTED_VIEW.stateVersion=-1;R04_PERSISTED_VIEW.error='';render();
 try{
  const raw=await call(FN.r04Persisted,{examId:id});
  const parsed=validateR04MediaAdminRoster(raw,id);
  if(S.role!=='admin'||!S.auth||str(S.auth.uid)!==callerUid||S.r04SessionId!==id)return;
  R04_PERSISTED_VIEW.examId=id;R04_PERSISTED_VIEW.rows=parsed.rows;
  R04_PERSISTED_VIEW.stateVersion=parsed.stateVersion;
 }catch(e){
  if(S.role==='admin'&&S.auth&&str(S.auth.uid)===callerUid&&S.r04SessionId===id){
   R04_PERSISTED_VIEW.error=errorMessage(e);R04_PERSISTED_VIEW.rows=[];
  }
 }finally{
  R04_PERSISTED_VIEW.loading=false;
  if(S.role==='admin'&&S.auth&&str(S.auth.uid)===callerUid&&S.r04SessionId===id)render();
 }
}
function renderR04PersistedRosterView(){
 if(preview||S.role!=='admin'||!S.auth)return;
 const v=R04_PERSISTED_VIEW,id=str(S.r04SessionId);
 const hasData=v.examId===id&&v.rows.length>0;
 const state=S.r04SessionState;
 const stale=!!(hasData&&state&&state.examId===id&&state.stateVersion!==v.stateVersion);
 const rows=hasData&&!stale?v.rows:[];
 const active=rows.filter(x=>x.status==='active').length,archived=rows.filter(x=>x.status==='archived').length;
 const groupRows=rows.filter(x=>(v.group==='전체'||x.group===v.group)&&
  (v.status==='전체'||x.status===v.status));
 const q=str(v.search).toLocaleLowerCase('ko');
 const visible=q?groupRows.filter(x=>[x.studentLabel,x.classLabel,x.group].some(z=>str(z).toLocaleLowerCase('ko').includes(q))):groupRows;
 const groupOptions=['전체','청소년','성인'].map(x=>`<option value="${x}" ${v.group===x?'selected':''}>${x}</option>`).join('');
 const statusOptions=[['전체','전체'],['active','활성'],['archived','보관']].map(([key,text])=>
  `<option value="${key}" ${v.status===key?'selected':''}>${text}</option>`).join('');
 const table=rows.length?`<div class="scroll-table top-gap"><table class="wide-table"><thead><tr><th>번호</th><th>구분</th><th>수강반</th><th>학생</th><th>참가 상태</th><th>수강 명단 비교</th></tr></thead><tbody>${visible.map((x,i)=>
  `<tr><td>${i+1}</td><td>${esc(x.group)}</td><td>${esc(x.classLabel||'이전 수강반')}</td><td>${esc(x.studentLabel||'이전 수강생')}</td><td><span class="chip ${x.status==='active'?'ok':'wait'}">${x.status==='active'?'활성':'보관'}</span></td><td>${x.currentRosterMatch?'현재 수강':'현재 명단 외'}</td></tr>`).join('')||'<tr><td colspan="6">현재 필터에 해당하는 평가 참가 기록이 없습니다.</td></tr>'}</tbody></table></div>`:'';
 const summary=rows.length?`<div class="stat-grid"><div class="stat"><small>저장된 참가 기록</small><strong>${rows.length}</strong></div><div class="stat"><small>활성 참가 기록</small><strong>${active}</strong></div><div class="stat"><small>보관 참가 기록</small><strong>${archived}</strong></div><div class="stat"><small>현재 표시</small><strong>${visible.length}</strong></div></div>`:'';
 const message=v.loading?'<p class="hint">서버의 참가 명단을 확인하고 있습니다.</p>':
  stale?'<p class="warn">회차 상태 버전이 변경되어 기존 명단을 숨겼습니다. 다시 조회해 주세요.</p>':
  v.error?`<p class="warn">${esc(v.error)}</p>`:
  !rows.length?'<p class="hint">[저장된 평가 참가 명단 조회]를 누르면 기존 R04 참가 기록을 읽기 전용으로 표시합니다.</p>':'';
 const html=`<section class="panel" id="r04PersistedRosterPanel"><div class="heading-row"><div><h2>R04 실제 평가 참가 명단</h2><p class="muted">저장된 회차 기록 · 관리자 전용 · 강사 화면의 익명화와 무관한 관리자 조회</p></div><span class="chip wait">읽기 전용</span></div><div class="flex"><button type="button" id="r04PersistedRosterLoad" class="btn line" ${v.loading?'disabled':''}>${v.loading?'조회 중':'저장된 평가 참가 명단 조회'}</button>${rows.length?`<span class="muted">상태 버전 ${v.stateVersion} · 반마다 개별 참가 기록</span>`:''}</div>${message}${summary}${rows.length?`<div class="flex top-gap"><label>구분 <select id="r04PersistedRosterGroup">${groupOptions}</select></label><label>상태 <select id="r04PersistedRosterStatus">${statusOptions}</select></label><label>학생·수강반 검색 <input id="r04PersistedRosterSearch" maxlength="100" value="${esc(v.search)}" placeholder="학생 또는 반"></label></div>${table}`:''}<p class="hint">이 목록은 참가 명단과 보관 상태만 나타냅니다. 강사별 채점 완료 여부는 이 응답에 없으므로 임의로 표시하지 않습니다. 최종 제출 집계는 위의 [결과 공개 현황 조회]를 사용하세요. 여기에서 참가 기록을 수정하지 않습니다.</p></section>`;
 const anchor=$('r04AdminMediaPanel')||$('r04AdminReleasePanel')||$('r04AdminStatePanel');
 if(!anchor)return;
 anchor.insertAdjacentHTML('afterend',html);
 const load=$('r04PersistedRosterLoad');if(load&&!v.loading)load.onclick=()=>loadR04PersistedRosterView();
 const group=$('r04PersistedRosterGroup');if(group)group.onchange=e=>{v.group=e.target.value;render();};
 const status=$('r04PersistedRosterStatus');if(status)status.onchange=e=>{v.status=e.target.value;render();};
 const search=$('r04PersistedRosterSearch');if(search)search.onchange=e=>{v.search=str(e.target.value);render();};
 renderR04AdminCompletionDashboard();
}

// RUN275: R04 admin-only completion dashboard using EXISTING verified aggregate read API.
// No per-teacher completion or individual grade status is inferred from aggregate data.
function r04AdminCompletionProjection(raw,view,session,examId){
 if(!raw||raw.examId!==examId||!Number.isSafeInteger(raw.stateVersion)||raw.stateVersion<0||
    !Number.isSafeInteger(raw.participantCount)||raw.participantCount<1||raw.participantCount>150||
    !Number.isSafeInteger(raw.assessedParticipants)||!Number.isSafeInteger(raw.unassessedParticipants)||
    !Number.isSafeInteger(raw.submittedCount)||!Number.isSafeInteger(raw.draftCount)||
    !Number.isSafeInteger(raw.gradeDocumentCount)||
    raw.assessedParticipants<0||raw.unassessedParticipants<0||raw.submittedCount<0||raw.draftCount<0||
    raw.assessedParticipants+raw.unassessedParticipants!==raw.participantCount||
    raw.gradeDocumentCount!==raw.submittedCount+raw.draftCount)return null;
 if(session&&session.examId===examId&&session.stateVersion!==raw.stateVersion)return null;
 if(view&&view.examId===examId){
  if(view.stateVersion!==raw.stateVersion||!Array.isArray(view.rows)||
     view.rows.length!==raw.participantCount)return null;
 }
 return {total:raw.participantCount,assessed:raw.assessedParticipants,
   unassessed:raw.unassessedParticipants,submitted:raw.submittedCount,
   draft:raw.draftCount,percent:Math.round(raw.assessedParticipants*100/raw.participantCount),
   released:raw.resultsReleased===true,closed:raw.sessionState==='closed'};
}
function renderR04AdminCompletionDashboard(){
 if(preview||S.role!=='admin'||!S.auth)return;
 const id=str(S.r04SessionId),raw=S.r04ReleasePreview;
 const progress=raw&&raw.examId===id?r04AdminCompletionProjection(raw,R04_PERSISTED_VIEW,S.r04SessionState,id):null;
 const stale=!!(raw&&raw.examId===id&&!progress);
 const busy=S.r04ReleasePreviewPending||S.r04ReleasePending||S.r04StateMutationPending;
 const prompt=stale?'<p class="warn">회차 버전 또는 참가 명단이 일치하지 않아 이전 집계를 표시하지 않습니다. 명단과 집계를 다시 조회하세요.</p>':
  '<p class="hint">[평가 진행 현황 새로고침]으로 서버에서 제출 집계를 조회합니다. 개별 강사의 제출 여부는 별도 관리자 전용 서버 API가 연결되기 전까지 표시하지 않습니다.</p>';
 const bars=progress?`<div class="stat-grid"><div class="stat"><small>저장된 참가 기록</small><strong>${progress.total}건</strong></div><div class="stat"><small>1명 이상 최종 평가한 참가 기록</small><strong>${progress.assessed}건</strong></div><div class="stat"><small>아직 최종 평가가 없는 참가 기록</small><strong>${progress.unassessed}건</strong></div><div class="stat"><small>참가 기록 평가율 · 일부 평가 기준</small><strong>${progress.percent}%</strong></div></div><div role="progressbar" aria-label="1명 이상 최종 평가된 참가 기록 비율" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}" style="height:12px;border-radius:12px;background:#e4ece7;overflow:hidden"><div style="width:${progress.percent}%;background:#168252;height:100%"></div></div><p class="hint top-gap">최종 제출된 강사 평가표 ${progress.submitted}건 · 임시저장 평가표 ${progress.draft}건. 이 비율은 강사 전원 평가 완료율이 아니며, 강사별 평가 현황은 집계할 수 없습니다.</p><p class="hint">${progress.closed?'회차 최종 종료 · 기존 평가 열람만 가능':'회차 진행 중'} · ${progress.released?'학생 결과 공개 완료':'학생 결과 미공개'}</p>`:'';
 const html=`<section class="panel" id="r04AdminCompletionDashboard"><div class="heading-row"><div><h2>R04 채점 진행 현황</h2><p class="muted">관리자 전용 · 기존 서버 집계 연결 · 개인별 채점 정보 미조회</p></div><span class="chip wait">읽기 전용</span></div><button type="button" id="r04AdminCompletionRefresh" class="btn line" ${busy?'disabled':''}>${S.r04ReleasePreviewPending?'조회 중':'평가 진행 현황 새로고침'}</button>${progress?bars:prompt}<p class="hint">모든 강사가 평가를 마쳤다는 의미로 해석하지 마세요. 강사별 완료표는 관리자 전용 채점 현황 API 연결 후 구현합니다.</p></section>`;
 const anchor=$('r04PersistedRosterPanel')||$('r04AdminMediaPanel')||$('r04AdminReleasePanel')||$('r04AdminStatePanel');
 if(!anchor)return;
 anchor.insertAdjacentHTML('afterend',html);
 const button=$('r04AdminCompletionRefresh');if(button&&!busy)button.onclick=()=>loadR04AdminReleasePreview(id);
 renderR04AdminEvaluatorMatrix();
}

// RUN277 — administrator-only evaluator completion matrix; data from verified read-only API.
const R04_EVALUATOR_VIEW={examId:'',callerUid:'',stateVersion:-1,loading:false,error:'',evaluators:[],selected:0,group:'전체',status:'전체',search:'',participantCount:0,activeCount:0,archivedCount:0};
function validateR04EvaluatorMatrix(raw,id){
 const integer=x=>Number.isSafeInteger(x)&&x>=0;
 if(!raw||raw.ok!==true||raw.mode!=='admin-grading-matrix-read-only'||raw.examId!==id||
   !integer(raw.stateVersion)||!integer(raw.participantCount)||raw.participantCount<1||raw.participantCount>150||
   !integer(raw.activeParticipantCount)||!integer(raw.archivedParticipantCount)||
   raw.activeParticipantCount+raw.archivedParticipantCount!==raw.participantCount||
   !integer(raw.activeTeacherCount)||raw.activeTeacherCount>60||
 !integer(raw.evaluatorCount)||raw.evaluatorCount>60||
 raw.activeTeacherCount>raw.evaluatorCount||
   !Array.isArray(raw.evaluators)||raw.evaluators.length!==raw.evaluatorCount)
   throw Error('R04 평가 강사별 완료 현황의 형식이 올바르지 않습니다.');
 const allIds=new Set(),labels=new Set();
 const evaluators=raw.evaluators.map((entry,i)=>{
   if(!entry||entry.evaluatorLabel!==`평가강사 ${i+1}`||labels.has(entry.evaluatorLabel)||
     typeof entry.teacherName!=='string'||!entry.teacherName.trim()||
     entry.teacherName.length>100||
     !['active','historical'].includes(entry.directoryStatus)||
     !integer(entry.submittedCount)||!integer(entry.draftCount)||!integer(entry.missingCount)||
     entry.submittedCount+entry.draftCount+entry.missingCount!==raw.activeParticipantCount||
     !Array.isArray(entry.grades)||entry.grades.length!==entry.submittedCount+entry.draftCount)
     throw Error('R04 강사별 집계가 일치하지 않습니다.');
   labels.add(entry.evaluatorLabel);
   const ids=new Set();let submitted=0,draft=0;
   const grades=entry.grades.map(x=>{
     if(!x||typeof x.participationId!=='string'||!x.participationId||x.participationId.length>180||
       (x.status!=='draft'&&x.status!=='submitted')||ids.has(x.participationId))
       throw Error('R04 강사 평가 기록이 중복되거나 손상됐습니다.');
     ids.add(x.participationId);allIds.add(x.participationId);
     if(x.status==='submitted')submitted++;else draft++;
     return {participationId:x.participationId,status:x.status};
   });
   if(submitted!==entry.submittedCount||draft!==entry.draftCount)
     throw Error('강사별 최종 제출·임시저장 집계가 일치하지 않습니다.');
   return {evaluatorLabel:entry.evaluatorLabel,teacherName:entry.teacherName,
     directoryStatus:entry.directoryStatus,submittedCount:submitted,draftCount:draft,
     missingCount:entry.missingCount,grades};
 });
 if(evaluators.filter(x=>x.directoryStatus==='active').length!==raw.activeTeacherCount)
   throw Error('활성 강사 명단 건수가 일치하지 않습니다.');
 return {examId:id,participantCount:raw.participantCount,activeCount:raw.activeParticipantCount,
   archivedCount:raw.archivedParticipantCount,activeTeacherCount:raw.activeTeacherCount,
   stateVersion:raw.stateVersion,evaluators,allIds:[...allIds]};
}
async function loadR04EvaluatorMatrix(){
 if(preview||S.role!=='admin'||!S.auth||R04_EVALUATOR_VIEW.loading||S.r04StateMutationPending)return;
 const id=str(S.r04SessionId),uid=str(S.auth.uid),view=R04_PERSISTED_VIEW;
 if(!R04_EXAM_ID_PATTERN.test(id)||view.examId!==id||!view.rows.length)return toast('저장된 평가 참가 명단을 먼저 조회해주세요.');
 R04_EVALUATOR_VIEW.loading=true;R04_EVALUATOR_VIEW.examId='';R04_EVALUATOR_VIEW.evaluators=[];
 R04_EVALUATOR_VIEW.error='';render();
 try{
   const raw=await call(FN.r04GradingMatrix,{examId:id});
   const parsed=validateR04EvaluatorMatrix(raw,id);
   if(S.role!=='admin'||!S.auth||str(S.auth.uid)!==uid||S.r04SessionId!==id)return;
   const latest=R04_PERSISTED_VIEW;
   if(latest.examId!==id||latest.stateVersion!==parsed.stateVersion||
      latest.rows.length!==parsed.participantCount||
      latest.rows.filter(x=>x.status==='active').length!==parsed.activeCount||
      latest.rows.filter(x=>x.status==='archived').length!==parsed.archivedCount)
     throw Error('서로 다른 버전의 참가 명단과 채점 현황입니다. 다시 조회해주세요.');
   const known=new Set(latest.rows.filter(x=>x.status==='active').map(x=>x.participationId));
   if(parsed.allIds.some(x=>!known.has(x)))throw Error('현재 활성 참가 명단 외 평가 기록이 있습니다.');
   Object.assign(R04_EVALUATOR_VIEW,{examId:id,callerUid:uid,stateVersion:parsed.stateVersion,
     evaluators:parsed.evaluators,participantCount:parsed.participantCount,
     activeCount:parsed.activeCount,archivedCount:parsed.archivedCount,selected:0,group:'전체',status:'전체',search:''});
 }catch(e){
   if(S.role==='admin'&&S.auth&&str(S.auth.uid)===uid&&S.r04SessionId===id){
     R04_EVALUATOR_VIEW.examId='';R04_EVALUATOR_VIEW.evaluators=[];
     R04_EVALUATOR_VIEW.error=errorMessage(e);
   }
 }finally{
   R04_EVALUATOR_VIEW.loading=false;
   if(S.role==='admin'&&S.auth&&str(S.auth.uid)===uid&&S.r04SessionId===id)render();
 }
}
function renderR04AdminEvaluatorMatrix(){
 if(preview||S.role!=='admin'||!S.auth)return;
 const v=R04_EVALUATOR_VIEW,id=str(S.r04SessionId),roster=R04_PERSISTED_VIEW;
 const current=v.examId===id&&v.callerUid===str(S.auth.uid)&&
   roster.examId===id&&roster.stateVersion===v.stateVersion&&
   roster.rows.length===v.participantCount&&
   (!S.r04SessionState||S.r04SessionState.examId!==id||S.r04SessionState.stateVersion===v.stateVersion);
 const active=roster.rows.filter(x=>x.status==='active'),activeIds=new Set(active.map(x=>x.participationId));
 // Fail closed when another roster has replaced the displayed participants.
 const linked=v.evaluators.every(e=>e.grades.every(g=>activeIds.has(g.participationId)));
 const ready=current&&v.activeCount===active.length&&linked;
 const buttons=ready?v.evaluators.map((g,i)=>`<button type="button" class="seg ${v.selected===i?'active':''}" data-r04-evaluator-index="${i}">${esc(g.teacherName)}${g.directoryStatus==='historical'?' · 이전 계정':''} · 완료 ${g.submittedCount}</button>`).join(''):'';
 const selected=ready?v.evaluators[v.selected]||null:null;
 const byPart=selected?new Map(selected.grades.map(x=>[x.participationId,x.status])):new Map();
 const statusName={submitted:'완료',draft:'임시저장',missing:'미평가'};
 const statusOptions=[['전체','모든 상태'],['missing','미평가'],['draft','임시저장'],['submitted','완료']]
   .map(([value,title])=>`<option value="${value}" ${v.status===value?'selected':''}>${title}</option>`).join('');
 const groupOptions=['전체','청소년','성인']
   .map(value=>`<option value="${value}" ${v.group===value?'selected':''}>${value}</option>`).join('');
 const query=str(v.search).toLocaleLowerCase('ko');
 const items=selected?active.map(x=>({...x,gradeStatus:byPart.get(x.participationId)||'missing'}))
   .filter(x=>(v.group==='전체'||x.group===v.group)&&
     (v.status==='전체'||x.gradeStatus===v.status)&&
     (!query||[x.studentLabel,x.classLabel,x.group].some(z=>str(z).toLocaleLowerCase('ko').includes(query)))):[];
 // Missing and draft cases go first only within the filtered list; never change server counts.
 const rows=items.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.group)}</td><td>${esc(x.classLabel||'현재 명단 외 수강반')}</td><td>${esc(x.studentLabel||'현재 명단 외 학생')}</td><td><span class="chip ${x.gradeStatus==='submitted'?'ok':'wait'}">${statusName[x.gradeStatus]}</span></td></tr>`).join('');
 const cards=selected?`<div class="stat-grid"><div class="stat"><small>현재 평가자</small><strong>${esc(selected.teacherName)}</strong></div><div class="stat"><small>최종 제출</small><strong>${selected.submittedCount}</strong></div><div class="stat"><small>임시저장</small><strong>${selected.draftCount}</strong></div><div class="stat"><small>미평가</small><strong>${selected.missingCount}</strong></div></div>`:'';
 const filters=selected?`<div class="flex top-gap"><label>구분 <select id="r04EvalGroupFilter" aria-label="평가 구분">${groupOptions}</select></label><label>채점 상태 <select id="r04EvalStatusFilter" aria-label="평가 채점 상태">${statusOptions}</select></label><label>학생·수강반 검색 <input id="r04EvalSearch" type="search" maxlength="100" value="${esc(v.search)}" placeholder="학생 또는 수강반"></label><span class="muted">표시 ${items.length} / ${active.length}건</span></div>`:'';
 const note=v.loading?'<p class="hint">평가 강사별 상태를 조회하고 있습니다.</p>':
   v.error?`<p class="warn">${esc(v.error)}</p>`:
   ready&&!v.evaluators.length?'<p class="hint">현재 활성 강사 계정이 없으며 저장된 평가표도 없습니다.</p>':
   !ready?'<p class="hint">먼저 [저장된 평가 참가 명단 조회]를 누른 뒤, [강사별 채점 현황 조회]를 실행하세요.</p>':'';
 const table=selected?`<div class="scroll-table top-gap"><table class="wide-table"><thead><tr><th>번호</th><th>구분</th><th>수강반</th><th>학생</th><th>채점 상태</th></tr></thead><tbody>${rows||'<tr><td colspan="5">현재 필터에 해당하는 학생이 없습니다.</td></tr>'}</tbody></table></div>`:'';
 const html=`<section id="r04AdminEvaluatorMatrix" class="panel"><div class="heading-row"><div><h2>R04 강사별 · 학생별 채점 현황</h2><p class="muted">관리자 전용 · 실제 최종 제출·임시저장·미평가 · 점수/한줄평 미조회</p></div><span class="chip wait">읽기 전용</span></div><button id="r04AdminEvaluatorRefresh" type="button" class="btn line" ${v.loading||roster.examId!==id||!roster.rows.length?'disabled':''}>${v.loading?'조회 중':'강사별 채점 현황 조회'}</button>${note}${buttons?`<div class="tabs">${buttons}</div>`:''}${cards}${filters}${table}<p class="hint">Firestore 활성 강사 계정을 모두 표시합니다(평가 0건 포함). 기존 평가표가 남아 있는 비활성 계정은 실명 없이 ‘과거 평가강사’로 별도 표시합니다. 회차 채점 기준: 활성 참가 기록 ${ready?active.length:'조회 전'}건.</p></section>`;
 const anchor=$('r04AdminCompletionDashboard')||$('r04PersistedRosterPanel')||$('r04AdminReleasePanel');
 if(!anchor)return;
 anchor.insertAdjacentHTML('afterend',html);
 const reload=$('r04AdminEvaluatorRefresh');if(reload&&!reload.disabled)reload.onclick=()=>loadR04EvaluatorMatrix();
 app.querySelectorAll('[data-r04-evaluator-index]').forEach(el=>el.onclick=()=>{
   const next=Number(el.dataset.r04EvaluatorIndex);
   if(!Number.isSafeInteger(next)||next<0||next>=v.evaluators.length)return;
   v.selected=next;render();
 });
 const group=$('r04EvalGroupFilter'),status=$('r04EvalStatusFilter'),search=$('r04EvalSearch');
 if(group)group.onchange=e=>{if(!['전체','청소년','성인'].includes(e.target.value))return;v.group=e.target.value;render();};
 if(status)status.onchange=e=>{if(!['전체','missing','draft','submitted'].includes(e.target.value))return;v.status=e.target.value;render();};
 if(search)search.onchange=e=>{v.search=str(e.target.value);render();};
}

// RUN191: independent administrator-only R04 results release owner.
// Preview is always read-only; publication requires final closed state and two explicit confirmations.
function validateR04AdminReleasePreview(raw,id){
 const isInt=n=>Number.isSafeInteger(n)&&n>=0;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.ok!==true||
    raw.mode!=='admin-release-preview-read-only'||raw.examId!==id||!R04_EXAM_ID_PATTERN.test(id)||
    (raw.sessionState!=='open'&&raw.sessionState!=='closed')||
    typeof raw.gradingOpen!=='boolean'||typeof raw.resultsReleased!=='boolean'||
    typeof raw.canRelease!=='boolean'||typeof raw.requiresIncompleteAcknowledgement!=='boolean'||
    !isInt(raw.stateVersion)||!isInt(raw.participantCount)||raw.participantCount<1||raw.participantCount>150||
    !isInt(raw.gradeDocumentCount)||raw.gradeDocumentCount>9000||
    !isInt(raw.submittedCount)||!isInt(raw.draftCount)||
    !isInt(raw.assessedParticipants)||!isInt(raw.unassessedParticipants)||
    raw.gradeDocumentCount!==raw.submittedCount+raw.draftCount||
    raw.assessedParticipants+raw.unassessedParticipants!==raw.participantCount||
    (raw.sessionState==='closed'&&raw.gradingOpen)||
    (raw.resultsReleased&&raw.sessionState!=='closed')||
    raw.requiresIncompleteAcknowledgement!==(raw.unassessedParticipants>0)||
    raw.canRelease!==(raw.sessionState==='closed'&&!raw.gradingOpen&&
      !raw.resultsReleased&&raw.submittedCount>0))
   throw Error('R04 결과 공개 집계의 무결성이 확인되지 않았습니다. 공개를 차단합니다.');
 return {examId:id,sessionState:raw.sessionState,gradingOpen:raw.gradingOpen,
   resultsReleased:raw.resultsReleased,stateVersion:raw.stateVersion,
   participantCount:raw.participantCount,gradeDocumentCount:raw.gradeDocumentCount,
   submittedCount:raw.submittedCount,draftCount:raw.draftCount,
   assessedParticipants:raw.assessedParticipants,unassessedParticipants:raw.unassessedParticipants,
   canRelease:raw.canRelease,requiresIncompleteAcknowledgement:raw.requiresIncompleteAcknowledgement};
}
async function loadR04AdminReleasePreview(id){
 if(preview||S.role!=='admin'||!R04_EXAM_ID_PATTERN.test(id)||S.r04ReleasePending)return;
 S.r04ReleasePreviewPending=true;S.r04ReleasePreview=null;render();
 try{
  const out=await call(FN.r04AdminRelease,{examId:id,action:'preview'});
  const checked=validateR04AdminReleasePreview(out,id);
  if(S.r04SessionId!==id||S.role!=='admin')return;
  S.r04ReleasePreview=checked;render();
 }catch(e){S.r04ReleasePreview=null;render();toast(errorMessage(e));}
 finally{S.r04ReleasePreviewPending=false; if(S.r04SessionId===id&&S.role==='admin')render();}
}
function canR04AdminRelease(p,m){
 return !!(!preview&&S.role==='admin'&&!S.r04ReleasePending&&!S.r04ReleasePreviewPending&&
   !S.r04StateMutationPending&&p&&m&&p.examId===S.r04SessionId&&m.examId===p.examId&&
   p.sessionState==='closed'&&m.sessionState==='closed'&&
   p.gradingOpen===false&&m.gradingOpen===false&&
   p.resultsReleased===false&&m.resultsReleased===false&&p.canRelease===true&&
   p.submittedCount>0&&p.stateVersion===m.stateVersion&&p.participantCount===m.participantCount);
}
async function releaseR04AdminResults(){
 const p=S.r04ReleasePreview,m=S.r04SessionState;
 if(!canR04AdminRelease(p,m))return;
 const phrase='RELEASE R04 RESULTS';
 if(window.prompt('학생 평가 결과 공개는 되돌릴 수 없습니다.\n회차: '+p.examId+
   '\n참가 '+p.participantCount+'건 / 최종 제출 '+p.submittedCount+'건 / 미평가 '+p.unassessedParticipants+
   '건\n계속하려면 아래 문구를 정확히 입력하세요: '+phrase,'')!==phrase)return;
 let allowIncomplete=false;
 if(p.requiresIncompleteAcknowledgement){
  if(!window.confirm('미평가 참가 기록 '+p.unassessedParticipants+
    '건이 존재합니다. 해당 참가 기록에는 평가표가 없을 수 있습니다. 공개를 허용합니까?'))return;
  allowIncomplete=true;
 }
 if(!window.confirm('최종 승인: '+p.examId+' 회차의 채점 결과를 학생들에게 공개하시겠습니까? 이 작업은 취소할 수 없습니다.'))return;
 if(!canR04AdminRelease(p,m)||S.r04ReleasePreview!==p)return;
 S.r04ReleasePending=true;S.r04ReleasePreview=null;S.r04SessionState=null;render();
 try{
  const response=await call(FN.r04AdminRelease,{examId:p.examId,action:'release',
    expectedVersion:p.stateVersion,expectedSubmittedCount:p.submittedCount,
    expectedParticipantCount:p.participantCount,allowIncomplete,confirmation:phrase});
  if(!response||response.ok!==true||response.mode!=='admin-results-released'||
    response.examId!==p.examId||response.changed!==true||response.resultsReleased!==true||
    response.stateVersion!==p.stateVersion+1)throw Error('결과 공개 응답을 확인할 수 없습니다. 재요청하지 말고 서버 상태를 조회하세요.');
  toast('공개 요청 성공 응답을 확인했습니다. 현재 상태를 읽기 전용으로 다시 조회하세요.');
 }catch(e){toast('결과 불확실: 공개를 다시 누르지 말고 현재 상태와 공개 현황을 재조회하세요. '+errorMessage(e));}
 finally{S.r04ReleasePending=false;S.r04ReleasePreview=null;S.r04SessionState=null;render();}
}
function renderR04AdminReleaseControls(){
 if(preview||S.role!=='admin')return;
 const m=S.r04SessionState,p=S.r04ReleasePreview;
 const current=p&&p.examId===S.r04SessionId?p:null;
 const ready=!!canR04AdminRelease(current,m);
 const label=current?(current.resultsReleased?'이미 공개됨':current.sessionState==='closed'?'평가 종료 · 미공개':'평가 진행 중 · 공개 불가'):'현황 미조회';
 const status=current?`<div class="stat-grid"><div class="stat"><small>참가 기록</small><strong>${current.participantCount}건</strong></div><div class="stat"><small>평가 완료 참가 기록</small><strong>${current.assessedParticipants}건</strong></div><div class="stat"><small>미평가 참가 기록</small><strong>${current.unassessedParticipants}건</strong></div><div class="stat"><small>최종 제출 평가표</small><strong>${current.submittedCount}건</strong></div></div><p class="hint">임시저장 ${current.draftCount}건 · 평가 문서 ${current.gradeDocumentCount}건 · 상태 버전 ${current.stateVersion}. 완료 인원은 강사 1명 이상이 최종 제출한 참가 기록 기준입니다.</p>`:
  '<p class="hint">[공개 현황 조회]를 누르면 점수·학생명 없이 완료 현황을 조회합니다. 이 작업은 데이터를 수정하지 않습니다.</p>';
 const note=current&&current.requiresIncompleteAcknowledgement?'<p class="warn">미평가 기록이 존재합니다. 공개할 경우 별도 확인이 필요합니다.</p>':'';
 const busy=S.r04ReleasePreviewPending||S.r04ReleasePending||S.r04StateMutationPending;
 const html=`<section class="panel" id="r04AdminReleasePanel"><div class="heading-row"><div><h2>R04 결과 공개 관리</h2><p class="muted">관리자 전용 · 공개 전 현황 조회 · 평가 최종 종료 후에만 공개</p></div><span class="chip ${current&&current.resultsReleased?'ok':'wait'}">${esc(label)}</span></div><div class="flex"><button id="r04LoadReleasePreview" class="btn line" type="button" ${busy?'disabled':''}>${S.r04ReleasePreviewPending?'조회 중':'결과 공개 현황 조회'}</button><button id="r04ConfirmResultsRelease" class="btn" type="button" ${ready?'':'disabled'}>평가 결과 최종 공개</button></div>${status}${note}<p class="warn">공개 전에는 점수·한줄평이 학생에게 표시되지 않습니다. 공개는 관리자만 최종 확인 후 실행할 수 있으며, 취소할 수 없습니다.</p></section>`;
 const anchor=$('r04AdminStatePanel');if(!anchor)return;
 anchor.insertAdjacentHTML('afterend',html);
 const read=$('r04LoadReleasePreview');if(read&&!busy)read.onclick=()=>loadR04AdminReleasePreview(S.r04SessionId);
 const release=$('r04ConfirmResultsRelease');if(release&&ready)release.onclick=()=>releaseR04AdminResults();
}

// RUN197: verified per-participation media admin UI. Never match by student UID alone.
// The persisted immutable R04 participation IDs are the only selection source.
function resetR04AdminMedia(){
 S.r04MediaRoster=[];S.r04MediaRosterExamId='';S.r04MediaRosterState='';
 S.r04MediaResultsReleased=false;S.r04MediaSelection='';S.r04MediaRecord=null;
 S.r04MediaRosterPending=false;S.r04MediaReadPending=false;S.r04MediaSavePending=false;S.r04MediaUnsafe=false;
}
function validateR04MediaAdminRoster(raw,examId){
 const safeId=x=>typeof x==='string'&&x.length>0&&x.length<=180&&x===x.trim()&&
  x!=='.'&&x!=='..'&&!/[/\\\x00-\x1f\x7f]/u.test(x);
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.ok!==true||
    raw.mode!=='admin-persisted-session-roster-read-only'||raw.saveEnabled!==false||
    raw.examId!==examId||!R04_EXAM_ID_PATTERN.test(examId)||
    !Number.isSafeInteger(raw.stateVersion)||raw.stateVersion<0||
    !Number.isSafeInteger(raw.participantCount)||raw.participantCount<1||raw.participantCount>150||
    !['open','closed'].includes(raw.sessionState)||typeof raw.gradingOpen!=='boolean'||
    typeof raw.resultsReleased!=='boolean'||
    (raw.sessionState==='closed'&&raw.gradingOpen)||
    (raw.resultsReleased&&raw.sessionState!=='closed')||
    !Array.isArray(raw.participants)||raw.participants.length!==raw.participantCount)
   throw Error('저장된 평가 참가 기록을 검증하지 못했습니다. 자료 편집을 차단합니다.');
 const seen=new Set(),rows=[];
 for(const p of raw.participants){
  if(!p||typeof p!=='object'||Array.isArray(p)||!safeId(p.participationId)||seen.has(p.participationId)||
     !safeId(p.classId)||!['청소년','성인'].includes(p.group)||
     !['active','archived'].includes(p.status)||
     typeof p.studentLabel!=='string'||p.studentLabel.length>100||
     typeof p.classLabel!=='string'||p.classLabel.length>150||
     typeof p.currentRosterMatch!=='boolean'||
     (p.currentRosterMatch&&(!p.studentLabel||!p.classLabel)))
    throw Error('참가 기록 중복 또는 식별 정보가 일치하지 않습니다.');
  seen.add(p.participationId);
  rows.push({participationId:p.participationId,classId:p.classId,group:p.group,
    status:p.status,studentLabel:p.studentLabel,classLabel:p.classLabel,
    currentRosterMatch:p.currentRosterMatch});
 }
 return {examId,sessionState:raw.sessionState,resultsReleased:raw.resultsReleased,stateVersion:raw.stateVersion,rows};
}
function validR04MediaUrl(raw){
 if(typeof raw!=='string'||raw.length>2048||raw!==raw.trim())return false;
 if(raw==='')return true;
 if(!raw.startsWith('https://')||/[\x00-\x1f\x7f\\]/u.test(raw))return false;
 try{const u=new URL(raw);return u.protocol==='https:'&&
  (u.hostname==='drive.google.com'||u.hostname==='docs.google.com')&&
  !u.username&&!u.password&&!u.port&&u.pathname!=='/'&&u.href===raw;
 }catch{return false;}
}
function validateR04MediaAdminRecord(raw,examId,participationId){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.ok!==true||
    raw.mode!=='admin-r04-media-read-only'||raw.examId!==examId||
    raw.participationId!==participationId||!Number.isSafeInteger(raw.revision)||raw.revision<0||
    !validR04MediaUrl(raw.audioUrl)||!validR04MediaUrl(raw.videoUrl))
   throw Error('저장된 음성·영상 링크의 형식이 올바르지 않습니다.');
 return {examId,participationId,revision:raw.revision,audioUrl:raw.audioUrl,videoUrl:raw.videoUrl};
}
function selectedR04MediaParticipation(){
 return S.r04MediaRosterExamId===S.r04SessionId&&
  S.r04MediaRoster.find(x=>x.participationId===S.r04MediaSelection)||null;
}
function canSaveR04MediaAdmin(){
 const p=selectedR04MediaParticipation(),r=S.r04MediaRecord;
 return !!(!preview&&S.role==='admin'&&p&&p.status==='active'&&
   S.r04MediaRosterState==='open'&&S.r04MediaResultsReleased===false&&
   !S.r04MediaUnsafe&&!S.r04MediaRosterPending&&!S.r04MediaReadPending&&!S.r04MediaSavePending&&
   r&&r.examId===S.r04SessionId&&r.participationId===p.participationId);
}
async function loadR04MediaAdminRoster(){
 if(preview||S.role!=='admin'||S.r04MediaRosterPending||S.r04MediaSavePending)return;
 const id=S.r04SessionId;
 if(!R04_EXAM_ID_PATTERN.test(id))return toast('평가 회차 ID 형식을 확인해 주세요.');
 S.r04MediaRosterPending=true;S.r04MediaRoster=[];S.r04MediaRosterExamId='';
 S.r04MediaSelection='';S.r04MediaRecord=null;S.r04MediaUnsafe=false;render();
 try{
  const raw=await call(FN.r04Persisted,{examId:id});
  const checked=validateR04MediaAdminRoster(raw,id);
  if(S.role!=='admin'||S.r04SessionId!==id)return;
  S.r04MediaRoster=checked.rows;S.r04MediaRosterExamId=id;
  S.r04MediaRosterState=checked.sessionState;S.r04MediaResultsReleased=checked.resultsReleased;
  S.r04MediaSelection=checked.rows[0].participationId;
 }catch(e){if(S.r04SessionId===id){S.r04MediaRoster=[];S.r04MediaRecord=null;S.r04MediaUnsafe=true;toast(errorMessage(e));}}
 finally{S.r04MediaRosterPending=false;if(S.role==='admin'&&S.r04SessionId===id)render();}
}
async function loadR04MediaAdminRecord(){
 if(preview||S.role!=='admin'||S.r04MediaReadPending||S.r04MediaSavePending)return;
 const id=S.r04SessionId,p=selectedR04MediaParticipation();if(!p)return;
 S.r04MediaReadPending=true;S.r04MediaRecord=null;S.r04MediaUnsafe=false;render();
 try{
  const raw=await call(FN.r04AdminMedia,{action:'read',examId:id,participationId:p.participationId});
  const record=validateR04MediaAdminRecord(raw,id,p.participationId);
  if(S.role==='admin'&&S.r04SessionId===id&&S.r04MediaSelection===p.participationId)
   S.r04MediaRecord=record;
 }catch(e){if(S.r04SessionId===id&&S.r04MediaSelection===p.participationId){S.r04MediaUnsafe=true;toast(errorMessage(e));}}
 finally{S.r04MediaReadPending=false;if(S.role==='admin'&&S.r04SessionId===id)render();}
}
async function saveR04MediaAdminRecord(){
 if(!canSaveR04MediaAdmin())return;
 const p=selectedR04MediaParticipation(),r=S.r04MediaRecord;
 const a=$('r04MediaAudioUrl'),v=$('r04MediaVideoUrl');if(!a||!v)return;
 const audioUrl=a.value,videoUrl=v.value;
 if(!validR04MediaUrl(audioUrl)||!validR04MediaUrl(videoUrl))return toast('Google Drive HTTPS 링크만 입력할 수 있습니다.');
 if(audioUrl===r.audioUrl&&videoUrl===r.videoUrl)return toast('변경된 링크가 없습니다.');
 if(!window.confirm('선택한 평가 참가 기록의 음성·영상 링크만 저장하시겠습니까? 복수 수강반은 별도로 관리됩니다.'))return;
 if(!canSaveR04MediaAdmin()||r!==S.r04MediaRecord)return;
 const id=S.r04SessionId,part=p.participationId;
 S.r04MediaSavePending=true;S.r04MediaRecord=null;S.r04MediaUnsafe=true;render();
 try{
  const out=await call(FN.r04AdminMedia,{action:'save',examId:id,participationId:part,
   expectedRevision:r.revision,audioUrl,videoUrl});
  if(!out||out.ok!==true||out.examId!==id||out.participationId!==part||
     typeof out.changed!=='boolean'||!Number.isSafeInteger(out.revision)||
     out.revision!==(out.changed?r.revision+1:r.revision))
   throw Error('저장 응답을 검증하지 못했습니다. 재저장하지 말고 링크를 다시 조회하세요.');
  toast('서버 저장 응답을 확인했습니다. 링크를 다시 조회하여 최종 상태를 확인하세요.');
 }catch(e){toast('저장 결과가 불확실합니다. 반복 저장하지 말고 링크를 다시 조회하세요. '+errorMessage(e));}
 finally{S.r04MediaSavePending=false;S.r04MediaUnsafe=true;if(S.role==='admin'&&S.r04SessionId===id)render();}
}
function renderR04AdminMediaControls(){
 if(preview||S.role!=='admin')return;
 const ready=S.r04MediaRosterExamId===S.r04SessionId&&S.r04MediaRoster.length>0;
 const p=selectedR04MediaParticipation(),r=S.r04MediaRecord;
 const busy=S.r04MediaRosterPending||S.r04MediaReadPending||S.r04MediaSavePending;
 const canSave=canSaveR04MediaAdmin();
 const options=ready?S.r04MediaRoster.map((x,i)=>`<option value="${esc(x.participationId)}" ${x.participationId===S.r04MediaSelection?'selected':''}>${esc(x.group)} · ${esc(x.classLabel||'현재 명단 외 수강반')} · ${esc(x.studentLabel||'현재 명단 외 학생')} · ${i+1}번${x.status==='archived'?' (보관)':''}</option>`).join(''):'';
 const status=!ready?'회차의 저장된 평가 참가 기록을 먼저 조회하세요.':
   `${S.r04MediaRoster.length}건 · ${S.r04MediaRosterState==='open'?'평가 회차 진행 중':'평가 회차 최종 종료'} · 선택된 기록의 링크만 관리합니다.`;
 const editing=ready&&p&&r&&r.participationId===p.participationId&&r.examId===S.r04SessionId;
 const inputDisabled=!canSave?'disabled':'';
 const details=ready?`<div class="flex top-gap"><label>평가 참가 기록 <select id="r04MediaParticipationPicker" ${busy?'disabled':''}>${options}</select></label><button id="r04MediaRead" type="button" class="btn line" ${busy||!p?'disabled':''}>선택 기록 링크 조회</button></div><p class="hint">복수 수강 학생도 수강반별 참가 기록에 각각 저장됩니다. 참가 기록이 2개면 링크도 별개입니다.</p>`:'';
 const fields=editing?`<div class="field"><label>음성 Google Drive 링크</label><input id="r04MediaAudioUrl" type="url" maxlength="2048" value="${esc(r.audioUrl)}" ${inputDisabled} placeholder="https://drive.google.com/file/d/..."></div><div class="field"><label>영상 Google Drive 링크</label><input id="r04MediaVideoUrl" type="url" maxlength="2048" value="${esc(r.videoUrl)}" ${inputDisabled} placeholder="https://drive.google.com/file/d/..."></div><div class="flex"><button id="r04MediaSave" type="button" class="btn" ${canSave?'':'disabled'}>선택 참가 기록 링크 저장</button><span class="muted">수정 버전 ${r.revision}</span></div>`:
   '<p class="hint">선택한 참가 기록의 기존 링크를 먼저 조회해야 저장할 수 있습니다. 저장 후에도 다시 조회해야 합니다.</p>';
 const blockNote=S.r04MediaRosterState==='closed'||S.r04MediaResultsReleased?'<p class="warn">최종 종료·결과 공개된 회차는 기존 링크를 읽을 수 있지만 수정은 불가합니다.</p>':
  p&&p.status==='archived'?'<p class="warn">보관된 참가 기록은 수정할 수 없습니다.</p>':'';
 const html=`<section class="panel" id="r04AdminMediaPanel"><div class="heading-row"><div><h2>R04 음성·영상 링크 관리</h2><p class="muted">관리자 전용 · 서버 참가 ID 기준 · Google Drive HTTPS만 허용</p></div><span class="chip wait">수동 관리</span></div><div class="flex"><button id="r04MediaRosterLoad" type="button" class="btn line" ${busy?'disabled':''}>저장된 참가 기록 조회</button></div><p class="hint">${esc(status)}</p>${details}${fields}${blockNote}<p class="hint">Google Drive 파일 접근 권한은 Drive에서 별도로 관리해야 합니다. 폴더 자동매칭은 아직 제공하지 않습니다.</p></section>`;
 const anchor=$('r04AdminReleasePanel')||$('r04AdminStatePanel');if(!anchor)return;
 anchor.insertAdjacentHTML('afterend',html);
 const reload=$('r04MediaRosterLoad');if(reload&&!busy)reload.onclick=()=>loadR04MediaAdminRoster();
 const picker=$('r04MediaParticipationPicker');if(picker&&!busy)picker.onchange=e=>{
  if(!S.r04MediaRoster.some(p=>p.participationId===e.target.value))return;
  S.r04MediaSelection=e.target.value;S.r04MediaRecord=null;S.r04MediaUnsafe=false;render();
 };
 const read=$('r04MediaRead');if(read&&!busy)read.onclick=()=>loadR04MediaAdminRecord();
 const save=$('r04MediaSave');if(save&&canSave)save.onclick=()=>saveR04MediaAdminRecord();
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
 // RUN204: the server guarantees one media document for each exact participation ID.
 // Reject malformed/missing media instead of showing an unrelated class's recording.
 const media=row.media;
 if(!media||typeof media!=='object'||Array.isArray(media)||
    Object.keys(media).length!==2||
    !Object.prototype.hasOwnProperty.call(media,'audioUrl')||
    !Object.prototype.hasOwnProperty.call(media,'videoUrl')||
    !validR04MediaUrl(media.audioUrl)||!validR04MediaUrl(media.videoUrl))
   throw Error('평가 음성·영상 자료 정보의 무결성을 확인할 수 없습니다.');
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
    participationStatus:row.participationStatus,media:{audio:row.media.audioUrl,video:row.media.videoUrl}});
  if(row.grade)grades.push({...row.grade,participationId:row.participationId,teacherUid:S.auth.teacherUid});
 }
 if(examId!==S.examId||S.role!=='teacher')return;
 S.roster=rows;S.grades=grades;S.judges=[];S.folders={};S.archived=out.sessionState==='closed';
 S.rubrics=normalizeRubrics({청소년:out.rubrics&&out.rubrics.youth,성인:out.rubrics&&out.rubrics.adult});S.rubricVersion=Number(out.rubricVersion)||0;
 S.published=false;S.r04TeacherReady=true;S.r04TeacherGradingOpen=out.gradingOpen===true&&out.sessionState==='open';
 S.edit={};S.selected=S.roster.some(p=>participantKey(p)===S.selected)?S.selected:null;
 render();
}
// RUN185: student R04 display is exclusively sourced from the server-verified own-history API.
// Never send a student UID, a participation ID, or an exam ID as a callable argument.
function validateR04StudentHistory(out){
 if(!out||typeof out!=='object'||Array.isArray(out)||out.ok!==true||
   out.mode!=='student-own-history-read-only'||!Number.isSafeInteger(out.historyCount)||
   out.historyCount<0||out.historyCount>400||!Array.isArray(out.records)||
   out.records.length!==out.historyCount||
   Object.keys(out).some(k=>!['ok','mode','historyCount','records'].includes(k)))
    throw Error('학생 평가 기록의 형식을 확인할 수 없습니다.');
 const expected=['examId','examDate','round','participationId','classId','group',
   'participationStatus','sessionState','resultsReleased','evaluations'];
 const gradeFields=['evaluatorLabel','na','act','note','total'];
 const ids=new Set();
 const validPoints=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=5&&Number.isInteger(v*2);
 const rows=[];
 for(const raw of out.records){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==expected.length||
    expected.some(k=>!Object.prototype.hasOwnProperty.call(raw,k))||
    !/^r04_20\d{4}_r0[1-9]$/u.test(raw.examId)||
    typeof raw.examDate!=='string'||!/^20\d{2}-\d{2}-\d{2}$/u.test(raw.examDate)||
    !Number.isSafeInteger(raw.round)||raw.round<1||
    typeof raw.participationId!=='string'||!raw.participationId||raw.participationId.length>180||
    typeof raw.classId!=='string'||!raw.classId||raw.classId.length>180||
    !['성인','청소년'].includes(raw.group)||!['active','archived'].includes(raw.participationStatus)||
    !['open','closed'].includes(raw.sessionState)||typeof raw.resultsReleased!=='boolean'||
    !Array.isArray(raw.evaluations)||raw.evaluations.length>60||
    ids.has(raw.participationId)||
    (raw.resultsReleased&&raw.sessionState!=='closed')||
    (!raw.resultsReleased&&raw.evaluations.length!==0))
      throw Error('학생 평가 참가 기록의 무결성을 확인할 수 없습니다.');
  ids.add(raw.participationId);
  const evaluations=[];
  for(let i=0;i<raw.evaluations.length;i++){
   const g=raw.evaluations[i];
   if(!g||typeof g!=='object'||Array.isArray(g)||Object.keys(g).length!==gradeFields.length||
     gradeFields.some(k=>!Object.prototype.hasOwnProperty.call(g,k))||
     g.evaluatorLabel!==`평가위원 ${i+1}`||!Array.isArray(g.na)||!Array.isArray(g.act)||
     g.na.length!==5||g.act.length!==5||![...g.na,...g.act].every(validPoints)||
     typeof g.note!=='string'||!g.note||g.note.length>1000||g.note.trim()!==g.note||
     typeof g.total!=='number'||Math.abs([...g.na,...g.act].reduce((a,b)=>a+b,0)-g.total)>0.000001)
       throw Error('학생 평가 점수의 무결성을 확인할 수 없습니다.');
   // Project only deliberately public values: never pass through unknown/private response fields.
   evaluations.push({evaluatorLabel:g.evaluatorLabel,na:[...g.na],act:[...g.act],
     note:g.note,total:g.total});
  }
  rows.push({examId:raw.examId,examDate:raw.examDate,round:raw.round,
    participationId:raw.participationId,classId:raw.classId,group:raw.group,
    participationStatus:raw.participationStatus,sessionState:raw.sessionState,
    resultsReleased:raw.resultsReleased,evaluations});
 }
 return rows;
}
async function refreshR04StudentHistory(){
 if(preview||S.role!=='student'||!S.auth)return;
 const uid=S.auth.uid;
 S.r04StudentHistoryReady=false;S.r04StudentHistoryError='';render();
 try{
  const out=await call(FN.r04StudentHistory,{});
  if(S.role!=='student'||!S.auth||S.auth.uid!==uid)return;
  const rows=validateR04StudentHistory(out);
  S.r04StudentHistoryRecords=rows;S.r04StudentHistoryReady=true;
  if(!rows.some(p=>p.participationId===S.r04StudentHistorySelection)){
   S.r04StudentHistorySelection=rows.length?rows[0].participationId:'';
   S.r04StudentEvaluationPage=0;
  }
  render();
 }catch(e){
  if(S.role!=='student'||!S.auth||S.auth.uid!==uid)return;
  S.r04StudentHistoryRecords=[];S.r04StudentHistoryReady=false;
  S.r04StudentHistoryError=errorMessage(e);render();
 }
}
// RUN276: Student-only R04 results view on the existing authenticated own-history endpoint.
// Never infer evaluator names, rubric titles or release status; no new server requests.
function r04StudentPublishedSummary(p){
 if(!p||p.resultsReleased!==true||p.sessionState!=='closed'||p.participationStatus!=='active'||
    !Array.isArray(p.evaluations)||!p.evaluations.length)return null;
 const rows=p.evaluations;
 const valid=rows.every(g=>g&&typeof g==='object'&&Array.isArray(g.na)&&g.na.length===5&&
  Array.isArray(g.act)&&g.act.length===5&&[...g.na,...g.act].every(x=>
   typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=5&&Number.isInteger(x*2))&&
  typeof g.total==='number'&&Number.isFinite(g.total)&&Math.abs([...g.na,...g.act].reduce((a,b)=>a+b,0)-g.total)<0.000001);
 if(!valid)return null;
 const count=rows.length,na=rows.reduce((a,g)=>a+g.na.reduce((x,y)=>x+y,0),0)/count;
 const act=rows.reduce((a,g)=>a+g.act.reduce((x,y)=>x+y,0),0)/count;
 return {count,na,act,total:na+act};
}
function renderR04StudentHistory(){
 if(preview||S.role!=='student'||!S.auth)return;
 const rows=S.r04StudentHistoryRecords||[];
 const head='<div class="heading-row"><div><h1>나의 모의고사 평가표</h1><p>본인이 참가한 회차와 수강반별 평가만 볼 수 있습니다. 평가위원의 실명은 표시하지 않습니다.</p></div></div>';
 if(S.r04StudentHistoryError){
  app.innerHTML=head+`<section class="center-state"><h2>평가 기록 조회 오류</h2><p>${esc(S.r04StudentHistoryError)}</p><button class="btn" id="r04StudentRetry">다시 조회</button></section>`;
  $('r04StudentRetry').onclick=()=>refreshR04StudentHistory();return;
 }
 if(!S.r04StudentHistoryReady){
  app.innerHTML=head+'<section class="center-state"><h2>평가 기록을 확인하고 있습니다.</h2><p>조회 중에는 점수와 한줄평이 표시되지 않습니다.</p></section>';return;
 }
 if(!rows.length){
  app.innerHTML=head+'<section class="center-state"><h2>참가한 평가 회차가 없습니다.</h2><p>현재 계정에 연결된 모의고사 기록이 확인되지 않았습니다.</p><button class="btn line" id="r04StudentRetry">새로고침</button></section>';
  $('r04StudentRetry').onclick=()=>refreshR04StudentHistory();return;
 }
 const exams=[...new Map(rows.map(p=>[p.examId,{examId:p.examId,examDate:p.examDate,round:p.round}])).values()];
 const selected=rows.find(p=>p.participationId===S.r04StudentHistorySelection)||rows[0];
 const sameExam=rows.filter(p=>p.examId===selected.examId);
 const classIndex=sameExam.findIndex(p=>p.participationId===selected.participationId);
 const options=exams.map(x=>`<option value="${esc(x.examId)}" ${x.examId===selected.examId?'selected':''}>${esc(x.examDate)} · ${x.round}회차</option>`).join('');
 const classButtons=sameExam.map((p,i)=>`<button type="button" class="seg ${p.participationId===selected.participationId?'active':''}" data-r04-own-part="${i}" aria-pressed="${p.participationId===selected.participationId?'true':'false'}">${esc(p.group)} · 수강반 ${i+1}${p.participationStatus==='archived'?' · 이전 수강':''}</button>`).join('');
 const archived=selected.participationStatus==='archived',closed=selected.sessionState==='closed';
 const summary=r04StudentPublishedSummary(selected);
 const isReleased=selected.resultsReleased===true&&closed&&!archived;
 const statusLabel=archived?'이전 수강 기록':!isReleased?'결과 공개 대기':summary?'결과 공개됨':'공개된 평가 없음';
 const status=`<section class="panel"><div class="flex"><strong>${esc(selected.examDate)} · ${selected.round}회차 · ${esc(selected.group)} · 수강반 ${classIndex+1}</strong><span class="chip ${summary?'ok':'wait'}">${statusLabel}</span></div><p class="hint top-gap">수강반마다 별도 평가 기록으로 관리합니다. 학생과 평가위원의 개인 식별정보는 이 화면에 표시되지 않습니다.</p></section>`;
 let body='';
 if(archived){
  body='<section class="panel"><h2>이전 수강 기록</h2><p class="muted">보관된 참가 기록은 열람할 수 있으나 점수와 평가 내용은 표시되지 않습니다.</p></section>';
 }else if(!isReleased){
  body='<section class="panel"><h2>평가 결과 공개 대기</h2><p class="muted">관리자가 회차를 종료하고 결과를 공개하면 평가표를 볼 수 있습니다. 평가 중인 점수와 임시저장 의견은 표시되지 않습니다.</p></section>';
 }else if(!summary){
  body='<section class="panel"><h2>공개된 평가표가 없습니다.</h2><p class="muted">결과 공개는 완료됐지만 이 참가 기록에 최종 제출된 강사 평가표가 없습니다.</p></section>';
 }else{
  const vals=selected.evaluations;
  const page=Math.max(0,Math.min(S.r04StudentEvaluationPage,vals.length-1));
  S.r04StudentEvaluationPage=page;
  const grade=vals[page];
  const section=(title,key)=>`<section class="rubric"><h3>${title}<span class="numeric">${fmt(grade[key].reduce((a,b)=>a+b,0))} / 25점</span></h3><table><thead><tr><th>평가 항목 순번</th><th>평가 점수</th></tr></thead><tbody>${grade[key].map((n,i)=>`<tr><td>${i+1}번 항목</td><td><strong>${fmt(n)} / 5점</strong></td></tr>`).join('')}</tbody></table></section>`;
  const cards=`<div class="stat-grid"><div class="stat"><small>전체 평균 · 50점 만점</small><strong>${fmt(summary.total)}</strong></div><div class="stat"><small>NA 평균 · 25점 만점</small><strong>${fmt(summary.na)}</strong></div><div class="stat"><small>독백 평균 · 25점 만점</small><strong>${fmt(summary.act)}</strong></div><div class="stat"><small>제출된 평가표</small><strong>${summary.count}건</strong></div></div>`;
  body=`<section class="panel"><h2 class="panel-title">평가 결과 요약</h2>${cards}<p class="hint">최종 제출된 평가표만 평균에 포함합니다. NA·독백 각 25점, 전체 50점 만점입니다.</p></section><section class="panel"><div class="heading-row"><div><h2>${esc(grade.evaluatorLabel)} 평가표</h2><p class="muted">${page+1} / ${vals.length} · 평가위원 실명 비공개</p></div><strong>${fmt(grade.total)} / 50점</strong></div>${section('NA · 나레이션','na')}${section('독백 · 연기','act')}<div class="field"><label>평가위원 한줄평</label><div class="note">${esc(grade.note)}</div></div><div class="pager"><button class="btn line" type="button" id="r04StudentPrev" ${page===0?'disabled':''}>◀ 이전 평가표</button><span>${page+1} / ${vals.length}</span><button class="btn line" type="button" id="r04StudentNext" ${page===vals.length-1?'disabled':''}>다음 평가표 ▶</button></div></section>`;
 }
 app.innerHTML=head+`<section class="session-bar"><div><strong>평가 회차</strong><small>실제 저장된 참가 회차만 조회합니다.</small></div><div class="session-picker"><select id="r04StudentExamSelect" aria-label="평가 회차 선택">${options}</select><button class="btn line" type="button" id="r04StudentRefresh">새로고침</button></div></section>`+(sameExam.length>1?`<div class="tabs" role="group" aria-label="내 수강반 선택">${classButtons}</div>`:'')+status+body;
 $('r04StudentRefresh').onclick=()=>refreshR04StudentHistory();
 $('r04StudentExamSelect').onchange=e=>{
  const next=rows.find(p=>p.examId===e.target.value);
  if(next){S.r04StudentHistorySelection=next.participationId;S.r04StudentEvaluationPage=0;render();}
 };
 app.querySelectorAll('[data-r04-own-part]').forEach(el=>el.onclick=()=>{
  const p=sameExam[Number(el.dataset.r04OwnPart)];if(!p)return;
  S.r04StudentHistorySelection=p.participationId;S.r04StudentEvaluationPage=0;render();
 });
 const prev=$('r04StudentPrev'),next=$('r04StudentNext');
 if(prev)prev.onclick=()=>{if(S.r04StudentEvaluationPage>0){S.r04StudentEvaluationPage--;render();}};
 if(next)next.onclick=()=>{if(S.r04StudentEvaluationPage+1<selected.evaluations.length){S.r04StudentEvaluationPage++;render();}};
}

async function refreshSessions(){if(preview)return;if(S.role==='student')return refreshR04StudentHistory();if(S.role==='teacher'){S.examId='r04_202610_r01';S.sessions=[{examId:S.examId,date:'2026-10-30',month:'2026-10',title:'R04 모의고사 1회차',published:false,archived:false}];return reloadR04Teacher();}if(S.role==='admin')return refreshCanonicalAdminRosterR04();const out=await call(FN.sessions,{});if(out.ok!==true)throw Error('평가 회차 목록을 불러오지 못했습니다.');S.sessions=Array.isArray(out.sessions)?out.sessions:[];if(!S.sessions.some(x=>x.examId===S.examId))S.examId=S.sessions.length?S.sessions[0].examId:'';if(S.examId)await reload();else{applySnapshot({});S.sessionTitle='';render();}}
async function switchExam(id){if(!S.sessions.some(x=>x.examId===id))return toast('해당 회차를 열람할 수 없습니다.');if(preview){switchPreviewExam(id);return;}S.examId=id;S.edit={};S.selected=null;S.judgePage=0;S.expandedClasses={'청소년':[],'성인':[]};await reload();}
function sessionBar(){if(!preview&&S.role==='admin'&&S.rosterPreviewOnly){const m=S.r04SessionState;const id=str(S.r04SessionId);return `<section class="session-bar"><div><strong>평가 회차</strong><small>R04 · ${esc(id)}${m&&m.examId===id?' · '+(m.gradingOpen?'평가 ON':'평가 대기 또는 종료'):''}</small></div><span class="chip wait">관리자 회차</span></section>`;}const m=S.sessions.find(x=>x.examId===S.examId);return `<section class="session-bar"><div><strong>평가 회차</strong><small>${m?esc(m.date+' · '+m.title):'생성 또는 선택된 회차 없음'}</small></div><div class="session-picker"><select aria-label="평가 회차 선택" id="sessionSelect"><option value="" ${!S.examId?'selected':''} disabled>회차를 선택하세요</option>${S.sessions.map(x=>`<option value="${esc(x.examId)}" ${S.examId===x.examId?'selected':''}>${esc(x.month+' · '+x.title)}${x.archived?' · 보관':x.published?' · 공개':''}</option>`).join('')}</select><span class="chip ${S.archived?'wait':S.published?'ok':'wait'}">${S.archived?'보관됨':S.published?'공개됨':'작성 중'}</span></div></section>`;}
function prefix(){return (preview?previewBar():'')+sessionBar();}
function bindSessionPicker(){const el=$('sessionSelect');if(el)el.onchange=e=>withBusy(el,()=>switchExam(e.target.value));}

function setPreviewRole(role){S.previewRole=role;S.role=role;S.auth=role==='teacher'?{uid:'judge01',teacherUid:'judge01',name:'평가강사 A'}:role==='student'?{uid:'stu01',studentUid:'stu01',name:'김하늘'}:{uid:'admin01',name:'관리자'};S.selected=null;S.expandedClasses={'청소년':[],'성인':[]};S.judgePage=0;badge();render();}
function previewBar(){return `<div class="panel" style="border-style:dashed"><div class="flex"><strong>미배포 화면 미리보기</strong><span class="muted">예시 이름·점수만 사용하며 실제 학원 데이터와 연결되지 않습니다.</span></div><div class="login-switch">${['admin','teacher','student'].map(r=>`<button class="seg ${S.role===r?'active':''}" data-preview-role="${r}">${r==='admin'?'관리자 화면':r==='teacher'?'강사 화면':'학생 화면'}</button>`).join('')}<button class="seg" id="togglePreviewPublished">${S.published?'공개 해제 (시연)':'결과 공개 (시연)'}</button></div></div>`}
async function runtime(){if(S.rt)return S.rt;const owner=window.ULIM_ROOM_CLASSROOM_REALTIME_72919;if(!owner||typeof owner.preloadRuntime!=='function')throw Error('기존 Firebase 인증 모듈을 불러오지 못했습니다.');S.rt=await owner.preloadRuntime();return S.rt}
async function call(name,payload){const rt=await runtime();if(!rt.auth.currentUser)throw Error('로그인이 필요합니다.');const res=await rt.sdk.httpsCallable(rt.functions,name)(payload||{});return res&&res.data||{};}
async function authenticateStaff(id,pw){const rt=await runtime();const norm=str(id).normalize('NFKC').toLowerCase();if(!norm||!pw)throw Error('교직원 ID와 비밀번호를 입력해주세요.');const bytes=new TextEncoder().encode('ulimvoice-staff-password-v1\u001f'+norm),d=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));let raw='';d.forEach(v=>raw+=String.fromCharCode(v));const email='u_'+btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')+'@auth.ulimvoice.app';await rt.sdk.setPersistence(rt.auth,rt.sdk.browserLocalPersistence);await rt.sdk.signInWithEmailAndPassword(rt.auth,email,pw);await bindSession();}
async function authenticateStudent(name,pw){const rt=await runtime();const login=await rt.sdk.httpsCallable(rt.functions,'loginStudentFirebaseSecure73551526')({name:str(name),password:String(pw)});const token=str(login&&login.data&&login.data.customToken);if(!token)throw Error('학생 인증에 실패했습니다.');await rt.sdk.setPersistence(rt.auth,rt.sdk.browserLocalPersistence);await rt.sdk.signInWithCustomToken(rt.auth,token);await bindSession();}
async function bindSession(){const rt=await runtime(),user=rt.auth.currentUser;if(!user){clearR04PersistedView();S.auth=null;S.role=null;badge();render();return;}const c=(await rt.sdk.getIdTokenResult(user,false)).claims||{},r=str(c.role);if(!['teacher','admin','superAdmin','student'].includes(r)||c.authVersion==null)throw Error('현재 계정의 인증 권한을 확인할 수 없습니다.');if(r==='teacher'&&!str(c.teacherUid)||r==='student'&&!str(c.studentUid))throw Error('계정 식별 정보가 없습니다.');
S.role=r==='superAdmin'||r==='admin'?'admin':r;
S.auth={uid:str(user.uid),studentUid:str(c.studentUid),teacherUid:str(c.teacherUid),name:str(c.name||c.displayName||user.displayName||c.loginId||(r==='student'?'학생':'강사'))};
// Personal names and permissions displayed here are advisory: every endpoint must revalidate Firebase token claims.
try{if(S.role==='student'){const p=await call('getStudentFirebaseProfile7355030',{});if(p&&p.ok&&str(p.studentUid)===S.auth.studentUid)S.auth.name=str(p.name)||S.auth.name;else throw Error('학생 프로필 확인에 실패했습니다.');}}catch(e){if(S.role==='student')throw e;}
badge();await refreshSessions();}
async function reload(){if(!preview&&S.role==='student')return refreshR04StudentHistory();if(!preview&&S.role==='teacher')return reloadR04Teacher();if(!S.examId){applySnapshot({});render();return;}const requestExamId=S.examId;const a=await call(FN.overview,{examId:requestExamId});if(requestExamId!==S.examId)return;if(a.ok!==true)throw Error('평가 현황을 불러오지 못했습니다.');S.roster=rosterForView(Array.isArray(a.participants)?a.participants:[],S.role);S.grades=Array.isArray(a.grades)?a.grades:[];S.judges=Array.isArray(a.judges)?a.judges:[];S.folders=a.classFolders||{};S.rubrics=normalizeRubrics(a.rubrics);S.rubricVersion=Number(a.rubricVersion)||0;S.rubricFrozen=a.rubricFrozen===true;S.published=a.published===true;S.archived=a.archived===true;S.sessionTitle=str(a.title);S.examDate=str(a.date);S.selected=S.roster.some(p=>participantKey(p)===S.selected)?S.selected:null;render();}
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
  // RUN273: The existing R04 owner renders the real authenticated teacher workspace.
  // No new callable, browser database read, role override, or client-side permission bypass.
  if(!preview&&S.role==='teacher'&&!S.r04TeacherReady){
    app.innerHTML=prefix()+'<section class="center-state"><h1>강사 평가를 불러오고 있습니다</h1><p>인증된 R04 평가 명단을 확인한 뒤 사용할 수 있습니다.</p></section>';
    return;
  }
  const list=S.roster.filter(x=>x.group===S.group);
  const active=list.filter(x=>x.participationStatus!=='archived');
  const savedState=x=>{const grade=myGrade(x);return grade&&grade.status==='submitted'?'submitted':grade&&grade.status==='draft'?'draft':'pending';};
  const unsaved=x=>{
    const edit=S.edit[participantKey(x)];if(!edit)return false;
    const old=myGrade(x),empty=[null,null,null,null,null];
    const prior={na:old&&Array.isArray(old.na)?old.na:empty,act:old&&Array.isArray(old.act)?old.act:empty,note:str(old&&old.note)};
    return JSON.stringify(edit.na)!==JSON.stringify(prior.na)||JSON.stringify(edit.act)!==JSON.stringify(prior.act)||str(edit.note)!==prior.note;
  };
  const mark=x=>{
    if(x.participationStatus==='archived')return '보관';
    if(unsaved(x))return '입력 중·미저장';
    const st=savedState(x);
    return st==='submitted'?'완료':st==='draft'?'임시저장':'미평가';
  };
  if(S.selected&&!list.some(x=>participantKey(x)===S.selected))S.selected=null;
  if(!S.selected&&active.length){
    const first=active.find(x=>savedState(x)!=='submitted')||active[0];
    S.selected=participantKey(first);
    const chosen=teacherClasses(list).find(c=>c.students.some(x=>participantKey(x)===S.selected));
    if(chosen){const opened=S.expandedClasses[S.group]||[];if(!opened.includes(chosen.key))S.expandedClasses[S.group]=[...opened,chosen.key];}
  }
  const p=list.find(x=>participantKey(x)===S.selected)||null;
  const g=p?draft(p):null;
  const classes=teacherClasses(list);
  const opened=S.expandedClasses[S.group]||[];
  const completed=active.filter(x=>savedState(x)==='submitted').length;
  const temporary=active.filter(x=>savedState(x)==='draft').length;
  const pending=active.length-completed-temporary;
  const currentIndex=p?list.findIndex(x=>participantKey(x)===S.selected):-1;
  const classMarkup=classes.map((c,i)=>{
    const isOpen=opened.includes(c.key);
    const done=c.students.filter(x=>x.participationStatus!=='archived'&&savedState(x)==='submitted').length;
    const eligible=c.students.filter(x=>x.participationStatus!=='archived').length;
    return `<section class="class-accordion"><button type="button" class="class-toggle ${isOpen?'open':''}" data-class-toggle="${esc(c.key)}" aria-expanded="${isOpen?'true':'false'}" aria-controls="exam-class-${i}"><span class="class-title"><span class="class-chevron" aria-hidden="true">${isOpen?'▾':'▸'}</span><span><strong>${esc(c.name)}</strong>${preview&&c.id?`<small>${esc(c.id)}</small>`:''}</span></span><span class="class-count">${eligible}명 <small>완료 ${done}/${eligible}</small></span></button><div class="class-students" id="exam-class-${i}" ${isOpen?'':'hidden'}>${c.students.map(student=>{const label=mark(student),key=participantKey(student);return `<button type="button" class="student-choice ${S.selected===key?'active':''}" data-student="${esc(key)}" ${S.selected===key?'aria-current="true"':''}><b>${esc(student.name)}</b><span class="chip ${label==='완료'?'ok':'wait'}">${label}</span></button>`;}).join('')}</div></section>`;
  }).join('');
  const editAllowed=!!p&&(preview||S.r04TeacherGradingOpen&&!S.archived&&p.participationStatus==='active');
  const inputDisabled=!preview&&(!S.r04TeacherGradingOpen||S.archived||!p||p.participationStatus==='archived');
  const saveDisabled=S.archived||S.published||!preview&&(!S.r04TeacherGradingOpen||!p||p.participationStatus==='archived'||S.r04TeacherSavePending);
  const navigation=p?`<div class="action-row" aria-label="평가 학생 이동"><span class="muted" style="margin-right:auto;align-self:center">${currentIndex+1} / ${list.length} 평가 대상 · ${mark(p)}</span><button type="button" class="btn line small" id="prevExamStudent" ${currentIndex<1?'disabled':''}>◀ 이전 학생</button><button type="button" class="btn line small" id="nextExamStudent" ${currentIndex>=list.length-1?'disabled':''}>다음 학생 ▶</button><button type="button" class="btn subtle small" id="nextPendingExamStudent" ${active.some(x=>savedState(x)!=='submitted'&&participantKey(x)!==S.selected)?'':'disabled'}>다음 미완료 학생</button></div>`:'';
  app.innerHTML=prefix()+`<div class="heading-row"><div><h1>강사 평가 입력</h1><p>NA 25점 + 독백 25점 = 총 50점 · ${!preview?(S.r04TeacherGradingOpen?'현재 채점 ON':'현재 채점 OFF · 읽기 전용'):'미리보기'}</p></div><button class="btn line" id="refreshBtn" ${preview?'hidden':''}>새로고침</button></div><section class="stat-grid" aria-label="현재 그룹 평가 현황"><div class="stat"><small>평가 대상</small><strong>${active.length}</strong></div><div class="stat"><small>평가 완료</small><strong>${completed}</strong></div><div class="stat"><small>임시저장</small><strong>${temporary}</strong></div><div class="stat"><small>미평가</small><strong>${pending}</strong></div></section><div class="tabs"><button class="seg ${S.group==='청소년'?'active':''}" data-group="청소년">청소년반</button><button class="seg ${S.group==='성인'?'active':''}" data-group="성인">성인반</button></div><div class="layout"><aside class="panel"><div class="panel-title">평가 대상 <span class="hint">${classes.length}개 반 · ${active.length}명</span></div><p class="hint class-help">반을 열어 학생을 선택하세요. 완료·임시저장·미평가 상태를 표시합니다.</p><div class="student-list">${classMarkup||'<p class="muted">이 그룹에는 평가 대상이 없습니다. 다른 그룹을 선택하거나 R04 명단 연결을 확인해주세요.</p>'}</div></aside><article class="panel">${p?hero(p,gradeTotal(g),'작성 중 · 50점 만점')+navigation+media(p)+rubric(g,editAllowed,p.group)+`<div class="field"><label>강사 한줄평 · 최종 제출 시 필수</label><textarea id="noteInput" maxlength="300" ${inputDisabled?'disabled':''} placeholder="학생의 강점과 개선점을 구체적으로 작성해주세요.">${esc(g.note)}</textarea></div><p class="hint" id="r04SaveHelp">임시저장은 미완료 상태입니다. 최종 제출은 10항목 점수와 한줄평을 모두 입력해야 합니다. 저장 전 입력은 이 화면을 새로고침하면 사라질 수 있습니다.</p><div class="action-row"><button id="draftBtn" class="btn line" ${saveDisabled?'disabled':''}>임시저장</button><button id="submitBtn" class="btn" ${saveDisabled?'disabled':''}>평가 완료 · 저장</button></div>`:'<div class="empty-evaluation"><h2>평가 학생 선택</h2><p>왼쪽에서 반을 펼쳐 평가할 학생을 선택해주세요.</p></div>'}</article></div>`;
  const sideList=app.querySelector('.student-list');
  if(sideList){sideList.scrollTop=R04_TEACHER_LIST_SCROLL[S.group]||0;sideList.addEventListener('scroll',()=>{R04_TEACHER_LIST_SCROLL[S.group]=sideList.scrollTop;},{passive:true});}
  app.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{S.group=b.dataset.group;S.selected=null;render();});
  app.querySelectorAll('[data-class-toggle]').forEach(b=>b.onclick=()=>{
    const group=S.group,key=b.dataset.classToggle,currently=S.expandedClasses[group]||[];
    S.expandedClasses[group]=currently.includes(key)?currently.filter(x=>x!==key):[...currently,key];
    render();const next=[...app.querySelectorAll('[data-class-toggle]')].find(el=>el.dataset.classToggle===key);if(next)next.focus();
  });
  app.querySelectorAll('[data-student]').forEach(b=>b.onclick=()=>{S.selected=b.dataset.student;render();});
  if($('refreshBtn'))$('refreshBtn').onclick=()=>withBusy($('refreshBtn'),reload);
  if(!p)return;
  const jump=idx=>{if(idx<0||idx>=list.length)return;S.selected=participantKey(list[idx]);render();};
  if($('prevExamStudent'))$('prevExamStudent').onclick=()=>jump(currentIndex-1);
  if($('nextExamStudent'))$('nextExamStudent').onclick=()=>jump(currentIndex+1);
  if($('nextPendingExamStudent'))$('nextPendingExamStudent').onclick=()=>{
    for(let step=1;step<list.length;step++){
      const idx=(currentIndex+step)%list.length;
      if(list[idx].participationStatus!=='archived'&&savedState(list[idx])!=='submitted'){jump(idx);return;}
    }
  };
  app.querySelectorAll('[data-score]').forEach(el=>el.onchange=()=>{
    if(!editAllowed)return;
    g[el.dataset.score][Number(el.dataset.idx)]=el.value===''?null:Number(el.value);
    const total=gradeTotal(g);const heroNum=app.querySelector('.score-number');if(heroNum)heroNum.firstChild.textContent=fmt(total)+' ';
    for(const key of ['na','act']){const cell=app.querySelector(`[data-sum="${key}"]`);if(cell)cell.textContent=fmt(score(g[key]))+' / 25';}
  });
  if($('noteInput'))$('noteInput').oninput=e=>{if(editAllowed)g.note=e.target.value;};
  if($('draftBtn'))$('draftBtn').onclick=()=>saveGrade(p,g,'draft',$('draftBtn'));
  if($('submitBtn'))$('submitBtn').onclick=()=>saveGrade(p,g,'submitted',$('submitBtn'));
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
function render(){badge();if(!S.auth){loginView();return;}if(!preview&&S.role==='student'){renderR04StudentHistory();return;}if(S.role==='admin'&&S.rosterPreviewOnly){renderCanonicalAdminRosterR04();return;}if(S.role==='teacher')teacherView();else if(S.role==='admin')adminView();else studentView();bindSessionPicker();if(preview){app.querySelectorAll('[data-preview-role]').forEach(b=>b.onclick=()=>setPreviewRole(b.dataset.previewRole));const pb=$('togglePreviewPublished');if(pb)pb.onclick=()=>{S.published=!S.published;const meta=S.sessions.find(x=>x.examId===S.examId);if(meta)meta.published=S.published;S.previewData[S.examId]=currentSnapshot();render()}}}
logoutBtn.onclick=()=>withBusy(logoutBtn,async()=>{const rt=await runtime();await rt.sdk.signOut(rt.auth);clearR04PersistedView();S={...S,role:null,auth:null,rt,roster:[],grades:[],judges:[],folders:{},edit:{},examId:'',sessions:[],rosterPreviewOnly:false,rosterDate:'',rosterReview:[],rosterReviewSummary:{},r04SessionState:null,r04StateMutationPending:false,r04ReleasePreview:null,r04ReleasePending:false,r04ReleasePreviewPending:false,r04MediaRoster:[],r04MediaRosterExamId:'',r04MediaRosterState:'',r04MediaResultsReleased:false,r04MediaRosterPending:false,r04MediaSelection:'',r04MediaRecord:null,r04MediaReadPending:false,r04MediaSavePending:false,r04MediaUnsafe:false,r04TeacherReady:false,r04TeacherGradingOpen:false,r04TeacherSavePending:false,r04StudentHistoryRecords:[],r04StudentHistoryReady:false,r04StudentHistoryError:'',r04StudentHistorySelection:'',r04StudentEvaluationPage:0};render()});
async function start(){if(preview){initPreview();return}render();try{const rt=await runtime();await new Promise(resolve=>{let settled=false;let stop=()=>{};const timer=setTimeout(()=>{if(!settled){settled=true;stop();resolve()}},4500);stop=rt.sdk.onAuthStateChanged(rt.auth,()=>{if(!settled){settled=true;clearTimeout(timer);resolve()}},()=>{if(!settled){settled=true;clearTimeout(timer);resolve()}})});if(rt.auth.currentUser)await bindSession();else loginView()}catch(e){app.innerHTML=`<section class="center-state"><h1>평가 서비스 연결을 확인해주세요.</h1><p>${esc(errorMessage(e))}</p><div class="action-row"><button id="retryBtn" class="btn">다시 시도</button></div></section>`;$('retryBtn').onclick=start}}
start();
})();
