
const VERSION = '2026-09-03.73550954-new-student-teacher-profile-curriculum-modal';
window.__ULIM_NEW_STUDENT_ENHANCER_73550954__ = true;
(function(){
  'use strict';
  const ROOT_ID='academyContent73550937';
  const STYLE_ID='ulimNs53Style';
  const MODAL_ID='ulimNs53Modal';
  const PREFIX='[[ULIMNS53]]';
  const SUFFIX='[[/ULIMNS53]]';
  function q(sel,root){return (root||document).querySelector(sel);} 
  function qa(sel,root){return Array.from((root||document).querySelectorAll(sel));}
  function text(v){return String(v==null?'':v).trim();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[s]));}
  function style(){ if(document.getElementById(STYLE_ID)) return; const s=document.createElement('style'); s.id=STYLE_ID; s.textContent=`
    .ulim-ns53-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:8px}
    .ulim-ns53-card{border:1px solid #dbe7e0;border-radius:18px;padding:16px;background:#fff;box-shadow:0 8px 24px rgba(20,112,92,.08);display:flex;gap:14px;align-items:center;cursor:pointer;transition:transform .15s ease, box-shadow .15s ease}
    .ulim-ns53-card:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(20,112,92,.14)}
    .ulim-ns53-thumb{width:72px;height:72px;border-radius:50%;object-fit:cover;flex:0 0 auto;background:#eef7f3;border:1px solid #d6eadf}
    .ulim-ns53-name{font-weight:900;font-size:18px;color:#14705C;margin-bottom:6px}
    .ulim-ns53-summary{font-size:14px;line-height:1.55;color:#425466}
    .ulim-ns53-btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}
    .ulim-ns53-chip{border:1px solid #bde6d9;background:#f5fffb;color:#14705C;border-radius:999px;padding:12px 16px;font-weight:900;cursor:pointer}
    .ulim-ns53-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:2147483300;padding:20px}
    .ulim-ns53-modal.open{display:flex}.ulim-ns53-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.56)}
    .ulim-ns53-panel{position:relative;z-index:1;width:min(760px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:24px;padding:26px;box-shadow:0 24px 80px rgba(0,0,0,.28)}
    .ulim-ns53-close{position:absolute;top:14px;right:14px;border:0;background:#eef2f7;width:40px;height:40px;border-radius:12px;font-size:22px;cursor:pointer}
    .ulim-ns53-large{width:min(220px,100%);aspect-ratio:1/1;border-radius:22px;object-fit:cover;display:block;margin:0 auto 18px;background:#eef7f3}
    .ulim-ns53-title{font-size:28px;font-weight:950;color:#0f172a;margin:0 0 8px}
    .ulim-ns53-sub{color:#14705C;font-weight:900;margin:0 0 16px;font-size:16px}
    .ulim-ns53-body{white-space:pre-wrap;line-height:1.8;color:#334155;font-size:16px}
    .ulim-ns53-curriculum-image{width:100%;max-height:68vh;object-fit:contain;border-radius:16px;background:#f8fafc;margin:0 0 14px}
    @media (min-width:700px){ .ulim-ns53-thumb{width:84px;height:84px}.ulim-ns53-summary{font-size:15px}.ulim-ns53-chip{font-size:16px;padding:13px 18px}}
  `; document.head.appendChild(s);} 
  function ensureModal(){ let m=document.getElementById(MODAL_ID); if(m) return m; m=document.createElement('div'); m.id=MODAL_ID; m.className='ulim-ns53-modal'; m.innerHTML='<div class="ulim-ns53-backdrop" data-ns53-close="1"></div><div class="ulim-ns53-panel"><button type="button" class="ulim-ns53-close" data-ns53-close="1">×</button><div id="ulimNs53ModalBody"></div></div>'; document.body.appendChild(m); m.addEventListener('click',e=>{ if(e.target.closest('[data-ns53-close="1"]')) m.classList.remove('open'); }); return m; }
  function parseMeta(raw){ raw=text(raw); const a=raw.indexOf(PREFIX), b=raw.indexOf(SUFFIX); if(a<0||b<a) return null; const json=raw.slice(a+PREFIX.length,b).trim(); const rest=raw.slice(b+SUFFIX.length).trim(); try{ const meta=JSON.parse(json); meta.__rest=rest; return meta; }catch(_e){ return null; } }
  function modalHtmlTeacher(item){ return '<img class="ulim-ns53-large" src="'+esc(item.imageUrl||'')+'" alt=""><h3 class="ulim-ns53-title">'+esc(item.name||'')+'</h3><div class="ulim-ns53-sub">'+esc(item.summary||'')+'</div><div class="ulim-ns53-body">'+esc(item.detail||'')+'</div>'; }
  function modalHtmlCurr(item){ let html=''; if(item.imageUrl) html+='<img class="ulim-ns53-curriculum-image" src="'+esc(item.imageUrl)+'" alt="">'; html+='<h3 class="ulim-ns53-title">'+esc(item.label||item.className||'')+'</h3>'; if(item.summary) html+='<div class="ulim-ns53-sub">'+esc(item.summary)+'</div>'; if(item.detail) html+='<div class="ulim-ns53-body">'+esc(item.detail)+'</div>'; return html; }
  function openModal(html){ const m=ensureModal(); q('#ulimNs53ModalBody',m).innerHTML=html; m.classList.add('open'); }
  function collectActiveClassLabels(){ const map={}; qa('.class-card,.class-list [data-class-id], .class-list label').forEach(el=>{ const id=el.dataset.classId||el.getAttribute('data-class-id')||''; const label=text(q('b',el)?.textContent||el.textContent).split('\n')[0]; if(id&&label) map[id]=label; }); return map; }
  function enhanceCard(card){ if(card.dataset.ns53Enhanced==='1') return; const titleEl=q('.page-title',card); const bodyEl=q('.body-text',card); if(!bodyEl) return; const meta=parseMeta(bodyEl.textContent||''); if(!meta||!meta.type) return; card.dataset.ns53Enhanced='1'; style();
    if(meta.type==='teachers'){ const items=Array.isArray(meta.items)?meta.items:[]; const host=document.createElement('div'); host.className='ulim-ns53-grid'; host.innerHTML=items.map((item,idx)=>'<button type="button" class="ulim-ns53-card" data-ns53-item="'+idx+'"><img class="ulim-ns53-thumb" src="'+esc(item.imageUrl||'')+'" alt=""><div><div class="ulim-ns53-name">'+esc(item.name||'')+'</div><div class="ulim-ns53-summary">'+esc(item.summary||'')+'</div></div></button>').join(''); bodyEl.innerHTML = meta.__rest ? '<div class="body-text" style="white-space:pre-wrap;line-height:1.75;color:#334155">'+esc(meta.__rest)+'</div>' : ''; bodyEl.appendChild(host); host.addEventListener('click',e=>{ const b=e.target.closest('[data-ns53-item]'); if(!b) return; const item=items[Number(b.dataset.ns53Item)]||{}; openModal(modalHtmlTeacher(item)); }); }
    if(meta.type==='curriculum'){ const labels=collectActiveClassLabels(); const items=Array.isArray(meta.items)?meta.items:[]; const host=document.createElement('div'); host.className='ulim-ns53-btns'; host.innerHTML=items.map((item,idx)=>{ const lbl=item.label||labels[item.classId]||item.classId||('반 '+(idx+1)); return '<button type="button" class="ulim-ns53-chip" data-ns53-curr="'+idx+'">'+esc(lbl)+'</button>'; }).join(''); bodyEl.innerHTML = meta.__rest ? '<div class="body-text" style="white-space:pre-wrap;line-height:1.75;color:#334155;margin-bottom:8px">'+esc(meta.__rest)+'</div>' : ''; bodyEl.appendChild(host); host.addEventListener('click',e=>{ const b=e.target.closest('[data-ns53-curr]'); if(!b) return; const item=items[Number(b.dataset.ns53Curr)]||{}; if(!item.label) item.label=labels[item.classId]||''; openModal(modalHtmlCurr(item)); }); }
  }
  function apply(){ const root=document.getElementById(ROOT_ID); if(!root) return; qa('.card',root).forEach(enhanceCard); }
  const mo=new MutationObserver(()=>apply());
  function boot(){ apply(); const root=document.getElementById(ROOT_ID); if(root) mo.observe(root,{childList:true,subtree:true}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();