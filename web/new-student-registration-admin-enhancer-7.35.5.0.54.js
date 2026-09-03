window.__ULIM_NEW_STUDENT_ADMIN_ENHANCER_73550956__=true;
(function(global){
  'use strict';
  const MARK='[[ULIMNS53]]',END='[[/ULIMNS53]]',STYLE='ulimNs56AdminStyle',BOX='ulim-ns56-admin-box';
  function text(v){return String(v==null?'':v).trim();}
  function norm(v){return text(v).normalize('NFKC').replace(/\s+/g,'').toLowerCase();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));}
  function parseMeta(body){body=text(body);const a=body.indexOf(MARK),b=body.indexOf(END);if(a<0||b<a)return null;try{const m=JSON.parse(body.slice(a+MARK.length,b).trim());m.__rest=body.slice(b+END.length).trim();return m;}catch(_e){return null;}}
  function serialize(type,items,rest){return MARK+'\n'+JSON.stringify({type,items},null,2)+'\n'+END+'\n'+text(rest||'');}
  function pageRows(){return Array.from(document.querySelectorAll('#nrAcademyPages73550937 [data-page-index]'));}
  function pageType(row){const t=norm(row.querySelector('[data-page-field="title"]')?.value);if(t.includes('강사소개'))return 'teachers';if(t.includes('반별커리큘럼')||t.includes('반커리큘럼'))return 'curriculum';return 'generic';}
  function fieldWrap(row,label){return Array.from(row.querySelectorAll('.ulim-nr-field73550937')).find(x=>norm(x.querySelector('label')?.textContent)===norm(label))||null;}
  function classes(){try{const d=global.ulimGetNewStudentRegistrationAdminData73550956?.();return (Array.isArray(d&&d.classes)?d.classes:[]).filter(c=>c&&c.selectable!==false&&!norm(c.instructorName).includes('김철수'));}catch(_e){return [];}}
  function style(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`
    .${BOX}{grid-column:1/-1;margin-top:12px;padding:15px;border:1px solid #bfe7da;border-radius:14px;background:#f7fffb}.${BOX} h5{margin:0 0 7px;font-size:16px;color:#14705c}.ulim-ns56-help{font-size:12px;color:#64748b;line-height:1.55;margin-bottom:11px}
    .ulim-ns56-item{border:1px solid #dbe4ef;border-radius:13px;padding:13px;background:#fff;margin-top:10px}.ulim-ns56-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ulim-ns56-item input[type=text],.ulim-ns56-item textarea,.ulim-ns56-desc{width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:9px;box-sizing:border-box}.ulim-ns56-item textarea{min-height:98px;resize:vertical}
    .ulim-ns56-image-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:9px}.ulim-ns56-preview{width:100px;height:100px;object-fit:cover;border:1px solid #dbe4ef;border-radius:12px;background:#f8fafc}.ulim-ns56-preview.curriculum{width:200px;height:125px;object-fit:contain}.ulim-ns56-file{display:none}
    .ulim-ns56-btn{border:0;border-radius:9px;padding:9px 12px;font-weight:900;cursor:pointer;background:#e2e8f0;color:#334155}.ulim-ns56-btn.blue{background:#3498db;color:#fff}.ulim-ns56-btn.green{background:#16a34a;color:#fff}.ulim-ns56-btn.red{background:#ef4d3f;color:#fff}.ulim-ns56-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.ulim-ns56-class-head{font-weight:950;color:#14705c;margin-bottom:8px}.ulim-ns56-class-head small{color:#64748b;font-weight:700;margin-left:8px}
    @media(max-width:760px){.ulim-ns56-row{grid-template-columns:1fr}.ulim-ns56-preview.curriculum{width:160px}}
  `;document.head.appendChild(s);}
  function readItems(box){return Array.from(box.querySelectorAll('[data-ns56-item]')).map(el=>{const out={};el.querySelectorAll('[data-f]').forEach(f=>out[f.dataset.f]=f.value||'');return out;});}
  function sync(row,box,type){const body=row.querySelector('[data-page-field="body"]');if(body)body.value=serialize(type,readItems(box),box.querySelector('[data-ns56-rest]')?.value||'');}
  async function uploadItem(row,box,type,idx,file){
    if(!file)return;const uploader=global.ulimNewStudentStorageImageUpload73550956;if(typeof uploader!=='function')return alert('이미지 업로드 기능을 준비하지 못했습니다.');
    const item=box.querySelector('[data-ns56-item="'+idx+'"]');if(!item)return;const oldPath=text(item.querySelector('[data-f="imageStoragePath"]')?.value);
    const owner=text(item.querySelector(type==='teachers'?'[data-f="name"]':'[data-f="label"]')?.value)||(type==='teachers'?'teacher':'curriculum');
    const status=item.querySelector('[data-ns56-status]');if(status)status.textContent='업로드 중...';
    try{const r=await uploader(file,oldPath,type==='teachers'?'teacher':'curriculum',owner);item.querySelector('[data-f="imageUrl"]').value=text(r.imageUrl);item.querySelector('[data-f="imageStoragePath"]').value=text(r.storagePath);const p=item.querySelector('[data-ns56-preview]');if(p){p.src=text(r.imageUrl);p.style.display='block';}sync(row,box,type);if(status)status.textContent='업로드 완료';}
    catch(e){if(status)status.textContent='업로드 실패';alert(text(e&&e.message)||'이미지 업로드에 실패했습니다.');}
  }
  async function deleteImage(row,box,type,idx){
    const item=box.querySelector('[data-ns56-item="'+idx+'"]');if(!item)return;const path=text(item.querySelector('[data-f="imageStoragePath"]')?.value);
    if(path&&!confirm('현재 이미지를 Firebase Storage에서 삭제할까요?'))return;
    try{if(path){const del=global.ulimNewStudentStorageImageDelete73550956;if(typeof del!=='function')throw new Error('이미지 삭제 기능을 준비하지 못했습니다.');await del(path);}item.querySelector('[data-f="imageUrl"]').value='';item.querySelector('[data-f="imageStoragePath"]').value='';const p=item.querySelector('[data-ns56-preview]');if(p){p.removeAttribute('src');p.style.display='none';}sync(row,box,type);}
    catch(e){alert(text(e&&e.message)||'이미지 삭제에 실패했습니다.');}
  }
  function teacherHtml(x,i){const img=text(x.imageUrl),path=text(x.imageStoragePath);return '<div class="ulim-ns56-item" data-ns56-item="'+i+'"><div class="ulim-ns56-row"><input type="text" data-f="name" placeholder="강사명" value="'+esc(x.name||'')+'"><input type="text" data-f="summary" placeholder="한줄소개" value="'+esc(x.summary||'')+'"></div><div class="ulim-ns56-image-row"><img class="ulim-ns56-preview" data-ns56-preview src="'+esc(img)+'" style="'+(img?'':'display:none')+'"><label class="ulim-ns56-btn blue">사진 업로드/교체<input class="ulim-ns56-file" type="file" accept="image/*" data-ns56-file="'+i+'"></label><button type="button" class="ulim-ns56-btn red" data-ns56-image-delete="'+i+'">사진 삭제</button><span data-ns56-status style="font-size:12px;color:#64748b"></span></div><input type="hidden" data-f="imageUrl" value="'+esc(img)+'"><input type="hidden" data-f="imageStoragePath" value="'+esc(path)+'"><textarea data-f="detail" placeholder="사진 클릭 시 표시할 상세 경력·수업 소개" style="margin-top:9px">'+esc(x.detail||'')+'</textarea><div class="ulim-ns56-actions"><button type="button" class="ulim-ns56-btn red" data-ns56-remove="'+i+'">강사 삭제</button></div></div>';}
  function curriculumHtml(x,i){const img=text(x.imageUrl),path=text(x.imageStoragePath);return '<div class="ulim-ns56-item" data-ns56-item="'+i+'"><div class="ulim-ns56-class-head">'+esc(x.label||x.className||x.classId)+'<small>'+esc(x.instructorName||'')+'</small></div><input type="hidden" data-f="classId" value="'+esc(x.classId||'')+'"><input type="hidden" data-f="label" value="'+esc(x.label||x.className||'')+'"><input type="hidden" data-f="instructorName" value="'+esc(x.instructorName||'')+'"><input type="text" data-f="summary" placeholder="한줄소개(선택)" value="'+esc(x.summary||'')+'"><div class="ulim-ns56-image-row"><img class="ulim-ns56-preview curriculum" data-ns56-preview src="'+esc(img)+'" style="'+(img?'':'display:none')+'"><label class="ulim-ns56-btn blue">커리큘럼 이미지 업로드/교체<input class="ulim-ns56-file" type="file" accept="image/*" data-ns56-file="'+i+'"></label><button type="button" class="ulim-ns56-btn red" data-ns56-image-delete="'+i+'">이미지 삭제</button><span data-ns56-status style="font-size:12px;color:#64748b"></span></div><input type="hidden" data-f="imageUrl" value="'+esc(img)+'"><input type="hidden" data-f="imageStoragePath" value="'+esc(path)+'"><textarea data-f="detail" placeholder="커리큘럼 상세 설명(선택)" style="margin-top:9px">'+esc(x.detail||'')+'</textarea></div>';}
  function syncedCurriculumItems(existing){
    const old=new Map((Array.isArray(existing)?existing:[]).map(x=>[text(x.classId),x]));
    const cls=classes();if(!cls.length)return Array.isArray(existing)?existing:[];
    return cls.map(c=>{const prev=old.get(text(c.classId))||{};return Object.assign({},prev,{classId:text(c.classId),label:text(c.className)||text(c.classId),instructorName:text(c.instructorName)});});
  }
  function renderSpecial(row,type){
    style();const body=row.querySelector('[data-page-field="body"]');if(!body)return;const meta=parseMeta(body.value);let current=(meta&&meta.type===type)?meta:{type,items:[],__rest:(meta?meta.__rest:body.value)||''};
    if(type==='curriculum')current.items=syncedCurriculumItems(current.items);
    let box=row.querySelector('.'+BOX);if(!box){box=document.createElement('div');box.className=BOX;(row.querySelector('.ulim-nr-grid73550937')||row).appendChild(box);}
    const bw=body.closest('.ulim-nr-field73550937');if(bw)bw.style.display='none';const iw=fieldWrap(row,'페이지 이미지');if(iw)iw.style.display='none';
    box.innerHTML='<h5>'+(type==='teachers'?'강사소개 설정':'반별 커리큘럼 설정')+'</h5><div class="ulim-ns56-help">'+(type==='teachers'?'강사별 사진·이름·한줄소개·상세설명을 입력합니다. 신규생 페이지에서 사진/카드를 누르면 상세 팝업이 열립니다.':'울림앱의 현재 활성 반을 자동으로 불러옵니다. 김철수T 담당 반은 표시하지 않습니다. 각 반의 커리큘럼 이미지를 직접 업로드하세요.')+'</div><input class="ulim-ns56-desc" data-ns56-rest placeholder="페이지 상단 설명 문구(선택)" value="'+esc(current.__rest||'')+'"><div data-ns56-items>'+current.items.map((x,i)=>type==='teachers'?teacherHtml(x,i):curriculumHtml(x,i)).join('')+'</div><div class="ulim-ns56-actions">'+(type==='teachers'?'<button type="button" class="ulim-ns56-btn green" data-ns56-add>강사 추가</button>':'<button type="button" class="ulim-ns56-btn green" data-ns56-sync>활성 반 목록 다시 동기화</button>')+'</div>';
    const syncNow=()=>sync(row,box,type);box.querySelectorAll('input[type=text],textarea').forEach(x=>x.addEventListener('input',syncNow));box.querySelector('[data-ns56-rest]')?.addEventListener('input',syncNow);
    box.querySelectorAll('[data-ns56-file]').forEach(inp=>inp.addEventListener('change',()=>{const f=inp.files&&inp.files[0];if(f)uploadItem(row,box,type,Number(inp.dataset.ns56File),f);}));
    box.querySelectorAll('[data-ns56-image-delete]').forEach(btn=>btn.onclick=()=>deleteImage(row,box,type,Number(btn.dataset.ns56ImageDelete)));
    box.querySelectorAll('[data-ns56-remove]').forEach(btn=>btn.onclick=()=>{const idx=Number(btn.dataset.ns56Remove),next=readItems(box).filter((_,i)=>i!==idx);body.value=serialize(type,next,box.querySelector('[data-ns56-rest]')?.value||'');renderSpecial(row,type);});
    if(type==='teachers')box.querySelector('[data-ns56-add]').onclick=()=>{const next=readItems(box);next.push({name:'',summary:'',imageUrl:'',imageStoragePath:'',detail:''});body.value=serialize(type,next,box.querySelector('[data-ns56-rest]')?.value||'');renderSpecial(row,type);};
    else box.querySelector('[data-ns56-sync]').onclick=()=>{body.value=serialize(type,syncedCurriculumItems(readItems(box)),box.querySelector('[data-ns56-rest]')?.value||'');renderSpecial(row,type);};
    syncNow();
  }
  function renderGeneric(row){const box=row.querySelector('.'+BOX);if(box)box.remove();const body=row.querySelector('[data-page-field="body"]'),bw=body?.closest('.ulim-nr-field73550937');if(bw)bw.style.display='';const iw=fieldWrap(row,'페이지 이미지');if(iw)iw.style.display='';}
  function configure(row){const type=pageType(row);if(type==='generic')renderGeneric(row);else renderSpecial(row,type);const title=row.querySelector('[data-page-field="title"]');if(title&&title.dataset.ns56Bound!=='1'){title.dataset.ns56Bound='1';title.addEventListener('input',()=>configure(row));}}
  let queued=false;function scan(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;pageRows().forEach(configure);});}
  function boot(){scan();const host=document.getElementById('nrAcademyPages73550937');if(host)new MutationObserver(scan).observe(host,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);