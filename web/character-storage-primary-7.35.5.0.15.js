(function(global){
'use strict';
if(global.__ULIM_CHARACTER_STORAGE_PRIMARY_73551015__)return;
global.__ULIM_CHARACTER_STORAGE_PRIMARY_73551015__=true;

const VERSION='2026-09-09.73551015-character-storage-short-filename-no-name';
const CALLABLE='characterCatalog73551015';
const TTL=30000;
let catalogCache=[],catalogLoadedAt=0,selectionCache=null,selectionLoadedAt=0;

function text(v){return String(v==null?'':v).trim();}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function norm(v){return text(v).normalize('NFKC').toLowerCase().replace(/\s+/g,'');}
function rid(p){return p+'-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
function room(){return global.ULIM_ROOM_CLASSROOM_REALTIME_72919||global.ULIM_ROOM_CLASSROOM_REALTIME_72918||global.ULIM_ROOM_CLASSROOM_REALTIME_72917||global.ULIM_ROOM_CLASSROOM_REALTIME_72916||global.ULIM_ROOM_CLASSROOM_REALTIME_729||null;}
async function runtime(){const r=room();if(!r||typeof r.preloadRuntime!=='function')throw new Error('캐릭터 Firebase 기능을 준비하지 못했습니다.');const rt=await r.preloadRuntime();if(!rt||!rt.auth||!rt.auth.currentUser||!rt.sdk||!rt.functions)throw new Error('로그인이 필요합니다.');return rt;}
async function call(action,payload){const rt=await runtime();const fn=rt.sdk.httpsCallable(rt.functions,CALLABLE);const resp=await fn(Object.assign({action,requestId:rid('CHAR73551015')},payload||{}));return resp&&resp.data||{};}
function adminInfo(){try{return global.adminInfo&&typeof global.adminInfo==='object'?global.adminInfo:(JSON.parse(localStorage.getItem('adminInfo')||'{}')||{});}catch(_e){return {};}}
function fullAdmin(){const i=adminInfo(),r=norm(i.firebaseRole||i.role||i.permission);return ['admin','superadmin',norm('전체관리자'),norm('전체관리'),norm('원장')].includes(r);}
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
    const d=await call('saveImage',Object.assign({},c,{name,gender:text(meta&&meta.gender)||'all',ageGroup:text(meta&&meta.ageGroup)||'all',tags:Array.isArray(meta&&meta.tags)?meta.tags:[],description:text(meta&&meta.description)}));
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
  const n=document.getElementById('charNameDisplay'),j=document.getElementById('charJobDisplay'),d=document.getElementById('charDescDisplay');
  const tags=Array.isArray(item&&item.tags)?item.tags.filter(Boolean):[];
  if(n)n.textContent=text(item&&item.name)||'캐릭터';if(j)j.textContent=[genderLabel(item&&item.gender),ageLabel(item&&item.ageGroup)].concat(tags.slice(0,3)).join(' · ');if(d)d.textContent=text(item&&item.description)||(tags.length?tags.join(', '):'조건에 맞는 캐릭터가 선택되었습니다.');
}
function renderSaved(s){
  const g=document.getElementById('charSaveGrid');if(!g)return;if(!s){g.innerHTML='';return;}
  g.innerHTML='<div class="mini-char-card character-saved-card73551015">'+(text(s.imageUrl)?'<img class="mini-char-img" src="'+esc(s.imageUrl)+'" alt="'+esc(s.name||'선택 캐릭터')+'">':'')+'<div class="mini-char-info"><b>'+esc(s.name||'선택 캐릭터')+'</b><br><span>'+esc([genderLabel(s.gender),ageLabel(s.ageGroup)].concat(s.tags||[]).join(' · '))+'</span><br><small>기출문제에 사용할 캐릭터</small></div></div>';
}
function renderPast(s){
  const b=document.getElementById('pastCharacterPreview73551015');if(!b)return;
  if(!s){b.innerHTML='<div class="past-character-empty73551015">캐릭터 뽑기에서 캐릭터를 저장하면 기출문제 대본 위에 표시됩니다.</div>';return;}
  b.innerHTML='<div class="past-character-card73551015">'+(text(s.imageUrl)?'<img src="'+esc(s.imageUrl)+'" alt="'+esc(s.name||'선택 캐릭터')+'">':'')+'<div><span>선택 캐릭터</span><b>'+esc(s.name||'캐릭터')+'</b><small>'+esc([genderLabel(s.gender),ageLabel(s.ageGroup)].concat(s.tags||[]).join(' · '))+'</small></div></div>';
}
async function refreshCatalogUi(force){
  let items=[];try{items=await listCatalog(force===true,false);}catch(e){const s=document.getElementById('charCatalogStatus73551015');if(s)s.textContent=text(e&&e.message)||'캐릭터 목록을 불러오지 못했습니다.';return [];}
  const st=document.getElementById('charCatalogStatus73551015');if(st)st.textContent='Storage 캐릭터 '+items.length+'개';
  const f=document.getElementById('charFeatureFilter73551015');if(f){const old=f.value,tags=Array.from(new Set(items.flatMap(i=>Array.isArray(i.tags)?i.tags.map(text):[]).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ko'));f.innerHTML='<option value="">특징 전체</option>'+tags.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');if(tags.includes(old))f.value=old;}
  if(fullAdmin())await renderAdminCatalog(items);return items;
}
async function renderAdminCatalog(items){
  const b=document.getElementById('charAdminCatalog73551015');if(!b)return;
  const all=await call('list',{includeInactive:true}).then(d=>Array.isArray(d.items)?d.items:[]).catch(()=>items||[]);
  b.innerHTML=all.length?all.map(i=>'<div class="char-admin-item73551015 '+(i.active===false?'inactive':'')+'">'+(text(i.imageUrl)?'<img src="'+esc(i.imageUrl)+'" alt="">':'')+'<div><b>'+esc(i.name||'캐릭터')+'</b><small>'+esc(genderLabel(i.gender)+' · '+ageLabel(i.ageGroup)+(i.tags&&i.tags.length?' · '+i.tags.join(', '):''))+'</small></div><button type="button" data-char-toggle73551015="'+esc(i.id)+'" data-active73551015="'+(i.active===false?'0':'1')+'">'+(i.active===false?'사용':'중지')+'</button></div>').join(''):'<div class="character-admin-note73551015">등록된 캐릭터가 없습니다.</div>';
  b.querySelectorAll('[data-char-toggle73551015]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{await call('setActive',{characterId:text(btn.dataset.charToggle73551015),active:btn.dataset.active73551015!=='1'});catalogLoadedAt=0;await refreshCatalogUi(true);}catch(e){alert(text(e&&e.message)||'상태 변경에 실패했습니다.');}finally{btn.disabled=false;}}));
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
      const d=await call('saveImage',Object.assign({},c,row.meta));
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
function installAdmin(){const u=document.getElementById('characterAdminUploader73551015');if(!u)return;u.style.display=fullAdmin()?'block':'none';if(!fullAdmin()||u.dataset.bound73551015==='1')return;u.dataset.bound73551015='1';const st=document.getElementById('charAdminUploadStatus73551015');if(st&&!text(st.textContent))st.textContent='여러 장 선택 시 파일명 자동분류: 001_F_10s_열혈.png';document.getElementById('charAdminUploadBtn73551015')?.addEventListener('click',adminUpload);document.getElementById('charLegacyImportBtn73551015')?.addEventListener('click',importLegacy);}
async function install(){installAdmin();refreshCatalogUi(false).catch(()=>{});try{const s=await getSelection(false);renderSaved(s);renderPast(s);}catch(_e){renderPast(null);}}

global.__ULIM_CHARACTER_API_73551015__={version:VERSION,storageMode:'firebase-storage',listCatalog,getSelection,saveSelection,linkCurrentSelectionToPracticeRecord,hydratePracticeRecords,refreshCatalogUi,rollFromUi,saveCurrentFromUi,uploadFiles,compressImage,parseBatchFilename73551015,validateBatchFiles73551015,uploadBatchByFilename73551015,install};
global.addEventListener('ulim-firebase-auth-ready',()=>setTimeout(install,120));
global.addEventListener('pageshow',()=>setTimeout(install,180));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else setTimeout(install,0);
setTimeout(install,1200);
})(typeof window!=='undefined'?window:globalThis);
