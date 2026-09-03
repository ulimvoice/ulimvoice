const VERSION='2026-09-03.73550962-teacher-card-lifecycle-anchor-fix';
window.__ULIM_NEW_STUDENT_ENHANCER_73550962__=true;
(function(){
  'use strict';
  const ROOT_ID='academyContent73550937';
  const STYLE_ID='ulimNs61Style';
  const MODAL_ID='ulimNs61Modal';
  const PREFIX='[[ULIMNS53]]';
  const SUFFIX='[[/ULIMNS53]]';

  function q(sel,root){return (root||document).querySelector(sel);}
  function qa(sel,root){return Array.from((root||document).querySelectorAll(sel));}
  function text(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));}

  function parseMeta(raw){
    raw=text(raw);
    const a=raw.indexOf(PREFIX),b=raw.indexOf(SUFFIX);
    if(a<0||b<a)return null;
    try{
      const meta=JSON.parse(raw.slice(a+PREFIX.length,b).trim());
      meta.__rest=raw.slice(b+SUFFIX.length).trim();
      return meta;
    }catch(_e){return null;}
  }

  function style(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      .ulim-ns61-teacher-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:15px;margin-top:15px}
      .ulim-ns61-teacher-card{appearance:none;width:100%;border:1px solid #cfe7df;border-radius:21px;background:#fff;padding:16px 17px;display:flex;align-items:center;gap:15px;text-align:left;cursor:pointer;box-shadow:0 8px 24px rgba(20,112,92,.07);transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
      .ulim-ns61-teacher-card:hover,.ulim-ns61-teacher-card:focus-visible{transform:translateY(-2px);box-shadow:0 14px 34px rgba(20,112,92,.13);border-color:#7dcdb8;outline:none}
      .ulim-ns61-face,.ulim-ns61-face-placeholder{width:84px;height:84px;flex:0 0 84px;border-radius:50%;border:1px solid #cce7de;background:#eef9f5;object-fit:cover;object-position:center}
      .ulim-ns61-face-placeholder{display:grid;place-items:center;color:#14705c;font-size:31px}
      .ulim-ns61-teacher-copy{min-width:0}.ulim-ns61-teacher-name{display:block;font-size:19px;font-weight:950;color:#14705c;line-height:1.3}.ulim-ns61-teacher-summary{display:block;margin-top:5px;font-size:13px;line-height:1.55;color:#64748b}
      .ulim-ns61-curr-tabs{display:flex;flex-wrap:wrap;gap:9px;margin-top:15px}
      .ulim-ns61-curr-tab{appearance:none;border:1px solid #b9ddd2;background:#fff;color:#14705c;border-radius:999px;padding:12px 17px;font-weight:950;cursor:pointer;box-shadow:0 4px 13px rgba(20,112,92,.05);transition:.15s}
      .ulim-ns61-curr-tab:hover,.ulim-ns61-curr-tab:focus-visible{background:#eefaf6;border-color:#65c8ae;transform:translateY(-1px);outline:none}
      .ulim-ns61-curr-tab small{display:block;margin-top:4px;color:#64748b;font-size:11px;font-weight:750}
      .ulim-ns61-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:2147483300;padding:18px}
      .ulim-ns61-modal.open{display:flex}.ulim-ns61-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.62)}
      .ulim-ns61-panel{position:relative;z-index:1;width:min(940px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:24px;padding:26px;box-shadow:0 28px 90px rgba(0,0,0,.32)}
      .ulim-ns61-close{position:sticky;top:0;float:right;z-index:2;border:0;background:#eef2f7;width:42px;height:42px;border-radius:12px;font-size:23px;line-height:1;cursor:pointer}
      .ulim-ns61-detail-image{display:block;width:100%;max-height:74vh;object-fit:contain;object-position:center;margin:4px auto 20px;border-radius:17px;background:#f8fafc}
      .ulim-ns61-title{clear:both;font-size:29px;font-weight:950;color:#0f172a;margin:3px 0 8px}.ulim-ns61-sub{color:#14705c;font-weight:900;margin:0 0 15px;font-size:16px;line-height:1.55}.ulim-ns61-body{white-space:pre-wrap;line-height:1.85;color:#334155;font-size:16px}
      .ulim-ns61-empty{padding:18px;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;text-align:center;margin-top:14px}
      @media(min-width:700px){.ulim-ns61-face,.ulim-ns61-face-placeholder{width:94px;height:94px;flex-basis:94px}.ulim-ns61-teacher-name{font-size:21px}.ulim-ns61-teacher-summary{font-size:14px}.ulim-ns61-curr-tab{font-size:16px;padding:13px 19px}}
      @media(max-width:540px){.ulim-ns61-teacher-grid{grid-template-columns:1fr}.ulim-ns61-face,.ulim-ns61-face-placeholder{width:76px;height:76px;flex-basis:76px}.ulim-ns61-curr-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ulim-ns61-curr-tab{width:100%;padding:12px 8px;text-align:center;font-size:13px}.ulim-ns61-panel{padding:17px;border-radius:19px}.ulim-ns61-detail-image{max-height:70vh;border-radius:13px}}
    `;
    document.head.appendChild(s);
  }

  function ensureModal(){
    let modal=document.getElementById(MODAL_ID);
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id=MODAL_ID;
    modal.className='ulim-ns61-modal';
    modal.innerHTML='<div class="ulim-ns61-backdrop" data-ns61-close="1"></div><section class="ulim-ns61-panel"><button type="button" class="ulim-ns61-close" data-ns61-close="1" aria-label="닫기">×</button><div id="ulimNs61ModalBody"></div></section>';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target.closest('[data-ns61-close="1"]'))modal.classList.remove('open');});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')modal.classList.remove('open');});
    return modal;
  }

  function openDetail(item,type){
    const modal=ensureModal();
    const title=type==='teachers'?text(item.name):text(item.label||item.className||item.classId);
    const detailImage=text(item.imageUrl||item.thumbnailUrl);
    let html='';
    if(detailImage)html+='<img class="ulim-ns61-detail-image" src="'+esc(detailImage)+'" alt="'+esc(title)+'">';
    html+='<h3 class="ulim-ns61-title">'+esc(title)+'</h3>';
    if(item.summary)html+='<div class="ulim-ns61-sub">'+esc(item.summary)+'</div>';
    if(item.detail)html+='<div class="ulim-ns61-body">'+esc(item.detail)+'</div>';
    q('#ulimNs61ModalBody',modal).innerHTML=html;
    modal.classList.add('open');
  }

  function renderTeachers(body,meta){
    const items=(Array.isArray(meta.items)?meta.items:[]).filter(x=>x&&text(x.name));
    body.innerHTML='';
    if(meta.__rest){
      const intro=document.createElement('div');
      intro.style.cssText='white-space:pre-wrap;line-height:1.75;color:#334155;margin-bottom:12px';
      intro.textContent=meta.__rest;
      body.appendChild(intro);
    }
    if(!items.length){const e=document.createElement('div');e.className='ulim-ns61-empty';e.textContent='등록된 강사 소개가 없습니다.';body.appendChild(e);return;}
    const host=document.createElement('div');host.className='ulim-ns61-teacher-grid';
    host.innerHTML=items.map((x,i)=>{
      const face=text(x.thumbnailUrl||x.imageUrl);
      const faceHtml=face?'<img class="ulim-ns61-face" src="'+esc(face)+'" alt="'+esc(x.name)+'">':'<span class="ulim-ns61-face-placeholder">🎙</span>';
      return '<button type="button" class="ulim-ns61-teacher-card" data-ns61-teacher="'+i+'">'+faceHtml+'<span class="ulim-ns61-teacher-copy"><span class="ulim-ns61-teacher-name">'+esc(x.name)+'</span>'+(x.summary?'<span class="ulim-ns61-teacher-summary">'+esc(x.summary)+'</span>':'')+'</span></button>';
    }).join('');
    body.appendChild(host);
    host.addEventListener('click',e=>{const b=e.target.closest('[data-ns61-teacher]');if(b)openDetail(items[Number(b.dataset.ns61Teacher)]||{},'teachers');});
  }

  function renderCurriculum(body,meta){
    const items=(Array.isArray(meta.items)?meta.items:[]).filter(x=>x&&text(x.label||x.className||x.classId));
    body.innerHTML='';
    if(meta.__rest){
      const intro=document.createElement('div');
      intro.style.cssText='white-space:pre-wrap;line-height:1.75;color:#334155;margin-bottom:12px';
      intro.textContent=meta.__rest;
      body.appendChild(intro);
    }
    if(!items.length){const e=document.createElement('div');e.className='ulim-ns61-empty';e.textContent='등록된 반별 커리큘럼이 없습니다.';body.appendChild(e);return;}
    const host=document.createElement('div');host.className='ulim-ns61-curr-tabs';
    host.innerHTML=items.map((x,i)=>'<button type="button" class="ulim-ns61-curr-tab" data-ns61-curr="'+i+'">'+esc(x.label||x.className||x.classId)+(x.instructorName?'<small>'+esc(x.instructorName)+'</small>':'')+'</button>').join('');
    body.appendChild(host);
    host.addEventListener('click',e=>{const b=e.target.closest('[data-ns61-curr]');if(b)openDetail(items[Number(b.dataset.ns61Curr)]||{},'curriculum');});
  }

  function enhanceCard(card){
    const body=q('.body-text',card);if(!body)return;
    const raw=body.textContent||'';
    const meta=parseMeta(raw);
    if(!meta||!['teachers','curriculum'].includes(meta.type))return;
    if(card.dataset.ns61Source===raw)return;
    card.dataset.ns61Source=raw;
    style();
    if(meta.type==='teachers')renderTeachers(body,meta);
    else renderCurriculum(body,meta);
  }

  function apply(){
    const root=document.getElementById(ROOT_ID);if(!root)return;
    qa('.card',root).forEach(enhanceCard);
  }

  let queued=false;
  function queueApply(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply();});}
  function boot(){apply();const root=document.getElementById(ROOT_ID);if(root)new MutationObserver(queueApply).observe(root,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();