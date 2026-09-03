import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js';

const VERSION = '2026-09-03.73550964-curriculum-instructor-group-modal-tabs';
window.__ULIM_NEW_STUDENT_REGISTRATION_PUBLIC_73550937__ = true;
window.__ULIM_NEW_STUDENT_PUBLIC_SPECIAL_OWNER_73550963__ = true;
window.__ULIM_NEW_STUDENT_CURRICULUM_INSTRUCTOR_TABS_73550964__ = true;
window.__ULIM_NEW_STUDENT_PUBLIC_LOADING_FAILSAFE_73550951__ = true;

const FIREBASE_CONFIG = Object.freeze({
  apiKey:'AIzaSyAW-sqtUQ_mJ6ZS_aV8pTOAKvHTSX-FXUM',
  authDomain:'ulim-7b09a.firebaseapp.com',
  projectId:'ulim-7b09a',
  storageBucket:'ulim-7b09a.firebasestorage.app',
  messagingSenderId:'364788231295',
  appId:'1:364788231295:web:b43fb49527bb6af1c6634a',
  measurementId:'G-V3FH7V87E4'
});

const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const functions = getFunctions(app, 'asia-northeast3');
let config = null;
let academyIndex = 0;
let stepIndex = 0;
let signatureHasInk = false;
let signatureCanvas = null;
let signatureCtx = null;
let drawing = false;
let lastPoint = null;
const form = {
  name:'', birthDate:'', parentPhone:'', studentPhone:'', discoverySource:'', discoveryEtc:'',
  paymentMethod:'', refundPolicyAccepted:false, privacyConsent:false, portraitConsent:null,
  voiceSamplingConsent:null, voiceSocialUploadConsent:null, voiceExternalSampleConsent:null,
  rulesAccepted:false, signerName:'', signatureDataUrl:'', classIds:[]
};

function text(v){ return String(v == null ? '' : v).trim(); }
function esc(v){ return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function digits(v){ return text(v).replace(/\D/g,''); }
function requestId(prefix){ return prefix+'-'+Date.now()+'-'+Math.random().toString(36).slice(2); }
function showLoading(message){ const el=document.getElementById('loading73550937'); const label=document.getElementById('loadingText73550937'); if(label) label.textContent=message||'처리 중...'; if(el) el.classList.add('on'); }
function hideLoading(){ const el=document.getElementById('loading73550937'); if(el) el.classList.remove('on'); }
function callableMessage(error, fallback){ const raw=text(error&&error.message).replace(/^FirebaseError:\s*/i,''); return raw && raw.toLowerCase() !== 'internal' ? raw : fallback; }
function withTimeout73550951(promise,ms,message){ return new Promise((resolve,reject)=>{ let settled=false; const timer=setTimeout(()=>{ if(settled)return; settled=true; reject(new Error(message||'요청 시간이 초과되었습니다.')); },Math.max(1000,Number(ms)||20000)); Promise.resolve(promise).then(v=>{ if(settled)return; settled=true; clearTimeout(timer); resolve(v); },e=>{ if(settled)return; settled=true; clearTimeout(timer); reject(e); }); }); }
async function call(name,payload){ const fn=httpsCallable(functions,name,{timeout:25000}); const result=await withTimeout73550951(fn(payload||{}),25000,'페이지 정보를 불러오는 시간이 초과되었습니다.'); return result&&result.data||{}; }
function isMinor(){
  const raw=form.birthDate; if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const birth=new Date(raw+'T12:00:00+09:00'); if(Number.isNaN(birth.getTime())) return false;
  const now=new Date(); let age=now.getFullYear()-birth.getFullYear(); const md=(now.getMonth()+1)*100+now.getDate(); const bmd=(birth.getMonth()+1)*100+birth.getDate(); if(md<bmd) age-=1; return age<19;
}
function safeImageUrl(v){ const s=text(v); return /^https:\/\//i.test(s) ? s : ''; }
function boolLabel(v){ return v===true?'동의':v===false?'동의하지 않음':'미선택'; }

const stepDefs = [
  {id:'name',title:'이름을 입력해주세요',sub:'수강생 본인의 성명을 입력합니다.'},
  {id:'birth',title:'생년월일을 알려주세요',sub:'미성년 여부와 수강생 구분 확인에 사용됩니다.'},
  {id:'guardian',title:'보호자 연락처를 입력해주세요',sub:'미성년 수강생에게만 표시되는 항목입니다.'},
  {id:'phone',title:'본인 전화번호를 입력해주세요',sub:'학원 안내 및 울림앱 계정 연결에 사용됩니다.'},
  {id:'discovery',title:'울림을 어떻게 알게 되셨나요?',sub:'해당하는 항목을 선택해주세요.'},
  {id:'payment',title:'결제 방법을 선택해주세요',sub:'실제 결제 처리와 별도로 신청서에 선택 내용을 기록합니다.'},
  {id:'refund',title:'환불 규정을 확인해주세요',sub:'내용을 충분히 읽은 후 확인에 체크해주세요.'},
  {id:'privacy',title:'개인정보 수집·이용 동의',sub:'수강 등록과 학원 운영에 필요한 필수 동의입니다.'},
  {id:'portrait',title:'사진·영상 촬영 및 초상권 동의',sub:'동의 또는 동의하지 않음을 선택할 수 있습니다.'},
  {id:'voice',title:'음성파일 활용 동의',sub:'용도별로 각각 선택해주세요. 동의하지 않아도 수강신청은 가능합니다.'},
  {id:'rules',title:'학원 이용 시 주의사항',sub:'학원 이용 및 수업 운영 안내를 확인해주세요.'},
  {id:'signature',title:'최종 서명',sub:'위 내용을 확인한 신청자 또는 보호자가 직접 서명해주세요.'},
  {id:'classes',title:'수강할 반을 선택해주세요',sub:'복수 수강 예정이라면 여러 반을 선택할 수 있습니다.'},
  {id:'review',title:'최종 내용을 확인해주세요',sub:'제출 후 자동으로 학생명단과 선택한 반에 신규 등록됩니다.'}
];
function activeSteps(){ return stepDefs.filter(s=>s.id!=='guardian'||isMinor()); }
function currentStep(){ const list=activeSteps(); stepIndex=Math.min(stepIndex,Math.max(0,list.length-1)); return list[stepIndex]; }
function optionList(values){ return (Array.isArray(values)?values:[]).map(v=>text(v)).filter(Boolean); }
function policy(key,fallback){ return text(config&&config.applicationContent&&config.applicationContent[key])||fallback||''; }

function setTopTab(tab){
  document.querySelectorAll('[data-top-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.topTab===tab));
  document.getElementById('academyPanel73550937').classList.toggle('active',tab==='academy');
  document.getElementById('applyPanel73550937').classList.toggle('active',tab==='apply');
  if(tab==='apply') renderApplication(); else renderAcademy();
}

function parseAcademySpecialMeta73550963(raw){
  const value=text(raw);
  const prefix='[[ULIMNS53]]',suffix='[[/ULIMNS53]]';
  const a=value.indexOf(prefix),b=value.indexOf(suffix);
  if(a<0||b<a)return null;
  try{
    const meta=JSON.parse(value.slice(a+prefix.length,b).trim());
    meta.__rest=value.slice(b+suffix.length).trim();
    return meta;
  }catch(_e){return null;}
}
function ensureAcademyDetailModal73550963(){
  let modal=document.getElementById('ulimAcademyDetailModal73550963');
  if(modal)return modal;
  const style=document.createElement('style');
  style.id='ulimAcademySpecialStyle73550963';
  style.textContent=`
    .ulim-academy-teacher-grid73550963{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-top:15px}
    .ulim-academy-teacher-card73550963{width:100%;border:1px solid #cfe7df;border-radius:20px;background:#fff;padding:16px;display:flex;align-items:center;gap:14px;text-align:left;box-shadow:0 8px 24px rgba(20,112,92,.07)}
    .ulim-academy-teacher-face73550963,.ulim-academy-teacher-placeholder73550963{width:86px;height:86px;flex:0 0 86px;border-radius:50%;border:1px solid #cce7de;background:#eef9f5;object-fit:cover;object-position:center}
    .ulim-academy-teacher-placeholder73550963{display:grid;place-items:center;color:#14705c;font-size:30px}
    .ulim-academy-teacher-name73550963{display:block;font-size:19px;font-weight:950;color:#14705c}.ulim-academy-teacher-summary73550963{display:block;margin-top:5px;color:#64748b;font-size:13px;line-height:1.5}
    .ulim-academy-curr-tabs73550963{display:flex;flex-wrap:wrap;gap:9px;margin-top:15px}
    .ulim-academy-curr-tab73550963{border:1px solid #b9ddd2;background:#fff;color:#14705c;border-radius:999px;padding:12px 17px;font-weight:950}
    .ulim-academy-curr-tab73550963 small{display:block;margin-top:4px;color:#64748b;font-size:11px}
    .ulim-academy-detail-modal73550963{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:2147483300;padding:18px}.ulim-academy-detail-modal73550963.open{display:flex}
    .ulim-academy-detail-backdrop73550963{position:absolute;inset:0;background:rgba(15,23,42,.62)}
    .ulim-academy-detail-panel73550963{position:relative;z-index:1;width:min(940px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:24px;padding:26px;box-shadow:0 28px 90px rgba(0,0,0,.32)}
    .ulim-academy-detail-close73550963{position:sticky;top:0;float:right;z-index:2;border:0;background:#eef2f7;width:42px;height:42px;border-radius:12px;font-size:23px}
    .ulim-academy-detail-image73550963{display:block;width:100%;max-height:74vh;object-fit:contain;object-position:center;margin:4px auto 20px;border-radius:17px;background:#f8fafc}
    .ulim-academy-detail-title73550963{clear:both;font-size:29px;font-weight:950;margin:3px 0 8px}.ulim-academy-detail-sub73550963{color:#14705c;font-weight:900;margin:0 0 15px}.ulim-academy-detail-body73550963{white-space:pre-wrap;line-height:1.85;color:#334155}
    @media(max-width:540px){.ulim-academy-teacher-grid73550963{grid-template-columns:1fr}.ulim-academy-teacher-face73550963,.ulim-academy-teacher-placeholder73550963{width:76px;height:76px;flex-basis:76px}.ulim-academy-curr-tabs73550963{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.ulim-academy-curr-tab73550963{width:100%;padding:12px 8px;font-size:13px}.ulim-academy-detail-panel73550963{padding:17px}}
  `;
  document.head.appendChild(style);
  modal=document.createElement('div');
  modal.id='ulimAcademyDetailModal73550963';
  modal.className='ulim-academy-detail-modal73550963';
  modal.innerHTML='<div class="ulim-academy-detail-backdrop73550963" data-academy-detail-close73550963="1"></div><section class="ulim-academy-detail-panel73550963"><button type="button" class="ulim-academy-detail-close73550963" data-academy-detail-close73550963="1">×</button><div id="ulimAcademyDetailBody73550963"></div></section>';
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target.closest('[data-academy-detail-close73550963="1"]'))modal.classList.remove('open');});
  return modal;
}
function curriculumClassTabLabel73550964(item){
  let label=text(item&&item.className)||text(item&&item.label)||text(item&&item.classId)||'반';
  label=label.replace(/^\\[[^\\]]+\\]\\s*[-–—]?\\s*/,'');
  label=label.replace(/^(월|화|수|목|금|토|일)요일\\s+/,'');
  label=label.replace(/\\s+\\d{1,2}:\\d{2}\\s*[~～-]\\s*\\d{1,2}:\\d{2}\\s*$/,'');
  label=label.replace(/\\s{2,}/g,' ').trim();
  return label||text(item&&item.label)||'반';
}
function curriculumInstructorGroups73550964(items){
  const map=new Map();
  (Array.isArray(items)?items:[]).forEach(item=>{
    if(!item)return;
    const instructor=text(item.instructorName)||'담당강사 미지정';
    if(!map.has(instructor))map.set(instructor,{instructorName:instructor,classes:[]});
    map.get(instructor).classes.push(item);
  });
  return Array.from(map.values());
}
function ensureCurriculumInstructorStyle73550964(){
  if(document.getElementById('ulimCurriculumInstructorStyle73550964'))return;
  const style=document.createElement('style');
  style.id='ulimCurriculumInstructorStyle73550964';
  style.textContent=`
    .ulim-curriculum-teacher-list73550964{display:flex;flex-wrap:wrap;gap:10px;margin-top:15px}
    .ulim-curriculum-teacher73550964{border:1px solid #b9ddd2;background:#fff;color:#14705c;border-radius:999px;padding:13px 21px;font-size:17px;font-weight:950;box-shadow:0 5px 14px rgba(20,112,92,.06)}
    .ulim-curriculum-teacher73550964:hover,.ulim-curriculum-teacher73550964:focus-visible{background:#eefaf6;border-color:#65c8ae;outline:none}
    .ulim-curriculum-popup-title73550964{clear:both;margin:2px 0 14px;font-size:28px;font-weight:950;color:#0f172a}
    .ulim-curriculum-class-tabs73550964{display:flex;gap:8px;overflow-x:auto;padding:2px 0 12px;margin-bottom:12px;scrollbar-width:thin}
    .ulim-curriculum-class-tab73550964{flex:0 0 auto;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:999px;padding:10px 15px;font-weight:900;white-space:nowrap}
    .ulim-curriculum-class-tab73550964.active{background:#14705c;color:#fff;border-color:#14705c}
    .ulim-curriculum-image73550964{display:block;width:100%;max-height:68vh;object-fit:contain;object-position:center;margin:0 auto;border-radius:16px;background:#f8fafc}
    .ulim-curriculum-empty73550964{padding:28px 16px;border:1px dashed #cbd5e1;border-radius:14px;text-align:center;color:#64748b;background:#f8fafc}
    .ulim-curriculum-class-caption73550964{margin:12px 2px 0;color:#64748b;font-size:13px;line-height:1.55}
    @media(max-width:540px){
      .ulim-curriculum-teacher-list73550964{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .ulim-curriculum-teacher73550964{width:100%;font-size:14px;padding:12px 8px}
      .ulim-curriculum-popup-title73550964{font-size:23px}
      .ulim-curriculum-class-tab73550964{font-size:13px;padding:9px 12px}
    }
  `;
  document.head.appendChild(style);
}
function renderCurriculumClass73550964(group,index){
  const item=group&&Array.isArray(group.classes)?group.classes[index]:null;
  const host=document.getElementById('ulimCurriculumClassBody73550964');
  if(!host||!item)return;
  document.querySelectorAll('[data-curriculum-class-tab73550964]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.curriculumClassTab73550964)===index));
  const image=safeImageUrl(item.imageUrl);
  const label=curriculumClassTabLabel73550964(item);
  host.innerHTML=image
    ? '<img class="ulim-curriculum-image73550964" src="'+esc(image)+'" alt="'+esc(label)+'">'+(item.detail?'<div class="ulim-curriculum-class-caption73550964">'+esc(item.detail)+'</div>':'')
    : '<div class="ulim-curriculum-empty73550964">등록된 커리큘럼 이미지가 없습니다.</div>';
}
function openCurriculumInstructor73550964(group){
  ensureCurriculumInstructorStyle73550964();
  const modal=ensureAcademyDetailModal73550963();
  const classes=group&&Array.isArray(group.classes)?group.classes:[];
  const tabs=classes.map((item,i)=>'<button type="button" class="ulim-curriculum-class-tab73550964'+(i===0?' active':'')+'" data-curriculum-class-tab73550964="'+i+'">'+esc(curriculumClassTabLabel73550964(item))+'</button>').join('');
  document.getElementById('ulimAcademyDetailBody73550963').innerHTML=
    '<h3 class="ulim-curriculum-popup-title73550964">'+esc(group&&group.instructorName||'담당강사')+'</h3>'+
    '<div class="ulim-curriculum-class-tabs73550964">'+tabs+'</div>'+
    '<div id="ulimCurriculumClassBody73550964"></div>';
  document.querySelectorAll('[data-curriculum-class-tab73550964]').forEach(btn=>btn.addEventListener('click',()=>renderCurriculumClass73550964(group,Number(btn.dataset.curriculumClassTab73550964))));
  modal.classList.add('open');
  if(classes.length)renderCurriculumClass73550964(group,0);
}
function openAcademyDetail73550963(item,type){
  if(type==='curriculum'&&item&&Array.isArray(item.classes)){
    openCurriculumInstructor73550964(item);
    return;
  }
  const modal=ensureAcademyDetailModal73550963();
  const title=type==='teachers'?text(item.name):text(item.label||item.className||item.classId);
  const image=safeImageUrl(item.imageUrl||item.thumbnailUrl);
  let html='';
  if(image)html+='<img class="ulim-academy-detail-image73550963" src="'+esc(image)+'" alt="'+esc(title)+'">';
  html+='<h3 class="ulim-academy-detail-title73550963">'+esc(title)+'</h3>';
  if(item.summary)html+='<div class="ulim-academy-detail-sub73550963">'+esc(item.summary)+'</div>';
  if(item.detail)html+='<div class="ulim-academy-detail-body73550963">'+esc(item.detail)+'</div>';
  document.getElementById('ulimAcademyDetailBody73550963').innerHTML=html;
  modal.classList.add('open');
}
function renderAcademySpecialBody73550963(meta){
  const rest=text(meta&&meta.__rest);
  let html=rest?'<div style="white-space:pre-wrap;line-height:1.75;color:#334155;margin-bottom:12px">'+esc(rest)+'</div>':'';
  const items=Array.isArray(meta&&meta.items)?meta.items:[];
  if(meta.type==='teachers'){
    const rows=items.filter(x=>x&&text(x.name));
    html+='<div class="ulim-academy-teacher-grid73550963">'+rows.map((x,i)=>{const face=safeImageUrl(x.thumbnailUrl||x.imageUrl);return '<button type="button" class="ulim-academy-teacher-card73550963" data-teacher-special73550963="'+i+'">'+(face?'<img class="ulim-academy-teacher-face73550963" src="'+esc(face)+'" alt="'+esc(x.name)+'">':'<span class="ulim-academy-teacher-placeholder73550963">🎙</span>')+'<span><span class="ulim-academy-teacher-name73550963">'+esc(x.name)+'</span>'+(x.summary?'<span class="ulim-academy-teacher-summary73550963">'+esc(x.summary)+'</span>':'')+'</span></button>';}).join('')+'</div>';
    return {html,items:rows,type:'teachers'};
  }
  if(meta.type==='curriculum'){
    ensureCurriculumInstructorStyle73550964();
    const rows=items.filter(x=>x&&text(x.instructorName||x.label||x.className||x.classId));
    const groups=curriculumInstructorGroups73550964(rows);
    html+='<div class="ulim-curriculum-teacher-list73550964">'+groups.map((g,i)=>'<button type="button" class="ulim-curriculum-teacher73550964" data-curr-special73550963="'+i+'">'+esc(g.instructorName)+'</button>').join('')+'</div>';
    return {html,items:groups,type:'curriculum'};
  }
  return null;
}

function renderAcademy(){
  const host=document.getElementById('academyContent73550937'); if(!host||!config) return;
  const pages=Array.isArray(config.academyPages)&&config.academyPages.length?config.academyPages:[{title:'학원소개',body:'울림 성우·스피치·연기학원에 오신 것을 환영합니다.'}];
  academyIndex=Math.max(0,Math.min(academyIndex,pages.length-1));
  const page=pages[academyIndex]||{};
  const special=parseAcademySpecialMeta73550963(page.body);
  const specialView=special&&['teachers','curriculum'].includes(special.type)?renderAcademySpecialBody73550963(special):null;
  const image=!specialView?safeImageUrl(page.imageUrl):'';
  host.innerHTML='<div class="academy-nav">'+pages.map((p,i)=>'<button type="button" class="academy-chip'+(i===academyIndex?' active':'')+'" data-academy-index="'+i+'">'+esc(p.title||('안내 '+(i+1)))+'</button>').join('')+'</div>'+
    '<div class="card">'+(image?'<img class="info-image" src="'+esc(image)+'" alt="">':'')+'<h2 class="page-title">'+esc(page.title||'학원안내')+'</h2><div class="body-text">'+(specialView?specialView.html:esc(page.body||'').replace(/\n/g,'<br>'))+'</div>'+
    '<div class="academy-actions"><button type="button" class="prev" id="academyPrev73550937"'+(academyIndex===0?' disabled':'')+'>이전</button><button type="button" class="next" id="academyNext73550937">'+(academyIndex===pages.length-1?'수강신청 보기':'다음')+'</button></div></div>';
  host.querySelectorAll('[data-academy-index]').forEach(btn=>btn.addEventListener('click',()=>{academyIndex=Number(btn.dataset.academyIndex)||0;renderAcademy();}));
  document.getElementById('academyPrev73550937')?.addEventListener('click',()=>{academyIndex=Math.max(0,academyIndex-1);renderAcademy();});
  document.getElementById('academyNext73550937')?.addEventListener('click',()=>{if(academyIndex>=pages.length-1)setTopTab('apply');else{academyIndex++;renderAcademy();}});
  if(specialView&&specialView.type==='teachers'){
    host.querySelectorAll('[data-teacher-special73550963]').forEach(btn=>btn.addEventListener('click',()=>openAcademyDetail73550963(specialView.items[Number(btn.dataset.teacherSpecial73550963)]||{},'teachers')));
  }
  if(specialView&&specialView.type==='curriculum'){
    host.querySelectorAll('[data-curr-special73550963]').forEach(btn=>btn.addEventListener('click',()=>openAcademyDetail73550963(specialView.items[Number(btn.dataset.currSpecial73550963)]||{},'curriculum')));
  }
}

function choicesHtml(name, values, selected){
  return '<div class="choice-grid">'+values.map((v,i)=>'<label class="choice"><input type="radio" name="'+esc(name)+'" value="'+esc(v)+'"'+(selected===v?' checked':'')+'><span>'+esc(v)+'</span></label>').join('')+'</div>';
}
function yesNoHtml(name,value){
  return '<div class="radio-row"><label class="radio-card"><input type="radio" name="'+name+'" value="yes"'+(value===true?' checked':'')+'> 동의함</label><label class="radio-card"><input type="radio" name="'+name+'" value="no"'+(value===false?' checked':'')+'> 동의하지 않음</label></div>';
}
function selectedClassNames(){ const ids=new Set(form.classIds); return (config.classes||[]).filter(c=>ids.has(text(c.classId))).map(c=>text(c.className)).filter(Boolean); }
function registrationDisabledHtml(){ return '<div class="card"><h2 class="page-title">신규 수강신청</h2><div class="notice">현재 온라인 신규 수강신청 접수 준비 중입니다. 등록을 원하시면 학원 데스크로 문의해주세요.</div></div>'; }

function renderApplication(){
  const host=document.getElementById('applicationContent73550937'); if(!host||!config) return;
  if(config.active!==true){ host.innerHTML=registrationDisabledHtml(); return; }
  const steps=activeSteps(); const step=currentStep(); const progress=((stepIndex+1)/steps.length)*100;
  let body='';
  if(step.id==='name') body='<div class="field"><label>수강생 이름</label><input id="nrName73550937" autocomplete="name" maxlength="50" value="'+esc(form.name)+'" placeholder="예: 홍길동"></div>';
  if(step.id==='birth') body='<div class="field"><label>생년월일</label><input id="nrBirth73550937" type="date" value="'+esc(form.birthDate)+'"></div><div class="hint">생년월일에 따라 미성년자는 다음 단계에서 보호자 연락처를 입력합니다.</div>';
  if(step.id==='guardian') body='<div class="field"><label>보호자 전화번호</label><input id="nrGuardian73550937" inputmode="tel" autocomplete="tel" maxlength="30" value="'+esc(form.parentPhone)+'" placeholder="010-0000-0000"></div>';
  if(step.id==='phone') body='<div class="field"><label>본인 전화번호</label><input id="nrPhone73550937" inputmode="tel" autocomplete="tel" maxlength="30" value="'+esc(form.studentPhone)+'" placeholder="010-0000-0000"></div><div class="hint">등록 완료 후 울림앱 최초 비밀번호는 본인 전화번호 뒤 4자리로 생성됩니다.</div>';
  if(step.id==='discovery'){
    const values=optionList(config.applicationContent&&config.applicationContent.discoveryOptions);
    body=choicesHtml('nrDiscovery73550937',values,form.discoverySource)+(form.discoverySource==='기타'?'<div class="field"><label>기타 경로</label><input id="nrDiscoveryEtc73550937" maxlength="100" value="'+esc(form.discoveryEtc)+'" placeholder="알게 된 경로를 입력해주세요"></div>':'');
  }
  if(step.id==='payment') body=choicesHtml('nrPayment73550937',optionList(config.applicationContent&&config.applicationContent.paymentOptions),form.paymentMethod);
  if(step.id==='refund') body='<div class="policy">'+esc(policy('refundPolicy','환불 규정을 확인해주세요.')).replace(/\n/g,'<br>')+'</div><label class="choice" style="margin-top:12px"><input id="nrRefund73550937" type="checkbox"'+(form.refundPolicyAccepted?' checked':'')+'><span>환불 규정에 관한 설명과 내용을 확인했습니다.</span></label>';
  if(step.id==='privacy') body='<div class="policy">'+esc(policy('privacyPolicy','개인정보 수집 및 이용 내용을 확인해주세요.')).replace(/\n/g,'<br>')+'</div><label class="choice" style="margin-top:12px"><input id="nrPrivacy73550937" type="checkbox"'+(form.privacyConsent?' checked':'')+'><span>개인정보 수집 및 이용에 동의합니다. (필수)</span></label>';
  if(step.id==='portrait') body='<div class="policy">'+esc(policy('portraitPolicy','교육과정 중 촬영되는 사진 및 영상 활용 동의 여부를 선택해주세요.')).replace(/\n/g,'<br>')+'</div><div style="height:12px"></div>'+yesNoHtml('nrPortrait73550937',form.portraitConsent);
  if(step.id==='voice') body='<div class="policy">'+esc(policy('voicePolicy','수업 및 연습 과정에서 생성되는 음성파일의 활용 범위를 선택해주세요.')).replace(/\n/g,'<br>')+'</div><div class="field"><label>발성·연기 샘플링 및 내부 교육자료 활용</label>'+yesNoHtml('nrVoiceSample73550937',form.voiceSamplingConsent)+'</div><div class="field"><label>울림 유튜브·인스타그램 등 SNS 업로드</label>'+yesNoHtml('nrVoiceSocial73550937',form.voiceSocialUploadConsent)+'</div><div class="field"><label>오디션·캐스팅 등 외부 업체에 샘플 전달</label>'+yesNoHtml('nrVoiceExternal73550937',form.voiceExternalSampleConsent)+'</div>';
  if(step.id==='rules') body='<div class="policy">'+esc(policy('academyRules','학원 이용 시 주의사항을 확인해주세요.')).replace(/\n/g,'<br>')+'</div><label class="choice" style="margin-top:12px"><input id="nrRules73550937" type="checkbox"'+(form.rulesAccepted?' checked':'')+'><span>학원 이용 및 수업 운영 주의사항을 확인했습니다.</span></label>';
  if(step.id==='signature') body='<div class="field"><label>'+(isMinor()?'보호자 서명자 성명':'신청자 성명')+'</label><input id="nrSigner73550937" maxlength="50" value="'+esc(form.signerName||form.name)+'"></div><div class="signature-wrap"><canvas id="nrSignature73550937" width="900" height="360" aria-label="서명 영역"></canvas><div class="sig-actions"><button type="button" id="nrSignatureClear73550937">서명 지우기</button></div></div><div class="hint">위 영역에 손가락 또는 마우스로 직접 서명해주세요.</div>';
  if(step.id==='classes'){
    const selected=new Set(form.classIds); const classes=Array.isArray(config.classes)?config.classes:[];
    body=classes.length?'<div class="class-list">'+classes.map(c=>'<label class="class-card"><input type="checkbox" data-class-id="'+esc(c.classId)+'"'+(selected.has(text(c.classId))?' checked':'')+'><span><b>'+esc(c.className)+'</b><small>'+esc(c.instructorName?('담당 '+c.instructorName):'담당강사 안내 예정')+'</small></span></label>').join('')+'</div>':'<div class="notice">현재 온라인에서 선택 가능한 반이 없습니다. 관리자에게 모집반 설정을 요청해주세요.</div>';
  }
  if(step.id==='review'){
    const voice='샘플링 '+boolLabel(form.voiceSamplingConsent)+' · SNS '+boolLabel(form.voiceSocialUploadConsent)+' · 외부업체 '+boolLabel(form.voiceExternalSampleConsent);
    body='<div class="review"><div class="review-row"><b>이름</b><span>'+esc(form.name)+'</span></div><div class="review-row"><b>생년월일</b><span>'+esc(form.birthDate)+'</span></div>'+(isMinor()?'<div class="review-row"><b>보호자전화</b><span>'+esc(form.parentPhone)+'</span></div>':'')+'<div class="review-row"><b>본인전화</b><span>'+esc(form.studentPhone)+'</span></div><div class="review-row"><b>알게된 경로</b><span>'+esc(form.discoverySource+(form.discoveryEtc?' / '+form.discoveryEtc:''))+'</span></div><div class="review-row"><b>결제방법</b><span>'+esc(form.paymentMethod)+'</span></div><div class="review-row"><b>초상권</b><span>'+esc(boolLabel(form.portraitConsent))+'</span></div><div class="review-row"><b>음성파일</b><span>'+esc(voice)+'</span></div><div class="review-row"><b>수강반</b><span>'+esc(selectedClassNames().join(', '))+'</span></div><div class="review-row"><b>서명자</b><span>'+esc(form.signerName)+'</span></div></div>';
  }
  host.innerHTML='<div class="card"><div class="progress"><i style="width:'+progress.toFixed(1)+'%"></i></div><div class="progress-label">'+(stepIndex+1)+' / '+steps.length+'</div><h2 class="page-title">'+esc(step.title)+'</h2><p class="page-sub">'+esc(step.sub)+'</p>'+body+'<div class="actions"><button type="button" id="nrPrev73550937" class="prev"'+(stepIndex===0?' disabled':'')+'>이전</button>'+(step.id==='review'?'<button type="button" id="nrSubmit73550937" class="next">신청 완료</button>':'<button type="button" id="nrNext73550937" class="next">다음</button>')+'</div></div>';
  bindStep(step.id);
}

function radioValue(name){ const el=document.querySelector('input[name="'+name+'"]:checked'); return el?text(el.value):''; }
function yesNoValue(name){ const v=radioValue(name); return v==='yes'?true:v==='no'?false:null; }
function captureStep(id){
  if(id==='name') form.name=text(document.getElementById('nrName73550937')?.value);
  if(id==='birth') form.birthDate=text(document.getElementById('nrBirth73550937')?.value);
  if(id==='guardian') form.parentPhone=text(document.getElementById('nrGuardian73550937')?.value);
  if(id==='phone') form.studentPhone=text(document.getElementById('nrPhone73550937')?.value);
  if(id==='discovery'){ form.discoverySource=radioValue('nrDiscovery73550937')||form.discoverySource; form.discoveryEtc=text(document.getElementById('nrDiscoveryEtc73550937')?.value)||form.discoveryEtc; }
  if(id==='payment') form.paymentMethod=radioValue('nrPayment73550937')||form.paymentMethod;
  if(id==='refund') form.refundPolicyAccepted=!!document.getElementById('nrRefund73550937')?.checked;
  if(id==='privacy') form.privacyConsent=!!document.getElementById('nrPrivacy73550937')?.checked;
  if(id==='portrait') form.portraitConsent=yesNoValue('nrPortrait73550937');
  if(id==='voice'){ form.voiceSamplingConsent=yesNoValue('nrVoiceSample73550937'); form.voiceSocialUploadConsent=yesNoValue('nrVoiceSocial73550937'); form.voiceExternalSampleConsent=yesNoValue('nrVoiceExternal73550937'); }
  if(id==='rules') form.rulesAccepted=!!document.getElementById('nrRules73550937')?.checked;
  if(id==='signature'){ form.signerName=text(document.getElementById('nrSigner73550937')?.value); if(signatureCanvas&&signatureHasInk) form.signatureDataUrl=signatureCanvas.toDataURL('image/png'); }
  if(id==='classes') form.classIds=Array.from(document.querySelectorAll('[data-class-id]:checked')).map(el=>text(el.dataset.classId)).filter(Boolean);
}
function validateStep(id){
  captureStep(id);
  if(id==='name'&&!form.name) return '이름을 입력해주세요.';
  if(id==='birth'&&!/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate)) return '생년월일을 입력해주세요.';
  if(id==='guardian'&&digits(form.parentPhone).length<10) return '보호자 전화번호를 정확히 입력해주세요.';
  if(id==='phone'&&digits(form.studentPhone).length<10) return '본인 전화번호를 정확히 입력해주세요.';
  if(id==='discovery'&&!form.discoverySource) return '학원을 알게 된 경로를 선택해주세요.';
  if(id==='discovery'&&form.discoverySource==='기타'&&!form.discoveryEtc) return '기타 경로를 입력해주세요.';
  if(id==='payment'&&!form.paymentMethod) return '결제 방법을 선택해주세요.';
  if(id==='refund'&&!form.refundPolicyAccepted) return '환불 규정 확인에 체크해주세요.';
  if(id==='privacy'&&!form.privacyConsent) return '개인정보 수집 및 이용 동의가 필요합니다.';
  if(id==='portrait'&&form.portraitConsent===null) return '초상권 동의 여부를 선택해주세요.';
  if(id==='voice'&&(form.voiceSamplingConsent===null||form.voiceSocialUploadConsent===null||form.voiceExternalSampleConsent===null)) return '음성파일 활용 항목별 동의 여부를 모두 선택해주세요.';
  if(id==='rules'&&!form.rulesAccepted) return '학원 이용 주의사항 확인에 체크해주세요.';
  if(id==='signature'&&!form.signerName) return '서명자 성명을 입력해주세요.';
  if(id==='signature'&&!signatureHasInk&&!form.signatureDataUrl) return '서명을 작성해주세요.';
  if(id==='classes'&&!form.classIds.length) return '수강할 반을 하나 이상 선택해주세요.';
  return '';
}
function bindStep(id){
  document.getElementById('nrPrev73550937')?.addEventListener('click',()=>{captureStep(id);stepIndex=Math.max(0,stepIndex-1);renderApplication();});
  document.getElementById('nrNext73550937')?.addEventListener('click',()=>{const err=validateStep(id);if(err)return alert(err);stepIndex=Math.min(activeSteps().length-1,stepIndex+1);renderApplication();});
  document.getElementById('nrSubmit73550937')?.addEventListener('click',submitRegistration);
  if(id==='birth') document.getElementById('nrBirth73550937')?.addEventListener('change',e=>{form.birthDate=text(e.target.value);});
  if(id==='discovery') document.querySelectorAll('input[name="nrDiscovery73550937"]').forEach(el=>el.addEventListener('change',()=>{form.discoverySource=radioValue('nrDiscovery73550937');renderApplication();}));
  if(id==='signature') setupSignature();
}
function canvasPoint(event){ const rect=signatureCanvas.getBoundingClientRect(); const p=event.touches&&event.touches[0]?event.touches[0]:event; return {x:(p.clientX-rect.left)*(signatureCanvas.width/rect.width),y:(p.clientY-rect.top)*(signatureCanvas.height/rect.height)}; }
function setupSignature(){
  signatureCanvas=document.getElementById('nrSignature73550937'); if(!signatureCanvas) return; signatureCtx=signatureCanvas.getContext('2d'); signatureCtx.lineWidth=4; signatureCtx.lineCap='round'; signatureCtx.strokeStyle='#0f172a'; signatureHasInk=false;
  if(form.signatureDataUrl){ const img=new Image(); img.onload=()=>{signatureCtx.drawImage(img,0,0,signatureCanvas.width,signatureCanvas.height);signatureHasInk=true;}; img.src=form.signatureDataUrl; }
  const start=e=>{e.preventDefault();drawing=true;lastPoint=canvasPoint(e);}; const move=e=>{if(!drawing)return;e.preventDefault();const p=canvasPoint(e);signatureCtx.beginPath();signatureCtx.moveTo(lastPoint.x,lastPoint.y);signatureCtx.lineTo(p.x,p.y);signatureCtx.stroke();lastPoint=p;signatureHasInk=true;}; const end=e=>{if(drawing)e.preventDefault();drawing=false;lastPoint=null;};
  ['pointerdown'].forEach(t=>signatureCanvas.addEventListener(t,start)); ['pointermove'].forEach(t=>signatureCanvas.addEventListener(t,move)); ['pointerup','pointercancel','pointerleave'].forEach(t=>signatureCanvas.addEventListener(t,end));
  document.getElementById('nrSignatureClear73550937')?.addEventListener('click',()=>{signatureCtx.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);signatureHasInk=false;form.signatureDataUrl='';});
}

async function submitRegistration(){
  const err=validateStep('review'); if(err)return alert(err);
  if(!confirm('확인한 내용으로 신규 수강등록을 완료할까요?')) return;
  const payload={...form, submissionId:requestId('new-student-73550937'), clientVersion:VERSION};
  showLoading('신규 수강등록을 처리하고 있습니다...');
  try{
    const result=await call('submitNewStudentRegistration73550937',payload);
    const host=document.getElementById('applicationContent73550937');
    host.innerHTML='<div class="card success"><div class="check">✓</div><h2>수강등록이 완료되었습니다.</h2><p><b>'+esc(form.name)+'</b> 학생이 울림앱 학생명단과 선택한 수강반에 신규 등록되었습니다.<br>출결번호 '+esc(result.attendanceNo||'')+' · 최초 비밀번호 '+esc(result.initialPassword||result.attendanceNo||'')+'</p><div class="notice">울림앱 로그인 시 이름과 최초 비밀번호를 사용해주세요. 최초 로그인 후 비밀번호 변경 안내가 표시될 수 있습니다.</div></div>';
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(error){ alert(callableMessage(error,'수강등록을 완료하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해주세요.')); }
  finally{hideLoading();}
}

async function load(){
  showLoading('학원안내와 수강신청 정보를 불러오는 중...');
  const loadingFailsafe73550951=setTimeout(hideLoading,28000);
  try{
    config=await call('getPublicNewStudentRegistration73550937',{requestId:requestId('new-student-config-73550937')});
    document.getElementById('publicTitle73550937').textContent=text(config.publicTitle)||'울림 성우·스피치·연기학원';
    renderAcademy(); renderApplication();
  }catch(error){
    const host=document.getElementById('academyContent73550937'); if(host) host.innerHTML='<div class="card"><h2 class="page-title">페이지를 불러오지 못했습니다.</h2><div class="notice">잠시 후 다시 접속해주세요.</div></div>';
  }finally{clearTimeout(loadingFailsafe73550951);hideLoading();}
}

document.querySelectorAll('[data-top-tab]').forEach(btn=>btn.addEventListener('click',()=>setTopTab(btn.dataset.topTab)));
load();
