const VERSION='2026-09-03.73550956-firebase-storage-image-owner';
window.__ULIM_NEW_STUDENT_ENHANCER_73550956__=true;
(function(){
  'use strict';
  const ROOT_ID='academyContent73550937';
  const STYLE_ID='ulimNs56Style';
  const MODAL_ID='ulimNs56Modal';
  const PREFIX='[[ULIMNS53]]';
  const SUFFIX='[[/ULIMNS53]]';
  function q(sel,root){return (root||document).querySelector(sel);}
  function qa(sel,root){return Array.from((root||document).querySelectorAll(sel));}
  function text(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));}
  function parseMeta(raw){raw=text(raw);const a=raw.indexOf(PREFIX),b=raw.indexOf(SUFFIX);if(a<0||b<a)return null;try{const m=JSON.parse(raw.slice(a+PREFIX.length,b).trim());m.__rest=raw.slice(b+SUFFIX.length).trim();return m;}catch(_e){return null;}}
  function style(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .ulim-ns56-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:16px;margin-top:14px}
      .ulim-ns56-card{border:1px solid #d7ebe4;border-radius:20px;padding:17px;background:#fff;box-shadow:0 9px 26px rgba(20,112,92,.08);display:flex;gap:15px;align-items:center;cursor:pointer;text-align:left;transition:.16s}
      .ulim-ns56-card:hover{transform:translateY(-2px);box-shadow:0 15px 34px rgba(20,112,92,.13)}
      .ulim-ns56-thumb,.ulim-ns56-placeholder{width:78px;height:78px;border-radius:50%;flex:0 0 auto;background:#eefaf6;border:1px solid #cfe8df;object-fit:cover}
      .ulim-ns56-placeholder{display:grid;place-items:center;color:#14705c;font-size:30px}
      .ulim-ns56-name{font-weight:950;font-size:19px;color:#14705c;margin-bottom:5px}.ulim-ns56-summary{font-size:14px;line-height:1.55;color:#475569}
      .ulim-ns56-btns{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:11px;margin-top:14px}
      .ulim-ns56-chip{border:1px solid #bde6d9;background:#f5fffb;color:#14705c;border-radius:15px;padding:14px 15px;font-weight:950;cursor:pointer;text-align:left}
      .ulim-ns56-chip small{display:block;color:#64748b;font-size:12px;font-weight:700;margin-top:4px}
      .ulim-ns56-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:2147483300;padding:20px}.ulim-ns56-modal.open{display:flex}
      .ulim-ns56-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.58)}.ulim-ns56-panel{position:relative;z-index:1;width:min(820px,94vw);max-height:90vh;overflow:auto;background:#fff;border-radius:24px;padding:28px;box-shadow:0 28px 90px rgba(0,0,0,.3)}
      .ulim-ns56-close{position:absolute;top:14px;right:14px;border:0;background:#eef2f7;width:42px;height:42px;border-radius:12px;font-size:23px;cursor:pointer}
      .ulim-ns56-large{width:min(240px,100%);aspect-ratio:1/1;border-radius:22px;object-fit:cover;display:block;margin:0 auto 20px;background:#eef7f3}
      .ulim-ns56-title{font-size:29px;font-weight:950;color:#0f172a;margin:0 0 8px}.ulim-ns56-sub{color:#14705c;font-weight:900;margin:0 0 16px;font-size:17px}.ulim-ns56-body{white-space:pre-wrap;line-height:1.85;color:#334155;font-size:16px}
      .ulim-ns56-curriculum-image{width:100%;max-height:70vh;object-fit:contain;border-radius:17px;background:#f8fafc;margin:0 0 18px}
      @media(min-width:700px){.ulim-ns56-thumb,.ulim-ns56-placeholder{width:92px;height:92px}.ulim-ns56-summary{font-size:15px}.ulim-ns56-chip{font-size:17px;padding:16px}}
    `;document.head.appendChild(s);
  }
  function ensureModal(){let m=document.getElementById(MODAL_ID);if(m)return m;m=document.createElement('div');m.id=MODAL_ID;m.className='ulim-ns56-modal';m.innerHTML='<div class="ulim-ns56-backdrop" data-ns56-close="1"></div><div class="ulim-ns56-panel"><button type="button" class="ulim-ns56-close" data-ns56-close="1">×</button><div id="ulimNs56ModalBody"></div></div>';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target.closest('[data-ns56-close="1"]'))m.classList.remove('open');});return m;}
  function openModal(html){const m=ensureModal();q('#ulimNs56ModalBody',m).innerHTML=html;m.classList.add('open');}
  function teacherModal(item){let html='';if(item.imageUrl)html+='<img class="ulim-ns56-large" src="'+esc(item.imageUrl)+'" alt="">';html+='<h3 class="ulim-ns56-title">'+esc(item.name||'')+'</h3>';if(item.summary)html+='<div class="ulim-ns56-sub">'+esc(item.summary)+'</div>';if(item.detail)html+='<div class="ulim-ns56-body">'+esc(item.detail)+'</div>';return html;}
  function curriculumModal(item){let html='';if(item.imageUrl)html+='<img class="ulim-ns56-curriculum-image" src="'+esc(item.imageUrl)+'" alt="">';html+='<h3 class="ulim-ns56-title">'+esc(item.label||item.className||'')+'</h3>';if(item.summary)html+='<div class="ulim-ns56-sub">'+esc(item.summary)+'</div>';if(item.detail)html+='<div class="ulim-ns56-body">'+esc(item.detail)+'</div>';return html;}
  function enhanceCard(card){
    const body=q('.body-text',card);if(!body)return;
    const meta=parseMeta(body.textContent||'');if(!meta||!meta.type)return;
    if(card.dataset.ns56Key===body.textContent)return;card.dataset.ns56Key=body.textContent;style();
    if(meta.type==='teachers'){
      const items=(Array.isArray(meta.items)?meta.items:[]).filter(x=>text(x&&x.name));
      body.innerHTML=meta.__rest?'<div style="white-space:pre-wrap;line-height:1.75;color:#334155;margin-bottom:12px">'+esc(meta.__rest)+'</div>':'';
      const host=document.createElement('div');host.className='ulim-ns56-grid';
      host.innerHTML=items.map((x,i)=>'<button type="button" class="ulim-ns56-card" data-ns56-teacher="'+i+'">'+(x.imageUrl?'<img class="ulim-ns56-thumb" src="'+esc(x.imageUrl)+'" alt="">':'<span class="ulim-ns56-placeholder">🎙</span>')+'<span><span class="ulim-ns56-name">'+esc(x.name)+'</span><span class="ulim-ns56-summary">'+esc(x.summary||'')+'</span></span></button>').join('');
      body.appendChild(host);host.addEventListener('click',e=>{const b=e.target.closest('[data-ns56-teacher]');if(b)openModal(teacherModal(items[Number(b.dataset.ns56Teacher)]||{}));});
    } else if(meta.type==='curriculum'){
      const items=(Array.isArray(meta.items)?meta.items:[]).filter(x=>text(x&&(x.label||x.className||x.classId)));
      body.innerHTML=meta.__rest?'<div style="white-space:pre-wrap;line-height:1.75;color:#334155;margin-bottom:12px">'+esc(meta.__rest)+'</div>':'';
      const host=document.createElement('div');host.className='ulim-ns56-btns';
      host.innerHTML=items.map((x,i)=>'<button type="button" class="ulim-ns56-chip" data-ns56-curr="'+i+'">'+esc(x.label||x.className||x.classId)+(x.instructorName?'<small>'+esc(x.instructorName)+'</small>':'')+'</button>').join('');
      body.appendChild(host);host.addEventListener('click',e=>{const b=e.target.closest('[data-ns56-curr]');if(b)openModal(curriculumModal(items[Number(b.dataset.ns56Curr)]||{}));});
    }
  }
  function apply(){const root=document.getElementById(ROOT_ID);if(!root)return;qa('.card',root).forEach(enhanceCard);}
  let timer=0;function queue(){clearTimeout(timer);timer=setTimeout(apply,0);}
  function boot(){apply();const root=document.getElementById(ROOT_ID);if(root)new MutationObserver(queue).observe(root,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();