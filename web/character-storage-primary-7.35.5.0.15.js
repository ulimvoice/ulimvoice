(function(global){
'use strict';
if(global.__ULIM_CHARACTER_STORAGE_PRIMARY_73551015__)return;
global.__ULIM_CHARACTER_STORAGE_PRIMARY_73551015__=true;

const VERSION='2026-09-09.73551015-character-public-meta-only';
const CALLABLE='characterCatalog73551015';
const TTL=30000;
let catalogCache=[],catalogLoadedAt=0,selectionCache=null,selectionLoadedAt=0,adminCatalog73551015=[];

function text(v){return String(v==null?'':v).trim();}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function norm(v){return text(v).normalize('NFKC').toLowerCase().replace(/\s+/g,'');}
function rid(p){return p+'-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
function room(){return global.ULIM_ROOM_CLASSROOM_REALTIME_72919||global.ULIM_ROOM_CLASSROOM_REALTIME_72918||global.ULIM_ROOM_CLASSROOM_REALTIME_72917||global.ULIM_ROOM_CLASSROOM_REALTIME_72916||global.ULIM_ROOM_CLASSROOM_REALTIME_729||null;}
async function runtime(){const r=room();if(!r||typeof r.preloadRuntime!=='function')throw new Error('캐릭터 Firebase 기능을 준비하지 못했습니다.');const rt=await r.preloadRuntime();if(!rt||!rt.auth||!rt.auth.currentUser||!rt.sdk||!rt.functions)throw new Error('로그인이 필요합니다.');return rt;}
async function call(action,payload){const rt=await runtime();const fn=rt.sdk.httpsCallable(rt.functions,CALLABLE);const resp=await fn(Object.assign({action,requestId:rid('CHAR73551015')},payload||{}));return resp&&resp.data||{};}
function studentSessionActive73551015(){const api=global.__ULIM_STUDENT_FIREBASE_DIRECT_AUTH_7355030__;try{return !!(api&&typeof api.hasValidatedSession==='function'&&api.hasValidatedSession());}catch(_e){return false;}}
function adminInfo(){return global.adminInfo&&typeof global.adminInfo==='object'?global.adminInfo:{};}
function fullAdmin(){
  if(studentSessionActive73551015())return false;
  if(global.__ULIM_STAFF_FIREBASE_SESSION_READY_7329__!==true)return false;
  const i=adminInfo(),r=norm(i.firebaseRole);
  return r==='admin'||r==='superadmin';
}
function hideAdminUi73551015(){const u=document.getElementById('characterAdminUploader73551015');if(u)u.style.display='none';try{closeManager73551015();}catch(_e){}}
function genderLabel(v){return v==='male'?'남성':(v==='female'?'여성':'성별 무관');}
function ageLabel(v){return ({child:'아동',teen:'10대','20s':'20대','30s':'30대','40s':'40대','50plus':'50대 이상',all:'나이 무관'})[v]||'나이 무관';}

async function listCatalog(force,includeInactive){
  const now=Date.now();
  if(!force&&!includeInactive&&catalogCache.length&&now-catalogLoadedAt<TTL)return catalogCache.slice();
  const d=await call('list',{includeInactive:includeInactive===true});
  const items=Array.isArray(d.items)?d.items:[];
  if(!includeInactive){catalogCache=items.slice();catalogLoadedAt=now;}
  return items;
}
async function getSelection(force){
  const now=Date.now();
  if(!force&&selectionCache&&now-selectionLoadedAt<TTL)return selectionCache;
  const d=await call('getSelection',{});
  selectionCache=d&&d.selection&&text(d.selection.characterId)?d.selection:null;
  selectionLoadedAt=now;
  global.__ULIM_SELECTED_CHARACTER_73551015__=selectionCache;
  return selectionCache;
}
async function saveSelection(characterId){
  const out=await call('saveSelection',{characterId:text(characterId)});
  selectionLoadedAt=0;
  const s=await getSelection(true);
  renderSaved(s);renderPast(s);
  return out;
}
async function linkCurrentSelectionToPracticeRecord(recordId){
  const id=text(recordId);if(!id)return {linked:false,reason:'missing-record-id'};
  const s=global.__ULIM_SELECTED_CHARACTER_73551015__||await getSelection(false);
  if(!s||!text(s.characterId))return {linked:false,reason:'no-selection'};
  return call('linkPracticeRecord',{recordId:id,characterId:text(s.characterId)});
}
async function hydratePracticeRecords(logs){
  const rows=Array.isArray(logs)?logs:[];
  const ids=Array.from(new Set(rows.map(x=>text(x&&x.recordId)).filter(Boolean))).slice(0,100);
  if(!ids.length)return rows;
  let d;try{d=await call('getPracticeLinks',{recordIds:ids});}catch(_e){return rows;}
  const links=d&&d.links&&typeof d.links==='object'?d.links:{};
  return rows.map(log=>{const c=links[text(log&&log.recordId)];return c?Object.assign({},log,{character73551015:c}):log;});
}

function fileToDataUrl(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=()=>rej(new Error('이미지 파일을 읽지 못했습니다.'));r.onload=()=>res(String(r.result||''));r.readAsDataURL(blob);});}
function loadImage(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);res(img);};img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('이미지를 열지 못했습니다.'));};img.src=u;});}
function canvasBlob(c,t,q){return new Promise(res=>c.toBlob(res,t,q));}
async function compressImage(file){
  if(!file||!/^image\//i.test(text(file.type)))throw new Error('이미지 파일만 업로드할 수 있습니다.');
  if(Number(file.size||0)>20*1024*1024)throw new Error('원본 이미지는 20MB 이하만 업로드할 수 있습니다.');
  const img=await loadImage(file);
  let maxSide=900,quality=.86,last=null,w=0,h=0;
  for(let i=0;i<9;i++){
    const scale=Math.min(1,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d',{alpha:false});x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);
    last=await canvasBlob(c,'image/webp',quality);if(!last)last=await canvasBlob(c,'image/jpeg',quality);
    if(!last)throw new Error('이미지 압축에 실패했습니다.');
    if(last.size<=420*1024)break;
    maxSide=Math.max(480,Math.round(maxSide*.87));quality=Math.max(.60,quality-.06);
  }
  return {imageDataUrl:await fileToDataUrl(last),imageMime:text(last.type)||'image/webp',imageBytes:Number(last.size||0),width:w,height:h};
}
async function uploadFiles(files,meta,progress){
  const arr=Array.from(files||[]);if(!arr.length)throw new Error('업로드할 이미지를 선택해주세요.');
  const out=[];
  for(let i=0;i<arr.length;i++){
    const f=arr[i];if(progress)progress(i,arr.length,f.name);
    const c=await compressImage(f),base=text(meta&&meta.name),stem=text(f.name).replace(/\.[^.]+$/,'');
    const name=arr.length>1?(base?base+' '+(i+1):stem):(base||stem||'캐릭터');
    const d=await call('saveImage',Object.assign({},c,{name,sourceFilename:text(f.name),gender:text(meta&&meta.gender)||'all',ageGroup:text(meta&&meta.ageGroup)||'all',tags:Array.isArray(meta&&meta.tags)?meta.tags:[],description:text(meta&&meta.description)}));
    out.push(d.item||d);
  }
  catalogLoadedAt=0;await refreshCatalogUi(true);return out;
}

function currentFilters(){return {gender:text(document.getElementById('charGenderFilter73551015')?.value),ageGroup:text(document.getElementById('charAgeFilter73551015')?.value),tag:text(document.getElementById('charFeatureFilter73551015')?.value)};}
function filterItems(items,overrideGender){
  const f=currentFilters();if(overrideGender==='male'||overrideGender==='female')f.gender=overrideGender;
  return (items||[]).filter(i=>{const g=text(i.gender)||'all',a=text(i.ageGroup)||'all',tags=Array.isArray(i.tags)?i.tags.map(text):[];if(f.gender&&g!=='all'&&g!==f.gender)return false;if(f.ageGroup&&a!=='all'&&a!==f.ageGroup)return false;if(f.tag&&tags.indexOf(f.tag)<0)return false;return i.active!==false;});
}
function renderCurrent(item){
  const img=document.getElementById('charImgDisplay'),ph=document.querySelector('#characterCard .char-placeholder'),u=text(item&&item.imageUrl);
  if(img){img.src=u;img.style.display=u?'block':'none';}if(ph)ph.style.display=u?'none':'block';
  const n=document.getElementById('charNameDisplay'),j=document.getElementById('charJobDisplay');
  const tags=Array.isArray(item&&item.tags)?item.tags.filter(Boolean):[];
  if(n){n.textContent=text(item&&item.name)||'캐릭터';n.style.display=fullAdmin()?'block':'none';}
  if(j)j.textContent=[genderLabel(item&&item.gender),ageLabel(item&&item.ageGroup)].concat(tags.slice(0,3)).join(' · ');
}
function renderSaved(s){
  const g=document.getElementById('charSaveGrid');if(!g)return;if(!s){g.innerHTML='';return;}
  const showName=fullAdmin();
  g.innerHTML='<div class="mini-char-card character-saved-card73551015">'+(text(s.imageUrl)?'<img class="mini-char-img" src="'+esc(s.imageUrl)+'" alt="선택 캐릭터">':'')+'<div class="mini-char-info">'+(showName?'<b>'+esc(s.name||'선택 캐릭터')+'</b><br>':'')+'<span>'+esc([genderLabel(s.gender),ageLabel(s.ageGroup)].concat(s.tags||[]).join(' · '))+'</span><br><small>기출문제에 사용할 캐릭터</small></div></div>';
}
function renderPast(s){
  const b=document.getElementById('pastCharacterPreview73551015');if(!b)return;
  if(!s){b.innerHTML='<div class="past-character-empty73551015">캐릭터 뽑기에서 캐릭터를 저장하면 기출문제 대본 위에 표시됩니다.</div>';return;}
  const showName=fullAdmin();
  b.innerHTML='<div class="past-character-card73551015">'+(text(s.imageUrl)?'<img src="'+esc(s.imageUrl)+'" alt="선택 캐릭터">':'')+'<div><span>선택 캐릭터</span>'+(showName?'<b>'+esc(s.name||'캐릭터')+'</b>':'')+'<small>'+esc([genderLabel(s.gender),ageLabel(s.ageGroup)].concat(s.tags||[]).join(' · '))+'</small></div></div>';
}
async function refreshCatalogUi(force){
  let items=[];try{items=await listCatalog(force===true,false);}catch(e){const s=document.getElementById('charCatalogStatus73551015');if(s)s.textContent=text(e&&e.message)||'캐릭터 목록을 불러오지 못했습니다.';return [];}
  const st=document.getElementById('charCatalogStatus73551015');if(st)st.textContent=(fullAdmin()?'Storage 캐릭터 ':'캐릭터 ')+items.length+'개';
  const f=document.getElementById('charFeatureFilter73551015');if(f){const old=f.value,tags=Array.from(new Set(items.flatMap(i=>Array.isArray(i.tags)?i.tags.map(text):[]).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ko'));f.innerHTML='<option value="">특징 전체</option>'+tags.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');if(tags.includes(old))f.value=old;}
  if(fullAdmin())await renderAdminCatalog(items);return items;
}

function sourceFilename73551015(item){
  const raw=text(item&&item.sourceFilename);if(raw)return raw;
  const name=text(item&&item.name),m=/^캐릭터\s*(\d{1,4})$/i.exec(name);
  if(m){
    const seq=String(Number(m[1])||m[1]).padStart(3,'0');
    const g=item&&item.gender==='male'?'M':(item&&item.gender==='female'?'F':'ALL');
    const a=({child:'child',teen:'10s','20s':'20s','30s':'30s','40s':'40s','50plus':'50plus',all:'ALL'})[text(item&&item.ageGroup)]||'ALL';
    const tags=Array.isArray(item&&item.tags)?item.tags.map(text).filter(Boolean):[];
    return [seq,g,a,tags.join('+')||'특징'].join('_');
  }
  return name||text(item&&item.id)||'캐릭터';
}
function managerMeta73551015(item){
  return [genderLabel(item&&item.gender),ageLabel(item&&item.ageGroup)].concat(Array.isArray(item&&item.tags)?item.tags:[]).filter(Boolean).join(' · ');
}
function ensureManagerUi73551015(){
  if(document.getElementById('charManagerModal73551015'))return;
  if(!document.getElementById('charManagerStyle73551015')){
    const style=document.createElement('style');style.id='charManagerStyle73551015';style.textContent=`
#charAdminCatalog73551015{margin-top:10px}
.char-manager-open73551015{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:10px;padding:11px 16px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer}
.char-manager-open73551015 span{display:inline-flex;min-width:24px;height:24px;padding:0 7px;align-items:center;justify-content:center;border-radius:999px;background:rgba(255,255,255,.2);font-size:12px}
.char-manager-backdrop73551015{position:fixed;inset:0;z-index:120000;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;padding:22px}
.char-manager-backdrop73551015.open{display:flex}
.char-manager-panel73551015{width:min(980px,96vw);max-height:88vh;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(15,23,42,.28);overflow:hidden;display:flex;flex-direction:column}
.char-manager-head73551015{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #e5e7eb}
.char-manager-head73551015 h3{margin:0;font-size:19px}
.char-manager-head73551015 button{border:0;background:#f1f5f9;border-radius:9px;padding:8px 12px;cursor:pointer;font-weight:700}
.char-manager-status73551015{padding:10px 20px;font-size:13px;color:#475569;background:#f8fafc;border-bottom:1px solid #e5e7eb}
.char-manager-list73551015{padding:10px 14px 18px;overflow:auto}
.char-manager-row73551015{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px;align-items:center;padding:12px;border-bottom:1px solid #e5e7eb}
.char-manager-file73551015{border:0;background:transparent;padding:0;text-align:left;color:#1d4ed8;font-weight:800;font-size:14px;cursor:pointer;word-break:break-all}
.char-manager-file73551015:hover{text-decoration:underline}
.char-manager-sub73551015{display:block;margin-top:4px;font-size:12px;color:#64748b}
.char-manager-actions73551015{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.char-manager-actions73551015 button{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:7px 9px;font-size:12px;font-weight:700;cursor:pointer}
.char-manager-actions73551015 button:hover{background:#f8fafc}
.char-manager-actions73551015 .danger{border-color:#fecaca;color:#b91c1c}
.char-manager-actions73551015 .primary{border-color:#bfdbfe;color:#1d4ed8}
.char-manager-inactive73551015{opacity:.58}
.char-manager-empty73551015{padding:30px;text-align:center;color:#64748b}
.char-manager-preview73551015,.char-manager-edit73551015{position:absolute;inset:0;background:rgba(15,23,42,.72);display:none;align-items:center;justify-content:center;padding:24px}
.char-manager-preview73551015.open,.char-manager-edit73551015.open{display:flex}
.char-manager-preview-card73551015{max-width:92vw;max-height:90vh;background:#fff;border-radius:16px;padding:14px;box-shadow:0 24px 80px rgba(0,0,0,.35)}
.char-manager-preview-card73551015 img{display:block;max-width:86vw;max-height:76vh;object-fit:contain;border-radius:10px}
.char-manager-preview-title73551015{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px;font-weight:800}
.char-manager-preview-title73551015 button{border:0;background:#f1f5f9;border-radius:8px;padding:7px 10px;cursor:pointer}
.char-manager-edit-card73551015{width:min(540px,94vw);background:#fff;border-radius:16px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.35)}
.char-manager-edit-card73551015 h4{margin:0 0 14px;font-size:17px}
.char-manager-edit-grid73551015{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.char-manager-edit-grid73551015 label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:#475569}
.char-manager-edit-grid73551015 input,.char-manager-edit-grid73551015 select,.char-manager-edit-grid73551015 textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:9px;font:inherit}
.char-manager-edit-grid73551015 .wide{grid-column:1/-1}
.char-manager-edit-buttons73551015{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.char-manager-edit-buttons73551015 button{border:0;border-radius:9px;padding:9px 13px;font-weight:800;cursor:pointer}
.char-manager-edit-buttons73551015 .save{background:#2563eb;color:#fff}
.char-manager-edit-buttons73551015 .cancel{background:#f1f5f9;color:#334155}
@media(max-width:700px){.char-manager-row73551015{grid-template-columns:1fr}.char-manager-actions73551015{justify-content:flex-start}.char-manager-edit-grid73551015{grid-template-columns:1fr}.char-manager-edit-grid73551015 .wide{grid-column:auto}}
`;document.head.appendChild(style);
  }
  const modal=document.createElement('div');modal.id='charManagerModal73551015';modal.className='char-manager-backdrop73551015';
  modal.innerHTML=`<div class="char-manager-panel73551015" role="dialog" aria-modal="true" aria-label="업로드 현황">
    <div class="char-manager-head73551015"><h3>업로드 현황</h3><button type="button" data-char-manager-close73551015>닫기</button></div>
    <div id="charManagerStatus73551015" class="char-manager-status73551015"></div>
    <div id="charManagerList73551015" class="char-manager-list73551015"></div>
    <input id="charManagerReplaceInput73551015" type="file" accept="image/*" style="display:none">
    <div id="charManagerPreview73551015" class="char-manager-preview73551015"></div>
    <div id="charManagerEdit73551015" class="char-manager-edit73551015"></div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeManager73551015();});
  modal.querySelector('[data-char-manager-close73551015]')?.addEventListener('click',closeManager73551015);
  document.getElementById('charManagerReplaceInput73551015')?.addEventListener('change',replaceImageFromManager73551015);
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    const p=document.getElementById('charManagerPreview73551015'),ed=document.getElementById('charManagerEdit73551015'),m=document.getElementById('charManagerModal73551015');
    if(p&&p.classList.contains('open')){p.classList.remove('open');p.innerHTML='';return;}
    if(ed&&ed.classList.contains('open')){ed.classList.remove('open');ed.innerHTML='';return;}
    if(m&&m.classList.contains('open'))closeManager73551015();
  });
}
function closeManager73551015(){
  const m=document.getElementById('charManagerModal73551015');if(m)m.classList.remove('open');
  const p=document.getElementById('charManagerPreview73551015');if(p){p.classList.remove('open');p.innerHTML='';}
  const ed=document.getElementById('charManagerEdit73551015');if(ed){ed.classList.remove('open');ed.innerHTML='';}
}
function managerItem73551015(id){return adminCatalog73551015.find(x=>text(x&&x.id)===text(id))||null;}
function managerListHtml73551015(items){
  if(!items.length)return '<div class="char-manager-empty73551015">등록된 파일이 없습니다.</div>';
  return items.map(i=>`<div class="char-manager-row73551015 ${i.active===false?'char-manager-inactive73551015':''}">
    <div><button type="button" class="char-manager-file73551015" data-char-preview73551015="${esc(i.id)}">${esc(sourceFilename73551015(i))}</button><span class="char-manager-sub73551015">${esc(managerMeta73551015(i))}${i.active===false?' · 사용 중지':''}</span></div>
    <div class="char-manager-actions73551015">
      <button type="button" class="primary" data-char-edit73551015="${esc(i.id)}">속성변경</button>
      <button type="button" data-char-replace73551015="${esc(i.id)}">이미지 변경</button>
      <button type="button" data-char-toggle73551015="${esc(i.id)}" data-active73551015="${i.active===false?'0':'1'}">${i.active===false?'사용':'중지'}</button>
      <button type="button" class="danger" data-char-delete73551015="${esc(i.id)}">삭제</button>
    </div>
  </div>`).join('');
}
async function loadManagerList73551015(showStatus){
  const status=document.getElementById('charManagerStatus73551015'),list=document.getElementById('charManagerList73551015');
  if(showStatus&&status)status.textContent='목록을 불러오는 중입니다.';
  const d=await call('list',{includeInactive:true});
  adminCatalog73551015=Array.isArray(d.items)?d.items:[];
  if(status)status.textContent='등록 '+adminCatalog73551015.length+'개 · 파일명을 누르면 크게 볼 수 있습니다.';
  if(list){
    list.innerHTML=managerListHtml73551015(adminCatalog73551015);
    bindManagerRows73551015(list);
  }
  const holder=document.getElementById('charAdminCatalog73551015');
  const badge=holder&&holder.querySelector('[data-char-manager-count73551015]');if(badge)badge.textContent=String(adminCatalog73551015.length);
  return adminCatalog73551015;
}
function bindManagerRows73551015(root){
  root.querySelectorAll('[data-char-preview73551015]').forEach(btn=>btn.addEventListener('click',()=>openPreview73551015(btn.dataset.charPreview73551015)));
  root.querySelectorAll('[data-char-edit73551015]').forEach(btn=>btn.addEventListener('click',()=>openEdit73551015(btn.dataset.charEdit73551015)));
  root.querySelectorAll('[data-char-replace73551015]').forEach(btn=>btn.addEventListener('click',()=>{
    const inp=document.getElementById('charManagerReplaceInput73551015');if(!inp)return;inp.value='';inp.dataset.characterId=text(btn.dataset.charReplace73551015);inp.click();
  }));
  root.querySelectorAll('[data-char-toggle73551015]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;try{
      await call('setActive',{characterId:text(btn.dataset.charToggle73551015),active:btn.dataset.active73551015!=='1'});
      catalogLoadedAt=0;await refreshCatalogUi(true);await loadManagerList73551015(false);
    }catch(e){alert(text(e&&e.message)||'상태 변경에 실패했습니다.');}finally{btn.disabled=false;}
  }));
  root.querySelectorAll('[data-char-delete73551015]').forEach(btn=>btn.addEventListener('click',()=>deleteCharacterFromManager73551015(btn.dataset.charDelete73551015,btn)));
}
async function openManager73551015(){
  if(!fullAdmin())return;
  ensureManagerUi73551015();
  const m=document.getElementById('charManagerModal73551015');if(m)m.classList.add('open');
  try{await loadManagerList73551015(true);}catch(e){const s=document.getElementById('charManagerStatus73551015');if(s)s.textContent=text(e&&e.message)||'목록을 불러오지 못했습니다.';}
}
function openPreview73551015(id){
  const item=managerItem73551015(id),p=document.getElementById('charManagerPreview73551015');if(!item||!p)return;
  p.innerHTML=`<div class="char-manager-preview-card73551015"><div class="char-manager-preview-title73551015"><span>${esc(sourceFilename73551015(item))}</span><button type="button" data-char-preview-close73551015>닫기</button></div>${text(item.imageUrl)?'<img src="'+esc(item.imageUrl)+'" alt="'+esc(sourceFilename73551015(item))+'">':'<div class="char-manager-empty73551015">이미지가 없습니다.</div>'}</div>`;
  p.classList.add('open');p.querySelector('[data-char-preview-close73551015]')?.addEventListener('click',()=>{p.classList.remove('open');p.innerHTML='';});
  p.addEventListener('click',function once(e){if(e.target===p){p.classList.remove('open');p.innerHTML='';}p.removeEventListener('click',once);});
}
function openEdit73551015(id){
  const item=managerItem73551015(id),ed=document.getElementById('charManagerEdit73551015');if(!item||!ed)return;
  const tags=Array.isArray(item.tags)?item.tags.join(', '):'';
  ed.innerHTML=`<div class="char-manager-edit-card73551015"><h4>속성변경</h4><div class="char-manager-edit-grid73551015">
    <label class="wide">표시 파일명<input id="charManagerEditFilename73551015" value="${esc(sourceFilename73551015(item))}" maxlength="180"></label>
    <label>성별<select id="charManagerEditGender73551015"><option value="male">남성</option><option value="female">여성</option><option value="all">무관</option></select></label>
    <label>나이<select id="charManagerEditAge73551015"><option value="child">아동</option><option value="teen">10대</option><option value="20s">20대</option><option value="30s">30대</option><option value="40s">40대</option><option value="50plus">50대 이상</option><option value="all">무관</option></select></label>
    <label class="wide">특징<input id="charManagerEditTags73551015" value="${esc(tags)}" placeholder="열혈, 냉정, 카리스마"></label>
    <label class="wide">설명<textarea id="charManagerEditDescription73551015" rows="3">${esc(item.description||'')}</textarea></label>
  </div><div class="char-manager-edit-buttons73551015"><button type="button" class="cancel" data-char-edit-cancel73551015>취소</button><button type="button" class="save" data-char-edit-save73551015>저장</button></div></div>`;
  ed.classList.add('open');
  const g=document.getElementById('charManagerEditGender73551015'),a=document.getElementById('charManagerEditAge73551015');if(g)g.value=text(item.gender)||'all';if(a)a.value=text(item.ageGroup)||'all';
  ed.querySelector('[data-char-edit-cancel73551015]')?.addEventListener('click',()=>{ed.classList.remove('open');ed.innerHTML='';});
  ed.querySelector('[data-char-edit-save73551015]')?.addEventListener('click',async e=>{
    const btn=e.currentTarget;btn.disabled=true;try{
      const tagRaw=text(document.getElementById('charManagerEditTags73551015')?.value);
      const tags=tagRaw.split(/[,+＋，\n]+/).map(text).filter(Boolean).slice(0,12);
      await call('updateMetadata',{characterId:item.id,sourceFilename:text(document.getElementById('charManagerEditFilename73551015')?.value),gender:text(g&&g.value)||'all',ageGroup:text(a&&a.value)||'all',tags,description:text(document.getElementById('charManagerEditDescription73551015')?.value)});
      ed.classList.remove('open');ed.innerHTML='';catalogLoadedAt=0;await refreshCatalogUi(true);await loadManagerList73551015(false);
    }catch(err){alert(text(err&&err.message)||'속성 변경에 실패했습니다.');}finally{btn.disabled=false;}
  });
}
async function replaceImageFromManager73551015(e){
  const inp=e.currentTarget,file=inp&&inp.files&&inp.files[0],id=text(inp&&inp.dataset.characterId);if(!file||!id)return;
  const item=managerItem73551015(id);if(!item)return;
  if(!confirm(sourceFilename73551015(item)+' 이미지를 '+file.name+' 파일로 변경할까요?')){inp.value='';return;}
  const status=document.getElementById('charManagerStatus73551015');
  try{
    if(status)status.textContent='이미지를 변경하는 중입니다.';
    const c=await compressImage(file);
    await call('replaceImage',Object.assign({characterId:id,sourceFilename:text(file.name)},c));
    catalogLoadedAt=0;await refreshCatalogUi(true);await loadManagerList73551015(false);
    if(status)status.textContent='이미지 변경 완료 · '+file.name;
  }catch(err){if(status)status.textContent='이미지 변경 실패';alert(text(err&&err.message)||'이미지 변경에 실패했습니다.');}
  finally{inp.value='';}
}
async function deleteCharacterFromManager73551015(id,btn){
  const item=managerItem73551015(id);if(!item)return;
  if(!confirm(sourceFilename73551015(item)+' 파일을 삭제할까요?\n\n학생 저장 또는 기출문제 기록에 연결된 파일은 안전을 위해 삭제되지 않습니다.'))return;
  btn.disabled=true;const status=document.getElementById('charManagerStatus73551015');
  try{
    if(status)status.textContent='파일을 삭제하는 중입니다.';
    await call('deleteCharacter',{characterId:text(id)});
    catalogLoadedAt=0;await refreshCatalogUi(true);await loadManagerList73551015(false);
    if(status)status.textContent='파일 삭제 완료';
  }catch(err){if(status)status.textContent='파일 삭제 실패';alert(text(err&&err.message)||'파일 삭제에 실패했습니다.');}
  finally{btn.disabled=false;}
}
async function renderAdminCatalog(items){
  const b=document.getElementById('charAdminCatalog73551015');if(!b)return;
  ensureManagerUi73551015();
  const all=await call('list',{includeInactive:true}).then(d=>Array.isArray(d.items)?d.items:[]).catch(()=>items||[]);
  adminCatalog73551015=all;
  b.innerHTML='<button type="button" class="char-manager-open73551015" data-char-manager-open73551015>업로드 현황 <span data-char-manager-count73551015>'+all.length+'</span></button>';
  b.querySelector('[data-char-manager-open73551015]')?.addEventListener('click',openManager73551015);
}

async function rollFromUi(genderOverride){try{const items=await refreshCatalogUi(false),f=filterItems(items,genderOverride);if(!f.length)return alert('선택한 조건에 맞는 캐릭터가 없습니다.');const item=f[Math.floor(Math.random()*f.length)];global.currentChar=Object.assign({},item);try{currentChar=global.currentChar;}catch(_e){}renderCurrent(item);return item;}catch(e){alert(text(e&&e.message)||'캐릭터를 불러오지 못했습니다.');return null;}}
async function saveCurrentFromUi(){let i=global.currentChar||null;try{if(!i&&typeof currentChar!=='undefined')i=currentChar;}catch(_e){}if(!i||!text(i.id))return alert('먼저 캐릭터를 뽑아주세요.');try{await saveSelection(i.id);alert('이 캐릭터를 저장했습니다. 기출문제 대본 상단에도 표시됩니다.');return true;}catch(e){alert(text(e&&e.message)||'캐릭터 저장에 실패했습니다.');return false;}}
function uploadMeta(){const raw=text(document.getElementById('charUploadFeatures73551015')?.value);return {name:text(document.getElementById('charUploadName73551015')?.value),gender:text(document.getElementById('charUploadGender73551015')?.value)||'all',ageGroup:text(document.getElementById('charUploadAge73551015')?.value)||'all',tags:raw.split(/[,，\n]+/).map(text).filter(Boolean).slice(0,12),description:text(document.getElementById('charUploadDescription73551015')?.value)};}
function batchGender73551015(v){const k=norm(v);const m={m:'male',male:'male','남':'male','남성':'male',f:'female',female:'female','여':'female','여성':'female',all:'all','무관':'all'};return m[k]||'';}
function batchAge73551015(v){const k=norm(v);const m={child:'child','아동':'child',teen:'teen','10s':'teen','10대':'teen','20s':'20s','20대':'20s','30s':'30s','30대':'30s','40s':'40s','40대':'40s','50plus':'50plus','50+':'50plus','50대이상':'50plus','50대+':'50plus',all:'all','무관':'all'};return m[k]||'';}
function parseBatchFilename73551015(file){
  const filename=text(file&&file.name),stem=filename.replace(/\.[^.]+$/,'');
  let seq='',genderRaw='',ageRaw='',tagRaw='',name='';
  if(stem.includes('__')){
    const legacy=stem.split('__');
    if(legacy.length<5)return {ok:false,file,error:'파일명 형식은 번호_성별_나이_특징 이어야 합니다. 예: 001_F_10s_열혈.png'};
    seq=text(legacy.shift());genderRaw=text(legacy.shift());ageRaw=text(legacy.shift());tagRaw=text(legacy.shift());name=text(legacy.join('__'));
  }else{
    const parts=stem.split('_');
    if(parts.length<4)return {ok:false,file,error:'파일명 형식은 번호_성별_나이_특징 이어야 합니다. 예: 001_F_10s_열혈.png'};
    seq=text(parts.shift());genderRaw=text(parts.shift());ageRaw=text(parts.shift());tagRaw=text(parts.join('_'));
  }
  const gender=batchGender73551015(genderRaw),ageGroup=batchAge73551015(ageRaw),tags=tagRaw.split(/[+＋,，]+/).map(text).filter(Boolean).slice(0,12);
  if(!name)name='캐릭터 '+String(Number(seq)||seq).padStart(3,'0');
  if(!/^\d{1,4}$/.test(seq))return {ok:false,file,error:'번호는 1~4자리 숫자여야 합니다.'};
  if(!gender)return {ok:false,file,error:'성별 '+genderRaw+' 값이 올바르지 않습니다. (M/F/ALL)'};
  if(!ageGroup)return {ok:false,file,error:'나이 '+ageRaw+' 값이 올바르지 않습니다. (child/teen/10s/20s/30s/40s/50plus/ALL)'};
  if(!tags.length)return {ok:false,file,error:'특징이 비어 있습니다.'};
    if(!file||!/^image\//i.test(text(file.type)))return {ok:false,file,error:'이미지 파일이 아닙니다.'};
  if(Number(file.size||0)>20*1024*1024)return {ok:false,file,error:'원본 이미지가 20MB를 초과합니다.'};
  return {ok:true,file,seq,meta:{name,gender,ageGroup,tags,description:text(document.getElementById('charUploadDescription73551015')?.value)}};
}
function looksLikeBatchFilename73551015(file){const stem=text(file&&file.name).replace(/\.[^.]+$/,'');return stem.includes('__')||/^\d{1,4}_[^_]+_[^_]+_.+/.test(stem);}
function validateBatchFiles73551015(files){const parsed=Array.from(files||[]).map(parseBatchFilename73551015),errors=parsed.filter(x=>!x.ok);return {parsed,errors};}
async function uploadBatchByFilename73551015(parsed,progress){
  const ok=[],failed=[];
  for(let i=0;i<parsed.length;i++){
    const row=parsed[i];
    try{
      if(progress)progress(i,parsed.length,row.file.name,'processing');
      const c=await compressImage(row.file);
      const d=await call('saveImage',Object.assign({},c,row.meta,{sourceFilename:text(row.file&&row.file.name)}));
      ok.push({file:row.file.name,item:d.item||d});
      if(progress)progress(i,parsed.length,row.file.name,'done');
    }catch(e){failed.push({file:row.file.name,error:text(e&&e.message)||'업로드 실패'});if(progress)progress(i,parsed.length,row.file.name,'failed');}
  }
  catalogLoadedAt=0;await refreshCatalogUi(true);return {ok,failed};
}
async function adminUpload(){
  if(!fullAdmin())return alert('전체관리자만 등록할 수 있습니다.');
  const inp=document.getElementById('charUploadFiles73551015'),st=document.getElementById('charAdminUploadStatus73551015'),btn=document.getElementById('charAdminUploadBtn73551015');
  const files=inp&&inp.files?Array.from(inp.files):[];if(!files.length)return alert('이미지를 선택해주세요.');
  if(btn)btn.disabled=true;
  try{
    const filenameBatch=files.length>1||files.some(looksLikeBatchFilename73551015);
    if(filenameBatch){
      const check=validateBatchFiles73551015(files);
      if(check.errors.length){
        const details=check.errors.slice(0,12).map(x=>x.file.name+' → '+x.error).join('\n');
        if(st)st.textContent='일괄 업로드 중단 · 파일명 오류 '+check.errors.length+'개';
        alert('업로드를 시작하지 않았습니다. 파일명 오류 '+check.errors.length+'개를 먼저 수정해주세요.\n\n'+details+(check.errors.length>12?'\n외 '+(check.errors.length-12)+'개':'')+'\n\n규칙: 001_F_10s_열혈.png');
        return;
      }
      const result=await uploadBatchByFilename73551015(check.parsed,(i,n,name,state)=>{if(st)st.textContent=(i+1)+'/'+n+' · '+name+(state==='failed'?' · 실패':state==='done'?' · 완료':' · 압축/Storage 저장 중...');});
      if(inp)inp.value='';
      if(result.failed.length){const names=result.failed.slice(0,20).map(x=>x.file+' → '+x.error).join(' / ');if(st)st.textContent='일괄 업로드 완료 · 성공 '+result.ok.length+' / 실패 '+result.failed.length+' · '+names;alert('일괄 업로드가 끝났습니다.\n성공 '+result.ok.length+' / 실패 '+result.failed.length+'\n\n실패: '+names);}
      else{if(st)st.textContent='파일명 자동분류 일괄 업로드 완료 · 성공 '+result.ok.length+' / 실패 0';}
      return;
    }
    await uploadFiles(files,uploadMeta(),(i,n,name)=>{if(st)st.textContent=(i+1)+'/'+n+' · '+name+' Storage 업로드 준비 중...';});
    if(st)st.textContent='Firebase Storage 업로드 완료';if(inp)inp.value='';
  }catch(e){if(st)st.textContent=text(e&&e.message)||'업로드 실패';alert(text(e&&e.message)||'캐릭터 업로드에 실패했습니다.');}
  finally{if(btn)btn.disabled=false;}
}
async function importLegacy(){if(!fullAdmin())return alert('전체관리자만 가져올 수 있습니다.');if(!confirm('기존 캐릭터 이미지 20장을 Firebase Storage로 가져올까요?'))return;const st=document.getElementById('charAdminUploadStatus73551015');let ok=0,fail=0;for(const gender of ['male','female'])for(let i=1;i<=10;i++){try{if(st)st.textContent='기존 이미지 가져오기 '+(ok+fail+1)+'/20';const r=await fetch('appdata/character/'+gender+'/'+i+'.jpg',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const blob=await r.blob(),file=new File([blob],(gender==='male'?'남성':'여성')+' 캐릭터 '+i+'.jpg',{type:blob.type||'image/jpeg'});await uploadFiles([file],{name:(gender==='male'?'남성':'여성')+' 캐릭터 '+i,gender,ageGroup:'all',tags:['기존'],description:'기존 캐릭터 이미지'});ok++;}catch(_e){fail++;}}if(st)st.textContent='가져오기 완료 · 성공 '+ok+' / 실패 '+fail;await refreshCatalogUi(true);}
function installAdmin(){const u=document.getElementById('characterAdminUploader73551015');if(!u)return;const allowed=fullAdmin();u.style.display=allowed?'block':'none';if(!allowed){try{closeManager73551015();}catch(_e){}return;}if(u.dataset.bound73551015==='1')return;u.dataset.bound73551015='1';const st=document.getElementById('charAdminUploadStatus73551015');if(st&&!text(st.textContent))st.textContent='여러 장 선택 시 파일명 자동분류: 001_F_10s_열혈.png';document.getElementById('charAdminUploadBtn73551015')?.addEventListener('click',adminUpload);document.getElementById('charLegacyImportBtn73551015')?.addEventListener('click',importLegacy);}
async function install(){installAdmin();refreshCatalogUi(false).catch(()=>{});try{const s=await getSelection(false);renderSaved(s);renderPast(s);}catch(_e){renderPast(null);}}

global.__ULIM_CHARACTER_API_73551015__={version:VERSION,storageMode:'firebase-storage',listCatalog,getSelection,saveSelection,linkCurrentSelectionToPracticeRecord,hydratePracticeRecords,refreshCatalogUi,rollFromUi,saveCurrentFromUi,uploadFiles,compressImage,parseBatchFilename73551015,validateBatchFiles73551015,uploadBatchByFilename73551015,openManager73551015,install};
global.addEventListener('ulim-firebase-auth-ready',()=>setTimeout(install,120));
global.addEventListener('ulim-student-home-bootstrap-ready',()=>setTimeout(install,0));
global.addEventListener('ulim-staff-logout-start',()=>setTimeout(hideAdminUi73551015,0));
global.addEventListener('pageshow',()=>setTimeout(install,180));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else setTimeout(install,0);
setTimeout(install,1200);
})(typeof window!=='undefined'?window:globalThis);
