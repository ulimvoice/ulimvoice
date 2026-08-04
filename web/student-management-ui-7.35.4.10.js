(function (global) {
  'use strict';

  if (global.__ULIM_STUDENT_MANAGEMENT_UI_735410__) return;
  global.__ULIM_STUDENT_MANAGEMENT_UI_735410__ = true;

  const VERSION = '2026-08-04.735.04.10';
  const CARD_ID = 'ulimStudentManagementCard7352';
  const TABLE_ID = 'ulimStudentManagementTable7352';
  const SUMMARY_ID = 'ulimStudentManagementSummary7352';
  const FILTER_ID = 'ulimStudentManagementFilter7352';
  const STATUS_FILTER_ID = 'ulimStudentManagementStatusFilter7352';
  const DRAFT_KEY = 'ulim_notice_message_draft_735410';

  let installed = false;
  let listExpanded = false;
  let currentDetailKey = '';
  let currentManageKey = '';
  let transformQueued = false;
  const selectedKeys = new Set();
  const selectedStudents = new Map();

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isSuperAdmin() {
    const info = global.adminInfo || {};
    const raw = text(info.firebaseRole || info.role || info.adminRole).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
    return raw === 'super' || raw === 'superadmin' || raw === '전체관리자' || raw === '전체관리' || raw === '원장';
  }

  function card() {
    return document.getElementById(CARD_ID);
  }

  function tableWrap() {
    const tableRoot = document.getElementById(TABLE_ID);
    return tableRoot ? tableRoot.closest('.ulim-table-wrap') : null;
  }

  function createModal(id, title, bodyId, footerHtml) {
    return `
      <div id="${id}" class="ulim-sm-modal73546" aria-hidden="true">
        <div class="ulim-sm-modal-backdrop73546" data-ulim-close-modal="${id}"></div>
        <section class="ulim-sm-modal-panel73546" role="dialog" aria-modal="true" aria-labelledby="${id}_title">
          <header class="ulim-sm-modal-header73546">
            <h4 id="${id}_title">${escapeHtml(title)}</h4>
            <button type="button" class="ulim-sm-modal-close73546" data-ulim-close-modal="${id}" aria-label="닫기">×</button>
          </header>
          <div id="${bodyId}" class="ulim-sm-modal-body73546"></div>
          ${footerHtml || ''}
        </section>
      </div>`;
  }

  function shellHtml() {
    return `
      <div id="ulimStudentPrimaryActions73546" class="ulim-sm-primary73546">
        <button type="button" class="admin-btn blue" id="ulimStudentListToggle73546">학생목록 펼치기</button>
        <button type="button" class="admin-btn" id="ulimStudentAddOpen73546">학생추가</button>
        <button type="button" class="admin-btn" id="ulimClassAddOpen73546">반 추가</button>
        <button type="button" class="admin-btn" id="ulimCourseSettingsOpen73546">수강신청·모집반 설정</button>
        <button type="button" class="admin-btn orange" id="ulimMessageOpen73546">메시지 보내기</button>
      </div>

      <div id="ulimStudentListHeader73546" class="ulim-sm-list-header73546" hidden>
        <div>
          <strong>학생목록</strong>
          <span id="ulimStudentSelectedCount73546">선택 0명</span>
        </div>
        <div class="ulim-sm-list-actions73546">
          <button type="button" class="admin-btn orange" id="ulimStudentSave73546">저장</button>
          <button type="button" class="admin-btn gray" id="ulimStudentSettingsOpen73546">설정</button>
        </div>
      </div>

      ${createModal('ulimStudentAddModal73546', '학생추가', 'ulimStudentAddModalBody73546', '<footer class="ulim-sm-modal-footer73546"><button type="button" class="admin-btn gray" data-ulim-close-modal="ulimStudentAddModal73546">닫기</button></footer>')}
      ${createModal('ulimClassAddModal73546', '반목록 관리 / 반 추가', 'ulimClassAddModalBody73546', '<footer class="ulim-sm-modal-footer73546"><button type="button" class="admin-btn gray" data-ulim-close-modal="ulimClassAddModal73546">닫기</button></footer>')}
      ${createModal('ulimCourseSettingsModal73546', '수강신청 기간·모집반 설정', 'ulimCourseSettingsModalBody73546', '<footer class="ulim-sm-modal-footer73546"><button type="button" class="admin-btn gray" data-ulim-close-modal="ulimCourseSettingsModal73546">닫기</button></footer>')}
      ${createModal('ulimStudentSettingsModal73546', '학생목록 설정', 'ulimStudentSettingsModalBody73546', `
        <footer class="ulim-sm-modal-footer73546">
          <button type="button" class="admin-btn gray" data-ulim-close-modal="ulimStudentSettingsModal73546">닫기</button>
        </footer>`)}
      ${createModal('ulimStudentDetailModal73546', '학생 상세정보', 'ulimStudentDetailModalBody73546', `
        <footer class="ulim-sm-modal-footer73546">
          <button type="button" class="admin-btn gray" data-ulim-close-modal="ulimStudentDetailModal73546">취소</button>
          <button type="button" class="admin-btn blue" id="ulimStudentDetailApply73546">변경 반영</button>
        </footer>`)}
      ${createModal('ulimStudentManageModal73546', '학생 관리', 'ulimStudentManageModalBody73546', `
        <footer class="ulim-sm-modal-footer73546">
          <button type="button" class="admin-btn gray" data-ulim-close-modal="ulimStudentManageModal73546">닫기</button>
        </footer>`)}
      ${createModal('ulimStudentMessageModal73546', '메시지 보내기', 'ulimStudentMessageModalBody73546', `
        <footer class="ulim-sm-modal-footer73546">
          <button type="button" class="admin-btn gray" data-ulim-close-modal="ulimStudentMessageModal73546">닫기</button>
          <button type="button" class="admin-btn orange" id="ulimMessagePreview73546">미리보기</button>
          <button type="button" class="admin-btn" id="ulimMessageDraft73546">임시저장</button>
          <button type="button" class="admin-btn red" id="ulimMessageSend73546">발송</button>
        </footer>`)}
    `;
  }

  function injectStyles() {
    if (document.getElementById('ulimStudentManagementUiStyle73546')) return;
    const style = document.createElement('style');
    style.id = 'ulimStudentManagementUiStyle73546';
    style.textContent = `
      #${CARD_ID} .ulim-student-help{display:none!important}
      #ulimStudentPrimaryActions73546{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 14px}
      #ulimStudentPrimaryActions73546 .admin-btn{min-height:42px;padding:10px 16px}
      .ulim-sm-list-header73546{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 0 10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}
      .ulim-sm-list-header73546[hidden]{display:none!important}
      .ulim-sm-list-header73546>div:first-child{display:flex;align-items:center;gap:10px}
      #ulimStudentSelectedCount73546{display:inline-flex;padding:4px 8px;border-radius:999px;background:#e0f2fe;color:#075985;font-size:12px;font-weight:800}
      .ulim-sm-list-actions73546{display:flex;gap:8px;flex-wrap:wrap}
      #${CARD_ID} .ulim-toolbar-actions{display:none!important}
      #${CARD_ID} .ulim-toolbar{grid-template-columns:minmax(220px,1fr) 170px!important;margin-top:8px!important}
      #${CARD_ID} .ulim-table-wrap table{min-width:1120px!important}
      #${CARD_ID} .ulim-sm-hidden-col73546{display:none!important}
      #${CARD_ID} .ulim-sm-select-cell73546{width:44px;text-align:center}
      #${CARD_ID} .ulim-sm-select-cell73546 input{width:18px;height:18px;cursor:pointer}
      #${CARD_ID} .ulim-sm-name-wrap73546{display:flex;align-items:center;gap:6px;min-width:150px}
      #${CARD_ID} .ulim-sm-name-wrap73546>input{min-width:110px}
      #${CARD_ID} .ulim-sm-gear73546{border:0;background:#eef2ff;color:#3730a3;border-radius:9px;width:34px;height:34px;font-size:17px;cursor:pointer;flex:0 0 auto}
      #${CARD_ID} .ulim-sm-operation-date73546{margin-top:6px!important;font-size:11px!important;padding:6px!important}
      #${CARD_ID} .ulim-sm-manage73546{white-space:nowrap}
      #${CARD_ID} .ulim-sm-row-actions73548{display:flex;gap:6px;align-items:center;white-space:nowrap}
      #${CARD_ID} .ulim-sm-row-actions73548 .admin-btn{padding:8px 11px;min-width:54px}
      #${CARD_ID} .ulim-student-uid,#${CARD_ID} .ulim-relation-badge,#${CARD_ID} .ulim-sync-stack{display:none!important}
      #${CARD_ID} td[data-ulim-visible="attendance"]>input{border:0;background:transparent;font-weight:800;padding-left:0}
      #${CARD_ID} td[data-ulim-visible="instructor"]>input{border:0;background:transparent;padding-left:0}
      #${CARD_ID} td[data-ulim-visible="classes"] select{min-width:280px;min-height:92px}
      #${CARD_ID} .ulim-operation-note{max-width:220px}
      .ulim-sm-modal73546{display:none;position:fixed;inset:0;z-index:2147482800;align-items:center;justify-content:center;padding:18px}
      .ulim-sm-modal73546.open{display:flex}
      .ulim-sm-modal-backdrop73546{position:absolute;inset:0;background:rgba(15,23,42,.58)}
      .ulim-sm-modal-panel73546{position:relative;z-index:2;width:min(960px,96vw);max-height:92vh;display:flex;flex-direction:column;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(15,23,42,.32);overflow:hidden}
      #ulimStudentModalPortal73548 .ulim-create-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px}
      #ulimStudentModalPortal73548 .ulim-create-grid .wide{grid-column:span 2}
      #ulimStudentModalPortal73548 .ulim-create-grid input,#ulimStudentModalPortal73548 .ulim-create-grid select,#ulimStudentModalPortal73548 .ulim-create-grid textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:9px;background:#fff}
      #ulimStudentModalPortal73548 .ulim-create-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}
      #ulimStudentModalPortal73548 .ulim-time-slots{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:7px}
      #ulimStudentModalPortal73548 .ulim-class-catalog-list{display:grid;gap:6px;max-height:280px;overflow:auto}
      #ulimStudentModalPortal73548 details{margin:0!important}
      .ulim-sm-modal-header73546{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #e2e8f0;background:#fff}
      .ulim-sm-modal-header73546 h4{margin:0;font-size:19px;color:#0f172a}
      .ulim-sm-modal-close73546{border:0;background:#f1f5f9;border-radius:10px;width:36px;height:36px;font-size:26px;line-height:1;cursor:pointer;color:#334155}
      .ulim-sm-modal-body73546{padding:16px 18px;overflow:auto}
      .ulim-sm-modal-footer73546{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #e2e8f0;background:#f8fafc;flex-wrap:wrap}
      .ulim-sm-modal73546 details.ulim-create-box{display:block!important;margin:0!important;border:0!important;background:transparent!important;padding:0!important}
      .ulim-sm-modal73546 details.ulim-create-box>summary{display:none!important}
      .ulim-sm-settings-grid73546{display:grid;grid-template-columns:repeat(2,minmax(190px,1fr));gap:10px}
      .ulim-sm-settings-grid73546 .admin-btn{min-height:48px;text-align:left;padding:12px 14px}
      .ulim-sm-detail-grid73546{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:12px}
      .ulim-sm-detail-grid73546 label{display:block;font-size:12px;font-weight:800;color:#334155;margin-bottom:5px}
      .ulim-sm-detail-grid73546 input,.ulim-sm-detail-grid73546 textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:10px 11px;background:#fff;font-size:14px}
      .ulim-sm-detail-grid73546 textarea{min-height:120px;resize:vertical}
      .ulim-sm-detail-wide73546{grid-column:1/-1}
      .ulim-sm-manage-actions73546{display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:10px}
      .ulim-sm-manage-actions73546 .admin-btn{min-height:46px}
      #ulimStudentMessageModalBody73546>.admin-card{box-shadow:none!important;border:0!important;padding:0!important;margin:0!important}
      #ulimStudentMessageModalBody73546>.admin-card>h3,#ulimStudentMessageModalBody73546>.admin-card>p,#ulimStudentMessageModalBody73546>.admin-card>.admin-grid,#ulimStudentMessageModalBody73546>.admin-card>.admin-btn-row,#noticeTargetTableWrap{display:none!important}
      #ulimStudentMessageModalBody73546 .admin-recipient-row{display:flex!important;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 14px!important}
      #ulimStudentMessageModalBody73546 #noticeMessagePreview{max-height:280px;overflow:auto;white-space:pre-wrap}
      #ulimStudentMessageModalBody73546 .admin-summary{margin-top:10px!important}
      body.ulim-sm-modal-open73546{overflow:hidden}
      @media(max-width:760px){
        .ulim-sm-primary73546 .admin-btn{flex:1 1 calc(50% - 8px)}
        .ulim-sm-list-header73546{align-items:flex-start;flex-direction:column}
        .ulim-sm-list-actions73546{width:100%}.ulim-sm-list-actions73546 .admin-btn{flex:1}
        .ulim-sm-detail-grid73546,.ulim-sm-settings-grid73546,.ulim-sm-manage-actions73546{grid-template-columns:1fr}
        .ulim-sm-modal-panel73546{width:98vw;max-height:94vh}
      }
    `;
    document.head.appendChild(style);
  }

  function moveModalPortalsToBody() {
    if (!document.body) return;
    let portal = document.getElementById('ulimStudentModalPortal73548');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'ulimStudentModalPortal73548';
      portal.setAttribute('data-ulim-modal-portal', '73548');
      document.body.appendChild(portal);
    }
    document.querySelectorAll('.ulim-sm-modal73546').forEach(function (modal) {
      if (modal.parentElement !== portal) portal.appendChild(modal);
    });
  }

  function openModal(id) {
    moveLegacyPanels();
    moveModalPortalsToBody();
    try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {}
    const modal = document.getElementById(id);
    if (!modal) return;
    const body = modal.querySelector('.ulim-sm-modal-body73546');
    if (body && !body.children.length && !text(body.textContent)) {
      body.innerHTML = '<div style="padding:18px;color:#64748b;text-align:center;">화면 준비가 완료되지 않았습니다. 학생목록을 새로고침한 뒤 다시 열어주세요.</div>';
    }
    modal.classList.add('open');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ulim-sm-modal-open73546');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.ulim-sm-modal73546.open')) document.body.classList.remove('ulim-sm-modal-open73546');
  }

  function moveLegacyPanels() {
    const root = card();
    if (!root) return;

    const studentDetails = document.getElementById('ulimNewStudentName7352')?.closest('details');
    const classDetails = document.getElementById('ulimClassInstructor7354')?.closest('details');
    const courseDetails = document.getElementById('ulimCourseWindowMonth7352')?.closest('details');

    const targets = [
      [studentDetails, 'ulimStudentAddModalBody73546'],
      [classDetails, 'ulimClassAddModalBody73546'],
      [courseDetails, 'ulimCourseSettingsModalBody73546']
    ];
    targets.forEach(function (pair) {
      const node = pair[0];
      const target = document.getElementById(pair[1]);
      if (!node || !target || node.parentElement === target) return;
      node.open = true;
      target.appendChild(node);
    });

    const messageText = document.getElementById('noticeMessageText');
    const messageCard = messageText ? messageText.closest('.admin-card') : null;
    const messageBody = document.getElementById('ulimStudentMessageModalBody73546');
    if (messageCard && messageBody && messageCard.parentElement !== messageBody) {
      messageBody.appendChild(messageCard);
      const recipient = messageCard.querySelector('.admin-recipient-row');
      const textField = messageText.closest('.admin-field');
      if (recipient && textField) messageCard.insertBefore(recipient, textField);
    }

    const settingsBody = document.getElementById('ulimStudentSettingsModalBody73546');
    if (settingsBody && !settingsBody.dataset.ready) {
      settingsBody.dataset.ready = '1';
      settingsBody.innerHTML = `
        <div class="ulim-sm-settings-grid73546">
          <button type="button" class="admin-btn" data-ulim-setting-action="sync">시트기록</button>
          <button type="button" class="admin-btn" data-ulim-setting-action="import">시트 내용 불러오기</button>
          <button type="button" class="admin-btn" data-ulim-setting-action="homonym">동명이인 점검</button>
          <button type="button" class="admin-btn" data-ulim-setting-action="reconcile">출석부 반 자동매칭</button>
          <button type="button" class="admin-btn" data-ulim-setting-action="applications">수강신청 불러오기·적용</button>
        </div>`;
    }
  }

  function setListVisibility(visible) {
    listExpanded = !!visible;
    const header = document.getElementById('ulimStudentListHeader73546');
    const toolbar = card()?.querySelector('.ulim-toolbar');
    const summary = document.getElementById(SUMMARY_ID);
    const wrap = tableWrap();
    if (header) header.hidden = !listExpanded;
    if (toolbar) toolbar.style.display = listExpanded ? 'grid' : 'none';
    if (summary) summary.style.display = listExpanded ? 'block' : 'none';
    if (wrap) wrap.style.display = listExpanded ? 'block' : 'none';
    const button = document.getElementById('ulimStudentListToggle73546');
    if (button) button.textContent = listExpanded ? '목록 새로고침' : '학생목록 펼치기';
  }

  async function expandOrReloadList() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    setListVisibility(true);
    if (typeof global.ulimStudentManagementLoad7352 === 'function') {
      await global.ulimStudentManagementLoad7352(false);
      queueTransform();
    }
  }

  async function openPreparedModal(modalId, readinessSelector) {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    moveLegacyPanels();
    moveModalPortalsToBody();
    const readiness = readinessSelector ? document.querySelector(readinessSelector) : null;
    const needsLoad = !readiness || (readiness.tagName === 'SELECT' && readiness.options.length === 0);
    if (needsLoad && typeof global.ulimStudentManagementLoad7352 === 'function') {
      await global.ulimStudentManagementLoad7352(false);
      moveLegacyPanels();
      moveModalPortalsToBody();
    }
    openModal(modalId);
  }

  function getRowKey(row) {
    return text(row && row.dataset && row.dataset.rowKey);
  }

  function getRowInput(row, suffix) {
    const key = getRowKey(row);
    return key ? document.getElementById(key + suffix) : null;
  }

  function selectedClassNames(row) {
    const select = getRowInput(row, '_classes');
    if (!select) return [];
    return Array.from(select.selectedOptions || []).map(function (option) {
      return text(option.textContent).replace(/\s*\/.*$/, '');
    }).filter(Boolean);
  }

  function statusFromRow(row) {
    const status = getRowInput(row, '_status');
    if (!status) return '재원';
    if (status.disabled && /등록취소/.test(text(status.textContent))) return '등록취소';
    if (status.value === 'leave') return '휴원';
    if (status.value === 'withdrawn') return '퇴원';
    return '재원';
  }

  function snapshotRow(row) {
    const key = getRowKey(row);
    if (!key) return null;
    const cells = row.children;
    const attendanceInput = cells[2] ? cells[2].querySelector('input') : null;
    const nameInput = getRowInput(row, '_name');
    const phoneInput = getRowInput(row, '_phone');
    const parentInput = getRowInput(row, '_parent');
    const instructorInput = getRowInput(row, '_instructors');
    const memoInput = getRowInput(row, '_memo');
    const classNames = selectedClassNames(row);
    return {
      key: key,
      studentNo: text(attendanceInput && attendanceInput.value),
      attendanceNo: text(attendanceInput && attendanceInput.value),
      name: text(nameInput && nameInput.value),
      studentName: text(nameInput && nameInput.value),
      studentPhone: text(phoneInput && phoneInput.value),
      parentPhone: text(parentInput && parentInput.value),
      instructor: text(instructorInput && instructorInput.value),
      instructorName: text(instructorInput && instructorInput.value),
      className: classNames.join(', '),
      currentClass: classNames.join(', '),
      memo: text(memoInput && memoInput.value),
      enrollmentStatus: statusFromRow(row),
      studentStatus: statusFromRow(row)
    };
  }

  function updateSelectedCount() {
    const count = document.getElementById('ulimStudentSelectedCount73546');
    if (count) count.textContent = '선택 ' + selectedKeys.size + '명';

    const rows = Array.from(document.querySelectorAll('#' + TABLE_ID + ' tbody tr[data-row-key]'));
    const master = document.getElementById('ulimStudentMasterCheck73546');
    if (master) {
      const visibleKeys = rows.map(getRowKey).filter(Boolean);
      const checked = visibleKeys.filter(function (key) { return selectedKeys.has(key); }).length;
      master.checked = !!visibleKeys.length && checked === visibleKeys.length;
      master.indeterminate = checked > 0 && checked < visibleKeys.length;
    }
  }

  function toggleRowSelection(row, checked) {
    const key = getRowKey(row);
    if (!key) return;
    if (checked) {
      selectedKeys.add(key);
      const snapshot = snapshotRow(row);
      if (snapshot) selectedStudents.set(key, snapshot);
    } else {
      selectedKeys.delete(key);
      selectedStudents.delete(key);
    }
    updateSelectedCount();
  }

  function transformTable() {
    transformQueued = false;
    const root = document.getElementById(TABLE_ID);
    const table = root && root.querySelector('table');
    if (!table) {
      updateSelectedCount();
      return;
    }

    const headRow = table.querySelector('thead tr');
    if (headRow && !headRow.querySelector('#ulimStudentMasterCheck73546')) {
      const th = document.createElement('th');
      th.className = 'ulim-sm-select-cell73546';
      th.innerHTML = '<input type="checkbox" id="ulimStudentMasterCheck73546" aria-label="전체 학생 선택">';
      headRow.insertBefore(th, headRow.firstChild);
      th.querySelector('input').addEventListener('change', function (event) {
        const checked = !!event.target.checked;
        Array.from(table.querySelectorAll('tbody tr[data-row-key]')).forEach(function (row) {
          const box = row.querySelector('input[data-ulim-row-check="1"]');
          if (box) box.checked = checked;
          toggleRowSelection(row, checked);
        });
      });
    }

    const headers = headRow ? Array.from(headRow.children) : [];
    const headerMap = {
      0: '선택', 1: '재원상태', 2: '출결번호', 3: '학생명', 8: '처리구분', 10: '수강반', 11: '담당강사', 14: '관리'
    };
    headers.forEach(function (cell, index) {
      const wanted = Object.prototype.hasOwnProperty.call(headerMap, index);
      cell.classList.toggle('ulim-sm-hidden-col73546', !wanted);
      if (wanted && index !== 0) cell.textContent = headerMap[index];
    });

    Array.from(table.querySelectorAll('tbody tr[data-row-key]')).forEach(function (row) {
      const key = getRowKey(row);
      if (!key) return;
      if (!row.querySelector('input[data-ulim-row-check="1"]')) {
        const td = document.createElement('td');
        td.className = 'ulim-sm-select-cell73546';
        td.innerHTML = '<input type="checkbox" data-ulim-row-check="1" aria-label="학생 선택">';
        row.insertBefore(td, row.firstChild);
        const box = td.querySelector('input');
        box.checked = selectedKeys.has(key);
        box.addEventListener('change', function () { toggleRowSelection(row, box.checked); });
      }

      const cells = Array.from(row.children);
      const wantedIndexes = new Set([0, 1, 2, 3, 8, 10, 11, 14]);
      cells.forEach(function (cell, index) {
        cell.classList.toggle('ulim-sm-hidden-col73546', !wantedIndexes.has(index));
      });

      if (cells[2]) cells[2].dataset.ulimVisible = 'attendance';
      if (cells[10]) cells[10].dataset.ulimVisible = 'classes';
      if (cells[11]) cells[11].dataset.ulimVisible = 'instructor';

      const nameCell = cells[3];
      const nameInput = getRowInput(row, '_name');
      if (nameCell && nameInput && !nameCell.querySelector('.ulim-sm-name-wrap73546')) {
        const wrap = document.createElement('div');
        wrap.className = 'ulim-sm-name-wrap73546';
        nameCell.insertBefore(wrap, nameCell.firstChild);
        wrap.appendChild(nameInput);
        const gear = document.createElement('button');
        gear.type = 'button';
        gear.className = 'ulim-sm-gear73546';
        gear.textContent = '⚙';
        gear.title = '학생 상세정보';
        gear.addEventListener('click', function () { openDetailModal(key); });
        wrap.appendChild(gear);
      }

      const operationCell = cells[8];
      const operationDate = getRowInput(row, '_operation_date');
      if (operationCell && operationDate && operationDate.parentElement !== operationCell) {
        operationDate.classList.add('ulim-sm-operation-date73546');
        operationDate.title = '처리일';
        operationCell.appendChild(operationDate);
      }

      const actionCell = cells[14];
      if (actionCell && !actionCell.querySelector('[data-ulim-row-action="save"]')) {
        actionCell.innerHTML = '';
        actionCell.classList.add('ulim-sm-row-actions73548');
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'admin-btn blue';
        saveButton.textContent = '저장';
        saveButton.setAttribute('data-ulim-row-action', 'save');
        saveButton.addEventListener('click', function () {
          if (typeof global.ulimStudentManagementSaveRow7352 === 'function') global.ulimStudentManagementSaveRow7352(key);
        });
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'admin-btn red';
        deleteButton.textContent = '삭제';
        deleteButton.setAttribute('data-ulim-row-action', 'delete');
        deleteButton.addEventListener('click', function () {
          if (typeof global.ulimStudentManagementRetire7352 === 'function') global.ulimStudentManagementRetire7352(key, 'withdraw_delete');
        });
        actionCell.appendChild(saveButton);
        actionCell.appendChild(deleteButton);
      }

      const rowCheck = row.querySelector('input[data-ulim-row-check="1"]');
      if (rowCheck) rowCheck.checked = selectedKeys.has(key);
      if (selectedKeys.has(key)) {
        const snapshot = snapshotRow(row);
        if (snapshot) selectedStudents.set(key, snapshot);
      }
    });

    updateSelectedCount();
  }

  function queueTransform() {
    if (transformQueued) return;
    transformQueued = true;
    setTimeout(transformTable, 0);
  }

  function openDetailModal(key) {
    const row = document.querySelector('#' + TABLE_ID + ' tr[data-row-key="' + CSS.escape(key) + '"]');
    if (!row) return alert('학생정보를 다시 불러와주세요.');
    currentDetailKey = key;
    const name = getRowInput(row, '_name');
    const birth = getRowInput(row, '_birth');
    const phone = getRowInput(row, '_phone');
    const parent = getRowInput(row, '_parent');
    const start = getRowInput(row, '_start');
    const memo = getRowInput(row, '_memo');
    const body = document.getElementById('ulimStudentDetailModalBody73546');
    if (!body) return;
    body.innerHTML = `
      <div class="ulim-sm-detail-grid73546">
        <div><label>학생명</label><input id="ulimDetailName73546" value="${escapeHtml(name && name.value)}"></div>
        <div><label>생년월일</label><input id="ulimDetailBirth73546" type="date" value="${escapeHtml(birth && birth.value)}"></div>
        <div><label>학생 전화번호</label><input id="ulimDetailPhone73546" inputmode="tel" value="${escapeHtml(phone && phone.value)}"></div>
        <div><label>학부모 전화번호</label><input id="ulimDetailParent73546" inputmode="tel" value="${escapeHtml(parent && parent.value)}"></div>
        <div><label>등록일</label><input id="ulimDetailStart73546" type="date" value="${escapeHtml(start && start.value)}"></div>
        <div class="ulim-sm-detail-wide73546"><label>관리자 메모 · 학생 개인 특이사항</label><textarea id="ulimDetailMemo73546" placeholder="학생 개인의 특이사항이나 관리자 확인 내용을 입력하세요.">${escapeHtml(memo && memo.value)}</textarea></div>
      </div>`;
    openModal('ulimStudentDetailModal73546');
  }

  function applyDetailChanges() {
    const key = currentDetailKey;
    const row = document.querySelector('#' + TABLE_ID + ' tr[data-row-key="' + CSS.escape(key) + '"]');
    if (!row) return alert('학생정보를 다시 불러와주세요.');
    const mapping = [
      ['_name', 'ulimDetailName73546'],
      ['_birth', 'ulimDetailBirth73546'],
      ['_phone', 'ulimDetailPhone73546'],
      ['_parent', 'ulimDetailParent73546'],
      ['_start', 'ulimDetailStart73546'],
      ['_memo', 'ulimDetailMemo73546']
    ];
    mapping.forEach(function (pair) {
      const target = getRowInput(row, pair[0]);
      const source = document.getElementById(pair[1]);
      if (!target || !source) return;
      target.value = source.value;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    });
    if (selectedKeys.has(key)) {
      const snapshot = snapshotRow(row);
      if (snapshot) selectedStudents.set(key, snapshot);
    }
    closeModal('ulimStudentDetailModal73546');
  }

  function openManageModal(key) {
    const row = document.querySelector('#' + TABLE_ID + ' tr[data-row-key="' + CSS.escape(key) + '"]');
    if (!row) return alert('학생정보를 다시 불러와주세요.');
    currentManageKey = key;
    const name = text(getRowInput(row, '_name') && getRowInput(row, '_name').value) || '학생';
    const status = getRowInput(row, '_status');
    const cancelled = !!(status && status.disabled && /등록취소/.test(text(status.textContent)));
    const body = document.getElementById('ulimStudentManageModalBody73546');
    if (!body) return;
    body.innerHTML = `
      <div style="margin-bottom:12px;font-weight:900;color:#0f172a;">${escapeHtml(name)}</div>
      <div class="ulim-sm-manage-actions73546">
        <button type="button" class="admin-btn blue" data-ulim-manage-action="save">이 학생 저장</button>
        ${cancelled ? '<button type="button" class="admin-btn red" data-ulim-manage-action="delete">학생 삭제</button>' : '<button type="button" class="admin-btn" data-ulim-manage-action="withdraw">퇴원 처리</button><button type="button" class="admin-btn red" data-ulim-manage-action="cancel">등록 취소</button>'}
      </div>`;
    openModal('ulimStudentManageModal73546');
  }

  async function runManageAction(action) {
    const key = currentManageKey;
    closeModal('ulimStudentManageModal73546');
    if (!key) return;
    if (action === 'save' && typeof global.ulimStudentManagementSaveRow7352 === 'function') return global.ulimStudentManagementSaveRow7352(key);
    if (typeof global.ulimStudentManagementRetire7352 !== 'function') return;
    if (action === 'withdraw') return global.ulimStudentManagementRetire7352(key, 'withdraw');
    if (action === 'cancel') return global.ulimStudentManagementRetire7352(key, 'cancel');
    if (action === 'delete') return global.ulimStudentManagementRetire7352(key, 'delete');
  }

  function buildMessageTargets() {
    return Array.from(selectedKeys).map(function (key) {
      const row = document.querySelector('#' + TABLE_ID + ' tr[data-row-key="' + CSS.escape(key) + '"]');
      if (row) {
        const snapshot = snapshotRow(row);
        if (snapshot) selectedStudents.set(key, snapshot);
      }
      return selectedStudents.get(key) || null;
    }).filter(Boolean);
  }

  function noticeTargetKeyLocal(student) {
    return text(student.studentNo || student.attendanceNo) + '|' + text(student.name || student.studentName);
  }

  function applyMessageTargets(targets) {
    try {
      if (typeof adminNoticeTargetRows !== 'undefined') adminNoticeTargetRows = targets.slice();
      if (typeof adminNoticeSelectedMap !== 'undefined') {
        adminNoticeSelectedMap = {};
        targets.forEach(function (student) {
          const key = typeof adminNoticeTargetKey === 'function' ? adminNoticeTargetKey(student) : noticeTargetKeyLocal(student);
          adminNoticeSelectedMap[key] = true;
        });
      }
      if (typeof adminRenderNoticeTargetTable === 'function') adminRenderNoticeTargetTable();
      if (typeof adminPreviewNoticeCount === 'function') adminPreviewNoticeCount();
    } catch (_ignore) {}
  }

  function restoreMessageDraft() {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_ignore) {}
    if (!draft) return;
    const message = document.getElementById('noticeMessageText');
    if (message && !text(message.value)) message.value = text(draft.messageText);
    const recipientMap = {
      noticeRecipientStudent: draft.recipients && draft.recipients.student,
      noticeRecipientParent: draft.recipients && draft.recipients.parent,
      noticeRecipientInstructor: draft.recipients && draft.recipients.instructor,
      noticeRecipientAdmin: draft.recipients && draft.recipients.admin
    };
    Object.keys(recipientMap).forEach(function (id) {
      const input = document.getElementById(id);
      if (input && typeof recipientMap[id] === 'boolean') input.checked = recipientMap[id];
    });
    if (draft.channel) {
      const channel = document.querySelector('input[name="noticeSendChannel"][value="' + CSS.escape(draft.channel) + '"]');
      if (channel) channel.checked = true;
    }
  }

  function saveMessageDraft() {
    const message = document.getElementById('noticeMessageText');
    const checkedChannel = document.querySelector('input[name="noticeSendChannel"]:checked');
    const draft = {
      messageText: text(message && message.value),
      recipients: {
        student: !!document.getElementById('noticeRecipientStudent')?.checked,
        parent: !!document.getElementById('noticeRecipientParent')?.checked,
        instructor: !!document.getElementById('noticeRecipientInstructor')?.checked,
        admin: !!document.getElementById('noticeRecipientAdmin')?.checked
      },
      channel: text(checkedChannel && checkedChannel.value) || 'alimtalk',
      savedAt: Date.now()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    alert('메시지 내용을 임시저장했습니다.');
  }

  function openMessageModal() {
    if (!isSuperAdmin()) return alert('전체관리자 권한이 필요합니다.');
    const targets = buildMessageTargets();
    if (!targets.length) return alert('학생목록에서 메시지를 보낼 학생을 체크해주세요.');
    applyMessageTargets(targets);
    restoreMessageDraft();
    openModal('ulimStudentMessageModal73546');
  }

  function runSettingAction(action) {
    closeModal('ulimStudentSettingsModal73546');
    const map = {
      sync: 'ulimStudentManagementSyncSheets7352',
      import: 'ulimStudentManagementImportSheets7352',
      homonym: 'ulimStudentManagementInspectHomonyms73542',
      reconcile: 'ulimStudentManagementReconcileRosters7352',
      applications: 'ulimStudentManagementApplyApplications7352'
    };
    const fn = global[map[action]];
    if (typeof fn === 'function') fn();
  }

  function bindEvents() {
    document.getElementById('ulimStudentListToggle73546')?.addEventListener('click', expandOrReloadList);
    document.getElementById('ulimStudentAddOpen73546')?.addEventListener('click', function () { openPreparedModal('ulimStudentAddModal73546', '#ulimNewStudentClasses7352'); });
    document.getElementById('ulimClassAddOpen73546')?.addEventListener('click', function () { openPreparedModal('ulimClassAddModal73546', '#ulimClassInstructor7354'); });
    document.getElementById('ulimCourseSettingsOpen73546')?.addEventListener('click', function () { openPreparedModal('ulimCourseSettingsModal73546', '#ulimCourseWindowClasses7352'); });
    document.getElementById('ulimMessageOpen73546')?.addEventListener('click', openMessageModal);
    document.getElementById('ulimStudentSave73546')?.addEventListener('click', function () {
      if (typeof global.ulimStudentManagementSaveAll7352 === 'function') global.ulimStudentManagementSaveAll7352();
    });
    document.getElementById('ulimStudentSettingsOpen73546')?.addEventListener('click', function () { openModal('ulimStudentSettingsModal73546'); });
    document.getElementById('ulimStudentDetailApply73546')?.addEventListener('click', applyDetailChanges);
    document.getElementById('ulimMessagePreview73546')?.addEventListener('click', function () {
      if (typeof global.adminPreviewNoticeMessages === 'function') global.adminPreviewNoticeMessages();
    });
    document.getElementById('ulimMessageDraft73546')?.addEventListener('click', saveMessageDraft);
    document.getElementById('ulimMessageSend73546')?.addEventListener('click', function () {
      if (typeof global.adminSendNoticeMessages === 'function') global.adminSendNoticeMessages();
    });

    document.addEventListener('click', function (event) {
      const closeButton = event.target.closest('[data-ulim-close-modal]');
      if (closeButton) {
        closeModal(closeButton.getAttribute('data-ulim-close-modal'));
        return;
      }
      const settingButton = event.target.closest('[data-ulim-setting-action]');
      if (settingButton) {
        runSettingAction(settingButton.getAttribute('data-ulim-setting-action'));
        return;
      }
      const manageButton = event.target.closest('[data-ulim-manage-action]');
      if (manageButton) runManageAction(manageButton.getAttribute('data-ulim-manage-action'));
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      const open = document.querySelector('.ulim-sm-modal73546.open');
      if (open) closeModal(open.id);
    });
  }

  function observeTable() {
    const root = document.getElementById(TABLE_ID);
    if (!root || root.dataset.ulimObserver73546) return;
    root.dataset.ulimObserver73546 = '1';
    const observer = new MutationObserver(queueTransform);
    observer.observe(root, { childList: true, subtree: true });
  }

  function normalizedLabel(value) {
    return text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  }

  function removeLegacyStudentHeaderButtons() {
    const refresh = document.getElementById('adminRefreshStudentsBtn');
    if (refresh) refresh.remove();
    document.querySelectorAll('#adminDashboard button, #tabAdmin button').forEach(function (button) {
      const label = normalizedLabel(button.textContent);
      const onclick = text(button.getAttribute('onclick'));
      if (label === normalizedLabel('학생목록 새로고침') || label === normalizedLabel('재원상태 갱신') || onclick.indexOf('adminRefreshStudentEnrollmentStatuses') >= 0) {
        button.remove();
      }
    });
  }

  function install() {
    removeLegacyStudentHeaderButtons();
    if (installed) return;
    const root = card();
    if (!root) {
      setTimeout(install, 120);
      return;
    }
    installed = true;
    injectStyles();
    const heading = root.querySelector('h3');
    if (heading) heading.textContent = '학생목록';
    removeLegacyStudentHeaderButtons();
    if (!document.getElementById('ulimStudentPrimaryActions73546')) {
      const status = document.getElementById('ulimStudentManagementStatus7352');
      const holder = document.createElement('div');
      holder.innerHTML = shellHtml();
      while (holder.firstChild) root.insertBefore(holder.firstChild, status || root.firstChild);
    }
    moveLegacyPanels();
    moveModalPortalsToBody();
    bindEvents();
    observeTable();
    setListVisibility(false);
    queueTransform();
    global.ULIM_STUDENT_MANAGEMENT_UI_VERSION = VERSION;
  }

  function installLegacyButtonObserver() {
    if (!document.body || document.body.dataset.ulimStudentLegacyButtonObserver73548) return;
    document.body.dataset.ulimStudentLegacyButtonObserver73548 = '1';
    const observer = new MutationObserver(function () {
      removeLegacyStudentHeaderButtons();
      if (!installed) install();
      else { moveLegacyPanels(); moveModalPortalsToBody(); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      install();
      installLegacyButtonObserver();
    }, { once: true });
  } else {
    install();
    installLegacyButtonObserver();
  }
})(typeof window !== 'undefined' ? window : globalThis);
