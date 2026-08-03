(function (global) {
  'use strict';

  if (global.__ULIM_ATTENDANCE_ADMIN_CONTROLS_735452__) return;
  global.__ULIM_ATTENDANCE_ADMIN_CONTROLS_735452__ = true;
  global.ULIM_ATTENDANCE_ADMIN_CONTROLS_VERSION = '2026-08-04.735.04.5.2';

  var attachTimer735452 = 0;
  var wrapObserver735452 = null;
  var observedWrap735452 = null;
  var bodyObserver735452 = null;

  function text735452(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalize735452(value) {
    return text735452(value).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  }

  function readAdminInfo735452() {
    var info = null;
    try {
      if (typeof adminInfo !== 'undefined' && adminInfo && typeof adminInfo === 'object') info = adminInfo;
    } catch (_ignore1) {}
    try {
      if (!info && global.adminInfo && typeof global.adminInfo === 'object') info = global.adminInfo;
    } catch (_ignore2) {}
    if (info) return info;

    var raw = '';
    try { raw = global.sessionStorage && global.sessionStorage.getItem('adminInfo') || ''; } catch (_ignore3) {}
    if (!raw) {
      try { raw = global.localStorage && global.localStorage.getItem('adminInfo') || ''; } catch (_ignore4) {}
    }
    if (!raw) return {};
    try { return JSON.parse(raw) || {}; } catch (_ignore5) { return {}; }
  }

  function isFullAdmin735452() {
    try {
      if (typeof global.adminIsFullAdmin === 'function' && global.adminIsFullAdmin()) return true;
    } catch (_ignore1) {}
    try {
      if (typeof adminIsFullAdmin === 'function' && adminIsFullAdmin()) return true;
    } catch (_ignore2) {}
    try {
      if (document.body && document.body.classList.contains('full-admin-mode')) return true;
    } catch (_ignore3) {}

    var info = readAdminInfo735452();
    var role = normalize735452(info.firebaseRole || info.role || info.permission || info.authRole || '');
    if (/강사/.test(role) && !/(전체|관리|관리자|원장|admin|super|owner)/i.test(role)) return false;
    if (/(전체|관리|관리자|원장|admin|super|owner)/i.test(role)) return true;

    /* The page itself changes this title only for the full-admin attendance screen. */
    var title = document.getElementById('adminAttendancePanelTitle');
    if (title && /출결\s*발송/.test(text735452(title.textContent))) return true;
    return false;
  }

  function visible735452(element) {
    if (!element || !element.isConnected) return false;
    try {
      var style = global.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    } catch (_ignore) {
      return true;
    }
  }

  function headerTexts735452(table) {
    var row = table && table.querySelector('thead tr');
    if (!row) return [];
    return Array.prototype.map.call(row.querySelectorAll('th'), function (th) {
      return normalize735452(th.textContent);
    });
  }

  function isAttendanceTable735452(table) {
    if (!table) return false;
    var headers = headerTexts735452(table);
    return headers.indexOf(normalize735452('학생명')) >= 0
      && headers.indexOf(normalize735452('출석체크')) >= 0
      && headers.indexOf(normalize735452('현재상태')) >= 0
      && headers.indexOf(normalize735452('특이사항')) >= 0
      && headers.indexOf(normalize735452('메모')) >= 0;
  }

  function findAttendanceWrap735452() {
    var direct = document.getElementById('adminAttendanceTableWrap');
    if (direct) return direct;

    var tables = document.querySelectorAll('table');
    for (var index = 0; index < tables.length; index += 1) {
      if (!isAttendanceTable735452(tables[index])) continue;
      return tables[index].parentElement || tables[index];
    }

    var saveButtons = document.querySelectorAll('button');
    for (var buttonIndex = 0; buttonIndex < saveButtons.length; buttonIndex += 1) {
      if (normalize735452(saveButtons[buttonIndex].textContent) !== normalize735452('선택 출석부 저장')) continue;
      return saveButtons[buttonIndex].closest('.admin-table-wrap, .admin-panel, .admin-card, section, article, div');
    }
    return null;
  }

  function findAttendanceTable735452(wrap) {
    var direct = wrap && wrap.querySelector('table');
    if (isAttendanceTable735452(direct)) return direct;

    var tables = document.querySelectorAll('table');
    for (var index = 0; index < tables.length; index += 1) {
      if (isAttendanceTable735452(tables[index])) return tables[index];
    }
    return null;
  }

  function buttonByText735452(root, label) {
    var target = normalize735452(label);
    var buttons = (root || document).querySelectorAll('button');
    for (var index = 0; index < buttons.length; index += 1) {
      if (normalize735452(buttons[index].textContent) === target) return buttons[index];
    }
    return null;
  }

  function findActionHost735452(wrap) {
    var direct = wrap && wrap.querySelector('.ulim-attendance-actions-559');
    if (direct) return direct;

    var save = buttonByText735452(wrap || document, '선택 출석부 저장');
    var reload = buttonByText735452(wrap || document, '출석부 다시 불러오기');
    if (save && reload) {
      var node = save.parentElement;
      while (node && node !== document.body) {
        if (node.contains(reload)) return node;
        node = node.parentElement;
      }
    }
    return save ? save.parentElement : null;
  }

  function ensureStyle735452() {
    if (document.getElementById('ulim-attendance-admin-controls-style-735452')) return;
    var style = document.createElement('style');
    style.id = 'ulim-attendance-admin-controls-style-735452';
    style.textContent = [
      '#adminAttendanceTableWrap .ulim-attendance-manage-head-735452{width:84px;min-width:84px;text-align:center;white-space:nowrap;}',
      '#adminAttendanceTableWrap .ulim-attendance-manage-cell-735452{text-align:center;white-space:nowrap;}',
      '#adminAttendanceTableWrap .ulim-attendance-delete-btn-735452{border:0;border-radius:10px;min-width:68px;padding:8px 12px;background:#ef4444;color:#fff;font-weight:900;cursor:pointer;}',
      '#adminAttendanceTableWrap .ulim-attendance-delete-btn-735452:hover{filter:brightness(.96);}',
      '#adminAttendanceTableWrap .ulim-attendance-add-btn-735452{background:#f97316!important;color:#fff!important;}',
      '#adminAttendanceTableWrap .ulim-attendance-empty-actions-735452{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap;}',
      '@media(max-width:700px){',
      '#adminAttendanceTableWrap .ulim-attendance-manage-cell-735452{display:flex!important;justify-content:flex-end!important;align-items:center!important;min-height:50px;}',
      '#adminAttendanceTableWrap .ulim-attendance-delete-btn-735452{min-width:88px;min-height:42px;}',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function callAdd735452() {
    if (typeof global.ulimAttendanceOpenAddModal73545 === 'function') {
      global.ulimAttendanceOpenAddModal73545();
      return;
    }
    global.alert('학생추가 기능 파일을 불러오지 못했습니다. index.html과 student-master-admin 7.35.4.5 파일을 확인해주세요.');
  }

  function callDelete735452(index) {
    if (typeof global.ulimAttendanceRemoveRow73545 === 'function') {
      global.ulimAttendanceRemoveRow73545(index);
      return;
    }
    global.alert('출석부 삭제 기능 파일을 불러오지 못했습니다. index.html과 student-master-admin 7.35.4.5 파일을 확인해주세요.');
  }

  function hasAddButton735452(root) {
    if (!root) return false;
    var buttons = root.querySelectorAll('button');
    for (var index = 0; index < buttons.length; index += 1) {
      if (normalize735452(buttons[index].textContent) === normalize735452('학생추가')) return true;
    }
    return false;
  }

  function addAddButton735452(wrap, table) {
    var host = findActionHost735452(wrap);
    if (host && hasAddButton735452(host)) return;

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-btn orange ulim-attendance-admin-control-735452 ulim-attendance-add-btn-735452';
    button.setAttribute('data-ulim-attendance-add', '735452');
    button.textContent = '학생추가';
    button.addEventListener('click', callAdd735452);

    if (host) {
      var save = buttonByText735452(host, '선택 출석부 저장');
      host.insertBefore(button, save || host.firstChild);
      return;
    }

    if (!wrap || hasAddButton735452(wrap)) return;
    var actions = document.createElement('div');
    actions.className = 'ulim-attendance-admin-control-735452 ulim-attendance-empty-actions-735452';
    actions.appendChild(button);
    if (table && table.parentNode === wrap) wrap.insertBefore(actions, table.nextSibling);
    else wrap.appendChild(actions);
  }

  function rowIndex735452(row, fallbackIndex) {
    var raw = row && row.getAttribute('data-att-index');
    var parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallbackIndex;
  }

  function addManagementColumn735452(table) {
    if (!table) return;
    var headRow = table.querySelector('thead tr');
    if (headRow) {
      var existingHeaders = headerTexts735452(table);
      if (existingHeaders.indexOf(normalize735452('관리')) < 0) {
        var th = document.createElement('th');
        th.className = 'ulim-attendance-admin-control-735452 ulim-attendance-manage-head-735452';
        th.setAttribute('data-ulim-attendance-manage', '735452');
        th.textContent = '관리';
        headRow.appendChild(th);
      }
    }

    var rows = table.querySelectorAll('tbody tr');
    Array.prototype.forEach.call(rows, function (row, fallbackIndex) {
      if (row.querySelector('[data-ulim-attendance-manage="735452"]')) return;
      if (buttonByText735452(row, '삭제')) return;

      var index = rowIndex735452(row, fallbackIndex);
      if (!Number.isFinite(index)) return;
      if (!row.hasAttribute('data-att-index')) row.setAttribute('data-att-index', String(index));

      var td = document.createElement('td');
      td.className = 'ulim-attendance-admin-control-735452 ulim-attendance-manage-cell-735452';
      td.setAttribute('data-label', '관리');
      td.setAttribute('data-ulim-attendance-manage', '735452');

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'ulim-attendance-delete-btn-735452';
      button.textContent = '삭제';
      button.setAttribute('data-att-index', String(index));
      button.addEventListener('click', function () { callDelete735452(index); });

      td.appendChild(button);
      row.appendChild(td);
    });
  }

  function removeOwnControls735452() {
    var nodes = document.querySelectorAll('.ulim-attendance-admin-control-735452');
    Array.prototype.forEach.call(nodes, function (node) { node.remove(); });
  }

  function attachControls735452() {
    var wrap = findAttendanceWrap735452();
    bindWrapObserver735452(wrap);

    if (!isFullAdmin735452()) {
      removeOwnControls735452();
      return;
    }
    if (!wrap) return;

    ensureStyle735452();
    var table = findAttendanceTable735452(wrap);
    addAddButton735452(wrap, table);
    addManagementColumn735452(table);
    wrap.setAttribute('data-ulim-attendance-admin-controls', '735452');
  }

  function scheduleAttach735452(delay) {
    global.clearTimeout(attachTimer735452);
    attachTimer735452 = global.setTimeout(attachControls735452, Number(delay) || 0);
  }

  function bindWrapObserver735452(wrap) {
    if (wrap === observedWrap735452) return;
    if (wrapObserver735452) {
      try { wrapObserver735452.disconnect(); } catch (_ignore1) {}
      wrapObserver735452 = null;
    }
    observedWrap735452 = wrap || null;
    if (!wrap || typeof MutationObserver !== 'function') return;
    wrapObserver735452 = new MutationObserver(function () { scheduleAttach735452(0); });
    wrapObserver735452.observe(wrap, { childList: true, subtree: true });
  }

  function hookRenderer735452() {
    var original = global.adminRenderAttendanceTable;
    if (typeof original !== 'function' || original.__ulimAttendanceAdminControls735452Wrapped) return;
    var wrapped = function () {
      var result = original.apply(this, arguments);
      scheduleAttach735452(0);
      return result;
    };
    wrapped.__ulimAttendanceAdminControls735452Wrapped = true;
    wrapped.__ulimAttendanceAdminControls735452Original = original;
    global.adminRenderAttendanceTable = wrapped;
    try { adminRenderAttendanceTable = wrapped; } catch (_ignore) {}
  }

  function install735452() {
    hookRenderer735452();
    bindWrapObserver735452(findAttendanceWrap735452());
    if (!bodyObserver735452 && document.body && typeof MutationObserver === 'function') {
      bodyObserver735452 = new MutationObserver(function (mutations) {
        for (var index = 0; index < mutations.length; index += 1) {
          if (mutations[index].type === 'attributes' && mutations[index].target === document.body) {
            scheduleAttach735452(0);
            break;
          }
        }
      });
      bodyObserver735452.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    scheduleAttach735452(0);
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button, .admin-subtab, [data-admin-panel]') : null;
    if (!target) return;
    var label = normalize735452(target.textContent);
    var panel = text735452(target.getAttribute && target.getAttribute('data-admin-panel'));
    if (panel === 'adminPanelAttendance' || /출석부|출결/.test(label)) scheduleAttach735452(40);
  }, true);

  global.addEventListener('pageshow', function () { scheduleAttach735452(60); });
  global.addEventListener('storage', function () { scheduleAttach735452(60); });
  global.addEventListener('ulim-firebase-auth-ready', function () { scheduleAttach735452(80); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install735452, { once: true });
  else install735452();

  global.setTimeout(install735452, 150);
  global.setTimeout(install735452, 700);
  global.setTimeout(install735452, 1800);
})(typeof window !== 'undefined' ? window : globalThis);
