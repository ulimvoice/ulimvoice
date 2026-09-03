window.__ULIM_NEW_STUDENT_ADMIN_ENHANCER_73550962__=true;
(function(global){
  'use strict';
  const MARK='[[ULIMNS53]]',END='[[/ULIMNS53]]',STYLE='ulimNs61AdminStyle',BOX='ulim-ns61-admin-box';
  function text(v){return String(v==null?'':v).trim();}
  function norm(v){return text(v).normalize('NFKC').replace(/\s+/g,'').toLowerCase();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));}
  function parseMeta(body){body=text(body);const a=body.indexOf(MARK),b=body.indexOf(END);if(a<0||b<a)return null;try{const m=JSON.parse(body.slice(a+MARK.length,b).trim());m.__rest=body.slice(b+END.length).trim();return m;}catch(_e){return null;}}
  function serialize(type,items,rest){return MARK+'\n'+JSON.stringify({type,items},null,2)+'\n'+END+'\n'+text(rest||'');}
  function pageRows(){return Array.from(document.querySelectorAll('#nrAcademyPages73550937 [data-page-index]'));}
  function pageType(row){const t=norm(row.querySelector('[data-page-field="title"]')?.value);if(t.includes('강사소개'))return 'teachers';if(t.includes('반별커리큘럼')||t.includes('반커리큘럼'))return 'curriculum';return 'generic';}
  function fieldWrap(row,label){return Array.from(row.querySelectorAll('.ulim-nr-field73550937')).find(x=>norm(x.querySelector('label')?.textContent)===norm(label))||null;}
  function classes(){try{const d=global.ulimGetNewStudentRegistrationAdminData73550956?.();return (Array.isArray(d&&d.classes)?d.classes:[]).filter(c=>c&&c.selectable!==false&&!norm(c.instructorName).includes('김철수'));}catch(_e){return [];}}

  function style(){
    if(document.getElementById(STYLE))return;
    const s=document.createElement('style');s.id=STYLE;s.textContent=`
      .${BOX}{grid-column:1/-1;margin-top:12px;padding:15px;border:1px solid #bfe7da;border-radius:14px;background:#f7fffb}.${BOX} h5{margin:0 0 7px;font-size:16px;color:#14705c}.ulim-ns61-help{font-size:12px;color:#64748b;line-height:1.55;margin-bottom:11px}
      .ulim-ns61-item{border:1px solid #dbe4ef;border-radius:13px;padding:13px;background:#fff;margin-top:10px}.ulim-ns61-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ulim-ns61-item input[type=text],.ulim-ns61-item textarea,.ulim-ns61-desc{width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:9px;box-sizing:border-box}.ulim-ns61-item textarea{min-height:98px;resize:vertical}
      .ulim-ns61-image-group{margin-top:10px;padding:10px;border:1px solid #e2e8f0;border-radius:11px;background:#fbfdff}.ulim-ns61-image-title{font-size:12px;font-weight:950;color:#475569;margin-bottom:7px}.ulim-ns61-image-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
      .ulim-ns61-preview-face{width:92px;height:92px;object-fit:cover;border:1px solid #dbe4ef;border-radius:50%;background:#f8fafc}.ulim-ns61-preview-detail{width:220px;height:140px;object-fit:contain;border:1px solid #dbe4ef;border-radius:10px;background:#f8fafc}
      .ulim-ns61-file{display:none}.ulim-ns61-btn{border:0;border-radius:9px;padding:9px 12px;font-weight:900;cursor:pointer;background:#e2e8f0;color:#334155}.ulim-ns61-btn.blue{background:#3498db;color:#fff}.ulim-ns61-btn.green{background:#16a34a;color:#fff}.ulim-ns61-btn.red{background:#ef4d3f;color:#fff}.ulim-ns61-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.ulim-ns61-class-head{font-weight:950;color:#14705c;margin-bottom:8px}.ulim-ns61-class-head small{color:#64748b;font-weight:700;margin-left:8px}
      @media(max-width:760px){.ulim-ns61-row{grid-template-columns:1fr}.ulim-ns61-preview-detail{width:170px;height:115px}}
    `;document.head.appendChild(s);
  }

  function readItems(box){return Array.from(box.querySelectorAll('[data-ns61-item]')).map(el=>{const out={};el.querySelectorAll('[data-f]').forEach(f=>out[f.dataset.f]=f.value||'');return out;});}
  function sync(row,box,type){const body=row.querySelector('[data-page-field="body"]');if(body)body.value=serialize(type,readItems(box),box.querySelector('[data-ns61-rest]')?.value||'');}

  async function uploadImage(row,box,type,idx,file,urlField,pathField,previewKey,ownerSuffix){
    if(!file)return;
    const uploader=global.ulimNewStudentStorageImageUpload73550956;
    if(typeof uploader!=='function')return alert('이미지 업로드 기능을 준비하지 못했습니다.');
    const item=box.querySelector('[data-ns61-item="'+idx+'"]');if(!item)return;
    const oldPath=text(item.querySelector('[data-f="'+pathField+'"]')?.value);
    const baseOwner=text(item.querySelector(type==='teachers'?'[data-f="name"]':'[data-f="label"]')?.value)||(type==='teachers'?'teacher':'curriculum');
    const status=item.querySelector('[data-ns61-status="'+previewKey+'"]');
    if(status)status.textContent='업로드 중...';
    try{
      const r=await uploader(file,oldPath,type==='teachers'?'teacher':'curriculum',baseOwner+'-'+ownerSuffix);
      item.querySelector('[data-f="'+urlField+'"]').value=text(r.imageUrl);
      item.querySelector('[data-f="'+pathField+'"]').value=text(r.storagePath);
      const p=item.querySelector('[data-ns61-preview="'+previewKey+'"]');
      if(p){p.src=text(r.imageUrl);p.style.display='block';}
      sync(row,box,type);
      if(status)status.textContent='업로드 완료';
    }catch(e){
      if(status)status.textContent='업로드 실패';
      alert(text(e&&e.message)||'이미지 업로드에 실패했습니다.');
    }
  }

  async function deleteImage(row,box,type,idx,urlField,pathField,previewKey,label){
    const item=box.querySelector('[data-ns61-item="'+idx+'"]');if(!item)return;
    const path=text(item.querySelector('[data-f="'+pathField+'"]')?.value);
    if(path&&!confirm(label+'을 Firebase Storage에서 삭제할까요?'))return;
    try{
      if(path){
        const del=global.ulimNewStudentStorageImageDelete73550956;
        if(typeof del!=='function')throw new Error('이미지 삭제 기능을 준비하지 못했습니다.');
        await del(path);
      }
      item.querySelector('[data-f="'+urlField+'"]').value='';
      item.querySelector('[data-f="'+pathField+'"]').value='';
      const p=item.querySelector('[data-ns61-preview="'+previewKey+'"]');
      if(p){p.removeAttribute('src');p.style.display='none';}
      sync(row,box,type);
    }catch(e){alert(text(e&&e.message)||'이미지 삭제에 실패했습니다.');}
  }

  function teacherHtml(x,i){
    const detail=text(x.imageUrl),detailPath=text(x.imageStoragePath);
    const face=text(x.thumbnailUrl||x.imageUrl),facePath=text(x.thumbnailStoragePath);
    return '<div class="ulim-ns61-item" data-ns61-item="'+i+'">'+
      '<div class="ulim-ns61-row"><input type="text" data-f="name" placeholder="강사명" value="'+esc(x.name||'')+'"><input type="text" data-f="summary" placeholder="한줄소개" value="'+esc(x.summary||'')+'"></div>'+
      '<div class="ulim-ns61-image-group"><div class="ulim-ns61-image-title">얼굴사진 · 강사 카드에 표시</div><div class="ulim-ns61-image-row"><img class="ulim-ns61-preview-face" data-ns61-preview="face" src="'+esc(face)+'" style="'+(face?'':'display:none')+'"><label class="ulim-ns61-btn blue">얼굴사진 업로드/교체<input class="ulim-ns61-file" type="file" accept="image/*" data-ns61-upload="face" data-index="'+i+'"></label><button type="button" class="ulim-ns61-btn red" data-ns61-delete="face" data-index="'+i+'">얼굴사진 삭제</button><span data-ns61-status="face" style="font-size:12px;color:#64748b"></span></div><input type="hidden" data-f="thumbnailUrl" value="'+esc(x.thumbnailUrl||'')+'"><input type="hidden" data-f="thumbnailStoragePath" value="'+esc(facePath)+'"></div>'+
      '<div class="ulim-ns61-image-group"><div class="ulim-ns61-image-title">상세이미지 · 카드 클릭 후 팝업에 전체 표시</div><div class="ulim-ns61-image-row"><img class="ulim-ns61-preview-detail" data-ns61-preview="detail" src="'+esc(detail)+'" style="'+(detail?'':'display:none')+'"><label class="ulim-ns61-btn blue">상세이미지 업로드/교체<input class="ulim-ns61-file" type="file" accept="image/*" data-ns61-upload="detail" data-index="'+i+'"></label><button type="button" class="ulim-ns61-btn red" data-ns61-delete="detail" data-index="'+i+'">상세이미지 삭제</button><span data-ns61-status="detail" style="font-size:12px;color:#64748b"></span></div><input type="hidden" data-f="imageUrl" value="'+esc(detail)+'"><input type="hidden" data-f="imageStoragePath" value="'+esc(detailPath)+'"></div>'+
      '<textarea data-f="detail" placeholder="상세 경력·수업 소개(선택)" style="margin-top:9px">'+esc(x.detail||'')+'</textarea><div class="ulim-ns61-actions"><button type="button" class="ulim-ns61-btn red" data-ns61-remove="'+i+'">강사 삭제</button></div></div>';
  }

  function curriculumHtml(x,i){
    const img=text(x.imageUrl),path=text(x.imageStoragePath);
    return '<div class="ulim-ns61-item" data-ns61-item="'+i+'"><div class="ulim-ns61-class-head">'+esc(x.label||x.className||x.classId)+'<small>'+esc(x.instructorName||'')+'</small></div><input type="hidden" data-f="classId" value="'+esc(x.classId||'')+'"><input type="hidden" data-f="label" value="'+esc(x.label||x.className||'')+'"><input type="hidden" data-f="instructorName" value="'+esc(x.instructorName||'')+'"><input type="text" data-f="summary" placeholder="한줄소개(선택)" value="'+esc(x.summary||'')+'"><div class="ulim-ns61-image-group"><div class="ulim-ns61-image-title">커리큘럼 상세이미지 · 반 탭 클릭 후 팝업에 표시</div><div class="ulim-ns61-image-row"><img class="ulim-ns61-preview-detail" data-ns61-preview="detail" src="'+esc(img)+'" style="'+(img?'':'display:none')+'"><label class="ulim-ns61-btn blue">이미지 업로드/교체<input class="ulim-ns61-file" type="file" accept="image/*" data-ns61-upload="curriculum" data-index="'+i+'"></label><button type="button" class="ulim-ns61-btn red" data-ns61-delete="curriculum" data-index="'+i+'">이미지 삭제</button><span data-ns61-status="detail" style="font-size:12px;color:#64748b"></span></div><input type="hidden" data-f="imageUrl" value="'+esc(img)+'"><input type="hidden" data-f="imageStoragePath" value="'+esc(path)+'"></div><textarea data-f="detail" placeholder="커리큘럼 상세 설명(선택)" style="margin-top:9px">'+esc(x.detail||'')+'</textarea></div>';
  }

  function syncedCurriculumItems(existing){
    const old=new Map((Array.isArray(existing)?existing:[]).map(x=>[text(x.classId),x]));
    const cls=classes();if(!cls.length)return Array.isArray(existing)?existing:[];
    return cls.map(c=>{const prev=old.get(text(c.classId))||{};return Object.assign({},prev,{classId:text(c.classId),label:text(c.className)||text(c.classId),instructorName:text(c.instructorName)});});
  }

  function bindSpecial(row,box,type){
    const syncNow=()=>sync(row,box,type);
    box.querySelectorAll('input[type=text],textarea').forEach(x=>x.addEventListener('input',syncNow));
    box.querySelector('[data-ns61-rest]')?.addEventListener('input',syncNow);

    box.querySelectorAll('[data-ns61-upload]').forEach(inp=>inp.addEventListener('change',()=>{
      const f=inp.files&&inp.files[0];if(!f)return;
      const idx=Number(inp.dataset.index),kind=inp.dataset.ns61Upload;
      if(kind==='face')uploadImage(row,box,type,idx,f,'thumbnailUrl','thumbnailStoragePath','face','face');
      else if(kind==='detail')uploadImage(row,box,type,idx,f,'imageUrl','imageStoragePath','detail','detail');
      else uploadImage(row,box,type,idx,f,'imageUrl','imageStoragePath','detail','curriculum');
    }));

    box.querySelectorAll('[data-ns61-delete]').forEach(btn=>btn.onclick=()=>{
      const idx=Number(btn.dataset.index),kind=btn.dataset.ns61Delete;
      if(kind==='face')deleteImage(row,box,type,idx,'thumbnailUrl','thumbnailStoragePath','face','얼굴사진');
      else if(kind==='detail')deleteImage(row,box,type,idx,'imageUrl','imageStoragePath','detail','상세이미지');
      else deleteImage(row,box,type,idx,'imageUrl','imageStoragePath','detail','커리큘럼 이미지');
    });

    box.querySelectorAll('[data-ns61-remove]').forEach(btn=>btn.onclick=()=>{
      const idx=Number(btn.dataset.ns61Remove),next=readItems(box).filter((_,i)=>i!==idx);
      const body=row.querySelector('[data-page-field="body"]');
      body.value=serialize(type,next,box.querySelector('[data-ns61-rest]')?.value||'');
      renderSpecial(row,type);
    });
  }

  function renderSpecial(row,type){
    style();
    const body=row.querySelector('[data-page-field="body"]');if(!body)return;
    const meta=parseMeta(body.value);
    let current=(meta&&meta.type===type)?meta:{type,items:[],__rest:(meta?meta.__rest:body.value)||''};
    if(type==='curriculum')current.items=syncedCurriculumItems(current.items);

    let box=row.querySelector('.'+BOX);
    if(!box){box=document.createElement('div');box.className=BOX;(row.querySelector('.ulim-nr-grid73550937')||row).appendChild(box);}
    const bw=body.closest('.ulim-nr-field73550937');if(bw)bw.style.display='none';
    const iw=fieldWrap(row,'페이지 이미지');if(iw)iw.style.display='none';

    box.innerHTML='<h5>'+(type==='teachers'?'강사소개 설정':'반별 커리큘럼 설정')+'</h5><div class="ulim-ns61-help">'+
      (type==='teachers'?'얼굴사진은 강사 카드에 표시하고, 상세이미지는 카드를 클릭했을 때 팝업에서 전체 비율로 보여줍니다.':'현재 활성 반을 불러와 반명 탭으로 표시합니다. 각 탭을 누르면 업로드한 커리큘럼 상세이미지가 팝업으로 열립니다.')+
      '</div><input class="ulim-ns61-desc" data-ns61-rest placeholder="페이지 상단 설명 문구(선택)" value="'+esc(current.__rest||'')+'"><div data-ns61-items>'+current.items.map((x,i)=>type==='teachers'?teacherHtml(x,i):curriculumHtml(x,i)).join('')+'</div><div class="ulim-ns61-actions">'+
      (type==='teachers'?'<button type="button" class="ulim-ns61-btn green" data-ns61-add>강사 추가</button>':'<button type="button" class="ulim-ns61-btn green" data-ns61-sync>활성 반 목록 다시 동기화</button>')+'</div>';

    bindSpecial(row,box,type);
    if(type==='teachers'){
      box.querySelector('[data-ns61-add]').onclick=()=>{
        const next=readItems(box);
        next.push({name:'',summary:'',thumbnailUrl:'',thumbnailStoragePath:'',imageUrl:'',imageStoragePath:'',detail:''});
        body.value=serialize(type,next,box.querySelector('[data-ns61-rest]')?.value||'');
        renderSpecial(row,type);
      };
    }else{
      box.querySelector('[data-ns61-sync]').onclick=()=>{
        body.value=serialize(type,syncedCurriculumItems(readItems(box)),box.querySelector('[data-ns61-rest]')?.value||'');
        renderSpecial(row,type);
      };
    }
    sync(row,box,type);
  }

  function renderGeneric(row){
    const box=row.querySelector('.'+BOX);if(box)box.remove();
    const old=row.querySelector('.ulim-ns56-admin-box');if(old)old.remove();
    const body=row.querySelector('[data-page-field="body"]'),bw=body?.closest('.ulim-nr-field73550937');if(bw)bw.style.display='';
    const iw=fieldWrap(row,'페이지 이미지');if(iw)iw.style.display='';
  }

  function configure(row){
    const old=row.querySelector('.ulim-ns56-admin-box');if(old)old.remove();
    const type=pageType(row);
    if(type==='generic')renderGeneric(row);else renderSpecial(row,type);
    const title=row.querySelector('[data-page-field="title"]');
    if(title&&title.dataset.ns61Bound!=='1'){title.dataset.ns61Bound='1';title.addEventListener('input',()=>configure(row));}
  }

  function scan(){pageRows().forEach(configure);}
  global.ulimEnhanceNewStudentAcademyAdmin73550962=scan;
})(window);