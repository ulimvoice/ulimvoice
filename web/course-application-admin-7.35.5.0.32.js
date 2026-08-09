(function (global) {
  'use strict';
  if (global.__ULIM_COURSE_APPLICATION_ADMIN_7355032__) return;
  global.__ULIM_COURSE_APPLICATION_ADMIN_7355032__ = true;

  const VERSION = '2026-08-09.7355032-course-admin-ui-convergence';
  const STYLE_ID = 'ulimCourseApplicationAdminStyle7355032';
  const ENTRY_BUTTON_ID = 'ulimCourseApplicationOpen7355032';
  const ACTIONS_ID = 'ulimStudentPrimaryActions73546';
  const MESSAGE_BUTTON_ID = 'ulimMessageOpen73546';
  const LEGACY_ENTRY_ID = 'ulimCourseSettingsOpen73546';
  const LEGACY_MODAL_ID = 'ulimCourseSettingsModal73546';
  const LEGACY_TAB_ID = 'adminCourseApplicationSubtab7355031';
  const LEGACY_PANEL_ID = 'adminPanelCourseApplication7355031';
  const MAIN_MODAL_ID = 'ulimCourseAdminModal7355032';
  const PREVIEW_MODAL_ID = 'ulimCourseStudentPreviewModal7355032';

  let dashboardData = null;
  let dashboardMonth = '';
  let loadingPromise = null;
  let loadingMonth = '';
  let installed = false;
  let readinessObserver = null;
  let activeTab = 'info';
  let previewStep = 1;
  let previewResult = '';

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function info() {
    if (global.adminInfo && typeof global.adminInfo === 'object') return global.adminInfo;
    try { return JSON.parse(localStorage.getItem('adminInfo') || '{}') || {}; } catch (_e) { return {}; }
  }
  function isSuperAdmin() {
    const role = normalize(info().firebaseRole || info().role || info().permission || info().adminRole);
    return ['super', 'superadmin', normalize('전체관리자'), normalize('전체관리'), normalize('원장')].includes(role);
  }
  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_72917 || global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || null;
  }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('관리자 기능을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('관리자 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'course-application-admin-7355032');
    return rt;
  }
  async function call(name, payload) {
    const rt = await runtime();
    const fn = rt.sdk.httpsCallable(rt.functions, name);
    const response = await fn(payload || {});
    return response && response.data || {};
  }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function showLoading(message) { try { if (typeof global.showLoading === 'function') global.showLoading(message || '처리 중...'); } catch (_e) {} }
  function hideLoading() { try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_e) {} }
  function monthNow() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function msToLocalInput(ms) {
    const n = Number(ms || 0); if (!n) return '';
    const d = new Date(n); if (Number.isNaN(d.getTime())) return '';
    const pad = function (v) { return String(v).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function localInputToMs(value) { const raw = text(value); if (!raw) return 0; const ms = new Date(raw).getTime(); return Number.isFinite(ms) ? ms : 0; }
  function timeText(ms) {
    const n = Number(ms || 0); if (!n) return '-';
    const d = new Date(n); if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }
  function statusLabel(value) {
    const map = { not_submitted:'미신청', submitted:'확인대기', approved:'승인', scheduled:'승인·적용대기', applied:'적용완료', rejected:'반려' };
    return map[text(value)] || text(value) || '-';
  }
  function decisionLabel(value) {
    const map = { continue:'현재반 유지', class_move:'반 변경', leave:'휴원' };
    return map[text(value)] || '-';
  }
  function statusClass(value) { return 'st-' + text(value).replace(/[^a-z_]/g, ''); }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.ulim-ca-modal-open7355032{overflow:hidden!important}
      .ulim-ca-modal7355032{display:none;position:fixed;inset:0;z-index:2147482900;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
      .ulim-ca-modal7355032.open{display:flex}
      .ulim-ca-backdrop7355032{position:absolute;inset:0;background:rgba(15,23,42,.64)}
      .ulim-ca-shell7355032{position:relative;z-index:2;width:min(1240px,97vw);max-height:94vh;display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 28px 100px rgba(15,23,42,.42);overflow:hidden}
      .ulim-ca-head7355032{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;border-bottom:1px solid #e2e8f0;background:#fff}
      .ulim-ca-head7355032 h3{margin:0;font-size:20px;color:#0f172a}.ulim-ca-head-actions7355032{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
      .ulim-ca-close7355032{border:0;background:#f1f5f9;color:#334155;border-radius:10px;width:38px;height:38px;font-size:25px;font-weight:900;cursor:pointer}
      .ulim-ca-tabs7355032{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
      .ulim-ca-tab7355032{border:1px solid #dbe4ef;background:#fff;color:#475569;border-radius:10px;padding:11px 9px;font-weight:900;cursor:pointer}
      .ulim-ca-tab7355032.active{background:#16a34a;border-color:#16a34a;color:#fff}
      .ulim-ca-body7355032{padding:15px 18px 18px;overflow:auto;background:#f8fafc}
      .ulim-ca-pane7355032{display:none}.ulim-ca-pane7355032.active{display:block}
      .ulim-ca-card7355032{background:#fff;border:1px solid #dbe4ef;border-radius:14px;padding:15px}.ulim-ca-card7355032 h4{margin:0 0 12px;color:#0f172a;font-size:17px}
      .ulim-ca-field7355032{margin:10px 0}.ulim-ca-field7355032>label{display:block;font-size:12px;font-weight:900;color:#475569;margin-bottom:5px}
      .ulim-ca-modal7355032 input,.ulim-ca-modal7355032 textarea,.ulim-ca-modal7355032 select{box-sizing:border-box;width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}
      .ulim-ca-modal7355032 textarea{min-height:140px;resize:vertical}.ulim-ca-inline7355032{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .ulim-ca-actions7355032{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px}.ulim-ca-note7355032{font-size:11px;color:#64748b;line-height:1.55}
      .ulim-ca-check7355032{width:18px!important;height:18px!important;flex:0 0 auto}
      .ulim-ca-publish7355032{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:900;background:#f1f5f9;color:#64748b}.ulim-ca-publish7355032.on{background:#dcfce7;color:#166534}
      .ulim-ca-class-list7355032{max-height:58vh;overflow:auto;border:1px solid #e2e8f0;border-radius:11px;padding:9px;display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:7px;background:#f8fafc}
      .ulim-ca-class-item7355032{display:flex;gap:8px;align-items:flex-start;padding:9px;border:1px solid #edf2f7;border-radius:9px;background:#fff;font-size:12px;line-height:1.45}
      .ulim-ca-summary7355032{display:grid;grid-template-columns:repeat(6,minmax(90px,1fr));gap:8px;margin-bottom:12px}.ulim-ca-summary7355032>div{padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;text-align:center}.ulim-ca-summary7355032 b{display:block;font-size:19px}.ulim-ca-summary7355032 span{font-size:11px;color:#64748b}
      .ulim-ca-toolbar7355032{display:grid;grid-template-columns:minmax(180px,1fr) 160px auto auto auto;gap:7px;align-items:center;margin-bottom:10px}
      .ulim-ca-table-wrap7355032{max-height:60vh;overflow:auto;border:1px solid #e2e8f0;border-radius:11px}.ulim-ca-table7355032{width:100%;border-collapse:separate;border-spacing:0;min-width:1120px}.ulim-ca-table7355032 th,.ulim-ca-table7355032 td{padding:7px;border-bottom:1px solid #edf2f7;font-size:11px;vertical-align:top;background:#fff}.ulim-ca-table7355032 th{position:sticky;top:0;z-index:2;background:#f8fafc;text-align:left}
      .ulim-ca-status7355032{display:inline-flex;padding:3px 7px;border-radius:999px;font-weight:900;background:#f1f5f9;color:#475569;white-space:nowrap}.ulim-ca-status7355032.st-submitted{background:#fef3c7;color:#92400e}.ulim-ca-status7355032.st-approved,.ulim-ca-status7355032.st-scheduled{background:#dbeafe;color:#1d4ed8}.ulim-ca-status7355032.st-applied{background:#dcfce7;color:#166534}.ulim-ca-status7355032.st-rejected{background:#fee2e2;color:#b91c1c}
      .ulim-ca-row-actions7355032{display:flex;gap:5px;flex-wrap:wrap}
      #${PREVIEW_MODAL_ID}{z-index:2147483300}.ulim-ca-preview-shell7355032{width:min(680px,96vw)}.ulim-ca-preview-body7355032{padding:22px;overflow:auto}.ulim-ca-preview-progress7355032{display:flex;gap:6px;margin-bottom:17px}.ulim-ca-preview-progress7355032 i{display:block;height:5px;flex:1;border-radius:999px;background:#e2e8f0}.ulim-ca-preview-progress7355032 i.on{background:#22c55e}
      .ulim-ca-preview-question7355032{font-size:20px;font-weight:900;color:#0f172a;line-height:1.45;margin:4px 0 16px}.ulim-ca-preview-notice7355032{padding:16px;border:1px solid #bbf7d0;border-radius:14px;background:#f0fdf4;color:#14532d;line-height:1.7;white-space:pre-wrap}.ulim-ca-preview-sub7355032{font-size:13px;color:#64748b;line-height:1.55;margin:8px 0 16px;white-space:pre-wrap}.ulim-ca-preview-actions7355032{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.ulim-ca-preview-btn7355032{border:0;border-radius:14px;padding:15px 14px;font-size:16px;font-weight:900;cursor:pointer;background:#e2e8f0;color:#334155}.ulim-ca-preview-btn7355032.primary{background:#16a34a;color:#fff}.ulim-ca-preview-btn7355032.danger{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
      .ulim-ca-preview-classes7355032{display:grid;gap:8px}.ulim-ca-preview-class7355032{display:flex;align-items:flex-start;gap:9px;padding:11px;border:1px solid #dbe4ef;border-radius:10px;background:#fff}.ulim-ca-preview-class7355032 input{width:19px!important;height:19px!important;margin-top:2px}
      .ulim-ca-preview-complete7355032{text-align:center;padding:24px 8px}.ulim-ca-preview-complete7355032 b{display:block;font-size:23px;color:#166534;margin-bottom:8px}
      @media(max-width:900px){.ulim-ca-class-list7355032{grid-template-columns:1fr}.ulim-ca-summary7355032{grid-template-columns:repeat(3,1fr)}.ulim-ca-toolbar7355032{grid-template-columns:1fr 160px}}
      @media(max-width:620px){.ulim-ca-modal7355032{padding:8px}.ulim-ca-inline7355032{grid-template-columns:1fr}.ulim-ca-tabs7355032{grid-template-columns:1fr}.ulim-ca-summary7355032{grid-template-columns:repeat(2,1fr)}.ulim-ca-toolbar7355032{grid-template-columns:1fr}.ulim-ca-preview-actions7355032{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function mainModalHtml() {
    return '<div class="ulim-ca-backdrop7355032" data-ca-main-close="1"></div>' +
      '<section class="ulim-ca-shell7355032" role="dialog" aria-modal="true" aria-labelledby="ulimCourseAdminTitle7355032">' +
        '<header class="ulim-ca-head7355032"><div><h3 id="ulimCourseAdminTitle7355032">수강신청 관리</h3><div class="ulim-ca-note7355032">학생 안내·모집반·신청현황을 한 창에서 관리합니다.</div></div>' +
          '<div class="ulim-ca-head-actions7355032"><span id="caPublishBadge7355032" class="ulim-ca-publish7355032">게시 안 함</span><button type="button" class="admin-btn" data-ca-preview-open="1">학생 화면 미리보기</button><button type="button" class="admin-btn blue" data-ca-reload="1">새로고침</button><button type="button" class="ulim-ca-close7355032" data-ca-main-close="1" aria-label="닫기">×</button></div></header>' +
        '<nav class="ulim-ca-tabs7355032" aria-label="수강신청 관리 메뉴"><button type="button" class="ulim-ca-tab7355032 active" data-ca-tab="info">신청기간 · 학생안내</button><button type="button" class="ulim-ca-tab7355032" data-ca-tab="classes">모집반 설정</button><button type="button" class="ulim-ca-tab7355032" data-ca-tab="status">신청현황</button></nav>' +
        '<div class="ulim-ca-body7355032">' +
          '<section class="ulim-ca-pane7355032 active" data-ca-pane="info"><div class="ulim-ca-card7355032"><h4>신청기간 · 학생안내</h4>' +
            '<div class="ulim-ca-field7355032"><label>신청 대상월</label><input id="caMonth7355032" type="month"></div>' +
            '<div class="ulim-ca-field7355032"><label style="display:flex;gap:8px;align-items:center"><input id="caActive7355032" class="ulim-ca-check7355032" type="checkbox"> 학생 화면에 수강신청 게시</label></div>' +
            '<div class="ulim-ca-inline7355032"><div class="ulim-ca-field7355032"><label>신청 시작</label><input id="caOpen7355032" type="datetime-local"></div><div class="ulim-ca-field7355032"><label>신청 종료</label><input id="caClose7355032" type="datetime-local"></div></div>' +
            '<div class="ulim-ca-field7355032"><label>제목</label><input id="caTitle7355032"></div><div class="ulim-ca-field7355032"><label>학생 안내문</label><textarea id="caNotice7355032"></textarea></div>' +
            '<div class="ulim-ca-actions7355032"><button type="button" class="admin-btn green" data-ca-save="1">설정 저장 / 즉시 반영</button><button type="button" class="admin-btn" data-ca-preview-open="1">학생 화면 미리보기</button></div><div class="ulim-ca-note7355032" style="margin-top:8px">신청기간 중에도 내용을 수정해 다시 저장할 수 있습니다.</div></div></section>' +
          '<section class="ulim-ca-pane7355032" data-ca-pane="classes"><div class="ulim-ca-card7355032"><h4>모집반 설정</h4><div class="ulim-ca-note7355032" style="margin-bottom:10px">학생에게 선택지로 보여줄 반을 체크합니다. 반 목록은 기존 Firestore 반목록을 그대로 사용합니다.</div><div id="caClasses7355032" class="ulim-ca-class-list7355032"></div><div class="ulim-ca-actions7355032"><button type="button" class="admin-btn green" data-ca-save="1">모집반 저장 / 즉시 반영</button><button type="button" class="admin-btn" data-ca-preview-open="1">학생 화면 미리보기</button><span id="caClassCount7355032" class="ulim-ca-note7355032"></span></div></div></section>' +
          '<section class="ulim-ca-pane7355032" data-ca-pane="status"><div class="ulim-ca-card7355032"><h4>신청현황</h4><div id="caSummary7355032" class="ulim-ca-summary7355032"></div><div class="ulim-ca-toolbar7355032"><input id="caSearch7355032" placeholder="학생명 · 출결번호 · 반 검색"><select id="caStatusFilter7355032"><option value="all">전체 상태</option><option value="not_submitted">미신청</option><option value="submitted">확인대기</option><option value="approved">승인</option><option value="scheduled">승인·적용대기</option><option value="applied">적용완료</option><option value="rejected">반려</option></select><div id="caRowCount7355032" class="ulim-ca-note7355032"></div><button type="button" class="admin-btn green" data-ca-batch="approved">선택 승인</button><button type="button" class="admin-btn red" data-ca-batch="rejected">선택 반려</button></div><div class="ulim-ca-table-wrap7355032"><table class="ulim-ca-table7355032"><thead><tr><th><input type="checkbox" class="ulim-ca-check7355032" id="caSelectAll7355032"></th><th>학생</th><th>현재반</th><th>신청내용</th><th>상태</th><th>신청시각</th><th>처리</th></tr></thead><tbody id="caRows7355032"></tbody></table></div></div></section>' +
        '</div>' +
      '</section>';
  }

  function previewModalHtml() {
    return '<div class="ulim-ca-backdrop7355032"></div><section class="ulim-ca-shell7355032 ulim-ca-preview-shell7355032" role="dialog" aria-modal="true" aria-labelledby="caPreviewTitle7355032"><header class="ulim-ca-head7355032"><h3 id="caPreviewTitle7355032">학생 화면 미리보기</h3><button type="button" class="ulim-ca-close7355032" data-ca-preview-close="1" aria-label="닫기">×</button></header><div id="caPreviewBody7355032" class="ulim-ca-preview-body7355032"></div></section>';
  }

  function ensureModals() {
    injectStyle();
    if (!document.getElementById(MAIN_MODAL_ID)) {
      const modal = document.createElement('div');
      modal.id = MAIN_MODAL_ID;
      modal.className = 'ulim-ca-modal7355032';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = mainModalHtml();
      document.body.appendChild(modal);
      bindMainModal(modal);
    }
    if (!document.getElementById(PREVIEW_MODAL_ID)) {
      const modal = document.createElement('div');
      modal.id = PREVIEW_MODAL_ID;
      modal.className = 'ulim-ca-modal7355032';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = previewModalHtml();
      document.body.appendChild(modal);
      bindPreviewModal(modal);
    }
  }

  function cleanupLegacyUi() {
    [LEGACY_TAB_ID, LEGACY_PANEL_ID, LEGACY_MODAL_ID].forEach(function (id) {
      const node = document.getElementById(id);
      if (node) node.remove();
    });
    const legacyButton = document.getElementById(LEGACY_ENTRY_ID);
    if (legacyButton) legacyButton.remove();
  }

  function convergeEntryPoint() {
    if (!isSuperAdmin()) return false;
    cleanupLegacyUi();
    const actions = document.getElementById(ACTIONS_ID);
    if (!actions) return false;
    let button = document.getElementById(ENTRY_BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = ENTRY_BUTTON_ID;
      button.className = 'admin-btn green';
      button.textContent = '수강신청';
      button.addEventListener('click', openMainModal);
      const messageButton = document.getElementById(MESSAGE_BUTTON_ID);
      actions.insertBefore(button, messageButton && messageButton.parentElement === actions ? messageButton : null);
    }
    return true;
  }

  function watchUntilEntryReady() {
    if (convergeEntryPoint()) return;
    if (readinessObserver || typeof MutationObserver !== 'function') return;
    const root = document.getElementById('adminDashboard') || document.body;
    readinessObserver = new MutationObserver(function () {
      if (!convergeEntryPoint()) return;
      readinessObserver.disconnect();
      readinessObserver = null;
    });
    readinessObserver.observe(root, { childList:true, subtree:true });
    setTimeout(function () {
      if (!readinessObserver) return;
      readinessObserver.disconnect();
      readinessObserver = null;
      convergeEntryPoint();
    }, 10000);
  }

  function bindMainModal(modal) {
    modal.addEventListener('click', function (event) {
      const target = event.target;
      const close = target && target.closest && target.closest('[data-ca-main-close="1"]');
      if (close) { closeMainModal(); return; }
      const tab = target && target.closest && target.closest('[data-ca-tab]');
      if (tab) { setTab(text(tab.dataset.caTab)); return; }
      const reload = target && target.closest && target.closest('[data-ca-reload="1"]');
      if (reload) { loadDashboard(true); return; }
      const save = target && target.closest && target.closest('[data-ca-save="1"]');
      if (save) { saveWindow(); return; }
      const preview = target && target.closest && target.closest('[data-ca-preview-open="1"]');
      if (preview) { openPreviewModal(); return; }
      const batch = target && target.closest && target.closest('[data-ca-batch]');
      if (batch) { batchDecision(text(batch.dataset.caBatch)); return; }
      const decision = target && target.closest && target.closest('[data-ca-decision]');
      if (decision) { decide([text(decision.dataset.app)], text(decision.dataset.caDecision)); }
    });
    const month = modal.querySelector('#caMonth7355032');
    if (month) month.addEventListener('change', function () { loadDashboard(true); });
    ['caActive7355032','caTitle7355032','caNotice7355032','caOpen7355032','caClose7355032'].forEach(function (id) {
      const el = modal.querySelector('#' + id);
      if (el) el.addEventListener('input', updatePublishBadge);
    });
    const search = modal.querySelector('#caSearch7355032');
    const status = modal.querySelector('#caStatusFilter7355032');
    if (search) search.addEventListener('input', renderRows);
    if (status) status.addEventListener('change', renderRows);
    const selectAll = modal.querySelector('#caSelectAll7355032');
    if (selectAll) selectAll.addEventListener('change', function () {
      modal.querySelectorAll('#caRows7355032 [data-ca-select]:not(:disabled)').forEach(function (el) { el.checked = selectAll.checked; });
    });
    const classes = modal.querySelector('#caClasses7355032');
    if (classes) classes.addEventListener('change', updateClassCount);
  }

  function bindPreviewModal(modal) {
    modal.addEventListener('click', function (event) {
      const target = event.target;
      if (target && target.closest && target.closest('[data-ca-preview-close="1"]')) { closePreviewModal(); return; }
      const action = target && target.closest && target.closest('[data-ca-preview-action]');
      if (!action) return;
      const kind = text(action.dataset.caPreviewAction);
      if (kind === 'next') previewStep = 2;
      else if (kind === 'yes') previewStep = 3;
      else if (kind === 'leave') { previewResult = '휴원 신청을 선택한 경우의 접수 완료 화면입니다.'; previewStep = 5; }
      else if (kind === 'keep') { previewResult = '현재 수강반 유지를 선택한 경우의 접수 완료 화면입니다.'; previewStep = 5; }
      else if (kind === 'change') previewStep = 4;
      else if (kind === 'back') previewStep = 3;
      else if (kind === 'restart') { previewResult = ''; previewStep = 1; }
      else if (kind === 'finish') {
        const selected = Array.from(modal.querySelectorAll('[data-ca-preview-class]:checked')).map(function (el) { return text(el.value); }).filter(Boolean);
        if (!selected.length) { alert('미리보기에서 수강할 반을 하나 이상 선택해주세요.'); return; }
        previewResult = '반 변경 신청을 선택한 경우의 접수 완료 화면입니다. 실제 데이터는 저장되지 않았습니다.';
        previewStep = 5;
      }
      renderPreviewFlow();
    });
  }

  function setTab(name) {
    activeTab = ['info','classes','status'].includes(name) ? name : 'info';
    const modal = document.getElementById(MAIN_MODAL_ID); if (!modal) return;
    modal.querySelectorAll('[data-ca-tab]').forEach(function (button) { button.classList.toggle('active', text(button.dataset.caTab) === activeTab); });
    modal.querySelectorAll('[data-ca-pane]').forEach(function (pane) { pane.classList.toggle('active', text(pane.dataset.caPane) === activeTab); });
  }

  function openMainModal() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    ensureModals();
    const modal = document.getElementById(MAIN_MODAL_ID);
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ulim-ca-modal-open7355032');
    setTab(activeTab);
    if (!dashboardData) loadDashboard(false);
    else renderDashboard(dashboardData);
  }
  function closeMainModal() {
    closePreviewModal();
    const modal = document.getElementById(MAIN_MODAL_ID);
    if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('ulim-ca-modal-open7355032');
  }
  function openPreviewModal() {
    ensureModals();
    previewStep = 1;
    previewResult = '';
    renderPreviewFlow();
    const modal = document.getElementById(PREVIEW_MODAL_ID);
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ulim-ca-modal-open7355032');
  }
  function closePreviewModal() {
    const modal = document.getElementById(PREVIEW_MODAL_ID);
    if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
    const main = document.getElementById(MAIN_MODAL_ID);
    if (!main || !main.classList.contains('open')) document.body.classList.remove('ulim-ca-modal-open7355032');
  }

  function renderClasses(classes, selectedIds) {
    const box = document.getElementById('caClasses7355032'); if (!box) return;
    const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
    box.innerHTML = (Array.isArray(classes) ? classes : []).map(function (item) {
      const label = text(item.className) + (text(item.instructorName) ? ' / ' + text(item.instructorName) : '');
      return '<label class="ulim-ca-class-item7355032"><input class="ulim-ca-check7355032" type="checkbox" data-ca-class value="' + escapeHtml(item.classId) + '"' + (selected.has(item.classId) ? ' checked' : '') + '><span>' + escapeHtml(label) + '</span></label>';
    }).join('') || '<div class="ulim-ca-note7355032">현재 모집반 목록이 없습니다.</div>';
    updateClassCount();
  }
  function selectedClassIds() {
    return Array.from(document.querySelectorAll('#caClasses7355032 [data-ca-class]:checked')).map(function (el) { return text(el.value); }).filter(Boolean);
  }
  function updateClassCount() {
    const el = document.getElementById('caClassCount7355032');
    if (el) el.textContent = '선택 ' + selectedClassIds().length + '개';
  }
  function updatePublishBadge() {
    const badge = document.getElementById('caPublishBadge7355032'); if (!badge) return;
    const active = !!(document.getElementById('caActive7355032') && document.getElementById('caActive7355032').checked);
    const now = Date.now();
    const open = localInputToMs(document.getElementById('caOpen7355032') && document.getElementById('caOpen7355032').value);
    const close = localInputToMs(document.getElementById('caClose7355032') && document.getElementById('caClose7355032').value);
    const inPeriod = active && (!open || open <= now) && (!close || close >= now);
    badge.className = 'ulim-ca-publish7355032' + (inPeriod ? ' on' : '');
    badge.textContent = inPeriod ? '현재 게시중' : (active ? '게시 예약/기간외' : '게시 안 함');
  }
  function fillWindow(data) {
    const windowData = data && data.window || {};
    const month = text(data && data.month) || text(windowData.month) || monthNow();
    const monthEl = document.getElementById('caMonth7355032'); if (monthEl) monthEl.value = month;
    const activeEl = document.getElementById('caActive7355032'); if (activeEl) activeEl.checked = windowData.active === true;
    const openEl = document.getElementById('caOpen7355032'); if (openEl) openEl.value = msToLocalInput(windowData.openAtMs);
    const closeEl = document.getElementById('caClose7355032'); if (closeEl) closeEl.value = msToLocalInput(windowData.closeAtMs);
    const titleEl = document.getElementById('caTitle7355032'); if (titleEl) titleEl.value = text(windowData.title) || month + ' 수강신청';
    const noticeEl = document.getElementById('caNotice7355032'); if (noticeEl) noticeEl.value = text(windowData.notice);
    renderClasses(data && data.classes, windowData.recruitingClassIds);
    updatePublishBadge();
  }
  function renderSummary(summary) {
    summary = summary || {};
    const box = document.getElementById('caSummary7355032'); if (!box) return;
    const approvalPending = Number(summary.approved || 0) + Number(summary.scheduled || 0);
    const cells = [['eligible','대상'],['notSubmitted','미신청'],['submitted','확인대기'],[approvalPending,'승인·적용대기'],['applied','적용완료'],['rejected','반려']];
    box.innerHTML = cells.map(function (pair) {
      const value = typeof pair[0] === 'number' ? pair[0] : Number(summary[pair[0]] || 0);
      return '<div><b>' + value + '</b><span>' + pair[1] + '</span></div>';
    }).join('');
  }
  function rowMatches(row, query, status) {
    if (status !== 'all' && text(row.status) !== status) return false;
    if (!query) return true;
    const hay = normalize([row.studentName,row.attendanceNo,(row.currentClassNames||[]).join(' '),(row.requestedClassNames||[]).join(' '),(row.instructorNames||[]).join(' ')].join(' '));
    return hay.indexOf(normalize(query)) >= 0;
  }
  function renderRows() {
    const body = document.getElementById('caRows7355032'); if (!body) return;
    const rows = dashboardData && Array.isArray(dashboardData.rows) ? dashboardData.rows : [];
    const query = text(document.getElementById('caSearch7355032') && document.getElementById('caSearch7355032').value);
    const status = text(document.getElementById('caStatusFilter7355032') && document.getElementById('caStatusFilter7355032').value) || 'all';
    const filtered = rows.filter(function (row) { return rowMatches(row, query, status); });
    const count = document.getElementById('caRowCount7355032'); if (count) count.textContent = '표시 ' + filtered.length + '명 / 전체 ' + rows.length + '명';
    body.innerHTML = filtered.map(function (row) {
      const actionable = text(row.status) === 'submitted' && text(row.applicationId);
      const request = decisionLabel(row.registrationDecision) + (Array.isArray(row.requestedClassNames) && row.requestedClassNames.length ? '<br><span class="ulim-ca-note7355032">' + escapeHtml(row.requestedClassNames.join(', ')) + '</span>' : '');
      const current = Array.isArray(row.currentClassNames) && row.currentClassNames.length ? row.currentClassNames.join(', ') : '-';
      const action = actionable ? '<div class="ulim-ca-row-actions7355032"><button type="button" class="admin-btn green" data-ca-decision="approved" data-app="' + escapeHtml(row.applicationId) + '">승인</button><button type="button" class="admin-btn red" data-ca-decision="rejected" data-app="' + escapeHtml(row.applicationId) + '">반려</button></div>' : '-';
      return '<tr><td><input class="ulim-ca-check7355032" type="checkbox" data-ca-select value="' + escapeHtml(row.applicationId || '') + '"' + (actionable ? '' : ' disabled') + '></td><td><b>' + escapeHtml(row.studentName) + '</b><br><span class="ulim-ca-note7355032">' + escapeHtml(row.attendanceNo) + ' · ' + escapeHtml((row.instructorNames || []).join(', ')) + '</span></td><td>' + escapeHtml(current) + '</td><td>' + request + '</td><td><span class="ulim-ca-status7355032 ' + statusClass(row.status) + '">' + escapeHtml(statusLabel(row.status)) + '</span></td><td>' + escapeHtml(timeText(row.submittedAtMs)) + '</td><td>' + action + '</td></tr>';
    }).join('') || '<tr><td colspan="7" style="text-align:center;padding:22px;color:#64748b">조건에 맞는 학생이 없습니다.</td></tr>';
    const selectAll = document.getElementById('caSelectAll7355032'); if (selectAll) selectAll.checked = false;
  }
  function renderDashboard(data) {
    if (!data) return;
    fillWindow(data);
    renderSummary(data.summary);
    renderRows();
  }

  async function loadDashboard(force) {
    ensureModals();
    const month = text(document.getElementById('caMonth7355032') && document.getElementById('caMonth7355032').value) || monthNow();
    if (!force && dashboardData && dashboardMonth === month) { renderDashboard(dashboardData); return dashboardData; }
    if (loadingPromise && loadingMonth === month) return loadingPromise;
    showLoading('수강신청 현황 불러오는 중...');
    loadingMonth = month;
    loadingPromise = call('getCourseApplicationAdminDashboard7355031', { month:month, force:force === true, requestId:requestId('course-dashboard-7355032') })
      .then(function (data) { dashboardData = data || {}; dashboardMonth = text(dashboardData.month) || month; renderDashboard(dashboardData); return dashboardData; })
      .catch(function (error) { alert(text(error && error.message) || '수강신청 현황을 불러오지 못했습니다.'); return null; })
      .finally(function () { loadingPromise = null; loadingMonth = ''; hideLoading(); });
    return loadingPromise;
  }

  function draftPayload() {
    return {
      month: text(document.getElementById('caMonth7355032') && document.getElementById('caMonth7355032').value),
      active: !!(document.getElementById('caActive7355032') && document.getElementById('caActive7355032').checked),
      title: text(document.getElementById('caTitle7355032') && document.getElementById('caTitle7355032').value),
      notice: text(document.getElementById('caNotice7355032') && document.getElementById('caNotice7355032').value),
      openAtMs: localInputToMs(document.getElementById('caOpen7355032') && document.getElementById('caOpen7355032').value),
      closeAtMs: localInputToMs(document.getElementById('caClose7355032') && document.getElementById('caClose7355032').value),
      recruitingClassIds: selectedClassIds()
    };
  }
  async function saveWindow() {
    const payload = draftPayload();
    if (!/^\d{4}-\d{2}$/.test(payload.month)) return alert('신청 대상월을 선택해주세요.');
    if (payload.openAtMs && payload.closeAtMs && payload.closeAtMs <= payload.openAtMs) return alert('신청 종료시간은 시작시간보다 뒤여야 합니다.');
    if (payload.active && !payload.recruitingClassIds.length && !confirm('모집반을 선택하지 않았습니다. 현재 운영 중인 모든 선택 가능 반을 학생에게 표시할까요?')) return;
    payload.requestId = requestId('course-window-save-7355032');
    showLoading('수강신청 설정 저장 중...');
    try {
      await call('saveCourseApplicationWindowAdmin7352', payload);
      alert('수강신청 설정을 저장했습니다. 학생 화면에 바로 반영됩니다.');
      dashboardData = null;
      await loadDashboard(true);
    } catch (error) {
      alert(text(error && error.message) || '수강신청 설정 저장에 실패했습니다.');
    } finally { hideLoading(); }
  }
  function selectedApplicationIds() {
    return Array.from(document.querySelectorAll('#caRows7355032 [data-ca-select]:checked')).map(function (el) { return text(el.value); }).filter(Boolean);
  }
  function batchDecision(state) {
    const ids = selectedApplicationIds();
    if (!ids.length) return alert('처리할 신청을 선택해주세요.');
    decide(ids, state);
  }
  async function decide(ids, state) {
    ids = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (!ids.length) return;
    const label = state === 'approved' ? '승인' : '반려';
    if (!confirm('선택한 수강신청 ' + ids.length + '건을 ' + label + '할까요?')) return;
    showLoading('수강신청 ' + label + ' 처리 중...');
    try {
      const result = await call('decideCourseApplicationsAdmin73550', { decisions:ids.map(function (id) { return { applicationId:id, state:state }; }), requestId:requestId('course-decision-7355032') });
      const failed = Array.isArray(result.results) ? result.results.filter(function (row) { return row.ok !== true; }) : [];
      if (failed.length) alert((ids.length - failed.length) + '건 처리 완료 · ' + failed.length + '건 확인이 필요합니다.');
      else alert(ids.length + '건 ' + label + ' 완료');
      dashboardData = null;
      await loadDashboard(true);
    } catch (error) {
      alert(text(error && error.message) || '수강신청 처리에 실패했습니다.');
    } finally { hideLoading(); }
  }

  function previewDraft() {
    const payload = draftPayload();
    const month = /^\d{4}-\d{2}$/.test(payload.month) ? payload.month : monthNow();
    const classes = dashboardData && Array.isArray(dashboardData.classes) ? dashboardData.classes : [];
    const selected = new Set(payload.recruitingClassIds);
    const recruiting = classes.filter(function (item) { return !selected.size || selected.has(text(item.classId)); });
    const rows = dashboardData && Array.isArray(dashboardData.rows) ? dashboardData.rows : [];
    const example = rows.find(function (row) { return Array.isArray(row.currentClassNames) && row.currentClassNames.length; }) || {};
    return {
      month: month,
      label: Number(month.slice(5, 7)) + '월',
      title: payload.title || Number(month.slice(5, 7)) + '월 수강신청',
      notice: payload.notice || Number(month.slice(5, 7)) + '월 수강신청을 진행합니다.',
      classes: recruiting,
      currentClasses: Array.isArray(example.currentClassNames) && example.currentClassNames.length ? example.currentClassNames : ['현재 수강반 예시']
    };
  }
  function previewProgress() {
    return '<div class="ulim-ca-preview-progress7355032">' + [1,2,3,4].map(function (n) { return '<i class="' + (n <= Math.min(previewStep, 4) ? 'on' : '') + '"></i>'; }).join('') + '</div>';
  }
  function renderPreviewFlow() {
    const body = document.getElementById('caPreviewBody7355032'); if (!body) return;
    const data = previewDraft();
    const title = document.getElementById('caPreviewTitle7355032'); if (title) title.textContent = data.title + ' · 학생 화면 미리보기';
    if (previewStep === 5) {
      body.innerHTML = '<div class="ulim-ca-preview-complete7355032"><b>미리보기 완료</b><div class="ulim-ca-preview-sub7355032">' + escapeHtml(previewResult || '학생 신청 흐름을 확인했습니다.') + '<br>미리보기에서는 Firestore에 아무 데이터도 저장하지 않습니다.</div><div class="ulim-ca-preview-actions7355032"><button type="button" class="ulim-ca-preview-btn7355032" data-ca-preview-action="restart">처음부터</button><button type="button" class="ulim-ca-preview-btn7355032 primary" data-ca-preview-close="1">미리보기 종료</button></div></div>';
      return;
    }
    if (previewStep === 1) {
      body.innerHTML = previewProgress() + '<div class="ulim-ca-preview-question7355032">' + escapeHtml(data.label) + ' 수강신청 안내</div><div class="ulim-ca-preview-notice7355032">' + escapeHtml(data.notice).replace(/\n/g, '<br>') + '</div><div class="ulim-ca-preview-actions7355032" style="grid-template-columns:1fr"><button type="button" class="ulim-ca-preview-btn7355032 primary" data-ca-preview-action="next">다음</button></div>';
      return;
    }
    if (previewStep === 2) {
      body.innerHTML = previewProgress() + '<div class="ulim-ca-preview-question7355032">' + escapeHtml(data.label) + ' 수강신청 여부</div><div class="ulim-ca-preview-sub7355032">아니오를 선택하면 ' + escapeHtml(data.label) + ' 휴원 신청으로 접수되는 흐름입니다.</div><div class="ulim-ca-preview-actions7355032"><button type="button" class="ulim-ca-preview-btn7355032 danger" data-ca-preview-action="leave">X · 휴원</button><button type="button" class="ulim-ca-preview-btn7355032 primary" data-ca-preview-action="yes">O · 수강신청</button></div>';
      return;
    }
    if (previewStep === 3) {
      body.innerHTML = previewProgress() + '<div class="ulim-ca-preview-question7355032">현재 수강반을 그대로 유지하시겠습니까?</div><div class="ulim-ca-preview-notice7355032"><b>현재 수강반</b><br>' + escapeHtml(data.currentClasses.join('\n')).replace(/\n/g, '<br>') + '</div><div class="ulim-ca-preview-actions7355032"><button type="button" class="ulim-ca-preview-btn7355032" data-ca-preview-action="change">X · 반 변경</button><button type="button" class="ulim-ca-preview-btn7355032 primary" data-ca-preview-action="keep">O · 현재반 유지</button></div>';
      return;
    }
    const classesHtml = data.classes.length ? data.classes.map(function (item) {
      const label = text(item.className) + (text(item.instructorName) ? ' / ' + text(item.instructorName) : '');
      return '<label class="ulim-ca-preview-class7355032"><input type="checkbox" data-ca-preview-class value="' + escapeHtml(item.classId) + '"><span>' + escapeHtml(label) + '</span></label>';
    }).join('') : '<div class="ulim-ca-preview-notice7355032">현재 선택된 모집반이 없습니다.</div>';
    body.innerHTML = previewProgress() + '<div class="ulim-ca-preview-question7355032">' + escapeHtml(data.label) + '에 수강할 반을 선택해주세요.</div><div class="ulim-ca-preview-sub7355032">한 개 또는 여러 개의 반을 선택할 수 있습니다.</div><div class="ulim-ca-preview-classes7355032">' + classesHtml + '</div><div class="ulim-ca-preview-actions7355032"><button type="button" class="ulim-ca-preview-btn7355032" data-ca-preview-action="back">이전</button><button type="button" class="ulim-ca-preview-btn7355032 primary" data-ca-preview-action="finish"' + (data.classes.length ? '' : ' disabled') + '>수강신청 완료</button></div>';
  }

  function install() {
    if (!isSuperAdmin()) return;
    ensureModals();
    cleanupLegacyUi();
    watchUntilEntryReady();
    installed = true;
  }

  global.addEventListener('ulim-firebase-auth-ready', function () { setTimeout(install, 80); });
  global.addEventListener('pageshow', function () { setTimeout(install, 100); });
  global.addEventListener('ulim-student-directory-updated', function () { setTimeout(convergeEntryPoint, 0); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true }); else install();
  setTimeout(install, 600);

  global.__ULIM_COURSE_APPLICATION_ADMIN_API_7355032__ = {
    version: VERSION,
    open: openMainModal,
    close: closeMainModal,
    preview: openPreviewModal,
    refresh: function () { return loadDashboard(true); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
