(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_MANAGEMENT_V2_73549__) return;
  global.__ULIM_STUDENT_MANAGEMENT_V2_73549__ = true;

  const VERSION = '2026-08-04.735.04.9';
  const PANEL_ID = 'adminPanelStudentManagement7352';
  const CARD_ID = 'ulimStudentManagementCard7352';
  const STATUS_ID = 'ulimStudentManagementStatus7352';
  const TABLE_ID = 'ulimStudentManagementTable7352';
  const SUMMARY_ID = 'ulimStudentManagementSummary7352';
  const FILTER_ID = 'ulimStudentManagementFilter7352';
  const STATUS_FILTER_ID = 'ulimStudentManagementStatusFilter7352';
  const CREATE_FORM_ID = 'ulimStudentCreateForm7352';

  let installed = false;
  let targetPanelId = PANEL_ID;
  let students = [];
  let filtered = [];
  let classes = [];
  let teachers = [];
  let loadingPromise = null;
  const rowKeyMap = new Map();
  const dirtyKeys = new Set();

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function unique(values) { return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))); }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function today() {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function safeKey(uid) {
    const key = 'sv2_' + String(uid || '').replace(/[^0-9A-Za-z_-]/g, '_');
    rowKeyMap.set(key, uid);
    return key;
  }
  function maskedUid(uid) {
    const value = text(uid);
    return value ? '•••' + value.slice(-7) : '';
  }
  function isSuperAdmin() {
    const info = global.adminInfo || {};
    const role = normalize(info.firebaseRole || info.role);
    return role === 'super' || role === 'superadmin' || role === normalize('전체관리자') || role === normalize('전체관리') || role === normalize('원장');
  }
  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('학생정보 관리 기능을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('교직원 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'student-management-stage3-7353');
    else await rt.sdk.getIdToken(rt.auth.currentUser, false);
    return rt;
  }
  async function call(name, payload) {
    const rt = await runtime();
    const fn = rt.sdk.httpsCallable(rt.functions, name);
    const response = await fn(payload || {});
    return response && response.data || {};
  }
  function showLoading(message) { try { if (typeof global.showLoading === 'function') global.showLoading(message || '처리 중...'); } catch (_ignore) {} }
  function hideLoading() { try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {} }
  function setStatus(message, state) {
    const el = document.getElementById(STATUS_ID);
    if (!el) return;
    el.textContent = message || '';
    el.dataset.state = state || '';
    el.style.display = message ? 'block' : 'none';
  }
  function classById(classId) { return classes.find(function (item) { return item.classId === classId; }) || null; }
  function selectedValues(select) {
    return select ? Array.from(select.selectedOptions || []).map(function (option) { return text(option.value); }).filter(Boolean) : [];
  }
  function sameTextSet(left, right) {
    const a = unique(left).sort();
    const b = unique(right).sort();
    return a.length === b.length && a.every(function (value, index) { return value === b[index]; });
  }
  function statusLabel(value) {
    if (value === 'cancelled') return '등록취소';
    if (value === 'leave') return '휴원';
    if (value === 'withdrawn') return '퇴원';
    return '재원';
  }
  function effectiveStudentStatus(student) {
    return student && student.registrationCancelled === true ? 'cancelled' : text(student && student.enrollmentStatus) || 'active';
  }
  function selectedClassDetails(classIds) {
    return unique(classIds).map(classById).filter(Boolean);
  }
  function teacherOptionsHtml(selectedUid) {
    return '<option value="">강사 선택</option>' + teachers.map(function (item) {
      return '<option value="' + escapeHtml(item.instructorUid) + '"' + (item.instructorUid === selectedUid ? ' selected' : '') + '>' + escapeHtml(item.instructorName + 'T') + '</option>';
    }).join('');
  }
  function timeSlotsHtml() {
    const slots = [];
    for (let hour = 10; hour < 22; hour += 1) {
      const next = hour + 1;
      slots.push('<label class="ulim-time-slot"><input type="checkbox" value="' + hour + '"><span>' + String(hour).padStart(2, '0') + ':00~' + String(next).padStart(2, '0') + ':00</span></label>');
    }
    return slots.join('');
  }
  function selectedClassHours() {
    return Array.from(document.querySelectorAll('#ulimClassTimeSlots7354 input[type="checkbox"]:checked'))
      .map(function (input) { return Number(input.value); })
      .filter(function (value) { return Number.isInteger(value); })
      .sort(function (a, b) { return a - b; });
  }
  function contiguousHours(hours) {
    for (let index = 1; index < hours.length; index += 1) if (hours[index] !== hours[index - 1] + 1) return false;
    return true;
  }
  function classPreviewText() {
    const instructorUid = text(document.getElementById('ulimClassInstructor7354') && document.getElementById('ulimClassInstructor7354').value);
    const teacher = teachers.find(function (item) { return item.instructorUid === instructorUid; }) || {};
    const baseName = text(document.getElementById('ulimClassBaseName7354') && document.getElementById('ulimClassBaseName7354').value);
    const hours = selectedClassHours();
    if (!teacher.instructorName || !baseName || !hours.length || !contiguousHours(hours)) return '';
    const start = String(hours[0]).padStart(2, '0') + ':00';
    const end = String(hours[hours.length - 1] + 1).padStart(2, '0') + ':00';
    return '[' + teacher.instructorName + 'T] - ' + baseName + ' ' + start + ' ~ ' + end;
  }
  function updateClassPreview7354() {
    const preview = document.getElementById('ulimClassPreview7354');
    const hours = selectedClassHours();
    if (preview) preview.value = classPreviewText() || (hours.length && !contiguousHours(hours) ? '시간을 연속으로 선택해주세요.' : '');
  }
  function renderClassManagerList7354() {
    const wrap = document.getElementById('ulimClassCatalogList7354');
    if (!wrap) return;
    if (!classes.length) { wrap.innerHTML = '<div style="font-size:12px;color:#64748b;">등록된 반이 없습니다.</div>'; return; }
    wrap.innerHTML = classes.map(function (item) {
      return '<div class="ulim-class-catalog-row"><span>' + escapeHtml(item.className) + '</span><button type="button" class="admin-btn" onclick="ulimClassCatalogRetire7354(\'' + escapeHtml(item.classId) + '\')">사용중지</button></div>';
    }).join('');
  }
  function classOptionsHtml(selectedClassIds) {
    const selected = new Set(unique(selectedClassIds));
    return classes.map(function (item) {
      const label = item.className + (item.instructorName ? ' / ' + item.instructorName : ' / 담당강사 연결 필요');
      return '<option value="' + escapeHtml(item.classId) + '"' + (selected.has(item.classId) ? ' selected' : '') + (item.selectable === false ? ' disabled' : '') + '>' + escapeHtml(label) + '</option>';
    }).join('');
  }
  function tagsHtml(classIds, legacyNames) {
    const tags = selectedClassDetails(classIds).map(function (item) {
      return '<span class="ulim-student-class-tag">' + escapeHtml(item.className) + '</span>';
    });
    unique(legacyNames).forEach(function (name) {
      tags.push('<span class="ulim-student-class-tag legacy">' + escapeHtml(name) + ' · 기존 연결</span>');
    });
    return tags.length ? tags.join('') : '<span class="ulim-student-empty-tag">선택된 반 없음</span>';
  }
  function instructorText(classIds, fallback) {
    const names = selectedClassDetails(classIds).map(function (item) { return text(item.instructorName); }).filter(Boolean);
    return unique(names.length ? names : fallback || []).join(', ');
  }
  function syncBadge(label, state, message) {
    const key = text(state) || 'complete';
    const css = key === 'failed' ? 'fail' : (key === 'pending' || key === 'processing' ? 'wait' : 'ok');
    const textLabel = key === 'failed' ? label + ' 확인필요' : (key === 'pending' || key === 'processing' ? label + ' 대기' : label + ' 완료');
    return '<span class="ulim-student-sync ' + css + '" title="' + escapeHtml(message || '') + '">' + escapeHtml(textLabel) + '</span>';
  }
  function studentSyncHtml(student) {
    return '<div class="ulim-sync-stack">' +
      syncBadge('기본정보', student.dataSaveState || 'complete', '') +
      syncBadge('앱운영', student.operationalSyncState || 'complete', student.operationalSyncMessage) +
      syncBadge('명단', student.sheetSyncState, student.sheetSyncMessage) +
      syncBadge('로그인', student.authSyncState, student.authSyncMessage) +
      syncBadge('출석부', student.attendanceSyncState, student.attendanceSyncMessage) +
      '</div>';
  }

  function injectStyles() {
    if (document.getElementById('ulimStudentManagementStyle7352')) return;
    const style = document.createElement('style');
    style.id = 'ulimStudentManagementStyle7352';
    style.textContent = `
      #${CARD_ID}{margin-bottom:16px}#${CARD_ID} .ulim-student-help{padding:12px 14px;border-radius:12px;background:#eff6ff;color:#1e3a8a;font-size:13px;line-height:1.6;margin-bottom:12px}
      #${STATUS_ID}{display:none;white-space:pre-line;padding:11px 13px;border-radius:10px;margin:10px 0;font-size:13px;font-weight:700}#${STATUS_ID}[data-state="ok"]{display:block;background:#ecfdf5;color:#166534}#${STATUS_ID}[data-state="warn"]{display:block;background:#fffbeb;color:#92400e}#${STATUS_ID}[data-state="error"]{display:block;background:#fff1f2;color:#9f1239}#${STATUS_ID}[data-state="loading"]{display:block;background:#eff6ff;color:#1d4ed8}
      #${CARD_ID} .ulim-create-box{margin:14px 0;padding:14px;border:1px solid #bfdbfe;background:#f8fbff;border-radius:14px}#${CARD_ID} .ulim-create-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px}#${CARD_ID} .wide{grid-column:span 2}
      #${CARD_ID} .ulim-create-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}#${CARD_ID} .ulim-password-preview{margin-right:auto;padding:8px 10px;border-radius:9px;background:#fff7ed;color:#9a3412;font-size:12px;font-weight:800}
      #${CARD_ID} .ulim-time-slots{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:7px}#${CARD_ID} .ulim-time-slot{display:flex;align-items:center;gap:5px;padding:7px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:11px;cursor:pointer}#${CARD_ID} .ulim-time-slot input{width:auto}#${CARD_ID} .ulim-class-catalog-list{display:grid;gap:6px;max-height:280px;overflow:auto}#${CARD_ID} .ulim-class-catalog-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:9px;background:#fff;font-size:12px}#${CARD_ID} .ulim-class-catalog-row span{font-weight:700}
      #${CARD_ID} .ulim-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 160px auto;gap:10px;align-items:end;margin:14px 0}#${CARD_ID} .ulim-toolbar-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
      #${CARD_ID} .ulim-table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px}#${CARD_ID} table{width:100%;min-width:1940px;border-collapse:collapse;background:#fff}#${CARD_ID} th{position:sticky;top:0;z-index:2;background:#f8fafc;color:#334155;font-size:12px;padding:9px;border-bottom:1px solid #cbd5e1;white-space:nowrap}#${CARD_ID} td{padding:7px;border-bottom:1px solid #edf2f7;vertical-align:top}#${CARD_ID} td input,#${CARD_ID} td select,#${CARD_ID} .ulim-create-grid input,#${CARD_ID} .ulim-create-grid select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:#fff;font-size:12px}#${CARD_ID} td select[multiple]{min-width:260px}
      #${CARD_ID} tr.ulim-dirty-row{background:#fffbea}#${CARD_ID} .ulim-operation-note{font-size:10px;color:#64748b;line-height:1.45;margin-top:4px;max-width:180px}#${CARD_ID} .ulim-relation-badge{display:inline-flex;margin-top:4px;padding:2px 6px;border-radius:999px;background:#ecfdf5;color:#166534;font-size:9px;font-weight:800}#${CARD_ID} .ulim-relation-badge.legacy{background:#fef3c7;color:#92400e}#${CARD_ID} tr.ulim-saving-row{opacity:.58}#${CARD_ID} .ulim-student-uid{margin-top:4px;font-size:10px;color:#94a3b8}#${CARD_ID} .ulim-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;max-width:310px}#${CARD_ID} .ulim-student-class-tag{display:inline-flex;padding:3px 7px;border-radius:999px;background:#dbeafe;color:#1e40af;font-size:10px;font-weight:800}#${CARD_ID} .ulim-student-class-tag.legacy{background:#fef3c7;color:#92400e}#${CARD_ID} .ulim-student-empty-tag{font-size:10px;color:#94a3b8}
      #${CARD_ID} .ulim-sync-stack{display:flex;gap:4px;flex-wrap:wrap;max-width:210px}#${CARD_ID} .ulim-student-sync{display:inline-flex;padding:3px 6px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}#${CARD_ID} .ulim-student-sync.ok{background:#dcfce7;color:#166534}#${CARD_ID} .ulim-student-sync.wait{background:#fef3c7;color:#92400e}#${CARD_ID} .ulim-student-sync.fail{background:#fee2e2;color:#991b1b}#${CARD_ID} .ulim-row-actions{display:flex;gap:5px;flex-wrap:wrap}
      @media(max-width:1100px){#${CARD_ID} .ulim-create-grid{grid-template-columns:repeat(2,minmax(150px,1fr))}}@media(max-width:850px){#${CARD_ID} .ulim-toolbar{grid-template-columns:1fr}#${CARD_ID} .ulim-toolbar-actions{justify-content:flex-start}}@media(max-width:620px){#${CARD_ID} .ulim-create-grid{grid-template-columns:1fr}#${CARD_ID} .wide{grid-column:span 1}}
    `;
    document.head.appendChild(style);
  }

  function findExistingPanel() {
    const ids = ['adminPanelStudents', 'adminPanelStudentList', 'adminPanelStudentRoster', 'adminPanelStudent', 'adminPanelRoster'];
    for (const id of ids) {
      const panel = document.getElementById(id);
      if (panel) return panel;
    }
    return null;
  }

  function cardHtml() {
    return `<div id="${CARD_ID}" class="admin-card admin-full-only">
      <h3 style="margin-top:0;">학생정보 관리</h3>
      <div class="ulim-student-help"><b>필수입력은 학생명과 학생 전화번호뿐입니다.</b> 생년월일·보호자전화·등록일·수강반·메모는 빈칸으로 저장하거나 나중에 수정할 수 있습니다. 수강반 선택을 바꾸고 저장하면 선택된 반목록이 최종 수강반으로 적용됩니다. 수강반 선택을 바꾸면 일반 수정으로 정정되며 신규·반이동·보강은 처리구분에서 직접 선택한 경우에만 적용됩니다. 등록 취소 후에는 학생 삭제 버튼으로 최종 삭제합니다.</div>
      <div id="${STATUS_ID}"></div>
      <details class="ulim-create-box" open><summary style="cursor:pointer;font-weight:900;color:#1e3a8a;">학생 추가</summary>
        <div id="${CREATE_FORM_ID}" class="ulim-create-grid" style="margin-top:12px;">
          <div class="admin-field"><label>학생명 *</label><input id="ulimNewStudentName7352" autocomplete="off"></div>
          <div class="admin-field"><label>생년월일</label><input id="ulimNewStudentBirth7352" type="date"></div>
          <div class="admin-field"><label>학생 전화번호 *</label><input id="ulimNewStudentPhone7352" inputmode="tel" autocomplete="off"></div>
          <div class="admin-field"><label>보호자 전화번호</label><input id="ulimNewStudentParent7352" inputmode="tel" autocomplete="off"></div>
          <div class="admin-field"><label>재원상태</label><select id="ulimNewStudentStatus7352"><option value="active">재원</option><option value="leave">휴원</option><option value="withdrawn">퇴원</option><option value="cancelled">등록취소</option></select></div>
          <div class="admin-field"><label>수강 시작일</label><input id="ulimNewStudentStart7352" type="date"></div>
          <div class="admin-field"><label>등록 구분</label><select id="ulimNewStudentType7352"><option value="new">신규</option><option value="existing">기존등록</option></select></div>
          <div class="admin-field"><label>관리자 메모</label><input id="ulimNewStudentMemo7352"></div>
          <div class="admin-field wide"><label>수강반 (선택·복수가능)</label><select id="ulimNewStudentClasses7352" multiple size="6"></select><div id="ulimNewStudentTags7352" class="ulim-tags"></div></div>
          <div class="admin-field wide"><label>담당강사 자동 연결</label><input id="ulimNewStudentInstructors7352" readonly placeholder="수강반을 선택하면 표시됩니다."></div>
        </div>
        <div class="ulim-create-actions"><span id="ulimNewStudentPassword7352" class="ulim-password-preview">출결번호·최초 비밀번호: 전화번호 마지막 네 자리</span><button type="button" class="admin-btn" onclick="ulimStudentManagementReloadClasses7352()">반 목록 다시 불러오기</button><button type="button" class="admin-btn blue" onclick="ulimStudentManagementCreate7352()">학생 추가</button></div>
      </details>
      <details class="ulim-create-box"><summary style="cursor:pointer;font-weight:900;color:#7c3aed;">Firestore 반 목록 관리</summary>
        <div class="ulim-create-grid" style="margin-top:12px;">
          <div class="admin-field"><label>담당강사 *</label><select id="ulimClassInstructor7354"></select></div>
          <div class="admin-field wide"><label>반명 *</label><input id="ulimClassBaseName7354" placeholder="일요일 청소년 중급B"></div>
          <div class="admin-field"><label>강의실</label><input id="ulimClassRoom7354" placeholder="미입력 시 데스크문의"></div>
          <div class="admin-field wide"><label>수업시간 (10:00~22:00, 복수·연속선택)</label><div id="ulimClassTimeSlots7354" class="ulim-time-slots">${timeSlotsHtml()}</div></div>
          <div class="admin-field wide"><label>생성될 반명</label><input id="ulimClassPreview7354" readonly placeholder="강사·반명·시간을 선택하면 표시됩니다."></div>
          <div class="admin-field wide"><label>현재 사용 중인 반</label><div id="ulimClassCatalogList7354" class="ulim-class-catalog-list"></div></div>
        </div>
        <div class="ulim-create-actions"><button type="button" class="admin-btn" onclick="ulimStudentManagementReloadClasses7352()">반 목록 새로고침</button><button type="button" class="admin-btn blue" onclick="ulimClassCatalogSave7354()">반 추가</button></div>
      </details>
      <details class="ulim-create-box"><summary style="cursor:pointer;font-weight:900;color:#166534;">앱 수강신청 기간·모집반 설정</summary>
        <div class="ulim-create-grid" style="margin-top:12px;">
          <div class="admin-field"><label>신청 대상월</label><input id="ulimCourseWindowMonth7352" type="month"></div>
          <div class="admin-field"><label>신청 시작</label><input id="ulimCourseWindowOpen7352" type="datetime-local"></div>
          <div class="admin-field"><label>신청 종료</label><input id="ulimCourseWindowClose7352" type="datetime-local"></div>
          <div class="admin-field"><label>학생 화면 표시</label><select id="ulimCourseWindowActive7352"><option value="true">열기</option><option value="false">닫기</option></select></div>
          <div class="admin-field wide"><label>모집반(복수선택)</label><select id="ulimCourseWindowClasses7352" multiple size="7"></select></div>
          <div class="admin-field wide"><label>학생 안내문</label><input id="ulimCourseWindowNotice7352" placeholder="수강신청 및 반 이동 신청을 받습니다."></div>
        </div>
        <div class="ulim-create-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentManagementWindow7352()">수강신청 설정 저장</button></div>
      </details>
      <div class="ulim-toolbar">
        <div class="admin-field"><label>학생 검색</label><input id="${FILTER_ID}" placeholder="학생명 · 출결번호 · 전화번호 · 반 · 강사"></div>
        <div class="admin-field"><label>재원상태</label><select id="${STATUS_FILTER_ID}"><option value="">전체</option><option value="active">재원</option><option value="leave">휴원</option><option value="withdrawn">퇴원</option></select></div>
        <div class="ulim-toolbar-actions"><button type="button" class="admin-btn blue" onclick="ulimStudentManagementLoad7352()">목록 새로고침</button><button type="button" class="admin-btn orange" id="ulimStudentManagementSaveAll7352" onclick="ulimStudentManagementSaveAll7352()">변경사항 전체 저장</button><button type="button" class="admin-btn" onclick="ulimStudentManagementSyncSheets7352()">시트에 즉시 기록</button><button type="button" class="admin-btn" onclick="ulimStudentManagementImportSheets7352()">시트 내용 불러오기</button><button type="button" class="admin-btn" onclick="ulimStudentManagementInspectHomonyms73542()">동명이인 점검</button><button type="button" class="admin-btn" onclick="ulimStudentManagementReconcileRosters7352()">출석부 반 자동매칭</button><button type="button" class="admin-btn" onclick="ulimStudentManagementApplyApplications7352()">수강신청 불러오기·적용</button></div>
      </div>
      <div id="${SUMMARY_ID}" style="font-size:12px;color:#64748b;margin:10px 0;"></div>
      <div class="ulim-table-wrap"><div id="${TABLE_ID}"></div></div>
    </div>`;
  }

  function injectPanel() {
    const existing = findExistingPanel();
    if (existing) {
      targetPanelId = existing.id;
      if (!document.getElementById(CARD_ID)) existing.insertAdjacentHTML('afterbegin', cardHtml());
      return;
    }
    const subtabs = document.querySelector('#adminDashboard .admin-subtabs');
    if (subtabs && !document.querySelector('[data-admin-panel="' + PANEL_ID + '"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-subtab admin-full-only';
      button.dataset.adminPanel = PANEL_ID;
      button.textContent = '학생정보 관리';
      button.onclick = function () {
        if (typeof global.showAdminPanel === 'function') global.showAdminPanel(PANEL_ID);
        else global.ulimStudentManagementLoad7352();
      };
      subtabs.appendChild(button);
    }
    const dashboard = document.getElementById('adminDashboard');
    if (!dashboard || document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'admin-panel';
    panel.innerHTML = cardHtml();
    dashboard.appendChild(panel);
  }

  function normalizeStudent(raw) {
    const student = raw || {};
    return {
      studentUid: text(student.studentUid),
      name: text(student.name),
      birthDate: text(student.birthDate),
      studentPhone: text(student.studentPhone),
      parentPhone: text(student.parentPhone),
      attendanceNo: text(student.attendanceNo),
      enrollmentStatus: text(student.enrollmentStatus) || 'active',
      registrationCancelled: student.registrationCancelled === true,
      finalDeleted: student.finalDeleted === true,
      initialRegisteredDate: text(student.initialRegisteredDate),
      privacyConsent: student.privacyConsent === true,
      portraitConsent: student.portraitConsent === true,
      mustChangePassword: student.mustChangePassword !== false,
      memo: text(student.memo),
      selectedClassIds: unique(student.selectedClassIds),
      legacyUnmappedClassNames: unique(student.legacyUnmappedClassNames),
      instructorNames: unique(student.instructorNames),
      dataSaveState: text(student.dataSaveState) || 'complete',
      sheetSyncState: text(student.sheetSyncState) || 'complete',
      sheetSyncMessage: text(student.sheetSyncMessage),
      authSyncState: text(student.authSyncState) || 'complete',
      authSyncMessage: text(student.authSyncMessage),
      attendanceSyncState: text(student.attendanceSyncState) || 'complete',
      attendanceSyncMessage: text(student.attendanceSyncMessage),
      operationalSyncState: text(student.operationalSyncState) || 'complete',
      operationalSyncMessage: text(student.operationalSyncMessage),
      retryable: student.retryable === true,
      relationSource: text(student.relationSource) || 'legacyFallback'
    };
  }

  function renderCreateClasses() {
    const select = document.getElementById('ulimNewStudentClasses7352');
    if (!select) return;
    const selected = new Set(selectedValues(select));
    select.innerHTML = classOptionsHtml(Array.from(selected));
    const applicationSelect = document.getElementById('ulimCourseWindowClasses7352');
    if (applicationSelect) {
      const applicationSelected = new Set(selectedValues(applicationSelect));
      applicationSelect.innerHTML = classOptionsHtml(Array.from(applicationSelected));
    }
    const instructorSelect = document.getElementById('ulimClassInstructor7354');
    if (instructorSelect) {
      const selectedInstructor = text(instructorSelect.value);
      instructorSelect.innerHTML = teacherOptionsHtml(selectedInstructor);
    }
    const monthInput = document.getElementById('ulimCourseWindowMonth7352');
    if (monthInput && !monthInput.value) monthInput.value = currentMonth();
    renderClassManagerList7354();
    updateClassPreview7354();
    updateCreateClassPreview();
  }

  function updateCreateClassPreview() {
    const select = document.getElementById('ulimNewStudentClasses7352');
    const ids = selectedValues(select);
    const tags = document.getElementById('ulimNewStudentTags7352');
    const instructors = document.getElementById('ulimNewStudentInstructors7352');
    if (tags) tags.innerHTML = tagsHtml(ids, []);
    if (instructors) instructors.value = instructorText(ids, []);
  }

  function updatePasswordPreview() {
    const phone = text(document.getElementById('ulimNewStudentPhone7352') && document.getElementById('ulimNewStudentPhone7352').value);
    const digits = phone.replace(/\D/g, '');
    const preview = document.getElementById('ulimNewStudentPassword7352');
    if (!preview) return;
    preview.textContent = digits.length >= 4 ? '출결번호·최초 비밀번호: ' + digits.slice(-4) : '출결번호·최초 비밀번호: 전화번호 마지막 네 자리';
  }

  function rowData(key) {
    const uid = rowKeyMap.get(key) || '';
    const current = students.find(function (student) { return student.studentUid === uid; }) || {};
    const classIds = selectedValues(document.getElementById(key + '_classes'));
    const originalClassIds = unique(current.selectedClassIds);
    const registrationType = text(document.getElementById(key + '_operation') && document.getElementById(key + '_operation').value) || 'existing';
    const classSelectionChanged = !sameTextSet(classIds, originalClassIds);
    return {
      studentUid: uid,
      name: text(document.getElementById(key + '_name') && document.getElementById(key + '_name').value),
      birthDate: text(document.getElementById(key + '_birth') && document.getElementById(key + '_birth').value),
      studentPhone: text(document.getElementById(key + '_phone') && document.getElementById(key + '_phone').value),
      parentPhone: text(document.getElementById(key + '_parent') && document.getElementById(key + '_parent').value),
      enrollmentStatus: text(document.getElementById(key + '_status') && document.getElementById(key + '_status').value) || 'active',
      initialRegisteredDate: text(document.getElementById(key + '_start') && document.getElementById(key + '_start').value),
      operationDate: text(document.getElementById(key + '_operation_date') && document.getElementById(key + '_operation_date').value),
      classIds: classIds,
      originalClassIds: originalClassIds,
      replaceClassAssignments: classSelectionChanged,
      registrationType: registrationType,
      memo: text(document.getElementById(key + '_memo') && document.getElementById(key + '_memo').value),
      privacyConsent: current.privacyConsent === true,
      portraitConsent: current.portraitConsent === true,
      preserveLegacyClassNames: unique(current.legacyUnmappedClassNames)
    };
  }

  function render() {
    const wrap = document.getElementById(TABLE_ID);
    if (!wrap) return;
    rowKeyMap.clear();
    if (!filtered.length) {
      wrap.innerHTML = '<div style="padding:18px;color:#64748b;">조건에 맞는 학생이 없습니다.</div>';
      updateSummary();
      return;
    }
    const rows = filtered.map(function (student) {
      const key = safeKey(student.studentUid);
      const rowClass = [dirtyKeys.has(key) ? 'ulim-dirty-row' : '', student.registrationCancelled === true ? 'ulim-cancelled-row' : ''].filter(Boolean).join(' ');
      const teachers = instructorText(student.selectedClassIds, student.instructorNames);
      const cancelled = student.registrationCancelled === true;
      const statusSelect = cancelled
        ? '<select id="' + key + '_status" disabled><option value="withdrawn" selected>등록취소</option></select>'
        : '<select id="' + key + '_status" data-row-key="' + key + '"><option value="active"' + (student.enrollmentStatus === 'active' ? ' selected' : '') + '>재원</option><option value="leave"' + (student.enrollmentStatus === 'leave' ? ' selected' : '') + '>휴원</option><option value="withdrawn"' + (student.enrollmentStatus === 'withdrawn' ? ' selected' : '') + '>퇴원</option></select>';
      const actions = '<button type="button" class="admin-btn blue" onclick="ulimStudentManagementSaveRow7352(\'' + key + '\')">저장</button>'
        + '<button type="button" class="admin-btn red" onclick="ulimStudentManagementRetire7352(\'' + key + '\',\'withdraw_delete\')">삭제</button>';
      return `<tr${rowClass ? ' class="' + rowClass + '"' : ''} data-row-key="${key}" data-student-uid="${escapeHtml(student.studentUid)}">
        <td>${statusSelect}</td>
        <td><input value="${escapeHtml(student.attendanceNo)}" readonly><div class="ulim-student-uid">UID ${escapeHtml(maskedUid(student.studentUid))}</div><span class="ulim-relation-badge${student.relationSource === 'studentEnrollments' ? '' : ' legacy'}">${student.relationSource === 'studentEnrollments' ? '반 관계 연결됨' : '기존 반정보'}</span></td>
        <td><input id="${key}_name" data-row-key="${key}" value="${escapeHtml(student.name)}"></td>
        <td><input id="${key}_birth" type="date" data-row-key="${key}" value="${escapeHtml(student.birthDate)}"></td>
        <td><input id="${key}_phone" data-row-key="${key}" value="${escapeHtml(student.studentPhone)}"></td>
        <td><input id="${key}_parent" data-row-key="${key}" value="${escapeHtml(student.parentPhone)}"></td>
        <td><input id="${key}_start" type="date" data-row-key="${key}" value="${escapeHtml(student.initialRegisteredDate)}"></td>
        <td><select id="${key}_operation" data-row-key="${key}"${cancelled ? ' disabled' : ''}><option value="existing">일반 수정</option><option value="new">신규</option><option value="class_move">반이동</option><option value="makeup">보강</option></select><div id="${key}_operation_note" class="ulim-operation-note">일반 수정: 선택한 수강반 목록으로 정정<br>신규·반이동·보강은 직접 선택할 때만 적용</div></td>
        <td><input id="${key}_operation_date" type="date" data-row-key="${key}" value=""${cancelled ? ' disabled' : ''}></td>
        <td><select id="${key}_classes" data-row-key="${key}" data-class-select="true" data-original-class-ids="${escapeHtml(JSON.stringify(unique(student.selectedClassIds)))}" multiple size="4"${cancelled ? ' disabled' : ''}>${classOptionsHtml(student.selectedClassIds)}</select><div id="${key}_tags" class="ulim-tags">${tagsHtml(student.selectedClassIds, student.legacyUnmappedClassNames)}</div></td>
        <td><input id="${key}_instructors" value="${escapeHtml(teachers)}" readonly></td>
        <td><input id="${key}_memo" data-row-key="${key}" value="${escapeHtml(student.memo)}"></td>
        <td>${studentSyncHtml(student)}</td>
        <td><div class="ulim-row-actions">${actions}</div></td>
      </tr>`;
    }).join('');
    wrap.innerHTML = `<table><thead><tr><th>재원상태</th><th>출결번호/UID</th><th>학생명</th><th>생년월일</th><th>학생전화</th><th>보호자전화</th><th>최초 등록일</th><th>처리구분</th><th>처리일</th><th>수강반(복수)</th><th>담당강사</th><th>관리자 메모</th><th>저장상태</th><th>관리</th></tr></thead><tbody>${rows}</tbody></table>`;
    updateSummary();
  }

  function updateRowClassPreview(key) {
    const select = document.getElementById(key + '_classes');
    const ids = selectedValues(select);
    const student = students.find(function (item) { return item.studentUid === (rowKeyMap.get(key) || ''); }) || {};
    const originalIds = unique(student.selectedClassIds);
    const changed = !sameTextSet(ids, originalIds);
    const operation = document.getElementById(key + '_operation');
    const note = document.getElementById(key + '_operation_note');
    const effectiveMode = operation ? (text(operation.value) || 'existing') : 'existing';
    if (note) {
      if (effectiveMode === 'class_move') note.innerHTML = '<b>반이동:</b> 선택한 반목록으로 교체하고 처리일부터 이전 반을 종료합니다.';
      else if (effectiveMode === 'makeup') note.innerHTML = '<b>보강:</b> 선택 반·처리일에만 추가합니다.';
      else if (effectiveMode === 'new') note.innerHTML = '<b>신규:</b> 선택한 반을 신규 등록으로 추가하며 기존 반은 유지합니다.';
      else note.innerHTML = changed
        ? '<b>일반 수정:</b> 잘못 연결된 반을 정정합니다. 신규·반이동·보강 표시는 남기지 않습니다.'
        : '일반 수정 상태입니다. 신규·반이동·보강은 왼쪽 처리구분에서 직접 선택할 때만 적용됩니다.';
    }
    const tags = document.getElementById(key + '_tags');
    const instructors = document.getElementById(key + '_instructors');
    if (tags) tags.innerHTML = tagsHtml(ids, student.legacyUnmappedClassNames || []);
    if (instructors) instructors.value = instructorText(ids, student.instructorNames || []);
  }

  function handleOperationModeChange(key) {
    const operation = document.getElementById(key + '_operation');
    const select = document.getElementById(key + '_classes');
    const note = document.getElementById(key + '_operation_note');
    if (!operation || !select) return;
    const mode = text(operation.value) || 'existing';
    if (mode === 'class_move' || mode === 'makeup') {
      const dateInput = document.getElementById(key + '_operation_date');
      if (dateInput && !dateInput.value) dateInput.value = today();
    }
    if (note) {
      if (mode === 'class_move') note.innerHTML = '<b>반이동:</b> 선택한 반목록으로 교체하고 처리일부터 이전 반을 종료합니다.';
      else if (mode === 'makeup') note.innerHTML = '<b>보강:</b> 선택 반·처리일에만 추가합니다.';
      else if (mode === 'new') note.innerHTML = '<b>신규:</b> 선택한 반을 신규 등록으로 추가하며 기존 반은 유지합니다.';
      else note.innerHTML = '일반 수정 상태입니다. 수강반을 자유롭게 정정할 수 있습니다.';
    }
    updateRowClassPreview(key);
  }

  function markDirty(key) {
    if (!rowKeyMap.has(key)) return;
    dirtyKeys.add(key);
    const row = document.querySelector('tr[data-row-key="' + key + '"]');
    if (row) row.classList.add('ulim-dirty-row');
    updateRowClassPreview(key);
    updateSummary();
  }

  function applyFilter() {
    const keyword = normalize(document.getElementById(FILTER_ID) && document.getElementById(FILTER_ID).value);
    const wantedStatus = text(document.getElementById(STATUS_FILTER_ID) && document.getElementById(STATUS_FILTER_ID).value);
    filtered = students.filter(function (student) {
      if (wantedStatus && effectiveStudentStatus(student) !== wantedStatus) return false;
      if (!keyword) return true;
      const classNames = selectedClassDetails(student.selectedClassIds).map(function (item) { return item.className; });
      const haystack = [student.name, student.attendanceNo, student.studentPhone, student.parentPhone, student.birthDate, classNames.join(' '), student.legacyUnmappedClassNames.join(' '), student.instructorNames.join(' '), student.memo].join(' ');
      return normalize(haystack).indexOf(keyword) >= 0;
    });
    render();
  }

  function updateSummary() {
    const summary = document.getElementById(SUMMARY_ID);
    if (!summary) return;
    const active = filtered.filter(function (student) { return effectiveStudentStatus(student) === 'active'; }).length;
    const leave = filtered.filter(function (student) { return effectiveStudentStatus(student) === 'leave'; }).length;
    const withdrawn = filtered.filter(function (student) { return effectiveStudentStatus(student) === 'withdrawn'; }).length;
    const cancelled = filtered.filter(function (student) { return effectiveStudentStatus(student) === 'cancelled'; }).length;
    const retry = students.filter(function (student) { return student.retryable; }).length;
    const related = students.filter(function (student) { return student.relationSource === 'studentEnrollments'; }).length;
    summary.textContent = '표시 ' + filtered.length + '명 / 전체 ' + students.length + '명 · 재원 ' + active + ' · 휴원 ' + leave + ' · 퇴원 ' + withdrawn + ' · 등록취소 ' + cancelled + ' · 운영반 ' + classes.length + '개 · 저장 대기 ' + dirtyKeys.size + '명 · 확인 필요 ' + retry + '명';
    const button = document.getElementById('ulimStudentManagementSaveAll7352');
    if (button) button.textContent = dirtyKeys.size ? '변경사항 전체 저장 (' + dirtyKeys.size + ')' : '변경사항 전체 저장';
  }

  async function load(forceDiscardDirty) {
    if (!isSuperAdmin()) {
      setStatus('학생정보 관리는 전체관리자만 사용할 수 있습니다.', 'error');
      return false;
    }
    if (loadingPromise) return loadingPromise;
    if (!forceDiscardDirty && dirtyKeys.size && !confirm('저장하지 않은 학생 수정사항이 ' + dirtyKeys.size + '명 있습니다. 목록을 다시 불러오면 사라집니다. 계속할까요?')) return false;
    loadingPromise = (async function () {
      setStatus('학생정보와 운영 반 목록을 불러오는 중...', 'loading');
      const result = await call('listStudentManagementAdmin7352', { requestId: requestId('student-list-7352') });
      classes = Array.isArray(result.classes) ? result.classes.map(function (item) {
        return {
          classId: text(item.classId), className: text(item.className), instructorUid: text(item.instructorUid),
          instructorName: text(item.instructorName), selectable: item.selectable !== false, dates: Array.isArray(item.dates) ? item.dates : [],
          baseName: text(item.baseName), weekday: Number(item.weekday), startTime: text(item.startTime), endTime: text(item.endTime),
          timeSlots: Array.isArray(item.timeSlots) ? item.timeSlots.map(Number) : [], roomName: text(item.roomName)
        };
      }).filter(function (item) { return item.classId && item.className; }) : [];
      teachers = Array.isArray(result.teachers) ? result.teachers.map(function (item) { return { instructorUid: text(item.instructorUid), instructorName: text(item.instructorName) }; }).filter(function (item) { return item.instructorUid && item.instructorName; }) : [];
      students = (Array.isArray(result.students) ? result.students : []).map(normalizeStudent);
      filtered = students.slice();
      dirtyKeys.clear();
      renderCreateClasses();
      render();
      const hidden = Number(result.hiddenIncomplete || 0);
      setStatus('학생 ' + students.length + '명과 운영 반 ' + classes.length + '개를 불러왔습니다.' + (hidden ? '\n정보가 불완전한 문서 ' + hidden + '건은 목록에서 제외했습니다.' : ''), hidden ? 'warn' : 'ok');
      return true;
    })().catch(function (error) {
      setStatus(text(error && error.message) || '학생정보를 불러오지 못했습니다.', 'error');
      return false;
    }).finally(function () { loadingPromise = null; });
    return loadingPromise;
  }

  async function reloadClasses() {
    try {
      showLoading('운영 반 목록을 다시 불러오는 중...');
      const result = await call('getStudentClassCatalogAdmin7352', { requestId: requestId('student-class-catalog-7352') });
      classes = Array.isArray(result.classes) ? result.classes.map(function (item) {
        return { classId: text(item.classId), className: text(item.className), instructorUid: text(item.instructorUid), instructorName: text(item.instructorName), selectable: item.selectable !== false, dates: Array.isArray(item.dates) ? item.dates : [], baseName: text(item.baseName), weekday: Number(item.weekday), startTime: text(item.startTime), endTime: text(item.endTime), timeSlots: Array.isArray(item.timeSlots) ? item.timeSlots.map(Number) : [], roomName: text(item.roomName) };
      }) : [];
      teachers = Array.isArray(result.teachers) ? result.teachers.map(function (item) { return { instructorUid: text(item.instructorUid), instructorName: text(item.instructorName) }; }) : teachers;
      renderCreateClasses();
      if (!dirtyKeys.size) render();
      setStatus('운영 반 ' + classes.length + '개를 다시 불러왔습니다.' + (dirtyKeys.size ? '\n입력 중인 변경사항을 보호하기 위해 현재 표는 저장 후 갱신됩니다.' : ''), dirtyKeys.size ? 'warn' : 'ok');
    } catch (error) {
      setStatus(text(error && error.message) || '반 목록을 불러오지 못했습니다.', 'error');
    } finally { hideLoading(); }
  }

  function createInput() {
    return {
      name: text(document.getElementById('ulimNewStudentName7352') && document.getElementById('ulimNewStudentName7352').value),
      birthDate: text(document.getElementById('ulimNewStudentBirth7352') && document.getElementById('ulimNewStudentBirth7352').value),
      studentPhone: text(document.getElementById('ulimNewStudentPhone7352') && document.getElementById('ulimNewStudentPhone7352').value),
      parentPhone: text(document.getElementById('ulimNewStudentParent7352') && document.getElementById('ulimNewStudentParent7352').value),
      enrollmentStatus: text(document.getElementById('ulimNewStudentStatus7352') && document.getElementById('ulimNewStudentStatus7352').value) || 'active',
      startDate: text(document.getElementById('ulimNewStudentStart7352') && document.getElementById('ulimNewStudentStart7352').value),
      registrationType: text(document.getElementById('ulimNewStudentType7352') && document.getElementById('ulimNewStudentType7352').value) || 'new',
      classIds: selectedValues(document.getElementById('ulimNewStudentClasses7352')),
      memo: text(document.getElementById('ulimNewStudentMemo7352') && document.getElementById('ulimNewStudentMemo7352').value),
      requestId: requestId('student-create-7352')
    };
  }

  function validateInput(input) {
    if (!input.name) return '학생명을 입력해주세요.';
    if (String(input.studentPhone || '').replace(/\D/g, '').length < 4) return '학생 전화번호를 정확히 입력해주세요.';
    return '';
  }

  async function createStudent() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const input = createInput();
    const error = validateInput(input);
    if (error) return alert(error);
    const selectedNames = selectedClassDetails(input.classIds).map(function (item) { return item.className; }).join('\n') || '선택 안 함';
    if (!confirm(input.name + ' 학생을 추가할까요?\n\n수강반\n' + selectedNames + '\n\n생년월일 등 선택항목은 나중에 입력해도 됩니다.')) return;
    try {
      showLoading('학생정보를 저장하는 중...');
      const result = await call('createStudentAdmin7352', input);
      const form = document.getElementById(CREATE_FORM_ID);
      if (form) Array.from(form.querySelectorAll('input')).forEach(function (el) { el.value = ''; });
      const classSelect = document.getElementById('ulimNewStudentClasses7352');
      if (classSelect) Array.from(classSelect.options).forEach(function (option) { option.selected = false; });
            updateCreateClassPreview();
      updatePasswordPreview();
      await load(true);
      setStatus(input.name + ' 학생을 추가했습니다.\n출결번호: ' + text(result.attendanceNo) + '\n최초 비밀번호: ' + text(result.initialPassword) + '\n앱 출석부·태블릿에 즉시 반영했습니다. Google Sheets는 설정의 시트기록 버튼 또는 매일 06:00 백업 때만 갱신됩니다.', 'ok');
    } catch (error2) {
      setStatus(text(error2 && error2.message) || '학생을 추가하지 못했습니다.', 'error');
      alert(text(error2 && error2.message) || '학생을 추가하지 못했습니다.');
    } finally { hideLoading(); }
  }

  async function saveKeys(keys) {
    const selectedKeys = unique(keys).filter(function (key) { return rowKeyMap.has(key); });
    const edits = selectedKeys.map(rowData);
    if (!edits.length) return alert('수정된 학생정보가 없습니다.');
    for (const edit of edits) {
      const error = validateInput({ name: edit.name, studentPhone: edit.studentPhone });
      if (error) return alert(edit.name + ': ' + error);
      if ((edit.registrationType === 'class_move' || edit.registrationType === 'makeup') && !edit.classIds.length) {
        return alert(edit.name + ': ' + (edit.registrationType === 'class_move' ? '반이동할 수강반' : '보강할 수강반') + '을 한 개 이상 선택해주세요.');
      }
    }
    const operationCounts = edits.reduce(function (acc, edit) { acc[edit.registrationType] = (acc[edit.registrationType] || 0) + 1; return acc; }, {});
    const operationSummary = ['일반 수정 ' + Number(operationCounts.existing || 0), '신규 ' + Number(operationCounts.new || 0), '반이동 ' + Number(operationCounts.class_move || 0), '보강 ' + Number(operationCounts.makeup || 0)].join(' / ');
    const moveDetails = edits.filter(function (edit) { return edit.registrationType === 'class_move'; }).map(function (edit) {
      const names = selectedClassDetails(edit.classIds).map(function (item) { return item.className; }).join(', ');
      return edit.name + ' → ' + names;
    });
    if (!confirm('학생 ' + edits.length + '명의 변경사항을 저장할까요?\n' + operationSummary + (moveDetails.length ? '\n\n반이동 대상\n' + moveDetails.join('\n') : '') + '\n\n일반 수정은 잘못 연결된 반을 선택한 최종 수강반 목록으로 정정하며 신규·반이동·보강 표시는 만들지 않습니다. 반이동·보강은 처리구분에서 직접 선택한 경우에만 적용됩니다.')) return;
    selectedKeys.forEach(function (key) {
      const row = document.querySelector('tr[data-row-key="' + key + '"]');
      if (row) row.classList.add('ulim-saving-row');
    });
    try {
      showLoading('학생정보 ' + edits.length + '명 저장 중...');
      let result;
      if (edits.length === 1) result = { results: [await call('updateStudentAdmin7352', Object.assign({}, edits[0], { requestId: requestId('student-update-7352') }))] };
      else result = await call('updateStudentsBatchAdmin7352', { edits: edits, requestId: requestId('student-batch-7352') });
      const results = Array.isArray(result.results) ? result.results : [];
      const failed = results.filter(function (item) { return item.ok === false; });
      const succeeded = new Set(results.filter(function (item) { return item.ok !== false; }).map(function (item) { return text(item.studentUid); }));
      selectedKeys.forEach(function (key) { if (!results.length || succeeded.has(rowKeyMap.get(key) || '')) dirtyKeys.delete(key); });
      await load(true);
      if (failed.length) setStatus('저장 완료 후 확인이 필요한 학생이 ' + failed.length + '명 있습니다.\n' + failed.slice(0, 5).map(function (item) { return text(item.message); }).join('\n'), 'warn');
      else setStatus('학생정보 ' + edits.length + '명의 변경사항을 앱 운영자료에 저장했습니다. Google Sheets는 수동 시트기록 또는 매일 06:00 백업 때만 갱신됩니다.', 'ok');
    } catch (error) {
      setStatus(text(error && error.message) || '학생정보를 저장하지 못했습니다.', 'error');
      alert(text(error && error.message) || '학생정보를 저장하지 못했습니다.');
    } finally {
      selectedKeys.forEach(function (key) {
        const row = document.querySelector('tr[data-row-key="' + key + '"]');
        if (row) row.classList.remove('ulim-saving-row');
      });
      hideLoading();
      updateSummary();
    }
  }

  async function saveRow(key) { return saveKeys([key]); }
  async function saveAll() { return saveKeys(Array.from(dirtyKeys)); }

  async function retry(key) {
    const studentUid = rowKeyMap.get(key) || '';
    if (!studentUid) return;
    try {
      showLoading('연동 작업을 다시 요청하는 중...');
      const result = await call('retryStudentOperationAdmin7352', { studentUid: studentUid, requestId: requestId('student-retry-7352') });
      await load(true);
      setStatus(text(result.message) || '연동 작업을 다시 요청했습니다.', 'ok');
    } catch (error) {
      setStatus(text(error && error.message) || '재시도 요청에 실패했습니다.', 'error');
    } finally { hideLoading(); }
  }


  async function syncSheets() {
    if (dirtyKeys.size) return alert('먼저 변경사항을 저장해주세요.');
    if (!confirm('현재 학생정보를 Google Sheets에 즉시 기록할까요?\n앱 운영자료는 이미 저장되어 있으며 시트 기록만 즉시 실행합니다.')) return;
    try {
      showLoading('시트에 즉시 기록하는 중...');
      const result = await call('syncStudentsToSheetsAdmin7352', { requestId: requestId('manual-sheet-sync-7352') });
      await load(true);
      const failed = Array.isArray(result.results) ? result.results.filter(function (row) { return row.ok === false || Number(row.failed || 0) > 0; }).length : 0;
      setStatus('시트 즉시 기록 ' + Number(result.processed || 0) + '명 처리 완료' + (failed ? '\n확인 필요한 학생 ' + failed + '명' : ''), failed ? 'warn' : 'ok');
    } catch (error) { setStatus(text(error && error.message) || '시트 즉시 기록에 실패했습니다.', 'error'); }
    finally { hideLoading(); }
  }

  async function importSheets() {
    if (dirtyKeys.size) return alert('먼저 변경사항을 저장해주세요.');
    try {
      showLoading('시트 내용과 앱 학생정보를 비교하는 중...');
      const preview = await call('previewStudentsFromSheetsAdmin7352', { requestId: requestId('sheet-preview-7352') });
      const counts = preview.counts || {};
      const message = '시트 ' + Number(counts.total || 0) + '건\n안전 연결 ' + Number(counts.matched || 0) + '건\n변경 확인 ' + Number(counts.changed || 0) + '건\n미연결 ' + Number(counts.unmatched || 0) + '건\n동명이인·충돌 확인 ' + Number(counts.ambiguous || 0) + '건\n\nUID·전체 전화번호·학생명+생년월일로 안전하게 확인된 기본정보만 앱에 반영할까요?\n학생명만 같은 경우에는 자동 연결하지 않습니다.';
      hideLoading();
      if (!confirm(message)) { setStatus(message, 'warn'); return; }
      showLoading('확인된 시트 내용을 앱에 반영하는 중...');
      const result = await call('applyStudentsFromSheetsAdmin7352', { requestId: requestId('sheet-apply-7352') });
      await load(true);
      setStatus('시트 기본정보 ' + Number(result.applied || 0) + '명을 앱에 반영했습니다.', result.ok === false ? 'warn' : 'ok');
    } catch (error) { setStatus(text(error && error.message) || '시트 내용을 불러오지 못했습니다.', 'error'); }
    finally { hideLoading(); }
  }


  function closeHomonymReview73542() {
    const overlay = document.getElementById('ulimHomonymReviewOverlay73542');
    if (overlay) overlay.remove();
  }

  function homonymStudentLine73542(item, source) {
    const parts = [];
    if (source === 'sheet') parts.push('시트 ' + (Number(item.rowNumber || 0) ? Number(item.rowNumber || 0) + '행' : '행 미확인'));
    parts.push(escapeHtml(text(item.name) || '-'));
    if (text(item.birthDate)) parts.push(escapeHtml(text(item.birthDate)));
    if (text(item.phoneMasked)) parts.push(escapeHtml(text(item.phoneMasked)));
    if (text(item.attendanceNo)) parts.push('출결 ' + escapeHtml(text(item.attendanceNo)));
    if (text(item.maskedUid)) parts.push(escapeHtml(text(item.maskedUid)));
    return parts.join(' · ');
  }

  function renderHomonymReview73542(result) {
    closeHomonymReview73542();
    const counts = result && result.counts || {};
    const groups = Array.isArray(result && result.groups) ? result.groups : [];
    const overlay = document.createElement('div');
    overlay.id = 'ulimHomonymReviewOverlay73542';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:18px;';
    const rows = groups.map(function (group) {
      const issues = Array.isArray(group.issues) ? group.issues : [];
      const sheetRows = Array.isArray(group.sheetRows) ? group.sheetRows : [];
      const appStudents = Array.isArray(group.appStudents) ? group.appStudents : [];
      const sheetHtml = sheetRows.length
        ? sheetRows.map(function (item) {
          const conflicts = Array.isArray(item.conflicts) && item.conflicts.length
            ? '<div style="color:#b91c1c;font-weight:800;margin:3px 0 0 12px;">' + item.conflicts.map(escapeHtml).join(', ') + '</div>'
            : '';
          return '<div style="margin:4px 0;">' + homonymStudentLine73542(item, 'sheet') + conflicts + '</div>';
        }).join('')
        : '<div style="color:#64748b;">시트 행 없음</div>';
      const appHtml = appStudents.length
        ? appStudents.map(function (item) { return '<div style="margin:4px 0;">' + homonymStudentLine73542(item, 'app') + '</div>'; }).join('')
        : '<div style="color:#64748b;">앱 학생 없음</div>';
      return '<tr>' +
        '<td style="vertical-align:top;padding:10px;border-bottom:1px solid #e2e8f0;font-weight:900;white-space:nowrap;">' + escapeHtml(group.name || group.nameKey || '-') + '</td>' +
        '<td style="vertical-align:top;padding:10px;border-bottom:1px solid #e2e8f0;">' + sheetHtml + '</td>' +
        '<td style="vertical-align:top;padding:10px;border-bottom:1px solid #e2e8f0;">' + appHtml + '</td>' +
        '<td style="vertical-align:top;padding:10px;border-bottom:1px solid #e2e8f0;color:' + (group.needsReview ? '#b91c1c' : '#166534') + ';font-weight:800;">' +
          (issues.length ? issues.map(escapeHtml).join('<br>') : '안전하게 분리됨') +
        '</td></tr>';
    }).join('');
    overlay.innerHTML =
      '<div style="width:min(1180px,96vw);max-height:90vh;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;">' +
        '<div style="padding:18px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
          '<div><div style="font-size:20px;font-weight:950;color:#0f172a;">동명이인 안전 점검</div>' +
          '<div style="font-size:13px;color:#475569;margin-top:4px;">동명이인 이름 ' + Number(counts.homonymNames || 0) + '개 · 확인 필요 ' + Number(counts.needsReview || 0) + '개 · 안전 ' + Number(counts.safe || 0) + '개</div></div>' +
          '<button type="button" class="admin-btn" onclick="ulimStudentManagementCloseHomonyms73542()">닫기</button>' +
        '</div>' +
        '<div style="padding:12px 20px;background:#fff7ed;color:#9a3412;font-size:13px;line-height:1.55;">' +
          '확인 필요 항목은 자동으로 합치거나 덮어쓰지 않습니다. 전화번호·생년월일·UID가 서로 다른 학생은 학생정보를 각각 확인한 뒤 수정해주세요.' +
        '</div>' +
        '<div style="overflow:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px;min-width:900px;">' +
            '<thead style="position:sticky;top:0;background:#f8fafc;z-index:1;"><tr>' +
              '<th style="text-align:left;padding:10px;">학생명</th><th style="text-align:left;padding:10px;">Google Sheets</th><th style="text-align:left;padding:10px;">앱 학생정보</th><th style="text-align:left;padding:10px;">판정</th>' +
            '</tr></thead><tbody>' +
            (rows || '<tr><td colspan="4" style="padding:24px;text-align:center;color:#64748b;">동명이인 학생이 없습니다.</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function (event) { if (event.target === overlay) closeHomonymReview73542(); });
    document.body.appendChild(overlay);
  }

  async function inspectHomonyms73542() {
    if (dirtyKeys.size) return alert('먼저 변경사항을 저장해주세요.');
    try {
      showLoading('동명이인 학생정보를 안전하게 비교하는 중...');
      const result = await call('inspectHomonymStudentsAdmin73542', { requestId: requestId('homonym-review-73542') });
      hideLoading();
      renderHomonymReview73542(result);
      const counts = result.counts || {};
      setStatus('동명이인 점검 완료: 이름 ' + Number(counts.homonymNames || 0) + '개 / 확인 필요 ' + Number(counts.needsReview || 0) + '개', Number(counts.needsReview || 0) ? 'warn' : 'ok');
    } catch (error) {
      setStatus(text(error && error.message) || '동명이인 점검에 실패했습니다.', 'error');
    } finally { hideLoading(); }
  }

  async function reconcileRosters() {
    if (dirtyKeys.size) return alert('먼저 변경사항을 저장해주세요.');
    try {
      showLoading('현재 출석부의 재원생과 반목록을 분석하는 중...');
      const preview = await call('reconcileAttendanceRostersAdmin7352', { mode: 'preview', requestId: requestId('roster-preview-7352') });
      const counts = preview.counts || {};
      hideLoading();
      const message = '출석부 학생·반 조합 ' + Number(counts.total || 0) + '건\n바로 적용 가능 ' + Number(counts.ready || 0) + '건\n학생 미연결 ' + Number(counts.studentUnmatched || 0) + '건\n반 미연결 ' + Number(counts.classUnmatched || 0) + '건\n\n적용 가능한 학생의 현재 반목록을 Firestore 운영자료에 반영할까요?';
      if (!confirm(message)) { setStatus(message, 'warn'); return; }
      showLoading('출석부 기준 반목록을 앱에 반영하는 중...');
      const applied = await call('reconcileAttendanceRostersAdmin7352', { mode: 'apply', replaceExisting: true, requestId: requestId('roster-apply-7352') });
      await load(true);
      setStatus('출석부 기준 반 자동매칭 완료: ' + Number(applied.appliedStudents || 0) + '명\n미연결 건은 변경하지 않았습니다.', applied.ok === false ? 'warn' : 'ok');
    } catch (error) { setStatus(text(error && error.message) || '출석부 반 자동매칭에 실패했습니다.', 'error'); }
    finally { hideLoading(); }
  }

  function currentMonth() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  async function applyApplications() {
    if (dirtyKeys.size) return alert('먼저 변경사항을 저장해주세요.');
    const month = prompt('불러올 수강신청 월을 YYYY-MM 형식으로 입력해주세요.', currentMonth());
    if (!month) return;
    try {
      showLoading('구글폼과 앱 수강신청을 비교하는 중...');
      const preview = await call('previewCourseApplicationsAdmin7352', { month: month, requestId: requestId('course-preview-7352') });
      const counts = preview.counts || {};
      hideLoading();
      const message = month + ' 신청 ' + Number(counts.total || 0) + '건\n적용 가능 ' + Number(counts.ready || 0) + '건\n학생 미연결 ' + Number(counts.unmatchedStudent || 0) + '건\n반 미연결 ' + Number(counts.unmatchedClass || 0) + '건\n\n적용 가능한 신청을 모두 반영할까요?\n반이동은 기존 수강배정을 종료하고 신청반을 새로 연결합니다.';
      if (!confirm(message)) { setStatus(message, 'warn'); return; }
      showLoading('수강신청을 앱 운영자료에 반영하는 중...');
      const result = await call('applyCourseApplicationsAdmin7352', { month: month, requestId: requestId('course-apply-7352') });
      await load(true);
      setStatus(month + ' 수강신청 ' + Number(result.applied || 0) + '건을 반영했습니다.', result.ok === false ? 'warn' : 'ok');
    } catch (error) { setStatus(text(error && error.message) || '수강신청을 처리하지 못했습니다.', 'error'); }
    finally { hideLoading(); }
  }

  async function saveClassCatalog7354() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const instructorUid = text(document.getElementById('ulimClassInstructor7354') && document.getElementById('ulimClassInstructor7354').value);
    const baseName = text(document.getElementById('ulimClassBaseName7354') && document.getElementById('ulimClassBaseName7354').value);
    const roomName = text(document.getElementById('ulimClassRoom7354') && document.getElementById('ulimClassRoom7354').value);
    const hours = selectedClassHours();
    if (!instructorUid) return alert('담당강사를 선택해주세요.');
    if (!baseName) return alert('반명을 입력해주세요.');
    if (!/(월요일|화요일|수요일|목요일|금요일|토요일|일요일)/.test(baseName)) return alert('반명에 수업 요일을 포함해주세요. 예: 일요일 청소년 중급B');
    if (!hours.length) return alert('수업 시간을 한 칸 이상 선택해주세요.');
    if (!contiguousHours(hours)) return alert('수업 시간은 중간에 비우지 않고 연속으로 선택해주세요.');
    const preview = classPreviewText();
    if (!confirm(preview + '\n\n이 반을 Firestore 반 목록에 추가할까요?')) return;
    try {
      showLoading('반 목록에 추가하는 중...');
      const result = await call('saveClassCatalogAdmin7354', { instructorUid: instructorUid, baseName: baseName, roomName: roomName, hours: hours, requestId: requestId('class-catalog-save-7354') });
      document.getElementById('ulimClassBaseName7354').value = '';
      document.getElementById('ulimClassRoom7354').value = '';
      document.querySelectorAll('#ulimClassTimeSlots7354 input[type="checkbox"]').forEach(function (input) { input.checked = false; });
      await reloadClasses();
      setStatus(text(result.message) || '반 목록에 추가했습니다.', 'ok');
    } catch (error) { setStatus(text(error && error.message) || '반을 추가하지 못했습니다.', 'error'); alert(text(error && error.message) || '반을 추가하지 못했습니다.'); }
    finally { hideLoading(); }
  }

  async function retireClassCatalog7354(classId) {
    const item = classById(classId);
    if (!item || !confirm(item.className + '\n\n이 반을 사용중지할까요? 기존 출석·수강 기록은 유지됩니다.')) return;
    try {
      showLoading('반 사용중지 처리 중...');
      const result = await call('retireClassCatalogAdmin7354', { classId: classId, requestId: requestId('class-catalog-retire-7354') });
      await reloadClasses();
      setStatus(text(result.message) || '반을 사용중지했습니다.', 'ok');
    } catch (error) { setStatus(text(error && error.message) || '반을 사용중지하지 못했습니다.', 'error'); }
    finally { hideLoading(); }
  }

  function attendancePanelElement73541(id) {
    return document.getElementById(id);
  }

  function attendanceContext73541() {
    const date = text(attendancePanelElement73541('adminAttendanceDate') && attendancePanelElement73541('adminAttendanceDate').value) || today();
    const className = text(attendancePanelElement73541('adminAttendanceClass') && attendancePanelElement73541('adminAttendanceClass').value);
    return { date: date, className: className };
  }

  function updateAttendanceAddContext73541() {
    const context = attendanceContext73541();
    const dateInput = attendancePanelElement73541('ulimAttendanceAddDate73541');
    const classInput = attendancePanelElement73541('ulimAttendanceAddClass73541');
    if (dateInput) dateInput.value = context.date;
    if (classInput) classInput.value = context.className && context.className !== '전체반' ? context.className : '';
    const button = attendancePanelElement73541('ulimAttendanceAddSubmit73541');
    if (button) button.disabled = !isSuperAdmin() || !context.className || context.className === '전체반';
  }

  function attendanceCandidateLabel73541(student) {
    const parts = [text(student.name)];
    if (student.attendanceNo) parts.push('출결 ' + text(student.attendanceNo));
    if (student.studentPhone) parts.push(text(student.studentPhone));
    const currentClasses = unique(student.classNames || []).slice(0, 2);
    if (currentClasses.length) parts.push(currentClasses.join(', '));
    return parts.join(' · ');
  }

  function renderAttendanceCandidates73545() {
    const select = attendancePanelElement73541('ulimAttendanceAddStudent73545');
    const search = normalize(attendancePanelElement73541('ulimAttendanceAddSearch73545') && attendancePanelElement73541('ulimAttendanceAddSearch73545').value);
    if (!select) return;
    const selected = text(select.value);
    const eligible = students
      .filter(function (student) { return student.enrollmentStatus !== 'withdrawn'; })
      .filter(function (student) {
        if (!search) return true;
        return normalize([
          student.name,
          student.attendanceNo,
          student.studentPhone,
          student.parentPhone,
          (student.classNames || []).join(' ')
        ].join(' ')).indexOf(search) >= 0;
      })
      .sort(function (a, b) { return text(a.name).localeCompare(text(b.name), 'ko'); })
      .slice(0, 200);
    select.innerHTML = '<option value="">학생을 선택해주세요.</option>' + eligible.map(function (student) {
      return '<option value="' + escapeHtml(student.studentUid) + '"' + (student.studentUid === selected ? ' selected' : '') + '>' + escapeHtml(attendanceCandidateLabel73541(student)) + '</option>';
    }).join('');
  }

  function ensureAttendanceModal73545() {
    let modal = document.getElementById('ulimAttendanceAddModal73545');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ulimAttendanceAddModal73545';
    modal.className = 'ulim-attendance-modal73545';
    modal.innerHTML = '<div class="ulim-attendance-modal-card73545" role="dialog" aria-modal="true" aria-labelledby="ulimAttendanceAddTitle73545">'
      + '<div class="ulim-attendance-modal-head73545"><h3 id="ulimAttendanceAddTitle73545">출석부 학생추가</h3><button type="button" class="ulim-attendance-modal-close73545" onclick="ulimAttendanceCloseAddModal73545()" aria-label="닫기">×</button></div>'
      + '<div id="ulimAttendanceAddContext73545" class="ulim-attendance-context73545"></div>'
      + '<label class="ulim-attendance-label73545">등록 구분<select id="ulimAttendanceAddKind73545" onchange="ulimAttendanceAddKindChanged73545()"><option value="new">신규</option><option value="makeup">보강</option><option value="class_move">반이동</option><option value="daily_special">일일특강</option></select></label>'
      + '<label class="ulim-attendance-label73545">학생이름 검색<input id="ulimAttendanceAddSearch73545" type="search" autocomplete="off" placeholder="학생명·출결번호·전화번호" oninput="ulimAttendanceAddFilter73545()"></label>'
      + '<label class="ulim-attendance-label73545">학생 선택<select id="ulimAttendanceAddStudent73545" size="7"></select></label>'
      + '<label id="ulimAttendanceDirectWrap73545" class="ulim-attendance-label73545" style="display:none;">명단에 없는 학생 이름<input id="ulimAttendanceDirectName73545" autocomplete="off" placeholder="보강생·일일특강생 이름 직접 입력"></label>'
      + '<div id="ulimAttendanceAddHint73545" class="ulim-attendance-hint73545"></div>'
      + '<div class="ulim-attendance-modal-actions73545"><button type="button" class="admin-btn gray" onclick="ulimAttendanceCloseAddModal73545()">취소</button><button type="button" class="admin-btn orange" onclick="ulimAttendanceAddFromModal73545()">학생추가</button></div>'
      + '</div>';
    modal.addEventListener('click', function (event) { if (event.target === modal) closeAttendanceAddModal73545(); });
    document.body.appendChild(modal);
    return modal;
  }

  function attendanceKindChanged73545() {
    const kind = text(attendancePanelElement73541('ulimAttendanceAddKind73545') && attendancePanelElement73541('ulimAttendanceAddKind73545').value) || 'new';
    const directWrap = attendancePanelElement73541('ulimAttendanceDirectWrap73545');
    const directInput = attendancePanelElement73541('ulimAttendanceDirectName73545');
    const hint = attendancePanelElement73541('ulimAttendanceAddHint73545');
    const allowDirect = kind === 'makeup' || kind === 'daily_special';
    if (directWrap) directWrap.style.display = allowDirect ? '' : 'none';
    if (directInput && !allowDirect) directInput.value = '';
    if (hint) {
      hint.textContent = kind === 'new'
        ? '선택한 학생을 현재 반에 신규 추가합니다. 기존 수강반은 유지됩니다.'
        : (kind === 'class_move'
          ? '선택한 학생의 기존 수강반을 종료하고 현재 반만 최종 수강반으로 변경합니다.'
          : (kind === 'makeup'
            ? '선택한 날짜에만 보강으로 추가합니다. 학생명단에 없는 경우 이름을 직접 입력할 수 있습니다.'
            : '선택한 날짜에만 일일특강으로 추가합니다. 학생명단에 없는 경우 이름을 직접 입력할 수 있습니다.'));
    }
    renderAttendanceCandidates73545();
  }

  async function ensureAttendanceAddData73545(force) {
    if (!isSuperAdmin()) return false;
    if (!force && classes.length && students.length) {
      renderAttendanceCandidates73545();
      return true;
    }
    try {
      const result = await call('listStudentManagementAdmin7352', { requestId: requestId('attendance-add-list-73545') });
      classes = Array.isArray(result.classes) ? result.classes.map(function (item) {
        return {
          classId: text(item.classId), className: text(item.className), instructorUid: text(item.instructorUid),
          instructorName: text(item.instructorName), selectable: item.selectable !== false, dates: Array.isArray(item.dates) ? item.dates : [],
          baseName: text(item.baseName), weekday: Number(item.weekday), startTime: text(item.startTime), endTime: text(item.endTime),
          timeSlots: Array.isArray(item.timeSlots) ? item.timeSlots.map(Number) : [], roomName: text(item.roomName)
        };
      }).filter(function (item) { return item.classId && item.className; }) : classes;
      teachers = Array.isArray(result.teachers) ? result.teachers.map(function (item) {
        return { instructorUid: text(item.instructorUid), instructorName: text(item.instructorName) };
      }).filter(function (item) { return item.instructorUid && item.instructorName; }) : teachers;
      students = (Array.isArray(result.students) ? result.students : []).map(normalizeStudent);
      filtered = students.slice();
      renderAttendanceCandidates73545();
      return true;
    } catch (error) {
      alert(text(error && error.message) || '학생 목록을 불러오지 못했습니다.');
      return false;
    }
  }

  async function openAttendanceAddModal73545() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const context = attendanceContext73541();
    if (!context.date) return alert('수업일을 선택해주세요.');
    if (!context.className || context.className === '전체반') return alert('학생을 추가할 반 출석부를 먼저 선택해주세요.');
    const modal = ensureAttendanceModal73545();
    const contextEl = attendancePanelElement73541('ulimAttendanceAddContext73545');
    if (contextEl) contextEl.textContent = context.date + ' · ' + context.className;
    const search = attendancePanelElement73541('ulimAttendanceAddSearch73545');
    const select = attendancePanelElement73541('ulimAttendanceAddStudent73545');
    const direct = attendancePanelElement73541('ulimAttendanceDirectName73545');
    if (search) search.value = '';
    if (select) select.value = '';
    if (direct) direct.value = '';
    modal.classList.add('open');
    document.body.classList.add('ulim-attendance-modal-open73545');
    await ensureAttendanceAddData73545(false);
    attendanceKindChanged73545();
    setTimeout(function () { if (search) search.focus(); }, 30);
  }

  function closeAttendanceAddModal73545() {
    const modal = document.getElementById('ulimAttendanceAddModal73545');
    if (modal) modal.classList.remove('open');
    document.body.classList.remove('ulim-attendance-modal-open73545');
  }

  async function addAttendanceFromModal73545() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const context = attendanceContext73541();
    if (!context.date) return alert('수업일을 선택해주세요.');
    if (!context.className || context.className === '전체반') return alert('학생을 추가할 반 출석부를 먼저 선택해주세요.');
    const kind = text(attendancePanelElement73541('ulimAttendanceAddKind73545') && attendancePanelElement73541('ulimAttendanceAddKind73545').value) || 'new';
    const studentUid = text(attendancePanelElement73541('ulimAttendanceAddStudent73545') && attendancePanelElement73541('ulimAttendanceAddStudent73545').value);
    const directName = text(attendancePanelElement73541('ulimAttendanceDirectName73545') && attendancePanelElement73541('ulimAttendanceDirectName73545').value);
    const selectedStudent = students.find(function (student) { return student.studentUid === studentUid; }) || null;
    const directAllowed = kind === 'makeup' || kind === 'daily_special';
    if (!selectedStudent && !directAllowed) return alert('학생목록에서 학생을 검색해 선택해주세요.');
    if (!selectedStudent && directAllowed && !directName) return alert('기존학생을 선택하거나 학생명을 직접 입력해주세요.');
    const studentName = selectedStudent ? text(selectedStudent.name) : directName;
    const label = kind === 'new' ? '신규' : (kind === 'class_move' ? '반이동' : (kind === 'daily_special' ? '일일특강' : '보강'));
    const detail = kind === 'class_move'
      ? '기존 수강반을 종료하고 현재 반만 최종 수강반으로 변경합니다.'
      : (kind === 'new' ? '현재 반을 추가하고 기존 수강반은 유지합니다.' : '선택한 날짜에만 출석부에 추가합니다.');
    if (!confirm(context.date + '\n' + context.className + '\n' + studentName + ' · ' + label + '\n\n' + detail)) return;
    try {
      showLoading(label + ' 학생을 현재 출석부에 추가하는 중...');
      const currentClass = classes.find(function (item) { return normalize(item.className) === normalize(context.className); }) || null;
      const result = await call('addTemporaryAttendanceAdmin7354', {
        studentUid: selectedStudent ? selectedStudent.studentUid : '',
        studentName: studentName,
        kind: kind,
        date: context.date,
        classId: currentClass ? currentClass.classId : '',
        className: context.className,
        requestId: requestId('attendance-page-add-73545')
      });
      closeAttendanceAddModal73545();
      if (typeof global.adminLoadAttendanceSnapshot === 'function') await global.adminLoadAttendanceSnapshot(true, true);
      alert(text(result.message) || '현재 출석부에 학생을 추가했습니다.');
    } catch (error) {
      alert(text(error && error.message) || '현재 출석부에 학생을 추가하지 못했습니다.');
    } finally { hideLoading(); }
  }

  async function removeAttendanceRow73545(index) {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const record = typeof global.ulimGetAdminAttendanceRecord73545 === 'function' ? global.ulimGetAdminAttendanceRecord73545(Number(index)) : null;
    if (!record) return alert('삭제할 출석부 학생정보를 찾지 못했습니다. 출석부를 다시 불러와주세요.');
    const context = attendanceContext73541();
    const date = text(record.date || record.sessionDate || context.date);
    const className = text(record.className || context.className);
    const currentClass = classes.find(function (item) { return item.classId === text(record.classId) || normalize(item.className) === normalize(className); }) || null;
    const studentName = text(record.studentName || record.name);
    if (!confirm(date + '\n' + className + '\n' + studentName + '\n\n현재 출석부에서 이 학생을 삭제할까요?\n정규 수강반은 학생목록에서 별도로 변경해야 합니다.')) return;
    try {
      showLoading(studentName + ' 학생을 출석부에서 삭제하는 중...');
      const result = await call('removeAttendanceStudentAdmin73545', {
        date: date,
        classId: text(record.classId) || (currentClass ? currentClass.classId : ''),
        className: className,
        studentUid: text(record.studentUid || record.studentIdentityKey || record.studentKey),
        studentName: studentName,
        requestId: requestId('attendance-page-remove-73545')
      });
      if (typeof global.adminLoadAttendanceSnapshot === 'function') await global.adminLoadAttendanceSnapshot(true, true);
      alert(text(result.message) || '출석부에서 학생을 삭제했습니다.');
    } catch (error) {
      alert(text(error && error.message) || '출석부에서 학생을 삭제하지 못했습니다.');
    } finally { hideLoading(); }
  }

  function installAttendanceContextHook73541() {
    const dateInput = attendancePanelElement73541('adminAttendanceDate');
    if (dateInput && !dateInput.dataset.ulimAttendanceAdd73541Bound) {
      dateInput.dataset.ulimAttendanceAdd73541Bound = '1';
      dateInput.addEventListener('change', updateAttendanceAddContext73541);
    }

    const original = global.adminSelectClass;
    if (typeof original === 'function' && !original.__ulimAttendanceAdd73541Wrapped) {
      const wrapped = function (className, targetId, panelId) {
        const result = original.apply(this, arguments);
        if (targetId === 'adminAttendanceClass') setTimeout(updateAttendanceAddContext73541, 0);
        return result;
      };
      wrapped.__ulimAttendanceAdd73541Wrapped = true;
      global.adminSelectClass = wrapped;
      try { adminSelectClass = wrapped; } catch (_ignore) {}
    }
  }

  async function configureApplicationWindow() {
    const month = text(document.getElementById('ulimCourseWindowMonth7352') && document.getElementById('ulimCourseWindowMonth7352').value);
    const active = text(document.getElementById('ulimCourseWindowActive7352') && document.getElementById('ulimCourseWindowActive7352').value) === 'true';
    const notice = text(document.getElementById('ulimCourseWindowNotice7352') && document.getElementById('ulimCourseWindowNotice7352').value);
    const openText = text(document.getElementById('ulimCourseWindowOpen7352') && document.getElementById('ulimCourseWindowOpen7352').value);
    const closeText = text(document.getElementById('ulimCourseWindowClose7352') && document.getElementById('ulimCourseWindowClose7352').value);
    const recruitingClassIds = selectedValues(document.getElementById('ulimCourseWindowClasses7352'));
    if (!/^\d{4}-\d{2}$/.test(month)) return alert('신청 대상월을 선택해주세요.');
    if (active && !recruitingClassIds.length) return alert('학생이 신청할 모집반을 하나 이상 선택해주세요.');
    if (!confirm(month + ' 앱 수강신청 설정을 저장할까요?\n학생 화면: ' + (active ? '열기' : '닫기') + '\n모집반: ' + recruitingClassIds.length + '개')) return;
    try {
      showLoading('수강신청 기간을 저장하는 중...');
      const result = await call('saveCourseApplicationWindowAdmin7352', {
        month: month,
        active: active,
        title: month + ' 수강신청',
        notice: notice || month + ' 수강신청 및 반 이동 신청을 받습니다.',
        openAtMs: openText ? new Date(openText).getTime() : 0,
        closeAtMs: closeText ? new Date(closeText).getTime() : 0,
        recruitingClassIds: recruitingClassIds,
        requestId: requestId('course-window-7352')
      });
      setStatus(month + ' 앱 수강신청을 ' + (active ? '열었습니다.' : '닫았습니다.') + '\n신청 가능 반 ' + Number((result.recruitingClassIds || []).length) + '개', 'ok');
    } catch (error) { setStatus(text(error && error.message) || '수강신청 기간을 저장하지 못했습니다.', 'error'); }
    finally { hideLoading(); }
  }

  async function retire(key, mode) {
    const studentUid = rowKeyMap.get(key) || '';
    const student = students.find(function (item) { return item.studentUid === studentUid; }) || {};
    if (!studentUid) return;
    const label = mode === 'withdraw_delete' || mode === 'delete' ? '학생 삭제' : (mode === 'cancel' ? '등록 취소' : '퇴원 처리');
    const message = mode === 'withdraw_delete'
      ? text(student.name) + ' 학생을 퇴원 처리한 뒤 학생목록에서 삭제할까요?\n\n수강반·로그인은 종료되고 향후 출석부에서 제외됩니다. 과거 출석·평가 기록은 보존됩니다.'
      : mode === 'delete'
        ? text(student.name) + ' 학생정보를 목록에서 최종 삭제할까요?\n등록 취소가 완료된 학생만 삭제할 수 있으며 과거 출석·평가 기록은 보존됩니다.'
        : mode === 'cancel'
          ? text(student.name) + ' 학생의 등록을 취소할까요?\n취소 후 같은 행의 학생 삭제 버튼으로 최종 삭제할 수 있습니다.'
          : text(student.name) + ' 학생을 퇴원 처리할까요?\n과거 출석·평가 기록은 삭제하지 않습니다.';
    if (!confirm(message)) return;
    try {
      showLoading(label + ' 중...');
      const result = await call('retireStudentAdmin7352', { studentUid: studentUid, mode: mode, requestId: requestId('student-retire-7352') });
      await load(true);
      setStatus(text(result.message) || label + '했습니다.', 'ok');
    } catch (error) { setStatus(text(error && error.message) || label + '에 실패했습니다.', 'error'); }
    finally { hideLoading(); }
  }

  function bindUi() {
    const filter = document.getElementById(FILTER_ID);
    const statusFilter = document.getElementById(STATUS_FILTER_ID);
    const createClasses = document.getElementById('ulimNewStudentClasses7352');
    const createPhone = document.getElementById('ulimNewStudentPhone7352');
    const classInstructor = document.getElementById('ulimClassInstructor7354');
    const classBaseName = document.getElementById('ulimClassBaseName7354');
    const classTimeSlots = document.getElementById('ulimClassTimeSlots7354');
    const table = document.getElementById(TABLE_ID);
    if (filter && !filter.dataset.ulim7352Bound) { filter.dataset.ulim7352Bound = '1'; filter.addEventListener('input', applyFilter); }
    if (statusFilter && !statusFilter.dataset.ulim7352Bound) { statusFilter.dataset.ulim7352Bound = '1'; statusFilter.addEventListener('change', applyFilter); }
    if (createClasses && !createClasses.dataset.ulim7352Bound) { createClasses.dataset.ulim7352Bound = '1'; createClasses.addEventListener('change', updateCreateClassPreview); }
    if (createPhone && !createPhone.dataset.ulim7352Bound) { createPhone.dataset.ulim7352Bound = '1'; createPhone.addEventListener('input', updatePasswordPreview); }
    if (classInstructor && !classInstructor.dataset.ulim7354Bound) { classInstructor.dataset.ulim7354Bound = '1'; classInstructor.addEventListener('change', updateClassPreview7354); }
    if (classBaseName && !classBaseName.dataset.ulim7354Bound) { classBaseName.dataset.ulim7354Bound = '1'; classBaseName.addEventListener('input', updateClassPreview7354); }
    if (classTimeSlots && !classTimeSlots.dataset.ulim7354Bound) { classTimeSlots.dataset.ulim7354Bound = '1'; classTimeSlots.addEventListener('change', updateClassPreview7354); }
    if (table && !table.dataset.ulim7352Bound) {
      table.dataset.ulim7352Bound = '1';
      table.addEventListener('input', function (event) { const key = event.target && event.target.dataset && event.target.dataset.rowKey; if (key) markDirty(key); });
      table.addEventListener('change', function (event) {
        const target = event.target;
        const key = target && target.dataset && target.dataset.rowKey;
        if (!key) return;
        if (target && target.id === key + '_operation') handleOperationModeChange(key);
        markDirty(key);
      });
    }
  }

  function installPanelHook() {
    const original = global.showAdminPanel;
    if (typeof original !== 'function' || original.__ulimStudentManagement7352Wrapped) return;
    const wrapped = function (panelId) {
      const result = original.apply(this, arguments);
      if (panelId === targetPanelId) setTimeout(function () { if (!students.length) load(); }, 0);
      return result;
    };
    wrapped.__ulimStudentManagement7352Wrapped = true;
    global.showAdminPanel = wrapped;
    try { showAdminPanel = wrapped; } catch (_ignore) {}
  }

  function install() {
    if (installed) return;
    installed = true;
    injectStyles();
    injectPanel();
    bindUi();
    installPanelHook();
    installAttendanceContextHook73541();
    updateAttendanceAddContext73541();
    global.ulimStudentManagementLoad7352 = load;
    global.ulimStudentManagementCreate7352 = createStudent;
    global.ulimStudentManagementSaveRow7352 = saveRow;
    global.ulimStudentManagementSaveAll7352 = saveAll;
    global.ulimStudentManagementRetry7352 = retry;
    global.ulimStudentManagementReloadClasses7352 = reloadClasses;
    global.ulimClassCatalogSave7354 = saveClassCatalog7354;
    global.ulimClassCatalogRetire7354 = retireClassCatalog7354;
    global.ulimAttendanceOpenAddModal73545 = openAttendanceAddModal73545;
    global.ulimAttendanceCloseAddModal73545 = closeAttendanceAddModal73545;
    global.ulimAttendanceAddFilter73545 = renderAttendanceCandidates73545;
    global.ulimAttendanceAddKindChanged73545 = attendanceKindChanged73545;
    global.ulimAttendanceAddFromModal73545 = addAttendanceFromModal73545;
    global.ulimAttendanceRemoveRow73545 = removeAttendanceRow73545;
    global.ulimStudentManagementSyncSheets7352 = syncSheets;
    global.ulimStudentManagementImportSheets7352 = importSheets;
    global.ulimStudentManagementInspectHomonyms73542 = inspectHomonyms73542;
    global.ulimStudentManagementCloseHomonyms73542 = closeHomonymReview73542;
    global.ulimStudentManagementReconcileRosters7352 = reconcileRosters;
    global.ulimStudentManagementApplyApplications7352 = applyApplications;
    global.ulimStudentManagementWindow7352 = configureApplicationWindow;
    global.ulimStudentManagementRetire7352 = retire;
    global.addEventListener('ulim-firebase-token-invalid', function () { setStatus('로그인 시간이 만료되었습니다. 다시 로그인해주세요.', 'error'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof window !== 'undefined' ? window : globalThis);
