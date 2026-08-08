(function (global) {
  'use strict';
  if (global.__ULIM_OPERATIONAL_CONTENT_ADMIN_7355012__) return;
  global.__ULIM_OPERATIONAL_CONTENT_ADMIN_7355012__ = true;

  const VERSION = '2026-08-08.735.05.0.12-remove-manual-course-register';
  const PANEL_ID = 'adminPanelOperationalContent7355011';
  const BUTTON_ID = 'adminOperationalContentSubtab7355011';
  let contentData = null;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function requestId(prefix) { return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
  function info() { if (global.adminInfo && typeof global.adminInfo === 'object') return global.adminInfo; try { return JSON.parse(localStorage.getItem('adminInfo') || '{}') || {}; } catch (_e) { return {}; } }
  function isFullAdmin() {
    const role = normalize(info().firebaseRole || info().role || info().permission);
    return ['admin','superadmin',normalize('전체관리자'),normalize('전체관리'),normalize('원장')].includes(role);
  }
  function roomRealtime() { return global.ULIM_ROOM_CLASSROOM_REALTIME_72917 || global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || null; }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('관리자 기능을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('관리자 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'operational-content-admin-7355012');
    return rt;
  }
  async function call(name, payload) { const rt = await runtime(); const fn = rt.sdk.httpsCallable(rt.functions, name); const response = await fn(payload || {}); return response && response.data || {}; }
  function loading(message) { try { if (typeof global.showLoading === 'function') global.showLoading(message); } catch (_e) {} }
  function loadingDone() { try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_e) {} }

  function injectStyles() {
    if (document.getElementById('ulimOperationalContentStyle7355012')) return;
    const style = document.createElement('style');
    style.id = 'ulimOperationalContentStyle7355012';
    style.textContent = [
      '#'+PANEL_ID+' .ulim-content-grid7355012{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}',
      '#'+PANEL_ID+' .ulim-content-card7355012{border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:16px}',
      '#'+PANEL_ID+' .ulim-content-card7355012 h3{margin:0 0 12px;color:#0f172a}',
      '#'+PANEL_ID+' .ulim-field7355012{margin:9px 0}',
      '#'+PANEL_ID+' .ulim-field7355012 label{display:block;font-size:12px;font-weight:900;color:#475569;margin-bottom:5px}',
      '#'+PANEL_ID+' input,#'+PANEL_ID+' textarea,#'+PANEL_ID+' select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:9px;background:#fff}',
      '#'+PANEL_ID+' textarea{min-height:110px;resize:vertical}',
      '#ulimTabletAdRows7355012{display:grid;gap:9px}',
      '.ulim-tablet-ad-row7355012{display:grid;grid-template-columns:1.1fr 1.4fr 1.4fr 90px auto;gap:7px;align-items:end;padding:9px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}',
      '.ulim-tablet-ad-row7355012 textarea{grid-column:1/-1;min-height:62px!important}',
      '.ulim-content-note7355012{font-size:12px;color:#64748b;line-height:1.55}',
      '@media(max-width:850px){.ulim-tablet-ad-row7355012{grid-template-columns:1fr 1fr}.ulim-tablet-ad-row7355012 textarea{grid-column:1/-1}}'
    ].join('');
    document.head.appendChild(style);
  }

  function panelHtml() {
    return '<div class="admin-card"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><h2 style="margin:0">앱 공지 · 태블릿 광고</h2><div class="ulim-content-note7355012">운영값은 Firestore에 저장됩니다.</div></div><button type="button" class="admin-btn blue" id="ulimContentReload7355012">다시 불러오기</button></div>'+
      '<div class="ulim-content-grid7355012" style="margin-top:14px">'+
      '<section class="ulim-content-card7355012"><h3>앱 공지사항</h3><div class="ulim-field7355012"><label><input type="checkbox" id="ulimNoticeEnabled7355012" style="width:auto"> 공지 사용</label></div><div class="ulim-field7355012"><label>제목</label><input id="ulimNoticeTitle7355012"></div><div class="ulim-field7355012"><label>내용</label><textarea id="ulimNoticeContent7355012"></textarea></div><div class="ulim-field7355012"><label>대상</label><input id="ulimNoticeTarget7355012" placeholder="전체 또는 학생명/강사명"></div><div class="ulim-field7355012"><label>이미지 URL</label><input id="ulimNoticeImage7355012"></div><div class="ulim-field7355012"><label>YouTube URL</label><input id="ulimNoticeYoutube7355012"></div><div class="ulim-field7355012"><label>영상 URL</label><input id="ulimNoticeVideo7355012"></div><div class="ulim-field7355012"><label>링크 URL</label><input id="ulimNoticeLink7355012"></div><div class="ulim-field7355012"><label>링크 문구</label><input id="ulimNoticeLinkText7355012"></div><button type="button" class="admin-btn green" id="ulimNoticeSave7355012">공지 저장</button></section>'+
      '<section class="ulim-content-card7355012"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h3>태블릿 홍보/광고</h3><div class="ulim-content-note7355012">제목·내용·이미지·영상 중 필요한 항목만 입력하세요.</div></div><button type="button" class="admin-btn blue" id="ulimTabletAdAdd7355012">광고 슬라이드 추가</button></div><div id="ulimTabletAdRows7355012" style="margin-top:10px"></div><button type="button" class="admin-btn green" id="ulimTabletAdsSave7355012" style="margin-top:10px">태블릿 광고 저장</button></section>'+
      '</div></div>';
  }

  function injectUi() {
    if (!isFullAdmin()) return false;
    injectStyles();
    const subtabs = document.querySelector('#adminDashboard .admin-subtabs');
    const dashboard = document.getElementById('adminDashboard');
    if (!subtabs || !dashboard) return false;
    const oldPanel = document.getElementById(PANEL_ID);
    if (oldPanel && oldPanel.dataset.ulimVersion !== VERSION) oldPanel.remove();
    const oldButton = document.getElementById(BUTTON_ID);
    if (oldButton && oldButton.dataset.ulimVersion !== VERSION) oldButton.remove();
    if (!document.getElementById(BUTTON_ID)) {
      const button = document.createElement('button');
      button.type = 'button'; button.id = BUTTON_ID; button.className = 'admin-subtab admin-full-only'; button.dataset.adminPanel = PANEL_ID; button.dataset.ulimVersion = VERSION; button.textContent = '앱/태블릿 설정';
      button.addEventListener('click', function () { if (typeof global.showAdminPanel === 'function') global.showAdminPanel(PANEL_ID); loadAll(false); });
      subtabs.appendChild(button);
    }
    if (!document.getElementById(PANEL_ID)) {
      const panel = document.createElement('div'); panel.id = PANEL_ID; panel.className = 'admin-panel'; panel.dataset.ulimVersion = VERSION; panel.innerHTML = panelHtml(); dashboard.appendChild(panel); bindUi();
    }
    return true;
  }
  function bindUi() {
    document.getElementById('ulimContentReload7355012').onclick = function () { loadAll(true); };
    document.getElementById('ulimNoticeSave7355012').onclick = saveNotice;
    document.getElementById('ulimTabletAdAdd7355012').onclick = function () { addAdRow({}); };
    document.getElementById('ulimTabletAdsSave7355012').onclick = saveAds;
  }

  function fillNotice(notice) {
    notice = notice || {};
    document.getElementById('ulimNoticeEnabled7355012').checked = notice.enabled !== false;
    document.getElementById('ulimNoticeTitle7355012').value = text(notice.title);
    document.getElementById('ulimNoticeContent7355012').value = text(notice.content);
    document.getElementById('ulimNoticeTarget7355012').value = text(notice.target) || '전체';
    document.getElementById('ulimNoticeImage7355012').value = text(notice.imageUrl);
    document.getElementById('ulimNoticeYoutube7355012').value = text(notice.youtubeUrl);
    document.getElementById('ulimNoticeVideo7355012').value = text(notice.videoUrl);
    document.getElementById('ulimNoticeLink7355012').value = text(notice.linkUrl);
    document.getElementById('ulimNoticeLinkText7355012').value = text(notice.linkText);
  }
  function addAdRow(slide) {
    const wrap = document.getElementById('ulimTabletAdRows7355012'); if (!wrap) return;
    slide = slide || {};
    const row = document.createElement('div'); row.className = 'ulim-tablet-ad-row7355012';
    row.innerHTML = '<div class="ulim-field7355012"><label>제목</label><input data-ad-field="title" value="'+escapeHtml(slide.title || '')+'"></div><div class="ulim-field7355012"><label>이미지 URL</label><input data-ad-field="imageUrl" value="'+escapeHtml(slide.imageUrl || '')+'"></div><div class="ulim-field7355012"><label>영상/YouTube URL</label><input data-ad-field="videoUrl" value="'+escapeHtml(slide.videoUrl || '')+'"></div><div class="ulim-field7355012"><label>초</label><input data-ad-field="seconds" type="number" min="5" max="120" value="'+escapeHtml(slide.seconds || 10)+'"></div><button type="button" class="admin-btn red" data-ad-remove="1">삭제</button><textarea data-ad-field="content" placeholder="텍스트 광고/안내 내용">'+escapeHtml(slide.content || '')+'</textarea>';
    row.querySelector('[data-ad-remove]').onclick = function () { row.remove(); };
    wrap.appendChild(row);
  }
  function fillAds(slides) { const wrap=document.getElementById('ulimTabletAdRows7355012');if(!wrap)return;wrap.innerHTML='';(Array.isArray(slides)&&slides.length?slides:[{}]).forEach(addAdRow); }

  async function loadAll(force) {
    if (!injectUi()) return;
    loading('앱/태블릿 설정 불러오는 중...');
    try {
      contentData = await call('getOperationalContentAdmin7355011', { force: force === true, requestId: requestId('content-admin-load-7355012') });
      fillNotice(contentData.notice || {}); fillAds(contentData.tabletAds || []);
    } catch (error) { alert(text(error && error.message) || '설정 정보를 불러오지 못했습니다.'); }
    finally { loadingDone(); }
  }
  async function saveNotice() {
    const notice = {
      enabled: document.getElementById('ulimNoticeEnabled7355012').checked,
      title: text(document.getElementById('ulimNoticeTitle7355012').value),
      content: text(document.getElementById('ulimNoticeContent7355012').value),
      target: text(document.getElementById('ulimNoticeTarget7355012').value) || '전체',
      imageUrl: text(document.getElementById('ulimNoticeImage7355012').value),
      youtubeUrl: text(document.getElementById('ulimNoticeYoutube7355012').value),
      videoUrl: text(document.getElementById('ulimNoticeVideo7355012').value),
      linkUrl: text(document.getElementById('ulimNoticeLink7355012').value),
      linkText: text(document.getElementById('ulimNoticeLinkText7355012').value)
    };
    loading('공지사항 저장 중...');
    try { await call('saveOperationalContentAdmin7355011', { kind:'notice', notice:notice, requestId:requestId('notice-save-7355012') }); alert('앱 공지사항을 저장했습니다.'); }
    catch(error){alert(text(error&&error.message)||'공지 저장에 실패했습니다.');}
    finally{loadingDone();}
  }
  function readAdRows() {
    return Array.from(document.querySelectorAll('#ulimTabletAdRows7355012 .ulim-tablet-ad-row7355012')).map(function(row){
      function value(name){const el=row.querySelector('[data-ad-field="'+name+'"]');return text(el&&el.value);}
      return { title:value('title'), content:value('content'), imageUrl:value('imageUrl'), videoUrl:value('videoUrl'), seconds:Number(value('seconds')||10), type:'공지' };
    }).filter(function(slide){return slide.title||slide.content||slide.imageUrl||slide.videoUrl;});
  }
  async function saveAds() {
    const slides = readAdRows();
    if (!slides.length && !confirm('태블릿 광고를 모두 비울까요?')) return;
    loading('태블릿 광고 저장 중...');
    try { await call('saveOperationalContentAdmin7355011', { kind:'tabletAds', slides:slides, requestId:requestId('tablet-ads-save-7355012') }); alert('태블릿 광고를 저장했습니다.'); }
    catch(error){alert(text(error&&error.message)||'태블릿 광고 저장에 실패했습니다.');}
    finally{loadingDone();}
  }

  function install() { if (!isFullAdmin()) return; injectUi(); }
  global.addEventListener('ulim-firebase-auth-ready', function(){ setTimeout(install,120); });
  global.addEventListener('pageshow', function(){ setTimeout(install,180); });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  setTimeout(install,900);
})(typeof window!=='undefined'?window:globalThis);
