(function (global) {
  'use strict';
  if (global.__ULIM_DATA_AUTHORITY_7354146__) return;
  global.__ULIM_DATA_AUTHORITY_7354146__ = true;
  global.__ULIM_DATA_AUTHORITY_7354144__ = true;
  global.__ULIM_DATA_AUTHORITY_73541431__ = true;
  global.__ULIM_DATA_AUTHORITY_7354143__ = true;
  global.__ULIM_DATA_AUTHORITY_7354141__ = true;
  global.__ULIM_DATA_AUTHORITY_735414__ = true;
  global.ULIM_DATA_AUTHORITY_VERSION = '2026-08-05.735.04.14.6-backup-client-timeout-fix';
  global.ULIM_CLASSROOM_POLICY_735414 = 'dynamic_from_realtimeClassroomDays_only';

  var CARD_ID = 'ulimDataAuthorityCard735414';
  var STATUS_ID = 'ulimDataAuthorityStatus735414';
  var ITEMS_ID = 'ulimDataAuthorityItems735414';
  var RUN_ID_KEY = 'ulimDataAuthorityRunId735414';
  var current = { runId: '', run: null, items: [] };
  var RECOVERY_RUN_ID_73541431 = 'data-authority-analysis-735414-49b23258-ea60-44f0-a9b8-194ed7b8a5c5';
  var installing = false;
  var retryTimer = null;
  var retryCount = 0;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function isSuperAdmin() {
    try { if (typeof global.adminIsFullAdmin === 'function' && global.adminIsFullAdmin()) return true; } catch (_ignore) {}
    var info = global.adminInfo || {};
    try { if (!info || !Object.keys(info).length) info = JSON.parse(localStorage.getItem('adminInfo') || '{}'); } catch (_ignore2) {}
    var role = normalize(info.firebaseRole || info.role || info.permission);
    return role === 'superadmin' || role === 'super' || role === normalize('전체관리자') || role === normalize('전체관리') || role === normalize('원장');
  }
  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }
  async function runtime() {
    var room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('관리자 기능을 준비하지 못했습니다.');
    var rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('교직원 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'data-authority-735414');
    else await rt.sdk.getIdToken(rt.auth.currentUser, false);
    return rt;
  }
  async function call(name, payload, timeoutMs) {
    var rt = await runtime();
    var options = {};
    var requestedTimeout = Number(timeoutMs || 0);
    if (Number.isFinite(requestedTimeout) && requestedTimeout > 0) options.timeout = requestedTimeout;
    var fn = rt.sdk.httpsCallable(rt.functions, name, options);
    var response = await fn(payload || {});
    return response && response.data || {};
  }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function showLoading(message) { try { if (typeof global.showLoading === 'function') global.showLoading(message || '처리 중...'); } catch (_ignore) {} }
  function hideLoading() { try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {} }
  function setStatus(message, state) {
    var node = document.getElementById(STATUS_ID);
    if (!node) return;
    node.textContent = message || '';
    node.dataset.state = state || '';
    node.style.display = message ? 'block' : 'none';
  }
  function storedRunId() {
    try { return text(localStorage.getItem(RUN_ID_KEY)); } catch (_ignore) { return ''; }
  }
  function rememberRunId(runId) {
    current.runId = text(runId);
    try { if (current.runId) localStorage.setItem(RUN_ID_KEY, current.runId); else localStorage.removeItem(RUN_ID_KEY); } catch (_ignore) {}
    var input = document.getElementById('ulimDataAuthorityRunIdInput735414');
    if (input) input.value = current.runId;
  }
  function stateLabel(state) {
    var labels = {
      analyzing: '분석 중', analysis_complete: '분석·계획 완료', approval_complete: '관리자 승인 완료', applying: '적용 중',
      apply_complete: '안전항목 적용 완료', apply_partial: '일부 적용·확인 필요', activated: 'Firestore 원본 전환 완료',
      rolled_back: '복구 완료', rollback_partial: '일부 복구·확인 필요', analysis_failed: '분석 실패'
    };
    return labels[text(state)] || text(state) || '시작 전';
  }
  function itemTypeLabel(type) {
    var labels = {
      fill_missing_student_fields: '학생 기본정보 보완', upsert_enrollment_from_sheet: '수강반 연결',
      repair_enrollment_projection: '수강 운영연결 보완', sync_student_enrollment_summary: '학생 반목록 정리',
      link_subsystem_record: '운영기록 UID 연결', remove_fixed_room_fields: '고정 강의실 제거', manual_review: '관리자 확인 보류'
    };
    return labels[text(type)] || text(type);
  }
  function badge(label, kind) { return '<span class="ulim-da-badge ' + escapeHtml(kind || '') + '">' + escapeHtml(label) + '</span>'; }
  function renderSummary() {
    var run = current.run || {};
    var summary = run.summary || {};
    var node = document.getElementById('ulimDataAuthoritySummary735414');
    if (!node) return;
    node.innerHTML =
      '<div class="ulim-da-summary-grid">' +
        '<div><b>현재 상태</b><span>' + escapeHtml(stateLabel(run.state)) + '</span></div>' +
        '<div><b>학생</b><span>' + Number(summary.students || 0) + '명</span></div>' +
        '<div><b>운영 반</b><span>' + Number(summary.classes || 0) + '개</span></div>' +
        '<div><b>안전 적용 후보</b><span>' + Number(summary.safeItems || 0) + '건</span></div>' +
        '<div><b>관리자 보류</b><span>' + Number(summary.manualReviewItems || run.issueCount || 0) + '건</span></div>' +
        '<div><b>차단 확인</b><span>' + Number(summary.blockingItems || 0) + '건</span></div>' +
      '</div>' +
      (summary.studentSheetError || summary.attendanceSheetError
        ? '<div class="ulim-da-warning">Google Sheets 참고자료 일부를 읽지 못했습니다. 해당 자료가 정상화된 뒤 1단계 분석을 다시 실행해야 합니다.</div>'
        : '');
  }
  function renderItems() {
    var wrap = document.getElementById(ITEMS_ID);
    if (!wrap) return;
    var items = Array.isArray(current.items) ? current.items : [];
    if (!items.length) { wrap.innerHTML = '<div class="ulim-da-empty">분석을 실행하면 계획과 보류항목이 여기에 표시됩니다.</div>'; return; }
    var visible = items.slice(0, 500);
    var rows = visible.map(function (item) {
      var safe = item.autoApplicable === true && item.blocking !== true;
      var approval = text(item.approvalStatus) || 'pending';
      var applied = text(item.applyStatus) || 'pending';
      return '<tr>' +
        '<td>' + badge(itemTypeLabel(item.type), item.type === 'manual_review' ? 'hold' : 'normal') + '</td>' +
        '<td><b>' + escapeHtml(item.summary) + '</b><div class="ulim-da-reason">' + escapeHtml(item.reason) + '</div></td>' +
        '<td>' + (safe ? badge('안전후보', 'safe') : badge(item.blocking ? '차단·보류' : '관리자 확인', 'hold')) + '</td>' +
        '<td>' + badge(approval === 'approved' ? '승인' : approval === 'rejected' ? '제외' : approval === 'hold' ? '보류' : '미승인', approval === 'approved' ? 'safe' : 'hold') + '</td>' +
        '<td>' + badge(applied === 'complete' ? '적용완료' : applied === 'failed' ? '실패' : applied === 'drifted' ? '변경감지' : applied === 'rolled_back' ? '복구됨' : '대기', applied === 'complete' ? 'safe' : applied === 'failed' || applied === 'drifted' ? 'danger' : 'normal') + '</td>' +
      '</tr>';
    }).join('');
    wrap.innerHTML = '<div class="ulim-da-table-wrap"><table><thead><tr><th>구분</th><th>내용</th><th>자동판정</th><th>승인</th><th>적용</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (items.length > visible.length ? '<div class="ulim-da-note">화면에는 앞의 500건만 표시합니다. 전체 항목은 실행내역에 모두 보존됩니다.</div>' : '');
  }
  function updateButtons() {
    var run = current.run || {};
    var state = text(run.state);
    var ids = {
      approve: 'ulimDataAuthorityApprove735414', apply: 'ulimDataAuthorityApply735414', activate: 'ulimDataAuthorityActivate735414', rollback: 'ulimDataAuthorityRollback735414'
    };
    var approve = document.getElementById(ids.approve); if (approve) approve.disabled = state !== 'analysis_complete' && state !== 'approval_complete';
    var apply = document.getElementById(ids.apply);
    if (apply) {
      apply.disabled = state !== 'approval_complete' && state !== 'apply_partial';
      apply.textContent = state === 'apply_partial'
        ? '미적용 항목 안전 재시도'
        : '승인항목 적용';
    }
    var activate = document.getElementById(ids.activate); if (activate) activate.disabled = state !== 'apply_complete';
    var rollback = document.getElementById(ids.rollback); if (rollback) rollback.disabled = !['apply_complete', 'apply_partial', 'approval_complete', 'activated'].includes(state);
  }
  function renderAll() { renderSummary(); renderItems(); updateButtons(); }

  function injectStyles() {
    if (document.getElementById('ulimDataAuthorityStyle735414')) return;
    var style = document.createElement('style');
    style.id = 'ulimDataAuthorityStyle735414';
    style.textContent = [
      '#' + CARD_ID + '{margin:14px 0 18px;padding:16px;border:2px solid #1d4ed8;border-radius:16px;background:#f8fbff}',
      '#' + CARD_ID + ' h3{margin:0 0 8px;color:#1e3a8a}',
      '#' + CARD_ID + ' .ulim-da-principle{padding:11px 13px;border-radius:11px;background:#e0f2fe;color:#0c4a6e;font-size:13px;line-height:1.6}',
      '#' + CARD_ID + ' .ulim-da-principle b{color:#0f172a}',
      '#' + CARD_ID + ' .ulim-da-runbar{display:grid;grid-template-columns:minmax(250px,1fr) auto;gap:8px;margin-top:12px}',
      '#' + CARD_ID + ' input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #94a3b8;border-radius:9px;background:#fff;pointer-events:auto!important;user-select:text!important;-webkit-user-select:text!important;position:relative;z-index:3}',
      '#' + CARD_ID + ' .ulim-da-steps{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:10px;margin-top:12px}',
      '#' + CARD_ID + ' .ulim-da-step{padding:12px;border:1px solid #cbd5e1;border-radius:12px;background:#fff}',
      '#' + CARD_ID + ' .ulim-da-step b{display:block;color:#0f172a;margin-bottom:5px}',
      '#' + CARD_ID + ' .ulim-da-step p{min-height:42px;margin:0 0 9px;color:#475569;font-size:12px;line-height:1.45}',
      '#' + CARD_ID + ' .ulim-da-step button{width:100%}',
      '#' + STATUS_ID + '{display:none;white-space:pre-line;margin-top:12px;padding:11px 13px;border-radius:10px;font-size:13px;font-weight:700}',
      '#' + STATUS_ID + '[data-state="ok"]{display:block;background:#dcfce7;color:#166534}',
      '#' + STATUS_ID + '[data-state="warn"]{display:block;background:#fef3c7;color:#92400e}',
      '#' + STATUS_ID + '[data-state="error"]{display:block;background:#fee2e2;color:#991b1b}',
      '#' + STATUS_ID + '[data-state="loading"]{display:block;background:#dbeafe;color:#1e40af}',
      '#' + CARD_ID + ' .ulim-da-summary-grid{display:grid;grid-template-columns:repeat(6,minmax(105px,1fr));gap:7px;margin-top:12px}',
      '#' + CARD_ID + ' .ulim-da-summary-grid>div{padding:9px;border-radius:9px;background:#fff;border:1px solid #e2e8f0}',
      '#' + CARD_ID + ' .ulim-da-summary-grid b,#' + CARD_ID + ' .ulim-da-summary-grid span{display:block;font-size:11px}',
      '#' + CARD_ID + ' .ulim-da-summary-grid span{margin-top:3px;font-size:13px;font-weight:900;color:#1e3a8a}',
      '#' + CARD_ID + ' .ulim-da-warning{margin-top:8px;padding:9px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:12px}',
      '#' + CARD_ID + ' .ulim-da-table-wrap{max-height:430px;overflow:auto;margin-top:12px;border:1px solid #cbd5e1;border-radius:11px;background:#fff}',
      '#' + CARD_ID + ' table{width:100%;min-width:850px;border-collapse:collapse}',
      '#' + CARD_ID + ' th{position:sticky;top:0;background:#f1f5f9;padding:8px;text-align:left;font-size:11px;z-index:1}',
      '#' + CARD_ID + ' td{padding:8px;border-top:1px solid #e2e8f0;font-size:12px;vertical-align:top}',
      '#' + CARD_ID + ' .ulim-da-reason{margin-top:3px;color:#64748b;font-size:10px}',
      '#' + CARD_ID + ' .ulim-da-badge{display:inline-flex;padding:3px 7px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:10px;font-weight:850;white-space:nowrap}',
      '#' + CARD_ID + ' .ulim-da-badge.safe{background:#dcfce7;color:#166534}',
      '#' + CARD_ID + ' .ulim-da-badge.hold{background:#fef3c7;color:#92400e}',
      '#' + CARD_ID + ' .ulim-da-badge.danger{background:#fee2e2;color:#991b1b}',
      '#' + CARD_ID + ' .ulim-da-empty,#' + CARD_ID + ' .ulim-da-note{padding:13px;color:#64748b;font-size:12px}',
      '#' + CARD_ID + ' .ulim-da-danger{margin-top:10px;display:flex;justify-content:flex-end}',
      '@media(max-width:1100px){#' + CARD_ID + ' .ulim-da-steps{grid-template-columns:repeat(2,minmax(220px,1fr))}#' + CARD_ID + ' .ulim-da-summary-grid{grid-template-columns:repeat(3,1fr)}}',
      '@media(max-width:680px){#' + CARD_ID + ' .ulim-da-steps{grid-template-columns:1fr}#' + CARD_ID + ' .ulim-da-runbar{grid-template-columns:1fr}#' + CARD_ID + ' .ulim-da-summary-grid{grid-template-columns:repeat(2,1fr)}}'
    ].join('');
    document.head.appendChild(style);
  }
  function cardHtml() {
    return '<section id="' + CARD_ID + '">' +
      '<h3>Firestore 원본 전환 · 6단계 정리</h3>' +
      '<div class="ulim-da-principle"><b>운영 원본은 Firestore, Google Sheets는 참고·백업 전용입니다.</b><br>동명이인·정보 부족·반 판단 불가는 자동 병합하지 않고 관리자 보류로 남깁니다. 강의실은 반에 저장하지 않고 해당 날짜의 강의실 사용일지에서만 조회합니다.</div>' +
      '<div class="ulim-da-runbar"><input id="ulimDataAuthorityRunIdInput735414" type="text" autocomplete="off" spellcheck="false" placeholder="실행번호 입력 또는 현재 실행 이어서"><button type="button" class="admin-btn" onclick="ulimDataAuthorityLoadRun735414()">실행내역 불러오기</button><button type="button" class="admin-btn green" onclick="ulimDataAuthorityLoadRecoveryRun73541431()">현재 부분적용 실행 이어서</button></div>' +
      '<div class="ulim-da-steps">' +
        '<div class="ulim-da-step"><b>1단계 · 읽기 전용 분석</b><p>Firestore와 학생명단·출석부 시트를 비교합니다. 운영 데이터는 변경하지 않습니다.</p><button type="button" class="admin-btn blue" onclick="ulimDataAuthorityAnalyze735414()">분석 실행</button></div>' +
        '<div class="ulim-da-step"><b>2단계 · 정리 계획 확인</b><p>안전 적용 후보와 관리자 확인 보류항목을 구분해 표시합니다.</p><button type="button" class="admin-btn" onclick="ulimDataAuthorityLoadRun735414()">계획 다시 보기</button></div>' +
        '<div class="ulim-da-step"><b>3단계 · 관리자 승인</b><p>고유 식별이 완료된 안전항목만 승인하고, 불명확한 항목은 보류합니다.</p><button id="ulimDataAuthorityApprove735414" type="button" class="admin-btn orange" onclick="ulimDataAuthorityApproveSafe735414()" disabled>안전항목 승인</button></div>' +
        '<div class="ulim-da-step"><b>4단계 · 승인항목 적용</b><p>적용 전 필드별 복구 스냅샷을 저장하고 승인된 항목만 반영합니다.</p><button id="ulimDataAuthorityApply735414" type="button" class="admin-btn blue" onclick="ulimDataAuthorityApply735414()" disabled>승인항목 적용</button></div>' +
        '<div class="ulim-da-step"><b>5단계 · Firestore 원본 전환</b><p>학생명단·출석부·태블릿·연습·예약·수강신청의 원본 정책을 Firestore로 확정합니다.</p><button id="ulimDataAuthorityActivate735414" type="button" class="admin-btn blue" onclick="ulimDataAuthorityActivate735414()" disabled>원본 전환 확정</button></div>' +
        '<div class="ulim-da-step"><b>6단계 · Sheets 단방향 백업</b><p>Firestore 자료를 시트 백업 탭에 기록합니다. 시트 실패가 앱 저장을 취소하지 않습니다.</p><button type="button" class="admin-btn" onclick="ulimDataAuthorityBackup735414()">지금 백업 실행</button></div>' +
      '</div>' +
      '<div id="' + STATUS_ID + '"></div><div id="ulimDataAuthoritySummary735414"></div><div id="' + ITEMS_ID + '"></div>' +
      '<div class="ulim-da-danger"><button id="ulimDataAuthorityRollback735414" type="button" class="admin-btn red" onclick="ulimDataAuthorityRollback735414()" disabled>적용내용 복구</button></div>' +
    '</section>';
  }
  function overrideLegacyButtons() {
    var mappings = [
      ['ulimStudentManagementImportSheets7352', '시트 참고자료 분석'],
      ['ulimStudentManagementReconcileRosters7352', '6단계 정합성 관리']
    ];
    mappings.forEach(function (entry) {
      document.querySelectorAll('button[onclick*="' + entry[0] + '"]').forEach(function (button) {
        button.textContent = entry[1];
        button.setAttribute('onclick', 'ulimDataAuthorityOpen735414()');
      });
    });
    global.ulimStudentManagementImportSheets7352 = openPanel;
    global.ulimStudentManagementReconcileRosters7352 = openPanel;
  }
  function findStudentPanel(studentCard) {
    var ids = [
      'adminPanelStudentManagement7352',
      'adminPanelStudents',
      'adminPanelStudentList',
      'adminPanelStudentRoster',
      'adminPanelStudent',
      'adminPanelRoster'
    ];
    for (var index = 0; index < ids.length; index += 1) {
      var panel = document.getElementById(ids[index]);
      if (panel) return panel;
    }
    if (studentCard && typeof studentCard.closest === 'function') {
      return studentCard.closest('.admin-panel') || studentCard.parentElement;
    }
    return null;
  }
  function install() {
    if (installing || !isSuperAdmin()) return false;
    var studentCard = document.getElementById('ulimStudentManagementCard7352');
    var panel = findStudentPanel(studentCard);
    if (!studentCard || !panel) return false;
    installing = true;
    try {
      injectStyles();
      var existing = document.getElementById(CARD_ID);
      if (!existing) studentCard.insertAdjacentHTML('afterbegin', cardHtml());
      rememberRunId(storedRunId() || RECOVERY_RUN_ID_73541431);
      var runInput73541431 = document.getElementById('ulimDataAuthorityRunIdInput735414');
      if (runInput73541431) {
        runInput73541431.disabled = false;
        runInput73541431.readOnly = false;
        runInput73541431.removeAttribute('disabled');
        runInput73541431.removeAttribute('readonly');
        runInput73541431.style.pointerEvents = 'auto';
      }
      overrideLegacyButtons();
      renderAll();
      if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
      return true;
    } finally {
      installing = false;
    }
  }
  function openPanel() {
    install();
    var node = document.getElementById(CARD_ID);
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function analyze() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    if (!confirm('1단계 읽기 전용 분석을 실행할까요?\n학생·출석·연습·예약·수강신청 운영자료는 변경하지 않습니다.')) return;
    showLoading('Firestore와 Google Sheets 참고자료를 읽기 전용으로 비교하는 중...');
    setStatus('1단계 분석 중입니다. 데이터 양에 따라 시간이 걸릴 수 있습니다.', 'loading');
    try {
      var result = await call('createDataAuthorityAnalysisAdmin735414', { requestId: requestId('data-authority-analysis-735414') });
      rememberRunId(result.runId);
      await loadRun();
      setStatus('1단계 분석과 2단계 정리 계획 생성이 완료됐습니다.\n안전후보와 관리자 보류항목을 확인한 뒤 3단계를 진행하세요.', Number((result.summary || {}).blockingItems || 0) ? 'warn' : 'ok');
    } catch (error) { setStatus(text(error && error.message) || '분석에 실패했습니다.', 'error'); alert(text(error && error.message) || '분석에 실패했습니다.'); }
    finally { hideLoading(); }
  }
  async function loadRun(runIdOverride) {
    var input = document.getElementById('ulimDataAuthorityRunIdInput735414');
    var runId = text(runIdOverride) || text(input && input.value) || current.runId || storedRunId();
    if (!runId) return setStatus('먼저 1단계 분석을 실행해주세요.', 'warn');
    showLoading('정리 계획을 불러오는 중...');
    try {
      var result = await call('getDataAuthorityRunAdmin735414', { runId: runId, limit: 3000 });
      current.runId = runId; current.run = result.run || {}; current.items = Array.isArray(result.items) ? result.items : [];
      rememberRunId(runId); renderAll();
      setStatus('실행번호 ' + runId + '의 정리 계획을 불러왔습니다.' + (result.truncated ? '\n화면 표시 한도를 초과한 항목은 서버 실행내역에 보존됩니다.' : ''), result.truncated ? 'warn' : 'ok');
    } catch (error) { setStatus(text(error && error.message) || '실행내역을 불러오지 못했습니다.', 'error'); }
    finally { hideLoading(); }
  }
  async function loadRecoveryRun73541431() {
    var input = document.getElementById('ulimDataAuthorityRunIdInput735414');
    if (input) {
      input.disabled = false;
      input.readOnly = false;
      input.removeAttribute('disabled');
      input.removeAttribute('readonly');
      input.value = RECOVERY_RUN_ID_73541431;
    }
    rememberRunId(RECOVERY_RUN_ID_73541431);
    return loadRun(RECOVERY_RUN_ID_73541431);
  }

  async function approveSafe() {
    if (!current.runId || !current.run) return setStatus('먼저 분석 실행내역을 불러오세요.', 'warn');
    var summary = current.run.summary || {};
    var safe = Number(summary.safeItems || 0); var held = Number(summary.manualReviewItems || 0);
    if (!confirm('고유 식별이 완료된 안전후보 ' + safe + '건만 승인할까요?\n관리자 확인이 필요한 ' + held + '건은 적용하지 않고 보류합니다.')) return;
    showLoading('안전항목 승인 중...');
    try {
      var result = await call('approveDataAuthorityPlanAdmin735414', { runId: current.runId, planDigest: current.run.planDigest, approveSafe: true });
      await loadRun();
      setStatus('3단계 승인 완료: 승인 ' + Number(result.approved || 0) + '건 · 보류 ' + Number(result.held || 0) + '건 · 제외 ' + Number(result.rejected || 0) + '건', Number(result.held || 0) ? 'warn' : 'ok');
    } catch (error) { setStatus(text(error && error.message) || '승인 처리에 실패했습니다.', 'error'); }
    finally { hideLoading(); }
  }
  async function applyApproved() {
    if (!current.runId || !current.run) return setStatus('실행내역을 불러오세요.', 'warn');
    var partial = text(current.run.state) === 'apply_partial';
    var failedCount = Number(current.run.applyFailed || 0);
    var question = partial
      ? '기존에 정상 적용된 항목은 건드리지 않고, 실패·변경감지 ' + failedCount + '건만 안전하게 다시 적용할까요?\n같은 실행이 먼저 수정해서 발생한 변경감지는 허용하지만, 외부에서 변경된 문서는 계속 중단합니다.'
      : '승인된 항목만 Firestore에 적용할까요?\n각 항목의 기존 값은 복구용으로 먼저 보관됩니다.';
    if (!confirm(question)) return;
    showLoading(partial ? '미적용 항목만 다시 확인·적용하는 중...' : '승인항목을 적용하고 태블릿 자료를 갱신하는 중...');
    try {
      var result = await call('applyApprovedDataAuthorityPlanAdmin735414', { runId: current.runId, planDigest: current.run.planDigest });
      await loadRun();
      setStatus(
        (partial ? '4단계 재시도 완료: ' : '4단계 적용 완료: ') +
        '전체 완료·재사용 ' + Number(result.applied || 0) + '건 · 남은 실패/외부변경 ' + Number(result.failed || 0) + '건',
        Number(result.failed || 0) ? 'warn' : 'ok'
      );
    } catch (error) { setStatus(text(error && error.message) || '적용에 실패했습니다.', 'error'); }
    finally { hideLoading(); }
  }
  async function activate() {
    if (!current.runId) return setStatus('실행내역을 불러오세요.', 'warn');
    var phrase = prompt('Firestore를 울림앱 운영 원본으로 확정합니다.\n확인문구 ACTIVATE_FIRESTORE_AUTHORITY 를 입력하세요.');
    if (phrase !== 'ACTIVATE_FIRESTORE_AUTHORITY') return;
    showLoading('Firestore 원본 정책을 확정하는 중...');
    try {
      var result = await call('activateFirestoreAuthorityAdmin735414', { runId: current.runId, confirmation: phrase });
      await loadRun();
      setStatus('5단계 원본 전환 완료.\n학생명단·출석부·태블릿·연습·예약·수강신청은 Firestore를 운영 원본으로 사용하며, Google Sheets는 참고·백업 전용입니다.\n관리자 확인 보류 ' + Number(result.openIssueCount || 0) + '건은 계속 표시됩니다.', Number(result.openIssueCount || 0) ? 'warn' : 'ok');
    } catch (error) { setStatus(text(error && error.message) || '원본 전환에 실패했습니다.', 'error'); }
    finally { hideLoading(); }
  }
  async function backup() {
    var full = confirm('전체 Firestore 운영자료를 Google Sheets 백업 탭에 기록할까요?\n확인: 전체 백업 또는 중단된 전체 백업 이어서 진행\n취소: 마지막 성공 이후 변경분만 백업');
    showLoading(full ? '전체 백업을 실행하거나 중단 지점부터 이어서 처리하는 중...' : '변경분 백업을 실행하는 중...');
    try {
      var clientRequestId = requestId('data-authority-backup-7354144');
      var result = await call('runFirestoreBackupAdmin735414', { full: full, requestId: clientRequestId }, 1820000);
      var results = Array.isArray(result.results) ? result.results : [];
      var total = Number(result.totalSent || results.reduce(function (sum, item) { return sum + Number(item.sent || 0); }, 0));
      var failures = Array.isArray(result.failedCollections) ? result.failedCollections : results.filter(function (item) { return item && item.ok === false; });
      if (result.ok === false || failures.length) {
        var details = failures.slice(0, 8).map(function (item) {
          return text(item.collection || 'unknown') + ': ' + text(item.error || '원인 미확인');
        }).join('\n');
        setStatus(
          '6단계 백업 일부 실패: 성공 전송 ' + total + '건 · 실패 컬렉션 ' + failures.length + '개' +
          '\n백업ID: ' + text(result.backupId || '') +
          (details ? '\n' + details : '') +
          '\nFirestore 운영자료는 유지됩니다. 원인을 수정한 뒤 같은 버튼을 다시 누르면 중단된 전체 백업을 이어서 처리합니다.',
          'error'
        );
        return;
      }
      setStatus(
        '6단계 Sheets 단방향 백업 완료: ' + total + '건 · ' + (full ? '전체' : '변경분') + ' 백업' +
        (result.resumed ? '\n이전 중단 백업을 이어서 완료했습니다.' : '') +
        '\n백업ID: ' + text(result.backupId || ''),
        'ok'
      );
    } catch (error) {
      var errorText = text(error && error.message) || '백업에 실패했습니다.';
      if (/deadline-exceeded/i.test(errorText)) errorText = '백업 서버 응답 대기시간이 초과되었습니다. 서버 작업은 계속 진행될 수 있습니다.';
      setStatus(errorText + '\nFirestore 운영자료는 이미 저장되어 있으며, 백업 실패가 앱 저장을 취소하지 않습니다. 잠시 후 같은 버튼을 다시 누르면 중단된 백업 ID로 이어서 처리됩니다.', 'error');
    } finally { hideLoading(); }
  }
  async function rollback() {
    if (!current.runId) return;
    var phrase = prompt('4단계에서 적용한 항목을 복구합니다.\n현재 원본 전환이 활성화된 실행이면 원본 정책을 안전하게 해제한 뒤 복구합니다.\n확인문구 ROLLBACK_DATA_AUTHORITY_RUN 을 입력하세요.');
    if (phrase !== 'ROLLBACK_DATA_AUTHORITY_RUN') return;
    showLoading('복구 스냅샷을 적용하는 중...');
    try {
      var result = await call('rollbackDataAuthorityRunAdmin735414', { runId: current.runId, confirmation: phrase });
      await loadRun();
      setStatus((result.authorityDisabled ? 'Firestore 원본 정책 해제 후 ' : '') + '복구 완료: ' + Number(result.restored || 0) + '건 · 실패 ' + Number(result.failed || 0) + '건', Number(result.failed || 0) ? 'warn' : 'ok');
    } catch (error) { setStatus(text(error && error.message) || '복구에 실패했습니다.', 'error'); }
    finally { hideLoading(); }
  }

  global.ulimDataAuthorityOpen735414 = openPanel;
  global.ulimDataAuthorityAnalyze735414 = analyze;
  global.ulimDataAuthorityLoadRun735414 = loadRun;
  global.ulimDataAuthorityLoadRecoveryRun73541431 = loadRecoveryRun73541431;
  global.ulimDataAuthorityApproveSafe735414 = approveSafe;
  global.ulimDataAuthorityApply735414 = applyApproved;
  global.ulimDataAuthorityActivate735414 = activate;
  global.ulimDataAuthorityBackup735414 = backup;
  global.ulimDataAuthorityRollback735414 = rollback;

  function scheduleInstall(delay) { setTimeout(install, Number(delay) || 0); }
  function startInstallRetry() {
    if (retryTimer || document.getElementById(CARD_ID)) return;
    retryCount = 0;
    retryTimer = setInterval(function () {
      retryCount += 1;
      if (install() || retryCount >= 120) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    }, 500);
  }
  document.addEventListener('click', function (event) {
    var node = event.target && event.target.closest ? event.target.closest('.admin-subtab,[data-admin-panel]') : null;
    if (!node) return;
    var panel = text(node.getAttribute && node.getAttribute('data-admin-panel'));
    if (panel === 'adminPanelStudentManagement7352' || panel === 'adminPanelStudents' || panel === 'adminPanelStudentList' || panel === 'adminPanelStudentRoster' || panel === 'adminPanelStudent' || panel === 'adminPanelRoster') {
      scheduleInstall(30);
      startInstallRetry();
    }
  }, true);
  global.addEventListener('ulim-firebase-auth-ready', function () { scheduleInstall(30); startInstallRetry(); });
  global.addEventListener('pageshow', function () { scheduleInstall(30); startInstallRetry(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scheduleInstall(100); startInstallRetry(); }, { once: true });
  else { scheduleInstall(100); startInstallRetry(); }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(function () {
      if (!document.getElementById(CARD_ID)) { scheduleInstall(60); startInstallRetry(); }
      else overrideLegacyButtons();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})(window);
